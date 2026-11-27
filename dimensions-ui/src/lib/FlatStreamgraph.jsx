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

// Rows "Label:v|v|v" -> [{ label, values: [..] }]
function parseMulti(data) {
  if (Array.isArray(data)) return data.map((d) => ({ label: String(d.label ?? ''), values: (d.values ?? [d.value]).map(num) }))
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
function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
// smooth curve that never overshoots the data (monotone cubic)
function monotone(P) {
  const n = P.length
  if (n < 3) return 'M' + P.map((q) => q.join(',')).join('L')
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
function linePath(P, curve, cont = false) {
  if (!P.length) return ''
  if (curve === 'smooth') return cont ? monotone(P).replace(/^M/, 'L') : monotone(P)
  return P.map((q, i) => `${i || cont ? 'L' : 'M'}${q}`).join('')
}
// a filled band between an upper and a lower line
const bandPath = (top, bottom, curve) => linePath(top, curve) + linePath([...bottom].reverse(), curve, true) + 'Z'
const rampColor = (stops, t) => {
  const k = clamp(t, 0, 1) * (stops.length - 1)
  const i = Math.min(stops.length - 2, Math.floor(k))
  return mix(stops[i], stops[i + 1], k - i)
}
// white or dark ink, whichever reads better on a filled colour
function inkOn(c, dark) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(String(c).slice(i, i + 2), 16) || 0)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.66 ? dark : '#ffffff'
}
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

