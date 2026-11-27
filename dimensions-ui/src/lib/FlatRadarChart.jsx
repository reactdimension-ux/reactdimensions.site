import { useEffect, useMemo, useRef, useState } from 'react'

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

// Multi-series rows: "Jan:12|8, Feb:18|14" -> [{ label: 'Jan', values: [12, 8] }, ...]
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
function Legend({ items, mutedColor, onHover }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4em 1.2em', marginBottom: '0.7em', color: mutedColor, fontSize: '0.88em', fontWeight: 600 }}>
      {items.map((it, i) => (
        <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45em', cursor: 'default' }} onMouseEnter={() => onHover?.(i)} onMouseLeave={() => onHover?.(-1)}>
          <i style={{ width: '0.75em', height: '0.75em', borderRadius: '50%', background: it.color, flex: 'none' }} />
          {it.name}
        </span>
      ))}
    </div>
  )
}

// round a value up to a "nice" number (1, 2, 2.5, 5 x 10^n) for the outer ring
function niceCeil(raw) {
  if (!(raw > 0)) return 1
  const mag = 10 ** Math.floor(Math.log10(raw))
  const f = raw / mag
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * mag
}

// Flat infographic radar: a polygon web (optionally banded), spokes, one flat filled
// polygon per series with a solid outline and hollow dots at each vertex. Series pop
// out from the centre; hovering an axis shows every series' value for it.
export default function FlatRadarChart({
  data = 'Speed:80|60, Power:65|85, Range:90|55, Comfort:55|75, Price:70|90, Design:85|65',
  series = 'Model A, Model B',
  title = 'Model comparison',
  subtitle = 'Rated out of 100 across six areas',
  levels = 5,
  maxValue = 0,
  bandedRings = true,
  fillOpacity = 0.18,
  lineWidth = 3,
  showDots = true,
  dotSize = 5,
  showScale = true,
  tooltip = true,
  animate = true,
  duration = 1200,
  decimals = 0,
  prefix = '',
  suffix = '',
  width = 520,
  height = 340,
  size = 13,
  color = '#4a7fe8',
  color2 = '#ef5b7f',
  color3 = '#14a89e',
  color4 = '#f08a24',
  color5 = '#8e5fd6',
  color6 = '#c49a12',
  background = '#ffffff',
  gridColor = '#eef0f6',
  textColor = '#2b2f3a',
  mutedColor = '#8a90a0',
}) {
  const wrap = useRef(null)
  const [boxRef, boxW] = useWidth()
  const fmt = makeFmt({ decimals, prefix, suffix })
  const rows = useMemo(() => parseMulti(data), [data])
  const S = Math.max(1, ...rows.map((r) => r.values.length))
  const names = String(series ?? '').split(',').map((s) => s.trim())
  const sNames = Array.from({ length: S }, (_, s) => names[s] || `Series ${s + 1}`)
  const cols = paletteOf(S, [color, color2, color3, color4, color5, color6])
  const p = useReveal(animate, duration, data)
  const [hov, setHov] = useState(-1)
  const [hovS, setHovS] = useState(-1)
  const [tip, setTip] = useState(null)

  const N = Math.max(3, rows.length)
  const lv = Math.max(1, Math.round(levels))
  const dataMax = Math.max(0, ...rows.flatMap((r) => r.values))
  const max = maxValue > 0 ? maxValue : niceCeil(dataMax)
  const fmt1 = makeFmt({ decimals: Math.max(1, decimals), prefix, suffix })
  const ringFmt = (v) => (decimals === 0 && Math.abs(v - Math.round(v)) > 1e-6 ? fmt1(v) : fmt(v))
  const W = Math.max(240, (boxW || width) - size * 3)
  const H = height
  const labW = size * 0.6 * Math.max(3, ...rows.map((r) => r.label.length)) + 12
  const rad = Math.max(30, Math.min(W / 2 - labW - 4, H / 2 - size * 1.8))
  const cx = W / 2
  const cy = H / 2
  const ang = (j) => -Math.PI / 2 + (2 * Math.PI * j) / N
  const at = (j, rr) => [cx + Math.cos(ang(j)) * rr, cy + Math.sin(ang(j)) * rr]
  const poly = (f) => Array.from({ length: N }, (_, j) => at(j, f(j)).map((v) => +v.toFixed(2)).join(',')).join(' ')
  const lineC = bandedRings ? mix(gridColor, mutedColor, 0.25) : mix(gridColor, mutedColor, 0.12)

  const shapes = Array.from({ length: S }, (_, s) => {
    const k = pop(stag(p, s, S))
    const rOf = (j) => (rad * clamp((rows[j]?.values[s] ?? 0) / max, 0, 1.15) * Math.max(0, k))
    return { s, k, pts: poly(rOf), dots: Array.from({ length: N }, (_, j) => at(j, rOf(j))) }
  })
  const enter = (e, j) => {
    if (!rows[j]) return
    setHov(j)
    if (tooltip) setTip(tipAt(e, wrap, rows[j].label, Array.from({ length: S }, (_, s) => ({ color: cols[s], label: sNames[s], value: fmt(rows[j].values[s] ?? 0) }))))
  }

  return (
    <Card wrapRef={(el) => { wrap.current = el; boxRef.current = el }} {...{ width, background, textColor, mutedColor, size, title, subtitle, tip }}>
      {S >= 2 && <Legend items={sNames.map((nm, s) => ({ name: nm, color: cols[s] }))} mutedColor={mutedColor} onHover={setHovS} />}
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${title}. Radar chart. ${rows.map((r) => `${r.label}: ${r.values.map((v, s) => `${sNames[s]} ${fmt(v)}`).join(', ')}`).join('; ')}`}
        style={{ display: 'block', overflow: 'visible' }}
        onMouseLeave={() => { setHov(-1); setTip(null) }}
      >
        {/* web: rings from the outside in, alternately tinted when banded */}
        {Array.from({ length: lv }, (_, q) => lv - q).map((l) => (
          <polygon
            key={`r${l}`}
            points={poly(() => (rad * l) / lv)}
            fill={bandedRings ? ((lv - l) % 2 === 0 ? gridColor : background) : 'none'}
            stroke={lineC}
            strokeWidth={l === lv ? 2 : 1.5}
            strokeLinejoin="round"
          />
        ))}
        {Array.from({ length: N }, (_, j) => {
          const [x, y] = at(j, rad)
          return <line key={`s${j}`} x1={cx} y1={cy} x2={x} y2={y} stroke={hov === j ? mutedColor : lineC} strokeWidth={hov === j ? 2 : 1.5} strokeLinecap="round" />
        })}

        {/* ring values up the first spoke, haloed so the web lines don't cut them */}
        {showScale &&
          Array.from({ length: lv }, (_, q) => q + 1).map((l) => (
            <text
              key={`v${l}`}
              x={cx + 4}
              y={cy - (rad * l) / lv}
              dy="0.35em"
              fontSize={size * 0.72}
              fontWeight="600"
              fill={mutedColor}
              stroke={(lv - l) % 2 === 0 && bandedRings ? gridColor : background}
              strokeWidth="3"
              strokeLinejoin="round"
              paintOrder="stroke"
              style={{ fontVariantNumeric: 'tabular-nums', pointerEvents: 'none' }}
            >
              {ringFmt((max * l) / lv)}
            </text>
          ))}

        {shapes.map(({ s, pts }) => (
          <polygon
            key={`p${s}`}
            points={pts}
            fill={cols[s]}
            fillOpacity={clamp(fillOpacity, 0, 1)}
            stroke={cols[s]}
            strokeWidth={lineWidth}
            strokeLinejoin="round"
            opacity={hovS >= 0 && hovS !== s ? 0.4 : 1}
            style={{ transition: 'opacity .2s', pointerEvents: 'none' }}
          />
        ))}

        {showDots &&
          shapes.map(({ s, k, dots }) =>
            dots.map(([x, y], j) => (
              <circle
                key={`d${s}-${j}`}
                cx={x}
                cy={y}
                r={Math.max(0, dotSize * Math.min(1, k) * (hov === j ? 1.35 : 1))}
                fill={background}
                stroke={cols[s]}
                strokeWidth={Math.max(2, lineWidth * 0.85)}
                opacity={(hov >= 0 && hov !== j) || (hovS >= 0 && hovS !== s) ? 0.4 : 1}
                style={{ transition: 'opacity .2s', pointerEvents: 'none' }}
              />
            )),
          )}


        {rows.slice(0, N).map((r, j) => {
          const c = Math.cos(ang(j))
          const sn = Math.sin(ang(j))
          const [x, y] = at(j, rad + 12)
          return (
            <text
              key={`l${j}`}
              x={x}
              y={y}
              dy={sn < -0.3 ? 0 : sn > 0.3 ? '0.8em' : '0.35em'}
              textAnchor={c > 0.3 ? 'start' : c < -0.3 ? 'end' : 'middle'}
              fontSize={size * 0.92}
              fontWeight="600"
              fill={hov === j ? textColor : mutedColor}
              style={{ pointerEvents: 'none' }}
            >
              {r.label}
            </text>
          )
        })}

        {/* hit wedges: one sector per axis, out past the labels */}
        {Array.from({ length: N }, (_, j) => {
          const R2 = rad + labW
          const a0 = ang(j) - Math.PI / N
          const a1 = ang(j) + Math.PI / N
          return (
            <path
              key={`h${j}`}
              d={`M${cx},${cy}L${cx + Math.cos(a0) * R2},${cy + Math.sin(a0) * R2}A${R2},${R2} 0 0 1 ${cx + Math.cos(a1) * R2},${cy + Math.sin(a1) * R2}Z`}
              fill="transparent"
              onMouseEnter={(e) => enter(e, j)}
              onMouseMove={(e) => tooltip && setTip((t) => (t ? { ...t, ...tipAt(e, wrap, t.title, t.rows) } : t))}
            />
          )
        })}
      </svg>
    </Card>
  )
}
