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

// ---- parts-of-a-whole helpers ----
function paletteOf(n, base) {
  return Array.from({ length: n }, (_, i) => (i < base.length ? base[i] : mix(base[i % base.length], base[(i + 1) % base.length], 0.5)))
}
const inkOn = (c) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16) / 255)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.6 ? '#0b0b0d' : '#ffffff'
}
// an annular sector from angle a0 to a1 (radians, 0 = 12 o'clock, clockwise)
function arcPath(a0, a1, r0, r1) {
  const p = (a, r) => [Math.sin(a) * r, -Math.cos(a) * r]
  const large = a1 - a0 > Math.PI ? 1 : 0
  if (a1 - a0 >= Math.PI * 2 - 1e-6) a1 = a0 + Math.PI * 2 - 1e-4
  const [x0, y0] = p(a0, r1)
  const [x1, y1] = p(a1, r1)
  if (r0 <= 0) return `M0,0L${x0},${y0}A${r1},${r1} 0 ${large} 1 ${x1},${y1}Z`
  const [x2, y2] = p(a1, r0)
  const [x3, y3] = p(a0, r0)
  return `M${x0},${y0}A${r1},${r1} 0 ${large} 1 ${x1},${y1}L${x2},${y2}A${r0},${r0} 0 ${large} 0 ${x3},${y3}Z`
}
// "Group/Item:value, ..." -> a tree with summed values
function parseTree(data, rootName = 'All') {
  const root = { name: rootName, children: [], value: 0, depth: 0, path: rootName }
  String(data ?? '')
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((entry) => {
      const k = entry.lastIndexOf(':')
      const parts = (k < 0 ? entry : entry.slice(0, k)).split('/').map((s) => s.trim()).filter(Boolean)
      const v = k < 0 ? 1 : Math.max(0, num(entry.slice(k + 1)))
      let cur = root
      parts.forEach((name, d) => {
        let c = cur.children.find((x) => x.name === name)
        if (!c) {
          c = { name, children: [], value: 0, depth: d + 1, parent: cur, path: `${cur.path}/${name}` }
          cur.children.push(c)
        }
        cur = c
      })
      cur.own = (cur.own ?? 0) + v
    })
  const sum = (n) => (n.value = (n.own ?? 0) + n.children.reduce((a, c) => a + sum(c), 0))
  sum(root)
  const tag = (n, b) => {
    n.branch = b
    n.children.sort((a, c) => c.value - a.value)
    n.children.forEach((c, i) => tag(c, n.depth === 0 ? i : b))
  }
  tag(root, 0)
  return root
}
// ---- end parts helpers ----

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

