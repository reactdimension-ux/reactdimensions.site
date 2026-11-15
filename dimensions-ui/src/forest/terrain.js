import * as THREE from 'three'
import { rng } from '../lowpoly/kit.jsx'

// The lie of the land: a river valley running along z, meadows and forest on
// its banks, mountains rising on both sides. heightAt() is the single source
// of truth; the terrain mesh, the river ribbon, the trees and the rocks all
// read it, so everything sits on the same ground.

export const SIZE_X = 220
export const SIZE_Z = 300
export const WATER_Y = -0.9
export const RIVER_W = 5.5 // half-width of the water

const fract = (v) => v - Math.floor(v)
const hash2 = (x, z) => fract(Math.sin(x * 127.1 + z * 311.7) * 43758.5453123)
const smooth = (t) => t * t * (3 - 2 * t)
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
export const sstep = (e0, e1, x) => smooth(clamp((x - e0) / (e1 - e0), 0, 1))

export function vnoise(x, z) {
  const xi = Math.floor(x)
  const zi = Math.floor(z)
  const fx = smooth(x - xi)
  const fz = smooth(z - zi)
  const a = hash2(xi, zi)
  const b = hash2(xi + 1, zi)
  const c = hash2(xi, zi + 1)
  const d = hash2(xi + 1, zi + 1)
  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz
}

// Fractal noise, 0..1.
export function fbm(x, z, oct = 4) {
  let s = 0
  let a = 0.5
  let f = 1
  let n = 0
  for (let i = 0; i < oct; i++) {
    s += a * vnoise(x * f, z * f)
    n += a
    a *= 0.5
    f *= 2.07
  }
  return s / n
}

// Where the river runs: its centre line x for a given z.
export const riverX = (z) => 7 * Math.sin(z * 0.035) + 4 * Math.sin(z * 0.083 + 1.3)

export function heightAt(x, z) {
  const d = Math.abs(x - riverX(z))
  // rolling ground, calmer near the water
  const roll = (fbm(x * 0.03 + 11, z * 0.03 + 7) - 0.5) * 5.2 + (fbm(x * 0.11, z * 0.11) - 0.5) * 1.2
  const damp = 0.25 + 0.75 * sstep(RIVER_W, RIVER_W + 22, d)
  // mountains climb away from the valley
  const m = sstep(36, 96, d)
  const mountain = Math.pow(m, 1.25) * (14 + 30 * fbm(x * 0.018 + 3, z * 0.018 + 9)) + m * 16 * (fbm(x * 0.07, z * 0.07 + 4) - 0.5)
  // the river bed, cut below the water line
  const bed = 2.5 * (1 - sstep(0, RIVER_W + 3.5, d))
  // the meadows step up from the shore
  const bank = 1.4 * sstep(RIVER_W + 1, RIVER_W + 11, d)
  return roll * damp + 0.05 * d + mountain - bed + bank
}

// Steepness as a gradient (rise over run) at a point.
export function slopeAt(x, z, e = 0.8) {
  const dx = heightAt(x + e, z) - heightAt(x - e, z)
  const dz = heightAt(x, z + e) - heightAt(x, z - e)
  return Math.hypot(dx, dz) / (2 * e)
}

// Season palettes for the ground.
export const GROUND = {
  summer: { snowline: 24, bed: '#56644e', sand: '#cdbd8f', grass: ['#7fbb4f', '#5f9f3f'], forest: '#4e8d3a', rock: '#8b8681', snow: '#f3f6fa' },
  autumn: { snowline: 22, bed: '#5a5f4a', sand: '#d2c29a', grass: ['#c9a84a', '#a98c3b'], forest: '#8b7a3a', rock: '#8d8278', snow: '#f3f6fa' },
  winter: { snowline: 5, bed: '#5c6670', sand: '#cfd0c8', grass: ['#e3e9ee', '#cfd8df'], forest: '#c7d2da', rock: '#8e949c', snow: '#f5f8fb' },
}

