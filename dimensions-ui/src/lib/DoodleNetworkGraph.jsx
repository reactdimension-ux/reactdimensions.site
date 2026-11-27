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

// ---- flow helpers ----
function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const inkOn = (c) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16) / 255)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.55 ? '#0b0b0d' : '#ffffff'
}
// n colours: the given ones first, then blends between them
function paletteOf(n, base) {
  return Array.from({ length: n }, (_, i) => (i < base.length ? base[i] : mix(base[i % base.length], base[(i + 1) % base.length], 0.5)))
}
// "A>B:120, B>C:80" -> [{ s: 'A', t: 'B', v: 120 }]
function parseLinks(data, sep = '>') {
  return String(data ?? '')
    .split(/[,\n;]/)
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => {
      const k = x.lastIndexOf(':')
      const pair = (k < 0 ? x : x.slice(0, k)).split(sep).map((s) => s.trim())
      return { path: pair.filter(Boolean), v: k < 0 ? 1 : num(x.slice(k + 1)) }
    })
    .filter((l) => l.path.length >= 2 && l.v > 0)
}
const ribbon = (x0, y0, x1, y1, w) => {
  const xm = (x0 + x1) / 2
  return `M${x0},${y0}C${xm},${y0} ${xm},${y1} ${x1},${y1}L${x1},${y1 + w}C${xm},${y1 + w} ${xm},${y0 + w} ${x0},${y0 + w}Z`
}

// Sankey-style layout. nodes: [{ layer? }], links: [{ s, t, v }] by node index.
function sankeyLayout({ nodes, links, W, H, nodeWidth, pad, iterations = 6, fixedLayers = false, keepOrder = false, align = 'justify' }) {
  const N = nodes.map((n, i) => ({ ...n, i, ins: [], outs: [], vin: 0, vout: 0 }))
  const L = links.map((l, k) => ({ ...l, k }))
  L.forEach((l) => {
    N[l.s].outs.push(l)
    N[l.t].ins.push(l)
    N[l.s].vout += l.v
    N[l.t].vin += l.v
  })
  N.forEach((n) => (n.value = Math.max(n.vin, n.vout)))
  if (!fixedLayers) {
    N.forEach((n) => (n.layer = 0))
    for (let it = 0; it < N.length; it++) {
      let moved = false
      L.forEach((l) => {
        if (N[l.t].layer < N[l.s].layer + 1) {
          N[l.t].layer = N[l.s].layer + 1
          moved = true
        }
      })
      if (!moved) break
    }
    const maxL = Math.max(0, ...N.map((n) => n.layer))
    if (align === 'justify') N.forEach((n) => { if (!n.outs.length) n.layer = maxL })
  }
  const maxL = Math.max(1, ...N.map((n) => n.layer))
  const cols = Array.from({ length: maxL + 1 }, () => [])
  N.forEach((n) => cols[n.layer].push(n))
  const ky = Math.min(...cols.filter((c) => c.length).map((c) => (H - (c.length - 1) * pad) / Math.max(1e-9, c.reduce((a, n) => a + n.value, 0))))
  N.forEach((n) => {
    n.x0 = (n.layer / maxL) * (W - nodeWidth)
    n.x1 = n.x0 + nodeWidth
    n.h = Math.max(1, n.value * ky)
  })
  const stack = (c) => {
    let y = 0
    c.forEach((n) => {
      n.y0 = y
      y += n.h + pad
    })
  }
  cols.forEach(stack)
  const resolve = (c) => {
    c.sort((a, b) => a.y0 - b.y0)
    let y = 0
    c.forEach((n) => {
      if (n.y0 < y) n.y0 = y
      y = n.y0 + n.h + pad
    })
    let over = y - pad - H
    for (let i = c.length - 1; i >= 0 && over > 0; i--) {
      const n = c[i]
      const lim = i === c.length - 1 ? H - n.h : c[i + 1].y0 - pad - n.h
      if (n.y0 > lim) n.y0 = lim
    }
    if (c[0] && c[0].y0 < 0) {
      let yy = 0
      c.forEach((n) => { n.y0 = Math.max(n.y0, yy); yy = n.y0 + n.h + pad })
    }
  }
  if (!keepOrder) {
    const center = (n) => n.y0 + n.h / 2
    for (let it = 0; it < iterations; it++) {
      const a = 0.9 ** it
      cols.forEach((c) => {
        c.forEach((n) => {
          if (!n.ins.length) return
          const w = n.ins.reduce((s, l) => s + l.v, 0)
          const y = n.ins.reduce((s, l) => s + center(N[l.s]) * l.v, 0) / w
          n.y0 += (y - center(n)) * a
        })
        resolve(c)
      })
      ;[...cols].reverse().forEach((c) => {
        c.forEach((n) => {
          if (!n.outs.length) return
          const w = n.outs.reduce((s, l) => s + l.v, 0)
          const y = n.outs.reduce((s, l) => s + center(N[l.t]) * l.v, 0) / w
          n.y0 += (y - center(n)) * a
        })
        resolve(c)
      })
    }
  }
  N.forEach((n) => (n.y1 = n.y0 + n.h))
  N.forEach((n) => {
    let y = n.y0
    ;[...n.outs].sort((a, b) => N[a.t].y0 - N[b.t].y0 || (a.order ?? 0) - (b.order ?? 0)).forEach((l) => {
      l.w = l.v * ky
      l.sy = y
      y += l.w
    })
    y = n.y0
    ;[...n.ins].sort((a, b) => N[a.s].y0 - N[b.s].y0 || (a.order ?? 0) - (b.order ?? 0)).forEach((l) => {
      l.ty = y
      y += l.v * ky
    })
  })
  return { nodes: N, links: L, ky }
}
// ---- end flow helpers ----

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

