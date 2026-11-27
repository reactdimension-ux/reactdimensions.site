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

// Doodle hexbin plot: thousands of points sorted into wobbly pen hexagons (or squares, or
// circles), each one hatched in more densely and more darkly the more points it holds.
// The bins scribble themselves in from the busiest one outwards. Hover a bin for its count
// and share. Points are "Label:x|y", or leave `data` empty for a seeded demo of
// overlapping clusters.

// pen strokes cut by hand to a convex outline, so no clipPath is needed per bin
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
// a closed outline through jittered corners with slightly bowed sides
function outlineD(seed, poly, o, passes = 1) {
  const r = srng(seed)
  const j = () => (r() - 0.5) * o.roughness * 1.1
  let d = ''
  for (let pass = 0; pass < passes; pass++) {
    const P = poly.map(([x, y]) => [x + j(), y + j()])
    d += `M${f1(P[0][0])},${f1(P[0][1])}`
    for (let i = 1; i <= P.length; i++) {
      const A = P[i - 1]
      const B = P[i % P.length]
      d += `Q${f1((A[0] + B[0]) / 2 + j() * o.bowing)},${f1((A[1] + B[1]) / 2 + j() * o.bowing)} ${f1(B[0])},${f1(B[1])}`
    }
  }
  return d
}

