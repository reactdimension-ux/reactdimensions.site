import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Burst, Flat, Ripple, Stage, Water, facet, useGeo, useTap, waveAt } from './kit.jsx'

// A low-poly clinker rowboat afloat on a little round pond: a hull of
// overlapping planks (each plank's lower edge laps over the one below,
// so the lines read down the side), a flat transom at the stern, a pointed
// stem at the bow, gunwale trim along the top, two thwart seats, and a pair
// of oars resting in their rowlocks. Left alone, the boat rides the
// ripples, rising and falling with the water under it and pitching and
// rolling with its slope, while the oars dip and lift a touch. Tap it and
// the oars pull one stroke: they reach forward, bite into the water, sweep
// back, lift clear and swing home, while the boat glides forward on the
// stroke and drifts slowly back, with rings and splash drops at the blades.

const LOOKS = {
  red: { hull: '#c8382f', inside: '#c99a63', trim: '#f4efe4', seat: '#b0814f', oar: '#d8b07a', blade: '#c8382f', water: '#59b7e6', edge: '#3a8fc2' },
  white: { hull: '#f2efe8', inside: '#c99a63', trim: '#2f5f9e', seat: '#b0814f', oar: '#d8b07a', blade: '#2f5f9e', water: '#59b7e6', edge: '#3a8fc2' },
  blue: { hull: '#2f5f9e', inside: '#d2a56c', trim: '#f4efe4', seat: '#b0814f', oar: '#d8b07a', blade: '#f4efe4', water: '#69c9c0', edge: '#3f9c94' },
  wood: { hull: '#b5793f', inside: '#c99a63', trim: '#7a4b26', seat: '#9a6a3c', oar: '#d8b07a', blade: '#8a5a30', water: '#59b7e6', edge: '#3a8fc2' },
}

const HL = 0.85 // half length (x, bow at +x)
const HW = 0.34 // half beam
const HD = 0.26 // depth amidships
const PLANKS = 4 // per side
const STATIONS = 14
const BOAT_Y = 0.21 // the gunwale height when level: about 0.11 of draught
const AMP = 0.03
const ROW_X = -0.08 // the rowlocks
const STROKE = 1.7 // seconds for one stroke

const halfW = (u) => HW * Math.pow(Math.max(0, u < 0 ? 1 - 0.42 * u * u : 1 - u * u), 0.6)
const depth = (u) => HD * (u < 0 ? 1 - 0.35 * u * u : 1 - 0.55 * u * u)
const sheer = (u) => 0.06 * u * u + 0.06 * Math.max(0, u) ** 3
// a point on the hull: u runs stern (-1) to bow (1), a from port (-pi/2)
// round under the keel (0) to starboard (pi/2)
const hullAt = (u, a) => [u * HL, sheer(u) - depth(u) * Math.pow(Math.cos(a), 0.6), halfW(u) * Math.sin(a)]

