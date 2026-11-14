import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

// Every surface of the airliner, built from its real dimensions (a 37.6 m
// single-aisle twin-jet). Units are metres. In the aircraft's own frame x runs
// aft from the tip of the nose, y is up from the ground and +z is the port
// (left) side; the starboard half of everything paired is the port half drawn
// through a mirror.

export const LENGTH = 37.57
export const CY = 3.8 // height of the fuselage centreline with the gear down
const RW = 1.975 // half width of the cabin section
const RH = 2.07 // half height of the cabin section

const rad = THREE.MathUtils.degToRad
const lerp = (a, b, t) => a + (b - a) * t
export const smooth = (t) => {
  const k = Math.min(1, Math.max(0, t))
  return k * k * (3 - 2 * k)
}

// A monotone cubic through [x, y] points, so a profile never overshoots.
// Interpolating against the square root of x gives a round nose at x = 0.
function profile(pts) {
  const xs = pts.map((p) => Math.sqrt(p[0]))
  const ys = pts.map((p) => p[1])
  const n = pts.length
  const d = []
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]))
  const m = [d[0]]
  for (let i = 1; i < n - 1; i++) m.push(d[i - 1] * d[i] <= 0 ? 0 : (2 * d[i - 1] * d[i]) / (d[i - 1] + d[i]))
  m.push(d[n - 2])
  return (x) => {
    const q = Math.sqrt(Math.max(0, x))
    if (q <= xs[0]) return ys[0]
    if (q >= xs[n - 1]) return ys[n - 1]
    let i = 0
    while (q > xs[i + 1]) i++
    const h = xs[i + 1] - xs[i]
    const t = (q - xs[i]) / h
    const t2 = t * t
    const t3 = t2 * t
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1]
  }
}

// ---------------------------------------------------------------- fuselage
// The crown line, the keel line and the half width along the length, relative
// to the centreline: a drooped nose, a long constant cabin and a tail cone
// whose keel sweeps up to the exhaust of the auxiliary power unit.
const crown = profile([[0, -0.45], [0.12, -0.17], [0.45, 0.07], [1.0, 0.29], [1.75, 0.57], [2.75, 1.33], [3.6, 1.76], [4.5, 1.99], [5.4, RH], [24.5, RH], [29, 2.02], [32, 1.8], [35, 1.48], [37, 1.28], [LENGTH, 1.22]])
const keel = profile([[0, -0.45], [0.12, -0.76], [0.45, -1.07], [1.0, -1.36], [2.0, -1.74], [3.0, -1.95], [4.2, -2.06], [5.0, -RH], [24.5, -RH], [26.5, -1.97], [28.5, -1.55], [31, -0.78], [34, 0.12], [36.5, 0.72], [LENGTH, 0.88]])
const beam = profile([[0, 0], [0.12, 0.36], [0.45, 0.72], [1.0, 1.07], [2.0, 1.53], [3.0, 1.81], [4.0, 1.94], [5.0, RW], [24.5, RW], [27, 1.93], [30, 1.62], [33, 1.12], [35.5, 0.62], [37, 0.28], [LENGTH, 0.17]])

// the elliptical cross-section at station s: centre height and semi-axes
export function section(s) {
  const t = crown(s)
  const b = keel(s)
  return { cy: CY + (t + b) / 2, h: Math.max(1e-4, (t - b) / 2), w: Math.max(1e-4, beam(s)) }
}

// A point on the skin at station s and angle th round the section, measured
// from the keel up the port side (crown at pi), lifted `lift` off the surface.
export function fusePoint(s, th, lift = 0, out = new THREE.Vector3()) {
  const { cy, h, w } = section(s)
  const sn = Math.sin(th)
  const cs = Math.cos(th)
  let ny = -cs / h
  let nz = sn / w
  const k = lift / Math.hypot(ny, nz)
  ny *= k
  nz *= k
  return out.set(s, cy - h * cs + ny, w * sn + nz)
}

// the angle on the port side at which the skin reaches height y
export function thetaAt(s, y) {
  const { cy, h } = section(s)
  return Math.acos(Math.min(1, Math.max(-1, (cy - y) / h)))
}
// metres of skin per radian round the section
const arcRate = (s, th) => {
  const { h, w } = section(s)
  return Math.hypot(w * Math.cos(th), h * Math.sin(th))
}

// The paint: the accent colour fills the belly aft of the wing and sweeps up
// through the tail in one curve; a pinstripe of body colour and a band of the
// stripe colour ride above it. Heights above the ground at station s, shared
// by the fuselage and fin textures so the sweep runs straight across the join.
export function livery(s) {
  const y0 = 1.7 + 0.833 * (Math.exp(0.105 * (s - 12)) - 1)
  const k = smooth((s - 13) / 18)
  const pin = 0.04 + 0.1 * k
  return { y0, y1: y0 + pin, y2: y0 + pin + 0.05 + 1.0 * k }
}

