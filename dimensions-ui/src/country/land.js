import * as THREE from 'three'
import { fbm, rng, sstep } from '../valley/land.js'

export { fbm, rng, sstep }

// The lie of the land, in metres. The viewer stands in a wildflower meadow
// on a rise, looking north over a shallow vale of hedged fields to wooded
// hills and, far off, a line of downs. heightAt() is the one ground truth;
// the field layout (toField / cell data) is the other: the ground shader,
// the hedges, the trees, the sheep and the bales all read the same two.

export const VIEW = { x: 0, z: 70 }
export const NEAR = { x0: -440, x1: 440, z0: -780, z1: 240, seg: 2 }
export const FAR = 16000
export const FAR_Z = -2500

export function heightAt(x, z) {
  // broad swells and small hummocks everywhere
  const roll = (fbm(x * 0.0035 + 3, z * 0.0035 - 1) - 0.5) * 46
  const small = (fbm(x * 0.02, z * 0.02 + 7, 3) - 0.5) * 5
  // the rise the viewer stands on, falling away to the vale
  const rise = 26 * sstep(-260, 140, z)
  // wooded hills across the vale, and the downs beyond
  const hills = (35 + 95 * fbm(x * 0.0016 + 9, z * 0.0016)) * sstep(-420, -1300, z)
  const downs = (120 + 220 * fbm(x * 0.0007, z * 0.0007 + 4)) * sstep(-1800, -4200, z)
  const flanks = 70 * sstep(700, 2400, Math.abs(x)) * fbm(x * 0.002 + 5, z * 0.002)
  return 4 + roll + small + rise + hills + downs + flanks
}

export function slopeAt(x, z, e = 1) {
  const dx = heightAt(x + e, z) - heightAt(x - e, z)
  const dz = heightAt(x, z + e) - heightAt(x, z - e)
  return Math.hypot(dx, dz) / (2 * e)
}

// ---------------------------------------------------------------- fields

// Fields are bricks in a gently warped, rotated grid ("field space" u, v):
// rows CH deep, each row's fields CW wide and offset by rowOff(j).
export const CW = 125
export const CH = 88
export const TH = 0.42
const C = Math.cos(TH)
const S = Math.sin(TH)
export const FIELD_C = C
export const FIELD_S = S
const warpU = (v) => 10 * Math.sin(v * 0.012 + 1) + 4 * Math.sin(v * 0.031)
const warpV = (u) => 8 * Math.sin(u * 0.01) + 3 * Math.sin(u * 0.027 + 2)
export const rowOff = (j) => ((((j * 0.618) % 1) + 1) % 1) * CW

export function toWorld(u, v) {
  const a = u + warpU(v)
  const b = v + warpV(u)
  return [a * C - b * S, a * S + b * C]
}
export function toField(x, z) {
  const a = x * C + z * S
  const b = -x * S + z * C
  let u = a
  let v = b
  for (let k = 0; k < 4; k++) {
    u = a - warpU(v)
    v = b - warpV(u)
  }
  return [u, v]
}
export function cellAt(x, z) {
  const [u, v] = toField(x, z)
  const j = Math.floor(v / CH)
  const off = rowOff(j)
  const i = Math.floor((u - off) / CW)
  return { i, j, u, v, fu: u - off - i * CW, fv: v - j * CH }
}

export const T = { pasture: 0, wheat: 1, barley: 2, plough: 3, hay: 4, rape: 5, young: 6, woods: 7, meadow: 8 }
const WEIGHTS = [
  [T.pasture, 0.32],
  [T.wheat, 0.17],
  [T.barley, 0.1],
  [T.plough, 0.09],
  [T.hay, 0.1],
  [T.rape, 0.06],
  [T.young, 0.1],
  [T.woods, 0.06],
]

