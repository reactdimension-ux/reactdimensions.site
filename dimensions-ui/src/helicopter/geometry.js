import * as THREE from 'three'
import { chordPair, grid, join, ladder, loft, profile, rib, smooth } from '../airliner/geometry.js'

// Every surface of the helicopter, built from its dimensions: a twin-engine
// light utility type with a four-blade rotor, skids and a shrouded tail fan.
// The mesh helpers and the aerofoil ribs are the airliner's. Units are metres.
// As there, x (the station s) runs aft from the tip of the nose, y is up from
// the ground and +z is the port side; the starboard half of everything paired
// is the port half drawn through a mirror.

export const LENGTH = 11.45 // nose to the trailing edge of the fin
export const BODY_END = 9.45 // where the tail boom runs into the fan shroud
export const MAST = { s: 3.3, y: 3.28 } // the centre of the rotor head
export const ROTOR_R = 5.5
export const BLADE_ROOT = 0.62
export const FAN = { s: 10.3, y: 2.2, r: 0.49 }
export const SKID_Z = 1.2

const rad = THREE.MathUtils.degToRad
const lerp = (a, b, t) => a + (b - a) * t
const clamp = (x, a, b) => Math.min(b, Math.max(a, x))
const spow = (c, p) => Math.sign(c) * Math.abs(c) ** p

// ---------------------------------------------------------------- hulls
// A hull is a skin lofted through superelliptic sections: along its length
// run the crown line, the keel line, the height of its widest point, its half
// width, and how square the section is (2 is an ellipse, 4 nearly a box).
function hull({ top, bot, waist, beam, sq, s0 = 0 }) {
  const section = (s) => {
    const x = s - s0
    const t = top(x)
    const b = bot(x)
    const cy = clamp(waist(x), b + 1e-4, t - 1e-4)
    return { cy, up: Math.max(1e-4, t - cy), dn: Math.max(1e-4, cy - b), w: Math.max(1e-4, beam(x)), n: sq(x) }
  }
  const bare = (s, th, out) => {
    const k = section(s)
    const cs = Math.cos(th)
    const p = 2 / k.n
    return out.set(s, k.cy - (cs > 0 ? k.dn : k.up) * spow(cs, p), k.w * spow(Math.sin(th), p))
  }
  const A = new THREE.Vector3()
  const B = new THREE.Vector3()
  const C = new THREE.Vector3()
  // A point on the skin at station s and angle th round the section, measured
  // from the keel up the port side (crown at pi), lifted `lift` off the surface.
  const point = (s, th, lift = 0, out = new THREE.Vector3()) => {
    bare(s, th, out)
    if (lift) {
      bare(s + 2e-3, th, A).sub(bare(s - 2e-3, th, C))
      bare(s, th + 2e-3, B).sub(bare(s, th - 2e-3, C))
      A.cross(B).normalize()
      C.set(-0.02, out.y - section(s).cy, out.z)
      out.addScaledVector(A, A.dot(C) < 0 ? -lift : lift)
    }
    return out
  }
  // the angle on the port side at which the skin reaches height y
  const thetaAt = (s, y) => {
    const k = section(s)
    const d = y - k.cy
    return Math.acos(-spow(clamp(d / (d > 0 ? k.up : k.dn), -1, 1), k.n / 2))
  }
  // Seen from dead ahead: the station and angle of the skin at height y and
  // offset z, for anything laid out in the front view (the windscreen).
  const ahead = (y, z, sMax) => {
    const g = (s) => {
      const k = section(s)
      const d = y - k.cy
      return Math.abs(d / (d > 0 ? k.up : k.dn)) ** k.n + Math.abs(z / k.w) ** k.n
    }
    let a = s0
    let b = sMax
    if (g(b) <= 1)
      for (let i = 0; i < 40; i++) {
        const m = (a + b) / 2
        if (g(m) > 1) a = m
        else b = m
      }
    const k = section(b)
    const d = y - k.cy
    const sc = g(b) ** (-1 / k.n)
    return [b, Math.atan2(spow((z / k.w) * sc, k.n / 2), -spow((d / (d > 0 ? k.up : k.dn)) * sc, k.n / 2))]
  }
  // where a point of a drawing lands on the skin, as [s, th]: drawn in the side view (s, y) or the front view (z, y)
  const side = (s, y) => [s, thetaAt(s, y)]
  const front = (sMax) => (z, y) => ahead(y, z, sMax)
  return { section, point, thetaAt, side, front }
}

