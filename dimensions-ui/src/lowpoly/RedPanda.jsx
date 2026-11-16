import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { Burst, Flat, Stage, TAU, blinkAt, blob, facet, lookAround, rng, useGeo, useKick, useTap, walk } from './kit.jsx'

// A low-poly red panda on a mossy log: a russet body on short, stout dark
// legs, a black belly, a round head with a white muzzle, cheeks and brows,
// the red "tear" marks running from its eyes to its mouth, big white-rimmed
// ears and a long, bushy tail with pale rings. It is never still: it shifts
// and turns on the spot on all fours, looks about, sniffs the moss, flicks
// its ears, blinks and curls and sways its tail. Tap it for the classic
// surprised pose: it rears up onto its hind legs with both arms flung wide,
// tail propped behind it, holds there wide-eyed, then drops back onto all
// fours with a little bounce and a puff of moss.

const LOOKS = {
  ginger: { fur: '#d2672b', shade: '#bd5523', head: '#dc7636', dark: '#2e1913', belly: '#26140f', white: '#fbf5ea', tear: '#9a3c18', tail: '#c95f27', ring: '#efc08e', tip: '#3a1f16', earIn: '#4a2216', nose: '#140c0a' },
  russet: { fur: '#a63c1e', shade: '#923219', head: '#b44824', dark: '#1f100c', belly: '#1a0d0a', white: '#f7efe4', tear: '#6e2410', tail: '#9c3a1c', ring: '#d9925e', tip: '#22120d', earIn: '#3a1710', nose: '#110908' },
  pale: { fur: '#e2a062', shade: '#d18d52', head: '#e8ae72', dark: '#5e4033', belly: '#523629', white: '#fffaf2', tear: '#bb7440', tail: '#dc9a5c', ring: '#f8e2c2', tip: '#6a4a3a', earIn: '#7a5240', nose: '#2a1c18' },
}
const WOOD = { bark: '#6a4630', bark2: '#5a3a26', end: '#dcb98a', rings: '#b48a5c', moss: '#6aaa42', moss2: '#579638', ground: '#5c9c48', ground2: '#4d8a3c', fern: '#3f8a3a', cap: '#d8783c', stem: '#f2e6d2', shelf: '#c99a62', stone: '#a7a3ab', bits: ['#6aaa42', '#579638', '#8cc25a', '#7a5a3a'] }

const ease = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u))
const clamp = (u) => Math.max(0, Math.min(1, u))
const mix = (a, b, k) => a + (b - a) * k
const backOut = (u) => (u >= 1 ? 1 : 1 + 2.4 * (u - 1) ** 3 + 1.4 * (u - 1) ** 2)

// the log: lying along z, a flat facet on top so the panda stands level
const R = 0.32
const LEN = 2.3
const LOG_Y = 0.29
const FLOOR = LOG_Y + (R + 0.02) * Math.cos(Math.PI / 8) // top of the moss
const HOME = -0.28 // faces three-quarters to the camera

// body space: feet at y = 0, facing +z
const HIP = [0, 0.36, -0.2]
const SHOULDER = { x: 0.11, y: 0.36, z: 0.2 }
const HIPS = { x: 0.12, y: 0.36, z: -0.2 }
const UPPER = 0.2
const SIZE = 1.3
const STAND = 1.28 // how far it rears back (radians)

