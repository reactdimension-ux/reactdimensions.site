import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { fbm, heightAt, rng } from './land.js'

// Geometry grown from code for the countryside: hedgerows swept along their
// lines, sheep, wheat, wild flowers and round bales.

// ---------------------------------------------------------------- hedges

// A hedge's cross-section, across (-1..1) and up (0..1): a rounded,
// slightly undercut mound, as a hedge is after years of trimming.
const PROFILE = [
  [-0.95, -0.12],
  [-1.04, 0.3],
  [-0.92, 0.7],
  [-0.55, 0.95],
  [0, 1],
  [0.5, 0.96],
  [0.9, 0.74],
  [1.05, 0.32],
  [0.95, -0.12],
]

// One mesh for all the hedge runs: each is swept along its points, its
// height and width wandering, its ends tapering into the ground.
export function hedgeGeometry(runs) {
  const pos = []
  const col = []
  const idx = []
  const r = rng(61)
  const P = PROFILE.length
  for (const run of runs) {
    const base = pos.length / 3
    const n = run.length
    for (let k = 0; k < n; k++) {
      const [x, z] = run[k]
      const [xa, za] = run[Math.max(0, k - 1)]
      const [xb, zb] = run[Math.min(n - 1, k + 1)]
      let dx = xb - xa
      let dz = zb - za
      const l = Math.hypot(dx, dz) || 1
      dx /= l
      dz /= l
      const nx = -dz
      const nz = dx
      const taper = Math.min(1, k / 2, (n - 1 - k) / 2)
      const H = (1.6 + 1.6 * fbm(x * 0.045 + 5, z * 0.045)) * (0.35 + 0.65 * taper)
      const W = 1.0 + 0.55 * fbm(x * 0.06 - 3, z * 0.06 + 8)
      const g = heightAt(x, z)
      for (let p = 0; p < P; p++) {
        const [px, py] = PROFILE[p]
        const j = (r() - 0.5) * 0.35
        const a = px * W + j
        pos.push(x + nx * a + dx * (r() - 0.5) * 0.8, g + py * H + (py > 0 ? (r() - 0.5) * 0.3 : 0), z + nz * a + dz * (r() - 0.5) * 0.8)
        const c = 0.35 + 0.65 * Math.max(0, py)
        col.push(c, c, c)
      }
      if (k < n - 1)
        for (let p = 0; p < P - 1; p++) {
          const a = base + k * P + p
          const b = a + P
          idx.push(a, a + 1, b, a + 1, b + 1, b)
        }
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  geo.setIndex(idx)
  geo.computeVertexNormals()
  geo.computeBoundingSphere()
  return geo
}

// ---------------------------------------------------------------- sheep

function part(geo, color, { s = [1, 1, 1], p = [0, 0, 0], rx = 0, lumps = 0, seed = 1 } = {}) {
  let g = geo.index ? geo.toNonIndexed() : geo
  g.deleteAttribute('uv')
  if (lumps) {
    const r = rng(seed)
    const lat = Array.from({ length: 64 }, () => r())
    const pp = g.attributes.position
    const v = new THREE.Vector3()
    const seen = new Map()
    for (let i = 0; i < pp.count; i++) {
      v.fromBufferAttribute(pp, i)
      const key = `${v.x.toFixed(3)},${v.y.toFixed(3)},${v.z.toFixed(3)}`
      let k = seen.get(key)
      if (k === undefined) {
        k = 1 + lumps * (Math.sin(v.x * 9 + lat[0] * 6) * Math.sin(v.y * 8 + lat[1] * 6) * Math.sin(v.z * 7 + lat[2] * 6) + (lat[i % 64] - 0.5) * 0.4)
        seen.set(key, k)
      }
      v.multiplyScalar(k)
      pp.setXYZ(i, v.x, v.y, v.z)
    }
  }
  g.scale(...s)
  g.rotateX(rx)
  g.translate(...p)
  g.computeVertexNormals()
  const c = new THREE.Color(color)
  const arr = new Float32Array(g.attributes.position.count * 3)
  for (let i = 0; i < arr.length; i += 3) arr.set([c.r, c.g, c.b], i)
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3))
  return g
}

