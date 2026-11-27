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

// Doodle correlation matrix: how every variable moves with every other, sketched in a
// hand-ruled grid. Each pair is a pen circle (or square, number or coloured-in cell) sized
// by the strength of the link: plain hatching for positive, cross-hatching for negative,
// so the sign reads even without colour. Give a matrix as rows "Name:1|0.8|-0.2", or leave
// `data` empty to compute one from seeded demo variables.

// pen strokes cut by hand to a convex outline, so no clipPath is needed per cell
function hatchIn(seed, poly, o, angle, gap, style = o.fillStyle) {
  const r = srng(seed)
  const a = (angle * Math.PI) / 180
  const dx = Math.cos(a)
  const dy = Math.sin(a)
  let lo = Infinity
  let hi = -Infinity
  for (const [x, y] of poly) {
    const v = -x * dy + y * dx
    if (v < lo) lo = v
    if (v > hi) hi = v
  }
  const k = Math.round((hi - lo) / Math.max(1.2, gap))
  if (k < 1) return ''
  const segs = []
  for (let i = 0; i < k; i++) {
    const v = lo + ((i + 0.5) / k) * (hi - lo)
    let s0 = Infinity
    let s1 = -Infinity
    for (let e = 0; e < poly.length; e++) {
      const A = poly[e]
      const B = poly[(e + 1) % poly.length]
      const fa = -A[0] * dy + A[1] * dx - v
      const fb = -B[0] * dy + B[1] * dx - v
      if (fa === fb || (fa > 0 && fb > 0) || (fa < 0 && fb < 0)) continue
      const u = fa / (fa - fb)
      const s = (A[0] + (B[0] - A[0]) * u) * dx + (A[1] + (B[1] - A[1]) * u) * dy
      if (s < s0) s0 = s
      if (s > s1) s1 = s
    }
    if (!(s1 - s0 > 0.8)) continue
    const ins = Math.min(1, (s1 - s0) * 0.15)
    segs.push([-dy * v + dx * (s0 + ins), dx * v + dy * (s0 + ins), -dy * v + dx * (s1 - ins), dx * v + dy * (s1 - ins)])
  }
  const j = () => (r() - 0.5) * o.roughness * 0.9
  let d = ''
  if (style === 'zigzag') {
    segs.forEach(([x1, y1, x2, y2], i) => {
      const [ax, ay, bx, by] = i % 2 ? [x2, y2, x1, y1] : [x1, y1, x2, y2]
      d += `${i ? 'L' : 'M'}${f1(ax + j())},${f1(ay + j())}L${f1(bx + j())},${f1(by + j())}`
    })
  } else if (style === 'dots') {
    segs.forEach(([x1, y1, x2, y2]) => {
      const n = Math.max(1, Math.round(Math.hypot(x2 - x1, y2 - y1) / gap))
      for (let q = 0; q < n; q++) d += `M${f1(x1 + ((x2 - x1) * (q + 0.5)) / n + j())},${f1(y1 + ((y2 - y1) * (q + 0.5)) / n + j())}h0.1`
    })
  } else {
    segs.forEach(([x1, y1, x2, y2]) => {
      const b = (r() - 0.5) * o.roughness * o.bowing * 1.4
      d += `M${f1(x1 + j())},${f1(y1 + j())}Q${f1((x1 + x2) / 2 - dy * b)},${f1((y1 + y2) / 2 + dx * b)} ${f1(x2 + j())},${f1(y2 + j())}`
    })
    if (style === 'cross-hatch') d += hatchIn(seed + 7, poly, o, angle + 90, gap * 1.15, 'hachure')
  }
  return d
}

