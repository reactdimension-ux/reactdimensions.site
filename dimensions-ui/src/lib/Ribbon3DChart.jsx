import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Html, Lightformer, Line, OrbitControls, RoundedBox } from '@react-three/drei'
import * as THREE from 'three'

// A real 3D ribbon chart: each series is a glossy extruded ribbon running along x,
// set one behind another in depth like a ridgeline you can orbit. In `area` mode the
// ribbons are walls standing on the floor; in `line` mode they are thick floating bands.
// Ribbons draw on from left to right and settle with a small overshoot. Hover a ribbon
// to lift it and read the nearest value; drag to turn the chart.
// Data is one row per series, "Name:v|v|v|...", with `labels` naming the x positions.

const FONT = '"Poppins", "Nunito", ui-rounded, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif'
const num = (v) => {
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : 0
}
function parseRows(data) {
  if (Array.isArray(data)) return data.map((d) => ({ label: String(d.label ?? ''), values: (Array.isArray(d.values) ? d.values : [d.value]).map(num) }))
  return String(data ?? '')
    .split(/[,\n;]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const i = s.lastIndexOf(':')
      return { label: i < 0 ? s : s.slice(0, i).trim(), values: (i < 0 ? '0' : s.slice(i + 1)).split('|').map(num) }
    })
}
const splitNames = (s) =>
  String(s ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
// springy ease-out with a small overshoot
const pop = (x) => (x >= 1 ? 1 : x <= 0 ? 0 : 1 + 2.2 * (x - 1) ** 3 + 1.2 * (x - 1) ** 2)
const easeOut = (x) => 1 - (1 - clamp(x, 0, 1)) ** 3
function mix(a, b, t) {
  const h = (c) => [1, 3, 5].map((i) => parseInt(String(c).slice(i, i + 2), 16) || 0)
  const [A, B] = [h(a), h(b)]
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('')
}
// tidy axis ticks covering lo..hi
function niceTicks(lo, hi, count = 4) {
  const raw = Math.max(1e-9, hi - lo) / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const n = raw / mag
  const step = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag
  const bot = Math.floor(lo / step + 1e-9) * step
  const top = Math.ceil(hi / step - 1e-9) * step
  const out = []
  for (let t = bot; t <= top + step * 1e-6; t += step) out.push(+t.toFixed(10))
  return { ticks: out, bot, top: Math.max(top, bot + step) }
}
// sample a curve through (xs, ys): monotone cubic (never overshoots) or straight
function sampleCurve(xs, ys, smooth, per = 14) {
  const n = xs.length
  if (n < 2) return xs.map((x, i) => [x, ys[i]])
  if (!smooth) return xs.map((x, i) => [x, ys[i]])
  const d = [], m = new Array(n)
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]))
  m[0] = d[0]
  m[n - 1] = d[n - 2]
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b
    if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i] }
  }
  const out = []
  for (let i = 0; i < n - 1; i++) {
    const h = xs[i + 1] - xs[i]
    for (let j = 0; j < per; j++) {
      const t = j / per, t2 = t * t, t3 = t2 * t
      const y = (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1]
      out.push([xs[i] + t * h, y])
    }
  }
  out.push([xs[n - 1], ys[n - 1]])
  return out
}

// an extruded ribbon in the x/y plane, `depth` thick in z and centred on z = 0.
// Caps (the big front and back faces) are material group 0, the walls (top edge) group 1.
function ribbonGeometry(pts, mode, band, depth, bevel) {
  const r = Math.max(0.002, Math.min(bevel, depth * 0.4, mode === 'line' ? band * 0.4 : 1))
  const shape = new THREE.Shape()
  if (mode === 'line') {
    const top = pts.map(([x, y]) => [x, y - r])
    shape.moveTo(top[0][0], top[0][1])
    top.forEach(([x, y]) => shape.lineTo(x, y))
    for (let i = top.length - 1; i >= 0; i--) shape.lineTo(top[i][0], top[i][1] - Math.max(0.01, band - 2 * r))
  } else {
    const y0 = r
    shape.moveTo(pts[0][0], y0)
    pts.forEach(([x, y]) => shape.lineTo(x, Math.max(y0 + 0.01, y - r)))
    shape.lineTo(pts[pts.length - 1][0], y0)
  }
  shape.closePath()
  const g = new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.01, depth - 2 * r), bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelSegments: 4, curveSegments: 1 })
  g.translate(0, 0, -(depth - 2 * r) / 2)
  g.computeVertexNormals()
  return g
}

