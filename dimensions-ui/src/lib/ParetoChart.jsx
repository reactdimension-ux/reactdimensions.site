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

// Pareto chart: causes sorted from most to least common as bars, with a line for the
// running share of the total on a second axis. The few causes that reach the
// `threshold` (80% by default) are highlighted as the "vital few"; the rest fade back.
// Entries are "Cause:count".
export default function ParetoChart({
  data = 'Late delivery:142, Damaged item:96, Wrong size:71, Missing parts:38, Billing error:27, Rude support:18, Website bug:14, Other:9',
  title = 'Why customers complain',
  subtitle = '415 complaints last quarter',
  threshold = 80,
  showThreshold = true,
  highlight = true,
  showValues = true,
  showGrid = true,
  barRadius = 5,
  gap = 0.25,
  tooltip = true,
  animate = true,
  duration = 1400,
  width = 720,
  height = 300,
  size = 13,
  color = '#d77757',
  lineColor = '#ececec',
  restColor = '#3a3d44',
  background = '#111214',
  textColor = '#ececec',
  mutedColor = '#8b8f98',
}) {
  const id = useId().replace(/:/g, '')
  const wrap = useRef(null)
  const [boxRef, boxW] = useWidth()
  const rows = useMemo(() => {
    const r = parseRows(data).map((x) => ({ label: x.label, v: Math.max(0, x.values[0] ?? 0) })).sort((a, b) => b.v - a.v)
    const tot = r.reduce((a, x) => a + x.v, 0) || 1
    let acc = 0
    return r.map((x) => { acc += x.v; return { ...x, cum: (acc / tot) * 100, share: (x.v / tot) * 100 } })
  }, [data])
  const n = rows.length
  const cut = rows.findIndex((r) => r.cum >= threshold)
  const vital = (i) => !highlight || i <= (cut < 0 ? n - 1 : cut)
  const p = useReveal(animate, duration, data)
  const [hov, setHov] = useState(-1)
  const [tip, setTip] = useState(null)

  const sc = niceRange(0, Math.max(...rows.map((r) => r.v)), 4)
  const ticks = ticksOf(sc)
  const W = Math.max(280, (boxW || width) - size * 2.8)
  const H = height
  const m = { l: Math.max(...ticks.map((t) => axisFmt.format(t).length)) * size * 0.6 + 12, r: size * 3.2, t: 12, b: size * 2.6 }
  const pw = Math.max(80, W - m.l - m.r)
  const ph = Math.max(60, H - m.t - m.b)
  const band = pw / Math.max(1, n)
  const bw = band * (1 - clamp(gap, 0.05, 0.8))
  const Y = (v) => m.t + ph - (v / sc.hi) * ph
  const Yp = (pc) => m.t + ph - (pc / 100) * ph
  const X = (i) => m.l + i * band + band / 2
  const line = rows.map((r, i) => [X(i), Yp(r.cum)])
  const reveal = ease(clamp((p - 0.35) / 0.65, 0, 1))

  return (
    <Card wrapRef={(el) => { wrap.current = el; boxRef.current = el }} {...{ width, background, color, textColor, mutedColor, size, title, subtitle, tip }}
      legend={<Legend items={[{ label: `Vital few (to ${threshold}%)`, color }, { label: 'Cumulative %', color: lineColor }]} mutedColor={mutedColor} />}
    >
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}. Pareto chart. ${rows.map((r) => `${r.label}: ${r.v}, cumulative ${Math.round(r.cum)} percent`).join('; ')}`} style={{ display: 'block', maxWidth: '100%', overflow: 'visible' }} onMouseLeave={() => { setHov(-1); setTip(null) }}>
        <defs>
          <linearGradient id={`${id}g`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={mix(color, '#ffffff', 0.12)} />
            <stop offset="1" stopColor={color} stopOpacity="0.7" />
          </linearGradient>
          <clipPath id={`${id}c`}><rect x="0" y="-10" width={m.l + pw * reveal + 6} height={H + 20} /></clipPath>
        </defs>
        {ticks.map((t, i) => (
          <g key={i}>
            {showGrid && <line x1={m.l} x2={m.l + pw} y1={Y(t)} y2={Y(t)} stroke={mutedColor} strokeOpacity={t === 0 ? 0.4 : 0.14} strokeDasharray={t === 0 ? undefined : '2 5'} />}
            <text x={m.l - 9} y={Y(t)} dy="0.34em" textAnchor="end" fontSize={size * 0.8} fill={mutedColor}>{axisFmt.format(t)}</text>
          </g>
        ))}
        {[0, 25, 50, 75, 100].map((pc) => <text key={pc} x={m.l + pw + 8} y={Yp(pc)} dy="0.34em" fontSize={size * 0.8} fill={mutedColor}>{pc}%</text>)}
        {showThreshold && (
          <g style={{ pointerEvents: 'none' }}>
            <line x1={m.l} x2={m.l + pw} y1={Yp(threshold)} y2={Yp(threshold)} stroke={color} strokeOpacity="0.7" strokeDasharray="6 5" />
            {cut >= 0 && <line x1={m.l + (cut + 1) * band} x2={m.l + (cut + 1) * band} y1={m.t} y2={m.t + ph} stroke={color} strokeOpacity="0.35" strokeDasharray="3 4" />}
          </g>
        )}
        {rows.map((r, i) => {
          const ip = stag(p, i, n)
          const x = m.l + i * band + (band - bw) / 2
          const v = vital(i)
          const on = hov < 0 || hov === i
          const words = r.label.split(' ')
          const lines = r.label.length * size * 0.5 > band && words.length > 1 ? [words.slice(0, Math.ceil(words.length / 2)).join(' '), words.slice(Math.ceil(words.length / 2)).join(' ')] : [r.label]
          return (
            <g key={i} opacity={on ? 1 : 0.45} style={{ transition: 'opacity .2s' }}
              onMouseEnter={(e) => { setHov(i); tooltip && setTip(tipAt(e, wrap, r.label, [{ color: v ? color : restColor, label: 'Count', value: String(r.v), strong: true }, { label: 'Share', value: `${r.share.toFixed(1)}%` }, { label: 'Cumulative', value: `${r.cum.toFixed(1)}%` }])) }}
              onMouseMove={(e) => tooltip && setTip((t) => (t ? { ...t, ...tipAt(e, wrap, t.title, t.rows) } : t))}
            >
              <rect x={m.l + i * band} y={m.t} width={band} height={ph} fill="transparent" />
              <path d={rrect(x, Y(r.v * ip), bw, Math.max(0, Y(0) - Y(r.v * ip)), [barRadius, barRadius, 0, 0])} fill={v ? `url(#${id}g)` : restColor} />
              {showValues && ip > 0.8 && <text x={x + bw / 2} y={Y(r.v) - 6} textAnchor="middle" fontSize={size * 0.78} fontWeight="700" fill={v ? textColor : mutedColor}>{r.v}</text>}
              {lines.map((ln, li) => <text key={li} x={x + bw / 2} y={m.t + ph + size * (1.35 + li * 1.1)} textAnchor="middle" fontSize={size * 0.76} fill={hov === i ? textColor : mutedColor}>{ln}</text>)}
            </g>
          )
        })}
        <g clipPath={`url(#${id}c)`} style={{ pointerEvents: 'none' }}>
          <path d={'M' + line.map((q) => q.join(',')).join('L')} fill="none" stroke={lineColor} strokeWidth="2.2" strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 ${size * 0.4}px ${lineColor}66)` }} />
          {line.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={hov === i ? 5 : 3.4} fill={background} stroke={lineColor} strokeWidth="2" />)}
          {hov >= 0 && <text x={line[hov][0]} y={line[hov][1] - 10} textAnchor="middle" fontSize={size * 0.78} fontWeight="700" fill={lineColor} stroke={background} strokeWidth="3" paintOrder="stroke">{`${rows[hov].cum.toFixed(0)}%`}</text>}
        </g>
      </svg>
    </Card>
  )
}