// Doodle treemap: the treemap sketched on paper. Every tile is a wobbly pen box coloured
// in with hatching (bigger values get denser strokes), groups are loose coloured frames
// with their name handwritten in the corner over a scribbled underline. Click a group to
// zoom in and the handwritten breadcrumb to come back out. Entries are "Group/Item:value".
export default function DoodleTreemap({
  data = 'Compute/Virtual machines:420, Compute/Containers:260, Compute/Functions:90, Storage/Object storage:310, Storage/Block storage:150, Storage/Backups:70, Database/Postgres:240, Database/Redis:80, Database/Search:60, Network/CDN:130, Network/Load balancers:55, Network/DNS:12, AI/GPU hours:360, AI/Inference API:140',
  rootName = 'All services',
  title = 'Cloud spend by service',
  subtitle = 'USD thousands, last quarter. Click a group to zoom in',
  tile = 'squarify',
  padding = 3,
  groupGap = 6,
  showHeaders = true,
  showValues = true,
  showPercent = true,
  shadeByValue = true,
  zoomable = true,
  tooltip = true,
  valueFormat = 'number',
  decimals = 0,
  prefix = '$',
  suffix = 'k',
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
  seed = 11,
  paper = 'grid',
  tilt = 0.3,
  width = 720,
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
  const sd = seed * 71 + t * 13
  const o = { roughness, bowing, fillStyle, hachureGap, hachureAngle, strokeWidth, doubleStroke }
  const fmt = makeFmt({ valueFormat, decimals, prefix, suffix })
  const root = useMemo(() => parseTree(data, rootName), [data, rootName])
  const [focusPath, setFocusPath] = useState(null)
  const focus = useMemo(() => {
    if (!focusPath) return root
    const find = (n) => (n.path === focusPath ? n : n.children.map(find).find(Boolean))
    return find(root) ?? root
  }, [root, focusPath])
  const cols = paletteOf(Math.max(6, root.children.length), [color, color2, color3, color4, color5, color6])
  const p = useReveal(drawOn, duration, `${data}|${tile}|${focusPath}`)
  const [hov, setHov] = useState(null)
  const [tip, setTip] = useState(null)

  const W = Math.max(260, (boxW || width) - size * 2.8)
  const crumbH = size * 2
  const H = height
  const ph = H - crumbH
  const cw = size * 0.5 // rough width of one handwritten character

  // squarified layout (Bruls et al.): fill rows while they make tiles squarer
  const squarify = (items, x, y, w, h) => {
    const out = []
    const total = items.reduce((a, n) => a + n.value, 0) || 1
    const area = items.map((n) => ({ n, a: (n.value / total) * w * h }))
    let row = []
    const worst = (r, side) => {
      const s = r.reduce((a, q) => a + q.a, 0)
      const mx = Math.max(...r.map((q) => q.a))
      const mn = Math.min(...r.map((q) => q.a))
      return Math.max((side * side * mx) / (s * s), (s * s) / (side * side * mn))
    }
    const place = (r) => {
      const s = r.reduce((a, q) => a + q.a, 0)
      if (w >= h) {
        const cw_ = s / h
        let yy = y
        r.forEach((q) => { const ch = q.a / cw_; out.push({ n: q.n, x, y: yy, w: cw_, h: ch }); yy += ch })
        x += cw_
        w -= cw_
      } else {
        const rh = s / w
        let xx = x
        r.forEach((q) => { const cw_ = q.a / rh; out.push({ n: q.n, x: xx, y, w: cw_, h: rh }); xx += cw_ })
        y += rh
        h -= rh
      }
    }
    area.forEach((q) => {
      const side = Math.min(w, h)
      if (!row.length || worst([...row, q], side) <= worst(row, side)) row.push(q)
      else {
        place(row)
        row = [q]
      }
    })
    if (row.length) place(row)
    return out
  }
  const slice = (items, x, y, w, h, horiz) => {
    const total = items.reduce((a, n) => a + n.value, 0) || 1
    let off = 0
    return items.map((n) => {
      const f = n.value / total
      const r = horiz ? { n, x: x + off * w, y, w: f * w, h } : { n, x, y: y + off * h, w, h: f * h }
      off += f
      return r
    })
  }
  const layout = (items, x, y, w, h, depth) => (tile === 'slice-dice' ? slice(items, x, y, w, h, depth % 2 === 0) : squarify(items, x, y, w, h))

  const groups = focus.children.length ? focus.children : [focus]
  const outer = layout(groups, 0, crumbH, W, ph, 0)
  const tiles = []
  outer.forEach((g, gi) => {
    const hdr = showHeaders && g.n.children.length && g.h > size * 3.2 ? size * 1.75 : 0
    const gx = g.x + groupGap / 2
    const gy = g.y + groupGap / 2
    const gw = Math.max(0, g.w - groupGap)
    const gh = Math.max(0, g.h - groupGap)
    const kids = g.n.children.length ? layout(g.n.children, gx + 2, gy + hdr, Math.max(0, gw - 4), Math.max(0, gh - hdr - 2), 1) : [{ n: g.n, x: gx, y: gy, w: gw, h: gh }]
    const mx = Math.max(...kids.map((k) => k.n.value))
    const mn = Math.min(...kids.map((k) => k.n.value))
    tiles.push({ group: true, n: g.n, x: gx, y: gy, w: gw, h: gh, hdr, gi, framed: g.n.children.length > 0 })
    kids.forEach((k, ki) => tiles.push({ ...k, gi, ki, shade: mx === mn ? 0 : 1 - (k.n.value - mn) / (mx - mn) }))
  })
  const groupColor = (gi) => cols[(focus === root ? gi : focus.branch) % cols.length]
  const crumbs = []
  for (let n = focus; n; n = n.parent) crumbs.unshift(n)
  const draw = (k) => ({ pathLength: 1, strokeDasharray: 1, strokeDashoffset: 1 - k })
  const clip = (x, y, w, h) => `M${f1(x)},${f1(y)}h${f1(w)}v${f1(h)}h${f1(-w)}Z`
  const cut = (s, room) => (s.length * cw > room ? s.slice(0, Math.max(2, Math.floor(room / cw) - 1)) + '…' : s)
  const showTip = (e, tl, c) => {
    const pct = (tl.n.value / (focus.value || 1)) * 100
    setTip(tipAt(e, wrap, tl.n.name, [
      { color: c, label: 'value', value: fmt(tl.n.value) },
      { label: `of ${focus.name}`, value: `${pct.toFixed(1)}%` },
      ...(tl.n.parent && tl.n.parent !== focus ? [{ label: `of ${tl.n.parent.name}`, value: `${((tl.n.value / tl.n.parent.value) * 100).toFixed(1)}%` }] : []),
    ]))
  }

  let cx0 = 0
  const crumbPos = crumbs.map((c, i) => {
    const x = cx0
    cx0 += c.name.length * cw * 1.02 + (i < crumbs.length - 1 ? size * 1.6 : 0)
    return x
  })

  return (
    <Paper wrapRef={(el) => { wrap.current = el; boxRef.current = el }} {...{ width, paper, paperColor, inkColor, mutedInk, size, font, tilt, title, subtitle, tip, accent: color2 }}>
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${title}. Hand-drawn treemap of ${focus.name}: ${groups.map((g) => `${g.name} ${fmt(g.value)}`).join(', ')}.`}
        style={{ display: 'block', maxWidth: '100%', overflow: 'visible' }}
        onMouseLeave={() => { setHov(null); setTip(null) }}
      >
        {/* breadcrumb */}
        <g>
          {crumbs.map((c, i) => {
            const last = i === crumbs.length - 1
            return (
              <g key={c.path} style={{ cursor: last ? 'default' : 'pointer' }} onClick={() => !last && setFocusPath(c === root ? null : c.path)}>
                <text x={crumbPos[i]} y={size * 1.05} fontSize={size * 1.02} fontWeight={last ? 700 : 400} fill={last ? inkColor : mutedInk}>{c.name}</text>
                {last && crumbs.length > 1 && <path d={sketchLine(sd + 900 + i, crumbPos[i], size * 1.4, crumbPos[i] + c.name.length * cw, size * 1.4, { ...o, doubleStroke: false })} fill="none" stroke={groupColor(0)} strokeWidth={strokeWidth} strokeLinecap="round" />}
                {!last && <path d={arrowD(sd + 950 + i, crumbPos[i] + c.name.length * cw * 1.02 + size * 0.3, size * 0.7, crumbPos[i + 1] - size * 0.35, size * 0.7, { ...o, doubleStroke: false }, 0.12)} fill="none" stroke={mutedInk} strokeWidth="1.2" strokeLinecap="round" style={{ pointerEvents: 'none' }} />}
              </g>
            )
          })}
          <text x={W} y={size * 1.05} textAnchor="end" fontSize={size * 1.02} fontWeight="700" fill={inkColor}>{fmt(focus.value)}</text>
        </g>

        {tiles.map((tl, k) => {
          const ip = ease(clamp((p - (tl.gi / Math.max(1, outer.length)) * 0.4 - (tl.ki ?? 0) * 0.025) / 0.5, 0, 1))
          const tp = clamp((ip - 0.6) / 0.4, 0, 1)
          const gc = groupColor(tl.gi)
          const canZoom = zoomable && tl.n.children.length > 0
          if (tl.group) {
            if (!tl.framed) return null
            const label = tl.w > size * 5 ? (tl.w > size * 12 ? `${tl.n.name}  ${fmt(tl.n.value)}` : tl.n.name) : ''
            const lw = Math.min(tl.w - 14, label.length * cw)
            const hot = hov && hov.gi === tl.gi
            return (
              <g key={`g${k}`} style={{ cursor: canZoom ? 'zoom-in' : 'default' }} onClick={() => canZoom && setFocusPath(tl.n.path)}>
                <rect x={tl.x} y={tl.y} width={tl.w} height={tl.h} fill="transparent" />
                <path d={sketchRect(sd + k * 17, tl.x, tl.y, tl.w, tl.h, { ...o, roughness: roughness * 0.7, doubleStroke: false })} fill="none" stroke={gc} strokeWidth={hot ? strokeWidth * 1.1 : strokeWidth * 0.8} strokeOpacity={hot ? 0.95 : 0.55} strokeLinecap="round" {...draw(ip)} />
                {tl.hdr > 0 && label && (
                  <g style={{ pointerEvents: 'none' }} opacity={tp}>
                    <text x={tl.x + 7} y={tl.y + tl.hdr * 0.68} fontSize={size * 0.98} fontWeight="700" fill={mix(gc, inkColor, 0.35)}>{cut(label, tl.w - 14)}</text>
                    <path d={sketchLine(sd + k * 5 + 300, tl.x + 6, tl.y + tl.hdr * 0.68 + 4, tl.x + 8 + lw, tl.y + tl.hdr * 0.68 + 3, { ...o, doubleStroke: false, roughness: roughness * 0.8 })} fill="none" stroke={gc} strokeWidth={strokeWidth * 0.8} strokeLinecap="round" {...draw(tp)} />
                  </g>
                )}
              </g>
            )
          }
          const x = tl.x + padding / 2
          const y = tl.y + padding / 2
          const w = Math.max(0, tl.w - padding)
          const h = Math.max(0, tl.h - padding)
          if (w < 1 || h < 1) return null
          const shade = shadeByValue ? tl.shade ?? 0 : 0
          const c = shadeByValue ? mix(gc, paperColor, shade * 0.25) : gc
          const pct = (tl.n.value / (focus.value || 1)) * 100
          const fits = w > size * 3.4 && h > size * 1.9
          const isHov = hov && hov.path === tl.n.path
          const on = !hov || isHov
          return (
            <g
              key={tl.n.path}
              opacity={on ? 1 : 0.4}
              style={{ transition: 'opacity .2s', cursor: canZoom ? 'zoom-in' : 'default' }}
              onClick={() => canZoom && setFocusPath(tl.n.path)}
              onMouseEnter={(e) => { setHov({ path: tl.n.path, gi: tl.gi }); tooltip && showTip(e, tl, c) }}
              onMouseMove={(e) => tooltip && setTip((tp_) => (tp_ ? { ...tp_, ...tipAt(e, wrap, tp_.title, tp_.rows) } : tp_))}
            >
              <rect x={x} y={y} width={w} height={h} fill="transparent" />
              <SketchFill id={`${uid}t${k}`} clip={clip(x + 1, y + 1, w - 2, h - 2)} box={{ x, y, w, h }} color={c} o={{ ...o, hachureGap: hachureGap * (0.8 + shade * 0.9) }} seed={sd + k * 13} angle={hachureAngle + (tl.ki % 2 ? 62 : 0) + tl.gi * 14} prog={ip} opacity={0.95 - shade * 0.3} />
              <path d={sketchRect(sd + k * 7, x, y, w, h, { ...o, roughness: roughness * 0.75 })} fill="none" stroke={inkColor} strokeWidth={isHov ? strokeWidth * 1.6 : strokeWidth * 0.9} strokeLinejoin="round" strokeLinecap="round" {...draw(ip)} />
              {fits && tp > 0 && (
                <g style={{ pointerEvents: 'none' }} opacity={tp}>
                  <text x={x + 7} y={y + size * 1.2} fontSize={size * 0.98} fontWeight="700" fill={inkColor} stroke={paperColor} strokeWidth="4" strokeLinejoin="round" paintOrder="stroke">{cut(tl.n.name, w - 12)}</text>
                  {showValues && h > size * 3.3 && (
                    <text x={x + 7} y={y + size * 2.35} fontSize={size * 0.9} fill={inkColor} stroke={paperColor} strokeWidth="4" strokeLinejoin="round" paintOrder="stroke">
                      {fmt(tl.n.value)}
                      {showPercent && w > size * 7 && <tspan fill={mutedInk}>{`  ${pct.toFixed(1)}%`}</tspan>}
                    </text>
                  )}
                </g>
              )}
            </g>
          )
        })}
      </svg>
    </Paper>
  )
}
