import * as THREE from 'three'
import { rng } from './land.js'

// Trees grown from code. A broadleaf is a recursive skeleton of tapered bark
// tubes ending in clusters of leaf cards (a painted spray of leaves on each
// card); a fir is a straight stem with whorls of drooping, crossed branch
// cards; a bush is a mound of leaf cards. Card normals point out of the
// crown rather than out of the card, so a crown shades as one soft volume,
// and inner leaves are darkened as if by the leaves around them.

// ---------------------------------------------------------------- textures

function canvas(w, h) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return [c, c.getContext('2d')]
}

function finish(c, srgb = true, repeat = false) {
  const t = new THREE.CanvasTexture(c)
  if (srgb) t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.generateMipmaps = true
  t.minFilter = THREE.LinearMipmapLinearFilter
  return t
}

function hsl(h, s, l) {
  return `hsl(${h.toFixed(1)}, ${s.toFixed(1)}%, ${l.toFixed(1)}%)`
}

// A spray of broad leaves on thin twigs.
export function leafTexture(seed = 3, hue = 92) {
  const S = 512
  const [c, g] = canvas(S, S)
  const r = rng(seed)
  g.lineCap = 'round'
  const twigs = []
  for (let k = 0; k < 7; k++) {
    const a = -Math.PI / 2 + (r() - 0.5) * 2.4
    const len = S * (0.28 + r() * 0.2)
    const x0 = S / 2 + (r() - 0.5) * 40
    const y0 = S * 0.62 + (r() - 0.5) * 40
    twigs.push([x0, y0, x0 + Math.cos(a) * len, y0 + Math.sin(a) * len])
  }
  g.strokeStyle = '#3b2f22'
  for (const [x0, y0, x1, y1] of twigs) {
    g.lineWidth = 3
    g.beginPath()
    g.moveTo(x0, y0)
    g.lineTo(x1, y1)
    g.stroke()
  }
  const leaf = (x, y, ang, L) => {
    const W = L * (0.42 + r() * 0.12)
    g.save()
    g.translate(x, y)
    g.rotate(ang)
    const l = 24 + r() * 16
    const grd = g.createLinearGradient(0, -W, 0, W)
    grd.addColorStop(0, hsl(hue + (r() - 0.5) * 18, 48 + r() * 18, l + 6))
    grd.addColorStop(1, hsl(hue + (r() - 0.5) * 18, 52 + r() * 18, l - 6))
    g.fillStyle = grd
    g.beginPath()
    g.moveTo(0, 0)
    g.bezierCurveTo(L * 0.25, -W, L * 0.75, -W * 0.8, L, 0)
    g.bezierCurveTo(L * 0.75, W * 0.8, L * 0.25, W, 0, 0)
    g.fill()
    g.strokeStyle = hsl(hue, 30, l + 14)
    g.globalAlpha = 0.5
    g.lineWidth = 1.2
    g.beginPath()
    g.moveTo(0, 0)
    g.lineTo(L * 0.92, 0)
    g.stroke()
    g.globalAlpha = 1
    g.restore()
  }
  for (let i = 0; i < 150; i++) {
    const [x0, y0, x1, y1] = twigs[Math.floor(r() * twigs.length)]
    const t = 0.15 + r() * 0.85
    const x = x0 + (x1 - x0) * t
    const y = y0 + (y1 - y0) * t
    const base = Math.atan2(y1 - y0, x1 - x0)
    leaf(x, y, base + (r() < 0.5 ? -1 : 1) * (0.5 + r() * 0.9), 34 + r() * 30)
  }
  return finish(c)
}

