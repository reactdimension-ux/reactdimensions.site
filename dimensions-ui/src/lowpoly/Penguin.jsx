import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Burst, Face, Flat, Stage, blob, cone, facet, squash, useGeo, useTap, wobble } from './kit.jsx'

// A low-poly penguin on an ice floe: a plump faceted body with a white
// belly, a round head with a beak, two flippers and orange feet. It
// waddles on the spot: the body rocks from foot to foot, each foot lifting
// as the weight comes off it, the flippers swinging for balance, and it
// glances about and blinks. Tap it and it flaps its flippers in excitement
// and gives a little hop.

const KINDS = {
  emperor: { back: '#2a2e3a', belly: '#fbfaf6', patch: '#f6c93a', beak: '#e8743a', feet: '#3a3846' },
  adelie: { back: '#1f2230', belly: '#ffffff', patch: null, beak: '#3a3846', feet: '#f2a6a6' },
  rockhopper: { back: '#2c2a33', belly: '#fbfaf6', patch: '#f6d24a', beak: '#d8383f', feet: '#f2a6a6', brows: true },
  'little-blue': { back: '#4a6f9a', belly: '#f4f6fa', patch: null, beak: '#3a3846', feet: '#f4f1ea' },
}

export function Penguin({ kind = 'emperor' }) {
  const K = KINDS[kind] || KINDS.emperor
  const { tap, handlers, clock } = useTap(1.2)
  const body = useRef()
  const head = useRef()
  const flips = useRef([])
  const feet = useRef([])

  const geo = useGeo(
    () => ({
      floe: facet(new THREE.CylinderGeometry(0.75, 0.82, 0.14, 9, 1).translate(0, 0.07, 0), 0.03, 1, [1, 0.4, 1]),
      body: blob(0.3, 2),
      belly: blob(0.24, 3),
      head: blob(0.19, 4),
      beak: cone(0.035, 0.12, 4, 5).rotateX(Math.PI / 2),
      patch: blob(0.07, 6, 0),
      flipper: facet(new THREE.IcosahedronGeometry(0.1, 0), 0.006, 7).scale(0.35, 1.5, 0.75).translate(0, -0.12, 0),
      foot: facet(new THREE.BoxGeometry(0.11, 0.035, 0.14), 0.004, 8),
      brow: cone(0.02, 0.1, 3, 9).rotateZ(Math.PI / 2),
      snow: new THREE.OctahedronGeometry(1, 0),
    }),
    [],
  )

  useFrame(() => {
    const t = clock.elapsedTime
    const s = tap.since(t)
    const excited = s >= 0 && s < 1.4
    const w = t * (excited ? 7 : 4)
    // waddle: rock onto one foot, lift the other
    const rock = Math.sin(w)
    const hopY = s >= 0.1 && s < 0.6 ? Math.sin(((s - 0.1) / 0.5) * Math.PI) * 0.16 : 0
    body.current.rotation.z = rock * 0.12
    body.current.position.y = 0.14 + Math.abs(Math.cos(w)) * 0.015 + hopY
    squash(body.current, wobble(s - 0.6, 14, 4) * 0.08)
    feet.current.forEach((f, i) => f && (f.position.y = 0.16 + Math.max(0, (i ? -1 : 1) * rock) * 0.04 + hopY))
    // flippers: balance swings, or a frantic flap when excited
    flips.current.forEach((f, i) => {
      if (!f) return
      const side = i ? 1 : -1
      const flap = excited ? 0.5 + Math.sin(t * 24 + i) * 0.6 : 0.15 + Math.sin(w + i * Math.PI) * 0.1
      f.rotation.z = side * flap
    })
    head.current.rotation.y = Math.sin(t * 0.5) * 0.4 + Math.sin(t * 1.3) * 0.1
    head.current.rotation.z = -rock * 0.06
  })

  return (
    <group {...handlers}>
      <mesh geometry={geo.floe}>
        <Flat color="#e8f2fa" />
      </mesh>
      {[-1, 1].map((x, i) => (
        <mesh key={x} ref={(el) => (feet.current[i] = el)} geometry={geo.foot} position={[x * 0.1, 0.16, 0.12]} rotation-y={x * -0.25}>
          <Flat color={K.feet} />
        </mesh>
      ))}
      <group ref={body} position-y={0.14}>
        <mesh geometry={geo.body} position-y={0.3} scale={[0.95, 1.15, 0.85]}>
          <Flat color={K.back} />
        </mesh>
        <mesh geometry={geo.belly} position={[0, 0.27, 0.08]} scale={[0.9, 1.25, 0.75]}>
          <Flat color={K.belly} />
        </mesh>
        {[-1, 1].map((x, i) => (
          <group key={x} ref={(el) => (flips.current[i] = el)} position={[x * 0.27, 0.46, 0]}>
            <mesh geometry={geo.flipper}>
              <Flat color={K.back} />
            </mesh>
          </group>
        ))}
        <group ref={head} position-y={0.66}>
          <mesh geometry={geo.head} position-y={0.06}>
            <Flat color={K.back} />
          </mesh>
          {K.patch &&
            [-1, 1].map((x) => (
              <mesh key={x} geometry={geo.patch} position={[x * 0.13, -0.02, 0.06]} scale={[0.6, 1.2, 0.8]}>
                <Flat color={K.patch} />
              </mesh>
            ))}
          {K.brows &&
            [-1, 1].map((x) => (
              <mesh key={x} geometry={geo.brow} position={[x * 0.1, 0.13, 0.1]} rotation-y={x * 0.6}>
                <Flat color={K.patch} />
              </mesh>
            ))}
          <mesh geometry={geo.belly} position={[0, 0.03, 0.08]} scale={[0.5, 0.45, 0.45]}>
            <Flat color={K.belly} />
          </mesh>
          <Face position={[0, 0.09, 0.165]} spacing={0.13} size={0.022} mouth="none" />
          <mesh geometry={geo.beak} position={[0, 0.04, 0.2]}>
            <Flat color={K.beak} />
          </mesh>
        </group>
      </group>
      <Burst tap={tap} geometry={geo.snow} count={12} colors={['#ffffff', '#dbeaf6']} speed={1.2} gravity={2} size={0.025} life={1} origin={[0, 0.2, 0]} spread={1.2} up={0.8} />
    </group>
  )
}

export default function PenguinScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[2.2, 1.5, 3.2]} target={[0, 0.5, 0]} hint="It waddles on the spot, rocking from foot to foot with its flippers swinging for balance, and looks about · tap it and it flaps excitedly and hops · Kind swaps emperor, adelie, rockhopper and little blue · drag to orbit">
      <Penguin {...props} />
    </Stage>
  )
}
