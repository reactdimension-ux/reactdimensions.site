import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Beam, Burst, Flat, Particles, Ripple, Stage, Sway, TAU, blob, facet, polarGrid, rng, useGeo, useKick, useTap } from './kit.jsx'

// A low-poly two-legged walker on a small rocky patch: a boxy, chamfered
// cockpit on a swivel ring, with a dark visor whose scanner light sweeps
// side to side, a whip antenna, side pods and rear vents that puff now and
// then. It stands on two digitigrade legs (a hip axle, a thigh driven by a
// piston, a forward knee, a shin raking back to the ankle, a short
// metatarsal and a wide three-toed foot), each joint on its own pivot and
// solved by a little two-bone IK, so the feet stay planted whatever the
// body does. Idle, it shifts its weight from leg to leg (the unloaded heel
// lifts), the cockpit swivels to scan and the antenna wobbles. Tap it and it
// vents, takes three heavy steps forward and three back to its spot (lift,
// swing, plant), every footfall kicking dust, a ring and a hop of the
// pebbles through the ground, then settles with a hiss.

const LOOKS = {
  scout: { armor: '#dfe0e4', armor2: '#bfc3cb', accent: '#f07a2a', frame: '#4a4f5a', dark: '#2b2e36', glass: '#1a2030', glow: '#5ef0ff', tip: '#ff5a3a', ground: '#a3a796', ground2: '#959a89', rock: '#80857a', rock2: '#6e7369', dust: ['#cdc7b4', '#e6e0cf', '#aaa492'] },
  heavy: { armor: '#555b64', armor2: '#434850', accent: '#f2c230', frame: '#2b2d33', dark: '#1c1e22', glass: '#120f12', glow: '#ff4a36', tip: '#ffd23a', stripes: '#1c1d20', ground: '#7d7972', ground2: '#716d66', rock: '#5f5c57', rock2: '#504d49', dust: ['#a9a49a', '#c7c2b8', '#8c877e'] },
  desert: { armor: '#dcc394', armor2: '#c3a678', accent: '#9a5f36', frame: '#6a5a47', dark: '#3e3428', glass: '#201a14', glow: '#a4ff6a', tip: '#ff7a3a', ground: '#e0c38c', ground2: '#d5b67d', rock: '#bd7d52', rock2: '#a66a43', dust: ['#e8d3a6', '#f2e4c4', '#cdb284'] },
  arctic: { armor: '#f3f6f9', armor2: '#d6e0ea', accent: '#3a7bd5', frame: '#5c6b7e', dark: '#33404f', glass: '#142033', glow: '#7fd8ff', tip: '#ff4a5a', ground: '#eef3f8', ground2: '#e0e8f0', rock: '#a3b5c6', rock2: '#8a9db1', dust: ['#ffffff', '#eaf2fa', '#d4e2ef'] },
}

const ease = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u))
const clamp = (u, a = 0, b = 1) => Math.max(a, Math.min(b, u))

// leg dimensions: thigh, shin, metatarsal (raked forward by PHI_M), the
// height of the foot pivot, and where the hips and feet sit across
const THIGH = 0.42
const SHIN = 0.42
const META = 0.19
const PHI_M = 0.3
const FOOT_H = 0.075
const HIP_X = 0.25
const FOOT_X = 0.3
const IDLE_Y = 0.84
const WALK_Y = 0.79
const LIFT = 0.17
const Z0 = -0.3 // where it stands on the patch (it walks out to z = +0.3)
const HOME = -0.2 // faces three-quarters to the camera

// the tap: three steps out, a pause, three steps back. Each step is [foot
// (0 left, 1 right), from z, to z]; the foot lands at LAND of the step.
const T = 0.74
const LAND = 0.8
const START = 0.5
const PAUSE = 0.45
const STEPS = [
  [0, 0, 0.3],
  [1, 0, 0.6],
  [0, 0.3, 0.6],
  [1, 0.6, 0.3],
  [0, 0.6, 0],
  [1, 0.3, 0],
]
const ST = STEPS.map((_, i) => START + i * T + (i >= 3 ? PAUSE : 0))
const END = ST[STEPS.length - 1] + T
const DUR = END + 1.1

