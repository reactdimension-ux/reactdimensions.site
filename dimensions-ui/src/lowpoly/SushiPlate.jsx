import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Flat, Stage, facet, useGeo, useTap } from './kit.jsx'

// A low-poly sushi plate: a long slab on two little feet laid with three
// nigiri (rounded rice blocks under draped toppings), a cluster of maki
// rolls, a dab of wasabi, a fan of pickled ginger, a small soy dish and a
// pair of chopsticks on their rest. The plate turns slowly on its own. Tap
// it and the chopsticks lift off the rest, pick up the front nigiri, dip it
// in the soy dish with a little ripple, set it back and return to the rest.

const TUNA = { color: '#d8414c' }
const SALMON = { color: '#f58a5a', stripes: true }
const TAMAGO = { color: '#f6cf4a', band: true }
const AVOCADO = { color: '#9cc45a', edge: '#4e7a2c' }
const CUCUMBER = { color: '#6fb04a', band: true }
const LOOKS = {
  classic: { plate: '#3a3d44', foot: '#26282e', nigiri: [TUNA, SALMON, TAMAGO], fill: ['#d8414c', '#6fb04a', '#f58a5a'], sticks: '#b8323a', tipc: '#e8d2a6', rest: '#f4f1ea' },
  salmon: { plate: '#d9b382', foot: '#b08856', nigiri: [SALMON, SALMON, SALMON], fill: ['#f58a5a', '#f58a5a', '#f6cf4a'], sticks: '#25242a', tipc: '#c9a26a', rest: '#3a3d44' },
  veggie: { plate: '#e8e4dc', foot: '#c9c4b8', nigiri: [AVOCADO, CUCUMBER, TAMAGO], fill: ['#6fb04a', '#f29a3a', '#9cc45a'], sticks: '#d8b27a', tipc: '#b88a52', rest: '#7aa86a' },
}
const PT = 0.11 // plate top
const NIGIRI = [
  [-0.36, -0.37, 0.06],
  [-0.4, -0.07, -0.04],
  [-0.35, 0.23, 0.03],
]
const MAKI = [
  [0.22, -0.28],
  [0.44, -0.2],
  [0.3, -0.02],
]
const SOY = [0.7, 0.2]
const PICK = 2 // which nigiri the chopsticks take
const HOLD = [0.15, 0.09] // piece origin from the stick tips: along x, down
const STICK = 0.95
const REST = [-0.5, PT + 0.065, 0.47]

// a box with its edges rounded off in a few flat steps
function roundedBox(w, h, d, r, seg = 3) {
  const g = new THREE.BoxGeometry(w, h, d, seg, seg, seg)
  const p = g.attributes.position
  const v = new THREE.Vector3()
  const c = new THREE.Vector3()
  const lim = [w / 2 - r, h / 2 - r, d / 2 - r]
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i)
    c.set(Math.max(-lim[0], Math.min(lim[0], v.x)), Math.max(-lim[1], Math.min(lim[1], v.y)), Math.max(-lim[2], Math.min(lim[2], v.z)))
    v.sub(c)
    if (v.lengthSq() > 1e-9) v.normalize().multiplyScalar(r)
    p.setXYZ(i, c.x + v.x, c.y + v.y, c.z + v.z)
  }
  g.computeVertexNormals()
  return g
}

// a topping slab draped over the rice: its ends droop
function topping(seed) {
  const g = new THREE.BoxGeometry(0.38, 0.045, 0.19, 6, 1, 2)
  const p = g.attributes.position
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i)
    p.setY(i, p.getY(i) - 1.1 * x * x)
  }
  return facet(g, 0.006, seed, [1, 0.5, 1])
}

// the tap: stick-tip keyframes in plate space [time, x, y, z, pitch, spread]
const G = [NIGIRI[PICK][0] - HOLD[0], PT + HOLD[1], NIGIRI[PICK][1]]
const D = [SOY[0] - HOLD[0], PT + 0.075 + HOLD[1], SOY[1]]
const up = (p, h) => [p[0], p[1] + h, p[2]]
const KEYS = [
  [0, ...REST, 0, 0.026],
  [0.45, ...up(G, 0.3), 0.6, 0.14],
  [0.7, ...G, 0.6, 0.14],
  [0.85, ...G, 0.6, 0.096],
  [1.15, ...up(G, 0.35), 0.6, 0.096],
  [1.6, ...up(D, 0.3), 0.6, 0.096],
  [1.85, ...D, 0.6, 0.096],
  [2.0, ...up(D, 0.07), 0.6, 0.096],
  [2.15, ...D, 0.6, 0.096],
  [2.45, ...up(D, 0.3), 0.6, 0.096],
  [2.9, ...up(G, 0.3), 0.6, 0.096],
  [3.15, ...G, 0.6, 0.096],
  [3.3, ...G, 0.6, 0.14],
  [3.55, ...up(G, 0.3), 0.6, 0.14],
  [4.05, ...REST, 0, 0.026],
]
const GRAB = [0.85, 3.2]
const DIPS = [1.85, 2.15]
const ease = (u) => u * u * (3 - 2 * u)
function sticksAt(s) {
  if (s < 0 || s >= KEYS[KEYS.length - 1][0]) return KEYS[0]
  let i = 0
  while (KEYS[i + 1][0] <= s) i++
  const a = KEYS[i]
  const b = KEYS[i + 1]
  const u = ease((s - a[0]) / (b[0] - a[0]))
  return a.map((v, k) => v + (b[k] - v) * u)
}

