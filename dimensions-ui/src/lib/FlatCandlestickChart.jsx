import { useEffect, useId, useMemo, useRef, useState } from 'react'

// ---- flat infographic helpers (kept inline so this file copies out on its own) ----
// Data is a plain string: rows are separated by commas, each row is "Label:value",
// e.g. "Jan:42, Feb:58". An array of { label, value } works too.

const FONT = '"Poppins", "Nunito", ui-rounded, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif'
const num = (v) => {
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : 0
}
function makeFmt({ decimals = 0, prefix = '', suffix = '' }) {
  const d = Math.max(0, Math.min(6, Math.round(decimals)))
  const nf = new Intl.NumberFormat('en', { minimumFractionDigits: d, maximumFractionDigits: d })
  return (v) => `${prefix}${nf.format(v)}${suffix}`
}
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
// springy ease-out with a small overshoot, for the flat "pop" feel
const pop = (x) => (x >= 1 ? 1 : 1 + 2.2 * (x - 1) ** 3 + 1.2 * (x - 1) ** 2)
const ease = (x) => 1 - (1 - x) ** 3
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
// blend two #rrggbb colours
function mix(a, b, t) {
  const h = (c) => [1, 3, 5].map((i) => parseInt(String(c).slice(i, i + 2), 16) || 0)
  const [A, B] = [h(a), h(b)]
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('')
}
// a rect path with a radius for each corner [top-left, top-right, bottom-right, bottom-left]
function rrect(x, y, w, h, r = [0, 0, 0, 0]) {
  w = Math.max(0, w)
  h = Math.max(0, h)
  const [a, b, c, d] = r.map((v) => Math.max(0, Math.min(v, w / 2, h / 2)))
  return `M${x + a},${y}H${x + w - b}Q${x + w},${y} ${x + w},${y + b}V${y + h - c}Q${x + w},${y + h} ${x + w - c},${y + h}H${x + d}Q${x},${y + h} ${x},${y + h - d}V${y + a}Q${x},${y} ${x + a},${y}Z`
}
function tipAt(e, wrap, title, rows) {
  const box = wrap.current?.getBoundingClientRect()
  if (!box) return null
  return { x: clamp(e.clientX - box.left, 70, Math.max(70, box.width - 70)), y: e.clientY - box.top - 12, title, rows }
}
// the flat card: solid surface, no glow, a soft drop shadow and a chunky title
function Card({ wrapRef, width, background, textColor, mutedColor, size, title, subtitle, children, tip }) {
  return (
    <div
      ref={wrapRef}
      style={{
        position: 'relative',
        width: `min(${width}px, 100%)`,
        boxSizing: 'border-box',
        padding: '1.4em 1.5em 1.2em',
        borderRadius: 22,
        color: textColor,
        fontFamily: FONT,
        fontSize: size,
        lineHeight: 1.35,
        background,
        boxShadow: `0 18px 40px -24px ${mix(textColor, background, 0.3)}66`,
      }}
    >
      {(title || subtitle) && (
        <div style={{ marginBottom: '0.8em' }}>
          {title && <div style={{ fontSize: '1.3em', fontWeight: 700, letterSpacing: '-0.01em' }}>{title}</div>}
          {subtitle && <div style={{ color: mutedColor, fontSize: '0.88em', marginTop: '0.15em' }}>{subtitle}</div>}
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
            padding: '0.5em 0.8em',
            borderRadius: 12,
            background: textColor,
            color: background,
            fontSize: '0.88em',
            whiteSpace: 'nowrap',
            zIndex: 5,
          }}
        >
          <div style={{ fontWeight: 700 }}>{tip.title}</div>
          {tip.rows?.map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5em' }}>
              {r.color && <i style={{ width: '0.65em', height: '0.65em', borderRadius: '50%', background: r.color, flex: 'none' }} />}
              <span style={{ flex: 1, opacity: 0.75 }}>{r.label}</span>
              <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', marginLeft: '0.8em' }}>{r.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
// ---- end flat helpers ----

// ---- time-series helpers ----
// Rows are "Date:open|high|low|close|volume"; leave `data` empty for a seeded demo.
function parseSeriesRows(data) {
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
const axisFmt = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })
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
  for (let t = r.lo; t <= r.hi + r.step * 1e-6; t += r.step) out.push(Math.abs(t) < r.step * 1e-6 ? 0 : +t.toFixed(10))
  return out
}
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
// show every k-th x label so they don't collide
const labelStep = (labels, step, size) => Math.max(1, Math.ceil((Math.max(...labels.map((s) => s.length)) * size * 0.6 + 10) / Math.max(1, step)))
// dark or white text for a label sitting on a coloured shape
const inkOn = (c) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(String(c).slice(i, i + 2), 16) / 255)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.6 ? '#1d2029' : '#ffffff'
}
// ---- end time-series helpers ----

