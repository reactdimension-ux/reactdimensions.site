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

// Doodle ridgeline plot: one hand-traced hill per group, stacked on ruled pencil baselines
// so each ridge climbs a little into the one above. Every hill is coloured in with hatching
// at its own angle and blanks out the ridge behind it like a paper cut-out; a pencil tick
// marks the median. Paste raw samples into `data` or leave it empty for the demo set
// (groups, samples, seed, spread). `inkSeed` sets the wobble.
export default function DoodleRidgelinePlot({
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
  fillOpacity = 0.75,
  showMedian = true,
  showMean = false,
  showGrid = true,
  showAxis = true,
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
  duration = 2200,
  inkSeed = 24,
  decimals = 0,
  prefix = '',
  suffix = '',
  paper = 'grid',
  tilt = 0.6,
  width = 680,
  height = 320,
  size = 15,
  font = HAND,
  color = '#e4572e',
  color2 = '#2e86ab',
  color3 = '#3bb273',
  color4 = '#9b5de5',
  paperColor = '#fbf8f1',
  inkColor = '#2b2b2b',
  mutedInk = '#77736b',
}) {
  const uid = useId().replace(/:/g, '')
  const wrap = useRef(null)
  const [boxRef, boxW] = useWidth()
  const t = useBoil(boil)
  const sd = inkSeed * 59 + t * 13
  const o = { roughness, bowing, fillStyle, hachureGap, hachureAngle, strokeWidth, doubleStroke }
  const pal = [color, color2, color3, color4]
  const fmt = makeFmt({ decimals, prefix, suffix })
  const G = useSamples({ data, groups, samples, seed, spread, names })
  const S = useMemo(() => G.map((g) => summarize(g.values)), [G])
  const p = useReveal(drawOn, duration, `${data}|${groups}|${samples}|${seed}|${spread}|${bandwidth}|${overlap}|${normalize}`)
  const [hov, setHov] = useState(null)
  const [tip, setTip] = useState(null)

  const n = G.length
  const lo0 = Math.min(...S.map((s) => s.min))
  const hi0 = Math.max(...S.map((s) => s.max))
  const pad = (hi0 - lo0) * 0.12
  const sc = niceRange(lo0 - pad, hi0 + pad, 6)
  // spaced points (the pen jitters each one, so not too many)
  const K = useMemo(() => S.map((s) => kde(s, sc.lo, sc.hi, 46, bandwidth)), [S, sc.lo, sc.hi, bandwidth])
  const peakAll = Math.max(...K.map((k) => Math.max(...k.ys)))
  const ticks = ticksOf(sc)
  const colors = G.map((_, i) => (colorMode === 'single' ? color : colorMode === 'palette' ? pal[i % 4] : mix(color, color2, n > 1 ? i / (n - 1) : 0)))

  const W = Math.max(260, (boxW || width) - size * 2.8)
  const H = height
  const maxLab = Math.min(16, Math.max(1, ...G.map((g) => g.label.length)))
  const m = { l: maxLab * size * 0.5 + 16, r: 14, t: 6, b: showAxis ? size * 2 : 8 }
  const pw = Math.max(40, W - m.l - m.r)
  const ov = clamp(overlap, 0.4, 4)
  const band = (H - m.t - m.b) / Math.max(1, n - 1 + ov)
  const ridge = band * ov
  const X = (v) => m.l + ((v - sc.lo) / (sc.hi - sc.lo)) * pw
  const base = (i) => m.t + ridge + i * band
  const dim = (i) => (hov !== null && hov !== i ? 0.35 : 1)
  const axisP = ease(clamp(p / 0.22, 0, 1))
  const draw = (k) => ({ pathLength: 1, strokeDasharray: 1, strokeDashoffset: 1 - k })
  const thin = { ...o, doubleStroke: false, roughness: roughness * 0.5 }
  const tipRows = (i) => [{ color: colors[i], label: 'Median', value: fmt(S[i].med) }, { label: 'Mean', value: fmt(S[i].mean) }, { label: 'Std dev', value: fmt(S[i].sd) }, { label: 'Samples', value: String(S[i].n) }]

  return (
    <Paper wrapRef={(el) => { wrap.current = el; boxRef.current = el }} {...{ width, paper, paperColor, inkColor, mutedInk, size, font, tilt, title, subtitle, tip, accent: color }}>
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${title}. Hand-drawn ridgeline plot. ${G.map((g, i) => `${g.label}: median ${fmt(S[i].med)}`).join('; ')}`}
        style={{ display: 'block', maxWidth: '100%', overflow: 'visible' }}
        onMouseLeave={() => { setHov(null); setTip(null) }}
      >
        {ticks.map((v, i) => (
          <g key={i}>
            {showGrid && <path d={sketchLine(sd + i, X(v), m.t + 2, X(v), H - m.b, thin)} fill="none" stroke={inkColor} strokeOpacity="0.13" strokeWidth="1" {...draw(axisP)} />}
            {showAxis && <text x={X(v)} y={H - m.b + size * 1.35} textAnchor="middle" fontSize={size * 0.9} fill={mutedInk} opacity={axisP}>{prefix + fmtTick(v) + suffix}</text>}
          </g>
        ))}

        {G.map((g, i) => {
          const k = K[i]
          const ip = stag(clamp((p - 0.1) / 0.9, 0, 1), n - 1 - i, n)
          const top = normalize === 'peak' ? Math.max(...k.ys) : peakAll
          const b = base(i)
          const pts = k.xs.map((x, j) => [X(x), b - (k.ys[j] / top) * ridge * ip])
          const exact = 'M' + pts.map((q) => q.map(f1).join(',')).join('L') + `L${f1(pts[pts.length - 1][0])},${f1(b)}L${f1(pts[0][0])},${f1(b)}Z`
          const c = colors[i]
          const pen = mix(c, inkColor, 0.3)
          const hot = hov === i
          const lab = g.label.length > 16 ? g.label.slice(0, 15) + '…' : g.label
          const at = (v) => {
            const j = clamp(Math.round(((v - sc.lo) / (sc.hi - sc.lo)) * (k.xs.length - 1)), 0, k.xs.length - 1)
            return { x: X(v), y: b - (k.ys[j] / top) * ridge * ip }
          }
          const med = at(S[i].med)
          const mean = at(S[i].mean)
          const late = ease(clamp((p - 0.6) / 0.3, 0, 1))
          return (
            <g key={i} opacity={dim(i)} style={{ transition: 'opacity .2s' }}>
              {/* paper cut-out so this hill hides the one behind it */}
              <path d={exact} fill={paperColor} />
              <SketchFill id={`${uid}r${i}`} clip={exact} box={{ x: m.l, y: b - ridge - 2, w: pw, h: ridge + 2 }} color={c} o={o} seed={sd + i * 17} angle={hachureAngle + i * 27} prog={ip} opacity={fillOpacity} />
              {/* ruled baseline, then the traced hill */}
              <path d={sketchLine(sd + 80 + i, m.l - 4, b, m.l + pw + 4, b, { ...o, doubleStroke: false, roughness: roughness * 0.6 })} fill="none" stroke={inkColor} strokeOpacity="0.55" strokeWidth="1.2" strokeLinecap="round" {...draw(axisP)} />
              <path d={sketchCurve(sd + i * 31, pts, { ...o, roughness: roughness * 0.55 })} fill="none" stroke={pen} strokeWidth={hot ? strokeWidth * 1.5 : strokeWidth} strokeLinejoin="round" strokeLinecap="round" {...draw(ip)} />
              {showMedian && <path d={sketchLine(sd + 120 + i, med.x, b, med.x, med.y + 2, { ...o, doubleStroke: false, roughness: roughness * 0.5 })} fill="none" stroke={inkColor} strokeWidth="1.5" strokeOpacity="0.8" strokeLinecap="round" opacity={late} />}
              {showMean && <path d={sketchEllipse(sd + 140 + i, mean.x, b, 4, 4, { ...o, doubleStroke: false })} fill={paperColor} stroke={pen} strokeWidth={strokeWidth * 0.9} opacity={late} />}
              <text x={m.l - 10} y={b} dy="-0.15em" textAnchor="end" fontSize={size * 1.02} fill={hot ? inkColor : mutedInk} fontWeight={hot ? 700 : 400} style={{ transition: 'fill .2s' }}>{lab}</text>
            </g>
          )
        })}

        {G.map((g, i) => (
          <rect
            key={i}
            x={0}
            y={base(i) - band * 0.75}
            width={W}
            height={band}
            fill="transparent"
            onMouseEnter={(e) => { setHov(i); tooltip && setTip(tipAt(e, wrap, g.label, tipRows(i))) }}
            onMouseMove={(e) => tooltip && setTip(tipAt(e, wrap, g.label, tipRows(i)))}
          />
        ))}
      </svg>
    </Paper>
  )
}