// the tap: rear up, hold, drop with a bounce
const DUR = 2.8
function act(s) {
  const r = { busy: s >= 0 && s < DUR, up: 0, hold: 0, y: 0, squash: 0 }
  if (!r.busy) return r
  if (s < 0.34) r.up = backOut(s / 0.34)
  else if (s < 1.8) {
    r.up = 1
    r.hold = clamp((s - 0.34) / 0.2) * clamp((1.8 - s) / 0.15)
  } else if (s < 2.12) r.up = 1 - ((s - 1.8) / 0.32) ** 2
  else {
    const q = s - 2.12
    r.y = q < 0.28 ? 0.075 * Math.sin((Math.PI * q) / 0.28) : q < 0.46 ? 0.024 * Math.sin((Math.PI * (q - 0.28)) / 0.18) : 0
    r.squash = 0.12 * Math.exp(-q * 16) + (q > 0.28 ? 0.06 * Math.exp(-(q - 0.28) * 16) : 0) - (q > 0.04 && q < 0.26 ? 0.04 * Math.sin((Math.PI * (q - 0.04)) / 0.22) : 0)
  }
  return r
}

// the idle, in seconds of idle time: stand and look, shuffle round, sniff
// the moss, shuffle back, stand, a last step home
const CYCLE = 13
const WALKS = [
  [4.2, 6.4, 0, 0.55],
  [8.8, 11, 0.55, -0.25],
  [12.1, 13, -0.25, 0],
]
function idleAt(it) {
  const c = it % CYCLE
  let yaw = 0
  let A = 0
  for (const [a, b, y0, y1] of WALKS) {
    if (c >= b) yaw = y1
    else if (c >= a) {
      yaw = mix(y0, y1, ease((c - a) / (b - a)))
      A = clamp((c - a) / 0.3) * clamp((b - c) / 0.3)
    }
  }
  const sniff = c > 6.5 && c < 8.7 ? ease((c - 6.5) / 0.5) * ease((8.7 - c) / 0.5) : 0
  return { yaw, A, sniff }
}

// a bushy ringed tail: a chain of overlapping faceted lumps
const TAIL_N = 10
const TAIL_L = 0.075
const tailR = (i) => 0.068 + 0.045 * Math.sin((Math.PI * (i + 1.4)) / (TAIL_N + 1.6))

