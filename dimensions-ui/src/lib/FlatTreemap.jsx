import { useEffect, useId, useMemo, useRef, useState } from 'react'

// ---- flat infographic helpers (kept inline so this file copies out on its own) ----
// Data is a plain string: rows are separated by commas, each row is "Label:value",
// e.g. "Jan:42, Feb:58". An array of { label, value } works too.

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

// text colour for a label sitting on a filled shape: dark ink on light fills, white otherwise
function inkOn(c, dark) {
  const [r, g, b] = [1, 3, 5].map((i) => (parseInt(String(c).slice(i, i + 2), 16) || 0) / 255)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.62 ? dark : '#ffffff'
}
// compact numbers (1.2k, 3.4M) when asked for, plain otherwise
function makeValueFmt({ valueFormat, decimals, prefix, suffix }) {
  if (valueFormat !== 'compact') return makeFmt({ decimals, prefix, suffix })
  const nf = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: Math.max(1, Math.round(decimals)) })
  return (v) => `${prefix}${nf.format(v)}${suffix}`
}
// "Group/Item:value, ..." -> a tree with summed values
function parseTree(data, rootName = 'All') {
  const root = { name: rootName, children: [], value: 0, depth: 0, path: rootName }
  String(data ?? '')
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((entry) => {
      const k = entry.lastIndexOf(':')
      const parts = (k < 0 ? entry : entry.slice(0, k)).split('/').map((s) => s.trim()).filter(Boolean)
      const v = k < 0 ? 1 : Math.max(0, num(entry.slice(k + 1)))
      let cur = root
      parts.forEach((name, d) => {
        let c = cur.children.find((x) => x.name === name)
        if (!c) {
          c = { name, children: [], value: 0, depth: d + 1, parent: cur, path: `${cur.path}/${name}` }
          cur.children.push(c)
        }
        cur = c
      })
      cur.own = (cur.own ?? 0) + v
    })
  const sum = (n) => (n.value = (n.own ?? 0) + n.children.reduce((a, c) => a + sum(c), 0))
  sum(root)
  const tag = (n, b) => {
    n.branch = b
    n.children.sort((a, c) => c.value - a.value)
    n.children.forEach((c, i) => tag(c, n.depth === 0 ? i : b))
  }
  tag(root, 0)
  return root
}
// squarified layout (Bruls et al.): fill rows while they make tiles squarer
function squarify(items, x, y, w, h) {
  const out = []
  const total = items.reduce((a, n) => a + n.value, 0) || 1
  const area = items.map((n) => ({ n, a: (n.value / total) * w * h }))
  let row = []
  const worst = (r, side) => {
    const s = r.reduce((a, q) => a + q.a, 0)
    const mx = Math.max(...r.map((q) => q.a))
    const mn = Math.min(...r.map((q) => q.a))
    return Math.max((side * side * mx) / (s * s), (s * s) / (side * side * mn))
  }
  const place = (r) => {
    const s = r.reduce((a, q) => a + q.a, 0)
    if (w >= h) {
      const cw = s / h
      let yy = y
      r.forEach((q) => { const ch = q.a / cw; out.push({ n: q.n, x, y: yy, w: cw, h: ch }); yy += ch })
      x += cw
      w -= cw
    } else {
      const rh = s / w
      let xx = x
      r.forEach((q) => { const cw = q.a / rh; out.push({ n: q.n, x: xx, y, w: cw, h: rh }); xx += cw })
      y += rh
      h -= rh
    }
  }
  area.forEach((q) => {
    const side = Math.min(w, h)
    if (!row.length || worst([...row, q], side) <= worst(row, side)) row.push(q)
    else {
      place(row)
      row = [q]
    }
  })
  if (row.length) place(row)
  return out
}
function sliceDice(items, x, y, w, h, horiz) {
  const total = items.reduce((a, n) => a + n.value, 0) || 1
  let o = 0
  return items.map((n) => {
    const f = n.value / total
    const r = horiz ? { n, x: x + o * w, y, w: f * w, h } : { n, x, y: y + o * h, w, h: f * h }
    o += f
    return r
  })
}
const fitText = (s, room, cw) => (s.length * cw <= room ? s : room < cw * 4 ? '' : s.slice(0, Math.max(2, Math.floor(room / cw) - 1)) + '…')

