import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Html, Lightformer, Line, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'

// A real 3D bivariate histogram: raw (x, y) points are binned on an x / y grid on the
// floor, and every non-empty bin becomes a glossy rounded column whose height is its
// count (or its share of all points). Columns are coloured on a sequential ramp, rise
// in a wave from the densest bin outward, and sit in an axis box whose count walls
// move to the sides facing away from the camera. Hover a column to lift it, light up
// its row and column of bins and read its range and count; drag to orbit.
// Data is "x,y; x,y; ..." (or an array of [x, y] / { x, y }); without data a seeded
// demo distribution is drawn from `preset`.

const FONT = '"Poppins", "Nunito", ui-rounded, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif'
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
// springy ease-out with a small overshoot
const pop = (x) => (x >= 1 ? 1 : x <= 0 ? 0 : 1 + 2.2 * (x - 1) ** 3 + 1.2 * (x - 1) ** 2)
function mix(a, b, t) {
  const h = (c) => [1, 3, 5].map((i) => parseInt(String(c).slice(i, i + 2), 16) || 0)
  const [A, B] = [h(a), h(b)]
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('')
}
// tidy ticks covering lo..hi, widened outward to round numbers
function niceTicks(lo, hi, count = 4) {
  if (!(hi > lo)) hi = lo + 1
  const raw = (hi - lo) / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const n = raw / mag
  const step = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag
  const a = Math.floor(lo / step + 1e-9) * step
  const b = Math.ceil(hi / step - 1e-9) * step
  const ticks = []
  for (let t = a; t <= b + step * 1e-6; t += step) ticks.push(Math.abs(t) < step * 1e-6 ? 0 : t)
  return { lo: a, hi: b, step, ticks }
}
const tickFmt = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })

// ---- data -------------------------------------------------------------------------

function parsePoints(data) {
  if (Array.isArray(data))
    return data
      .map((d) => (Array.isArray(d) ? [parseFloat(d[0]), parseFloat(d[1])] : [parseFloat(d?.x), parseFloat(d?.y)]))
      .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y))
  return String(data ?? '')
    .split(/[;\n]/)
    .map((s) => s.split(/[,\s]+/).map(parseFloat).filter(Number.isFinite))
    .filter((r) => r.length >= 2)
    .map((r) => [r[0], r[1]])
}