const hashI = (i, j, k) => {
  let h = Math.imul(i + 1013, 0x27d4eb2d) ^ Math.imul(j - 977, 0x165667b1) ^ Math.imul(k + 31, 0x9e3779b1)
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

// The lane: a gravel farm track down from the viewer's rise, past the farm.
export const LANE_W = 1.7
export const laneX = (z) => 18 + 22 * Math.sin((z - 40) * 0.0065) + 9 * Math.sin(z * 0.017 + 1)
export const LANE_Z = [-1900, 240]
export const laneDist = (x, z) => (z < LANE_Z[0] || z > LANE_Z[1] ? Infinity : Math.abs(x - laneX(z)))

export const FARM = { x: laneX(-270) + 30, z: -270 }
FARM.y = heightAt(FARM.x, FARM.z)
export const YARD_R = 30

// Each cell: its use, a random byte, and whether its left and bottom edges
// carry a hedge. Packed into a 256 x 256 RGBA texture for the shader.
export function buildCells() {
  const N = 256
  const data = new Uint8Array(N * N * 4)
  const force = new Map()
  const set = (x, z, t) => {
    const c = cellAt(x, z)
    force.set(`${c.i},${c.j}`, t)
  }
  set(FARM.x, FARM.z, T.pasture)
  set(VIEW.x + 40, VIEW.z - 110, T.wheat)
  set(VIEW.x - 120, VIEW.z - 90, T.rape)
  set(VIEW.x + 150, VIEW.z - 170, T.hay)
  set(VIEW.x - 60, VIEW.z - 230, T.plough)
  set(VIEW.x + 20, VIEW.z - 330, T.pasture)
  set(VIEW.x - 200, VIEW.z - 300, T.pasture)
  set(VIEW.x, VIEW.z, T.meadow)
  const types = new Int8Array(N * N)
  for (let j = -128; j < 128; j++)
    for (let i = -128; i < 128; i++) {
      const k = (j + 128) * N + (i + 128)
      let t = force.get(`${i},${j}`)
      if (t === undefined) {
        let r = hashI(i, j, 1)
        t = T.pasture
        for (const [ty, w] of WEIGHTS) {
          if (r < w) {
            t = ty
            break
          }
          r -= w
        }
        // keep the woods off the near slopes, where they would hide the view
        if (t === T.woods) {
          const [x, z] = toWorld(rowOff(j) + (i + 0.5) * CW, (j + 0.5) * CH)
          if (Math.hypot(x - VIEW.x, z - VIEW.z) < 520) t = T.pasture
        }
      }
      types[k] = t
      data[k * 4] = t * 16
      data[k * 4 + 1] = Math.floor(hashI(i, j, 2) * 255)
      data[k * 4 + 2] = hashI(i, j, 3) < 0.88 ? 255 : 0
      data[k * 4 + 3] = hashI(i, j, 4) < 0.88 ? 255 : 0
    }
  const type = (i, j) => (Math.abs(i) < 128 && Math.abs(j) < 128 ? types[(j + 128) * N + (i + 128)] : T.pasture)
  const edge = (i, j, which) => (Math.abs(i) < 128 && Math.abs(j) < 128 ? data[((j + 128) * N + (i + 128)) * 4 + (which === 'left' ? 2 : 3)] > 0 : false)
  const rand = (i, j) => (Math.abs(i) < 128 && Math.abs(j) < 128 ? data[((j + 128) * N + (i + 128)) * 4 + 1] / 255 : 0.5)
  return { data, N, type, edge, rand }
}

// Every hedge line within reach of the viewer, as runs of world-space points.
export function hedgeRuns(cells, reach = 1050, step = 4) {
  const [vu, vv] = toField(VIEW.x, VIEW.z)
  const runs = []
  const j0 = Math.floor((vv - reach * 1.2) / CH)
  const j1 = Math.ceil((vv + reach * 1.2) / CH)
  const keep = (x, z) => {
    if (Math.hypot(x - VIEW.x, z - VIEW.z) > reach) return false
    if (laneDist(x, z) < LANE_W + 3) return false
    if (Math.hypot(x - FARM.x, z - FARM.z) < YARD_R + 6) return false
    return heightAt(x, z) < 190
  }
  const trace = (pts) => {
    let run = []
    for (const [u, v] of pts) {
      const [x, z] = toWorld(u, v)
      if (keep(x, z)) run.push([x, z])
      else {
        if (run.length > 2) runs.push(run)
        run = []
      }
    }
    if (run.length > 2) runs.push(run)
  }
  for (let j = j0; j <= j1; j++) {
    const off = rowOff(j)
    const i0 = Math.floor((vu - reach * 1.2 - off) / CW)
    const i1 = Math.ceil((vu + reach * 1.2 - off) / CW)
    for (let i = i0; i <= i1; i++) {
      const uL = off + i * CW
      if (cells.edge(i, j, 'left')) {
        const pts = []
        for (let s = 0; s <= CH; s += step) pts.push([uL, j * CH + s])
        trace(pts)
      }
      if (cells.edge(i, j, 'bottom')) {
        const pts = []
        for (let s = 0; s <= CW; s += step) pts.push([uL + s, j * CH])
        trace(pts)
      }
    }
  }
  return runs
}

// Drop things on the ground within a box: tries random spots and keeps
// those accept() returns a truthy value for.
export function scatter(count, seed, box, accept) {
  const r = rng(seed)
  const out = []
  let tries = 0
  while (out.length < count && tries++ < count * 25) {
    const x = box[0] + r() * (box[1] - box[0])
    const z = box[2] + r() * (box[3] - box[2])
    const y = heightAt(x, z)
    const v = accept(x, z, y, r)
    if (v) out.push({ x, y, z, v, r: r() })
  }
  return out
}

// ---------------------------------------------------------------- meshes

export function buildNear() {
  const { x0, x1, z0, z1, seg } = NEAR
  const nx = Math.round((x1 - x0) / seg) + 1
  const nz = Math.round((z1 - z0) / seg) + 1
  const pos = new Float32Array(nx * nz * 3)
  for (let j = 0; j < nz; j++)
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i
      const x = x0 + ((x1 - x0) * i) / (nx - 1)
      const z = z0 + ((z1 - z0) * j) / (nz - 1)
      pos[k * 3] = x
      pos[k * 3 + 1] = heightAt(x, z)
      pos[k * 3 + 2] = z
    }
  return gridGeometry(pos, nx, nz)
}

