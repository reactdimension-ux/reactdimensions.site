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

// Share bar: each row is one bar split into its parts, so shares can be compared across
// rows (survey answers, budget splits). `diverging` centres the neutral middle answer on
// a zero line, with negatives to the left and positives to the right (a Likert chart).
// Rows are "Question:v|v|v|v|v" and `segments` names the parts in order.
export default function ShareBar({
  data = 'Onboarding was easy:4|9|14|41|32, Docs answer my questions:8|17|22|36|17, Pricing is clear:15|24|20|29|12, I would recommend it:3|6|11|38|42, Support is fast:6|12|25|35|22',
  segments = 'Strongly disagree, Disagree, Neutral, Agree, Strongly agree',
  title = 'Customer survey',
  subtitle = 'Share of 2,310 responses',
  mode = 'diverging',
  negLabel = 'Disagree',
  posLabel = 'Agree',
  sort = 'none',
  barHeight = 26,
  gap = 2,
  radius = 6,
  showLabels = true,
  showLegend = true,
  tooltip = true,
  animate = true,
  duration = 1200,
  decimals = 0,
  width = 720,
  size = 13,
  negColor = '#e5534b',
  posColor = '#4eba65',
  neutralColor = '#5d6068',
  color = '#d77757',
  color2 = '#5b9bd5',
  color3 = '#4eba65',
  color4 = '#b48ead',
  color5 = '#e0a030',
  background = '#111214',
  textColor = '#ececec',
  mutedColor = '#8b8f98',
}) {
  const wrap = useRef(null)
  const [boxRef, boxW] = useWidth()
  const segs = splitNames(segments)
  const rows0 = useMemo(() => parseRows(data), [data])
  const K = Math.max(1, segs.length, ...rows0.map((r) => r.values.length))
  const diverging = mode === 'diverging'
  const midIdx = (K - 1) / 2
  const rows = useMemo(() => {
    const r = rows0.map((x) => {
      const v = Array.from({ length: K }, (_, k) => Math.max(0, x.values[k] ?? 0))
      const t = v.reduce((a, b) => a + b, 0) || 1
      const pct = v.map((q) => (q / t) * 100)
      const pos = pct.reduce((a, q, k) => a + (k > midIdx ? q : 0), 0)
      return { label: x.label, v, pct, pos }
    })
    if (sort === 'positive') r.sort((a, b) => b.pos - a.pos)
    return r
  }, [rows0, K, sort, midIdx])
  // colours: a red-grey-green ramp for diverging, the palette otherwise
  const segColor = (k) => {
    if (!diverging) return paletteOf(K, [color, color2, color3, color4, color5])[k]
    if (Math.abs(k - midIdx) < 0.01) return neutralColor
    const t = Math.abs(k - midIdx) / Math.max(1, midIdx)
    return k < midIdx ? mix(neutralColor, negColor, 0.45 + 0.55 * t) : mix(neutralColor, posColor, 0.45 + 0.55 * t)
  }
  const p = useReveal(animate, duration, `${data}|${mode}|${sort}`)
  const [hov, setHov] = useState(null) // { r, k } or { k }
  const [tip, setTip] = useState(null)

  const W = Math.max(280, (boxW || width) - size * 2.8)
  const maxLab = Math.min(26, Math.max(1, ...rows.map((r) => r.label.length)))
  const labW = maxLab * size * 0.56 + 14
  const m = { l: labW, r: 8, t: diverging ? size * 1.4 : 4, b: 4 }
  const pw = Math.max(80, W - m.l - m.r)
  const bh = clamp(barHeight, 12, 60)
  const rowH = bh + size * 0.8
  const H = m.t + rows.length * rowH + m.b
  // diverging: left/right extents so the neutral middle sits on the zero line
  const extent = diverging
    ? Math.max(...rows.map((r) => {
        const left = r.pct.reduce((a, q, k) => a + (k < midIdx ? q : Math.abs(k - midIdx) < 0.01 ? q / 2 : 0), 0)
        const right = 100 - left
        return Math.max(left, right)
      }))
    : 100
  const zero = diverging ? m.l + pw / 2 : m.l
  const scale = diverging ? pw / 2 / extent : pw / 100
  const fmtP = (v) => `${v.toFixed(decimals)}%`

  return (
    <Card
      wrapRef={(el) => { wrap.current = el; boxRef.current = el }}
      {...{ width, background, color, textColor, mutedColor, size, title, subtitle, tip }}
      legend={showLegend ? <Legend items={Array.from({ length: K }, (_, k) => ({ label: segs[k] ?? `Part ${k + 1}`, color: segColor(k) }))} onHover={(k) => setHov(k == null ? null : { k })} mutedColor={mutedColor} /> : null}
    >
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${title}. ${diverging ? 'Diverging' : 'Stacked'} share bars. ${rows.map((r) => `${r.label}: ${r.pct.map((q, k) => `${segs[k] ?? `part ${k + 1}`} ${fmtP(q)}`).join(', ')}`).join('; ')}`}
        style={{ display: 'block', maxWidth: '100%', overflow: 'visible' }}
        onMouseLeave={() => { setHov(null); setTip(null) }}
      >
        {diverging && (
          <g style={{ pointerEvents: 'none' }}>
            <line x1={zero} x2={zero} y1={m.t - 4} y2={H - m.b} stroke={textColor} strokeOpacity="0.35" />
            <text x={zero - 8} y={m.t - size * 0.55} textAnchor="end" fontSize={size * 0.76} fill={negColor}>{`◀ ${negLabel}`}</text>
            <text x={zero + 8} y={m.t - size * 0.55} fontSize={size * 0.76} fill={posColor}>{`${posLabel} ▶`}</text>
          </g>
        )}
        {rows.map((r, ri) => {
          const ip = stag(p, ri, rows.length)
          const y = m.t + ri * rowH + (rowH - bh) / 2
          // where the bar starts: for diverging, shift left by everything below the middle
          const leftShare = diverging ? r.pct.reduce((a, q, k) => a + (k < midIdx ? q : Math.abs(k - midIdx) < 0.01 ? q / 2 : 0), 0) : 0
          let x = zero - leftShare * scale * ip
          const segsOut = r.pct.map((q, k) => {
            const w = q * scale * ip
            const s = { k, x, w, q }
            x += w
            return s
          })
          const firstK = segsOut.findIndex((s) => s.q > 0)
          const lastK = segsOut.length - 1 - [...segsOut].reverse().findIndex((s) => s.q > 0)
          return (
            <g key={ri}>
              <text x={m.l - 10} y={y + bh / 2} dy="0.34em" textAnchor="end" fontSize={size * 0.9} fill={hov && hov.r === ri ? textColor : mutedColor}>{r.label.length > 26 ? r.label.slice(0, 25) + '…' : r.label}</text>
              {segsOut.map((s) => {
                if (s.q <= 0) return null
                const c = segColor(s.k)
                const on = !hov || (hov.r == null ? hov.k === s.k : hov.r === ri && hov.k === s.k)
                const rr = [s.k === firstK ? radius : 0, s.k === lastK ? radius : 0, s.k === lastK ? radius : 0, s.k === firstK ? radius : 0]
                return (
                  <g
                    key={s.k}
                    opacity={on ? 1 : 0.35}
                    style={{ transition: 'opacity .2s' }}
                    onMouseEnter={(e) => { setHov({ r: ri, k: s.k }); tooltip && setTip(tipAt(e, wrap, r.label, [{ color: c, label: segs[s.k] ?? `Part ${s.k + 1}`, value: fmtP(s.q), strong: true }, { label: 'Responses', value: String(r.v[s.k]) }, ...(diverging ? [{ label: 'All positive', value: fmtP(r.pos) }] : [])])) }}
                    onMouseMove={(e) => tooltip && setTip((t) => (t ? { ...t, ...tipAt(e, wrap, t.title, t.rows) } : t))}
                  >
                    <path d={rrect(s.x + gap / 2, y, Math.max(0, s.w - gap), bh, rr)} fill={c} />
                    {showLabels && s.w > size * 2.6 && ip > 0.8 && (
                      <text x={s.x + s.w / 2} y={y + bh / 2} dy="0.34em" textAnchor="middle" fontSize={Math.min(size * 0.8, bh * 0.5)} fontWeight="700" fill={inkOn(c)} style={{ pointerEvents: 'none' }}>{fmtP(s.q)}</text>
                    )}
                  </g>
                )
              })}
            </g>
          )
        })}
      </svg>
    </Card>
  )
}
