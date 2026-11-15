import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Flat, Hinge, Particles, Stage, blob, facet, pulse, useGeo, useTap } from './kit.jsx'

// A low-poly cottage on a round of lawn: whitewashed walls, a steep pitched
// roof with deep eaves, a brick chimney, glowing windows with flower boxes,
// a front door on a hinge, a stepping-stone path, a picket fence and round
// bushes. Smoke curls from the chimney and the windows glow warmly. Tap it
// and the door swings open, spilling light, then shuts again.

const LOOKS = {
  storybook: { wall: '#f4ecd8', roof: '#c8423a', roof2: '#a8332c', trim: '#6e4a34', door: '#3f7f4a', lawn: '#7fbf52' },
  timber: { wall: '#c9a27a', roof: '#4a3a36', roof2: '#3a2c28', trim: '#3a2c26', door: '#8a3a2a', lawn: '#6fa84a' },
  snowy: { wall: '#e8d8c0', roof: '#f4f6fa', roof2: '#dfe6ef', trim: '#5c3c2a', door: '#c8423a', lawn: '#eef2f8' },
  blue: { wall: '#cfe2f2', roof: '#2f5d7a', roof2: '#244a62', trim: '#f4f1ea', door: '#f2c23a', lawn: '#7fbf52' },
}
const W = 0.9 // house width (x)
const D = 0.7 // house depth (z)
const WH = 0.55 // wall height
const RH = 0.45 // roof height
const OPEN = 2.6

function gable(w, h, d) {
  const s = new THREE.Shape()
  s.moveTo(-w / 2, 0)
  s.lineTo(w / 2, 0)
  s.lineTo(0, h)
  s.closePath()
  return new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false }).translate(0, 0, -d / 2)
}

