import * as THREE from 'three'
import { canvasTexture } from '../airliner/textures.js'
import { ARCH_R, AXLES, DOORS, DOOR_TOP, FLOOR, LENGTH, SKIRT, UNDER, WHEEL, WINDOW, sideV, thetaAtZ } from './geometry.js'

// Canvas textures for the bus. The shell is unwrapped round its section
// (length across, floor to roof and back down the other side); the front and
// rear faces are drawn square on. Each paint texture comes with a bump map
// from the same drawing, so the panel joints and the window rubbers catch the
// light, and with the alpha masks that cut the glass, the doors, the wheel
// arches and the open underside out of the skin.

const FRAME = '#15171a'
const RUBBER = '#0d0e10'
const LED = '#ffb12a'

// the side windows, as [x0, x1] along the shell; the right side leaves room for the doors
export const WINDOWS_LEFT = [[1.95, 3.55], [3.65, 5.25], [5.35, 6.95], [7.05, 8.65], [8.75, 10.15]]
export const WINDOWS_RIGHT = [[1.95, 3.55], [3.65, 5.45], [7.05, 8.65], [8.75, 9.55], [11.05, 11.85]]
export const GRILLE_LEFT = [10.25, 11.85] // the engine intake takes the place of the last window on the left

function pairTexture(w, h, draw) {
  const map = canvasTexture(w, h, (g, W, H) => draw(g, W, H, false))
  const bump = canvasTexture(w, h, (g, W, H) => draw(g, W, H, true))
  bump.colorSpace = THREE.NoColorSpace
  return { map, bump }
}
const alpha = (w, h, draw) => {
  const t = canvasTexture(w, h, draw)
  t.colorSpace = THREE.NoColorSpace
  return t
}

// an amber dot-matrix display: black panel, lettering, the grid of the diodes over it.
// `turn` draws it the other way up, for the side of the shell whose texture is read back to front.
function led(g, x, y, w, h, text, bump, turn = false) {
  if (turn) {
    g.save()
    g.translate(x + w / 2, y + h / 2)
    g.rotate(Math.PI)
    led(g, -w / 2, -h / 2, w, h, text, bump)
    g.restore()
    return
  }
  g.fillStyle = bump ? '#707070' : '#070708'
  g.fillRect(x, y, w, h)
  if (bump) return
  g.save()
  g.beginPath()
  g.rect(x, y, w, h)
  g.clip()
  g.fillStyle = LED
  g.textAlign = 'left'
  g.textBaseline = 'middle'
  let size = h * 0.72
  g.font = `700 ${size}px "Arial Narrow", "Helvetica Neue", Arial, sans-serif`
  while (g.measureText(text).width > w * 0.9 && size > 8) {
    size -= 2
    g.font = `700 ${size}px "Arial Narrow", "Helvetica Neue", Arial, sans-serif`
  }
  g.fillText(text, x + w * 0.05, y + h / 2 + 1)
  g.fillStyle = 'rgba(0,0,0,0.55)'
  const d = Math.max(2, h / 16)
  for (let i = x; i < x + w; i += d) g.fillRect(i, y, d * 0.4, h)
  for (let j = y; j < y + h; j += d) g.fillRect(x, j, w, d * 0.4)
  g.restore()
}

// a round lamp: lens, bright ring, reflector
function lamp(g, x, y, r, color, bump) {
  g.fillStyle = bump ? '#505050' : '#0a0b0d'
  g.beginPath()
  g.arc(x, y, r * 1.18, 0, Math.PI * 2)
  g.fill()
  if (bump) return
  const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r)
  gr.addColorStop(0, '#ffffff')
  gr.addColorStop(0.35, color)
  gr.addColorStop(1, '#' + new THREE.Color(color).multiplyScalar(0.45).getHexString())
  g.fillStyle = gr
  g.beginPath()
  g.arc(x, y, r, 0, Math.PI * 2)
  g.fill()
  g.strokeStyle = 'rgba(255,255,255,0.5)'
  g.lineWidth = r * 0.12
  g.beginPath()
  g.arc(x, y, r * 0.82, 0, Math.PI * 2)
  g.stroke()
}

