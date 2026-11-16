import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Burst, Flat, Stage, TAU, blinkAt, facet, lookAround, rng, swayAngle, useGeo, useTap, walk } from './kit.jsx'

// A low-poly peacock on a small grass patch: a faceted body with a scaly
// back, folded wings with chestnut primaries, a long upright neck built as a
// chain of links, a small head with a beak, face stripes and a fanned crest
// of tufted plumes, two long legs (thighs buried in the body, a jointed shank
// and splayed toes) and a long train of feather blades, each with an eye spot
// near its tip, drawn with instancing: every blade has its own pivot at the
// rump and its own folded and fanned pose. Idle, it walks a couple of steps,
// pecks at seed on a patch of bare earth, bobs and turns its head, walks back
// and stands; the crest sways and the folded train trails and sways behind.
// Tap it and the train lifts and fans out into a full semicircle, blade by
// blade from the centre outwards, bounces into place, rattles (the blades
// quiver and a shimmer runs across the eye spots), holds and folds back down.

const LOOKS = {
  indian: {
    body: '#2453c0', neck: '#2a63d4', belly: '#1a2c66', back: '#3f8a58', chip: ['#7f8f3a', '#2f7a52', '#4d9a5e'], neckChip: null,
    wing: '#cdb68c', bar: '#6e5234', primary: '#a8552c', leg: '#a09486', beak: '#cdbca6', eye: '#1b1a22',
    face: ['#ffffff', '#ffffff'], crest: '#2a5fd0', tuft: '#2fa8b0',
    vane: ['#6a5a2a', '#3f8c3c', '#62a845'], tint: [0.92, 1.06], rect: '#8a7458',
    rings: ['#c9a13b', '#27b0a2', '#1a2a8c'], crestSpread: 0.5, crestLen: 1,
  },
  green: {
    body: '#2b8048', neck: '#33914f', belly: '#1f5a36', back: '#3a8c4a', chip: ['#b59a34', '#57b06a', '#2a6f8a'], neckChip: ['#c4a63a', '#3aa06a', '#2a6f9a'],
    wing: '#3f7f63', bar: '#264a3c', primary: '#a86a2c', leg: '#8a8680', beak: '#3c3a40', eye: '#1b1a22',
    face: ['#f2c94c', '#4aa6d8'], crest: '#2f8a4f', tuft: '#3aa86a',
    vane: ['#6e5a24', '#5a8a2c', '#8aa83a'], tint: [0.9, 1.08], rect: '#6a5a40',
    rings: ['#d3a836', '#2fb38a', '#1e2f86'], crestSpread: 0.14, crestLen: 1.35,
  },
  white: {
    body: '#f7f5f0', neck: '#fbfaf6', belly: '#ece8de', back: '#f3f0e8', chip: ['#ebe6da', '#f8f6f0'], neckChip: null,
    wing: '#f1ede4', bar: '#e2dccf', primary: '#ebe5d8', leg: '#e6cfc2', beak: '#f0d6c6', eye: '#3a2c2c',
    face: ['#ffffff', '#ffffff'], crest: '#f6f3ec', tuft: '#ffffff',
    vane: ['#e6e0d2', '#f6f3ec', '#fbfaf6'], tint: [0.95, 1.03], rect: '#e8e2d4',
    rings: ['#ece4d0', '#f8f6ef', '#e0d8c4'], crestSpread: 0.5, crestLen: 1,
  },
}
const MEADOW = { ground: '#78c058', ground2: '#68b04c', tuft: '#4f9a3e', dirt: '#c7a676', seed: '#efcb62', flowers: ['#ffffff', '#ffd23f', '#f4c2d4'] }

const HOME = 1.5 // the bird's heading: side on to the default camera, so the folded train shows
const START = 0.12 // where it stands along that heading
const STRIDE = 0.24 // how far its two steps take it
const HIP = 0.44
const UPPER = 0.15
const LOWER = 0.28
const LEG_X = 0.075
const LINK = 0.1
const NECK = [0.3, 0.05, -0.1, -0.12, -0.1, -0.05] // the upright neck: each link's bend on the last
const PECK = [0.9, 0.5, 0.4, 0.3, 0.25, 0.25] // added on a peck, so the neck curls down to the ground
const neckR = (i) => 0.056 - i * 0.004
const PIVOT = [0, 0.15, -0.3] // the train's root, on the rump (body frame)
const SHOW = 4.4 // seconds a display lasts
const IDLE = 10 // seconds an idle loop lasts

