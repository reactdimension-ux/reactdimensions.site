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

// Multi-value rows: "Revenue:912|1000" -> { label: 'Revenue', values: [912, 1000] }
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
function compactFmt({ decimals = 0, prefix = '', suffix = '' }) {
  const nf = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: Math.max(1, Math.round(decimals)) })
  return (v) => `${prefix}${nf.format(v)}${suffix}`
}
// white or dark text, whichever reads better on a filled shape
function inkOn(c, dark) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(String(c).slice(i, i + 2), 16) || 0)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.66 ? dark : '#ffffff'
}

// Flat infographic bullet chart: actual against a target on a rounded track split
// into flat range bands (behind / on track / ahead). Rows are "Label:actual|target";
// `ranges` are percentages of the target so every target lines up. The chunky bar
// takes its status colour, carries a striped tip and a solid percent badge.
export default function FlatBulletChart({
  data = 'Revenue:912|1000, New customers:340|300, Satisfaction:4.1|4.5, Uptime:99.2|99.9, Support tickets:86|60, Profit margin:21|25',
  title = 'Q4 scorecard',
  subtitle = 'Actual vs target. Dark to light bands: behind, on track, ahead',
  ranges = '70, 90, 120',
  orientation = 'horizontal',
  sort = 'none',
  trackHeight = 28,
  barThickness = 0.46,
  barRadius = 8,
  markerStyle = 'line',
  statusColors = true,
  showRanges = true,
  stripes = true,
  stripeWidth = 4,
  showValues = true,
  showPercent = true,
  showAxis = true,
  showGrid = false,
  tooltip = true,
  animate = true,
  duration = 1200,
  valueFormat = 'number',
  decimals = 0,
  prefix = '',
  suffix = '',
  width = 640,
  height = 300,
  size = 13,
  color = '#4a7fe8',
  okColor = '#14a89e',
  warnColor = '#f08a24',
  errorColor = '#ef5b7f',
  markerColor = '#2b2f3a',
  background = '#ffffff',
  trackColor = '#eef0f6',
  gridColor = '#eef0f6',
  textColor = '#2b2f3a',
  mutedColor = '#8a90a0',
}) {
  const uid = useId().replace(/:/g, '')
  const wrap = useRef(null)
  const [boxRef, boxW] = useWidth()
  // each row can have its own decimals: small numbers like 4.1 keep one
  const fmt = (v) => (valueFormat === 'compact' ? compactFmt : makeFmt)({ prefix, suffix, decimals: decimals || (v % 1 !== 0 ? 1 : 0) })(v)
  const rngs = useMemo(() => {
    const r = String(ranges ?? '').split(',').map(num).filter((x) => x > 0).sort((a, b) => a - b)
    return r.length ? r : [70, 90, 120]
  }, [ranges])
  const rows = useMemo(() => {
    const r = parseMulti(data).map((x) => {
      const a = x.values[0] ?? 0
      const t = x.values[1] || 1
      return { label: x.label, a, t, pct: (a / t) * 100 }
    })
    if (sort === 'asc') r.sort((a, b) => a.pct - b.pct)
    else if (sort === 'desc') r.sort((a, b) => b.pct - a.pct)
    return r
  }, [data, sort])
  const p = useReveal(animate, duration, `${data}|${ranges}|${orientation}|${sort}`)
  const [hov, setHov] = useState(-1)
  const [tip, setTip] = useState(null)

  const horiz = orientation === 'horizontal'
  const n = Math.max(1, rows.length)
  const sc = niceScale(0, Math.max(rngs[rngs.length - 1], ...rows.map((r) => r.pct * 1.02), 100), 4)
  const W = Math.max(240, (boxW || width) - size * 3)
  const H = height
  const maxLab = Math.min(20, Math.max(1, ...rows.map((r) => r.label.length)))
  const pillW = size * 3.4
  const valW = Math.max(...rows.map((r) => `${fmt(r.a)} / ${fmt(r.t)}`.length)) * size * 0.55
  // room under the plot for slanted category labels when they do not fit their column
  const rot = !horiz && maxLab * size * 0.58 > (W - 40) / n - 4 ? maxLab * size * 0.58 * 0.57 : 0
  const m = horiz
    ? { l: maxLab * size * 0.6 + 14, r: showValues ? (showPercent ? pillW + 10 : 0) + valW + 18 : 14, t: 4, b: showAxis ? size * 2 : 6 }
    : { l: 8, r: 8, t: showValues ? size * (showPercent ? 3.6 : 2) : 10, b: size * 2.6 + rot }
  const pw = Math.max(40, W - m.l - m.r)
  const ph = Math.max(40, H - m.t - m.b)
  const band = (horiz ? ph : pw) / n
  const thick = horiz ? Math.min(trackHeight, band * 0.74) : Math.min(trackHeight * 1.8, band * 0.62)
  const U = (pc) => ((horiz ? pw : ph) * pc) / sc.hi // percent -> length along the track
  const statusOf = (pct) => (pct < rngs[0] ? errorColor : pct < (rngs[1] ?? rngs[0]) ? warnColor : okColor)
  const colorOf = (pct) => (statusColors ? statusOf(pct) : color)
  // range bands: darkest (behind) to the track colour (past the last range)
  const bandFill = (k) => mix(trackColor, mutedColor, 0.42 * (1 - k / rngs.length))
  // a box along the track: lengths u0..u1, across the band with offset v0 and thickness th
  const box = (u0, u1, i, v0, th) => {
    const base = (horiz ? m.t : m.l) + i * band + (band - thick) / 2 + v0
    return horiz ? { x: m.l + u0, y: base, w: u1 - u0, h: th } : { x: base, y: m.t + ph - u1, w: th, h: u1 - u0 }
  }
  const tipRows = (r) => [
    { color: colorOf(r.pct), label: 'Actual', value: fmt(r.a) },
    { label: 'Target', value: fmt(r.t) },
    { label: 'Of target', value: `${Math.round(r.pct)}%` },
  ]

  return (
    <Card wrapRef={(el) => { wrap.current = el; boxRef.current = el }} {...{ width, background, textColor, mutedColor, size, title, subtitle, tip }}>
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${title}. Bullet chart. ${rows.map((r) => `${r.label}: ${fmt(r.a)} of ${fmt(r.t)} target, ${Math.round(r.pct)} percent`).join('; ')}`}
        style={{ display: 'block', overflow: 'visible' }}
        onMouseLeave={() => { setHov(-1); setTip(null) }}
      >
        <defs>
          <pattern id={`st${uid}`} width={stripeWidth * 2} height={stripeWidth * 2} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width={stripeWidth} height={stripeWidth * 2} fill="#ffffff" opacity="0.35" />
          </pattern>
        </defs>

        {horiz &&
          sc.ticks.map((t, k) => (
            <g key={k}>
              {showGrid && <line x1={m.l + U(t)} x2={m.l + U(t)} y1={m.t} y2={m.t + ph} stroke={gridColor} strokeWidth="2" strokeDasharray="5 7" strokeLinecap="round" />}
              {showAxis && <text x={m.l + U(t)} y={m.t + ph + size * 1.45} textAnchor="middle" fontSize={size * 0.82} fill={mutedColor} style={{ fontVariantNumeric: 'tabular-nums' }}>{t}%</text>}
            </g>
          ))}
        {!horiz &&
          showGrid &&
          sc.ticks.map((t, k) => <line key={k} x1={m.l} x2={m.l + pw} y1={m.t + ph - U(t)} y2={m.t + ph - U(t)} stroke={gridColor} strokeWidth="2" strokeDasharray="5 7" strokeLinecap="round" />)}

        {rows.map((row, i) => {
          const k = stag(p, i, n)
          const aLen = U(Math.min(row.pct, sc.hi)) * pop(k)
          const tLen = U(100)
          const barTh = thick * clamp(barThickness, 0.15, 0.9)
          const bar = box(0, Math.max(0, aLen), i, (thick - barTh) / 2, barTh)
          const br = Math.min(barRadius, barTh / 2)
          const barD = rrect(bar.x, bar.y, bar.w, bar.h, [br, br, br, br])
          const status = colorOf(row.pct)
          const full = box(0, U(sc.hi), i, 0, thick)
          const tr = Math.min(thick / 2, 10)
          const trackD = rrect(full.x, full.y, full.w, full.h, [tr, tr, tr, tr])
          const tg = box(tLen, tLen, i, 0, thick)
          const mid = (horiz ? m.t : m.l) + i * band + band / 2
          const name = row.label.length > 20 ? row.label.slice(0, 19) + '…' : row.label
          const tight = !horiz && name.length * size * 0.58 > band - 4
          // stripe band on the leading 28% of the bar
          const sb = horiz ? { x: bar.x + bar.w * 0.72, y: bar.y, w: bar.w * 0.28, h: bar.h } : { x: bar.x, y: bar.y, w: bar.w, h: bar.h * 0.28 }
          const mk = pop(clamp((k - 0.4) / 0.6, 0, 1))
          const ds = Math.min(thick / 2 + 3, size * 0.95) // half-height of the diamond marker
          const pc = Math.round(row.pct * ease(k))
          const px = horiz ? m.l + pw + 14 : mid - pillW / 2
          const py = horiz ? mid - size * 0.78 : m.t - size * 3.4
          return (
            <g key={i} opacity={hov >= 0 && hov !== i ? 0.4 : 1} style={{ transition: 'opacity .2s' }}>
              {/* the track, split into flat range bands */}
              <clipPath id={`t${uid}${i}`}><path d={trackD} /></clipPath>
              <path d={trackD} fill={trackColor} />
              {showRanges && (
                <g clipPath={`url(#t${uid}${i})`}>
                  {rngs.map((r, ri) => {
                    const b = box(U(ri ? Math.min(rngs[ri - 1], sc.hi) : 0), U(Math.min(r, sc.hi)), i, 0, thick)
                    return <rect key={ri} x={b.x} y={b.y} width={Math.max(0, b.w)} height={Math.max(0, b.h)} fill={bandFill(ri)} />
                  })}
                </g>
              )}
              {/* actual */}
              {aLen > 0.5 && (
                <>
                  <path d={barD} fill={status} />
                  {stripes && bar.w > 2 && bar.h > 2 && (
                    <>
                      <clipPath id={`b${uid}${i}`}><path d={barD} /></clipPath>
                      <g clipPath={`url(#b${uid}${i})`}>
                        <rect x={sb.x} y={sb.y} width={sb.w} height={sb.h} fill={mix(status, '#000000', 0.12)} />
                        <rect x={sb.x} y={sb.y} width={sb.w} height={sb.h} fill={`url(#st${uid})`} />
                      </g>
                    </>
                  )}
                </>
              )}
              {/* target */}
              {mk > 0 && (
                <g transform={`translate(${tg.x + tg.w / 2} ${tg.y + tg.h / 2}) scale(${mk}) translate(${-(tg.x + tg.w / 2)} ${-(tg.y + tg.h / 2)})`}>
                  {markerStyle === 'diamond' ? (
                    <path
                      d={horiz
                        ? `M${tg.x},${tg.y + thick / 2 - ds}L${tg.x + ds * 0.62},${tg.y + thick / 2}L${tg.x},${tg.y + thick / 2 + ds}L${tg.x - ds * 0.62},${tg.y + thick / 2}Z`
                        : `M${tg.x + thick / 2 - ds},${tg.y}L${tg.x + thick / 2},${tg.y - ds * 0.62}L${tg.x + thick / 2 + ds},${tg.y}L${tg.x + thick / 2},${tg.y + ds * 0.62}Z`}
                      fill={markerColor}
                      stroke={background}
                      strokeWidth="2"
                      strokeLinejoin="round"
                    />
                  ) : horiz ? (
                    <rect x={tg.x - 2.5} y={tg.y - thick * 0.16} width="5" height={thick * 1.32} rx="2.5" fill={markerColor} stroke={background} strokeWidth="1.5" />
                  ) : (
                    <rect x={tg.x - thick * 0.16} y={tg.y - 2.5} width={thick * 1.32} height="5" rx="2.5" fill={markerColor} stroke={background} strokeWidth="1.5" />
                  )}
                </g>
              )}

              {horiz ? (
                <text x={m.l - 12} y={mid} dy="0.35em" textAnchor="end" fontSize={size * 0.92} fontWeight="600" fill={hov === i ? textColor : mutedColor} style={{ pointerEvents: 'none' }}>{name}</text>
              ) : (
                <text x={mid} y={m.t + ph + size * 1.5} textAnchor={tight ? 'end' : 'middle'} transform={tight ? `rotate(-35 ${mid} ${m.t + ph + size * 1.5})` : undefined} fontSize={size * 0.9} fontWeight="600" fill={hov === i ? textColor : mutedColor} style={{ pointerEvents: 'none' }}>{name}</text>
              )}

              {showValues && k > 0.15 && (
                <g style={{ pointerEvents: 'none', fontVariantNumeric: 'tabular-nums' }}>
                  {showPercent && (
                    <>
                      <path d={rrect(px, py, pillW, size * 1.56, [size * 0.78, size * 0.78, size * 0.78, size * 0.78])} fill={status} />
                      <text x={px + pillW / 2} y={py + size * 0.78} dy="0.36em" textAnchor="middle" fontSize={size * 0.86} fontWeight="800" fill={inkOn(status, textColor)}>{pc}%</text>
                    </>
                  )}
                  <text
                    x={horiz ? px + (showPercent ? pillW + 10 : 0) : mid}
                    y={horiz ? mid : m.t - size * 0.7}
                    dy={horiz ? '0.35em' : 0}
                    textAnchor={horiz ? 'start' : 'middle'}
                    fontSize={size * 0.95}
                  >
                    <tspan fill={textColor} fontWeight="700">{fmt(row.a * ease(k))}</tspan>
                    {horiz && <tspan fill={mutedColor} fontWeight="500">{` / ${fmt(row.t)}`}</tspan>}
                  </text>
                </g>
              )}
            </g>
          )
        })}

        {rows.map((row, i) => (
          <rect
            key={`h${i}`}
            x={horiz ? 0 : m.l + i * band}
            y={horiz ? m.t + i * band : 0}
            width={horiz ? W : band}
            height={horiz ? band : m.t + ph}
            fill="transparent"
            onMouseEnter={(e) => { setHov(i); tooltip && setTip(tipAt(e, wrap, row.label, tipRows(row))) }}
            onMouseMove={(e) => tooltip && setTip((t) => (t ? { ...t, ...tipAt(e, wrap, t.title, t.rows) } : t))}
          />
        ))}
      </svg>
    </Card>
  )
}
