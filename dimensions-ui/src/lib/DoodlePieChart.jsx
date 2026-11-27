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

// Doodle pie chart: slices drawn in pen and coloured in with hatching at alternating
// angles, percentages written outside at the end of hand-drawn arrows, and (for a donut)
// the total circled in the middle. Hover lifts a slice out. Entries are "Label:value".
export default function DoodlePieChart({
  data = 'Direct:38, Organic search:27, Social:14, Email:9, Referral:7, Paid:5',
  title = 'Where sign-ups come from',
  subtitle = 'share of 12,480 sign-ups',
  innerRadius = 0.45,
  sort = true,
  labels = 'outside',
  showLegend = true,
  centerLabel = 'total',
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
  seed = 3,
  hoverLift = 8,
  tooltip = true,
  decimals = 0,
  suffix = '%',
  paper = 'grid',
  tilt = -0.4,
  width = 600,
  height = 300,
  size = 15,
  font = HAND,
  color = '#e4572e',
  color2 = '#2e86ab',
  color3 = '#3bb273',
  color4 = '#f2a541',
  color5 = '#9b5de5',
  color6 = '#f15bb5',
  paperColor = '#fbf8f1',
  inkColor = '#2b2b2b',
  mutedInk = '#77736b',
}) {
  const uid = useId().replace(/:/g, '')
  const wrap = useRef(null)
  const [boxRef, boxW] = useWidth()
  const t = useBoil(boil)
  const sd = seed * 83 + t * 13
  const o = { roughness, bowing, fillStyle, hachureGap, hachureAngle, strokeWidth, doubleStroke }
  const base = [color, color2, color3, color4, color5, color6]
  const slices = useMemo(() => {
    const r = parseRows(data).map((x) => ({ label: x.label, v: Math.max(0, x.values[0] ?? 0) })).filter((x) => x.v > 0)
    if (sort) r.sort((a, b) => b.v - a.v)
    return r
  }, [data, sort])
  const total = slices.reduce((a, s) => a + s.v, 0) || 1
  const pct = (v) => `${((v / total) * 100).toFixed(decimals)}${suffix}`
  const p = useReveal(drawOn, duration, `${data}|${innerRadius}`)
  const [hov, setHov] = useState(-1)
  const [tip, setTip] = useState(null)

  const W = Math.max(260, (boxW || width) - size * 2.8)
  const legendW = showLegend && W > 440 ? Math.min(210, W * 0.36) : 0
  const plotW = W - legendW
  const H = height
  const outside = labels === 'outside'
  const R = Math.max(40, Math.min(plotW / 2 - (outside ? size * 3.6 : 10), H / 2 - (outside ? size * 1.4 : 10)))
  const r0 = R * clamp(innerRadius, 0, 0.85)
  const cx = plotW / 2
  const cy = H / 2
  const pt = (a, r) => [cx + Math.sin(a) * r, cy - Math.cos(a) * r]
  const sweep = ease(clamp(p / 0.55, 0, 1))
  let acc = 0
  const arcs = slices.map((s, i) => {
    const a0 = (acc / total) * Math.PI * 2 * sweep
    acc += s.v
    const a1 = (acc / total) * Math.PI * 2 * sweep
    return { ...s, i, a0, a1, mid: (a0 + a1) / 2, c: base[i % base.length] }
  })
  // exact outline (for the hatch clip) and a point list (for the wobbly pen outline)
  const outlinePts = (a0, a1, rr0, rr1, off) => {
    const steps = Math.max(2, Math.ceil((a1 - a0) / 0.22))
    const outer = Array.from({ length: steps + 1 }, (_, k) => pt(a0 + ((a1 - a0) * k) / steps, rr1))
    const inner = rr0 > 0 ? Array.from({ length: steps + 1 }, (_, k) => pt(a1 - ((a1 - a0) * k) / steps, rr0)) : [[cx, cy]]
    return [...outer, ...inner].map(([x, y]) => [x + off[0], y + off[1]])
  }
  const clipD = (pts) => 'M' + pts.map((q) => q.map(f1).join(',')).join('L') + 'Z'

  // outside labels, pushed apart on each side
  const lab = arcs.map((a) => { const [x, y] = pt(a.mid, R + size * 1.1); return { i: a.i, side: Math.sin(a.mid) >= 0 ? 1 : -1, y } })
  ;[1, -1].forEach((sgn) => {
    const L = lab.filter((l) => l.side === sgn).sort((a, b) => a.y - b.y)
    for (let k = 1; k < L.length; k++) if (L[k].y - L[k - 1].y < size * 1.25) L[k].y = L[k - 1].y + size * 1.25
  })

  return (
    <Paper wrapRef={(el) => { wrap.current = el; boxRef.current = el }} {...{ width, paper, paperColor, inkColor, mutedInk, size, font, tilt, title, subtitle, tip, accent: color4 }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <svg width={plotW} height={H} viewBox={`0 0 ${plotW} ${H}`} role="img" aria-label={`${title}. Hand-drawn ${r0 > 0 ? 'donut' : 'pie'} chart. ${slices.map((s) => `${s.label}: ${pct(s.v)}`).join('; ')}`} style={{ display: 'block', overflow: 'visible', flex: 'none' }} onMouseLeave={() => { setHov(-1); setTip(null) }}>
          {arcs.map((a) => {
            if (a.a1 - a.a0 < 0.004) return null
            const lift = a.i === hov ? hoverLift : 0
            const off = [Math.sin(a.mid) * lift, -Math.cos(a.mid) * lift]
            const pts = outlinePts(a.a0, a.a1, r0, R, off)
            const fp = ease(clamp((p - 0.25 - a.i * 0.06) / 0.45, 0, 1))
            return (
              <g key={a.i} opacity={hov >= 0 && hov !== a.i ? 0.35 : 1} style={{ transition: 'opacity .2s', cursor: 'default' }}
                onMouseEnter={(e) => { setHov(a.i); tooltip && setTip(tipAt(e, wrap, a.label, [{ color: a.c, label: 'share', value: pct(a.v) }, { label: 'value', value: String(a.v) }])) }}
                onMouseMove={(e) => tooltip && setTip((tp) => (tp ? { ...tp, ...tipAt(e, wrap, tp.title, tp.rows) } : tp))}
              >
                <path d={clipD(pts)} fill="transparent" />
                <SketchFill id={`${uid}s${a.i}`} clip={clipD(pts)} box={{ x: cx - R - lift, y: cy - R - lift, w: 2 * R + 2 * lift, h: 2 * R + 2 * lift }} color={a.c} o={o} seed={sd + a.i * 13} angle={hachureAngle + (a.i % 2 ? 70 : 0) + a.i * 12} prog={fp} />
                <path d={sketchPoly(sd + a.i * 3, pts, { ...o, roughness: roughness * 0.55 })} fill="none" stroke={inkColor} strokeWidth={a.i === hov ? strokeWidth * 1.5 : strokeWidth} strokeLinejoin="round" strokeLinecap="round" />
                {labels === 'inside' && a.a1 - a.a0 > 0.3 && p > 0.9 && (() => { const [lx, ly] = pt(a.mid, (r0 + R) / 2); return <text x={lx + off[0]} y={ly + off[1]} dy="0.34em" textAnchor="middle" fontSize={size} fontWeight="700" fill={inkColor} stroke={paperColor} strokeWidth="3" paintOrder="stroke">{pct(a.v)}</text> })()}
              </g>
            )
          })}
          {outside && p > 0.85 && arcs.map((a) => {
            const l = lab[a.i]
            const [ex, ey] = pt(a.mid, R + 4)
            const tx = cx + l.side * (R + size * 1.9)
            const lp = ease(clamp((p - 0.85) / 0.15, 0, 1))
            return (
              <g key={`l${a.i}`} opacity={(hov >= 0 && hov !== a.i ? 0.35 : 1) * lp} style={{ pointerEvents: 'none' }}>
                <path d={arrowD(sd + a.i * 9, tx - l.side * 4, l.y, ex, ey, { ...o, doubleStroke: false }, l.side * 0.2)} fill="none" stroke={a.c} strokeWidth={strokeWidth * 0.85} strokeLinecap="round" />
                <text x={tx + l.side * 2} y={l.y} dy="0.34em" textAnchor={l.side > 0 ? 'start' : 'end'} fontSize={size * 1.02} fontWeight="700" fill={inkColor}>{pct(a.v)}</text>
              </g>
            )
          })}
          {r0 > size * 2.2 && (
            <g style={{ pointerEvents: 'none' }} opacity={ease(clamp((p - 0.6) / 0.3, 0, 1))}>
              <path d={sketchEllipse(sd + 500, cx, cy, r0 * 0.72, r0 * 0.55, o)} fill="none" stroke={hov >= 0 ? arcs[hov].c : inkColor} strokeWidth={strokeWidth} />
              <text x={cx} y={cy} dy="0.1em" textAnchor="middle" fontSize={Math.min(size * 1.7, r0 * 0.45)} fontWeight="700" fill={inkColor}>{hov >= 0 ? pct(arcs[hov].v) : total}</text>
              <text x={cx} y={cy} dy="1.2em" textAnchor="middle" fontSize={Math.min(size * 0.95, r0 * 0.25)} fill={mutedInk}>{hov >= 0 ? arcs[hov].label : centerLabel}</text>
            </g>
          )}
        </svg>
        {legendW > 0 && (
          <div role="list" style={{ width: legendW, display: 'grid', gap: '0.25em', paddingLeft: '0.6em', fontSize: '1.08em' }}>
            {arcs.map((a) => (
              <div key={a.i} role="listitem" onMouseEnter={() => setHov(a.i)} onMouseLeave={() => setHov(-1)} style={{ display: 'grid', gridTemplateColumns: '20px 1fr auto', alignItems: 'center', gap: '0.45em', opacity: hov >= 0 && hov !== a.i ? 0.4 : 1, transition: 'opacity .2s' }}>
                <svg width="18" height="14" viewBox="0 0 18 14" aria-hidden style={{ overflow: 'visible' }}>
                  <SketchFill id={`${uid}lg${a.i}`} clip="M2,2H16V12H2Z" box={{ x: 0, y: 0, w: 18, h: 14 }} color={a.c} o={{ ...o, hachureGap: 3.2 }} seed={sd + a.i * 5} angle={hachureAngle + (a.i % 2 ? 70 : 0)} />
                  <path d={sketchRect(sd + a.i, 2, 2, 14, 10, { ...o, roughness: roughness * 0.6 })} fill="none" stroke={inkColor} strokeWidth="1.2" />
                </svg>
                <span style={{ position: 'relative' }}>
                  {hov === a.i && <span style={{ position: 'absolute', left: -3, right: -3, bottom: 1, height: '0.5em', background: `${a.c}55`, transform: 'skew(-12deg)', borderRadius: 2 }} />}
                  <span style={{ position: 'relative' }}>{a.label}</span>
                </span>
                <b>{pct(a.v)}</b>
              </div>
            ))}
          </div>
        )}
      </div>
    </Paper>
  )
}
