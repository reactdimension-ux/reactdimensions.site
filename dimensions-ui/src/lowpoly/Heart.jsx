import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Burst, Flat, Ripple, Stage, facet, useGeo, useTap } from './kit.jsx'

// A chunky low-poly heart: a heart outline extruded with a single bevel and
// only a few points on each curve, so the lobes come out faceted. It beats,
// lub-dub, glowing on each beat. Tap it and it gives one big beat, sends
// rings across the floor and throws out little hearts.

const COLORS = {
  red: { body: '#e8364a', glow: '#ff7a88' },
  pink: { body: '#f07aa8', glow: '#ffc2da' },
  gold: { body: '#e8b23a', glow: '#ffe08a' },
  purple: { body: '#8d4fd8', glow: '#cfa6ff' },
}

function heartGeo(size, depth, seed) {
  const s = new THREE.Shape()
  s.moveTo(25, 25)
  s.bezierCurveTo(25, 25, 20, 0, 0, 0)
  s.bezierCurveTo(-30, 0, -30, 35, -30, 35)
  s.bezierCurveTo(-30, 55, -10, 77, 25, 95)
  s.bezierCurveTo(60, 77, 80, 55, 80, 35)
  s.bezierCurveTo(80, 35, 80, 0, 50, 0)
  s.bezierCurveTo(35, 0, 25, 25, 25, 25)
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: depth * 0.45, bevelSize: 6, bevelSegments: 1, curveSegments: 4 })
  g.center()
  g.rotateZ(Math.PI) // the outline is drawn point-up
  g.scale(size, size, size)
  return facet(g, size, seed)
}

// lub-dub: a strong beat, then a softer one just after
const bump = (x, c, w) => Math.exp(-(((x - c) / w) ** 2))
const beat = (t, bpm) => {
  const x = (t * bpm) / 60 % 1
  return bump(x, 0.08, 0.05) + 0.55 * bump(x, 0.26, 0.05)
}

export function Heart({ color = 'red', bpm = 66 }) {
  const C = COLORS[color] || COLORS.red
  const { tap, handlers, clock } = useTap(3)
  const body = useRef()
  const geo = useGeo(() => ({ heart: heartGeo(0.0115, 28, 4), mini: heartGeo(0.0011, 28, 5) }), [])

  useFrame(() => {
    const t = clock.elapsedTime
    const b = beat(t, bpm)
    const k = tap.value(t)
    const s = 1 + b * 0.09 + k * 0.28
    body.current.scale.set(s, s, s * (1 + b * 0.05))
    body.current.material.emissiveIntensity = 0.05 + b * 0.35 + k * 0.6
    body.current.rotation.y = Math.sin(t * 0.7) * 0.25
    body.current.rotation.z = Math.sin(t * 0.9) * 0.05
  })

  return (
    <group {...handlers}>
      <mesh ref={body} geometry={geo.heart} position={[0, 0.95, 0]}>
        <Flat color={C.body} emissive={C.glow} roughness={0.55} />
      </mesh>
      <Burst tap={tap} geometry={geo.mini} count={12} colors={[C.body, C.glow, '#ffffff']} speed={2.1} gravity={2.2} size={1} life={1.3} origin={[0, 0.95, 0]} />
      <Ripple tap={tap} color={C.body} count={3} radius={1.8} />
    </group>
  )
}

export default function HeartScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} target={[0, 0.9, 0]} hint="The heart beats on its own, lub-dub · tap it for one big beat, rings and a spray of little hearts · Bpm sets the pace · Color swaps red, pink, gold and purple · drag to orbit">
      <Heart {...props} />
    </Stage>
  )
}
