import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Flat, Particles, Stage, Sway, TAU, blob, facet, rng, terrainGeo, useGeo, useTap } from './kit.jsx'

// A low-poly cherry tree on a grassy mound: a twisted trunk of bent,
// tapering segments that forks into a few branches, under a cloud of pink
// faceted blossom, with fallen petals scattered over the grass. Left alone,
// petals drift down from the canopy and the crown sways a little in the
// breeze. Tap it and a gust shakes the branches and sends a swirl of petals
// streaming off the tree on a curving path.

const LOOKS = {
  pink: { bloom: ['#f497bb', '#f9b6ce', '#ec80aa'], fall: ['#ffc4d6', '#ffdbe6', '#ff9fbf'], bark: '#5e4034', bark2: '#4e352b', grass: '#9cc768' },
  white: { bloom: ['#fff4f6', '#ffe3ea', '#f6d0da'], fall: ['#ffffff', '#ffe6ec', '#f9d4de'], bark: '#4c3c36', bark2: '#3f322d', grass: '#a8cf78' },
  deep: { bloom: ['#e0457f', '#ec6a9a', '#c93470'], fall: ['#f06a9c', '#ff8db5', '#d94a80'], bark: '#3f2c28', bark2: '#33241f', grass: '#7fae55' },
  dusk: { bloom: ['#c99be0', '#e0b6ea', '#a77fd0'], fall: ['#e6c4f0', '#d0a8e6', '#f2d8f6'], bark: '#3b3040', bark2: '#2f2734', grass: '#6f8f78' },
}

const MOUND_R = 1.45
const MOUND_H = 0.11
const moundY = (r) => MOUND_H * Math.max(0, 1 - (r / MOUND_R) ** 2)
const GUST = 2.8 // seconds a gust petal takes to blow away
const SWIRL = 46

// the trunk and branches: [from, to, base radius, tip radius]
const LIMBS = [
  [[0, 0.02, 0], [0.11, 0.42, 0.04], 0.13, 0.1],
  [[0.11, 0.42, 0.04], [-0.05, 0.82, -0.02], 0.1, 0.08],
  [[-0.05, 0.82, -0.02], [0.06, 1.2, 0.04], 0.08, 0.055],
  [[-0.05, 0.82, -0.02], [-0.5, 1.12, 0.12], 0.06, 0.03],
  [[0.02, 0.98, 0.0], [0.52, 1.22, -0.12], 0.055, 0.03],
  [[0.11, 0.42, 0.04], [0.38, 0.74, 0.2], 0.05, 0.025],
]
// the blossom: [x, y, z, radius]
const PUFFS = [
  [-0.52, 1.24, 0.12, 0.3],
  [0.54, 1.32, -0.12, 0.32],
  [0.06, 1.44, 0.04, 0.38],
  [-0.14, 1.38, -0.34, 0.28],
  [0.2, 1.3, 0.36, 0.3],
  [-0.34, 1.5, 0.3, 0.24],
  [0.4, 1.58, 0.12, 0.22],
  [-0.22, 1.66, -0.06, 0.24],
  [0.42, 0.82, 0.22, 0.17],
]

const _Y = new THREE.Vector3(0, 1, 0)
// A tapering faceted segment from point a to point b.
function limb(a, b, ra, rb, seed) {
  const A = new THREE.Vector3(...a)
  const d = new THREE.Vector3(...b).sub(A)
  const len = d.length()
  const g = facet(new THREE.CylinderGeometry(rb, ra, len * 1.04, 6, 1).translate(0, len / 2, 0), ra * 0.1, seed)
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(_Y, d.normalize()))
  return g.translate(A.x, A.y, A.z)
}

// A petal: a little five-sided blade, unit sized.
function petalGeometry() {
  const s = new THREE.Shape()
  s.moveTo(0, -1)
  s.lineTo(0.7, -0.3)
  s.lineTo(0.55, 0.7)
  s.lineTo(0, 0.45)
  s.lineTo(-0.55, 0.7)
  s.lineTo(-0.7, -0.3)
  s.closePath()
  return new THREE.ShapeGeometry(s).scale(1, 0.75, 1)
}

