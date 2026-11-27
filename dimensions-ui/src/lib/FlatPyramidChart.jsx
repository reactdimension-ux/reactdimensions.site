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

// white or dark ink, whichever reads better on a filled colour
function inkOn(c, dark) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(String(c).slice(i, i + 2), 16) || 0)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.66 ? dark : '#ffffff'
}
// closed polygon path with a corner radius per vertex (0 = sharp)
function roundPoly(pts, radii) {
  const P = pts.filter((q, i) => {
    const o = pts[(i + pts.length - 1) % pts.length]
    return Math.hypot(q[0] - o[0], q[1] - o[1]) > 0.01
  })
  const R = radii.filter((_, i) => {
    const q = pts[i]
    const o = pts[(i + pts.length - 1) % pts.length]
    return Math.hypot(q[0] - o[0], q[1] - o[1]) > 0.01
  })
  const n = P.length
  if (n < 3) return ''
  const seg = P.map((q, i) => {
    const a = P[(i + n - 1) % n]
    const b = P[(i + 1) % n]
    const la = Math.hypot(a[0] - q[0], a[1] - q[1])
    const lb = Math.hypot(b[0] - q[0], b[1] - q[1])
    const r = Math.max(0, Math.min(R[i] ?? 0, la / 2, lb / 2))
    return {
      q,
      s: [q[0] + ((a[0] - q[0]) / la) * r, q[1] + ((a[1] - q[1]) / la) * r],
      e: [q[0] + ((b[0] - q[0]) / lb) * r, q[1] + ((b[1] - q[1]) / lb) * r],
    }
  })
  const f = (v) => v.toFixed(2)
  return (
    `M${f(seg[0].s[0])},${f(seg[0].s[1])}` +
    seg.map((c, i) => `${i ? `L${f(c.s[0])},${f(c.s[1])}` : ''}Q${f(c.q[0])},${f(c.q[1])} ${f(c.e[0])},${f(c.e[1])}`).join('') +
    'Z'
  )
}

