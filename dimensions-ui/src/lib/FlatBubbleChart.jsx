import { useEffect, useId, useMemo, useRef, useState } from 'react'

// ---- flat infographic helpers (kept inline so this file copies out on its own) ----
// Data is a plain string: rows are separated by commas, each row is "Label:value",
// e.g. "Jan:42, Feb:58". An array of { label, value } works too.

const FONT = '"Poppins", "Nunito", ui-rounded, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif'
const num = (v) => {
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : 0
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
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
// blend two #rrggbb colours
function mix(a, b, t) {
  const h = (c) => [1, 3, 5].map((i) => parseInt(String(c).slice(i, i + 2), 16) || 0)
  const [A, B] = [h(a), h(b)]
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('')
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

function Legend({ items, mutedColor, onHover }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4em 1.2em', marginBottom: '0.7em', color: mutedColor, fontSize: '0.88em', fontWeight: 600 }}>
      {items.map((it, i) => (
        <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45em', cursor: 'default' }} onMouseEnter={() => onHover?.(i)} onMouseLeave={() => onHover?.(-1)}>
          <i style={{ width: '0.75em', height: '0.75em', borderRadius: '50%', background: it.color, flex: 'none' }} />
          {it.name}
        </span>
      ))}
    </div>
  )
}
// white or dark ink, whichever reads better on a filled colour
function inkOn(c, dark) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(String(c).slice(i, i + 2), 16) || 0)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.66 ? dark : '#ffffff'
}

// ---- relationship helpers ----
// Points are "Label:x|y|size|group" (size and group optional; group is 1 to 6), e.g.
// "Atlas:42|61|30|1, Boreal:55|48|12|2". Leave `data` empty for a seeded demo set.
function parseRows(data) {
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
const axisFmt = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })
const fmtTickLabel = (v) => (Math.abs(v) >= 1000 ? axisFmt.format(v) : String(+v.toFixed(Math.abs(v) < 10 ? 2 : Math.abs(v) < 100 ? 1 : 0)))
function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const gauss = (r) => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r())
const NAMES = ['Atlas', 'Boreal', 'Cinder', 'Delta', 'Ember', 'Fjord', 'Glint', 'Harbor', 'Iris', 'Jade', 'Kite', 'Lumen', 'Moss', 'Nova', 'Onyx', 'Pearl', 'Quartz', 'River', 'Sable', 'Tidal', 'Umber', 'Vale', 'Wren', 'Xenon', 'Yarrow', 'Zephyr']
const nameOf = (i) => NAMES[i % NAMES.length] + (i >= NAMES.length ? ` ${Math.floor(i / NAMES.length) + 1}` : '')
function synthPoints({ count, correlation, groups, seed, noise }) {
  const r = rng(Math.round(seed) * 97 + 1)
  const G = clamp(Math.round(groups), 1, 4)
  const cx = [38, 58, 46, 68]
  const cy = [42, 58, 72, 46]
  const rho = clamp(correlation, -0.99, 0.99)
  return Array.from({ length: Math.round(count) }, (_, i) => {
    const g = i % G
    const zx = gauss(r)
    const zy = rho * zx + Math.sqrt(1 - rho * rho) * gauss(r) * noise
    return {
      label: nameOf(i),
      x: +(cx[g] + zx * 12).toFixed(2),
      y: +(cy[g] + zy * 12).toFixed(2),
      size: +(14 + r() * 80 * (1 + 0.45 * zx)).toFixed(1),
      g,
    }
  })
}
function parsePoints(data) {
  if (Array.isArray(data)) return data.map((d, i) => ({ label: String(d.label ?? nameOf(i)), x: num(d.x), y: num(d.y), size: d.size == null ? 1 : num(d.size), g: Math.max(0, num(d.g ?? d.group ?? 1) - 1) }))
  const rows = parseRows(data)
  if (!rows.length || !String(data ?? '').trim()) return null
  return rows.map((r, i) => ({ label: r.label || nameOf(i), x: r.values[0] ?? 0, y: r.values[1] ?? 0, size: r.values[2] ?? 1, g: Math.max(0, Math.round(r.values[3] ?? 1) - 1) }))
}
function usePoints({ data, count, correlation, groups, seed, noise }) {
  return useMemo(() => parsePoints(data) ?? synthPoints({ count, correlation, groups, seed, noise }), [data, count, correlation, groups, seed, noise])
}
function makeFmt({ decimals = 0, prefix = '', suffix = '' }) {
  const d = Math.max(0, Math.min(6, Math.round(decimals)))
  const nf = new Intl.NumberFormat('en', { minimumFractionDigits: d, maximumFractionDigits: d })
  return (v) => `${prefix}${nf.format(v)}${suffix}`
}
// ---- end relationship helpers ----

