import { useEffect, useId, useMemo, useRef, useState } from 'react'

// ---- flat infographic helpers (kept inline so this file copies out on its own) ----

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

// ---- graph helpers ----
// small seeded random, so layouts come out the same every time
function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
// "A-B:2, B-C" -> [{ path: ['A', 'B'], v: 2 }]
function parseLinks(data, sep = '-') {
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
// ---- end graph helpers ----

// Flat infographic network graph: solid flat nodes with a white rim (the busiest ones get
// a striped lower band) on thick rounded links, laid out by a small live physics
// simulation. Links are "A-B" or "A-B:weight". Nodes are sized by connections and coloured
// by community (found by label propagation). Nodes pop in one after another; drag a node
// and the rest follow; hover lights up its neighbours.
export default function FlatNetworkGraph({
  data = 'Ada-Grace:3, Ada-Linus:2, Ada-Alan:4, Grace-Alan:2, Grace-Ken:1, Alan-Ken:2, Linus-Ken:1, Ken-Dennis:4, Dennis-Bjarne:2, Dennis-Brian:3, Brian-Bjarne:1, Bjarne-Guido:2, Guido-Larry:1, Guido-Yukihiro:2, Larry-Yukihiro:1, Larry-Rasmus:2, Rasmus-Brendan:2, Brendan-Anders:3, Anders-James:2, James-Bjarne:1, James-Brendan:1, Margaret-Ada:2, Margaret-Grace:3, Margaret-Barbara:2, Barbara-Edsger:3, Edsger-Tony:2, Tony-Barbara:1, Edsger-Alan:1, Yukihiro-Matz:3, Matz-Larry:1',
  title = 'Who works with whom',
  subtitle = 'Drag a node. Size: connections. Colour: community',
  layout = 'force',
  charge = 280,
  linkDistance = 62,
  nodeSize = 7,
  sizeByDegree = true,
  colorBy = 'community',
  labels = 'auto',
  linkTint = 0.35,
  curved = true,
  stripes = true,
  stripeWidth = 3,
  draggable = true,
  showLegend = true,
  tooltip = true,
  animate = true,
  duration = 1200,
  width = 720,
  height = 340,
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
  const svgRef = useRef(null)
  const [boxRef, boxW] = useWidth()
  const W = Math.max(280, (boxW || width) - size * 3)
  const H = Math.max(160, height)

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
    const lab = names.map((_, i) => i)
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
  const p = useReveal(animate, duration, `${data}|${layout}`)

  const sim = useRef(null)
  const [, setFrame] = useState(0)
  const [hov, setHov] = useState(-1)
  const [hovComm, setHovComm] = useState(-1)
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
          const d2 = dx * dx + dy * dy || 0.01
          const f = (charge * 14 * s.alpha) / Math.max(d2, 60)
          const d = Math.sqrt(d2)
          dx /= d
          dy /= d
          P[i].vx -= dx * f
          P[i].vy -= dy * f
          P[j].vx += dx * f
          P[j].vy += dy * f
          const min = rad(i) + rad(j) + 6
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
        const m = rad(i) + 4
        q.x = clamp(q.x + q.vx, m, W - m)
        q.y = clamp(q.y + q.vy, m + size * 1.2, H - m)
      })
      s.alpha = Math.max(drag.current ? 0.3 : 0, s.alpha * 0.985)
    }
    // once the layout has mostly settled, stretch it out from the middle so it fills the
    // card (forces alone leave it bunched in the centre). Only ever grows, capped per axis.
    const fit = () => {
      const s = sim.current
      if (s.fitted || !N) return
      s.fitted = true
      const P = s.pos
      const top = size * 1.2
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
      P.forEach((q, i) => {
        const m = rad(i) + 4
        x0 = Math.min(x0, q.x - m); x1 = Math.max(x1, q.x + m)
        y0 = Math.min(y0, q.y - m); y1 = Math.max(y1, q.y + m)
      })
      const sx = clamp((W - 8) / Math.max(1, x1 - x0), 1, 2.4)
      const sy = clamp((H - top - 4) / Math.max(1, y1 - y0), 1, 1.8)
      const cx = (x0 + x1) / 2
      const cy = (y0 + y1) / 2
      P.forEach((q, i) => {
        const m = rad(i) + 4
        q.x = clamp(W / 2 + (q.x - cx) * sx, m, W - m)
        q.y = clamp((top + H) / 2 + (q.y - cy) * sy, m + top, H - m)
      })
    }
    if (layout === 'circle') {
      setFrame((f) => f + 1)
      return
    }
    if (reduce || !animate) {
      for (let k = 0; k < 300; k++) step()
      fit()
      setFrame((f) => f + 1)
    }
    const loop = () => {
      if (sim.current.alpha > 0.004 || drag.current) {
        step()
        // centring gravity ends at alpha 0, so the stretched layout stays put
        if (sim.current.alpha < 0.05 && !drag.current) fit()
        setFrame((f) => f + 1)
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [graph, layout, charge, linkDistance, W, H, N, animate]) // eslint-disable-line react-hooks/exhaustive-deps

  const P = sim.current?.pos ?? []
  const local = (e) => {
    const b = svgRef.current.getBoundingClientRect()
    return [((e.clientX - b.left) * W) / Math.max(1, b.width), ((e.clientY - b.top) * H) / Math.max(1, b.height)]
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
  const near = (i) => (hovComm >= 0 ? graph.comm[i] === hovComm : hov < 0 || i === hov || graph.adj[hov].has(i))
  const showLabel = (i) => labels === 'all' || (labels === 'auto' && (graph.deg[i] >= Math.max(3, maxDeg * 0.5) || i === hov || (hov >= 0 && graph.adj[hov].has(i))))
  // above the node, or pointing outwards round the circle layout
  const labelAt = (q, r) => {
    if (layout !== 'circle') return { x: q.x, y: q.y - r - 7, textAnchor: 'middle' }
    const a = Math.atan2(q.y - H / 2, q.x - W / 2)
    const [ux, uy] = [Math.cos(a), Math.sin(a)]
    return { x: q.x + ux * (r + 6), y: q.y + uy * (r + 6), dy: uy > 0.5 ? '0.8em' : uy < -0.5 ? '-0.1em' : '0.35em', textAnchor: ux > 0.3 ? 'start' : ux < -0.3 ? 'end' : 'middle' }
  }
  const linkBase = mix(background, mutedColor, clamp(linkTint, 0.05, 1))
  const legendOn = showLegend && colorBy === 'community' && graph.nComm >= 2
  const cardProps = { width, background, textColor, mutedColor, size, title, subtitle }

  if (!P.length) return <Card wrapRef={(el) => { wrap.current = el; boxRef.current = el }} {...cardProps}><div style={{ height: H }} /></Card>

  return (
    <Card wrapRef={(el) => { wrap.current = el; boxRef.current = el }} {...cardProps} tip={tip}>
      <svg
        ref={svgRef}
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${title}. Network of ${N} nodes and ${graph.links.length} connections. ${graph.names.map((n, i) => `${n}: ${graph.deg[i]}`).join('; ')}`}
        style={{ display: 'block', overflow: 'visible', touchAction: 'none', userSelect: 'none' }}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={() => { onUp(); setHov(-1); setTip(null) }}
      >
        <defs>
          <pattern id={`st${uid}`} width={stripeWidth * 2} height={stripeWidth * 2} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width={stripeWidth} height={stripeWidth * 2} fill="#ffffff" opacity="0.35" />
          </pattern>
        </defs>
        {graph.links.map((l, k) => {
          const a = P[l.s]
          const b = P[l.t]
          const lp = ease(Math.min(stag(p, l.s, N), stag(p, l.t, N)))
          if (lp <= 0) return null
          const lit = hovComm < 0 && hov >= 0 && (l.s === hov || l.t === hov)
          const on = hovComm >= 0 ? graph.comm[l.s] === hovComm && graph.comm[l.t] === hovComm : hov < 0 || lit
          const mx = (a.x + b.x) / 2 + (curved ? (b.y - a.y) * 0.12 : 0)
          const my = (a.y + b.y) / 2 - (curved ? (b.x - a.x) * 0.12 : 0)
          return (
            <path
              key={k}
              d={`M${a.x},${a.y}Q${mx},${my} ${b.x},${b.y}`}
              fill="none"
              stroke={lit ? colorOf(hov) : linkBase}
              strokeWidth={Math.min(6, 1.6 + l.w * 0.7)}
              strokeLinecap="round"
              opacity={(on ? 1 : 0.4) * lp}
              style={{ transition: 'opacity .2s' }}
            />
          )
        })}
        {P.map((q, i) => {
          const c = colorOf(i)
          const k = stag(p, i, N)
          if (k <= 0) return null
          const r = rad(i) * (i === hov ? 1.2 : 1) * pop(k)
          const big = stripes && graph.deg[i] >= Math.max(3, maxDeg)
          return (
            <g key={i} opacity={near(i) ? 1 : 0.4} style={{ transition: 'opacity .2s' }}>
              <circle cx={q.x} cy={q.y} r={r + 2.5} fill={background} />
              <circle cx={q.x} cy={q.y} r={r} fill={c} />
              {big && (
                <>
                  <clipPath id={`c${uid}${i}`}><circle cx={q.x} cy={q.y} r={r} /></clipPath>
                  <g clipPath={`url(#c${uid}${i})`}>
                    <rect x={q.x - r} y={q.y + r * 0.25} width={r * 2} height={r} fill={mix(c, '#000000', 0.12)} />
                    <rect x={q.x - r} y={q.y + r * 0.25} width={r * 2} height={r} fill={`url(#st${uid})`} />
                  </g>
                </>
              )}
              {/* hit area bigger than the node */}
              <circle
                cx={q.x}
                cy={q.y}
                r={Math.max(r + 5, 10)}
                fill="transparent"
                style={{ cursor: draggable ? 'grab' : 'default' }}
                onPointerDown={(e) => onDown(e, i)}
                onPointerEnter={(e) => {
                  if (drag.current) return
                  setHov(i)
                  if (tooltip)
                    setTip(tipAt(e, wrap, graph.names[i], [
                      { color: c, label: 'Connections', value: String(graph.deg[i]) },
                      { label: 'Linked to', value: [...graph.adj[i]].slice(0, 4).map((j) => graph.names[j]).join(', ') + (graph.adj[i].size > 4 ? '…' : '') },
                    ]))
                }}
                onPointerLeave={() => { if (!drag.current) { setHov(-1); setTip(null) } }}
              />
              {showLabel(i) && (
                <text {...labelAt(q, r)} fontSize={size * 0.85} fontWeight="700" fill={textColor} stroke={background} strokeWidth="4" strokeLinejoin="round" paintOrder="stroke" opacity={ease(k)} style={{ pointerEvents: 'none' }}>
                  {graph.names[i]}
                </text>
              )}
            </g>
          )
        })}
      </svg>

      {legendOn && (
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.5em 1.3em', marginTop: '1em' }} onMouseLeave={() => setHovComm(-1)}>
          {Array.from({ length: graph.nComm }, (_, c) => (
            <div
              key={c}
              onMouseEnter={() => setHovComm(c)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.45em', fontSize: '0.9em', opacity: hovComm >= 0 && hovComm !== c ? 0.4 : 1, transition: 'opacity .2s', cursor: 'default' }}
            >
              <i style={{ width: '0.85em', height: '0.85em', borderRadius: '50%', background: cols[c], flex: 'none' }} />
              <span style={{ color: mutedColor, fontWeight: 600 }}>{`Group ${c + 1}`}</span>
              <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{graph.comm.filter((x) => x === c).length}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
