import * as THREE from 'three'

// The shapes of a compact electric SUV (4.46 m long, 1.83 m wide, 1.62 m
// tall, 2.73 m wheelbase), built from numbers rather than loaded from a file.
// Units are metres. The car stands on y = 0 with its nose towards -x and its
// left side at +z.

export const FRONT_AXLE = -1.3
export const REAR_AXLE = 1.43
export const WHEEL_R = 0.358
export const WHEEL_W = 0.235
export const TRACK = 0.772 // half the distance between the wheel centres
export const ARCH_R = 0.405 // the opening in the body round each wheel

const lerp = (a, b, t) => a + (b - a) * t

// A monotone cubic through (x, y) points: smooth, and it never overshoots.
function curve(xs, ys) {
  const n = xs.length
  const d = []
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]))
  const m = [d[0]]
  for (let i = 1; i < n - 1; i++) m.push(d[i - 1] * d[i] <= 0 ? 0 : (2 * d[i - 1] * d[i]) / (d[i - 1] + d[i]))
  m.push(d[n - 2])
  return (x) => {
    if (x <= xs[0]) return ys[0]
    if (x >= xs[n - 1]) return ys[n - 1]
    let i = 0
    while (x > xs[i + 1]) i++
    const h = xs[i + 1] - xs[i]
    const t = (x - xs[i]) / h
    const t2 = t * t
    const t3 = t2 * t
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1]
  }
}

// ---------------------------------------------------------------- the body
// The body is one skin, described by rings that run right round the car, from
// the middle of the floor (b = 0) out to the sills, up the sides, across the
// bonnet and the glass, and in to the middle of the roof (b = 1). Each ring is
// a rounded rectangle in plan: where its front and rear ends are, its half
// width, how square its front and rear corners are, and how high it sits at
// the front, along the sides and at the rear. Between the rings everything is
// interpolated, so the bonnet, the screens and the roof all come from the
// same few rows of numbers.
//
//        b      front    rear    half   corner    height at
//               end      end     width  frt  rear  front  side   rear
const RINGS = [
  [0.0, -0.001, 0.001, 0.0005, 4.0, 4.0, 0.2, 0.2, 0.2], // middle of the floor
  [0.06, -2.0, 2.03, 0.8, 4.2, 4.6, 0.215, 0.195, 0.27],
  [0.09, -2.13, 2.16, 0.872, 4.2, 4.8, 0.235, 0.21, 0.3], // lower edge of the bumpers and sills
  [0.16, -2.222, 2.222, 0.912, 4.0, 5.0, 0.43, 0.45, 0.5],
  [0.24, -2.24, 2.23, 0.917, 4.0, 5.0, 0.66, 0.74, 0.8], // the widest line
  [0.31, -2.2, 2.215, 0.905, 3.8, 5.0, 0.9, 1.0, 1.06], // shoulder, and the leading edge of the bonnet
  [0.33, -2.13, 2.19, 0.886, 3.6, 4.8, 0.945, 1.035, 1.11],
  [0.39, -1.62, 2.165, 0.876, 3.2, 4.6, 1.03, 1.05, 1.135], // across the bonnet
  [0.46, -0.98, 2.13, 0.866, 3.0, 4.4, 1.095, 1.066, 1.165], // the base of the glass
  [0.53, -0.52, 2.04, 0.76, 3.0, 4.2, 1.33, 1.32, 1.36],
  [0.6, -0.1, 1.93, 0.655, 3.0, 4.0, 1.545, 1.575, 1.545], // the edge of the roof
  [0.63, 0.06, 1.86, 0.6, 3.0, 3.6, 1.585, 1.602, 1.572],
  [0.8, 0.55, 1.35, 0.32, 2.6, 2.8, 1.615, 1.62, 1.606],
  [1.0, 0.949, 0.951, 0.0005, 2.4, 2.4, 1.622, 1.622, 1.622], // middle of the roof
]
const col = (k) => curve(RINGS.map((r) => r[0]), RINGS.map((r) => r[k]))
const ring = { xf: col(1), xr: col(2), w: col(3), nf: col(4), nr: col(5), yf: col(6), ys: col(7), yr: col(8) }

// where each ring sits, for the paint: (front end, rear end, half width)
export const ringAt = (b) => ({ xf: ring.xf(b), xr: ring.xr(b), w: ring.w(b) })