// The train: four layers of eyed blades, longest at the back, and a few
// plain grey-brown tail feathers behind them that prop the fan up.
const LAYERS = [
  { len: 1.12, n: 23, w: 0.17 },
  { len: 0.88, n: 19, w: 0.155 },
  { len: 0.64, n: 15, w: 0.14 },
  { len: 0.42, n: 11, w: 0.12 },
]
const RECT = { len: 0.6, n: 9, w: 0.07 }
const DROOP = 0.86 // how steeply the folded train falls from the rump
// Each blade curves up toward its eye side (z = BEND y^2 on the unit blade).
// Folded, every blade is a piece of the same curve (the shorter ones lie on
// the longer, so their eyes stud the train along its length), falling
// steeply from the rump and lying out along the ground; fanned, the curve
// eases off to a gentle cup.
const BEND = 0.4
const FAN = 1.52 // half the fan's sweep (radians): a full semicircle
const LEAN = -0.24 // the open fan leans back a little
const EYE = [
  [0.05, 0.066],
  [0.034, 0.046],
  [0.019, 0.028],
]

const clamp01 = (x) => Math.min(1, Math.max(0, x))
const smooth = (x) => {
  const k = clamp01(x)
  return k * k * (3 - 2 * k)
}
const easeOut = (x) => 1 - (1 - clamp01(x)) ** 3

// The idle loop at idle time u: the walk phase and amount, how far along its
// heading it is, and how far down it is pecking (0 upright .. 1 beak to the ground).
function idle(u) {
  const k = ((u % IDLE) + IDLE) % IDLE
  let pos = 0
  let p = 0
  let amp = 0
  let peck = 0
  const steps = (w) => w - Math.sin(TAU * w) / TAU
  if (k >= 1.2 && k < 2.8) {
    const w = (k - 1.2) / 1.6
    pos = STRIDE * steps(w)
    p = w * TAU
    amp = Math.min(1, w * 5, (1 - w) * 5)
  } else if (k >= 2.8 && k < 8) pos = STRIDE
  else if (k >= 8 && k < 9.6) {
    const w = (k - 8) / 1.6
    pos = STRIDE * (1 - steps(w))
    p = -w * TAU
    amp = Math.min(1, w * 5, (1 - w) * 5)
  }
  if (k > 4.6 && k < 6.8) {
    const w = k - 4.6
    const env = smooth(w / 0.4) * smooth((2.2 - w) / 0.4)
    const jab = Math.max(0, Math.sin((w - 0.35) * TAU * 1.4)) ** 3
    peck = env * (0.8 + 0.2 * jab)
  }
  return { pos, p, amp, peck }
}

// A feather blade one unit long and one unit wide along +y: a bare shaft,
// then a vane widening to a rounded tip. Coloured shaft to tip with colors.
function vaneGeo(colors, shaft = 0.2) {
  const pts = [
    [0.006, 0],
    [0.008, shaft],
    [0.25, shaft + 0.2],
    [0.45, 0.72],
    [0.5, 0.88],
    [0.36, 0.97],
    [0, 1],
  ]
  const s = new THREE.Shape()
  s.moveTo(0, 0)
  pts.forEach(([x, y]) => s.lineTo(x, y))
  for (let i = pts.length - 2; i >= 0; i--) s.lineTo(-pts[i][0], pts[i][1])
  s.closePath()
  const g = new THREE.ShapeGeometry(s)
  facet(g, 0.012, 7, [0.2, 0.2, 1], (x, y) => y < shaft + 0.01)
  const q = g.attributes.position
  for (let i = 0; i < q.count; i++) q.setZ(i, q.getZ(i) + BEND * q.getY(i) ** 2)
  g.computeVertexNormals()
  const p = g.attributes.position
  const col = new Float32Array(p.count * 3)
  const c = [new THREE.Color(colors[0]), new THREE.Color(colors[1]), new THREE.Color(colors[2])]
  const out = new THREE.Color()
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i)
    if (y < 0.55) out.copy(c[0]).lerp(c[1], clamp01((y - shaft) / (0.55 - shaft)))
    else out.copy(c[1]).lerp(c[2], clamp01((y - 0.55) / 0.4))
    col.set([out.r, out.g, out.b], i * 3)
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  return g
}

// Each blade's two poses as quaternions in the train's frame. Folded: lying
// back along -z, drooping toward the ground, eye up, the layer barely spread.
// Fanned: standing in the plane across the body, eye to the front.
const _e = new THREE.Euler()
const _qa = new THREE.Quaternion()
function poses(phi, droop) {
  const fold = new THREE.Quaternion().setFromEuler(_e.set(-(Math.PI / 2 + droop), 0, 0))
  fold.multiply(_qa.setFromEuler(_e.set(0, 0, -phi * 0.19)))
  const fan = new THREE.Quaternion().setFromEuler(_e.set(LEAN, 0, 0))
  fan.multiply(_qa.setFromEuler(_e.set(0, 0, -phi)))
  return { fold, fan }
}

