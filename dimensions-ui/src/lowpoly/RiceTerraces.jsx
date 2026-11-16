import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { Burst, Flat, Flow, Ripple, Stage, TAU, Water, blob, cone, facet, ribbonGeo, rng, useGeo, useTap } from './kit.jsx'

// Low-poly rice terraces: a hill built of curving steps, each step a paddy
// of still water held in by a low grassy bund and planted with rows of rice
// tufts, the steps wide at the front and pinched at the back as the hill
// leans away, with a hut and a tree on the crown and a little pond at the
// foot. Ripples drift across every paddy and the rice stirs in the breeze.
// Tap it and the spring on the crown runs: the water spills over the lip of
// the top paddy, fills it, spills on to the next, and so on down the hill,
// step by step, into the pond; then the levels slowly settle back.

const LOOKS = {
  spring: { water: '#8fd2e6', water2: '#bfe9f4', rice: ['#86d06a', '#a2e07c', '#6fc05a'], tuft: 0.07, bund: '#79b14c', wall: '#8b6a4a', wall2: '#7a5c40', ground: '#86c25e', tree: '#f2a6c4', hut: '#d8b07a', roof: '#a5683c' },
  summer: { water: '#5fb6cc', water2: '#9fdbe8', rice: ['#3e9b3a', '#55b148', '#2f8a32'], tuft: 0.11, bund: '#5d9a3c', wall: '#7f6044', wall2: '#6e523a', ground: '#5fae48', tree: '#3f8f42', hut: '#d8b07a', roof: '#a5683c' },
  harvest: { water: '#7fb1b9', water2: '#b5d7dc', rice: ['#e5b43a', '#f0c955', '#d2982a'], tuft: 0.12, bund: '#a5a04a', wall: '#93694a', wall2: '#80593c', ground: '#b5ac52', tree: '#e07a2a', hut: '#d8b07a', roof: '#8f5530' },
}

const LEVELS = 6 // five paddies and the crown
const BASE_R = 1.45
const STEP_R = 0.22
const STEP_H = 0.16
const BACK = 0.07 // each step sits this much further back than the one below
const BUND = 0.045 // bund width
const BUND_H = 0.05
const IDLE_FILL = 0.45
const POND = [0, 1.75]
const SEGS = 40

const wob = (a) => 0.06 * Math.sin(2 * a + 0.5) + 0.04 * Math.sin(5 * a)
const R = (k) => BASE_R - k * STEP_R
const H = (k) => 0.1 + k * STEP_H
const C = (k) => -k * BACK // centre z of level k
// a point on level k's edge at angle a (a = pi/2 faces the front, +z), pulled in by inset
const edge = (k, a, inset = 0) => {
  const r = R(k) * (1 + wob(a)) - inset
  return [Math.cos(a) * r, C(k) + Math.sin(a) * r]
}

// a closed contour as a Shape in the (x, -z) plane, so that rotating -90
// degrees about x lays it down at world (x, z)
function contour(k, inset = 0, path = new THREE.Shape()) {
  for (let i = 0; i < SEGS; i++) {
    const [x, z] = edge(k, (i / SEGS) * TAU, inset)
    i ? path.lineTo(x, -z) : path.moveTo(x, -z)
  }
  path.closePath()
  return path
}
function holeContour(k, inset) {
  const p = new THREE.Path()
  for (let i = SEGS; i > 0; i--) {
    const [x, z] = edge(k, (i / SEGS) * TAU, inset)
    i === SEGS ? p.moveTo(x, -z) : p.lineTo(x, -z)
  }
  p.closePath()
  return p
}

// The spill paths: level k pours over its front lip on to level k - 1 (and
// level 0 into the pond). Each zigzags a little to the side of the one above.
const spillAngle = (k) => Math.PI / 2 + (k % 2 ? 0.32 : -0.32) * (k === 0 ? 0 : 1)
function spillPath(k) {
  const a = spillAngle(k)
  const [x0, z0] = edge(k, a, 0.01)
  const y0 = H(k) + BUND_H
  const y1 = k === 0 ? 0.06 : H(k - 1) + 0.03
  const out = k === 0 ? POND[1] - 0.12 - z0 : STEP_R * 0.45
  const dx = Math.cos(a)
  const dz = Math.sin(a)
  return (u) => new THREE.Vector3(x0 + dx * out * u, y0 - (y0 - y1) * (u < 0.15 ? 0 : ((u - 0.15) / 0.85) ** 1.6) + (u < 0.15 ? 0.01 : 0), z0 + dz * out * u)
}