export default function DoodleCorrelationMatrix({
  data = '',
  variables = 8,
  seed = 12,
  strength = 1,
  title = 'What moves together',
  subtitle = 'Pearson correlation across 120 weekly readings',
  triangle = 'lower',
  display = 'circles',
  cluster = true,
  showValues = false,
  showDiagonal = true,
  decimals = 2,
  showLegend = true,
  crosshair = true,
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
  paper = 'grid',
  tilt = 0.6,
  width = 560,
  cellSize = 30,
  size = 15,
  font = HAND,
  color = '#e4572e',
  color2 = '#2e86ab',
  paperColor = '#fbf8f1',
  inkColor = '#2b2b2b',
  mutedInk = '#77736b',
}) {
  const wrap = useRef(null)
  const [boxRef, boxW] = useWidth()
  const tb = useBoil(boil)
  const sd = seed * 59 + tb * 13
  const o = { roughness, bowing, fillStyle, hachureGap, hachureAngle, strokeWidth, doubleStroke }
  const NAMES_V = ['Revenue', 'Users', 'Churn', 'NPS', 'Support', 'Latency', 'Spend', 'Growth', 'Retention', 'Errors']

  const model = useMemo(() => {
    const parsed = String(data ?? '').trim() ? parseRows(data) : null
    let names
    let M
    if (parsed) {
      names = parsed.map((r) => r.label)
      M = parsed.map((r, i) => names.map((_, j) => clamp(r.values[j] ?? (i === j ? 1 : 0), -1, 1)))
    } else {
      const N = clamp(Math.round(variables), 3, 10)
      const r = rng(Math.round(seed) * 41 + 5)
      const F = 3
      const load = Array.from({ length: N }, () => Array.from({ length: F }, () => gauss(r) * strength))
      const cols = load.map(() => new Array(120).fill(0))
      const fac = Array.from({ length: F }, () => Array.from({ length: 120 }, () => gauss(r)))
      for (let v = 0; v < N; v++) for (let t = 0; t < 120; t++) cols[v][t] = fac.reduce((a, f, k) => a + f[t] * load[v][k], 0) + gauss(r) * 0.9
      names = NAMES_V.slice(0, N)
      M = cols.map((a, i) => cols.map((b, j) => (i === j ? 1 : pearson(a, b))))
    }
    // greedy order: start from the most connected variable, then keep adding the closest one
    let order = names.map((_, i) => i)
    if (cluster) {
      const conn = (i) => M[i].reduce((a, v, j) => a + (i === j ? 0 : Math.abs(v)), 0)
      let cur = order.reduce((a, i) => (conn(i) > conn(a) ? i : a), 0)
      const left = new Set(order)
      left.delete(cur)
      const seq = [cur]
      while (left.size) {
        const nxt = [...left].reduce((a, i) => (M[cur][i] > M[cur][a] ? i : a), [...left][0])
        seq.push(nxt)
        left.delete(nxt)
        cur = nxt
      }
      order = seq
    }
    return { names: order.map((i) => names[i]), M: order.map((i) => order.map((j) => M[i][j])) }
  }, [data, variables, seed, strength, cluster]) // eslint-disable-line react-hooks/exhaustive-deps

  const { names, M } = model
  const N = names.length
  const stops = [color2, mix(paperColor, mutedInk, 0.45), color]
  const colorOf = (v) => rampAt(stops, (v + 1) / 2)
  const p = useReveal(drawOn, duration, `${data}|${variables}|${seed}|${strength}|${cluster}|${display}|${triangle}`)
  const [hov, setHov] = useState(null)
  const [tip, setTip] = useState(null)

  const maxLab = Math.min(12, Math.max(...names.map((s) => s.length)))
  const labW = maxLab * size * 0.5 + 12
  const W = Math.max(260, (boxW || width) - size * 2.8)
  const cell = Math.max(18, Math.min((W - labW - 6) / N, cellSize))
  const gridW = cell * N
  const H = labW * 0.72 + gridW + 8
  const x0 = labW
  const show = (i, j) => (triangle === 'full' ? true : triangle === 'lower' ? j <= i : j >= i) && (showDiagonal || i !== j)
  const word = (v) => { const a = Math.abs(v); const s = a > 0.7 ? 'strong' : a > 0.4 ? 'moderate' : a > 0.15 ? 'weak' : 'no'; return s === 'no' ? 'no clear link' : `${s} ${v > 0 ? 'positive' : 'negative'}` }
  const label = (v) => (v === 1 ? '1' : v.toFixed(decimals).replace(/^(-?)0\./, '$1.'))
  const axisP = ease(clamp(p / 0.25, 0, 1))
  const draw = (k) => ({ pathLength: 1, strokeDasharray: 1, strokeDashoffset: 1 - k })
  // negative links are cross-hatched so the sign survives without colour
  const styleOf = (v) => (v < 0 && (fillStyle === 'hachure' || fillStyle === 'zigzag') ? 'cross-hatch' : fillStyle)
  const ngon = (cx, cy, r, n = 14) => Array.from({ length: n }, (_, k) => [cx + Math.cos((k / n) * Math.PI * 2) * r, cy + Math.sin((k / n) * Math.PI * 2) * r])
  const gapS = Math.max(2.2, Math.min(hachureGap * 0.55, cell * 0.14))

  // the pencil cells: one path for every shown cell
  const gridD = useMemo(() => {
    let d = ''
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (show(i, j)) d += sketchRect(sd + 400 + i * 13 + j, x0 + j * cell, i * cell, cell, cell, { ...o, doubleStroke: false, roughness: roughness * 0.35, bowing: 0.3 })
    return d
  }, [N, cell, x0, sd, roughness, triangle, showDiagonal]) // eslint-disable-line react-hooks/exhaustive-deps

  const marks = useMemo(
    () =>
      M.map((row, i) =>
        row.map((v, j) => {
          if (!show(i, j)) return null
          const cx = x0 + j * cell + cell / 2
          const cy = i * cell + cell / 2
          const a = Math.abs(v)
          const s = sd + i * 17 + j * 3
          if (display === 'cells') {
            const q = [[cx - cell / 2 + 3, cy - cell / 2 + 3], [cx + cell / 2 - 3, cy - cell / 2 + 3], [cx + cell / 2 - 3, cy + cell / 2 - 3], [cx - cell / 2 + 3, cy + cell / 2 - 3]]
            return { poly: q, fill: hatchIn(s, q, o, hachureAngle, 1.8 + (cell * 0.35 - 1.8) * (1 - a) ** 1.3, styleOf(v)), line: '' }
          }
          if (display === 'squares') {
            const h = ((cell - 6) * Math.max(0.18, a)) / 2
            const q = [[cx - h, cy - h], [cx + h, cy - h], [cx + h, cy + h], [cx - h, cy + h]]
            return { poly: q, fill: hatchIn(s, q, o, hachureAngle, gapS, styleOf(v)), line: sketchRect(s + 1, cx - h, cy - h, 2 * h, 2 * h, { ...o, roughness: roughness * 0.45 }) }
          }
          if (display === 'numbers') return { poly: null, fill: '', line: '' }
          const rr = ((cell - 6) / 2) * Math.max(0.16, a)
          const q = ngon(cx, cy, rr)
          return { poly: q, fill: hatchIn(s, q, o, hachureAngle, gapS, styleOf(v)), line: sketchEllipse(s + 1, cx, cy, rr, rr, { ...o, roughness: roughness * 0.6 }) }
        }),
      ),
    [M, cell, x0, display, sd, roughness, bowing, fillStyle, hachureGap, hachureAngle, strokeWidth, doubleStroke, triangle, showDiagonal], // eslint-disable-line react-hooks/exhaustive-deps
  )

  const keyV = [-1, -0.5, 0, 0.5, 1]
  const legend = showLegend ? (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35em', fontSize: '1em', color: mutedInk, paddingTop: '0.3em' }}>
      <span>-1</span>
      <svg width={keyV.length * 20} height="18" viewBox={`0 0 ${keyV.length * 20} 18`} aria-hidden style={{ overflow: 'visible' }}>
        {keyV.map((v, k) => {
          const r = 8 * Math.max(0.2, Math.abs(v))
          const q = ngon(k * 20 + 10, 9, r)
          return (
            <g key={k}>
              {fillStyle === 'solid' ? <circle cx={k * 20 + 10} cy={9} r={r} fill={colorOf(v)} /> : <path d={hatchIn(seed * 7 + k, q, o, hachureAngle, 2.4, styleOf(v))} fill="none" stroke={colorOf(v)} strokeWidth="1.3" strokeLinecap="round" />}
              <path d={sketchEllipse(seed * 5 + k, k * 20 + 10, 9, r, r, { ...o, doubleStroke: false, roughness: roughness * 0.5 })} fill="none" stroke={colorOf(v)} strokeWidth="1.2" />
            </g>
          )
        })}
      </svg>
      <span>+1</span>
    </div>
  ) : null

  const tipFor = (e, i, j) => tooltip && setTip(tipAt(e, wrap, `${names[i]} × ${names[j]}`, [{ color: colorOf(M[i][j]), label: 'r', value: M[i][j].toFixed(2), strong: true }, { label: 'Link', value: i === j ? 'itself' : word(M[i][j]) }]))

  return (
    <Paper wrapRef={(el) => { wrap.current = el; boxRef.current = el }} {...{ width, paper, paperColor, inkColor, mutedInk, size, font, tilt, title, subtitle, tip, legend, accent: color2 }}>
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${title}. Hand-drawn correlation matrix of ${names.join(', ')}.`}
        style={{ display: 'block', maxWidth: '100%', margin: '0 auto', overflow: 'visible' }}
        onMouseLeave={() => { setHov(null); setTip(null) }}
      >
        {names.map((nm, i) => (
          <text key={`r${i}`} x={x0 - 8} y={i * cell + cell / 2} dy="0.34em" textAnchor="end" fontSize={size} fill={hov && hov.i === i ? inkColor : mutedInk} fontWeight={hov && hov.i === i ? 700 : 400} opacity={axisP}>{nm.length > 12 ? nm.slice(0, 11) + '…' : nm}</text>
        ))}
        {names.map((nm, j) => (
          <text key={`c${j}`} transform={`translate(${x0 + j * cell + cell / 2 + 4},${gridW + size * 0.9}) rotate(-40)`} textAnchor="end" fontSize={size} fill={hov && hov.j === j ? inkColor : mutedInk} fontWeight={hov && hov.j === j ? 700 : 400} opacity={axisP}>{nm.length > 12 ? nm.slice(0, 11) + '…' : nm}</text>
        ))}
        <path d={gridD} fill="none" stroke={inkColor} strokeOpacity="0.28" strokeWidth="1" strokeLinejoin="round" {...draw(axisP)} />

        {M.map((row, i) =>
          row.map((v, j) => {
            const mk = marks[i][j]
            if (!mk) return null
            const ip = ease(clamp((p - ((i + j) / (2 * N)) * 0.55) / 0.45, 0, 1))
            if (ip <= 0) return null
            const cx = x0 + j * cell + cell / 2
            const cy = i * cell + cell / 2
            const c = colorOf(v)
            const a = Math.abs(v)
            const on = !crosshair || !hov || hov.i === i || hov.j === j
            const exact = hov && hov.i === i && hov.j === j
            const wantNum = display === 'numbers' || display === 'mixed' || (showValues && (display === 'cells' || (cell > size * 2.6 && (cell - 6) * a > size * 2.4)))
            return (
              <g key={`${i}-${j}`} opacity={on ? 1 : 0.28} style={{ transition: 'opacity .15s', pointerEvents: 'none' }}>
                {mk.poly && (fillStyle === 'solid'
                  ? <path d={`M${mk.poly.map((q) => q.map(f1).join(',')).join('L')}Z`} fill={c} fillOpacity={(display === 'cells' ? 0.25 + 0.6 * a : 0.85) * ip} />
                  : <path d={mk.fill} fill="none" stroke={c} strokeWidth={fillStyle === 'dots' ? strokeWidth * 1.3 : strokeWidth * 0.75} strokeLinecap="round" strokeLinejoin="round" opacity={display === 'mixed' ? 0.6 : 0.95} {...draw(ip)} />)}
                {mk.line && <path d={mk.line} fill="none" stroke={mix(c, inkColor, 0.3)} strokeWidth={exact ? strokeWidth * 1.4 : strokeWidth * 0.8} strokeLinecap="round" {...draw(ip)} />}
                {wantNum && cell > size * 1.6 && ip > 0.7 && (
                  <text x={cx} y={cy} dy="0.34em" textAnchor="middle" fontSize={Math.min(size * (display === 'numbers' ? 1 : 0.85), cell * 0.4)} fontWeight="700" fill={display === 'numbers' ? mix(c, inkColor, 0.25) : inkColor} stroke={display === 'numbers' ? 'none' : paperColor} strokeWidth="3" paintOrder="stroke" strokeLinejoin="round">{label(v)}</text>
                )}
              </g>
            )
          }),
        )}
        {hov && <path d={sketchRect(sd + 777, x0 + hov.j * cell, hov.i * cell, cell, cell, o)} fill="none" stroke={inkColor} strokeWidth={strokeWidth * 1.1} strokeLinecap="round" strokeLinejoin="round" style={{ pointerEvents: 'none' }} />}

        {M.map((row, i) =>
          row.map((v, j) =>
            show(i, j) ? (
              <rect key={`h${i}-${j}`} x={x0 + j * cell} y={i * cell} width={cell} height={cell} fill="transparent" onMouseEnter={(e) => { setHov({ i, j }); tipFor(e, i, j) }} onMouseMove={(e) => tipFor(e, i, j)} />
            ) : null,
          ),
        )}
      </svg>
    </Paper>
  )
}
