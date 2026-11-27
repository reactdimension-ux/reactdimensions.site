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

// "Question:v|v|v, ..." -> [{ label, values: [..] }]
function parseMulti(data) {
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
// text colour for a label sitting on a filled shape: dark ink on light fills, white otherwise
function inkOn(c, dark) {
  const [r, g, b] = [1, 3, 5].map((i) => (parseInt(String(c).slice(i, i + 2), 16) || 0) / 255)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.62 ? dark : '#ffffff'
}
function Legend({ items, mutedColor, onHover }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4em 1.2em', marginBottom: '0.9em', color: mutedColor, fontSize: '0.88em', fontWeight: 600 }}>
      {items.map((it, i) => (
        <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45em', cursor: 'default' }} onMouseEnter={() => onHover?.(i)} onMouseLeave={() => onHover?.(-1)}>
          <i style={{ width: '0.75em', height: '0.75em', borderRadius: '50%', background: it.color, flex: 'none' }} />
          {it.name}
        </span>
      ))}
    </div>
  )
}

// Flat infographic share bars: each row is one chunky rounded bar split into its parts.
// `diverging` centres the neutral middle answer on a zero line, negatives to the left
// and positives to the right (a Likert chart), with the positive share called out at
// the end of each row; `stacked` fills each row to 100%. The strongest answer carries a
// diagonal stripe band. Rows are "Question:v|v|v|v|v"; `segments` names the parts.
export default function FlatShareBar({
  data = 'Onboarding was easy:4|9|14|41|32, Docs answer my questions:8|17|22|36|17, Pricing is clear:15|24|20|29|12, I would recommend it:3|6|11|38|42, Support is fast:6|12|25|35|22',
  segments = 'Strongly disagree, Disagree, Neutral, Agree, Strongly agree',
  title = 'Customer survey',
  subtitle = 'Share of 2,310 responses',
  mode = 'diverging',
  negLabel = 'Disagree',
  posLabel = 'Agree',
  sort = 'none',
  barHeight = 30,
  gap = 3,
  radius = 10,
  showLabels = true,
  showTotals = true,
  showTrack = true,
  showLegend = true,
  stripes = true,
  stripeWidth = 4,
  tooltip = true,
  animate = true,
  duration = 1200,
  decimals = 0,
  width = 720,
  size = 13,
  negColor = '#ef5b7f',
  posColor = '#14a89e',
  neutralColor = '#c9cdd6',
  color = '#4a7fe8',
  color2 = '#ef5b7f',
  color3 = '#14a89e',
  color4 = '#f08a24',
  color5 = '#8e5fd6',
  color6 = '#c49a12',
  background = '#ffffff',
  trackColor = '#eef0f6',
  textColor = '#2b2f3a',
  mutedColor = '#8a90a0',
}) {
  const uid = useId().replace(/:/g, '')
  const wrap = useRef(null)
  const [boxRef, boxW] = useWidth()
  const segs = splitNames(segments)
  const rows0 = useMemo(() => parseMulti(data), [data])
  const K = Math.max(1, segs.length, ...rows0.map((r) => r.values.length))
  const diverging = mode === 'diverging'
  const midIdx = (K - 1) / 2
  const isMid = (k) => Math.abs(k - midIdx) < 0.01
  const rows = useMemo(() => {
    const r = rows0.map((x) => {
      const v = Array.from({ length: K }, (_, k) => Math.max(0, x.values[k] ?? 0))
      const t = v.reduce((a, b) => a + b, 0) || 1
      const pct = v.map((q) => (q / t) * 100)
      const pos = pct.reduce((a, q, k) => a + (k > midIdx ? q : 0), 0)
      const neg = pct.reduce((a, q, k) => a + (k < midIdx ? q : 0), 0)
      return { label: x.label, v, pct, pos, neg }
    })
    if (sort === 'positive') r.sort((a, b) => b.pos - a.pos)
    return r
  }, [rows0, K, sort, midIdx])
  // colours: negative tints - neutral - positive tints for diverging, the palette otherwise
  const pal = paletteOf(K, [color, color2, color3, color4, color5, color6])
  const segColor = (k) => {
    if (!diverging) return pal[k]
    if (isMid(k)) return neutralColor
    const t = Math.abs(k - midIdx) / Math.max(1, midIdx)
    return mix(neutralColor, k < midIdx ? negColor : posColor, 0.4 + 0.6 * t)
  }
  const stripeK = diverging ? K - 1 : 0
  const p = useReveal(animate, duration, `${data}|${mode}|${sort}`)
  const [hov, setHov] = useState(null) // { r, k } or { k }
  const [tip, setTip] = useState(null)

  const W = Math.max(280, (boxW || width) - size * 3)
  const maxLab = Math.min(26, Math.max(1, ...rows.map((r) => r.label.length)))
  const labW = Math.min(W * 0.4, maxLab * size * 0.58 + 14)
  const endW = diverging && showTotals ? size * 3.6 : 0
  const m = { l: labW, r: endW + 4, t: diverging ? size * 2 : 4, b: 4 }
  const pw = Math.max(80, W - m.l - m.r)
  const bh = clamp(barHeight, 12, 60)
  const rowH = bh + size * 0.9
  const H = m.t + rows.length * rowH + m.b
  const leftOf = (r) => r.pct.reduce((a, q, k) => a + (k < midIdx ? q : isMid(k) ? q / 2 : 0), 0)
  // diverging: left/right extents so the neutral middle sits on the zero line
  const extent = diverging ? Math.max(1, ...rows.map((r) => Math.max(leftOf(r), 100 - leftOf(r)))) : 100
  const zero = diverging ? m.l + pw / 2 : m.l
  const scale = diverging ? pw / 2 / extent : pw / 100
  const fmtP = (v) => `${v.toFixed(decimals)}%`
  const rad = Math.min(radius, bh / 2)
  const move = (e) => tooltip && setTip((t) => (t ? { ...t, ...tipAt(e, wrap, t.title, t.rows) } : t))
  const legendItems = Array.from({ length: K }, (_, k) => ({ name: segs[k] ?? `Part ${k + 1}`, color: segColor(k) }))

  return (
    <Card wrapRef={(el) => { wrap.current = el; boxRef.current = el }} {...{ width, background, textColor, mutedColor, size, title, subtitle, tip }}>
      {showLegend && K >= 2 && <Legend items={legendItems} mutedColor={mutedColor} onHover={(k) => setHov(k < 0 ? null : { k })} />}
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${title}. ${diverging ? 'Diverging' : 'Stacked'} share bars. ${rows.map((r) => `${r.label}: ${r.pct.map((q, k) => `${segs[k] ?? `part ${k + 1}`} ${fmtP(q)}`).join(', ')}`).join('; ')}`}
        style={{ display: 'block', overflow: 'visible' }}
        onMouseLeave={() => { setHov(null); setTip(null) }}
      >
        <defs>
          <pattern id={`st${uid}`} width={stripeWidth * 2} height={stripeWidth * 2} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width={stripeWidth} height={stripeWidth * 2} fill="#ffffff" opacity="0.35" />
          </pattern>
        </defs>

        {showTrack && rows.map((r, ri) => <path key={`t${ri}`} d={rrect(m.l, m.t + ri * rowH + (rowH - bh) / 2, pw, bh, [rad, rad, rad, rad])} fill={trackColor} />)}

        {diverging && <line x1={zero} x2={zero} y1={m.t - 4} y2={H - m.b + 2} stroke={textColor} strokeOpacity="0.5" strokeWidth="2" strokeDasharray="3 4" strokeLinecap="round" style={{ pointerEvents: 'none' }} />}
        {diverging && (
          <g style={{ pointerEvents: 'none' }}>
            <path d={`M${zero - 8 - size * 0.55},${m.t - size * 0.95}l${size * 0.55},-${size * 0.32}v${size * 0.64}z`} fill={negColor} />
            <text x={zero - 8 - size * 0.9} y={m.t - size * 0.95} dy="0.35em" textAnchor="end" fontSize={size * 0.82} fontWeight="700" fill={mutedColor}>{negLabel}</text>
            <path d={`M${zero + 8 + size * 0.55},${m.t - size * 0.95}l-${size * 0.55},-${size * 0.32}v${size * 0.64}z`} fill={posColor} />
            <text x={zero + 8 + size * 0.9} y={m.t - size * 0.95} dy="0.35em" fontSize={size * 0.82} fontWeight="700" fill={mutedColor}>{posLabel}</text>
          </g>
        )}

        {rows.map((r, ri) => {
          const ip = stag(p, ri, rows.length)
          const g = pop(ip)
          const y = m.t + ri * rowH + (rowH - bh) / 2
          // where the bar starts: for diverging, shift left by everything below the middle
          let x = zero - (diverging ? leftOf(r) : 0) * scale * g
          const parts = r.pct.map((q, k) => {
            const w = q * scale * g
            const s = { k, x, w, q }
            x += w
            return s
          })
          const firstK = parts.findIndex((s) => s.q > 0)
          const lastK = parts.length - 1 - [...parts].reverse().findIndex((s) => s.q > 0)
          const rowOn = !hov || hov.r == null || hov.r === ri
          return (
            <g key={ri}>
              <text x={m.l - 12} y={y + bh / 2} dy="0.35em" textAnchor="end" fontSize={size * 0.9} fontWeight="600" fill={hov && hov.r === ri ? textColor : mutedColor} style={{ pointerEvents: 'none' }}>
                {r.label.length > 26 ? r.label.slice(0, 25) + '…' : r.label}
              </text>
              {parts.map((s) => {
                if (s.q <= 0) return null
                const c = segColor(s.k)
                const on = !hov || (hov.r == null ? hov.k === s.k : hov.r === ri && hov.k === s.k)
                const rr = [s.k === firstK ? rad : 0, s.k === lastK ? rad : 0, s.k === lastK ? rad : 0, s.k === firstK ? rad : 0]
                const sx = s.x + (s.k === firstK ? 0 : gap / 2)
                const sw = Math.max(0, s.w - (s.k === firstK ? 0 : gap / 2) - (s.k === lastK ? 0 : gap / 2))
                const d = rrect(sx, y, sw, bh, rr)
                const lfs = Math.min(size * 0.85, bh * 0.48)
                const lab = fmtP(s.q)
                return (
                  <g
                    key={s.k}
                    opacity={on ? 1 : 0.4}
                    style={{ transition: 'opacity .2s' }}
                    onMouseEnter={(e) => {
                      setHov({ r: ri, k: s.k })
                      if (tooltip)
                        setTip(tipAt(e, wrap, r.label, [
                          { color: c, label: segs[s.k] ?? `Part ${s.k + 1}`, value: fmtP(s.q) },
                          { label: 'Responses', value: String(r.v[s.k]) },
                          ...(diverging ? [{ label: `All ${posLabel.toLowerCase()}`, value: fmtP(r.pos) }, { label: `All ${negLabel.toLowerCase()}`, value: fmtP(r.neg) }] : []),
                        ]))
                    }}
                    onMouseMove={move}
                  >
                    <path d={d} fill={c} />
                    {stripes && s.k === stripeK && sw > 4 && (
                      <>
                        <clipPath id={`c${uid}${ri}_${s.k}`}><path d={d} /></clipPath>
                        <g clipPath={`url(#c${uid}${ri}_${s.k})`}>
                          <rect x={sx} y={y + bh * 0.7} width={sw} height={bh * 0.3} fill={mix(c, '#000000', 0.12)} />
                          <rect x={sx} y={y + bh * 0.7} width={sw} height={bh * 0.3} fill={`url(#st${uid})`} />
                        </g>
                      </>
                    )}
                    {/* hit area: the full row height across this part */}
                    <rect x={s.x} y={y - (rowH - bh) / 2} width={Math.max(0, s.w)} height={rowH} fill="transparent" />
                    {showLabels && sw > lab.length * lfs * 0.62 + 8 && ip > 0.8 && (
                      <text x={sx + sw / 2} y={y + bh / 2} dy="0.35em" textAnchor="middle" fontSize={lfs} fontWeight="800" fill={inkOn(c, textColor)} style={{ pointerEvents: 'none', fontVariantNumeric: 'tabular-nums' }}>
                        {lab}
                      </text>
                    )}
                  </g>
                )
              })}
              {diverging && showTotals && (
                <text x={W} y={y + bh / 2} dy="0.35em" textAnchor="end" fontSize={size * 1.05} fontWeight="800" fill={textColor} opacity={rowOn ? 1 : 0.4} style={{ pointerEvents: 'none', fontVariantNumeric: 'tabular-nums', transition: 'opacity .2s' }}>
                  {fmtP(r.pos * ease(ip))}
                </text>
              )}
            </g>
          )
        })}

      </svg>
    </Card>
  )
}
