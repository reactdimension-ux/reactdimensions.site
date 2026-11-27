import { useEffect, useId, useMemo, useRef, useState } from 'react'

// ---- shared chart helpers (kept inline so this file copies out on its own) ----
// Data is a plain string: rows are separated by commas, each row is "Label:value"
// or "Label:value|value|value" for several series, e.g. "Q1:42|31, Q2:58|44".
// An array of { label, values: [..] } works too.

const FONT = 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
const num = (v) => {
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : 0
}
function parseRows(data) {
  if (Array.isArray(data)) return data.map((d) => ({ label: String(d.label ?? ''), values: Array.isArray(d.values) ? d.values.map(num) : [num(d.value)] }))
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

// a rounded axis range with tidy tick steps
function niceRange(lo, hi, ticks = 4) {
  if (!(hi > lo)) hi = lo + 1
  const raw = (hi - lo) / ticks
  const mag = 10 ** Math.floor(Math.log10(raw))
  const n = raw / mag
  const step = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag
  return { lo: Math.floor(lo / step + 1e-9) * step, hi: Math.ceil(hi / step - 1e-9) * step, step }
}
const ticksOf = (r) => {
  const out = []
  for (let t = r.lo; t <= r.hi + r.step * 1e-6; t += r.step) out.push(Math.abs(t) < r.step * 1e-6 ? 0 : t)
  return out
}
function makeFmt({ valueFormat = 'number', decimals = 0, prefix = '', suffix = '' }) {
  const d = Math.max(0, Math.min(6, Math.round(decimals)))
  const nf =
    valueFormat === 'compact'
      ? new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: Math.max(1, d) })
      : new Intl.NumberFormat('en', { minimumFractionDigits: d, maximumFractionDigits: d })
  return (v) => `${prefix}${nf.format(v)}${suffix}`
}
const axisFmt = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })

function useWidth() {
  const ref = useRef(null)
  const [w, setW] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    setW(el.clientWidth)
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => setW(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, w]
}

// 0 -> 1 over `ms`, restarted whenever `key` changes; jumps to 1 for reduced motion
function useReveal(on, ms, key) {
  const [p, setP] = useState(on ? 0 : 1)
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (!on || reduce) return setP(1)
    let raf
    let t0
    setP(0)
    const tick = (t) => {
      t0 ??= t
      const k = Math.min(1, (t - t0) / Math.max(1, ms))
      setP(k)
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [on, ms, key])
  return p
}
const ease = (x) => 1 - (1 - x) ** 3
// each item starts a little after the one before it
const stag = (p, i, n) => ease(Math.min(1, Math.max(0, (p - (n > 1 ? (i / (n - 1)) * 0.45 : 0)) / 0.55)))
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))

// a rect path with a radius for each corner [top-left, top-right, bottom-right, bottom-left]
function rrect(x, y, w, h, r = [0, 0, 0, 0]) {
  w = Math.max(0, w)
  h = Math.max(0, h)
  const [a, b, c, d] = r.map((v) => Math.max(0, Math.min(v, w / 2, h / 2)))
  return `M${x + a},${y}H${x + w - b}Q${x + w},${y} ${x + w},${y + b}V${y + h - c}Q${x + w},${y + h} ${x + w - c},${y + h}H${x + d}Q${x},${y + h} ${x},${y + h - d}V${y + a}Q${x},${y} ${x + a},${y}Z`
}

// blend two #rrggbb colours
function mix(a, b, t) {
  const h = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16) || 0)
  const [A, B] = [h(a), h(b)]
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('')
}

// pointer position inside the card, for placing the tooltip
function tipAt(e, wrap, title, rows) {
  const box = wrap.current?.getBoundingClientRect()
  if (!box) return null
  return { x: clamp(e.clientX - box.left, 80, Math.max(80, box.width - 80)), y: e.clientY - box.top - 10, title, rows }
}

