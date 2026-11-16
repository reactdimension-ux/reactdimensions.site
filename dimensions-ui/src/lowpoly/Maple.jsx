import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Flat, Stage, TAU, blob, facet, rng, swayAngle, terrainGeo, useGeo, useTap, wobble } from './kit.jsx'

// A low-poly maple in full autumn colour: a sturdy, flared trunk that forks
// into two thick branches, under a round crown of faceted blobs in orange,
// red and yellow, on a patch of grass strewn with fallen leaves. Left alone,
// the crown sways gently and every few seconds a leaf lets go and
// see-saws down to the ground. Tap it and the tree shakes, a damped wobble
// that dies away, and a flurry of leaves falls from the crown.

const LOOKS = {
  fire: { crown: ['#f06a1f', '#e0401e', '#f6a12a', '#d8321c'], bark: '#5a3d2c', bark2: '#4a3224', grass: '#9ab45a' },
  gold: { crown: ['#f4c23a', '#e8a426', '#f8d65a', '#d98e1e'], bark: '#5e4430', bark2: '#4c3626', grass: '#a3b862' },
  crimson: { crown: ['#c8202e', '#a51628', '#e2443a', '#8e1022'], bark: '#47302a', bark2: '#3a2722', grass: '#8aa458' },
  rust: { crown: ['#b8582a', '#9a4422', '#d2783a', '#7f3a1e'], bark: '#4a3a30', bark2: '#3c2f27', grass: '#a59a5e' },
}

const GROUND_R = 1.5
const GROUND_H = 0.07
const groundY = (r) => GROUND_H * Math.max(0, 1 - (r / GROUND_R) ** 2)
const IDLE = 3 // leaves on the idle loop
const IDLE_EVERY = 3.2 // seconds between idle leaves
const FALL = 3.6 // seconds a leaf takes to reach the ground
const FLURRY = 26

// the crown: [x, y, z, radius]
const CROWN = [
  [0, 1.42, 0, 0.5],
  [-0.48, 1.22, 0.1, 0.36],
  [0.48, 1.26, -0.08, 0.38],
  [0.06, 1.2, 0.46, 0.36],
  [-0.08, 1.26, -0.46, 0.36],
  [-0.3, 1.66, -0.12, 0.3],
  [0.3, 1.66, 0.18, 0.3],
  [0.36, 1.1, 0.34, 0.24],
  [-0.38, 1.08, -0.3, 0.24],
]

// A maple leaf: a five-pointed star, unit sized, in the x/y plane.
function leafGeometry() {
  const s = new THREE.Shape()
  const n = 5
  for (let i = 0; i < n * 2; i++) {
    const a = Math.PI / 2 + (i / (n * 2)) * TAU
    const r = i % 2 ? 0.42 : i === 0 ? 1 : 0.85
    const x = Math.cos(a) * r
    const y = Math.sin(a) * r
    if (i === 0) s.moveTo(x, y)
    else s.lineTo(x, y)
  }
  s.closePath()
  return new THREE.ShapeGeometry(s)
}

// Where a falling leaf is u (0..1) of the way down: it slides from side to
// side, tipping into each swing, like a leaf see-sawing in still air.
function placeLeaf(m, f, u) {
  const sw = Math.sin(u * f.swings * Math.PI + f.ph)
  const y = f.o[1] + (0.04 + groundY(Math.hypot(f.o[0], f.o[2])) - f.o[1]) * u
  m.position.set(f.o[0] + Math.cos(f.dir) * sw * 0.22 + u * f.dx, y, f.o[2] + Math.sin(f.dir) * sw * 0.22 + u * f.dz)
  m.rotation.set(-Math.PI / 2 + Math.cos(u * f.swings * Math.PI + f.ph) * 0.6, 0, f.dir + u * f.turn)
}

