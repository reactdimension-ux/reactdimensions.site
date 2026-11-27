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

// ---- sketch kit: hand-drawn lines, fills and paper (kept inline so the file copies out alone) ----
const HAND = '"Caveat", "Patrick Hand", "Comic Neue", "Segoe Print", "Bradley Hand", "Comic Sans MS", cursive'
const MARKERS = ['#e4572e', '#2e86ab', '#3bb273', '#f2a541', '#9b5de5', '#f15bb5']

// small seeded random: the same seed always draws the same wobble
function srng(seed) {
  let s = (Math.floor(seed * 2654435761) >>> 0) || 1
  return () => {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    return ((s >>> 0) % 100000) / 100000
  }
}
const f1 = (v) => v.toFixed(1)
// one wobbly pen stroke from (x1, y1) to (x2, y2): over-shot ends, a bowed middle
function wob(r, x1, y1, x2, y2, rough, bow) {
  const len = Math.hypot(x2 - x1, y2 - y1) || 1
  const j = (k) => (r() - 0.5) * rough * k
  const ux = (x2 - x1) / len
  const uy = (y2 - y1) / len
  const over = Math.min(len * 0.03, 3) * rough
  const b = (r() - 0.5) * bow * Math.min(len * 0.04, 5) * rough
  const m1 = 0.28 + r() * 0.12
  const m2 = 0.62 + r() * 0.12
  const ax = x1 - ux * over * r() + j(1.6)
  const ay = y1 - uy * over * r() + j(1.6)
  const bx = x2 + ux * over * r() + j(1.6)
  const by = y2 + uy * over * r() + j(1.6)
  return `M${f1(ax)},${f1(ay)}C${f1(x1 + (x2 - x1) * m1 - uy * b + j(1.2))},${f1(y1 + (y2 - y1) * m1 + ux * b + j(1.2))} ${f1(x1 + (x2 - x1) * m2 - uy * b + j(1.2))},${f1(y1 + (y2 - y1) * m2 + ux * b + j(1.2))} ${f1(bx)},${f1(by)}`
}
function sketchLine(seed, x1, y1, x2, y2, o) {
  const r = srng(seed)
  return wob(r, x1, y1, x2, y2, o.roughness, o.bowing) + (o.doubleStroke ? wob(r, x1, y1, x2, y2, o.roughness * 0.8, o.bowing) : '')
}
// a polygon (closed) or polyline drawn as separate wobbly strokes
function sketchPoly(seed, pts, o, closed = true) {
  const r = srng(seed)
  let d = ''
  const n = closed ? pts.length : pts.length - 1
  for (let pass = 0; pass < (o.doubleStroke ? 2 : 1); pass++)
    for (let i = 0; i < n; i++) {
      const a = pts[i]
      const b = pts[(i + 1) % pts.length]
      d += wob(r, a[0], a[1], b[0], b[1], o.roughness * (pass ? 0.8 : 1), o.bowing)
    }
  return d
}
const sketchRect = (seed, x, y, w, h, o) => sketchPoly(seed, [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], o)
// a smooth curve through points, traced twice with a little jitter each time
function sketchCurve(seed, pts, o) {
  const r = srng(seed)
  let d = ''
  for (let pass = 0; pass < (o.doubleStroke ? 2 : 1); pass++) {
    const P = pts.map(([x, y]) => [x + (r() - 0.5) * o.roughness * 1.6, y + (r() - 0.5) * o.roughness * 1.6])
    if (P.length < 2) continue
    d += `M${f1(P[0][0])},${f1(P[0][1])}`
    for (let i = 0; i < P.length - 1; i++) {
      const p0 = P[i - 1] ?? P[i]
      const p1 = P[i]
      const p2 = P[i + 1]
      const p3 = P[i + 2] ?? p2
      d += `C${f1(p1[0] + (p2[0] - p0[0]) / 6)},${f1(p1[1] + (p2[1] - p0[1]) / 6)} ${f1(p2[0] - (p3[0] - p1[0]) / 6)},${f1(p2[1] - (p3[1] - p1[1]) / 6)} ${f1(p2[0])},${f1(p2[1])}`
    }
  }
  return d
}
// a loose pen loop that goes round a little more than once
function sketchEllipse(seed, cx, cy, rx, ry, o) {
  const r = srng(seed)
  const pts = []
  const a0 = r() * Math.PI * 2
  const turns = o.doubleStroke ? 1.9 : 1.08
  const steps = Math.ceil(22 * turns)
  for (let i = 0; i <= steps; i++) {
    const a = a0 + (i / steps) * Math.PI * 2 * turns
    const k = 1 + (r() - 0.5) * 0.05 * o.roughness + (i / steps) * 0.04 * o.roughness
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k])
  }
  return sketchCurve(seed + 1, pts, { ...o, doubleStroke: false, roughness: o.roughness * 0.4 })
}
// pen strokes that fill a box; drawn inside a clipPath of the real shape
function hatchD(seed, box, o, angle, gap) {
  const r = srng(seed)
  const { x, y, w, h } = box
  const cx = x + w / 2
  const cy = y + h / 2
  const L = Math.hypot(w, h) / 2 + gap
  const a = (angle * Math.PI) / 180
  const dx = Math.cos(a)
  const dy = Math.sin(a)
  let d = ''
  let k = 0
  for (let t = -L; t <= L; t += gap) {
    const px = cx - dy * t
    const py = cy + dx * t
    const x1 = px - dx * L
    const y1 = py - dy * L
    const x2 = px + dx * L
    const y2 = py + dy * L
    if (o.fillStyle === 'zigzag' && k % 2) d += `L${f1(x1 + (r() - 0.5) * 2)},${f1(y1)}L${f1(x2)},${f1(y2)}`
    else if (o.fillStyle === 'zigzag') d += `${d ? 'L' : 'M'}${f1(x2)},${f1(y2)}L${f1(x1)},${f1(y1)}`
    else d += wob(r, x1, y1, x2, y2, o.roughness * 0.6, 0.3)
    k++
  }
  return d
}
function dotsD(seed, box, gap) {
  const r = srng(seed)
  let d = ''
  for (let y = box.y + gap / 2; y < box.y + box.h; y += gap)
    for (let x = box.x + gap / 2; x < box.x + box.w; x += gap) {
      const px = x + (r() - 0.5) * gap * 0.4
      const py = y + (r() - 0.5) * gap * 0.4
      const rr = gap * 0.16
      d += `M${f1(px - rr)},${f1(py)}a${f1(rr)},${f1(rr)} 0 1 0 ${f1(rr * 2)},0a${f1(rr)},${f1(rr)} 0 1 0 ${f1(-rr * 2)},0`
    }
  return d
}
// a filled shape: `clip` is the exact outline path, `box` its bounds
function SketchFill({ id, clip, box, color, o, seed, angle, prog = 1, opacity = 0.9 }) {
  const style = o.fillStyle
  const gap = Math.max(2.5, o.hachureGap)
  const draw = { pathLength: 1, strokeDasharray: 1, strokeDashoffset: 1 - prog }
  return (
    <g>
      <clipPath id={id}>
        <path d={clip} />
      </clipPath>
      <g clipPath={`url(#${id})`}>
        {style === 'solid' ? (
          <path d={clip} fill={color} fillOpacity={0.82 * prog} />
        ) : style === 'dots' ? (
          <path d={dotsD(seed, box, gap * 1.4)} fill={color} opacity={prog * opacity} />
        ) : (
          <>
            <path d={hatchD(seed, box, o, angle ?? o.hachureAngle, gap)} fill="none" stroke={color} strokeWidth={o.strokeWidth * 0.85} strokeLinecap="round" opacity={opacity} {...draw} />
            {style === 'cross-hatch' && <path d={hatchD(seed + 9, box, o, (angle ?? o.hachureAngle) + 90, gap * 1.15)} fill="none" stroke={color} strokeWidth={o.strokeWidth * 0.7} strokeLinecap="round" opacity={opacity * 0.85} {...draw} />}
          </>
        )}
      </g>
    </g>
  )
}
// a few redraws a second for the "boiling ink" look; off with reduced motion
function useBoil(on, fps = 6) {
  const [t, setT] = useState(0)
  useEffect(() => {
    if (!on || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return setT(0)
    const id = setInterval(() => setT((v) => (v + 1) % 1000), 1000 / fps)
    return () => clearInterval(id)
  }, [on, fps])
  return t
}
// a five-point star doodle
const starPts = (cx, cy, r) => Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + (i * Math.PI) / 5; const rr = i % 2 ? r * 0.45 : r; return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr] })
// a hand-drawn arrow from a to b with a curved shaft and a two-stroke head
function arrowD(seed, x1, y1, x2, y2, o, bend = 0.25) {
  const mx = (x1 + x2) / 2 - (y2 - y1) * bend
  const my = (y1 + y2) / 2 + (x2 - x1) * bend
  const shaft = sketchCurve(seed, [[x1, y1], [mx, my], [x2, y2]], { ...o, doubleStroke: false })
  const a = Math.atan2(y2 - my, x2 - mx)
  const h = 8
  const r = srng(seed + 3)
  return shaft + wob(r, x2, y2, x2 - Math.cos(a - 0.5) * h, y2 - Math.sin(a - 0.5) * h, o.roughness * 0.5, 0.2) + wob(r, x2, y2, x2 - Math.cos(a + 0.5) * h, y2 - Math.sin(a + 0.5) * h, o.roughness * 0.5, 0.2)
}

