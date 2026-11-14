import * as THREE from 'three'
import { INK, LAY, LAY_H, LAY_W, ORDER, SPOTS, colourOf } from './layout.js'

// The roulette table's generated maps. No image files.

const FONT = 'Georgia, "Times New Roman", serif'
const canvas = (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h })
const hash = (x, y, s) => {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 1442695041)) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

// The betting layout, as three ink masks rather than colours, so the cloth
// can be any colour underneath: red = the white lines and lettering,
// green = red boxes, blue = black boxes. Covers the layout plus LAY.pad.
export function buildLayout() {
  const W = 4096
  const k = W / (LAY_W + 2 * LAY.pad)
  const H = Math.round((LAY_H + 2 * LAY.pad) * k)
  const c = canvas(W, H)
  const g = c.getContext('2d')
  const X = (x) => (x - LAY.x + LAY.pad) * k
  const Z = (z) => (z - LAY.z + LAY.pad) * k
  g.fillStyle = '#000'
  g.fillRect(0, 0, W, H)
  const diamond = (s) => {
    const cx = X(s.x + s.w / 2)
    const cy = Z(s.z + s.h / 2)
    g.beginPath()
    g.moveTo(cx - s.w * 0.3 * k, cy)
    g.lineTo(cx, cy - s.h * 0.3 * k)
    g.lineTo(cx + s.w * 0.3 * k, cy)
    g.lineTo(cx, cy + s.h * 0.3 * k)
    g.closePath()
  }
  const box = (s) => {
    g.beginPath()
    if (s.kind === 'zero') g.roundRect(X(s.x), Z(s.z), s.w * k, s.h * k, [0.03 * k, 0, 0, 0.03 * k])
    else g.rect(X(s.x), Z(s.z), s.w * k, s.h * k)
  }
  // the coloured boxes
  for (const s of SPOTS) {
    if (s.kind === 'number') {
      g.fillStyle = colourOf(s.nums[0]) === 'red' ? '#00ff00' : '#0000ff'
      g.fillRect(X(s.x), Z(s.z), s.w * k, s.h * k)
    } else if (s.id === 'red' || s.id === 'black') {
      g.fillStyle = s.id === 'red' ? '#00ff00' : '#0000ff'
      diamond(s)
      g.fill()
    }
  }
  // the lines and the lettering, added on top so a number keeps its box's colour behind it
  g.globalCompositeOperation = 'lighter'
  g.strokeStyle = g.fillStyle = '#ff0000'
  g.lineWidth = 0.0024 * k
  g.lineJoin = 'round'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  for (const s of SPOTS) {
    box(s)
    g.stroke()
    const cx = X(s.x + s.w / 2)
    const cy = Z(s.z + s.h / 2)
    if (s.id === 'red' || s.id === 'black') {
      g.lineWidth = 0.0016 * k
      diamond(s)
      g.stroke()
      g.lineWidth = 0.0024 * k
    } else if (s.kind === 'column') {
      g.save()
      g.translate(cx, cy)
      g.rotate(-Math.PI / 2)
      g.font = `700 ${Math.round(0.024 * k)}px ${FONT}`
      g.fillText(s.label, 0, 0.001 * k)
      g.restore()
    } else {
      const size = s.kind === 'number' ? 0.044 : s.kind === 'zero' ? 0.056 : 0.03
      g.font = `700 ${Math.round(size * k)}px ${FONT}`
      g.fillText(s.label, cx, cy + size * 0.06 * k)
    }
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.NoColorSpace
  t.anisotropy = 16
  return t
}

// The cloth's nap: a fine woven tooth, used as both colour and bump.
export function buildFelt() {
  const S = 256
  const c = canvas(S, S)
  const g = c.getContext('2d')
  const img = g.createImageData(S, S)
  for (let j = 0; j < S; j++)
    for (let i = 0; i < S; i++) {
      const weave = 0.5 + 0.25 * Math.sin((i * Math.PI) / 2) * Math.sin((j * Math.PI) / 2)
      const v = 205 + (hash(i, j, 3) - 0.5) * 60 + (hash(i >> 2, j >> 2, 5) - 0.5) * 22 + (hash(i >> 4, j >> 4, 7) - 0.5) * 12 + weave * 14
      const k = (j * S + i) * 4
      img.data[k] = img.data[k + 1] = img.data[k + 2] = Math.max(0, Math.min(255, v))
      img.data[k + 3] = 255
    }
  g.putImageData(img, 0, 0)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.anisotropy = 8
  return t
}

// Pebbled leather for the arm rail: a normal map of small rounded cells
// with creases between them. Tiles.
export function buildLeather(seed = 21) {
  const S = 512
  const N = 40 // cells across the tile
  const px = []
  const pz = []
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      px.push(i + 0.15 + hash(i, j, seed) * 0.7)
      pz.push(j + 0.15 + hash(i, j, seed + 1) * 0.7)
    }
  const h = new Float32Array(S * S)
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const u = (x / S) * N
      const v = (y / S) * N
      const ci = Math.floor(u)
      const cj = Math.floor(v)
      let f1 = 9
      let f2 = 9
      for (let dj = -1; dj <= 1; dj++)
        for (let di = -1; di <= 1; di++) {
          const i = (ci + di + N) % N
          const j = (cj + dj + N) % N
          const d = Math.hypot(px[j * N + i] + (ci + di - i) - u, pz[j * N + i] + (cj + dj - j) - v)
          if (d < f1) {
            f2 = f1
            f1 = d
          } else if (d < f2) f2 = d
        }
      const e = Math.min(1, (f2 - f1) * 2.6)
      h[y * S + x] = e * (2 - e) + (hash(x, y, seed + 2) - 0.5) * 0.05
    }
  const out = new Uint8Array(S * S * 4)
  const K = 2.2
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const dx = (h[y * S + ((x + 1) % S)] - h[y * S + ((x - 1 + S) % S)]) * K
      const dy = (h[((y + 1) % S) * S + x] - h[((y - 1 + S) % S) * S + x]) * K
      const l = Math.hypot(dx, dy, 1)
      const k = (y * S + x) * 4
      out[k] = ((-dx / l) * 0.5 + 0.5) * 255
      out[k + 1] = ((-dy / l) * 0.5 + 0.5) * 255
      out[k + 2] = ((1 / l) * 0.5 + 0.5) * 255
      out[k + 3] = 255
    }
  const t = new THREE.DataTexture(out, S, S, THREE.RGBAFormat, THREE.UnsignedByteType)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.generateMipmaps = true
  t.minFilter = THREE.LinearMipmapLinearFilter
  t.magFilter = THREE.LinearFilter
  t.anisotropy = 8
  t.needsUpdate = true
  return t
}