// The fuselage: a glazed nose, a boxy cabin, a rear that tucks up under the
// engines, and the tail boom, in one skin.
export const body = hull({
  top: profile([[0, 1.0], [0.08, 1.2], [0.3, 1.44], [0.7, 1.72], [1.2, 1.95], [1.7, 2.08], [2.2, 2.12], [5.0, 2.12], [5.6, 2.2], [6.2, 2.33], [7, 2.36], [BODY_END, 2.4]]),
  bot: profile([[0, 1.0], [0.08, 0.84], [0.3, 0.72], [0.7, 0.64], [1.2, 0.6], [4.3, 0.6], [4.7, 0.68], [5.1, 0.9], [5.5, 1.25], [5.9, 1.6], [6.3, 1.82], [6.8, 1.9], [BODY_END, 2.06]]),
  waist: profile([[0, 1.0], [0.3, 1.02], [0.7, 1.08], [1.2, 1.15], [2.0, 1.2], [4.4, 1.2], [5.0, 1.42], [5.5, 1.72], [5.9, 1.96], [6.3, 2.08], [7, 2.13], [BODY_END, 2.23]]),
  beam: profile([[0, 0], [0.08, 0.3], [0.3, 0.52], [0.7, 0.7], [1.2, 0.8], [1.8, 0.86], [4.2, 0.86], [4.7, 0.8], [5.2, 0.62], [5.6, 0.44], [6.0, 0.33], [6.5, 0.27], [BODY_END, 0.17]]),
  sq: profile([[0, 2.2], [0.5, 2.5], [1.4, 3.2], [2.0, 3.6], [4.2, 3.6], [5.2, 3.0], [6.0, 2.4], [6.6, 2.1], [BODY_END, 2.0]]),
})

// The cowling over the gearbox and the two engines, sitting on the cabin roof
// and fairing down onto the boom. Its profiles run from its own nose.
export const COWL = { s0: 1.35, s1: 6.95 }
export const cowl = hull({
  s0: COWL.s0,
  top: profile([[0, 1.93], [0.12, 2.2], [0.45, 2.42], [0.95, 2.6], [1.6, 2.72], [2.4, 2.76], [3.3, 2.72], [4.1, 2.63], [4.9, 2.52], [5.6, 2.41]]),
  bot: profile([[0, 1.93], [0.12, 1.89], [3.3, 1.88], [3.65, 1.84], [4.1, 1.74], [4.5, 1.8], [4.9, 2.02], [5.6, 2.33]]),
  waist: profile([[0, 1.93], [3.3, 1.93], [3.65, 1.96], [4.1, 2.04], [4.9, 2.24], [5.6, 2.37]]),
  beam: profile([[0, 0], [0.12, 0.28], [0.45, 0.5], [0.95, 0.64], [1.6, 0.7], [2.4, 0.72], [3.3, 0.7], [4.1, 0.6], [4.9, 0.4], [5.6, 0.03]]),
  sq: profile([[0, 2.3], [1, 2.9], [3.4, 2.9], [5.6, 2.2]]),
})

function hullGeometry(h, stations, len, NV = 96) {
  return grid(
    stations.length,
    NV + 1,
    (i, j, P, U) => {
      h.point(stations[i], (j / NV) * Math.PI * 2, 0, P)
      U.set(stations[i] / len, j / NV)
    },
    { wrap: true },
  )
}

export function bodyGeometry() {
  const st = []
  for (let k = 0; k <= 44; k++) st.push(2 * (k / 44) ** 2)
  for (let k = 1; k <= 8; k++) st.push(2 + (2.2 * k) / 8)
  for (let k = 1; k <= 32; k++) st.push(4.2 + (2.8 * k) / 32)
  for (let k = 1; k <= 8; k++) st.push(7 + ((BODY_END - 7) * k) / 8)
  return hullGeometry(body, st, BODY_END)
}

