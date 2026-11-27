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

// Multi-value rows: "Revenue:1|0.8|-0.2" -> { label: 'Revenue', values: [1, 0.8, -0.2] }
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
// white or dark ink, whichever reads better on a filled colour
function inkOn(c, dark) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(String(c).slice(i, i + 2), 16) || 0)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.66 ? dark : '#ffffff'
}
// a row of flat swatches with end labels, used as the chart legend
function SwatchLegend({ colorAt, n, lo, mid, hi, mutedColor, size }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6em', marginTop: '0.9em', fontSize: '0.82em', fontWeight: 600, color: mutedColor, fontVariantNumeric: 'tabular-nums' }}>
      <span>{lo}</span>
      <div style={{ display: 'flex', gap: 3 }}>
        {Array.from({ length: n }, (_, i) => (
          <i key={i} style={{ width: size * 1.5, height: size * 0.9, borderRadius: 4, background: colorAt(n > 1 ? i / (n - 1) : 0.5) }} />
        ))}
      </div>
      <span>{hi}</span>
      {mid != null && <span style={{ marginLeft: '0.4em' }}>{`(mid ${mid})`}</span>}
    </div>
  )
}

// Flat infographic correlation matrix: how every variable moves with every other, from
// -1 (opposite) through 0 (unrelated) to +1 (together). Each pair sits on a soft flat
// tile and is drawn as a circle or square sized by strength, a filled cell, a number
// with a strength bar, or mixed (circles below the diagonal, numbers above). Negative
// is `color2`, positive `color`, near zero a soft grey; the diagonal wears stripes.
// Give a matrix as rows "Name:1|0.8|-0.2" (first row first), or leave `data` empty to
// compute one from seeded demo variables.
export default function FlatCorrelationMatrix({
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
  stripes = true,
  stripeWidth = 3,
  cellSize = 40,
  tooltip = true,
  animate = true,
  duration = 1300,
  width = 560,
  size = 13,
  color = '#4a7fe8',
  color2 = '#ef5b7f',
  background = '#ffffff',
  trackColor = '#eef0f6',
  textColor = '#2b2f3a',
  mutedColor = '#8a90a0',
}) {
  const uid = useId().replace(/:/g, '')
  const wrap = useRef(null)
  const [boxRef, boxW] = useWidth()

  const model = useMemo(() => {
    const NAMES_V = ['Revenue', 'Users', 'Churn', 'NPS', 'Support', 'Latency', 'Spend', 'Growth', 'Retention', 'Errors']
    const parsed = String(data ?? '').trim() ? parseMulti(data) : null
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
      const series = load.map(() => new Array(120).fill(0))
      const fac = Array.from({ length: F }, () => Array.from({ length: 120 }, () => gauss(r)))
      for (let v = 0; v < N; v++) for (let t = 0; t < 120; t++) series[v][t] = fac.reduce((a, f, k) => a + f[t] * load[v][k], 0) + gauss(r) * 0.9
      names = NAMES_V.slice(0, N)
      M = series.map((a, i) => series.map((b, j) => (i === j ? 1 : pearson(a, b))))
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
  }, [data, variables, seed, strength, cluster])

  const { names, M } = model
  const N = names.length
  const neutral = mix(mutedColor, background, 0.7)
  const colorAt = (t) => (t < 0.5 ? mix(color2, neutral, clamp(t, 0, 1) * 2) : mix(neutral, color, (clamp(t, 0, 1) - 0.5) * 2))
  // a gentle curve so moderate links still read as clearly coloured
  const colorOf = (v) => colorAt((Math.sign(v) * Math.abs(v) ** 0.7 + 1) / 2)
  const p = useReveal(animate, duration, `${data}|${variables}|${seed}|${strength}|${cluster}|${display}|${triangle}`)
  const [hov, setHov] = useState(null)
  const [tip, setTip] = useState(null)

  const mixed = display === 'mixed'
  const tri = mixed ? 'full' : triangle
  const maxLab = Math.min(12, Math.max(...names.map((s) => s.length)))
  const labW = maxLab * size * 0.6 + 12
  const W = Math.max(260, (boxW || width) - size * 3)
  const cell = Math.max(18, Math.min((W - labW - 6) / N, cellSize))
  const gridW = cell * N
  const H = labW * 0.72 + gridW + 8
  // centre the matrix (with its row labels) in the card
  const x0 = Math.max(labW, (W - gridW + labW) / 2)
  const show = (i, j) => (tri === 'full' ? true : tri === 'lower' ? j <= i : j >= i) && (showDiagonal || i !== j)
  const word = (v) => {
    const a = Math.abs(v)
    const s = a > 0.7 ? 'strong' : a > 0.4 ? 'moderate' : a > 0.15 ? 'weak' : 'no'
    return s === 'no' ? 'no clear link' : `${s} ${v > 0 ? 'positive' : 'negative'}`
  }
  const label = (v) => (v === 1 ? '1' : v.toFixed(decimals).replace(/^(-?)0\./, '$1.'))
  const tipFor = (e, i, j, v) => tipAt(e, wrap, `${names[i]} × ${names[j]}`, [{ color: colorOf(v), label: 'r', value: v.toFixed(2) }, { label: 'Link', value: i === j ? 'itself' : word(v) }])
  const pad = Math.max(1.5, cell * 0.06)
  const tr = Math.min(8, cell * 0.22)
  const strongest = []
  for (let i = 0; i < N; i++) for (let j = 0; j < i; j++) strongest.push([Math.abs(M[i][j]), i, j])
  strongest.sort((a, b) => b[0] - a[0])

  return (
    <Card wrapRef={(el) => { wrap.current = el; boxRef.current = el }} {...{ width, background, textColor, mutedColor, size, title, subtitle, tip }}>
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${title}. Correlation matrix of ${names.join(', ')}. Strongest pairs: ${strongest.slice(0, 3).map(([, i, j]) => `${names[i]} and ${names[j]} ${M[i][j].toFixed(2)}`).join('; ')}.`}
        style={{ display: 'block', maxWidth: '100%', margin: '0 auto', overflow: 'visible' }}
        onMouseLeave={() => { setHov(null); setTip(null) }}
      >
        <defs>
          <pattern id={`st${uid}`} width={stripeWidth * 2} height={stripeWidth * 2} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width={stripeWidth} height={stripeWidth * 2} fill="#ffffff" opacity="0.4" />
          </pattern>
        </defs>
        {names.map((nm, i) => (
          <text key={`r${i}`} x={x0 - 10} y={i * cell + cell / 2} dy="0.35em" textAnchor="end" fontSize={size * 0.92} fontWeight="600" fill={hov && hov.i === i ? textColor : mutedColor} style={{ transition: 'fill .15s' }}>
            {nm.length > 12 ? nm.slice(0, 11) + '…' : nm}
          </text>
        ))}
        {names.map((nm, j) => (
          <text key={`c${j}`} transform={`translate(${x0 + j * cell + cell / 2},${gridW + size * 1.2}) rotate(-40)`} textAnchor="end" fontSize={size * 0.92} fontWeight="600" fill={hov && hov.j === j ? textColor : mutedColor} style={{ transition: 'fill .15s' }}>
            {nm.length > 12 ? nm.slice(0, 11) + '…' : nm}
          </text>
        ))}

        {M.map((row, i) =>
          row.map((v, j) => {
            if (!show(i, j)) return null
            const k = clamp((p - ((i + j) / (2 * N)) * 0.5) / 0.5, 0, 1)
            if (k <= 0) return null
            const s = pop(k)
            const cx = x0 + j * cell + cell / 2
            const cy = i * cell + cell / 2
            const c = colorOf(v)
            const a = Math.abs(v)
            const on = !crosshair || !hov || hov.i === i || hov.j === j
            const exact = hov && hov.i === i && hov.j === j
            const diag = i === j
            const mode = mixed ? (j < i ? 'circles' : j > i ? 'numbers' : 'circles') : display
            const inner = cell - pad * 2
            const fs = Math.min(size * 0.85, cell * 0.32)
            const striped = stripes && diag && mode !== 'numbers'
            let mark = null
            let clip = null
            if (mode === 'cells') {
              clip = <rect x={cx - inner / 2} y={cy - inner / 2} width={inner} height={inner} rx={tr} />
              mark = <rect x={cx - inner / 2} y={cy - inner / 2} width={inner} height={inner} rx={tr} fill={c} />
            } else if (mode === 'squares') {
              const q = (inner - 4) * Math.max(0.2, a)
              clip = <rect x={cx - q / 2} y={cy - q / 2} width={q} height={q} rx={Math.min(5, q / 4)} />
              mark = <rect x={cx - q / 2} y={cy - q / 2} width={q} height={q} rx={Math.min(5, q / 4)} fill={c} />
            } else if (mode === 'circles') {
              const r = ((inner - 4) / 2) * Math.max(0.18, a)
              clip = <circle cx={cx} cy={cy} r={r} />
              mark = <circle cx={cx} cy={cy} r={r} fill={c} />
            }
            const tileBg = mode !== 'cells'
            // value text: on the shape when it is big enough to hold it, else on the tile
            const bigMark = mode === 'cells' || (mode !== 'numbers' && (inner - 4) * a > fs * 2.6)
            const wantText = mode === 'numbers' || (showValues && cell > size * 2.2 && (mode === 'cells' || bigMark))
            return (
              <g key={`${i}-${j}`} opacity={on ? 1 : 0.4} style={{ transition: 'opacity .15s', pointerEvents: 'none' }}>
                {tileBg && <rect x={cx - inner / 2} y={cy - inner / 2} width={inner} height={inner} rx={tr} fill={trackColor} />}
                <g transform={`translate(${cx} ${cy}) scale(${s}) translate(${-cx} ${-cy})`}>
                  {mark}
                  {striped && clip && (
                    <>
                      <clipPath id={`c${uid}${i}`}>{clip}</clipPath>
                      <g clipPath={`url(#c${uid}${i})`}>
                        <rect x={cx - cell / 2} y={cy - cell / 2} width={cell} height={cell} fill={mix(c, '#000000', 0.12)} />
                        <rect x={cx - cell / 2} y={cy - cell / 2} width={cell} height={cell} fill={`url(#st${uid})`} />
                      </g>
                    </>
                  )}
                  {mode === 'numbers' && (
                    <rect x={cx - (inner * 0.6 * Math.max(0.08, a)) / 2} y={cy + fs * 0.75} width={inner * 0.6 * Math.max(0.08, a)} height={Math.max(2.5, cell * 0.08)} rx={2} fill={c} />
                  )}
                  {wantText && cell > size * 1.9 && (
                    <text
                      x={cx}
                      y={mode === 'numbers' ? cy - fs * 0.15 : cy}
                      dy="0.35em"
                      textAnchor="middle"
                      fontSize={fs}
                      fontWeight="700"
                      fill={mode === 'numbers' ? textColor : inkOn(c, textColor)}
                      style={{ fontVariantNumeric: 'tabular-nums' }}
                    >
                      {label(v)}
                    </text>
                  )}
                </g>
                {exact && <rect x={cx - inner / 2 - 1.5} y={cy - inner / 2 - 1.5} width={inner + 3} height={inner + 3} rx={tr + 1.5} fill="none" stroke={textColor} strokeWidth="2.5" />}
              </g>
            )
          }),
        )}

        {/* hit areas: the whole cell */}
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
                onMouseEnter={(e) => { setHov({ i, j }); tooltip && setTip(tipFor(e, i, j, v)) }}
                onMouseMove={(e) => tooltip && setTip(tipFor(e, i, j, v))}
              />
            ) : null,
          ),
        )}
      </svg>
      {showLegend && <SwatchLegend colorAt={colorAt} n={7} lo="−1" mid={null} hi="+1" mutedColor={mutedColor} size={size} />}
    </Card>
  )
}
