import { useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useCursor } from '@react-three/drei'
import * as THREE from 'three'
import { Flat, Stage, facet, useGeo, useKick } from './kit.jsx'

// A low-poly boulder with a cluster of crystals growing out of its foot:
// a lumpy grey rock, a couple of small stones beside it, a sprig of grass,
// and six-sided crystals with pointed tips that glow, each pulsing on its own
// beat. A loose shard floats and turns above them. Tap it and the crystals
// flare and pop, and the shard spins.

const CRYSTALS = {
  aqua: { body: '#3fc8da', glow: '#19a7c4' },
  amethyst: { body: '#a46ae0', glow: '#7a3ad0' },
  ruby: { body: '#e2465f', glow: '#c41c3c' },
  citrine: { body: '#f2c443', glow: '#d99a12' },
}

// six-sided crystal: a prism with a pyramid tip, base at y = 0
const crystal = (r, h) => new THREE.LatheGeometry([new THREE.Vector2(0, 0), new THREE.Vector2(r, 0), new THREE.Vector2(r * 1.05, h), new THREE.Vector2(0, h + r * 1.6)], 6)

// [x, y, z, radius, height, tilt about z, tilt about x]
const CLUSTER = [
  [0.62, 0, 0.42, 0.11, 0.55, -0.35, 0.25],
  [0.8, 0, 0.3, 0.09, 0.38, -0.75, 0.1],
  [0.5, 0, 0.6, 0.075, 0.3, -0.1, 0.6],
  [0.78, 0, 0.56, 0.07, 0.26, -0.6, 0.55],
  [0.92, 0, 0.12, 0.06, 0.22, -1.0, -0.2],
]

export function CrystalRock({ crystal: kind = 'aqua' }) {
  const K = CRYSTALS[kind] || CRYSTALS.aqua
  const clock = useThree((s) => s.clock)
  const [hover, setHover] = useState(false)
  useCursor(hover)
  const flare = useKick(1.8)
  const mats = useRef([])
  const groups = useRef([])
  const shard = useRef()
  const light = useRef()

  const geo = useGeo(
    () => ({
      rock: facet(new THREE.IcosahedronGeometry(0.78, 1), 0.13, 7),
      stone: facet(new THREE.IcosahedronGeometry(0.2, 0), 0.04, 8),
      crystals: CLUSTER.map(([, , , r, h]) => crystal(r, h)),
      shard: new THREE.OctahedronGeometry(0.09, 0).scale(0.7, 1.6, 0.7),
      blade: new THREE.ConeGeometry(0.04, 0.32, 4, 1).translate(0, 0.16, 0),
    }),
    [],
  )

  useFrame(() => {
    const t = clock.elapsedTime
    const k = flare.value(t)
    const since = flare.since(t)
    mats.current.forEach((m, i) => {
      if (!m) return
      m.emissiveIntensity = 0.35 + (Math.sin(t * 1.6 + i * 1.3) * 0.5 + 0.5) * 0.45 + k * 2.2
    })
    groups.current.forEach((g, i) => {
      if (!g) return
      const pop = since < 1.2 ? Math.max(0, Math.sin((since - i * 0.06) * 12)) * k * 0.25 : 0
      g.scale.setScalar(1 + pop)
    })
    shard.current.position.y = 1.35 + Math.sin(t * 1.4) * 0.08
    shard.current.rotation.y = t * 0.9 + spin(since)
    shard.current.material.emissiveIntensity = 0.6 + Math.sin(t * 2.2) * 0.25 + k * 2
    light.current.intensity = 0.8 + Math.sin(t * 1.6) * 0.25 + k * 3
  })

  return (
    <group
      onClick={(e) => {
        e.stopPropagation()
        flare.kick(clock.elapsedTime)
      }}
      onPointerOver={(e) => (e.stopPropagation(), setHover(true))}
      onPointerOut={() => setHover(false)}
    >
      <mesh geometry={geo.rock} position={[-0.08, 0.6, -0.1]} scale={[1.05, 0.95, 0.85]} rotation-y={0.4}>
        <Flat color="#6d6c7b" />
      </mesh>
      <mesh geometry={geo.stone} position={[-0.55, 0.1, 0.55]} scale={[1.1, 0.7, 1]} rotation-y={0.6}>
        <Flat color="#5d5c69" />
      </mesh>
      <mesh geometry={geo.stone} position={[-0.2, 0.07, 0.72]} scale={[0.7, 0.55, 0.7]}>
        <Flat color="#7b7a88" />
      </mesh>
      {/* a sprig of grass at the rock's foot */}
      {[-0.35, 0, 0.35].map((a, i) => (
        <mesh key={i} geometry={geo.blade} position={[-0.75, 0, 0.32]} rotation={[a * 0.6, 0, a]} scale={[1, 0.8 + i * 0.25, 1]}>
          <Flat color={i === 1 ? '#3f8f3a' : '#5aa845'} />
        </mesh>
      ))}
      {/* the crystals, each pulsing on its own beat */}
      {CLUSTER.map(([x, y, z, , , rz, rx], i) => (
        <group key={i} ref={(g) => (groups.current[i] = g)} position={[x, y, z]} rotation={[rx, 0, rz]}>
          <mesh geometry={geo.crystals[i]}>
            <meshStandardMaterial ref={(m) => (mats.current[i] = m)} color={K.body} emissive={K.glow} emissiveIntensity={0.5} flatShading roughness={0.25} metalness={0.05} />
          </mesh>
        </group>
      ))}
      <pointLight ref={light} position={[0.75, 0.45, 0.7]} color={K.body} distance={2.5} decay={2} />
      {/* a loose shard floating above */}
      <mesh ref={shard} geometry={geo.shard} position={[0.62, 1.35, 0.42]}>
        <meshStandardMaterial color={K.body} emissive={K.glow} emissiveIntensity={0.6} flatShading roughness={0.25} />
      </mesh>
    </group>
  )
}

// a fast turn that winds down after a tap
function spin(since) {
  return since < 3 ? (1 - Math.exp(-2.2 * since)) * Math.PI * 4 : Math.PI * 4 * (1 - Math.exp(-6.6))
}

export default function CrystalRockScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} target={[0.1, 0.65, 0.1]} hint="The crystals glow, each pulsing on its own beat, with a loose shard floating above · tap and they flare and pop, and the shard spins · Crystal changes the stone · drag to orbit">
      <CrystalRock {...props} />
    </Stage>
  )
}
