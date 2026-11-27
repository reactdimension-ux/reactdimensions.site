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

// ---- binning helpers ----
// Points are "Label:x|y". Leave `data` empty for a seeded demo set.
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
// colour ramps: stops are #rrggbb, t is 0..1
const rampAt = (stops, t) => {
  const k = clamp(t, 0, 1) * (stops.length - 1)
  const i = Math.min(stops.length - 2, Math.floor(k))
  return mix(stops[i], stops[i + 1], k - i)
}
// sequential: background -> color; diverging: color2 -> soft grey -> color (never a rainbow)
function stopsFor(scale, { color, color2, background, mutedColor, reverse }) {
  const s = scale === 'diverging' ? [color2, mix(mutedColor, background, 0.6), color] : [mix(background, color, 0.14), color]
  return reverse ? [...s].reverse() : s
}
// a flat stepped key: chunky swatches with the low and high counts at the ends
function StepLegend({ stops, lo, hi, steps = 5, size, mutedColor }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5em', color: mutedColor, fontSize: '0.8em', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
      <span>{lo}</span>
      <span style={{ display: 'flex', gap: 3 }}>
        {Array.from({ length: steps }, (_, i) => (
          <i key={i} style={{ width: size * 1.3, height: size * 0.8, borderRadius: 4, background: rampAt(stops, steps > 1 ? i / (steps - 1) : 1) }} />
        ))}
      </span>
      <span>{hi}</span>
    </div>
  )
}
// ---- end binning helpers ----

