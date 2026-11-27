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

// Radar / spider chart. Each row is an axis ("Speed:8|6"), each value a series.
// Polygons grow out from the centre one after another; `curve` rounds them into
// smooth blobs, `shape` turns the web into circles, and hovering a vertex lists every
// series for that axis. The legend highlights one series at a time.
export default function RadarChart({
  data = 'Speed:88|62|70, Power:72|90|58, Defense:64|55|86, Range:81|48|66, Stamina:59|77|91, Skill:92|70|60',
  series = 'Falcon, Bison, Tortoise',
  title = 'Team profile',
  subtitle = 'Rated 0 to 100 across six attributes',
  maxValue = 100,
  levels = 5,
  shape = 'polygon',
  curve = false,
  filled = true,
  fillOpacity = 0.22,
  strokeWidth = 2.4,
  showDots = true,
  dotSize = 4.5,
  showSpokes = true,
  showLevelLabels = true,
  showLabels = true,
  showValues = false,
  showLegend = true,
  startAngle = 0,
  width = 500,
  height = 330,
  tooltip = true,
  animate = true,
  duration = 1200,
  valueFormat = 'number',
  decimals = 0,
  prefix = '',
  suffix = '',
  size = 13,
  color = '#d77757',
  color2 = '#5b9bd5',
  color3 = '#4eba65',
  color4 = '#b48ead',
  background = '#111214',
  textColor = '#ececec',
  mutedColor = '#8b8f98',
}) {
  const id = useId().replace(/:/g, '')
  const wrap = useRef(null)
  const [boxRef, boxW] = useWidth()
  const fmt = makeFmt({ valueFormat, decimals, prefix, suffix })
  const rows = useMemo(() => parseRows(data), [data])
  const S = Math.max(1, ...rows.map((r) => r.values.length))
  const names = splitNames(series)
  const sName = (s) => names[s] ?? `Series ${s + 1}`
  const pal = [color, color2, color3, color4]
  const A = Math.max(3, rows.length)
  const top = maxValue > 0 ? maxValue : niceRange(0, Math.max(1, ...rows.flatMap((r) => r.values))).hi
  const L = clamp(Math.round(levels), 2, 10)
  const p = useReveal(animate, duration, `${data}|${shape}|${curve}`)
  const [hovS, setHovS] = useState(null)
  const [tip, setTip] = useState(null)
  const [hovA, setHovA] = useState(null)

  const W = Math.max(260, Math.min(width, (boxW || width)) - size * 2.8)
  const H = Math.min(height, W * 0.95 + 20)
  const labelRoom = showLabels ? size * 5.2 : size
  const R = Math.max(40, Math.min(W / 2 - labelRoom, H / 2 - size * 2.4))
  const cx = W / 2
  const cy = H / 2
  const ang = (i) => ((startAngle - 90) * Math.PI) / 180 + (i / A) * Math.PI * 2
  const pt = (i, f) => [cx + Math.cos(ang(i)) * R * f, cy + Math.sin(ang(i)) * R * f]
  const web = (f) =>
    shape === 'circle' ? null : Array.from({ length: A }, (_, i) => pt(i, f).join(',')).join(' ')
  const smooth = (pts) => {
    const n = pts.length
    let d = `M${pts[0][0]},${pts[0][1]}`
    for (let i = 0; i < n; i++) {
      const [p0, p1, p2, p3] = [pts[(i - 1 + n) % n], pts[i], pts[(i + 1) % n], pts[(i + 2) % n]]
      d += `C${p1[0] + (p2[0] - p0[0]) / 6},${p1[1] + (p2[1] - p0[1]) / 6} ${p2[0] - (p3[0] - p1[0]) / 6},${p2[1] - (p3[1] - p1[1]) / 6} ${p2[0]},${p2[1]}`
    }
    return d + 'Z'
  }
  const sp = (s) => ease(clamp((p - (S > 1 ? (s / (S - 1)) * 0.3 : 0)) / 0.7, 0, 1))
  const poly = (s) => {
    const k = sp(s)
    const pts = rows.map((r, i) => pt(i, clamp((r.values[s] ?? 0) / top, 0, 1.05) * k))
    return { pts, d: curve ? smooth(pts) : 'M' + pts.map((q) => q.join(',')).join('L') + 'Z' }
  }
  const op = (s) => (hovS !== null && hovS !== s ? 0.18 : 1)

  const showAxisTip = (e, i) =>
    tooltip &&
    setTip(tipAt(e, wrap, rows[i].label, Array.from({ length: S }, (_, s) => ({ color: pal[s % 4], label: sName(s), value: fmt(rows[i].values[s] ?? 0), strong: s === hovS }))))

  return (
    <Card
      wrapRef={(el) => { wrap.current = el; boxRef.current = el }}
      {...{ width, background, color, textColor, mutedColor, size, title, subtitle, tip }}
      legend={showLegend && S > 1 ? <Legend items={Array.from({ length: S }, (_, s) => ({ label: sName(s), color: pal[s % 4] }))} onHover={setHovS} mutedColor={mutedColor} /> : null}
    >
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${title}. Radar chart. ${rows.map((r) => `${r.label}: ${r.values.map((v, s) => `${sName(s)} ${fmt(v)}`).join(', ')}`).join('; ')}`}
        style={{ display: 'block', maxWidth: '100%', margin: '0 auto', overflow: 'visible' }}
        onMouseLeave={() => { setTip(null); setHovA(null) }}
      >
        <defs>
          {pal.map((c, k) => (
            <radialGradient key={k} id={`${id}f${k}`} gradientUnits="userSpaceOnUse" cx={cx} cy={cy} r={R}>
              <stop offset="0" stopColor={c} stopOpacity={fillOpacity * 0.35} />
              <stop offset="1" stopColor={c} stopOpacity={fillOpacity * 1.6} />
            </radialGradient>
          ))}
        </defs>

        {/* web */}
        {Array.from({ length: L }, (_, l) => {
          const f = (l + 1) / L
          return shape === 'circle' ? (
            <circle key={l} cx={cx} cy={cy} r={R * f} fill="none" stroke={mutedColor} strokeOpacity={l === L - 1 ? 0.34 : 0.15} strokeDasharray={l === L - 1 ? undefined : '2 5'} />
          ) : (
            <polygon key={l} points={web(f)} fill={l === L - 1 ? `${mutedColor}0d` : 'none'} stroke={mutedColor} strokeOpacity={l === L - 1 ? 0.34 : 0.15} strokeDasharray={l === L - 1 ? undefined : '2 5'} strokeLinejoin="round" />
          )
        })}
        {showSpokes && rows.map((_, i) => <line key={i} x1={cx} y1={cy} x2={pt(i, 1)[0]} y2={pt(i, 1)[1]} stroke={mutedColor} strokeOpacity={hovA === i ? 0.5 : 0.18} />)}
        {showLevelLabels &&
          Array.from({ length: L }, (_, l) => {
            const f = (l + 1) / L
            return (
              <text key={l} x={cx + 5} y={cy - R * f - 3} fontSize={size * 0.72} fill={mutedColor} fillOpacity="0.8" style={{ pointerEvents: 'none' }}>
                {axisFmt.format(top * f)}
              </text>
            )
          })}

        {/* series */}
        {Array.from({ length: S }, (_, s) => {
          const { pts, d } = poly(s)
          const c = pal[s % 4]
          return (
            <g key={s} opacity={op(s)} style={{ transition: 'opacity .2s' }}>
              <path d={d} fill={filled ? `url(#${id}f${s % 4})` : 'none'} stroke={c} strokeWidth={strokeWidth} strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 ${size * 0.5}px ${c}66)` }} />
              {showDots && pts.map((q, i) => <circle key={i} cx={q[0]} cy={q[1]} r={dotSize} fill={background} stroke={c} strokeWidth="2" opacity={sp(s)} />)}
              {showValues && pts.map((q, i) => (
                <text key={i} x={q[0] + (q[0] - cx) * 0.12} y={q[1] + (q[1] - cy) * 0.12} dy="0.34em" textAnchor="middle" fontSize={size * 0.78} fontWeight="600" fill={c} opacity={sp(s)} style={{ pointerEvents: 'none' }}>
                  {fmt(rows[i].values[s] ?? 0)}
                </text>
              ))}
            </g>
          )
        })}

        {/* axis labels */}
        {showLabels &&
          rows.map((r, i) => {
            const [x, y] = pt(i, 1.0)
            const dx = Math.cos(ang(i))
            const dy = Math.sin(ang(i))
            const anchor = Math.abs(dx) < 0.25 ? 'middle' : dx > 0 ? 'start' : 'end'
            return (
              <text key={i} x={x + dx * (size * 0.9)} y={y + dy * (size * 0.9)} dy={dy > 0.3 ? '0.8em' : dy < -0.3 ? '-0.15em' : '0.34em'} textAnchor={anchor} fontSize={size} fill={hovA === i ? textColor : mutedColor} style={{ transition: 'fill .2s', pointerEvents: 'none' }}>
                {r.label.length > 14 ? r.label.slice(0, 13) + '…' : r.label}
              </text>
            )
          })}

        {/* hover targets, one wedge per axis */}
        {rows.map((_, i) => {
          const [x, y] = pt(i, 1)
          return (
            <g key={i}>
              <line x1={cx} y1={cy} x2={x} y2={y} stroke="transparent" strokeWidth={Math.max(18, (R * Math.PI) / A)} strokeLinecap="round" onMouseEnter={(e) => { setHovA(i); showAxisTip(e, i) }} onMouseMove={(e) => showAxisTip(e, i)} />
            </g>
          )
        })}
      </svg>
    </Card>
  )
}
