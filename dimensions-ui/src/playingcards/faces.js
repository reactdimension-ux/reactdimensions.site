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
// Drawn fresh in the traditional manner: a half-length figure to the waist,
// mirrored about the card's middle, in crimson, royal blue, gold and black
// with fine black linework. Each half is drawn in its own unit box (x 0..1
// across the frame, y 0..1 from the frame's top to the middle line).
const GOLD = '#f0bf2a'
const GOLD_D = '#c9961a'
const CRIMSON = '#c8232a'
const ROYAL = '#2a4ea8'
const SKIN = '#f6dfc2'
const OUT = '#121212'
const ERMINE = '#fbfaf4'

function courtHalf(g, rank, suit, fx, fy, fw, fh) {
  g.save()
  g.translate(fx, fy)
  g.scale(fw, fh)
  const LW = 0.028 / fw
  const fill = (color, draw, lw = LW) => {
    g.beginPath()
    draw()
    g.fillStyle = color
    g.fill()
    if (lw) {
      g.lineWidth = lw
      g.strokeStyle = OUT
      g.lineJoin = 'round'
      g.stroke()
    }
  }
  const line = (draw, lw = LW, color = OUT) => {
    g.beginPath()
    draw()
    g.lineWidth = lw
    g.strokeStyle = color
    g.lineCap = 'round'
    g.stroke()
  }
  const clipTo = (draw, inside) => {
    g.save()
    g.beginPath()
    draw()
    g.clip()
    inside()
    g.restore()
  }
  const K = rank === 'K'
  const Q = rank === 'Q'
  const J = rank === 'J'

  // ---- the item held, behind the body ----
  if (K) {
    // an upright sword at the figure's left (viewer's right)
    fill('#e9edf0', () => {
      g.moveTo(0.845, 1.02)
      g.lineTo(0.845, 0.12)
      g.lineTo(0.87, 0.05)
      g.lineTo(0.895, 0.12)
      g.lineTo(0.895, 1.02)
      g.closePath()
    })
    line(() => (g.moveTo(0.87, 0.14), g.lineTo(0.87, 0.98)), LW * 0.6, '#7d8790')
  } else if (J) {
    // a staff topped with a broad leaf
    fill('#6b4a2a', () => g.rect(0.855, 0.2, 0.03, 0.85))
    fill('#3f8a3c', () => {
      g.moveTo(0.87, 0.24)
      g.bezierCurveTo(0.99, 0.18, 0.97, 0.02, 0.87, 0.0)
      g.bezierCurveTo(0.77, 0.02, 0.75, 0.18, 0.87, 0.24)
    })
    line(() => {
      g.moveTo(0.87, 0.23)
      g.lineTo(0.87, 0.03)
      for (let i = 0; i < 4; i++) {
        g.moveTo(0.87, 0.2 - i * 0.045)
        g.lineTo(0.92, 0.16 - i * 0.045)
        g.moveTo(0.87, 0.2 - i * 0.045)
        g.lineTo(0.82, 0.16 - i * 0.045)
      }
    }, LW * 0.6)
  }

  // ---- hair falling behind the shoulders ----
  if (Q)
    fill('#6a3b1f', () => {
      g.moveTo(0.34, 0.3)
      g.bezierCurveTo(0.3, 0.45, 0.26, 0.6, 0.3, 0.7)
      g.lineTo(0.7, 0.7)
      g.bezierCurveTo(0.74, 0.6, 0.7, 0.45, 0.66, 0.3)
      g.closePath()
    })
  if (J || K)
    fill(K ? '#e3c26a' : '#e8b93a', () => {
      g.moveTo(0.35, 0.3)
      g.bezierCurveTo(0.31, 0.42, 0.32, 0.52, 0.35, 0.58)
      g.lineTo(0.65, 0.58)
      g.bezierCurveTo(0.68, 0.52, 0.69, 0.42, 0.65, 0.3)
      g.closePath()
    })

  // ---- the robe ----
  const robe = () => {
    g.moveTo(-0.02, 1.02)
    g.lineTo(-0.02, 0.76)
    g.quadraticCurveTo(0.03, 0.62, 0.2, 0.6)
    g.quadraticCurveTo(0.33, 0.57, 0.41, 0.52)
    g.lineTo(0.59, 0.52)
    g.quadraticCurveTo(0.67, 0.57, 0.8, 0.6)
    g.quadraticCurveTo(0.97, 0.62, 1.02, 0.76)
    g.lineTo(1.02, 1.02)
    g.closePath()
  }
  fill(CRIMSON, robe)
  clipTo(robe, () => {
    // a royal-blue sleeve on the viewer's left, dotted white
    fill(ROYAL, () => {
      g.moveTo(-0.05, 1.05)
      g.lineTo(-0.05, 0.72)
      g.quadraticCurveTo(0.05, 0.62, 0.2, 0.6)
      g.lineTo(0.31, 1.05)
      g.closePath()
    })
    g.fillStyle = 'rgba(255,255,255,0.9)'
    for (let y = 0.68; y < 1; y += 0.07)
      for (let x = 0.02; x < 0.28; x += 0.07) {
        g.beginPath()
        g.arc(x + (Math.round(y / 0.07) % 2) * 0.035, y, 0.009, 0, Math.PI * 2)
        g.fill()
      }
    // black and gold stripes on the viewer's right sleeve
    clipTo(
      () => {
        g.moveTo(0.69, 0.58)
        g.lineTo(1.05, 0.7)
        g.lineTo(1.05, 1.05)
        g.lineTo(0.68, 1.05)
        g.closePath()
      },
      () => {
        for (let k = 0; k < 9; k++) {
          g.fillStyle = k % 2 ? OUT : GOLD
          g.fillRect(0.7 + k * 0.04, 0.5, 0.016, 0.6)
        }
      },
    )
    // the gold front panel with a black lattice and a row of jewels
    const panel = () => {
      g.moveTo(0.41, 0.53)
      g.lineTo(0.59, 0.53)
      g.lineTo(0.66, 1.05)
      g.lineTo(0.34, 1.05)
      g.closePath()
    }
    fill(GOLD, panel)
    clipTo(panel, () => {
      line(() => {
        for (let d = -0.6; d < 0.6; d += 0.06) {
          g.moveTo(0.5 + d, 0.5)
          g.lineTo(0.5 + d + 0.55, 1.05)
          g.moveTo(0.5 + d, 0.5)
          g.lineTo(0.5 + d - 0.55, 1.05)
        }
      }, LW * 0.55)
    })
    for (let i = 0; i < 4; i++) fill(i % 2 ? ROYAL : CRIMSON, () => g.arc(0.5, 0.64 + i * 0.1, 0.018, 0, Math.PI * 2), LW * 0.6)
    // cloth folds
    line(() => {
      g.moveTo(0.27, 0.75)
      g.quadraticCurveTo(0.3, 0.88, 0.28, 1.0)
      g.moveTo(0.75, 0.72)
      g.quadraticCurveTo(0.73, 0.86, 0.76, 1.0)
    }, LW * 0.7)
  })
  // the edge of the robe again, over the clipped fills
  line(robe)

  // ---- collar: an ermine cape for king and queen, a gold collar for the jack ----
  const cape = () => {
    g.moveTo(0.16, 0.62)
    g.quadraticCurveTo(0.5, 0.86, 0.84, 0.62)
    g.quadraticCurveTo(0.7, 0.53, 0.6, 0.52)
    g.lineTo(0.4, 0.52)
    g.quadraticCurveTo(0.3, 0.53, 0.16, 0.62)
    g.closePath()
  }
  if (J) {
    fill(GOLD, cape)
    g.fillStyle = OUT
    for (let i = 0; i < 9; i++) {
      const t = i / 8
      g.beginPath()
      g.arc(0.22 + t * 0.56, 0.645 + Math.sin(t * Math.PI) * 0.1, 0.011, 0, Math.PI * 2)
      g.fill()
    }
  } else {
    fill(ERMINE, cape)
    // ermine tails
    g.fillStyle = OUT
    for (const [x, y] of [[0.25, 0.64], [0.36, 0.7], [0.5, 0.73], [0.64, 0.7], [0.75, 0.64], [0.43, 0.6], [0.57, 0.6]]) {
      g.beginPath()
      g.moveTo(x, y - 0.018)
      g.lineTo(x + 0.01, y + 0.014)
      g.lineTo(x - 0.01, y + 0.014)
      g.closePath()
      g.fill()
    }
  }

  // ---- neck and head ----
  fill(SKIN, () => g.rect(0.445, 0.42, 0.11, 0.11))
  for (const s of [-1, 1]) fill(SKIN, () => g.ellipse(0.5 + s * 0.128, 0.34, 0.022, 0.04, 0, 0, Math.PI * 2))
  fill(SKIN, () => g.ellipse(0.5, 0.33, 0.125, 0.155, 0, 0, Math.PI * 2))
  // blush
  g.fillStyle = 'rgba(220,90,80,0.16)'
  for (const s of [-1, 1]) {
    g.beginPath()
    g.arc(0.5 + s * 0.07, 0.375, 0.03, 0, Math.PI * 2)
    g.fill()
  }
  // eyes, glancing to the side, with lids and brows
  for (const s of [-1, 1]) {
    const ex = 0.5 + s * 0.052
    fill('#ffffff', () => g.ellipse(ex, 0.315, 0.026, 0.012, 0, 0, Math.PI * 2), LW * 0.6)
    g.fillStyle = '#2a2a3a'
    g.beginPath()
    g.arc(ex + 0.009, 0.316, 0.0085, 0, Math.PI * 2)
    g.fill()
    line(() => {
      g.moveTo(ex - 0.03, 0.312)
      g.quadraticCurveTo(ex, 0.296, ex + 0.03, 0.312)
    }, LW * 0.9)
    line(() => {
      g.moveTo(ex - 0.03, 0.285)
      g.quadraticCurveTo(ex, 0.27, ex + 0.032, 0.284)
    }, LW * 1.1, Q ? '#5a321b' : '#7a5a2a')
  }
  // nose and mouth
  line(() => {
    g.moveTo(0.505, 0.315)
    g.quadraticCurveTo(0.49, 0.36, 0.488, 0.375)
    g.quadraticCurveTo(0.5, 0.385, 0.515, 0.377)
  }, LW * 0.8)
  fill('#c4453f', () => {
    g.moveTo(0.47, 0.415)
    g.quadraticCurveTo(0.5, 0.403, 0.53, 0.415)
    g.quadraticCurveTo(0.5, 0.432, 0.47, 0.415)
  }, LW * 0.5)

  // ---- beard, moustache and hair framing the face ----
  if (K) {
    fill('#e9d08a', () => {
      g.moveTo(0.38, 0.36)
      g.bezierCurveTo(0.38, 0.47, 0.43, 0.55, 0.5, 0.56)
      g.bezierCurveTo(0.57, 0.55, 0.62, 0.47, 0.62, 0.36)
      g.bezierCurveTo(0.58, 0.43, 0.54, 0.44, 0.5, 0.44)
      g.bezierCurveTo(0.46, 0.44, 0.42, 0.43, 0.38, 0.36)
      g.closePath()
    })
    line(() => {
      for (let i = 0; i < 5; i++) {
        const x = 0.42 + i * 0.04
        g.moveTo(x, 0.46)
        g.quadraticCurveTo(x - 0.012, 0.5, x + 0.004, 0.53)
      }
    }, LW * 0.5)
  }
  if (K || J)
    fill(K ? '#e9d08a' : '#d9a92f', () => {
      g.moveTo(0.46, 0.405)
      g.quadraticCurveTo(0.5, 0.39, 0.54, 0.405)
      g.quadraticCurveTo(0.58, 0.42, 0.6, 0.405)
      g.quadraticCurveTo(0.56, 0.4, 0.5, 0.397)
      g.quadraticCurveTo(0.44, 0.4, 0.4, 0.405)
      g.quadraticCurveTo(0.42, 0.42, 0.46, 0.405)
    }, LW * 0.5)
  // locks over the temples
  const locks = Q ? '#6a3b1f' : K ? '#e3c26a' : '#e8b93a'
  for (const s of [-1, 1])
    fill(locks, () => {
      g.moveTo(0.5 + s * 0.06, 0.2)
      g.bezierCurveTo(0.5 + s * 0.16, 0.2, 0.5 + s * 0.15, 0.3, 0.5 + s * 0.125, 0.33)
      g.bezierCurveTo(0.5 + s * 0.115, 0.27, 0.5 + s * 0.09, 0.23, 0.5 + s * 0.06, 0.2)
    }, LW * 0.6)

  // ---- headwear ----
  if (J) {
    // a soft cap with a gold band and a plume
    fill(CRIMSON, () => {
      g.moveTo(0.36, 0.22)
      g.bezierCurveTo(0.34, 0.1, 0.5, 0.05, 0.62, 0.1)
      g.bezierCurveTo(0.7, 0.14, 0.66, 0.2, 0.64, 0.22)
      g.closePath()
    })
    fill(GOLD, () => g.rect(0.36, 0.2, 0.28, 0.035))
    fill('#ffffff', () => {
      g.moveTo(0.62, 0.12)
      g.bezierCurveTo(0.75, 0.0, 0.84, 0.04, 0.86, 0.1)
      g.bezierCurveTo(0.8, 0.07, 0.72, 0.09, 0.62, 0.14)
      g.closePath()
    }, LW * 0.6)
  } else {
    // crown: a jewelled band and its points (the king's with a velvet cap and crosses)
    const top = K ? 0.05 : 0.09
    if (K) fill(CRIMSON, () => g.ellipse(0.5, 0.15, 0.12, 0.08, 0, Math.PI, 0))
    fill(GOLD, () => {
      g.moveTo(0.37, 0.215)
      g.lineTo(0.36, 0.12)
      const n = 5
      for (let i = 0; i < n; i++) {
        const x0 = 0.36 + (i * 0.28) / n
        g.lineTo(x0 + 0.028, i % 2 ? top + 0.04 : top)
        g.lineTo(x0 + 0.056, 0.13)
      }
      g.lineTo(0.63, 0.215)
      g.closePath()
    })
    fill(GOLD_D, () => g.rect(0.36, 0.185, 0.28, 0.035))
    for (let i = 0; i < 5; i++) fill(i % 2 ? ROYAL : CRIMSON, () => g.arc(0.39 + i * 0.055, 0.203, 0.011, 0, Math.PI * 2), LW * 0.5)
    if (K)
      for (const x of [0.4, 0.5, 0.6])
        line(() => (g.moveTo(x, top - 0.035), g.lineTo(x, top + 0.01), g.moveTo(x - 0.015, top - 0.015), g.lineTo(x + 0.015, top - 0.015)), LW * 1.2, GOLD_D)
  }

  // ---- the hand holding the item ----
  const hand = (x, y) => {
    fill(SKIN, () => g.ellipse(x, y, 0.045, 0.035, 0, 0, Math.PI * 2))
    line(() => {
      for (let i = 0; i < 3; i++) {
        g.moveTo(x - 0.03 + i * 0.022, y - 0.02)
        g.lineTo(x - 0.03 + i * 0.022, y + 0.005)
      }
    }, LW * 0.5)
  }
  if (K) {
    fill(GOLD, () => g.rect(0.81, 0.62, 0.12, 0.022))
    hand(0.87, 0.69)
  } else if (J) hand(0.87, 0.66)
  else {
    // the queen's rose
    line(() => {
      g.moveTo(0.2, 0.78)
      g.quadraticCurveTo(0.12, 0.6, 0.17, 0.44)
    }, LW * 1.2, '#2f6b2f')
    fill('#3f8a3c', () => g.ellipse(0.14, 0.58, 0.035, 0.016, -0.6, 0, Math.PI * 2), LW * 0.6)
    fill(CRIMSON, () => g.arc(0.17, 0.42, 0.045, 0, Math.PI * 2))
    line(() => {
      g.arc(0.17, 0.42, 0.028, 0.3, 4.5)
      g.moveTo(0.182, 0.42)
      g.arc(0.17, 0.42, 0.012, 0, 5)
    }, LW * 0.6)
    hand(0.2, 0.79)
  }
  g.restore()

  // ---- the suit, in the frame's top-left corner ----
  g.fillStyle = '#fbfaf6'
  g.fillRect(fx + 0.04, fy + 0.04, 0.78, 0.82)
  g.strokeStyle = ROYAL
  g.lineWidth = 0.012
  g.strokeRect(fx + 0.04, fy + 0.04, 0.78, 0.82)
  pip(g, suit, fx + 0.43, fy + 0.45, 0.62)
}