// a perforated grille: dark panel with a lattice of holes
function grille(g, x, y, w, h, bump) {
  g.fillStyle = bump ? '#606060' : '#1b1d20'
  g.fillRect(x, y, w, h)
  g.fillStyle = bump ? '#303030' : '#050506'
  const d = Math.max(3, Math.min(w, h) / 26)
  for (let i = x + d; i < x + w - d / 2; i += d * 1.6) for (let j = y + d; j < y + h - d / 2; j += d * 1.6) g.fillRect(i, j, d * 0.9, d * 0.9)
}

const seam = (g, bump, a = 0.3) => {
  g.strokeStyle = bump ? `rgba(0,0,0,${Math.min(1, a * 1.8)})` : `rgba(8,10,14,${a})`
  g.lineWidth = bump ? 4 : 3
}

// ---------------------------------------------------------------- the shell
// paint: the livery colour. trim: the white band and roof. route: the lettering on the side display.
export function shellTexture({ paint, trim, route }) {
  return pairTexture(4096, 1024, (g, W, H, bump) => {
    const X = (s) => (s / LENGTH) * W
    const Y = (v) => (1 - v) * H
    // a band between two heights, on one side
    const band = (x0, x1, y0, y1, side, color) => {
      g.fillStyle = bump ? '#8a8a8a' : color
      const a = Y(sideV(y0, side))
      const b = Y(sideV(y1, side))
      g.fillRect(X(x0), Math.min(a, b), X(x1) - X(x0), Math.abs(a - b))
    }
    g.fillStyle = bump ? '#8a8a8a' : paint
    g.fillRect(0, 0, W, H)
    // the roof is pale; the floor pan dark
    const vr = thetaAtZ(1.12, true) / (Math.PI * 2)
    if (!bump) {
      g.fillStyle = '#dfe2e5'
      g.fillRect(0, Y(1 - vr), W, Y(vr) - Y(1 - vr))
      const vf = thetaAtZ(1.2, false) / (Math.PI * 2)
      g.fillStyle = '#2a2c30'
      g.fillRect(0, Y(vf), W, H - Y(vf))
      g.fillRect(0, 0, W, Y(1 - vf))
    }
    for (const side of [1, -1]) {
      // the white band under the windows, the black of the window frames, the thin line of paint above
      band(0, LENGTH, 1.06, 1.46, side, trim)
      band(0, LENGTH, 1.42, 2.9, side, FRAME)
      band(0, LENGTH, 2.9, 3.02, side, paint)
      // the window rubbers: each pane a little inset in the black frame
      const wins = side > 0 ? WINDOWS_LEFT : WINDOWS_RIGHT
      for (const [x0, x1] of wins) {
        band(x0 + 0.03, x1 - 0.03, WINDOW.y0 - 0.03, WINDOW.y1 + 0.03, side, RUBBER)
      }
      if (side > 0) {
        const [x0, x1] = GRILLE_LEFT
        const y0 = Y(sideV(WINDOW.y1, side))
        grille(g, X(x0 + 0.05), y0, X(x1 - 0.05) - X(x0 + 0.05), Y(sideV(WINDOW.y0, side)) - y0, bump)
      } else {
        // the door frames, in black, right to the floor
        for (const d of DOORS) band(d.x0 - 0.04, d.x1 + 0.04, FLOOR - 0.06, DOOR_TOP + 0.08, side, FRAME)
      }
      // the side destination display, above the first window
      const dy0 = Y(sideV(3.0, side))
      const dy1 = Y(sideV(2.88, side))
      led(g, X(2.0), Math.min(dy0, dy1), X(3.5) - X(2.0), Math.abs(dy1 - dy0), route, bump, side < 0)
      // skirt panel joints, and the hatches of the service lockers
      seam(g, bump, 0.26)
      for (const s of [0.55, 2.0, 3.6, 5.5, 7.0, 8.0, 9.6, 11.0, 11.6]) {
        g.beginPath()
        g.moveTo(X(s), Y(sideV(SKIRT + 0.02, side)))
        g.lineTo(X(s), Y(sideV(1.05, side)))
        g.stroke()
      }
      for (const [x0, x1] of side > 0 ? [[3.7, 5.3], [7.1, 7.9]] : [[3.7, 5.3], [7.1, 7.9]]) {
        g.beginPath()
        g.rect(X(x0), Y(sideV(0.98, side)), X(x1) - X(x0), Y(sideV(0.46, side)) - Y(sideV(0.98, side)))
        g.stroke()
      }
      // the arch trims round the wheel openings
      for (const ax of [AXLES.front, AXLES.rear]) {
        seam(g, bump, 0.5)
        g.lineWidth = bump ? 8 : 7
        g.beginPath()
        for (let k = 0; k <= 40; k++) {
          const a = Math.PI * (k / 40)
          const y = Math.max(SKIRT, WHEEL.R + Math.sin(a) * (ARCH_R + 0.03))
          g[k ? 'lineTo' : 'moveTo'](X(ax + Math.cos(a) * (ARCH_R + 0.03)), Y(sideV(y, side)))
        }
        g.stroke()
      }
      // the side marker lamps along the skirt
      if (!bump) {
        g.fillStyle = '#ff9a1e'
        for (const s of [0.5, 4.2, 8.2, 11.5]) {
          const y = Y(sideV(0.72, side))
          g.fillRect(X(s), y - 5, 16, 10)
        }
        // the fleet number by the front door, and the small logo on the band
        g.save()
        g.translate(X(side > 0 ? 0.6 : 2.6), Y(sideV(1.26, side)))
        g.scale(1, (W / LENGTH) / (H / 9.6)) // the texture is denser along the bus than round it
        if (side < 0) g.rotate(Math.PI)
        g.fillStyle = '#1d2a4a'
        g.font = '700 60px "Helvetica Neue", Helvetica, Arial, sans-serif'
        g.textAlign = 'center'
        g.textBaseline = 'middle'
        g.fillText('2026', 0, 0)
        g.restore()
      }
    }
    // the roof: two hatches and the lines of the air-conditioning unit's cover
    seam(g, bump, 0.3)
    for (const [x0, x1] of [[3.0, 3.75], [9.0, 9.75]]) {
      g.beginPath()
      g.rect(X(x0), Y(0.5 + 0.02), X(x1) - X(x0), Y(0.5 - 0.02) - Y(0.5 + 0.02))
      g.stroke()
    }
    // the floor pan outline
    g.beginPath()
    g.rect(X(UNDER.x0), Y(thetaAtZ(UNDER.z, false) / (Math.PI * 2)), X(UNDER.x1) - X(UNDER.x0), H)
    g.stroke()
    if (!bump) {
      g.globalAlpha = 0.04
      for (let i = 0; i < 2000; i++) {
        g.fillStyle = i % 2 ? '#000' : '#fff'
        g.fillRect(Math.random() * W, Math.random() * H, 2 + Math.random() * 50, 1 + Math.random() * 3)
      }
      g.globalAlpha = 1
    }
  })
}

