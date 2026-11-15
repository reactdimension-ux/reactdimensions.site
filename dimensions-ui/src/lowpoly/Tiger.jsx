import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { InfoHint, facet, useGeo } from './kit.jsx'

// A low-poly Bengal tiger you drive. It is built to real size (about 1 m at
// the shoulder, 2 m nose to rump) from chamfered, faceted blocks, and the
// coat is painted facet by facet: orange, a cream chest, belly, chin and
// cheeks, and black stripes that break up round the body like the real thing.
//
// It walks on a mechanism rather than a canned animation:
//   gait      a phase clock runs at a cadence set by the speed and the
//             stride. Each leg has an offset on that clock (lateral sequence
//             for a walk, diagonal pairs for a trot) and a duty factor: how
//             much of the cycle its foot stays on the ground.
//   feet      a foot in its stance phase is planted in the world and stays
//             put while the body moves over it. In its swing phase it lifts
//             and arcs to where it needs to land to carry the next stance,
//             worked out from where the hip is heading.
//   legs      the hips ride on the body; two-bone inverse kinematics bends
//             each leg (elbow back on the forelegs, knee forward on the hind)
//             to reach from its hip to its foot.
//   body      a point mass with acceleration and a turn rate that grows with
//             speed. It bobs twice a stride, rolls side to side on a walk,
//             leans into turns and pitches with acceleration; the forequarters
//             and head lag a little behind a turn, and the tail trails.
// Drive it with the arrow keys or WASD (click the scene first) or the on-
// screen pad. Skeleton shows the joints, the planted feet and the landing
// points the swinging feet are aiming for.
// Frame: +x is forward, +y up, +z the tiger's right. Metres.

const ORANGE = '#ef7f1f'
const BLACK = '#1d1b22'
const CREAM = '#f1e9db'
const PINK = '#e07a6c'
const AMBER = '#e3a93a'

const PAW_H = 0.08
// hips in the body frame; bone lengths; which way the middle joint bends
const LEGS = [
  { hip: [0.42, 0.78, -0.17], L1: 0.4, L2: 0.38, front: true, dx: 0.03 },
  { hip: [0.42, 0.78, 0.17], L1: 0.4, L2: 0.38, front: true, dx: 0.03 },
  { hip: [-0.45, 0.8, -0.18], L1: 0.42, L2: 0.42, front: false, dx: -0.04 },
  { hip: [-0.45, 0.8, 0.18], L1: 0.42, L2: 0.42, front: false, dx: -0.04 },
]
// phase offsets per leg (LF, RF, LH, RH) and the stance duty factor
const GAITS = {
  walk: { offsets: [0.25, 0.75, 0, 0.5], duty: 0.65, roll: 1 },
  trot: { offsets: [0, 0.5, 0.5, 0], duty: 0.45, roll: 0.35 },
}
const TAIL_N = 8
const TAIL_L = 0.12

// ---- shape ----

// A box with its corners and edges chamfered towards a superellipsoid: the
// blocky-but-rounded form every part of the tiger is cut from.
function roundBox(w, h, d, sx, sy, sz, n = 3) {
  const g = new THREE.BoxGeometry(w, h, d, sx, sy, sz)
  const p = g.attributes.position
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i)
    const y = p.getY(i)
    const z = p.getZ(i)
    const u = Math.abs(x / (w / 2))
    const v = Math.abs(y / (h / 2))
    const q = Math.abs(z / (d / 2))
    const r = Math.pow(u ** n + v ** n + q ** n, 1 / n)
    if (r > 1e-6) {
      const k = Math.max(u, v, q) / r
      p.setXYZ(i, x * k, y * k, z * k)
    }
  }
  return g
}

