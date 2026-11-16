import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { Flat, Stage, TAU, blob, cone, facet, rng, useGeo, useTap, wobble } from './kit.jsx'

// A low-poly sloth hanging under a branch: a shaggy faceted body slung
// beneath a horizontal bough that grows out of a tree trunk, held up by four
// long two-bone limbs (each solved by a small IK so its hooked claws stay
// wrapped over the bark), a round head with a pale face, the dark eye-mask
// stripes and a gentle smile. Everything happens very slowly: a long blink,
// the head turning round toward the camera and away again, the body swaying
// from the branch like a hammock, tufts of fur and leaves fluttering. Tap it
// and it lets go with its near arm, slowly waves at you, then reaches back
// up and re-grips; the branch dips and a few leaves are shaken loose.

const LOOKS = {
  'three-toed': { fur: '#8f7b65', shag: '#a5907a', dark: '#6c5a49', face: '#ece1cc', muzzle: '#f6efe2', mask: '#2e221b', nose: '#2a1f1a', claw: '#3b322b', front: 3 },
  'two-toed': { fur: '#a27b55', shag: '#b78f67', dark: '#7f5d3f', face: '#d2ae86', muzzle: '#e2c4a0', mask: null, nose: '#5a382b', claw: '#d8c6a2', front: 2 },
  pale: { fur: '#ddcaa8', shag: '#ece0c8', dark: '#c4ae8c', face: '#fffaf1', muzzle: '#ffffff', mask: '#5a4434', nose: '#4a3a30', claw: '#8a7a68', front: 3 },
}
const BARK = '#8a6a4c'
const BARK2 = '#735740'
const LEAVES = ['#6cbc58', '#58aa4b', '#8acf68']

const ease = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u))
const clamp = (u) => Math.max(0, Math.min(1, u))

// the scene: a trunk at TX, the bough out along +x at height BY
const TX = -1.15
const BY = 1.85
const BR = 0.064 // bough radius where the sloth hangs
const HAND_Y = -0.088 // the palm, just under the bark
const CLAW_R = 0.09 // the hook's curl round the bough
const BODY = { pos: [0, -0.62, 0], scale: [0.42, 0.28, 0.27] }
const HEAD = [0.43, -0.5, 0.05]

// limbs in the sloth's frame (origin on the bough's axis, straight above the
// body): the shoulder or hip (buried in the body), the grip on the bough,
// segment lengths, which way the elbow or knee bends, radii and claw count
const LIMBS = [
  { S: [0.24, -0.52, 0.1], G: [0.44, HAND_Y, 0.02], L: [0.3, 0.3], pole: [0.25, -0.15, 1], r: [0.072, 0.058, 0.046], front: true, side: 1 },
  { S: [0.22, -0.52, -0.1], G: [0.3, HAND_Y, -0.02], L: [0.3, 0.3], pole: [0.25, -0.15, -1], r: [0.072, 0.058, 0.046], front: true, side: -1 },
  { S: [-0.26, -0.53, 0.1], G: [-0.42, HAND_Y, 0.02], L: [0.26, 0.26], pole: [-0.25, -0.15, 1], r: [0.075, 0.06, 0.048], front: false, side: 1 },
  { S: [-0.24, -0.53, -0.1], G: [-0.29, HAND_Y, -0.02], L: [0.26, 0.26], pole: [-0.25, -0.15, -1], r: [0.075, 0.06, 0.048], front: false, side: -1 },
]

// the wave: where the free hand goes, and the timeline (seconds)
const WAVE_AT = new THREE.Vector3(0.68, -0.15, 0.12)
const WAVE_POLE = new THREE.Vector3(1, -0.25, 0.45)
const DUR = 7
const relAt = (s) => (s < 0 || s > DUR ? 0 : s < 1.1 ? ease((s - 0.1) / 1.0) : s < 5.3 ? 1 : 1 - ease((s - 5.3) / 1.3))

