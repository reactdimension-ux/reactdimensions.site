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

// Lollipop chart: a thin stem and a dot per category, lighter than bars when there
// are many rows. Set `baseline` to measure from a value other than zero, and
// `colorMode` to colour by above/below the baseline, by size, or one colour.
export default function LollipopChart({
  data = 'Rust:84, TypeScript:78, Python:71, Go:66, Kotlin:58, Swift:52, Ruby:41, PHP:33, Perl:19',
  title = 'Developer satisfaction',
  subtitle = 'Share who would use it again',
  orientation = 'horizontal',
  sort = 'desc',
  width = 680,
  height = 300,
  baseline = 0,
  colorMode = 'by value',
  dotStyle = 'glow',
  stemStyle = 'gradient',
  dotSize = 7,
  stemWidth = 2.5,
  highlightTop = 0,
  showRank = false,
  showValues = true,
  showGrid = true,
  showAxis = true,
  tooltip = true,
  animate = true,
  duration = 1100,
  valueFormat = 'number',
  decimals = 0,
  prefix = '',
  suffix = '%',
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
  const rows0 = useMemo(() => parseRows(data), [data])
  const rows = useMemo(() => {
    const r = rows0.map((x) => ({ label: x.label, v: x.values[0] ?? 0 }))
    if (sort === 'asc') r.sort((a, b) => a.v - b.v)
    else if (sort === 'desc') r.sort((a, b) => b.v - a.v)
    else if (sort === 'label') r.sort((a, b) => a.label.localeCompare(b.label))
    return r
  }, [rows0, sort])
  const p = useReveal(animate, duration, `${data}|${orientation}|${sort}|${baseline}`)
  const [hov, setHov] = useState(null)
  const [tip, setTip] = useState(null)

  const horizontal = orientation === 'horizontal'
  const n = rows.length
  const lo0 = Math.min(baseline, ...rows.map((r) => r.v))
  const hi0 = Math.max(baseline, ...rows.map((r) => r.v))
  const sc = niceRange(lo0, hi0)
  const ticks = ticksOf(sc)
  const W = Math.max(240, (boxW || width) - size * 2.8)
  const H = height
  const maxLab = Math.min(18, Math.max(1, ...rows.map((r) => r.label.length))) + (showRank ? 3 : 0)
  const tl = ticks.map((t) => prefix + axisFmt.format(t) + suffix)
  const m = horizontal
    ? { l: maxLab * size * 0.58 + 14, r: showValues ? size * 4.6 : 16, t: 6, b: showAxis ? size * 2.1 : 8 }
    : { l: showAxis ? Math.max(...tl.map((s) => s.length)) * size * 0.58 + 14 : 8, r: 10, t: showValues ? size * 2.4 : 12, b: size * 2.5 }
  const pw = Math.max(40, W - m.l - m.r)
  const ph = Math.max(40, H - m.t - m.b)
  const band = (horizontal ? ph : pw) / Math.max(1, n)
  const along = (v) => (horizontal ? pw : ph) * ((v - sc.lo) / (sc.hi - sc.lo))
  // a point along the value axis -> x or y in the svg
  const X = (v) => m.l + along(v)
  const Y = (v) => m.t + ph - along(v)
  const maxV = Math.max(...rows.map((r) => r.v))
  const minV = Math.min(...rows.map((r) => r.v))
  const rank = [...rows].sort((a, b) => b.v - a.v).map((r) => r.label)

  const colorOf = (v) => {
    if (colorMode === 'above / below') return v >= baseline ? color3 : color2
    if (colorMode === 'by value') return mix(color2, color, maxV === minV ? 1 : (v - minV) / (maxV - minV))
    if (colorMode === 'palette') return [color, color2, color3, color4][rows.findIndex((r) => r.v === v) % 4]
    return color
  }
  const isTop = (i) => highlightTop <= 0 || rank.indexOf(rows[i].label) < highlightTop
  const dim = (i) => (hov !== null && hov !== i ? 0.3 : 1) * (isTop(i) ? 1 : 0.35)
  const r0 = dotSize

  return (
    <Card wrapRef={(el) => { wrap.current = el; boxRef.current = el }} {...{ width, background, color, textColor, mutedColor, size, title, subtitle, tip }}>
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${title}. Lollipop chart. ${rows.map((r) => `${r.label}: ${fmt(r.v)}`).join('; ')}`}
        style={{ display: 'block', maxWidth: '100%', overflow: 'visible' }}
        onMouseLeave={() => { setHov(null); setTip(null) }}
      >
        <defs>
          {rows.map((r, i) => {
            const c = colorOf(r.v)
            return (
              <linearGradient key={i} id={`${id}s${i}`} gradientUnits="userSpaceOnUse" x1={horizontal ? X(baseline) : 0} x2={horizontal ? X(r.v) : 0} y1={horizontal ? 0 : Y(baseline)} y2={horizontal ? 0 : Y(r.v)}>
                <stop offset="0" stopColor={c} stopOpacity="0.12" />
                <stop offset="1" stopColor={c} stopOpacity="1" />
              </linearGradient>
            )
          })}
          <radialGradient id={`${id}d`}>
            <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
            <stop offset="0.7" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
        </defs>

        {ticks.map((t, i) => {
          const isB = t === baseline
          return horizontal ? (
            <g key={i}>
              {(showGrid || isB) && <line x1={X(t)} x2={X(t)} y1={m.t} y2={m.t + ph} stroke={mutedColor} strokeOpacity={isB ? 0.45 : 0.15} strokeDasharray={isB ? undefined : '2 5'} />}
              {showAxis && <text x={X(t)} y={m.t + ph + size * 1.4} textAnchor="middle" fontSize={size * 0.85} fill={mutedColor}>{tl[i]}</text>}
            </g>
          ) : (
            <g key={i}>
              {(showGrid || isB) && <line x1={m.l} x2={m.l + pw} y1={Y(t)} y2={Y(t)} stroke={mutedColor} strokeOpacity={isB ? 0.45 : 0.15} strokeDasharray={isB ? undefined : '2 5'} />}
              {showAxis && <text x={m.l - 9} y={Y(t)} dy="0.34em" textAnchor="end" fontSize={size * 0.85} fill={mutedColor}>{tl[i]}</text>}
            </g>
          )
        })}

        {rows.map((row, i) => {
          const ip = stag(p, i, n)
          const c = colorOf(row.v)
          const mid = (horizontal ? m.t : m.l) + i * band + band / 2
          const v = baseline + (row.v - baseline) * ip
          const label = (showRank ? `${rank.indexOf(row.label) + 1}  ` : '') + (row.label.length > 18 ? row.label.slice(0, 17) + '…' : row.label)
          const cx = horizontal ? X(v) : mid
          const cy = horizontal ? mid : Y(v)
          const bx = horizontal ? X(baseline) : mid
          const by = horizontal ? mid : Y(baseline)
          const valText = fmt(baseline + (row.v - baseline) * ip)
          const below = row.v < baseline
          return (
            <g key={i} opacity={dim(i)} style={{ transition: 'opacity .2s' }}>
              <line x1={bx} y1={by} x2={cx} y2={cy} stroke={stemStyle === 'gradient' ? `url(#${id}s${i})` : c} strokeWidth={stemWidth} strokeLinecap="round" strokeDasharray={stemStyle === 'dashed' ? `${stemWidth * 1.6} ${stemWidth * 2.2}` : undefined} />
              {dotStyle === 'glow' && <circle cx={cx} cy={cy} r={r0 * 2.4} fill={c} opacity="0.22" />}
              {dotStyle === 'ring' ? (
                <circle cx={cx} cy={cy} r={r0 * 0.85} fill={background} stroke={c} strokeWidth={Math.max(2, r0 * 0.38)} />
              ) : (
                <>
                  <circle cx={cx} cy={cy} r={r0} fill={c} />
                  <circle cx={cx} cy={cy} r={r0} fill={`url(#${id}d)`} />
                </>
              )}
              {horizontal ? (
                <text x={m.l - 10} y={mid} dy="0.34em" textAnchor="end" fontSize={size} fill={hov === i ? textColor : mutedColor} style={{ transition: 'fill .2s' }}>{label}</text>
              ) : (
                <text x={mid} y={m.t + ph + size * 1.5} textAnchor={row.label.length * size * 0.58 > band - 4 ? 'end' : 'middle'} transform={row.label.length * size * 0.58 > band - 4 ? `rotate(-35 ${mid} ${m.t + ph + size * 1.5})` : undefined} fontSize={size} fill={hov === i ? textColor : mutedColor} style={{ transition: 'fill .2s' }}>{label}</text>
              )}
              {showValues && (
                <text
                  x={horizontal ? cx + (below ? -(r0 + 8) : r0 + 9) : cx}
                  y={horizontal ? cy : cy + (below ? r0 + size * 1.3 : -(r0 + 8))}
                  dy={horizontal ? '0.34em' : 0}
                  textAnchor={horizontal ? (below ? 'end' : 'start') : 'middle'}
                  fontSize={size * 0.92}
                  fontWeight="650"
                  fill={textColor}
                  opacity={ip}
                  style={{ fontVariantNumeric: 'tabular-nums', pointerEvents: 'none' }}
                >
                  {valText}
                </text>
              )}
            </g>
          )
        })}

        {rows.map((row, i) => (
          <rect
            key={i}
            x={horizontal ? m.l : m.l + i * band}
            y={horizontal ? m.t + i * band : m.t}
            width={horizontal ? pw : band}
            height={horizontal ? band : ph}
            fill="transparent"
            onMouseEnter={(e) => { setHov(i); tooltip && setTip(tipAt(e, wrap, row.label, [{ color: colorOf(row.v), label: baseline ? `vs baseline ${fmt(baseline)}` : 'Value', value: fmt(row.v), strong: true }, ...(baseline ? [{ label: 'Difference', value: `${row.v - baseline >= 0 ? '+' : ''}${fmt(row.v - baseline)}` }] : []), { label: 'Rank', value: `#${rank.indexOf(row.label) + 1} of ${n}` }])) }}
            onMouseMove={(e) => tooltip && setTip(tipAt(e, wrap, row.label, [{ color: colorOf(row.v), label: baseline ? `vs baseline ${fmt(baseline)}` : 'Value', value: fmt(row.v), strong: true }, ...(baseline ? [{ label: 'Difference', value: `${row.v - baseline >= 0 ? '+' : ''}${fmt(row.v - baseline)}` }] : []), { label: 'Rank', value: `#${rank.indexOf(row.label) + 1} of ${n}` }]))}
          />
        ))}
      </svg>
    </Card>
  )
}