function makeBlades(L) {
  const r = rng(11)
  const eyed = []
  LAYERS.forEach((ly, k) => {
    for (let j = 0; j < ly.n; j++) {
      const phi = (-1 + (2 * j) / (ly.n - 1)) * FAN
      const a = Math.abs(phi) / FAN
      const sc = ly.w / 0.17
      eyed.push({
        ...poses(phi, DROOP + (r() - 0.5) * 0.03),
        layer: k,
        phi,
        len: ly.len * (0.97 + r() * 0.05),
        w: ly.w,
        dz: 0.026 * k + 0.007 * (j % 2),
        dOpen: 0.1 * a + 0.025 * k,
        dClose: 0.12 * (1 - a) + 0.03 * (3 - k),
        tint: L.tint[0] + r() * (L.tint[1] - L.tint[0]),
        rnd: r(),
        eyeY: 1 - (0.085 * sc) / ly.len, // the eye's place along the unit blade
        eyeS: sc,
      })
    }
  })
  const rect = Array.from({ length: RECT.n }, (_, j) => {
    const phi = (-1 + (2 * j) / (RECT.n - 1)) * 0.55
    return { ...poses(phi, DROOP + 0.03), layer: -1, phi, len: RECT.len, w: RECT.w, dz: -0.02 - 0.004 * (j % 2), dOpen: 0.02, dClose: 0.2, tint: 0.9 + r() * 0.15, rnd: r() }
  })
  return { eyed, rect }
}

