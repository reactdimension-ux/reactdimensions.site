import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Html, Lightformer, Line, OrbitControls, RoundedBox } from '@react-three/drei'
import * as THREE from 'three'

// A real 3D stacked area chart: each series is a glossy slab, its area profile
// extruded back in depth and stacked on the layer below with a thin seam between.
// Layers grow up out of the floor one after another, bottom first. The value scale
// sits on a back wall, x labels run along the front and every layer is named at
// its right end. Hover a layer to slide it out and read the value at the nearest x.
// Data is "Series:v1|v2|v3, Series:v1|v2|v3" (one row per series, as AreaChart),
// with `labels` naming the x points.

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
// samples a curve through evenly spaced points: monotone cubic (never overshoots) or straight
function sampleCurve(ys, seg, smooth) {
  const n = ys.length
  if (n < 2) return [ys[0] ?? 0, ys[0] ?? 0]
  if (!smooth || n < 3) {
    const out = []
    for (let i = 0; i < n - 1; i++) for (let u = 0; u < seg; u++) out.push(ys[i] + (ys[i + 1] - ys[i]) * (u / seg))
    out.push(ys[n - 1])
    return out
  }
  const m = []
  for (let i = 0; i < n - 1; i++) m[i] = ys[i + 1] - ys[i]
  const t = [m[0]]
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2
  t[n - 1] = m[n - 2]
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) {
      t[i] = t[i + 1] = 0
      continue
    }
    const a = t[i] / m[i]
    const b = t[i + 1] / m[i]
    const h = a * a + b * b
    if (h > 9) {
      const k = 3 / Math.sqrt(h)
      t[i] = k * a * m[i]
      t[i + 1] = k * b * m[i]
    }
  }
  const out = []
  for (let i = 0; i < n - 1; i++)
    for (let s = 0; s < seg; s++) {
      const u = s / seg
      const u2 = u * u
      const u3 = u2 * u
      out.push((2 * u3 - 3 * u2 + 1) * ys[i] + (u3 - 2 * u2 + u) * t[i] + (-2 * u3 + 3 * u2) * ys[i + 1] + (u3 - u2) * t[i + 1])
    }
  out.push(ys[n - 1])
  return out
}

// one layer: the band between bot[] and top[] (sampled at gx[]) extruded in depth.
// Caps (front / back profile) are material group 0, the walls (top ribbon) group 1.
// A morph target flattens the layer onto its own floor, so it can grow upward.
function layerGeometry(gx, bot, top, depth, b) {
  const shape = new THREE.Shape()
  const n = gx.length
  shape.moveTo(gx[0], bot[0])
  for (let i = 0; i < n; i++) shape.lineTo(gx[i], top[i])
  for (let i = n - 1; i > 0; i--) shape.lineTo(gx[i], bot[i])
  const inner = Math.max(0.01, depth - 2 * b)
  const geo = new THREE.ExtrudeGeometry(shape, { depth: inner, bevelEnabled: b > 0.001, bevelThickness: b, bevelSize: b, bevelSegments: 4, curveSegments: 1, steps: 1 })
  geo.translate(0, 0, -inner / 2)
  const pos = geo.attributes.position
  const flat = new Float32Array(pos.array.length)
  const x0 = gx[0]
  const dx = (gx[n - 1] - x0) / Math.max(1, n - 1)
  for (let v = 0; v < pos.count; v++) {
    const x = pos.getX(v)
    const f = clamp((x - x0) / dx, 0, n - 1)
    const i = Math.min(n - 2, Math.floor(f))
    const floorY = bot[i] + (bot[i + 1] - bot[i]) * (f - i)
    flat[v * 3] = x
    flat[v * 3 + 1] = Math.min(pos.getY(v), floorY)
    flat[v * 3 + 2] = pos.getZ(v)
  }
  geo.morphAttributes.position = [new THREE.BufferAttribute(flat, 3)]
  geo.computeVertexNormals()
  return geo
}

