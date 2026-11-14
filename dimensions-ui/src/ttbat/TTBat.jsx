import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useCursor } from '@react-three/drei'
import * as THREE from 'three'

// A shakehand table tennis bat at real size (SI units: metres). A 5-ply
// blade (thin outer veneers, darker inner plies, a soft core) cut to the
// classic rounded head with sloping shoulders that run into the handle. On
// each face sits an inverted rubber: an orange sponge under a smooth, tacky
// topsheet with a softly rounded edge, trimmed straight across above the
// handle, with the maker's logo panel pressed into the rubber. Red on the
// forehand, black on the backhand. The flared (FL) handle is two lacquered
// cheeks with a laminated centre strip and a badge carrying the brand.
// Click the bat to flip it over.
//
// Bat frame: the head's centre at the origin, the forehand face looking
// along +z, the handle hanging down -y.

const HEAD_A = 0.0785 // half the head's width (157 mm across)
const HEAD_B = 0.0775 // half its height
const HEAD_N = 2.3 // superellipse exponent: a touch squarer than an ellipse
const CUT_Y = -0.058 // the rubber is trimmed straight across here
const SHOULDER_Y = -0.06 // the blade leaves the head outline here...
const NECK_Y = -0.096 // ...and has narrowed to the tang here
const NECK_W = 0.0132 // half-width of the tang inside the handle
const TANG_Y = -0.15
const BLADE_T = 0.0058
const PLIES = [
  [0.0007, 'outer'],
  [0.0004, 'inner'],
  [0.0036, 'core'],
  [0.0004, 'inner'],
  [0.0007, 'outer'],
]
const SPONGE_T = 0.0017
const TOP_T = 0.0006
const H_TOP = -0.0605
const H_BOT = -0.162
const H_N = 3 // handle cross-section: a rounded rectangle
const H_P = 0.125 // longer than any handle cross-section's perimeter (uv scale)

export const BAT_BOUNDS = { top: HEAD_B, bottom: H_BOT }

const sp = (c, e) => Math.sign(c) * Math.abs(c) ** e
const headPoint = (th) => [HEAD_A * sp(Math.cos(th), 2 / HEAD_N), HEAD_B * sp(Math.sin(th), 2 / HEAD_N)]
const headHalf = (y) => HEAD_A * Math.max(0, 1 - Math.abs(y / HEAD_B) ** HEAD_N) ** (1 / HEAD_N)
// the angle on the right side of the head where it crosses height y (y < 0)
const thetaAt = (y) => Math.asin(-((Math.abs(y) / HEAD_B) ** (HEAD_N / 2)))

function bladeHalf(y) {
  if (y >= SHOULDER_Y) return headHalf(y)
  if (y <= NECK_Y) return NECK_W
  const s = (SHOULDER_Y - y) / (SHOULDER_Y - NECK_Y)
  return NECK_W + (headHalf(SHOULDER_Y) - NECK_W) * (1 - s) ** 1.4
}

function headArc(shape, yFrom, seg, first) {
  const t0 = thetaAt(yFrom)
  const t1 = Math.PI - t0
  for (let i = 0; i <= seg; i++) {
    const [x, y] = headPoint(t0 + ((t1 - t0) * i) / seg)
    if (first && i === 0) shape.moveTo(x, y)
    else shape.lineTo(x, y)
  }
}

function rubberShape() {
  const s = new THREE.Shape()
  headArc(s, CUT_Y, 200, true)
  s.closePath()
  return s
}

function bladeShape() {
  const s = new THREE.Shape()
  s.moveTo(NECK_W, TANG_Y)
  // up the right shoulder
  for (let i = 0; i <= 30; i++) {
    const y = NECK_Y + ((SHOULDER_Y - NECK_Y) * i) / 30
    s.lineTo(bladeHalf(y), y)
  }
  headArc(s, SHOULDER_Y, 200, false)
  // down the left shoulder
  for (let i = 0; i <= 30; i++) {
    const y = SHOULDER_Y + ((NECK_Y - SHOULDER_Y) * i) / 30
    s.lineTo(-bladeHalf(y), y)
  }
  s.lineTo(-NECK_W, TANG_Y)
  s.closePath()
  return s
}

