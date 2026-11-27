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

// Flat infographic box plot: chunky solid boxes with a striped upper half, a fat white
// median bar, thick round whiskers and hollow outlier rings. Whiskers follow 1.5 x IQR,
// min to max, or the 5th to 95th percentile; boxes can be notched, and raw points and
// the mean can be shown. Boxes grow out from the median with a springy pop.
export default function FlatBoxPlot({
  data = '',
  groups = 4,
  samples = 120,
  seed = 11,
  spread = 1,
  names = '',
  title = 'Latency by region',
  subtitle = 'Milliseconds. Box: middle 50%. Whiskers: 1.5 x IQR',
  orientation = 'vertical',
  whisker = 'iqr',
  notched = false,
  showOutliers = true,
  showPoints = false,
  showMean = true,
  showValues = true,
  stripes = true,
  stripeWidth = 4,
  boxWidth = 0.5,
  radius = 10,
  medianWidth = 4,
  whiskerWidth = 3,
  showGrid = true,
  showAxis = true,
  axisArrows = true,
  tooltip = true,
  animate = true,
  duration = 1100,
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
  medianColor = '#ffffff',
  background = '#ffffff',
  gridColor = '#eef0f6',
  textColor = '#2b2f3a',
  mutedColor = '#8a90a0',
}) {
  const uid = useId().replace(/:/g, '')
  const wrap = useRef(null)
  const [boxRef, boxW] = useWidth()
  const fmt = makeFmt({ decimals, prefix, suffix })
  const G = useSamples({ data, groups, samples, seed, spread, names })
  const cols = paletteOf(G.length, [color, color2, color3, color4, color5, color6])
  const S = useMemo(() => G.map((g) => summarize(g.values, whisker)), [G, whisker])
  const p = useReveal(animate, duration, `${data}|${groups}|${samples}|${seed}|${spread}|${whisker}|${notched}|${orientation}`)
  const [hov, setHov] = useState(-1)
  const [tip, setTip] = useState(null)

  const horizontal = orientation === 'horizontal'
  const n = G.length
  const lo0 = Math.min(...S.map((s) => (showOutliers ? s.min : s.lo)))
  const hi0 = Math.max(...S.map((s) => (showOutliers ? s.max : s.hi)))
  const pad = (hi0 - lo0) * 0.04
  const sc = niceRange(lo0 - pad, hi0 + pad, 5)
  const ticks = ticksOf(sc)
  const tl = ticks.map((t) => prefix + fmtTick(t) + suffix)

  const W = Math.max(240, (boxW || width) - size * 3)
  const H = height
  const maxLab = Math.min(16, Math.max(1, ...G.map((g) => g.label.length)))
  const valW = showValues ? Math.max(...S.map((s) => fmt(s.med).length)) * size * 0.6 + 12 : 0
  const arrowPad = showAxis && axisArrows ? size * 1.2 : 6
  const m = horizontal
    ? { l: maxLab * size * 0.6 + 16, r: Math.max(arrowPad, valW) + 6, t: arrowPad, b: showAxis ? size * 2.2 : 8 }
    : { l: showAxis ? Math.max(...tl.map((s) => s.length)) * size * 0.55 + 16 : 8, r: arrowPad, t: (showValues ? size * 1.7 : 0) + arrowPad, b: size * 2.4 }
  const pw = Math.max(40, W - m.l - m.r)
  const ph = Math.max(40, H - m.t - m.b)
  const band = (horizontal ? ph : pw) / Math.max(1, n)
  const bw = band * clamp(boxWidth, 0.15, 0.95)
  const along = (v) => (horizontal ? pw : ph) * ((v - sc.lo) / (sc.hi - sc.lo))
  // value + offset across the band -> x, y
  const P = (v, gi, off = 0) => {
    const mid = (horizontal ? m.t : m.l) + gi * band + band / 2 + off
    return horizontal ? [m.l + along(v), mid] : [mid, m.t + ph - along(v)]
  }
  const jit = useMemo(() => G.map((g, gi) => { const r = rng(gi * 31 + 5); return g.values.map(() => r() - 0.5) }), [G])
  const dim = (gi) => (hov >= 0 && hov !== gi ? 0.4 : 1)

  const tipFor = (e, gi) => {
    const s = S[gi]
    return tooltip && setTip(tipAt(e, wrap, G[gi].label, [
      { color: cols[gi], label: 'Median', value: fmt(s.med) },
      { label: 'Q1 to Q3', value: `${fmt(s.q1)} to ${fmt(s.q3)}` },
      { label: 'Whiskers', value: `${fmt(s.lo)} to ${fmt(s.hi)}` },
      { label: 'Mean', value: fmt(s.mean) },
      { label: 'Outliers', value: `${s.out.length} of ${s.n}` },
    ]))
  }
  const late = clamp((p - 0.5) * 2, 0, 1)

  return (
    <Card wrapRef={(el) => { wrap.current = el; boxRef.current = el }} {...{ width, background, textColor, mutedColor, size, title, subtitle, tip }}>
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${title}. Box plot. ${G.map((g, i) => `${g.label}: median ${fmt(S[i].med)}, quartiles ${fmt(S[i].q1)} to ${fmt(S[i].q3)}`).join('; ')}`}
        style={{ display: 'block', overflow: 'visible' }}
        onMouseLeave={() => { setHov(-1); setTip(null) }}
      >
        <defs>
          <pattern id={`st${uid}`} width={stripeWidth * 2} height={stripeWidth * 2} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width={stripeWidth} height={stripeWidth * 2} fill="#ffffff" opacity="0.35" />
          </pattern>
          <marker id={`ar${uid}`} viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,1 L9,5 L0,9 Z" fill={mutedColor} />
          </marker>
        </defs>

        {ticks.map((t, i) => {
          const u = along(t)
          return horizontal ? (
            <g key={i}>
              {showGrid && i > 0 && <line x1={m.l + u} x2={m.l + u} y1={m.t} y2={m.t + ph} stroke={gridColor} strokeWidth="2" strokeDasharray="5 7" strokeLinecap="round" />}
              {showAxis && <text x={m.l + u} y={m.t + ph + size * 1.5} textAnchor="middle" fontSize={size * 0.82} fill={mutedColor} style={{ fontVariantNumeric: 'tabular-nums' }}>{tl[i]}</text>}
            </g>
          ) : (
            <g key={i}>
              {showGrid && i > 0 && <line x1={m.l} x2={m.l + pw} y1={m.t + ph - u} y2={m.t + ph - u} stroke={gridColor} strokeWidth="2" strokeDasharray="5 7" strokeLinecap="round" />}
              {showAxis && <text x={m.l - 10} y={m.t + ph - u} dy="0.35em" textAnchor="end" fontSize={size * 0.82} fill={mutedColor} style={{ fontVariantNumeric: 'tabular-nums' }}>{tl[i]}</text>}
            </g>
          )
        })}

        {G.map((g, gi) => {
          const s = S[gi]
          const c = cols[gi]
          const ip = pop(stag(p, gi, n))
          // grow every value out from the median
          const L = (v) => s.med + (v - s.med) * ip
          const [qx1, qy1] = P(L(s.q1), gi, -bw / 2)
          const [qx2, qy2] = P(L(s.q3), gi, bw / 2)
          const x = Math.min(qx1, qx2)
          const y = Math.min(qy1, qy2)
          const w = Math.abs(qx2 - qx1)
          const h = Math.abs(qy2 - qy1)
          const half = 1.57 * (s.iqr / Math.sqrt(s.n))
          const nl = Math.max(s.q1, s.med - half)
          const nh = Math.min(s.q3, s.med + half)
          const boxPath = notched
            ? 'M' + [[s.q1, -1], [nl, -1], [s.med, -0.5], [nh, -1], [s.q3, -1], [s.q3, 1], [nh, 1], [s.med, 0.5], [nl, 1], [s.q1, 1]].map(([v, o]) => P(L(v), gi, (o * bw) / 2).map((q) => q.toFixed(1)).join(',')).join('L') + 'Z'
            : rrect(x, y, w, h, [radius, radius, radius, radius])
          // the upper half of the box (median to Q3) carries the stripe band
          const [ux1, uy1] = P(L(s.med), gi, -bw / 2)
          const [ux2, uy2] = P(L(s.q3), gi, bw / 2)
          const ub = { x: Math.min(ux1, ux2), y: Math.min(uy1, uy2), w: Math.abs(ux2 - ux1), h: Math.abs(uy2 - uy1) }
          const mw = (bw / 2) * (notched ? 0.5 : 1) - medianWidth / 2 - 1
          const [m1, m2] = [P(L(s.med), gi, -mw), P(L(s.med), gi, mw)]
          const [wl0, wl1] = [P(L(s.lo), gi), P(L(s.q1), gi)]
          const [wh0, wh1] = [P(L(s.q3), gi), P(L(s.hi), gi)]
          const cap = bw * 0.3
          const capL = (v) => [P(L(v), gi, -cap), P(L(v), gi, cap)]
          const meanP = P(L(s.mean), gi)
          const ms = Math.max(4.5, size * 0.42)
          const lab = g.label.length > 16 ? g.label.slice(0, 15) + '…' : g.label
          const [lx, ly] = horizontal ? [m.l - 12, m.t + gi * band + band / 2] : [m.l + gi * band + band / 2, m.t + ph + size * 1.6]
          const vp = P(L(s.hi), gi)
          return (
            <g key={gi} opacity={dim(gi)} style={{ transition: 'opacity .2s' }}>
              {[[wl0, wl1], [wh0, wh1]].map(([a, b], k) => <line key={k} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={c} strokeWidth={whiskerWidth} strokeLinecap="round" />)}
              {[capL(s.lo), capL(s.hi)].map(([a, b], k) => <line key={`c${k}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={c} strokeWidth={whiskerWidth + 0.5} strokeLinecap="round" />)}
              <path d={boxPath} fill={c} strokeLinejoin="round" />
              {stripes && ub.w > 2 && ub.h > 2 && (
                <>
                  <clipPath id={`c${uid}${gi}`}><path d={boxPath} /></clipPath>
                  <g clipPath={`url(#c${uid}${gi})`}>
                    <rect x={ub.x} y={ub.y} width={ub.w} height={ub.h} fill={mix(c, '#000000', 0.12)} />
                    <rect x={ub.x} y={ub.y} width={ub.w} height={ub.h} fill={`url(#st${uid})`} />
                  </g>
                </>
              )}
              <line x1={m1[0]} y1={m1[1]} x2={m2[0]} y2={m2[1]} stroke={medianColor} strokeWidth={medianWidth} strokeLinecap="round" />
              {showPoints && g.values.map((v, k) => {
                const [px, py] = P(v, gi, jit[gi][k] * bw * 0.9)
                return <circle key={k} cx={px} cy={py} r="2.2" fill={textColor} opacity={0.3 * late} style={{ pointerEvents: 'none' }} />
              })}
              {showMean && ip > 0.05 && <path d={`M${meanP[0]},${meanP[1] - ms}l${ms},${ms}l${-ms},${ms}l${-ms},${-ms}z`} fill={background} stroke={mix(c, '#000000', 0.3)} strokeWidth="2" strokeLinejoin="round" />}
              {showOutliers && s.out.map((v, k) => {
                const [ox, oy] = P(v, gi)
                return <circle key={k} cx={ox} cy={oy} r={4 * pop(late)} fill={background} stroke={c} strokeWidth="2.5" />
              })}
              {showValues && late > 0 && (
                <text
                  x={horizontal ? Math.max(vp[0], ...s.out.map((v) => P(v, gi)[0])) + 10 : vp[0]}
                  y={horizontal ? vp[1] : Math.min(vp[1] - 10, ...(showOutliers ? s.out.map((v) => P(v, gi)[1] - 10) : []))}
                  dy={horizontal ? '0.35em' : 0}
                  textAnchor={horizontal ? 'start' : 'middle'}
                  fontSize={size * 1.05}
                  fontWeight="700"
                  fill={textColor}
                  opacity={late}
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {fmt(s.med)}
                </text>
              )}
              <text x={lx} y={ly} dy={horizontal ? '0.35em' : 0} textAnchor={horizontal ? 'end' : 'middle'} fontSize={size * 0.9} fontWeight="600" fill={hov === gi ? textColor : mutedColor} style={{ transition: 'fill .2s' }}>{lab}</text>
            </g>
          )
        })}

        {showAxis && (
          <g stroke={mutedColor} strokeWidth="2" strokeLinecap="round" fill="none" style={{ pointerEvents: 'none' }}>
            <path d={`M${m.l},${m.t + ph}H${m.l + pw + (axisArrows ? size * 0.9 : 0)}`} markerEnd={axisArrows ? `url(#ar${uid})` : undefined} />
            <path d={`M${m.l},${m.t + ph}V${m.t - (axisArrows ? size * 0.9 : 0)}`} markerEnd={axisArrows ? `url(#ar${uid})` : undefined} />
          </g>
        )}

        {G.map((_, gi) => (
          <rect
            key={gi}
            x={horizontal ? m.l : m.l + gi * band}
            y={horizontal ? m.t + gi * band : m.t - (showValues ? size * 1.7 : 0)}
            width={horizontal ? pw + m.r : band}
            height={horizontal ? band : ph + (showValues ? size * 1.7 : 0)}
            fill="transparent"
            onMouseEnter={(e) => { setHov(gi); tipFor(e, gi) }}
            onMouseMove={(e) => tipFor(e, gi)}
          />
        ))}
      </svg>
    </Card>
  )
}