function Layer({ L, gx, depth, bevel, gloss, progress, hov, setHov, hoverLift, textColor, background, fmt, pointX, slideZ }) {
  const geo = useMemo(() => layerGeometry(gx, L.bot, L.top, depth, bevel), [gx, L.bot, L.top, depth, bevel])
  useEffect(() => () => geo.dispose(), [geo])
  const mesh = useRef()
  const grp = useRef()
  const capM = useRef()
  const topM = useRef()
  const cur = useRef({ glow: 0, dim: 0 })
  const cols = useMemo(() => {
    const top = new THREE.Color(L.color)
    const cap = new THREE.Color(mix(L.color, '#000000', 0.18))
    return { top, cap, topDim: new THREE.Color(mix(L.color, background, 0.62)), capDim: new THREE.Color(mix(mix(L.color, '#000000', 0.18), background, 0.62)), tmp: new THREE.Color() }
  }, [L.color, background])
  useLayoutEffect(() => {
    mesh.current?.updateMorphTargets()
  }, [geo])
  const active = hov?.s === L.s
  const others = hov && !active

  useFrame((_, dt) => {
    const k = clamp((progress.current - L.delay) / L.span, 0, 1)
    const c = cur.current
    const f = 1 - Math.exp(-dt * 12)
    c.glow += ((active ? 1 : 0) - c.glow) * f
    c.dim += ((others ? 1 : 0) - c.dim) * f
    const m = mesh.current
    if (m) {
      if (m.morphTargetInfluences) m.morphTargetInfluences[0] = 1 - pop(k)
      m.visible = k > 0
    }
    if (grp.current) grp.current.position.set(0, c.glow * hoverLift * 0.35, c.glow * hoverLift * slideZ)
    if (capM.current) {
      capM.current.color.copy(cols.cap).lerp(cols.capDim, c.dim)
      capM.current.emissiveIntensity = c.glow * 0.18
    }
    if (topM.current) {
      topM.current.color.copy(cols.top).lerp(cols.topDim, c.dim)
      topM.current.emissiveIntensity = c.glow * 0.18
    }
  })

  const pick = (e) => {
    const p = e.object.worldToLocal(e.point.clone())
    return clamp(Math.round((p.x - pointX[0]) / Math.max(1e-6, pointX[1] - pointX[0])), 0, pointX.length - 1)
  }
  const i = active ? hov.i : -1
  return (
    <group ref={grp}>
      <mesh
        ref={mesh}
        geometry={geo}
        castShadow
        receiveShadow
        onPointerOver={(e) => {
          e.stopPropagation()
          setHov({ s: L.s, i: pick(e) })
          document.body.style.cursor = 'pointer'
        }}
        onPointerMove={(e) => {
          e.stopPropagation()
          const ni = pick(e)
          if (!hov || hov.s !== L.s || hov.i !== ni) setHov({ s: L.s, i: ni })
        }}
        onPointerOut={() => {
          setHov(null)
          document.body.style.cursor = ''
        }}
      >
        <meshPhysicalMaterial ref={capM} attach="material-0" color={cols.cap} emissive={L.color} emissiveIntensity={0} roughness={0.48} envMapIntensity={0.5} clearcoat={gloss * 0.7} clearcoatRoughness={0.24} />
        <meshPhysicalMaterial ref={topM} attach="material-1" color={L.color} emissive={L.color} emissiveIntensity={0} roughness={0.4} envMapIntensity={0.55} clearcoat={gloss} clearcoatRoughness={0.18} />
      </mesh>
      {i >= 0 && (
        <>
          <Line points={[[pointX[i], L.botAt[i] + 0.01, depth / 2 + 0.004], [pointX[i], L.topAt[i] - 0.01, depth / 2 + 0.004]]} color="#ffffff" lineWidth={2} transparent opacity={0.9} />
          <mesh position={[pointX[i], L.topAt[i], depth / 2]}>
            <sphereGeometry args={[0.05, 16, 12]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
          <Html position={[pointX[i], L.topAt[i] + 0.28, depth / 2]} center zIndexRange={[30, 20]} style={{ pointerEvents: 'none' }}>
            <div role="tooltip" style={{ fontFamily: FONT, background: textColor, color: '#fff', padding: '6px 10px', borderRadius: 10, fontSize: 13, whiteSpace: 'nowrap', boxShadow: '0 8px 20px -8px #0006', transform: 'translateY(-50%)' }}>
              <div style={{ fontWeight: 600, opacity: 0.7, fontSize: 11 }}>{L.xLabels[i]}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <i style={{ width: 8, height: 8, borderRadius: '50%', background: L.color }} />
                <span>{L.label}</span>
                <b style={{ marginLeft: 8 }}>{fmt(L.values[i] ?? 0)}</b>
                <span style={{ opacity: 0.6, marginLeft: 4 }}>{`${Math.round(L.shares[i] * 100)}%`}</span>
              </div>
            </div>
          </Html>
        </>
      )}
    </group>
  )
}

// the series name (and last value) at the right end of each layer, faded in after its grow
function EndLabel({ L, pos, progress, hov, seriesLabels, labelColor, textColor, mutedColor, background, fmt, fontSize }) {
  const ref = useRef()
  const cur = useRef(1)
  useFrame((_, dt) => {
    const k = clamp((progress.current - L.delay) / L.span, 0, 1)
    const f = 1 - Math.exp(-dt * 12)
    cur.current += ((hov && hov.s !== L.s ? 0.4 : 1) - cur.current) * f
    if (ref.current) ref.current.style.opacity = String(clamp((k - 0.6) / 0.4, 0, 1) * cur.current)
  })
  const last = L.values.length - 1
  const big = seriesLabels === 'value' ? fmt(L.values[last] ?? 0) : seriesLabels === 'percent' ? `${Math.round((L.shares[last] ?? 0) * 100)}%` : null
  const halo = `0 0 3px ${background}, 0 0 3px ${background}, 0 0 6px ${background}`
  return (
    <Html position={pos} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
      <div ref={ref} style={{ opacity: 0, transform: 'translateY(-50%)', fontFamily: FONT, whiteSpace: 'nowrap', userSelect: 'none', lineHeight: 1.1, textShadow: halo, display: 'flex', alignItems: 'baseline', gap: 6 }}>
        {big ? (
          <b style={{ fontWeight: 700, fontSize, color: labelColor === 'slice' ? L.color : textColor }}>{big}</b>
        ) : (
          <i style={{ alignSelf: 'center', width: 8, height: 8, borderRadius: 3, background: L.color }} />
        )}
        <span style={{ fontWeight: 600, fontSize: big ? Math.round(fontSize * 0.8) : Math.round(fontSize * 0.85), color: big ? mutedColor : labelColor === 'slice' ? L.color : textColor }}>{L.label}</span>
      </div>
    </Html>
  )
}

// places the camera on the tilt / turn angles and backs it off to fit the chart and its labels
// camera distance that fits a sphere round the chart and its labels: d = reach / (tan(fov/2) × min(aspect, 1.3))
function fitDistance(span, height, fov, size) {
  const aspect = size.width / Math.max(1, size.height)
  const tanH = Math.tan((fov * Math.PI) / 360)
  const rad = 0.5 * Math.hypot(span[0], span[1], height + 0.9)
  return (rad * clamp(0.86 + (1.3 - aspect) * 0.45, 0.86, 1.06)) / (tanH * Math.min(aspect, 1.3))
}

function Rig({ tilt, turn, height, cx, d }) {
  const { camera, size, controls } = useThree()
  useEffect(() => {
    const e = (clamp(tilt, 5, 80) * Math.PI) / 180
    const a = (clamp(turn, -60, 60) * Math.PI) / 180
    const cy = height * 0.44
    camera.position.set(cx + Math.sin(a) * Math.cos(e) * d, cy + Math.sin(e) * d, Math.cos(a) * Math.cos(e) * d)
    camera.lookAt(cx, cy, 0)
    camera.updateProjectionMatrix()
    if (controls) {
      controls.target.set(cx, cy, 0)
      controls.update()
    }
  }, [camera, controls, size.width, size.height, tilt, turn, height, cx, d])
  return null
}

function Scene(p) {
  const { series, xLabels, mode, curve, thickness, chartHeight, chartWidth, gap, bevel, gloss, hoverLift, palette, seriesLabels, labelColor, showAxis, showFloor, showXLabels, animate, duration, autoRotate, floorColor, gridColor, textColor, mutedColor, background, fmt, turn, compact } = p
  const [hov, setHov] = useState(null)
  const S = series.length
  const n = Math.max(2, ...series.map((s) => s.values.length))
  const W = Math.max(2, chartWidth)
  const H = Math.max(0.5, chartHeight)
  const D = clamp(thickness, 0.2, 4)
  const pct = mode === 'percent'

  const model = useMemo(() => {
    const vals = series.map((s) => Array.from({ length: n }, (_, i) => s.values[i] ?? 0))
    const totals = Array.from({ length: n }, (_, i) => vals.reduce((a, v) => a + v[i], 0))
    const cum = []
    let acc = Array(n).fill(0)
    vals.forEach((v) => {
      acc = acc.map((a, i) => a + (pct ? (totals[i] > 0 ? v[i] / totals[i] : 0) : v[i]))
      cum.push(acc)
    })
    const maxV = pct ? 1 : Math.max(1e-9, ...totals)
    const { ticks, top } = pct ? { ticks: [0, 0.25, 0.5, 0.75, 1], top: 1 } : niceTicks(maxV)
    const yOf = (v) => (v / top) * H
    const smooth = curve !== 'linear'
    const seg = smooth ? 14 : 1
    const b = clamp(bevel, 0, Math.min(0.1, D * 0.2))
    const g = clamp(gap, 0, 0.3)
    const pointX = Array.from({ length: n }, (_, i) => -W / 2 + (W * i) / (n - 1))
    const ns = (n - 1) * seg + 1
    // the geometry is inset by the bevel so its rounded skin lands on the true outline
    const gx = Array.from({ length: ns }, (_, j) => -W / 2 + b + ((W - 2 * b) * j) / (ns - 1))
    let prev = Array(ns).fill(0)
    const layers = cum.map((c, s) => {
      let bnd = sampleCurve(c.map(yOf), seg, smooth).map((y, j) => Math.max(y, prev[j]))
      const botS = prev.map((y) => y + (s > 0 ? g / 2 : 0) + b)
      const topS = bnd.map((y, j) => Math.max(botS[j] + 0.004, y - (s < S - 1 ? g / 2 : 0) - b))
      const L = {
        s,
        label: series[s].label,
        color: palette[s % palette.length],
        values: vals[s],
        shares: vals[s].map((v, i) => (totals[i] > 0 ? v / totals[i] : 0)),
        bot: botS,
        top: topS,
        botAt: pointX.map((_, i) => botS[i * seg]),
        topAt: pointX.map((_, i) => topS[i * seg] + b),
        endMid: (prev[ns - 1] + bnd[ns - 1]) / 2,
        delay: S > 1 ? (s / (S - 1)) * 0.55 : 0,
        span: S > 1 ? 0.45 : 1,
        xLabels,
      }
      prev = bnd
      return L
    })
    return { layers, ticks, yOf, pointX, gx }
  }, [series, n, pct, curve, H, W, D, bevel, gap, palette, xLabels]) // eslint-disable-line react-hooks/exhaustive-deps

  const { layers, ticks, yOf, pointX, gx } = model

  // series names at the right end: keep them apart vertically, but inside the chart height
  const fontSize = compact ? 13 : 15
  const { size, camera } = useThree()
  const fw = W + 0.7
  const fd = D + 1.0
  const labelW = seriesLabels === 'none' ? 0 : compact ? 1.5 : 1.9
  const dist = fitDistance([fw + labelW + 0.9, fd], H, camera.fov, size)
  // world units per screen pixel at the chart's depth, so label spacing holds at any canvas size
  const wpp = (2 * dist * Math.tan((camera.fov * Math.PI) / 360)) / Math.max(1, size.height)
  const ends = useMemo(() => {
    const minSp = (seriesLabels === 'name' ? 17 : fontSize + 6) * wpp
    const order = layers.map((L) => ({ s: L.s, y: L.endMid })).sort((a, b) => a.y - b.y)
    for (let i = 1; i < order.length; i++) order[i].y = Math.max(order[i].y, order[i - 1].y + minSp)
    const over = order.length ? order[order.length - 1].y - (H + 0.1) : 0
    if (over > 0) order.forEach((o) => (o.y -= over))
    for (let i = order.length - 2; i >= 0; i--) order[i].y = Math.min(order[i].y, order[i + 1].y - minSp)
    const out = []
    order.forEach((o) => (out[o.s] = o.y))
    return out
  }, [layers, H, seriesLabels, wpp, fontSize])

  const progress = useRef(animate ? 0 : 1)
  const started = useRef(0)
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    progress.current = animate && !reduce ? 0 : 1
    started.current = performance.now()
  }, [animate, p.data, mode, chartHeight, curve])
  const spin = useRef()
  useFrame((_, dt) => {
    if (progress.current < 1) progress.current = Math.min(1, (performance.now() - started.current) / Math.max(1, duration))
    if (autoRotate && spin.current && !hov) spin.current.rotation.y += dt * 0.25
  })

  const backZ = -fd / 2 + 0.05
  // when the camera swings right the back-left corner tucks in behind the chart, so the scale steps out to stay clear
  const axisX = -fw / 2 - Math.max(0, Math.sin((clamp(turn, -60, 60) * Math.PI) / 180)) * (fd * 1.3 + 0.4)
  // name labels sit off the right end, at whichever corner faces the camera
  const endZ = turn <= 0 ? D / 2 : -D / 2
  const step = Math.max(1, Math.ceil(n / (compact ? 6 : 10)))

  return (
    <>
      <Rig tilt={p.tilt} turn={turn} height={H} cx={labelW * 0.4} d={dist} />
      <group ref={spin}>
        {showFloor && (
          <RoundedBox args={[fw, 0.14, fd]} radius={0.06} smoothness={3} position={[0, -0.07, 0]} receiveShadow>
            <meshStandardMaterial color={floorColor} roughness={0.85} />
          </RoundedBox>
        )}
        {showAxis &&
          ticks.map((t, i) => (
            <group key={i}>
              <Line points={[[axisX + 0.15, yOf(t) + 0.002, backZ], [fw / 2 - 0.15, yOf(t) + 0.002, backZ]]} color={gridColor} lineWidth={1.4} dashed={i > 0} dashSize={0.12} gapSize={0.08} />
              <Html position={[axisX - 0.05, yOf(t), backZ]} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
                <div style={{ fontFamily: FONT, fontSize: 11, fontWeight: 600, color: mutedColor, whiteSpace: 'nowrap', transform: 'translateX(-60%)', userSelect: 'none' }}>{pct ? `${Math.round(t * 100)}%` : fmt(t)}</div>
              </Html>
            </group>
          ))}
        {layers.map((L) => (
          <Layer key={L.s} {...{ L, gx, depth: D, bevel: clamp(bevel, 0, Math.min(0.1, D * 0.2)), gloss, progress, hov, setHov, hoverLift, textColor, background, fmt, pointX, slideZ: 1.2 }} />
        ))}
        {seriesLabels !== 'none' &&
          layers.map((L) => <EndLabel key={`e${L.s}`} {...{ L, pos: [W / 2 + 0.2, ends[L.s], endZ], progress, hov, seriesLabels, labelColor, textColor, mutedColor, background, fmt, fontSize }} />)}
        {showXLabels &&
          pointX.map((x, i) =>
            i % step === 0 || i === n - 1 ? (
              <Html key={`x${i}`} position={[x, 0.02, D / 2 + 0.4]} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
                <div style={{ fontFamily: FONT, fontSize: compact ? 11 : 12.5, fontWeight: 600, color: hov && hov.i === i ? textColor : mutedColor, whiteSpace: 'nowrap', userSelect: 'none' }}>{xLabels[i]}</div>
              </Html>
            ) : null
          )}
      </group>
    </>
  )
}