export function Maple({ look = 'fire' }) {
  const L = LOOKS[look] || LOOKS.fire
  const { tap, handlers, clock } = useTap(1.2)
  const tree = useRef()
  const idle = useRef([])
  const flurry = useRef([])
  const ground = useGeo(() => terrainGeo({ radius: GROUND_R, height: GROUND_H, seed: 9, rings: 4, segs: 16, rough: 0.15, profile: 'dome', bands: [[0, L.grass]] }), [look])
  const geo = useGeo(
    () => ({
      trunk: facet(new THREE.CylinderGeometry(0.1, 0.17, 0.9, 7, 2).translate(0, 0.45, 0), 0.012, 3),
      root: facet(new THREE.ConeGeometry(0.28, 0.16, 7, 1).translate(0, 0.08, 0), 0.02, 4),
      branch: facet(new THREE.CylinderGeometry(0.045, 0.085, 0.55, 6, 1).translate(0, 0.27, 0), 0.008, 5),
      puff: blob(1, 11),
      leaf: leafGeometry(),
      hit: new THREE.CylinderGeometry(0.85, 0.55, 2.0, 8).translate(0, 1, 0),
    }),
    [],
  )
  // fallen leaves lying on the grass
  const litter = useMemo(() => {
    const r = rng(14)
    return Array.from({ length: 34 }, (_, i) => {
      const a = r() * TAU
      const d = 0.25 + Math.sqrt(r()) * 1.1
      return { p: [Math.cos(a) * d, groundY(d) + 0.025, Math.sin(a) * d], rot: [-Math.PI / 2 + (r() - 0.5) * 0.3, (r() - 0.5) * 0.3, r() * TAU], s: 0.05 + r() * 0.03, c: L.crown[i % L.crown.length] }
    })
  }, [look]) // eslint-disable-line react-hooks/exhaustive-deps
  // a falling leaf: where it lets go, how it swings and when
  const makeLeaf = (r, i) => {
    const b = CROWN[1 + Math.floor(r() * (CROWN.length - 1))]
    const a = r() * TAU
    return { o: [b[0] + Math.cos(a) * b[3] * 0.8, b[1] - b[3] * 0.75, b[2] + Math.sin(a) * b[3] * 0.8], ph: r() * TAU, swings: 4 + r() * 3, dir: r() * TAU, turn: (r() - 0.5) * 3, dx: Math.cos(a) * 0.3, dz: Math.sin(a) * 0.3, d: r() * 0.7, c: i }
  }
  const idleLeaves = useMemo(() => {
    const r = rng(5)
    return Array.from({ length: IDLE }, (_, i) => makeLeaf(r, i))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const flurryLeaves = useMemo(() => {
    const r = rng(8)
    return Array.from({ length: FLURRY }, (_, i) => makeLeaf(r, i))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useFrame(() => {
    const t = clock.elapsedTime
    const s = tap.since(t)
    // the shake: a damped wobble at the root on top of the breeze
    tree.current.rotation.z = swayAngle(t, 0, { rate: 0.25, amp: 0.012 }) + 0.06 * wobble(s, 13, 2.6)
    tree.current.rotation.x = swayAngle(t, 2, { rate: 0.2, amp: 0.01 }) + 0.04 * wobble(s - 0.05, 11, 2.6)
    // the idle leaves: one lets go every few seconds
    const cycle = IDLE * IDLE_EVERY
    idleLeaves.forEach((f, i) => {
      const m = idle.current[i]
      if (!m) return
      const u = (((t - i * IDLE_EVERY) % cycle) + cycle) % cycle / FALL
      m.visible = t > 1 && u < 1
      if (!m.visible) return
      placeLeaf(m, f, u)
      m.scale.setScalar(0.06 * Math.min(1, u * 12, (1 - u) * 12 + 0.6))
    })
    // the flurry shaken loose by a tap
    flurryLeaves.forEach((f, i) => {
      const m = flurry.current[i]
      if (!m) return
      const u = (s - f.d) / FALL
      m.visible = u > 0 && u < 1.15
      if (!m.visible) return
      placeLeaf(m, f, Math.min(1, u))
      m.scale.setScalar(0.075 * Math.min(1, u * 12, (1.15 - u) * 7))
    })
  })

  return (
    <group {...handlers}>
      {/* the grass and its scatter of fallen leaves */}
      <mesh geometry={ground}>
        <Flat vertexColors color="#ffffff" roughness={0.95} />
      </mesh>
      {litter.map((f, i) => (
        <mesh key={i} geometry={geo.leaf} position={f.p} rotation={f.rot} scale={f.s}>
          <Flat color={f.c} side={THREE.DoubleSide} />
        </mesh>
      ))}
      <group ref={tree}>
        <mesh geometry={geo.root} position-y={0.02}>
          <Flat color={L.bark2} />
        </mesh>
        <mesh geometry={geo.trunk}>
          <Flat color={L.bark} />
        </mesh>
        {[
          [-0.6, 0.3],
          [0.55, -0.4],
          [0.2, 2.1],
        ].map(([lean, yaw], i) => (
          <group key={i} position-y={0.82} rotation-y={yaw}>
            <mesh geometry={geo.branch} rotation-z={lean}>
              <Flat color={i % 2 ? L.bark : L.bark2} />
            </mesh>
          </group>
        ))}
        {CROWN.map(([x, y, z, r], i) => (
          <mesh key={i} geometry={geo.puff} position={[x, y, z]} scale={[r, r * 0.85, r]} rotation-y={i * 1.7}>
            <Flat color={L.crown[i % L.crown.length]} />
          </mesh>
        ))}
      </group>
      {idleLeaves.map((f, i) => (
        <mesh key={i} ref={(el) => (idle.current[i] = el)} geometry={geo.leaf} visible={false}>
          <Flat color={L.crown[(i + 2) % L.crown.length]} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {flurryLeaves.map((f, i) => (
        <mesh key={i} ref={(el) => (flurry.current[i] = el)} geometry={geo.leaf} visible={false}>
          <Flat color={L.crown[i % L.crown.length]} emissive={L.crown[i % L.crown.length]} emissiveIntensity={0.12} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {/* an invisible sleeve round the tree, so a tap anywhere on it lands */}
      <mesh geometry={geo.hit}>
        <meshBasicMaterial visible={false} />
      </mesh>
    </group>
  )
}

export default function MapleScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[3.4, 2.3, 4.6]} target={[0, 0.85, 0]} hint="The crown sways and a leaf see-saws down now and then on its own · tap the tree and it shakes out a flurry of falling leaves · Look swaps fire, gold, crimson and rust · drag to orbit">
      <Maple {...props} />
    </Stage>
  )
}
