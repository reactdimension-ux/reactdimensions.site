import * as THREE from 'three'
import { grid, smooth } from '../airliner/geometry.js'

// The shapes of an electric tuk-tuk (an auto rickshaw: 2.8 m long, 1.2 m
// wide, 1.7 m tall), built from numbers rather than loaded from a file.
// Units are metres. In the vehicle's own frame x runs aft from the tip of the
// nose, y is up from the ground and +z is the left side; everything here is
// the left half, and the right half is the same drawn through a mirror.
//
// Two skins make the body. The tub is the painted shell from the floor up to
// the belt line: a narrow rounded nose over the front wheel, widening into
// the square passenger body over the rear axle. The canopy is the soft top
// above it: the raked windscreen frame, the roof and, behind the passengers,
// the canvas sides and back. Each is lofted from its outline in plan, and
// the openings and windows are cut by its material (see textures.js), so
// their edges stay crisp however close the camera comes.

export const LENGTH = 2.8
export const CENTRE = 1.4 // the station that sits over the origin
export const WHEEL_R = 0.245
export const FRONT_WHEEL = { x: 0.27, r: WHEEL_R }
export const REAR_AXLE = 2.1
export const TRACK = 0.505 // half the distance between the rear wheel centres
export const ARCH_R = 0.305 // the opening in the tub round each rear wheel
export const BELT = 1.0 // the top edge of the tub
export const SILL = 0.52 // the step into the cab
export const OPEN = [0.62, 1.72] // the cab opening, front and rear edge
export const B_PILLAR = 1.12
export const ROOF = 1.69
export const PORT = { x: 2.56, y: 0.74, w: 0.122, h: 0.104 } // the charging flap, on the rear flank

const lerp = (a, b, t) => a + (b - a) * t
const clamp01 = (t) => Math.min(1, Math.max(0, t))

// ---------------------------------------------------------------- outlines
// A plan outline from the nose (u = 0, on the centre line) down the left side
// to the tail (u = 1, on the centre line). Columns bunch up round the two
// ends, where the outline turns; the ends are superellipses, round at the
// nose and nearly square at the tail.
function plan(o, u, out) {
  const g = (1 - Math.cos(Math.PI * u)) / 2
  const x = o.xf + (o.xr - o.xf) * g
  let cap = 1
  if (x < o.xf + o.rf) cap = (1 - ((o.xf + o.rf - x) / o.rf) ** o.nf) ** (1 / o.nf)
  else if (x > o.xr - o.rr) cap = (1 - ((x - (o.xr - o.rr)) / o.rr) ** o.nr) ** (1 / o.nr)
  out.x = x
  out.z = o.w(x) * (Number.isFinite(cap) ? cap : 0)
  return out
}
// the point and its outward normal in plan, continued through the centre line by symmetry
function column(o, u, out = {}) {
  const e = 1e-4
  const at = (v, q) => {
    const m = v < 0 ? -v : v > 1 ? 2 - v : v
    plan(o, m, q)
    if (v < 0 || v > 1) q.z = -q.z
    return q
  }
  const a = at(u - e, {})
  const b = at(u + e, {})
  plan(o, u, out)
  const tx = b.x - a.x
  const tz = b.z - a.z
  const l = Math.hypot(tx, tz) || 1
  out.nx = -tz / l
  out.nz = tx / l
  return out
}
// the column whose station is x (on the straight sides)
const uAt = (o, x) => Math.acos(1 - 2 * clamp01((x - o.xf) / (o.xr - o.xf))) / Math.PI

// ---------------------------------------------------------------- the tub
export const TUB = {
  xf: 0.04,
  xr: LENGTH,
  rf: 0.24,
  nf: 2.3,
  rr: 0.11,
  nr: 3.5,
  w: (x) => 0.44 + 0.162 * smooth((x - 0.12) / 0.62),
}
// The floor is raised over the front wheel and steps down behind it.
export const tubFloor = (x) => 0.55 - 0.27 * smooth((x - 0.5) / 0.14)
const R_LOW = 0.05 // the radius round the bottom edge
const R_LIP = 0.02 // the lip rolled in along the top edge
const TUMBLE = 0.016 // how far the sides lean in by the top
// Rows up the skin: across the floor, round its edge, up the side, over the lip.
const TB = [0.3, 0.38, 0.95]