// one swinging foot at u (0..1) through its step: lift fast, swing, slam
function swingFoot(u, from, to) {
  const yu = clamp(u / LAND)
  const y = yu < 0.38 ? LIFT * Math.sin((Math.PI / 2) * (yu / 0.38)) : LIFT * (1 - ((yu - 0.38) / 0.62) ** 2)
  const dir = Math.sign(to - from)
  return { z: from + (to - from) * ease(clamp((u - 0.06) / 0.66)), y: Math.max(0, y), p: -0.32 * dir * Math.sin(Math.PI * yu) }
}

function gait(s) {
  const r = { busy: s >= 0 && s < DUR, feet: [{ y: 0, z: 0, p: 0 }, { y: 0, z: 0, p: 0 }], sway: 0, rise: 0, twist: 0, lean: 0, crouch: 0, w: 0 }
  if (!r.busy) return r
  STEPS.forEach(([f, from, to], i) => {
    if (s >= ST[i] + T) r.feet[f] = { y: 0, z: to, p: 0 }
    else if (s >= ST[i]) {
      const u = (s - ST[i]) / T
      r.feet[f] = swingFoot(u, from, to)
      const sx = f === 0 ? 1 : -1
      const k = Math.sin(Math.PI * u)
      r.sway = -sx * 0.055 * k // weight over the planted foot
      r.rise = 0.035 * Math.sin(Math.PI * clamp(u / LAND))
      r.twist = sx * 0.08 * k
    }
  })
  r.lean = s < ST[3] - PAUSE / 2 ? 0.06 : -0.045
  r.w = ease(s / 0.4) * ease((DUR - 0.2 - s) / 0.7)
  // wind up before the first step, settle after the last
  r.crouch = 0.045 * Math.sin(Math.PI * clamp(s / START)) + 0.06 * Math.sin(Math.PI * clamp((s - END) / 0.8)) * (1 - clamp((s - END) / 0.8) * 0.4)
  return r
}

// a tapered armour bar hanging from its pivot: w0 x d0 at the top (ext above
// the pivot) to w1 x d1 at length below it
function bar(w0, d0, w1, d1, len, ext, seed) {
  const g = new THREE.BoxGeometry(1, 1, 1, 1, 2, 1)
  const p = g.attributes.position
  for (let i = 0; i < p.count; i++) {
    const k = 0.5 - p.getY(i)
    p.setXYZ(i, p.getX(i) * (w0 + (w1 - w0) * k), ext - k * (len + ext), p.getZ(i) * (d0 + (d1 - d0) * k))
  }
  return facet(g, 0.004, seed)
}

// the cockpit: a chamfered side profile (z, y) extruded across x
function cockpitGeo() {
  const pts = [
    [-0.28, 0.02],
    [0.22, 0.0],
    [0.36, 0.13],
    [0.3, 0.3],
    [0.08, 0.38],
    [-0.24, 0.37],
    [-0.32, 0.22],
  ]
  const s = new THREE.Shape()
  pts.forEach(([z, y], i) => (i ? s.lineTo(z, y) : s.moveTo(z, y)))
  s.closePath()
  const W = 0.5
  const g = new THREE.ExtrudeGeometry(s, { depth: W, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.025, bevelSegments: 1 })
  g.translate(0, 0, -W / 2).rotateY(-Math.PI / 2)
  return facet(g, 0.006, 21)
}

// the visor face of the cockpit: its middle, its tilt and its normal
const VIS_TILT = Math.atan2(0.06, 0.17)
const VIS_N = [Math.sin(VIS_TILT), Math.cos(VIS_TILT)] // (y, z) of the face normal
const VISOR = [0, 0.215 + VIS_N[0] * 0.03, 0.33 + VIS_N[1] * 0.03]

// a row of hazard stripes (or a plain accent plate) facing +z
function Plate({ w, h, color, stripes, geo, ...props }) {
  const n = Math.floor(w / (h * 0.75))
  return (
    <group {...props}>
      <mesh geometry={geo.cube} scale={[w, h, 0.014]}>
        <Flat color={color} />
      </mesh>
      {stripes &&
        Array.from({ length: n }, (_, i) => (
          <mesh key={i} geometry={geo.cube} position={[-w / 2 + (i + 0.5) * (w / n), 0, 0.004]} rotation-z={0.6} scale={[h * 0.32, h * 0.94, 0.014]}>
            <Flat color={stripes} />
          </mesh>
        ))}
    </group>
  )
}

