import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Face, Flat, Stage, TAU, blob, cone, facet, rng, squash, useGeo, useTap, wobble } from './kit.jsx'

// A low-poly saguaro in a terracotta pot: a ribbed eight-sided column with a
// domed top, two elbowed arms, white spines and a flower on top that slowly
// blooms and closes. It has a sleepy face that blinks. Tap it and it
// wobbles like jelly on its base.

const FLOWERS = {
  pink: { petal: '#f27aa6', heart: '#f6d24a' },
  yellow: { petal: '#f6c93a', heart: '#e0702a' },
  red: { petal: '#e3393f', heart: '#f6d24a' },
  white: { petal: '#f7f3ea', heart: '#f2b632' },
}
const GREEN = '#4f9a4f'
const GREEN2 = '#5fb05a'
const POT = '#c9643f'

function arm(geo, side, y, out, up) {
  return (
    <group position={[side * 0.17, y, 0]}>
      <mesh geometry={geo.limb} rotation-z={-side * Math.PI / 2} scale={[0.5, out, 0.5]}>
        <Flat color={GREEN} />
      </mesh>
      <group position={[side * out, 0, 0]}>
        <mesh geometry={geo.limb} scale={[0.5, up, 0.5]} position-y={-0.04}>
          <Flat color={GREEN2} />
        </mesh>
        <mesh geometry={geo.dome} position-y={up - 0.04} scale={0.5}>
          <Flat color={GREEN2} />
        </mesh>
        <mesh geometry={geo.dome} scale={[0.5, 0.5, 0.5]} rotation-z={Math.PI} position-y={-0.04}>
          <Flat color={GREEN} />
        </mesh>
      </group>
    </group>
  )
}

export function Cactus({ flower = 'pink', face = true }) {
  const F = FLOWERS[flower] || FLOWERS.pink
  const { tap, handlers, clock } = useTap(2)
  const body = useRef()
  const petals = useRef([])

  const geo = useGeo(
    () => ({
      column: facet(new THREE.CylinderGeometry(0.2, 0.22, 0.95, 8, 3).translate(0, 0.475, 0), 0.008, 1),
      dome: facet(new THREE.SphereGeometry(0.2, 8, 3, 0, TAU, 0, Math.PI / 2), 0.006, 2),
      limb: facet(new THREE.CylinderGeometry(0.2, 0.2, 1, 8, 1).translate(0, 0.5, 0), 0.006, 3),
      spine: cone(0.012, 0.06, 3, 4),
      petal: facet(new THREE.IcosahedronGeometry(0.09, 0), 0.005, 5).scale(0.7, 0.25, 1.5).translate(0, 0, 0.1),
      heart: blob(0.06, 6, 0),
      pot: facet(new THREE.CylinderGeometry(0.34, 0.26, 0.4, 8, 1).translate(0, 0.2, 0), 0.01, 7),
      rim: facet(new THREE.CylinderGeometry(0.38, 0.37, 0.09, 8, 1), 0.006, 8),
      soil: new THREE.CylinderGeometry(0.33, 0.33, 0.02, 8, 1),
      pebble: blob(0.035, 9, 0),
    }),
    [],
  )
  // spines dotted over the column: angle, height
  const spines = useMemo(() => {
    const r = rng(4)
    return Array.from({ length: 22 }, (_, i) => [((i % 8) / 8) * TAU + (r() - 0.5) * 0.2, 0.1 + r() * 0.8])
  }, [])

  useFrame(() => {
    const t = clock.elapsedTime
    const w = wobble(tap.since(t), 16, 3.2)
    body.current.rotation.z = w * 0.14
    body.current.rotation.x = wobble(tap.since(t) - 0.05, 13, 3.2) * 0.08
    squash(body.current, w * 0.09)
    // the flower blooms over a few seconds and closes again
    const open = 0.5 - 0.5 * Math.cos(t * 0.5)
    petals.current.forEach((p) => p && (p.rotation.x = -1.2 + open * 1.0))
  })

  return (
    <group {...handlers}>
      <mesh geometry={geo.pot}>
        <Flat color={POT} />
      </mesh>
      <mesh geometry={geo.rim} position-y={0.42}>
        <Flat color="#b5532f" />
      </mesh>
      <mesh geometry={geo.soil} position-y={0.45}>
        <Flat color="#d8b98a" />
      </mesh>
      {[
        [0.2, 0.12],
        [-0.22, 0.05],
        [0.05, -0.24],
        [-0.12, 0.22],
      ].map(([x, z], i) => (
        <mesh key={i} geometry={geo.pebble} position={[x, 0.47, z]} scale={[1.2, 0.7, 1]}>
          <Flat color={i % 2 ? '#8f8a83' : '#b5aea4'} />
        </mesh>
      ))}

      {/* everything above the soil wobbles from its base */}
      <group ref={body} position-y={0.45}>
        <mesh geometry={geo.column}>
          <Flat color={GREEN} />
        </mesh>
        <mesh geometry={geo.dome} position-y={0.95}>
          <Flat color={GREEN} />
        </mesh>
        {arm(geo, 1, 0.38, 0.16, 0.36)}
        {arm(geo, -1, 0.55, 0.12, 0.24)}
        {spines.map(([a, y], i) => (
          <mesh key={i} geometry={geo.spine} position={[Math.cos(a) * 0.205, y, Math.sin(a) * 0.205]} rotation={[0, -a, -Math.PI / 2]}>
            <Flat color="#f4f1e6" />
          </mesh>
        ))}
        {face && <Face position={[0, 0.62, 0.215]} spacing={0.12} size={0.022} mouth="smile" mouthWidth={0.06} mouthY={-0.06} />}

        {/* the flower on the crown */}
        <group position-y={1.13}>
          <mesh geometry={geo.heart}>
            <Flat color={F.heart} />
          </mesh>
          {Array.from({ length: 6 }, (_, i) => (
            <group key={i} rotation-y={(i / 6) * TAU}>
              <group ref={(el) => (petals.current[i] = el)}>
                <mesh geometry={geo.petal}>
                  <Flat color={F.petal} />
                </mesh>
              </group>
            </group>
          ))}
        </group>
      </group>
    </group>
  )
}

export default function CactusScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[3, 2.2, 4]} target={[0, 0.8, 0]} hint="The flower blooms and closes and the cactus blinks on its own · tap it and it wobbles like jelly · Flower swaps pink, yellow, red and white · Face turns its face on and off · drag to orbit">
      <Cactus {...props} />
    </Stage>
  )
}