// leaves on the bough, in its frame (x out from the trunk): position, turn
// round the bough, droop, size, colour
const LEAF_SPOTS = (() => {
  const r = rng(21)
  const out = []
  const cluster = (x, y, z, n, spread) => {
    for (let i = 0; i < n; i++) out.push({ p: [x + (r() - 0.5) * spread, y + (r() - 0.3) * spread * 0.5, z + (r() - 0.5) * spread], ry: r() * TAU, rx: -0.4 - r() * 0.7, s: 0.8 + r() * 0.5, c: LEAVES[i % LEAVES.length], ph: r() * TAU })
  }
  cluster(2.55, 0.11, 0.0, 6, 0.16) // the tip
  cluster(2.22, 0.37, 0.18, 4, 0.12) // the forward twig
  cluster(0.28, 0.4, -0.15, 5, 0.14) // the twig near the trunk
  cluster(1.95, 0.06, -0.08, 2, 0.08)
  return out
})()

// leaves shaken loose by the tap, in world space: start, delay
const FALLERS = [
  [[0.62, BY + 0.06, 0.1], 0.35],
  [[1.0, BY + 0.24, -0.02], 0.9],
  [[0.12, BY + 0.03, 0.08], 1.7],
]

// two-bone IK: from the shoulder S towards the target T, bending towards pole
const _d = new THREE.Vector3()
const _p = new THREE.Vector3()
const _e = new THREE.Vector3()
const _t = new THREE.Vector3()
const _u = new THREE.Vector3()
const Y = new THREE.Vector3(0, 1, 0)
function solve(S, T, L1, L2, pole, upper, lower, hand) {
  _d.subVectors(T, S)
  const len = _d.length()
  const dist = Math.max(0.05, Math.min(len, L1 + L2 - 0.002))
  _d.divideScalar(len || 1)
  const cosA = Math.max(-1, Math.min(1, (L1 * L1 + dist * dist - L2 * L2) / (2 * L1 * dist)))
  const sinA = Math.sqrt(1 - cosA * cosA)
  _p.copy(pole).addScaledVector(_d, -pole.dot(_d)).normalize()
  _e.copy(S).addScaledVector(_d, L1 * cosA).addScaledVector(_p, L1 * sinA)
  _t.copy(S).addScaledVector(_d, dist)
  upper.position.copy(S)
  upper.quaternion.setFromUnitVectors(Y, _u.subVectors(_e, S).normalize())
  lower.position.copy(_e)
  lower.quaternion.setFromUnitVectors(Y, _u.subVectors(_t, _e).normalize())
  hand.position.copy(_t)
}

// a hooked claw: a tube that tapers as it curls round the bough (in the y-z
// plane, the palm at the origin, the bough's axis CLAW_R above it), wrapping
// towards +z then over the top
function clawGeo() {
  const c = new THREE.Vector3(0, CLAW_R, 0)
  const curve = new THREE.CatmullRomCurve3(
    [0.35, 0.9, 1.5, 2.1, 2.6].map((a) => new THREE.Vector3(0, c.y - Math.cos(a) * CLAW_R, Math.sin(a) * CLAW_R)),
  )
  const tub = 8
  const rad = 4
  const g = new THREE.TubeGeometry(curve, tub, 0.013, rad, false)
  const p = g.attributes.position
  const pt = new THREE.Vector3()
  for (let i = 0; i < p.count; i++) {
    const seg = Math.floor(i / (rad + 1))
    const u = seg / tub
    curve.getPointAt(u, pt)
    const k = 1 - 0.75 * u
    p.setXYZ(i, pt.x + (p.getX(i) - pt.x) * k, pt.y + (p.getY(i) - pt.y) * k, pt.z + (p.getZ(i) - pt.z) * k)
  }
  g.computeVertexNormals()
  return g
}

