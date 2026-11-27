import { useEffect, useId, useMemo, useRef, useState } from 'react'

// ---- flat infographic helpers (kept inline so this file copies out on its own) ----

const FONT = '"Poppins", "Nunito", ui-rounded, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif'
const num = (v) => {
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : 0
}
function makeFmt({ decimals = 0, prefix = '', suffix = '' }) {
  const d = Math.max(0, Math.min(6, Math.round(decimals)))
  const nf = new Intl.NumberFormat('en', { minimumFractionDigits: d, maximumFractionDigits: d })
  return (v) => `${prefix}${nf.format(v)}${suffix}`
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
// each item starts a little after the one before it
const stag = (p, i, n) => Math.min(1, Math.max(0, (p - (n > 1 ? (i / (n - 1)) * 0.4 : 0)) / 0.6))
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

const splitNames = (s) =>
  String(s ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
// Multi-value rows: "Mon:12|30|18" -> { label: 'Mon', values: [12, 30, 18] }
function parseMulti(data) {
  if (Array.isArray(data)) return data.map((d) => ({ label: String(d.label ?? ''), values: (d.values ?? [d.value]).map(num) }))
  return String(data ?? '')
    .split(/[,\n;]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const i = s.lastIndexOf(':')
      return { label: i < 0 ? s : s.slice(0, i).trim(), values: (i < 0 ? '0' : s.slice(i + 1)).split('|').map(num) }
    })
}
function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
// white or dark ink, whichever reads better on a filled colour
function inkOn(c, dark) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(String(c).slice(i, i + 2), 16) || 0)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.66 ? dark : '#ffffff'
}
// flat colour scale, t is 0..1. Sequential runs from near-background to `color`;
// diverging runs `color2` -> a soft grey -> `color`; stepped is sequential cut into bands.
function makeScale({ scale, steps, reverse, color, color2, background, mutedColor }) {
  const neutral = mix(mutedColor, background, 0.78)
  const S = clamp(Math.round(steps), 2, 9)
  return (t0) => {
    let t = clamp(reverse ? 1 - t0 : t0, 0, 1)
    if (scale === 'diverging') return t < 0.5 ? mix(color2, neutral, t * 2) : mix(neutral, color, (t - 0.5) * 2)
    if (scale === 'stepped') t = Math.min(S - 1, Math.floor(t * S)) / (S - 1)
    return mix(background, color, 0.08 + 0.92 * t)
  }
}
// a row of flat swatches with end labels, used as the chart legend
function SwatchLegend({ colorAt, n, lo, mid, hi, mutedColor, size }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.6em', marginTop: '0.9em', fontSize: '0.82em', fontWeight: 600, color: mutedColor, fontVariantNumeric: 'tabular-nums' }}>
      <span>{lo}</span>
      <div style={{ display: 'flex', gap: 3 }}>
        {Array.from({ length: n }, (_, i) => (
          <i key={i} style={{ width: size * 1.5, height: size * 0.9, borderRadius: 4, background: colorAt(n > 1 ? i / (n - 1) : 0.5) }} />
        ))}
      </div>
      <span>{hi}</span>
      {mid != null && <span style={{ marginLeft: '0.4em' }}>{`(mid ${mid})`}</span>}
    </div>
  )
}

