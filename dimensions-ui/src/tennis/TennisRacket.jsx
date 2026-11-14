import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useCursor } from '@react-three/drei'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import * as THREE from 'three'

// A tennis racket at standard size: 27 in (686 mm) long, a 105 sq in oval
// head, a 23 mm deep beam.
//
// It is made the way a real one is. The frame is a box beam, much deeper
// than it is wide, with a channel round the outside for the grommet strip
// and the string that runs between holes, swept in one piece from the
// handle up one throat arm, round the head and down the other. The bottom
// of the hoop is the bridge (yoke) across the open throat. The string bed
// is a 16 x 19 pattern of 1.30 mm string, woven over and under, with the
// React Dimensions mark stencilled across it, so the ink sits only on the
// string. The paint fades from deep blue at the throat to sky blue at the
// tip. The handle is a rounded octagon under a white overgrip, its spiral
// overlaps raised, finished with a throat collar and a butt cap.
//
// Tap the strings and they dent and trampoline where they are hit, with a
// ping pitched by the string tension.

// the React Dimensions mark (kept inline so the component is self-contained)
const R_PATH =
  'M168 320 L172 186 L130 172 C150 100 270 42 370 44 C440 46 472 80 462 120 C452 160 380 194 270 236 ' +
  'L376 322 L378 342 L242 344 L240 302 L228 308 L226 318 Z ' +
  'M230 198 L233 150 C254 122 300 102 346 104 C384 106 412 116 422 128 C428 136 420 142 404 147 Z'

const LEN = 0.686 // standard length the model is built at
// head: an oval, a little fuller in the upper half
const A = 0.1255
const B = 0.1655
const YC = 0.5135
const N_TOP = 2.15
const N_BOTTOM = 2.0
const M_SIDE = 2.0
const ALPHA = 0.62 // where the throat arms leave the hoop, either side of the bottom
const T_START = 1.5 * Math.PI - ALPHA
const T_END = -0.5 * Math.PI + ALPHA
const W = 0.0065 // beam half width, in the plane of the head
const D = 0.0115 // beam half depth
const RC = 0.0036 // corner radius
const GROOVE = 0.0028 // half height of the grommet channel
const GD = 0.0017 // channel depth
const SR = 0.00065 // string radius (1.30 mm, 16 gauge)
const MAINS = 16
const MAIN_GAP = 0.0134
const CROSS_GAP = 0.0158
const GRIP0 = 0.006
const GRIP1 = 0.19
// stencil texture covers this rectangle of the head
const BX0 = -0.135
const BX1 = 0.135
const BY0 = 0.34
const BY1 = 0.69

