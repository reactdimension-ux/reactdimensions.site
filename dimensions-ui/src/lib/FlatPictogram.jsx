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

// share each category out over `total` icons (largest remainder), values measured against `max`
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
  return out
}

// five-point star with its points pulled in a little (rounded by a matching stroke)
const STAR = (() => {
  const pts = []
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    const r = i % 2 ? 4.6 : 10
    pts.push(`${(12 + r * Math.cos(a)).toFixed(2)},${(13.2 + r * Math.sin(a)).toFixed(2)}`)
  }
  return `M${pts.join('L')}Z`
})()

// flat icons on a 24 x 24 box, feet / tip resting on y = 24
function Icon({ kind, fill }) {
  if (kind === 'heart')
    return <path d="M12 22.6C5.2 17.9 1.4 14 1.4 9.2 1.4 5.8 4 3.2 7.2 3.2c2 0 3.8 1 4.8 2.7 1-1.7 2.8-2.7 4.8-2.7 3.2 0 5.8 2.6 5.8 6 0 4.8-3.8 8.7-10.6 13.4Z" fill={fill} />
  if (kind === 'star') return <path d={STAR} fill={fill} stroke={fill} strokeWidth="2.6" strokeLinejoin="round" />
  if (kind === 'drop') return <path d="M12 1.2C12 1.2 4.4 9.9 4.4 15.4a7.6 7.6 0 0 0 15.2 0C19.6 9.9 12 1.2 12 1.2Z" fill={fill} />
  return (
    <>
      <circle cx="12" cy="5.4" r="4.6" fill={fill} />
      <path d="M7.4 11.6H16.6Q19.9 11.6 20.4 14.9L21.5 21.6Q21.8 23.8 19.6 23.8H4.4Q2.2 23.8 2.5 21.6L3.6 14.9Q4.1 11.6 7.4 11.6Z" fill={fill} />
    </>
  )
}

