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

// Candlestick chart: open, high, low and close for each period. Candles, OHLC bars or
// smoothed Heikin-Ashi candles; moving-average lines; a volume pane; and a last-price
// tag. Scroll to zoom, drag to pan, and the crosshair shows price and date on the axes.
// Rows are "Date:open|high|low|close|volume", or leave `data` empty for a demo.
export default function CandlestickChart({
  data = '',
  candles = 90,
  seed = 14,
  volatility = 1,
  drift = 0.15,
  title = 'ACME Corp',
  subtitle = 'Daily, last 90 sessions. Scroll to zoom, drag to pan',
  style = 'candles',
  hollowUp = false,
  showVolume = true,
  maPeriod = 20,
  ma2Period = 50,
  showLastPrice = true,
  showGrid = true,
  crosshair = true,
  zoomable = true,
  tooltip = true,
  animate = true,
  duration = 1200,
  decimals = 2,
  prefix = '$',
  width = 720,
  height = 330,
  size = 13,
  upColor = '#4eba65',
  downColor = '#e5534b',
  maColor = '#e0a030',
  ma2Color = '#5b9bd5',
  color = '#d77757',
  background = '#111214',
  textColor = '#ececec',
  mutedColor = '#8b8f98',
}) {
  const id = useId().replace(/:/g, '')
  const wrap = useRef(null)
  const svgRef = useRef(null)
  const [boxRef, boxW] = useWidth()
  const fmt = makeFmt({ decimals, prefix })

  const raw = useMemo(() => {
    if (String(data ?? '').trim()) return parseRows(data).map((r) => ({ d: r.label, o: r.values[0] ?? 0, h: r.values[1] ?? 0, l: r.values[2] ?? 0, c: r.values[3] ?? 0, v: r.values[4] ?? 0 }))
    const r = rng(Math.round(seed) * 59 + 3)
    let price = 120
    const day = new Date(2026, 0, 2)
    return Array.from({ length: clamp(Math.round(candles), 10, 400) }, () => {
      while (day.getDay() === 0 || day.getDay() === 6) day.setDate(day.getDate() + 1)
      const o = price
      const ch = gauss(r) * 0.016 * volatility + drift * 0.002
      const c = Math.max(1, o * (1 + ch))
      const h = Math.max(o, c) * (1 + Math.abs(gauss(r)) * 0.007 * volatility)
      const l = Math.min(o, c) * (1 - Math.abs(gauss(r)) * 0.007 * volatility)
      const label = `${MONTHS[day.getMonth()]} ${day.getDate()}`
      day.setDate(day.getDate() + 1)
      price = c
      return { d: label, o, h, l, c, v: Math.round(1e6 * (0.5 + r() * 0.8 + Math.abs(ch) * 40)) }
    })
  }, [data, candles, seed, volatility, drift])

  const rows = useMemo(() => {
    if (style !== 'heikin-ashi') return raw
    const out = []
    raw.forEach((k, i) => {
      const c = (k.o + k.h + k.l + k.c) / 4
      const o = i ? (out[i - 1].o + out[i - 1].c) / 2 : (k.o + k.c) / 2
      out.push({ ...k, o, c, h: Math.max(k.h, o, c), l: Math.min(k.l, o, c) })
    })
    return out
  }, [raw, style])
  const ma = (per) => (per > 1 ? rows.map((_, i) => (i + 1 >= per ? rows.slice(i + 1 - per, i + 1).reduce((a, k) => a + k.c, 0) / per : null)) : null)
  const ma1 = useMemo(() => ma(Math.round(maPeriod)), [rows, maPeriod]) // eslint-disable-line react-hooks/exhaustive-deps
  const ma2 = useMemo(() => ma(Math.round(ma2Period)), [rows, ma2Period]) // eslint-disable-line react-hooks/exhaustive-deps

  const N = rows.length
  const [view, setView] = useState([0, N])
  useEffect(() => setView([0, N]), [N])
  const [a, b] = [clamp(view[0], 0, N - 5), clamp(view[1], 5, N)]
  const vis = rows.slice(a, b)
  const p = useReveal(animate, duration, `${data}|${candles}|${seed}|${style}`)
  const [hi, setHi] = useState(null) // { i, y }
  const [tip, setTip] = useState(null)
  const dragRef = useRef(null)

  const W = Math.max(280, (boxW || width) - size * 2.8)
  const H = height
  const m = { l: 6, r: size * 4.6, t: 8, b: size * 2 }
  const pw = Math.max(80, W - m.l - m.r)
  const ph = Math.max(80, H - m.t - m.b)
  const priceH = showVolume ? ph * 0.78 : ph
  const volTop = m.t + priceH + 6
  const volH = ph - priceH - 6
  const lo0 = Math.min(...vis.map((k) => k.l), ...[ma1, ma2].flatMap((m_) => (m_ ? m_.slice(a, b).filter((x) => x != null) : [])))
  const hi0 = Math.max(...vis.map((k) => k.h), ...[ma1, ma2].flatMap((m_) => (m_ ? m_.slice(a, b).filter((x) => x != null) : [])))
  const sy = niceRange(lo0 - (hi0 - lo0) * 0.04, hi0 + (hi0 - lo0) * 0.04, 5)
  const yt = ticksOf(sy).filter((t) => t >= sy.lo && t <= sy.hi)
  const step = pw / vis.length
  const X = (i) => m.l + (i - a + 0.5) * step
  const Y = (v) => m.t + priceH - ((v - sy.lo) / (sy.hi - sy.lo)) * priceH
  const vMax = Math.max(1, ...vis.map((k) => k.v))
  const every = labelStep(vis.map((k) => k.d), step, size * 0.85)
  const bodyW = Math.max(1, step * 0.66)

  // wheel zoom needs a non-passive listener so the page doesn't scroll
  useEffect(() => {
    const el = svgRef.current
    if (!el || !zoomable) return
    const onWheel = (e) => {
      e.preventDefault()
      const r = el.getBoundingClientRect()
      setView(([va, vb]) => {
        const len = vb - va
        const f = (e.clientX - r.left - m.l) / pw
        const nl = clamp(Math.round(len * (e.deltaY > 0 ? 1.15 : 0.87)), 10, N)
        const center = va + f * len
        let na = Math.round(center - f * nl)
        na = clamp(na, 0, N - nl)
        return [na, na + nl]
      })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoomable, N, pw, m.l])

  const local = (e) => {
    const r = svgRef.current.getBoundingClientRect()
    return [e.clientX - r.left, e.clientY - r.top]
  }
  const onMove = (e) => {
    const [mx, my] = local(e)
    if (dragRef.current) {
      const dx = Math.round((dragRef.current.x - mx) / step)
      const [va, vb] = dragRef.current.view
      const len = vb - va
      const na = clamp(va + dx, 0, N - len)
      setView([na, na + len])
      return
    }
    const i = clamp(a + Math.floor((mx - m.l) / step), a, b - 1)
    setHi({ i, y: my })
    const k = rows[i]
    const prev = rows[i - 1]
    const ch = prev ? (k.c - prev.c) / prev.c : 0
    if (tooltip) setTip(tipAt(e, wrap, k.d, [
      { label: 'Open', value: fmt(k.o) },
      { label: 'High', value: fmt(k.h) },
      { label: 'Low', value: fmt(k.l) },
      { label: 'Close', value: fmt(k.c), strong: true, color: k.c >= k.o ? upColor : downColor },
      { label: 'Change', value: `${ch >= 0 ? '+' : ''}${(ch * 100).toFixed(2)}%` },
      ...(showVolume ? [{ label: 'Volume', value: axisFmt.format(k.v) }] : []),
    ]))
  }
  const last = rows[N - 1]
  const maPath = (arr) => {
    const P = []
    for (let i = a; i < b; i++) if (arr[i] != null) P.push([X(i), Y(arr[i])])
    return linePath(P, 'smooth')
  }
  const priceY = hi ? clamp(hi.y, m.t, m.t + priceH) : null
  const priceAt = priceY != null ? sy.lo + ((m.t + priceH - priceY) / priceH) * (sy.hi - sy.lo) : null

  return (
    <Card
      wrapRef={(el) => { wrap.current = el; boxRef.current = el }}
      {...{ width, background, color, textColor, mutedColor, size, title, subtitle, tip }}
      legend={
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '1.3em', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmt(last.c)}</div>
          <div style={{ fontSize: '0.85em', fontWeight: 650, color: last.c >= rows[0].o ? upColor : downColor }}>
            {last.c >= rows[0].o ? '▲' : '▼'} {(((last.c - rows[0].o) / rows[0].o) * 100).toFixed(2)}%
            {maPeriod > 1 && <span style={{ color: maColor, marginLeft: '0.8em' }}>{`MA ${Math.round(maPeriod)}`}</span>}
            {ma2Period > 1 && <span style={{ color: ma2Color, marginLeft: '0.6em' }}>{`MA ${Math.round(ma2Period)}`}</span>}
          </div>
        </div>
      }
    >
      <svg
        ref={svgRef}
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${title}. Candlestick chart, ${N} periods, last close ${fmt(last.c)}.`}
        style={{ display: 'block', maxWidth: '100%', overflow: 'visible', touchAction: 'none', userSelect: 'none', cursor: dragRef.current ? 'grabbing' : 'crosshair' }}
        onMouseMove={onMove}
        onMouseDown={(e) => { if (!zoomable) return; const [mx] = local(e); dragRef.current = { x: mx, view: [a, b] }; setTip(null) }}
        onMouseUp={() => (dragRef.current = null)}
        onMouseLeave={() => { dragRef.current = null; setHi(null); setTip(null) }}
      >
        <defs>
          <clipPath id={`${id}c`}>
            <rect x={m.l} y={0} width={pw} height={H} />
          </clipPath>
        </defs>
        {yt.map((t, i) => (
          <g key={i}>
            {showGrid && <line x1={m.l} x2={m.l + pw} y1={Y(t)} y2={Y(t)} stroke={mutedColor} strokeOpacity="0.12" strokeDasharray="2 5" />}
            <text x={m.l + pw + 8} y={Y(t)} dy="0.34em" fontSize={size * 0.8} fill={mutedColor}>{fmt(t)}</text>
          </g>
        ))}
        {vis.map((k, j) => (j % every === 0 ? <text key={j} x={X(a + j)} y={H - size * 0.4} textAnchor="middle" fontSize={size * 0.8} fill={mutedColor}>{k.d}</text> : null))}

        <g clipPath={`url(#${id}c)`}>
          {vis.map((k, j) => {
            const i = a + j
            const up = k.c >= k.o
            const c = up ? upColor : downColor
            const ip = ease(clamp((p - (j / vis.length) * 0.6) / 0.4, 0, 1))
            const mid = (k.o + k.c) / 2
            const S_ = (v) => Y(mid + (v - mid) * ip)
            const x = X(i)
            const dim = hi && hi.i !== i ? 0.8 : 1
            return (
              <g key={i} opacity={dim}>
                {showVolume && <rect x={x - bodyW / 2} y={volTop + volH - (k.v / vMax) * volH * ip} width={bodyW} height={(k.v / vMax) * volH * ip} fill={c} opacity="0.32" rx={Math.min(1.5, bodyW / 4)} />}
                {style === 'ohlc' ? (
                  <g stroke={c} strokeWidth={Math.max(1, Math.min(2, step * 0.14))} strokeLinecap="round">
                    <line x1={x} x2={x} y1={S_(k.h)} y2={S_(k.l)} />
                    <line x1={x - bodyW / 2} x2={x} y1={S_(k.o)} y2={S_(k.o)} />
                    <line x1={x} x2={x + bodyW / 2} y1={S_(k.c)} y2={S_(k.c)} />
                  </g>
                ) : (
                  <>
                    <line x1={x} x2={x} y1={S_(k.h)} y2={S_(k.l)} stroke={c} strokeWidth={Math.max(1, Math.min(1.6, step * 0.12))} />
                    <rect x={x - bodyW / 2} y={Math.min(S_(k.o), S_(k.c))} width={bodyW} height={Math.max(1, Math.abs(S_(k.o) - S_(k.c)))} rx={Math.min(1.5, bodyW / 4)} fill={up && hollowUp ? background : c} stroke={c} strokeWidth={up && hollowUp ? 1.2 : 0} />
                  </>
                )}
              </g>
            )
          })}
          {ma1 && <path d={maPath(ma1)} fill="none" stroke={maColor} strokeWidth="1.8" opacity={clamp((p - 0.5) * 2, 0, 1)} style={{ pointerEvents: 'none' }} />}
          {ma2 && <path d={maPath(ma2)} fill="none" stroke={ma2Color} strokeWidth="1.8" opacity={clamp((p - 0.5) * 2, 0, 1)} style={{ pointerEvents: 'none' }} />}
        </g>

        {showLastPrice && (
          <g style={{ pointerEvents: 'none' }}>
            <line x1={m.l} x2={m.l + pw} y1={Y(last.c)} y2={Y(last.c)} stroke={last.c >= last.o ? upColor : downColor} strokeOpacity="0.6" strokeDasharray="3 4" />
            <rect x={m.l + pw + 2} y={Y(last.c) - size * 0.72} width={m.r - 2} height={size * 1.44} rx="4" fill={last.c >= last.o ? upColor : downColor} />
            <text x={m.l + pw + 8} y={Y(last.c)} dy="0.34em" fontSize={size * 0.8} fontWeight="700" fill="#0b0b0d">{fmt(last.c)}</text>
          </g>
        )}

        {crosshair && hi && !dragRef.current && (
          <g style={{ pointerEvents: 'none' }}>
            <line x1={X(hi.i)} x2={X(hi.i)} y1={m.t} y2={m.t + ph} stroke={textColor} strokeOpacity="0.3" strokeDasharray="3 3" />
            {priceY != null && hi.y <= m.t + priceH && (
              <>
                <line x1={m.l} x2={m.l + pw} y1={priceY} y2={priceY} stroke={textColor} strokeOpacity="0.3" strokeDasharray="3 3" />
                <rect x={m.l + pw + 2} y={priceY - size * 0.72} width={m.r - 2} height={size * 1.44} rx="4" fill={textColor} />
                <text x={m.l + pw + 8} y={priceY} dy="0.34em" fontSize={size * 0.8} fontWeight="700" fill={background}>{fmt(priceAt)}</text>
              </>
            )}
          </g>
        )}
      </svg>
    </Card>
  )
}
