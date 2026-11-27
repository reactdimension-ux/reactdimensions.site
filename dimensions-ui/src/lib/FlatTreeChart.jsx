import { useEffect, useMemo, useRef, useState } from 'react'

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

// dark or white text, whichever reads better on a #rrggbb fill
const inkOn = (c) => {
  const [r, g, b] = [1, 3, 5].map((i) => (parseInt(String(c).slice(i, i + 2), 16) || 0) / 255)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.6 ? '#1d2029' : '#ffffff'
}

// Flat infographic tree / dendrogram: a hierarchy drawn top-down, left-to-right or as a
// radial dendrogram, with solid pill cards (sitting on a darker offset slab) or chunky dots
// and thick rounded links. Each entry is a path like "CEO/CTO/Platform" (add ":n" for a
// value). Nodes pop in level by level; click a node to fold or unfold its branch and the
// rest of the tree glides into place; hover highlights the path to the root.
export default function FlatTreeChart({
  data = 'CEO/CTO/Platform/API, CEO/CTO/Platform/Infra, CEO/CTO/Mobile/iOS, CEO/CTO/Mobile/Android, CEO/CPO/Design, CEO/CPO/Research, CEO/CFO/Finance, CEO/CFO/Legal, CEO/COO/Sales/EMEA, CEO/COO/Sales/Americas, CEO/COO/Support',
  title = 'Company structure',
  subtitle = 'Click a node to fold its branch',
  layout = 'vertical',
  nodeStyle = 'card',
  linkStyle = 'curve',
  colorBy = 'branch',
  collapsible = true,
  startDepth = 0,
  nodeSize = 8,
  linkWidth = 2.5,
  showLegend = true,
  tooltip = true,
  animate = true,
  duration = 1100,
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
  const wrap = useRef(null)
  const [boxRef, boxW] = useWidth()
  const fmt = makeFmt({ decimals, prefix, suffix })
  const W = Math.max(280, (boxW || width) - size * 3)
  const H = Math.max(160, height)

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

  const radial = layout === 'radial'
  const card = nodeStyle === 'card' && !radial
  const horiz = layout === 'horizontal'
  const longest = Math.min(14, Math.max(...list.map((n) => n.name.length)))
  const cardH = size * 2.1
  const cardW = Math.min(longest * size * 0.62 + 24, horiz ? 150 : Math.max(48, (W - 20) / Math.max(1, leaves) - 8))
  const padX = horiz ? (card ? cardW / 2 + 4 : Math.min(14, root.name.length) * size * 0.55 + nodeSize * 1.5 + 12) : card ? cardW / 2 + 2 : 30
  const padY = horiz ? (card ? cardH / 2 + 4 : 12) : card ? cardH / 2 + 4 : size * 1.4
  const R = Math.min(W, H) / 2 - longest * size * 0.5 - 12
  const pos = (n) => {
    const b = leaves > 1 ? n.slot / (leaves - 1) : 0.5
    const d = maxDepth ? n.depth / maxDepth : 0
    if (radial) {
      const a = b * Math.PI * 2 * (leaves > 1 ? (leaves - 1) / leaves : 1) - Math.PI / 2
      return [W / 2 + Math.cos(a) * d * R, H / 2 + Math.sin(a) * d * R, a]
    }
    if (horiz) return [padX + d * (W - 2 * padX - (card ? 0 : longest * size * 0.6)), padY + b * (H - 2 * padY)]
    return [padX + b * (W - 2 * padX), padY + d * (H - 2 * padY - (card ? 6 : size * 1.2))]
  }
  const pal = paletteOf(Math.max(6, root.kids.length), [color, color2, color3, color4, color5, color6])
  const colorOf = (n) => (n.depth === 0 ? textColor : colorBy === 'depth' ? mix(color, color2, maxDepth > 1 ? (n.depth - 1) / (maxDepth - 1) : 0) : pal[n.branch % pal.length])
  const linkD = (a, b) => {
    const [x0, y0] = pos(a)
    const [x1, y1] = pos(b)
    if (linkStyle === 'straight' || radial)
      return radial && linkStyle !== 'straight'
        ? `M${x0},${y0}Q${(x0 + x1) / 2 + (W / 2 - (x0 + x1) / 2) * 0.15},${(y0 + y1) / 2 + (H / 2 - (y0 + y1) / 2) * 0.15} ${x1},${y1}`
        : `M${x0},${y0}L${x1},${y1}`
    if (linkStyle === 'elbow') {
      // rounded elbow corners, for the chunky flat feel
      const r = 8
      if (horiz) {
        const xm = (x0 + x1) / 2
        const s = Math.sign(y1 - y0)
        const rr = Math.min(r, Math.abs(y1 - y0) / 2, Math.abs(xm - x0))
        return s ? `M${x0},${y0}H${xm - rr}Q${xm},${y0} ${xm},${y0 + s * rr}V${y1 - s * rr}Q${xm},${y1} ${xm + rr},${y1}H${x1}` : `M${x0},${y0}H${x1}`
      }
      const ym = (y0 + y1) / 2
      const s = Math.sign(x1 - x0)
      const rr = Math.min(r, Math.abs(x1 - x0) / 2, Math.abs(ym - y0))
      return s ? `M${x0},${y0}V${ym - rr}Q${x0},${ym} ${x0 + s * rr},${ym}H${x1 - s * rr}Q${x1},${ym} ${x1},${ym + rr}V${y1}` : `M${x0},${y0}V${y1}`
    }
    return horiz ? `M${x0},${y0}C${(x0 + x1) / 2},${y0} ${(x0 + x1) / 2},${y1} ${x1},${y1}` : `M${x0},${y0}C${x0},${(y0 + y1) / 2} ${x1},${(y0 + y1) / 2} ${x1},${y1}`
  }
  const toggle = (n) => {
    if (!collapsible || !n.kids.length) return
    setClosed((s) => { const t = new Set(s); t.has(n.id) ? t.delete(n.id) : t.add(n.id); return t })
  }
  const inPath = (n) => {
    if (!hov) return true
    if (hov.branchOnly != null) return n.depth === 0 || n.branch === hov.branchOnly
    let a = hov
    while (a) { if (a === n) return true; a = a.parent }
    let b = n
    while (b) { if (b === hov) return true; b = b.parent }
    return false
  }
  const ipOf = (n) => clamp((p - (maxDepth ? n.depth / maxDepth : 0) * 0.55) / 0.45, 0, 1)
  const glide = 'transform .45s cubic-bezier(.2,.8,.2,1), opacity .25s'
  const legend = showLegend && colorBy === 'branch' && root.kids.length >= 2 ? root.kids : []

  return (
    <Card wrapRef={(el) => { wrap.current = el; boxRef.current = el }} {...{ width, background, textColor, mutedColor, size, title, subtitle, tip }}>
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${title}. Tree with ${root.size} nodes, ${maxDepth + 1} levels deep. ${root.name}: ${root.kids.map((k) => `${k.name} (${k.size - 1} below)`).join(', ')}.`}
        style={{ display: 'block', overflow: 'visible' }}
        onMouseLeave={() => { setHov(null); setTip(null) }}
      >
        {links.map(([a, b]) => {
          const c = colorOf(b)
          const on = inPath(b)
          const d = linkD(a, b)
          return (
            <path
              key={b.id}
              d={d}
              fill="none"
              stroke={hov && on ? c : mix(background, c, 0.55)}
              strokeWidth={linkWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={(on ? 1 : 0.4) * ease(ipOf(b))}
              style={{ transition: 'd .45s cubic-bezier(.2,.8,.2,1), opacity .2s, stroke .2s', d: `path("${d}")` }}
            />
          )
        })}
        {list.map((n) => {
          const [x, y, a] = pos(n)
          const c = colorOf(n)
          const k = ipOf(n)
          const folded = closed.has(n.id) && n.kids.length
          const on = inPath(n)
          const lab = n.name.length > 14 ? n.name.slice(0, 13) + '…' : n.name
          const flip = radial && Math.cos(a ?? 0) < 0
          const r = nodeSize * (n.depth === 0 ? 1.5 : 1)
          return (
            <g
              key={n.id}
              style={{ transform: `translate(${x}px,${y}px)`, transition: glide, cursor: collapsible && n.kids.length ? 'pointer' : 'default' }}
              opacity={(on ? 1 : 0.4) * Math.min(1, k * 3)}
              onClick={() => toggle(n)}
              onMouseEnter={(e) => {
                setHov(n)
                if (tooltip)
                  setTip(tipAt(e, wrap, n.name, [
                    { color: c, label: 'Level', value: String(n.depth + 1) },
                    { label: n.kids.length ? 'Below it' : 'Leaf', value: n.kids.length ? `${n.size - 1} nodes` : '—' },
                    ...(n.value != null ? [{ label: 'Value', value: fmt(n.value) }] : []),
                  ]))
              }}
              onMouseMove={(e) => tooltip && setTip((t) => (t ? { ...t, ...tipAt(e, wrap, t.title, t.rows) } : t))}
            >
              <g transform={`scale(${0.2 + 0.8 * pop(k)})`}>
              {card ? (
                <>
                  <path d={rrect(-cardW / 2, -cardH / 2 + 3, cardW, cardH, [cardH / 2, cardH / 2, cardH / 2, cardH / 2])} fill={mix(c, '#000000', 0.22)} />
                  <path d={rrect(-cardW / 2, -cardH / 2, cardW, cardH, [cardH / 2, cardH / 2, cardH / 2, cardH / 2])} fill={c} />
                  <text textAnchor="middle" dy="0.35em" fontSize={Math.min(size * 0.9, ((cardW - 8) / Math.max(4, lab.length)) * 1.75)} fontWeight="700" fill={inkOn(c)} style={{ pointerEvents: 'none' }}>
                    {lab}
                  </text>
                  {folded ? (
                    <g transform={`translate(${cardW / 2 - 3},${-cardH / 2 + 1})`} style={{ pointerEvents: 'none' }}>
                      <circle r={size * 0.72} fill={background} stroke={c} strokeWidth="2" />
                      <text textAnchor="middle" dy="0.35em" fontSize={size * 0.66} fontWeight="800" fill={textColor}>{`+${n.size - 1}`}</text>
                    </g>
                  ) : null}
                  {/* hit area a touch bigger than the card */}
                  <rect x={-cardW / 2 - 3} y={-cardH / 2 - 3} width={cardW + 6} height={cardH + 9} fill="transparent" />
                </>
              ) : (
                <>
                  {folded ? <circle r={r + 4.5} fill="none" stroke={c} strokeWidth="2.2" /> : null}
                  <circle r={r + 2.5} fill={background} />
                  <circle r={r} fill={c} />
                  <circle r={Math.max(r + 6, 10)} fill="transparent" />
                  <text
                    x={radial ? (flip ? -1 : 1) * (r + 7) : horiz ? (n.kids.length && !folded ? -(r + 8) : r + 8) : 0}
                    y={radial || horiz ? 0 : r + size + 3}
                    dy={radial || horiz ? '0.35em' : 0}
                    textAnchor={radial ? (flip ? 'end' : 'start') : horiz ? (n.kids.length && !folded ? 'end' : 'start') : 'middle'}
                    transform={radial && n.depth ? `rotate(${((a ?? 0) * 180) / Math.PI + (flip ? 180 : 0)})` : undefined}
                    fontSize={size * 0.88}
                    fontWeight={n.kids.length ? 700 : 600}
                    fill={textColor}
                    stroke={background}
                    strokeWidth="4"
                    strokeLinejoin="round"
                    paintOrder="stroke"
                    style={{ pointerEvents: 'none' }}
                  >
                    {lab}
                    {folded ? <tspan fill={mutedColor} fontWeight="800">{` +${n.size - 1}`}</tspan> : null}
                  </text>
                </>
              )}
              </g>
            </g>
          )
        })}
      </svg>

      {legend.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.5em 1.3em', marginTop: '1em' }} onMouseLeave={() => setHov(null)}>
          {legend.map((b, i) => (
            <div
              key={b.id}
              onMouseEnter={() => setHov({ branchOnly: i })}
              style={{ display: 'flex', alignItems: 'center', gap: '0.45em', fontSize: '0.9em', opacity: hov?.branchOnly != null && hov.branchOnly !== i ? 0.4 : 1, transition: 'opacity .2s', cursor: 'default' }}
            >
              <i style={{ width: '0.85em', height: '0.85em', borderRadius: '50%', background: pal[i % pal.length], flex: 'none' }} />
              <span style={{ color: mutedColor, fontWeight: 600 }}>{b.name}</span>
              <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{b.size}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
