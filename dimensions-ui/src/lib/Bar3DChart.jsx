import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Html, Lightformer, Line, OrbitControls, RoundedBox } from '@react-three/drei'
import * as THREE from 'three'

// A real 3D bar chart: glossy rounded boxes (or cylinders) standing on a soft floor,
// seen from a tilted three-quarter camera. Bars grow up one after another with a
// springy overshoot, values float above them and the value scale is drawn on a back
// wall. Several series can sit side by side, stacked, or in rows one behind another.
// Hover a bar for its value; drag to turn the chart.
// Data is "Label:value" or "Label:v1|v2|v3" with a `series` prop naming the values.

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

// one bar (or stacked segment): a rounded box or cylinder whose base sits at y0
function Bar({ b, shape, bevel, gloss, progress, hov, setHov, enter, valueLabel, labelColor, textColor, halo, fontSize, showValues }) {
  const grp = useRef()
  const mat = useRef()
  const lab = useRef()
  const cur = useRef({ glow: 0, dim: 1 })
  const active = hov === b.key
  const r = Math.max(0, Math.min(bevel, b.w * 0.45, b.d * 0.45, b.h * 0.45))

  useFrame((_, dt) => {
    const k = clamp((progress.current - b.delay) / 0.55, 0, 1)
    const c = cur.current
    const f = 1 - Math.exp(-dt * 12)
    c.glow += ((active ? 1 : 0) - c.glow) * f
    c.dim += ((hov && !active ? 0.4 : 1) - c.dim) * f
    // stacked segments ride up as the ones below them grow
    grp.current.position.y = b.y0 * pop(clamp((progress.current - b.baseDelay) / 0.55, 0, 1))
    grp.current.scale.set(1 + c.glow * 0.05, Math.max(0.001, pop(k)), 1 + c.glow * 0.05)
    if (mat.current) mat.current.emissiveIntensity = c.glow * 0.22
    if (lab.current) lab.current.style.opacity = String(clamp((k - 0.55) / 0.45, 0, 1) * c.dim)
  })

  const handlers = {
    onPointerOver: (e) => { e.stopPropagation(); setHov(b.key); document.body.style.cursor = 'pointer' },
    onPointerOut: () => { setHov(null); document.body.style.cursor = '' },
    onClick: (e) => e.stopPropagation(),
  }
  const material = <meshPhysicalMaterial ref={mat} color={b.color} emissive={b.color} emissiveIntensity={0} roughness={0.42} envMapIntensity={0.55} clearcoat={gloss} clearcoatRoughness={0.2} />

  return (
    <group position={[b.x, 0, b.z]}>
      <group ref={grp}>
        {shape === 'cylinder' ? (
          <mesh position={[0, b.h / 2, 0]} castShadow receiveShadow {...handlers}>
            <cylinderGeometry args={[b.w / 2, b.w / 2, b.h, 40]} />
            {material}
          </mesh>
        ) : (
          <RoundedBox args={[b.w, b.h, b.d]} radius={r} smoothness={4} position={[0, b.h / 2, 0]} castShadow receiveShadow {...handlers}>
            {material}
          </RoundedBox>
        )}
      </group>
      {showValues && b.showLabel && (
        <Html position={[0, b.labelY + 0.32, 0]} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
          <div ref={lab} style={{ opacity: 0, fontFamily: FONT, fontWeight: 700, fontSize, lineHeight: 1, whiteSpace: 'nowrap', userSelect: 'none', color: labelColor === 'bar' ? b.color : textColor, textShadow: `0 0 3px ${halo}, 0 0 3px ${halo}, 0 0 6px ${halo}` }}>
            {valueLabel}
          </div>
        </Html>
      )}
      {active && (
        <Html position={[0, b.labelY + (showValues && b.showLabel ? 0.95 : 0.45), 0]} center zIndexRange={[30, 20]} style={{ pointerEvents: 'none' }}>
          <div role="tooltip" style={{ fontFamily: FONT, background: textColor, color: '#fff', padding: '6px 10px', borderRadius: 10, fontSize: 13, whiteSpace: 'nowrap', boxShadow: '0 8px 20px -8px #0006' }}>
            <div style={{ fontWeight: 700 }}>{enter.title}</div>
            {enter.rows.map((r2, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: 0.85 }}>
                <i style={{ width: 8, height: 8, borderRadius: '50%', background: r2.color }} />
                <span style={{ flex: 1 }}>{r2.label}</span>
                <b style={{ marginLeft: 10 }}>{r2.value}</b>
              </div>
            ))}
          </div>
        </Html>
      )}
    </group>
  )
}