// Flat infographic candlestick chart: open, high, low and close for each period as
// chunky rounded candles (or OHLC bars, or smoothed Heikin-Ashi), thick moving-average
// lines, a rounded volume pane and a solid last-price tag. Candles pop open from their
// midpoints left to right. Scroll to zoom, drag to pan; the crosshair tags the price.
// Rows are "Date:open|high|low|close|volume", or leave `data` empty for a demo.
export default function FlatCandlestickChart({
  data = '',
  candles = 90,
  visible = 40,
  seed = 14,
  volatility = 1,
  drift = 0.15,
  title = 'ACME Corp',
  subtitle = 'Daily sessions. Scroll to zoom out, drag to pan',
  style = 'candles',
  hollowUp = false,
  showVolume = true,
  maPeriod = 20,
  ma2Period = 50,
  maWidth = 3,
  showLastPrice = true,
  showGrid = true,
  showAxis = true,
  axisArrows = true,
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
  upColor = '#14a89e',
  downColor = '#ef5b7f',
  maColor = '#f08a24',
  ma2Color = '#4a7fe8',
  background = '#ffffff',
  gridColor = '#eef0f6',
  textColor = '#2b2f3a',
  mutedColor = '#8a90a0',
}) {
  const uid = useId().replace(/:/g, '')
  const wrap = useRef(null)
  const svgRef = useRef(null)
  const [boxRef, boxW] = useWidth()
  const fmt = makeFmt({ decimals, prefix })

  const raw = useMemo(() => {
    if (String(data ?? '').trim()) return parseSeriesRows(data).map((r) => ({ d: r.label, o: r.values[0] ?? 0, h: r.values[1] ?? 0, l: r.values[2] ?? 0, c: r.values[3] ?? 0, v: r.values[4] ?? 0 }))
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
  // open zoomed in on the latest `visible` candles; the rest are a scroll or drag away
  const startOf = (n) => Math.max(0, n - Math.max(5, Math.round(visible || n)))
  const [view, setView] = useState([startOf(N), N])
  useEffect(() => setView([startOf(N), N]), [N, visible])
  const a = clamp(view[0], 0, Math.max(0, N - 5))
  const b = clamp(view[1], Math.min(N, a + 5), N)
  const vis = rows.slice(a, b)
  const p = useReveal(animate, duration, `${data}|${candles}|${seed}|${style}`)
  const [hi, setHi] = useState(null) // { i, y }
  const [tip, setTip] = useState(null)
  const dragRef = useRef(null)

  const W = Math.max(280, (boxW || width) - size * 3)
  const H = height
  const tagW = Math.max(...[...vis.map((k) => k.h), rows[N - 1]?.c ?? 0].map((v) => fmt(v).length)) * size * 0.62 + size * 1.1
  const m = { l: 6, r: tagW + 6, t: size * 0.8, b: size * 2.2 }
  const pw = Math.max(80, W - m.l - m.r)
  const ph = Math.max(80, H - m.t - m.b)
  const priceH = showVolume ? ph * 0.76 : ph
  const volTop = m.t + priceH + 10
  const volH = ph - priceH - 10
  const maVis = [ma1, ma2].flatMap((m_) => (m_ ? m_.slice(a, b).filter((x) => x != null) : []))
  const lo0 = Math.min(...vis.map((k) => k.l), ...maVis)
  const hi0 = Math.max(...vis.map((k) => k.h), ...maVis)
  const sy = niceRange(lo0 - (hi0 - lo0) * 0.04, hi0 + (hi0 - lo0) * 0.04, 6)
  const yt = ticksOf(sy).filter((t) => t >= sy.lo && t <= sy.hi)
  const step = pw / Math.max(1, vis.length)
  const X = (i) => m.l + (i - a + 0.5) * step
  const Y = (v) => m.t + priceH - ((v - sy.lo) / (sy.hi - sy.lo)) * priceH
  const vMax = Math.max(1, ...vis.map((k) => k.v))
  const every = labelStep(vis.map((k) => k.d), step, size * 0.85)
  const bodyW = Math.max(1.5, step * 0.68)
  const bodyR = Math.min(4, bodyW / 3)
  const wickW = Math.max(1.5, Math.min(3, step * 0.16))

  // wheel zoom needs a non-passive listener so the page doesn't scroll
  useEffect(() => {
    const el = svgRef.current
    if (!el || !zoomable) return
    const onWheel = (e) => {
      e.preventDefault()
      const r = el.getBoundingClientRect()
      setView(([va, vb]) => {
        const len = vb - va
        const f = clamp((e.clientX - r.left - m.l) / pw, 0, 1)
        const nl = clamp(Math.round(len * (e.deltaY > 0 ? 1.15 : 0.87)), Math.min(10, N), N)
        const center = va + f * len
        const na = clamp(Math.round(center - f * nl), 0, N - nl)
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
    if (mx < m.l || mx > m.l + pw) {
      setHi(null)
      setTip(null)
      return
    }
    const i = clamp(a + Math.floor((mx - m.l) / step), a, b - 1)
    setHi({ i, y: my })
    const k = rows[i]
    const prev = rows[i - 1]
    const ch = prev ? (k.c - prev.c) / prev.c : 0
    if (tooltip)
      setTip(
        tipAt(e, wrap, k.d, [
          { label: 'Open', value: fmt(k.o) },
          { label: 'High', value: fmt(k.h) },
          { label: 'Low', value: fmt(k.l) },
          { label: 'Close', value: fmt(k.c), color: k.c >= k.o ? upColor : downColor },
          { label: 'Change', value: `${ch >= 0 ? '+' : ''}${(ch * 100).toFixed(2)}%` },
          ...(showVolume ? [{ label: 'Volume', value: axisFmt.format(k.v) }] : []),
        ]),
      )
  }
  const last = rows[N - 1]
  const first = rows[0]
  const maPath = (arr) => {
    const P = []
    for (let i = a; i < b; i++) if (arr[i] != null) P.push([X(i), Y(arr[i])])
    return P.length > 1 ? linePath(P, 'smooth') : ''
  }
  const priceY = hi ? clamp(hi.y, m.t, m.t + priceH) : null
  const priceAt = priceY != null ? sy.lo + ((m.t + priceH - priceY) / priceH) * (sy.hi - sy.lo) : null
  const totalCh = (last.c - first.o) / first.o
  const chC = totalCh >= 0 ? upColor : downColor
  const lastC = last.c >= last.o ? upColor : downColor
  const maK = clamp((p - 0.5) * 2, 0, 1)
  const tagK = pop(clamp((p - 0.75) / 0.25, 0, 1))

  return (
    <Card wrapRef={(el) => { wrap.current = el; boxRef.current = el }} {...{ width, background, textColor, mutedColor, size, title, subtitle, tip }}>
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5em 1em', marginBottom: '0.8em' }}>
        <span style={{ fontSize: '1.6em', fontWeight: 700, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>{fmt(last.c)}</span>
        <span style={{ padding: '0.25em 0.75em', borderRadius: 99, background: chC, color: inkOn(chC), fontWeight: 700, fontSize: '0.88em', fontVariantNumeric: 'tabular-nums' }}>
          {totalCh >= 0 ? '▲' : '▼'} {Math.abs(totalCh * 100).toFixed(2)}%
        </span>
        <span style={{ flex: 1 }} />
        {[ma1 && { c: maColor, n: Math.round(maPeriod) }, ma2 && { c: ma2Color, n: Math.round(ma2Period) }].filter(Boolean).map((it, i) => (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45em', color: mutedColor, fontSize: '0.88em', fontWeight: 600 }}>
            <i style={{ width: '1.2em', height: '0.32em', borderRadius: 99, background: it.c, flex: 'none' }} />
            {`MA ${it.n}`}
          </span>
        ))}
      </div>
      <svg
        ref={svgRef}
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${title}. Candlestick chart, ${N} periods from ${first.d} to ${last.d}. Opened at ${fmt(first.o)}, last close ${fmt(last.c)} (${totalCh >= 0 ? '+' : '-'}${Math.abs(totalCh * 100).toFixed(2)}%), high ${fmt(Math.max(...rows.map((k) => k.h)))}, low ${fmt(Math.min(...rows.map((k) => k.l)))}.`}
        style={{ display: 'block', overflow: 'visible', touchAction: 'none', userSelect: 'none', cursor: dragRef.current ? 'grabbing' : 'crosshair' }}
        onMouseMove={onMove}
        onMouseDown={(e) => {
          if (!zoomable) return
          const [mx] = local(e)
          dragRef.current = { x: mx, view: [a, b] }
          setTip(null)
        }}
        onMouseUp={() => (dragRef.current = null)}
        onMouseLeave={() => { dragRef.current = null; setHi(null); setTip(null) }}
      >
        <defs>
          <marker id={`ar${uid}`} viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,1 L9,5 L0,9 Z" fill={mutedColor} />
          </marker>
          <clipPath id={`c${uid}`}>
            <rect x={m.l} y={-size} width={pw} height={H + size * 2} />
          </clipPath>
        </defs>

        {yt.map((t, i) => (
          <g key={i}>
            {showGrid && <line x1={m.l} x2={m.l + pw} y1={Y(t)} y2={Y(t)} stroke={gridColor} strokeWidth="2" strokeDasharray="5 7" strokeLinecap="round" />}
            {/* tick labels step aside for the last-price tag and the bottom axis */}
            {!(showLastPrice && Math.abs(Y(t) - Y(last.c)) < size * 1.2) && !(!showVolume && showAxis && i === 0) && (
              <text x={m.l + pw + 10} y={Y(t)} dy="0.35em" fontSize={size * 0.8} fill={mutedColor} style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(t)}</text>
            )}
          </g>
        ))}
        {vis.map((k, j) => (j % every === 0 ? <text key={j} x={X(a + j)} y={m.t + ph + size * 1.55} textAnchor="middle" fontSize={size * 0.85} fontWeight="600" fill={hi && hi.i === a + j ? textColor : mutedColor}>{k.d}</text> : null))}

        <g clipPath={`url(#c${uid})`}>
          {vis.map((k, j) => {
            const i = a + j
            const up = k.c >= k.o
            const c = up ? upColor : downColor
            const ip = pop(clamp((p - (j / Math.max(1, vis.length)) * 0.6) / 0.4, 0, 1))
            const mid = (k.o + k.c) / 2
            const S_ = (v) => Y(mid + (v - mid) * ip)
            const x = X(i)
            const dim = hi && hi.i !== i
            const vh = Math.max(0, (k.v / vMax) * volH * ip)
            const top = Math.min(S_(k.o), S_(k.c))
            const bh = Math.max(2, Math.abs(S_(k.o) - S_(k.c)))
            return (
              <g key={i} opacity={dim ? 0.4 : 1} style={{ transition: 'opacity .15s' }}>
                {showVolume && <path d={rrect(x - bodyW / 2, volTop + volH - vh, bodyW, vh, [bodyR, bodyR, 0, 0])} fill={mix(background, c, 0.4)} />}
                {style === 'ohlc' ? (
                  <g stroke={c} strokeWidth={Math.max(2, Math.min(3.5, step * 0.2))} strokeLinecap="round">
                    <line x1={x} x2={x} y1={S_(k.h)} y2={S_(k.l)} />
                    <line x1={x - bodyW / 2} x2={x} y1={S_(k.o)} y2={S_(k.o)} />
                    <line x1={x} x2={x + bodyW / 2} y1={S_(k.c)} y2={S_(k.c)} />
                  </g>
                ) : (
                  <>
                    <line x1={x} x2={x} y1={S_(k.h)} y2={S_(k.l)} stroke={c} strokeWidth={wickW} strokeLinecap="round" />
                    {up && hollowUp ? (
                      <path d={rrect(x - bodyW / 2 + 1, top + 1, bodyW - 2, Math.max(1, bh - 2), [bodyR, bodyR, bodyR, bodyR])} fill={background} stroke={c} strokeWidth="2" />
                    ) : (
                      <path d={rrect(x - bodyW / 2, top, bodyW, bh, [bodyR, bodyR, bodyR, bodyR])} fill={c} />
                    )}
                  </>
                )}
              </g>
            )
          })}
          {ma1 && maK > 0 && <path d={maPath(ma1)} fill="none" stroke={maColor} strokeWidth={maWidth} strokeLinecap="round" strokeLinejoin="round" opacity={maK} style={{ pointerEvents: 'none' }} />}
          {ma2 && maK > 0 && <path d={maPath(ma2)} fill="none" stroke={ma2Color} strokeWidth={maWidth} strokeLinecap="round" strokeLinejoin="round" opacity={maK} style={{ pointerEvents: 'none' }} />}
        </g>

        {showAxis && (
          <path
            d={`M${m.l},${m.t + ph + 2}H${m.l + pw + (axisArrows ? size * 0.9 : 0)}`}
            stroke={mutedColor}
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
            markerEnd={axisArrows ? `url(#ar${uid})` : undefined}
            style={{ pointerEvents: 'none' }}
          />
        )}

        {showLastPrice && tagK > 0 && Y(last.c) >= m.t - 1 && Y(last.c) <= m.t + priceH + 1 && (
          <g style={{ pointerEvents: 'none' }}>
            <line x1={m.l} x2={m.l + pw} y1={Y(last.c)} y2={Y(last.c)} stroke={lastC} strokeWidth="2" strokeDasharray="4 6" strokeLinecap="round" />
            <g transform={`translate(${m.l + pw + 4} ${Y(last.c)}) scale(${tagK})`}>
              <path d={`M0,0L${size * 0.5},${-size * 0.8}H${m.r - 6}V${size * 0.8}H${size * 0.5}Z`} fill={lastC} strokeLinejoin="round" stroke={lastC} strokeWidth="4" />
              <text x={size * 0.6} dy="0.35em" fontSize={size * 0.82} fontWeight="700" fill={inkOn(lastC)} style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(last.c)}</text>
            </g>
          </g>
        )}

        {crosshair && hi && !dragRef.current && (
          <g style={{ pointerEvents: 'none' }}>
            <line x1={X(hi.i)} x2={X(hi.i)} y1={m.t} y2={m.t + ph} stroke={mutedColor} strokeWidth="1.5" strokeDasharray="4 5" />
            {priceY != null && hi.y <= m.t + priceH && (
              <>
                <line x1={m.l} x2={m.l + pw} y1={priceY} y2={priceY} stroke={mutedColor} strokeWidth="1.5" strokeDasharray="4 5" />
                <g transform={`translate(${m.l + pw + 4} ${priceY})`}>
                  <path d={`M0,0L${size * 0.5},${-size * 0.8}H${m.r - 6}V${size * 0.8}H${size * 0.5}Z`} fill={textColor} strokeLinejoin="round" stroke={textColor} strokeWidth="4" />
                  <text x={size * 0.6} dy="0.35em" fontSize={size * 0.82} fontWeight="700" fill={background} style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(priceAt)}</text>
                </g>
              </>
            )}
          </g>
        )}
      </svg>
    </Card>
  )
}
