import * as THREE from 'three'

// The badminton court's dimensions (BWF Laws of Badminton) and its generated
// maps. No image files: everything is drawn from seeds.
//
// World layout (metres): the court's length runs along x with the net on
// x = 0; the posts stand on the doubles sidelines at z = ±3.05. The court
// is a PVC sports mat laid on a varnished maple floor; the floor is at
// y = 0 and the mat's surface MAT_T above it. Court dimensions are measured
// to the outside of the 40 mm lines.

export const COURT = {
  L2: 13.4 / 2, // net to back boundary
  W2: 6.1 / 2, // half width, doubles
  S2: 5.18 / 2, // half width, singles
  short: 1.98, // net to the short service line
  longD: 0.76, // doubles long service line, in from the back boundary
  line: 0.04,
  netPost: 1.55, // net height at the posts (on the doubles sidelines)
  netCentre: 1.524, // and at the centre
  netDepth: 0.76,
  tape: 0.075, // white tape folded over the cord
  postR: 0.019,
}
export const MAT_T = 0.0045 // the mat's thickness
export const MX = COURT.L2 + 0.7 // mat half-size: it runs on past the lines
export const MZ = COURT.W2 + 0.6
export const FX = MX + 2.4 // the wooden floor round it
export const FZ = MZ + 2.0
export const SLAB = 0.07 // sprung floor depth, seen at its cut edge
// the mat comes in 1.8 m rolls laid lengthways; seams at z = -2.0, -0.2 and
// 1.6 (clear of every line)
export const ROLL = 1.8
export const ROLL0 = -2.0

export function rng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function makeNoise(seed) {
  const hash = (x, y) => {
    let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041)) | 0
    h = Math.imul(h ^ (h >>> 13), 1274126177)
    h ^= h >>> 16
    return (h >>> 0) / 4294967296
  }
  const wrap = (a, P) => (P ? ((a % P) + P) % P : a)
  const noise = (x, y, Px = 0, Py = Px) => {
    const xi = Math.floor(x)
    const yi = Math.floor(y)
    const xf = x - xi
    const yf = y - yi
    const u = xf * xf * (3 - 2 * xf)
    const v = yf * yf * (3 - 2 * yf)
    const a = hash(wrap(xi, Px), wrap(yi, Py))
    const b = hash(wrap(xi + 1, Px), wrap(yi, Py))
    const c = hash(wrap(xi, Px), wrap(yi + 1, Py))
    const d = hash(wrap(xi + 1, Px), wrap(yi + 1, Py))
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
  }
  const fbm = (x, y, oct = 4, Px = 0, Py = Px) => {
    let t = 0
    let amp = 0.5
    let f = 1
    let norm = 0
    for (let i = 0; i < oct; i++) {
      t += noise(x * f, y * f, Px ? Px * f : 0, Py ? Py * f : 0) * amp
      norm += amp
      f *= 2
      amp *= 0.5
    }
    return t / norm
  }
  return { hash, noise, fbm }
}

const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v)

function dataTexture(data, w, h, repeat) {
  const t = new THREE.DataTexture(data, w, h, THREE.RGBAFormat, THREE.UnsignedByteType)
  t.generateMipmaps = true
  t.minFilter = THREE.LinearMipmapLinearFilter
  t.magFilter = THREE.LinearFilter
  t.anisotropy = 16
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.needsUpdate = true
  return t
}

function normalsFrom(h, S, K, alb) {
  const out = new Uint8Array(S * S * 4)
  for (let j = 0; j < S; j++)
    for (let i = 0; i < S; i++) {
      const k = j * S + i
      const dx = h[j * S + ((i + 1) % S)] - h[j * S + ((i - 1 + S) % S)]
      const dy = h[((j + 1) % S) * S + i] - h[((j - 1 + S) % S) * S + i]
      const nx = -dx * K
      const ny = -dy * K
      const l = Math.hypot(nx, ny, 1)
      out[k * 4] = (nx / l * 0.5 + 0.5) * 255
      out[k * 4 + 1] = (ny / l * 0.5 + 0.5) * 255
      out[k * 4 + 2] = (1 / l * 0.5 + 0.5) * 255
      out[k * 4 + 3] = clamp(alb[k]) * 255
    }
  return out
}

