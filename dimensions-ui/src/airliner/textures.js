import * as THREE from 'three'
import { CY, FIN_UV, LENGTH, WING_TIP_U, livery, section, wingU } from './geometry.js'

// Canvas textures for the airliner: the fuselage paint unwrapped round its
// skin (length across, keel to crown and back down the far side), the wing
// (span across, upper surface above the leading edge, lower below), the fin,
// and the small ones for the engine and the lights.

export function canvasTexture(w, h, draw) {
  const c = Object.assign(document.createElement('canvas'), { width: w, height: h })
  draw(c.getContext('2d'), w, h)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 16
  return t
}

const FONT = '700 100px "Helvetica Neue", Helvetica, Arial, sans-serif'

export function fuselageTexture({ body, accent, stripe, registration, airline }) {
  return canvasTexture(4096, 2048, (g, W, H) => {
    const X = (s) => (s / LENGTH) * W
    const Y = (v) => (1 - v) * H
    // how far round the port side (0 keel .. 0.5 crown) the skin reaches height y
    const vAt = (s, y) => {
      const { cy, h } = section(s)
      return Math.acos(Math.min(1, Math.max(-1, (cy - y) / h))) / (Math.PI * 2)
    }
    const stations = []
    for (let s = 12; s < LENGTH; s += 0.06) stations.push(s)
    stations.push(LENGTH)
    // fill between two height curves, on both sides of the aircraft
    const band = (lo, hi, color) => {
      g.fillStyle = color
      for (const side of [1, -1]) {
        const v = (x) => (side > 0 ? x : 1 - x)
        g.beginPath()
        stations.forEach((s, i) => g[i ? 'lineTo' : 'moveTo'](X(s), Y(v(lo ? vAt(s, lo(s)) : 0))))
        for (let i = stations.length - 1; i >= 0; i--) g.lineTo(X(stations[i]), Y(v(vAt(stations[i], hi(stations[i])))))
        g.closePath()
        g.fill()
      }
    }

    g.fillStyle = body
    g.fillRect(0, 0, W, H)
    band(null, (s) => livery(s).y0, accent)
    band((s) => livery(s).y1, (s) => livery(s).y2, stripe)

    // skin joints: frames round the barrel, lap joints along it
    g.strokeStyle = 'rgba(20,24,30,0.075)'
    g.lineWidth = 1.5
    g.beginPath()
    for (let s = 1.6; s < 36.5; s += 2.132) {
      g.moveTo(X(s), 0)
      g.lineTo(X(s), H)
    }
    for (const v of [0.045, 0.14, 0.215, 0.33, 0.43, 0.5, 0.57, 0.67, 0.785, 0.86, 0.955]) {
      g.moveTo(X(0.8), Y(v))
      g.lineTo(X(36.8), Y(v))
    }
    g.stroke()
    // the radome joint
    g.strokeStyle = 'rgba(20,24,30,0.16)'
    g.lineWidth = 1.5
    g.beginPath()
    g.moveTo(X(0.78), 0)
    g.lineTo(X(0.78), H)
    g.stroke()

    // cargo doors, low on the starboard side
    g.strokeStyle = 'rgba(20,24,30,0.5)'
    g.lineWidth = 2.5
    for (const [s0, s1] of [[6.45, 8.27], [23.2, 25.0]]) {
      const top = 1 - vAt((s0 + s1) / 2, CY - 0.35)
      const bot = 1 - vAt((s0 + s1) / 2, CY - 1.72)
      g.beginPath()
      g.roundRect(X(s0), Y(bot), X(s1) - X(s0), Y(top) - Y(bot), 10)
      g.stroke()
    }
    // nose wheel doors along the keel
    const nv = 0.026
    g.beginPath()
    for (const v of [nv, 1 - nv]) {
      g.moveTo(X(3.55), Y(v))
      g.lineTo(X(5.78), Y(v))
    }
    for (const s of [3.55, 4.72, 5.78]) {
      g.moveTo(X(s), Y(nv))
      g.lineTo(X(s), Y(0))
      g.moveTo(X(s), Y(1))
      g.lineTo(X(s), Y(1 - nv))
    }
    g.stroke()
    g.fillStyle = 'rgba(20,24,30,0.5)'
    g.fillRect(X(3.55), Y(0) - 2, X(5.78) - X(3.55), 2)
    g.fillRect(X(3.55), Y(1), X(5.78) - X(3.55), 2)

    // lettering, sized in metres and squared up for the unwrap
    const label = (text, s, y, capH, color) => {
      if (!text) return
      const { h, w } = section(s)
      const v = vAt(s, y)
      const th = v * Math.PI * 2
      const k = capH / 72
      const perM = H / (Math.PI * 2 * Math.hypot(w * Math.cos(th), h * Math.sin(th)))
      g.fillStyle = color
      g.font = FONT
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      for (const side of [1, -1]) {
        g.save()
        g.translate(X(s), Y(side > 0 ? v : 1 - v))
        if (side < 0) g.rotate(Math.PI)
        g.scale((k * W) / LENGTH, k * perM)
        g.fillText(text, 0, 0)
        g.restore()
      }
    }
    label(registration, 31.5, CY + 0.6, 0.34, body)
    label(airline, 9.9, CY - 0.5, 0.62, accent)
  })
}

