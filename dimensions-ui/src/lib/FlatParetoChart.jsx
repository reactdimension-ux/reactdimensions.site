import { useEffect, useId, useMemo, useRef, useState } from 'react'

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
// white or dark ink, whichever reads better on a filled colour
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

// Flat infographic Pareto chart: causes sorted from most to least common as chunky
// bars, with a thick line for the running share of the total on a second axis. The
// "vital few" that reach the `threshold` (80% by default) are solid and striped; the
// rest drop back to a pale tint. Bars pop up in turn, then the line draws across.
// Entries are "Cause:count".
export default function FlatParetoChart({
  data = 'Late delivery:142, Damaged item:96, Wrong size:71, Missing parts:38, Billing error:27, Rude support:18, Website bug:14, Other:9',
  title = 'Why customers complain',
  subtitle = '415 complaints last quarter',
  threshold = 80,
  showThreshold = true,
  highlight = true,
  showValues = true,
  showGrid = true,
  showAxis = true,
  barRadius = 10,
  gap = 0.25,
  stripes = true,
  stripeWidth = 5,
  lineWidth = 4,
  markerSize = 6,
  tooltip = true,
  animate = true,
  duration = 1400,
  decimals = 0,
  prefix = '',
  suffix = '',
  width = 720,
  height = 300,
  size = 13,
  color = '#4a7fe8',
  lineColor = '#f08a24',
  restColor = '#c9cfdd',
  background = '#ffffff',
  gridColor = '#eef0f6',
  textColor = '#2b2f3a',
  mutedColor = '#8a90a0',
}) {
  const uid = useId().replace(/:/g, '')
  const wrap = useRef(null)
  const [boxRef, boxW] = useWidth()
  const fmt = makeFmt({ decimals, prefix, suffix })
  const rows = useMemo(() => {
    const r = parseRows(data).map((x) => ({ label: x.label, v: Math.max(0, x.value) })).sort((a, b) => b.v - a.v)
    const tot = r.reduce((a, x) => a + x.v, 0) || 1
    let acc = 0
    return r.map((x) => {
      acc += x.v
      return { ...x, cum: (acc / tot) * 100, share: (x.v / tot) * 100 }
    })
  }, [data])
  const n = rows.length
  const cut = rows.findIndex((r) => r.cum >= threshold - 1e-9)
  const vital = (i) => !highlight || i <= (cut < 0 ? n - 1 : cut)
  const p = useReveal(animate, duration, `${data}|${threshold}`)
  const [hov, setHov] = useState(-1)
  const [hovK, setHovK] = useState(-1)
  const [tip, setTip] = useState(null)

  const sc = niceScale(0, Math.max(1, ...rows.map((r) => r.v)) * 1.08, 4)
  const W = Math.max(280, (boxW || width) - size * 3)
  const H = height
  const tickW = Math.max(...sc.ticks.map((t) => fmt(t).length)) * size * 0.82 * 0.6 + 14
  const m = { l: tickW, r: size * 3.2, t: size * 1.6, b: size * 3 }
  const pw = Math.max(80, W - m.l - m.r)
  const ph = Math.max(60, H - m.t - m.b)
  const band = pw / Math.max(1, n)
  const bw = band * (1 - clamp(gap, 0.05, 0.8))
  const Y = (v) => m.t + ph - (v / sc.hi) * ph
  const Yp = (pc) => m.t + ph - (pc / 100) * ph
  const X = (i) => m.l + i * band + band / 2
  const line = rows.map((r, i) => [X(i), Yp(r.cum)])
  const lp = ease(clamp((p - 0.35) / 0.55, 0, 1))
  const mk = (i) => pop(clamp((p - 0.35 - (n > 1 ? (0.55 * i) / (n - 1) : 0)) / 0.15, 0, 1))
  const rad = Math.min(barRadius, bw / 2)
  const lw = Math.max(1, lineWidth)
  const ms = Math.max(0, markerSize)
  const legend = highlight
    ? [{ name: `Vital few (to ${threshold}%)`, color }, { name: 'The rest', color: restColor }, { name: 'Cumulative %', color: lineColor }]
    : [{ name: 'Count', color }, { name: 'Cumulative %', color: lineColor }]
  const dimBar = (i) => (hov >= 0 && hov !== i) || (hovK >= 0 && (highlight ? (hovK === 0 ? !vital(i) : hovK === 1 ? vital(i) : true) : hovK !== 0))
  const lineDim = hovK >= 0 && hovK !== legend.length - 1

  return (
    <Card wrapRef={(el) => { wrap.current = el; boxRef.current = el }} {...{ width, background, textColor, mutedColor, size, title, subtitle, tip }}>
      <Legend items={legend} mutedColor={mutedColor} onHover={setHovK} />
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${title}. Pareto chart. ${rows.map((r) => `${r.label}: ${fmt(r.v)}, cumulative ${Math.round(r.cum)} percent`).join('; ')}`}
        style={{ display: 'block', overflow: 'visible' }}
        onMouseLeave={() => { setHov(-1); setTip(null) }}
      >
        <defs>
          <pattern id={`st${uid}`} width={stripeWidth * 2} height={stripeWidth * 2} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width={stripeWidth} height={stripeWidth * 2} fill="#ffffff" opacity="0.35" />
          </pattern>
          <marker id={`ar${uid}`} viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,1 L9,5 L0,9 Z" fill={mutedColor} />
          </marker>
          <clipPath id={`rv${uid}`}>
            <rect x={0} y={-H} width={m.l + band / 2 + (pw - band) * lp + 1} height={H * 3} />
          </clipPath>
        </defs>

        {sc.ticks.map((t) => (
          <g key={t}>
            {showGrid && t !== 0 && <line x1={m.l} x2={m.l + pw} y1={Y(t)} y2={Y(t)} stroke={gridColor} strokeWidth="2" strokeDasharray="5 7" strokeLinecap="round" />}
            {showAxis && <text x={m.l - 10} y={Y(t)} dy="0.35em" textAnchor="end" fontSize={size * 0.82} fill={mutedColor} style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(t)}</text>}
          </g>
        ))}
        {showAxis && [0, 25, 50, 75, 100].map((pc) => <text key={pc} x={m.l + pw + 10} y={Yp(pc)} dy="0.35em" fontSize={size * 0.82} fill={mutedColor}>{pc}%</text>)}

        {rows.map((r, i) => {
          const k = pop(stag(p, i, n))
          const x = m.l + i * band + (band - bw) / 2
          const v = vital(i)
          const c = v ? color : restColor
          const h = Math.max(0, Y(0) - Y(r.v * k))
          const d = rrect(x, Y(0) - h, bw, h, [rad, rad, 0, 0])
          const words = r.label.split(' ')
          const lines = r.label.length * size * 0.78 * 0.58 > band && words.length > 1 ? [words.slice(0, Math.ceil(words.length / 2)).join(' '), words.slice(Math.ceil(words.length / 2)).join(' ')] : [r.label]
          // the value goes inside the bar top when the cumulative line would sit on it
          const above = Y(r.v) - 8
          const clash = Math.abs(above - size * 0.4 - Yp(r.cum)) < size * 1.3 + ms
          const inside = clash && h > size * 2.4
          return (
            <g
              key={i}
              opacity={dimBar(i) ? 0.4 : 1}
              style={{ transition: 'opacity .2s' }}
              onMouseEnter={(e) => {
                setHov(i)
                tooltip && setTip(tipAt(e, wrap, r.label, [{ color: c, label: 'Count', value: fmt(r.v) }, { label: 'Share', value: `${r.share.toFixed(1)}%` }, { color: lineColor, label: 'Cumulative', value: `${r.cum.toFixed(1)}%` }]))
              }}
              onMouseMove={(e) => tooltip && setTip((t) => (t ? { ...t, ...tipAt(e, wrap, t.title, t.rows) } : t))}
            >
              <rect x={m.l + i * band} y={m.t} width={band} height={ph + size * 2.6} fill="transparent" />
              <path d={d} fill={c} />
              {stripes && v && highlight && h > 2 && (
                <>
                  <clipPath id={`c${uid}${i}`}><path d={d} /></clipPath>
                  <g clipPath={`url(#c${uid}${i})`} style={{ pointerEvents: 'none' }}>
                    <rect x={x} y={Y(0) - h} width={bw} height={h * 0.28} fill={mix(c, '#000000', 0.12)} />
                    <rect x={x} y={Y(0) - h} width={bw} height={h * 0.28} fill={`url(#st${uid})`} />
                  </g>
                </>
              )}
              {showValues && p > 0.15 && (
                <text
                  x={x + bw / 2}
                  y={inside ? Y(r.v * k) + h * 0.14 : Y(r.v * k) - 8}
                  dy={inside ? '0.35em' : 0}
                  textAnchor="middle"
                  fontSize={size * 0.95}
                  fontWeight="800"
                  fill={inside ? inkOn(mix(c, '#000000', 0.12), textColor) : v ? textColor : mutedColor}
                  style={{ fontVariantNumeric: 'tabular-nums', pointerEvents: 'none' }}
                >
                  {fmt(r.v * ease(stag(p, i, n)))}
                </text>
              )}
              {lines.map((ln, li) => (
                <text key={li} x={x + bw / 2} y={m.t + ph + size * (1.45 + li * 1.1)} textAnchor="middle" fontSize={size * 0.78} fontWeight="600" fill={hov === i ? textColor : mutedColor} style={{ pointerEvents: 'none' }}>
                  {ln}
                </text>
              ))}
            </g>
          )
        })}

        {showThreshold && cut >= 0 && (
          <g style={{ pointerEvents: 'none' }} opacity={clamp((p - 0.6) * 3, 0, 1)}>
            <line x1={m.l} x2={m.l + pw} y1={Yp(threshold)} y2={Yp(threshold)} stroke={mutedColor} strokeWidth="2" strokeDasharray="6 6" strokeLinecap="round" />
            <line x1={m.l + (cut + 1) * band} x2={m.l + (cut + 1) * band} y1={Yp(threshold)} y2={m.t + ph} stroke={mutedColor} strokeWidth="2" strokeDasharray="2 5" strokeLinecap="round" />
            {(() => {
              const t = `${threshold}%`
              const tw = t.length * size * 0.75 * 0.62 + size * 1.1
              const tx = m.l + pw - tw - 4
              return (
                <>
                  <rect x={tx} y={Yp(threshold) - size * 0.75} width={tw} height={size * 1.5} rx={size * 0.75} fill={mutedColor} />
                  <text x={tx + tw / 2} y={Yp(threshold)} dy="0.35em" textAnchor="middle" fontSize={size * 0.75} fontWeight="800" fill={inkOn(mutedColor, textColor)}>{t}</text>
                </>
              )
            })()}
          </g>
        )}

        <g clipPath={`url(#rv${uid})`} style={{ pointerEvents: 'none', transition: 'opacity .2s' }} opacity={lineDim ? 0.4 : 1}>
          <path d={'M' + line.map((q) => q.join(',')).join('L')} fill="none" stroke={lineColor} strokeWidth={lw} strokeLinejoin="round" strokeLinecap="round" />
        </g>
        <g style={{ pointerEvents: 'none', transition: 'opacity .2s' }} opacity={lineDim ? 0.4 : 1}>
          {line.map(([x, y], i) => {
            const k = mk(i)
            return k > 0 ? <circle key={i} cx={x} cy={y} r={Math.max(0, ms * k * (hov === i ? 1.3 : 1))} fill={background} stroke={lineColor} strokeWidth={Math.max(3, lw * 0.85)} /> : null
          })}
          {hov >= 0 && (
            <text x={line[hov][0]} y={line[hov][1] - ms - 9} textAnchor="middle" fontSize={size * 0.9} fontWeight="800" fill={textColor} stroke={background} strokeWidth="4" paintOrder="stroke">
              {`${rows[hov].cum.toFixed(0)}%`}
            </text>
          )}
        </g>

        {showAxis && (
          <g stroke={mutedColor} strokeWidth="2" strokeLinecap="round" fill="none" style={{ pointerEvents: 'none' }}>
            <path d={`M${m.l},${Y(0)}H${m.l + pw}`} />
            <path d={`M${m.l},${Y(0)}V${m.t - size * 0.8}`} markerEnd={`url(#ar${uid})`} />
            <path d={`M${m.l + pw},${Y(0)}V${m.t - size * 0.8}`} markerEnd={`url(#ar${uid})`} />
          </g>
        )}
      </svg>
    </Card>
  )
}
