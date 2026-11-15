import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Flat, Stage, cone, facet, pulse, useGeo, useTap } from './kit.jsx'

// A low-poly lantern hanging from a wooden post: a square iron frame with a
// pyramid cap and a ring, glowing panes and a flame inside that flickers and
// lights the post. Tap it and it swings on its hook and settles.

const FLAMES = {
  warm: { flame: '#ffb340', pane: '#ffd98a' },
  cool: { flame: '#7fd0ff', pane: '#c9ecff' },
  green: { flame: '#7af06a', pane: '#c8ffb8' },
  pink: { flame: '#ff6fb0', pane: '#ffc0dc' },
}
const IRON = '#2c2a33'
const WOOD = '#8a5a3a'
const HOOK = [0.55, 1.78, 0] // where the lantern hangs

export function Lantern({ flame = 'warm' }) {
  const F = FLAMES[flame] || FLAMES.warm
  const { tap, handlers, clock } = useTap(1)
  const swing = useRef()
  const core = useRef()
  const pane = useRef()
  const light = useRef()

  const geo = useGeo(
    () => ({
      post: facet(new THREE.CylinderGeometry(0.06, 0.08, 1.9, 5, 2).translate(0, 0.95, 0), 0.01, 1),
      foot: facet(new THREE.CylinderGeometry(0.18, 0.22, 0.1, 6, 1).translate(0, 0.05, 0), 0.01, 2),
      arm: facet(new THREE.BoxGeometry(0.66, 0.06, 0.07).translate(0.3, 0, 0), 0.006, 3),
      cap: cone(0.2, 0.16, 4, 4).rotateY(Math.PI / 4),
      base: new THREE.BoxGeometry(0.3, 0.06, 0.3),
      bar: new THREE.BoxGeometry(0.03, 0.34, 0.03),
      pane: new THREE.BoxGeometry(0.25, 0.32, 0.25),
      ring: new THREE.TorusGeometry(0.06, 0.014, 4, 8),
      core: facet(new THREE.OctahedronGeometry(0.07, 0).scale(1, 1.6, 1), 0.005, 5),
    }),
    [],
  )

  useFrame(() => {
    const t = clock.elapsedTime
    // a damped pendulum from the tap, and a slow drift otherwise
    const s = tap.since(t)
    const kick = s >= 0 ? Math.exp(-0.9 * s) * Math.sin(s * 3.6) : 0
    swing.current.rotation.z = Math.sin(t * 0.9) * 0.03 + kick * 0.5
    swing.current.rotation.x = Math.sin(t * 0.7 + 1) * 0.02 + kick * 0.12
    const f = 0.75 + 0.15 * Math.sin(t * 13) + 0.1 * Math.sin(t * 7.3 + 1) + pulse(t, 0.35) * 0.1
    core.current.scale.set(1, f, 1)
    core.current.material.emissiveIntensity = 1.6 * f
    pane.current.material.emissiveIntensity = 0.5 + 0.4 * f
    light.current.intensity = 2.2 * f
  })

  return (
    <group {...handlers}>
      <mesh geometry={geo.foot}>
        <Flat color="#6e452b" />
      </mesh>
      <mesh geometry={geo.post}>
        <Flat color={WOOD} />
      </mesh>
      <mesh geometry={geo.arm} position={[0, 1.84, 0]}>
        <Flat color={WOOD} />
      </mesh>

      <group ref={swing} position={HOOK}>
        <mesh geometry={geo.ring} position-y={-0.02}>
          <Flat color={IRON} metalness={0.4} roughness={0.5} />
        </mesh>
        <group position-y={-0.5}>
          <mesh geometry={geo.cap} position-y={0.2}>
            <Flat color={IRON} metalness={0.3} roughness={0.55} />
          </mesh>
          <mesh geometry={geo.base} position-y={0.18}>
            <Flat color={IRON} />
          </mesh>
          <mesh geometry={geo.base} position-y={-0.18}>
            <Flat color={IRON} />
          </mesh>
          {[
            [-1, -1],
            [-1, 1],
            [1, -1],
            [1, 1],
          ].map(([x, z]) => (
            <mesh key={`${x}${z}`} geometry={geo.bar} position={[x * 0.13, 0, z * 0.13]}>
              <Flat color={IRON} />
            </mesh>
          ))}
          <mesh ref={pane} geometry={geo.pane}>
            <meshStandardMaterial color={F.pane} emissive={F.pane} transparent opacity={0.55} roughness={0.3} flatShading depthWrite={false} />
          </mesh>
          <mesh ref={core} geometry={geo.core} position-y={-0.04}>
            <Flat color={F.flame} emissive={F.flame} />
          </mesh>
          <pointLight ref={light} color={F.flame} distance={3.5} decay={2} position-y={-0.02} />
        </group>
      </group>
    </group>
  )
}

export default function LanternScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[3.6, 2.4, 4.8]} target={[0.2, 1.05, 0]} hint="The flame flickers and the lantern drifts on its own · tap it and it swings on its hook · Flame swaps warm, cool, green and pink · drag to orbit">
      <Lantern {...props} />
    </Stage>
  )
}
