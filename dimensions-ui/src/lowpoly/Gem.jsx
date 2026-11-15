import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Burst, Flat, Ripple, Spin, Stage, TAU, pulse, useGeo, useTap } from './kit.jsx'

// A low-poly brilliant-cut gem: an eight-sided lathe with a deep pavilion, a
// girdle and a flat table, so every facet catches the light at its own angle.
// It turns slowly above the floor with three small shards in orbit, and its
// inner glow breathes. Tap it and it flashes, whirls and throws sparkles.

const STONES = {
  aqua: { body: '#3fd0d4', deep: '#1d8f9e', glow: '#9ff6ff' },
  ruby: { body: '#e0344f', deep: '#97182f', glow: '#ff9aa8' },
  amethyst: { body: '#9a5ce0', deep: '#5d2c9e', glow: '#e0b8ff' },
  emerald: { body: '#2fbf72', deep: '#16804a', glow: '#a5f5c6' },
}

// radius, height of the cut, bottom to top
const CUT = [
  [0, 0],
  [0.5, 0.56],
  [0.56, 0.64],
  [0.4, 0.86],
  [0, 0.86],
]
const gem = (scale, segs) => new THREE.LatheGeometry(CUT.map(([r, y]) => new THREE.Vector2(r * scale, y * scale)), segs).translate(0, -0.43 * scale, 0)

export function Gem({ stone = 'aqua' }) {
  const S = STONES[stone] || STONES.aqua
  const { tap, handlers, clock } = useTap(2.2)
  const body = useRef()
  const orbit = useRef()
  const geo = useGeo(() => ({ main: gem(1, 8), shard: new THREE.OctahedronGeometry(0.09, 0), spark: new THREE.OctahedronGeometry(1, 0) }), [])

  useFrame(() => {
    const t = clock.elapsedTime
    const k = tap.value(t)
    body.current.material.emissiveIntensity = 0.12 + pulse(t, 0.4) * 0.18 + k * 1.2
    body.current.rotation.z = Math.sin(t * 0.8) * 0.08
    orbit.current.rotation.y = t * 0.9
    orbit.current.children.forEach((c, i) => {
      c.position.y = Math.sin(t * 1.6 + i * 2.1) * 0.12
      c.rotation.set(t * 1.3 + i, t * 0.9, 0)
    })
  })

  return (
    <group {...handlers}>
      <Spin tap={tap} rate={0.45} boost={10} position={[0, 0.95, 0]}>
        <mesh ref={body} geometry={geo.main}>
          <Flat color={S.body} emissive={S.glow} roughness={0.25} metalness={0.15} />
        </mesh>
      </Spin>
      <group ref={orbit} position={[0, 0.95, 0]}>
        {[0, 1, 2].map((i) => (
          <mesh key={i} geometry={geo.shard} position={[Math.cos((i / 3) * TAU) * 0.82, 0, Math.sin((i / 3) * TAU) * 0.82]}>
            <Flat color={i === 1 ? S.deep : S.body} emissive={S.glow} emissiveIntensity={0.2} roughness={0.3} />
          </mesh>
        ))}
      </group>
      <Burst tap={tap} geometry={geo.spark} count={16} colors={[S.glow, '#ffffff', S.body]} speed={2} gravity={1.5} size={0.05} life={1} origin={[0, 0.95, 0]} />
      <Ripple tap={tap} color={S.body} radius={1.6} />
    </group>
  )
}

export default function GemScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} target={[0, 0.85, 0]} hint="The gem turns and its glow breathes on its own · tap it and it flashes, whirls and throws sparkles · Stone swaps aqua, ruby, amethyst and emerald · drag to orbit">
      <Gem {...props} />
    </Stage>
  )
}
