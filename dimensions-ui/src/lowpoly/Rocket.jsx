import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Flame, Flat, Particles, Stage, TAU, Trail, facet, useGeo, useTap } from './kit.jsx'

// A low-poly rocket on its launch pad: a lathed body with a painted nose,
// a porthole, three swept fins and a nozzle, beside a lattice gantry. It
// idles with a low, fluttering flame and wisps of smoke. Tap it and it
// rumbles, roars off the pad with a smoke trail and flies out of sight, then
// drops back from the sky and settles on the pad again.

const LIVERIES = {
  classic: { body: '#f4f1ea', nose: '#d8383f', fin: '#d8383f', band: '#2c2a33' },
  retro: { body: '#f2e6c8', nose: '#2fa59a', fin: '#2fa59a', band: '#e8743a' },
  space: { body: '#f4f6fa', nose: '#1f2230', fin: '#1f2230', band: '#3d7fe0' },
  toy: { body: '#f6c93a', nose: '#3d7fe0', fin: '#3d7fe0', band: '#e3393f' },
}
const PAD_Y = 0.22
// launch timeline, seconds after a tap
const RUMBLE = 0.6
const CLIMB = 2.0
const AWAY = 2.8
const LAND = 4.4

const BODY = [
  [0, 0],
  [0.15, 0],
  [0.19, 0.12],
  [0.2, 0.3],
  [0.2, 0.72],
]
const NOSE = [
  [0.2, 0],
  [0.17, 0.17],
  [0.11, 0.32],
  [0.04, 0.42],
  [0, 0.45],
]
const lathe = (pts) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 10)

function finGeo() {
  const s = new THREE.Shape()
  s.moveTo(0, 0)
  s.lineTo(0.2, -0.1)
  s.lineTo(0.2, 0.02)
  s.lineTo(0, 0.3)
  s.closePath()
  return new THREE.ExtrudeGeometry(s, { depth: 0.025, bevelEnabled: false }).translate(0, 0, -0.0125)
}