// A fir spray: a stem up the card with ranks of needled side shoots.
export function firTexture(seed = 5) {
  const W = 256
  const H = 512
  const [c, g] = canvas(W, H)
  const r = rng(seed)
  g.lineCap = 'round'
  const shoot = (x0, y0, ang, len, w, depth) => {
    const x1 = x0 + Math.cos(ang) * len
    const y1 = y0 + Math.sin(ang) * len
    g.strokeStyle = '#3a2c1e'
    g.lineWidth = w
    g.beginPath()
    g.moveTo(x0, y0)
    g.lineTo(x1, y1)
    g.stroke()
    // needles along the shoot
    const n = Math.floor(len / 2.2)
    for (let i = 0; i < n; i++) {
      const t = i / n
      const px = x0 + (x1 - x0) * t
      const py = y0 + (y1 - y0) * t
      for (const side of [-1, 1]) {
        const a = ang + side * (0.75 + r() * 0.35)
        const nl = (7 + r() * 6) * (1 - t * 0.45) * (depth ? 0.85 : 1)
        g.strokeStyle = hsl(150 + (r() - 0.5) * 20, 32 + r() * 18, 13 + r() * 13)
        g.lineWidth = 1.5
        g.beginPath()
        g.moveTo(px, py)
        g.lineTo(px + Math.cos(a) * nl, py + Math.sin(a) * nl)
        g.stroke()
      }
    }
    if (depth > 0) {
      const k = Math.floor(len / 26)
      for (let i = 1; i <= k; i++) {
        const t = i / (k + 1)
        for (const side of [-1, 1]) {
          if (r() < 0.15) continue
          shoot(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, ang + side * (0.75 + r() * 0.3), len * (0.42 - t * 0.25) + 8, Math.max(1, w * 0.6), depth - 1)
        }
      }
    }
  }
  shoot(W / 2, H - 4, -Math.PI / 2, H - 20, 4, 2)
  return finish(c)
}

// Bark: deep vertical furrows broken by cross cracks. Tiles around the trunk.
export function barkTextures(seed = 9) {
  const W = 256
  const H = 512
  const r = rng(seed)
  const lat = Array.from({ length: 64 }, () => r())
  const per = (u, k) => {
    // periodic 1-D noise round the trunk
    const f = u * k
    const i = Math.floor(f)
    const t = f - i
    const a = lat[i % k % 64]
    const b = lat[(i + 1) % k % 64]
    return a + (b - a) * t * t * (3 - 2 * t)
  }
  const hmap = new Float32Array(W * H)
  const vn = Array.from({ length: 256 * 256 }, () => r())
  const n2 = (x, y) => {
    const xi = Math.floor(x)
    const yi = Math.floor(y)
    const fx = x - xi
    const fy = y - yi
    const q = (a, b) => vn[(((b % 256) + 256) % 256) * 256 + (((a % 256) + 256) % 256)]
    const sx = fx * fx * (3 - 2 * fx)
    const sy = fy * fy * (3 - 2 * fy)
    return q(xi, yi) * (1 - sx) * (1 - sy) + q(xi + 1, yi) * sx * (1 - sy) + q(xi, yi + 1) * (1 - sx) * sy + q(xi + 1, yi + 1) * sx * sy
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const u = x / W
      const wob = n2(x / 18, y / 60) * 0.06
      const ridge = Math.abs(Math.sin((u + wob) * Math.PI * 14 + per(y / H, 8) * 3)) // furrows
      const crack = n2((x / W) * 16, y / 9) > 0.78 ? 0.35 : 0
      hmap[y * W + x] = Math.pow(ridge, 0.6) * 0.75 + n2(x / 6, y / 14) * 0.25 - crack
    }
  const [c, g] = canvas(W, H)
  const [cn, gn] = canvas(W, H)
  const img = g.createImageData(W, H)
  const nimg = gn.createImageData(W, H)
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const k = y * W + x
      const h = hmap[k]
      const lichen = n2(x / 20 + 50, y / 20) > 0.7 ? 1 : 0
      const v = 30 + h * 70
      img.data[k * 4] = lichen ? 95 + h * 40 : v * 1.05
      img.data[k * 4 + 1] = lichen ? 100 + h * 40 : v * 0.93
      img.data[k * 4 + 2] = lichen ? 80 + h * 30 : v * 0.8
      img.data[k * 4 + 3] = 255
      const hx = hmap[y * W + ((x + 1) % W)] - hmap[y * W + ((x - 1 + W) % W)]
      const hy = hmap[((y + 1) % H) * W + x] - hmap[((y - 1 + H) % H) * W + x]
      const nv = new THREE.Vector3(-hx * 2.2, hy * 2.2, 1).normalize()
      nimg.data[k * 4] = (nv.x * 0.5 + 0.5) * 255
      nimg.data[k * 4 + 1] = (nv.y * 0.5 + 0.5) * 255
      nimg.data[k * 4 + 2] = (nv.z * 0.5 + 0.5) * 255
      nimg.data[k * 4 + 3] = 255
    }
  g.putImageData(img, 0, 0)
  gn.putImageData(nimg, 0, 0)
  return { map: finish(c, true, true), normalMap: finish(cn, false, true) }
}