// ---------------------------------------------------------------- mesh helpers
// A grid of nu x nv vertices from fn(i, j, position, uv). `flip` turns the
// faces round; `wrap` joins the normals where the last column meets the first.
function grid(nu, nv, fn, { flip = false, wrap = false } = {}) {
  const pos = new Float32Array(nu * nv * 3)
  const uv = new Float32Array(nu * nv * 2)
  const P = new THREE.Vector3()
  const U = new THREE.Vector2()
  for (let i = 0; i < nu; i++)
    for (let j = 0; j < nv; j++) {
      U.set(0, 0)
      fn(i, j, P, U)
      const k = i * nv + j
      pos.set([P.x, P.y, P.z], k * 3)
      uv.set([U.x, U.y], k * 2)
    }
  const idx = []
  for (let i = 0; i < nu - 1; i++)
    for (let j = 0; j < nv - 1; j++) {
      const a = i * nv + j
      const b = a + nv
      const c = a + 1
      const d = b + 1
      if (flip) idx.push(a, c, b, b, c, d)
      else idx.push(a, b, c, b, d, c)
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  if (wrap) {
    const n = g.attributes.normal
    const A = new THREE.Vector3()
    const B = new THREE.Vector3()
    for (let i = 0; i < nu; i++) {
      const a = i * nv
      const b = a + nv - 1
      A.fromBufferAttribute(n, a)
      B.fromBufferAttribute(n, b)
      A.add(B).normalize()
      n.setXYZ(a, A.x, A.y, A.z)
      n.setXYZ(b, A.x, A.y, A.z)
    }
  }
  return g
}

// rows of { p, u, v } points, lofted into a skin
const loft = (rows, opts) =>
  grid(
    rows.length,
    rows[0].length,
    (i, j, P, U) => {
      const q = rows[i][j]
      P.copy(q.p)
      U.set(q.u || 0, q.v || 0)
    },
    opts,
  )
// a flat ladder between two matching polylines, visible from both sides
const ladder = (a, b) => [loft([a, b]), loft([a, b], { flip: true })]

const join = (list) => {
  const g = mergeGeometries(list)
  list.forEach((x) => x.dispose())
  return g
}

// A surface of revolution about the x axis from [x, r] points. The visible
// side is on the left of the direction of travel: run aft for an outer
// surface, forward for the inside of a duct, outward for a face seen from the
// front. Normals come from the profile itself, so parts cut from one contour
// (pass its tangents as `tan`) meet without a seam.
function revolve(pts, seg = 56, tan = null) {
  const n = pts.length
  const tg =
    tan ||
    pts.map((_, i) => {
      const a = pts[Math.max(0, i - 1)]
      const b = pts[Math.min(n - 1, i + 1)]
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
      return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]
    })
  const g = grid(
    n,
    seg + 1,
    (i, j, P, U) => {
      const a = (j / seg) * Math.PI * 2
      P.set(pts[i][0], pts[i][1] * Math.cos(a), pts[i][1] * Math.sin(a))
      U.set(j / seg, i / (n - 1))
    },
    { flip: true },
  )
  const nrm = g.attributes.normal
  for (let i = 0; i < n; i++)
    for (let j = 0; j <= seg; j++) {
      const a = (j / seg) * Math.PI * 2
      nrm.setXYZ(i * (seg + 1) + j, -tg[i][1], tg[i][0] * Math.cos(a), tg[i][0] * Math.sin(a))
    }
  return g
}
const spline = (pts, n) => new THREE.SplineCurve(pts.map((p) => new THREE.Vector2(p[0], p[1]))).getPoints(n).map((p) => [p.x, p.y])
const tangents = (pts) =>
  pts.map((_, i) => {
    const a = pts[Math.max(0, i - 1)]
    const b = pts[Math.min(pts.length - 1, i + 1)]
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
    return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]
  })

// ---------------------------------------------------------------- fuselage skin
export function fuselageGeometry() {
  const st = []
  for (let k = 0; k <= 34; k++) st.push(5.4 * (k / 34) ** 2)
  for (let k = 1; k <= 12; k++) st.push(5.4 + (19.1 * k) / 12)
  for (let k = 1; k <= 30; k++) st.push(24.5 + ((LENGTH - 24.5) * k) / 30)
  const NV = 80
  const skin = grid(
    st.length,
    NV + 1,
    (i, j, P, U) => {
      fusePoint(st[i], (j / NV) * Math.PI * 2, 0, P)
      U.set(st[i] / LENGTH, j / NV)
    },
    { wrap: true },
  )
  return skin
}

