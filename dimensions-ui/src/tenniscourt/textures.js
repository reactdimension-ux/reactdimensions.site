import * as THREE from 'three'

// The tennis court's dimensions (ITF Rules of Tennis) and its generated maps.
// No image files: everything is drawn from seeds.
//
// World layout (metres): the court's length runs along x with the net on
// x = 0 and its posts along z; the playing surface is at y = 0. Court
// dimensions are measured to the outside of the lines.

export const COURT = {
  L2: 23.77 / 2, // half length, net to baseline
  W2: 10.97 / 2, // half width, doubles
  S2: 8.23 / 2, // half width, singles
  SV: 6.4, // net to service line
  base: 0.1, // baseline width (may be up to 10 cm)
  line: 0.05, // every other line
  mark: 0.1, // centre mark length
  runBack: 6.4, // recommended run-off behind the baselines
  runSide: 3.66, // and beside the sidelines
  slab: 0.1,
  postZ: 10.97 / 2 + 0.914, // net posts stand 0.914 m outside the doubles court
  postR: 0.038,
  netPost: 1.07, // net height at the posts
  netCentre: 0.914, // and at the centre, held by the strap
}
export const HX = COURT.L2 + COURT.runBack
export const HZ = COURT.W2 + COURT.runSide

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
  const noise = (x, y, P = 0) => {
    const xi = Math.floor(x)
    const yi = Math.floor(y)
    const xf = x - xi
    const yf = y - yi
    const u = xf * xf * (3 - 2 * xf)
    const v = yf * yf * (3 - 2 * yf)
    const a = hash(wrap(xi, P), wrap(yi, P))
    const b = hash(wrap(xi + 1, P), wrap(yi, P))
    const c = hash(wrap(xi, P), wrap(yi + 1, P))
    const d = hash(wrap(xi + 1, P), wrap(yi + 1, P))
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
  }
  const fbm = (x, y, oct = 4, P = 0) => {
    let t = 0
    let amp = 0.5
    let f = 1
    let norm = 0
    for (let i = 0; i < oct; i++) {
      t += noise(x * f, y * f, P ? P * f : 0) * amp
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

// An acrylic hard court is several coats of pigmented acrylic mixed with
// silica sand, squeegeed over asphalt: up close it is a field of tiny sand
// grains under paint. Tiled every 25 cm (0.25 mm a texel).
// RGB is a normal map, A an albedo multiplier (0.5 = unchanged).
export const GRIT_TILE = 0.25
export function buildGrit(seed = 4) {
  const S = 1024
  const N = makeNoise(seed)
  const r = rng(seed * 7717)
  const h = new Float32Array(S * S)
  const alb = new Float32Array(S * S)
  for (let j = 0; j < S; j++)
    for (let i = 0; i < S; i++) {
      const k = j * S + i
      const u = i / S
      const v = j / S
      h[k] = N.fbm(u * 16, v * 16, 4, 16) * 0.35 + N.noise(u * 220, v * 220, 220) * 0.18
      alb[k] = 0.5 + (N.fbm(u * 5 + 3, v * 5, 3, 5) - 0.5) * 0.12
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
        h[yi * S + xi] += amp * f
        alb[yi * S + xi] += da * f
      }
  }
  // sand grains, rounded by the paint over them
  for (let n = 0; n < 60000; n++) stamp(r() * S, r() * S, 1.2 + r() * 2.2, 0.3 + r() * 0.7, (r() - 0.4) * 0.3)
  // a few bigger grains, and pinholes where the coating did not fill
  for (let n = 0; n < 2200; n++) stamp(r() * S, r() * S, 2.6 + r() * 2.6, 0.6 + r() * 0.6, (r() - 0.5) * 0.35)
  for (let n = 0; n < 900; n++) stamp(r() * S, r() * S, 0.8 + r() * 1.2, -0.6, -0.12)
  const out = new Uint8Array(S * S * 4)
  const K = 6.5
  for (let j = 0; j < S; j++)
    for (let i = 0; i < S; i++) {
      const k = j * S + i
      const dx = h[j * S + ((i + 1) % S)] - h[j * S + ((i - 1 + S) % S)]
      const dy = h[((j + 1) % S) * S + i] - h[((j - 1 + S) % S) * S + i]
      let nx = -dx * K
      let ny = -dy * K
      const l = Math.hypot(nx, ny, 1)
      out[k * 4] = (nx / l * 0.5 + 0.5) * 255
      out[k * 4 + 1] = (ny / l * 0.5 + 0.5) * 255
      out[k * 4 + 2] = (1 / l * 0.5 + 0.5) * 255
      out[k * 4 + 3] = clamp(alb[k] + (h[k] - 0.6) * 0.22) * 255
    }
  return dataTexture(out, S, S, true)
}

// Where play has worn the court, over the whole slab (3.6 cm a texel):
//   R  rubber from shoes, scuffed in arcs where players stop and turn
//   G  abrasion and sun: the colour coat lightened and thinned
//   B  felt from balls, smudged where they land near the lines
//   A  the acrylic's own unevenness (squeegee passes, patch repairs)
// Built for full wear; the shader scales it.
export function buildWear(seed = 11) {
  const W = 1024
  const H = 512
  const N = makeNoise(seed)
  const r = rng(seed * 991)
  const c = Object.assign(document.createElement('canvas'), { width: W, height: H })
  const g = c.getContext('2d')
  g.fillStyle = '#000'
  g.fillRect(0, 0, W, H)
  // draw in metres; row 0 is the +z edge (texture v = 1)
  g.setTransform(W / (2 * HX), 0, 0, -H / (2 * HZ), W / 2, H / 2)
  g.globalCompositeOperation = 'lighter'
  const blob = (x, z, rx, rz, ang, R, G, B) => {
    const grad = g.createRadialGradient(0, 0, 0, 0, 0, 1)
    const col = (a) => `rgba(${Math.round(R * 255)},${Math.round(G * 255)},${Math.round(B * 255)},${a})`
    grad.addColorStop(0, col(1))
    grad.addColorStop(0.5, col(0.6))
    grad.addColorStop(1, col(0))
    g.save()
    g.translate(x, z)
    g.rotate(ang)
    g.scale(rx, rz)
    g.fillStyle = grad
    g.beginPath()
    g.arc(0, 0, 1, 0, Math.PI * 2)
    g.fill()
    g.restore()
  }
  const gauss = () => Math.sqrt(-2 * Math.log(r() + 1e-9)) * Math.cos(2 * Math.PI * r())
  const { L2, SV, S2, W2 } = COURT
  for (const s of [1, -1]) {
    // the colour worn pale where players live: behind the baseline centre,
    // and less so inside it
    blob(s * (L2 + 0.7), 0, 2.0, 3.8, 0, 0, 0.75, 0)
    blob(s * (L2 - 1.2), 0, 1.6, 2.6, 0, 0, 0.3, 0)
    blob(s * (SV - 1.5), 0, 1.4, 2.2, 0, 0, 0.18, 0)
    blob(s * 2.0, 0, 1.0, 3.5, 0, 0, 0.12, 0)
    // rubber: short curved streaks, mostly sideways (players shuffle along
    // the baseline), densest just behind it
    g.lineCap = 'round'
    for (let i = 0; i < 380; i++) {
      const x = s * (L2 + 0.6 + gauss() * 1.1)
      const z = gauss() * 2.6
      const len = 0.15 + r() * 0.8
      const ang = (r() - 0.5) * 0.9 + (r() < 0.25 ? Math.PI / 2 : 0)
      const bend = (r() - 0.5) * 0.6
      g.strokeStyle = `rgba(${Math.round(30 + r() * 80)},0,0,1)`
      g.lineWidth = 0.04 + r() * 0.08
      g.beginPath()
      g.moveTo(x, z)
      g.quadraticCurveTo(x + Math.sin(ang) * len * 0.5 + bend * 0.2, z + Math.cos(ang) * len * 0.5, x + Math.sin(ang + bend) * len, z + Math.cos(ang + bend) * len)
      g.stroke()
    }
    // and wherever a point is played: a sparse scatter over the court
    for (let i = 0; i < 160; i++) {
      const x = s * (1 + r() * (L2 + 2))
      const z = (r() - 0.5) * 2 * (W2 + 1)
      const a = r() * Math.PI
      const len = 0.1 + r() * 0.35
      g.strokeStyle = `rgba(${Math.round(20 + r() * 50)},0,0,1)`
      g.lineWidth = 0.04 + r() * 0.05
      g.beginPath()
      g.moveTo(x, z)
      g.lineTo(x + Math.cos(a) * len, z + Math.sin(a) * len)
      g.stroke()
    }
    // ball marks: deep in the court near the baseline, in the service boxes
    // near the service line, and along the sidelines
    for (let i = 0; i < 260; i++) {
      const k = r()
      let x
      let z
      if (k < 0.45) {
        x = s * (L2 - 0.3 - Math.abs(gauss()) * 1.6)
        z = gauss() * 2.6
      } else if (k < 0.8) {
        x = s * (SV - 0.25 - Math.abs(gauss()) * 1.2)
        z = (r() < 0.5 ? 1 : -1) * (0.4 + r() * (S2 - 0.6))
      } else {
        x = s * r() * L2
        z = (r() < 0.5 ? 1 : -1) * (S2 - 0.2 + gauss() * 0.3)
      }
      blob(x, z, 0.035 + r() * 0.02, 0.025 + r() * 0.015, r() * 3, 0, 0, 0.5 + r() * 0.5)
    }
  }
  const px = g.getImageData(0, 0, W, H).data
  const out = new Uint8Array(W * H * 4)
  for (let j = 0; j < H; j++) {
    // data rows run from v = 0 (-z); the canvas started at +z
    const src = (H - 1 - j) * W
    const z = ((j + 0.5) / H - 0.5) * 2 * HZ
    for (let i = 0; i < W; i++) {
      const x = ((i + 0.5) / W - 0.5) * 2 * HX
      const k = (j * W + i) * 4
      const s = (src + i) * 4
      out[k] = px[s]
      out[k + 1] = px[s + 1]
      out[k + 2] = px[s + 2]
      // coats are squeegeed across the court in passes about 1.2 m wide,
      // each a touch different; plus broad mottling
      const pass = N.noise(Math.floor(z / 1.2 + N.noise(x * 0.3, 7) * 0.4) * 3.1, 3) - 0.5
      const mot = N.fbm(x * 0.35, z * 0.35, 4) - 0.5
      out[k + 3] = clamp(0.5 + pass * 0.25 + mot * 0.6 + (N.noise(x * 6, z * 6) - 0.5) * 0.12) * 255
    }
  }
  return dataTexture(out, W, H, false)
}

// The edge of the slab: the colour coats over asphalt, its stones showing.
export const ASPHALT_TILE = 1
export function buildAsphalt(seed = 6) {
  const S = 512
  const H = Math.round((S * COURT.slab) / ASPHALT_TILE)
  const N = makeNoise(seed)
  const r = rng(seed * 313)
  const c = Object.assign(document.createElement('canvas'), { width: S, height: H })
  const g = c.getContext('2d')
  const img = g.createImageData(S, H)
  for (let j = 0; j < H; j++)
    for (let i = 0; i < S; i++) {
      const v = 46 + (N.fbm((i / S) * 8, j / 6, 3, 8) - 0.5) * 30 + (N.hash(i, j) - 0.5) * 16
      const k = (j * S + i) * 4
      img.data[k] = v
      img.data[k + 1] = v * 0.98
      img.data[k + 2] = v * 0.95
      img.data[k + 3] = 255
    }
  g.putImageData(img, 0, 0)
  for (let n = 0; n < 900; n++) {
    const v = 70 + r() * 90
    g.fillStyle = `rgba(${v},${v * 0.97},${v * 0.92},0.85)`
    const x = r() * S
    const y = 3 + r() * (H - 3)
    const rad = 0.5 + r() * 1.8
    for (const o of [-S, 0, S]) {
      g.beginPath()
      g.ellipse(x + o, y, rad * (1 + r()), rad, r() * 3, 0, Math.PI * 2)
      g.fill()
    }
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = THREE.RepeatWrapping
  t.anisotropy = 8
  return t
}

// Lawn around the court for the outdoor setting, tiled every 8 m.
export const LAWN_TILE = 8
export function buildLawn(seed = 9) {
  const S = 1024
  const N = makeNoise(seed)
  const c = Object.assign(document.createElement('canvas'), { width: S, height: S })
  const g = c.getContext('2d')
  const img = g.createImageData(S, S)
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const u = x / S
      const v = y / S
      const n = N.fbm(u * 6, v * 6, 5, 6)
      const fine = N.noise(u * 380, v * 380, 380)
      const t = 0.8 + n * 0.35 + (fine - 0.5) * 0.25
      const k = (y * S + x) * 4
      img.data[k] = clamp(78 * t, 0, 255)
      img.data[k + 1] = clamp(108 * t, 0, 255)
      img.data[k + 2] = clamp(48 * t, 0, 255)
      img.data[k + 3] = 255
    }
  g.putImageData(img, 0, 0)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.anisotropy = 16
  return t
}