const V = (x, y, z = 0) => new THREE.Vector3(x, y, z)
function oval(t) {
  const c = Math.cos(t)
  const s = Math.sin(t)
  const n = s > 0 ? N_TOP : N_BOTTOM
  const taper = 1 - 0.1 * Math.pow((1 - s) / 2, 1.4)
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

// the beam's cross-section in (n, z): a rounded box, n outward, with the
// grommet channel down the middle of the outside face. Counter-clockwise.
function frameProfile() {
  const pts = []
  const arc = (cx, cz, a0, a1) => {
    for (let i = 0; i <= 6; i++) {
      const a = a0 + ((a1 - a0) * i) / 6
      pts.push([cx + RC * Math.cos(a), cz + RC * Math.sin(a)])
    }
  }
  pts.push([W, -D + RC], [W, -GROOVE - 0.0006], [W - GD, -GROOVE], [W - GD, GROOVE], [W, GROOVE + 0.0006])
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

// one piece: up the left throat arm from inside the handle, round the head,
// down the right arm
function framePath() {
  const arm = [V(-0.004, 0.172), V(-0.0085, 0.205), V(-0.022, 0.255), V(-0.04, 0.305), V(-0.054, 0.345)]
  const pts = [...arm]
  for (let i = 0; i <= 200; i++) pts.push(oval(T_START + ((T_END - T_START) * i) / 200))
  for (let i = arm.length - 1; i >= 0; i--) pts.push(V(-arm[i].x, arm[i].y))
  return new THREE.CatmullRomCurve3(pts, false, 'centripetal').getSpacedPoints(1400)
}
// the bridge: the bottom of the hoop, across the open throat
function yokePath() {
  const pts = []
  for (let i = 0; i <= 80; i++) pts.push(oval(T_END - (2 * ALPHA * i) / 80))
  return pts
}

// the inside edge of the hoop, for laying out the strings
const INNER = (() => {
  const out = []
  for (let i = 0; i < 480; i++) {
    const t = (i / 480) * Math.PI * 2
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

// the 16 x 19 layout, crosses centred on the head
const LAYOUT = (() => {
  const mains = []
  for (let i = 0; i < MAINS; i++) {
    const x = (i - (MAINS - 1) / 2) * MAIN_GAP
    const r = crossings('x', x)
    if (r) mains.push({ x, y0: r[0], y1: r[1] })
  }
  const crosses = []
  for (let j = 0; j < 19; j++) {
    const y = YC - 0.0095 + (j - 9) * CROSS_GAP
    const r = crossings('y', y)
    if (r) crosses.push({ y, x0: r[0], x1: r[1] })
  }
  return { mains, crosses }
})()

function stringGeometry() {
  const { mains, crosses } = LAYOUT
  const geos = []
  const z = (i, j) => SR * ((i + j) % 2 ? 1 : -1)
  mains.forEach((mn, i) => {
    const pts = [V(mn.x, mn.y0 - 0.002), V(mn.x, mn.y0 + 0.0008)]
    crosses.forEach((c, j) => {
      if (c.y > mn.y0 + 0.002 && c.y < mn.y1 - 0.002 && mn.x > c.x0 && mn.x < c.x1) pts.push(V(mn.x, c.y, z(i, j)))
    })
    pts.push(V(mn.x, mn.y1 - 0.0008), V(mn.x, mn.y1 + 0.002))
    geos.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), pts.length * 6, SR, 6, false))
  })
  crosses.forEach((c, j) => {
    const pts = [V(c.x0 - 0.002, c.y), V(c.x0 + 0.0008, c.y)]
    mains.forEach((mn, i) => {
      if (mn.x > c.x0 + 0.002 && mn.x < c.x1 - 0.002 && c.y > mn.y0 && c.y < mn.y1) pts.push(V(mn.x, c.y, -z(i, j)))
    })
    pts.push(V(c.x1 - 0.0008, c.y), V(c.x1 + 0.002, c.y))
    geos.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), pts.length * 6, SR, 6, false))
  })
  // the string running round the outside channel between holes
  const groove = []
  for (let i = 0; i < 400; i++) {
    const t = (i / 400) * Math.PI * 2
    groove.push(oval(t).add(ovalNormal(t).multiplyScalar(W - GD + SR * 0.8)))
  }
  geos.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(groove, true), 1200, SR, 6, true))
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
  const geo = new THREE.CylinderGeometry(0.0017, 0.002, 0.0026, 12)
  const mat = new THREE.MeshPhysicalMaterial({ color, roughness: 0.42, clearcoat: 0.3 })
  const mesh = new THREE.InstancedMesh(geo, mat, (mains.length + crosses.length) * 2)
  const o = new THREE.Object3D()
  let n = 0
  for (const mn of mains) {
    for (const y of [mn.y0 + 0.0006, mn.y1 - 0.0006]) {
      o.position.set(mn.x, y, 0)
      o.rotation.set(0, 0, 0)
      o.updateMatrix()
      mesh.setMatrixAt(n++, o.matrix)
    }
  }
  for (const c of crosses) {
    for (const x of [c.x0 + 0.0006, c.x1 - 0.0006]) {
      o.position.set(x, c.y, 0)
      o.rotation.set(0, 0, Math.PI / 2)
      o.updateMatrix()
      mesh.setMatrixAt(n++, o.matrix)
    }
  }
  mesh.count = n
  return mesh
}