// the wing-to-body fairing under the centre section, which also houses the main wheels
export function bellyGeometry() {
  const S0 = 10.4
  const S1 = 22.6
  const NU = 40
  const NV = 48
  return grid(
    NU + 1,
    NV + 1,
    (i, j, P) => {
      const s = lerp(S0, S1, i / NU)
      const e = smooth((s - S0) / 2.6) * smooth((S1 - s) / 3.6)
      const w = 1.3 + 0.86 * e
      const yc = 2.62
      const lo = yc - (1.9 - 0.4 * e)
      const a = (j / NV) * Math.PI * 2
      const sn = Math.sin(a)
      const cs = Math.cos(a)
      const pw = 2 / 2.7
      P.set(s, yc - Math.sign(cs) * Math.abs(cs) ** pw * (cs > 0 ? lo : 0.74), Math.sign(sn) * Math.abs(sn) ** pw * w)
    },
    { wrap: true },
  )
}

// ---------------------------------------------------------------- decals on the skin
// A rounded rectangle (a superellipse) lying on the fuselage, centred at
// station s0 and angle th0. `inner` and `outer` are [half length, half height]
// in metres: [0, 0] to a size gives a filled panel, two sizes give a frame.
export function roundPatch(s0, th0, inner, outer, { n = 4, lift = 0.004, rings = 3, seg = 32 } = {}) {
  const rate = arcRate(s0, th0)
  const pw = 2 / n
  const shape = (f) => {
    const c = Math.cos(f)
    const s = Math.sin(f)
    return [Math.sign(c) * Math.abs(c) ** pw, Math.sign(s) * Math.abs(s) ** pw]
  }
  // Step round the outline in equal lengths, not equal angles: a squarish
  // outline would otherwise leave edges long enough to cut under the curve of the skin.
  const FINE = 1440
  const run = [0]
  let last = shape(0)
  for (let k = 1; k <= FINE; k++) {
    const q = shape((k / FINE) * Math.PI * 2)
    run.push(run[k - 1] + Math.hypot((q[0] - last[0]) * outer[0], (q[1] - last[1]) * outer[1]))
    last = q
  }
  const turn = []
  for (let j = 0, k = 0; j <= seg; j++) {
    const want = (j / seg) * run[FINE]
    while (k < FINE && run[k + 1] < want) k++
    turn.push(shape(((k + (want - run[k]) / (run[k + 1] - run[k] || 1)) / FINE) * Math.PI * 2))
  }
  turn[seg] = turn[0]
  return grid(
    rings + 1,
    seg + 1,
    (i, j, P) => {
      const k = i / rings
      fusePoint(s0 + lerp(inner[0], outer[0], k) * turn[j][0], th0 + (lerp(inner[1], outer[1], k) / rate) * turn[j][1], lift, P)
    },
    { wrap: true },
  )
}

// A four-sided panel between corners given as [station, theta], in the order
// front-low, aft-low, aft-high, front-high. `grow` pushes the edges out by
// that many metres (for the seal round a pane).
export function quadPatch(corners, { lift = 0.004, grow = 0, nu = 8, nv = 8 } = {}) {
  let c = corners
  if (grow) {
    const ms = (c[0][0] + c[1][0] + c[2][0] + c[3][0]) / 4
    const mt = (c[0][1] + c[1][1] + c[2][1] + c[3][1]) / 4
    const rate = arcRate(ms, mt)
    c = c.map(([s, t]) => {
      const ds = s - ms
      const dt = (t - mt) * rate
      const l = Math.hypot(ds, dt) || 1
      return [s + (ds / l) * grow * 1.3, t + ((dt / l) * grow * 1.3) / rate]
    })
  }
  const at = (u, v, P) => {
    const s = lerp(lerp(c[0][0], c[1][0], u), lerp(c[3][0], c[2][0], u), v)
    const t = lerp(lerp(c[0][1], c[1][1], u), lerp(c[3][1], c[2][1], u), v)
    return fusePoint(s, t, lift, P)
  }
  // face the panel outward whichever way its corners run
  const a = at(0.5, 0.5, new THREE.Vector3())
  const du = at(0.6, 0.5, new THREE.Vector3()).sub(a)
  const dv = at(0.5, 0.6, new THREE.Vector3()).sub(a)
  const out = fusePoint((c[0][0] + c[2][0]) / 2, (c[0][1] + c[2][1]) / 2, 1, new THREE.Vector3()).sub(a)
  const flip = du.cross(dv).dot(out) < 0
  return grid(nu + 1, nv + 1, (i, j, P) => at(i / nu, j / nv, P), { flip })
}

// Cabin windows, door outlines, door windows and the flight-deck panes for the
// port side. Stations and heights are the real ones.
export const WINDOW_Y = CY + 0.44
export const DOOR = { s: 5.12, w: 0.84, y0: CY - 0.5, y1: CY + 1.36 } // the forward passenger door
const AFT_DOOR_S = 29.25
const EXITS = [16.75, 17.82] // overwing exits
const WINDOW_PITCH = 0.533

