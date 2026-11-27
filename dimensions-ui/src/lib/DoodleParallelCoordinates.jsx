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

// Doodle parallel coordinates: ruled pen axes, one per measure, and one quick pencil
// stroke per item across them. Drag up or down on any axis to bracket a range and
// filter (drag several axes to combine; click an axis to clear it). Lines are shaded
// along one measure. Rows are "Name:v|v|v" with `dimensions` naming the axes, or leave
// `data` empty for a seeded demo of cars.
export default function DoodleParallelCoordinates({
  data = '',
  dimensions = 'Price, Power, Weight, Efficiency, Range, Rating',
  count = 60,
  seed = 9,
  title = 'Electric car models',
  subtitle = 'Drag on any axis to filter',
  colorBy = 'Range',
  curved = true,
  lineOpacity = 0.55,
  brushable = true,
  roughness = 1.2,
  bowing = 1,
  fillStyle = 'hachure',
  hachureGap = 4,
  hachureAngle = -41,
  strokeWidth = 1.4,
  doubleStroke = true,
  boil = false,
  drawOn = true,
  duration = 2200,
  tooltip = true,
  paper = 'grid',
  tilt = -0.3,
  width = 760,
  height = 300,
  size = 15,
  font = HAND,
  color = '#e4572e',
  color2 = '#2e86ab',
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
  const dims = splitNames(dimensions)
  const rows = useMemo(() => {
    if (String(data ?? '').trim()) return parseRows(data).map((r) => ({ label: r.label, v: dims.map((_, k) => r.values[k] ?? 0) }))
    let s = Math.round(seed) * 7919 + 13
    const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280)
    const g = () => (r() + r() + r() - 1.5) / 0.5
    return Array.from({ length: Math.round(count) }, (_, i) => {
      const size_ = g()
      const tech = g()
      const vals = [38 + size_ * 14 + tech * 8, 220 + size_ * 90 + tech * 40, 1900 + size_ * 380, 17 - size_ * 2.2 + tech * 1.4, 380 + tech * 70 + size_ * 30, 3.9 + tech * 0.4 + r() * 0.3]
      return { label: `Model ${String.fromCharCode(65 + (i % 26))}${Math.floor(i / 26) + 1}`, v: dims.map((_, k) => +(vals[k % vals.length] * (1 + (r() - 0.5) * 0.06)).toFixed(1)) }
    })
  }, [data, dimensions, count, seed]) // eslint-disable-line react-hooks/exhaustive-deps
  const D = dims.length
  const ranges = dims.map((_, k) => niceRange(Math.min(...rows.map((r) => r.v[k])), Math.max(...rows.map((r) => r.v[k])), 4))
  const ck = Math.max(0, dims.indexOf(colorBy))
  const p = useReveal(drawOn, duration, `${data}|${count}|${seed}`)
  const [brush, setBrush] = useState({}) // axis -> [lo, hi] in values
  const [drag, setDrag] = useState(null)
  const [hov, setHov] = useState(-1)
  const [tip, setTip] = useState(null)

  const W = Math.max(300, (boxW || width) - size * 2.8)
  const H = height
  const m = { l: size * 1.6, r: size * 1.6, t: size * 2.3, b: size * 0.8 }
  const pw = W - m.l - m.r
  const ph = H - m.t - m.b
  const X = (k) => m.l + (D > 1 ? (k / (D - 1)) * pw : pw / 2)
  const Y = (k, v) => m.t + ph - ((v - ranges[k].lo) / (ranges[k].hi - ranges[k].lo || 1)) * ph
  const V = (k, y) => ranges[k].lo + ((m.t + ph - y) / ph) * (ranges[k].hi - ranges[k].lo)
  const lineColor = (r) => mix(color2, color, (r.v[ck] - ranges[ck].lo) / (ranges[ck].hi - ranges[ck].lo || 1))
  const passes = (r) => Object.entries(brush).every(([k, [a, b]]) => r.v[k] >= a && r.v[k] <= b)
  // one cheap pencil stroke per item: jittered points, single pass
  const strokeOf = (r, i) => {
    const rr = srng(sd + i * 17)
    const j = () => (rr() - 0.5) * roughness * 2.2
    const P = r.v.map((v, k) => [X(k), Y(k, v) + j()])
    let d = `M${f1(P[0][0])},${f1(P[0][1])}`
    for (let k = 1; k < P.length; k++) {
      const mx = (P[k - 1][0] + P[k][0]) / 2
      if (curved) d += `C${f1(mx + j() * 3)},${f1(P[k - 1][1] + j())} ${f1(mx + j() * 3)},${f1(P[k][1] + j())} ${f1(P[k][0])},${f1(P[k][1])}`
      else d += `Q${f1(mx + j())},${f1((P[k - 1][1] + P[k][1]) / 2 + j() * bowing * 1.5)} ${f1(P[k][0])},${f1(P[k][1])}`
    }
    return d
  }
  const paths = useMemo(() => rows.map(strokeOf), [rows, W, H, sd, roughness, bowing, curved]) // eslint-disable-line react-hooks/exhaustive-deps
  const local = (e) => { const b = svgRef.current.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top] }
  const shown = rows.filter(passes).length
  const axisP = ease(clamp(p / 0.25, 0, 1))
  const draw = (k) => ({ pathLength: 1, strokeDasharray: 1, strokeDashoffset: 1 - k })
  const lp = (i) => ease(clamp((p - 0.18 - ((i * 7) % rows.length) / Math.max(1, rows.length) * 0.3) / 0.52, 0, 1))

  // a bracket "[ ]" round a range on an axis, with hatching between
  const bracket = (k, ya, yb, live) => {
    const x = X(k)
    const y0 = Math.min(ya, yb)
    const y1 = Math.max(ya, yb)
    const w = 9
    const lo2 = { ...o, doubleStroke: false, roughness: roughness * 0.5 }
    return (
      <g style={{ pointerEvents: 'none' }} opacity={live ? 0.75 : 1}>
        <SketchFill id={`${uid}b${k}${live ? 'l' : ''}`} clip={`M${x - w + 2},${y0}h${2 * w - 4}v${y1 - y0}h${-(2 * w - 4)}Z`} box={{ x: x - w, y: y0, w: 2 * w, h: y1 - y0 }} color={inkColor} o={o} seed={sd + k * 5} angle={hachureAngle} opacity={0.28} />
        <path d={sketchPoly(sd + k * 9, [[x - w + 4, y0], [x - w, y0], [x - w, y1], [x - w + 4, y1]], lo2, false) + sketchPoly(sd + k * 9 + 1, [[x + w - 4, y0], [x + w, y0], [x + w, y1], [x + w - 4, y1]], lo2, false)} fill="none" stroke={inkColor} strokeWidth={strokeWidth * 1.3} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={live ? '4 3' : undefined} />
      </g>
    )
  }

  return (
    <Paper wrapRef={(el) => { wrap.current = el; boxRef.current = el }} {...{ width, paper, paperColor, inkColor, mutedInk, size, font, tilt, title, subtitle, tip, accent: color }}
      legend={
        <div style={{ fontSize: '1.08em', color: mutedInk, textAlign: 'right', paddingTop: '0.3em' }}>
          <b style={{ color: inkColor, fontSize: '1.2em' }}>{shown}</b>{` of ${rows.length} shown`}
          {Object.keys(brush).length > 0 && <button type="button" onClick={() => setBrush({})} style={{ marginLeft: '0.7em', font: 'inherit', color: inkColor, background: '#f2c94c55', border: `1.6px solid ${inkColor}`, borderRadius: '255px 15px 225px 15px / 15px 225px 15px 255px', padding: '0.05em 0.7em', cursor: 'pointer' }}>clear filters</button>}
        </div>
      }
    >
      <svg ref={svgRef} width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}. Hand-drawn parallel coordinates of ${rows.length} items across ${dims.join(', ')}.`} style={{ display: 'block', maxWidth: '100%', overflow: 'visible', userSelect: 'none', touchAction: 'none' }}
        onPointerMove={(e) => { if (!drag) return; const [, y] = local(e); setDrag({ ...drag, y1: clamp(y, m.t, m.t + ph) }) }}
        onPointerUp={() => {
          if (!drag) return
          const { k, y0, y1 } = drag
          setBrush((b) => { const nb = { ...b }; if (Math.abs(y1 - y0) < 4) delete nb[k]; else nb[k] = [Math.min(V(k, y0), V(k, y1)), Math.max(V(k, y0), V(k, y1))]; return nb })
          setDrag(null)
        }}
        onPointerLeave={() => { setDrag(null); setHov(-1); setTip(null) }}
      >
        {/* filtered-out lines: faint pencil */}
        {rows.map((r, i) => (passes(r) ? null : <path key={`o${i}`} d={paths[i]} fill="none" stroke={mutedInk} strokeOpacity="0.13" strokeWidth="1" {...draw(lp(i))} />))}
        {rows.map((r, i) => {
          if (!passes(r)) return null
          const c = lineColor(r)
          return (
            <path key={i} d={paths[i]} fill="none" stroke={c} strokeOpacity={hov < 0 ? lineOpacity : hov === i ? 1 : 0.1} strokeWidth={hov === i ? strokeWidth * 2.2 : strokeWidth} strokeLinecap="round" style={{ transition: 'stroke-opacity .15s' }} {...draw(lp(i))} />
          )
        })}
        {/* wider invisible strokes for hovering */}
        {rows.map((r, i) => (passes(r) ? (
          <path key={`h${i}`} d={paths[i]} fill="none" stroke="transparent" strokeWidth="6"
            onPointerEnter={(e) => { if (drag) return; setHov(i); tooltip && setTip(tipAt(e, wrap, r.label, dims.map((d, k) => ({ label: d, value: String(r.v[k]), color: k === ck ? lineColor(r) : undefined })))) }}
            onPointerMove={(e) => tooltip && !drag && setTip((tp) => (tp ? { ...tp, ...tipAt(e, wrap, tp.title, tp.rows) } : tp))}
            onPointerLeave={() => { setHov(-1); setTip(null) }}
          />
        ) : null))}

        {dims.map((d, k) => {
          const x = X(k)
          const b = brush[k]
          const live = drag && drag.k === k
          const edge = k === D - 1 ? -1 : 1
          return (
            <g key={k}>
              <path d={sketchLine(sd + 400 + k, x, m.t - 4, x, m.t + ph + 4, o)} fill="none" stroke={inkColor} strokeWidth={strokeWidth * 1.2} strokeLinecap="round" {...draw(axisP)} />
              {ticksOf(ranges[k]).map((tv, i) => (
                <g key={i} style={{ pointerEvents: 'none' }} opacity={axisP}>
                  <path d={wob(srng(sd + k * 31 + i), x - 4, Y(k, tv), x + 4, Y(k, tv), roughness * 0.4, 0.2)} fill="none" stroke={inkColor} strokeWidth="1.2" strokeLinecap="round" />
                  <text x={x + edge * 7} y={Y(k, tv)} dy="0.34em" textAnchor={edge < 0 ? 'end' : 'start'} fontSize={size * 0.78} fill={mutedInk} stroke={paperColor} strokeWidth="3" paintOrder="stroke">{axisFmt.format(tv)}</text>
                </g>
              ))}
              <g opacity={axisP} style={{ pointerEvents: 'none' }}>
                {k === ck && <path d={sketchLine(sd + 500 + k, x - d.length * size * 0.26, m.t - size * 1.1, x + d.length * size * 0.26, m.t - size * 1.2, { ...o, doubleStroke: false, roughness: roughness * 0.4 })} fill="none" stroke={color} strokeOpacity="0.35" strokeWidth={size * 0.6} strokeLinecap="round" />}
                <text x={x} y={m.t - size * 0.95} textAnchor="middle" fontSize={size * 1.02} fontWeight="700" fill={k === ck ? color : inkColor}>{d}</text>
              </g>
              {b && !live && bracket(k, Y(k, b[1]), Y(k, b[0]), false)}
              {live && Math.abs(drag.y1 - drag.y0) > 1 && bracket(k, drag.y0, drag.y1, true)}
              {brushable && <rect x={x - 12} y={m.t} width="24" height={ph} fill="transparent" style={{ cursor: 'ns-resize' }} onPointerDown={(e) => { e.preventDefault(); const [, y] = local(e); setDrag({ k, y0: y, y1: y }); setTip(null); setHov(-1) }} />}
            </g>
          )
        })}
      </svg>
    </Paper>
  )
}
