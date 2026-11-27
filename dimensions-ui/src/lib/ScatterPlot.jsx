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

// ---- relationship helpers ----
// Points are "Label:x|y|size|group" (size and group optional; group is 1 to 4), e.g.
// "Atlas:42|61|30|1, Boreal:55|48|12|2". Leave `data` empty for a seeded demo set.

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
const NAMES = ['Atlas', 'Boreal', 'Cinder', 'Delta', 'Ember', 'Fjord', 'Glint', 'Harbor', 'Iris', 'Jade', 'Kite', 'Lumen', 'Moss', 'Nova', 'Onyx', 'Pearl', 'Quartz', 'River', 'Sable', 'Tidal', 'Umber', 'Vale', 'Wren', 'Xenon', 'Yarrow', 'Zephyr']
const nameOf = (i) => NAMES[i % NAMES.length] + (i >= NAMES.length ? ` ${Math.floor(i / NAMES.length) + 1}` : '')

function synthPoints({ count, correlation, groups, seed, noise }) {
  const r = rng(Math.round(seed) * 97 + 1)
  const G = clamp(Math.round(groups), 1, 4)
  const cx = [38, 58, 46, 68]
  const cy = [42, 58, 72, 46]
  const rho = clamp(correlation, -0.99, 0.99)
  return Array.from({ length: Math.round(count) }, (_, i) => {
    const g = i % G
    const zx = gauss(r)
    const zy = rho * zx + Math.sqrt(1 - rho * rho) * gauss(r) * noise
    return {
      label: nameOf(i),
      x: +(cx[g] + zx * 12).toFixed(2),
      y: +(cy[g] + zy * 12).toFixed(2),
      size: +(14 + r() * 80 * (1 + 0.45 * zx)).toFixed(1),
      g,
    }
  })
}
function parsePoints(data) {
  if (Array.isArray(data)) return data.map((d, i) => ({ label: String(d.label ?? nameOf(i)), x: num(d.x), y: num(d.y), size: d.size == null ? 1 : num(d.size), g: Math.max(0, num(d.g ?? d.group ?? 1) - 1) }))
  const rows = parseRows(data)
  if (!rows.length || !String(data ?? '').trim()) return null
  return rows.map((r, i) => ({ label: r.label || nameOf(i), x: r.values[0] ?? 0, y: r.values[1] ?? 0, size: r.values[2] ?? 1, g: Math.max(0, Math.round(r.values[3] ?? 1) - 1) }))
}
function usePoints({ data, count, correlation, groups, seed, noise }) {
  return useMemo(() => parsePoints(data) ?? synthPoints({ count, correlation, groups, seed, noise }), [data, count, correlation, groups, seed, noise])
}

function linreg(pts) {
  const n = pts.length
  if (n < 2) return null
  const mx = pts.reduce((a, p) => a + p.x, 0) / n
  const my = pts.reduce((a, p) => a + p.y, 0) / n
  let sxx = 0
  let sxy = 0
  let syy = 0
  pts.forEach((p) => {
    sxx += (p.x - mx) ** 2
    sxy += (p.x - mx) * (p.y - my)
    syy += (p.y - my) ** 2
  })
  if (!sxx || !syy) return null
  const slope = sxy / sxx
  return { slope, icpt: my - slope * mx, r: sxy / Math.sqrt(sxx * syy), mx, my }
}
function pearson(a, b) {
  const n = a.length
  const ma = a.reduce((s, v) => s + v, 0) / n
  const mb = b.reduce((s, v) => s + v, 0) / n
  let sab = 0
  let saa = 0
  let sbb = 0
  for (let i = 0; i < n; i++) {
    sab += (a[i] - ma) * (b[i] - mb)
    saa += (a[i] - ma) ** 2
    sbb += (b[i] - mb) ** 2
  }
  return saa && sbb ? sab / Math.sqrt(saa * sbb) : 0
}

const fmtTickLabel = (v) => (Math.abs(v) >= 1000 ? axisFmt.format(v) : String(+v.toFixed(Math.abs(v) < 10 ? 2 : Math.abs(v) < 100 ? 1 : 0)))

