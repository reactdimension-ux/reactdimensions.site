import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Cloth, Flat, Particles, Stage, Water, facet, useGeo, useTap, waveAt } from './kit.jsx'

// A low-poly sloop at anchor in a round of rolling sea: a lofted hull with a
// deck, cabin, keel and rudder, a mast with boom, a bellied mainsail and
// jib, and a pennant. The boat rides the very waves the water draws: its
// height, pitch and roll come from the sea surface sampled at bow, stern
// and either beam, smoothed by the hull's inertia, and the wind heels it.
// Tap it and a gust fills the sails: it heels hard, surges and throws spray.

const LOOKS = {
  classic: { hull: '#f4f1ea', stripe: '#2f5d7a', sail: '#fbfaf6', deck: '#c9a27a', flag: '#d8383f' },
  racing: { hull: '#1f2a44', stripe: '#e3393f', sail: '#f4f6fa', deck: '#8d95a3', flag: '#f2c23a' },
  pirate: { hull: '#5c3c2a', stripe: '#2c2a33', sail: '#e9dcc0', deck: '#8a5a3a', flag: '#1f1f24' },
  sunset: { hull: '#f4f1ea', stripe: '#e8743a', sail: '#f6b44a', deck: '#c9a27a', flag: '#b8346a' },
}
const AMP = 0.035
const SEA_Y = 0.08
const FREEBOARD = 0.075 // deck height above the water
// hull stations from stern to bow: z, half-beam, depth
const STATIONS = [
  [-0.5, 0.15, 0.11],
  [-0.3, 0.2, 0.15],
  [-0.05, 0.22, 0.17],
  [0.2, 0.19, 0.15],
  [0.4, 0.11, 0.11],
  [0.56, 0.0, 0.07],
]

