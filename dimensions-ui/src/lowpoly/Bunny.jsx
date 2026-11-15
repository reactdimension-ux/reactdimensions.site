import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Burst, Face, Flat, Stage, blob, cone, facet, squash, useGeo, useTap } from './kit.jsx'

// A low-poly rabbit sitting in the grass beside a carrot: a round body on
// big hind feet, a cotton tail, a head with long pink-lined ears, a
// twitching nose and whiskers. It breathes, wiggles its nose, blinks and
// flicks each ear on its own beat. Tap it and it hops: a crouch, a stretch
// into the air with its ears trailing back, and a squashy landing.

const COATS = {
  white: { fur: '#f6f4ee', shade: '#e6e2d8', inner: '#f6b4c4', eye: '#d8383f' },
  brown: { fur: '#a8784a', shade: '#8f643c', inner: '#f2b8a8', eye: '#1b1a22' },
  grey: { fur: '#9a9aa2', shade: '#83838c', inner: '#f2b8c4', eye: '#1b1a22' },
  dutch: { fur: '#2c2a33', shade: '#f6f4ee', inner: '#f2b8c4', eye: '#1b1a22' },
}

export function Bunny({ coat = 'white' }) {
  const C = COATS[coat] || COATS.white
  const { tap, handlers, clock } = useTap(1)
  const hopper = useRef()
  const squish = useRef()
  const ears = useRef([])
  const nose = useRef()

  const geo = useGeo(
    () => ({
      grass: facet(new THREE.CylinderGeometry(0.8, 0.85, 0.06, 12, 1).translate(0, 0.03, 0), 0.02, 1, [1, 0.3, 1]),
      tuft: cone(0.03, 0.14, 3, 2),
      body: blob(0.24, 3),
      foot: facet(new THREE.IcosahedronGeometry(0.07, 0), 0.004, 4).scale(0.8, 0.5, 1.8),
      paw: blob(0.04, 5, 0),
      head: blob(0.15, 6),
      cheek: blob(0.07, 7, 0),
      ear: facet(new THREE.IcosahedronGeometry(0.06, 0), 0.004, 8).scale(0.75, 2.6, 0.35).translate(0, 0.15, 0),
      inner: new THREE.IcosahedronGeometry(0.045, 0).scale(0.6, 2.4, 0.2).translate(0, 0.14, 0.012),
      nose: new THREE.IcosahedronGeometry(0.02, 0),
      whisker: new THREE.BoxGeometry(0.12, 0.003, 0.003),
      tail: blob(0.06, 9),
      carrot: cone(0.05, 0.28, 6, 10).rotateX(Math.PI),
      top: cone(0.02, 0.12, 3, 11),
      spark: new THREE.OctahedronGeometry(1, 0),
    }),
    [],
  )

  useFrame(() => {
    const t = clock.elapsedTime
    const s = tap.since(t)
    // the hop: crouch, take-off stretch, airborne, landing squash
    let y = 0
    let k = Math.sin(t * 2.2) * 0.015
    let air = 0
    if (s >= 0 && s < 0.2) k = 0.15 * Math.sin((s / 0.2) * Math.PI * 0.5)
    else if (s >= 0.2 && s < 0.75) {
      const q = (s - 0.2) / 0.55
      y = 4 * q * (1 - q) * 0.4
      k = q < 0.5 ? -0.12 * (1 - q * 2) : -0.05
      air = Math.sin(q * Math.PI)
    } else if (s >= 0.75 && s < 1.15) k = 0.16 * Math.exp(-6 * (s - 0.75)) * Math.cos((s - 0.75) * 14)
    hopper.current.position.y = y
    hopper.current.rotation.x = -air * 0.25
    squash(squish.current, k)
    // ears: each flicks on its own beat, and they stream back in the air
    ears.current.forEach((e, i) => {
      if (!e) return
      const ph = (t * 0.29 + i * 0.43) % 1
      const flick = ph < 0.08 ? Math.sin((ph / 0.08) * Math.PI) * 0.4 : 0
      e.rotation.x = -0.15 - air * 0.9 + flick * (i ? 1 : -0.4)
      e.rotation.z = (i ? -1 : 1) * (0.12 + flick * 0.3)
    })
    // the nose wiggles in quick bursts
    const wig = t % 2.6 < 0.9 ? Math.sin(t * 30) * 0.25 : 0
    nose.current.scale.set(1 + wig, 1 - wig * 0.5, 1)
  })

  return (
    <group {...handlers}>
      <mesh geometry={geo.grass}>
        <Flat color="#7fbf52" />
      </mesh>
      {[
        [0.5, 0.3],
        [-0.55, 0.2],
        [-0.2, -0.55],
        [0.45, -0.45],
      ].map(([x, z], i) => (
        <group key={i} position={[x, 0.06, z]}>
          {[-0.3, 0, 0.3].map((a) => (
            <mesh key={a} geometry={geo.tuft} rotation-z={a}>
              <Flat color="#5f9a3a" />
            </mesh>
          ))}
        </group>
      ))}
      <group position={[0.42, 0.08, 0.28]} rotation={[0.1, 0.4, -1.35]}>
        <mesh geometry={geo.carrot}>
          <Flat color="#f07b2a" />
        </mesh>
        {[-0.4, 0, 0.4].map((a) => (
          <mesh key={a} geometry={geo.top} position-y={0.02} rotation-z={a}>
            <Flat color="#4f9a3a" />
          </mesh>
        ))}
      </group>

      <group ref={hopper} position-y={0.06}>
        <group ref={squish}>
          {[-1, 1].map((x) => (
            <mesh key={x} geometry={geo.foot} position={[x * 0.13, 0.03, 0.02]}>
              <Flat color={C.shade} />
            </mesh>
          ))}
          <mesh geometry={geo.body} position-y={0.21} scale={[0.95, 0.9, 1.1]}>
            <Flat color={C.fur} />
          </mesh>
          <mesh geometry={geo.body} position={[0, 0.17, 0.08]} scale={[0.6, 0.6, 0.55]}>
            <Flat color={C.shade} />
          </mesh>
          {[-1, 1].map((x) => (
            <mesh key={x} geometry={geo.paw} position={[x * 0.07, 0.04, 0.2]} scale={[1, 0.7, 1.3]}>
              <Flat color={C.fur} />
            </mesh>
          ))}
          <mesh geometry={geo.tail} position={[0, 0.16, -0.25]}>
            <Flat color="#ffffff" />
          </mesh>
          <group position={[0, 0.44, 0.13]}>
            <mesh geometry={geo.head} scale={[1, 0.92, 1]}>
              <Flat color={C.fur} />
            </mesh>
            {[-1, 1].map((x) => (
              <mesh key={x} geometry={geo.cheek} position={[x * 0.065, -0.05, 0.08]}>
                <Flat color={C.fur} />
              </mesh>
            ))}
            {[-1, 1].map((x, i) => (
              <group key={x} ref={(el) => (ears.current[i] = el)} position={[x * 0.06, 0.1, -0.02]}>
                <mesh geometry={geo.ear}>
                  <Flat color={C.fur} />
                </mesh>
                <mesh geometry={geo.inner}>
                  <Flat color={C.inner} />
                </mesh>
              </group>
            ))}
            <Face position={[0, 0.03, 0.135]} spacing={0.14} size={0.02} color={C.eye} mouth="none" />
            <mesh ref={nose} geometry={geo.nose} position={[0, -0.03, 0.155]}>
              <Flat color="#f27a9a" />
            </mesh>
            {[-1, 1].map((x) =>
              [-0.12, 0.12].map((a) => (
                <mesh key={`${x}${a}`} geometry={geo.whisker} position={[x * 0.08, -0.045, 0.13]} rotation={[0, x * -0.3, a]}>
                  <Flat color="#4a4650" />
                </mesh>
              )),
            )}
          </group>
        </group>
      </group>
      <Burst tap={tap} geometry={geo.spark} count={10} colors={['#7fbf52', '#a8d86a']} speed={0.9} gravity={2.5} size={0.025} life={0.8} origin={[0, 0.08, 0]} spread={1.4} up={0.5} />
    </group>
  )
}

export default function BunnyScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[2, 1.3, 2.8]} target={[0, 0.35, 0]} hint="It breathes, blinks, wiggles its nose and flicks each ear on its own beat · tap it and it hops: crouch, stretch, ears streaming back, squashy landing · Coat swaps white, brown, grey and dutch · drag to orbit">
      <Bunny {...props} />
    </Stage>
  )
}
