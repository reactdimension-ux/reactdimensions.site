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

// Bullet chart: actual against a target, on top of shaded ranges (poor / ok / good).
// Each row is "Label:actual|target". `ranges` are percentages of the target, so
// rows with different units line up and every target sits at the same place.
// The bar can be coloured by status (below, near, past the ranges).
export default function BulletChart({
  data = 'Revenue:912|1000, New customers:340|300, Satisfaction:4.1|4.5, Uptime:99.2|99.9, Support tickets:86|60, Profit margin:21|25',
  title = 'Q4 scorecard',
  subtitle = 'Actual vs target. Dark to light bands: behind, on track, ahead',
  ranges = '70, 90, 120',
  orientation = 'horizontal',
  sort = 'none',
  width = 680,
  height = 300,
  trackHeight = 26,
  barThickness = 0.38,
  barRadius = 6,
  markerStyle = 'line',
  statusColors = true,
  showRanges = true,
  showValues = true,
  showPercent = true,
  showAxis = true,
  showGrid = false,
  tooltip = true,
  animate = true,
  duration = 1100,
  valueFormat = 'number',
  decimals = 0,
  prefix = '',
  suffix = '',
  size = 13,
  color = '#d77757',
  okColor = '#4eba65',
  warnColor = '#e0a030',
  errorColor = '#e5534b',
  rangeColor = '#ffffff',
  markerColor = '#ececec',
  background = '#111214',
  textColor = '#ececec',
  mutedColor = '#8b8f98',
}) {
  const id = useId().replace(/:/g, '')
  const wrap = useRef(null)
  const [boxRef, boxW] = useWidth()
  const fmtBase = { valueFormat, prefix, suffix }
  // each row can have its own decimals: small numbers like 4.1 keep one
  const fmt = (v) => makeFmt({ ...fmtBase, decimals: decimals || (v % 1 !== 0 ? 1 : 0) })(v)
  const rngs = useMemo(() => {
    const r = splitNames(ranges).map(num).filter((x) => x > 0).sort((a, b) => a - b)
    return r.length ? r : [70, 90, 120]
  }, [ranges])
  const rows0 = useMemo(() => parseRows(data), [data])
  const rows = useMemo(() => {
    const r = rows0.map((x) => {
      const a = x.values[0] ?? 0
      const t = x.values[1] || 1
      return { label: x.label, a, t, pct: (a / t) * 100 }
    })
    if (sort === 'asc') r.sort((a, b) => a.pct - b.pct)
    else if (sort === 'desc') r.sort((a, b) => b.pct - a.pct)
    return r
  }, [rows0, sort])
  const p = useReveal(animate, duration, `${data}|${ranges}|${orientation}|${sort}`)
  const [hov, setHov] = useState(null)
  const [tip, setTip] = useState(null)

  const horizontal = orientation === 'horizontal'
  const n = rows.length
  const maxPct = Math.max(rngs[rngs.length - 1], ...rows.map((r) => r.pct * 1.02), 100)
  const sc = niceRange(0, maxPct, 4)
  const ticks = ticksOf(sc)
  const W = Math.max(240, (boxW || width) - size * 2.8)
  const H = height
  const maxLab = Math.min(20, Math.max(1, ...rows.map((r) => r.label.length)))
  const m = horizontal
    ? { l: maxLab * size * 0.58 + 14, r: showValues ? size * 8.6 : 14, t: 4, b: showAxis ? size * 2.1 : 6 }
    : { l: 8, r: 8, t: showValues ? size * 3 : 10, b: size * 2.6 + (showAxis ? 0 : 0) }
  const pw = Math.max(40, W - m.l - m.r)
  const ph = Math.max(40, H - m.t - m.b)
  const band = (horizontal ? ph : pw) / Math.max(1, n)
  const thick = horizontal ? Math.min(trackHeight, band * 0.78) : Math.min(trackHeight * 1.8, band * 0.62)
  const U = (pc) => ((horizontal ? pw : ph) * pc) / sc.hi // percent -> length along the track
  const rangeAlpha = (i) => 0.05 + (rngs.length > 1 ? (i / (rngs.length - 1)) * 0.12 : 0.1)
  const dim = (i) => (hov !== null && hov !== i ? 0.35 : 1)

  const statusOf = (pct) => (pct < rngs[0] ? errorColor : pct < (rngs[1] ?? rngs[0]) ? warnColor : okColor)
  const colorOf = (pct) => (statusColors ? statusOf(pct) : color)
  // a box along the track: from u0 to u1 (lengths), across band index with offset v0 and thickness th
  const box = (u0, u1, i, v0, th) => {
    const base = (horizontal ? m.t : m.l) + i * band + (band - thick) / 2 + v0
    return horizontal ? { x: m.l + u0, y: base, w: u1 - u0, h: th } : { x: base, y: m.t + ph - u1, w: th, h: u1 - u0 }
  }

  return (
    <Card wrapRef={(el) => { wrap.current = el; boxRef.current = el }} {...{ width, background, color, textColor, mutedColor, size, title, subtitle, tip }}>
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${title}. Bullet chart. ${rows.map((r) => `${r.label}: ${fmt(r.a)} of ${fmt(r.t)} target, ${Math.round(r.pct)} percent`).join('; ')}`}
        style={{ display: 'block', maxWidth: '100%', overflow: 'visible' }}
        onMouseLeave={() => { setHov(null); setTip(null) }}
      >
        <defs>
          {[okColor, warnColor, errorColor, color].map((c, k) => (
            <linearGradient key={k} id={`${id}b${k}`} x1="0" y1="0" x2={horizontal ? 1 : 0} y2={horizontal ? 0 : 1}>
              <stop offset="0" stopColor={c} stopOpacity={horizontal ? 0.7 : 1} />
              <stop offset="1" stopColor={c} stopOpacity={horizontal ? 1 : 0.7} />
            </linearGradient>
          ))}
        </defs>

        {showAxis &&
          ticks.map((t, i) => {
            const u = U(t)
            return horizontal ? (
              <g key={i}>
                {showGrid && <line x1={m.l + u} x2={m.l + u} y1={m.t} y2={m.t + ph} stroke={mutedColor} strokeOpacity="0.14" strokeDasharray="2 5" />}
                <text x={m.l + u} y={m.t + ph + size * 1.4} textAnchor="middle" fontSize={size * 0.82} fill={mutedColor}>{t}%</text>
              </g>
            ) : null
          })}

        {rows.map((row, i) => {
          const ip = stag(p, i, n)
          const aLen = U(Math.min(row.pct, sc.hi)) * ip
          const tLen = U(100)
          const barTh = thick * clamp(barThickness, 0.15, 0.9)
          const bar = box(0, aLen, i, (thick - barTh) / 2, barTh)
          const k = statusColors ? (row.pct < rngs[0] ? 2 : row.pct < (rngs[1] ?? rngs[0]) ? 1 : 0) : 3
          const status = colorOf(row.pct)
          const tg = box(tLen, tLen, i, 0, thick)
          const mid = (horizontal ? m.t : m.l) + i * band + band / 2
          const label = row.label.length > 20 ? row.label.slice(0, 19) + '…' : row.label
          const shownA = row.a * ip
          return (
            <g key={i} opacity={dim(i)} style={{ transition: 'opacity .2s' }}>
              {/* ranges, widest first so the narrower ones sit on top */}
              {showRanges
                ? [...rngs].map((r, ri) => ({ r, ri })).reverse().map(({ r, ri }) => {
                    const b = box(0, U(Math.min(r, sc.hi)), i, 0, thick)
                    return <rect key={ri} x={b.x} y={b.y} width={b.w} height={b.h} rx={Math.min(thick / 2, 8)} fill={rangeColor} fillOpacity={rangeAlpha(ri)} />
                  })
                : (() => {
                    const b = box(0, U(sc.hi), i, 0, thick)
                    return <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={Math.min(thick / 2, 8)} fill={rangeColor} fillOpacity="0.06" />
                  })()}
              {/* actual */}
              <path d={rrect(bar.x, bar.y, bar.w, bar.h, horizontal ? [barRadius, barRadius, barRadius, barRadius] : [barRadius, barRadius, barRadius, barRadius])} fill={`url(#${id}b${k})`} style={{ filter: `drop-shadow(0 0 ${size * 0.45}px ${status}55)` }} />
              {/* target */}
              {markerStyle === 'diamond' ? (
                <path d={horizontal ? `M${tg.x},${tg.y - 2}l5,${thick / 2 + 2}l-5,${thick / 2 + 2}l-5,-${thick / 2 + 2}z` : `M${tg.x - 2},${tg.y}l${thick / 2 + 2},-5l${thick / 2 + 2},5l-${thick / 2 + 2},5z`} fill={markerColor} opacity={ip} />
              ) : horizontal ? (
                <rect x={tg.x - 1.5} y={tg.y - thick * 0.12} width="3" height={thick * 1.24} rx="1.5" fill={markerColor} opacity={ip} />
              ) : (
                <rect x={tg.x - thick * 0.12} y={tg.y - 1.5} width={thick * 1.24} height="3" rx="1.5" fill={markerColor} opacity={ip} />
              )}

              {horizontal ? (
                <text x={m.l - 10} y={mid} dy="0.34em" textAnchor="end" fontSize={size} fill={hov === i ? textColor : mutedColor} style={{ transition: 'fill .2s' }}>{label}</text>
              ) : (
                <text x={mid} y={m.t + ph + size * 1.5} textAnchor={row.label.length * size * 0.58 > band - 4 ? 'end' : 'middle'} transform={row.label.length * size * 0.58 > band - 4 ? `rotate(-35 ${mid} ${m.t + ph + size * 1.5})` : undefined} fontSize={size} fill={hov === i ? textColor : mutedColor} style={{ transition: 'fill .2s' }}>{label}</text>
              )}

              {showValues && (
                <text
                  x={horizontal ? m.l + pw + 14 : mid}
                  y={horizontal ? mid : m.t - size * 0.9}
                  dy={horizontal ? '0.34em' : 0}
                  textAnchor={horizontal ? 'start' : 'middle'}
                  fontSize={size * 0.92}
                  opacity={ip}
                  style={{ pointerEvents: 'none', fontVariantNumeric: 'tabular-nums' }}
                >
                  <tspan fill={textColor} fontWeight="650">{fmt(shownA)}</tspan>
                  <tspan fill={mutedColor}>{horizontal ? ` / ${fmt(row.t)}` : ''}</tspan>
                  {showPercent && <tspan fill={status} fontWeight="650" dx="0.6em">{Math.round(row.pct * ip)}%</tspan>}
                </text>
              )}
            </g>
          )
        })}

        {rows.map((row, i) => (
          <rect
            key={i}
            x={horizontal ? 0 : m.l + i * band}
            y={horizontal ? m.t + i * band : m.t - (showValues ? size * 2.2 : 0)}
            width={horizontal ? W : band}
            height={horizontal ? band : ph + (showValues ? size * 2.2 : 0)}
            fill="transparent"
            onMouseEnter={(e) => { setHov(i); tooltip && setTip(tipAt(e, wrap, row.label, [{ color: colorOf(row.pct), label: 'Actual', value: fmt(row.a), strong: true }, { label: 'Target', value: fmt(row.t) }, { label: 'Of target', value: `${Math.round(row.pct)}%` }])) }}
            onMouseMove={(e) => tooltip && setTip(tipAt(e, wrap, row.label, [{ color: colorOf(row.pct), label: 'Actual', value: fmt(row.a), strong: true }, { label: 'Target', value: fmt(row.t) }, { label: 'Of target', value: `${Math.round(row.pct)}%` }]))}
          />
        ))}
      </svg>
    </Card>
  )
}
