import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Burst, Flat, Ripple, Spin, Stage, TAU, pulse, useGeo, useTap } from './kit.jsx'

// A plump low-poly star: a five-point outline extruded with a single bevel,
// so each arm has a ridge and two flat faces. It spins slowly on its axis and
// shimmers. Tap it and it whirls and bursts into a spray of little stars.

const COLORS = {
  gold: { body: '#f2b632', glow: '#ffe28a', metal: 0.35 },
  silver: { body: '#c9ced8', glow: '#ffffff', metal: 0.45 },
  rose: { body: '#f08aa0', glow: '#ffd0da', metal: 0.25 },
  mint: { body: '#5ad6b0', glow: '#bff5e4', metal: 0.2 },
}

function starGeo(outer, inner, depth) {
  const s = new THREE.Shape()
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? inner : outer
    const a = (i / 10) * TAU + Math.PI / 2
    const x = Math.cos(a) * r
    const y = Math.sin(a) * r
    i ? s.lineTo(x, y) : s.moveTo(x, y)
  }
  s.closePath()
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: depth * 0.9, bevelSize: inner * 0.35, bevelSegments: 1 })
  g.center()
  return g
}

export function Star({ color = 'gold', spin = 0.6 }) {
  const C = COLORS[color] || COLORS.gold
  const { tap, handlers, clock } = useTap(1.6)
  const body = useRef()
  const geo = useGeo(() => ({ star: starGeo(0.68, 0.3, 0.12), mini: starGeo(1, 0.45, 0.25) }), [])

  useFrame(() => {
    const t = clock.elapsedTime
    const k = tap.value(t)
    body.current.material.emissiveIntensity = 0.08 + pulse(t, 0.7) * 0.18 + k * 0.9
    body.current.rotation.z = Math.sin(t * 0.6) * 0.12
    const s = 1 + k * 0.18
    body.current.scale.setScalar(s)
  })

  return (
    <group {...handlers}>
      <Spin tap={tap} rate={spin} boost={14} position={[0, 0.95, 0]}>
        <mesh ref={body} geometry={geo.star}>
          <Flat color={C.body} emissive={C.glow} roughness={0.42} metalness={C.metal} />
        </mesh>
      </Spin>
      <Burst tap={tap} geometry={geo.mini} count={14} colors={[C.body, C.glow, '#ffffff']} speed={2.3} gravity={2.4} size={0.075} life={1.25} origin={[0, 0.95, 0]} />
      <Ripple tap={tap} color={C.body} radius={1.7} />
    </group>
  )
}

export default function StarScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} target={[0, 0.9, 0]} hint="The star spins and shimmers on its own · tap it and it whirls and bursts into little stars · Spin sets the turn rate · Color swaps gold, silver, rose and mint · drag to orbit">
      <Star {...props} />
    </Stage>
  )
}
