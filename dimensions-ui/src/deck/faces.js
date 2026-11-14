import * as THREE from 'three'

// Card artwork, drawn on a canvas in centimetres. Cards are 5.6 x 8.7 cm.
//
// Faces: a white border round a panel in the suit colour, a tilted rounded
// lozenge outlined in white, the value in the middle and small indices in two
// corners. Values are 0-9 plus three actions: skip, reverse and +2.
// Every glyph is "inked": a hard black drop shadow, a black outline and a
// white fill, like a printed card.

export const CARD_W = 5.6
export const CARD_H = 8.7
export const CARD_R = 0.38
export const KINDS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'skip', 'reverse', '+2', 'wild', '+4']
// black cards that belong to no suit and use all four colours
export const WILDS = ['wild', '+4']

const INK = '#141414'
const FONT = '"Arial Black", "Helvetica Neue", Arial, sans-serif'

function roundRect(g, x, y, w, h, r) {
  g.beginPath()
  g.moveTo(x + r, y)
  g.arcTo(x + w, y, x + w, y + h, r)
  g.arcTo(x + w, y + h, x, y + h, r)
  g.arcTo(x, y + h, x, y, r)
  g.arcTo(x, y, x + w, y, r)
  g.closePath()
}

// the tilted lozenge behind the value
function lozenge(g, w, h, r) {
  g.save()
  g.translate(CARD_W / 2, CARD_H / 2)
  g.rotate(0.5)
  roundRect(g, -w / 2, -h / 2, w, h, r)
  g.restore()
}

// Shadow, outline, fill, for a set of filled paths drawn at the origin.
function inkFill(g, paths, { line = 0.06, shadow = 0.085, fill = '#ffffff' } = {}) {
  g.save()
  g.translate(-shadow, shadow)
  g.fillStyle = INK
  g.strokeStyle = INK
  g.lineWidth = line * 2
  g.lineJoin = 'round'
  for (const p of paths) {
    p()
    g.fill()
    g.stroke()
  }
  g.restore()
  g.strokeStyle = INK
  g.lineWidth = line * 2
  g.lineJoin = 'round'
  for (const p of paths) {
    p()
    g.stroke()
  }
  g.fillStyle = fill
  for (const p of paths) {
    p()
    g.fill()
  }
}

// text drawn big and scaled down, so tiny centimetre font sizes stay crisp
function inkText(g, text, size, { line = 0.06, shadow = 0.085, underline = false } = {}) {
  const k = size / 100
  g.save()
  g.scale(k, k)
  g.font = `900 100px ${FONT}`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  const lw = (line * 2) / k
  const sh = shadow / k
  const w = g.measureText(text).width
  const bar = () => {
    g.beginPath()
    g.rect(-w * 0.42, 44, w * 0.84, 11)
  }
  g.lineJoin = 'round'
  // shadow
  g.fillStyle = INK
  g.strokeStyle = INK
  g.lineWidth = lw
  g.fillText(text, -sh, 4 + sh)
  g.strokeText(text, -sh, 4 + sh)
  if (underline) {
    g.save()
    g.translate(-sh, sh)
    bar()
    g.fill()
    g.stroke()
    g.restore()
  }
  // outline and fill
  g.strokeText(text, 0, 4)
  if (underline) {
    bar()
    g.stroke()
  }
  g.fillStyle = '#ffffff'
  g.fillText(text, 0, 4)
  if (underline) {
    bar()
    g.fill()
  }
  g.restore()
}

// ---- action symbols, centred on the origin, about 2.4 cm across at s = 1 ----