// ---------------------------------------------------------------- geometry

class Builder {
  constructor() {
    this.pos = []
    this.nor = []
    this.uv = []
    this.col = []
    this.idx = []
  }
  vert(p, n, u, v, c = 1) {
    this.pos.push(p.x, p.y, p.z)
    this.nor.push(n.x, n.y, n.z)
    this.uv.push(u, v)
    this.col.push(c, c, c)
    return this.pos.length / 3 - 1
  }
  geometry() {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3))
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3))
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2))
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3))
    g.setIndex(this.idx)
    g.computeBoundingSphere()
    return g
  }
}

// A tapered tube through points, framed by parallel transport so it never twists.
function tube(B, pts, radii, radial = 8) {
  const T = pts.map((p, i) => pts[Math.min(i + 1, pts.length - 1)].clone().sub(pts[Math.max(i - 1, 0)]).normalize())
  let N = new THREE.Vector3(1, 0, 0)
  if (Math.abs(T[0].dot(N)) > 0.9) N.set(0, 0, 1)
  N = N.sub(T[0].clone().multiplyScalar(N.dot(T[0]))).normalize()
  let along = 0
  const base = B.pos.length / 3
  const tmp = new THREE.Vector3()
  for (let i = 0; i < pts.length; i++) {
    if (i > 0) {
      N.sub(T[i].clone().multiplyScalar(N.dot(T[i]))).normalize()
      along += pts[i].distanceTo(pts[i - 1])
    }
    const Bn = T[i].clone().cross(N)
    for (let k = 0; k <= radial; k++) {
      const a = (k / radial) * Math.PI * 2
      tmp.copy(N).multiplyScalar(Math.cos(a)).addScaledVector(Bn, Math.sin(a))
      B.vert(pts[i].clone().addScaledVector(tmp, radii[i]), tmp, k / radial * Math.max(1, Math.round(radii[0] * 10)), along * 0.6)
    }
  }
  const row = radial + 1
  for (let i = 0; i < pts.length - 1; i++)
    for (let k = 0; k < radial; k++) {
      const a = base + i * row + k
      B.idx.push(a, a + row, a + 1, a + 1, a + row, a + row + 1)
    }
}

// One card: a quad centred on c, spanned by axes a and b (half-extents).
function card(B, c, a, b, n, shade, uv = [0, 0, 1, 1], shadeFoot = shade) {
  const i0 = B.vert(c.clone().sub(a).sub(b), n, uv[0], uv[1], shadeFoot)
  const i1 = B.vert(c.clone().add(a).sub(b), n, uv[2], uv[1], shadeFoot)
  const i2 = B.vert(c.clone().add(a).add(b), n, uv[2], uv[3], shade)
  const i3 = B.vert(c.clone().sub(a).add(b), n, uv[0], uv[3], shade)
  B.idx.push(i0, i1, i2, i0, i2, i3)
}

const randDir = (r) => {
  const u = r() * 2 - 1
  const a = r() * Math.PI * 2
  const s = Math.sqrt(1 - u * u)
  return new THREE.Vector3(s * Math.cos(a), u, s * Math.sin(a))
}