function hullGeo() {
  // each station: deck port, bilge port, keel, bilge starboard, deck starboard
  const pos = []
  const ring = (z, w, d) => [
    [-w, 0, z],
    [-w * 0.85, -d * 0.6, z],
    [0, -d, z],
    [w * 0.85, -d * 0.6, z],
    [w, 0, z],
  ]
  const rings = STATIONS.map(([z, w, d]) => ring(z, w, d))
  const tri = (a, b, c) => pos.push(...a, ...b, ...c)
  for (let s = 0; s < rings.length - 1; s++)
    for (let k = 0; k < 4; k++) {
      const a = rings[s][k]
      const b = rings[s][k + 1]
      const c = rings[s + 1][k]
      const d = rings[s + 1][k + 1]
      tri(a, c, b)
      tri(b, c, d)
    }
  // the transom at the stern
  const st = rings[0]
  for (let k = 1; k < 4; k++) tri(st[0], st[k], st[k + 1])
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.computeVertexNormals()
  return g
}
function deckGeo() {
  const pos = []
  for (let s = 0; s < STATIONS.length - 1; s++) {
    const [z1, w1] = STATIONS[s]
    const [z2, w2] = STATIONS[s + 1]
    pos.push(-w1, 0, z1, w1, 0, z1, -w2, 0, z2, w1, 0, z1, w2, 0, z2, -w2, 0, z2)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.computeVertexNormals()
  return g
}

export function Sailboat({ look = 'classic', wind = 0.5 }) {
  const L = LOOKS[look] || LOOKS.classic
  const { tap, handlers, clock } = useTap(0.8)
  const boat = useRef()
  const rig = useRef()
  const st = useRef({ y: SEA_Y, pitch: 0, roll: 0, surge: 0 })

  const geo = useGeo(
    () => ({
      hull: hullGeo(),
      deck: deckGeo(),
      stripe: new THREE.BoxGeometry(0.005, 0.025, 0.8),
      cabin: facet(new THREE.BoxGeometry(0.2, 0.08, 0.26), 0.003, 1),
      port: new THREE.BoxGeometry(0.005, 0.025, 0.05),
      keel: new THREE.BoxGeometry(0.02, 0.16, 0.2).translate(0, -0.08, 0),
      bulb: new THREE.CapsuleGeometry(0.03, 0.12, 2, 6).rotateX(Math.PI / 2),
      rudder: new THREE.BoxGeometry(0.012, 0.14, 0.07).translate(0, -0.07, 0),
      mast: new THREE.CylinderGeometry(0.012, 0.016, 1.15, 5, 1).translate(0, 0.575, 0),
      boom: new THREE.CylinderGeometry(0.01, 0.01, 0.52, 5, 1).rotateX(Math.PI / 2).translate(0, 0, -0.26),
      stay: new THREE.CylinderGeometry(0.003, 0.003, 1, 3, 1).translate(0, 0.5, 0),
    }),
    [],
  )
  const gust = () => {
    const s = tap.since(clock.elapsedTime)
    return s >= 0 && s < 3 ? Math.sin(Math.min(1, s / 0.4) * Math.PI * 0.5) * Math.exp(-Math.max(0, s - 0.6) * 1.2) : 0
  }
  const billow = () => 0.04 + wind * 0.06 + gust() * 0.08

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05)
    if (!(dt > 0)) return
    const t = clock.elapsedTime
    const S = st.current
    const yaw = Math.sin(t * 0.15) * 0.25 // swinging on the anchor
    const c = Math.cos(yaw)
    const s = Math.sin(yaw)
    const at = (lx, lz) => SEA_Y + waveAt(lx * c + lz * s, -lx * s + lz * c, t, AMP)
    const bow = at(0, 0.45)
    const stern = at(0, -0.45)
    const port = at(-0.2, 0)
    const stbd = at(0.2, 0)
    const k = 1 - Math.exp(-dt / 0.35) // the hull's inertia smooths the sea
    S.y += ((bow + stern + port + stbd) / 4 - S.y) * k
    S.pitch += (Math.atan2(bow - stern, 0.9) - S.pitch) * k
    const g = gust()
    const heel = 0.08 + wind * 0.16 + g * 0.3
    S.roll += (Math.atan2(port - stbd, 0.4) - heel - S.roll) * k
    S.surge += (g * 0.15 - S.surge) * k
    boat.current.position.set(s * S.surge, S.y + FREEBOARD, c * S.surge)
    boat.current.rotation.set(-S.pitch, yaw, S.roll, 'YXZ')
    rig.current.rotation.y = -(0.35 + wind * 0.15 + g * 0.1) // the boom eased out to leeward (+x)
  })

  const wake = () => (tap.since(clock.elapsedTime) < 2.5 ? 1 : 0.2)

  return (
    <group {...handlers}>
      <Water radius={1.5} color="#3f9fd8" edge="#2a78b0" amp={AMP} y={SEA_Y} />
      <group ref={boat} scale={1.45}>
        <mesh geometry={geo.hull}>
          <Flat color={L.hull} side={THREE.DoubleSide} />
        </mesh>
        {[-1, 1].map((x) => (
          <mesh key={x} geometry={geo.stripe} position={[x * 0.205, -0.03, -0.02]} rotation-y={x * 0.03}>
            <Flat color={L.stripe} />
          </mesh>
        ))}
        <mesh geometry={geo.deck} position-y={0.002}>
          <Flat color={L.deck} side={THREE.DoubleSide} />
        </mesh>
        <mesh geometry={geo.cabin} position={[0, 0.04, -0.12]}>
          <Flat color={L.hull} />
        </mesh>
        {[-1, 1].map((x) => (
          <mesh key={x} geometry={geo.port} position={[x * 0.101, 0.045, -0.12]}>
            <Flat color="#2a3a4c" />
          </mesh>
        ))}
        <mesh geometry={geo.keel} position={[0, -0.16, 0]}>
          <Flat color={L.stripe} />
        </mesh>
        <mesh geometry={geo.bulb} position={[0, -0.33, 0.01]}>
          <Flat color="#3a3846" />
        </mesh>
        <mesh geometry={geo.rudder} position={[0, -0.08, -0.47]}>
          <Flat color={L.stripe} />
        </mesh>

        {/* mast, stays, boom and sails */}
        <group position={[0, 0, 0.1]}>
          <mesh geometry={geo.mast}>
            <Flat color="#c9ced8" metalness={0.4} roughness={0.4} />
          </mesh>
          <mesh geometry={geo.stay} position={[0, 1.12, 0]} rotation-x={Math.PI - 0.38} scale={[1, 1.2, 1]}>
            <Flat color="#5a5f6e" />
          </mesh>
          <group ref={rig} position-y={0.14}>
            <mesh geometry={geo.boom}>
              <Flat color="#c9ced8" />
            </mesh>
            <Cloth shape="tri" width={0.5} height={0.95} segs={[8, 10]} billow={billow} amp={0.012} speed={4} rotation-y={Math.PI / 2} position={[0, 0.01, -0.01]} color={L.sail} />
          </group>
          {/* jib on the forestay */}
          <group position={[0, 0.12, 0.42]} rotation={[-0.38, Math.PI / 2 - 0.35, 0]}>
            <Cloth shape="tri" width={0.36} height={0.82} segs={[6, 8]} billow={billow} amp={0.01} speed={4.5} color={L.sail} />
          </group>
          <group position-y={1.14}>
            <Cloth width={0.14} height={0.06} segs={[6, 2]} amp={0.02} speed={9} waves={1.2} rotation-y={-Math.PI / 2 - 0.4} color={L.flag} />
          </group>
        </group>
      </group>
      <Particles count={12} life={1} origin={[0, SEA_Y + 0.02, -0.5]} spread={0.08} velocity={[0, 0.25, -0.3]} scatter={0.25} gravity={0.8} size={[0.02, 0.01]} colors={['#ffffff', '#e0f2ff']} opacity={[0.9, 0]} active={wake} />
    </group>
  )
}

export default function SailboatScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={false} camera={[3.4, 1.9, 3.8]} target={[0, 0.45, 0]} hint="The boat rides the waves the sea draws, its height, pitch and roll sampled at bow, stern and beam, and the wind heels it · tap it and a gust fills the sails: it heels, surges and throws spray · Wind sets how hard it blows · Look swaps classic, racing, pirate and sunset · drag to orbit">
      <Sailboat {...props} />
    </Stage>
  )
}