// colour ramps: stops are #rrggbb, t is 0..1
const rampAt = (stops, t) => {
  const k = clamp(t, 0, 1) * (stops.length - 1)
  const i = Math.min(stops.length - 2, Math.floor(k))
  return mix(stops[i], stops[i + 1], k - i)
}
const lum = (c) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16) / 255)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const inkOn = (c) => (lum(c) > 0.55 ? '#0b0b0d' : '#ffffff')
function stopsFor(scale, { color, color2, color3, background, reverse }) {
  const neutral = mix(background, '#ffffff', 0.1)
  const s = scale === 'diverging' ? [color2, neutral, color] : scale === 'spectrum' ? [color2, color3, color] : [mix(background, color, 0.1), color]
  return reverse ? [...s].reverse() : s
}
// a gradient bar with end labels, used as a chart legend
function RampLegend({ stops, lo, hi, mid, mutedColor }) {
  const g = Array.from({ length: 12 }, (_, i) => rampAt(stops, i / 11)).join(', ')
  return (
    <div style={{ minWidth: '9em', fontSize: '0.78em', color: mutedColor, paddingTop: '0.15em' }}>
      <div style={{ height: '0.6em', borderRadius: 99, background: `linear-gradient(90deg, ${g})`, boxShadow: 'inset 0 0 0 1px #ffffff14' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.3em', fontVariantNumeric: 'tabular-nums' }}>
        <span>{lo}</span>
        {mid != null && <span>{mid}</span>}
        <span>{hi}</span>
      </div>
    </div>
  )
}
// ---- end relationship helpers ----

// Scatter plot: one dot per item at (x, y). Trend lines show the relationship (with its
// correlation r), groups get their own colour and line, hovering finds the nearest dot,
// and dragging on the plot draws a selection box with a summary of what is inside.
// Paste points as "Label:x|y|size|group" or leave `data` empty for the demo set.
export default function ScatterPlot({
  data = '',
  count = 140,
  correlation = 0.72,
  groups = 2,
  noise = 1,
  seed = 4,
  names = 'Control, Treatment',
  title = 'Dose vs response',
  subtitle = 'Each dot is one participant. Drag to select a region',
  xLabel = 'Dose (mg)',
  yLabel = 'Response',
  showTrend = true,
  trendScope = 'per group',
  showR = true,
  pointSize = 5.5,
  pointOpacity = 0.8,
  zeroBased = false,
  brush = true,
  showGrid = true,
  showAxis = true,
  showLegend = true,
  tooltip = true,
  animate = true,
  duration = 1200,
  xSuffix = '',
  ySuffix = '',
  width = 680,
  height = 340,
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
  const svgRef = useRef(null)
  const [boxRef, boxW] = useWidth()
  const pal = [color, color2, color3, color4]
  const pts = usePoints({ data, count, correlation, groups, seed, noise })
  const G = Math.max(1, ...pts.map((p) => p.g + 1))
  const nm = splitNames(names)
  const gName = (g) => nm[g] ?? (G > 1 ? `Group ${g + 1}` : 'All')
  const p = useReveal(animate, duration, `${data}|${count}|${correlation}|${groups}|${noise}|${seed}`)
  const [hov, setHov] = useState(-1)
  const [hovG, setHovG] = useState(null)
  const [tip, setTip] = useState(null)
  const [drag, setDrag] = useState(null) // {x0,y0,x1,y1} in svg px
  const [sel, setSel] = useState(null)

  const xs = pts.map((q) => q.x)
  const ys = pts.map((q) => q.y)
  const padX = (Math.max(...xs) - Math.min(...xs)) * 0.05
  const padY = (Math.max(...ys) - Math.min(...ys)) * 0.06
  const sx = niceRange(zeroBased ? Math.min(0, ...xs) : Math.min(...xs) - padX, Math.max(...xs) + padX, 6)
  const sy = niceRange(zeroBased ? Math.min(0, ...ys) : Math.min(...ys) - padY, Math.max(...ys) + padY, 5)
  const xt = ticksOf(sx)
  const yt = ticksOf(sy)

  const W = Math.max(260, (boxW || width) - size * 2.8)
  const H = height
  const m = { l: (showAxis ? Math.max(...yt.map((t) => (fmtTickLabel(t) + ySuffix).length)) * size * 0.58 + 14 : 8) + (yLabel ? size * 1.4 : 0), r: 12, t: 10, b: (showAxis ? size * 2.1 : 8) + (xLabel ? size * 1.5 : 0) }
  const pw = Math.max(60, W - m.l - m.r)
  const ph = Math.max(60, H - m.t - m.b)
  const X = (v) => m.l + ((v - sx.lo) / (sx.hi - sx.lo)) * pw
  const Y = (v) => m.t + ph - ((v - sy.lo) / (sy.hi - sy.lo)) * ph
  const px = useMemo(() => pts.map((q) => [X(q.x), Y(q.y)]), [pts, W, H, sx.lo, sx.hi, sy.lo, sy.hi]) // eslint-disable-line react-hooks/exhaustive-deps

  const trends = useMemo(() => {
    if (!showTrend) return []
    const sets = trendScope === 'all' || G === 1 ? [{ g: 0, all: true, pts }] : Array.from({ length: G }, (_, g) => ({ g, pts: pts.filter((q) => q.g === g) }))
    return sets.map((s) => ({ ...s, fit: linreg(s.pts) })).filter((s) => s.fit)
  }, [showTrend, trendScope, pts, G])

  const local = (e) => {
    const b = svgRef.current.getBoundingClientRect()
    return [e.clientX - b.left, e.clientY - b.top]
  }
  const inBox = (i, b) => px[i][0] >= Math.min(b.x0, b.x1) && px[i][0] <= Math.max(b.x0, b.x1) && px[i][1] >= Math.min(b.y0, b.y1) && px[i][1] <= Math.max(b.y0, b.y1)
  const stats = (b) => {
    const ix = pts.map((_, i) => i).filter((i) => inBox(i, b))
    if (!ix.length) return null
    return { n: ix.length, mx: ix.reduce((a, i) => a + pts[i].x, 0) / ix.length, my: ix.reduce((a, i) => a + pts[i].y, 0) / ix.length, b }
  }
  const nearest = (e) => {
    const [mx, my] = local(e)
    let best = -1
    let bd = 20 * 20
    px.forEach(([x, y], i) => {
      const d = (x - mx) ** 2 + (y - my) ** 2
      if (d < bd) {
        bd = d
        best = i
      }
    })
    return best
  }
  const onMove = (e) => {
    if (drag) {
      const [x, y] = local(e)
      setDrag({ ...drag, x1: clamp(x, m.l, m.l + pw), y1: clamp(y, m.t, m.t + ph) })
      return
    }
    const i = nearest(e)
    setHov(i)
    if (i < 0 || !tooltip) return setTip(null)
    const q = pts[i]
    setTip(tipAt(e, wrap, q.label, [{ color: pal[q.g % 4], label: xLabel || 'x', value: fmtTickLabel(q.x) + xSuffix }, { color: pal[q.g % 4], label: yLabel || 'y', value: fmtTickLabel(q.y) + ySuffix }, ...(G > 1 ? [{ label: 'Group', value: gName(q.g) }] : [])]))
  }
  const onDown = (e) => {
    if (!brush) return
    const [x, y] = local(e)
    setSel(null)
    setTip(null)
    setDrag({ x0: clamp(x, m.l, m.l + pw), y0: clamp(y, m.t, m.t + ph), x1: clamp(x, m.l, m.l + pw), y1: clamp(y, m.t, m.t + ph) })
  }
  const onUp = () => {
    if (!drag) return
    if (Math.abs(drag.x1 - drag.x0) > 6 && Math.abs(drag.y1 - drag.y0) > 6) setSel(stats(drag))
    setDrag(null)
  }
  const live = drag ? stats(drag) : sel
  const box = drag || sel?.b
  const isIn = (i) => !box || inBox(i, box)
  const dimOf = (g) => (hovG !== null && hovG !== g ? 0.18 : 1)

  return (
    <Card
      wrapRef={(el) => { wrap.current = el; boxRef.current = el }}
      {...{ width, background, color, textColor, mutedColor, size, title, subtitle, tip }}
      legend={showLegend && G > 1 ? <Legend items={Array.from({ length: G }, (_, g) => ({ label: gName(g), color: pal[g % 4] }))} onHover={setHovG} mutedColor={mutedColor} /> : null}
    >
      <svg
        ref={svgRef}
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${title}. Scatter plot of ${pts.length} points${trends[0] ? `, correlation ${trends[0].fit.r.toFixed(2)}` : ''}.`}
        style={{ display: 'block', maxWidth: '100%', overflow: 'visible', touchAction: 'none', userSelect: 'none' }}
        onMouseLeave={() => { setHov(-1); setTip(null); setDrag(null) }}
      >
        {yt.map((t, i) => (
          <g key={i}>
            {showGrid && <line x1={m.l} x2={m.l + pw} y1={Y(t)} y2={Y(t)} stroke={mutedColor} strokeOpacity="0.14" strokeDasharray="2 5" />}
            {showAxis && <text x={m.l - 9} y={Y(t)} dy="0.34em" textAnchor="end" fontSize={size * 0.85} fill={mutedColor}>{fmtTickLabel(t) + ySuffix}</text>}
          </g>
        ))}
        {xt.map((t, i) => (
          <g key={i}>
            {showGrid && <line x1={X(t)} x2={X(t)} y1={m.t} y2={m.t + ph} stroke={mutedColor} strokeOpacity="0.14" strokeDasharray="2 5" />}
            {showAxis && <text x={X(t)} y={m.t + ph + size * 1.4} textAnchor="middle" fontSize={size * 0.85} fill={mutedColor}>{fmtTickLabel(t) + xSuffix}</text>}
          </g>
        ))}
        <line x1={m.l} x2={m.l + pw} y1={m.t + ph} y2={m.t + ph} stroke={mutedColor} strokeOpacity="0.4" />
        <line x1={m.l} x2={m.l} y1={m.t} y2={m.t + ph} stroke={mutedColor} strokeOpacity="0.4" />
        {xLabel && <text x={m.l + pw / 2} y={H - 2} textAnchor="middle" fontSize={size * 0.9} fill={mutedColor} fontWeight="600">{xLabel}</text>}
        {yLabel && <text transform={`translate(${size * 0.9},${m.t + ph / 2}) rotate(-90)`} textAnchor="middle" fontSize={size * 0.9} fill={mutedColor} fontWeight="600">{yLabel}</text>}

        {/* trend lines */}
        {trends.map((t) => {
          const c = t.all ? textColor : pal[t.g % 4]
          const x0 = Math.min(...t.pts.map((q) => q.x))
          const x1 = Math.max(...t.pts.map((q) => q.x))
          const xe = x0 + (x1 - x0) * ease(clamp((p - 0.4) / 0.6, 0, 1))
          const yv = (x) => t.fit.slope * x + t.fit.icpt
          return (
            <g key={t.g} opacity={dimOf(t.g)} style={{ pointerEvents: 'none', transition: 'opacity .2s' }}>
              <line x1={X(x0)} y1={Y(yv(x0))} x2={X(xe)} y2={Y(yv(xe))} stroke={c} strokeWidth="2.4" strokeLinecap="round" style={{ filter: `drop-shadow(0 0 ${size * 0.4}px ${c}99)` }} />
            </g>
          )
        })}

        {/* points */}
        {pts.map((q, i) => {
          const ip = ease(clamp((p - (i / pts.length) * 0.5) / 0.5, 0, 1))
          const c = pal[q.g % 4]
          const on = isIn(i)
          const active = i === hov
          return (
            <g key={i} opacity={dimOf(q.g) * (on ? 1 : 0.18)} style={{ transition: 'opacity .2s', pointerEvents: 'none' }}>
              {active && <circle cx={px[i][0]} cy={px[i][1]} r={pointSize * 2.6} fill={c} opacity="0.25" />}
              <circle cx={px[i][0]} cy={px[i][1]} r={(active ? pointSize * 1.5 : pointSize) * ip} fill={c} fillOpacity={pointOpacity} stroke={active ? textColor : background} strokeWidth={active ? 1.8 : 0.8} />
            </g>
          )
        })}

        {/* correlation labels, above the points */}
        {showR && p > 0.9 && trends.map((t) => {
          const c = t.all ? textColor : pal[t.g % 4]
          const x1 = Math.max(...t.pts.map((q) => q.x))
          const lx = Math.min(X(x1) + 8, m.l + pw - size * 3.4)
          return (
            <text key={t.g} x={lx} y={Y(t.fit.slope * x1 + t.fit.icpt) - 10} fontSize={size * 0.82} fontWeight="700" fill={c} stroke={background} strokeWidth="4" paintOrder="stroke" strokeLinejoin="round" opacity={dimOf(t.g)} style={{ pointerEvents: 'none' }}>{`r ${t.fit.r.toFixed(2)}`}</text>
          )
        })}

        {/* selection */}
        {box && (
          <rect x={Math.min(box.x0, box.x1)} y={Math.min(box.y0, box.y1)} width={Math.abs(box.x1 - box.x0)} height={Math.abs(box.y1 - box.y0)} rx="6" fill={textColor} fillOpacity="0.06" stroke={textColor} strokeOpacity="0.55" strokeDasharray="5 4" style={{ pointerEvents: 'none' }} />
        )}
        {live && (
          <g style={{ pointerEvents: 'none' }}>
            <rect x={m.l + pw - size * 15.5} y={m.t + 4} width={size * 15.5} height={size * 2.1} rx={size} fill="#0c0d10ee" stroke={mutedColor} strokeOpacity="0.3" />
            <text x={m.l + pw - size * 0.8} y={m.t + 4 + size * 1.3} textAnchor="end" fontSize={size * 0.82} fill={textColor}>
              <tspan fontWeight="700">{live.n}</tspan>
              <tspan fill={mutedColor}>{` selected · mean ${fmtTickLabel(live.mx)}, ${fmtTickLabel(live.my)}`}</tspan>
            </text>
          </g>
        )}

        <rect x={m.l} y={m.t} width={pw} height={ph} fill="transparent" style={{ cursor: brush ? 'crosshair' : 'default' }} onMouseMove={onMove} onMouseDown={onDown} onMouseUp={onUp} />
      </svg>
    </Card>
  )
}
