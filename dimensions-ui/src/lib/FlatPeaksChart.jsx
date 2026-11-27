import { useEffect, useMemo, useRef, useState } from 'react'

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

// Flat "mountain peaks" chart: each value is a flat triangle rising from the baseline,
// overlapping its neighbours and semi-opaque so the overlaps read. A lighter right
// facet gives the flat-shaded look. Peaks pop up one after another; hover dims the rest.
export default function FlatPeaksChart({
  data = 'A:40, B:72, C:55, D:90, E:62',
  title = 'Peak performance',
  subtitle = 'Score by team this quarter',
  overlap = 0.4,
  opacity = 0.85,
  facet = true,
  facetLight = 0.3,
  tallestBehind = true,
  showValues = true,
  showBaseline = true,
  colorByPeak = true,
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
  textColor = '#2b2f3a',
  mutedColor = '#8a90a0',
}) {
  const wrap = useRef(null)
  const [boxRef, boxW] = useWidth()
  const fmt = makeFmt({ decimals, prefix, suffix })
  const rows = useMemo(() => parseRows(data).map((r) => ({ ...r, value: Math.max(0, r.value) })), [data])
  const cols = colorByPeak ? paletteOf(rows.length, [color, color2, color3, color4, color5, color6]) : rows.map(() => color)
  const p = useReveal(animate, duration, data)
  const [hov, setHov] = useState(-1)
  const [tip, setTip] = useState(null)

  const n = Math.max(1, rows.length)
  const W = Math.max(240, (boxW || width) - size * 3)
  const H = height
  const ov = clamp(overlap, 0, 0.8)
  const L = 6
  const R = 6
  const T = showValues ? size * 2 : size * 0.6
  const B = size * 2.2
  const pw = W - L - R
  const ph = Math.max(40, H - T - B)
  const base = T + ph
  const max = Math.max(1, ...rows.map((r) => r.value))
  // spacing so the outer peaks' feet land exactly on the plot edges
  const step = pw / (n + 1.5 * ov)
  const hw = (step / 2) * (1 + 1.5 * ov)

  const peaks = rows.map((r, i) => {
    const k = pop(stag(p, i, n))
    const x = L + hw + step * i
    const y = base - (ph * r.value * Math.max(0, k)) / max
    return { ...r, i, x, y, l: x - hw, r: x + hw }
  })
  const order = tallestBehind ? [...peaks].sort((a, b) => b.value - a.value || a.i - b.i) : peaks
  const enter = (e, pk) => {
    setHov(pk.i)
    if (tooltip) setTip(tipAt(e, wrap, pk.label, [{ color: cols[pk.i], label: 'Value', value: fmt(pk.value) }]))
  }

  return (
    <Card wrapRef={(el) => { wrap.current = el; boxRef.current = el }} {...{ width, background, textColor, mutedColor, size, title, subtitle, tip }}>
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${title}. Peaks chart. ${rows.map((r) => `${r.label}: ${fmt(r.value)}`).join('; ')}`}
        style={{ display: 'block', overflow: 'visible' }}
        onMouseLeave={() => { setHov(-1); setTip(null) }}
      >
        {order.map((pk) => {
          const c = cols[pk.i]
          const dim = hov >= 0 && hov !== pk.i
          return (
            <g key={pk.i} opacity={clamp(opacity, 0.1, 1) * (dim ? 0.4 : 1)} style={{ transition: 'opacity .2s' }}>
              {facet ? (
                <>
                  <path d={`M${pk.l},${base}L${pk.x},${pk.y}L${pk.x},${base}Z`} fill={c} />
                  <path d={`M${pk.x - 0.5},${base}L${pk.x - 0.5},${pk.y}L${pk.x},${pk.y}L${pk.r},${base}Z`} fill={mix(c, '#ffffff', clamp(facetLight, 0, 0.9))} />
                </>
              ) : (
                <path d={`M${pk.l},${base}L${pk.x},${pk.y}L${pk.r},${base}Z`} fill={c} />
              )}
            </g>
          )
        })}

        {showBaseline && <line x1={L - 4} x2={L + pw + 4} y1={base} y2={base} stroke={mutedColor} strokeWidth="3" strokeLinecap="round" />}

        {peaks.map((pk) => (
          <g key={`t${pk.i}`} style={{ pointerEvents: 'none' }} opacity={hov >= 0 && hov !== pk.i ? 0.4 : 1}>
            {showValues && p > 0.15 && (
              <text x={pk.x} y={pk.y - 9} textAnchor="middle" fontSize={size * 1.05} fontWeight="700" fill={textColor} style={{ fontVariantNumeric: 'tabular-nums' }}>
                {fmt(pk.value * ease(stag(p, pk.i, n)))}
              </text>
            )}
            <text x={pk.x} y={base + size * 1.5} textAnchor="middle" fontSize={size * 0.9} fontWeight="600" fill={hov === pk.i ? textColor : mutedColor}>
              {pk.label}
            </text>
          </g>
        ))}

        {/* hit columns: one per peak, full height, centred on the apex */}
        {peaks.map((pk) => (
          <rect
            key={`h${pk.i}`}
            x={pk.i === 0 ? L : pk.x - step / 2}
            y={T - size * 1.6}
            width={pk.i === 0 || pk.i === n - 1 ? step / 2 + hw : step}
            height={ph + size * 3.6}
            fill="transparent"
            onMouseEnter={(e) => enter(e, pk)}
            onMouseMove={(e) => tooltip && setTip((t) => (t ? { ...t, ...tipAt(e, wrap, t.title, t.rows) } : t))}
          />
        ))}
      </svg>
    </Card>
  )
}
