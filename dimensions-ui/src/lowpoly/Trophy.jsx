import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Burst, Flat, Ripple, Spin, Stage, TAU, pulse, useGeo, useTap } from './kit.jsx'

// A low-poly trophy cup: an eight-sided lathed bowl with a lip, two looped
// handles, a knopped stem and a two-step plinth with a name plate and a star
// on the front. It turns slowly on the spot and a gleam sweeps over the
// metal. Tap it and it whirls, flashes and throws a fountain of sparkles.

const METALS = {
  gold: { body: '#e9b13a', dark: '#b8821f', glow: '#ffe48a' },
  silver: { body: '#c9cfd8', dark: '#8d95a3', glow: '#ffffff' },
  bronze: { body: '#c67a45', dark: '#8f4f27', glow: '#ffc08f' },
  jade: { body: '#4fbf8f', dark: '#2a8a60', glow: '#b8ffe0' },
}
const PLINTH = '#2d2a36'

const BOWL = [
  [0, 0],
  [0.12, 0.02],
  [0.3, 0.14],
  [0.38, 0.34],
  [0.41, 0.52],
  [0.45, 0.56],
  [0.38, 0.54],
]

function starGeo(r) {
  const s = new THREE.Shape()
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU + Math.PI / 2
    const k = i % 2 ? r * 0.45 : r
    i ? s.lineTo(Math.cos(a) * k, Math.sin(a) * k) : s.moveTo(Math.cos(a) * k, Math.sin(a) * k)
  }
  return new THREE.ExtrudeGeometry(s, { depth: 0.02, bevelEnabled: false })
}

export function Trophy({ metal = 'gold' }) {
  const M = METALS[metal] || METALS.gold
  const { tap, handlers, clock } = useTap(1.6)
  const mats = useRef([])
  const geo = useGeo(
    () => ({
      bowl: new THREE.LatheGeometry(BOWL.map(([r, y]) => new THREE.Vector2(r, y)), 8),
      handle: new THREE.TorusGeometry(0.15, 0.035, 4, 8, Math.PI * 1.25),
      stem: new THREE.CylinderGeometry(0.05, 0.08, 0.3, 6, 1),
      knop: new THREE.OctahedronGeometry(0.09, 0),
      foot: new THREE.CylinderGeometry(0.12, 0.22, 0.08, 8, 1),
      step1: new THREE.BoxGeometry(0.62, 0.16, 0.62),
      step2: new THREE.BoxGeometry(0.5, 0.14, 0.5),
      plate: new THREE.BoxGeometry(0.3, 0.08, 0.01),
      star: starGeo(0.08),
      spark: new THREE.OctahedronGeometry(1, 0),
    }),
    [],
  )

  useFrame(() => {
    const t = clock.elapsedTime
    const k = tap.value(t)
    const e = 0.05 + pulse(t, 0.3) * 0.12 + k * 0.9
    mats.current.forEach((m) => m && (m.emissiveIntensity = e))
  })

  // plain materials (Flat cannot take a ref) so the gleam can drive them
  const metalMat = (i, color = M.body, extra) => <meshStandardMaterial ref={(m) => (mats.current[i] = m)} color={color} emissive={M.glow} flatShading metalness={0.45} roughness={0.38} {...extra} />

  return (
    <group {...handlers}>
      <mesh geometry={geo.step1} position-y={0.08}>
        <Flat color={PLINTH} />
      </mesh>
      <mesh geometry={geo.step2} position-y={0.23}>
        <Flat color="#3a3646" />
      </mesh>
      <mesh geometry={geo.plate} position={[0, 0.08, 0.316]}>
        {metalMat(0, M.dark)}
      </mesh>

      <Spin tap={tap} rate={0.5} boost={12} position-y={0.3}>
        <mesh geometry={geo.foot} position-y={0.04}>
          {metalMat(1, M.dark)}
        </mesh>
        <mesh geometry={geo.stem} position-y={0.23}>
          {metalMat(2)}
        </mesh>
        <mesh geometry={geo.knop} position-y={0.24} scale={[1, 0.6, 1]}>
          {metalMat(3, M.dark)}
        </mesh>
        <mesh geometry={geo.bowl} position-y={0.36}>
          {metalMat(4, M.body, { side: THREE.DoubleSide })}
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} geometry={geo.handle} position={[s * 0.4, 0.66, 0]} rotation={[0, s < 0 ? Math.PI : 0, -Math.PI * 0.62]}>
            {metalMat(s < 0 ? 5 : 6)}
          </mesh>
        ))}
        <mesh geometry={geo.star} position={[0, 0.66, 0.39]} rotation-x={-0.18}>
          {metalMat(7, M.glow)}
        </mesh>
      </Spin>

      <Burst tap={tap} geometry={geo.spark} count={18} colors={[M.glow, '#ffffff', M.body]} speed={1.7} gravity={2.6} size={0.045} life={1.3} origin={[0, 1.0, 0]} spread={0.8} up={1.4} />
      <Ripple tap={tap} color={M.body} radius={1.6} />
    </group>
  )
}

export default function TrophyScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[3, 2.2, 4]} target={[0, 0.6, 0]} hint="The cup turns and gleams on its own · tap it and it whirls, flashes and throws sparkles · Metal swaps gold, silver, bronze and jade · drag to orbit">
      <Trophy {...props} />
    </Stage>
  )
}
