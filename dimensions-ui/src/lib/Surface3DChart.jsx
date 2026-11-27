import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, Html, Lightformer, Line, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'

// A real 3D surface plot: a grid of values becomes a smooth terrain inside an x / y / z
// box, coloured by height on a sequential or diverging ramp (or in stepped bands like
// contours), with grid lines on the surface and a faint heatmap of it on the floor.
// The terrain rises out of the floor on load. Hover anywhere on it to read the value
// at that point; drag to orbit. Pick a built-in `preset`, or pass `data` as rows of
// numbers: "1,2,3; 2,4,6; 3,6,9" (rows run along z, columns along x).

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
  return { lo: a, hi: b, ticks }
}
const tickFmt = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })

// built-in surfaces: [x range, z range, f(x, z)]
const PRESETS = {
  peaks: [[-3, 3], [-3, 3], (x, z) => 3 * (1 - x) ** 2 * Math.exp(-(x ** 2) - (z + 1) ** 2) - 10 * (x / 5 - x ** 3 - z ** 5) * Math.exp(-(x ** 2) - z ** 2) - Math.exp(-((x + 1) ** 2) - z ** 2) / 3],
  ripple: [[-8, 8], [-8, 8], (x, z) => { const r = Math.hypot(x, z) || 1e-6; return (Math.sin(r * 1.6) / r) * 6 }],
  saddle: [[-2, 2], [-2, 2], (x, z) => x * x - z * z],
  waves: [[-6, 6], [-6, 6], (x, z) => Math.sin(x) * Math.cos(z * 0.8) * 2],
  hills: [[0, 10], [0, 10], (x, z) => 4 * Math.exp(-((x - 3) ** 2 + (z - 3) ** 2) / 4) + 6 * Math.exp(-((x - 7) ** 2 + (z - 6) ** 2) / 6) + 2.5 * Math.exp(-((x - 4) ** 2 + (z - 8) ** 2) / 3)],
}

function buildGrid(data, preset, res) {
  const rows = String(data ?? '')
    .split(/[;\n]/)
    .map((r) => r.split(/[,\s]+/).map(parseFloat).filter(Number.isFinite))
    .filter((r) => r.length)
  if (rows.length >= 2 && rows[0].length >= 2) {
    const nx = Math.min(...rows.map((r) => r.length))
    return { nx, nz: rows.length, xr: [0, nx - 1], zr: [0, rows.length - 1], v: rows.map((r) => r.slice(0, nx)) }
  }
  const [xr, zr, f] = PRESETS[preset] ?? PRESETS.peaks
  const n = clamp(Math.round(res), 8, 160)
  const v = Array.from({ length: n }, (_, j) => Array.from({ length: n }, (_, i) => f(xr[0] + ((xr[1] - xr[0]) * i) / (n - 1), zr[0] + ((zr[1] - zr[0]) * j) / (n - 1))))
  return { nx: n, nz: n, xr, zr, v }
}

