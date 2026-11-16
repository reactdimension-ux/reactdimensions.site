import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Flat, Particles, Stage, Sway, TAU, blinkAt, blob, cone, facet, followPath, rng, useGeo, useTap } from './kit.jsx'

// A low-poly axolotl in a little round tank: a soft faceted body, a wide
// flat head with a long smile and small bead eyes, three frilly gill stalks
// fanning out each side of its head, four stubby legs with tiny toes and a
// finned tail. It hovers over a bed of pebbles with a few swaying plants
// while an airstone sends up a stream of bubbles. Left alone, its gills
// wave one after another, its tail sways, its legs paddle lazily and it
// bobs and blinks. Tap it and its smile widens and it swims a little loop
// round the tank, tail beating hard and legs tucked, before settling back
// where it was.

const LOOKS = {
  pink: { body: '#f7b9c8', belly: '#fcd6de', fin: '#fbd2dc', gill: '#e8506e', frill: '#ff8aa2', eye: '#1b1a22', mouth: '#a8405a', blush: '#f58aa4', spot: null },
  wild: { body: '#6b7552', belly: '#8e9672', fin: '#89916c', gill: '#6e4a5e', frill: '#94687e', eye: '#14150f', mouth: '#2e3222', blush: null, spot: '#3e4630' },
  gold: { body: '#f6cf5a', belly: '#fbe39a', fin: '#fbe3a0', gill: '#ff8a4a', frill: '#ffb070', eye: '#5a3418', mouth: '#a8682a', blush: '#ffae6a', spot: '#fff2c0' },
  melanoid: { body: '#2b2c36', belly: '#3b3c48', fin: '#41424f', gill: '#3e3046', frill: '#5a4866', eye: '#0b0b0f', mouth: '#9a90a8', blush: null, spot: null },
}

const BED = 0.12 // the top of the pebble bed
const HOME = [-0.12, 0.36, -0.05] // where it hovers, in the tank's turned space
const TANK_R = 1.15
const TANK_H = 0.72
const SWIM = 2.8 // seconds the loop takes
const LOOP_R = 0.34
const NSEG = 5
const SEG = 0.12
const ease = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u))

// The loop, starting and ending at home heading +z: a circle off to the
// side with a rise in the middle.
const _p = new THREE.Vector3()
const loopAt = (u) => _p.set(HOME[0] + LOOP_R * (1 - Math.cos(TAU * u)), HOME[1] + 0.22 * Math.sin(Math.PI * u), HOME[2] + LOOP_R * Math.sin(TAU * u) * 1.15)

// One gill stalk: a tapering stem with feathery filaments down both sides,
// growing along +y.
function Gill({ geo, L, len }) {
  const n = 6
  return (
    <group>
      <mesh geometry={geo.stalk} scale={[1, len / 0.2, 1]}>
        <Flat color={L.gill} />
      </mesh>
      {Array.from({ length: n }, (_, i) =>
        [-1, 1].map((s) => (
          <mesh key={i + '' + s} geometry={geo.filament} position={[s * 0.008, len * (0.22 + (i / n) * 0.74), 0]} rotation-z={-s * 1.0} scale={1.25 - i * 0.12}>
            <Flat color={L.frill} />
          </mesh>
        )),
      )}
    </group>
  )
}