function Ribbon({ s, mode, band, thickness, bevel, gloss, progress, hov, setHov, hoverLift, background, textColor, labelColor, showEnd, fmt, xLabels }) {
  const grp = useRef()
  const capMat = useRef()
  const wallMat = useRef()
  const lab = useRef()
  const cur = useRef({ glow: 0, dim: 0 })
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(-1, 0, 0), 1e4), [])
  const local = useMemo(() => new THREE.Plane(), [])
  const geom = useMemo(() => ribbonGeometry(s.pts, mode, band, thickness, bevel), [s.pts, mode, band, thickness, bevel])
  useEffect(() => () => geom.dispose(), [geom])
  const active = hov && hov.s === s.i
  const compact = useThree((st) => st.size.width) < 560
  const caps = s.color
  const walls = mix(s.color, '#ffffff', 0.3)
  const dimTo = useMemo(() => [new THREE.Color(mix(caps, background, 0.6)), new THREE.Color(mix(walls, background, 0.6))], [caps, walls, background])
  const base = useMemo(() => [new THREE.Color(caps), new THREE.Color(walls)], [caps, walls])

  useFrame((_, dt) => {
    const k = clamp((progress.current - s.delay) / 0.62, 0, 1)
    const c = cur.current
    const f = 1 - Math.exp(-dt * 12)
    c.glow += ((active ? 1 : 0) - c.glow) * f
    c.dim += ((hov && !active ? 1 : 0) - c.dim) * f
    const g = grp.current
    g.position.y = c.glow * hoverLift
    g.scale.y = Math.max(0.001, 0.25 + 0.75 * pop(clamp((k - 0.1) / 0.9, 0, 1)))
    // the draw-on: a clipping plane that sweeps from left to right in the ribbon's own space
    const reveal = k >= 1 ? 1e4 : s.x0 - 0.3 + (s.x1 - s.x0 + 0.6) * easeOut(k / 0.8)
    local.set(local.normal.set(-1, 0, 0), reveal)
    g.updateMatrixWorld()
    plane.copy(local).applyMatrix4(g.matrixWorld)
    ;[capMat.current, wallMat.current].forEach((m, i) => {
      if (!m) return
      m.color.copy(base[i]).lerp(dimTo[i], c.dim)
      m.emissiveIntensity = c.glow * 0.2
    })
    if (lab.current) lab.current.style.opacity = String(clamp((k - 0.6) / 0.4, 0, 1) * (1 - c.dim * 0.6))
  })

  const pick = (e) => {
    e.stopPropagation()
    const p = grp.current.worldToLocal(e.point.clone())
    const i = clamp(Math.round((p.x - s.x0) / Math.max(1e-6, s.step)), 0, s.values.length - 1)
    if (!hov || hov.s !== s.i || hov.i !== i) setHov({ s: s.i, i })
    document.body.style.cursor = 'pointer'
  }
  const hi = active ? hov.i : -1
  const mat = (ref, color, attach) => (
    <meshPhysicalMaterial ref={ref} attach={attach} color={color} emissive={s.color} emissiveIntensity={0} roughness={0.38} envMapIntensity={0.6} clearcoat={gloss} clearcoatRoughness={0.18} side={THREE.DoubleSide} clippingPlanes={[plane]} clipShadows />
  )
  const endY = s.ys[s.ys.length - 1]

  return (
    <group position={[0, 0, s.z]}>
      <group ref={grp}>
        <mesh geometry={geom} castShadow receiveShadow onPointerOver={pick} onPointerMove={pick} onPointerOut={() => { setHov(null); document.body.style.cursor = '' }} onClick={(e) => e.stopPropagation()}>
          {mat(capMat, caps, 'material-0')}
          {mat(wallMat, walls, 'material-1')}
        </mesh>
        {hi >= 0 && (
          <mesh position={[s.x0 + hi * s.step, s.ys[hi] + 0.02, 0]}>
            <sphereGeometry args={[Math.min(0.09, thickness * 0.4), 20, 14]} />
            <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.4} />
          </mesh>
        )}
        {showEnd !== 'none' && (
          <Html position={[s.x1 + 0.28, (mode === 'line' ? endY - band / 2 : endY - 0.02), 0]} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
            <div ref={lab} style={{ opacity: 0, transform: compact ? 'translate(50%, -20%)' : 'translate(50%, -30%)', display: compact ? 'flex' : 'block', alignItems: 'baseline', gap: 4, fontFamily: FONT, whiteSpace: 'nowrap', userSelect: 'none', lineHeight: 1.05, textShadow: `0 0 3px ${background}, 0 0 3px ${background}, 0 0 6px ${background}` }}>
              {showEnd === 'value' && <div style={{ fontWeight: 700, fontSize: compact ? 13 : 17, color: labelColor === 'series' ? s.color : textColor }}>{fmt(s.values[s.values.length - 1])}</div>}
              <div style={{ fontWeight: 600, fontSize: showEnd === 'value' ? 11 : 13, color: showEnd === 'value' ? textColor : labelColor === 'series' ? s.color : textColor, opacity: showEnd === 'value' ? 0.75 : 1 }}>{s.name}</div>
            </div>
          </Html>
        )}
        {hi >= 0 && (
          <Html position={[s.x0 + hi * s.step, s.ys[hi] + 0.5, 0]} center zIndexRange={[30, 20]} style={{ pointerEvents: 'none' }}>
            <div role="tooltip" style={{ fontFamily: FONT, background: textColor, color: '#fff', padding: '6px 10px', borderRadius: 10, fontSize: 13, whiteSpace: 'nowrap', boxShadow: '0 8px 20px -8px #0006', transform: 'translateY(-50%)' }}>
              <div style={{ fontWeight: 700 }}>{xLabels[hi]}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: 0.9 }}>
                <i style={{ width: 8, height: 8, borderRadius: '50%', background: s.color }} />
                <span style={{ flex: 1 }}>{s.name}</span>
                <b style={{ marginLeft: 10 }}>{fmt(s.values[hi])}</b>
              </div>
            </div>
          </Html>
        )}
      </group>
    </group>
  )
}

