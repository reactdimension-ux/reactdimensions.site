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

// a thick ring arc as a filled shape (so it can be clipped), angles in radians,
// 0 = twelve o'clock, growing clockwise; `round` gives it semicircular end caps
function ringArc(cx, cy, R, r, a0, a1, round) {
  const pt = (rad, a) => `${(cx + rad * Math.sin(a)).toFixed(2)},${(cy - rad * Math.cos(a)).toFixed(2)}`
  if (a1 - a0 >= Math.PI * 2 - 1e-4) {
    // full ring: two circles, the inner one cut out with evenodd
    return `M${pt(R, 0)}A${R},${R} 0 1 1 ${pt(R, Math.PI)}A${R},${R} 0 1 1 ${pt(R, 0)}Z M${pt(r, 0)}A${r},${r} 0 1 0 ${pt(r, Math.PI)}A${r},${r} 0 1 0 ${pt(r, 0)}Z`
  }
  const big = a1 - a0 > Math.PI ? 1 : 0
  const c = (R - r) / 2
  const capEnd = round ? `A${c},${c} 0 0 1 ${pt(r, a1)}` : `L${pt(r, a1)}`
  const capStart = round ? `A${c},${c} 0 0 1 ${pt(R, a0)}` : `L${pt(R, a0)}`
  return `M${pt(R, a0)}A${R},${R} 0 ${big} 1 ${pt(R, a1)}${capEnd}A${r},${r} 0 ${big} 0 ${pt(r, a0)}${capStart}Z`
}

