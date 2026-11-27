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

// Bubble chart: a scatter plot where each dot's area carries a third number. In `axes`
// mode bubbles sit at (x, y); in `packed` mode there are no axes and bubbles are packed
// together by size, like a cluster of cells. Labels appear inside big bubbles, hovering
// lifts one, and a size key shows what the areas mean. Points are
// "Label:x|y|size|group", or leave `data` empty for the demo set.
export default function BubbleChart({
  data = '',
  count = 18,
  correlation = 0.5,
  groups = 3,
  noise = 1.1,
  seed = 8,
  names = 'North, Central, South',
  title = 'Market overview',
  subtitle = 'Position: price vs rating. Size: monthly sales',
  mode = 'axes',
  sizeBy = 'area',
  minR = 10,
  maxR = 38,
  colorBy = 'group',
  labels = 'auto',
  showSizeKey = true,
  showQuadrants = false,
  fillOpacity = 0.55,
  xLabel = 'Price index',
  yLabel = 'Rating',
  showGrid = true,
  showAxis = true,
  showLegend = true,
  tooltip = true,
  animate = true,
  duration = 1200,
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
  const id = useId().replace(/:/g, '')
  const wrap = useRef(null)
  const [boxRef, boxW] = useWidth()
  const pal = [color, color2, color3, color4]
  const pts = usePoints({ data, count, correlation, groups, seed, noise })
  const G = Math.max(1, ...pts.map((q) => q.g + 1))
  const nm = splitNames(names)
  const gName = (g) => nm[g] ?? (G > 1 ? `Group ${g + 1}` : 'All')
  const packed = mode === 'packed'
  const p = useReveal(animate, duration, `${data}|${count}|${correlation}|${groups}|${noise}|${seed}|${mode}|${sizeBy}|${minR}|${maxR}`)
  const [hov, setHov] = useState(-1)
  const [hovG, setHovG] = useState(null)
  const [tip, setTip] = useState(null)

  const sMin = Math.min(...pts.map((q) => q.size))
  const sMax = Math.max(...pts.map((q) => q.size))
  const t = (v) => (sMax === sMin ? 0.5 : (v - sMin) / (sMax - sMin))
  const radius = (v) => (sizeBy === 'radius' ? minR + (maxR - minR) * t(v) : Math.sqrt(minR * minR + (maxR * maxR - minR * minR) * t(v)))

  const W = Math.max(260, (boxW || width) - size * 2.8)
  const H = height
  const xs = pts.map((q) => q.x)
  const ys = pts.map((q) => q.y)
  const px0 = (Math.max(...xs) - Math.min(...xs)) * 0.06
  const py0 = (Math.max(...ys) - Math.min(...ys)) * 0.08
  const sx = niceRange(Math.min(...xs) - px0 - (maxR / W) * (Math.max(...xs) - Math.min(...xs)) * 0.6, Math.max(...xs) + px0 + (maxR / W) * (Math.max(...xs) - Math.min(...xs)) * 0.6, 6)
  const sy = niceRange(Math.min(...ys) - py0, Math.max(...ys) + py0, 5)
  const xt = ticksOf(sx)
  const yt = ticksOf(sy)
  const m = packed
    ? { l: 8, r: 8, t: 8, b: 8 }
    : { l: (showAxis ? Math.max(...yt.map((v) => fmtTickLabel(v).length)) * size * 0.58 + 14 : 8) + (yLabel ? size * 1.4 : 0), r: 14, t: 12, b: (showAxis ? size * 2.1 : 8) + (xLabel ? size * 1.5 : 0) }
  const pw = Math.max(60, W - m.l - m.r)
  const ph = Math.max(60, H - m.t - m.b)
  const X = (v) => m.l + ((v - sx.lo) / (sx.hi - sx.lo)) * pw
  const Y = (v) => m.t + ph - ((v - sy.lo) / (sy.hi - sy.lo)) * ph

  // packed layout: biggest first, each placed along a spiral until it clears the others
  const layout = useMemo(() => {
    if (!packed) return null
    const order = pts.map((_, i) => i).sort((a, b) => pts[b].size - pts[a].size)
    const placed = []
    const out = new Array(pts.length)
    for (const i of order) {
      const r = radius(pts[i].size)
      let a = 0
      let d = 0
      let pos = [0, 0]
      if (placed.length) {
        for (let k = 0; k < 4000; k++) {
          a += 0.5
          d = 1.5 + k * 0.045
          pos = [Math.cos(a) * d, Math.sin(a) * d * 0.75]
          if (placed.every((q) => Math.hypot(q.x - pos[0], q.y - pos[1]) >= q.r + r + 2)) break
        }
      }
      placed.push({ x: pos[0], y: pos[1], r })
      out[i] = { x: pos[0], y: pos[1], r }
    }
    const minX = Math.min(...out.map((o) => o.x - o.r))
    const maxX = Math.max(...out.map((o) => o.x + o.r))
    const minY = Math.min(...out.map((o) => o.y - o.r))
    const maxY = Math.max(...out.map((o) => o.y + o.r))
    return { out, minX, maxX, minY, maxY }
  }, [packed, pts, sizeBy, minR, maxR]) // eslint-disable-line react-hooks/exhaustive-deps
  const fit = layout ? Math.min((W - 16) / (layout.maxX - layout.minX), (H - 16) / (layout.maxY - layout.minY), 1.6) : 1
  const place = (i) => {
    if (!layout) return { x: X(pts[i].x), y: Y(pts[i].y), r: radius(pts[i].size) }
    const o = layout.out[i]
    return { x: W / 2 + (o.x - (layout.minX + layout.maxX) / 2) * fit, y: H / 2 + (o.y - (layout.minY + layout.maxY) / 2) * fit, r: o.r * fit }
  }
  const colorOf = (q) => (colorBy === 'value' ? mix(color2, color, t(q.size)) : pal[q.g % 4])
  const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length
  const order = pts.map((_, i) => i).sort((a, b) => pts[b].size - pts[a].size) // small on top
  const dimOf = (q, i) => (hovG !== null && hovG !== q.g ? 0.15 : 1) * (hov >= 0 && hov !== i ? 0.55 : 1)
  const sizeKey = [sMin, (sMin + sMax) / 2, sMax]

  const showTip = (e, i) => {
    setHov(i)
    if (!tooltip) return
    const q = pts[i]
    setTip(tipAt(e, wrap, q.label, [{ color: colorOf(q), label: 'Size', value: fmtTickLabel(q.size), strong: true }, ...(packed ? [] : [{ label: xLabel || 'x', value: fmtTickLabel(q.x) }, { label: yLabel || 'y', value: fmtTickLabel(q.y) }]), ...(G > 1 ? [{ label: 'Group', value: gName(q.g) }] : [])]))
  }

  return (
    <Card
      wrapRef={(el) => { wrap.current = el; boxRef.current = el }}
      {...{ width, background, color, textColor, mutedColor, size, title, subtitle, tip }}
      legend={showLegend && G > 1 && colorBy === 'group' ? <Legend items={Array.from({ length: G }, (_, g) => ({ label: gName(g), color: pal[g % 4] }))} onHover={setHovG} mutedColor={mutedColor} /> : null}
    >
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${title}. Bubble chart of ${pts.length} items. ${pts.slice(0, 12).map((q) => `${q.label}: size ${fmtTickLabel(q.size)}`).join('; ')}`}
        style={{ display: 'block', maxWidth: '100%', overflow: 'visible' }}
        onMouseLeave={() => { setHov(-1); setTip(null) }}
      >
        <defs>
          {pts.map((q, i) => {
            const c = colorOf(q)
            return (
              <radialGradient key={i} id={`${id}b${i}`} cx="35%" cy="30%" r="80%">
                <stop offset="0" stopColor={mix(c, '#ffffff', 0.35)} stopOpacity={Math.min(1, fillOpacity + 0.3)} />
                <stop offset="1" stopColor={c} stopOpacity={fillOpacity} />
              </radialGradient>
            )
          })}
        </defs>

        {!packed && (
          <>
            {yt.map((v, i) => (
              <g key={i}>
                {showGrid && <line x1={m.l} x2={m.l + pw} y1={Y(v)} y2={Y(v)} stroke={mutedColor} strokeOpacity="0.14" strokeDasharray="2 5" />}
                {showAxis && <text x={m.l - 9} y={Y(v)} dy="0.34em" textAnchor="end" fontSize={size * 0.85} fill={mutedColor}>{fmtTickLabel(v)}</text>}
              </g>
            ))}
            {xt.map((v, i) => (
              <g key={i}>
                {showGrid && <line x1={X(v)} x2={X(v)} y1={m.t} y2={m.t + ph} stroke={mutedColor} strokeOpacity="0.14" strokeDasharray="2 5" />}
                {showAxis && <text x={X(v)} y={m.t + ph + size * 1.4} textAnchor="middle" fontSize={size * 0.85} fill={mutedColor}>{fmtTickLabel(v)}</text>}
              </g>
            ))}
            <line x1={m.l} x2={m.l + pw} y1={m.t + ph} y2={m.t + ph} stroke={mutedColor} strokeOpacity="0.4" />
            <line x1={m.l} x2={m.l} y1={m.t} y2={m.t + ph} stroke={mutedColor} strokeOpacity="0.4" />
            {xLabel && <text x={m.l + pw / 2} y={H - 2} textAnchor="middle" fontSize={size * 0.9} fill={mutedColor} fontWeight="600">{xLabel}</text>}
            {yLabel && <text transform={`translate(${size * 0.9},${m.t + ph / 2}) rotate(-90)`} textAnchor="middle" fontSize={size * 0.9} fill={mutedColor} fontWeight="600">{yLabel}</text>}
            {showQuadrants && (
              <g style={{ pointerEvents: 'none' }} opacity={clamp((p - 0.5) * 2, 0, 1)}>
                <line x1={X(mean(xs))} x2={X(mean(xs))} y1={m.t} y2={m.t + ph} stroke={textColor} strokeOpacity="0.35" strokeDasharray="6 5" />
                <line x1={m.l} x2={m.l + pw} y1={Y(mean(ys))} y2={Y(mean(ys))} stroke={textColor} strokeOpacity="0.35" strokeDasharray="6 5" />
              </g>
            )}
          </>
        )}

        {order.map((i) => {
          const q = pts[i]
          const o = place(i)
          const ip = ease(clamp((p - (i / pts.length) * 0.45) / 0.55, 0, 1))
          const r = o.r * ip * (i === hov ? 1.08 : 1)
          const c = colorOf(q)
          const lab = q.label.length > 12 ? q.label.slice(0, 11) + '…' : q.label
          const inside = labels === 'all' ? r > size * 0.9 : labels === 'auto' ? r > Math.max(size * 1.7, lab.length * size * 0.3 + 6) : false
          return (
            <g key={i} opacity={dimOf(q, i)} style={{ transition: 'opacity .2s' }}>
              <circle cx={o.x} cy={o.y} r={r} fill={`url(#${id}b${i})`} stroke={c} strokeWidth={i === hov ? 2.2 : 1.4} style={{ filter: `drop-shadow(0 0 ${i === hov ? size * 0.9 : size * 0.4}px ${c}66)`, transition: 'stroke-width .15s' }} />
              {inside && (
                <text x={o.x} y={o.y} dy="0.34em" textAnchor="middle" fontSize={Math.min(size, r * 0.42)} fontWeight="650" fill="#fff" opacity={ip} style={{ pointerEvents: 'none', textShadow: '0 1px 2px #0008' }}>{lab}</text>
              )}
              <circle cx={o.x} cy={o.y} r={Math.max(r, 8)} fill="transparent" onMouseEnter={(e) => showTip(e, i)} onMouseMove={(e) => showTip(e, i)} />
            </g>
          )
        })}

        {showSizeKey && (
          <g transform={`translate(${W - 10},${(packed ? 8 : m.t) + 4})`} style={{ pointerEvents: 'none' }}>
            {sizeKey.map((v, k) => {
              const r = Math.max(4, radius(v) * (packed ? fit : 1) * 0.42)
              const dx = -(k * (maxR * 0.84 + 30))
              return (
                <g key={k} transform={`translate(${dx},0)`}>
                  <circle cx={-r} cy={r} r={r} fill={background} fillOpacity="0.7" stroke={mutedColor} strokeOpacity="0.8" />
                  <text x={-r} y={r * 2 + size * 0.95} textAnchor="middle" fontSize={size * 0.72} fill={mutedColor}>{fmtTickLabel(v)}</text>
                </g>
              )
            })}
          </g>
        )}
      </svg>
    </Card>
  )
}
