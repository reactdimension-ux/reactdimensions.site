import { useEffect, useId, useMemo, useRef, useState } from 'react'

// ---- flat infographic helpers (kept inline so this file copies out on its own) ----
// Data is a plain string: rows are separated by commas, each row is "Label:value",
// e.g. "Jan:42, Feb:58". An array of { label, value } works too.

const FONT = '"Poppins", "Nunito", ui-rounded, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif'
const num = (v) => {
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : 0
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

// Multi-value rows: "0-4:2.6|2.5" -> { label: '0-4', values: [2.6, 2.5] }
function parseMulti(data) {
  if (Array.isArray(data)) return data.map((d) => ({ label: String(d.label ?? ''), values: (d.values ?? [d.value]).map(num) }))
  return String(data ?? '')
    .split(/[,\n;]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const i = s.lastIndexOf(':')
      return { label: i < 0 ? s : s.slice(0, i).trim(), values: (i < 0 ? '0' : s.slice(i + 1)).split('|').map(num) }
    })
}
// a "nice" axis: round step, ticks from lo to hi
function niceScale(lo0, hi0, steps = 4) {
  const raw = (hi0 - lo0) / steps || 1
  const mag = 10 ** Math.floor(Math.log10(Math.abs(raw)))
  const f = raw / mag
  const s = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * mag
  const lo = Math.floor(lo0 / s + 1e-9) * s
  let hi = Math.ceil(hi0 / s - 1e-9) * s
  if (hi <= lo) hi = lo + s
  const ticks = []
  for (let v = lo; v <= hi + s / 2; v += s) ticks.push(+v.toFixed(10))
  return { lo, hi, ticks }
}
const axisFmt = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })
// white or dark text, whichever reads better on a filled shape
function inkOn(c, dark) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(String(c).slice(i, i + 2), 16) || 0)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.66 ? dark : '#ffffff'
}