function Card({ wrapRef, width, background, color, textColor, mutedColor, size, title, subtitle, legend, children, tip }) {
  return (
    <div
      ref={wrapRef}
      style={{
        position: 'relative',
        width: `min(${width}px, 100%)`,
        boxSizing: 'border-box',
        padding: '1.35em 1.4em 1.2em',
        borderRadius: 18,
        color: textColor,
        fontFamily: FONT,
        fontSize: size,
        lineHeight: 1.35,
        background: `radial-gradient(120% 90% at 0% 0%, ${color}1c, transparent 55%), ${background}`,
        border: `1px solid ${mutedColor}26`,
        boxShadow: '0 28px 60px -28px #000c, inset 0 1px 0 #ffffff0f',
      }}
    >
      {(title || subtitle || legend) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.6em 1.2em', flexWrap: 'wrap', marginBottom: '0.9em' }}>
          <div style={{ minWidth: 0 }}>
            {title && <div style={{ fontSize: '1.25em', fontWeight: 650, letterSpacing: '-0.01em' }}>{title}</div>}
            {subtitle && <div style={{ color: mutedColor, fontSize: '0.88em', marginTop: '0.15em' }}>{subtitle}</div>}
          </div>
          {legend}
        </div>
      )}
      {children}
      {tip && (
        <div
          role="tooltip"
          style={{
            position: 'absolute',
            left: tip.x,
            top: tip.y,
            transform: 'translate(-50%, -100%)',
            pointerEvents: 'none',
            padding: '0.55em 0.8em',
            borderRadius: 11,
            background: '#0c0d10ec',
            border: `1px solid ${mutedColor}33`,
            backdropFilter: 'blur(10px)',
            boxShadow: '0 14px 34px -10px #000d',
            fontSize: '0.88em',
            whiteSpace: 'nowrap',
            zIndex: 5,
          }}
        >
          <div style={{ fontWeight: 650, marginBottom: tip.rows?.length ? '0.3em' : 0 }}>{tip.title}</div>
          {tip.rows?.map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.55em', color: r.strong ? textColor : mutedColor, fontWeight: r.strong ? 650 : 400 }}>
              {r.color && <i style={{ width: '0.6em', height: '0.6em', borderRadius: '50%', background: r.color, flex: 'none' }} />}
              <span style={{ flex: 1 }}>{r.label}</span>
              <span style={{ color: textColor, fontVariantNumeric: 'tabular-nums', marginLeft: '1em' }}>{r.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Legend({ items, onHover, mutedColor }) {
  return (
    <div role="list" style={{ display: 'flex', gap: '0.35em 1em', flexWrap: 'wrap', fontSize: '0.85em', color: mutedColor, paddingTop: '0.2em' }}>
      {items.map((it, i) => (
        <span key={i} role="listitem" onMouseEnter={() => onHover?.(i)} onMouseLeave={() => onHover?.(null)} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45em' }}>
          <i style={{ width: '0.7em', height: '0.7em', borderRadius: '50%', background: it.color, boxShadow: `0 0 0.8em ${it.color}88` }} />
          {it.label}
        </span>
      ))}
    </div>
  )
}
// ---- end shared helpers ----

// ---- time-series helpers ----
// Series are rows "Name:v|v|v|..." with `labels` naming the x positions ("Jan, Feb, ...").
// Leave `data` empty for a seeded demo set (series, points, seed, volatility, trend).
function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const gauss = (r) => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r())
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function synthSeries({ series, points, seed, volatility, trend }) {
  const S = clamp(Math.round(series), 1, 6)
  const n = clamp(Math.round(points), 3, 400)
  return Array.from({ length: S }, (_, s) => {
    const r = rng(Math.round(seed) * 89 + s * 211 + 1)
    const base = 34 + s * 14 + r() * 10
    const amp = 4 + r() * 6
    const ph = r() * 6.28
    let walk = 0
    return Array.from({ length: n }, (_, i) => {
      walk += gauss(r) * 1.6 * volatility
      const v = base + trend * i * (0.35 + 0.25 * s) * (40 / n) + amp * Math.sin((i / n) * Math.PI * 4 + ph) + walk
      return Math.max(1, +v.toFixed(1))
    })
  })
}
function useSeries({ data, series, points, seed, volatility, trend, names, labels }) {
  return useMemo(() => {
    const rows = String(data ?? '').trim() ? parseRows(data) : null
    const nm = splitNames(names)
    const S = rows ? rows.map((r, i) => ({ label: r.label || nm[i] || `Series ${i + 1}`, values: r.values })) : synthSeries({ series, points, seed, volatility, trend }).map((values, i) => ({ label: nm[i] ?? `Series ${i + 1}`, values }))
    const n = Math.max(1, ...S.map((s) => s.values.length))
    const lb = splitNames(labels)
    const x = Array.from({ length: n }, (_, i) => lb[i] ?? MONTHS[i % 12] + (n > 12 && i % 12 === 0 ? ` ’${String(25 + Math.floor(i / 12)).padStart(2, '0')}` : ''))
    return { S, n, x }
  }, [data, series, points, seed, volatility, trend, names, labels])
}

// smooth curve that never overshoots the data (monotone cubic)
function monotone(P) {
  const n = P.length
  if (n < 3) return 'M' + P.map((p) => p.join(',')).join('L')
  const dx = []
  const m = []
  for (let i = 0; i < n - 1; i++) {
    dx[i] = P[i + 1][0] - P[i][0] || 1e-6
    m[i] = (P[i + 1][1] - P[i][1]) / dx[i]
  }
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
  let d = `M${P[0]}`
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3
    d += `C${P[i][0] + h},${P[i][1] + t[i] * h} ${P[i + 1][0] - h},${P[i + 1][1] - t[i + 1] * h} ${P[i + 1]}`
  }
  return d
}
// a path through points: linear, smooth, or step (after / before / middle)
function linePath(P, curve = 'linear', cont = false) {
  if (!P.length) return ''
  if (curve === 'smooth') return cont ? monotone(P).replace(/^M/, 'L') : monotone(P)
  let d = (cont ? 'L' : 'M') + P[0]
  for (let i = 1; i < P.length; i++) {
    const [x0] = P[i - 1]
    const [x, y] = P[i]
    if (curve === 'step' || curve === 'step-after') d += `H${x}V${y}`
    else if (curve === 'step-before') d += `V${y}H${x}`
    else if (curve === 'step-middle') d += `H${(x0 + x) / 2}V${y}H${x}`
    else d += `L${x},${y}`
  }
  return d
}
// a filled band between an upper and a lower line
function bandPath(top, bottom, curve) {
  const back = [...bottom].reverse()
  const rc = curve === 'step' || curve === 'step-after' ? 'step-before' : curve === 'step-before' ? 'step-after' : curve
  return linePath(top, curve) + linePath(back, rc, true) + 'Z'
}
// "A>B, B>C" -> [{ path: ['A', 'B'] }]
function parseLinks(data, sep = '>') {
  return String(data ?? '')
    .split(/[,;\n]/)
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => ({ path: x.split(sep).map((s) => s.trim()).filter(Boolean) }))
    .filter((l) => l.path.length >= 2)
}
const rampColor = (stops, t) => {
  const k = clamp(t, 0, 1) * (stops.length - 1)
  const i = Math.min(stops.length - 2, Math.floor(k))
  return mix(stops[i], stops[i + 1], k - i)
}
const inkOn = (c) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16) / 255)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.55 ? '#0b0b0d' : '#ffffff'
}
function quant(s, q) {
  const i = (s.length - 1) * q
  const lo = Math.floor(i)
  return s[lo] + (s[Math.ceil(i)] - s[lo]) * (i - lo)
}
// show every k-th x label so they don't collide
const labelStep = (labels, step, size) => Math.max(1, Math.ceil((Math.max(...labels.map((s) => s.length)) * size * 0.6 + 10) / Math.max(1, step)))
// ---- end time-series helpers ----

