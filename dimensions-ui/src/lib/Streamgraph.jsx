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

// Streamgraph: stacked areas flowing around a wandering centre line, so many
// categories can rise and fall together. `offset` picks the baseline (wiggle keeps
// layers as flat as possible, silhouette centres them, expand fills to 100%, zero
// stacks from the bottom). Layers grow out from the middle; hover names a layer and
// reads its value at that moment.
export default function Streamgraph({
  data = '',
  labels = '',
  layers = 7,
  points = 40,
  seed = 18,
  names = 'Rock, Pop, Hip-hop, Electronic, Jazz, Classical, Folk, Metal',
  title = 'What people listened to',
  subtitle = 'Weekly plays by genre over 40 weeks',
  offset = 'wiggle',
  order = 'inside out',
  curve = 'smooth',
  colorMode = 'ramp',
  fillOpacity = 0.9,
  showLabels = true,
  showAxis = true,
  crosshair = true,
  tooltip = true,
  animate = true,
  duration = 1500,
  valueFormat = 'compact',
  decimals = 1,
  prefix = '',
  suffix = '',
  width = 720,
  height = 300,
  size = 13,
  color = '#d77757',
  color2 = '#5b9bd5',
  color3 = '#4eba65',
  color4 = '#b48ead',
  background = '#111214',
  textColor = '#ececec',
  mutedColor = '#8b8f98',
}) {
  const wrap = useRef(null)
  const [boxRef, boxW] = useWidth()
  const fmt = makeFmt({ valueFormat, decimals, prefix, suffix })

  const { S, n, x } = useMemo(() => {
    const nm = splitNames(names)
    let S
    if (String(data ?? '').trim()) S = parseRows(data).map((r, i) => ({ label: r.label || nm[i] || `Layer ${i + 1}`, values: r.values.map((v) => Math.max(0, v)) }))
    else {
      const L = clamp(Math.round(layers), 2, 12)
      const N = clamp(Math.round(points), 8, 200)
      S = Array.from({ length: L }, (_, k) => {
        const r = rng(Math.round(seed) * 37 + k * 101 + 5)
        const bumps = Array.from({ length: 3 }, () => ({ c: r() * N, w: N * (0.08 + r() * 0.18), h: 20 + r() * 80 }))
        return { label: nm[k] ?? `Layer ${k + 1}`, values: Array.from({ length: N }, (_, i) => +(6 + bumps.reduce((a, b) => a + b.h * Math.exp(-(((i - b.c) / b.w) ** 2)), 0) * (0.9 + r() * 0.2)).toFixed(1)) }
      })
    }
    const n = Math.max(1, ...S.map((s) => s.values.length))
    const lb = splitNames(labels)
    return { S, n, x: Array.from({ length: n }, (_, i) => lb[i] ?? `W${i + 1}`) }
  }, [data, labels, layers, points, seed, names])

  // stacking order and baseline
  const stack = useMemo(() => {
    const L = S.length
    const val = (k, i) => S[k].values[i] ?? 0
    let ord = S.map((_, k) => k)
    if (order === 'inside out') {
      const peak = S.map((s) => s.values.indexOf(Math.max(...s.values)))
      const sum = S.map((s) => s.values.reduce((a, b) => a + b, 0))
      const byPeak = [...ord].sort((a, b) => peak[a] - peak[b])
      const tops = []
      const bottoms = []
      let t = 0
      let b = 0
      byPeak.forEach((k) => { if (t < b) { tops.push(k); t += sum[k] } else { bottoms.push(k); b += sum[k] } })
      ord = bottoms.reverse().concat(tops)
    } else if (order === 'largest first') ord.sort((a, b) => S[b].values.reduce((x_, y) => x_ + y, 0) - S[a].values.reduce((x_, y) => x_ + y, 0))
    const totals = Array.from({ length: n }, (_, i) => ord.reduce((a, k) => a + val(k, i), 0))
    const base = new Array(n).fill(0)
    if (offset === 'silhouette') for (let i = 0; i < n; i++) base[i] = -totals[i] / 2
    else if (offset === 'wiggle') {
      let y = 0
      base[0] = 0
      for (let i = 1; i < n; i++) {
        let s1 = 0
        let s2 = 0
        ord.forEach((k, j) => {
          const a = val(k, i)
          let s3 = (a - val(k, i - 1)) / 2
          for (let q = 0; q < j; q++) s3 += val(ord[q], i) - val(ord[q], i - 1)
          s1 += a
          s2 += s3 * a
        })
        if (s1) y -= s2 / s1
        base[i] = y
      }
      // centre the whole stream
      const mid = base.reduce((a, b_, i) => a + b_ + totals[i] / 2, 0) / n
      for (let i = 0; i < n; i++) base[i] -= mid
    }
    const bands = {}
    for (let i = 0; i < n; i++) {
      let y = offset === 'expand' ? 0 : base[i]
      ord.forEach((k) => {
        const v = offset === 'expand' ? val(k, i) / (totals[i] || 1) : val(k, i)
        bands[k] = bands[k] || []
        bands[k][i] = [y, y + v]
        y += v
      })
    }
    return { ord, bands, totals, L }
  }, [S, n, offset, order])

  const p = useReveal(animate, duration, `${data}|${layers}|${points}|${seed}|${offset}|${order}`)
  const [hi, setHi] = useState(-1)
  const [hovL, setHovL] = useState(null)
  const [tip, setTip] = useState(null)
  const W = Math.max(280, (boxW || width) - size * 2.8)
  const H = height
  const m = { l: 6, r: 6, t: 6, b: showAxis ? size * 2 : 6 }
  const pw = Math.max(80, W - m.l - m.r)
  const ph = Math.max(60, H - m.t - m.b)
  const all = Object.values(stack.bands).flat()
  const lo = Math.min(...all.map((e) => e[0]))
  const hiV = Math.max(...all.map((e) => e[1]))
  const X = (i) => m.l + (n > 1 ? (i / (n - 1)) * pw : pw / 2)
  const mid = m.t + ph / 2
  const g = ease(p)
  const Y = (v) => {
    const y = m.t + ph - ((v - lo) / (hiV - lo || 1)) * ph
    return mid + (y - mid) * g
  }
  const cols = S.map((_, k) => (colorMode === 'palette' ? [color, color2, color3, color4][k % 4] : rampColor([color, color4, color2, color3], S.length > 1 ? k / (S.length - 1) : 0)))
  const every = labelStep(x, pw / Math.max(1, n - 1), size * 0.85)

  const onMove = (e) => {
    const b = e.currentTarget.getBoundingClientRect()
    const i = clamp(Math.round(((e.clientX - b.left) / b.width) * (n - 1)), 0, n - 1)
    const yv = e.clientY - b.top + m.t
    const k = stack.ord.find((q) => yv <= Y(stack.bands[q][i][0]) && yv >= Y(stack.bands[q][i][1]))
    setHi(i)
    setHovL(k ?? null)
    if (!tooltip) return
    const rows = [...stack.ord].reverse().map((q) => ({ color: cols[q], label: S[q].label, value: fmt(S[q].values[i] ?? 0), strong: q === k }))
    setTip(tipAt(e, wrap, x[i], k != null ? rows.filter((r) => r.strong).concat([{ label: 'All layers', value: fmt(stack.totals[i]) }]) : rows.slice(0, 6)))
  }

  return (
    <Card
      wrapRef={(el) => { wrap.current = el; boxRef.current = el }}
      {...{ width, background, color, textColor, mutedColor, size, title, subtitle, tip }}
      legend={<Legend items={[...stack.ord].reverse().map((k) => ({ label: S[k].label, color: cols[k] }))} onHover={(i) => setHovL(i == null ? null : [...stack.ord].reverse()[i])} mutedColor={mutedColor} />}
    >
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${title}. Streamgraph of ${S.map((s) => s.label).join(', ')} over ${n} points.`}
        style={{ display: 'block', maxWidth: '100%', overflow: 'visible' }}
        onMouseLeave={() => { setHi(-1); setHovL(null); setTip(null) }}
      >
        {stack.ord.map((k) => {
          const B = stack.bands[k]
          const top = B.map((e, i) => [X(i), Y(e[1])])
          const bot = B.map((e, i) => [X(i), Y(e[0])])
          const on = hovL == null || hovL === k
          // label at the thickest point
          let best = 0
          B.forEach((e, i) => { if (e[1] - e[0] > B[best][1] - B[best][0]) best = i })
          const thick = Y(B[best][0]) - Y(B[best][1])
          const bx = clamp(X(best), m.l + 40, m.l + pw - 40)
          return (
            <g key={k} opacity={on ? 1 : 0.25} style={{ transition: 'opacity .2s' }}>
              <path d={bandPath(top, bot, curve)} fill={cols[k]} fillOpacity={fillOpacity} stroke={background} strokeOpacity="0.5" strokeWidth="0.8" />
              {showLabels && thick > size * 1.5 && p > 0.9 && (
                <text x={bx} y={(Y(B[best][0]) + Y(B[best][1])) / 2} dy="0.34em" textAnchor="middle" fontSize={Math.min(size, thick * 0.55)} fontWeight="700" fill={inkOn(cols[k])} style={{ pointerEvents: 'none' }}>{S[k].label}</text>
              )}
            </g>
          )
        })}
        {showAxis && x.map((lb, i) => (i % every === 0 ? <text key={i} x={X(i)} y={m.t + ph + size * 1.45} textAnchor="middle" fontSize={size * 0.82} fill={hi === i ? textColor : mutedColor}>{lb}</text> : null))}
        {crosshair && hi >= 0 && <line x1={X(hi)} x2={X(hi)} y1={m.t} y2={m.t + ph} stroke={textColor} strokeOpacity="0.45" style={{ pointerEvents: 'none' }} />}
        <rect x={m.l} y={m.t} width={pw} height={ph} fill="transparent" onMouseMove={onMove} />
      </svg>
    </Card>
  )
}