// seeded random (mulberry32) and a gaussian pair from it (Box-Muller)
function rng(seed) {
  let a = (Math.round(seed) * 2654435761) >>> 0 || 1
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function gauss2(r, mx, my, sx, sy, rho) {
  const u = Math.max(1e-9, r())
  const v = r()
  const m = Math.sqrt(-2 * Math.log(u))
  const a = m * Math.cos(2 * Math.PI * v)
  const b = m * Math.sin(2 * Math.PI * v)
  return [mx + sx * a, my + sy * (rho * a + Math.sqrt(1 - rho * rho) * b)]
}
// built-in distributions: a list of [weight, mx, my, sx, sy, rho] gaussian blobs, or a sampler
const PRESETS = {
  'height-weight': [[0.5, 161, 58, 6.2, 8, 0.45], [0.5, 180, 86, 6.8, 9.4, 0.45]],
  correlated: [[1, 50, 50, 14, 14, 0.82]],
  clusters: [[0.4, 30, 30, 8, 8, 0.2], [0.35, 68, 40, 9, 7, -0.3], [0.25, 48, 74, 7, 8, 0]],
  ring: (r) => {
    const a = r() * Math.PI * 2
    const [d] = gauss2(r, 32, 0, 4.5, 1, 0)
    return [50 + Math.cos(a) * d, 50 + Math.sin(a) * d]
  },
  skewed: (r) => {
    const [a, b] = gauss2(r, 0, 0, 1, 1, 0.6)
    return [20 + Math.exp(a * 0.55) * 14, 30 + b * 9 + Math.exp(a * 0.55) * 6]
  },
}
function demoPoints(preset, n, seed) {
  const r = rng(seed)
  const p = PRESETS[preset] ?? PRESETS['height-weight']
  const out = []
  for (let i = 0; i < n; i++) {
    if (typeof p === 'function') out.push(p(r))
    else {
      let u = r()
      let k = 0
      while (k < p.length - 1 && u > p[k][0]) u -= p[k++][0]
      const [, mx, my, sx, sy, rho] = p[k]
      out.push(gauss2(r, mx, my, sx, sy, rho))
    }
  }
  return out
}

// a round bin width (1, 2, 2.5 or 5 × 10^k) near span / target, and the bins it gives
// covering lo..hi, so every bin edge is a tidy number (like d3's histogram thresholds)
function niceBins(lo, hi, target) {
  if (!(hi > lo)) hi = lo + 1
  const raw = (hi - lo) / target
  const mag = 10 ** Math.floor(Math.log10(raw))
  const n = raw / mag
  const w = (n < 1.5 ? 1 : n < 2.25 ? 2 : n < 3.5 ? 2.5 : n < 7.5 ? 5 : 10) * mag
  const start = Math.floor(lo / w + 1e-9) * w
  const count = Math.floor((hi - start) / w + 1e-9) + 1
  const ticks = niceTicks(start, start + count * w, 4).ticks
  return { lo: start, hi: start + count * w, w, count, ticks }
}

function binPoints(pts, bx, by) {
  const xs = pts.map((p) => p[0])
  const ys = pts.map((p) => p[1])
  const TX = niceBins(Math.min(...xs), Math.max(...xs), bx)
  const TY = niceBins(Math.min(...ys), Math.max(...ys), by)
  const BX = TX.count
  const BY = TY.count
  const counts = new Array(BX * BY).fill(0)
  for (const [x, y] of pts) {
    const i = clamp(Math.floor((x - TX.lo) / TX.w), 0, BX - 1)
    const j = clamp(Math.floor((y - TY.lo) / TY.w), 0, BY - 1)
    counts[j * BX + i]++
  }
  return { TX, TY, dx: TX.w, dy: TY.w, BX, BY, counts }
}

// ---- colour ramps -----------------------------------------------------------------

const RAMPS = {
  sunset: ['#ffe08a', '#ffad3b', '#f2673a', '#c2307a', '#6a2a9a'],
  ocean: ['#c9f0ef', '#6fd0d6', '#2f8fff', '#2c50c8', '#1f2a7a'],
  viridis: ['#fde725', '#5ec962', '#21918c', '#3b528b', '#440154'],
  magma: ['#fcfdbf', '#fc8961', '#b73779', '#51127c', '#1d1147'],
  mono: ['#d5d9e2', '#9aa2b4', '#646d82', '#3a4152', '#1d2230'],
}
function rampAt(stops, t) {
  const f = clamp(t, 0, 1) * (stops.length - 1)
  const i = Math.min(stops.length - 2, Math.floor(f))
  return mix(stops[i], stops[i + 1], f - i)
}

// ---- geometry ---------------------------------------------------------------------

function roundedRect(hx, hz, r) {
  const s = new THREE.Shape()
  r = Math.max(0.002, Math.min(r, hx * 0.95, hz * 0.95))
  s.moveTo(-hx + r, -hz)
  s.lineTo(hx - r, -hz)
  s.absarc(hx - r, -hz + r, r, -Math.PI / 2, 0, false)
  s.lineTo(hx, hz - r)
  s.absarc(hx - r, hz - r, r, 0, Math.PI / 2, false)
  s.lineTo(-hx + r, hz)
  s.absarc(-hx + r, hz - r, r, Math.PI / 2, Math.PI, false)
  s.lineTo(-hx, -hz + r)
  s.absarc(-hx + r, -hz + r, r, Math.PI, Math.PI * 1.5, false)
  return s
}
// a column in two instanced parts so any height keeps a true round bevel: a straight
// body of unit height (scaled in y) and a bevelled cap slab that rides on top of it.
// The cap's lower half tucks inside the body.
function columnGeometry(w, d, bevel) {
  const hx = w / 2
  const hz = d / 2
  const b = clamp(bevel, 0, Math.min(hx, hz) * 0.4)
  const cr = Math.min(hx, hz) * 0.28
  const body = new THREE.ExtrudeGeometry(roundedRect(hx, hz, cr + b), { depth: 1, curveSegments: 5, bevelEnabled: false })
  body.rotateX(-Math.PI / 2)
  const cap = new THREE.ExtrudeGeometry(roundedRect(hx - b, hz - b, cr), {
    depth: 0.0005,
    curveSegments: 5,
    bevelEnabled: b > 0.002,
    bevelThickness: Math.max(b, 0.002),
    bevelSize: b,
    bevelSegments: 4,
  })
  cap.rotateX(-Math.PI / 2)
  return { body, cap, b: Math.max(b, 0.002) }
}

// ---- axis box ---------------------------------------------------------------------

// floor + two back walls with grid lines and tick labels; the walls sit on whichever
// sides face away from the camera (sx, sz are +1 or -1)
function AxisBox({ S, T, map, labels, sides, walls, wallColor, gridColor, binLines, mutedColor, textColor, fmt }) {
  const [SX, SY, SZ] = S
  const { sx, sz } = sides
  const wallX = sx * (SX / 2)
  const backZ = sz * (SZ / 2)
  const front = -backZ
  const near = -wallX
  const inX = wallX - sx * 0.004
  const inZ = backZ - sz * 0.004
  const segs = []
  if (walls) {
    T.y.forEach((v) => {
      const p = map.y(v)
      segs.push([-SX / 2, p, inZ], [SX / 2, p, inZ], [inX, p, -SZ / 2], [inX, p, SZ / 2])
    })
    segs.push([wallX, 0, backZ], [wallX, SY, backZ])
  }
  // axis titles sit in the gap between the two ticks nearest the middle of the edge
  const between = (ts, m) => {
    if (ts.length < 2) return 0
    const ps = ts.map(m).sort((p, q) => p - q)
    let best = 0
    for (let i = 1; i < ps.length - 1; i++) if (Math.abs(ps[i] + ps[i + 1]) < Math.abs(ps[best] + ps[best + 1])) best = i
    return (ps[best] + ps[best + 1]) / 2
  }
  const tick = { fontFamily: FONT, fontSize: 11, fontWeight: 600, color: mutedColor, whiteSpace: 'nowrap', userSelect: 'none' }
  const title = { fontFamily: FONT, fontSize: 12, fontWeight: 700, color: textColor, whiteSpace: 'nowrap', userSelect: 'none' }
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.002, 0]} receiveShadow>
        <planeGeometry args={[SX, SZ]} />
        <meshStandardMaterial color={wallColor} roughness={1} />
      </mesh>
      {binLines && (
        <lineSegments geometry={binLines}>
          <lineBasicMaterial color={gridColor} />
        </lineSegments>
      )}
      {walls && (
        <>
          <mesh position={[0, SY / 2, backZ]}>
            <planeGeometry args={[SX, SY]} />
            <meshStandardMaterial color={wallColor} roughness={1} side={THREE.DoubleSide} transparent opacity={0.8} depthWrite={false} />
          </mesh>
          <mesh position={[wallX, SY / 2, 0]} rotation-y={Math.PI / 2}>
            <planeGeometry args={[SZ, SY]} />
            <meshStandardMaterial color={wallColor} roughness={1} side={THREE.DoubleSide} transparent opacity={0.8} depthWrite={false} />
          </mesh>
          {segs.length > 0 && <Line segments points={segs} color={gridColor} lineWidth={1} />}
          {T.y.map((v, i) => (
            <Html key={`y${i}`} position={[wallX + sx * 0.28, map.y(v), front]} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
              <div style={tick}>{fmt.y(v)}</div>
            </Html>
          ))}
          {labels.y && (
            <Html position={[wallX + sx * 0.28, SY + 0.32, front]} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
              <div style={title}>{labels.y}</div>
            </Html>
          )}
        </>
      )}
      {T.x.map((v, i) => (
        <Html key={`x${i}`} position={[map.x(v), 0, front - sz * 0.3]} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
          <div style={tick}>{fmt.x(v)}</div>
        </Html>
      ))}
      {T.z.map((v, i) => (
        <Html key={`z${i}`} position={[near - sx * 0.34, 0, map.z(v)]} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
          <div style={tick}>{fmt.z(v)}</div>
        </Html>
      ))}
      {labels.x && (
        <Html position={[between(T.x, map.x), 0, front - sz * 0.72]} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
          <div style={title}>{labels.x}</div>
        </Html>
      )}
      {labels.z && (
        <Html position={[near - sx * 0.8, 0, between(T.z, map.z)]} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
          <div style={title}>{labels.z}</div>
        </Html>
      )}
    </group>
  )
}