function skip(g, s) {
  const r = 1.0 * s
  // ring and slash as strokes: all the black first, then all the white, so
  // the slash joins the ring cleanly
  const ring = () => {
    g.beginPath()
    g.arc(0, 0, r, 0, Math.PI * 2)
  }
  const slash = () => {
    g.beginPath()
    g.moveTo(-r * 0.72, r * 0.72)
    g.lineTo(r * 0.72, -r * 0.72)
  }
  const w = 0.36 * s
  const line = 0.06 * Math.max(s, 0.45)
  const shadow = 0.085 * Math.max(s, 0.45)
  g.lineCap = 'butt'
  for (const [dx, dy, col, lw] of [
    [-shadow, shadow, INK, w + line * 2],
    [0, 0, INK, w + line * 2],
    [0, 0, '#ffffff', w],
  ]) {
    g.save()
    g.translate(dx, dy)
    g.strokeStyle = col
    g.lineWidth = lw
    ring()
    g.stroke()
    slash()
    g.stroke()
    g.restore()
  }
}

// one arrow pointing up, shaft from y0 to the head's base, centred on x = 0
function arrowPath(g, len, shaft, head, headLen) {
  g.beginPath()
  g.moveTo(-shaft / 2, len / 2)
  g.lineTo(-shaft / 2, -len / 2 + headLen)
  g.lineTo(-head / 2, -len / 2 + headLen)
  g.lineTo(0, -len / 2)
  g.lineTo(head / 2, -len / 2 + headLen)
  g.lineTo(shaft / 2, -len / 2 + headLen)
  g.lineTo(shaft / 2, len / 2)
  g.closePath()
}

function reverse(g, s) {
  const len = 1.75 * s
  const shaft = 0.46 * s
  const head = 1.15 * s
  const hl = 0.62 * s
  const off = 0.36 * s
  const a = (path) => () => {
    g.save()
    g.rotate(Math.PI / 4)
    path()
    g.restore()
  }
  // two arrows on parallel tracks, one up-right, one down-left
  const up = a(() => {
    g.translate(-off, -0.32 * s)
    arrowPath(g, len, shaft, head, hl)
  })
  const down = a(() => {
    g.translate(off, 0.32 * s)
    g.rotate(Math.PI)
    arrowPath(g, len, shaft, head, hl)
  })
  // paths are built inside save/restore, but Canvas keeps the path in device
  // space, so filling after restore still works
  inkFill(g, [up, down], { line: 0.06 * Math.max(s, 0.45), shadow: 0.085 * Math.max(s, 0.45) })
}

// a little card: black outline and drop shadow, white rim, colour panel and a
// tiny lozenge
function miniCard(g, x, y, s, color, rot = 0) {
  const w = 1.2 * s
  const h = 1.75 * s
  const line = 0.05 * Math.max(s, 0.45)
  g.save()
  g.translate(x, y)
  g.rotate(rot)
  g.save()
  g.translate(-0.07 * s, 0.07 * s)
  roundRect(g, -w / 2 - line, -h / 2 - line, w + line * 2, h + line * 2, 0.16 * s)
  g.fillStyle = 'rgba(0,0,0,0.55)'
  g.fill()
  g.restore()
  roundRect(g, -w / 2 - line, -h / 2 - line, w + line * 2, h + line * 2, 0.16 * s)
  g.fillStyle = INK
  g.fill()
  roundRect(g, -w / 2, -h / 2, w, h, 0.13 * s)
  g.fillStyle = '#ffffff'
  g.fill()
  roundRect(g, -w / 2 + 0.09 * s, -h / 2 + 0.09 * s, w - 0.18 * s, h - 0.18 * s, 0.08 * s)
  g.fillStyle = color
  g.fill()
  g.rotate(0.5)
  roundRect(g, -w * 0.28, -h * 0.36, w * 0.56, h * 0.72, w * 0.22)
  g.strokeStyle = '#ffffff'
  g.lineWidth = 0.05 * s
  g.stroke()
  g.restore()
}

function drawTwo(g, s, color) {
  // two little cards, offset, then +2 over them
  miniCard(g, -0.42 * s, 0.38 * s, s, color)
  miniCard(g, 0.42 * s, -0.38 * s, s, color)
  inkText(g, '+2', 1.15 * s, { line: 0.06 * Math.max(s, 0.45), shadow: 0.08 * Math.max(s, 0.45) })
}