// floor + two back walls with grid lines and tick labels; the walls sit on whichever
// sides face away from the camera (sx, sz are +1 or -1)
function AxisBox({ S, T, map, labels, sides, wallColor, gridColor, mutedColor, textColor, fmt }) {
  const [SX, SY, SZ] = S
  const { sx, sz } = sides
  const wallX = sx * (SX / 2)
  const backZ = sz * (SZ / 2)
  const front = -backZ
  const near = -wallX
  const inX = wallX - sx * 0.004
  const inZ = backZ - sz * 0.004
  const segs = []
  T.x.forEach((v) => {
    const p = map.x(v)
    segs.push([p, 0, inZ], [p, SY, inZ])
  })
  T.z.forEach((v) => {
    const p = map.z(v)
    segs.push([inX, 0, p], [inX, SY, p])
  })
  T.y.forEach((v) => {
    const p = map.y(v)
    segs.push([-SX / 2, p, inZ], [SX / 2, p, inZ], [inX, p, -SZ / 2], [inX, p, SZ / 2])
  })
  const tick = { fontFamily: FONT, fontSize: 11, fontWeight: 600, color: mutedColor, whiteSpace: 'nowrap', userSelect: 'none' }
  const title = { fontFamily: FONT, fontSize: 12, fontWeight: 700, color: textColor, whiteSpace: 'nowrap', userSelect: 'none' }
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.002, 0]}>
        <planeGeometry args={[SX, SZ]} />
        <meshStandardMaterial color={wallColor} roughness={1} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, SY / 2, backZ]}>
        <planeGeometry args={[SX, SY]} />
        <meshStandardMaterial color={wallColor} roughness={1} side={THREE.DoubleSide} transparent opacity={0.85} />
      </mesh>
      <mesh position={[wallX, SY / 2, 0]} rotation-y={Math.PI / 2}>
        <planeGeometry args={[SZ, SY]} />
        <meshStandardMaterial color={wallColor} roughness={1} side={THREE.DoubleSide} transparent opacity={0.85} />
      </mesh>
      <Line segments points={segs} color={gridColor} lineWidth={1} />
      {T.x.map((v, i) => (
        <Html key={`x${i}`} position={[map.x(v), 0, front - sz * 0.32]} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
          <div style={tick}>{fmt.x(v)}</div>
        </Html>
      ))}
      {T.z.map((v, i) => (
        <Html key={`z${i}`} position={[near - sx * 0.36, 0, map.z(v)]} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
          <div style={tick}>{fmt.z(v)}</div>
        </Html>
      ))}
      {T.y.map((v, i) => (
        <Html key={`y${i}`} position={[wallX + sx * 0.3, map.y(v), front]} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
          <div style={tick}>{fmt.y(v)}</div>
        </Html>
      ))}
      {labels.x && (
        <Html position={[0, 0, front - sz * 0.75]} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
          <div style={title}>{labels.x}</div>
        </Html>
      )}
      {labels.z && (
        <Html position={[near - sx * 0.85, 0, 0]} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
          <div style={title}>{labels.z}</div>
        </Html>
      )}
      {labels.y && (
        <Html position={[wallX + sx * 0.3, SY + 0.38, front]} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
          <div style={title}>{labels.y}</div>
        </Html>
      )}
    </group>
  )
}