const UP = new THREE.Vector3(0, 1, 0)
const _v = new THREE.Vector3()

// set a leg's joints so its foot pivot lands on (fx, fy, fz), hip at (hx,
// hy, hz), all in the walker's root space; the foot then pitches by fp
function solveLeg(L, hx, hy, hz, fx, fy, fz, fp) {
  const ax = fx
  const ay = fy + FOOT_H + META * Math.cos(PHI_M)
  const az = fz - META * Math.sin(PHI_M)
  const dx = ax - hx
  const dy = ay - hy
  const dz = az - hz
  const rho = Math.atan2(dx, -dy)
  const D = Math.hypot(dx, dy)
  const d0 = Math.hypot(D, dz)
  const d = clamp(d0, 0.12, THIGH + SHIN - 0.002)
  const sc = d / d0
  const ph0 = Math.atan2(dz, D)
  const al = Math.acos(clamp((THIGH * THIGH + d * d - SHIN * SHIN) / (2 * THIGH * d), -1, 1))
  const pt = ph0 + al // the knee bends forward
  const ps = Math.atan2(dz * sc - THIGH * Math.sin(pt), D * sc - THIGH * Math.cos(pt))
  L.roll.rotation.z = rho
  L.thigh.rotation.x = -pt
  L.shin.rotation.x = -(ps - pt)
  L.meta.rotation.x = -(PHI_M - ps)
  L.fa.rotation.x = PHI_M
  L.fb.rotation.z = -rho
  L.fc.rotation.x = fp
}