export function CherryBlossom({ look = 'pink' }) {
  const L = LOOKS[look] || LOOKS.pink
  const { tap, handlers, clock } = useTap(1.4)
  const swirl = useRef([])
  const ground = useGeo(() => terrainGeo({ radius: MOUND_R, height: MOUND_H, seed: 5, rings: 4, segs: 16, rough: 0.12, profile: 'dome', bands: [[0, L.grass]] }), [look])
  const geo = useGeo(
    () => ({
      limbs: LIMBS.map(([a, b, ra, rb], i) => limb(a, b, ra, rb, 20 + i)),
      knot: blob(1, 4, 0),
      puff: blob(1, 7),
      petal: petalGeometry(),
      hit: new THREE.CylinderGeometry(0.75, 0.6, 1.95, 8).translate(0, 0.98, 0),
    }),
    [],
  )
  // petals lying on the grass
  const fallen = useMemo(() => {
    const r = rng(31)
    return Array.from({ length: 40 }, (_, i) => {
      const a = r() * TAU
      const d = 0.22 + Math.sqrt(r()) * 1.05
      return { p: [Math.cos(a) * d, moundY(d) + 0.022, Math.sin(a) * d], rot: [-Math.PI / 2 + (r() - 0.5) * 0.3, (r() - 0.5) * 0.3, r() * TAU], s: 0.035 + r() * 0.02, c: L.fall[i % L.fall.length] }
    })
  }, [look]) // eslint-disable-line react-hooks/exhaustive-deps
  // each petal of the gust: where on the canopy it starts, its delay and swirl
  const P = useMemo(() => {
    const r = rng(23)
    return Array.from({ length: SWIRL }, () => {
      const b = PUFFS[Math.floor(r() * (PUFFS.length - 1))]
      const a = r() * TAU
      const e = (r() - 0.5) * 2
      return { o: [b[0] + Math.cos(a) * b[3] * 0.9, b[1] + e * b[3] * 0.6, b[2] + Math.sin(a) * b[3] * 0.9], d: r() * 0.5, rad: 0.08 + r() * 0.2, ph: r() * TAU, sp: [(r() - 0.5) * 14, (r() - 0.5) * 10, (r() - 0.5) * 8], s: 0.065 + r() * 0.03 }
    })
  }, [])

  useFrame(() => {
    const s = tap.since(clock.elapsedTime)
    // the gust: petals tear off and stream away toward +x, curving and
    // swirling as they go
    P.forEach((p, i) => {
      const m = swirl.current[i]
      if (!m) return
      const u = (s - p.d) / GUST
      m.visible = u > 0 && u < 1
      if (!m.visible) return
      const a = p.ph + u * TAU * 1.6
      const w = p.rad * (0.4 + u * 1.4)
      const bend = Math.sin(u * Math.PI) * 0.9
      m.position.set(p.o[0] + u * 2.3 + Math.cos(a) * w, p.o[1] + Math.sin(u * Math.PI) * 0.35 - u * 0.55 + Math.sin(a) * w * 0.7, p.o[2] + bend + u * 0.4 + Math.sin(a) * w * 0.5)
      m.rotation.set(u * p.sp[0], u * p.sp[1], u * p.sp[2])
      m.scale.setScalar(p.s * Math.min(1, u * 10, (1 - u) * 5))
    })
  })

  return (
    <group {...handlers}>
      {/* the grassy mound and its carpet of fallen petals */}
      <mesh geometry={ground}>
        <Flat vertexColors color="#ffffff" roughness={0.95} />
      </mesh>
      {fallen.map((f, i) => (
        <mesh key={i} geometry={geo.petal} position={f.p} rotation={f.rot} scale={f.s}>
          <Flat color={f.c} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {/* the tree: a slow sway at the root, the crown a beat behind; a tap shakes both */}
      <Sway i={0} rate={0.28} amp={0.012} kick={tap} kickAmp={0.025}>
        {geo.limbs.map((g, i) => (
          <mesh key={i} geometry={g}>
            <Flat color={i % 2 ? L.bark2 : L.bark} />
          </mesh>
        ))}
        {[
          [0.11, 0.42, 0.04, 0.105],
          [-0.05, 0.82, -0.02, 0.085],
        ].map(([x, y, z, r], i) => (
          <mesh key={i} geometry={geo.knot} position={[x, y, z]} scale={r}>
            <Flat color={L.bark} />
          </mesh>
        ))}
        <Sway i={1.5} rate={0.28} amp={0.018} axis="x" kick={tap} kickAmp={0.035}>
          {PUFFS.map(([x, y, z, r], i) => (
            <mesh key={i} geometry={geo.puff} position={[x, y, z]} scale={[r, r * 0.82, r]} rotation-y={i * 1.3}>
              <Flat color={L.bloom[i % L.bloom.length]} />
            </mesh>
          ))}
        </Sway>
      </Sway>
      {/* petals drifting down on their own */}
      <Particles count={14} life={5} origin={[0, 1.32, 0]} spread={0.6} velocity={[0.08, -0.25, 0.05]} scatter={0.06} drift={0.3} size={[0.04, 0.035]} colors={L.fall} opacity={[1, 0.4]} geometry={geo.petal} spin={2.2} seed={4} />
      {/* the gust of petals */}
      {P.map((p, i) => (
        <mesh key={i} ref={(el) => (swirl.current[i] = el)} geometry={geo.petal} visible={false}>
          <Flat color={L.fall[i % L.fall.length]} emissive={L.fall[i % L.fall.length]} emissiveIntensity={0.15} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {/* an invisible sleeve round the tree, so a tap between branches lands */}
      <mesh geometry={geo.hit}>
        <meshBasicMaterial visible={false} />
      </mesh>
    </group>
  )
}

export default function CherryBlossomScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[3.4, 2.3, 4.6]} target={[0, 0.85, 0]} hint="Petals drift down and the blossom sways a little on its own · tap the tree and a gust sends a swirl of petals off the branches · Look swaps pink, white, deep and dusk · drag to orbit">
      <CherryBlossom {...props} />
    </Stage>
  )
}