// Leaf cards scattered through a set of clusters; shading darkens toward
// the middle and foot of the crown.
function foliage(B, clusters, per, size, r) {
  const centre = new THREE.Vector3()
  clusters.forEach((cl) => centre.add(cl.c))
  centre.divideScalar(clusters.length)
  let R = 0
  clusters.forEach((cl) => (R = Math.max(R, cl.c.distanceTo(centre) + cl.rad)))
  let lo = Infinity
  let hi = -Infinity
  clusters.forEach((cl) => ((lo = Math.min(lo, cl.c.y - cl.rad)), (hi = Math.max(hi, cl.c.y + cl.rad))))
  for (const cl of clusters)
    for (let i = 0; i < per; i++) {
      const p = cl.c.clone().addScaledVector(randDir(r), cl.rad * Math.cbrt(r()))
      const out = p.clone().sub(centre)
      const rr = out.length() / R
      out.normalize()
      const n = out.clone().multiplyScalar(0.75).add(new THREE.Vector3(0, 0.45, 0)).normalize()
      // the card faces out of the crown, give or take
      const f = out.clone().addScaledVector(randDir(r), 0.9).normalize()
      const a = new THREE.Vector3().crossVectors(f, Math.abs(f.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0)).normalize()
      const b = new THREE.Vector3().crossVectors(a, f).normalize()
      const s = size * (0.7 + r() * 0.6)
      const rot = r() * Math.PI * 2
      const ar = a.clone().multiplyScalar(Math.cos(rot)).addScaledVector(b, Math.sin(rot)).multiplyScalar(s)
      const br = b.clone().multiplyScalar(Math.cos(rot)).addScaledVector(a, -Math.sin(rot)).multiplyScalar(s)
      const yk = (p.y - lo) / Math.max(hi - lo, 0.01)
      const shade = (0.3 + 0.7 * Math.pow(Math.min(rr, 1), 1.4)) * (0.62 + 0.38 * yk)
      card(B, p, ar, br, n, shade)
    }
}

// A broadleaf (oak/ash-like): trunk, limbs and twigs as tubes, leaves in
// clusters at the twig ends.
export function broadleaf(seed, { height = 6, spread = 1 } = {}) {
  const r = rng(seed)
  const bark = new Builder()
  const leaves = new Builder()
  const clusters = []
  const grow = (start, dir, len, rad, level) => {
    const segs = level === 0 ? 7 : 4
    const pts = [start.clone()]
    const radii = [rad]
    const p = start.clone()
    const d = dir.clone()
    for (let i = 1; i <= segs; i++) {
      d.addScaledVector(randDir(r), 0.18 + level * 0.1)
      d.y += level ? 0.06 : 0.12
      d.normalize()
      p.addScaledVector(d, len / segs)
      pts.push(p.clone())
      radii.push(rad * (1 - (0.6 * i) / segs))
    }
    if (level > 0 || rad > 0.06) tube(bark, pts, radii, level === 0 ? 10 : level === 1 ? 7 : 5)
    if (level >= 3) {
      clusters.push({ c: p.clone(), rad: 0.85 + r() * 0.5 })
      if (r() < 0.6) clusters.push({ c: pts[2].clone().addScaledVector(randDir(r), 0.3), rad: 0.7 + r() * 0.4 })
      return
    }
    const kids = level === 0 ? 4 + Math.floor(r() * 2) : 3 + Math.floor(r() * 2)
    for (let k = 0; k < kids; k++) {
      const t = level === 0 ? 0.5 + (k / kids) * 0.5 : 0.35 + r() * 0.65
      const at = Math.min(segs, Math.round(t * segs))
      const az = (k / kids) * Math.PI * 2 + r() * 0.8
      const tilt = (level === 0 ? 0.55 : 0.6) + r() * 0.45
      const side = new THREE.Vector3(Math.cos(az), 0, Math.sin(az))
      const nd = d.clone().multiplyScalar(Math.cos(tilt)).addScaledVector(side, Math.sin(tilt) * spread).normalize()
      grow(pts[at], nd, len * (level === 0 ? 0.62 : 0.66) * (0.8 + r() * 0.4), radii[at] * 0.68, level + 1)
    }
  }
  const lean = new THREE.Vector3((r() - 0.5) * 0.15, 1, (r() - 0.5) * 0.15).normalize()
  grow(new THREE.Vector3(0, -0.4, 0), lean, height, 0.3 + height * 0.025, 0)
  // root flare
  tube(bark, [new THREE.Vector3(0, -0.6, 0), new THREE.Vector3(0, 0.15, 0), new THREE.Vector3(0, 0.6, 0)], [0.58 + height * 0.03, 0.42 + height * 0.025, 0.3 + height * 0.025], 10)
  foliage(leaves, clusters, 12, 0.7, r)
  return { bark: bark.geometry(), leaves: leaves.geometry() }
}