// places the camera on the tilt / turn angles and backs it off to fit the whole chart
function Rig({ tilt, turn, span, height }) {
  const { camera, size, controls } = useThree()
  useEffect(() => {
    const e = (clamp(tilt, 5, 80) * Math.PI) / 180
    const a = (clamp(turn, -60, 60) * Math.PI) / 180
    const aspect = size.width / Math.max(1, size.height)
    const tanH = Math.tan((camera.fov * Math.PI) / 360)
    // a sphere round the chart, its labels and the floor
    const rad = 0.5 * Math.hypot(span[0] + 1.1, span[1] + 0.8, height + 0.9)
    const d = (rad * 1.02) / (tanH * Math.min(aspect, 1.25))
    const cy = height * 0.3
    camera.position.set(Math.sin(a) * Math.cos(e) * d, cy + Math.sin(e) * d, Math.cos(a) * Math.cos(e) * d)
    camera.lookAt(0, cy, 0)
    camera.updateProjectionMatrix()
    // orbit round the same point the camera looks at, or the controls would re-aim it
    if (controls) {
      controls.target.set(0, cy, 0)
      controls.update()
    }
  }, [camera, controls, size.width, size.height, tilt, turn, span[0], span[1], height]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

function Scene(p) {
  const { rows, sNames, layout, shape, gap, barHeight, bevel, gloss, palette, colorByBar, showValues, showAxis, showFloor, labelColor, animate, duration, autoRotate, floorColor, gridColor, textColor, mutedColor, fmt } = p
  const [hov, setHov] = useState(null)
  const S = Math.max(1, ...rows.map((r) => r.values.length))
  const n = Math.max(1, rows.length)
  const multi = S > 1
  const lay = multi ? layout : 'grouped'

  // geometry in world units: categories along x, (rows layout) series along z
  const pitch = 1.15
  const bw = pitch * (1 - clamp(gap, 0.05, 0.8))
  const zPitch = lay === 'rows' ? pitch : 0
  const totals = rows.map((r) => r.values.reduce((a, v) => a + v, 0))
  const maxV = Math.max(1e-9, ...(lay === 'stacked' ? totals : rows.flatMap((r) => r.values)))
  const { ticks, top } = niceTicks(maxV)
  const H = Math.max(0.5, barHeight)
  const yOf = (v) => (v / top) * H
  const width = n * pitch
  const depth = lay === 'rows' ? S * zPitch : bw
  const x0 = -width / 2 + pitch / 2
  const z0 = lay === 'rows' ? -((S - 1) * zPitch) / 2 : 0

  const colorFor = (ci, si) => (multi ? palette[si % palette.length] : colorByBar ? palette[ci % palette.length] : palette[0])
  const bars = []
  rows.forEach((r, ci) => {
    let acc = 0
    r.values.forEach((v, si) => {
      if (si >= S) return
      const delay = (n > 1 ? (ci / (n - 1)) * 0.38 : 0) + (lay === 'stacked' ? si * 0.06 : lay === 'rows' ? si * 0.05 : si * 0.03)
      const tip = {
        title: r.label,
        rows: multi ? r.values.map((vv, sj) => ({ color: colorFor(ci, sj), label: sNames[sj] ?? `Series ${sj + 1}`, value: fmt(vv) })) : [{ color: colorFor(ci, 0), label: 'Value', value: fmt(v) }],
      }
      if (lay === 'grouped') {
        const sw = bw / S
        // side-by-side bars: square footprints for cylinders, a little deeper than wide for boxes
        const w = sw * (S > 1 ? 0.9 : 1)
        const dz = shape === 'cylinder' ? w : Math.min(bw, w * (multi ? 1.6 : 1))
        bars.push({ key: `${ci}-${si}`, x: x0 + ci * pitch - bw / 2 + sw * (si + 0.5), z: 0, w, d: dz, h: Math.max(0.02, yOf(v)), y0: 0, delay, baseDelay: 0, color: colorFor(ci, si), labelY: yOf(v), showLabel: true, value: v, tip })
      } else if (lay === 'stacked') {
        const h = yOf(v)
        bars.push({ key: `${ci}-${si}`, x: x0 + ci * pitch, z: 0, w: bw, d: bw, h: Math.max(0.02, h - (si < S - 1 ? 0.03 : 0)), y0: yOf(acc), delay, baseDelay: delay - si * 0.06, color: colorFor(ci, si), labelY: yOf(totals[ci]), showLabel: si === r.values.length - 1, value: totals[ci], tip })
        acc += v
      } else {
        bars.push({ key: `${ci}-${si}`, x: x0 + ci * pitch, z: z0 + si * zPitch, w: bw, d: bw, h: Math.max(0.02, yOf(v)), y0: 0, delay, baseDelay: 0, color: colorFor(ci, si), labelY: yOf(v), showLabel: true, value: v, tip })
      }
    })
  })

  const progress = useRef(animate ? 0 : 1)
  const started = useRef(0)
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    progress.current = animate && !reduce ? 0 : 1
    started.current = performance.now()
  }, [animate, p.data, layout, barHeight])
  const spin = useRef()
  useFrame((_, dt) => {
    if (progress.current < 1) progress.current = Math.min(1, (performance.now() - started.current) / Math.max(1, duration))
    if (autoRotate && spin.current && !hov) spin.current.rotation.y += dt * 0.25
  })

  const fd = (depth || bw) + 1.0
  const fw = width + 0.8
  const backZ = -fd / 2 + 0.05
  const fontSize = multi && lay === 'grouped' ? 12 : multi && lay === 'rows' ? 14 : 20

  return (
    <>
      <Rig tilt={p.tilt} turn={p.turn} span={[fw, fd]} height={H} />
      <group ref={spin}>
        {showFloor && (
          <RoundedBox args={[fw, 0.14, fd]} radius={0.06} smoothness={3} position={[0, -0.07, 0]} receiveShadow>
            <meshStandardMaterial color={floorColor} roughness={0.85} />
          </RoundedBox>
        )}
        {showAxis &&
          ticks.map((t, i) => (
            <group key={i}>
              <Line points={[[-fw / 2 + 0.15, yOf(t) + 0.002, backZ], [fw / 2 - 0.15, yOf(t) + 0.002, backZ]]} color={gridColor} lineWidth={1.4} dashed={i > 0} dashSize={0.12} gapSize={0.08} />
              <Html position={[-fw / 2 - 0.05, yOf(t), backZ]} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
                <div style={{ fontFamily: FONT, fontSize: 11, fontWeight: 600, color: mutedColor, whiteSpace: 'nowrap', transform: 'translateX(-60%)', userSelect: 'none' }}>{fmt(t)}</div>
              </Html>
            </group>
          ))}
        {bars.map((b) => (
          <Bar
            key={b.key}
            b={b}
            shape={shape}
            bevel={bevel}
            gloss={gloss}
            progress={progress}
            hov={hov}
            setHov={setHov}
            enter={b.tip}
            valueLabel={fmt(b.value)}
            labelColor={labelColor}
            textColor={textColor}
            halo={p.background}
            fontSize={fontSize}
            showValues={showValues}
          />
        ))}
        {rows.map((r, ci) => (
          <Html key={`c${ci}`} position={[x0 + ci * pitch, 0.02, (lay === 'rows' ? z0 + (S - 1) * zPitch : 0) + bw / 2 + 0.38]} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
            <div style={{ fontFamily: FONT, fontSize: 13, fontWeight: 600, color: hov && hov.startsWith(`${ci}-`) ? textColor : mutedColor, whiteSpace: 'nowrap', userSelect: 'none' }}>{r.label}</div>
          </Html>
        ))}
      </group>
    </>
  )
}

