import { useEffect, useRef, useState } from 'react'

// A metro / transit app on a phone, as a click-through prototype. Pages: Map
// (a schematic SVG metro map with four coloured lines and 18 stations; tap a
// line, on the map or in the chips, to highlight it and dim the rest and see
// the next arrivals count down every second; trains slide along every line),
// Station (live departures, tap a row to set a reminder, save the station,
// directions from / to here), Trip planner (pick From and To from a searchable
// list, swap them, choose Fastest or Fewest changes; the route is a real
// shortest-path search over the line graph with a transfer penalty), Route
// (the steps with stop lists, a map with the route highlighted, "Start trip"
// moves a rider dot along it, save the route) and Saved (routes and stations).
// Arrival times come from a fixed timetable phase per line, direction and
// station, so every screen agrees. Train motion is decorative and stops under
// prefers-reduced-motion. The phone scales to fit whatever box it is in.

const W = 390
const H = 844
const INK = '#0f172a'
const MUTED = '#64748b'
const BG = '#f1f4f8'
const HOP = 2 // minutes between neighbouring stops
const XFER = 4 // minutes to change lines

const LINES = {
  red: { name: 'Red Line', color: '#e5484d', head: 240, status: 'Good service', v: [['northgate', 195, 60], ['oldtown', 195, 135], ['central', 195, 220], ['market', 195, 300], ['riverside', 195, 385], ['harbor', 195, 470]] },
  blue: { name: 'Blue Line', color: '#2f6fe4', head: 300, status: 'Good service', v: [['westfield', 35, 220], ['university', 110, 220], ['central', 195, 220], ['stadium', 275, 220], ['airport', 345, 150]] },
  green: { name: 'Green Line', color: '#1fa971', head: 360, status: 'Minor delays', v: [['lakeside', 60, 435], ['gallery', 110, 385], ['market', 195, 300], ['docklands', 275, 300], ['seaport', 335, 360], ['pier', 335, 440]] },
  yellow: { name: 'Yellow Line', color: '#f5b400', head: 270, status: 'Good service', v: [['brewery', 275, 90], ['stadium', 275, 220], ['docklands', 275, 300], ['cove', 275, 390], ['beacon', 275, 470]] },
}
const LINE_IDS = Object.keys(LINES)

const STN = {
  northgate: ['Northgate', 10, 4, 'start'],
  oldtown: ['Old Town', 10, 4, 'start'],
  central: ['Central', -11, -9, 'end'],
  market: ['Market Square', -11, -9, 'end'],
  riverside: ['Riverside', 10, 4, 'start'],
  harbor: ['Harbor', 10, 4, 'start'],
  westfield: ['Westfield', -8, -12, 'start'],
  university: ['University', 0, -12, 'middle'],
  stadium: ['Stadium', 11, 15, 'start'],
  airport: ['Airport', -10, 4, 'end'],
  lakeside: ['Lakeside', -4, 17, 'start'],
  gallery: ['Gallery District', -10, 4, 'end'],
  docklands: ['Docklands', 10, -8, 'start'],
  seaport: ['Seaport', 10, 4, 'start'],
  pier: ['Pier 9', 10, 4, 'start'],
  brewery: ['Brewery Row', 10, 4, 'start'],
  cove: ['Cove', 10, 4, 'start'],
  beacon: ['Beacon', 10, 4, 'start'],
}
const POS = {}
LINE_IDS.forEach((l) => LINES[l].v.forEach(([id, x, y]) => (POS[id] = { x, y })))
const linesAt = (id) => LINE_IDS.filter((l) => LINES[l].v.some((v) => v[0] === id))
const nm = (id) => STN[id][0]
const ALL = Object.keys(STN).sort((a, b) => nm(a).localeCompare(nm(b)))

const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const mod = (a, n) => ((a % n) + n) % n
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
const clock = (ms) => new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

// ---------------------------------------------------------------- geometry

function measure(pts) {
  const cum = [0]
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y))
  return { pts, cum, total: cum[cum.length - 1] }
}
function pointAt(m, s) {
  const d = clamp(s, 0, m.total)
  let i = 1
  while (i < m.cum.length - 1 && m.cum[i] < d) i++
  const a = m.pts[i - 1]
  const b = m.pts[i]
  const t = (d - m.cum[i - 1]) / (m.cum[i] - m.cum[i - 1] || 1)
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, ang: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI }
}
const GEO = {}
LINE_IDS.forEach((l) => {
  const m = measure(LINES[l].v.map(([, x, y]) => ({ x, y })))
  GEO[l] = { m, at: Object.fromEntries(LINES[l].v.map(([id], i) => [id, m.cum[i]])) }
})
// the points along a line between two of its stations
function legPath(l, a, b) {
  const g = GEO[l]
  const from = g.at[a]
  const to = g.at[b]
  const lo = Math.min(from, to)
  const hi = Math.max(from, to)
  const pts = [pointAt(g.m, lo)]
  g.m.cum.forEach((c, i) => {
    if (c > lo + 0.01 && c < hi - 0.01) pts.push(g.m.pts[i])
  })
  pts.push(pointAt(g.m, hi))
  return from <= to ? pts : pts.reverse()
}
const toD = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('')

// ---------------------------------------------------------------- timetable

const phaseOf = (l) => (l.charCodeAt(0) * 37) % LINES[l].head

// seconds until the next train of line l, direction d (0 towards the last stop,
// 1 towards the first), calls at station st, or null when it terminates there
function wait(l, d, st, nowS) {
  const v = LINES[l].v
  const i = v.findIndex((x) => x[0] === st)
  const n = v.length - 1
  if ((d === 0 && i === n) || (d === 1 && i === 0)) return null
  const tau = (d === 0 ? i : n - i) * HOP * 60
  return mod(phaseOf(l) + d * (LINES[l].head / 2) + tau - nowS, LINES[l].head)
}
const toward = (l, d) => nm(LINES[l].v[d === 0 ? LINES[l].v.length - 1 : 0][0])

// ---------------------------------------------------------------- planner