// the centre angle and half sizes of a door between two heights
function doorBox(s, y0, y1, w) {
  const th = (thetaAt(s, y0) + thetaAt(s, y1)) / 2
  return { s, th, hw: w / 2, hh: ((thetaAt(s, y1) - thetaAt(s, y0)) / 2) * arcRate(s, th) }
}
// its outline (two offsets from the edge) or, with `fill`, the whole panel inset by `outer`
const doorPatch = (d, inner, outer, opts, fill = false) => roundPatch(d.s, d.th, fill ? [0, 0] : [d.hw + inner, d.hh + inner], [d.hw + outer, d.hh + outer], { n: 9, seg: 96, ...opts })

export function decalGeometry() {
  const glass = []
  const seals = []
  const lines = []
  const marks = []

  // cabin windows, skipping the doors
  for (let s = 6.22; s < 28.5; s += WINDOW_PITCH) {
    const th = thetaAt(s, WINDOW_Y)
    glass.push(roundPatch(s, th, [0, 0], [0.108, 0.158], { n: 3.4, lift: 0.006 }))
    seals.push(roundPatch(s, th, [0.108, 0.158], [0.128, 0.178], { n: 3.4, lift: 0.005, rings: 1 }))
  }

  // passenger doors: an outline, a small window, a handle recess
  for (const s of [DOOR.s, AFT_DOOR_S]) {
    if (s !== DOOR.s) lines.push(doorPatch(doorBox(s, DOOR.y0, DOOR.y1, DOOR.w), -0.009, 0.009, { rings: 1, lift: 0.005 }))
    const th = thetaAt(s, WINDOW_Y + 0.12)
    if (s !== DOOR.s) {
      glass.push(roundPatch(s, th, [0, 0], [0.085, 0.125], { n: 3, lift: 0.007 }))
      seals.push(roundPatch(s, th, [0.085, 0.125], [0.105, 0.145], { n: 3, lift: 0.006, rings: 1 }))
      lines.push(roundPatch(s + 0.02, thetaAt(s, CY + 0.05), [0, 0], [0.13, 0.05], { n: 5, lift: 0.006, rings: 1 }))
      marks.push(roundPatch(s - 0.27, thetaAt(s, CY - 0.18), [0, 0], [0.035, 0.035], { n: 2, lift: 0.006, rings: 1, seg: 16 }))
    }
  }
  // overwing exits: an outline round one window each
  for (const s of EXITS) {
    lines.push(doorPatch(doorBox(s, WINDOW_Y - 0.6, WINDOW_Y + 0.42, 0.5), -0.007, 0.007, { rings: 1, lift: 0.005, n: 6 }))
    marks.push(roundPatch(s, thetaAt(s, WINDOW_Y + 0.33), [0, 0], [0.05, 0.016], { n: 4, lift: 0.006, rings: 1, seg: 12 }))
  }

  // flight deck: the windscreen and two side panes, as angles from the crown
  const C = (s, psi) => [s, Math.PI - psi]
  const sill = (s, y) => Math.PI - thetaAt(s, CY + y) // angle from the crown at a height above the centreline
  const post = (s) => 0.6 - 0.085 * (s - 1.6) // the outer edge of the windscreen
  const panes = [
    [C(1.8, 0.05), C(1.6, post(1.6)), C(2.62, post(2.62)), C(2.82, 0.05)],
    [C(1.74, sill(1.74, 0.29)), C(2.72, sill(2.72, 0.3)), C(2.68, post(2.68) + 0.07), C(1.74, post(1.74) + 0.07)],
    [C(2.83, sill(2.83, 0.31)), C(3.66, sill(3.66, 0.4)), C(3.42, sill(3.42, 1.1)), C(2.8, sill(2.8, 1.06))],
  ]
  const deck = panes.map((p) => quadPatch(p, { lift: 0.008 }))
  const deckSeal = panes.map((p) => quadPatch(p, { lift: 0.0055, grow: 0.028 }))

  return { glass: join(glass), seals: join(seals), lines: join(lines), marks: join(marks), deck: join(deck), deckSeal: join(deckSeal) }
}

// The forward port door as its own panel (it opens), with the dark doorway
// behind it. Both are built round the door's centre so the panel can be moved.
export function doorGeometry() {
  const d = doorBox(DOOR.s, DOOR.y0, DOOR.y1, DOOR.w)
  const th = thetaAt(DOOR.s, WINDOW_Y + 0.12)
  return {
    panel: doorPatch(d, 0, -0.01, { rings: 12, lift: 0.006 }, true),
    way: doorPatch(d, 0, -0.004, { rings: 12, lift: 0.003 }, true),
    outline: doorPatch(d, -0.004, 0.012, { rings: 1, lift: 0.004 }),
    glass: roundPatch(DOOR.s, th, [0, 0], [0.085, 0.125], { n: 3, lift: 0.009 }),
    seal: roundPatch(DOOR.s, th, [0.085, 0.125], [0.105, 0.145], { n: 3, lift: 0.008, rings: 1 }),
    handle: roundPatch(DOOR.s + 0.02, thetaAt(DOOR.s, CY + 0.05), [0, 0], [0.13, 0.05], { n: 5, lift: 0.008, rings: 1 }),
    mark: roundPatch(DOOR.s - 0.27, thetaAt(DOOR.s, CY - 0.18), [0, 0], [0.035, 0.035], { n: 2, lift: 0.008, rings: 1, seg: 16 }),
  }
}