export function cowlGeometry() {
  const st = []
  const L = COWL.s1 - COWL.s0
  for (let k = 0; k <= 26; k++) st.push(COWL.s0 + 1.6 * (k / 26) ** 2)
  for (let k = 1; k <= 30; k++) st.push(COWL.s0 + 1.6 + ((L - 1.6) * k) / 30)
  return hullGeometry(cowl, st, COWL.s1, 72)
}

// The paint: two stripes that start as points on the nose, swell along the
// cabin under the windows, sweep up the rear fuselage onto the boom and run
// up the fin. Heights above the ground at station s, shared by the fuselage
// and tail textures so the sweep runs straight across the join.
export function livery(s) {
  const boom = 2.0 + 0.047 * (s - 6.5)
  const mid = lerp(0.98, boom, smooth((s - 3.6) / 2.9)) + 0.78 * smooth((s - 9.15) / 0.9) + 0.55 * clamp((s - 9.9) / 1.5, 0, 1)
  const swell = Math.sin(Math.PI * clamp((s - 0.7) / 5.8, 0, 1)) ** 1.2
  const w = 0.22 * swell + 0.055 * smooth((s - 4.5) / 1.5) + 0.25 * smooth((s - 9.6) / 1.6)
  const gap = 0.035 + 0.06 * swell
  return { a0: mid - w / 2, a1: mid + w / 2, b0: mid - w / 2 - gap - 0.36 * w, b1: mid - w / 2 - gap }
}

// ---------------------------------------------------------------- panels on a skin
// A rounded four-sided panel lying on a hull. `map(p, q)` says where a point
// of the panel's own drawing (side view, front view) lands on the skin; `c`
// are its corners in order round the outline. k0..k1 is how much of it to
// fill, from the centre out: 0..1 is the whole panel, 1..1.06 a frame round it.
const squircle = (f, round) => [spow(Math.cos(f), 2 / round), spow(Math.sin(f), 2 / round)]
const corner = (c, x, y) => {
  const u = 0.5 + 0.5 * x
  const v = 0.5 + 0.5 * y
  return [lerp(lerp(c[0][0], c[1][0], u), lerp(c[3][0], c[2][0], u), v), lerp(lerp(c[0][1], c[1][1], u), lerp(c[3][1], c[2][1], u), v)]
}
function panel(h, map, c, { round = 5, k0 = 0, k1 = 1, lift = 0.006, rings = 6, seg = 64 } = {}) {
  const shape = (f) => squircle(f, round)
  // step round the outline in equal lengths, so no edge is long enough to cut under the curve of the skin
  const W = Math.hypot(c[1][0] - c[0][0], c[1][1] - c[0][1])
  const H = Math.hypot(c[3][0] - c[0][0], c[3][1] - c[0][1])
  const FINE = 1440
  const run = [0]
  let last = shape(0)
  for (let k = 1; k <= FINE; k++) {
    const q = shape((k / FINE) * Math.PI * 2)
    run.push(run[k - 1] + Math.hypot((q[0] - last[0]) * W, (q[1] - last[1]) * H))
    last = q
  }
  const turn = []
  for (let j = 0, k = 0; j <= seg; j++) {
    const want = (j / seg) * run[FINE]
    while (k < FINE - 1 && run[k + 1] < want) k++
    turn.push(shape(((k + (want - run[k]) / (run[k + 1] - run[k] || 1)) / FINE) * Math.PI * 2))
  }
  turn[seg] = turn[0]
  const at = (x, y, l, P) => {
    const [s, th] = map(...corner(c, x, y))
    return h.point(s, th, l, P)
  }
  const build = (flip) =>
    grid(
      rings + 1,
      seg + 1,
      (i, j, P) => {
        const k = lerp(k0, k1, i / rings)
        at(k * turn[j][0], k * turn[j][1], lift, P)
      },
      { flip, wrap: true },
    )
  // face it outward whichever way its corners run
  let g = build(false)
  const out = at(0, 0, 1, new THREE.Vector3()).sub(at(0, 0, 0, new THREE.Vector3()))
  const n = new THREE.Vector3().fromBufferAttribute(g.attributes.normal, rings * (seg + 1) + 3)
  if (n.dot(out) < 0) {
    g.dispose()
    g = build(true)
  }
  return g
}

