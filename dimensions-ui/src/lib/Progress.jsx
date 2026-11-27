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

// Progress: how far along things are. Items are "Label:value|max" (max defaults to
// 100). `variant` draws them as linear bars, rings, segmented bars, or concentric
// activity rings; bars can be striped and moving, glow, or show an indeterminate
// shimmer while a value is unknown. A finished item turns `doneColor` with a check.
export default function Progress({
  data = 'Uploading assets:72, Processing video:38, Writing captions:12|20, Publishing:100',
  title = 'Release pipeline',
  subtitle = '4 jobs running',
  variant = 'linear',
  thickness = 10,
  segments = 12,
  gradient = true,
  striped = false,
  glow = true,
  indeterminate = false,
  showValues = true,
  valueMode = 'percent',
  doneCheck = true,
  animate = true,
  duration = 1200,
  width = 520,
  size = 13,
  color = '#d77757',
  color2 = '#5b9bd5',
  color3 = '#e0a030',
  color4 = '#b48ead',
  doneColor = '#4eba65',
  trackColor = '#25272c',
  colorMode = 'palette',
  background = '#111214',
  textColor = '#ececec',
  mutedColor = '#8b8f98',
}) {
  const id = useId().replace(/:/g, '')
  const [boxRef, boxW] = useWidth()
  const items = useMemo(() => parseRows(data).map((r) => { const mx = r.values[1] > 0 ? r.values[1] : 100; const v = clamp(r.values[0] ?? 0, 0, mx); return { label: r.label, v, mx, f: v / mx } }), [data])
  const p = useReveal(animate, duration, `${data}|${variant}`)
  const pal = [color, color2, color3, color4]
  const colorOf = (it, i) => (it.f >= 1 ? doneColor : colorMode === 'single' ? color : colorMode === 'by value' ? mix(color, doneColor, it.f * 0.6) : pal[i % 4])
  const valText = (it) => (valueMode === 'fraction' ? `${Math.round(it.v * ease(p))} / ${it.mx}` : `${Math.round(it.f * 100 * ease(p))}%`)
  const W = Math.max(220, (boxW || width) - size * 2.8)
  const t = clamp(thickness, 3, 40)
  const check = (c, s) => (
    <svg width={s} height={s} viewBox="0 0 16 16" aria-hidden style={{ flex: 'none' }}>
      <circle cx="8" cy="8" r="8" fill={c} />
      <path d="M4.6 8.3l2.2 2.2 4.6-4.8" fill="none" stroke="#0b0b0d" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
  const css = `
    @keyframes ${id}s{to{background-position:28px 0}}
    @keyframes ${id}i{0%{transform:translateX(-100%)}100%{transform:translateX(250%)}}
    @keyframes ${id}r{from{transform:rotate(-90deg)}to{transform:rotate(270deg)}}
    @media (prefers-reduced-motion:reduce){.${id}a{animation:none!important}}
  `

  // rings: one per item side by side, or concentric for "activity"
  if (variant === 'ring' || variant === 'activity') {
    const activity = variant === 'activity'
    const n = items.length
    const D = activity ? Math.min(W * 0.5, 220) : Math.min(140, (W - (n - 1) * 16) / Math.max(1, n))
    return (
      <Card wrapRef={(el) => (boxRef.current = el)} {...{ width, background, color, textColor, mutedColor, size, title, subtitle }}>
        <style>{css}</style>
        <div style={{ display: 'flex', alignItems: 'center', gap: activity ? '1.6em' : '1em', flexWrap: 'wrap', justifyContent: activity ? 'flex-start' : 'space-around' }}>
          {(activity ? [items] : items.map((it) => [it])).map((group, gi) => (
            <svg key={gi} width={D} height={D} viewBox={`0 0 ${D} ${D}`} role="img" aria-label={group.map((it) => `${it.label}: ${Math.round(it.f * 100)} percent`).join('; ')} style={{ display: 'block', overflow: 'visible', flex: 'none' }}>
              {group.map((it, k) => {
                const i = activity ? k : gi
                const r = D / 2 - t / 2 - (activity ? k * (t + 4) : 0)
                if (r < t) return null
                const C = 2 * Math.PI * r
                const c = colorOf(it, i)
                const fr = indeterminate && it.f < 1 ? 0.28 : it.f * ease(clamp((p - k * 0.1) / 0.9, 0, 1))
                return (
                  <g key={k}>
                    <circle cx={D / 2} cy={D / 2} r={r} fill="none" stroke={trackColor} strokeWidth={t} />
                    <circle
                      className={`${id}a`}
                      cx={D / 2}
                      cy={D / 2}
                      r={r}
                      fill="none"
                      stroke={c}
                      strokeWidth={t}
                      strokeLinecap="round"
                      strokeDasharray={`${C * fr} ${C}`}
                      style={{ filter: glow ? `drop-shadow(0 0 ${t * 0.6}px ${c}99)` : undefined, transform: 'rotate(-90deg)', transformBox: 'fill-box', transformOrigin: 'center', animation: indeterminate && it.f < 1 ? `${id}r 1.1s linear infinite` : undefined }}
                    />
                  </g>
                )
              })}
              {!activity && (
                <g>
                  <text x={D / 2} y={D / 2} dy="0.1em" textAnchor="middle" fontSize={Math.min(size * 1.6, D * 0.2)} fontWeight="800" fill={textColor}>{indeterminate && group[0].f < 1 ? '…' : valText(group[0])}</text>
                  <text x={D / 2} y={D / 2} dy="1.5em" textAnchor="middle" fontSize={Math.min(size * 0.78, D * 0.1)} fill={mutedColor}>{group[0].label.length > 14 ? group[0].label.slice(0, 13) + '…' : group[0].label}</text>
                </g>
              )}
            </svg>
          ))}
          {activity && (
            <div role="list" style={{ display: 'grid', gap: '0.55em', flex: 1, minWidth: '10em' }}>
              {items.map((it, i) => (
                <div key={i} role="listitem" style={{ display: 'flex', alignItems: 'center', gap: '0.6em' }}>
                  <i style={{ width: '0.7em', height: '0.7em', borderRadius: '50%', background: colorOf(it, i), boxShadow: `0 0 0.6em ${colorOf(it, i)}` }} />
                  <span style={{ flex: 1, color: mutedColor }}>{it.label}</span>
                  {showValues && <b style={{ fontVariantNumeric: 'tabular-nums' }}>{valText(it)}</b>}
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    )
  }

  // linear and segmented bars
  const segN = clamp(Math.round(segments), 3, 40)
  return (
    <Card wrapRef={(el) => (boxRef.current = el)} {...{ width, background, color, textColor, mutedColor, size, title, subtitle }}>
      <style>{css}</style>
      <div role="list" style={{ display: 'grid', gap: '1em' }}>
        {items.map((it, i) => {
          const c = colorOf(it, i)
          const ip = ease(clamp((p - i * 0.08) / 0.85, 0, 1))
          const done = it.f >= 1
          const ind = indeterminate && !done
          return (
            <div key={i} role="listitem">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5em', marginBottom: '0.45em', fontSize: '0.92em' }}>
                <span style={{ flex: 1, color: done ? textColor : mutedColor }}>{it.label}</span>
                {done && doneCheck ? check(doneColor, size * 1.1) : showValues && <b style={{ fontVariantNumeric: 'tabular-nums', color: ind ? mutedColor : textColor }}>{ind ? 'Working…' : valText(it)}</b>}
              </div>
              <div
                role="progressbar"
                aria-label={it.label}
                aria-valuemin={0}
                aria-valuemax={it.mx}
                aria-valuenow={ind ? undefined : it.v}
                style={{ position: 'relative', height: t, borderRadius: variant === 'segmented' ? 0 : t, background: variant === 'segmented' ? 'transparent' : trackColor, overflow: variant === 'segmented' ? 'visible' : 'hidden', display: variant === 'segmented' ? 'grid' : 'block', gridTemplateColumns: `repeat(${segN}, 1fr)`, gap: 3 }}
              >
                {variant === 'segmented' ? (
                  Array.from({ length: segN }, (_, k) => {
                    const on = (k + 1) / segN <= it.f * ip + 1e-9 || (k / segN < it.f * ip && (k + 1) / segN > it.f * ip)
                    return <span key={k} style={{ height: t, borderRadius: Math.min(4, t / 2), background: on ? c : trackColor, boxShadow: on && glow ? `0 0 ${t}px ${c}66` : 'none', transition: 'background .3s' }} />
                  })
                ) : ind ? (
                  <span className={`${id}a`} style={{ position: 'absolute', inset: 0, width: '40%', borderRadius: t, background: `linear-gradient(90deg, transparent, ${c}, transparent)`, animation: `${id}i 1.3s ease-in-out infinite` }} />
                ) : (
                  <span
                    className={`${id}a`}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      width: `${it.f * 100 * ip}%`,
                      borderRadius: t,
                      background: striped
                        ? `repeating-linear-gradient(45deg, ${c} 0 7px, ${mix(c, '#ffffff', 0.25)} 7px 14px)`
                        : gradient
                          ? `linear-gradient(90deg, ${mix(c, background, 0.35)}, ${c})`
                          : c,
                      backgroundSize: striped ? '28px 100%' : undefined,
                      boxShadow: glow ? `0 0 ${t * 1.2}px ${c}77` : 'none',
                      animation: striped && !done ? `${id}s .8s linear infinite` : undefined,
                    }}
                  />
                )}
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
