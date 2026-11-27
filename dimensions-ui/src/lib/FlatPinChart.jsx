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

// white or dark ink, whichever reads better on a filled colour
function inkOn(c, dark) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(String(c).slice(i, i + 2), 16) || 0)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.66 ? dark : '#ffffff'
}
// classic teardrop map pin: a circle of radius r centred d above the tip at (x, ty)
function pinPath(x, ty, r, d) {
  const cy = ty - d
  const a = Math.acos(clamp(r / d, 0, 1))
  const sx = r * Math.sin(a)
  const sy = cy + r * Math.cos(a)
  // the sides bow out a little so the pin reads as a soft drop, not a cone
  const bx = sx * 0.55
  const by = sy + (ty - sy) * 0.45
  return `M${x},${ty}Q${x - bx},${by} ${x - sx},${sy}A${r},${r} 0 1 1 ${x + sx},${sy}Q${x + bx},${by} ${x},${ty}Z`
}

// Flat infographic pin chart: each category is a thin stem rising to its value, topped by
// a teardrop map pin in the category colour with the value on a white disc. The 'badges'
// variant lines small numbered pins up along a baseline instead. Pins drop in with a bounce.
export default function FlatPinChart({
  data = 'Q1:10, Q2:20, Q3:35, Q4:50',
  title = 'Quarterly growth',
  subtitle = 'Share of yearly target reached',
  variant = 'stems',
  pinSize = 58,
  stemWidth = 4,
  showBaseline = true,
  showValues = true,
  stripes = true,
  stripeWidth = 4,
  colorByPin = true,
  tooltip = true,
  animate = true,
  duration = 1300,
  decimals = 0,
  prefix = '',
  suffix = '%',
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
  const cols = colorByPin ? paletteOf(rows.length, [color, color2, color3, color4, color5, color6]) : rows.map(() => color)
  const p = useReveal(animate, duration, `${data}|${variant}`)
  const [hov, setHov] = useState(-1)
  const [tip, setTip] = useState(null)

  const badges = variant === 'badges'
  const W = Math.max(240, (boxW || width) - size * 3)
  const n = Math.max(1, rows.length)
  const band = W / n
  const max = Math.max(1, ...rows.map((r) => r.value))

  // pin geometry: radius r, centre sits d above the tip
  const r = badges ? clamp(pinSize * 0.36, 9, band * 0.3) : clamp(pinSize / 2, 10, band * 0.4)
  const d = r * (badges ? 1.45 : 1.6)
  const B = badges ? 0 : size * 2.4
  // badges are one row of pins plus two text lines, so they size to that content and
  // ignore `height`; stems use the full height for their rise
  const H = badges ? Math.ceil(d + r + size * 3.6 + 14) : Math.max(180, height)
  const base = badges ? d + r + 9 : H - B
  const T = 4
  const rise = Math.max(0, base - T - d - r - 2)

  const pins = rows.map((row, i) => {
    const k = stag(p, i, n)
    const x = band * (i + 0.5)
    const ty = badges ? base - 3 : base - (rise * row.value) / max
    const stemTop = base - (base - ty) * ease(k)
    // drop from above the card, overshoot a touch below the rest spot, settle
    const drop = (1 - pop(k)) * -(ty + d + r + 20)
    return { ...row, i, x, ty, stemTop, drop, k }
  })

  const enter = (e, q) => {
    setHov(q.i)
    if (tooltip) setTip(tipAt(e, wrap, q.label, [{ color: cols[q.i], label: badges ? `#${q.i + 1}` : 'Value', value: fmt(q.value) }]))
  }
  const move = (e) => tooltip && setTip((t) => (t ? { ...t, ...tipAt(e, wrap, t.title, t.rows) } : t))
  const discR = r * 0.7

  return (
    <Card wrapRef={(el) => { wrap.current = el; boxRef.current = el }} {...{ width, background, textColor, mutedColor, size, title, subtitle, tip }}>
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${title}. Pin chart. ${rows.map((q) => `${q.label}: ${fmt(q.value)}`).join('; ')}`}
        style={{ display: 'block', overflow: 'visible' }}
        onMouseLeave={() => { setHov(-1); setTip(null) }}
      >
        <defs>
          <pattern id={`st${uid}`} width={stripeWidth * 2} height={stripeWidth * 2} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width={stripeWidth} height={stripeWidth * 2} fill="#ffffff" opacity="0.35" />
          </pattern>
        </defs>

        {showBaseline && <rect x={0} y={base - 3} width={W} height={6} rx={3} fill={trackColor} />}

        {pins.map((q) => {
          const c = cols[q.i]
          const dim = hov >= 0 && hov !== q.i
          const d0 = pinPath(q.x, q.ty, r, d)
          const cy = q.ty - d
          const txt = badges ? String(q.i + 1) : fmt(q.value * ease(q.k))
          const fitW = (badges ? r * 1.5 : discR * 1.75) / (0.62 * Math.max(1, txt.length))
          const fs = Math.min(badges ? r * 0.95 : Math.min(size * 1.15, discR * 0.8), fitW)
          return (
            <g key={q.i} opacity={dim ? 0.4 : 1} style={{ transition: 'opacity .2s' }} onMouseEnter={(e) => enter(e, q)} onMouseMove={move}>
              {/* ground mark where the stem meets the baseline */}
              <ellipse cx={q.x} cy={base} rx={Math.max(stemWidth * 2.2, r * 0.42)} ry={Math.max(3, stemWidth * 0.9)} fill={mix(c, background, 0.65)} opacity={ease(q.k)} />
              {!badges && q.k > 0 && (
                <rect x={q.x - stemWidth / 2} y={q.stemTop} width={stemWidth} height={Math.max(0, base - q.stemTop)} rx={stemWidth / 2} fill={c} />
              )}
              <g transform={`translate(0 ${q.drop})`} opacity={clamp(q.k * 4, 0, 1)}>
                <path d={d0} fill={c} />
                {stripes && (
                  <>
                    <clipPath id={`c${uid}${q.i}`}><path d={d0} /></clipPath>
                    <g clipPath={`url(#c${uid}${q.i})`}>
                      <rect x={q.x + r * 0.28} y={cy - r} width={r} height={d + r} fill={mix(c, '#000000', 0.12)} />
                      <rect x={q.x + r * 0.28} y={cy - r} width={r} height={d + r} fill={`url(#st${uid})`} />
                    </g>
                  </>
                )}
                {!badges && <circle cx={q.x} cy={cy} r={discR} fill={background} />}
                {(badges || showValues) && (
                  <text
                    x={q.x}
                    y={cy}
                    dy="0.36em"
                    textAnchor="middle"
                    fontSize={fs}
                    fontWeight="800"
                    fill={badges ? inkOn(c, textColor) : textColor}
                    style={{ fontVariantNumeric: 'tabular-nums', pointerEvents: 'none' }}
                  >
                    {txt}
                  </text>
                )}
              </g>
              {badges ? (
                <>
                  {showValues && (
                    <text x={q.x} y={base + size * 2} textAnchor="middle" fontSize={size * 1.2} fontWeight="800" fill={textColor} style={{ fontVariantNumeric: 'tabular-nums', pointerEvents: 'none' }}>
                      {fmt(q.value * ease(q.k))}
                    </text>
                  )}
                  <text x={q.x} y={base + size * (showValues ? 3.3 : 2)} textAnchor="middle" fontSize={size * 0.9} fontWeight="600" fill={hov === q.i ? textColor : mutedColor} style={{ pointerEvents: 'none' }}>
                    {q.label}
                  </text>
                </>
              ) : (
                <text x={q.x} y={base + size * 1.75} textAnchor="middle" fontSize={size * 0.95} fontWeight="600" fill={hov === q.i ? textColor : mutedColor} style={{ pointerEvents: 'none' }}>
                  {q.label}
                </text>
              )}
              {/* hit area: the whole column */}
              <rect x={band * q.i} y={0} width={band} height={H} fill="transparent" />
            </g>
          )
        })}
      </svg>
    </Card>
  )
}
