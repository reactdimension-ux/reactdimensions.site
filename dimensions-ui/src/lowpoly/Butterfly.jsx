import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Burst, Flat, Stage, TAU, blob, facet, useGeo, useTap } from './kit.jsx'

// A low-poly butterfly resting on a flower: a segmented body with a round
// head, curling antennae and six little legs, and four flat wings (a broad
// forewing and a rounder hindwing each side) patterned in layers: a dark
// border, a bright fill, spots along the edge and, for some looks, veins or
// a shimmering core. The flower stands on a mound of grass, its petals
// cupped round a golden heart. Left alone, the butterfly slowly opens and
// closes its wings as it basks. Tap it and it takes off: wings flapping
// fast, it flies a figure-eight above the flower, banking into each turn,
// then drifts down and lands back where it started.

const LOOKS = {
  monarch: { wing: '#f28a1e', hind: '#ec7a18', edge: '#1f1a1c', spot: '#ffffff', body: '#2a2326', veins: true, petal: ['#c985d6', '#b06cc4'], heart: '#f2c84a' },
  morpho: { wing: '#2f8fe8', hind: '#3a9ef0', edge: '#14182a', spot: '#ffffff', body: '#1f2230', core: '#8fdcff', petal: ['#fbf6ee', '#efe6d8'], heart: '#f2b632' },
  swallowtail: { wing: '#f6d34a', hind: '#f3cc3e', edge: '#221f22', spot: '#3a78d8', body: '#2a2622', tails: true, eyespot: '#f27a2a', veins: true, petal: ['#9f8ae6', '#8a74d6'], heart: '#f6e07a' },
  pink: { wing: '#f58bb8', hind: '#f7a3c6', edge: '#a8327a', spot: '#ffffff', body: '#5a2a48', core: '#ffe0ef', petal: ['#fbf6ee', '#f2e8f0'], heart: '#f2c84a' },
}

const STEM = 0.78 // height of the flower head
const SCALE = 1.65 // the butterfly's size
const FLIGHT = 4.8 // seconds in the air after a tap
const REST_YAW = -0.9

// wing outlines in the wing's own plane: x out from the body, y forward
const FORE = [[0, 0.03], [0.12, 0.17], [0.3, 0.27], [0.44, 0.27], [0.47, 0.2], [0.38, 0.06], [0.24, -0.03], [0.05, -0.03]]
const HIND = [[0.02, -0.02], [0.18, -0.03], [0.31, -0.1], [0.33, -0.2], [0.24, -0.3], [0.12, -0.31], [0.04, -0.2]]
const HIND_TAIL = [[0.02, -0.02], [0.18, -0.03], [0.31, -0.1], [0.32, -0.2], [0.26, -0.27], [0.25, -0.44], [0.2, -0.3], [0.1, -0.3], [0.04, -0.2]]

const centroid = (pts) => pts.reduce((a, [x, y]) => [a[0] + x / pts.length, a[1] + y / pts.length], [0, 0])
const shrink = (pts, k) => {
  const [cx, cy] = centroid(pts)
  return pts.map(([x, y]) => [cx + (x - cx) * k, cy + (y - cy) * k])
}

// a flat wing layer: the outline as a shape, turned to lie in x/z (y up)
function plate(pts, seed) {
  const s = new THREE.Shape()
  pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)))
  s.closePath()
  return facet(new THREE.ShapeGeometry(s).rotateX(Math.PI / 2), 0.0012, seed, [0, 1, 0])
}

// the spots along a wing's edge: midpoints and corners pulled in a little,
// skipping the ones by the body
function edgeSpots(pts) {
  const [cx, cy] = centroid(pts)
  const out = []
  pts.forEach(([x, y], i) => {
    const [nx, ny] = pts[(i + 1) % pts.length]
    for (const [px, py] of [[x, y], [(x + nx) / 2, (y + ny) / 2]]) if (px > 0.12) out.push([px + (cx - px) * 0.12, py + (cy - py) * 0.12])
  })
  return out
}

