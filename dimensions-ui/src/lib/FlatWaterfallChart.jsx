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

// Flat infographic waterfall: how a total is built up by additions and subtractions.
// Each step is "Label:value"; write "Label:=" for a subtotal bar showing the running
// total so far. Rises, falls and totals get their own flat colours, totals carry a
// diagonal stripe band, dashed connectors carry the level across, and each bar pops
// out from the previous level. Hover shows the change and the running total.
export default function FlatWaterfallChart({
  data = 'Revenue:4200, Cost of sales:-1650, Gross profit:=, Marketing:-620, R&D:-540, Admin:-310, Other income:140, Operating profit:=, Tax:-280, Net income:=',
  title = 'From revenue to net income',
  subtitle = 'USD thousands, fiscal year',
  orientation = 'vertical',
  barRadius = 8,
  gap = 0.28,
  stripes = true,
  stripeWidth = 5,
  connectors = true,
  showValues = true,
  showGrid = true,
  showAxis = true,
  axisArrows = true,
  tooltip = true,
  animate = true,
  duration = 1400,
  decimals = 0,
  prefix = '$',
  suffix = 'k',
  width = 760,
  height = 320,
  size = 13,
  upColor = '#14a89e',
  downColor = '#ef5b7f',
  totalColor = '#4a7fe8',
  background = '#ffffff',
  gridColor = '#eef0f6',
  textColor = '#2b2f3a',
  mutedColor = '#8a90a0',
}) {
  const uid = useId().replace(/:/g, '')
  const wrap = useRef(null)
  const [boxRef, boxW] = useWidth()
  const fmt = makeFmt({ decimals, prefix, suffix })
  const steps = useMemo(() => {
    let run = 0
    const src = Array.isArray(data) ? data.map((d) => `${d.label}:${d.value}`) : String(data ?? '').split(/[,;\n]/)
    return src
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s, i) => {
        const k = s.lastIndexOf(':')
        const label = k < 0 ? s : s.slice(0, k).trim()
        const raw = k < 0 ? '0' : s.slice(k + 1).trim()
        if (raw === '=') return { label, total: true, from: 0, to: run, v: run }
        const v = num(raw)
        if (i === 0 && !raw.startsWith('-') && !raw.startsWith('+')) {
          run = v
          return { label, total: true, from: 0, to: v, v }
        }
        const from = run
        run += v
        return { label, total: false, from, to: run, v }
      })
  }, [data])
  const n = steps.length
  const p = useReveal(animate, duration, `${data}|${orientation}`)
  const [hov, setHov] = useState(-1)
  const [hovK, setHovK] = useState(-1)
  const [tip, setTip] = useState(null)

  const horiz = orientation === 'horizontal'
  const lo = Math.min(0, ...steps.map((s) => Math.min(s.from, s.to)))
  const hi = Math.max(0, ...steps.map((s) => Math.max(s.from, s.to)))
  const sc = niceScale(lo, hi * (horiz ? 1 : 1.08), 5)
  const W = Math.max(280, (boxW || width) - size * 3)
  const H = horiz ? Math.max(height, n * 32 + 40) : height
  const maxLab = Math.min(18, Math.max(1, ...steps.map((s) => s.label.length)))
  const tickW = Math.max(...sc.ticks.map((t) => fmt(t).length)) * size * 0.82 * 0.6 + 14
  const m = horiz
    ? { l: maxLab * size * 0.88 * 0.6 + 16, r: size * 4.6, t: 4, b: showAxis ? size * 2.2 : 8 }
    : { l: showAxis ? tickW : 6, r: axisArrows ? 16 : 8, t: size * 2, b: size * 3 }
  const pw = Math.max(80, W - m.l - m.r)
  const ph = Math.max(60, H - m.t - m.b)
  const band = (horiz ? ph : pw) / Math.max(1, n)
  const bw = band * (1 - clamp(gap, 0.05, 0.8))
  const V = (v) => (horiz ? m.l + ((v - sc.lo) / (sc.hi - sc.lo)) * pw : m.t + ph - ((v - sc.lo) / (sc.hi - sc.lo)) * ph)
  const kindOf = (s) => (s.total ? 2 : s.to >= s.from ? 0 : 1)
  const kcol = [upColor, downColor, totalColor]
  const sign = (v) => (v >= 0 ? '+' : '−')
  const labOf = (s) => (s.total ? fmt(s.to) : `${sign(s.v)}${fmt(Math.abs(s.v))}`)
  // value labels shrink a little when the columns get narrow so neighbours don't touch
  const longest = Math.max(1, ...steps.map((s) => labOf(s).length))
  const fsV = horiz ? size * 0.95 : clamp((band - 6) / (longest * 0.6), size * 0.7, size * 0.95)

  return (
    <Card wrapRef={(el) => { wrap.current = el; boxRef.current = el }} {...{ width, background, textColor, mutedColor, size, title, subtitle, tip }}>
      <Legend items={[{ name: 'Increase', color: upColor }, { name: 'Decrease', color: downColor }, { name: 'Total', color: totalColor }]} mutedColor={mutedColor} onHover={setHovK} />
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${title}. Waterfall chart. ${steps.map((s) => `${s.label}: ${s.total ? `total ${fmt(s.to)}` : `${s.v >= 0 ? 'plus' : 'minus'} ${fmt(Math.abs(s.v))}`}`).join('; ')}`}
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
        </defs>

        {sc.ticks.map((t, i) => (
          <g key={i}>
            {showGrid && t !== 0 &&
              (horiz ? (
                <line x1={V(t)} x2={V(t)} y1={m.t} y2={m.t + ph} stroke={gridColor} strokeWidth="2" strokeDasharray="5 7" strokeLinecap="round" />
              ) : (
                <line x1={m.l} x2={m.l + pw} y1={V(t)} y2={V(t)} stroke={gridColor} strokeWidth="2" strokeDasharray="5 7" strokeLinecap="round" />
              ))}
            {showAxis &&
              (horiz ? (
                <text x={V(t)} y={m.t + ph + size * 1.5} textAnchor="middle" fontSize={size * 0.82} fill={mutedColor} style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(t)}</text>
              ) : (
                <text x={m.l - 10} y={V(t)} dy="0.35em" textAnchor="end" fontSize={size * 0.82} fill={mutedColor} style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(t)}</text>
              ))}
          </g>
        ))}

        {steps.map((s, i) => {
          const k = pop(stag(p, i, n))
          const end = s.from + (s.to - s.from) * k
          const a = V(Math.min(s.from, end))
          const b = V(Math.max(s.from, end))
          const pos = (horiz ? m.t : m.l) + i * band + (band - bw) / 2
          const kind = kindOf(s)
          const c = kcol[kind]
          const r = Math.min(barRadius, bw / 2)
          const rect = horiz ? { x: a, y: pos, w: Math.max(0, b - a), h: bw } : { x: pos, y: b, w: bw, h: Math.max(0, a - b) }
          const d = rrect(rect.x, rect.y, rect.w, rect.h, [r, r, r, r])
          const next = steps[i + 1]
          const lab = labOf(s)
          const dim = (hov >= 0 && hov !== i) || (hovK >= 0 && hovK !== kind)
          // stripe band at the growing end of total bars
          const up = s.to >= s.from
          const sb = horiz
            ? { x: up ? rect.x + rect.w * 0.72 : rect.x, y: rect.y, w: rect.w * 0.28, h: rect.h }
            : { x: rect.x, y: up ? rect.y : rect.y + rect.h * 0.72, w: rect.w, h: rect.h * 0.28 }
          const words = s.label.split(' ')
          const lines = !horiz && s.label.length * size * 0.8 * 0.58 > band && words.length > 1 ? [words.slice(0, Math.ceil(words.length / 2)).join(' '), words.slice(Math.ceil(words.length / 2)).join(' ')] : [s.label]
          const vt = clamp((p - 0.15) / 0.3, 0, 1) * clamp(k * 1.5 - 0.3, 0, 1)
          return (
            <g
              key={i}
              opacity={dim ? 0.4 : 1}
              style={{ transition: 'opacity .2s' }}
              onMouseEnter={(e) => {
                setHov(i)
                tooltip && setTip(tipAt(e, wrap, s.label, [{ color: c, label: s.total ? 'Total' : 'Change', value: lab }, { label: 'Running total', value: fmt(s.to) }]))
              }}
              onMouseMove={(e) => tooltip && setTip((t) => (t ? { ...t, ...tipAt(e, wrap, t.title, t.rows) } : t))}
            >
              <rect x={horiz ? m.l : pos - (band - bw) / 2} y={horiz ? pos - (band - bw) / 2 : m.t} width={horiz ? pw : band} height={horiz ? band : ph} fill="transparent" />
              <path d={d} fill={c} />
              {stripes && s.total && rect.w > 2 && rect.h > 2 && (
                <>
                  <clipPath id={`c${uid}${i}`}><path d={d} /></clipPath>
                  <g clipPath={`url(#c${uid}${i})`} style={{ pointerEvents: 'none' }}>
                    <rect x={sb.x} y={sb.y} width={sb.w} height={sb.h} fill={mix(c, '#000000', 0.12)} />
                    <rect x={sb.x} y={sb.y} width={sb.w} height={sb.h} fill={`url(#st${uid})`} />
                  </g>
                </>
              )}
              {connectors && next && k >= 0.98 && (() => {
                const y = V(s.to)
                return horiz ? (
                  <line x1={y} x2={y} y1={pos + bw} y2={pos + band} stroke={mutedColor} strokeWidth="2" strokeDasharray="2 4" strokeLinecap="round" />
                ) : (
                  <line x1={pos + bw} x2={pos + band} y1={y} y2={y} stroke={mutedColor} strokeWidth="2" strokeDasharray="2 4" strokeLinecap="round" />
                )
              })()}
              {showValues && vt > 0 &&
                (horiz ? (
                  <text x={Math.max(V(s.from), V(s.to)) + 8} y={pos + bw / 2} dy="0.35em" fontSize={fsV} fontWeight="800" fill={textColor} opacity={vt} style={{ fontVariantNumeric: 'tabular-nums', pointerEvents: 'none' }}>{lab}</text>
                ) : (
                  <text x={pos + bw / 2} y={Math.min(V(s.from), V(s.to)) - 8} textAnchor="middle" fontSize={fsV} fontWeight="800" fill={textColor} opacity={vt} style={{ fontVariantNumeric: 'tabular-nums', pointerEvents: 'none' }}>{lab}</text>
                ))}
              {horiz ? (
                <text x={m.l - 10} y={pos + bw / 2} dy="0.35em" textAnchor="end" fontSize={size * 0.88} fontWeight={s.total ? 800 : 600} fill={s.total || hov === i ? textColor : mutedColor} style={{ pointerEvents: 'none' }}>{s.label}</text>
              ) : (
                lines.map((ln, li) => (
                  <text key={li} x={pos + bw / 2} y={m.t + ph + size * (1.45 + li * 1.1)} textAnchor="middle" fontSize={size * 0.8} fontWeight={s.total ? 800 : 600} fill={s.total || hov === i ? textColor : mutedColor} style={{ pointerEvents: 'none' }}>{ln}</text>
                ))
              )}
            </g>
          )
        })}

        {showAxis && (
          <g stroke={mutedColor} strokeWidth="2" strokeLinecap="round" fill="none" style={{ pointerEvents: 'none' }}>
            {horiz ? (
              <>
                <path d={`M${V(0)},${m.t + ph}V${m.t - 2}`} />
                <path d={`M${m.l},${m.t + ph}H${m.l + pw + 10}`} markerEnd={axisArrows ? `url(#ar${uid})` : undefined} />
              </>
            ) : (
              <>
                <path d={`M${m.l},${V(0)}H${m.l + pw + (axisArrows ? 10 : 0)}`} markerEnd={axisArrows ? `url(#ar${uid})` : undefined} />
                <path d={`M${m.l},${m.t + ph}V${m.t - size}`} markerEnd={axisArrows ? `url(#ar${uid})` : undefined} />
              </>
            )}
          </g>
        )}
      </svg>
    </Card>
  )
}