// the paper card everything sits on, with a handwritten title and a sticky-note tooltip
function Paper({ wrapRef, width, paper, paperColor, inkColor, mutedInk, size, font, tilt, title, subtitle, legend, tip, children, accent }) {
  const line = `${inkColor}14`
  const bg =
    paper === 'grid'
      ? `linear-gradient(${line} 1px, transparent 1px) 0 0 / 22px 22px, linear-gradient(90deg, ${line} 1px, transparent 1px) 0 0 / 22px 22px`
      : paper === 'lined'
        ? `linear-gradient(${line} 1px, transparent 1px) 0 0 / 100% 26px`
        : paper === 'dots'
          ? `radial-gradient(${inkColor}26 1.2px, transparent 1.4px) 0 0 / 18px 18px`
          : 'none'
  return (
    <div
      ref={wrapRef}
      style={{
        position: 'relative',
        width: `min(${width}px, 100%)`,
        boxSizing: 'border-box',
        padding: '1.2em 1.4em 1.1em',
        borderRadius: 6,
        color: inkColor,
        fontFamily: font,
        fontSize: size,
        lineHeight: 1.25,
        background: `${bg}, ${paperColor}`,
        boxShadow: '0 1px 0 #0000000d, 0 18px 40px -18px #00000059, 0 3px 8px -4px #0000002e',
        transform: `rotate(${tilt}deg)`,
      }}
    >
      {(title || subtitle || legend) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5em 1.2em', flexWrap: 'wrap', marginBottom: '0.7em' }}>
          <div style={{ minWidth: 0 }}>
            {title && (
              <div style={{ position: 'relative', display: 'inline-block', fontSize: '1.75em', fontWeight: 700, lineHeight: 1.05 }}>
                <span style={{ position: 'absolute', left: '-0.15em', right: '-0.2em', bottom: '0.05em', height: '0.42em', background: `${accent}38`, transform: 'skew(-12deg) rotate(-1deg)', borderRadius: 3 }} />
                <span style={{ position: 'relative' }}>{title}</span>
              </div>
            )}
            {subtitle && <div style={{ color: mutedInk, fontSize: '1.08em', marginTop: '0.15em' }}>{subtitle}</div>}
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
            transform: 'translate(-50%, -100%) rotate(-2deg)',
            pointerEvents: 'none',
            minWidth: '7.5em',
            padding: '0.9em 0.9em 0.6em',
            background: '#fff3a8',
            color: '#2b2b2b',
            boxShadow: '2px 6px 12px -4px #0000004d',
            fontSize: '1.05em',
            whiteSpace: 'nowrap',
            zIndex: 5,
          }}
        >
          <span style={{ position: 'absolute', top: -7, left: '50%', width: 46, height: 14, transform: 'translateX(-50%) rotate(3deg)', background: '#ffffff99', boxShadow: '0 0 0 1px #0000000d' }} />
          <div style={{ fontWeight: 700, fontSize: '1.1em', marginBottom: '0.15em' }}>{tip.title}</div>
          {tip.rows?.map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.45em' }}>
              {r.color && <i style={{ width: '0.65em', height: '0.65em', borderRadius: '50%', background: r.color, flex: 'none' }} />}
              <span style={{ flex: 1 }}>{r.label}</span>
              <b style={{ marginLeft: '0.8em' }}>{r.value}</b>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
// legend: little hatched swatches with handwritten names
function DoodleLegend({ items, onHover, o, inkColor, seed }) {
  return (
    <div role="list" style={{ display: 'flex', gap: '0.2em 1em', flexWrap: 'wrap', fontSize: '1.1em', paddingTop: '0.3em' }}>
      {items.map((it, i) => (
        <span key={i} role="listitem" onMouseEnter={() => onHover?.(i)} onMouseLeave={() => onHover?.(null)} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35em' }}>
          <svg width="18" height="14" viewBox="0 0 18 14" aria-hidden style={{ overflow: 'visible' }}>
            <SketchFill id={`lg${seed}-${i}`} clip="M2,2H16V12H2Z" box={{ x: 0, y: 0, w: 18, h: 14 }} color={it.color} o={{ ...o, fillStyle: o.fillStyle === 'dots' ? 'hachure' : o.fillStyle, hachureGap: 3.2 }} seed={seed + i * 11} angle={-41 + i * 35} />
            <path d={sketchRect(seed + i, 2, 2, 14, 10, { ...o, roughness: o.roughness * 0.6 })} fill="none" stroke={inkColor} strokeWidth="1.2" />
          </svg>
          {it.label}
        </span>
      ))}
    </div>
  )
}
// ---- end sketch kit ----

// Doodle candlestick chart: open, high, low and close drawn by hand. Up candles are pen
// boxes with hatching, down candles are coloured in solid with marker, wicks are single
// pen strokes and moving averages run through as highlighter lines. A volume strip, a
// last-price tag, scroll to zoom and drag to pan. Rows are "Date:open|high|low|close|volume",
// or leave `data` empty for a demo.
export default function DoodleCandlestickChart({
  data = '',
  candles = 90,
  seed = 14,
  volatility = 1,
  drift = 0.15,
  title = 'ACME Corp',
  subtitle = 'Daily, last 90 sessions. Scroll to zoom, drag to pan',
  style = 'candles',
  hollowUp = false,
  showVolume = true,
  maPeriod = 20,
  ma2Period = 50,
  showLastPrice = true,
  showGrid = true,
  crosshair = true,
  zoomable = true,
  tooltip = true,
  roughness = 1.2,
  bowing = 1,
  fillStyle = 'hachure',
  hachureGap = 6,
  hachureAngle = -41,
  strokeWidth = 1.8,
  doubleStroke = true,
  boil = false,
  drawOn = true,
  duration = 2000,
  decimals = 2,
  prefix = '$',
  paper = 'grid',
  tilt = 0.3,
  width = 720,
  height = 310,
  size = 15,
  font = HAND,
  upColor = '#3bb273',
  downColor = '#e4572e',
  maColor = '#f2a541',
  ma2Color = '#2e86ab',
  color = '#9b5de5',
  paperColor = '#fbf8f1',
  inkColor = '#2b2b2b',
  mutedInk = '#77736b',
}) {
  const uid = useId().replace(/:/g, '')
  const wrap = useRef(null)
  const svgRef = useRef(null)
  const [boxRef, boxW] = useWidth()
  const t = useBoil(boil)
  const sd = seed * 61 + t * 13
  const o = { roughness, bowing, fillStyle, hachureGap, hachureAngle, strokeWidth, doubleStroke }
  const fmt = makeFmt({ decimals, prefix })

  const raw = useMemo(() => {
    if (String(data ?? '').trim()) return parseRows(data).map((r) => ({ d: r.label, o: r.values[0] ?? 0, h: r.values[1] ?? 0, l: r.values[2] ?? 0, c: r.values[3] ?? 0, v: r.values[4] ?? 0 }))
    const r = rng(Math.round(seed) * 59 + 3)
    let price = 120
    const day = new Date(2026, 0, 2)
    return Array.from({ length: clamp(Math.round(candles), 10, 400) }, () => {
      while (day.getDay() === 0 || day.getDay() === 6) day.setDate(day.getDate() + 1)
      const op = price
      const ch = gauss(r) * 0.016 * volatility + drift * 0.002
      const c = Math.max(1, op * (1 + ch))
      const h = Math.max(op, c) * (1 + Math.abs(gauss(r)) * 0.007 * volatility)
      const l = Math.min(op, c) * (1 - Math.abs(gauss(r)) * 0.007 * volatility)
      const label = `${MONTHS[day.getMonth()]} ${day.getDate()}`
      day.setDate(day.getDate() + 1)
      price = c
      return { d: label, o: op, h, l, c, v: Math.round(1e6 * (0.5 + r() * 0.8 + Math.abs(ch) * 40)) }
    })
  }, [data, candles, seed, volatility, drift])

  const rows = useMemo(() => {
    if (style !== 'heikin-ashi') return raw
    const out = []
    raw.forEach((k, i) => {
      const c = (k.o + k.h + k.l + k.c) / 4
      const op = i ? (out[i - 1].o + out[i - 1].c) / 2 : (k.o + k.c) / 2
      out.push({ ...k, o: op, c, h: Math.max(k.h, op, c), l: Math.min(k.l, op, c) })
    })
    return out
  }, [raw, style])
  const ma = (per) => (per > 1 ? rows.map((_, i) => (i + 1 >= per ? rows.slice(i + 1 - per, i + 1).reduce((a, k) => a + k.c, 0) / per : null)) : null)
  const ma1 = useMemo(() => ma(Math.round(maPeriod)), [rows, maPeriod]) // eslint-disable-line react-hooks/exhaustive-deps
  const ma2 = useMemo(() => ma(Math.round(ma2Period)), [rows, ma2Period]) // eslint-disable-line react-hooks/exhaustive-deps

  const N = rows.length
  const [view, setView] = useState([0, N])
  useEffect(() => setView([0, N]), [N])
  const [a, b] = [clamp(view[0], 0, N - 5), clamp(view[1], 5, N)]
  const vis = rows.slice(a, b)
  const p = useReveal(drawOn, duration, `${data}|${candles}|${seed}|${style}`)
  const [hi, setHi] = useState(null) // { i, y }
  const [tip, setTip] = useState(null)
  const dragRef = useRef(null)

  const W = Math.max(280, (boxW || width) - size * 2.8)
  const H = height
  const m = { l: 6, r: size * 4.4, t: 8, b: size * 1.8 }
  const pw = Math.max(80, W - m.l - m.r)
  const ph = Math.max(80, H - m.t - m.b)
  const priceH = showVolume ? ph * 0.78 : ph
  const volTop = m.t + priceH + 6
  const volH = ph - priceH - 6
  const maVis = [ma1, ma2].flatMap((m_) => (m_ ? m_.slice(a, b).filter((x) => x != null) : []))
  const lo0 = Math.min(...vis.map((k) => k.l), ...maVis)
  const hi0 = Math.max(...vis.map((k) => k.h), ...maVis)
  const sy = niceRange(lo0 - (hi0 - lo0) * 0.04, hi0 + (hi0 - lo0) * 0.04, 5)
  const yt = ticksOf(sy).filter((v) => v >= sy.lo && v <= sy.hi)
  const step = pw / vis.length
  const X = (i) => m.l + (i - a + 0.5) * step
  const Y = (v) => m.t + priceH - ((v - sy.lo) / (sy.hi - sy.lo)) * priceH
  const vMax = Math.max(1, ...vis.map((k) => k.v))
  const every = labelStep(vis.map((k) => k.d), step, size * 0.8)
  const bodyW = Math.max(1.5, step * 0.62)
  // thin candles get calmer pen strokes so they stay readable
  const tiny = { ...o, roughness: roughness * clamp(bodyW / 14, 0.2, 1), bowing: bowing * 0.3, doubleStroke: doubleStroke && bodyW > 6 }
  const axisP = ease(clamp(p / 0.2, 0, 1))
  const draw = (k) => ({ pathLength: 1, strokeDasharray: 1, strokeDashoffset: 1 - k })

  useEffect(() => {
    const el = svgRef.current
    if (!el || !zoomable) return
    const onWheel = (e) => {
      e.preventDefault()
      const r = el.getBoundingClientRect()
      setView(([va, vb]) => {
        const len = vb - va
        const f = (e.clientX - r.left - m.l) / pw
        const nl = clamp(Math.round(len * (e.deltaY > 0 ? 1.15 : 0.87)), 10, N)
        const center = va + f * len
        let na = Math.round(center - f * nl)
        na = clamp(na, 0, N - nl)
        return [na, na + nl]
      })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoomable, N, pw, m.l])

  const local = (e) => {
    const r = svgRef.current.getBoundingClientRect()
    return [e.clientX - r.left, e.clientY - r.top]
  }
  const onMove = (e) => {
    const [mx, my] = local(e)
    if (dragRef.current) {
      const dx = Math.round((dragRef.current.x - mx) / step)
      const [va, vb] = dragRef.current.view
      const len = vb - va
      const na = clamp(va + dx, 0, N - len)
      setView([na, na + len])
      return
    }
    const i = clamp(a + Math.floor((mx - m.l) / step), a, b - 1)
    setHi({ i, y: my })
    const k = rows[i]
    const prev = rows[i - 1]
    const ch = prev ? (k.c - prev.c) / prev.c : 0
    if (tooltip) setTip(tipAt(e, wrap, k.d, [
      { label: 'open', value: fmt(k.o) },
      { label: 'high', value: fmt(k.h) },
      { label: 'low', value: fmt(k.l) },
      { label: 'close', value: fmt(k.c), color: k.c >= k.o ? upColor : downColor },
      { label: 'change', value: `${ch >= 0 ? '+' : ''}${(ch * 100).toFixed(2)}%` },
      ...(showVolume ? [{ label: 'volume', value: axisFmt.format(k.v) }] : []),
    ]))
  }
  const last = rows[N - 1]
  const maPts = (arr) => {
    const P = []
    for (let i = a; i < b; i++) if (arr[i] != null) P.push([X(i), Y(arr[i])])
    return P
  }
  const priceY = hi ? clamp(hi.y, m.t, m.t + priceH) : null
  const priceAt = priceY != null ? sy.lo + ((m.t + priceH - priceY) / priceH) * (sy.hi - sy.lo) : null
  const lastUp = last.c >= last.o
  const totalUp = last.c >= rows[0].o
  const maP = ease(clamp((p - 0.55) / 0.4, 0, 1))
  // a handwritten tag on the price axis
  const tag = (y, txt, c, k) => (
    <g>
      <path d={`M${m.l + pw + 3},${y - size * 0.7}h${m.r - 4}v${size * 1.4}h${-(m.r - 4)}Z`} fill={paperColor} />
      <path d={sketchRect(sd + k, m.l + pw + 3, y - size * 0.7, m.r - 4, size * 1.4, { ...o, roughness: roughness * 0.5, doubleStroke: false })} fill="none" stroke={c} strokeWidth={strokeWidth * 0.8} />
      <text x={m.l + pw + 7} y={y} dy="0.34em" fontSize={size * 0.88} fontWeight="700" fill={c}>{txt}</text>
    </g>
  )

  return (
    <Paper
      wrapRef={(el) => { wrap.current = el; boxRef.current = el }}
      {...{ width, paper, paperColor, inkColor, mutedInk, size, font, tilt, title, subtitle, tip, accent: color }}
      legend={
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '1.6em', fontWeight: 700, lineHeight: 1.05, fontVariantNumeric: 'tabular-nums' }}>{fmt(last.c)}</div>
          <div style={{ fontSize: '1.02em', fontWeight: 700, color: totalUp ? upColor : downColor }}>
            {totalUp ? '▲' : '▼'} {(((last.c - rows[0].o) / rows[0].o) * 100).toFixed(2)}%
            {maPeriod > 1 && <span style={{ color: inkColor, fontWeight: 400, marginLeft: '0.8em', background: `linear-gradient(transparent 45%, ${maColor}88 45%, ${maColor}88 85%, transparent 85%)`, padding: '0 0.2em' }}>{`MA ${Math.round(maPeriod)}`}</span>}
            {ma2Period > 1 && <span style={{ color: inkColor, fontWeight: 400, marginLeft: '0.5em', background: `linear-gradient(transparent 45%, ${ma2Color}77 45%, ${ma2Color}77 85%, transparent 85%)`, padding: '0 0.2em' }}>{`MA ${Math.round(ma2Period)}`}</span>}
          </div>
        </div>
      }
    >
      <svg
        ref={svgRef}
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${title}. Hand-drawn candlestick chart, ${N} periods from ${rows[0].d} to ${last.d}, first open ${fmt(rows[0].o)}, last close ${fmt(last.c)}.`}
        style={{ display: 'block', maxWidth: '100%', overflow: 'visible', touchAction: 'none', userSelect: 'none', cursor: dragRef.current ? 'grabbing' : 'crosshair' }}
        onMouseMove={onMove}
        onMouseDown={(e) => { if (!zoomable) return; const [mx] = local(e); dragRef.current = { x: mx, view: [a, b] }; setTip(null) }}
        onMouseUp={() => (dragRef.current = null)}
        onMouseLeave={() => { dragRef.current = null; setHi(null); setTip(null) }}
      >
        <defs>
          <clipPath id={`${uid}c`}>
            <rect x={m.l} y={-10} width={pw} height={H + 20} />
          </clipPath>
        </defs>
        <rect x={m.l} y={m.t} width={pw} height={ph} fill="transparent" />
        {yt.map((v, k) => (
          <g key={k}>
            {showGrid && <path d={sketchLine(sd + k, m.l + 4, Y(v), m.l + pw, Y(v), { ...o, doubleStroke: false, roughness: roughness * 0.5 })} fill="none" stroke={inkColor} strokeOpacity="0.14" strokeWidth="1" {...draw(axisP)} />}
            <text x={m.l + pw + 8} y={Y(v)} dy="0.34em" fontSize={size * 0.88} fill={mutedInk} opacity={axisP}>{fmt(v)}</text>
          </g>
        ))}
        {vis.map((k, j) => (j % every === 0 ? <text key={j} x={X(a + j)} y={H - 4} textAnchor="middle" fontSize={size * 0.88} fill={mutedInk} opacity={axisP}>{k.d}</text> : null))}
        <path d={sketchLine(sd + 50, m.l + pw, m.t - 2, m.l + pw, m.t + ph + 2, o) + sketchLine(sd + 51, m.l - 2, m.t + ph, m.l + pw + 4, m.t + ph, o)} fill="none" stroke={inkColor} strokeWidth={strokeWidth * 0.9} strokeLinecap="round" {...draw(axisP)} />

        <g clipPath={`url(#${uid}c)`}>
          {vis.map((k, j) => {
            const i = a + j
            const up = k.c >= k.o
            const c = up ? upColor : downColor
            const ip = ease(clamp((p - 0.1 - (j / vis.length) * 0.5) / 0.4, 0, 1))
            if (ip <= 0) return null
            const mid = (k.o + k.c) / 2
            const S_ = (v) => Y(mid + (v - mid) * ip)
            const x = X(i)
            const dim = hi && hi.i !== i ? 0.75 : 1
            const ks = sd + i * 7
            const top = Math.min(S_(k.o), S_(k.c))
            const bh = Math.max(1.5, Math.abs(S_(k.o) - S_(k.c)))
            const bx = x - bodyW / 2
            const lit = hi && hi.i === i
            return (
              <g key={i} opacity={dim}>
                {showVolume && <path d={sketchLine(ks + 1, x, volTop + volH, x, volTop + volH - Math.max(1, (k.v / vMax) * volH * ip), { ...tiny, doubleStroke: false })} fill="none" stroke={c} strokeWidth={Math.max(1.2, bodyW * 0.85)} strokeOpacity="0.35" />}
                {style === 'ohlc' ? (
                  <path d={sketchLine(ks + 2, x, S_(k.h), x, S_(k.l), { ...tiny, doubleStroke: false }) + sketchLine(ks + 3, x - bodyW / 2 - 1, S_(k.o), x, S_(k.o), { ...tiny, doubleStroke: false }) + sketchLine(ks + 4, x, S_(k.c), x + bodyW / 2 + 1, S_(k.c), { ...tiny, doubleStroke: false })} fill="none" stroke={c} strokeWidth={lit ? strokeWidth * 1.4 : Math.max(1, Math.min(strokeWidth, step * 0.2))} strokeLinecap="round" />
                ) : (
                  <>
                    <path d={sketchLine(ks + 2, x, S_(k.h), x, S_(k.l), { ...tiny, doubleStroke: false })} fill="none" stroke={mix(c, inkColor, 0.35)} strokeWidth={Math.max(1, Math.min(1.6, step * 0.16))} strokeLinecap="round" />
                    {up ? (
                      !hollowUp && <SketchFill id={`${uid}u${i}`} clip={`M${bx},${top}h${bodyW}v${bh}h${-bodyW}Z`} box={{ x: bx, y: top, w: bodyW, h: bh }} color={c} o={{ ...o, hachureGap: clamp(bodyW * 0.45, 2.5, hachureGap), strokeWidth: Math.max(0.9, Math.min(strokeWidth, bodyW * 0.22)) }} seed={ks + 5} />
                    ) : (
                      <path d={`M${bx},${top}h${bodyW}v${bh}h${-bodyW}Z`} fill={c} fillOpacity={fillStyle === 'solid' ? 0.85 : 0.78} />
                    )}
                    {bh > 2 && <path d={sketchRect(ks + 6, bx, top, bodyW, bh, tiny)} fill="none" stroke={mix(c, inkColor, 0.35)} strokeWidth={lit ? strokeWidth * 1.3 : Math.max(0.9, Math.min(strokeWidth * 0.8, bodyW * 0.25))} strokeLinejoin="round" />}
                  </>
                )}
              </g>
            )
          })}
          {ma1 && <path d={sketchCurve(sd + 300, maPts(ma1), { ...o, doubleStroke: false, roughness: roughness * 0.6 })} fill="none" stroke={maColor} strokeWidth={size * 0.5} strokeOpacity="0.45" strokeLinecap="round" strokeLinejoin="round" style={{ pointerEvents: 'none', mixBlendMode: 'multiply' }} {...draw(maP)} />}
          {ma2 && <path d={sketchCurve(sd + 301, maPts(ma2), { ...o, doubleStroke: false, roughness: roughness * 0.6 })} fill="none" stroke={ma2Color} strokeWidth={size * 0.5} strokeOpacity="0.38" strokeLinecap="round" strokeLinejoin="round" style={{ pointerEvents: 'none', mixBlendMode: 'multiply' }} {...draw(maP)} />}
        </g>

        {showLastPrice && p > 0.9 && (
          <g style={{ pointerEvents: 'none' }}>
            <path d={sketchLine(sd + 80, m.l, Y(last.c), m.l + pw, Y(last.c), { ...o, doubleStroke: false, roughness: roughness * 0.5 })} fill="none" stroke={lastUp ? upColor : downColor} strokeOpacity="0.75" strokeWidth="1.2" strokeDasharray="3 5" />
            {tag(Y(last.c), fmt(last.c), lastUp ? upColor : downColor, 81)}
          </g>
        )}

        {crosshair && hi && !dragRef.current && (
          <g style={{ pointerEvents: 'none' }}>
            <path d={sketchLine(sd + 90, X(hi.i), m.t, X(hi.i), m.t + ph, { ...o, doubleStroke: false, roughness: roughness * 0.6 })} fill="none" stroke={inkColor} strokeOpacity="0.45" strokeWidth="1.1" strokeDasharray="4 4" />
            {priceY != null && hi.y <= m.t + priceH && (
              <>
                <path d={sketchLine(sd + 91, m.l, priceY, m.l + pw, priceY, { ...o, doubleStroke: false, roughness: roughness * 0.6 })} fill="none" stroke={inkColor} strokeOpacity="0.45" strokeWidth="1.1" strokeDasharray="4 4" />
                {tag(priceY, fmt(priceAt), inkColor, 92)}
              </>
            )}
          </g>
        )}
      </svg>
    </Paper>
  )
}