// The wheel's painted ring, unrolled: 37 columns, one per pocket. From the
// rim inwards (bottom of the strip upwards) each has its number on the
// number ring, then the pocket's back wall, floor and front wall. `bands`
// are where those end, as fractions of the strip's height. The numbers face
// outwards, as on a real wheel: tops towards the rim.
export function buildRing(bands) {
  const W = 8192
  const H = 512
  const c = canvas(W, H)
  const g = c.getContext('2d')
  const seg = W / ORDER.length
  const yNum = H * (1 - bands[0])
  const yFloor0 = H * (1 - bands[1])
  const yFloor1 = H * (1 - bands[2])
  ORDER.forEach((n, k) => {
    const x = W - (k + 1) * seg
    const ink = INK[colourOf(n)]
    g.fillStyle = ink
    g.fillRect(Math.floor(x), 0, Math.ceil(seg) + 1, H)
    // the pocket is a touch deeper in tone than the ring
    g.fillStyle = 'rgba(0,0,0,0.22)'
    g.fillRect(Math.floor(x), 0, Math.ceil(seg) + 1, yNum)
    g.fillStyle = 'rgba(255,255,255,0.05)'
    g.fillRect(Math.floor(x), yFloor1, Math.ceil(seg) + 1, yFloor0 - yFloor1)
    g.save()
    g.translate(x + seg / 2, (yNum + H) / 2)
    g.rotate(Math.PI)
    g.fillStyle = '#f3ecd8'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.font = `700 ${Math.round((H - yNum) * 0.62)}px ${FONT}`
    g.fillText(String(n), 0, (H - yNum) * 0.03)
    g.restore()
  })
  // gilt rules between the numbers and along the ring's two edges
  g.fillStyle = '#d9b566'
  for (let k = 0; k < ORDER.length; k++) g.fillRect(k * seg - 3, yNum, 6, H - yNum)
  g.fillRect(0, H - 9, W, 9)
  g.fillRect(0, yNum, W, 7)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = THREE.RepeatWrapping
  t.anisotropy = 16
  return t
}

// a casino chip: the face (edge inserts, an inlay ring) and the striped edge
export function buildChip(color) {
  const S = 256
  const face = canvas(S, S)
  const g = face.getContext('2d')
  const c = S / 2
  g.fillStyle = color
  g.fillRect(0, 0, S, S)
  g.fillStyle = '#f1ede2'
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2
    g.beginPath()
    g.moveTo(c + Math.cos(a - 0.2) * c * 0.74, c + Math.sin(a - 0.2) * c * 0.74)
    g.arc(c, c, c * 1.05, a - 0.2, a + 0.2)
    g.lineTo(c + Math.cos(a + 0.2) * c * 0.74, c + Math.sin(a + 0.2) * c * 0.74)
    g.arc(c, c, c * 0.74, a + 0.2, a - 0.2, true)
    g.fill()
  }
  g.strokeStyle = '#f1ede2'
  g.lineWidth = S * 0.02
  g.beginPath()
  g.arc(c, c, c * 0.66, 0, Math.PI * 2)
  g.stroke()
  g.setLineDash([S * 0.03, S * 0.03])
  g.lineWidth = S * 0.012
  g.beginPath()
  g.arc(c, c, c * 0.56, 0, Math.PI * 2)
  g.stroke()
  const edge = canvas(256, 8)
  const e = edge.getContext('2d')
  e.fillStyle = color
  e.fillRect(0, 0, 256, 8)
  e.fillStyle = '#f1ede2'
  // the cylinder's side starts a quarter turn round from the cap's first insert
  for (let i = 0; i < 6; i++) e.fillRect(((((i + 0.25) / 6) % 1) - 0.2 / (Math.PI * 2)) * 256, 0, (0.4 / (Math.PI * 2)) * 256, 8)
  return [face, edge].map((cv) => {
    const t = new THREE.CanvasTexture(cv)
    t.colorSpace = THREE.SRGBColorSpace
    t.wrapS = THREE.RepeatWrapping
    t.anisotropy = 8
    return t
  })
}
