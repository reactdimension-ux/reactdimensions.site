import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Flat, Stage, TAU, facet, useGeo, useTap } from './kit.jsx'

// A low-poly instant camera: a chunky body with a striped front, a lens in
// stepped rings with a six-blade iris behind the glass, a flash window, a
// viewfinder, a shutter button and a slot for the prints. The iris breathes
// open and shut as if metering the light, and a ready lamp blinks. Tap it
// to take a picture: the button goes down, the iris snaps, the flash fires
// and lights the floor, the body kicks, and a print slides out of the slot,
// tips and drops, its picture fading in.

const BODIES = {
  classic: { body: '#2c2a33', face: '#f4f1ea', ring: '#3a3846', trim: '#c9ced8' },
  retro: { body: '#f2e6c8', face: '#6e4a34', ring: '#8a5a3a', trim: '#e8743a' },
  mint: { body: '#9fe0c8', face: '#f4f1ea', ring: '#2f5d7a', trim: '#2f5d7a' },
  coral: { body: '#f27a6a', face: '#fbe9d8', ring: '#3a3846', trim: '#f6c93a' },
}
const STRIPES = ['#e3393f', '#f28c38', '#f6c93a', '#5cc25e', '#3d8de0']
const SCENES = [
  ['#7fc8f0', '#f6d24a', '#5cc25e'],
  ['#f2a6c4', '#fff1b0', '#8350c8'],
  ['#3d8de0', '#ffffff', '#2f5d7a'],
  ['#f2814a', '#ffd84a', '#7a2a6e'],
]
const BW = 0.86
const BH = 0.6
const BD = 0.5
const LENS = [0.12, 0.0, BD / 2]

