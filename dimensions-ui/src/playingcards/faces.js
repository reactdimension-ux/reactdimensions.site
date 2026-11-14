import * as THREE from 'three'
import { CARD_H, CARD_W } from '../deck/faces.js'

// Playing-card artwork, drawn on a canvas in centimetres on the Color Cards
// card (same 5.6 x 8.7 cm rounded outline, reused from deck/faces.js).
//
// Faces follow the traditional layout: rank and suit indices in two
// opposite corners, the pips of 2-10 in their standard positions (those in
// the lower half upside down), a large ornamented pip on the ace, and
// double-headed court figures for J, Q and K inside a blue frame, drawn
// fresh here in the traditional red, blue, gold and black. Backs are a fine
// lattice in one colour with a white border and a centre medallion.

export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
export const SUITS = ['clubs', 'spades', 'hearts', 'diamonds']
const RED = '#c2161f'
const BLACK = '#111111'
export const suitInk = (suit) => (suit === 'hearts' || suit === 'diamonds' ? RED : BLACK)
const SERIF = '"Times New Roman", Times, Georgia, serif'

// ---- suit symbols, in a unit box centred on the origin (y down) ----
function suitPath(suit) {
  const p = new Path2D()
  if (suit === 'clubs') {
    p.arc(0, -0.21, 0.235, 0, Math.PI * 2)
    p.moveTo(-0.03, 0.09)
    p.arc(-0.255, 0.09, 0.225, 0, Math.PI * 2)
    p.moveTo(0.48, 0.09)
    p.arc(0.255, 0.09, 0.225, 0, Math.PI * 2)
    p.moveTo(0.12, 0.02)
    p.arc(0, 0.02, 0.12, 0, Math.PI * 2)
    p.moveTo(-0.045, 0.06)
    p.quadraticCurveTo(-0.035, 0.38, -0.21, 0.5)
    p.lineTo(0.21, 0.5)
    p.quadraticCurveTo(0.035, 0.38, 0.045, 0.06)
    p.closePath()
  } else if (suit === 'spades') {
    p.moveTo(0, -0.5)
    p.bezierCurveTo(0.17, -0.26, 0.5, -0.1, 0.48, 0.14)
    p.bezierCurveTo(0.46, 0.34, 0.2, 0.37, 0.05, 0.21)
    p.quadraticCurveTo(0.06, 0.39, 0.21, 0.5)
    p.lineTo(-0.21, 0.5)
    p.quadraticCurveTo(-0.06, 0.39, -0.05, 0.21)
    p.bezierCurveTo(-0.2, 0.37, -0.46, 0.34, -0.48, 0.14)
    p.bezierCurveTo(-0.5, -0.1, -0.17, -0.26, 0, -0.5)
    p.closePath()
  } else if (suit === 'hearts') {
    p.moveTo(0, 0.46)
    p.bezierCurveTo(-0.16, 0.3, -0.5, 0.08, -0.48, -0.18)
    p.bezierCurveTo(-0.46, -0.43, -0.12, -0.49, 0, -0.25)
    p.bezierCurveTo(0.12, -0.49, 0.46, -0.43, 0.48, -0.18)
    p.bezierCurveTo(0.5, 0.08, 0.16, 0.3, 0, 0.46)
    p.closePath()
  } else {
    p.moveTo(0, -0.5)
    p.quadraticCurveTo(0.13, -0.16, 0.37, 0)
    p.quadraticCurveTo(0.13, 0.16, 0, 0.5)
    p.quadraticCurveTo(-0.13, 0.16, -0.37, 0)
    p.quadraticCurveTo(-0.13, -0.16, 0, -0.5)
    p.closePath()
  }
  return p
}
const PATHS = Object.fromEntries(SUITS.map((s) => [s, suitPath(s)]))