function plan(from, to, mode) {
  if (!from || !to || from === to) return null
  const xf = mode === 'fast' ? XFER : 16
  const key = (s, l) => `${s}|${l}`
  const adj = {}
  const add = (a, b, w) => (adj[a] = adj[a] || []).push([b, w])
  LINE_IDS.forEach((l) => {
    const v = LINES[l].v
    v.forEach(([s], i) => {
      if (i) {
        add(key(s, l), key(v[i - 1][0], l), HOP)
        add(key(v[i - 1][0], l), key(s, l), HOP)
      }
      linesAt(s).forEach((o) => o !== l && add(key(s, l), key(s, o), xf))
    })
  })
  const dist = {}
  const prev = {}
  const todo = new Set(Object.keys(adj))
  linesAt(from).forEach((l) => (dist[key(from, l)] = 0))
  while (todo.size) {
    let u = null
    todo.forEach((k) => {
      if (dist[k] !== undefined && (u === null || dist[k] < dist[u])) u = k
    })
    if (u === null) break
    todo.delete(u)
    ;(adj[u] || []).forEach(([k, w]) => {
      if (dist[u] + w < (dist[k] ?? Infinity)) (dist[k] = dist[u] + w), (prev[k] = u)
    })
  }
  let end = null
  linesAt(to).forEach((l) => {
    const k = key(to, l)
    if (dist[k] !== undefined && (end === null || dist[k] < dist[end])) end = k
  })
  if (!end) return null
  const path = []
  for (let k = end; k; k = prev[k]) path.unshift(k.split('|'))
  const legs = []
  path.forEach(([s, l]) => {
    const last = legs[legs.length - 1]
    if (last && last.line === l) last.stops.push(s)
    else legs.push({ line: l, stops: [s] })
  })
  const real = legs.filter((g) => g.stops.length > 1)
  real.forEach((g) => {
    const v = LINES[g.line].v.map((x) => x[0])
    g.dir = v.indexOf(g.stops[g.stops.length - 1]) > v.indexOf(g.stops[0]) ? 0 : 1
    g.mins = (g.stops.length - 1) * HOP
  })
  const hops = real.reduce((a, g) => a + g.stops.length - 1, 0)
  const transfers = real.length - 1
  return { legs: real, hops, transfers, mins: hops * HOP + transfers * XFER, fare: +(1.8 + 0.2 * hops).toFixed(2), from, to }
}

// ---------------------------------------------------------------- icons

const ICONS = {
  map: 'M9 4L3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14',
  route: 'M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM8 17h6a3 3 0 0 0 0-6h-4a3 3 0 0 1 0-6h6',
  mark: 'M7 4h10a1 1 0 0 1 1 1v15l-6-4-6 4V5a1 1 0 0 1 1-1z',
  back: 'M15 5l-7 7 7 7',
  chev: 'M9 5l7 7-7 7',
  swap: 'M7 4v14m0 0l-3-3m3 3l3-3M17 20V6m0 0l-3 3m3-3l3 3',
  star: 'M12 3l2.700 5.600 6.100.9-4.400 4.300 1 6.100L12 17l-5.400 2.900 1-6.100L3.200 9.500l6.100-.9z',
  x: 'M6 6l12 12M18 6L6 18',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  bell: 'M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4',
  walk: 'M13 4.500a1.500 1.500 0 1 0 0 .01zM10 21l2-6-2-3 1-5 3 3 3 1M10 12l-3 2',
  check: 'M5 12l5 5 9-10',
  share: 'M12 15V4m0 0L8 8m4-4l4 4M5 13v6h14v-6',
  play: 'M7 4l13 8-13 8z',
  stop: 'M6 6h12v12H6z',
  down: 'M6 9l6 6 6-6',
}

function Icon({ name, size = 22, color = 'currentColor', w = 1.9, fill = 'none' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  )
}

const iconBtn = { display: 'grid', placeItems: 'center', border: 'none', borderRadius: '50%', cursor: 'pointer', padding: 0, background: '#fff', color: INK }

function useReduced() {
  const [r, setR] = useState(false)
  useEffect(() => {
    if (!window.matchMedia) return undefined
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const f = () => setR(mq.matches)
    f()
    mq.addEventListener?.('change', f)
    return () => mq.removeEventListener?.('change', f)
  }, [])
  return r
}

function useRaf(on, cb) {
  const ref = useRef(cb)
  ref.current = cb
  useEffect(() => {
    if (!on) return undefined
    let id
    let last = performance.now()
    const loop = (t) => {
      const dt = Math.min(100, t - last)
      last = t
      ref.current(dt)
      id = requestAnimationFrame(loop)
    }
    id = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(id)
  }, [on])
}

// ---------------------------------------------------------------- map

function Trains({ reduced, dim }) {
  const [t, setT] = useState(0)
  useRaf(!reduced, (dt) => setT((v) => v + dt / 1000))
  return (
    <g>
      {LINE_IDS.flatMap((l) =>
        [0, 1].flatMap((d) =>
          [0, 1].map((k) => {
            const len = GEO[l].m.total
            const f = mod(t * 14 + (k / 2) * len + d * len * 0.27, len)
            const p = pointAt(GEO[l].m, d === 0 ? f : len - f)
            return (
              <g key={`${l}${d}${k}`} transform={`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${(p.ang + (d === 0 ? 0 : 180)).toFixed(1)})`} opacity={dim && dim !== l ? 0.15 : 1}>
                <rect x={-8} y={-4} width={16} height={8} rx={4} fill={LINES[l].color} stroke="#fff" strokeWidth={1.600} />
                <rect x={3} y={-2.500} width={3} height={5} rx={1} fill="#fff" opacity={0.85} />
              </g>
            )
          }),
        ),
      )}
    </g>
  )
}

