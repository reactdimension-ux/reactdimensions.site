import * as THREE from 'three'

// The circuit itself: one closed racing line through a handful of control
// points, sampled every couple of metres. Everything in the world (asphalt,
// kerbs, gravel, barriers, the ground, the trees, the cars) is placed from
// these samples, so moving a control point moves the whole venue with it.
//
// Units are metres. x runs along the pit straight, z towards the default
// camera. The lap runs anticlockwise seen from above, so "left" (the +n side)
// is always the infield and "right" is always the outside of the circuit.

export const W = 12
export const HALF = W / 2
export const N = 800

const PTS = [
  [-100, 78], [-20, 78], [40, 78], [100, 78], // pit straight
  [150, 62], [168, 22], [150, -14], // turn 1, a long left
  [108, -20], [82, -8], [50, 0], [18, -6], [-2, -19], [-3, -40], [24, -57], // infield loop
  [84, -71], [140, -78], [167, -88], [173, -108], [152, -129], // hairpin
  [95, -134], [0, -132], [-90, -128], // back straight
  [-150, -104], [-178, -60], [-178, -22], [-167, 6], [-176, 34], [-166, 62], [-140, 77], // sweep, flick, last corner
]

// The pit complex sits inside the pit straight (which runs along +x at z = 78).
export const PIT = { x0: -66, x1: 42, bays: 12, lane: 64.5, laneW: 8, wall: 70.4, front: 51.2, back: 40 }
export const POND = { x: -92, z: -52, r: 26 }
export const HELI = { x: -34, z: -94, r: 8 }
export const WORLD = { x: 924, z: 840 }

export const sstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
export const hash = (x, z) => {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453
  return s - Math.floor(s)
}
export function noise(x, z) {
  const xi = Math.floor(x)
  const zi = Math.floor(z)
  const xf = x - xi
  const zf = z - zi
  const u = xf * xf * (3 - 2 * xf)
  const v = zf * zf * (3 - 2 * zf)
  const a = hash(xi, zi)
  const b = hash(xi + 1, zi)
  const c = hash(xi, zi + 1)
  const d = hash(xi + 1, zi + 1)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}
export const fbm = (x, z) => 0.5 * noise(x, z) + 0.25 * noise(x * 2.03 + 7, z * 2.03 + 3) + 0.125 * noise(x * 4.1 + 1, z * 4.1 + 9) + 0.0625 * noise(x * 8.2, z * 8.2)

export const wrap = (i) => ((i % N) + N) % N

function smooth(a, r) {
  const out = new Float32Array(N)
  for (let i = 0; i < N; i++) {
    let s = 0
    for (let k = -r; k <= r; k++) s += a[wrap(i + k)]
    out[i] = s / (2 * r + 1)
  }
  return out
}