// A fir/spruce: whorls of drooping branch cards on a straight stem.
export function conifer(seed, { height = 14 } = {}) {
  const r = rng(seed)
  const bark = new Builder()
  const leaves = new Builder()
  const base = 0.18 + height * 0.016
  const pts = []
  const radii = []
  for (let i = 0; i <= 8; i++) {
    const t = i / 8
    pts.push(new THREE.Vector3((r() - 0.5) * 0.08, -0.5 + t * height, (r() - 0.5) * 0.08))
    radii.push(base * (1 - t * 0.92))
  }
  tube(bark, pts, radii, 8)
  const crownFoot = height * (0.12 + r() * 0.1)
  let y = crownFoot
  const up = new THREE.Vector3(0, 1, 0)
  while (y < height - 0.4) {
    const t = (y - crownFoot) / (height - crownFoot)
    const len = 0.35 + height * 0.25 * Math.pow(1 - t, 1.05) * (0.85 + r() * 0.3)
    const count = 5 + Math.floor(r() * 3)
    const off = r() * Math.PI * 2
    for (let k = 0; k < count; k++) {
      const az = off + (k / count) * Math.PI * 2 + (r() - 0.5) * 0.4
      const out = new THREE.Vector3(Math.cos(az), 0, Math.sin(az))
      const droop = -0.1 - 0.45 * (1 - t) + (r() - 0.5) * 0.15
      const dir = out.clone().add(new THREE.Vector3(0, droop, 0)).normalize()
      const root = new THREE.Vector3(0, y, 0).addScaledVector(out, base * (1 - t) * 0.8)
      const mid = root.clone().addScaledVector(dir, len / 2)
      const side = new THREE.Vector3().crossVectors(dir, up).normalize()
      const w = len * 0.42 + 0.25
      const n = out.clone().multiplyScalar(0.65).add(new THREE.Vector3(0, 0.75, 0)).normalize()
      const shade = (0.55 + 0.45 * t) * (0.85 + r() * 0.3)
      // flat spray, and a second one tipped across it for depth
      card(leaves, mid, side.clone().multiplyScalar(w / 2), dir.clone().multiplyScalar(len / 2), n, shade, [0, 0, 1, 1], shade * 0.45)
      const tipped = side.clone().applyAxisAngle(dir, 1.1)
      card(leaves, mid.clone().addScaledVector(up, 0.05), tipped.multiplyScalar(w * 0.4), dir.clone().multiplyScalar(len * 0.45), n, shade * 0.9, [0, 0, 1, 1], shade * 0.4)
    }
    y += 0.32 + r() * 0.22 + height * 0.012
  }
  // leader
  const top = new THREE.Vector3(0, height - 0.6, 0)
  for (const a of [0, Math.PI / 2]) card(leaves, top, new THREE.Vector3(Math.cos(a), 0, Math.sin(a)).multiplyScalar(0.35), up.clone().multiplyScalar(0.8), up, 1, [0, 0, 1, 1], 0.7)
  return { bark: bark.geometry(), leaves: leaves.geometry() }
}

// A shrub: a low mound of leaf clusters.
export function bush(seed, { size = 1.3 } = {}) {
  const r = rng(seed)
  const leaves = new Builder()
  const clusters = []
  const n = 4 + Math.floor(r() * 3)
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2
    const d = r() * size * 0.7
    clusters.push({ c: new THREE.Vector3(Math.cos(a) * d, size * (0.35 + r() * 0.45), Math.sin(a) * d), rad: size * (0.45 + r() * 0.3) })
  }
  foliage(leaves, clusters, 16, 0.42, r)
  return { leaves: leaves.geometry() }
}

