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
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
// blend two #rrggbb colours
function mix(a, b, t) {
  const h = (c) => [1, 3, 5].map((i) => parseInt(String(c).slice(i, i + 2), 16) || 0)
  const [A, B] = [h(a), h(b)]
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('')
}
const paletteOf = (n, base) => Array.from({ length: n }, (_, i) => base[i % base.length])
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

// ---- flow helpers ----
// "A>B:120, B>C:80" -> [{ path: ['A', 'B'], v: 120 }]
function parseLinks(data, sep = '>') {
  return String(data ?? '')
    .split(/[,\n;]/)
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => {
      const k = x.lastIndexOf(':')
      const pair = (k < 0 ? x : x.slice(0, k)).split(sep).map((s) => s.trim())
      return { path: pair.filter(Boolean), v: k < 0 ? 1 : num(x.slice(k + 1)) }
    })
    .filter((l) => l.path.length >= 2 && l.v > 0)
}
const ribbon = (x0, y0, x1, y1, w) => {
  const xm = (x0 + x1) / 2
  return `M${x0},${y0}C${xm},${y0} ${xm},${y1} ${x1},${y1}L${x1},${y1 + w}C${xm},${y1 + w} ${xm},${y0 + w} ${x0},${y0 + w}Z`
}
// Sankey-style layout. nodes: [{ layer? }], links: [{ s, t, v }] by node index.
function sankeyLayout({ nodes, links, W, H, nodeWidth, pad, iterations = 6, fixedLayers = false, keepOrder = false, align = 'justify' }) {
  const N = nodes.map((n, i) => ({ ...n, i, ins: [], outs: [], vin: 0, vout: 0 }))
  const L = links.map((l, k) => ({ ...l, k }))
  L.forEach((l) => {
    N[l.s].outs.push(l)
    N[l.t].ins.push(l)
    N[l.s].vout += l.v
    N[l.t].vin += l.v
  })
  N.forEach((n) => (n.value = Math.max(n.vin, n.vout)))
  if (!fixedLayers) {
    N.forEach((n) => (n.layer = 0))
    for (let it = 0; it < N.length; it++) {
      let moved = false
      L.forEach((l) => {
        if (N[l.t].layer < N[l.s].layer + 1) {
          N[l.t].layer = N[l.s].layer + 1
          moved = true
        }
      })
      if (!moved) break
    }
    const maxL = Math.max(0, ...N.map((n) => n.layer))
    if (align === 'justify') N.forEach((n) => { if (!n.outs.length) n.layer = maxL })
  }
  const maxL = Math.max(1, ...N.map((n) => n.layer))
  const cols = Array.from({ length: maxL + 1 }, () => [])
  N.forEach((n) => cols[n.layer].push(n))
  const ky = Math.min(...cols.filter((c) => c.length).map((c) => (H - (c.length - 1) * pad) / Math.max(1e-9, c.reduce((a, n) => a + n.value, 0))))
  N.forEach((n) => {
    n.x0 = (n.layer / maxL) * (W - nodeWidth)
    n.x1 = n.x0 + nodeWidth
    n.h = Math.max(1, n.value * ky)
  })
  const stack = (c) => {
    let y = 0
    c.forEach((n) => {
      n.y0 = y
      y += n.h + pad
    })
  }
  cols.forEach(stack)
  const resolve = (c) => {
    c.sort((a, b) => a.y0 - b.y0)
    let y = 0
    c.forEach((n) => {
      if (n.y0 < y) n.y0 = y
      y = n.y0 + n.h + pad
    })
    let over = y - pad - H
    for (let i = c.length - 1; i >= 0 && over > 0; i--) {
      const n = c[i]
      const lim = i === c.length - 1 ? H - n.h : c[i + 1].y0 - pad - n.h
      if (n.y0 > lim) n.y0 = lim
    }
    if (c[0] && c[0].y0 < 0) {
      let yy = 0
      c.forEach((n) => { n.y0 = Math.max(n.y0, yy); yy = n.y0 + n.h + pad })
    }
  }
  if (!keepOrder) {
    const center = (n) => n.y0 + n.h / 2
    for (let it = 0; it < iterations; it++) {
      const a = 0.9 ** it
      cols.forEach((c) => {
        c.forEach((n) => {
          if (!n.ins.length) return
          const w = n.ins.reduce((s, l) => s + l.v, 0)
          const y = n.ins.reduce((s, l) => s + center(N[l.s]) * l.v, 0) / w
          n.y0 += (y - center(n)) * a
        })
        resolve(c)
      })
      ;[...cols].reverse().forEach((c) => {
        c.forEach((n) => {
          if (!n.outs.length) return
          const w = n.outs.reduce((s, l) => s + l.v, 0)
          const y = n.outs.reduce((s, l) => s + center(N[l.t]) * l.v, 0) / w
          n.y0 += (y - center(n)) * a
        })
        resolve(c)
      })
    }
  }
  N.forEach((n) => (n.y1 = n.y0 + n.h))
  N.forEach((n) => {
    let y = n.y0
    ;[...n.outs].sort((a, b) => N[a.t].y0 - N[b.t].y0 || (a.order ?? 0) - (b.order ?? 0)).forEach((l) => {
      l.w = l.v * ky
      l.sy = y
      y += l.w
    })
    y = n.y0
    ;[...n.ins].sort((a, b) => N[a.s].y0 - N[b.s].y0 || (a.order ?? 0) - (b.order ?? 0)).forEach((l) => {
      l.ty = y
      y += l.v * ky
    })
  })
  return { nodes: N, links: L, ky }
}
// ---- end flow helpers ----

