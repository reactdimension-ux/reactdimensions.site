import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { Flat, Stage, facet, rng, terrainGeo, useGeo, useTap } from './kit.jsx'

// A low-poly cable car over a little alpine valley: a boxy cabin with a band
// of windows hangs from a hanger arm and a wheeled carriage that rides a
// sagging wire strung between two lattice towers, one in the meadow and one
// up on a hill, with snowy peaks and pines behind. Left alone the cabin
// glides along the wire and back, swinging a little as it speeds up and
// slows down. Tap it and it brakes mid-span: the cabin swings on its arm
// like a pendulum, settles, and the car carries on.

const LOOKS = {
  red: { cabin: '#d23a32', trim: '#f4efe6', roof: '#3a3d46', glass: '#9fd4ee', tower: '#8f96a3', grass: '#7fbf5a', grass2: '#5f9f44', rock: '#9a958c', snow: '#f6f7fb', pine: '#2f7a4a', pine2: '#3f9459', trunk: '#7a4f2c' },
  alpine: { cabin: '#2f6fb3', trim: '#f4efe6', roof: '#e9e6df', glass: '#c9ecff', tower: '#5d6573', grass: '#e9eef5', grass2: '#d6dfea', rock: '#8a8f99', snow: '#ffffff', pine: '#245c45', pine2: '#2f6e52', trunk: '#5e3d24' },
  gold: { cabin: '#e2a92c', trim: '#3a2c22', roof: '#6b3b25', glass: '#8fc0d8', tower: '#6e5a4a', grass: '#d4b44e', grass2: '#b8933a', rock: '#a08a72', snow: '#fbf3e4', pine: '#d0672a', pine2: '#e3923a', trunk: '#6b4325' },
}

// the wire: from the meadow tower's top (A) to the hill tower's top (B)
const A = new THREE.Vector3(-1.42, 1.86, 0)
const B = new THREE.Vector3(1.36, 2.2, 0)
const SAG = 0.2
const wireAt = (u, out = new THREE.Vector3()) => out.lerpVectors(A, B, u).setY(A.y + (B.y - A.y) * u - SAG * 4 * u * (1 - u))
const HILL = { x: 1.36, r: 0.78, h: 0.5 }
const ARM = 0.34 // pivot to roof
const CW = 0.44 // cabin size
const CH = 0.34
const CD = 0.36
const PEND = ARM + 0.06 + CH * 0.6 // the pendulum's effective length

// A strut from a to b: a thin four-sided bar.
function strut(a, b, r) {
  const d = new THREE.Vector3().subVectors(b, a)
  const g = new THREE.CylinderGeometry(r, r, d.length(), 4, 1)
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize())
  return g.applyMatrix4(new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1)))
}

// A lattice tower h tall, standing at the origin: four tapering legs tied
// with rings and X braces on every face, a cross arm and saddle on top.
function towerGeometry(h) {
  const parts = []
  const levels = 5
  const wAt = (y) => 0.2 - (0.13 * y) / h
  const corner = (y, i) => {
    const w = wAt(y)
    return new THREE.Vector3(i === 0 || i === 3 ? -w : w, y, i < 2 ? -w : w)
  }
  for (let i = 0; i < 4; i++) parts.push(strut(corner(0, i), corner(h, i), 0.022))
  for (let k = 0; k <= levels; k++) {
    const y0 = (k / levels) * h
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4
      if (k) parts.push(strut(corner(y0, i), corner(y0, j), 0.011))
      if (k < levels) {
        const y1 = ((k + 1) / levels) * h
        parts.push(strut(corner(y0, i), corner(y1, j), 0.008))
        parts.push(strut(corner(y0, j), corner(y1, i), 0.008))
      }
    }
  }
  return mergeGeometries(parts.map((g) => g.toNonIndexed()))
}

// The wire as a thin tube along its sag.
function wireGeometry() {
  const pts = Array.from({ length: 33 }, (_, i) => wireAt(i / 32))
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 64, 0.009, 5, false)
}