export default function DoodleHexbinPlot({
  data = '',
  count = 3200,
  clusters = 3,
  seed = 5,
  title = 'Where the traffic lands',
  subtitle = '3,200 requests: latency against payload size',
  xLabel = 'Payload (KB)',
  yLabel = 'Latency (ms)',
  shape = 'hexagon',
  binSize = 15,
  scaleType = 'sqrt',
  scale = 'sequential',
  reverse = false,
  sizeByCount = false,
  minCount = 1,
  showPoints = false,
  gap = 1.5,
  showGrid = true,
  showAxis = true,
  showLegend = true,
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
  tilt = -0.3,
  width = 680,
  height = 300,
  size = 15,
  font = HAND,
  color = '#e4572e',
  color2 = '#2e86ab',
  color3 = '#3bb273',
  paperColor = '#fbf8f1',
  inkColor = '#2b2b2b',
  mutedInk = '#77736b',
}) {
  const uid = useId().replace(/:/g, '')
  const wrap = useRef(null)
  const [boxRef, boxW] = useWidth()
  const tb = useBoil(boil)
  const sd = seed * 61 + tb * 13
  const o = { roughness, bowing, fillStyle, hachureGap, hachureAngle, strokeWidth, doubleStroke }
  const pts = useMemo(() => {
    const parsed = String(data ?? '').trim() ? parseRows(data) : null
    if (parsed) return parsed.map((r) => ({ x: r.values[0] ?? 0, y: r.values[1] ?? 0 }))
    const r = rng(Math.round(seed) * 53 + 7)
    const K = clamp(Math.round(clusters), 1, 6)
    const C = [[30, 40, 9, 7, 0.5], [62, 58, 12, 10, -0.3], [48, 72, 7, 6, 0.2], [74, 34, 8, 8, 0.6], [22, 70, 6, 6, 0], [55, 28, 10, 5, -0.4]]
    return Array.from({ length: Math.round(count) }, (_, i) => {
      const [cx, cy, sx, sy, rho] = C[i % K]
      const zx = gauss(r)
      return { x: +(cx + zx * sx).toFixed(2), y: +(cy + (rho * zx + Math.sqrt(1 - rho * rho) * gauss(r)) * sy).toFixed(2) }
    })
  }, [data, count, clusters, seed])

  const xs = pts.map((q) => q.x)
  const ys = pts.map((q) => q.y)
  const sx = niceRange(Math.min(...xs), Math.max(...xs), 6)
  const sy = niceRange(Math.min(...ys), Math.max(...ys), 5)
  const xt = ticksOf(sx)
  const yt = ticksOf(sy)
  const W = Math.max(260, (boxW || width) - size * 2.8)
  const H = height
  const m = { l: (showAxis ? Math.max(...yt.map((v) => fmtTickLabel(v).length)) * size * 0.5 + 14 : 8) + (yLabel ? size * 1.3 : 0), r: 10, t: 8, b: (showAxis ? size * 1.9 : 8) + (xLabel ? size * 1.4 : 0) }
  const pw = Math.max(60, W - m.l - m.r)
  const ph = Math.max(60, H - m.t - m.b)
  const X = (v) => ((v - sx.lo) / (sx.hi - sx.lo)) * pw
  const Y = (v) => ph - ((v - sy.lo) / (sy.hi - sy.lo)) * ph
  const R = clamp(binSize, 6, 48)
  const stops = useMemo(() => {
    const s = scale === 'diverging' ? [color2, mix(paperColor, mutedInk, 0.3), color] : scale === 'spectrum' ? [color2, color3, color] : [mix(paperColor, color, 0.45), color]
    return reverse ? [...s].reverse() : s
  }, [scale, color, color2, color3, paperColor, mutedInk, reverse])

  const bins = useMemo(() => {
    const map = new Map()
    const add = (key, cx, cy) => {
      const b = map.get(key) ?? { cx, cy, n: 0 }
      b.n++
      map.set(key, b)
    }
    const s3 = Math.sqrt(3)
    for (const q of pts) {
      const x = X(q.x)
      const y = Y(q.y)
      if (shape === 'square') {
        const i = Math.floor(x / (R * 1.7))
        const j = Math.floor(y / (R * 1.7))
        add(`${i},${j}`, (i + 0.5) * R * 1.7, (j + 0.5) * R * 1.7)
      } else {
        // pixel -> axial hex coordinates (pointy top), then cube rounding
        const fq = ((s3 / 3) * x - y / 3) / R
        const fr = ((2 / 3) * y) / R
        let rq = Math.round(fq)
        let rr = Math.round(fr)
        const rs = Math.round(-fq - fr)
        const dq = Math.abs(rq - fq)
        const dr = Math.abs(rr - fr)
        const ds = Math.abs(rs + fq + fr)
        if (dq > dr && dq > ds) rq = -rr - rs
        else if (dr > ds) rr = -rq - rs
        add(`${rq},${rr}`, R * s3 * (rq + rr / 2), R * 1.5 * rr)
      }
    }
    return [...map.values()]
  }, [pts, shape, R, W, H, sx.lo, sx.hi, sy.lo, sy.hi, m.l, m.b]) // eslint-disable-line react-hooks/exhaustive-deps

  const shown = useMemo(() => bins.filter((b) => b.n >= Math.max(1, minCount)), [bins, minCount])
  const nMax = Math.max(1, ...shown.map((b) => b.n))
  const nMin = Math.min(nMax, ...shown.map((b) => b.n))
  const tf = (n) => (scaleType === 'log' ? Math.log(n) : scaleType === 'sqrt' ? Math.sqrt(n) : n)
  const tOf = (n) => (nMax === nMin ? 1 : (tf(n) - tf(nMin)) / (tf(nMax) - tf(nMin)))
  const peak = shown.reduce((a, b) => (b.n > a.n ? b : a), shown[0] ?? { cx: 0, cy: 0, n: 0 })
  const dmax = Math.max(1, ...shown.map((b) => Math.hypot(b.cx - peak.cx, b.cy - peak.cy)))
  const p = useReveal(drawOn, duration, `${data}|${count}|${clusters}|${seed}|${shape}|${binSize}`)
  const [hov, setHov] = useState(-1)
  const [tip, setTip] = useState(null)
  const cell = shape === 'square' ? R * 1.7 : R
  const polyOf = (cx, cy, r) =>
    shape === 'square'
      ? [[cx - r / 2, cy - r / 2], [cx + r / 2, cy - r / 2], [cx + r / 2, cy + r / 2], [cx - r / 2, cy + r / 2]]
      : shape === 'circle'
        ? Array.from({ length: 12 }, (_, k) => [cx + Math.cos((k / 12) * Math.PI * 2) * r * 0.9, cy + Math.sin((k / 12) * Math.PI * 2) * r * 0.9])
        : Array.from({ length: 6 }, (_, k) => { const a = (Math.PI / 3) * k - Math.PI / 6; return [cx + r * Math.cos(a), cy + r * Math.sin(a)] })
  const minGap = Math.max(1.6, strokeWidth * 1.05)
  const gapOf = (t) => hachureGap * 1.3 + (minGap - hachureGap * 1.3) * t ** 0.7
  const inkOf = (t) => (scale === 'diverging' ? Math.abs(t * 2 - 1) : reverse ? 1 - t : t)

  // geometry is drawn once per data/layout/wobble seed; the reveal only moves dash offsets
  const geo = useMemo(
    () =>
      shown.map((b, i) => {
        const t = tOf(b.n)
        const r = Math.max(1, cell - gap) * (sizeByCount ? 0.35 + 0.65 * t : 1)
        const poly = polyOf(b.cx, b.cy, r)
        return { t, c: rampAt(stops, t), poly, fill: fillStyle === 'solid' ? '' : hatchIn(sd + i * 7, poly, o, hachureAngle, gapOf(inkOf(t))), line: outlineD(sd + i * 3, poly, { ...o, roughness: roughness * 0.7 }) }
      }),
    [shown, cell, gap, sizeByCount, shape, stops, sd, roughness, bowing, fillStyle, hachureGap, hachureAngle, strokeWidth, scaleType, nMin, nMax], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const dotsD_ = useMemo(() => (showPoints ? pts.slice(0, 1500).map((q) => `M${f1(X(q.x))},${f1(Y(q.y))}h0.1`).join('') : ''), [showPoints, pts, W, H, sx.lo, sx.hi, sy.lo, sy.hi]) // eslint-disable-line react-hooks/exhaustive-deps
  const axisP = ease(clamp(p / 0.25, 0, 1))
  const draw = (k) => ({ pathLength: 1, strokeDasharray: 1, strokeDashoffset: 1 - k })
  const thin = { ...o, doubleStroke: false, roughness: roughness * 0.5 }

  const onMove = (e) => {
    const b = e.currentTarget.getBoundingClientRect()
    const mx = ((e.clientX - b.left) / b.width) * pw
    const my = ((e.clientY - b.top) / b.height) * ph
    let best = -1
    let bd = (cell * 0.95) ** 2
    shown.forEach((q, i) => {
      const d = (q.cx - mx) ** 2 + (q.cy - my) ** 2
      if (d < bd) {
        bd = d
        best = i
      }
    })
    setHov(best)
    if (best < 0 || !tooltip) return setTip(null)
    const q = shown[best]
    setTip(tipAt(e, wrap, `${q.n} points`, [{ color: geo[best].c, label: 'Share', value: `${((q.n / pts.length) * 100).toFixed(1)}%`, strong: true }, { label: xLabel || 'x', value: fmtTickLabel(sx.lo + (q.cx / pw) * (sx.hi - sx.lo)) }, { label: yLabel || 'y', value: fmtTickLabel(sy.lo + ((ph - q.cy) / ph) * (sy.hi - sy.lo)) }]))
  }

  const keyN = 5
  const legend = showLegend ? (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4em', fontSize: '1em', color: mutedInk, paddingTop: '0.3em' }}>
      <span>{nMin}</span>
      <svg width={keyN * 19} height="18" viewBox={`0 0 ${keyN * 19} 18`} aria-hidden style={{ overflow: 'visible' }}>
        {Array.from({ length: keyN }, (_, i) => {
          const t = i / (keyN - 1)
          const poly = Array.from({ length: 6 }, (_, k) => { const a = (Math.PI / 3) * k - Math.PI / 6; return [i * 19 + 9 + 9 * Math.cos(a), 9 + 9 * Math.sin(a)] })
          return (
            <g key={i}>
              {fillStyle === 'solid'
                ? <path d={`M${poly.map((q) => q.map(f1).join(',')).join('L')}Z`} fill={rampAt(stops, t)} />
                : <path d={hatchIn(seed * 9 + i, poly, o, hachureAngle, 1.4 + 4.6 * (1 - inkOf(t)))} fill="none" stroke={rampAt(stops, t)} strokeWidth={fillStyle === 'dots' ? 2.4 : 1.4} strokeLinecap="round" />}
              <path d={outlineD(seed * 3 + i, poly, { ...o, roughness: roughness * 0.5 })} fill="none" stroke={inkColor} strokeOpacity="0.5" strokeWidth="1" />
            </g>
          )
        })}
      </svg>
      <span>{nMax}</span>
      <span style={{ fontSize: '0.85em' }}>per bin</span>
    </div>
  ) : null

  return (
    <Paper wrapRef={(el) => { wrap.current = el; boxRef.current = el }} {...{ width, paper, paperColor, inkColor, mutedInk, size, font, tilt, title, subtitle, tip, legend, accent: color }}>
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${title}. Hand-drawn ${shape} bin plot of ${pts.length} points in ${shown.length} bins, up to ${nMax} per bin.`}
        style={{ display: 'block', maxWidth: '100%', overflow: 'visible' }}
        onMouseLeave={() => { setHov(-1); setTip(null) }}
      >
        {yt.map((v, k) => (
          <g key={`y${k}`}>
            {showGrid && <path d={sketchLine(sd + k, m.l + 4, m.t + Y(v), m.l + pw, m.t + Y(v), thin)} fill="none" stroke={inkColor} strokeOpacity="0.14" strokeWidth="1" {...draw(axisP)} />}
            {showAxis && <text x={m.l - 9} y={m.t + Y(v)} dy="0.34em" textAnchor="end" fontSize={size * 0.9} fill={mutedInk} opacity={axisP}>{fmtTickLabel(v)}</text>}
          </g>
        ))}
        {xt.map((v, k) => (
          <g key={`x${k}`}>
            {showGrid && <path d={sketchLine(sd + 20 + k, m.l + X(v), m.t, m.l + X(v), m.t + ph - 4, thin)} fill="none" stroke={inkColor} strokeOpacity="0.14" strokeWidth="1" {...draw(axisP)} />}
            {showAxis && <text x={m.l + X(v)} y={m.t + ph + size * 1.3} textAnchor="middle" fontSize={size * 0.9} fill={mutedInk} opacity={axisP}>{fmtTickLabel(v)}</text>}
          </g>
        ))}
        <path d={sketchLine(sd + 50, m.l - 2, m.t + ph, m.l + pw + 4, m.t + ph, o) + sketchLine(sd + 51, m.l, m.t - 4, m.l, m.t + ph + 2, o)} fill="none" stroke={inkColor} strokeWidth={strokeWidth} strokeLinecap="round" {...draw(axisP)} />
        {xLabel && <text x={m.l + pw / 2} y={H - 3} textAnchor="middle" fontSize={size * 1.02} fill={inkColor} opacity={axisP}>{xLabel}</text>}
        {yLabel && <text transform={`translate(${size * 0.85},${m.t + ph / 2}) rotate(-90)`} textAnchor="middle" fontSize={size * 1.02} fill={inkColor} opacity={axisP}>{yLabel}</text>}

        <clipPath id={`${uid}c`}>
          <rect x={-2} y={-4} width={pw + 6} height={ph + 2} />
        </clipPath>
        <g transform={`translate(${m.l},${m.t})`} clipPath={`url(#${uid}c)`} style={{ pointerEvents: 'none' }}>
          {showPoints && <path d={dotsD_} stroke={inkColor} strokeOpacity="0.25" strokeWidth="2" strokeLinecap="round" />}
          {shown.map((b, i) => {
            const d = Math.hypot(b.cx - peak.cx, b.cy - peak.cy) / dmax
            const ip = ease(clamp((p - d * 0.55) / 0.45, 0, 1))
            if (ip <= 0) return null
            const gm = geo[i]
            return (
              <g key={i} opacity={hov >= 0 && hov !== i ? 0.5 : 1} style={{ transition: 'opacity .15s' }}>
                {fillStyle === 'solid' ? (
                  <path d={`M${gm.poly.map((q) => q.map(f1).join(',')).join('L')}Z`} fill={gm.c} fillOpacity={0.85 * ip} />
                ) : (
                  <path d={gm.fill} fill="none" stroke={gm.c} strokeWidth={fillStyle === 'dots' ? strokeWidth * 1.5 : strokeWidth * 0.85} strokeLinecap="round" strokeLinejoin="round" {...draw(ip)} />
                )}
                <path d={gm.line} fill="none" stroke={mix(gm.c, inkColor, 0.45)} strokeOpacity={0.55 + 0.4 * gm.t} strokeWidth={strokeWidth * 0.65} strokeLinejoin="round" {...draw(ip)} />
              </g>
            )
          })}
          {hov >= 0 && geo[hov] && <path d={outlineD(sd + 999, geo[hov].poly, o, doubleStroke ? 2 : 1)} fill="none" stroke={inkColor} strokeWidth={strokeWidth * 1.2} strokeLinejoin="round" strokeLinecap="round" />}
        </g>
        <rect x={m.l} y={m.t} width={pw} height={ph} fill="transparent" onMouseMove={onMove} />
      </svg>
    </Paper>
  )
}
