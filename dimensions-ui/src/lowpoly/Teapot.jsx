import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Flat, Particles, Stage, TAU, facet, useGeo, useTap, wobble } from './kit.jsx'

// A low-poly teapot on a tray with a cup and saucer: a round lathe-turned
// pot with a banded shoulder, a tapering spout, a looped handle and a lid
// with a knob. Steam curls up from the spout in soft, fading puffs. Tap it
// and the pot lifts and tilts, a stream of tea arcs from the spout into the
// cup and the level rises, a few drops splash, then the pot sets back down
// with a rattle of its lid.

const LOOKS = {
  porcelain: { body: '#f4f1ea', accent: '#4f7fc8', knob: '#4f7fc8', rough: 0.4, cup: '#f4f1ea', tray: '#c9ced8', trayMetal: 0.35 },
  'cast-iron': { body: '#3a3d44', accent: '#c8a24a', knob: '#c8a24a', rough: 0.75, cup: '#c96a3a', tray: '#d2b07a', trayMetal: 0 },
  floral: { body: '#fbeef0', accent: '#e86a8a', knob: '#f6c93a', rough: 0.45, cup: '#fbeef0', tray: '#a8dcc8', trayMetal: 0, flowers: true },
}
const TRAY = 0.06 // tray top
const POT_X = -0.32
const PIVOT = 0.3 // the pot tips about its base edge, this far toward the cup
const CUP = [0.86, 0.02] // cup x, z
const SAUCER = 0.04
const TILT = 0.72
const LIFT = 0.42
const UP = 0.7 // seconds to lift and tilt
const POUR = 2.0 // seconds of pouring
const DOWN = 0.7
const BODY = [
  [0.001, 0],
  [0.28, 0],
  [0.34, 0.03],
  [0.45, 0.16],
  [0.5, 0.33],
  [0.47, 0.5],
  [0.38, 0.61],
  [0.25, 0.66],
  [0.001, 0.66],
]
const LID = [
  [0.001, 0.13],
  [0.07, 0.12],
  [0.18, 0.07],
  [0.26, 0.01],
  [0.26, 0],
  [0.001, 0],
]
const CUPP = [
  [0.001, 0],
  [0.11, 0],
  [0.14, 0.03],
  [0.19, 0.18],
  [0.2, 0.21],
  [0.18, 0.215],
  [0.17, 0.2],
  [0.125, 0.05],
  [0.001, 0.05],
]
const TIP = new THREE.Vector3(0.84, 0.62, 0) // spout mouth, pot space
const SEGS = 10

const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x))
const lathe = (pts, n) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), n)

// how far the pot is tipped (0..1) and how hard it pours (0..1) s seconds
// after a tap
function pourAt(s) {
  if (s < 0) return [0, 0]
  const tip = s < UP ? ease(s / UP) : s < UP + POUR ? 1 : ease(1 - (s - UP - POUR) / DOWN)
  const flow = s < UP - 0.15 || s > UP + POUR + 0.1 ? 0 : Math.min(1, (s - UP + 0.15) / 0.25, (UP + POUR + 0.1 - s) / 0.25)
  return [tip, flow]
}

// the cup fills while the tea pours, then is slowly sipped back down
function fillAt(s) {
  const lo = 0.3
  if (s < UP) return lo
  if (s < UP + POUR) return lo + (0.88 - lo) * ease((s - UP) / POUR)
  if (s < 7) return 0.88
  return lo + (0.88 - lo) * (1 - ease((s - 7) / 4))
}

const _w = new THREE.Vector3()
const _a = new THREE.Vector3()
const _b = new THREE.Vector3()
const _d = new THREE.Vector3()
const _y = new THREE.Vector3(0, 1, 0)