// veins: lines from near the root out to the corners
function veins(pts) {
  const [cx, cy] = centroid(pts)
  const root = [cx * 0.25, cy * 0.4]
  return pts
    .filter(([x]) => x > 0.2)
    .map(([x, y]) => {
      const ex = root[0] + (x - root[0]) * 0.8
      const ey = root[1] + (y - root[1]) * 0.8
      const dx = ex - root[0]
      const dy = ey - root[1]
      return { p: [(root[0] + ex) / 2, (root[1] + ey) / 2], len: Math.hypot(dx, dy), rot: Math.atan2(-dy, dx) }
    })
}

// one layer, drawn on both faces of the wing so it reads open or closed
function Both({ geometry, color, y, ...props }) {
  return [-1, 1].map((s) => (
    <mesh key={s} geometry={geometry} position-y={s * y} {...props}>
      <Flat color={color} side={THREE.DoubleSide} roughness={0.7} />
    </mesh>
  ))
}

function WingSet({ L, geo, outline, which }) {
  const spots = edgeSpots(outline)
  const fill = which === 'fore' ? L.wing : L.hind
  return (
    <group>
      <Both geometry={geo[which].base} color={L.edge} y={0} />
      <Both geometry={geo[which].inner} color={fill} y={0.0035} />
      {L.core && <Both geometry={geo[which].core} color={L.core} y={0.005} />}
      {L.veins &&
        veins(outline).map((v, i) => (
          <group key={i} position={[v.p[0], 0, v.p[1]]} rotation-y={v.rot} scale={[v.len, 1, 1]}>
            <Both geometry={geo.vein} color={L.edge} y={0.0055} />
          </group>
        ))}
      {spots.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]} scale={0.75 + (i % 3) * 0.2}>
          <Both geometry={geo.spot} color={L.spot} y={0.006} />
        </group>
      ))}
      {which === 'hind' && L.eyespot && (
        <group position={[0.22, 0, -0.25]} scale={1.8}>
          <Both geometry={geo.spot} color={L.eyespot} y={0.0065} />
        </group>
      )}
    </group>
  )
}

const smooth = (a, b, x) => {
  const u = Math.max(0, Math.min(1, (x - a) / (b - a)))
  return u * u * (3 - 2 * u)
}

// the flight, s seconds after take-off: a figure-eight above the flower,
// eased in from the resting spot and back down to it
const REST = new THREE.Vector3(0, STEM + 0.075, 0)
function flightAt(s, out = new THREE.Vector3()) {
  const u = Math.max(0, Math.min(1, s / FLIGHT))
  const e = smooth(0, 0.14, u) * (1 - smooth(0.84, 1, u))
  const th = u * TAU
  return out.set(REST.x + Math.sin(th) * 0.6 * e, REST.y + (0.36 + 0.07 * Math.sin(th * 2)) * e, REST.z + Math.sin(th) * Math.cos(th) * 0.8 * e)
}
const envAt = (s) => {
  const u = s / FLIGHT
  return s < 0 || s > FLIGHT ? 0 : smooth(0, 0.1, u) * (1 - smooth(0.88, 1, u))
}

