import * as THREE from 'three'
import { facet, rng } from '../lowpoly/kit.jsx'
import { TEAMS, stand } from '../circuit/props.js'
import { HALF, N, fbm, hash, mesher, noise, sstep, wrap } from '../circuit/track.js'
import { CHALET, TRACK as T, WORLD, groundAt } from './layout.js'

// Everything built on the Alpine Ice Circuit: the snowy ground, the glossy ice
// track with its snow runoff, the snowbanks along both edges, and the venue
// (chalet garages, grandstands, start gantry, floodlights, marshal huts).
// Each builder returns merged, vertex-coloured geometry.

const WHITE = '#f1f6fa'
const GLASS = '#1b2a3a'
// where a car meets the snowbank on a given side (+1 infield, -1 outside)
export const bankAt = (q, side) => (side > 0 ? T.bL[q] : T.bR[q]) + 1.2

// ---------------------------------------------------------------- ground

export function buildGround() {
  const NX = 150
  const NZ = 130
  const H = new Float32Array((NX + 1) * (NZ + 1))
  for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) H[j * (NX + 1) + i] = groundAt(-WORLD.x / 2 + (i * WORLD.x) / NX, -WORLD.z / 2 + (j * WORLD.z) / NZ).y
  const pos = new Float32Array(NX * NZ * 18)
  const col = new Float32Array(NX * NZ * 18)
  const SNOW = new THREE.Color('#f3f7fa')
  const SHADE = new THREE.Color('#dfeaf2')
  const ICE = new THREE.Color('#b4d6ec')
  const ROCK = new THREE.Color('#7b8591')
  const c = new THREE.Color()
  const r = rng(7)
  let o = 0
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
    const mz = (az + bz + cz) / 3
    const g = groundAt(mx, mz)
    c.copy(SNOW)
      .lerp(SHADE, fbm(mx * 0.02, mz * 0.02))
      .lerp(ICE, 0.95 * g.onLake * (0.55 + 0.45 * noise(mx * 0.03, mz * 0.03)))
      .lerp(ROCK, sstep(0.78, 0.55, up) * 0.8)
      .multiplyScalar(0.95 + r() * 0.1)
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

// The clear ice of the track (glossy, with a polished racing line and
// scratches) and, beside it, the matte parts: lines, the deep-snow runoff and
// the grid. Nothing here casts a shadow.
export function buildSurfaces() {
  const ICE = mesher(T)
  const M = mesher(T)
  const { line, gL, gR } = T

  // deep snow in the runoff on the outside of the corners
  for (let i = 0; i < N; i += 2)
    for (const s of [1, -1]) {
      const g = s > 0 ? gL : gR
      if (g[i] < 0.5 && g[wrap(i + 2)] < 0.5) continue
      const a = HALF + 0.9
      M.ribbon(i, i + 2, (q) => (s > 0 ? [[a, 0.012], [a + g[q] + 1.5, 0.012]] : [[-(a + g[q] + 1.5), 0.012], [-a, 0.012]]), (i / 2) % 2 ? '#f8fbfd' : '#eff5f9')
    }

  // the track: blue-white ice, a darker polished line, hairline scratches
  const base = new THREE.Color('#9ccbe6')
  const deep = new THREE.Color('#5f9bc4')
  const pale = new THREE.Color('#d7ecf7')
  const offs = [-6, -4.5, -3, -1.5, 0, 1.5, 3, 4.5, 6]
  const road = offs.map((o) => [o, 0.03])
  ICE.ribbon(0, N, () => road, (q, j, out) => {
    const lineMask = Math.exp(-(((offs[j] - line[q]) / 1.7) ** 2))
    const scratch = hash(Math.floor(q / 3), j + 3) > 0.86 ? 0.55 : 0
    out.copy(base).lerp(pale, (Math.abs(offs[j]) / 6) * 0.35 + scratch).lerp(deep, lineMask * 0.55).multiplyScalar(0.96 + 0.08 * hash(q, j))
  })
  M.ribbon(0, N, () => [[HALF - 0.5, 0.05], [HALF - 0.2, 0.05]], WHITE)
  M.ribbon(0, N, () => [[-(HALF - 0.2), 0.05], [-(HALF - 0.5), 0.05]], WHITE)

  // chequered start line and the grid behind it
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
  for (let r = 0; r < 2; r++) for (let c = 0; c < 12; c++) mark(0, -5.5 + c, r - 0.5, 1, 1, (r + c) % 2 ? '#f2f0ea' : '#1c1c20')
  for (let g = 0; g < 10; g++) {
    const d = -(7 + g * 7.5)
    const o = g % 2 ? -2.7 : 2.7
    mark(0, o, d, 0.25, 2.6, WHITE)
    mark(0, o - 1.3, d - 0.9, 1.8, 0.2, WHITE)
    mark(0, o + 1.3, d - 0.9, 1.8, 0.2, WHITE)
  }
  return { ice: ICE.build(), flat: M.build() }
}