// ---------------------------------------------------------------- aerofoils
// thickness and camber of a section of unit chord
const thick = (x, tc) => 5 * tc * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1036 * x ** 4)
const camber = (x, m, p = 0.45) => (m === 0 ? 0 : x < p ? (m / (p * p)) * (2 * p * x - x * x) : (m / ((1 - p) * (1 - p))) * (1 - 2 * p + 2 * p * x - x * x))
const upper = (f, x) => camber(x, f.m) + thick(x, f.tc)
const lower = (f, x) => camber(x, f.m) - thick(x, f.tc)

// A frame is one rib: leading-edge point O, the direction n its thickness
// runs, chord c, thickness ratio tc, camber m, twist tw and distance q along
// the span. at() places a point given in chord fractions.
function at(f, x, y, out = new THREE.Vector3()) {
  const X = x * f.c
  const Y = y * f.c
  const cs = Math.cos(f.tw)
  const sn = Math.sin(f.tw)
  const yy = -X * sn + Y * cs
  return out.set(f.O.x + X * cs + Y * sn, f.O.y + f.n.y * yy, f.O.z + f.n.z * yy)
}

// the skin of a rib from chord fraction xe on top, round the nose, to xe below
function rib(f, xe = 1, N = 22, u = 0) {
  const row = []
  for (let k = 0; k < N; k++) {
    const x = xe * 0.5 * (1 + Math.cos((Math.PI * k) / (N - 1)))
    row.push({ p: at(f, x, upper(f, x)), u, v: 0.5 - 0.5 * x })
  }
  for (let k = 1; k < N; k++) {
    const x = xe * 0.5 * (1 - Math.cos((Math.PI * k) / (N - 1)))
    row.push({ p: at(f, x, lower(f, x)), u, v: 0.5 + 0.5 * x })
  }
  return row
}
// matching points down the top and the bottom of a rib between two chord fractions
function chordPair(f, x0, x1, N = 10) {
  const top = []
  const bot = []
  for (let k = 0; k < N; k++) {
    const x = lerp(x0, x1, k / (N - 1))
    top.push({ p: at(f, x, upper(f, x)) })
    bot.push({ p: at(f, x, lower(f, x)) })
  }
  return [top, bot]
}
// a flat cap over a closed outline, facing +z as drawn (or -z when `back`)
function cap(pts, back = false) {
  const c = new THREE.Vector3()
  pts.forEach((q) => c.add(q.p))
  c.divideScalar(pts.length)
  return loft([pts.map(() => ({ p: c })), pts], { flip: back })
}

// ---------------------------------------------------------------- wing
const KINK = 6.4 // the trailing edge is straight inboard of this
const TIPZ = 16.9 // where the wing turns up into the sharklet
const ROOT_Y = 2.55
const DIH = rad(5.1)
const leX = (z) => 11.6 + 0.5206 * z
const teX = (z) => (z <= KINK ? 18.95 : 18.95 + 0.2857 * (z - KINK))

function wingFrame(z) {
  const k = z <= KINK ? z / KINK : (z - KINK) / (TIPZ - KINK)
  return {
    O: new THREE.Vector3(leX(z), ROOT_Y + Math.tan(DIH) * z, z),
    n: new THREE.Vector3(0, Math.cos(DIH), -Math.sin(DIH)),
    c: teX(z) - leX(z),
    tc: z <= KINK ? lerp(0.15, 0.118, k) : lerp(0.118, 0.104, k),
    m: 0.018,
    tw: rad(z <= KINK ? lerp(3.4, 1.4, k) : lerp(1.4, -1.0, k)),
    q: z / Math.cos(DIH),
  }
}
// the sharklet: the tip curls up through a tight arc into a swept, tapering blade
function sharkletFrames() {
  const out = []
  const R = 0.8
  const g1 = rad(78)
  const arc = R * (g1 - DIH)
  const total = arc + 1.85
  const f0 = wingFrame(TIPZ)
  let { x, y, z } = f0.O
  const N = 18
  const da = total / N
  for (let i = 1; i <= N; i++) {
    const a = i * da
    const gm = DIH + Math.min(1, (a - da / 2) / arc) * (g1 - DIH)
    const g = DIH + Math.min(1, a / arc) * (g1 - DIH)
    const t = a / total
    z += Math.cos(gm) * da
    y += Math.sin(gm) * da
    x += lerp(0.52, 0.98, smooth(t * 1.5)) * da
    out.push({
      O: new THREE.Vector3(x, y, z),
      n: new THREE.Vector3(0, Math.cos(g), -Math.sin(g)),
      c: lerp(f0.c, 0.56, t ** 0.85) * (1 - 0.35 * smooth((t - 0.9) / 0.1)),
      tc: lerp(0.104, 0.09, t),
      m: 0.018 * (1 - t),
      tw: f0.tw * (1 - t),
      q: f0.q + a,
    })
  }
  return out
}
const SHARK = sharkletFrames()
const WING_Q = SHARK[SHARK.length - 1].q // skin length root to tip, for the texture
export const WING_TIP_U = wingFrame(TIPZ).q / WING_Q
// how far along the wing texture a span station sits
export const wingU = (z) => wingFrame(z).q / WING_Q

