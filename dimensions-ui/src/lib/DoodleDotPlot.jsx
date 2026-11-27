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

// Doodle dot plot: the Cleveland dot plot drawn by hand. The first value is an open pen
// circle, later values are scribble-filled, a wavy pencil connector joins them and the
// change is written in the margin as "+16" beside a little arrow. Rows are "Label:a|b".
const dotCirc = (cx, cy, r) => `M${f1(cx - r)},${f1(cy)}a${f1(r)},${f1(r)} 0 1 0 ${f1(r * 2)},0a${f1(r)},${f1(r)} 0 1 0 ${f1(-r * 2)},0Z`
// a gently waving line from a to b (a few points for sketchCurve)
function dotWave(x1, y1, x2, y2, amp) {
  const len = Math.hypot(x2 - x1, y2 - y1)
  if (len < 2) return [[x1, y1], [x2, y2]]
  const ux = (x2 - x1) / len
  const uy = (y2 - y1) / len
  const k = Math.max(2, Math.round(len / 16))
  return Array.from({ length: k + 1 }, (_, j) => {
    const f = j / k
    const w = Math.sin(f * Math.PI * k * 0.5) * amp * (j === 0 || j === k ? 0 : 1)
    return [x1 + (x2 - x1) * f - uy * w, y1 + (y2 - y1) * f + ux * w]
  })
}

