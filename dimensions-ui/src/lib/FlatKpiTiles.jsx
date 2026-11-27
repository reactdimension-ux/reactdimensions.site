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

const paletteOf = (n, base) => Array.from({ length: n }, (_, i) => base[i % base.length])
const splitNames = (s) =>
  String(s ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
// Multi-value rows: "Revenue:48200|41800" -> { label: 'Revenue', values: [48200, 41800] }
function parseMulti(data) {
  if (Array.isArray(data)) return data.map((d) => ({ label: String(d.label ?? ''), values: (d.values ?? [d.value, d.previous]).filter((x) => x != null).map(num) }))
  return String(data ?? '')
    .split(/[,\n;]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const i = s.lastIndexOf(':')
      return { label: i < 0 ? s : s.slice(0, i).trim(), values: (i < 0 ? '0' : s.slice(i + 1)).split('|').map(num) }
    })
}
// white or dark ink, whichever reads better on a filled colour
function inkOn(c, dark) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(String(c).slice(i, i + 2), 16) || 0)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.66 ? dark : '#ffffff'
}

// Flat infographic KPI tiles: the headline numbers of a dashboard on soft flat tiles.
// Each tile is "Label:value|previous" and shows a chunky number that counts up, a solid
// change chip (green or red; names in `invert` count a rise as bad), the from-value and
// a flat sparkline (area with a striped band, line or mini bars) that walks from the
// previous value to the current one. Tiles pop in one after another.
export default function FlatKpiTiles({
  data = 'Revenue:48200|41800, Active users:12840|13120, Conversion:3.8|3.1, Avg. response:182|240',
  prefixes = '$, , , ',
  suffixes = ', , %, ms',
  invert = 'Avg. response',
  title = 'This month',
  subtitle = 'Compared with last month',
  columns = 4,
  sparkline = 'area',
  sparkColor = 'palette',
  points = 20,
  seed = 7,
  countUp = true,
  compact = true,
  showPrevious = true,
  stripes = true,
  stripeWidth = 4,
  tileRadius = 16,
  tooltip = true,
  animate = true,
  duration = 1400,
  width = 760,
  size = 13,
  color = '#4a7fe8',
  color2 = '#ef5b7f',
  color3 = '#14a89e',
  color4 = '#f08a24',
  color5 = '#8e5fd6',
  color6 = '#c49a12',
  upColor = '#14a89e',
  downColor = '#ef5b7f',
  tileColor = '#f4f5f9',
  background = '#ffffff',
  textColor = '#2b2f3a',
  mutedColor = '#8a90a0',
}) {
  const uid = useId().replace(/:/g, '')
  const wrap = useRef(null)
  const [boxRef, boxW] = useWidth()
  const pre = String(prefixes).split(',').map((s) => s.trim())
  const suf = String(suffixes).split(',').map((s) => s.trim())
  const inv = new Set(splitNames(invert))
  const tiles = useMemo(
    () =>
      parseMulti(data).map((r, i) => {
        const v = r.values[0] ?? 0
        const prev = r.values[1] ?? v
        // a seeded walk from prev to v
        let s = Math.round(seed) * 131 + i * 977 + 1
        const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280
        const n = clamp(Math.round(points), 4, 80)
        const spread = Math.abs(v - prev) * 0.35 + Math.abs(v) * 0.03
        const line = Array.from({ length: n }, (_, k) => {
          const t = k / (n - 1)
          return prev + (v - prev) * t + (k && k < n - 1 ? (rnd() - 0.5) * spread : 0)
        })
        return { label: r.label, v, prev, line, dec: Math.abs(v) < 100 && v % 1 !== 0 ? 1 : 0 }
      }),
    [data, points, seed],
  )
  const pal = paletteOf(tiles.length, [color, color2, color3, color4, color5, color6])
  const p = useReveal(animate, duration, data)
  const [hov, setHov] = useState(-1)
  const [tip, setTip] = useState(null)

  const W = Math.max(220, (boxW || width) - size * 3)
  // as many columns as fit, preferring a count that leaves no tile alone on the last row
  const cap = clamp(Math.min(Math.round(columns), Math.max(1, Math.floor(W / 150))), 1, 6)
  let C = cap
  for (let c = cap; c >= Math.max(1, cap - 2); c--)
    if (tiles.length <= c || tiles.length % c === 0) {
      C = c
      break
    }
  const gapPx = size * 0.85
  const pad = size * 1.1
  const sw = Math.max(60, (W - gapPx * (C - 1)) / C - pad * 2)
  const sh = size * 3.2

  const show = (t, i, x) => {
    const nf =
      compact && Math.abs(x) >= 10000
        ? new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })
        : new Intl.NumberFormat('en', { minimumFractionDigits: t.dec, maximumFractionDigits: t.dec })
    return `${pre[i] ?? ''}${nf.format(x)}${suf[i] ?? ''}`
  }
  const info = (t, i) => {
    const ch = t.prev ? (t.v - t.prev) / Math.abs(t.prev) : 0
    const good = inv.has(t.label) ? ch <= 0 : ch >= 0
    return { ch, good, trend: good ? upColor : downColor }
  }
  const enter = (e, t, i) => {
    setHov(i)
    const { ch, trend } = info(t, i)
    if (tooltip)
      setTip(tipAt(e, wrap, t.label, [
        { color: pal[i], label: 'Now', value: show(t, i, t.v) },
        { label: 'Before', value: show(t, i, t.prev) },
        { color: trend, label: 'Change', value: `${ch >= 0 ? '+' : '−'}${Math.abs(ch * 100).toFixed(1)}%` },
      ]))
  }
  const move = (e) => tooltip && setTip((t) => (t ? { ...t, ...tipAt(e, wrap, t.title, t.rows) } : t))
  const leave = () => { setHov(-1); setTip(null) }

  return (
    <Card wrapRef={(el) => { wrap.current = el; boxRef.current = el }} {...{ width, background, textColor, mutedColor, size, title, subtitle, tip }}>
      <div
        role="list"
        aria-label={`${title}. ${tiles.map((t, i) => `${t.label}: ${show(t, i, t.v)}, ${info(t, i).ch >= 0 ? 'up' : 'down'} ${Math.abs(info(t, i).ch * 100).toFixed(1)}% from ${show(t, i, t.prev)}`).join('; ')}`}
        style={{ display: 'grid', gridTemplateColumns: `repeat(${C}, minmax(0, 1fr))`, gap: gapPx }}
        onMouseLeave={leave}
      >
        {tiles.map((t, i) => {
          const { ch, trend } = info(t, i)
          const c = sparkColor === 'trend' ? trend : pal[i]
          const k = stag(p, i, tiles.length)
          const ip = ease(k)
          const shown = countUp ? t.prev + (t.v - t.prev) * ip : t.v
          const lo = Math.min(...t.line)
          const hi = Math.max(...t.line)
          const top = 5
          const P = t.line.map((y, j) => [(j / (t.line.length - 1)) * sw, sh - 3 - ((y - lo) / (hi - lo || 1)) * (sh - 3 - top)])
          const d = 'M' + P.map((q) => q.map((v) => v.toFixed(1)).join(',')).join('L')
          const areaD = `${d}L${sw},${sh}L0,${sh}Z`
          const last = P[P.length - 1]
          const dim = hov >= 0 && hov !== i
          const n = t.line.length
          const bw = (sw / n) * 0.62
          return (
            <div
              key={i}
              role="listitem"
              onMouseEnter={(e) => enter(e, t, i)}
              onMouseMove={move}
              style={{
                position: 'relative',
                padding: `${pad * 0.95}px ${pad}px ${pad * 0.85}px`,
                borderRadius: tileRadius,
                background: tileColor,
                overflow: 'hidden',
                opacity: (dim ? 0.4 : 1) * clamp(k * 3, 0, 1),
                transform: `scale(${0.82 + 0.18 * pop(k)})`,
                transition: 'opacity .2s',
                cursor: 'default',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5em', minWidth: 0 }}>
                <i style={{ width: '0.8em', height: '0.8em', borderRadius: 4, background: pal[i], flex: 'none' }} />
                <span style={{ color: mutedColor, fontSize: '0.9em', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.label}</span>
              </div>
              <div style={{ fontSize: '1.9em', fontWeight: 800, letterSpacing: '-0.02em', margin: '0.2em 0 0.3em', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{show(t, i, shown)}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5em', flexWrap: 'wrap', fontSize: '0.8em' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3em', padding: '0.22em 0.6em', borderRadius: 99, fontWeight: 700, color: inkOn(trend, textColor), background: trend, fontVariantNumeric: 'tabular-nums' }}>
                  <svg width="0.7em" height="0.7em" viewBox="0 0 10 10" aria-hidden style={{ transform: ch >= 0 ? 'none' : 'rotate(180deg)' }}>
                    <path d="M5,1 L9.2,8.6 L0.8,8.6 Z" fill="currentColor" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                  </svg>
                  {Math.abs(ch * 100).toFixed(1)}%
                </span>
                {showPrevious && <span style={{ color: mutedColor, fontWeight: 600, whiteSpace: 'nowrap' }}>{`from ${show(t, i, t.prev)}`}</span>}
              </div>
              {sparkline !== 'none' && (
                <svg width={sw} height={sh} viewBox={`0 0 ${sw} ${sh}`} aria-hidden style={{ display: 'block', marginTop: '0.9em', overflow: 'visible' }}>
                  <defs>
                    <pattern id={`st${uid}${i}`} width={stripeWidth * 2} height={stripeWidth * 2} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                      <rect width={stripeWidth} height={stripeWidth * 2} fill="#ffffff" opacity="0.35" />
                    </pattern>
                    <clipPath id={`r${uid}${i}`}>
                      <rect x="-6" y="-6" width={(sw + 6) * ip + 6} height={sh + 12} />
                    </clipPath>
                    <clipPath id={`a${uid}${i}`}><path d={areaD} /></clipPath>
                  </defs>
                  <g clipPath={`url(#r${uid}${i})`}>
                    {sparkline === 'bars' &&
                      t.line.map((y, j) => {
                        const x = (j / (n - 1)) * (sw - bw)
                        const bh = Math.max(3, sh - P[j][1])
                        return <rect key={j} x={x} y={sh - bh} width={bw} height={bh} rx={Math.min(3, bw / 2)} fill={j === n - 1 ? c : mix(tileColor, c, 0.45)} />
                      })}
                    {sparkline === 'area' && (
                      <>
                        <path d={areaD} fill={mix(tileColor, c, 0.3)} />
                        {stripes && (
                          <g clipPath={`url(#a${uid}${i})`}>
                            <rect x="0" y="0" width={sw} height={sh} fill={`url(#st${uid}${i})`} />
                          </g>
                        )}
                      </>
                    )}
                    {sparkline !== 'bars' && (
                      <>
                        <path d={d} fill="none" stroke={c} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
                        <circle cx={last[0]} cy={last[1]} r={4.5 * pop(clamp((k - 0.6) / 0.4, 0, 1))} fill={c} stroke={tileColor} strokeWidth="2.5" />
                      </>
                    )}
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