// Builds a closed track from control points [x, z]. Options:
//   start    [x, z] the start line is the sample nearest this point (default: first point)
//   pitZone  (x, z) => bool, true where a pit lane replaces the infield barrier
//   stands   [[x, z, length, rows, roof], ...] grandstands facing the track
export function makeTrack(PTS, { start = PTS[0], pitZone = null, stands = [] } = {}) {
  const curve = new THREE.CatmullRomCurve3(PTS.map(([x, z]) => new THREE.Vector3(x, 0, z)), true, 'centripetal')
  curve.arcLengthDivisions = 6000
  const raw = curve.getSpacedPoints(N)
  const length = curve.getLength()
  const ds = length / N
  // sample 0 is the start line
  let s0 = 0
  let best = 1e9
  for (let i = 0; i < N; i++) {
    const d = (raw[i].x - start[0]) ** 2 + (raw[i].z - start[1]) ** 2
    if (d < best) (best = d), (s0 = i)
  }
  const px = new Float32Array(N)
  const pz = new Float32Array(N)
  const tx = new Float32Array(N)
  const tz = new Float32Array(N)
  const nx = new Float32Array(N)
  const nz = new Float32Array(N)
  for (let i = 0; i < N; i++) {
    px[i] = raw[(i + s0) % N].x
    pz[i] = raw[(i + s0) % N].z
  }
  for (let i = 0; i < N; i++) {
    const a = wrap(i - 1)
    const b = wrap(i + 1)
    const dx = px[b] - px[a]
    const dz = pz[b] - pz[a]
    const l = Math.hypot(dx, dz)
    tx[i] = dx / l
    tz[i] = dz / l
    nx[i] = tz[i] // left of travel
    nz[i] = -tx[i]
  }
  // signed curvature, positive turning left
  const kRaw = new Float32Array(N)
  for (let i = 0; i < N; i++) {
    const a = wrap(i - 1)
    const b = wrap(i + 1)
    kRaw[i] = (tz[a] * tx[b] - tx[a] * tz[b]) / (2 * ds)
  }
  const k = smooth(kRaw, 3)
  const kWide = smooth(smooth(kRaw, 14), 14)

  // gravel traps on the outside of the corners, and the barrier beyond them
  const gL = new Float32Array(N)
  const gR = new Float32Array(N)
  for (let i = 0; i < N; i++) {
    gR[i] = 13 * sstep(0.006, 0.016, kWide[i])
    gL[i] = 13 * sstep(0.006, 0.016, -kWide[i])
  }
  const bL = smooth(gL.map((g) => HALF + 5.5 + g), 4)
  const bR = smooth(gR.map((g) => HALF + 5.5 + g), 4)

  // the racing line: out wide before a corner, in to the apex, out again
  const kMid = smooth(kRaw, 10)
  const kFar = smooth(smooth(kRaw, 40), 40)
  const line = smooth(
    kMid.map((v, i) => Math.max(-1, Math.min(1, (v - 0.75 * kFar[i]) * 420)) * (HALF - 1.9)),
    6,
  )

  // how fast a car can take each sample: grip in the corners, then limited
  // by how hard it can brake into them and accelerate out
  const v = new Float32Array(N)
  for (let i = 0; i < N; i++) v[i] = Math.min(46, Math.sqrt(15 / Math.max(1e-4, Math.abs(k[i]) * 0.8)))
  for (let i = 0; i < 2 * N; i++) v[wrap(i + 1)] = Math.min(v[wrap(i + 1)], Math.sqrt(v[wrap(i)] ** 2 + 2 * 6.5 * ds))
  for (let i = 2 * N; i > 0; i--) v[wrap(i - 1)] = Math.min(v[wrap(i - 1)], Math.sqrt(v[wrap(i)] ** 2 + 2 * 13 * ds))
  const tAt = new Float32Array(N + 1)
  for (let i = 0; i < N; i++) tAt[i + 1] = tAt[i] + ds / ((v[i] + v[wrap(i + 1)]) / 2)
  const lap = tAt[N]

  const T = { px, pz, tx, tz, nx, nz, k, line, gL, gR, bL, bR, v, length, ds, lap }

  // a point (and its frame) at a fractional sample, pushed sideways by off
  T.sample = (u, off = 0, out = {}) => {
    const i0 = Math.floor(u)
    const f = u - i0
    const a = wrap(i0)
    const b = wrap(i0 + 1)
    out.tx = tx[a] + (tx[b] - tx[a]) * f
    out.tz = tz[a] + (tz[b] - tz[a]) * f
    out.nx = out.tz
    out.nz = -out.tx
    out.x = px[a] + (px[b] - px[a]) * f + out.nx * off
    out.z = pz[a] + (pz[b] - pz[a]) * f + out.nz * off
    return out
  }
  T.lineAt = (u) => {
    const i0 = Math.floor(u)
    const a = wrap(i0)
    return line[a] + (line[wrap(i0 + 1)] - line[a]) * (u - i0)
  }
  // where along the lap a car is after t seconds
  T.uAt = (t) => {
    const s = ((t % lap) + lap) % lap
    let lo = 0
    let hi = N
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1
      if (tAt[m] <= s) lo = m
      else hi = m
    }
    return lo + (s - tAt[lo]) / (tAt[lo + 1] - tAt[lo])
  }
  // the nearest sample, the distance to it and which side of the track
  T.nearest = (x, z) => {
    let bi = 0
    let bd = 1e12
    for (let i = 0; i < N; i++) {
      const dx = x - px[i]
      const dz = z - pz[i]
      const d = dx * dx + dz * dz
      if (d < bd) (bd = d), (bi = i)
    }
    return { i: bi, d: Math.sqrt(bd), lat: (x - px[bi]) * nx[bi] + (z - pz[bi]) * nz[bi] }
  }
  T.inside = (x, z) => {
    let c = false
    for (let i = 0, j = N - 2; i < N; j = i, i += 2) {
      if (pz[i] > z !== pz[j] > z && x < ((px[j] - px[i]) * (z - pz[i])) / (pz[j] - pz[i]) + px[i]) c = !c
    }
    return c
  }
  // true along the pit straight, where the pit lane replaces the infield barrier
  T.pitZone = (i) => (pitZone ? pitZone(px[i], pz[i]) : false)

  // grandstands, each facing the track from outside the barrier
  T.stands = stands.map(([x, z, len, rows, roof]) => {
    const q = T.nearest(x, z)
    const depth = rows * 0.9 + 1.5
    const off = -(bR[q.i] + 7 + depth / 2)
    return { i: q.i, x: px[q.i] + nx[q.i] * off, z: pz[q.i] + nz[q.i] * off, rot: Math.atan2(tz[q.i], -tx[q.i]), len, rows, roof, depth }
  })
  return T
}