function Fit({ children }) {
  const { size } = useThree()
  return children(size.width < 560)
}

export default function Stack3DChart({
  data = 'Licences:18|19|19|18|17|15|14|12, Services:9|10|12|13|15|16|18|19, Support:6|6|7|7|8|8|9|10, Cloud:4|7|11|16|22|29|37|46',
  labels = '2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025',
  title = 'Revenue by product',
  subtitle = 'Annual revenue, stacked by product line',
  mode = 'value',
  curve = 'smooth',
  tilt = 24,
  turn = -18,
  thickness = 1.2,
  chartHeight = 3.2,
  chartWidth = 6.4,
  gap = 0.05,
  bevel = 0.05,
  gloss = 0.6,
  hoverLift = 0.25,
  seriesLabels = 'value',
  labelColor = 'slice',
  showAxis = true,
  showFloor = true,
  showXLabels = true,
  showLegend = false,
  autoRotate = false,
  interactive = true,
  animate = true,
  duration = 1500,
  decimals = 0,
  prefix = '$',
  suffix = 'M',
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
  const series = useMemo(() => {
    const rows = parseRows(data).filter((r) => r.values.length)
    return rows.length ? rows : [{ label: 'Series 1', values: [0, 0] }]
  }, [data])
  const n = Math.max(2, ...series.map((s) => s.values.length))
  const xLabels = useMemo(() => {
    const lb = splitNames(labels)
    return Array.from({ length: n }, (_, i) => lb[i] ?? String(i + 1))
  }, [labels, n])
  const palette = useMemo(() => [color, color2, color3, color4, color5, color6], [color, color2, color3, color4, color5, color6])
  const d = clamp(Math.round(decimals), 0, 4)
  const fmt = (v) => `${prefix}${v.toLocaleString('en', { minimumFractionDigits: d, maximumFractionDigits: d })}${suffix}`

  return (
    <div
      role="img"
      aria-label={`${title}. 3D stacked area chart${mode === 'percent' ? ', 100% stacked' : ''}. ${series.map((s) => `${s.label}: ${xLabels.map((x, i) => `${x} ${fmt(s.values[i] ?? 0)}`).join(', ')}`).join('; ')}`}
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
          <Fit>
            {(compact) => (
              <Scene {...{ data, series, xLabels, mode, curve, thickness, chartHeight, chartWidth, gap, bevel, gloss, hoverLift, palette, seriesLabels, labelColor, showAxis, showFloor, showXLabels, animate, duration, autoRotate, floorColor, gridColor, textColor, mutedColor, background, fmt, tilt, turn, compact }} />
            )}
          </Fit>
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
      {showLegend && (
        <div style={{ position: 'absolute', bottom: 16, left: 0, right: 0, display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '6px 18px', zIndex: 40, pointerEvents: 'none' }}>
          {series.map((s, i) => (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: mutedColor, fontSize: 13, fontWeight: 600 }}>
              <i style={{ width: 10, height: 10, borderRadius: 3, background: palette[i % palette.length] }} />
              {s.label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
