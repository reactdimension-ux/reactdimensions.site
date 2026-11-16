import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Burst, Flat, Ripple, Stage, TAU, blinkAt, blob, facet, rng, useGeo, useKick, useTap, walk } from './kit.jsx'

// A low-poly hedgehog on a mossy patch: a round faceted body covered in a few
// hundred cone spines, dark at the root and pale at the tip, laid back along
// its body, with a pale furry face and belly, a pointed snout with a black
// nose, small round ears, beady eyes and four tiny legs. Fallen leaves,
// toadstools and an acorn lie about the moss. It snuffles about on its own:
// short bursts of steps, turning as it goes, stopping to sniff the ground,
// its nose twitching, blinking. Tap it and it curls into a tight spiky ball
// (head and legs tucked in, the spines fanning out to cover it), rolls a
// short way across the patch and back, and uncurls again.

const LOOKS = {
  brown: { spine: '#4e3626', tip: '#eadcbf', skin: '#5c4030', face: '#d6b98f', belly: '#c9a77c', legs: '#6b4c38', nose: '#1a1416', ear: '#b48d66' },
  grey: { spine: '#4c4c54', tip: '#f0efea', skin: '#55555c', face: '#d9d4ca', belly: '#c8c2b6', legs: '#6a6662', nose: '#18171b', ear: '#a9a296' },
  sandy: { spine: '#9a7346', tip: '#f8ecd0', skin: '#a07a4e', face: '#f0dcb6', belly: '#ead2a8', legs: '#b08a5e', nose: '#2a1c18', ear: '#d8b88c' },
  dark: { spine: '#2a2220', tip: '#b9a892', skin: '#2e2522', face: '#8f7563', belly: '#7a6252', legs: '#4a3a32', nose: '#0f0c0d', ear: '#6e5848' },
}

const MOSS = { ground: '#6e9a46', edge: '#5a7f38', moss: ['#5d8a3a', '#7fae4c', '#4d7631'], leaves: ['#d9822b', '#c4561f', '#e8b23a', '#9a5a2a'] }

// body radii stretched out and curled up
const R0 = [0.34, 0.27, 0.45]
const R1 = [0.34, 0.34, 0.34]
const BALL = 0.44 // the rolling radius, spines and all
const N = 360

// the spines cover everything but a cap round F (face and belly); the cap
// shrinks as it curls so the spines spread over the whole ball
const F = new THREE.Vector3(0, -0.7, 0.714).normalize()
const E1 = new THREE.Vector3(1, 0, 0)
const E2 = new THREE.Vector3().crossVectors(F, E1)
const UP = new THREE.Vector3(0, 1, 0)
const LAY = new THREE.Vector3(0, 0.25, -1)

const ease = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u))
const lerp = (a, b, k) => a + (b - a) * k

// the tap, in seconds: curl, roll out, pause, roll back, uncurl
const T = { curl: 0.45, out: 1.6, hold: 1.9, back: 3.0, open: 3.6 }
const ROLL = 0.6

function action(s) {
  if (s < 0 || s >= T.open) return { c: 0, d: 0, busy: false }
  if (s < T.curl) return { c: ease(s / T.curl), d: 0, busy: true }
  if (s < T.out) return { c: 1, d: ROLL * ease((s - T.curl) / (T.out - T.curl)), busy: true }
  if (s < T.hold) return { c: 1, d: ROLL, busy: true }
  if (s < T.back) return { c: 1, d: ROLL * (1 - ease((s - T.hold) / (T.back - T.hold))), busy: true }
  return { c: 1 - ease((s - T.back) / (T.open - T.back)), d: 0, busy: true }
}

// the stop-and-go wander: pace runs fast and slow, the path is a slow loop
const pace = (it) => it - (0.8 * Math.sin(1.1 * it)) / 1.1
const paceRate = (it) => 1 - 0.8 * Math.cos(1.1 * it)
const path = (w) => [0.26 * Math.sin(w), 0.18 * Math.sin(1.6 * w + 1)]
const pathD = (w) => [0.26 * Math.cos(w), 0.288 * Math.cos(1.6 * w + 1)]

