import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Burst, Flat, Ripple, Stage, Water, blob, cone, facet, squash, useGeo, useTap, waveAt, wobble } from './kit.jsx'

// A low-poly rubber duck afloat on a little round pond. It rides the
// ripples: it rises and falls with the water under it, and pitches and
// rolls with the slope, while it slowly turns about. Tap it and it gets
// squeezed: it squashes flat and springs back (that's the squeak), rings
// spread across the water and a few drops fly.

const LOOKS = {
  yellow: { body: '#ffd23a', beak: '#ff8a1f', eye: '#1b1a22', water: '#59b7e6', edge: '#3a8fc2' },
  pink: { body: '#ff9cc2', beak: '#ff6a4a', eye: '#1b1a22', water: '#7cc6e8', edge: '#4f9dc4' },
  blue: { body: '#6cb8ff', beak: '#ffb03a', eye: '#1b1a22', water: '#69c9c0', edge: '#3f9c94' },
  black: { body: '#2a2a33', beak: '#ff8a1f', eye: '#f4f2ee', water: '#59b7e6', edge: '#3a8fc2' },
}

const FLOAT_Y = 0.13 // the waterline, at the duck's belly

export function Duck({ look = 'yellow' }) {
  const L = LOOKS[look] || LOOKS.yellow
  const { tap, handlers, clock } = useTap(2)
  const duck = useRef()
  const squeeze = useRef()
  const geo = useGeo(
    () => ({
      body: facet(new THREE.IcosahedronGeometry(0.5, 1).scale(1.25, 0.78, 1), 0.03, 3),
      head: blob(0.3, 5),
      // the beak: a flattened cone pointing forward (+x)
      beak: facet(new THREE.ConeGeometry(0.13, 0.26, 6, 1).rotateZ(-Math.PI / 2).scale(1, 0.55, 1), 0.012, 6),
      tail: cone(0.16, 0.28, 5, 7),
      wing: facet(new THREE.IcosahedronGeometry(0.22, 0).scale(1.4, 0.7, 0.45), 0.02, 8),
      eye: new THREE.IcosahedronGeometry(0.042, 0),
      drop: new THREE.IcosahedronGeometry(1, 0),
    }),
    [],
  )

  useFrame(() => {
    const t = clock.elapsedTime
    // ride the water: height from the wave under the duck, tilt from its slope
    const x = Math.sin(t * 0.25) * 0.18
    const z = Math.cos(t * 0.2) * 0.14
    const h = waveAt(x, z, t, 0.03)
    const e = 0.08
    const sx = (waveAt(x + e, z, t, 0.03) - waveAt(x - e, z, t, 0.03)) / (2 * e)
    const sz = (waveAt(x, z + e, t, 0.03) - waveAt(x, z - e, t, 0.03)) / (2 * e)
    duck.current.position.set(x, FLOAT_Y + h, z)
    duck.current.rotation.set(sz * 0.9, t * 0.18, -sx * 0.9)
    // the squeeze: flatten hard, spring back with a wobble
    const s = tap.since(t)
    const k = s >= 0 && s < 0.12 ? (s / 0.12) * 0.35 : 0.35 * wobble(s - 0.12, 18, 5) * (s >= 0.12 ? 1 : 0)
    squash(squeeze.current, Math.max(-0.2, k))
  })

  return (
    <group {...handlers}>
      <Water radius={1.35} color={L.water} edge={L.edge} amp={0.03} />
      <Ripple tap={tap} color="#ffffff" radius={1.3} count={3} y={0.07} />
      <group ref={duck}>
        <group ref={squeeze}>
          {/* body, sitting low in the water */}
          <mesh geometry={geo.body} position-y={0.12}>
            <Flat color={L.body} roughness={0.45} />
          </mesh>
          {/* tail, flicked up at the back */}
          <mesh geometry={geo.tail} position={[-0.55, 0.2, 0]} rotation-z={0.95}>
            <Flat color={L.body} roughness={0.45} />
          </mesh>
          {/* wings on each side */}
          {[-1, 1].map((s) => (
            <mesh key={s} geometry={geo.wing} position={[-0.08, 0.2, s * 0.44]} rotation={[0, s * 0.15, 0.25]}>
              <Flat color={L.body} roughness={0.45} />
            </mesh>
          ))}
          {/* head, beak and eyes */}
          <group position={[0.32, 0.56, 0]}>
            <mesh geometry={geo.head}>
              <Flat color={L.body} roughness={0.45} />
            </mesh>
            <mesh geometry={geo.beak} position={[0.33, -0.05, 0]}>
              <Flat color={L.beak} roughness={0.5} />
            </mesh>
            {[-1, 1].map((s) => (
              <mesh key={s} geometry={geo.eye} position={[0.21, 0.08, s * 0.17]}>
                <Flat color={L.eye} roughness={0.3} />
              </mesh>
            ))}
          </group>
        </group>
      </group>
      <Burst tap={tap} geometry={geo.drop} count={10} colors={['#ffffff', L.water, '#bfe6ff']} speed={1.6} gravity={4.5} size={0.045} life={0.8} origin={[0, 0.12, 0]} spread={1.2} />
    </group>
  )
}

export default function DuckScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[3, 2.1, 4]} target={[0, 0.45, 0]} hint="The duck bobs and turns on the ripples by itself · tap it to give it a squeeze: it squashes, springs back and sends rings across the pond · Look swaps yellow, pink, blue and black · drag to orbit">
      <Duck {...props} />
    </Stage>
  )
}
