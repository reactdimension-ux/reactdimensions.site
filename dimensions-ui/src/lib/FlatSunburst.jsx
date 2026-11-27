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

// text colour for a label sitting on a filled shape: dark ink on light fills, white otherwise
function inkOn(c, dark) {
  const [r, g, b] = [1, 3, 5].map((i) => (parseInt(String(c).slice(i, i + 2), 16) || 0) / 255)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.62 ? dark : '#ffffff'
}
// "Group/Item:value, ..." -> a tree with summed values
function parseTree(data, rootName = 'All') {
  const root = { name: rootName, children: [], value: 0, depth: 0, path: rootName }
  String(data ?? '')
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((entry) => {
      const k = entry.lastIndexOf(':')
      const parts = (k < 0 ? entry : entry.slice(0, k)).split('/').map((s) => s.trim()).filter(Boolean)
      const v = k < 0 ? 1 : Math.max(0, num(entry.slice(k + 1)))
      let cur = root
      parts.forEach((name, d) => {
        let c = cur.children.find((x) => x.name === name)
        if (!c) {
          c = { name, children: [], value: 0, depth: d + 1, parent: cur, path: `${cur.path}/${name}` }
          cur.children.push(c)
        }
        cur = c
      })
      cur.own = (cur.own ?? 0) + v
    })
  const sum = (n) => (n.value = (n.own ?? 0) + n.children.reduce((a, c) => a + sum(c), 0))
  sum(root)
  const tag = (n, b) => {
    n.branch = b
    n.children.sort((a, c) => c.value - a.value)
    n.children.forEach((c, i) => tag(c, n.depth === 0 ? i : b))
  }
  tag(root, 0)
  return root
}
// one ring segment as a filled path with rounded corners and parallel-sided gaps.
// Angles in radians, 0 = twelve o'clock, growing clockwise. `h` is half the gap
// width in px, `c` the corner radius. Falls back to smaller corners, then none.
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

