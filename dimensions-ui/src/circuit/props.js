import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { facet, rng } from '../lowpoly/kit.jsx'
import { HALF, HELI, N, PIT, TRACK as T, WORLD, fbm, groundAt, hash, mesher, noise, sstep, wrap } from './track.js'

// Everything built on the circuit: the ground, the painted surfaces, and the
// venue that stands on them. Each builder returns merged, vertex-coloured
// geometry (plus lists of things the scene instances: people, tyres).

export const TEAMS = ['#e23b2e', '#1f6fd6', '#f2b316', '#17a865', '#f26a1b', '#8c3fd1']
export const CROWD = ['#e8483c', '#2f7fe0', '#f4c531', '#f3f1ec', '#31b06a', '#f07d2a', '#3a3f4a', '#d85aa0', '#7fc4ee']
const WHITE = '#efece6'
const GLASS = '#1b2a3a'

// ---------------------------------------------------------------- ground

export function buildGround() {
  const NX = 132
  const NZ = 120
  const H = new Float32Array((NX + 1) * (NZ + 1))
  for (let j = 0; j <= NZ; j++)
    for (let i = 0; i <= NX; i++) H[j * (NX + 1) + i] = groundAt(-WORLD.x / 2 + (i * WORLD.x) / NX, -WORLD.z / 2 + (j * WORLD.z) / NZ).y
  const pos = new Float32Array(NX * NZ * 18)
  const col = new Float32Array(NX * NZ * 18)
  const A = new THREE.Color('#5a9a3b')
  const B = new THREE.Color('#7ab648')
  const D = new THREE.Color('#aebb5c')
  const R = new THREE.Color('#8b8a68')
  const MUD = new THREE.Color('#6f7350')
  const c = new THREE.Color()
  const r = rng(7)
  let o = 0
  // one flat-coloured triangle, tinted by where it lies and how steep it is
  const tri = (ax, ay, az, bx, by, bz, cx, cy, cz) => {
    const ux = bx - ax
    const uy = by - ay
    const uz = bz - az
    const vx = cx - ax
    const vy = cy - ay
    const vz = cz - az
    const nx = uy * vz - uz * vy
    const ny = uz * vx - ux * vz
    const nz = ux * vy - uy * vx
    const up = ny / Math.hypot(nx, ny, nz)
    const mx = (ax + bx + cx) / 3
    const my = (ay + by + cy) / 3
    const mz = (az + bz + cz) / 3
    c.copy(A)
      .lerp(B, fbm(mx * 0.02, mz * 0.02))
      .lerp(D, 0.75 * sstep(0.55, 0.8, noise(mx * 0.011 + 40, mz * 0.011 + 13)))
      .lerp(R, sstep(0.95, 0.8, up))
      .lerp(MUD, sstep(-0.5, -1.2, my) * (my > -4 ? 1 : 0))
      .multiplyScalar(0.92 + r() * 0.16)
    for (const p of [ax, ay, az, bx, by, bz, cx, cy, cz]) pos[o++] = p
    for (let k = 0; k < 3; k++) col.set([c.r, c.g, c.b], o - 9 + k * 3)
  }
  for (let j = 0; j < NZ; j++)
    for (let i = 0; i < NX; i++) {
      const x0 = -WORLD.x / 2 + (i * WORLD.x) / NX
      const x1 = x0 + WORLD.x / NX
      const z0 = -WORLD.z / 2 + (j * WORLD.z) / NZ
      const z1 = z0 + WORLD.z / NZ
      const a = H[j * (NX + 1) + i]
      const b = H[j * (NX + 1) + i + 1]
      const d = H[(j + 1) * (NX + 1) + i]
      const e = H[(j + 1) * (NX + 1) + i + 1]
      if ((i + j) % 2) {
        tri(x0, a, z0, x0, d, z1, x1, b, z0)
        tri(x1, b, z0, x0, d, z1, x1, e, z1)
      } else {
        tri(x0, a, z0, x0, d, z1, x1, e, z1)
        tri(x0, a, z0, x1, e, z1, x1, b, z0)
      }
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  g.computeVertexNormals()
  return g
}

// ---------------------------------------------------------------- surfaces

// Asphalt with a rubbered-in racing line, edge lines, kerbs, gravel traps,
// mown verges, the grid, the pit lane and the paved areas. Nothing here casts
// a shadow; it is all layered a few centimetres apart.
export function buildFlat() {
  const M = mesher()
  const { k, line, gL, gR, bL, bR } = T

  // verges, mown in stripes
  for (let i = 0; i < N; i += 4) {
    const c = (i / 4) % 2 ? '#69a741' : '#76b54a'
    M.ribbon(i, i + 4, (q) => [[HALF - 0.3, -0.02], [bL[q] + 1.6, -0.02]], c)
    M.ribbon(i, i + 4, (q) => [[-(bR[q] + 1.6), -0.02], [-(HALF - 0.3), -0.02]], c)
  }
  // gravel on the outside of the corners
  for (let i = 0; i < N; i += 2)
    for (const s of [1, -1]) {
      const g = s > 0 ? gL : gR
      if (g[i] < 0.5 && g[wrap(i + 2)] < 0.5) continue
      const a = HALF + 1.1
      M.ribbon(i, i + 2, (q) => (s > 0 ? [[a, 0], [a + g[q], 0]] : [[-(a + g[q]), 0], [-a, 0]]), (i / 2) % 2 ? '#dccb99' : '#d2be89')
    }
  // the road, darker where the cars lay rubber
  const base = new THREE.Color('#57525c')
  const rub = new THREE.Color('#2c2a31')
  const edge = new THREE.Color('#6a646d')
  const offs = [-6, -4.5, -3, -1.5, 0, 1.5, 3, 4.5, 6]
  const road = offs.map((o) => [o, 0.03])
  M.ribbon(0, N, () => road, (q, j, out) => {
    const r = Math.exp(-(((offs[j] - line[q]) / 1.8) ** 2))
    out.copy(base).lerp(edge, (Math.abs(offs[j]) / 6) * 0.6).lerp(rub, r * 0.62).multiplyScalar(0.94 + 0.12 * hash(q, j))
  })
  M.ribbon(0, N, () => [[HALF - 0.5, 0.05], [HALF - 0.2, 0.05]], WHITE)
  M.ribbon(0, N, () => [[-(HALF - 0.2), 0.05], [-(HALF - 0.5), 0.05]], WHITE)

  // red and white kerbs through every corner
  const mask = new Uint8Array(N)
  for (let i = 0; i < N; i++) if (Math.abs(k[i]) > 0.008) for (let d = -3; d <= 3; d++) mask[wrap(i + d)] = 1
  for (let i = 0; i < N; i += 2) {
    if (!mask[i]) continue
    const c = (i / 2) % 2 ? '#d93a30' : '#f0ede7'
    M.ribbon(i, i + 2, () => [[HALF - 0.1, 0.04], [HALF + 0.7, 0.15], [HALF + 1.15, 0.01]], c)
    M.ribbon(i, i + 2, () => [[-(HALF + 1.15), 0.01], [-(HALF + 0.7), 0.15], [-(HALF - 0.1), 0.04]], c)
  }

  // a painted mark on the road: `along` metres past sample u, `off` to the left
  const P = {}
  const mark = (u, off, along, len, wid, color, y = 0.056) => {
    T.sample(u, off, P)
    const cx = P.x + P.tx * along
    const cz = P.z + P.tz * along
    const ax = (P.tx * len) / 2
    const az = (P.tz * len) / 2
    const bx = (P.nx * wid) / 2
    const bz = (P.nz * wid) / 2
    M.quad([cx - ax - bx, y, cz - az - bz], [cx + ax - bx, y, cz + az - bz], [cx + ax + bx, y, cz + az + bz], [cx - ax + bx, y, cz - az + bz], color)
  }
  // chequered start line and the grid behind it
  for (let r = 0; r < 2; r++) for (let c = 0; c < 12; c++) mark(0, -5.5 + c, r - 0.5, 1, 1, (r + c) % 2 ? '#f2f0ea' : '#1c1c20')
  for (let g = 0; g < 12; g++) {
    const d = -(7 + g * 7.5)
    const o = g % 2 ? -2.7 : 2.7
    mark(0, o, d, 0.25, 2.6, WHITE)
    mark(0, o - 1.3, d - 0.9, 1.8, 0.2, WHITE)
    mark(0, o + 1.3, d - 0.9, 1.8, 0.2, WHITE)
  }

  // pit lane, peeling off after the last corner and rejoining before turn 1
  const lane = new THREE.CatmullRomCurve3(
    [[-134, 75], [-116, 70.6], [-98, 65.6], [-84, PIT.lane], [60, PIT.lane], [74, 65.6], [92, 70.6], [110, 75.5]].map(([x, z]) => new THREE.Vector3(x, 0, z)),
    false,
    'centripetal',
  ).getSpacedPoints(110)
  M.path(lane, PIT.laneW, 0.042, '#625e68')
  M.rect(PIT.x0 - 4, PIT.front, PIT.x1 + 16, 60.5, 0.036, '#98948e') // garage apron
  M.rect(-84, 68.3, 60, 68.5, 0.058, WHITE)
  M.rect(-84, 60.5, 60, 60.68, 0.058, WHITE)
  M.rect(-84.3, 60.5, -84, 68.5, 0.058, WHITE)
  M.rect(60, 60.5, 60.3, 68.5, 0.058, WHITE)
  const bw = (PIT.x1 - PIT.x0) / PIT.bays
  for (let b = 0; b < PIT.bays; b++) {
    const cx = PIT.x0 + (b + 0.5) * bw
    const Y = '#e8c21d'
    M.rect(cx - 3.4, 60.9, cx + 3.4, 61.05, 0.058, Y)
    M.rect(cx - 3.4, 63.6, cx + 3.4, 63.75, 0.058, Y)
    M.rect(cx - 3.4, 60.9, cx - 3.25, 63.75, 0.058, Y)
    M.rect(cx + 3.25, 60.9, cx + 3.4, 63.75, 0.058, Y)
  }
  // paddock behind the garages, and the public car park behind the stands
  M.rect(-70, 26, 58, PIT.back, 0.02, '#5c5961')
  M.rect(-66, 121, 100, 159, 0.02, '#5c5961')
  for (const z of [123.5, 134.5, 140.1, 151]) for (let x = -62; x <= 96.1; x += 2.9) M.rect(x - 0.07, z, x + 0.07, z + 5.4, 0.04, '#dedbd4')

  // helipad
  const disc = (r, y, c) => M.merge(new THREE.CircleGeometry(r, 20).rotateX(-Math.PI / 2), new THREE.Matrix4().makeTranslation(HELI.x, y, HELI.z), c)
  disc(HELI.r + 0.6, 0.0, '#e8c21d')
  disc(HELI.r, 0.02, '#77747a')
  M.rect(HELI.x - 2.6, HELI.z - 3.2, HELI.x - 1.6, HELI.z + 3.2, 0.04, WHITE)
  M.rect(HELI.x + 1.6, HELI.z - 3.2, HELI.x + 2.6, HELI.z + 3.2, 0.04, WHITE)
  M.rect(HELI.x - 1.6, HELI.z - 0.5, HELI.x + 1.6, HELI.z + 0.5, 0.04, WHITE)
  return M.build()
}

// ---------------------------------------------------------------- venue

// Sponsor boards share one texture atlas of invented brands, 4 across by 2 down.
const BRANDS = [
  ['VOLTA', '#f4c20d', '#17181c', 'italic 900'],
  ['APEX OIL', '#d92c26', '#ffffff', '900'],
  ['NORDIK', '#143a7a', '#ffffff', '800'],
  ['halo', '#f5f3ee', '#e2452a', 'italic 900'],
  ['KESTREL', '#16171b', '#f4c20d', '800'],
  ['ZENIT', '#18a567', '#ffffff', 'italic 900'],
  ['RAPIDO', '#f26a1b', '#16171b', '900'],
  ['DIMENSIONS', '#ffffff', '#1f6fd6', '800'],
]
export function boardTexture() {
  const cv = document.createElement('canvas')
  cv.width = 2048
  cv.height = 256
  const g = cv.getContext('2d')
  BRANDS.forEach(([name, bg, fg, weight], i) => {
    const x = (i % 4) * 512
    const y = Math.floor(i / 4) * 128
    g.fillStyle = bg
    g.fillRect(x, y, 512, 128)
    g.fillStyle = fg
    g.fillRect(x, y + 112, 512, 6)
    g.font = `${weight} 78px "Arial Black", "Helvetica Neue", Arial, sans-serif`
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText(name, x + 256, y + 60, 460)
  })
  const t = new THREE.CanvasTexture(cv)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

function boardMesher() {
  const P = []
  const U = []
  const I = []
  return {
    // a board from a to b ([x, z]); a is on the left of whoever reads it
    add(a, b, y0, y1, cell) {
      const n = P.length / 3
      const u0 = (cell % 4) / 4
      const v1 = 1 - Math.floor((cell % 8) / 4) / 2
      P.push(a[0], y0, a[1], b[0], y0, b[1], b[0], y1, b[1], a[0], y1, a[1])
      U.push(u0, v1 - 0.5, u0 + 0.25, v1 - 0.5, u0 + 0.25, v1, u0, v1)
      I.push(n, n + 1, n + 2, n, n + 2, n + 3)
    },
    build() {
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3))
      g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2))
      g.setIndex(I)
      g.computeVertexNormals()
      return g
    },
  }
}

