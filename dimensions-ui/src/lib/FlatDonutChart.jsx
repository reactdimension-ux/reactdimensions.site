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
const paletteOf = (n, base) => Array.from({ length: n }, (_, i) => base[i % base.length])
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

// one donut segment as a filled path with rounded corners and parallel-sided gaps.
// Angles in radians, 0 = twelve o'clock, growing clockwise. `h` is half the gap
// width in px, `c` the corner radius.
function segPath(cx, cy, Ro, Ri, s0, s1, h, c) {
  const P = (u, v, base) => {
    const a = base + Math.atan2(v, u)
    const rad = Math.hypot(u, v)
    return `${(cx + rad * Math.sin(a)).toFixed(2)},${(cy - rad * Math.cos(a)).toFixed(2)}`
  }
  const at = (rad, a) => `${(cx + rad * Math.sin(a)).toFixed(2)},${(cy - rad * Math.cos(a)).toFixed(2)}`
  for (const cc of [c, c / 2, 0]) {
    const k = Math.max(0, Math.min(cc, (Ro - Ri) / 2 - 0.5))
    const so = (h + k) / (Ro - k)
    const si = (h + k) / (Ri + k)
    if (so >= 1 || si >= 1) continue
    const ao0 = s0 + Math.asin(so)
    const ao1 = s1 - Math.asin(so)
    const ai0 = s0 + Math.asin(si)
    const ai1 = s1 - Math.asin(si)
    if (ao1 <= ao0 || ai1 <= ai0) continue
    const uo = Math.sqrt((Ro - k) ** 2 - (h + k) ** 2)
    const ui = Math.sqrt((Ri + k) ** 2 - (h + k) ** 2)
    const bo = ao1 - ao0 > Math.PI ? 1 : 0
    const bi = ai1 - ai0 > Math.PI ? 1 : 0
    return (
      `M${P(uo, h, s0)}A${k},${k} 0 0 1 ${at(Ro, ao0)}A${Ro},${Ro} 0 ${bo} 1 ${at(Ro, ao1)}A${k},${k} 0 0 1 ${P(uo, -h, s1)}` +
      `L${P(ui, -h, s1)}A${k},${k} 0 0 1 ${at(Ri, ai1)}A${Ri},${Ri} 0 ${bi} 0 ${at(Ri, ai0)}A${k},${k} 0 0 1 ${P(ui, h, s0)}Z`
    )
  }
  return ''
}
function fullRing(cx, cy, R, r) {
  return `M${cx},${cy - R}A${R},${R} 0 1 1 ${cx},${cy + R}A${R},${R} 0 1 1 ${cx},${cy - R}Z M${cx},${cy - r}A${r},${r} 0 1 0 ${cx},${cy + r}A${r},${r} 0 1 0 ${cx},${cy - r}Z`
}

