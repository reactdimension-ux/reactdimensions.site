import * as THREE from 'three'
import { SPINE_TENT, markings } from './anatomy.js'

// Turns the primitive list into one skinned mesh:
//  1. sample the smoothly-blended distance field on a grid,
//  2. extract the surface with naive surface nets,
//  3. relax and re-project the vertices onto the true surface,
//  4. give every vertex skin weights, fur length, comb direction and markings
//     from the primitives nearest to it.

const RES = 0.011
const BOUNDS = { min: [-0.44, -0.02, -1.16], max: [0.44, 1.62, 1.34] }
const SKIN_SIGMA = 0.035 // softness of the blend between bones
const ATTR_SIGMA = 0.014 // softness of the blend between regions
const ATTR_REACH = 0.15
// A grid point further than this from the surface can't touch a crossing cell.
const FAR = RES * 2.5

function smin(a, b, k) {
  const h = Math.max(k - Math.abs(a - b), 0) / k
  return Math.min(a, b) - h * h * k * 0.25
}

// Precomputes what each primitive needs for fast evaluation.
function prepare(prims) {
  const q = new THREE.Quaternion()
  const m = new THREE.Matrix4()
  const Z = new THREE.Vector3(0, 0, 1)
  return prims.map((p) => {
    const o = { ...p, sub: p.op === 'sub' }
    if (p.type === 'ell') {
      if (p.dir) q.setFromUnitVectors(Z, new THREE.Vector3(...p.dir).normalize())
      else if (p.rot) q.setFromEuler(new THREE.Euler(...p.rot))
      else q.identity()
      m.makeRotationFromQuaternion(q.clone().invert())
      o.m = m.elements.slice() // world -> local rotation (column-major)
      const rr = Math.max(...p.r)
      o.lo = [p.c[0] - rr, p.c[1] - rr, p.c[2] - rr]
      o.hi = [p.c[0] + rr, p.c[1] + rr, p.c[2] + rr]
    } else {
      const { a, b, ra, rb } = p
      o.ba = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
      o.l2 = o.ba[0] ** 2 + o.ba[1] ** 2 + o.ba[2] ** 2
      o.rr = ra - rb
      o.a2 = o.l2 - o.rr * o.rr
      o.il2 = 1 / o.l2
      o.lo = [0, 1, 2].map((i) => Math.min(a[i] - ra, b[i] - rb))
      o.hi = [0, 1, 2].map((i) => Math.max(a[i] + ra, b[i] + rb))
    }
    const pad = p.k + 3 * RES
    o.flo = o.lo.map((v) => v - pad)
    o.fhi = o.hi.map((v) => v + pad)
    o.alo = o.lo.map((v) => v - ATTR_REACH)
    o.ahi = o.hi.map((v) => v + ATTR_REACH)
    return o
  })
}

function sdf(o, x, y, z) {
  if (o.type === 'ell') {
    const dx = x - o.c[0], dy = y - o.c[1], dz = z - o.c[2]
    const e = o.m
    const lx = (e[0] * dx + e[4] * dy + e[8] * dz) / o.r[0]
    const ly = (e[1] * dx + e[5] * dy + e[9] * dz) / o.r[1]
    const lz = (e[2] * dx + e[6] * dy + e[10] * dz) / o.r[2]
    const k0 = Math.sqrt(lx * lx + ly * ly + lz * lz)
    const k1 = Math.sqrt((lx * lx) / (o.r[0] * o.r[0]) + (ly * ly) / (o.r[1] * o.r[1]) + (lz * lz) / (o.r[2] * o.r[2]))
    return k1 > 1e-9 ? (k0 * (k0 - 1)) / k1 : -Math.min(...o.r)
  }
  // tapered capsule (round cone between two points)
  const pax = x - o.a[0], pay = y - o.a[1], paz = z - o.a[2]
  const [bx, by, bz] = o.ba
  const l2 = o.l2
  const yy = pax * bx + pay * by + paz * bz
  const zz = yy - l2
  const qx = pax * l2 - bx * yy, qy = pay * l2 - by * yy, qz = paz * l2 - bz * yy
  const x2 = qx * qx + qy * qy + qz * qz
  const y2 = yy * yy * l2
  const z2 = zz * zz * l2
  const k = Math.sign(o.rr) * o.rr * o.rr * x2
  if (Math.sign(zz) * o.a2 * z2 > k) return Math.sqrt(x2 + z2) * o.il2 - o.rb
  if (Math.sign(yy) * o.a2 * y2 < k) return Math.sqrt(x2 + y2) * o.il2 - o.ra
  return (Math.sqrt(x2 * o.a2 * o.il2) + yy * o.rr) * o.il2 - o.ra
}

