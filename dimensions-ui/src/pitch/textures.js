import * as THREE from 'three'

// Everything about the pitch's surface is generated here, from the Laws of
// Cricket dimensions and a few random seeds: no image files.
//
// World layout (metres): the pitch runs along z, centred on the origin, with
// its top surface at y = 0. The stumps stand on the bowling creases at
// z = ±10.06 (20.12 m apart), the popping creases are 1.22 m in front of them,
// and the return creases sit 1.32 m either side of the middle stump.

export const PITCH = {
  len: 20.12, // bowling crease to bowling crease (22 yards)
  w: 3.05, // 10 feet
  behind: 1.5, // turf kept behind each set of stumps
  popping: 1.22,
  returnX: 1.32,
  line: 0.05, // crease markings
  slab: 0.16, // depth of the cut-out block of soil
}
export const LEN = PITCH.len + 2 * PITCH.behind
export const STUMPS_Z = PITCH.len / 2
export const POPPING_Z = STUMPS_Z - PITCH.popping
// stumps: 71.1 cm tall, 22.86 cm across the outside of the three
export const STUMP = { h: 0.711, r: 0.0182 }
export const STUMP_X = [-(0.2286 / 2 - STUMP.r), 0, 0.2286 / 2 - STUMP.r]
export const BAIL = { len: 0.1111 }

// macro maps: one texel is about 6 mm of pitch
const MW = 512
const MH = 4096
// low-resolution fields (grass cover, dryness) blended up into them
const FW = 128
const FH = 1024

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

// integer-hashed value noise; `P` makes it repeat every P cells (for tiles)
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
    const x0 = wrap(xi, P)
    const x1 = wrap(xi + 1, P)
    const y0 = wrap(yi, P)
    const y1 = wrap(yi + 1, P)
    const a = hash(x0, y0)
    const b = hash(x1, y0)
    const c = hash(x0, y1)
    const d = hash(x1, y1)
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
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}
const gauss = (x, m, s) => Math.exp(-((x - m) * (x - m)) / (2 * s * s))
const mix = (a, b, t) => a + (b - a) * t

function canvas(w, h) {
  return Object.assign(document.createElement('canvas'), { width: w, height: h })
}

function bilinear(arr, W, H, fx, fy) {
  fx = clamp(fx, 0, W - 1.001)
  fy = clamp(fy, 0, H - 1.001)
  const x0 = Math.floor(fx)
  const y0 = Math.floor(fy)
  const tx = fx - x0
  const ty = fy - y0
  const i = y0 * W + x0
  const a = arr[i] + (arr[i + 1] - arr[i]) * tx
  const b = arr[i + W] + (arr[i + W + 1] - arr[i + W]) * tx
  return a + (b - a) * ty
}

function dataTexture(data, w, h, { srgb = false, repeat = false } = {}) {
  const t = new THREE.DataTexture(data, w, h, THREE.RGBAFormat, THREE.UnsignedByteType)
  if (srgb) t.colorSpace = THREE.SRGBColorSpace
  t.generateMipmaps = true
  t.minFilter = THREE.LinearMipmapLinearFilter
  t.magFilter = THREE.LinearFilter
  t.anisotropy = 16
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.needsUpdate = true
  return t
}

// colours, sRGB 0-255
const SOIL_DAMP = [126, 102, 70]
const SOIL_DRY = [201, 182, 143]
const SOIL_FOOT = [104, 80, 54]
const GRASS_LUSH = [88, 112, 46]
const GRASS_OLIVE = [128, 130, 66]
const GRASS_STRAW = [176, 160, 104]
const PAINT = [240, 239, 232]