function pip(g, suit, x, y, size, flip = false, color = suitInk(suit)) {
  g.save()
  g.translate(x, y)
  if (flip) g.rotate(Math.PI)
  g.scale(size, size)
  g.fillStyle = color
  g.fill(PATHS[suit], 'nonzero')
  g.restore()
}

// standard pip positions (cm): columns and rows of the pip field
const L = 1.72
const C = CARD_W / 2
const R = CARD_W - 1.72
const TOP = 1.72
const BOT = CARD_H - 1.72
const MID = CARD_H / 2
const Q1 = TOP + (BOT - TOP) / 3
const Q3 = TOP + ((BOT - TOP) * 2) / 3
const LAYOUT = {
  2: [[C, TOP], [C, BOT]],
  3: [[C, TOP], [C, MID], [C, BOT]],
  4: [[L, TOP], [R, TOP], [L, BOT], [R, BOT]],
  5: [[L, TOP], [R, TOP], [C, MID], [L, BOT], [R, BOT]],
  6: [[L, TOP], [R, TOP], [L, MID], [R, MID], [L, BOT], [R, BOT]],
  7: [[L, TOP], [R, TOP], [C, (TOP + MID) / 2], [L, MID], [R, MID], [L, BOT], [R, BOT]],
  8: [[L, TOP], [R, TOP], [C, (TOP + MID) / 2], [L, MID], [R, MID], [C, (MID + BOT) / 2], [L, BOT], [R, BOT]],
  9: [[L, TOP], [R, TOP], [L, Q1], [R, Q1], [C, MID], [L, Q3], [R, Q3], [L, BOT], [R, BOT]],
  10: [[L, TOP], [R, TOP], [C, (TOP + Q1) / 2], [L, Q1], [R, Q1], [L, Q3], [R, Q3], [C, (Q3 + BOT) / 2], [L, BOT], [R, BOT]],
}

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

// the corner index: rank over a small pip, and the same turned round
function indices(g, rank, suit) {
  const ink = suitInk(suit)
  for (const turn of [0, 1]) {
    g.save()
    if (turn) {
      g.translate(CARD_W, CARD_H)
      g.rotate(Math.PI)
    }
    g.fillStyle = ink
    g.textAlign = 'center'
    g.textBaseline = 'alphabetic'
    g.font = `600 1.02px ${SERIF}`
    g.save()
    g.translate(0.56, 1.2)
    if (rank === '10') g.scale(0.78, 1)
    g.fillText(rank, 0, 0)
    g.restore()
    pip(g, suit, 0.56, 1.72, 0.6)
    g.restore()
  }
}

// ---- the ace's big pip, with a white inline and a little ornament ----
function acePip(g, suit) {
  const ink = suitInk(suit)
  const s = suit === 'diamonds' ? 2.5 : 2.9
  pip(g, suit, C, MID, s, false, ink)
  pip(g, suit, C, MID, s * 0.88, false, '#ffffff')
  pip(g, suit, C, MID, s * 0.82, false, ink)
  // a white floral motif in the middle
  g.save()
  g.translate(C, MID - (suit === 'hearts' ? 0.15 : 0.05))
  g.strokeStyle = '#ffffff'
  g.fillStyle = '#ffffff'
  g.lineWidth = 0.035
  for (let i = 0; i < 6; i++) {
    g.save()
    g.rotate((i / 6) * Math.PI * 2)
    g.beginPath()
    g.ellipse(0, -0.34, 0.09, 0.24, 0, 0, Math.PI * 2)
    g.stroke()
    g.beginPath()
    g.moveTo(0, -0.1)
    g.quadraticCurveTo(0.18, -0.5, 0, -0.62)
    g.stroke()
    g.restore()
  }
  g.beginPath()
  g.arc(0, 0, 0.1, 0, Math.PI * 2)
  g.fill()
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2
    g.beginPath()
    g.arc(Math.cos(a) * 0.72, Math.sin(a) * 0.72, 0.028, 0, Math.PI * 2)
    g.fill()
  }
  g.restore()
}

