import * as THREE from 'three'

// The board's dimensions and its generated maps. No image files.
//
// World layout (metres): the board lies flat, centred on the origin, its
// underside on the table at y = 0. Square 1 is at the front left (+z is
// towards the viewer); the numbers run boustrophedon, left to right on the
// bottom row, right to left on the next, up to 100 at the back left.

export const BOARD = {
  cell: 0.045, // one square
  n: 10,
  margin: 0.008, // printed border round the grid
  frameW: 0.035, // frame rail width
  frameH: 0.03, // frame height
  top: 0.012, // printed surface height
}
export const GRID = BOARD.cell * BOARD.n
export const OPEN = GRID + 2 * BOARD.margin // the opening inside the frame
export const OUTER = OPEN / 2 + BOARD.frameW // half the outside size

export const THEMES = {
  classic: { squares: ['#de4a38', '#f08a2b', '#f2c731', '#79b847', '#47a0d6'], ink: '#17120d', border: '#1e2833' },
  pastel: { squares: ['#ef9a8f', '#f6c08c', '#f4df8a', '#b4d99a', '#9ccbe8'], ink: '#2a2420', border: '#3a3f4a' },
  retro: { squares: ['#b8492f', '#c9803a', '#d8b14a', '#6f8f4a', '#4b7a8f'], ink: '#1d1611', border: '#2b2620' },
}

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

// the square a number sits on: column 0..9 from the left, row 0..9 from the front
export function cellOf(n) {
  const row = Math.floor((n - 1) / 10)
  const k = (n - 1) % 10
  return { row, col: row % 2 ? 9 - k : k }
}
export function cellCentre(n) {
  const { row, col } = cellOf(n)
  return [-GRID / 2 + (col + 0.5) * BOARD.cell, GRID / 2 - (row + 0.5) * BOARD.cell]
}

const FONT = '"Arial Black", "Segoe UI Black", "Helvetica Neue", Arial, sans-serif'