export function stand(M, st, people, r, hue) {
  const { x, z, rot, len, rows, roof, depth } = st
  const cs = Math.cos(rot)
  const sn = Math.sin(rot)
  const at = (lx, lz) => [x + lx * cs + lz * sn, z - lx * sn + lz * cs]
  const front = depth / 2
  const top = 1.5 + rows * 0.5
  const [A, B] = hue
  for (let k = 0; k < rows; k++) {
    const lz = front - 1.2 - k * 0.9
    const h = 1.5 + k * 0.5
    const [wx, wz] = at(0, lz)
    M.box(wx, -0.4, wz, len, h + 0.4, 0.92, rot, k % 2 ? '#bdb9b2' : '#b1ada6')
    for (let s = 0; s < 6; s++) {
      const [sx, sz] = at(((s - 2.5) * len) / 6, lz + 0.12)
      M.box(sx, h, sz, len / 6 - 0.9, 0.14, 0.5, rot, s % 2 ? A : B)
    }
    for (let lx = -len / 2 + 0.7; lx < len / 2 - 0.6; lx += 0.72) {
      const aisle = Math.abs((((lx + len / 2) / (len / 6)) % 1) - 0.5) > 0.45
      if (aisle || r() > 0.82) continue
      const [qx, qz] = at(lx, lz - 0.05)
      people.push({ x: qx, y: h - 0.4, z: qz, rot: rot + (r() - 0.5) * 0.5, c: CROWD[Math.floor(r() * CROWD.length)], s: 0.9 + r() * 0.2 })
    }
  }
  const [fx, fz] = at(0, front - 0.6)
  M.box(fx, -0.4, fz, len + 0.5, 2.7, 0.3, rot, WHITE)
  const [tx, tz] = at(0, front - 0.42)
  M.box(tx, 1.4, tz, len + 0.5, 0.5, 0.08, rot, A)
  const [bx, bz] = at(0, front - 1.2 - rows * 0.9 + 0.25)
  M.box(bx, -0.4, bz, len + 0.5, top + 1.9, 0.4, rot, '#d7d3cc')
  for (const e of [-1, 1]) {
    const [ex, ez] = at((e * (len + 0.3)) / 2, 0)
    M.box(ex, -0.4, ez, 0.3, 1.9, depth - 0.6, rot, '#d7d3cc')
  }
  if (roof) {
    for (let lx = -len / 2 + 1; lx <= len / 2 - 0.9; lx += (len - 2) / 4) {
      const [px, pz] = at(lx, front - 1.2 - rows * 0.9 + 0.8)
      M.box(px, 0, pz, 0.4, top + 6.2, 0.4, rot, '#9aa0a6')
    }
    const [rx, rz] = at(0, -0.6)
    M.box(rx, top + 6, rz, len + 2.4, 0.4, depth * 0.92, rot, '#f3f1ec')
    const [ex, ez] = at(0, -0.6 + depth * 0.46)
    M.box(ex, top + 5.7, ez, len + 2.4, 0.9, 0.25, rot, A)
  }
}