// camera on the tilt / turn angles, backed off to fit the box and its labels
function Rig({ tilt, turn, S }) {
  const { camera, size, controls } = useThree()
  useEffect(() => {
    const e = (clamp(tilt, 5, 80) * Math.PI) / 180
    const a = (turn * Math.PI) / 180
    const aspect = size.width / Math.max(1, size.height)
    const tanH = Math.tan((camera.fov * Math.PI) / 360)
    const rad = 0.5 * Math.hypot(S[0] + 1.4, S[1] + 0.8, S[2] + 1.4)
    const d = (rad * 1.02) / (tanH * Math.min(aspect, 1.15))
    const cy = S[1] * 0.4
    camera.position.set(Math.sin(a) * Math.cos(e) * d, cy + Math.sin(e) * d, Math.cos(a) * Math.cos(e) * d)
    camera.lookAt(0, cy, 0)
    camera.updateProjectionMatrix()
    if (controls) {
      controls.target.set(0, cy, 0)
      controls.update()
    }
  }, [camera, controls, size.width, size.height, tilt, turn, S[0], S[1], S[2]]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

// value -> colour: sequential (one hue, light to dark), diverging (two hues meeting at a
// neutral grey at zero), optionally quantised into `steps` bands
function makeRamp({ scale, lo, hi, steps, color, color2, background, mutedColor }) {
  const div = scale === 'diverging' || (scale === 'auto' && lo < 0 && hi > 0)
  const neutral = mix(background, mutedColor, 0.22)
  const light = mix(background, color, 0.12)
  const q = (t) => (steps > 1 ? Math.min(steps - 1, Math.floor(t * steps)) / (steps - 1) : t)
  if (div) {
    const m = Math.max(Math.abs(lo), Math.abs(hi)) || 1
    return { div: true, at: (v) => { const t = q((clamp(v / m, -1, 1) + 1) / 2) * 2 - 1; return t < 0 ? mix(neutral, color2, -t) : mix(neutral, color, t) }, m }
  }
  return { div: false, at: (v) => mix(light, color, q(clamp((v - lo) / (hi - lo || 1), 0, 1))) }
}

function Scene(props) {
  const { grid, S, xLabel, yLabel, zLabel, ramp, steps, TY, gridLines, floorMap, gloss, animate, duration, autoRotate, interactive, wallColor, gridColor, lineColor, textColor, mutedColor, tilt, turn, fmt } = props
  const [hov, setHov] = useState(null)
  const [sides, setSides] = useState({ sx: 1, sz: -1 })
  const [SX, SY, SZ] = S
  const { nx, nz, xr, zr, v } = grid
  const TX = niceTicks(xr[0], xr[1])
  const TZ = niceTicks(zr[0], zr[1])
  const map = {
    x: (a) => ((a - xr[0]) / (xr[1] - xr[0] || 1) - 0.5) * SX,
    y: (a) => ((a - TY.lo) / (TY.hi - TY.lo)) * SY,
    z: (a) => ((a - zr[0]) / (zr[1] - zr[0] || 1) - 0.5) * SZ,
  }
  // ticks inside the data range only (the surface spans exactly xr / zr)
  const inside = (T, r) => T.ticks.filter((t) => t >= r[0] - 1e-9 && t <= r[1] + 1e-9)

  const { surf, floor, lines } = useMemo(() => {
    const pos = new Float32Array(nx * nz * 3)
    const flat = new Float32Array(nx * nz * 3)
    const col = new Float32Array(nx * nz * 3)
    const c = new THREE.Color()
    for (let j = 0; j < nz; j++)
      for (let i = 0; i < nx; i++) {
        const k = j * nx + i
        const X = map.x(xr[0] + ((xr[1] - xr[0]) * i) / (nx - 1))
        const Z = map.z(zr[0] + ((zr[1] - zr[0]) * j) / (nz - 1))
        pos.set([X, map.y(v[j][i]), Z], k * 3)
        flat.set([X, 0.004, Z], k * 3)
        c.set(ramp.at(v[j][i]))
        col.set([c.r, c.g, c.b], k * 3)
      }
    const idx = []
    for (let j = 0; j < nz - 1; j++)
      for (let i = 0; i < nx - 1; i++) {
        const a = j * nx + i
        idx.push(a, a + nx, a + 1, a + 1, a + nx, a + nx + 1)
      }
    let surf = new THREE.BufferGeometry()
    surf.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    surf.setAttribute('color', new THREE.BufferAttribute(col, 3))
    surf.setIndex(idx)
    surf.computeVertexNormals()
    // stepped bands: give every triangle one flat colour from its average value, so the
    // band edges stay crisp instead of blending across the triangle
    if (steps > 1) {
      const smooth = surf
      surf = smooth.toNonIndexed()
      smooth.dispose()
      const P = surf.getAttribute('position')
      const C = surf.getAttribute('color')
      const span = TY.hi - TY.lo
      for (let f = 0; f < P.count; f += 3) {
        const y = (P.getY(f) + P.getY(f + 1) + P.getY(f + 2)) / 3
        c.set(ramp.at(TY.lo + (y / SY) * span))
        for (let q = 0; q < 3; q++) C.setXYZ(f + q, c.r, c.g, c.b)
      }
      C.needsUpdate = true
    }
    const floor = new THREE.BufferGeometry()
    floor.setAttribute('position', new THREE.BufferAttribute(flat, 3))
    floor.setAttribute('color', new THREE.BufferAttribute(col, 3))
    floor.setIndex(idx)
    // grid lines on the surface, about a dozen each way, lifted a hair to avoid flicker
    const every = Math.max(1, Math.round(Math.max(nx, nz) / 12))
    const seg = []
    const P = (i, j) => [pos[(j * nx + i) * 3], pos[(j * nx + i) * 3 + 1] + 0.008, pos[(j * nx + i) * 3 + 2]]
    for (let j = 0; j < nz; j += every) for (let i = 0; i < nx - 1; i++) seg.push(...P(i, j), ...P(i + 1, j))
    for (let i = 0; i < nx; i += every) for (let j = 0; j < nz - 1; j++) seg.push(...P(i, j), ...P(i, j + 1))
    const lines = new THREE.BufferGeometry()
    lines.setAttribute('position', new THREE.BufferAttribute(new Float32Array(seg), 3))
    return { surf, floor, lines }
  }, [grid, ramp, steps, SX, SY, SZ, TY.lo, TY.hi]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { surf.dispose(); floor.dispose(); lines.dispose() }, [surf, floor, lines])

  const progress = useRef(animate ? 0 : 1)
  const started = useRef(0)
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    progress.current = animate && !reduce ? 0 : 1
    started.current = performance.now()
  }, [animate, props.data, props.preset, props.res])
  const rise = useRef()
  const floorMat = useRef()
  const lineMat = useRef()
  useFrame(({ camera }) => {
    if (progress.current < 1) progress.current = Math.min(1, (performance.now() - started.current) / Math.max(1, duration))
    const k = pop(progress.current)
    if (rise.current) rise.current.scale.y = Math.max(0.001, k)
    if (floorMat.current) floorMat.current.opacity = 0.5 * clamp(progress.current * 2, 0, 1)
    if (lineMat.current) lineMat.current.opacity = 0.3 * clamp((progress.current - 0.5) * 2, 0, 1)
    const sx = camera.position.x > 0 ? -1 : 1
    const sz = camera.position.z > 0 ? -1 : 1
    if (sx !== sides.sx || sz !== sides.sz) setSides({ sx, sz })
  })

  // the value under the pointer, sampled bilinearly from the grid
  const sample = (X, Z) => {
    const fi = clamp((X / SX + 0.5) * (nx - 1), 0, nx - 1)
    const fj = clamp((Z / SZ + 0.5) * (nz - 1), 0, nz - 1)
    const i = Math.min(nx - 2, Math.floor(fi))
    const j = Math.min(nz - 2, Math.floor(fj))
    const u = fi - i
    const w = fj - j
    const val = (v[j][i] * (1 - u) + v[j][i + 1] * u) * (1 - w) + (v[j + 1][i] * (1 - u) + v[j + 1][i + 1] * u) * w
    return { X, Z, val, xv: xr[0] + ((xr[1] - xr[0]) * fi) / (nx - 1), zv: zr[0] + ((zr[1] - zr[0]) * fj) / (nz - 1) }
  }
  const hy = hov ? map.y(hov.val) : 0

  return (
    <>
      <Rig tilt={tilt} turn={turn} S={S} />
      <OrbitControls makeDefault enabled={interactive} enablePan={false} enableZoom={false} autoRotate={autoRotate && !hov} autoRotateSpeed={0.5} minPolarAngle={Math.PI * 0.1} maxPolarAngle={Math.PI * 0.47} />
      <AxisBox
        S={S}
        T={{ x: inside(TX, xr), y: TY.ticks, z: inside(TZ, zr) }}
        map={map}
        labels={{ x: xLabel, y: yLabel, z: zLabel }}
        sides={sides}
        wallColor={wallColor}
        gridColor={gridColor}
        mutedColor={mutedColor}
        textColor={textColor}
        fmt={{ x: (a) => tickFmt.format(a), y: (a) => fmt(a, true), z: (a) => tickFmt.format(a) }}
      />
      {floorMap && (
        <mesh geometry={floor}>
          <meshBasicMaterial ref={floorMat} vertexColors transparent opacity={0} depthWrite={false} />
        </mesh>
      )}
      <group ref={rise}>
        <mesh
          geometry={surf}
          castShadow
          receiveShadow
          onPointerMove={(e) => { e.stopPropagation(); if (progress.current >= 1) setHov(sample(e.point.x, e.point.z)) }}
          onPointerOut={() => setHov(null)}
        >
          <meshPhysicalMaterial vertexColors roughness={0.5} clearcoat={gloss} clearcoatRoughness={0.3} envMapIntensity={0.5} side={THREE.DoubleSide} />
        </mesh>
        {gridLines && (
          <lineSegments geometry={lines}>
            <lineBasicMaterial ref={lineMat} color={lineColor} transparent opacity={0} />
          </lineSegments>
        )}
      </group>
      {hov && (
        <>
          <mesh position={[hov.X, hy, hov.Z]}>
            <sphereGeometry args={[0.07, 20, 14]} />
            <meshBasicMaterial color={textColor} />
          </mesh>
          <Line points={[[hov.X, hy, hov.Z], [hov.X, 0.006, hov.Z]]} color={textColor} lineWidth={1.4} dashed dashSize={0.06} gapSize={0.05} />
          <Html position={[hov.X, hy + 0.35, hov.Z]} center zIndexRange={[30, 20]} style={{ pointerEvents: 'none' }}>
            <div role="tooltip" style={{ fontFamily: FONT, background: textColor, color: '#fff', padding: '6px 10px', borderRadius: 10, fontSize: 12, whiteSpace: 'nowrap', boxShadow: '0 8px 20px -8px #0006' }}>
              <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                <i style={{ width: 9, height: 9, borderRadius: 3, background: ramp.at(hov.val) }} />
                {yLabel || 'Value'} {fmt(hov.val)}
              </div>
              <div style={{ opacity: 0.8 }}>
                {xLabel || 'x'} {tickFmt.format(hov.xv)} · {zLabel || 'z'} {tickFmt.format(hov.zv)}
              </div>
            </div>
          </Html>
        </>
      )}
    </>
  )
}

