import { useEffect, useId, useMemo, useRef, useState } from 'react'

// ---- shared chart helpers (kept inline so this file copies out on its own) ----
// Data is a plain string: rows are separated by commas, each row is "Label:value"
// or "Label:value|value|value" for several series, e.g. "Q1:42|31, Q2:58|44".
// An array of { label, values: [..] } works too.

const FONT = 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
const num = (v) => {
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : 0
}
function parseRows(data) {
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

// a rounded axis range with tidy tick steps
function niceRange(lo, hi, ticks = 4) {
  if (!(hi > lo)) hi = lo + 1
  const raw = (hi - lo) / ticks
  const mag = 10 ** Math.floor(Math.log10(raw))
  const n = raw / mag
  const step = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag
  return { lo: Math.floor(lo / step + 1e-9) * step, hi: Math.ceil(hi / step - 1e-9) * step, step }
}
const ticksOf = (r) => {
  const out = []
  for (let t = r.lo; t <= r.hi + r.step * 1e-6; t += r.step) out.push(Math.abs(t) < r.step * 1e-6 ? 0 : t)
  return out
}
function makeFmt({ valueFormat = 'number', decimals = 0, prefix = '', suffix = '' }) {
  const d = Math.max(0, Math.min(6, Math.round(decimals)))
  const nf =
    valueFormat === 'compact'
      ? new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: Math.max(1, d) })
      : new Intl.NumberFormat('en', { minimumFractionDigits: d, maximumFractionDigits: d })
  return (v) => `${prefix}${nf.format(v)}${suffix}`
}
const axisFmt = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })

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
const ease = (x) => 1 - (1 - x) ** 3
// each item starts a little after the one before it
const stag = (p, i, n) => ease(Math.min(1, Math.max(0, (p - (n > 1 ? (i / (n - 1)) * 0.45 : 0)) / 0.55)))
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))

// a rect path with a radius for each corner [top-left, top-right, bottom-right, bottom-left]
function rrect(x, y, w, h, r = [0, 0, 0, 0]) {
  w = Math.max(0, w)
  h = Math.max(0, h)
  const [a, b, c, d] = r.map((v) => Math.max(0, Math.min(v, w / 2, h / 2)))
  return `M${x + a},${y}H${x + w - b}Q${x + w},${y} ${x + w},${y + b}V${y + h - c}Q${x + w},${y + h} ${x + w - c},${y + h}H${x + d}Q${x},${y + h} ${x},${y + h - d}V${y + a}Q${x},${y} ${x + a},${y}Z`
}

// blend two #rrggbb colours
function mix(a, b, t) {
  const h = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16) || 0)
  const [A, B] = [h(a), h(b)]
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('')
}

// pointer position inside the card, for placing the tooltip
function tipAt(e, wrap, title, rows) {
  const box = wrap.current?.getBoundingClientRect()
  if (!box) return null
  return { x: clamp(e.clientX - box.left, 80, Math.max(80, box.width - 80)), y: e.clientY - box.top - 10, title, rows }
}