export const TRACK = makeTrack(PTS, {
  start: [40, 78],
  pitZone: (x, z) => z > 60 && x > -150 && x < 122,
  stands: [
    [-52, 78, 48, 12, false],
    [4, 78, 48, 13, true],
    [60, 78, 48, 12, false],
    [-45, -130, 60, 10, false],
    [168, 22, 40, 9, false],
    [172, -100, 36, 9, false],
    [-178, 30, 36, 8, false],
  ],
})

// Ground that has to stay level: under the pits and paddock, the main stands
// and their car park, each of the other stands and the helipad.
const RECTS = [
  [-142, 12, 120, 73],
  [-84, 90, 118, 166],
]
const DISCS = [...TRACK.stands.map((s) => [s.x, s.z, s.len / 2 + 10]), [HELI.x - 8, HELI.z, 22]]

export function padDist(x, z) {
  let d = 1e9
  for (const [x0, z0, x1, z1] of RECTS) d = Math.min(d, Math.hypot(Math.max(x0 - x, 0, x - x1), Math.max(z0 - z, 0, z - z1)))
  for (const [cx, cz, r] of DISCS) d = Math.min(d, Math.max(0, Math.hypot(x - cx, z - cz) - r))
  return d
}

// The one ground truth for the terrain mesh and everything standing on it:
// level along the track, rolling a little in the infield, climbing to hills
// outside so the venue sits in a bowl.
export function groundAt(x, z) {
  const q = TRACK.nearest(x, z)
  const c = q.d - (q.lat > 0 ? TRACK.bL[q.i] : TRACK.bR[q.i]) // metres beyond the barrier
  const pad = padDist(x, z)
  const level = sstep(2, 30, pad)
  const out = !TRACK.inside(x, z)
  let y = -0.3 + 0.24 * sstep(0.5, 3, c)
  y += (noise(x * 0.09, z * 0.09) - 0.5) * 1.1 * sstep(3, 16, c) * sstep(1, 10, pad)
  if (out) y += sstep(24, 200, c) * level * (6 + 46 * fbm(x * 0.0055 + 3, z * 0.0055 + 8))
  else y += sstep(14, 70, c) * level * 3 * fbm(x * 0.012 + 5, z * 0.012 + 2)
  const dp = Math.hypot(x - POND.x, z - POND.z)
  const dip = 1 - sstep(POND.r - 12, POND.r + 4, dp)
  y = y * (1 - dip) - 2.4 * dip
  // fall away to the haze at the edge of the world
  const e = sstep(0.84, 1, Math.max(Math.abs(x) / (WORLD.x / 2), Math.abs(z) / (WORLD.z / 2)))
  y = y * (1 - e) - 8 * e
  return { y, c, pad, out, i: q.i, pond: dp }
}