// places the camera on the tilt / turn angles and backs it off to fit the chart and its labels
function Rig({ tilt, turn, span, height, cx }) {
  const { camera, size, controls } = useThree()
  useEffect(() => {
    const e = (clamp(tilt, 5, 80) * Math.PI) / 180
    const a = (clamp(turn, -60, 60) * Math.PI) / 180
    const aspect = size.width / Math.max(1, size.height)
    const tanH = Math.tan((camera.fov * Math.PI) / 360)
    const rad = 0.5 * Math.hypot(span[0], span[1], height + 0.9)
    const d = (rad * (aspect < 1 ? 1.08 : 0.9)) / (tanH * Math.min(aspect, 1.3))
    const cy = height * 0.32
    camera.position.set(cx + Math.sin(a) * Math.cos(e) * d, cy + Math.sin(e) * d, Math.cos(a) * Math.cos(e) * d)
    camera.lookAt(cx, cy, 0)
    camera.updateProjectionMatrix()
    if (controls) {
      controls.target.set(cx, cy, 0)
      controls.update()
    }
  }, [camera, controls, size.width, size.height, tilt, turn, span[0], span[1], height, cx]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

function Scene(p) {
  const { rows, xLabels, mode, curve, chartWidth, chartHeight, thickness, gap, bandHeight, bevel, gloss, palette, hoverLift, showEnd, showAxis, showGrid, showFloor, labelColor, animate, duration, autoRotate, floorColor, gridColor, textColor, mutedColor, background, fmt } = p
  const [hov, setHov] = useState(null)
  const S = Math.max(1, rows.length)
  const n = Math.max(2, ...rows.map((r) => r.values.length))
  const W = Math.max(2, chartWidth)
  const H = Math.max(0.5, chartHeight)
  const T = clamp(thickness, 0.06, 2)
  const band = clamp(bandHeight, 0.05, 1.5)
  const zPitch = T + Math.max(0, gap)
  const step = W / (n - 1)
  const x0 = -W / 2
  const all = rows.flatMap((r) => r.values)
  const lo = mode === 'line' ? Math.min(0, ...all) : 0
  const { ticks, bot, top } = niceTicks(lo, Math.max(1e-9, ...all))
  const yOf = (v) => ((v - bot) / (top - bot)) * H + (mode === 'line' ? band * 0.5 : 0)

  const series = useMemo(
    () =>
      rows.map((r, si) => {
        const vals = Array.from({ length: n }, (_, i) => r.values[i] ?? r.values[r.values.length - 1] ?? 0)
        const xs = vals.map((_, i) => x0 + i * step)
        const ys = vals.map(yOf)
        return {
          i: si,
          name: r.label,
          values: vals,
          ys,
          pts: sampleCurve(xs, ys, curve === 'smooth'),
          x0,
          x1: x0 + (n - 1) * step,
          step,
          // the first series sits at the back, later ones step towards the camera
          z: -((S - 1) * zPitch) / 2 + si * zPitch,
          delay: S > 1 ? (si / (S - 1)) * 0.36 : 0,
          color: palette[si % palette.length],
        }
      }),
    [rows, n, step, x0, S, zPitch, curve, mode, H, bot, top, band, palette.join()], // eslint-disable-line react-hooks/exhaustive-deps
  )

  const progress = useRef(animate ? 0 : 1)
  const started = useRef(0)
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    progress.current = animate && !reduce ? 0 : 1
    started.current = performance.now()
  }, [animate, p.data, mode, curve])
  const spin = useRef()
  useFrame((_, dt) => {
    if (progress.current < 1) progress.current = Math.min(1, (performance.now() - started.current) / Math.max(1, duration))
    if (autoRotate && spin.current && !hov) spin.current.rotation.y += dt * 0.25
  })

  const depth = (S - 1) * zPitch + T
  const fw = W + 0.9
  const fd = depth + 1.1
  const backZ = -fd / 2 + 0.06
  const frontZ = fd / 2
  const lStep = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(W * 1.7))))
  const endSpace = showEnd === 'none' ? 0 : 1.6

  return (
    <>
      <Rig tilt={p.tilt} turn={p.turn} span={[fw + 1.0 + endSpace, fd + 0.6]} height={H + (mode === 'line' ? band : 0)} cx={endSpace * 0.38} />
      <group ref={spin}>
        {showFloor && (
          <RoundedBox args={[fw, 0.14, fd]} radius={0.06} smoothness={3} position={[0, -0.07, 0]} receiveShadow>
            <meshStandardMaterial color={floorColor} roughness={0.85} />
          </RoundedBox>
        )}
        {showGrid &&
          series[0]?.values.map((_, i) =>
            i % lStep ? null : <Line key={`g${i}`} points={[[x0 + i * step, 0.004, backZ], [x0 + i * step, 0.004, frontZ - 0.12]]} color={gridColor} lineWidth={1} transparent opacity={0.7} />,
          )}
        {showAxis &&
          ticks.map((t, i) => (
            <group key={i}>
              <Line points={[[-fw / 2 + 0.12, yOf(t) + 0.002, backZ], [fw / 2 - 0.12, yOf(t) + 0.002, backZ]]} color={gridColor} lineWidth={1.4} dashed={i > 0} dashSize={0.12} gapSize={0.08} />
              <Html position={[-fw / 2 - 0.05, yOf(t), backZ]} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
                <div style={{ fontFamily: FONT, fontSize: 11, fontWeight: 600, color: mutedColor, whiteSpace: 'nowrap', transform: 'translateX(-60%)', userSelect: 'none' }}>{fmt(t)}</div>
              </Html>
            </group>
          ))}
        {series.map((s) => (
          <Ribbon key={s.i} {...{ s, mode, band, thickness: T, bevel, gloss, progress, hov, setHov, hoverLift, background, textColor, labelColor, showEnd, fmt, xLabels }} />
        ))}
        {xLabels.slice(0, n).map((l, i) =>
          i % lStep ? null : (
            <Html key={`x${i}`} position={[x0 + i * step, 0.02, frontZ + 0.3]} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
              <div style={{ fontFamily: FONT, fontSize: 12, fontWeight: 600, color: hov && hov.i === i ? textColor : mutedColor, whiteSpace: 'nowrap', userSelect: 'none' }}>{l}</div>
            </Html>
          ),
        )}
      </group>
    </>
  )
}

