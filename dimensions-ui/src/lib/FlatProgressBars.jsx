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

// Flat progress bars: a stack of rounded pill tracks with a flat coloured fill, white
// diagonal stripes on the fill (optionally sliding), the label in a coloured tab, above
// the bar or beside it, and the value at the end. Bars grow in one after another.
export default function FlatProgressBars({
  data = 'Research:50, Design:25, Build:60, Launch:75',
  title = 'Project progress',
  subtitle = 'Completion by phase',
  max = 100,
  variant = 'tab',
  barHeight = 22,
  rowGap = 16,
  roundness = 1,
  stripes = true,
  stripeWidth = 6,
  animatedStripes = false,
  stripeSpeed = 1.2,
  showValues = true,
  colorByBar = true,
  tooltip = true,
  animate = true,
  duration = 1300,
  decimals = 0,
  prefix = '',
  suffix = '%',
  width = 560,
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
  const p = useReveal(animate, duration, `${data}|${variant}|${max}`)
  const [hov, setHov] = useState(-1)
  const [tip, setTip] = useState(null)
  const [still, setStill] = useState(false)
  useEffect(() => setStill(!!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches), [])

  const n = rows.length
  const W = Math.max(220, (boxW || width) - size * 3)
  const bh = clamp(barHeight, 6, 80)
  const rad = (bh / 2) * clamp(roundness, 0, 1)
  const den = Math.max(1e-9, max)
  const longest = Math.max(3, ...rows.map((r) => r.label.length))
  const valW = showValues ? size * 1.1 * 0.6 * Math.max(3, ...rows.map((r) => fmt(r.value).length)) + 14 : 0
  const isTab = variant === 'tab'
  const isInline = variant === 'inline'
  const isStacked = !isTab && !isInline
  // tab: a chunky coloured pill on the left that the track tucks under
  const tabH = bh + 10
  const tabW = isTab ? Math.min(W * 0.4, longest * size * 0.92 * 0.62 + size * 2.2) : 0
  const tabR = (tabH / 2) * clamp(roundness, 0, 1)
  const labW = isInline ? Math.min(W * 0.32, longest * size * 0.92 * 0.6 + 14) : 0
  const x0 = isTab ? tabW / 2 : labW
  const vs = isTab ? tabW : x0
  const x1 = W - valW
  const labelH = isStacked ? size * 1.7 : 0
  const rowH = labelH + (isTab ? tabH : bh)
  const H = Math.max(rowH, n * rowH + (n - 1) * rowGap)
  const sw = Math.max(2, stripeWidth)

  const bars = rows.map((r, i) => {
    const k = pop(stag(p, i, n))
    const frac = clamp(r.value / den, 0, 1)
    const top = i * (rowH + rowGap)
    const cy = top + labelH + (isTab ? tabH : bh) / 2
    const y = cy - bh / 2
    const len = Math.max(0, vs - x0 + (x1 - vs) * frac * k)
    return { ...r, i, top, cy, y, len, k, frac, d: rrect(x0, y, len, bh, [rad, rad, rad, rad]), trackD: rrect(x0, y, x1 - x0, bh, [rad, rad, rad, rad]) }
  })
  const enter = (e, b) => {
    setHov(b.i)
    if (tooltip)
      setTip(tipAt(e, wrap, b.label, [{ color: cols[b.i], label: 'Value', value: fmt(b.value) }, { label: 'Of', value: fmt(max) }]))
  }

  return (
    <Card wrapRef={(el) => { wrap.current = el; boxRef.current = el }} {...{ width, background, textColor, mutedColor, size, title, subtitle, tip }}>
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${title}. Progress bars out of ${fmt(max)}. ${rows.map((r) => `${r.label}: ${fmt(r.value)}`).join('; ')}`}
        style={{ display: 'block', overflow: 'visible' }}
        onMouseLeave={() => { setHov(-1); setTip(null) }}
      >
        <defs>
          {/* 45deg stripes drawn into an unrotated tile so the tile can slide sideways */}
          <pattern id={`st${uid}`} width={sw * 2} height={sw * 2} patternUnits="userSpaceOnUse">
            <path d={`M0,0H${sw}L0,${sw}ZM${sw * 2},0V${sw}L${sw},${sw * 2}H0Z`} fill={background} opacity="0.32" />
            {animatedStripes && !still && (
              <animateTransform attributeName="patternTransform" type="translate" from="0 0" to={`${sw * 2} 0`} dur={`${clamp(1 / Math.max(0.05, stripeSpeed), 0.2, 20)}s`} repeatCount="indefinite" />
            )}
          </pattern>
        </defs>

        {bars.map((b) => {
          const c = cols[b.i]
          const dim = hov >= 0 && hov !== b.i
          return (
            <g key={b.i} opacity={dim ? 0.4 : 1} style={{ transition: 'opacity .2s' }} onMouseEnter={(e) => enter(e, b)} onMouseMove={(e) => tooltip && setTip((t) => (t ? { ...t, ...tipAt(e, wrap, t.title, t.rows) } : t))}>
              <rect x="0" y={b.top - rowGap / 2} width={W} height={rowH + rowGap} fill="transparent" />
              <path d={b.trackD} fill={trackColor} />
              {b.len > 0.5 && <path d={b.d} fill={c} />}
              {stripes && b.len > 2 && (
                <>
                  <clipPath id={`c${uid}${b.i}`}><path d={b.d} /></clipPath>
                  <rect x={x0} y={b.y} width={b.len} height={bh} fill={`url(#st${uid})`} clipPath={`url(#c${uid}${b.i})`} />
                </>
              )}

              {isTab && (
                <g>
                  <path d={rrect(0, b.cy - tabH / 2, tabW, tabH, [tabR, tabR, tabR, tabR])} fill={mix(c, '#000000', 0.14)} />
                  <text x={tabW / 2} y={b.cy} dy="0.35em" textAnchor="middle" fontSize={size * 0.92} fontWeight="700" fill={background} style={{ letterSpacing: '0.03em', pointerEvents: 'none' }}>
                    {b.label}
                  </text>
                </g>
              )}
              {isInline && (
                <text x="0" y={b.cy} dy="0.35em" fontSize={size * 0.92} fontWeight="600" fill={hov === b.i ? textColor : mutedColor} style={{ pointerEvents: 'none' }}>
                  {b.label}
                </text>
              )}
              {isStacked && (
                <text x={x0} y={b.top + size * 1.05} fontSize={size * 0.95} fontWeight="600" fill={textColor} style={{ pointerEvents: 'none' }}>
                  {b.label}
                </text>
              )}
              {showValues && (
                <text x={W} y={b.cy} dy="0.35em" textAnchor="end" fontSize={size * 1.1} fontWeight="700" fill={textColor} style={{ fontVariantNumeric: 'tabular-nums', pointerEvents: 'none' }}>
                  {fmt(b.value * ease(stag(p, b.i, n)))}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </Card>
  )
}
