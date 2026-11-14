import * as THREE from 'three'
import { canvasTexture } from '../airliner/textures.js'
import { BODY_END, TAIL_UV, body, livery, paneOutlines } from './geometry.js'

// Canvas textures for the helicopter: the fuselage paint unwrapped round its
// skin (length across, keel to crown and back down the far side), the tail
// seen from the side, the rotor blade, and the blur a turning rotor leaves.

const FONT = '700 100px "Helvetica Neue", Helvetica, Arial, sans-serif'
const SEAM = 'rgba(8,10,16,0.34)'
const JOINT = 'rgba(8,10,16,0.13)'

export function bodyTexture({ body: paint, stripe, registration }) {
  return canvasTexture(4096, 2048, (g, W, H) => {
    const X = (s) => (s / BODY_END) * W
    const Y = (v) => (1 - v) * H
    // how far round the port side (0 keel .. 0.5 crown) the skin reaches height y
    const vAt = (s, y) => body.thetaAt(s, y) / (Math.PI * 2)
    const both = (draw) => [1, -1].forEach((side) => draw((v) => (side > 0 ? v : 1 - v)))
    const stations = []
    for (let s = 0.7; s < BODY_END; s += 0.03) stations.push(s)
    stations.push(BODY_END)

    g.fillStyle = paint
    g.fillRect(0, 0, W, H)
    // the stripes: fill between two height curves, on both sides
    g.fillStyle = stripe
    for (const [lo, hi] of [['a0', 'a1'], ['b0', 'b1']])
      both((v) => {
        g.beginPath()
        stations.forEach((s, i) => g[i ? 'lineTo' : 'moveTo'](X(s), Y(v(vAt(s, livery(s)[lo])))))
        for (let i = stations.length - 1; i >= 0; i--) g.lineTo(X(stations[i]), Y(v(vAt(stations[i], livery(stations[i])[hi]))))
        g.closePath()
        g.fill()
      })

    // a line along the skin through [s, y] points of the side view
    const path = (pts, v) => {
      for (let i = 0; i < pts.length - 1; i++) {
        const [s0, y0] = pts[i]
        const [s1, y1] = pts[i + 1]
        const n = Math.max(2, Math.ceil(Math.hypot(s1 - s0, y1 - y0) / 0.03))
        for (let k = i ? 1 : 0; k <= n; k++) {
          const s = s0 + ((s1 - s0) * k) / n
          g[i || k ? 'lineTo' : 'moveTo'](X(s), Y(v(vAt(s, y0 + ((y1 - y0) * k) / n))))
        }
      }
    }
    const stroke = (pts, style, width) =>
      both((v) => {
        g.strokeStyle = style
        g.lineWidth = width
        g.lineJoin = 'round'
        g.beginPath()
        path(pts, v)
        g.stroke()
      })

    // skin joints: frames round the body, and the nose cone
    g.strokeStyle = JOINT
    g.lineWidth = 1.5
    g.beginPath()
    for (const s of [0.36, 4.06, 5.0, 5.7, 6.45, 7.2, 7.95, 8.7]) {
      g.moveTo(X(s), 0)
      g.lineTo(X(s), H)
    }
    g.stroke()
    // the crew door, the sliding cabin door and its rail, the clamshell doors at the rear
    stroke([[1.16, 0.7], [1.16, 1.2], [1.76, 2.05], [2.66, 2.05], [2.66, 0.7], [1.16, 0.7]], SEAM, 3)
    stroke([[2.71, 0.7], [2.71, 2.05], [3.98, 2.05], [3.98, 0.7], [2.71, 0.7]], SEAM, 3)
    stroke([[3.98, 1.13], [5.2, 1.16]], SEAM, 5)
    stroke([[3.98, 2.07], [5.05, 2.07]], SEAM, 4)
    stroke([[5.06, 0.92], [5.06, 2.06]], SEAM, 3)
    // access panels: the avionics bay in the nose, the battery, the fuel filler
    stroke([[0.42, 1.02], [0.9, 0.98], [0.9, 1.2], [0.5, 1.26], [0.42, 1.02]], JOINT, 2)
    stroke([[4.25, 0.72], [4.75, 0.78], [4.75, 1.0], [4.25, 1.0], [4.25, 0.72]], JOINT, 2)
    for (const side of [1, -1]) {
      const v = vAt(4.52, 1.17)
      g.strokeStyle = SEAM
      g.lineWidth = 2.5
      g.beginPath()
      g.ellipse(X(4.52), Y(side > 0 ? v : 1 - v), X(0.075), X(0.075) * 1.1, 0, 0, Math.PI * 2)
      g.stroke()
    }
    // the belly: hatches along the keel, drawn across the seam of the unwrap
    g.strokeStyle = SEAM
    g.lineWidth = 2.5
    for (const [s0, s1, dv] of [[1.7, 2.5, 0.035], [2.7, 3.6, 0.04], [3.75, 4.3, 0.03]])
      for (const y of [Y(0) - dv * H, Y(1)]) {
        g.strokeRect(X(s0), y - 4, X(s1) - X(s0), dv * H + 4)
      }

    // lettering, sized in metres and squared up for the unwrap
    const label = (text, s, y, capH, color) => {
      if (!text) return
      const v = vAt(s, y)
      const th = v * Math.PI * 2
      const perM = H / (Math.PI * 2 * (body.point(s, th + 5e-3).distanceTo(body.point(s, th - 5e-3)) / 1e-2))
      const k = capH / 72
      g.fillStyle = color
      g.font = FONT
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      for (const side of [1, -1]) {
        g.save()
        g.translate(X(s), Y(side > 0 ? v : 1 - v))
        if (side < 0) g.rotate(Math.PI)
        g.scale((k * W) / BODY_END, k * perM)
        g.fillText(text, 0, 0)
        g.restore()
      }
    }
    label(registration, 7.75, body.section(7.75).cy + 0.085, 0.125, stripe)
  })
}

