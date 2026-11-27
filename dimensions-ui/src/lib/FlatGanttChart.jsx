import { useEffect, useId, useMemo, useRef, useState } from 'react'

// ---- flat infographic helpers (kept inline so this file copies out on its own) ----
// Data is a plain string: rows are separated by commas, each row is "Label:value",
// e.g. "Jan:42, Feb:58". An array of { label, value } works too.

const FONT = '"Poppins", "Nunito", ui-rounded, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif'
const num = (v) => {
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : 0
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
// each item starts a little after the one before it
const stag = (p, i, n) => Math.min(1, Math.max(0, (p - (n > 1 ? (i / (n - 1)) * 0.4 : 0)) / 0.6))
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

// Rows "Label:v|v|v" -> [{ label, values: [..] }]
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
const splitNames = (s) =>
  String(s ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
// "A>B, B>C" -> [['A', 'B'], ['B', 'C']]
function parseLinks(data) {
  return String(data ?? '')
    .split(/[,;\n]/)
    .map((x) => x.split('>').map((s) => s.trim()).filter(Boolean))
    .filter((l) => l.length >= 2)
}
// white or dark ink, whichever reads better on a filled colour
function inkOn(c, dark) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(String(c).slice(i, i + 2), 16) || 0)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.66 ? dark : '#ffffff'
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
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// Flat infographic Gantt chart: chunky pill bars on a timeline, a solid progress fill
// over a pale tint with diagonal stripes for the work still to do, milestone diamonds,
// rounded dependency arrows, weekend shading and a "today" pill. Bars pop out from
// their start one after another; hover dims unrelated tasks and shows dates.
// Each task is "Name:start|end|progress|group" in days from `startDate`.
export default function FlatGanttChart({
  data = 'Research:0|9|100|1, Wireframes:6|15|100|1, Visual design:13|26|80|1, Design review:26|26|0|1, API:10|30|65|2, Frontend:20|42|40|2, Integration:38|48|10|2, QA:44|54|0|3, Beta:52|60|0|3, Launch:61|61|0|3',
  dependencies = 'Research>Wireframes, Wireframes>Visual design, Visual design>Design review, API>Integration, Frontend>Integration, Integration>QA, QA>Beta, Beta>Launch',
  groups = 'Design, Build, Ship',
  startDate = '2026-03-02',
  today = 31,
  title = 'Product launch plan',
  subtitle = 'Spring release',
  scale = 'weeks',
  rowHeight = 30,
  barRadius = 10,
  stripes = true,
  stripeWidth = 4,
  showProgress = true,
  showDependencies = true,
  showToday = true,
  showWeekends = true,
  showLabels = true,
  tooltip = true,
  animate = true,
  duration = 1200,
  width = 740,
  size = 13,
  color = '#4a7fe8',
  color2 = '#ef5b7f',
  color3 = '#14a89e',
  color4 = '#f08a24',
  color5 = '#8e5fd6',
  color6 = '#c49a12',
  todayColor = '#ef5b7f',
  background = '#ffffff',
  gridColor = '#eef0f6',
  textColor = '#2b2f3a',
  mutedColor = '#8a90a0',
}) {
  const uid = useId().replace(/:/g, '')
  const wrap = useRef(null)
  const [boxRef, boxW] = useWidth()
  const pal = [color, color2, color3, color4, color5, color6]
  const gNames = splitNames(groups)
  const tasks = useMemo(
    () =>
      parseMulti(data).map((r, i) => ({
        i,
        name: r.label,
        s: Math.max(0, r.values[0] ?? 0),
        e: Math.max(Math.max(0, r.values[0] ?? 0), r.values[1] ?? 0),
        prog: clamp(r.values[2] ?? 0, 0, 100),
        g: Math.max(0, Math.round(r.values[3] ?? 1) - 1),
      })),
    [data],
  )
  const deps = useMemo(
    () => parseLinks(dependencies).map((d) => [tasks.findIndex((t) => t.name === d[0]), tasks.findIndex((t) => t.name === d[1])]).filter(([a, b]) => a >= 0 && b >= 0 && a !== b),
    [dependencies, tasks],
  )
  const p = useReveal(animate, duration, `${data}|${scale}`)
  const [hov, setHov] = useState(-1)
  const [hovG, setHovG] = useState(-1)
  const [tip, setTip] = useState(null)

  const d0 = useMemo(() => {
    const d = new Date(`${startDate}T00:00:00`)
    return isNaN(d) ? new Date(2026, 2, 2) : d
  }, [startDate])
  const dateOf = (day) => {
    const d = new Date(d0)
    d.setDate(d.getDate() + Math.round(day))
    return d
  }
  const fmtDate = (day) => {
    const d = dateOf(day)
    return `${MONTHS[d.getMonth()]} ${d.getDate()}`
  }
  const end = Math.max(1, ...tasks.map((t) => t.e)) + 2
  const n = tasks.length
  const W = Math.max(300, (boxW || width) - size * 3)
  const maxLab = Math.min(18, Math.max(1, ...tasks.map((t) => t.name.length)))
  const rh = Math.max(16, rowHeight)
  const bh = Math.round(rh * 0.66)
  const m = { l: showLabels ? maxLab * size * 0.6 + 18 : 6, r: bh * 0.7 + 6, t: size * 2.2, b: showToday ? size * 2.3 : 6 }
  const pw = Math.max(80, W - m.l - m.r)
  const H = m.t + n * rh + m.b
  const X = (day) => m.l + (day / end) * pw
  const unit = scale === 'days' ? 1 : scale === 'months' ? 30 : 7
  const tickW = size * 0.78 * 0.62 * 6 + 10
  const every = Math.max(1, Math.ceil(tickW / Math.max(1, (unit / end) * pw)))
  const ticks = []
  for (let d = 0, k = 0; d <= end; d += unit, k++) ticks.push({ d, show: k % every === 0 })
  const rad = Math.min(barRadius, bh / 2)
  const yRow = (r) => m.t + r * rh
  const related = (i) => hov < 0 || hov === i || deps.some(([a, b]) => (a === hov && b === i) || (b === hov && a === i))
  const pctWOf = (t) => `${Math.round(t.prog)}%`.length * size * 0.75 * 0.62 + 12
  const outsideLab = (t) => showProgress && t.prog > 0 && t.s !== t.e && (X(t.e) - X(t.s)) * (t.prog / 100) <= pctWOf(t)
  const groupsUsed = [...new Set(tasks.map((t) => t.g))].sort((a, b) => a - b)

  const show = (e, t) => {
    setHov(t.i)
    if (!tooltip) return
    const ms = t.s === t.e
    setTip(
      tipAt(e, wrap, t.name, [
        { color: pal[t.g % 6], label: gNames[t.g] ?? `Group ${t.g + 1}`, value: ms ? 'Milestone' : `${t.e - t.s} days` },
        { label: ms ? 'Date' : 'Dates', value: ms ? fmtDate(t.s) : `${fmtDate(t.s)} to ${fmtDate(t.e)}` },
        ...(!ms ? [{ label: 'Done', value: `${Math.round(t.prog)}%` }] : []),
      ]),
    )
  }

  return (
    <Card wrapRef={(el) => { wrap.current = el; boxRef.current = el }} {...{ width, background, textColor, mutedColor, size, title, subtitle, tip }}>
      {groupsUsed.length >= 2 && (
        <Legend items={groupsUsed.map((g) => ({ name: gNames[g] ?? `Group ${g + 1}`, color: pal[g % 6] }))} mutedColor={mutedColor} onHover={(i) => setHovG(i < 0 ? -1 : groupsUsed[i])} />
      )}
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${title}. Gantt chart with ${n} tasks from ${fmtDate(0)} to ${fmtDate(end - 2)}. ${tasks.map((t) => (t.s === t.e ? `${t.name}: milestone ${fmtDate(t.s)}` : `${t.name}: ${fmtDate(t.s)} to ${fmtDate(t.e)}, ${Math.round(t.prog)}% done`)).join('; ')}`}
        style={{ display: 'block', overflow: 'visible' }}
        onMouseLeave={() => { setHov(-1); setTip(null) }}
      >
        <defs>
          <pattern id={`st${uid}`} width={stripeWidth * 2} height={stripeWidth * 2} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width={stripeWidth} height={stripeWidth * 2} fill="#ffffff" opacity="0.55" />
          </pattern>
          <marker id={`ar${uid}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M0,1 L9,5 L0,9 Z" fill={mutedColor} />
          </marker>
        </defs>

        {/* weekends, grid and date header */}
        {showWeekends && unit < 30 &&
          Array.from({ length: end }, (_, d) =>
            dateOf(d).getDay() === 6 ? <rect key={`w${d}`} x={X(d)} y={m.t} width={Math.min(X(d + 2), m.l + pw) - X(d)} height={n * rh} fill={mix(gridColor, background, 0.35)} /> : null,
          )}
        {ticks.map(({ d, show: sh }, i) => (
          <g key={i}>
            {sh && <line x1={X(d)} x2={X(d)} y1={m.t - 6} y2={m.t + n * rh} stroke={gridColor} strokeWidth="2" strokeLinecap="round" />}
            {sh && (
              <text x={X(d)} y={m.t - size * 0.95} textAnchor={i === 0 ? 'start' : 'middle'} fontSize={size * 0.78} fontWeight="600" fill={mutedColor}>
                {fmtDate(d)}
              </text>
            )}
          </g>
        ))}

        {/* dependency arrows */}
        {showDependencies &&
          deps.map(([a, b], k) => {
            const A = tasks[a]
            const B = tasks[b]
            // start past the % label when it sits outside the bar
            const x1 = X(A.e) + (A.s === A.e ? bh * 0.55 : outsideLab(A) ? pctWOf(A) - 2 : 0)
            const y1 = yRow(a) + rh / 2
            const x2 = X(B.s) - (B.s === B.e ? bh * 0.6 : 3)
            const y2 = yRow(b) + rh / 2
            const mx = Math.max(x1 + 8, Math.min(x2 - 8, x1 + 12))
            const on = hov < 0 || hov === a || hov === b
            const d = x2 > x1 + 14 ? `M${x1},${y1}H${mx}V${y2}H${x2}` : `M${x1},${y1}h8V${(y1 + y2) / 2}H${x2 - 12}V${y2}H${x2}`
            return (
              <path
                key={k}
                d={d}
                fill="none"
                stroke={mutedColor}
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
                markerEnd={`url(#ar${uid})`}
                opacity={(on ? 0.85 : 0.2) * clamp((p - 0.6) * 2.5, 0, 1)}
                style={{ transition: 'opacity .2s', pointerEvents: 'none' }}
              />
            )
          })}

        {tasks.map((t, r) => {
          const k = pop(stag(p, r, n))
          const y = yRow(r) + (rh - bh) / 2
          const c = pal[t.g % 6]
          const dim = !related(t.i) || (hovG >= 0 && hovG !== t.g)
          const ms = t.s === t.e
          const x0 = X(t.s)
          const w = Math.max(0, (X(t.e) - x0) * k)
          const full = rrect(x0, y, w, bh, [rad, rad, rad, rad])
          const pwid = showProgress ? w * (t.prog / 100) : w
          const pct = `${Math.round(t.prog)}%`
          const inside = showProgress && pwid > pctWOf(t)
          const cy = y + bh / 2
          const hs = bh * 0.62 * k
          return (
            <g key={t.i} opacity={dim ? 0.4 : 1} style={{ transition: 'opacity .2s' }} onMouseEnter={(e) => show(e, t)} onMouseMove={(e) => show(e, t)}>
              <rect x={0} y={yRow(r)} width={W} height={rh} fill="transparent" />
              {showLabels && (
                <text x={m.l - 12} y={cy} dy="0.35em" textAnchor="end" fontSize={size * 0.9} fontWeight={hov === t.i ? 700 : 600} fill={hov === t.i ? textColor : mutedColor} style={{ pointerEvents: 'none' }}>
                  {t.name.length > 18 ? t.name.slice(0, 17) + '…' : t.name}
                </text>
              )}
              {ms ? (
                <g style={{ pointerEvents: 'none' }}>
                  <path d={`M${x0},${cy - hs}L${x0 + hs},${cy}L${x0},${cy + hs}L${x0 - hs},${cy}Z`} fill={c} stroke={c} strokeWidth="3" strokeLinejoin="round" />
                  <circle cx={x0} cy={cy} r={Math.max(0, hs * 0.3)} fill={background} />
                </g>
              ) : (
                <g style={{ pointerEvents: 'none' }}>
                  <clipPath id={`c${uid}${t.i}`}>
                    <path d={full} />
                  </clipPath>
                  <g clipPath={`url(#c${uid}${t.i})`}>
                    <rect x={x0} y={y} width={w} height={bh} fill={showProgress ? mix(c, background, 0.68) : c} />
                    {showProgress && stripes && <rect x={x0 + pwid} y={y} width={Math.max(0, w - pwid)} height={bh} fill={`url(#st${uid})`} />}
                    {showProgress && pwid > 0 && <rect x={x0} y={y} width={pwid} height={bh} fill={c} />}
                    {!showProgress && stripes && <rect x={x0 + w * 0.72} y={y} width={w * 0.28} height={bh} fill={mix(c, '#000000', 0.12)} />}
                    {!showProgress && stripes && <rect x={x0 + w * 0.72} y={y} width={w * 0.28} height={bh} fill={`url(#st${uid})`} />}
                  </g>
                  {showProgress && t.prog > 0 && p > 0.5 && (
                    <text
                      x={inside ? x0 + 8 : x0 + w + 7}
                      y={cy}
                      dy="0.35em"
                      fontSize={size * 0.75}
                      fontWeight="800"
                      fill={inside ? inkOn(c, textColor) : textColor}
                      opacity={clamp((p - 0.5) * 3, 0, 1)}
                      style={{ fontVariantNumeric: 'tabular-nums' }}
                    >
                      {pct}
                    </text>
                  )}
                </g>
              )}
            </g>
          )
        })}

        {showToday && today >= 0 && today <= end && (
          <g style={{ pointerEvents: 'none' }}>
            <line x1={X(today)} x2={X(today)} y1={m.t - 4} y2={m.t + n * rh + 4} stroke={todayColor} strokeWidth="2.5" strokeLinecap="round" strokeDasharray="2 6" />
            <circle cx={X(today)} cy={m.t - 4} r="4" fill={todayColor} />
            <rect x={X(today) - size * 2.2} y={m.t + n * rh + 6} width={size * 4.4} height={size * 1.5} rx={size * 0.75} fill={todayColor} />
            <text x={X(today)} y={m.t + n * rh + 6 + size * 0.75} dy="0.35em" textAnchor="middle" fontSize={size * 0.72} fontWeight="800" letterSpacing="0.06em" fill={inkOn(todayColor, textColor)}>
              TODAY
            </text>
          </g>
        )}
      </svg>
    </Card>
  )
}