// Builds the pitch surface for a given state:
//   wear  0 = a freshly prepared first-morning pitch, 1 = a cracked day-five one
//   grass 0 = shaved bare, 1 = a green seamer
// Returns the colour map, a data map (R height for bump, G roughness,
// B grass cover, A crease paint) and the footmark depth used to dent the mesh.
export function buildPitchTextures({ wear = 0.45, grass = 0.6, seed = 7 } = {}) {
  const W = PITCH.w
  const L = LEN
  const N = makeNoise(seed)

  // ---- 1. broad fields at low resolution ----
  const cov = new Float32Array(FW * FH)
  const dry = new Float32Array(FW * FH)
  const wfield = new Float32Array(FW * FH)
  const und = new Float32Array(FW * FH)
  for (let j = 0; j < FH; j++) {
    const z = L / 2 - ((j + 0.5) / FH) * L
    for (let i = 0; i < FW; i++) {
      const x = ((i + 0.5) / FW) * W - W / 2
      const ax = Math.abs(x)
      const d = STUMPS_Z - Math.abs(z) // distance in from the nearer stumps
      // where the game is played: a strip down the middle, worst at the
      // creases (feet) and on a good length (the ball)
      const strip = 1 - smooth(0.3, 1.25, ax)
      const between = smooth(-0.4, 0.5, d)
      const zone = 0.3 + 0.95 * gauss(d, 1.5, 0.9) + 0.75 * gauss(d, 5.5, 2.0)
      const wf = strip * between * zone
      const patch = N.fbm(x * 1.1 + 3.1, z * 0.45, 4)
      const mid = N.fbm(x * 4 + 11, z * 3, 3)
      let c = grass * (0.2 + 1.15 * patch) + (mid - 0.5) * 0.35
      c *= 1 - Math.min(1, wf * (0.25 + 0.95 * wear))
      c += grass * 0.4 * smooth(1.0, 1.5, ax) + grass * 0.35 * smooth(0, -0.6, d)
      const k = j * FW + i
      cov[k] = clamp(c)
      dry[k] = clamp(0.18 + 0.55 * wear + (N.fbm(x * 1.7 + 5, z * 0.9 + 2, 4) - 0.5) * 0.75 + wf * 0.25 * wear)
      wfield[k] = wf
      und[k] = N.fbm(x * 0.8 + 40, z * 0.8, 3)
    }
  }

  // ---- 2. drawn marks: footmarks, ball marks, stump holes, creases ----
  // Both canvases are laid out like the data textures (row 0 is the +z end)
  // and drawn in metres.
  const toPx = (g) => g.setTransform(MW / W, 0, 0, -MH / L, MW / 2, MH / 2)
  const marks = canvas(MW, MH)
  const mg = marks.getContext('2d')
  mg.fillStyle = '#000'
  mg.fillRect(0, 0, MW, MH)
  toPx(mg)
  mg.globalCompositeOperation = 'lighter'
  // a soft oval, adding to R (scuffed soil), G (depth) and B (spike holes)
  const blob = (cx, cz, rx, rz, ang, R, G, B = 0) => {
    const grad = mg.createRadialGradient(0, 0, 0, 0, 0, 1)
    const c = (a) => `rgba(${Math.round(R * 255)},${Math.round(G * 255)},${Math.round(B * 255)},${a})`
    grad.addColorStop(0, c(1))
    grad.addColorStop(0.55, c(0.7))
    grad.addColorStop(1, c(0))
    mg.save()
    mg.translate(cx, cz)
    mg.rotate(ang)
    mg.scale(rx, rz)
    mg.fillStyle = grad
    mg.beginPath()
    mg.arc(0, 0, 1, 0, Math.PI * 2)
    mg.fill()
    mg.restore()
  }
  // a spiked shoe: forefoot and heel, with a few spike holes
  const shoe = (r, x, z, ang, k) => {
    const ca = Math.cos(ang)
    const sa = Math.sin(ang)
    const at = (along, across) => [x + sa * along + ca * across, z + ca * along - sa * across]
    const [fx, fz] = at(0.05, 0)
    const [hx, hz] = at(-0.1, 0)
    blob(fx, fz, 0.055, 0.1, -ang, 0.32 * k, 0.35 * k)
    blob(hx, hz, 0.042, 0.05, -ang, 0.24 * k, 0.25 * k)
    for (let i = 0; i < 6; i++) {
      const [sx, sz] = at(0.0 + r() * 0.12, (r() - 0.5) * 0.07)
      blob(sx, sz, 0.006, 0.006, 0, 0.1 * k, 0.1 * k, 0.8 * k)
    }
  }
  const gaussR = (r) => Math.sqrt(-2 * Math.log(r() + 1e-9)) * Math.cos(2 * Math.PI * r())

  for (const s of [1, -1]) {
    const zAt = (d) => s * (STUMPS_Z - d) // d: distance in from these stumps
    // the batter's crease: feet shuffling round the popping crease
    {
      const r = rng(seed * 31 + (s > 0 ? 1 : 2))
      const n = Math.round(10 + 80 * wear)
      for (let i = 0; i < n; i++) {
        const x = -0.05 + gaussR(r) * 0.2
        const d = PITCH.popping + gaussR(r) * 0.22
        shoe(r, x, zAt(d), Math.PI / 2 + (r() - 0.5) * 1.2, 0.5 + r() * 0.6)
      }
      // the guard mark scratched in behind the crease
      mg.strokeStyle = `rgba(${Math.round(120 + 100 * wear)},${Math.round(90 + 60 * wear)},0,1)`
      mg.lineWidth = 0.014
      mg.beginPath()
      mg.moveTo(0.03, zAt(PITCH.popping - 0.02))
      mg.lineTo(0.035, zAt(PITCH.popping - 0.32))
      mg.stroke()
    }
    // bowlers delivering from this end: back foot by the return crease,
    // front foot just over the popping crease, then the follow-through
    // veering off the line of the stumps (that trail is "the rough")
    {
      const r = rng(seed * 57 + (s > 0 ? 3 : 4))
      const passes = Math.round(5 + 45 * wear)
      for (let p = 0; p < passes; p++) {
        const side = r() < 0.8 ? 1 : -1
        const k0 = 0.6 + r() * 0.5
        shoe(r, side * (0.5 + r() * 0.3), zAt(0.15 + r() * 0.5), (r() - 0.5) * 0.8 + side * 0.4, k0 * 0.8)
        let x = side * (0.12 + r() * 0.25)
        let d = 1.25 + r() * 0.35
        for (let step = 0; step < 5; step++) {
          shoe(r, x + (step % 2 ? 0.08 : -0.08) * side, zAt(d), (r() - 0.5) * 0.4 + side * 0.15, k0 * (1 - step * 0.16))
          d += 0.75 + r() * 0.25
          x += side * (0.1 + r() * 0.08)
        }
      }
    }
    // the ball landing on a length (bowled from the far end)
    {
      const r = rng(seed * 83 + (s > 0 ? 5 : 6))
      const n = Math.round(8 + 140 * wear)
      for (let i = 0; i < n; i++) {
        const d = clamp(5.2 + gaussR(r) * 1.4, 2.2, 9)
        const x = 0.08 + gaussR(r) * 0.17
        const k = 0.5 + r() * 0.5
        blob(x, zAt(d), 0.024, 0.036, (r() - 0.5) * 0.3, 0.4 * k, 0.3 * k)
        // the skid as it leaves the surface, towards the stumps
        blob(x, zAt(d - 0.05), 0.015, 0.05, 0, 0.15 * k, 0.05 * k)
      }
    }
    // where the stumps go into the ground, and the umpire behind them
    for (const sx of STUMP_X) blob(sx, zAt(0), 0.03, 0.03, 0, 0.9, 0.5)
    {
      const r = rng(seed * 97 + (s > 0 ? 7 : 8))
      for (let i = 0; i < Math.round(4 + 14 * wear); i++) shoe(r, (r() - 0.5) * 0.6, zAt(-0.6 - r() * 0.6), (r() - 0.5) * 0.8, 0.4)
    }
  }

  // creases, painted on
  const paintC = canvas(MW, MH)
  const pg = paintC.getContext('2d')
  pg.fillStyle = '#000'
  pg.fillRect(0, 0, MW, MH)
  toPx(pg)
  pg.fillStyle = '#fff'
  const rect = (x0, z0, x1, z1) => pg.fillRect(x0, z0, x1 - x0, z1 - z0)
  const lw = PITCH.line
  for (const s of [1, -1]) {
    // bowling crease through the stumps, between the return creases
    rect(-PITCH.returnX, s * STUMPS_Z - lw / 2, PITCH.returnX, s * STUMPS_Z + lw / 2)
    // popping crease: its back edge is the crease, 1.22 m out
    rect(-W / 2, s * POPPING_Z, W / 2, s * (POPPING_Z - lw))
    // return creases, from the popping crease to 2.44 m behind it
    for (const sx of [1, -1]) rect(sx * PITCH.returnX, s * (POPPING_Z - lw), sx * (PITCH.returnX + lw), s * (POPPING_Z + 2.44))
  }

  const md = mg.getImageData(0, 0, MW, MH).data
  const pd = pg.getImageData(0, 0, MW, MH).data

  // ---- 3. compose, texel by texel ----
  const col = new Uint8Array(MW * MH * 4)
  const dat = new Uint8Array(MW * MH * 4)
  const dent = new Float32Array(MW * MH)
  const texel = W / MW
  // dry pitches crack into a network of plates: the edges of a Voronoi
  // pattern, warped, and only where the surface has dried out
  const cellHash = (x, y, k) => N.hash(x * 7 + k, y * 13 - k)
  const crackEdge = (x, z, cell) => {
    const gx = Math.floor(x / cell)
    const gz = Math.floor(z / cell)
    let f1 = 1e9
    let f2 = 1e9
    for (let dz = -1; dz <= 1; dz++)
      for (let dx = -1; dx <= 1; dx++) {
        const cx = gx + dx
        const cz = gz + dz
        const px = (cx + 0.15 + 0.7 * cellHash(cx, cz, 1)) * cell
        const pz = (cz + 0.15 + 0.7 * cellHash(cx, cz, 2)) * cell
        const dd = (px - x) * (px - x) + (pz - z) * (pz - z)
        if (dd < f1) {
          f2 = f1
          f1 = dd
        } else if (dd < f2) f2 = dd
      }
    return Math.sqrt(f2) - Math.sqrt(f1)
  }
  for (let j = 0; j < MH; j++) {
    const z = L / 2 - ((j + 0.5) / MH) * L
    const fy = ((j + 0.5) / MH) * FH - 0.5
    for (let i = 0; i < MW; i++) {
      const x = ((i + 0.5) / MW) * W - W / 2
      const fx = ((i + 0.5) / MW) * FW - 0.5
      const k = (j * MW + i) * 4
      const c0 = bilinear(cov, FW, FH, fx, fy)
      const dr = bilinear(dry, FW, FH, fx, fy)
      const wv = bilinear(wfield, FW, FH, fx, fy)
      const scuff = md[k] / 255
      const dn = md[k + 1] / 255
      const spike = md[k + 2] / 255
      const m1 = N.noise(x * 22 + 7, z * 22)
      const m2 = N.noise(x * 65, z * 65 + 3)
      const wn = N.hash(i, j + 9000)

      let crack = 0
      const ca = wear * 1.3 + wv * 0.5 - 0.78 + (m1 - 0.5) * 0.45
      if (ca > 0 && Math.abs(z) < STUMPS_Z + 0.4) {
        const wx = x + (N.noise(x * 9, z * 9 + 50) - 0.5) * 0.06
        const wz = z + (N.noise(x * 9 + 50, z * 9) - 0.5) * 0.06
        const e = crackEdge(wx, wz, 0.2)
        const wdt = 0.0006 + 0.0022 * wear * (0.5 + m2)
        crack = (1 - smooth(wdt, wdt + texel, e)) * Math.min(1, ca * 2.2)
        if (wear > 0.55) {
          const e2 = crackEdge(wx * 1.03 + 3, wz + 7, 0.075)
          crack = Math.max(crack, (1 - smooth(0.0008, 0.0008 + texel, e2)) * Math.min(1, (ca - 0.25) * 2) * 0.55)
        }
        crack *= (1 - c0 * 0.85) * smooth(0.3, 0.55, N.noise(x * 6 + 20, z * 6))
      }

      const covE = clamp(c0 * (1 - scuff * 1.4) - crack)
      // bare soil: bleached where dry, darker and redder where feet turned it
      const tone = 0.9 + 0.2 * m1 + (m2 - 0.5) * 0.1 + (wn - 0.5) * 0.07
      const fs = Math.min(1, scuff * 1.15) * 0.85
      const gT = clamp(dr * 0.8 + (m1 - 0.5))
      const sT = clamp(wear * 0.6 + (m2 - 0.5) * 0.5 - c0 * 0.3) * 0.6
      let p = pd[k] / 255
      if (p > 0.01) p = clamp((p - 0.5 + (m2 - 0.5) * 0.6 + (wn - 0.5) * 0.35) * 2.4 + 0.5) * (1 - scuff * 0.6) * (1 - crack)
      const shade = (1 - crack * 0.6) * (1 - spike * 0.35)
      for (let ch = 0; ch < 3; ch++) {
        let soil = mix(SOIL_DAMP[ch], SOIL_DRY[ch], dr) * tone
        soil = mix(soil, SOIL_FOOT[ch], fs)
        let gr = mix(GRASS_LUSH[ch], GRASS_OLIVE[ch], gT)
        gr = mix(gr, GRASS_STRAW[ch], sT) * (0.92 + 0.16 * m2)
        let v = mix(soil, gr, covE * 0.8) * shade
        v = mix(v, PAINT[ch] * (0.95 + 0.05 * wn), p * 0.93)
        col[k + ch] = clamp(v, 0, 255)
      }
      col[k + 3] = 255
      const h = 0.55 + (m2 - 0.5) * 0.14 + (wn - 0.5) * 0.06 - crack * 0.35 - spike * 0.25 - dn * 0.1 + p * 0.04 + scuff * (m1 - 0.5) * 0.3
      const rough = clamp(0.83 + dr * 0.1 - (1 - covE) * (1 - scuff) * (1 - wear) * 0.1 + crack * 0.1 + covE * 0.04 - p * 0.1)
      dat[k] = clamp(h) * 255
      dat[k + 1] = rough * 255
      dat[k + 2] = covE * 255
      dat[k + 3] = p * 255
      dent[j * MW + i] = dn
    }
  }

  const color = dataTexture(col, MW, MH, { srgb: true })
  const data = dataTexture(dat, MW, MH)

  // the height of the surface: footmarks and ball marks pressed in a
  // centimetre or so, and the gentle unevenness of a rolled pitch
  const heightAt = (x, z) => {
    const px = ((x + W / 2) / W) * MW - 0.5
    const py = ((L / 2 - z) / L) * MH - 0.5
    let sum = 0
    let n = 0
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        const xi = Math.round(px) + dx
        const yi = Math.round(py) + dy
        if (xi < 0 || yi < 0 || xi >= MW || yi >= MH) continue
        sum += dent[yi * MW + xi]
        n++
      }
    const depth = n ? (sum / n) * 0.009 : 0
    const u = (bilinear(und, FW, FH, ((x + W / 2) / W) * FW - 0.5, ((L / 2 - z) / L) * FH - 0.5) - 0.5) * 0.005
    const edge = Math.min(1, (W / 2 - Math.abs(x)) / 0.04, (L / 2 - Math.abs(z)) / 0.04)
    return (u - depth) * clamp(edge)
  }

  return {
    color,
    data,
    heightAt,
    dispose() {
      color.dispose()
      data.dispose()
    },
  }
}

