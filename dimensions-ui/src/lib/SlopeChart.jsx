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

// Slope chart: each item's value at two moments joined by a line, so rises and falls
// stand out at a glance. Items are "Name:before|after". Lines are coloured by direction
// (or one colour), labels on both sides are spaced so they don't collide, and listing
// names in `highlight` (or hovering) brings those lines forward.
export default function SlopeChart({
  data = 'Python:28|31, JavaScript:24|21, TypeScript:9|17, Java:14|10, C#:8|8, Go:4|7, Rust:2|6, PHP:7|4, Ruby:4|2',
  startLabel = '2021',
  endLabel = '2025',
  title = 'Language popularity',
  subtitle = 'Share of new projects, %',
  colorMode = 'direction',
  highlight = '',
  strokeWidth = 2.6,
  dotSize = 5,
  showValues = true,
  zeroBased = false,
  tooltip = true,
  animate = true,
  duration = 1400,
  decimals = 0,
  prefix = '',
  suffix = '%',
  width = 560,
  height = 340,
  size = 13,
  upColor = '#4eba65',
  downColor = '#e5534b',
  flatColor = '#8b8f98',
  color = '#d77757',
  background = '#111214',
  textColor = '#ececec',
  mutedColor = '#8b8f98',
}) {
  const wrap = useRef(null)
  const [boxRef, boxW] = useWidth()
  const fmt = makeFmt({ decimals, prefix, suffix })
  const rows = useMemo(() => parseRows(data).map((r) => ({ label: r.label, a: r.values[0] ?? 0, b: r.values[1] ?? r.values[0] ?? 0 })), [data])
  const hl = new Set(splitNames(highlight))
  const p = useReveal(animate, duration, data)
  const [hov, setHov] = useState(-1)
  const [tip, setTip] = useState(null)

  const all = rows.flatMap((r) => [r.a, r.b])
  const lo = zeroBased ? 0 : Math.min(...all)
  const hi = Math.max(...all)
  const W = Math.max(280, (boxW || width) - size * 2.8)
  const H = height
  const maxLab = Math.min(16, Math.max(...rows.map((r) => r.label.length)))
  const side = maxLab * size * 0.58 + (showValues ? size * 3 : 0) + 18
  const m = { l: side, r: side, t: size * 2.2, b: 10 }
  const ph = H - m.t - m.b
  const x0 = m.l
  const x1 = W - m.r
  const Y = (v) => m.t + ph - ((v - lo) / (hi - lo || 1)) * ph
  const colorOf = (r) => (colorMode === 'single' ? color : r.b > r.a ? upColor : r.b < r.a ? downColor : flatColor)
  // spread labels on each side so they never overlap
  const spread = (key) => {
    const L = rows.map((r, i) => ({ i, y: Y(r[key]) })).sort((a, b) => a.y - b.y)
    for (let k = 1; k < L.length; k++) if (L[k].y - L[k - 1].y < size * 1.15) L[k].y = L[k - 1].y + size * 1.15
    const over = L.length ? L[L.length - 1].y - (H - 4) : 0
    if (over > 0) L.forEach((l) => (l.y -= over))
    return Object.fromEntries(L.map((l) => [l.i, l.y]))
  }
  const ya = spread('a')
  const yb = spread('b')
  const focus = (i) => hov === i || (hov < 0 && (hl.size === 0 || hl.has(rows[i].label)))
  const order = rows.map((_, i) => i).sort((a, b) => Number(focus(a)) - Number(focus(b)))

  return (
    <Card wrapRef={(el) => { wrap.current = el; boxRef.current = el }} {...{ width, background, color, textColor, mutedColor, size, title, subtitle, tip }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}. Slope chart from ${startLabel} to ${endLabel}. ${rows.map((r) => `${r.label}: ${fmt(r.a)} to ${fmt(r.b)}`).join('; ')}`} style={{ display: 'block', maxWidth: '100%', overflow: 'visible' }} onMouseLeave={() => { setHov(-1); setTip(null) }}>
        <text x={x0} y={size} textAnchor="middle" fontSize={size * 0.9} fontWeight="700" fill={textColor}>{startLabel}</text>
        <text x={x1} y={size} textAnchor="middle" fontSize={size * 0.9} fontWeight="700" fill={textColor}>{endLabel}</text>
        <line x1={x0} x2={x0} y1={m.t - 6} y2={H - m.b} stroke={mutedColor} strokeOpacity="0.3" />
        <line x1={x1} x2={x1} y1={m.t - 6} y2={H - m.b} stroke={mutedColor} strokeOpacity="0.3" />
        {order.map((i) => {
          const r = rows[i]
          const c = colorOf(r)
          const f = focus(i)
          const ip = stag(p, i, rows.length)
          const xe = x0 + (x1 - x0) * ip
          const ye = Y(r.a + (r.b - r.a) * ip)
          const ch = r.a ? ((r.b - r.a) / Math.abs(r.a)) * 100 : 0
          return (
            <g key={i} opacity={f ? 1 : 0.22} style={{ transition: 'opacity .2s' }}
              onMouseEnter={(e) => { setHov(i); tooltip && setTip(tipAt(e, wrap, r.label, [{ label: startLabel, value: fmt(r.a) }, { label: endLabel, value: fmt(r.b), strong: true, color: c }, { label: 'Change', value: `${r.b - r.a >= 0 ? '+' : '−'}${fmt(Math.abs(r.b - r.a))} (${ch >= 0 ? '+' : ''}${ch.toFixed(0)}%)` }])) }}
              onMouseMove={(e) => tooltip && setTip((t) => (t ? { ...t, ...tipAt(e, wrap, t.title, t.rows) } : t))}
            >
              <line x1={x0} y1={Y(r.a)} x2={x1} y2={Y(r.b)} stroke="transparent" strokeWidth="14" />
              <line x1={x0} y1={Y(r.a)} x2={xe} y2={ye} stroke={c} strokeWidth={hov === i ? strokeWidth * 1.4 : strokeWidth} strokeLinecap="round" style={{ filter: f ? `drop-shadow(0 0 ${size * 0.4}px ${c}88)` : undefined }} />
              <circle cx={x0} cy={Y(r.a)} r={dotSize} fill={background} stroke={c} strokeWidth="2" />
              {ip > 0.98 && <circle cx={x1} cy={Y(r.b)} r={dotSize} fill={c} />}
              <text x={x0 - dotSize - 8} y={ya[i]} dy="0.34em" textAnchor="end" fontSize={size * 0.84} fill={f ? textColor : mutedColor}>
                {r.label.length > 16 ? r.label.slice(0, 15) + '…' : r.label}
                {showValues && <tspan fill={mutedColor} dx="0.5em">{fmt(r.a)}</tspan>}
              </text>
              <text x={x1 + dotSize + 8} y={yb[i]} dy="0.34em" fontSize={size * 0.84} fill={f ? textColor : mutedColor} opacity={ip}>
                {showValues && <tspan fontWeight="700" fill={c}>{fmt(r.b)} </tspan>}
                {r.label.length > 16 ? r.label.slice(0, 15) + '…' : r.label}
              </text>
            </g>
          )
        })}
      </svg>
    </Card>
  )
}
