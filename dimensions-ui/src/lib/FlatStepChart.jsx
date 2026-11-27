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
// dark or white text for a label sitting on a coloured shape
const inkOn = (c) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(String(c).slice(i, i + 2), 16) / 255)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.6 ? '#1d2029' : '#ffffff'
}
// ---- end time-series helpers ----

// Flat infographic step chart: a value that holds until it changes, then jumps (prices,
// plan limits, headcount). Thick rounded step lines over a flat tint, a hollow dot at
// every change and a solid +/- chip above it. The line draws on from the left and each
// chip pops as the line reaches it. Points are "Name:v|v|v" with `labels` for the x axis.
export default function FlatStepChart({
  data = 'Basic:9|9|9|12|12|12|12|15|15|15|19|19, Pro:24|24|29|29|29|29|35|35|39|39|39|45',
  labels = 'Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec',
  title = 'Plan prices',
  subtitle = 'Monthly price per seat, this year',
  stepType = 'after',
  strokeWidth = 4,
  fill = true,
  fillOpacity = 0.16,
  changeDots = true,
  changeLabels = true,
  zeroBased = false,
  showGrid = true,
  showAxis = true,
  axisArrows = true,
  showLegend = true,
  crosshair = true,
  tooltip = true,
  animate = true,
  duration = 1500,
  decimals = 0,
  prefix = '$',
  suffix = '',
  width = 700,
  height = 300,
  size = 13,
  upColor = '#14a89e',
  downColor = '#ef5b7f',
  color = '#4a7fe8',
  color2 = '#f08a24',
  color3 = '#8e5fd6',
  color4 = '#14a89e',
  color5 = '#ef5b7f',
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
  const colOf = (k) => pal[k % pal.length]
  const fmt = makeFmt({ decimals, prefix, suffix })
  const { S, n, x } = useSeries({ data, series: 2, points: 12, seed: 1, volatility: 1, trend: 0.5, names: '', labels })
  const p = useReveal(animate, duration, `${data}|${stepType}`)
  const [hi, setHi] = useState(-1)
  const [hovS, setHovS] = useState(-1)
  const [tip, setTip] = useState(null)
  const curve = `step-${stepType}`

  const all = S.flatMap((s) => s.values)
  const pad = (Math.max(...all) - Math.min(...all)) * 0.12
  const sy = niceRange(zeroBased ? Math.min(0, ...all) : Math.min(...all) - pad, Math.max(...all) + pad, 4)
  const yt = ticksOf(sy)
  const W = Math.max(260, (boxW || width) - size * 3)
  const H = height
  const lw = Math.max(1, strokeWidth)
  const chipH = size * 1.5
  const m = {
    l: showAxis ? Math.max(...yt.map((t) => fmt(t).length)) * size * 0.56 + 14 : 6,
    r: size * 2.4,
    t: changeLabels ? chipH + size * 0.9 : size,
    b: showAxis ? size * 2.1 : 6,
  }
  const pw = Math.max(60, W - m.l - m.r)
  const ph = Math.max(60, H - m.t - m.b)
  const X = (i) => m.l + (n > 1 ? (i / (n - 1)) * pw : pw / 2)
  const Y = (v) => m.t + ph - ((v - sy.lo) / (sy.hi - sy.lo)) * ph
  const every = labelStep(x, pw / Math.max(1, n - 1), size * 0.88)
  // timeline: the line sweeps on over the first 80%, marks pop as it passes them
  const reveal = m.l + (pw + lw * 2) * ease(clamp(p / 0.8, 0, 1))
  const popAt = (px) => pop(clamp((p - (0.8 * (px - m.l)) / Math.max(1, pw)) / 0.2, 0, 1))
  // where a change appears on screen depends on the step type
  const jumpX = (i) => (stepType === 'before' ? X(i - 1) : stepType === 'middle' ? (X(i - 1) + X(i)) / 2 : X(i))
  // lower series' fills are drawn last so a higher tint never hides them
  const order = S.map((_, k) => k).sort((a, b) => S[b].values.reduce((q, v) => q + v, 0) - S[a].values.reduce((q, v) => q + v, 0))

  // every change: a dot on the jump and a chip, above for rises and below for drops,
  // flipped to the other side when that side would cover another chip, dot or line
  const dotR = lw * 1.25 + 2
  const gapY = lw / 2 + size * 0.55 + chipH / 2
  const changes = []
  S.forEach((s, k) =>
    s.values.forEach((v, i) => {
      if (i === 0 || v === s.values[i - 1]) return
      const d = v - s.values[i - 1]
      const up = d > 0
      const txt = `${up ? '+' : '−'}${fmt(Math.abs(d))}`
      const cw = Math.max(chipH * 1.6, txt.length * size * 0.62 + size * 0.9)
      const jx = jumpX(i)
      changes.push({ k, i, jx, y: Y(v), up, txt, cw, cc: up ? upColor : downColor, cx: Math.max(jx, m.l + cw / 2 + 4), yTop: Y(Math.max(v, s.values[i - 1])), yBot: Y(Math.min(v, s.values[i - 1])) })
    }),
  )
  const placed = []
  changes.forEach((ch) => {
    const box = (above) => {
      const cy = above ? ch.yTop - gapY : ch.yBot + gapY
      return { cy, x0: ch.cx - ch.cw / 2 - 3, x1: ch.cx + ch.cw / 2 + 3, y0: cy - chipH / 2 - 3, y1: cy + chipH / 2 + 3 }
    }
    const score = (bx) => {
      let sc = bx.y0 < m.t - chipH || bx.y1 > m.t + ph + 4 ? 2 : 0
      placed.forEach((o) => { if (bx.x0 < o.x1 && bx.x1 > o.x0 && bx.y0 < o.y1 && bx.y1 > o.y0) sc += 3 })
      changes.forEach((o) => { if (o !== ch && o.jx + dotR > bx.x0 && o.jx - dotR < bx.x1 && o.y + dotR > bx.y0 && o.y - dotR < bx.y1) sc += 2 })
      S.forEach((s2, k2) => {
        if (k2 === ch.k) return
        ;[s2.values[ch.i], s2.values[ch.i - 1]].forEach((v2) => { if (v2 != null && Y(v2) > bx.y0 && Y(v2) < bx.y1) sc += 1 })
      })
      return sc
    }
    const a = box(ch.up)
    const b = box(!ch.up)
    const flip = score(b) < score(a)
    Object.assign(ch, { above: flip ? !ch.up : ch.up, cy: (flip ? b : a).cy })
    placed.push(flip ? b : a)
  })
  const hiHasChange = changes.some((ch) => ch.i === hi)

  const onMove = (e) => {
    const b = e.currentTarget.getBoundingClientRect()
    const i = clamp(Math.round(((e.clientX - b.left - size) / Math.max(1, b.width - size * 2)) * (n - 1)), 0, n - 1)
    setHi(i)
    if (tooltip)
      setTip(
        tipAt(e, wrap, x[i], S.map((s, k) => {
          const v = s.values[i]
          const d = i > 0 && v != null ? v - s.values[i - 1] : 0
          return { color: colOf(k), label: s.label, value: v == null ? '-' : fmt(v) + (d ? `  (${d > 0 ? '+' : '−'}${fmt(Math.abs(d))})` : '') }
        })),
      )
  }

  return (
    <Card wrapRef={(el) => { wrap.current = el; boxRef.current = el }} {...{ width, background, textColor, mutedColor, size, title, subtitle, tip }}>
      {showLegend && S.length > 1 && <Legend items={S.map((s, k) => ({ name: s.label, color: colOf(k) }))} mutedColor={mutedColor} onHover={setHovS} />}
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${title}. Step chart. ${S.map((s) => `${s.label}: ${s.values.map((v) => fmt(v)).join(', ')}`).join('; ')}`}
        style={{ display: 'block', overflow: 'visible' }}
        onMouseLeave={() => { setHi(-1); setTip(null) }}
      >
        <defs>
          <marker id={`ar${uid}`} viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,1 L9,5 L0,9 Z" fill={mutedColor} />
          </marker>
          <clipPath id={`rv${uid}`}>
            <rect x={0} y={-H} width={reveal} height={H * 3} />
          </clipPath>
        </defs>

        {yt.map((t, i) => (
          <g key={i}>
            {showGrid && t !== sy.lo && <line x1={m.l} x2={m.l + pw} y1={Y(t)} y2={Y(t)} stroke={gridColor} strokeWidth="2" strokeDasharray="5 7" strokeLinecap="round" />}
            {showAxis && <text x={m.l - 10} y={Y(t)} dy="0.35em" textAnchor="end" fontSize={size * 0.82} fill={mutedColor} style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(t)}</text>}
          </g>
        ))}
        {showAxis && x.map((lb, i) => (i % every === 0 ? <text key={i} x={X(i)} y={m.t + ph + size * 1.5} textAnchor="middle" fontSize={size * 0.88} fontWeight="600" fill={hi === i ? textColor : mutedColor} style={{ pointerEvents: 'none' }}>{lb}</text> : null))}

        {crosshair && hi >= 0 && <line x1={X(hi)} x2={X(hi)} y1={m.t - size * 0.4} y2={m.t + ph} stroke={mutedColor} strokeWidth="1.5" strokeDasharray="4 5" style={{ pointerEvents: 'none' }} />}

        <g clipPath={`url(#rv${uid})`} style={{ pointerEvents: 'none' }}>
          {fill &&
            order.map((k) => {
              const P = S[k].values.map((v, i) => [X(i), Y(v)])
              return <path key={k} d={`${linePath(P, curve)}L${X(n - 1)},${m.t + ph}L${X(0)},${m.t + ph}Z`} fill={mix(background, colOf(k), fillOpacity)} opacity={hovS >= 0 && hovS !== k ? 0.4 : 1} style={{ transition: 'opacity .2s' }} />
            })}
          {S.map((s, k) => (
            <path
              key={k}
              d={linePath(s.values.map((v, i) => [X(i), Y(v)]), curve)}
              fill="none"
              stroke={colOf(k)}
              strokeWidth={lw}
              strokeLinejoin="round"
              strokeLinecap="round"
              opacity={hovS >= 0 && hovS !== k ? 0.4 : 1}
              style={{ transition: 'opacity .2s' }}
            />
          ))}
        </g>

        {changes.map((ch) => {
          const kk = popAt(ch.jx)
          if (kk <= 0) return null
          const dim = (hovS >= 0 && hovS !== ch.k) || (hiHasChange && hi !== ch.i)
          const sg = ch.above ? 1 : -1
          return (
            <g key={`${ch.k}-${ch.i}`} opacity={dim ? 0.4 : 1} style={{ transition: 'opacity .2s', pointerEvents: 'none' }}>
              {changeDots && <circle cx={ch.jx} cy={ch.y} r={Math.max(0, dotR * kk)} fill={background} stroke={colOf(ch.k)} strokeWidth={Math.max(2.5, lw * 0.8)} />}
              {changeLabels && (
                <g transform={`translate(${ch.jx} ${ch.cy}) scale(${kk})`}>
                  <path d={`M${-size * 0.35},${(chipH / 2 - 1) * sg}L0,${(chipH / 2 + size * 0.38) * sg}L${size * 0.35},${(chipH / 2 - 1) * sg}Z`} fill={ch.cc} />
                  <rect x={ch.cx - ch.jx - ch.cw / 2} y={-chipH / 2} width={ch.cw} height={chipH} rx={chipH / 2} fill={ch.cc} />
                  <text x={ch.cx - ch.jx} textAnchor="middle" dy="0.35em" fontSize={size * 0.8} fontWeight="700" fill={inkOn(ch.cc)} style={{ fontVariantNumeric: 'tabular-nums' }}>{ch.txt}</text>
                </g>
              )}
            </g>
          )
        })}

        {showAxis && (
          <g stroke={mutedColor} strokeWidth="2" strokeLinecap="round" fill="none" style={{ pointerEvents: 'none' }}>
            <path d={`M${m.l},${m.t + ph}H${m.l + pw + (axisArrows ? size * 1.4 : 0)}`} markerEnd={axisArrows ? `url(#ar${uid})` : undefined} />
            <path d={`M${m.l},${m.t + ph}V${m.t - (axisArrows ? size * 0.8 : 0)}`} markerEnd={axisArrows ? `url(#ar${uid})` : undefined} />
          </g>
        )}

        <rect x={m.l - size} y={m.t - size} width={pw + size * 2} height={ph + size * 2} fill="transparent" onMouseMove={onMove} />
      </svg>
    </Card>
  )
}
