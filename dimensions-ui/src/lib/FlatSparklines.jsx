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
// each item starts a little after the one before it
const stag = (p, i, n) => Math.min(1, Math.max(0, (p - (n > 1 ? (i / (n - 1)) * 0.4 : 0)) / 0.6))
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
// Series are rows "Name:v|v|v|..." with `labels` naming the x positions ("Jan, Feb, ...").
// Leave `data` empty for a seeded demo set (series, points, seed, volatility, trend).
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
const splitNames = (s) =>
  String(s ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
function fmtOf({ valueFormat = 'number', decimals = 0, prefix = '', suffix = '' }) {
  if (valueFormat !== 'compact') return makeFmt({ decimals, prefix, suffix })
  const nf = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: Math.max(1, Math.min(6, Math.round(decimals))) })
  return (v) => `${prefix}${nf.format(v)}${suffix}`
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
    const rows = String(data ?? '').trim() ? parseSeriesRows(data) : null
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
// dark or white text for a label sitting on a coloured shape
const inkOn = (c) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(String(c).slice(i, i + 2), 16) / 255)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.6 ? '#1d2029' : '#ffffff'
}
function quant(s, q) {
  const i = (s.length - 1) * q
  const lo = Math.floor(i)
  return s[lo] + (s[Math.ceil(i)] - s[lo]) * (i - lo)
}
// ---- end time-series helpers ----

