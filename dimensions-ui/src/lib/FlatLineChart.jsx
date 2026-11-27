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

// Multi-series rows: "Jan:12|8, Feb:18|14" -> [{ label: 'Jan', values: [12, 8] }, ...]
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
  const lo = Math.floor(lo0 / s) * s
  let hi = Math.ceil(hi0 / s) * s
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

// Flat infographic line chart: thick rounded lines, big hollow markers, a flat area
// under the first series, arrowhead axes and an optional chunky "growth arrow" that
// rides above the last few points. Lines draw on, markers pop as the line reaches them.
export default function FlatLineChart({
  data = 'Jan:12|8, Feb:18|14, Mar:15|19, Apr:26|22, May:24|30, Jun:38|34',
  series = 'Online, Retail',
  title = 'Sales growth',
  subtitle = 'Online vs retail orders, first half of the year',
  curve = 'straight',
  lineWidth = 4,
  showArea = true,
  areaOpacity = 0.14,
  showMarkers = true,
  markerSize = 7,
  showValues = false,
  growthArrow = true,
  arrowColor = '#f08a24',
  showGrid = true,
  showAxis = true,
  axisArrows = true,
  tooltip = true,
  animate = true,
  duration = 1400,
  decimals = 0,
  prefix = '',
  suffix = '',
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
  gridColor = '#eef0f6',
  textColor = '#2b2f3a',
  mutedColor = '#8a90a0',
}) {
  const uid = useId().replace(/:/g, '')
  const wrap = useRef(null)
  const [boxRef, boxW] = useWidth()
  const fmt = makeFmt({ decimals, prefix, suffix })
  const rows = useMemo(() => parseMulti(data), [data])
  const S = Math.max(1, ...rows.map((r) => r.values.length))
  const names = String(series ?? '').split(',').map((s) => s.trim())
  const sNames = Array.from({ length: S }, (_, s) => names[s] || `Series ${s + 1}`)
  const cols = paletteOf(S, [color, color2, color3, color4, color5, color6])
  const p = useReveal(animate, duration, `${data}|${curve}`)
  const [hov, setHov] = useState(-1)
  const [hovS, setHovS] = useState(-1)
  const [tip, setTip] = useState(null)

  const n = rows.length
  const all = rows.flatMap((r) => r.values)
  const sc = niceScale(Math.min(0, ...all), Math.max(1, ...all) * 1.05)
  const W = Math.max(240, (boxW || width) - size * 3)
  const H = height
  const lw = Math.max(1, lineWidth)
  const ms = Math.max(0, markerSize)
  const aw = Math.max(7, lw * 2.2)
  const tickW = showGrid ? size * 0.6 * Math.max(...sc.ticks.map((t) => fmt(t).length)) + 12 : 0
  const L = Math.max(6, tickW)
  const T = size * 1.4 + (growthArrow ? aw * 2 + ms + (showValues ? size * 1.3 : 0) : 0) + (showValues ? size : 0)
  const R = growthArrow ? aw * 3.2 : size * 1.4
  const B = size * 2.1
  const pw = W - L - R
  const ph = Math.max(40, H - T - B)
  const pad = ms + 12
  const step = n > 1 ? (pw - pad * 2) / (n - 1) : 0
  const xOf = (i) => (n > 1 ? L + pad + step * i : L + pw / 2)
  const yOf = (v) => T + ph - ((v - sc.lo) / (sc.hi - sc.lo)) * ph
  const base = yOf(Math.max(sc.lo, 0))

  const pts = Array.from({ length: S }, (_, s) => rows.map((r, i) => ({ x: xOf(i), y: yOf(r.values[s] ?? 0), v: r.values[s] ?? 0 })))
  const pathOf = (q) => {
    if (!q.length) return ''
    if (curve !== 'smooth' || q.length < 3) return q.map((o, i) => `${i ? 'L' : 'M'}${o.x},${o.y}`).join('')
    let d = `M${q[0].x},${q[0].y}`
    for (let i = 0; i < q.length - 1; i++) {
      const p0 = q[i - 1] || q[i]
      const p1 = q[i]
      const p2 = q[i + 1]
      const p3 = q[i + 2] || p2
      const cy = (v) => clamp(v, T - 4, T + ph)
      d += `C${p1.x + (p2.x - p0.x) / 6},${cy(p1.y + (p2.y - p0.y) / 6)} ${p2.x - (p3.x - p1.x) / 6},${cy(p2.y - (p3.y - p1.y) / 6)} ${p2.x},${p2.y}`
    }
    return d
  }
  const lines = pts.map(pathOf)

  // timeline: lines draw over the first 75%, markers pop as the line passes them
  const lp = ease(clamp(p / 0.75, 0, 1))
  const mk = (i) => pop(clamp((p - (n > 1 ? (0.75 * i) / (n - 1) : 0)) / 0.25, 0, 1))

  // growth arrow: a fat band riding above the last few points of the upper envelope of
  // every series (the highest point at each x), so it never cuts through another line.
  // Straight runs between envelope points clear every straight line segment below them.
  let arrow = null
  if (growthArrow && n >= 2) {
    const off = ms + lw / 2 + aw / 2 + 10 + (showValues ? size * 1.3 : 0) + (curve === 'smooth' ? lw : 0)
    const env = rows.map((_, i) => ({ x: xOf(i), y: Math.min(...pts.map((q) => q[i].y)) }))
    const q = env.slice(-Math.min(4, n)).map((o) => ({ x: o.x, y: Math.max(4, o.y - off) }))
    const a = q[q.length - 2]
    const z = q[q.length - 1]
    const len = Math.hypot(z.x - a.x, z.y - a.y) || 1
    const d = { x: (z.x - a.x) / len, y: (z.y - a.y) / len }
    const hl = aw * 2.1
    const hw = aw * 1.45
    const tip = { x: z.x + d.x * hl * 0.9, y: z.y + d.y * hl * 0.9 }
    const bs = { x: tip.x - d.x * hl, y: tip.y - d.y * hl }
    const nn = { x: -d.y, y: d.x }
    const shaft = [...q.slice(0, -1), { x: bs.x + d.x * 2, y: bs.y + d.y * 2 }]
    arrow = {
      shaft: shaft.map((o, i) => `${i ? 'L' : 'M'}${o.x},${o.y}`).join(''),
      head: `M${tip.x},${tip.y}L${bs.x + nn.x * hw},${bs.y + nn.y * hw}L${bs.x - nn.x * hw},${bs.y - nn.y * hw}Z`,
      tip,
    }
  }
  const ak = clamp((p - 0.55) / 0.35, 0, 1)
  const hk = pop(clamp((p - 0.8) / 0.2, 0, 1))

  const enter = (e, i) => {
    setHov(i)
    if (tooltip) setTip(tipAt(e, wrap, rows[i].label, Array.from({ length: S }, (_, s) => ({ color: cols[s], label: sNames[s], value: fmt(rows[i].values[s] ?? 0) }))))
  }
  const markerSW = Math.max(3, lw * 0.85)

  return (
    <Card wrapRef={(el) => { wrap.current = el; boxRef.current = el }} {...{ width, background, textColor, mutedColor, size, title, subtitle, tip }}>
      {S >= 2 && <Legend items={sNames.map((nm, s) => ({ name: nm, color: cols[s] }))} mutedColor={mutedColor} onHover={setHovS} />}
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${title}. Line chart. ${rows.map((r) => `${r.label}: ${r.values.map((v, s) => `${sNames[s]} ${fmt(v)}`).join(', ')}`).join('; ')}`}
        style={{ display: 'block', overflow: 'visible' }}
        onMouseLeave={() => { setHov(-1); setTip(null) }}
      >
        <defs>
          <marker id={`ar${uid}`} viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,1 L9,5 L0,9 Z" fill={mutedColor} />
          </marker>
          <clipPath id={`rv${uid}`}>
            <rect x={L - pad} y={-H} width={(pw + pad * 2) * lp + pad} height={H * 3} />
          </clipPath>
        </defs>

        {showGrid &&
          sc.ticks.map((t) => (
            <g key={t}>
              {t !== sc.lo && <line x1={L} x2={L + pw} y1={yOf(t)} y2={yOf(t)} stroke={gridColor} strokeWidth="2" strokeDasharray="5 7" strokeLinecap="round" />}
              <text x={L - 10} y={yOf(t)} dy="0.35em" textAnchor="end" fontSize={size * 0.82} fill={mutedColor} style={{ fontVariantNumeric: 'tabular-nums' }}>
                {fmt(t)}
              </text>
            </g>
          ))}

        {hov >= 0 && <line x1={xOf(hov)} x2={xOf(hov)} y1={T - size * 0.4} y2={base} stroke={mutedColor} strokeWidth="1.5" strokeDasharray="4 5" />}

        {showArea && n > 1 && (
          <path
            d={`${lines[0]}L${pts[0][n - 1].x},${base}L${pts[0][0].x},${base}Z`}
            fill={cols[0]}
            opacity={(hovS >= 0 && hovS !== 0 ? 0.4 : 1) * areaOpacity}
            clipPath={`url(#rv${uid})`}
            style={{ transition: 'opacity .2s' }}
          />
        )}

        {arrow && ak > 0 && (
          <g fill={arrowColor} stroke={arrowColor} style={{ pointerEvents: 'none' }}>
            <path d={arrow.shaft} fill="none" strokeWidth={aw} strokeLinejoin="round" strokeLinecap="round" pathLength={ak < 1 ? 1 : undefined} strokeDasharray={ak < 1 ? '1 1' : undefined} strokeDashoffset={ak < 1 ? 1 - ease(ak) : undefined} />
            {hk > 0 && (
              <path
                d={arrow.head}
                stroke="none"
                strokeLinejoin="round"
                transform={`translate(${arrow.tip.x} ${arrow.tip.y}) scale(${hk}) translate(${-arrow.tip.x} ${-arrow.tip.y})`}
              />
            )}
          </g>
        )}

        {lines.map((d, s) => (
          <path
            key={s}
            d={d}
            pathLength={lp < 1 ? 1 : undefined}
            strokeDasharray={lp < 1 ? '1 1' : undefined}
            strokeDashoffset={lp < 1 ? 1 - lp : undefined}
            fill="none"
            stroke={cols[s]}
            strokeWidth={lw}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={hovS >= 0 && hovS !== s ? 0.4 : 1}
            style={{ transition: 'opacity .2s' }}
          />
        ))}

        {showMarkers &&
          pts.map((q, s) =>
            q.map((o, i) => {
              const k = mk(i)
              if (k <= 0) return null
              const dim = (hov >= 0 && hov !== i) || (hovS >= 0 && hovS !== s)
              return (
                <circle
                  key={`${s}-${i}`}
                  cx={o.x}
                  cy={o.y}
                  r={Math.max(0, ms * k * (hov === i ? 1.25 : 1))}
                  fill={background}
                  stroke={cols[s]}
                  strokeWidth={markerSW}
                  opacity={dim ? 0.4 : 1}
                  style={{ transition: 'opacity .2s, r .2s', pointerEvents: 'none' }}
                />
              )
            }),
          )}

        {showValues &&
          p > 0.3 &&
          pts.map((q, s) =>
            q.map((o, i) => {
              const above = o.y <= Math.min(...pts.map((qq) => qq[i].y))
              const dim = (hov >= 0 && hov !== i) || (hovS >= 0 && hovS !== s)
              return (
                <text
                  key={`v${s}-${i}`}
                  x={o.x}
                  y={above ? o.y - ms - markerSW - 5 : o.y + ms + markerSW + size + 2}
                  textAnchor="middle"
                  fontSize={size * 0.95}
                  fontWeight="700"
                  fill={textColor}
                  opacity={(dim ? 0.4 : 1) * clamp(mk(i) * 1.5 - 0.5, 0, 1)}
                  style={{ fontVariantNumeric: 'tabular-nums', pointerEvents: 'none' }}
                >
                  {fmt(o.v)}
                </text>
              )
            }),
          )}

        {rows.map((r, i) => (
          <text key={`l${i}`} x={xOf(i)} y={T + ph + size * 1.5} textAnchor="middle" fontSize={size * 0.9} fontWeight="600" fill={hov === i ? textColor : mutedColor} style={{ pointerEvents: 'none' }}>
            {r.label}
          </text>
        ))}

        {showAxis && (
          <g stroke={mutedColor} strokeWidth="2" strokeLinecap="round" fill="none">
            <path d={`M${L},${base}H${L + pw + R * 0.55}`} markerEnd={axisArrows ? `url(#ar${uid})` : undefined} />
            <path d={`M${L},${T + ph}V${T - size}`} markerEnd={axisArrows ? `url(#ar${uid})` : undefined} />
          </g>
        )}

        {/* hit columns: one per x, the full plot height */}
        {rows.map((r, i) => (
          <rect
            key={`h${i}`}
            x={n > 1 ? xOf(i) - (i === 0 ? pad : step / 2) : L}
            y={T - size}
            width={n > 1 ? (i === 0 || i === n - 1 ? step / 2 + pad : step) : pw}
            height={ph + size * 2.6}
            fill="transparent"
            onMouseEnter={(e) => enter(e, i)}
            onMouseMove={(e) => tooltip && setTip((t) => (t ? { ...t, ...tipAt(e, wrap, t.title, t.rows) } : t))}
          />
        ))}
      </svg>
    </Card>
  )
}