// Flat infographic pyramid: stacked trapezoid bands forming a triangle, one flat colour
// each with a lighter striped right facet for a faux-3D look, and labels + values to the
// right on dotted leader lines. 'equal' bands or bands sized by value; `inverted` makes
// it a funnel. Bands pop in from the base up; hover dims the rest.
export default function FlatPyramidChart({
  data = 'Vision:10, Strategy:20, Tactics:30, Tasks:40',
  title = 'Planning pyramid',
  subtitle = 'Share of team time by layer',
  mode = 'equal',
  inverted = false,
  gap = 6,
  radius = 6,
  facet = true,
  facetShade = 0.28,
  stripes = true,
  stripeWidth = 4,
  showValues = true,
  showLeaders = true,
  showNumbers = true,
  tooltip = true,
  animate = true,
  duration = 1200,
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
  background = '#ffffff',
  textColor = '#2b2f3a',
  mutedColor = '#8a90a0',
}) {
  const uid = useId().replace(/:/g, '')
  const wrap = useRef(null)
  const [boxRef, boxW] = useWidth()
  const fmt = makeFmt({ decimals, prefix, suffix })
  const rows = useMemo(() => parseRows(data).map((r) => ({ ...r, value: Math.max(0, r.value) })), [data])
  const cols = paletteOf(rows.length, [color, color2, color3, color4, color5, color6])
  const p = useReveal(animate, duration, `${data}|${mode}|${inverted}`)
  const [hov, setHov] = useState(-1)
  const [tip, setTip] = useState(null)

  const W = Math.max(260, (boxW || width) - size * 3)
  const H = Math.max(140, height)
  const n = Math.max(1, rows.length)
  const g = clamp(gap, 0, H / n / 2)
  // pyramid on the left, label column on the right
  const labChars = Math.max(4, ...rows.map((r) => r.label.length), ...rows.map((r) => fmt(r.value).length * 1.3))
  const labW = Math.min(W * 0.45, labChars * size * 0.62 + 40)
  const PW = Math.max(120, Math.min(W - labW - 24, H * 1.3))
  const x0 = 2
  const cx = x0 + PW / 2
  const top = 2
  const tot = H - 4
  const neck = inverted ? PW * 0.12 : 0
  // half width of the triangle at height y
  const hw = (y) => {
    const f = clamp((y - top) / tot, 0, 1)
    return inverted ? neck + (PW / 2 - neck) * (1 - f) : (PW / 2) * f
  }
  // the facet line runs from the apex, a little right of centre
  const sx = (y) => cx + hw(y) * 0.3

  const avail = tot - g * (n - 1)
  const sum = rows.reduce((s, r) => s + r.value, 0) || 1
  let fr = rows.map((r) => (mode === 'value' ? Math.max(0.07, r.value / sum) : 1 / n))
  const fs = fr.reduce((a, b) => a + b, 0)
  fr = fr.map((f) => f / fs)

  let yy = top
  const bands = rows.map((r, i) => {
    const yt = yy
    const yb = yy + avail * fr[i]
    yy = yb + g
    const tl = [cx - hw(yt), yt]
    const tr = [cx + hw(yt), yt]
    const br = [cx + hw(yb), yb]
    const bl = [cx - hw(yb), yb]
    const st = [sx(yt), yt]
    const sb = [sx(yb), yb]
    const rad = Math.min(radius, (yb - yt) / 2)
    return {
      ...r,
      i,
      yt,
      yb,
      cy: (yt + yb) / 2,
      full: roundPoly([tl, tr, br, bl], [rad, rad, rad, rad]),
      left: roundPoly([tl, st, sb, bl], [rad, 0, 0, rad]),
      right: roundPoly([st, tr, br, sb], [0, rad, rad, 0]),
      edge: cx + hw((yt + yb) / 2),
    }
  })

  // label rows: start level with their band, then push apart so they never collide
  const lx = x0 + PW + Math.max(36, (W - PW - labW) * 0.5)
  const minGap = showValues ? size * 3 : size * 1.8
  const ly = bands.map((b) => b.cy)
  for (let i = 1; i < n; i++) ly[i] = Math.max(ly[i], ly[i - 1] + minGap)
  const lastMax = H - minGap / 2
  if (ly[n - 1] > lastMax) {
    ly[n - 1] = lastMax
    for (let i = n - 2; i >= 0; i--) ly[i] = Math.min(ly[i], ly[i + 1] - minGap)
  }

  const enter = (e, b) => {
    setHov(b.i)
    if (tooltip) setTip(tipAt(e, wrap, b.label, [{ color: cols[b.i], label: 'Value', value: fmt(b.value) }]))
  }
  const move = (e) => tooltip && setTip((t) => (t ? { ...t, ...tipAt(e, wrap, t.title, t.rows) } : t))

  return (
    <Card wrapRef={(el) => { wrap.current = el; boxRef.current = el }} {...{ width, background, textColor, mutedColor, size, title, subtitle, tip }}>
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${title}. ${inverted ? 'Funnel' : 'Pyramid'} chart. ${rows.map((r) => `${r.label}: ${fmt(r.value)}`).join('; ')}`}
        style={{ display: 'block', overflow: 'visible' }}
        onMouseLeave={() => { setHov(-1); setTip(null) }}
      >
        <defs>
          <pattern id={`st${uid}`} width={stripeWidth * 2} height={stripeWidth * 2} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width={stripeWidth} height={stripeWidth * 2} fill="#ffffff" opacity="0.4" />
          </pattern>
        </defs>

        {bands.map((b) => {
          const c = cols[b.i]
          const dim = hov >= 0 && hov !== b.i
          // build from the wide end
          const order = inverted ? b.i : n - 1 - b.i
          const k = stag(p, order, n)
          const s = pop(k)
          const t = ease(clamp((k - 0.35) / 0.65, 0, 1))
          const bh = b.yb - b.yt
          const ex = b.edge + 8
          // number sits in the main face; lower down when the band is the pointed apex
          const ny = b.yt + bh * (hw(b.yt) < 2 ? 0.64 : 0.5)
          const fc = mix(c, '#ffffff', facetShade)
          return (
            <g key={b.i} opacity={dim ? 0.4 : 1} style={{ transition: 'opacity .2s' }} onMouseEnter={(e) => enter(e, b)} onMouseMove={move}>
              <g transform={`translate(${cx} ${b.cy}) scale(${s}) translate(${-cx} ${-b.cy})`} opacity={k > 0 ? 1 : 0}>
                {facet ? (
                  <>
                    <path d={b.left} fill={c} />
                    <path d={b.right} fill={fc} />
                    {stripes && <path d={b.right} fill={`url(#st${uid})`} />}
                  </>
                ) : (
                  <>
                    <path d={b.full} fill={c} />
                    {stripes && <path d={b.right} fill={`url(#st${uid})`} />}
                  </>
                )}
                {showNumbers && bh > size * 1.3 && hw(ny) > size * 1.1 && (
                  <text x={cx - hw(ny) * 0.35} y={ny} dy="0.36em" textAnchor="middle" fontSize={Math.min(size * 1.15, bh * 0.55)} fontWeight="800" fill={inkOn(c, textColor)} style={{ pointerEvents: 'none' }}>
                    {String(b.i + 1).padStart(2, '0')}
                  </text>
                )}
              </g>
              <g opacity={t} style={{ pointerEvents: 'none' }}>
                {showLeaders && (
                  <path
                    d={`M${ex},${b.cy}H${Math.max(ex, lx - 34)}L${lx - 16},${ly[b.i]}`}
                    fill="none"
                    stroke={mix(mutedColor, background, 0.25)}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray="0 6"
                  />
                )}
                <circle cx={lx - 9} cy={ly[b.i]} r={5} fill={c} />
                {showValues ? (
                  <>
                    <text x={lx + 2} y={ly[b.i] - 1} fontSize={size * 1.3} fontWeight="800" fill={textColor} style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {fmt(b.value * ease(k))}
                    </text>
                    <text x={lx + 2} y={ly[b.i] + size * 1.15} fontSize={size * 0.9} fontWeight="600" fill={hov === b.i ? textColor : mutedColor}>
                      {b.label}
                    </text>
                  </>
                ) : (
                  <text x={lx + 2} y={ly[b.i]} dy="0.35em" fontSize={size * 1.05} fontWeight="700" fill={textColor}>
                    {b.label}
                  </text>
                )}
              </g>
              {/* hit areas: the full band row, and the label */}
              <rect x={0} y={b.yt - g / 2} width={W} height={bh + g} fill="transparent" />
              <rect x={lx - 18} y={ly[b.i] - minGap / 2} width={W - lx + 18} height={minGap} fill="transparent" />
            </g>
          )
        })}
      </svg>
    </Card>
  )
}