export function InstantCamera({ body = 'classic' }) {
  const C = BODIES[body] || BODIES.classic
  const { tap, handlers, clock } = useTap(1)
  const cam = useRef()
  const button = useRef()
  const blades = useRef([])
  const flash = useRef()
  const flashLight = useRef()
  const lamp = useRef()
  const print = useRef()
  const picture = useRef([])
  const [shot, setShot] = useState(0)

  const geo = useGeo(
    () => ({
      body: facet(new THREE.BoxGeometry(BW, BH, BD, 2, 2, 2), 0.006, 1),
      top: facet(new THREE.BoxGeometry(BW * 0.98, 0.1, BD * 0.8), 0.004, 2),
      stripe: new THREE.BoxGeometry(0.035, BH * 0.62, 0.012),
      ring1: new THREE.CylinderGeometry(0.21, 0.23, 0.06, 12, 1).rotateX(Math.PI / 2),
      ring2: new THREE.CylinderGeometry(0.17, 0.19, 0.07, 12, 1).rotateX(Math.PI / 2),
      ring3: new THREE.CylinderGeometry(0.13, 0.15, 0.05, 12, 1).rotateX(Math.PI / 2),
      glass: new THREE.CircleGeometry(0.115, 12),
      dark: new THREE.CircleGeometry(0.12, 12),
      blade: (() => {
        const s = new THREE.Shape()
        s.moveTo(0, 0)
        s.lineTo(0.12, 0.015)
        s.lineTo(0.1, 0.07)
        s.closePath()
        return new THREE.ShapeGeometry(s)
      })(),
      flash: new THREE.BoxGeometry(0.2, 0.09, 0.02),
      finder: new THREE.BoxGeometry(0.13, 0.09, 0.12),
      button: new THREE.CylinderGeometry(0.045, 0.05, 0.035, 8, 1),
      lamp: new THREE.SphereGeometry(0.014, 6, 4),
      slot: new THREE.BoxGeometry(0.5, 0.02, 0.03),
      card: new THREE.BoxGeometry(0.4, 0.004, 0.46),
      lug: new THREE.TorusGeometry(0.03, 0.01, 4, 6),
    }),
    [],
  )

  useFrame(() => {
    const t = clock.elapsedTime
    const s = tap.since(t)
    // iris: metering in slow breaths, snapping shut for the exposure
    const snap = s >= 0.05 && s < 0.3 ? Math.sin(((s - 0.05) / 0.25) * Math.PI) : 0
    const open = Math.max(0, 0.55 + 0.3 * Math.sin(t * 0.8) - snap)
    blades.current.forEach((b, i) => b && (b.rotation.z = (i / 6) * TAU + 0.9 - open * 0.9))
    button.current.position.y = BH / 2 + 0.06 - (s >= 0 && s < 0.25 ? 0.02 : 0)
    const f = s >= 0.08 && s < 0.3 ? 1 - (s - 0.08) / 0.22 : 0
    flash.current.material.emissiveIntensity = 0.2 + f * 6
    flashLight.current.intensity = f * 12
    cam.current.rotation.x = s >= 0 && s < 0.5 ? -Math.sin((s / 0.5) * Math.PI) * 0.05 : Math.sin(t * 0.6) * 0.02
    lamp.current.material.emissiveIntensity = t % 1.6 < 0.2 ? 2 : 0.2
    // the print: out of the slot, tips over the edge, drops and develops
    const p = print.current
    p.visible = s >= 0.35 && s < 7
    if (p.visible) {
      const u = s - 0.35
      const out = Math.min(1, u / 0.9)
      const drop = Math.max(0, u - 0.9)
      const fall = Math.min(drop, 0.45)
      const y = -BH / 2 + 0.01 - 2.6 * fall * fall
      p.position.set(-0.08, Math.max(-BH / 2 - 0.115, y), BD / 2 + out * 0.3 + fall * 0.35)
      // it tips as it slides off the slot and lands flat on the floor
      p.rotation.x = drop < 0.45 ? Math.sin((drop / 0.45) * Math.PI) * 0.6 : 0
      const dev = Math.min(1, Math.max(0, (u - 1.4) / 3))
      picture.current.forEach((m) => m && (m.material.opacity = dev))
    }
  })

  const scene = SCENES[shot % SCENES.length]
  return (
    <group
      {...handlers}
      onClick={(e) => {
        handlers.onClick(e)
        setShot((n) => n + 1)
      }}
    >
      <group ref={cam} position-y={BH / 2 + 0.12}>
        <mesh geometry={geo.body}>
          <Flat color={C.body} />
        </mesh>
        <mesh geometry={geo.top} position={[0, BH / 2 + 0.03, -0.03]}>
          <Flat color={C.body} />
        </mesh>
        {/* the face plate and its rainbow stripe */}
        <mesh position={[0, -0.02, BD / 2 + 0.004]}>
          <boxGeometry args={[BW * 0.92, BH * 0.8, 0.01]} />
          <Flat color={C.face} />
        </mesh>
        {STRIPES.map((c, i) => (
          <mesh key={i} geometry={geo.stripe} position={[-0.3 + i * 0.035, -0.04, BD / 2 + 0.012]}>
            <Flat color={c} />
          </mesh>
        ))}
        {/* lens and iris */}
        <group position={LENS}>
          <mesh geometry={geo.ring1} position-z={0.03}>
            <Flat color={C.ring} />
          </mesh>
          <mesh geometry={geo.ring2} position-z={0.09}>
            <Flat color={C.trim} metalness={0.4} roughness={0.4} />
          </mesh>
          <mesh geometry={geo.ring3} position-z={0.14}>
            <Flat color={C.ring} />
          </mesh>
          <mesh geometry={geo.dark} position-z={0.15}>
            <Flat color="#0e0e14" />
          </mesh>
          {Array.from({ length: 6 }, (_, i) => (
            <mesh key={i} ref={(el) => (blades.current[i] = el)} geometry={geo.blade} position-z={0.155 + i * 0.001}>
              <Flat color="#3a3846" metalness={0.5} roughness={0.4} side={THREE.DoubleSide} />
            </mesh>
          ))}
          <mesh geometry={geo.glass} position-z={0.168}>
            <meshStandardMaterial color="#9fd0ff" transparent opacity={0.3} roughness={0.05} metalness={0.3} flatShading />
          </mesh>
        </group>
        <mesh ref={flash} geometry={geo.flash} position={[-0.22, 0.2, BD / 2 + 0.012]}>
          <Flat color="#f4f6fa" emissive="#ffffff" emissiveIntensity={0.2} />
        </mesh>
        <pointLight ref={flashLight} color="#ffffff" distance={4} decay={1.5} position={[-0.22, 0.2, BD / 2 + 0.3]} intensity={0} />
        <mesh geometry={geo.finder} position={[0.28, BH / 2 + 0.08, 0.08]}>
          <Flat color={C.ring} />
        </mesh>
        <mesh ref={button} geometry={geo.button} position={[-0.3, BH / 2 + 0.06, 0.1]}>
          <Flat color={C.trim} />
        </mesh>
        <mesh ref={lamp} geometry={geo.lamp} position={[0.32, 0.22, BD / 2 + 0.012]}>
          <Flat color="#5cff7a" emissive="#5cff7a" emissiveIntensity={0.2} />
        </mesh>
        <mesh geometry={geo.slot} position={[-0.08, -BH / 2 + 0.03, BD / 2 + 0.005]}>
          <Flat color="#0e0e14" />
        </mesh>
        {[-1, 1].map((x) => (
          <mesh key={x} geometry={geo.lug} position={[x * (BW / 2 + 0.02), 0.18, 0]} rotation-y={Math.PI / 2}>
            <Flat color={C.trim} />
          </mesh>
        ))}

        {/* the print */}
        <group ref={print} visible={false}>
          <mesh geometry={geo.card}>
            <Flat color="#fbfaf6" />
          </mesh>
          <group position={[0, 0.004, -0.03]}>
            <mesh rotation-x={-Math.PI / 2}>
              <planeGeometry args={[0.32, 0.32]} />
              <meshBasicMaterial color="#2c2a33" side={THREE.DoubleSide} />
            </mesh>
            {[
              [scene[0], 0.32, 0.2, 0.06],
              [scene[2], 0.32, 0.12, -0.1],
            ].map(([c, w, h, z], i) => (
              <mesh key={i} ref={(el) => (picture.current[i] = el)} position={[0, 0.001 + i * 0.0005, z]} rotation-x={-Math.PI / 2}>
                <planeGeometry args={[w, h]} />
                <meshBasicMaterial color={c} transparent opacity={0} />
              </mesh>
            ))}
            <mesh ref={(el) => (picture.current[2] = el)} position={[0.08, 0.002, -0.06]} rotation-x={-Math.PI / 2}>
              <circleGeometry args={[0.045, 8]} />
              <meshBasicMaterial color={scene[1]} transparent opacity={0} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  )
}

export default function InstantCameraScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[2.2, 1.5, 3.4]} target={[0, 0.4, 0]} hint="The iris breathes as if metering and the ready lamp blinks on their own · tap it to take a picture: the iris snaps, the flash fires and a print slides out and develops · Body swaps classic, retro, mint and coral · drag to orbit">
      <InstantCamera {...props} />
    </Stage>
  )
}