// Doodle network graph: people as hand-drawn circles with their names written beside
// them, links as pencil curves, and each community circled with a loose pen lasso. The
// layout is the same live physics as the Network Graph, so you can still drag a node
// and the rest follow. Links are "A-B" or "A-B:weight". Each stroke keeps its own seed,
// so lines hold still while nodes move; only `boil` makes them shimmer.
export default function DoodleNetworkGraph({
  data = 'Ada-Grace:3, Ada-Linus:2, Ada-Alan:4, Grace-Alan:2, Grace-Ken:1, Alan-Ken:2, Linus-Ken:1, Ken-Dennis:4, Dennis-Bjarne:2, Dennis-Brian:3, Brian-Bjarne:1, Bjarne-Guido:2, Guido-Larry:1, Guido-Yukihiro:2, Larry-Yukihiro:1, Larry-Rasmus:2, Rasmus-Brendan:2, Brendan-Anders:3, Anders-James:2, James-Bjarne:1, James-Brendan:1, Margaret-Ada:2, Margaret-Grace:3, Margaret-Barbara:2, Barbara-Edsger:3, Edsger-Tony:2, Tony-Barbara:1, Edsger-Alan:1, Yukihiro-Matz:3, Matz-Larry:1',
  title = 'Who works with whom',
  subtitle = 'Drag a node. Size: connections. Colour: community',
  layout = 'force',
  charge = 280,
  linkDistance = 62,
  nodeSize = 6,
  sizeByDegree = true,
  colorBy = 'community',
  labels = 'auto',
  linkOpacity = 0.35,
  curved = true,
  lasso = true,
  draggable = true,
  tooltip = true,
  animate = true,
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
  seed = 14,
  paper = 'grid',
  tilt = 0.4,
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
  const svgRef = useRef(null)
  const [boxRef, boxW] = useWidth()
  const t = useBoil(boil)
  const sd = seed * 67 + t * 13
  const o = { roughness, bowing, fillStyle, hachureGap, hachureAngle, strokeWidth, doubleStroke }
  const W = Math.max(280, (boxW || width) - size * 2.8)
  const H = height

  const graph = useMemo(() => {
    const names = []
    const idx = (s) => {
      let i = names.indexOf(s)
      if (i < 0) i = names.push(s) - 1
      return i
    }
    const seen = new Map()
    parseLinks(data, '-').forEach(({ path, v }) => {
      for (let k = 0; k < path.length - 1; k++) {
        const a = idx(path[k])
        const b = idx(path[k + 1])
        if (a === b) continue
        const key = a < b ? `${a}-${b}` : `${b}-${a}`
        seen.set(key, (seen.get(key) ?? 0) + v)
      }
    })
    const links = [...seen].map(([key, w]) => { const [s, tt] = key.split('-').map(Number); return { s, t: tt, w } })
    const deg = names.map(() => 0)
    const adj = names.map(() => new Set())
    links.forEach((l) => { deg[l.s]++; deg[l.t]++; adj[l.s].add(l.t); adj[l.t].add(l.s) })
    // label propagation: each node takes the most common label among its neighbours
    const r = rng(7)
    let lab = names.map((_, i) => i)
    for (let it = 0; it < 12; it++) {
      const order = names.map((_, i) => i).sort(() => r() - 0.5)
      order.forEach((i) => {
        const c = new Map()
        links.forEach((l) => {
          if (l.s === i) c.set(lab[l.t], (c.get(lab[l.t]) ?? 0) + l.w)
          if (l.t === i) c.set(lab[l.s], (c.get(lab[l.s]) ?? 0) + l.w)
        })
        let best = lab[i]
        let bv = -1
        c.forEach((v, k) => { if (v > bv) { bv = v; best = k } })
        lab[i] = best
      })
    }
    const uniq = [...new Set(lab)]
    return { names, links, deg, adj, comm: lab.map((l) => uniq.indexOf(l)), nComm: uniq.length }
  }, [data])

  const N = graph.names.length
  const maxDeg = Math.max(1, ...graph.deg)
  const rad = (i) => (sizeByDegree ? nodeSize * (0.75 + 1.1 * Math.sqrt(graph.deg[i] / maxDeg)) : nodeSize)
  const cols = paletteOf(Math.max(graph.nComm, 6), [color, color2, color3, color4, color5, color6])
  const colorOf = (i) => (colorBy === 'community' ? cols[graph.comm[i]] : colorBy === 'degree' ? mix(color2, color, graph.deg[i] / maxDeg) : color)

  const sim = useRef(null)
  const [, setFrame] = useState(0)
  const [hov, setHov] = useState(-1)
  const [hovC, setHovC] = useState(null)
  const [tip, setTip] = useState(null)
  const drag = useRef(null)
  const p = useReveal(drawOn, duration, `${data}|${layout}`)

  // (re)start the simulation when the graph or layout changes
  useEffect(() => {
    const r = rng(11)
    const byComm = graph.names.map((_, i) => i).sort((a, b) => graph.comm[a] - graph.comm[b] || graph.deg[b] - graph.deg[a])
    const pos = graph.names.map((_, i) => {
      if (layout === 'circle') {
        const k = byComm.indexOf(i)
        const a = (k / N) * Math.PI * 2 - Math.PI / 2
        return { x: W / 2 + Math.cos(a) * (Math.min(W, H) / 2 - 40), y: H / 2 + Math.sin(a) * (Math.min(W, H) / 2 - 26), vx: 0, vy: 0 }
      }
      const a = r() * Math.PI * 2
      const d = animate ? 6 + r() * 20 : 40 + r() * 120
      return { x: W / 2 + Math.cos(a) * d, y: H / 2 + Math.sin(a) * d, vx: 0, vy: 0 }
    })
    sim.current = { pos, alpha: layout === 'circle' ? 0 : 1 }
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    let raf
    const step = () => {
      const s = sim.current
      const P = s.pos
      for (let i = 0; i < N; i++)
        for (let j = i + 1; j < N; j++) {
          let dx = P[j].x - P[i].x
          let dy = P[j].y - P[i].y
          let d2 = dx * dx + dy * dy || 0.01
          const f = (charge * 14 * s.alpha) / Math.max(d2, 60)
          const d = Math.sqrt(d2)
          dx /= d
          dy /= d
          P[i].vx -= dx * f
          P[i].vy -= dy * f
          P[j].vx += dx * f
          P[j].vy += dy * f
          const min = rad(i) + rad(j) + 4
          if (d < min) {
            const push = (min - d) / 2
            P[i].x -= dx * push
            P[i].y -= dy * push
            P[j].x += dx * push
            P[j].y += dy * push
          }
        }
      graph.links.forEach((l) => {
        const a = P[l.s]
        const b = P[l.t]
        const dx = b.x - a.x
        const dy = b.y - a.y
        const d = Math.hypot(dx, dy) || 1
        const k = ((d - linkDistance) / d) * 0.06 * s.alpha * Math.min(2, 0.6 + l.w * 0.2)
        a.vx += dx * k
        a.vy += dy * k
        b.vx -= dx * k
        b.vy -= dy * k
      })
      P.forEach((q, i) => {
        q.vx += (W / 2 - q.x) * 0.006 * s.alpha
        q.vy += (H / 2 - q.y) * 0.012 * s.alpha
        if (drag.current && drag.current.i === i) {
          q.x = drag.current.x
          q.y = drag.current.y
          q.vx = q.vy = 0
          return
        }
        q.vx *= 0.6
        q.vy *= 0.6
        q.x = clamp(q.x + q.vx, 14, W - 14)
        q.y = clamp(q.y + q.vy, 14, H - 14)
      })
      s.alpha = Math.max(drag.current ? 0.3 : 0, s.alpha * 0.985)
    }
    if (layout === 'circle') {
      setFrame((f) => f + 1)
      return
    }
    if (reduce || !animate) {
      for (let k = 0; k < 300; k++) step()
      setFrame((f) => f + 1)
    }
    const loop = () => {
      if (sim.current.alpha > 0.004 || drag.current) {
        step()
        setFrame((f) => f + 1)
      }
      raf = requestAnimationFrame(loop)
    }
    if (!reduce && animate) raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [graph, layout, charge, linkDistance, W, H, N, animate]) // eslint-disable-line react-hooks/exhaustive-deps

  const P = sim.current?.pos ?? []
  const local = (e) => {
    // map through the svg's screen matrix so the paper tilt doesn't push the node off the pointer
    const svg = svgRef.current
    const m = svg.getScreenCTM?.()
    if (m && svg.createSVGPoint) {
      const pt = svg.createSVGPoint()
      pt.x = e.clientX
      pt.y = e.clientY
      const q = pt.matrixTransform(m.inverse())
      return [q.x, q.y]
    }
    const b = svg.getBoundingClientRect()
    return [e.clientX - b.left, e.clientY - b.top]
  }
  const onDown = (e, i) => {
    if (!draggable) return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    const [x, y] = local(e)
    drag.current = { i, x, y }
    sim.current.alpha = Math.max(sim.current.alpha, 0.35)
    setTip(null)
  }
  const onMove = (e) => {
    if (!drag.current) return
    const [x, y] = local(e)
    drag.current.x = clamp(x, 10, W - 10)
    drag.current.y = clamp(y, 10, H - 10)
    if (layout === 'circle') {
      P[drag.current.i].x = drag.current.x
      P[drag.current.i].y = drag.current.y
      setFrame((f) => f + 1)
    }
  }
  const onUp = () => (drag.current = null)
  const near = (i) => (hov < 0 || i === hov || graph.adj[hov].has(i)) && (hovC === null || graph.comm[i] === hovC)
  const showLabel = (i) => labels === 'all' || (labels === 'auto' && (graph.deg[i] >= Math.max(3, maxDeg * 0.5) || i === hov || (hov >= 0 && graph.adj[hov].has(i)) || (hovC !== null && graph.comm[i] === hovC)))
  const linkP = ease(clamp(p / 0.6, 0, 1))
  const nodeP = ease(clamp((p - 0.15) / 0.5, 0, 1))
  const lassoP = ease(clamp((p - 0.55) / 0.45, 0, 1))
  const pencil = { ...o, doubleStroke: false, roughness: roughness * 0.7 }
  const legend = colorBy === 'community' ? <DoodleLegend items={Array.from({ length: graph.nComm }, (_, c) => ({ label: `Group ${c + 1}`, color: cols[c] }))} onHover={setHovC} o={o} inkColor={inkColor} seed={seed * 19} /> : null
  const paperProps = { width, paper, paperColor, inkColor, mutedInk, size, font, tilt, title, subtitle, accent: color }

  if (!P.length) return <Paper wrapRef={(el) => { wrap.current = el; boxRef.current = el }} {...paperProps} legend={legend}><div style={{ height: H }} /></Paper>

  // a loose loop round each community
  const lassos = lasso && colorBy === 'community'
    ? Array.from({ length: graph.nComm }, (_, c) => {
        const ids = P.map((_, i) => i).filter((i) => graph.comm[i] === c)
        if (ids.length < 2) return null
        const x0 = Math.min(...ids.map((i) => P[i].x - rad(i)))
        const x1 = Math.max(...ids.map((i) => P[i].x + rad(i)))
        const y0 = Math.min(...ids.map((i) => P[i].y - rad(i)))
        const y1 = Math.max(...ids.map((i) => P[i].y + rad(i)))
        const ccx = (x0 + x1) / 2
        const ccy = (y0 + y1) / 2
        // keep the loop on the page: never wider than the room on its tighter side
        return { c, cx: ccx, cy: ccy, rx: Math.max((x1 - x0) / 2 + 4, Math.min((x1 - x0) / 2 * 1.22 + 8, ccx + 2, W - ccx + 2)), ry: Math.max((y1 - y0) / 2 + 4, Math.min((y1 - y0) / 2 * 1.22 + 8, ccy + 2, H - ccy + 2)) }
      }).filter(Boolean)
    : []

  return (
    <Paper wrapRef={(el) => { wrap.current = el; boxRef.current = el }} {...paperProps} tip={tip} legend={legend}>
      <svg
        ref={svgRef}
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${title}. Hand-drawn network of ${N} people and ${graph.links.length} connections. Most connected: ${graph.names.map((nm, i) => [nm, graph.deg[i]]).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([nm, d]) => `${nm} (${d})`).join(', ')}.`}
        style={{ display: 'block', maxWidth: '100%', overflow: 'visible', touchAction: 'none', userSelect: 'none' }}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={() => { onUp(); setHov(-1); setTip(null) }}
      >
        {lassos.map((g) => (
          <path key={`c${g.c}`} d={sketchEllipse(sd + 700 + g.c * 13, g.cx, g.cy, g.rx, g.ry, { ...o, roughness: roughness * 0.8 })} fill="none" stroke={cols[g.c]} strokeWidth={hovC === g.c ? strokeWidth * 1.3 : strokeWidth * 0.9} strokeOpacity={hovC === null || hovC === g.c ? 0.55 : 0.12} strokeLinecap="round" pathLength="1" strokeDasharray="1" strokeDashoffset={1 - lassoP} style={{ pointerEvents: 'none', transition: 'stroke-opacity .2s' }} />
        ))}

        {graph.links.map((l, k) => {
          const a = P[l.s]
          const b = P[l.t]
          const on = (hov < 0 || l.s === hov || l.t === hov) && (hovC === null || (graph.comm[l.s] === hovC && graph.comm[l.t] === hovC))
          const lit = hov >= 0 && on
          const mx = (a.x + b.x) / 2 + (curved ? (b.y - a.y) * 0.12 : 0)
          const my = (a.y + b.y) / 2 - (curved ? (b.x - a.x) * 0.12 : 0)
          return (
            <path key={k} d={sketchCurve(sd + k * 7, [[a.x, a.y], [mx, my], [b.x, b.y]], pencil)} fill="none" stroke={lit ? colorOf(hov) : inkColor} strokeOpacity={on ? (lit ? 0.9 : Math.min(1, linkOpacity + 0.15)) : 0.06} strokeWidth={Math.min(4, 0.7 + l.w * 0.4) * (lit ? 1.4 : 1)} strokeLinecap="round" pathLength="1" strokeDasharray="1" strokeDashoffset={1 - linkP} style={{ transition: 'stroke-opacity .2s', pointerEvents: 'none' }} />
          )
        })}

        {P.map((q, i) => {
          const c = colorOf(i)
          const r = rad(i) * (i === hov ? 1.25 : 1) * (0.3 + 0.7 * nodeP)
          const isHov = i === hov
          return (
            <g key={i} opacity={(near(i) ? 1 : 0.2) * (nodeP > 0 ? 1 : 0)} style={{ transition: 'opacity .2s' }}>
              {/* marker dab a little off the pen circle */}
              <circle cx={q.x + 1.2} cy={q.y - 0.8} r={r * 0.92} fill={c} fillOpacity="0.85" />
              <path d={sketchEllipse(sd + i * 11 + 1, q.x, q.y, r, r, { ...o, doubleStroke: false, roughness: roughness * 0.8 })} fill="none" stroke={inkColor} strokeWidth={isHov ? strokeWidth * 1.3 : strokeWidth * 0.8} />
              <circle
                cx={q.x}
                cy={q.y}
                r={r + 4}
                fill="transparent"
                style={{ cursor: draggable ? 'grab' : 'default' }}
                onPointerDown={(e) => onDown(e, i)}
                onPointerEnter={(e) => { if (drag.current) return; setHov(i); tooltip && setTip(tipAt(e, wrap, graph.names[i], [{ color: c, label: 'connections', value: String(graph.deg[i]) }, { label: 'linked to', value: [...graph.adj[i]].slice(0, 4).map((j) => graph.names[j]).join(', ') + (graph.adj[i].size > 4 ? '…' : '') }])) }}
                onPointerLeave={() => { if (!drag.current) { setHov(-1); setTip(null) } }}
              />
              {showLabel(i) && (
                <text x={q.x + r + 4} y={q.y - r * 0.4} fontSize={size * (isHov ? 1.08 : 0.98)} fontWeight="700" fill={inkColor} stroke={paperColor} strokeWidth="3.5" paintOrder="stroke" opacity={nodeP} style={{ pointerEvents: 'none' }}>{graph.names[i]}</text>
              )}
            </g>
          )
        })}
      </svg>
    </Paper>
  )
}