// The glazing of the port side. The windscreen and the chin window below it
// are drawn in the front view as [z, y]; the door windows and the rear quarter
// light in the side view as [s, y].
const NOSE = body.front(1.9)
const PANES = [
  { map: NOSE, c: [[0.035, 1.5], [0.76, 1.3], [0.69, 1.9], [0.035, 2.035]], round: 4, rings: 16, seg: 112, frame: 0.024 },
  { map: NOSE, c: [[0.2, 0.86], [0.56, 0.79], [0.67, 1.07], [0.24, 1.26]], round: 3.4, rings: 10, seg: 80, frame: 0.02 },
  { map: body.side, c: [[1.2, 1.22], [2.6, 1.22], [2.6, 1.95], [1.78, 1.95]], round: 5, rings: 10, seg: 96, frame: 0.024 },
  { map: body.side, c: [[2.76, 1.22], [3.92, 1.22], [3.92, 1.95], [2.76, 1.95]], round: 6, rings: 8, seg: 96, frame: 0.024 },
  { map: body.side, c: [[4.1, 1.32], [4.6, 1.42], [4.5, 1.9], [4.1, 1.95]], round: 4, rings: 8, seg: 80, frame: 0.02 },
]
// the outline of each pane round the skin, as [s, v] with v the fraction of the way round from the keel: what the paint is cut to
export function paneOutlines(k = 0.99, n = 240) {
  return PANES.map((p) =>
    Array.from({ length: n }, (_, j) => {
      const q = squircle((j / n) * Math.PI * 2, p.round)
      const [s, th] = p.map(...corner(p.c, k * q[0], k * q[1]))
      return [s, th / (Math.PI * 2)]
    }),
  )
}

// every pane with its seal, and the fittings on the skin
export function decalGeometry() {
  const glass = []
  const seals = []
  const lines = []
  const grille = []
  for (const { map, c, frame, ...o } of PANES) {
    const half = Math.min(Math.hypot(c[1][0] - c[0][0], c[1][1] - c[0][1]), Math.hypot(c[3][0] - c[0][0], c[3][1] - c[0][1])) / 2
    glass.push(panel(body, map, c, { ...o, lift: 0.003 }))
    seals.push(panel(body, map, c, { ...o, lift: 0.006, k0: 0.985, k1: 1 + frame / half, rings: 2 }))
  }
  // door handles
  for (const s of [2.5, 2.87]) lines.push(panel(body, body.side, [[s - 0.08, 1.06], [s + 0.08, 1.06], [s + 0.08, 1.11], [s - 0.08, 1.11]], { round: 4, lift: 0.012, rings: 1, seg: 24 }))
  // the engine air intakes on the shoulders of the cowling, and the cooling grilles aft
  const intake = [[2.05, 2.26], [2.8, 2.3], [2.74, 2.56], [2.16, 2.47]]
  grille.push(panel(cowl, cowl.side, intake, { round: 4, lift: 0.008, rings: 4 }))
  seals.push(panel(cowl, cowl.side, intake, { round: 4, lift: 0.007, k0: 0.98, k1: 1.14, rings: 1 }))
  grille.push(panel(cowl, cowl.side, [[4.25, 2.3], [5.0, 2.33], [4.95, 2.48], [4.25, 2.5]], { round: 5, lift: 0.008, rings: 3 }))
  return { glass: join(glass), seals: join(seals), lines: join(lines), grille: join(grille) }
}

// A wall across the cabin at station s: the section of the fuselage there,
// drawn a little inside the skin.
export function bulkheadGeometry(s, k = 0.985) {
  const sec = body.section(s)
  const P = new THREE.Vector3()
  const pts = Array.from({ length: 72 }, (_, j) => {
    body.point(s, (j / 72) * Math.PI * 2, 0, P)
    return new THREE.Vector2(P.z * k, sec.cy + (P.y - sec.cy) * k)
  })
  return new THREE.ShapeGeometry(new THREE.Shape(pts)).rotateY(-Math.PI / 2).translate(s, 0, 0)
}