// where the skin is cut away (body) and where the glass goes (glass)
export function shellMasks() {
  const cut = (g, W, H, which) => {
    const X = (s) => (s / LENGTH) * W
    const Y = (v) => (1 - v) * H
    const rect = (x0, x1, y0, y1, side) => {
      const a = Y(sideV(y0, side))
      const b = Y(sideV(y1, side))
      g.fillRect(X(x0), Math.min(a, b), X(x1) - X(x0), Math.abs(a - b))
    }
    g.fillStyle = which === 'body' ? '#fff' : '#000'
    g.fillRect(0, 0, W, H)
    g.fillStyle = which === 'body' ? '#000' : '#fff'
    for (const side of [1, -1]) {
      for (const [x0, x1] of side > 0 ? WINDOWS_LEFT : WINDOWS_RIGHT) rect(x0 + 0.03, x1 - 0.03, WINDOW.y0, WINDOW.y1, side)
    }
    if (which === 'glass') return
    for (const d of DOORS) rect(d.x0, d.x1, FLOOR - 0.04, DOOR_TOP, -1)
    // the wheel arches, down through the skirt
    for (const side of [1, -1])
      for (const ax of [AXLES.front, AXLES.rear]) {
        g.beginPath()
        for (let k = 0; k <= 40; k++) {
          const a = Math.PI * (k / 40)
          const y = Math.max(SKIRT - 0.01, WHEEL.R + Math.sin(a) * ARCH_R)
          g[k ? 'lineTo' : 'moveTo'](X(ax + Math.cos(a) * ARCH_R), Y(sideV(y, side)))
        }
        g.lineTo(X(ax - ARCH_R), side > 0 ? H : 0)
        g.lineTo(X(ax + ARCH_R), side > 0 ? H : 0)
        g.closePath()
        g.fill()
      }
    // the underside between the skirts, where the chassis shows
    const vz = thetaAtZ(UNDER.z, false) / (Math.PI * 2)
    g.fillRect(X(UNDER.x0), Y(vz), X(UNDER.x1) - X(UNDER.x0), H - Y(vz))
    g.fillRect(X(UNDER.x0), 0, X(UNDER.x1) - X(UNDER.x0), Y(1 - vz))
  }
  return { body: alpha(4096, 1024, (g, W, H) => cut(g, W, H, 'body')), glass: alpha(4096, 1024, (g, W, H) => cut(g, W, H, 'glass')) }
}

