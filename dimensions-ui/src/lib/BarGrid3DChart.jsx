import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Html, Lightformer, Line, OrbitControls, RoundedBox } from '@react-three/drei'
import * as THREE from 'three'

// A 3D bar grid: two category axes (say region by month) laid out as a "city" of glossy
// rounded bars on a soft floor. Each bar's height and colour follow its value (or its
// colour follows its row or column). Bars rise in a diagonal wave with a springy pop,
// column names run along the front edge, row names down the side and the value scale
// sits on the back walls, which move to whichever sides face away from the camera.
// Hover a bar: it lifts, its row and column stay lit while the rest dims, and a tooltip
// reads "Row · Column: value". Drag to turn the chart.
// Data is one row per entry, "Row:v|v|v", with `columns` naming the columns, the same
// format as the 2D Heatmap: "North:42|48|55, South:58|64|70".

const FONT = '"Poppins", "Nunito", ui-rounded, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif'
const num = (v) => {
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : 0
}
function parseRows(data) {
  if (Array.isArray(data)) return data.map((d) => ({ label: String(d.label ?? ''), values: (Array.isArray(d.values) ? d.values : [d.value]).map((v) => Math.max(0, num(v))) }))
  return String(data ?? '')
    .split(/[,\n;]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const i = s.lastIndexOf(':')
      return { label: i < 0 ? s : s.slice(0, i).trim(), values: (i < 0 ? '0' : s.slice(i + 1)).split('|').map((v) => Math.max(0, num(v))) }
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
function mix(a, b, t) {
  const h = (c) => [1, 3, 5].map((i) => parseInt(String(c).slice(i, i + 2), 16) || 0)
  const [A, B] = [h(a), h(b)]
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('')
}
// tidy axis ticks from 0 to just above `hi`
function niceTicks(hi, count = 4) {
  const raw = Math.max(1e-9, hi) / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const n = raw / mag
  const step = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag
  const top = Math.ceil(hi / step - 1e-9) * step
  const out = []
  for (let t = 0; t <= top + step * 1e-6; t += step) out.push(t)
  return { ticks: out, top }
}
// three-stop colour ramp, t is 0..1
const rampAt = (stops, t) => {
  const k = clamp(t, 0, 1) * (stops.length - 1)
  const i = Math.min(stops.length - 2, Math.floor(k))
  return mix(stops[i], stops[i + 1], k - i)
}

// a rounded square bar: a rounded square in the floor plane, extruded up by h with a
// bevel on the top and bottom edges. The base sits on y = 0. Group 0 = caps, 1 = walls.
function boxGeometry(s, h, bevel) {
  const b = Math.max(0, Math.min(bevel, s * 0.3, h * 0.3))
  const w = s / 2 - b
  const cr = Math.min(w * 0.9, Math.max(0.004, b * 0.8 + s * 0.04))
  const sh = new THREE.Shape()
  sh.moveTo(-w + cr, -w)
  sh.lineTo(w - cr, -w)
  sh.absarc(w - cr, -w + cr, cr, -Math.PI / 2, 0, false)
  sh.lineTo(w, w - cr)
  sh.absarc(w - cr, w - cr, cr, 0, Math.PI / 2, false)
  sh.lineTo(-w + cr, w)
  sh.absarc(-w + cr, w - cr, cr, Math.PI / 2, Math.PI, false)
  sh.lineTo(-w, -w + cr)
  sh.absarc(-w + cr, -w + cr, cr, Math.PI, Math.PI * 1.5, false)
  const g = new THREE.ExtrudeGeometry(sh, {
    depth: Math.max(0.004, h - b * 2),
    curveSegments: 5,
    bevelEnabled: b > 0.002,
    bevelThickness: b,
    bevelSize: b,
    bevelSegments: 4,
  })
  g.rotateX(-Math.PI / 2)
  g.translate(0, b, 0)
  return g
}
// a cylinder whose base sits on y = 0. Group 0 = wall, 1 = top, 2 = bottom.
function cylGeometry(s, h) {
  const g = new THREE.CylinderGeometry(s / 2, s / 2, h, 40)
  g.translate(0, h / 2, 0)
  return g
}

// one bar of the grid
function Bar({ b, shape, size, bevel, gloss, background, progress, hov, setHov, lift, valueLabel, showLabel, labelColor, textColor, fontSize }) {
  const geo = useMemo(() => (shape === 'cylinder' ? cylGeometry(size, b.h) : boxGeometry(size, b.h, bevel)), [shape, size, b.h, bevel])
  useEffect(() => () => geo.dispose(), [geo])
  const mats = useMemo(() => {
    const top = new THREE.MeshPhysicalMaterial({ color: b.color, roughness: 0.4, envMapIntensity: 0.55, clearcoat: gloss, clearcoatRoughness: 0.18, emissive: b.color, emissiveIntensity: 0 })
    const side = new THREE.MeshPhysicalMaterial({ color: mix(b.color, '#000000', 0.18), roughness: 0.5, envMapIntensity: 0.5, clearcoat: gloss * 0.6, clearcoatRoughness: 0.25, emissive: b.color, emissiveIntensity: 0 })
    return [top, side]
  }, [b.color, gloss])
  useEffect(() => () => mats.forEach((m) => m.dispose()), [mats])
  const cols = useMemo(() => {
    const to = new THREE.Color(background)
    return [b.color, mix(b.color, '#000000', 0.18)].map((c) => ({ base: new THREE.Color(c), dim: new THREE.Color(c).lerp(to, 0.66) }))
  }, [b.color, background])

  const grp = useRef()
  const lab = useRef()
  const cur = useRef({ up: 0, dim: 0, glow: 0, lab: 1 })
  const active = hov && hov.r === b.r && hov.c === b.c
  const lit = !hov || hov.r === b.r || hov.c === b.c

  useFrame((_, dt) => {
    const c = cur.current
    const f = 1 - Math.exp(-dt * 12)
    c.up += ((active ? lift : 0) - c.up) * f
    c.dim += ((lit ? 0 : 1) - c.dim) * f
    c.glow += ((active ? 1 : 0) - c.glow) * f
    c.lab += ((hov && !active ? 0.35 : 1) - c.lab) * f
    const k = clamp((progress.current - b.delay) / b.span, 0, 1)
    if (grp.current) {
      grp.current.position.y = c.up
      grp.current.scale.set(1 + c.glow * 0.04, Math.max(0.001, pop(k)), 1 + c.glow * 0.04)
    }
    mats.forEach((m, j) => {
      m.color.copy(cols[j].base).lerp(cols[j].dim, c.dim)
      m.emissiveIntensity = c.glow * 0.18
    })
    if (lab.current) lab.current.style.opacity = String(clamp((k - 0.6) / 0.4, 0, 1) * c.lab)
  })

  // cylinders: wall, top, bottom
  const material = shape === 'cylinder' ? [mats[1], mats[0], mats[1]] : mats
  return (
    <group position={[b.x, 0, b.z]}>
      <group ref={grp}>
        <mesh
          geometry={geo}
          material={material}
          castShadow
          receiveShadow
          onPointerOver={(e) => {
            e.stopPropagation()
            document.body.style.cursor = 'pointer'
            if (!active) setHov({ r: b.r, c: b.c })
          }}
          onPointerOut={() => {
            document.body.style.cursor = ''
            setHov((h) => (h && h.r === b.r && h.c === b.c ? null : h))
          }}
        />
      </group>
      {showLabel && (
        <Html position={[0, b.h + 0.28, 0]} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
          <div ref={lab} style={{ opacity: 0, fontFamily: FONT, fontWeight: 700, fontSize, lineHeight: 1, whiteSpace: 'nowrap', userSelect: 'none', color: labelColor === 'bar' ? b.color : textColor, textShadow: `0 0 3px ${background}, 0 0 3px ${background}, 0 0 6px ${background}` }}>
            {valueLabel}
          </div>
        </Html>
      )}
    </group>
  )
}

// camera on the tilt / turn angles, backed off until the grid and its labels fit
function Rig({ tilt, turn, span, height, cy }) {
  const { camera, size, controls } = useThree()
  useEffect(() => {
    const e = (clamp(tilt, 10, 85) * Math.PI) / 180
    const a = (clamp(turn, -60, 60) * Math.PI) / 180
    const aspect = size.width / Math.max(1, size.height)
    const tanH = Math.tan((camera.fov * Math.PI) / 360)
    const rad = 0.5 * Math.hypot(span[0], span[1], height)
    // fit the width, and the height too, leaving room for the title and the legend
    const vert = 0.5 * (span[1] * Math.sin(e) + height * Math.cos(e) + Math.abs(Math.sin(a)) * span[0] * Math.sin(e) * 0.5)
    const d = Math.max((rad * 1.0) / (tanH * Math.min(aspect, 1.3)), vert / (tanH * 0.74))
    camera.position.set(Math.sin(a) * Math.cos(e) * d, cy + Math.sin(e) * d, Math.cos(a) * Math.cos(e) * d)
    camera.lookAt(0, cy, 0)
    camera.updateProjectionMatrix()
    if (controls) {
      controls.target.set(0, cy, 0)
      controls.update()
    }
  }, [camera, controls, size.width, size.height, tilt, turn, span[0], span[1], height, cy]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

function Scene(p) {
  const { grid, bars, R, C, pitch, size, H, yOf, ticks, shape, bevel, gloss, hoverLift, labels, labelColor, showAxis, showFloor, animate, duration, autoRotate, interactive, background, floorColor, gridColor, textColor, mutedColor, colorBy, palette, hov, setHov, fmt, tilt, turn } = p
  const W = C * pitch
  const D = R * pitch
  const [sides, setSides] = useState({ sx: -1, sz: 1 }) // the sides that face the camera

  const progress = useRef(animate ? 0 : 1)
  const started = useRef(0)
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    progress.current = animate && !reduce ? 0 : 1
    started.current = performance.now()
  }, [animate, p.data, p.columns, p.barHeight, p.wave])
  useFrame(({ camera }) => {
    if (progress.current < 1) progress.current = Math.min(1, (performance.now() - started.current) / Math.max(1, duration))
    const sx = camera.position.x > 0 ? 1 : -1
    const sz = camera.position.z >= 0 ? 1 : -1
    if (sx !== sides.sx || sz !== sides.sz) setSides({ sx, sz })
  })

  // floor, a margin round the bars
  const FW = W + 0.5
  const FD = D + 0.5
  // the walls sit on the far sides
  const backZ = -sides.sz * (FD / 2)
  const farX = -sides.sx * (FW / 2)
  const segs = []
  if (showAxis)
    ticks.forEach((t) => {
      const y = yOf(t) + 0.003
      segs.push([-FW / 2, y, backZ], [FW / 2, y, backZ], [farX, y, -FD / 2], [farX, y, FD / 2])
    })
  const topY = ticks.length ? yOf(ticks[ticks.length - 1]) : H
  // the scale reads up the front edge of the far side wall, outside the grid
  const scaleZ = sides.sz * (FD / 2)
  if (showAxis) segs.push([farX, 0, backZ], [farX, topY, backZ], [farX, 0, scaleZ], [farX, topY, scaleZ], [-farX, 0, backZ], [-farX, topY, backZ])
  const xOf = (c) => (c - (C - 1) / 2) * pitch
  const zOf = (r) => (r - (R - 1) / 2) * pitch
  const tick = { fontFamily: FONT, fontSize: 11, fontWeight: 600, color: mutedColor, whiteSpace: 'nowrap', userSelect: 'none' }
  const cat = (on) => ({ fontFamily: FONT, fontSize: 12.5, fontWeight: on ? 700 : 600, color: on ? textColor : mutedColor, whiteSpace: 'nowrap', userSelect: 'none', display: 'inline-flex', alignItems: 'center', gap: 5 })
  const maxBar = bars.reduce((m, b) => (b.value > m.value ? b : m), bars[0])
  const fontSize = C * R > 30 ? 12 : 14
  const hb = hov ? bars.find((b) => b.r === hov.r && b.c === hov.c) : null
  // row labels flow away from the grid on the near x side
  const rowShift = sides.sx < 0 ? 'translate(-100%, -50%)' : 'translate(0, -50%)'

  return (
    <>
      <Rig tilt={tilt} turn={turn} span={[W + 2.6, D + 1.4]} height={H + 0.5} cy={H * 0.28} />
      <OrbitControls
        makeDefault
        enabled={interactive}
        enablePan={false}
        enableZoom={false}
        autoRotate={autoRotate && !hov}
        autoRotateSpeed={0.6}
        minPolarAngle={((90 - clamp(tilt + 25, 15, 88)) * Math.PI) / 180}
        maxPolarAngle={((90 - clamp(tilt - 20, 8, 80)) * Math.PI) / 180}
        minAzimuthAngle={autoRotate ? -Infinity : -1.1}
        maxAzimuthAngle={autoRotate ? Infinity : 1.1}
      />
      {showFloor && (
        <RoundedBox args={[FW, 0.12, FD]} radius={0.05} smoothness={3} position={[0, -0.06, 0]} receiveShadow>
          <meshStandardMaterial color={floorColor} roughness={0.85} />
        </RoundedBox>
      )}
      {showAxis && (
        <>
          <mesh position={[0, topY / 2, backZ]}>
            <planeGeometry args={[FW, topY]} />
            <meshStandardMaterial color={floorColor} roughness={1} side={THREE.DoubleSide} transparent opacity={0.45} depthWrite={false} />
          </mesh>
          <mesh position={[farX, topY / 2, 0]} rotation-y={Math.PI / 2}>
            <planeGeometry args={[FD, topY]} />
            <meshStandardMaterial color={floorColor} roughness={1} side={THREE.DoubleSide} transparent opacity={0.45} depthWrite={false} />
          </mesh>
          <Line segments points={segs} color={gridColor} lineWidth={1.2} />
        </>
      )}
      {showAxis &&
        ticks.map((t, i) => (
          <Html key={`t${i}`} position={[farX - sides.sx * 0.3, yOf(t), scaleZ]} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
            <div style={tick}>{fmt(t, true)}</div>
          </Html>
        ))}
      {bars.map((b) => (
        <Bar
          key={b.key}
          b={b}
          shape={shape}
          size={size}
          bevel={bevel}
          gloss={gloss}
          background={background}
          progress={progress}
          hov={hov}
          setHov={setHov}
          lift={hoverLift}
          valueLabel={fmt(b.value)}
          showLabel={labels === 'all' || (labels === 'max' && b === maxBar)}
          labelColor={labelColor}
          textColor={textColor}
          fontSize={labels === 'max' ? 18 : fontSize}
        />
      ))}
      {grid.colNames.map((n, c) => (
        <Html key={`c${c}`} position={[xOf(c), 0, sides.sz * (FD / 2 + 0.3)]} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
          <div style={cat(hov?.c === c)}>
            {colorBy === 'column' && <i style={{ width: 8, height: 8, borderRadius: 2, background: palette[c % palette.length] }} />}
            {n}
          </div>
        </Html>
      ))}
      {grid.rowNames.map((n, r) => (
        <Html key={`r${r}`} position={[sides.sx * (FW / 2 + 0.22), 0, zOf(r)]} zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
          <div style={{ ...cat(hov?.r === r), transform: rowShift, flexDirection: sides.sx < 0 ? 'row-reverse' : 'row' }}>
            {colorBy === 'row' && <i style={{ width: 8, height: 8, borderRadius: 2, background: palette[r % palette.length] }} />}
            {n}
          </div>
        </Html>
      ))}
      {hb && (
        <Html position={[hb.x, hb.h + hoverLift + (labels === 'all' || hb === maxBar ? 0.75 : 0.4), hb.z]} center zIndexRange={[30, 20]} style={{ pointerEvents: 'none' }}>
          <div role="tooltip" style={{ fontFamily: FONT, background: textColor, color: '#fff', padding: '6px 10px', borderRadius: 10, fontSize: 13, whiteSpace: 'nowrap', boxShadow: '0 8px 20px -8px #0006' }}>
            <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
              <i style={{ width: 8, height: 8, borderRadius: 2, background: hb.color }} />
              {grid.rowNames[hb.r]} · {grid.colNames[hb.c]}
            </div>
            <div style={{ opacity: 0.85 }}>{fmt(hb.value)}</div>
          </div>
        </Html>
      )}
    </>
  )
}

export default function BarGrid3DChart({
  data = 'North:42|48|55|63|71|78, South:58|64|70|82|90|96, East:30|36|41|45|52|60, West:50|46|54|61|58|69',
  columns = 'Jan, Feb, Mar, Apr, May, Jun',
  title = 'Sales by month and region',
  subtitle = 'Units sold, in thousands. Hover a bar to read its row and column',
  colorBy = 'value',
  shape = 'box',
  tilt = 34,
  turn = -28,
  barHeight = 2.4,
  gap = 0.3,
  bevel = 0.06,
  gloss = 0.6,
  wave = 0.6,
  hoverLift = 0.25,
  labels = 'max',
  labelColor = 'text',
  showAxis = true,
  showFloor = true,
  showLegend = true,
  autoRotate = false,
  interactive = true,
  animate = true,
  duration = 1800,
  decimals = 0,
  prefix = '',
  suffix = '',
  lowColor = '#9fd0ff',
  midColor = '#2f8fff',
  highColor = '#a93ce0',
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
  const palette = [color, color2, color3, color4, color5, color6]
  const d = clamp(Math.round(decimals), 0, 4)
  const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })
  const fmt = (v, axis) => `${prefix}${axis ? compact.format(v) : v.toLocaleString('en', { minimumFractionDigits: d, maximumFractionDigits: d })}${suffix}`
  const [hov, setHov] = useState(null)

  const grid = useMemo(() => {
    const parsed = parseRows(data).slice(0, 16)
    const rows = parsed.length ? parsed : [{ label: 'Row 1', values: [0] }]
    const C = clamp(Math.max(1, ...rows.map((r) => r.values.length)), 1, 16)
    const names = splitNames(columns)
    return { rowNames: rows.map((r) => r.label), colNames: Array.from({ length: C }, (_, c) => names[c] ?? `C${c + 1}`), v: rows.map((r) => Array.from({ length: C }, (_, c) => r.values[c] ?? 0)) }
  }, [data, columns])
  const R = grid.rowNames.length
  const C = grid.colNames.length
  const flat = grid.v.flat()
  const lo = Math.min(...flat)
  const hi = Math.max(...flat)
  const { ticks, top } = niceTicks(hi || 1)
  const H = clamp(barHeight, 0.5, 5)
  const yOf = (v) => (v / (top || 1)) * H
  const stops = [lowColor, midColor, highColor]
  const pitch = 1
  const size = pitch * (1 - clamp(gap, 0.04, 0.7))

  const bars = useMemo(() => {
    const g = clamp(1 - wave, 0.2, 1) // each bar's own grow, as a share of the whole
    const maxDiag = Math.max(1, C - 1 + R - 1)
    const out = []
    grid.v.forEach((row, r) =>
      row.forEach((v, c) => {
        const t = (c + (R - 1 - r)) / maxDiag // front-left first
        const col = colorBy === 'row' ? palette[r % palette.length] : colorBy === 'column' ? palette[c % palette.length] : rampAt(stops, (v - lo) / (hi - lo || 1))
        out.push({ key: `${r}-${c}`, r, c, x: (c - (C - 1) / 2) * pitch, z: (r - (R - 1) / 2) * pitch, h: Math.max(0.03, yOf(v)), value: v, color: col, delay: t * (1 - g), span: g })
      }),
    )
    return out
  }, [grid, R, C, wave, colorBy, lo, hi, H, top, lowColor, midColor, highColor, color, color2, color3, color4, color5, color6]) // eslint-disable-line react-hooks/exhaustive-deps

  const legendItems = colorBy === 'row' ? grid.rowNames.map((n, i) => ({ n, c: palette[i % palette.length], r: i })) : colorBy === 'column' ? grid.colNames.map((n, i) => ({ n, c: palette[i % palette.length], col: i })) : null

  return (
    <div
      role="img"
      aria-label={`${title}. 3D bar grid of ${R} rows by ${C} columns. ${grid.rowNames.map((n, r) => `${n}: ${grid.colNames.map((cn, c) => `${cn} ${fmt(grid.v[r][c])}`).join(', ')}`).join('; ')}`}
      style={{ position: 'relative', width: '100%', height: '100%', minHeight: 320, background, touchAction: 'none', fontFamily: FONT, overflow: 'hidden', ...style }}
    >
      {(title || subtitle) && (
        <div style={{ position: 'absolute', top: 18, left: 16, right: 16, textAlign: 'center', zIndex: 40, pointerEvents: 'none' }}>
          {title && <div style={{ color: textColor, fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em' }}>{title}</div>}
          {subtitle && <div style={{ color: mutedColor, fontSize: 13, marginTop: 2 }}>{subtitle}</div>}
        </div>
      )}
      <Canvas shadows dpr={[1, 2]} camera={{ fov: 32, position: [-5, 6, 9] }} gl={{ antialias: true, toneMapping: THREE.NeutralToneMapping }}>
        <color attach="background" args={[background]} />
        <Suspense fallback={null}>
          <Scene
            {...{ grid, bars, R, C, pitch, size, H, yOf, ticks, shape, bevel, gloss, hoverLift, labels, labelColor, showAxis, showFloor, animate, duration, autoRotate, interactive, background, floorColor, gridColor, textColor, mutedColor, colorBy, palette, hov, setHov, fmt, tilt, turn, data, columns, barHeight, wave }}
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
        <directionalLight position={[4, 9, 6]} intensity={0.9} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-9} shadow-camera-right={9} shadow-camera-top={9} shadow-camera-bottom={-9} />
        <ContactShadows position={[0, -0.13, 0]} opacity={0.3} scale={Math.max(C, R) * 1.6 + 6} blur={2.4} far={2} />
      </Canvas>
      {showLegend && (
        <div style={{ position: 'absolute', bottom: 14, left: 16, right: 16, display: 'flex', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', gap: '6px 18px', zIndex: 40, fontSize: 12, fontWeight: 600, color: mutedColor }}>
          {legendItems ? (
            legendItems.map((l, i) => (
              <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: (l.r != null ? hov?.r === l.r : hov?.c === l.col) ? textColor : mutedColor }}>
                <i style={{ width: 10, height: 10, borderRadius: 3, background: l.c }} />
                {l.n}
              </span>
            ))
          ) : (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, pointerEvents: 'none' }}>
              <span>{fmt(lo)}</span>
              <i style={{ position: 'relative', width: 160, height: 10, borderRadius: 5, background: `linear-gradient(90deg, ${stops.join(', ')})` }}>
                {hov && (
                  <b style={{ position: 'absolute', top: -3, left: `calc(${clamp((grid.v[hov.r][hov.c] - lo) / (hi - lo || 1), 0, 1) * 100}% - 2px)`, width: 4, height: 16, borderRadius: 2, background: textColor }} />
                )}
              </i>
              <span>{fmt(hi)}</span>
            </span>
          )}
        </div>
      )}
    </div>
  )
}
