import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Flat, Stage, facet, useGeo, useTap } from './kit.jsx'

// A low-poly clockwork metronome: a four-sided pyramid on a plinth with a
// little pointed cap, a pale scale of tick marks up its sloping front, and a
// long arm pivoted low on the front with a sliding weight. Left alone, the
// arm ticks side to side, a small flash of light at each end of the swing.
// Tap it and the weight slides down the arm, so the tempo quickens; after a
// moment it slides back up and the beat settles to its old pace.

const LOOKS = {
  walnut: { body: '#8a5432', trim: '#5c351e', panel: '#f1e4c6', tick: '#6b4127', arm: '#d4b25c', weight: '#e0be62', flash: '#ffc23a' },
  black: { body: '#2b2a31', trim: '#17161b', panel: '#e9e1cd', tick: '#2b2a31', arm: '#d4b25c', weight: '#e0be62', flash: '#ffc23a' },
  mint: { body: '#8fd8c0', trim: '#5db398', panel: '#fbfaf4', tick: '#5db398', arm: '#3f6560', weight: '#ff7f6a', flash: '#ff6f5a' },
}

const B = 0.12 // plinth height
const H = 1.45 // body height
const W0 = 0.354 // half-width of the body's foot (and top, below)
const W1 = 0.141
const TILT = Math.atan((W0 - W1) / H) // the front face leans back this far
const PIVOT = 0.3 // up the face
const ARM = 1.12
const AMP = 0.42 // swing, radians
const BASE = Math.PI * 1.6 // radians of phase a second: 1.6 ticks a second
const ease = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u))

export function Metronome({ look = 'walnut' }) {
  const L = LOOKS[look] || LOOKS.walnut
  const { tap, handlers, clock } = useTap(2)
  const swing = useRef()
  const weight = useRef()
  const flashes = useRef([])
  const lamp = useRef()
  const st = useRef({ phase: 0, n: -1, at: [-9, -9] })
  const geo = useGeo(() => {
    const frustum = (r0, r1, h, seed) => facet(new THREE.CylinderGeometry(r1, r0, h, 4, 1).rotateY(Math.PI / 4).translate(0, h / 2, 0), 0.006, seed)
    const panel = new THREE.Shape([new THREE.Vector2(-0.25, 0.1), new THREE.Vector2(0.25, 0.1), new THREE.Vector2(0.1, 1.34), new THREE.Vector2(-0.1, 1.34)])
    return {
      plinth: frustum(0.66, 0.62, B, 1),
      body: frustum(0.5, 0.2, H, 2),
      cap: facet(new THREE.ConeGeometry(0.17, 0.2, 4, 1).rotateY(Math.PI / 4).translate(0, 0.1, 0), 0.004, 3),
      knob: new THREE.IcosahedronGeometry(0.04, 0),
      panel: new THREE.ExtrudeGeometry(panel, { depth: 0.012, bevelEnabled: false }),
      tick: new THREE.BoxGeometry(1, 0.014, 0.012),
      hub: new THREE.CylinderGeometry(0.05, 0.05, 0.03, 8).rotateX(Math.PI / 2),
      arm: new THREE.BoxGeometry(0.026, ARM, 0.016).translate(0, ARM / 2, 0),
      weight: facet(new THREE.CylinderGeometry(0.06, 0.085, 0.13, 4, 1).rotateY(Math.PI / 4), 0.004, 4),
      flash: new THREE.OctahedronGeometry(1, 0),
    }
  }, [])
  const onTap = { ...handlers, onClick: (e) => (tap.since(clock.elapsedTime) > 3.7 ? handlers.onClick(e) : e.stopPropagation()) }

  useFrame((_, dt) => {
    const t = clock.elapsedTime
    const s = tap.since(t)
    // the weight slides down (faster beat), holds, then slides back up
    const k = s < 0 ? 0 : ease(s / 0.45) * (1 - ease((s - 2.4) / 1.2))
    weight.current.position.y = 0.9 - 0.46 * k
    const S = st.current
    S.phase += Math.min(dt, 0.05) * BASE * (1 + 1.4 * k)
    swing.current.rotation.z = AMP * (1 - 0.15 * k) * Math.sin(S.phase)
    // a click at each end of the swing: note which end, and when
    const n = Math.floor((S.phase - Math.PI / 2) / Math.PI)
    if (n !== S.n) {
      S.n = n
      S.at[((n % 2) + 2) % 2] = t
    }
    let glow = 0
    flashes.current.forEach((m, i) => {
      const f = Math.exp(-(t - S.at[i]) * 9)
      glow = Math.max(glow, f)
      m.visible = f > 0.02
      m.scale.setScalar(Math.max(0.001, 0.11 * f))
      m.rotation.y = t * 4
    })
    // the knob on top lights up on every tick
    lamp.current.material.emissiveIntensity = 0.05 + glow * 1.6
    lamp.current.scale.setScalar(1 + glow * 0.35)
  })

  return (
    <group {...onTap}>
      <mesh geometry={geo.plinth}>
        <Flat color={L.trim} />
      </mesh>
      <mesh geometry={geo.body} position-y={B}>
        <Flat color={L.body} />
      </mesh>
      <group position-y={B + H}>
        <mesh geometry={geo.cap}>
          <Flat color={L.trim} />
        </mesh>
        <mesh ref={lamp} geometry={geo.knob} position-y={0.22}>
          <Flat color={L.arm} emissive={L.flash} metalness={0.4} roughness={0.35} />
        </mesh>
      </group>
      {/* the sloping front: scale, ticks and the swinging arm */}
      <group position={[0, B, W0]} rotation-x={-TILT}>
        <mesh geometry={geo.panel} position-z={-0.004}>
          <Flat color={L.panel} />
        </mesh>
        {Array.from({ length: 11 }, (_, i) => (
          <mesh key={i} geometry={geo.tick} position={[0, 0.58 + i * 0.065, 0.012]} scale-x={i % 2 ? 0.06 : 0.12}>
            <Flat color={L.tick} />
          </mesh>
        ))}
        <group position={[0, PIVOT, 0.045]}>
          <mesh geometry={geo.hub}>
            <Flat color={L.arm} metalness={0.4} roughness={0.35} />
          </mesh>
          <group ref={swing}>
            <mesh geometry={geo.arm}>
              <Flat color={L.arm} metalness={0.4} roughness={0.35} />
            </mesh>
            <mesh ref={weight} geometry={geo.weight} position-z={0.01}>
              <Flat color={L.weight} metalness={0.35} roughness={0.35} />
            </mesh>
            <mesh geometry={geo.knob} position-y={ARM} scale={0.7}>
              <Flat color={L.arm} metalness={0.4} roughness={0.35} />
            </mesh>
          </group>
          {/* the click flashes, at the arm's tip at each end of the swing */}
          {[1, -1].map((side, i) => (
            <mesh key={side} ref={(el) => (flashes.current[i] = el)} geometry={geo.flash} position={[-side * Math.sin(AMP) * ARM, Math.cos(AMP) * ARM, 0]} visible={false}>
              <meshBasicMaterial color={L.flash} toneMapped={false} />
            </mesh>
          ))}
        </group>
      </group>
    </group>
  )
}

export default function MetronomeScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[3, 2.2, 4.4]} target={[0, 0.85, 0]} hint="The arm ticks side to side on its own, with a little flash at each end · tap the metronome to slide the weight down and speed up the beat; it slides back and settles · Look swaps walnut, black and mint · drag to orbit">
      <Metronome {...props} />
    </Stage>
  )
}