// the moving surfaces: [inboard end, outboard end] and the flap chord at each
const FLAPS = [
  { z0: 2.25, z1: 6.3, c0: 0.95, c1: 0.95 },
  { z0: 6.5, z1: 13.0, c0: 0.95, c1: 0.62 },
]
const SLATS = [
  [2.7, 5.0],
  [6.5, 9.0],
  [9.05, 11.5],
  [11.55, 14.0],
  [14.05, 16.5],
]
const RIBS = [0, 1, 1.975, 2.25, 3, 4, 5, 5.75, 6.3, 6.4, 6.5, 7.5, 8.5, 9.5, 10.5, 11.5, 12.5, 13, 14, 15, 16, TIPZ]
const ribsIn = (z0, z1) => [z0, ...RIBS.filter((z) => z > z0 + 1e-6 && z < z1 - 1e-6), z1]
const flapChord = (fl, z) => lerp(fl.c0, fl.c1, (z - fl.z0) / (fl.z1 - fl.z0))
const slatFrac = (f) => Math.min(0.17, 0.62 / f.c)

export function wingGeometry() {
  const parts = []
  const u = (f) => f.q / WING_Q
  // the fixed wing, in spans: whole where nothing moves, cut short ahead of each flap
  const spans = [{ z0: 0, z1: FLAPS[0].z0 }, { ...FLAPS[0], flap: FLAPS[0] }, { z0: FLAPS[0].z1, z1: FLAPS[1].z0 }, { ...FLAPS[1], flap: FLAPS[1] }, { z0: FLAPS[1].z1, z1: TIPZ, tip: true }]
  for (const sp of spans) {
    const frames = ribsIn(sp.z0, sp.z1).map(wingFrame)
    if (sp.tip) frames.push(...SHARK)
    const xe = (f) => (sp.flap ? 1 - flapChord(sp.flap, f.O.z) / f.c : 1)
    const rows = frames.map((f) => rib(f, xe(f), 22, u(f)))
    parts.push(loft(rows, { flip: true }))
    if (sp.flap) {
      // the cove the flap sits in, and the walls at its two ends
      parts.push(loft(rows.map((r) => [r[r.length - 1], r[0]]), { flip: true }))
      for (const f of [frames[0], frames[frames.length - 1]]) parts.push(...ladder(...chordPair(f, xe(f), 1)))
    }
    if (sp.tip) parts.push(...ladder(...chordPair(frames[frames.length - 1], 0, 1, 14)))
  }
  return join(parts)
}

// One flap: its skin with a rounded nose, end caps, and the two ends of the
// hinge line it swings about (below the wing, so it travels aft as it droops).
export function flapGeometry(i) {
  const fl = FLAPS[i]
  const frames = ribsIn(fl.z0 + 0.012, fl.z1 - 0.012).map(wingFrame)
  const ring = (f) => {
    const fc = flapChord(fl, f.O.z)
    const xf = 1 - fc / f.c
    const u = f.q / WING_Q
    const row = []
    for (let k = 0; k < 9; k++) {
      const x = lerp(1, xf, k / 8)
      row.push({ p: at(f, x, upper(f, x)), u, v: 0.5 - 0.5 * x })
    }
    const yu = upper(f, xf)
    const yl = lower(f, xf)
    const r = (yu - yl) / 2
    for (let k = 1; k < 8; k++) {
      const a = Math.PI / 2 + (Math.PI * k) / 8
      row.push({ p: at(f, xf + 1.5 * r * Math.cos(a), (yu + yl) / 2 + r * Math.sin(a)), u, v: 0.5 + (0.5 * xf * k) / 8 })
    }
    for (let k = 0; k < 9; k++) {
      const x = lerp(xf, 1, k / 8)
      row.push({ p: at(f, x, lower(f, x)), u, v: 0.5 + 0.5 * x })
    }
    return row
  }
  const rows = frames.map(ring)
  const hinge = (f) => {
    const fc = flapChord(fl, f.O.z)
    const xf = 1 - fc / f.c
    return at(f, xf + (0.12 * fc) / f.c, lower(f, xf) - (0.62 * fc) / f.c)
  }
  return { geometry: join([loft(rows, { flip: true }), cap(rows[0], true), cap(rows[rows.length - 1])]), a: hinge(frames[0]), b: hinge(frames[frames.length - 1]) }
}