// The venue. Returns solid, glass and fence geometry, the sponsor boards, and
// the lists the scene instances.
export function buildProps() {
  const M = mesher()
  const G = mesher()
  const F = mesher()
  const B = boardMesher()
  const { bL, bR, gL, gR } = T
  const r = rng(19)
  const crowd = []
  const crew = []
  const tyres = []
  const P = {}
  const Q = {}
  const rotAt = (p) => Math.atan2(-p.tz, p.tx)

  // crowd fences stand in front of every grandstand and along the pit straight
  const fence = new Uint8Array(N)
  for (let i = 0; i < N; i++) {
    if (T.pz[i] > 70 && Math.abs(T.px[i]) < 135) fence[i] = 1
    for (const s of T.stands) {
      const d = Math.min(wrap(i - s.i), wrap(s.i - i))
      if (d * T.ds < s.len / 2 + 8) fence[i] = 1
    }
  }

  for (const s of [1, -1]) {
    const b = s > 0 ? bL : bR
    const g = s > 0 ? gL : gR
    const skip = (i) => s > 0 && T.pitZone(wrap(i))
    // armco: two beams on posts
    let a = null
    const flush = (end) => {
      if (a !== null && end > a)
        for (const y of [0.3, 0.64])
          M.ribbon(a, end, (q) => [[s * b[q], y], [s * (b[q] - 0.08), y + 0.14], [s * b[q], y + 0.28]], '#c5cad0')
      a = null
    }
    for (let i = 0; i <= N; i++) {
      if (skip(i)) flush(i - 1)
      else if (a === null) a = i
    }
    flush(N)
    for (let i = 0; i < N; i += 2) {
      if (skip(i)) continue
      T.sample(i, s * (b[i] + 0.12), P)
      M.box(P.x, -0.3, P.z, 0.14, 1.28, 0.14, rotAt(P), '#9aa0a6')
    }
    // tyre walls in front of the armco wherever there is gravel
    let run = 0
    for (let u = 0; u < N; u += 1.15 / T.ds) {
      const q = wrap(Math.round(u))
      if (g[q] < 5 || skip(q)) {
        run = 0
        continue
      }
      T.sample(u, s * (b[q] - 0.72), P)
      tyres.push({ x: P.x, z: P.z, c: Math.floor(run++ / 5) % 2 })
    }
    // sponsor boards behind the barrier
    for (let i = 0; i < N; i += 4) {
      if (skip(i) || skip(i + 3) || (s < 0 && (fence[i] || fence[wrap(i + 3)]))) continue
      if (hash(Math.floor(i / 28) + s * 9, 3.7) < (s > 0 ? 0.6 : 0.3)) continue
      const o0 = s * (b[i] + 0.45)
      const o1 = s * (b[wrap(i + 3)] + 0.45)
      T.sample(i, o0, P)
      T.sample(i + 3, o1, Q)
      const p0 = [P.x, P.z]
      const p1 = [Q.x, Q.z]
      const cell = (i / 4 + (s > 0 ? 3 : 0)) % 8
      if (s > 0) B.add(p0, p1, 1.0, 2.15, cell)
      else B.add(p1, p0, 1.0, 2.15, cell)
      T.sample(i, o0 + s * 0.06, P)
      T.sample(i + 3, o1 + s * 0.06, Q)
      M.quad([P.x, 0.2, P.z], [Q.x, 0.2, Q.z], [Q.x, 2.2, Q.z], [P.x, 2.2, P.z], '#4a4e55')
    }
  }
  // catch fences
  let f0 = 0
  while (fence[f0]) f0++
  let fa = null
  for (let i = f0; i <= f0 + N; i++) {
    if (fence[wrap(i)]) {
      if (fa === null) fa = i
    } else if (fa !== null) {
      F.ribbon(fa, i - 1, (q) => [[-(bR[q] + 1.3), 0.9], [-(bR[q] + 1.3), 4.1]], '#b4bac0')
      fa = null
    }
  }
  for (let i = 0; i < N; i += 2) {
    if (!fence[i]) continue
    T.sample(i, -(bR[i] + 1.3), P)
    M.box(P.x, -0.2, P.z, 0.12, 4.4, 0.12, rotAt(P), '#8d9399')
  }

  // ---- pit wall, with a fence and timing stands
  M.box(-12, -0.05, PIT.wall, 136, 1.15, 0.5, 0, '#d2cfc9')
  M.box(-12, 1.1, PIT.wall, 136, 0.12, 0.6, 0, '#d93a30')
  F.box(-12, 1.2, PIT.wall, 136, 2.3, 0.04, 0, '#b4bac0')
  for (let x = -80; x <= 56; x += 8) M.box(x, 1.1, PIT.wall, 0.12, 2.5, 0.12, 0, '#8d9399')
  for (let t = 0; t < 6; t++) {
    const x = -52 + t * 18
    M.box(x, 2.5, PIT.wall - 0.5, 5, 0.18, 2, 0, TEAMS[t])
    M.box(x - 2.3, 1.1, PIT.wall - 1.3, 0.1, 1.4, 0.1, 0, '#8d9399')
    M.box(x + 2.3, 1.1, PIT.wall - 1.3, 0.1, 1.4, 0.1, 0, '#8d9399')
  }

  // ---- pit building: twelve garages under a glazed upper floor, and race control
  const { x0, x1, bays, front, back } = PIT
  const bw = (x1 - x0) / bays
  const mid = (x0 + x1) / 2
  const len = x1 - x0
  M.box(mid, -0.1, (back + front) / 2, len, 4.7, front - back, 0, '#dcd8d0')
  M.box(mid, 4.6, 45.4, len, 3.5, 9.6, 0, '#e6e2da')
  G.box(mid, 5.3, 50.24, len - 2, 2.1, 0.1, 0, GLASS)
  G.box(mid, 5.3, 40.56, len - 2, 2.1, 0.1, 0, GLASS)
  M.box(mid, 8.1, 45.8, len + 2, 0.35, 12.6, 0, '#f4f2ee')
  M.box(mid, 4.45, 52.7, len + 1, 0.3, 4.4, 0, '#f1efea')
  M.box(mid, 4.75, 54.8, len + 1, 0.9, 0.08, 0, '#b9bec4')
  for (let b = 0; b < bays; b++) {
    const cx = x0 + (b + 0.5) * bw
    const team = TEAMS[b >> 1]
    M.box(cx, 0, front + 0.06, bw - 1.4, 3.6, 0.12, 0, '#222227')
    M.box(cx, 3.7, front + 0.2, bw - 0.3, 0.75, 0.3, 0, team)
    M.box(cx - 2.4, 0.03, front + 0.5, 1.3, 1.05, 0.6, 0, team)
    M.box(cx + 2.5, 0.03, front + 0.45, 0.8, 1.5, 0.5, 0, '#3a3d44')
    M.box(x0 + b * bw, 0, front + 0.5, 0.7, 4.45, 1.2, 0, '#cfcbc3')
    if (b % 3 === 1) M.box(cx, 8.45, 44, 2.6, 1, 1.8, 0, '#aeb2b6')
    // the crew, drawn up in two ranks in front of their garage
    for (let row = 0; row < 2; row++)
      for (let m = -1; m <= 1; m++) crew.push({ x: cx + m * 1.5, y: 0.04, z: 56.3 + row * 1.5, rot: (r() - 0.5) * 0.3, c: team, s: 1 })
  }
  M.box(x1, 0, front + 0.5, 0.7, 4.45, 1.2, 0, '#cfcbc3')
  M.box(x1 + 7, -0.1, 46, 12, 15.1, 13, 0, '#e3dfd7')
  G.box(x1 + 7, 10.6, 46, 12.3, 3, 13.3, 0, GLASS)
  M.box(x1 + 7, 15, 46, 13.8, 0.4, 14.8, 0, '#f4f2ee')
  M.box(x1 + 7, 15.4, 46, 0.25, 8, 0.25, 0, '#8d9399')
  M.box(x1 + 7, 19, 46, 2.2, 0.15, 0.15, 0, '#8d9399')
  for (let f = 0; f < 3; f++) G.box(x1 + 7, 1.6 + f * 3, 52.53, 9, 1.5, 0.08, 0, GLASS)

  // ---- start gantry
  M.box(40, 0, PIT.wall, 0.6, 8, 0.6, 0, '#3a3d44')
  M.box(40, 0, 86.4, 0.6, 8, 0.6, 0, '#3a3d44')
  M.box(40, 7.2, (PIT.wall + 86.4) / 2, 0.8, 0.9, 86.4 - PIT.wall + 1.2, 0, '#2b2d33')
  M.box(40, 5.7, 78, 0.45, 1.5, 6, 0, '#17181c')
  const startLights = [-2, -1, 0, 1, 2].map((m) => [39.72, 6.45, 78 + m * 1.05])

  // ---- sponsor bridge over the back straight
  const ib = T.nearest(62, -134).i
  T.sample(ib, 0, P)
  const span = HALF + 4.6
  for (const s of [1, -1]) {
    T.sample(ib, s * span, Q)
    M.box(Q.x, -0.2, Q.z, 1.8, 7.4, 1.8, rotAt(P), '#d9d6d0')
  }
  M.box(P.x, 6.4, P.z, 2.2, 2.5, 2 * span + 2.6, rotAt(P), '#2b2d33')
  for (let c = 0; c < 3; c++) {
    const o0 = span - (c * 2 * span) / 3
    const o1 = span - ((c + 1) * 2 * span) / 3
    const e = (o, d) => [P.x + P.nx * o + P.tx * d, P.z + P.nz * o + P.tz * d]
    B.add(e(o0, -1.14), e(o1, -1.14), 6.65, 8.65, c + 1)
    B.add(e(o1, 1.14), e(o0, 1.14), 6.65, 8.65, c + 4)
  }

  // ---- grandstands
  const hues = [['#2f6fd0', '#e9e6df'], ['#d93a30', '#e9e6df'], ['#2f6fd0', '#f2b316'], ['#17a865', '#e9e6df'], ['#f26a1b', '#e9e6df'], ['#d93a30', '#f2b316'], ['#8c3fd1', '#e9e6df']]
  T.stands.forEach((s, i) => stand(M, s, crowd, r, hues[i % hues.length]))

  // ---- floodlight masts round the outside
  for (let i = 30; i < N; i += 80) {
    T.sample(i, -(bR[i] + 4), P)
    const y = groundAt(P.x, P.z).y - 0.3
    M.box(P.x, y, P.z, 0.7, 26, 0.7, rotAt(P), '#8d9399', [0.45, 0.45])
    M.box(P.x, y + 25.6, P.z, 4.4, 2.3, 0.7, rotAt(P), '#34373d')
    M.box(P.x + P.nx * 0.37, y + 25.9, P.z + P.nz * 0.37, 3.9, 1.7, 0.06, rotAt(P), '#f6f1d8')
  }
  // ---- marshal posts on the infield side
  for (let i = 55; i < N; i += 70) {
    if (T.pitZone(i)) continue
    T.sample(i, bL[i] + 3, P)
    const y = groundAt(P.x, P.z).y - 0.3
    M.box(P.x, y, P.z, 2.4, 2.7, 2.4, rotAt(P), '#eceae4')
    M.box(P.x, y + 2.7, P.z, 3, 0.3, 3, rotAt(P), '#f08a24')
    M.box(P.x - P.nx * 1.22, y + 1.4, P.z - P.nz * 1.22, 1.5, 0.8, 0.06, rotAt(P), '#2b3440')
  }

  // ---- paddock: team trucks nose to tail with hospitality tents
  for (let t = 0; t < 6; t++) {
    const x = -58 + t * 18
    M.box(x, 1.05, 34, 2.6, 3, 10.5, 0, TEAMS[t])
    M.box(x, 3.4, 34, 2.64, 0.5, 10.54, 0, WHITE)
    M.box(x, 0.5, 27.2, 2.5, 2.8, 2.4, 0, WHITE)
    G.box(x, 2.1, 26.02, 2.2, 0.9, 0.06, 0, GLASS)
    for (const z of [27.4, 36, 37.6]) M.box(x, 0, z, 2.7, 1, 1, 0, '#1b1b1f')
    M.box(x + 8, 0, 31, 5, 2.4, 5, 0, '#f3f1ec')
    M.box(x + 8, 2.4, 31, 5.5, 1.9, 5.5, 0, t % 2 ? '#f3f1ec' : TEAMS[t], [0.06, 0.06])
  }
  // ---- medical centre by the helipad
  M.box(HELI.x - 20, -0.2, HELI.z, 9, 3.8, 13, 0, '#efede8')
  M.box(HELI.x - 20, 3.6, HELI.z, 9.8, 0.3, 13.8, 0, '#d9d6d0')
  M.box(HELI.x - 20, 3.9, HELI.z, 1.2, 0.06, 4, 0, '#d92c26')
  M.box(HELI.x - 20, 3.9, HELI.z, 4, 0.06, 1.2, 0, '#d92c26')
  G.box(HELI.x - 15.48, 1, HELI.z, 0.06, 1.6, 9, 0, GLASS)

  return { solid: M.build(), glass: G.build(), fence: F.build(), boards: B.build(), crowd, crew, tyres, startLights }
}

