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

// white or dark ink, whichever reads better on a filled colour
function inkOn(c, dark) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(String(c).slice(i, i + 2), 16) || 0)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.66 ? dark : '#ffffff'
}

// ---- axis helpers ----
// Rows are "Name:v|v|v", one value per dimension.
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
// ---- end axis helpers ----

// Flat infographic parallel coordinates: one chunky rounded track per measure and one
// thick rounded line per item, coloured along one measure (color2 = low, color = high).
// Measure names sit in flat pills; the colour measure's pill is filled. Drag up or down on
// any track to filter to a range (a striped flat band); click a track to clear it.
// Rows are "Name:v|v|v" with `dimensions` naming the axes, or leave `data` empty for a
// seeded demo of cars.
export default function FlatParallelCoordinates({
  data = '',
  dimensions = 'Price, Power, Weight, Efficiency, Range, Rating',
  count = 60,
  seed = 9,
  title = 'Electric car models',
  subtitle = 'Drag on any axis to filter',
  colorBy = 'Range',
  curved = true,
  lineOpacity = 0.75,
  strokeWidth = 2.4,
  trackWidth = 10,
  brushable = true,
  stripes = true,
  stripeWidth = 4,
  showTicks = true,
  tooltip = true,
  animate = true,
  duration = 1400,
  decimals = 1,
  width = 760,
  height = 320,
  size = 13,
  color = '#4a7fe8',
  color2 = '#ef5b7f',
  background = '#ffffff',
  trackColor = '#eef0f6',
  textColor = '#2b2f3a',
  mutedColor = '#8a90a0',
}) {
  const uid = useId().replace(/:/g, '')
  const wrap = useRef(null)
  const svgRef = useRef(null)
  const [boxRef, boxW] = useWidth()
  const dims = splitNames(dimensions)
  const D = Math.max(1, dims.length)
  const vf = new Intl.NumberFormat('en', { maximumFractionDigits: clamp(Math.round(decimals), 0, 6) })
  const rows = useMemo(() => {
    if (String(data ?? '').trim()) return parseRows(data).map((r) => ({ label: r.label, v: dims.map((_, k) => r.values[k] ?? 0) }))
    let s = Math.round(seed) * 7919 + 13
    const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280)
    const g = () => (r() + r() + r() - 1.5) / 0.5
    return Array.from({ length: Math.round(count) }, (_, i) => {
      const size_ = g()
      const tech = g()
      const vals = [38 + size_ * 14 + tech * 8, 220 + size_ * 90 + tech * 40, 1900 + size_ * 380, 17 - size_ * 2.2 + tech * 1.4, 380 + tech * 70 + size_ * 30, 3.9 + tech * 0.4 + r() * 0.3]
      return { label: `Model ${String.fromCharCode(65 + (i % 26))}${Math.floor(i / 26) + 1}`, v: dims.map((_, k) => +(vals[k % vals.length] * (1 + (r() - 0.5) * 0.06)).toFixed(1)) }
    })
  }, [data, dimensions, count, seed]) // eslint-disable-line react-hooks/exhaustive-deps
  const ranges = dims.map((_, k) => (rows.length ? niceRange(Math.min(...rows.map((r) => r.v[k])), Math.max(...rows.map((r) => r.v[k])), 4) : niceRange(0, 1, 4)))
  const ck = Math.max(0, dims.indexOf(String(colorBy).trim()))
  const p = useReveal(animate, duration, `${data}|${count}|${seed}|${dimensions}`)
  const [brush, setBrush] = useState({}) // axis -> [lo, hi] in values
  const [drag, setDrag] = useState(null)
  const [hov, setHov] = useState(-1)
  const [tip, setTip] = useState(null)

  const W = Math.max(300, (boxW || width) - size * 3)
  const H = height
  const longest = (k) => (dims[k] ?? '').length * size * 0.85 * 0.62 + size * 1.6
  const m = { l: Math.max(size * 2.2, longest(0) / 2 + 2), r: Math.max(size * 2.2, longest(D - 1) / 2 + 2), t: size * 3, b: size * 1.2 }
  const pw = W - m.l - m.r
  const ph = Math.max(40, H - m.t - m.b)
  const X = (k) => m.l + (D > 1 ? (k / (D - 1)) * pw : pw / 2)
  const Y = (k, v) => m.t + ph - ((v - ranges[k].lo) / (ranges[k].hi - ranges[k].lo || 1)) * ph
  const V = (k, y) => ranges[k].lo + ((m.t + ph - y) / ph) * (ranges[k].hi - ranges[k].lo)
  // diverging along the colour measure: color2 (low) -> soft grey -> color (high)
  const midC = mix(mutedColor, background, 0.35)
  const rampC = (t) => (t < 0.5 ? mix(color2, midC, t * 2) : mix(midC, color, (t - 0.5) * 2))
  const lineColor = (r) => rampC(clamp((r.v[ck] - ranges[ck].lo) / (ranges[ck].hi - ranges[ck].lo || 1), 0, 1))
  const passes = (r) => Object.entries(brush).every(([k, [a, b]]) => r.v[k] >= a && r.v[k] <= b)
  const path = (r) => {
    const P = r.v.map((v, k) => [X(k), Y(k, v)])
    if (!curved || P.length < 2) return 'M' + P.map((q) => q.join(',')).join('L')
    let d = `M${P[0]}`
    for (let k = 1; k < P.length; k++) {
      const mx = (P[k - 1][0] + P[k][0]) / 2
      d += `C${mx},${P[k - 1][1]} ${mx},${P[k][1]} ${P[k]}`
    }
    return d
  }
  const local = (e) => {
    const b = svgRef.current.getBoundingClientRect()
    return [e.clientX - b.left, e.clientY - b.top]
  }
  const shown = rows.filter(passes).length
  const reveal = ease(clamp((p - 0.15) / 0.85, 0, 1))
  const tw = Math.max(2, trackWidth)
  const enter = (e, r, i) => {
    if (drag) return
    setHov(i)
    const c = lineColor(r)
    if (tooltip) setTip(tipAt(e, wrap, r.label, dims.map((d, k) => ({ label: d, value: vf.format(r.v[k]), color: k === ck ? c : undefined }))))
  }
  const hovRow = hov >= 0 ? rows[hov] : null

  return (
    <Card wrapRef={(el) => { wrap.current = el; boxRef.current = el }} {...{ width, background, textColor, mutedColor, size, title, subtitle, tip }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5em 1.2em', flexWrap: 'wrap', marginBottom: '0.8em', color: mutedColor, fontSize: '0.88em', fontWeight: 600 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5em' }}>
          <span>{`${dims[ck] ?? ''} low`}</span>
          <span style={{ display: 'flex', gap: 3 }}>
            {[0, 0.25, 0.5, 0.75, 1].map((t) => <i key={t} style={{ width: size * 1.1, height: size * 0.75, borderRadius: 4, background: rampC(t) }} />)}
          </span>
          <span>high</span>
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.7em' }}>
          <span><b style={{ color: textColor }}>{shown}</b>{` of ${rows.length} shown`}</span>
          {Object.keys(brush).length > 0 && (
            <button type="button" onClick={() => setBrush({})} style={{ font: 'inherit', fontWeight: 700, color: background, background: textColor, border: 'none', borderRadius: 99, padding: '0.2em 0.85em', cursor: 'pointer' }}>
              Clear filters
            </button>
          )}
        </span>
      </div>
      <svg
        ref={svgRef}
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${title}. Parallel coordinates of ${rows.length} items across ${dims.join(', ')}, coloured by ${dims[ck] ?? ''}. ${shown} shown.`}
        style={{ display: 'block', maxWidth: '100%', overflow: 'visible', userSelect: 'none', touchAction: 'none' }}
        onPointerMove={(e) => {
          if (!drag) return
          const [, y] = local(e)
          setDrag({ ...drag, y1: clamp(y, m.t, m.t + ph) })
        }}
        onPointerUp={() => {
          if (!drag) return
          const { k, y0, y1 } = drag
          setBrush((b) => {
            const nb = { ...b }
            if (Math.abs(y1 - y0) < 4) delete nb[k]
            else nb[k] = [Math.min(V(k, y0), V(k, y1)), Math.max(V(k, y0), V(k, y1))]
            return nb
          })
          setDrag(null)
        }}
        onPointerLeave={() => { setDrag(null); setHov(-1); setTip(null) }}
      >
        <defs>
          <clipPath id={`rv${uid}`}><rect x="-20" y="-10" width={m.l + 20 + pw * reveal + 4} height={H + 20} /></clipPath>
          <pattern id={`st${uid}`} width={stripeWidth * 2} height={stripeWidth * 2} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width={stripeWidth} height={stripeWidth * 2} fill="#ffffff" opacity="0.4" />
          </pattern>
        </defs>

        {/* tracks: chunky rounded bars that pop up one after another */}
        {dims.map((d, k) => {
          const kk = pop(clamp((p - (D > 1 ? k / (D - 1) : 0) * 0.3) / 0.4, 0, 1))
          const h = ph * kk
          return <rect key={`tr${k}`} x={X(k) - tw / 2} y={m.t + ph - h} width={tw} height={Math.max(0, h)} rx={tw / 2} fill={trackColor} />
        })}

        <g clipPath={`url(#rv${uid})`} strokeLinecap="round" strokeLinejoin="round" fill="none">
          {rows.map((r, i) => (passes(r) ? null : <path key={`o${i}`} d={path(r)} stroke={mix(trackColor, mutedColor, 0.25)} strokeWidth={Math.max(1, strokeWidth * 0.6)} />))}
          {rows.map((r, i) => {
            if (!passes(r)) return null
            return (
              <path
                key={i}
                d={path(r)}
                stroke={lineColor(r)}
                strokeWidth={strokeWidth}
                strokeOpacity={lineOpacity * (hov >= 0 && hov !== i ? 0.4 : 1)}
                style={{ transition: 'stroke-opacity .2s', pointerEvents: 'none' }}
              />
            )
          })}
          {hovRow && passes(hovRow) && (
            <g style={{ pointerEvents: 'none' }}>
              <path d={path(hovRow)} stroke={background} strokeWidth={strokeWidth * 2 + 4} />
              <path d={path(hovRow)} stroke={lineColor(hovRow)} strokeWidth={strokeWidth * 2} />
              {hovRow.v.map((v, k) => <circle key={k} cx={X(k)} cy={Y(k, v)} r={strokeWidth * 2.2} fill={background} stroke={lineColor(hovRow)} strokeWidth={strokeWidth * 1.2} />)}
            </g>
          )}
          {/* wide invisible hit lines, bigger than the drawn ones */}
          {rows.map((r, i) =>
            passes(r) ? (
              <path
                key={`h${i}`}
                d={path(r)}
                stroke="transparent"
                strokeWidth={Math.max(8, strokeWidth * 3)}
                onPointerEnter={(e) => enter(e, r, i)}
                onPointerMove={(e) => tooltip && !drag && setTip((t) => (t ? { ...t, ...tipAt(e, wrap, t.title, t.rows) } : t))}
                onPointerLeave={() => { setHov(-1); setTip(null) }}
              />
            ) : null,
          )}
        </g>

        {dims.map((d, k) => {
          const x = X(k)
          const b = brush[k]
          const live = drag && drag.k === k
          const band = live ? [Math.min(drag.y0, drag.y1), Math.abs(drag.y1 - drag.y0)] : b ? [Y(k, b[1]), Y(k, b[0]) - Y(k, b[1])] : null
          const isC = k === ck
          const fs = size * 0.85
          const pwid = d.length * fs * 0.62 + fs * 1.6
          const ph2 = fs * 1.9
          const lk = pop(clamp((p - (D > 1 ? k / (D - 1) : 0) * 0.3 - 0.1) / 0.4, 0, 1))
          const bw = tw + 8
          return (
            <g key={k}>
              {showTicks &&
                ticksOf(ranges[k]).map((t, i) => (
                  <text key={i} x={x + (k === D - 1 ? -(tw / 2 + 5) : tw / 2 + 5)} y={Y(k, t)} dy="0.35em" textAnchor={k === D - 1 ? 'end' : 'start'} fontSize={size * 0.7} fontWeight="600" fill={mutedColor} stroke={background} strokeWidth="3" paintOrder="stroke" style={{ pointerEvents: 'none', fontVariantNumeric: 'tabular-nums' }}>
                    {axisFmt.format(t)}
                  </text>
                ))}
              {band && band[1] > 0 && (
                <g style={{ pointerEvents: 'none' }}>
                  <rect x={x - bw / 2} y={band[0]} width={bw} height={band[1]} rx={Math.min(bw / 2, band[1] / 2)} fill={textColor} />
                  {stripes && <rect x={x - bw / 2} y={band[0]} width={bw} height={band[1]} rx={Math.min(bw / 2, band[1] / 2)} fill={`url(#st${uid})`} />}
                </g>
              )}
              <g transform={`translate(${x} ${m.t - ph2 / 2 - 8}) scale(${lk})`} style={{ pointerEvents: 'none' }}>
                <rect x={-pwid / 2} y={-ph2 / 2} width={pwid} height={ph2} rx={ph2 / 2} fill={isC ? color : trackColor} />
                <text y="0" dy="0.35em" textAnchor="middle" fontSize={fs} fontWeight="700" fill={isC ? inkOn(color, textColor) : textColor}>{d}</text>
              </g>
              {brushable && (
                <rect
                  x={x - 12}
                  y={m.t}
                  width="24"
                  height={ph}
                  fill="transparent"
                  style={{ cursor: 'ns-resize' }}
                  onPointerDown={(e) => {
                    e.preventDefault()
                    const [, y] = local(e)
                    setDrag({ k, y0: y, y1: y })
                    setTip(null)
                    setHov(-1)
                  }}
                />
              )}
            </g>
          )
        })}
      </svg>
    </Card>
  )
}