// One blade of grass, bending as it rises; uv.y runs 0 at the root to 1 at the tip.
export function bladeGeometry() {
  const segs = 4
  const pos = []
  const uv = []
  const nor = []
  const col = []
  const idx = []
  for (let i = 0; i <= segs; i++) {
    const t = i / segs
    const w = 0.035 * (1 - t * 0.85)
    const bend = t * t * 0.25
    for (const s of [-1, 1]) {
      pos.push(s * w, t, bend)
      uv.push(s < 0 ? 0 : 1, t)
      nor.push(0, 0.6, -0.8)
      const c = 0.3 + 0.7 * Math.pow(t, 0.8)
      col.push(c, c, c)
    }
  }
  for (let i = 0; i < segs; i++) {
    const a = i * 2
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.setIndex(idx)
  return g
}

// A weathered boulder: a sphere cut by a few planes (the cleaved faces of
// granite), then roughened, then sat on a flattened base.
export function boulderGeometry(seed, detail = 5) {
  const r = rng(seed)
  const g = new THREE.IcosahedronGeometry(1, detail)
  const p = g.attributes.position
  const planes = Array.from({ length: 5 + Math.floor(r() * 4) }, () => ({ n: randDir(r), o: 0.6 + r() * 0.3 }))
  const v = new THREE.Vector3()
  const lat = Array.from({ length: 512 }, () => r())
  const n3 = (x, y, z) => {
    const h = (i, j, k) => lat[((i * 73856093) ^ (j * 19349663) ^ (k * 83492791)) & 511]
    const xi = Math.floor(x)
    const yi = Math.floor(y)
    const zi = Math.floor(z)
    const fx = x - xi
    const fy = y - yi
    const fz = z - zi
    const s = (t) => t * t * (3 - 2 * t)
    const ux = s(fx)
    const uy = s(fy)
    const uz = s(fz)
    const l = (a, b, t) => a + (b - a) * t
    return l(l(l(h(xi, yi, zi), h(xi + 1, yi, zi), ux), l(h(xi, yi + 1, zi), h(xi + 1, yi + 1, zi), ux), uy), l(l(h(xi, yi, zi + 1), h(xi + 1, yi, zi + 1), ux), l(h(xi, yi + 1, zi + 1), h(xi + 1, yi + 1, zi + 1), ux), uy), uz)
  }
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i)
    const big = n3(v.x * 1.3 + 9, v.y * 1.3, v.z * 1.3) - 0.5
    v.multiplyScalar(1 + big * 0.35)
    for (const pl of planes) {
      const d = v.dot(pl.n)
      if (d > pl.o) v.addScaledVector(pl.n, -(d - pl.o) * 0.92)
    }
    const fine = (n3(v.x * 4, v.y * 4, v.z * 4) - 0.5) * 0.07 + (n3(v.x * 9 + 3, v.y * 9, v.z * 9) - 0.5) * 0.025
    v.multiplyScalar(1 + fine)
    if (v.y < -0.35) v.y = -0.35 + (v.y + 0.35) * 0.25
    p.setXYZ(i, v.x, v.y, v.z)
  }
  g.computeVertexNormals()
  return g
}

// A soft puff of cloud: lumpy-edged alpha, R channel = self-shading.
export function puffTexture() {
  const S = 256
  const [c, g] = canvas(S, S)
  const img = g.createImageData(S, S)
  const r = rng(21)
  const blobs = Array.from({ length: 14 }, () => {
    const a = r() * Math.PI * 2
    const d = r() * 0.28
    return [0.5 + Math.cos(a) * d, 0.52 + Math.sin(a) * d * 0.8, 0.14 + r() * 0.12]
  })
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const u = x / S
      const v = y / S
      let a = 0
      for (const [bx, by, br] of blobs) {
        const d = Math.hypot(u - bx, v - by) / br
        a += Math.max(0, 1 - d * d)
      }
      a = Math.min(1, a * 0.8)
      const edge = Math.max(0, 1 - Math.hypot(u - 0.5, v - 0.5) / 0.5)
      a *= Math.min(1, edge * 2.2)
      const k = (y * S + x) * 4
      // lighter toward the top of the puff
      const shade = Math.min(1, 0.35 + (1 - v) * 0.75 + (1 - a) * 0.3)
      img.data[k] = shade * 255
      img.data[k + 1] = shade * 255
      img.data[k + 2] = shade * 255
      img.data[k + 3] = Math.pow(a, 1.4) * 255
    }
  g.putImageData(img, 0, 0)
  const t = new THREE.CanvasTexture(c)
  return t
}