// Collects flat-shaded, vertex-coloured geometry: quads, boxes turned about
// y, ribbons that follow the track, extrusions and any three.js primitive.
export function mesher(trk = TRACK) {
  const P = []
  const C = []
  const I = []
  const tmp = new THREE.Color()
  const out = new THREE.Color()
  let n = 0
  const col = (c) => (c && c.isColor ? c : tmp.set(c))
  const v = (x, y, z, c) => (P.push(x, y, z), C.push(c.r, c.g, c.b), n++)
  const M = {
    tri(a, b, c, color) {
      const k = col(color)
      const i = v(a[0], a[1], a[2], k)
      v(b[0], b[1], b[2], k)
      v(c[0], c[1], c[2], k)
      I.push(i, i + 1, i + 2)
    },
    quad(a, b, c, d, color) {
      const k = col(color)
      const i = v(a[0], a[1], a[2], k)
      v(b[0], b[1], b[2], k)
      v(c[0], c[1], c[2], k)
      v(d[0], d[1], d[2], k)
      I.push(i, i + 1, i + 2, i, i + 2, i + 3)
    },
    // a level rectangle facing up
    rect(x0, z0, x1, z1, y, color) {
      M.quad([x0, y, z0], [x0, y, z1], [x1, y, z1], [x1, y, z0], color)
    },
    // a box standing on (x, y, z), turned rot about y; top scales its lid for tapers
    box(x, y, z, sx, sy, sz, rot, color, top = [1, 1]) {
      const cs = Math.cos(rot)
      const sn = Math.sin(rot)
      const k = col(color)
      const b = []
      const t = []
      for (const [ax, az] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const lx = (ax * sx) / 2
        const lz = (az * sz) / 2
        b.push([x + lx * cs + lz * sn, y, z - lx * sn + lz * cs])
        t.push([x + lx * top[0] * cs + lz * top[1] * sn, y + sy, z - lx * top[0] * sn + lz * top[1] * cs])
      }
      for (let j = 0; j < 4; j++) M.quad(b[(j + 1) % 4], b[j], t[j], t[(j + 1) % 4], k)
      M.quad(t[0], t[3], t[2], t[1], k)
    },
    // a strip along the track from sample a to b; prof(i) lists [offset, y]
    // stations from right to left, color is a colour or (i, j, out) => void
    ribbon(a, b, prof, color) {
      const fn = typeof color === 'function'
      const k = fn ? out : col(color)
      let prev = -1
      for (let i = a; i <= b; i++) {
        const q = wrap(i)
        const st = prof(q)
        const row = n
        for (let j = 0; j < st.length; j++) {
          if (fn) color(q, j, out)
          v(trk.px[q] + trk.nx[q] * st[j][0], st[j][1], trk.pz[q] + trk.nz[q] * st[j][0], k)
        }
        if (prev >= 0) for (let j = 0; j < st.length - 1; j++) I.push(prev + j, row + j, prev + j + 1, prev + j + 1, row + j, row + j + 1)
        prev = row
      }
    },
    // a level strip of a given width along any list of Vector3 points
    path(pts, width, y, color) {
      const k = col(color)
      let prev = -1
      pts.forEach((p, i) => {
        const a = pts[Math.max(0, i - 1)]
        const b = pts[Math.min(pts.length - 1, i + 1)]
        const l = Math.hypot(b.x - a.x, b.z - a.z)
        const lx = ((b.z - a.z) / l) * (width / 2)
        const lz = (-(b.x - a.x) / l) * (width / 2)
        const row = v(p.x - lx, y, p.z - lz, k)
        v(p.x + lx, y, p.z + lz, k)
        if (prev >= 0) I.push(prev, row, prev + 1, prev + 1, row, row + 1)
        prev = row
      })
    },
    // a convex outline in x-y (anticlockwise seen from +z) pulled from z0 to z1
    extrude(prof, z0, z1, color) {
      const k = col(color)
      const m = prof.length
      for (let j = 0; j < m; j++) {
        const a = prof[j]
        const b = prof[(j + 1) % m]
        M.quad([a[0], a[1], z1], [a[0], a[1], z0], [b[0], b[1], z0], [b[0], b[1], z1], k)
      }
      for (let j = 1; j < m - 1; j++) {
        M.tri([prof[0][0], prof[0][1], z1], [prof[j][0], prof[j][1], z1], [prof[j + 1][0], prof[j + 1][1], z1], k)
        M.tri([prof[0][0], prof[0][1], z0], [prof[j + 1][0], prof[j + 1][1], z0], [prof[j][0], prof[j][1], z0], k)
      }
    },
    // any three.js geometry, moved by a Matrix4 and painted one colour
    merge(g, m, color) {
      const k = col(color)
      const p = g.attributes.position
      const base = n
      const q = new THREE.Vector3()
      for (let i = 0; i < p.count; i++) {
        q.fromBufferAttribute(p, i)
        if (m) q.applyMatrix4(m)
        v(q.x, q.y, q.z, k)
      }
      if (g.index) for (let i = 0; i < g.index.count; i++) I.push(base + g.index.getX(i))
      else for (let i = 0; i < p.count; i++) I.push(base + i)
      g.dispose()
    },
    build() {
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3))
      g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3))
      g.setIndex(I)
      g.computeVertexNormals()
      g.computeBoundingSphere()
      return g
    },
  }
  return M
}