// ---------------------------------------------------------------- the faces
// Drawn square on: u across as seen from outside, v up from the skirt.
const WINDSCREEN = { u0: 0.07, u1: 0.93, v0: 0.33, v1: 0.865 }
const REAR_WINDOW = { u0: 0.12, u1: 0.88, v0: 0.62, v1: 0.85 }
export function faceTexture(front, { paint, trim, route }) {
  const S = 1024
  const glassBox = front ? WINDSCREEN : REAR_WINDOW
  const draw = (g, W, H, bump) => {
    const X = (u) => u * W
    const Y = (v) => (1 - v) * H
    const box = (u0, u1, v0, v1, color, r = 0) => {
      g.fillStyle = bump ? '#8a8a8a' : color
      g.beginPath()
      g.roundRect(X(u0), Y(v1), X(u1) - X(u0), Y(v0) - Y(v1), r)
      g.fill()
    }
    g.fillStyle = bump ? '#8a8a8a' : paint
    g.fillRect(0, 0, W, H)
    const vTrim0 = (1.06 - SKIRT) / 2.81
    const vTrim1 = (1.46 - SKIRT) / 2.81
    box(0, 1, vTrim0, vTrim1, trim)
    if (front) {
      // the windscreen in its black surround, the display above it, the wipers' rest line below
      box(0.03, 0.97, 0.29, 0.98, FRAME, 18)
      box(glassBox.u0, glassBox.u1, glassBox.v0, glassBox.v1, RUBBER, 26)
      led(g, X(0.1), Y(0.965), X(0.9) - X(0.1), Y(0.885) - Y(0.965), route, bump)
      // the bumper: lamp clusters in the corners, the grille between
      box(0, 1, 0.0, 0.27, paint)
      for (const u of [0.06, 0.7]) {
        box(u, u + 0.24, 0.12, 0.25, '#0b0c0e', 10)
        lamp(g, X(u + 0.065), Y(0.185), W * 0.04, '#dfe9ff', bump)
        lamp(g, X(u + 0.175), Y(0.185), W * 0.04, '#dfe9ff', bump)
        // the indicator strip under the lamps
        box(u + 0.01, u + 0.23, 0.12, 0.135, '#ff8c1a')
      }
      grille(g, X(0.36), Y(0.2), X(0.64) - X(0.36), Y(0.1) - Y(0.2), bump)
      for (const u of [0.1, 0.84]) {
        box(u, u + 0.06, 0.035, 0.085, '#0b0c0e', 6)
        lamp(g, X(u + 0.03), Y(0.06), W * 0.02, '#fff2d0', bump)
      }
      // the maker's badge on the band
      if (!bump) {
        g.fillStyle = '#9aa3ad'
        g.beginPath()
        g.ellipse(X(0.5), Y((vTrim0 + vTrim1) / 2), 26, 14, 0, 0, Math.PI * 2)
        g.fill()
      }
    } else {
      // the rear window in its surround, the display, the engine door with its shut lines and louvres
      box(0.03, 0.97, 0.58, 0.98, FRAME, 18)
      box(glassBox.u0, glassBox.u1, glassBox.v0, glassBox.v1, RUBBER, 22)
      led(g, X(0.3), Y(0.965), X(0.7) - X(0.3), Y(0.885) - Y(0.965), route, bump)
      seam(g, bump, 0.4)
      g.beginPath()
      g.roundRect(X(0.17), Y(0.56), X(0.83) - X(0.17), Y(0.1) - Y(0.56), 10)
      g.stroke()
      grille(g, X(0.7), Y(0.52), X(0.8) - X(0.7), Y(0.16) - Y(0.52), bump)
      // the lamp clusters: three round lamps each side, red, amber, white
      for (const u of [0.03, 0.86]) {
        box(u, u + 0.11, 0.16, 0.56, '#0b0c0e', 10)
        lamp(g, X(u + 0.055), Y(0.49), W * 0.034, '#ff2a1a', bump)
        lamp(g, X(u + 0.055), Y(0.37), W * 0.034, '#ff8c1a', bump)
        lamp(g, X(u + 0.055), Y(0.25), W * 0.034, '#e8ecf2', bump)
      }
      // the bumper line and the fog lamps
      seam(g, bump, 0.3)
      g.beginPath()
      g.moveTo(0, Y(0.085))
      g.lineTo(W, Y(0.085))
      g.stroke()
      for (const u of [0.22, 0.74]) lamp(g, X(u + 0.02), Y(0.05), W * 0.016, '#ff2a1a', bump)
    }
  }
  const { map, bump } = pairTexture(S, S, draw)
  const masks = (which) =>
    alpha(S, S, (g, W, H) => {
      g.fillStyle = which === 'body' ? '#fff' : '#000'
      g.fillRect(0, 0, W, H)
      g.fillStyle = which === 'body' ? '#000' : '#fff'
      g.beginPath()
      g.roundRect(glassBox.u0 * W + 6, (1 - glassBox.v1) * H + 6, (glassBox.u1 - glassBox.u0) * W - 12, (glassBox.v1 - glassBox.v0) * H - 12, 24)
      g.fill()
    })
  return { map, bump, body: masks('body'), glass: masks('glass') }
}
export const FACE_GLASS = { front: WINDSCREEN, rear: REAR_WINDOW }

