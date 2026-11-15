import * as THREE from 'three'
import { canvasTexture } from '../airliner/textures.js'
import { BAY, CAN, COCKPIT, FIN, LENGTH, MAIN_WELL, NAC, NOSE_WELL, WING, body, canopy, nacelle, thetaAtZ } from './geometry.js'

// Canvas textures for the fighter. The fuselage and the nacelle are unwrapped
// round their skins (length across, keel to crown and back down the far
// side), the wing, the fins and the stabilators span across with the upper
// surface above the leading edge and the lower below. Every paint texture
// comes with a bump map drawn by the same code, so the panel lines, the
// saw-toothed access panels and the door edges catch the light as grooves.

const FONT = '700 100px "Helvetica Neue", Helvetica, Arial, sans-serif'
const NL = LENGTH - NAC.s0

// the colour texture and its bump map, from one drawing routine
function pairTexture(w, h, draw) {
  const map = canvasTexture(w, h, (g, W, H) => draw(g, W, H, false))
  const bump = canvasTexture(w, h, (g, W, H) => draw(g, W, H, true))
  bump.colorSpace = THREE.NoColorSpace
  return { map, bump }
}

// Drawing helpers that paint colour or depth depending on the pass: a seam is
// a dark line in the colour pass and a groove in the bump pass; a panel tone
// shows only in colour.
function pen(g, bump) {
  const seam = (width = 3, a = 0.32) => {
    g.strokeStyle = bump ? `rgba(0,0,0,${Math.min(1, a * 1.6)})` : `rgba(10,12,16,${a})`
    g.lineWidth = bump ? width + 1 : width
    g.lineJoin = 'round'
    g.lineCap = 'round'
  }
  const tone = (color, alpha = 1) => {
    if (bump) return false
    g.globalAlpha = alpha
    g.fillStyle = color
    return true
  }
  const reset = () => (g.globalAlpha = 1)
  // a polyline, with the option of a saw-toothed edge
  const path = (pts, saw = 0) => {
    g.beginPath()
    if (!saw) {
      pts.forEach(([x, y], i) => g[i ? 'lineTo' : 'moveTo'](x, y))
      return
    }
    let first = true
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i]
      const [x1, y1] = pts[i + 1]
      const L = Math.hypot(x1 - x0, y1 - y0)
      const n = Math.max(1, Math.round(L / saw))
      const nx = -(y1 - y0) / L
      const ny = (x1 - x0) / L
      for (let k = 0; k <= n; k++) {
        const t = k / n
        const off = k % 2 ? saw * 0.45 : 0
        const x = x0 + (x1 - x0) * t + nx * off
        const y = y0 + (y1 - y0) * t + ny * off
        g[first ? 'moveTo' : 'lineTo'](x, y)
        first = false
      }
    }
  }
  const stroke = (pts, saw = 0, width = 3, a = 0.32) => {
    seam(width, a)
    path(pts, saw)
    g.stroke()
  }
  const rect = (x0, y0, x1, y1, saw = 0, width = 3, a = 0.32) => stroke([[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]], saw, width, a)
  return { seam, tone, reset, path, stroke, rect }
}

