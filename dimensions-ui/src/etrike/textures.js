import * as THREE from 'three'
import { canvasTexture } from '../airliner/textures.js'
import { smooth } from '../airliner/geometry.js'
import { ARCH_R, CAN, OPEN, OPEN_TOP, PORT, REAR_AXLE, WHEEL_R, WINDOWS, canopyAt, canopyRegion, insideCanopyOpening, insideOpening, insideWindow, tubAt, tubColumn, xA } from './geometry.js'

// The two skins are painted by baking: every texel is placed on the body
// (through the same functions that build the mesh) and coloured by where it
// lands, in metres. The result is a set of weights rather than colours, so a
// repaint is only a change of uniforms:
//   R  the second colour (the white band on the tub, the painted frame on the canopy)
//   G  the cut-out mask (0 where an opening or a window is)
//   B  the third colour (the underbody on the tub, stitching on the canopy)

function bake(W, H, fn) {
  const data = new Uint8Array(W * H * 4)
  const out = [0, 1, 0]
  for (let i = 0; i < W; i++) {
    const u = (i + 0.5) / W
    const ctx = fn.column?.(u)
    for (let r = 0; r < H; r++) {
      const b = (r + 0.5) / H
      out[0] = 0
      out[1] = 1
      out[2] = 0
      fn(u, b, out, ctx)
      const k = (r * W + i) * 4
      data[k] = out[0] * 255
      data[k + 1] = out[1] * 255
      data[k + 2] = out[2] * 255
      data[k + 3] = 255
    }
  }
  const t = new THREE.DataTexture(data, W, H, THREE.RGBAFormat)
  t.magFilter = THREE.LinearFilter
  t.minFilter = THREE.LinearMipmapLinearFilter
  t.generateMipmaps = true
  t.anisotropy = 8
  t.needsUpdate = true
  return t
}
const step = (v, w) => Math.min(1, Math.max(0, v / w + 0.5)) // a one-texel soft edge

// The band along the top of the tub runs lower across the face, so the
// headlamps sit on the line between the colours.
export const bandY = (x) => 0.795 + 0.105 * smooth((x - 0.2) / 0.42)

let tubCache = null
export function tubTexture() {
  if (tubCache) return tubCache
  const P = new THREE.Vector3()
  const paint = (u, b, out, col) => {
    tubAt(u, b, P, col)
    if (b < 0.3) {
      out[2] = 1 // the floor, seen from below
      return
    }
    out[0] = step(P.y - bandY(P.x), 0.0014)
    // the cab opening and the rear wheel arch, on the sides only
    if (P.z > 0.3 && (insideOpening(P.x, P.y) || Math.hypot(P.x - REAR_AXLE, P.y - WHEEL_R) < ARCH_R)) out[1] = 0
    // the pocket behind the charging flap
    const px = Math.abs(P.x - PORT.x) - PORT.w / 2 + 0.015
    const py = Math.abs(P.y - PORT.y) - PORT.h / 2 + 0.015
    if (P.z > 0.3 && Math.hypot(Math.max(px, 0), Math.max(py, 0)) + Math.min(Math.max(px, py), 0) < 0.015) out[1] = 0
  }
  paint.column = tubColumn
  tubCache = bake(2048, 1024, paint)
  return tubCache
}

let canopyCache = null
export function canopyTexture() {
  if (canopyCache) return canopyCache
  const P = new THREE.Vector3()
  const dash = (s) => (Math.floor(s / 0.007) & 1) === 0
  const paint = (u, b, out) => {
    canopyAt(u, b, P)
    const { x, y, z } = P
    const wall = b < 0.45
    if (wall) {
      const at = canopyRegion(x, y)
      if (at === 'front' && insideWindow(WINDOWS.screen, z, y)) out[1] = 0
      if (at === 'rear' && insideWindow(WINDOWS.back, z, y)) out[1] = 0
      if (at === 'side' && (insideWindow(WINDOWS.quarter, x, y) || insideCanopyOpening(x, y))) out[1] = 0
      // the windscreen frame and its pillars are painted; above them, canvas
      if (x < xA(y) + 0.002 && y < OPEN_TOP) out[0] = 1
      // the canvas is sewn: a hem along the bottom, a seam under the roof, one down the front edge
      if (x > OPEN[1]) {
        if ((Math.abs(y - 1.6) < 0.0013 || Math.abs(y - 1.012) < 0.0013) && dash(x + z)) out[2] = 1
        if (Math.abs(x - OPEN[1] - 0.014) < 0.0013 && y < 1.6 && dash(y)) out[2] = 1
      }
    } else if (b > 0.55 && Math.abs(Math.abs(z) - 0.34) < 0.0013 && x > 0.5 && x < CAN.xr - 0.06 && dash(x)) out[2] = 1
  }
  canopyCache = bake(2048, 768, paint)
  return canopyCache
}

