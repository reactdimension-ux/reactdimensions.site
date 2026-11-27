import { useEffect, useMemo, useRef, useState } from 'react'

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

// Multi-value rows: "Python:28|31" -> { label: 'Python', values: [28, 31] }
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
// white or dark text, whichever reads better on a filled shape
function inkOn(c, dark) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(String(c).slice(i, i + 2), 16) || 0)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.66 ? dark : '#ffffff'
}

// Flat infographic slope chart: each item's value at two moments joined by a thick
// rounded line between two chunky posts. Lines are coloured by direction (or one
// colour, or the palette); the end value sits in a solid badge, the start value in a
// soft one, and labels are spaced so they never collide. Listing names in
// `highlight` (or hovering) brings those lines forward. Lines draw across, end dots pop.
export default function FlatSlopeChart({
  data = 'Python:28|31, JavaScript:24|21, TypeScript:9|17, Java:14|10, C#:8|8, Go:4|7, Rust:2|6, PHP:7|4, Ruby:4|2',
  startLabel = '2021',
  endLabel = '2025',
  title = 'Language popularity',
  subtitle = 'Share of new projects, %',
  colorMode = 'direction',
  highlight = '',
  strokeWidth = 4,
  dotSize = 6,
  showValues = true,
  zeroBased = false,
  tooltip = true,
  animate = true,
  duration = 1400,
  decimals = 0,
  prefix = '',
  suffix = '%',
  width = 560,
  height = 340,
  size = 13,
  color = '#4a7fe8',
  color2 = '#ef5b7f',
  color3 = '#14a89e',
  color4 = '#f08a24',
  color5 = '#8e5fd6',
  color6 = '#c49a12',
  upColor = '#14a89e',
  downColor = '#ef5b7f',
  flatColor = '#8a90a0',
  background = '#ffffff',
  trackColor = '#eef0f6',
  textColor = '#2b2f3a',
  mutedColor = '#8a90a0',
}) {
  const wrap = useRef(null)
  const [boxRef, boxW] = useWidth()
  const fmt = makeFmt({ decimals, prefix, suffix })
  const rows = useMemo(() => parseMulti(data).map((r) => ({ label: r.label, a: r.values[0] ?? 0, b: r.values[1] ?? r.values[0] ?? 0 })), [data])
  const hl = new Set(String(highlight ?? '').split(',').map((s) => s.trim()).filter(Boolean))
  const p = useReveal(animate, duration, data)
  const [hov, setHov] = useState(-1)
  const [tip, setTip] = useState(null)

  const n = Math.max(1, rows.length)
  const all = rows.flatMap((r) => [r.a, r.b])
  const lo = zeroBased ? Math.min(0, ...all) : Math.min(...all)
  const hi = Math.max(...all)
  const W = Math.max(280, (boxW || width) - size * 3)
  const H = height
  const lab = (s) => (s.length > 16 ? s.slice(0, 15) + '…' : s)
  const maxLab = Math.min(16, Math.max(1, ...rows.map((r) => r.label.length)))
  const fs = size * 0.86
  const pillW = showValues ? Math.max(...rows.flatMap((r) => [fmt(r.a).length, fmt(r.b).length])) * fs * 0.6 + size * 1.1 : 0
  const pillH = size * 1.32
  const gapL = dotSize + 10
  const side = maxLab * fs * 0.6 + (showValues ? pillW + 8 : 0) + gapL + 4
  const m = { l: side, r: side, t: size * 2.8, b: 12 }
  const ph = Math.max(40, H - m.t - m.b)
  const x0 = m.l
  const x1 = W - m.r
  const Y = (v) => m.t + ph - ((v - lo) / (hi - lo || 1)) * ph
  const pal = [color, color2, color3, color4, color5, color6]
  const colorOf = (r, i) => (colorMode === 'single' ? color : colorMode === 'palette' ? pal[i % pal.length] : r.b > r.a ? upColor : r.b < r.a ? downColor : flatColor)
  // spread labels on each side so they never overlap
  const pr = pillH / 2
  const step = Math.max(size * 1.15, pillH + 3)
  // push labels apart downwards, then pull the overflow back up from the bottom edge,
  // then make sure nothing rides up into the header badges
  const spread = (key) => {
    const L = rows.map((r, i) => ({ i, y: Y(r[key]) })).sort((a, b) => a.y - b.y)
    const last = L.length - 1
    for (let k = 1; k <= last; k++) L[k].y = Math.max(L[k].y, L[k - 1].y + step)
    for (let k = last; k >= 0; k--) L[k].y = Math.min(L[k].y, k === last ? H - pr : L[k + 1].y - step)
    for (let k = 0; k <= last; k++) L[k].y = Math.max(L[k].y, k === 0 ? size * 1.7 + pr + 6 : L[k - 1].y + step)
    return Object.fromEntries(L.map((l) => [l.i, l.y]))
  }
  const ya = spread('a')
  const yb = spread('b')
  const focus = (i) => hov === i || (hov < 0 && (hl.size === 0 || hl.has(rows[i].label)))
  const order = rows.map((_, i) => i).sort((a, b) => Number(focus(a)) - Number(focus(b)))
  const head = (x, txt) => {
    const w = txt.length * size * 0.62 + size * 1.4
    return (
      <g style={{ pointerEvents: 'none' }}>
        <path d={rrect(x - w / 2, 0, w, size * 1.7, [size * 0.85, size * 0.85, size * 0.85, size * 0.85])} fill={textColor} />
        <text x={x} y={size * 0.85} dy="0.36em" textAnchor="middle" fontSize={size * 0.9} fontWeight="800" fill={background}>{txt}</text>
      </g>
    )
  }

  return (
    <Card wrapRef={(el) => { wrap.current = el; boxRef.current = el }} {...{ width, background, textColor, mutedColor, size, title, subtitle, tip }}>
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${title}. Slope chart from ${startLabel} to ${endLabel}. ${rows.map((r) => `${r.label}: ${fmt(r.a)} to ${fmt(r.b)}`).join('; ')}`}
        style={{ display: 'block', overflow: 'visible' }}
        onMouseLeave={() => { setHov(-1); setTip(null) }}
      >
        {/* two chunky posts */}
        <path d={rrect(x0 - 5, m.t - 10, 10, ph + 20, [5, 5, 5, 5])} fill={trackColor} />
        <path d={rrect(x1 - 5, m.t - 10, 10, ph + 20, [5, 5, 5, 5])} fill={trackColor} />
        {head(x0, startLabel)}
        {head(x1, endLabel)}

        {order.map((i) => {
          const r = rows[i]
          const c = colorOf(r, i)
          const f = focus(i)
          const k = stag(p, i, n)
          const lk = ease(k)
          const xe = x0 + (x1 - x0) * lk
          const ye = Y(r.a + (r.b - r.a) * lk)
          const ek = pop(clamp((k - 0.75) / 0.25, 0, 1))
          const sk = pop(clamp(k * 3, 0, 1))
          const ch = r.a ? ((r.b - r.a) / Math.abs(r.a)) * 100 : 0
          const lw = hov === i ? strokeWidth * 1.35 : strokeWidth
          // left: "Label [value]" ending at the post; right: "[value] Label"
          const lpx = x0 - gapL - pillW
          const rpx = x1 + gapL
          return (
            <g
              key={i}
              opacity={f ? 1 : 0.4}
              style={{ transition: 'opacity .2s' }}
              onMouseEnter={(e) => {
                setHov(i)
                tooltip && setTip(tipAt(e, wrap, r.label, [
                  { label: startLabel, value: fmt(r.a) },
                  { color: c, label: endLabel, value: fmt(r.b) },
                  { label: 'Change', value: `${r.b - r.a >= 0 ? '+' : '−'}${fmt(Math.abs(r.b - r.a))} (${ch >= 0 ? '+' : ''}${ch.toFixed(0)}%)` },
                ]))
              }}
              onMouseMove={(e) => tooltip && setTip((t) => (t ? { ...t, ...tipAt(e, wrap, t.title, t.rows) } : t))}
            >
              <line x1={x0} y1={Y(r.a)} x2={x1} y2={Y(r.b)} stroke="transparent" strokeWidth="16" />
              {k > 0 && <line x1={x0} y1={Y(r.a)} x2={xe} y2={ye} stroke={c} strokeWidth={lw} strokeLinecap="round" />}
              {sk > 0 && <circle cx={x0} cy={Y(r.a)} r={dotSize * sk} fill={background} stroke={c} strokeWidth="3" />}
              {ek > 0 && (
                <>
                  <circle cx={x1} cy={Y(r.b)} r={dotSize * 1.2 * ek} fill={c} />
                  <circle cx={x1} cy={Y(r.b)} r={dotSize * 0.42 * ek} fill={background} />
                </>
              )}
              <g opacity={sk} style={{ pointerEvents: 'none' }}>
                {showValues && (
                  <>
                    <path d={rrect(lpx, ya[i] - pr, pillW, pillH, [pr, pr, pr, pr])} fill={trackColor} />
                    <text x={lpx + pillW / 2} y={ya[i]} dy="0.36em" textAnchor="middle" fontSize={fs} fontWeight="700" fill={textColor} style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(r.a)}</text>
                  </>
                )}
                <text x={(showValues ? lpx - 8 : x0 - gapL)} y={ya[i]} dy="0.35em" textAnchor="end" fontSize={fs} fontWeight="600" fill={f ? textColor : mutedColor}>{lab(r.label)}</text>
              </g>
              <g opacity={clamp(ek * 1.2, 0, 1)} style={{ pointerEvents: 'none' }}>
                {showValues && (
                  <>
                    <path d={rrect(rpx, yb[i] - pr, pillW, pillH, [pr, pr, pr, pr])} fill={c} />
                    <text x={rpx + pillW / 2} y={yb[i]} dy="0.36em" textAnchor="middle" fontSize={fs} fontWeight="800" fill={inkOn(c, textColor)} style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(r.b)}</text>
                  </>
                )}
                <text x={showValues ? rpx + pillW + 8 : x1 + gapL} y={yb[i]} dy="0.35em" fontSize={fs} fontWeight="600" fill={f ? textColor : mutedColor}>{lab(r.label)}</text>
              </g>
            </g>
          )
        })}
      </svg>
    </Card>
  )
}
