import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Burst, Flat, Stage, TAU, facet, rng, useGeo, useTap } from './kit.jsx'

// Three low-poly stacks of coins, each coin a faceted disc with a reeded
// edge and a star struck on both faces. The top coins take turns to hop,
// flip and land back on their stacks, and a gleam runs over the metal. Tap
// it and every coin hops out in turn and lays itself along an arc, each
// leaning on the one before like a spread hand; after a moment they hop
// back home in reverse order.

const METALS = {
  gold: [{ face: '#f2c23a', edge: '#c9962a', star: '#ffe08a', glow: '#ffd84a' }],
  silver: [{ face: '#d8dde6', edge: '#9aa3ae', star: '#ffffff', glow: '#ffffff' }],
  copper: [{ face: '#d9824a', edge: '#a85a2e', star: '#f2b08a', glow: '#ffa060' }],
}
METALS.mixed = [METALS.gold[0], METALS.silver[0], METALS.copper[0]]
const R = 0.16
const H = 0.04
const STACKS = [
  [-0.38, -0.12, 7],
  [0.04, 0.16, 5],
  [0.42, -0.14, 9],
]
const HOLD = 2.4 // seconds the fan is held
const MOVE = 0.55 // seconds for one coin to hop to its place
const STAGGER = 0.035
const LEAN = 0.32

const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x))

function starGeo(r) {
  const s = new THREE.Shape()
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU + Math.PI / 2
    const k = i % 2 ? r * 0.45 : r
    i ? s.lineTo(Math.cos(a) * k, Math.sin(a) * k) : s.moveTo(Math.cos(a) * k, Math.sin(a) * k)
  }
  return new THREE.ExtrudeGeometry(s, { depth: 0.004, bevelEnabled: false }).rotateX(-Math.PI / 2)
}

export function CoinStack({ metal = 'gold' }) {
  const M = METALS[metal] || METALS.gold
  const { tap, handlers, clock } = useTap(1)
  const refs = useRef([])
  const faces = useRef([])

  const coins = useMemo(() => {
    const r = rng(4)
    const list = []
    STACKS.forEach(([x, z, n], k) => {
      for (let l = 0; l < n; l++) list.push({ k, l, top: l === n - 1, home: [x + (r() - 0.5) * 0.02, H / 2 + l * H * 1.02, z + (r() - 0.5) * 0.02], yaw: r() * TAU })
    })
    // the fan: an arc in front, each coin leaning on the one before
    const n = list.length
    list.forEach((c, j) => {
      const phi = -0.95 + (1.9 * j) / (n - 1)
      c.fan = [Math.sin(phi) * 1.0, R * Math.sin(LEAN) + 0.01, -0.62 + Math.cos(phi) * 1.0]
      c.phi = phi
    })
    return list
  }, [])
  const geo = useGeo(
    () => ({
      coin: facet(new THREE.CylinderGeometry(R, R, H, 12, 1), 0.002, 1),
      reed: new THREE.CylinderGeometry(R * 1.012, R * 1.012, H * 0.7, 24, 1, true),
      star: starGeo(R * 0.55),
      spark: new THREE.OctahedronGeometry(1, 0),
    }),
    [],
  )

  useFrame(() => {
    const t = clock.elapsedTime
    const s = tap.since(t)
    const n = coins.length
    coins.forEach((c, j) => {
      const m = refs.current[j]
      if (!m) return
      // out to the fan in order, back home in reverse order
      const rawOut = (s - j * STAGGER) / MOVE
      const rawBack = (s - HOLD - (n - 1 - j) * STAGGER) / MOVE
      const b = ease(rawOut) * (1 - ease(rawBack))
      const hop = (rawOut > 0 && rawOut < 1 ? Math.sin(rawOut * Math.PI) : 0) + (rawBack > 0 && rawBack < 1 ? Math.sin(rawBack * Math.PI) : 0)
      const x = c.home[0] + (c.fan[0] - c.home[0]) * b
      let y = c.home[1] + (c.fan[1] - c.home[1]) * b + hop * 0.3
      const z = c.home[2] + (c.fan[2] - c.home[2]) * b
      let flip = 0
      // idle: the top coins take turns to hop and flip
      if (c.top && b === 0) {
        const u = ((t + c.k * 0.7) % 2.1) / 0.6
        if (u < 1) {
          y += Math.sin(Math.PI * u) * 0.28
          flip = ease(u) * TAU
        }
      }
      m.position.set(x, y, z)
      m.rotation.set(flip + hop * 1.5, c.yaw + (c.phi - c.yaw) * b, LEAN * b, 'YXZ')
      const g = 0.04 + 0.35 * Math.max(0, Math.sin(t * 2 - j * 0.35)) ** 8
      faces.current[j]?.forEach((f) => f && (f.emissiveIntensity = g))
    })
  })

  return (
    <group {...handlers}>
      {coins.map((c, j) => {
        const C = M[c.k % M.length]
        const mats = []
        faces.current[j] = mats
        return (
          <group key={j} ref={(el) => (refs.current[j] = el)}>
            <mesh geometry={geo.coin}>
              <meshStandardMaterial ref={(el) => (mats[0] = el)} color={C.face} emissive={C.glow} emissiveIntensity={0.04} flatShading metalness={0.55} roughness={0.35} />
            </mesh>
            <mesh geometry={geo.reed}>
              <Flat color={C.edge} metalness={0.5} roughness={0.45} />
            </mesh>
            {[1, -1].map((s) => (
              <mesh key={s} geometry={geo.star} position-y={s * (H / 2 + 0.0005)} rotation-x={s < 0 ? Math.PI : 0}>
                <Flat color={C.star} metalness={0.4} roughness={0.35} />
              </mesh>
            ))}
          </group>
        )
      })}
      <Burst tap={tap} geometry={geo.spark} count={16} colors={['#ffffff', M[0].glow]} speed={1.4} gravity={2} size={0.025} life={1.1} origin={[0, 0.35, 0]} spread={1.2} up={1} />
    </group>
  )
}

export default function CoinStackScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[2.1, 1.6, 2.9]} target={[0, 0.18, 0]} hint="The top coins take turns to hop and flip, and a gleam runs over the metal on its own · tap it and the coins hop out one by one into a fan, then back home · Metal swaps gold, silver, copper and mixed · drag to orbit">
      <CoinStack {...props} />
    </Stage>
  )
}
