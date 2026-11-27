import { useEffect, useId, useMemo, useRef, useState } from 'react'

// ---- flat infographic helpers (kept inline so this file copies out on its own) ----
// Data is raw samples (see the distribution helpers below).

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
const paletteOf = (n, base) => Array.from({ length: n }, (_, i) => base[i % base.length])
// white or dark text, whichever reads better on a filled shape
function inkOn(c, dark) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(String(c).slice(i, i + 2), 16) || 0)
  return 0.299 * r + 0.587 * g + 0.114 * b > 170 ? dark : '#ffffff'
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

// ---- distribution helpers ----
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
const axisFmt = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })
// `data` is raw samples: "Mobile: 12 15 18 22; Desktop: 30 32 35" (groups split by ; or a
// new line, values by spaces or commas). A plain list of numbers is one group. Leave it
// empty and the chart draws a built-in demo set (see groups, samples, seed, spread).

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
const PRESETS = [
  { name: 'Alpha', mean: 52, sd: 9, skew: 0 },
  { name: 'Beta', mean: 63, sd: 6, skew: 0.7 },
  { name: 'Gamma', mean: 48, sd: 14, bi: true },
  { name: 'Delta', mean: 72, sd: 10, skew: -0.6 },
  { name: 'Epsilon', mean: 38, sd: 7, skew: 0.4 },
  { name: 'Zeta', mean: 58, sd: 13, skew: 0 },
]
function synth(groups, samples, seed, spread) {
  return PRESETS.slice(0, clamp(Math.round(groups), 1, 6)).map((pr, g) => {
    const r = rng(Math.round(seed) * 131 + g * 977 + 1)
    const values = Array.from({ length: Math.round(samples) }, () => {
      let z = gauss(r)
      if (pr.bi) z = r() < 0.5 ? gauss(r) * 0.45 - 1.3 : gauss(r) * 0.5 + 1.1
      let v = pr.mean + z * pr.sd * spread
      if (pr.skew) v += pr.skew * pr.sd * spread * (Math.exp(Math.abs(gauss(r)) * 0.55) - 1)
      return +v.toFixed(2)
    })
    return { label: pr.name, values }
  })
}
function parseSamples(data) {
  if (Array.isArray(data)) {
    if (data.length && typeof data[0] === 'number') return [{ label: 'Values', values: data.map(num) }]
    return data.map((g, i) => ({ label: String(g.label ?? `Group ${i + 1}`), values: (g.values ?? []).map(num) }))
  }
  const str = String(data ?? '').trim()
  if (!str) return null
  const parts = str.split(/[;\n]/).map((x) => x.trim()).filter(Boolean)
  const out = parts
    .map((s, i) => {
      const k = s.indexOf(':')
      const label = k < 0 ? (parts.length > 1 ? `Group ${i + 1}` : 'Values') : s.slice(0, k).trim()
      const values = (k < 0 ? s : s.slice(k + 1)).split(/[\s,|]+/).filter(Boolean).map(Number).filter(Number.isFinite)
      return { label, values }
    })
    .filter((g) => g.values.length)
  return out.length ? out : null
}
function useSamples({ data, groups, samples, seed, spread, names }) {
  return useMemo(() => {
    const g = parseSamples(data) ?? synth(groups, samples, seed, spread)
    const nm = splitNames(names)
    return g.map((x, i) => ({ ...x, label: nm[i] ?? x.label }))
  }, [data, groups, samples, seed, spread, names])
}
function quant(s, q) {
  const i = (s.length - 1) * q
  const lo = Math.floor(i)
  const hi = Math.ceil(i)
  return s[lo] + (s[hi] - s[lo]) * (i - lo)
}
function summarize(values, whisker = 'iqr') {
  const s = [...values].sort((a, b) => a - b)
  const n = s.length
  const q1 = quant(s, 0.25)
  const med = quant(s, 0.5)
  const q3 = quant(s, 0.75)
  const iqr = q3 - q1
  let lo = s[0]
  let hi = s[n - 1]
  if (whisker === '5-95') {
    lo = quant(s, 0.05)
    hi = quant(s, 0.95)
  } else if (whisker !== 'min-max') {
    lo = s.find((v) => v >= q1 - 1.5 * iqr) ?? s[0]
    hi = [...s].reverse().find((v) => v <= q3 + 1.5 * iqr) ?? s[n - 1]
  }
  const mean = s.reduce((a, b) => a + b, 0) / n
  const sd = Math.sqrt(s.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, n - 1))
  return { n, min: s[0], max: s[n - 1], q1, med, q3, iqr, lo, hi, mean, sd, sorted: s, out: s.filter((v) => v < lo || v > hi) }
}
// gaussian kernel density over [lo, hi]
function kde(st, lo, hi, pts = 90, scale = 1) {
  const { sorted, n, sd, iqr } = st
  const spread = Math.min(sd || 1, iqr / 1.34 || sd || 1) || 1
  const bw = Math.max(1e-6, 0.9 * spread * n ** -0.2 * scale)
  const xs = []
  const ys = []
  for (let i = 0; i < pts; i++) {
    const x = lo + ((hi - lo) * i) / (pts - 1)
    let sum = 0
    for (let k = 0; k < n; k++) sum += Math.exp(-0.5 * ((x - sorted[k]) / bw) ** 2)
    xs.push(x)
    ys.push(sum / (n * bw * Math.sqrt(2 * Math.PI)))
  }
  return { xs, ys, bw }
}
const fmtTick = (t) => axisFmt.format(t)
// ---- end distribution helpers ----