// The columns of the skin are spaced evenly round the widest ring, so the
// corners get as many as the straights.
const COLS = 200
const turn = (() => {
  const shape = (a, n) => [Math.sign(Math.cos(a)) * Math.abs(Math.cos(a)) ** (2 / n), Math.sign(Math.sin(a)) * Math.abs(Math.sin(a)) ** (2 / n)]
  const FINE = 4000
  const run = [0]
  let last = shape(0, 4.5)
  for (let k = 1; k <= FINE; k++) {
    const q = shape((k / FINE) * Math.PI * 2, 4.5)
    run.push(run[k - 1] + Math.hypot((q[0] - last[0]) * 2.23, (q[1] - last[1]) * 0.917))
    last = q
  }
  const out = []
  for (let j = 0, k = 0; j <= COLS; j++) {
    const want = (j / COLS) * run[FINE]
    while (k < FINE - 1 && run[k + 1] < want) k++
    out.push(((k + (want - run[k]) / (run[k + 1] - run[k] || 1)) / FINE) * Math.PI * 2)
  }
  return out
})()
// the angle round the car at u (0 the nose, 0.25 the left side, 0.5 the tail)
const angle = (u) => {
  const f = (((u % 1) + 1) % 1) * COLS
  const j = Math.min(COLS - 1, Math.floor(f))
  return lerp(turn[j], turn[j + 1], f - j)
}

// the point of the skin at (u round the car, b up the car)
export function body(u, b, out = new THREE.Vector3()) {
  const a = angle(u)
  const cs = Math.cos(a)
  const sn = Math.sin(a)
  const n = cs > 0 ? ring.nf(b) : ring.nr(b)
  const c = Math.sign(cs) * Math.abs(cs) ** (2 / n)
  const s = Math.sign(sn) * Math.abs(sn) ** (2 / n)
  const xf = ring.xf(b)
  const xr = ring.xr(b)
  const ys = ring.ys(b)
  // the ring dips (or climbs) towards its ends: gently at first, then quickly
  const y = c > 0 ? ys + (ring.yf(b) - ys) * c ** 2.5 : ys + (ring.yr(b) - ys) * (-c) ** 3
  return out.set((xf + xr) / 2 - (c * (xr - xf)) / 2, y, s * ring.w(b))
}

export function bodyGeometry() {
  const ROWS = 150
  const nv = COLS + 1
  const pos = new Float32Array((ROWS + 1) * nv * 3)
  const uv = new Float32Array((ROWS + 1) * nv * 2)
  const lvl = new Float32Array((ROWS + 1) * nv * 3)
  const P = new THREE.Vector3()
  for (let i = 0; i <= ROWS; i++) {
    const b = i / ROWS
    const r = ringAt(b)
    for (let j = 0; j < nv; j++) {
      const k = i * nv + j
      body(j / COLS, b, P)
      pos.set([P.x, P.y, P.z], k * 3)
      uv.set([j / COLS, b], k * 2)
      lvl.set([r.xf, r.xr, r.w], k * 3)
    }
  }
  const idx = []
  for (let i = 0; i < ROWS; i++)
    for (let j = 0; j < COLS; j++) {
      const a = i * nv + j
      const b = a + nv
      idx.push(a, a + 1, b, b, a + 1, b + 1)
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  g.setAttribute('lvl', new THREE.BufferAttribute(lvl, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  // join the normals down the seam at the nose
  const nrm = g.attributes.normal
  const A = new THREE.Vector3()
  const B = new THREE.Vector3()
  for (let i = 0; i <= ROWS; i++) {
    const a = i * nv
    const b = a + COLS
    A.fromBufferAttribute(nrm, a)
    B.fromBufferAttribute(nrm, b)
    A.add(B).normalize()
    nrm.setXYZ(a, A.x, A.y, A.z)
    nrm.setXYZ(b, A.x, A.y, A.z)
  }
  return g
}

// how far forward the nose is at height y, and how far back the tail
const solve = (f, y, b0, b1) => {
  let lo = b0
  let hi = b1
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2
    if (f(mid) < y) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}
export const noseX = (y) => ring.xf(solve(ring.yf, y, 0.09, 0.33))
export const tailX = (y) => ring.xr(solve(ring.yr, y, 0.09, 0.46))
// the skin on the left side at station x, on ring b
export function sidePoint(x, b) {
  let lo = 0.02
  let hi = 0.48
  const P = new THREE.Vector3()
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2
    if (body(mid, b, P).x < x) lo = mid
    else hi = mid
  }
  return body((lo + hi) / 2, b, P)
}

// the rail along the edge of the roof, on the left
export function railGeometry() {
  const pts = []
  for (let k = 0; k <= 24; k++) {
    const p = sidePoint(lerp(0.12, 1.74, k / 24), 0.632)
    const lift = 0.03 * Math.sin((Math.PI * k) / 24) ** 0.35
    pts.push(new THREE.Vector3(p.x, p.y + 0.004 + lift, p.z - 0.035))
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 64, 0.013, 10, false)
}

// ---------------------------------------------------------------- wheels
// A surface of revolution about the z axis from [z, r] points, travelling so
// that the visible side is on the left.
function revolve(pts, seg = 72) {
  const n = pts.length
  const nv = seg + 1
  const pos = new Float32Array(n * nv * 3)
  const nrm = new Float32Array(n * nv * 3)
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)]
    const b = pts[Math.min(n - 1, i + 1)]
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
    const tz = (b[0] - a[0]) / l
    const tr = (b[1] - a[1]) / l
    for (let j = 0; j < nv; j++) {
      const f = (j / seg) * Math.PI * 2
      const k = (i * nv + j) * 3
      pos.set([pts[i][1] * Math.cos(f), pts[i][1] * Math.sin(f), pts[i][0]], k)
      nrm.set([tz * Math.cos(f), tz * Math.sin(f), -tr], k)
    }
  }
  const idx = []
  for (let i = 0; i < n - 1; i++)
    for (let j = 0; j < seg; j++) {
      const a = i * nv + j
      const b = a + nv
      idx.push(a, a + 1, b, b, a + 1, b + 1)
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3))
  g.setIndex(idx)
  return g
}

