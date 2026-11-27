import { useEffect, useId, useMemo, useRef, useState } from 'react'

// ---- flat infographic helpers (kept inline so this file copies out on its own) ----
// Data is a plain string: rows are separated by commas, each row is "Label:value",
// e.g. "Jan:42, Feb:58". An array of { label, value } works too.

const FONT = '"Poppins", "Nunito", ui-rounded, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif'
const num = (v) => {
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : 0
}
function parseRows(data) {
  if (Array.isArray(data)) return data.map((d) => ({ label: String(d.label ?? ''), value: num(d.value) }))
  return String(data ?? '')
    .split(/[,\n;]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const i = s.lastIndexOf(':')
      return { label: i < 0 ? s : s.slice(0, i).trim(), value: num(i < 0 ? 0 : s.slice(i + 1)) }
    })
}
function makeFmt({ decimals = 0, prefix = '', suffix = '' }) {
  const d = Math.max(0, Math.min(6, Math.round(decimals)))
  const nf = new Intl.NumberFormat('en', { minimumFractionDigits: d, maximumFractionDigits: d })
  return (v) => `${prefix}${nf.format(v)}${suffix}`
}
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
// springy ease-out with a small overshoot, for the flat "pop" feel
const pop = (x) => (x >= 1 ? 1 : 1 + 2.2 * (x - 1) ** 3 + 1.2 * (x - 1) ** 2)
const ease = (x) => 1 - (1 - x) ** 3
// each item starts a little after the one before it
const stag = (p, i, n) => Math.min(1, Math.max(0, (p - (n > 1 ? (i / (n - 1)) * 0.4 : 0)) / 0.6))
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
// blend two #rrggbb colours
function mix(a, b, t) {
  const h = (c) => [1, 3, 5].map((i) => parseInt(String(c).slice(i, i + 2), 16) || 0)
  const [A, B] = [h(a), h(b)]
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('')
}
const paletteOf = (n, base) => Array.from({ length: n }, (_, i) => base[i % base.length])
// a rect path with a radius for each corner [top-left, top-right, bottom-right, bottom-left]
function rrect(x, y, w, h, r = [0, 0, 0, 0]) {
  w = Math.max(0, w)
  h = Math.max(0, h)
  const [a, b, c, d] = r.map((v) => Math.max(0, Math.min(v, w / 2, h / 2)))
  return `M${x + a},${y}H${x + w - b}Q${x + w},${y} ${x + w},${y + b}V${y + h - c}Q${x + w},${y + h} ${x + w - c},${y + h}H${x + d}Q${x},${y + h} ${x},${y + h - d}V${y + a}Q${x},${y} ${x + a},${y}Z`
}
function tipAt(e, wrap, title, rows) {
  const box = wrap.current?.getBoundingClientRect()
  if (!box) return null
  return { x: clamp(e.clientX - box.left, 70, Math.max(70, box.width - 70)), y: e.clientY - box.top - 12, title, rows }
}
// the flat card: solid surface, no glow, a soft drop shadow and a chunky title
function Card({ wrapRef, width, background, textColor, mutedColor, size, title, subtitle, children, tip }) {
  return (
    <div
      ref={wrapRef}
      style={{
        position: 'relative',
        width: `min(${width}px, 100%)`,
        boxSizing: 'border-box',
        padding: '1.4em 1.5em 1.2em',
        borderRadius: 22,
        color: textColor,
        fontFamily: FONT,
        fontSize: size,
        lineHeight: 1.35,
        background,
        boxShadow: `0 18px 40px -24px ${mix(textColor, background, 0.3)}66`,
      }}
    >
      {(title || subtitle) && (
        <div style={{ marginBottom: '0.8em' }}>
          {title && <div style={{ fontSize: '1.3em', fontWeight: 700, letterSpacing: '-0.01em' }}>{title}</div>}
          {subtitle && <div style={{ color: mutedColor, fontSize: '0.88em', marginTop: '0.15em' }}>{subtitle}</div>}
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
            padding: '0.5em 0.8em',
            borderRadius: 12,
            background: textColor,
            color: background,
            fontSize: '0.88em',
            whiteSpace: 'nowrap',
            zIndex: 5,
          }}
        >
          <div style={{ fontWeight: 700 }}>{tip.title}</div>
          {tip.rows?.map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5em' }}>
              {r.color && <i style={{ width: '0.65em', height: '0.65em', borderRadius: '50%', background: r.color, flex: 'none' }} />}
              <span style={{ flex: 1, opacity: 0.75 }}>{r.label}</span>
              <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', marginLeft: '0.8em' }}>{r.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
// ---- end flat helpers ----

// Flat infographic bar chart: chunky rounded bars, one flat colour each, a diagonal
// stripe band on top, axis lines ending in arrowheads and big value labels. Bars pop
// up one after another; hover dims the rest and shows a tooltip.
export default function FlatBarChart({
  data = 'Jan:32, Feb:48, Mar:41, Apr:66, May:58, Jun:82',
  title = 'Monthly sales',
  subtitle = 'Units sold, first half of the year',
  orientation = 'vertical',
  barRadius = 12,
  gap = 0.34,
  stripes = true,
  stripeWidth = 5,
  showValues = true,
  showAxis = true,
  axisArrows = true,
  showTrack = true,
  colorByBar = true,
  tooltip = true,
  animate = true,
  duration = 1200,
  decimals = 0,
  prefix = '',
  suffix = '',
  width = 600,
  height = 300,
  size = 13,
  color = '#4a7fe8',
  color2 = '#ef5b7f',
  color3 = '#14a89e',
  color4 = '#f08a24',
  color5 = '#8e5fd6',
  color6 = '#c49a12',
  background = '#ffffff',
  trackColor = '#eef0f6',
  textColor = '#2b2f3a',
  mutedColor = '#8a90a0',
}) {
  const uid = useId().replace(/:/g, '')
  const wrap = useRef(null)
  const [boxRef, boxW] = useWidth()
  const fmt = makeFmt({ decimals, prefix, suffix })
  const rows = useMemo(() => parseRows(data).map((r) => ({ ...r, value: Math.max(0, r.value) })), [data])
  const cols = colorByBar ? paletteOf(rows.length, [color, color2, color3, color4, color5, color6]) : rows.map(() => color)
  const p = useReveal(animate, duration, `${data}|${orientation}`)
  const [hov, setHov] = useState(-1)
  const [tip, setTip] = useState(null)

  const horiz = orientation === 'horizontal'
  const W = Math.max(240, (boxW || width) - size * 3)
  const H = height
  const max = Math.max(1, ...rows.map((r) => r.value)) * 1.12
  const n = Math.max(1, rows.length)
  // plot box, leaving room for labels and the axis arrows
  const labW = horiz ? Math.min(W * 0.3, size * 0.62 * Math.max(3, ...rows.map((r) => r.label.length)) + 10) : 0
  const L = horiz ? labW + 6 : 6
  const T = horiz ? 4 : size * 1.8
  const R = horiz ? size * 3.2 : 14
  const B = horiz ? 14 : size * 2
  const pw = W - L - R
  const ph = H - T - B
  const band = (horiz ? ph : pw) / n
  const thick = band * (1 - clamp(gap, 0.05, 0.85))
  const rad = Math.min(barRadius, thick / 2)

  const bars = rows.map((r, i) => {
    const k = pop(stag(p, i, n))
    const len = ((horiz ? pw : ph) * r.value * k) / max
    const at = band * i + (band - thick) / 2
    return horiz
      ? { ...r, i, x: L, y: T + at, w: len, h: thick, trackD: rrect(L, T + at, pw, thick, [0, rad, rad, 0]), d: rrect(L, T + at, len, thick, [0, rad, rad, 0]) }
      : { ...r, i, x: L + at, y: T + ph - len, w: thick, h: len, trackD: rrect(L + at, T, thick, ph, [rad, rad, 0, 0]), d: rrect(L + at, T + ph - len, thick, len, [rad, rad, 0, 0]) }
  })
  const enter = (e, b) => {
    setHov(b.i)
    if (tooltip) setTip(tipAt(e, wrap, b.label, [{ color: cols[b.i], label: 'Value', value: fmt(b.value) }]))
  }

  return (
    <Card wrapRef={(el) => { wrap.current = el; boxRef.current = el }} {...{ width, background, textColor, mutedColor, size, title, subtitle, tip }}>
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${title}. Bar chart. ${rows.map((r) => `${r.label}: ${fmt(r.value)}`).join('; ')}`}
        style={{ display: 'block', overflow: 'visible' }}
        onMouseLeave={() => { setHov(-1); setTip(null) }}
      >
        <defs>
          <pattern id={`st${uid}`} width={stripeWidth * 2} height={stripeWidth * 2} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width={stripeWidth} height={stripeWidth * 2} fill="#ffffff" opacity="0.35" />
          </pattern>
          <marker id={`ar${uid}`} viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,1 L9,5 L0,9 Z" fill={mutedColor} />
          </marker>
        </defs>

        {showTrack && bars.map((b) => <path key={`t${b.i}`} d={b.trackD} fill={trackColor} />)}

        {bars.map((b) => {
          const c = cols[b.i]
          const dim = hov >= 0 && hov !== b.i
          // stripe band: the top (or right) 28% of the bar
          const sb = horiz ? { x: b.x + b.w * 0.72, y: b.y, w: b.w * 0.28, h: b.h } : { x: b.x, y: b.y, w: b.w, h: b.h * 0.28 }
          return (
            <g key={b.i} opacity={dim ? 0.4 : 1} style={{ transition: 'opacity .2s' }} onMouseEnter={(e) => enter(e, b)} onMouseMove={(e) => tooltip && setTip((t) => (t ? { ...t, ...tipAt(e, wrap, t.title, t.rows) } : t))}>
              <path d={b.d} fill={c} />
              {stripes && b.h > 2 && b.w > 2 && (
                <>
                  <clipPath id={`c${uid}${b.i}`}><path d={b.d} /></clipPath>
                  <g clipPath={`url(#c${uid}${b.i})`}>
                    <rect x={sb.x} y={sb.y} width={sb.w} height={sb.h} fill={mix(c, '#000000', 0.12)} />
                    <rect x={sb.x} y={sb.y} width={sb.w} height={sb.h} fill={`url(#st${uid})`} />
                  </g>
                </>
              )}
              {/* a hit area bigger than the mark */}
              <path d={b.trackD} fill="transparent" />
              {showValues && p > 0.15 && (
                <text
                  x={horiz ? b.x + b.w + 8 : b.x + b.w / 2}
                  y={horiz ? b.y + b.h / 2 : b.y - 8}
                  dy={horiz ? '0.35em' : 0}
                  textAnchor={horiz ? 'start' : 'middle'}
                  fontSize={size * 1.05}
                  fontWeight="700"
                  fill={textColor}
                  style={{ fontVariantNumeric: 'tabular-nums', pointerEvents: 'none' }}
                >
                  {fmt(b.value * ease(stag(p, b.i, n)))}
                </text>
              )}
              <text
                x={horiz ? L - 10 : b.x + b.w / 2}
                y={horiz ? b.y + b.h / 2 : T + ph + size * 1.4}
                dy={horiz ? '0.35em' : 0}
                textAnchor={horiz ? 'end' : 'middle'}
                fontSize={size * 0.9}
                fontWeight="600"
                fill={hov === b.i ? textColor : mutedColor}
                style={{ pointerEvents: 'none' }}
              >
                {b.label}
              </text>
            </g>
          )
        })}

        {showAxis && (
          <g stroke={mutedColor} strokeWidth="2" strokeLinecap="round" fill="none">
            <path d={`M${L},${T + ph}H${L + pw + R * 0.6}`} markerEnd={axisArrows ? `url(#ar${uid})` : undefined} />
            <path d={`M${L},${T + ph}V${T - (horiz ? 0 : size)}`} markerEnd={axisArrows ? `url(#ar${uid})` : undefined} />
          </g>
        )}
      </svg>
    </Card>
  )
}