// One slat: a shell over the leading edge, and the line it swings about.
export function slatGeometry(i) {
  const [z0, z1] = SLATS[i]
  const frames = ribsIn(z0, z1).map(wingFrame)
  const T = 0.016
  const ring = (f, lift) => {
    const xs = slatFrac(f)
    const u = f.q / WING_Q
    const pts = []
    for (let k = 0; k < 10; k++) {
      const x = xs * 0.5 * (1 + Math.cos((Math.PI * k) / 9))
      pts.push([x, upper(f, x), 0.5 - 0.5 * x])
    }
    for (let k = 1; k < 5; k++) {
      const x = 0.045 * 0.5 * (1 - Math.cos((Math.PI * k) / 4))
      pts.push([x, lower(f, x), 0.5 + 0.5 * x])
    }
    return pts.map(([x, y, v], k) => {
      const a = pts[Math.max(0, k - 1)]
      const b = pts[Math.min(pts.length - 1, k + 1)]
      const tx = b[0] - a[0]
      const ty = b[1] - a[1]
      const l = Math.hypot(tx, ty) || 1
      return { p: at(f, x + ((ty / l) * lift) / f.c, y - ((tx / l) * lift) / f.c), u, v }
    })
  }
  const outer = frames.map((f) => ring(f, T))
  const inner = frames.map((f) => ring(f, 0.003))
  const last = outer.length - 1
  const hinge = (f) => at(f, slatFrac(f), -0.72 * slatFrac(f))
  return {
    geometry: join([
      loft(outer, { flip: true }),
      loft(inner),
      ...ladder(outer[0], inner[0]),
      ...ladder(outer[last], inner[last]),
      // the trailing lip on top and the lower lip
      loft([outer.map((r) => r[0]), inner.map((r) => r[0])], { flip: true }),
      loft([outer.map((r) => r[r.length - 1]), inner.map((r) => r[r.length - 1])]),
    ]),
    a: hinge(frames[0]),
    b: hinge(frames[last]),
  }
}
export const FLAP_COUNT = FLAPS.length
export const SLAT_COUNT = SLATS.length

// where things hang off the wing, for the lights and the gear
export const wingPoint = (z, x, below = false) => {
  const f = wingFrame(z)
  return at(f, x, below ? lower(f, x) : upper(f, x))
}
export const sharkletTip = () => {
  const f = SHARK[SHARK.length - 1]
  return at(f, 0.5, 0)
}

// ---------------------------------------------------------------- tail
export const FIN_UV = { s0: 27, s1: 37, y0: 5, y1: 12.2 }
export function finGeometry() {
  const frames = []
  const Y0 = 5.3
  const Y1 = 11.76
  for (let k = 0; k <= 22; k++) {
    const t = k / 22
    const y = lerp(Y0, Y1, 1 - (1 - t) ** 1.25)
    const round = 1 - smooth((Y1 - y) / 0.5) // the tip rounds off
    const le = 28.9 + 0.795 * (y - 5.6) - 1.7 * (1 - smooth((y - 5.5) / 1.1)) ** 2 + 0.5 * round ** 2
    const te = 34.7 + 0.154 * (y - 5.6) - 0.12 * round ** 2
    frames.push({ O: new THREE.Vector3(le, y, 0), n: new THREE.Vector3(0, 0, 1), c: te - le, tc: lerp(0.105, 0.09, t), m: 0, tw: 0 })
  }
  const uv = (q) => {
    q.u = (q.p.x - FIN_UV.s0) / (FIN_UV.s1 - FIN_UV.s0)
    q.v = (q.p.y - FIN_UV.y0) / (FIN_UV.y1 - FIN_UV.y0)
    return q
  }
  const rows = frames.map((f) => rib(f, 1, 20).map(uv))
  const tip = chordPair(frames[frames.length - 1], 0, 1, 14).map((r) => r.map(uv))
  return join([loft(rows), ...ladder(...tip)])
}