// ---- the flared handle: a lofted rounded-rectangle tube -------------------

function handleHalfW(y) {
  const s = (H_TOP - y) / (H_TOP - H_BOT)
  const flare = THREE.MathUtils.smoothstep(s, 0.45, 1)
  return 0.0155 - 0.0014 * Math.sin(Math.PI * Math.min(1, s / 0.55)) + 0.003 * flare ** 1.4
}
const handleHalfT = (y) => 0.0112 + 0.0008 * ((H_TOP - y) / (H_TOP - H_BOT))

function buildHandle() {
  const SEG = 64 // per half of the ring
  const ROWS = 110
  const R_END = 0.006 // the butt is rounded over this length
  const pos = []
  const uv = []
  const idx = []
  const ring = (y, half) => {
    let w = handleHalfW(y)
    let t = handleHalfT(y)
    const k = Math.max(0, (H_BOT + R_END - y) / R_END)
    const shrink = R_END * (1 - Math.sqrt(Math.max(0, 1 - k * k)))
    w -= shrink
    t -= shrink
    const pts = []
    for (let c = 0; c <= SEG; c++) {
      const ph = Math.PI * half + (Math.PI * c) / SEG
      pts.push([-w * sp(Math.cos(ph), 2 / H_N), t * sp(Math.sin(ph), 2 / H_N)])
    }
    return pts
  }
  for (const half of [0, 1]) {
    const base = pos.length / 3
    for (let r = 0; r <= ROWS; r++) {
      const y = H_TOP + ((H_BOT - H_TOP) * r) / ROWS
      const pts = ring(y, half)
      // arc length from the start of this half, so the texture keeps its
      // true width in metres however wide the handle is at this height
      const acc = [0]
      for (let c = 1; c <= SEG; c++) acc.push(acc[c - 1] + Math.hypot(pts[c][0] - pts[c - 1][0], pts[c][1] - pts[c - 1][1]))
      const mid = acc[SEG] / 2
      const v = (y - H_BOT) / (H_TOP - H_BOT)
      for (let c = 0; c <= SEG; c++) {
        pos.push(pts[c][0], y, pts[c][1])
        uv.push((half ? 0.75 : 0.25) + (acc[c] - mid) / H_P, v)
      }
    }
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < SEG; c++) {
        const a = base + r * (SEG + 1) + c
        const b = a + SEG + 1
        idx.push(a, b, a + 1, a + 1, b, b + 1)
      }
  }
  // flat caps at both ends (the butt's is small: its edges are rounded off)
  for (const [y, up] of [[H_TOP, true], [H_BOT, false]]) {
    const pts = [...ring(y, 0).slice(0, -1), ...ring(y, 1).slice(0, -1)]
    const c0 = pos.length / 3
    pos.push(0, y, 0)
    uv.push(0.5, up ? 1 : 0)
    for (const [x, z] of pts) {
      pos.push(x, y, z)
      uv.push(0.5, up ? 1 : 0)
    }
    const n = pts.length
    for (let i = 0; i < n; i++) {
      const p = c0 + 1 + i
      const q = c0 + 1 + ((i + 1) % n)
      if (up) idx.push(c0, p, q)
      else idx.push(c0, q, p)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

// ---- painted textures ------------------------------------------------------

function rng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

// blonde limba grain running along the bat (world uv: metres)
function woodTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 512
  const g = c.getContext('2d')
  const r = rng(7)
  g.fillStyle = '#ffffff'
  g.fillRect(0, 0, 512, 512)
  for (let i = 0; i < 260; i++) {
    const x = r() * 512
    g.strokeStyle = `rgba(120,80,30,${0.03 + r() * 0.08})`
    g.lineWidth = 0.5 + r() * 2.2
    g.beginPath()
    g.moveTo(x, 0)
    const wob = (r() - 0.5) * 14
    g.bezierCurveTo(x + wob, 170, x - wob, 340, x + wob * 0.5, 512)
    g.stroke()
  }
  for (let i = 0; i < 2000; i++) {
    g.fillStyle = `rgba(110,70,25,${r() * 0.06})`
    g.fillRect(r() * 512, r() * 512, 1, 2 + r() * 6)
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(1 / 0.09, 1 / 0.2)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

// the rubber's face: its colour, a faint mottle, and the logo panel pressed
// in just above the trim line
const RW = 0.16
const RH = HEAD_B - CUT_Y
function rubberTexture(color, brand, seed) {
  const ppm = 6400
  const c = document.createElement('canvas')
  c.width = Math.round(RW * ppm)
  c.height = Math.round(RH * ppm)
  const g = c.getContext('2d')
  const r = rng(seed)
  g.fillStyle = color
  g.fillRect(0, 0, c.width, c.height)
  for (let i = 0; i < 9000; i++) {
    g.fillStyle = r() < 0.5 ? `rgba(255,255,255,${r() * 0.035})` : `rgba(0,0,0,${r() * 0.045})`
    const s = 1 + r() * 3
    g.fillRect(r() * c.width, r() * c.height, s, s)
  }
  // draw in metres, bat coordinates (y up)
  g.setTransform(ppm, 0, 0, -ppm, (RW / 2) * ppm, HEAD_B * ppm)
  const y0 = CUT_Y + 0.0012
  const y1 = CUT_Y + 0.0128
  const x0 = 0.047
  const ch = 0.004
  const panel = () => {
    g.beginPath()
    g.moveTo(-x0, y0)
    g.lineTo(x0, y0)
    g.lineTo(x0, y1 - ch)
    g.lineTo(x0 - ch, y1)
    g.lineTo(-x0 + ch, y1)
    g.lineTo(-x0, y1 - ch)
    g.closePath()
  }
  panel()
  g.fillStyle = 'rgba(0,0,0,0.09)'
  g.fill()
  g.lineWidth = 0.00028
  g.strokeStyle = 'rgba(255,255,255,0.2)'
  g.stroke()
  // embossed text: a light lip under a dark letter reads as pressed in
  // (text is set in pixels: fonts a few thousandths of a pixel tall under a
  // big transform don't render reliably in every browser)
  const text = (str, x, y, size, weight = 700, align = 'left', spacing = 0) => {
    g.save()
    g.setTransform(1, 0, 0, 1, (x + RW / 2) * ppm, (HEAD_B - y) * ppm)
    g.font = `${weight} ${size * ppm}px "Helvetica Neue", Arial, sans-serif`
    g.textAlign = align
    g.textBaseline = 'alphabetic'
    if ('letterSpacing' in g) g.letterSpacing = `${spacing * ppm}px`
    g.fillStyle = 'rgba(255,255,255,0.2)'
    g.fillText(str, 0, size * ppm * 0.06)
    g.fillStyle = 'rgba(0,0,0,0.32)'
    g.fillText(str, 0, 0)
    g.restore()
  }
  // left: an approval-style box with the blade code
  g.lineWidth = 0.00025
  g.strokeStyle = 'rgba(0,0,0,0.3)'
  g.strokeRect(-0.043, y0 + 0.0018, 0.036, 0.0078)
  text(brand, -0.0405, y0 + 0.0042, 0.0048, 800, 'left')
  text('R-253·05', -0.0095, y0 + 0.0042, 0.0042, 500, 'right')
  // right: the wordmark, and the rubber's name under it
  text(brand, 0.006, y0 + 0.0058, 0.0062, 800, 'left', 0.0003)
  text('SPIN · 2.0 mm', 0.006, y0 + 0.0021, 0.0026, 600, 'left', 0.0002)
  text('TT', 0.0425, y0 + 0.0021, 0.0026, 700, 'right')
  const t = new THREE.CanvasTexture(c)
  // world uv (x, y) -> canvas
  t.repeat.set(1 / RW, 1 / RH)
  t.offset.set(0.5, -CUT_Y / RH)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

// the handle, unrolled: the forehand side on the left half, the backhand on
// the right, each with the laminated strip and the brand badge
function handleTexture({ handle, accent, cream, brand }) {
  const c = document.createElement('canvas')
  c.width = 2048
  c.height = 1024
  const g = c.getContext('2d')
  const r = rng(11)
  const ppmU = c.width / H_P
  const ppmV = c.height / (H_TOP - H_BOT)
  g.fillStyle = handle
  g.fillRect(0, 0, c.width, c.height)
  // stained-wood grain on the cheeks
  for (let i = 0; i < 700; i++) {
    const x = r() * c.width
    g.strokeStyle = r() < 0.5 ? `rgba(255,255,255,${0.015 + r() * 0.03})` : `rgba(0,0,0,${0.04 + r() * 0.08})`
    g.lineWidth = 0.6 + r() * 2.5
    g.beginPath()
    g.moveTo(x, 0)
    g.bezierCurveTo(x + (r() - 0.5) * 10, 340, x + (r() - 0.5) * 10, 680, x + (r() - 0.5) * 6, 1024)
    g.stroke()
  }
  for (const cx of [0.25, 0.75]) {
    // metres: x across from the centre line, y down from the handle's top
    g.setTransform(ppmU, 0, 0, ppmV, cx * c.width, 0)
    const L = H_TOP - H_BOT
    const strip = (a, b, col) => {
      g.fillStyle = col
      g.fillRect(a, 0, b - a, L)
      g.fillRect(-b, 0, b - a, L)
    }
    strip(0.0047, 0.0063, cream)
    strip(0.0063, 0.0067, 'rgba(0,0,0,0.55)')
    strip(0.0036, 0.0047, accent)
    g.fillStyle = '#121315'
    g.fillRect(-0.0036, 0, 0.0072, L)
    // faint lengthwise grain on the strips
    for (let i = 0; i < 80; i++) {
      g.fillStyle = `rgba(0,0,0,${r() * 0.12})`
      g.fillRect((r() - 0.5) * 0.0134, 0, 0.00008, L)
    }
    // the badge
    const by = 0.056
    const bh = 0.03
    const bw = 0.0046
    g.beginPath()
    g.roundRect(-bw / 2, by, bw, bh, bw / 2)
    g.fillStyle = '#08090a'
    g.fill()
    g.lineWidth = 0.0003
    g.strokeStyle = 'rgba(225,225,225,0.85)'
    g.stroke()
    // the brand reads down the badge; set in v-pixels, with the glyphs'
    // height mapped onto u so they keep their true shape on the handle
    g.save()
    g.setTransform(0, 1, -ppmU / ppmV, 0, cx * c.width, (by + bh / 2) * ppmV)
    g.font = `800 ${0.0034 * ppmV}px "Helvetica Neue", Arial, sans-serif`
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    if ('letterSpacing' in g) g.letterSpacing = `${0.0006 * ppmV}px`
    g.fillStyle = '#f2f2f0'
    g.fillText(brand, 0, 0)
    g.restore()
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

// ---- the bat ---------------------------------------------------------------

export default function TTBat({
  forehand = '#d3121b',
  backhand = '#151515',
  sponge = '#e9a63c',
  handle = '#25272b',
  accent = '#3f7fd4',
  cream = '#ece3cf',
  wood = '#e6cc9c',
  brand = 'RD',
  flipKey = 0,
}) {
  const group = useRef()
  const [hover, setHover] = useState(false)
  useCursor(hover)

  const geo = useMemo(() => {
    const blade = bladeShape()
    const rub = rubberShape()
    const BT = 0.00022
    const BS = 0.0004
    return {
      plies: PLIES.map(([t]) => new THREE.ExtrudeGeometry(blade, { depth: t, bevelEnabled: false, curveSegments: 1 })),
      sponge: new THREE.ExtrudeGeometry(rub, { depth: SPONGE_T, bevelEnabled: false, curveSegments: 1 }),
      top: new THREE.ExtrudeGeometry(rub, { depth: TOP_T - 2 * BT, bevelEnabled: true, bevelThickness: BT, bevelSize: BS, bevelOffset: -BS, bevelSegments: 3, curveSegments: 1 }),
      topZ: BLADE_T / 2 + SPONGE_T + BT,
      handle: buildHandle(),
    }
  }, [])
  useEffect(() => () => [...geo.plies, geo.sponge, geo.top, geo.handle].forEach((g) => g.dispose()), [geo])

  const grain = useMemo(() => woodTexture(), [])
  const woodMats = useMemo(() => {
    const base = new THREE.Color(wood)
    const mk = (col, rough) => new THREE.MeshStandardMaterial({ color: col, map: grain, roughness: rough })
    return {
      outer: mk(base, 0.62),
      inner: mk(base.clone().multiplyScalar(0.72), 0.75),
      core: mk(base.clone().lerp(new THREE.Color('#fff4dc'), 0.35), 0.8),
    }
  }, [wood, grain])

  const rubberMats = useMemo(() => {
    const side = (color, seed) => {
      const map = rubberTexture(color, brand, seed)
      // smooth, slightly tacky inverted rubber: a soft sheen, not a gloss
      const face = new THREE.MeshPhysicalMaterial({ map, roughness: 0.46, clearcoat: 0.35, clearcoatRoughness: 0.42, sheen: 0.25, sheenRoughness: 0.5, sheenColor: new THREE.Color(color).lerp(new THREE.Color('#fff'), 0.4) })
      const edge = new THREE.MeshPhysicalMaterial({ color, roughness: 0.5, clearcoat: 0.2 })
      return [face, edge]
    }
    return { fh: side(forehand, 3), bh: side(backhand, 5) }
  }, [forehand, backhand, brand])
  const spongeMat = useMemo(() => new THREE.MeshStandardMaterial({ color: sponge, roughness: 0.95 }), [sponge])

  const handleMat = useMemo(
    () => new THREE.MeshPhysicalMaterial({ map: handleTexture({ handle, accent, cream, brand }), roughness: 0.42, clearcoat: 0.7, clearcoatRoughness: 0.22 }),
    [handle, accent, cream, brand],
  )

  useEffect(() => {
    const all = [...Object.values(woodMats), ...rubberMats.fh, ...rubberMats.bh, spongeMat, handleMat]
    return () => all.forEach((m) => {
      if (m.map && m.map !== grain) m.map.dispose()
      m.dispose()
    })
  }, [woodMats, rubberMats, spongeMat, handleMat, grain])

  // flipping: a damped spring on the turn about the handle
  const turn = useRef({ a: 0, w: 0, goal: 0 })
  const flip = () => (turn.current.goal += Math.PI)
  useEffect(() => {
    if (flipKey) flip()
  }, [flipKey])

  useFrame((state, delta) => {
    const dt = Math.min(1 / 30, delta)
    const s = turn.current
    s.w += ((s.goal - s.a) * 70 - s.w * 11) * dt
    s.a += s.w * dt
    const t = state.clock.elapsedTime
    const g = group.current
    g.rotation.y = s.a + Math.sin(t * 0.5) * 0.06
    g.rotation.z = Math.sin(t * 0.37) * 0.025
    g.rotation.x = Math.sin(t * 0.43) * 0.03 - 0.04
    g.position.y = Math.sin(t * 0.8) * 0.002
  })

  // stack the plies from the backhand side forward
  let z = -BLADE_T / 2
  const plyMeshes = PLIES.map(([t, kind], i) => {
    const m = <mesh key={i} geometry={geo.plies[i]} material={woodMats[kind]} position={[0, 0, z]} castShadow receiveShadow />
    z += t
    return m
  })
  const rubber = (mats) => (
    <>
      <mesh geometry={geo.sponge} material={spongeMat} position={[0, 0, BLADE_T / 2]} />
      <mesh geometry={geo.top} material={mats} position={[0, 0, geo.topZ]} castShadow receiveShadow />
    </>
  )

  return (
    <group
      ref={group}
      onClick={(e) => {
        e.stopPropagation()
        if (e.delta > 4) return // it was an orbit drag, not a click
        flip()
      }}
      onPointerOver={(e) => (e.stopPropagation(), setHover(true))}
      onPointerOut={() => setHover(false)}
    >
      {plyMeshes}
      {rubber(rubberMats.fh)}
      {/* the backhand rubber: the same pieces turned to face the other way */}
      <group rotation-y={Math.PI}>{rubber(rubberMats.bh)}</group>
      <mesh geometry={geo.handle} material={handleMat} castShadow receiveShadow />
    </group>
  )
}