export function tubAt(u, b, out = new THREE.Vector3(), col = column(TUB, u)) {
  const y0 = tubFloor(col.x)
  let d, y
  if (b < TB[0]) {
    const t = b / TB[0]
    return out.set(lerp(col.x, col.x - col.nx * R_LOW, t), y0, lerp(0, col.z - col.nz * R_LOW, t))
  } else if (b < TB[1]) {
    const a = ((b - TB[0]) / (TB[1] - TB[0])) * (Math.PI / 2)
    d = R_LOW * (1 - Math.sin(a))
    y = y0 + R_LOW * (1 - Math.cos(a))
  } else if (b < TB[2]) {
    const t = (b - TB[1]) / (TB[2] - TB[1])
    d = TUMBLE * t * t
    y = lerp(y0 + R_LOW, BELT - R_LIP, t)
  } else {
    const a = ((b - TB[2]) / (1 - TB[2])) * (Math.PI / 2)
    d = TUMBLE + R_LIP * (1 - Math.cos(a))
    y = BELT - R_LIP + R_LIP * Math.sin(a)
  }
  return out.set(col.x - col.nx * d, y, col.z - col.nz * d)
}
export const tubColumn = (u) => column(TUB, u)

// a point on the left side of the tub at station x and height y, `lift` off the skin
export function tubSide(x, y, lift = 0, out = new THREE.Vector3()) {
  const col = column(TUB, uAt(TUB, x))
  const y0 = tubFloor(col.x) + R_LOW
  const t = clamp01((y - y0) / (BELT - R_LIP - y0))
  const d = TUMBLE * t * t - lift
  return out.set(col.x - col.nx * d, y, col.z - col.nz * d)
}
// the nose of the tub at half width z (either side) and height y, and its normal
export function tubNose(z, y, lift = 0) {
  let lo = 0
  let hi = uAt(TUB, TUB.xf + TUB.rf)
  const col = {}
  for (let k = 0; k < 30; k++) {
    const m = (lo + hi) / 2
    column(TUB, m, col)
    if (col.z < Math.abs(z)) lo = m
    else hi = m
  }
  column(TUB, (lo + hi) / 2, col)
  const s = Math.sign(z) || 1
  return { p: new THREE.Vector3(col.x + col.nx * lift, y, s * (col.z + col.nz * lift)), n: new THREE.Vector3(col.nx, 0, s * col.nz) }
}
// the tail at half width z
export function tubTail(z, y, lift = 0) {
  let lo = uAt(TUB, TUB.xr - TUB.rr)
  let hi = 1
  const col = {}
  for (let k = 0; k < 30; k++) {
    const m = (lo + hi) / 2
    column(TUB, m, col)
    if (col.z > Math.abs(z)) lo = m
    else hi = m
  }
  column(TUB, (lo + hi) / 2, col)
  const s = Math.sign(z) || 1
  return { p: new THREE.Vector3(col.x + col.nx * lift, y, s * (col.z + col.nz * lift)), n: new THREE.Vector3(col.nx, 0, s * col.nz) }
}

const NU = 260
const TUB_ROWS = [0, 0.1, 0.2, 0.3, 0.315, 0.33, 0.345, 0.36, 0.38, ...Array.from({ length: 15 }, (_, i) => 0.38 + ((i + 1) * 0.57) / 15), 0.9625, 0.975, 0.9875, 1]
export function tubGeometry() {
  const cols = Array.from({ length: NU }, (_, i) => column(TUB, i / (NU - 1)))
  return grid(NU, TUB_ROWS.length, (i, j, P, U) => {
    tubAt(i / (NU - 1), TUB_ROWS[j], P, cols[i])
    U.set(i / (NU - 1), TUB_ROWS[j])
  })
}