// A clear-coated physical material whose colour, roughness, clear coat and
// sheen are mixed from three sets by the weights above. `colors` holds the
// three colours as uniforms: set them to repaint.
export function liveryMaterial(tex, { rough, coat, sheen = [0, 0, 0], ...opts }) {
  const uniforms = {
    uA: { value: new THREE.Color() },
    uB: { value: new THREE.Color() },
    uC: { value: new THREE.Color() },
    uRough: { value: new THREE.Vector3(...rough) },
    uCoat: { value: new THREE.Vector3(...coat) },
    uSheen: { value: new THREE.Vector3(...sheen) },
  }
  const m = new THREE.MeshPhysicalMaterial({ map: tex, alphaMap: tex, alphaTest: 0.5, clearcoat: 1, clearcoatRoughness: 0.05, sheen: sheen.some(Boolean) ? 1 : 0, sheenRoughness: 0.6, sheenColor: new THREE.Color('#9aa0a8'), ...opts })
  m.userData.uniforms = uniforms
  m.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, uniforms)
    s.fragmentShader =
      'uniform vec3 uA;\nuniform vec3 uB;\nuniform vec3 uC;\nuniform vec3 uRough;\nuniform vec3 uCoat;\nuniform vec3 uSheen;\n' +
      s.fragmentShader
        .replace(
          '#include <map_fragment>',
          `vec4 rdW = texture2D( map, vMapUv );
          vec3 rdK = vec3( ( 1.0 - rdW.r ) * ( 1.0 - rdW.b ), rdW.r * ( 1.0 - rdW.b ), rdW.b );
          diffuseColor.rgb = rdK.x * uA + rdK.y * uB + rdK.z * uC;`,
        )
        .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = dot( rdK, uRough );')
        .replace(
          '#include <lights_physical_fragment>',
          `#include <lights_physical_fragment>
          #ifdef USE_CLEARCOAT
            material.clearcoat *= dot( rdK, uCoat );
          #endif
          #ifdef USE_SHEEN
            material.sheenColor *= dot( rdK, uSheen );
          #endif`,
        )
  }
  m.customProgramCacheKey = () => 'rd-livery'
  return m
}

// ---------------------------------------------------------------- small textures
export function plateTexture(text) {
  return canvasTexture(512, 160, (g, W, H) => {
    g.fillStyle = '#f2c618'
    g.beginPath()
    g.roundRect(0, 0, W, H, 14)
    g.fill()
    g.strokeStyle = '#141414'
    g.lineWidth = 7
    g.beginPath()
    g.roundRect(8, 8, W - 16, H - 16, 10)
    g.stroke()
    g.fillStyle = '#141414'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    let size = 92
    do {
      g.font = `800 ${size}px "Helvetica Neue", Arial, sans-serif`
      size -= 4
    } while (g.measureText(text).width > W - 60 && size > 30)
    g.fillText(text, W / 2, H / 2 + 4)
  })
}

// the label on a battery module
export function batteryLabel() {
  return canvasTexture(512, 256, (g, W, H) => {
    g.fillStyle = '#202326'
    g.fillRect(0, 0, W, H)
    g.fillStyle = '#e8eaec'
    g.font = '700 46px "Helvetica Neue", Arial, sans-serif'
    g.fillText('LiFePO4', 28, 70)
    g.font = '500 30px "Helvetica Neue", Arial, sans-serif'
    g.fillStyle = '#a9aeb4'
    g.fillText('51.2 V   105 Ah   5.4 kWh', 28, 120)
    g.fillStyle = '#f08a1c'
    g.fillRect(28, 150, 120, 10)
    g.fillStyle = '#7d838a'
    g.font = '500 22px ui-monospace, Menlo, monospace'
    g.fillText('RD-PACK  SN 2026-0415', 28, 205)
    g.strokeStyle = '#f08a1c'
    g.lineWidth = 4
    g.beginPath()
    g.moveTo(W - 90, 40)
    g.lineTo(W - 60, 100)
    g.lineTo(W - 120, 100)
    g.closePath()
    g.stroke()
  })
}

// The instrument cluster on the handlebar: speed, battery, range, gear and
// the lamps. `draw` redraws it in place.
export function displayTexture() {
  const tex = canvasTexture(512, 320, () => {})
  tex.userData.draw = ({ speed = 0, battery = 78, charging = false, lights = false, gear = 'P' }) => {
    const c = tex.image
    const g = c.getContext('2d')
    const W = c.width
    const H = c.height
    g.fillStyle = '#05080b'
    g.fillRect(0, 0, W, H)
    const glow = g.createRadialGradient(W / 2, H * 0.4, 10, W / 2, H * 0.4, W * 0.6)
    glow.addColorStop(0, 'rgba(40,110,140,0.35)')
    glow.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = glow
    g.fillRect(0, 0, W, H)
    g.textAlign = 'center'
    g.fillStyle = '#eaf6ff'
    g.font = '700 128px "Helvetica Neue", Arial, sans-serif'
    g.fillText(String(Math.round(speed)), W / 2, 158)
    g.font = '500 26px "Helvetica Neue", Arial, sans-serif'
    g.fillStyle = '#7fa8bd'
    g.fillText('km/h', W / 2, 194)
    // gear
    g.font = '700 40px "Helvetica Neue", Arial, sans-serif'
    g.fillStyle = gear === 'D' ? '#3fe08a' : '#eaf6ff'
    g.fillText(gear, 60, 80)
    // lamps
    if (lights) {
      g.fillStyle = '#3f9cff'
      g.font = '700 30px "Helvetica Neue", Arial, sans-serif'
      g.fillText('≡D', W - 62, 78)
    }
    // battery bar
    const x0 = 70
    const w = W - 140
    g.strokeStyle = '#7fa8bd'
    g.lineWidth = 3
    g.strokeRect(x0, 236, w, 30)
    g.fillRect(x0 + w, 244, 6, 14)
    g.fillStyle = charging ? '#3fe08a' : battery < 20 ? '#ff5a3c' : '#4fc3ff'
    g.fillRect(x0 + 4, 240, (w - 8) * (battery / 100), 22)
    g.font = '600 24px "Helvetica Neue", Arial, sans-serif'
    g.fillStyle = '#eaf6ff'
    g.textAlign = 'left'
    g.fillText(`${Math.round(battery)}%${charging ? '  ⚡ charging' : ''}`, x0, 298)
    g.textAlign = 'right'
    g.fillText(`${Math.round(battery * 1.4)} km`, x0 + w, 298)
    tex.needsUpdate = true
  }
  tex.userData.draw({})
  return tex
}
