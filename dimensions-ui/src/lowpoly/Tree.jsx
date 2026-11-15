import { useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useCursor } from '@react-three/drei'
import * as THREE from 'three'
import { Flat, Stage, facet, useGeo, useKick } from './kit.jsx'

// A low-poly pine: a stubby six-sided trunk under four stacked cones, darker
// at the bottom and lighter towards the tip. The tiers sway in the wind, each
// a beat behind the one below and further at the top; tap it and it shakes.

const PALETTES = {
  summer: { tiers: ['#2e6f37', '#3d8a3b', '#58a33d', '#7cbb44'], trunk: '#5a382a', snow: null },
  autumn: { tiers: ['#9a3b22', '#bd5626', '#d77f2c', '#e8a83a'], trunk: '#4e3226', snow: null },
  winter: { tiers: ['#24574a', '#2c6a55', '#367c5f', '#43906a'], trunk: '#4b3328', snow: '#f3f6fb' },
}

// [radius, height, base height] of each tier, bottom up
const TIERS = [
  [0.95, 0.72, 0.42],
  [0.8, 0.66, 0.82],
  [0.62, 0.62, 1.18],
  [0.44, 0.92, 1.5],
]

export function Tree({ season = 'summer', wind = 0.5 }) {
  const P = PALETTES[season] || PALETTES.summer
  const clock = useThree((s) => s.clock)
  const [hover, setHover] = useState(false)
  useCursor(hover)
  const shake = useKick(2.2)
  const tiers = useRef([])

  const geo = useGeo(
    () => ({
      trunk: facet(new THREE.CylinderGeometry(0.15, 0.2, 0.55, 6, 1), 0.025, 3),
      // each cone sits on its own base (y = 0 at the rim) so it sways from there
      tiers: TIERS.map(([r, h], i) => facet(new THREE.ConeGeometry(r, h, 7, 1).translate(0, h / 2, 0), 0.045, 10 + i)),
      snow: TIERS.map(([r, h], i) => facet(new THREE.ConeGeometry(r * 0.56, h * 0.56, 7, 1).translate(0, h * 0.44 + (h * 0.56) / 2 + 0.01, 0).scale(1.14, 1.03, 1.14), 0.02, 20 + i)),
    }),
    [],
  )

  useFrame(() => {
    const t = clock.elapsedTime
    const s = shake.value(t)
    tiers.current.forEach((g, i) => {
      if (!g) return
      const lag = i * 0.55
      const reach = 1 + i * 0.45
      const sway = wind * 0.05 * reach
      g.rotation.z = Math.sin(t * 1.3 - lag) * sway + Math.sin(t * 15 - lag) * s * 0.09 * reach
      g.rotation.x = Math.sin(t * 0.9 - lag + 1.7) * sway * 0.6 + Math.cos(t * 13 - lag) * s * 0.05 * reach
    })
  })

  return (
    <group
      onClick={(e) => {
        e.stopPropagation()
        shake.kick(clock.elapsedTime)
      }}
      onPointerOver={(e) => (e.stopPropagation(), setHover(true))}
      onPointerOut={() => setHover(false)}
    >
      <mesh geometry={geo.trunk} position-y={0.275}>
        <Flat color={P.trunk} />
      </mesh>
      {/* tiers nest, so each one carries the sway of those below it */}
      <Nest i={0} geo={geo} P={P} refs={tiers} />
    </group>
  )
}

function Nest({ i, geo, P, refs }) {
  if (i >= TIERS.length) return null
  const base = TIERS[i][2] - (i ? TIERS[i - 1][2] : 0)
  return (
    <group ref={(g) => (refs.current[i] = g)} position-y={base}>
      <mesh geometry={geo.tiers[i]}>
        <Flat color={P.tiers[i]} />
      </mesh>
      {P.snow && (
        <mesh geometry={geo.snow[i]}>
          <Flat color={P.snow} />
        </mesh>
      )}
      <Nest i={i + 1} geo={geo} P={P} refs={refs} />
    </group>
  )
}

export default function TreeScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} target={[0, 1.05, 0]} hint="The pine sways in the wind, each tier a beat behind the one below · tap it to give it a shake · Season changes its colours (winter adds snow) · drag to orbit">
      <Tree {...props} />
    </Stage>
  )
}
