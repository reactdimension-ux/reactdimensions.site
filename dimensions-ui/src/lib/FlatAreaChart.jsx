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
// a filled band between an upper and a lower line
function bandPath(top, bottom, curve) {
  const back = [...bottom].reverse()
  const rc = curve === 'step' || curve === 'step-after' ? 'step-before' : curve === 'step-before' ? 'step-after' : curve
  return linePath(top, curve) + linePath(back, rc, true) + 'Z'
}
// show every k-th x label so they don't collide
const labelStep = (labels, step, size) => Math.max(1, Math.ceil((Math.max(...labels.map((s) => s.length)) * size * 0.6 + 10) / Math.max(1, step)))
function Legend({ items, mutedColor, onHover }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4em 1.2em', marginBottom: '0.7em', color: mutedColor, fontSize: '0.88em', fontWeight: 600 }}>
      {items.map((it, i) => (
        <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45em', cursor: 'default' }} onMouseEnter={() => onHover?.(i)} onMouseLeave={() => onHover?.(-1)}>
          <i style={{ width: '0.75em', height: '0.75em', borderRadius: '50%', background: it.color, flex: 'none' }} />
          {it.name}
        </span>
      ))}
    </div>
  )
}
// ---- end time-series helpers ----

// Flat infographic area chart: solid flat layers that overlap, stack into a running
// total or stack to 100%, each with a darker top edge, a striped "latest period" band
// and arrowhead axes. Layers rise from the baseline in a springy wave, left to right.
// Hover a time for every layer and the total; the layer under the pointer stays bright.
export default function FlatAreaChart({
  data = '',
  labels = '',
  series = 3,
  points = 18,
  seed = 9,
  volatility = 0.8,
  trend = 0.5,
  names = 'Organic, Paid, Referral',
  title = 'Traffic by source',
  subtitle = 'Sessions (thousands), last 18 months',
  mode = 'stacked',
  curve = 'smooth',
  fillOpacity = 1,
  strokeWidth = 3,
  stripes = true,
  stripeWidth = 5,
  showTotal = true,
  zeroBased = true,
  showGrid = true,
  showAxis = true,
  axisArrows = true,
  showLegend = true,
  crosshair = true,
  tooltip = true,
  animate = true,
  duration = 1500,
  valueFormat = 'number',
  decimals = 0,
  prefix = '',
  suffix = 'k',
  width = 700,
  height = 300,
  size = 13,
  color = '#4a7fe8',
  color2 = '#ef5b7f',
  color3 = '#14a89e',
  color4 = '#f08a24',
  color5 = '#8e5fd6',
  color6 = '#c49a12',
  background = '#ffffff',
  gridColor = '#eef0f6',
  textColor = '#2b2f3a',
  mutedColor = '#8a90a0',
}) {
  const uid = useId().replace(/:/g, '')
  const wrap = useRef(null)
  const [boxRef, boxW] = useWidth()
  const pal = [color, color2, color3, color4, color5, color6]
  const fmt = fmtOf({ valueFormat, decimals, prefix, suffix })
  const { S, n, x } = useSeries({ data, series, points, seed, volatility, trend, names, labels })
  const p = useReveal(animate, duration, `${data}|${series}|${points}|${seed}|${mode}|${curve}`)
  const [hi, setHi] = useState(-1)
  const [hovS, setHovS] = useState(-1)
  const [tip, setTip] = useState(null)

  const stacked = mode !== 'overlap'
  const pct = mode === 'percent'
  const colOf = (k) => pal[k % pal.length]
  const totals = Array.from({ length: n }, (_, i) => S.reduce((a, s) => a + (s.values[i] ?? 0), 0))
  // lower and upper edge of each layer at each point
  const layers = S.map((s, k) =>
    Array.from({ length: n }, (_, i) => {
      const v = s.values[i] ?? 0
      if (!stacked) return [0, v]
      const below = S.slice(0, k).reduce((a, t) => a + (t.values[i] ?? 0), 0)
      const f = pct ? 100 / (totals[i] || 1) : 1
      return [below * f, (below + v) * f]
    }),
  )
  const top = pct ? 100 : Math.max(...layers.flat().map((e) => e[1]))
  const bottom = zeroBased || stacked ? 0 : Math.min(...S.flatMap((s) => s.values))
  const sy = niceRange(bottom, top, pct ? 4 : 5)
  const yt = ticksOf(sy)
  const W = Math.max(260, (boxW || width) - size * 3)
  const H = height
  const ylab = (t) => (pct ? `${t}%` : prefix + axisFmt.format(t) + suffix)
  const totalOn = showTotal && stacked && !pct && S.length > 1
  const totalW = totalOn ? fmt(totals[n - 1]).length * size * 0.66 + 16 : 0
  const m = {
    l: showAxis ? Math.max(...yt.map((t) => ylab(t).length)) * size * 0.56 + 14 : 6,
    r: Math.max(showAxis && axisArrows ? size * 1.6 : 10, totalW),
    t: size * 1.2,
    b: showAxis ? size * 2.1 : 6,
  }
  const pw = Math.max(60, W - m.l - m.r)
  const ph = Math.max(60, H - m.t - m.b)
  const X = (i) => m.l + (n > 1 ? (i / (n - 1)) * pw : pw / 2)
  const Y = (v) => m.t + ph - ((v - sy.lo) / (sy.hi - sy.lo)) * ph
  const every = labelStep(x, pw / Math.max(1, n - 1), size * 0.88)
  // each point rises from the baseline with a springy overshoot, in a left-to-right wave
  const grow = Array.from({ length: n }, (_, i) => pop(stag(p, i, n)))
  const GY = (v, i) => Y(sy.lo + (v - sy.lo) * grow[i])
  const fadeIn = clamp((p - 0.6) / 0.3, 0, 1)
  // the striped "latest period" band covers the last step of the x axis
  const bandX = n > 1 ? Math.min(X(n - 2), m.l + pw * 0.9) : m.l
  // overlap mode: draw the tallest layer first so smaller ones stay visible
  const order = stacked ? S.map((_, k) => k) : S.map((_, k) => k).sort((a, b) => Math.max(...layers[b].map((e) => e[1])) - Math.max(...layers[a].map((e) => e[1])))

  const onMove = (e) => {
    const b = e.currentTarget.getBoundingClientRect()
    const i = clamp(Math.round(((e.clientX - b.left) / b.width) * (n - 1)), 0, n - 1)
    setHi(i)
    if (stacked) {
      const v = sy.lo + ((b.bottom - e.clientY) / b.height) * (sy.hi - sy.lo)
      const k = layers.findIndex((L) => v >= L[i][0] && v <= L[i][1])
      setHovS(k)
    }
    if (!tooltip) return
    const rows = S.map((s, k) => ({ color: colOf(k), label: s.label, value: pct ? `${(((s.values[i] ?? 0) / (totals[i] || 1)) * 100).toFixed(1)}%` : fmt(s.values[i] ?? 0) })).reverse()
    if (stacked && showTotal) rows.push({ label: 'Total', value: fmt(totals[i]) })
    setTip(tipAt(e, wrap, x[i], rows))
  }

  return (
    <Card wrapRef={(el) => { wrap.current = el; boxRef.current = el }} {...{ width, background, textColor, mutedColor, size, title, subtitle, tip }}>
      {showLegend && S.length > 1 && <Legend items={S.map((s, k) => ({ name: s.label, color: colOf(k) }))} mutedColor={mutedColor} onHover={setHovS} />}
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${title}. ${mode} area chart of ${S.map((s) => s.label).join(', ')} over ${n} points, from ${x[0]} to ${x[n - 1]}. Latest: ${S.map((s) => `${s.label} ${fmt(s.values[n - 1] ?? 0)}`).join(', ')}${stacked ? `, total ${fmt(totals[n - 1])}` : ''}.`}
        style={{ display: 'block', overflow: 'visible' }}
        onMouseLeave={() => { setHi(-1); setHovS(-1); setTip(null) }}
      >
        <defs>
          <pattern id={`st${uid}`} width={stripeWidth * 2} height={stripeWidth * 2} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width={stripeWidth} height={stripeWidth * 2} fill="#ffffff" opacity="0.35" />
          </pattern>
          <marker id={`ar${uid}`} viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,1 L9,5 L0,9 Z" fill={mutedColor} />
          </marker>
        </defs>

        {yt.map((t, i) => (
          <g key={i}>
            {showGrid && t !== sy.lo && <line x1={m.l} x2={m.l + pw} y1={Y(t)} y2={Y(t)} stroke={gridColor} strokeWidth="2" strokeDasharray="5 7" strokeLinecap="round" />}
            {showAxis && <text x={m.l - 10} y={Y(t)} dy="0.35em" textAnchor="end" fontSize={size * 0.82} fill={mutedColor} style={{ fontVariantNumeric: 'tabular-nums' }}>{ylab(t)}</text>}
          </g>
        ))}
        {showAxis && x.map((lb, i) => (i % every === 0 ? <text key={i} x={X(i)} y={m.t + ph + size * 1.5} textAnchor="middle" fontSize={size * 0.88} fontWeight="600" fill={hi === i ? textColor : mutedColor} style={{ pointerEvents: 'none' }}>{lb}</text> : null))}

        {order.map((k) => {
          const L = layers[k]
          const topP = L.map((e, i) => [X(i), GY(e[1], i)])
          const botP = L.map((e, i) => [X(i), GY(stacked ? e[0] : Math.max(e[0], sy.lo), i)])
          const c = colOf(k)
          const dim = hovS >= 0 && hovS !== k
          const d = bandPath(topP, botP, curve)
          return (
            <g key={k} opacity={dim ? 0.4 : 1} style={{ transition: 'opacity .2s', pointerEvents: 'none' }}>
              <path d={d} fill={stacked ? mix(background, c, fillOpacity) : mix(background, c, 0.3 * fillOpacity)} />
              {stripes && stacked && n > 1 && (
                <>
                  <clipPath id={`c${uid}${k}`}><path d={d} /></clipPath>
                  <g clipPath={`url(#c${uid}${k})`} opacity={fadeIn}>
                    <rect x={bandX} y={0} width={X(n - 1) - bandX + 2} height={H} fill={mix(c, '#000000', 0.12)} />
                    <rect x={bandX} y={0} width={X(n - 1) - bandX + 2} height={H} fill={`url(#st${uid})`} />
                  </g>
                </>
              )}
              {strokeWidth > 0 && <path d={linePath(topP, curve)} fill="none" stroke={stacked ? mix(c, '#000000', 0.18) : c} strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round" />}
            </g>
          )
        })}

        {totalOn && fadeIn > 0 && (
          <g opacity={fadeIn} style={{ pointerEvents: 'none' }}>
            <text x={X(n - 1) + 10} y={Y(totals[n - 1]) - size * 0.55} fontSize={size * 0.75} fontWeight="600" fill={mutedColor}>Total</text>
            <text x={X(n - 1) + 10} y={Y(totals[n - 1]) + size * 0.6} fontSize={size * 1.05} fontWeight="700" fill={textColor} style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(totals[n - 1])}</text>
          </g>
        )}

        {showAxis && (
          <g stroke={mutedColor} strokeWidth="2" strokeLinecap="round" fill="none" style={{ pointerEvents: 'none' }}>
            <path d={`M${m.l},${m.t + ph}H${m.l + pw + (axisArrows ? size * 1.1 : 0)}`} markerEnd={axisArrows ? `url(#ar${uid})` : undefined} />
            <path d={`M${m.l},${m.t + ph}V${m.t - (axisArrows ? size * 0.6 : 0)}`} markerEnd={axisArrows ? `url(#ar${uid})` : undefined} />
          </g>
        )}

        {crosshair && hi >= 0 && (
          <g style={{ pointerEvents: 'none' }}>
            <line x1={X(hi)} x2={X(hi)} y1={m.t} y2={m.t + ph} stroke={mutedColor} strokeWidth="1.5" strokeDasharray="4 5" />
            {layers.map((L, k) => (
              <circle key={k} cx={X(hi)} cy={Y(L[hi][1])} r={hovS === k ? 6.5 : 5} fill={background} stroke={colOf(k)} strokeWidth="3" opacity={hovS >= 0 && hovS !== k ? 0.4 : 1} />
            ))}
          </g>
        )}
        <rect x={m.l} y={m.t} width={pw} height={ph} fill="transparent" onMouseMove={onMove} />
      </svg>
    </Card>
  )
}