// Close-up soil, tiled every half metre: crumbs, grit, small stones and pits.
// RGB is a normal map; A is an albedo multiplier (0.5 = unchanged).
export const DETAIL_TILE = 0.5
export function buildDetail(seed = 3) {
  const S = 1024
  const N = makeNoise(seed)
  const r = rng(seed * 4099)
  const h = new Float32Array(S * S)
  const alb = new Float32Array(S * S)
  for (let j = 0; j < S; j++)
    for (let i = 0; i < S; i++) {
      const u = i / S
      const v = j / S
      const k = j * S + i
      h[k] = N.fbm(u * 8, v * 8, 5, 8) * 0.55 + N.noise(u * 96, v * 96, 96) * 0.22
      alb[k] = 0.5 + (N.fbm(u * 6 + 0.5, v * 6, 4, 6) - 0.5) * 0.35
    }
  // stamp a dome (positive) or pit (negative) of radius rad at (cx, cy), wrapping
  const stamp = (cx, cy, rad, amp, da) => {
    const R = Math.ceil(rad)
    for (let y = -R; y <= R; y++)
      for (let x = -R; x <= R; x++) {
        const d2 = (x * x + y * y) / (rad * rad)
        if (d2 >= 1) continue
        const f = Math.sqrt(1 - d2)
        const xi = (((Math.round(cx) + x) % S) + S) % S
        const yi = (((Math.round(cy) + y) % S) + S) % S
        const k = yi * S + xi
        h[k] += amp * f
        alb[k] += da * Math.min(1, f * 2)
      }
  }
  for (let n = 0; n < 9000; n++) stamp(r() * S, r() * S, 1.2 + r() * 3, 0.15 + r() * 0.3, (r() - 0.45) * 0.25)
  for (let n = 0; n < 260; n++) stamp(r() * S, r() * S, 3 + r() * 7, 0.4 + r() * 0.6, (r() - 0.5) * 0.5)
  for (let n = 0; n < 2600; n++) stamp(r() * S, r() * S, 1 + r() * 1.6, -(0.2 + r() * 0.3), -0.15)
  // hairline cracks in the crust
  for (let n = 0; n < 34; n++) {
    let x = r() * S
    let y = r() * S
    let a = r() * Math.PI * 2
    const steps = 30 + r() * 90
    for (let s = 0; s < steps; s++) {
      a += (r() - 0.5) * 0.7
      x += Math.cos(a) * 1.5
      y += Math.sin(a) * 1.5
      stamp(x, y, 1.1, -0.25, -0.18)
    }
  }
  const out = new Uint8Array(S * S * 4)
  const K = 11
  for (let j = 0; j < S; j++)
    for (let i = 0; i < S; i++) {
      const k = j * S + i
      const dx = h[j * S + ((i + 1) % S)] - h[j * S + ((i - 1 + S) % S)]
      const dy = h[((j + 1) % S) * S + i] - h[((j - 1 + S) % S) * S + i]
      let nx = -dx * K
      let ny = -dy * K
      let nz = 1
      const l = Math.hypot(nx, ny, nz)
      nx /= l
      ny /= l
      nz /= l
      out[k * 4] = (nx * 0.5 + 0.5) * 255
      out[k * 4 + 1] = (ny * 0.5 + 0.5) * 255
      out[k * 4 + 2] = (nz * 0.5 + 0.5) * 255
      out[k * 4 + 3] = clamp(alb[k] + (h[k] - 0.5) * 0.18) * 255
    }
  return dataTexture(out, S, S, { repeat: true })
}

