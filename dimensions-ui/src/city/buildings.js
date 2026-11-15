import * as THREE from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { AVE, AVE_HALF, AVE_WALK, CURB, I, J0, J1, ST, ST_HALF, ST_WALK, blocks, rng, tallness } from './layout.js'

// The buildings, all in one merged geometry (one draw call). Each wall
// carries its building's style so the facade shader can draw it:
//   aStyle = (type, seed, storey height, bay width)
//   aFace  = (face width, tier: 0 = street level, 1 = above, -, -)
//   aUV    = (metres along the face, metres above the building's foot)
// Types: 0 glass curtain wall, 1 brick, 2 limestone, 3 deco piers,
// 4 mid-century grid, 5 timber (water tanks), 6 dark metal, 7 painted
// cornice, 8 stone trim.

export const GLASS = 0
export const BRICK = 1
export const STONE = 2
export const DECO = 3
export const GRID = 4
export const WOOD = 5
export const METAL = 6
export const PAINT = 7
export const TRIM = 8

class Builder {
  constructor() {
    this.pos = []
    this.nor = []
    this.uv = []
    this.style = []
    this.face = []
  }
  vert(x, y, z, nx, ny, nz, u, v, st, fw, tier) {
    this.pos.push(x, y, z)
    this.nor.push(nx, ny, nz)
    this.uv.push(u, v)
    this.style.push(st[0], st[1], st[2], st[3])
    this.face.push(fw, tier, 0, 0)
  }
  // Walls round a polygon (points ordered so normals face out), from y0 to
  // y1, and a cap on top. base: the building's foot, for storey counting.
  prism(poly, y0, y1, st, { base = CURB, tier = 1, cap = true, bottom = false } = {}) {
    const n = poly.length
    for (let k = 0; k < n; k++) {
      const [ax, az] = poly[k]
      const [bx, bz] = poly[(k + 1) % n]
      const len = Math.hypot(bx - ax, bz - az)
      if (len < 1e-4) continue
      const dx = (bx - ax) / len
      const dz = (bz - az) / len
      const nx = -dz
      const nz = dx
      const v0 = y0 - base
      const v1 = y1 - base
      const q = [
        [ax, y0, az, 0, v0],
        [bx, y0, bz, len, v0],
        [bx, y1, bz, len, v1],
        [ax, y1, az, 0, v1],
      ]
      for (const i of [0, 1, 2, 0, 2, 3]) this.vert(q[i][0], q[i][1], q[i][2], nx, 0, nz, q[i][3], q[i][4], st, len, tier)
    }
    if (cap) for (let k = 1; k < n - 1; k++) for (const p of [poly[0], poly[k], poly[k + 1]]) this.vert(p[0], y1, p[1], 0, 1, 0, p[0], p[1], st, 1, tier)
    if (bottom) for (let k = 1; k < n - 1; k++) for (const p of [poly[0], poly[k + 1], poly[k]]) this.vert(p[0], y0, p[1], 0, -1, 0, p[0], p[1], st, 1, tier)
  }
  box(x0, x1, z0, z1, y0, y1, st, opts) {
    this.prism(rect(x0, x1, z0, z1), y0, y1, st, opts)
  }
  // a box along arbitrary axes (fire-escape stairs)
  oriented(c, ax, ay, az, st) {
    const corners = []
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) corners.push(c.clone().addScaledVector(ax, sx).addScaledVector(ay, sy).addScaledVector(az, sz))
    const faces = [
      [0, 1, 3, 2, ax.clone().negate()],
      [4, 6, 7, 5, ax],
      [0, 4, 5, 1, ay.clone().negate()],
      [2, 3, 7, 6, ay],
      [0, 2, 6, 4, az.clone().negate()],
      [1, 5, 7, 3, az],
    ]
    for (const [a, b, c2, d, n] of faces) {
      const nn = n.clone().normalize()
      for (const i of [a, b, c2, a, c2, d]) this.vert(corners[i].x, corners[i].y, corners[i].z, nn.x, nn.y, nn.z, 0, corners[i].y, st, 1, 1)
    }
  }
  cone(cx, cz, r, y0, y1, seg, st) {
    for (let k = 0; k < seg; k++) {
      const a0 = (k / seg) * Math.PI * 2
      const a1 = ((k + 1) / seg) * Math.PI * 2
      const p0 = [cx + r * Math.sin(a0), cz + r * Math.cos(a0)]
      const p1 = [cx + r * Math.sin(a1), cz + r * Math.cos(a1)]
      const am = (a0 + a1) / 2
      const n = new THREE.Vector3(Math.sin(am) * (y1 - y0), r, Math.cos(am) * (y1 - y0)).normalize()
      for (const p of [
        [p0[0], y0, p0[1]],
        [p1[0], y0, p1[1]],
        [cx, y1, cz],
      ])
        this.vert(p[0], p[1], p[2], n.x, n.y, n.z, 0, 0, st, 1, 1)
    }
  }
  geometry() {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3))
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3))
    g.setAttribute('aUV', new THREE.Float32BufferAttribute(this.uv, 2))
    g.setAttribute('aStyle', new THREE.Float32BufferAttribute(this.style, 4))
    g.setAttribute('aFace', new THREE.Float32BufferAttribute(this.face, 4))
    g.computeBoundingSphere()
    return g
  }
}