export default function DoodleDotPlot({
  data = 'Berlin:62|78, Lisbon:48|71, Toronto:71|74, Austin:55|69, Osaka:80|77, Nairobi:34|58, Lima:41|52',
  series = '2022, 2024',
  title = 'Remote-work adoption',
  subtitle = 'Share of workforce, 2022 vs 2024',
  orientation = 'horizontal',
  sort = 'diff',
  zeroBased = false,
  connector = true,
  showGuides = true,
  showDiff = true,
  showValues = false,
  showGrid = true,
  showAxis = true,
  showLegend = true,
  dotSize = 7,
  connectorWidth = 3,
  ringed = false,
  tooltip = true,
  valueFormat = 'number',
  decimals = 0,
  prefix = '',
  suffix = '%',
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
  seed = 12,
  paper = 'grid',
  tilt = -0.5,
  width = 680,
  height = 300,
  size = 15,
  font = HAND,
  color = '#2e86ab',
  color2 = '#e4572e',
  color3 = '#9b5de5',
  upColor = '#3bb273',
  downColor = '#f15bb5',
  paperColor = '#fbf8f1',
  inkColor = '#2b2b2b',
  mutedInk = '#77736b',
}) {
  const uid = useId().replace(/:/g, '')
  const wrap = useRef(null)
  const [boxRef, boxW] = useWidth()
  const t = useBoil(boil)
  const sd = seed * 73 + t * 13
  const o = { roughness, bowing, fillStyle, hachureGap, hachureAngle, strokeWidth, doubleStroke }
  const fmt = makeFmt({ valueFormat, decimals, prefix, suffix })
  const rows0 = useMemo(() => parseRows(data), [data])
  const S = Math.max(1, ...rows0.map((r) => r.values.length))
  const names = splitNames(series)
  const sName = (s) => names[s] ?? `Series ${s + 1}`
  const pal = [color, color2, color3]
  const rows = useMemo(() => {
    const r = rows0.map((x) => {
      const v = Array.from({ length: S }, (_, s) => x.values[s] ?? 0)
      return { label: x.label, v, diff: v[S - 1] - v[0] }
    })
    if (sort === 'label') r.sort((a, b) => a.label.localeCompare(b.label))
    else if (sort === 'first') r.sort((a, b) => b.v[0] - a.v[0])
    else if (sort === 'last') r.sort((a, b) => b.v[S - 1] - a.v[S - 1])
    else if (sort === 'diff') r.sort((a, b) => b.diff - a.diff)
    return r
  }, [rows0, S, sort])
  const p = useReveal(drawOn, duration, `${data}|${orientation}|${sort}|${zeroBased}`)
  const [hov, setHov] = useState(null)
  const [hovS, setHovS] = useState(null)
  const [tip, setTip] = useState(null)

  const horizontal = orientation === 'horizontal'
  const n = rows.length
  const all = rows.flatMap((r) => r.v)
  const lo0 = zeroBased ? 0 : Math.min(...all)
  const hi0 = Math.max(...all)
  const pad = zeroBased ? 0 : (hi0 - lo0) * 0.08
  const sc = niceRange(zeroBased ? 0 : lo0 - pad, hi0 + pad)
  const ticks = ticksOf(sc)
  const W = Math.max(260, (boxW || width) - size * 2.8)
  const H = height
  const maxLab = Math.min(18, Math.max(1, ...rows.map((r) => r.label.length)))
  const tl = ticks.map((v) => prefix + axisFmt.format(v) + suffix)
  const chip = showDiff && S > 1
  const m = horizontal
    ? { l: maxLab * size * 0.5 + 16, r: chip ? size * 4.4 : 18, t: 6, b: showAxis ? size * 1.9 : 8 }
    : { l: showAxis ? Math.max(...tl.map((s) => s.length)) * size * 0.5 + 16 : 8, r: 10, t: chip ? size * 2.4 : 12, b: size * 2.3 }
  const pw = Math.max(40, W - m.l - m.r)
  // vertical: if any label is too wide for its column, slant them all and make room below
  const rot = !horizontal && maxLab * size * 0.5 > pw / Math.max(1, n) - 4
  if (rot) m.b += maxLab * size * 0.5 * 0.57
  const ph = Math.max(40, H - m.t - m.b)
  const band = (horizontal ? ph : pw) / Math.max(1, n)
  const along = (v) => (horizontal ? pw : ph) * ((v - sc.lo) / (sc.hi - sc.lo))
  const X = (v) => m.l + along(v)
  const Y = (v) => m.t + ph - along(v)
  const dot = (v, i) => ({ cx: horizontal ? X(v) : m.l + i * band + band / 2, cy: horizontal ? m.t + i * band + band / 2 : Y(v) })
  const dim = (i) => (hov !== null && hov !== i ? 0.28 : 1)
  const axisP = ease(clamp(p / 0.25, 0, 1))
  const draw = (k) => ({ pathLength: 1, strokeDasharray: 1, strokeDashoffset: 1 - k })
  const thin = { ...o, doubleStroke: false, roughness: roughness * 0.5 }

  const showTip = (e, row) =>
    tooltip &&
    setTip(tipAt(e, wrap, row.label, [
      ...row.v.map((v, s) => ({ color: pal[s % 3], label: sName(s), value: fmt(v) })),
      ...(S > 1 ? [{ label: 'change', value: `${row.diff >= 0 ? '+' : '−'}${fmt(Math.abs(row.diff))}` }] : []),
    ]))

  return (
    <Paper
      wrapRef={(el) => { wrap.current = el; boxRef.current = el }}
      {...{ width, paper, paperColor, inkColor, mutedInk, size, font, tilt, title, subtitle, tip, accent: color2 }}
      legend={showLegend && S > 1 ? <DoodleLegend items={Array.from({ length: S }, (_, s) => ({ label: sName(s), color: pal[s % 3] }))} onHover={setHovS} o={o} inkColor={inkColor} seed={seed * 29} /> : null}
    >
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}. Hand-drawn dot plot. ${rows.map((r) => `${r.label}: ${r.v.map((v, s) => `${sName(s)} ${fmt(v)}`).join(', ')}`).join('; ')}`} style={{ display: 'block', maxWidth: '100%', overflow: 'visible' }} onMouseLeave={() => { setHov(null); setTip(null) }}>
        {/* pencil grid, tick labels and the value axis in pen */}
        {ticks.map((v, k) => {
          const g = horizontal ? X(v) : Y(v)
          return (
            <g key={k}>
              {showGrid && <path d={horizontal ? sketchLine(sd + k, g, m.t + 2, g, m.t + ph - 2, thin) : sketchLine(sd + k, m.l + 2, g, m.l + pw - 2, g, thin)} fill="none" stroke={inkColor} strokeOpacity="0.15" strokeWidth="1" {...draw(axisP)} />}
              {showAxis && (horizontal
                ? <text x={g} y={m.t + ph + size * 1.35} textAnchor="middle" fontSize={size * 0.9} fill={mutedInk} opacity={axisP}>{tl[k]}</text>
                : <text x={m.l - 10} y={g} dy="0.34em" textAnchor="end" fontSize={size * 0.9} fill={mutedInk} opacity={axisP}>{tl[k]}</text>)}
            </g>
          )
        })}
        {showAxis && <path d={horizontal ? sketchLine(sd + 40, m.l - 3, m.t + ph, m.l + pw + 3, m.t + ph, o) : sketchLine(sd + 40, m.l, m.t - 3, m.l, m.t + ph + 3, o)} fill="none" stroke={inkColor} strokeWidth={strokeWidth} strokeLinecap="round" {...draw(axisP)} />}

        {rows.map((row, i) => {
          const ip = ease(clamp((p - 0.15 - (i / Math.max(1, n)) * 0.4) / 0.4, 0, 1))
          const mid = (horizontal ? m.t : m.l) + i * band + band / 2
          const first = dot(row.v[0], i)
          const last = dot(row.v[S - 1], i)
          const label = row.label.length > 18 ? row.label.slice(0, 17) + '…' : row.label
          const up = row.diff >= 0
          const dc = row.diff === 0 ? mutedInk : up ? upColor : downColor
          const tight = rot
          const on = hov === i
          const cp = ease(clamp((ip - 0.25) / 0.5, 0, 1))
          return (
            <g key={i} opacity={dim(i)} style={{ transition: 'opacity .2s' }}>
              {showGuides && <path d={horizontal ? sketchLine(sd + i * 5 + 100, m.l + 2, mid, m.l + pw - 2, mid, thin) : sketchLine(sd + i * 5 + 100, mid, m.t + 2, mid, m.t + ph - 2, thin)} fill="none" stroke={inkColor} strokeOpacity="0.14" strokeWidth="1" strokeDasharray="1 5" strokeLinecap="round" opacity={axisP} />}
              {connector && S > 1 && (
                <path d={sketchCurve(sd + i * 11, dotWave(first.cx, first.cy, last.cx, last.cy, Math.max(1.2, connectorWidth * 0.7)), { ...o, doubleStroke: false, roughness: roughness * 0.5 })} fill="none" stroke={mix(pal[0], pal[(S - 1) % 3], 0.5)} strokeWidth={connectorWidth * (on ? 0.85 : 0.6)} strokeLinecap="round" opacity="0.85" {...draw(cp)} />
              )}
              {row.v.map((v, s) => {
                const d = dot(v, i)
                const c = pal[s % 3]
                const sp = ease(clamp((ip - (S > 1 ? (s / (S - 1)) * 0.5 : 0)) / 0.5, 0, 1))
                if (sp <= 0) return null
                const rr = dotSize * (0.5 + 0.5 * sp) * (on ? 1.15 : 1)
                const open = ringed || (s === 0 && S > 1)
                return (
                  <g key={s} opacity={(hovS !== null && hovS !== s ? 0.22 : 1) * sp} style={{ transition: 'opacity .2s' }}>
                    <path d={dotCirc(d.cx, d.cy, rr)} fill={paperColor} />
                    {!open && <SketchFill id={`${uid}d${i}-${s}`} clip={dotCirc(d.cx, d.cy, rr)} box={{ x: d.cx - rr, y: d.cy - rr, w: rr * 2, h: rr * 2 }} color={c} o={{ ...o, hachureGap: Math.max(2.5, hachureGap * 0.45) }} seed={sd + i * 17 + s} angle={hachureAngle + s * 50} />}
                    <path d={sketchEllipse(sd + i * 13 + s * 5, d.cx, d.cy, rr, rr, o)} fill="none" stroke={open ? c : inkColor} strokeWidth={strokeWidth * (open ? 1.2 : 0.9) * (on ? 1.3 : 1)} strokeLinecap="round" />
                    {showValues && (
                      <text x={d.cx} y={horizontal ? d.cy - dotSize - 6 : d.cy + (s === 0 && S > 1 ? dotSize + size : -dotSize - 6)} textAnchor="middle" fontSize={size * 0.82} fontWeight="700" fill={c} style={{ pointerEvents: 'none' }}>
                        {fmt(row.v[s])}
                      </text>
                    )}
                  </g>
                )
              })}
              {horizontal ? (
                <text x={m.l - 10} y={mid} dy="0.34em" textAnchor="end" fontSize={size * 1.02} fill={on ? inkColor : mutedInk} fontWeight={on ? 700 : 400}>{label}</text>
              ) : (
                <text x={mid} y={m.t + ph + size * 1.4} textAnchor={tight ? 'end' : 'middle'} transform={tight ? `rotate(-35 ${mid} ${m.t + ph + size * 1.4})` : undefined} fontSize={size * 1.02} fill={on ? inkColor : mutedInk} fontWeight={on ? 700 : 400}>{label}</text>
              )}
              {chip && ip > 0.6 && (() => {
                const op = ease(clamp((ip - 0.6) / 0.4, 0, 1))
                const ax = horizontal ? m.l + pw + 10 : mid - size * 1.3
                const ay = horizontal ? mid : m.t - size * 1.05
                const hh = size * 0.35
                const arr = row.diff === 0
                  ? sketchLine(sd + i * 3, ax, ay, ax + 10, ay, { ...o, doubleStroke: false })
                  : arrowD(sd + i * 3, ax, ay + (up ? hh : -hh), ax + 10, ay + (up ? -hh : hh), { ...o, doubleStroke: false }, 0.15)
                return (
                  <g opacity={op} style={{ pointerEvents: 'none' }}>
                    <path d={arr} fill="none" stroke={dc} strokeWidth={strokeWidth * 0.85} strokeLinecap="round" />
                    <text x={ax + 15} y={ay} dy="0.34em" fontSize={size * 1.02} fontWeight="700" fill={dc} transform={`rotate(${(srng(sd + i)() - 0.5) * 6} ${ax + 15} ${ay})`}>
                      {row.diff > 0 ? '+' : row.diff < 0 ? '−' : '±'}{fmt(Math.abs(row.diff))}
                    </text>
                  </g>
                )
              })()}
            </g>
          )
        })}

        {rows.map((row, i) => (
          <rect key={i} x={horizontal ? m.l : m.l + i * band} y={horizontal ? m.t + i * band : m.t} width={horizontal ? pw : band} height={horizontal ? band : ph} fill="transparent" onMouseEnter={(e) => { setHov(i); showTip(e, row) }} onMouseMove={(e) => showTip(e, row)} />
        ))}
      </svg>
    </Paper>
  )
}
