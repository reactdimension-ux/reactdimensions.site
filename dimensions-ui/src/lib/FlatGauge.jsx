import { useEffect, useId, useRef, useState } from 'react'

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

const axisFmt = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })
const splitNames = (s) =>
  String(s ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)

// one ring segment as a filled path with rounded corners and parallel-sided gaps.
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

// Flat infographic gauge: one value on a chunky dial. In needle style the band is split
// into flat coloured zones with clean gaps (the live zone wears diagonal stripes) and a
// bold tapered needle swings to the value on a spring; in arc style a thick rounded arc
// fills to the value over a flat track. Ticks, a target pointer and a big value label
// finish it. Zones pop in one after another; hover a zone for its range.
export default function FlatGauge({
  value = 72,
  min = 0,
  max = 100,
  target = 85,
  zones = '40, 70',
  zoneMode = 'low is bad',
  label = 'System health',
  title = 'Health score',
  subtitle = 'Updated a minute ago',
  arc = 'three-quarter',
  style = 'needle',
  thickness = 26,
  padAngle = 2,
  cornerRadius = 6,
  showTicks = true,
  majorTicks = 5,
  minorTicks = 4,
  showZones = true,
  stripes = true,
  stripeWidth = 4,
  stiffness = 80,
  damping = 11,
  autoplay = false,
  tooltip = true,
  animate = true,
  duration = 900,
  decimals = 0,
  prefix = '',
  suffix = '',
  width = 420,
  size = 13,
  color = '#4a7fe8',
  lowColor = '#ef5b7f',
  midColor = '#f08a24',
  highColor = '#14a89e',
  background = '#ffffff',
  trackColor = '#eef0f6',
  textColor = '#2b2f3a',
  mutedColor = '#8a90a0',
}) {
  const uid = useId().replace(/:/g, '')
  const wrap = useRef(null)
  const [boxRef, boxW] = useWidth()
  const fmt = makeFmt({ decimals, prefix, suffix })
  const [goal, setGoal] = useState(value)
  const [v, setV] = useState(animate ? min : value)
  const sim = useRef({ x: animate ? min : value, vel: 0 })
  const p = useReveal(animate, duration, `${zones}|${arc}|${style}|${min}|${max}`)
  const [hov, setHov] = useState(-1)
  const [tip, setTip] = useState(null)

  useEffect(() => {
    if (!autoplay) return setGoal(value)
    const t = setInterval(() => setGoal(min + Math.random() * (max - min)), 2400)
    setGoal(min + Math.random() * (max - min))
    return () => clearInterval(t)
  }, [autoplay, value, min, max])
  // the needle (or arc end) rides a damped spring towards the goal
  useEffect(() => {
    const reduce = !animate || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    let raf
    let last = performance.now()
    const tick = (now) => {
      const dt = Math.min(0.032, (now - last) / 1000)
      last = now
      const s = sim.current
      if (reduce) {
        s.x = goal
        s.vel = 0
      } else {
        s.vel += (stiffness * (goal - s.x) - damping * s.vel) * dt
        s.x += s.vel * dt
      }
      setV(s.x)
      if (!reduce && (Math.abs(goal - s.x) > (max - min) * 0.0005 || Math.abs(s.vel) > 0.01)) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [goal, stiffness, damping, min, max, animate])

  const half = arc === 'half'
  const needle = style === 'needle'
  const W = Math.max(220, Math.min(width, boxW || width) - size * 3)
  const sweepDeg = half ? 180 : arc === 'full' ? 300 : 260
  const sweep = (sweepDeg * Math.PI) / 180
  const start = -sweep / 2
  const R = W / 2 - size * 1.4
  const th = clamp(thickness, 4, R * 0.45)
  const rIn = R - th
  const cx = W / 2
  const cy = R + size * 1.3
  const span = max - min || 1
  const f = (x) => clamp((x - min) / span, 0, 1)
  const toA = (x) => start + f(x) * sweep
  const pt = (a, r) => [cx + Math.sin(a) * r, cy - Math.cos(a) * r]

  const zs = splitNames(zones).map(num).filter((z) => z > min && z < max).sort((a, b) => a - b)
  const bounds = [min, ...zs, max]
  const nz = bounds.length - 1
  const lowBad = zoneMode === 'low is bad'
  const zoneColor = (i) => {
    const t = nz > 1 ? i / (nz - 1) : 1
    // snap to the three flat colours rather than blending into muddy in-betweens
    const k = Math.round((lowBad ? t : 1 - t) * 2)
    return [lowColor, midColor, highColor][k]
  }
  const zi = Math.max(0, bounds.findIndex((b, i) => i < nz && goal >= b && goal <= bounds[i + 1]))
  const cur = showZones ? zoneColor(zi) : color
  const a = toA(v)
  const h = (R * clamp(padAngle, 0, 10) * Math.PI) / 360

  const ticks = []
  const MJ = clamp(Math.round(majorTicks), 1, 12)
  const MN = clamp(Math.round(minorTicks), 0, 9)
  for (let i = 0; i <= MJ; i++) {
    ticks.push({ x: min + (span * i) / MJ, major: true })
    if (i < MJ) for (let k = 1; k <= MN; k++) ticks.push({ x: min + (span * (i + k / (MN + 1))) / MJ, major: false })
  }

  // text block: big value, the label and the target line
  const fs = Math.max(size * 1.4, Math.min(size * 3.1, rIn * 0.42))
  const baseY = needle ? (half ? cy + fs + size * 0.9 : cy + rIn * 0.62) : half ? cy - size * 0.4 : cy + fs * 0.32
  const hasTarget = target > min && target < max
  const textBottom = baseY + size * 1.5 + (hasTarget ? size * 1.35 : 0) + size * 0.6
  const arcBottom = half ? cy + size * 0.3 : cy - Math.cos(sweep / 2) * R + size * 0.6
  const H = Math.max(textBottom, arcBottom)

  // band pieces: zones (needle style) or a track plus the value fill (arc style)
  const zoned = needle && showZones
  const zonesD = bounds.slice(0, -1).map((b, i) => {
    const a0 = toA(b)
    const a1 = toA(bounds[i + 1])
    const k = stag(p, i, nz)
    return { i, b0: b, b1: bounds[i + 1], a0, a1, k, d: k > 0 ? segPath(cx, cy, R, rIn, a0, a0 + (a1 - a0) * ease(k), nz > 1 ? h : 0, cornerRadius) : '' }
  })
  const trackD = segPath(cx, cy, R, rIn, toA(min), toA(max), 0, th / 2)
  const fillEnd = toA(min) + (Math.max(a, toA(min) + 0.002) - toA(min)) * ease(p)
  const fillD = segPath(cx, cy, R, rIn, toA(min), fillEnd, 0, th / 2)
  const sbR = R - th * 0.15
  const stripeBand = (key, d) =>
    stripes && d ? (
      <>
        <clipPath id={`c${uid}${key}`}><path d={d} /></clipPath>
        <g clipPath={`url(#c${uid}${key})`} style={{ pointerEvents: 'none' }}>
          <circle cx={cx} cy={cy} r={sbR} fill="none" stroke={mix(key === 'f' ? cur : zoneColor(key), '#000000', 0.12)} strokeWidth={th * 0.3} />
          <circle cx={cx} cy={cy} r={sbR} fill="none" stroke={`url(#st${uid})`} strokeWidth={th * 0.3} />
        </g>
      </>
    ) : null

  const enterZone = (e, z) => {
    setHov(z.i)
    if (tooltip) setTip(tipAt(e, wrap, `Zone ${z.i + 1}${z.i === zi ? ' (now)' : ''}`, [{ color: zoneColor(z.i), label: 'Range', value: `${fmt(z.b0)} – ${fmt(z.b1)}` }]))
  }
  const enterValue = (e) => {
    setHov(-2)
    if (tooltip)
      setTip(tipAt(e, wrap, label, [
        { color: cur, label: 'Value', value: fmt(goal) },
        ...(hasTarget ? [{ label: 'Target', value: fmt(target) }] : []),
      ]))
  }
  const move = (e) => tooltip && setTip((t) => (t ? { ...t, ...tipAt(e, wrap, t.title, t.rows) } : t))
  const leave = () => { setHov(-1); setTip(null) }
  const np = needle ? pop(clamp(p * 1.4, 0, 1)) : 1

  return (
    <Card wrapRef={(el) => { wrap.current = el; boxRef.current = el }} {...{ width, background, textColor, mutedColor, size, title, subtitle, tip }}>
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${title}. Gauge. ${label}: ${fmt(goal)} on a scale of ${fmt(min)} to ${fmt(max)}${hasTarget ? `, target ${fmt(target)}` : ''}.`}
        style={{ display: 'block', maxWidth: '100%', margin: '0 auto', overflow: 'visible' }}
        onMouseLeave={leave}
      >
        <defs>
          <pattern id={`st${uid}`} width={stripeWidth * 2} height={stripeWidth * 2} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width={stripeWidth} height={stripeWidth * 2} fill="#ffffff" opacity="0.35" />
          </pattern>
        </defs>

        {zoned
          ? zonesD.map((z) =>
              z.d ? (
                <g key={z.i} opacity={hov >= 0 && hov !== z.i ? 0.4 : 1} style={{ transition: 'opacity .2s' }} onMouseEnter={(e) => enterZone(e, z)} onMouseMove={move}>
                  <path d={z.d} fill={zoneColor(z.i)} />
                  {z.i === zi && stripeBand(z.i, z.d)}
                  <path d={z.d} fill="transparent" stroke="transparent" strokeWidth={10} strokeLinejoin="round" />
                </g>
              ) : null,
            )
          : (
            <g opacity={hov >= 0 ? 0.4 : 1} style={{ transition: 'opacity .2s' }} onMouseEnter={enterValue} onMouseMove={move}>
              <path d={trackD} fill={trackColor} />
              {fillD && <path d={fillD} fill={cur} style={{ transition: 'fill .4s' }} />}
              {stripeBand('f', fillD)}
              <path d={trackD} fill="transparent" stroke="transparent" strokeWidth={10} />
            </g>
          )}

        {/* thin zone guide outside the band, for arc style */}
        {!zoned && showZones &&
          zonesD.map((z) => {
            const [x0, y0] = pt(z.a0 + 0.02, R + 7)
            const e1 = z.a0 + (z.a1 - z.a0) * ease(z.k)
            const [x1, y1] = pt(Math.max(z.a0 + 0.021, e1 - 0.02), R + 7)
            return (
              <path
                key={`g${z.i}`}
                d={`M${x0},${y0}A${R + 7},${R + 7} 0 ${e1 - z.a0 > Math.PI ? 1 : 0} 1 ${x1},${y1}`}
                fill="none"
                stroke={zoneColor(z.i)}
                strokeWidth="4"
                strokeLinecap="round"
                opacity={z.k > 0 ? (hov >= 0 && hov !== z.i ? 0.4 : 1) : 0}
                onMouseEnter={(e) => enterZone(e, z)}
                onMouseMove={move}
                style={{ transition: 'opacity .2s' }}
              />
            )
          })}

        {showTicks &&
          ticks.map((t, i) => {
            const ta = toA(t.x)
            const [x0, y0] = pt(ta, rIn - 6)
            const [x1, y1] = pt(ta, rIn - (t.major ? 14 : 10))
            const [lx, ly] = pt(ta, rIn - 16 - size * 0.85)
            return (
              <g key={i} opacity={ease(p)} style={{ pointerEvents: 'none' }}>
                <line x1={x0} y1={y0} x2={x1} y2={y1} stroke={mutedColor} strokeOpacity={t.major ? 0.9 : 0.45} strokeWidth={t.major ? 2.4 : 1.6} strokeLinecap="round" />
                {t.major && rIn > 70 && (
                  <text x={lx} y={ly} dy="0.35em" textAnchor="middle" fontSize={size * 0.78} fontWeight="600" fill={mutedColor}>
                    {axisFmt.format(t.x)}
                  </text>
                )}
              </g>
            )
          })}

        {hasTarget && (() => {
          const ta = toA(target)
          const s = size * 0.55
          const [tx, ty] = pt(ta, R + 2)
          const [bx, by] = pt(ta, R + 2 + s * 1.6)
          const nx = Math.cos(ta) * s
          const ny = Math.sin(ta) * s
          return (
            <g opacity={ease(p)} style={{ pointerEvents: 'none' }}>
              <line x1={pt(ta, R)[0]} y1={pt(ta, R)[1]} x2={pt(ta, rIn)[0]} y2={pt(ta, rIn)[1]} stroke={background} strokeWidth="3" />
              <path d={`M${tx},${ty}L${bx + nx},${by + ny}L${bx - nx},${by - ny}Z`} fill={textColor} stroke={textColor} strokeWidth="2" strokeLinejoin="round" />
            </g>
          )
        })()}

        {needle && (
          <g style={{ pointerEvents: 'none' }} transform={`translate(${cx} ${cy}) scale(${np}) translate(${-cx} ${-cy})`}>
            <path d={`M${pt(a + Math.PI / 2, 7).join(',')}L${pt(a, rIn - 10).join(',')}L${pt(a - Math.PI / 2, 7).join(',')}L${pt(a + Math.PI, 10).join(',')}Z`} fill={textColor} stroke={textColor} strokeWidth="2" strokeLinejoin="round" />
            <circle cx={cx} cy={cy} r={size * 0.95} fill={textColor} />
            <circle cx={cx} cy={cy} r={size * 0.42} fill={cur} />
          </g>
        )}

        <g style={{ pointerEvents: 'none' }}>
          <text x={cx} y={baseY} textAnchor="middle" fontSize={fs} fontWeight="800" fill={textColor} style={{ fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
            {fmt(v)}
          </text>
          <text x={cx} y={baseY + size * 1.5} textAnchor="middle" fontSize={size * 0.9} fontWeight="600" fill={mutedColor}>
            {label}
          </text>
          {hasTarget && (
            <text x={cx} y={baseY + size * 2.85} textAnchor="middle" fontSize={size * 0.8} fontWeight="600" fill={mutedColor}>
              {`Target ${fmt(target)}`}
            </text>
          )}
        </g>
      </svg>
    </Card>
  )
}