// ---------------------------------------------------------------- doors
// a door leaf: black frame, the pane most of its height, a kick panel in the paint at the bottom
export function leafTexture({ paint }) {
  const draw = (g, W, H, bump) => {
    g.fillStyle = bump ? '#8a8a8a' : FRAME
    g.fillRect(0, 0, W, H)
    g.fillStyle = bump ? '#8a8a8a' : paint
    g.fillRect(W * 0.08, H * 0.74, W * 0.84, H * 0.22)
    g.fillStyle = bump ? '#707070' : RUBBER
    g.fillRect(W * 0.1, H * 0.06, W * 0.8, H * 0.64)
  }
  const { map, bump } = pairTexture(256, 1024, draw)
  const masks = (which) =>
    alpha(256, 1024, (g, W, H) => {
      g.fillStyle = which === 'body' ? '#fff' : '#000'
      g.fillRect(0, 0, W, H)
      g.fillStyle = which === 'body' ? '#000' : '#fff'
      g.fillRect(W * 0.13, H * 0.08, W * 0.74, H * 0.6)
    })
  return { map, bump, body: masks('body'), glass: masks('glass') }
}

// the floor: dark ribbed rubber with a pale edge strip
export function floorTexture() {
  return canvasTexture(1024, 256, (g, W, H) => {
    g.fillStyle = '#3a3d42'
    g.fillRect(0, 0, W, H)
    g.fillStyle = '#2e3136'
    for (let x = 0; x < W; x += 12) g.fillRect(x, 0, 5, H)
    g.fillStyle = '#d8c34a'
    g.fillRect(0, 0, W, 10)
    g.fillRect(0, H - 10, W, 10)
  })
}
