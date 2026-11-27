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

// Waffle chart: a grid of cells (10 x 10 by default, so one cell is 1%) filled in by
// category. Friendlier than a pie for a single share. Cells can be squares, circles or
// little people, fill row by row or column by column, and pop in one after another.
// Entries are "Label:value"; with one entry the rest of the grid stays empty.
export default function WaffleChart({
  data = 'Remote:46, Hybrid:31, In office:23',
  title = 'How the team works',
  subtitle = 'Share of 1,240 employees',
  rows = 10,
  cols = 10,
  shape = 'square',
  fillOrder = 'rows',
  gap = 3,
  radius = 3,
  showLegend = true,
  showBig = true,
  emptyColor = '#2a2c31',
  tooltip = true,
  animate = true,
  duration = 1400,
  decimals = 0,
  suffix = '%',
  width = 600,
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
  const items = useMemo(() => parseRows(data).map((r) => ({ label: r.label, v: Math.max(0, r.values[0] ?? 0) })), [data])
  const R = clamp(Math.round(rows), 2, 30)
  const C = clamp(Math.round(cols), 2, 30)
  const N = R * C
  const single = items.length === 1
  const total = single ? 100 : items.reduce((a, i) => a + i.v, 0) || 1
  const pal = paletteOf(items.length, [color, color2, color3, color4, color5, color6])
  // whole cells per item, rounding by largest remainder so they add up exactly
  const counts = useMemo(() => {
    const raw = items.map((it) => (it.v / total) * N)
    const base = raw.map(Math.floor)
    let left = (single ? Math.round(raw[0]) : N) - base.reduce((a, b) => a + b, 0)
    raw.map((r, i) => [r - Math.floor(r), i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (left > 0) { base[i]++; left-- } })
    return base
  }, [items, total, N, single])
  const owner = []
  counts.forEach((c, i) => { for (let k = 0; k < c; k++) owner.push(i) })
  const p = useReveal(animate, duration, `${data}|${rows}|${cols}|${fillOrder}`)
  const [hov, setHov] = useState(-1)
  const [tip, setTip] = useState(null)

  const W = Math.max(240, (boxW || width) - size * 2.8)
  const side = showLegend && W > 420 ? Math.min(230, W * 0.42) : 0
  const gridW = Math.min(W - side - 10, 360)
  const cell = (gridW - gap * (C - 1)) / C
  const gridH = cell * R + gap * (R - 1)
  const pos = (k) => (fillOrder === 'columns' ? [Math.floor(k / R), R - 1 - (k % R)] : [k % C, Math.floor(k / C)])
  const person = (x, y, s, fill) => (
    <g transform={`translate(${x},${y}) scale(${s / 24})`}>
      <circle cx="12" cy="6" r="4.2" fill={fill} />
      <path d="M4.5 22v-4.5c0-3.6 3.3-6.3 7.5-6.3s7.5 2.7 7.5 6.3V22z" fill={fill} />
    </g>
  )
  const pctOf = (i) => (single ? items[0].v : (items[i].v / total) * 100)
  const fmtP = (v) => `${v.toFixed(decimals)}${suffix}`
  const focus = hov >= 0 ? hov : 0

  return (
    <Card wrapRef={(el) => { wrap.current = el; boxRef.current = el }} {...{ width, background, color, textColor, mutedColor, size, title, subtitle, tip }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.4em', flexWrap: 'wrap' }}>
        <svg
          width={gridW}
          height={gridH}
          viewBox={`0 0 ${gridW} ${gridH}`}
          role="img"
          aria-label={`${title}. Waffle chart of ${N} cells. ${items.map((it, i) => `${it.label}: ${fmtP(pctOf(i))}`).join('; ')}`}
          style={{ display: 'block', overflow: 'visible', flex: 'none' }}
          onMouseLeave={() => { setHov(-1); setTip(null) }}
        >
          {Array.from({ length: N }, (_, k) => {
            const [cx, cy] = pos(k)
            const x = cx * (cell + gap)
            const y = cy * (cell + gap)
            const o = owner[k]
            const filled = o != null
            const ip = ease(clamp((p - (k / N) * 0.75) / 0.25, 0, 1))
            const c = filled ? pal[o] : emptyColor
            const dim = hov >= 0 && o !== hov ? 0.3 : 1
            const s = cell * (filled ? 0.35 + 0.65 * ip : 1)
            const off = (cell - s) / 2
            const fillC = filled && ip > 0 ? c : emptyColor
            return (
              <g
                key={k}
                opacity={dim}
                style={{ transition: 'opacity .2s' }}
                onMouseEnter={(e) => { if (o == null) return; setHov(o); tooltip && setTip(tipAt(e, wrap, items[o].label, [{ color: pal[o], label: 'Share', value: fmtP(pctOf(o)), strong: true }, { label: 'Cells', value: `${counts[o]} of ${N}` }])) }}
                onMouseMove={(e) => tooltip && o != null && setTip((t) => (t ? { ...t, ...tipAt(e, wrap, t.title, t.rows) } : t))}
              >
                {shape === 'person' ? (
                  person(x + off, y + off, s, fillC)
                ) : shape === 'circle' ? (
                  <circle cx={x + cell / 2} cy={y + cell / 2} r={s / 2} fill={fillC} />
                ) : (
                  <rect x={x + off} y={y + off} width={s} height={s} rx={Math.min(radius, s / 2)} fill={fillC} style={{ filter: filled && hov === o ? `drop-shadow(0 0 ${cell * 0.3}px ${c})` : undefined }} />
                )}
              </g>
            )
          })}
        </svg>
        <div style={{ flex: 1, minWidth: '9em' }}>
          {showBig && items.length > 0 && (
            <div style={{ marginBottom: '0.8em' }}>
              <div style={{ fontSize: '2.6em', fontWeight: 800, lineHeight: 1, color: pal[focus], letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{fmtP(pctOf(focus) * ease(p))}</div>
              <div style={{ color: mutedColor, marginTop: '0.3em' }}>{items[focus].label}</div>
            </div>
          )}
          {showLegend && !single && (
            <div role="list" style={{ display: 'grid', gap: '0.4em' }}>
              {items.map((it, i) => (
                <div key={i} role="listitem" onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(-1)} style={{ display: 'grid', gridTemplateColumns: '0.75em 1fr auto', gap: '0.6em', alignItems: 'center', fontSize: '0.92em', opacity: hov >= 0 && hov !== i ? 0.45 : 1, transition: 'opacity .2s' }}>
                  <i style={{ width: '0.75em', height: '0.75em', borderRadius: 3, background: pal[i] }} />
                  <span style={{ color: hov === i ? textColor : mutedColor }}>{it.label}</span>
                  <span style={{ fontWeight: 650, fontVariantNumeric: 'tabular-nums' }}>{fmtP(pctOf(i))}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