const RIM = 0.262 // a 20 inch wheel

// the tyre: flat sidewalls, round shoulders, four grooves in the tread
export function tyreGeometry() {
  const pts = []
  const N = 96
  for (let k = 0; k <= N; k++) {
    const t = -1 + (2 * k) / N
    const a = Math.abs(t)
    let r = RIM + (WHEEL_R - RIM) * (1 - a ** 4.5) ** (1 / 4.5)
    for (const at of [0.16, 0.45]) r -= 0.007 * Math.exp(-(((a - at) / 0.03) ** 2))
    pts.push([(t * WHEEL_W) / 2, Math.max(RIM, r)])
  }
  return revolve(pts)
}

// the barrel of the rim, seen through the spokes, and the lip round its edge
export function barrelGeometry() {
  const o = WHEEL_W / 2
  return revolve([
    [o - 0.012, RIM],
    [o - 0.004, RIM - 0.008],
    [o - 0.03, RIM - 0.016],
    [-o + 0.03, RIM - 0.02],
    [-o + 0.03, 0.05],
  ])
}

// the face of the wheel: five pairs of spokes cut from a disc
export function spokeGeometry() {
  const K = RIM / 0.238 // the pattern was drawn for a smaller wheel
  const shape = new THREE.Shape()
  shape.absarc(0, 0, RIM - 0.006, 0, Math.PI * 2, false)
  const polar = (r, deg) => new THREE.Vector2(r * K * Math.cos((deg * Math.PI) / 180), r * K * Math.sin((deg * Math.PI) / 180))
  const cut = (pts) => shape.holes.push(new THREE.Path(pts))
  for (let k = 0; k < 5; k++) {
    const mid = k * 72 + 36
    // the window between two pairs
    const win = []
    for (let i = 0; i <= 8; i++) win.push(polar(0.207, mid - 25 + (50 * i) / 8))
    win.push(polar(0.17, mid + 22.5), polar(0.105, mid + 13))
    for (let i = 0; i <= 4; i++) win.push(polar(0.084, mid + 9 - (18 * i) / 4))
    win.push(polar(0.105, mid - 13), polar(0.17, mid - 22.5))
    cut(win)
    // the slot that splits a spoke in two
    const at = k * 72
    cut([polar(0.207, at - 4.2), polar(0.207, at + 4.2), polar(0.16, at + 3.6), polar(0.108, at + 1.6), polar(0.108, at - 1.6), polar(0.16, at - 3.6)])
  }
  const g = new THREE.ExtrudeGeometry(shape, { depth: 0.016, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.0035, bevelSegments: 2, curveSegments: 64 })
  g.translate(0, 0, WHEEL_W / 2 - 0.034)
  return g
}
