import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Burst, Flat, Stage, TAU, blob, cone, facet, rng, useGeo, useTap } from './kit.jsx'

// A low-poly tree stump: a faceted bark trunk on splayed roots, a cut top
// showing the growth rings, a patch of moss and a sapling sprouting from the
// side. A glow runs out through the rings from the heart, ring by ring, and
// the sapling's leaves stir. Tap it and leaves pop up off the top and
// flutter down.

const WOODS = {
  oak: { bark: '#6b4a32', barkDark: '#553925', light: '#e0b07a', dark: '#c48e55', leaf: '#5fae4a' },
  birch: { bark: '#e8e2d4', barkDark: '#3a3530', light: '#f3e2bd', dark: '#dcc497', leaf: '#9ccf4f' },
  redwood: { bark: '#7a3624', barkDark: '#5e2618', light: '#df8a5e', dark: '#bb6440', leaf: '#3f8f4a' },
  autumn: { bark: '#5e4636', barkDark: '#47342a', light: '#e6bd84', dark: '#c9965a', leaf: '#e8792e' },
}
const RINGS = 5
const R = 0.52 // stump radius
const H = 0.55 // stump height

export function Stump({ wood = 'oak' }) {
  const W = WOODS[wood] || WOODS.oak
  const { tap, handlers, clock } = useTap(1.2)
  const rings = useRef([])
  const sprout = useRef()

  const geo = useGeo(
    () => ({
      trunk: facet(new THREE.CylinderGeometry(R, R * 1.12, H, 9, 2).translate(0, H / 2, 0), 0.03, 1, [1, 0.4, 1], (x, y) => y > H - 0.001),
      rings: Array.from({ length: RINGS }, (_, i) => new THREE.CylinderGeometry(R * (1 - (i + 0.5) / (RINGS + 0.5)), R * (1 - (i + 0.5) / (RINGS + 0.5)), 0.02, 9, 1)),
      root: cone(0.11, 0.34, 4, 2),
      moss: blob(0.14, 3),
      twig: facet(new THREE.CylinderGeometry(0.015, 0.025, 0.32, 4, 1).translate(0, 0.16, 0), 0.004, 4),
      leaf: facet(new THREE.IcosahedronGeometry(0.1, 0), 0.006, 5).scale(0.55, 0.12, 1).translate(0, 0, 0.08),
    }),
    [],
  )
  // birch bark gets dark flecks
  const flecks = useMemo(() => {
    const r = rng(9)
    return Array.from({ length: 10 }, () => ({ a: r() * TAU, y: 0.08 + r() * (H - 0.16), w: 0.06 + r() * 0.08 }))
  }, [])

  useFrame(() => {
    const t = clock.elapsedTime
    rings.current.forEach((m, i) => {
      if (!m) return
      // a glow that travels outward from the heart, ring by ring
      const ph = (t * 0.5 - (RINGS - 1 - i) * 0.12) % 1
      m.material.emissiveIntensity = Math.exp(-(((ph - 0.5) / 0.08) ** 2)) * 0.55
    })
    sprout.current.rotation.z = 0.5 + Math.sin(t * 1.3) * 0.08 + tap.value(t) * Math.sin(t * 18) * 0.12
  })

  return (
    <group {...handlers}>
      <mesh geometry={geo.trunk}>
        <Flat color={W.bark} />
      </mesh>
      {wood === 'birch' &&
        flecks.map((f, i) => (
          <mesh key={i} position={[Math.cos(f.a) * R * 1.04, f.y, Math.sin(f.a) * R * 1.04]} rotation-y={-f.a + Math.PI / 2}>
            <boxGeometry args={[f.w, 0.025, 0.01]} />
            <Flat color={W.barkDark} />
          </mesh>
        ))}

      {/* the cut top: sapwood disc and rings, alternately light and dark */}
      <mesh position-y={H + 0.005}>
        <cylinderGeometry args={[R * 0.97, R * 0.97, 0.02, 9, 1]} />
        <Flat color={W.light} />
      </mesh>
      {geo.rings.map((g, i) => (
        <mesh key={i} ref={(el) => (rings.current[i] = el)} geometry={g} position-y={H + 0.012 + i * 0.003}>
          <Flat color={i % 2 ? W.light : W.dark} emissive="#ffd28a" emissiveIntensity={0} />
        </mesh>
      ))}

      {/* roots splaying out at the base */}
      {[0, 1, 2, 3, 4].map((i) => {
        const a = (i / 5) * TAU + 0.3
        return (
          <mesh key={i} geometry={geo.root} position={[Math.cos(a) * R * 0.92, 0.0, Math.sin(a) * R * 0.92]} rotation={[Math.sin(a) * 1.05, 0, -Math.cos(a) * 1.05]}>
            <Flat color={W.barkDark} />
          </mesh>
        )
      })}

      {/* moss at the foot */}
      <mesh geometry={geo.moss} position={[0.42, 0.06, 0.38]} scale={[1.4, 0.55, 1.1]}>
        <Flat color="#6c9a3a" />
      </mesh>
      <mesh geometry={geo.moss} position={[0.55, 0.05, 0.12]} scale={[0.9, 0.45, 0.9]}>
        <Flat color="#7fb04a" />
      </mesh>

      {/* a sapling from the side */}
      <group ref={sprout} position={[-R * 0.95, 0.3, 0.1]}>
        <mesh geometry={geo.twig}>
          <Flat color={W.barkDark} />
        </mesh>
        <mesh geometry={geo.leaf} position-y={0.3} rotation={[-0.6, 0.4, 0]}>
          <Flat color={W.leaf} />
        </mesh>
        <mesh geometry={geo.leaf} position-y={0.2} rotation={[-0.5, -2.4, 0]} scale={0.85}>
          <Flat color={W.leaf} />
        </mesh>
      </group>

      <Burst tap={tap} geometry={geo.leaf} count={8} colors={[W.leaf, '#8bc34a', '#f0b23a']} speed={1.6} gravity={1.4} size={1} life={2} origin={[0, H + 0.05, 0]} spread={1.1} up={1.2} />
    </group>
  )
}

export default function StumpScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[3, 2.6, 4]} target={[0, 0.35, 0]} hint="A glow runs out through the rings and the sapling stirs on its own · tap it and leaves pop off the top · Wood swaps oak, birch, redwood and autumn · drag to orbit">
      <Stump {...props} />
    </Stage>
  )
}