export function wingTexture({ wing, accent, stripe }) {
  return canvasTexture(2048, 1024, (g, W, H) => {
    const X = (u) => u * W
    const top = (x) => (0.5 + 0.5 * x) * H // canvas row of chord fraction x on the upper surface
    const bot = (x) => (0.5 - 0.5 * x) * H
    g.fillStyle = wing
    g.fillRect(0, 0, W, H)
    // bare-metal leading edge
    g.fillStyle = 'rgba(255,255,255,0.28)'
    g.fillRect(0, bot(0.03), W, top(0.13) - bot(0.03))
    // the sharklet in the accent colour, with a fine band where it starts
    const u0 = WING_TIP_U + 0.012
    g.fillStyle = accent
    g.fillRect(X(u0), 0, W - X(u0), H)
    g.fillStyle = stripe
    g.fillRect(X(u0) - 5, 0, 5, H)

    g.lineWidth = 1.5
    g.strokeStyle = 'rgba(20,24,30,0.09)'
    g.beginPath()
    for (let u = 0.03; u < WING_TIP_U; u += 0.034) {
      g.moveTo(X(u), 0)
      g.lineTo(X(u), H)
    }
    for (const x of [0.17, 0.6]) {
      g.moveTo(0, top(x))
      g.lineTo(X(WING_TIP_U), top(x))
      g.moveTo(0, bot(x))
      g.lineTo(X(WING_TIP_U), bot(x))
    }
    g.stroke()
    // spoilers on top, the aileron on both surfaces
    g.strokeStyle = 'rgba(20,24,30,0.32)'
    g.lineWidth = 2
    const a = wingU(6.6)
    const b = wingU(13.0)
    for (let i = 0; i < 5; i++) g.strokeRect(X(a + ((b - a) * i) / 5) + 2, top(0.6), X((b - a) / 5) - 4, top(0.745) - top(0.6))
    for (const y of [top, bot]) g.strokeRect(X(wingU(13.2)), y(0.74), X(wingU(16.3)) - X(wingU(13.2)), y(1.02) - y(0.74))
    // fuel tank access panels under the wing
    g.strokeStyle = 'rgba(20,24,30,0.2)'
    g.lineWidth = 1.5
    for (let u = wingU(3); u < wingU(15.5); u += 0.036) {
      g.beginPath()
      g.ellipse(X(u), bot(0.38), 11, 7, 0, 0, Math.PI * 2)
      g.stroke()
    }
  })
}

export function finTexture({ body, accent, stripe }) {
  return canvasTexture(1024, 1024, (g, W, H) => {
    const X = (s) => ((s - FIN_UV.s0) / (FIN_UV.s1 - FIN_UV.s0)) * W
    const Y = (y) => (1 - (y - FIN_UV.y0) / (FIN_UV.y1 - FIN_UV.y0)) * H
    g.fillStyle = accent
    g.fillRect(0, 0, W, H)
    const band = (lo, hi, color) => {
      g.fillStyle = color
      g.beginPath()
      for (let s = FIN_UV.s0; s <= FIN_UV.s1; s += 0.05) g.lineTo(X(s), Y(livery(s)[lo]))
      for (let s = FIN_UV.s1; s >= FIN_UV.s0; s -= 0.05) g.lineTo(X(s), Y(livery(s)[hi]))
      g.closePath()
      g.fill()
    }
    band('y0', 'y1', body)
    band('y1', 'y2', stripe)
    // the rudder hinge line and its three sections
    g.strokeStyle = 'rgba(8,10,16,0.4)'
    g.lineWidth = 2
    g.beginPath()
    g.moveTo(X(32.96), Y(5.6))
    g.lineTo(X(35.06), Y(11.5))
    for (const t of [0.34, 0.67]) {
      g.moveTo(X(32.96 + 2.1 * t), Y(5.6 + 5.9 * t))
      g.lineTo(X(34.7 + 0.91 * t), Y(5.6 + 5.9 * t))
    }
    g.stroke()
  })
}

// the white swirl on the spinner that shows the fan is turning
export function spinnerTexture() {
  return canvasTexture(256, 256, (g, W, H) => {
    g.fillStyle = '#15171a'
    g.fillRect(0, 0, W, H)
    g.strokeStyle = '#eceef0'
    g.lineWidth = 16
    g.lineCap = 'round'
    g.beginPath()
    g.moveTo(W * 0.1, H * 0.42)
    g.bezierCurveTo(W * 0.3, H * 0.42, W * 0.5, H * 0.5, W * 0.62, H * 0.8)
    g.stroke()
  })
}

// the ring of guide vanes seen between the fan blades
export function statorTexture() {
  const t = canvasTexture(1024, 64, (g, W, H) => {
    g.fillStyle = '#08090b'
    g.fillRect(0, 0, W, H)
    const n = 48
    for (let i = 0; i < n; i++) {
      const x = (i / n) * W
      const gr = g.createLinearGradient(x, 0, x + W / n, 0)
      gr.addColorStop(0, '#0a0b0d')
      gr.addColorStop(0.45, '#4a4e55')
      gr.addColorStop(0.6, '#1a1c20')
      gr.addColorStop(1, '#0a0b0d')
      g.fillStyle = gr
      g.fillRect(x, H * 0.18, W / n, H)
    }
  })
  t.wrapS = THREE.RepeatWrapping
  return t
}

// a soft round glow for the lights
export function glowTexture() {
  return canvasTexture(128, 128, (g, W, H) => {
    const gr = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W / 2)
    gr.addColorStop(0, 'rgba(255,255,255,1)')
    gr.addColorStop(0.18, 'rgba(255,255,255,0.75)')
    gr.addColorStop(0.5, 'rgba(255,255,255,0.16)')
    gr.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = gr
    g.fillRect(0, 0, W, H)
  })
}
