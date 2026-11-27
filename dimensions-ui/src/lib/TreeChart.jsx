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

// Tree / dendrogram: a hierarchy drawn top-down, left-to-right or as a radial
// dendrogram. Each entry is a path like "CEO/CTO/Platform" (add ":n" for a value). Click
// a node to fold or unfold its branch; the rest of the tree glides into place. Nodes can
// be dots with labels or small cards, links curved, elbowed or straight.
export default function TreeChart({
  data = 'CEO/CTO/Platform/API, CEO/CTO/Platform/Infra, CEO/CTO/Mobile/iOS, CEO/CTO/Mobile/Android, CEO/CPO/Design, CEO/CPO/Research, CEO/CFO/Finance, CEO/CFO/Legal, CEO/COO/Sales/EMEA, CEO/COO/Sales/Americas, CEO/COO/Support',
  title = 'Company structure',
  subtitle = 'Click a node to fold its branch',
  layout = 'vertical',
  nodeStyle = 'card',
  linkStyle = 'curve',
  colorBy = 'branch',
  collapsible = true,
  startDepth = 0,
  nodeSize = 6,
  linkWidth = 1.6,
  tooltip = true,
  animate = true,
  duration = 1100,
  width = 720,
  height = 330,
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
  const [boxRef, boxW] = useWidth()
  const W = Math.max(280, (boxW || width) - size * 2.8)
  const H = height

  // build the hierarchy from the paths
  const root = useMemo(() => {
    const byId = new Map()
    const make = (id, name, depth, parent) => {
      const n = { id, name, depth, parent, kids: [], value: null }
      byId.set(id, n)
      parent?.kids.push(n)
      return n
    }
    let top = null
    String(data ?? '').split(/[,\n;]/).map((s) => s.trim()).filter(Boolean).forEach((entry) => {
      const k = entry.lastIndexOf(':')
      const parts = (k < 0 ? entry : entry.slice(0, k)).split('/').map((s) => s.trim()).filter(Boolean)
      if (!parts.length) return
      if (!top) top = make(parts[0], parts[0], 0, null)
      let cur = top
      parts.slice(1).forEach((name, d) => {
        const id = `${cur.id}/${name}`
        cur = byId.get(id) ?? make(id, name, d + 1, cur)
      })
      if (k >= 0) cur.value = num(entry.slice(k + 1))
    })
    if (!top) top = make('Root', 'Root', 0, null)
    const tag = (n, b) => { n.branch = b; n.kids.forEach((c, i) => tag(c, n.depth === 0 ? i : b)) }
    tag(top, 0)
    const count = (n) => (n.size = 1 + n.kids.reduce((a, c) => a + count(c), 0))
    count(top)
    return top
  }, [data])

  const [closed, setClosed] = useState(() => new Set())
  useEffect(() => {
    const s = new Set()
    if (startDepth > 0) {
      const walk = (n) => { if (n.depth >= startDepth && n.kids.length) s.add(n.id); n.kids.forEach(walk) }
      walk(root)
    }
    setClosed(s)
  }, [root, startDepth])
  const p = useReveal(animate, duration, `${data}|${layout}`)
  const [hov, setHov] = useState(null)
  const [tip, setTip] = useState(null)

  // layout: leaves get evenly spaced slots, parents sit over the middle of their children
  const { list, links, maxDepth, leaves } = useMemo(() => {
    const list = []
    const links = []
    let leaf = 0
    let maxDepth = 0
    const place = (n) => {
      list.push(n)
      maxDepth = Math.max(maxDepth, n.depth)
      const open = !closed.has(n.id) && n.kids.length
      if (open) {
        n.kids.forEach((c) => { links.push([n, c]); place(c) })
        n.slot = (n.kids[0].slot + n.kids[n.kids.length - 1].slot) / 2
      } else n.slot = leaf++
    }
    place(root)
    return { list, links, maxDepth, leaves: leaf }
  }, [root, closed])

  const card = nodeStyle === 'card'
  const radial = layout === 'radial'
  const horiz = layout === 'horizontal'
  const longest = Math.min(14, Math.max(...list.map((n) => n.name.length)))
  const cardW = Math.min(longest * size * 0.6 + 20, horiz ? 140 : Math.max(46, (W - 20) / Math.max(1, leaves) - 6))
  const cardH = size * 2
  const padX = horiz ? (card ? cardW / 2 + 4 : 10) : card ? cardW / 2 + 2 : 30
  const padY = horiz ? cardH / 2 + 2 : card ? cardH / 2 + 2 : size * 1.4
  const R = Math.min(W, H) / 2 - longest * size * 0.45 - 10
  const pos = (n) => {
    const b = leaves > 1 ? n.slot / (leaves - 1) : 0.5
    const d = maxDepth ? n.depth / maxDepth : 0
    if (radial) {
      const a = b * Math.PI * 2 * (leaves > 1 ? (leaves - 1) / leaves : 1) - Math.PI / 2
      return [W / 2 + Math.cos(a) * d * R, H / 2 + Math.sin(a) * d * R, a]
    }
    if (horiz) return [padX + d * (W - 2 * padX - (card ? 0 : longest * size * 0.55)), padY + b * (H - 2 * padY)]
    return [padX + b * (W - 2 * padX), padY + d * (H - 2 * padY - (card ? 0 : size))]
  }
  const pal = paletteOf(Math.max(6, root.kids.length), [color, color2, color3, color4, color5, color6])
  const colorOf = (n) => (n.depth === 0 ? textColor : colorBy === 'depth' ? mix(color, color2, maxDepth > 1 ? (n.depth - 1) / (maxDepth - 1) : 0) : pal[n.branch % pal.length])
  const linkD = (a, b) => {
    const [x0, y0] = pos(a)
    const [x1, y1] = pos(b)
    if (linkStyle === 'straight' || radial) return radial && linkStyle !== 'straight' ? `M${x0},${y0}Q${(x0 + x1) / 2 + (W / 2 - (x0 + x1) / 2) * 0.15},${(y0 + y1) / 2 + (H / 2 - (y0 + y1) / 2) * 0.15} ${x1},${y1}` : `M${x0},${y0}L${x1},${y1}`
    if (linkStyle === 'elbow') return horiz ? `M${x0},${y0}H${(x0 + x1) / 2}V${y1}H${x1}` : `M${x0},${y0}V${(y0 + y1) / 2}H${x1}V${y1}`
    return horiz ? `M${x0},${y0}C${(x0 + x1) / 2},${y0} ${(x0 + x1) / 2},${y1} ${x1},${y1}` : `M${x0},${y0}C${x0},${(y0 + y1) / 2} ${x1},${(y0 + y1) / 2} ${x1},${y1}`
  }
  const toggle = (n) => {
    if (!collapsible || !n.kids.length) return
    setClosed((s) => { const t = new Set(s); t.has(n.id) ? t.delete(n.id) : t.add(n.id); return t })
  }
  const inPath = (n) => { if (!hov) return true; let a = hov; while (a) { if (a === n) return true; a = a.parent } let b = n; while (b) { if (b === hov) return true; b = b.parent } return false }
  const ipOf = (n) => ease(clamp((p - (maxDepth ? n.depth / maxDepth : 0) * 0.55) / 0.45, 0, 1))
  const glide = 'transform .45s cubic-bezier(.2,.8,.2,1), opacity .25s'

  return (
    <Card wrapRef={(el) => { wrap.current = el; boxRef.current = el }} {...{ width, background, color, textColor, mutedColor, size, title, subtitle, tip }}>
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${title}. Tree with ${root.size} nodes, ${maxDepth + 1} levels deep.`}
        style={{ display: 'block', maxWidth: '100%', overflow: 'visible' }}
        onMouseLeave={() => { setHov(null); setTip(null) }}
      >
        {links.map(([a, b]) => (
          <path key={b.id} d={linkD(a, b)} fill="none" stroke={colorOf(b)} strokeWidth={linkWidth} strokeOpacity={inPath(b) ? (hov ? 0.9 : 0.45) * ipOf(b) : 0.08} strokeLinejoin="round" style={{ transition: 'd .45s cubic-bezier(.2,.8,.2,1), stroke-opacity .2s', d: `path("${linkD(a, b)}")` }} />
        ))}
        {list.map((n) => {
          const [x, y, a] = pos(n)
          const c = colorOf(n)
          const ip = ipOf(n)
          const folded = closed.has(n.id) && n.kids.length
          const on = inPath(n)
          const lab = n.name.length > 14 ? n.name.slice(0, 13) + '…' : n.name
          const flip = radial && Math.cos(a ?? 0) < 0
          return (
            <g
              key={n.id}
              style={{ transform: `translate(${x}px,${y}px) scale(${0.4 + 0.6 * ip})`, transition: glide, cursor: collapsible && n.kids.length ? 'pointer' : 'default' }}
              opacity={(on ? 1 : 0.3) * ip}
              onClick={() => toggle(n)}
              onMouseEnter={(e) => { setHov(n); tooltip && setTip(tipAt(e, wrap, n.name, [{ color: c, label: 'Level', value: String(n.depth + 1) }, { label: n.kids.length ? 'Below it' : 'Leaf', value: n.kids.length ? `${n.size - 1} nodes` : '—' }, ...(n.value != null ? [{ label: 'Value', value: String(n.value), strong: true }] : [])])) }}
              onMouseMove={(e) => tooltip && setTip((t) => (t ? { ...t, ...tipAt(e, wrap, t.title, t.rows) } : t))}
            >
              {card && !radial ? (
                <>
                  <rect x={-cardW / 2} y={-cardH / 2} width={cardW} height={cardH} rx={cardH / 2.6} fill={mix(background, c, 0.16)} stroke={c} strokeOpacity={hov === n ? 1 : 0.6} strokeWidth={hov === n ? 1.8 : 1.2} style={{ filter: hov === n ? `drop-shadow(0 0 ${size * 0.7}px ${c}88)` : 'drop-shadow(0 4px 10px #0006)' }} />
                  <text textAnchor="middle" dy="0.34em" fontSize={Math.min(size * 0.88, (cardW / Math.max(4, lab.length)) * 1.6)} fontWeight="600" fill={textColor} style={{ pointerEvents: 'none' }}>{lab}</text>
                  {folded ? (
                    <g transform={`translate(${cardW / 2 - 2},${-cardH / 2 + 2})`}>
                      <circle r={size * 0.62} fill={c} />
                      <text textAnchor="middle" dy="0.34em" fontSize={size * 0.62} fontWeight="700" fill={inkOn(c)}>{`+${n.size - 1}`}</text>
                    </g>
                  ) : null}
                </>
              ) : (
                <>
                  <circle r={nodeSize * (n.depth === 0 ? 1.4 : 1)} fill={folded ? c : background} stroke={c} strokeWidth="2" style={{ filter: `drop-shadow(0 0 ${size * 0.4}px ${c}88)` }} />
                  <text
                    x={radial ? (flip ? -1 : 1) * (nodeSize + 5) : horiz ? (n.kids.length && !folded ? -(nodeSize + 6) : nodeSize + 6) : 0}
                    y={radial || horiz ? 0 : nodeSize + size}
                    dy={radial || horiz ? '0.34em' : 0}
                    textAnchor={radial ? (flip ? 'end' : 'start') : horiz ? (n.kids.length && !folded ? 'end' : 'start') : 'middle'}
                    transform={radial && n.depth ? `rotate(${(((a ?? 0) * 180) / Math.PI) + (flip ? 180 : 0)})` : undefined}
                    fontSize={size * 0.85}
                    fontWeight={n.kids.length ? 650 : 400}
                    fill={on ? textColor : mutedColor}
                    stroke={background}
                    strokeWidth="3"
                    paintOrder="stroke"
                    style={{ pointerEvents: 'none' }}
                  >
                    {lab}{folded ? ` +${n.size - 1}` : ''}
                  </text>
                </>
              )}
            </g>
          )
        })}
      </svg>
    </Card>
  )
}