// The cut face of the block: a rooty topsoil under the turf, then rolled
// clay laid in thin layers, then a coarser sandy base with stones.
// Tiles horizontally every 1.2 m; its height is the whole slab.
export const SIDE_TILE = 1.2
export function buildSoilSide(seed = 5) {
  const SW = 1024
  const SH = Math.round((SW * PITCH.slab) / SIDE_TILE)
  const N = makeNoise(seed)
  const r = rng(seed * 733)
  const c = canvas(SW, SH)
  const g = c.getContext('2d')
  const img = g.createImageData(SW, SH)
  const P = 12
  for (let j = 0; j < SH; j++) {
    const d = (j / SH) * PITCH.slab // depth below the surface
    for (let i = 0; i < SW; i++) {
      const u = (i / SW) * P
      const n = N.fbm(u, d * 40, 4, P)
      const fine = N.noise(u * 16, d * 900, P * 16)
      let col
      const topsoil = 0.02 + (n - 0.5) * 0.008
      if (d < 0.004 + n * 0.004) col = [96, 104, 56]
      else if (d < topsoil) col = [84, 66, 46]
      else if (d < 0.105 + (n - 0.5) * 0.01) {
        const lam = 0.9 + 0.1 * Math.sin(d * 420 + n * 4)
        col = [158 * lam, 128 * lam, 92 * lam]
      } else col = [128, 106, 80]
      const t = 0.85 + n * 0.25 + (fine - 0.5) * 0.12
      const k = (j * SW + i) * 4
      img.data[k] = clamp(col[0] * t, 0, 255)
      img.data[k + 1] = clamp(col[1] * t, 0, 255)
      img.data[k + 2] = clamp(col[2] * t, 0, 255)
      img.data[k + 3] = 255
    }
  }
  g.putImageData(img, 0, 0)
  const wrapDraw = (fn) => [-SW, 0, SW].forEach((o) => (g.save(), g.translate(o, 0), fn(), g.restore()))
  // stones, more of them deeper down
  for (let n = 0; n < 420; n++) {
    const x = r() * SW
    const y = SH * (0.2 + 0.8 * Math.sqrt(r()))
    const rad = 0.8 + r() * (y > SH * 0.65 ? 4 : 2.2)
    const v = 90 + r() * 110
    wrapDraw(() => {
      g.fillStyle = `rgba(${v},${v * 0.9},${v * 0.78},0.85)`
      g.beginPath()
      g.ellipse(x, y, rad * (1 + r()), rad, r() * 3, 0, Math.PI * 2)
      g.fill()
    })
  }
  // fine roots hanging from the turf
  g.lineCap = 'round'
  for (let n = 0; n < 160; n++) {
    let x = r() * SW
    let y = 1
    const len = 4 + r() * SH * 0.45
    g.strokeStyle = `rgba(${60 + r() * 50},${45 + r() * 30},${30},${0.35 + r() * 0.4})`
    g.lineWidth = 0.4 + r() * 0.8
    g.beginPath()
    g.moveTo(x, y)
    for (let s = 0; s < len; s += 2) {
      x += (r() - 0.5) * 2
      y += 2
      g.lineTo(x, y)
    }
    g.stroke()
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = THREE.RepeatWrapping
  t.anisotropy = 8
  return t
}

// Ash for the stumps: pale, with fine straight grain running up v.
export function buildWood(seed = 2) {
  const S = 256
  const H = 1024
  const N = makeNoise(seed)
  const c = canvas(S, H)
  const g = c.getContext('2d')
  const img = g.createImageData(S, H)
  for (let y = 0; y < H; y++)
    for (let x = 0; x < S; x++) {
      const u = x / S
      const warp = N.fbm(u * 3, (y / H) * 2, 3, 3) * 1.5
      const ring = u * 14 + warp
      const f = ring - Math.floor(ring)
      const late = Math.pow(f, 5)
      const streak = N.noise(u * 140, (y / H) * 6, 140)
      const v = clamp(0.93 - late * 0.22 - (streak - 0.5) * 0.12)
      const k = (y * S + x) * 4
      img.data[k] = v * 255
      img.data[k + 1] = v * 247
      img.data[k + 2] = v * 236
      img.data[k + 3] = 255
    }
  g.putImageData(img, 0, 0)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.anisotropy = 8
  return t
}

// The outfield for the "field" setting: mown in 5 m stripes, tiled every 10 m.
export const OUTFIELD_TILE = 10
export function buildOutfield(seed = 9) {
  const S = 1024
  const N = makeNoise(seed)
  const c = canvas(S, S)
  const g = c.getContext('2d')
  const img = g.createImageData(S, S)
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const u = x / S
      const v = y / S
      const stripe = u < 0.5 ? 1 : 0
      const n = N.fbm(u * 6, v * 6, 5, 6)
      const fine = N.noise(u * 300, v * 300, 300)
      const t = 0.85 + n * 0.3 + (fine - 0.5) * 0.18
      const base = stripe ? [98, 124, 62] : [78, 104, 50]
      const k = (y * S + x) * 4
      img.data[k] = clamp(base[0] * t, 0, 255)
      img.data[k + 1] = clamp(base[1] * t, 0, 255)
      img.data[k + 2] = clamp(base[2] * t, 0, 255)
      img.data[k + 3] = 255
    }
  g.putImageData(img, 0, 0)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.anisotropy = 16
  return t
}