function Nigiri({ geo, top, rice = '#f6f3ea', ...props }) {
  return (
    <group {...props}>
      <mesh geometry={geo.rice} position-y={0.065}>
        <Flat color={rice} />
      </mesh>
      <mesh geometry={geo.topping} position-y={0.14}>
        <Flat color={top.color} roughness={0.45} />
      </mesh>
      {top.stripes &&
        [-0.1, -0.03, 0.04, 0.11].map((x) => (
          <mesh key={x} geometry={geo.stripe} position={[x, 0.165 - 1.1 * x * x, 0]} rotation-y={0.35}>
            <Flat color="#fde2cc" />
          </mesh>
        ))}
      {top.edge && (
        <mesh geometry={geo.stripe} position={[0, 0.166, 0]} scale={[1.2, 1, 1.05]}>
          <Flat color={top.edge} />
        </mesh>
      )}
      {top.band && (
        <mesh geometry={geo.band} position-y={0.1}>
          <Flat color="#1f2e22" />
        </mesh>
      )}
    </group>
  )
}

export function SushiPlate({ look = 'classic' }) {
  const L = LOOKS[look] || LOOKS.classic
  const { tap, handlers, clock } = useTap(1)
  const plate = useRef()
  const sticks = useRef()
  const legs = useRef([])
  const piece = useRef()
  const soy = useRef()
  const ripple = useRef()

  const geo = useGeo(
    () => ({
      slab: facet(roundedBox(2.15, 0.07, 1.25, 0.025, 2).translate(0, PT - 0.035, 0), 0.006, 2, [1, 0.3, 1]),
      foot: new THREE.BoxGeometry(0.12, PT - 0.07, 1.05).translate(0, (PT - 0.07) / 2, 0),
      rice: facet(roundedBox(0.32, 0.12, 0.16, 0.045, 3), 0.008, 4),
      topping: topping(5),
      stripe: new THREE.BoxGeometry(0.018, 0.012, 0.2),
      band: new THREE.BoxGeometry(0.07, 0.15, 0.2),
      nori: facet(new THREE.CylinderGeometry(0.105, 0.105, 0.15, 9, 1, true).translate(0, 0.075, 0), 0.005, 6),
      riceTop: new THREE.CylinderGeometry(0.095, 0.095, 0.148, 9, 1).translate(0, 0.074, 0),
      fill: new THREE.CylinderGeometry(0.038, 0.038, 0.152, 5, 1).translate(0, 0.076, 0),
      grain: new THREE.TetrahedronGeometry(0.012, 0),
      wasabi: facet(new THREE.IcosahedronGeometry(0.085, 1).scale(1, 0.75, 1).translate(0, 0.045, 0), 0.008, 7),
      wasabiTip: facet(new THREE.ConeGeometry(0.045, 0.07, 6, 1).translate(0, 0.035, 0), 0.006, 17),
      ginger: facet(new THREE.SphereGeometry(0.1, 7, 3).scale(1, 0.12, 0.65), 0.006, 8),
      dish: facet(new THREE.LatheGeometry([[0.001, 0], [0.12, 0], [0.17, 0.05], [0.19, 0.08], [0.17, 0.08], [0.11, 0.025], [0.001, 0.025]].map(([r, y]) => new THREE.Vector2(r, y)), 12), 0.004, 9),
      soy: new THREE.CylinderGeometry(0.155, 0.12, 0.01, 12, 1),
      ripple: new THREE.TorusGeometry(0.06, 0.006, 3, 14).rotateX(Math.PI / 2),
      stick: new THREE.CylinderGeometry(0.02, 0.011, STICK, 6, 1).rotateZ(-Math.PI / 2).translate(STICK / 2, 0, 0),
      tip: new THREE.CylinderGeometry(0.0115, 0.0102, 0.12, 6, 1).rotateZ(-Math.PI / 2).translate(0.06, 0, 0),
      rest: facet(roundedBox(0.09, 0.05, 0.16, 0.02, 2).translate(0, 0.025, 0), 0.004, 10),
    }),
    [],
  )

  useFrame(() => {
    const t = clock.elapsedTime
    const s = tap.since(t)
    plate.current.rotation.y = -0.35 + t * 0.18

    const [, x, y, z, pitch, spread] = sticksAt(s)
    sticks.current.position.set(x, y, z)
    sticks.current.rotation.z = pitch
    legs.current.forEach((m, i) => {
      if (!m) return
      const sg = i ? -1 : 1
      m.position.z = sg * spread
      m.rotation.y = sg * Math.asin((spread - 0.022) / STICK)
    })

    // the picked piece rides between the tips while held
    const held = s >= GRAB[0] && s < GRAB[1]
    const [px, , pz] = NIGIRI[PICK]
    if (held) piece.current.position.set(x + HOLD[0], y - HOLD[1] + 0.008, z)
    else piece.current.position.set(px, PT, pz)
    piece.current.rotation.x = held ? Math.sin(s * 9) * 0.03 : 0

    // a ring spreads on the soy as the piece dips in
    const d = DIPS.reduce((m, k) => (s >= k && s - k < m ? s - k : m), 9)
    const k = d < 0.6 ? d / 0.6 : 1
    ripple.current.scale.setScalar(0.4 + k * 2.2)
    ripple.current.material.opacity = d < 0.6 ? 0.5 * (1 - k) : 0
    soy.current.position.y = 0.072 + Math.sin(t * 2.2) * 0.002
  })

  return (
    <group {...handlers}>
      <group ref={plate}>
        {[-0.75, 0.75].map((x) => (
          <mesh key={x} geometry={geo.foot} position-x={x}>
            <Flat color={L.foot} />
          </mesh>
        ))}
        <mesh geometry={geo.slab}>
          <Flat color={L.plate} roughness={0.7} />
        </mesh>

        {/* nigiri */}
        {NIGIRI.map(([x, z, r], i) =>
          i === PICK ? null : <Nigiri key={i} geo={geo} top={L.nigiri[i]} position={[x, PT, z]} rotation-y={r} />,
        )}
        <group ref={piece} position={[NIGIRI[PICK][0], PT, NIGIRI[PICK][1]]}>
          <Nigiri geo={geo} top={L.nigiri[PICK]} rotation-y={NIGIRI[PICK][2]} />
        </group>

        {/* maki rolls */}
        {MAKI.map(([x, z], i) => (
          <group key={i} position={[x, PT, z]} rotation-y={i * 1.3}>
            <mesh geometry={geo.nori}>
              <Flat color="#1f2e22" side={THREE.DoubleSide} />
            </mesh>
            <mesh geometry={geo.riceTop}>
              <Flat color="#f6f3ea" />
            </mesh>
            <mesh geometry={geo.fill} position-x={0.01}>
              <Flat color={L.fill[i]} />
            </mesh>
            {[0, 1, 2, 3, 4].map((k) => (
              <mesh key={k} geometry={geo.grain} position={[Math.cos(k * 1.4 + i) * 0.065, 0.152, Math.sin(k * 1.4 + i) * 0.065]} rotation={[k, k * 2, 0]}>
                <Flat color="#ffffff" />
              </mesh>
            ))}
          </group>
        ))}

        {/* wasabi and a fan of pickled ginger */}
        <mesh geometry={geo.wasabi} position={[-0.86, PT, -0.32]}>
          <Flat color="#8cc43c" />
        </mesh>
        <mesh geometry={geo.wasabiTip} position={[-0.85, PT + 0.07, -0.32]} rotation-z={0.25}>
          <Flat color="#8cc43c" />
        </mesh>
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} geometry={geo.ginger} position={[-0.84 + i * 0.03, PT + 0.012 + i * 0.016, 0.0 + i * 0.045]} rotation={[0.25, 0.4 + i * 0.25, 0.1]}>
            <Flat color={i % 2 ? '#f4b8b0' : '#f7c8c0'} roughness={0.5} />
          </mesh>
        ))}

        {/* the soy dish */}
        <group position={[SOY[0], PT, SOY[1]]}>
          <mesh geometry={geo.dish}>
            <Flat color="#f4f1ea" roughness={0.4} side={THREE.DoubleSide} />
          </mesh>
          <mesh ref={soy} geometry={geo.soy} position-y={0.072}>
            <Flat color="#3a1a0c" roughness={0.12} />
          </mesh>
          <mesh ref={ripple} geometry={geo.ripple} position-y={0.08}>
            <meshBasicMaterial color="#c9905a" transparent opacity={0} depthWrite={false} />
          </mesh>
        </group>

        {/* the chopstick rest and the chopsticks */}
        <mesh geometry={geo.rest} position={[REST[0] + 0.62, PT, REST[2]]}>
          <Flat color={L.rest} roughness={0.5} />
        </mesh>
        <group ref={sticks} position={REST}>
          {[0, 1].map((i) => (
            <group key={i} ref={(el) => (legs.current[i] = el)}>
              <mesh geometry={geo.stick}>
                <Flat color={L.sticks} roughness={0.4} />
              </mesh>
              <mesh geometry={geo.tip}>
                <Flat color={L.tipc} />
              </mesh>
            </group>
          ))}
        </group>
      </group>
    </group>
  )
}

export default function SushiPlateScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[1.6, 2.3, 3.3]} target={[0, 0.2, 0]} hint="The plate turns slowly on its own · tap it and the chopsticks lift off their rest, pick up a nigiri, dip it in the soy dish and set it back · Look swaps classic, salmon and veggie · drag to orbit">
      <SushiPlate {...props} />
    </Stage>
  )
}