// +4: one little card per suit, stepped diagonally up the lozenge
function drawFour(g, s, colors) {
  const steps = [
    [-0.95, 0.95, -0.12],
    [-0.32, 0.32, -0.04],
    [0.32, -0.32, 0.04],
    [0.95, -0.95, 0.12],
  ]
  // draw back to front so the first colour sits on top, like a held stack
  for (let i = 3; i >= 0; i--) {
    const [x, y, r] = steps[i]
    miniCard(g, x * s, y * s, s * 1.05, colors[i], r)
  }
}

// a small four-colour diamond, the wild cards' corner mark
function quad(g, s, colors) {
  const r = 0.55 * s
  g.save()
  g.rotate(Math.PI / 4)
  g.save()
  g.translate(-0.05 * s, 0.07 * s)
  g.fillStyle = INK
  roundRect(g, -r - 0.05 * s, -r - 0.05 * s, (r + 0.05 * s) * 2, (r + 0.05 * s) * 2, 0.16 * s)
  g.fill()
  g.restore()
  g.fillStyle = INK
  roundRect(g, -r - 0.05 * s, -r - 0.05 * s, (r + 0.05 * s) * 2, (r + 0.05 * s) * 2, 0.16 * s)
  g.fill()
  roundRect(g, -r, -r, r * 2, r * 2, 0.12 * s)
  g.clip()
  const q = [
    [-r, -r],
    [0, -r],
    [0, 0],
    [-r, 0],
  ]
  q.forEach(([x, y], i) => {
    g.fillStyle = colors[i]
    g.fillRect(x, y, r, r)
  })
  g.restore()
}

// a word with each letter in the next colour, a white rim and black outline,
// centred on the origin
function colorWord(g, word, size, colors) {
  const k = size / 100
  g.save()
  g.scale(k, k)
  g.font = `italic 900 100px ${FONT}`
  g.textBaseline = 'middle'
  g.textAlign = 'left'
  g.lineJoin = 'round'
  const widths = [...word].map((ch) => g.measureText(ch).width * 0.96)
  let x = -widths.reduce((a, b) => a + b, 0) / 2
  const letters = [...word].map((ch, i) => {
    const at = x
    x += widths[i]
    return [ch, at, colors[i % colors.length]]
  })
  // white rim under everything, then black outline, then the colours
  for (const [lw, col] of [
    [0.16 / k, '#fbfaf6'],
    [0.08 / k, INK],
  ]) {
    g.strokeStyle = col
    g.lineWidth = lw
    for (const [ch, at] of letters) g.strokeText(ch, at, 0)
  }
  for (const [ch, at, col] of letters) {
    g.fillStyle = col
    g.fillText(ch, at, 0)
  }
  g.restore()
}

// a stroke or fill style that sweeps through the four colours round a centre
function sweep(g, cx, cy, colors, turn = 0.5) {
  if (!g.createConicGradient) {
    const l = g.createLinearGradient(0, 0, CARD_W, CARD_H)
    colors.forEach((c, i) => l.addColorStop(i / 3, c))
    return l
  }
  const grad = g.createConicGradient(turn, cx, cy)
  colors.forEach((c, i) => {
    grad.addColorStop(i / 4, c)
    grad.addColorStop(i / 4 + 0.2, c)
  })
  grad.addColorStop(1, colors[0])
  return grad
}

function symbol(g, kind, s, color, small) {
  if (kind === 'skip') return skip(g, s)
  if (kind === 'reverse') return reverse(g, s)
  if (kind === '+2') {
    if (small) return inkText(g, '+2', 1.9 * s, { line: 0.05, shadow: 0.06 })
    return drawTwo(g, s, color)
  }
  inkText(g, kind, 3.1 * s, { underline: kind === '6' || kind === '9', line: s < 0.5 ? 0.04 : 0.07, shadow: s < 0.5 ? 0.06 : 0.11 })
}

// ---------------------------------------------------------------------------

function canvasFor(pxPerCm) {
  const c = document.createElement('canvas')
  c.width = Math.round(CARD_W * pxPerCm)
  c.height = Math.round(CARD_H * pxPerCm)
  const g = c.getContext('2d')
  g.scale(c.width / CARD_W, c.height / CARD_H)
  return { c, g }
}