// The far ground carries the hills to the horizon; inside the near patch it
// sinks out of sight, meeting the near ground at the patch's edge.
export function buildFar(n = 420) {
  const { x0, x1, z0, z1 } = NEAR
  const pos = new Float32Array((n + 1) * (n + 1) * 3)
  const warp = (t) => 0.25 * t + 0.75 * Math.sign(t) * t * t
  for (let j = 0; j <= n; j++)
    for (let i = 0; i <= n; i++) {
      const k = j * (n + 1) + i
      const x = (warp((i / n) * 2 - 1) * FAR) / 2
      const z = (warp((j / n) * 2 - 1) * FAR) / 2 + FAR_Z
      const inside = Math.min(x - x0, x1 - x, z - z0, z1 - z)
      pos[k * 3] = x
      pos[k * 3 + 1] = heightAt(x, z) - sstep(0, 14, inside) * 6
      pos[k * 3 + 2] = z
    }
  return gridGeometry(pos, n + 1, n + 1)
}

function gridGeometry(pos, nx, nz) {
  const idx = new Uint32Array((nx - 1) * (nz - 1) * 6)
  let o = 0
  for (let j = 0; j < nz - 1; j++)
    for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i
      const b = a + 1
      const c = a + nx
      const d = c + 1
      idx[o++] = a
      idx[o++] = c
      idx[o++] = b
      idx[o++] = b
      idx[o++] = c
      idx[o++] = d
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setIndex(new THREE.BufferAttribute(idx, 1))
  g.computeVertexNormals()
  g.computeBoundingSphere()
  return g
}
