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

// Flat infographic ridgeline (joy) plot: one solid flat ridge per group, stacked so
// each climbs into the one above, outlined in the card colour so the layers read like
// cut paper. A striped band marks each group's middle 50%, a white tick marks the
// median, and the median value sits at the end of each row. Ridges pop up in turn.
export default function FlatRidgelinePlot({
  data = '',
  groups = 6,
  samples = 220,
  seed = 5,
  spread = 1,
  names = '',
  title = 'Score distributions',
  subtitle = 'Each ridge is one group; taller means more common',
  overlap = 1.7,
  normalize = 'shared',
  bandwidth = 1,
  colorMode = 'ramp',
  strokeWidth = 2.5,
  stripes = true,
  stripeWidth = 4,
  showMedian = true,
  showMean = false,
  showValues = true,
  showGrid = true,
  showAxis = true,
  axisArrows = true,
  tooltip = true,
  animate = true,
  duration = 1300,
  decimals = 0,
  prefix = '',
  suffix = '',
  width = 680,
  height = 320,
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
  const fmt = makeFmt({ decimals, prefix, suffix })
  const G = useSamples({ data, groups, samples, seed, spread, names })
  const S = useMemo(() => G.map((g) => summarize(g.values)), [G])
  const p = useReveal(animate, duration, `${data}|${groups}|${samples}|${seed}|${spread}|${bandwidth}|${overlap}|${normalize}`)
  const [hov, setHov] = useState(-1)
  const [tip, setTip] = useState(null)

  const n = G.length
  const lo0 = Math.min(...S.map((s) => s.min))
  const hi0 = Math.max(...S.map((s) => s.max))
  const pad = (hi0 - lo0) * 0.12
  const sc = niceRange(lo0 - pad, hi0 + pad, 6)
  const K = useMemo(() => S.map((s) => kde(s, sc.lo, sc.hi, 110, bandwidth)), [S, sc.lo, sc.hi, bandwidth])
  const peakAll = Math.max(...K.map((k) => Math.max(...k.ys)))
  const ticks = ticksOf(sc)
  const pal = paletteOf(n, [color, color2, color3, color4, color5, color6])
  const colors = G.map((_, i) => (colorMode === 'single' ? color : colorMode === 'palette' ? pal[i] : mix(color, color2, n > 1 ? i / (n - 1) : 0)))

  const W = Math.max(240, (boxW || width) - size * 3)
  const H = height
  const maxLab = Math.min(16, Math.max(1, ...G.map((g) => g.label.length)))
  const valW = showValues ? Math.max(...S.map((s) => fmt(s.med).length)) * size * 0.62 + 14 : 0
  const arrowW = showAxis && axisArrows ? size * 1.4 : 4
  const m = { l: maxLab * size * 0.6 + 16, r: arrowW + Math.max(10, valW), t: 6, b: showAxis ? size * 2.2 : 8 }
  const pw = Math.max(40, W - m.l - m.r)
  const ov = clamp(overlap, 0.4, 4)
  const band = (H - m.t - m.b) / Math.max(1, n - 1 + ov)
  const ridge = band * ov
  const X = (v) => m.l + ((v - sc.lo) / (sc.hi - sc.lo)) * pw
  const base = (i) => m.t + ridge + i * band
  const dim = (i) => (hov >= 0 && hov !== i ? 0.4 : 1)
  const late = clamp((p - 0.5) / 0.35, 0, 1)
  const rowsFor = (i) => [
    { color: colors[i], label: 'Median', value: fmt(S[i].med) },
    { label: 'Mean', value: fmt(S[i].mean) },
    { label: 'Std dev', value: fmt(S[i].sd) },
    { label: 'Samples', value: String(S[i].n) },
  ]

  return (
    <Card wrapRef={(el) => { wrap.current = el; boxRef.current = el }} {...{ width, background, textColor, mutedColor, size, title, subtitle, tip }}>
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${title}. Ridgeline plot. ${G.map((g, i) => `${g.label}: median ${fmt(S[i].med)}`).join('; ')}`}
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

        {ticks.map((t, i) => (
          <g key={i}>
            {showGrid && i > 0 && <line x1={X(t)} x2={X(t)} y1={m.t} y2={H - m.b} stroke={gridColor} strokeWidth="2" strokeDasharray="5 7" strokeLinecap="round" />}
            {showAxis && <text x={X(t)} y={H - m.b + size * 1.5} textAnchor="middle" fontSize={size * 0.82} fill={mutedColor} style={{ fontVariantNumeric: 'tabular-nums' }}>{prefix + fmtTick(t) + suffix}</text>}
          </g>
        ))}

        {G.map((g, i) => {
          const k = K[i]
          const ip = pop(stag(p, n - 1 - i, n))
          const top = normalize === 'peak' ? Math.max(...k.ys) : peakAll
          const b = base(i)
          const pts = k.xs.map((x, j) => [X(x), b - (k.ys[j] / top) * ridge * ip])
          const line = 'M' + pts.map((q) => q.map((v) => v.toFixed(1)).join(',')).join('L')
          const area = `${line}L${pts[pts.length - 1][0].toFixed(1)},${b}L${pts[0][0].toFixed(1)},${b}Z`
          const c = colors[i]
          const lab = g.label.length > 16 ? g.label.slice(0, 15) + '…' : g.label
          const at = (v) => {
            const j = clamp(Math.round(((v - sc.lo) / (sc.hi - sc.lo)) * (k.xs.length - 1)), 0, k.xs.length - 1)
            return { x: X(v), y: b - (k.ys[j] / top) * ridge * ip }
          }
          const med = at(S[i].med)
          const mean = at(S[i].mean)
          return (
            <g key={i} opacity={dim(i)} style={{ transition: 'opacity .2s' }}>
              <path d={area} fill={c} stroke={background} strokeWidth={strokeWidth} strokeLinejoin="round" />
              {stripes && (
                <>
                  <clipPath id={`c${uid}${i}`}><path d={area} /></clipPath>
                  <g clipPath={`url(#c${uid}${i})`}>
                    <rect x={X(S[i].q1)} y={b - ridge * 1.3} width={X(S[i].q3) - X(S[i].q1)} height={ridge * 1.3} fill={mix(c, '#000000', 0.12)} />
                    <rect x={X(S[i].q1)} y={b - ridge * 1.3} width={X(S[i].q3) - X(S[i].q1)} height={ridge * 1.3} fill={`url(#st${uid})`} />
                  </g>
                </>
              )}
              <line x1={m.l} x2={m.l + pw} y1={b} y2={b} stroke={mutedColor} strokeWidth="2" strokeLinecap="round" opacity="0.5" />
              {showMedian && late > 0 && med.y < b - 4 && <line x1={med.x} x2={med.x} y1={b - 2} y2={med.y + 3} stroke="#ffffff" strokeWidth="3" strokeLinecap="round" opacity={late} />}
              {showMean && late > 0 && <circle cx={mean.x} cy={b} r={4.5 * pop(late)} fill={background} stroke={mix(c, '#000000', 0.3)} strokeWidth="2.5" />}
              <text x={m.l - 12} y={b} dy="-0.2em" textAnchor="end" fontSize={size * 0.9} fontWeight="600" fill={hov === i ? textColor : mutedColor} style={{ transition: 'fill .2s' }}>{lab}</text>
              {showValues && late > 0 && (
                <text x={m.l + pw + arrowW + 8} y={b} dy="-0.2em" fontSize={size * 1.02} fontWeight="700" fill={textColor} opacity={late} style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(S[i].med)}</text>
              )}
            </g>
          )
        })}

        {showAxis && (
          <path d={`M${m.l},${H - m.b}H${m.l + pw + (axisArrows ? size * 1 : 0)}`} stroke={mutedColor} strokeWidth="2" strokeLinecap="round" fill="none" markerEnd={axisArrows ? `url(#ar${uid})` : undefined} style={{ pointerEvents: 'none' }} />
        )}

        {G.map((g, i) => (
          <rect
            key={i}
            x={0}
            y={base(i) - band * 0.75}
            width={W}
            height={band}
            fill="transparent"
            onMouseEnter={(e) => { setHov(i); tooltip && setTip(tipAt(e, wrap, g.label, rowsFor(i))) }}
            onMouseMove={(e) => tooltip && setTip(tipAt(e, wrap, g.label, rowsFor(i)))}
          />
        ))}
      </svg>
    </Card>
  )
}
