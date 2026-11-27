import { useEffect, useMemo, useRef, useState } from 'react'

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

// share each category out over `total` slots (largest remainder), values measured against `max`
function allocate(rows, max, total) {
  const sum = rows.reduce((s, r) => s + r.value, 0)
  const den = Math.max(max, sum) || 1
  const exact = rows.map((r) => (r.value / den) * total)
  const out = exact.map(Math.floor)
  let left = Math.round((sum / den) * total) - out.reduce((s, v) => s + v, 0)
  exact
    .map((v, i) => [v - Math.floor(v), i])
    .sort((a, b) => b[0] - a[0])
    .forEach(([, i]) => {
      if (left > 0) {
        out[i]++
        left--
      }
    })
  return { counts: out, den }
}

// Flat dot-matrix "waffle": a grid of chunky dots filled in order by each category's
// share, the rest left in the track colour. Dots pop in on a diagonal wave; hovering a
// dot (or a legend entry) dims every other category.
export default function FlatDotMatrix({
  data = 'Mobile:46, Desktop:32, Tablet:12',
  title = 'Visits by device',
  subtitle = 'Each dot is one percent of all visits',
  total = 100,
  columns = 10,
  max = 100,
  dotGap = 0.26,
  shape = 'circle',
  showLegend = true,
  showRemaining = true,
  remainingLabel = 'Other',
  tooltip = true,
  animate = true,
  duration = 1400,
  decimals = 0,
  prefix = '',
  suffix = '%',
  width = 560,
  height = 260,
  size = 13,
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
  const wrap = useRef(null)
  const [boxRef, boxW] = useWidth()
  const fmt = makeFmt({ decimals, prefix, suffix })
  const rows = useMemo(() => parseRows(data).map((r) => ({ ...r, value: Math.max(0, r.value) })), [data])
  const cols = paletteOf(rows.length, [color, color2, color3, color4, color5, color6])
  const N = clamp(Math.round(total) || 1, 1, 400)
  const C = clamp(Math.round(columns) || 1, 1, N)
  const R = Math.ceil(N / C)
  const { counts, den } = allocate(rows, max, N)
  const rest = Math.max(0, den - rows.reduce((s, r) => s + r.value, 0))
  const owner = []
  counts.forEach((c, i) => {
    for (let j = 0; j < c && owner.length < N; j++) owner.push(i)
  })
  while (owner.length < N) owner.push(-1)

  const p = useReveal(animate, duration, `${data}|${N}|${C}|${max}`)
  const [hov, setHov] = useState(null)
  const [tip, setTip] = useState(null)

  const W = Math.max(200, (boxW || width) - size * 3)
  const legendOn = showLegend && rows.length > 0
  const side = legendOn && W >= 400
  const gridMaxW = side ? W - Math.max(150, W * 0.34) : W
  const cell = Math.max(4, Math.min(gridMaxW / C, height / R))
  const gw = cell * C
  const gh = cell * R
  const rad = (cell * (1 - clamp(dotGap, 0, 0.8))) / 2
  const sq = shape === 'square' || shape === 'rounded-square'

  const tipFor = (k) =>
    k === -1
      ? { title: remainingLabel, rows: [{ color: trackColor, label: 'Share', value: fmt(rest) }] }
      : { title: rows[k].label, rows: [{ color: cols[k], label: 'Share', value: fmt(rows[k].value) }, { label: 'Dots', value: `${counts[k]} of ${N}` }] }
  const enter = (e, k) => {
    if (k === -1 && !showRemaining) return
    setHov(k)
    if (tooltip) {
      const t = tipFor(k)
      setTip(tipAt(e, wrap, t.title, t.rows))
    }
  }
  const move = (e) => tooltip && setTip((t) => (t ? { ...t, ...tipAt(e, wrap, t.title, t.rows) } : t))
  const leave = () => {
    setHov(null)
    setTip(null)
  }
  const dimmed = (k) => hov !== null && hov !== k

  const legendItems = rows.map((r, i) => ({ ...r, i, c: cols[i] }))
  if (showRemaining && rest > 0 && owner.includes(-1)) legendItems.push({ label: remainingLabel, value: rest, i: -1, c: trackColor })

  return (
    <Card wrapRef={(el) => { wrap.current = el; boxRef.current = el }} {...{ width, background, textColor, mutedColor, size, title, subtitle, tip }}>
      <div style={{ display: 'flex', flexDirection: side ? 'row' : 'column', alignItems: side ? 'center' : 'flex-start', gap: side ? '1.8em' : '1em' }}>
        <svg
          width={gw}
          height={gh}
          viewBox={`0 0 ${gw} ${gh}`}
          role="img"
          aria-label={`${title}. Dot matrix of ${N} dots. ${rows.map((r, i) => `${r.label}: ${fmt(r.value)} (${counts[i]} dots)`).join('; ')}`}
          style={{ display: 'block', overflow: 'visible', flex: 'none' }}
          onMouseLeave={leave}
        >
          {owner.map((k, d) => {
            const c = d % C
            const r = Math.floor(d / C)
            const wave = (c + r) / Math.max(1, C + R - 2)
            const s = pop(clamp((p - wave * 0.62) / 0.38, 0, 1))
            const cx = c * cell + cell / 2
            const cy = r * cell + cell / 2
            const fill = k < 0 ? trackColor : cols[k]
            const rr = rad * s
            return (
              <g key={d} opacity={dimmed(k) ? 0.4 : 1} style={{ transition: 'opacity .2s' }} onMouseEnter={(e) => enter(e, k)} onMouseMove={move}>
                <rect x={c * cell} y={r * cell} width={cell} height={cell} fill="transparent" />
                {rr > 0.2 &&
                  (sq ? (
                    <rect x={cx - rr} y={cy - rr} width={rr * 2} height={rr * 2} rx={rr * 0.32} fill={fill} />
                  ) : (
                    <circle cx={cx} cy={cy} r={rr} fill={fill} />
                  ))}
              </g>
            )
          })}
        </svg>

        {legendOn && (
          <div
            style={{
              display: 'flex',
              flexDirection: side ? 'column' : 'row',
              flexWrap: 'wrap',
              gap: side ? '0.9em' : '0.8em 1.6em',
              minWidth: 0,
            }}
            onMouseLeave={leave}
          >
            {legendItems.map((it) => (
              <div
                key={it.i}
                onMouseEnter={(e) => enter(e, it.i)}
                onMouseMove={move}
                style={{ display: 'flex', alignItems: 'center', gap: '0.7em', opacity: dimmed(it.i) ? 0.4 : 1, transition: 'opacity .2s', cursor: 'default' }}
              >
                <i
                  style={{
                    width: '1.05em',
                    height: '1.05em',
                    borderRadius: sq ? '0.3em' : '50%',
                    background: it.c,
                    flex: 'none',
                    boxShadow: it.i < 0 ? `inset 0 0 0 1px ${mix(trackColor, textColor, 0.12)}` : 'none',
                  }}
                />
                <div style={{ lineHeight: 1.15 }}>
                  <div style={{ fontSize: '1.55em', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: textColor }}>{fmt(it.value * ease(p))}</div>
                  <div style={{ fontSize: '0.88em', color: mutedColor, fontWeight: 600 }}>{it.label}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  )
}
