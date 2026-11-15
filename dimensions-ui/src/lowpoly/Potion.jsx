import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Burst, Flat, Liquid, Particles, Stage, facet, useGeo, useTap, wobble } from './kit.jsx'

// A low-poly potion: a round-bellied glass flask with a long neck, a cork
// and a parchment tag, half full of a glowing brew with bubbles rising
// through it. The bottle sways, and the brew stays level in the world and
// sloshes: its surface is a damped pendulum driven by how the bottle moves.
// Tap it and it is given a shake: the brew sloshes hard, fizzes, the cork
// pops and sparkles fly.

const BREWS = {
  health: { brew: '#e3393f', top: '#ff8a8a', glow: '#ff5a5a' },
  mana: { brew: '#3d7fe0', top: '#8fc0ff', glow: '#5a9aff' },
  poison: { brew: '#5ac74a', top: '#b8f08a', glow: '#7af06a' },
  love: { brew: '#f27aa6', top: '#ffc2d8', glow: '#ff8ac0' },
}
const FLASK = [
  [0.001, 0],
  [0.1, 0.005],
  [0.2, 0.05],
  [0.27, 0.15],
  [0.28, 0.26],
  [0.24, 0.37],
  [0.15, 0.45],
  [0.075, 0.5],
  [0.07, 0.66],
  [0.085, 0.68],
  [0.085, 0.72],
  [0.07, 0.72],
]
const BREW = [
  [0, 0.012],
  [0.09, 0.016],
  [0.185, 0.056],
  [0.25, 0.15],
  [0.26, 0.26],
  [0.22, 0.36],
  [0.135, 0.44],
  [0.064, 0.49],
  [0.06, 0.62],
  [0, 0.62],
]

export function Potion({ brew = 'health', fill = 0.55 }) {
  const C = BREWS[brew] || BREWS.health
  const { tap, handlers, clock } = useTap(0.7)
  const bottle = useRef()
  const cork = useRef()
  const glow = useRef()

  const geo = useGeo(
    () => ({
      glass: new THREE.LatheGeometry(FLASK.map(([r, y]) => new THREE.Vector2(r, y)), 12),
      cork: facet(new THREE.CylinderGeometry(0.075, 0.062, 0.11, 7, 1), 0.004, 1),
      tag: new THREE.BoxGeometry(0.1, 0.07, 0.006),
      string: new THREE.TorusGeometry(0.075, 0.005, 3, 10).rotateX(Math.PI / 2),
      spark: new THREE.OctahedronGeometry(1, 0),
    }),
    [],
  )
  const fizz = () => (tap.since(clock.elapsedTime) < 3 ? 1 : 0.4)

  useFrame(() => {
    const t = clock.elapsedTime
    const s = tap.since(t)
    const w = wobble(s, 13, 2.2)
    bottle.current.rotation.z = Math.sin(t * 0.9) * 0.1 + w * 0.45
    bottle.current.rotation.x = Math.sin(t * 0.7 + 1) * 0.06 + wobble(s - 0.05, 11, 2.2) * 0.2
    bottle.current.position.x = w * 0.08
    // the cork pops up and drops back in
    const pop = s >= 0.2 && s < 1 ? Math.max(0, Math.sin(((s - 0.2) / 0.8) * Math.PI)) * 0.22 : 0
    cork.current.position.y = 0.73 + pop
    cork.current.rotation.z = pop * 2
    glow.current.intensity = 1.2 + Math.sin(t * 2) * 0.2 + tap.value(t) * 1.5
  })

  return (
    <group {...handlers}>
      <group ref={bottle}>
        <Liquid profile={BREW} fill={fill} color={C.brew} surface={C.top} opacity={0.96} emissive={0.2} slosh={1.4} />
        <Particles count={14} life={1.1} origin={[0, 0.05, 0]} spread={0.12} velocity={[0, 0.22, 0]} scatter={0.03} drift={0.03} size={[0.012, 0.022]} colors={[C.top, '#ffffff']} opacity={[0.9, 0.3]} emissive={0.8} active={fizz} />
        <mesh geometry={geo.glass} renderOrder={2}>
          <meshStandardMaterial color="#e6f6ff" flatShading roughness={0.08} metalness={0.1} transparent opacity={0.16} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
        <mesh ref={cork} geometry={geo.cork} position-y={0.73}>
          <Flat color="#b5895a" />
        </mesh>
        <mesh geometry={geo.string} position-y={0.58}>
          <Flat color="#d9c39a" />
        </mesh>
        <mesh geometry={geo.tag} position={[0.1, 0.5, 0.1]} rotation={[0.1, 0.8, -0.3]}>
          <Flat color="#f2e6c8" />
        </mesh>
        <pointLight ref={glow} color={C.glow} distance={2} decay={2} position-y={0.2} />
      </group>
      <Burst tap={tap} geometry={geo.spark} count={14} colors={[C.top, '#ffffff', C.glow]} speed={1.5} gravity={1.5} size={0.025} life={1.2} origin={[0, 0.8, 0]} up={1.4} />
    </group>
  )
}

export default function PotionScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[2.2, 1.4, 3]} target={[0, 0.38, 0]} hint="The bottle sways and the brew stays level and sloshes, its surface driven by how the bottle moves · tap it to shake it: it sloshes, fizzes and the cork pops · Fill sets how full it is · Brew swaps health, mana, poison and love · drag to orbit">
      <Potion {...props} />
    </Stage>
  )
}