// camera on the tilt / turn angles, backed off until the box and its labels fit
function Rig({ tilt, turn, S, top, bottom }) {
  const { camera, size, controls } = useThree()
  useEffect(() => {
    const e = (clamp(tilt, 5, 80) * Math.PI) / 180
    const a = (turn * Math.PI) / 180
    const aspect = size.width / Math.max(1, size.height)
    const tanH = Math.tan((camera.fov * Math.PI) / 360)
    const cy = S[1] * 0.4
    // project the box, grown by the tick / title ring on the floor and the scale title on
    // top, onto the view axes and back off until every corner fits; the title and the
    // legend take about 130px of the height
    const dir = new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e))
    const right = new THREE.Vector3(0, 1, 0).cross(dir).normalize()
    const up = dir.clone().cross(right)
    // the free band of the canvas between the title and the legend, in NDC
    const H = Math.max(1, size.height)
    // (a long subtitle wraps to a second line on narrow canvases)
    const b1 = 1 - (2 * (top + 10 + (size.width < 600 && top > 50 ? 18 : 0))) / H
    const b0 = -1 + (2 * (bottom + 10)) / H
    const [X, Z] = [S[0] / 2, S[2] / 2]
    const [hx, hz] = [X + 0.9, Z + 0.9]
    const T = S[1] + 0.7 // room for the scale title and the peak readout
    const pts = [[-hx, 0, -Z], [-hx, 0, Z], [hx, 0, -Z], [hx, 0, Z], [-X, 0, -hz], [X, 0, -hz], [-X, 0, hz], [X, 0, hz], [-X - 0.3, T, -Z], [X + 0.3, T, -Z], [-X - 0.3, T, Z], [X + 0.3, T, Z]].map(([x, y, z]) => {
      const v = new THREE.Vector3(x, y - cy, z)
      return [v.dot(right), v.dot(up), v.dot(dir)]
    })
    // back off until everything fits the width and the free band, and slide the view
    // target up or down (s) so the chart sits centred in that band
    let d = 10
    let s = 0
    for (let it = 0; it < 8; it++) {
      let lo = Infinity
      let hi = -Infinity
      let dw = 1
      for (const [x, y, z] of pts) {
        const k = 1 / (Math.max(0.5, d - z) * tanH)
        lo = Math.min(lo, (y - s) * k)
        hi = Math.max(hi, (y - s) * k)
        dw = Math.max(dw, Math.abs(x) / (tanH * aspect * 0.96) + z)
      }
      d = Math.max(dw, d * ((hi - lo) / Math.max(0.1, b1 - b0)))
      s += ((hi + lo) / 2 - (b1 + b0) / 2) * d * tanH
    }
    const tgt = new THREE.Vector3(0, cy, 0).addScaledVector(up, s)
    camera.position.copy(tgt).addScaledVector(dir, d)
    camera.lookAt(tgt)
    camera.updateProjectionMatrix()
    if (controls) {
      controls.target.copy(tgt)
      controls.update()
    }
  }, [camera, controls, size.width, size.height, tilt, turn, S[0], S[1], S[2], top, bottom]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