// Road cars parked in the public car park and behind the garages.
export function parkedCars() {
  const r = rng(41)
  const tones = ['#d9d9d6', '#2b2e34', '#8f959c', '#b3282a', '#27508f', '#e8e4da', '#1e1f23', '#6d7f5a', '#c9a23a']
  const list = []
  for (const [z, face] of [[126.2, 1], [137.2, -1], [142.8, 1], [153.7, -1]])
    for (let x = -60.55; x < 96; x += 2.9) if (r() < 0.72) list.push({ x, z: z + (r() - 0.5) * 0.5, yaw: (face * Math.PI) / 2 + (r() - 0.5) * 0.06, c: tones[Math.floor(r() * tones.length)] })
  // (between each tent and the next truck)
  for (let x = -66; x < 54; x += 3) if (r() < 0.6 && (((x + 58) % 18) + 18) % 18 > 11.8 && (((x + 58) % 18) + 18) % 18 < 16) list.push({ x, z: 28.6, yaw: Math.PI / 2, c: tones[Math.floor(r() * tones.length)] })
  return list
}

// ---------------------------------------------------------------- instanced parts

// A chunky GT car, nose along +x. `paint` takes the instance colour;
// `trim` (glass, wheels, lights, number panels) keeps its own.
export function carGeometry() {
  const paint = mesher()
  const trim = mesher()
  const W1 = '#ffffff'
  paint.extrude([[-2.15, 0.2], [2.2, 0.2], [2.26, 0.42], [1.35, 0.67], [-1.55, 0.75], [-2.2, 0.66]], -0.93, 0.93, W1)
  paint.extrude([[-0.98, 1.1], [0.2, 1.08], [0.16, 1.17], [-0.92, 1.19]], -0.64, 0.64, W1)
  paint.box(-2.02, 1.14, 0, 0.5, 0.07, 1.86, 0, W1)
  for (const z of [-0.6, 0.6]) trim.box(-1.95, 0.7, z, 0.28, 0.45, 0.07, 0, '#17181b')
  for (const z of [-0.9, 0.9]) paint.box(-2.02, 1.02, z, 0.56, 0.3, 0.06, 0, W1)
  trim.extrude([[-1.4, 0.73], [0.98, 0.66], [0.22, 1.1], [-1, 1.12]], -0.76, 0.76, '#18222d')
  for (const x of [-1.38, 1.4])
    for (const z of [-0.86, 0.86]) {
      trim.merge(new THREE.CylinderGeometry(0.37, 0.37, 0.34, 10).rotateX(Math.PI / 2), new THREE.Matrix4().makeTranslation(x, 0.37, z), '#151518')
      trim.merge(new THREE.CylinderGeometry(0.19, 0.19, 0.36, 6).rotateX(Math.PI / 2), new THREE.Matrix4().makeTranslation(x, 0.37, z), '#a4a8ae')
    }
  trim.box(2.08, 0.13, 0, 0.5, 0.07, 1.98, 0, '#17181b')
  trim.box(-2.12, 0.16, 0, 0.3, 0.2, 1.7, 0, '#17181b')
  for (const z of [-0.62, 0.62]) {
    trim.box(2.0, 0.46, z, 0.34, 0.1, 0.4, 0, '#fff3c0')
    trim.box(-2.2, 0.5, z, 0.06, 0.14, 0.44, 0, '#ff2a1c')
    trim.box(-0.2, 0.36, z * 1.508, 0.62, 0.34, 0.03, 0, '#f4f2ee')
  }
  trim.box(-0.4, 1.18, 0, 0.6, 0.02, 0.6, 0, '#f4f2ee')
  trim.box(1.3, 0.67, 0, 1.4, 0.03, 0.34, 0, '#f4f2ee')
  return { paint: paint.build(), trim: trim.build() }
}

