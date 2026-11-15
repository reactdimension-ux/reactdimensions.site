import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Burst, Flat, Ripple, Stage, Sway, TAU, Water, blob, facet, terrainGeo, useGeo, useTap, wobble } from './kit.jsx'

// A low-poly desert island afloat on a round of rolling sea: a faceted
// mound banded from sand to grass, a leaning palm whose fronds sway, two
// rocks and a little sailboat bobbing at anchor. The island bobs and tilts
// on the swell. Tap it and it dips, splashes and sends rings across the sea.

const LOOKS = {
  tropical: { bands: [[0, '#f0d9a0'], [0.4, '#6fb04f']], sea: '#3fb0d8', edge: '#2a87b0', frond: ['#3fae4f', '#2f8f42'], rock: '#8d8a85' },
  temperate: { bands: [[0, '#d8c79a'], [0.35, '#4f8a42']], sea: '#3f8fc0', edge: '#2a6a96', frond: ['#4f8a42', '#3f7a36'], rock: '#7d7a76' },
  snowy: { bands: [[0, '#9aa3ae'], [0.35, '#f4f6fa']], sea: '#2f6f9a', edge: '#1f4f72', frond: ['#2f5f42', '#3f7a4a'], rock: '#6e6b68' },
  volcanic: { bands: [[0, '#3a3634'], [0.4, '#5f9a4a']], sea: '#2f9fb8', edge: '#1f7590', frond: ['#5fae4a', '#4f9a3f'], rock: '#3a3634' },
}

export function Island({ look = 'tropical' }) {
  const L = LOOKS[look] || LOOKS.tropical
  const { tap, handlers, clock } = useTap(1.2)
  const isle = useRef()
  const boat = useRef()
  const geo = useGeo(
    () => ({
      land: terrainGeo({ radius: 0.78, height: 0.42, seed: 5, rings: 4, segs: 12, rough: 0.2, profile: 'dome', bands: L.bands }),
      seg: facet(new THREE.CylinderGeometry(0.045, 0.06, 0.22, 5, 1).translate(0, 0.11, 0), 0.006, 2),
      frond: facet(new THREE.ConeGeometry(0.08, 0.42, 4, 1).rotateX(Math.PI / 2).translate(0, 0, 0.21), 0.008, 3).scale(1.6, 0.22, 1),
      rock: blob(0.12, 4),
      hull: facet(new THREE.CylinderGeometry(0.12, 0.07, 0.08, 6, 1).scale(1, 1, 2.4), 0.004, 5),
      mast: new THREE.CylinderGeometry(0.008, 0.008, 0.36, 4, 1).translate(0, 0.18, 0),
      sail: (() => {
        const s = new THREE.Shape()
        s.moveTo(0, 0)
        s.lineTo(0, 0.3)
        s.lineTo(0.18, 0.02)
        return new THREE.ShapeGeometry(s).rotateY(Math.PI / 2)
      })(),
      drop: new THREE.OctahedronGeometry(1, 0),
    }),
    [look],
  )

  useFrame(() => {
    const t = clock.elapsedTime
    const w = wobble(tap.since(t), 9, 2.5)
    isle.current.position.y = Math.sin(t * 1.1) * 0.02 - Math.abs(w) * 0.06
    isle.current.rotation.z = Math.sin(t * 0.8) * 0.03 + w * 0.08
    isle.current.rotation.x = Math.sin(t * 0.9 + 1) * 0.025
    boat.current.position.y = 0.1 + Math.sin(t * 1.6 + 1) * 0.025
    boat.current.rotation.z = Math.sin(t * 1.3) * 0.12
    boat.current.rotation.x = Math.sin(t * 1.1 + 2) * 0.06
  })

  // a short palm: three trunk links swaying as a chain, then six fronds
  const palm = (i) =>
    i === 3 ? (
      <group position-y={0.22}>
        {Array.from({ length: 6 }, (_, k) => (
          <group key={k} rotation-y={(k / 6) * TAU}>
            <Sway axis="x" i={k} rate={0.6} amp={0.1} lag={1.2} kick={tap} kickAmp={0.25}>
              <mesh geometry={geo.frond} rotation-x={0.25}>
                <Flat color={L.frond[k % 2]} emissive={L.frond[k % 2]} emissiveIntensity={0.25} />
              </mesh>
            </Sway>
          </group>
        ))}
      </group>
    ) : (
      <group position-y={i === 0 ? 0 : 0.22} rotation-z={i === 0 ? 0.1 : 0.14}>
        <Sway i={i} rate={0.4} amp={0.025} lag={0.4}>
          <mesh geometry={geo.seg}>
            <Flat color={i % 2 ? '#9a6b45' : '#84593a'} />
          </mesh>
          {palm(i + 1)}
        </Sway>
      </group>
    )

  return (
    <group {...handlers}>
      <Water radius={1.4} color={L.sea} edge={L.edge} />
      <group ref={isle} position-y={0.02}>
        <mesh geometry={geo.land}>
          <Flat vertexColors color="#ffffff" />
        </mesh>
        <group position={[0.12, 0.32, 0.05]}>{palm(0)}</group>
        <mesh geometry={geo.rock} position={[-0.42, 0.1, 0.3]} scale={[1.2, 0.8, 1]}>
          <Flat color={L.rock} />
        </mesh>
        <mesh geometry={geo.rock} position={[-0.3, 0.08, 0.45]} scale={0.6}>
          <Flat color={L.rock} />
        </mesh>
      </group>

      <group ref={boat} position={[0.95, 0.1, 0.55]} rotation-y={0.6}>
        <mesh geometry={geo.hull}>
          <Flat color="#c8423a" />
        </mesh>
        <mesh geometry={geo.mast} position-y={0.03}>
          <Flat color="#5c3c2a" />
        </mesh>
        <mesh geometry={geo.sail} position={[0, 0.07, 0]}>
          <Flat color="#f7f4ec" side={THREE.DoubleSide} />
        </mesh>
      </group>

      <Ripple loop period={3.5} count={2} color="#ffffff" radius={1.2} opacity={0.3} y={0.1} />
      <Ripple tap={tap} color="#ffffff" count={3} radius={1.5} y={0.1} />
      <Burst tap={tap} geometry={geo.drop} count={16} colors={['#ffffff', '#bfe6ff']} speed={1.6} gravity={4} size={0.03} life={0.9} origin={[0, 0.12, 0]} spread={1.3} up={1} />
    </group>
  )
}

export default function IslandScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[3.4, 2.4, 4.6]} target={[0, 0.35, 0]} hint="The island bobs on the swell, the palm sways and the boat rocks on its own · tap it and it dips and splashes · Look swaps tropical, temperate, snowy and volcanic · drag to orbit">
      <Island {...props} />
    </Stage>
  )
}