// ---------------------------------------------------------------- venue

export function buildProps() {
  const M = mesher(T)
  const G = mesher(T)
  const L = mesher(T)
  const { bL, bR } = T
  const r = rng(19)
  const crowd = []
  const P = {}
  const Q = {}
  const rotAt = (p) => Math.atan2(-p.tz, p.tx)

  // snowbanks: a lumpy ridge along both edges, past the runoff
  const bankCol = (q, j, out) => out.set(j === 0 || j === 4 ? '#e8f1f9' : j === 1 ? '#f2f8fd' : '#fbfdff').multiplyScalar(0.97 + 0.05 * hash(q, j))
  for (const s of [1, -1]) {
    const b = s > 0 ? bL : bR
    const prof = (q) => {
      const n = 0.5 * noise(q * 0.09, s * 7) + 0.5 * noise(q * 0.31, s * 3)
      const st = [
        [s * (b[q] - 0.6), 0],
        [s * (b[q] + 0.4), 0.8 + 0.5 * n],
        [s * (b[q] + 1.5), 1.35 + 0.8 * n],
        [s * (b[q] + 3.1), 0.9 + 0.4 * n],
        [s * (b[q] + 5.2), 0],
      ]
      return s > 0 ? st : st.reverse()
    }
    M.ribbon(0, N, prof, bankCol)
  }

  // ---- the chalet: six timber garages under a glazed upper floor and a snow roof
  const { x0, x1, z, depth, bays } = CHALET
  const len = x1 - x0
  const mid = (x0 + x1) / 2
  const bw = len / bays
  const front = z + depth / 2
  M.box(mid, 0, z, len + 0.6, 0.55, depth + 0.6, 0, '#6e747c')
  M.box(mid, 0.5, z, len, 3.9, depth, 0, '#a3703f')
  for (let k = 0; k < 6; k++) M.box(mid, 0.9 + k * 0.62, z, len + 0.12, 0.08, depth + 0.12, 0, '#7e5330')
  M.box(mid, 4.4, z, len - 5, 3.1, depth - 1.6, 0, '#c9a577')
  G.box(mid, 5.1, front - 0.8 + 0.06, len - 7, 1.7, 0.08, 0, GLASS)
  M.box(mid, 4.3, front + 0.7, len + 1, 0.22, 2.4, 0, '#7e5330') // balcony
  for (let b = 0; b <= bays; b++) M.box(x0 + b * bw, 0.5, front + 0.18, 0.55, 3.9, 0.55, 0, '#7e5330')
  for (let b = 0; b < bays; b++) {
    const cx = x0 + (b + 0.5) * bw
    M.box(cx, 0.55, front + 0.06, bw - 1.6, 3.2, 0.14, 0, '#262c36')
    M.box(cx, 3.2, front + 0.14, bw - 0.9, 0.7, 0.3, 0, TEAMS[b])
    M.box(cx - 2.2, 0.55, front + 1.2, 1.1, 1.0, 0.7, 0, TEAMS[b])
  }
  M.box(mid, 7.5, z, len + 5, 3.4, depth + 4, 0, '#f2f7fb', [1, 0.07])
  M.box(mid, 7.2, z, len + 5, 0.35, depth + 4, 0, '#6e4a2c')
  for (const cx of [x0 + 14, x0 + 62, x0 + 96]) M.box(cx, 8, z - 1.5, 1.3, 3.2, 1.3, 0, '#7a6a5a')

  // ---- start gantry
  T.sample(0, 0, P)
  const span = HALF + 2.4
  for (const s of [1, -1]) {
    T.sample(0, s * span, Q)
    M.box(Q.x, 0, Q.z, 0.7, 8, 0.7, rotAt(P), '#3d4a5a')
  }
  M.box(P.x, 7.2, P.z, 1.0, 1.0, 2 * span + 1, rotAt(P), '#2b3440')
  M.box(P.x, 5.9, P.z, 0.5, 1.4, 6, rotAt(P), '#17181c')
  M.box(P.x, 8.2, P.z, 0.6, 1.0, 2 * span, rotAt(P), '#d8332b')

  // ---- grandstands, in warm winter coats
  const hues = [['#2f6fd0', '#e9e6df'], ['#d93a30', '#f2f6f9'], ['#17a865', '#e9e6df'], ['#f26a1b', '#e9e6df']]
  T.stands.forEach((s, i) => stand(M, s, crowd, r, hues[i % hues.length]))

  // ---- floodlight masts round the outside, and their lamp panels
  const masts = []
  for (let i = 12; i < N; i += 60) {
    T.sample(i, -(bR[i] + 5), P)
    M.box(P.x, 0, P.z, 0.7, 24, 0.7, rotAt(P), '#8d9399', [0.45, 0.45])
    M.box(P.x, 23.4, P.z, 4.4, 2.3, 0.7, rotAt(P), '#34373d')
    L.box(P.x + P.nx * 0.37, 23.7, P.z + P.nz * 0.37, 3.9, 1.7, 0.06, rotAt(P), '#fff6dc')
    T.sample(i, 3, Q)
    masts.push({ at: [P.x, 23, P.z], to: [Q.x, 0, Q.z] })
  }

  // ---- marshal huts on the infield side, timber under snow
  for (let i = 40; i < N; i += 70) {
    T.sample(i, bL[i] + 5, P)
    M.box(P.x, 0, P.z, 2.6, 2.5, 2.6, rotAt(P), '#a3703f')
    M.box(P.x, 2.4, P.z, 3.4, 1.0, 3.4, rotAt(P), '#f2f7fb', [0.1, 0.1])
    M.box(P.x - P.nx * 1.32, 1.0, P.z - P.nz * 1.32, 1.1, 0.9, 0.06, rotAt(P), '#2b3440')
  }

  // ---- a ski lift's pylons climbing the slope beyond the lake
  for (let k = 0; k < 6; k++) {
    const x = -160 + k * 36
    const zz = 250 + k * 28
    const y = groundAt(x, zz).y
    M.box(x, y, zz, 0.8, 9 + (k % 2) * 2, 0.8, 0, '#4a525c')
    M.box(x, y + 8.4 + (k % 2) * 2, zz, 4.2, 0.35, 0.35, 0.5, '#4a525c')
  }

  return { solid: M.build(), glass: G.build(), lamps: L.build(), crowd, masts }
}