// A helmeted figure about 1.75 m tall, facing +z. Every part takes the
// instance colour, darker for the legs, gloves and visor.
export function personGeometry() {
  const M = mesher()
  M.box(0, 0, 0, 0.32, 0.82, 0.22, 0, '#474747')
  M.box(0, 0.8, 0, 0.44, 0.62, 0.26, 0, '#ececec', [1.12, 1])
  for (const x of [-0.29, 0.29]) M.box(x, 0.84, 0, 0.11, 0.56, 0.13, 0, '#d2d2d2')
  M.merge(new THREE.IcosahedronGeometry(0.17, 0), new THREE.Matrix4().makeTranslation(0, 1.6, 0), '#ffffff')
  M.box(0, 1.56, 0.13, 0.22, 0.09, 0.06, 0, '#141414')
  return M.build()
}

// Three tyres stacked.
export function tyreGeometry() {
  return mergeGeometries([0, 1, 2].map((i) => new THREE.CylinderGeometry(0.52, 0.52, 0.34, 9, 1).translate(0, 0.17 + i * 0.36, 0)))
}

export function treeGeometry() {
  const pine = mergeGeometries(
    [
      [1.7, 2.6, 1.0],
      [1.3, 2.3, 2.5],
      [0.9, 2.5, 3.9],
    ].map(([rad, h, y], i) => facet(new THREE.ConeGeometry(rad, h, 7, 1).translate(0, y + h / 2, 0), 0.09, 10 + i)),
  )
  const pineTrunk = facet(new THREE.CylinderGeometry(0.2, 0.28, 1.6, 6, 1).translate(0, 0.8, 0), 0.02, 3)
  const leaf = mergeGeometries([facet(new THREE.IcosahedronGeometry(1.9, 1).translate(0, 3.5, 0), 0.24, 21), facet(new THREE.IcosahedronGeometry(1.3, 0).translate(1, 4.3, 0.4), 0.14, 22), facet(new THREE.IcosahedronGeometry(1.2, 0).translate(-0.9, 4.0, -0.5), 0.14, 23)])
  const leafTrunk = facet(new THREE.CylinderGeometry(0.2, 0.32, 2.8, 6, 1).translate(0, 1.4, 0), 0.02, 4)
  const bush = mergeGeometries([facet(new THREE.IcosahedronGeometry(1, 1).translate(0, 0.7, 0), 0.16, 31), facet(new THREE.IcosahedronGeometry(0.7, 0).translate(0.75, 0.5, 0.2), 0.1, 32), facet(new THREE.IcosahedronGeometry(0.62, 0).translate(-0.6, 0.45, -0.35), 0.1, 33)])
  return { pine, pineTrunk, leaf, leafTrunk, bush }
}