// Flat infographic population pyramid: two sets of chunky flat bars mirrored around a
// centre column of band labels, on soft tracks, with striped outer tips and solid
// side badges. Rows are "Band:left|right"; show counts or each side's percentage.
// Bars spring outwards band by band; hover a band to compare both sides.
export default function FlatPopulationPyramid({
  data = '85+:1.1|2.0, 75-84:3.0|3.8, 65-74:5.2|5.8, 55-64:6.4|6.7, 45-54:6.6|6.6, 35-44:6.8|6.7, 25-34:7.0|6.8, 15-24:6.1|5.8, 5-14:5.6|5.3, 0-4:2.6|2.5',
  leftLabel = 'Male',
  rightLabel = 'Female',
  title = 'Population by age',
  subtitle = 'Millions of people',
  normalize = false,
  centerLabels = true,
  barRadius = 8,
  gap = 0.22,
  stripes = true,
  stripeWidth = 4,
  showTrack = true,
  showValues = true,
  showGrid = true,
  tooltip = true,
  animate = true,
  duration = 1300,
  decimals = 1,
  prefix = '',
  suffix = 'M',
  width = 600,
  height = 340,
  size = 13,
  leftColor = '#4a7fe8',
  rightColor = '#ef5b7f',
  background = '#ffffff',
  trackColor = '#eef0f6',
  gridColor = '#eef0f6',
  textColor = '#2b2f3a',
  mutedColor = '#8a90a0',
}) {
  const uid = useId().replace(/:/g, '')
  const wrap = useRef(null)
  const [boxRef, boxW] = useWidth()
  const rows = useMemo(() => parseMulti(data).map((r) => ({ label: r.label, a: Math.max(0, r.values[0] ?? 0), b: Math.max(0, r.values[1] ?? 0) })), [data])
  const sumA = rows.reduce((s, r) => s + r.a, 0) || 1
  const sumB = rows.reduce((s, r) => s + r.b, 0) || 1
  const valA = (r) => (normalize ? (r.a / sumA) * 100 : r.a)
  const valB = (r) => (normalize ? (r.b / sumB) * 100 : r.b)
  const fmt0 = makeFmt({ decimals, prefix, suffix })
  const fmt = normalize ? (v) => `${v.toFixed(1)}%` : fmt0
  const n = Math.max(1, rows.length)
  const p = useReveal(animate, duration, `${data}|${normalize}`)
  const [hov, setHov] = useState(-1)
  const [tip, setTip] = useState(null)

  const W = Math.max(280, (boxW || width) - size * 3)
  const H = height
  const maxLab = Math.max(1, ...rows.map((r) => r.label.length))
  const mid = centerLabels ? maxLab * size * 0.6 + 22 : 8
  const m = { l: centerLabels ? 4 : maxLab * size * 0.6 + 14, r: 4, t: size * 2.6, b: size * 1.8 }
  const half = (W - m.l - m.r - mid) / 2
  const cx = m.l + half + mid / 2
  const ph = Math.max(40, H - m.t - m.b)
  const band = ph / n
  const bh = band * (1 - clamp(gap, 0.02, 0.7))
  const br = Math.min(barRadius, bh / 2)
  const top = niceScale(0, Math.max(0.0001, ...rows.map((r) => Math.max(valA(r), valB(r)))), 3)
  const room = half - (showValues ? size * 3.2 : 4)
  const len = (v) => (v / top.hi) * room
  const xl = cx - mid / 2
  const xr = cx + mid / 2
  // side badges above each half
  const badge = (x, txt, c, anchorRight) => {
    const w = txt.length * size * 0.6 + size * 1.5
    const bx = anchorRight ? x - w : x
    return (
      <g style={{ pointerEvents: 'none' }}>
        <path d={rrect(bx, 0, w, size * 1.7, [size * 0.85, size * 0.85, size * 0.85, size * 0.85])} fill={c} />
        <text x={bx + w / 2} y={size * 0.85} dy="0.36em" textAnchor="middle" fontSize={size * 0.88} fontWeight="800" fill={inkOn(c, textColor)}>{txt}</text>
      </g>
    )
  }

  return (
    <Card wrapRef={(el) => { wrap.current = el; boxRef.current = el }} {...{ width, background, textColor, mutedColor, size, title, subtitle, tip }}>
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${title}. Population pyramid, ${leftLabel} and ${rightLabel}. ${rows.map((r) => `${r.label}: ${fmt(valA(r))} and ${fmt(valB(r))}`).join('; ')}`}
        style={{ display: 'block', overflow: 'visible' }}
        onMouseLeave={() => { setHov(-1); setTip(null) }}
      >
        <defs>
          <pattern id={`st${uid}`} width={stripeWidth * 2} height={stripeWidth * 2} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width={stripeWidth} height={stripeWidth * 2} fill="#ffffff" opacity="0.35" />
          </pattern>
        </defs>
        {badge(xl - 2, `◀ ${leftLabel}`, leftColor, true)}
        {badge(xr + 2, `${rightLabel} ▶`, rightColor, false)}

        {top.ticks.map((t, k) => (
          <g key={k} style={{ pointerEvents: 'none' }}>
            {/* a narrow centre gap gets one shared zero label */}
            {(t === 0 && mid < size * 2.5 ? [0] : [-1, 1]).map((s) => {
              const x = s === 0 ? cx : s < 0 ? xl - len(t) : xr + len(t)
              return (
                <g key={s}>
                  {showGrid && t > 0 && <line x1={x} x2={x} y1={m.t} y2={m.t + ph} stroke={gridColor} strokeWidth="2" strokeDasharray="5 7" strokeLinecap="round" />}
                  <text x={x} y={H - 2} textAnchor="middle" fontSize={size * 0.78} fill={mutedColor} style={{ fontVariantNumeric: 'tabular-nums' }}>{normalize ? `${t}%` : axisFmt.format(t)}</text>
                </g>
              )
            })}
          </g>
        ))}

        {rows.map((r, i) => {
          const k = pop(stag(p, i, n))
          const y = m.t + i * band + (band - bh) / 2
          const la = Math.max(0, len(valA(r)) * k)
          const lb = Math.max(0, len(valB(r)) * k)
          const dA = rrect(xl - la, y, la, bh, [br, 0, 0, br])
          const dB = rrect(xr, y, lb, bh, [0, br, br, 0])
          const sides = [
            { d: dA, c: leftColor, s: { x: xl - la, w: la * 0.24 }, w: la, key: 'a' },
            { d: dB, c: rightColor, s: { x: xr + lb * 0.76, w: lb * 0.24 }, w: lb, key: 'b' },
          ]
          return (
            <g
              key={i}
              opacity={hov < 0 || hov === i ? 1 : 0.4}
              style={{ transition: 'opacity .2s' }}
              onMouseEnter={(e) => {
                setHov(i)
                tooltip && setTip(tipAt(e, wrap, r.label, [
                  { color: leftColor, label: leftLabel, value: fmt(valA(r)) },
                  { color: rightColor, label: rightLabel, value: fmt(valB(r)) },
                  { label: `${rightLabel} − ${leftLabel}`, value: `${valB(r) - valA(r) >= 0 ? '+' : '−'}${fmt(Math.abs(valB(r) - valA(r)))}` },
                ]))
              }}
              onMouseMove={(e) => tooltip && setTip((t) => (t ? { ...t, ...tipAt(e, wrap, t.title, t.rows) } : t))}
            >
              <rect x={0} y={m.t + i * band} width={W} height={band} fill="transparent" />
              {showTrack && (
                <>
                  <path d={rrect(xl - half, y, half, bh, [br, 0, 0, br])} fill={trackColor} />
                  <path d={rrect(xr, y, half, bh, [0, br, br, 0])} fill={trackColor} />
                </>
              )}
              {sides.map((sd) =>
                sd.w > 0.5 ? (
                  <g key={sd.key}>
                    <path d={sd.d} fill={sd.c} />
                    {stripes && sd.w > 6 && (
                      <>
                        <clipPath id={`c${uid}${i}${sd.key}`}><path d={sd.d} /></clipPath>
                        <g clipPath={`url(#c${uid}${i}${sd.key})`}>
                          <rect x={sd.s.x} y={y} width={sd.s.w} height={bh} fill={mix(sd.c, '#000000', 0.12)} />
                          <rect x={sd.s.x} y={y} width={sd.s.w} height={bh} fill={`url(#st${uid})`} />
                        </g>
                      </>
                    )}
                  </g>
                ) : null,
              )}
              {showValues && k > 0.85 && (
                <g fontSize={size * 0.8} fontWeight="700" fill={textColor} style={{ fontVariantNumeric: 'tabular-nums', pointerEvents: 'none' }}>
                  <text x={xl - la - 6} y={y + bh / 2} dy="0.35em" textAnchor="end">{fmt(valA(r))}</text>
                  <text x={xr + lb + 6} y={y + bh / 2} dy="0.35em">{fmt(valB(r))}</text>
                </g>
              )}
              <text
                x={centerLabels ? cx : m.l - 10}
                y={y + bh / 2}
                dy="0.35em"
                textAnchor={centerLabels ? 'middle' : 'end'}
                fontSize={size * 0.84}
                fontWeight={hov === i ? 800 : 600}
                fill={hov === i ? textColor : mutedColor}
                style={{ pointerEvents: 'none' }}
              >
                {r.label}
              </text>
            </g>
          )
        })}
      </svg>
    </Card>
  )
}
