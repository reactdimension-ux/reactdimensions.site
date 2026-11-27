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

// ---- distribution helpers ----
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

// Histogram: counts of values in equal-width bins. Several groups can overlay or
// stack, y can be a count, a percent or a density, and the bars can run cumulative.
// A smoothed curve (kernel density) and mean/median lines sit on top. Paste your own
// samples into `data`, or leave it empty for the demo set.
export default function Histogram({
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
  barRadius = 4,
  gap = 0.07,
  gradient = true,
  showValues = false,
  showGrid = true,
  showAxis = true,
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
  color = '#d77757',
  color2 = '#5b9bd5',
  color3 = '#4eba65',
  color4 = '#b48ead',
  background = '#111214',
  textColor = '#ececec',
  mutedColor = '#8b8f98',
}) {
  const id = useId().replace(/:/g, '')
  const wrap = useRef(null)
  const [boxRef, boxW] = useWidth()
  const pal = [color, color2, color3, color4]
  const fmt = makeFmt({ decimals, prefix, suffix })
  const G = useSamples({ data, groups, samples, seed, spread, names })
  const B = clamp(Math.round(bins), 3, 80)
  const stacked = mode === 'stacked' && G.length > 1
  const p = useReveal(animate, duration, `${data}|${groups}|${samples}|${seed}|${spread}|${B}|${mode}|${normalize}|${cumulative}`)
  const [hov, setHov] = useState(null)
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
    return { range, bw, stats, counts, y, curves }
  }, [G, B, normalize, cumulative])

  const { range, bw, stats, counts, y, curves } = model
  const yMaxRaw = Math.max(
    1e-9,
    ...(stacked ? y[0].map((_, b) => y.reduce((a, row) => a + row[b], 0)) : y.flat()),
    ...(showCurve && !cumulative ? curves.flatMap((c) => c.ys) : []),
  )
  const ys = niceRange(0, yMaxRaw, 4)
  const yLabel = (v) => (normalize === 'density' ? (v === 0 ? '0' : v.toPrecision(2)) : axisFmt.format(v) + (normalize === 'percent' ? '%' : ''))
  const yTicks = ticksOf(ys)
  const xTicks = ticksOf(niceRange(range.lo, range.hi, 6)).filter((t) => t >= range.lo - 1e-9 && t <= range.hi + 1e-9)

  const W = Math.max(240, (boxW || width) - size * 2.8)
  const H = height
  const m = { l: Math.max(...yTicks.map((t) => yLabel(t).length)) * size * 0.6 + 14, r: 12, t: showMean ? size * 1.8 : 10, b: size * 2.2 }
  const pw = Math.max(40, W - m.l - m.r)
  const ph = Math.max(40, H - m.t - m.b)
  const X = (v) => m.l + ((v - range.lo) / (range.hi - range.lo)) * pw
  const Yp = (v) => m.t + ph - (ph * v) / ys.hi
  const bwPx = pw / B

  return (
    <Card
      wrapRef={(el) => { wrap.current = el; boxRef.current = el }}
      {...{ width, background, color, textColor, mutedColor, size, title, subtitle, tip }}
      legend={showLegend && G.length > 1 ? <Legend items={G.map((g, i) => ({ label: g.label, color: pal[i % 4] }))} mutedColor={mutedColor} onHover={(i) => setHov(i === null ? null : { g: i })} /> : null}
    >
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${title}. Histogram of ${G.map((g) => `${g.label}: ${g.values.length} values, median ${fmt(summarize(g.values).med)}`).join('; ')}`}
        style={{ display: 'block', maxWidth: '100%', overflow: 'visible' }}
        onMouseLeave={() => { setHov(null); setTip(null) }}
      >
        <defs>
          {pal.map((c, k) => (
            <linearGradient key={k} id={`${id}h${k}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={c} stopOpacity="1" />
              <stop offset="1" stopColor={c} stopOpacity="0.45" />
            </linearGradient>
          ))}
        </defs>

        {yTicks.map((t, i) => (
          <g key={i}>
            {(showGrid || t === 0) && <line x1={m.l} x2={m.l + pw} y1={Yp(t)} y2={Yp(t)} stroke={mutedColor} strokeOpacity={t === 0 ? 0.4 : 0.15} strokeDasharray={t === 0 ? undefined : '2 5'} />}
            {showAxis && <text x={m.l - 9} y={Yp(t)} dy="0.34em" textAnchor="end" fontSize={size * 0.85} fill={mutedColor}>{yLabel(t)}</text>}
          </g>
        ))}
        {showAxis && xTicks.map((t, i) => <text key={i} x={X(t)} y={m.t + ph + size * 1.5} textAnchor="middle" fontSize={size * 0.85} fill={mutedColor}>{prefix + fmtTick(t) + suffix}</text>)}

        {/* bars */}
        {y[0].map((_, b) => {
          const ip = stag(p, b, B)
          const x = m.l + b * bwPx + (bwPx * gap) / 2
          const w = Math.max(1, bwPx * (1 - gap))
          let acc = 0
          const dimBin = hov && hov.b !== undefined && hov.b !== b ? 0.5 : 1
          return (
            <g key={b} opacity={dimBin} style={{ transition: 'opacity .2s' }}>
              {G.map((_, gi) => {
                const v = y[gi][b] * ip
                const top = stacked ? acc + v : v
                const base = stacked ? acc : 0
                if (stacked) acc += v
                const h = Yp(base) - Yp(top)
                const dimG = hov && hov.g !== undefined && hov.g !== gi ? 0.18 : 1
                return (
                  <path
                    key={gi}
                    d={rrect(x, Yp(top), w, h, [barRadius, barRadius, 0, 0].map((r) => (stacked && gi < G.length - 1 ? 0 : r)))}
                    fill={gradient ? `url(#${id}h${gi % 4})` : pal[gi % 4]}
                    fillOpacity={stacked || G.length === 1 ? 1 : 0.62}
                    stroke={stacked ? 'none' : pal[gi % 4]}
                    strokeOpacity={0.9}
                    strokeWidth="1"
                    opacity={dimG}
                    style={{ transition: 'opacity .2s' }}
                  />
                )
              })}
              {showValues && G.length === 1 && y[0][b] > 0 && bwPx > size * 1.6 && (
                <text x={x + w / 2} y={Yp(y[0][b] * ip) - 6} textAnchor="middle" fontSize={size * 0.78} fill={textColor} opacity={ip} style={{ pointerEvents: 'none' }}>{normalize === 'count' ? counts[0][b] : yLabel(y[0][b])}</text>
              )}
            </g>
          )
        })}

        {/* density curves */}
        {showCurve && !cumulative && curves.map((c, gi) => {
          const d = 'M' + c.xs.map((x, i) => `${X(x).toFixed(1)},${Yp(c.ys[i]).toFixed(1)}`).join('L')
          return <path key={gi} d={d} fill="none" stroke={pal[gi % 4]} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" pathLength="1" strokeDasharray="1" strokeDashoffset={1 - ease(clamp((p - 0.3) / 0.7, 0, 1))} opacity={hov && hov.g !== undefined && hov.g !== gi ? 0.2 : 1} style={{ filter: `drop-shadow(0 0 ${size * 0.4}px ${pal[gi % 4]}88)`, pointerEvents: 'none' }} />
        })}

        {/* mean / median */}
        {(showMean || showMedian) &&
          stats.map((s, gi) => {
            const c = pal[gi % 4]
            const op = clamp((p - 0.5) * 2, 0, 1) * (hov && hov.g !== undefined && hov.g !== gi ? 0.2 : 1)
            return (
              <g key={gi} opacity={op} style={{ pointerEvents: 'none' }}>
                {showMean && (
                  <>
                    <line x1={X(s.mean)} x2={X(s.mean)} y1={m.t - 4} y2={m.t + ph} stroke={c} strokeWidth="1.6" strokeDasharray="4 4" />
                    {G.length <= 3 && <text x={X(s.mean)} y={m.t - 8 - (gi % 2) * 0} textAnchor="middle" fontSize={size * 0.78} fontWeight="650" fill={c}>{`μ ${fmt(s.mean)}`}</text>}
                  </>
                )}
                {showMedian && <line x1={X(s.med)} x2={X(s.med)} y1={m.t} y2={m.t + ph} stroke={c} strokeWidth="1.4" strokeOpacity="0.7" />}
              </g>
            )
          })}

        {/* hover bins */}
        {y[0].map((_, b) => (
          <rect
            key={b}
            x={m.l + b * bwPx}
            y={m.t}
            width={bwPx}
            height={ph}
            fill="transparent"
            onMouseEnter={(e) => { setHov((h) => ({ ...h, b })); tooltip && setTip(tipAt(e, wrap, `${fmt(range.lo + b * bw)} to ${fmt(range.lo + (b + 1) * bw)}`, G.map((g, gi) => ({ color: pal[gi % 4], label: g.label, value: `${counts[gi][b]} · ${((counts[gi][b] / g.values.length) * 100).toFixed(1)}%` })))) }}
            onMouseMove={(e) => tooltip && setTip(tipAt(e, wrap, `${fmt(range.lo + b * bw)} to ${fmt(range.lo + (b + 1) * bw)}`, G.map((g, gi) => ({ color: pal[gi % 4], label: g.label, value: `${counts[gi][b]} · ${((counts[gi][b] / g.values.length) * 100).toFixed(1)}%` }))))}
            onMouseLeave={() => setHov((h) => (h && h.g !== undefined ? { g: h.g } : null))}
          />
        ))}
      </svg>
    </Card>
  )
}