// ---------------------------------------------------------------- rotor
// One main rotor blade along +z from the hub, its leading edge towards -x:
// a root cuff that fairs into the aerofoil, washout along the span, and a
// swept, tapered tip.
export function bladeGeometry() {
  const st = [0.62, 0.68, 0.76, 0.86, 0.98, 1.1, 1.25]
  for (let k = 1; k <= 22; k++) st.push(1.25 + (3.65 * k) / 22)
  st.push(5.0, 5.1, 5.2, 5.29, 5.37, 5.43, 5.47, ROTOR_R)
  const frames = st.map((r) => {
    const root = smooth((r - BLADE_ROOT) / 0.55)
    const tip = smooth((r - 4.95) / 0.55)
    const c = lerp(0.17, 0.325, root) * (1 - 0.6 * tip * tip)
    const t = (r - BLADE_ROOT) / (ROTOR_R - BLADE_ROOT)
    return { O: new THREE.Vector3(-0.27 * c + 0.2 * tip * tip, 0, r), n: new THREE.Vector3(0, 1, 0), c, tc: lerp(0.3, 0.12, root) - 0.03 * tip, m: 0.02 * root, tw: rad(lerp(9, -3, t)), q: t }
  })
  const rows = frames.map((f) => rib(f, 1, 16, f.q))
  return join([loft(rows, { flip: true }), ...ladder(...chordPair(frames[0], 0, 1, 10)), ...ladder(...chordPair(frames[frames.length - 1], 0, 1, 10))])
}

// the ten blades of the tail fan about the z axis, unevenly spaced as they are to spread the noise
export function fanGeometry() {
  const blades = []
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2
    blades.push(
      new THREE.BoxGeometry(0.34, 0.012, 0.1)
        .rotateX(rad(34))
        .translate(0.3, 0, 0)
        .rotateZ(a + 0.11 * Math.sin(2 * a)),
    )
  }
  return join(blades)
}

// ---------------------------------------------------------------- tail
// The fan shroud: the side profile of the tail with the duct cut through it,
// given thickness and rounded lips. Its texture is laid on it from the side.
export const TAIL_UV = { s0: 8.9, s1: 11.9, y0: 1.1, y1: 3.9 }
const tailUV = (x, y) => new THREE.Vector2((x - TAIL_UV.s0) / (TAIL_UV.s1 - TAIL_UV.s0), (y - TAIL_UV.y0) / (TAIL_UV.y1 - TAIL_UV.y0))
const fromSide = {
  generateTopUV: (g, v, a, b, c) => [a, b, c].map((i) => tailUV(v[i * 3], v[i * 3 + 1])),
  generateSideWallUV: (g, v, a, b, c, d) => [a, b, c, d].map((i) => tailUV(v[i * 3], v[i * 3 + 1])),
}
export function shroudGeometry() {
  const outline = [[9.4, 2.5], [9.75, 2.72], [10.05, 2.93], [10.5, 3.0], [10.95, 2.95], [11.12, 2.7], [11.15, 2.3], [11.08, 1.95], [10.9, 1.62], [10.62, 1.4], [10.3, 1.33], [9.95, 1.45], [9.6, 1.72], [9.3, 1.93], [9.05, 2.02]]
  const shape = new THREE.Shape()
  shape.moveTo(9.05, 2.02)
  shape.lineTo(9.05, 2.42)
  shape.splineThru(outline.map((p) => new THREE.Vector2(p[0], p[1])))
  const duct = new THREE.Path()
  duct.absarc(FAN.s, FAN.y, FAN.r + 0.07, 0, Math.PI * 2, true)
  shape.holes.push(duct)
  const depth = 0.2
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: 0.07, bevelThickness: 0.09, bevelSegments: 7, curveSegments: 56, UVGenerator: fromSide })
  g.translate(0, 0, -depth / 2)
  return g
}

