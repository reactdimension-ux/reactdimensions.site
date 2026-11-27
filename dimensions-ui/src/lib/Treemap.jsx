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

// Treemap: nested rectangles whose area matches their value. Entries are
// "Group/Item:value"; each group gets a colour and a header strip, and smaller items are
// shaded lighter. Click a group to zoom into it and the breadcrumb to come back out.
// Squarified tiles keep rectangles close to square; slice-and-dice keeps order.
export default function Treemap({
  data = 'Compute/Virtual machines:420, Compute/Containers:260, Compute/Functions:90, Storage/Object storage:310, Storage/Block storage:150, Storage/Backups:70, Database/Postgres:240, Database/Redis:80, Database/Search:60, Network/CDN:130, Network/Load balancers:55, Network/DNS:12, AI/GPU hours:360, AI/Inference API:140',
  rootName = 'All services',
  title = 'Cloud spend by service',
  subtitle = 'USD thousands, last quarter. Click a group to zoom in',
  tile = 'squarify',
  padding = 3,
  groupGap = 6,
  radius = 6,
  showHeaders = true,
  showValues = true,
  showPercent = true,
  shadeByValue = true,
  zoomable = true,
  tooltip = true,
  animate = true,
  duration = 1100,
  valueFormat = 'number',
  decimals = 0,
  prefix = '$',
  suffix = 'k',
  width = 720,
  height = 320,
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
  const root = useMemo(() => parseTree(data, rootName), [data, rootName])
  const [focusPath, setFocusPath] = useState(null)
  const focus = useMemo(() => {
    if (!focusPath) return root
    const find = (n) => (n.path === focusPath ? n : n.children.map(find).find(Boolean))
    return find(root) ?? root
  }, [root, focusPath])
  const cols = paletteOf(Math.max(6, root.children.length), [color, color2, color3, color4, color5, color6])
  const p = useReveal(animate, duration, `${data}|${tile}|${focusPath}`)
  const [hov, setHov] = useState(null)
  const [tip, setTip] = useState(null)

  const W = Math.max(260, (boxW || width) - size * 2.8)
  const crumbH = size * 1.9
  const H = height
  const ph = H - crumbH

  // squarified layout (Bruls et al.): fill rows while they make tiles squarer
  const squarify = (items, x, y, w, h) => {
    const out = []
    const total = items.reduce((a, n) => a + n.value, 0) || 1
    const area = items.map((n) => ({ n, a: (n.value / total) * w * h }))
    let row = []
    const worst = (r, side) => {
      const s = r.reduce((a, q) => a + q.a, 0)
      const mx = Math.max(...r.map((q) => q.a))
      const mn = Math.min(...r.map((q) => q.a))
      return Math.max((side * side * mx) / (s * s), (s * s) / (side * side * mn))
    }
    const place = (r) => {
      const s = r.reduce((a, q) => a + q.a, 0)
      if (w >= h) {
        const cw = s / h
        let yy = y
        r.forEach((q) => { const ch = q.a / cw; out.push({ n: q.n, x, y: yy, w: cw, h: ch }); yy += ch })
        x += cw
        w -= cw
      } else {
        const rh = s / w
        let xx = x
        r.forEach((q) => { const cw = q.a / rh; out.push({ n: q.n, x: xx, y, w: cw, h: rh }); xx += cw })
        y += rh
        h -= rh
      }
    }
    area.forEach((q) => {
      const side = Math.min(w, h)
      if (!row.length || worst([...row, q], side) <= worst(row, side)) row.push(q)
      else {
        place(row)
        row = [q]
      }
    })
    if (row.length) place(row)
    return out
  }
  const slice = (items, x, y, w, h, horiz) => {
    const total = items.reduce((a, n) => a + n.value, 0) || 1
    let o = 0
    return items.map((n) => {
      const f = n.value / total
      const r = horiz ? { n, x: x + o * w, y, w: f * w, h } : { n, x, y: y + o * h, w, h: f * h }
      o += f
      return r
    })
  }
  const layout = (items, x, y, w, h, depth) => (tile === 'slice-dice' ? slice(items, x, y, w, h, depth % 2 === 0) : squarify(items, x, y, w, h))

  const groups = focus.children.length ? focus.children : [focus]
  const outer = layout(groups, 0, crumbH, W, ph, 0)
  const tiles = []
  outer.forEach((g, gi) => {
    const hdr = showHeaders && g.n.children.length && g.h > size * 3 ? size * 1.6 : 0
    const gx = g.x + groupGap / 2
    const gy = g.y + groupGap / 2
    const gw = Math.max(0, g.w - groupGap)
    const gh = Math.max(0, g.h - groupGap)
    const kids = g.n.children.length ? layout(g.n.children, gx, gy + hdr, gw, Math.max(0, gh - hdr), 1) : [{ n: g.n, x: gx, y: gy, w: gw, h: gh }]
    const mx = Math.max(...kids.map((k) => k.n.value))
    const mn = Math.min(...kids.map((k) => k.n.value))
    tiles.push({ group: true, n: g.n, x: gx, y: gy, w: gw, h: gh, hdr, gi })
    kids.forEach((k, ki) => tiles.push({ ...k, gi, ki, shade: mx === mn ? 0 : 1 - (k.n.value - mn) / (mx - mn) }))
  })
  const colorOf = (t) => {
    const base = cols[(focus === root ? t.gi : focus.branch) % cols.length]
    return shadeByValue ? mix(base, background, (t.shade ?? 0) * 0.45) : base
  }
  const crumbs = []
  for (let n = focus; n; n = n.parent) crumbs.unshift(n)

  return (
    <Card wrapRef={(el) => { wrap.current = el; boxRef.current = el }} {...{ width, background, color, textColor, mutedColor, size, title, subtitle, tip }}>
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${title}. Treemap of ${focus.name}: ${groups.map((g) => `${g.name} ${fmt(g.value)}`).join(', ')}.`}
        style={{ display: 'block', maxWidth: '100%', overflow: 'visible' }}
        onMouseLeave={() => { setHov(null); setTip(null) }}
      >
        {/* breadcrumb */}
        <g style={{ cursor: 'pointer' }}>
          {crumbs.map((c, i) => {
            const x = crumbs.slice(0, i).reduce((a, q) => a + q.name.length * size * 0.56 + size * 1.6, 0)
            return (
              <text key={c.path} x={x} y={size} fontSize={size * 0.85} fontWeight={i === crumbs.length - 1 ? 700 : 500} fill={i === crumbs.length - 1 ? textColor : mutedColor} onClick={() => setFocusPath(c === root ? null : c.path)}>
                {c.name}
                {i < crumbs.length - 1 && <tspan fill={mutedColor}>{'  ›'}</tspan>}
              </text>
            )
          })}
          <text x={W} y={size} textAnchor="end" fontSize={size * 0.85} fontWeight="650" fill={textColor}>{fmt(focus.value)}</text>
        </g>

        {tiles.map((t, k) => {
          const ip = ease(clamp((p - (t.gi / Math.max(1, outer.length)) * 0.4 - (t.ki ?? 0) * 0.02) / 0.5, 0, 1))
          const cx = t.x + t.w / 2
          const cy = t.y + t.h / 2
          const sc = 0.6 + 0.4 * ip
          if (t.group) {
            return (
              <g key={`g${k}`} opacity={ip} style={{ cursor: zoomable && t.n.children.length ? 'zoom-in' : 'default' }} onClick={() => zoomable && t.n.children.length && setFocusPath(t.n.path)}>
                <rect x={t.x} y={t.y} width={t.w} height={t.h} rx={radius + 2} fill={cols[(focus === root ? t.gi : focus.branch) % cols.length]} fillOpacity="0.1" stroke={cols[(focus === root ? t.gi : focus.branch) % cols.length]} strokeOpacity={hov && hov.gi === t.gi ? 0.8 : 0.25} />
                {t.hdr > 0 && (
                  <text x={t.x + 8} y={t.y + t.hdr * 0.62} fontSize={size * 0.8} fontWeight="700" letterSpacing="0.04em" fill={cols[(focus === root ? t.gi : focus.branch) % cols.length]} style={{ pointerEvents: 'none' }}>
                    {t.w > size * 6 ? `${t.n.name.toUpperCase()}${t.w > size * 12 ? `  ${fmt(t.n.value)}` : ''}` : ''}
                  </text>
                )}
              </g>
            )
          }
          const w = Math.max(0, t.w - padding)
          const h = Math.max(0, t.h - padding)
          const c = colorOf(t)
          const pct = (t.n.value / (focus.value || 1)) * 100
          const fits = w > size * 4 && h > size * 2.3
          const on = !hov || hov.path === t.n.path
          return (
            <g
              key={t.n.path}
              transform={`translate(${cx},${cy}) scale(${sc}) translate(${-cx},${-cy})`}
              opacity={ip * (on ? 1 : 0.55)}
              style={{ transition: 'opacity .2s', cursor: zoomable && t.n.children.length ? 'zoom-in' : 'default' }}
              onClick={() => zoomable && t.n.children.length && setFocusPath(t.n.path)}
              onMouseEnter={(e) => { setHov({ path: t.n.path, gi: t.gi }); tooltip && setTip(tipAt(e, wrap, t.n.name, [{ color: c, label: 'Value', value: fmt(t.n.value), strong: true }, { label: `Of ${focus.name}`, value: `${pct.toFixed(1)}%` }, ...(t.n.parent && t.n.parent !== focus ? [{ label: `Of ${t.n.parent.name}`, value: `${((t.n.value / t.n.parent.value) * 100).toFixed(1)}%` }] : [])])) }}
              onMouseMove={(e) => tooltip && setTip((tp) => (tp ? { ...tp, ...tipAt(e, wrap, tp.title, tp.rows) } : tp))}
            >
              <rect x={t.x + padding / 2} y={t.y + padding / 2} width={w} height={h} rx={Math.min(radius, w / 3, h / 3)} fill={c} stroke={hov && hov.path === t.n.path ? textColor : 'none'} strokeWidth="1.6" style={{ filter: hov && hov.path === t.n.path ? `drop-shadow(0 0 ${size * 0.7}px ${c})` : undefined }} />
              {fits && (
                <g style={{ pointerEvents: 'none' }}>
                  <text x={t.x + padding / 2 + 8} y={t.y + padding / 2 + size * 1.3} fontSize={size * 0.86} fontWeight="650" fill={inkOn(c)}>{t.n.name.length * size * 0.52 > w - 14 ? t.n.name.slice(0, Math.max(3, Math.floor((w - 14) / (size * 0.52)) - 1)) + '…' : t.n.name}</text>
                  {showValues && h > size * 3.6 && (
                    <text x={t.x + padding / 2 + 8} y={t.y + padding / 2 + size * 2.6} fontSize={size * 0.8} fill={inkOn(c)} fillOpacity="0.8">
                      {fmt(t.n.value)}
                      {showPercent && w > size * 7 && <tspan fillOpacity="0.75">{`  ${pct.toFixed(1)}%`}</tspan>}
                    </text>
                  )}
                </g>
              )}
            </g>
          )
        })}
      </svg>
    </Card>
  )
}