// The top of the cowl in front of the driver, filled in flat from the lip to
// the centre line, back to station x1.
export function dashGeometry(x1 = 0.6) {
  const u1 = uAt(TUB, x1)
  const n = 60
  const rows = []
  for (let i = 0; i <= n; i++) {
    const u = (i / n) * u1
    const col = column(TUB, u)
    const d = TUMBLE + R_LIP
    rows.push([new THREE.Vector3(col.x - col.nx * d, BELT, col.z - col.nz * d), new THREE.Vector3(col.x - col.nx * d, BELT, 0)])
  }
  return grid(rows.length, 2, (i, j, P) => P.copy(rows[i][j]))
}

// ---------------------------------------------------------------- the canopy
const CAN_BOT = 0.985
const CAN_WALL = 1.63
const R_ROOF = 0.06
// the windscreen leans back: the front of the canopy at height y
export const canXf = (y) => 0.16 + 0.17 * clamp01((y - CAN_BOT) / (CAN_WALL - CAN_BOT))
export const CAN = {
  xr: 2.818,
  rf: 0.15,
  nf: 2.6,
  rr: 0.08,
  nr: 3.5,
  w: (x) => 0.452 + 0.155 * smooth((x - 0.2) / 0.75),
}
const canOutline = (y) => ({ ...CAN, xf: canXf(y) })
const CB = [0.45, 0.55]
// the height of row b, below the roof
const canY = (b) => (b < CB[0] ? lerp(CAN_BOT, CAN_WALL, b / CB[0]) : CAN_WALL)

export function canopyAt(u, b, out = new THREE.Vector3()) {
  const col = column(canOutline(canY(b)), u)
  if (b < CB[0]) return out.set(col.x, canY(b), col.z)
  if (b < CB[1]) {
    const a = ((b - CB[0]) / (CB[1] - CB[0])) * (Math.PI / 2)
    const d = R_ROOF * (1 - Math.cos(a))
    return out.set(col.x - col.nx * d, CAN_WALL + R_ROOF * Math.sin(a), col.z - col.nz * d)
  }
  const t = (b - CB[1]) / (1 - CB[1])
  return out.set(lerp(col.x - col.nx * R_ROOF, col.x, t), ROOF - 0.01 + 0.022 * (1 - (1 - t) ** 2), lerp(col.z - col.nz * R_ROOF, 0, t))
}
// for the painter: the region of the outline a texel is in
export const canopyRegion = (x, y) => {
  const xf = canXf(Math.min(y, CAN_WALL))
  return x < xf + CAN.rf ? 'front' : x > CAN.xr - CAN.rr ? 'rear' : 'side'
}

const CAN_ROWS = [...Array.from({ length: 15 }, (_, i) => (i / 14) * CB[0]), ...Array.from({ length: 6 }, (_, i) => CB[0] + ((i + 1) / 6) * (CB[1] - CB[0])), ...Array.from({ length: 8 }, (_, i) => CB[1] + ((i + 1) / 8) * (1 - CB[1]))]
export function canopyGeometry() {
  return grid(NU, CAN_ROWS.length, (i, j, P, U) => {
    canopyAt(i / (NU - 1), CAN_ROWS[j], P)
    U.set(i / (NU - 1), CAN_ROWS[j])
  })
}

// the left side of the canopy at station x and height y
export function canopySide(x, y, lift = 0, out = new THREE.Vector3()) {
  const o = canOutline(y)
  const col = column(o, uAt(o, x))
  return out.set(col.x + col.nx * lift, y, col.z + col.nz * lift)
}
// the canopy's front (the windscreen) or back at half width z, height y
function canopyEnd(front, z, y, lift = 0, out = new THREE.Vector3()) {
  const o = canOutline(y)
  let lo = front ? 0 : uAt(o, o.xr - o.rr)
  let hi = front ? uAt(o, o.xf + o.rf) : 1
  const col = {}
  for (let k = 0; k < 30; k++) {
    const m = (lo + hi) / 2
    column(o, m, col)
    if (front ? col.z < Math.abs(z) : col.z > Math.abs(z)) lo = m
    else hi = m
  }
  column(o, (lo + hi) / 2, col)
  const s = Math.sign(z) || 1
  return out.set(col.x + col.nx * lift, y, s * (col.z + col.nz * lift))
}
export const canopyFront = (z, y, lift, out) => canopyEnd(true, z, y, lift, out)
export const canopyBack = (z, y, lift, out) => canopyEnd(false, z, y, lift, out)