// Flat infographic sparklines: a list of metrics, each with its big current value, a
// tiny chunky trend (area, line, bars or win/loss ticks) and a solid change pill.
// Rows sweep in one after another and the pills pop. Hover scrubs along a sparkline,
// swapping the number for that point. Rows are "Name:v|v|v", or leave data empty for a demo.
export default function FlatSparklines({
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
  sparkHeight = 42,
  strokeWidth = 3,
  showEnd = true,
  showMinMax = true,
  showBand = false,
  showDelta = true,
  invertDelta = 'Churn',
  curve = 'smooth',
  colorByTrend = true,
  tooltip = true,
  animate = true,
  duration = 1200,
  valueFormat = 'compact',
  decimals = 1,
  prefix = '',
  suffix = '',
  width = 520,
  size = 13,
  upColor = '#14a89e',
  downColor = '#ef5b7f',
  color = '#4a7fe8',
  color2 = '#ef5b7f',
  color3 = '#14a89e',
  color4 = '#f08a24',
  color5 = '#8e5fd6',
  color6 = '#c49a12',
  background = '#ffffff',
  trackColor = '#eef0f6',
  textColor = '#2b2f3a',
  mutedColor = '#8a90a0',
}) {
  const uid = useId().replace(/:/g, '')
  const wrap = useRef(null)
  const fmt = fmtOf({ valueFormat, decimals, prefix, suffix })
  const pal = [color, color2, color3, color4, color5, color6]
  const { S } = useSeries({ data, series: splitNames(names).length || 4, points, seed, volatility, trend, names, labels: '' })
  const p = useReveal(animate, duration, `${data}|${points}|${seed}|${type}`)
  const [scrub, setScrub] = useState(null) // { k, i }
  const [tip, setTip] = useState(null)
  const inverted = new Set(splitNames(invertDelta))
  const [boxRef, boxW] = useWidth()
  const sw = Math.max(60, Math.min(sparkWidth, (boxW || width) * 0.45))
  const sh = Math.max(12, sparkHeight)
  const lw = Math.max(1, strokeWidth)
  const padX = lw + 4
  const padY = lw + 4

  return (
    <Card wrapRef={(el) => { wrap.current = el; boxRef.current = el }} {...{ width, background, textColor, mutedColor, size, title, subtitle, tip }}>
      <div role="list" style={{ display: 'grid' }} onMouseLeave={() => { setScrub(null); setTip(null) }}>
        {S.map((s, k) => {
          const v = s.values
          const n = v.length
          const first = v[0]
          const last = v[n - 1]
          const lo = Math.min(...v)
          const hi = Math.max(...v)
          const span = hi - lo || 1
          // bars keep a stub under the lowest value so every bar reads as a bar
          const base = type === 'bars' ? lo - span * 0.35 : lo
          const bspan = hi - base || 1
          const X = (i) => padX + (n > 1 ? (i / (n - 1)) * (sw - padX * 2) : (sw - padX * 2) / 2)
          const Y = (val) => (type === 'bars' ? sh - (sh - padY) * ((val - base) / bspan) : padY + (sh - padY * 2) * (1 - (val - lo) / span))
          const change = first ? (last - first) / Math.abs(first) : 0
          const good = inverted.has(s.label) ? change <= 0 : change >= 0
          const c = colorByTrend ? (good ? upColor : downColor) : pal[k % pal.length]
          const P = v.map((val, i) => [X(i), Y(val)])
          const si = scrub && scrub.k === k ? scrub.i : null
          const dim = scrub && scrub.k !== k
          const shown = si != null ? v[si] : last
          const sorted = [...v].sort((a, b) => a - b)
          const q1 = quant(sorted, 0.25)
          const q3 = quant(sorted, 0.75)
          const mean = v.reduce((a, b) => a + b, 0) / n
          const iMax = v.indexOf(hi)
          const iMin = v.indexOf(lo)
          const rk = stag(p, k, S.length)
          const reveal = (sw + padX) * ease(clamp(rk / 0.8, 0, 1))
          const pk = pop(clamp((rk - 0.7) / 0.3, 0, 1))
          const pillC = good ? upColor : downColor
          const bw = Math.max(1.5, (sw - padX * 2) / n - 2)
          return (
            <div
              key={k}
              role="listitem"
              style={{
                display: 'grid',
                gridTemplateColumns: `minmax(0,1fr) ${sw}px minmax(5.6em, auto)`,
                alignItems: 'center',
                gap: '1em',
                padding: '0.7em 0',
                borderTop: k ? `2px solid ${trackColor}` : 'none',
                opacity: dim ? 0.4 : 1,
                transition: 'opacity .2s',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ color: mutedColor, fontSize: '0.85em', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.label}</div>
                <div style={{ fontSize: '1.45em', fontWeight: 700, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>{fmt(shown)}</div>
              </div>
              <svg
                width={sw}
                height={sh}
                viewBox={`0 0 ${sw} ${sh}`}
                role="img"
                aria-label={`${s.label}: from ${fmt(first)} to ${fmt(last)}, high ${fmt(hi)}, low ${fmt(lo)}, change ${change >= 0 ? '+' : '-'}${Math.abs(change * 100).toFixed(1)}%`}
                style={{ display: 'block', overflow: 'visible', cursor: 'crosshair' }}
                onMouseMove={(e) => {
                  const b = e.currentTarget.getBoundingClientRect()
                  const i = clamp(Math.round(((e.clientX - b.left - padX) / Math.max(1, b.width - padX * 2)) * (n - 1)), 0, n - 1)
                  setScrub({ k, i })
                  if (tooltip) setTip(tipAt(e, wrap, s.label, [{ color: c, label: `Point ${i + 1} of ${n}`, value: fmt(v[i]) }]))
                }}
              >
                <defs>
                  <clipPath id={`c${uid}${k}`}>
                    <rect x={-padX} y={-sh} width={reveal + padX} height={sh * 3} />
                  </clipPath>
                </defs>
                {showBand && type !== 'winloss' && <rect x="0" y={Y(q3)} width={sw} height={Math.max(2, Y(q1) - Y(q3))} rx="4" fill={trackColor} />}
                {type === 'winloss' && <line x1="0" x2={sw} y1={sh / 2} y2={sh / 2} stroke={trackColor} strokeWidth="2" />}
                <g clipPath={`url(#c${uid}${k})`}>
                  {type === 'bars' &&
                    v.map((val, i) => (
                      <path
                        key={i}
                        d={rrect(X(i) - bw / 2, Y(val), bw, Math.max(2, sh - Y(val)), [bw / 2, bw / 2, 0, 0])}
                        fill={si === i ? mix(c, '#000000', 0.25) : c}
                        opacity={si != null && si !== i ? 0.4 : 1}
                      />
                    ))}
                  {type === 'winloss' &&
                    v.map((val, i) => {
                      if (!i) return null
                      const up = val >= v[i - 1]
                      return (
                        <rect
                          key={i}
                          x={X(i) - bw / 2}
                          y={up ? sh * 0.08 : sh * 0.56}
                          width={bw}
                          height={sh * 0.36}
                          rx={Math.min(bw / 2, 3)}
                          fill={up ? upColor : downColor}
                          opacity={si != null && si !== i ? 0.4 : 1}
                        />
                      )
                    })}
                  {(type === 'line' || type === 'area') && (
                    <>
                      {type === 'area' && <path d={`${linePath(P, curve)}L${X(n - 1)},${sh}L${X(0)},${sh}Z`} fill={mix(background, c, 0.2)} />}
                      <path d={linePath(P, curve)} fill="none" stroke={c} strokeWidth={lw} strokeLinejoin="round" strokeLinecap="round" />
                    </>
                  )}
                </g>
                {showBand && type !== 'winloss' && <line x1="0" x2={sw} y1={Y(mean)} y2={Y(mean)} stroke={mutedColor} strokeWidth="1.5" strokeDasharray="3 4" strokeLinecap="round" />}
                {showMinMax && type !== 'winloss' && pk > 0 && (
                  <g style={{ pointerEvents: 'none' }}>
                    <circle cx={X(iMax)} cy={Y(hi)} r={3.6 * pk} fill={upColor} stroke={background} strokeWidth="2" />
                    <circle cx={X(iMin)} cy={Y(lo)} r={3.6 * pk} fill={downColor} stroke={background} strokeWidth="2" />
                  </g>
                )}
                {si != null && (
                  <g style={{ pointerEvents: 'none' }}>
                    <line x1={X(si)} x2={X(si)} y1={-2} y2={sh} stroke={mutedColor} strokeWidth="1.5" strokeDasharray="3 4" />
                    {type !== 'winloss' && <circle cx={X(si)} cy={Y(v[si])} r={lw + 2.5} fill={background} stroke={c} strokeWidth={Math.max(2.5, lw * 0.9)} />}
                  </g>
                )}
                {showEnd && si == null && (type === 'line' || type === 'area') && pk > 0 && (
                  <circle cx={X(n - 1)} cy={Y(last)} r={(lw + 2.5) * pk} fill={background} stroke={c} strokeWidth={Math.max(2.5, lw * 0.9)} style={{ pointerEvents: 'none' }} />
                )}
                {/* hit area: the whole sparkline box */}
                <rect x={-padX} y={-4} width={sw + padX * 2} height={sh + 8} fill="transparent" />
              </svg>
              {showDelta ? (
                <div
                  style={{
                    justifySelf: 'end',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35em',
                    padding: '0.3em 0.75em',
                    borderRadius: 99,
                    fontSize: '0.88em',
                    fontWeight: 700,
                    color: inkOn(pillC),
                    background: pillC,
                    fontVariantNumeric: 'tabular-nums',
                    transform: `scale(${pk})`,
                    transformOrigin: 'right center',
                  }}
                >
                  {change >= 0 ? '▲' : '▼'} {Math.abs(change * 100).toFixed(1)}%
                </div>
              ) : (
                <span />
              )}
            </div>
          )
        })}
      </div>
    </Card>
  )
}
