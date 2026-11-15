import * as THREE from 'three'

// Savanna floor and props, all generated: dusty ground textures, dry grass
// tufts and a few weathered rocks.

function rng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function groundTextures() {
  const S = 512
  const R = rng(11)
  const make = () => {
    const c = document.createElement('canvas')
    c.width = c.height = S
    return [c, c.getContext('2d')]
  }
  const [cc, g] = make()
  const [bc, b] = make()
  g.fillStyle = '#9b8058'
  g.fillRect(0, 0, S, S)
  b.fillStyle = '#808080'
  b.fillRect(0, 0, S, S)
  // wraps every blob so the tile repeats without seams
  const blob = (ctx, x, y, r, color) => {
    for (const ox of [-S, 0, S]) {
      for (const oy of [-S, 0, S]) {
        const gr = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r)
        gr.addColorStop(0, color)
        gr.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = gr
        ctx.fillRect(x + ox - r, y + oy - r, r * 2, r * 2)
      }
    }
  }
  for (let i = 0; i < 70; i++) {
    const tone = R()
    blob(g, R() * S, R() * S, 30 + R() * 90, tone > 0.5 ? 'rgba(120,96,62,0.35)' : 'rgba(178,152,110,0.3)')
  }
  for (let i = 0; i < 2600; i++) {
    const x = R() * S
    const y = R() * S
    const r = 0.6 + R() * 2.4
    const l = R()
    g.fillStyle = l > 0.6 ? 'rgba(205,184,145,0.7)' : l > 0.3 ? 'rgba(96,76,50,0.6)' : 'rgba(140,118,84,0.6)'
    g.beginPath()
    g.arc(x, y, r, 0, Math.PI * 2)
    g.fill()
    b.fillStyle = l > 0.5 ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.5)'
    b.beginPath()
    b.arc(x, y, r, 0, Math.PI * 2)
    b.fill()
  }
  // dry stalks lying on the ground
  for (let i = 0; i < 500; i++) {
    const x = R() * S
    const y = R() * S
    const a = R() * Math.PI
    const len = 6 + R() * 16
    g.strokeStyle = R() > 0.5 ? 'rgba(201,178,120,0.55)' : 'rgba(150,125,80,0.5)'
    g.lineWidth = 0.8 + R()
    g.beginPath()
    g.moveTo(x, y)
    g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len)
    g.stroke()
  }
  const map = new THREE.CanvasTexture(cc)
  map.colorSpace = THREE.SRGBColorSpace
  const bump = new THREE.CanvasTexture(bc)
  for (const t of [map, bump]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.anisotropy = 8
  }
  return { map, bump }
}

// One tuft: a fan of tapered, bending blades with a green-to-straw gradient.
export function grassTuft() {
  const R = rng(5)
  const pos = []
  const col = []
  const idx = []
  const base = new THREE.Color('#7a7040')
  const mid = new THREE.Color('#a89252')
  const tip = new THREE.Color('#e0cd92')
  const c = new THREE.Color()
  const blades = 14
  for (let i = 0; i < blades; i++) {
    const a = R() * Math.PI * 2
    const lean = 0.15 + R() * 0.5
    const h = 0.25 + R() * 0.35
    const w = 0.012 + R() * 0.01
    const dx = Math.cos(a)
    const dz = Math.sin(a)
    const px = -dz
    const pz = dx
    const start = pos.length / 3
    const seg = 4
    for (let s = 0; s <= seg; s++) {
      const t = s / seg
      const off = lean * h * t * t
      const cx = dx * off + dx * 0.02
      const cz = dz * off + dz * 0.02
      const y = h * t * (1 - 0.2 * lean * t)
      const ww = w * (1 - t * 0.92)
      pos.push(cx + px * ww, y, cz + pz * ww, cx - px * ww, y, cz - pz * ww)
      c.copy(base).lerp(mid, Math.min(1, t * 1.6)).lerp(tip, Math.max(0, t - 0.4) / 0.6)
      col.push(c.r, c.g, c.b, c.r, c.g, c.b)
    }
    for (let s = 0; s < seg; s++) {
      const a0 = start + s * 2
      idx.push(a0, a0 + 1, a0 + 3, a0, a0 + 3, a0 + 2)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  // light grass as if lit from above, not by its flat blade normals
  const n = g.attributes.normal
  for (let i = 0; i < n.count; i++) n.setXYZ(i, n.getX(i) * 0.3, 1, n.getZ(i) * 0.3)
  n.needsUpdate = true
  return g
}

export function scatter(count, radius, seed, clearRadius = 0) {
  const R = rng(seed)
  const out = []
  while (out.length < count) {
    const r = Math.sqrt(R()) * radius
    if (r < clearRadius) continue
    const a = R() * Math.PI * 2
    out.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, rot: R() * Math.PI * 2, s: 0.6 + R() * 0.9, r: R() })
  }
  return out
}

export function rockGeometry(seed) {
  // Displacement depends only on position, so the faces' shared corners
  // (the geometry is not indexed) stay together.
  const g = new THREE.IcosahedronGeometry(1, 2)
  const p = g.attributes.position
  const v = new THREE.Vector3()
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i)
    const k = 0.75 + 0.35 * Math.sin(v.x * 2.1 + seed) * Math.cos(v.z * 1.7 - seed) + 0.08 * Math.sin(v.y * 5 + seed * 3)
    v.multiplyScalar(k)
    v.y = v.y > 0 ? v.y * 0.75 : v.y * 0.3
    p.setXYZ(i, v.x, v.y, v.z)
  }
  g.computeVertexNormals()
  return g
}