export default function Ribbon3DChart({
  data = 'Organic:42|48|45|56|62|58|70|76|72|84|90|96, Paid:30|34|41|38|46|52|49|57|55|61|58|66, Social:18|24|21|29|26|34|40|37|45|42|50|47, Email:10|13|17|15|20|19|24|22|27|30|28|33',
  labels = 'Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec',
  title = 'Traffic by source',
  subtitle = 'Visits per month, thousands',
  mode = 'area',
  curve = 'smooth',
  tilt = 26,
  turn = -26,
  chartWidth = 7,
  chartHeight = 2.4,
  thickness = 0.32,
  gap = 0.6,
  bandHeight = 0.26,
  bevel = 0.05,
  gloss = 0.6,
  hoverLift = 0.25,
  endLabels = 'value',
  labelColor = 'series',
  showAxis = true,
  showGrid = true,
  showFloor = true,
  showLegend = false,
  autoRotate = false,
  interactive = true,
  animate = true,
  duration = 1800,
  decimals = 0,
  prefix = '',
  suffix = 'k',
  color = '#ff9a2e',
  color2 = '#2f8fff',
  color3 = '#a93ce0',
  color4 = '#ef4a3a',
  color5 = '#14a89e',
  color6 = '#c49a12',
  background = '#f2f2f3',
  floorColor = '#ffffff',
  gridColor = '#d5d8e0',
  textColor = '#2b2f3a',
  mutedColor = '#8a90a0',
  style,
}) {
  const rows = useMemo(() => parseRows(data).filter((r) => r.values.length), [data])
  const n = Math.max(2, ...rows.map((r) => r.values.length))
  const lb = splitNames(labels)
  const xLabels = Array.from({ length: n }, (_, i) => lb[i] ?? String(i + 1))
  const palette = [color, color2, color3, color4, color5, color6]
  const d = clamp(Math.round(decimals), 0, 4)
  const fmt = (v) => `${v < 0 ? '-' : ''}${prefix}${Math.abs(v).toLocaleString('en', { minimumFractionDigits: d, maximumFractionDigits: d })}${suffix}`

  return (
    <div
      role="img"
      aria-label={`${title}. 3D ribbon chart. ${rows.map((r) => `${r.label}: ${r.values.map((v, i) => `${xLabels[i]} ${fmt(v)}`).join(', ')}`).join('; ')}`}
      style={{ position: 'relative', width: '100%', height: '100%', minHeight: 320, background, touchAction: 'none', fontFamily: FONT, overflow: 'hidden', ...style }}
    >
      {(title || subtitle) && (
        <div style={{ position: 'absolute', top: 18, left: 0, right: 0, textAlign: 'center', zIndex: 40, pointerEvents: 'none' }}>
          {title && <div style={{ color: textColor, fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em' }}>{title}</div>}
          {subtitle && <div style={{ color: mutedColor, fontSize: 13, marginTop: 2 }}>{subtitle}</div>}
        </div>
      )}
      <Canvas shadows dpr={[1, 2]} camera={{ fov: 32, position: [0, 5, 10] }} gl={{ antialias: true, toneMapping: THREE.NeutralToneMapping, localClippingEnabled: true }} onCreated={({ gl }) => { gl.localClippingEnabled = true }}>
        <color attach="background" args={[background]} />
        <Suspense fallback={null}>
          <Scene {...{ background, rows, data, xLabels, mode, curve, chartWidth, chartHeight, thickness, gap, bandHeight, bevel, gloss, palette, hoverLift, showEnd: endLabels, showAxis, showGrid, showFloor, labelColor, animate, duration, autoRotate, floorColor, gridColor, textColor, mutedColor, fmt, tilt, turn }} />
          {/* soft studio: a broad top light for the glossy edges, side strips for the faces */}
          <Environment resolution={128}>
            <color attach="background" args={['#d9dadd']} />
            <Lightformer form="rect" intensity={1.3} position={[0, 6, 1]} rotation-x={Math.PI / 2} scale={[10, 6, 1]} />
            <Lightformer form="rect" intensity={1.2} position={[-6, 1, 3]} rotation-y={Math.PI / 2.4} scale={[3, 6, 1]} />
            <Lightformer form="rect" intensity={1.2} position={[6, 1, 3]} rotation-y={-Math.PI / 2.4} scale={[3, 6, 1]} />
          </Environment>
        </Suspense>
        <ambientLight intensity={0.25} />
        <directionalLight position={[4, 9, 6]} intensity={0.9} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-8} shadow-camera-right={8} shadow-camera-top={8} shadow-camera-bottom={-8} />
        <ContactShadows position={[0, -0.15, 0]} opacity={0.3} scale={16} blur={2.4} far={2} />
        <OrbitControls makeDefault enabled={interactive} enablePan={false} enableZoom={false} minPolarAngle={Math.PI * 0.18} maxPolarAngle={Math.PI * 0.49} minAzimuthAngle={-1.1} maxAzimuthAngle={1.1} />
      </Canvas>
      {showLegend && rows.length > 0 && (
        <div style={{ position: 'absolute', bottom: 16, left: 0, right: 0, display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '6px 18px', zIndex: 40, pointerEvents: 'none' }}>
          {rows.map((r, i) => (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: mutedColor, fontSize: 13, fontWeight: 600 }}>
              <i style={{ width: 10, height: 10, borderRadius: 3, background: palette[i % palette.length] }} />
              {r.label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
