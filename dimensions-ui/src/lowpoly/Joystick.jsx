import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Burst, Flat, Stage, TAU, facet, useGeo, useTap, wobble } from './kit.jsx'

// A low-poly arcade stick: a wedge-shaped box whose top slopes down toward
// the player, a light top panel with a coloured stripe along the front, a
// ball-top lever standing in a dark dust washer on the left, and two rows
// of three round buttons on the right, each a short cap in a dark collar.
// Left alone, the stick wiggles about in small restless tilts and the
// buttons light one after another in a chase. Tap it and every button
// flashes bright together and dips, the stick whips round in a circle and
// springs back upright, and a spray of bits pops off the ball.

const LOOKS = {
  red: { ball: '#e0302b', button: '#e8453c', glow: '#ff8a70', base: '#2a2a33', panel: '#ecebef', stripe: '#e0302b' },
  blue: { ball: '#2f6fe0', button: '#3a7cf0', glow: '#9cc8ff', base: '#2a2a33', panel: '#ecebef', stripe: '#2f6fe0' },
  purple: { ball: '#8a46d8', button: '#9852e6', glow: '#d9b4ff', base: '#2a2a33', panel: '#ecebef', stripe: '#8a46d8' },
  black: { ball: '#25252b', button: '#34343c', glow: '#f2f0ff', base: '#3a3a44', panel: '#cfd0d6', stripe: '#1c1c22' },
}

const W = 1.6 // base width (x)
const D = 0.95 // base depth (z)
const HF = 0.24 // height at the front
const HB = 0.4 // height at the back
const SLOPE = Math.atan((HB - HF) / D)
const STICK = [-0.42, 0, 0.02]
const BUTTONS = [
  [0.1, -0.14],
  [0.34, -0.17],
  [0.58, -0.14],
  [0.06, 0.13],
  [0.3, 0.1],
  [0.54, 0.13],
]

export function Joystick({ look = 'red' }) {
  const L = LOOKS[look] || LOOKS.red
  const { tap, handlers, clock } = useTap(2.2)
  const stick = useRef()
  const caps = useRef([])
  const geo = useGeo(() => {
    // the wedge: a side profile (z, y) drawn out across the width
    const s = new THREE.Shape()
    s.moveTo(-D / 2, 0)
    s.lineTo(D / 2, 0)
    s.lineTo(D / 2, HF)
    s.lineTo(-D / 2, HB)
    s.closePath()
    const base = new THREE.ExtrudeGeometry(s, { depth: W, bevelEnabled: false }).translate(0, 0, -W / 2).rotateY(-Math.PI / 2)
    return {
      base: facet(base, 0.006, 2),
      panel: facet(new THREE.BoxGeometry(W - 0.08, 0.03, Math.hypot(D, HB - HF) - 0.08), 0.003, 3),
      stripe: new THREE.BoxGeometry(W - 0.06, 0.07, 0.02),
      washer: new THREE.CylinderGeometry(0.13, 0.15, 0.03, 10),
      shaft: new THREE.CylinderGeometry(0.03, 0.03, 0.46, 6).translate(0, 0.23, 0),
      ball: facet(new THREE.IcosahedronGeometry(0.14, 1), 0.006, 4),
      collar: new THREE.CylinderGeometry(0.105, 0.115, 0.035, 10),
      cap: facet(new THREE.CylinderGeometry(0.085, 0.085, 0.05, 10), 0.003, 5),
      chip: new THREE.OctahedronGeometry(1, 0),
    }
  }, [])

  useFrame(() => {
    const t = clock.elapsedTime
    const s = tap.since(t)
    const flash = tap.value(t)
    // the stick: restless little tilts, or a whip round after a tap
    let rx = 0.12 * Math.sin(t * 1.7) + 0.06 * Math.sin(t * 3.7 + 1) + 0.05 * Math.sign(Math.sin(t * 0.9)) * Math.max(0, Math.sin(t * 2.3))
    let rz = 0.12 * Math.sin(t * 1.3 + 2) + 0.06 * Math.sin(t * 2.9) + 0.05 * Math.sign(Math.sin(t * 0.7 + 1)) * Math.max(0, Math.sin(t * 1.9 + 2))
    if (s >= 0 && s < 0.8) {
      const amp = 0.45 * (1 - s / 0.8) + 0.1
      const a = s * TAU * 2.5
      rx = amp * Math.cos(a)
      rz = amp * Math.sin(a)
    } else if (s >= 0.8) {
      const k = Math.exp(-6 * (s - 0.8))
      rx = rx * (1 - k) + 0.1 * k + wobble(s - 0.8, 18, 4) * 0.12
      rz = rz * (1 - k)
    }
    stick.current.rotation.set(rx, 0, rz)
    // the buttons: a chase round the six, or all at once on a tap
    const p = t * 3
    caps.current.forEach((m, i) => {
      if (!m) return
      const d = (((p - i) % 6) + 6) % 6
      const chase = d < 1 ? 1 - d : 0
      m.material.emissiveIntensity = 0.1 + chase * 1.6 + flash * 4
      m.position.y = 0.035 - (d < 0.3 ? 0.012 : 0) - flash * 0.02
    })
  })

  return (
    <group {...handlers} scale={1.15}>
      <mesh geometry={geo.base}>
        <Flat color={L.base} roughness={0.6} />
      </mesh>
      {/* the coloured stripe across the front */}
      <mesh geometry={geo.stripe} position={[0, HF / 2, D / 2 + 0.008]}>
        <Flat color={L.stripe} />
      </mesh>
      {/* the sloping top: panel, stick and buttons */}
      <group position-y={(HF + HB) / 2} rotation-x={SLOPE}>
        <mesh geometry={geo.panel} position-y={0.012}>
          <Flat color={L.panel} roughness={0.7} />
        </mesh>
        <group position={STICK}>
          <mesh geometry={geo.washer} position-y={0.04}>
            <Flat color="#18181d" roughness={0.5} />
          </mesh>
          <group ref={stick} position-y={0.04}>
            <mesh geometry={geo.shaft}>
              <meshStandardMaterial color="#c9ccd3" metalness={0.7} roughness={0.3} flatShading />
            </mesh>
            <mesh geometry={geo.ball} position-y={0.52}>
              <Flat color={L.ball} roughness={0.3} />
            </mesh>
          </group>
        </group>
        {BUTTONS.map(([x, z], i) => (
          <group key={i} position={[x, 0.025, z]}>
            <mesh geometry={geo.collar}>
              <Flat color="#18181d" roughness={0.5} />
            </mesh>
            <mesh ref={(el) => (caps.current[i] = el)} geometry={geo.cap} position-y={0.035}>
              <Flat color={L.button} emissive={L.glow} emissiveIntensity={0.12} roughness={0.35} />
            </mesh>
          </group>
        ))}
      </group>
      <Burst tap={tap} geometry={geo.chip} count={14} colors={[L.glow, L.ball, '#ffffff', '#ffd24a']} speed={1.8} gravity={4} size={0.045} life={0.9} origin={[STICK[0], 0.88, 0.05]} spread={1} />
    </group>
  )
}

export default function JoystickScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[2.6, 2.4, 3.6]} target={[0, 0.45, 0]} hint="The stick wiggles and the buttons light in turn on their own · tap the joystick and every button flashes as the stick whips round · Look swaps red, blue, purple and black · drag to orbit">
      <Joystick {...props} />
    </Stage>
  )
}