// rectangle, ordered so that the walls face outward
export const rect = (x0, x1, z0, z1) => [
  [x0, z1],
  [x1, z1],
  [x1, z0],
  [x0, z0],
]
const circle = (cx, cz, r, seg) => Array.from({ length: seg }, (_, k) => [cx + r * Math.sin((k / seg) * Math.PI * 2), cz + r * Math.cos((k / seg) * Math.PI * 2)])
// a rectangle with its corners cut
const chamfer = (x0, x1, z0, z1, c) => [
  [x0 + c, z1],
  [x1 - c, z1],
  [x1, z1 - c],
  [x1, z0 + c],
  [x1 - c, z0],
  [x0 + c, z0],
  [x0, z0 + c],
  [x0, z1 - c],
]

// A rooftop water tank on legs: timber staves, iron hoops, a pointed cap.
function waterTank(B, M, cx, cz, y, r, seed) {
  const legH = 1.8 + (seed % 1) * 1.0
  const H = 2.6 + r * 0.55
  const st = [WOOD, seed, 3, 1]
  for (const [lx, lz] of [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ])
    M.box(cx + lx * r * 0.6 - 0.12, cx + lx * r * 0.6 + 0.12, cz + lz * r * 0.6 - 0.12, cz + lz * r * 0.6 + 0.12, y, y + legH, [METAL, seed, 3, 1], { cap: false })
  B.prism(circle(cx, cz, r * 1.05, 14), y + legH - 0.25, y + legH, [WOOD, seed, 3, 1], { base: y })
  B.prism(circle(cx, cz, r, 14), y + legH, y + legH + H, st, { base: y + legH, cap: false })
  B.cone(cx, cz, r * 1.08, y + legH + H, y + legH + H + r * 0.55, 14, [WOOD, seed + 0.5, 3, 1])
}

