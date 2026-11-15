import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Flat, Particles, Ripple, Stage, blob, useGeo, useTap } from './kit.jsx'

// A plump low-poly cloud of faceted puffs that drifts from side to side and
// breathes, each puff on its own beat. Tap it and it rains (or snows, or
// storms, or sprinkles) for a few seconds, with splashes rippling across
// the floor; a storm cloud also flashes and throws a bolt of lightning.

const WEATHER = {
  rain: { puff: ['#ffffff', '#eef1f7'], drop: ['#5aa8f0', '#8cc6ff'], len: 2.6, gravity: 0 },
  storm: { puff: ['#8b90a0', '#a3a8b6'], drop: ['#5aa8f0', '#8cc6ff'], len: 2.6, gravity: 0 },
  snow: { puff: ['#ffffff', '#f2f5fa'], drop: ['#ffffff', '#e6f0ff'], len: 1, gravity: 0 },
  candy: { puff: ['#ffd6e8', '#fbe6f0'], drop: ['#f27aa6', '#7fd0ff', '#f6d24a', '#8be08a'], len: 1.6, gravity: 0 },
}
// x, y, z, radius
const PUFFS = [
  [0, 0.12, 0, 0.42],
  [0.42, 0, 0.05, 0.32],
  [-0.44, 0.02, -0.02, 0.3],
  [0.18, 0.28, -0.1, 0.3],
  [-0.2, 0.24, 0.1, 0.28],
  [0.72, -0.08, 0, 0.22],
  [-0.72, -0.08, 0.04, 0.2],
  [0.05, -0.08, 0.28, 0.26],
  [0, -0.06, -0.3, 0.26],
]
const RAIN = 2.8 // seconds

export function Cloud({ weather = 'rain' }) {
  const W = WEATHER[weather] || WEATHER.rain
  const { tap, handlers, clock } = useTap(1)
  const cloud = useRef()
  const puffs = useRef([])
  const bolt = useRef()
  const splash = useRef()
  const geo = useGeo(
    () => ({
      puffs: PUFFS.map((_, i) => blob(1, 10 + i)),
      drop: new THREE.OctahedronGeometry(1, 0).scale(1, W.len, 1),
      bolt: (() => {
        const s = new THREE.Shape()
        ;[[0, 0], [0.12, 0], [0.04, -0.28], [0.14, -0.28], [-0.06, -0.7], [0, -0.36], [-0.1, -0.36]].forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)))
        return new THREE.ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: false })
      })(),
    }),
    [W.len],
  )
  const raining = () => (tap.since(clock.elapsedTime) < RAIN ? 1 : 0)

  useFrame(() => {
    const t = clock.elapsedTime
    const s = tap.since(t)
    cloud.current.position.x = Math.sin(t * 0.35) * 0.25
    cloud.current.rotation.y = Math.sin(t * 0.2) * 0.15
    puffs.current.forEach((p, i) => {
      if (!p) return
      const r = PUFFS[i][3] * (1 + Math.sin(t * 1.3 + i * 1.7) * 0.05 + (s < RAIN ? 0.04 : 0))
      p.scale.set(r, r * 0.86, r)
      if (weather === 'storm') p.material.emissiveIntensity = s < RAIN && Math.sin(s * 23) > 0.6 && s % 0.9 < 0.25 ? 0.9 : 0
    })
    splash.current.visible = weather !== 'snow' && s < RAIN + 0.4
    bolt.current.visible = weather === 'storm' && s < 0.9 && (s < 0.12 || (s > 0.5 && s < 0.62))
  })

  return (
    <group {...handlers}>
      <group ref={cloud} position-y={1.55}>
        {PUFFS.map(([x, y, z], i) => (
          <mesh key={i} ref={(el) => (puffs.current[i] = el)} geometry={geo.puffs[i]} position={[x, y, z]}>
            <Flat color={W.puff[i % 2]} emissive="#ffffff" emissiveIntensity={0} roughness={0.95} />
          </mesh>
        ))}
        <mesh ref={bolt} geometry={geo.bolt} position={[0.1, -0.22, 0.05]} scale={1.3} visible={false}>
          <Flat color="#ffe14a" emissive="#ffe14a" emissiveIntensity={1.5} />
        </mesh>
        <Particles
          geometry={geo.drop}
          count={weather === 'snow' ? 30 : 36}
          life={weather === 'snow' ? 2.2 : 0.72}
          origin={[0, -0.25, 0]}
          spread={0.55}
          velocity={[0, weather === 'snow' ? -0.6 : -1.7, 0]}
          scatter={0.02}
          drift={weather === 'snow' ? 0.2 : 0}
          spin={weather === 'rain' || weather === 'storm' ? 0 : 2}
          size={[0.022, 0.022]}
          colors={W.drop}
          opacity={[0.95, 0.6]}
          active={raining}
        />
      </group>
      <group ref={splash} visible={false}>
        <Ripple loop period={0.7} count={3} color={W.drop[0]} radius={0.9} opacity={0.35} y={0.01} />
      </group>
    </group>
  )
}

export default function CloudScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[3, 1.8, 4.4]} target={[0, 1, 0]} hint="The cloud drifts and breathes on its own · tap it and it rains for a few seconds · Weather swaps rain, storm (with lightning), snow and candy sprinkles · drag to orbit">
      <Cloud {...props} />
    </Stage>
  )
}
