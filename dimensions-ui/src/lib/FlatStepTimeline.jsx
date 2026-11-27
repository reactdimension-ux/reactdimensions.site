import { useEffect, useId, useMemo, useRef, useState } from 'react'

// ---- flat infographic helpers (kept inline so this file copies out on its own) ----
// Data is a plain string: rows are separated by commas, each row is "Title:note",
// e.g. "Research:Q1, Design:Q2" (the note is free text). An array of { label, value } works too.

const FONT = '"Poppins", "Nunito", ui-rounded, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif'
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

// white or dark ink, whichever reads better on a filled colour
function inkOn(c, dark) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(String(c).slice(i, i + 2), 16) || 0)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.66 ? dark : '#ffffff'
}
// steps: "Label:text" where the text is free (a date, a phase, a number...)
function parseSteps(data) {
  if (Array.isArray(data)) return data.map((d) => ({ label: String(d.label ?? ''), text: String(d.value ?? d.text ?? '') }))
  return String(data ?? '')
    .split(/[,\n;]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const i = s.indexOf(':')
      return { label: i < 0 ? s : s.slice(0, i).trim(), text: i < 0 ? '' : s.slice(i + 1).trim() }
    })
}
// greedy word wrap into at most `max` lines of `chars` characters
function wrap(s, chars, max) {
  const out = []
  let line = ''
  for (const w of String(s).split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${w}` : w
    if (next.length <= chars || !line) line = next
    else {
      out.push(line)
      line = w
    }
  }
  if (line) out.push(line)
  if (out.length > max) {
    out.length = max
    out[max - 1] = out[max - 1].slice(0, Math.max(1, chars - 1)) + '…'
  }
  return out.map((l) => (l.length > chars ? l.slice(0, Math.max(1, chars - 1)) + '…' : l))
}

// Flat infographic step timeline: a thick rounded road snakes left-right in rows, with
// numbered circular nodes in category colours along it and a title + note under each.
// The road draws on, then each node pops as the road reaches it.
export default function FlatStepTimeline({
  data = 'Research:Q1, Design:Q2, Build:Q3, Test:Q4, Launch:Q5, Grow:Q6',
  title = 'Product roadmap',
  subtitle = 'Six steps from idea to growth',
  perRow = 3,
  pathWidth = 16,
  nodeSize = 46,
  dashed = true,
  stripes = true,
  stripeWidth = 4,
  showText = true,
  tooltip = true,
  animate = true,
  duration = 1600,
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
  pathColor = '#e3e6ef',
  textColor = '#2b2f3a',
  mutedColor = '#8a90a0',
}) {
  const uid = useId().replace(/:/g, '')
  const wrapEl = useRef(null)
  const [boxRef, boxW] = useWidth()
  const fmtNum = makeFmt({ decimals, prefix, suffix })
  // numeric notes get number formatting, anything else just gets the prefix/suffix
  const fmt = (t) => (t === '' ? '' : /^-?\d+(\.\d+)?$/.test(t) ? fmtNum(parseFloat(t)) : `${prefix}${t}${suffix}`)
  const steps = useMemo(() => parseSteps(data), [data])
  const cols = paletteOf(steps.length, [color, color2, color3, color4, color5, color6])
  const p = useReveal(animate, duration, `${data}|${perRow}`)
  const [hov, setHov] = useState(-1)
  const [tip, setTip] = useState(null)

  const W = Math.max(260, (boxW || width) - size * 3)
  const n = Math.max(1, steps.length)
  const per = clamp(Math.round(perRow), 1, n)
  const rowsN = Math.ceil(n / per)
  const pw = clamp(pathWidth, 2, 60)
  const nr = clamp(nodeSize / 2, pw * 0.6 + 4, 60)

  // turn radius and margins, then the column cells inside them
  const rc0 = 34
  const m = (rowsN > 1 ? rc0 : 0) + pw / 2 + 4
  const xL = m
  const xR = W - m
  const cell = (xR - xL) / per
  const chars = Math.max(4, Math.floor((cell - 10) / (size * 0.6)))
  const lines = steps.map((s) => wrap(s.label, chars, 2))
  const maxLines = Math.max(1, ...lines.map((l) => l.length))
  const hasNote = steps.some((s) => s.text)
  const textH = showText ? size * 1.25 * maxLines + (hasNote ? size * 1.3 : 0) : 0
  const topPad = nr + 4
  const botPad = nr + (showText ? 10 + textH : 4)
  const minRowH = nr * 2 + (showText ? 14 + textH : 0) + 16
  // `height` stretches the rows a little, but never into big empty gaps
  const rowH = rowsN > 1 ? clamp((height - topPad - botPad) / (rowsN - 1), minRowH, minRowH * 1.3) : 0
  const rc = rowsN > 1 ? Math.min(rc0, rowH / 2) : 0
  const H = topPad + rowH * (rowsN - 1) + botPad
  const yOf = (r) => topPad + r * rowH

  // nodes and the distance along the road to each
  const span = xR - xL
  const turnLen = rowsN > 1 ? Math.PI * rc + (rowH - 2 * rc) : 0
  const nodes = steps.map((s, i) => {
    const r = Math.floor(i / per)
    const j = i % per
    const fwd = r % 2 === 0
    const x = fwd ? xL + cell * (j + 0.5) : xR - cell * (j + 0.5)
    const along = r * (span + turnLen) + cell * (j + 0.5)
    return { ...s, i, r, x, y: yOf(r), along, note: fmt(s.text), lines: lines[i] }
  })
  // the road: rows joined by rounded U-turns, ending half a cell past the last node
  let d = `M${xL},${yOf(0)}`
  for (let r = 0; r < rowsN; r++) {
    const fwd = r % 2 === 0
    const y = yOf(r)
    const last = r === rowsN - 1
    const inRow = last ? n - r * per : per
    const end = last ? cell * Math.min(per, inRow + 0.5) : span
    d += `H${fwd ? xL + end : xR - end}`
    if (!last) {
      const y2 = yOf(r + 1)
      d += fwd
        ? `A${rc},${rc} 0 0 1 ${xR + rc},${y + rc}V${y2 - rc}A${rc},${rc} 0 0 1 ${xR},${y2}`
        : `A${rc},${rc} 0 0 0 ${xL - rc},${y + rc}V${y2 - rc}A${rc},${rc} 0 0 0 ${xL},${y2}`
    }
  }
  const lastRowCount = n - (rowsN - 1) * per
  const total = (rowsN - 1) * (span + turnLen) + cell * Math.min(per, lastRowCount + 0.5)
  const drawn = ease(clamp(p / 0.85, 0, 1))

  const enter = (e, q) => {
    setHov(q.i)
    if (tooltip) setTip(tipAt(e, wrapEl, q.label, [{ color: cols[q.i], label: `Step ${q.i + 1}`, value: q.note || '—' }]))
  }
  const move = (e) => tooltip && setTip((t) => (t ? { ...t, ...tipAt(e, wrapEl, t.title, t.rows) } : t))

  return (
    <Card wrapRef={(el) => { wrapEl.current = el; boxRef.current = el }} {...{ width, background, textColor, mutedColor, size, title, subtitle, tip }}>
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${title}. Step timeline. ${steps.map((s, i) => `Step ${i + 1}, ${s.label}${s.text ? `: ${fmt(s.text)}` : ''}`).join('; ')}`}
        style={{ display: 'block', overflow: 'visible' }}
        onMouseLeave={() => { setHov(-1); setTip(null) }}
      >
        <defs>
          <pattern id={`st${uid}`} width={stripeWidth * 2} height={stripeWidth * 2} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width={stripeWidth} height={stripeWidth * 2} fill="#ffffff" opacity="0.35" />
          </pattern>
          <mask id={`m${uid}`} maskUnits="userSpaceOnUse" x={-60} y={-60} width={W + 120} height={H + 120}>
            <path d={d} fill="none" stroke="#ffffff" strokeWidth={pw + 6} strokeLinecap="round" strokeLinejoin="round" pathLength="1" strokeDasharray="1 1" strokeDashoffset={1 - drawn} />
          </mask>
        </defs>

        <g mask={drawn < 1 ? `url(#m${uid})` : undefined}>
          <path d={d} fill="none" stroke={pathColor} strokeWidth={pw} strokeLinecap="round" strokeLinejoin="round" />
          {dashed && pw >= 8 && (
            <path d={d} fill="none" stroke={background} strokeWidth={Math.max(2, pw * 0.16)} strokeLinecap="round" strokeDasharray={`${pw * 0.55} ${pw * 0.85}`} />
          )}
        </g>

        {nodes.map((q) => {
          const c = cols[q.i]
          const dim = hov >= 0 && hov !== q.i
          const k = clamp((p - (q.along / total) * 0.85) / 0.15, 0, 1)
          const s = pop(k)
          const t = ease(k)
          const fs = Math.min(nr * 0.85, size * 1.4)
          const ty = q.y + nr + 8 + size
          return (
            <g key={q.i} opacity={dim ? 0.4 : 1} style={{ transition: 'opacity .2s' }} onMouseEnter={(e) => enter(e, q)} onMouseMove={move}>
              <g transform={`translate(${q.x} ${q.y}) scale(${s})`} opacity={k > 0 ? 1 : 0}>
                <circle r={nr + 4} fill={background} />
                <circle r={nr} fill={c} />
                {stripes && (
                  <>
                    <clipPath id={`c${uid}${q.i}`}><circle r={nr} /></clipPath>
                    <g clipPath={`url(#c${uid}${q.i})`}>
                      <rect x={nr * 0.3} y={-nr} width={nr} height={nr * 2} fill={mix(c, '#000000', 0.12)} />
                      <rect x={nr * 0.3} y={-nr} width={nr} height={nr * 2} fill={`url(#st${uid})`} />
                    </g>
                  </>
                )}
                <text y={0} dy="0.36em" textAnchor="middle" fontSize={fs} fontWeight="800" fill={inkOn(c, textColor)} style={{ fontVariantNumeric: 'tabular-nums', pointerEvents: 'none' }}>
                  {String(q.i + 1).padStart(2, '0')}
                </text>
              </g>
              {showText && (
                <g opacity={t} style={{ pointerEvents: 'none' }}>
                  {q.lines.map((l, li) => (
                    <text key={li} x={q.x} y={ty + li * size * 1.25} textAnchor="middle" fontSize={size * 1.02} fontWeight="700" fill={textColor}>
                      {l}
                    </text>
                  ))}
                  {q.note && (
                    <text x={q.x} y={ty + q.lines.length * size * 1.25 + size * 0.15} textAnchor="middle" fontSize={size * 0.9} fontWeight="600" fill={hov === q.i ? textColor : mutedColor}>
                      {q.note}
                    </text>
                  )}
                </g>
              )}
              {/* hit area: the node plus its text block */}
              <rect x={q.x - cell / 2} y={q.y - nr - 4} width={cell} height={nr * 2 + 8 + (showText ? textH + 10 : 0)} fill="transparent" />
            </g>
          )
        })}
      </svg>
    </Card>
  )
}
