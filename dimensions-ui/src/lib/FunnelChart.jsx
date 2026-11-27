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

// ---- flow helpers ----
function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const inkOn = (c) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16) / 255)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.55 ? '#0b0b0d' : '#ffffff'
}
// n colours: the given ones first, then blends between them
function paletteOf(n, base) {
  return Array.from({ length: n }, (_, i) => (i < base.length ? base[i] : mix(base[i % base.length], base[(i + 1) % base.length], 0.5)))
}
// "A>B:120, B>C:80" -> [{ s: 'A', t: 'B', v: 120 }]
function parseLinks(data, sep = '>') {
  return String(data ?? '')
    .split(/[,\n;]/)
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => {
      const k = x.lastIndexOf(':')
      const pair = (k < 0 ? x : x.slice(0, k)).split(sep).map((s) => s.trim())
      return { path: pair.filter(Boolean), v: k < 0 ? 1 : num(x.slice(k + 1)) }
    })
    .filter((l) => l.path.length >= 2 && l.v > 0)
}
const ribbon = (x0, y0, x1, y1, w) => {
  const xm = (x0 + x1) / 2
  return `M${x0},${y0}C${xm},${y0} ${xm},${y1} ${x1},${y1}L${x1},${y1 + w}C${xm},${y1 + w} ${xm},${y0 + w} ${x0},${y0 + w}Z`
}

// Sankey-style layout. nodes: [{ layer? }], links: [{ s, t, v }] by node index.
function sankeyLayout({ nodes, links, W, H, nodeWidth, pad, iterations = 6, fixedLayers = false, keepOrder = false, align = 'justify' }) {
  const N = nodes.map((n, i) => ({ ...n, i, ins: [], outs: [], vin: 0, vout: 0 }))
  const L = links.map((l, k) => ({ ...l, k }))
  L.forEach((l) => {
    N[l.s].outs.push(l)
    N[l.t].ins.push(l)
    N[l.s].vout += l.v
    N[l.t].vin += l.v
  })
  N.forEach((n) => (n.value = Math.max(n.vin, n.vout)))
  if (!fixedLayers) {
    N.forEach((n) => (n.layer = 0))
    for (let it = 0; it < N.length; it++) {
      let moved = false
      L.forEach((l) => {
        if (N[l.t].layer < N[l.s].layer + 1) {
          N[l.t].layer = N[l.s].layer + 1
          moved = true
        }
      })
      if (!moved) break
    }
    const maxL = Math.max(0, ...N.map((n) => n.layer))
    if (align === 'justify') N.forEach((n) => { if (!n.outs.length) n.layer = maxL })
  }
  const maxL = Math.max(1, ...N.map((n) => n.layer))
  const cols = Array.from({ length: maxL + 1 }, () => [])
  N.forEach((n) => cols[n.layer].push(n))
  const ky = Math.min(...cols.filter((c) => c.length).map((c) => (H - (c.length - 1) * pad) / Math.max(1e-9, c.reduce((a, n) => a + n.value, 0))))
  N.forEach((n) => {
    n.x0 = (n.layer / maxL) * (W - nodeWidth)
    n.x1 = n.x0 + nodeWidth
    n.h = Math.max(1, n.value * ky)
  })
  const stack = (c) => {
    let y = 0
    c.forEach((n) => {
      n.y0 = y
      y += n.h + pad
    })
  }
  cols.forEach(stack)
  const resolve = (c) => {
    c.sort((a, b) => a.y0 - b.y0)
    let y = 0
    c.forEach((n) => {
      if (n.y0 < y) n.y0 = y
      y = n.y0 + n.h + pad
    })
    let over = y - pad - H
    for (let i = c.length - 1; i >= 0 && over > 0; i--) {
      const n = c[i]
      const lim = i === c.length - 1 ? H - n.h : c[i + 1].y0 - pad - n.h
      if (n.y0 > lim) n.y0 = lim
    }
    if (c[0] && c[0].y0 < 0) {
      let yy = 0
      c.forEach((n) => { n.y0 = Math.max(n.y0, yy); yy = n.y0 + n.h + pad })
    }
  }
  if (!keepOrder) {
    const center = (n) => n.y0 + n.h / 2
    for (let it = 0; it < iterations; it++) {
      const a = 0.9 ** it
      cols.forEach((c) => {
        c.forEach((n) => {
          if (!n.ins.length) return
          const w = n.ins.reduce((s, l) => s + l.v, 0)
          const y = n.ins.reduce((s, l) => s + center(N[l.s]) * l.v, 0) / w
          n.y0 += (y - center(n)) * a
        })
        resolve(c)
      })
      ;[...cols].reverse().forEach((c) => {
        c.forEach((n) => {
          if (!n.outs.length) return
          const w = n.outs.reduce((s, l) => s + l.v, 0)
          const y = n.outs.reduce((s, l) => s + center(N[l.t]) * l.v, 0) / w
          n.y0 += (y - center(n)) * a
        })
        resolve(c)
      })
    }
  }
  N.forEach((n) => (n.y1 = n.y0 + n.h))
  N.forEach((n) => {
    let y = n.y0
    ;[...n.outs].sort((a, b) => N[a.t].y0 - N[b.t].y0 || (a.order ?? 0) - (b.order ?? 0)).forEach((l) => {
      l.w = l.v * ky
      l.sy = y
      y += l.w
    })
    y = n.y0
    ;[...n.ins].sort((a, b) => N[a.s].y0 - N[b.s].y0 || (a.order ?? 0) - (b.order ?? 0)).forEach((l) => {
      l.ty = y
      y += l.v * ky
    })
  })
  return { nodes: N, links: L, ky }
}
// ---- end flow helpers ----