// Flat infographic bubble chart: a scatter where each dot's area carries a third number.
// Bubbles are solid flat discs with a white rim and a striped band across the bottom,
// labelled inside when big enough. In `axes` mode bubbles sit at (x, y); in `packed` mode
// they cluster together by size with no axes. Bubbles pop in with a springy bounce.
// Points are "Label:x|y|size|group", or leave `data` empty for the demo set.
export default function FlatBubbleChart({
  data = '',
  count = 18,
  correlation = 0.5,
  groups = 3,
  noise = 1.1,
  seed = 3,
  names = 'North, Central, South',
  title = 'Market overview',
  subtitle = 'Position: price vs rating. Size: monthly sales',
  mode = 'axes',
  sizeBy = 'area',
  minR = 8,
  maxR = 30,
  colorBy = 'group',
  labels = 'auto',
  showValues = true,
  showSizeKey = true,
  showQuadrants = false,
  fillOpacity = 1,
  stripes = true,
  stripeWidth = 5,
  xLabel = 'Price index',
  yLabel = 'Rating',
  showGrid = true,
  showAxis = true,
  axisArrows = true,
  showLegend = true,
  tooltip = true,
  animate = true,
  duration = 1200,
  decimals = 0,
  prefix = '',
  suffix = '',
  width = 680,
  height = 340,
  size = 13,
  color = '#4a7fe8',
  color2 = '#ef5b7f',
  color3 = '#14a89e',
  color4 = '#f08a24',
  color5 = '#8e5fd6',
  color6 = '#c49a12',
  background = '#ffffff',
  gridColor = '#eef0f6',
  textColor = '#2b2f3a',
  mutedColor = '#8a90a0',
}) {
  const uid = useId().replace(/:/g, '')
  const wrap = useRef(null)
  const [boxRef, boxW] = useWidth()
  const fmt = makeFmt({ decimals, prefix, suffix })
  const pal = [color, color2, color3, color4, color5, color6]
  const pts = usePoints({ data, count, correlation, groups, seed, noise })
  const G = Math.max(1, ...pts.map((q) => q.g + 1))
  const nm = splitNames(names)
  const gName = (g) => nm[g] ?? (G > 1 ? `Group ${g + 1}` : 'All')
  const packed = mode === 'packed'
  const p = useReveal(animate, duration, `${data}|${count}|${correlation}|${groups}|${noise}|${seed}|${mode}|${sizeBy}|${minR}|${maxR}`)
  const [hov, setHov] = useState(-1)
  const [hovG, setHovG] = useState(-1)
  const [tip, setTip] = useState(null)

  const sMin = Math.min(...pts.map((q) => q.size))
  const sMax = Math.max(...pts.map((q) => q.size))
  const tOf = (v) => (sMax === sMin ? 0.5 : (v - sMin) / (sMax - sMin))
  const lo = Math.max(1, Math.min(minR, maxR))
  const hi = Math.max(lo, maxR)
  const radius = (v) => (sizeBy === 'radius' ? lo + (hi - lo) * tOf(v) : Math.sqrt(lo * lo + (hi * hi - lo * lo) * tOf(v)))

  const W = Math.max(260, (boxW || width) - size * 3)
  const H = height
  const xs = pts.length ? pts.map((q) => q.x) : [0, 1]
  const ys = pts.length ? pts.map((q) => q.y) : [0, 1]
  const xr = Math.max(...xs) - Math.min(...xs)
  const yr = Math.max(...ys) - Math.min(...ys)
  const padX = xr * 0.06 + (hi / W) * xr * 1.2
  const padY = yr * 0.08 + (hi / H) * yr * 1.2
  const sx = niceRange(Math.min(...xs) - padX, Math.max(...xs) + padX, 6)
  const sy = niceRange(Math.min(...ys) - padY, Math.max(...ys) + padY, 5)
  const xt = ticksOf(sx)
  const yt = ticksOf(sy)
  const m = packed
    ? { l: 8, r: 8, t: 8, b: 8 }
    : {
        l: (showAxis ? Math.max(...yt.map((v) => fmtTickLabel(v).length)) * size * 0.56 + 14 : 8) + (yLabel ? size * 1.5 : 0),
        r: showAxis && axisArrows ? size * 1.4 : 10,
        t: showAxis && axisArrows ? size * 1.3 : 8,
        b: (showAxis ? size * 2.1 : 8) + (xLabel ? size * 1.5 : 0),
      }
  const pw = Math.max(60, W - m.l - m.r)
  const ph = Math.max(60, H - m.t - m.b)
  const X = (v) => m.l + ((v - sx.lo) / (sx.hi - sx.lo)) * pw
  const Y = (v) => m.t + ph - ((v - sy.lo) / (sy.hi - sy.lo)) * ph

  // packed layout: biggest first, each placed along a spiral until it clears the others
  const layout = useMemo(() => {
    if (!packed || !pts.length) return null
    const order = pts.map((_, i) => i).sort((a, b) => pts[b].size - pts[a].size)
    const placed = []
    const out = new Array(pts.length)
    for (const i of order) {
      const r = radius(pts[i].size)
      let a = 0
      let pos = [0, 0]
      if (placed.length) {
        for (let k = 0; k < 4000; k++) {
          a += 0.5
          const d = 1.5 + k * 0.045
          pos = [Math.cos(a) * d, Math.sin(a) * d * 0.75]
          if (placed.every((q) => Math.hypot(q.x - pos[0], q.y - pos[1]) >= q.r + r + 3)) break
        }
      }
      placed.push({ x: pos[0], y: pos[1], r })
      out[i] = { x: pos[0], y: pos[1], r }
    }
    const minX = Math.min(...out.map((o) => o.x - o.r))
    const maxX = Math.max(...out.map((o) => o.x + o.r))
    const minY = Math.min(...out.map((o) => o.y - o.r))
    const maxY = Math.max(...out.map((o) => o.y + o.r))
    return { out, minX, maxX, minY, maxY }
  }, [packed, pts, sizeBy, minR, maxR]) // eslint-disable-line react-hooks/exhaustive-deps
  const fit = layout ? Math.min((W - 16) / (layout.maxX - layout.minX), (H - 16) / (layout.maxY - layout.minY), 1.6) : 1
  const place = (i) => {
    if (!layout) return { x: X(pts[i].x), y: Y(pts[i].y), r: radius(pts[i].size) }
    const o = layout.out[i]
    return { x: W / 2 + (o.x - (layout.minX + layout.maxX) / 2) * fit, y: H / 2 + (o.y - (layout.minY + layout.maxY) / 2) * fit, r: o.r * fit }
  }
  const colorOf = (q) => (colorBy === 'value' ? mix(mix(background, color, 0.35), color, tOf(q.size)) : pal[q.g % pal.length])
  const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length
  const order = pts.map((_, i) => i).sort((a, b) => pts[b].size - pts[a].size) // small on top
  const dimOf = (q, i) => (hovG >= 0 && hovG !== q.g ? 0.4 : 1) * (hov >= 0 && hov !== i ? 0.4 : 1)
  const sizeKey = [sMin, (sMin + sMax) / 2, sMax]
  const keyR = (v) => Math.max(4, radius(v) * (packed ? fit : 1) * 0.42)

  const showTip = (e, i) => {
    setHov(i)
    if (!tooltip) return
    const q = pts[i]
    setTip(tipAt(e, wrap, q.label, [{ color: colorOf(q), label: 'Size', value: fmt(q.size) }, ...(packed ? [] : [{ label: xLabel || 'x', value: fmtTickLabel(q.x) }, { label: yLabel || 'y', value: fmtTickLabel(q.y) }]), ...(G > 1 ? [{ label: 'Group', value: gName(q.g) }] : [])]))
  }
  const legendOn = showLegend && G > 1 && colorBy === 'group'

  return (
    <Card wrapRef={(el) => { wrap.current = el; boxRef.current = el }} {...{ width, background, textColor, mutedColor, size, title, subtitle, tip }}>
      {(legendOn || showSizeKey) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5em 1.2em', flexWrap: 'wrap', marginBottom: '0.7em' }}>
          {legendOn ? (
            <div style={{ marginBottom: '-0.7em' }}>
              <Legend items={Array.from({ length: G }, (_, g) => ({ name: gName(g), color: pal[g % pal.length] }))} mutedColor={mutedColor} onHover={setHovG} />
            </div>
          ) : (
            <span />
          )}
          {showSizeKey && pts.length > 0 && (() => {
            const rs = sizeKey.map(keyR)
            const kh = rs[2] * 2 + size * 1.1
            let x = 2
            const pos = rs.map((r) => {
              const cx = x + r
              x += r * 2 + size * 1.4
              return cx
            })
            return (
              <svg width={x} height={kh} style={{ display: 'block', overflow: 'visible' }} aria-hidden="true">
                {sizeKey.map((v, k) => (
                  <g key={k}>
                    <circle cx={pos[k]} cy={rs[2] * 2 - rs[k]} r={rs[k]} fill={gridColor} stroke={mutedColor} strokeWidth="1.5" />
                    <text x={pos[k]} y={kh} textAnchor="middle" fontSize={size * 0.72} fontWeight="600" fill={mutedColor} style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(v)}</text>
                  </g>
                ))}
              </svg>
            )
          })()}
        </div>
      )}
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${title}. Bubble chart of ${pts.length} items. ${pts.slice(0, 12).map((q) => `${q.label}: size ${fmt(q.size)}`).join('; ')}`}
        style={{ display: 'block', maxWidth: '100%', overflow: 'visible' }}
        onMouseLeave={() => { setHov(-1); setTip(null) }}
      >
        <defs>
          <pattern id={`st${uid}`} width={stripeWidth * 2} height={stripeWidth * 2} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width={stripeWidth} height={stripeWidth * 2} fill="#ffffff" opacity="0.35" />
          </pattern>
          <marker id={`ar${uid}`} viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,1 L9,5 L0,9 Z" fill={mutedColor} />
          </marker>
        </defs>

        {!packed && (
          <>
            {yt.map((v, i) => (
              <g key={`y${i}`}>
                {showGrid && v !== sy.lo && <line x1={m.l} x2={m.l + pw} y1={Y(v)} y2={Y(v)} stroke={gridColor} strokeWidth="2" strokeDasharray="5 7" strokeLinecap="round" />}
                {showAxis && <text x={m.l - 10} y={Y(v)} dy="0.35em" textAnchor="end" fontSize={size * 0.82} fill={mutedColor} style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtTickLabel(v)}</text>}
              </g>
            ))}
            {xt.map((v, i) => (
              <g key={`x${i}`}>
                {showGrid && v !== sx.lo && <line x1={X(v)} x2={X(v)} y1={m.t} y2={m.t + ph} stroke={gridColor} strokeWidth="2" strokeDasharray="5 7" strokeLinecap="round" />}
                {showAxis && <text x={X(v)} y={m.t + ph + size * 1.5} textAnchor="middle" fontSize={size * 0.82} fill={mutedColor} style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtTickLabel(v)}</text>}
              </g>
            ))}
            {xLabel && <text x={m.l + pw / 2} y={H - 2} textAnchor="middle" fontSize={size * 0.9} fill={mutedColor} fontWeight="600">{xLabel}</text>}
            {yLabel && <text transform={`translate(${size * 0.9},${m.t + ph / 2}) rotate(-90)`} textAnchor="middle" fontSize={size * 0.9} fill={mutedColor} fontWeight="600">{yLabel}</text>}
            {showQuadrants && pts.length > 0 && (
              <g style={{ pointerEvents: 'none' }} opacity={clamp((p - 0.5) * 2, 0, 1)} stroke={mutedColor} strokeWidth="2" strokeDasharray="7 6" strokeLinecap="round">
                <line x1={X(mean(xs))} x2={X(mean(xs))} y1={m.t} y2={m.t + ph} />
                <line x1={m.l} x2={m.l + pw} y1={Y(mean(ys))} y2={Y(mean(ys))} />
              </g>
            )}
            {showAxis && (
              <g stroke={mutedColor} strokeWidth="2" strokeLinecap="round" fill="none" style={{ pointerEvents: 'none' }}>
                <path d={`M${m.l},${m.t + ph}H${m.l + pw + (axisArrows ? m.r * 0.6 : 0)}`} markerEnd={axisArrows ? `url(#ar${uid})` : undefined} />
                <path d={`M${m.l},${m.t + ph}V${m.t - (axisArrows ? m.t * 0.6 : 0)}`} markerEnd={axisArrows ? `url(#ar${uid})` : undefined} />
              </g>
            )}
          </>
        )}

        {order.map((i) => {
          const q = pts[i]
          const o = place(i)
          const k = pop(clamp((p - (pts.length > 1 ? i / (pts.length - 1) : 0) * 0.45) / 0.55, 0, 1))
          if (k <= 0) return null
          const r = Math.max(0, o.r * k * (i === hov ? 1.08 : 1))
          const c = colorOf(q)
          const ink = inkOn(c, textColor)
          const lab = q.label.length > 12 ? q.label.slice(0, 11) + '…' : q.label
          const fs = Math.min(size, r * 0.42)
          // a label only shows when no smaller bubble (drawn on top) sits over its centre
          const clear = () => order.slice(order.indexOf(i) + 1).every((j) => { const b = place(j); return Math.hypot(b.x - o.x, b.y - o.y) > b.r + fs * 0.9 })
          const inside = (labels === 'all' ? r > size * 0.9 : labels === 'auto' ? r > Math.max(size * 1.7, lab.length * fs * 0.32 + 6) : false) && clear()
          const two = inside && showValues && r > size * 2.1
          const band = stripes && r > size * 1.2
          return (
            <g key={i} opacity={dimOf(q, i)} style={{ transition: 'opacity .2s' }}>
              <circle cx={o.x} cy={o.y} r={r} fill={c} fillOpacity={fillOpacity} stroke={background} strokeWidth={2.5} />
              {band && (
                <>
                  <clipPath id={`c${uid}${i}`}><circle cx={o.x} cy={o.y} r={Math.max(0, r - 1.25)} /></clipPath>
                  <g clipPath={`url(#c${uid}${i})`} style={{ pointerEvents: 'none' }}>
                    <rect x={o.x - r} y={o.y + r * 0.45} width={r * 2} height={r} fill={mix(c, '#000000', 0.12)} fillOpacity={fillOpacity} />
                    <rect x={o.x - r} y={o.y + r * 0.45} width={r * 2} height={r} fill={`url(#st${uid})`} />
                  </g>
                </>
              )}
              {inside && p > 0.5 && (
                <text x={o.x} y={two ? o.y - fs * 0.58 : o.y} dy="0.35em" textAnchor="middle" fontSize={fs} fontWeight="700" fill={ink} style={{ pointerEvents: 'none' }}>
                  {lab}
                  {two && (
                    <tspan x={o.x} dy="1.15em" fontWeight="600" opacity="0.85" style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(q.size)}</tspan>
                  )}
                </text>
              )}
              <circle cx={o.x} cy={o.y} r={Math.max(r, 8)} fill="transparent" onMouseEnter={(e) => showTip(e, i)} onMouseMove={(e) => showTip(e, i)} />
            </g>
          )
        })}
      </svg>
    </Card>
  )
}
