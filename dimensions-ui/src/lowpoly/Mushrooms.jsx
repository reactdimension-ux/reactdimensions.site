import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Burst, Flat, Stage, TAU, blob, cone, facet, rng, useGeo, useTap } from './kit.jsx'

// A low-poly cluster of three toadstools on a mossy mound: faceted domed caps
// with raised spots, gills underneath and pale stems with a skirt. Each cap
// breathes on its own beat and glows a little as it swells. Tap it and the
// caps puff and release clouds of spores that drift up and fade.

const KINDS = {
  toadstool: { cap: '#e0393f', spot: '#fff6ea', gill: '#f3dcc3', glow: '#ff8a7a' },
  blue: { cap: '#3f7fe0', spot: '#d9ecff', gill: '#c6d8f2', glow: '#8fd0ff' },
  amber: { cap: '#e89a2e', spot: '#fff1cf', gill: '#f2dcb0', glow: '#ffd27a' },
  violet: { cap: '#8b4fd8', spot: '#f0e0ff', gill: '#dacbf0', glow: '#d39bff' },
}
const STEM = '#f2ead8'

// x, z, height, cap radius, lean
const SHROOMS = [
  [0, 0, 0.62, 0.36, 0.05],
  [0.42, 0.2, 0.38, 0.24, -0.22],
  [-0.36, 0.26, 0.28, 0.18, 0.28],
]

export function Mushrooms({ kind = 'toadstool' }) {
  const K = KINDS[kind] || KINDS.toadstool
  const { tap, handlers, clock } = useTap(1.8)
  const caps = useRef([])

  const geo = useGeo(
    () => ({
      cap: facet(new THREE.SphereGeometry(1, 8, 4, 0, TAU, 0, Math.PI / 2), 0.04, 1),
      gill: new THREE.CircleGeometry(0.92, 8).rotateX(Math.PI / 2),
      stem: facet(new THREE.CylinderGeometry(0.75, 1, 1, 6, 1).translate(0, 0.5, 0), 0.03, 2),
      skirt: facet(new THREE.CylinderGeometry(0.9, 1.25, 0.18, 6, 1), 0.02, 3),
      spot: blob(0.12, 4, 0),
      mound: facet(new THREE.SphereGeometry(0.8, 9, 4, 0, TAU, 0, Math.PI / 2), 0.04, 5, [1, 0.5, 1], (x, y) => y < 0.001),
      tuft: cone(0.04, 0.2, 3, 6),
      spore: new THREE.IcosahedronGeometry(1, 0),
    }),
    [],
  )
  // spots scattered over each cap (polar angle, azimuth)
  const spots = useMemo(() => {
    const r = rng(11)
    return SHROOMS.map(() => Array.from({ length: 6 }, () => [0.25 + r() * 0.95, r() * TAU, 0.7 + r() * 0.6]))
  }, [])

  useFrame(() => {
    const t = clock.elapsedTime
    const k = tap.value(t)
    caps.current.forEach((c, i) => {
      if (!c) return
      const b = 0.5 + 0.5 * Math.sin(t * (1.4 + i * 0.35) + i * 2)
      const s = 1 + b * 0.06 + k * 0.22
      c.scale.set(s, (1 - b * 0.04) * (1 - k * 0.15), s)
      c.children[0].material.emissiveIntensity = b * 0.18 + k * 0.6
    })
  })

  const tufts = [
    [0.55, -0.3],
    [-0.6, -0.2],
    [0.15, 0.6],
    [-0.15, -0.55],
  ]

  return (
    <group {...handlers}>
      <mesh geometry={geo.mound} scale={[1, 0.38, 0.85]}>
        <Flat color="#6c9a3a" />
      </mesh>
      {tufts.map(([x, z], i) => (
        <group key={i} position={[x, 0.08, z]}>
          {[-0.25, 0, 0.25].map((a) => (
            <mesh key={a} geometry={geo.tuft} rotation-z={a}>
              <Flat color="#5a8a2e" />
            </mesh>
          ))}
        </group>
      ))}

      {SHROOMS.map(([x, z, h, r, lean], i) => (
        <group key={i} position={[x, 0.22, z]} rotation-z={lean}>
          <mesh geometry={geo.stem} scale={[r * 0.32, h, r * 0.32]}>
            <Flat color={STEM} />
          </mesh>
          <mesh geometry={geo.skirt} position-y={h * 0.62} scale={[r * 0.32, 1, r * 0.32]}>
            <Flat color="#fbf5e8" />
          </mesh>
          <group ref={(el) => (caps.current[i] = el)} position-y={h}>
            <mesh geometry={geo.cap} scale={[r, r * 0.72, r]}>
              <Flat color={K.cap} emissive={K.glow} emissiveIntensity={0} />
            </mesh>
            <mesh geometry={geo.gill} scale={r}>
              <Flat color={K.gill} side={THREE.DoubleSide} />
            </mesh>
            {spots[i].map(([p, a, s], j) => (
              <mesh key={j} geometry={geo.spot} position={[Math.sin(p) * Math.cos(a) * r, Math.cos(p) * r * 0.72, Math.sin(p) * Math.sin(a) * r]} scale={[s * r * 1.4, s * r * 0.6, s * r * 1.4]}>
                <Flat color={K.spot} />
              </mesh>
            ))}
          </group>
        </group>
      ))}

      <Burst tap={tap} geometry={geo.spore} count={20} colors={[K.spot, K.glow, '#ffffff']} speed={0.7} gravity={-0.6} size={0.03} life={2.2} origin={[0, 0.85, 0]} spread={1.4} up={1.3} />
    </group>
  )
}

export default function MushroomsScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[3, 2.2, 4]} target={[0, 0.45, 0]} hint="Each cap breathes and glows on its own beat · tap them and they puff out drifting spores · Kind swaps toadstool, blue, amber and violet · drag to orbit">
      <Mushrooms {...props} />
    </Stage>
  )
}