// ---- the joker: a jester, full length, not mirrored ----
function jokerFace(g) {
  const fx = 0.95
  const fy = 0.62
  const fw = CARD_W - 2 * fx
  const fh = CARD_H - 2 * fy
  g.save()
  g.beginPath()
  g.rect(fx, fy, fw, fh)
  g.clip()
  g.translate(fx, fy)
  g.scale(fw, fw)
  const LW = 0.028 / fw
  const H = fh / fw // the box's height in units of its width
  const fill = (color, draw, lw = LW) => {
    g.beginPath()
    draw()
    g.fillStyle = color
    g.fill()
    if (lw) {
      g.lineWidth = lw
      g.strokeStyle = OUT
      g.lineJoin = 'round'
      g.stroke()
    }
  }
  const top = 0.25 // everything sits a little lower, to centre the figure
  g.translate(0, top)
  // the bell staff
  fill('#6b4a2a', () => g.rect(0.82, 0.55, 0.03, H - 0.55))
  fill(GOLD, () => g.arc(0.835, 0.52, 0.06, 0, Math.PI * 2))
  for (const [x, y] of [[0.77, 0.47], [0.9, 0.47]]) fill(GOLD, () => g.arc(x, y, 0.028, 0, Math.PI * 2), LW * 0.6)
  // the body: harlequin diamonds
  const body = () => {
    g.moveTo(0.18, H + 0.05)
    g.lineTo(0.2, 0.95)
    g.quadraticCurveTo(0.22, 0.72, 0.38, 0.68)
    g.lineTo(0.62, 0.68)
    g.quadraticCurveTo(0.78, 0.72, 0.8, 0.95)
    g.lineTo(0.82, H + 0.05)
    g.closePath()
  }
  fill(CRIMSON, body)
  g.save()
  g.beginPath()
  body()
  g.clip()
  const cols = [GOLD, ROYAL, CRIMSON, '#2f8a45']
  const d = 0.12
  for (let y = 0.6, r = 0; y < H + 0.2; y += d / 2, r++)
    for (let x = 0.1 + ((r % 2) * d) / 2; x < 0.95; x += d) {
      g.fillStyle = cols[(r + Math.round(x / d)) % 4]
      g.beginPath()
      g.moveTo(x, y - d / 2)
      g.lineTo(x + d / 2, y)
      g.lineTo(x, y + d / 2)
      g.lineTo(x - d / 2, y)
      g.closePath()
      g.fill()
      g.lineWidth = LW * 0.5
      g.strokeStyle = OUT
      g.stroke()
    }
  g.restore()
  // ruff collar
  fill('#ffffff', () => {
    for (let i = 0; i <= 14; i++) {
      const a = Math.PI + (i / 14) * Math.PI
      const r = i % 2 ? 0.2 : 0.26
      const x = 0.5 + Math.cos(a) * r
      const y = 0.66 - Math.sin(a) * r * 0.35
      if (i) g.lineTo(x, y)
      else g.moveTo(x, y)
    }
    g.closePath()
  })
  // face: a grin, rosy cheeks
  fill(SKIN, () => g.ellipse(0.5, 0.5, 0.13, 0.15, 0, 0, Math.PI * 2))
  g.fillStyle = 'rgba(220,80,70,0.22)'
  for (const s of [-1, 1]) {
    g.beginPath()
    g.arc(0.5 + s * 0.075, 0.54, 0.032, 0, Math.PI * 2)
    g.fill()
  }
  g.fillStyle = OUT
  for (const s of [-1, 1]) {
    g.beginPath()
    g.ellipse(0.5 + s * 0.05, 0.48, 0.012, 0.018, 0, 0, Math.PI * 2)
    g.fill()
  }
  g.beginPath()
  g.arc(0.5, 0.53, 0.06, 0.15 * Math.PI, 0.85 * Math.PI)
  g.lineWidth = LW
  g.strokeStyle = OUT
  g.stroke()
  fill(CRIMSON, () => g.arc(0.5, 0.51, 0.016, 0, Math.PI * 2), LW * 0.5)
  // the three-pointed hat, a bell on each point
  for (const [x, y, col] of [[0.2, 0.18, ROYAL], [0.5, 0.06, GOLD], [0.8, 0.18, CRIMSON]]) {
    fill(col, () => {
      g.moveTo(0.38, 0.4)
      g.quadraticCurveTo((0.38 + x) / 2 - 0.05, (0.4 + y) / 2, x, y)
      g.quadraticCurveTo((0.62 + x) / 2 + 0.05, (0.4 + y) / 2 + 0.05, 0.62, 0.4)
      g.closePath()
    })
    fill(GOLD, () => g.arc(x, y, 0.035, 0, Math.PI * 2), LW * 0.6)
  }
  fill(GOLD, () => g.rect(0.36, 0.38, 0.28, 0.04))
  g.restore()
  // the frame
  g.strokeStyle = ROYAL
  g.lineWidth = 0.03
  g.strokeRect(fx, fy, fw, fh)
  g.lineWidth = 0.015
  g.strokeRect(fx + 0.06, fy + 0.06, fw - 0.12, fh - 0.12)
}

// JOKER spelled down the corner, with a star
function jokerIndices(g) {
  for (const turn of [0, 1]) {
    g.save()
    if (turn) {
      g.translate(CARD_W, CARD_H)
      g.rotate(Math.PI)
    }
    g.fillStyle = '#141414'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.font = `700 0.5px ${SERIF}`
    ;['J', 'O', 'K', 'E', 'R'].forEach((ch, i) => g.fillText(ch, 0.48, 0.62 + i * 0.5))
    g.fillStyle = CRIMSON
    g.beginPath()
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5
      const r = i % 2 ? 0.09 : 0.22
      g.lineTo(0.48 + Math.cos(a) * r, 3.25 + Math.sin(a) * r)
    }
    g.closePath()
    g.fill()
    g.restore()
  }
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
  if (rank === 'JOKER') {
    jokerFace(g)
    jokerIndices(g)
    return toTexture(c)
  }
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
