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

// Parallel coordinates: one vertical axis per measure and one line per item, so you
// can see how items compare across many numbers at once. Drag up or down on any axis
// to filter to a range (drag several axes to combine; click an axis to clear it).
// Lines are coloured along one measure. Rows are "Name:v|v|v" with `dimensions`
// naming the axes, or leave `data` empty for a seeded demo of cars.
export default function ParallelCoordinates({
  data = '',
  dimensions = 'Price, Power, Weight, Efficiency, Range, Rating',
  count = 60,
  seed = 9,
  title = 'Electric car models',
  subtitle = 'Drag on any axis to filter',
  colorBy = 'Range',
  curved = true,
  lineOpacity = 0.55,
  strokeWidth = 1.6,
  brushable = true,
  tooltip = true,
  animate = true,
  duration = 1400,
  width = 760,
  height = 320,
  size = 13,
  color = '#d77757',
  color2 = '#5b9bd5',
  background = '#111214',
  textColor = '#ececec',
  mutedColor = '#8b8f98',
}) {
  const id = useId().replace(/:/g, '')
  const wrap = useRef(null)
  const svgRef = useRef(null)
  const [boxRef, boxW] = useWidth()
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
  const p = useReveal(animate, duration, `${data}|${count}|${seed}`)
  const [brush, setBrush] = useState({}) // axis -> [lo, hi] in values
  const [drag, setDrag] = useState(null)
  const [hov, setHov] = useState(-1)
  const [tip, setTip] = useState(null)

  const W = Math.max(300, (boxW || width) - size * 2.8)
  const H = height
  const m = { l: size * 2.4, r: size * 2.4, t: size * 2.6, b: size * 1.6 }
  const pw = W - m.l - m.r
  const ph = H - m.t - m.b
  const X = (k) => m.l + (D > 1 ? (k / (D - 1)) * pw : pw / 2)
  const Y = (k, v) => m.t + ph - ((v - ranges[k].lo) / (ranges[k].hi - ranges[k].lo || 1)) * ph
  const V = (k, y) => ranges[k].lo + ((m.t + ph - y) / ph) * (ranges[k].hi - ranges[k].lo)
  const lineColor = (r) => mix(color2, color, (r.v[ck] - ranges[ck].lo) / (ranges[ck].hi - ranges[ck].lo || 1))
  const passes = (r) => Object.entries(brush).every(([k, [a, b]]) => r.v[k] >= a && r.v[k] <= b)
  const path = (r) => {
    const P = r.v.map((v, k) => [X(k), Y(k, v)])
    if (!curved) return 'M' + P.map((q) => q.join(',')).join('L')
    let d = `M${P[0]}`
    for (let k = 1; k < P.length; k++) { const mx = (P[k - 1][0] + P[k][0]) / 2; d += `C${mx},${P[k - 1][1]} ${mx},${P[k][1]} ${P[k]}` }
    return d
  }
  const local = (e) => { const b = svgRef.current.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top] }
  const shown = rows.filter(passes).length
  const reveal = ease(p)

  return (
    <Card wrapRef={(el) => { wrap.current = el; boxRef.current = el }} {...{ width, background, color, textColor, mutedColor, size, title, subtitle, tip }}
      legend={<div style={{ fontSize: '0.85em', color: mutedColor, textAlign: 'right' }}><b style={{ color: textColor }}>{shown}</b>{` of ${rows.length} shown`}{Object.keys(brush).length > 0 && <button type="button" onClick={() => setBrush({})} style={{ marginLeft: '0.8em', font: 'inherit', color: textColor, background: 'transparent', border: `1px solid ${mutedColor}55`, borderRadius: 99, padding: '0.15em 0.7em', cursor: 'pointer' }}>Clear filters</button>}</div>}
    >
      <svg ref={svgRef} width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}. Parallel coordinates of ${rows.length} items across ${dims.join(', ')}.`} style={{ display: 'block', maxWidth: '100%', overflow: 'visible', userSelect: 'none', touchAction: 'none' }}
        onPointerMove={(e) => { if (!drag) return; const [, y] = local(e); setDrag({ ...drag, y1: clamp(y, m.t, m.t + ph) }) }}
        onPointerUp={() => {
          if (!drag) return
          const { k, y0, y1 } = drag
          setBrush((b) => { const nb = { ...b }; if (Math.abs(y1 - y0) < 4) delete nb[k]; else nb[k] = [Math.min(V(k, y0), V(k, y1)), Math.max(V(k, y0), V(k, y1))]; return nb })
          setDrag(null)
        }}
        onPointerLeave={() => { setDrag(null); setHov(-1); setTip(null) }}
      >
        <defs><clipPath id={`${id}r`}><rect x="0" y="-10" width={m.l + pw * reveal + 4} height={H + 20} /></clipPath></defs>
        <g clipPath={`url(#${id}r)`}>
          {rows.map((r, i) => {
            const ok = passes(r)
            if (ok) return null
            return <path key={`o${i}`} d={path(r)} fill="none" stroke={mutedColor} strokeOpacity="0.08" strokeWidth="1" />
          })}
          {rows.map((r, i) => {
            if (!passes(r)) return null
            const c = lineColor(r)
            return (
              <path key={i} d={path(r)} fill="none" stroke={c} strokeOpacity={hov < 0 ? lineOpacity : hov === i ? 1 : 0.12} strokeWidth={hov === i ? strokeWidth * 2 : strokeWidth} style={{ transition: 'stroke-opacity .15s', filter: hov === i ? `drop-shadow(0 0 ${size * 0.5}px ${c})` : undefined }}
                onPointerEnter={(e) => { if (drag) return; setHov(i); tooltip && setTip(tipAt(e, wrap, r.label, dims.map((d, k) => ({ label: d, value: String(r.v[k]), strong: k === ck, color: k === ck ? c : undefined })))) }}
                onPointerMove={(e) => tooltip && !drag && setTip((t) => (t ? { ...t, ...tipAt(e, wrap, t.title, t.rows) } : t))}
                onPointerLeave={() => { setHov(-1); setTip(null) }}
              />
            )
          })}
        </g>
        {dims.map((d, k) => {
          const x = X(k)
          const b = brush[k]
          const live = drag && drag.k === k
          return (
            <g key={k}>
              <line x1={x} x2={x} y1={m.t} y2={m.t + ph} stroke={textColor} strokeOpacity="0.45" />
              {ticksOf(ranges[k]).map((t, i) => (
                <g key={i} style={{ pointerEvents: 'none' }}>
                  <line x1={x - 3} x2={x + 3} y1={Y(k, t)} y2={Y(k, t)} stroke={textColor} strokeOpacity="0.45" />
                  <text x={x + (k === D - 1 ? -6 : 6)} y={Y(k, t)} dy="0.34em" textAnchor={k === D - 1 ? 'end' : 'start'} fontSize={size * 0.68} fill={mutedColor} stroke={background} strokeWidth="3" paintOrder="stroke">{axisFmt.format(t)}</text>
                </g>
              ))}
              <text x={x} y={m.t - size * 0.9} textAnchor="middle" fontSize={size * 0.85} fontWeight={k === ck ? 750 : 600} fill={k === ck ? color : textColor}>{d}</text>
              {b && !live && <rect x={x - 7} y={Y(k, b[1])} width="14" height={Y(k, b[0]) - Y(k, b[1])} rx="4" fill={textColor} fillOpacity="0.18" stroke={textColor} strokeOpacity="0.6" />}
              {live && <rect x={x - 7} y={Math.min(drag.y0, drag.y1)} width="14" height={Math.abs(drag.y1 - drag.y0)} rx="4" fill={textColor} fillOpacity="0.18" stroke={textColor} strokeOpacity="0.6" />}
              {brushable && <rect x={x - 12} y={m.t} width="24" height={ph} fill="transparent" style={{ cursor: 'ns-resize' }} onPointerDown={(e) => { e.preventDefault(); const [, y] = local(e); setDrag({ k, y0: y, y1: y }); setTip(null) }} />}
            </g>
          )
        })}
      </svg>
    </Card>
  )
}
