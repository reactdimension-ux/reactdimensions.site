import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useCursor } from '@react-three/drei'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import * as THREE from 'three'

// A badminton racket at regulation size: 665 mm long, an isometric head
// about 200 x 225 mm, an 85 g graphite build.
//
// It is made the way a real one is. The frame is a box section (deeper
// than it is wide) swept round the head, with a groove on the outside that
// the string runs along between holes, and plastic grommets where it comes
// through to the string bed. Below the head the frame narrows into a throat
// that wraps the shaft, and a T-joint closes the bottom of the string bed.
// The string bed is 22 mains and 24 crosses of 0.68 mm string, actually
// woven: each string rides over one and under the next. The React
// Dimensions mark is stencilled across the bed in ink, so it shows only
// where there is string, broken up by the gaps, as a real stencil does.
// A thin 6.8 mm shaft runs into a tapered ferrule and an octagonal handle
// wrapped in a towel-style overgrip, its spiral overlaps raised.
//
// Tap the string bed and it dents and trampolines at the point you hit,
// with a ping whose pitch follows the string tension.

// the React Dimensions mark (kept inline so the component is self-contained)
const R_PATH =
  'M168 320 L172 186 L130 172 C150 100 270 42 370 44 C440 46 472 80 462 120 C452 160 380 194 270 236 ' +
  'L376 322 L378 342 L242 344 L240 302 L228 308 L226 318 Z ' +
  'M230 198 L233 150 C254 122 300 102 346 104 C384 106 412 116 422 128 C428 136 420 142 404 147 Z'

// head: isometric. Broad, squared-off shoulders, widest about a third of the
// way down, then the sides taper fairly straight to a narrow rounded bottom
// (a superellipse, squarer above the middle, pinched by a taper below)
const A = 0.108
const B = 0.1115
const YC = 0.5525
const N_TOP = 2.4 // superellipse exponents: higher is squarer
const N_BOTTOM = 2.0
const M_SIDE = 2.2
const ALPHA = 0.3
const T_START = 1.5 * Math.PI - ALPHA
const T_END = -0.5 * Math.PI + ALPHA
const W = 0.0036 // frame half width, in the plane of the head
const D = 0.0045 // frame half depth
const RC = 0.0016 // corner radius
const GROOVE = 0.0012 // half height of the string groove
const GD = 0.0009 // groove depth
const YT = 0.4475 // T-joint
const XT = 0.021
const WT = W * 0.9
const BED_BOTTOM = YT + WT
const SR = 0.00034 // string radius (0.68 mm gauge)
const MAINS = 22
const MAIN_GAP = 0.0076
const CROSS_GAP = 0.0082
const GRIP0 = 0.004
const GRIP1 = 0.199
const SHAFT_R = 0.0034
const SHAFT0 = 0.24
const SHAFT1 = YT
// stencil texture covers this rectangle of the head
const BX0 = -0.1
const BX1 = 0.1
const BY0 = 0.445
const BY1 = 0.67

const V = (x, y, z = 0) => new THREE.Vector3(x, y, z)
function oval(t) {
  const c = Math.cos(t)
  const s = Math.sin(t)
  const n = s > 0 ? N_TOP : N_BOTTOM
  const taper = 1 - 0.3 * Math.pow((1 - s) / 2, 1.4)
  const x = Math.sign(c) * Math.pow(Math.abs(c), 2 / n) * taper
  const y = Math.sign(s) * Math.pow(Math.abs(s), 2 / M_SIDE)
  return V(A * x, YC + B * y)
}
// outward normal of the head, walking the frame clockwise (decreasing t)
function ovalNormal(t) {
  const d = oval(t - 1e-4).sub(oval(t + 1e-4))
  return V(-d.y, d.x).normalize()
}

