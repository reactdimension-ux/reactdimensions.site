import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Burst, Flat, Ripple, Stage, TAU, facet, pulse, useGeo, useTap } from './kit.jsx'

// A low-poly light bulb standing on its screw base: a faceted glass globe
// narrowing to a neck, a ridged metal cap with a black contact at the foot,
// and inside, a coiled filament held up on two wires. Left alone, the
// filament smoulders and the glass breathes a faint glow. Tap it and it
// switches on: a flash, a spray of light and the whole globe lit, casting
// its colour on the floor. Tap again to switch it off.

const LOOKS = {
  warm: { light: '#ffc76a', hot: '#fff1c9', glass: '#fff8ea' },
  daylight: { light: '#cfe6ff', hot: '#f4fbff', glass: '#f2f7ff' },
  amber: { light: '#ff9a3c', hot: '#ffd59c', glass: '#ffe9cf' },
  pink: { light: '#ff8fc8', hot: '#ffe0f0', glass: '#fff0f7' },
}

const BASE_H = 0.42 // the screw cap
const NECK = 0.22

// The globe and neck, turned on a lathe: round bulb tapering into the cap.
function glassGeometry() {
  const pts = []
  const R = 0.55
  const cy = BASE_H + NECK + R * 0.82
  for (let i = 0; i <= 9; i++) {
    const a = -Math.PI / 2 + 0.55 + (i / 9) * (Math.PI - 0.55)
    pts.push(new THREE.Vector2(Math.cos(a) * R, cy + Math.sin(a) * R))
  }
  pts.unshift(new THREE.Vector2(0.21, BASE_H - 0.02), new THREE.Vector2(0.24, BASE_H + NECK * 0.6))
  pts.push(new THREE.Vector2(0, cy + R))
  return facet(new THREE.LatheGeometry(pts, 10), 0.012, 4)
}

// The coil: a tight helix bowed between the tops of the two support wires.
function filamentGeometry(top) {
  const pts = []
  const n = 120
  for (let i = 0; i <= n; i++) {
    const u = i / n
    const x = (u - 0.5) * 0.3
    const y = top + Math.sin(u * Math.PI) * 0.05
    const a = u * TAU * 9
    pts.push(new THREE.Vector3(x, y + Math.cos(a) * 0.022, Math.sin(a) * 0.022))
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n, 0.006, 4, false)
}

export function Bulb({ look = 'warm' }) {
  const L = LOOKS[look] || LOOKS.warm
  const [on, setOn] = useState(false)
  const { tap, handlers, clock } = useTap(1.6)
  const glass = useRef()
  const fil = useRef()
  const lamp = useRef()
  const level = useRef(0)
  const top = BASE_H + NECK + 0.42
  const geo = useGeo(
    () => ({
      glass: glassGeometry(),
      fil: filamentGeometry(top),
      wire: new THREE.CylinderGeometry(0.006, 0.006, 1, 4),
      stem: facet(new THREE.CylinderGeometry(0.035, 0.07, 0.3, 6), 0.004, 2),
      ring: new THREE.CylinderGeometry(0.235, 0.235, 0.055, 10),
      cap: new THREE.CylinderGeometry(0.215, 0.215, BASE_H - 0.1, 10),
      tip: new THREE.CylinderGeometry(0.08, 0.11, 0.08, 8),
      ray: new THREE.OctahedronGeometry(1, 0),
    }),
    [],
  )
  const tapOn = {
    ...handlers,
    onClick: (e) => {
      handlers.onClick(e)
      setOn((v) => !v)
    },
  }

  useFrame((_, dt) => {
    const t = clock.elapsedTime
    // ease the light level toward on or off (a filament warms, it doesn't snap)
    const target = on ? 1 : 0
    level.current += (target - level.current) * Math.min(1, dt * (on ? 9 : 5))
    const k = level.current
    const flash = on ? tap.value(t) : 0
    const idle = 0.15 + pulse(t, 0.35) * 0.12
    fil.current.material.emissiveIntensity = idle * (1 - k) + k * (3.2 + flash * 4)
    glass.current.material.emissiveIntensity = 0.04 + idle * 0.15 * (1 - k) + k * (0.55 + flash * 1.2)
    glass.current.material.opacity = 0.38 + k * 0.35
    lamp.current.intensity = k * (2.4 + flash * 5)
  })

  return (
    <group {...tapOn}>
      {/* the glass: lit from inside when on */}
      <mesh ref={glass} geometry={geo.glass}>
        <Flat color={L.glass} emissive={L.light} transparent opacity={0.4} roughness={0.15} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      {/* inside: the glass stem, two support wires and the coil */}
      <mesh geometry={geo.stem} position-y={BASE_H + 0.12}>
        <Flat color="#e8eef2" transparent opacity={0.7} roughness={0.2} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={geo.wire} position={[s * 0.15, (BASE_H + 0.24 + top) / 2, 0]} scale-y={top - BASE_H - 0.24} rotation-z={s * -0.06}>
          <meshStandardMaterial color="#7d7f86" metalness={0.8} roughness={0.35} />
        </mesh>
      ))}
      <mesh ref={fil} geometry={geo.fil}>
        <meshStandardMaterial color={L.hot} emissive={L.hot} emissiveIntensity={0.2} toneMapped={false} />
      </mesh>
      <pointLight ref={lamp} position-y={top} color={L.light} intensity={0} distance={4} decay={1.6} />
      {/* the screw cap: threads as stacked rings, then the black contact */}
      <mesh geometry={geo.cap} position-y={BASE_H / 2 + 0.03}>
        <meshStandardMaterial color="#c3c6cd" metalness={0.35} roughness={0.38} flatShading />
      </mesh>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} geometry={geo.ring} position-y={0.12 + i * 0.075}>
          <meshStandardMaterial color="#d6d9df" metalness={0.35} roughness={0.32} flatShading />
        </mesh>
      ))}
      <mesh geometry={geo.tip} position-y={0.04}>
        <Flat color="#1d1d22" roughness={0.5} />
      </mesh>
      <Burst tap={tap} geometry={geo.ray} count={on ? 14 : 0} colors={[L.hot, L.light, '#ffffff']} speed={2.1} gravity={0.6} size={0.05} life={0.9} origin={[0, top, 0]} spread={1.2} />
      <Ripple tap={tap} color={L.light} radius={1.6} />
    </group>
  )
}

export default function BulbScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[3, 2.2, 4.2]} target={[0, 0.85, 0]} hint="The filament smoulders and the glass breathes on its own · tap the bulb to switch it on with a flash, and again to switch it off · Look swaps warm, daylight, amber and pink · drag to orbit">
      <Bulb {...props} />
    </Stage>
  )
}
