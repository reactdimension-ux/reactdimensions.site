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

// Doodle scatter plot: the scatter plot jotted down by hand. Each group gets its own pen
// mark (scribbled dot, cross, ring, triangle), trend lines are ruled in with r written
// beside them, hovering circles the nearest mark, and dragging draws a pencil box with a
// sticky-note summary of what is inside. Points are "Label:x|y|size|group", or leave
// `data` empty for the seeded demo set.

// one small pen mark centred on (0, 0): 0 dot, 1 cross, 2 ring, 3 triangle
function markD(kind, s, r, rough) {
  const j = () => (r() - 0.5) * rough * 0.7
  if (kind === 1) return `M${f1(-s + j())},${f1(-s + j())}L${f1(s + j())},${f1(s + j())}M${f1(s + j())},${f1(-s + j())}L${f1(-s + j())},${f1(s + j())}`
  const n = kind === 3 ? 3 : 7
  const a0 = kind === 3 ? -Math.PI / 2 : r() * 6.28
  const P = Array.from({ length: n }, (_, i) => {
    const a = a0 + (i / n) * Math.PI * 2
    const k = (kind === 3 ? 1.25 : 1) * s * (1 + (r() - 0.5) * 0.25 * rough)
    return [Math.cos(a) * k, Math.sin(a) * k]
  })
  if (kind === 3) return `M${P.map((q) => q.map(f1).join(',')).join('L')}Z`
  let d = `M${f1((P[0][0] + P[1][0]) / 2)},${f1((P[0][1] + P[1][1]) / 2)}`
  for (let i = 1; i <= n; i++) {
    const A = P[i % n]
    const B = P[(i + 1) % n]
    d += `Q${f1(A[0])},${f1(A[1])} ${f1((A[0] + B[0]) / 2)},${f1((A[1] + B[1]) / 2)}`
  }
  return d + 'Z'
}

