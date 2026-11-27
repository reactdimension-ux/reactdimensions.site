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

// Waterfall chart: how a total is built up by additions and subtractions. Each step is
// "Label:value"; write "Label:=" for a subtotal bar that shows the running total so far.
// Rises, falls and totals get their own colours, dashed connectors carry the level
// across, and hovering a step shows its change and the running total.
export default function WaterfallChart({
  data = 'Revenue:4200, Cost of sales:-1650, Gross profit:=, Marketing:-620, R&D:-540, Admin:-310, Other income:140, Operating profit:=, Tax:-280, Net income:=',
  title = 'From revenue to net income',
  subtitle = 'USD thousands, fiscal year',
  orientation = 'vertical',
  barRadius = 5,
  gap = 0.28,
  connectors = true,
  showValues = true,
  showGrid = true,
  showAxis = true,
  tooltip = true,
  animate = true,
  duration = 1400,
  valueFormat = 'number',
  decimals = 0,
  prefix = '$',
  suffix = 'k',
  width = 760,
  height = 320,
  size = 13,
  upColor = '#4eba65',
  downColor = '#e5534b',
  totalColor = '#5b9bd5',
  color = '#d77757',
  background = '#111214',
  textColor = '#ececec',
  mutedColor = '#8b8f98',
}) {
  const id = useId().replace(/:/g, '')
  const wrap = useRef(null)
  const [boxRef, boxW] = useWidth()
  const fmt = makeFmt({ valueFormat, decimals, prefix, suffix })
  const steps = useMemo(() => {
    let run = 0
    return String(data ?? '').split(/[,;\n]/).map((s) => s.trim()).filter(Boolean).map((s, i) => {
      const k = s.lastIndexOf(':')
      const label = k < 0 ? s : s.slice(0, k).trim()
      const raw = k < 0 ? '0' : s.slice(k + 1).trim()
      const total = raw === '=' || (i === 0 && !raw.startsWith('-') && !raw.startsWith('+'))
      if (raw === '=') return { label, total: true, from: 0, to: run, v: run }
      const v = num(raw)
      if (total) { run = v; return { label, total: true, from: 0, to: v, v } }
      const from = run
      run += v
      return { label, total: false, from, to: run, v }
    })
  }, [data])
  const n = steps.length
  const p = useReveal(animate, duration, `${data}|${orientation}`)
  const [hov, setHov] = useState(-1)
  const [tip, setTip] = useState(null)

  const horizontal = orientation === 'horizontal'
  const lo = Math.min(0, ...steps.map((s) => Math.min(s.from, s.to)))
  const hi = Math.max(0, ...steps.map((s) => Math.max(s.from, s.to)))
  const sc = niceRange(lo, hi, 5)
  const ticks = ticksOf(sc)
  const W = Math.max(280, (boxW || width) - size * 2.8)
  const H = horizontal ? Math.max(height, n * 30 + 40) : height
  const maxLab = Math.min(18, Math.max(...steps.map((s) => s.label.length)))
  const m = horizontal
    ? { l: maxLab * size * 0.58 + 14, r: size * 5, t: 6, b: showAxis ? size * 2 : 6 }
    : { l: showAxis ? Math.max(...ticks.map((t) => fmt(t).length)) * size * 0.56 + 12 : 6, r: 8, t: size * 1.8, b: size * 2.6 }
  const pw = Math.max(80, W - m.l - m.r)
  const ph = Math.max(60, H - m.t - m.b)
  const band = (horizontal ? ph : pw) / Math.max(1, n)
  const bw = band * (1 - clamp(gap, 0.05, 0.8))
  const V = (v) => (horizontal ? m.l + ((v - sc.lo) / (sc.hi - sc.lo)) * pw : m.t + ph - ((v - sc.lo) / (sc.hi - sc.lo)) * ph)
  const colorOf = (s) => (s.total ? totalColor : s.to >= s.from ? upColor : downColor)

  return (
    <Card
      wrapRef={(el) => { wrap.current = el; boxRef.current = el }}
      {...{ width, background, color, textColor, mutedColor, size, title, subtitle, tip }}
      legend={<Legend items={[{ label: 'Increase', color: upColor }, { label: 'Decrease', color: downColor }, { label: 'Total', color: totalColor }]} mutedColor={mutedColor} />}
    >
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${title}. Waterfall. ${steps.map((s) => `${s.label}: ${s.total ? `total ${fmt(s.to)}` : `${s.v >= 0 ? 'plus' : 'minus'} ${fmt(Math.abs(s.v))}`}`).join('; ')}`}
        style={{ display: 'block', maxWidth: '100%', overflow: 'visible' }}
        onMouseLeave={() => { setHov(-1); setTip(null) }}
      >
        <defs>
          {[upColor, downColor, totalColor].map((c, k) => (
            <linearGradient key={k} id={`${id}g${k}`} x1="0" y1="0" x2={horizontal ? 1 : 0} y2={horizontal ? 0 : 1}>
              <stop offset="0" stopColor={mix(c, '#ffffff', 0.12)} />
              <stop offset="1" stopColor={c} stopOpacity="0.75" />
            </linearGradient>
          ))}
        </defs>
        {ticks.map((t, i) => (
          <g key={i}>
            {(showGrid || t === 0) && (horizontal ? <line x1={V(t)} x2={V(t)} y1={m.t} y2={m.t + ph} stroke={mutedColor} strokeOpacity={t === 0 ? 0.45 : 0.14} strokeDasharray={t === 0 ? undefined : '2 5'} /> : <line x1={m.l} x2={m.l + pw} y1={V(t)} y2={V(t)} stroke={mutedColor} strokeOpacity={t === 0 ? 0.45 : 0.14} strokeDasharray={t === 0 ? undefined : '2 5'} />)}
            {showAxis && (horizontal ? <text x={V(t)} y={m.t + ph + size * 1.4} textAnchor="middle" fontSize={size * 0.8} fill={mutedColor}>{fmt(t)}</text> : <text x={m.l - 9} y={V(t)} dy="0.34em" textAnchor="end" fontSize={size * 0.8} fill={mutedColor}>{fmt(t)}</text>)}
          </g>
        ))}

        {steps.map((s, i) => {
          const ip = stag(p, i, n)
          const end = s.from + (s.to - s.from) * ip
          const a = V(Math.min(s.from, end))
          const b = V(Math.max(s.from, end))
          const pos = (horizontal ? m.t : m.l) + i * band + (band - bw) / 2
          const k = s.total ? 2 : s.to >= s.from ? 0 : 1
          const c = colorOf(s)
          const rect = horizontal ? { x: a, y: pos, w: Math.max(1, b - a), h: bw } : { x: pos, y: b, w: bw, h: Math.max(1, a - b) }
          const next = steps[i + 1]
          const lab = s.total ? fmt(s.to) : `${s.v >= 0 ? '+' : '−'}${fmt(Math.abs(s.v))}`
          const on = hov < 0 || hov === i
          return (
            <g key={i} opacity={on ? 1 : 0.4} style={{ transition: 'opacity .2s' }}
              onMouseEnter={(e) => { setHov(i); tooltip && setTip(tipAt(e, wrap, s.label, [{ color: c, label: s.total ? 'Total' : 'Change', value: lab, strong: true }, { label: 'Running total', value: fmt(s.to) }])) }}
              onMouseMove={(e) => tooltip && setTip((t) => (t ? { ...t, ...tipAt(e, wrap, t.title, t.rows) } : t))}
            >
              <rect x={horizontal ? m.l : pos - (band - bw) / 2} y={horizontal ? pos - (band - bw) / 2 : m.t} width={horizontal ? pw : band} height={horizontal ? band : ph} fill="transparent" />
              <rect x={rect.x} y={rect.y} width={rect.w} height={rect.h} rx={Math.min(barRadius, rect.w / 2, rect.h / 2)} fill={`url(#${id}g${k})`} style={{ filter: hov === i ? `drop-shadow(0 0 ${size * 0.7}px ${c})` : undefined }} />
              {connectors && next && ip > 0.95 && (() => {
                const y = V(s.to)
                return horizontal
                  ? <line x1={y} x2={y} y1={pos + bw} y2={pos + band} stroke={mutedColor} strokeOpacity="0.6" strokeDasharray="3 3" />
                  : <line x1={pos + bw} x2={pos + band} y1={y} y2={y} stroke={mutedColor} strokeOpacity="0.6" strokeDasharray="3 3" />
              })()}
              {showValues && ip > 0.6 && (horizontal
                ? <text x={Math.max(V(s.from), V(s.to)) + 6} y={pos + bw / 2} dy="0.34em" fontSize={size * 0.8} fontWeight="700" fill={s.total ? textColor : c}>{lab}</text>
                : <text x={pos + bw / 2} y={Math.min(V(s.from), V(s.to)) - 6} textAnchor="middle" fontSize={size * 0.8} fontWeight="700" fill={s.total ? textColor : c}>{lab}</text>)}
              {horizontal
                ? <text x={m.l - 10} y={pos + bw / 2} dy="0.34em" textAnchor="end" fontSize={size * 0.88} fontWeight={s.total ? 700 : 400} fill={s.total || hov === i ? textColor : mutedColor}>{s.label}</text>
                : (() => {
                    const words = s.label.split(' ')
                    const lines = s.label.length * size * 0.55 > band && words.length > 1 ? [words.slice(0, Math.ceil(words.length / 2)).join(' '), words.slice(Math.ceil(words.length / 2)).join(' ')] : [s.label]
                    return lines.map((ln, li) => <text key={li} x={pos + bw / 2} y={m.t + ph + size * (1.35 + li * 1.1)} textAnchor="middle" fontSize={size * 0.78} fontWeight={s.total ? 700 : 400} fill={s.total || hov === i ? textColor : mutedColor}>{ln}</text>)
                  })()}
            </g>
          )
        })}
      </svg>
    </Card>
  )
}
