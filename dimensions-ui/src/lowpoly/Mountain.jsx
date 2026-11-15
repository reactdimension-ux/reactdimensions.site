import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Burst, Flat, Particles, Stage, TAU, blob, cone, facet, rng, terrainGeo, useGeo, useTap } from './kit.jsx'

// A low-poly mountain: a rugged faceted peak and a smaller shoulder, banded
// by height from forest to rock to snow, on a round of meadow with a few
// pines. Glints twinkle on the snow cap and two little clouds circle the
// summit. Tap it and an avalanche of snow slides off and a dust cloud rises.

const SEASONS = {
  alpine: { bands: [[0, '#5f9a4a'], [0.28, '#7a8a5e'], [0.42, '#8d867e'], [0.7, '#f4f6fa']], meadow: '#6fb04f', pine: '#3f7f4a', snow: true },
  autumn: { bands: [[0, '#d9822b'], [0.25, '#b9673a'], [0.42, '#8d7e72'], [0.72, '#f4f6fa']], meadow: '#c9a24a', pine: '#5a7a3a', snow: true },
  desert: { bands: [[0, '#e3b26a'], [0.3, '#d08c4f'], [0.55, '#b8643a'], [0.8, '#9a4a2e']], meadow: '#ead39a', pine: '#7a9a4a', snow: false },
  winter: { bands: [[0, '#e9eef5'], [0.35, '#9aa3ae'], [0.5, '#f4f6fa']], meadow: '#eef2f8', pine: '#2f5f42', snow: true },
}

export function Mountain({ season = 'alpine' }) {
  const S = SEASONS[season] || SEASONS.alpine
  const { tap, handlers, clock } = useTap(1)
  const clouds = useRef()
  const geo = useGeo(
    () => ({
      peak: terrainGeo({ radius: 1.05, height: 1.55, seed: 3, rings: 6, segs: 12, rough: 0.2, bands: S.bands }),
      shoulder: terrainGeo({ radius: 0.7, height: 0.85, seed: 8, rings: 4, segs: 10, rough: 0.22, bands: S.bands.map(([h, c]) => [h * 1.4, c]) }),
      meadow: facet(new THREE.CylinderGeometry(1.45, 1.5, 0.06, 14, 1).translate(0, 0.03, 0), 0.03, 1, [1, 0.3, 1]),
      pine: cone(0.1, 0.32, 5, 4),
      trunk: new THREE.CylinderGeometry(0.02, 0.025, 0.08, 4, 1).translate(0, 0.04, 0),
      puff: blob(0.13, 5),
      glint: new THREE.OctahedronGeometry(1, 0),
      chip: new THREE.TetrahedronGeometry(1, 0),
    }),
    [season],
  )
  const pines = useMemo(() => {
    const r = rng(12)
    return Array.from({ length: 9 }, () => {
      const a = r() * TAU
      const d = 1.08 + r() * 0.3
      return [Math.cos(a) * d, Math.sin(a) * d, 0.7 + r() * 0.6]
    })
  }, [])

  useFrame(() => {
    clouds.current.rotation.y = clock.elapsedTime * 0.25
  })

  const dust = () => (tap.since(clock.elapsedTime) < 1.6 ? 1 : 0)

  return (
    <group {...handlers}>
      <mesh geometry={geo.meadow}>
        <Flat color={S.meadow} />
      </mesh>
      <mesh geometry={geo.peak} position-y={0.06}>
        <Flat vertexColors color="#ffffff" />
      </mesh>
      <mesh geometry={geo.shoulder} position={[0.62, 0.05, -0.35]}>
        <Flat vertexColors color="#ffffff" />
      </mesh>
      {pines.map(([x, z, s], i) => (
        <group key={i} position={[x, 0.06, z]} scale={s}>
          <mesh geometry={geo.trunk}>
            <Flat color="#6e4a34" />
          </mesh>
          <mesh geometry={geo.pine} position-y={0.06}>
            <Flat color={S.pine} />
          </mesh>
        </group>
      ))}

      {/* two little clouds circling the summit */}
      <group ref={clouds} position-y={1.25}>
        {[0, Math.PI].map((a, i) => (
          <group key={i} position={[Math.cos(a) * 0.95, i * 0.15, Math.sin(a) * 0.95]}>
            <mesh geometry={geo.puff} scale={[1.4, 0.8, 1]}>
              <Flat color="#ffffff" />
            </mesh>
            <mesh geometry={geo.puff} position={[0.14, -0.02, 0.02]} scale={[0.9, 0.7, 0.8]}>
              <Flat color="#f2f4f8" />
            </mesh>
            <mesh geometry={geo.puff} position={[-0.13, -0.03, -0.02]} scale={[0.8, 0.6, 0.8]}>
              <Flat color="#f2f4f8" />
            </mesh>
          </group>
        ))}
      </group>

      {S.snow && <Particles geometry={geo.glint} count={8} life={1.4} origin={[0, 1.3, 0]} spread={0.22} velocity={[0, 0, 0]} scatter={0} drift={0} size={[0.035, 0]} colors={['#ffffff']} opacity={[1, 0.6]} emissive={1.5} spin={4} />}
      <Burst tap={tap} geometry={geo.chip} count={20} colors={S.snow ? ['#ffffff', '#e6edf6'] : ['#d08c4f', '#b8643a']} speed={1.5} gravity={3.2} size={0.05} life={1.3} origin={[0.1, 1.25, 0.2]} spread={1} up={0.4} />
      <Particles count={10} life={1.4} origin={[0.25, 0.7, 0.45]} spread={0.25} velocity={[0.1, 0.25, 0.2]} scatter={0.2} drift={0.1} size={[0.08, 0.22]} colors={S.snow ? ['#ffffff', '#eef2f8'] : ['#e8c79a']} opacity={[0.8, 0]} active={dust} seed={7} />
    </group>
  )
}

export default function MountainScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[3.6, 2.4, 5]} target={[0, 0.75, 0]} hint="Glints twinkle on the snow and clouds circle the summit on their own · tap it and an avalanche slides off · Season swaps alpine, autumn, desert and winter · drag to orbit">
      <Mountain {...props} />
    </Stage>
  )
}