export function Cottage({ look = 'storybook' }) {
  const L = LOOKS[look] || LOOKS.storybook
  const { tap, handlers, clock } = useTap(1)
  const windows = useRef([])
  const glow = useRef()

  const geo = useGeo(
    () => ({
      lawn: facet(new THREE.CylinderGeometry(1.4, 1.45, 0.06, 14, 1).translate(0, 0.03, 0), 0.03, 1, [1, 0.3, 1]),
      walls: new THREE.BoxGeometry(W, WH, D).translate(0, WH / 2, 0),
      gableEnd: gable(W, RH * 0.92, D),
      roof: new THREE.BoxGeometry(0.03, 1, D + 0.24),
      chimney: facet(new THREE.BoxGeometry(0.14, 0.42, 0.14), 0.006, 2),
      ccap: new THREE.BoxGeometry(0.18, 0.04, 0.18),
      door: new THREE.BoxGeometry(0.18, 0.3, 0.025).translate(0.09, 0.15, 0),
      frame: new THREE.BoxGeometry(0.22, 0.33, 0.02),
      window: new THREE.BoxGeometry(0.16, 0.16, 0.02),
      wframe: new THREE.BoxGeometry(0.2, 0.2, 0.015),
      mullion: new THREE.BoxGeometry(0.015, 0.16, 0.025),
      box: new THREE.BoxGeometry(0.2, 0.05, 0.06),
      flower: blob(0.03, 3, 0),
      stone: facet(new THREE.CylinderGeometry(0.08, 0.08, 0.025, 6, 1), 0.006, 4),
      picket: new THREE.BoxGeometry(0.035, 0.2, 0.02).translate(0, 0.1, 0),
      rail: new THREE.BoxGeometry(1, 0.025, 0.015),
      bush: blob(0.14, 5),
      puff: new THREE.IcosahedronGeometry(1, 0),
    }),
    [],
  )
  const isOpen = () => tap.since(clock.elapsedTime) < OPEN

  useFrame(() => {
    const t = clock.elapsedTime
    windows.current.forEach((w, i) => w && (w.material.emissiveIntensity = 0.5 + pulse(t, 0.3, i * 2) * 0.25))
    const s = tap.since(t)
    glow.current.intensity = s < OPEN ? Math.min(1, s * 4) * 2.2 : Math.max(0, 1 - (s - OPEN) * 3) * 2.2
  })

  // the pitch of each roof slope
  const slope = Math.atan2(RH, W / 2)
  const slopeLen = Math.hypot(RH, W / 2) + 0.12

  return (
    <group {...handlers}>
      <mesh geometry={geo.lawn}>
        <Flat color={L.lawn} />
      </mesh>
      {/* stepping stones up to the door */}
      {[0.55, 0.78, 1.0].map((z, i) => (
        <mesh key={z} geometry={geo.stone} position={[0.12 + (i % 2) * 0.05, 0.065, z]}>
          <Flat color="#b5aea4" />
        </mesh>
      ))}

      <group position-y={0.06}>
        <mesh geometry={geo.walls}>
          <Flat color={L.wall} />
        </mesh>
        <mesh geometry={geo.gableEnd} position-y={WH}>
          <Flat color={L.wall} />
        </mesh>
        {/* two roof slopes with deep eaves */}
        {[-1, 1].map((s) => (
          <mesh key={s} geometry={geo.roof} position={[s * (W / 4 + 0.03), WH + RH / 2 + 0.02, 0]} rotation-z={s * (Math.PI / 2 - slope)} scale={[1, slopeLen, 1]}>
            <Flat color={s < 0 ? L.roof : L.roof2} />
          </mesh>
        ))}
        <group position={[-0.24, WH + 0.25, -0.12]}>
          <mesh geometry={geo.chimney}>
            <Flat color="#a8553a" />
          </mesh>
          <mesh geometry={geo.ccap} position-y={0.22}>
            <Flat color="#7a3e2a" />
          </mesh>
        </group>

        {/* front: door on its hinge, a window either side */}
        <mesh geometry={geo.frame} position={[0.12, 0.165, D / 2 + 0.005]}>
          <Flat color={L.trim} />
        </mesh>
        <mesh position={[0.12, 0.155, D / 2 + 0.008]}>
          <boxGeometry args={[0.18, 0.3, 0.01]} />
          <Flat color="#ffd27a" emissive="#ffb84a" emissiveIntensity={1.2} />
        </mesh>
        <Hinge open={isOpen} axis="y" angle={-1.7} stiffness={70} damping={9} position={[0.03, 0.005, D / 2 + 0.022]}>
          <mesh geometry={geo.door}>
            <Flat color={L.door} />
          </mesh>
        </Hinge>
        <pointLight ref={glow} color="#ffb84a" distance={1.6} decay={2} position={[0.12, 0.2, D / 2 + 0.25]} intensity={0} />
        {[
          [-0.24, 0.32, D / 2 + 0.006, 0],
          [0.36, 0.34, D / 2 + 0.006, 0],
          [W / 2 + 0.006, 0.32, 0, Math.PI / 2],
          [-W / 2 - 0.006, 0.32, 0.05, -Math.PI / 2],
        ].map(([x, y, z, ry], i) => (
          <group key={i} position={[x, y, z]} rotation-y={ry}>
            <mesh geometry={geo.wframe}>
              <Flat color={L.trim} />
            </mesh>
            <mesh ref={(el) => (windows.current[i] = el)} geometry={geo.window} position-z={0.004}>
              <Flat color="#ffe08a" emissive="#ffb84a" emissiveIntensity={0.6} />
            </mesh>
            <mesh geometry={geo.mullion} position-z={0.008}>
              <Flat color={L.trim} />
            </mesh>
            <mesh geometry={geo.mullion} position-z={0.008} rotation-z={Math.PI / 2}>
              <Flat color={L.trim} />
            </mesh>
            {i < 2 && (
              <group position={[0, -0.13, 0.03]}>
                <mesh geometry={geo.box}>
                  <Flat color="#8a5a3a" />
                </mesh>
                {[-0.06, 0, 0.06].map((fx, j) => (
                  <mesh key={fx} geometry={geo.flower} position={[fx, 0.04, 0]}>
                    <Flat color={['#f27aa6', '#f6c22e', '#e3393f'][j]} />
                  </mesh>
                ))}
              </group>
            )}
          </group>
        ))}
      </group>

      {/* picket fence along the front */}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 0.68, 0.06, 0.95]}>
          {Array.from({ length: 6 }, (_, i) => (
            <mesh key={i} geometry={geo.picket} position-x={(i - 2.5) * 0.09}>
              <Flat color="#f4f1ea" />
            </mesh>
          ))}
          <mesh geometry={geo.rail} position-y={0.12} scale={[0.52, 1, 1]}>
            <Flat color="#f4f1ea" />
          </mesh>
        </group>
      ))}
      {[
        [-0.68, 0.55],
        [0.72, 0.5],
        [-0.75, -0.55],
      ].map(([x, z], i) => (
        <mesh key={i} geometry={geo.bush} position={[x, 0.14, z]} scale={[1.2, 0.9, 1]}>
          <Flat color={i % 2 ? '#4f8a42' : '#5f9a4a'} />
        </mesh>
      ))}

      <Particles geometry={geo.puff} count={12} life={3.4} origin={[-0.24, 0.06 + WH + 0.5, -0.12]} spread={0.03} velocity={[0.06, 0.32, 0]} scatter={0.06} drift={0.22} size={[0.04, 0.15]} colors={['#d8d8dc', '#c4c4cc']} opacity={[0.7, 0]} />
    </group>
  )
}

export default function CottageScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[3, 2.2, 4.2]} target={[0, 0.45, 0]} hint="Smoke curls from the chimney and the windows glow on their own · tap it and the door swings open, spilling light · Look swaps storybook, timber, snowy and blue · drag to orbit">
      <Cottage {...props} />
    </Stage>
  )
}