export default function Surface3DChart({
  data = '',
  preset = 'peaks',
  res = 56,
  title = 'Profit landscape',
  subtitle = 'Profit by price and ad spend. Hover to read a point, drag to orbit',
  xLabel = 'Price',
  yLabel = 'Profit',
  zLabel = 'Ad spend',
  scale = 'auto',
  steps = 0,
  gridLines = true,
  floorMap = true,
  showKey = true,
  tilt = 28,
  turn = 35,
  boxHeight = 2,
  gloss = 0.4,
  autoRotate = false,
  interactive = true,
  animate = true,
  duration = 1600,
  decimals = 1,
  prefix = '',
  suffix = '',
  color = '#ef4a3a',
  color2 = '#2f8fff',
  background = '#f2f2f3',
  wallColor = '#ffffff',
  gridColor = '#dfe2ea',
  lineColor = '#2b2f3a',
  textColor = '#2b2f3a',
  mutedColor = '#8a90a0',
  style,
}) {
  const grid = useMemo(() => buildGrid(data, preset, res), [data, preset, res])
  const flat = grid.v.flat()
  const lo = Math.min(...flat)
  const hi = Math.max(...flat)
  const TY = niceTicks(lo, hi)
  const ramp = useMemo(() => makeRamp({ scale, lo, hi, steps: Math.round(steps), color, color2, background, mutedColor }), [scale, lo, hi, steps, color, color2, background, mutedColor])
  const d = clamp(Math.round(decimals), 0, 4)
  const fmt = (a, axis) => (axis ? `${prefix}${tickFmt.format(a)}${suffix}` : `${prefix}${a.toLocaleString('en', { minimumFractionDigits: d, maximumFractionDigits: d })}${suffix}`)
  const S = [4, clamp(boxHeight, 0.8, 4), 4]
  // colour key stops
  const keyStops = Array.from({ length: 9 }, (_, i) => {
    const t = i / 8
    return ramp.div ? ramp.at(-ramp.m + 2 * ramp.m * t) : ramp.at(lo + (hi - lo) * t)
  })
  const keyLo = ramp.div ? -ramp.m : lo
  const n = Math.round(steps)
  const keyBg = n > 1
    ? `linear-gradient(90deg, ${Array.from({ length: n }, (_, i) => { const c = ramp.div ? ramp.at(-ramp.m + 2 * ramp.m * ((i + 0.5) / n)) : ramp.at(lo + (hi - lo) * ((i + 0.5) / n)); return `${c} ${(i / n) * 100}% ${((i + 1) / n) * 100}%` }).join(', ')})`
    : `linear-gradient(90deg, ${keyStops.join(', ')})`
  const keyHi = ramp.div ? ramp.m : hi

  return (
    <div
      role="img"
      aria-label={`${title}. 3D surface plot of ${grid.nx} by ${grid.nz} values, ${yLabel} ranging from ${fmt(lo)} to ${fmt(hi)} across ${xLabel} and ${zLabel}.`}
      style={{ position: 'relative', width: '100%', height: '100%', minHeight: 320, background, touchAction: 'none', fontFamily: FONT, overflow: 'hidden', ...style }}
    >
      {(title || subtitle) && (
        <div style={{ position: 'absolute', top: 18, left: 0, right: 0, textAlign: 'center', zIndex: 40, pointerEvents: 'none' }}>
          {title && <div style={{ color: textColor, fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em' }}>{title}</div>}
          {subtitle && <div style={{ color: mutedColor, fontSize: 13, marginTop: 2 }}>{subtitle}</div>}
        </div>
      )}
      <Canvas shadows dpr={[1, 2]} camera={{ fov: 32, position: [6, 5, 8] }} gl={{ antialias: true, toneMapping: THREE.NeutralToneMapping }}>
        <color attach="background" args={[background]} />
        <Suspense fallback={null}>
          <Scene {...{ grid, S, xLabel, yLabel, zLabel, ramp, steps: Math.round(steps), TY, gridLines, floorMap, gloss, animate, duration, autoRotate, interactive, wallColor, gridColor, lineColor, textColor, mutedColor, tilt, turn, fmt, data, preset, res }} />
          <Environment resolution={128}>
            <color attach="background" args={['#d9dadd']} />
            <Lightformer form="rect" intensity={1.3} position={[0, 6, 1]} rotation-x={Math.PI / 2} scale={[10, 6, 1]} />
            <Lightformer form="rect" intensity={1.2} position={[-6, 1, 3]} rotation-y={Math.PI / 2.4} scale={[3, 6, 1]} />
            <Lightformer form="rect" intensity={1.2} position={[6, 1, 3]} rotation-y={-Math.PI / 2.4} scale={[3, 6, 1]} />
          </Environment>
        </Suspense>
        <ambientLight intensity={0.35} />
        <directionalLight position={[4, 9, 6]} intensity={0.9} />
      </Canvas>
      {showKey && (
        <div style={{ position: 'absolute', bottom: 16, left: 0, right: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, zIndex: 40, pointerEvents: 'none', fontSize: 12, fontWeight: 600, color: mutedColor }}>
          <span>{fmt(keyLo)}</span>
          <i style={{ width: 160, height: 10, borderRadius: 5, background: keyBg }} />
          <span>{fmt(keyHi)}</span>
          <span style={{ color: textColor, marginLeft: 4 }}>{yLabel}</span>
        </div>
      )}
    </div>
  )
}