export function Rocket({ livery = 'classic' }) {
  const C = LIVERIES[livery] || LIVERIES.classic
  const { tap, handlers, clock } = useTap(1)
  const rocket = useRef()

  const geo = useGeo(
    () => ({
      body: lathe(BODY),
      nose: lathe(NOSE),
      band: new THREE.CylinderGeometry(0.205, 0.205, 0.05, 10, 1),
      port: new THREE.TorusGeometry(0.065, 0.018, 4, 10),
      glass: new THREE.CircleGeometry(0.055, 10),
      fin: finGeo(),
      nozzle: new THREE.CylinderGeometry(0.1, 0.13, 0.1, 8, 1, true),
      pad: facet(new THREE.CylinderGeometry(0.62, 0.7, 0.14, 6, 1).translate(0, 0.07, 0), 0.01, 1),
      plate: new THREE.CylinderGeometry(0.3, 0.3, 0.08, 8, 1).translate(0, 0.04, 0),
      ground: facet(new THREE.CylinderGeometry(1.35, 1.4, 0.06, 14, 1).translate(0, 0.03, 0), 0.03, 2, [1, 0.3, 1]),
      post: new THREE.BoxGeometry(0.035, 1.5, 0.035).translate(0, 0.75, 0),
      strut: new THREE.BoxGeometry(0.02, 0.3, 0.02),
      arm: new THREE.BoxGeometry(0.4, 0.03, 0.03).translate(0.2, 0, 0),
      puff: new THREE.IcosahedronGeometry(1, 0),
    }),
    [],
  )

  const since = () => tap.since(clock.elapsedTime)
  const flying = () => {
    const s = since()
    return s > RUMBLE && s < CLIMB + 0.2 ? 1 : 0
  }
  const power = () => {
    const s = since()
    if (s < RUMBLE) return 0.4 + (s / RUMBLE) * 0.8
    if (s < CLIMB) return 1.8
    if (s >= AWAY && s < LAND) return 0.9
    return 0.35
  }
  const smoke = () => {
    const s = since()
    return s < CLIMB ? 1 : s >= AWAY && s < LAND + 0.6 ? 0.7 : 0.25
  }

  useFrame(() => {
    const t = clock.elapsedTime
    const s = since()
    const r = rocket.current
    let y = 0
    let shake = 0
    if (s < RUMBLE) shake = (s / RUMBLE) * 0.012
    else if (s < CLIMB) y = 7 * ((s - RUMBLE) / (CLIMB - RUMBLE)) ** 2
    else if (s < AWAY) y = 99
    else if (s < LAND) y = 3 * (1 - (s - AWAY) / (LAND - AWAY)) ** 3
    r.visible = y < 50
    r.position.set(Math.sin(t * 70) * shake, PAD_Y + 0.08 + y, Math.cos(t * 63) * shake)
    r.rotation.y = t * 0.15
  })

  return (
    <group {...handlers}>
      <mesh geometry={geo.ground}>
        <Flat color="#b9b4ab" />
      </mesh>
      <mesh geometry={geo.pad} position-y={0.06}>
        <Flat color="#6e6b68" />
      </mesh>
      <mesh geometry={geo.plate} position-y={0.2}>
        <Flat color="#3a3836" />
      </mesh>

      {/* gantry */}
      <group position={[-0.62, 0.2, -0.1]}>
        {[
          [0, 0],
          [0.16, 0],
          [0, 0.16],
          [0.16, 0.16],
        ].map(([x, z]) => (
          <mesh key={`${x}${z}`} geometry={geo.post} position={[x, 0, z]}>
            <Flat color="#d8383f" />
          </mesh>
        ))}
        {[0.25, 0.6, 0.95, 1.3].map((y) => (
          <group key={y} position-y={y}>
            {[0, 1].map((k) => (
              <mesh key={k} geometry={geo.strut} position={[0.08, 0, k * 0.16]} rotation-z={0.9}>
                <Flat color="#d8383f" />
              </mesh>
            ))}
          </group>
        ))}
        <mesh geometry={geo.arm} position={[0.16, 1.05, 0.08]}>
          <Flat color="#2c2a33" />
        </mesh>
      </group>

      <group ref={rocket}>
        <mesh geometry={geo.nozzle} position-y={0.02}>
          <Flat color="#2c2a33" side={THREE.DoubleSide} metalness={0.4} roughness={0.5} />
        </mesh>
        <group position-y={0.07}>
          <mesh geometry={geo.body}>
            <Flat color={C.body} />
          </mesh>
          <mesh geometry={geo.band} position-y={0.62}>
            <Flat color={C.band} />
          </mesh>
          <mesh geometry={geo.nose} position-y={0.72}>
            <Flat color={C.nose} />
          </mesh>
          <group position={[0, 0.48, 0.195]}>
            <mesh geometry={geo.port}>
              <Flat color="#c9ced8" metalness={0.5} roughness={0.35} />
            </mesh>
            <mesh geometry={geo.glass} position-z={0.002}>
              <Flat color="#7fc8f0" emissive="#3a8ad0" emissiveIntensity={0.4} roughness={0.2} />
            </mesh>
          </group>
          {[0, 1, 2].map((i) => (
            <group key={i} rotation-y={(i / 3) * TAU + Math.PI / 2}>
              <mesh geometry={geo.fin} position={[0.17, 0.05, 0]}>
                <Flat color={C.fin} />
              </mesh>
            </group>
          ))}
        </group>
        <Flame rotation-x={Math.PI} position-y={0.0} size={0.55} power={power} colors={['#ff6a1f', '#ffc04a', '#fff8d0']} />
      </group>

      <Trail target={rocket} count={22} every={0.04} color="#e8e8ee" size={0.1} grow={0.08} opacity={0.75} active={flying} />
      <Particles geometry={geo.puff} count={16} life={1.6} origin={[0, PAD_Y + 0.05, 0]} spread={0.15} velocity={[0, 0.12, 0]} scatter={0.55} drift={0.1} size={[0.06, 0.2]} colors={['#e8e8ee', '#cfcfd6']} opacity={[0.7, 0]} active={smoke} />
    </group>
  )
}

export default function RocketScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[3.2, 2.2, 4.4]} target={[0, 0.75, 0]} hint="The rocket idles on the pad with a fluttering flame on its own · tap it and it rumbles, launches with a smoke trail, then drops back and lands · Livery swaps classic, retro, space and toy · drag to orbit">
      <Rocket {...props} />
    </Stage>
  )
}