// Flat infographic histogram: chunky rounded bins in solid colours, a striped accent
// on each group's tallest bin, a fat density curve with a white outline, and mean
// lines topped with coloured badges. Groups overlay or stack, y can be a count, a
// percent or a density, and the bars can run cumulative. Bins pop up left to right.
export default function FlatHistogram({
  data = '',
  groups = 2,
  samples = 260,
  seed = 7,
  spread = 1,
  names = 'Checkout, Search, Upload',
  title = 'Response times',
  subtitle = 'Milliseconds, 260 requests per service',
  bins = 18,
  mode = 'overlaid',
  normalize = 'count',
  cumulative = false,
  showCurve = true,
  showMean = true,
  showMedian = false,
  barRadius = 6,
  gap = 0.12,
  stripes = true,
  stripeWidth = 4,
  showValues = false,
  showGrid = true,
  showAxis = true,
  axisArrows = true,
  showLegend = true,
  tooltip = true,
  animate = true,
  duration = 1200,
  decimals = 0,
  prefix = '',
  suffix = ' ms',
  width = 680,
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
  const fmt = makeFmt({ decimals, prefix, suffix })
  const G = useSamples({ data, groups, samples, seed, spread, names })
  const cols = paletteOf(G.length, pal)
  const B = clamp(Math.round(bins), 3, 80)
  const stacked = mode === 'stacked' && G.length > 1
  const p = useReveal(animate, duration, `${data}|${groups}|${samples}|${seed}|${spread}|${B}|${mode}|${normalize}|${cumulative}`)
  const [hovB, setHovB] = useState(-1)
  const [hovG, setHovG] = useState(-1)
  const [tip, setTip] = useState(null)

  const model = useMemo(() => {
    const all = G.flatMap((g) => g.values)
    const range = niceRange(Math.min(...all), Math.max(...all), 6)
    const bw = (range.hi - range.lo) / B
    const stats = G.map((g) => summarize(g.values))
    const counts = G.map((g) => {
      const c = new Array(B).fill(0)
      g.values.forEach((v) => c[clamp(Math.floor((v - range.lo) / bw), 0, B - 1)]++)
      return c
    })
    const y = counts.map((c, gi) => {
      const n = G[gi].values.length
      let out = c.map((v) => (normalize === 'percent' ? (v / n) * 100 : normalize === 'density' ? v / (n * bw) : v))
      if (cumulative) {
        let a = 0
        out = out.map((v) => (a += v))
      }
      return out
    })
    const curves = G.map((g, gi) => {
      const k = kde(stats[gi], range.lo, range.hi, 80)
      const f = normalize === 'percent' ? bw * 100 : normalize === 'density' ? 1 : G[gi].values.length * bw
      return { xs: k.xs, ys: k.ys.map((v) => v * f) }
    })
    // each group's tallest bin gets the stripe accent
    const modal = y.map((row) => row.indexOf(Math.max(...row)))
    return { range, bw, stats, counts, y, curves, modal }
  }, [G, B, normalize, cumulative])

  const { range, bw, stats, counts, y, curves, modal } = model
  const yMaxRaw = Math.max(
    1e-9,
    ...(stacked ? y[0].map((_, b) => y.reduce((a, row) => a + row[b], 0)) : y.flat()),
    ...(showCurve && !cumulative && !stacked ? curves.flatMap((c) => c.ys) : []),
  )
  const ys = niceRange(0, yMaxRaw, 4)
  const yLabel = (v) => (normalize === 'density' ? (v === 0 ? '0' : v.toPrecision(2)) : axisFmt.format(v) + (normalize === 'percent' ? '%' : ''))
  const yTicks = ticksOf(ys)
  const xTicks = ticksOf(niceRange(range.lo, range.hi, 6)).filter((t) => t >= range.lo - 1e-9 && t <= range.hi + 1e-9)

  const W = Math.max(240, (boxW || width) - size * 3)
  const H = height
  const l = (showAxis ? Math.max(...yTicks.map((t) => yLabel(t).length)) * size * 0.55 + 14 : 8)
  const r = axisArrows && showAxis ? size * 1.4 : 12
  const pw = Math.max(40, W - l - r)
  const X = (v) => l + ((v - range.lo) / (range.hi - range.lo)) * pw

  // mean badges: sorted by x, pushed onto a new row when they would collide
  const badgeH = size * 1.55
  const badges = showMean
    ? stats
        .map((s, gi) => {
          const text = `μ ${fmt(s.mean)}`
          return { gi, x: X(s.mean), w: text.length * size * 0.82 * 0.6 + size * 1.1, text }
        })
        .sort((a, b) => a.x - b.x)
    : []
  const rowEnd = []
  badges.forEach((b) => {
    let row = rowEnd.findIndex((e) => b.x - b.w / 2 > e + 6)
    if (row < 0) row = rowEnd.length
    rowEnd[row] = b.x + b.w / 2
    b.row = row
  })
  const t = (badges.length ? rowEnd.length * (badgeH + 5) + 6 : 0) + (showAxis && axisArrows ? size * 1.1 : size * 0.6)
  const bBot = size * 2.1
  const ph = Math.max(40, H - t - bBot)
  const Yp = (v) => t + ph - (ph * v) / ys.hi
  const bwPx = pw / B
  const rad = Math.min(barRadius, (bwPx * (1 - gap)) / 2)

  const tipFor = (e, b) =>
    tooltip &&
    setTip(
      tipAt(
        e,
        wrap,
        `${fmt(range.lo + b * bw)} to ${fmt(range.lo + (b + 1) * bw)}`,
        G.map((g, gi) => ({ color: cols[gi], label: g.label, value: `${counts[gi][b]} · ${((counts[gi][b] / g.values.length) * 100).toFixed(1)}%` })),
      ),
    )
  const curveK = ease(clamp((p - 0.35) / 0.65, 0, 1))
  const lateK = clamp((p - 0.55) / 0.3, 0, 1)

  return (
    <Card wrapRef={(el) => { wrap.current = el; boxRef.current = el }} {...{ width, background, textColor, mutedColor, size, title, subtitle, tip }}>
      {showLegend && G.length > 1 && <Legend items={G.map((g, i) => ({ name: g.label, color: cols[i] }))} mutedColor={mutedColor} onHover={setHovG} />}
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${title}. Histogram of ${G.map((g, gi) => `${g.label}: ${g.values.length} values, mean ${fmt(stats[gi].mean)}, median ${fmt(stats[gi].med)}`).join('; ')}`}
        style={{ display: 'block', overflow: 'visible' }}
        onMouseLeave={() => { setHovB(-1); setTip(null) }}
      >
        <defs>
          <pattern id={`st${uid}`} width={stripeWidth * 2} height={stripeWidth * 2} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width={stripeWidth} height={stripeWidth * 2} fill="#ffffff" opacity="0.35" />
          </pattern>
          <marker id={`ar${uid}`} viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,1 L9,5 L0,9 Z" fill={mutedColor} />
          </marker>
        </defs>

        {yTicks.map((v, i) => (
          <g key={i}>
            {showGrid && v !== 0 && <line x1={l} x2={l + pw} y1={Yp(v)} y2={Yp(v)} stroke={gridColor} strokeWidth="2" strokeDasharray="5 7" strokeLinecap="round" />}
            {showAxis && <text x={l - 10} y={Yp(v)} dy="0.35em" textAnchor="end" fontSize={size * 0.82} fill={mutedColor} style={{ fontVariantNumeric: 'tabular-nums' }}>{yLabel(v)}</text>}
          </g>
        ))}
        {showAxis && xTicks.map((v, i) => <text key={i} x={X(v)} y={t + ph + size * 1.5} textAnchor="middle" fontSize={size * 0.82} fontWeight="600" fill={mutedColor}>{prefix + fmtTick(v) + suffix}</text>)}

        {/* bars */}
        {y[0].map((_, b) => {
          const ip = pop(stag(p, b, B))
          const x = l + b * bwPx + (bwPx * gap) / 2
          const w = Math.max(1, bwPx * (1 - gap))
          let acc = 0
          return (
            <g key={b} opacity={hovB >= 0 && hovB !== b ? 0.4 : 1} style={{ transition: 'opacity .2s' }}>
              {G.map((_, gi) => {
                const v = y[gi][b] * ip
                const top = stacked ? acc + v : v
                const base = stacked ? acc : 0
                if (stacked) acc += v
                const h = Math.max(0, Yp(base) - Yp(top))
                if (h <= 0) return null
                const c = cols[gi]
                const lastOfStack = !stacked || gi === G.length - 1 || y.slice(gi + 1).every((row) => row[b] === 0)
                const d = rrect(x, Yp(top), w, h, lastOfStack ? [rad, rad, 0, 0] : [0, 0, 0, 0])
                const striped = stripes && modal[gi] === b && h > 4
                const sh = Math.min(h, Math.max(h * 0.28, 6))
                return (
                  <g key={gi} opacity={hovG >= 0 && hovG !== gi ? 0.4 : 1} style={{ transition: 'opacity .2s' }}>
                    <path d={d} fill={c} fillOpacity={stacked || G.length === 1 ? 1 : 0.78} stroke={stacked ? background : 'none'} strokeWidth={stacked ? 1.5 : 0} />
                    {striped && (
                      <>
                        <clipPath id={`c${uid}${gi}`}><path d={d} /></clipPath>
                        <g clipPath={`url(#c${uid}${gi})`}>
                          <rect x={x} y={Yp(top)} width={w} height={sh} fill={mix(c, '#000000', 0.12)} />
                          <rect x={x} y={Yp(top)} width={w} height={sh} fill={`url(#st${uid})`} />
                        </g>
                      </>
                    )}
                  </g>
                )
              })}
            </g>
          )
        })}

        {/* density curves: a white outline under a darker line so they read over the bars */}
        {showCurve && !cumulative && !stacked && curveK > 0 &&
          curves.map((c, gi) => {
            const d = 'M' + c.xs.map((xv, i) => `${X(xv).toFixed(1)},${Yp(c.ys[i]).toFixed(1)}`).join('L')
            const dash = curveK < 1 ? { pathLength: 1, strokeDasharray: '1 1', strokeDashoffset: 1 - curveK } : {}
            return (
              <g key={gi} opacity={hovG >= 0 && hovG !== gi ? 0.4 : 1} style={{ pointerEvents: 'none', transition: 'opacity .2s' }}>
                <path d={d} fill="none" stroke={background} strokeWidth="7" strokeLinejoin="round" strokeLinecap="round" {...dash} />
                <path d={d} fill="none" stroke={mix(cols[gi], '#000000', 0.22)} strokeWidth="3.2" strokeLinejoin="round" strokeLinecap="round" {...dash} />
              </g>
            )
          })}

        {/* median: a solid tick line */}
        {showMedian && lateK > 0 &&
          stats.map((s, gi) => (
            <line key={gi} x1={X(s.med)} x2={X(s.med)} y1={t} y2={t + ph} stroke={mix(cols[gi], '#000000', 0.22)} strokeWidth="2.5" strokeLinecap="round" opacity={lateK * (hovG >= 0 && hovG !== gi ? 0.4 : 1)} style={{ pointerEvents: 'none' }} />
          ))}

        {/* value labels sit above the curve, with a halo */}
        {showValues && G.length === 1 && bwPx > size * 1.6 && p > 0.15 &&
          y[0].map((v, b) =>
            v > 0 ? (
              <text key={b} x={l + b * bwPx + bwPx / 2} y={Yp(v * pop(stag(p, b, B))) - 7} textAnchor="middle" fontSize={size * 0.85} fontWeight="700" fill={textColor} stroke={background} strokeWidth="4" paintOrder="stroke" strokeLinejoin="round" opacity={hovB >= 0 && hovB !== b ? 0.4 : 1} style={{ fontVariantNumeric: 'tabular-nums', pointerEvents: 'none' }}>
                {normalize === 'count' ? counts[0][b] : yLabel(v)}
              </text>
            ) : null,
          )}

        {/* mean: a dashed line topped with a badge */}
        {badges.map((bd) => {
          const c = cols[bd.gi]
          const by = bd.row * (badgeH + 5) + 2
          const k = pop(lateK)
          return (
            <g key={bd.gi} opacity={clamp(lateK * 2, 0, 1) * (hovG >= 0 && hovG !== bd.gi ? 0.4 : 1)} style={{ pointerEvents: 'none', transition: 'opacity .2s' }}>
              <line x1={bd.x} x2={bd.x} y1={by + badgeH} y2={t + ph} stroke={c} strokeWidth="2" strokeDasharray="5 5" strokeLinecap="round" />
              <g transform={`translate(${bd.x} ${by + badgeH / 2}) scale(${k})`}>
                <rect x={-bd.w / 2} y={-badgeH / 2} width={bd.w} height={badgeH} rx={badgeH / 2} fill={c} />
                <text y="0.35em" textAnchor="middle" fontSize={size * 0.82} fontWeight="700" fill={inkOn(c, textColor)} style={{ fontVariantNumeric: 'tabular-nums' }}>{bd.text}</text>
              </g>
            </g>
          )
        })}

        {showAxis && (
          <g stroke={mutedColor} strokeWidth="2" strokeLinecap="round" fill="none" style={{ pointerEvents: 'none' }}>
            <path d={`M${l},${t + ph}H${l + pw + (axisArrows ? r * 0.7 : 0)}`} markerEnd={axisArrows ? `url(#ar${uid})` : undefined} />
            <path d={`M${l},${t + ph}V${t - (axisArrows ? size * 0.8 : 0)}`} markerEnd={axisArrows ? `url(#ar${uid})` : undefined} />
          </g>
        )}

        {/* hover bins, full plot height */}
        {y[0].map((_, b) => (
          <rect
            key={b}
            x={l + b * bwPx}
            y={t}
            width={bwPx}
            height={ph}
            fill="transparent"
            onMouseEnter={(e) => { setHovB(b); tipFor(e, b) }}
            onMouseMove={(e) => tipFor(e, b)}
          />
        ))}
      </svg>
    </Card>
  )
}