function rng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// the frame's cross-section in (n, z): a rounded box, n outward, with the
// string groove down the middle of the outside face. Counter-clockwise.
function frameProfile() {
  const pts = []
  const arc = (cx, cz, a0, a1) => {
    for (let i = 0; i <= 5; i++) {
      const a = a0 + ((a1 - a0) * i) / 5
      pts.push([cx + RC * Math.cos(a), cz + RC * Math.sin(a)])
    }
  }
  pts.push([W, -D + RC], [W, -GROOVE - 0.0003], [W - GD, -GROOVE], [W - GD, GROOVE], [W, GROOVE + 0.0003])
  arc(W - RC, D - RC, 0, Math.PI / 2)
  const front0 = pts.length - 1
  arc(-W + RC, D - RC, Math.PI / 2, Math.PI)
  const front1 = front0 + 1
  arc(-W + RC, -D + RC, Math.PI, 1.5 * Math.PI)
  arc(W - RC, -D + RC, 1.5 * Math.PI, 2 * Math.PI)
  const len = [0]
  for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]))
  const v = len.map((l) => l / len[len.length - 1])
  return { pts, v, front: [v[front0], v[front1]] }
}

// sweep the profile along a path in the head's plane
function sweep(path, profile, scale = () => 1) {
  const n = path.length
  const m = profile.pts.length
  const pos = []
  const uv = []
  const idx = []
  const arc = [0]
  for (let i = 1; i < n; i++) arc.push(arc[i - 1] + path[i].distanceTo(path[i - 1]))
  const total = arc[n - 1]
  for (let i = 0; i < n; i++) {
    const a = path[Math.max(0, i - 1)]
    const b = path[Math.min(n - 1, i + 1)]
    const tx = b.x - a.x
    const ty = b.y - a.y
    const tl = Math.hypot(tx, ty)
    const nx = -ty / tl
    const ny = tx / tl
    const s = scale(arc[i] / total)
    for (let j = 0; j < m; j++) {
      const [pn, pz] = profile.pts[j]
      pos.push(path[i].x + nx * pn * s, path[i].y + ny * pn * s, pz * s)
      uv.push(arc[i] / total, profile.v[j])
    }
  }
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < m - 1; j++) {
      const a = i * m + j
      idx.push(a, a + 1, a + m, a + 1, a + m + 1, a + m)
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  geo.setIndex(idx)
  geo.computeVertexNormals()
  return geo
}

function framePath() {
  const pts = [V(-0.0012, 0.405), V(-0.0045, 0.419), V(-0.0125, 0.4335)]
  for (let i = 0; i <= 160; i++) pts.push(oval(T_START + ((T_END - T_START) * i) / 160))
  pts.push(V(0.0125, 0.4335), V(0.0045, 0.419), V(0.0012, 0.405))
  return new THREE.CatmullRomCurve3(pts, false, 'centripetal').getSpacedPoints(1100)
}

// the inside edge of the hoop, for laying out the strings
const INNER = (() => {
  const out = []
  for (let i = 0; i <= 400; i++) {
    const t = T_START + ((T_END - T_START) * i) / 400
    out.push(oval(t).sub(ovalNormal(t).multiplyScalar(W)))
  }
  return out
})()
function crossings(axis, value) {
  const hits = []
  for (let i = 0; i < INNER.length; i++) {
    const p = INNER[i]
    const q = INNER[(i + 1) % INNER.length]
    const a = axis === 'x' ? p.x : p.y
    const b = axis === 'x' ? q.x : q.y
    if ((a - value) * (b - value) <= 0 && a !== b) {
      const f = (value - a) / (b - a)
      hits.push(axis === 'x' ? p.y + (q.y - p.y) * f : p.x + (q.x - p.x) * f)
    }
  }
  return hits.length >= 2 ? [Math.min(...hits), Math.max(...hits)] : null
}

