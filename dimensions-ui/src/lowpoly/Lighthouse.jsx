import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Beam, Flat, Ripple, Stage, TAU, blob, cone, facet, useGeo, useTap } from './kit.jsx'

// A low-poly lighthouse on a rocky islet in a pool of sea: a tapering
// striped tower with a door and portholes, a railed gallery, a glowing
// lantern room and a domed cap. Twin beams sweep round, and rings spread
// over the water. Tap it and the lamp flashes and a wave rolls out.

const STYLES = {
  classic: { a: '#e8434b', b: '#f6f3ec', cap: '#2c2a33' },
  blue: { a: '#2f6fd0', b: '#f6f3ec', cap: '#1f2a44' },
  black: { a: '#2c2a33', b: '#f6f3ec', cap: '#c8423a' },
  mint: { a: '#5ac7a6', b: '#fdf6e6', cap: '#2f5d7a' },
}
const STRIPES = 4
const BASE_Y = 0.24
const TOWER_H = 1.2
const R_BOT = 0.3
const R_TOP = 0.2
const radiusAt = (u) => R_BOT + (R_TOP - R_BOT) * u

export function Lighthouse({ look = 'classic', speed = 0.35 }) {
  const S = STYLES[look] || STYLES.classic
  const { tap, handlers, clock } = useTap(2.5)
  const sweep = useRef()
  const glass = useRef()
  const beams = useRef([])
  const light = useRef()

  const geo = useGeo(
    () => ({
      sea: facet(new THREE.CylinderGeometry(1.25, 1.25, 0.06, 14, 1).translate(0, 0.03, 0), 0.015, 1, [1, 0.6, 1]),
      rock: blob(0.3, 2),
      stripes: Array.from({ length: STRIPES }, (_, i) => {
        const h = TOWER_H / STRIPES
        return new THREE.CylinderGeometry(radiusAt((i + 1) / STRIPES), radiusAt(i / STRIPES), h, 8, 1).translate(0, h / 2, 0)
      }),
      gallery: new THREE.CylinderGeometry(0.31, 0.27, 0.06, 10, 1),
      rail: new THREE.TorusGeometry(0.29, 0.012, 3, 10).rotateX(Math.PI / 2),
      post: new THREE.BoxGeometry(0.015, 0.12, 0.015),
      glass: new THREE.CylinderGeometry(0.15, 0.15, 0.22, 8, 1),
      frame: new THREE.BoxGeometry(0.02, 0.22, 0.02),
      dome: facet(new THREE.SphereGeometry(0.18, 8, 3, 0, TAU, 0, Math.PI / 2), 0.004, 3),
      finial: cone(0.025, 0.12, 4, 4),
      door: new THREE.BoxGeometry(0.12, 0.2, 0.04),
      port: new THREE.CylinderGeometry(0.035, 0.035, 0.03, 6, 1).rotateX(Math.PI / 2),
    }),
    [],
  )

  useFrame((_, dt) => {
    const t = clock.elapsedTime
    const k = tap.value(t)
    sweep.current.rotation.y += Math.min(dt, 0.05) * speed * TAU
    glass.current.material.emissiveIntensity = 0.9 + k * 2
    beams.current.forEach((b) => b && (b.material.opacity = 0.32 + k * 0.5))
    light.current.intensity = 1.5 + k * 4
  })

  const top = BASE_Y + TOWER_H

  return (
    <group {...handlers}>
      <mesh geometry={geo.sea}>
        <Flat color="#4aa3d8" roughness={0.35} />
      </mesh>
      <Ripple loop period={3} count={3} color="#ffffff" radius={1.1} opacity={0.4} y={0.065} />
      <Ripple tap={tap} color="#ffffff" count={2} radius={1.4} y={0.07} />
      {[
        [0, 0.12, 0, 1.5, 0.7, 1.4],
        [0.35, 0.08, 0.2, 0.8, 0.55, 0.8],
        [-0.33, 0.07, 0.15, 0.7, 0.5, 0.9],
        [0.1, 0.07, -0.38, 0.8, 0.45, 0.7],
      ].map(([x, y, z, sx, sy, sz], i) => (
        <mesh key={i} geometry={geo.rock} position={[x, y, z]} scale={[sx, sy, sz]}>
          <Flat color={i % 2 ? '#7d7a76' : '#93908a'} />
        </mesh>
      ))}

      {/* striped tower */}
      {geo.stripes.map((g, i) => (
        <mesh key={i} geometry={g} position-y={BASE_Y + (i * TOWER_H) / STRIPES}>
          <Flat color={i % 2 ? S.b : S.a} />
        </mesh>
      ))}
      <mesh geometry={geo.door} position={[0, BASE_Y + 0.1, R_BOT - 0.005]} rotation-x={-0.08}>
        <Flat color={S.cap} />
      </mesh>
      {[0.45, 0.8].map((u) => (
        <mesh key={u} geometry={geo.port} position={[0, BASE_Y + u * TOWER_H, radiusAt(u) - 0.005]}>
          <Flat color="#3a4a5c" roughness={0.3} />
        </mesh>
      ))}

      {/* gallery, lantern room and cap */}
      <group position-y={top}>
        <mesh geometry={geo.gallery} position-y={0.03}>
          <Flat color={S.cap} />
        </mesh>
        <mesh geometry={geo.rail} position-y={0.17}>
          <Flat color={S.cap} />
        </mesh>
        {Array.from({ length: 10 }, (_, i) => {
          const a = (i / 10) * TAU
          return (
            <mesh key={i} geometry={geo.post} position={[Math.cos(a) * 0.29, 0.12, Math.sin(a) * 0.29]}>
              <Flat color={S.cap} />
            </mesh>
          )
        })}
        <mesh ref={glass} geometry={geo.glass} position-y={0.17}>
          <Flat color="#fff3b0" emissive="#ffd860" roughness={0.3} />
        </mesh>
        {Array.from({ length: 4 }, (_, i) => {
          const a = (i / 4) * TAU + Math.PI / 8
          return (
            <mesh key={i} geometry={geo.frame} position={[Math.cos(a) * 0.15, 0.17, Math.sin(a) * 0.15]}>
              <Flat color={S.cap} />
            </mesh>
          )
        })}
        <mesh geometry={geo.dome} position-y={0.28}>
          <Flat color={S.cap} />
        </mesh>
        <mesh geometry={geo.finial} position-y={0.45}>
          <Flat color={S.cap} />
        </mesh>
        <pointLight ref={light} color="#ffd860" distance={3} decay={2} position-y={0.17} />

        {/* twin beams sweeping round */}
        <group ref={sweep} position-y={0.17}>
          {[0, Math.PI].map((ry, i) => (
            <Beam key={i} ref={(el) => (beams.current[i] = el)} rotation-y={ry} length={2.4} radius={0.32} color="#ffc93a" opacity={0.16} />
          ))}
        </group>
      </group>
    </group>
  )
}

export default function LighthouseScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[3.6, 2.4, 4.8]} target={[0, 0.85, 0]} hint="The beams sweep round and rings spread over the sea on their own · tap it and the lamp flashes and a wave rolls out · Speed sets the sweep · Look swaps classic, blue, black and mint · drag to orbit">
      <Lighthouse {...props} />
    </Stage>
  )
}