// Flat infographic streamgraph: solid flat layers flowing around a wandering centre
// line, separated by white seams, with chunky labels sitting in each layer's widest
// part and diagonal stripes on the biggest layer. `offset` picks the baseline (wiggle,
// silhouette, expand to 100%, or zero). The stream pops open from the middle; hover
// names the layer under the pointer and reads its value at that moment.
export default function FlatStreamgraph({
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
  colorMode = 'palette',
  seamWidth = 2,
  stripes = true,
  stripeWidth = 5,
  showLabels = true,
  showAxis = true,
  axisArrows = true,
  crosshair = true,
  tooltip = true,
  animate = true,
  duration = 1500,
  decimals = 1,
  prefix = '',
  suffix = '',
  width = 720,
  height = 300,
  size = 13,
  color = '#4a7fe8',
  color2 = '#ef5b7f',
  color3 = '#14a89e',
  color4 = '#f08a24',
  color5 = '#8e5fd6',
  color6 = '#c49a12',
  background = '#ffffff',
  textColor = '#2b2f3a',
  mutedColor = '#8a90a0',
}) {
  const uid = useId().replace(/:/g, '')
  const wrap = useRef(null)
  const [boxRef, boxW] = useWidth()
  const fmt = makeFmt({ decimals, prefix, suffix })

  const { S, n, x } = useMemo(() => {
    const nm = splitNames(names)
    let S
    if (String(data ?? '').trim()) S = parseMulti(data).map((r, i) => ({ label: r.label || nm[i] || `Layer ${i + 1}`, values: r.values.map((v) => Math.max(0, v)) }))
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
    const val = (k, i) => S[k].values[i] ?? 0
    let ord = S.map((_, k) => k)
    const sum = S.map((s) => s.values.reduce((a, b) => a + b, 0))
    if (order === 'inside out') {
      const peak = S.map((s) => s.values.indexOf(Math.max(...s.values)))
      const byPeak = [...ord].sort((a, b) => peak[a] - peak[b])
      const tops = []
      const bottoms = []
      let t = 0
      let b = 0
      byPeak.forEach((k) => {
        if (t < b) { tops.push(k); t += sum[k] } else { bottoms.push(k); b += sum[k] }
      })
      ord = bottoms.reverse().concat(tops)
    } else if (order === 'largest first') ord.sort((a, b) => sum[b] - sum[a])
    const totals = Array.from({ length: n }, (_, i) => ord.reduce((a, k) => a + val(k, i), 0))
    const base = new Array(n).fill(0)
    if (offset === 'silhouette') for (let i = 0; i < n; i++) base[i] = -totals[i] / 2
    else if (offset === 'wiggle') {
      let y = 0
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
    const biggest = sum.indexOf(Math.max(...sum))
    return { ord, bands, totals, biggest }
  }, [S, n, offset, order])

  const p = useReveal(animate, duration, `${data}|${layers}|${points}|${seed}|${offset}|${order}`)
  const [hi, setHi] = useState(-1)
  const [hovL, setHovL] = useState(-1)
  const [tip, setTip] = useState(null)
  const W = Math.max(280, (boxW || width) - size * 3)
  const H = height
  const m = { l: 6, r: showAxis && axisArrows ? 16 : 6, t: 6, b: showAxis ? size * 2.2 : 6 }
  const pw = Math.max(80, W - m.l - m.r)
  const ph = Math.max(60, H - m.t - m.b - (showAxis ? 8 : 0))
  const all = Object.values(stack.bands).flat()
  const lo = Math.min(...all.map((e) => e[0]))
  const hiV = Math.max(...all.map((e) => e[1]))
  const X = (i) => m.l + (n > 1 ? (i / (n - 1)) * pw : pw / 2)
  const mid = m.t + ph / 2
  const g = pop(p)
  const Y = (v) => {
    const y = m.t + ph - ((v - lo) / (hiV - lo || 1)) * ph
    return mid + (y - mid) * g
  }
  const base6 = [color, color2, color3, color4, color5, color6]
  const cols = S.map((_, k) =>
    colorMode === 'ramp' ? rampColor([mix(color, '#000000', 0.3), color, mix(color, background, 0.62)], S.length > 1 ? k / (S.length - 1) : 0) : mix(base6[k % 6], '#000000', 0.2 * Math.floor(k / 6)),
  )
  const lw = Math.max(...x.map((s) => s.length)) * size * 0.82 * 0.6 + 12
  const every = Math.max(1, Math.ceil(lw / Math.max(1, pw / Math.max(1, n - 1))))
  const legendOrder = [...stack.ord].reverse()

  const onMove = (e) => {
    const b = e.currentTarget.getBoundingClientRect()
    const i = clamp(Math.round(((e.clientX - b.left) / b.width) * (n - 1)), 0, n - 1)
    const yv = ((e.clientY - b.top) / b.height) * ph + m.t
    const k = stack.ord.find((q) => yv <= Y(stack.bands[q][i][0]) && yv >= Y(stack.bands[q][i][1]))
    setHi(i)
    setHovL(k ?? -1)
    if (!tooltip) return
    const rows = legendOrder.map((q) => ({ color: cols[q], label: S[q].label, value: fmt(S[q].values[i] ?? 0), q }))
    setTip(tipAt(e, wrap, x[i], k != null ? rows.filter((r) => r.q === k).concat([{ label: 'All layers', value: fmt(stack.totals[i]) }]) : rows.slice(0, 6)))
  }

  return (
    <Card wrapRef={(el) => { wrap.current = el; boxRef.current = el }} {...{ width, background, textColor, mutedColor, size, title, subtitle, tip }}>
      {S.length >= 2 && <Legend items={legendOrder.map((k) => ({ name: S[k].label, color: cols[k] }))} mutedColor={mutedColor} onHover={(i) => setHovL(i < 0 ? -1 : legendOrder[i])} />}
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${title}. Streamgraph of ${S.map((s) => `${s.label} (total ${fmt(s.values.reduce((a, b) => a + b, 0))})`).join(', ')} over ${n} points.`}
        style={{ display: 'block', overflow: 'visible' }}
        onMouseLeave={() => { setHi(-1); setHovL(-1); setTip(null) }}
      >
        <defs>
          <pattern id={`st${uid}`} width={stripeWidth * 2} height={stripeWidth * 2} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width={stripeWidth} height={stripeWidth * 2} fill="#ffffff" opacity="0.3" />
          </pattern>
          <marker id={`ar${uid}`} viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,1 L9,5 L0,9 Z" fill={mutedColor} />
          </marker>
        </defs>
        {stack.ord.map((k) => {
          const B = stack.bands[k]
          const top = B.map((e, i) => [X(i), Y(e[1])])
          const bot = B.map((e, i) => [X(i), Y(e[0])])
          const d = bandPath(top, bot, curve)
          const dim = hovL >= 0 && hovL !== k
          return (
            <g key={k} opacity={dim ? 0.4 : 1} style={{ transition: 'opacity .2s' }}>
              <path d={d} fill={cols[k]} stroke={background} strokeWidth={seamWidth} strokeLinejoin="round" />
              {stripes && k === stack.biggest && <path d={d} fill={`url(#st${uid})`} style={{ pointerEvents: 'none' }} />}
            </g>
          )
        })}
        {/* labels sit in a pill at each layer's thickest point */}
        {showLabels && p > 0.85 &&
          stack.ord.map((k) => {
            const B = stack.bands[k]
            let best = 0
            B.forEach((e, i) => { if (e[1] - e[0] > B[best][1] - B[best][0]) best = i })
            const thick = Y(B[best][0]) - Y(B[best][1])
            const fs = Math.min(size * 0.95, thick * 0.55)
            if (thick < size * 1.3) return null
            const tw = S[k].label.length * fs * 0.62
            const bx = clamp(X(best), m.l + tw / 2 + 6, m.l + pw - tw / 2 - 6)
            const by = (Y(B[best][0]) + Y(B[best][1])) / 2
            const dim = hovL >= 0 && hovL !== k
            return (
              <text key={`l${k}`} x={bx} y={by} dy="0.35em" textAnchor="middle" fontSize={fs} fontWeight="800" fill={inkOn(cols[k], textColor)} opacity={(dim ? 0.4 : 1) * clamp((p - 0.85) / 0.15, 0, 1)} style={{ pointerEvents: 'none' }}>
                {S[k].label}
              </text>
            )
          })}
        {showAxis && (
          <>
            <path d={`M${m.l},${m.t + ph + 8}H${m.l + pw + (axisArrows ? 8 : 0)}`} stroke={mutedColor} strokeWidth="2" strokeLinecap="round" fill="none" markerEnd={axisArrows ? `url(#ar${uid})` : undefined} />
            {x.map((lb, i) =>
              i % every === 0 ? (
                <text key={i} x={X(i)} y={m.t + ph + 8 + size * 1.45} textAnchor={i === 0 ? 'start' : 'middle'} fontSize={size * 0.82} fontWeight="600" fill={hi === i ? textColor : mutedColor}>
                  {lb}
                </text>
              ) : null,
            )}
          </>
        )}
        {crosshair && hi >= 0 && <line x1={X(hi)} x2={X(hi)} y1={m.t} y2={m.t + ph} stroke={textColor} strokeWidth="2" strokeDasharray="4 5" strokeLinecap="round" opacity="0.55" style={{ pointerEvents: 'none' }} />}
        <rect x={m.l} y={m.t} width={pw} height={ph} fill="transparent" onMouseMove={onMove} />
      </svg>
    </Card>
  )
}