// A striped hot-air balloon with its basket hanging at the origin.
export function balloonGeometry(a, b) {
  const M = mesher()
  const g = new THREE.SphereGeometry(7, 12, 7).toNonIndexed()
  const p = g.attributes.position
  // pull the bottom of the envelope in to a throat
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i)
    if (y < 0) {
      const f = 1 + (y / 7) * 0.55
      p.setXYZ(i, p.getX(i) * f, y * 1.35, p.getZ(i) * f)
    }
  }
  const m = new THREE.Matrix4().makeTranslation(0, 17, 0)
  const tri = new THREE.BufferGeometry()
  for (let i = 0; i < p.count; i += 3) {
    const ang = Math.atan2(p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2), p.getX(i) + p.getX(i + 1) + p.getX(i + 2))
    tri.setAttribute('position', new THREE.Float32BufferAttribute([0, 1, 2].flatMap((k) => [p.getX(i + k), p.getY(i + k), p.getZ(i + k)]), 3))
    M.merge(tri, m, Math.floor(((ang + Math.PI) / (Math.PI * 2)) * 12 + 0.5) % 2 ? a : b)
  }
  M.box(0, 0, 0, 1.6, 1.3, 1.6, 0, '#8a5a34')
  for (const [x, z] of [[-0.75, -0.75], [0.75, -0.75], [0.75, 0.75], [-0.75, 0.75]]) M.box(x, 1.3, z, 0.06, 6.6, 0.06, 0, '#3a3028', [1, 1])
  return M.build()
}