export function MechWalker({ look = 'scout' }) {
  const C = LOOKS[look] || LOOKS.scout
  const { tap, handlers, clock } = useTap(1)
  const feetK = [useKick(3), useKick(3)]
  const thump = useKick(9)
  const hiss = useKick(2)
  const r = useRef({})
  const set = (k) => (o) => (r.current[k] = o)
  const legs = useRef([{}, {}])
  const setLeg = (i, k) => (o) => (legs.current[i][k] = o)
  const pebbles = useRef([])
  const st = useRef({ t0: null, fired: 0, px: 0, py: IDLE_Y, yaw: 0, pitch: 0, lean: 0, dip: 0, dv: 0, fall: [[FOOT_X, Z0], [-FOOT_X, Z0]] })
  const dust = useMemo(() => [[0, 0.04, 0], [0, 0.04, 0]], [])

  const geo = useGeo(
    () => ({
      cube: new THREE.BoxGeometry(1, 1, 1),
      cockpit: cockpitGeo(),
      ring: facet(new THREE.CylinderGeometry(0.2, 0.24, 0.1, 10, 1), 0.004, 2),
      pelvis: facet(new THREE.BoxGeometry(0.4, 0.2, 0.3, 2, 1, 1), 0.008, 3),
      axle: facet(new THREE.CylinderGeometry(0.1, 0.1, 0.13, 8, 1).rotateZ(Math.PI / 2), 0.004, 4),
      cap: new THREE.CylinderGeometry(0.06, 0.06, 0.02, 8, 1).rotateZ(Math.PI / 2),
      thigh: bar(0.15, 0.18, 0.11, 0.11, THIGH, 0.05, 5),
      knee: facet(new THREE.CylinderGeometry(0.068, 0.068, 0.15, 8, 1).rotateZ(Math.PI / 2), 0.003, 6),
      kneeCap: facet(new THREE.BoxGeometry(0.11, 0.12, 0.05, 1, 1, 1).translate(0, -0.02, 0.06), 0.005, 7),
      shin: bar(0.095, 0.1, 0.07, 0.07, SHIN, 0.02, 8),
      ankle: facet(new THREE.CylinderGeometry(0.052, 0.052, 0.11, 8, 1).rotateZ(Math.PI / 2), 0.003, 9),
      meta: bar(0.06, 0.06, 0.055, 0.055, META, 0.02, 10),
      footBase: facet(new THREE.BoxGeometry(0.26, 0.06, 0.24).translate(0, -FOOT_H + 0.03, -0.01), 0.006, 11, [1, 0.2, 1]),
      toe: facet(new THREE.BoxGeometry(0.085, 0.05, 0.22).translate(0, -FOOT_H + 0.025, 0.11), 0.005, 12, [1, 0.3, 1]),
      spur: facet(new THREE.BoxGeometry(0.08, 0.045, 0.16).translate(0, -FOOT_H + 0.0225, -0.09), 0.004, 13, [1, 0.3, 1]),
      footTop: facet(new THREE.CylinderGeometry(0.075, 0.11, 0.06, 6, 1).translate(0, -0.03, 0), 0.004, 14),
      housing: new THREE.CylinderGeometry(0.03, 0.03, 0.2, 6, 1).translate(0, 0.1, 0),
      rod: new THREE.CylinderGeometry(0.014, 0.014, 1, 6, 1).translate(0, 0.5, 0),
      knuckle: new THREE.IcosahedronGeometry(0.03, 0),
      pod: facet(new THREE.BoxGeometry(0.13, 0.16, 0.3, 1, 1, 2), 0.006, 15),
      tube: new THREE.CylinderGeometry(0.026, 0.026, 0.03, 7, 1).rotateX(Math.PI / 2),
      arm: new THREE.CylinderGeometry(0.035, 0.035, 0.08, 6, 1).rotateZ(Math.PI / 2),
      ant1: new THREE.CylinderGeometry(0.008, 0.012, 0.2, 5, 1).translate(0, 0.1, 0),
      ant2: new THREE.CylinderGeometry(0.005, 0.008, 0.18, 5, 1).translate(0, 0.09, 0),
      antBase: new THREE.CylinderGeometry(0.03, 0.04, 0.04, 6, 1).translate(0, 0.02, 0),
      tip: new THREE.IcosahedronGeometry(0.022, 0),
      puff: new THREE.IcosahedronGeometry(1, 0),
      groundTop: polarGrid(1.42, 4, 16, () => 0, 0.22, 7).toNonIndexed(),
      groundSide: facet(new THREE.CylinderGeometry(1.42, 1.46, 0.16, 16, 1, true).translate(0, -0.08, 0), 0.015, 16, [1, 0.4, 1], (x, y) => y > -0.001),
      rock: blob(1, 17, 0),
      hit: new THREE.BoxGeometry(1.0, 1.75, 1.0).translate(0, 0.875, 0),
    }),
    [],
  )

  // a mosaic of ground facets in two tones
  useMemo(() => {
    const g = geo.groundTop
    const p = g.attributes.position
    const col = new Float32Array(p.count * 3)
    const c = new THREE.Color()
    const rr = rng(31)
    for (let f = 0; f < p.count; f += 3) {
      c.set(rr() < 0.5 ? C.ground : C.ground2).multiplyScalar(0.95 + rr() * 0.1)
      for (let j = 0; j < 3; j++) col.set([c.r, c.g, c.b], (f + j) * 3)
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    g.computeVertexNormals()
  }, [geo, C])

  // boulders round the rim and pebbles (that hop on each footfall) off the path
  const decor = useMemo(() => {
    const rr = rng(5)
    const onPath = (x, z) => Math.abs(x) < 0.62 && z > Z0 - 0.45 && z < 0.75
    const rocks = []
    while (rocks.length < 9) {
      const a = rr() * TAU
      const d = 0.95 + rr() * 0.36
      const x = Math.cos(a) * d
      const z = Math.sin(a) * d
      if (onPath(x, z)) continue
      const s = 0.07 + rr() * 0.11
      rocks.push({ pos: [x, s * 0.25, z], scale: [s * (1 + rr() * 0.5), s * (0.6 + rr() * 0.4), s * (0.9 + rr() * 0.4)], rot: rr() * 6, c: rr() < 0.5 ? C.rock : C.rock2 })
    }
    const pebs = []
    while (pebs.length < 22) {
      const a = rr() * TAU
      const d = 0.35 + rr() * 1.0
      const x = Math.cos(a) * d
      const z = Math.sin(a) * d
      if (Math.abs(Math.abs(x) - FOOT_X) < 0.2 && z > Z0 - 0.3 && z < 0.55) continue
      const s = 0.018 + rr() * 0.025
      pebs.push({ x, z, s, rot: rr() * 6, c: rr() < 0.5 ? C.rock : C.rock2 })
    }
    return { rocks, pebs }
  }, [C])

  useFrame((_, dt) => {
    const t = clock.elapsedTime
    const o = r.current
    const S = st.current
    const d = Math.min(dt, 0.05)
    const s = tap.since(t)
    const A = gait(s)
    const t0 = t - s
    if (S.t0 !== t0) {
      S.t0 = t0
      S.fired = 0
      if (A.busy) hiss.kick(t)
    }

    // footfalls: dust, a ring, a thump through the ground and the body
    if (A.busy) {
      while (S.fired < STEPS.length && s >= ST[S.fired] + T * LAND) {
        const [f, , to] = STEPS[S.fired]
        const x = f === 0 ? FOOT_X : -FOOT_X
        const z = Z0 + to + 0.04
        dust[f][0] = x
        dust[f][2] = z
        S.fall[f] = [x, z]
        o[`ripple${f}`].position.set(x, 0.012, z)
        feetK[f].kick(t)
        thump.kick(t)
        S.dv -= 0.75
        S.fired++
        if (S.fired === STEPS.length) hiss.kick(t + 0.55)
      }
    }

    // idle: weight from leg to leg, the unloaded heel lifting
    const sw = Math.sin(t * 0.85)
    const w = A.busy ? A.w : 0
    const idleY = IDLE_Y - 0.014 * (1 - sw * sw)
    const tx = 0.05 * sw * (1 - w) + A.sway * w
    const ty = idleY * (1 - w) + (WALK_Y + A.rise) * w - A.crouch
    const k = 1 - Math.exp(-d * 9)
    S.px += (tx - S.px) * k
    S.py += (ty - S.py) * k
    // the footfall dip: a stiff spring
    S.dv += (-260 * S.dip - 15 * S.dv) * d
    S.dip += S.dv * d
    const pz = (A.feet[0].z + A.feet[1].z) / 2
    const py = S.py + S.dip
    o.pelvis.position.set(S.px, py, pz)

    // legs, by IK onto the feet
    legs.current.forEach((L, i) => {
      if (!L.roll) return
      const sx = i === 0 ? 1 : -1
      const F = A.feet[i]
      const heel = 0.2 * Math.max(0, -sx * sw) ** 3 * (1 - w)
      const fp = F.p + heel
      const fy = F.y + 0.21 * Math.sin(Math.max(0, heel))
      solveLeg(L, S.px + sx * HIP_X, py, pz, sx * FOOT_X, fy, F.z, fp)
      // the thigh piston: from a bracket on the hip housing to a lug on the thigh
      L.lug.getWorldPosition(_v)
      o.pelvis.worldToLocal(_v)
      const P1 = L.pistonAt
      _v.sub(P1)
      const len = _v.length()
      L.piston.position.copy(P1)
      L.piston.quaternion.setFromUnitVectors(UP, _v.multiplyScalar(1 / len))
      L.rod.scale.y = len
    })

    // the cockpit: scans when idle, faces ahead and leans into the walk
    const scan = 0.55 * Math.sin(0.42 * t) + 0.18 * Math.sin(1.07 * t + 1)
    const yaw = scan * (1 - w) + A.twist * w
    S.yaw += (yaw - S.yaw) * (1 - Math.exp(-d * 4))
    S.lean += (A.lean * w - S.lean) * (1 - Math.exp(-d * 3))
    o.turret.rotation.set(S.lean - S.dip * 2.2 + 0.015 * Math.sin(t * 1.7), S.yaw, S.px * 0.7)
    // the scanner light sweeps along the visor, its beam with it
    const sweep = Math.sin(t * 2.3)
    o.scanner.position.x = 0.17 * sweep
    o.beam.rotation.y = 0.35 * sweep
    o.beam.material.opacity = 0.09 + 0.03 * Math.sin(t * 9)
    o.tipMat.emissiveIntensity = (t % 1.3) < 0.18 ? 2.2 : 0.4

    // the ground thumps: the patch squashes and the pebbles near the foot hop
    const th = thump.value(t)
    o.ground.scale.set(1 + 0.012 * th, 1 - 0.35 * th, 1 + 0.012 * th)
    decor.pebs.forEach((p, i) => {
      const m = pebbles.current[i]
      if (!m) return
      let h = 0
      for (let f = 0; f < 2; f++) {
        const u = feetK[f].since(t) / 0.32
        if (u < 0 || u > 1) continue
        const dist = Math.hypot(p.x - S.fall[f][0], p.z - S.fall[f][1])
        h += 0.07 * Math.exp(-dist * 2.6) * 4 * u * (1 - u)
      }
      m.position.y = p.s * 0.5 + h
      m.rotation.x = h * 8
    })
  })

  const legDefs = [1, -1]

  return (
    <group rotation-y={HOME}>
      {/* the rocky patch */}
      <group ref={set('ground')}>
        <mesh geometry={geo.groundTop}>
          <Flat vertexColors color="#ffffff" />
        </mesh>
        <mesh geometry={geo.groundSide}>
          <Flat color={C.rock2} />
        </mesh>
      </group>
      {decor.rocks.map((m, i) => (
        <mesh key={i} geometry={geo.rock} position={m.pos} rotation-y={m.rot} scale={m.scale}>
          <Flat color={m.c} />
        </mesh>
      ))}
      {decor.pebs.map((p, i) => (
        <mesh key={`p${i}`} ref={(el) => (pebbles.current[i] = el)} geometry={geo.rock} position={[p.x, p.s * 0.5, p.z]} rotation-y={p.rot} scale={[p.s * 1.3, p.s, p.s * 1.1]}>
          <Flat color={p.c} />
        </mesh>
      ))}

      <group
        position-z={Z0}
        {...handlers}
        onClick={(e) => {
          e.stopPropagation()
          if (!gait(tap.since(clock.elapsedTime)).busy) tap.kick(clock.elapsedTime)
        }}
      >
        {/* an invisible box round the walker, so a tap always lands */}
        <mesh geometry={geo.hit}>
          <meshBasicMaterial visible={false} />
        </mesh>

        <group ref={set('pelvis')} position-y={IDLE_Y}>
          {/* the pelvis block and the hip axle housings */}
          <mesh geometry={geo.pelvis}>
            <Flat color={C.frame} />
          </mesh>
          <Plate geo={geo} w={0.3} h={0.07} color={C.accent} stripes={C.stripes} position={[0, -0.02, 0.157]} />
          {legDefs.map((sx) => (
            <group key={sx} position-x={sx * HIP_X}>
              <mesh geometry={geo.axle}>
                <Flat color={C.armor2} />
              </mesh>
              <mesh geometry={geo.cap} position-x={sx * 0.072}>
                <Flat color={C.accent} />
              </mesh>
              {/* the piston bracket, behind and above the hip */}
              <mesh geometry={geo.cube} position={[sx * 0.088, 0.1, -0.1]} scale={[0.05, 0.07, 0.06]}>
                <Flat color={C.frame} />
              </mesh>
            </group>
          ))}

          {/* the legs: hip roll, thigh, knee, shin, ankle, metatarsal, foot */}
          {legDefs.map((sx, i) => (
            <group key={sx} position-x={sx * HIP_X}>
              <group ref={setLeg(i, 'roll')}>
                <group ref={setLeg(i, 'thigh')}>
                  <mesh geometry={geo.thigh}>
                    <Flat color={C.armor} />
                  </mesh>
                  <mesh geometry={geo.cube} position={[sx * 0.077, -0.17, 0.02]} scale={[0.012, 0.16, 0.08]}>
                    <Flat color={C.accent} />
                  </mesh>
                  <group ref={setLeg(i, 'lug')} position={[sx * 0.088, -0.64 * THIGH, -0.01]} />
                  <mesh geometry={geo.knuckle} position={[sx * 0.088, -0.64 * THIGH, -0.01]}>
                    <Flat color={C.frame} />
                  </mesh>
                  <group ref={setLeg(i, 'shin')} position-y={-THIGH}>
                    <mesh geometry={geo.knee}>
                      <Flat color={C.frame} />
                    </mesh>
                    <mesh geometry={geo.kneeCap}>
                      <Flat color={C.accent} />
                    </mesh>
                    <mesh geometry={geo.shin}>
                      <Flat color={C.armor2} />
                    </mesh>
                    <group ref={setLeg(i, 'meta')} position-y={-SHIN}>
                      <mesh geometry={geo.ankle}>
                        <Flat color={C.frame} />
                      </mesh>
                      <mesh geometry={geo.meta}>
                        <Flat color={C.dark} />
                      </mesh>
                      <group position-y={-META}>
                        <group ref={setLeg(i, 'fa')}>
                          <group ref={setLeg(i, 'fb')}>
                            <group ref={setLeg(i, 'fc')}>
                              <mesh geometry={geo.footTop}>
                                <Flat color={C.frame} />
                              </mesh>
                              <mesh geometry={geo.footBase}>
                                <Flat color={C.armor2} />
                              </mesh>
                              {[-1, 0, 1].map((j) => (
                                <mesh key={j} geometry={geo.toe} position-x={j * 0.09} rotation-y={-j * 0.26}>
                                  <Flat color={j ? C.armor : C.accent} />
                                </mesh>
                              ))}
                              <mesh geometry={geo.spur}>
                                <Flat color={C.dark} />
                              </mesh>
                            </group>
                          </group>
                        </group>
                      </group>
                    </group>
                  </group>
                </group>
              </group>
            </group>
          ))}
          {/* the thigh pistons: a housing on the bracket and a rod to the lug */}
          {legDefs.map((sx, i) => (
            <group
              key={sx}
              ref={(el) => {
                legs.current[i].piston = el
                legs.current[i].pistonAt = new THREE.Vector3(sx * (HIP_X + 0.088), 0.1, -0.1)
              }}
            >
              <mesh geometry={geo.housing}>
                <Flat color={C.dark} />
              </mesh>
              <mesh ref={setLeg(i, 'rod')} geometry={geo.rod}>
                <meshStandardMaterial color="#d8dde4" flatShading roughness={0.3} metalness={0.6} />
              </mesh>
            </group>
          ))}

          {/* the swivel ring and the cockpit on it */}
          <mesh geometry={geo.ring} position-y={0.13}>
            <Flat color={C.dark} />
          </mesh>
          <group ref={set('turret')} position-y={0.15}>
            <mesh geometry={geo.cockpit}>
              <Flat color={C.armor} />
            </mesh>
            {/* the visor, its sweeping scanner light and beam */}
            <group position={VISOR} rotation-x={-VIS_TILT}>
              <mesh geometry={geo.cube} scale={[0.44, 0.1, 0.02]}>
                <meshStandardMaterial color={C.glass} emissive={C.glow} emissiveIntensity={0.12} flatShading roughness={0.15} metalness={0.3} />
              </mesh>
              <group ref={set('scanner')} position-z={0.012}>
                <mesh geometry={geo.cube} scale={[0.07, 0.05, 0.01]}>
                  <meshStandardMaterial color={C.glow} emissive={C.glow} emissiveIntensity={2.2} toneMapped={false} />
                </mesh>
                <Beam ref={set('beam')} length={1.3} radius={0.28} color={C.glow} opacity={0.1} rotation-x={VIS_TILT + 0.2} />
              </group>
              {/* the visor frame */}
              {[-1, 1].map((y) => (
                <mesh key={y} geometry={geo.cube} position={[0, y * 0.058, 0.004]} scale={[0.47, 0.018, 0.022]}>
                  <Flat color={C.dark} />
                </mesh>
              ))}
            </group>
            {/* headlights on the chin, an accent band, the hatch, rear vents */}
            {[-1, 1].map((sx) => (
              <mesh key={sx} geometry={geo.cube} position={[sx * 0.16, 0.05, 0.315]} rotation-x={0.82} scale={[0.07, 0.04, 0.015]}>
                <meshStandardMaterial color="#fff6d8" emissive="#fff1c0" emissiveIntensity={0.9} flatShading />
              </mesh>
            ))}
            {[-1, 1].map((sx) => (
              <Plate key={sx} geo={geo} w={0.36} h={0.06} color={C.accent} stripes={C.stripes} position={[sx * 0.282, 0.27, -0.02]} rotation-y={(sx * Math.PI) / 2} />
            ))}
            <mesh geometry={geo.cube} position={[0.04, 0.41, 0.0]} scale={[0.24, 0.025, 0.2]}>
              <Flat color={C.armor2} />
            </mesh>
            {[-1, 1].map((sx) => (
              <mesh key={sx} geometry={geo.cube} position={[sx * 0.09, 0.405, -0.17]} scale={[0.12, 0.02, 0.09]}>
                <Flat color={C.dark} />
              </mesh>
            ))}
            {/* the side pods on short arms */}
            {[-1, 1].map((sx) => (
              <group key={sx} position={[sx * 0.355, 0.15, 0.02]}>
                <mesh geometry={geo.arm} position-x={-sx * 0.06}>
                  <Flat color={C.frame} />
                </mesh>
                <mesh geometry={geo.pod}>
                  <Flat color={C.armor2} />
                </mesh>
                <Plate geo={geo} w={0.13} h={0.05} color={C.accent} stripes={C.stripes} position={[0, 0.06, 0.152]} />
                {[-1, 1].map((a) =>
                  [-1, 1].map((b) => (
                    <mesh key={`${a}${b}`} geometry={geo.tube} position={[a * 0.032, -0.025 + b * 0.034, 0.152]}>
                      <Flat color={C.dark} />
                    </mesh>
                  )),
                )}
              </group>
            ))}
            {/* the antenna: a whip in two parts, wobbling, with a blinking tip */}
            <group position={[-0.17, 0.4, -0.18]}>
              <mesh geometry={geo.antBase}>
                <Flat color={C.frame} />
              </mesh>
              <Sway axis="x" rate={0.7} amp={0.05} kick={thump} kickAmp={0.22} position-y={0.03}>
                <Sway axis="z" i={1} rate={0.55} amp={0.06} kick={hiss} kickAmp={0.12}>
                  <mesh geometry={geo.ant1}>
                    <Flat color={C.dark} />
                  </mesh>
                  <Sway axis="x" i={2} rate={0.7} amp={0.08} kick={thump} kickAmp={0.3} position-y={0.19}>
                    <mesh geometry={geo.ant2}>
                      <Flat color={C.dark} />
                    </mesh>
                    <mesh geometry={geo.tip} position-y={0.18}>
                      <meshStandardMaterial ref={set('tipMat')} color={C.tip} emissive={C.tip} emissiveIntensity={0.4} flatShading />
                    </mesh>
                  </Sway>
                </Sway>
              </Sway>
            </group>
            {/* vent puffs, and a hiss on starting and stopping */}
            <Particles count={9} life={1.8} origin={[0, 0.42, -0.17]} spread={0.1} velocity={[0, 0.35, -0.12]} scatter={0.08} drift={0.06} size={[0.025, 0.08]} colors={['#f2f2f4', '#e2e4ea']} opacity={[0.55, 0]} geometry={geo.puff} seed={4} />
            <Burst tap={hiss} geometry={geo.puff} count={12} colors={['#ffffff', '#e8eaef']} speed={0.9} gravity={-1.2} size={0.06} life={1.1} origin={[0, 0.42, -0.2]} spread={0.7} up={1.2} seed={6} />
          </group>
        </group>
      </group>

      {/* footfall dust and rings (in the patch's space) */}
      {[0, 1].map((f) => (
        <group key={f}>
          <Burst tap={feetK[f]} geometry={geo.puff} count={14} colors={C.dust} speed={1.0} gravity={2.4} size={0.05} life={0.9} origin={dust[f]} spread={1.2} up={0.55} seed={10 + f} />
          <group ref={set(`ripple${f}`)}>
            <Ripple tap={feetK[f]} count={2} color={C.dust[1]} radius={0.9} life={0.8} opacity={0.6} />
          </group>
        </group>
      ))}
    </group>
  )
}

export default function MechWalkerScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[3.0, 1.95, 4.1]} target={[0, 0.78, 0]} hint="The walker shifts its weight from leg to leg, its cockpit swivelling to scan as the visor light sweeps and the antenna wobbles · tap it and it stomps three heavy steps out and three back, each footfall kicking up dust and thumping the ground · Look swaps scout, heavy, desert and arctic · drag to orbit">
      <MechWalker {...props} />
    </Stage>
  )
}