// Fire escapes down a street front: a platform at each storey, its rail,
// and a stair dropping to the one below.
function fireEscape(M, x0, x1, zWall, out, floors, fh, base) {
  const st = [METAL, 0.3, 3, 1]
  const w = x1 - x0
  for (let k = 1; k < floors; k++) {
    const y = base + k * fh
    const zo = zWall + out * 1.0
    M.box(x0, x1, Math.min(zWall, zo), Math.max(zWall, zo), y - 0.04, y, st)
    M.box(x0, x1, zo - 0.02, zo + 0.02, y + 0.85, y + 0.92, st)
    for (let px = x0; px <= x1 + 0.01; px += 0.6) M.box(px - 0.012, px + 0.012, zo - 0.012, zo + 0.012, y, y + 0.85, st, { cap: false })
    M.box(x0 - 0.02, x0 + 0.02, Math.min(zWall, zo), Math.max(zWall, zo), y + 0.85, y + 0.92, st)
    M.box(x1 - 0.02, x1 + 0.02, Math.min(zWall, zo), Math.max(zWall, zo), y + 0.85, y + 0.92, st)
    if (k > 1) {
      // stair from this platform down to the next
      const s = k % 2 ? 1 : -1
      const xa = x0 + w * 0.5 + s * w * 0.28
      const xb = x0 + w * 0.5 - s * w * 0.28
      const a = new THREE.Vector3(xa, y, zWall + out * 0.62)
      const b = new THREE.Vector3(xb, y - fh, zWall + out * 0.62)
      const c = a.clone().add(b).multiplyScalar(0.5)
      const dir = b.clone().sub(a)
      const ax = dir.clone().multiplyScalar(0.5)
      const az = new THREE.Vector3(0, 0, 0.32)
      const ay = new THREE.Vector3().crossVectors(az, ax).normalize().multiplyScalar(0.05)
      M.oriented(c, ax, ay, az, st)
    }
  }
}