// ---- columns ----------------------------------------------------------------------

function Columns({ cells, BX, BY, cw, cd, bevel, gloss, progress, hov, setHov, hoverLift, background }) {
  const { body, cap, b } = useMemo(() => columnGeometry(cw, cd, bevel), [cw, cd, bevel])
  useEffect(() => () => { body.dispose(); cap.dispose() }, [body, cap])
  const mats = useMemo(
    () => [
      // tops: the ramp colour; walls: the same colour 18% darker (instance colour × grey)
      new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.38, envMapIntensity: 0.55, clearcoat: gloss, clearcoatRoughness: 0.18 }),
      new THREE.MeshPhysicalMaterial({ color: '#d1d1d1', roughness: 0.48, envMapIntensity: 0.5, clearcoat: gloss * 0.6, clearcoatRoughness: 0.25 }),
    ],
    [gloss],
  )
  useEffect(() => () => mats.forEach((m) => m.dispose()), [mats])
  const cols = useMemo(() => {
    const bg = new THREE.Color(background)
    return cells.map((c) => {
      const base = new THREE.Color(c.color)
      return { base, dim: base.clone().lerp(bg, 0.68) }
    })
  }, [cells, background])

  const capRef = useRef()
  const bodyRef = useRef()
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const tmp = useMemo(() => new THREE.Color(), [])
  const st = useRef({ up: [], dim: [] })

  useLayoutEffect(() => {
    ;[capRef.current, bodyRef.current].forEach((m) => {
      if (!m) return
      cells.forEach((c, i) => m.setColorAt(i, cols[i].base))
      if (m.instanceColor) m.instanceColor.needsUpdate = true
    })
    st.current = { up: cells.map(() => 0), dim: cells.map(() => 0) }
  }, [cells, cols])

  useFrame((_, dt) => {
    const C = capRef.current
    const B = bodyRef.current
    if (!C || !B) return
    const f = 1 - Math.exp(-dt * 12)
    const p = progress.current
    const s = st.current
    const hc = hov != null ? cells[hov] : null
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i]
      const k = pop(clamp((p - c.t * 0.5) / 0.5, 0, 1))
      const tu = hov === i ? hoverLift : 0
      const td = hc && c.i !== hc.i && c.j !== hc.j ? 1 : 0
      s.up[i] = (s.up[i] ?? 0) + (tu - (s.up[i] ?? 0)) * f
      s.dim[i] = (s.dim[i] ?? 0) + (td - (s.dim[i] ?? 0)) * f
      const h = Math.max(0.0005, c.h * k)
      const y0 = s.up[i]
      if (h >= 2 * b) {
        dummy.position.set(c.x, y0, c.z)
        dummy.scale.set(1, h - b, 1)
        dummy.updateMatrix()
        B.setMatrixAt(i, dummy.matrix)
        dummy.position.set(c.x, y0 + h - b, c.z)
        dummy.scale.set(1, 1, 1)
      } else {
        dummy.position.set(c.x, y0, c.z)
        dummy.scale.set(1, 0.0001, 1)
        dummy.updateMatrix()
        B.setMatrixAt(i, dummy.matrix)
        dummy.position.set(c.x, y0 + h / 2, c.z)
        dummy.scale.set(1, Math.max(0.0001, h / (2 * b)), 1)
      }
      dummy.updateMatrix()
      C.setMatrixAt(i, dummy.matrix)
      tmp.copy(cols[i].base).lerp(cols[i].dim, s.dim[i])
      C.setColorAt(i, tmp)
      B.setColorAt(i, tmp)
    }
    C.instanceMatrix.needsUpdate = true
    B.instanceMatrix.needsUpdate = true
    if (C.instanceColor) C.instanceColor.needsUpdate = true
    if (B.instanceColor) B.instanceColor.needsUpdate = true
    C.boundingSphere = null
    B.boundingSphere = null
  })

  const pick = (e) => {
    e.stopPropagation()
    if (e.instanceId == null) return
    document.body.style.cursor = 'pointer'
    if (hov !== e.instanceId) setHov(e.instanceId)
  }
  const out = () => {
    setHov(null)
    document.body.style.cursor = ''
  }
  const ev = { onPointerOver: pick, onPointerMove: pick, onPointerOut: out }
  return (
    <group key={`${cells.length}-${BX}-${BY}`}>
      <instancedMesh ref={bodyRef} args={[body, mats[1], cells.length]} castShadow receiveShadow frustumCulled={false} {...ev} />
      <instancedMesh ref={capRef} args={[cap, mats[0], cells.length]} castShadow receiveShadow frustumCulled={false} {...ev} />
    </group>
  )
}