// The clinker hull: each plank its own strip, its edge nearer the keel
// pushed out a touch so it laps over the plank below. Alternate planks are
// shaded a little apart (vertex colours, multiplied by the hull colour).
function hullGeometry() {
  const pos = []
  const col = []
  const lap = 0.014
  const rows = PLANKS * 2
  for (let j = 0; j < rows; j++) {
    const a0 = -Math.PI / 2 + (j / rows) * Math.PI
    const a1 = -Math.PI / 2 + ((j + 1) / rows) * Math.PI
    // the edge nearer the keel (smaller |a|) is the lapped one
    const lowA = Math.abs(a0) < Math.abs(a1) ? 0 : 1
    const shade = j % 2 ? 0.9 : 1
    const P = (i, e) => {
      const u = -1 + (2 * i) / STATIONS
      const a = e ? a1 : a0
      const p = hullAt(u, a)
      if (e === lowA && j !== PLANKS - 1 && j !== PLANKS) {
        const k = lap * Math.min(1, halfW(u) / HW + 0.05)
        p[1] -= Math.cos(a) * k
        p[2] += Math.sin(a) * k
      }
      return p
    }
    for (let i = 0; i < STATIONS; i++) {
      const q = [P(i, 0), P(i + 1, 0), P(i + 1, 1), P(i, 1)]
      for (const v of [q[0], q[1], q[2], q[0], q[2], q[3]]) {
        pos.push(...v)
        col.push(shade, shade, shade)
      }
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.computeVertexNormals()
  return g
}

// The flat transom across the stern.
function transomGeometry() {
  const s = new THREE.Shape()
  for (let k = 0; k <= 12; k++) {
    const [, y, z] = hullAt(-1, -Math.PI / 2 + (k / 12) * Math.PI)
    k ? s.lineTo(z, y) : s.moveTo(z, y)
  }
  s.closePath()
  return new THREE.ShapeGeometry(s).rotateY(-Math.PI / 2).translate(-HL, 0, 0)
}

// The gunwale along one side, a rail over the top edge.
function gunwaleGeometry(side) {
  const pts = []
  for (let k = 0; k <= 16; k++) {
    const u = -1 + (2 * k) / 16
    const [x, y, z] = hullAt(u, (side * Math.PI) / 2)
    pts.push(new THREE.Vector3(x, y + 0.01, z + side * 0.008))
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.022, 4, false)
}

// The floorboards: a level deck inside the hull at height y (above the
// waterline, so the pond never shows through the bottom).
function floorGeometry(y) {
  const at = (u) => {
    const c = (sheer(u) - y) / depth(u)
    return c >= 1 ? 0 : halfW(u) * Math.sin(Math.acos(Math.pow(c, 1 / 0.6))) - 0.01
  }
  const s = new THREE.Shape()
  const n = 20
  for (let k = 0; k <= n; k++) {
    const u = -1 + (2 * k) / n
    k ? s.lineTo(u * HL, at(u)) : s.moveTo(u * HL, at(u))
  }
  for (let k = n; k >= 0; k--) {
    const u = -1 + (2 * k) / n
    s.lineTo(u * HL, -at(u))
  }
  return new THREE.ShapeGeometry(s).rotateX(Math.PI / 2).translate(0, y, 0)
}

// A thwart seat at u, sat 0.09 below the gunwale, spanning the hull there.
function thwartAt(u) {
  const drop = 0.09
  const c = Math.pow(drop / depth(u), 1 / 0.6)
  const half = halfW(u) * Math.sin(Math.acos(Math.min(1, c)))
  return { x: u * HL, y: sheer(u) - drop, w: half * 2 - 0.02 }
}

// the stroke keyframes: [time 0..1, sweep (yaw), dip (pitch)]
const KEYS = [
  [0, 0.1, 0.17],
  [0.2, 0.62, 0.06],
  [0.3, 0.62, 0.3],
  [0.62, -0.55, 0.3],
  [0.72, -0.55, 0.05],
  [1, 0.1, 0.17],
]
const ease = (x) => x * x * (3 - 2 * x)
function strokeAt(u) {
  for (let i = 1; i < KEYS.length; i++)
    if (u <= KEYS[i][0]) {
      const [t0, y0, d0] = KEYS[i - 1]
      const [t1, y1, d1] = KEYS[i]
      const k = ease((u - t0) / (t1 - t0))
      return [y0 + (y1 - y0) * k, d0 + (d1 - d0) * k]
    }
  return [KEYS[0][1], KEYS[0][2]]
}

// how far the boat has glided on the stroke: out on the drive, back slowly
const glideAt = (s) => (s < 0.5 ? 0 : 0.3 * (1 - Math.exp(-(s - 0.5) * 2.6)) * Math.exp(-(s - 0.5) * 0.4))

export function Rowboat({ look = 'red' }) {
  const L = LOOKS[look] || LOOKS.red
  const { tap, handlers, clock } = useTap(1.2)
  const boat = useRef()
  const oars = useRef([])
  const T = useMemo(() => [thwartAt(-0.42), thwartAt(0.28)], [])
  const rowZ = halfW(ROW_X / HL)
  const rowY = sheer(ROW_X / HL) + 0.03
  const geo = useGeo(
    () => ({
      hull: hullGeometry(),
      transom: transomGeometry(),
      gunwale: [gunwaleGeometry(1), gunwaleGeometry(-1)],
      stem: facet(new THREE.BoxGeometry(0.05, 0.14, 0.045), 0.004, 3),
      floor: floorGeometry(-0.12),
      board: new THREE.BoxGeometry(1.2, 0.006, 0.012),
      thwart: facet(new THREE.BoxGeometry(0.16, 0.03, 1), 0.003, 4),
      keel: new THREE.BoxGeometry(1, 0.03, 0.03),
      rowlock: new THREE.BoxGeometry(0.012, 0.06, 0.012),
      block: new THREE.BoxGeometry(0.08, 0.025, 0.05),
      shaft: new THREE.CylinderGeometry(0.017, 0.017, 1.25, 5).rotateX(Math.PI / 2).translate(0, 0, 0.3),
      grip: new THREE.CylinderGeometry(0.024, 0.024, 0.12, 5).rotateX(Math.PI / 2),
      blade: facet(new THREE.BoxGeometry(0.12, 0.014, 0.32), 0.003, 5),
      collar: new THREE.CylinderGeometry(0.026, 0.026, 0.05, 6).rotateX(Math.PI / 2),
      drop: new THREE.IcosahedronGeometry(1, 0),
    }),
    [],
  )
  // the splash comes as the blades bite, a moment after the tap
  const late = useMemo(() => ({ since: (t) => tap.since(t) - STROKE * 0.28 }), [tap])

  useFrame(() => {
    const t = clock.elapsedTime
    const s = tap.since(t)
    // ride the water: the wave under bow and stern sets pitch, under each
    // side sets roll, and their mean the height
    const x = glideAt(s)
    const z = Math.sin(t * 0.2) * 0.05
    const hb = waveAt(x + 0.6, z, t, AMP)
    const hs = waveAt(x - 0.6, z, t, AMP)
    const hp = waveAt(x, z - 0.3, t, AMP)
    const hr = waveAt(x, z + 0.3, t, AMP)
    const drive = s >= 0 && s < STROKE ? Math.sin(Math.PI * Math.min(1, Math.max(0, (s / STROKE - 0.3) / 0.35))) : 0
    boat.current.position.set(x, BOAT_Y + (hb + hs + hp + hr) / 4, z)
    boat.current.rotation.set(-((hr - hp) / 0.6) * 0.8 + Math.sin(t * 0.9) * 0.025, Math.sin(t * 0.13) * 0.12, ((hb - hs) / 1.2) * 0.8 + drive * 0.04)
    // the oars: resting with a small dip and lift, or pulling a stroke
    const [yaw, dip] = s >= 0 && s < STROKE ? strokeAt(s / STROKE) : [KEYS[0][1] + Math.sin(t * 0.8) * 0.04, KEYS[0][2] + Math.sin(t * 1.1) * 0.03]
    oars.current.forEach((o) => {
      if (!o) return
      o.rotation.set(dip, yaw, 0, 'YXZ')
    })
  })

  return (
    <group {...handlers}>
      <Water radius={1.75} color={L.water} edge={L.edge} amp={AMP} />
      <Ripple tap={late} color="#ffffff" radius={1.6} count={3} y={0.07} />
      <group ref={boat}>
        {/* the hull: painted outside, bare wood inside */}
        <mesh geometry={geo.hull}>
          <Flat color={L.hull} vertexColors roughness={0.6} side={THREE.FrontSide} />
        </mesh>
        <mesh geometry={geo.hull}>
          <Flat color={L.inside} vertexColors roughness={0.8} side={THREE.BackSide} />
        </mesh>
        <mesh geometry={geo.transom}>
          <Flat color={L.hull} roughness={0.6} side={THREE.DoubleSide} />
        </mesh>
        {/* the floorboards, with a seam or two */}
        <mesh geometry={geo.floor}>
          <Flat color={L.seat} roughness={0.85} side={THREE.DoubleSide} />
        </mesh>
        {[-0.08, 0.08].map((z) => (
          <mesh key={z} geometry={geo.board} position={[-0.1, -0.117, z]}>
            <Flat color="#6b4524" />
          </mesh>
        ))}
        <mesh geometry={geo.stem} position={[HL + 0.012, sheer(1) - 0.06, 0]}>
          <Flat color={L.trim} />
        </mesh>
        <mesh geometry={geo.keel} position={[0, -HD - 0.005, 0]} scale-x={0.9}>
          <Flat color={L.trim} />
        </mesh>
        {geo.gunwale.map((g, i) => (
          <mesh key={i} geometry={g}>
            <Flat color={L.trim} roughness={0.6} />
          </mesh>
        ))}
        {/* two thwart seats */}
        {T.map((th, i) => (
          <mesh key={i} geometry={geo.thwart} position={[th.x, th.y, 0]} scale-z={th.w}>
            <Flat color={L.seat} />
          </mesh>
        ))}
        {/* the rowlocks and oars, starboard and (mirrored) port */}
        {[1, -1].map((side, i) => (
          <group key={side} position={[ROW_X, rowY, side * rowZ]} scale={[1, 1, side]}>
            <mesh geometry={geo.block} position-y={-0.025}>
              <Flat color={L.trim} />
            </mesh>
            {[-1, 1].map((k) => (
              <mesh key={k} geometry={geo.rowlock} position={[k * 0.03, 0.01, 0]}>
                <meshStandardMaterial color="#8a8c92" metalness={0.7} roughness={0.35} flatShading />
              </mesh>
            ))}
            <group ref={(el) => (oars.current[i] = el)}>
              <mesh geometry={geo.shaft}>
                <Flat color={L.oar} />
              </mesh>
              <mesh geometry={geo.collar}>
                <Flat color="#2a2a30" />
              </mesh>
              <mesh geometry={geo.grip} position-z={-0.28}>
                <Flat color="#7a4b26" />
              </mesh>
              <mesh geometry={geo.blade} position-z={1.02}>
                <Flat color={L.blade} />
              </mesh>
            </group>
          </group>
        ))}
      </group>
      {[1, -1].map((side) => (
        <Burst key={side} tap={late} geometry={geo.drop} count={8} colors={['#ffffff', L.water, '#bfe6ff']} speed={1.3} gravity={4.5} size={0.04} life={0.8} origin={[ROW_X + 0.55, 0.1, side * 1.1]} spread={0.8} seed={side + 5} />
      ))}
    </group>
  )
}

export default function RowboatScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[3.4, 2.7, 4.4]} target={[0, 0.3, 0]} hint="The boat rocks on the ripples and the oars dip by themselves · tap it to pull a stroke: the oars sweep back through the water and the boat glides on · Look swaps red, white, blue and wood · drag to orbit">
      <Rowboat {...props} />
    </Stage>
  )
}