// ---------------------------------------------------------------- windows
// A window is a superellipse (a rounded rectangle) on one of the surfaces
// above, given in that surface's own two coordinates. The painter cuts the
// same shape out of the canopy, so the pane and the hole always agree.
export const WINDOWS = {
  screen: { on: canopyFront, c: [0, 1.302], h: [0.385, 0.262], n: 5 },
  back: { on: canopyBack, c: [0, 1.36], h: [0.41, 0.19], n: 6 },
  quarter: { on: canopySide, c: [2.285, 1.34], h: [0.31, 0.18], n: 6 },
}
export const insideWindow = (w, a, y, grow = 0) => (Math.abs(a - w.c[0]) / (w.h[0] + grow)) ** w.n + (Math.abs(y - w.c[1]) / (w.h[1] + grow)) ** w.n <= 1
const sePoint = (w, th, rho, grow = 0) => {
  const c = Math.cos(th)
  const s = Math.sin(th)
  return [w.c[0] + (w.h[0] + grow) * rho * Math.sign(c) * Math.abs(c) ** (2 / w.n), w.c[1] + (w.h[1] + grow) * rho * Math.sign(s) * Math.abs(s) ** (2 / w.n)]
}
// the pane, a little inside the skin
export function paneGeometry(w, inset = 0.004) {
  const R = 10
  const T = 96
  return grid(R + 1, T + 1, (i, j, P) => {
    const [a, y] = sePoint(w, (j / T) * Math.PI * 2, i / R)
    w.on(a, y, -inset, P)
  })
}
// the rubber seal round it
export function sealGeometry(w, r = 0.011) {
  const pts = Array.from({ length: 120 }, (_, j) => {
    const [a, y] = sePoint(w, (j / 120) * Math.PI * 2, 1, 0.004)
    return w.on(a, y, 0.002)
  })
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 240, r, 8, true)
}

