import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Burst, Flat, Ripple, Stage, blob, facet, useGeo, useTap } from './kit.jsx'

// A low-poly map pin: a faceted ball with a hole through its face on a cone
// that tapers to a point. It bounces on the spot, squashing as it lands and
// stretching as it leaves, and rings spread across the floor from where it
// points. Tap it and it leaps high, spins once and lands with a splash of
// rings and chips.

const COLORS = {
  red: { body: '#e8434b', dark: '#b52b33' },
  blue: { body: '#3d7fe0', dark: '#2a5bb0' },
  green: { body: '#3fbf6a', dark: '#2b8f4c' },
  purple: { body: '#8d55d8', dark: '#6436a8' },
}
const PERIOD = 0.9 // seconds per bounce
const JUMP = 1.2 // seconds for the big leap

export function MapPin({ color = 'red' }) {
  const C = COLORS[color] || COLORS.red
  const { tap, handlers, clock } = useTap(1.2)
  const pin = useRef()
  const geo = useGeo(
    () => ({
      head: blob(0.34, 1),
      point: facet(new THREE.ConeGeometry(0.27, 0.62, 8, 1).rotateX(Math.PI).translate(0, 0.31, 0), 0.012, 2),
      hole: blob(0.13, 3),
      rim: new THREE.TorusGeometry(0.14, 0.035, 4, 8),
    }),
    [],
  )

  useFrame(() => {
    const t = clock.elapsedTime
    const s = tap.since(t)
    const big = s >= 0 && s < JUMP
    // height of the hop: a parabola each period, or one big one after a tap
    const u = big ? s / JUMP : (t % PERIOD) / PERIOD
    const h = (big ? 1.25 : 0.32) * 4 * u * (1 - u)
    // squash in the last and first moments on the floor, stretch in the air
    const ground = Math.min(u, 1 - u)
    const squash = ground < 0.08 ? (1 - ground / 0.08) * 0.22 : -Math.min(0.08, h * 0.12)
    pin.current.position.y = h
    pin.current.scale.set(1 + squash * 0.6, 1 - squash, 1 + squash * 0.6)
    pin.current.rotation.y = big ? u * Math.PI * 2 : Math.sin(t * 0.8) * 0.4
  })

  return (
    <group {...handlers}>
      <group ref={pin}>
        <mesh geometry={geo.point}>
          <Flat color={C.dark} />
        </mesh>
        <mesh geometry={geo.head} position-y={0.86} scale={[1, 1.02, 0.92]}>
          <Flat color={C.body} />
        </mesh>
        <mesh geometry={geo.hole} position={[0, 0.88, 0.26]} scale={[1, 1, 0.45]}>
          <Flat color="#ffffff" />
        </mesh>
        <mesh geometry={geo.rim} position={[0, 0.88, 0.29]}>
          <Flat color={C.dark} />
        </mesh>
      </group>
      <Ripple loop period={PERIOD * 2} count={2} color={C.body} radius={1.1} opacity={0.45} />
      <Ripple tap={tap} color={C.body} count={3} radius={1.9} />
      <Burst tap={tap} count={12} colors={[C.body, C.dark, '#ffffff']} speed={1.6} gravity={6} size={0.06} life={0.9} origin={[0, 0.05, 0]} up={0.8} />
    </group>
  )
}

export default function MapPinScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} target={[0, 0.75, 0]} hint="The pin bounces on the spot and rings spread from its point · tap it and it leaps, spins and lands with a splash · Color swaps red, blue, green and purple · drag to orbit">
      <MapPin {...props} />
    </Stage>
  )
}
