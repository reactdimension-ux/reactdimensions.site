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

// Sparklines: tiny trend lines with no axes, here as a list of metrics, each with its
// current value and change. Each sparkline can be a line, an area, bars or win/loss
// ticks, with an end dot, high/low marks and a shaded "normal" band. Hover scrubs
// along a sparkline and swaps the number for that point. Rows are "Name:v|v|v".
export default function Sparklines({
  data = '',
  names = 'Revenue, Active users, Conversion, Churn',
  points = 30,
  seed = 21,
  volatility = 1.2,
  trend = 0.6,
  title = 'Last 30 days',
  subtitle = '',
  type = 'area',
  sparkWidth = 200,
  sparkHeight = 38,
  strokeWidth = 2,
  showEnd = true,
  showMinMax = true,
  showBand = false,
  showDelta = true,
  invertDelta = 'Churn',
  curve = 'smooth',
  animate = true,
  duration = 1200,
  valueFormat = 'compact',
  decimals = 1,
  prefix = '',
  suffix = '',
  width = 520,
  size = 13,
  color = '#d77757',
  upColor = '#4eba65',
  downColor = '#e5534b',
  colorByTrend = true,
  background = '#111214',
  textColor = '#ececec',
  mutedColor = '#8b8f98',
}) {
  const id = useId().replace(/:/g, '')
  const fmt = makeFmt({ valueFormat, decimals, prefix, suffix })
  const { S } = useSeries({ data, series: splitNames(names).length || 4, points, seed, volatility, trend, names, labels: '' })
  const p = useReveal(animate, duration, `${data}|${points}|${seed}|${type}`)
  const [scrub, setScrub] = useState(null) // { k, i }
  const inverted = new Set(splitNames(invertDelta))
  const [boxRef, boxW] = useWidth()
  const sw = Math.max(60, Math.min(sparkWidth, (boxW || width) * 0.45))
  const sh = sparkHeight

  return (
    <Card wrapRef={(el) => (boxRef.current = el)} {...{ width, background, color, textColor, mutedColor, size, title, subtitle }}>
      <div role="list" style={{ display: 'grid', gap: '0.15em' }}>
        {S.map((s, k) => {
          const v = s.values
          const n = v.length
          const first = v[0]
          const last = v[n - 1]
          const lo = Math.min(...v)
          const hi = Math.max(...v)
          const span = hi - lo || 1
          const X = (i) => 3 + (n > 1 ? (i / (n - 1)) * (sw - 6) : 0)
          const Y = (val) => 3 + (sh - 6) - ((val - lo) / span) * (sh - 6)
          const change = first ? (last - first) / Math.abs(first) : 0
          const good = inverted.has(s.label) ? change <= 0 : change >= 0
          const c = colorByTrend ? (good ? upColor : downColor) : color
          const P = v.map((val, i) => [X(i), Y(val)])
          const si = scrub && scrub.k === k ? scrub.i : null
          const shown = si != null ? v[si] : last
          const q1 = quant([...v].sort((a, b) => a - b), 0.25)
          const q3 = quant([...v].sort((a, b) => a - b), 0.75)
          const mean = v.reduce((a, b) => a + b, 0) / n
          const iMax = v.indexOf(hi)
          const iMin = v.indexOf(lo)
          const reveal = sw * ease(p)
          return (
            <div key={k} role="listitem" style={{ display: 'grid', gridTemplateColumns: `minmax(0,1fr) ${sw}px minmax(6.2em, auto)`, alignItems: 'center', gap: '1em', padding: '0.55em 0', borderTop: k ? `1px solid ${mutedColor}1f` : 'none' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ color: mutedColor, fontSize: '0.85em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.label}</div>
                <div style={{ fontSize: '1.35em', fontWeight: 700, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>{fmt(shown)}</div>
              </div>
              <svg
                width={sw}
                height={sh}
                viewBox={`0 0 ${sw} ${sh}`}
                role="img"
                aria-label={`${s.label}: from ${fmt(first)} to ${fmt(last)}, high ${fmt(hi)}, low ${fmt(lo)}`}
                style={{ display: 'block', overflow: 'visible', cursor: 'crosshair' }}
                onMouseMove={(e) => {
                  const b = e.currentTarget.getBoundingClientRect()
                  setScrub({ k, i: clamp(Math.round(((e.clientX - b.left) / b.width) * (n - 1)), 0, n - 1) })
                }}
                onMouseLeave={() => setScrub(null)}
              >
                <defs>
                  <linearGradient id={`${id}g${k}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor={c} stopOpacity="0.35" />
                    <stop offset="1" stopColor={c} stopOpacity="0" />
                  </linearGradient>
                  <clipPath id={`${id}c${k}`}>
                    <rect x="-4" y="-8" width={reveal + 8} height={sh + 16} />
                  </clipPath>
                </defs>
                {showBand && <rect x="0" y={Y(q3)} width={sw} height={Math.max(1, Y(q1) - Y(q3))} rx="3" fill={mutedColor} fillOpacity="0.12" />}
                <g clipPath={`url(#${id}c${k})`}>
                  {type === 'bars' &&
                    v.map((val, i) => {
                      const bw = Math.max(1, (sw - 6) / n - 1.5)
                      return <rect key={i} x={X(i) - bw / 2} y={Y(val)} width={bw} height={Math.max(1, sh - 3 - Y(val))} rx={Math.min(2, bw / 2)} fill={si === i ? textColor : c} opacity={si != null && si !== i ? 0.45 : 0.9} />
                    })}
                  {type === 'winloss' &&
                    v.map((val, i) => {
                      if (!i) return null
                      const up = val >= v[i - 1]
                      const bw = Math.max(1, (sw - 6) / n - 1.5)
                      return <rect key={i} x={X(i) - bw / 2} y={up ? sh * 0.12 : sh * 0.54} width={bw} height={sh * 0.34} rx={Math.min(2, bw / 2)} fill={up ? upColor : downColor} opacity={si != null && si !== i ? 0.4 : 0.9} />
                    })}
                  {(type === 'line' || type === 'area') && (
                    <>
                      {type === 'area' && <path d={`${linePath(P, curve)}L${X(n - 1)},${sh}L${X(0)},${sh}Z`} fill={`url(#${id}g${k})`} />}
                      <path d={linePath(P, curve)} fill="none" stroke={c} strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round" />
                    </>
                  )}
                </g>
                {type !== 'winloss' && showBand && <line x1="0" x2={sw} y1={Y(mean)} y2={Y(mean)} stroke={mutedColor} strokeOpacity="0.4" strokeDasharray="2 3" />}
                {showMinMax && type !== 'winloss' && p > 0.95 && (
                  <>
                    <circle cx={X(iMax)} cy={Y(hi)} r="2.4" fill={upColor} />
                    <circle cx={X(iMin)} cy={Y(lo)} r="2.4" fill={downColor} />
                  </>
                )}
                {si != null && type !== 'winloss' && (
                  <>
                    <line x1={X(si)} x2={X(si)} y1="0" y2={sh} stroke={textColor} strokeOpacity="0.35" />
                    <circle cx={X(si)} cy={Y(v[si])} r="3.4" fill={c} stroke={background} strokeWidth="1.5" />
                  </>
                )}
                {showEnd && si == null && type !== 'winloss' && type !== 'bars' && p > 0.95 && <circle cx={X(n - 1)} cy={Y(last)} r="3.4" fill={c} stroke={background} strokeWidth="1.5" style={{ filter: `drop-shadow(0 0 4px ${c})` }} />}
              </svg>
              {showDelta && (
                <div style={{ justifySelf: 'end', display: 'inline-flex', alignItems: 'center', gap: '0.3em', padding: '0.25em 0.6em', borderRadius: 99, fontSize: '0.85em', fontWeight: 700, color: good ? upColor : downColor, background: mix(background, good ? upColor : downColor, 0.14), fontVariantNumeric: 'tabular-nums' }}>
                  {change >= 0 ? '▲' : '▼'} {Math.abs(change * 100).toFixed(1)}%
                </div>
              )}
            </div>
          )
        })}
      </div>
    </Card>
  )
}