export function Peacock({ look = 'indian' }) {
  const L = LOOKS[look] || LOOKS.indian
  const { tap, handlers, clock } = useTap(1)
  const walker = useRef()
  const pelvis = useRef()
  const body = useRef()
  const train = useRef()
  const links = useRef([])
  const headFix = useRef()
  const headPos = useRef()
  const headYaw = useRef()
  const eyes = useRef([])
  const crest = useRef([])
  const wings = useRef([])
  const hips = useRef([])
  const ankles = useRef([])
  const feet = useRef([])
  const vanes = useRef()
  const rects = useRef()
  const rings = useRef([])
  const st = useRef({ it: 0, t0: -99, face: 0 })

  const geo = useGeo(
    () => ({
      ground: facet(new THREE.CylinderGeometry(1.5, 1.55, 0.14, 18, 1).translate(0, -0.07, 0), 0.02, 12, [1, 0.3, 1], (x, y) => y > -0.001),
      dirt: facet(new THREE.CylinderGeometry(0.3, 0.32, 0.02, 9, 1), 0.02, 13, [1, 0.2, 1]),
      tuft: new THREE.ConeGeometry(0.025, 0.12, 4).translate(0, 0.06, 0),
      flower: new THREE.OctahedronGeometry(0.03, 0),
      seed: new THREE.OctahedronGeometry(0.012, 0),
      body: facet(new THREE.IcosahedronGeometry(1, 1), 0.05, 2),
      unit: new THREE.IcosahedronGeometry(1, 0),
      ball: new THREE.IcosahedronGeometry(1, 1),
      chip: new THREE.OctahedronGeometry(1, 0),
      links: NECK.map((_, i) => facet(new THREE.CylinderGeometry(neckR(i + 1), neckR(i), LINK * 1.15, 7, 1).translate(0, LINK / 2, 0), 0.003, 20 + i)),
      head: facet(new THREE.IcosahedronGeometry(0.06, 1).scale(0.85, 0.9, 1.2), 0.004, 3),
      beak: facet(new THREE.ConeGeometry(0.017, 0.07, 5, 1).rotateX(Math.PI / 2).translate(0, 0, 0.035).scale(1, 0.8, 1), 0.002, 4),
      stalk: new THREE.CylinderGeometry(0.003, 0.004, 0.13, 4, 1).translate(0, 0.065, 0),
      thigh: facet(new THREE.CylinderGeometry(0.065, 0.026, 0.27, 6, 1).translate(0, -0.035, 0), 0.004, 5),
      shank: facet(new THREE.CylinderGeometry(0.017, 0.022, LOWER, 5, 1).translate(0, -LOWER / 2, 0), 0.002, 6),
      toe: facet(new THREE.ConeGeometry(0.016, 0.12, 4, 1).rotateX(Math.PI / 2).translate(0, 0, 0.06).scale(1, 0.6, 1), 0.001, 8),
      vane: vaneGeo(L.vane),
      rect: vaneGeo([L.rect, L.rect, L.rect], 0.1),
      ring: new THREE.CircleGeometry(1, 7),
      spark: new THREE.OctahedronGeometry(1, 0),
      hit: new THREE.CylinderGeometry(0.42, 0.42, 1.5, 8).translate(0, 0.75, 0),
    }),
    [look],
  )

  const blades = useMemo(() => makeBlades(L), [L])

  // scaly chips over the back (and, on the green, the breast and flanks)
  const chips = useMemo(() => {
    const r = rng(5)
    const R = [0.19, 0.2, 0.33]
    const out = []
    for (let i = 0; i < 260 && out.length < (look === 'green' ? 70 : look === 'indian' ? 34 : 0); i++) {
      const z = r() * 2 - 1
      const a = r() * TAU
      const q = Math.sqrt(1 - z * z)
      const d = new THREE.Vector3(q * Math.cos(a), q * Math.sin(a), z)
      const back = d.y > 0.25 && d.z < 0.5
      const front = d.z > 0.2 && d.y > -0.4
      if (!(back || (look === 'green' && (front || d.y > -0.1)))) continue
      const p = new THREE.Vector3(d.x * R[0], d.y * R[1], d.z * R[2])
      const n = new THREE.Vector3(p.x / R[0] ** 2, p.y / R[1] ** 2, p.z / R[2] ** 2).normalize()
      const s = 0.024 + r() * 0.01
      out.push({ pos: p.toArray(), quat: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n), scale: [s, s * 0.3, s * 1.25], c: L.chip[i % L.chip.length] })
    }
    return out
  }, [look, L])

  // the grass: tufts round the patch, a few flowers, seed on bare earth where it pecks
  const decor = useMemo(() => {
    const rr = rng(9)
    const tufts = []
    for (let i = 0; i < 26; i++) {
      const a = rr() * TAU
      const d = 0.5 + rr() * 0.92
      tufts.push([Math.cos(a) * d, Math.sin(a) * d, 0.6 + rr() * 0.6, rr() * 6])
    }
    const flowers = Array.from({ length: 12 }, (_, i) => {
      const a = rr() * TAU
      const d = 0.85 + rr() * 0.55
      return [Math.cos(a) * d, Math.sin(a) * d, MEADOW.flowers[i % MEADOW.flowers.length]]
    })
    const seeds = Array.from({ length: 9 }, () => [(rr() - 0.5) * 0.3, (rr() - 0.5) * 0.26, rr() * 6])
    return { tufts, flowers, seeds }
  }, [])

  // every blade starts with a colour, so the instance colour buffer exists
  useLayoutEffect(() => {
    const c = new THREE.Color()
    blades.eyed.forEach((b, i) => {
      vanes.current.setColorAt(i, c.setScalar(b.tint))
      rings.current.forEach((m) => m && m.setColorAt(i, c.setScalar(1)))
    })
    blades.rect.forEach((b, i) => rects.current.setColorAt(i, c.setScalar(b.tint)))
  }, [blades])

  const tmp = useMemo(() => ({ q: new THREE.Quaternion(), q2: new THREE.Quaternion(), e: new THREE.Euler(), p: new THREE.Vector3(), s: new THREE.Vector3(), one: new THREE.Vector3(1, 1, 1), m: new THREE.Matrix4(), mn: new THREE.Matrix4(), me: new THREE.Matrix4(), c: new THREE.Color() }), [])

  useFrame(({ camera }, dt) => {
    const t = clock.elapsedTime
    const d = Math.min(dt, 0.05)
    const S = st.current
    const s = tap.since(t)
    const busy = s >= 0 && s < SHOW
    // on a new display it turns to face whoever is watching (within reason)
    if (busy && Math.abs(t - s - S.t0) > 1e-3) {
      S.t0 = t - s
      let a = Math.atan2(camera.position.x, camera.position.z) - HOME
      a = Math.atan2(Math.sin(a), Math.cos(a))
      S.face = Math.max(-1.1, Math.min(1.1, a))
    }
    // the display: F is how far the bird is into it, Q the rattle
    const F = busy ? smooth(s / 0.4) * (1 - smooth((s - 3.3) / 0.9)) : 0
    const Q = busy ? smooth((s - 0.5) / 0.2) * smooth((3.3 - s) / 0.2) * (0.45 + 0.55 * Math.max(0, Math.sin((s - 0.5) * 4))) : 0
    // the idle clock stops while it shows off, so it picks up where it left off
    S.it += d * (1 - F)
    const I = idle(S.it + 0.6)
    const n = I.peck * (1 - F)
    const standing = 1 - I.amp

    // walking: two steps forward along its heading, later two back
    walker.current.position.z = START + I.pos
    walker.current.rotation.y = F * (S.face + 0.12 * Math.sin(s * 1.3))
    const legs = walk(I.p, 2)
    const crouch = 0.034 * n
    const bob = I.amp * 0.012 * Math.cos(2 * I.p)
    pelvis.current.position.y = HIP - crouch + bob
    for (let i = 0; i < 2; i++) {
      const sw = legs[i].swing * I.amp
      const lift = legs[i].lift * I.amp
      const hip = -0.38 * sw - 0.32 * lift - 0.4 * n
      const ankle = 0.85 * lift + 0.8 * n
      if (hips.current[i]) hips.current[i].rotation.x = hip
      if (ankles.current[i]) ankles.current[i].rotation.x = ankle
      // the foot stays level with the ground, toes curling a little as it lifts
      if (feet.current[i]) feet.current[i].rotation.x = -(hip + ankle) + 0.5 * lift
    }

    // the body pitches down to peck and puffs its chest out to display
    const pitch = 0.55 * n - 0.08 * F + 0.02 * Math.sin(t * 1.4)
    body.current.rotation.x = pitch
    body.current.rotation.z = I.amp * 0.035 * Math.sin(I.p)
    body.current.scale.setScalar(1 + 0.012 * Math.sin(t * 1.6) + 0.04 * F)
    train.current.rotation.x = -pitch * (1 - F) // the folded train stays trailing on a peck

    // the neck: upright and bobbing, curling down to peck, straight on display
    const nod = standing * (1 - n) * (0.05 * Math.sin(t * 2.3) * Math.max(0, Math.sin(t * 0.6)) + 0.02 * Math.sin(t * 0.9))
    let sum = pitch
    NECK.forEach((b, i) => {
      const m = links.current[i]
      if (!m) return
      const a = b * (1 - 0.5 * F) + PECK[i] * n + swayAngle(t, i, { rate: 0.4, amp: 0.025, lag: 0.5 }) + (i < 3 ? nod : -nod * 1.4)
      m.rotation.x = a
      sum += a
    })
    // the head stays level whatever the neck does, looks about, and jabs on a walk
    const lk = lookAround(t, 1.3)
    headFix.current.rotation.x = -sum + 0.95 * n + lk.pitch * (1 - n) * 0.6 - 0.12 * F
    headPos.current.position.z = 0.02 + I.amp * 0.022 * Math.sin(2 * I.p)
    headYaw.current.rotation.y = lk.yaw * (1 - n) * (1 - 0.6 * F)
    const blink = blinkAt(t, 4.2, 3.2)
    eyes.current.forEach((e) => e && (e.scale.y = 0.011 * blink))
    crest.current.forEach((c, k) => {
      if (!c) return
      c.rotation.x = 0.09 * Math.sin(t * 2.1 + k * 0.8) - 0.12 * n + 0.1 * F * Math.sin(s * 30 + k) * Q
      c.rotation.z = c.userData.a + 0.07 * Math.sin(t * 1.6 + k * 1.1)
    })
    // wings lie along the flanks, lowered and quivering on display
    wings.current.forEach((w, i) => {
      if (!w) return
      const side = i ? -1 : 1
      w.rotation.set(F * 0.32 + F * Q * 0.04 * Math.sin(t * 38 + i), 0, side * (0.05 + F * 0.18))
    })

    // the train, blade by blade
    const { q, q2, e, p, one, m, mn, me, c } = tmp
    const trail = 0.06 * Math.sin(t * 0.9) + 0.035 * I.amp * Math.sin(I.p + 0.6)
    const update = (list, mesh, eyed) => {
      list.forEach((b, i) => {
        const o = busy ? (s - b.dOpen) / 0.34 : 0
        const cl = busy ? (s - 3.3 - b.dClose) / 0.7 : 0
        const u = busy ? easeOut(o) * (1 - smooth(cl)) : 0
        q.slerpQuaternions(b.fold, b.fan, u)
        // a bounce as each blade lands open, a sway and flutter while folded
        const x = s - b.dOpen - 0.34
        const bounce = busy && x > 0 ? 0.14 * Math.exp(-5 * x) * Math.sin(x * 14) * u : 0
        const sw = (1 - u) * (trail * (0.5 + b.len * 0.6) + 0.015 * Math.sin(t * 1.7 + b.rnd * 6))
        q2.setFromEuler(e.set(-bounce, sw, 0))
        q.premultiply(q2)
        const qv = Q * u * 0.045 * Math.sin(t * 46 + b.rnd * 20)
        const flutter = (1 - u) * 0.025 * Math.sin(t * 2.4 + b.rnd * 9)
        q2.setFromEuler(e.set(qv * 0.6 + flutter, 0, qv))
        q.multiply(q2)
        p.set(0, 0, b.dz).applyQuaternion(q)
        const k = b.len / 1.12
        const zs = k * k + (0.3 * k - k * k) * u // one shared curve folded, a light cup fanned
        m.compose(p, q, tmp.s.set(b.w * (1.35 - 0.35 * u), b.len, zs))
        mesh.setMatrixAt(i, m)
        const glint = u * (0.12 + 0.75 * Q * Math.max(0, Math.sin(t * 9 - b.phi * 3 - b.layer * 1.2)) ** 2)
        mesh.setColorAt(i, c.setScalar(b.tint * (1 + glint * 0.35)))
        if (!eyed) return
        mn.compose(p, q, one)
        // the eye rides the curve: lifted onto it and tilted to its slope
        const bz = BEND * b.eyeY ** 2 * zs
        q2.setFromEuler(e.set(Math.atan2(2 * BEND * b.eyeY * zs, b.len), 0, 0))
        rings.current.forEach((r, k) => {
          if (!r) return
          me.compose(p.set(0, b.eyeY * b.len, bz + 0.004 + 0.003 * k), q2, tmp.s.set(EYE[k][0] * b.eyeS, EYE[k][1] * b.eyeS, 1)).premultiply(mn)
          r.setMatrixAt(i, me)
          r.setColorAt(i, c.setScalar(1 + glint * (k === 2 ? 0.9 : 0.6)))
        })
      })
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    }
    update(blades.eyed, vanes.current, true)
    update(blades.rect, rects.current, false)
    rings.current.forEach((r) => {
      if (!r) return
      r.instanceMatrix.needsUpdate = true
      if (r.instanceColor) r.instanceColor.needsUpdate = true
    })
  })

  // taps are ignored mid-display, so the fan never snaps shut
  const onClick = (e) => {
    e.stopPropagation()
    const s = tap.since(clock.elapsedTime)
    if (!(s >= 0 && s < SHOW)) tap.kick(clock.elapsedTime)
  }
  // the sparkle rises off the fan as it opens
  const late = useMemo(() => ({ since: (t) => tap.since(t) - 0.3 }), [tap])
  const crestN = 7

  return (
    <group {...handlers} onClick={onClick}>
      {/* the grass patch */}
      <mesh geometry={geo.ground}>
        <Flat color={MEADOW.ground} />
      </mesh>
      {decor.tufts.map(([x, z, k, ry], i) => (
        <group key={i} position={[x, 0, z]} rotation-y={ry} scale={k}>
          {[-1, 0, 1].map((j) => (
            <mesh key={j} geometry={geo.tuft} position-x={j * 0.025} rotation-z={j * 0.3} scale={[1, 1 - Math.abs(j) * 0.25, 1]}>
              <Flat color={j ? MEADOW.ground2 : MEADOW.tuft} />
            </mesh>
          ))}
        </group>
      ))}
      {decor.flowers.map(([x, z, c], i) => (
        <mesh key={`f${i}`} geometry={geo.flower} position={[x, 0.035, z]} rotation-y={i}>
          <Flat color={c} emissive={c} emissiveIntensity={0.15} />
        </mesh>
      ))}

      <group rotation-y={HOME}>
        {/* bare earth and seed where it pecks */}
        <group position={[0, 0, START + STRIDE + 0.62]}>
          <mesh geometry={geo.dirt} position-y={0.005}>
            <Flat color={MEADOW.dirt} />
          </mesh>
          {decor.seeds.map(([x, z, r], i) => (
            <mesh key={i} geometry={geo.seed} position={[x, 0.022, z]} rotation-y={r} scale={[1, 0.6, 1.4]}>
              <Flat color={MEADOW.seed} />
            </mesh>
          ))}
        </group>

        <group ref={walker}>
          {/* an invisible sleeve round the bird, so a tap on it always lands */}
          <mesh geometry={geo.hit}>
            <meshBasicMaterial visible={false} />
          </mesh>

          <group ref={pelvis} position-y={HIP}>
            {/* legs: a feathered thigh buried in the body, a jointed shank, toes */}
            {[1, -1].map((side, i) => (
              <group key={side} ref={(el) => (hips.current[i] = el)} position-x={side * LEG_X}>
                <mesh geometry={geo.thigh}>
                  <Flat color={L.belly} />
                </mesh>
                <group ref={(el) => (ankles.current[i] = el)} position-y={-UPPER}>
                  <mesh geometry={geo.unit} scale={0.022}>
                    <Flat color={L.leg} />
                  </mesh>
                  <mesh geometry={geo.shank}>
                    <Flat color={L.leg} />
                  </mesh>
                  <group ref={(el) => (feet.current[i] = el)} position-y={-LOWER + 0.012}>
                    {[-0.45, 0, 0.45, Math.PI].map((a) => (
                      <mesh key={a} geometry={geo.toe} rotation-y={a} scale={a === Math.PI ? 0.6 : 1}>
                        <Flat color={L.leg} />
                      </mesh>
                    ))}
                  </group>
                </group>
              </group>
            ))}

            <group ref={body}>
              {/* the body: blue (or green) with a darker belly and a scaly back */}
              <group position={[0, 0.15, -0.02]} rotation-x={-0.14}>
                <mesh geometry={geo.body} scale={[0.19, 0.2, 0.33]}>
                  <Flat color={L.body} />
                </mesh>
                <mesh geometry={geo.ball} position={[0, -0.07, 0.03]} scale={[0.15, 0.12, 0.25]}>
                  <Flat color={L.belly} />
                </mesh>
                <mesh geometry={geo.ball} position={[0, 0.07, -0.12]} scale={[0.16, 0.12, 0.24]}>
                  <Flat color={L.back} />
                </mesh>
                {chips.map((ch, i) => (
                  <mesh key={i} geometry={geo.chip} position={ch.pos} quaternion={ch.quat} scale={ch.scale}>
                    <Flat color={ch.c} roughness={0.55} metalness={0.15} />
                  </mesh>
                ))}
              </group>
              <mesh geometry={geo.ball} position={[0, 0.22, 0.2]} scale={[0.14, 0.16, 0.13]}>
                <Flat color={L.neck} />
              </mesh>
              {/* the rump coverts over the root of the train */}
              <mesh geometry={geo.ball} position={[0, 0.15, -0.3]} rotation-x={-0.5} scale={[0.14, 0.09, 0.2]}>
                <Flat color={L.back} />
              </mesh>

              {/* the wings, folded along the flanks */}
              {[1, -1].map((side, i) => (
                <group key={side} ref={(el) => (wings.current[i] = el)} position={[side * 0.15, 0.22, 0.1]}>
                  <mesh geometry={geo.ball} position={[side * 0.02, -0.06, -0.12]} rotation-x={0.12} scale={[0.045, 0.09, 0.18]}>
                    <Flat color={L.wing} />
                  </mesh>
                  {[0, 1, 2].map((k) => (
                    <mesh key={k} geometry={geo.unit} position={[side * 0.062, -0.035 - k * 0.032, -0.08 - k * 0.035]} rotation-x={0.4} scale={[0.008, 0.01, 0.09 - k * 0.015]}>
                      <Flat color={L.bar} />
                    </mesh>
                  ))}
                  <mesh geometry={geo.ball} position={[side * 0.02, -0.12, -0.3]} rotation-x={0.3} scale={[0.04, 0.06, 0.15]}>
                    <Flat color={L.primary} />
                  </mesh>
                </group>
              ))}

              {/* the train: blades on their own pivots at the rump */}
              <group ref={train} position={PIVOT}>
                <instancedMesh ref={vanes} args={[geo.vane, undefined, blades.eyed.length]} frustumCulled={false} raycast={() => null}>
                  <meshStandardMaterial vertexColors flatShading roughness={0.62} metalness={0.1} side={THREE.DoubleSide} />
                </instancedMesh>
                <instancedMesh ref={rects} args={[geo.rect, undefined, blades.rect.length]} frustumCulled={false} raycast={() => null}>
                  <meshStandardMaterial vertexColors flatShading roughness={0.8} side={THREE.DoubleSide} />
                </instancedMesh>
                {L.rings.map((col, k) => (
                  <instancedMesh key={k} ref={(el) => (rings.current[k] = el)} args={[geo.ring, undefined, blades.eyed.length]} frustumCulled={false} raycast={() => null}>
                    <meshStandardMaterial color={col} emissive={col} emissiveIntensity={k === 2 ? 0.25 : 0.12} flatShading roughness={0.45} metalness={0.15} />
                  </instancedMesh>
                ))}
              </group>

              {/* the neck: a chain of links rising from the chest */}
              <group position={[0, 0.25, 0.22]}>
                {(function chain(i) {
                  if (i === NECK.length)
                    return (
                      <group ref={headFix}>
                        <group ref={headPos} position={[0, 0.03, 0.02]}>
                          <group ref={headYaw}>
                            <mesh geometry={geo.head}>
                              <Flat color={L.neck} />
                            </mesh>
                            <mesh geometry={geo.beak} position={[0, -0.008, 0.06]}>
                              <Flat color={L.beak} />
                            </mesh>
                            {/* face stripes (or the green's yellow and blue cheeks) and eyes */}
                            {[1, -1].map((x, k) => (
                              <group key={x} position={[x * 0.046, 0.004, 0.016]} rotation-y={x * 0.25}>
                                <mesh geometry={geo.unit} position={[0, 0.02, -0.006]} scale={[0.006, 0.009, 0.036]}>
                                  <Flat color={L.face[0]} />
                                </mesh>
                                <mesh geometry={geo.unit} position={[0, -0.018, -0.004]} scale={[0.006, 0.011, 0.03]}>
                                  <Flat color={L.face[1]} />
                                </mesh>
                                <mesh ref={(el) => (eyes.current[k] = el)} geometry={geo.ball} position={[x * 0.004, 0, 0.012]} scale={0.011}>
                                  <Flat color={L.eye} roughness={0.3} />
                                </mesh>
                              </group>
                            ))}
                            {/* the crest: wiry stalks with tufted tips */}
                            <group position={[0, 0.045, -0.01]} rotation-x={-0.22}>
                              {Array.from({ length: crestN }, (_, k) => {
                                const a = (k / (crestN - 1) - 0.5) * 2 * L.crestSpread
                                const h = L.crestLen * (1 - Math.abs(a) * 0.25)
                                return (
                                  <group key={k} ref={(el) => (crest.current[k] = el ? Object.assign(el, { userData: { a } }) : el)} position-z={(k % 2) * 0.006}>
                                    <mesh geometry={geo.stalk} scale={[1, h, 1]}>
                                      <Flat color={L.crest} />
                                    </mesh>
                                    <mesh geometry={geo.unit} position-y={0.13 * h} scale={look === 'green' ? [0.011, 0.04, 0.008] : [0.02, 0.026, 0.007]}>
                                      <Flat color={L.tuft} roughness={0.5} metalness={0.15} />
                                    </mesh>
                                  </group>
                                )
                              })}
                            </group>
                          </group>
                        </group>
                      </group>
                    )
                  return (
                    <group ref={(el) => (links.current[i] = el)} position-y={i === 0 ? 0 : LINK}>
                      <mesh geometry={geo.links[i]}>
                        <Flat color={L.neck} />
                      </mesh>
                      <mesh geometry={geo.ball} scale={neckR(i + 1)} position-y={LINK}>
                        <Flat color={L.neck} />
                      </mesh>
                      {L.neckChip &&
                        [-1.3, -0.65, 0, 0.65, 1.3].map((a, k) => {
                          const rr = neckR(i) * 0.98
                          const aa = a + (i % 2) * 0.32
                          return (
                            <mesh key={k} geometry={geo.chip} position={[Math.sin(aa) * rr, LINK * 0.5, Math.cos(aa) * rr]} rotation={[Math.PI / 2, 0, -aa]} rotation-order="YXZ" scale={[0.016, 0.005, 0.02]}>
                              <Flat color={L.neckChip[(i + k) % L.neckChip.length]} roughness={0.55} metalness={0.15} />
                            </mesh>
                          )
                        })}
                      {chain(i + 1)}
                    </group>
                  )
                })(0)}
              </group>
            </group>
          </group>
          <Burst tap={late} geometry={geo.spark} count={14} colors={[L.rings[0], L.rings[1], '#ffffff']} speed={1.1} gravity={0.5} size={0.028} life={1.5} origin={[0, 1.25, -0.2]} spread={1.2} up={0.8} />
        </group>
      </group>
    </group>
  )
}

export default function PeacockScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[3.0, 2.3, 4.0]} target={[0, 0.8, 0]} hint="It walks a step or two, pecks at seed, bobs and turns its head, its crest swaying and its long folded train trailing behind · tap it and the train lifts and fans out into a full semicircle, blade by blade, rattles so the eye spots shimmer, holds and folds back down · Look swaps Indian blue, green and white · drag to orbit">
      <Peacock {...props} />
    </Stage>
  )
}
