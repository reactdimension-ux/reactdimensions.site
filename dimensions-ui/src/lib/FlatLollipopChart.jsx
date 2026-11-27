import { useEffect, useMemo, useRef, useState } from 'react'

// ---- flat infographic helpers (kept inline so this file copies out on its own) ----
// Data is a plain string: rows are separated by commas, each row is "Label:value",
// e.g. "Jan:42, Feb:58". An array of { label, value } works too.

const FONT = '"Poppins", "Nunito", ui-rounded, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif'
const num = (v) => {
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : 0
}
function parseRows(data) {
  if (Array.isArray(data)) return data.map((d) => ({ label: String(d.label ?? ''), value: num(d.value) }))
  return String(data ?? '')
    .split(/[,\n;]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const i = s.lastIndexOf(':')
      return { label: i < 0 ? s : s.slice(0, i).trim(), value: num(i < 0 ? 0 : s.slice(i + 1)) }
    })
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
// a rect path with a radius for each corner [top-left, top-right, bottom-right, bottom-left]
function rrect(x, y, w, h, r = [0, 0, 0, 0]) {
  w = Math.max(0, w)
  h = Math.max(0, h)
  const [a, b, c, d] = r.map((v) => Math.max(0, Math.min(v, w / 2, h / 2)))
  return `M${x + a},${y}H${x + w - b}Q${x + w},${y} ${x + w},${y + b}V${y + h - c}Q${x + w},${y + h} ${x + w - c},${y + h}H${x + d}Q${x},${y + h} ${x},${y + h - d}V${y + a}Q${x},${y} ${x + a},${y}Z`
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

// a "nice" axis: round step, ticks from lo to hi
function niceScale(lo0, hi0, steps = 4) {
  const raw = (hi0 - lo0) / steps || 1
  const mag = 10 ** Math.floor(Math.log10(Math.abs(raw)))
  const f = raw / mag
  const s = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * mag
  const lo = Math.floor(lo0 / s + 1e-9) * s
  let hi = Math.ceil(hi0 / s - 1e-9) * s
  if (hi <= lo) hi = lo + s
  const ticks = []
  for (let v = lo; v <= hi + s / 2; v += s) ticks.push(+v.toFixed(10))
  return { lo, hi, ticks }
}
const axisFmt = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })
function compactFmt({ decimals = 0, prefix = '', suffix = '' }) {
  const nf = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: Math.max(1, Math.round(decimals)) })
  return (v) => `${prefix}${nf.format(v)}${suffix}`
}
// white or dark text, whichever reads better on a filled shape
function inkOn(c, dark) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(String(c).slice(i, i + 2), 16) || 0)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.66 ? dark : '#ffffff'
}