// The mat's embossed "sand" finish: a dense, even field of small rounded
// pimples pressed into the PVC wear layer, with a faint calendered grain.
// Tiled every 12 cm. RGB normal, A albedo (0.5 = unchanged).
export const EMBOSS_TILE = 0.12
export function buildEmboss(seed = 5) {
  const S = 1024
  const N = makeNoise(seed)
  const r = rng(seed * 4447)
  const h = new Float32Array(S * S)
  const alb = new Float32Array(S * S)
  for (let j = 0; j < S; j++)
    for (let i = 0; i < S; i++) {
      const k = j * S + i
      h[k] = N.noise((i / S) * 180, (j / S) * 40, 180, 40) * 0.15 + N.fbm((i / S) * 12, (j / S) * 12, 3, 12) * 0.2
      alb[k] = 0.5 + (N.fbm((i / S) * 4 + 2, (j / S) * 4, 3, 4) - 0.5) * 0.06
    }
  const stamp = (cx, cy, rad, amp, da) => {
    const R = Math.ceil(rad)
    for (let y = -R; y <= R; y++)
      for (let x = -R; x <= R; x++) {
        const d2 = (x * x + y * y) / (rad * rad)
        if (d2 >= 1) continue
        const f = Math.sqrt(1 - d2)
        const xi = (((Math.round(cx) + x) % S) + S) % S
        const yi = (((Math.round(cy) + y) % S) + S) % S
        h[yi * S + xi] += amp * f * f
        alb[yi * S + xi] += da * f
      }
  }
  // a jittered grid of pimples (so the pattern reads as manufactured)
  const P = 7
  for (let y = 0; y < S; y += P)
    for (let x = 0; x < S; x += P) stamp(x + (r() - 0.5) * 4, y + (r() - 0.5) * 4, 2.2 + r() * 1.4, 0.55 + r() * 0.35, 0.03 + r() * 0.04)
  return dataTexture(normalsFrom(h, S, 4.2, alb), S, S, true)
}

// Maple strip flooring: pale, tight grain running along the board, the odd
// darker streak and pin knot. The texture spans 1.2 m along the grain and
// 0.3 m across it; each board samples its own window of it.
// R: tone (0.5 = mean), G: figure streaks.
export const GRAIN = { along: 1.2, across: 0.3 }
export function buildGrain(seed = 8) {
  const W = 2048
  const H = 512
  const N = makeNoise(seed)
  const r = rng(seed * 59)
  const out = new Uint8Array(W * H * 4)
  for (let j = 0; j < H; j++)
    for (let i = 0; i < W; i++) {
      const u = i / W
      const v = j / H
      // growth lines run along u; warp them gently across v
      const warp = N.fbm(u * 3, v * 2, 3, 3, 2) * 2.2
      const ring = v * 70 + warp * 3
      const f = ring - Math.floor(ring)
      const late = Math.pow(f, 4)
      const streak = N.noise(u * 6, v * 300, 6, 300)
      const fleck = N.noise(u * 900, v * 120, 900, 120)
      const tone = 0.5 - late * 0.16 + (streak - 0.5) * 0.12 + (fleck > 0.86 ? -0.08 : 0) + (N.fbm(u * 4, v * 6, 3, 4, 6) - 0.5) * 0.2
      const k = (j * W + i) * 4
      out[k] = clamp(tone) * 255
      out[k + 1] = clamp(0.5 + (N.fbm(u * 2 + 9, v * 20, 4, 2, 20) - 0.5) * 1.2) * 255
      out[k + 2] = 128
      out[k + 3] = 255
    }
  // a few pin knots
  for (let n = 0; n < 14; n++) {
    const cx = r() * W
    const cy = r() * H
    for (let y = -10; y <= 10; y++)
      for (let x = -30; x <= 30; x++) {
        const d = Math.hypot(x / 3, y)
        if (d > 10) continue
        const xi = ((Math.round(cx + x) % W) + W) % W
        const yi = ((Math.round(cy + y) % H) + H) % H
        const k = (yi * W + xi) * 4
        out[k] = Math.max(0, out[k] - (1 - d / 10) * 90)
      }
  }
  const t = new THREE.DataTexture(out, W, H, THREE.RGBAFormat, THREE.UnsignedByteType)
  t.generateMipmaps = true
  t.minFilter = THREE.LinearMipmapLinearFilter
  t.magFilter = THREE.LinearFilter
  t.anisotropy = 16
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.needsUpdate = true
  return t
}