export function RedPanda({ look = 'ginger' }) {
  const C = LOOKS[look] || LOOKS.ginger
  const { tap, handlers, clock } = useTap(1.2)
  const land = useKick(3)
  const camera = useThree((s) => s.camera)
  const r = useRef({})
  const set = (k) => (o) => (r.current[k] = o)
  const legs = useRef([])
  const ears = useRef([])
  const eyes = useRef([])
  const tail = useRef([])
  const st = useRef({ it: 0, p: 0, t0: null, landed: false, fresh: false, face: 0 })

  const geo = useGeo(
    () => ({
      ball: blob(1, 3, 1),
      ball2: blob(1, 7, 1),
      head: blob(1, 4, 1),
      gem: new THREE.IcosahedronGeometry(1, 0),
      upper: facet(new THREE.CylinderGeometry(0.07, 0.057, 0.26, 6).translate(0, -0.08, 0), 0.004, 5),
      lower: facet(new THREE.CylinderGeometry(0.057, 0.05, 0.18, 6).translate(0, -0.07, 0), 0.003, 6),
      log: facet(new THREE.CylinderGeometry(R, R, LEN, 8, 4, false, Math.PI / 8).rotateX(Math.PI / 2), 0.014, 11, [1, 0.6, 0.3]),
      moss: facet(new THREE.CylinderGeometry(R + 0.022, R + 0.022, LEN - 0.3, 3, 8, true, (5 * Math.PI) / 8, (3 * Math.PI) / 4).rotateX(Math.PI / 2), 0.012, 12, [1, 0.3, 1]),
      ring: new THREE.RingGeometry(0.85, 1, 8, 1, Math.PI / 8),
      branch: facet(new THREE.CylinderGeometry(0.03, 0.06, 0.5, 6).translate(0, 0.25, 0), 0.004, 13),
      ground: facet(new THREE.CylinderGeometry(1.65, 1.7, 0.14, 18, 1).translate(0, -0.07, 0), 0.02, 14, [1, 0.3, 1], (x, y) => y > -0.001),
      tuft: new THREE.ConeGeometry(0.025, 0.12, 4).translate(0, 0.06, 0),
      frond: facet(new THREE.IcosahedronGeometry(1, 0), 0.05, 15),
      stem: new THREE.CylinderGeometry(0.018, 0.024, 0.1, 6).translate(0, 0.05, 0),
      cap: facet(new THREE.SphereGeometry(1, 7, 3, 0, TAU, 0, Math.PI / 2), 0.04, 16),
      shelf: new THREE.CylinderGeometry(1, 1, 0.2, 7, 1, false, 0, Math.PI),
      leaf: new THREE.OctahedronGeometry(1, 0).scale(1, 0.35, 0.7),
      hit: new THREE.CylinderGeometry(0.55, 0.55, 1.5, 8).translate(0, 0.65, 0),
    }),
    [],
  )

  // the forest floor: grass tufts, ferns, mushrooms and stones round the log
  const decor = useMemo(() => {
    const rr = rng(21)
    const tufts = []
    for (let i = 0; i < 22; i++) {
      const a = rr() * TAU
      const d = 0.55 + rr() * 1.0
      tufts.push([Math.cos(a) * d, Math.sin(a) * d, 0.6 + rr() * 0.6, rr() * 6])
    }
    const ferns = [
      [0.62, -0.55, 1.1, 0.4],
      [-0.7, 0.35, 0.95, 2.2],
      [-0.55, -0.95, 0.8, 4.1],
    ]
    const shrooms = [
      [0.48, 0.55, 1.0],
      [0.6, 0.66, 0.7],
      [0.4, 0.72, 0.55],
      [-0.5, -0.2, 0.8],
    ]
    const stones = [
      [1.05, 0.3, 0.09],
      [-1.1, -0.4, 0.11],
      [0.9, -1.0, 0.07],
    ]
    // moss lumps along the log's flanks
    const lumps = Array.from({ length: 14 }, (_, i) => {
      const side = i % 2 ? 1 : -1
      const z = -1.05 + (i / 13) * 2.1 + (rr() - 0.5) * 0.1
      const a = 0.55 + rr() * 0.5
      return [side * Math.sin(a) * (R + 0.01), LOG_Y + Math.cos(a) * (R + 0.01), z, 0.05 + rr() * 0.04, rr() > 0.5 ? WOOD.moss : WOOD.moss2]
    })
    return { tufts, ferns, shrooms, stones, lumps }
  }, [])

  useFrame((_, dt) => {
    const t = clock.elapsedTime
    const o = r.current
    const S = st.current
    const s = tap.since(t)
    const A = act(s)
    const step = Math.min(dt, 0.05)
    if (S.t0 !== t - s) {
      S.t0 = t - s
      S.landed = false
      S.fresh = true
    }
    if (!A.busy) S.it += step
    if (A.busy && !S.landed && s >= 2.12) {
      S.landed = true
      land.kick(t)
    }
    const I = idleAt(S.it)
    const W = A.busy ? 0 : I.A
    S.p += step * TAU * 1.5 * W
    const up = A.up
    const hold = A.hold

    // turning on the spot, the bob of the steps and the tap's bounce; when
    // it rears up it turns to face whoever startled it
    let d = Math.atan2(camera.position.x, camera.position.z) - HOME - I.yaw
    d = Math.atan2(Math.sin(d), Math.cos(d))
    if (S.fresh) {
      S.fresh = false
      S.face = Math.max(-0.85, Math.min(0.85, d))
    }
    o.yaw.rotation.y = I.yaw + S.face * clamp(up)
    o.yaw.position.y = 0.012 * Math.abs(Math.cos(S.p)) * W + A.y
    o.squash.scale.set(1 + A.squash * 0.5, 1 - A.squash, 1 + A.squash * 0.5)
    o.pitch.rotation.x = -STAND * up + 0.08 * I.sniff * (1 - up)
    o.pitch.rotation.z = 0.025 * Math.sin(S.p) * W + hold * 0.04 * Math.sin(t * 3.2)
    o.torso.scale.set(1, 1 + 0.02 * Math.sin(t * 2.1), 1 + 0.01 * Math.sin(t * 2.1))

    // legs: the walk on all fours, or hind legs planted and arms flung wide
    const G = walk(S.p, 4)
    const gait = [G[1], G[3], G[0], G[2]]
    legs.current.forEach((g, i) => {
      if (!g || !g.up || !g.lo) return
      const fore = i < 2
      const sx = i % 2 ? 1 : -1
      const wx = (-0.38 * gait[i].swing - 0.25 * gait[i].lift) * W
      const wl = 0.6 * gait[i].lift * W
      if (fore) {
        const wave = hold * 0.09 * Math.sin(t * 7 + i * 1.7)
        g.up.rotation.set(mix(wx, -1.7, up), 0, sx * (0.72 * up + wave))
        g.lo.rotation.x = mix(wl, -0.3, up)
      } else {
        g.up.rotation.set(mix(wx, -0.06, up), 0, sx * 0.04 * up)
        g.lo.rotation.x = mix(wl, 0.05, up)
      }
    })

    // head: looks about, sniffs the moss; stares up wide-eyed when standing
    const la = lookAround(t, 1.3)
    const sniffBob = I.sniff * (0.035 * Math.sin(t * 17) + 0.02)
    const hx = 0.12 + la.pitch * (1 - I.sniff) + 0.55 * I.sniff + sniffBob
    o.head.rotation.set(mix(hx, STAND * 0.86, up), mix(la.yaw * 0.85 * (1 - I.sniff * 0.6), 0, up), hold * 0.1 * Math.sin(t * 2.6))
    o.nose.scale.set(1 + I.sniff * 0.25 * Math.max(0, Math.sin(t * 17)), 1, 1)
    o.mouth.scale.setScalar(0.001 + clamp(up) * 1)
    eyes.current.forEach((e) => e && (e.scale.y = 0.024 * (up > 0.3 ? 1.25 : blinkAt(t, 3.7, 2.2))))
    ears.current.forEach((e, i) => {
      if (!e) return
      const sx = i ? 1 : -1
      const f = Math.max(0, Math.sin(t * (0.8 + i * 0.27) + i * 2.1)) ** 40 * (1 - up)
      e.rotation.set(-0.55 * f - 0.25 * up, 0, -sx * (0.32 + 0.35 * f - 0.15 * up))
    })

    // tail: arcs out and curls up, swaying; propped on the log when standing
    const curl = mix(0.075 + 0.04 * Math.sin(t * 0.8 + 1), 0.035, up)
    const base = mix(-0.42 + 0.08 * Math.sin(t * 0.6), STAND - 0.45, up)
    tail.current.forEach((g, i) => {
      if (!g) return
      g.rotation.x = i === 0 ? base : curl
      g.rotation.y = (i ? 0 : -0.75 * up) + (1 - 0.7 * up) * (0.11 * Math.sin(t * 1.3 - i * 0.45) + 0.05 * Math.sin(t * 0.47 + 1 - i * 0.3) - (i ? 0.075 : 0.2) * (0.8 + 0.2 * Math.sin(t * 0.5)))
    })
  })

  const legDefs = [
    [SHOULDER, -1, true],
    [SHOULDER, 1, true],
    [HIPS, -1, false],
    [HIPS, 1, false],
  ]
  const leg = ([D, sx, fore], i) => (
    <group key={i} ref={(el) => (legs.current[i] = el && { ...legs.current[i], up: el })} position={[sx * D.x, D.y, D.z]}>
      {fore ? (
        <mesh geometry={geo.ball} scale={0.07}>
          <Flat color={C.dark} />
        </mesh>
      ) : (
        <mesh geometry={geo.ball} position={[-sx * 0.012, -0.01, 0]} scale={[0.078, 0.12, 0.105]}>
          <Flat color={C.shade} />
        </mesh>
      )}
      <mesh geometry={geo.upper}>
        <Flat color={C.dark} />
      </mesh>
      <group ref={(el) => (legs.current[i] = { ...legs.current[i], lo: el })} position-y={-UPPER}>
        <mesh geometry={geo.gem} scale={0.05}>
          <Flat color={C.dark} />
        </mesh>
        <mesh geometry={geo.lower}>
          <Flat color={C.dark} />
        </mesh>
        <mesh geometry={geo.ball2} position={[0, -0.135, 0.028]} scale={[0.064, 0.036, 0.084]}>
          <Flat color={C.dark} />
        </mesh>
      </group>
    </group>
  )

  // the tail links, nested so each bends from the one before
  const link = (i) =>
    i === TAIL_N ? null : (
      <group ref={(el) => (tail.current[i] = el)} position-z={i === 0 ? 0 : -TAIL_L}>
        <mesh geometry={i % 2 ? geo.ball : geo.ball2} position-z={-TAIL_L / 2} scale={[tailR(i), tailR(i) * 0.95, TAIL_L * 0.98]} rotation-z={i * 0.7}>
          <Flat color={i >= TAIL_N - 1 ? C.tip : i % 2 ? C.ring : C.tail} />
        </mesh>
        {link(i + 1)}
      </group>
    )

  return (
    <group
      {...handlers}
      onClick={(e) => {
        e.stopPropagation()
        if (!act(tap.since(clock.elapsedTime)).busy) tap.kick(clock.elapsedTime)
      }}
    >
      <group rotation-y={HOME}>
        {/* a round of forest floor */}
        <mesh geometry={geo.ground}>
          <Flat color={WOOD.ground} />
        </mesh>
        {decor.tufts.map(([x, z, k, ry], i) => (
          <group key={i} position={[x, 0, z]} rotation-y={ry} scale={k}>
            {[-1, 0, 1].map((j) => (
              <mesh key={j} geometry={geo.tuft} position-x={j * 0.025} rotation-z={j * 0.3} scale={[1, 1 - Math.abs(j) * 0.25, 1]}>
                <Flat color={j ? WOOD.ground2 : WOOD.fern} />
              </mesh>
            ))}
          </group>
        ))}
        {decor.ferns.map(([x, z, k, ry], i) => (
          <group key={`f${i}`} position={[x, 0, z]} rotation-y={ry} scale={k}>
            {[0, 1, 2, 3, 4, 5].map((j) => (
              <group key={j} rotation-y={(j / 6) * TAU} rotation-z={0}>
                <mesh geometry={geo.frond} position={[0.13, 0.07, 0]} rotation-z={0.55} scale={[0.15, 0.012, 0.045]}>
                  <Flat color={j % 2 ? WOOD.fern : WOOD.moss2} side={THREE.DoubleSide} />
                </mesh>
              </group>
            ))}
          </group>
        ))}
        {decor.shrooms.map(([x, z, k], i) => (
          <group key={`m${i}`} position={[x, 0, z]} scale={k}>
            <mesh geometry={geo.stem}>
              <Flat color={WOOD.stem} />
            </mesh>
            <mesh geometry={geo.cap} position-y={0.09} scale={[0.07, 0.05, 0.07]}>
              <Flat color={WOOD.cap} />
            </mesh>
          </group>
        ))}
        {decor.stones.map(([x, z, k], i) => (
          <mesh key={`s${i}`} geometry={geo.ball2} position={[x, k * 0.3, z]} scale={[k, k * 0.65, k * 0.9]}>
            <Flat color={WOOD.stone} />
          </mesh>
        ))}

        {/* the mossy log, with its cut ends, a shelf fungus and a twig */}
        <mesh geometry={geo.log} position-y={LOG_Y}>
          <Flat attach="material-0" color={WOOD.bark} />
          <Flat attach="material-1" color={WOOD.end} />
          <Flat attach="material-2" color={WOOD.end} />
        </mesh>
        {[-1, 1].map((e) =>
          [0.42, 0.72].map((k) => (
            <mesh key={`${e}${k}`} geometry={geo.ring} position={[0, LOG_Y, e * (LEN / 2 + 0.012)]} rotation-y={e < 0 ? Math.PI : 0} rotation-z={0} scale={R * k}>
              <Flat color={WOOD.rings} side={THREE.DoubleSide} />
            </mesh>
          )),
        )}
        <mesh geometry={geo.moss} position-y={LOG_Y}>
          <Flat color={WOOD.moss} side={THREE.DoubleSide} />
        </mesh>
        {decor.lumps.map(([x, y, z, k, c], i) => (
          <mesh key={`l${i}`} geometry={geo.ball} position={[x, y, z]} scale={[k * 0.7, k * 0.6, k * 1.4]}>
            <Flat color={c} />
          </mesh>
        ))}
        {[
          [-0.55, 0.1, 0.13],
          [-0.3, 0.02, 0.1],
        ].map(([z, dy, k], i) => (
          <mesh key={`sh${i}`} geometry={geo.shelf} position={[R - 0.01, LOG_Y + dy, z]} rotation={[0, Math.PI / 2, 0]} scale={[k, 0.12, k * 0.8]}>
            <Flat color={WOOD.shelf} />
          </mesh>
        ))}
        <group position={[-0.14, LOG_Y + 0.22, 0.95]} rotation={[0.35, 0, 0.75]}>
          <mesh geometry={geo.branch}>
            <Flat color={WOOD.bark2} />
          </mesh>
          {[
            [0.06, 0.5, 0, 0.3],
            [-0.06, 0.44, 0.04, -0.5],
            [0, 0.56, -0.05, 1.2],
          ].map(([x, y, z, ry], i) => (
            <mesh key={i} geometry={geo.leaf} position={[x, y, z]} rotation={[0.4, ry, 0.3]} scale={0.075}>
              <Flat color={i % 2 ? WOOD.moss2 : WOOD.moss} />
            </mesh>
          ))}
        </group>

        {/* the panda, standing on the log */}
        <group position-y={FLOOR} scale={SIZE}>
          <group ref={set('yaw')}>
            <mesh geometry={geo.hit}>
              <meshBasicMaterial visible={false} />
            </mesh>
            <group ref={set('squash')}>
              {legDefs.slice(2).map((d, i) => leg(d, i + 2))}
              <group ref={set('pitch')} position={HIP}>
                <group position={HIP.map((v) => -v)}>
                  {/* body: barrel, chest, haunch, the black belly and chest */}
                  <group ref={set('torso')} position-y={0.38}>
                    <mesh geometry={geo.ball} scale={[0.19, 0.175, 0.32]}>
                      <Flat color={C.fur} />
                    </mesh>
                  </group>
                  <mesh geometry={geo.ball2} position={[0, 0.39, 0.17]} scale={[0.17, 0.17, 0.17]}>
                    <Flat color={C.shade} />
                  </mesh>
                  <mesh geometry={geo.ball} position={[0, 0.4, -0.19]} scale={[0.2, 0.19, 0.19]}>
                    <Flat color={C.fur} />
                  </mesh>
                  <mesh geometry={geo.ball2} position={[0, 0.28, 0]} scale={[0.15, 0.11, 0.3]}>
                    <Flat color={C.belly} />
                  </mesh>
                  <mesh geometry={geo.ball} position={[0, 0.31, 0.22]} scale={[0.13, 0.12, 0.11]}>
                    <Flat color={C.belly} />
                  </mesh>
                  {legDefs.slice(0, 2).map((d, i) => leg(d, i))}

                  {/* head */}
                  <group ref={set('head')} position={[0, 0.46, 0.28]} scale={1.1}>
                    <mesh geometry={geo.head} position={[0, 0.04, 0.06]} scale={[0.168, 0.145, 0.14]}>
                      <Flat color={C.head} />
                    </mesh>
                    {/* white cheeks, muzzle and brows; the dark tear marks */}
                    {[-1, 1].map((sx) => (
                      <group key={sx}>
                        <mesh geometry={geo.ball} position={[sx * 0.112, -0.035, 0.105]} scale={[0.065, 0.058, 0.06]}>
                          <Flat color={C.white} />
                        </mesh>
                        <mesh geometry={geo.ball2} position={[sx * 0.15, -0.02, 0.05]} scale={[0.05, 0.065, 0.06]} rotation-z={sx * 0.4}>
                          <Flat color={C.white} />
                        </mesh>
                        <mesh geometry={geo.gem} position={[sx * 0.064, -0.035, 0.172]} rotation-z={sx * 0.15} scale={[0.017, 0.05, 0.014]}>
                          <Flat color={C.tear} />
                        </mesh>
                        <mesh geometry={geo.gem} position={[sx * 0.062, 0.078, 0.182]} rotation-z={-sx * 0.3} scale={[0.03, 0.02, 0.014]}>
                          <Flat color={C.white} />
                        </mesh>
                        <mesh ref={(el) => (eyes.current[sx > 0 ? 1 : 0] = el)} geometry={geo.gem} position={[sx * 0.062, 0.026, 0.188]} scale={[0.02, 0.024, 0.014]}>
                          <Flat color="#120b0a" roughness={0.25} />
                        </mesh>
                      </group>
                    ))}
                    <mesh geometry={geo.ball2} position={[0, -0.042, 0.182]} scale={[0.056, 0.05, 0.064]}>
                      <Flat color={C.white} />
                    </mesh>
                    <group ref={set('nose')} position={[0, -0.018, 0.243]}>
                      <mesh geometry={geo.gem} scale={[0.024, 0.016, 0.014]}>
                        <Flat color={C.nose} roughness={0.35} />
                      </mesh>
                    </group>
                    <group ref={set('mouth')} position={[0, -0.078, 0.226]} scale={0.001}>
                      <mesh geometry={geo.gem} scale={[0.016, 0.014, 0.008]}>
                        <Flat color="#3a1512" />
                      </mesh>
                    </group>
                    {/* big ears, white-rimmed with dark insides */}
                    {[-1, 1].map((sx, i) => (
                      <group key={`e${sx}`} position={[sx * 0.11, 0.135, 0.0]}>
                        <group ref={(el) => (ears.current[i] = el)}>
                          <mesh geometry={geo.ball} position-y={0.05} scale={[0.062, 0.072, 0.024]}>
                            <Flat color={C.white} />
                          </mesh>
                          <mesh geometry={geo.ball2} position={[0, 0.045, 0.01]} scale={[0.043, 0.052, 0.018]}>
                            <Flat color={C.earIn} />
                          </mesh>
                        </group>
                      </group>
                    ))}
                  </group>

                  {/* the bushy ringed tail */}
                  <group position={[0, 0.44, -0.33]}>{link(0)}</group>
                </group>
              </group>
            </group>
            <Burst tap={land} geometry={geo.leaf} count={12} colors={WOOD.bits} speed={1} gravity={3} size={0.04} life={0.8} origin={[0, 0.03, 0.22]} spread={1.1} up={0.7} seed={5} />
          </group>
        </group>
      </group>
    </group>
  )
}

export default function RedPandaScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[3.7, 2.5, 5.0]} target={[0, 0.95, 0]} hint="The red panda shifts about on its log, looks around, sniffs the moss, flicks its ears and curls its ringed tail · tap it and it rears up on its hind legs with its arms flung wide, then drops back down · Look swaps ginger, russet and pale · drag to orbit">
      <RedPanda {...props} />
    </Stage>
  )
}