// Flat infographic treemap: chunky rounded tiles in solid flat colours, each group on a
// pale tinted plate with a coloured header chip, smaller items shaded lighter and the
// biggest tile of each group carrying a diagonal stripe band. Tiles pop in group by
// group; click a group to zoom in and the breadcrumb to come back out.
export default function FlatTreemap({
  data = 'Compute/Virtual machines:420, Compute/Containers:260, Compute/Functions:90, Storage/Object storage:310, Storage/Block storage:150, Storage/Backups:70, Database/Postgres:240, Database/Redis:80, Database/Search:60, Network/CDN:130, Network/Load balancers:55, Network/DNS:12, AI/GPU hours:360, AI/Inference API:140',
  rootName = 'All services',
  title = 'Cloud spend by service',
  subtitle = 'USD thousands, last quarter. Click a group to zoom in',
  tile = 'squarify',
  padding = 4,
  groupGap = 8,
  radius = 10,
  showHeaders = true,
  showValues = true,
  showPercent = true,
  shadeByValue = true,
  stripes = true,
  stripeWidth = 5,
  zoomable = true,
  tooltip = true,
  animate = true,
  duration = 1100,
  valueFormat = 'number',
  decimals = 0,
  prefix = '$',
  suffix = 'k',
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
  const [boxRef, boxW] = useWidth()
  const fmt = makeValueFmt({ valueFormat, decimals, prefix, suffix })
  const root = useMemo(() => parseTree(data, rootName), [data, rootName])
  const [focusPath, setFocusPath] = useState(null)
  const focus = useMemo(() => {
    if (!focusPath) return root
    const find = (n) => (n.path === focusPath ? n : n.children.map(find).find(Boolean))
    return find(root) ?? root
  }, [root, focusPath])
  const cols = paletteOf(Math.max(6, root.children.length), [color, color2, color3, color4, color5, color6])
  const p = useReveal(animate, duration, `${data}|${tile}|${focusPath}`)
  const [hov, setHov] = useState(null)
  const [tip, setTip] = useState(null)

  const W = Math.max(260, (boxW || width) - size * 3)
  const crumbH = size * 2.4
  const H = Math.max(160, height)
  const ph = H - crumbH
  const cw = size * 0.6 // rough glyph width for fitting labels

  const layout = (items, x, y, w, h, depth) => (tile === 'slice-dice' ? sliceDice(items, x, y, w, h, depth % 2 === 0) : squarify(items, x, y, w, h))
  const groups = focus.children.length ? focus.children : [focus]
  const outer = layout(groups, 0, crumbH, W, ph, 0)
  const gap = clamp(groupGap, 0, 30)
  const tiles = []
  outer.forEach((g, gi) => {
    const gx = g.x + gap / 2
    const gy = g.y + gap / 2
    const gw = Math.max(0, g.w - gap)
    const gh = Math.max(0, g.h - gap)
    const hdr = showHeaders && g.n.children.length && gh > size * 4 && gw > size * 3 ? size * 2 : 0
    const inset = g.n.children.length ? padding : 0
    const kids = g.n.children.length
      ? layout(g.n.children, gx + inset / 2, gy + hdr + inset / 2, Math.max(0, gw - inset), Math.max(0, gh - hdr - inset), 1)
      : [{ n: g.n, x: gx, y: gy, w: gw, h: gh }]
    const mx = Math.max(...kids.map((k) => k.n.value))
    const mn = Math.min(...kids.map((k) => k.n.value))
    tiles.push({ group: true, n: g.n, x: gx, y: gy, w: gw, h: gh, hdr, gi, single: !g.n.children.length })
    kids.forEach((k, ki) => tiles.push({ ...k, gi, ki, shade: mx === mn ? 0 : 1 - (k.n.value - mn) / (mx - mn) }))
  })
  const baseOf = (gi) => cols[(focus === root ? gi : focus.branch) % cols.length]
  const colorOf = (t) => (shadeByValue ? mix(baseOf(t.gi), background, (t.shade ?? 0) * 0.42) : baseOf(t.gi))
  const crumbs = []
  for (let n = focus; n; n = n.parent) crumbs.unshift(n)
  const move = (e) => tooltip && setTip((tp) => (tp ? { ...tp, ...tipAt(e, wrap, tp.title, tp.rows) } : tp))
  const nG = Math.max(1, outer.length)
  const prog = (t) => clamp((p - (t.gi / nG) * 0.45 - (t.ki ?? 0) * 0.03) / 0.5, 0, 1)

  return (
    <Card wrapRef={(el) => { wrap.current = el; boxRef.current = el }} {...{ width, background, textColor, mutedColor, size, title, subtitle, tip }}>
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${title}. Treemap of ${focus.name}, total ${fmt(focus.value)}: ${groups.map((g) => `${g.name} ${fmt(g.value)}`).join(', ')}.`}
        style={{ display: 'block', overflow: 'visible' }}
        onMouseLeave={() => { setHov(null); setTip(null) }}
      >
        <defs>
          <pattern id={`st${uid}`} width={stripeWidth * 2} height={stripeWidth * 2} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width={stripeWidth} height={stripeWidth * 2} fill="#ffffff" opacity="0.35" />
          </pattern>
        </defs>

        {/* breadcrumb: earlier levels are clickable, the current one is bold; total on the right */}
        <g>
          {(() => {
            let x = 0
            return crumbs.map((c, i) => {
              const last = i === crumbs.length - 1
              const x0 = x
              x += c.name.length * size * 0.56 + size * (last ? 0 : 2.2)
              return (
                <g key={c.path} style={{ cursor: last ? 'default' : 'pointer' }} onClick={() => !last && setFocusPath(c === root ? null : c.path)}>
                  <text x={x0} y={size * 1.05} fontSize={size * 0.9} fontWeight={last ? 700 : 600} fill={last ? textColor : mutedColor}>
                    {c.name}
                  </text>
                  {!last && <path d={`M${x - size * 1.25},${size * 0.4}l${size * 0.35},${size * 0.32}l${-size * 0.35},${size * 0.32}`} fill="none" stroke={mutedColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
                </g>
              )
            })
          })()}
          <text x={W} y={size * 1.05} textAnchor="end" fontSize={size * 1.05} fontWeight="800" fill={textColor} style={{ fontVariantNumeric: 'tabular-nums' }}>
            {fmt(focus.value * ease(p))}
          </text>
        </g>

        {tiles.map((t, k) => {
          const ip = prog(t)
          if (ip <= 0) return null
          const cx = t.x + t.w / 2
          const cy = t.y + t.h / 2
          const sc = pop(ip)
          const canZoom = zoomable && t.n.children.length > 0
          if (t.group) {
            if (t.single) return null
            const base = baseOf(t.gi)
            const dim = hov && hov.gi !== t.gi
            const label = fitText(t.n.name, t.w - size * 1.6, cw * 0.95)
            const val = fmt(t.n.value)
            const showVal = label === t.n.name && (t.n.name.length + val.length + 2) * cw * 0.95 + size * 1.6 < t.w
            const chipW = Math.min(t.w - size * 0.6, (label.length + (showVal ? val.length + 2 : 0)) * cw * 0.95 + size * 1.4)
            return (
              <g key={`g${t.n.path}`} opacity={ease(ip) * (dim ? 0.4 : 1)} style={{ transition: 'opacity .2s', cursor: canZoom ? 'zoom-in' : 'default' }} onClick={() => canZoom && setFocusPath(t.n.path)}>
                <path d={rrect(t.x, t.y, t.w, t.h, [radius + 3, radius + 3, radius + 3, radius + 3])} fill={mix(background, base, 0.1)} />
                {t.hdr > 0 && label && (
                  <g style={{ pointerEvents: 'none' }}>
                    <path d={rrect(t.x + size * 0.3, t.y + size * 0.3, chipW, t.hdr - size * 0.5, [radius, radius, radius, radius])} fill={base} />
                    <text x={t.x + size * 1} y={t.y + size * 0.3 + (t.hdr - size * 0.5) / 2} dy="0.36em" fontSize={size * 0.8} fontWeight="700" letterSpacing="0.04em" fill={inkOn(base, textColor)}>
                      {label.toUpperCase()}
                      {showVal && <tspan fontWeight="800" dx={size * 0.6} style={{ fontVariantNumeric: 'tabular-nums' }}>{val}</tspan>}
                    </text>
                  </g>
                )}
              </g>
            )
          }
          const w = Math.max(0, t.w - padding)
          const h = Math.max(0, t.h - padding)
          const x = t.x + padding / 2
          const y = t.y + padding / 2
          const c = colorOf(t)
          const ink = inkOn(c, textColor)
          const pct = (t.n.value / (focus.value || 1)) * 100
          const rr = Math.min(radius, w / 2.5, h / 2.5)
          const d = rrect(x, y, w, h, [rr, rr, rr, rr])
          const fits = w > size * 3.6 && h > size * 2.2
          const name = fits ? fitText(t.n.name, w - size * 1.2, cw * 0.9) : ''
          const valStr = fmt(t.n.value)
          const valFs = clamp(Math.min(w / (valStr.length * 0.66), h * 0.32), size * 0.9, size * 1.6)
          const showVal = showValues && h > size * 2.2 + valFs * 1.2 && w > valStr.length * valFs * 0.62 + size
          const showPct = showPercent && showVal && h > size * 4.6 + valFs && w > size * 4
          const dim = hov && hov.path !== t.n.path
          const striped = stripes && t.ki === 0 && w > size * 2 && h > size * 2
          return (
            <g
              key={t.n.path}
              transform={`translate(${cx},${cy}) scale(${sc}) translate(${-cx},${-cy})`}
              opacity={Math.min(1, ip * 2) * (dim ? 0.4 : 1)}
              style={{ transition: 'opacity .2s', cursor: canZoom ? 'zoom-in' : 'default' }}
              onClick={() => canZoom && setFocusPath(t.n.path)}
              onMouseEnter={(e) => {
                setHov({ path: t.n.path, gi: t.gi })
                if (tooltip)
                  setTip(tipAt(e, wrap, t.n.name, [
                    { color: c, label: 'Value', value: fmt(t.n.value) },
                    { label: `Of ${focus.name}`, value: `${pct.toFixed(1)}%` },
                    ...(t.n.parent && t.n.parent !== focus ? [{ label: `Of ${t.n.parent.name}`, value: `${((t.n.value / (t.n.parent.value || 1)) * 100).toFixed(1)}%` }] : []),
                  ]))
              }}
              onMouseMove={move}
            >
              <path d={d} fill={c} />
              {striped && (
                <>
                  <clipPath id={`c${uid}${k}`}><path d={d} /></clipPath>
                  <g clipPath={`url(#c${uid}${k})`}>
                    <rect x={x} y={y + h * 0.76} width={w} height={h * 0.24} fill={mix(c, '#000000', 0.12)} />
                    <rect x={x} y={y + h * 0.76} width={w} height={h * 0.24} fill={`url(#st${uid})`} />
                  </g>
                </>
              )}
              {/* hit area covering the whole cell, padding included */}
              <rect x={t.x} y={t.y} width={t.w} height={t.h} fill="transparent" />
              {name && (
                <g style={{ pointerEvents: 'none' }}>
                  <text x={x + size * 0.6} y={y + size * 1.35} fontSize={size * 0.86} fontWeight="600" fill={ink}>
                    {name}
                  </text>
                  {showVal && (
                    <text x={x + size * 0.6} y={y + size * 1.6 + valFs} fontSize={valFs} fontWeight="800" fill={ink} style={{ fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>
                      {fmt(t.n.value * ease(ip))}
                    </text>
                  )}
                  {showPct && (
                    <text x={x + size * 0.6} y={y + size * 2.9 + valFs} fontSize={size * 0.8} fontWeight="600" fill={ink} fillOpacity="0.8" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {`${pct.toFixed(1)}%`}
                    </text>
                  )}
                </g>
              )}
            </g>
          )
        })}
      </svg>
    </Card>
  )
}