const inBox = (lo, hi, x, y, z) => x >= lo[0] && x <= hi[0] && y >= lo[1] && y <= hi[1] && z >= lo[2] && z <= hi[2]

// Flat-ish pads: nothing goes below the ground.
const ground = (f, y) => -smin(-f, -(y - 0.003), 0.012)

// Coarse grid of the primitives whose box (lo/hi keys) reaches each cell,
// so point queries only look at their neighbours. Order is preserved.
const BUCKET = 0.06
function bucketGrid(P, lo, hi) {
  const [x0, y0, z0] = BOUNDS.min
  const n = [0, 1, 2].map((i) => Math.ceil((BOUNDS.max[i] - BOUNDS.min[i]) / BUCKET) + 1)
  const cells = Array.from({ length: n[0] * n[1] * n[2] }, () => [])
  const cell = (v, i) => Math.min(n[i] - 1, Math.max(0, Math.floor((v - BOUNDS.min[i]) / BUCKET)))
  for (const o of P) {
    const a = [0, 1, 2].map((i) => cell(o[lo][i], i))
    const b = [0, 1, 2].map((i) => cell(o[hi][i], i))
    for (let z = a[2]; z <= b[2]; z++) for (let y = a[1]; y <= b[1]; y++) for (let x = a[0]; x <= b[0]; x++) cells[x + n[0] * (y + n[1] * z)].push(o)
  }
  for (const c of cells) c.sort((p, q) => p.sub - q.sub)
  return (x, y, z) => cells[cell(x, 0) + n[0] * (cell(y, 1) + n[1] * cell(z, 2))]
}

function evalField(G, x, y, z) {
  let f = 1
  for (const o of G(x, y, z)) {
    if (!inBox(o.flo, o.fhi, x, y, z)) continue
    f = o.sub ? -smin(-f, sdf(o, x, y, z), o.k) : smin(f, sdf(o, x, y, z), o.k)
  }
  return y < 0.03 ? ground(f, y) : f
}