// ---- court figures ----
const GOLD = '#f2c12e'
const CRIMSON = '#c9262c'
const ROYAL = '#2b4fa8'
const SKIN = '#f7e2c5'
const OUT = '#141414'

function shape(g, fill, draw, lw = 0.028) {
  g.beginPath()
  draw()
  g.fillStyle = fill
  g.fill()
  g.lineWidth = lw
  g.strokeStyle = OUT
  g.stroke()
}

// the top half of a court card; it is drawn twice, the second time turned
// round, and clipped to the frame's half
function courtHalf(g, rank, suit, fx, fy, fw, fh) {
  const cx = fx + fw / 2 + 0.12
  const neck = fy + fh * 0.6
  const headY = fy + fh * 0.36
  const bot = fy + fh + 0.05
  // robe: square shoulders, crimson, with a royal-blue panel on one side
  shape(g, CRIMSON, () => {
    g.moveTo(fx + 0.04, bot)
    g.lineTo(fx + 0.06, neck + 0.62)
    g.lineTo(cx - 0.55, neck + 0.04)
    g.lineTo(cx + 0.55, neck + 0.04)
    g.lineTo(fx + fw - 0.06, neck + 0.62)
    g.lineTo(fx + fw - 0.04, bot)
    g.closePath()
  })
  shape(g, ROYAL, () => {
    g.moveTo(fx + 0.1, bot)
    g.lineTo(fx + 0.12, neck + 0.68)
    g.lineTo(cx - 0.62, neck + 0.22)
    g.lineTo(cx - 0.68, bot)
    g.closePath()
  })
  // gold front panel with black chevrons
  shape(g, GOLD, () => {
    g.moveTo(cx - 0.4, neck + 0.08)
    g.lineTo(cx + 0.4, neck + 0.08)
    g.lineTo(cx + 0.52, bot)
    g.lineTo(cx - 0.52, bot)
    g.closePath()
  })
  g.strokeStyle = OUT
  g.lineWidth = 0.03
  for (let y = neck + 0.28; y < bot; y += 0.24) {
    g.beginPath()
    g.moveTo(cx - 0.4, y)
    g.lineTo(cx, y + 0.13)
    g.lineTo(cx + 0.4, y)
    g.stroke()
  }
  // white dots on the blue, black and gold stripes on the right sleeve
  g.fillStyle = '#ffffff'
  for (let y = neck + 0.62; y < bot; y += 0.2)
    for (let x = fx + 0.26; x < cx - 0.72; x += 0.19) {
      g.beginPath()
      g.arc(x + (Math.round(y * 5) % 2) * 0.09, y, 0.032, 0, Math.PI * 2)
      g.fill()
    }
  g.save()
  g.beginPath()
  g.moveTo(cx + 0.55, neck + 0.04)
  g.lineTo(fx + fw - 0.06, neck + 0.62)
  g.lineTo(fx + fw - 0.04, bot)
  g.lineTo(cx + 0.52, bot)
  g.closePath()
  g.clip()
  for (let k = -6; k < 12; k++) {
    g.fillStyle = k % 2 ? OUT : GOLD
    g.beginPath()
    const x0 = cx + 0.5 + k * 0.16
    g.moveTo(x0, neck)
    g.lineTo(x0 + 0.08, neck)
    g.lineTo(x0 - 0.6, bot + 0.1)
    g.lineTo(x0 - 0.68, bot + 0.1)
    g.closePath()
    if (k % 3 === 0) g.fill()
  }
  g.restore()
  // gold trim round the neckline and down the panel edges
  g.strokeStyle = GOLD
  g.lineWidth = 0.07
  g.beginPath()
  g.moveTo(fx + 0.06, neck + 0.62)
  g.lineTo(cx - 0.55, neck + 0.04)
  g.lineTo(cx + 0.55, neck + 0.04)
  g.lineTo(fx + fw - 0.06, neck + 0.62)
  g.stroke()
  g.strokeStyle = OUT
  g.lineWidth = 0.02
  g.stroke()
  // the held item
  if (rank === 'K') {
    // a sword, rising behind the shoulder
    shape(g, '#e8ecef', () => {
      g.moveTo(fx + fw - 0.42, fy + fh + 0.05)
      g.lineTo(fx + fw - 0.42, fy + 0.45)
      g.lineTo(fx + fw - 0.34, fy + 0.25)
      g.lineTo(fx + fw - 0.26, fy + 0.45)
      g.lineTo(fx + fw - 0.26, fy + fh + 0.05)
      g.closePath()
    })
    shape(g, GOLD, () => g.rect(fx + fw - 0.52, neck + 0.2, 0.36, 0.1))
  } else if (rank === 'Q') {
    // a flower
    g.strokeStyle = '#2f6b2f'
    g.lineWidth = 0.05
    g.beginPath()
    g.moveTo(cx - 0.95, neck + 0.6)
    g.quadraticCurveTo(cx - 1.25, neck - 0.3, cx - 1.05, fy + 0.95)
    g.stroke()
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2
      shape(g, i % 2 ? CRIMSON : GOLD, () => g.ellipse(cx - 1.05 + Math.cos(a) * 0.15, fy + 0.95 + Math.sin(a) * 0.15, 0.12, 0.08, a, 0, Math.PI * 2), 0.02)
    }
    shape(g, GOLD, () => g.arc(cx - 1.05, fy + 0.95, 0.07, 0, Math.PI * 2), 0.02)
  } else {
    // a feathered leaf
    shape(g, '#3d7a3a', () => {
      g.moveTo(fx + fw - 0.35, neck + 0.3)
      g.quadraticCurveTo(fx + fw - 0.05, fy + 1.0, fx + fw - 0.4, fy + 0.35)
      g.quadraticCurveTo(fx + fw - 0.65, fy + 1.0, fx + fw - 0.35, neck + 0.3)
      g.closePath()
    })
  }
  // a hand holding the item
  if (rank === 'K') shape(g, SKIN, () => g.ellipse(fx + fw - 0.34, neck + 0.42, 0.16, 0.13, 0, 0, Math.PI * 2))
  else if (rank === 'Q') shape(g, SKIN, () => g.ellipse(cx - 0.95, neck + 0.62, 0.16, 0.13, 0, 0, Math.PI * 2))
  else shape(g, SKIN, () => g.ellipse(fx + fw - 0.38, neck + 0.4, 0.15, 0.12, 0, 0, Math.PI * 2))
  // collar
  shape(g, '#ffffff', () => {
    g.moveTo(cx - 0.55, neck + 0.02)
    for (let i = 0; i <= 10; i++) g.lineTo(cx - 0.55 + i * 0.11, neck + (i % 2 ? 0.2 : 0.02))
    g.lineTo(cx + 0.55, neck - 0.06)
    g.lineTo(cx - 0.55, neck - 0.06)
    g.closePath()
  })
  // hair behind the face
  if (rank === 'Q') shape(g, '#5b3a22', () => g.ellipse(cx, headY + 0.12, 0.62, 0.78, 0, 0, Math.PI * 2))
  if (rank === 'J') shape(g, GOLD, () => g.ellipse(cx, headY + 0.15, 0.6, 0.62, 0, 0, Math.PI * 2))
  // face
  shape(g, SKIN, () => g.ellipse(cx, headY, 0.5, 0.6, 0, 0, Math.PI * 2))
  // features: brows, eyes, nose, mouth
  g.strokeStyle = OUT
  g.lineWidth = 0.025
  g.beginPath()
  for (const s of [-1, 1]) {
    g.moveTo(cx + s * 0.08, headY - 0.17)
    g.quadraticCurveTo(cx + s * 0.2, headY - 0.24, cx + s * 0.3, headY - 0.17)
    g.moveTo(cx + s * 0.1, headY - 0.07)
    g.quadraticCurveTo(cx + s * 0.19, headY - 0.12, cx + s * 0.27, headY - 0.07)
  }
  g.moveTo(cx, headY - 0.05)
  g.lineTo(cx - 0.05, headY + 0.12)
  g.lineTo(cx + 0.02, headY + 0.14)
  g.moveTo(cx - 0.12, headY + 0.26)
  g.quadraticCurveTo(cx, headY + 0.3, cx + 0.12, headY + 0.26)
  g.stroke()
  g.fillStyle = OUT
  for (const s of [-1, 1]) {
    g.beginPath()
    g.arc(cx + s * 0.19, headY - 0.07, 0.03, 0, Math.PI * 2)
    g.fill()
  }
  if (rank === 'K') {
    // beard and moustache
    shape(g, '#f1e3b4', () => {
      g.moveTo(cx - 0.42, headY + 0.1)
      g.quadraticCurveTo(cx - 0.4, headY + 0.75, cx, headY + 0.82)
      g.quadraticCurveTo(cx + 0.4, headY + 0.75, cx + 0.42, headY + 0.1)
      g.quadraticCurveTo(cx, headY + 0.42, cx - 0.42, headY + 0.1)
      g.closePath()
    })
    g.beginPath()
    g.moveTo(cx - 0.22, headY + 0.24)
    g.quadraticCurveTo(cx, headY + 0.12, cx + 0.22, headY + 0.24)
    g.stroke()
  }
  // headwear
  if (rank === 'J') {
    shape(g, CRIMSON, () => {
      g.moveTo(cx - 0.52, headY - 0.3)
      g.quadraticCurveTo(cx - 0.4, headY - 1.0, cx + 0.1, headY - 0.98)
      g.quadraticCurveTo(cx + 0.6, headY - 0.9, cx + 0.52, headY - 0.3)
      g.closePath()
    })
    shape(g, GOLD, () => g.rect(cx - 0.55, headY - 0.42, 1.1, 0.14))
  } else {
    const top = headY - (rank === 'K' ? 1.05 : 0.9)
    shape(g, GOLD, () => {
      g.moveTo(cx - 0.48, headY - 0.36)
      g.lineTo(cx - 0.52, top + 0.15)
      for (let i = 0; i < 5; i++) {
        const x = cx - 0.52 + (i + 0.5) * 0.208
        g.lineTo(x, top - (i % 2 ? 0.02 : 0.14))
        g.lineTo(cx - 0.52 + (i + 1) * 0.208, top + 0.15)
      }
      g.lineTo(cx + 0.48, headY - 0.36)
      g.closePath()
    })
    for (let i = 0; i < 3; i++) shape(g, i === 1 ? ROYAL : CRIMSON, () => g.arc(cx - 0.3 + i * 0.3, headY - 0.5, 0.06, 0, Math.PI * 2), 0.02)
    if (rank === 'Q') {
      // the veil falling either side
      for (const s of [-1, 1])
        shape(g, '#ffffff', () => {
          g.moveTo(cx + s * 0.45, headY - 0.4)
          g.quadraticCurveTo(cx + s * 0.85, headY + 0.3, cx + s * 0.62, neck)
          g.lineTo(cx + s * 0.45, neck - 0.05)
          g.quadraticCurveTo(cx + s * 0.58, headY + 0.2, cx + s * 0.42, headY - 0.1)
          g.closePath()
        })
    }
  }
  // the suit, large, in the frame's top-left corner
  shape(g, '#ffffff', () => g.rect(fx + 0.02, fy + 0.02, 0.86, 0.9), 0)
  pip(g, suit, fx + 0.45, fy + 0.5, 0.72)
}