export function Teapot({ look = 'porcelain' }) {
  const L = LOOKS[look] || LOOKS.porcelain
  const { tap, handlers, clock } = useTap(1)
  const root = useRef()
  const pivot = useRef()
  const lid = useRef()
  const tipRef = useRef()
  const tea = useRef()
  const stream = useRef([])
  const pouring = useRef(0)

  const geo = useGeo(
    () => ({
      tray: facet(lathe([[0.001, 0], [1.05, 0], [1.12, 0.05], [1.14, 0.1], [1.09, 0.1], [1.03, TRAY], [0.001, TRAY]], 12).scale(1, 1, 0.62).rotateY(Math.PI / 12), 0.006, 1),
      body: facet(lathe(BODY, 12), 0.01, 2),
      band: new THREE.TorusGeometry(0.43, 0.018, 4, 16).rotateX(Math.PI / 2),
      foot: new THREE.TorusGeometry(0.31, 0.02, 4, 16).rotateX(Math.PI / 2),
      lid: facet(lathe(LID, 12), 0.005, 3),
      knob: facet(new THREE.IcosahedronGeometry(0.06, 0).scale(1, 1.1, 1), 0.004, 4),
      spout: (() => {
        const g = new THREE.CylinderGeometry(0.05, 0.1, 0.56, 7, 3, true)
        // bend it: the mouth curls up a touch
        const p = g.attributes.position
        for (let i = 0; i < p.count; i++) {
          const y = p.getY(i)
          const u = (y + 0.28) / 0.56
          p.setX(i, p.getX(i) - u * u * 0.06)
        }
        g.computeVertexNormals()
        return facet(g, 0.004, 5)
      })(),
      handle: facet(new THREE.TorusGeometry(0.22, 0.045, 6, 10, Math.PI * 1.15).rotateZ(Math.PI * 0.425), 0.006, 6),
      cup: facet(lathe(CUPP, 12), 0.004, 7),
      cupHandle: facet(new THREE.TorusGeometry(0.08, 0.025, 5, 8, Math.PI * 1.2).rotateZ(-Math.PI * 0.6), 0.003, 8),
      saucer: facet(lathe([[0.001, 0], [0.18, 0], [0.3, 0.035], [0.33, 0.05], [0.29, 0.05], [0.18, 0.025], [0.001, 0.025]], 14), 0.004, 9),
      tea: new THREE.CircleGeometry(1, 12).rotateX(-Math.PI / 2),
      seg: new THREE.CylinderGeometry(1, 1, 1, 6, 1, true).translate(0, 0.5, 0),
      petal: facet(new THREE.IcosahedronGeometry(0.035, 0).scale(1, 1, 0.35), 0.003, 10),
      dot: new THREE.IcosahedronGeometry(0.022, 0).scale(1, 1, 0.5),
      leaf: new THREE.IcosahedronGeometry(0.03, 0).scale(1.6, 0.7, 0.3),
      puff: new THREE.IcosahedronGeometry(1, 0),
      spoon: new THREE.BoxGeometry(0.34, 0.012, 0.035),
      bowl: facet(new THREE.SphereGeometry(0.045, 6, 3).scale(1.4, 0.3, 1), 0.003, 11),
      sugar: new THREE.BoxGeometry(0.07, 0.07, 0.07),
    }),
    [],
  )

  useFrame(() => {
    const t = clock.elapsedTime
    const s = tap.since(t)
    const [k, flow] = pourAt(s)
    pouring.current = flow
    // lift and tip about the base edge nearest the cup
    pivot.current.position.y = TRAY + LIFT * k
    pivot.current.rotation.z = -TILT * k + Math.sin(t * 1.1) * 0.012 * (1 - k)
    // the lid rattles as the pot is set down
    const r = wobble(s - UP - POUR - DOWN + 0.05, 30, 7)
    lid.current.rotation.z = r * 0.05 + k * 0.04
    lid.current.position.y = 0.64 + Math.abs(r) * 0.015
    // the tea in the cup
    const f = fillAt(s)
    const y = 0.05 + f * 0.15
    const rad = 0.125 + ((y - 0.05) / 0.15) * 0.045
    tea.current.position.y = SAUCER + y
    tea.current.scale.setScalar(rad)
    // the stream: thrown from the spout mouth and landing in the middle of
    // the cup, a chain of tapering segments along the arc
    tipRef.current.getWorldPosition(_w)
    root.current.worldToLocal(_w)
    const surf = SAUCER + y
    const drop = _w.y - surf
    const tau = Math.sqrt(Math.max(0.001, (2 * drop) / 4))
    const vx = (CUP[0] - 0.02 - _w.x) / tau
    const vz = (CUP[1] - _w.z) / tau
    const wob = Math.sin(t * 23) * 0.004
    stream.current.forEach((m, i) => {
      if (!m) return
      m.visible = flow > 0.01 && drop > 0.02
      if (!m.visible) return
      const at = (u, out) => out.set(_w.x + vx * u * tau + wob * u, _w.y - 2 * (u * tau) ** 2, _w.z + vz * u * tau)
      at(i / SEGS, _a)
      at((i + 1) / SEGS, _b)
      _d.subVectors(_b, _a)
      const len = _d.length()
      m.position.copy(_a)
      m.quaternion.setFromUnitVectors(_y, _d.normalize())
      const w = 0.024 * flow * (1 - (i / SEGS) * 0.35)
      m.scale.set(w, len * 1.02, w)
    })
  })

  const pouringNow = () => pouring.current
  const notPouring = () => 1 - pouring.current

  return (
    <group ref={root} {...handlers}>
      <mesh geometry={geo.tray} position-x={0.1}>
        <Flat color={L.tray} metalness={L.trayMetal} roughness={0.45} side={THREE.DoubleSide} />
      </mesh>

      {/* the pot, on a pivot at the edge of its base */}
      <group ref={pivot} position={[POT_X + PIVOT, TRAY, 0]}>
        <group position-x={-PIVOT}>
          <mesh geometry={geo.body}>
            <Flat color={L.body} roughness={L.rough} />
          </mesh>
          <mesh geometry={geo.foot} position-y={0.02}>
            <Flat color={L.accent} roughness={0.5} />
          </mesh>
          <mesh geometry={geo.band} position-y={0.55}>
            <Flat color={L.accent} roughness={0.5} />
          </mesh>
          <mesh geometry={geo.spout} position={[0.62, 0.42, 0]} rotation-z={-0.82}>
            <Flat color={L.body} roughness={L.rough} side={THREE.DoubleSide} />
          </mesh>
          <group ref={tipRef} position={TIP} />
          <mesh geometry={geo.handle} position={[-0.56, 0.36, 0]}>
            <Flat color={L.body} roughness={L.rough} />
          </mesh>
          <group ref={lid} position-y={0.64}>
            <mesh geometry={geo.lid}>
              <Flat color={L.body} roughness={L.rough} />
            </mesh>
            <mesh geometry={geo.knob} position-y={0.17}>
              <Flat color={L.knob} roughness={0.4} />
            </mesh>
          </group>
          {L.flowers &&
            [0.55, 1.5, 2.5, -0.5, -1.4, -2.4].map((a, j) => (
              <group key={a} position={[Math.cos(a) * 0.5, 0.32 + (j % 2) * 0.05, -Math.sin(a) * 0.5]} rotation-y={a + Math.PI / 2} scale={1.6}>
                {Array.from({ length: 5 }, (_, i) => (
                  <mesh key={i} geometry={geo.petal} position={[Math.cos((i / 5) * TAU) * 0.04, Math.sin((i / 5) * TAU) * 0.04, 0]}>
                    <Flat color={j % 2 ? '#f6a6c0' : '#e86a8a'} />
                  </mesh>
                ))}
                <mesh geometry={geo.dot} position-z={0.01}>
                  <Flat color="#f6c93a" />
                </mesh>
                <mesh geometry={geo.leaf} position={[0.075, -0.05, -0.005]} rotation-z={-0.5}>
                  <Flat color="#5cae6a" />
                </mesh>
              </group>
            ))}
          {/* steam curls from the spout */}
          <Particles geometry={geo.puff} count={14} life={2.6} origin={[TIP.x, TIP.y + 0.06, 0]} spread={0.04} velocity={[0.02, 0.32, 0]} scatter={0.05} drift={0.16} size={[0.02, 0.075]} colors={['#ffffff', '#eceef2']} opacity={[0.7, 0]} active={notPouring} seed={4} />
          <Particles geometry={geo.puff} count={8} life={2.2} origin={[0, 0.86, 0]} spread={0.08} velocity={[0, 0.25, 0]} scatter={0.04} drift={0.14} size={[0.02, 0.06]} colors={['#ffffff']} opacity={[0.45, 0]} active={notPouring} seed={9} />
        </group>
      </group>

      {/* the stream of tea */}
      {Array.from({ length: SEGS }, (_, i) => (
        <mesh key={i} ref={(el) => (stream.current[i] = el)} geometry={geo.seg} visible={false}>
          <meshStandardMaterial color="#b0602a" emissive="#7a3a12" emissiveIntensity={0.25} flatShading roughness={0.2} transparent opacity={0.92} />
        </mesh>
      ))}

      {/* cup and saucer */}
      <group position={[CUP[0], TRAY, CUP[1]]}>
        <mesh geometry={geo.saucer}>
          <Flat color={L.cup} roughness={0.4} side={THREE.DoubleSide} />
        </mesh>
        <group position-y={SAUCER}>
          <mesh geometry={geo.cup}>
            <Flat color={L.cup} roughness={0.4} side={THREE.DoubleSide} />
          </mesh>
          <mesh geometry={geo.band} position-y={0.19} scale={[0.45, 1, 0.45]}>
            <Flat color={L.accent} roughness={0.5} />
          </mesh>
          <mesh geometry={geo.cupHandle} position={[0.2, 0.11, 0]}>
            <Flat color={L.cup} roughness={0.4} />
          </mesh>
        </group>
        <mesh ref={tea} geometry={geo.tea} position-y={0.1}>
          <Flat color="#9a4f1e" roughness={0.2} />
        </mesh>
        <Particles geometry={geo.puff} count={10} life={0.5} origin={[-0.02, SAUCER + 0.16, 0]} spread={0.04} velocity={[0, 0.9, 0]} scatter={0.5} gravity={5} drift={0} size={[0.018, 0.008]} colors={['#c8763a', '#e0a060']} opacity={[0.9, 0.6]} active={pouringNow} seed={6} />
        {/* a spoon and a sugar cube on the saucer */}
        <group position={[0.06, 0.06, 0.25]} rotation-y={-0.3}>
          <mesh geometry={geo.spoon} position-x={0.08}>
            <Flat color="#c9ced8" metalness={0.4} roughness={0.35} />
          </mesh>
          <mesh geometry={geo.bowl} position-x={-0.12}>
            <Flat color="#c9ced8" metalness={0.4} roughness={0.35} />
          </mesh>
        </group>
      </group>
      <mesh geometry={geo.sugar} position={[0.5, TRAY + 0.035, 0.44]} rotation-y={0.4}>
        <Flat color="#ffffff" />
      </mesh>
      <mesh geometry={geo.sugar} position={[0.6, TRAY + 0.035, 0.5]} rotation-y={1.1}>
        <Flat color="#ffffff" />
      </mesh>
    </group>
  )
}

export default function TeapotScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[1.6, 2.6, 4.4]} target={[0.1, 0.45, 0]} hint="Steam curls up from the spout on its own · tap it and the pot lifts and tilts, pours a stream of tea into the cup and the level rises, then it sets back down with a rattle of its lid · Look swaps porcelain, cast iron and floral · drag to orbit">
      <Teapot {...props} />
    </Stage>
  )
}
