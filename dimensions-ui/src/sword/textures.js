import * as THREE from 'three'

// Procedural textures for the sword: no image files.

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
const canvas = (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h })
const mk = (c, srgb) => {
  const t = new THREE.CanvasTexture(c)
  if (srgb) t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 16
  return t
}

const STEELS = {
  dark: { base: [92, 96, 102], edge: [196, 200, 206], rough: 0.36 },
  polished: { base: [168, 173, 179], edge: [222, 225, 229], rough: 0.16 },
  damascus: { base: [96, 100, 106], edge: [200, 204, 210], rough: 0.3 },
}
export const STEEL_NAMES = Object.keys(STEELS)

// The blade: u across (0 and 1 are the edges), v down it (0 at the guard).
// Forging streaks run its length; the edges are ground bright and smooth;
// the fuller is a shade darker; acid-etched knotwork sits on the flat near
// the guard and near the tip, and a band of runes runs down the fuller.
// Returns colour, roughness and bump maps.
export function bladeMaps(steel, etched) {
  const S = STEELS[steel] || STEELS.dark
  const W = 256
  const H = 2048
  const col = canvas(W, H)
  const rough = canvas(W, H)
  const bump = canvas(W, H)
  const g = col.getContext('2d')
  const q = rough.getContext('2d')
  const b = bump.getContext('2d')
  const r = rng(77)
  const Y = (s) => H * (1 - s) // v to canvas row (v = 0 is the bottom of a texture)
  // base colour and roughness, by column: bright, smooth edge bevels
  const ci = g.createImageData(W, H)
  const ri = q.createImageData(W, H)
  const bi = b.createImageData(W, H)
  const streak = new Float32Array(W)
  for (let x = 0; x < W; x++) streak[x] = r() * 2 - 1
  for (let y = 0; y < H; y++) {
    const s = 1 - y / H
    for (let x = 0; x < W; x++) {
      const u = x / (W - 1)
      const e = Math.abs(u - 0.5) * 2 // 0 at the spine, 1 at the edge
      const bevel = THREE.MathUtils.smoothstep(e, 0.7, 0.86)
      let v = S.base[0] + streak[x] * 6 + (r() - 0.5) * 6
      let tint = [0, 0, 0]
      if (steel === 'damascus') {
        // folded layers: bands that wander down the blade
        const band = Math.sin((u * 22 + Math.sin(s * 40 + u * 7) * 1.4 + Math.sin(s * 9) * 2.2) * Math.PI)
        v += band * 22
        tint = [0, 2, 6]
      }
      const fullerDark = e < 0.32 && s < 0.76 ? 10 : 0
      const c = THREE.MathUtils.lerp(v - fullerDark, S.edge[0] + (r() - 0.5) * 6, bevel)
      const i = (y * W + x) * 4
      ci.data[i] = c + tint[0]
      ci.data[i + 1] = c + (S.base[1] - S.base[0]) * (1 - bevel) + tint[1]
      ci.data[i + 2] = c + (S.base[2] - S.base[0]) * (1 - bevel) + tint[2]
      ci.data[i + 3] = 255
      const rr = THREE.MathUtils.lerp(S.rough, 0.12, bevel) + streak[x] * 0.04
      ri.data[i] = ri.data[i + 1] = ri.data[i + 2] = Math.max(0, Math.min(1, rr)) * 255
      ri.data[i + 3] = 255
      bi.data[i] = bi.data[i + 1] = bi.data[i + 2] = 128 + streak[x] * 10
      bi.data[i + 3] = 255
    }
  }
  g.putImageData(ci, 0, 0)
  q.putImageData(ri, 0, 0)
  b.putImageData(bi, 0, 0)
  // pitting and tiny forge scale on the flats
  for (let i = 0; i < 2500; i++) {
    const x = W * (0.12 + r() * 0.76)
    const y = r() * H
    g.fillStyle = `rgba(30,30,32,${0.15 + r() * 0.25})`
    g.fillRect(x, y, 1 + r() * 2, 1 + r() * 3)
    b.fillStyle = 'rgba(60,60,60,0.6)'
    b.fillRect(x, y, 1.5, 2)
  }
  if (etched) {
    // every etched line goes on all three maps: dark, matt, sunk
    const etch = (fn) => {
      for (const [ctx, style, lw] of [
        [g, 'rgba(26,27,30,0.92)', 3.2],
        [q, 'rgb(190,190,190)', 3.6],
        [b, 'rgb(40,40,40)', 3.6],
      ]) {
        ctx.save()
        ctx.strokeStyle = style
        ctx.fillStyle = style
        ctx.lineWidth = lw
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        fn(ctx)
        ctx.restore()
      }
    }
    // knotwork: an interlaced chain of loops between two border lines
    const knot = (ctx, s0, s1) => {
      const x0 = W * 0.16
      const x1 = W * 0.84
      ctx.beginPath()
      ctx.moveTo(x0, Y(s0))
      ctx.lineTo(x0, Y(s1))
      ctx.moveTo(x1, Y(s0))
      ctx.lineTo(x1, Y(s1))
      ctx.stroke()
      const n = 5
      const h = (Y(s0) - Y(s1)) / n
      for (let k = 0; k < n; k++) {
        const yy = Y(s1) + h * k
        const cx = W / 2
        ctx.beginPath()
        ctx.moveTo(x0 + 8, yy + 6)
        ctx.bezierCurveTo(cx, yy - h * 0.2, cx, yy + h * 1.2, x1 - 8, yy + h - 6)
        ctx.moveTo(x1 - 8, yy + 6)
        ctx.bezierCurveTo(cx, yy - h * 0.2, cx, yy + h * 1.2, x0 + 8, yy + h - 6)
        ctx.stroke()
        ctx.beginPath()
        ctx.ellipse(cx, yy + h / 2, W * 0.07, h * 0.18, 0, 0, Math.PI * 2)
        ctx.stroke()
      }
    }
    etch((ctx) => knot(ctx, 0.03, 0.15))
    etch((ctx) => knot(ctx, 0.76, 0.86))
    // a closing triangle of lines toward the tip, as in old pattern-etching
    etch((ctx) => {
      ctx.beginPath()
      ctx.moveTo(W * 0.2, Y(0.87))
      ctx.lineTo(W / 2, Y(0.95))
      ctx.lineTo(W * 0.8, Y(0.87))
      ctx.stroke()
    })
    // runes down the fuller
    const RUNES = ['M0 0 L0 1 M0 0 L0.5 0.3', 'M0 0 L0 1 M0 0.3 L0.5 0 M0 0.3 L0.5 0.6', 'M0 0 L0.5 1 M0.5 0 L0 1', 'M0 0 L0 1 M0 0 L0.5 0.5 L0 1', 'M0.25 0 L0.25 1 M0 0.25 L0.5 0.5', 'M0 0 L0.5 0.5 L0 1 M0.5 0 L0.5 1']
    etch((ctx) => {
      let k = 0
      for (let s = 0.19; s < 0.7; s += 0.022) {
        const p = new Path2D(RUNES[(k++ * 7) % RUNES.length])
        ctx.save()
        ctx.translate(W / 2 - 9, Y(s) - 14)
        ctx.scale(28, 28)
        ctx.lineWidth = 3.2 / 28
        ctx.stroke(p)
        ctx.restore()
      }
    })
  }
  const maps = { map: mk(col, true), roughnessMap: mk(rough), bumpMap: mk(bump) }
  return maps
}