function toTexture(c) {
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

// Wild cards: black, with a four-colour pinstripe and lozenge. "wild" fills
// the lozenge in four colour quarters; "+4" shows a little card per suit.
function wildTexture(kind, colors, pxPerCm) {
  const { c, g } = canvasFor(pxPerCm)
  const cx = CARD_W / 2
  const cy = CARD_H / 2
  g.fillStyle = '#fbfaf6'
  g.fillRect(0, 0, CARD_W, CARD_H)
  const m = 0.3
  roundRect(g, m, m, CARD_W - m * 2, CARD_H - m * 2, 0.34)
  g.fillStyle = '#111112'
  g.fill()
  // pinstripe round the panel
  roundRect(g, m + 0.16, m + 0.16, CARD_W - (m + 0.16) * 2, CARD_H - (m + 0.16) * 2, 0.24)
  g.strokeStyle = sweep(g, cx, cy, colors, -Math.PI * 0.75)
  g.lineWidth = 0.07
  g.stroke()
  if (kind === 'wild') {
    // the lozenge in four quarters, split along its own axes
    g.save()
    lozenge(g, 3.25, 6.3, 1.45)
    g.clip()
    g.translate(cx, cy)
    g.rotate(0.5)
    const q = [
      [-4, -4],
      [0, -4],
      [0, 0],
      [-4, 0],
    ]
    q.forEach(([x, y], i) => {
      g.fillStyle = colors[i]
      g.fillRect(x, y, 4, 4)
    })
    g.restore()
    lozenge(g, 3.25, 6.3, 1.45)
    g.strokeStyle = '#fbfaf6'
    g.lineWidth = 0.14
    g.stroke()
  } else {
    lozenge(g, 3.25, 6.3, 1.45)
    g.strokeStyle = sweep(g, cx, cy, colors)
    g.lineWidth = 0.12
    g.stroke()
    g.save()
    g.translate(cx, cy)
    drawFour(g, 1, colors)
    g.restore()
  }
  // corner marks
  for (const [x, y, rot] of [
    [0.95, 1.05, 0],
    [CARD_W - 0.95, CARD_H - 1.05, Math.PI],
  ]) {
    g.save()
    g.translate(x, y)
    g.rotate(rot)
    if (kind === '+4') {
      inkText(g, '+4', 0.62, { line: 0.03, shadow: 0 })
      g.translate(0, 0.62)
      quad(g, 0.32, colors)
    } else {
      g.translate(0.25, -0.12)
      colorWord(g, 'WILD', 0.52, colors)
      g.translate(-0.28, 0.66)
      quad(g, 0.3, colors)
    }
    g.restore()
  }
  return toTexture(c)
}

export function faceTexture(kind, color, pxPerCm = 160, colors = [color, color, color, color]) {
  if (WILDS.includes(kind)) return wildTexture(kind, colors, pxPerCm)
  const { c, g } = canvasFor(pxPerCm)
  g.fillStyle = '#fbfaf6'
  g.fillRect(0, 0, CARD_W, CARD_H)
  const m = 0.3
  roundRect(g, m, m, CARD_W - m * 2, CARD_H - m * 2, 0.34)
  g.fillStyle = color
  g.fill()
  // a soft print sheen across the panel
  const sheen = g.createLinearGradient(0, 0, CARD_W, CARD_H)
  sheen.addColorStop(0, 'rgba(255,255,255,0.07)')
  sheen.addColorStop(0.55, 'rgba(255,255,255,0)')
  sheen.addColorStop(1, 'rgba(0,0,0,0.08)')
  g.fillStyle = sheen
  g.fill()
  // lozenge outline
  lozenge(g, 3.25, 6.3, 1.45)
  g.strokeStyle = '#fbfaf6'
  g.lineWidth = 0.14
  g.stroke()
  // centre value
  g.save()
  g.translate(CARD_W / 2, CARD_H / 2)
  symbol(g, kind, 1, color, false)
  g.restore()
  // corner indices, top-left and (upside down) bottom-right
  for (const [x, y, rot] of [
    [0.82, 1.0, 0],
    [CARD_W - 0.82, CARD_H - 1.0, Math.PI],
  ]) {
    g.save()
    g.translate(x, y)
    g.rotate(rot)
    symbol(g, kind, 0.3, color, true)
    g.restore()
  }
  return toTexture(c)
}

// The back: a black border, a panel in the first colour with a pinstripe in
// the accent colour, a white lozenge and the wordmark, extruded in 3D.
export function backTexture(panel, accent, brand = 'RD', pxPerCm = 160) {
  const { c, g } = canvasFor(pxPerCm)
  g.fillStyle = '#121212'
  g.fillRect(0, 0, CARD_W, CARD_H)
  const m = 0.28
  roundRect(g, m, m, CARD_W - m * 2, CARD_H - m * 2, 0.32)
  g.fillStyle = panel
  g.fill()
  roundRect(g, m + 0.08, m + 0.08, CARD_W - (m + 0.08) * 2, CARD_H - (m + 0.08) * 2, 0.26)
  g.strokeStyle = accent
  g.lineWidth = 0.055
  g.stroke()
  lozenge(g, 3.5, 6.4, 1.6)
  g.fillStyle = '#f6f4ee'
  g.fill()

  const word = (brand || '').toUpperCase().slice(0, 8) || ' '
  g.save()
  g.translate(CARD_W / 2, CARD_H / 2)
  g.rotate(-0.33)
  g.font = `italic 900 100px ${FONT}`
  const fit = Math.min(1.65, 4.6 / ((g.measureText(word).width / 100) * 1.0 + 0.2))
  const k = fit / 100
  g.scale(k, k)
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.lineJoin = 'round'
  // the extrusion: the word stepped down and to the left, darkest at the back
  const depth = 0.22 / k
  for (let i = 18; i >= 1; i--) {
    const t = i / 18
    g.fillStyle = i > 2 ? '#1c2a3a' : INK
    g.strokeStyle = INK
    g.lineWidth = 0.09 / k
    g.strokeText(word, -depth * t, depth * t * 0.9)
    g.fillText(word, -depth * t, depth * t * 0.9)
  }
  g.strokeStyle = INK
  g.lineWidth = 0.12 / k
  g.strokeText(word, 0, 0)
  g.fillStyle = accent
  g.fillText(word, 0, 0)
  g.strokeStyle = 'rgba(255,255,255,0.85)'
  g.lineWidth = 0.025 / k
  g.strokeText(word, 0, 0)
  g.restore()
  return toTexture(c)
}

// Fine paper grain for the bump map, tiled.
export function paperTexture() {
  const c = Object.assign(document.createElement('canvas'), { width: 256, height: 256 })
  const g = c.getContext('2d')
  const img = g.createImageData(256, 256)
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 118 + Math.random() * 20
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v
    img.data[i + 3] = 255
  }
  g.putImageData(img, 0, 0)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(6, 9)
  return t
}

// Card outline, centred on the origin, and a flat face for it with UVs that
// map the whole card to the texture.
export function cardShape() {
  const s = new THREE.Shape()
  const w = CARD_W / 2
  const h = CARD_H / 2
  const r = CARD_R
  s.moveTo(-w + r, -h)
  s.lineTo(w - r, -h)
  s.absarc(w - r, -h + r, r, -Math.PI / 2, 0, false)
  s.lineTo(w, h - r)
  s.absarc(w - r, h - r, r, 0, Math.PI / 2, false)
  s.lineTo(-w + r, h)
  s.absarc(-w + r, h - r, r, Math.PI / 2, Math.PI, false)
  s.lineTo(-w, -h + r)
  s.absarc(-w + r, -h + r, r, Math.PI, Math.PI * 1.5, false)
  return s
}

export function faceGeometry(shape) {
  const g = new THREE.ShapeGeometry(shape, 12)
  const p = g.attributes.position
  const uv = g.attributes.uv
  for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + CARD_W / 2) / CARD_W, (p.getY(i) + CARD_H / 2) / CARD_H)
  return g
}