export function sculpt(prims, boneNames) {
  const P = prepare(prims)
  const [x0, y0, z0] = BOUNDS.min
  const nx = Math.ceil((BOUNDS.max[0] - x0) / RES) + 1
  const ny = Math.ceil((BOUNDS.max[1] - y0) / RES) + 1
  const nz = Math.ceil((BOUNDS.max[2] - z0) / RES) + 1
  const nxy = nx * ny
  const N = nxy * nz
  const field = new Float32Array(N).fill(1)

  // 1. Field. Each primitive only touches the cells in its own box.
  const range = (lo, hi, o, n) => [Math.max(0, Math.floor((lo - o) / RES)), Math.min(n - 1, Math.ceil((hi - o) / RES))]
  for (const pass of [false, true]) {
    for (const o of P) {
      if (o.sub !== pass) continue
      const [ix0, ix1] = range(o.flo[0], o.fhi[0], x0, nx)
      const [iy0, iy1] = range(o.flo[1], o.fhi[1], y0, ny)
      const [iz0, iz1] = range(o.flo[2], o.fhi[2], z0, nz)
      for (let iz = iz0; iz <= iz1; iz++) {
        const z = z0 + iz * RES
        for (let iy = iy0; iy <= iy1; iy++) {
          const y = y0 + iy * RES
          let i = ix0 + nx * (iy + ny * iz)
          for (let ix = ix0; ix <= ix1; ix++, i++) {
            const d = sdf(o, x0 + ix * RES, y, z)
            field[i] = pass ? -smin(-field[i], d, o.k) : smin(field[i], d, o.k)
          }
        }
      }
    }
  }
  for (let iz = 0; iz < nz; iz++) {
    for (let iy = 0; iy < ny; iy++) {
      const y = y0 + iy * RES
      if (y >= 0.03) break
      for (let ix = 0, i = nx * (iy + ny * iz); ix < nx; ix++, i++) field[i] = ground(field[i], y)
    }
  }

  // 2. Surface nets: one vertex per cell the surface crosses, one quad per
  //    grid edge it crosses.
  const cellV = new Int32Array(N).fill(-1)
  const verts = []
  const corner = [0, 1, nx, nx + 1, nxy, nxy + 1, nxy + nx, nxy + nx + 1]
  const EDGES = [
    [0, 1], [2, 3], [4, 5], [6, 7],
    [0, 2], [1, 3], [4, 6], [5, 7],
    [0, 4], [1, 5], [2, 6], [3, 7],
  ]
  const g = new Float32Array(8)
  for (let iz = 0; iz < nz - 1; iz++) {
    for (let iy = 0; iy < ny - 1; iy++) {
      for (let ix = 0; ix < nx - 1; ix++) {
        const i = ix + nx * (iy + ny * iz)
        if (field[i] > FAR || field[i] < -FAR) continue
        let mask = 0
        for (let c = 0; c < 8; c++) {
          const v = field[i + corner[c]]
          g[c] = v
          if (v < 0) mask |= 1 << c
        }
        if (mask === 0 || mask === 255) continue
        let sx = 0, sy = 0, sz = 0, cnt = 0
        for (const [a, b] of EDGES) {
          if (((mask >> a) & 1) === ((mask >> b) & 1)) continue
          const t = g[a] / (g[a] - g[b])
          sx += (a & 1) + ((b & 1) - (a & 1)) * t
          sy += ((a >> 1) & 1) + (((b >> 1) & 1) - ((a >> 1) & 1)) * t
          sz += ((a >> 2) & 1) + (((b >> 2) & 1) - ((a >> 2) & 1)) * t
          cnt++
        }
        cellV[i] = verts.length / 3
        verts.push(x0 + (ix + sx / cnt) * RES, y0 + (iy + sy / cnt) * RES, z0 + (iz + sz / cnt) * RES)
      }
    }
  }
  const index = []
  const dims = [nx, ny, nz]
  const st = [1, nx, nxy]
  for (let iz = 0; iz < nz; iz++) {
    for (let iy = 0; iy < ny; iy++) {
      for (let ix = 0; ix < nx; ix++) {
        const i = ix + nx * (iy + ny * iz)
        if (field[i] > FAR || field[i] < -FAR) continue
        const pc = [ix, iy, iz]
        const s0 = field[i] < 0
        for (let k = 0; k < 3; k++) {
          const u = (k + 1) % 3
          const v = (k + 2) % 3
          if (pc[k] >= dims[k] - 1 || pc[u] < 1 || pc[v] < 1 || pc[u] > dims[u] - 2 || pc[v] > dims[v] - 2) continue
          if (s0 === field[i + st[k]] < 0) continue
          const a = cellV[i - st[u] - st[v]]
          const b = cellV[i - st[v]]
          const c = cellV[i]
          const d = cellV[i - st[u]]
          if (s0) index.push(a, b, c, a, c, d)
          else index.push(a, c, b, a, d, c)
        }
      }
    }
  }

  // 3. Relax (Taubin, so it doesn't shrink) and snap back onto the surface.
  const V = verts.length / 3
  const pos = new Float32Array(verts)
  const acc = new Float32Array(V * 3)
  const cnt = new Float32Array(V)
  const relax = (lambda) => {
    acc.fill(0)
    cnt.fill(0)
    for (let t = 0; t < index.length; t += 3) {
      for (let e = 0; e < 3; e++) {
        const a = index[t + e]
        const b = index[t + ((e + 1) % 3)]
        acc[a * 3] += pos[b * 3]; acc[a * 3 + 1] += pos[b * 3 + 1]; acc[a * 3 + 2] += pos[b * 3 + 2]; cnt[a]++
        acc[b * 3] += pos[a * 3]; acc[b * 3 + 1] += pos[a * 3 + 1]; acc[b * 3 + 2] += pos[a * 3 + 2]; cnt[b]++
      }
    }
    for (let i = 0; i < V; i++) {
      if (!cnt[i]) continue
      for (let c = 0; c < 3; c++) pos[i * 3 + c] += (acc[i * 3 + c] / cnt[i] - pos[i * 3 + c]) * lambda
    }
  }
  relax(0.5)
  relax(-0.53)
  relax(0.5)
  relax(-0.53)

  const normal = new Float32Array(V * 3)
  const E = 0.0015
  const G = bucketGrid(P, 'flo', 'fhi')
  for (let i = 0; i < V; i++) {
    const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2]
    const d = evalField(G, x, y, z)
    let gx = evalField(G, x + E, y, z) - evalField(G, x - E, y, z)
    let gy = evalField(G, x, y + E, z) - evalField(G, x, y - E, z)
    let gz = evalField(G, x, y, z + E) - evalField(G, x, y, z - E)
    const gl = Math.hypot(gx, gy, gz) || 1
    gx /= gl; gy /= gl; gz /= gl
    const step = Math.max(-RES, Math.min(RES, d))
    pos[i * 3] = x - gx * step; pos[i * 3 + 1] = y - gy * step; pos[i * 3 + 2] = z - gz * step
    normal[i * 3] = gx; normal[i * 3 + 1] = gy; normal[i * 3 + 2] = gz
  }

  // 4. Per-vertex data from the nearby primitives.
  const boneIdx = Object.fromEntries(boneNames.map((n, i) => [n, i]))
  const resolveBones = (spec, z) => {
    if (Array.isArray(spec)) return spec.map(([n, w]) => [boneIdx[n], w])
    if (spec !== 'spine') return [[boneIdx[spec], 1]]
    const T = SPINE_TENT
    if (z <= T[0][1]) return [[boneIdx[T[0][0]], 1]]
    for (let j = 0; j < T.length - 1; j++) {
      if (z <= T[j + 1][1]) {
        let t = (z - T[j][1]) / (T[j + 1][1] - T[j][1])
        t = t * t * (3 - 2 * t)
        return [[boneIdx[T[j][0]], 1 - t], [boneIdx[T[j + 1][0]], t]]
      }
    }
    return [[boneIdx[T[T.length - 1][0]], 1]]
  }
  const near = bucketGrid(P.filter((o) => !o.sub), 'alo', 'ahi')
  const skinIndex = new Uint16Array(V * 4)
  const skinWeight = new Float32Array(V * 4)
  const region = new Float32Array(V * 4)
  const comb = new Float32Array(V * 3)
  const tagEar = new Float32Array(V)
  const tagTuft = new Float32Array(V)
  const bw = new Float32Array(boneNames.length)
  const ds = new Float32Array(P.length)
  for (let i = 0; i < V; i++) {
    const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2]
    const adds = near(x, y, z)
    let dmin = Infinity
    for (let j = 0; j < adds.length; j++) {
      const o = adds[j]
      ds[j] = inBox(o.alo, o.ahi, x, y, z) ? sdf(o, x, y, z) : Infinity
      if (ds[j] < dmin) dmin = ds[j]
    }
    bw.fill(0)
    const a = { mane: 0, light: 0, dark: 0, fur: 0 }
    const tg = { ear: 0, tuft: 0 }
    let cx = 0, cy = 0, cz = 0, aw = 0
    for (let j = 0; j < adds.length; j++) {
      if (ds[j] === Infinity) continue
      const o = adds[j]
      const ws = Math.exp(-(ds[j] - dmin) / SKIN_SIGMA)
      for (const [b, w] of resolveBones(o.bone, z)) bw[b] += ws * w
      const wa = Math.exp(-(ds[j] - dmin) / ATTR_SIGMA)
      aw += wa
      a.mane += o.reg.mane * wa
      a.light += o.reg.light * wa
      a.dark += o.reg.dark * wa
      a.fur += o.reg.fur * wa
      cx += o.comb[0] * wa; cy += o.comb[1] * wa; cz += o.comb[2] * wa
      if (o.tag === 'ear') tg.ear += wa
      if (o.tag === 'tuft') tg.tuft += wa
    }
    a.mane /= aw; a.light /= aw; a.dark /= aw; a.fur /= aw
    tg.ear /= aw; tg.tuft /= aw
    const n = [normal[i * 3], normal[i * 3 + 1], normal[i * 3 + 2]]
    markings([x, y, z], n, a, tg)
    region.set([a.mane, a.light, a.dark, a.fur], i * 4)
    // comb lies along the surface
    const dn = cx * n[0] + cy * n[1] + cz * n[2]
    cx -= n[0] * dn * 0.85; cy -= n[1] * dn * 0.85; cz -= n[2] * dn * 0.85
    const cl = Math.hypot(cx, cy, cz) || 1
    comb.set([cx / cl, cy / cl, cz / cl], i * 3)
    tagEar[i] = tg.ear
    tagTuft[i] = tg.tuft
    // four strongest bones
    let total = 0
    for (let s = 0; s < 4; s++) {
      let best = -1, bv = 0
      for (let b = 0; b < bw.length; b++) if (bw[b] > bv) { bv = bw[b]; best = b }
      if (best < 0) break
      skinIndex[i * 4 + s] = best
      skinWeight[i * 4 + s] = bv
      total += bv
      bw[best] = 0
    }
    for (let s = 0; s < 4; s++) skinWeight[i * 4 + s] /= total || 1
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geometry.setAttribute('normal', new THREE.BufferAttribute(normal, 3))
  geometry.setAttribute('skinIndex', new THREE.BufferAttribute(skinIndex, 4))
  geometry.setAttribute('skinWeight', new THREE.BufferAttribute(skinWeight, 4))
  geometry.setAttribute('aRegion', new THREE.BufferAttribute(region, 4))
  geometry.setAttribute('aComb', new THREE.BufferAttribute(comb, 3))
  geometry.setIndex(V > 65535 ? new THREE.Uint32BufferAttribute(index, 1) : new THREE.Uint16BufferAttribute(index, 1))
  geometry.computeBoundingSphere()

  return { geometry, count: V, position: pos, normal, region, comb, skinIndex, skinWeight, tagTuft, tagEar }
}
