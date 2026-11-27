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

// ---- parts-of-a-whole helpers ----
function paletteOf(n, base) {
  return Array.from({ length: n }, (_, i) => (i < base.length ? base[i] : mix(base[i % base.length], base[(i + 1) % base.length], 0.5)))
}
const inkOn = (c) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16) / 255)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.6 ? '#0b0b0d' : '#ffffff'
}
// an annular sector from angle a0 to a1 (radians, 0 = 12 o'clock, clockwise)
function arcPath(a0, a1, r0, r1) {
  const p = (a, r) => [Math.sin(a) * r, -Math.cos(a) * r]
  const large = a1 - a0 > Math.PI ? 1 : 0
  if (a1 - a0 >= Math.PI * 2 - 1e-6) a1 = a0 + Math.PI * 2 - 1e-4
  const [x0, y0] = p(a0, r1)
  const [x1, y1] = p(a1, r1)
  if (r0 <= 0) return `M0,0L${x0},${y0}A${r1},${r1} 0 ${large} 1 ${x1},${y1}Z`
  const [x2, y2] = p(a1, r0)
  const [x3, y3] = p(a0, r0)
  return `M${x0},${y0}A${r1},${r1} 0 ${large} 1 ${x1},${y1}L${x2},${y2}A${r0},${r0} 0 ${large} 0 ${x3},${y3}Z`
}
// "Group/Item:value, ..." -> a tree with summed values
function parseTree(data, rootName = 'All') {
  const root = { name: rootName, children: [], value: 0, depth: 0, path: rootName }
  String(data ?? '')
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((entry) => {
      const k = entry.lastIndexOf(':')
      const parts = (k < 0 ? entry : entry.slice(0, k)).split('/').map((s) => s.trim()).filter(Boolean)
      const v = k < 0 ? 1 : Math.max(0, num(entry.slice(k + 1)))
      let cur = root
      parts.forEach((name, d) => {
        let c = cur.children.find((x) => x.name === name)
        if (!c) {
          c = { name, children: [], value: 0, depth: d + 1, parent: cur, path: `${cur.path}/${name}` }
          cur.children.push(c)
        }
        cur = c
      })
      cur.own = (cur.own ?? 0) + v
    })
  const sum = (n) => (n.value = (n.own ?? 0) + n.children.reduce((a, c) => a + sum(c), 0))
  sum(root)
  const tag = (n, b) => {
    n.branch = b
    n.children.sort((a, c) => c.value - a.value)
    n.children.forEach((c, i) => tag(c, n.depth === 0 ? i : b))
  }
  tag(root, 0)
  return root
}
// ---- end parts helpers ----

