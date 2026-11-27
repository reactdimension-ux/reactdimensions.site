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

// ---- flow helpers ----
function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const inkOn = (c) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16) / 255)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.55 ? '#0b0b0d' : '#ffffff'
}
// n colours: the given ones first, then blends between them
function paletteOf(n, base) {
  return Array.from({ length: n }, (_, i) => (i < base.length ? base[i] : mix(base[i % base.length], base[(i + 1) % base.length], 0.5)))
}
// "A>B:120, B>C:80" -> [{ s: 'A', t: 'B', v: 120 }]
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

// Network graph: nodes and the links between them, laid out by a small live physics
// simulation (nodes push apart, links pull together). Drag a node and the rest follow.
// Links are "A-B" or "A-B:weight". Nodes are sized by how connected they are and
// coloured by community (groups found by label propagation); hover lights up neighbours.
export default function NetworkGraph({
  data = 'Ada-Grace:3, Ada-Linus:2, Ada-Alan:4, Grace-Alan:2, Grace-Ken:1, Alan-Ken:2, Linus-Ken:1, Ken-Dennis:4, Dennis-Bjarne:2, Dennis-Brian:3, Brian-Bjarne:1, Bjarne-Guido:2, Guido-Larry:1, Guido-Yukihiro:2, Larry-Yukihiro:1, Larry-Rasmus:2, Rasmus-Brendan:2, Brendan-Anders:3, Anders-James:2, James-Bjarne:1, James-Brendan:1, Margaret-Ada:2, Margaret-Grace:3, Margaret-Barbara:2, Barbara-Edsger:3, Edsger-Tony:2, Tony-Barbara:1, Edsger-Alan:1, Yukihiro-Matz:3, Matz-Larry:1',
  title = 'Who works with whom',
  subtitle = 'Drag a node. Size: connections. Colour: community',
  layout = 'force',
  charge = 280,
  linkDistance = 62,
  nodeSize = 6,
  sizeByDegree = true,
  colorBy = 'community',
  labels = 'auto',
  linkOpacity = 0.35,
  curved = true,
  draggable = true,
  tooltip = true,
  animate = true,
  width = 720,
  height = 340,
  size = 13,
  color = '#d77757',
  color2 = '#5b9bd5',
  color3 = '#4eba65',
  color4 = '#b48ead',
  color5 = '#e0a030',
  color6 = '#56b6c2',
  background = '#111214',
  textColor = '#ececec',
  mutedColor = '#8b8f98',
}) {
  const wrap = useRef(null)
  const svgRef = useRef(null)
  const [boxRef, boxW] = useWidth()
  const W = Math.max(280, (boxW || width) - size * 2.8)
  const H = height

  const graph = useMemo(() => {
    const names = []
    const idx = (s) => {
      let i = names.indexOf(s)
      if (i < 0) i = names.push(s) - 1
      return i
    }
    const seen = new Map()
    parseLinks(data, '-').forEach(({ path, v }) => {
      for (let k = 0; k < path.length - 1; k++) {
        const a = idx(path[k])
        const b = idx(path[k + 1])
        if (a === b) continue
        const key = a < b ? `${a}-${b}` : `${b}-${a}`
        seen.set(key, (seen.get(key) ?? 0) + v)
      }
    })
    const links = [...seen].map(([key, w]) => { const [s, t] = key.split('-').map(Number); return { s, t, w } })
    const deg = names.map(() => 0)
    const adj = names.map(() => new Set())
    links.forEach((l) => { deg[l.s]++; deg[l.t]++; adj[l.s].add(l.t); adj[l.t].add(l.s) })
    // label propagation: each node takes the most common label among its neighbours
    const r = rng(7)
    let lab = names.map((_, i) => i)
    for (let it = 0; it < 12; it++) {
      const order = names.map((_, i) => i).sort(() => r() - 0.5)
      order.forEach((i) => {
        const c = new Map()
        links.forEach((l) => {
          if (l.s === i) c.set(lab[l.t], (c.get(lab[l.t]) ?? 0) + l.w)
          if (l.t === i) c.set(lab[l.s], (c.get(lab[l.s]) ?? 0) + l.w)
        })
        let best = lab[i]
        let bv = -1
        c.forEach((v, k) => { if (v > bv) { bv = v; best = k } })
        lab[i] = best
      })
    }
    const uniq = [...new Set(lab)]
    return { names, links, deg, adj, comm: lab.map((l) => uniq.indexOf(l)), nComm: uniq.length }
  }, [data])

  const N = graph.names.length
  const maxDeg = Math.max(1, ...graph.deg)
  const rad = (i) => (sizeByDegree ? nodeSize * (0.75 + 1.1 * Math.sqrt(graph.deg[i] / maxDeg)) : nodeSize)
  const cols = paletteOf(Math.max(graph.nComm, 6), [color, color2, color3, color4, color5, color6])
  const colorOf = (i) => (colorBy === 'community' ? cols[graph.comm[i]] : colorBy === 'degree' ? mix(color2, color, graph.deg[i] / maxDeg) : color)

  const sim = useRef(null)
  const [, setFrame] = useState(0)
  const [hov, setHov] = useState(-1)
  const [tip, setTip] = useState(null)
  const drag = useRef(null)

  // (re)start the simulation when the graph or layout changes
  useEffect(() => {
    const r = rng(11)
    const byComm = graph.names.map((_, i) => i).sort((a, b) => graph.comm[a] - graph.comm[b] || graph.deg[b] - graph.deg[a])
    const pos = graph.names.map((_, i) => {
      if (layout === 'circle') {
        const k = byComm.indexOf(i)
        const a = (k / N) * Math.PI * 2 - Math.PI / 2
        return { x: W / 2 + Math.cos(a) * (Math.min(W, H) / 2 - 40), y: H / 2 + Math.sin(a) * (Math.min(W, H) / 2 - 26), vx: 0, vy: 0 }
      }
      const a = r() * Math.PI * 2
      const d = animate ? 6 + r() * 20 : 40 + r() * 120
      return { x: W / 2 + Math.cos(a) * d, y: H / 2 + Math.sin(a) * d, vx: 0, vy: 0 }
    })
    sim.current = { pos, alpha: layout === 'circle' ? 0 : 1 }
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    let raf
    const step = () => {
      const s = sim.current
      const P = s.pos
      for (let i = 0; i < N; i++)
        for (let j = i + 1; j < N; j++) {
          let dx = P[j].x - P[i].x
          let dy = P[j].y - P[i].y
          let d2 = dx * dx + dy * dy || 0.01
          const f = (charge * 14 * s.alpha) / Math.max(d2, 60)
          const d = Math.sqrt(d2)
          dx /= d
          dy /= d
          P[i].vx -= dx * f
          P[i].vy -= dy * f
          P[j].vx += dx * f
          P[j].vy += dy * f
          const min = rad(i) + rad(j) + 4
          if (d < min) {
            const push = (min - d) / 2
            P[i].x -= dx * push
            P[i].y -= dy * push
            P[j].x += dx * push
            P[j].y += dy * push
          }
        }
      graph.links.forEach((l) => {
        const a = P[l.s]
        const b = P[l.t]
        const dx = b.x - a.x
        const dy = b.y - a.y
        const d = Math.hypot(dx, dy) || 1
        const k = ((d - linkDistance) / d) * 0.06 * s.alpha * Math.min(2, 0.6 + l.w * 0.2)
        a.vx += dx * k
        a.vy += dy * k
        b.vx -= dx * k
        b.vy -= dy * k
      })
      P.forEach((q, i) => {
        q.vx += (W / 2 - q.x) * 0.006 * s.alpha
        q.vy += (H / 2 - q.y) * 0.012 * s.alpha
        if (drag.current && drag.current.i === i) {
          q.x = drag.current.x
          q.y = drag.current.y
          q.vx = q.vy = 0
          return
        }
        q.vx *= 0.6
        q.vy *= 0.6
        q.x = clamp(q.x + q.vx, 14, W - 14)
        q.y = clamp(q.y + q.vy, 14, H - 14)
      })
      s.alpha = Math.max(drag.current ? 0.3 : 0, s.alpha * 0.985)
    }
    if (layout === 'circle') {
      setFrame((f) => f + 1)
      return
    }
    if (reduce || !animate) {
      for (let k = 0; k < 300; k++) step()
      setFrame((f) => f + 1)
    }
    const loop = () => {
      if (sim.current.alpha > 0.004 || drag.current) {
        step()
        setFrame((f) => f + 1)
      }
      raf = requestAnimationFrame(loop)
    }
    if (!reduce && animate) raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [graph, layout, charge, linkDistance, W, H, N, animate]) // eslint-disable-line react-hooks/exhaustive-deps

  const P = sim.current?.pos ?? []
  const local = (e) => {
    const b = svgRef.current.getBoundingClientRect()
    return [e.clientX - b.left, e.clientY - b.top]
  }
  const onDown = (e, i) => {
    if (!draggable) return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    const [x, y] = local(e)
    drag.current = { i, x, y }
    sim.current.alpha = Math.max(sim.current.alpha, 0.35)
    setTip(null)
  }
  const onMove = (e) => {
    if (!drag.current) return
    const [x, y] = local(e)
    drag.current.x = clamp(x, 10, W - 10)
    drag.current.y = clamp(y, 10, H - 10)
    if (layout === 'circle') {
      P[drag.current.i].x = drag.current.x
      P[drag.current.i].y = drag.current.y
      setFrame((f) => f + 1)
    }
  }
  const onUp = () => (drag.current = null)
  const near = (i) => hov < 0 || i === hov || graph.adj[hov].has(i)
  const showLabel = (i) => labels === 'all' || (labels === 'auto' && (graph.deg[i] >= Math.max(3, maxDeg * 0.5) || i === hov || (hov >= 0 && graph.adj[hov].has(i))))

  if (!P.length) return <Card wrapRef={(el) => { wrap.current = el; boxRef.current = el }} {...{ width, background, color, textColor, mutedColor, size, title, subtitle }}><div style={{ height: H }} /></Card>

  return (
    <Card
      wrapRef={(el) => { wrap.current = el; boxRef.current = el }}
      {...{ width, background, color, textColor, mutedColor, size, title, subtitle, tip }}
      legend={colorBy === 'community' ? <Legend items={Array.from({ length: graph.nComm }, (_, c) => ({ label: `Group ${c + 1}`, color: cols[c] }))} mutedColor={mutedColor} /> : null}
    >
      <svg
        ref={svgRef}
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${title}. Network of ${N} people and ${graph.links.length} connections.`}
        style={{ display: 'block', maxWidth: '100%', overflow: 'visible', touchAction: 'none', userSelect: 'none' }}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={() => { onUp(); setHov(-1); setTip(null) }}
      >
        {graph.links.map((l, k) => {
          const a = P[l.s]
          const b = P[l.t]
          const on = hov < 0 || l.s === hov || l.t === hov
          const mx = (a.x + b.x) / 2 + (curved ? (b.y - a.y) * 0.12 : 0)
          const my = (a.y + b.y) / 2 - (curved ? (b.x - a.x) * 0.12 : 0)
          return (
            <path key={k} d={`M${a.x},${a.y}Q${mx},${my} ${b.x},${b.y}`} fill="none" stroke={on && hov >= 0 ? colorOf(hov) : mutedColor} strokeOpacity={on ? (hov >= 0 ? 0.85 : linkOpacity) : 0.05} strokeWidth={Math.min(5, 0.8 + l.w * 0.5)} strokeLinecap="round" style={{ transition: 'stroke-opacity .2s' }} />
          )
        })}
        {P.map((q, i) => {
          const c = colorOf(i)
          const r = rad(i) * (i === hov ? 1.25 : 1)
          return (
            <g key={i} opacity={near(i) ? 1 : 0.2} style={{ transition: 'opacity .2s' }}>
              <circle cx={q.x} cy={q.y} r={r * 2.2} fill={c} opacity={i === hov ? 0.3 : 0.12} />
              <circle
                cx={q.x}
                cy={q.y}
                r={r}
                fill={c}
                stroke={background}
                strokeWidth="1.5"
                style={{ cursor: draggable ? 'grab' : 'default' }}
                onPointerDown={(e) => onDown(e, i)}
                onPointerEnter={(e) => { if (drag.current) return; setHov(i); tooltip && setTip(tipAt(e, wrap, graph.names[i], [{ color: c, label: 'Connections', value: String(graph.deg[i]), strong: true }, { label: 'Linked to', value: [...graph.adj[i]].slice(0, 4).map((j) => graph.names[j]).join(', ') + (graph.adj[i].size > 4 ? '…' : '') }])) }}
                onPointerLeave={() => { if (!drag.current) { setHov(-1); setTip(null) } }}
              />
              {showLabel(i) && (
                <text x={q.x} y={q.y - r - 5} textAnchor="middle" fontSize={size * 0.8} fontWeight="600" fill={textColor} stroke={background} strokeWidth="3" paintOrder="stroke" style={{ pointerEvents: 'none' }}>{graph.names[i]}</text>
              )}
            </g>
          )
        })}
      </svg>
    </Card>
  )
}
