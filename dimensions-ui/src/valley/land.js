import * as THREE from 'three'

// The lie of the land, in metres. A river runs away from the viewer up a
// meadowed valley, bends off between forested hills, and the valley closes
// under a range of snowy peaks. heightAt() is the single ground truth: the
// near and far ground meshes, the river's depth, the trees, the grass and
// the rocks all read it, so everything sits on the same surface.

export const WATER_Y = 0
// The detailed near ground; the coarse far ground carries the mountains.
export const NEAR = { x0: -230, x1: 230, z0: -470, z1: 190, seg: 1.25 }
export const FAR = 6400

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const smooth = (t) => t * t * (3 - 2 * t)
export const sstep = (e0, e1, x) => smooth(clamp((x - e0) / (e1 - e0), 0, 1))
const fract = (v) => v - Math.floor(v)
const hash2 = (x, z) => fract(Math.sin(x * 127.1 + z * 311.7) * 43758.5453123)
const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10)

// Gradient noise, about -0.7..0.7.
export function pnoise(x, z) {
  const ix = Math.floor(x)
  const iz = Math.floor(z)
  const fx = x - ix
  const fz = z - iz
  const g = (i, k, dx, dz) => {
    const a = hash2(i, k) * 6.283185307
    return Math.cos(a) * dx + Math.sin(a) * dz
  }
  const u = fade(fx)
  const v = fade(fz)
  const a = g(ix, iz, fx, fz) + (g(ix + 1, iz, fx - 1, fz) - g(ix, iz, fx, fz)) * u
  const b = g(ix, iz + 1, fx, fz - 1) + (g(ix + 1, iz + 1, fx - 1, fz - 1) - g(ix, iz + 1, fx, fz - 1)) * u
  return a + (b - a) * v
}

// Fractal noise, about 0..1.
export function fbm(x, z, oct = 4) {
  let s = 0
  let a = 0.5
  let f = 1
  let n = 0
  for (let i = 0; i < oct; i++) {
    s += a * pnoise(x * f + i * 17.3, z * f - i * 9.1)
    n += a
    a *= 0.5
    f *= 2.03
  }
  return 0.5 + (s / n) * 0.8
}

// Ridged multifractal: sharp crests and gullies, each octave weighted by the
// one before so detail gathers on the ridges, as erosion leaves it.
function ridged(x, z, oct = 7) {
  let s = 0
  let a = 0.5
  let f = 1
  let w = 1
  let n = 0
  for (let i = 0; i < oct; i++) {
    let v = 1 - Math.abs(pnoise(x * f + i * 31.7, z * f + i * 11.3) * 1.45)
    v = v * v * w
    w = clamp(v * 1.7, 0, 1)
    s += v * a
    n += a
    a *= 0.52
    f *= 2.07
  }
  return s / n
}

// Where the river runs: its centre line x for a given z. Straight-ish past
// the viewer, then swinging off to the right among the hills.
export function riverX(z) {
  const t = z - 45
  const bend = Math.max(0, -z - 260)
  return 7 * Math.sin(t * 0.011) + 12 * Math.sin(t * 0.0045) + 0.0011 * bend * bend
}
// Half-width of the water.
export const riverW = (z) => 10.5 + 2.5 * Math.sin(z * 0.019 + 0.6) + 1.5 * Math.sin(z * 0.053)

export function heightAt(x, z) {
  const rx = riverX(z)
  const W = riverW(z)
  const d = Math.abs(x - rx)
  // meadows: low hummocks, rising gently away from the water
  const roll = (fbm(x * 0.018 + 4, z * 0.018 - 2) - 0.5) * 7 + (fbm(x * 0.09, z * 0.09 + 9, 3) - 0.5) * 1.1
  const meadow = 0.55 + roll * sstep(W + 2, W + 30, d) + 0.025 * Math.max(0, d - W)
  // forested hills either side of the valley
  const hill = sstep(32, 150, d) * (18 + 52 * fbm(x * 0.006 + 30, z * 0.006 - 12)) + sstep(60, 160, d) * (fbm(x * 0.03, z * 0.03 + 50) - 0.5) * 16
  // the range: domain-warped ridges, closing the valley's head and walling its sides
  const wx = x + pnoise(x * 0.0011 + 5, z * 0.0011) * 420
  const wz = z + pnoise(x * 0.0011 - 7, z * 0.0011 + 3) * 420
  const r = ridged(wx * 0.00115 + 0.3, wz * 0.00115 - 0.4)
  const head = sstep(-560, -1250, z)
  const side = sstep(260, 650, Math.abs(x - rx * 0.4))
  const range = Math.max(head * sstep(W + 30, W + 260, d), side) * (40 + 470 * Math.pow(r, 1.3))
  const land = meadow + hill + range
  // the river bed: a channel, deepest mid-stream, with lips at the banks
  const u = d / W
  const bed = -0.25 - 1.9 * (1 - u * u) + (fbm(x * 0.21, z * 0.21, 2) - 0.5) * 0.5
  const t = sstep(0.82, 1.35, u)
  return bed + (land - bed) * t
}