function courtFace(g, rank, suit) {
  const fx = 0.95
  const fy = 0.62
  const fw = CARD_W - 2 * fx
  const fh = (CARD_H - 2 * fy) / 2
  for (const turn of [0, 1]) {
    g.save()
    if (turn) {
      g.translate(CARD_W, CARD_H)
      g.rotate(Math.PI)
    }
    g.save()
    g.beginPath()
    g.rect(fx, fy, fw, fh)
    g.clip()
    courtHalf(g, rank, suit, fx, fy, fw, fh)
    g.restore()
    g.restore()
  }
  // the frame
  g.strokeStyle = ROYAL
  g.lineWidth = 0.03
  g.strokeRect(fx, fy, fw, 2 * fh)
  g.lineWidth = 0.015
  g.strokeRect(fx + 0.06, fy + 0.06, fw - 0.12, 2 * fh - 0.12)
  // the line between the two halves
  g.beginPath()
  g.moveTo(fx, fy + fh)
  g.lineTo(fx + fw, fy + fh)
  g.lineWidth = 0.02
  g.stroke()
}

export function faceTexture(rank, suit, pxPerCm = 160) {
  const { c, g } = canvasFor(pxPerCm)
  g.fillStyle = '#fbfaf6'
  g.fillRect(0, 0, CARD_W, CARD_H)
  if (rank === 'A') acePip(g, suit)
  else if (rank === 'J' || rank === 'Q' || rank === 'K') courtFace(g, rank, suit)
  else for (const [x, y] of LAYOUT[rank]) pip(g, suit, x, y, suit === 'diamonds' ? 0.98 : 1.05, y > MID + 0.01)
  indices(g, rank, suit)
  return toTexture(c)
}

