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

// Word cloud: words sized by how often they appear, packed along a spiral from the
// centre outwards so none overlap. Words are "word:weight". Some can turn sideways,
// colours can follow weight or a palette, and words pop in biggest first. Hover a word
// for its count. Good for a quick feel of text, not for exact comparison.
export default function WordCloud({
  data = 'design:96, react:88, motion:74, components:70, 3D:66, typography:52, colour:49, layout:47, shaders:41, animation:40, accessibility:38, tokens:34, grid:31, spring:29, hover:27, gradient:26, glass:24, canvas:22, cursor:21, scroll:20, theme:19, icons:18, depth:17, light:16, texture:15, easing:15, sound:14, haptics:12, noise:12, blur:11, mesh:10, orbit:10, particles:9, keyframes:9, bezier:8, physics:8',
  title = 'What people search for',
  subtitle = 'Top terms in the component library this month',
  minFont = 12,
  maxFont = 58,
  scaleType = 'sqrt',
  rotation = 'some',
  spiral = 'archimedean',
  colorMode = 'ramp',
  fontWeight = 700,
  padding = 3,
  tooltip = true,
  animate = true,
  duration = 1300,
  width = 720,
  height = 330,
  size = 13,
  color = '#d77757',
  color2 = '#5b9bd5',
  color3 = '#4eba65',
  color4 = '#b48ead',
  color5 = '#e0a030',
  background = '#111214',
  textColor = '#ececec',
  mutedColor = '#8b8f98',
}) {
  const wrap = useRef(null)
  const [boxRef, boxW] = useWidth()
  const words = useMemo(() => parseRows(data).map((r) => ({ text: r.label, w: Math.max(0, r.values[0] ?? 1) })).filter((x) => x.text).sort((a, b) => b.w - a.w), [data])
  const W = Math.max(260, (boxW || width) - size * 2.8)
  const H = height
  const p = useReveal(animate, duration, `${data}|${rotation}|${spiral}`)
  const [hov, setHov] = useState(-1)
  const [tip, setTip] = useState(null)
  const pal = [color, color2, color3, color4, color5]

  const placed = useMemo(() => {
    if (!words.length) return []
    const wMax = words[0].w
    const wMin = words[words.length - 1].w
    const f = (v) => (scaleType === 'log' ? Math.log(v + 1) : scaleType === 'linear' ? v : Math.sqrt(v))
    const out = []
    let s = 17
    const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280)
    words.forEach((wd, i) => {
      const t = wMax === wMin ? 1 : (f(wd.w) - f(wMin)) / (f(wMax) - f(wMin))
      const fs = minFont + (maxFont - minFont) * t
      const rot = rotation === 'none' ? 0 : rotation === 'some' ? (i > 0 && rnd() < 0.28 ? 90 : 0) : rotation === 'mixed' ? [0, 0, 90, -30, 30][Math.floor(rnd() * 5)] : 0
      const tw = wd.text.length * fs * 0.58 + padding * 2
      const th = fs * 0.95 + padding * 2
      const vert = Math.abs(rot) === 90
      const bw = vert ? th : Math.abs(rot) ? tw * 0.87 + th * 0.5 : tw
      const bh = vert ? tw : Math.abs(rot) ? tw * 0.5 + th * 0.87 : th
      let ok = false
      let x = 0
      let y = 0
      for (let k = 0; k < 2400 && !ok; k++) {
        const a = k * 0.21
        const r = k * 0.55
        x = Math.cos(a) * r * (spiral === 'wide' ? 2.1 : 1.6)
        y = Math.sin(a) * r * (spiral === 'wide' ? 0.7 : 0.9)
        const box = { x0: W / 2 + x - bw / 2, x1: W / 2 + x + bw / 2, y0: H / 2 + y - bh / 2, y1: H / 2 + y + bh / 2 }
        if (box.x0 < 2 || box.x1 > W - 2 || box.y0 < 2 || box.y1 > H - 2) continue
        ok = out.every((o) => box.x1 < o.box.x0 || box.x0 > o.box.x1 || box.y1 < o.box.y0 || box.y0 > o.box.y1)
        if (ok) out.push({ ...wd, i, fs, rot, x: W / 2 + x, y: H / 2 + y, t, box })
      }
    })
    return out
  }, [words, W, H, minFont, maxFont, scaleType, rotation, spiral, padding])

  const colorOf = (o) => (colorMode === 'single' ? color : colorMode === 'palette' ? pal[o.i % pal.length] : mix(color2, color, o.t))
  const total = words.reduce((a, w) => a + w.w, 0) || 1

  return (
    <Card wrapRef={(el) => { wrap.current = el; boxRef.current = el }} {...{ width, background, color, textColor, mutedColor, size, title, subtitle, tip }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}. Word cloud. Top words: ${words.slice(0, 10).map((w) => `${w.text} ${w.w}`).join(', ')}`} style={{ display: 'block', maxWidth: '100%', overflow: 'visible' }} onMouseLeave={() => { setHov(-1); setTip(null) }}>
        {placed.map((o, k) => {
          const ip = ease(clamp((p - (k / Math.max(1, placed.length)) * 0.6) / 0.4, 0, 1))
          const c = colorOf(o)
          const on = hov < 0 || hov === k
          const sc = (0.4 + 0.6 * ip) * (hov === k ? 1.12 : 1)
          return (
            <text
              key={o.text + k}
              x={0}
              y={0}
              transform={`translate(${o.x},${o.y}) rotate(${o.rot}) scale(${sc})`}
              textAnchor="middle"
              dy="0.34em"
              fontSize={o.fs}
              fontWeight={fontWeight}
              fill={c}
              opacity={ip * (on ? 1 : 0.3)}
              style={{ cursor: 'default', transition: 'opacity .2s', filter: hov === k ? `drop-shadow(0 0 ${o.fs * 0.25}px ${c})` : undefined, letterSpacing: '-0.01em' }}
              onMouseEnter={(e) => { setHov(k); tooltip && setTip(tipAt(e, wrap, o.text, [{ color: c, label: 'Count', value: String(o.w), strong: true }, { label: 'Share', value: `${((o.w / total) * 100).toFixed(1)}%` }, { label: 'Rank', value: `#${o.i + 1}` }])) }}
              onMouseMove={(e) => tooltip && setTip((t) => (t ? { ...t, ...tipAt(e, wrap, t.title, t.rows) } : t))}
            >
              {o.text}
            </text>
          )
        })}
      </svg>
    </Card>
  )
}
