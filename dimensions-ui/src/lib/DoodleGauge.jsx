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

// Doodle gauge: one value on a hand-drawn dial. The band is a wobbly pen outline, the
// bad / ok / good zones are coloured in with three different hatch styles, a pen needle
// swings to the value on a spring, and the value is written big and circled underneath.
// `style: 'arc'` fills the band up to the value instead and moves the zones to a thin
// strip outside. Turn on `autoplay` to wander through values as a demo.
export default function DoodleGauge({
  value = 72,
  min = 0,
  max = 100,
  target = 85,
  zones = '40, 70',
  zoneMode = 'low is bad',
  label = 'System health',
  title = 'Health score',
  subtitle = 'Updated a minute ago',
  arc = 'three-quarter',
  style = 'needle',
  thickness = 18,
  showTicks = true,
  majorTicks = 5,
  minorTicks = 4,
  showZones = true,
  stiffness = 80,
  damping = 11,
  autoplay = false,
  decimals = 0,
  prefix = '',
  suffix = '',
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
  seed = 11,
  paper = 'grid',
  tilt = 0.4,
  width = 440,
  size = 15,
  font = HAND,
  lowColor = '#e4572e',
  midColor = '#f2a541',
  highColor = '#3bb273',
  needleColor = '#2b2b2b',
  paperColor = '#fbf8f1',
  inkColor = '#2b2b2b',
  mutedInk = '#77736b',
}) {
  const uid = useId().replace(/:/g, '')
  const [boxRef, boxW] = useWidth()
  const t = useBoil(boil)
  const sd = seed * 71 + t * 13
  const o = { roughness, bowing, fillStyle, hachureGap, hachureAngle, strokeWidth, doubleStroke }
  const fmt = makeFmt({ decimals, prefix, suffix })
  const [goal, setGoal] = useState(value)
  const [v, setV] = useState(drawOn ? min : value)
  const sim = useRef({ x: drawOn ? min : value, vel: 0 })
  const p = useReveal(drawOn, duration, `${arc}|${style}|${min}|${max}`)

  useEffect(() => {
    if (!autoplay) return setGoal(value)
    const id = setInterval(() => setGoal(min + Math.random() * (max - min)), 2400)
    setGoal(min + Math.random() * (max - min))
    return () => clearInterval(id)
  }, [autoplay, value, min, max])
  // the needle is a damped spring chasing `goal`
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    let raf
    let last = performance.now()
    const tick = (now) => {
      const dt = Math.min(0.032, (now - last) / 1000)
      last = now
      const s = sim.current
      if (reduce) s.x = goal
      else {
        s.vel += (stiffness * (goal - s.x) - damping * s.vel) * dt
        s.x += s.vel * dt
      }
      setV(s.x)
      if (!reduce && (Math.abs(goal - s.x) > (max - min) * 0.0005 || Math.abs(s.vel) > 0.01)) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [goal, stiffness, damping, min, max])

  // useWidth's ResizeObserver reports the paper's content box, i.e. already without padding
  const W = Math.max(240, Math.min(width, boxW || width) - size * 2.8)
  const sweep = arc === 'half' ? 180 : arc === 'full' ? 300 : 260
  const start = -sweep / 2
  const R = W / 2 - size * 2.2
  const th = clamp(thickness, 4, R * 0.5)
  const rIn = R - th
  const cx = W / 2
  const cy = R + size * 1.5
  const span = max - min || 1
  const f = (x) => clamp((x - min) / span, 0, 1)
  const toA = (x) => ((start + f(x) * sweep) * Math.PI) / 180
  const pt = (a, r) => [cx + Math.sin(a) * r, cy - Math.cos(a) * r]
  const arcPts = (a0, a1, r, step = 0.07) => {
    const k = Math.max(1, Math.ceil(Math.abs(a1 - a0) / step))
    return Array.from({ length: k + 1 }, (_, i) => pt(a0 + ((a1 - a0) * i) / k, r))
  }
  const band = (a0, a1, r0, r1, step) => [...arcPts(a0, a1, r1, step), ...arcPts(a1, a0, r0, step)]
  const poly = (pts) => 'M' + pts.map((q) => q.map(f1).join(',')).join('L') + 'Z'
  const draw = (k) => ({ pathLength: 1, strokeDasharray: 1, strokeDashoffset: 1 - k })

  const zs = splitNames(zones).map((z) => parseFloat(z)).filter((z) => Number.isFinite(z) && z > min && z < max).sort((a, b) => a - b)
  const bounds = [min, ...zs, max]
  const lowBad = zoneMode === 'low is bad'
  const zoneColor = (i, n) => {
    const k = n > 1 ? i / (n - 1) : 1
    return lowBad
      ? (k < 0.5 ? mix(lowColor, midColor, k * 2) : mix(midColor, highColor, (k - 0.5) * 2))
      : (k < 0.5 ? mix(highColor, midColor, k * 2) : mix(midColor, lowColor, (k - 0.5) * 2))
  }
  // each zone gets its own hatch style, starting from `fillStyle`
  const STY = ['hachure', 'cross-hatch', 'zigzag', 'dots']
  const zoneStyle = (i) => (fillStyle === 'solid' ? 'solid' : STY[(Math.max(0, STY.indexOf(fillStyle)) + i) % STY.length])
  const zi = bounds.findIndex((b, i) => i < bounds.length - 1 && goal >= b && goal <= bounds[i + 1])
  const cur = zoneColor(Math.max(0, zi), bounds.length - 1)
  const a = toA(v)

  const MJ = clamp(Math.round(majorTicks), 1, 12)
  const MN = clamp(Math.round(minorTicks), 0, 9)
  const ticks = []
  for (let i = 0; i <= MJ; i++) {
    ticks.push({ x: min + (span * i) / MJ, major: true })
    if (i < MJ) for (let k = 1; k <= MN; k++) ticks.push({ x: min + (span * (i + k / (MN + 1))) / MJ, major: false })
  }
  const tickO = { ...o, doubleStroke: false, roughness: roughness * 0.4 }
  const tickD = (major) => ticks.filter((k) => k.major === major).map((k, i) => {
    const ta = toA(k.x)
    const [x0, y0] = pt(ta, rIn - 4)
    const [x1, y1] = pt(ta, rIn - (major ? 13 : 8))
    return sketchLine(sd + 300 + i * 2 + (major ? 1 : 0), x0, y0, x1, y1, tickO)
  }).join('')

  const full = arc === 'full'
  const fs = Math.min(size * 3.1, R * (full ? 0.3 : 0.38))
  const textY = style === 'needle' ? cy + R * (full ? 0.5 : 0.42) : cy + fs * 0.35
  // on a full ring the label drops below the two band ends
  const labelY = Math.max(textY + fs * 0.3 + size * 1.3, full && style === 'needle' ? cy + R * 0.87 + size * 1.1 : 0)
  const hasTarget = target > min && target < max
  const targetY = labelY + size * 1.2
  const H = Math.max((hasTarget ? targetY : labelY) + size * 0.7, cy - Math.cos((sweep / 2) * (Math.PI / 180)) * R + size * 1.2)
  const ring = fmt(goal).length * fs * 0.27 + fs * 0.55

  const axisP = ease(clamp(p / 0.35, 0, 1))
  const zoneP = (i) => ease(clamp((p - 0.2 - i * 0.12) / 0.45, 0, 1))
  const textP = ease(clamp((p - 0.55) / 0.35, 0, 1))
  const a0 = toA(min)
  const a1 = toA(max)

  return (
    <Paper wrapRef={(el) => (boxRef.current = el)} {...{ width, paper, paperColor, inkColor, mutedInk, size, font, tilt, title, subtitle, accent: cur }}>
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="meter"
        aria-label={`${label}: ${fmt(goal)} of ${fmt(max)}${hasTarget ? `, target ${fmt(target)}` : ''}`}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={Math.round(goal)}
        style={{ display: 'block', maxWidth: '100%', margin: '0 auto', overflow: 'visible' }}
      >
        {/* zones inside the band (needle style) */}
        {style === 'needle' && showZones && bounds.slice(0, -1).map((b, i) => {
          const pts = band(toA(b), toA(bounds[i + 1]), rIn, R, 0.04)
          return <SketchFill key={i} id={`${uid}z${i}`} clip={poly(pts)} box={{ x: cx - R, y: cy - R, w: 2 * R, h: 2 * R }} color={zoneColor(i, bounds.length - 1)} o={{ ...o, fillStyle: zoneStyle(i), hachureGap: Math.max(3, hachureGap * 0.75) }} seed={sd + i * 17} angle={hachureAngle + i * 55} prog={zoneP(i)} opacity={0.85} />
        })}
        {/* the value filling the band (arc style) */}
        {style === 'arc' && a > a0 + 0.002 && (
          <SketchFill id={`${uid}v`} clip={poly(band(a0, a, rIn, R, 0.04))} box={{ x: cx - R, y: cy - R, w: 2 * R, h: 2 * R }} color={cur} o={{ ...o, hachureGap: Math.max(3, hachureGap * 0.7) }} seed={sd + 40} prog={zoneP(0)} />
        )}
        {/* zones as a thin strip outside (arc style) */}
        {style === 'arc' && showZones && bounds.slice(0, -1).map((b, i) => {
          const pts = band(toA(b) + 0.015, toA(bounds[i + 1]) - 0.015, R + 5, R + 11, 0.04)
          return <SketchFill key={i} id={`${uid}s${i}`} clip={poly(pts)} box={{ x: cx - R - 12, y: cy - R - 12, w: 2 * R + 24, h: 2 * R + 24 }} color={zoneColor(i, bounds.length - 1)} o={{ ...o, fillStyle: zoneStyle(i), hachureGap: 3 }} seed={sd + i * 23} angle={hachureAngle + i * 55} prog={zoneP(i)} />
        })}
        {/* zone dividers and the pen outline of the band */}
        {style === 'needle' && showZones && zs.map((z, i) => {
          const [x0, y0] = pt(toA(z), rIn)
          const [x1, y1] = pt(toA(z), R)
          return <path key={i} d={sketchLine(sd + 60 + i, x0, y0, x1, y1, { ...o, doubleStroke: false })} fill="none" stroke={inkColor} strokeWidth={strokeWidth * 0.8} strokeLinecap="round" {...draw(axisP)} />
        })}
        <path d={sketchPoly(sd + 7, band(a0, a1, rIn, R, 0.16), { ...o, roughness: roughness * 0.5 })} fill="none" stroke={inkColor} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...draw(axisP)} />
        {style === 'arc' && a > a0 + 0.01 && (() => {
          const [x0, y0] = pt(a, rIn - 3)
          const [x1, y1] = pt(a, R + 3)
          return <path d={sketchLine(sd + 41, x0, y0, x1, y1, o)} fill="none" stroke={inkColor} strokeWidth={strokeWidth * 1.2} strokeLinecap="round" />
        })()}

        {/* ticks and their numbers */}
        {showTicks && (
          <g style={{ pointerEvents: 'none' }}>
            <path d={tickD(false)} fill="none" stroke={inkColor} strokeOpacity="0.4" strokeWidth="1" strokeLinecap="round" {...draw(axisP)} />
            <path d={tickD(true)} fill="none" stroke={inkColor} strokeOpacity="0.85" strokeWidth="1.5" strokeLinecap="round" {...draw(axisP)} />
            {R > 90 && ticks.filter((k) => k.major).map((k, i) => {
              // on a full ring the two ends meet under the value: leave them unlabelled
              if (full && style === 'needle' && (i === 0 || i === MJ)) return null
              const [lx, ly] = pt(toA(k.x), rIn - 13 - size * 0.85)
              return <text key={i} x={lx} y={ly} dy="0.34em" textAnchor="middle" fontSize={size * 0.88} fill={mutedInk} opacity={axisP}>{axisFmt.format(k.x)}</text>
            })}
          </g>
        )}

        {/* target: a pen stroke across the band with a little star */}
        {hasTarget && (() => {
          const ta = toA(target)
          const [x0, y0] = pt(ta, R + 9)
          const [x1, y1] = pt(ta, rIn - 3)
          const [sx, sy] = pt(ta, R + 9 + size * 0.55)
          return (
            <g style={{ pointerEvents: 'none' }} opacity={textP}>
              <path d={sketchLine(sd + 90, x0, y0, x1, y1, o)} fill="none" stroke={inkColor} strokeWidth={strokeWidth * 1.4} strokeLinecap="round" />
              <path d={sketchPoly(sd + 91, starPts(sx, sy, size * 0.45), { ...o, roughness: roughness * 0.4, doubleStroke: false })} fill="#f2c94c" fillOpacity="0.6" stroke={inkColor} strokeWidth={strokeWidth * 0.7} strokeLinejoin="round" />
            </g>
          )
        })()}

        {/* the needle: a pen kite filled with ink, on a hand-drawn hub */}
        {style === 'needle' && (() => {
          const kite = [pt(a + Math.PI, 14), pt(a + Math.PI / 2, 6), pt(a, rIn - 8), pt(a - Math.PI / 2, 6)]
          return (
            <g style={{ pointerEvents: 'none' }}>
              <path d={poly(kite)} fill={needleColor} fillOpacity="0.82" />
              <path d={sketchPoly(seed * 5 + 3 + t * 13, kite, { ...o, roughness: roughness * 0.4 })} fill="none" stroke={needleColor} strokeWidth={strokeWidth * 0.8} strokeLinejoin="round" />
              <path d={sketchEllipse(sd + 95, cx, cy, 8.5, 8.5, { ...o, doubleStroke: false })} fill={paperColor} stroke={inkColor} strokeWidth={strokeWidth} />
              <circle cx={cx} cy={cy} r="2.6" fill={inkColor} />
            </g>
          )
        })()}

        {/* the value, written big and circled */}
        <path d={sketchEllipse(sd + 120, cx, textY - fs * 0.33, ring, fs * 0.62, o)} fill="none" stroke={cur} strokeWidth={strokeWidth * 1.2} strokeLinecap="round" style={{ transition: 'stroke .4s' }} {...draw(textP)} />
        <text x={cx} y={textY} textAnchor="middle" fontSize={fs} fontWeight="700" fill={inkColor} style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(v)}</text>
        <text x={cx} y={labelY} textAnchor="middle" fontSize={size * 1.05} fill={mutedInk}>{label}</text>
        {hasTarget && <text x={cx} y={targetY} textAnchor="middle" fontSize={size * 0.95} fill={mutedInk} opacity={textP}>{`target ${fmt(target)}`}</text>}
      </svg>
    </Paper>
  )
}