// the port half of the tailplane
export function stabGeometry() {
  const frames = []
  const SPAN = 6.225
  for (let k = 0; k <= 16; k++) {
    const t = k / 16
    const z = SPAN * (1 - (1 - t) ** 1.3)
    const round = 1 - smooth((SPAN - z) / 0.35)
    const c = lerp(4.0, 1.25, z / SPAN)
    frames.push({ O: new THREE.Vector3(31.55 + 0.625 * z + 0.35 * round ** 2, 4.72 + Math.tan(rad(6)) * z, z), n: new THREE.Vector3(0, Math.cos(rad(6)), -Math.sin(rad(6))), c: c * (1 - 0.3 * round ** 2), tc: 0.1, m: 0, tw: rad(-1.5), q: 0 })
  }
  const rows = frames.map((f) => rib(f, 1, 18, f.O.z / SPAN))
  return join([loft(rows, { flip: true }), ...ladder(...chordPair(frames[frames.length - 1], 0, 1, 12))])
}

// ---------------------------------------------------------------- engine
// A high-bypass turbofan in its nacelle, about its own axis: x runs aft from
// the intake lip. Returns one geometry per material.
export const ENGINE = { s: 11.5, y: 1.74, z: 5.75, fanX: 1.0 }
export function engineGeometry() {
  // one contour from the fan face, forward round the lip, and aft down the cowl
  const contour = spline(
    [[1.3, 0.868], [1.0, 0.866], [0.7, 0.858], [0.45, 0.84], [0.26, 0.826], [0.13, 0.832], [0.05, 0.852], [0.008, 0.878], [0, 0.905], [0.012, 0.935], [0.06, 0.972], [0.16, 1.018], [0.36, 1.075], [0.8, 1.128], [1.3, 1.146], [1.9, 1.122], [2.4, 1.066], [2.88, 0.985]],
    170,
  )
  const tg = tangents(contour)
  const nose = contour.reduce((m, p, i) => (p[0] < contour[m][0] ? i : m), 0)
  const a = contour.findIndex((p) => p[0] < 0.2)
  const b = contour.findIndex((p, i) => i > nose && p[0] > 0.2)
  const cut = (i0, i1) => revolve(contour.slice(i0, i1 + 1), 72, tg.slice(i0, i1 + 1))

  const core = spline([[1.5, 0.56], [2.0, 0.64], [2.5, 0.662], [2.88, 0.632], [3.3, 0.535], [3.78, 0.42]], 30)
  const plug = spline([[3.1, 0.285], [3.45, 0.275], [3.8, 0.2], [4.12, 0.105], [4.38, 0.015]], 24)
  const spinner = spline([[0.4, 0.001], [0.43, 0.05], [0.58, 0.14], [0.78, 0.22], [1.0, 0.272]], 20)

  // fan blades: wide-chord, twisting from the hub to the tip
  const blades = []
  const R0 = 0.265
  const R1 = 0.856
  const blade = grid(9, 6, (i, j, P) => {
    const t = i / 8
    const r = lerp(R0, R1, t)
    const xi = j / 5 - 0.5
    const ch = lerp(0.19, 0.3, t)
    const beta = rad(lerp(24, 63, t ** 0.8))
    const bow = 0.07 * ch * (1 - 4 * xi * xi)
    P.set(ENGINE.fanX + xi * ch * Math.cos(beta) - bow * Math.sin(beta), r, xi * ch * Math.sin(beta) + bow * Math.cos(beta) + 0.05 * t * t)
  })
  for (let k = 0; k < 36; k++) blades.push(blade.clone().rotateX((k / 36) * Math.PI * 2))
  blade.dispose()

  return {
    duct: cut(0, a),
    lip: cut(a, b),
    cowl: cut(b, contour.length - 1),
    // the inside of the fan nozzle, the core cowl, and the dark faces that close them
    dark: join([
      revolve([[2.88, 0.955], [2.3, 0.985], [1.6, 0.96]]),
      revolve([[1.6, 0.96], [1.6, 0.5]]),
      revolve([[3.78, 0.4], [3.3, 0.405]]),
      revolve([[3.3, 0.405], [3.3, 0.2]]),
      revolve([[2.88, 0.985], [2.88, 0.955]]),
    ]),
    core: revolve(core),
    hot: join([revolve(plug), revolve([[3.78, 0.42], [3.78, 0.4]])]),
    stator: revolve([[1.24, 0.2], [1.24, 0.868]]),
    spinner: revolve(spinner, 40),
    blades: join(blades),
  }
}

// A tyre about the z axis: rounded shoulders and four tread grooves.
export function tyreGeometry(R, W, rim) {
  const pts = []
  const N = 72
  for (let k = 0; k <= N; k++) {
    const t = -1 + (2 * k) / N
    const a = Math.abs(t)
    let r = rim + (R - rim) * (1 - a ** 3.2) ** (1 / 3.2)
    for (const gpos of [0.2, 0.52]) r -= 0.011 * Math.exp(-(((a - gpos) / 0.035) ** 2))
    pts.push([(t * W) / 2, Math.max(rim, r)])
  }
  return revolve(pts, 64).rotateY(-Math.PI / 2)
}