export function Butterfly({ look = 'monarch' }) {
  const L = LOOKS[look] || LOOKS.monarch
  const { tap, handlers, clock } = useTap(1)
  const fly = useRef()
  const wings = useRef([])
  const st = useRef({ yaw: 0, raw: 0, on: false, rate: 0 })
  const v0 = useRef(new THREE.Vector3())
  const v1 = useRef(new THREE.Vector3())
  const hind = L.tails ? HIND_TAIL : HIND

  const geo = useGeo(
    () => ({
      fore: { base: plate(FORE, 11), inner: plate(shrink(FORE, 0.7), 12), core: plate(shrink(FORE, 0.38), 13) },
      hind: { base: plate(hind, 21), inner: plate(shrink(hind, 0.68), 22), core: plate(shrink(hind, 0.36), 23) },
      vein: new THREE.BoxGeometry(1, 0.001, 0.006),
      spot: new THREE.CircleGeometry(0.013, 5).rotateX(-Math.PI / 2),
      head: blob(0.03, 3),
      thorax: blob(0.038, 4),
      seg: blob(0.03, 5, 0),
      antenna: new THREE.CylinderGeometry(0.0025, 0.0035, 0.15, 3, 1).translate(0, 0.075, 0),
      knob: new THREE.IcosahedronGeometry(0.009, 0),
      leg: new THREE.CylinderGeometry(0.003, 0.003, 0.05, 3, 1).translate(0, -0.025, 0),
      mound: facet(new THREE.CylinderGeometry(0.5, 0.58, 0.08, 10, 1).translate(0, 0.04, 0), 0.02, 31, [1, 0.4, 1], (x, y) => y < 0.001),
      stem: new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.05, 0), new THREE.Vector3(0.05, 0.35, 0.02), new THREE.Vector3(-0.02, 0.65, -0.01), new THREE.Vector3(0, STEM, 0)]), 8, 0.024, 5),
      leaf: facet(new THREE.IcosahedronGeometry(0.12, 0), 0.008, 33).scale(0.55, 0.14, 1.5).translate(0, 0, 0.16),
      petal: facet(new THREE.IcosahedronGeometry(0.12, 0), 0.008, 34).scale(0.85, 0.18, 1.5).translate(0, 0, 0.19),
      heart: blob(0.085, 35),
      cup: facet(new THREE.ConeGeometry(0.08, 0.1, 6, 1).rotateX(Math.PI), 0.006, 36),
      tuft: new THREE.ConeGeometry(0.05, 0.16, 3, 1).translate(0, 0.08, 0),
      hit: new THREE.CylinderGeometry(0.55, 0.55, 1.6, 8).translate(0, 0.8, 0),
      sparkle: new THREE.OctahedronGeometry(1, 0),
    }),
    [L.tails],
  )

  const onClick = (e) => {
    e.stopPropagation()
    const s = tap.since(clock.elapsedTime)
    if (s >= 0 && s < FLIGHT) return // already flying
    handlers.onClick(e)
  }

  useFrame((_, dt) => {
    const t = clock.elapsedTime
    const s = tap.since(t)
    const e = envAt(s)
    const o = fly.current
    const S = st.current
    // idle: a slow bask, opening and closing; in the air: a fast flap
    const bask = 0.5 + 0.95 * pulse01(t)
    const flap = 0.45 + 0.85 * Math.sin(t * 30)
    const a = bask + (flap - bask) * e
    wings.current.forEach((w, i) => w && (w.rotation.z = (i ? 1 : -1) * a))

    if (e <= 0) {
      o.position.copy(REST)
      o.rotation.set(-0.08, REST_YAW, 0, 'YXZ')
      S.on = false
      return
    }
    const p = flightAt(s, v0.current)
    const q = flightAt(s + 0.03, v1.current)
    o.position.copy(p)
    o.position.y += Math.sin(t * 30) * 0.012 * e // each wing beat lifts it
    // heading from the horizontal velocity, unwrapped so turns never jump
    const raw = Math.atan2(q.x - p.x, q.z - p.z)
    if (!S.on) {
      S.on = true
      S.raw = raw
      S.yaw = raw + Math.round((REST_YAW - raw) / TAU) * TAU
      S.rate = 0
    }
    let d = raw - S.raw
    d -= Math.round(d / TAU) * TAU
    S.raw = raw
    S.yaw += d
    S.rate += (d / Math.max(dt, 1e-3) - S.rate) * 0.15
    const yaw = REST_YAW + (S.yaw - REST_YAW) * e
    const bank = Math.max(-0.7, Math.min(0.7, -S.rate * 0.25)) * e
    const climb = (q.y - p.y) / 0.03
    o.rotation.set(-0.08 - Math.max(-0.4, Math.min(0.4, climb * 0.5)) * e, yaw, bank, 'YXZ')
  })

  return (
    <group {...handlers} onClick={onClick}>
      <mesh geometry={geo.hit}>
        <meshBasicMaterial visible={false} />
      </mesh>
      {/* the grass mound and the flower */}
      <mesh geometry={geo.mound}>
        <Flat color="#7fbf52" />
      </mesh>
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <mesh key={i} geometry={geo.tuft} position={[Math.cos(i * 0.9 + 0.4) * (0.25 + (i % 3) * 0.07), 0.07, Math.sin(i * 0.9 + 0.4) * (0.25 + (i % 3) * 0.07)]} rotation={[0.2 * Math.sin(i), i, 0.2 * Math.cos(i)]} scale={0.7 + (i % 2) * 0.4}>
          <Flat color={i % 2 ? '#5fa63c' : '#6fb547'} />
        </mesh>
      ))}
      <mesh geometry={geo.stem}>
        <Flat color="#4f9a3a" />
      </mesh>
      {[0.3, 0.5].map((y, i) => (
        <mesh key={y} geometry={geo.leaf} position={[0.03, y, 0]} rotation={[0.55, i ? 2.4 : -0.6, 0]}>
          <Flat color={i ? '#3f8a3a' : '#4a9a40'} />
        </mesh>
      ))}
      <group position-y={STEM}>
        <mesh geometry={geo.cup} position-y={-0.02}>
          <Flat color="#4f9a3a" />
        </mesh>
        {Array.from({ length: 9 }, (_, i) => (
          <mesh key={i} geometry={geo.petal} rotation={[-0.5, (i / 9) * TAU, 0]} position-y={0.01}>
            <Flat color={L.petal[i % 2]} />
          </mesh>
        ))}
        <mesh geometry={geo.heart} position-y={0.02} scale={[1, 0.45, 1]}>
          <Flat color={L.heart} />
        </mesh>
      </group>

      {/* the butterfly, head along +z */}
      <group ref={fly} position={REST.toArray()}>
        <group scale={SCALE}>
          <mesh geometry={geo.head} position={[0, 0.006, 0.07]}>
            <Flat color={L.body} />
          </mesh>
          <mesh geometry={geo.thorax} position-z={0.02} scale={[0.85, 0.85, 1.25]}>
            <Flat color={L.body} />
          </mesh>
          {[0.032, 0.028, 0.023, 0.017].map((r, i) => (
            <mesh key={i} geometry={geo.seg} position={[0, -0.002 * i, -0.035 - i * 0.03]} scale={[r / 0.03, r / 0.03, (r / 0.03) * 1.15]}>
              <Flat color={i % 2 ? L.body : L.edge} />
            </mesh>
          ))}
          {[-1, 1].map((x) => (
            <group key={x} position={[x * 0.012, 0.025, 0.088]} rotation={[0.95, 0, -x * 0.35]}>
              <mesh geometry={geo.antenna}>
                <Flat color={L.body} />
              </mesh>
              <mesh geometry={geo.knob} position-y={0.15}>
                <Flat color={L.body} />
              </mesh>
            </group>
          ))}
          {[-1, 1].map((x) =>
            [0.045, 0.02, -0.005].map((z) => (
              <mesh key={`${x}${z}`} geometry={geo.leg} position={[x * 0.018, -0.02, z]} rotation={[z * 4, 0, x * 0.5]}>
                <Flat color={L.body} />
              </mesh>
            )),
          )}
          {/* the wings: hinged at the shoulders, mirrored for the left side */}
          {[-1, 1].map((side, i) => (
            <group key={side} ref={(el) => (wings.current[i] = el)} position={[side * 0.016, 0.018, 0.012]}>
              <group scale={[side, 1, 1]}>
                <WingSet L={L} geo={geo} outline={FORE} which="fore" />
                <group rotation-y={0.08}>
                  <WingSet L={L} geo={geo} outline={hind} which="hind" />
                </group>
              </group>
            </group>
          ))}
        </group>
      </group>
      <Burst tap={tap} geometry={geo.sparkle} count={10} colors={[L.wing, L.heart, '#ffffff']} speed={0.9} gravity={1.2} size={0.022} life={1.1} origin={[0, STEM + 0.08, 0]} up={1.1} />
    </group>
  )
}

// a slow 0..1 bask: lingers open and closed, turning between
function pulse01(t) {
  const x = 0.5 + 0.5 * Math.sin(t * 0.22 * TAU)
  return x * x * (3 - 2 * x)
}

export default function ButterflyScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[2.7, 1.9, 3.6]} target={[0, 0.95, 0]} hint="It rests on the flower, slowly opening and closing its wings · tap it and it takes off, flies a figure-eight above the flower with its wings beating fast, and lands back · Look swaps monarch, morpho, swallowtail and pink · drag to orbit">
      <Butterfly {...props} />
    </Stage>
  )
}