// timing of the cascade after a tap (seconds): spill k starts at spillAt(k),
// and paddy k starts to fill once spill k + 1 reaches it
const spillAt = (k) => (LEVELS - 1 - k) * 0.6
const smooth = THREE.MathUtils.smoothstep
const spillAmount = (s, k) => smooth(s, spillAt(k), spillAt(k) + 0.25) * (1 - smooth(s, spillAt(k) + 2.4, spillAt(k) + 3.4))
const fillAmount = (s, k) => smooth(s, spillAt(k + 1) + 0.15, spillAt(k + 1) + 0.75) * (1 - smooth(s, 6.5, 10))

export function RiceTerraces({ look = 'spring' }) {
  const L = LOOKS[look] || LOOKS.spring
  const { tap, handlers, clock } = useTap(1)
  const waters = useRef([])
  const sheets = useRef([])
  const tufts = useRef()
  const geo = useGeo(() => {
    const steps = []
    const bunds = []
    const waterG = []
    for (let k = 0; k < LEVELS; k++) {
      const solid = new THREE.ExtrudeGeometry(contour(k), { depth: H(k), bevelEnabled: false, curveSegments: 1 }).rotateX(-Math.PI / 2)
      steps.push(facet(solid, 0.012, 3 + k, [1, 0, 1]))
      if (k < LEVELS - 1) {
        const ring = contour(k)
        ring.holes.push(holeContour(k, BUND))
        bunds.push(facet(new THREE.ExtrudeGeometry(ring, { depth: BUND_H, bevelEnabled: false, curveSegments: 1 }).rotateX(-Math.PI / 2), 0.01, 20 + k, [1, 0.3, 1], (x, y) => y < 0.001))
        waterG.push(new THREE.ShapeGeometry(contour(k, BUND * 0.6), 1).rotateX(-Math.PI / 2))
      }
    }
    const blade = (h, lean, turn) => new THREE.ConeGeometry(0.022, h, 3, 1).translate(0, h / 2, 0).rotateZ(lean).rotateY(turn)
    return {
      steps,
      bunds,
      waterG,
      tuft: mergeGeometries([blade(1, 0, 0), blade(0.85, 0.24, 0.4), blade(0.8, -0.22, -0.6), blade(0.75, 0.22, 2.2)]),
      ground: facet(new THREE.CylinderGeometry(2.05, 2.1, 0.06, 22, 1).translate(0, 0.03, 0), 0.03, 1, [1, 0.3, 1]),
      crown: blob(0.13, 4),
      trunk: new THREE.CylinderGeometry(0.025, 0.035, 0.18, 5).translate(0, 0.09, 0),
      pine: cone(0.11, 0.28, 6, 5),
      hut: facet(new THREE.BoxGeometry(0.2, 0.13, 0.16).translate(0, 0.065, 0), 0.006, 2),
      roof: facet(new THREE.ConeGeometry(0.19, 0.14, 4).rotateY(Math.PI / 4).translate(0, 0.07, 0), 0.008, 3),
      stone: blob(1, 9, 0),
      drop: new THREE.OctahedronGeometry(1, 0),
    }
  }, [])
  // spill k (k = 1..5 into k - 1, and 0 into the pond): paths by the level they leave
  const paths = useMemo(() => Array.from({ length: LEVELS }, (_, k) => spillPath(k)), [])
  const spillGeo = useGeo(() => paths.map((p) => ribbonGeo(p, 0.1, 14)), [paths])

  // the rice: two rows round each paddy, between the next step up and the bund
  const rice = useMemo(() => {
    const r = rng(31)
    const out = []
    for (let k = 0; k < LEVELS - 1; k++) {
      const n = Math.round(R(k) * 19)
      for (const f of [0.3, 0.68]) {
        for (let i = 0; i < n; i++) {
          const a = ((i + (f > 0.5 ? 0.5 : 0)) / n) * TAU + (r() - 0.5) * 0.06
          const a2 = a
          const [ix, iz] = edge(k + 1, a2)
          const [ox, oz] = edge(k, a2, BUND * 1.4)
          // keep clear of the spill lanes
          const near = (b) => Math.abs(((a - spillAngle(b) + Math.PI) % TAU + TAU) % TAU - Math.PI) < 0.09
          if (near(k + 1) || near(k)) continue
          out.push({ x: ix + (ox - ix) * f, z: iz + (oz - iz) * f, y: H(k), k, s: 0.85 + r() * 0.35, ry: r() * TAU, ph: r() * TAU, c: r() })
        }
      }
    }
    return out
  }, [])
  // ripples: two spots on the midline of each paddy
  const rippleSpots = useMemo(() => {
    const r = rng(17)
    const out = []
    for (let k = 0; k < LEVELS - 1; k++)
      for (let j = 0; j < 2; j++) {
        const a = r() * TAU
        const [ix, iz] = edge(k + 1, a)
        const [ox, oz] = edge(k, a, BUND)
        out.push({ p: [(ix + ox) / 2, H(k) + BUND_H - 0.004, (iz + oz) / 2], k, period: 2.2 + r() * 1.4, off: r() })
      }
    return out
  }, [])
  // a tap-kick per paddy, delayed to when the water reaches it
  const paddyKick = useMemo(() => Array.from({ length: LEVELS }, (_, k) => ({ since: (t) => tap.since(t) - (spillAt(k + 1) + 0.15) })), [tap])

  const dummy = useMemo(() => new THREE.Object3D(), [])
  const col = useMemo(() => new THREE.Color(), [])
  useEffect(() => {
    const m = tufts.current
    if (!m) return
    rice.forEach((b, i) => m.setColorAt(i, col.set(L.rice[Math.floor(b.c * 3)]).multiplyScalar(0.94 + b.s * 0.08)))
    m.instanceColor.needsUpdate = true
  }, [look, rice, col]) // eslint-disable-line react-hooks/exhaustive-deps

  useFrame(() => {
    const t = clock.elapsedTime
    const s = tap.since(t)
    // the water levels
    for (let k = 0; k < LEVELS - 1; k++) {
      const w = waters.current[k]
      if (!w) continue
      const f = IDLE_FILL + (1 - IDLE_FILL) * fillAmount(s, k)
      w.position.y = H(k) + 0.006 + f * (BUND_H - 0.012) + Math.sin(t * 1.6 + k) * 0.002
      w.material.emissiveIntensity = 0.06 + 0.25 * fillAmount(s, k)
    }
    // the spill sheets
    for (let k = 0; k < LEVELS; k++) {
      const m = sheets.current[k]
      if (!m) continue
      const a = spillAmount(s, k)
      m.visible = a > 0.01
      m.material.opacity = 0.9 * a
    }
    // the rice stirs in a breeze that runs across the hill
    const m = tufts.current
    if (m) {
      rice.forEach((b, i) => {
        const sway = 0.12 * Math.sin(t * 1.8 + b.x * 2.2 + b.z * 1.4) + 0.04 * Math.sin(t * 4.1 + b.ph)
        dummy.position.set(b.x, b.y, b.z)
        dummy.rotation.set(sway * 0.6, b.ry, sway)
        dummy.scale.set(b.s, b.s * L.tuft * 1.15, b.s)
        dummy.updateMatrix()
        m.setMatrixAt(i, dummy.matrix)
      })
      m.instanceMatrix.needsUpdate = true
    }
  })

  return (
    <group {...handlers}>
      <mesh geometry={geo.ground}>
        <Flat color={L.ground} />
      </mesh>
      {/* the steps: earth walls and grassy tops, the bunds and the water */}
      {geo.steps.map((g, k) => (
        <mesh key={k} geometry={g}>
          <Flat attach="material-0" color={k === LEVELS - 1 ? L.ground : L.bund} />
          <Flat attach="material-1" color={k % 2 ? L.wall : L.wall2} />
        </mesh>
      ))}
      {geo.bunds.map((g, k) => (
        <mesh key={k} geometry={g} position-y={H(k)}>
          <Flat color={L.bund} />
        </mesh>
      ))}
      {geo.waterG.map((g, k) => (
        <mesh key={k} ref={(el) => (waters.current[k] = el)} geometry={g}>
          <meshStandardMaterial color={L.water} emissive={L.water2} emissiveIntensity={0.06} flatShading roughness={0.2} metalness={0.05} />
        </mesh>
      ))}
      {rippleSpots.map((r, i) => (
        <group key={i} position={r.p}>
          <Ripple loop period={r.period} count={2} color="#ffffff" radius={0.16} opacity={0.6} y={0} />
          <Ripple tap={paddyKick[r.k]} count={2} color="#ffffff" radius={0.3} opacity={0.75} life={1} y={0} />
        </group>
      ))}
      <instancedMesh ref={tufts} args={[geo.tuft, undefined, rice.length]} frustumCulled={false} raycast={() => null}>
        <Flat color="#ffffff" />
      </instancedMesh>

      {/* the spills down the steps */}
      {paths.map((p, k) => (
        <group key={k}>
          <mesh ref={(el) => (sheets.current[k] = el)} geometry={spillGeo[k]} visible={false}>
            <meshStandardMaterial color={L.water2} emissive={L.water2} emissiveIntensity={0.2} flatShading roughness={0.25} transparent depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
          <Flow path={p} count={14} speed={1.1} width={0.07} size={0.016} stretch={3} colors={['#ffffff', L.water2]} opacity={0.95} active={() => spillAmount(tap.since(clock.elapsedTime), k)} seed={k + 2} />
        </group>
      ))}

      {/* the crown: a hut, a tree and the spring */}
      <group position={[0.06, H(LEVELS - 1), C(LEVELS - 1) - 0.06]}>
        <mesh geometry={geo.hut} position={[-0.1, 0, 0.02]} rotation-y={0.4}>
          <Flat color={L.hut} />
        </mesh>
        <mesh geometry={geo.roof} position={[-0.1, 0.13, 0.02]} rotation-y={0.4}>
          <Flat color={L.roof} />
        </mesh>
        <group position={[0.15, 0, -0.1]}>
          <mesh geometry={geo.trunk}>
            <Flat color="#6b4a30" />
          </mesh>
          <mesh geometry={geo.crown} position-y={0.24} scale={[1.2, 1, 1.2]}>
            <Flat color={L.tree} />
          </mesh>
        </group>
        <Burst tap={tap} geometry={geo.drop} count={12} colors={['#ffffff', L.water2]} speed={0.9} gravity={3} size={0.025} life={0.8} origin={[0.05, 0.02, 0.2]} spread={0.5} up={1.3} seed={5} />
      </group>
      {/* pines round the foot */}
      {[[-1.75, -0.6, 1], [1.7, -0.75, 1.2], [-1.25, -1.45, 0.9], [1.3, -1.35, 1.05], [-1.82, 0.55, 0.85]].map(([x, z, s], i) => (
        <group key={i} position={[x, 0.06, z]} scale={s}>
          <mesh geometry={geo.trunk} scale={[1, 0.5, 1]}>
            <Flat color="#6b4a30" />
          </mesh>
          <mesh geometry={geo.pine} position-y={0.06}>
            <Flat color={i % 2 ? '#3f8a45' : '#4f9a4a'} />
          </mesh>
        </group>
      ))}

      {/* the pond at the foot */}
      <group position={[POND[0], 0, POND[1]]}>
        <Water radius={0.26} rings={2} segs={10} color={L.water} edge={L.wall2} amp={0.006} y={0.075} />
        <Ripple loop period={2.4} count={2} color="#ffffff" radius={0.2} opacity={0.5} y={0.085} />
        <Burst tap={{ since: (t) => tap.since(t) - (spillAt(0) + 0.35) }} geometry={geo.drop} count={10} colors={['#ffffff', L.water2]} speed={0.8} gravity={3} size={0.02} life={0.7} origin={[0, 0.08, -0.1]} spread={0.6} up={1.2} seed={8} />
        {Array.from({ length: 7 }, (_, i) => {
          const a = (i / 7) * TAU + 0.4
          return (
            <mesh key={i} geometry={geo.stone} position={[Math.cos(a) * 0.3, 0.07, Math.sin(a) * 0.3]} scale={[0.06, 0.04, 0.05]}>
              <Flat color={i % 2 ? '#a8a39a' : '#928d85'} />
            </mesh>
          )
        })}
      </group>
    </group>
  )
}

export default function RiceTerracesScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[3.3, 3.0, 4.8]} target={[0, 0.5, 0]} hint="Ripples drift across every paddy and the rice stirs in the breeze · tap it and water spills from the crown and fills the paddies one step at a time down into the pond · Look swaps spring, summer and harvest · drag to orbit">
      <RiceTerraces {...props} />
    </Stage>
  )
}
