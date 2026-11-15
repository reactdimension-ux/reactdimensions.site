import { useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useCursor } from '@react-three/drei'
import * as THREE from 'three'
import { Flat, Stage, facet, useGeo, useKick } from './kit.jsx'

// A low-poly fox, sitting: faceted orange body leaning forward on dark-
// socked front legs, a cream bib and cheeks, a pointed muzzle, tall ears and
// a big bushy tail curling up beside it with a white tip. It is alive: it
// breathes, blinks, glances about, twitches its ears and swishes its tail.
// Tap it and it cocks its head at you and wags.

const COATS = {
  red: { fur: '#e8742c', shade: '#d4601f', cream: '#f4e4c9', dark: '#3d2420', ear: '#5c2c1e' },
  arctic: { fur: '#eef0f4', shade: '#dde1e8', cream: '#ffffff', dark: '#4a4f5c', ear: '#c9ced8' },
  silver: { fur: '#5d616d', shade: '#4b4e58', cream: '#e6e6ea', dark: '#1d1e24', ear: '#2c2d34' },
}

const blob = (r, seed) => facet(new THREE.IcosahedronGeometry(r, 1), r * 0.06, seed)
const cone = (r, h, n, seed) => facet(new THREE.ConeGeometry(r, h, n, 1).translate(0, h / 2, 0), r * 0.08, seed)