// One building on a lot. faces: which sides are street fronts ('s','n').
function building(B, M, lot, r, beacons, detail) {
  const { x0, x1, z0, z1 } = lot
  const h = lot.h
  const seed = lot.seed
  const w = x1 - x0
  const d = z1 - z0
  const base = CURB
  let type
  if (h < 26) type = BRICK
  else if (h < 115) type = r() < 0.55 ? BRICK : STONE
  else type = r() < 0.45 ? GLASS : r() < 0.55 ? DECO : GRID
  if (h > 250 && type === GRID) type = GLASS
  const fh = type === BRICK ? (h < 26 ? 3.1 : 3.3) : type === STONE ? 3.5 : type === GLASS ? 3.9 : 3.7
  const ww = type === BRICK ? 1.9 + r() * 0.5 : type === STONE ? 1.7 + r() * 0.4 : type === GLASS ? 1.5 : type === DECO ? 1.6 : 2.6 + r() * 0.8
  const st = (t) => [t, seed, fh, ww]
  const top = base + h
  if (!detail) {
    B.prism(rect(x0, x1, z0, z1), base, top, st(type), { tier: 0 })
    return
  }
  if (type === BRICK || type === STONE) {
    // the main block, a cornice, maybe a setback attic, then tanks and boxes on the roof
    const set = h > 45 && r() < 0.6 ? Math.min(h * (0.12 + r() * 0.12), 24) : 0
    const y1 = top - set
    B.prism(rect(x0, x1, z0, z1), base, y1, st(type), { tier: 0 })
    const corn = h < 30 ? PAINT : TRIM
    B.prism(rect(x0 - 0.45, x1 + 0.45, z0 - 0.45, z1 + 0.45), y1, y1 + 0.75, [corn, seed, 0.75, 1], { bottom: true })
    if (set > 0) {
      const ins = Math.min(3 + r() * 3, w * 0.2, d * 0.2)
      B.prism(rect(x0 + ins, x1 - ins, z0 + ins, z1 - ins), y1 + 0.75, top, st(type), { tier: 1 })
      B.prism(rect(x0 + ins - 0.3, x1 - ins + 0.3, z0 + ins - 0.3, z1 - ins + 0.3), top, top + 0.5, [TRIM, seed, 0.5, 1], { bottom: true })
    }
    const roofY = set > 0 ? top + 0.5 : y1 + 0.75
    const rx0 = set > 0 ? x0 + 4 : x0 + 1
    const rx1 = set > 0 ? x1 - 4 : x1 - 1
    if (r() < (h < 30 ? 0.35 : 0.75) && rx1 - rx0 > 6 && d > 8) {
      const tr = 1.5 + r() * 0.8
      waterTank(B, M, rx0 + tr + 0.5 + r() * Math.max(0, rx1 - rx0 - 2 * tr - 1), (z0 + z1) / 2 + (r() - 0.5) * Math.max(0, d - 2 * tr - 4), roofY, tr, seed + r())
    }
    if (r() < 0.6) {
      const bw = 2 + r() * 4
      const bx = x0 + 1 + r() * Math.max(0, w - bw - 2)
      B.box(bx, bx + bw, z0 + 1.5, z0 + 1.5 + 2 + r() * 3, roofY, roofY + 1.5 + r() * 2.5, [METAL, seed, 1, 1])
    }
    // fire escapes on the street fronts of the walk-ups
    if (type === BRICK && h < 40 && w > 7) {
      const floors = Math.floor(h / fh)
      const ex = x0 + w / 2 - 3
      if (lot.faces.includes('s')) fireEscape(M, ex, ex + 6, z0, -1, floors, fh, base)
      if (lot.faces.includes('n')) fireEscape(M, ex, ex + 6, z1, 1, floors, fh, base)
    }
    return
  }
  if (type === DECO) {
    // a wedding-cake of setbacks, a crown, and a spire on the tallest
    const tiers = [0.42, 0.66, 0.82, 1]
    let y = base
    let ins = 0
    tiers.forEach((t, k) => {
      const yt = base + h * t
      const poly = k === 3 && r() < 0.5 ? chamfer(x0 + ins, x1 - ins, z0 + ins, z1 - ins, Math.min(w, d) * 0.12) : rect(x0 + ins, x1 - ins, z0 + ins, z1 - ins)
      B.prism(poly, y, yt, st(DECO), { tier: k === 0 ? 0 : 1 })
      y = yt
      ins += Math.min(w, d) * (0.08 + r() * 0.04)
      if (Math.min(x1 - x0 - 2 * ins, z1 - z0 - 2 * ins) < 6) ins = Math.min(w, d) / 2 - 3
    })
    const cx = (x0 + x1) / 2
    const cz = (z0 + z1) / 2
    if (h > 200) {
      let s = Math.min(w, d) / 2 - ins
      let yy = y
      for (let k = 0; k < 3; k++) {
        const hh = 6 + r() * 6
        B.prism(chamfer(cx - s, cx + s, cz - s, cz + s, s * 0.3), yy, yy + hh, [STONE, seed, 3, 1.4])
        yy += hh
        s *= 0.65
      }
      const mast = 20 + r() * 40
      M.box(cx - 0.6, cx + 0.6, cz - 0.6, cz + 0.6, yy, yy + mast, [METAL, seed, 3, 1])
      beacons.push([cx, yy + mast + 0.6, cz])
    } else {
      B.box(cx - 3, cx + 3, cz - 3, cz + 3, y, y + 4, [METAL, seed, 1, 1])
    }
    return
  }
  // glass and grid towers: a podium, then the shaft
  const podium = 14 + Math.floor(r() * 3) * 4
  const podType = type === GLASS ? (r() < 0.5 ? STONE : GRID) : GRID
  const big = w > 26 && d > 26
  if (big) {
    B.prism(rect(x0, x1, z0, z1), base, base + podium, [podType, seed + 0.1, 4.2, 2.4], { tier: 0 })
    const ins = 3 + r() * 3
    const tx0 = x0 + ins
    const tx1 = x1 - ins
    const tz0 = z0 + ins
    const tz1 = z1 - ins
    const poly = r() < 0.35 ? chamfer(tx0, tx1, tz0, tz1, Math.min(tx1 - tx0, tz1 - tz0) * 0.15) : rect(tx0, tx1, tz0, tz1)
    B.prism(poly, base + podium, top, st(type), { tier: 1 })
  } else {
    B.prism(rect(x0, x1, z0, z1), base, top, st(type), { tier: 0 })
  }
  const cx = (x0 + x1) / 2
  const cz = (z0 + z1) / 2
  const sz = Math.min(w, d) * 0.3
  B.box(cx - sz, cx + sz, cz - sz, cz + sz, top, top + 3 + r() * 4, [METAL, seed, 1.5, 1])
  if (h > 280) {
    M.box(cx - 0.4, cx + 0.4, cz - 0.4, cz + 0.4, top, top + 25, [METAL, seed, 3, 1])
    beacons.push([cx, top + 25.5, cz])
  }
}