// Aged bronze: a mottled patina in the hollows, worn bright on the high
// points. A colour map (for world-ish UVs) and a bump map of casting texture.
export function bronzeMaps(colour) {
  const S = 256
  const c = canvas(S, S)
  const bm = canvas(S, S)
  const g = c.getContext('2d')
  const b = bm.getContext('2d')
  const r = rng(5)
  g.fillStyle = colour
  g.fillRect(0, 0, S, S)
  b.fillStyle = '#808080'
  b.fillRect(0, 0, S, S)
  for (let i = 0; i < 1600; i++) {
    const x = r() * S
    const y = r() * S
    const rad = 2 + r() * 14
    const grd = g.createRadialGradient(x, y, 0, x, y, rad)
    grd.addColorStop(0, r() < 0.5 ? 'rgba(20,15,10,0.18)' : 'rgba(255,230,180,0.08)')
    grd.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = grd
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2)
    b.fillStyle = `rgba(${r() < 0.5 ? '60,60,60' : '200,200,200'},0.25)`
    b.beginPath()
    b.arc(x, y, rad * 0.25, 0, Math.PI * 2)
    b.fill()
  }
  const t = mk(c, true)
  const tb = mk(bm)
  for (const x of [t, tb]) {
    x.wrapS = x.wrapT = THREE.RepeatWrapping
    x.repeat.set(3, 3)
  }
  return { map: t, bumpMap: tb }
}

// The medallion's chasing: a spiral and petals, as a bump map.
export function medallionBump() {
  const S = 256
  const c = canvas(S, S)
  const g = c.getContext('2d')
  g.fillStyle = '#9a9a9a'
  g.fillRect(0, 0, S, S)
  g.strokeStyle = '#303030'
  g.lineWidth = 5
  g.lineCap = 'round'
  g.beginPath()
  for (let a = 0; a < Math.PI * 6; a += 0.05) {
    const rr = 8 + a * 5
    const x = S / 2 + Math.cos(a) * rr
    const y = S / 2 + Math.sin(a) * rr
    a ? g.lineTo(x, y) : g.moveTo(x, y)
  }
  g.stroke()
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2
    g.beginPath()
    g.ellipse(S / 2 + Math.cos(a) * 104, S / 2 + Math.sin(a) * 104, 18, 8, a, 0, Math.PI * 2)
    g.stroke()
  }
  g.beginPath()
  g.arc(S / 2, S / 2, 122, 0, Math.PI * 2)
  g.stroke()
  return mk(c)
}
