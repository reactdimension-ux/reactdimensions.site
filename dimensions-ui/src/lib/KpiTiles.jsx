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

// KPI tiles: the headline numbers of a dashboard. Each tile is "Label:value|previous"
// and shows the value counting up, the change since `previous` as a green or red chip
// (names in `invert` count a rise as bad), and a small trend line that walks from the
// previous value to the current one. `prefixes` and `suffixes` give each tile its unit.
export default function KpiTiles({
  data = 'Revenue:48200|41800, Active users:12840|13120, Conversion:3.8|3.1, Avg. response:182|240',
  prefixes = '$, , , ',
  suffixes = ', , %, ms',
  invert = 'Avg. response',
  title = 'This month',
  subtitle = 'Compared with last month',
  columns = 4,
  sparkline = 'area',
  points = 20,
  seed = 7,
  countUp = true,
  compact = true,
  showPrevious = true,
  animate = true,
  duration = 1400,
  width = 760,
  size = 13,
  color = '#d77757',
  upColor = '#4eba65',
  downColor = '#e5534b',
  tileColor = '#1a1b1f',
  background = '#111214',
  textColor = '#ececec',
  mutedColor = '#8b8f98',
}) {
  const id = useId().replace(/:/g, '')
  const [boxRef, boxW] = useWidth()
  const pre = String(prefixes).split(',').map((s) => s.trim())
  const suf = String(suffixes).split(',').map((s) => s.trim())
  const inv = new Set(splitNames(invert))
  const tiles = useMemo(() => parseRows(data).map((r, i) => {
    const v = r.values[0] ?? 0
    const prev = r.values[1] ?? v
    // a seeded walk from prev to v
    let s = Math.round(seed) * 131 + i * 977 + 1
    const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280)
    const n = clamp(Math.round(points), 4, 80)
    const spread = Math.abs(v - prev) * 0.35 + Math.abs(v) * 0.03
    const line = Array.from({ length: n }, (_, k) => { const t = k / (n - 1); return prev + (v - prev) * t + (k && k < n - 1 ? (rnd() - 0.5) * spread : 0) })
    return { label: r.label, v, prev, line, dec: Math.abs(v) < 100 && v % 1 !== 0 ? 1 : 0 }
  }), [data, points, seed])
  const p = useReveal(animate, duration, data)
  const W = Math.max(220, (boxW || width) - size * 2.8)
  // as many columns as fit, preferring a count that leaves no tile alone on the last row
  const cap = clamp(Math.min(Math.round(columns), Math.max(1, Math.floor(W / 150))), 1, 6)
  let C = cap
  for (let c = cap; c >= Math.max(1, cap - 2); c--) if (tiles.length <= c || tiles.length % c === 0) { C = c; break }

  const show = (t, i, x) => {
    const nf = compact && Math.abs(x) >= 10000 ? new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }) : new Intl.NumberFormat('en', { minimumFractionDigits: t.dec, maximumFractionDigits: t.dec })
    return `${pre[i] ?? ''}${nf.format(x)}${suf[i] ?? ''}`
  }

  return (
    <Card wrapRef={(el) => (boxRef.current = el)} {...{ width, background, color, textColor, mutedColor, size, title, subtitle }}>
      <div role="list" style={{ display: 'grid', gridTemplateColumns: `repeat(${C}, minmax(0, 1fr))`, gap: '0.75em' }}>
        {tiles.map((t, i) => {
          const ch = t.prev ? (t.v - t.prev) / Math.abs(t.prev) : 0
          const good = inv.has(t.label) ? ch <= 0 : ch >= 0
          const c = good ? upColor : downColor
          const ip = ease(clamp((p - i * 0.08) / 0.85, 0, 1))
          const shown = countUp ? t.prev + (t.v - t.prev) * ip : t.v
          const sw = 120
          const sh = 34
          const lo = Math.min(...t.line)
          const hi = Math.max(...t.line)
          const P = t.line.map((y, k) => [(k / (t.line.length - 1)) * sw, sh - 2 - ((y - lo) / (hi - lo || 1)) * (sh - 4)])
          const d = 'M' + P.map((q) => q.map((v) => v.toFixed(1)).join(',')).join('L')
          return (
            <div key={i} role="listitem" style={{ position: 'relative', padding: '0.95em 1em 0.8em', borderRadius: 14, background: `linear-gradient(160deg, ${mix(tileColor, c, 0.06)}, ${tileColor})`, border: `1px solid ${mutedColor}22`, overflow: 'hidden', opacity: 0.3 + 0.7 * ip, transform: `translateY(${(1 - ip) * 8}px)` }}>
              <div style={{ color: mutedColor, fontSize: '0.85em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.label}</div>
              <div style={{ fontSize: '1.75em', fontWeight: 750, letterSpacing: '-0.02em', margin: '0.15em 0 0.3em', fontVariantNumeric: 'tabular-nums' }}>{show(t, i, shown)}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5em', flexWrap: 'wrap', fontSize: '0.8em' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25em', padding: '0.2em 0.55em', borderRadius: 99, fontWeight: 700, color: c, background: mix(tileColor, c, 0.16), fontVariantNumeric: 'tabular-nums' }}>
                  {ch >= 0 ? '▲' : '▼'} {Math.abs(ch * 100).toFixed(1)}%
                </span>
                {showPrevious && <span style={{ color: mutedColor }}>{`from ${show(t, i, t.prev)}`}</span>}
              </div>
              {sparkline !== 'none' && (
                <svg width="100%" height={sh} viewBox={`0 0 ${sw} ${sh}`} preserveAspectRatio="none" aria-hidden style={{ display: 'block', marginTop: '0.7em', overflow: 'visible' }}>
                  <defs>
                    <linearGradient id={`${id}g${i}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stopColor={c} stopOpacity="0.35" />
                      <stop offset="1" stopColor={c} stopOpacity="0" />
                    </linearGradient>
                    <clipPath id={`${id}c${i}`}>
                      <rect x="0" y="-4" width={sw * ip} height={sh + 8} />
                    </clipPath>
                  </defs>
                  <g clipPath={`url(#${id}c${i})`}>
                    {sparkline === 'area' && <path d={`${d}L${sw},${sh}L0,${sh}Z`} fill={`url(#${id}g${i})`} />}
                    <path d={d} fill="none" stroke={c} strokeWidth="1.8" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
                  </g>
                </svg>
              )}
            </div>
          )
        })}
      </div>
    </Card>
  )
}