// Flat pictogram: rows of simple icons (people, hearts, stars or drops) coloured by
// each category's share, the rest in the track colour, with a big "7 in 10" headline
// for the first category. Icons hop up one after another.
export default function FlatPictogram({
  data = 'Use daily:7, Weekly:2, Rarely:1',
  title = 'How often people use it',
  subtitle = 'Survey of 1,200 customers',
  total = 10,
  columns = 5,
  max = 10,
  icon = 'person',
  iconGap = 0.16,
  showHeadline = true,
  headlineText = 'in',
  showLegend = true,
  stripes = true,
  tooltip = true,
  animate = true,
  duration = 1300,
  decimals = 0,
  prefix = '',
  suffix = '',
  width = 560,
  height = 220,
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
  const uid = useId().replace(/:/g, '')
  const wrap = useRef(null)
  const [boxRef, boxW] = useWidth()
  const fmt = makeFmt({ decimals, prefix, suffix })
  const rows = useMemo(() => parseRows(data).map((r) => ({ ...r, value: Math.max(0, r.value) })), [data])
  const cols = paletteOf(rows.length, [color, color2, color3, color4, color5, color6])
  const N = clamp(Math.round(total) || 1, 1, 200)
  const C = clamp(Math.round(columns) || 1, 1, N)
  const R = Math.ceil(N / C)
  const counts = allocate(rows, max, N)
  const owner = []
  counts.forEach((c, i) => {
    for (let j = 0; j < c && owner.length < N; j++) owner.push(i)
  })
  while (owner.length < N) owner.push(-1)

  const p = useReveal(animate, duration, `${data}|${N}|${C}|${icon}`)
  const [hov, setHov] = useState(null)
  const [tip, setTip] = useState(null)

  const W = Math.max(200, (boxW || width) - size * 3)
  const head = showHeadline && rows.length > 0
  const legendOn = showLegend && rows.length >= 2
  const side = (head || legendOn) && W >= 400
  const gridMaxW = side ? W - Math.max(150, W * 0.36) : W
  const cell = Math.max(8, Math.min(gridMaxW / C, height / R))
  const gw = cell * C
  const gh = cell * R
  const s = (cell * (1 - clamp(iconGap, 0, 0.7))) / 24

  const enter = (e, k) => {
    setHov(k)
    if (!tooltip) return
    const t =
      k < 0
        ? [`Remaining`, [{ color: trackColor, label: 'Icons', value: `${owner.filter((o) => o < 0).length} of ${N}` }]]
        : [rows[k].label, [{ color: cols[k], label: 'Value', value: fmt(rows[k].value) }, { label: 'Icons', value: `${counts[k]} of ${N}` }]]
    setTip(tipAt(e, wrap, t[0], t[1]))
  }
  const move = (e) => tooltip && setTip((t) => (t ? { ...t, ...tipAt(e, wrap, t.title, t.rows) } : t))
  const leave = () => {
    setHov(null)
    setTip(null)
  }
  const dimmed = (k) => hov !== null && hov !== k
  const shown = Math.round(counts[0] * ease(p))

  return (
    <Card wrapRef={(el) => { wrap.current = el; boxRef.current = el }} {...{ width, background, textColor, mutedColor, size, title, subtitle, tip }}>
      <div style={{ display: 'flex', flexDirection: side ? 'row' : 'column', alignItems: side ? 'center' : 'flex-start', gap: side ? '1.8em' : '1em' }}>
        {(head || legendOn) && (
          <div style={{ flex: side ? '1 1 0' : 'none', minWidth: 0 }} onMouseLeave={leave}>
            {head && (
              <div style={{ marginBottom: legendOn ? '1em' : 0, opacity: dimmed(0) ? 0.4 : 1, transition: 'opacity .2s' }} onMouseEnter={(e) => enter(e, 0)} onMouseMove={move}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5em', whiteSpace: 'nowrap', lineHeight: 1 }}>
                  <span style={{ fontSize: '3.6em', fontWeight: 800, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }}>{shown}</span>
                  <span style={{ fontSize: '1.5em', fontWeight: 700, color: mutedColor }}>
                    {headlineText} {N}
                  </span>
                </div>
                <svg width="76" height="10" viewBox="0 0 76 10" aria-hidden="true" style={{ display: 'block', margin: '0.55em 0 0.45em' }}>
                  <defs>
                    <pattern id={`st${uid}`} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                      <rect width="4" height="8" fill={background} opacity="0.45" />
                    </pattern>
                    <clipPath id={`cl${uid}`}>
                      <rect width={76 * ease(p)} height="10" rx="5" />
                    </clipPath>
                  </defs>
                  <g clipPath={`url(#cl${uid})`}>
                    <rect width="76" height="10" fill={cols[0]} />
                    {stripes && <rect width="76" height="10" fill={`url(#st${uid})`} />}
                  </g>
                </svg>
                <div style={{ color: mutedColor, fontWeight: 600, fontSize: '0.95em' }}>{rows[0].label}</div>
              </div>
            )}
            {legendOn && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45em 1.2em', flexDirection: side ? 'column' : 'row' }}>
                {rows.map((r, i) => (
                  <div
                    key={i}
                    onMouseEnter={(e) => enter(e, i)}
                    onMouseMove={move}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.55em', opacity: dimmed(i) ? 0.4 : 1, transition: 'opacity .2s', fontSize: '0.92em' }}
                  >
                    <i style={{ width: '0.8em', height: '0.8em', borderRadius: '50%', background: cols[i], flex: 'none' }} />
                    <span style={{ color: mutedColor, fontWeight: 600 }}>{r.label}</span>
                    <span style={{ color: textColor, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{counts[i]}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <svg
          width={gw}
          height={gh}
          viewBox={`0 0 ${gw} ${gh}`}
          role="img"
          aria-label={`${title}. Pictogram of ${N} icons. ${rows.map((r, i) => `${r.label}: ${counts[i]} of ${N} (${fmt(r.value)})`).join('; ')}`}
          style={{ display: 'block', overflow: 'visible', flex: 'none' }}
          onMouseLeave={leave}
        >
          {owner.map((k, d) => {
            const c = d % C
            const r = Math.floor(d / C)
            const t = pop(stag(p, d, N))
            const fill = k < 0 ? trackColor : cols[k]
            const bx = c * cell + cell / 2
            const by = r * cell + cell / 2 + 12 * s
            return (
              <g key={d} opacity={dimmed(k) ? 0.4 : 1} style={{ transition: 'opacity .2s' }} onMouseEnter={(e) => enter(e, k)} onMouseMove={move}>
                <rect x={c * cell} y={r * cell} width={cell} height={cell} fill="transparent" />
                {t > 0.01 && (
                  <g transform={`translate(${bx} ${by}) scale(${s * t}) translate(-12 -24)`}>
                    <Icon kind={icon} fill={fill} />
                  </g>
                )}
              </g>
            )
          })}
        </svg>
      </div>
    </Card>
  )
}