// Play on the mat, over the whole mat (1.5 cm a texel):
//   R  black shoe-sole marks, in arcs where players lunge and turn
//   G  dust and polish: dull patches where feet slide
//   A  the vinyl's own mottle, roll to roll
// Built for full wear; the shader scales it.
export function buildWear(seed = 13) {
  const W = 1024
  const H = 512
  const N = makeNoise(seed)
  const r = rng(seed * 811)
  const c = Object.assign(document.createElement('canvas'), { width: W, height: H })
  const g = c.getContext('2d')
  g.fillStyle = '#000'
  g.fillRect(0, 0, W, H)
  g.setTransform(W / (2 * MX), 0, 0, -H / (2 * MZ), W / 2, H / 2)
  g.globalCompositeOperation = 'lighter'
  const blob = (x, z, rx, rz, G) => {
    const grad = g.createRadialGradient(0, 0, 0, 0, 0, 1)
    grad.addColorStop(0, `rgba(0,${Math.round(G * 255)},0,1)`)
    grad.addColorStop(1, 'rgba(0,0,0,0)')
    g.save()
    g.translate(x, z)
    g.scale(rx, rz)
    g.fillStyle = grad
    g.beginPath()
    g.arc(0, 0, 1, 0, Math.PI * 2)
    g.fill()
    g.restore()
  }
  const gauss = () => Math.sqrt(-2 * Math.log(r() + 1e-9)) * Math.cos(2 * Math.PI * r())
  const { L2, short } = COURT
  for (const s of [1, -1]) {
    // base positions: the middle of each half, the net front, the rear corners
    blob(s * 3.9, 0, 1.6, 1.4, 0.5)
    blob(s * (short + 0.3), 0, 0.9, 1.2, 0.35)
    for (const zc of [-2, 2]) blob(s * (L2 - 0.8), zc, 0.9, 0.7, 0.3)
    g.lineCap = 'round'
    for (let i = 0; i < 240; i++) {
      const k = r()
      const x = s * (k < 0.5 ? 3.9 + gauss() * 1.4 : k < 0.75 ? short + 0.4 + Math.abs(gauss()) * 0.6 : L2 - 0.7 + gauss() * 0.5)
      const z = gauss() * 1.6
      const a = r() * Math.PI * 2
      const len = 0.08 + r() * 0.35
      const bend = (r() - 0.5) * 1.2
      g.strokeStyle = `rgba(${Math.round(25 + r() * 90)},0,0,1)`
      g.lineWidth = 0.012 + r() * 0.03
      g.beginPath()
      g.moveTo(x, z)
      g.quadraticCurveTo(x + Math.cos(a) * len * 0.5, z + Math.sin(a) * len * 0.5, x + Math.cos(a + bend) * len, z + Math.sin(a + bend) * len)
      g.stroke()
    }
  }
  const px = g.getImageData(0, 0, W, H).data
  const out = new Uint8Array(W * H * 4)
  for (let j = 0; j < H; j++) {
    const src = (H - 1 - j) * W
    const z = ((j + 0.5) / H - 0.5) * 2 * MZ
    const roll = Math.floor((z - ROLL0) / ROLL)
    for (let i = 0; i < W; i++) {
      const x = ((i + 0.5) / W - 0.5) * 2 * MX
      const k = (j * W + i) * 4
      const s = (src + i) * 4
      out[k] = px[s]
      out[k + 1] = px[s + 1]
      out[k + 2] = 0
      // each roll a hair different in shade, plus a soft mottle
      out[k + 3] = clamp(0.5 + (N.hash(roll, 3) - 0.5) * 0.18 + (N.fbm(x * 0.6, z * 0.6, 4) - 0.5) * 0.35) * 255
    }
  }
  return dataTexture(out, W, H, false)
}

// Feather vane for the shuttlecocks: white goose feather with a rounded,
// slightly ragged tip, the shaft down the middle. Alpha cut-out.
export function buildFeather(seed = 3) {
  const W = 128
  const H = 256
  const r = rng(seed)
  const c = Object.assign(document.createElement('canvas'), { width: W, height: H })
  const g = c.getContext('2d')
  g.clearRect(0, 0, W, H)
  // vane outline: narrow at the quill (bottom), round at the tip (top)
  g.beginPath()
  g.moveTo(W / 2, H)
  g.bezierCurveTo(W * 0.38, H * 0.7, W * 0.02, H * 0.35, W * 0.08, H * 0.12)
  g.bezierCurveTo(W * 0.16, H * 0.0, W * 0.84, H * 0.0, W * 0.92, H * 0.12)
  g.bezierCurveTo(W * 0.98, H * 0.35, W * 0.62, H * 0.7, W / 2, H)
  g.closePath()
  g.fillStyle = '#f6f4ee'
  g.fill()
  // barbs: fine diagonal strokes
  g.globalCompositeOperation = 'source-atop'
  for (let i = 0; i < 260; i++) {
    const y = r() * H
    const side = r() < 0.5 ? -1 : 1
    g.strokeStyle = `rgba(${200 + r() * 40},${196 + r() * 40},${190 + r() * 40},0.5)`
    g.lineWidth = 0.6
    g.beginPath()
    g.moveTo(W / 2, y)
    g.lineTo(W / 2 + side * W * 0.5, y - W * 0.3)
    g.stroke()
  }
  // a few splits in the vane
  g.globalCompositeOperation = 'destination-out'
  for (let i = 0; i < 5; i++) {
    const y = H * (0.05 + r() * 0.4)
    const side = r() < 0.5 ? -1 : 1
    g.lineWidth = 1.2
    g.beginPath()
    g.moveTo(W / 2 + side * W * 0.5, y - W * 0.3)
    g.lineTo(W / 2 + side * W * (0.1 + r() * 0.2), y - W * 0.06)
    g.stroke()
  }
  // the rachis
  g.globalCompositeOperation = 'source-over'
  g.strokeStyle = 'rgba(232,228,218,1)'
  g.lineWidth = 3
  g.beginPath()
  g.moveTo(W / 2, H)
  g.lineTo(W / 2, H * 0.06)
  g.stroke()
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}