// Pie / donut chart: shares of a whole. Set `innerRadius` to 0 for a pie or raise it
// for a donut with the total (or the hovered slice) in the middle. Slices sweep in,
// lift out on hover, and label themselves inside or outside with leader lines. Small
// slices can fold into "Other", and `sweep` 180 makes a half donut.
export default function PieChart({
  data = 'Direct:38, Organic search:27, Social:14, Email:9, Referral:7, Paid:5',
  title = 'Where sign-ups come from',
  subtitle = 'Share of 12,480 sign-ups this quarter',
  innerRadius = 0.62,
  sweep = 360,
  startAngle = 0,
  padAngle = 1.2,
  sort = true,
  maxSlices = 8,
  otherLabel = 'Other',
  labels = 'outside',
  showPercent = true,
  centerLabel = 'Total',
  showLegend = true,
  hoverLift = 8,
  tooltip = true,
  animate = true,
  duration = 1200,
  valueFormat = 'number',
  decimals = 0,
  prefix = '',
  suffix = '%',
  width = 600,
  height = 300,
  size = 13,
  color = '#d77757',
  color2 = '#5b9bd5',
  color3 = '#4eba65',
  color4 = '#b48ead',
  color5 = '#e0a030',
  color6 = '#56b6c2',
  background = '#111214',
  textColor = '#ececec',
  mutedColor = '#8b8f98',
}) {
  const wrap = useRef(null)
  const [boxRef, boxW] = useWidth()
  const fmt = makeFmt({ valueFormat, decimals, prefix, suffix })
  const slices = useMemo(() => {
    let r = parseRows(data).map((x) => ({ label: x.label, v: Math.max(0, x.values[0] ?? 0) })).filter((x) => x.v > 0)
    if (sort) r.sort((a, b) => b.v - a.v)
    const k = Math.max(2, Math.round(maxSlices))
    if (r.length > k) {
      const rest = r.slice(k - 1).reduce((a, x) => a + x.v, 0)
      r = [...r.slice(0, k - 1), { label: otherLabel, v: rest, other: true }]
    }
    return r
  }, [data, sort, maxSlices, otherLabel])
  const total = slices.reduce((a, s) => a + s.v, 0) || 1
  const cols = paletteOf(slices.length, [color, color2, color3, color4, color5, color6]).map((c, i) => (slices[i]?.other ? mutedColor : c))
  const p = useReveal(animate, duration, `${data}|${sweep}|${innerRadius}|${sort}`)
  const [hov, setHov] = useState(-1)
  const [tip, setTip] = useState(null)

  const half = sweep < 360
  const W = Math.max(260, (boxW || width) - size * 2.8)
  const legendW = showLegend && W > 460 ? Math.min(220, W * 0.38) : 0
  const plotW = W - legendW
  const H = height
  const outside = labels === 'outside'
  const R = Math.max(40, Math.min(plotW / 2 - (outside ? size * 4.2 : 8), (half ? H - size * 2 : H / 2) - (outside ? size * 1.8 : 8)))
  const r0 = R * clamp(innerRadius, 0, 0.92)
  const cx = plotW / 2
  const cy = half ? H - size * 1.2 : H / 2
  const span = (clamp(sweep, 90, 360) * Math.PI) / 180
  const a00 = ((half ? -90 : 0) + startAngle) * (Math.PI / 180)
  const pad = (padAngle * Math.PI) / 180
  const reveal = ease(p)

  let acc = 0
  const arcs = slices.map((s, i) => {
    const a0 = a00 + (acc / total) * span * reveal
    acc += s.v
    const a1 = a00 + (acc / total) * span * reveal
    return { ...s, i, a0, a1, mid: (a0 + a1) / 2 }
  })
  const pt = (a, r) => [Math.sin(a) * r, -Math.cos(a) * r]
  const focus = hov >= 0 ? slices[hov] : null

  // outside labels: push apart vertically on each side
  const lab = arcs.map((a) => {
    const [x, y] = pt(a.mid, R + size * 0.9)
    return { i: a.i, side: Math.sin(a.mid) >= 0 ? 1 : -1, x, y }
  })
  ;[1, -1].forEach((side) => {
    const L = lab.filter((l) => l.side === side).sort((a, b) => a.y - b.y)
    for (let k = 1; k < L.length; k++) if (L[k].y - L[k - 1].y < size * 1.2) L[k].y = L[k - 1].y + size * 1.2
  })

  return (
    <Card wrapRef={(el) => { wrap.current = el; boxRef.current = el }} {...{ width, background, color, textColor, mutedColor, size, title, subtitle, tip }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <svg
          width={plotW}
          height={H}
          viewBox={`0 0 ${plotW} ${H}`}
          role="img"
          aria-label={`${title}. ${innerRadius > 0 ? 'Donut' : 'Pie'} chart. ${slices.map((s) => `${s.label}: ${((s.v / total) * 100).toFixed(1)} percent`).join('; ')}`}
          style={{ display: 'block', overflow: 'visible', flex: 'none' }}
          onMouseLeave={() => { setHov(-1); setTip(null) }}
        >
          <g transform={`translate(${cx},${cy})`}>
            {arcs.map((a) => {
              const lift = a.i === hov ? hoverLift : 0
              const [dx, dy] = pt(a.mid, lift)
              const c = cols[a.i]
              return (
                <g key={a.i} transform={`translate(${dx},${dy})`} style={{ transition: 'transform .2s' }} opacity={hov >= 0 && hov !== a.i ? 0.45 : 1}>
                  <path
                    d={arcPath(a.a0 + pad / 2, Math.max(a.a0 + pad / 2 + 1e-4, a.a1 - pad / 2), r0, R)}
                    fill={c}
                    style={{ filter: a.i === hov ? `drop-shadow(0 0 ${size}px ${c}aa)` : `drop-shadow(0 ${size * 0.25}px ${size * 0.5}px #0006)`, transition: 'opacity .2s' }}
                    onMouseEnter={(e) => { setHov(a.i); tooltip && setTip(tipAt(e, wrap, a.label, [{ color: c, label: 'Share', value: `${((a.v / total) * 100).toFixed(1)}%`, strong: true }, { label: 'Value', value: fmt(a.v) }])) }}
                    onMouseMove={(e) => tooltip && setTip((t) => (t ? { ...t, ...tipAt(e, wrap, t.title, t.rows) } : t))}
                  />
                  {labels === 'inside' && a.a1 - a.a0 > 0.28 && (() => {
                    const [lx, ly] = pt(a.mid, (r0 + R) / 2)
                    return <text x={lx} y={ly} dy="0.34em" textAnchor="middle" fontSize={size * 0.85} fontWeight="700" fill={inkOn(c)} style={{ pointerEvents: 'none' }}>{showPercent ? `${Math.round((a.v / total) * 100)}%` : fmt(a.v)}</text>
                  })()}
                </g>
              )
            })}
            {outside && p > 0.95 && arcs.map((a) => {
              const l = lab[a.i]
              const [ex, ey] = pt(a.mid, R + 3)
              const tx = l.side * (R + size * 2.2)
              return (
                <g key={`l${a.i}`} opacity={hov >= 0 && hov !== a.i ? 0.35 : 1} style={{ pointerEvents: 'none' }}>
                  <path d={`M${ex},${ey}L${l.x},${l.y}L${tx},${l.y}`} fill="none" stroke={cols[a.i]} strokeOpacity="0.7" />
                  <text x={tx + l.side * 4} y={l.y} dy="0.34em" textAnchor={l.side > 0 ? 'start' : 'end'} fontSize={size * 0.82} fill={textColor}>
                    <tspan fontWeight="700">{showPercent ? `${Math.round((a.v / total) * 100)}%` : fmt(a.v)}</tspan>
                  </text>
                </g>
              )
            })}
            {r0 > size * 2.5 && (
              <g style={{ pointerEvents: 'none' }} transform={half ? `translate(0,${-r0 * 0.35})` : undefined}>
                <text textAnchor="middle" dy="-0.2em" fontSize={Math.min(size * 2, r0 * 0.42)} fontWeight="750" fill={focus ? cols[hov] : textColor} style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {focus ? `${((focus.v / total) * 100).toFixed(1)}%` : fmt(total * reveal)}
                </text>
                <text textAnchor="middle" dy="1.3em" fontSize={size * 0.85} fill={mutedColor}>{focus ? focus.label : centerLabel}</text>
              </g>
            )}
          </g>
        </svg>
        {legendW > 0 && (
          <div role="list" style={{ width: legendW, display: 'grid', gap: '0.35em', paddingLeft: '0.6em' }}>
            {slices.map((s, i) => (
              <div key={i} role="listitem" onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(-1)} style={{ display: 'grid', gridTemplateColumns: '0.75em 1fr auto', alignItems: 'center', gap: '0.6em', fontSize: '0.9em', opacity: hov >= 0 && hov !== i ? 0.45 : 1, transition: 'opacity .2s', cursor: 'default' }}>
                <i style={{ width: '0.75em', height: '0.75em', borderRadius: 4, background: cols[i], boxShadow: `0 0 0.7em ${cols[i]}66` }} />
                <span style={{ color: hov === i ? textColor : mutedColor, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.label}</span>
                <span style={{ fontWeight: 650, fontVariantNumeric: 'tabular-nums' }}>{showPercent ? `${((s.v / total) * 100).toFixed(1)}%` : fmt(s.v)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  )
}