// string colour with the stencil inked on: the mark, slightly soaked in at
// its edges and uneven where the ink took
function stencilMap(strings, ink, stencil) {
  const S = 1024
  const mk = () => Object.assign(document.createElement('canvas'), { width: S, height: S })
  const c = mk()
  const g = c.getContext('2d')
  const r = rng(29)
  g.fillStyle = strings
  g.fillRect(0, 0, S, S)
  for (let i = 0; i < 4000; i++) {
    g.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.025)' : 'rgba(255,255,255,0.04)'
    g.fillRect(r() * S, r() * S, 2, 2)
  }
  if (stencil) {
    const inkC = mk()
    const k = inkC.getContext('2d')
    const w = 0.165 // logo width on the head, m
    const sx = ((w / 352) * S) / (BX1 - BX0)
    const sy = ((w / 352) * S) / (BY1 - BY0)
    const cx = ((0 - BX0) / (BX1 - BX0)) * S
    const cy = (1 - (YC + 0.012 - BY0) / (BY1 - BY0)) * S
    k.setTransform(sx, 0, 0, sy, cx - 298 * sx, cy - 193 * sy)
    k.filter = 'blur(0.8px)'
    k.fillStyle = ink
    k.fill(new Path2D(R_PATH), 'evenodd')
    k.setTransform(1, 0, 0, 1, 0, 0)
    k.filter = 'none'
    k.globalCompositeOperation = 'source-atop'
    for (let i = 0; i < 2500; i++) {
      k.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'
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

// paint: u runs along the frame from the left arm, round the head (u = 0.5
// at the tip) and down the right arm; v runs round the beam. Deep blue at
// the throat fading to sky blue at the tip, with the lettering in white up
// the front of both throat arms.
function frameDecals(base, top, letter, front) {
  const Wd = 8192
  const Hd = 256
  const c = Object.assign(document.createElement('canvas'), { width: Wd, height: Hd })
  const g = c.getContext('2d')
  const grad = g.createLinearGradient(0, 0, Wd, 0)
  grad.addColorStop(0, base)
  grad.addColorStop(0.27, base)
  grad.addColorStop(0.42, top)
  grad.addColorStop(0.58, top)
  grad.addColorStop(0.73, base)
  grad.addColorStop(1, base)
  g.fillStyle = grad
  g.fillRect(0, 0, Wd, Hd)
  // a metallic-flake speckle in the paint
  const r = rng(51)
  for (let i = 0; i < 60000; i++) {
    g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'
    g.fillRect(r() * Wd, r() * Hd, 2, 2)
  }
  const fy0 = (1 - front[1]) * Hd
  const fy1 = (1 - front[0]) * Hd
  const fh = fy1 - fy0
  const text = (str, u, flip, size, weight = 900) => {
    g.save()
    g.translate(u * Wd, (fy0 + fy1) / 2)
    if (flip) g.rotate(Math.PI)
    g.scale(1, -0.62) // the front face's v runs against the canvas, so flip to read the right way round
    g.fillStyle = letter
    g.font = `italic ${weight} ${Math.round(fh * size)}px Inter, Arial, sans-serif`
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText(str, 0, 0)
    g.restore()
  }
  text('REACT DIMENSIONS', 0.085, false, 2.1)
  text('TOUR 105  ·  27 IN', 0.915, true, 1.8, 700)
  // small spec text on the head
  text('16 x 19', 0.33, false, 1.1, 600)
  text('105 SQ IN', 0.67, true, 1.1, 600)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

// a rounded octagonal handle under an overgrip, flared at the butt, each
// spiral overlap standing slightly proud
function gripGeometry() {
  const len = GRIP1 - GRIP0
  const geo = new THREE.CylinderGeometry(1, 1, len, 112, 240, true)
  const p = geo.attributes.position
  const pitch = 0.03
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i)
    const z = p.getZ(i)
    const yy = p.getY(i) + len / 2
    const phi = Math.atan2(x, z)
    let r = yy < 0.02 ? THREE.MathUtils.lerp(0.0192, 0.0172, Math.sin((yy / 0.02) * Math.PI * 0.5)) : THREE.MathUtils.lerp(0.0172, 0.0166, (yy - 0.02) / (len - 0.02))
    const a = (((phi % (Math.PI / 4)) + Math.PI / 4) % (Math.PI / 4)) - Math.PI / 8
    const oct = Math.cos(Math.PI / 8) / Math.cos(a)
    r *= 0.985 + (oct - 1) * 0.35
    let f = yy / pitch + phi / (Math.PI * 2)
    f -= Math.floor(f)
    r += 0.0007 * Math.pow(f, 0.5) + (f > 0.965 ? (-0.0007 * (f - 0.965)) / 0.035 : 0)
    p.setXYZ(i, r * Math.sin(phi), p.getY(i), r * Math.cos(phi))
  }
  geo.computeVertexNormals()
  return geo
}

function gripBump() {
  const S = 512
  const c = Object.assign(document.createElement('canvas'), { width: S, height: S })
  const g = c.getContext('2d')
  const r = rng(13)
  g.fillStyle = '#808080'
  g.fillRect(0, 0, S, S)
  for (let i = 0; i < 26000; i++) {
    const v = Math.floor(100 + r() * 100)
    g.fillStyle = `rgb(${v},${v},${v})`
    g.beginPath()
    g.arc(r() * S, r() * S, 0.7 + r() * 1.2, 0, Math.PI * 2)
    g.fill()
  }
  // perforations
  g.fillStyle = '#2a2a2a'
  for (let y = 10; y < S; y += 24) {
    for (let x = 12; x < S; x += 24) {
      g.beginPath()
      g.arc(x + ((y / 24) % 2) * 12, y, 2.4, 0, Math.PI * 2)
      g.fill()
    }
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(5, 12)
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

const lathe = (pts, seg = 72) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg)

// sound: the bed's ping, pitched by tension, over the thud of the ball
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
  const f = 240 + tension * 6
  for (const [mul, gain, dec] of [[1, 0.22, 0.22], [2.4, 0.06, 0.09], [4.1, 0.025, 0.05]]) {
    const o = a.createOscillator()
    const g = a.createGain()
    o.frequency.value = f * mul
    g.gain.setValueAtTime(gain * strength, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dec)
    o.connect(g).connect(a.destination)
    o.start(t)
    o.stop(t + dec + 0.02)
  }
  const buf = a.createBuffer(1, Math.floor(a.sampleRate * 0.05), a.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (a.sampleRate * 0.008))
  const src = a.createBufferSource()
  src.buffer = buf
  const lp = a.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 1400
  const g = a.createGain()
  g.gain.value = 0.5 * strength
  src.connect(lp).connect(g).connect(a.destination)
  src.start(t)
}

export default function TennisRacket({
  frame = '#1d2a7a',
  frameTop = '#5cc4f2',
  lettering = '#ffffff',
  strings = '#f3f2ed',
  ink = '#ff4d1a',
  stencil = true,
  grip = '#f2f1ec',
  grommet = '#1a1d2e',
  tension = 55,
  length = 686,
  sound = false,
  slowMotion = 1,
  hitKey = 0,
  twirlKey = 0,
  autoRotate = false,
}) {
  const outer = useRef()
  const head = useRef()
  const [hover, setHover] = useState(false)
  useCursor(hover)
  // junior rackets are scaled-down versions; extended ones a touch longer
  const scale = THREE.MathUtils.clamp(length, 480, 737) / (LEN * 1000)

  const profile = useMemo(() => frameProfile(), [])
  const geos = useMemo(() => {
    const yProfile = { ...profile, pts: profile.pts.map(([n, z]) => [n * 0.85, z * 0.88]) }
    return {
      frame: sweep(framePath(), profile, (u) => 1 + 0.08 * Math.max(0, 1 - Math.min(u, 1 - u) / 0.1)),
      yoke: sweep(yokePath(), yProfile),
      strings: stringGeometry(),
      grip: gripGeometry(),
      bed: new THREE.ShapeGeometry(new THREE.Shape(INNER.map((p) => new THREE.Vector2(p.x, p.y)))),
      collar: lathe([[0.0163, GRIP1 - 0.004], [0.0168, GRIP1 + 0.002], [0.0158, GRIP1 + 0.012], [0.0128, GRIP1 + 0.024], [0.0098, GRIP1 + 0.032], [0.0082, GRIP1 + 0.036]]),
      tape: lathe([[0.016, GRIP1 - 0.016], [0.01725, GRIP1 - 0.0155], [0.0173, GRIP1 - 0.002], [0.0166, GRIP1 - 0.0005]]),
      cap: lathe([[0.0001, 0], [0.0145, 0.0003], [0.0185, 0.0016], [0.0197, 0.004], [0.0197, 0.0075], [0.0192, GRIP0 + 0.004]]),
    }
  }, [profile])
  useEffect(() => () => Object.values(geos).forEach((g) => g.dispose()), [geos])

  const grom = useMemo(() => grommets(grommet), [grommet])
  useEffect(() => () => (grom.geometry.dispose(), grom.material.dispose()), [grom])

  const paint = useMemo(() => frameDecals(frame, frameTop, lettering, profile.front), [frame, frameTop, lettering, profile])
  useEffect(() => () => paint.dispose(), [paint])
  const stencilTex = useMemo(() => stencilMap(strings, ink, stencil), [strings, ink, stencil])
  useEffect(() => () => stencilTex.dispose(), [stencilTex])
  const bump = useMemo(() => gripBump(), [])
  const disc = useMemo(() => logoDisc(ink), [ink])
  useEffect(() => () => (bump.dispose(), disc.dispose()), [bump, disc])

  // the string bed dents and trampolines where it is hit
  const uniforms = useMemo(() => ({ uHit: { value: new THREE.Vector4(0, 0, -1, 0) }, uDepth: { value: 0.01 } }), [])
  const stringMat = useMemo(() => {
    const m = new THREE.MeshPhysicalMaterial({ roughness: 0.4, sheen: 0.5, sheenColor: new THREE.Color('#ffffff'), sheenRoughness: 0.4, clearcoat: 0.3, clearcoatRoughness: 0.3 })
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uHit = uniforms.uHit
      sh.uniforms.uDepth = uniforms.uDepth
      sh.vertexShader = 'uniform vec4 uHit;\nuniform float uDepth;\n' + sh.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        if (uHit.z >= 0.0 && uHit.z < 1.5) {
          vec2 dd = position.xy - uHit.xy;
          float r2 = dot(dd, dd);
          float env = exp(-r2 / 0.0032) * uHit.w;
          float t = uHit.z;
          float dent = smoothstep(0.0, 0.012, t) * exp(-t * 24.0);
          float ring = sin(t * 120.0 - sqrt(r2) * 110.0) * exp(-t * 6.0) * 0.3;
          transformed.z -= uDepth * env * (dent * 1.6 + ring);
        }`,
      )
    }
    m.customProgramCacheKey = () => 'tennis-strings'
    return m
  }, [uniforms])
  useEffect(() => void ((stringMat.map = stencilTex), (stringMat.needsUpdate = true)), [stringMat, stencilTex])
  useEffect(() => () => stringMat.dispose(), [stringMat])
  // lower tension, deeper pocket
  uniforms.uDepth.value = 0.005 + (70 - tension) * 0.00028

  const st = useRef({ hitT: -1, twirl: 0, twirlTo: 0, recoil: -1, t: 0 })
  const snd = useRef(sound)
  snd.current = sound

  const hit = (x, y, strength = 1) => {
    uniforms.uHit.value.set(x, y, 0, strength)
    st.current.hitT = 0
    st.current.recoil = 0
    if (snd.current) ping(tension, strength)
  }
  // a ball on the sweet spot: a little below the middle of the bed
  useEffect(() => void (hitKey && hit((Math.random() - 0.5) * 0.03, YC - 0.02 + (Math.random() - 0.5) * 0.03, 1)), [hitKey])
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
      kick = -0.05 * Math.sin(s.recoil * 20) * Math.exp(-s.recoil * 7)
      if (s.recoil > 1.2) s.recoil = -1
    }
    const g = outer.current
    g.rotation.y = s.twirl + (autoRotate ? 0 : Math.sin(s.t * 0.45) * 0.07)
    g.rotation.x = kick + Math.sin(s.t * 0.6) * 0.012
    g.position.y = Math.sin(s.t * 0.8) * 0.004
  })

  return (
    <group ref={outer}>
      <group scale={scale}>
        <group ref={head} position-y={-0.35}>
          {/* frame: throat arms and hoop in one piece, and the bridge */}
          <mesh geometry={geos.frame} castShadow receiveShadow>
            <meshPhysicalMaterial map={paint} roughness={0.28} metalness={0.15} clearcoat={1} clearcoatRoughness={0.08} />
          </mesh>
          <mesh geometry={geos.yoke} castShadow>
            <meshPhysicalMaterial color={frame} roughness={0.28} metalness={0.15} clearcoat={1} clearcoatRoughness={0.08} />
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
          {/* handle */}
          <mesh geometry={geos.collar} castShadow>
            <meshPhysicalMaterial color={frame} roughness={0.3} metalness={0.15} clearcoat={1} clearcoatRoughness={0.1} />
          </mesh>
          <mesh geometry={geos.grip} position-y={(GRIP0 + GRIP1) / 2} castShadow receiveShadow>
            <meshPhysicalMaterial color={grip} roughness={0.8} bumpMap={bump} bumpScale={1.3} sheen={0.5} sheenColor="#ffffff" sheenRoughness={0.6} />
          </mesh>
          <mesh geometry={geos.tape} castShadow>
            <meshPhysicalMaterial color="#141414" roughness={0.3} clearcoat={0.6} />
          </mesh>
          <mesh geometry={geos.cap} castShadow>
            <meshPhysicalMaterial color={frame} roughness={0.3} clearcoat={0.8} side={THREE.DoubleSide} />
          </mesh>
          <mesh position-y={-0.00005} rotation-x={Math.PI / 2}>
            <circleGeometry args={[0.0145, 48]} />
            <meshPhysicalMaterial map={disc} roughness={0.4} clearcoat={0.5} />
          </mesh>
        </group>
      </group>
    </group>
  )
}