function Card({ wrapRef, width, background, color, textColor, mutedColor, size, title, subtitle, legend, children, tip }) {
  return (
    <div
      ref={wrapRef}
      style={{
        position: 'relative',
        width: `min(${width}px, 100%)`,
        boxSizing: 'border-box',
        padding: '1.35em 1.4em 1.2em',
        borderRadius: 18,
        color: textColor,
        fontFamily: FONT,
        fontSize: size,
        lineHeight: 1.35,
        background: `radial-gradient(120% 90% at 0% 0%, ${color}1c, transparent 55%), ${background}`,
        border: `1px solid ${mutedColor}26`,
        boxShadow: '0 28px 60px -28px #000c, inset 0 1px 0 #ffffff0f',
      }}
    >
      {(title || subtitle || legend) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.6em 1.2em', flexWrap: 'wrap', marginBottom: '0.9em' }}>
          <div style={{ minWidth: 0 }}>
            {title && <div style={{ fontSize: '1.25em', fontWeight: 650, letterSpacing: '-0.01em' }}>{title}</div>}
            {subtitle && <div style={{ color: mutedColor, fontSize: '0.88em', marginTop: '0.15em' }}>{subtitle}</div>}
          </div>
          {legend}
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
            padding: '0.55em 0.8em',
            borderRadius: 11,
            background: '#0c0d10ec',
            border: `1px solid ${mutedColor}33`,
            backdropFilter: 'blur(10px)',
            boxShadow: '0 14px 34px -10px #000d',
            fontSize: '0.88em',
            whiteSpace: 'nowrap',
            zIndex: 5,
          }}
        >
          <div style={{ fontWeight: 650, marginBottom: tip.rows?.length ? '0.3em' : 0 }}>{tip.title}</div>
          {tip.rows?.map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.55em', color: r.strong ? textColor : mutedColor, fontWeight: r.strong ? 650 : 400 }}>
              {r.color && <i style={{ width: '0.6em', height: '0.6em', borderRadius: '50%', background: r.color, flex: 'none' }} />}
              <span style={{ flex: 1 }}>{r.label}</span>
              <span style={{ color: textColor, fontVariantNumeric: 'tabular-nums', marginLeft: '1em' }}>{r.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Legend({ items, onHover, mutedColor }) {
  return (
    <div role="list" style={{ display: 'flex', gap: '0.35em 1em', flexWrap: 'wrap', fontSize: '0.85em', color: mutedColor, paddingTop: '0.2em' }}>
      {items.map((it, i) => (
        <span key={i} role="listitem" onMouseEnter={() => onHover?.(i)} onMouseLeave={() => onHover?.(null)} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45em' }}>
          <i style={{ width: '0.7em', height: '0.7em', borderRadius: '50%', background: it.color, boxShadow: `0 0 0.8em ${it.color}88` }} />
          {it.label}
        </span>
      ))}
    </div>
  )
}
// ---- end shared helpers ----

// ---- relationship helpers ----
// Points are "Label:x|y|size|group" (size and group optional; group is 1 to 4), e.g.
// "Atlas:42|61|30|1, Boreal:55|48|12|2". Leave `data` empty for a seeded demo set.

function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const gauss = (r) => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r())
const NAMES = ['Atlas', 'Boreal', 'Cinder', 'Delta', 'Ember', 'Fjord', 'Glint', 'Harbor', 'Iris', 'Jade', 'Kite', 'Lumen', 'Moss', 'Nova', 'Onyx', 'Pearl', 'Quartz', 'River', 'Sable', 'Tidal', 'Umber', 'Vale', 'Wren', 'Xenon', 'Yarrow', 'Zephyr']
const nameOf = (i) => NAMES[i % NAMES.length] + (i >= NAMES.length ? ` ${Math.floor(i / NAMES.length) + 1}` : '')

function synthPoints({ count, correlation, groups, seed, noise }) {
  const r = rng(Math.round(seed) * 97 + 1)
  const G = clamp(Math.round(groups), 1, 4)
  const cx = [38, 58, 46, 68]
  const cy = [42, 58, 72, 46]
  const rho = clamp(correlation, -0.99, 0.99)
  return Array.from({ length: Math.round(count) }, (_, i) => {
    const g = i % G
    const zx = gauss(r)
    const zy = rho * zx + Math.sqrt(1 - rho * rho) * gauss(r) * noise
    return {
      label: nameOf(i),
      x: +(cx[g] + zx * 12).toFixed(2),
      y: +(cy[g] + zy * 12).toFixed(2),
      size: +(14 + r() * 80 * (1 + 0.45 * zx)).toFixed(1),
      g,
    }
  })
}
function parsePoints(data) {
  if (Array.isArray(data)) return data.map((d, i) => ({ label: String(d.label ?? nameOf(i)), x: num(d.x), y: num(d.y), size: d.size == null ? 1 : num(d.size), g: Math.max(0, num(d.g ?? d.group ?? 1) - 1) }))
  const rows = parseRows(data)
  if (!rows.length || !String(data ?? '').trim()) return null
  return rows.map((r, i) => ({ label: r.label || nameOf(i), x: r.values[0] ?? 0, y: r.values[1] ?? 0, size: r.values[2] ?? 1, g: Math.max(0, Math.round(r.values[3] ?? 1) - 1) }))
}
function usePoints({ data, count, correlation, groups, seed, noise }) {
  return useMemo(() => parsePoints(data) ?? synthPoints({ count, correlation, groups, seed, noise }), [data, count, correlation, groups, seed, noise])
}

function linreg(pts) {
  const n = pts.length
  if (n < 2) return null
  const mx = pts.reduce((a, p) => a + p.x, 0) / n
  const my = pts.reduce((a, p) => a + p.y, 0) / n
  let sxx = 0
  let sxy = 0
  let syy = 0
  pts.forEach((p) => {
    sxx += (p.x - mx) ** 2
    sxy += (p.x - mx) * (p.y - my)
    syy += (p.y - my) ** 2
  })
  if (!sxx || !syy) return null
  const slope = sxy / sxx
  return { slope, icpt: my - slope * mx, r: sxy / Math.sqrt(sxx * syy), mx, my }
}
function pearson(a, b) {
  const n = a.length
  const ma = a.reduce((s, v) => s + v, 0) / n
  const mb = b.reduce((s, v) => s + v, 0) / n
  let sab = 0
  let saa = 0
  let sbb = 0
  for (let i = 0; i < n; i++) {
    sab += (a[i] - ma) * (b[i] - mb)
    saa += (a[i] - ma) ** 2
    sbb += (b[i] - mb) ** 2
  }
  return saa && sbb ? sab / Math.sqrt(saa * sbb) : 0
}

const fmtTickLabel = (v) => (Math.abs(v) >= 1000 ? axisFmt.format(v) : String(+v.toFixed(Math.abs(v) < 10 ? 2 : Math.abs(v) < 100 ? 1 : 0)))

// colour ramps: stops are #rrggbb, t is 0..1
const rampAt = (stops, t) => {
  const k = clamp(t, 0, 1) * (stops.length - 1)
  const i = Math.min(stops.length - 2, Math.floor(k))
  return mix(stops[i], stops[i + 1], k - i)
}
const lum = (c) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16) / 255)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const inkOn = (c) => (lum(c) > 0.55 ? '#0b0b0d' : '#ffffff')
function stopsFor(scale, { color, color2, color3, background, reverse }) {
  const neutral = mix(background, '#ffffff', 0.1)
  const s = scale === 'diverging' ? [color2, neutral, color] : scale === 'spectrum' ? [color2, color3, color] : [mix(background, color, 0.1), color]
  return reverse ? [...s].reverse() : s
}
// a gradient bar with end labels, used as a chart legend
function RampLegend({ stops, lo, hi, mid, mutedColor }) {
  const g = Array.from({ length: 12 }, (_, i) => rampAt(stops, i / 11)).join(', ')
  return (
    <div style={{ minWidth: '9em', fontSize: '0.78em', color: mutedColor, paddingTop: '0.15em' }}>
      <div style={{ height: '0.6em', borderRadius: 99, background: `linear-gradient(90deg, ${g})`, boxShadow: 'inset 0 0 0 1px #ffffff14' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.3em', fontVariantNumeric: 'tabular-nums' }}>
        <span>{lo}</span>
        {mid != null && <span>{mid}</span>}
        <span>{hi}</span>
      </div>
    </div>
  )
}
// ---- end relationship helpers ----

// Correlation matrix: how every variable moves with every other, from -1 (opposite)
// through 0 (unrelated) to +1 (together). Show the full square or one triangle, draw each
// pair as a square, circle, number or filled cell, and reorder the variables so related
// ones sit together. Give a matrix as rows "Name:1|0.8|-0.2" (first row first), or leave
// `data` empty to compute one from seeded demo variables.
export default function CorrelationMatrix({
  data = '',
  variables = 8,
  seed = 12,
  strength = 1,
  title = 'What moves together',
  subtitle = 'Pearson correlation across 120 weekly readings',
  triangle = 'lower',
  display = 'circles',
  cluster = true,
  showValues = false,
  showDiagonal = true,
  decimals = 2,
  showLegend = true,
  crosshair = true,
  tooltip = true,
  animate = true,
  duration = 1300,
  width = 560,
  cellSize = 34,
  size = 13,
  color = '#d77757',
  color2 = '#5b9bd5',
  background = '#111214',
  textColor = '#ececec',
  mutedColor = '#8b8f98',
}) {
  const wrap = useRef(null)
  const [boxRef, boxW] = useWidth()
  const NAMES_V = ['Revenue', 'Users', 'Churn', 'NPS', 'Support', 'Latency', 'Spend', 'Growth', 'Retention', 'Errors']

  const model = useMemo(() => {
    const parsed = String(data ?? '').trim() ? parseRows(data) : null
    let names
    let M
    if (parsed) {
      names = parsed.map((r) => r.label)
      M = parsed.map((r, i) => names.map((_, j) => clamp(r.values[j] ?? (i === j ? 1 : 0), -1, 1)))
    } else {
      const N = clamp(Math.round(variables), 3, 10)
      const r = rng(Math.round(seed) * 41 + 5)
      const F = 3
      const load = Array.from({ length: N }, () => Array.from({ length: F }, () => gauss(r) * strength))
      const cols = load.map(() => new Array(120).fill(0))
      const fac = Array.from({ length: F }, () => Array.from({ length: 120 }, () => gauss(r)))
      for (let v = 0; v < N; v++) for (let t = 0; t < 120; t++) cols[v][t] = fac.reduce((a, f, k) => a + f[t] * load[v][k], 0) + gauss(r) * 0.9
      names = NAMES_V.slice(0, N)
      M = cols.map((a, i) => cols.map((b, j) => (i === j ? 1 : pearson(a, b))))
    }
    // greedy order: start from the most connected variable, then keep adding the closest one
    let order = names.map((_, i) => i)
    if (cluster) {
      const conn = (i) => M[i].reduce((a, v, j) => a + (i === j ? 0 : Math.abs(v)), 0)
      let cur = order.reduce((a, i) => (conn(i) > conn(a) ? i : a), 0)
      const left = new Set(order)
      left.delete(cur)
      const seq = [cur]
      while (left.size) {
        const nxt = [...left].reduce((a, i) => (M[cur][i] > M[cur][a] ? i : a), [...left][0])
        seq.push(nxt)
        left.delete(nxt)
        cur = nxt
      }
      order = seq
    }
    return { names: order.map((i) => names[i]), M: order.map((i) => order.map((j) => M[i][j])) }
  }, [data, variables, seed, strength, cluster]) // eslint-disable-line react-hooks/exhaustive-deps

  const { names, M } = model
  const N = names.length
  const stops = stopsFor('diverging', { color, color2, color3: color2, background, reverse: false })
  const colorOf = (v) => rampAt(stops, (v + 1) / 2)
  const p = useReveal(animate, duration, `${data}|${variables}|${seed}|${strength}|${cluster}|${display}|${triangle}`)
  const [hov, setHov] = useState(null)
  const [tip, setTip] = useState(null)

  const maxLab = Math.min(12, Math.max(...names.map((s) => s.length)))
  const labW = maxLab * size * 0.58 + 12
  const W = Math.max(260, (boxW || width) - size * 2.8)
  const cell = Math.max(18, Math.min((W - labW - 6) / N, cellSize))
  const gridW = cell * N
  const H = labW * 0.72 + gridW + 8
  const x0 = labW
  const show = (i, j) => (triangle === 'full' ? true : triangle === 'lower' ? j <= i : j >= i) && (showDiagonal || i !== j)
  const word = (v) => { const a = Math.abs(v); const s = a > 0.7 ? 'strong' : a > 0.4 ? 'moderate' : a > 0.15 ? 'weak' : 'no'; return s === 'no' ? 'no clear link' : `${s} ${v > 0 ? 'positive' : 'negative'}` }
  const label = (v) => (v === 1 ? '1' : v.toFixed(decimals).replace(/^(-?)0\./, '$1.'))

  return (
    <Card
      wrapRef={(el) => { wrap.current = el; boxRef.current = el }}
      {...{ width, background, color, textColor, mutedColor, size, title, subtitle, tip }}
      legend={showLegend ? <RampLegend stops={stops} lo="-1" mid="0" hi="+1" mutedColor={mutedColor} /> : null}
    >
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${title}. Correlation matrix of ${names.join(', ')}.`}
        style={{ display: 'block', maxWidth: '100%', margin: '0 auto', overflow: 'visible' }}
        onMouseLeave={() => { setHov(null); setTip(null) }}
      >
        {names.map((nm, i) => (
          <text key={`r${i}`} x={x0 - 8} y={i * cell + cell / 2} dy="0.34em" textAnchor="end" fontSize={size} fill={hov && (hov.i === i) ? textColor : mutedColor} style={{ transition: 'fill .15s' }}>{nm.length > 12 ? nm.slice(0, 11) + '…' : nm}</text>
        ))}
        {names.map((nm, j) => (
          <text key={`c${j}`} transform={`translate(${x0 + j * cell + cell / 2},${gridW + size * 1.2}) rotate(-40)`} textAnchor="end" fontSize={size} fill={hov && hov.j === j ? textColor : mutedColor} style={{ transition: 'fill .15s' }}>{nm.length > 12 ? nm.slice(0, 11) + '…' : nm}</text>
        ))}

        {M.map((row, i) =>
          row.map((v, j) => {
            if (!show(i, j)) return null
            const ip = ease(clamp((p - ((i + j) / (2 * N)) * 0.55) / 0.45, 0, 1))
            const cx = x0 + j * cell + cell / 2
            const cy = i * cell + cell / 2
            const c = colorOf(v)
            const a = Math.abs(v)
            const on = !crosshair || !hov || hov.i === i || hov.j === j
            const exact = hov && hov.i === i && hov.j === j
            const num = showValues || display === 'numbers' ? (
              <text x={cx} y={cy} dy="0.34em" textAnchor="middle" fontSize={Math.min(size * 0.82, cell * 0.34)} fontWeight="600" fill={display === 'cells' ? inkOn(c) : display === 'numbers' ? c : textColor} opacity={ip} style={{ pointerEvents: 'none', fontVariantNumeric: 'tabular-nums' }}>{label(v)}</text>
            ) : null
            return (
              <g key={`${i}-${j}`} opacity={on ? 1 : 0.3} style={{ transition: 'opacity .15s' }}>
                {display === 'cells' && <rect x={cx - cell / 2 + 1.5} y={cy - cell / 2 + 1.5} width={cell - 3} height={cell - 3} rx="5" fill={c} fillOpacity={(0.25 + 0.75 * a) * ip} stroke={exact ? textColor : 'none'} strokeWidth="1.8" />}
                {display === 'squares' && <rect x={cx - (cell - 4) * Math.max(0.18, a) * ip / 2} y={cy - (cell - 4) * Math.max(0.18, a) * ip / 2} width={(cell - 4) * Math.max(0.18, a) * ip} height={(cell - 4) * Math.max(0.18, a) * ip} rx="4" fill={c} stroke={exact ? textColor : 'none'} strokeWidth="1.8" style={{ filter: a > 0.6 ? `drop-shadow(0 0 ${size * 0.4}px ${c}88)` : undefined }} />}
                {(display === 'circles' || display === 'mixed') && <circle cx={cx} cy={cy} r={((cell - 4) / 2) * Math.max(0.16, a) * ip} fill={c} fillOpacity={display === 'mixed' ? 0.85 : 1} stroke={exact ? textColor : 'none'} strokeWidth="1.8" style={{ filter: a > 0.6 ? `drop-shadow(0 0 ${size * 0.4}px ${c}88)` : undefined }} />}
                {display !== 'cells' && display !== 'numbers' && showValues && cell > size * 2.6 && (cell - 4) * a > size * 2.4 && (
                  <text x={cx} y={cy} dy="0.34em" textAnchor="middle" fontSize={Math.min(size * 0.78, cell * 0.3)} fontWeight="600" fill={a > 0.55 && display !== 'mixed' ? inkOn(c) : textColor} opacity={ip} style={{ pointerEvents: 'none', fontVariantNumeric: 'tabular-nums' }}>{label(v)}</text>
                )}
                {(display === 'cells' || display === 'numbers') && cell > size * 2.2 && num}
              </g>
            )
          }),
        )}

        {M.map((row, i) =>
          row.map((v, j) =>
            show(i, j) ? (
              <rect
                key={`h${i}-${j}`}
                x={x0 + j * cell}
                y={i * cell}
                width={cell}
                height={cell}
                fill="transparent"
                onMouseEnter={(e) => { setHov({ i, j }); tooltip && setTip(tipAt(e, wrap, `${names[i]} × ${names[j]}`, [{ color: colorOf(v), label: 'r', value: v.toFixed(2), strong: true }, { label: 'Link', value: i === j ? 'itself' : word(v) }])) }}
                onMouseMove={(e) => tooltip && setTip(tipAt(e, wrap, `${names[i]} × ${names[j]}`, [{ color: colorOf(v), label: 'r', value: v.toFixed(2), strong: true }, { label: 'Link', value: i === j ? 'itself' : word(v) }]))}
              />
            ) : null,
          ),
        )}
      </svg>
    </Card>
  )
}