// Flat infographic hexbin plot: thousands of points binned into chunky rounded hexagons
// (or squares, or circles), each a solid flat colour from a background-to-colour ramp.
// The busiest bin gets a striped band and a "peak" badge. Bins pop out from the peak.
// Hover a bin for its count and share. Points are "Label:x|y", or leave `data` empty
// for a seeded demo of overlapping clusters.
export default function FlatHexbinPlot({
  data = '',
  count = 3200,
  clusters = 3,
  seed = 5,
  title = 'Where the traffic lands',
  subtitle = '3,200 requests: latency against payload size',
  xLabel = 'Payload (KB)',
  yLabel = 'Latency (ms)',
  shape = 'hexagon',
  binSize = 15,
  scaleType = 'sqrt',
  scale = 'sequential',
  reverse = false,
  sizeByCount = false,
  minCount = 1,
  showPoints = false,
  gap = 2,
  roundness = 0.5,
  showPeak = true,
  stripes = true,
  stripeWidth = 4,
  showGrid = true,
  showAxis = true,
  axisArrows = true,
  showLegend = true,
  tooltip = true,
  animate = true,
  duration = 1300,
  width = 680,
  height = 340,
  size = 13,
  color = '#4a7fe8',
  color2 = '#ef5b7f',
  background = '#ffffff',
  gridColor = '#eef0f6',
  textColor = '#2b2f3a',
  mutedColor = '#8a90a0',
}) {
  const uid = useId().replace(/:/g, '')
  const wrap = useRef(null)
  const [boxRef, boxW] = useWidth()
  const pts = useMemo(() => {
    const parsed = String(data ?? '').trim() ? parseRows(data) : null
    if (parsed) return parsed.map((r) => ({ x: r.values[0] ?? 0, y: r.values[1] ?? 0 }))
    const r = rng(Math.round(seed) * 53 + 7)
    const K = clamp(Math.round(clusters), 1, 6)
    const C = [[30, 40, 9, 7, 0.5], [62, 58, 12, 10, -0.3], [48, 72, 7, 6, 0.2], [74, 34, 8, 8, 0.6], [22, 70, 6, 6, 0], [55, 28, 10, 5, -0.4]]
    return Array.from({ length: Math.round(count) }, (_, i) => {
      const [cx, cy, sx, sy, rho] = C[i % K]
      const zx = gauss(r)
      return { x: +(cx + zx * sx).toFixed(2), y: +(cy + (rho * zx + Math.sqrt(1 - rho * rho) * gauss(r)) * sy).toFixed(2) }
    })
  }, [data, count, clusters, seed])

  const xs = pts.length ? pts.map((q) => q.x) : [0, 1]
  const ys = pts.length ? pts.map((q) => q.y) : [0, 1]
  const sx = niceRange(Math.min(...xs), Math.max(...xs), 6)
  const sy = niceRange(Math.min(...ys), Math.max(...ys), 5)
  const xt = ticksOf(sx)
  const yt = ticksOf(sy)
  const W = Math.max(260, (boxW || width) - size * 3)
  const H = height
  const m = {
    l: (showAxis ? Math.max(...yt.map((v) => fmtTickLabel(v).length)) * size * 0.56 + 14 : 8) + (yLabel ? size * 1.5 : 0),
    r: showAxis && axisArrows ? size * 1.4 : 10,
    t: showAxis && axisArrows ? size * 1.3 : 8,
    b: (showAxis ? size * 2.1 : 8) + (xLabel ? size * 1.5 : 0),
  }
  const pw = Math.max(60, W - m.l - m.r)
  const ph = Math.max(60, H - m.t - m.b)
  const X = (v) => ((v - sx.lo) / (sx.hi - sx.lo)) * pw
  const Y = (v) => ph - ((v - sy.lo) / (sy.hi - sy.lo)) * ph
  const R = clamp(binSize, 6, 48)
  const stops = stopsFor(scale, { color, color2, background, mutedColor, reverse })

  const bins = useMemo(() => {
    const map = new Map()
    const add = (key, cx, cy) => {
      const b = map.get(key) ?? { cx, cy, n: 0 }
      b.n++
      map.set(key, b)
    }
    const s3 = Math.sqrt(3)
    for (const q of pts) {
      const x = X(q.x)
      const y = Y(q.y)
      if (shape === 'square') {
        const i = Math.floor(x / (R * 1.7))
        const j = Math.floor(y / (R * 1.7))
        add(`${i},${j}`, (i + 0.5) * R * 1.7, (j + 0.5) * R * 1.7)
      } else {
        // pixel -> axial hex coordinates (pointy top), then cube rounding
        const fq = ((s3 / 3) * x - y / 3) / R
        const fr = ((2 / 3) * y) / R
        let rq = Math.round(fq)
        let rr = Math.round(fr)
        const rs = Math.round(-fq - fr)
        const dq = Math.abs(rq - fq)
        const dr = Math.abs(rr - fr)
        const ds = Math.abs(rs + fq + fr)
        if (dq > dr && dq > ds) rq = -rr - rs
        else if (dr > ds) rr = -rq - rs
        add(`${rq},${rr}`, R * s3 * (rq + rr / 2), R * 1.5 * rr)
      }
    }
    return [...map.values()]
  }, [pts, shape, R, W, H, sx.lo, sx.hi, sy.lo, sy.hi]) // eslint-disable-line react-hooks/exhaustive-deps

  const shown = bins.filter((b) => b.n >= Math.max(1, minCount))
  const nMax = Math.max(1, ...shown.map((b) => b.n))
  const nMin = Math.min(nMax, ...shown.map((b) => b.n))
  const tf = (n) => (scaleType === 'log' ? Math.log(n) : scaleType === 'sqrt' ? Math.sqrt(n) : n)
  const tOf = (n) => (nMax === nMin ? 1 : (tf(n) - tf(nMin)) / (tf(nMax) - tf(nMin)))
  const peakI = shown.reduce((a, b, i) => (b.n > (shown[a]?.n ?? -1) ? i : a), 0)
  const peak = shown[peakI] ?? { cx: 0, cy: 0, n: 0 }
  const dmax = Math.max(1, ...shown.map((b) => Math.hypot(b.cx - peak.cx, b.cy - peak.cy)))
  const p = useReveal(animate, duration, `${data}|${count}|${clusters}|${seed}|${shape}|${binSize}`)
  const [hov, setHov] = useState(-1)
  const [tip, setTip] = useState(null)
  const cell = shape === 'square' ? R * 1.7 : R
  // soft corners: the shape is stroked in its own colour with round joins
  const softW = (r) => Math.min(r * 0.45, Math.max(0, roundness) * r * 0.4)
  const hexPath = (cx, cy, r) => 'M' + Array.from({ length: 6 }, (_, k) => { const a = (Math.PI / 3) * k - Math.PI / 6; return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}` }).join('L') + 'Z'
  const shapeEl = (b, r, fill, props = {}) => {
    const sw = softW(r)
    const ri = Math.max(0, r - sw / 2)
    if (shape === 'square') return <rect x={b.cx - r / 2 + sw / 2} y={b.cy - r / 2 + sw / 2} width={Math.max(0, r - sw)} height={Math.max(0, r - sw)} rx={Math.min(r / 4, 2 + roundness * r * 0.18)} fill={fill} {...props} />
    if (shape === 'circle') return <circle cx={b.cx} cy={b.cy} r={r * 0.9} fill={fill} {...props} />
    return <path d={hexPath(b.cx, b.cy, ri)} fill={fill} stroke={props.stroke ?? fill} strokeWidth={sw} strokeLinejoin="round" {...props} />
  }
  const tipRows = (b, c) => [{ color: c, label: 'Share', value: `${((b.n / Math.max(1, pts.length)) * 100).toFixed(1)}%` }, { label: xLabel || 'x', value: fmtTickLabel(sx.lo + (b.cx / pw) * (sx.hi - sx.lo)) }, { label: yLabel || 'y', value: fmtTickLabel(sy.lo + ((ph - b.cy) / ph) * (sy.hi - sy.lo)) }]

  // peak badge, kept inside the plot
  const pk = pop(clamp((p - 0.75) / 0.25, 0, 1))
  const pfs = size * 0.8
  const ptxt = `Peak · ${peak.n}`
  const pbw = ptxt.length * pfs * 0.6 + pfs * 1.6
  const pbh = pfs * 1.9
  const pAbove = peak.cy - cell - pbh - 6 > 0
  const pbx = clamp(peak.cx - pbw / 2, 2, pw - pbw - 2)
  const pby = pAbove ? peak.cy - cell - pbh - 6 : peak.cy + cell + 6

  return (
    <Card wrapRef={(el) => { wrap.current = el; boxRef.current = el }} {...{ width, background, textColor, mutedColor, size, title, subtitle, tip }}>
      {showLegend && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5em 1.2em', flexWrap: 'wrap', marginBottom: '0.8em', color: mutedColor, fontSize: '0.88em', fontWeight: 600 }}>
          <span>{`${pts.length.toLocaleString('en')} points in ${shown.length} bins`}</span>
          <StepLegend stops={stops} lo={`${nMin}`} hi={`${nMax}`} size={size} mutedColor={mutedColor} />
        </div>
      )}
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${title}. ${shape} bin plot of ${pts.length} points in ${shown.length} bins, from ${nMin} to ${nMax} per bin.`}
        style={{ display: 'block', maxWidth: '100%', overflow: 'visible' }}
        onMouseLeave={() => { setHov(-1); setTip(null) }}
      >
        <defs>
          <clipPath id={`pc${uid}`}>
            <rect x="0" y="0" width={pw} height={ph} />
          </clipPath>
          <pattern id={`st${uid}`} width={stripeWidth * 2} height={stripeWidth * 2} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width={stripeWidth} height={stripeWidth * 2} fill="#ffffff" opacity="0.4" />
          </pattern>
          <marker id={`ar${uid}`} viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,1 L9,5 L0,9 Z" fill={mutedColor} />
          </marker>
        </defs>
        {yt.map((v, i) => (
          <g key={`y${i}`}>
            {showGrid && v !== sy.lo && <line x1={m.l} x2={m.l + pw} y1={m.t + Y(v)} y2={m.t + Y(v)} stroke={gridColor} strokeWidth="2" strokeDasharray="5 7" strokeLinecap="round" />}
            {showAxis && <text x={m.l - 10} y={m.t + Y(v)} dy="0.35em" textAnchor="end" fontSize={size * 0.82} fill={mutedColor} style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtTickLabel(v)}</text>}
          </g>
        ))}
        {xt.map((v, i) => (
          <g key={`x${i}`}>
            {showGrid && v !== sx.lo && <line x1={m.l + X(v)} x2={m.l + X(v)} y1={m.t} y2={m.t + ph} stroke={gridColor} strokeWidth="2" strokeDasharray="5 7" strokeLinecap="round" />}
            {showAxis && <text x={m.l + X(v)} y={m.t + ph + size * 1.5} textAnchor="middle" fontSize={size * 0.82} fill={mutedColor} style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtTickLabel(v)}</text>}
          </g>
        ))}
        {xLabel && <text x={m.l + pw / 2} y={H - 2} textAnchor="middle" fontSize={size * 0.9} fill={mutedColor} fontWeight="600">{xLabel}</text>}
        {yLabel && <text transform={`translate(${size * 0.9},${m.t + ph / 2}) rotate(-90)`} textAnchor="middle" fontSize={size * 0.9} fill={mutedColor} fontWeight="600">{yLabel}</text>}

        <g transform={`translate(${m.l},${m.t})`}>
          <g clipPath={`url(#pc${uid})`}>
            {showPoints && pts.slice(0, 1500).map((q, i) => <circle key={`p${i}`} cx={X(q.x)} cy={Y(q.y)} r="1.3" fill={textColor} opacity="0.2" style={{ pointerEvents: 'none' }} />)}
            {shown.map((b, i) => {
              const d = Math.hypot(b.cx - peak.cx, b.cy - peak.cy) / dmax
              const k = pop(clamp((p - d * 0.55) / 0.45, 0, 1))
              const t = tOf(b.n)
              const c = rampAt(stops, t)
              const r = Math.max(0, (cell - gap) * (sizeByCount ? 0.35 + 0.65 * t : 1) * k * (i === hov ? 1.1 : 1))
              const isPeak = showPeak && stripes && i === peakI && r > 4
              return (
                <g key={i} opacity={hov >= 0 && hov !== i ? 0.4 : 1} style={{ transition: 'opacity .2s' }}>
                  {shapeEl(b, r, c, { style: { pointerEvents: 'none' } })}
                  {isPeak && (
                    <>
                      <clipPath id={`k${uid}`}>{shapeEl(b, r, '#000')}</clipPath>
                      <g clipPath={`url(#k${uid})`} style={{ pointerEvents: 'none' }}>
                        <rect x={b.cx - r} y={b.cy - r} width={r * 2} height={r * 2} fill={mix(c, '#000000', 0.16)} />
                        <rect x={b.cx - r} y={b.cy - r} width={r * 2} height={r * 2} fill={`url(#st${uid})`} />
                      </g>
                    </>
                  )}
                  <circle
                    cx={b.cx}
                    cy={b.cy}
                    r={cell * 0.9}
                    fill="transparent"
                    onMouseEnter={(e) => { setHov(i); tooltip && setTip(tipAt(e, wrap, `${b.n} points`, tipRows(b, c))) }}
                    onMouseMove={(e) => tooltip && setTip(tipAt(e, wrap, `${b.n} points`, tipRows(b, c)))}
                  />
                </g>
              )
            })}
          </g>
          {/* the hovered bin, redrawn on top with a dark rim */}
          {hov >= 0 && shown[hov] && (() => {
            const b = shown[hov]
            const t = tOf(b.n)
            const r = (cell - gap) * (sizeByCount ? 0.35 + 0.65 * t : 1) * 1.1
            return <g style={{ pointerEvents: 'none' }}>{shapeEl(b, r + 3, textColor)}{shapeEl(b, r, rampAt(stops, t))}</g>
          })()}
          {showPeak && shown.length > 0 && pk > 0 && (
            <g transform={`translate(${pbx + pbw / 2} ${pby + pbh / 2}) scale(${pk}) translate(${-(pbx + pbw / 2)} ${-(pby + pbh / 2)})`} style={{ pointerEvents: 'none' }} opacity={hov >= 0 && hov !== peakI ? 0.4 : 1}>
              <rect x={pbx} y={pby} width={pbw} height={pbh} rx={pbh / 2} fill={textColor} stroke={background} strokeWidth="2" />
              <text x={pbx + pbw / 2} y={pby + pbh / 2} dy="0.35em" textAnchor="middle" fontSize={pfs} fontWeight="700" fill={background} style={{ fontVariantNumeric: 'tabular-nums' }}>{ptxt}</text>
            </g>
          )}
        </g>

        {showAxis && (
          <g stroke={mutedColor} strokeWidth="2" strokeLinecap="round" fill="none" style={{ pointerEvents: 'none' }}>
            <path d={`M${m.l},${m.t + ph}H${m.l + pw + (axisArrows ? m.r * 0.6 : 0)}`} markerEnd={axisArrows ? `url(#ar${uid})` : undefined} />
            <path d={`M${m.l},${m.t + ph}V${m.t - (axisArrows ? m.t * 0.6 : 0)}`} markerEnd={axisArrows ? `url(#ar${uid})` : undefined} />
          </g>
        )}
      </svg>
    </Card>
  )
}