// ---------------------------------------------------------------- the cab opening
// One opening each side, from behind the cowl to the rear body: the sill at
// the bottom, cut up through the belt; above the belt the canopy is open from
// the windscreen pillar back to the same rear edge.
export const xA = (y) => canXf(y) + 0.19 // the back edge of the windscreen pillar
export const OPEN_TOP = 1.585
const R_OPEN = 0.09
const R_TOP = 0.07
export function insideOpening(x, y) {
  const [x0, x1] = OPEN
  if (x < x0 || x > x1 || y < SILL) return false
  if (y < SILL + R_OPEN) {
    if (x < x0 + R_OPEN) return Math.hypot(x - x0 - R_OPEN, y - SILL - R_OPEN) < R_OPEN
    if (x > x1 - R_OPEN) return Math.hypot(x - x1 + R_OPEN, y - SILL - R_OPEN) < R_OPEN
  }
  return true
}
export function insideCanopyOpening(x, y) {
  const x0 = xA(y)
  const x1 = OPEN[1]
  if (x < x0 || x > x1 || y > OPEN_TOP) return false
  if (y > OPEN_TOP - R_TOP) {
    if (x < x0 + R_TOP) return Math.hypot(x - x0 - R_TOP, y - OPEN_TOP + R_TOP) < R_TOP
    if (x > x1 - R_TOP) return Math.hypot(x - x1 + R_TOP, y - OPEN_TOP + R_TOP) < R_TOP
  }
  return true
}
const arc = (cx, cy, r, a0, a1, n = 10) => Array.from({ length: n + 1 }, (_, i) => [cx + r * Math.cos(a0 + ((a1 - a0) * i) / n), cy + r * Math.sin(a0 + ((a1 - a0) * i) / n)])
// the edge beading round both openings, as tubes on the skin
export function edgeGeometry() {
  const [x0, x1] = OPEN
  const low = [[x0, BELT - 0.004], [x0, BELT - 0.2], ...arc(x0 + R_OPEN, SILL + R_OPEN, R_OPEN, Math.PI, Math.PI * 1.5), [0.9, SILL], [1.4, SILL], ...arc(x1 - R_OPEN, SILL + R_OPEN, R_OPEN, Math.PI * 1.5, Math.PI * 2), [x1, BELT - 0.2], [x1, BELT - 0.004]]
  const tub = new THREE.CatmullRomCurve3(low.map(([x, y]) => tubSide(x, y, 0.002)), false, 'catmullrom', 0.1)
  const high = [[xA(CAN_BOT), CAN_BOT], [xA(1.3), 1.3], ...arc(xA(OPEN_TOP - R_TOP) + R_TOP, OPEN_TOP - R_TOP, R_TOP, Math.PI, Math.PI / 2), [1.0, OPEN_TOP], [1.4, OPEN_TOP], ...arc(x1 - R_TOP, OPEN_TOP - R_TOP, R_TOP, Math.PI / 2, 0), [x1, 1.3], [x1, CAN_BOT]]
  const can = new THREE.CatmullRomCurve3(high.map(([x, y]) => canopySide(x, y, 0.002)), false, 'catmullrom', 0.1)
  // the hem along the bottom of the canvas, round to the middle of the back
  const o = canOutline(CAN_BOT)
  const u0 = uAt(o, x1)
  const hem = new THREE.CatmullRomCurve3(Array.from({ length: 40 }, (_, i) => {
    const col = column(o, u0 + ((1 - u0) * i) / 39)
    return new THREE.Vector3(col.x + col.nx * 0.004, CAN_BOT + 0.004, col.z + col.nz * 0.004)
  }))
  return {
    tub: new THREE.TubeGeometry(tub, 200, 0.013, 8, false),
    canopy: new THREE.TubeGeometry(can, 200, 0.012, 8, false),
    hem: new THREE.TubeGeometry(hem, 80, 0.011, 8, false),
  }
}

// ---------------------------------------------------------------- fenders
// The black flare round a rear wheel arch: an arc of a flat ring standing
// off the side, rounded on every edge.
export function flareGeometry() {
  const s = new THREE.Shape()
  const r0 = ARCH_R - 0.006
  const r1 = ARCH_R + 0.05
  const a0 = 0.22
  const a1 = Math.PI - 0.22
  s.absarc(0, 0, r1, a0, a1, false)
  s.absarc(0, 0, r0, a1, a0, true)
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.035, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 4, curveSegments: 64 })
  g.translate(0, 0, -0.02)
  return g
}
// The mudguard over the front wheel: a strip of a cylinder, its edges rolled.
export function mudguardGeometry() {
  const R = FRONT_WHEEL.r + 0.035
  const W = 0.15
  const N = 60
  const a0 = 0.3
  const a1 = Math.PI * 0.97
  const prof = [[-W / 2, 0.012], [-W / 2 + 0.01, 0], [W / 2 - 0.01, 0], [W / 2, 0.012]]
  return grid(N + 1, prof.length, (i, j, P) => {
    const a = a0 + ((a1 - a0) * i) / N
    const [z, dr] = prof[j]
    P.set(Math.cos(a) * (R - dr), Math.sin(a) * (R - dr), z)
  })
}

// ---------------------------------------------------------------- small parts
// a bent tube through points
export const bentTube = (pts, r, seg = 64, closed = false) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), closed, 'catmullrom', 0.2), seg, r, 10, closed)
// a coil spring between two heights on the y axis
export function springGeometry(r, wire, h, turns = 7) {
  const pts = Array.from({ length: turns * 24 + 1 }, (_, i) => {
    const a = (i / 24) * Math.PI * 2
    return new THREE.Vector3(Math.cos(a) * r, (i / (turns * 24)) * h, Math.sin(a) * r)
  })
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), turns * 40, wire, 8, false)
}