// the back: white border, a fine diagonal lattice in one colour, an inner
// rule and a medallion
export function backTexture(color = '#a3202a', pxPerCm = 160) {
  const { c, g } = canvasFor(pxPerCm)
  g.fillStyle = '#fbfaf6'
  g.fillRect(0, 0, CARD_W, CARD_H)
  const m = 0.32
  g.save()
  g.beginPath()
  g.rect(m, m, CARD_W - 2 * m, CARD_H - 2 * m)
  g.clip()
  g.fillStyle = color
  g.fillRect(m, m, CARD_W - 2 * m, CARD_H - 2 * m)
  g.strokeStyle = 'rgba(255,255,255,0.85)'
  g.lineWidth = 0.018
  const step = 0.24
  for (let d = -CARD_H; d < CARD_W + CARD_H; d += step) {
    g.beginPath()
    g.moveTo(d, 0)
    g.lineTo(d + CARD_H, CARD_H)
    g.moveTo(d, CARD_H)
    g.lineTo(d + CARD_H, 0)
    g.stroke()
  }
  // small dots in each diamond
  g.fillStyle = 'rgba(255,255,255,0.7)'
  for (let y = m; y < CARD_H; y += step)
    for (let x = m + ((Math.round((y - m) / step) % 2) * step) / 2; x < CARD_W; x += step) {
      g.beginPath()
      g.arc(x, y + step / 2, 0.022, 0, Math.PI * 2)
      g.fill()
    }
  g.restore()
  g.strokeStyle = '#fbfaf6'
  g.lineWidth = 0.05
  g.strokeRect(m + 0.16, m + 0.16, CARD_W - 2 * m - 0.32, CARD_H - 2 * m - 0.32)
  // medallion
  g.save()
  g.translate(C, MID)
  g.fillStyle = color
  g.beginPath()
  g.ellipse(0, 0, 1.15, 1.55, 0, 0, Math.PI * 2)
  g.fill()
  g.strokeStyle = '#fbfaf6'
  g.lineWidth = 0.05
  g.stroke()
  g.lineWidth = 0.02
  g.beginPath()
  g.ellipse(0, 0, 1.02, 1.42, 0, 0, Math.PI * 2)
  g.stroke()
  for (let i = 0; i < 4; i++) {
    g.save()
    g.rotate((i / 4) * Math.PI * 2)
    pip(g, SUITS[i], 0, -0.62, 0.48, false, '#fbfaf6')
    g.restore()
  }
  g.restore()
  return toTexture(c)
}