// A Suffolk-cross ewe, about 0.9 m at the shoulder: cream fleece, black
// face and legs. pose: 'graze' (head down), 'stand' (head up) or 'lie'.
export function sheepGeometry(pose = 'graze') {
  const wool = '#d9d0bd'
  const face = '#141210'
  const lie = pose === 'lie'
  const by = lie ? 0.38 : 0.66
  const parts = [part(new THREE.IcosahedronGeometry(1, 3), wool, { s: [0.4, 0.37, 0.6], p: [0, by, 0], lumps: 0.09, seed: 3 })]
  parts.push(part(new THREE.IcosahedronGeometry(1, 2), wool, { s: [0.2, 0.2, 0.2], p: [0, by + 0.12, 0.42], lumps: 0.08, seed: 5 }))
  const head = pose === 'graze' ? { p: [0, 0.3, 0.72], rx: 1.15 } : { p: [0, by + 0.3, 0.62], rx: 0.35 }
  parts.push(part(new THREE.IcosahedronGeometry(1, 2), face, { s: [0.11, 0.13, 0.21], p: head.p, rx: head.rx }))
  for (const sx of [-1, 1]) parts.push(part(new THREE.BoxGeometry(0.11, 0.035, 0.05), face, { p: [sx * 0.12, head.p[1] + (pose === 'graze' ? 0.08 : 0.06), head.p[2] - (pose === 'graze' ? 0.02 : 0.08)] }))
  if (!lie)
    for (const [x, z] of [
      [0.16, 0.34],
      [-0.16, 0.34],
      [0.15, -0.34],
      [-0.15, -0.34],
    ])
      parts.push(part(new THREE.CylinderGeometry(0.04, 0.035, 0.5, 6, 1), face, { p: [x, 0.23, z] }))
  const g = mergeGeometries(parts)
  parts.forEach((p) => p.dispose())
  return g
}

// ---------------------------------------------------------------- crops

// A clump of six wheat stalks, each a thin strip ending in an ear (two
// crossed cards). Root at the origin, about a metre tall; colour comes from
// the vertex shade times the instance tint.
export function wheatGeometry(seed = 7) {
  const r = rng(seed)
  const pos = []
  const nor = []
  const col = []
  const idx = []
  const quad = (a, b, c, d, ca, cc) => {
    const i = pos.length / 3
    for (const [p, sh] of [
      [a, ca],
      [b, ca],
      [c, cc],
      [d, cc],
    ]) {
      pos.push(...p)
      nor.push(0, 0.85, 0.53)
      col.push(sh, sh * 0.97, sh * 0.9)
    }
    idx.push(i, i + 1, i + 2, i, i + 2, i + 3)
  }
  for (let s = 0; s < 6; s++) {
    const a = r() * Math.PI * 2
    const d = Math.sqrt(r()) * 0.1
    const x0 = Math.cos(a) * d
    const z0 = Math.sin(a) * d
    const H = 0.82 + r() * 0.2
    const lx = (r() - 0.5) * 0.12
    const lz = (r() - 0.5) * 0.12
    const w = 0.006
    let prev = [x0, 0, z0]
    for (let k = 1; k <= 3; k++) {
      const t = k / 3
      const p = [x0 + lx * t * t, H * t, z0 + lz * t * t]
      quad([prev[0] - w, prev[1], prev[2]], [prev[0] + w, prev[1], prev[2]], [p[0] + w, p[1], p[2]], [p[0] - w, p[1], p[2]], 0.45 + 0.4 * (t - 1 / 3), 0.45 + 0.4 * t)
      prev = p
    }
    // the ear, nodding slightly
    const top = [prev[0] + lx * 0.3, prev[1] + 0.1, prev[2] + lz * 0.3]
    const e = 0.016
    quad([prev[0] - e, prev[1], prev[2]], [prev[0] + e, prev[1], prev[2]], [top[0] + e * 0.5, top[1], top[2]], [top[0] - e * 0.5, top[1], top[2]], 0.95, 1.1)
    quad([prev[0], prev[1], prev[2] - e], [prev[0], prev[1], prev[2] + e], [top[0], top[1], top[2] + e * 0.5], [top[0], top[1], top[2] - e * 0.5], 0.9, 1.05)
    // awns: a fine whisker off the tip
    quad([top[0] - 0.002, top[1], top[2]], [top[0] + 0.002, top[1], top[2]], [top[0] + lx * 0.2 + 0.002, top[1] + 0.06, top[2]], [top[0] + lx * 0.2 - 0.002, top[1] + 0.06, top[2]], 1.05, 1.15)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.setIndex(idx)
  g.computeBoundingSphere()
  return g
}

// A wild flower's head: a flat disc of petals at the top of a unit-tall
// stem (the instance's y scale sets the stem's height, and flattens it).
export function flowerHeadGeometry() {
  const g = new THREE.CircleGeometry(0.03, 7).rotateX(-Math.PI / 2).translate(0, 1, 0)
  g.deleteAttribute('uv')
  return g
}

// A round bale lying on its side, 1.5 m across.
export function baleGeometry() {
  return new THREE.CylinderGeometry(0.75, 0.75, 1.2, 24, 1).rotateZ(Math.PI / 2).translate(0, 0.72, 0)
}