// the string layout: where each main and cross runs, and the over-under weave
const LAYOUT = (() => {
  const mains = []
  for (let i = 0; i < MAINS; i++) {
    const x = (i - (MAINS - 1) / 2) * MAIN_GAP
    const r = crossings('x', x)
    if (r) mains.push({ x, y0: Math.max(r[0], BED_BOTTOM), y1: r[1] })
  }
  const crosses = []
  for (let y = BED_BOTTOM + 0.0055; ; y += CROSS_GAP) {
    const r = crossings('y', y)
    if (!r || y > YC + B - W - 0.004) break
    crosses.push({ y, x0: r[0], x1: r[1] })
  }
  return { mains, crosses }
})()

function stringGeometry() {
  const { mains, crosses } = LAYOUT
  const geos = []
  const z = (i, j) => SR * ((i + j) % 2 ? 1 : -1)
  mains.forEach((mn, i) => {
    const pts = [V(mn.x, mn.y0 - 0.0012), V(mn.x, mn.y0 + 0.0004)]
    crosses.forEach((c, j) => {
      if (c.y > mn.y0 + 0.001 && c.y < mn.y1 - 0.001 && mn.x > c.x0 && mn.x < c.x1) pts.push(V(mn.x, c.y, z(i, j)))
    })
    pts.push(V(mn.x, mn.y1 - 0.0004), V(mn.x, mn.y1 + 0.0012))
    geos.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), pts.length * 6, SR, 5, false))
  })
  crosses.forEach((c, j) => {
    const pts = [V(c.x0 - 0.0012, c.y), V(c.x0 + 0.0004, c.y)]
    mains.forEach((mn, i) => {
      if (mn.x > c.x0 + 0.001 && mn.x < c.x1 - 0.001 && c.y > mn.y0 && c.y < mn.y1) pts.push(V(mn.x, c.y, -z(i, j)))
    })
    pts.push(V(c.x1 - 0.0004, c.y), V(c.x1 + 0.0012, c.y))
    geos.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), pts.length * 6, SR, 5, false))
  })
  // the string running round the outside groove between holes
  const groove = []
  for (let i = 0; i <= 300; i++) {
    const t = T_START + ((T_END - T_START) * i) / 300
    groove.push(oval(t).add(ovalNormal(t).multiplyScalar(W - GD + SR * 0.8)))
  }
  geos.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(groove), 900, SR, 5, false))
  const geo = mergeGeometries(geos)
  geos.forEach((g) => g.dispose())
  // planar UVs across the head, so the stencil lands where a real one would
  const p = geo.attributes.position
  const uv = geo.attributes.uv
  for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) - BX0) / (BX1 - BX0), (p.getY(i) - BY0) / (BY1 - BY0))
  return geo
}

// grommets where every string comes through the frame
function grommets(color) {
  const { mains, crosses } = LAYOUT
  const geo = new THREE.CylinderGeometry(0.00105, 0.0012, 0.0016, 10)
  const mat = new THREE.MeshPhysicalMaterial({ color, roughness: 0.38, clearcoat: 0.4 })
  const mesh = new THREE.InstancedMesh(geo, mat, (mains.length + crosses.length) * 2)
  const o = new THREE.Object3D()
  let n = 0
  for (const mn of mains) {
    for (const y of [mn.y0 + 0.0003, mn.y1 - 0.0003]) {
      o.position.set(mn.x, y, 0)
      o.rotation.set(0, 0, 0)
      o.updateMatrix()
      mesh.setMatrixAt(n++, o.matrix)
    }
  }
  for (const c of crosses) {
    for (const x of [c.x0 + 0.0003, c.x1 - 0.0003]) {
      o.position.set(x, c.y, 0)
      o.rotation.set(0, 0, Math.PI / 2)
      o.updateMatrix()
      mesh.setMatrixAt(n++, o.matrix)
    }
  }
  mesh.count = n
  return mesh
}

