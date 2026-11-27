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

// Bar / column chart. One bar per category; give each row several values
// ("Q1:42|31|18") and pick `mode` to group them side by side, stack them, or stack
// them to 100%. Bars grow in with a stagger, numbers count up, hovering a category
// dims the rest and shows a tooltip, and the legend highlights one series.
export default function BarChart({
  data = 'Q1:42|31|18, Q2:58|44|26, Q3:73|52|35, Q4:91|66|47, Q5:84|71|52',
  series = 'Mobile, Web, API',
  title = 'Revenue by quarter',
  subtitle = 'Thousands, by platform',
  orientation = 'vertical',
  mode = 'grouped',
  sort = 'none',
  width = 680,
  height = 300,
  barRadius = 8,
  gap = 0.32,
  groupGap = 4,
  showValues = true,
  showGrid = true,
  showAxis = true,
  showLegend = true,
  gradient = true,
  glow = false,
  highlightMax = false,
  colorByBar = false,
  tooltip = true,
  animate = true,
  duration = 1100,
  valueFormat = 'number',
  decimals = 0,
  prefix = '$',
  suffix = 'k',
  maxValue = 0,
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
  const rows0 = useMemo(() => parseRows(data), [data])
  const S = Math.max(1, ...rows0.map((r) => r.values.length))
  const names = splitNames(series)
  const sName = (s) => names[s] ?? (S > 1 ? `Series ${s + 1}` : 'Value')
  const pal = [color, color2, color3, color4]
  const fmt = makeFmt({ valueFormat, decimals, prefix, suffix })

  const rows = useMemo(() => {
    const r = rows0.map((x) => {
      const v = Array.from({ length: S }, (_, s) => Math.max(0, x.values[s] ?? 0))
      return { label: x.label, v, total: v.reduce((a, b) => a + b, 0) }
    })
    if (sort === 'asc') r.sort((a, b) => a.total - b.total)
    else if (sort === 'desc') r.sort((a, b) => b.total - a.total)
    else if (sort === 'label') r.sort((a, b) => a.label.localeCompare(b.label))
    return r
  }, [rows0, S, sort])

  const p = useReveal(animate, duration, `${data}|${mode}|${orientation}|${sort}`)
  const [hov, setHov] = useState(null)
  const [hovS, setHovS] = useState(null)
  const [tip, setTip] = useState(null)

  const horizontal = orientation === 'horizontal'
  const stacked = (mode === 'stacked' || mode === 'percent') && S > 1
  const pct = mode === 'percent' && S > 1
  const val = (row, s) => (pct ? (row.total ? (row.v[s] / row.total) * 100 : 0) : row.v[s])
  const n = rows.length
  const domain = pct ? 100 : maxValue > 0 ? maxValue : Math.max(0, ...rows.map((r) => (stacked ? r.total : Math.max(...r.v))))
  const sc = niceRange(0, domain || 1)

  const W = Math.max(240, (boxW || width) - size * 2.8)
  const H = height
  const maxLab = Math.min(16, Math.max(1, ...rows.map((r) => r.label.length)))
  const tickLabels = ticksOf(sc).map((t) => axisFmt.format(t) + (pct ? '%' : ''))
  const m = horizontal
    ? { l: maxLab * size * 0.58 + 14, r: showValues ? size * 4.4 : 14, t: 6, b: showAxis ? size * 2.1 : 8 }
    : { l: showAxis ? Math.max(...tickLabels.map((s) => s.length)) * size * 0.6 + 14 : 8, r: 8, t: showValues ? size * 2.2 : 10, b: size * 2.4 }
  const pw = Math.max(40, W - m.l - m.r)
  const ph = Math.max(40, H - m.t - m.b)
  const band = (horizontal ? ph : pw) / Math.max(1, n)
  const inner = band * (1 - clamp(gap, 0.04, 0.9))
  const off = (band - inner) / 2
  const barSize = Math.max(2, stacked ? inner : (inner - (S - 1) * groupGap) / S)
  const len = (v) => ((horizontal ? pw : ph) * v) / sc.hi
  const maxIdx = rows.reduce((a, r, i) => (r.total > (rows[a]?.total ?? -1) ? i : a), 0)
  const charW = size * 0.58

  // build every bar
  const bars = []
  rows.forEach((row, r) => {
    const ip = stag(p, r, n)
    let acc = 0
    const lastNZ = stacked ? row.v.reduce((a, v, s) => (v > 0 ? s : a), -1) : -1
    row.v.forEach((_, s) => {
      const v = val(row, s)
      const L = len(v) * ip
      const start = stacked ? acc : 0
      if (stacked) acc += L
      const pos = (horizontal ? m.t : m.l) + r * band + off + (stacked ? 0 : s * (barSize + groupGap))
      const rad = stacked ? (s === lastNZ ? barRadius : 0) : barRadius
      const k = colorByBar && S === 1 ? r % 4 : s % 4
      const b = horizontal
        ? { x: m.l + start, y: pos, w: L, h: barSize, rr: [0, rad, rad, 0] }
        : { x: pos, y: m.t + ph - start - L, w: barSize, h: L, rr: [rad, rad, 0, 0] }
      bars.push({ r, s, v, ip, k, ...b })
    })
  })

  const dimOf = (r, s) => (hov !== null && hov !== r ? 0.35 : 1) * (hovS !== null && hovS !== s ? 0.25 : 1)
  const rowTip = (e, r) => {
    if (!tooltip) return
    const row = rows[r]
    const list = row.v.map((v, s) => ({ color: pal[(colorByBar && S === 1 ? r : s) % 4], label: sName(s), value: pct ? `${fmt(v)} · ${Math.round(val(row, s))}%` : fmt(v) }))
    if (stacked) list.push({ label: 'Total', value: fmt(row.total), strong: true })
    setTip(tipAt(e, wrap, row.label, S === 1 && !colorByBar ? [{ color: color, label: sName(0), value: fmt(row.v[0]), strong: true }] : list))
  }

  const fill = (b) => (gradient ? `url(#${id}c${b.k})` : pal[b.k])
  const dimmed = (b) => highlightMax && S === 1 && b.r !== maxIdx

  return (
    <Card
      wrapRef={(el) => {
        wrap.current = el
        boxRef.current = el
      }}
      {...{ width, background, color, textColor, mutedColor, size, title, subtitle, tip }}
      legend={showLegend && S > 1 ? <Legend items={Array.from({ length: S }, (_, s) => ({ label: sName(s), color: pal[s % 4] }))} onHover={setHovS} mutedColor={mutedColor} /> : null}
    >
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${title}. ${horizontal ? 'Horizontal' : 'Vertical'} ${mode} bar chart. ${rows.map((r) => `${r.label}: ${r.v.map((v) => fmt(v)).join(', ')}`).join('; ')}`}
        style={{ display: 'block', maxWidth: '100%', overflow: 'visible' }}
        onMouseLeave={() => {
          setHov(null)
          setTip(null)
        }}
      >
        <defs>
          {pal.map((c, k) => (
            <linearGradient key={k} id={`${id}c${k}`} x1={horizontal ? 0 : 0} y1={horizontal ? 0 : 0} x2={horizontal ? 1 : 0} y2={horizontal ? 0 : 1}>
              <stop offset="0" stopColor={c} stopOpacity={horizontal ? 0.55 : 1} />
              <stop offset="1" stopColor={c} stopOpacity={horizontal ? 1 : 0.55} />
            </linearGradient>
          ))}
        </defs>

        {/* grid and axis */}
        {ticksOf(sc).map((t, i) => {
          const f = (t - sc.lo) / (sc.hi - sc.lo)
          const base = t === 0
          return horizontal ? (
            <g key={i}>
              {(showGrid || base) && <line x1={m.l + pw * f} x2={m.l + pw * f} y1={m.t} y2={m.t + ph} stroke={mutedColor} strokeOpacity={base ? 0.4 : 0.16} strokeDasharray={base ? undefined : '2 5'} />}
              {showAxis && (
                <text x={m.l + pw * f} y={m.t + ph + size * 1.4} textAnchor="middle" fontSize={size * 0.85} fill={mutedColor}>
                  {tickLabels[i]}
                </text>
              )}
            </g>
          ) : (
            <g key={i}>
              {(showGrid || base) && <line x1={m.l} x2={m.l + pw} y1={m.t + ph - ph * f} y2={m.t + ph - ph * f} stroke={mutedColor} strokeOpacity={base ? 0.4 : 0.16} strokeDasharray={base ? undefined : '2 5'} />}
              {showAxis && (
                <text x={m.l - 9} y={m.t + ph - ph * f} dy="0.34em" textAnchor="end" fontSize={size * 0.85} fill={mutedColor}>
                  {tickLabels[i]}
                </text>
              )}
            </g>
          )
        })}

        {/* category labels */}
        {rows.map((row, r) => {
          const c = (horizontal ? m.t : m.l) + r * band + band / 2
          const tooLong = !horizontal && row.label.length * charW > band - 4
          const label = row.label.length > 16 ? row.label.slice(0, 15) + '…' : row.label
          return horizontal ? (
            <text key={r} x={m.l - 10} y={c} dy="0.34em" textAnchor="end" fontSize={size} fill={hov === r ? textColor : mutedColor} style={{ transition: 'fill .2s' }}>
              {label}
            </text>
          ) : (
            <text key={r} x={c} y={m.t + ph + size * 1.5} textAnchor={tooLong ? 'end' : 'middle'} transform={tooLong ? `rotate(-35 ${c} ${m.t + ph + size * 1.5})` : undefined} fontSize={size} fill={hov === r ? textColor : mutedColor} style={{ transition: 'fill .2s' }}>
              {label}
            </text>
          )
        })}

        {/* bars */}
        {bars.map((b) => (
          <path
            key={`${b.r}-${b.s}`}
            d={rrect(b.x, b.y, b.w, b.h, b.rr)}
            fill={dimmed(b) ? mutedColor : fill(b)}
            opacity={dimmed(b) ? 0.3 * dimOf(b.r, b.s) : dimOf(b.r, b.s)}
            style={{ transition: 'opacity .2s', filter: glow && !dimmed(b) ? `drop-shadow(0 0 ${size * 0.6}px ${pal[b.k]}77)` : undefined }}
          />
        ))}

        {/* value labels */}
        {showValues &&
          bars.map((b) => {
            const text = fmt(pct ? (rows[b.r].v[b.s]) : b.v * b.ip)
            const est = text.length * charW * 0.9
            if (stacked) {
              const fits = horizontal ? b.w > est + 8 : b.h > size * 1.5 && b.w > est
              if (!fits || b.ip < 0.8) return null
              return (
                <text key={`v${b.r}-${b.s}`} x={b.x + b.w / 2} y={b.y + b.h / 2} dy="0.34em" textAnchor="middle" fontSize={size * 0.82} fontWeight="600" fill="#fff" fillOpacity={0.92 * dimOf(b.r, b.s)} style={{ pointerEvents: 'none' }}>
                  {pct ? `${Math.round(val(rows[b.r], b.s))}%` : text}
                </text>
              )
            }
            if (!horizontal && S > 1 && est > barSize + groupGap * 2 + 6) return null
            return horizontal ? (
              <text key={`v${b.r}-${b.s}`} x={b.x + b.w + 8} y={b.y + b.h / 2} dy="0.34em" fontSize={size * 0.92} fontWeight="600" fill={textColor} opacity={b.ip * dimOf(b.r, b.s)} style={{ pointerEvents: 'none', fontVariantNumeric: 'tabular-nums' }}>
                {text}
              </text>
            ) : (
              <text key={`v${b.r}-${b.s}`} x={b.x + b.w / 2} y={b.y - 7} textAnchor="middle" fontSize={size * 0.92} fontWeight="600" fill={textColor} opacity={b.ip * dimOf(b.r, b.s)} style={{ pointerEvents: 'none', fontVariantNumeric: 'tabular-nums' }}>
                {text}
              </text>
            )
          })}

        {/* totals on stacked bars */}
        {showValues &&
          stacked &&
          !pct &&
          rows.map((row, r) => {
            const ip = stag(p, r, n)
            const L = len(row.total) * ip
            return horizontal ? (
              <text key={`t${r}`} x={m.l + L + 8} y={m.t + r * band + band / 2} dy="0.34em" fontSize={size * 0.92} fontWeight="650" fill={textColor} opacity={ip * dimOf(r, hovS)} style={{ pointerEvents: 'none' }}>
                {fmt(row.total * ip)}
              </text>
            ) : (
              <text key={`t${r}`} x={m.l + r * band + band / 2} y={m.t + ph - L - 7} textAnchor="middle" fontSize={size * 0.92} fontWeight="650" fill={textColor} opacity={ip} style={{ pointerEvents: 'none' }}>
                {fmt(row.total * ip)}
              </text>
            )
          })}

        {/* hover bands */}
        {rows.map((_, r) => (
          <rect
            key={r}
            x={horizontal ? m.l : m.l + r * band}
            y={horizontal ? m.t + r * band : m.t}
            width={horizontal ? pw : band}
            height={horizontal ? band : ph}
            fill="transparent"
            onMouseEnter={(e) => {
              setHov(r)
              rowTip(e, r)
            }}
            onMouseMove={(e) => rowTip(e, r)}
          />
        ))}
      </svg>
    </Card>
  )
}