export default function Bar3DChart({
  data = 'Jan:32, Feb:48, Mar:41, Apr:66, May:58, Jun:82',
  series = '',
  title = 'Monthly sales',
  subtitle = 'Units sold, first half of the year',
  layout = 'grouped',
  shape = 'box',
  tilt = 24,
  turn = -22,
  barHeight = 3,
  gap = 0.32,
  bevel = 0.08,
  gloss = 0.6,
  colorByBar = true,
  showValues = true,
  showAxis = true,
  showFloor = true,
  labelColor = 'text',
  showLegend = true,
  autoRotate = false,
  interactive = true,
  animate = true,
  duration = 1400,
  decimals = 0,
  prefix = '',
  suffix = '',
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
  const rows = useMemo(() => parseRows(data), [data])
  const S = Math.max(1, ...rows.map((r) => r.values.length))
  const nm = splitNames(series)
  const sNames = Array.from({ length: S }, (_, i) => nm[i] ?? `Series ${i + 1}`)
  const palette = [color, color2, color3, color4, color5, color6]
  const d = clamp(Math.round(decimals), 0, 4)
  const fmt = (v) => `${prefix}${v.toLocaleString('en', { minimumFractionDigits: d, maximumFractionDigits: d })}${suffix}`

  return (
    <div
      role="img"
      aria-label={`${title}. 3D bar chart. ${rows.map((r) => `${r.label}: ${r.values.map((v, i) => (S > 1 ? `${sNames[i]} ${fmt(v)}` : fmt(v))).join(', ')}`).join('; ')}`}
      style={{ position: 'relative', width: '100%', height: '100%', minHeight: 320, background, touchAction: 'none', fontFamily: FONT, overflow: 'hidden', ...style }}
    >
      {(title || subtitle) && (
        <div style={{ position: 'absolute', top: 18, left: 0, right: 0, textAlign: 'center', zIndex: 40, pointerEvents: 'none' }}>
          {title && <div style={{ color: textColor, fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em' }}>{title}</div>}
          {subtitle && <div style={{ color: mutedColor, fontSize: 13, marginTop: 2 }}>{subtitle}</div>}
        </div>
      )}
      <Canvas shadows dpr={[1, 2]} camera={{ fov: 32, position: [0, 5, 10] }} gl={{ antialias: true, toneMapping: THREE.NeutralToneMapping }}>
        <color attach="background" args={[background]} />
        <Suspense fallback={null}>
          <Scene {...{ background, rows, data, sNames, layout, shape, gap, barHeight, bevel, gloss, palette, colorByBar, showValues, showAxis, showFloor, labelColor, animate, duration, autoRotate, floorColor, gridColor, textColor, mutedColor, fmt, tilt, turn }} />
          {/* soft studio: a broad top light for the glossy tops, side strips for the walls */}
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
      {showLegend && S > 1 && (
        <div style={{ position: 'absolute', bottom: 16, left: 0, right: 0, display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '6px 18px', zIndex: 40, pointerEvents: 'none' }}>
          {sNames.map((s, i) => (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: mutedColor, fontSize: 13, fontWeight: 600 }}>
              <i style={{ width: 10, height: 10, borderRadius: 3, background: palette[i % palette.length] }} />
              {s}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