export function Fox({ coat = 'red' }) {
  const C = COATS[coat] || COATS.red
  const clock = useThree((s) => s.clock)
  const [hover, setHover] = useState(false)
  useCursor(hover)
  const tap = useKick(0.9)
  const r = useRef({})
  const set = (k) => (o) => (r.current[k] = o)

  const geo = useGeo(
    () => ({
      torso: blob(0.5, 1),
      haunch: blob(0.36, 2),
      bib: blob(0.3, 3),
      leg: facet(new THREE.CylinderGeometry(0.075, 0.06, 0.62, 5, 1), 0.01, 4),
      paw: facet(new THREE.IcosahedronGeometry(0.085, 0), 0.01, 5),
      head: blob(0.32, 6),
      cheek: blob(0.2, 7),
      muzzle: facet(new THREE.ConeGeometry(0.14, 0.34, 6, 1).rotateX(Math.PI / 2), 0.012, 8),
      nose: new THREE.IcosahedronGeometry(0.048, 0),
      eye: new THREE.OctahedronGeometry(0.045, 0),
      ear: cone(0.12, 0.34, 4, 9),
      earIn: cone(0.072, 0.24, 4, 10),
      tailBase: blob(0.21, 11),
      tailMid: blob(0.27, 12),
      tailTip: cone(0.23, 0.52, 6, 13),
    }),
    [],
  )

  useFrame(() => {
    const t = clock.elapsedTime
    const o = r.current
    const k = tap.value(t)
    // ease the head tilt in rather than snapping
    const tilt = k * (1 - Math.exp(-10 * tap.since(t)))
    // breathing
    const b = 1 + Math.sin(t * 2.2) * 0.022
    o.torso.scale.set(0.62 * (2 - b), 0.95 * b, 0.7 * (2 - b))
    o.bib.scale.set(0.95, 1.35 * b, 0.6)
    // a slow look round, and a curious head cock on a tap
    o.head.rotation.y = Math.sin(t * 0.45) * 0.3 + Math.sin(t * 1.7) * 0.04
    o.head.rotation.x = Math.sin(t * 0.6 + 1) * 0.06 - tilt * 0.1
    o.head.rotation.z = tilt * 0.38
    // blink every few seconds
    const bl = t % 3.4
    o.eyeL.scale.y = o.eyeR.scale.y = bl < 0.13 ? 0.12 : 1
    // ear twitches, each ear on its own beat
    ;[o.earL, o.earR].forEach((e, i) => {
      const ph = (t * 0.31 + i * 0.47) % 1
      e.rotation.x = ph < 0.07 ? -Math.sin((ph / 0.07) * Math.PI) * 0.35 : 0
    })
    // tail: a lazy swish, a quick wag when tapped
    o.tail.rotation.y = Math.sin(t * 1.5) * 0.16 + Math.sin(t * 13) * k * 0.42
    o.tail.rotation.z = Math.sin(t * 1.5 + 1.2) * 0.06
  })

  return (
    <group
      onClick={(e) => {
        e.stopPropagation()
        tap.kick(clock.elapsedTime)
      }}
      onPointerOver={(e) => (e.stopPropagation(), setHover(true))}
      onPointerOut={() => setHover(false)}
    >
      {/* body */}
      <mesh ref={set('torso')} geometry={geo.torso} position={[0, 0.78, -0.03]} rotation-x={0.2}>
        <Flat color={C.fur} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={geo.haunch} position={[s * 0.27, 0.36, -0.12]} scale={[0.75, 0.9, 1.15]}>
          <Flat color={C.shade} />
        </mesh>
      ))}
      <mesh ref={set('bib')} geometry={geo.bib} position={[0, 0.94, 0.25]} rotation-x={0.2}>
        <Flat color={C.cream} />
      </mesh>
      {/* front legs and paws, back feet */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh geometry={geo.leg} position={[s * 0.15, 0.31, 0.25]}>
            <Flat color={C.dark} />
          </mesh>
          <mesh geometry={geo.paw} position={[s * 0.15, 0.035, 0.3]} scale={[1, 0.6, 1.4]}>
            <Flat color={C.dark} />
          </mesh>
          <mesh geometry={geo.paw} position={[s * 0.31, 0.05, 0.1]} scale={[1.15, 0.6, 2]}>
            <Flat color={C.dark} />
          </mesh>
        </group>
      ))}

      {/* head, turning on the neck */}
      <group ref={set('head')} position={[0, 1.3, 0.12]}>
        <mesh geometry={geo.head} position={[0, 0.08, 0]} scale={[1.1, 0.9, 0.95]}>
          <Flat color={C.fur} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} geometry={geo.cheek} position={[s * 0.15, -0.03, 0.15]} scale={[1, 0.7, 0.9]}>
            <Flat color={C.cream} />
          </mesh>
        ))}
        <mesh geometry={geo.muzzle} position={[0, -0.03, 0.36]}>
          <Flat color={C.cream} />
        </mesh>
        <mesh geometry={geo.nose} position={[0, -0.02, 0.53]}>
          <Flat color={C.dark} roughness={0.4} />
        </mesh>
        <mesh ref={set('eyeL')} geometry={geo.eye} position={[-0.13, 0.12, 0.25]}>
          <Flat color="#17100d" roughness={0.3} />
        </mesh>
        <mesh ref={set('eyeR')} geometry={geo.eye} position={[0.13, 0.12, 0.25]}>
          <Flat color="#17100d" roughness={0.3} />
        </mesh>
        {[-1, 1].map((s) => (
          <group key={s} position={[s * 0.17, 0.28, -0.03]} rotation-z={-s * 0.25}>
            <group ref={set(s < 0 ? 'earL' : 'earR')}>
              <mesh geometry={geo.ear}>
                <Flat color={C.ear} />
              </mesh>
              <mesh geometry={geo.earIn} position={[0, 0.03, 0.045]}>
                <Flat color={C.cream} />
              </mesh>
            </group>
          </group>
        ))}
      </group>

      {/* the tail, swinging from its root */}
      <group ref={set('tail')} position={[0.16, 0.24, -0.38]}>
        <mesh geometry={geo.tailBase} position={[0.16, 0.04, -0.1]} scale={[0.9, 0.8, 1.35]} rotation-y={0.5}>
          <Flat color={C.shade} />
        </mesh>
        <mesh geometry={geo.tailMid} position={[0.42, 0.32, -0.06]} scale={[0.9, 1.2, 0.9]} rotation-z={-0.3}>
          <Flat color={C.fur} />
        </mesh>
        <mesh geometry={geo.tailTip} position={[0.5, 0.56, -0.04]} rotation-z={-0.22}>
          <Flat color={C.cream} />
        </mesh>
      </group>
    </group>
  )
}

export default function FoxScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} target={[0, 0.95, 0]} hint="The fox breathes, blinks, looks about and swishes its tail on its own · tap it and it cocks its head and wags · Coat swaps red, arctic and silver · drag to orbit">
      <Fox {...props} />
    </Stage>
  )
}
