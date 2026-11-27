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

// Population pyramid: two sets of bars mirrored around a centre column, for comparing
// two groups across ordered categories (age bands by sex, say). Rows are
// "Band:left|right". Show counts or each side's percentage, put the labels in the middle
// or on the left, and hover a band to compare both sides.
export default function PopulationPyramid({
  data = '85+:1.1|2.0, 75-84:3.0|3.8, 65-74:5.2|5.8, 55-64:6.4|6.7, 45-54:6.6|6.6, 35-44:6.8|6.7, 25-34:7.0|6.8, 15-24:6.1|5.8, 5-14:5.6|5.3, 0-4:2.6|2.5',
  leftLabel = 'Male',
  rightLabel = 'Female',
  title = 'Population by age',
  subtitle = 'Millions of people',
  normalize = false,
  centerLabels = true,
  barRadius = 4,
  gap = 0.18,
  showValues = true,
  showGrid = true,
  tooltip = true,
  animate = true,
  duration = 1300,
  decimals = 1,
  prefix = '',
  suffix = 'M',
  width = 640,
  height = 330,
  size = 13,
  leftColor = '#5b9bd5',
  rightColor = '#d77757',
  background = '#111214',
  textColor = '#ececec',
  mutedColor = '#8b8f98',
}) {
  const id = useId().replace(/:/g, '')
  const wrap = useRef(null)
  const [boxRef, boxW] = useWidth()
  const rows = useMemo(() => parseRows(data).map((r) => ({ label: r.label, a: Math.max(0, r.values[0] ?? 0), b: Math.max(0, r.values[1] ?? 0) })), [data])
  const sumA = rows.reduce((s, r) => s + r.a, 0) || 1
  const sumB = rows.reduce((s, r) => s + r.b, 0) || 1
  const valA = (r) => (normalize ? (r.a / sumA) * 100 : r.a)
  const valB = (r) => (normalize ? (r.b / sumB) * 100 : r.b)
  const fmt = normalize ? (v) => `${v.toFixed(1)}%` : makeFmt({ decimals, prefix, suffix })
  const n = rows.length
  const p = useReveal(animate, duration, `${data}|${normalize}`)
  const [hov, setHov] = useState(-1)
  const [tip, setTip] = useState(null)

  const W = Math.max(280, (boxW || width) - size * 2.8)
  const H = height
  const maxLab = Math.max(...rows.map((r) => r.label.length))
  const mid = centerLabels ? maxLab * size * 0.6 + 18 : 4
  const m = { l: centerLabels ? 6 : maxLab * size * 0.6 + 14, r: 6, t: size * 1.8, b: size * 1.9 }
  const half = (W - m.l - m.r - mid) / 2
  const cx = m.l + half + mid / 2
  const ph = H - m.t - m.b
  const band = ph / Math.max(1, n)
  const bh = band * (1 - clamp(gap, 0.02, 0.7))
  const top = niceRange(0, Math.max(...rows.map((r) => Math.max(valA(r), valB(r)))), 3)
  const len = (v) => (v / top.hi) * (half - (showValues ? size * 3 : 4))
  const ticks = ticksOf(top)

  return (
    <Card wrapRef={(el) => { wrap.current = el; boxRef.current = el }} {...{ width, background, color: leftColor, textColor, mutedColor, size, title, subtitle, tip }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}. Population pyramid, ${leftLabel} and ${rightLabel}. ${rows.map((r) => `${r.label}: ${fmt(valA(r))} and ${fmt(valB(r))}`).join('; ')}`} style={{ display: 'block', maxWidth: '100%', overflow: 'visible' }} onMouseLeave={() => { setHov(-1); setTip(null) }}>
        <defs>
          <linearGradient id={`${id}l`} x1="1" y1="0" x2="0" y2="0"><stop offset="0" stopColor={leftColor} stopOpacity="0.55" /><stop offset="1" stopColor={leftColor} /></linearGradient>
          <linearGradient id={`${id}r`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor={rightColor} stopOpacity="0.55" /><stop offset="1" stopColor={rightColor} /></linearGradient>
        </defs>
        <text x={cx - mid / 2 - 4} y={size} textAnchor="end" fontSize={size * 0.9} fontWeight="700" fill={leftColor}>{`◀ ${leftLabel}`}</text>
        <text x={cx + mid / 2 + 4} y={size} fontSize={size * 0.9} fontWeight="700" fill={rightColor}>{`${rightLabel} ▶`}</text>
        {ticks.map((t, i) => (
          <g key={i} style={{ pointerEvents: 'none' }}>
            {[-1, 1].map((s) => {
              const x = s < 0 ? cx - mid / 2 - len(t) : cx + mid / 2 + len(t)
              return (
                <g key={s}>
                  {showGrid && t > 0 && <line x1={x} x2={x} y1={m.t} y2={m.t + ph} stroke={mutedColor} strokeOpacity="0.14" strokeDasharray="2 5" />}
                  <text x={x} y={H - 4} textAnchor="middle" fontSize={size * 0.76} fill={mutedColor}>{normalize ? `${t}%` : axisFmt.format(t)}</text>
                </g>
              )
            })}
          </g>
        ))}
        {rows.map((r, i) => {
          const ip = stag(p, i, n)
          const y = m.t + i * band + (band - bh) / 2
          const la = len(valA(r)) * ip
          const lb = len(valB(r)) * ip
          const on = hov < 0 || hov === i
          return (
            <g key={i} opacity={on ? 1 : 0.4} style={{ transition: 'opacity .2s' }}
              onMouseEnter={(e) => { setHov(i); tooltip && setTip(tipAt(e, wrap, r.label, [{ color: leftColor, label: leftLabel, value: fmt(valA(r)) }, { color: rightColor, label: rightLabel, value: fmt(valB(r)) }, { label: `${rightLabel} − ${leftLabel}`, value: `${valB(r) - valA(r) >= 0 ? '+' : '−'}${fmt(Math.abs(valB(r) - valA(r)))}`, strong: true }])) }}
              onMouseMove={(e) => tooltip && setTip((t) => (t ? { ...t, ...tipAt(e, wrap, t.title, t.rows) } : t))}
            >
              <rect x={0} y={m.t + i * band} width={W} height={band} fill="transparent" />
              <path d={rrect(cx - mid / 2 - la, y, la, bh, [barRadius, 0, 0, barRadius])} fill={`url(#${id}l)`} />
              <path d={rrect(cx + mid / 2, y, lb, bh, [0, barRadius, barRadius, 0])} fill={`url(#${id}r)`} />
              {showValues && ip > 0.85 && (
                <>
                  <text x={cx - mid / 2 - la - 6} y={y + bh / 2} dy="0.34em" textAnchor="end" fontSize={size * 0.74} fill={mutedColor}>{fmt(valA(r))}</text>
                  <text x={cx + mid / 2 + lb + 6} y={y + bh / 2} dy="0.34em" fontSize={size * 0.74} fill={mutedColor}>{fmt(valB(r))}</text>
                </>
              )}
              <text x={centerLabels ? cx : m.l - 10} y={y + bh / 2} dy="0.34em" textAnchor={centerLabels ? 'middle' : 'end'} fontSize={size * 0.82} fontWeight={hov === i ? 700 : 500} fill={hov === i ? textColor : mutedColor}>{r.label}</text>
            </g>
          )
        })}
      </svg>
    </Card>
  )
}