function Pine({ position, s = 1, L, seed }) {
  return (
    <group position={position} scale={s}>
      <mesh position-y={0.05}>
        <cylinderGeometry args={[0.025, 0.03, 0.1, 5]} />
        <Flat color={L.trunk} />
      </mesh>
      {[0, 1, 2].map((k) => (
        <mesh key={k} position-y={0.08 + k * 0.1} rotation-y={seed + k}>
          <coneGeometry args={[0.15 - k * 0.035, 0.2, 6]} />
          <Flat color={k % 2 ? L.pine2 : L.pine} />
        </mesh>
      ))}
    </group>
  )
}

// stopped for a while after a tap, then back up to speed
const STOP = 2.6

export function CableCar({ look = 'red' }) {
  const L = LOOKS[look] || LOOKS.red
  const { tap, handlers, clock } = useTap(1.2)
  const carriage = useRef()
  const hanger = useRef()
  const wheels = useRef([])
  const clouds = useRef([])
  const st = useRef({ phase: 0.6, f: 1, th: 0, w: 0, px: null, vx: 0, vy: 0, last: -99, roll: 0 })
  const geo = useGeo(
    () => ({
      ground: terrainGeo({ radius: 2.3, height: 0.14, seed: 4, rings: 5, segs: 16, rough: 0.35, profile: 'dome', bands: [[0, L.grass2], [0.4, L.grass]] }),
      hill: terrainGeo({ radius: HILL.r, height: HILL.h, seed: 7, rings: 4, segs: 10, rough: 0.12, profile: 'mesa', bands: [[0, L.grass2], [0.5, L.grass]] }),
      peakA: terrainGeo({ radius: 0.95, height: 1.55, seed: 11, rings: 4, segs: 9, rough: 0.2, profile: 'peak', bands: [[0, L.grass2], [0.3, L.rock], [0.66, L.snow]] }),
      peakB: terrainGeo({ radius: 0.75, height: 1.15, seed: 15, rings: 4, segs: 8, rough: 0.22, profile: 'peak', bands: [[0, L.grass2], [0.32, L.rock], [0.7, L.snow]] }),
      towerA: towerGeometry(A.y - 0.04),
      towerB: towerGeometry(B.y - HILL.h - 0.04),
      wire: wireGeometry(),
      arm: new THREE.BoxGeometry(0.4, 0.05, 0.05),
      saddle: new THREE.CylinderGeometry(0.05, 0.05, 0.06, 8).rotateX(Math.PI / 2),
      body: facet(new THREE.BoxGeometry(CW, CH, CD, 2, 2, 2), 0.008, 3),
      roof: facet(new THREE.BoxGeometry(CW + 0.05, 0.05, CD + 0.05), 0.004, 4),
      cap: facet(new THREE.CylinderGeometry(0.1, 0.13, 0.05, 6), 0.004, 5),
      skirt: new THREE.BoxGeometry(CW + 0.02, 0.05, CD + 0.02),
      pane: new THREE.BoxGeometry(1, 1, 1),
      rod: new THREE.CylinderGeometry(0.014, 0.014, ARM, 5).translate(0, -ARM / 2, 0),
      plate: new THREE.BoxGeometry(0.2, 0.045, 0.028),
      wheel: new THREE.CylinderGeometry(0.032, 0.032, 0.022, 8).rotateX(Math.PI / 2),
      cloud: new THREE.IcosahedronGeometry(1, 0),
    }),
    [look],
  )
  const pines = useMemo(() => {
    const r = rng(21)
    const spots = [[-0.6, -1.2], [-0.15, -1.45], [0.45, -1.3], [-1.8, 0.5], [-0.9, 1.1], [0.2, 1.4], [0.75, 0.95], [-1.95, -0.4], [1.9, -0.6], [-0.35, 0.75], [1.7, 0.85]]
    return spots.map(([x, z], i) => ({ x, z, s: 0.75 + r() * 0.6, seed: i * 1.3 }))
  }, [])
  const tmp = useMemo(() => [new THREE.Vector3(), new THREE.Vector3()], [])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 30)
    const t = clock.elapsedTime
    const S = st.current
    // a tap brakes the car hard, a kick sets the cabin swinging
    const t0 = t - tap.since(t)
    if (tap.since(t) >= 0 && S.last !== t0) {
      S.last = t0
      S.w += (S.vx >= 0 ? 1 : -1) * 1.7
    }
    const stopped = tap.since(t) >= 0 && tap.since(t) < STOP
    const target = stopped ? 0 : 1
    S.f += (target - S.f) * Math.min(1, dt * (stopped ? 6 : 1.4))
    S.phase += dt * 0.42 * S.f
    const u = 0.5 - 0.34 * Math.cos(S.phase)
    const p = wireAt(u, tmp[0])
    const q = wireAt(Math.min(1, u + 0.01), tmp[1])
    carriage.current.position.copy(p)
    carriage.current.rotation.z = Math.atan2(q.y - p.y, q.x - p.x)
    // pendulum, driven by the carriage's own acceleration along the wire
    if (S.px === null) S.px = p.clone()
    const vx = (p.x - S.px.x) / Math.max(dt, 1e-4)
    const vy = (p.y - S.px.y) / Math.max(dt, 1e-4)
    const ax = THREE.MathUtils.clamp((vx - S.vx) / Math.max(dt, 1e-4), -8, 8)
    const ay = THREE.MathUtils.clamp((vy - S.vy) / Math.max(dt, 1e-4), -8, 8)
    S.px.copy(p)
    S.vx = vx
    S.vy = vy
    const g = 9.8
    S.w += (-((g + ay) / PEND) * Math.sin(S.th) - (ax / PEND) * Math.cos(S.th) - 1.1 * S.w) * dt
    S.th = THREE.MathUtils.clamp(S.th + S.w * dt, -0.7, 0.7)
    hanger.current.position.copy(p)
    hanger.current.rotation.z = S.th
    hanger.current.rotation.x = Math.sin(t * 1.3) * 0.025
    // the wheels roll with the travel
    S.roll -= (vx / 0.032) * dt
    wheels.current.forEach((w) => w && (w.rotation.z = S.roll))
    clouds.current.forEach((c, i) => {
      if (!c) return
      c.position.x = ((t * 0.06 + i * 1.7) % 4.4) - 2.2
    })
  })

  const pane = (pos, scale, key) => (
    <mesh key={key} geometry={geo.pane} position={pos} scale={scale}>
      <Flat color={L.glass} roughness={0.25} emissive={L.glass} emissiveIntensity={0.12} />
    </mesh>
  )
  const cabinY = -ARM - 0.05 - CH / 2 - 0.025
  return (
    <group {...handlers}>
      {/* the valley: meadow, a hill for the top station tower, peaks behind */}
      <mesh geometry={geo.ground}>
        <Flat vertexColors color="#ffffff" />
      </mesh>
      <mesh geometry={geo.hill} position={[HILL.x, 0.02, 0]}>
        <Flat vertexColors color="#ffffff" />
      </mesh>
      <mesh geometry={geo.peakA} position={[-0.55, 0, -1.15]}>
        <Flat vertexColors color="#ffffff" />
      </mesh>
      <mesh geometry={geo.peakB} position={[0.55, 0, -1.25]}>
        <Flat vertexColors color="#ffffff" />
      </mesh>
      {pines.map((pn, i) => (
        <Pine key={i} position={[pn.x, 0.08 * (1 - (pn.x * pn.x + pn.z * pn.z) / 5.3), pn.z]} s={pn.s} L={L} seed={pn.seed} />
      ))}
      {[0, 1].map((i) => (
        <group key={i} ref={(el) => (clouds.current[i] = el)} position={[0, 2.3 + i * 0.2, -0.9 + i * 1.3]}>
          {[[0, 0, 0, 0.16], [0.15, -0.03, 0.02, 0.12], [-0.15, -0.04, 0, 0.11]].map(([x, y, z, r], k) => (
            <mesh key={k} geometry={geo.cloud} position={[x, y, z]} scale={[r * 1.2, r, r]}>
              <Flat color="#ffffff" />
            </mesh>
          ))}
        </group>
      ))}

      {/* the two lattice towers, each with a cross arm and saddle for the wire */}
      {[
        [A, geo.towerA, 0.08],
        [B, geo.towerB, HILL.h + 0.02],
      ].map(([top, g, base], i) => (
        <group key={i} position={[top.x, base, 0]}>
          <mesh geometry={g}>
            <Flat color={L.tower} metalness={0.3} roughness={0.55} />
          </mesh>
          <mesh geometry={geo.arm} position-y={top.y - base - 0.06} rotation-y={Math.PI / 2}>
            <Flat color={L.tower} metalness={0.3} roughness={0.55} />
          </mesh>
          <mesh geometry={geo.saddle} position-y={top.y - base - 0.04}>
            <Flat color={L.cabin} />
          </mesh>
        </group>
      ))}
      <mesh geometry={geo.wire}>
        <meshStandardMaterial color="#30333a" roughness={0.5} metalness={0.4} />
      </mesh>

      {/* the carriage: two wheels riding the wire, side plates either side */}
      <group ref={carriage}>
        {[-1, 1].map((k, i) => (
          <mesh key={k} ref={(el) => (wheels.current[i] = el)} geometry={geo.wheel} position={[k * 0.06, 0.035, 0]}>
            <Flat color="#4a4e58" metalness={0.4} roughness={0.4} />
          </mesh>
        ))}
        {[-1, 1].map((k) => (
          <mesh key={k} geometry={geo.plate} position={[0, 0.015, k * 0.025]}>
            <Flat color={L.trim === '#3a2c22' ? '#3a2c22' : '#6b717d'} metalness={0.3} />
          </mesh>
        ))}
      </group>

      {/* the hanger arm and cabin, swinging from a pivot under the wire */}
      <group ref={hanger}>
        <mesh geometry={geo.rod} position-y={-0.01}>
          <Flat color="#5a5f6a" metalness={0.4} roughness={0.4} />
        </mesh>
        <group position-y={cabinY}>
          <mesh geometry={geo.body}>
            <Flat color={L.cabin} />
          </mesh>
          <mesh geometry={geo.roof} position-y={CH / 2 + 0.02}>
            <Flat color={L.roof} />
          </mesh>
          <mesh geometry={geo.cap} position-y={CH / 2 + 0.065}>
            <Flat color={L.roof} />
          </mesh>
          <mesh geometry={geo.skirt} position-y={-CH / 2 + 0.03}>
            <Flat color={L.trim} />
          </mesh>
          {/* a band of windows round all four sides */}
          {[-1, 1].map((sz) => [-1, 0, 1].map((k) => pane([k * 0.135, 0.05, sz * (CD / 2 + 0.004)], [0.11, 0.14, 0.012], `z${sz}${k}`)))}
          {[-1, 1].map((sx) => [-1, 1].map((k) => pane([sx * (CW / 2 + 0.004), 0.05, k * 0.075], [0.012, 0.14, 0.12], `x${sx}${k}`)))}
          {/* a trim line under the windows */}
          <mesh geometry={geo.pane} position-y={-0.045} scale={[CW + 0.012, 0.022, CD + 0.012]}>
            <Flat color={L.trim} />
          </mesh>
        </group>
      </group>

      {/* an easy target for taps anywhere over the scene */}
      <mesh position={[0, 1.1, 0]}>
        <boxGeometry args={[3.4, 2.4, 2.6]} />
        <meshBasicMaterial colorWrite={false} depthWrite={false} />
      </mesh>
    </group>
  )
}

export default function CableCarScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[3.7, 2.7, 6.3]} target={[0, 1.0, 0]} hint="The cabin glides along the wire between the towers and back, swinging a little as it speeds up and slows · tap it to brake mid-span: the cabin swings on its arm like a pendulum, settles, then carries on · Look swaps red, alpine and gold · drag to orbit">
      <CableCar {...props} />
    </Stage>
  )
}