// Flat infographic sunburst: a hierarchy as chunky flat rings split by clean gaps,
// deeper rings in lighter tints of their branch colour and the inner ring carrying a
// diagonal stripe band. Rings sweep in and pop outwards; click a slice to zoom in
// and the centre to step back out. Hover keeps the slice and its ancestors lit.
export default function FlatSunburst({
  data = 'Europe/Germany/Berlin:38, Europe/Germany/Munich:22, Europe/Germany/Hamburg:14, Europe/France/Paris:41, Europe/France/Lyon:12, Europe/UK/London:52, Europe/UK/Manchester:13, Americas/USA/New York:64, Americas/USA/San Francisco:47, Americas/USA/Austin:21, Americas/Canada/Toronto:26, Americas/Brazil/São Paulo:24, Asia/Japan/Tokyo:45, Asia/Japan/Osaka:14, Asia/India/Bangalore:33, Asia/Singapore/Singapore:28, Oceania/Australia/Sydney:19',
  rootName = 'All offices',
  title = 'Where the team works',
  subtitle = 'Headcount by region, country and city. Click to zoom',
  rings = 3,
  holeSize = 0.3,
  padAngle = 1.2,
  ringGap = 3,
  cornerRadius = 4,
  showLabels = true,
  fadeDepth = 0.24,
  showLegend = true,
  stripes = true,
  stripeWidth = 4,
  zoomable = true,
  tooltip = true,
  animate = true,
  duration = 1200,
  zoomDuration = 650,
  decimals = 0,
  prefix = '',
  suffix = '',
  width = 560,
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
  const root = useMemo(() => {
    const r = parseTree(data, rootName)
    const part = (n, x0) => {
      n.x0 = x0
      n.x1 = x0 + n.value / (r.value || 1)
      let x = x0
      n.children.forEach((c) => { part(c, x); x = c.x1 })
      return n
    }
    return part(r, 0)
  }, [data, rootName])
  const all = useMemo(() => { const out = []; const w = (n) => { out.push(n); n.children.forEach(w) }; w(root); return out }, [root])
  const cols = paletteOf(Math.max(6, root.children.length), [color, color2, color3, color4, color5, color6])
  const p = useReveal(animate, duration, data)
  const [focus, setFocus] = useState(root)
  useEffect(() => setFocus(root), [root])
  const [view, setView] = useState({ x0: 0, x1: 1, d: 0 })
  const [hov, setHov] = useState(null)
  const [tip, setTip] = useState(null)

  // animate the visible window when the focus changes
  useEffect(() => {
    const from = { ...view }
    const to = { x0: focus.x0, x1: focus.x1, d: focus.depth }
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce) return setView(to)
    let raf
    let t0
    const tick = (t) => {
      t0 ??= t
      const k = ease(Math.min(1, (t - t0) / Math.max(1, zoomDuration)))
      setView({ x0: from.x0 + (to.x0 - from.x0) * k, x1: from.x1 + (to.x1 - from.x1) * k, d: from.d + (to.d - from.d) * k })
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [focus]) // eslint-disable-line react-hooks/exhaustive-deps

  const W = Math.max(240, (boxW || width) - size * 3)
  const trailH = size * 1.8
  const H = Math.max(180, height)
  const R = Math.min(W, H - trailH) / 2 - 8
  const cx = W / 2
  const cy = (H - trailH) / 2 + 2
  const L = clamp(Math.round(rings), 1, 6)
  const hole = R * clamp(holeSize, 0.1, 0.6)
  const ringW = (R - hole) / L
  const sweep = ease(clamp(p / 0.7, 0, 1))
  const ang = (x) => clamp((x - view.x0) / (view.x1 - view.x0 || 1), 0, 1) * Math.PI * 2 * sweep
  const halfGap = (clamp(padAngle, 0, 10) * Math.PI * R) / 360 / 2
  const colorOf = (n) => mix(cols[n.branch % cols.length], background, clamp((n.depth - 1) * fadeDepth, 0, 0.7))
  const inHover = (n) => { if (!hov) return true; for (let a = hov; a; a = a.parent) if (a === n) return true; return false }
  const trail = []
  for (let a = hov ?? focus; a; a = a.parent) trail.unshift(a)
  const shown = hov ?? focus
  const move = (e) => tooltip && setTip((t) => (t ? { ...t, ...tipAt(e, wrap, t.title, t.rows) } : t))
  const leave = () => { setHov(null); setTip(null) }
  const legendItems = (focus.children.length ? focus.children : [focus]).map((n) => ({ n, c: colorOf(n) }))
  const big = fmt(shown.value * ease(p))
  const vfs = Math.max(size, Math.min(size * 2, hole * 0.42, (hole * 2 - 16) / (big.length * 0.62)))

  return (
    <Card wrapRef={(el) => { wrap.current = el; boxRef.current = el }} {...{ width, background, textColor, mutedColor, size, title, subtitle, tip }}>
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${title}. Sunburst of ${root.name}, total ${fmt(root.value)}: ${root.children.map((c) => `${c.name} ${fmt(c.value)}`).join(', ')}.`}
        style={{ display: 'block', overflow: 'visible' }}
        onMouseLeave={leave}
      >
        <defs>
          <pattern id={`st${uid}`} width={stripeWidth * 2} height={stripeWidth * 2} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width={stripeWidth} height={stripeWidth * 2} fill="#ffffff" opacity="0.35" />
          </pattern>
        </defs>
        {all.map((n, idx) => {
          const ring = n.depth - view.d
          if (n === root || ring < 0.5 || ring > L + 0.5) return null
          const a0 = ang(n.x0)
          const a1 = ang(n.x1)
          if (a1 - a0 < 0.002) return null
          const k = stag(p, Math.round(ring) - 1, L)
          if (k <= 0) return null
          const r0 = hole + (ring - 1) * ringW + ringGap / 2
          const rFull = Math.min(R, r0 + ringW - ringGap)
          const r1 = r0 + (rFull - r0) * pop(k)
          const c = colorOf(n)
          const full = a1 - a0 > Math.PI * 2 - 1e-3
          const d = full ? fullRing(cx, cy, r1, r0) : segPath(cx, cy, r1, r0, a0, a1, halfGap, cornerRadius)
          if (!d) return null
          const on = inHover(n)
          const mid = (a0 + a1) / 2
          const canZoom = zoomable && n.children.length > 0
          const band = (rFull - r0) * 0.3
          const striped = stripes && Math.round(ring) === 1
          // label: along the ring when the slice is wide enough, else along the radius
          const lo = r0
          const hi = striped ? rFull - band : rFull
          const rm = (lo + hi) / 2
          const thick = hi - lo
          const lfs = Math.min(size * 0.82, thick * 0.5, (rFull - r0) * 0.42)
          const tw = n.name.length * lfs * 0.64
          const arcAt = (a1 - a0) * rm - halfGap * 2
          const tangential = arcAt > tw + 10 && (tw * tw) / (8 * rm) < thick * 0.22 && thick > lfs * 1.3
          const radial = !tangential && tw + 8 < thick && arcAt > lfs * 1.4
          const fits = showLabels && (tangential || radial)
          const deg = (mid * 180) / Math.PI
          const flip = tangential ? deg > 90 && deg < 270 : deg > 180
          const labelTf = tangential
            ? `translate(${cx},${cy}) rotate(${deg}) translate(0,${-rm}) rotate(${flip ? 180 : 0})`
            : `translate(${cx},${cy}) rotate(${deg - 90}) translate(${rm},0) rotate(${flip ? 180 : 0})`
          return (
            <g
              key={n.path}
              opacity={on ? 1 : 0.4}
              style={{ transition: 'opacity .2s', cursor: canZoom ? 'zoom-in' : 'default' }}
              onClick={() => canZoom && setFocus(n)}
              onMouseEnter={(e) => {
                setHov(n)
                if (tooltip)
                  setTip(tipAt(e, wrap, n.name, [
                    { color: c, label: 'Value', value: fmt(n.value) },
                    { label: `Of ${n.parent.name}`, value: `${((n.value / (n.parent.value || 1)) * 100).toFixed(1)}%` },
                    { label: 'Of everything', value: `${((n.value / (root.value || 1)) * 100).toFixed(1)}%` },
                  ]))
              }}
              onMouseMove={move}
            >
              <path d={d} fill={c} />
              {striped && (
                <>
                  <clipPath id={`c${uid}${idx}`}><path d={d} /></clipPath>
                  <g clipPath={`url(#c${uid}${idx})`}>
                    <circle cx={cx} cy={cy} r={r1 - band / 2} fill="none" stroke={mix(c, '#000000', 0.12)} strokeWidth={band} />
                    <circle cx={cx} cy={cy} r={r1 - band / 2} fill="none" stroke={`url(#st${uid})`} strokeWidth={band} />
                  </g>
                </>
              )}
              {/* hit area: the slice plus a margin round it, covering the gaps */}
              <path d={d} fill="transparent" stroke="transparent" strokeWidth={halfGap * 2 + 3} strokeLinejoin="round" />
              {fits && k >= 1 && p > 0.85 && (
                <text
                  transform={labelTf}
                  textAnchor="middle"
                  dy="0.35em"
                  fontSize={lfs}
                  fontWeight="700"
                  fill={inkOn(c, textColor)}
                  style={{ pointerEvents: 'none' }}
                >
                  {n.name}
                </text>
              )}
            </g>
          )
        })}

        {/* centre: current focus (or hovered slice); click to go up */}
        <circle cx={cx} cy={cy} r={hole - ringGap} fill={background} style={{ cursor: focus.parent ? 'zoom-out' : 'default' }} onClick={() => focus.parent && setFocus(focus.parent)} />
        <circle cx={cx} cy={cy} r={hole - ringGap - 4} fill="none" stroke={mix(background, mutedColor, 0.25)} strokeWidth="2" strokeDasharray={focus.parent ? '5 5' : undefined} style={{ pointerEvents: 'none' }} />
        <g style={{ pointerEvents: 'none' }}>
          <text x={cx} y={cy} dy="0.05em" textAnchor="middle" fontSize={vfs} fontWeight="800" fill={textColor} style={{ fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
            {big}
          </text>
          <text x={cx} y={cy + size * 1.1} textAnchor="middle" fontSize={Math.min(size * 0.8, hole * 0.2)} fontWeight="600" fill={mutedColor}>
            {shown.name.length > 14 ? shown.name.slice(0, 13) + '…' : shown.name}
          </text>
          {focus.parent && !hov && hole > size * 3.2 && (
            <text x={cx} y={cy + size * 2.2} textAnchor="middle" fontSize={Math.min(size * 0.7, hole * 0.17)} fill={mutedColor}>
              tap to go back
            </text>
          )}
        </g>
        <text x={0} y={H - 2} fontSize={size * 0.82} fontWeight="600" fill={mutedColor} style={{ pointerEvents: 'none' }}>
          {trail.map((t, i) => (
            <tspan key={t.path} fill={i === trail.length - 1 ? textColor : mutedColor} fontWeight={i === trail.length - 1 ? 700 : 600}>
              {i > 0 ? `  ›  ${t.name}` : t.name}
            </tspan>
          ))}
        </text>
      </svg>

      {showLegend && legendItems.length >= 2 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.4em 1.2em', marginTop: '0.8em', color: mutedColor, fontSize: '0.88em', fontWeight: 600 }} onMouseLeave={leave}>
          {legendItems.map(({ n, c }) => (
            <span key={n.path} onMouseEnter={() => setHov(n)} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45em', cursor: 'default', opacity: hov && !inHover(n) && hov !== n ? 0.4 : 1, transition: 'opacity .2s' }}>
              <i style={{ width: '0.75em', height: '0.75em', borderRadius: '50%', background: c, flex: 'none' }} />
              {n.name}
            </span>
          ))}
        </div>
      )}
    </Card>
  )
}
