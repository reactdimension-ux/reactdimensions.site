import { useEffect, useId, useMemo, useRef, useState } from 'react'

// ---- flat infographic helpers (kept inline so this file copies out on its own) ----
// Data is a plain string: rows are separated by commas, each row is "Label:value",
// e.g. "Jan:42, Feb:58". An array of { label, value } works too.

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
const paletteOf = (n, base) => Array.from({ length: n }, (_, i) => base[i % base.length])
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

// Multi-series rows: "Berlin:62|78" -> { label: 'Berlin', values: [62, 78] }
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

// Flat infographic dot plot (Cleveland): big flat dots on a shared axis. Two values
// per row ("Berlin:62|78") are joined by a chunky striped pill tinted by direction,
// with a solid up/down change chip at the end. The axis can start at zero or zoom
// in. Dots slide from the first value to the last and pop on arrival.
export default function FlatDotPlot({
  data = 'Berlin:62|78, Lisbon:48|71, Toronto:71|74, Austin:55|69, Osaka:80|77, Nairobi:34|58, Lima:41|52',
  series = '2022, 2024',
  title = 'Remote-work adoption',
  subtitle = 'Share of workforce, 2022 vs 2024',
  orientation = 'horizontal',
  sort = 'diff',
  zeroBased = false,
  connector = true,
  stripes = true,
  stripeWidth = 4,
  showGuides = true,
  showDiff = true,
  showValues = false,
  showGrid = true,
  showAxis = true,
  showLegend = true,
  dotSize = 9,
  connectorWidth = 12,
  ringed = false,
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
  color = '#4a7fe8',
  color2 = '#ef5b7f',
  color3 = '#14a89e',
  color4 = '#f08a24',
  color5 = '#8e5fd6',
  color6 = '#c49a12',
  upColor = '#14a89e',
  downColor = '#ef5b7f',
  background = '#ffffff',
  gridColor = '#eef0f6',
  textColor = '#2b2f3a',
  mutedColor = '#8a90a0',
}) {
  const uid = useId().replace(/:/g, '')
  const wrap = useRef(null)
  const [boxRef, boxW] = useWidth()
  const fmt = valueFormat === 'compact' ? compactFmt({ decimals, prefix, suffix }) : makeFmt({ decimals, prefix, suffix })
  const rows0 = useMemo(() => parseMulti(data), [data])
  const S = Math.max(1, ...rows0.map((r) => r.values.length))
  const names = String(series ?? '').split(',').map((s) => s.trim())
  const sName = (s) => names[s] || `Series ${s + 1}`
  const pal = paletteOf(S, [color, color2, color3, color4, color5, color6])
  const rows = useMemo(() => {
    const r = rows0.map((x) => {
      const v = Array.from({ length: S }, (_, s) => x.values[s] ?? 0)
      return { label: x.label, v, diff: v[S - 1] - v[0] }
    })
    if (sort === 'label') r.sort((a, b) => a.label.localeCompare(b.label))
    else if (sort === 'first') r.sort((a, b) => b.v[0] - a.v[0])
    else if (sort === 'last') r.sort((a, b) => b.v[S - 1] - a.v[S - 1])
    else if (sort === 'diff') r.sort((a, b) => b.diff - a.diff)
    return r
  }, [rows0, S, sort])
  const p = useReveal(animate, duration, `${data}|${orientation}|${sort}|${zeroBased}`)
  const [hov, setHov] = useState(-1)
  const [hovS, setHovS] = useState(-1)
  const [tip, setTip] = useState(null)

  const horiz = orientation === 'horizontal'
  const n = Math.max(1, rows.length)
  const all = rows.flatMap((r) => r.v)
  const lo0 = zeroBased ? 0 : Math.min(...all)
  const hi0 = Math.max(...all)
  const padV = zeroBased ? 0 : (hi0 - lo0) * 0.08
  const sc = niceScale(zeroBased ? 0 : lo0 - padV, hi0 + padV)
  const tl = sc.ticks.map((t) => prefix + axisFmt.format(t) + suffix)
  const W = Math.max(240, (boxW || width) - size * 3)
  const H = height
  const chip = showDiff && S > 1
  const chipTxt = (r) => `${r.diff > 0 ? '▲' : r.diff < 0 ? '▼' : '='} ${fmt(Math.abs(r.diff))}`
  const chipW = Math.max(...rows.map((r) => chipTxt(r).length)) * size * 0.56 + size * 1.1
  const maxLab = Math.min(18, Math.max(1, ...rows.map((r) => r.label.length)))
  // room under the plot for slanted category labels when they do not fit their column
  const rot = !horiz && maxLab * size * 0.58 > (W - 40) / n - 4 ? maxLab * size * 0.58 * 0.57 : 0
  const m = horiz
    ? { l: maxLab * size * 0.6 + 14, r: chip ? chipW + 18 : 18, t: showValues ? size * 1.6 : 6, b: showAxis ? size * 2 : 8 }
    : { l: showAxis ? Math.max(...tl.map((s) => s.length)) * size * 0.55 + 14 : 8, r: 12, t: chip ? size * 2.8 : 14, b: size * 2.4 + rot }
  const pw = Math.max(40, W - m.l - m.r)
  const ph = Math.max(40, H - m.t - m.b)
  const band = (horiz ? ph : pw) / n
  const along = (v) => (horiz ? pw : ph) * ((v - sc.lo) / (sc.hi - sc.lo))
  const X = (v) => m.l + along(v)
  const Y = (v) => m.t + ph - along(v)
  const R = Math.min(dotSize, band * 0.4)
  const cw = Math.min(connectorWidth, band * 0.6, R * 2)
  const dirOf = (r) => (r.diff > 0 ? upColor : r.diff < 0 ? downColor : mutedColor)

  const showTip = (e, row) =>
    tooltip &&
    setTip(
      tipAt(e, wrap, row.label, [
        ...row.v.map((v, s) => ({ color: pal[s], label: sName(s), value: fmt(v) })),
        ...(S > 1 ? [{ label: 'Change', value: `${row.diff >= 0 ? '+' : ''}${fmt(row.diff)}` }] : []),
      ]),
    )

  return (
    <Card wrapRef={(el) => { wrap.current = el; boxRef.current = el }} {...{ width, background, textColor, mutedColor, size, title, subtitle, tip }}>
      {showLegend && S >= 2 && <Legend items={pal.map((c, s) => ({ name: sName(s), color: c }))} mutedColor={mutedColor} onHover={setHovS} />}
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${title}. Dot plot. ${rows.map((r) => `${r.label}: ${r.v.map((v, s) => `${sName(s)} ${fmt(v)}`).join(', ')}`).join('; ')}`}
        style={{ display: 'block', overflow: 'visible' }}
        onMouseLeave={() => { setHov(-1); setTip(null) }}
      >
        <defs>
          <pattern id={`st${uid}`} width={stripeWidth * 2} height={stripeWidth * 2} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width={stripeWidth} height={stripeWidth * 2} fill="#ffffff" opacity="0.5" />
          </pattern>
        </defs>

        {sc.ticks.map((t, k) =>
          horiz ? (
            <g key={k}>
              {showGrid && <line x1={X(t)} x2={X(t)} y1={m.t} y2={m.t + ph} stroke={gridColor} strokeWidth="2" strokeDasharray="5 7" strokeLinecap="round" />}
              {showAxis && <text x={X(t)} y={m.t + ph + size * 1.45} textAnchor="middle" fontSize={size * 0.82} fill={mutedColor} style={{ fontVariantNumeric: 'tabular-nums' }}>{tl[k]}</text>}
            </g>
          ) : (
            <g key={k}>
              {showGrid && <line x1={m.l} x2={m.l + pw} y1={Y(t)} y2={Y(t)} stroke={gridColor} strokeWidth="2" strokeDasharray="5 7" strokeLinecap="round" />}
              {showAxis && <text x={m.l - 10} y={Y(t)} dy="0.35em" textAnchor="end" fontSize={size * 0.82} fill={mutedColor} style={{ fontVariantNumeric: 'tabular-nums' }}>{tl[k]}</text>}
            </g>
          ),
        )}

        {rows.map((row, i) => {
          const k = stag(p, i, n)
          const mid = (horiz ? m.t : m.l) + i * band + band / 2
          const shown = row.v.map((v) => row.v[0] + (v - row.v[0]) * pop(k))
          const pos = (v) => (horiz ? { x: X(v), y: mid } : { x: mid, y: Y(v) })
          const lo = Math.min(...shown)
          const hi = Math.max(...shown)
          const dc = dirOf(row)
          const tint = mix(background, dc, 0.4)
          const pill = horiz ? rrect(X(lo) - cw / 2, mid - cw / 2, X(hi) - X(lo) + cw, cw, [cw / 2, cw / 2, cw / 2, cw / 2]) : rrect(mid - cw / 2, Y(hi) - cw / 2, cw, Y(lo) - Y(hi) + cw, [cw / 2, cw / 2, cw / 2, cw / 2])
          const name = row.label.length > 18 ? row.label.slice(0, 17) + '…' : row.label
          const tight = !horiz && name.length * size * 0.58 > band - 4
          const ck = pop(clamp((k - 0.5) / 0.5, 0, 1))
          const ct = chipTxt(row)
          const cx0 = horiz ? m.l + pw + 14 : mid - chipW / 2
          const cy0 = horiz ? mid - size * 0.78 : m.t - size * 2.5
          return (
            <g key={i} opacity={hov >= 0 && hov !== i ? 0.4 : 1} style={{ transition: 'opacity .2s' }}>
              {showGuides &&
                (horiz ? (
                  <line x1={m.l} x2={m.l + pw} y1={mid} y2={mid} stroke={gridColor} strokeWidth="2" strokeDasharray="1 6" strokeLinecap="round" />
                ) : (
                  <line x1={mid} x2={mid} y1={m.t} y2={m.t + ph} stroke={gridColor} strokeWidth="2" strokeDasharray="1 6" strokeLinecap="round" />
                ))}
              {connector && S > 1 && k > 0 && (
                <>
                  <path d={pill} fill={tint} />
                  {stripes && (
                    <>
                      <clipPath id={`c${uid}${i}`}><path d={pill} /></clipPath>
                      <rect x={0} y={0} width={W} height={H} fill={`url(#st${uid})`} clipPath={`url(#c${uid}${i})`} />
                    </>
                  )}
                </>
              )}
              {shown.map((v, s) => {
                const d = pos(v)
                const c = pal[s]
                const r = R * pop(clamp(k * 2, 0, 1)) * (hov === i ? 1.15 : 1)
                if (r <= 0.5) return null
                return (
                  <g key={s} opacity={hovS >= 0 && hovS !== s ? 0.4 : 1} style={{ transition: 'opacity .2s' }}>
                    {ringed ? (
                      <circle cx={d.x} cy={d.y} r={r * 0.82} fill={background} stroke={c} strokeWidth={Math.max(2.5, r * 0.42)} />
                    ) : (
                      <circle cx={d.x} cy={d.y} r={r} fill={c} stroke={background} strokeWidth="2.5" />
                    )}
                    {showValues && k > 0.6 && (
                      <text
                        x={horiz ? d.x : d.x + (s === 0 && S > 1 ? -(R + 6) : R + 6)}
                        y={horiz ? (s === 0 && S > 1 && row.diff !== 0 ? d.y + R + size * 1.05 : d.y - R - 6) : d.y}
                        dy={horiz ? 0 : '0.35em'}
                        textAnchor={horiz ? 'middle' : s === 0 && S > 1 ? 'end' : 'start'}
                        fontSize={size * 0.82}
                        fontWeight="700"
                        fill={textColor}
                        style={{ pointerEvents: 'none', fontVariantNumeric: 'tabular-nums' }}
                      >
                        {fmt(row.v[s])}
                      </text>
                    )}
                  </g>
                )
              })}
              {horiz ? (
                <text x={m.l - 12} y={mid} dy="0.35em" textAnchor="end" fontSize={size * 0.92} fontWeight="600" fill={hov === i ? textColor : mutedColor} style={{ pointerEvents: 'none' }}>{name}</text>
              ) : (
                <text x={mid} y={m.t + ph + size * 1.5} textAnchor={tight ? 'end' : 'middle'} transform={tight ? `rotate(-35 ${mid} ${m.t + ph + size * 1.5})` : undefined} fontSize={size * 0.9} fontWeight="600" fill={hov === i ? textColor : mutedColor} style={{ pointerEvents: 'none' }}>{name}</text>
              )}
              {chip && ck > 0 && (
                <g style={{ pointerEvents: 'none' }} transform={`translate(${cx0 + chipW / 2} ${cy0 + size * 0.78}) scale(${ck}) translate(${-(cx0 + chipW / 2)} ${-(cy0 + size * 0.78)})`}>
                  <path d={rrect(cx0, cy0, chipW, size * 1.56, [size * 0.78, size * 0.78, size * 0.78, size * 0.78])} fill={dc} />
                  <text x={cx0 + chipW / 2} y={cy0 + size * 0.78} dy="0.36em" textAnchor="middle" fontSize={size * 0.84} fontWeight="800" fill={inkOn(dc, textColor)} style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {ct}
                  </text>
                </g>
              )}
            </g>
          )
        })}

        {rows.map((row, i) => (
          <rect
            key={`h${i}`}
            x={horiz ? 0 : m.l + i * band}
            y={horiz ? m.t + i * band : m.t - (chip ? size * 2.6 : 0)}
            width={horiz ? W : band}
            height={horiz ? band : ph + (chip ? size * 2.6 : 0)}
            fill="transparent"
            onMouseEnter={(e) => { setHov(i); showTip(e, row) }}
            onMouseMove={(e) => tooltip && setTip((t) => (t ? { ...t, ...tipAt(e, wrap, t.title, t.rows) } : t))}
          />
        ))}
      </svg>
    </Card>
  )
}