// Split each block into lots and raise a building on each.
function lotsOf(b, r, detail) {
  const lots = []
  let x = b.x0
  const H = tallness((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2)
  const hmax = 26 + 400 * H
  const height = (edge) => {
    const walkup = r() < 0.38 * (1 - H)
    if (walkup) return 13 + r() * 10
    return Math.max(14, (16 + Math.pow(r(), 1.9) * hmax) * (edge ? 1.25 : 1))
  }
  while (x < b.x1 - 3) {
    const tall = r() < 0.25 + 0.5 * H
    let w = tall ? 24 + r() * 34 : 7 + r() * 14
    if (b.x1 - x - w < 7) w = b.x1 - x
    const x1 = Math.min(b.x1, x + w)
    const edge = x === b.x0 || x1 === b.x1
    const full = (w > 24 && r() < 0.75) || r() < 0.12
    if (full) lots.push({ x0: x + 0.05, x1: x1 - 0.05, z0: b.z0, z1: b.z1, faces: 'sn', h: height(edge) * (tall ? 1.3 : 1), seed: r() * 100 })
    else {
      const zm = (b.z0 + b.z1) / 2 + (r() - 0.5) * 6
      lots.push({ x0: x + 0.05, x1: x1 - 0.05, z0: b.z0, z1: zm, faces: 's', h: height(edge), seed: r() * 100 })
      lots.push({ x0: x + 0.05, x1: x1 - 0.05, z0: zm, z1: b.z1, faces: 'n', h: height(edge), seed: r() * 100 })
    }
    x = x1
  }
  return lots
}

// Builds the city: detailed blocks around the viewer, plain towers out to
// the horizon, and the sidewalks under all of them.
export function buildCity() {
  const B = new Builder()
  const M = new Builder() // dark metalwork: fire escapes, tank legs, masts
  const S = new Builder() // sidewalks and kerbs
  const beacons = []
  const r = rng(2024)
  const near = blocks()
  const nearSet = new Set(near.map((b) => `${b.i},${b.j}`))
  for (const b of near) {
    // sidewalk slab under the whole block, out to the kerbs
    S.prism(rect(b.x0 - AVE_WALK, b.x1 + AVE_WALK, b.z0 - ST_WALK, b.z1 + ST_WALK), 0, CURB, [0, 0, 1, 1])
    for (const lot of lotsOf(b, r, true)) building(B, M, lot, r, beacons, true)
  }
  // the far city: plain massing on the same grid, out toward the horizon
  for (let i = -14; i <= 13; i++)
    for (let j = -44; j <= 18; j++) {
      if (nearSet.has(`${i},${j}`)) continue
      const x0 = i * AVE + AVE_HALF + AVE_WALK
      const x1 = (i + 1) * AVE - AVE_HALF - AVE_WALK
      const z0 = j * ST + ST_HALF + ST_WALK
      const z1 = (j + 1) * ST - ST_HALF - ST_WALK
      const b = { x0, x1, z0, z1 }
      const dist = Math.hypot((x0 + x1) / 2, (z0 + z1) / 2 + 300)
      if (dist > 3600) continue
      S.prism(rect(x0 - AVE_WALK, x1 + AVE_WALK, z0 - ST_WALK, z1 + ST_WALK), 0, CURB, [0, 0, 1, 1], { cap: true })
      for (const lot of lotsOf(b, r, false)) building(B, M, lot, r, beacons, false)
    }
  // indexed, so each shared corner is shaded once
  return { buildings: mergeVertices(B.geometry()), metal: mergeVertices(M.geometry()), sidewalks: mergeVertices(S.geometry()), beacons }
}

export { I, J0, J1, AVE, ST }