const splitNames = (s) =>
  String(s ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)

// Flat infographic alluvial diagram: follows groups as they move between categories
// across several stages. Each path is "Free>Pro>Team:120" (one category per stage) and
// keeps the flat colour of where it started (or ended). Stage names sit in rounded pills,
// node bars are chunky with a striped foot, bands grow stage by stage, and hovering a node
// or band traces that group through every stage.
export default function FlatAlluvialDiagram({
  data = 'Free>Free>Free:420, Free>Pro>Pro:180, Free>Pro>Team:60, Free>Free>Pro:110, Free>Free>Churned:240, Pro>Pro>Pro:260, Pro>Team>Team:90, Pro>Pro>Churned:70, Pro>Free>Free:40, Team>Team>Team:150, Team>Pro>Pro:20',
  stages = 'January, April, July',
  title = 'How plans changed',
  subtitle = 'Customers by plan at three points in the year',
  colorBy = 'first stage',
  linkTint = 0.45,
  nodeWidth = 18,
  nodePadding = 14,
  nodeRadius = 6,
  stripes = true,
  stripeWidth = 4,
  showValues = true,
  showLegend = true,
  tooltip = true,
  animate = true,
  duration = 1400,
  decimals = 0,
  prefix = '',
  suffix = '',
  width = 720,
  height = 320,
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
  const W = Math.max(280, (boxW || width) - size * 3)
  const H = Math.max(140, height)

  const model = useMemo(() => {
    const paths = parseLinks(data)
    const S = Math.max(2, ...paths.map((q) => q.path.length))
    const cats = []
    paths.forEach((q) => q.path.forEach((c) => { if (!cats.includes(c)) cats.push(c) }))
    const nodes = []
    const key = new Map()
    for (let s = 0; s < S; s++) {
      cats.forEach((c) => {
        if (paths.some((q) => q.path[s] === c)) {
          key.set(`${s}|${c}`, nodes.length)
          nodes.push({ label: c, layer: s, cat: cats.indexOf(c) })
        }
      })
    }
    const agg = new Map()
    paths.forEach((q) => {
      const origin = cats.indexOf(colorBy === 'last stage' ? q.path[q.path.length - 1] : q.path[0])
      for (let s = 0; s < q.path.length - 1; s++) {
        const a = key.get(`${s}|${q.path[s]}`)
        const b = key.get(`${s + 1}|${q.path[s + 1]}`)
        const k = `${a}|${b}|${origin}`
        const cur = agg.get(k) ?? { s: a, t: b, v: 0, order: origin, origin }
        cur.v += q.v
        agg.set(k, cur)
      }
    })
    return { nodes, links: [...agg.values()], S, cats }
  }, [data, colorBy])

  const stageNames = splitNames(stages)
  const stageOf = (s) => stageNames[s] ?? `Stage ${s + 1}`
  const maxLab = Math.min(14, Math.max(1, ...model.cats.map((c) => c.length)))
  const valLen = showValues ? fmt(Math.max(1, ...model.links.map((l) => l.v)) * 4).length : 0
  const side = maxLab * size * 0.6 + valLen * size * 0.6 + 14
  const m = { l: side, r: side, t: size * 2.9, b: 4 }
  const pw = Math.max(80, W - m.l - m.r)
  const ph = Math.max(60, H - m.t - m.b)
  const lay = useMemo(
    () => sankeyLayout({ nodes: model.nodes, links: model.links, W: pw, H: ph, nodeWidth, pad: nodePadding, fixedLayers: true, keepOrder: true }),
    [model, pw, ph, nodeWidth, nodePadding],
  )
  const { nodes, links } = lay
  const cols = paletteOf(model.cats.length, [color, color2, color3, color4, color5, color6])
  const p = useReveal(animate, duration, `${data}|${colorBy}`)
  const [hov, setHov] = useState(null) // { node } or { link } or { cat }
  const [tip, setTip] = useState(null)

  // a hovered node / band / legend item lights every band of the same group, all the way along
  const lit = useMemo(() => {
    if (!hov) return null
    let origins
    if (hov.cat != null) origins = new Set([hov.cat])
    else if (hov.link != null) origins = new Set([links[hov.link].origin])
    else origins = new Set([...nodes[hov.node].ins, ...nodes[hov.node].outs].map((l) => l.origin))
    const ls = new Set(links.filter((x) => origins.has(x.origin)).map((x) => x.k))
    const ns = new Set()
    links.forEach((x) => { if (ls.has(x.k)) { ns.add(x.s); ns.add(x.t) } })
    return { ls, ns }
  }, [hov, nodes, links])

  // legend: only the groups that actually colour a band
  const origins = model.cats.map((c, i) => [c, i]).filter(([, i]) => links.some((l) => l.origin === i))
  const tint = clamp(linkTint, 0.05, 1)
  const stageP = (layer) => clamp((p - (layer / model.S) * 0.6) / 0.4, 0, 1)
  const move = (e) => tooltip && setTip((t) => (t ? { ...t, ...tipAt(e, wrap, t.title, t.rows) } : t))
  const leave = () => { setHov(null); setTip(null) }
  const order = lit ? [...links].sort((a, b) => lit.ls.has(a.k) - lit.ls.has(b.k)) : links
  const xOf = (s) => (s / (model.S - 1)) * (pw - nodeWidth) + nodeWidth / 2

  return (
    <Card wrapRef={(el) => { wrap.current = el; boxRef.current = el }} {...{ width, background, textColor, mutedColor, size, title, subtitle, tip }}>
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${title}. Alluvial diagram across ${model.S} stages (${Array.from({ length: model.S }, (_, s) => stageOf(s)).join(', ')}). ${nodes.map((n) => `${stageOf(n.layer)} ${n.label}: ${fmt(n.value)}`).join('; ')}`}
        style={{ display: 'block', overflow: 'visible' }}
        onMouseLeave={leave}
      >
        <defs>
          <pattern id={`st${uid}`} width={stripeWidth * 2} height={stripeWidth * 2} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width={stripeWidth} height={stripeWidth * 2} fill="#ffffff" opacity="0.35" />
          </pattern>
        </defs>
        <g transform={`translate(${m.l},${m.t})`}>
          {/* stage names in flat pills */}
          {Array.from({ length: model.S }, (_, s) => {
            const label = stageOf(s).toUpperCase()
            const pwid = label.length * size * 0.82 * 0.68 + size * 1.6
            const k = stageP(s)
            return (
              <g key={s} opacity={ease(k)} style={{ pointerEvents: 'none' }}>
                <path d={rrect(xOf(s) - pwid / 2, -size * 2.6, pwid, size * 1.8, [size * 0.9, size * 0.9, size * 0.9, size * 0.9])} fill={trackColor} />
                <text x={xOf(s)} y={-size * 1.7} dy="0.35em" textAnchor="middle" fontSize={size * 0.82} fontWeight="700" letterSpacing="0.06em" fill={mutedColor}>{label}</text>
              </g>
            )
          })}

          {order.map((l) => {
            const s = nodes[l.s]
            const t = nodes[l.t]
            const ip = ease(stageP(s.layer + 0.5))
            if (ip <= 0) return null
            const on = !lit || lit.ls.has(l.k)
            const x1 = s.x1 + (t.x0 - s.x1) * ip
            const ty = l.sy + (l.ty - l.sy) * ip
            const c = cols[l.origin]
            return (
              <path
                key={l.k}
                d={ribbon(s.x1 - 1, l.sy, x1 + (ip >= 1 ? 1 : 0), ty, Math.max(1.5, l.w))}
                fill={mix(background, c, lit && on ? Math.min(1, tint + 0.3) : tint)}
                opacity={on ? 1 : 0.4}
                style={{ transition: 'opacity .2s, fill .2s' }}
                onMouseEnter={(e) => {
                  setHov({ link: l.k })
                  if (tooltip)
                    setTip(tipAt(e, wrap, `${s.label} → ${t.label}`, [
                      { color: c, label: `${colorBy === 'last stage' ? 'Ended as' : 'Started as'} ${model.cats[l.origin]}`, value: fmt(l.v) },
                      { label: `Of ${s.label} (${stageOf(s.layer)})`, value: `${((l.v / Math.max(1e-9, s.value)) * 100).toFixed(1)}%` },
                    ]))
                }}
                onMouseMove={move}
              />
            )
          })}

          {nodes.map((n) => {
            const k = stageP(n.layer)
            if (k <= 0) return null
            const first = n.layer === 0
            const last = n.layer === model.S - 1
            const c = cols[n.cat]
            const on = !lit || lit.ns.has(n.i)
            const h = Math.max(3, n.h)
            const d = rrect(n.x0, n.y0, n.x1 - n.x0, h, [nodeRadius, nodeRadius, nodeRadius, nodeRadius])
            const cx = (n.x0 + n.x1) / 2
            const cy = n.y0 + h / 2
            const band = h * 0.3
            return (
              <g
                key={n.i}
                opacity={on ? 1 : 0.4}
                style={{ transition: 'opacity .2s' }}
                onMouseEnter={(e) => {
                  setHov({ node: n.i })
                  if (tooltip) setTip(tipAt(e, wrap, `${n.label} · ${stageOf(n.layer)}`, [{ color: c, label: 'Total', value: fmt(n.value) }]))
                }}
                onMouseMove={move}
              >
                <g transform={`translate(${cx} ${cy}) scale(${pop(k)}) translate(${-cx} ${-cy})`}>
                  <path d={d} fill={c} />
                  {stripes && h > 14 && (
                    <>
                      <clipPath id={`c${uid}${n.i}`}><path d={d} /></clipPath>
                      <g clipPath={`url(#c${uid}${n.i})`}>
                        <rect x={n.x0} y={n.y0 + h - band} width={n.x1 - n.x0} height={band} fill={mix(c, '#000000', 0.12)} />
                        <rect x={n.x0} y={n.y0 + h - band} width={n.x1 - n.x0} height={band} fill={`url(#st${uid})`} />
                      </g>
                    </>
                  )}
                  <rect x={n.x0 - 4} y={n.y0 - 3} width={n.x1 - n.x0 + 8} height={h + 6} fill="transparent" />
                </g>
                {(first || last) && (
                  <text x={first ? n.x0 - 8 : n.x1 + 8} y={cy} dy="0.35em" textAnchor={first ? 'end' : 'start'} fontSize={size * 0.92} opacity={ease(k)} style={{ pointerEvents: 'none' }}>
                    {first && showValues && <tspan fontWeight="800" fill={mutedColor} style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(n.value)} </tspan>}
                    <tspan fontWeight="700" fill={textColor}>{n.label}</tspan>
                    {last && showValues && <tspan dx="0.45em" fontWeight="800" fill={mutedColor} style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(n.value)}</tspan>}
                  </text>
                )}
                {!first && !last && h > size * 1.3 && (
                  <text x={n.x1 + 6} y={cy} dy="0.35em" fontSize={size * 0.8} fontWeight="700" fill={textColor} stroke={background} strokeWidth="4" strokeLinejoin="round" paintOrder="stroke" opacity={ease(k)} style={{ pointerEvents: 'none' }}>{n.label}</text>
                )}
              </g>
            )
          })}
        </g>
      </svg>

      {showLegend && origins.length >= 2 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.5em 1.3em', marginTop: '1em' }} onMouseLeave={leave}>
          {origins.map(([c, i]) => (
            <div
              key={c}
              onMouseEnter={() => setHov({ cat: i })}
              style={{ display: 'flex', alignItems: 'center', gap: '0.45em', fontSize: '0.9em', opacity: hov?.cat != null && hov.cat !== i ? 0.4 : 1, transition: 'opacity .2s', cursor: 'default' }}
            >
              <i style={{ width: '0.85em', height: '0.85em', borderRadius: '50%', background: cols[i], flex: 'none' }} />
              <span style={{ color: mutedColor, fontWeight: 600 }}>{colorBy === 'last stage' ? `Ended as ${c}` : `Started as ${c}`}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