// The faceted ground: a jittered grid, every triangle flat and coloured on
// its own by height and steepness.
export function buildTerrain(season = 'summer', segX = 128, segZ = 176) {
  const G = GROUND[season] || GROUND.summer
  const r = rng(7)
  const nx = segX + 1
  const nz = segZ + 1
  const cx = SIZE_X / segX
  const cz = SIZE_Z / segZ
  const vx = new Float32Array(nx * nz)
  const vy = new Float32Array(nx * nz)
  const vz = new Float32Array(nx * nz)
  for (let j = 0; j < nz; j++)
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i
      const edge = i === 0 || j === 0 || i === segX || j === segZ
      const x = -SIZE_X / 2 + i * cx + (edge ? 0 : (r() - 0.5) * cx * 0.7)
      const z = -SIZE_Z / 2 + j * cz + (edge ? 0 : (r() - 0.5) * cz * 0.7)
      vx[k] = x
      vz[k] = z
      vy[k] = heightAt(x, z)
    }
  const tris = segX * segZ * 2
  const pos = new Float32Array(tris * 9)
  const col = new Float32Array(tris * 9)
  const c = new THREE.Color()
  const grassA = new THREE.Color(G.grass[0])
  const grassB = new THREE.Color(G.grass[1])
  const forest = new THREE.Color(G.forest)
  const A = new THREE.Vector3()
  const B = new THREE.Vector3()
  const C = new THREE.Vector3()
  const N = new THREE.Vector3()
  let o = 0
  const put = (a, b, d) => {
    A.set(vx[a], vy[a], vz[a])
    B.set(vx[b], vy[b], vz[b])
    C.set(vx[d], vy[d], vz[d])
    N.subVectors(B, A).cross(C.clone().sub(A)).normalize()
    if (N.y < 0) {
      // keep every face wound upwards
      const t = b
      b = d
      d = t
      B.set(vx[b], vy[b], vz[b])
      C.set(vx[d], vy[d], vz[d])
      N.negate()
    }
    const h = (A.y + B.y + C.y) / 3
    const mx = (A.x + B.x + C.x) / 3
    const mz = (A.z + B.z + C.z) / 3
    const steep = Math.sqrt(1 - N.y * N.y) / Math.max(N.y, 1e-3) // rise over run
    const snowline = G.snowline + (fbm(mx * 0.05, mz * 0.05) - 0.5) * 6
    if (steep > 1.05) c.set(G.rock)
    else if (h > snowline) c.set(G.snow)
    else if (h < WATER_Y + 0.35) c.set(G.bed)
    else if (h < WATER_Y + 0.7 + fbm(mx * 0.09 + 7, mz * 0.09) * 0.8) c.set(G.sand)
    else {
      const t = fbm(mx * 0.05 + 3, mz * 0.05)
      c.copy(grassA).lerp(grassB, t)
      const f = fbm(mx * 0.028 + 20, mz * 0.028 + 5)
      if (f > 0.52 && h < snowline - 4) c.lerp(forest, sstep(0.52, 0.62, f))
      if (steep > 0.75) c.lerp(new THREE.Color(G.rock), sstep(0.75, 1.05, steep))
    }
    c.multiplyScalar(0.95 + r() * 0.1)
    for (const v of [A, B, C]) {
      pos[o] = v.x
      pos[o + 1] = v.y
      pos[o + 2] = v.z
      col[o] = c.r
      col[o + 1] = c.g
      col[o + 2] = c.b
      o += 3
    }
  }
  for (let j = 0; j < segZ; j++)
    for (let i = 0; i < segX; i++) {
      const a = j * nx + i
      const b = a + 1
      const d = a + nx
      const e = d + 1
      // alternate the diagonal for a less regular weave
      if ((i + j) % 2) {
        put(a, b, e)
        put(a, e, d)
      } else {
        put(a, b, d)
        put(b, e, d)
      }
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  g.computeVertexNormals()
  return g
}

// The river surface: a ribbon that follows the centre line, a little wider
// than the water so its edges tuck under the banks. uv.x runs across the
// river, uv.y along it (in world units).
export function buildRiver(width = RIVER_W * 2 + 3, step = 1.6, across = 20) {
  const rows = Math.floor(SIZE_Z / step) + 1
  const pos = []
  const uv = []
  const idx = []
  for (let j = 0; j < rows; j++) {
    const z = -SIZE_Z / 2 + j * step
    const cxr = riverX(z)
    for (let i = 0; i <= across; i++) {
      const u = i / across
      pos.push(cxr + (u - 0.5) * width, WATER_Y, z)
      uv.push(u, j * step)
    }
  }
  const n = across + 1
  for (let j = 0; j < rows - 1; j++)
    for (let i = 0; i < across; i++) {
      const a = j * n + i
      idx.push(a, a + n, a + 1, a + 1, a + n, a + n + 1)
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

// Drop things on the ground: tries random spots and keeps those accept()
// returns a value for (that value is kept as `v`).
export function scatter(count, seed, accept, margin = 0.96) {
  const r = rng(seed)
  const out = []
  let tries = 0
  while (out.length < count && tries++ < count * 14) {
    const x = (r() - 0.5) * SIZE_X * margin
    const z = (r() - 0.5) * SIZE_Z * margin
    const d = Math.abs(x - riverX(z))
    const y = heightAt(x, z)
    const v = accept(x, z, y, d, r)
    if (v) out.push({ x, y, z, v, r: r() })
  }
  return out
}
