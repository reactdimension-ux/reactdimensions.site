import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Flat, Ripple, Stage, blob, facet, useGeo, useTap } from './kit.jsx'

// A low-poly rainbow: six faceted half-torus bands, each standing on a puffy
// cloud at either end. A ripple runs across the bands, outer to inner, so
// the arc seems to breathe. Tap it and the bands flare one after another.

const PALETTES = {
  classic: ['#e8434b', '#f28c38', '#f6c93a', '#5cc25e', '#3d8de0', '#7a55c8'],
  pastel: ['#f5a3a8', '#f8c79a', '#f9e49c', '#b2e3a6', '#a7c8f2', '#c6b2ec'],
  sunset: ['#7a2a6e', '#b8346a', '#e3525c', '#f2814a', '#f6b44a', '#f9de7a'],
  neon: ['#ff3d7f', '#ff9f1c', '#e8f527', '#2bf59c', '#2bc8ff', '#a64bff'],
}
const R0 = 0.98 // outer band radius
const STEP = 0.11
const TUBE = 0.058

export function Rainbow({ palette = 'classic' }) {
  const P = PALETTES[palette] || PALETTES.classic
  const { tap, handlers, clock } = useTap(1.4)
  const bands = useRef([])

  const geo = useGeo(
    () => ({
      bands: P.map((_, i) => facet(new THREE.TorusGeometry(R0 - i * STEP, TUBE, 4, 14, Math.PI), 0.006, 10 + i)),
      puff: [blob(0.22, 1), blob(0.17, 2), blob(0.15, 3)],
    }),
    [P.length],
  )

  useFrame(() => {
    const t = clock.elapsedTime
    bands.current.forEach((b, i) => {
      if (!b) return
      const w = Math.sin(t * 2.2 - i * 0.65)
      // each band flares a beat after the one outside it
      const k = tap.value(t - i * 0.07)
      b.position.z = w * 0.035
      b.scale.set(1 + k * 0.08, 1 + k * 0.08, 1 + w * 0.12 + k * 1.3)
      b.material.emissiveIntensity = 0.04 + k * 0.6
    })
  })

  const cloud = (x) => (
    <group key={x} position={[x, 0.3, 0]}>
      <mesh geometry={geo.puff[0]} scale={[1.3, 0.85, 1]}>
        <Flat color="#ffffff" />
      </mesh>
      <mesh geometry={geo.puff[1]} position={[-0.22, -0.05, 0.05]} scale={[1.2, 0.8, 1]}>
        <Flat color="#f3f4fa" />
      </mesh>
      <mesh geometry={geo.puff[2]} position={[0.22, -0.06, -0.03]} scale={[1.2, 0.8, 1]}>
        <Flat color="#f3f4fa" />
      </mesh>
      <mesh geometry={geo.puff[2]} position={[0.02, 0.1, 0.12]} scale={0.8}>
        <Flat color="#ffffff" />
      </mesh>
    </group>
  )

  return (
    <group {...handlers}>
      <group position-y={0.34}>
        {P.map((c, i) => (
          <mesh key={i} ref={(el) => (bands.current[i] = el)} geometry={geo.bands[i]}>
            <Flat color={c} emissive={c} />
          </mesh>
        ))}
      </group>
      {cloud(-(R0 - STEP * 2.5))}
      {cloud(R0 - STEP * 2.5)}
      <Ripple tap={tap} color={P[2]} count={3} radius={2} />
    </group>
  )
}

export default function RainbowScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[1.6, 1.8, 5]} target={[0, 0.75, 0]} hint="A ripple runs across the bands on its own · tap it and the bands flare one after another · Palette swaps classic, pastel, sunset and neon · drag to orbit">
      <Rainbow {...props} />
    </Stage>
  )
}