// ---------------------------------------------------------------- scenery

// Pines, some laden with snow, on the slopes beyond the lake.
export function scatterPines(count, seed) {
  const r = rng(seed)
  const list = []
  for (let n = 0; n < count; n++) {
    const x = (r() - 0.5) * (WORLD.x - 60)
    const z = (r() - 0.5) * (WORLD.z - 60)
    const g = groundAt(x, z)
    if (g.d < 1.14 || g.y > 95) continue
    const forest = sstep(0.35, 0.62, fbm(x * 0.011 + 3, z * 0.011 + 8)) * (1 - sstep(60, 95, g.y)) * sstep(1.14, 1.4, g.d)
    if (r() > forest) continue
    const s = 1.5 + r() * 1.7
    list.push({ x, y: g.y - 0.2, z, rot: r() * Math.PI * 2, s: [s, s * (0.95 + r() * 0.45), s], c: r() < 0.28 ? '#dce9ee' : ['#27503f', '#2f5f49', '#3a6b50', '#244838'][Math.floor(r() * 4)] })
  }
  return list
}

// Snow-capped peaks standing in the haze, so the edge of the ground never shows.
export function buildPeaks() {
  const r = rng(91)
  const list = []
  const peak = (x, z) => {
    const h = 150 + r() * 160
    return { x, z, h, rad: h * (1.1 + r() * 0.5) }
  }
  for (let z = -640; z <= 640; z += 100) for (const sx of [-1, 1]) list.push(peak(sx * (610 + r() * 90), z + (r() - 0.5) * 50))
  for (const sz of [-1, 1]) for (let x = -540; x <= 540; x += 100) list.push(peak(x + (r() - 0.5) * 50, sz * (560 + r() * 90)))
  return list.map((p, i) => {
    const sides = 5 + Math.floor(r() * 3)
    const rock = facet(new THREE.ConeGeometry(p.rad, p.h, sides, 1).translate(0, p.h / 2 - 20, 0), p.rad * 0.2, 200 + i, [1, 0.4, 1], (x, y) => y < -18)
    const capH = p.h * 0.42
    const cap = facet(new THREE.ConeGeometry(p.rad * 0.58, capH * 1.25, sides, 1).translate(0, p.h - 20 - capH * 0.62 + 2, 0), p.rad * 0.1, 260 + i, [1, 0.4, 1])
    return { ...p, rock, cap }
  })
}