function MapSvg({ selLine, route, vb = '0 40 390 470', onStation, onLine, focus, rider, reduced, labels = true, trains = true }) {
  const routeStops = route ? new Set(route.legs.flatMap((g) => g.stops)) : null
  const active = selLine ? new Set(LINES[selLine].v.map((v) => v[0])) : routeStops
  const lineOp = (l) => (selLine ? (l === selLine ? 1 : 0.16) : route ? 0.2 : 1)
  return (
    <svg viewBox={vb} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Metro map" style={{ display: 'block' }}>
      <rect x={-200} y={-200} width={900} height={1200} fill="#e9eff5" />
      <path d="M-20 392 C40 340 80 370 92 430 S 50 530 -20 545Z" fill="#cfe3f3" />
      <path d="M300 520 C320 470 395 450 420 380 L430 520Z" fill="#cfe3f3" />
      <rect x={225} y={80} width={34} height={90} rx={12} fill="#d6ebd8" />
      <rect x={110} y={250} width={64} height={30} rx={12} fill="#d6ebd8" />
      {LINE_IDS.map((l) => (
        <g key={l} opacity={lineOp(l)} style={{ transition: reduced ? 'none' : 'opacity .3s' }}>
          <path d={toD(GEO[l].m.pts)} fill="none" stroke="#fff" strokeWidth={11} strokeLinecap="round" strokeLinejoin="round" />
          <path d={toD(GEO[l].m.pts)} fill="none" stroke={LINES[l].color} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" />
        </g>
      ))}
      {route && route.legs.map((g, i) => (
        <path key={i} d={toD(legPath(g.line, g.stops[0], g.stops[g.stops.length - 1]))} fill="none" stroke={LINES[g.line].color} strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 3px rgba(15,23,42,.35))' }} />
      ))}
      {onLine && LINE_IDS.map((l) => <path key={`h${l}`} d={toD(GEO[l].m.pts)} fill="none" stroke="transparent" strokeWidth={22} strokeLinecap="round" strokeLinejoin="round" style={{ cursor: 'pointer' }} onClick={() => onLine(l)} />)}
      {trains && <Trains reduced={reduced} dim={selLine} />}
      {Object.keys(STN).map((id) => {
        const p = POS[id]
        const n = linesAt(id).length
        const on = !active || active.has(id)
        const [label, dx, dy, anchor] = STN[id]
        return (
          <g key={id} opacity={on ? 1 : 0.28} onClick={onStation ? () => onStation(id) : undefined} style={{ cursor: onStation ? 'pointer' : 'default' }} role={onStation ? 'button' : undefined} aria-label={onStation ? `${label} station` : undefined}>
            {onStation && <circle cx={p.x} cy={p.y} r={16} fill="transparent" />}
            {n > 1 ? <circle cx={p.x} cy={p.y} r={8.500} fill="#fff" stroke={INK} strokeWidth={3} /> : <circle cx={p.x} cy={p.y} r={5.500} fill="#fff" stroke={INK} strokeWidth={2.500} />}
            {focus === id && (
              <circle cx={p.x} cy={p.y} r={14} fill="none" stroke={INK} strokeWidth={2}>
                {!reduced && <animate attributeName="r" values="11;18;11" dur="1.800s" repeatCount="indefinite" />}
              </circle>
            )}
            {labels && <text x={p.x + dx} y={p.y + dy} textAnchor={anchor} fontSize={10} fontWeight={700} fill={INK} stroke="#e9eff5" strokeWidth={3} paintOrder="stroke">{label}</text>}
          </g>
        )
      })}
      {rider && (
        <g>
          <circle cx={rider.x} cy={rider.y} r={14} fill="#3b82f6" opacity={0.25} />
          <circle cx={rider.x} cy={rider.y} r={7} fill="#3b82f6" stroke="#fff" strokeWidth={3} />
        </g>
      )}
    </svg>
  )
}

function Badge({ l, size = 22 }) {
  return <span style={{ width: size, height: size, borderRadius: size / 2.4, display: 'inline-grid', placeItems: 'center', background: LINES[l].color, color: l === 'yellow' ? INK : '#fff', fontSize: size * 0.5, fontWeight: 800, flex: 'none' }}>{LINES[l].name[0]}</span>
}

function StatusBar({ frame }) {
  const t = new Date().toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' })
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 40, height: 54, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 30px 0 36px', fontSize: 16, fontWeight: 600, color: INK, pointerEvents: 'none' }}>
      <span>{t}</span>
      {frame && <span style={{ position: 'absolute', left: '50%', top: 11, width: 122, height: 35, marginLeft: -61, borderRadius: 20, background: '#000' }} />}
      <span style={{ display: 'flex', gap: 6, alignItems: 'center' }} aria-hidden="true">
        <svg width="18" height="11" viewBox="0 0 18 11" fill={INK}>
          <rect x="0" y="7" width="3" height="4" rx="1" />
          <rect x="5" y="5" width="3" height="6" rx="1" />
          <rect x="10" y="2.5" width="3" height="8.5" rx="1" />
          <rect x="15" y="0" width="3" height="11" rx="1" />
        </svg>
        <svg width="26" height="12" viewBox="0 0 26 12">
          <rect x="0.5" y="0.5" width="22" height="11" rx="3.5" fill="none" stroke={INK} opacity=".45" />
          <rect x="2.5" y="2.5" width="16" height="7" rx="2" fill={INK} />
          <rect x="23.5" y="4" width="2" height="4" rx="1" fill={INK} opacity=".45" />
        </svg>
      </span>
    </div>
  )
}

// ---------------------------------------------------------------- route screen