// ---------------------------------------------------------------- fuselage
// paint: the main grey. accent: the darker grey of the radome, the leading
// edges and the panels round the engines.
export function bodyTexture({ paint, accent }) {
  return pairTexture(4096, 2048, (g, W, H, bump) => {
    const P = pen(g, bump)
    const X = (s) => (s / LENGTH) * W
    const Y = (v) => (1 - v) * H
    const vY = (s, y) => body.thetaAt(s, y) / (Math.PI * 2) // port side, by height
    const vZ = (s, z, top) => thetaAtZ(s, z, top) / (Math.PI * 2) // by offset from the centreline
    const both = (draw) => [1, -1].forEach((side) => draw((v) => (side > 0 ? v : 1 - v)))

    g.fillStyle = bump ? '#8a8a8a' : paint
    g.fillRect(0, 0, W, H)

    // the radome and the dielectric panels behind it are a shade darker
    if (P.tone(accent, 0.7)) g.fillRect(0, 0, X(1.45), H)
    if (P.tone(accent, 0.25)) g.fillRect(X(1.45), 0, X(2.5) - X(1.45), H)
    P.reset()
    P.stroke([[X(1.45), 0], [X(1.45), H]], 14, 3, 0.36)

    // frames: joints round the whole body, and panel lines over the top or under the belly only
    for (const s of [3.3, 7.3, 8.5, 11.4, 14.9, 16.6, 17.9]) P.stroke([[X(s), 0], [X(s), H]], 0, 3, 0.22)
    for (const s of [2.4, 9.6, 12.6, 13.8, 15.8]) P.stroke([[X(s), Y(0.72)], [X(s), Y(0.28)]], 0, 3, 0.2)
    for (const s of [5.9, 6.4, 12.0, 13.0]) P.stroke([[X(s), Y(0.2)], [X(s), Y(0)]], 0, 3, 0.2)
    for (const s of [5.9, 6.4, 12.0, 13.0]) P.stroke([[X(s), Y(1)], [X(s), Y(0.8)]], 0, 3, 0.2)

    // a line along the skin through [s, y] points of the side view, on both sides
    const side = (pts, v) => {
      const out = []
      for (let i = 0; i < pts.length - 1; i++) {
        const [s0, y0] = pts[i]
        const [s1, y1] = pts[i + 1]
        const n = Math.max(2, Math.ceil(Math.hypot(s1 - s0, y1 - y0) / 0.05))
        for (let k = i ? 1 : 0; k <= n; k++) {
          const s = s0 + ((s1 - s0) * k) / n
          out.push([X(s), Y(v(vY(s, y0 + ((y1 - y0) * k) / n)))])
        }
      }
      return out
    }
    both((v) => {
      // the chine panel under the cockpit, its saw-toothed access panels, and the swept panel lines of the shoulders
      P.stroke(side([[1.5, 2.2], [7.2, 2.25]], v), 0, 3, 0.2)
      P.stroke(side([[2.6, 2.05], [2.6, 1.75], [3.5, 1.72], [3.5, 2.02]], v), 12, 3, 0.3)
      P.stroke(side([[4.1, 2.0], [4.1, 1.6], [5.5, 1.56], [5.5, 1.98]], v), 12, 3, 0.3)
      P.stroke(side([[7.9, 3.05], [9.3, 2.62]], v), 0, 3, 0.22)
      P.stroke(side([[9.0, 3.2], [10.6, 2.66]], v), 0, 3, 0.22)
      P.stroke(side([[11.6, 3.25], [13.2, 2.7]], v), 0, 3, 0.22)
      P.stroke(side([[13.9, 3.22], [15.4, 2.75]], v), 0, 3, 0.22)
      // the formation light strip on the forward fuselage
      if (P.tone('#d9e0b8', 0.9)) {
        const a = side([[2.3, 2.14], [3.7, 2.14]], v)
        const b = side([[3.7, 2.02], [2.3, 2.02]], v)
        P.path([...a, ...b])
        g.closePath()
        g.fill()
        P.reset()
      }
      // the ejection seat warning triangle below the sill
      if (P.tone('#e2b21a')) {
        const t = side([[5.65, 2.78], [5.95, 2.78], [5.8, 2.55]], v)
        P.path([...t, t[0]])
        g.fill()
        P.reset()
      }
    })

    // the canopy sill: a dark rail round the opening and the saw-toothed panel outside it
    const sill = (k, v) => {
      const pts = []
      for (let s = CAN.s0 + 0.05; s <= CAN.s0 + CAN.len; s += 0.04) pts.push([X(s), Y(v(vZ(s, Math.min(body.section(s).w * 0.98, canopy.section(s).w * k), true)))])
      return pts
    }
    both((v) => {
      if (P.tone('#2a2d31')) {
        P.path([...sill(1.0, v), ...sill(0.86, v).reverse()])
        g.closePath()
        g.fill()
        P.reset()
      }
      P.stroke(sill(1.1, v), 16, 3, 0.3)
    })
    // the refuelling receptacle behind the canopy, and the dorsal aerials' panels
    both((v) => P.stroke([[X(7.65), Y(v(vZ(7.65, 0.3, true)))], [X(8.45), Y(v(vZ(8.45, 0.3, true)))]], 10, 3, 0.3))
    P.stroke([[X(7.65), Y(vZ(7.65, 0.3, true))], [X(7.65), Y(1 - vZ(7.65, 0.3, true))]], 10, 3, 0.3)
    P.stroke([[X(8.45), Y(vZ(8.45, 0.3, true))], [X(8.45), Y(1 - vZ(8.45, 0.3, true))]], 10, 3, 0.3)
    if (P.tone(accent, 0.5)) {
      g.fillRect(X(7.68), Y(vZ(8, 0.28, true)), X(8.42) - X(7.68), Y(1 - vZ(8, 0.28, true)) - Y(vZ(8, 0.28, true)))
      P.reset()
    }

    // under the belly: the weapon bay doors, their split, and the wheel wells
    const edge = (s0, s1, z, v) => {
      const pts = []
      for (let s = s0; s <= s1 + 1e-6; s += 0.05) pts.push([X(s), Y(v(vZ(s, z, false)))])
      return pts
    }
    both((v) => {
      const zm = (BAY.z0 + BAY.z1) / 2
      P.stroke([...edge(BAY.s0, BAY.s1, BAY.z0, v), ...edge(BAY.s0, BAY.s1, BAY.z1, v).reverse(), edge(BAY.s0, BAY.s0, BAY.z0, v)[0]], 12, 3, 0.34)
      P.stroke(edge(BAY.s0, BAY.s1, zm, v), 0, 3, 0.3)
      P.stroke([...edge(MAIN_WELL.s0, MAIN_WELL.s1, MAIN_WELL.z0, v), ...edge(MAIN_WELL.s0, MAIN_WELL.s1, MAIN_WELL.z1, v).reverse(), edge(MAIN_WELL.s0, MAIN_WELL.s0, MAIN_WELL.z0, v)[0]], 12, 3, 0.34)
      // the side weapon bay doors sit on the nacelles; here only the small vents and panels of the keel
      P.rect(X(12.2), Y(v(vZ(12.2, 0.6, false))), X(13.6), Y(v(vZ(13.6, 0.95, false))), 10, 3, 0.26)
      P.rect(X(15.4), Y(v(vZ(15.4, 0.2, false))), X(16.6), Y(v(vZ(16.6, 0.8, false))), 10, 3, 0.26)
    })
    // the nose wheel well straddles the keel, where the texture wraps
    const nz = (s) => vZ(s, NOSE_WELL.z, false)
    P.stroke(edge(NOSE_WELL.s0, NOSE_WELL.s1, NOSE_WELL.z, (v) => v), 12, 3, 0.34)
    P.stroke(edge(NOSE_WELL.s0, NOSE_WELL.s1, NOSE_WELL.z, (v) => 1 - v), 12, 3, 0.34)
    P.stroke([[X(NOSE_WELL.s0), Y(0)], [X(NOSE_WELL.s0), Y(nz(NOSE_WELL.s0))]], 12, 3, 0.34)
    P.stroke([[X(NOSE_WELL.s1), Y(0)], [X(NOSE_WELL.s1), Y(nz(NOSE_WELL.s1))]], 12, 3, 0.34)
    P.stroke([[X(NOSE_WELL.s0), Y(1)], [X(NOSE_WELL.s0), Y(1 - nz(NOSE_WELL.s0))]], 12, 3, 0.34)
    P.stroke([[X(NOSE_WELL.s1), Y(1)], [X(NOSE_WELL.s1), Y(1 - nz(NOSE_WELL.s1))]], 12, 3, 0.34)
    P.stroke([[X(NOSE_WELL.s0), Y(0)], [X(NOSE_WELL.s1), Y(0)]], 0, 3, 0.3)
    P.stroke([[X(NOSE_WELL.s0), Y(1)], [X(NOSE_WELL.s1), Y(1)]], 0, 3, 0.3)

    // the heat-stained sting between the nozzles
    if (P.tone(accent, 0.6)) {
      g.fillRect(X(17.3), 0, W - X(17.3), H)
      P.reset()
    }
    P.stroke([[X(17.3), 0], [X(17.3), H]], 14, 3, 0.3)

    // a little grain, so the paint is not one flat value
    if (!bump) {
      g.globalAlpha = 0.045
      for (let i = 0; i < 2600; i++) {
        g.fillStyle = i % 2 ? '#000' : '#fff'
        g.fillRect(Math.random() * W, Math.random() * H, 2 + Math.random() * 60, 1 + Math.random() * 4)
      }
      g.globalAlpha = 1
    }
  })
}