// Funnel chart: stages narrowing as people drop out. `shape` draws a smooth funnel,
// stepped trapezoids or left-aligned bars; between stages a chip shows the step
// conversion, and each stage can show its share of the first. Colours ramp from the
// top stage to the bottom. Stages are "Stage:value".
export default function FunnelChart({
  data = 'Visited site:12400, Viewed pricing:6800, Started signup:3900, Created account:2700, Started trial:1500, Became customer:610',
  title = 'Signup funnel',
  subtitle = 'Last 30 days',
  shape = 'smooth',
  showConversion = true,
  showOverall = true,
  showValues = true,
  stageGap = 6,
  neck = 0.18,
  colorMode = 'ramp',
  tooltip = true,
  animate = true,
  duration = 1300,
  valueFormat = 'compact',
  decimals = 1,
  prefix = '',
  suffix = '',
  width = 680,
  height = 330,
  size = 13,
  color = '#d77757',
  color2 = '#5b9bd5',
  color3 = '#4eba65',
  color4 = '#b48ead',
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
  const rows = useMemo(() => parseRows(data).map((r) => ({ label: r.label, v: Math.max(0, r.values[0] ?? 0) })), [data])
  const n = rows.length
  const top = Math.max(1, ...rows.map((r) => r.v))
  const p = useReveal(animate, duration, `${data}|${shape}`)
  const [hov, setHov] = useState(null)
  const [tip, setTip] = useState(null)

  const W = Math.max(280, (boxW || width) - size * 2.8)
  const H = height
  const bars = shape === 'bars'
  const maxLab = Math.min(18, Math.max(1, ...rows.map((r) => r.label.length)))
  const labW = maxLab * size * 0.58 + 16
  const sideW = showConversion ? size * 5.4 : 8
  const m = bars ? { l: labW, r: sideW + size * 4, t: 4, b: 4 } : { l: labW, r: sideW, t: 4, b: 4 }
  const pw = Math.max(80, W - m.l - m.r)
  const ph = Math.max(60, H - m.t - m.b)
  const band = ph / Math.max(1, n)
  const g = Math.min(stageGap, band * 0.4)
  const colorOf = (i) => (colorMode === 'ramp' ? mix(color, color2, n > 1 ? i / (n - 1) : 0) : colorMode === 'palette' ? [color, color2, color3, color4][i % 4] : color)
  const widthOf = (v) => Math.max(pw * neck * (shape === 'smooth' ? 1 : 0.4), (v / top) * pw)
  const cx = m.l + pw / 2

  const tipFor = (e, i) => tooltip && setTip(tipAt(e, wrap, rows[i].label, [
    { color: colorOf(i), label: 'Count', value: fmt(rows[i].v), strong: true },
    ...(i > 0 ? [{ label: 'From previous', value: `${((rows[i].v / (rows[i - 1].v || 1)) * 100).toFixed(1)}%` }] : []),
    { label: 'Of first stage', value: `${((rows[i].v / (rows[0].v || 1)) * 100).toFixed(1)}%` },
  ]))

  return (
    <Card wrapRef={(el) => { wrap.current = el; boxRef.current = el }} {...{ width, background, color, textColor, mutedColor, size, title, subtitle, tip }}>
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${title}. Funnel. ${rows.map((r, i) => `${r.label}: ${fmt(r.v)}${i ? `, ${Math.round((r.v / (rows[i - 1].v || 1)) * 100)} percent of previous` : ''}`).join('; ')}`}
        style={{ display: 'block', maxWidth: '100%', overflow: 'visible' }}
        onMouseLeave={() => { setHov(null); setTip(null) }}
      >
        <defs>
          {rows.map((_, i) => (
            <linearGradient key={i} id={`${id}f${i}`} x1="0" y1="0" x2={bars ? 1 : 0} y2={bars ? 0 : 1}>
              <stop offset="0" stopColor={mix(colorOf(i), '#ffffff', 0.12)} />
              <stop offset="1" stopColor={colorOf(i)} stopOpacity="0.8" />
            </linearGradient>
          ))}
        </defs>

        {rows.map((r, i) => {
          const ip = stag(p, i, n)
          const y0 = m.t + i * band + g / 2
          const y1 = m.t + (i + 1) * band - g / 2
          const w0 = widthOf(r.v) * ip
          const next = rows[i + 1]
          const w1 = (shape === 'smooth' && next ? widthOf(next.v) : widthOf(r.v)) * ip
          let d
          if (bars) d = rrect(m.l, y0, Math.max(2, (r.v / top) * pw * ip), y1 - y0, [6, 6, 6, 6])
          else if (shape === 'smooth') {
            const ym = (y0 + y1) / 2
            d = `M${cx - w0 / 2},${y0}L${cx + w0 / 2},${y0}C${cx + w0 / 2},${ym} ${cx + w1 / 2},${ym} ${cx + w1 / 2},${y1}L${cx - w1 / 2},${y1}C${cx - w1 / 2},${ym} ${cx - w0 / 2},${ym} ${cx - w0 / 2},${y0}Z`
          } else {
            const wb = (next ? widthOf(next.v) : widthOf(r.v) * 0.85) * ip
            d = `M${cx - w0 / 2},${y0}L${cx + w0 / 2},${y0}L${cx + Math.max(wb, w0 * 0.6) / 2},${y1}L${cx - Math.max(wb, w0 * 0.6) / 2},${y1}Z`
          }
          const on = hov == null || hov === i
          const conv = i > 0 ? r.v / (rows[i - 1].v || 1) : null
          const textX = bars ? m.l + Math.max(2, (r.v / top) * pw * ip) + 10 : cx
          const inside = !bars
          return (
            <g key={i} opacity={on ? 1 : 0.4} style={{ transition: 'opacity .2s' }} onMouseEnter={(e) => { setHov(i); tipFor(e, i) }} onMouseMove={(e) => tipFor(e, i)}>
              <path d={d} fill={`url(#${id}f${i})`} style={{ filter: hov === i ? `drop-shadow(0 0 ${size}px ${colorOf(i)}aa)` : `drop-shadow(0 ${size * 0.3}px ${size * 0.6}px #0007)` }} />
              <text x={m.l - 12} y={(y0 + y1) / 2} dy="0.34em" textAnchor="end" fontSize={size} fill={hov === i ? textColor : mutedColor} style={{ transition: 'fill .2s' }}>{r.label.length > 18 ? r.label.slice(0, 17) + '…' : r.label}</text>
              {showValues && (
                <text x={textX} y={(y0 + y1) / 2} dy="0.34em" textAnchor={inside ? 'middle' : 'start'} fontSize={size * 0.95} fontWeight="700" fill={inside ? '#fff' : textColor} opacity={ip} style={{ pointerEvents: 'none', textShadow: inside ? '0 1px 3px #0008' : undefined }}>
                  {fmt(r.v * ip)}
                  {showOverall && i > 0 && <tspan fontWeight="500" fillOpacity="0.75" fontSize={size * 0.8}>{`  ${((r.v / (rows[0].v || 1)) * 100).toFixed(1)}%`}</tspan>}
                </text>
              )}
              {showConversion && conv != null && (
                <g opacity={ip} style={{ pointerEvents: 'none' }}>
                  <rect x={W - sideW + 4} y={y0 - g / 2 - size * 0.8} width={sideW - 6} height={size * 1.6} rx={size * 0.8} fill={mix(background, conv >= 0.5 ? upColor : downColor, 0.18)} stroke={conv >= 0.5 ? upColor : downColor} strokeOpacity="0.45" />
                  <text x={W - sideW / 2 + 1} y={y0 - g / 2} dy="0.34em" textAnchor="middle" fontSize={size * 0.78} fontWeight="700" fill={conv >= 0.5 ? upColor : downColor}>{`↓ ${(conv * 100).toFixed(0)}%`}</text>
                </g>
              )}
            </g>
          )
        })}
      </svg>
    </Card>
  )
}
