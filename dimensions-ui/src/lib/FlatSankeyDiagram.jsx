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

// Flat infographic Sankey: chunky rounded node bars in solid colours (with a striped
// foot), joined by flat tinted bands as wide as the flow. Links are "Source>Target:value"
// (a chain like "A>B>C:40" adds both steps). The flow sweeps in from the left, nodes pop
// in column by column, and hovering a node or band traces everything connected to it.
export default function FlatSankeyDiagram({
  data = 'Search>Landing:520, Ads>Landing:310, Social>Landing:180, Referral>Landing:90, Landing>Signup:430, Landing>Bounced:670, Signup>Trial:260, Signup>Free plan:170, Trial>Paid:150, Trial>Churned:110, Free plan>Paid:35',
  title = 'Where visitors go',
  subtitle = 'Visitors this month, from first click to paid plan',
  align = 'justify',
  linkColor = 'source',
  linkTint = 0.4,
  nodeWidth = 18,
  nodePadding = 16,
  nodeRadius = 6,
  iterations = 8,
  stripes = true,
  stripeWidth = 4,
  showValues = true,
  showPercent = false,
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
  textColor = '#2b2f3a',
  mutedColor = '#8a90a0',
}) {
  const uid = useId().replace(/:/g, '')
  const wrap = useRef(null)
  const [boxRef, boxW] = useWidth()
  const fmt = makeFmt({ decimals, prefix, suffix })
  const W = Math.max(280, (boxW || width) - size * 3)
  const H = Math.max(120, height)

  const graph = useMemo(() => {
    const names = []
    const idx = (s) => {
      let i = names.indexOf(s)
      if (i < 0) i = names.push(s) - 1
      return i
    }
    const agg = new Map()
    parseLinks(data).forEach(({ path, v }) => {
      for (let k = 0; k < path.length - 1; k++) {
        const key = `${idx(path[k])}>${idx(path[k + 1])}`
        agg.set(key, (agg.get(key) ?? 0) + v)
      }
    })
    const links = [...agg].map(([key, v]) => { const [s, t] = key.split('>').map(Number); return { s, t, v } }).filter((l) => l.s !== l.t)
    return { names, links }
  }, [data])

  const pct = (v, of) => `${((v / Math.max(1e-9, of)) * 100).toFixed(1)}%`
  const shortName = (s) => (s.length > 16 ? s.slice(0, 15) + '…' : s)
  const maxLab = Math.min(16, Math.max(1, ...graph.names.map((s) => s.length)))
  const valLen = showValues ? (showPercent ? 4 : fmt(graph.links.reduce((a, l) => a + l.v, 0)).length) : 0
  const labW = maxLab * size * 0.6 + valLen * size * 0.6 + 14
  const m = { l: 2, r: labW, t: 6, b: 6 }
  const pw = Math.max(80, W - m.l - m.r)
  const ph = Math.max(60, H - m.t - m.b)
  const lay = useMemo(
    () => (graph.names.length ? sankeyLayout({ nodes: graph.names.map((label) => ({ label })), links: graph.links, W: pw, H: ph, nodeWidth, pad: nodePadding, iterations, align }) : null),
    [graph, pw, ph, nodeWidth, nodePadding, iterations, align],
  )
  const cols = paletteOf(graph.names.length, [color, color2, color3, color4, color5, color6])
  const p = useReveal(animate, duration, `${data}|${align}`)
  const [hov, setHov] = useState(null) // { node } or { link }
  const [tip, setTip] = useState(null)
  const nodes = lay?.nodes ?? []
  const links = lay?.links ?? []

  // everything upstream and downstream of a node
  const traced = useMemo(() => {
    if (!hov || !nodes.length) return null
    const ls = new Set()
    const ns = new Set()
    const walk = (i, dir) => {
      ns.add(i)
      ;(dir > 0 ? nodes[i].outs : nodes[i].ins).forEach((l) => {
        if (ls.has(l.k)) return
        ls.add(l.k)
        walk(dir > 0 ? l.t : l.s, dir)
      })
    }
    if (hov.node != null) {
      walk(hov.node, 1)
      walk(hov.node, -1)
    } else {
      const l = links[hov.link]
      ls.add(l.k)
      ns.add(l.s)
      ns.add(l.t)
    }
    return { ls, ns }
  }, [hov, nodes, links])
  const maxLayer = Math.max(1, ...nodes.map((n) => n.layer))
  const total = nodes.filter((n) => !n.ins.length).reduce((a, n) => a + n.value, 0) || 1
  const tint = clamp(linkTint, 0.05, 1)
  const linkBase = (l) => (linkColor === 'target' ? cols[l.t] : linkColor === 'neutral' ? mutedColor : cols[l.s])
  const move = (e) => tooltip && setTip((t) => (t ? { ...t, ...tipAt(e, wrap, t.title, t.rows) } : t))
  const leave = () => { setHov(null); setTip(null) }
  // lit bands go last so a dimmed band never covers a traced one
  const order = traced ? [...links].sort((a, b) => traced.ls.has(a.k) - traced.ls.has(b.k)) : links

  return (
    <Card wrapRef={(el) => { wrap.current = el; boxRef.current = el }} {...{ width, background, textColor, mutedColor, size, title, subtitle, tip }}>
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${title}. Sankey diagram. ${links.map((l) => `${nodes[l.s].label} to ${nodes[l.t].label}: ${fmt(l.v)}`).join('; ')}`}
        style={{ display: 'block', overflow: 'visible' }}
        onMouseLeave={leave}
      >
        <defs>
          <pattern id={`st${uid}`} width={stripeWidth * 2} height={stripeWidth * 2} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width={stripeWidth} height={stripeWidth * 2} fill="#ffffff" opacity="0.35" />
          </pattern>
          <clipPath id={`sw${uid}`}>
            <rect x="-10" y="-20" width={(W + 40) * ease(p)} height={H + 40} />
          </clipPath>
        </defs>

        <g transform={`translate(${m.l},${m.t})`}>
          <g clipPath={`url(#sw${uid})`}>
            {order.map((l) => {
              const on = !traced || traced.ls.has(l.k)
              const c = linkBase(l)
              return (
                <path
                  key={l.k}
                  d={ribbon(nodes[l.s].x1 - 1, l.sy, nodes[l.t].x0 + 1, l.ty, Math.max(1.5, l.w))}
                  fill={mix(background, c, traced && on ? Math.min(1, tint + 0.3) : tint)}
                  opacity={on ? 1 : 0.4}
                  style={{ transition: 'opacity .2s, fill .2s' }}
                  onMouseEnter={(e) => {
                    setHov({ link: l.k })
                    if (tooltip)
                      setTip(tipAt(e, wrap, `${nodes[l.s].label} → ${nodes[l.t].label}`, [
                        { color: c, label: 'Flow', value: fmt(l.v) },
                        { label: `Of ${nodes[l.s].label}`, value: pct(l.v, nodes[l.s].value) },
                        { label: `Of ${nodes[l.t].label}`, value: pct(l.v, nodes[l.t].value) },
                      ]))
                  }}
                  onMouseMove={move}
                />
              )
            })}
          </g>

          {nodes.map((n) => {
            const on = !traced || traced.ns.has(n.i)
            const k = clamp((p - (n.layer / maxLayer) * 0.6) / 0.4, 0, 1)
            if (k <= 0) return null
            const c = cols[n.i]
            const h = Math.max(3, n.h)
            const d = rrect(n.x0, n.y0, n.x1 - n.x0, h, [nodeRadius, nodeRadius, nodeRadius, nodeRadius])
            const cx = (n.x0 + n.x1) / 2
            const cy = n.y0 + h / 2
            const s = pop(k)
            const band = h * 0.3
            return (
              <g
                key={n.i}
                opacity={on ? 1 : 0.4}
                style={{ transition: 'opacity .2s' }}
                onMouseEnter={(e) => {
                  setHov({ node: n.i })
                  if (tooltip)
                    setTip(tipAt(e, wrap, n.label, [
                      { color: c, label: 'Total', value: fmt(n.value) },
                      ...(n.vin ? [{ label: 'In', value: fmt(n.vin) }] : []),
                      ...(n.vout ? [{ label: 'Out', value: fmt(n.vout) }] : []),
                      { label: 'Share of all', value: pct(n.value, total) },
                    ]))
                }}
                onMouseMove={move}
              >
                <g transform={`translate(${cx} ${cy}) scale(${s}) translate(${-cx} ${-cy})`}>
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
                  {/* hit area a little bigger than the bar */}
                  <rect x={n.x0 - 4} y={n.y0 - 3} width={n.x1 - n.x0 + 8} height={h + 6} fill="transparent" />
                </g>
                {(() => {
                  // the room before the next column of nodes to the right (last column: the reserved margin)
                  const nextX = nodes.reduce((m, o) => (o.x0 > n.x1 + 1 && o.x0 < m ? o.x0 : m), Infinity)
                  const room = (Number.isFinite(nextX) ? nextX : n.x1 + labW) - n.x1 - 14
                  const name = shortName(n.label)
                  const val = showValues ? (showPercent ? `${Math.round((n.value / total) * 100)}%` : fmt(n.value)) : ''
                  const fs = size * 0.92
                  const cw = fs * 0.6
                  // one line if "name value" fits, else value under the name; trim the name if even that won't fit
                  const oneLine = (name.length + (val ? val.length + 1 : 0)) * cw <= room
                  const maxChars = Math.max(3, Math.floor(room / cw))
                  const nm = !oneLine && name.length > maxChars ? `${name.slice(0, maxChars - 1)}…` : name
                  const common = { fontSize: fs, stroke: background, strokeWidth: 4, strokeLinejoin: 'round', paintOrder: 'stroke', opacity: ease(k), style: { pointerEvents: 'none' } }
                  return oneLine || !val ? (
                    <text x={n.x1 + 8} y={cy} dy="0.35em" textAnchor="start" {...common}>
                      <tspan fontWeight="700" fill={textColor}>{nm}</tspan>
                      {val && <tspan dx="0.45em" fontWeight="800" fill={mutedColor} style={{ fontVariantNumeric: 'tabular-nums' }}>{val}</tspan>}
                    </text>
                  ) : (
                    <text x={n.x1 + 8} y={cy} textAnchor="start" {...common}>
                      <tspan x={n.x1 + 8} dy="-0.2em" fontWeight="700" fill={textColor}>{nm}</tspan>
                      <tspan x={n.x1 + 8} dy="1.15em" fontWeight="800" fill={mutedColor} style={{ fontVariantNumeric: 'tabular-nums' }}>{val}</tspan>
                    </text>
                  )
                })()}
              </g>
            )
          })}
        </g>
      </svg>
    </Card>
  )
}