// ---------------------------------------------------------------- nacelle
export function nacelleTexture({ paint, accent }) {
  return pairTexture(2048, 1024, (g, W, H, bump) => {
    const P = pen(g, bump)
    const X = (s) => ((s - NAC.s0) / NL) * W
    const Y = (v) => (1 - v) * H
    const vY = (s, y) => nacelle.thetaAt(s, y) / (Math.PI * 2) // the outboard side
    g.fillStyle = bump ? '#8a8a8a' : paint
    g.fillRect(0, 0, W, H)
    // the inlet lip is bare radar-absorbent edge
    if (P.tone(accent, 0.85)) g.fillRect(0, 0, X(NAC.s0 + 0.12), H)
    P.reset()
    P.stroke([[X(NAC.s0 + 0.12), 0], [X(NAC.s0 + 0.12), H]], 0, 3, 0.3)
    for (const s of [6.2, 7.5, 9.0, 10.8, 12.4, 14.2, 16.0, 17.4]) P.stroke([[X(s), 0], [X(s), H]], 0, 3, 0.22)
    // the side weapon bay door and the panels of the boundary layer vents, outboard
    const door = []
    for (const [s, y] of [[5.6, 1.78], [8.5, 1.78], [8.5, 2.42], [5.6, 2.42], [5.6, 1.78]]) door.push([X(s), Y(vY(s, y))])
    P.stroke(door, 12, 3, 0.34)
    if (P.tone(accent, 0.55)) for (let k = 0; k < 5; k++) g.fillRect(X(5.0 + k * 0.17), Y(vY(5, 2.6)), X(5.09 + k * 0.17) - X(5.0 + k * 0.17), Y(vY(5, 2.54)) - Y(vY(5, 2.6)))
    P.reset()
    // the swept panel lines along the wing root
    P.stroke([[X(9.2), Y(0.5)], [X(10.6), Y(0.32)]], 0, 3, 0.22)
    P.stroke([[X(11.8), Y(0.5)], [X(13.2), Y(0.32)]], 0, 3, 0.22)
    P.stroke([[X(9.2), Y(0.5)], [X(10.6), Y(0.68)]], 0, 3, 0.22)
    P.stroke([[X(11.8), Y(0.5)], [X(13.2), Y(0.68)]], 0, 3, 0.22)
    // the heat-affected skin round the nozzle, in bare titanium
    const h0 = X(NAC.end - 1.1)
    if (!bump) {
      const gr = g.createLinearGradient(h0, 0, W, 0)
      gr.addColorStop(0, 'rgba(70,72,78,0)')
      gr.addColorStop(0.3, 'rgba(70,72,78,0.6)')
      gr.addColorStop(1, 'rgba(60,62,70,0.9)')
      g.fillStyle = gr
      g.fillRect(h0, 0, W - h0, H)
    }
    P.stroke([[X(NAC.end - 0.75), 0], [X(NAC.end - 0.75), H]], 12, 3, 0.3)
    if (!bump) {
      g.globalAlpha = 0.05
      for (let i = 0; i < 900; i++) {
        g.fillStyle = i % 2 ? '#000' : '#fff'
        g.fillRect(Math.random() * W, Math.random() * H, 2 + Math.random() * 40, 1 + Math.random() * 3)
      }
      g.globalAlpha = 1
    }
  })
}