// Flat infographic percentage rings: a row of chunky donut rings, each a pale track
// with one thick flat-coloured arc and the big percentage in the middle. Rings pop in
// one after another and their arcs sweep round; hover dims the rest.
export default function FlatPercentRings({
  data = 'Design:95, Code:80, Content:65, SEO:50, Ads:30',
  title = 'Team skills',
  subtitle = 'Share of the brief covered by each discipline',
  max = 100,
  ringSize = 116,
  thickness = 14,
  columns = 0,
  startAngle = 0,
  roundCaps = true,
  innerFill = true,
  stripes = true,
  stripeWidth = 4,
  showLabels = true,
  colorByRing = true,
  tooltip = true,
  animate = true,
  duration = 1400,
  decimals = 0,
  prefix = '',
  suffix = '%',
  width = 640,
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
  const cols = colorByRing ? paletteOf(rows.length, [color, color2, color3, color4, color5, color6]) : rows.map(() => color)
  const p = useReveal(animate, duration, `${data}|${max}`)
  const [hov, setHov] = useState(-1)
  const [tip, setTip] = useState(null)

  const n = Math.max(1, rows.length)
  const W = Math.max(160, (boxW || width) - size * 3)
  const gapX = size * 1.2
  // auto columns: everything on one row if the rings can shrink a little to fit,
  // otherwise as many as fit at full size, balanced so the last row isn't an orphan
  const fit = (d) => Math.max(1, Math.floor((W + gapX) / (d + gapX)))
  const nc = clamp(
    columns > 0 ? Math.round(columns) : fit(ringSize * 0.78) >= n ? n : Math.ceil(n / Math.ceil(n / fit(ringSize))),
    1,
    n,
  )
  const cellW = (W - gapX * (nc - 1)) / nc
  const D = Math.max(48, Math.min(ringSize, cellW))
  const th = clamp(thickness, 2, D * 0.3)
  const labH = showLabels ? size * 2.3 : 0
  const cellH = D + labH
  const gapY = size * 1.4
  const nr = Math.ceil(rows.length / nc)
  const H = Math.max(D, nr * cellH + (nr - 1) * gapY)
  const top = clamp(max, 0.0001, Infinity)
  const a0 = (startAngle * Math.PI) / 180

  const rings = rows.map((r, i) => {
    const row = Math.floor(i / nc)
    const inRow = row === nr - 1 ? rows.length - row * nc : nc
    // centre a short last row
    const off = ((nc - inRow) * (cellW + gapX)) / 2
    const cx = off + (i % nc) * (cellW + gapX) + cellW / 2
    const cy = row * (cellH + gapY) + D / 2
    const k = stag(p, i, n)
    return { ...r, i, cx, cy, k, frac: clamp(r.value / top, 0, 1) }
  })
  const enter = (e, g) => {
    setHov(g.i)
    if (tooltip) setTip(tipAt(e, wrap, g.label, [{ color: cols[g.i], label: 'Value', value: fmt(g.value) }, { label: 'Of', value: fmt(max) }]))
  }

  return (
    <Card wrapRef={(el) => { wrap.current = el; boxRef.current = el }} {...{ width, background, textColor, mutedColor, size, title, subtitle, tip }}>
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${title}. Percentage rings. ${rows.map((r) => `${r.label}: ${fmt(r.value)}`).join('; ')}`}
        style={{ display: 'block', overflow: 'visible' }}
        onMouseLeave={() => { setHov(-1); setTip(null) }}
      >
        <defs>
          <pattern id={`st${uid}`} width={stripeWidth * 2} height={stripeWidth * 2} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width={stripeWidth} height={stripeWidth * 2} fill="#ffffff" opacity="0.35" />
          </pattern>
        </defs>

        {rings.map((g) => {
          const c = cols[g.i]
          const R = D / 2
          const r = R - th
          const s = pop(g.k)
          const sweep = Math.PI * 2 * g.frac * ease(g.k)
          const d = sweep > 0.001 ? ringArc(g.cx, g.cy, R, r, a0, a0 + sweep, roundCaps) : ''
          const band = th * 0.4
          const dim = hov >= 0 && hov !== g.i
          return (
            <g
              key={g.i}
              opacity={dim ? 0.4 : 1}
              style={{ transition: 'opacity .2s' }}
              onMouseEnter={(e) => enter(e, g)}
              onMouseMove={(e) => tooltip && setTip((t) => (t ? { ...t, ...tipAt(e, wrap, t.title, t.rows) } : t))}
            >
              <g transform={`translate(${g.cx} ${g.cy}) scale(${s}) translate(${-g.cx} ${-g.cy})`}>
                <circle cx={g.cx} cy={g.cy} r={R - th / 2} fill="none" stroke={trackColor} strokeWidth={th} />
                {innerFill && <circle cx={g.cx} cy={g.cy} r={Math.max(0, r - Math.max(3, th * 0.35))} fill={mix(c, background, 0.88)} />}
                {d && <path d={d} fill={c} />}
                {d && stripes && (
                  <>
                    <clipPath id={`c${uid}${g.i}`}><path d={d} /></clipPath>
                    <g clipPath={`url(#c${uid}${g.i})`}>
                      <circle cx={g.cx} cy={g.cy} r={R - band / 2} fill="none" stroke={mix(c, '#000000', 0.12)} strokeWidth={band} />
                      <circle cx={g.cx} cy={g.cy} r={R - band / 2} fill="none" stroke={`url(#st${uid})`} strokeWidth={band} />
                    </g>
                  </>
                )}
                <text
                  x={g.cx}
                  y={g.cy}
                  dy="0.36em"
                  textAnchor="middle"
                  fontSize={Math.max(size * 0.8, Math.min(r * 0.62, (2 * r - th * 0.7 - 8) / (fmt(g.value).length * 0.62)))}
                  fontWeight="800"
                  fill={textColor}
                  style={{ fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', pointerEvents: 'none' }}
                >
                  {fmt(g.value * ease(g.k))}
                </text>
              </g>
              {showLabels && (
                <text
                  x={g.cx}
                  y={g.cy + D / 2 + size * 1.55}
                  textAnchor="middle"
                  fontSize={size * 0.95}
                  fontWeight="600"
                  fill={hov === g.i ? textColor : mutedColor}
                  style={{ pointerEvents: 'none' }}
                >
                  {g.label}
                </text>
              )}
              {/* hit area: the whole cell, ring and label */}
              <rect x={g.cx - cellW / 2} y={g.cy - D / 2} width={cellW} height={cellH} fill="transparent" />
            </g>
          )
        })}
      </svg>
    </Card>
  )
}