// The printed face: coloured squares with bold numbers, START and FINISH,
// a dark border, and the look of ink on a laminated card: each square a
// touch darker at its edges, the colours not quite flat, a fine paper tooth.
export function buildPrint(themeName = 'classic', seed = 4) {
  const theme = THEMES[themeName] || THEMES.classic
  const S = 4096
  const px = S / OPEN
  const c = Object.assign(document.createElement('canvas'), { width: S, height: S })
  const g = c.getContext('2d')
  const r = rng(seed)
  g.fillStyle = theme.border
  g.fillRect(0, 0, S, S)
  const m = BOARD.margin * px
  const cs = BOARD.cell * px
  const shade = (hex, k) => {
    const col = new THREE.Color(hex)
    return `rgb(${Math.round(clamp(col.r * k) * 255)},${Math.round(clamp(col.g * k) * 255)},${Math.round(clamp(col.b * k) * 255)})`
  }
  // a lively mix of colours, never the same as the square to the left,
  // below, or diagonally below
  const pick = rng(seed * 31 + 7)
  const grid = []
  for (let row = 0; row < 10; row++)
    for (let col = 0; col < 10; col++) {
      const avoid = [grid[row * 10 + col - 1], grid[(row - 1) * 10 + col], grid[(row - 1) * 10 + col - 1], grid[(row - 1) * 10 + col + 1]]
      let k
      do k = Math.floor(pick() * 5)
      while ((col > 0 && avoid[0] === k) || (row > 0 && (avoid[1] === k || (col > 0 && avoid[2] === k) || (col < 9 && avoid[3] === k))))
      grid.push(k)
    }
  for (let n = 1; n <= 100; n++) {
    const { row, col } = cellOf(n)
    const x = m + col * cs
    const y = m + (9 - row) * cs // canvas y runs from the back row
    let hex = theme.squares[grid[row * 10 + col]]
    if (n === 100) hex = theme.squares[0]
    if (n === 1) hex = theme.squares[2]
    // the square, a touch darker towards its edges
    const grad = g.createRadialGradient(x + cs / 2, y + cs / 2, cs * 0.15, x + cs / 2, y + cs / 2, cs * 0.75)
    const k = 0.97 + r() * 0.06
    grad.addColorStop(0, shade(hex, k * 1.03))
    grad.addColorStop(1, shade(hex, k * 0.9))
    g.fillStyle = grad
    g.fillRect(x, y, cs, cs)
    // the number
    g.fillStyle = theme.ink
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    if (n === 1 || n === 100) {
      g.font = `900 ${Math.round(cs * 0.38)}px ${FONT}`
      g.fillText(String(n), x + cs / 2, y + cs * (n === 1 ? 0.62 : 0.4))
      g.font = `900 ${Math.round(cs * 0.17)}px ${FONT}`
      g.fillText(n === 1 ? 'START' : 'FINISH', x + cs / 2, y + cs * (n === 1 ? 0.28 : 0.76))
    } else {
      g.font = `900 ${Math.round(cs * (n > 9 ? 0.4 : 0.46))}px ${FONT}`
      g.fillText(String(n), x + cs / 2, y + cs * 0.53)
    }
  }
  // grid lines, printed slightly soft
  g.strokeStyle = 'rgba(20,16,12,0.85)'
  g.lineWidth = Math.max(2, px * 0.0006)
  for (let i = 0; i <= 10; i++) {
    g.beginPath()
    g.moveTo(m + i * cs, m)
    g.lineTo(m + i * cs, m + 10 * cs)
    g.stroke()
    g.beginPath()
    g.moveTo(m, m + i * cs)
    g.lineTo(m + 10 * cs, m + i * cs)
    g.stroke()
  }
  // a thin gold rule round the grid
  g.strokeStyle = 'rgba(214,176,92,0.9)'
  g.lineWidth = px * 0.0012
  g.strokeRect(m - px * 0.0025, m - px * 0.0025, 10 * cs + px * 0.005, 10 * cs + px * 0.005)
  // paper tooth and uneven ink: a small noise tile multiplied over the face
  const T = 256
  const tile = Object.assign(document.createElement('canvas'), { width: T, height: T })
  const tg = tile.getContext('2d')
  const img = tg.createImageData(T, T)
  const N = makeNoise(seed)
  for (let j = 0; j < T; j++)
    for (let i = 0; i < T; i++) {
      const v = 238 + (N.fbm(i / 32, j / 32, 3, 8) - 0.5) * 22 + (N.hash(i, j) - 0.5) * 18
      const k = (j * T + i) * 4
      img.data[k] = img.data[k + 1] = img.data[k + 2] = clamp(v, 0, 255)
      img.data[k + 3] = 255
    }
  tg.putImageData(img, 0, 0)
  g.globalCompositeOperation = 'multiply'
  g.fillStyle = g.createPattern(tile, 'repeat')
  g.fillRect(0, 0, S, S)
  // a little wear where every game starts
  g.globalCompositeOperation = 'source-over'
  {
    const { row, col } = cellOf(1)
    const x = m + col * cs
    const y = m + (9 - row) * cs
    for (let i = 0; i < 90; i++) {
      g.fillStyle = `rgba(255,255,255,${0.02 + r() * 0.05})`
      g.beginPath()
      g.ellipse(x + r() * cs, y + r() * cs, 2 + r() * 14, 1 + r() * 4, r() * 3, 0, Math.PI * 2)
      g.fill()
    }
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 16
  return t
}

// The laminate's faint orange peel, for the gloss to break up on.
export function buildPeel(seed = 9) {
  const S = 512
  const N = makeNoise(seed)
  const h = new Float32Array(S * S)
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) h[j * S + i] = N.fbm(i / 16, j / 16, 3, 32)
  const out = new Uint8Array(S * S * 4)
  const K = 1.4
  for (let j = 0; j < S; j++)
    for (let i = 0; i < S; i++) {
      const k = j * S + i
      const dx = h[j * S + ((i + 1) % S)] - h[j * S + ((i - 1 + S) % S)]
      const dy = h[((j + 1) % S) * S + i] - h[((j - 1 + S) % S) * S + i]
      const l = Math.hypot(dx * K, dy * K, 1)
      out[k * 4] = (-dx * K / l * 0.5 + 0.5) * 255
      out[k * 4 + 1] = (-dy * K / l * 0.5 + 0.5) * 255
      out[k * 4 + 2] = (1 / l * 0.5 + 0.5) * 255
      out[k * 4 + 3] = 255
    }
  const t = new THREE.DataTexture(out, S, S, THREE.RGBAFormat, THREE.UnsignedByteType)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.generateMipmaps = true
  t.minFilter = THREE.LinearMipmapLinearFilter
  t.magFilter = THREE.LinearFilter
  t.needsUpdate = true
  return t
}