// ---------------------------------------------------------------- wing, stabilator, fin
// span across; v: 0 trailing edge above, 0.5 leading edge, 1 trailing edge below
function surfaceTexture(w, h, { paint, accent }, extra) {
  return pairTexture(w, h, (g, W, H, bump) => {
    const P = pen(g, bump)
    const Y = (v) => (1 - v) * H
    g.fillStyle = bump ? '#8a8a8a' : paint
    g.fillRect(0, 0, W, H)
    // the leading edge is bare radar-absorbent material
    if (P.tone(accent, 0.8)) g.fillRect(0, Y(0.535), W, Y(0.465) - Y(0.535))
    P.reset()
    extra(P, g, W, H, Y, bump)
    if (!bump) {
      g.globalAlpha = 0.05
      for (let i = 0; i < 500; i++) {
        g.fillStyle = i % 2 ? '#000' : '#fff'
        g.fillRect(Math.random() * W, Math.random() * H, 2 + Math.random() * 40, 1 + Math.random() * 3)
      }
      g.globalAlpha = 1
    }
  })
}
const vx = (x, top) => (top ? 0.5 - 0.5 * x : 0.5 + 0.5 * x)

export function wingTexture(colors) {
  const u = (z) => (z - WING.zRoot) / (WING.zTip - WING.zRoot)
  return surfaceTexture(2048, 1024, colors, (P, g, W, H, Y) => {
    const X = (z) => u(z) * W
    for (const top of [true, false]) {
      // hinge lines of the leading-edge flap and the trailing-edge surfaces
      P.stroke([[X(WING.zRoot + 0.3), Y(vx(WING.xa, top))], [W, Y(vx(WING.xa, top))]], 0, 3, 0.34)
      P.stroke([[X(WING.flaperon[0]), Y(vx(WING.xb, top))], [X(WING.aileron[1]), Y(vx(WING.xb, top))]], 0, 3, 0.34)
      P.stroke([[X(WING.flaperon[1]), Y(vx(WING.xb, top))], [X(WING.flaperon[1]), Y(vx(1, top))]], 0, 3, 0.34)
      P.stroke([[X(WING.aileron[0]), Y(vx(WING.xb, top))], [X(WING.aileron[0]), Y(vx(1, top))]], 0, 3, 0.34)
      P.stroke([[X(WING.aileron[1]), Y(vx(WING.xb, top))], [X(WING.aileron[1]), Y(vx(1, top))]], 0, 3, 0.34)
      // rib lines over the box and the swept access panels near the root
      for (const z of [2.6, 3.4, 4.35, 5.3, 6.1]) P.stroke([[X(z), Y(vx(WING.xa + 0.02, top))], [X(z), Y(vx(WING.xb - 0.02, top))]], 0, 3, 0.18)
      P.rect(X(2.2), Y(vx(0.3, top)), X(3.1), Y(vx(0.5, top)), 10, 3, 0.26)
      P.rect(X(3.6), Y(vx(0.28, top)), X(4.2), Y(vx(0.44, top)), 10, 3, 0.26)
      // the formation light strip near the tip
      if (P.tone('#d9e0b8', 0.9)) {
        g.fillRect(X(6.1), Y(vx(0.36, top)), X(6.55) - X(6.1), Y(vx(0.3, top)) - Y(vx(0.36, top)))
        P.reset()
      }
    }
    // hardpoints under the wing: the two pylon stations
    for (const z of [3.2, 4.9]) {
      if (P.tone(colors.accent, 0.7)) {
        g.beginPath()
        g.ellipse(X(z), Y(vx(0.46, false)), 22, 9, 0, 0, Math.PI * 2)
        g.fill()
        P.reset()
      }
      P.rect(X(z - 0.1), Y(vx(0.34, false)), X(z + 0.1), Y(vx(0.58, false)), 0, 3, 0.26)
    }
  })
}