// string colour with the stencil inked on: the mark, slightly soaked into
// the string at its edges and speckled where the ink took unevenly
function stencilMap(strings, ink, stencil) {
  const S = 1024
  const c = Object.assign(document.createElement('canvas'), { width: S, height: S })
  const g = c.getContext('2d')
  const r = rng(29)
  g.fillStyle = strings
  g.fillRect(0, 0, S, S)
  // faint variation along the strings (multifilament sheen)
  for (let i = 0; i < 4000; i++) {
    g.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.025)' : 'rgba(255,255,255,0.04)'
    g.fillRect(r() * S, r() * S, 2, 2)
  }
  if (stencil) {
    const w = 0.132 // logo width on the head, m
    const sx = ((w / 352) * S) / (BX1 - BX0)
    const sy = ((w / 352) * S) / (BY1 - BY0)
    const cx = ((0 - BX0) / (BX1 - BX0)) * S
    const cy = (1 - (YC + 0.002 - BY0) / (BY1 - BY0)) * S
    // ink on its own layer, so the unevenness lands only on the ink
    const inkC = Object.assign(document.createElement('canvas'), { width: S, height: S })
    const k = inkC.getContext('2d')
    k.setTransform(sx, 0, 0, sy, cx - 298 * sx, cy - 193 * sy)
    k.filter = 'blur(0.8px)'
    k.fillStyle = ink
    k.fill(new Path2D(R_PATH), 'evenodd')
    k.setTransform(1, 0, 0, 1, 0, 0)
    k.filter = 'none'
    k.globalCompositeOperation = 'source-atop'
    for (let i = 0; i < 2500; i++) {
      k.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'
      k.fillRect(r() * S, r() * S, 2 + r() * 3, 2 + r() * 3)
    }
    g.globalAlpha = 0.95
    g.drawImage(inkC, 0, 0)
    g.globalAlpha = 1
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

// frame graphics: u runs along the frame from the left of the throat, round
// the head, to the right; v runs round the cross-section
function frameDecals(base, accent, front) {
  const Wd = 8192
  const Hd = 256
  const c = Object.assign(document.createElement('canvas'), { width: Wd, height: Hd })
  const g = c.getContext('2d')
  g.fillStyle = base
  g.fillRect(0, 0, Wd, Hd)
  const X = (u) => u * Wd
  // accent panels: the shoulders of the head and the throat, cut on the slant
  const panel = (u0, u1, flip) => {
    g.fillStyle = accent
    const sl = 40 * (flip ? -1 : 1)
    g.beginPath()
    g.moveTo(X(u0) + sl, 0)
    g.lineTo(X(u1) + sl, 0)
    g.lineTo(X(u1) - sl, Hd)
    g.lineTo(X(u0) - sl, Hd)
    g.closePath()
    g.fill()
    // pinstripes trailing off the panel
    for (let k = 1; k <= 4; k++) {
      const d = k * 26
      const at = flip ? X(u0) - d : X(u1) + d
      g.fillRect(at - 5 + (flip ? 0 : 0), 0, 9 - k, Hd)
    }
  }
  panel(0.27, 0.36, false)
  panel(0.64, 0.73, true)
  g.fillStyle = accent
  g.fillRect(0, 0, X(0.045), Hd)
  g.fillRect(X(0.955), 0, X(0.045), Hd)
  // lettering on the front face, reading from the throat up on both sides
  const fy0 = (1 - front[1]) * Hd
  const fy1 = (1 - front[0]) * Hd
  const fh = fy1 - fy0
  const text = (str, u, flip) => {
    g.save()
    g.translate(X(u), (fy0 + fy1) / 2)
    if (flip) g.rotate(Math.PI)
    g.scale(1, -0.75) // the front face's v runs against the canvas, so flip to read the right way round
    g.fillStyle = accent
    g.font = `800 ${Math.round(fh * 1.05)}px Inter, Arial, sans-serif`
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText(str, 0, 0)
    g.restore()
  }
  text('REACT DIMENSIONS', 0.18, false)
  text('ISO · 4U G5 · 30 LBS', 0.82, true)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

// shaft graphics: a crossed X and the model line, facing forward
function shaftDecals(base, accent) {
  const Wd = 256
  const Hd = 4096
  const c = Object.assign(document.createElement('canvas'), { width: Wd, height: Hd })
  const g = c.getContext('2d')
  g.fillStyle = base
  g.fillRect(0, 0, Wd, Hd)
  const cx = Wd / 2
  // the X, a third of the way down the shaft
  g.strokeStyle = accent
  g.lineCap = 'butt'
  for (const [w, a] of [[16, 1], [6, 0.6]]) {
    g.globalAlpha = a
    g.lineWidth = w
    g.beginPath()
    g.moveTo(cx - 40, 1500)
    g.lineTo(cx + 40, 1900)
    g.moveTo(cx + 40, 1500)
    g.lineTo(cx - 40, 1900)
    g.stroke()
  }
  g.globalAlpha = 1
  g.fillRect(cx - 2, 1960, 4, 260)
  // the line, reading up the shaft
  g.save()
  g.translate(cx, 1150)
  g.rotate(-Math.PI / 2)
  g.fillStyle = accent
  g.font = '700 30px Inter, Arial, sans-serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText('REACT DIMENSIONS', 0, 0)
  g.font = '600 22px Inter, Arial, sans-serif'
  g.fillText('HIGH MODULUS GRAPHITE', 0, 340)
  g.restore()
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

// an octagonal handle under a towel-style overgrip: rounded octagon, flared
// at the butt, with each spiral overlap standing slightly proud
function gripGeometry() {
  const len = GRIP1 - GRIP0
  const geo = new THREE.CylinderGeometry(1, 1, len, 96, 220, true)
  const p = geo.attributes.position
  const pitch = 0.024
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i)
    const z = p.getZ(i)
    const yy = p.getY(i) + len / 2
    const phi = Math.atan2(x, z)
    let r = yy < 0.014 ? THREE.MathUtils.lerp(0.0143, 0.0132, Math.sin((yy / 0.014) * Math.PI * 0.5)) : THREE.MathUtils.lerp(0.0132, 0.0125, (yy - 0.014) / (len - 0.014))
    const a = (((phi % (Math.PI / 4)) + Math.PI / 4) % (Math.PI / 4)) - Math.PI / 8
    const oct = Math.cos(Math.PI / 8) / Math.cos(a)
    r *= 0.985 + (oct - 1) * 0.3
    let f = yy / pitch + phi / (Math.PI * 2)
    f -= Math.floor(f)
    r += 0.0006 * Math.pow(f, 0.5) + (f > 0.965 ? -0.0006 * (f - 0.965) / 0.035 : 0)
    p.setXYZ(i, r * Math.sin(phi), p.getY(i), r * Math.cos(phi))
  }
  geo.computeVertexNormals()
  return geo
}

function gripBump() {
  const Wd = 512
  const Hd = 512
  const c = Object.assign(document.createElement('canvas'), { width: Wd, height: Hd })
  const g = c.getContext('2d')
  const r = rng(13)
  g.fillStyle = '#808080'
  g.fillRect(0, 0, Wd, Hd)
  // towelling: dense tiny loops
  for (let i = 0; i < 30000; i++) {
    const v = Math.floor(90 + r() * 120)
    g.fillStyle = `rgb(${v},${v},${v})`
    g.beginPath()
    g.arc(r() * Wd, r() * Hd, 0.8 + r() * 1.4, 0, Math.PI * 2)
    g.fill()
  }
  // a row of perforations
  g.fillStyle = '#202020'
  for (let y = 10; y < Hd; y += 22) for (let x = 11; x < Wd; x += 22) {
    g.beginPath()
    g.arc(x + ((y / 22) % 2) * 11, y, 2.2, 0, Math.PI * 2)
    g.fill()
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(4, 12)
  return t
}

function logoDisc(ink) {
  const S = 256
  const c = Object.assign(document.createElement('canvas'), { width: S, height: S })
  const g = c.getContext('2d')
  g.fillStyle = '#1a1a1a'
  g.fillRect(0, 0, S, S)
  const s = 0.5
  g.setTransform(s, 0, 0, s, S / 2 - 298 * s, S / 2 - 193 * s)
  g.fillStyle = ink
  g.fill(new Path2D(R_PATH), 'evenodd')
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

const lathe = (pts, seg = 64) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg)

// sound: the string bed's ping, pitched by tension
let actx
function ping(tension, strength) {
  if (!actx) {
    const Ac = window.AudioContext || window.webkitAudioContext
    if (!Ac) return
    actx = new Ac()
  }
  if (actx.state === 'suspended') actx.resume()
  const a = actx
  const t = a.currentTime
  const f = 360 + tension * 17
  for (const [mul, gain, dec] of [[1, 0.22, 0.2], [2.76, 0.07, 0.08], [5.4, 0.03, 0.04]]) {
    const o = a.createOscillator()
    const g = a.createGain()
    o.frequency.value = f * mul
    g.gain.setValueAtTime(gain * strength, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dec)
    o.connect(g).connect(a.destination)
    o.start(t)
    o.stop(t + dec + 0.02)
  }
  const buf = a.createBuffer(1, Math.floor(a.sampleRate * 0.03), a.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (a.sampleRate * 0.004))
  const src = a.createBufferSource()
  src.buffer = buf
  const bp = a.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 2600
  const g = a.createGain()
  g.gain.value = 0.35 * strength
  src.connect(bp).connect(g).connect(a.destination)
  src.start(t)
}

export default function Racket({
  frame = '#f2f2ef',
  accent = '#1f2f6b',
  strings = '#f3f1ea',
  ink = '#ff4d1a',
  stencil = true,
  grip = '#161616',
  tension = 24,
  length = 665,
  sound = false,
  slowMotion = 1,
  hitKey = 0,
  twirlKey = 0,
  autoRotate = false,
}) {
  const outer = useRef()
  const head = useRef()
  // overall length: as on real rackets, the difference is all in the shaft
  // (665 mm standard, 675 extended, shorter for juniors); head and handle
  // keep their size
  const dL = (THREE.MathUtils.clamp(length, 580, 700) - 665) / 1000
  const [hover, setHover] = useState(false)
  useCursor(hover)

  const profile = useMemo(() => frameProfile(), [])
  const geos = useMemo(() => {
    const tProfile = { ...profile, pts: profile.pts.map(([n, z]) => [n * 0.9, z * 0.92]) }
    const tPath = Array.from({ length: 24 }, (_, i) => V(XT - (2 * XT * i) / 23, YT))
    return {
      frame: sweep(framePath(), profile, (u) => 1 + 0.2 * Math.max(0, 1 - Math.min(u, 1 - u) / 0.07)),
      tbar: sweep(tPath, tProfile),
      strings: stringGeometry(),
      grip: gripGeometry(),
      bed: new THREE.ShapeGeometry(new THREE.Shape(INNER.map((p) => new THREE.Vector2(p.x, Math.max(p.y, BED_BOTTOM))))),
      ferrule: lathe([[0.0127, GRIP1 - 0.001], [0.0126, 0.205], [0.011, 0.212], [0.0078, 0.222], [0.0052, 0.233], [0.0039, SHAFT0 + 0.004], [SHAFT_R, SHAFT0 + 0.01]]),
      ring: lathe([[0.0128, 0.2005], [0.01295, 0.201], [0.01295, 0.2045], [0.0128, 0.205]]),
      tape: lathe([[0.0124, 0.183], [0.01305, 0.1835], [0.0131, 0.198], [0.0127, 0.1995], [0.0118, 0.1998]]),
      collar: lathe([[SHAFT_R, 0.365], [0.0039, 0.381], [0.0056, 0.395], [0.0074, 0.407], [0.0079, 0.414], [0.0072, 0.422], [0.0052, 0.428], [SHAFT_R + 0.0002, 0.434]], 72),
      cap: lathe([[0.0001, 0], [0.0108, 0.0002], [0.0138, 0.0012], [0.0146, 0.003], [0.0146, 0.0055], [0.0141, GRIP0 + 0.003]]),
    }
  }, [profile])
  useEffect(() => () => Object.values(geos).forEach((g) => g.dispose()), [geos])

  const grom = useMemo(() => grommets(accent), [accent])
  useEffect(() => () => (grom.geometry.dispose(), grom.material.dispose()), [grom])

  const tex = useMemo(() => ({ frame: frameDecals(frame, accent, profile.front), shaft: shaftDecals(frame, accent) }), [frame, accent, profile])
  useEffect(() => () => (tex.frame.dispose(), tex.shaft.dispose()), [tex])
  const stencilTex = useMemo(() => stencilMap(strings, ink, stencil), [strings, ink, stencil])
  useEffect(() => () => stencilTex.dispose(), [stencilTex])
  const bump = useMemo(() => gripBump(), [])
  const disc = useMemo(() => logoDisc(ink), [ink])
  useEffect(() => () => (bump.dispose(), disc.dispose()), [bump, disc])

  // the string bed dents and trampolines where it is hit
  const uniforms = useMemo(() => ({ uHit: { value: new THREE.Vector4(0, 0, -1, 0) }, uDepth: { value: 0.006 } }), [])
  const stringMat = useMemo(() => {
    const m = new THREE.MeshPhysicalMaterial({ roughness: 0.42, sheen: 0.6, sheenColor: new THREE.Color('#ffffff'), sheenRoughness: 0.4, clearcoat: 0.25, clearcoatRoughness: 0.3 })
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uHit = uniforms.uHit
      sh.uniforms.uDepth = uniforms.uDepth
      sh.vertexShader = 'uniform vec4 uHit;\nuniform float uDepth;\n' + sh.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        if (uHit.z >= 0.0 && uHit.z < 1.5) {
          vec2 dd = position.xy - uHit.xy;
          float r2 = dot(dd, dd);
          float env = exp(-r2 / 0.0011) * uHit.w;
          float t = uHit.z;
          float dent = smoothstep(0.0, 0.012, t) * exp(-t * 26.0);
          float ring = sin(t * 140.0 - sqrt(r2) * 160.0) * exp(-t * 6.5) * 0.3;
          transformed.z -= uDepth * env * (dent * 1.6 + ring);
        }`,
      )
    }
    m.customProgramCacheKey = () => 'racket-strings'
    return m
  }, [uniforms])
  useEffect(() => void (stringMat.map = stencilTex, (stringMat.needsUpdate = true)), [stringMat, stencilTex])
  useEffect(() => () => stringMat.dispose(), [stringMat])
  // lower tension, deeper pocket
  uniforms.uDepth.value = 0.0035 + (30 - tension) * 0.00035

  const st = useRef({ hitT: -1, twirl: 0, twirlTo: 0, recoil: -1, t: 0 })
  const snd = useRef(sound)
  snd.current = sound

  const hit = (x, y, strength = 1) => {
    uniforms.uHit.value.set(x, y, 0, strength)
    st.current.hitT = 0
    st.current.recoil = 0
    if (snd.current) ping(tension, strength)
  }
  // a shuttle on the sweet spot: just above the middle of the bed
  useEffect(() => void (hitKey && hit((Math.random() - 0.5) * 0.02, YC + 0.012 + (Math.random() - 0.5) * 0.02, 1)), [hitKey])
  useEffect(() => void (twirlKey && (st.current.twirlTo += Math.PI * 4)), [twirlKey])

  useFrame((state, delta) => {
    const dt = Math.min(1 / 30, delta) * slowMotion
    const s = st.current
    s.t += dt
    if (s.hitT >= 0) {
      s.hitT += dt
      uniforms.uHit.value.z = s.hitT
      if (s.hitT > 1.5) s.hitT = -1
    }
    s.twirl += (s.twirlTo - s.twirl) * (1 - Math.exp(-3.2 * dt))
    let kick = 0
    if (s.recoil >= 0) {
      s.recoil += dt
      kick = -0.05 * Math.sin(s.recoil * 22) * Math.exp(-s.recoil * 7)
      if (s.recoil > 1.2) s.recoil = -1
    }
    const g = outer.current
    g.rotation.y = s.twirl + (autoRotate ? 0 : Math.sin(s.t * 0.45) * 0.07)
    g.rotation.x = kick + Math.sin(s.t * 0.6) * 0.012
    g.position.y = Math.sin(s.t * 0.8) * 0.004
  })

  const white = { color: frame, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.06 }
  return (
    <group ref={outer}>
      <group position-y={-0.34 - dL / 2}>
        <group ref={head} position-y={dL}>
        {/* frame, T-joint and throat */}
        <mesh geometry={geos.frame} castShadow receiveShadow>
          <meshPhysicalMaterial map={tex.frame} roughness={0.22} clearcoat={1} clearcoatRoughness={0.06} />
        </mesh>
        <mesh geometry={geos.tbar} castShadow>
          <meshPhysicalMaterial {...white} />
        </mesh>
        <mesh geometry={geos.collar} castShadow>
          <meshPhysicalMaterial {...white} />
        </mesh>
        <primitive object={grom} />
        {/* strings */}
        <mesh geometry={geos.strings} material={stringMat} castShadow />
        <mesh
          geometry={geos.bed}
          onClick={(e) => {
            e.stopPropagation()
            const p = head.current.worldToLocal(e.point.clone())
            hit(p.x, p.y, 1)
          }}
          onPointerOver={() => setHover(true)}
          onPointerOut={() => setHover(false)}
        >
          <meshBasicMaterial colorWrite={false} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
        </group>
        {/* shaft */}
        <mesh position-y={(SHAFT0 + SHAFT1 + dL) / 2} rotation-y={Math.PI} castShadow>
          <cylinderGeometry args={[SHAFT_R, SHAFT_R, SHAFT1 + dL - SHAFT0, 40, 1, true]} />
          <meshPhysicalMaterial map={tex.shaft} roughness={0.2} clearcoat={1} clearcoatRoughness={0.05} />
        </mesh>
        <mesh geometry={geos.ferrule} castShadow>
          <meshPhysicalMaterial {...white} />
        </mesh>
        <mesh geometry={geos.ring}>
          <meshPhysicalMaterial color={accent} roughness={0.3} clearcoat={1} />
        </mesh>
        {/* handle */}
        <mesh geometry={geos.grip} position-y={(GRIP0 + GRIP1) / 2} castShadow receiveShadow>
          <meshPhysicalMaterial color={grip} roughness={0.82} bumpMap={bump} bumpScale={1.4} sheen={0.5} sheenColor="#5a5a5a" sheenRoughness={0.6} />
        </mesh>
        <mesh geometry={geos.tape} castShadow>
          <meshPhysicalMaterial color="#0c0c0c" roughness={0.28} clearcoat={0.6} />
        </mesh>
        <mesh geometry={geos.cap} castShadow>
          <meshPhysicalMaterial color="#1b1b1b" roughness={0.35} clearcoat={0.5} side={THREE.DoubleSide} />
        </mesh>
        <mesh position-y={-0.00005} rotation-x={Math.PI / 2}>
          <circleGeometry args={[0.0108, 48]} />
          <meshPhysicalMaterial map={disc} roughness={0.4} clearcoat={0.5} />
        </mesh>
      </group>
    </group>
  )
}
