import { useEffect, useId, useMemo, useRef, useState } from 'react'

// ---- flat infographic helpers (kept inline so this file copies out on its own) ----
// Data is a plain string: rows are separated by commas, each row is "Label:value",
// e.g. "Jan:42, Feb:58". An array of { label, value } works too.

const FONT = '"Poppins", "Nunito", ui-rounded, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif'
const num = (v) => {
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : 0
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
// white or dark ink, whichever reads better on a filled colour
function inkOn(c, dark) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(String(c).slice(i, i + 2), 16) || 0)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.66 ? dark : '#ffffff'
}

// ---- relationship helpers ----
// Points are "Label:x|y|size|group" (size and group optional; group is 1 to 6), e.g.
// "Atlas:42|61|30|1, Boreal:55|48|12|2". Leave `data` empty for a seeded demo set.
function parseRows(data) {
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
const axisFmt = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })
const fmtTickLabel = (v) => (Math.abs(v) >= 1000 ? axisFmt.format(v) : String(+v.toFixed(Math.abs(v) < 10 ? 2 : Math.abs(v) < 100 ? 1 : 0)))
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
// ---- end relationship helpers ----

// Flat infographic scatter plot: chunky sticker dots with a white rim, thick trend lines
// with a flat "r" badge, arrowhead axes and a striped drag-to-select box that summarises
// what is inside. Dots pop in one after another; hovering finds the nearest dot.
// Paste points as "Label:x|y|size|group" or leave `data` empty for the demo set.
export default function FlatScatterPlot({
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
  pointSize = 6.5,
  pointOpacity = 0.92,
  zeroBased = false,
  brush = true,
  stripes = true,
  stripeWidth = 5,
  showGrid = true,
  showAxis = true,
  axisArrows = true,
  showLegend = true,
  tooltip = true,
  animate = true,
  duration = 1200,
  xSuffix = '',
  ySuffix = '',
  width = 680,
  height = 340,
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
  const svgRef = useRef(null)
  const [boxRef, boxW] = useWidth()
  const pal = [color, color2, color3, color4, color5, color6]
  const colOf = (g) => pal[g % pal.length]
  const pts = usePoints({ data, count, correlation, groups, seed, noise })
  const G = Math.max(1, ...pts.map((q) => q.g + 1))
  const nm = splitNames(names)
  const gName = (g) => nm[g] ?? (G > 1 ? `Group ${g + 1}` : 'All')
  const p = useReveal(animate, duration, `${data}|${count}|${correlation}|${groups}|${noise}|${seed}`)
  const [hov, setHov] = useState(-1)
  const [hovG, setHovG] = useState(-1)
  const [tip, setTip] = useState(null)
  const [drag, setDrag] = useState(null) // {x0,y0,x1,y1} in svg px
  const [sel, setSel] = useState(null)

  const xs = pts.length ? pts.map((q) => q.x) : [0, 1]
  const ys = pts.length ? pts.map((q) => q.y) : [0, 1]
  const padX = (Math.max(...xs) - Math.min(...xs)) * 0.05
  const padY = (Math.max(...ys) - Math.min(...ys)) * 0.06
  const sx = niceRange(zeroBased ? Math.min(0, ...xs) : Math.min(...xs) - padX, Math.max(...xs) + padX, 6)
  const sy = niceRange(zeroBased ? Math.min(0, ...ys) : Math.min(...ys) - padY, Math.max(...ys) + padY, 5)
  const xt = ticksOf(sx)
  const yt = ticksOf(sy)

  const W = Math.max(260, (boxW || width) - size * 3)
  const H = height
  const m = {
    l: (showAxis ? Math.max(...yt.map((t) => (fmtTickLabel(t) + ySuffix).length)) * size * 0.56 + 14 : 8) + (yLabel ? size * 1.5 : 0),
    r: showAxis && axisArrows ? size * 1.4 : 10,
    t: showAxis && axisArrows ? size * 1.3 : 8,
    b: (showAxis ? size * 2.1 : 8) + (xLabel ? size * 1.5 : 0),
  }
  const pw = Math.max(60, W - m.l - m.r)
  const ph = Math.max(60, H - m.t - m.b)
  const X = (v) => m.l + ((v - sx.lo) / (sx.hi - sx.lo)) * pw
  const Y = (v) => m.t + ph - ((v - sy.lo) / (sy.hi - sy.lo)) * ph
  const px = pts.map((q) => [X(q.x), Y(q.y)])

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
    let bd = Math.max(20, pointSize * 2.5) ** 2
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
    const c = colOf(q.g)
    setTip(tipAt(e, wrap, q.label, [{ color: c, label: xLabel || 'x', value: fmtTickLabel(q.x) + xSuffix }, { color: c, label: yLabel || 'y', value: fmtTickLabel(q.y) + ySuffix }, ...(G > 1 ? [{ label: 'Group', value: gName(q.g) }] : [])]))
  }
  const onDown = (e) => {
    if (!brush) return
    const [x, y] = local(e)
    setSel(null)
    setTip(null)
    setHov(-1)
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
  const dimOf = (g) => (hovG >= 0 && hovG !== g ? 0.4 : 1)
  const trendCol = (t) => (t.all ? textColor : mix(colOf(t.g), textColor, 0.3))
  const tp = ease(clamp((p - 0.4) / 0.6, 0, 1))
  const ptK = (i) => pop(clamp((p - (pts.length > 1 ? i / (pts.length - 1) : 0) * 0.5) / 0.5, 0, 1))
  const ps = Math.max(1, pointSize)
  const rimW = Math.max(1.2, ps * 0.26)

  // r badges sit at the right end of each trend line, nudged apart so they never overlap
  const badges = useMemo(() => {
    if (!showR) return []
    const fs = size * 0.82
    const bh = fs * 1.75
    const out = trends
      .map((t) => {
        const x1 = Math.max(...t.pts.map((q) => q.x))
        const txt = `r ${t.fit.r.toFixed(2)}`
        const bw = txt.length * fs * 0.62 + fs * 1.2
        const x = clamp(X(x1) - bw / 2, m.l + 4, m.l + pw - bw - 2)
        const y = clamp(Y(t.fit.slope * x1 + t.fit.icpt) - bh - 10, m.t + 2, m.t + ph - bh - 2)
        return { t, txt, x, y, bw, bh, fs }
      })
      .sort((a, b) => a.y - b.y)
    for (let i = 1; i < out.length; i++) {
      const a = out[i - 1]
      const b = out[i]
      if (b.y < a.y + a.bh + 4 && b.x < a.x + a.bw && a.x < b.x + b.bw) b.y = a.y + a.bh + 4
    }
    return out
  }, [showR, trends, size, W, H, sx.lo, sx.hi, sy.lo, sy.hi]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Card wrapRef={(el) => { wrap.current = el; boxRef.current = el }} {...{ width, background, textColor, mutedColor, size, title, subtitle, tip }}>
      {showLegend && G > 1 && <Legend items={Array.from({ length: G }, (_, g) => ({ name: gName(g), color: colOf(g) }))} mutedColor={mutedColor} onHover={setHovG} />}
      <svg
        ref={svgRef}
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${title}. Scatter plot of ${pts.length} points${G > 1 ? ` in ${G} groups` : ''}${trends.length ? `. Correlation ${trends.map((t) => `${t.all ? 'overall' : gName(t.g)} r ${t.fit.r.toFixed(2)}`).join(', ')}` : ''}.`}
        style={{ display: 'block', maxWidth: '100%', overflow: 'visible', touchAction: 'none', userSelect: 'none' }}
        onMouseLeave={() => { setHov(-1); setTip(null); setDrag(null) }}
      >
        <defs>
          <pattern id={`st${uid}`} width={stripeWidth * 2} height={stripeWidth * 2} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width={stripeWidth} height={stripeWidth * 2} fill={mutedColor} opacity="0.22" />
          </pattern>
          <marker id={`ar${uid}`} viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,1 L9,5 L0,9 Z" fill={mutedColor} />
          </marker>
        </defs>

        {yt.map((t, i) => (
          <g key={`y${i}`}>
            {showGrid && t !== sy.lo && <line x1={m.l} x2={m.l + pw} y1={Y(t)} y2={Y(t)} stroke={gridColor} strokeWidth="2" strokeDasharray="5 7" strokeLinecap="round" />}
            {showAxis && <text x={m.l - 10} y={Y(t)} dy="0.35em" textAnchor="end" fontSize={size * 0.82} fill={mutedColor} style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtTickLabel(t) + ySuffix}</text>}
          </g>
        ))}
        {xt.map((t, i) => (
          <g key={`x${i}`}>
            {showGrid && t !== sx.lo && <line x1={X(t)} x2={X(t)} y1={m.t} y2={m.t + ph} stroke={gridColor} strokeWidth="2" strokeDasharray="5 7" strokeLinecap="round" />}
            {showAxis && <text x={X(t)} y={m.t + ph + size * 1.5} textAnchor="middle" fontSize={size * 0.82} fill={mutedColor} style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtTickLabel(t) + xSuffix}</text>}
          </g>
        ))}
        {xLabel && <text x={m.l + pw / 2} y={H - 2} textAnchor="middle" fontSize={size * 0.9} fill={mutedColor} fontWeight="600">{xLabel}</text>}
        {yLabel && <text transform={`translate(${size * 0.9},${m.t + ph / 2}) rotate(-90)`} textAnchor="middle" fontSize={size * 0.9} fill={mutedColor} fontWeight="600">{yLabel}</text>}

        {/* selection box: a striped flat panel behind the dots */}
        {box && (
          <g style={{ pointerEvents: 'none' }}>
            <rect x={Math.min(box.x0, box.x1)} y={Math.min(box.y0, box.y1)} width={Math.abs(box.x1 - box.x0)} height={Math.abs(box.y1 - box.y0)} rx="10" fill={gridColor} />
            {stripes && <rect x={Math.min(box.x0, box.x1)} y={Math.min(box.y0, box.y1)} width={Math.abs(box.x1 - box.x0)} height={Math.abs(box.y1 - box.y0)} rx="10" fill={`url(#st${uid})`} />}
            <rect x={Math.min(box.x0, box.x1)} y={Math.min(box.y0, box.y1)} width={Math.abs(box.x1 - box.x0)} height={Math.abs(box.y1 - box.y0)} rx="10" fill="none" stroke={mutedColor} strokeWidth="2" strokeDasharray="6 5" />
          </g>
        )}

        {/* points */}
        {pts.map((q, i) => {
          const k = ptK(i)
          if (k <= 0) return null
          const dim = dimOf(q.g) * (isIn(i) ? 1 : 0.25) * (hov >= 0 && hov !== i ? 0.4 : 1)
          return <circle key={i} cx={px[i][0]} cy={px[i][1]} r={Math.max(0, ps * k)} fill={colOf(q.g)} fillOpacity={pointOpacity} stroke={background} strokeWidth={rimW} opacity={dim} style={{ transition: 'opacity .2s', pointerEvents: 'none' }} />
        })}

        {/* trend lines: a background-coloured outline keeps them readable over the dots */}
        {trends.map((t) => {
          const x0 = Math.min(...t.pts.map((q) => q.x))
          const x1 = Math.max(...t.pts.map((q) => q.x))
          const xe = x0 + (x1 - x0) * tp
          const yv = (x) => t.fit.slope * x + t.fit.icpt
          if (tp <= 0) return null
          return (
            <g key={`t${t.g}`} opacity={dimOf(t.g) * (hov >= 0 ? 0.4 : 1)} style={{ pointerEvents: 'none', transition: 'opacity .2s' }} strokeLinecap="round">
              <line x1={X(x0)} y1={Y(yv(x0))} x2={X(xe)} y2={Y(yv(xe))} stroke={background} strokeWidth={9} />
              <line x1={X(x0)} y1={Y(yv(x0))} x2={X(xe)} y2={Y(yv(xe))} stroke={trendCol(t)} strokeWidth={4.5} />
            </g>
          )
        })}

        {/* correlation badges */}
        {badges.map((b) => {
          const k = pop(clamp((p - 0.85) / 0.15, 0, 1))
          if (k <= 0) return null
          const c = trendCol(b.t)
          const cx = b.x + b.bw / 2
          const cy = b.y + b.bh / 2
          return (
            <g key={`b${b.t.g}`} transform={`translate(${cx} ${cy}) scale(${k}) translate(${-cx} ${-cy})`} opacity={dimOf(b.t.g)} style={{ pointerEvents: 'none', transition: 'opacity .2s' }}>
              <rect x={b.x} y={b.y} width={b.bw} height={b.bh} rx={b.bh / 2} fill={c} stroke={background} strokeWidth="2" />
              <text x={cx} y={cy} dy="0.35em" textAnchor="middle" fontSize={b.fs} fontWeight="700" fill={inkOn(c, textColor)} style={{ fontVariantNumeric: 'tabular-nums' }}>{b.txt}</text>
            </g>
          )
        })}

        {/* the hovered dot, lifted on top with a halo */}
        {hov >= 0 && pts[hov] && (
          <g style={{ pointerEvents: 'none' }}>
            <circle cx={px[hov][0]} cy={px[hov][1]} r={ps * 2.4} fill={colOf(pts[hov].g)} opacity="0.2" />
            <circle cx={px[hov][0]} cy={px[hov][1]} r={ps * 1.5} fill={colOf(pts[hov].g)} stroke={background} strokeWidth={rimW * 1.4} />
          </g>
        )}

        {showAxis && (
          <g stroke={mutedColor} strokeWidth="2" strokeLinecap="round" fill="none" style={{ pointerEvents: 'none' }}>
            <path d={`M${m.l},${m.t + ph}H${m.l + pw + (axisArrows ? m.r * 0.6 : 0)}`} markerEnd={axisArrows ? `url(#ar${uid})` : undefined} />
            <path d={`M${m.l},${m.t + ph}V${m.t - (axisArrows ? m.t * 0.6 : 0)}`} markerEnd={axisArrows ? `url(#ar${uid})` : undefined} />
          </g>
        )}

        {/* selection summary pill */}
        {live && (
          <g style={{ pointerEvents: 'none' }}>
            {(() => {
              const fs = size * 0.82
              const txt = ` selected · mean ${fmtTickLabel(live.mx)}${xSuffix}, ${fmtTickLabel(live.my)}${ySuffix}`
              const bw = (String(live.n).length + txt.length) * fs * 0.58 + fs * 2
              const bh = fs * 2
              const x = m.l + pw - bw - 4
              const y = m.t + 4
              return (
                <>
                  <rect x={x} y={y} width={bw} height={bh} rx={bh / 2} fill={textColor} />
                  <text x={x + bw / 2} y={y + bh / 2} dy="0.35em" textAnchor="middle" fontSize={fs} fill={background} style={{ fontVariantNumeric: 'tabular-nums' }}>
                    <tspan fontWeight="700">{live.n}</tspan>
                    <tspan opacity="0.75">{txt}</tspan>
                  </text>
                </>
              )
            })()}
          </g>
        )}

        <rect x={m.l} y={m.t} width={pw} height={ph} fill="transparent" style={{ cursor: brush ? 'crosshair' : 'default' }} onMouseMove={onMove} onMouseDown={onDown} onMouseUp={onUp} onDoubleClick={() => setSel(null)} />
      </svg>
    </Card>
  )
}