// Where the fuselage skin is cut away for the glazing: white is skin, black
// the window openings, in the same unwrap as the paint.
export function maskTexture() {
  const t = canvasTexture(2048, 1024, (g, W, H) => {
    g.fillStyle = '#fff'
    g.fillRect(0, 0, W, H)
    g.fillStyle = '#000'
    for (const outline of paneOutlines())
      for (const side of [1, -1]) {
        g.beginPath()
        outline.forEach(([s, v], i) => g[i ? 'lineTo' : 'moveTo']((s / BODY_END) * W, (1 - (side > 0 ? v : 1 - v)) * H))
        g.closePath()
        g.fill()
      }
  })
  t.colorSpace = THREE.NoColorSpace
  return t
}

// the fan shroud and the fin, seen from the side
export function tailTexture({ body: paint, stripe }) {
  return canvasTexture(1024, 1024, (g, W, H) => {
    const X = (s) => ((s - TAIL_UV.s0) / (TAIL_UV.s1 - TAIL_UV.s0)) * W
    const Y = (y) => (1 - (y - TAIL_UV.y0) / (TAIL_UV.y1 - TAIL_UV.y0)) * H
    g.fillStyle = paint
    g.fillRect(0, 0, W, H)
    g.fillStyle = stripe
    for (const [lo, hi] of [['a0', 'a1'], ['b0', 'b1']]) {
      g.beginPath()
      for (let s = TAIL_UV.s0; s <= TAIL_UV.s1; s += 0.02) g.lineTo(X(s), Y(livery(s)[lo]))
      for (let s = TAIL_UV.s1; s >= TAIL_UV.s0; s -= 0.02) g.lineTo(X(s), Y(livery(s)[hi]))
      g.closePath()
      g.fill()
    }
    // the joint where the shroud bolts to the boom
    g.strokeStyle = JOINT
    g.lineWidth = 2
    g.beginPath()
    g.moveTo(X(9.42), 0)
    g.lineTo(X(9.42), H)
    g.stroke()
  })
}

// A rotor blade: span across, the leading edge along the middle. Dark paint,
// a bare erosion strip on the leading edge, bands at the tip.
export function bladeTexture() {
  return canvasTexture(1024, 128, (g, W, H) => {
    g.fillStyle = '#26282c'
    g.fillRect(0, 0, W, H)
    const le = g.createLinearGradient(0, H * 0.4, 0, H * 0.6)
    le.addColorStop(0, 'rgba(150,156,164,0)')
    le.addColorStop(0.25, 'rgba(150,156,164,0.9)')
    le.addColorStop(0.75, 'rgba(150,156,164,0.9)')
    le.addColorStop(1, 'rgba(150,156,164,0)')
    g.fillStyle = le
    g.fillRect(W * 0.14, H * 0.4, W * 0.86, H * 0.2)
    g.fillStyle = '#e6e7e9'
    g.fillRect(W * 0.915, 0, W * 0.022, H)
    g.fillRect(W * 0.955, 0, W * 0.022, H)
    g.fillStyle = '#1a1b1e'
    g.fillRect(0, 0, W * 0.1, H)
  })
}

// What a rotor looks like once it is turning too fast to follow: a faint disc,
// a little denser where the blades are widest, with the ghosts of the blades
// and the rings their tip bands draw.
export function discTexture({ blades = 4, color = '#1c1e22', bands = true, hub = 0.11 } = {}) {
  const t = canvasTexture(1024, 1024, (g, W) => {
    const c = W / 2
    const R = W / 2
    g.clearRect(0, 0, W, W)
    const body = g.createRadialGradient(c, c, R * hub, c, c, R)
    body.addColorStop(0, 'rgba(0,0,0,0)')
    body.addColorStop(0.06, 'rgba(0,0,0,0.3)')
    body.addColorStop(0.5, 'rgba(0,0,0,0.2)')
    body.addColorStop(0.93, 'rgba(0,0,0,0.17)')
    body.addColorStop(0.99, 'rgba(0,0,0,0.1)')
    body.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = body
    g.beginPath()
    g.arc(c, c, R, 0, Math.PI * 2)
    g.fill()
    // ghosts: each blade smeared round a wedge, fading behind it
    for (let b = 0; b < blades; b++) {
      const a0 = (b / blades) * Math.PI * 2
      for (let k = 0; k < 28; k++) {
        const a = a0 + (k / 28) * 0.75
        g.fillStyle = `rgba(0,0,0,${0.03 * (1 - k / 28) ** 1.5})`
        g.beginPath()
        g.moveTo(c + Math.cos(a) * R * hub, c + Math.sin(a) * R * hub)
        g.arc(c, c, R * 0.995, a, a + 0.06)
        g.closePath()
        g.fill()
      }
    }
    // everything so far is only an alpha: colour it, then add the pale tip rings
    g.globalCompositeOperation = 'source-in'
    g.fillStyle = color
    g.fillRect(0, 0, W, W)
    g.globalCompositeOperation = 'source-over'
    if (bands)
      for (const r of [0.925, 0.962]) {
        g.strokeStyle = 'rgba(236,237,239,0.2)'
        g.lineWidth = R * 0.02
        g.beginPath()
        g.arc(c, c, R * r, 0, Math.PI * 2)
        g.stroke()
      }
  })
  return t
}