export function Axolotl({ look = 'pink' }) {
  const L = LOOKS[look] || LOOKS.pink
  const { tap, handlers, clock } = useTap(1)
  const body = useRef()
  const torso = useRef()
  const gills = useRef([])
  const tail = useRef([])
  const legs = useRef([])
  const eyes = useRef([])
  const smile = useRef()
  const pebbles = useRef()

  const geo = useGeo(
    () => ({
      torso: facet(new THREE.IcosahedronGeometry(1, 1), 0.05, 2),
      head: facet(new THREE.IcosahedronGeometry(1, 1), 0.05, 3),
      belly: facet(new THREE.IcosahedronGeometry(1, 1), 0.04, 4),
      seg: facet(new THREE.IcosahedronGeometry(1, 1), 0.04, 5),
      fin: facet(new THREE.IcosahedronGeometry(1, 0), 0.05, 6),
      leg: facet(new THREE.CylinderGeometry(0.032, 0.042, 0.13, 5, 1).translate(0, -0.065, 0), 0.003, 7),
      foot: facet(new THREE.IcosahedronGeometry(1, 0), 0.04, 8),
      toe: cone(0.012, 0.045, 4, 9),
      stalk: cone(0.022, 0.2, 5, 10),
      filament: cone(0.012, 0.075, 4, 11),
      eye: new THREE.IcosahedronGeometry(0.032, 1),
      glint: new THREE.IcosahedronGeometry(0.009, 0),
      // the mouth: a line wrapping round the front of the head, corners up
      smile: new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(Array.from({ length: 9 }, (_, i) => {
          const a = (i / 8 - 0.5) * 2
          return new THREE.Vector3(0.27 * 0.99 * Math.sin(a), 0.03 * a * a, 0.22 * 0.99 * Math.cos(a))
        })),
        16, 0.01, 3, false,
      ),
      blush: new THREE.IcosahedronGeometry(1, 0),
      spot: new THREE.IcosahedronGeometry(1, 0),
      // the tank
      bed: facet(new THREE.CylinderGeometry(TANK_R, TANK_R, BED, 20, 1).translate(0, BED / 2, 0), 0.008, 12),
      pebble: new THREE.DodecahedronGeometry(1, 0),
      glass: new THREE.CylinderGeometry(TANK_R + 0.02, TANK_R + 0.02, TANK_H, 24, 1, true).translate(0, TANK_H / 2, 0),
      lip: new THREE.TorusGeometry(TANK_R + 0.02, 0.018, 4, 32).rotateX(Math.PI / 2),
      water: new THREE.CircleGeometry(TANK_R + 0.01, 24).rotateX(-Math.PI / 2),
      blade: cone(0.035, 0.42, 4, 13),
      rock: blob(0.16, 14, 0),
      stone: facet(new THREE.CylinderGeometry(0.06, 0.07, 0.05, 6, 1), 0.006, 15),
      hit: new THREE.BoxGeometry(0.75, 0.42, 1.25).translate(0, 0, -0.05),
    }),
    [],
  )

  // the pebbles on the bed, each its own size, turn and shade
  const PB = useMemo(() => {
    const r = rng(23)
    const out = []
    while (out.length < 90) {
      const a = r() * TAU
      const d = Math.sqrt(r()) * (TANK_R - 0.08)
      const s = 0.035 + r() * 0.05
      out.push({ p: [Math.cos(a) * d, BED + s * 0.25, Math.sin(a) * d], s, rot: [r() * 3, r() * 3, r() * 3], c: ['#c9c0b4', '#a69c90', '#e6ded2', '#8f877e', '#d8cbb8'][Math.floor(r() * 5)] })
    }
    return out
  }, [])
  useEffect(() => {
    const m = pebbles.current
    const o = new THREE.Object3D()
    const c = new THREE.Color()
    PB.forEach((b, i) => {
      o.position.set(...b.p)
      o.rotation.set(...b.rot)
      o.scale.set(b.s, b.s * 0.55, b.s)
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
      m.setColorAt(i, c.set(b.c))
    })
    m.instanceMatrix.needsUpdate = true
    m.instanceColor.needsUpdate = true
  }, [PB])

  // gills: three each side, fanned from up to out-and-down
  const GILLS = useMemo(
    () =>
      [-1, 1].flatMap((s) =>
        [0, 1, 2].map((k) => ({ s, k, pos: [s * 0.25, 0.08 - k * 0.055, 0.34 - k * 0.025], fan: 0.35 + k * 0.5, len: [0.3, 0.33, 0.27][k] })),
      ),
    [],
  )
  const SPOTS = useMemo(() => {
    const r = rng(77)
    return Array.from({ length: 12 }, () => {
      const a = (r() - 0.5) * 2.2
      const z = -0.25 + r() * 0.7
      return { p: [Math.sin(a) * 0.2, Math.cos(a) * 0.15, z], s: 0.018 + r() * 0.018 }
    })
  }, [])

  const onClick = (e) => {
    e.stopPropagation()
    if (tap.since(clock.elapsedTime) > SWIM + 0.3) tap.kick(clock.elapsedTime)
  }

  useFrame(() => {
    const t = clock.elapsedTime
    const s = tap.since(t)
    const swimming = s >= 0 && s < SWIM
    const u = swimming ? ease(s / SWIM) : 0
    const busy = swimming ? Math.sin(Math.PI * Math.min(1, s / SWIM)) : 0
    // grin: wider while swimming, easing back after
    const grin = s >= 0 ? Math.min(1, s * 5) * Math.exp(-Math.max(0, s - SWIM) * 1.5) : 0
    const b = body.current
    if (swimming) followPath(b, loopAt, u, 1.2, 0.01)
    else {
      b.position.set(HOME[0], HOME[1] + Math.sin(t * 1.1) * 0.025, HOME[2])
      b.rotation.set(Math.sin(t * 0.8) * 0.04, Math.sin(t * 0.37) * 0.12, Math.sin(t * 0.9) * 0.03)
    }
    // a gentle breathing swell
    torso.current.scale.set(1 + Math.sin(t * 2.2) * 0.02, 1 + Math.sin(t * 2.2) * 0.03, 1)
    // gills ripple one after another
    GILLS.forEach((g, i) => {
      const m = gills.current[i]
      if (!m) return
      const w = Math.sin(t * (2.2 + busy * 3) - g.k * 0.9 + (g.s > 0 ? 0 : 1.3))
      m.rotation.set(-0.75 - 0.18 * w - busy * 0.5, g.s * 0.15 * w, -g.s * (g.fan + 0.12 * w))
    })
    // the tail: a travelling sway, beating hard while it swims
    const amp = 0.16 + busy * 0.32
    const rate = 1.4 + busy * 5
    tail.current.forEach((m, i) => m && (m.rotation.y = amp * (0.5 + i / NSEG) * Math.sin(t * rate - i * 0.7)))
    // legs paddle lazily, tucked back while swimming
    legs.current.forEach((m, i) => {
      if (!m) return
      const front = i < 2
      const side = i % 2 ? 1 : -1
      const pad = Math.sin(t * 1.6 + i * 1.7) * 0.22
      m.rotation.set((front ? 0.25 : 0.1) + pad * (1 - busy) + busy * 1.25, 0, side * (0.55 + busy * 0.4))
    })
    // blink (offset so a fresh shot shows open eyes)
    const bl = blinkAt(t, 4.1, 1.5)
    eyes.current.forEach((e) => e && (e.scale.y = bl))
    smile.current.scale.set(1 + 0.04 * grin, 1 + 0.9 * grin, 1 + 0.04 * grin)
    smile.current.position.y = -0.045 - 0.02 * grin
  })

  const skin = <Flat color={L.body} />

  return (
    <group {...handlers} onClick={onClick}>
      {/* the tank: a pebble bed, swaying plants, an airstone and glass */}
      <mesh geometry={geo.bed}>
        <Flat color="#d9cdb8" />
      </mesh>
      <instancedMesh ref={pebbles} args={[geo.pebble, undefined, PB.length]}>
        <Flat color="#ffffff" />
      </instancedMesh>
      <mesh geometry={geo.rock} position={[-0.62, BED + 0.06, -0.48]} scale={[1.3, 0.9, 1]}>
        <Flat color="#8d877f" />
      </mesh>
      <mesh geometry={geo.rock} position={[-0.42, BED + 0.03, -0.66]} scale={[0.7, 0.6, 0.7]} rotation-y={1.2}>
        <Flat color="#a39b90" />
      </mesh>
      {[
        [0.55, -0.55, '#4fae6a'],
        [0.66, -0.42, '#6cc47e'],
        [0.48, -0.4, '#3f9a5e'],
        [-0.75, 0.32, '#4fae6a'],
        [-0.66, 0.44, '#6cc47e'],
        [0.7, 0.35, '#58b46e'],
      ].map(([x, z, c], i) => (
        <group key={i} position={[x, BED, z]} rotation-y={i * 1.3}>
          <Sway rate={0.3} amp={0.12} i={i * 0.8} axis="x">
            <mesh geometry={geo.blade} scale={[1, 0.8 + (i % 3) * 0.25, 0.45]}>
              <Flat color={c} />
            </mesh>
          </Sway>
        </group>
      ))}
      <mesh geometry={geo.stone} position={[0.12, BED + 0.02, -0.82]}>
        <Flat color="#6a7480" />
      </mesh>
      <Particles count={12} life={2.8} origin={[0.12, BED + 0.05, -0.82]} spread={0.03} velocity={[0, 0.27, 0]} scatter={0.02} drift={0.05} size={[0.018, 0.034]} colors={['#ffffff', '#dff3ff']} opacity={[0.85, 0.2]} emissive={0.3} seed={6} />
      <mesh geometry={geo.glass} renderOrder={5}>
        <meshStandardMaterial color="#cfeaf2" transparent opacity={0.16} roughness={0.1} metalness={0.1} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh geometry={geo.lip} position-y={TANK_H}>
        <Flat color="#e8f4f8" roughness={0.3} />
      </mesh>
      <mesh geometry={geo.lip} position-y={BED}>
        <Flat color="#c8d8de" roughness={0.3} />
      </mesh>
      <mesh geometry={geo.water} position-y={TANK_H - 0.08} renderOrder={4}>
        <meshStandardMaterial color="#9fd8ec" transparent opacity={0.18} roughness={0.2} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>

      {/* the axolotl */}
      <group ref={body} position={HOME}>
        <group ref={torso}>
          <mesh geometry={geo.torso} scale={[0.2, 0.15, 0.4]} position-z={0.02}>
            {skin}
          </mesh>
          <mesh geometry={geo.belly} scale={[0.17, 0.1, 0.36]} position={[0, -0.055, 0.04]}>
            <Flat color={L.belly} />
          </mesh>
          {L.spot &&
            SPOTS.map((p, i) => (
              <mesh key={i} geometry={geo.spot} position={p.p} scale={[p.s, p.s * 0.5, p.s * 1.3]}>
                <Flat color={L.spot} />
              </mesh>
            ))}
          {/* a low ridge of fin along the back */}
          <mesh geometry={geo.fin} scale={[0.012, 0.05, 0.26]} position={[0, 0.14, -0.14]}>
            <Flat color={L.fin} />
          </mesh>
        </group>
        {/* the head: wide and flat, with a long smile */}
        <group position={[0, 0.02, 0.4]}>
          <mesh geometry={geo.head} scale={[0.27, 0.16, 0.22]}>
            {skin}
          </mesh>
          <mesh geometry={geo.belly} scale={[0.22, 0.09, 0.18]} position={[0, -0.06, 0.02]}>
            <Flat color={L.belly} />
          </mesh>
          <mesh ref={smile} geometry={geo.smile} position-y={-0.045}>
            <Flat color={L.mouth} roughness={0.4} />
          </mesh>
          {[-1, 1].map((x, i) => (
            <group key={x}>
              <group ref={(el) => (eyes.current[i] = el)} position={[x * 0.17, 0.065, 0.13]}>
                <mesh geometry={geo.eye} scale={[1, 1, 0.8]}>
                  <Flat color={L.eye} roughness={0.25} />
                </mesh>
                <mesh geometry={geo.glint} position={[x * 0.006, 0.013, 0.024]}>
                  <meshBasicMaterial color="#ffffff" />
                </mesh>
              </group>
              {L.blush && (
                <mesh geometry={geo.blush} position={[x * 0.19, -0.02, 0.135]} scale={[0.035, 0.018, 0.02]}>
                  <Flat color={L.blush} />
                </mesh>
              )}
            </group>
          ))}
        </group>
        {/* three frilly gill stalks each side */}
        {GILLS.map((g, i) => (
          <group key={i} position={g.pos}>
            <group ref={(el) => (gills.current[i] = el)}>
              <Gill geo={geo} L={L} len={g.len} />
            </group>
          </group>
        ))}
        {/* stubby legs with little toes */}
        {[
          [-0.15, 0.24],
          [0.15, 0.24],
          [-0.14, -0.2],
          [0.14, -0.2],
        ].map(([x, z], i) => (
          <group key={i} position={[x, -0.06, z]}>
            <group ref={(el) => (legs.current[i] = el)}>
              <mesh geometry={geo.leg}>{skin}</mesh>
              <group position-y={-0.13}>
                <mesh geometry={geo.foot} scale={[0.045, 0.018, 0.045]}>
                  {skin}
                </mesh>
                {[-1, 0, 1].map((k) => (
                  <group key={k} rotation-y={k * 0.6}>
                    <mesh geometry={geo.toe} position-z={0.03} rotation-x={Math.PI / 2}>
                      <Flat color={L.belly} />
                    </mesh>
                  </group>
                ))}
              </group>
            </group>
          </group>
        ))}
        {/* the finned tail: a chain of shrinking links, each a beat behind */}
        <group position-z={-0.32}>
          <TailLinks i={0} geo={geo} L={L} refs={tail} />
        </group>
        <mesh geometry={geo.hit}>
          <meshBasicMaterial visible={false} />
        </mesh>
      </group>
    </group>
  )
}

function TailLinks({ i, geo, L, refs }) {
  if (i === NSEG) return null
  const w = 1 - i * 0.16
  return (
    <group ref={(el) => (refs.current[i] = el)} position-z={i === 0 ? 0 : -SEG}>
      <mesh geometry={geo.seg} position-z={-SEG / 2} scale={[0.1 * w, 0.1 * w, SEG * 0.95]}>
        <Flat color={L.body} />
      </mesh>
      <mesh geometry={geo.fin} position-z={-SEG / 2} scale={[0.012, 0.16 * w + 0.03, SEG * 0.72]}>
        <Flat color={L.fin} />
      </mesh>
      <TailLinks i={i + 1} geo={geo} L={L} refs={refs} />
    </group>
  )
}

export default function AxolotlScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[2.4, 2.45, 3.1]} target={[0, 0.36, 0]} hint="Its frilly gills wave one after another, its tail sways and bubbles rise from the airstone · tap it and it grins wide and swims a little loop round the tank · Look swaps pink, wild, gold and melanoid · drag to orbit">
      <group rotation-y={1.35}>
        <Axolotl {...props} />
      </group>
    </Stage>
  )
}