export default function DoodleScatterPlot({
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
  xSuffix = '',
  ySuffix = '',
  roughness = 1.2,
  bowing = 1,
  fillStyle = 'hachure',
  hachureGap = 6,
  hachureAngle = -41,
  strokeWidth = 1.8,
  doubleStroke = true,
  boil = false,
  drawOn = true,
  duration = 1800,
  paper = 'grid',
  tilt = 0.4,
  width = 680,
  height = 300,
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
  const wrap = useRef(null)
  const svgRef = useRef(null)
  const [boxRef, boxW] = useWidth()
  const t = useBoil(boil)
  const sd = seed * 79 + t * 13
  const o = { roughness, bowing, fillStyle, hachureGap, hachureAngle, strokeWidth, doubleStroke }
  const pal = [color, color2, color3, color4]
  const pts = usePoints({ data, count, correlation, groups, seed, noise })
  const G = Math.max(1, ...pts.map((q) => q.g + 1))
  const nm = splitNames(names)
  const gName = (g) => nm[g] ?? (G > 1 ? `Group ${g + 1}` : 'All')
  const p = useReveal(drawOn, duration, `${data}|${count}|${correlation}|${groups}|${noise}|${seed}`)
  const [hov, setHov] = useState(-1)
  const [hovG, setHovG] = useState(null)
  const [tip, setTip] = useState(null)
  const [drag, setDrag] = useState(null)
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
  const m = { l: (showAxis ? Math.max(...yt.map((v) => (fmtTickLabel(v) + ySuffix).length)) * size * 0.5 + 14 : 8) + (yLabel ? size * 1.3 : 0), r: 12, t: 10, b: (showAxis ? size * 1.9 : 8) + (xLabel ? size * 1.4 : 0) }
  const pw = Math.max(60, W - m.l - m.r)
  const ph = Math.max(60, H - m.t - m.b)
  const X = (v) => m.l + ((v - sx.lo) / (sx.hi - sx.lo)) * pw
  const Y = (v) => m.t + ph - ((v - sy.lo) / (sy.hi - sy.lo)) * ph
  const px = useMemo(() => pts.map((q) => [X(q.x), Y(q.y)]), [pts, W, H, sx.lo, sx.hi, sy.lo, sy.hi, m.l, m.b]) // eslint-disable-line react-hooks/exhaustive-deps
  // pen marks are drawn once per wobble seed, then just moved and scaled
  const marks = useMemo(() => pts.map((q, i) => markD(q.g % 4, pointSize, srng(sd + i * 7), roughness)), [pts, pointSize, sd, roughness])

  const trends = useMemo(() => {
    if (!showTrend) return []
    const sets = trendScope === 'all' || G === 1 ? [{ g: 0, all: true, pts }] : Array.from({ length: G }, (_, g) => ({ g, pts: pts.filter((q) => q.g === g) }))
    return sets.map((s) => ({ ...s, fit: linreg(s.pts) })).filter((s) => s.fit)
  }, [showTrend, trendScope, pts, G])

  const local = (e) => {
    const b = svgRef.current.getBoundingClientRect()
    return [((e.clientX - b.left) / b.width) * W, ((e.clientY - b.top) / b.height) * H]
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
  const axisP = ease(clamp(p / 0.25, 0, 1))
  const draw = (k) => ({ pathLength: 1, strokeDasharray: 1, strokeDashoffset: 1 - k })
  const thin = { ...o, doubleStroke: false, roughness: roughness * 0.5 }
  const filled = (g) => g % 4 === 0 || g % 4 === 3

  const legend = showLegend && G > 1 ? (
    <div role="list" style={{ display: 'flex', gap: '0.2em 1em', flexWrap: 'wrap', fontSize: '1.1em', paddingTop: '0.3em' }}>
      {Array.from({ length: G }, (_, g) => (
        <span key={g} role="listitem" onMouseEnter={() => setHovG(g)} onMouseLeave={() => setHovG(null)} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35em' }}>
          <svg width="16" height="16" viewBox="-8 -8 16 16" aria-hidden style={{ overflow: 'visible' }}>
            <path d={markD(g % 4, 5, srng(seed * 5 + g), roughness)} fill={filled(g) ? pal[g % 4] : 'none'} fillOpacity={pointOpacity} stroke={pal[g % 4]} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {gName(g)}
        </span>
      ))}
    </div>
  ) : null

  return (
    <Paper wrapRef={(el) => { wrap.current = el; boxRef.current = el }} {...{ width, paper, paperColor, inkColor, mutedInk, size, font, tilt, title, subtitle, tip, legend, accent: color2 }}>
      <svg
        ref={svgRef}
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${title}. Hand-drawn scatter plot of ${pts.length} points${trends[0] ? `, correlation ${trends[0].fit.r.toFixed(2)}` : ''}.`}
        style={{ display: 'block', maxWidth: '100%', overflow: 'visible', touchAction: 'none', userSelect: 'none' }}
        onMouseLeave={() => { setHov(-1); setTip(null); setDrag(null) }}
      >
        {/* pencil grid, tick labels, pen axes */}
        {yt.map((v, k) => (
          <g key={`y${k}`}>
            {showGrid && <path d={sketchLine(sd + k, m.l + 4, Y(v), m.l + pw, Y(v), thin)} fill="none" stroke={inkColor} strokeOpacity="0.14" strokeWidth="1" {...draw(axisP)} />}
            {showAxis && <text x={m.l - 9} y={Y(v)} dy="0.34em" textAnchor="end" fontSize={size * 0.9} fill={mutedInk} opacity={axisP}>{fmtTickLabel(v) + ySuffix}</text>}
          </g>
        ))}
        {xt.map((v, k) => (
          <g key={`x${k}`}>
            {showGrid && <path d={sketchLine(sd + 20 + k, X(v), m.t, X(v), m.t + ph - 4, thin)} fill="none" stroke={inkColor} strokeOpacity="0.14" strokeWidth="1" {...draw(axisP)} />}
            {showAxis && <text x={X(v)} y={m.t + ph + size * 1.3} textAnchor="middle" fontSize={size * 0.9} fill={mutedInk} opacity={axisP}>{fmtTickLabel(v) + xSuffix}</text>}
          </g>
        ))}
        <path d={sketchLine(sd + 50, m.l - 2, m.t + ph, m.l + pw + 4, m.t + ph, o) + sketchLine(sd + 51, m.l, m.t - 4, m.l, m.t + ph + 2, o)} fill="none" stroke={inkColor} strokeWidth={strokeWidth} strokeLinecap="round" {...draw(axisP)} />
        {xLabel && <text x={m.l + pw / 2} y={H - 3} textAnchor="middle" fontSize={size * 1.02} fill={inkColor} opacity={axisP}>{xLabel}</text>}
        {yLabel && <text transform={`translate(${size * 0.85},${m.t + ph / 2}) rotate(-90)`} textAnchor="middle" fontSize={size * 1.02} fill={inkColor} opacity={axisP}>{yLabel}</text>}

        {/* ruled trend lines */}
        {trends.map((tr) => {
          const c = tr.all ? inkColor : pal[tr.g % 4]
          const x0 = Math.min(...tr.pts.map((q) => q.x))
          const x1 = Math.max(...tr.pts.map((q) => q.x))
          const yv = (x) => tr.fit.slope * x + tr.fit.icpt
          return (
            <path key={tr.g} d={sketchLine(sd + 70 + tr.g, X(x0), Y(yv(x0)), X(x1), Y(yv(x1)), { ...o, roughness: roughness * 0.35, bowing: 0.15 })} fill="none" stroke={c} strokeWidth={strokeWidth * 1.25} strokeLinecap="round" opacity={dimOf(tr.g) * 0.9} style={{ pointerEvents: 'none', transition: 'opacity .2s' }} {...draw(ease(clamp((p - 0.4) / 0.6, 0, 1)))} />
          )
        })}

        {/* pen marks */}
        {pts.map((q, i) => {
          const ip = ease(clamp((p - (i / pts.length) * 0.5) / 0.5, 0, 1))
          if (ip <= 0) return null
          const c = pal[q.g % 4]
          const active = i === hov
          return (
            <path
              key={i}
              d={marks[i]}
              transform={`translate(${f1(px[i][0])},${f1(px[i][1])}) scale(${(active ? 1.45 : 1) * ip})`}
              fill={filled(q.g) ? c : q.g % 4 === 2 ? paperColor : 'none'}
              fillOpacity={pointOpacity}
              stroke={c}
              strokeOpacity={Math.min(1, pointOpacity + 0.2)}
              strokeWidth={(active ? strokeWidth * 1.1 : strokeWidth * 0.85) / Math.max(0.3, ip)}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={dimOf(q.g) * (isIn(i) ? 1 : 0.18)}
              style={{ transition: 'opacity .2s', pointerEvents: 'none' }}
            />
          )
        })}
        {hov >= 0 && <path d={sketchEllipse(sd + 400, px[hov][0], px[hov][1], pointSize * 2.4, pointSize * 2.2, o)} fill="none" stroke={inkColor} strokeWidth={strokeWidth * 0.9} style={{ pointerEvents: 'none' }} />}

        {/* handwritten r values */}
        {showR && p > 0.9 && trends.map((tr) => {
          const c = tr.all ? inkColor : pal[tr.g % 4]
          const x0 = Math.min(...tr.pts.map((q) => q.x))
          const x1 = Math.max(...tr.pts.map((q) => q.x))
          const yv = (x) => tr.fit.slope * x + tr.fit.icpt
          const ang = (Math.atan2(Y(yv(x1)) - Y(yv(x0)), X(x1) - X(x0)) * 180) / Math.PI
          const lx = Math.min(X(x1) - size * 0.4, m.l + pw - size * 3.6)
          const ly = clamp(Y(yv(x1)) - size * 0.7, m.t + size, m.t + ph - 4)
          return (
            <text key={tr.g} x={lx} y={ly} textAnchor="end" fontSize={size * 1.15} fontWeight="700" fill={c} stroke={paperColor} strokeWidth="4" paintOrder="stroke" strokeLinejoin="round" opacity={dimOf(tr.g) * clamp((p - 0.9) * 10, 0, 1)} transform={`rotate(${clamp(ang, -35, 35)} ${lx} ${ly})`} style={{ pointerEvents: 'none' }}>{`r = ${tr.fit.r.toFixed(2)}`}</text>
          )
        })}

        {/* pencil selection box and its sticky note */}
        {box && (() => {
          const bx = Math.min(box.x0, box.x1)
          const by = Math.min(box.y0, box.y1)
          const bw = Math.abs(box.x1 - box.x0)
          const bh = Math.abs(box.y1 - box.y0)
          return (
            <g style={{ pointerEvents: 'none' }}>
              <rect x={bx} y={by} width={bw} height={bh} fill="#fff3a8" fillOpacity="0.35" />
              <path d={sketchRect(sd + 300, bx, by, bw, bh, { ...o, doubleStroke: false })} fill="none" stroke={inkColor} strokeOpacity="0.7" strokeWidth={strokeWidth * 0.8} strokeDasharray="6 5" strokeLinecap="round" />
            </g>
          )
        })()}
        {live && (() => {
          const w = size * 13.5
          const x = m.l + pw - w - 4
          const y = m.t + 2
          return (
            <g style={{ pointerEvents: 'none' }} transform={`rotate(-1.5 ${x + w / 2} ${y + size})`}>
              <rect x={x} y={y} width={w} height={size * 2} fill="#fff3a8" style={{ filter: 'drop-shadow(1px 3px 3px #0003)' }} />
              <text x={x + w / 2} y={y + size * 1.32} textAnchor="middle" fontSize={size * 1.02} fill="#2b2b2b">
                <tspan fontWeight="700">{`${live.n} picked`}</tspan>
                <tspan>{` · mean ${fmtTickLabel(live.mx)}, ${fmtTickLabel(live.my)}`}</tspan>
              </text>
            </g>
          )
        })()}

        <rect x={m.l} y={m.t} width={pw} height={ph} fill="transparent" style={{ cursor: brush ? 'crosshair' : 'default' }} onMouseMove={onMove} onMouseDown={onDown} onMouseUp={onUp} />
      </svg>
    </Paper>
  )
}
