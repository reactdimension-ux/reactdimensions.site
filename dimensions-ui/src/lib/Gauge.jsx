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

// Gauge: one value on a dial between `min` and `max`. The arc can be a half circle,
// three-quarters or a full ring; coloured zones mark bad / ok / good, a needle swings to
// the value on a spring, ticks and labels run around the rim, and a target marker shows
// the goal. Turn on `autoplay` to wander through values as a demo.
export default function Gauge({
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
  thickness = 16,
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
  width = 420,
  size = 13,
  lowColor = '#e5534b',
  midColor = '#e0a030',
  highColor = '#4eba65',
  needleColor = '#ececec',
  trackColor = '#25272c',
  background = '#111214',
  textColor = '#ececec',
  mutedColor = '#8b8f98',
}) {
  const [boxRef, boxW] = useWidth()
  const fmt = makeFmt({ decimals, prefix, suffix })
  const [goal, setGoal] = useState(value)
  const [v, setV] = useState(min)
  const sim = useRef({ x: min, vel: 0 })

  useEffect(() => {
    if (!autoplay) return setGoal(value)
    const t = setInterval(() => setGoal(min + Math.random() * (max - min)), 2400)
    setGoal(min + Math.random() * (max - min))
    return () => clearInterval(t)
  }, [autoplay, value, min, max])
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
      if (reduce || Math.abs(goal - s.x) > (max - min) * 0.0005 || Math.abs(s.vel) > 0.01) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [goal, stiffness, damping, min, max])

  const W = Math.max(220, Math.min(width, boxW || width) - size * 2.8)
  const sweep = arc === 'half' ? 180 : arc === 'full' ? 300 : 260
  const start = -sweep / 2
  const R = W / 2 - size * 2.4
  const cx = W / 2
  const cy = R + size * 1.6
  const textY = style === 'needle' ? cy + R * 0.42 : cy + size * 0.4
  const H = Math.max(textY + size * 3.4, cy - Math.cos((sweep / 2) * (Math.PI / 180)) * R + size * 1.2)
  const span = max - min || 1
  const f = (x) => clamp((x - min) / span, 0, 1)
  const toA = (x) => ((start + f(x) * sweep) * Math.PI) / 180
  const pt = (a, r) => [cx + Math.sin(a) * r, cy - Math.cos(a) * r]
  const arcD = (a0, a1, r) => {
    const [x0, y0] = pt(a0, r)
    const [x1, y1] = pt(a1, r)
    return `M${x0},${y0}A${r},${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1},${y1}`
  }
  const zs = splitNames(zones).map(num).filter((z) => z > min && z < max).sort((a, b) => a - b)
  const bounds = [min, ...zs, max]
  const lowBad = zoneMode === 'low is bad'
  const zoneColor = (i, n) => {
    const t = n > 1 ? i / (n - 1) : 1
    const c = t < 0.5 ? mix(lowColor, midColor, t * 2) : mix(midColor, highColor, (t - 0.5) * 2)
    return lowBad ? c : t < 0.5 ? mix(highColor, midColor, t * 2) : mix(midColor, lowColor, (t - 0.5) * 2)
  }
  const zi = bounds.findIndex((b, i) => i < bounds.length - 1 && goal >= b && goal <= bounds[i + 1])
  const cur = zoneColor(Math.max(0, zi), bounds.length - 1)
  const a = toA(v)
  const ticks = []
  const MJ = clamp(Math.round(majorTicks), 1, 12)
  const MN = clamp(Math.round(minorTicks), 0, 9)
  for (let i = 0; i <= MJ; i++) {
    ticks.push({ x: min + (span * i) / MJ, major: true })
    if (i < MJ) for (let k = 1; k <= MN; k++) ticks.push({ x: min + (span * (i + k / (MN + 1))) / MJ, major: false })
  }
  const rIn = R - thickness

  return (
    <Card wrapRef={(el) => (boxRef.current = el)} {...{ width, background, color: cur, textColor, mutedColor, size, title, subtitle }}>
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="meter"
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={Math.round(goal)}
        style={{ display: 'block', maxWidth: '100%', margin: '0 auto', overflow: 'visible' }}
      >
        <path d={arcD(toA(min), toA(max), R - thickness / 2)} fill="none" stroke={trackColor} strokeWidth={thickness} strokeLinecap="round" />
        {showZones && bounds.slice(0, -1).map((b, i) => (
          <path key={i} d={arcD(toA(b) + 0.012, toA(bounds[i + 1]) - 0.012, R + 5)} fill="none" stroke={zoneColor(i, bounds.length - 1)} strokeWidth="3" strokeLinecap="round" opacity="0.85" />
        ))}
        {(
          <path d={arcD(toA(min), Math.max(toA(min) + 0.001, a), R - thickness / 2)} fill="none" stroke={cur} strokeWidth={thickness} strokeLinecap="round" style={{ filter: `drop-shadow(0 0 ${size * 0.7}px ${cur}88)`, transition: 'stroke .4s' }} opacity={style === 'needle' ? 0.9 : 1} />
        )}
        {showTicks && ticks.map((t, i) => {
          const ta = toA(t.x)
          const [x0, y0] = pt(ta, rIn - 4)
          const [x1, y1] = pt(ta, rIn - (t.major ? 12 : 7))
          const [lx, ly] = pt(ta, rIn - 12 - size * 0.9)
          return (
            <g key={i}>
              <line x1={x0} y1={y0} x2={x1} y2={y1} stroke={mutedColor} strokeOpacity={t.major ? 0.8 : 0.4} strokeWidth={t.major ? 1.6 : 1} />
              {t.major && R > 90 && <text x={lx} y={ly} dy="0.34em" textAnchor="middle" fontSize={size * 0.72} fill={mutedColor}>{axisFmt.format(t.x)}</text>}
            </g>
          )
        })}
        {target > min && target < max && (() => {
          const ta = toA(target)
          const [x0, y0] = pt(ta, R + 9)
          const [x1, y1] = pt(ta, R - thickness - 2)
          return <line x1={x0} y1={y0} x2={x1} y2={y1} stroke={textColor} strokeWidth="2.4" strokeLinecap="round" />
        })()}
        {style === 'needle' && (
          <g style={{ pointerEvents: 'none' }}>
            <path d={`M${pt(a + Math.PI / 2, 5).join(',')}L${pt(a, rIn - 6).join(',')}L${pt(a - Math.PI / 2, 5).join(',')}Z`} fill={needleColor} style={{ filter: `drop-shadow(0 2px 4px #0009)` }} />
            <circle cx={cx} cy={cy} r={9} fill={needleColor} />
            <circle cx={cx} cy={cy} r={4} fill={background} />
          </g>
        )}
        <text x={cx} y={textY} textAnchor="middle" fontSize={Math.min(size * 3, R * 0.36)} fontWeight="800" fill={textColor} style={{ fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>{fmt(v)}</text>
        <text x={cx} y={textY + size * 1.5} textAnchor="middle" fontSize={size * 0.85} fill={mutedColor}>{label}</text>
        {target > min && target < max && <text x={cx} y={textY + size * 2.8} textAnchor="middle" fontSize={size * 0.75} fill={mutedColor}>{`Target ${fmt(target)}`}</text>}
      </svg>
    </Card>
  )
}
