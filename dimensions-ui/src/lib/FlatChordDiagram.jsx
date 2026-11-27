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

// "Name:v|v|v" rows -> [{ label, values: [..] }]; an array of { label, values } works too
function parseMatrix(data) {
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
// one ring segment as a filled path with rounded corners. Angles in radians,
// 0 = twelve o'clock, growing clockwise. `h` is half the gap width in px, `c` the corner radius.
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

// Flat infographic chord diagram: chunky rounded arcs (with a striped outer band) round a
// circle, joined by flat tinted ribbons sized by how much flows between groups. Rows are
// "Name:v|v|v" (row i, column j = flow from i to j). Ribbons take the colour of the larger
// side, the source or the target. Arcs sweep round, ribbons pop out from the centre, and
// hovering a group isolates its connections.
export default function FlatChordDiagram({
  data = 'Design:0|42|18|9|6, Engineering:38|0|55|24|12, Product:22|48|0|30|20, Marketing:8|14|26|0|34, Sales:4|10|18|40|0',
  title = 'Who asks whom for help',
  subtitle = 'Messages between teams last quarter',
  directed = true,
  ribbonColor = 'larger',
  ribbonTint = 0.5,
  padAngle = 3,
  arcWidth = 22,
  cornerRadius = 6,
  stripes = true,
  stripeWidth = 4,
  showLabels = true,
  showValues = false,
  showTicks = true,
  tooltip = true,
  animate = true,
  duration = 1400,
  decimals = 0,
  prefix = '',
  suffix = '',
  width = 520,
  height = 360,
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
  const rows = useMemo(() => parseMatrix(data), [data])
  const N = rows.length
  const M = useMemo(
    () =>
      rows.map((r, i) =>
        rows.map((_, j) => {
          const a = Math.max(0, r.values[j] ?? 0)
          if (directed) return a
          const b = Math.max(0, rows[j].values[i] ?? 0)
          return (a + b) / 2
        }),
      ),
    [rows, directed],
  )
  const cols = paletteOf(N, [color, color2, color3, color4, color5, color6])
  const p = useReveal(animate, duration, `${data}|${directed}`)
  const [hov, setHov] = useState(null) // { g } or { i, j }
  const [tip, setTip] = useState(null)

  const W = Math.max(260, (boxW || width) - size * 3)
  const H = Math.max(200, height)
  const totals = M.map((row, i) => row.reduce((a, v) => a + v, 0) + (directed ? M.reduce((a, r) => a + r[i], 0) : 0))
  const labTxt = (i) => rows[i].label + (showValues ? `  ${fmt(totals[i])}` : '')
  const labRoom = showLabels ? Math.min(18, Math.max(1, ...rows.map((_, i) => labTxt(i).length))) * size * 0.6 + size * 1.6 : 10
  const R = Math.max(50, Math.min(W / 2 - labRoom, H / 2 - (showLabels ? size * 2.2 : 8)))
  const Ri = R - Math.min(arcWidth, R * 0.4)
  const r0 = Ri - 3
  const cx = W / 2
  const cy = H / 2

  // angles (0 = twelve o'clock, clockwise): each group gets a share of the circle by its total
  const geo = useMemo(() => {
    const all = totals.reduce((a, v) => a + v, 0) || 1
    const pad = (clamp(padAngle, 0, 30) * Math.PI) / 180
    const k = Math.max(0, Math.PI * 2 - pad * N) / all
    let a = pad / 2
    const groups = totals.map((t, i) => {
      const g = { i, a0: a, a1: a + t * k, total: t }
      a = g.a1 + pad
      return g
    })
    // sub-arcs: within group i, first its outgoing to each j, then incoming from each j
    const sub = {}
    groups.forEach((g) => {
      let s = g.a0
      for (let j = 0; j < N; j++) {
        const v = M[g.i][j]
        sub[`o${g.i}-${j}`] = [s, s + v * k]
        s += v * k
      }
      for (let j = 0; directed && j < N; j++) {
        const v = M[j][g.i]
        sub[`i${g.i}-${j}`] = [s, s + v * k]
        s += v * k
      }
    })
    return { groups, sub }
  }, [M, N, padAngle, directed]) // eslint-disable-line react-hooks/exhaustive-deps

  const pt = (a, r) => `${(Math.sin(a) * r).toFixed(2)},${(-Math.cos(a) * r).toFixed(2)}`
  const ribbonPath = (s0, s1, t0, t1, r) =>
    `M${pt(s0, r)}A${r},${r} 0 ${s1 - s0 > Math.PI ? 1 : 0} 1 ${pt(s1, r)}Q0,0 ${pt(t0, r)}A${r},${r} 0 ${t1 - t0 > Math.PI ? 1 : 0} 1 ${pt(t1, r)}Q0,0 ${pt(s0, r)}Z`
  const sweep = ease(clamp(p / 0.6, 0, 1))
  const bloom = clamp((p - 0.35) / 0.65, 0, 1)
  const ribbons = []
  for (let i = 0; i < N; i++)
    for (let j = 0; j < N; j++) {
      if (i === j || !M[i][j]) continue
      if (!directed && j < i) continue
      const [s0, s1] = geo.sub[`o${i}-${j}`]
      const [t0, t1] = directed ? geo.sub[`i${j}-${i}`] : geo.sub[`o${j}-${i}`]
      const c = ribbonColor === 'source' ? cols[i] : ribbonColor === 'target' ? cols[j] : M[i][j] >= M[j][i] ? cols[i] : cols[j]
      ribbons.push({ k: ribbons.length, i, j, s0, s1, t0, t1, c })
    }
  const onR = (rb) => !hov || (hov.g != null ? rb.i === hov.g || rb.j === hov.g : rb.i === hov.i && rb.j === hov.j)
  const order = hov ? [...ribbons].sort((a, b) => onR(a) - onR(b)) : ribbons
  const tint = clamp(ribbonTint, 0.05, 1)
  const move = (e) => tooltip && setTip((t) => (t ? { ...t, ...tipAt(e, wrap, t.title, t.rows) } : t))
  const sent = (i) => M[i].reduce((a, v) => a + v, 0)
  const got = (i) => M.reduce((a, r) => a + r[i], 0)
  const band = (R - Ri) * 0.38

  return (
    <Card wrapRef={(el) => { wrap.current = el; boxRef.current = el }} {...{ width, background, textColor, mutedColor, size, title, subtitle, tip }}>
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${title}. Chord diagram. ${rows.map((r, i) => (directed ? `${r.label}: sent ${fmt(sent(i))}, received ${fmt(got(i))}` : `${r.label}: ${fmt(sent(i))}`)).join('; ')}`}
        style={{ display: 'block', margin: '0 auto', overflow: 'visible' }}
        onMouseLeave={() => { setHov(null); setTip(null) }}
      >
        <defs>
          <pattern id={`st${uid}`} width={stripeWidth * 2} height={stripeWidth * 2} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width={stripeWidth} height={stripeWidth * 2} fill="#ffffff" opacity="0.35" />
          </pattern>
        </defs>
        <g transform={`translate(${cx},${cy})`}>
          {bloom > 0 && (
            <g transform={`scale(${0.3 + 0.7 * pop(bloom)})`} opacity={ease(bloom)}>
              {order.map((rb) => {
                const on = onR(rb)
                return (
                  <path
                    key={rb.k}
                    d={ribbonPath(rb.s0, rb.s1, rb.t0, rb.t1, r0)}
                    fill={mix(background, rb.c, hov && on ? Math.min(1, tint + 0.3) : tint)}
                    stroke={background}
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                    opacity={on ? 1 : 0.4}
                    style={{ transition: 'opacity .2s, fill .2s' }}
                    onMouseEnter={(e) => {
                      setHov({ i: rb.i, j: rb.j })
                      if (tooltip)
                        setTip(tipAt(e, wrap, `${rows[rb.i].label} ↔ ${rows[rb.j].label}`, [
                          { color: cols[rb.i], label: `${rows[rb.i].label} → ${rows[rb.j].label}`, value: fmt(M[rb.i][rb.j]) },
                          ...(directed ? [{ color: cols[rb.j], label: `${rows[rb.j].label} → ${rows[rb.i].label}`, value: fmt(M[rb.j][rb.i]) }] : []),
                        ]))
                    }}
                    onMouseMove={move}
                  />
                )
              })}
            </g>
          )}
          {geo.groups.map((g) => {
            const a1 = g.a0 + (g.a1 - g.a0) * sweep
            const mid = (g.a0 + g.a1) / 2
            const on = !hov || hov.g == null || hov.g === g.i
            const c = cols[g.i]
            const d = a1 - g.a0 > 0.002 ? segPath(0, 0, R, Ri, g.a0, a1, 0, cornerRadius) : ''
            const sx = Math.sin(mid)
            const sy = -Math.cos(mid)
            const lr = R + (showTicks ? 12 : 9)
            return (
              <g
                key={g.i}
                opacity={on ? 1 : 0.4}
                style={{ transition: 'opacity .2s' }}
                onMouseEnter={(e) => {
                  setHov({ g: g.i })
                  if (tooltip)
                    setTip(tipAt(e, wrap, rows[g.i].label, directed
                      ? [{ color: c, label: 'Sent', value: fmt(sent(g.i)) }, { label: 'Received', value: fmt(got(g.i)) }]
                      : [{ color: c, label: 'Total', value: fmt(sent(g.i)) }]))
                }}
                onMouseMove={move}
              >
                {d && <path d={d} fill={c} />}
                {d && stripes && (
                  <>
                    <clipPath id={`c${uid}${g.i}`}><path d={d} /></clipPath>
                    <g clipPath={`url(#c${uid}${g.i})`}>
                      <circle r={R - band / 2} fill="none" stroke={mix(c, '#000000', 0.12)} strokeWidth={band} />
                      <circle r={R - band / 2} fill="none" stroke={`url(#st${uid})`} strokeWidth={band} />
                    </g>
                  </>
                )}
                {/* hit area: the arc plus a margin round it */}
                {d && <path d={d} fill="transparent" stroke="transparent" strokeWidth="8" />}
                {showTicks &&
                  Array.from({ length: Math.max(0, Math.floor((g.a1 - g.a0) / 0.12)) }, (_, k) => {
                    const a = g.a0 + (k + 0.5) * 0.12
                    if (a > a1) return null
                    return <circle key={k} cx={Math.sin(a) * (R + 5)} cy={-Math.cos(a) * (R + 5)} r="1.4" fill={mutedColor} opacity="0.55" />
                  })}
                {showLabels && (
                  <text
                    x={sx * lr}
                    y={sy * lr}
                    textAnchor={sx > 0.15 ? 'start' : sx < -0.15 ? 'end' : 'middle'}
                    dy={sy > 0.6 ? '0.9em' : sy < -0.6 ? '-0.25em' : '0.35em'}
                    fontSize={size * 0.95}
                    fontWeight="700"
                    fill={textColor}
                    opacity={sweep}
                    style={{ pointerEvents: 'none' }}
                  >
                    {rows[g.i].label}
                    {showValues && <tspan fill={mutedColor} fontWeight="800" style={{ fontVariantNumeric: 'tabular-nums' }}>{`  ${fmt(g.total)}`}</tspan>}
                  </text>
                )}
              </g>
            )
          })}
        </g>
      </svg>
    </Card>
  )
}
