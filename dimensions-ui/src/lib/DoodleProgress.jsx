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

// Doodle progress: how far along things are, drawn by hand. Bars are pen outlines
// scribbled in up to the value, rings are pen loops coloured in from 12 o'clock, and a
// finished job gets a big hand-drawn tick. Items are "Label:value|max" (max defaults to
// 100). `variant` picks linear bars, segmented boxes, rings or concentric activity rings.
export default function DoodleProgress({
  data = 'Uploading assets:72, Processing video:38, Writing captions:12|20, Publishing:100',
  title = 'Release pipeline',
  subtitle = '4 jobs running',
  variant = 'linear',
  thickness = 14,
  segments = 12,
  gradient = true,
  striped = false,
  glow = true,
  indeterminate = false,
  showValues = true,
  valueMode = 'percent',
  doneCheck = true,
  colorMode = 'palette',
  roughness = 1.2,
  bowing = 1,
  fillStyle = 'hachure',
  hachureGap = 5,
  hachureAngle = -41,
  strokeWidth = 1.8,
  doubleStroke = true,
  boil = false,
  drawOn = true,
  duration = 1800,
  seed = 12,
  paper = 'grid',
  tilt = -0.5,
  width = 540,
  size = 15,
  font = HAND,
  color = '#e4572e',
  color2 = '#2e86ab',
  color3 = '#f2a541',
  color4 = '#9b5de5',
  doneColor = '#3bb273',
  paperColor = '#fbf8f1',
  inkColor = '#2b2b2b',
  mutedInk = '#77736b',
}) {
  const uid = useId().replace(/:/g, '')
  const [boxRef, boxW] = useWidth()
  const tb = useBoil(boil)
  const sd = seed * 61 + tb * 13
  const o = { roughness, bowing, fillStyle, hachureGap, hachureAngle, strokeWidth, doubleStroke }
  const items = useMemo(() => parseRows(data).map((r) => { const mx = r.values[1] > 0 ? r.values[1] : 100; const v = clamp(r.values[0] ?? 0, 0, mx); return { label: r.label, v, mx, f: v / mx } }), [data])
  const p = useReveal(drawOn, duration, `${data}|${variant}`)
  const [hov, setHov] = useState(-1)
  const pal = [color, color2, color3, color4]
  const colorOf = (it, i) => (it.f >= 1 ? doneColor : colorMode === 'single' ? color : colorMode === 'by value' ? mix(color, doneColor, it.f * 0.6) : pal[i % 4])
  const valText = (it) => (valueMode === 'fraction' ? `${Math.round(it.v * ease(p))} / ${it.mx}` : `${Math.round(it.f * 100 * ease(p))}%`)
  // useWidth's ResizeObserver reports the paper's content box, i.e. already without padding
  const W = Math.max(220, (boxW || width) - size * 2.8)
  const t = clamp(thickness, 3, 40)
  const draw = (k) => ({ pathLength: 1, strokeDasharray: 1, strokeDashoffset: 1 - k })
  const axisP = ease(clamp(p / 0.3, 0, 1))
  const fade = (i) => ({ opacity: hov >= 0 && hov !== i ? 0.4 : 1, transition: 'opacity .2s' })
  // a big hand tick: one stroke down, one long stroke up
  const tick = (s, i, k = 1) => (
    <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden style={{ flex: 'none', overflow: 'visible' }}>
      <path d={sketchCurve(sd + 700 + i, [[2, 13], [6, 16], [9, 21], [14, 11], [23, 2]], { ...o, roughness: roughness * 0.5 })} fill="none" stroke={doneColor} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" {...draw(k)} />
    </svg>
  )
  // hatch period along x, so a marching scribble loops cleanly
  const gap = Math.max(2.5, hachureGap)
  const sinA = Math.abs(Math.sin((hachureAngle * Math.PI) / 180))
  const per = sinA < 0.2 ? 24 : (gap / sinA) * 2
  const css = `
    @keyframes ${uid}m{from{transform:translateX(0)}to{transform:translateX(${f1(per)}px)}}
    @keyframes ${uid}i{0%{transform:translateX(${f1(-W * 0.45)}px)}100%{transform:translateX(${f1(W * 1.05)}px)}}
    @keyframes ${uid}r{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
    @media (prefers-reduced-motion:reduce){.${uid}a{animation:none!important}}
  `

  // ---- rings: one per item side by side, or concentric for "activity" ----
  if (variant === 'ring' || variant === 'activity') {
    const activity = variant === 'activity'
    const n = items.length
    const D = activity ? Math.min(W * 0.5, 230) : Math.min(140, (W - (n - 1) * 16) / Math.max(1, n))
    const c0 = D / 2
    // a = 0 is 12 o'clock, growing clockwise; no transforms needed
    const pt = (a, r) => [c0 + Math.sin(a) * r, c0 - Math.cos(a) * r]
    const arcPts = (a0, a1, r, step) => { const k = Math.max(1, Math.ceil(Math.abs(a1 - a0) / step)); return Array.from({ length: k + 1 }, (_, j) => pt(a0 + ((a1 - a0) * j) / k, r)) }
    const sector = (a1, r0, r1, step) => [...arcPts(0, a1, r1, step), ...arcPts(a1, 0, r0, step)]
    const poly = (pts) => 'M' + pts.map((q) => q.map(f1).join(',')).join('L') + 'Z'
    const ring = (it, i, k, gi) => {
      const rm = D / 2 - t / 2 - 4 - (activity ? k * (t + 6) : 0)
      if (rm < t) return null
      const r0 = rm - t / 2
      const r1 = rm + t / 2
      const c = colorOf(it, i)
      const spin = indeterminate && it.f < 1
      const fr = spin ? 0.28 : it.f * ease(clamp((p - 0.15 - k * 0.1) / 0.75, 0, 1))
      const A = Math.PI * 2 * Math.min(fr, 0.9999)
      const box = { x: c0 - r1, y: c0 - r1, w: 2 * r1, h: 2 * r1 }
      const sk = sd + (gi * 7 + k) * 29
      const full = fr >= 0.999
      return (
        <g key={k} style={fade(i)} onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(-1)}>
          <path d={sketchEllipse(sk, c0, c0, r1, r1, { ...o, doubleStroke: false }) + sketchEllipse(sk + 3, c0, c0, r0, r0, { ...o, doubleStroke: false })} fill="none" stroke={mutedInk} strokeOpacity="0.4" strokeWidth="1" {...draw(axisP)} />
          {fr > 0.004 && (
            <g className={spin ? `${uid}a` : undefined} style={spin ? { animation: `${uid}r 1.1s linear infinite`, transformBox: 'view-box', transformOrigin: `${c0}px ${c0}px` } : undefined}>
              {glow && <path d={'M' + arcPts(0, A, rm, 0.08).map((q) => q.map(f1).join(',')).join('L')} fill="none" stroke={c} strokeOpacity="0.16" strokeWidth={t + 7} strokeLinecap="round" />}
              <SketchFill id={`${uid}r${gi}-${k}`} clip={poly(sector(A, r0, r1, 0.04))} box={box} color={c} o={{ ...o, hachureGap: Math.max(2.5, Math.min(hachureGap, t * 0.45)) }} seed={sk + 5} angle={hachureAngle + k * 50} />
              <path d={full ? sketchEllipse(sk + 7, c0, c0, r1, r1, o) + sketchEllipse(sk + 8, c0, c0, r0, r0, o) : sketchPoly(sk + 9, sector(A, r0, r1, 0.22), { ...o, roughness: roughness * 0.45 })} fill="none" stroke={inkColor} strokeWidth={hov === i ? strokeWidth * 1.4 : strokeWidth * 0.9} strokeLinejoin="round" strokeLinecap="round" />
            </g>
          )}
        </g>
      )
    }
    return (
      <Paper wrapRef={(el) => (boxRef.current = el)} {...{ width, paper, paperColor, inkColor, mutedInk, size, font, tilt, title, subtitle, accent: color }}>
        <style>{css}</style>
        <div style={{ display: 'flex', alignItems: 'center', gap: activity ? '1.6em' : '1em', flexWrap: 'wrap', justifyContent: activity ? 'flex-start' : 'space-around' }}>
          {(activity ? [items] : items.map((it) => [it])).map((group, gi) => {
            const it0 = group[0]
            const done = !activity && it0.f >= 1 && doneCheck
            // long labels under a ring break onto two lines
            const words = it0.label.split(' ')
            const half = Math.ceil(words.length / 2)
            const lines = !activity && it0.label.length * size * 0.48 > D && words.length > 1 ? [words.slice(0, half).join(' '), words.slice(half).join(' ')] : [it0.label]
            const SH = activity ? D : D + size * (0.5 + lines.length * 1.1)
            return (
              <svg key={gi} width={D} height={SH} viewBox={`0 0 ${D} ${SH}`} role="img" aria-label={group.map((it) => `${it.label}: ${Math.round(it.f * 100)} percent`).join('; ')} style={{ display: 'block', overflow: 'visible', flex: 'none' }}>
                {group.map((it, k) => ring(it, activity ? k : gi, k, gi))}
                {!activity && (
                  <g style={{ pointerEvents: 'none' }}>
                    {done ? (
                      <g transform={`translate(${c0 - D * 0.16} ${c0 - D * 0.17}) scale(${(D * 0.32) / 24})`}>
                        <path d={sketchCurve(sd + 700 + gi, [[2, 13], [6, 16], [9, 21], [14, 11], [23, 2]], { ...o, roughness: roughness * 0.5 })} fill="none" stroke={doneColor} strokeWidth={3.2 * (24 / (D * 0.3))} strokeLinecap="round" strokeLinejoin="round" {...draw(ease(clamp((p - 0.7) / 0.3, 0, 1)))} />
                      </g>
                    ) : (
                      <text x={c0} y={c0} dy="0.36em" textAnchor="middle" fontSize={Math.min(size * 1.8, D * 0.22)} fontWeight="700" fill={inkColor}>{indeterminate && it0.f < 1 ? '…' : valText(it0)}</text>
                    )}
                    {lines.map((ln, li) => <text key={li} x={c0} y={D + size * (1.1 + li * 1.1)} textAnchor="middle" fontSize={size} fill={it0.f >= 1 ? inkColor : mutedInk}>{ln}</text>)}
                  </g>
                )}
              </svg>
            )
          })}
          {activity && (
            <div role="list" style={{ display: 'grid', gap: '0.5em', flex: 1, minWidth: '10em', fontSize: '1.1em' }}>
              {items.map((it, i) => {
                const c = colorOf(it, i)
                return (
                  <div key={i} role="listitem" onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(-1)} style={{ display: 'flex', alignItems: 'center', gap: '0.5em', ...fade(i) }}>
                    <svg width="18" height="14" viewBox="0 0 18 14" aria-hidden style={{ overflow: 'visible', flex: 'none' }}>
                      <SketchFill id={`${uid}lg${i}`} clip="M2,2H16V12H2Z" box={{ x: 0, y: 0, w: 18, h: 14 }} color={c} o={{ ...o, hachureGap: 3.2 }} seed={sd + i * 5} angle={hachureAngle + i * 50} />
                      <path d={sketchRect(sd + i, 2, 2, 14, 10, { ...o, roughness: roughness * 0.6 })} fill="none" stroke={inkColor} strokeWidth="1.2" />
                    </svg>
                    <span style={{ flex: 1, color: it.f >= 1 ? inkColor : mutedInk }}>{it.label}</span>
                    {it.f >= 1 && doneCheck ? tick(size * 1.4, i, ease(clamp((p - 0.7) / 0.3, 0, 1))) : showValues && <b style={{ fontVariantNumeric: 'tabular-nums' }}>{indeterminate ? '…' : valText(it)}</b>}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </Paper>
    )
  }

  // ---- linear and segmented bars ----
  const segN = clamp(Math.round(segments), 3, 40)
  const x0 = 2
  const y0 = 4
  const bw = W - 4
  return (
    <Paper wrapRef={(el) => (boxRef.current = el)} {...{ width, paper, paperColor, inkColor, mutedInk, size, font, tilt, title, subtitle, accent: color }}>
      <style>{css}</style>
      <div role="list" style={{ display: 'grid', gap: '0.75em' }}>
        {items.map((it, i) => {
          const c = colorOf(it, i)
          const ip = ease(clamp((p - 0.1 - i * 0.08) / 0.7, 0, 1))
          const done = it.f >= 1
          const ind = indeterminate && !done
          const fw = bw * it.f * ip
          const sk = sd + i * 37
          const fillC = gradient && variant !== 'segmented' ? `url(#${uid}g${i})` : c
          const barClip = `M${x0},${y0}h${bw}v${t}h${-bw}Z`
          return (
            <div key={i} role="listitem" onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(-1)} style={fade(i)}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5em', marginBottom: '0.15em', fontSize: '1.08em', minHeight: '1.4em' }}>
                <span style={{ flex: 1, color: done ? inkColor : mutedInk, fontWeight: done ? 700 : 400 }}>{it.label}</span>
                {done && doneCheck ? tick(size * 1.7, i, ease(clamp((ip - 0.6) / 0.4, 0, 1))) : showValues && <b style={{ fontVariantNumeric: 'tabular-nums', color: ind ? mutedInk : inkColor }}>{ind ? 'working…' : valText(it)}</b>}
              </div>
              <svg
                width={W}
                height={t + 8}
                viewBox={`0 0 ${W} ${t + 8}`}
                role="progressbar"
                aria-label={it.label}
                aria-valuemin={0}
                aria-valuemax={it.mx}
                aria-valuenow={ind ? undefined : it.v}
                style={{ display: 'block', overflow: 'visible' }}
              >
                <defs>
                  <linearGradient id={`${uid}g${i}`} gradientUnits="userSpaceOnUse" x1={x0} y1="0" x2={x0 + Math.max(1, fw)} y2="0">
                    <stop offset="0" stopColor={mix(c, paperColor, 0.55)} />
                    <stop offset="1" stopColor={c} />
                  </linearGradient>
                  <clipPath id={`${uid}c${i}`}><path d={barClip} /></clipPath>
                </defs>
                {variant === 'segmented' ? (
                  Array.from({ length: segN }, (_, k) => {
                    const sw = (bw - (segN - 1) * 4) / segN
                    const sx = x0 + k * (sw + 4)
                    const fp = it.f * ip
                    const on = (k + 1) / segN <= fp + 1e-9 || (k / segN < fp && (k + 1) / segN > fp)
                    return (
                      <g key={k}>
                        {on && glow && <rect x={sx - 2} y={y0 - 2} width={sw + 4} height={t + 4} rx="3" fill={c} opacity="0.14" />}
                        {on && <SketchFill id={`${uid}s${i}-${k}`} clip={`M${sx},${y0}h${sw}v${t}h${-sw}Z`} box={{ x: sx, y: y0, w: sw, h: t }} color={c} o={o} seed={sk + k * 3} angle={hachureAngle + (k % 2) * 12} />}
                        <path d={sketchRect(sk + k, sx, y0, sw, t, { ...o, roughness: roughness * 0.6, doubleStroke: false })} fill="none" stroke={on ? inkColor : mutedInk} strokeOpacity={on ? 1 : 0.5} strokeWidth={on ? strokeWidth * 0.85 : 1} strokeLinejoin="round" {...draw(axisP)} />
                      </g>
                    )
                  })
                ) : ind ? (
                  <g clipPath={`url(#${uid}c${i})`}>
                    <g className={`${uid}a`} style={{ animation: `${uid}i 1.4s ease-in-out infinite`, transformBox: 'view-box' }}>
                      <clipPath id={`${uid}k${i}`}><rect x={x0} y={y0} width={bw * 0.4} height={t} rx={t / 2} /></clipPath>
                      <g clipPath={`url(#${uid}k${i})`}>
                        <path d={hatchD(sk + 1, { x: x0, y: y0, w: bw * 0.4, h: t }, o, hachureAngle, gap)} fill="none" stroke={c} strokeWidth={strokeWidth * 0.85} strokeLinecap="round" />
                      </g>
                    </g>
                  </g>
                ) : (
                  fw > 0.5 && (
                    <g>
                      {glow && <path d={`M${x0 + t / 2},${y0 + t / 2}H${Math.max(x0 + t / 2, x0 + fw - t / 2)}`} stroke={c} strokeOpacity="0.16" strokeWidth={t + 7} strokeLinecap="round" />}
                      {striped && !done ? (
                        <>
                          <clipPath id={`${uid}f${i}`}><path d={`M${x0},${y0}h${fw}v${t}h${-fw}Z`} /></clipPath>
                          <g clipPath={`url(#${uid}f${i})`}>
                            <path className={`${uid}a`} d={hatchD(sk + 2, { x: x0 - per * 2, y: y0, w: bw + per * 2, h: t }, o, hachureAngle, gap)} fill="none" stroke={fillC} strokeWidth={strokeWidth * 0.95} strokeLinecap="round" style={{ animation: `${uid}m .9s linear infinite` }} />
                          </g>
                        </>
                      ) : (
                        <SketchFill id={`${uid}f${i}`} clip={`M${x0},${y0}h${fw}v${t}h${-fw}Z`} box={{ x: x0, y: y0, w: bw, h: t }} color={fillC} o={o} seed={sk + 2} angle={hachureAngle + i * 9} />
                      )}
                      {/* the pen line where the scribble stops */}
                      {!done && <path d={sketchLine(sk + 4, x0 + fw, y0 - 3, x0 + fw, y0 + t + 3, { ...o, doubleStroke: false })} fill="none" stroke={inkColor} strokeWidth={strokeWidth} strokeLinecap="round" />}
                    </g>
                  )
                )}
                {variant !== 'segmented' && <path d={sketchRect(sk + 6, x0, y0, bw, t, { ...o, roughness: roughness * 0.7 })} fill="none" stroke={inkColor} strokeWidth={hov === i ? strokeWidth * 1.4 : strokeWidth} strokeLinejoin="round" strokeLinecap="round" {...draw(axisP)} />}
              </svg>
            </div>
          )
        })}
      </div>
    </Paper>
  )
}
