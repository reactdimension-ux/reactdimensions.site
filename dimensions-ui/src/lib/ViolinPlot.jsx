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

// Violin plot: a box plot that also shows the shape of the distribution, so a group
// with two humps looks different from one with a single peak. The shape is a kernel
// density estimate; `bandwidth` smooths it more or less. Show both sides, one side, or
// trim the tails to the data. A slim box and median dot sit inside.
export default function ViolinPlot({
  data = '',
  groups = 4,
  samples = 160,
  seed = 11,
  spread = 1,
  names = '',
  title = 'Latency by region',
  subtitle = 'Milliseconds. Width shows how many requests landed at each value',
  orientation = 'vertical',
  side = 'both',
  scaleBy = 'area',
  bandwidth = 1,
  trim = false,
  showBox = true,
  showPoints = false,
  showMedian = true,
  violinWidth = 0.86,
  fillOpacity = 0.4,
  strokeWidth = 2,
  showGrid = true,
  showAxis = true,
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
  const S = useMemo(() => G.map((g) => summarize(g.values)), [G])
  const p = useReveal(animate, duration, `${data}|${groups}|${samples}|${seed}|${spread}|${bandwidth}|${trim}|${orientation}|${scaleBy}`)
  const [hov, setHov] = useState(null)
  const [tip, setTip] = useState(null)

  const horizontal = orientation === 'horizontal'
  const n = G.length
  const K = useMemo(
    () =>
      S.map((s) => {
        const probe = kde(s, s.min, s.max, 4, bandwidth)
        const cut = trim ? 0 : probe.bw * 2.4
        return kde(s, s.min - cut, s.max + cut, 96, bandwidth)
      }),
    [S, bandwidth, trim],
  )
  const lo0 = Math.min(...K.map((k) => k.xs[0]))
  const hi0 = Math.max(...K.map((k) => k.xs[k.xs.length - 1]))
  const sc = niceRange(lo0, hi0, 5)
  const ticks = ticksOf(sc)
  const tl = ticks.map((t) => prefix + fmtTick(t) + suffix)
  const peakAll = Math.max(...K.map((k) => Math.max(...k.ys)))

  const W = Math.max(240, (boxW || width) - size * 2.8)
  const H = height
  const maxLab = Math.min(16, Math.max(1, ...G.map((g) => g.label.length)))
  const m = horizontal
    ? { l: maxLab * size * 0.58 + 14, r: 14, t: 8, b: showAxis ? size * 2.2 : 8 }
    : { l: showAxis ? Math.max(...tl.map((s) => s.length)) * size * 0.58 + 14 : 8, r: 10, t: 12, b: size * 2.5 }
  const pw = Math.max(40, W - m.l - m.r)
  const ph = Math.max(40, H - m.t - m.b)
  const band = (horizontal ? ph : pw) / Math.max(1, n)
  const maxHalf = (band * clamp(violinWidth, 0.2, 1)) / (side === 'both' ? 2 : 1)
  const along = (v) => (horizontal ? pw : ph) * ((v - sc.lo) / (sc.hi - sc.lo))
  const P = (v, gi, off = 0) => {
    const mid = (horizontal ? m.t : m.l) + gi * band + band / 2 + off
    return horizontal ? [m.l + along(v), mid] : [mid, m.t + ph - along(v)]
  }
  const jit = useMemo(() => G.map((g, gi) => { const r = rng(gi * 17 + 3); return g.values.map(() => r() - 0.5) }), [G])
  const dim = (gi) => (hov !== null && hov !== gi ? 0.3 : 1)
  // one side (+1 or -1) of a violin as points
  const edge = (gi, sgn, ip) => {
    const k = K[gi]
    const top = scaleBy === 'width' ? Math.max(...k.ys) : peakAll
    return k.xs.map((x, i) => P(x, gi, sgn * (k.ys[i] / top) * maxHalf * ip))
  }
  const shape = (gi, ip) => {
    const mid = K[gi].xs.map((x) => P(x, gi, 0)).reverse()
    const R = edge(gi, 1, ip)
    const Lf = edge(gi, -1, ip)
    const pts = side === 'both' ? [...R, ...Lf.reverse()] : side === 'left' ? [...Lf, ...mid] : [...R, ...mid]
    return 'M' + pts.map((q) => q.map((v) => v.toFixed(1)).join(',')).join('L') + 'Z'
  }

  const tipFor = (e, gi) => {
    const s = S[gi]
    return tooltip && setTip(tipAt(e, wrap, G[gi].label, [
      { color: pal[gi % 4], label: 'Median', value: fmt(s.med), strong: true },
      { label: 'Q1 to Q3', value: `${fmt(s.q1)} to ${fmt(s.q3)}` },
      { label: 'Range', value: `${fmt(s.min)} to ${fmt(s.max)}` },
      { label: 'Mean', value: fmt(s.mean) },
      { label: 'Samples', value: String(s.n) },
    ]))
  }

  return (
    <Card wrapRef={(el) => { wrap.current = el; boxRef.current = el }} {...{ width, background, color, textColor, mutedColor, size, title, subtitle, tip }}>
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${title}. Violin plot. ${G.map((g, i) => `${g.label}: median ${fmt(S[i].med)}, range ${fmt(S[i].min)} to ${fmt(S[i].max)}`).join('; ')}`}
        style={{ display: 'block', maxWidth: '100%', overflow: 'visible' }}
        onMouseLeave={() => { setHov(null); setTip(null) }}
      >
        <defs>
          {pal.map((c, k) => (
            <linearGradient key={k} id={`${id}v${k}`} x1={horizontal ? 0 : 0} y1={horizontal ? 0 : 0} x2={horizontal ? 0 : 1} y2={horizontal ? 1 : 0}>
              <stop offset="0" stopColor={c} stopOpacity={fillOpacity * 1.4} />
              <stop offset="0.5" stopColor={c} stopOpacity={fillOpacity * 1.1} />
              <stop offset="1" stopColor={c} stopOpacity={fillOpacity * 1.4} />
            </linearGradient>
          ))}
        </defs>

        {ticks.map((t, i) =>
          horizontal ? (
            <g key={i}>
              {showGrid && <line x1={m.l + along(t)} x2={m.l + along(t)} y1={m.t} y2={m.t + ph} stroke={mutedColor} strokeOpacity="0.15" strokeDasharray="2 5" />}
              {showAxis && <text x={m.l + along(t)} y={m.t + ph + size * 1.5} textAnchor="middle" fontSize={size * 0.85} fill={mutedColor}>{tl[i]}</text>}
            </g>
          ) : (
            <g key={i}>
              {showGrid && <line x1={m.l} x2={m.l + pw} y1={m.t + ph - along(t)} y2={m.t + ph - along(t)} stroke={mutedColor} strokeOpacity="0.15" strokeDasharray="2 5" />}
              {showAxis && <text x={m.l - 9} y={m.t + ph - along(t)} dy="0.34em" textAnchor="end" fontSize={size * 0.85} fill={mutedColor}>{tl[i]}</text>}
            </g>
          ),
        )}

        {G.map((g, gi) => {
          const s = S[gi]
          const c = pal[gi % 4]
          const ip = stag(p, gi, n)
          const bx = Math.min(maxHalf * 0.12, 9)
          const q1 = P(s.q1, gi, -bx)
          const q3 = P(s.q3, gi, bx)
          const med = P(s.med, gi)
          const lo = P(s.lo, gi)
          const hi = P(s.hi, gi)
          const lab = g.label.length > 16 ? g.label.slice(0, 15) + '…' : g.label
          const [lx, ly] = horizontal ? [m.l - 10, m.t + gi * band + band / 2] : [m.l + gi * band + band / 2, m.t + ph + size * 1.5]
          return (
            <g key={gi} opacity={dim(gi)} style={{ transition: 'opacity .2s' }}>
              <path d={shape(gi, ip)} fill={`url(#${id}v${gi % 4})`} stroke={c} strokeWidth={strokeWidth} strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 ${size * 0.45}px ${c}55)` }} />
              {showPoints && g.values.map((v, k) => {
                const [px, py] = P(v, gi, jit[gi][k] * maxHalf * 0.5)
                return <circle key={k} cx={px} cy={py} r="1.8" fill={c} opacity={0.35 * ip} />
              })}
              {showBox && (
                <g opacity={ip}>
                  <line x1={lo[0]} y1={lo[1]} x2={P(s.hi, gi)[0]} y2={hi[1]} stroke={textColor} strokeOpacity="0.55" strokeWidth="1.4" strokeLinecap="round" />
                  <path d={rrect(Math.min(q1[0], q3[0]), Math.min(q1[1], q3[1]), Math.abs(q3[0] - q1[0]) || 6, Math.abs(q3[1] - q1[1]) || 6, [3, 3, 3, 3])} fill={textColor} fillOpacity="0.85" />
                </g>
              )}
              {showMedian && <circle cx={med[0]} cy={med[1]} r={Math.max(3, size * 0.28)} fill={background} stroke={c} strokeWidth="2" opacity={ip} />}
              <text x={lx} y={ly} dy={horizontal ? '0.34em' : 0} textAnchor={horizontal ? 'end' : 'middle'} fontSize={size} fill={hov === gi ? textColor : mutedColor} style={{ transition: 'fill .2s' }}>{lab}</text>
            </g>
          )
        })}

        {G.map((_, gi) => (
          <rect
            key={gi}
            x={horizontal ? m.l : m.l + gi * band}
            y={horizontal ? m.t + gi * band : m.t}
            width={horizontal ? pw : band}
            height={horizontal ? band : ph}
            fill="transparent"
            onMouseEnter={(e) => { setHov(gi); tipFor(e, gi) }}
            onMouseMove={(e) => tipFor(e, gi)}
          />
        ))}
      </svg>
    </Card>
  )
}