export function stabTexture(colors) {
  return surfaceTexture(1024, 512, colors, (P, g, W, H, Y) => {
    for (const top of [true, false]) {
      for (const u of [0.3, 0.55, 0.78]) P.stroke([[u * W, Y(vx(0.08, top))], [u * W, Y(vx(0.9, top))]], 0, 3, 0.18)
      P.stroke([[0.1 * W, Y(vx(0.42, top))], [W, Y(vx(0.42, top))]], 0, 3, 0.2)
    }
  })
}

// side: which fin, so the lettering reads the right way on its outboard face
export function finTexture({ paint, accent, tailCode, serial }, side) {
  return surfaceTexture(1024, 1024, { paint: accent, accent }, (P, g, W, H, Y, bump) => {
    const U = (t) => (t / FIN.h1) * W
    for (const top of [true, false]) {
      P.stroke([[U(0.2), Y(vx(FIN.xr, top))], [W, Y(vx(FIN.xr, top))]], 0, 3, 0.34)
      P.stroke([[U(0.2), Y(vx(FIN.xr, top))], [U(0.2), Y(vx(1, top))]], 0, 3, 0.34)
      P.stroke([[U(FIN.h1 - 0.05), Y(vx(FIN.xr, top))], [U(FIN.h1 - 0.05), Y(vx(1, top))]], 0, 3, 0.34)
      for (const t of [0.75, 1.3]) P.stroke([[U(t), Y(vx(0.06, top))], [U(t), Y(vx(FIN.xr - 0.03, top))]], 0, 3, 0.18)
      // a paler panel at the top: the formation light and the aerial fairing
      if (P.tone('#d9e0b8', 0.9)) {
        g.fillRect(U(1.85), Y(vx(0.3, top)), U(2.05) - U(1.85), Y(vx(0.2, top)) - Y(vx(0.3, top)))
        P.reset()
      }
      P.rect(U(1.6), Y(vx(0.12, top)), U(2.1), Y(vx(0.5, top)), 10, 3, 0.26)
    }
    if (bump) return
    // The lettering: on the outboard face, which is the lower skin of the port
    // fin and the upper skin of the starboard. Up the fin is +X here and aft
    // is -Y, so the text is turned and mirrored into place.
    const outboard = side > 0 ? false : true
    const write = (text, x, t, size, color) => {
      g.save()
      g.translate(U(t), Y(vx(x, outboard)))
      g.rotate(-Math.PI / 2)
      g.scale(1, -1)
      g.fillStyle = color
      g.font = FONT.replace('100px', `${size}px`)
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText(text, 0, 0)
      g.restore()
    }
    write(tailCode.toUpperCase().slice(0, 2), 0.38, 1.0, 190, paint)
    write(serial.toUpperCase().slice(0, 9), 0.2, 1.6, 42, paint)
  })
}

