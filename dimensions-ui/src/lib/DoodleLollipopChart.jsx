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

// Doodle lollipop chart: the lollipop chart drawn by hand. Each category gets a pencil
// stem and a scribble-filled marker dot, values are written beside the dot, and the
// baseline is a firm pen line. Same data as the Lollipop Chart: "Label:value" rows.
const lolCirc = (cx, cy, r) => `M${f1(cx - r)},${f1(cy)}a${f1(r)},${f1(r)} 0 1 0 ${f1(r * 2)},0a${f1(r)},${f1(r)} 0 1 0 ${f1(-r * 2)},0Z`

export default function DoodleLollipopChart({
  data = 'Rust:84, TypeScript:78, Python:71, Go:66, Kotlin:58, Swift:52, Ruby:41, PHP:33, Perl:19',
  title = 'Developer satisfaction',
  subtitle = 'Share who would use it again',
  orientation = 'horizontal',
  sort = 'desc',
  baseline = 0,
  colorMode = 'by value',
  dotStyle = 'glow',
  stemStyle = 'gradient',
  dotSize = 7,
  stemWidth = 2.5,
  highlightTop = 0,
  showRank = false,
  showValues = true,
  showGrid = true,
  showAxis = true,
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
  duration = 1900,
  seed = 11,
  paper = 'grid',
  tilt = 0.4,
  width = 680,
  height = 300,
  size = 15,
  font = HAND,
  color = '#e4572e',
  color2 = '#2e86ab',
  color3 = '#3bb273',
  color4 = '#f2a541',
  paperColor = '#fbf8f1',
  inkColor = '#2b2b2b',
  mutedInk = '#77736b',
}) {
  const uid = useId().replace(/:/g, '')
  const wrap = useRef(null)
  const [boxRef, boxW] = useWidth()
  const t = useBoil(boil)
  const sd = seed * 79 + t * 13
  const o = { roughness, bowing, fillStyle, hachureGap, hachureAngle, strokeWidth, doubleStroke }
  const fmt = makeFmt({ valueFormat, decimals, prefix, suffix })
  const rows0 = useMemo(() => parseRows(data), [data])
  const rows = useMemo(() => {
    const r = rows0.map((x) => ({ label: x.label, v: x.values[0] ?? 0 }))
    if (sort === 'asc') r.sort((a, b) => a.v - b.v)
    else if (sort === 'desc') r.sort((a, b) => b.v - a.v)
    else if (sort === 'label') r.sort((a, b) => a.label.localeCompare(b.label))
    return r
  }, [rows0, sort])
  const p = useReveal(drawOn, duration, `${data}|${orientation}|${sort}|${baseline}`)
  const [hov, setHov] = useState(null)
  const [tip, setTip] = useState(null)

  const horizontal = orientation === 'horizontal'
  const n = rows.length
  const lo0 = Math.min(baseline, ...rows.map((r) => r.v))
  const hi0 = Math.max(baseline, ...rows.map((r) => r.v))
  const sc = niceRange(lo0, hi0)
  const ticks = ticksOf(sc)
  const W = Math.max(260, (boxW || width) - size * 2.8)
  const H = height
  const maxLab = Math.min(18, Math.max(1, ...rows.map((r) => r.label.length))) + (showRank ? 3 : 0)
  const tl = ticks.map((v) => prefix + axisFmt.format(v) + suffix)
  const m = horizontal
    ? { l: maxLab * size * 0.5 + 16, r: showValues ? size * 3.4 : 16, t: 6, b: showAxis ? size * 1.9 : 8 }
    : { l: showAxis ? Math.max(...tl.map((s) => s.length)) * size * 0.5 + 16 : 8, r: 10, t: showValues ? size * 2.2 : 12, b: size * 2.3 }
  const pw = Math.max(40, W - m.l - m.r)
  // vertical: if any label is too wide for its column, slant them all and make room below
  const rot = !horizontal && maxLab * size * 0.5 > pw / Math.max(1, n) - 4
  if (rot) m.b += maxLab * size * 0.5 * 0.57
  const ph = Math.max(40, H - m.t - m.b)
  const band = (horizontal ? ph : pw) / Math.max(1, n)
  const along = (v) => (horizontal ? pw : ph) * ((v - sc.lo) / (sc.hi - sc.lo))
  const X = (v) => m.l + along(v)
  const Y = (v) => m.t + ph - along(v)
  const maxV = Math.max(...rows.map((r) => r.v))
  const minV = Math.min(...rows.map((r) => r.v))
  const rank = [...rows].sort((a, b) => b.v - a.v).map((r) => r.label)
  const axisP = ease(clamp(p / 0.25, 0, 1))
  const draw = (k) => ({ pathLength: 1, strokeDasharray: 1, strokeDashoffset: 1 - k })
  const thin = { ...o, doubleStroke: false, roughness: roughness * 0.5 }

  const colorOf = (v, i) => {
    if (colorMode === 'above / below') return v >= baseline ? color3 : color2
    if (colorMode === 'by value') return mix(color2, color, maxV === minV ? 1 : (v - minV) / (maxV - minV))
    if (colorMode === 'palette') return [color, color2, color3, color4][i % 4]
    return color
  }
  const isTop = (i) => highlightTop <= 0 || rank.indexOf(rows[i].label) < highlightTop
  const dim = (i) => (hov !== null && hov !== i ? 0.28 : 1) * (isTop(i) ? 1 : 0.35)
  const r0 = dotSize
  const tipRows = (row, i) => [
    { color: colorOf(row.v, i), label: baseline ? `vs baseline ${fmt(baseline)}` : 'value', value: fmt(row.v) },
    ...(baseline ? [{ label: 'difference', value: `${row.v - baseline >= 0 ? '+' : ''}${fmt(row.v - baseline)}` }] : []),
    { label: 'rank', value: `#${rank.indexOf(row.label) + 1} of ${n}` },
  ]
  const showTip = (e, i) => tooltip && setTip(tipAt(e, wrap, rows[i].label, tipRows(rows[i], i)))

  return (
    <Paper wrapRef={(el) => { wrap.current = el; boxRef.current = el }} {...{ width, paper, paperColor, inkColor, mutedInk, size, font, tilt, title, subtitle, tip, accent: color }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}. Hand-drawn lollipop chart. ${rows.map((r) => `${r.label}: ${fmt(r.v)}`).join('; ')}`} style={{ display: 'block', maxWidth: '100%', overflow: 'visible' }} onMouseLeave={() => { setHov(null); setTip(null) }}>
        <defs>
          {stemStyle === 'gradient' && rows.map((r, i) => (
            <linearGradient key={i} id={`${uid}s${i}`} gradientUnits="userSpaceOnUse" x1={horizontal ? X(baseline) : 0} x2={horizontal ? X(r.v) : 0} y1={horizontal ? 0 : Y(baseline)} y2={horizontal ? 0 : Y(r.v)}>
              <stop offset="0" stopColor={colorOf(r.v, i)} stopOpacity="0.25" />
              <stop offset="1" stopColor={colorOf(r.v, i)} stopOpacity="1" />
            </linearGradient>
          ))}
        </defs>

        {/* pencil grid + tick labels */}
        {ticks.map((v, k) => {
          const g = horizontal ? X(v) : Y(v)
          return (
            <g key={k}>
              {showGrid && v !== baseline && <path d={horizontal ? sketchLine(sd + k, g, m.t + 2, g, m.t + ph - 2, thin) : sketchLine(sd + k, m.l + 2, g, m.l + pw - 2, g, thin)} fill="none" stroke={inkColor} strokeOpacity="0.15" strokeWidth="1" {...draw(axisP)} />}
              {showAxis && (horizontal
                ? <text x={g} y={m.t + ph + size * 1.35} textAnchor="middle" fontSize={size * 0.9} fill={mutedInk} opacity={axisP}>{tl[k]}</text>
                : <text x={m.l - 10} y={g} dy="0.34em" textAnchor="end" fontSize={size * 0.9} fill={mutedInk} opacity={axisP}>{tl[k]}</text>)}
            </g>
          )
        })}
        {/* baseline in pen */}
        <path d={horizontal ? sketchLine(sd + 40, X(baseline), m.t - 2, X(baseline), m.t + ph + 3, o) : sketchLine(sd + 40, m.l - 3, Y(baseline), m.l + pw + 3, Y(baseline), o)} fill="none" stroke={inkColor} strokeWidth={strokeWidth} strokeLinecap="round" {...draw(axisP)} />

        {rows.map((row, i) => {
          const ip = ease(clamp((p - 0.15 - (i / Math.max(1, n)) * 0.45) / 0.35, 0, 1))
          const dp = ease(clamp((ip - 0.65) / 0.35, 0, 1))
          const c = colorOf(row.v, i)
          const mid = (horizontal ? m.t : m.l) + i * band + band / 2
          const label = (showRank ? `${rank.indexOf(row.label) + 1}  ` : '') + (row.label.length > 18 ? row.label.slice(0, 17) + '…' : row.label)
          const cx = horizontal ? X(row.v) : mid
          const cy = horizontal ? mid : Y(row.v)
          const bx = horizontal ? X(baseline) : mid
          const by = horizontal ? mid : Y(baseline)
          const below = row.v < baseline
          const on = hov === i
          const rr = r0 * (0.4 + 0.6 * dp) * (on ? 1.2 : 1)
          const tight = rot
          const stem = sketchLine(sd + i * 7 + 3, bx, by, cx, cy, { ...o, doubleStroke: false, roughness: roughness * 0.7 })
          return (
            <g key={i} opacity={dim(i)} style={{ transition: 'opacity .2s' }}>
              <path d={stem} fill="none" stroke={stemStyle === 'gradient' ? `url(#${uid}s${i})` : c} strokeWidth={stemWidth * (on ? 1.5 : 1)} strokeLinecap="round" {...(stemStyle === 'dashed' ? { strokeDasharray: `${stemWidth * 1.6} ${stemWidth * 2.4}`, opacity: ip > 0.98 ? 1 : 0 } : draw(ip))} />
              {dp > 0 && (
                <g opacity={dp}>
                  {dotStyle === 'glow' && <path d={lolCirc(cx, cy, rr * 2.1)} fill={c} opacity="0.14" />}
                  {dotStyle === 'ring' ? (
                    <path d={sketchEllipse(sd + i * 13, cx, cy, rr * 0.85, rr * 0.85, o)} fill={paperColor} stroke={c} strokeWidth={Math.max(2, rr * 0.38)} />
                  ) : (
                    <>
                      <path d={lolCirc(cx, cy, rr)} fill={paperColor} />
                      <SketchFill id={`${uid}d${i}`} clip={lolCirc(cx, cy, rr)} box={{ x: cx - rr, y: cy - rr, w: rr * 2, h: rr * 2 }} color={c} o={{ ...o, fillStyle: dotStyle === 'solid' ? 'solid' : fillStyle, hachureGap: Math.max(2.5, hachureGap * 0.45) }} seed={sd + i * 17} angle={hachureAngle + i * 23} />
                      <path d={sketchEllipse(sd + i * 13, cx, cy, rr, rr, o)} fill="none" stroke={inkColor} strokeWidth={strokeWidth * (on ? 1.3 : 0.9)} strokeLinecap="round" />
                    </>
                  )}
                </g>
              )}
              {horizontal ? (
                <text x={m.l - 10} y={mid} dy="0.34em" textAnchor="end" fontSize={size * 1.02} fill={on ? inkColor : mutedInk} fontWeight={on ? 700 : 400}>{label}</text>
              ) : (
                <text x={mid} y={m.t + ph + size * 1.4} textAnchor={tight ? 'end' : 'middle'} transform={tight ? `rotate(-35 ${mid} ${m.t + ph + size * 1.4})` : undefined} fontSize={size * 1.02} fill={on ? inkColor : mutedInk} fontWeight={on ? 700 : 400}>{label}</text>
              )}
              {showValues && dp > 0 && (
                <text
                  x={horizontal ? cx + (below ? -(r0 + 8) : r0 + 9) : cx}
                  y={horizontal ? cy : cy + (below ? r0 + size * 1.2 : -(r0 + 7))}
                  dy={horizontal ? '0.34em' : 0}
                  textAnchor={horizontal ? (below ? 'end' : 'start') : 'middle'}
                  fontSize={size * 0.95}
                  fontWeight="700"
                  fill={c}
                  opacity={dp}
                  transform={`rotate(${(srng(sd + i)() - 0.5) * 5} ${cx} ${cy})`}
                  style={{ pointerEvents: 'none' }}
                >
                  {fmt(row.v)}
                </text>
              )}
            </g>
          )
        })}

        {rows.map((_, i) => (
          <rect key={i} x={horizontal ? m.l : m.l + i * band} y={horizontal ? m.t + i * band : m.t} width={horizontal ? pw : band} height={horizontal ? band : ph} fill="transparent" onMouseEnter={(e) => { setHov(i); showTip(e, i) }} onMouseMove={(e) => showTip(e, i)} />
        ))}
      </svg>
    </Paper>
  )
}