// Flat infographic donut: thick flat segments split by clean gaps, optionally pushed
// out from the centre and alternating in thickness, with percentage callouts on
// short leader lines and the total in the middle. Segments sweep in one after another.
export default function FlatDonutChart({
  data = 'Direct:38, Search:27, Social:16, Email:11, Other:8',
  title = 'Traffic sources',
  subtitle = 'Share of visits by channel',
  innerRadius = 0.56,
  padAngle = 2.5,
  cornerRadius = 6,
  explode = 4,
  staggered = false,
  labels = 'outside',
  showTotal = true,
  centerLabel = 'Total',
  showLegend = true,
  stripes = true,
  stripeWidth = 4,
  tooltip = true,
  animate = true,
  duration = 1300,
  decimals = 0,
  prefix = '',
  suffix = '',
  width = 560,
  height = 300,
  size = 13,
  color = '#4a7fe8',
  color2 = '#ef5b7f',
  color3 = '#14a89e',
  color4 = '#f08a24',
  color5 = '#8e5fd6',
  color6 = '#c49a12',
  background = '#ffffff',
  textColor = '#2b2f3a',
  mutedColor = '#8a90a0',
}) {
  const uid = useId().replace(/:/g, '')
  const wrap = useRef(null)
  const [boxRef, boxW] = useWidth()
  const fmt = makeFmt({ decimals, prefix, suffix })
  const pct = makeFmt({ decimals: 0, suffix: '%' })
  const rows = useMemo(() => parseRows(data).map((r) => ({ ...r, value: Math.max(0, r.value) })), [data])
  const cols = paletteOf(rows.length, [color, color2, color3, color4, color5, color6])
  const p = useReveal(animate, duration, data)
  const [hov, setHov] = useState(-1)
  const [tip, setTip] = useState(null)

  const n = Math.max(1, rows.length)
  const total = rows.reduce((s, r) => s + r.value, 0)
  const W = Math.max(220, (boxW || width) - size * 3)
  const H = Math.max(140, height)
  const out = labels === 'outside'
  const ex = Math.max(0, explode)
  // horizontal room for the callouts: leader + dot + the widest text
  const textW = Math.max(...rows.map((r) => r.label.length * 0.85 * 0.56), 4 * 1.2 * 0.6) * size
  const roomX = out ? size * 2.6 + textW : 0
  const roomY = out ? size * 1.6 : 0
  const cx = W / 2
  const cy = H / 2
  const Ro = Math.max(36, Math.min(W / 2 - roomX - ex - 4, H / 2 - roomY - ex - 4))
  const Ri = Ro * clamp(innerRadius, 0.2, 0.85)
  const h = (Ro * clamp(padAngle, 0, 20) * Math.PI) / 360
  const thin = Ri + (Ro - Ri) * 0.74

  let acc = 0
  const segs = rows.map((r, i) => {
    const sw = total > 0 ? (r.value / total) * Math.PI * 2 : 0
    const a = acc
    acc += sw
    const k = stag(p, i, n)
    const end = a + sw * ease(k)
    const R = staggered && i % 2 === 1 ? thin : Ro
    const m = a + sw / 2
    const push = ex + (hov === i ? 4 : 0)
    const dx = Math.sin(m) * push * pop(k)
    const dy = -Math.cos(m) * push * pop(k)
    const d = rows.length === 1 && k >= 1 ? fullRing(cx, cy, R, Ri) : end - a > 0.001 ? segPath(cx, cy, R, Ri, a, end, rows.length > 1 ? h : 0, cornerRadius) : ''
    return { ...r, i, a, sw, m, R, k, dx, dy, d, share: total > 0 ? (r.value / total) * 100 : 0 }
  })

  // outside callouts: anchored at the segment edge, an elbow, then a short level run to a dot
  const calls = out
    ? segs
        .filter((s) => s.sw > 0)
        .map((s) => {
          const right = Math.sin(s.m) >= 0
          const ax = cx + s.dx + Math.sin(s.m) * (s.R + 3)
          const ay = cy + s.dy - Math.cos(s.m) * (s.R + 3)
          const er = Ro + ex + size * 0.8
          return { s, right, ax, ay, ex: cx + Math.sin(s.m) * er, ey: cy - Math.cos(s.m) * er, y: cy - Math.cos(s.m) * er }
        })
    : []
  // keep callouts on each side at least one text block apart: nudge overlapping
  // neighbours apart a little at a time so clusters spread around their natural spot
  const yLo = size * 0.7
  const yHi = H - size * 1.7
  for (const side of [true, false]) {
    const list = calls.filter((c) => c.right === side).sort((a, b) => a.y - b.y)
    const minGap = Math.min(size * 2.55, list.length > 1 ? (yHi - yLo) / (list.length - 1) : Infinity)
    for (let it = 0; it < 120; it++) {
      let moved = false
      for (let j = 1; j < list.length; j++) {
        const o = list[j - 1].y + minGap - list[j].y
        if (o > 0.1) {
          list[j - 1].y -= o / 2
          list[j].y += o / 2
          moved = true
        }
      }
      for (const c of list) c.y = clamp(c.y, yLo, yHi)
      if (!moved) break
    }
  }

  const enter = (e, s) => {
    setHov(s.i)
    if (tooltip)
      setTip(tipAt(e, wrap, s.label, [
        { color: cols[s.i], label: 'Value', value: fmt(s.value) },
        { label: 'Share', value: pct(s.share) },
      ]))
  }
  // centre total: big, but never wider than the hole
  const tfs = Math.max(size, Math.min(Ri * 0.4, size * 2.6, (2 * Ri - 16) / (fmt(total).length * 0.62)))
  const move = (e) => tooltip && setTip((t) => (t ? { ...t, ...tipAt(e, wrap, t.title, t.rows) } : t))
  const leave = () => { setHov(-1); setTip(null) }

  return (
    <Card wrapRef={(el) => { wrap.current = el; boxRef.current = el }} {...{ width, background, textColor, mutedColor, size, title, subtitle, tip }}>
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${title}. Donut chart, total ${fmt(total)}. ${segs.map((s) => `${s.label}: ${fmt(s.value)} (${pct(s.share)})`).join('; ')}`}
        style={{ display: 'block', overflow: 'visible' }}
        onMouseLeave={leave}
      >
        <defs>
          <pattern id={`st${uid}`} width={stripeWidth * 2} height={stripeWidth * 2} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width={stripeWidth} height={stripeWidth * 2} fill="#ffffff" opacity="0.35" />
          </pattern>
        </defs>

        {segs.map((s) => {
          if (!s.d) return null
          const c = cols[s.i]
          const dim = hov >= 0 && hov !== s.i
          const band = (s.R - Ri) * 0.3
          const mr = (s.R + Ri) / 2
          const fitsIn = s.sw * mr > size * 2.8 && s.R - Ri > size * 1.3
          return (
            <g
              key={s.i}
              opacity={dim ? 0.4 : 1}
              style={{ transition: 'opacity .2s' }}
              onMouseEnter={(e) => enter(e, s)}
              onMouseMove={move}
            >
              <g transform={`translate(${s.dx} ${s.dy})`} style={{ transition: 'transform .2s' }}>
                <path d={s.d} fill={c} />
                {stripes && (
                  <>
                    <clipPath id={`c${uid}${s.i}`}><path d={s.d} /></clipPath>
                    <g clipPath={`url(#c${uid}${s.i})`}>
                      <circle cx={cx} cy={cy} r={s.R - band / 2} fill="none" stroke={mix(c, '#000000', 0.12)} strokeWidth={band} />
                      <circle cx={cx} cy={cy} r={s.R - band / 2} fill="none" stroke={`url(#st${uid})`} strokeWidth={band} />
                    </g>
                  </>
                )}
                {/* hit area: the segment plus a margin round it */}
                <path d={s.d} fill="transparent" stroke="transparent" strokeWidth={8} strokeLinejoin="round" />
                {labels === 'inside' && fitsIn && s.k > 0.7 && (
                  <text
                    x={cx + Math.sin(s.m) * (Ri + (s.R - Ri) * 0.42)}
                    y={cy - Math.cos(s.m) * (Ri + (s.R - Ri) * 0.42)}
                    dy="0.35em"
                    textAnchor="middle"
                    fontSize={size * 0.95}
                    fontWeight="800"
                    fill={background}
                    style={{ pointerEvents: 'none', fontVariantNumeric: 'tabular-nums' }}
                  >
                    {pct(s.share)}
                  </text>
                )}
              </g>
            </g>
          )
        })}

        {calls.map((c) => {
          const s = c.s
          const op = clamp((s.k - 0.55) / 0.45, 0, 1)
          if (op <= 0) return null
          const dir = c.right ? 1 : -1
          const dotX = cx + dir * (Ro + ex + size * 1.9)
          // short radial stub out of the segment, then across to the dot at the label's row
          const kneeX = dotX - dir * size * 0.9
          return (
            <g key={`l${s.i}`} opacity={op * (hov >= 0 && hov !== s.i ? 0.4 : 1)} style={{ pointerEvents: 'none', transition: 'opacity .2s' }}>
              <path d={`M${c.ax},${c.ay}L${c.ex},${c.ey}L${dir * (kneeX - c.ex) > 0 ? kneeX : c.ex},${c.y}L${dotX},${c.y}`} fill="none" stroke={mutedColor} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx={dotX} cy={c.y} r={size * 0.26} fill={textColor} />
              <text x={dotX + dir * size * 0.6} y={c.y} dy="0.36em" textAnchor={c.right ? 'start' : 'end'} fontSize={size * 1.2} fontWeight="800" fill={textColor} style={{ fontVariantNumeric: 'tabular-nums' }}>
                {pct(s.share * ease(s.k))}
              </text>
              <text x={dotX + dir * size * 0.6} y={c.y + size * 1.45} textAnchor={c.right ? 'start' : 'end'} fontSize={size * 0.85} fontWeight="600" fill={mutedColor}>
                {s.label}
              </text>
            </g>
          )
        })}

        {showTotal && (
          <g style={{ pointerEvents: 'none' }}>
            <text x={cx} y={cy} dy={centerLabel ? '0.1em' : '0.36em'} textAnchor="middle" fontSize={tfs} fontWeight="800" fill={textColor} style={{ fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
              {fmt(total * ease(p))}
            </text>
            {centerLabel && (
              <text x={cx} y={cy + tfs * 0.62 + size * 0.4} textAnchor="middle" fontSize={size * 0.85} fontWeight="600" fill={mutedColor}>
                {centerLabel}
              </text>
            )}
          </g>
        )}
      </svg>

      {showLegend && (
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.5em 1.3em', marginTop: '1em' }} onMouseLeave={leave}>
          {segs.map((s) => (
            <div
              key={s.i}
              onMouseEnter={() => setHov(s.i)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.45em', fontSize: '0.9em', opacity: hov >= 0 && hov !== s.i ? 0.4 : 1, transition: 'opacity .2s', cursor: 'default' }}
            >
              <i style={{ width: '0.85em', height: '0.85em', borderRadius: 4, background: cols[s.i], flex: 'none' }} />
              <span style={{ color: mutedColor, fontWeight: 600 }}>{s.label}</span>
              <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmt(s.value)}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