export function Sloth({ look = 'three-toed' }) {
  const C = LOOKS[look] || LOOKS['three-toed']
  const { tap, handlers, clock } = useTap(1)
  const camera = useThree((s) => s.camera)
  const r = useRef({})
  const set = (k) => (o) => (r.current[k] = o)
  const limbs = useRef([])
  const leaves = useRef([])
  const tufts = useRef([])
  const fallers = useRef([])
  const eyes = useRef([])
  const st = useRef({ yaw: 0.6, roll: 0, smile: 1, init: false })
  const tmp = useMemo(() => ({ T: new THREE.Vector3(), S: new THREE.Vector3(), P: new THREE.Vector3(), cam: new THREE.Vector3(), q: new THREE.Quaternion(), qw: new THREE.Quaternion(), qi: new THREE.Quaternion(), eu: new THREE.Euler() }), [])
  const defs = useMemo(() => LIMBS.map((l) => ({ ...l, Sv: new THREE.Vector3(...l.S), Gv: new THREE.Vector3(...l.G), Pv: new THREE.Vector3(...l.pole).normalize() })), [])

  const geo = useGeo(
    () => ({
      body: facet(new THREE.IcosahedronGeometry(1, 1), 0.09, 31),
      ball: blob(1, 5, 1),
      lump: blob(1, 9, 0),
      head: blob(1, 4, 1),
      tuft: facet(new THREE.ConeGeometry(1, 1, 4, 1).rotateX(Math.PI).translate(0, -0.5, 0), 0.05, 12),
      spike: cone(1, 1, 4, 13),
      uppers: LIMBS.map((l, i) => facet(new THREE.CylinderGeometry(l.r[1], l.r[0], l.L[0] + 0.05, 6, 2).translate(0, (l.L[0] + 0.05) / 2, 0), 0.006, 40 + i)),
      lowers: LIMBS.map((l, i) => facet(new THREE.CylinderGeometry(l.r[2], l.r[1], l.L[1], 6, 2).translate(0, l.L[1] / 2, 0), 0.005, 50 + i)),
      knee: new THREE.IcosahedronGeometry(1, 0),
      claw: clawGeo(),
      smile: new THREE.TorusGeometry(1, 0.2, 3, 8, Math.PI).rotateZ(Math.PI),
      trunk: facet(new THREE.CylinderGeometry(0.11, 0.16, 2.15, 8, 4).translate(0, 1.075, 0), 0.018, 60, [1, 0.2, 1]),
      flare: facet(new THREE.ConeGeometry(0.3, 0.34, 8, 1).translate(0, 0.17, 0), 0.03, 61),
      stub: facet(new THREE.CylinderGeometry(0.05, 0.1, 0.32, 7, 1).translate(0, 0.16, 0), 0.01, 62),
      bough1: facet(new THREE.CylinderGeometry(0.062, 0.085, 1.82, 8, 4).translate(0, 0.91, 0).rotateZ(-Math.PI / 2), 0.008, 63, [0.2, 1, 1]),
      bough2: facet(new THREE.CylinderGeometry(0.03, 0.062, 0.78, 7, 2).translate(0, 0.39, 0).rotateZ(-Math.PI / 2), 0.006, 64, [0.2, 1, 1]),
      twig: facet(new THREE.CylinderGeometry(0.014, 0.03, 0.42, 5, 1).translate(0, 0.21, 0), 0.004, 65),
      leaf: facet(new THREE.OctahedronGeometry(1, 0).scale(0.045, 0.011, 0.1).translate(0, 0, 0.1), 0.004, 66),
      moss: facet(new THREE.IcosahedronGeometry(1, 1).scale(0.55, 0.12, 0.5), 0.03, 67, [1, 1, 1], (x, y) => y < 0),
      hit: new THREE.BoxGeometry(1.35, 0.95, 0.8),
    }),
    [],
  )

  // shaggy tufts hanging from the underside of the body
  const shag = useMemo(() => {
    const rr = rng(7)
    const [cx, cy, cz] = BODY.pos
    const [ax, ay, az] = BODY.scale
    return Array.from({ length: 28 }, (_, i) => {
      const x = (-0.85 + 1.7 * ((i * 0.618) % 1)) * ax
      const z = (rr() - 0.5) * 1.5 * az
      const y = cy - ay * Math.sqrt(Math.max(0.05, 1 - (x / ax) ** 2 - (z / az) ** 2)) + 0.04
      const tilt = [(-(z / az) * 0.5), (x / ax) * 0.4]
      return { p: [cx + x, y, cz + z], len: 0.06 + rr() * 0.06, w: 0.035 + rr() * 0.02, tilt, ph: rr() * TAU, c: i % 3 ? C.fur : C.shag }
    })
  }, [C])

  // lumps of fur over the back and flanks, so the body reads shaggy
  const lumps = useMemo(() => {
    const rr = rng(13)
    const [cx, cy, cz] = BODY.pos
    const [ax, ay, az] = BODY.scale
    return Array.from({ length: 14 }, (_, i) => {
      const a = rr() * TAU
      const x = (-0.8 + 1.6 * ((i * 0.381) % 1)) * ax
      const k = Math.sqrt(Math.max(0, 1 - (x / ax) ** 2))
      return { p: [cx + x * 0.92, cy + Math.cos(a) * ay * k * 0.8, cz + Math.sin(a) * az * k * 0.8], s: [0.11 + rr() * 0.05, 0.08 + rr() * 0.04, 0.1 + rr() * 0.04], rot: [rr(), rr(), rr()], c: i % 2 ? C.shag : C.dark }
    })
  }, [C])

  useFrame((_, dt) => {
    const t = clock.elapsedTime
    const o = r.current
    const S = st.current
    const s = tap.since(t)
    const busy = s >= 0 && s < DUR
    const step = Math.min(dt, 0.05)

    // the bough dips as the arm lets go and again as it grips back on
    o.bough.rotation.z = 0.012 * Math.sin(t * 0.5) * 0.3 - 0.022 * wobble(s - 0.15, 5, 1.4) - 0.016 * wobble(s - 6.45, 5, 1.6)

    // the slow hammock sway from the bough (it rolls round the bough's axis,
    // so the gripping claws stay put), a little more with one arm free
    const rel = relAt(s)
    o.sway.rotation.x = 0.07 * Math.sin(t * 0.42) + 0.025 * Math.sin(t * 0.17 + 1) + 0.05 * rel * Math.sin(t * 0.9)

    // breathing
    const b = Math.sin(t * 1.1)
    o.body.scale.set(1 - 0.012 * b, 1 + 0.025 * b, 1 + 0.02 * b)

    // limbs: each grips its spot; the near arm comes free for the wave
    defs.forEach((d, i) => {
      const L = limbs.current[i]
      if (!L || !L.upper || !L.lower || !L.hand) return
      tmp.T.copy(d.Gv)
      tmp.P.copy(d.Pv)
      let handQ = null
      if (i === 0 && rel > 0) {
        const w = rel
        const lift = Math.sin(Math.PI * clamp(w)) * (s < 3 ? 1 : 0.6)
        tmp.T.lerp(WAVE_AT, w)
        tmp.T.y += 0.1 * lift
        tmp.T.z += 0.1 * lift
        const a = clamp((s - 1.1) / 0.45) * clamp((5.3 - s) / 0.45)
        const ph = (s - 1.1) * TAU * 0.55
        tmp.T.x += a * 0.07 * Math.sin(ph)
        tmp.T.y += a * 0.025 * Math.cos(ph * 2)
        tmp.P.lerp(WAVE_POLE, w).normalize()
        tmp.eu.set(-0.6 * w, 0.9 * w, -0.25 * w + a * 0.55 * Math.sin(ph - 0.6))
        tmp.qw.setFromEuler(tmp.eu)
        handQ = tmp.qw
      }
      solve(d.Sv, tmp.T, d.L[0], d.L[1], tmp.P, L.upper, L.lower, L.hand)
      if (handQ) L.hand.quaternion.copy(handQ)
      else L.hand.quaternion.identity()
    })

    // fur tufts sway a beat behind the body
    tufts.current.forEach((m, i) => {
      if (!m) return
      const sh = shag[i]
      m.rotation.set(sh.tilt[0] - 0.1 * Math.sin(t * 0.42 - 0.7) + 0.04 * Math.sin(t * 1.3 + sh.ph), 0, sh.tilt[1] + 0.05 * Math.sin(t * 0.8 + sh.ph))
    })

    // the head: turns slowly round to look at the camera and away along the
    // bough, with a lazy tilt; it looks straight at you while it waves
    o.sway.updateWorldMatrix(true, false)
    tmp.cam.copy(camera.position)
    o.sway.worldToLocal(tmp.cam)
    const camYaw = Math.atan2(tmp.cam.x - HEAD[0], tmp.cam.z - HEAD[2])
    const away = (0.5 - 0.5 * Math.cos(t * 0.25 - 0.75)) * (1 - rel)
    const yaw = Math.max(-0.6, Math.min(1.75, camYaw + away * 1.15))
    const roll = (0.14 * Math.sin(t * 0.3 + 0.4)) * (1 - rel) + 0.22 * rel
    if (!S.init) {
      S.yaw = yaw
      S.init = true
    }
    const k = 1 - Math.exp(-step * 1.3)
    S.yaw += (yaw - S.yaw) * k
    S.roll += (roll - S.roll) * k
    o.head.rotation.set(0.08 * away - 0.05 * rel, S.yaw, S.roll)
    S.smile += ((1 + 0.45 * rel) - S.smile) * k * 2
    o.smile.scale.set(0.034 * S.smile, 0.03 * (0.8 + 0.2 * S.smile), 0.03)

    // a long, slow blink (eyes open for the thumbnail)
    const c = (t + 1.5) % 7.5
    const lid = c < 0.3 ? 1 - 0.9 * ease(c / 0.3) : c < 0.65 ? 0.1 : c < 1.05 ? 0.1 + 0.9 * ease((c - 0.65) / 0.4) : 1
    eyes.current.forEach((e) => e && (e.scale.y = lid))

    // leaves flutter now and then, in little gusts
    leaves.current.forEach((m, i) => {
      if (!m) return
      const L = LEAF_SPOTS[i]
      const gust = Math.max(0, Math.sin(t * 0.37 + L.p[0] * 1.3)) ** 10 + (busy ? Math.exp(-2 * Math.max(0, s - 0.15)) * (s > 0.15 ? 1 : 0) : 0)
      m.rotation.set(L.rx + 0.05 * Math.sin(t * 0.9 + L.ph) + 0.4 * gust * Math.sin(t * 11 + L.ph), L.ry, 0.25 * gust * Math.sin(t * 8 + L.ph))
    })

    // leaves shaken loose drift down, rocking, and settle on the floor
    fallers.current.forEach((m, i) => {
      if (!m) return
      const [p0, delay] = FALLERS[i]
      const u = s - delay
      m.visible = s >= 0 && u >= 0 && u < 7.5
      if (!m.visible) return
      const yy = p0[1] - 0.36 * u + 0.03 * Math.sin(u * 2.4)
      const landed = yy <= 0.015
      const tl = (p0[1] - 0.015) / 0.36
      const uu = landed ? tl : u
      m.position.set(p0[0] + 0.14 * Math.sin(uu * 1.9 + i) + 0.04 * uu, landed ? 0.015 : yy, p0[2] + 0.06 * uu + 0.05 * Math.cos(uu * 1.5 + i))
      if (landed) m.rotation.set(0, i * 2, 0)
      else m.rotation.set(0.35 * Math.cos(u * 1.5 + i), i * 2 + u * 0.4, 0.7 * Math.sin(u * 1.9 + i))
      m.scale.setScalar(Math.max(0.001, landed ? 1 - clamp((u - tl) / 1.2) : clamp(u * 4)))
    })
  })

  const claws = (n, side) =>
    Array.from({ length: n }, (_, j) => {
      const x = (j - (n - 1) / 2) * (n === 2 ? 0.034 : 0.03)
      return (
        <mesh key={j} geometry={geo.claw} position-x={x} scale={[1, 1, side]}>
          <Flat color={C.claw} roughness={0.45} side={THREE.DoubleSide} />
        </mesh>
      )
    })

  return (
    <group
      {...handlers}
      onClick={(e) => {
        e.stopPropagation()
        const s = tap.since(clock.elapsedTime)
        if (!(s >= 0 && s < DUR)) tap.kick(clock.elapsedTime)
      }}
    >
      {/* the tree: a mossy mound, a flared trunk and a broken-off top */}
      <mesh geometry={geo.moss} position={[TX, 0, 0]}>
        <Flat color="#6fae55" />
      </mesh>
      <mesh geometry={geo.flare} position={[TX, 0, 0]}>
        <Flat color={BARK2} />
      </mesh>
      <mesh geometry={geo.trunk} position={[TX, 0, 0]}>
        <Flat color={BARK} />
      </mesh>
      <mesh geometry={geo.stub} position={[TX + 0.02, 2.1, 0]} rotation-z={-0.25}>
        <Flat color={BARK2} />
      </mesh>
      {[
        [TX + 0.12, 2.3, 0.05, 0.4, 0.3],
        [TX - 0.05, 2.25, -0.08, 2.2, 0.1],
        [TX + 0.02, 2.35, 0.08, 4.3, -0.2],
      ].map(([x, y, z, ry, rz], i) => (
        <mesh key={i} geometry={geo.leaf} position={[x, y, z]} rotation={[-0.5, ry, rz]} scale={1.1}>
          <Flat color={LEAVES[i % 3]} emissive={LEAVES[i % 3]} emissiveIntensity={0.3} side={THREE.DoubleSide} />
        </mesh>
      ))}

      {/* the bough, out along +x from the trunk; the sloth hangs under it */}
      <group ref={set('bough')} position={[TX, BY, 0]}>
        <mesh geometry={geo.bough1}>
          <Flat color={BARK} />
        </mesh>
        <group position-x={1.8} rotation-z={0.12}>
          <mesh geometry={geo.bough2}>
            <Flat color={BARK} />
          </mesh>
        </group>
        <mesh geometry={geo.twig} position={[2.1, 0.03, 0]} rotation={[0.5, 0, -0.35]}>
          <Flat color={BARK2} />
        </mesh>
        <mesh geometry={geo.twig} position={[0.36, 0.02, 0]} rotation={[-0.4, 0, 0.25]}>
          <Flat color={BARK2} />
        </mesh>
        {LEAF_SPOTS.map((L, i) => (
          <group key={i} position={L.p} scale={L.s}>
            <mesh ref={(el) => (leaves.current[i] = el)} geometry={geo.leaf}>
              <Flat color={L.c} emissive={L.c} emissiveIntensity={0.3} side={THREE.DoubleSide} />
            </mesh>
          </group>
        ))}

        {/* the sloth, swinging gently about the bough's axis */}
        <group position-x={-TX}>
          <group ref={set('sway')}>
            <mesh geometry={geo.hit} position={[0.08, -0.55, 0.02]}>
              <meshBasicMaterial visible={false} />
            </mesh>
            {/* the body: a shaggy barrel with lumps and hanging tufts */}
            <group ref={set('body')} position={BODY.pos}>
              <mesh geometry={geo.body} scale={BODY.scale} rotation-z={0.06}>
                <Flat color={C.fur} />
              </mesh>
            </group>
            {lumps.map((m, i) => (
              <mesh key={`l${i}`} geometry={geo.lump} position={m.p} rotation={m.rot} scale={m.s}>
                <Flat color={m.c} />
              </mesh>
            ))}
            {shag.map((m, i) => (
              <group key={`t${i}`} position={m.p}>
                <mesh ref={(el) => (tufts.current[i] = el)} geometry={geo.tuft} scale={[m.w, m.len, m.w]}>
                  <Flat color={m.c} />
                </mesh>
              </group>
            ))}

            {/* four long limbs: upper and lower set by the IK each frame */}
            {LIMBS.map((l, i) => (
              <group key={`m${i}`}>
                <group ref={(el) => (limbs.current[i] = { ...limbs.current[i], upper: el })}>
                  <mesh geometry={geo.uppers[i]}>
                    <Flat color={C.fur} />
                  </mesh>
                  <mesh geometry={geo.lump} position-y={l.L[0] * 0.45} scale={[l.r[0] * 1.25, l.L[0] * 0.32, l.r[0] * 1.25]}>
                    <Flat color={C.shag} />
                  </mesh>
                </group>
                <group ref={(el) => (limbs.current[i] = { ...limbs.current[i], lower: el })}>
                  <mesh geometry={geo.knee} scale={l.r[1] * 1.08}>
                    <Flat color={C.fur} />
                  </mesh>
                  <mesh geometry={geo.lowers[i]}>
                    <Flat color={C.fur} />
                  </mesh>
                  <mesh geometry={geo.lump} position-y={l.L[1] * 0.5} scale={[l.r[1] * 1.15, l.L[1] * 0.3, l.r[1] * 1.15]}>
                    <Flat color={C.dark} />
                  </mesh>
                </group>
                <group ref={(el) => (limbs.current[i] = { ...limbs.current[i], hand: el })}>
                  <mesh geometry={geo.ball} scale={[0.058, 0.048, 0.05]}>
                    <Flat color={C.dark} />
                  </mesh>
                  {claws(l.front ? C.front : 3, l.side)}
                </group>
              </group>
            ))}

            {/* a neck of fur and the round head */}
            <mesh geometry={geo.ball} position={[0.32, -0.54, 0.02]} scale={[0.15, 0.15, 0.15]}>
              <Flat color={C.fur} />
            </mesh>
            <group ref={set('head')} position={HEAD}>
              <mesh geometry={geo.head} scale={[0.2, 0.185, 0.19]}>
                <Flat color={C.fur} />
              </mesh>
              {[
                [0, 0.16, -0.03, 0, 0.0],
                [0.07, 0.15, -0.02, 0, -0.45],
                [-0.07, 0.15, -0.02, 0, 0.45],
                [0.03, 0.14, -0.09, -0.4, -0.2],
                [-0.04, 0.14, -0.09, -0.4, 0.25],
              ].map(([x, y, z, rx, rz], i) => (
                <mesh key={`h${i}`} geometry={geo.spike} position={[x, y, z]} rotation={[rx, i, rz]} scale={[0.04, 0.07, 0.04]}>
                  <Flat color={i % 2 ? C.shag : C.dark} />
                </mesh>
              ))}
              {/* the pale face, muzzle and nose */}
              <mesh geometry={geo.ball} position={[0, -0.005, 0.098]} scale={[0.158, 0.135, 0.1]}>
                <Flat color={C.face} />
              </mesh>
              <mesh geometry={geo.ball} position={[0, -0.05, 0.17]} scale={[0.075, 0.052, 0.045]}>
                <Flat color={C.muzzle} />
              </mesh>
              <mesh geometry={geo.ball} position={[0, -0.032, 0.212]} scale={[0.032, 0.022, 0.018]}>
                <Flat color={C.nose} roughness={0.35} />
              </mesh>
              <mesh ref={set('smile')} geometry={geo.smile} position={[0, -0.068, 0.208]} rotation-x={-0.2}>
                <Flat color={C.nose} roughness={0.35} />
              </mesh>
              {/* the dark eye-mask stripes, sweeping back from each eye */}
              {C.mask &&
                [-1, 1].map((sx) => (
                  <mesh key={`k${sx}`} geometry={geo.ball} position={[sx * 0.08, 0.012, 0.172]} rotation={[0, sx * 0.55, -sx * 0.32]} scale={[0.072, 0.027, 0.03]}>
                    <Flat color={C.mask} />
                  </mesh>
                ))}
              {[-1, 1].map((sx, i) => (
                <group key={`e${sx}`} position={[sx * 0.062, 0.018, 0.196]}>
                  <group ref={(el) => (eyes.current[i] = el)}>
                    <mesh geometry={geo.knee} scale={[0.019, 0.019, 0.014]}>
                      <Flat color="#120d0b" roughness={0.25} />
                    </mesh>
                    <mesh geometry={geo.knee} position={[sx * 0.004 + 0.004, 0.007, 0.012]} scale={0.0055}>
                      <meshBasicMaterial color="#ffffff" />
                    </mesh>
                  </group>
                </group>
              ))}
            </group>
          </group>
        </group>
      </group>

      {/* leaves shaken loose by the tap */}
      {FALLERS.map((f, i) => (
        <mesh key={`f${i}`} ref={(el) => (fallers.current[i] = el)} geometry={geo.leaf} visible={false} scale={1.2}>
          <Flat color={LEAVES[i % 3]} emissive={LEAVES[i % 3]} emissiveIntensity={0.3} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  )
}

export default function SlothScene({ background, autoRotate, float = false, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[2.6, 1.95, 3.7]} target={[-0.08, 1.28, 0]} hint="The sloth hangs from its branch and does everything very slowly: a long blink, a lazy sway, its head turning round to look at you and away again, the leaves stirring now and then · tap it and it lets go with one arm, waves at you, then reaches back and grips the branch again as a few leaves drift down · Look swaps a three-toed, two-toed or pale sloth · drag to orbit">
      <Sloth {...props} />
    </Stage>
  )
}