// Figured hardwood for the frame (tinted by the wood colour): grain running
// along u, with the soft ripple figure of polished mahogany. Tiles along u
// every 0.6 m; v spans 0.06 m (round the rail's profile).
export const GRAIN = { along: 0.6, across: 0.06 }
export function buildWood(seed = 12) {
  const W = 2048
  const H = 256
  const N = makeNoise(seed)
  const c = Object.assign(document.createElement('canvas'), { width: W, height: H })
  const g = c.getContext('2d')
  const img = g.createImageData(W, H)
  for (let j = 0; j < H; j++)
    for (let i = 0; i < W; i++) {
      const u = i / W
      const v = j / H
      const warp = N.fbm(u * 4, v * 1.5, 3, 4, 2) * 1.6
      const ring = v * 3.2 + warp * 1.2
      const f = ring - Math.floor(ring)
      const late = Math.pow(f, 3)
      const pores = N.noise(u * 700, v * 60, 700, 60)
      const streak = N.noise(u * 5, v * 140, 5, 140)
      const ripple = Math.sin((u * 36 + v * 4 + N.fbm(u * 3, v * 2, 3, 3, 2) * 6) * Math.PI) * 0.5 + 0.5
      const t = clamp(0.8 - late * 0.14 + (pores > 0.82 ? -0.06 : 0) + (streak - 0.5) * 0.12 + (ripple - 0.5) * 0.035 + (N.fbm(u * 8, v * 3, 3, 8, 3) - 0.5) * 0.18)
      const k = (j * W + i) * 4
      img.data[k] = t * 255
      img.data[k + 1] = t * 238
      img.data[k + 2] = t * 222
      img.data[k + 3] = 255
    }
  g.putImageData(img, 0, 0)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.anisotropy = 16
  return t
}

// One rail of a picture-style frame, swept from a moulding profile and cut
// at 45 degrees, lying along x at the front (+z) of a square frame of half
// size `outer`; turn it by 90 degree steps for the other three. The profile
// runs from the outer bottom edge inwards as [inset from the outer edge,
// height] (list a point twice to keep a crisp edge there). Because a point
// inset d runs from -(outer - d) to +(outer - d), the four rails meet in
// exact mitres. UVs: u along the rail (in GRAIN.along units, offset by
// uOffset metres so each rail shows different grain), v round the profile.
export function mitredRail(profile, outer, uOffset = 0, grain = GRAIN) {
  const pos = []
  const uv = []
  const idx = []
  let arc = 0
  profile.forEach(([d, y], i) => {
    if (i > 0) arc += Math.hypot(d - profile[i - 1][0], y - profile[i - 1][1])
    const half = outer - d
    pos.push(-half, y, outer - d, half, y, outer - d)
    uv.push((uOffset - half) / grain.along, arc / grain.across, (uOffset + half) / grain.along, arc / grain.across)
  })
  for (let i = 0; i < profile.length - 1; i++) {
    const a = i * 2
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
  }
  // the underside, from the outer edge to the profile's innermost point
  const w = Math.max(...profile.map(([d]) => d))
  const b = pos.length / 3
  pos.push(-outer, 0, outer, outer, 0, outer, -(outer - w), 0, outer - w, outer - w, 0, outer - w)
  uv.push(0, 0, 1, 0, 0, 0.5, 1, 0.5)
  idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3)
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}