// Colour a geometry one facet at a time: fn(cx, cy, cz, normal) gives each
// face's colour from its centre, so markings follow the facets.
function paint(geo, fn) {
  const g = geo.index ? geo.toNonIndexed() : geo
  if (g !== geo) geo.dispose()
  const p = g.attributes.position
  const col = new Float32Array(p.count * 3)
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  const n = new THREE.Vector3()
  const m = new THREE.Vector3()
  const C = new THREE.Color()
  for (let i = 0; i < p.count; i += 3) {
    a.fromBufferAttribute(p, i)
    b.fromBufferAttribute(p, i + 1)
    c.fromBufferAttribute(p, i + 2)
    m.copy(a).add(b).add(c).divideScalar(3)
    n.subVectors(b, a).cross(c.sub(a)).normalize()
    C.set(fn(m.x, m.y, m.z, n))
    for (let k = 0; k < 3; k++) col.set([C.r, C.g, C.b], (i + k) * 3)
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  g.computeVertexNormals()
  return g
}

// The coat of the trunk: cream underneath, stripes wrapping round that thin
// out towards the belly and break here and there. ox, oy place the part on
// the body so stripes line up across parts.
const coat =
  ({ ox = 0, oy = 0, k = 26, seed = 0 }) =>
  (x, y, z, n) => {
    const X = x + ox
    const Y = y + oy
    if (n.y < -0.45 || (Y < 0.64 && Math.abs(z) < 0.15) || (X > 0.55 && Y < 0.8 && n.x > 0.3)) return CREAM
    const v = Math.sin(X * k + Math.sin(Y * 5 + seed) * 1.0 + Math.sin(z * 6 + seed) * 0.4)
    const thr = 0.5 + Math.max(0, 0.9 - Y) * 0.6
    const gap = Math.sin(X * 9 + Y * 7 + seed * 2) > 0.8
    return v > thr && !gap ? BLACK : ORANGE
  }
// rings round a leg or the tail (y runs 0 at the top to -1 at the bottom)
const rings =
  (L, seed, k = 30) =>
  (x, y) =>
    Math.sin(-y * L * k + seed) > 0.6 ? BLACK : ORANGE
// the face: chin, cheeks and brows cream, a line through the eye, chevrons on
// the forehead, stripes down the side of the head
const face = (x, y, z) => {
  const az = Math.abs(z)
  if (y < -0.085) return CREAM
  if (x > 0.02 && y < 0.0 && az > 0.09) return CREAM
  if (x > 0.09 && y > 0.03 && y < 0.1 && az > 0.05 && az < 0.15) return CREAM
  if (x > 0.13 && y > -0.02 && y < 0.05 && az > 0.045 && az < 0.095) return BLACK
  if (y > 0.02 && x < 0.12 && Math.sin((x - az * 0.7) * 34) > 0.55) return BLACK
  if (x < -0.04 && az > 0.1 && Math.sin(y * 30 + x * 10) > 0.6) return BLACK
  return ORANGE
}
const muzzle = (x, y, z, n) => (n.y > 0.4 && Math.abs(z) < 0.06 ? ORANGE : CREAM)

// a bone: a tapered six-sided column hanging from its joint (y from 0 to -1,
// scaled to its length when placed)
const bone = (rTop, rBot, L, seed) => paint(facet(new THREE.CylinderGeometry(rTop, rBot, 1, 6, 4).translate(0, -0.5, 0), 0.012, seed), rings(L, seed))

const DOWN = new THREE.Vector3(0, -1, 0)
const UP = new THREE.Vector3(0, 1, 0)

export function Tiger({ gait = 'walk', speed: maxSpeed = 1.4, stride = 1.1, stepHeight = 0.12, bounce = 0.6, skeleton = false, follow = true, auto = true, ctrl, hud }) {
  const G = GAITS[gait] || GAITS.walk
  const { controls, camera } = useThree()
  const [hover, setHover] = useState(false)
  useEffect(() => void (document.body.style.cursor = hover ? 'pointer' : ''), [hover])

  const geo = useGeo(
    () => ({
      torso: paint(facet(roundBox(1.3, 0.6, 0.5, 14, 4, 4), 0.012, 1), coat({ oy: 0.85, seed: 1 })),
      chest: paint(facet(roundBox(0.6, 0.66, 0.52, 7, 4, 4), 0.012, 2), coat({ ox: 0.42, oy: 0.88, seed: 1 })),
      // the neck hangs from the head back to the shoulders; once it is
      // turned, its local +x faces are the throat
      neck: paint(facet(new THREE.CylinderGeometry(0.17, 0.2, 1, 7, 3).translate(0, -0.5, 0), 0.01, 3), (x, y, z, n) => (n.x > 0.45 ? CREAM : Math.sin(-y * 0.36 * 30 + 1) > 0.55 ? BLACK : ORANGE)),
      head: paint(facet(roundBox(0.4, 0.34, 0.36, 6, 5, 5, 3.2), 0.008, 4), face),
      muzzle: paint(facet(roundBox(0.2, 0.15, 0.22, 3, 2, 3), 0.006, 5), muzzle),
      nose: roundBox(0.05, 0.04, 0.08, 1, 1, 1, 2.5),
      eye: new THREE.OctahedronGeometry(0.03, 0),
      iris: new THREE.OctahedronGeometry(0.016, 0),
      ear: new THREE.ConeGeometry(0.075, 0.1, 4, 1).translate(0, 0.05, 0),
      earIn: new THREE.ConeGeometry(0.045, 0.06, 4, 1).translate(0, 0.03, 0),
      fu: bone(0.1, 0.075, 0.4, 11),
      fl: bone(0.07, 0.055, 0.38, 12),
      hu: bone(0.12, 0.08, 0.42, 13),
      hl: bone(0.07, 0.055, 0.42, 14),
      joint: new THREE.IcosahedronGeometry(0.07, 0),
      paw: paint(facet(roundBox(0.17, PAW_H, 0.13, 3, 1, 2), 0.006, 6), (x, y, z, n) => (n.x > 0.5 && Math.abs(Math.sin(z * 75)) < 0.35 ? '#e06e14' : ORANGE)),
      tail: Array.from({ length: TAIL_N }, (_, i) => {
        const r0 = 0.045 - i * 0.002
        return paint(facet(new THREE.CylinderGeometry(r0 - 0.003, r0, TAIL_L * 1.08, 6, 1).rotateZ(Math.PI / 2).translate(-TAIL_L / 2, 0, 0), 0.004, 20 + i), (x) => (i === TAIL_N - 1 ? BLACK : Math.sin((x - i * TAIL_L) * 36) > 0.45 ? BLACK : ORANGE))
      }),
      marker: new THREE.SphereGeometry(0.035, 10, 8),
      ring: new THREE.RingGeometry(0.09, 0.125, 24).rotateX(-Math.PI / 2),
    }),
    [],
  )
  const mats = useMemo(
    () => ({
      coat: new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.8 }),
      pink: new THREE.MeshStandardMaterial({ color: PINK, flatShading: true, roughness: 0.6 }),
      black: new THREE.MeshStandardMaterial({ color: BLACK, flatShading: true, roughness: 0.35 }),
      amber: new THREE.MeshStandardMaterial({ color: AMBER, flatShading: true, roughness: 0.3, emissive: AMBER, emissiveIntensity: 0.25 }),
      cream: new THREE.MeshStandardMaterial({ color: CREAM, flatShading: true, roughness: 0.8 }),
      orange: new THREE.MeshStandardMaterial({ color: ORANGE, flatShading: true, roughness: 0.8 }),
      joint: new THREE.MeshBasicMaterial({ color: '#ff4d6d', depthTest: false, transparent: true, opacity: 0.95 }),
    }),
    [],
  )
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats])
  // the skeleton view ghosts the body so the mechanism shows through
  useEffect(() => {
    ;['coat', 'pink', 'black', 'amber', 'cream', 'orange'].forEach((k) => {
      const m = mats[k]
      m.transparent = skeleton
      m.opacity = skeleton ? 0.22 : 1
      m.depthWrite = !skeleton
      m.needsUpdate = true
    })
  }, [mats, skeleton])

  // ---- state ----
  const root = useRef()
  const body = useRef()
  const front = useRef()
  const chest = useRef()
  const head = useRef()
  const eyes = useRef([])
  const ears = useRef([])
  const tail = useRef([])
  const bones = useRef([]) // per leg: { up, lo, paw, knee, ankle, hip, ring }
  const light = useRef()
  const sunTarget = useMemo(() => new THREE.Object3D(), [])
  useEffect(() => {
    if (light.current) light.current.target = sunTarget
  }, [sunTarget])
  useEffect(() => () => (document.body.style.cursor = ''), [])
  const localCtrl = useRef({ fwd: 0, turn: 0, manual: false })
  const st = useRef({
    pos: new THREE.Vector3(),
    heading: 0,
    speed: 0,
    accel: 0,
    yawRate: 0,
    yawLag: 0,
    phase: 0,
    f: 0,
    strideEff: 0,
    legs: LEGS.map((l) => ({ foot: new THREE.Vector3(l.hip[0] + l.dx, 0, l.hip[2]), lift: new THREE.Vector3(), target: new THREE.Vector3(), hip: new THREE.Vector3(), knee: new THREE.Vector3(), ankle: new THREE.Vector3(), swinging: false, s: 0 })),
  })
  const live = useRef({})
  live.current = { G, maxSpeed, stride, stepHeight, bounce, follow, auto, ctrl: ctrl || localCtrl, hud }
  const tmp = useMemo(() => ({ a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3(), d: new THREE.Vector3(), fwd: new THREE.Vector3() }), [])

  // place a bone group so it hangs from `from` to `to`
  const placeBone = (obj, from, to) => {
    obj.position.copy(from)
    tmp.d.subVectors(to, from)
    const L = tmp.d.length()
    obj.quaternion.setFromUnitVectors(DOWN, tmp.d.divideScalar(L))
    obj.scale.set(1, L, 1)
  }

  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 1 / 30)
    if (!(dt > 0)) return
    const t = clock.elapsedTime
    const S = st.current
    const { G, maxSpeed, stride, stepHeight, bounce, follow, auto, ctrl, hud } = live.current
    const { a, b, c, fwd } = tmp

    // ---- drive: keys or the pad, or a wander on its own ----
    let fwdIn = 0
    let turnIn = 0
    if (ctrl.current.manual) {
      fwdIn = ctrl.current.fwd
      turnIn = ctrl.current.turn
    } else if (auto) {
      fwdIn = 0.75
      turnIn = Math.sin(t * 0.23) * 0.45
      // it wanders, but not off into the distance: past 10 m it turns for home
      const dist = Math.hypot(S.pos.x, S.pos.z)
      if (dist > 10) {
        const want = Math.atan2(S.pos.z, -S.pos.x)
        let diff = want - S.heading
        diff = Math.atan2(Math.sin(diff), Math.cos(diff))
        turnIn = THREE.MathUtils.clamp(diff * 1.5, -1, 1)
      }
    }

    // ---- body dynamics ----
    const targetSpeed = fwdIn * maxSpeed
    const accMax = Math.abs(targetSpeed) > Math.abs(S.speed) ? 2.2 : 3.2
    S.accel = THREE.MathUtils.clamp((targetSpeed - S.speed) / dt, -accMax, accMax)
    S.speed += S.accel * dt
    const yawTarget = turnIn * 1.5 * (0.25 + 0.75 * Math.min(1, Math.abs(S.speed) / 1.2))
    S.yawRate += (yawTarget - S.yawRate) * Math.min(1, dt * 8)
    S.heading += S.yawRate * dt
    fwd.set(Math.cos(S.heading), 0, -Math.sin(S.heading))
    S.pos.addScaledVector(fwd, S.speed * dt)
    S.yawLag += (S.yawRate - S.yawLag) * Math.min(1, dt * 4)

    // ---- the gait clock ----
    // cadence follows speed over stride; slow going takes short quick steps
    // rather than a crawl, and a step already in the air always completes
    const anySwing = S.legs.some((l) => l.swinging)
    const fMin = Math.abs(S.speed) > 0.03 || anySwing ? 0.85 : 0
    S.f = Math.max(Math.abs(S.speed) / stride, fMin)
    S.phase = (S.phase + S.f * dt) % 1
    S.strideEff = S.f > 0 ? Math.abs(S.speed) / S.f : 0
    const sf = Math.min(1, S.strideEff / 0.9)

    // ---- pose the body ----
    root.current.position.copy(S.pos)
    root.current.rotation.y = S.heading
    const bob = bounce * 0.03 * sf * Math.sin(4 * Math.PI * S.phase + Math.PI / 2)
    body.current.position.y = bob
    body.current.rotation.x = 0.035 * sf * G.roll * Math.sin(2 * Math.PI * S.phase) + S.yawRate * 0.05
    body.current.rotation.z = -S.accel * 0.025 + bounce * 0.012 * sf * Math.sin(4 * Math.PI * S.phase)
    front.current.rotation.y = S.yawLag * 0.12
    const breathe = 1 + Math.sin(t * 1.8) * 0.015 * (1 - sf)
    chest.current.scale.set(1, breathe, breathe)
    head.current.rotation.y = S.yawLag * 0.28 + Math.sin(t * 0.5) * 0.25 * (1 - sf)
    head.current.rotation.z = Math.sin(t * 0.7 + 1) * 0.04 * (1 - sf) + Math.sin(4 * Math.PI * S.phase) * 0.025 * sf
    head.current.position.y = 1.13 - bob * 0.5
    const bl = t % 4.1
    eyes.current.forEach((e) => e && (e.scale.y = bl < 0.12 ? 0.15 : 1))
    ears.current.forEach((e, i) => {
      if (!e) return
      const ph = (t * 0.29 + i * 0.43) % 1
      e.rotation.x = ph < 0.06 ? Math.sin((ph / 0.06) * Math.PI) * 0.4 * (i ? -1 : 1) : 0
    })
    tail.current.forEach((g, i) => {
      if (!g) return
      g.rotation.y = Math.sin(t * (1.6 + 1.6 * sf) - i * 0.55) * (0.12 - 0.05 * sf) - (S.yawLag * 0.1 * (i + 1)) / TAIL_N
      g.rotation.z = (i ? -0.17 : 0.75) + Math.sin(t * 1.2 - i * 0.4) * 0.03 + sf * Math.sin(4 * Math.PI * S.phase - i * 0.5) * 0.03
    })
    root.current.updateMatrixWorld(true)

    // ---- feet and legs ----
    const dirSign = S.speed >= 0 ? 1 : -1
    S.legs.forEach((leg, i) => {
      const L = LEGS[i]
      const psi = (((S.phase - G.offsets[i]) % 1) + 1) % 1
      const stance = psi < G.duty
      body.current.localToWorld(leg.hip.set(L.hip[0], L.hip[1], L.hip[2]))
      // where the foot rests under its hip, on the ground
      const rest = a.set(leg.hip.x, 0, leg.hip.z).addScaledVector(fwd, L.dx)
      if (stance) {
        leg.swinging = false
      } else {
        if (!leg.swinging) {
          leg.swinging = true
          leg.lift.copy(leg.foot)
        }
        const s = (psi - G.duty) / (1 - G.duty)
        leg.s = s
        // land where the body will be by then, plus half a stance ahead of
        // the hip, so this stance carries the foot from in front to behind
        const swingT = (1 - G.duty) / S.f
        leg.target.copy(rest).addScaledVector(fwd, dirSign * (Math.abs(S.speed) * (1 - s) * swingT + (S.strideEff * G.duty) / 2))
        const e = s * s * (3 - 2 * s)
        leg.foot.lerpVectors(leg.lift, leg.target, e)
        leg.foot.y = stepHeight * Math.sin(Math.PI * s) * (0.35 + 0.65 * sf)
      }
      // two-bone IK from the hip to the ankle
      const A = leg.ankle.copy(leg.foot).addScaledVector(UP, PAW_H * 0.9)
      const H = leg.hip
      let d = H.distanceTo(A)
      const maxD = (L.L1 + L.L2) * 0.995
      if (d > maxD) {
        A.sub(H).multiplyScalar(maxD / d).add(H)
        d = maxD
      }
      const along = (L.L1 * L.L1 - L.L2 * L.L2 + d * d) / (2 * d)
      const out = Math.sqrt(Math.max(0, L.L1 * L.L1 - along * along))
      const axis = b.subVectors(A, H).divideScalar(d)
      const bend = c.copy(fwd).multiplyScalar(L.front ? -1 : 1)
      bend.addScaledVector(axis, -bend.dot(axis))
      if (bend.lengthSq() < 1e-6) bend.copy(fwd)
      bend.normalize()
      leg.knee.copy(H).addScaledVector(axis, along).addScaledVector(bend, out)
      const B = bones.current[i]
      if (!B) return
      placeBone(B.up, H, leg.knee)
      placeBone(B.lo, leg.knee, A)
      B.knee.position.copy(leg.knee)
      B.ankle.position.copy(A)
      B.hip.position.copy(H)
      B.paw.position.copy(A).addScaledVector(UP, -PAW_H * 0.45).addScaledVector(fwd, 0.04)
      B.paw.rotation.set(0, S.heading, leg.swinging ? -Math.sin(Math.PI * leg.s) * 0.45 : 0)
      B.ring.position.copy(leg.swinging ? leg.target : leg.foot).setY(0.004)
      B.ring.material.color.set(leg.swinging ? '#ff4d6d' : '#3a86ff')
    })

    // ---- the camera and the sun keep up ----
    if (follow && controls) {
      const d = a.set(S.pos.x, 0.8, S.pos.z).sub(controls.target).multiplyScalar(1 - Math.exp(-6 * dt))
      controls.target.add(d)
      camera.position.add(d)
      controls.update()
    }
    if (light.current) {
      light.current.position.set(S.pos.x + 4, 7, S.pos.z + 3)
      sunTarget.position.copy(S.pos)
      sunTarget.updateMatrixWorld()
    }
    if (hud?.current) hud.current.textContent = `${Math.abs(S.speed).toFixed(2)} m/s · ${S.f.toFixed(2)} strides/s · stride ${S.strideEff.toFixed(2)} m · ${G === GAITS.trot ? 'trot' : 'walk'}`
  })

  const M = mats
  return (
    <group>
      <directionalLight ref={light} intensity={2.1} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0002} shadow-normalBias={0.02} shadow-radius={4}>
        <orthographicCamera attach="shadow-camera" args={[-4, 4, 4, -4, 0.5, 20]} />
      </directionalLight>
      <primitive object={sunTarget} />

      <group ref={root} onPointerOver={(e) => (e.stopPropagation(), setHover(true))} onPointerOut={() => setHover(false)} onClick={(e) => e.stopPropagation()}>
        <group ref={body}>
          <mesh geometry={geo.torso} material={M.coat} position={[0, 0.85, 0]} castShadow receiveShadow />
          {/* forequarters: chest, neck and head, which lag a turn */}
          <group ref={front} position={[0.42, 0, 0]}>
            <mesh ref={chest} geometry={geo.chest} material={M.coat} position={[0, 0.88, 0]} castShadow />
            <mesh geometry={geo.neck} material={M.coat} position={[0.5, 1.08, 0]} rotation-z={-1.43} scale={[1, 0.36, 1]} castShadow />
            <group ref={head} position={[0.58, 1.1, 0]} scale={1.22}>
              <mesh geometry={geo.head} material={M.coat} castShadow />
              <mesh geometry={geo.muzzle} material={M.coat} position={[0.27, -0.045, 0]} castShadow />
              <mesh geometry={geo.nose} material={M.pink} position={[0.385, 0.0, 0]} />
              {[-1, 1].map((s, i) => (
                <group key={s}>
                  <mesh ref={(m) => (eyes.current[i] = m)} geometry={geo.eye} material={M.black} position={[0.19, 0.03, s * 0.085]} scale={[0.5, 0.8, 1]} />
                  <mesh geometry={geo.iris} material={M.amber} position={[0.205, 0.03, s * 0.085]} scale={[0.5, 0.8, 1]} />
                  <group ref={(g) => (ears.current[i] = g)} position={[-0.02, 0.17, s * 0.13]} rotation={[0, 0, -0.15]}>
                    <mesh geometry={geo.ear} material={M.orange} rotation={[s * 0.45, Math.PI / 4, 0]} castShadow />
                    <mesh geometry={geo.earIn} material={M.cream} position={[0.025, 0.01, -s * 0.005]} rotation={[s * 0.45, Math.PI / 4, 0]} />
                  </group>
                </group>
              ))}
            </group>
          </group>
          {/* the tail: a chain of segments, each hinged on the one before */}
          <TailChain i={0} geo={geo} mat={M.coat} refs={tail} />
        </group>
      </group>

      {/* legs live in world space: hips follow the body, feet stay on the ground */}
      {LEGS.map((L, i) => (
        <group key={i} ref={(g) => g && (bones.current[i] = { up: g.children[0], lo: g.children[1], paw: g.children[2], hip: g.children[3], knee: g.children[4], ankle: g.children[5], ring: g.children[6] })}>
          <group>
            <mesh geometry={L.front ? geo.fu : geo.hu} material={M.coat} castShadow />
          </group>
          <group>
            <mesh geometry={L.front ? geo.fl : geo.hl} material={M.coat} castShadow />
            <mesh geometry={geo.joint} material={M.orange} scale={[0.9, 0.9 / Math.max(0.1, L.L2), 0.9]} />
          </group>
          <mesh geometry={geo.paw} material={M.coat} castShadow />
          <mesh geometry={geo.marker} material={M.joint} visible={skeleton} renderOrder={10} />
          <mesh geometry={geo.marker} material={M.joint} visible={skeleton} renderOrder={10} />
          <mesh geometry={geo.marker} material={M.joint} visible={skeleton} renderOrder={10} />
          <mesh geometry={geo.ring} visible={skeleton}>
            <meshBasicMaterial color="#3a86ff" transparent opacity={0.9} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function TailChain({ i, geo, mat, refs }) {
  if (i >= TAIL_N) return null
  return (
    <group ref={(g) => (refs.current[i] = g)} position={i ? [-TAIL_L, 0, 0] : [-0.62, 0.84, 0]}>
      <mesh geometry={geo.tail[i]} material={mat} castShadow />
      <TailChain i={i + 1} geo={geo} mat={mat} refs={refs} />
    </group>
  )
}

// ---- the scene ----

const KEYS = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' }

export default function TigerScene({ background = '#eceaf1', autoRotate = false, ...props }) {
  const ctrl = useRef({ fwd: 0, turn: 0, manual: false })
  const held = useRef({})
  const hud = useRef()
  const apply = () => {
    const k = held.current
    ctrl.current.fwd = k.up ? 1 : k.down ? -0.35 : 0
    ctrl.current.turn = k.left ? 1 : k.right ? -1 : 0
  }
  const press = (name, on) => {
    held.current[name] = on
    ctrl.current.manual = true
    apply()
  }
  const onKey = (on) => (e) => {
    const name = KEYS[e.code]
    if (!name) return
    e.preventDefault()
    press(name, on)
  }
  const pad = (name, label, style) => (
    <button
      type="button"
      aria-label={name}
      onPointerDown={(e) => (e.currentTarget.setPointerCapture(e.pointerId), press(name, true))}
      onPointerUp={() => press(name, false)}
      onPointerCancel={() => press(name, false)}
      onContextMenu={(e) => e.preventDefault()}
      style={{ gridArea: name, width: 44, height: 44, borderRadius: 12, border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,0.92)', color: '#2a2925', font: '700 16px/1 ui-monospace, Menlo, monospace', boxShadow: '0 2px 8px rgba(0,0,0,.14), inset 0 0 0 1px rgba(0,0,0,.08)', touchAction: 'none', userSelect: 'none', ...style }}
    >
      {label}
    </button>
  )
  return (
    <div tabIndex={0} onKeyDown={onKey(true)} onKeyUp={onKey(false)} onBlur={() => ((held.current = {}), apply())} style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none', background, outline: 'none' }}>
      <Canvas shadows dpr={[1, 1.75]} camera={{ position: [3.6, 2.0, 4.6], fov: 30, near: 0.05, far: 80 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}>
        <color attach="background" args={[background]} />
        <fog attach="fog" args={[background, 9, 30]} />
        <hemisphereLight args={['#ffffff', '#b9b3c6', 0.95]} />
        <directionalLight position={[-5, 3, -4]} intensity={0.6} color="#d6deff" />
        <mesh rotation-x={-Math.PI / 2} position-y={-0.001} receiveShadow>
          <planeGeometry args={[120, 120]} />
          <meshStandardMaterial color="#e3e0e9" roughness={1} />
        </mesh>
        <Tiger {...props} ctrl={ctrl} hud={hud} />
        <OrbitControls makeDefault enablePan={false} target={[0, 0.8, 0]} autoRotate={autoRotate} autoRotateSpeed={0.6} minDistance={2} maxDistance={14} maxPolarAngle={1.5} />
      </Canvas>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 14, display: 'grid', justifyContent: 'center', gridTemplateAreas: '". up ." "left down right"', gap: 6, pointerEvents: 'none' }}>
        {pad('up', '▲', { pointerEvents: 'auto' })}
        {pad('left', '◀', { pointerEvents: 'auto' })}
        {pad('down', '▼', { pointerEvents: 'auto' })}
        {pad('right', '▶', { pointerEvents: 'auto' })}
      </div>
      <div ref={hud} style={{ position: 'absolute', left: 12, top: 12, padding: '6px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.86)', font: '600 10.5px/1.4 ui-monospace, Menlo, monospace', letterSpacing: '0.04em', color: '#2a2925', pointerEvents: 'none' }}>
        0.00 m/s
      </div>
      <InfoHint>Click the scene, then drive with the arrow keys or WASD, or use the pad: ▲ walks, ◀ ▶ turn, ▼ backs up slowly · Gait, speed, stride, step height and bounce set the mechanics; the readout shows the live speed, cadence and stride · Skeleton ghosts the body to show the hips, knees and ankles, the planted feet (blue) and where each swinging foot is aiming to land (red) · drag to orbit</InfoHint>
    </div>
  )
}