// Flat infographic lollipop chart: a chunky rounded stem on a soft track and a big
// flat dot with a white centre per category. Measure from any `baseline`, colour by
// palette, value, above/below or one colour, rank badges and a top-N highlight.
// Stems spring out one after another and the dots pop at their tips.
export default function FlatLollipopChart({
  data = 'Rust:84, TypeScript:78, Python:71, Go:66, Kotlin:58, Swift:52, Ruby:41, PHP:33, Perl:19',
  title = 'Developer satisfaction',
  subtitle = 'Share who would use it again',
  orientation = 'horizontal',
  sort = 'desc',
  baseline = 0,
  colorMode = 'palette',
  dotStyle = 'solid',
  stemStyle = 'solid',
  dotSize = 9,
  stemWidth = 5,
  showTrack = true,
  highlightTop = 0,
  showRank = false,
  showValues = true,
  showGrid = true,
  showAxis = true,
  tooltip = true,
  animate = true,
  duration = 1200,
  valueFormat = 'number',
  decimals = 0,
  prefix = '',
  suffix = '%',
  width = 600,
  height = 320,
  size = 13,
  color = '#4a7fe8',
  color2 = '#ef5b7f',
  color3 = '#14a89e',
  color4 = '#f08a24',
  color5 = '#8e5fd6',
  color6 = '#c49a12',
  background = '#ffffff',
  trackColor = '#eef0f6',
  gridColor = '#eef0f6',
  textColor = '#2b2f3a',
  mutedColor = '#8a90a0',
}) {
  const wrap = useRef(null)
  const [boxRef, boxW] = useWidth()
  const fmt = valueFormat === 'compact' ? compactFmt({ decimals, prefix, suffix }) : makeFmt({ decimals, prefix, suffix })
  const rows = useMemo(() => {
    const r = parseRows(data).map((x) => ({ label: x.label, v: x.value }))
    if (sort === 'asc') r.sort((a, b) => a.v - b.v)
    else if (sort === 'desc') r.sort((a, b) => b.v - a.v)
    else if (sort === 'label') r.sort((a, b) => a.label.localeCompare(b.label))
    return r
  }, [data, sort])
  const p = useReveal(animate, duration, `${data}|${orientation}|${sort}|${baseline}`)
  const [hov, setHov] = useState(-1)
  const [tip, setTip] = useState(null)

  const horiz = orientation === 'horizontal'
  const n = Math.max(1, rows.length)
  const vals = rows.map((r) => r.v)
  const sc = niceScale(Math.min(baseline, ...vals), Math.max(baseline, ...vals))
  const tl = sc.ticks.map((t) => prefix + axisFmt.format(t) + suffix)
  const W = Math.max(240, (boxW || width) - size * 3)
  const H = height
  const badge = dotStyle === 'badge'
  const outVals = showValues && !badge
  const maxLab = Math.min(18, Math.max(1, ...rows.map((r) => r.label.length)))
  const rankW = showRank && horiz ? size * 2.2 : 0
  // room under the plot for slanted category labels when they do not fit their column
  const rot = !horiz && maxLab * size * 0.58 > (W - 40) / n - 4 ? maxLab * size * 0.58 * 0.57 : 0
  const m = horiz
    ? { l: maxLab * size * 0.6 + 14 + rankW, r: outVals ? size * 3.8 : dotSize + 14, t: 6, b: showAxis ? size * 2 : 8 }
    : { l: showAxis ? Math.max(...tl.map((s) => s.length)) * size * 0.55 + 14 : 8, r: 12, t: outVals ? size * 2.4 : dotSize + 12, b: size * 2.4 + rot }
  const pw = Math.max(40, W - m.l - m.r)
  const ph = Math.max(40, H - m.t - m.b)
  const band = (horiz ? ph : pw) / n
  const along = (v) => (horiz ? pw : ph) * ((v - sc.lo) / (sc.hi - sc.lo))
  const X = (v) => m.l + along(v)
  const Y = (v) => m.t + ph - along(v)
  const maxV = Math.max(...vals)
  const minV = Math.min(...vals)
  const rank = [...rows].sort((a, b) => b.v - a.v).map((r) => r.label)
  const rankOf = (r) => rank.indexOf(r.label) + 1
  const pal = [color, color2, color3, color4, color5, color6]
  const colorOf = (v, i) => {
    if (colorMode === 'above / below') return v >= baseline ? color3 : color2
    if (colorMode === 'by value') return mix(background, color, 0.35 + 0.65 * (maxV === minV ? 1 : (v - minV) / (maxV - minV)))
    if (colorMode === 'palette') return pal[i % pal.length]
    return color
  }
  const isTop = (r) => highlightTop <= 0 || rankOf(r) <= highlightTop
  // badge dots hold their value, so they grow to fit it but stay inside their band
  const R = badge ? Math.min(Math.max(dotSize, size * 1.3), band * 0.46) : Math.min(dotSize, band * 0.45)
  const sw = Math.min(stemWidth, R * 1.2)

  const tipRows = (r, i) => [
    { color: colorOf(r.v, i), label: baseline ? `vs baseline ${fmt(baseline)}` : 'Value', value: fmt(r.v) },
    ...(baseline ? [{ label: 'Difference', value: `${r.v - baseline >= 0 ? '+' : ''}${fmt(r.v - baseline)}` }] : []),
    { label: 'Rank', value: `#${rankOf(r)} of ${rows.length}` },
  ]

  return (
    <Card wrapRef={(el) => { wrap.current = el; boxRef.current = el }} {...{ width, background, textColor, mutedColor, size, title, subtitle, tip }}>
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${title}. Lollipop chart. ${rows.map((r) => `${r.label}: ${fmt(r.v)}`).join('; ')}`}
        style={{ display: 'block', overflow: 'visible' }}
        onMouseLeave={() => { setHov(-1); setTip(null) }}
      >
        {sc.ticks.map((t, k) => {
          const isB = t === baseline
          return horiz ? (
            <g key={k}>
              {showGrid && !isB && <line x1={X(t)} x2={X(t)} y1={m.t} y2={m.t + ph} stroke={gridColor} strokeWidth="2" strokeDasharray="5 7" strokeLinecap="round" />}
              {showAxis && <text x={X(t)} y={m.t + ph + size * 1.45} textAnchor="middle" fontSize={size * 0.82} fill={mutedColor} style={{ fontVariantNumeric: 'tabular-nums' }}>{tl[k]}</text>}
            </g>
          ) : (
            <g key={k}>
              {showGrid && !isB && <line x1={m.l} x2={m.l + pw} y1={Y(t)} y2={Y(t)} stroke={gridColor} strokeWidth="2" strokeDasharray="5 7" strokeLinecap="round" />}
              {showAxis && <text x={m.l - 10} y={Y(t)} dy="0.35em" textAnchor="end" fontSize={size * 0.82} fill={mutedColor} style={{ fontVariantNumeric: 'tabular-nums' }}>{tl[k]}</text>}
            </g>
          )
        })}

        {rows.map((row, i) => {
          const k = stag(p, i, n)
          const c = colorOf(row.v, i)
          const mid = (horiz ? m.t : m.l) + i * band + band / 2
          const v = baseline + (row.v - baseline) * pop(k)
          const cx = horiz ? X(v) : mid
          const cy = horiz ? mid : Y(v)
          const bx = horiz ? X(baseline) : mid
          const by = horiz ? mid : Y(baseline)
          const r = R * pop(clamp(k * 2.2, 0, 1))
          const below = row.v < baseline
          const op = (hov >= 0 && hov !== i ? 0.4 : 1) * (isTop(row) || hov === i ? 1 : 0.4)
          const name = row.label.length > 18 ? row.label.slice(0, 17) + '…' : row.label
          const tight = !horiz && name.length * size * 0.58 > band - 4
          const txt = fmt(baseline + (row.v - baseline) * ease(k))
          return (
            <g key={i} opacity={op} style={{ transition: 'opacity .2s' }}>
              {showTrack && (
                <line x1={horiz ? X(sc.lo) : mid} x2={horiz ? X(sc.hi) : mid} y1={horiz ? mid : Y(sc.lo)} y2={horiz ? mid : Y(sc.hi)} stroke={trackColor} strokeWidth={sw} strokeLinecap="round" />
              )}
              {k > 0 && (
                <line
                  x1={bx}
                  y1={by}
                  x2={cx}
                  y2={cy}
                  stroke={c}
                  strokeWidth={sw}
                  strokeLinecap="round"
                  strokeDasharray={stemStyle === 'dashed' ? `${sw * 0.1} ${sw * 2.2}` : undefined}
                />
              )}
              {r > 0.5 &&
                (dotStyle === 'ring' ? (
                  <circle cx={cx} cy={cy} r={r * 0.8} fill={background} stroke={c} strokeWidth={Math.max(2.5, r * 0.42)} />
                ) : (
                  <>
                    <circle cx={cx} cy={cy} r={r} fill={c} />
                    {!badge && <circle cx={cx} cy={cy} r={r * 0.38} fill={background} />}
                    {badge && k > 0.6 && (
                      <text x={cx} y={cy} dy="0.36em" textAnchor="middle" fontSize={Math.min(size * 0.8, r * 0.72)} fontWeight="800" fill={inkOn(c, textColor)} style={{ fontVariantNumeric: 'tabular-nums', pointerEvents: 'none' }}>
                        {txt}
                      </text>
                    )}
                  </>
                ))}
              {outVals && k > 0.15 && (
                <text
                  x={horiz ? cx + (below ? -(R + 8) : R + 8) : cx}
                  y={horiz ? cy : cy + (below ? R + size * 1.3 : -(R + 8))}
                  dy={horiz ? '0.35em' : 0}
                  textAnchor={horiz ? (below ? 'end' : 'start') : 'middle'}
                  fontSize={size * 1.02}
                  fontWeight="700"
                  fill={textColor}
                  style={{ fontVariantNumeric: 'tabular-nums', pointerEvents: 'none' }}
                >
                  {txt}
                </text>
              )}
              {showRank && horiz && (
                <g style={{ pointerEvents: 'none' }}>
                  <path d={rrect(0, mid - size * 0.72, size * 1.7, size * 1.44, [7, 7, 7, 7])} fill={isTop(row) && highlightTop > 0 ? c : trackColor} />
                  <text x={size * 0.85} y={mid} dy="0.36em" textAnchor="middle" fontSize={size * 0.78} fontWeight="800" fill={isTop(row) && highlightTop > 0 ? inkOn(c, textColor) : textColor}>
                    {rankOf(row)}
                  </text>
                </g>
              )}
              {horiz ? (
                <text x={m.l - 12} y={mid} dy="0.35em" textAnchor="end" fontSize={size * 0.92} fontWeight="600" fill={hov === i ? textColor : mutedColor} style={{ pointerEvents: 'none' }}>
                  {name}
                </text>
              ) : (
                <text
                  x={mid}
                  y={m.t + ph + size * 1.5}
                  textAnchor={tight ? 'end' : 'middle'}
                  transform={tight ? `rotate(-35 ${mid} ${m.t + ph + size * 1.5})` : undefined}
                  fontSize={size * 0.9}
                  fontWeight="600"
                  fill={hov === i ? textColor : mutedColor}
                  style={{ pointerEvents: 'none' }}
                >
                  {showRank ? `${rankOf(row)}. ` : ''}
                  {name}
                </text>
              )}
            </g>
          )
        })}

        {/* baseline: a solid axis line, drawn over the tracks */}
        {showAxis && (
          <g stroke={mutedColor} strokeWidth="2" strokeLinecap="round">
            {horiz ? <line x1={X(baseline)} x2={X(baseline)} y1={m.t - 2} y2={m.t + ph + 2} /> : <line x1={m.l - 2} x2={m.l + pw + 2} y1={Y(baseline)} y2={Y(baseline)} />}
          </g>
        )}

        {rows.map((row, i) => (
          <rect
            key={`h${i}`}
            x={horiz ? 0 : m.l + i * band}
            y={horiz ? m.t + i * band : m.t - (outVals ? size * 2 : 0)}
            width={horiz ? W : band}
            height={horiz ? band : ph + (outVals ? size * 2 : 0)}
            fill="transparent"
            onMouseEnter={(e) => { setHov(i); tooltip && setTip(tipAt(e, wrap, row.label, tipRows(row, i))) }}
            onMouseMove={(e) => tooltip && setTip((t) => (t ? { ...t, ...tipAt(e, wrap, t.title, t.rows) } : t))}
          />
        ))}
      </svg>
    </Card>
  )
}
