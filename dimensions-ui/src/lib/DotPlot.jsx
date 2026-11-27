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

// Dot plot (Cleveland). One dot per value on a shared axis; give each row two
// values ("Berlin:62|78") and a connector links them, with an optional change chip
// that turns green or red. The axis can start at zero or zoom to the data.
export default function DotPlot({
  data = 'Berlin:62|78, Lisbon:48|71, Toronto:71|74, Austin:55|69, Osaka:80|77, Nairobi:34|58, Lima:41|52',
  series = '2022, 2024',
  title = 'Remote-work adoption',
  subtitle = 'Share of workforce, 2022 vs 2024',
  orientation = 'horizontal',
  sort = 'diff',
  width = 680,
  height = 300,
  zeroBased = false,
  connector = true,
  showGuides = true,
  showDiff = true,
  showValues = false,
  showGrid = true,
  showAxis = true,
  showLegend = true,
  dotSize = 7,
  connectorWidth = 3,
  ringed = false,
  tooltip = true,
  animate = true,
  duration = 1100,
  valueFormat = 'number',
  decimals = 0,
  prefix = '',
  suffix = '%',
  size = 13,
  color = '#8b8f98',
  color2 = '#d77757',
  color3 = '#b48ead',
  upColor = '#4eba65',
  downColor = '#e5534b',
  background = '#111214',
  textColor = '#ececec',
  mutedColor = '#8b8f98',
}) {
  const id = useId().replace(/:/g, '')
  const wrap = useRef(null)
  const [boxRef, boxW] = useWidth()
  const fmt = makeFmt({ valueFormat, decimals, prefix, suffix })
  const rows0 = useMemo(() => parseRows(data), [data])
  const S = Math.max(1, ...rows0.map((r) => r.values.length))
  const names = splitNames(series)
  const sName = (s) => names[s] ?? `Series ${s + 1}`
  const pal = [color, color2, color3]
  const rows = useMemo(() => {
    const r = rows0.map((x) => {
      const v = Array.from({ length: S }, (_, s) => x.values[s] ?? 0)
      return { label: x.label, v, diff: v[S - 1] - v[0] }
    })
    if (sort === 'label') r.sort((a, b) => a.label.localeCompare(b.label))
    else if (sort === 'first') r.sort((a, b) => b.v[0] - a.v[0])
    else if (sort === 'last') r.sort((a, b) => b.v[S - 1] - a.v[S - 1])
    else if (sort === 'diff') r.sort((a, b) => b.diff - a.diff)
    return r
  }, [rows0, S, sort])
  const p = useReveal(animate, duration, `${data}|${orientation}|${sort}|${zeroBased}`)
  const [hov, setHov] = useState(null)
  const [hovS, setHovS] = useState(null)
  const [tip, setTip] = useState(null)

  const horizontal = orientation === 'horizontal'
  const n = rows.length
  const all = rows.flatMap((r) => r.v)
  const lo0 = zeroBased ? 0 : Math.min(...all)
  const hi0 = Math.max(...all)
  const pad = zeroBased ? 0 : (hi0 - lo0) * 0.08
  const sc = niceRange(zeroBased ? 0 : lo0 - pad, hi0 + pad)
  const ticks = ticksOf(sc)
  const W = Math.max(240, (boxW || width) - size * 2.8)
  const H = height
  const maxLab = Math.min(18, Math.max(1, ...rows.map((r) => r.label.length)))
  const tl = ticks.map((t) => prefix + axisFmt.format(t) + suffix)
  const chip = showDiff && S > 1
  const m = horizontal
    ? { l: maxLab * size * 0.58 + 14, r: chip ? size * 4.6 : 18, t: 6, b: showAxis ? size * 2.1 : 8 }
    : { l: showAxis ? Math.max(...tl.map((s) => s.length)) * size * 0.58 + 14 : 8, r: 10, t: chip ? size * 2.6 : 12, b: size * 2.5 }
  const pw = Math.max(40, W - m.l - m.r)
  const ph = Math.max(40, H - m.t - m.b)
  const band = (horizontal ? ph : pw) / Math.max(1, n)
  const along = (v) => (horizontal ? pw : ph) * ((v - sc.lo) / (sc.hi - sc.lo))
  const X = (v) => m.l + along(v)
  const Y = (v) => m.t + ph - along(v)
  const dot = (v, i) => ({ cx: horizontal ? X(v) : m.l + i * band + band / 2, cy: horizontal ? m.t + i * band + band / 2 : Y(v) })
  const dim = (i) => (hov !== null && hov !== i ? 0.3 : 1)

  const showTip = (e, row) =>
    tooltip &&
    setTip(
      tipAt(e, wrap, row.label, [
        ...row.v.map((v, s) => ({ color: pal[s % 3], label: sName(s), value: fmt(v) })),
        ...(S > 1 ? [{ label: 'Change', value: `${row.diff >= 0 ? '+' : ''}${fmt(row.diff)}`, strong: true }] : []),
      ]),
    )

  return (
    <Card
      wrapRef={(el) => { wrap.current = el; boxRef.current = el }}
      {...{ width, background, color: color2, textColor, mutedColor, size, title, subtitle, tip }}
      legend={showLegend && S > 1 ? <Legend items={Array.from({ length: S }, (_, s) => ({ label: sName(s), color: pal[s % 3] }))} onHover={setHovS} mutedColor={mutedColor} /> : null}
    >
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${title}. Dot plot. ${rows.map((r) => `${r.label}: ${r.v.map((v, s) => `${sName(s)} ${fmt(v)}`).join(', ')}`).join('; ')}`}
        style={{ display: 'block', maxWidth: '100%', overflow: 'visible' }}
        onMouseLeave={() => { setHov(null); setTip(null) }}
      >
        <defs>
          {rows.map((r, i) => {
            const a = dot(r.v[0], i)
            const b = dot(r.v[S - 1], i)
            return (
              <linearGradient key={i} id={`${id}k${i}`} gradientUnits="userSpaceOnUse" x1={a.cx} y1={a.cy} x2={b.cx} y2={b.cy}>
                <stop offset="0" stopColor={pal[0]} />
                <stop offset="1" stopColor={pal[(S - 1) % 3]} />
              </linearGradient>
            )
          })}
        </defs>

        {ticks.map((t, i) =>
          horizontal ? (
            <g key={i}>
              {showGrid && <line x1={X(t)} x2={X(t)} y1={m.t} y2={m.t + ph} stroke={mutedColor} strokeOpacity="0.15" strokeDasharray="2 5" />}
              {showAxis && <text x={X(t)} y={m.t + ph + size * 1.4} textAnchor="middle" fontSize={size * 0.85} fill={mutedColor}>{tl[i]}</text>}
            </g>
          ) : (
            <g key={i}>
              {showGrid && <line x1={m.l} x2={m.l + pw} y1={Y(t)} y2={Y(t)} stroke={mutedColor} strokeOpacity="0.15" strokeDasharray="2 5" />}
              {showAxis && <text x={m.l - 9} y={Y(t)} dy="0.34em" textAnchor="end" fontSize={size * 0.85} fill={mutedColor}>{tl[i]}</text>}
            </g>
          ),
        )}

        {rows.map((row, i) => {
          const ip = stag(p, i, n)
          const first = dot(row.v[0], i)
          const mid = (horizontal ? m.t : m.l) + i * band + band / 2
          const shown = row.v.map((v) => row.v[0] + (v - row.v[0]) * ip)
          const last = dot(shown[S - 1], i)
          const label = row.label.length > 18 ? row.label.slice(0, 17) + '…' : row.label
          const up = row.diff >= 0
          const tight = !horizontal && row.label.length * size * 0.58 > band - 4
          return (
            <g key={i} opacity={dim(i)} style={{ transition: 'opacity .2s' }}>
              {showGuides && (horizontal ? <line x1={m.l} x2={m.l + pw} y1={mid} y2={mid} stroke={mutedColor} strokeOpacity="0.14" strokeDasharray="1 4" strokeLinecap="round" /> : <line x1={mid} x2={mid} y1={m.t} y2={m.t + ph} stroke={mutedColor} strokeOpacity="0.14" strokeDasharray="1 4" strokeLinecap="round" />)}
              {connector && S > 1 && <line x1={first.cx} y1={first.cy} x2={last.cx} y2={last.cy} stroke={`url(#${id}k${i})`} strokeWidth={connectorWidth} strokeLinecap="round" opacity="0.85" />}
              {shown.map((v, s) => {
                const d = dot(v, i)
                const c = pal[s % 3]
                const o = hovS !== null && hovS !== s ? 0.25 : 1
                return (
                  <g key={s} opacity={o} style={{ transition: 'opacity .2s' }}>
                    <circle cx={d.cx} cy={d.cy} r={dotSize * 2.2} fill={c} opacity="0.16" />
                    {ringed ? <circle cx={d.cx} cy={d.cy} r={dotSize * 0.85} fill={background} stroke={c} strokeWidth={Math.max(2, dotSize * 0.4)} /> : <circle cx={d.cx} cy={d.cy} r={dotSize} fill={c} stroke={background} strokeWidth="1.5" />}
                    {showValues && (
                      <text x={horizontal ? d.cx : d.cx} y={horizontal ? d.cy - dotSize - 6 : d.cy + (s === 0 && S > 1 ? dotSize + size : -dotSize - 6)} textAnchor="middle" fontSize={size * 0.8} fill={textColor} opacity={ip} style={{ pointerEvents: 'none', fontVariantNumeric: 'tabular-nums' }}>
                        {fmt(row.v[s])}
                      </text>
                    )}
                  </g>
                )
              })}
              {horizontal ? (
                <text x={m.l - 10} y={mid} dy="0.34em" textAnchor="end" fontSize={size} fill={hov === i ? textColor : mutedColor} style={{ transition: 'fill .2s' }}>{label}</text>
              ) : (
                <text x={mid} y={m.t + ph + size * 1.5} textAnchor={tight ? 'end' : 'middle'} transform={tight ? `rotate(-35 ${mid} ${m.t + ph + size * 1.5})` : undefined} fontSize={size} fill={hov === i ? textColor : mutedColor} style={{ transition: 'fill .2s' }}>{label}</text>
              )}
              {chip && (
                <g opacity={ip} style={{ pointerEvents: 'none' }}>
                  <text
                    x={horizontal ? m.l + pw + 12 : mid}
                    y={horizontal ? mid : m.t - size * 0.7}
                    dy={horizontal ? '0.34em' : 0}
                    textAnchor={horizontal ? 'start' : 'middle'}
                    fontSize={size * 0.9}
                    fontWeight="650"
                    fill={row.diff === 0 ? mutedColor : up ? upColor : downColor}
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    {up ? '▲' : '▼'} {fmt(Math.abs(row.diff))}
                  </text>
                </g>
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
            onMouseEnter={(e) => { setHov(i); showTip(e, row) }}
            onMouseMove={(e) => showTip(e, row)}
          />
        ))}
      </svg>
    </Card>
  )
}