// Gantt chart: tasks as bars on a timeline. Each task is "Name:start|end|progress|group"
// in days from `startDate` (progress 0 to 100; a task that starts and ends on the same
// day is a milestone diamond). `dependencies` draws arrows ("Design>Build"). A today
// line, weekend shading and group colours are built in; hover shows dates and duration.
export default function GanttChart({
  data = 'Research:0|9|100|1, Wireframes:6|15|100|1, Visual design:13|26|80|1, Design review:26|26|0|1, API:10|30|65|2, Frontend:20|42|40|2, Integration:38|48|10|2, QA:44|54|0|3, Beta:52|60|0|3, Launch:61|61|0|3',
  dependencies = 'Research>Wireframes, Wireframes>Visual design, Visual design>Design review, API>Integration, Frontend>Integration, Integration>QA, QA>Beta, Beta>Launch',
  groups = 'Design, Build, Ship',
  startDate = '2026-03-02',
  today = 31,
  title = 'Product launch plan',
  subtitle = 'Spring release',
  scale = 'weeks',
  rowHeight = 26,
  barRadius = 6,
  showProgress = true,
  showDependencies = true,
  showToday = true,
  showWeekends = true,
  showLabels = true,
  tooltip = true,
  animate = true,
  duration = 1200,
  width = 740,
  size = 13,
  color = '#d77757',
  color2 = '#5b9bd5',
  color3 = '#4eba65',
  color4 = '#b48ead',
  todayColor = '#e5534b',
  background = '#111214',
  textColor = '#ececec',
  mutedColor = '#8b8f98',
}) {
  const id = useId().replace(/:/g, '')
  const wrap = useRef(null)
  const [boxRef, boxW] = useWidth()
  const pal = [color, color2, color3, color4]
  const gNames = splitNames(groups)
  const tasks = useMemo(() => parseRows(data).map((r, i) => ({ i, name: r.label, s: r.values[0] ?? 0, e: Math.max(r.values[0] ?? 0, r.values[1] ?? 0), prog: clamp(r.values[2] ?? 0, 0, 100), g: Math.max(0, Math.round(r.values[3] ?? 1) - 1) })), [data])
  const deps = useMemo(() => parseLinks(dependencies).map((d) => [tasks.findIndex((t) => t.name === d.path[0]), tasks.findIndex((t) => t.name === d.path[1])]).filter(([a, b]) => a >= 0 && b >= 0), [dependencies, tasks])
  const p = useReveal(animate, duration, `${data}|${scale}`)
  const [hov, setHov] = useState(-1)
  const [tip, setTip] = useState(null)

  const d0 = useMemo(() => { const d = new Date(startDate); return isNaN(d) ? new Date(2026, 2, 2) : d }, [startDate])
  const dateOf = (day) => { const d = new Date(d0); d.setDate(d.getDate() + Math.round(day)); return d }
  const fmtDate = (day) => { const d = dateOf(day); return `${MONTHS[d.getMonth()]} ${d.getDate()}` }
  const end = Math.max(1, ...tasks.map((t) => t.e)) + 2
  const W = Math.max(300, (boxW || width) - size * 2.8)
  const maxLab = Math.min(18, Math.max(1, ...tasks.map((t) => t.name.length)))
  const m = { l: showLabels ? maxLab * size * 0.6 + 16 : 6, r: 10, t: size * 2.2, b: 6 }
  const pw = Math.max(80, W - m.l - m.r)
  const rh = Math.max(16, rowHeight)
  const H = m.t + tasks.length * rh + m.b
  const X = (day) => m.l + (day / end) * pw
  const unit = scale === 'days' ? 1 : scale === 'months' ? 30 : 7
  const ticks = []
  for (let d = 0; d <= end; d += unit) ticks.push(d)
  const bh = rh * 0.6

  const show = (e, t) => {
    setHov(t.i)
    if (!tooltip) return
    const ms = t.s === t.e
    setTip(tipAt(e, wrap, t.name, [
      { color: pal[t.g % 4], label: gNames[t.g] ?? `Group ${t.g + 1}`, value: ms ? 'Milestone' : `${t.e - t.s} days`, strong: true },
      { label: ms ? 'Date' : 'Dates', value: ms ? fmtDate(t.s) : `${fmtDate(t.s)} to ${fmtDate(t.e)}` },
      ...(!ms ? [{ label: 'Done', value: `${Math.round(t.prog)}%` }] : []),
    ]))
  }

  return (
    <Card
      wrapRef={(el) => { wrap.current = el; boxRef.current = el }}
      {...{ width, background, color, textColor, mutedColor, size, title, subtitle, tip }}
      legend={<Legend items={[...new Set(tasks.map((t) => t.g))].sort().map((g) => ({ label: gNames[g] ?? `Group ${g + 1}`, color: pal[g % 4] }))} mutedColor={mutedColor} />}
    >
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${title}. Gantt chart with ${tasks.length} tasks from ${fmtDate(0)} to ${fmtDate(end - 2)}.`}
        style={{ display: 'block', maxWidth: '100%', overflow: 'visible' }}
        onMouseLeave={() => { setHov(-1); setTip(null) }}
      >
        <defs>
          {pal.map((c, k) => (
            <linearGradient key={k} id={`${id}g${k}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor={c} />
              <stop offset="1" stopColor={mix(c, '#ffffff', 0.18)} />
            </linearGradient>
          ))}
          <marker id={`${id}ar`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M0,0L8,4L0,8z" fill={mutedColor} />
          </marker>
        </defs>

        {/* weekends and grid */}
        {showWeekends && unit < 30 && Array.from({ length: end }, (_, d) => { const wd = dateOf(d).getDay(); return wd === 6 ? <rect key={d} x={X(d)} y={m.t} width={X(d + 2) - X(d)} height={H - m.t - m.b} fill={mutedColor} fillOpacity="0.05" /> : null })}
        {ticks.map((d, i) => (
          <g key={i}>
            <line x1={X(d)} x2={X(d)} y1={m.t - 4} y2={H - m.b} stroke={mutedColor} strokeOpacity="0.14" />
            <text x={X(d) + 4} y={m.t - size * 0.8} fontSize={size * 0.78} fill={mutedColor}>{fmtDate(d)}</text>
          </g>
        ))}
        {tasks.map((t, r) => r % 2 === 1 && <rect key={`z${r}`} x={m.l} y={m.t + r * rh} width={pw} height={rh} fill={mutedColor} fillOpacity="0.035" />)}

        {/* dependency arrows */}
        {showDependencies && deps.map(([a, b], k) => {
          const A = tasks[a]
          const B = tasks[b]
          const x1 = X(A.e)
          const y1 = m.t + a * rh + rh / 2
          const x2 = X(B.s) - (B.s === B.e ? bh * 0.5 : 2)
          const y2 = m.t + b * rh + rh / 2
          const mx = Math.max(x1 + 8, Math.min(x2 - 8, x1 + 12))
          const on = hov < 0 || hov === a || hov === b
          return <path key={k} d={x2 > x1 + 14 ? `M${x1},${y1}H${mx}V${y2}H${x2}` : `M${x1},${y1}h8V${(y1 + y2) / 2}H${x2 - 10}V${y2}H${x2}`} fill="none" stroke={mutedColor} strokeOpacity={on ? 0.75 : 0.15} strokeWidth="1.3" markerEnd={`url(#${id}ar)`} opacity={clamp((p - 0.6) * 2.5, 0, 1)} style={{ transition: 'stroke-opacity .2s' }} />
        })}

        {tasks.map((t, r) => {
          const ip = stag(p, r, tasks.length)
          const y = m.t + r * rh + (rh - bh) / 2
          const c = pal[t.g % 4]
          const on = hov < 0 || hov === t.i || deps.some(([a, b]) => (a === hov && b === t.i) || (b === hov && a === t.i))
          const ms = t.s === t.e
          const w = (X(t.e) - X(t.s)) * ip
          return (
            <g key={t.i} opacity={on ? 1 : 0.35} style={{ transition: 'opacity .2s' }} onMouseEnter={(e) => show(e, t)} onMouseMove={(e) => show(e, t)}>
              <rect x={0} y={m.t + r * rh} width={W} height={rh} fill="transparent" />
              {showLabels && <text x={m.l - 10} y={m.t + r * rh + rh / 2} dy="0.34em" textAnchor="end" fontSize={size * 0.9} fontWeight={hov === t.i ? 650 : 400} fill={hov === t.i ? textColor : mutedColor}>{t.name.length > 18 ? t.name.slice(0, 17) + '…' : t.name}</text>}
              {ms ? (
                <path d={`M${X(t.s)},${y - 1}l${bh * 0.55},${bh / 2 + 1}l-${bh * 0.55},${bh / 2 + 1}l-${bh * 0.55},-${bh / 2 + 1}z`} fill={c} opacity={ip} style={{ filter: `drop-shadow(0 0 ${size * 0.5}px ${c})` }} />
              ) : (
                <>
                  <path d={rrect(X(t.s), y, w, bh, [barRadius, barRadius, barRadius, barRadius])} fill={c} fillOpacity="0.28" stroke={c} strokeOpacity="0.6" />
                  {showProgress && t.prog > 0 && <path d={rrect(X(t.s), y, w * (t.prog / 100), bh, [barRadius, barRadius, barRadius, barRadius])} fill={`url(#${id}g${t.g % 4})`} style={{ filter: hov === t.i ? `drop-shadow(0 0 ${size * 0.6}px ${c})` : undefined }} />}
                  {showProgress && w > size * 3.2 && <text x={X(t.s) + 7} y={y + bh / 2} dy="0.34em" fontSize={size * 0.72} fontWeight="700" fill="#fff" opacity={ip} style={{ pointerEvents: 'none' }}>{`${Math.round(t.prog)}%`}</text>}
                </>
              )}
            </g>
          )
        })}

        {showToday && today >= 0 && today <= end && (
          <g style={{ pointerEvents: 'none' }}>
            <line x1={X(today)} x2={X(today)} y1={m.t - 6} y2={H - m.b} stroke={todayColor} strokeWidth="1.6" />
            <rect x={X(today) - size * 1.9} y={m.t - size * 1.75} width={size * 3.8} height={size * 1.3} rx={size * 0.65} fill={todayColor} />
            <text x={X(today)} y={m.t - size * 1.1} dy="0.34em" textAnchor="middle" fontSize={size * 0.7} fontWeight="700" fill="#fff">TODAY</text>
          </g>
        )}
      </svg>
    </Card>
  )
}