// the fin that stands on the shroud, swept back, with a rounded tip
export function finGeometry() {
  const frames = []
  const Y0 = 2.8
  const Y1 = 3.62
  for (let k = 0; k <= 18; k++) {
    const t = k / 18
    const y = lerp(Y0, Y1, 1 - (1 - t) ** 1.3)
    const round = 1 - smooth((Y1 - y) / 0.22)
    const le = 9.9 + 0.95 * (y - Y0) + 0.2 * round ** 2
    const te = 11.0 + 0.5 * (y - Y0) - 0.06 * round ** 2
    frames.push({ O: new THREE.Vector3(le, y, 0), n: new THREE.Vector3(0, 0, 1), c: te - le, tc: lerp(0.15, 0.11, t), m: 0, tw: 0 })
  }
  const uv = (q) => {
    const t = tailUV(q.p.x, q.p.y)
    q.u = t.x
    q.v = t.y
    return q
  }
  const rows = frames.map((f) => rib(f, 1, 18).map(uv))
  const tip = chordPair(frames[frames.length - 1], 0, 1, 14).map((r) => r.map(uv))
  return join([loft(rows), ...ladder(...tip)])
}
export const finPoint = (y, x) => {
  const le = 9.9 + 0.95 * (y - 2.8)
  const te = 11.0 + 0.5 * (y - 2.8)
  return new THREE.Vector3(lerp(le, te, x), y, 0)
}

// The port half of the tailplane on the boom, and the end plate it carries.
export const STAB = { s: 8.2, y: 2.19, span: 1.3 }
export function stabGeometry() {
  const frames = []
  for (let k = 0; k <= 10; k++) {
    const z = (STAB.span * k) / 10
    frames.push({ O: new THREE.Vector3(STAB.s + 0.1 * z, STAB.y, z), n: new THREE.Vector3(0, 1, 0), c: lerp(0.62, 0.5, k / 10), tc: 0.12, m: -0.025, tw: rad(-2), q: 0 })
  }
  const plate = []
  const Y0 = STAB.y - 0.3
  const Y1 = STAB.y + 0.52
  for (let k = 0; k <= 14; k++) {
    const t = k / 14
    const y = lerp(Y0, Y1, t)
    const round = Math.max(1 - smooth((Y1 - y) / 0.14), 1 - smooth((y - Y0) / 0.14))
    const le = STAB.s + 0.02 + 0.42 * (y - Y0) + 0.1 * round ** 2
    const te = STAB.s + 0.6 + 0.2 * (y - Y0) - 0.05 * round ** 2
    plate.push({ O: new THREE.Vector3(le, y, STAB.span), n: new THREE.Vector3(0, 0, 1), c: te - le, tc: 0.1, m: 0, tw: 0 })
  }
  return join([
    loft(frames.map((f) => rib(f, 1, 14)), { flip: true }),
    loft(plate.map((f) => rib(f, 1, 14))),
    ...ladder(...chordPair(plate[0], 0, 1, 10)),
    ...ladder(...chordPair(plate[plate.length - 1], 0, 1, 10)),
  ])
}

// ---------------------------------------------------------------- skids
// The port skid with its upturned toe, the port halves of the two cross tubes
// that carry it, and the boarding step.
export const CROSS = [1.5, 3.9]
export function skidGeometry() {
  const tube = (pts, r, seg = 64) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), false, 'centripetal'), seg, r, 16, false)
  const z = SKID_Z
  return {
    skid: tube([[0.42, 0.4, z], [0.56, 0.24, z], [0.78, 0.1, z], [1.1, 0.048, z], [1.6, 0.045, z], [4.2, 0.045, z], [4.72, 0.045, z]], 0.045, 96),
    cross: join(CROSS.map((s) => tube([[s, 0.66, -0.02], [s, 0.655, 0.42], [s, 0.6, 0.7], [s, 0.42, 0.95], [s, 0.2, 1.12], [s, 0.06, z]], 0.04, 48))),
    step: tube([[1.5, 0.24, 1.09], [1.62, 0.34, 1.2], [1.86, 0.39, 1.24], [3.54, 0.39, 1.24], [3.78, 0.34, 1.2], [3.9, 0.24, 1.09]], 0.024, 64),
  }
}