// Flat infographic heatmap: a grid of chunky rounded cells in flat tones of one colour
// (or two, diverging round a soft grey; or cut into stepped bands). Cells pop in as a
// diagonal wave, the peak cell wears diagonal stripes, and hover lights up the row and
// column. Rows are "Label:v|v|v" with `columns` naming the columns, or leave `data`
// empty for a demo of activity by weekday and hour.
export default function FlatHeatmap({
  data = '',
  columns = '',
  rows = 7,
  cols = 24,
  seed = 6,
  title = 'Activity by hour',
  subtitle = 'Sessions per hour, by weekday',
  scale = 'sequential',
  steps = 5,
  reverse = false,
  min = 0,
  max = 0,
  cellRadius = 6,
  gap = 4,
  showValues = false,
  highlightMax = true,
  stripeWidth = 3,
  decimals = 0,
  prefix = '',
  suffix = '',
  crosshair = true,
  showLegend = true,
  labelEvery = 0,
  tooltip = true,
  animate = true,
  duration = 1300,
  width = 680,
  height = 300,
  size = 13,
  color = '#4a7fe8',
  color2 = '#ef5b7f',
  background = '#ffffff',
  textColor = '#2b2f3a',
  mutedColor = '#8a90a0',
}) {
  const uid = useId().replace(/:/g, '')
  const wrap = useRef(null)
  const [boxRef, boxW] = useWidth()
  const fmt = makeFmt({ decimals, prefix, suffix })

  const grid = useMemo(() => {
    const parsed = String(data ?? '').trim() ? parseMulti(data) : null
    if (parsed) {
      const C = Math.max(1, ...parsed.map((r) => r.values.length))
      const names = splitNames(columns)
      return { rowNames: parsed.map((r) => r.label), colNames: Array.from({ length: C }, (_, c) => names[c] ?? `C${c + 1}`), v: parsed.map((r) => Array.from({ length: C }, (_, c) => r.values[c] ?? 0)) }
    }
    const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    const R = clamp(Math.round(rows), 2, 7)
    const C = clamp(Math.round(cols), 4, 24)
    const rnd = rng(Math.round(seed) * 71 + 3)
    const v = Array.from({ length: R }, (_, r) =>
      Array.from({ length: C }, (_, c) => {
        const hour = (c / Math.max(1, C - 1)) * 23
        const work = r < 5 ? 1 : 0.45
        const wave = Math.exp(-((hour - 10) ** 2) / 12) * 0.9 + Math.exp(-((hour - 15.5) ** 2) / 10) * 0.8 + Math.exp(-((hour - 21) ** 2) / 8) * (r < 5 ? 0.35 : 0.7)
        return Math.round(clamp((wave * work + 0.06) * 100 + (rnd() - 0.5) * 18, 0, 100))
      }),
    )
    const colNames = Array.from({ length: C }, (_, c) => {
      const h = Math.round((c / Math.max(1, C - 1)) * 23)
      return `${h % 12 || 12}${h < 12 ? 'a' : 'p'}`
    })
    return { rowNames: DAYS.slice(0, R), colNames, v }
  }, [data, columns, rows, cols, seed])

  const R = grid.v.length
  const C = grid.colNames.length
  const flat = grid.v.flat()
  const lo = max > min ? min : Math.min(...flat)
  const hi = max > min ? max : Math.max(...flat)
  const colorAt = makeScale({ scale, steps, reverse, color, color2, background, mutedColor })
  const colorOf = (v) => colorAt(hi === lo ? 0.5 : (v - lo) / (hi - lo))
  // the single peak cell (first one if several tie) wears the stripes
  const peakAt = flat.indexOf(Math.max(...flat))
  const p = useReveal(animate, duration, `${data}|${rows}|${cols}|${seed}|${scale}`)
  const [hov, setHov] = useState(null)
  const [tip, setTip] = useState(null)

  const W = Math.max(260, (boxW || width) - size * 3)
  const maxLab = Math.min(14, Math.max(1, ...grid.rowNames.map((s) => s.length)))
  const m = { l: maxLab * size * 0.62 + 12, r: 2, t: 2, b: size * 2 }
  const pw = Math.max(60, W - m.l - m.r)
  const H = Math.max(120, height)
  const ph = Math.max(40, H - m.t - m.b)
  const cw = pw / C
  const ch = ph / R
  const every = labelEvery > 0 ? Math.round(labelEvery) : Math.max(1, Math.ceil((Math.max(...grid.colNames.map((s) => s.length)) * size * 0.85 * 0.62 + 8) / cw))
  const g = clamp(gap, 0, Math.min(cw, ch) / 3)
  const rad = Math.min(cellRadius, (cw - g) / 2, (ch - g) / 2)
  const tipFor = (e, r, c, v) => tipAt(e, wrap, `${grid.rowNames[r]} · ${grid.colNames[c]}`, [{ color: colorOf(v), label: 'Value', value: fmt(v) }])
  const nLeg = scale === 'stepped' ? clamp(Math.round(steps), 2, 9) : 7

  return (
    <Card wrapRef={(el) => { wrap.current = el; boxRef.current = el }} {...{ width, background, textColor, mutedColor, size, title, subtitle, tip }}>
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${title}. Heatmap of ${R} rows by ${C} columns, values from ${fmt(lo)} to ${fmt(hi)}. ${grid.rowNames.map((nm, r) => `${nm}: peak ${fmt(Math.max(...grid.v[r]))}`).join('; ')}`}
        style={{ display: 'block', maxWidth: '100%', overflow: 'visible' }}
        onMouseLeave={() => { setHov(null); setTip(null) }}
      >
        <defs>
          <pattern id={`st${uid}`} width={stripeWidth * 2} height={stripeWidth * 2} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width={stripeWidth} height={stripeWidth * 2} fill="#ffffff" opacity="0.4" />
          </pattern>
        </defs>
        {grid.rowNames.map((nm, r) => (
          <text key={r} x={m.l - 10} y={m.t + r * ch + ch / 2} dy="0.35em" textAnchor="end" fontSize={size * 0.9} fontWeight="600" fill={hov && hov.r === r ? textColor : mutedColor} style={{ transition: 'fill .15s' }}>
            {nm.length > 14 ? nm.slice(0, 13) + '…' : nm}
          </text>
        ))}
        {grid.colNames.map((nm, c) =>
          c % every === 0 ? (
            <text key={c} x={m.l + c * cw + cw / 2} y={m.t + ph + size * 1.4} textAnchor="middle" fontSize={size * 0.85} fontWeight="600" fill={hov && hov.c === c ? textColor : mutedColor} style={{ transition: 'fill .15s' }}>
              {nm}
            </text>
          ) : null,
        )}

        {grid.v.map((row, r) =>
          row.map((v, c) => {
            const k = clamp((p - ((r / R + c / C) / 2) * 0.5) / 0.5, 0, 1)
            const s = pop(k)
            const w = cw - g
            const h = ch - g
            const x = m.l + c * cw + g / 2
            const y = m.t + r * ch + g / 2
            const fill = colorOf(v)
            const on = !crosshair || !hov || hov.r === r || hov.c === c
            const exact = hov && hov.r === r && hov.c === c
            const top = highlightMax && r * C + c === peakAt
            if (k <= 0) return null
            return (
              <g key={`${r}-${c}`} opacity={on ? 1 : 0.4} style={{ transition: 'opacity .15s', pointerEvents: 'none' }} transform={`translate(${x + w / 2} ${y + h / 2}) scale(${s}) translate(${-x - w / 2} ${-y - h / 2})`}>
                <rect x={x} y={y} width={w} height={h} rx={rad} fill={fill} />
                {top && (
                  <>
                    <rect x={x} y={y} width={w} height={h} rx={rad} fill={mix(fill, '#000000', 0.12)} />
                    <rect x={x} y={y} width={w} height={h} rx={rad} fill={`url(#st${uid})`} />
                  </>
                )}
                {exact && <rect x={x - 1.5} y={y - 1.5} width={w + 3} height={h + 3} rx={rad + 1.5} fill="none" stroke={textColor} strokeWidth="2.5" />}
                {showValues && w > size * 1.6 && h > size * 1.1 && k > 0.8 && (
                  <text x={x + w / 2} y={y + h / 2} dy="0.35em" textAnchor="middle" fontSize={Math.min(size * 0.85, w * 0.38, h * 0.6)} fontWeight="700" fill={inkOn(fill, textColor)} style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {decimals ? v.toFixed(decimals) : Math.round(v)}
                  </text>
                )}
              </g>
            )
          }),
        )}

        {/* hit areas: the whole cell including the gap */}
        {grid.v.map((row, r) =>
          row.map((v, c) => (
            <rect
              key={`h${r}-${c}`}
              x={m.l + c * cw}
              y={m.t + r * ch}
              width={cw}
              height={ch}
              fill="transparent"
              onMouseEnter={(e) => { setHov({ r, c }); tooltip && setTip(tipFor(e, r, c, v)) }}
              onMouseMove={(e) => tooltip && setTip(tipFor(e, r, c, v))}
            />
          )),
        )}
      </svg>
      {showLegend && (
        <SwatchLegend colorAt={colorAt} n={nLeg} lo={fmt(lo)} hi={fmt(hi)} mid={scale === 'diverging' ? fmt((lo + hi) / 2) : null} mutedColor={mutedColor} size={size} />
      )}
    </Card>
  )
}
