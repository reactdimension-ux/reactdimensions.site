import { useMemo } from 'react'
import * as THREE from 'three'
import { Burst, Flat, Flow, Particles, Ripple, Stage, TAU, Water, blob, cone, facet, ribbonGeo, rng, terrainGeo, terrainShape, useGeo, useTap } from './kit.jsx'

// A low-poly waterfall: a flat-topped faceted cliff with pines, a stream
// running across the top to the lip and pouring down the face into a pool of
// rolling water ringed by boulders. The falling sheet is threaded with
// streaks that flow on a loop, mist rises where it lands and rings spread
// over the pool. Tap it for a big splash.

const LOOKS = {
  forest: { bands: [[0, '#7d7a76'], [0.55, '#8d8a85'], [0.97, '#5f9a4a']], water: '#4aa8e0', edge: '#2f7fb0', tree: '#3f7f4a', ground: '#6fb04f' },
  tropical: { bands: [[0, '#8a7a62'], [0.55, '#9a8a70'], [0.97, '#3faa4a']], water: '#3fc8d8', edge: '#2a96a8', tree: '#2f9a3f', ground: '#5fbf4a' },
  canyon: { bands: [[0, '#b8643a'], [0.4, '#c97a4a'], [0.7, '#d9905a'], [0.97, '#e3b26a']], water: '#3fa0c8', edge: '#2a7898', tree: '#7a9a4a', ground: '#e3b26a' },
  glacier: { bands: [[0, '#9aa3ae'], [0.55, '#b8c2cc'], [0.97, '#f4f6fa']], water: '#7fc8f0', edge: '#4a98c8', tree: '#2f5f42', ground: '#eef2f8' },
}
const CLIFF = [-0.15, 0, -0.55] // cliff centre
const RAD = 1.0
const HGT = 1.25
const shape = terrainShape('mesa')
const POOL = [CLIFF[0], 0, CLIFF[2] + RAD + 0.35]

// the stream's path: across the top, over the lip, down the face, into the pool
const path = (u) => {
  const z = -0.35 + u * (RAD + 0.55)
  const r = Math.max(0, z)
  const y = r >= RAD ? 0.1 : HGT * shape(r / RAD) + 0.065
  return new THREE.Vector3(CLIFF[0] + Math.sin(u * 5) * 0.03, Math.max(0.1, y), CLIFF[2] + z)
}

export function Waterfall({ look = 'forest', flow = 0.6 }) {
  const L = LOOKS[look] || LOOKS.forest
  const { tap, handlers } = useTap(1)
  const geo = useGeo(
    () => ({
      cliff: terrainGeo({ radius: RAD, height: HGT, seed: 4, rings: 6, segs: 14, rough: 0.04, profile: 'mesa', bands: L.bands }),
      ground: facet(new THREE.CylinderGeometry(1.75, 1.8, 0.05, 16, 1).translate(0, 0.025, 0), 0.02, 1, [1, 0.3, 1]),
      sheet: ribbonGeo(path, 0.22, 40),
      rock: blob(0.13, 2),
      tree: cone(0.1, 0.32, 5, 3),
      trunk: new THREE.CylinderGeometry(0.02, 0.025, 0.08, 4, 1).translate(0, 0.04, 0),
      drop: new THREE.OctahedronGeometry(1, 0),
    }),
    [look],
  )
  const trees = useMemo(() => {
    const r = rng(8)
    const top = Array.from({ length: 5 }, () => {
      const a = r() * TAU
      const d = 0.15 + r() * 0.35
      return [CLIFF[0] + Math.cos(a) * d + (Math.cos(a) > 0 ? 0.12 : -0.12), CLIFF[1] + HGT, CLIFF[2] + Math.sin(a) * d * 0.7 - 0.1, 0.8 + r() * 0.4]
    })
    const low = Array.from({ length: 5 }, () => {
      const a = r() * TAU
      return [Math.cos(a) * 1.45, 0.05, Math.sin(a) * 1.45, 0.8 + r() * 0.5]
    })
    return [...top, ...low]
  }, [])
  const rocks = useMemo(() => {
    const r = rng(5)
    return Array.from({ length: 8 }, (_, i) => {
      const a = (i / 8) * TAU + r() * 0.4
      return [POOL[0] + Math.cos(a) * 0.6, 0.08, POOL[2] + Math.sin(a) * 0.48, 0.6 + r() * 0.6]
    })
  }, [])

  return (
    <group {...handlers}>
      <mesh geometry={geo.ground}>
        <Flat color={L.ground} />
      </mesh>
      <mesh geometry={geo.cliff} position={[CLIFF[0], 0.05, CLIFF[2]]}>
        <Flat vertexColors color="#ffffff" />
      </mesh>
      {trees.map(([x, y, z, s], i) => (
        <group key={i} position={[x, y, z]} scale={s}>
          <mesh geometry={geo.trunk}>
            <Flat color="#5c3c2a" />
          </mesh>
          <mesh geometry={geo.tree} position-y={0.05}>
            <Flat color={L.tree} />
          </mesh>
        </group>
      ))}

      {/* the sheet of water and the streaks flowing down it */}
      <mesh geometry={geo.sheet} position-y={0.05}>
        <meshStandardMaterial color={L.water} flatShading roughness={0.25} transparent opacity={0.78} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <group position-y={0.06}>
        <Flow path={path} count={44} speed={0.25 + flow * 0.4} width={0.18} size={0.016} stretch={3} colors={['#ffffff', '#d8f0ff']} opacity={0.95} />
      </group>

      {/* the pool */}
      <group position={POOL}>
        <Water radius={0.55} rings={4} segs={14} color={L.water} edge={L.edge} amp={0.012} y={0.08} />
        <Ripple loop period={1.4} count={3} color="#ffffff" radius={0.5} opacity={0.45} y={0.1} />
        <Ripple tap={tap} count={3} color="#ffffff" radius={0.75} y={0.1} />
        <Particles count={14} life={1.8} origin={[0, 0.1, -0.35]} spread={0.1} velocity={[0, 0.3, 0.12]} scatter={0.2} drift={0.12} size={[0.04, 0.12]} colors={['#ffffff', '#e8f6ff']} opacity={[0.6, 0]} seed={4} />
        <Burst tap={tap} geometry={geo.drop} count={18} colors={['#ffffff', '#cfeaff']} speed={1.6} gravity={4} size={0.025} life={0.9} origin={[0, 0.12, -0.3]} spread={1} up={1.2} />
      </group>
      {rocks.map(([x, y, z, s], i) => (
        <mesh key={i} geometry={geo.rock} position={[x, y, z]} scale={[s, s * 0.7, s]}>
          <Flat color={i % 2 ? '#8d8a85' : '#a6a29b'} />
        </mesh>
      ))}
    </group>
  )
}

export default function WaterfallScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[3.6, 2.4, 4.6]} target={[0, 0.6, 0]} hint="The stream pours over the lip on a loop, mist rises and rings spread over the pool on their own · tap it for a big splash · Flow sets how fast it runs · Look swaps forest, tropical, canyon and glacier · drag to orbit">
      <Waterfall {...props} />
    </Stage>
  )
}