export function slopeAt(x, z, e = 0.8) {
  const dx = heightAt(x + e, z) - heightAt(x - e, z)
  const dz = heightAt(x, z + e) - heightAt(x, z - e)
  return Math.hypot(dx, dz) / (2 * e)
}

// The detailed ground near the river, as an indexed grid with smooth
// normals. It also returns its height grid (for the river's depth).
export function buildNear() {
  const { x0, x1, z0, z1, seg } = NEAR
  const nx = Math.round((x1 - x0) / seg) + 1
  const nz = Math.round((z1 - z0) / seg) + 1
  const pos = new Float32Array(nx * nz * 3)
  const heights = new Float32Array(nx * nz)
  for (let j = 0; j < nz; j++)
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i
      const x = x0 + ((x1 - x0) * i) / (nx - 1)
      const z = z0 + ((z1 - z0) * j) / (nz - 1)
      const y = heightAt(x, z)
      heights[k] = y
      pos[k * 3] = x
      pos[k * 3 + 1] = y
      pos[k * 3 + 2] = z
    }
  const g = gridGeometry(pos, nx, nz)
  return { geometry: g, heights, nx, nz }
}

// The far ground: a big coarse grid that carries the mountains to the
// horizon. Inside the near patch it sinks out of sight under the detailed
// ground, meeting it exactly at the patch's edge.
export function buildFar(n = 400) {
  const { x0, x1, z0, z1 } = NEAR
  const pos = new Float32Array((n + 1) * (n + 1) * 3)
  // spend more vertices near the middle, where the range is seen up close
  const warp = (t) => 0.3 * t + 0.7 * Math.sign(t) * t * t
  for (let j = 0; j <= n; j++)
    for (let i = 0; i <= n; i++) {
      const k = j * (n + 1) + i
      const x = (warp((i / n) * 2 - 1) * FAR) / 2
      const z = (warp((j / n) * 2 - 1) * FAR) / 2 - 500
      const inside = Math.min(x - x0, x1 - x, z - z0, z1 - z)
      pos[k * 3] = x
      pos[k * 3 + 1] = heightAt(x, z) - sstep(0, 12, inside) * 6
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

// The river's depth and its white-water sources, as a small texture over
// the near patch: R = ground height, G = foam where rocks break the flow.
export function buildRiverMap(near, rocks) {
  const { nx, nz, heights } = near
  const { x0, x1, z0, z1 } = NEAR
  const foam = new Float32Array(nx * nz)
  for (const rk of rocks) {
    if (rk.small || rk.y - rk.s * 0.2 > WATER_Y + 0.2) continue
    const R = rk.s * 1.15 + 0.35
    const i0 = Math.floor(((rk.x - R - x0) / (x1 - x0)) * (nx - 1))
    const i1 = Math.ceil(((rk.x + R - x0) / (x1 - x0)) * (nx - 1))
    const j0 = Math.floor(((rk.z - R - z0) / (z1 - z0)) * (nz - 1))
    const j1 = Math.ceil(((rk.z + R * 1.8 - z0) / (z1 - z0)) * (nz - 1)) // trailing downstream (+z)
    for (let j = Math.max(0, j0); j <= Math.min(nz - 1, j1); j++)
      for (let i = Math.max(0, i0); i <= Math.min(nx - 1, i1); i++) {
        const x = x0 + ((x1 - x0) * i) / (nx - 1)
        const z = z0 + ((z1 - z0) * j) / (nz - 1)
        const dz = z - rk.z
        const dd = Math.hypot(x - rk.x, dz > 0 ? dz / 1.8 : dz)
        const f = (1 - sstep(rk.s * 0.75, R, dd)) * 0.8
        const k = j * nx + i
        foam[k] = Math.max(foam[k], f)
      }
  }
  const data = new Uint16Array(nx * nz * 2)
  for (let k = 0; k < nx * nz; k++) {
    data[k * 2] = THREE.DataUtils.toHalfFloat(heights[k])
    data[k * 2 + 1] = THREE.DataUtils.toHalfFloat(foam[k])
  }
  const tex = new THREE.DataTexture(data, nx, nz, THREE.RGFormat, THREE.HalfFloatType)
  tex.magFilter = THREE.LinearFilter
  tex.minFilter = THREE.LinearFilter
  tex.needsUpdate = true
  return tex
}

export function rng(seed = 1) {
  let s = seed >>> 0 || 1
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Drop things on the ground within a box: tries random spots and keeps
// those accept() returns a truthy value for.
export function scatter(count, seed, box, accept) {
  const r = rng(seed)
  const out = []
  let tries = 0
  while (out.length < count && tries++ < count * 20) {
    const x = box[0] + r() * (box[1] - box[0])
    const z = box[2] + r() * (box[3] - box[2])
    const y = heightAt(x, z)
    const d = Math.abs(x - riverX(z)) - riverW(z)
    const v = accept(x, z, y, d, r)
    if (v) out.push({ x, y, z, v, r: r(), d })
  }
  return out
}