function RouteScreen({ trip, nowMs, accent, say, reduced, saved, onSave, onBack }) {
  const { from, to, mode } = trip
  const r = plan(from, to, mode)
  const [open, setOpen] = useState({})
  const [track, setTrack] = useState(false)
  const [p, setP] = useState(0)
  const DUR = 26 // seconds for the whole simulated trip

  useRaf(track, (dt) => {
    setP((v) => {
      const n = v + dt / 1000 / DUR
      return n >= 1 ? 1 : n
    })
  })
  useEffect(() => {
    if (track && p >= 1) {
      setTrack(false)
      say('You have arrived')
    }
  }, [p, track])

  if (!r) return <div style={{ padding: '110px 24px', textAlign: 'center', color: MUTED }}>No route between these stations.</div>

  const first = r.legs[0]
  const w0 = wait(first.line, first.dir, first.stops[0], nowMs / 1000)
  const depart = nowMs + w0 * 1000
  const arrive = depart + r.mins * 60000
  // tracker geometry: concatenate the legs
  const pieces = r.legs.map((g) => measure(legPath(g.line, g.stops[0], g.stops[g.stops.length - 1])))
  const total = pieces.reduce((a, m) => a + m.total, 0)
  let rider = null
  let legNow = 0
  if (p > 0) {
    let d = p * total
    for (let i = 0; i < pieces.length; i++) {
      if (d <= pieces[i].total || i === pieces.length - 1) {
        rider = pointAt(pieces[i], d)
        legNow = i
        break
      }
      d -= pieces[i].total
    }
  }
  const isSaved = saved.some((s) => s.from === from && s.to === to && s.mode === mode)
  const leftMin = Math.max(0, Math.round(r.mins * (1 - p)))

  return (
    <div className="tr-scroll" style={{ height: '100%', overflowY: 'auto', paddingTop: 54, paddingBottom: 30 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px 6px' }}>
        <button type="button" onClick={onBack} aria-label="Back" style={{ ...iconBtn, width: 38, height: 38 }}><Icon name="back" size={20} /></button>
        <h1 style={{ margin: 0, flex: 1, fontSize: 18, fontWeight: 800, marginLeft: 4 }}>{nm(from)} to {nm(to)}</h1>
        <button type="button" onClick={onSave} aria-pressed={isSaved} aria-label="Save route" style={{ ...iconBtn, width: 38, height: 38 }}><Icon name="mark" size={19} color={isSaved ? accent : INK} fill={isSaved ? accent : 'none'} /></button>
      </div>
      <div style={{ margin: '6px 16px 0', borderRadius: 24, background: INK, color: '#fff', padding: '16px 18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-0.03em' }}>{track ? leftMin : r.mins} <span style={{ fontSize: 15, fontWeight: 600, opacity: 0.8 }}>min{track ? ' left' : ''}</span></div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>${r.fare.toFixed(2)}</div>
        </div>
        <div style={{ fontSize: 13, opacity: 0.8, marginTop: 2 }}>
          Leave {w0 < 20 ? 'now' : `at ${clock(depart)}`} · arrive {clock(arrive)} · {r.transfers ? `${r.transfers} change${r.transfers > 1 ? 's' : ''}` : 'Direct'} · {r.hops} stops
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 12, alignItems: 'center' }}>
          {r.legs.map((g, i) => <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{i > 0 && <Icon name="chev" size={14} color="#94a3b8" />}<Badge l={g.line} size={26} /></span>)}
        </div>
      </div>
      <div style={{ margin: '12px 16px 0', height: 230, borderRadius: 22, overflow: 'hidden', background: '#e9eff5', border: '1px solid #dbe3ec' }}>
        <MapSvg route={r} rider={rider} reduced={reduced} trains={false} vb="10 40 370 450" labels />
      </div>
      <div style={{ padding: '12px 16px 0' }}>
        <button type="button" onClick={() => (track ? setTrack(false) : (p >= 1 && setP(0), setTrack(true), say('Trip started. Follow the blue dot')))} style={{ width: '100%', height: 50, borderRadius: 25, border: 'none', background: track ? '#fee2e2' : accent, color: track ? '#b91c1c' : '#fff', font: 'inherit', fontSize: 15, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Icon name={track ? 'stop' : 'play'} size={16} fill="currentColor" w={1} />{track ? 'Stop trip' : p >= 1 ? 'Restart trip' : 'Start trip'}
        </button>
      </div>
      <div style={{ margin: '14px 16px 0', background: '#fff', borderRadius: 22, padding: '8px 16px 14px' }}>
        {r.legs.map((g, i) => {
          const c = LINES[g.line].color
          const mids = g.stops.slice(1, -1)
          const now = track && legNow === i
          return (
            <div key={i}>
              {i > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0 10px 2px', color: MUTED, fontSize: 13 }}>
                  <span style={{ width: 28, display: 'grid', placeItems: 'center' }}><Icon name="walk" size={18} /></span>Change at {nm(g.stops[0])} · {XFER} min
                </div>
              )}
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ width: 28, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ width: 14, height: 14, borderRadius: '50%', border: `4px solid ${c}`, background: '#fff', marginTop: 6 }} />
                  <span style={{ flex: 1, width: 6, background: c, margin: '2px 0', borderRadius: 3, opacity: now ? 1 : 0.85 }} />
                  <span style={{ width: 14, height: 14, borderRadius: '50%', border: `4px solid ${c}`, background: '#fff', marginBottom: 6 }} />
                </div>
                <div style={{ flex: 1, minWidth: 0, padding: '2px 0' }}>
                  <div style={{ fontSize: 15, fontWeight: 800 }}>{nm(g.stops[0])}</div>
                  <button type="button" onClick={() => setOpen((o) => ({ ...o, [i]: !o[i] }))} aria-expanded={!!open[i]} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', margin: '8px 0', padding: '9px 10px', border: 'none', borderRadius: 12, background: `${c}1f`, color: INK, font: 'inherit', fontSize: 13, fontWeight: 700, textAlign: 'left', cursor: 'pointer' }}>
                    <Badge l={g.line} size={20} />
                    <span style={{ flex: 1 }}>{LINES[g.line].name} to {toward(g.line, g.dir)}<span style={{ display: 'block', fontWeight: 500, color: MUTED, fontSize: 12 }}>{g.stops.length - 1} stop{g.stops.length > 2 ? 's' : ''} · {g.mins} min{now ? ' · you are here' : ''}</span></span>
                    <span style={{ transform: open[i] ? 'rotate(180deg)' : 'none', transition: 'transform .2s', display: 'flex' }}><Icon name="down" size={16} /></span>
                  </button>
                  {open[i] && mids.map((s) => <div key={s} style={{ fontSize: 13, color: MUTED, padding: '3px 0 3px 4px' }}>· {nm(s)}</div>)}
                  <div style={{ fontSize: 15, fontWeight: 800, paddingTop: 2 }}>{nm(g.stops[g.stops.length - 1])}</div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
      <div style={{ padding: '14px 16px 0', display: 'flex', gap: 10 }}>
        <button type="button" onClick={() => say('Trip shared')} style={{ flex: 1, height: 46, borderRadius: 23, border: 'none', background: '#e2e8f0', color: INK, font: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><Icon name="share" size={17} /> Share</button>
        <button type="button" onClick={() => say(`Alert set for ${clock(depart - 300000)}`)} style={{ flex: 1, height: 46, borderRadius: 23, border: 'none', background: '#e2e8f0', color: INK, font: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><Icon name="bell" size={17} /> Remind me</button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- app

const NAV = [
  ['map', 'map', 'Map'],
  ['planner', 'route', 'Plan'],
  ['saved', 'mark', 'Saved'],
]

const TRIP0 = { from: 'westfield', to: 'harbor', mode: 'fast' }
const initStack = (s) => (s === 'route' ? [{ id: 'route', ...TRIP0 }] : s === 'station' ? [{ id: 'station', st: 'central' }] : [])

export default function TransitApp({ name = 'Metro', accent = '#0f172a', startScreen = 'map', frame = true, style }) {
  const box = useRef()
  const toastTimer = useRef()
  const reduced = useReduced()
  const [scale, setScale] = useState(1)
  const [tab, setTab] = useState(['planner', 'saved'].includes(startScreen) ? startScreen : 'map')
  const [stack, setStack] = useState(() => initStack(startScreen))
  const [dir, setDir] = useState(1)
  const [toast, setToast] = useState('')
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [selLine, setSelLine] = useState(null)
  const [lineIx, setLineIx] = useState({})
  const [from, setFrom] = useState(TRIP0.from)
  const [to, setTo] = useState(TRIP0.to)
  const [mode, setMode] = useState('fast')
  const [picker, setPicker] = useState(null) // 'from' | 'to' | 'open'
  const [q, setQ] = useState('')
  const [savedRoutes, setSavedRoutes] = useState([{ from: 'lakeside', to: 'airport', mode: 'fast' }])
  const [savedSt, setSavedSt] = useState({ central: true })
  const [alerts, setAlerts] = useState({})

  useEffect(() => {
    setTab(['planner', 'saved'].includes(startScreen) ? startScreen : 'map')
    setStack(initStack(startScreen))
  }, [startScreen])

  useEffect(() => {
    const ro = new ResizeObserver(([e]) => {
      const fw = frame ? W + 28 : W
      const fh = frame ? H + 28 : H
      setScale(Math.min(1.2, (e.contentRect.width - 24) / fw, (e.contentRect.height - 24) / fh))
    })
    ro.observe(box.current)
    return () => ro.disconnect()
  }, [frame])

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const say = (t) => {
    setToast(t)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 1900)
  }
  useEffect(() => () => clearTimeout(toastTimer.current), [])

  const top = stack[stack.length - 1]
  const push = (s) => (setDir(1), setStack((a) => [...a, s]))
  const pop = () => (setDir(-1), setStack((a) => a.slice(0, -1)))
  const go = (t) => (setDir(NAV.findIndex((n) => n[0] === t) > NAV.findIndex((n) => n[0] === tab) ? 1 : -1), setTab(t), setStack([]))
  const nowS = nowMs / 1000
  const tabbed = !top

  const toggleRoute = (t) =>
    setSavedRoutes((a) => {
      const has = a.some((s) => s.from === t.from && s.to === t.to && s.mode === t.mode)
      say(has ? 'Route removed from Saved' : 'Route saved')
      return has ? a.filter((s) => !(s.from === t.from && s.to === t.to && s.mode === t.mode)) : [{ from: t.from, to: t.to, mode: t.mode }, ...a]
    })

  const header = (title, back, right) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px 6px', minHeight: 48 }}>
      {back && <button type="button" onClick={back} aria-label="Back" style={{ ...iconBtn, width: 38, height: 38 }}><Icon name="back" size={20} /></button>}
      <h1 style={{ margin: 0, flex: 1, fontSize: back ? 18 : 28, fontWeight: 800, letterSpacing: '-0.02em', marginLeft: 4 }}>{title}</h1>
      {right}
    </div>
  )

  const arrivalChips = (l, d, st, n = 3) =>
    [0, 1, 2].slice(0, n).map((k) => {
      const w = wait(l, d, st, nowS)
      if (w === null) return null
      const s = w + k * LINES[l].head
      return <span key={k} style={{ padding: '6px 10px', borderRadius: 12, background: k === 0 ? LINES[l].color : '#e8edf3', color: k === 0 ? (l === 'yellow' ? INK : '#fff') : INK, fontSize: 13.500, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{s < 15 && k === 0 ? 'Arriving' : mmss(s)}</span>
    })

  let body
  if (top?.id === 'route') {
    body = (
      <RouteScreen
        key={`${top.from}${top.to}${top.mode}`}
        trip={top}
        nowMs={nowMs}
        accent={accent}
        say={say}
        reduced={reduced}
        saved={savedRoutes}
        onSave={() => toggleRoute(top)}
        onBack={pop}
      />
    )
  } else if (top?.id === 'station') {
    const id = top.st
    const ls = linesAt(id)
    const rows = ls
      .flatMap((l) => [0, 1].map((d) => ({ l, d, w: wait(l, d, id, nowS) })))
      .filter((r) => r.w !== null)
      .sort((a, b) => a.w - b.w)
    body = (
      <div className="tr-scroll" style={{ height: '100%', overflowY: 'auto', paddingTop: 54, paddingBottom: 30 }}>
        {header(nm(id), pop, <button type="button" onClick={() => (setSavedSt((s) => ({ ...s, [id]: !s[id] })), say(savedSt[id] ? 'Station removed from Saved' : `${nm(id)} saved`))} aria-pressed={!!savedSt[id]} aria-label="Save station" style={{ ...iconBtn, width: 38, height: 38 }}><Icon name="star" size={19} color={savedSt[id] ? '#f59e0b' : INK} fill={savedSt[id] ? '#f59e0b' : 'none'} /></button>)}
        <div style={{ display: 'flex', gap: 8, padding: '0 20px 10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {ls.map((l) => <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px 4px 4px', borderRadius: 14, background: '#fff', fontSize: 12.500, fontWeight: 700 }}><Badge l={l} size={20} />{LINES[l].name}</span>)}
        </div>
        <div style={{ margin: '0 16px', height: 160, borderRadius: 22, overflow: 'hidden', border: '1px solid #dbe3ec' }}>
          <MapSvg vb={`${POS[id].x - 135} ${POS[id].y - 65} 270 130`} focus={id} reduced={reduced} labels trains={false} />
        </div>
        <div style={{ display: 'flex', gap: 10, padding: '12px 16px 0' }}>
          <button type="button" onClick={() => (setFrom(id), go('planner'), say(`From ${nm(id)}`))} style={{ flex: 1, height: 44, borderRadius: 22, border: 'none', background: accent, color: '#fff', font: 'inherit', fontSize: 13.500, fontWeight: 700, cursor: 'pointer' }}>Directions from here</button>
          <button type="button" onClick={() => (setTo(id), go('planner'), say(`To ${nm(id)}`))} style={{ flex: 1, height: 44, borderRadius: 22, border: 'none', background: '#e2e8f0', color: INK, font: 'inherit', fontSize: 13.500, fontWeight: 700, cursor: 'pointer' }}>Directions to here</button>
        </div>
        <div style={{ padding: '16px 20px 8px', fontSize: 12, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '.06em' }}>Next departures</div>
        <div style={{ margin: '0 16px', background: '#fff', borderRadius: 22, padding: '2px 14px' }}>
          {rows.map((r, i) => {
            const key = `${id}${r.l}${r.d}`
            return (
              <button key={key} type="button" onClick={() => (setAlerts((a) => ({ ...a, [key]: !a[key] })), say(alerts[key] ? 'Reminder removed' : `Reminder set: ${LINES[r.l].name} to ${toward(r.l, r.d)}`))} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '12px 0', border: 'none', borderTop: i ? '1px solid #eef2f6' : 'none', background: 'none', font: 'inherit', color: INK, textAlign: 'left', cursor: 'pointer' }}>
                <Badge l={r.l} size={30} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 14.500, fontWeight: 700 }}>to {toward(r.l, r.d)}</span>
                  <span style={{ display: 'block', fontSize: 12, color: MUTED }}>{LINES[r.l].name} · then {mmss(r.w + LINES[r.l].head)}</span>
                </span>
                {alerts[key] && <Icon name="bell" size={16} color={accent} fill={accent} />}
                <span style={{ fontSize: 17, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: r.w < 15 ? '#dc2626' : INK }}>{r.w < 15 ? 'Arriving' : mmss(r.w)}</span>
              </button>
            )
          })}
        </div>
        <div style={{ display: 'flex', gap: 8, padding: '14px 16px', flexWrap: 'wrap' }}>
          {['Step-free access', 'Toilets', 'Wi-Fi'].map((f) => <span key={f} style={{ padding: '6px 12px', borderRadius: 14, background: '#fff', fontSize: 12.500, fontWeight: 600, color: MUTED }}>{f}</span>)}
        </div>
      </div>
    )
  } else if (tab === 'planner') {
    const r = plan(from, to, mode)
    const w0 = r ? wait(r.legs[0].line, r.legs[0].dir, r.legs[0].stops[0], nowS) : 0
    const field = (label, val, which) => (
      <button type="button" onClick={() => (setQ(''), setPicker(which))} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', height: 54, padding: '0 14px', border: 'none', background: 'none', color: INK, font: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
        <span style={{ width: 12, height: 12, borderRadius: which === 'from' ? '50%' : 3, border: `3px solid ${INK}`, background: which === 'from' ? '#fff' : INK }} />
        <span style={{ flex: 1 }}>
          <span style={{ display: 'block', fontSize: 11, color: MUTED, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</span>
          <span style={{ display: 'block', fontSize: 16, fontWeight: 700 }}>{val ? nm(val) : 'Choose a station'}</span>
        </span>
      </button>
    )
    body = (
      <div className="tr-scroll" style={{ height: '100%', overflowY: 'auto', paddingTop: 54, paddingBottom: 110 }}>
        {header('Trip planner')}
        <div style={{ position: 'relative', margin: '6px 16px 0', background: '#fff', borderRadius: 22, padding: '2px 0' }}>
          {field('From', from, 'from')}
          <div style={{ height: 1, background: '#eef2f6', margin: '0 14px' }} />
          {field('To', to, 'to')}
          <button type="button" onClick={() => (setFrom(to), setTo(from))} aria-label="Swap From and To" style={{ ...iconBtn, position: 'absolute', right: 14, top: '50%', marginTop: -19, width: 38, height: 38, background: '#e2e8f0' }}><Icon name="swap" size={18} /></button>
        </div>
        <div style={{ display: 'flex', gap: 8, padding: '14px 16px 4px' }} role="group" aria-label="Route preference">
          {[['fast', 'Fastest'], ['few', 'Fewest changes']].map(([k, l]) => (
            <button key={k} type="button" onClick={() => setMode(k)} aria-pressed={mode === k} style={{ height: 38, padding: '0 16px', borderRadius: 19, border: 'none', background: mode === k ? accent : '#fff', color: mode === k ? '#fff' : INK, font: 'inherit', fontSize: 13.500, fontWeight: 700, cursor: 'pointer' }}>{l}</button>
          ))}
        </div>
        <div style={{ padding: '10px 20px 8px', fontSize: 12, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '.06em' }}>Suggested route</div>
        {from === to && from ? (
          <div style={{ margin: '0 16px', padding: 20, background: '#fff', borderRadius: 22, textAlign: 'center', color: MUTED, fontSize: 14 }}>From and To are the same station.</div>
        ) : r ? (
          <button type="button" onClick={() => push({ id: 'route', from, to, mode })} style={{ display: 'block', width: 'calc(100% - 32px)', margin: '0 16px', padding: 16, borderRadius: 22, border: 'none', background: '#fff', color: INK, font: 'inherit', textAlign: 'left', cursor: 'pointer', boxShadow: '0 6px 18px rgba(15,23,42,.08)' }}>
            <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em' }}>{r.mins} min</span>
              <span style={{ fontSize: 13, color: MUTED }}>${r.fare.toFixed(2)} · {r.transfers ? `${r.transfers} change${r.transfers > 1 ? 's' : ''}` : 'Direct'}</span>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '10px 0' }}>
              {r.legs.map((g, i) => (
                <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {i > 0 && <Icon name="walk" size={15} color={MUTED} />}
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 9px 3px 3px', borderRadius: 12, background: `${LINES[g.line].color}22`, fontSize: 12.500, fontWeight: 700 }}><Badge l={g.line} size={20} />{g.mins} min</span>
                </span>
              ))}
            </span>
            <span style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: MUTED }}>
              <span>Next train in <b style={{ color: INK, fontVariantNumeric: 'tabular-nums' }}>{mmss(w0)}</b></span>
              <span style={{ color: accent, fontWeight: 800 }}>See steps</span>
            </span>
          </button>
        ) : (
          <div style={{ margin: '0 16px', padding: 20, background: '#fff', borderRadius: 22, textAlign: 'center', color: MUTED, fontSize: 14 }}>Choose both stations to see a route.</div>
        )}
        <div style={{ padding: '16px 20px 8px', fontSize: 12, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '.06em' }}>Quick picks</div>
        <div className="tr-scroll" style={{ display: 'flex', gap: 8, padding: '0 16px', overflowX: 'auto' }}>
          {[['westfield', 'airport'], ['northgate', 'pier'], ['lakeside', 'brewery'], ['beacon', 'university']].map(([a, b]) => (
            <button key={a + b} type="button" onClick={() => (setFrom(a), setTo(b))} style={{ flex: 'none', height: 38, padding: '0 14px', borderRadius: 19, border: '1px solid #d5dde7', background: 'none', color: INK, font: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{nm(a)} to {nm(b)}</button>
          ))}
        </div>
      </div>
    )
  } else if (tab === 'saved') {
    const sts = Object.keys(savedSt).filter((k) => savedSt[k])
    body = (
      <div className="tr-scroll" style={{ height: '100%', overflowY: 'auto', paddingTop: 54, paddingBottom: 110 }}>
        {header('Saved')}
        <div style={{ padding: '4px 20px 8px', fontSize: 12, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '.06em' }}>Routes</div>
        <div style={{ display: 'grid', gap: 8, padding: '0 16px' }}>
          {savedRoutes.map((s) => {
            const r = plan(s.from, s.to, s.mode)
            return (
              <div key={s.from + s.to + s.mode} style={{ display: 'flex', alignItems: 'center', background: '#fff', borderRadius: 20 }}>
                <button type="button" onClick={() => push({ id: 'route', ...s })} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12, padding: 14, border: 'none', background: 'none', font: 'inherit', color: INK, textAlign: 'left', cursor: 'pointer', minWidth: 0 }}>
                  <span style={{ display: 'flex', gap: 3 }}>{r && r.legs.map((g, i) => <Badge key={i} l={g.line} size={22} />)}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 14.500, fontWeight: 700 }}>{nm(s.from)} to {nm(s.to)}</span>
                    <span style={{ display: 'block', fontSize: 12, color: MUTED }}>{r ? `${r.mins} min · ${r.transfers ? `${r.transfers} change` : 'Direct'}` : ''} · {s.mode === 'fast' ? 'Fastest' : 'Fewest changes'}</span>
                  </span>
                </button>
                <button type="button" onClick={() => toggleRoute(s)} aria-label="Remove saved route" style={{ ...iconBtn, width: 36, height: 36, marginRight: 10, background: '#f1f4f8' }}><Icon name="x" size={16} /></button>
              </div>
            )
          })}
          {!savedRoutes.length && <div style={{ padding: 18, background: '#fff', borderRadius: 20, color: MUTED, fontSize: 14, textAlign: 'center' }}>No saved routes. Open a route and tap the bookmark.</div>}
        </div>
        <div style={{ padding: '18px 20px 8px', fontSize: 12, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '.06em' }}>Stations</div>
        <div style={{ display: 'grid', gap: 8, padding: '0 16px' }}>
          {sts.map((id) => (
            <div key={id} style={{ display: 'flex', alignItems: 'center', background: '#fff', borderRadius: 20 }}>
              <button type="button" onClick={() => push({ id: 'station', st: id })} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12, padding: 14, border: 'none', background: 'none', font: 'inherit', color: INK, textAlign: 'left', cursor: 'pointer' }}>
                <span style={{ flex: 1 }}>
                  <span style={{ display: 'block', fontSize: 15, fontWeight: 700 }}>{nm(id)}</span>
                  <span style={{ display: 'flex', gap: 4, marginTop: 4 }}>{linesAt(id).map((l) => <Badge key={l} l={l} size={18} />)}</span>
                </span>
                <span style={{ fontSize: 12, color: MUTED }}>next {(() => { const ws = linesAt(id).flatMap((l) => [0, 1].map((d) => wait(l, d, id, nowS))).filter((x) => x !== null); return mmss(Math.min(...ws)) })()}</span>
              </button>
              <button type="button" onClick={() => (setSavedSt((s) => ({ ...s, [id]: false })), say('Station removed'))} aria-label="Remove saved station" style={{ ...iconBtn, width: 36, height: 36, marginRight: 10, background: '#f1f4f8' }}><Icon name="star" size={16} color="#f59e0b" fill="#f59e0b" /></button>
            </div>
          ))}
          {!sts.length && <div style={{ padding: 18, background: '#fff', borderRadius: 20, color: MUTED, fontSize: 14, textAlign: 'center' }}>No saved stations. Open a station and tap the star.</div>}
        </div>
      </div>
    )
  } else {
    const L = selLine && LINES[selLine]
    const vs = L ? L.v.map((x) => x[0]) : []
    const ix = L ? clamp(lineIx[selLine] ?? 0, 0, vs.length - 1) : 0
    body = (
      <div style={{ position: 'absolute', inset: 0, paddingTop: 54 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 16px 0' }}>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em' }}>{name}</h1>
          <button type="button" onClick={() => (setQ(''), setPicker('open'))} aria-label="Search stations" style={{ ...iconBtn, width: 42, height: 42 }}><Icon name="search" size={20} /></button>
        </div>
        <div className="tr-scroll" role="group" aria-label="Lines" style={{ display: 'flex', gap: 8, padding: '10px 16px 8px', overflowX: 'auto' }}>
          {LINE_IDS.map((l) => (
            <button key={l} type="button" onClick={() => setSelLine(selLine === l ? null : l)} aria-pressed={selLine === l} style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 7, height: 36, padding: '0 14px 0 6px', borderRadius: 18, border: `2px solid ${selLine === l ? LINES[l].color : 'transparent'}`, background: '#fff', color: INK, font: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              <Badge l={l} size={22} />{LINES[l].name.replace(' Line', '')}
            </button>
          ))}
        </div>
        <div style={{ margin: '0 12px', height: 392, borderRadius: 24, overflow: 'hidden', border: '1px solid #dbe3ec' }}>
          <MapSvg selLine={selLine} reduced={reduced} onLine={(l) => setSelLine(selLine === l ? null : l)} onStation={(id) => push({ id: 'station', st: id })} />
        </div>
        <div style={{ position: 'absolute', left: 12, right: 12, top: 54 + 48 + 52 + 392 + 10, bottom: 100, overflowY: 'auto' }} className="tr-scroll">
          {L ? (
            <div style={{ background: '#fff', borderRadius: 22, padding: '12px 14px', borderTop: `5px solid ${L.color}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Badge l={selLine} size={28} />
                <span style={{ flex: 1, fontSize: 16, fontWeight: 800 }}>{L.name}<span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: L.status === 'Good service' ? '#15803d' : '#b45309' }}>{L.status} · every {Math.round(L.head / 60)} min</span></span>
                <button type="button" onClick={() => setSelLine(null)} aria-label="Clear line" style={{ ...iconBtn, width: 32, height: 32, background: '#f1f4f8' }}><Icon name="x" size={15} /></button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '10px 0 4px' }}>
                <button type="button" onClick={() => setLineIx((o) => ({ ...o, [selLine]: clamp(ix - 1, 0, vs.length - 1) }))} disabled={ix === 0} aria-label="Previous station" style={{ ...iconBtn, width: 30, height: 30, background: '#f1f4f8', opacity: ix === 0 ? 0.35 : 1, transform: 'rotate(0)' }}><Icon name="back" size={16} /></button>
                <button type="button" onClick={() => push({ id: 'station', st: vs[ix] })} style={{ border: 'none', background: 'none', font: 'inherit', fontSize: 14, fontWeight: 800, color: INK, cursor: 'pointer' }}>{nm(vs[ix])} <span style={{ color: MUTED, fontWeight: 600 }}>· open</span></button>
                <button type="button" onClick={() => setLineIx((o) => ({ ...o, [selLine]: clamp(ix + 1, 0, vs.length - 1) }))} disabled={ix === vs.length - 1} aria-label="Next station" style={{ ...iconBtn, width: 30, height: 30, background: '#f1f4f8', opacity: ix === vs.length - 1 ? 0.35 : 1 }}><Icon name="chev" size={16} /></button>
              </div>
              {[0, 1].map((d) => {
                const chips = arrivalChips(selLine, d, vs[ix])
                return (
                  <div key={d} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 0', fontSize: 12.500 }}>
                    <span style={{ width: 92, color: MUTED, fontWeight: 600 }}>to {toward(selLine, d)}</span>
                    {chips[0] ? <span style={{ display: 'flex', gap: 5 }}>{chips}</span> : <span style={{ color: MUTED }}>Terminates here</span>}
                  </div>
                )
              })}
            </div>
          ) : (
            <div style={{ background: '#fff', borderRadius: 22, padding: '4px 14px' }}>
              {LINE_IDS.map((l, i) => (
                <button key={l} type="button" onClick={() => setSelLine(l)} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 0', border: 'none', borderTop: i ? '1px solid #eef2f6' : 'none', background: 'none', font: 'inherit', color: INK, textAlign: 'left', cursor: 'pointer' }}>
                  <Badge l={l} size={24} />
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 700 }}>{LINES[l].name}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: LINES[l].status === 'Good service' ? '#15803d' : '#b45309' }}>{LINES[l].status}</span>
                  <Icon name="chev" size={15} color={MUTED} />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // station picker overlay
  const list = ALL.filter((id) => nm(id).toLowerCase().includes(q.trim().toLowerCase()))
  const pick = (id) => {
    if (picker === 'open') push({ id: 'station', st: id })
    else if (picker === 'from') setFrom(id)
    else setTo(id)
    setPicker(null)
    setQ('')
  }

  const phone = (
    <div data-phone="1" style={{ position: 'relative', width: W, height: H, overflow: 'hidden', borderRadius: frame ? 46 : 0, background: BG, color: INK, fontFamily: "-apple-system, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif" }}>
      <style>{`
        @keyframes tr-r { from { opacity: 0; transform: translateX(34px) } to { opacity: 1; transform: none } }
        @keyframes tr-l { from { opacity: 0; transform: translateX(-34px) } to { opacity: 1; transform: none } }
        @keyframes tr-up { from { transform: translateY(100%) } to { transform: none } }
        .tr-scroll { scrollbar-width: none } .tr-scroll::-webkit-scrollbar { display: none }
        .tr-app button:focus-visible, .tr-app input:focus-visible, .tr-app [role=button]:focus-visible { outline: 2px solid ${accent}; outline-offset: 2px }
        @media (prefers-reduced-motion: reduce) { .tr-slide, .tr-sheet { animation: none !important } }
      `}</style>
      <StatusBar frame={frame} />
      <div key={`${tab}/${stack.map((s) => s.id).join('/')}`} className="tr-slide" style={{ position: 'absolute', inset: 0, overflow: 'hidden', animation: `${dir > 0 ? 'tr-r' : 'tr-l'} .28s ease` }}>
        {body}
      </div>
      {tabbed && (
        <nav aria-label="Main" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 88, background: '#fff', borderTop: '1px solid #dbe3ec', display: 'flex', justifyContent: 'space-around', padding: '10px 8px 0', zIndex: 10 }}>
          {NAV.map(([id, icon, label]) => (
            <button key={id} type="button" onClick={() => go(id)} aria-current={tab === id ? 'page' : undefined} style={{ border: 'none', background: 'none', font: 'inherit', cursor: 'pointer', display: 'grid', justifyItems: 'center', alignContent: 'start', gap: 3, width: 84, height: 54, fontSize: 11, fontWeight: 700, color: tab === id ? INK : '#94a3b8', position: 'relative' }}>
              {tab === id && <span style={{ position: 'absolute', top: -10, width: 28, height: 4, borderRadius: 2, background: accent }} />}
              <Icon name={icon} size={23} />
              {label}
            </button>
          ))}
        </nav>
      )}
      {picker && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 30, background: 'rgba(15,23,42,.45)', display: 'flex', alignItems: 'flex-end' }} onClick={() => setPicker(null)}>
          <div className="tr-sheet" onClick={(e) => e.stopPropagation()} style={{ width: '100%', height: 640, background: '#fff', borderRadius: '26px 26px 0 0', display: 'flex', flexDirection: 'column', animation: 'tr-up .28s ease' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '18px 16px 10px' }}>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, height: 44, padding: '0 14px', borderRadius: 22, background: '#eef2f6' }}>
                <Icon name="search" size={18} color={MUTED} />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={picker === 'open' ? 'Find a station' : `Choose ${picker === 'from' ? 'starting' : 'destination'} station`} aria-label="Search stations" style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'none', font: 'inherit', fontSize: 15, color: INK }} />
              </div>
              <button type="button" onClick={() => setPicker(null)} style={{ border: 'none', background: 'none', color: MUTED, font: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
            </div>
            <div className="tr-scroll" style={{ flex: 1, overflowY: 'auto', padding: '0 16px 40px' }}>
              {list.map((id) => (
                <button key={id} type="button" onClick={() => pick(id)} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '13px 0', border: 'none', borderBottom: '1px solid #eef2f6', background: 'none', font: 'inherit', color: INK, textAlign: 'left', cursor: 'pointer' }}>
                  <span style={{ flex: 1, fontSize: 15, fontWeight: 600 }}>{nm(id)}</span>
                  <span style={{ display: 'flex', gap: 4 }}>{linesAt(id).map((l) => <Badge key={l} l={l} size={20} />)}</span>
                </button>
              ))}
              {!list.length && <div style={{ textAlign: 'center', color: MUTED, padding: '30px 0', fontSize: 14 }}>No stations match “{q}”.</div>}
            </div>
          </div>
        </div>
      )}
      <div role="status" style={{ position: 'absolute', left: '50%', top: 58, zIndex: 50, transform: `translate(-50%, ${toast ? 0 : -90}px)`, transition: 'transform .35s cubic-bezier(.2,.8,.2,1)', padding: '10px 16px', borderRadius: 20, background: INK, color: '#fff', fontSize: 12.500, fontWeight: 700, whiteSpace: 'nowrap', maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis' }}>{toast}</div>
      <div style={{ position: 'absolute', left: '50%', bottom: 8, width: 140, height: 5, marginLeft: -70, borderRadius: 3, background: INK, opacity: 0.8, zIndex: 45 }} />
    </div>
  )

  return (
    <div ref={box} className="tr-app" style={{ position: 'relative', width: '100%', height: '100%', display: 'grid', placeItems: 'center', overflow: 'hidden', background: 'radial-gradient(ellipse at 50% 30%, #e3ebf5, #aebccf 75%)', ...style }}>
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: `translate(-50%, -50%) scale(${scale})`, transformOrigin: 'center' }}>
        {frame ? (
          <div style={{ padding: 12, borderRadius: 58, background: 'linear-gradient(145deg, #3a3f4a, #14171d 40%, #2b2f38)', boxShadow: '0 40px 80px rgba(15,23,42,.35), inset 0 0 0 2px #4b515e' }}>
            <div style={{ padding: 2, borderRadius: 48, background: '#000' }}>{phone}</div>
          </div>
        ) : (
          phone
        )}
      </div>
    </div>
  )
}
