import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Burst, Face, Flat, Ripple, Stage, Water, blob, cone, terrainGeo, useGeo, useTap, wobble } from './kit.jsx'

// A low-poly iceberg in a pool of clear sea: a jagged faceted peak above
// the water and a bigger mass below it, seen through the surface. A small
// penguin stands on a ledge. The berg floats and tilts on the swell. Tap it
// and it rocks hard, the penguin hops, and the sea splashes and rings.

const LOOKS = {
  arctic: { ice: [[0, '#cfe8f7'], [0.35, '#e8f4fb'], [0.7, '#ffffff']], deep: '#8ccbec', sea: '#3f8fd0', edge: '#2a6aa8' },
  glacier: { ice: [[0, '#8fcbe8'], [0.4, '#bfe3f4'], [0.75, '#eef8fd']], deep: '#4fa8d8', sea: '#2a6fb0', edge: '#1f5088' },
  mint: { ice: [[0, '#bfeee0'], [0.4, '#dcf7ee'], [0.75, '#ffffff']], deep: '#7fd8c0', sea: '#3fb0b0', edge: '#2a8a8a' },
  dusk: { ice: [[0, '#d8c8f0'], [0.4, '#f0e2f7'], [0.75, '#fff4fa']], deep: '#b49ae0', sea: '#5a5ab0', edge: '#3f3f88' },
}

const SEA = 0.82 // height of the sea surface; the pool reaches down to the floor

export function Iceberg({ look = 'arctic' }) {
  const L = LOOKS[look] || LOOKS.arctic
  const { tap, handlers, clock } = useTap(1)
  const berg = useRef()
  const peng = useRef()
  const geo = useGeo(
    () => ({
      top: terrainGeo({ radius: 0.62, height: 0.95, seed: 11, rings: 5, segs: 9, rough: 0.35, bands: L.ice }),
      under: terrainGeo({ radius: 0.82, height: 0.75, seed: 4, rings: 4, segs: 9, rough: 0.3, bands: [[0, L.deep]] }),
      body: blob(0.07, 1),
      belly: blob(0.055, 2),
      beak: cone(0.018, 0.05, 4, 3).rotateX(Math.PI / 2),
      foot: new THREE.BoxGeometry(0.03, 0.01, 0.04),
      drop: new THREE.OctahedronGeometry(1, 0),
    }),
    [look],
  )

  useFrame(() => {
    const t = clock.elapsedTime
    const s = tap.since(t)
    const w = wobble(s, 6, 1.6)
    berg.current.position.y = SEA - 0.05 + Math.sin(t * 0.9) * 0.025 - Math.abs(w) * 0.05
    berg.current.rotation.z = Math.sin(t * 0.6) * 0.04 + w * 0.32
    berg.current.rotation.x = Math.sin(t * 0.7 + 1) * 0.03 + wobble(s - 0.1, 6, 1.6) * 0.12
    // the penguin hops when the berg lurches, and waddles otherwise
    const hop = s >= 0.05 && s < 0.5 ? Math.sin(((s - 0.05) / 0.45) * Math.PI) * 0.12 : 0
    peng.current.position.y = 0.62 + hop
    peng.current.rotation.z = Math.sin(t * 5) * 0.08
  })

  return (
    <group {...handlers}>
      <group ref={berg} position-y={SEA - 0.05}>
        <mesh geometry={geo.top}>
          <Flat vertexColors color="#ffffff" roughness={0.45} />
        </mesh>
        <mesh geometry={geo.under} rotation-x={Math.PI}>
          <Flat vertexColors color="#ffffff" roughness={0.5} />
        </mesh>
        {/* a little penguin on a ledge */}
        <group ref={peng} position={[0.2, 0.62, 0.12]} rotation-y={0.6}>
          <mesh geometry={geo.body} position-y={0.07} scale={[1, 1.4, 0.9]}>
            <Flat color="#1f2230" />
          </mesh>
          <mesh geometry={geo.belly} position={[0, 0.06, 0.03]} scale={[0.9, 1.3, 0.7]}>
            <Flat color="#ffffff" />
          </mesh>
          <mesh geometry={geo.body} position-y={0.17} scale={0.7}>
            <Flat color="#1f2230" />
          </mesh>
          <Face position={[0, 0.185, 0.045]} spacing={0.04} size={0.008} color="#ffffff" mouth="none" />
          <mesh geometry={geo.beak} position={[0, 0.165, 0.06]}>
            <Flat color="#f2a33a" />
          </mesh>
          {[-1, 1].map((x) => (
            <mesh key={x} geometry={geo.foot} position={[x * 0.03, 0.005, 0.02]}>
              <Flat color="#f2a33a" />
            </mesh>
          ))}
        </group>
      </group>
      <Water radius={1.45} color={L.sea} edge={L.edge} opacity={0.6} amp={0.03} y={SEA} />
      <Ripple loop period={3} count={2} color="#ffffff" radius={1.2} opacity={0.35} y={SEA + 0.04} />
      <Ripple tap={tap} color="#ffffff" count={3} radius={1.5} y={SEA + 0.04} />
      <Burst tap={tap} geometry={geo.drop} count={18} colors={['#ffffff', '#cfeaff']} speed={1.7} gravity={4} size={0.03} life={0.9} origin={[0, SEA + 0.05, 0]} spread={1.3} up={1} />
    </group>
  )
}

export default function IcebergScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[3.4, 2, 4.6]} target={[0, 0.95, 0]} hint="The berg floats and tilts and the penguin waddles on its own · tap it and it rocks, the penguin hops and the sea splashes · Look swaps arctic, glacier, mint and dusk · drag to orbit">
      <Iceberg {...props} />
    </Stage>
  )
}