// ---- scene ------------------------------------------------------------------------

function Scene(props) {
  const { bins, cells, peak, S, map, TC, xLabel, yLabel, countLabel, showWalls, floorGrid, gap, bevel, gloss, hoverLift, labels, labelColor, animate, duration, autoRotate, interactive, wallColor, gridColor, background, textColor, mutedColor, tilt, turn, fmtV, fmtEdge, total, valueOf, resetKey, hov, setHov, highColor } = props
  const [sides, setSides] = useState({ sx: 1, sz: -1 })
  const [SX, SY, SZ] = S
  const { BX, BY, TX, TY } = bins
  const cw = SX / BX
  const cd = SZ / BY

  // faint grid of every bin edge on the floor, so empty bins still read as cells
  const binLines = useMemo(() => {
    if (!floorGrid) return null
    const seg = []
    for (let i = 0; i <= BX; i++) seg.push(-SX / 2 + i * cw, 0.002, -SZ / 2, -SX / 2 + i * cw, 0.002, SZ / 2)
    for (let j = 0; j <= BY; j++) seg.push(-SX / 2, 0.002, -SZ / 2 + j * cd, SX / 2, 0.002, -SZ / 2 + j * cd)
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(seg), 3))
    return g
  }, [floorGrid, BX, BY, SX, SZ, cw, cd])
  useEffect(() => () => binLines?.dispose(), [binLines])

  const progress = useRef(animate ? 0 : 1)
  const started = useRef(0)
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    progress.current = animate && !reduce ? 0 : 1
    started.current = performance.now()
  }, [animate, resetKey])
  const peakRef = useRef()
  const leadRef = useRef()
  const peakG = useRef()
  const peakDim = useRef(1)
  const lastY = useRef(0)
  const pv = useMemo(() => new THREE.Vector3(), [])
  const pc0 = peak != null ? cells[peak] : null
  const baseY = pc0 ? Math.max(pc0.h + 0.22, SY + 0.32) : 0
  useFrame(({ camera, size }, dt) => {
    // keep the peak readout clear of every column on screen: from above the box top,
    // step it up until no column top under its footprint reaches the label's base
    if (pc0 && peakG.current) {
      const hw = 46 / Math.max(1, size.width)
      let Y = baseY
      for (let it = 0; it < 12; it++) {
        pv.set(pc0.x, Y, pc0.z).project(camera)
        const ax = pv.x
        const ay = pv.y
        let clash = false
        for (let i = 0; i < cells.length && !clash; i++) {
          const c = cells[i]
          if (i === peak) continue
          pv.set(c.x, c.h, c.z).project(camera)
          if (Math.abs(pv.x - ax) < hw * 2 + 0.03 && pv.y > ay - 0.05) clash = true
        }
        if (!clash) break
        Y += 0.12
      }
      Y = Math.min(Y, SY + 1.2)
      peakG.current.position.y = Y
      const L = leadRef.current
      if (L && Math.abs(Y - lastY.current) > 0.005) {
        lastY.current = Y
        L.geometry.setPositions([pc0.x, pc0.h + 0.06, pc0.z, pc0.x, Y - 0.04, pc0.z])
        L.computeLineDistances()
      }
    }
    if (progress.current < 1) progress.current = Math.min(1, (performance.now() - started.current) / Math.max(1, duration))
    const sx = camera.position.x > 0 ? -1 : 1
    const sz = camera.position.z > 0 ? -1 : 1
    if (sx !== sides.sx || sz !== sides.sz) setSides({ sx, sz })
    if (peakRef.current) {
      const f = 1 - Math.exp(-dt * 12)
      peakDim.current += ((hov != null ? 0.4 : 1) - peakDim.current) * f
      const o = clamp((progress.current - 0.62) / 0.3, 0, 1) * peakDim.current
      peakRef.current.style.opacity = String(o)
      if (leadRef.current?.material) leadRef.current.material.opacity = o * 0.8
    }
  })

  const hc = hov != null ? cells[hov] : null
  const pc = pc0
  const peakY = baseY
  // tick labels only inside the binned range
  const inside = (T) => T.ticks.filter((t) => t >= T.lo - 1e-9 && t <= T.hi + 1e-9)

  return (
    <>
      <Rig tilt={tilt} turn={turn} S={S} top={props.topSpace} bottom={props.bottomSpace} />
      <OrbitControls makeDefault enabled={interactive} enablePan={false} enableZoom={false} autoRotate={autoRotate && hov == null} autoRotateSpeed={0.5} minPolarAngle={((90 - clamp(tilt + 25, 15, 85)) * Math.PI) / 180} maxPolarAngle={((90 - clamp(tilt - 20, 6, 80)) * Math.PI) / 180} />
      <AxisBox
        S={S}
        T={{ x: inside(TX), y: TC.ticks, z: inside(TY) }}
        map={map}
        labels={{ x: xLabel, y: countLabel, z: yLabel }}
        sides={sides}
        walls={showWalls}
        wallColor={wallColor}
        gridColor={gridColor}
        binLines={binLines}
        mutedColor={mutedColor}
        textColor={textColor}
        fmt={{ x: (a) => tickFmt.format(a), y: (a) => fmtV(a, true), z: (a) => tickFmt.format(a) }}
      />
      {/* the hovered bin's row and column, lit on the floor */}
      {hc && (
        <>
          <mesh rotation-x={-Math.PI / 2} position={[hc.x, 0.003, 0]}>
            <planeGeometry args={[cw, SZ]} />
            <meshBasicMaterial color={hc.color} transparent opacity={0.16} depthWrite={false} />
          </mesh>
          <mesh rotation-x={-Math.PI / 2} position={[0, 0.003, hc.z]}>
            <planeGeometry args={[SX, cd]} />
            <meshBasicMaterial color={hc.color} transparent opacity={0.16} depthWrite={false} />
          </mesh>
        </>
      )}
      <Columns cells={cells} BX={BX} BY={BY} cw={cw * (1 - clamp(gap, 0, 0.6))} cd={cd * (1 - clamp(gap, 0, 0.6))} bevel={bevel} gloss={gloss} progress={progress} hov={hov} setHov={setHov} hoverLift={hoverLift} background={background} />
      {labels === 'peak' && pc && (
        // the peak readout floats above the top of the box (no column reaches it), on a
        // thin dashed leader from its column
        <group key={peak}>
          <Line ref={leadRef} points={[[pc.x, pc.h + 0.06, pc.z], [pc.x, peakY - 0.04, pc.z]]} color={mutedColor} lineWidth={1.2} dashed dashSize={0.05} gapSize={0.05} transparent opacity={0} />
          <group ref={peakG} position={[pc.x, peakY, pc.z]}>
        <Html zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
          <div ref={peakRef} style={{ opacity: 0, transform: 'translate(-50%, -100%)', textAlign: 'center', fontFamily: FONT, whiteSpace: 'nowrap', userSelect: 'none', textShadow: `0 0 8px ${background}, 0 0 4px ${background}, 0 0 2px ${background}` }}>
            <div style={{ color: labelColor === 'slice' ? highColor : textColor, fontWeight: 600, fontSize: 28, lineHeight: 1, letterSpacing: '-0.02em' }}>{fmtV(valueOf(pc.count))}</div>
            <div style={{ color: mutedColor, fontSize: 12, fontWeight: 600, marginTop: 3 }}>peak bin</div>
          </div>
        </Html>
          </group>
        </group>
      )}
      {hc && (
        <Html position={[hc.x, hc.h + hoverLift + 0.28, hc.z]} center zIndexRange={[30, 20]} style={{ pointerEvents: 'none' }}>
          <div role="tooltip" style={{ fontFamily: FONT, background: textColor, color: '#fff', padding: '6px 10px', borderRadius: 10, fontSize: 12, whiteSpace: 'nowrap', boxShadow: '0 8px 20px -8px #0006', transform: 'translateY(-50%)' }}>
            <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
              <i style={{ width: 9, height: 9, borderRadius: 3, background: hc.color }} />
              {fmtEdge.x(TX.lo + hc.i * bins.dx)}–{fmtEdge.x(TX.lo + (hc.i + 1) * bins.dx)} × {fmtEdge.y(TY.lo + hc.j * bins.dy)}–{fmtEdge.y(TY.lo + (hc.j + 1) * bins.dy)}
            </div>
            <div style={{ opacity: 0.8 }}>
              {hc.count.toLocaleString('en')} {hc.count === 1 ? 'point' : 'points'} ({((hc.count / total) * 100).toFixed(1)}%)
            </div>
          </div>
        </Html>
      )}
    </>
  )
}