// ---------------------------------------------------------------- canopy, mask, nozzle, plume
// the canopy is tinted glass with a dark rail where it meets the fuselage
export function canopyTexture() {
  return canvasTexture(512, 256, (g, W, H) => {
    g.fillStyle = '#ffffff'
    g.fillRect(0, 0, W, H)
    g.fillStyle = '#17191c'
    g.fillRect(0, 0, W, H * 0.06)
    g.fillRect(0, H * 0.94, W, H * 0.06)
    g.fillRect(0, 0, W * 0.02, H)
    g.fillRect(W * 0.985, 0, W * 0.015, H)
  })
}

// where the fuselage skin is cut away: the cockpit, the weapon bays, the wheel wells
export function maskTexture() {
  const t = canvasTexture(2048, 1024, (g, W, H) => {
    const X = (s) => (s / LENGTH) * W
    const Y = (v) => (1 - v) * H
    const vZ = (s, z, top) => thetaAtZ(s, z, top) / (Math.PI * 2)
    g.fillStyle = '#fff'
    g.fillRect(0, 0, W, H)
    g.fillStyle = '#000'
    // the cockpit opening, inside the canopy's footprint
    g.beginPath()
    const ss = []
    for (let s = COCKPIT.s0; s <= COCKPIT.s1; s += 0.05) ss.push(s)
    ss.forEach((s, i) => g[i ? 'lineTo' : 'moveTo'](X(s), Y(vZ(s, canopy.section(s).w * 0.9, true))))
    for (let i = ss.length - 1; i >= 0; i--) g.lineTo(X(ss[i]), Y(1 - vZ(ss[i], canopy.section(ss[i]).w * 0.9, true)))
    g.closePath()
    g.fill()
    const cut = (s0, s1, z0, z1) => {
      for (const side of [1, -1]) {
        const v = (x) => (side > 0 ? x : 1 - x)
        g.beginPath()
        const pts = []
        for (let s = s0; s <= s1 + 1e-6; s += 0.05) pts.push(s)
        pts.forEach((s, i) => g[i ? 'lineTo' : 'moveTo'](X(s), Y(v(vZ(s, z0, false)))))
        for (let i = pts.length - 1; i >= 0; i--) g.lineTo(X(pts[i]), Y(v(vZ(pts[i], z1, false))))
        g.closePath()
        g.fill()
      }
    }
    cut(BAY.s0, BAY.s1, BAY.z0, BAY.z1)
    cut(MAIN_WELL.s0, MAIN_WELL.s1, MAIN_WELL.z0, MAIN_WELL.z1)
    // the nose wheel well wraps round the keel, where v passes through 0
    const ns = []
    for (let s = NOSE_WELL.s0; s <= NOSE_WELL.s1 + 1e-6; s += 0.05) ns.push(s)
    for (const top of [false, true]) {
      g.beginPath()
      ns.forEach((s, i) => g[i ? 'lineTo' : 'moveTo'](X(s), Y(top ? 1 - vZ(s, NOSE_WELL.z, false) : vZ(s, NOSE_WELL.z, false))))
      g.lineTo(X(NOSE_WELL.s1), top ? 0 : H)
      g.lineTo(X(NOSE_WELL.s0), top ? 0 : H)
      g.closePath()
      g.fill()
    }
  })
  t.colorSpace = THREE.NoColorSpace
  return t
}