const _dir = new THREE.Vector3()
const _pos = new THREE.Vector3()
const _n = new THREE.Vector3()
const _q = new THREE.Quaternion()
const _s = new THREE.Vector3()
const _m = new THREE.Matrix4()

export function Hedgehog({ look = 'brown' }) {
  const C = LOOKS[look] || LOOKS.brown
  const { tap, handlers, clock } = useTap(1.2)
  const scuff = useKick(3)
  const r = useRef({})
  const set = (k) => (o) => (r.current[k] = o)
  const legs = useRef([])
  const eyes = useRef([])
  const st = useRef({ it: 0, phase: 0, lastC: -1, stage: 0, t0: null })
  const dust = useMemo(() => [0, 0.06, 0], [])

  const spines = useMemo(() => {
    const rr = rng(21)
    return Array.from({ length: N }, (_, i) => ({ v: (i + 0.5) / N, ph: i * 2.39996 + (rr() - 0.5) * 0.2, len: 0.12 + rr() * 0.05 }))
  }, [])

  const geo = useGeo(() => {
    const spine = new THREE.ConeGeometry(0.031, 1, 4, 3).translate(0, 0.5, 0)
    const p = spine.attributes.position
    const col = new Float32Array(p.count * 3)
    const base = new THREE.Color(C.spine)
    const tip = new THREE.Color(C.tip)
    for (let i = 0; i < p.count; i++) {
      const c = p.getY(i) > 0.6 ? tip : base
      col.set([c.r, c.g, c.b], i * 3)
    }
    spine.setAttribute('color', new THREE.BufferAttribute(col, 3))
    return {
      spine,
      ball: blob(1, 3, 1),
      face: blob(1, 4, 1),
      snout: facet(new THREE.ConeGeometry(0.066, 0.19, 7, 1).translate(0, 0.095, 0).rotateX(Math.PI / 2), 0.005, 5),
      bead: new THREE.IcosahedronGeometry(1, 1),
      leg: facet(new THREE.CylinderGeometry(0.038, 0.032, 0.1, 6).translate(0, -0.05, 0), 0.003, 6),
      ground: facet(new THREE.CylinderGeometry(1.3, 1.34, 0.14, 18, 1).translate(0, -0.07, 0), 0.02, 7, [1, 0.3, 1], (x, y) => y > -0.001),
      clump: blob(1, 8, 1),
      leaf: new THREE.OctahedronGeometry(1, 0),
      stem: facet(new THREE.CylinderGeometry(0.024, 0.032, 0.1, 6).translate(0, 0.05, 0), 0.003, 9),
      cap: facet(new THREE.SphereGeometry(1, 8, 3, 0, TAU, 0, Math.PI / 2), 0.05, 10),
      dot: new THREE.IcosahedronGeometry(1, 0),
      hit: new THREE.SphereGeometry(0.55, 10, 6),
    }
  }, [C])

  // the meadow bits, scattered once
  const decor = useMemo(() => {
    const rr = rng(13)
    const clumps = Array.from({ length: 16 }, (_, i) => {
      const a = (i / 16) * TAU + rr() * 0.3
      const d = 0.85 + rr() * 0.35
      const s = 0.045 + rr() * 0.045
      return { p: [Math.cos(a) * d, 0, Math.sin(a) * d], s: [s * 1.2, s * 0.75, s], c: MOSS.moss[i % 3] }
    })
    const leaves = Array.from({ length: 20 }, (_, i) => {
      const a = rr() * TAU
      const d = 0.35 + rr() * 0.85
      return { p: [Math.cos(a) * d, 0.008, Math.sin(a) * d], ry: rr() * TAU, rx: (rr() - 0.5) * 0.3, c: MOSS.leaves[i % 4], s: 0.75 + rr() * 0.5 }
    })
    return { clumps, leaves }
  }, [])

  // a slight tint per spine, so the coat isn't a single flat colour
  useLayoutEffect(() => {
    const m = r.current.spines
    if (!m) return
    const rr = rng(5)
    const c = new THREE.Color()
    for (let i = 0; i < N; i++) m.setColorAt(i, c.setScalar(0.82 + rr() * 0.3))
    m.instanceColor.needsUpdate = true
    st.current.lastC = -1 // a fresh mesh needs its spines laid out again
  }, [geo])

  const layout = (c) => {
    const m = r.current.spines
    const a = lerp(1.3, 0.32, c)
    const ca = Math.cos(a)
    const R = [lerp(R0[0], R1[0], c), lerp(R0[1], R1[1], c), lerp(R0[2], R1[2], c)]
    for (let i = 0; i < N; i++) {
      const sp = spines[i]
      const cb = ca - sp.v * (ca + 1)
      const sb = Math.sqrt(Math.max(0, 1 - cb * cb))
      _dir.copy(F).multiplyScalar(cb).addScaledVector(E1, Math.cos(sp.ph) * sb).addScaledVector(E2, Math.sin(sp.ph) * sb)
      _n.set(_dir.x / R[0], _dir.y / R[1], _dir.z / R[2]).normalize()
      _pos.set(_dir.x * R[0], _dir.y * R[1], _dir.z * R[2]).addScaledVector(_n, -0.02)
      _n.addScaledVector(LAY, 0.8 * (1 - c)).normalize()
      _q.setFromUnitVectors(UP, _n)
      _s.set(1, sp.len * (1 + 0.2 * c), 1)
      _m.compose(_pos, _q, _s)
      m.setMatrixAt(i, _m)
    }
    m.instanceMatrix.needsUpdate = true
  }

  useFrame((_, dt) => {
    const t = clock.elapsedTime
    const o = r.current
    const S = st.current
    const s = tap.since(t)
    const { c, d, busy } = action(s)
    const ce = ease(c)

    // a new tap: reset the scuff bookkeeping
    const t0 = t - s
    if (S.t0 !== t0) {
      S.t0 = t0
      S.stage = 0
    }

    // the wander only runs while it's uncurled
    const step = Math.min(dt, 0.05)
    if (!busy) S.it += step
    const it = S.it
    const w = 0.3 * pace(it)
    const rate = busy ? 0 : paceRate(it)
    const [px, pz] = path(w)
    const [dx, dz] = pathD(w)
    const heading = Math.atan2(dx, dz)
    const speed = Math.hypot(dx, dz) * 0.3 * rate
    S.phase += step * speed * 55

    const fx = Math.sin(heading)
    const fz = Math.cos(heading)
    o.mover.position.set(px + fx * d, 0, pz + fz * d)
    o.mover.rotation.y = heading

    // dust and a few bits of moss kicked up when it sets off and turns back
    if (busy && S.stage === 0 && s >= T.curl) {
      S.stage = 1
      scuff.kick(t)
    }
    if (busy && S.stage === 1 && s >= T.hold) {
      S.stage = 2
      scuff.kick(t)
    }
    dust[0] = o.mover.position.x
    dust[2] = o.mover.position.z

    // the body ball: rolls about its own x as it travels, settles on uncurling
    const bob = (1 - ce) * 0.006 * Math.abs(Math.sin(S.phase))
    o.ball.position.y = lerp(0.27, BALL - 0.04, ce) + bob + (c > 0 && c < 1 ? Math.sin(c * Math.PI) * 0.04 : 0)
    o.ball.rotation.x = d / BALL
    o.ball.rotation.z = (1 - ce) * Math.sin(S.phase) * 0.02
    const breathe = 1 + 0.02 * Math.sin(t * 2.6) * (1 - ce)
    o.body.scale.set(lerp(R0[0], R1[0], ce) * breathe, lerp(R0[1], R1[1], ce) * breathe, lerp(R0[2], R1[2], ce))
    o.belly.scale.set(lerp(R0[0] * 0.8, 0.25, ce), lerp(R0[1] * 0.8, 0.25, ce), lerp(R0[2] * 0.88, 0.25, ce))
    if (S.lastC !== ce) {
      layout(ce)
      S.lastC = ce
    }
    // after uncurling the spines give a little shiver
    const shiver = s > T.back ? Math.exp(-4 * (s - T.back)) * Math.sin((s - T.back) * 40) * 0.03 : 0
    o.spines.scale.setScalar(1 + shiver)

    // the head: sniffs the ground when it stops, glances side to side, tucks in
    const sniff = busy ? 0 : Math.max(0, 1 - rate / 0.8)
    const look = 0.25 * Math.sin(t * 0.7) * (1 - sniff * 0.5)
    o.head.position.set(0, lerp(-0.03, -0.12, ce), lerp(0.34, 0.08, ce))
    o.head.rotation.set(lerp(0.15 + 0.45 * sniff + 0.05 * Math.sin(t * 9) * sniff, 1.5, ce), look * (1 - ce), 0)
    o.head.scale.setScalar(lerp(1, 0.55, ce))
    // the snout jiggles and the nose twitches, most of all while sniffing
    const twitch = (Math.sin(t * 1.9) > 0.2 ? 1 : 0.3) * (0.4 + 0.6 * sniff) * (1 - ce)
    o.snout.rotation.x = 0.07 * Math.sin(t * 23) * twitch
    o.snout.rotation.y = 0.06 * Math.sin(t * 17 + 1) * twitch
    o.nose.scale.setScalar(0.03 * (1 + 0.18 * Math.sin(t * 31) * twitch))
    eyes.current.forEach((e) => e && (e.scale.y = 0.02 * blinkAt(t, 3.3, 0.7)))

    // little legs: patter along with the wander, fold away when curled
    const gait = walk(S.phase, 4)
    legs.current.forEach((g, i) => {
      if (!g) return
      const k = Math.min(1, speed * 6)
      g.rotation.x = -gait[i].swing * 0.5 * k
      g.position.y = -0.17 + gait[i].lift * 0.025 * k + ce * 0.12
      g.scale.set(1 - ce * 0.5, Math.max(0.05, 1 - ce * 0.95), 1 - ce * 0.5)
    })
  })

  const legPos = [
    [0.17, -0.22],
    [0.17, 0.22],
    [-0.17, -0.22],
    [-0.17, 0.22],
  ]

  return (
    <group
      {...handlers}
      onClick={(e) => {
        e.stopPropagation()
        if (!action(tap.since(clock.elapsedTime)).busy) tap.kick(clock.elapsedTime)
      }}
    >
      {/* a mossy patch with clumps, fallen leaves, toadstools and an acorn */}
      <mesh geometry={geo.ground}>
        <Flat color={MOSS.ground} />
      </mesh>
      {decor.clumps.map((m, i) => (
        <mesh key={i} geometry={geo.clump} position={m.p} scale={m.s} rotation-y={i}>
          <Flat color={m.c} />
        </mesh>
      ))}
      {decor.leaves.map((l, i) => (
        <mesh key={`l${i}`} geometry={geo.leaf} position={l.p} rotation={[l.rx, l.ry, 0]} scale={[0.075 * l.s, 0.006, 0.042 * l.s]}>
          <Flat color={l.c} />
        </mesh>
      ))}
      {[
        [-0.82, -0.52, 1, 0.3],
        [-0.66, -0.74, 0.7, -0.2],
        [0.95, -0.28, 0.85, 0.1],
      ].map(([x, z, k, tilt], i) => (
        <group key={`m${i}`} position={[x, 0, z]} rotation-z={tilt * 0.4} scale={k}>
          <mesh geometry={geo.stem}>
            <Flat color="#f2ead8" />
          </mesh>
          <mesh geometry={geo.cap} position-y={0.09} scale={[0.085, 0.06, 0.085]}>
            <Flat color={i === 2 ? '#c8893e' : '#d23a2e'} />
          </mesh>
          {i !== 2 &&
            [0, 1, 2, 3, 4].map((j) => {
              const a = j * 1.3
              return (
                <mesh key={j} geometry={geo.dot} position={[Math.cos(a) * 0.05, 0.135 - (j % 2) * 0.012, Math.sin(a) * 0.05]} scale={0.012}>
                  <Flat color="#ffffff" />
                </mesh>
              )
            })}
        </group>
      ))}
      <group position={[0.72, 0.035, 0.68]} rotation={[0.2, 0.6, 1.25]}>
        <mesh geometry={geo.ball} scale={[0.034, 0.046, 0.034]}>
          <Flat color="#b9813f" />
        </mesh>
        <mesh geometry={geo.cap} position-y={0.012} scale={[0.04, 0.026, 0.04]}>
          <Flat color="#6e4a2a" />
        </mesh>
        <mesh geometry={geo.stem} position-y={0.03} scale={[0.25, 0.15, 0.25]}>
          <Flat color="#5a3c22" />
        </mesh>
      </group>

      <group ref={set('mover')}>
        {/* an invisible ball round the hedgehog, so a tap on it always lands */}
        <mesh geometry={geo.hit} position-y={0.32}>
          <meshBasicMaterial visible={false} />
        </mesh>
        <group ref={set('ball')}>
          <mesh ref={set('body')} geometry={geo.ball}>
            <Flat color={C.skin} />
          </mesh>
          <mesh ref={set('belly')} geometry={geo.ball} position={[0, -0.06, 0.02]}>
            <Flat color={C.belly} />
          </mesh>
          <instancedMesh ref={set('spines')} args={[geo.spine, undefined, N]} frustumCulled={false} raycast={() => null}>
            <Flat vertexColors color="#ffffff" />
          </instancedMesh>
          {/* the face: pale fur, a pointed snout with a black nose, beady eyes */}
          <group ref={set('head')}>
            <mesh geometry={geo.face} scale={[0.15, 0.135, 0.16]}>
              <Flat color={C.face} />
            </mesh>
            <group ref={set('snout')} position={[0, -0.03, 0.1]}>
              <mesh geometry={geo.snout}>
                <Flat color={C.face} />
              </mesh>
              <mesh ref={set('nose')} geometry={geo.bead} position-z={0.19} scale={0.03}>
                <Flat color={C.nose} roughness={0.3} />
              </mesh>
            </group>
            {[-1, 1].map((sx, i) => (
              <mesh key={sx} ref={(el) => (eyes.current[i] = el)} geometry={geo.bead} position={[sx * 0.072, 0.035, 0.11]} scale={[0.02, 0.02, 0.016]}>
                <Flat color="#121014" roughness={0.25} />
              </mesh>
            ))}
            {[-1, 1].map((sx) => (
              <mesh key={`e${sx}`} geometry={geo.ball} position={[sx * 0.105, 0.085, 0.04]} rotation-z={sx * -0.5} scale={[0.045, 0.045, 0.02]}>
                <Flat color={C.ear} />
              </mesh>
            ))}
          </group>
          {legPos.map(([x, z], i) => (
            <group key={i} ref={(el) => (legs.current[i] = el)} position={[x, -0.17, z]}>
              <mesh geometry={geo.leg}>
                <Flat color={C.legs} />
              </mesh>
              <mesh geometry={geo.bead} position={[0, -0.095, 0.012]} scale={[0.038, 0.016, 0.048]}>
                <Flat color={C.legs} />
              </mesh>
            </group>
          ))}
        </group>
      </group>
      <Burst tap={scuff} geometry={geo.leaf} count={10} colors={[...MOSS.leaves, MOSS.moss[1]]} speed={0.9} gravity={3} size={0.045} life={0.9} origin={dust} spread={0.9} up={0.7} />
      <Ripple tap={tap} color="#ffffff" radius={1.1} count={2} y={0.012} opacity={0.4} />
    </group>
  )
}

export default function HedgehogScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[1.9, 1.25, 2.6]} target={[0, 0.3, 0]} hint="The hedgehog snuffles about the moss on its own, nose twitching, stopping to sniff and blinking · tap it and it curls into a spiky ball, rolls away and back, then uncurls · Look swaps brown, grey, sandy and dark · drag to orbit">
      <Hedgehog {...props} />
    </Stage>
  )
}