export default function Histogram3DChart({
  data = '',
  preset = 'height-weight',
  points = 1500,
  seed = 23,
  bins = 14,
  binsX = 0,
  binsY = 0,
  normalize = false,
  title = 'Height and weight',
  subtitle = '1,500 adults binned by height and weight. Hover a column, drag to orbit',
  xLabel = 'Height (cm)',
  yLabel = 'Weight (kg)',
  countLabel = 'Adults',
  palette = 'custom',
  colorLow = '#ffd98a',
  colorMid = '#ff7a3d',
  colorHigh = '#a93ce0',
  wave = 'center',
  labels = 'peak',
  labelColor = 'slice',
  showWalls = true,
  floorGrid = true,
  showLegend = true,
  tilt = 32,
  turn = 32,
  boxHeight = 2,
  gap = 0.16,
  bevel = 0.03,
  gloss = 0.6,
  hoverLift = 0.25,
  autoRotate = false,
  interactive = true,
  animate = true,
  duration = 1800,
  decimals = 0,
  prefix = '',
  suffix = '',
  background = '#f2f2f3',
  wallColor = '#ffffff',
  gridColor = '#e3e5eb',
  textColor = '#2b2f3a',
  mutedColor = '#8a90a0',
  style,
}) {
  const [hov, setHov] = useState(null)
  // target bin counts; the actual counts follow from rounding the bin width to a tidy number
  const bx = clamp(Math.round(binsX || bins), 2, 40)
  const by = clamp(Math.round(binsY || bins), 2, 40)
  const pts = useMemo(() => {
    const own = parsePoints(data)
    return own.length >= 2 ? own : demoPoints(preset, clamp(Math.round(points), 10, 20000), seed)
  }, [data, preset, points, seed])
  const binned = useMemo(() => binPoints(pts, bx, by), [pts, bx, by])
  const { TX, TY, dx, dy, BX, BY, counts } = binned
  const total = pts.length || 1
  const maxCount = Math.max(1, ...counts)
  const valueOf = (c) => (normalize ? (c / total) * 100 : c)
  const TC = niceTicks(0, valueOf(maxCount), 4)
  const stops = palette === 'custom' ? [colorLow, colorMid, colorHigh] : RAMPS[palette] ?? RAMPS.sunset
  const highColor = stops[stops.length - 1]
  const S = [4, clamp(boxHeight, 0.8, 4), 4 * clamp(BY / BX, 0.5, 2)]
  if (S[2] > 4) {
    S[0] = 16 / S[2]
    S[2] = 4
  }
  const map = {
    x: (a) => ((a - TX.lo) / (TX.hi - TX.lo) - 0.5) * S[0],
    y: (a) => (a / TC.hi) * S[1],
    // larger y values sit further from the viewer, like a floor plot seen from the front
    z: (a) => (0.5 - (a - TY.lo) / (TY.hi - TY.lo)) * S[2],
  }
  const d = clamp(Math.round(decimals), 0, 4)
  const sfx = normalize ? '%' : suffix
  const fmtV = (a, axis) => (axis ? `${normalize ? '' : prefix}${tickFmt.format(a)}${sfx}` : `${normalize ? '' : prefix}${a.toLocaleString('en', { minimumFractionDigits: normalize ? Math.max(1, d) : d, maximumFractionDigits: normalize ? Math.max(1, d) : d })}${sfx}`)
  const edgeDec = (w) => (w >= 1 && Math.abs(w - Math.round(w)) < 1e-9 ? 0 : clamp(Math.ceil(-Math.log10(w)) + 1, 1, 4))
  const fmtEdge = { x: (v) => (+v.toFixed(edgeDec(dx))).toLocaleString('en'), y: (v) => (+v.toFixed(edgeDec(dy))).toLocaleString('en') }

  const { cells, peak } = useMemo(() => {
    let peak = null
    let pi = 0
    let pj = 0
    counts.forEach((c, k) => {
      if (peak == null || c > counts[peak]) peak = k
    })
    if (peak != null) {
      pi = peak % BX
      pj = Math.floor(peak / BX)
    }
    const out = []
    let peakIdx = null
    const maxDist = Math.hypot(Math.max(pi, BX - 1 - pi), Math.max(pj, BY - 1 - pj)) || 1
    counts.forEach((c, k) => {
      if (!c) return
      const i = k % BX
      const j = Math.floor(k / BX)
      const t = wave === 'none' ? 0 : wave === 'diagonal' ? (i + (BY - 1 - j)) / Math.max(1, BX + BY - 2) : wave === 'rows' ? (BY - 1 - j) / Math.max(1, BY - 1) : Math.hypot(i - pi, j - pj) / maxDist
      if (k === peak) peakIdx = out.length
      out.push({
        i,
        j,
        count: c,
        x: (-0.5 + (i + 0.5) / BX) * S[0],
        z: (0.5 - (j + 0.5) / BY) * S[2],
        h: Math.max(0.02, (valueOf(c) / TC.hi) * S[1]),
        t,
        color: rampAt(stops, Math.sqrt(c / maxCount) * 0.15 + (c / maxCount) * 0.85),
      })
    })
    return { cells: out, peak: peakIdx }
  }, [counts, BX, BY, S[0], S[1], S[2], TC.hi, wave, stops.join(), normalize]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => setHov(null), [cells])

  const resetKey = `${data}|${preset}|${points}|${seed}|${BX}|${BY}|${wave}|${normalize}`
  const pc = peak != null ? cells[peak] : null
  const peakRange = pc ? `${fmtEdge.x(TX.lo + pc.i * dx)} to ${fmtEdge.x(TX.lo + (pc.i + 1) * dx)} ${xLabel} and ${fmtEdge.y(TY.lo + pc.j * dy)} to ${fmtEdge.y(TY.lo + (pc.j + 1) * dy)} ${yLabel}` : ''
  const keyBg = `linear-gradient(90deg, ${Array.from({ length: 9 }, (_, i) => rampAt(stops, i / 8)).join(', ')})`

  return (
    <div
      role="img"
      aria-label={`${title}. 3D histogram of ${pts.length} points in ${BX} by ${BY} bins of ${xLabel} and ${yLabel}. ${cells.length} bins are non-empty. ${pc ? `The densest bin, ${peakRange}, holds ${pc.count} points (${((pc.count / total) * 100).toFixed(1)} percent).` : ''}`}
      style={{ position: 'relative', width: '100%', height: '100%', minHeight: 320, background, touchAction: 'none', fontFamily: FONT, overflow: 'hidden', ...style }}
    >
      {(title || subtitle) && (
        <div style={{ position: 'absolute', top: 18, left: 0, right: 0, textAlign: 'center', zIndex: 40, pointerEvents: 'none', padding: '0 16px' }}>
          {title && <div style={{ color: textColor, fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em' }}>{title}</div>}
          {subtitle && <div style={{ color: mutedColor, fontSize: 13, marginTop: 2 }}>{subtitle}</div>}
        </div>
      )}
      <Canvas shadows dpr={[1, 2]} camera={{ fov: 32, position: [6, 5, 8] }} gl={{ antialias: true, toneMapping: THREE.NeutralToneMapping }} onPointerMissed={() => setHov(null)}>
        <color attach="background" args={[background]} />
        <Suspense fallback={null}>
          <Scene
            {...{ bins: { BX, BY, TX, TY, dx, dy }, cells, peak, S, map, TC, xLabel, yLabel, countLabel, showWalls, floorGrid, gap, bevel, gloss, hoverLift, labels, labelColor, animate, duration, autoRotate, interactive, wallColor, gridColor, background, textColor, mutedColor, tilt, turn, fmtV, fmtEdge, total, valueOf, resetKey, hov, setHov, highColor, topSpace: title && subtitle ? 64 : title || subtitle ? 44 : 4, bottomSpace: showLegend ? 34 : 4 }}
          />
          {/* soft studio: a broad top light for the glossy tops, side strips for the walls */}
          <Environment resolution={128}>
            <color attach="background" args={['#d9dadd']} />
            <Lightformer form="rect" intensity={1.3} position={[0, 6, 1]} rotation-x={Math.PI / 2} scale={[10, 6, 1]} />
            <Lightformer form="rect" intensity={1.2} position={[-6, 1, 3]} rotation-y={Math.PI / 2.4} scale={[3, 6, 1]} />
            <Lightformer form="rect" intensity={1.2} position={[6, 1, 3]} rotation-y={-Math.PI / 2.4} scale={[3, 6, 1]} />
          </Environment>
        </Suspense>
        <ambientLight intensity={0.25} />
        <directionalLight position={[3, 9, 5]} intensity={0.9} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-5} shadow-camera-right={5} shadow-camera-top={5} shadow-camera-bottom={-5} shadow-bias={-0.0004} />
        <ContactShadows position={[0, -0.01, 0]} opacity={0.32} scale={12} blur={2.4} far={2} />
      </Canvas>
      {showLegend && (
        <div style={{ position: 'absolute', bottom: 16, left: 0, right: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, zIndex: 40, pointerEvents: 'none', fontSize: 12, fontWeight: 600, color: mutedColor, padding: '0 16px' }}>
          <span>{normalize ? `${+(100 / total).toPrecision(2)}%` : fmtV(1)}</span>
          <i style={{ width: 160, maxWidth: '40%', height: 10, borderRadius: 5, background: keyBg }} />
          <span>{fmtV(valueOf(maxCount))}</span>
          <span style={{ color: textColor, marginLeft: 4 }}>{normalize ? `share of ${countLabel.toLowerCase() || 'points'}` : `${countLabel || 'points'} per bin`}</span>
        </div>
      )}
    </div>
  )
}
