import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Burst, Flat, Stage, TAU, blob, facet, useGeo, useTap } from './kit.jsx'

// A low-poly flower in a clay pot: a faceted stem with two leaves and a head
// of eight petals round a domed centre. The petals slowly open and close, a
// beat apart, and the stem sways. Tap it and the bloom spins and sheds a few
// petals.

const COLORS = {
  pink: { petal: '#f27aa6', tip: '#ffc2d8', heart: '#f6c22e' },
  yellow: { petal: '#f6c22e', tip: '#ffe58a', heart: '#8a4b1f' },
  blue: { petal: '#5b8cf0', tip: '#b8cfff', heart: '#f6e27a' },
  red: { petal: '#e3393f', tip: '#ff8f8f', heart: '#2a1d1a' },
}
const GREEN = '#4fae5a'
const LEAF = '#3d9450'
const POT = '#c9643f'
const PETALS = 8

export function Flower({ color = 'pink' }) {
  const C = COLORS[color] || COLORS.pink
  const { tap, handlers, clock } = useTap(1.4)
  const stem = useRef()
  const head = useRef()
  const petals = useRef([])
  const spin = useRef(0)

  const geo = useGeo(
    () => ({
      stem: facet(new THREE.CylinderGeometry(0.035, 0.05, 0.9, 5, 3).translate(0, 0.45, 0), 0.008, 1),
      leaf: facet(new THREE.IcosahedronGeometry(0.2, 0), 0.01, 2).scale(0.55, 0.12, 1.2).translate(0, 0, 0.2),
      petal: facet(new THREE.IcosahedronGeometry(0.2, 0), 0.012, 3).scale(0.62, 0.16, 1.25).translate(0, 0, 0.27),
      heart: blob(0.13, 4).scale(1, 0.6, 1),
      pot: facet(new THREE.CylinderGeometry(0.3, 0.22, 0.38, 7, 1).translate(0, 0.19, 0), 0.012, 5),
      rim: facet(new THREE.CylinderGeometry(0.34, 0.33, 0.09, 7, 1), 0.008, 6),
      soil: new THREE.CylinderGeometry(0.29, 0.29, 0.02, 7, 1),
    }),
    [],
  )

  useFrame((_, dt) => {
    const t = clock.elapsedTime
    const k = tap.value(t)
    stem.current.rotation.z = Math.sin(t * 1.1) * 0.06
    stem.current.rotation.x = Math.sin(t * 0.8 + 1) * 0.04
    spin.current += Math.min(dt, 0.05) * (0.2 + k * 11)
    head.current.rotation.y = spin.current
    petals.current.forEach((p, i) => {
      if (!p) return
      // open (flat) to cupped, each petal a little behind the last
      const close = 0.25 + 0.5 * (0.5 + 0.5 * Math.sin(t * 0.9 - i * 0.35))
      p.rotation.x = -close + k * 0.3
    })
  })

  return (
    <group {...handlers}>
      {/* pot */}
      <mesh geometry={geo.pot}>
        <Flat color={POT} />
      </mesh>
      <mesh geometry={geo.rim} position-y={0.4}>
        <Flat color="#b5532f" />
      </mesh>
      <mesh geometry={geo.soil} position-y={0.43}>
        <Flat color="#4a2f22" />
      </mesh>

      {/* stem, swaying from the soil */}
      <group ref={stem} position-y={0.43}>
        <mesh geometry={geo.stem}>
          <Flat color={GREEN} />
        </mesh>
        <mesh geometry={geo.leaf} position={[0.02, 0.28, 0]} rotation={[0.5, 0.9, 0]}>
          <Flat color={LEAF} />
        </mesh>
        <mesh geometry={geo.leaf} position={[-0.02, 0.45, 0]} rotation={[0.45, -2.3, 0]} scale={0.85}>
          <Flat color={GREEN} />
        </mesh>

        {/* the head, tipped a little toward the viewer */}
        <group position-y={0.9} rotation-x={0.35}>
          <group ref={head}>
            <mesh geometry={geo.heart} position-y={0.03}>
              <Flat color={C.heart} />
            </mesh>
            {Array.from({ length: PETALS }, (_, i) => (
              <group key={i} rotation-y={(i / PETALS) * TAU}>
                <group ref={(el) => (petals.current[i] = el)} position-z={0.06}>
                  <mesh geometry={geo.petal}>
                    <Flat color={i % 2 ? C.tip : C.petal} />
                  </mesh>
                </group>
              </group>
            ))}
          </group>
        </group>
      </group>

      <Burst tap={tap} geometry={geo.petal} count={7} colors={[C.petal, C.tip]} speed={1.3} gravity={1.2} size={0.7} life={1.8} origin={[0, 1.33, 0.1]} spread={1.3} up={0.6} />
    </group>
  )
}

export default function FlowerScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[3, 2.2, 4]} target={[0, 0.8, 0]} hint="The petals open and close and the stem sways on its own · tap it and the bloom spins and sheds petals · Color swaps pink, yellow, blue and red · drag to orbit">
      <Flower {...props} />
    </Stage>
  )
}