// the heat tint of the nozzle petals, bare titanium going straw and blue towards the exit
export function heatTexture() {
  return canvasTexture(512, 128, (g, W, H) => {
    const gr = g.createLinearGradient(0, H, 0, 0)
    gr.addColorStop(0, '#4b4e55')
    gr.addColorStop(0.45, '#5a5650')
    gr.addColorStop(0.7, '#6d5c44')
    gr.addColorStop(0.86, '#4e5468')
    gr.addColorStop(1, '#3a3d46')
    g.fillStyle = gr
    g.fillRect(0, 0, W, H)
    g.globalAlpha = 0.18
    for (let i = 0; i < 28; i++) {
      g.fillStyle = i % 2 ? '#000' : '#fff'
      g.fillRect((i / 28) * W, 0, 2, H)
    }
    g.globalAlpha = 1
  })
}

// the afterburner plume: a white-blue core with shock diamonds, fading down its length
export function plumeTexture() {
  const t = canvasTexture(512, 64, (g, W, H) => {
    const gr = g.createLinearGradient(0, 0, W, 0)
    gr.addColorStop(0, '#7fa6e8')
    gr.addColorStop(0.12, '#5a84d6')
    gr.addColorStop(0.4, '#3d5fb8')
    gr.addColorStop(0.75, '#1a2554')
    gr.addColorStop(1, '#000000')
    g.fillStyle = gr
    g.fillRect(0, 0, W, H)
    // the diamonds
    for (let k = 0; k < 7; k++) {
      const x = W * (0.05 + k * 0.1)
      const d = g.createRadialGradient(x, H / 2, 0, x, H / 2, W * 0.05)
      d.addColorStop(0, `rgba(255,235,205,${0.55 - k * 0.07})`)
      d.addColorStop(1, 'rgba(255,250,235,0)')
      g.fillStyle = d
      g.fillRect(0, 0, W, H)
    }
    // dark at the edges so the plume has a soft outline
    const e = g.createLinearGradient(0, 0, 0, H)
    e.addColorStop(0, 'rgba(0,0,0,1)')
    e.addColorStop(0.25, 'rgba(0,0,0,0)')
    e.addColorStop(0.75, 'rgba(0,0,0,0)')
    e.addColorStop(1, 'rgba(0,0,0,1)')
    g.fillStyle = e
    g.fillRect(0, 0, W, H)
  })
  t.wrapS = THREE.ClampToEdgeWrapping
  return t
}
