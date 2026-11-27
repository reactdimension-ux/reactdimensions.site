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
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
// blend two #rrggbb colours
function mix(a, b, t) {
  const h = (c) => [1, 3, 5].map((i) => parseInt(String(c).slice(i, i + 2), 16) || 0)
  const [A, B] = [h(a), h(b)]
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('')
}
// a rect path with a radius for each corner [top-left, top-right, bottom-right, bottom-left]
function rrect(x, y, w, h, r = [0, 0, 0, 0]) {
  w = Math.max(0, w)
  h = Math.max(0, h)
  const [a, b, c, d] = r.map((v) => Math.max(0, Math.min(v, w / 2, h / 2)))
  return `M${x + a},${y}H${x + w - b}Q${x + w},${y} ${x + w},${y + b}V${y + h - c}Q${x + w},${y + h} ${x + w - c},${y + h}H${x + d}Q${x},${y + h} ${x},${y + h - d}V${y + a}Q${x},${y} ${x + a},${y}Z`
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

// text colour for a label sitting on a filled shape: dark ink on light fills, white otherwise
function inkOn(c, dark) {
  const [r, g, b] = [1, 3, 5].map((i) => (parseInt(String(c).slice(i, i + 2), 16) || 0) / 255)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.62 ? dark : '#ffffff'
}

// Flat infographic word cloud: words sized by weight and packed along a spiral from the
// centre outwards so none overlap. As `pills` every word sits on a chunky rounded flat
// chip (the biggest one striped); as `text` the words themselves are the flat marks.
// Some can turn sideways; colours follow the palette, a single-hue ramp or one colour.
// Words pop in biggest first; hover one for its count.
export default function FlatWordCloud({
  data = 'design:96, react:88, motion:74, components:70, 3D:66, typography:52, colour:49, layout:47, shaders:41, animation:40, accessibility:38, tokens:34, grid:31, spring:29, hover:27, gradient:26, glass:24, canvas:22, cursor:21, scroll:20, theme:19, icons:18, depth:17, light:16, texture:15, easing:15, sound:14, haptics:12, noise:12, blur:11, mesh:10, orbit:10, particles:9, keyframes:9, bezier:8, physics:8',
  title = 'What people search for',
  subtitle = 'Top terms in the component library this month',
  variant = 'pills',
  minFont = 11,
  maxFont = 44,
  autoFit = true,
  scaleType = 'sqrt',
  rotation = 'some',
  spiral = 'archimedean',
  colorMode = 'palette',
  fontWeight = 700,
  padding = 3,
  stripes = true,
  stripeWidth = 4,
  tooltip = true,
  animate = true,
  duration = 1300,
  decimals = 0,
  prefix = '',
  suffix = '',
  width = 720,
  height = 330,
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
  const words = useMemo(() => parseRows(data).map((r) => ({ text: r.label, w: Math.max(0, r.value) })).filter((x) => x.text).sort((a, b) => b.w - a.w), [data])
  const W = Math.max(240, (boxW || width) - size * 3)
  const H = Math.max(140, height)
  const p = useReveal(animate, duration, `${data}|${rotation}|${spiral}|${variant}`)
  const [hov, setHov] = useState(-1)
  const [tip, setTip] = useState(null)
  const pal = [color, color2, color3, color4, color5, color6]
  const pills = variant !== 'text'

  const placed = useMemo(() => {
    if (!words.length) return []
    const wMax = words[0].w
    const wMin = words[words.length - 1].w
    const f = (v) => (scaleType === 'log' ? Math.log(v + 1) : scaleType === 'linear' ? v : Math.sqrt(v))
    // place every word at scale `sc`; with autoFit, shrink and retry until they all fit
    const attempt = (sc) => {
    const lo = Math.min(minFont, maxFont) * Math.max(sc, 0.75)
    const hi = Math.max(minFont, maxFont) * sc
    const out = []
    let s = 17
    const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280)
    words.forEach((wd, i) => {
      const t = wMax === wMin ? 1 : (f(wd.w) - f(wMin)) / (f(wMax) - f(wMin) || 1)
      const fs = lo + (hi - lo) * t
      const rot = rotation === 'none' ? 0 : rotation === 'some' ? (i > 2 && rnd() < 0.22 ? -90 : 0) : rotation === 'mixed' ? [0, 0, -90, -20, 20][Math.floor(rnd() * 5)] : 0
      // the mark: a pill (text plus side padding) or just the text
      const th = pills ? fs * 1.55 : fs * 1.05
      // the biggest pill gets a striped tail on the right, so it is a little longer
      const tail = pills && stripes && i === 0 ? th * 0.85 : 0
      const tw = wd.text.length * fs * 0.6 + (pills ? fs * 1.3 : 0) + tail
      const rr = (rot * Math.PI) / 180
      const bw = Math.abs(tw * Math.cos(rr)) + Math.abs(th * Math.sin(rr)) + padding * 2
      const bh = Math.abs(tw * Math.sin(rr)) + Math.abs(th * Math.cos(rr)) + padding * 2
      for (let k = 0; k < 3000; k++) {
        const a = k * 0.21
        const r = k * 0.5
        const x = W / 2 + Math.cos(a) * r * (spiral === 'wide' ? 2.1 : 1.6)
        const y = H / 2 + Math.sin(a) * r * (spiral === 'wide' ? 0.7 : 0.9)
        const box = { x0: x - bw / 2, x1: x + bw / 2, y0: y - bh / 2, y1: y + bh / 2 }
        if (box.x0 < 0 || box.x1 > W || box.y0 < 0 || box.y1 > H) continue
        if (out.every((o) => box.x1 <= o.box.x0 || box.x0 >= o.box.x1 || box.y1 <= o.box.y0 || box.y0 >= o.box.y1)) {
          out.push({ ...wd, i, fs, rot, x, y, t, tw, th, tail, box })
          break
        }
      }
    })
    return out
    }
    let sc = 1
    let out = attempt(sc)
    for (let tries = 0; autoFit && out.length < words.length && tries < 8; tries++) {
      sc *= 0.9
      out = attempt(sc)
    }
    return out
  }, [words, W, H, minFont, maxFont, scaleType, rotation, spiral, padding, pills, stripes, autoFit])

  const colorOf = (o) => (colorMode === 'single' ? color : colorMode === 'ramp' ? mix(background, color, (pills ? 0.35 : 0.5) + (pills ? 0.65 : 0.5) * o.t) : pal[o.i % pal.length])
  const total = words.reduce((a, w) => a + w.w, 0) || 1
  const move = (e) => tooltip && setTip((t) => (t ? { ...t, ...tipAt(e, wrap, t.title, t.rows) } : t))
  const n = Math.max(1, placed.length)

  return (
    <Card wrapRef={(el) => { wrap.current = el; boxRef.current = el }} {...{ width, background, textColor, mutedColor, size, title, subtitle, tip }}>
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${title}. Word cloud. Top words: ${words.slice(0, 10).map((w) => `${w.text} ${fmt(w.w)}`).join(', ')}`}
        style={{ display: 'block', overflow: 'visible' }}
        onMouseLeave={() => { setHov(-1); setTip(null) }}
      >
        <defs>
          <pattern id={`st${uid}`} width={stripeWidth * 2} height={stripeWidth * 2} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width={stripeWidth} height={stripeWidth * 2} fill="#ffffff" opacity="0.35" />
          </pattern>
        </defs>
        {placed.map((o, k) => {
          const ip = clamp((p - (k / n) * 0.55) / 0.45, 0, 1)
          if (ip <= 0) return null
          const c = colorOf(o)
          const dim = hov >= 0 && hov !== k
          const sc = pop(ip) * (hov === k ? 1.08 : 1)
          const d = rrect(-o.tw / 2, -o.th / 2, o.tw, o.th, Array(4).fill(o.th / 2))
          const striped = o.tail > 0
          return (
            <g
              key={o.text + k}
              transform={`translate(${o.x},${o.y}) rotate(${o.rot}) scale(${sc})`}
              opacity={Math.min(1, ip * 2) * (dim ? 0.4 : 1)}
              style={{ cursor: 'default', transition: 'opacity .2s' }}
              onMouseEnter={(e) => {
                setHov(k)
                if (tooltip)
                  setTip(tipAt(e, wrap, o.text, [
                    { color: c, label: 'Count', value: fmt(o.w) },
                    { label: 'Share', value: `${((o.w / total) * 100).toFixed(1)}%` },
                    { label: 'Rank', value: `#${o.i + 1}` },
                  ]))
              }}
              onMouseMove={move}
            >
              {pills && <path d={d} fill={c} />}
              {striped && (
                <>
                  <clipPath id={`c${uid}`}><path d={d} /></clipPath>
                  <g clipPath={`url(#c${uid})`}>
                    <rect x={o.tw / 2 - o.tail - o.th * 0.2} y={-o.th / 2} width={o.tail + o.th * 0.2} height={o.th} fill={mix(c, '#000000', 0.12)} />
                    <rect x={o.tw / 2 - o.tail - o.th * 0.2} y={-o.th / 2} width={o.tail + o.th * 0.2} height={o.th} fill={`url(#st${uid})`} />
                  </g>
                </>
              )}
              {/* hit area at least as big as the mark */}
              <rect x={-o.tw / 2 - padding} y={-o.th / 2 - padding} width={o.tw + padding * 2} height={o.th + padding * 2} fill="transparent" />
              <text
                x={-o.tail / 2 - (striped ? o.th * 0.1 : 0)}
                y={0}
                dy="0.36em"
                textAnchor="middle"
                fontSize={o.fs}
                fontWeight={fontWeight}
                fill={pills ? inkOn(c, textColor) : c}
                style={{ pointerEvents: 'none', letterSpacing: '-0.01em' }}
              >
                {o.text}
              </text>
            </g>
          )
        })}
      </svg>
    </Card>
  )
}
