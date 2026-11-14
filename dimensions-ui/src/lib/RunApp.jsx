import { useEffect, useRef, useState } from 'react'

// A running app on a phone, as a click-through prototype. Start: pick a goal
// (or a saved route), press the big button and a 3-2-1 countdown begins the
// run. Live run is a simulated GPS run (no real location, shown at 12x speed):
// a route line is drawn on an SVG map as distance, pace and time tick up; you
// can pause/resume, tap Lap, and HOLD the ring button to finish. Summary shows
// the route, a per-km splits bar chart, laps and stats, and can save the run
// as a new route. History lists runs (tap for their summary, filter chips),
// Routes holds saved loops with a detail page that starts them. The phone
// scales to fit its container.

const W = 390
const H = 844
const SIM = 12 // simulated seconds per real second
const LIGHT = { bg: '#f5f3ee', card: '#ffffff', ink: '#1a1a1f', muted: '#85838c', line: '#e7e4dc' }
const DARK = { bg: '#14161a', card: '#1f2228', ink: '#f4f4f6', muted: '#8f939c', line: '#2d3139' }

const GOALS = [
  { id: 'free', label: 'Free run' },
  { id: '3k', label: '3 km', dist: 3000 },
  { id: '5k', label: '5 km', dist: 5000 },
  { id: '10k', label: '10 km', dist: 10000 },
  { id: '30m', label: '30 min', time: 1800 },
]
const ROUTES = [
  { id: 'river', name: 'Riverside Loop', km: 5.0, note: 'Flat, shaded path along the water', shape: { rx: 118, ry: 78, k: 3, a: 14, ph: 0.4 }, base: 330 },
  { id: 'park', name: 'Park Circuit', km: 3.2, note: 'Two laps of the park gets you here', shape: { rx: 92, ry: 70, k: 2, a: 10, ph: 1.3 }, base: 322 },
  { id: 'hill', name: 'Hill Repeat', km: 8.4, note: 'Rolling climbs, long finish', shape: { rx: 132, ry: 98, k: 5, a: 12, ph: 2.2 }, base: 345 },
]
const DEFAULT_SHAPE = ROUTES[0].shape

const ICONS = {
  run: 'M13 4a1.6 1.6 0 1 0 0 .01zM9 21l3-6-3-3 2-5 4 3 3 1M7 12l2-4',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  route: 'M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM8 17h6a3 3 0 0 0 0-6h-4a3 3 0 0 1 0-6h6',
  back: 'M15 5l-7 7 7 7',
  chev: 'M9 5l7 7-7 7',
  pause: 'M8 5v14M16 5v14',
  play: 'M7 4l13 8-13 8z',
  flag: 'M6 21V4m0 1h11l-2 4 2 4H6',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z',
  check: 'M5 12l5 5 9-10',
  share: 'M12 15V4m0 0l-4 4m4-4l4 4M5 13v6h14v-6',
  signal: 'M3 18h2M8 18v-4M13 18V10M18 18V5',
  bolt: 'M13 3L5 14h6l-1 7 8-11h-6z',
}

function Icon({ name, size = 22, color = 'currentColor', w = 1.9, fill = 'none' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  )
}

const mmss = (s) => {
  s = Math.max(0, Math.round(s))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
const hms = (s) => {
  s = Math.max(0, Math.floor(s))
  const h = Math.floor(s / 3600)
  return `${h ? `${h}:` : ''}${String(Math.floor((s % 3600) / 60)).padStart(h ? 2 : 1, '0')}:${String(s % 60).padStart(2, '0')}`
}
const km = (m) => (m / 1000).toFixed(2)

// --- route geometry (cached) -----------------------------------------
const GEO = {}
function geo(shape) {
  const key = JSON.stringify(shape)
  if (GEO[key]) return GEO[key]
  const N = 160
  const pts = []
  for (let i = 0; i <= N; i++) {
    const t = (i / N) * Math.PI * 2
    pts.push([170 + shape.rx * Math.cos(t) + shape.a * Math.cos(shape.k * t + shape.ph), 150 + shape.ry * Math.sin(t) + shape.a * Math.sin((shape.k - 1) * t + shape.ph)])
  }
  const lens = [0]
  for (let i = 1; i < pts.length; i++) lens.push(lens[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]))
  const g = { pts, lens, total: lens[lens.length - 1] }
  GEO[key] = g
  return g
}
function pointAt(g, p) {
  const target = Math.max(0, Math.min(1, p)) * g.total
  let i = 1
  while (i < g.lens.length - 1 && g.lens[i] < target) i++
  const f = (target - g.lens[i - 1]) / (g.lens[i] - g.lens[i - 1] || 1)
  const a = g.pts[i - 1]
  const b = g.pts[i]
  return { x: a[0] + (b[0] - a[0]) * f, y: a[1] + (b[1] - a[1]) * f, i }
}
function trail(g, p) {
  const e = pointAt(g, p)
  let d = `M${g.pts[0][0].toFixed(1)} ${g.pts[0][1].toFixed(1)}`
  for (let i = 1; i < e.i; i++) d += `L${g.pts[i][0].toFixed(1)} ${g.pts[i][1].toFixed(1)}`
  return { d: `${d}L${e.x.toFixed(1)} ${e.y.toFixed(1)}`, end: e }
}

// --- simulated run -----------------------------------------------------
const paceAt = (t, base) => base + 22 * Math.sin(t / 90) + 9 * Math.sin(t / 23) - Math.min(18, t / 150)
function stepRun(r, dt) {
  if (r.paused) return r
  const t = r.elapsed + dt
  const pace = paceAt(t, r.base)
  const d = r.dist + (1000 / pace) * dt
  const kmTimes = r.kmTimes
  let out = kmTimes
  while (d >= (out.length + 1) * 1000) {
    const frac = ((out.length + 1) * 1000 - r.dist) / (d - r.dist || 1)
    out = [...out, r.elapsed + frac * dt]
  }
  return { ...r, elapsed: t, dist: d, pace, kmTimes: out }
}
const newRun = (goal, route, base = 330) => ({
  goal,
  route,
  base,
  routeLen: route ? route.km * 1000 : goal.dist || 5000,
  shape: route ? route.shape : DEFAULT_SHAPE,
  elapsed: 0,
  dist: 0,
  pace: base,
  paused: false,
  kmTimes: [],
  laps: [],
  lapMark: { dist: 0, time: 0 },
  goalHit: false,
})
function simulate(run, untilDist) {
  let r = run
  while (r.dist < untilDist) r = stepRun(r, 2)
  return r
}
function summarize(r) {
  const splits = r.kmTimes.map((t, i) => ({ label: String(i + 1), pace: t - (r.kmTimes[i - 1] || 0) }))
  const rem = r.dist - r.kmTimes.length * 1000
  if (rem >= 100) splits.push({ label: (rem / 1000).toFixed(1), pace: ((r.elapsed - (r.kmTimes[r.kmTimes.length - 1] || 0)) / rem) * 1000, partial: true })
  return { dist: r.dist, time: r.elapsed, avg: (r.elapsed / r.dist) * 1000, splits, laps: r.laps, shape: r.shape, routeLen: r.routeLen, routeName: r.route ? r.route.name : 'Free route', kmTimes: r.kmTimes }
}
const seedRun = (title, date, dist, base, route) => ({ id: title + date, title, date, ...summarize(simulate(newRun({ id: 'x' }, route, base), dist)) })
const SEED = [
  seedRun('Morning run', 'Thu 13 Nov', 5020, 328, ROUTES[0]),
  seedRun('Easy recovery', 'Tue 11 Nov', 3210, 352, ROUTES[1]),
  seedRun('Long run', 'Sun 9 Nov', 10160, 338, null),
  seedRun('Hill session', 'Fri 7 Nov', 8420, 346, ROUTES[2]),
  seedRun('Tempo 5K', 'Wed 5 Nov', 5000, 305, ROUTES[0]),
  seedRun('Park laps', 'Sun 2 Nov', 3180, 335, ROUTES[1]),
]

// --- small pieces ------------------------------------------------------
function StatusBar({ frame, color }) {
  const clock = new Date().toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' })
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20, height: 54, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 30px 0 36px', fontSize: 16, fontWeight: 600, color, pointerEvents: 'none' }}>
      <span>{clock}</span>
      {frame && <span style={{ position: 'absolute', left: '50%', top: 11, width: 122, height: 35, marginLeft: -61, borderRadius: 20, background: '#000' }} />}
      <span style={{ display: 'flex', gap: 6, alignItems: 'center' }} aria-hidden="true">
        <svg width="18" height="11" viewBox="0 0 18 11" fill={color}>
          <rect x="0" y="7" width="3" height="4" rx="1" />
          <rect x="5" y="5" width="3" height="6" rx="1" />
          <rect x="10" y="2.5" width="3" height="8.5" rx="1" />
          <rect x="15" y="0" width="3" height="11" rx="1" />
        </svg>
        <svg width="26" height="12" viewBox="0 0 26 12">
          <rect x="0.5" y="0.5" width="22" height="11" rx="3.5" fill="none" stroke={color} opacity=".45" />
          <rect x="2.5" y="2.5" width="16" height="7" rx="2" fill={color} />
          <rect x="23.5" y="4" width="2" height="4" rx="1" fill={color} opacity=".45" />
        </svg>
      </span>
    </div>
  )
}

// A map tile: pale base, park, river and streets, the planned loop, and the run.
function MapView({ shape, progress, accent, height = 300, paused, markers = [], fullRoute = true, rounded = 22 }) {
  const g = geo(shape)
  const t = progress == null ? null : trail(g, progress)
  const start = g.pts[0]
  return (
    <svg viewBox="0 0 340 300" width="100%" height={height} preserveAspectRatio="xMidYMid slice" role="img" aria-label="Route map" style={{ display: 'block', borderRadius: rounded, background: '#edf0ea' }}>
      <path d="M-10 220 C60 180 110 250 190 215 S300 170 350 205 L350 240 C300 205 240 255 190 250 S60 215 -10 255z" fill="#cde2f0" />
      <path d="M20 40 C70 10 130 20 150 60 S110 110 60 100 5 80 20 40z" fill="#d6e8cf" />
      <path d="M250 60 C290 40 330 60 322 100 S270 130 245 100 235 75 250 60z" fill="#d6e8cf" />
      {[[0, 90, 340, 110], [0, 180, 340, 150], [80, 0, 100, 300], [240, 0, 220, 300], [0, 30, 340, 40]].map((l, i) => <line key={i} x1={l[0]} y1={l[1]} x2={l[2]} y2={l[3]} stroke="#fff" strokeWidth={i < 2 ? 9 : 6} />)}
      {fullRoute && <path d={`M${g.pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('L')}`} fill="none" stroke="#9aa3ad" strokeWidth="5" strokeLinejoin="round" strokeDasharray="2 9" strokeLinecap="round" />}
      {t && <path d={t.d} fill="none" stroke="#fff" strokeWidth="10" strokeLinejoin="round" strokeLinecap="round" opacity=".9" />}
      {t && <path d={t.d} fill="none" stroke={accent} strokeWidth="6" strokeLinejoin="round" strokeLinecap="round" />}
      {markers.map((m) => {
        const p = pointAt(g, m.p)
        return (
          <g key={m.label}>
            <circle cx={p.x} cy={p.y} r="9" fill="#fff" stroke={accent} strokeWidth="2.5" />
            <text x={p.x} y={p.y + 3.5} textAnchor="middle" fontSize="10" fontWeight="800" fill="#1a1a1f">{m.label}</text>
          </g>
        )
      })}
      <circle cx={start[0]} cy={start[1]} r="7" fill="#1a1a1f" stroke="#fff" strokeWidth="3" />
      {t && !markers.length && (
        <g>
          <circle cx={t.end.x} cy={t.end.y} r="16" fill={accent} opacity=".25">
            {!paused && <animate attributeName="r" values="9;20;9" dur="1.8s" repeatCount="indefinite" />}
          </circle>
          <circle cx={t.end.x} cy={t.end.y} r="8" fill={accent} stroke="#fff" strokeWidth="3.5" />
        </g>
      )}
    </svg>
  )
}

function Thumb({ shape, accent, size = 52 }) {
  const g = geo(shape)
  return (
    <svg viewBox="40 40 260 220" width={size} height={size * 0.85} aria-hidden="true" style={{ borderRadius: 12, background: '#edf0ea', flex: 'none' }}>
      <path d={`M${g.pts.map((p) => `${p[0].toFixed(0)} ${p[1].toFixed(0)}`).join('L')}`} fill="none" stroke={accent} strokeWidth="12" strokeLinejoin="round" />
    </svg>
  )
}

function HoldButton({ onDone, color, ms = 1200, ring }) {
  const [pct, setPct] = useState(0)
  const raf = useRef(0)
  const t0 = useRef(0)
  const cb = useRef(onDone)
  cb.current = onDone
  const stop = () => {
    cancelAnimationFrame(raf.current)
    raf.current = 0
    setPct(0)
  }
  const start = () => {
    if (raf.current) return
    t0.current = performance.now()
    const loop = (t) => {
      const p = Math.min(1, (t - t0.current) / ms)
      setPct(p)
      if (p >= 1) {
        raf.current = 0
        cb.current()
        return
      }
      raf.current = requestAnimationFrame(loop)
    }
    raf.current = requestAnimationFrame(loop)
  }
  useEffect(() => () => cancelAnimationFrame(raf.current), [])
  const r = 41
  const c = 2 * Math.PI * r
  return (
    <button
      type="button"
      aria-label="Hold to finish run"
      onPointerDown={start}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onKeyDown={(e) => (e.key === ' ' || e.key === 'Enter') && !e.repeat && start()}
      onKeyUp={stop}
      onContextMenu={(e) => e.preventDefault()}
      style={{ position: 'relative', width: 92, height: 92, borderRadius: '50%', border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none', color: '#fff' }}
    >
      <svg width="92" height="92" viewBox="0 0 92 92" style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }} aria-hidden="true">
        <circle cx="46" cy="46" r={r} fill={pct > 0 ? `${color}33` : '#2a2e36'} stroke={ring} strokeWidth="6" />
        <circle cx="46" cy="46" r={r} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} />
      </svg>
      <span style={{ position: 'relative', display: 'grid', justifyItems: 'center', gap: 2, fontSize: 11, fontWeight: 800, letterSpacing: '.06em', transform: `scale(${1 - pct * 0.1})` }}>
        <Icon name="flag" size={22} />
        HOLD
      </span>
    </button>
  )
}

// ---------------------------------------------------------------- app

export default function RunApp({ name = 'Stride', accent = '#ff5a1f', startScreen = 'start', frame = true, style }) {
  const box = useRef()
  const toastTimer = useRef()
  const runRef = useRef(null)
  const lastTick = useRef(0)
  const [scale, setScale] = useState(1)
  const [tab, setTab] = useState('start')
  const [stack, setStack] = useState([])
  const [dir, setDir] = useState(1)
  const [toast, setToast] = useState('')
  const [goalId, setGoalId] = useState('5k')
  const [routeId, setRouteId] = useState(null)
  const [cd, setCd] = useState(null)
  const [run, setRun] = useState(null)
  const [runs, setRuns] = useState(SEED)
  const [routes, setRoutes] = useState(ROUTES)
  const [favs, setFavs] = useState({ river: true })
  const [filter, setFilter] = useState('All')

  const upd = (fn) => {
    const n = fn(runRef.current)
    runRef.current = n
    setRun(n)
  }

  useEffect(() => {
    setCd(null)
    if (startScreen === 'live') {
      const r = simulate(newRun(GOALS[2], ROUTES[0], 330), 1900)
      r.laps = [{ n: 1, dist: 1000, time: r.kmTimes[0] }]
      r.lapMark = { dist: 1000, time: r.kmTimes[0] }
      runRef.current = r
      lastTick.current = 0
      setRun(r)
      setTab('start')
      setStack([{ id: 'live' }])
    } else if (startScreen === 'summary') {
      setTab('history')
      setStack([{ id: 'summary', r: SEED[0] }])
    } else {
      setTab(startScreen)
      setStack([])
    }
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

  useEffect(() => () => clearTimeout(toastTimer.current), [])
  const say = (t) => {
    setToast(t)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 1900)
  }

  const top = stack[stack.length - 1]
  const live = top?.id === 'live'
  const NAV = [['start', 'run', 'Start'], ['history', 'list', 'History'], ['routes', 'route', 'Routes']]
  const push = (s) => (setDir(1), setStack((a) => [...a, s]))
  const pop = () => (setDir(-1), setStack((a) => a.slice(0, -1)))
  const go = (t) => (setDir(NAV.findIndex((n) => n[0] === t) >= NAV.findIndex((n) => n[0] === tab) ? 1 : -1), setTab(t), setStack([]))

  // countdown 3-2-1 then the run starts
  useEffect(() => {
    if (cd == null) return undefined
    const id = setTimeout(() => {
      if (cd > 1) setCd(cd - 1)
      else {
        setCd(null)
        const goal = GOALS.find((g) => g.id === goalId)
        const route = routes.find((r) => r.id === routeId) || null
        const r = newRun(goal, route, route ? route.base : 330)
        runRef.current = r
        lastTick.current = 0
        setRun(r)
        push({ id: 'live' })
      }
    }, 900)
    return () => clearTimeout(id)
  }, [cd]) // eslint-disable-line react-hooks/exhaustive-deps

  // the simulated GPS clock
  useEffect(() => {
    if (!live) return undefined
    lastTick.current = performance.now()
    const id = setInterval(() => {
      const nowT = performance.now()
      const dt = Math.min(0.5, (nowT - lastTick.current) / 1000) * SIM
      lastTick.current = nowT
      const cur = runRef.current
      if (!cur || cur.paused) return
      let n = stepRun(cur, dt)
      const g = n.goal
      if (!n.goalHit && ((g.dist && n.dist >= g.dist) || (g.time && n.elapsed >= g.time))) {
        n = { ...n, goalHit: true }
        say('Goal reached! Keep going or hold to finish')
      }
      runRef.current = n
      setRun(n)
    }, 200)
    return () => clearInterval(id)
  }, [live]) // eslint-disable-line react-hooks/exhaustive-deps

  const startCountdown = (rid) => {
    if (rid !== undefined) setRouteId(rid)
    setCd(3)
  }

  const finish = () => {
    const r = runRef.current
    if (!r || r.dist < 50) {
      setStack([])
      say('Run too short, not saved')
      return
    }
    const s = summarize(r)
    const rec = { id: `r${Date.now()}`, title: 'Just now', date: 'Today', ...s }
    setRuns((a) => [rec, ...a])
    setDir(1)
    setStack([{ id: 'summary', r: rec, fresh: true }])
  }

  const colors = live ? DARK : LIGHT
  const { bg, card, ink, muted, line } = colors

  const header = (title, back, right) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 18px', minHeight: 52 }}>
      {back && (
        <button type="button" onClick={back} aria-label="Back" style={{ width: 38, height: 38, borderRadius: '50%', border: 'none', background: card, color: ink, display: 'grid', placeItems: 'center', cursor: 'pointer', padding: 0 }}>
          <Icon name="back" size={20} />
        </button>
      )}
      <h1 style={{ margin: 0, flex: 1, fontSize: back ? 18 : 28, fontWeight: 800, letterSpacing: '-0.03em' }}>{title}</h1>
      {right}
    </div>
  )
  const primary = (label, onClick, o = {}) => (
    <button type="button" onClick={onClick} style={{ width: '100%', height: 54, borderRadius: 27, border: o.ghost ? `1.5px solid ${line}` : 'none', background: o.ghost ? 'transparent' : accent, color: o.ghost ? ink : '#fff', font: 'inherit', fontSize: 15.5, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
      {label}
    </button>
  )
  const stat = (v, l, big) => (
    <div style={{ flex: 1, background: card, borderRadius: 18, padding: '12px 8px', textAlign: 'center' }}>
      <div style={{ fontSize: big ? 22 : 19, fontWeight: 800, fontVariantNumeric: 'tabular-nums', letterSpacing: '-.02em' }}>{v}</div>
      <div style={{ fontSize: 11, color: muted, marginTop: 2, fontWeight: 600 }}>{l}</div>
    </div>
  )
  const chip = (label, on, onClick) => (
    <button key={label} type="button" aria-pressed={on} onClick={onClick} style={{ flex: 'none', height: 40, padding: '0 18px', borderRadius: 20, border: on ? 'none' : `1.5px solid ${line}`, background: on ? ink : card, color: on ? bg : ink, font: 'inherit', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>{label}</button>
  )

  // ---- screens
  let body
  let tabbed = true
  if (live && run) {
    tabbed = false
    const p = run.dist >= run.routeLen && run.goal.dist ? 1 : (run.dist % run.routeLen) / run.routeLen
    const gpct = run.goal.dist ? run.dist / run.goal.dist : run.goal.time ? run.elapsed / run.goal.time : null
    body = (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: H - 54 }}>
        <div style={{ padding: '4px 16px 0', position: 'relative' }}>
          <MapView shape={run.shape} progress={p} accent={accent} height={290} paused={run.paused} />
          <span style={{ position: 'absolute', left: 28, top: 14, display: 'flex', gap: 6, alignItems: 'center', padding: '5px 10px', borderRadius: 14, background: 'rgba(255,255,255,.92)', color: '#1a1a1f', fontSize: 11.5, fontWeight: 800 }}>
            <i style={{ width: 8, height: 8, borderRadius: '50%', background: run.paused ? '#999' : '#e5322d' }} />
            {run.paused ? 'PAUSED' : 'REC'} · GPS
          </span>
          <span style={{ position: 'absolute', right: 28, top: 14, padding: '5px 10px', borderRadius: 14, background: 'rgba(26,26,31,.8)', color: '#fff', fontSize: 11, fontWeight: 700 }}>Demo x{SIM}</span>
        </div>
        <div style={{ textAlign: 'center', padding: '14px 0 2px' }}>
          <div style={{ fontSize: 66, fontWeight: 800, letterSpacing: '-.05em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }} aria-label="Distance">{km(run.dist)}</div>
          <div style={{ fontSize: 13, color: muted, fontWeight: 700, letterSpacing: '.12em' }}>KILOMETRES</div>
        </div>
        <div style={{ display: 'flex', gap: 8, padding: '10px 16px 0' }}>
          {stat(hms(run.elapsed), 'Time')}
          {stat(`${mmss(run.pace)}`, 'Pace /km')}
          {stat(run.dist > 0 ? mmss((run.elapsed / run.dist) * 1000) : '--:--', 'Avg /km')}
        </div>
        {gpct != null && (
          <div style={{ padding: '12px 22px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: muted, fontWeight: 700, marginBottom: 6 }}>
              <span>Goal {run.goal.label}</span>
              <span>{run.goalHit ? 'Reached' : `${Math.round(gpct * 100)}%`}</span>
            </div>
            <div style={{ height: 8, borderRadius: 4, background: line, overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(100, gpct * 100)}%`, height: '100%', background: run.goalHit ? '#34d17a' : accent, transition: 'width .2s linear' }} />
            </div>
          </div>
        )}
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '14px 20px 26px' }}>
          <button
            type="button"
            onClick={() => {
              const r = runRef.current
              const lap = { n: r.laps.length + 1, dist: r.dist - r.lapMark.dist, time: r.elapsed - r.lapMark.time }
              upd((x) => ({ ...x, laps: [...x.laps, lap], lapMark: { dist: x.dist, time: x.elapsed } }))
              say(`Lap ${lap.n}: ${km(lap.dist)} km · ${mmss((lap.time / Math.max(1, lap.dist)) * 1000)} /km`)
            }}
            style={{ width: 80, height: 80, borderRadius: '50%', border: 'none', background: card, color: ink, font: 'inherit', fontWeight: 800, fontSize: 12, cursor: 'pointer', display: 'grid', placeItems: 'center', alignContent: 'center', gap: 2 }}
          >
            <Icon name="flag" size={22} />
            LAP {run.laps.length}
          </button>
          <button type="button" aria-label={run.paused ? 'Resume' : 'Pause'} onClick={() => (upd((x) => ({ ...x, paused: !x.paused })), (lastTick.current = performance.now()))} style={{ width: 100, height: 100, borderRadius: '50%', border: 'none', background: accent, color: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center', boxShadow: `0 10px 30px ${accent}66` }}>
            <Icon name={run.paused ? 'play' : 'pause'} size={42} w={2.6} fill={run.paused ? '#fff' : 'none'} />
          </button>
          <HoldButton color="#ff3b3b" ring={line} onDone={finish} />
        </div>
      </div>
    )
  } else if (top?.id === 'summary') {
    tabbed = false
    const r = top.r
    const pEnd = r.dist >= r.routeLen ? 1 : r.dist / r.routeLen
    const markers = r.kmTimes.map((t, i) => ({ label: String(i + 1), p: ((i + 1) * 1000) / r.routeLen })).filter((m) => m.p < pEnd)
    const paces = r.splits.map((s) => s.pace)
    const best = Math.min(...paces)
    const lo = Math.min(...paces) * 0.85
    const hi = Math.max(...paces)
    const bw = Math.min(34, 300 / r.splits.length - 6)
    body = (
      <>
        {header(r.title === 'Just now' ? 'Run complete' : r.title, top.fresh ? null : pop)}
        <div style={{ padding: '0 16px' }}>
          <MapView shape={r.shape} progress={pEnd} accent={accent} height={230} markers={markers} />
        </div>
        <div style={{ textAlign: 'center', padding: '14px 0 4px' }}>
          <div style={{ fontSize: 52, fontWeight: 800, letterSpacing: '-.05em', lineHeight: 1 }}>{km(r.dist)}<span style={{ fontSize: 18, color: muted, marginLeft: 4 }}>km</span></div>
          <div style={{ fontSize: 13, color: muted, marginTop: 4 }}>{r.date} · {r.routeName}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, padding: '8px 16px' }}>
          {stat(hms(r.time), 'Time')}
          {stat(mmss(r.avg), 'Avg pace /km')}
          {stat(Math.round(r.dist * 0.062), 'Calories')}
        </div>
        <div style={{ margin: '4px 16px 0', background: card, borderRadius: 22, padding: '14px 12px 8px' }}>
          <div style={{ padding: '0 6px 6px', fontSize: 14, fontWeight: 800, display: 'flex', justifyContent: 'space-between' }}>Splits <span style={{ color: muted, fontWeight: 600, fontSize: 12 }}>pace per km</span></div>
          <svg viewBox="0 0 320 140" width="100%" role="img" aria-label="Pace per kilometre" style={{ display: 'block' }}>
            {r.splits.map((s, i) => {
              const h = 20 + ((hi - s.pace) / (hi - lo || 1)) * 74 + 12
              const x = 160 - (r.splits.length * (bw + 6)) / 2 + i * (bw + 6)
              return (
                <g key={i}>
                  <rect x={x} y={104 - h} width={bw} height={h} rx="6" fill={s.pace === best ? accent : '#d9d5cb'} />
                  {r.splits.length <= 9 && <text x={x + bw / 2} y={104 - h - 5} textAnchor="middle" fontSize="9.5" fontWeight="700" fill={ink}>{mmss(s.pace)}</text>}
                  <text x={x + bw / 2} y="122" textAnchor="middle" fontSize="10.5" fill={muted} fontWeight="600">{s.label}</text>
                </g>
              )
            })}
          </svg>
          <div style={{ fontSize: 11.5, color: muted, padding: '0 6px 4px' }}>Fastest split highlighted: {mmss(best)} /km</div>
        </div>
        {r.laps.length > 0 && (
          <div style={{ margin: '12px 16px 0', background: card, borderRadius: 22, padding: '8px 16px' }}>
            {r.laps.map((l, i) => (
              <div key={l.n} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: i < r.laps.length - 1 ? `1px solid ${line}` : 'none', fontSize: 14 }}>
                <span style={{ fontWeight: 700 }}>Lap {l.n}</span>
                <span style={{ color: muted }}>{km(l.dist)} km · {hms(l.time)} · {mmss((l.time / Math.max(1, l.dist)) * 1000)} /km</span>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 10, padding: '16px 16px 0' }}>
          <button type="button" onClick={() => say('Run link copied')} style={{ width: 54, height: 54, borderRadius: 27, border: `1.5px solid ${line}`, background: 'transparent', color: ink, display: 'grid', placeItems: 'center', cursor: 'pointer', padding: 0, flex: 'none' }} aria-label="Share"><Icon name="share" size={20} /></button>
          <div style={{ flex: 1 }}>{primary('Save as route', () => (setRoutes((a) => (a.some((x) => x.id === `c${r.id}`) ? a : [...a, { id: `c${r.id}`, name: `${r.routeName === 'Free route' ? 'My run' : r.routeName} ${km(r.dist)}`, km: +(r.dist / 1000).toFixed(1), note: 'Saved from a run', shape: r.shape, base: 330 }])), say('Saved to Routes')), { ghost: true })}</div>
        </div>
        {top.fresh && <div style={{ padding: '10px 16px 0' }}>{primary('Done', () => (setRun(null), setDir(1), setTab('history'), setStack([]), say('Run saved')))}</div>}
      </>
    )
  } else if (top?.id === 'route') {
    tabbed = false
    const r = top.r
    body = (
      <>
        {header(r.name, pop, <button type="button" aria-label="Favourite" aria-pressed={!!favs[r.id]} onClick={() => setFavs((f) => ({ ...f, [r.id]: !f[r.id] }))} style={{ width: 38, height: 38, borderRadius: '50%', border: 'none', background: card, color: favs[r.id] ? accent : muted, display: 'grid', placeItems: 'center', cursor: 'pointer', padding: 0 }}><Icon name="star" size={20} fill={favs[r.id] ? accent : 'none'} /></button>)}
        <div style={{ padding: '0 16px' }}><MapView shape={r.shape} progress={null} accent={accent} height={280} /></div>
        <div style={{ display: 'flex', gap: 8, padding: '12px 16px' }}>
          {stat(`${r.km} km`, 'Distance')}
          {stat(hms(r.km * r.base), 'Est. time')}
          {stat(mmss(r.base), 'Usual pace')}
        </div>
        <div style={{ margin: '0 16px', color: muted, fontSize: 14 }}>{r.note}. A closed loop, so you finish where you start.</div>
        <div style={{ padding: '18px 16px' }}>{primary('Start this route', () => startCountdown(r.id))}</div>
      </>
    )
  } else if (tab === 'history') {
    const list = runs.filter((r) => (filter === 'All' ? true : filter === 'Long' ? r.dist >= 8000 : r.dist >= 4800 && r.dist < 8000))
    const total = runs.reduce((a, r) => a + r.dist, 0)
    body = (
      <>
        {header('History')}
        <div style={{ display: 'flex', gap: 8, padding: '0 16px 12px' }}>
          {stat(`${(total / 1000).toFixed(1)} km`, 'Total distance', true)}
          {stat(runs.length, 'Runs', true)}
          {stat(mmss(runs.reduce((a, r) => a + r.avg, 0) / runs.length), 'Avg /km', true)}
        </div>
        <div style={{ display: 'flex', gap: 8, padding: '0 16px 12px' }}>
          {[['All', 'All'], ['5K', '5K runs'], ['Long', 'Long 8K+']].map(([id, l]) => chip(l, filter === id, () => setFilter(id)))}
        </div>
        <div style={{ padding: '0 16px', display: 'grid', gap: 8 }}>
          {list.length === 0 && <div style={{ textAlign: 'center', color: muted, padding: 30 }}>No runs match this filter.</div>}
          {list.map((r) => (
            <button key={r.id} type="button" onClick={() => push({ id: 'summary', r })} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: 12, border: 'none', borderRadius: 20, background: card, color: ink, font: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
              <Thumb shape={r.shape} accent={accent} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontWeight: 800, fontSize: 15 }}>{r.title}</span>
                <span style={{ display: 'block', color: muted, fontSize: 12, marginTop: 2 }}>{r.date} · {hms(r.time)} · {mmss(r.avg)} /km</span>
              </span>
              <span style={{ fontWeight: 800, fontSize: 17 }}>{km(r.dist)}<span style={{ fontSize: 11, color: muted }}> km</span></span>
            </button>
          ))}
        </div>
      </>
    )
  } else if (tab === 'routes') {
    const sorted = [...routes].sort((a, b) => (favs[b.id] ? 1 : 0) - (favs[a.id] ? 1 : 0))
    body = (
      <>
        {header('Routes')}
        <div style={{ padding: '0 16px', display: 'grid', gap: 12 }}>
          {sorted.map((r) => (
            <div key={r.id} style={{ background: card, borderRadius: 24, overflow: 'hidden' }}>
              <button type="button" onClick={() => push({ id: 'route', r })} aria-label={`Open ${r.name}`} style={{ display: 'block', width: '100%', padding: 0, border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', color: ink, font: 'inherit' }}>
                <div style={{ position: 'relative' }}>
                  <MapView shape={r.shape} progress={null} accent={accent} height={128} rounded={0} />
                  <span style={{ position: 'absolute', left: 12, bottom: 10, padding: '4px 10px', borderRadius: 12, background: 'rgba(26,26,31,.85)', color: '#fff', fontSize: 12, fontWeight: 800 }}>{r.km} km</span>
                </div>
                <div style={{ padding: '12px 14px 4px' }}>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>{r.name}</div>
                  <div style={{ fontSize: 12.5, color: muted, marginTop: 2 }}>{r.note}</div>
                </div>
              </button>
              <div style={{ display: 'flex', gap: 8, padding: '8px 14px 14px' }}>
                <button type="button" onClick={() => startCountdown(r.id)} style={{ flex: 1, height: 42, borderRadius: 21, border: 'none', background: accent, color: '#fff', font: 'inherit', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>Start</button>
                <button type="button" aria-label={`Favourite ${r.name}`} aria-pressed={!!favs[r.id]} onClick={() => setFavs((f) => ({ ...f, [r.id]: !f[r.id] }))} style={{ width: 42, height: 42, borderRadius: 21, border: `1.5px solid ${line}`, background: 'transparent', color: favs[r.id] ? accent : muted, display: 'grid', placeItems: 'center', cursor: 'pointer', padding: 0 }}><Icon name="star" size={19} fill={favs[r.id] ? accent : 'none'} /></button>
              </div>
            </div>
          ))}
        </div>
      </>
    )
  } else {
    const goal = GOALS.find((g) => g.id === goalId)
    const route = routes.find((r) => r.id === routeId)
    const week = [3.2, 0, 5.0, 0, 8.4, 5.0, 0]
    const wmax = Math.max(...week)
    body = (
      <>
        <div style={{ display: 'flex', alignItems: 'center', padding: '8px 22px 0', gap: 8 }}>
          <span style={{ flex: 1, color: muted, fontSize: 13, fontWeight: 600 }}>{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
          <span style={{ display: 'flex', gap: 5, alignItems: 'center', padding: '5px 10px', borderRadius: 14, background: '#dcf5e6', color: '#13803f', fontSize: 11.5, fontWeight: 800 }}><Icon name="signal" size={14} w={2.4} /> GPS ready</span>
        </div>
        {header(`Go, ${name}`)}
        <div style={{ padding: '0 16px', fontSize: 12, color: muted, fontWeight: 800, letterSpacing: '.1em', margin: '2px 6px 8px' }}>GOAL</div>
        <div style={{ display: 'flex', gap: 8, padding: '0 16px', overflowX: 'auto', scrollbarWidth: 'none' }}>
          {GOALS.map((g) => chip(g.label, goalId === g.id && !routeId, () => (setGoalId(g.id), setRouteId(null))))}
        </div>
        <div style={{ padding: '0 16px', fontSize: 12, color: muted, fontWeight: 800, letterSpacing: '.1em', margin: '16px 6px 8px' }}>ROUTE</div>
        <div style={{ display: 'flex', gap: 8, padding: '0 16px', overflowX: 'auto', scrollbarWidth: 'none' }}>
          {chip('Free', !routeId, () => setRouteId(null))}
          {routes.map((r) => chip(r.name, routeId === r.id, () => (setRouteId(r.id), setGoalId('free'))))}
        </div>
        <div style={{ display: 'grid', placeItems: 'center', padding: '24px 0 14px' }}>
          <button type="button" onClick={() => startCountdown()} aria-label="Start run" style={{ position: 'relative', width: 168, height: 168, borderRadius: '50%', border: 'none', background: `radial-gradient(circle at 35% 30%, ${accent}, ${accent}cc)`, color: '#fff', cursor: 'pointer', boxShadow: `0 0 0 12px ${accent}22, 0 0 0 28px ${accent}11, 0 18px 40px ${accent}55`, display: 'grid', placeItems: 'center', alignContent: 'center', gap: 4 }}>
            <Icon name="play" size={44} w={2.4} fill="#fff" />
            <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: '.04em' }}>START</span>
          </button>
          <div style={{ marginTop: 28, fontSize: 14, color: muted, fontWeight: 600 }}>{route ? `${route.name} · ${route.km} km` : goal.dist ? `Goal ${goal.label}` : goal.time ? `Goal ${goal.label}` : 'No goal, just run'}</div>
        </div>
        <div style={{ margin: '0 16px', padding: 14, background: card, borderRadius: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 800 }}>
            <span>This week</span><span style={{ color: muted }}>21.6 km</span>
          </div>
          <svg viewBox="0 0 320 70" width="100%" aria-hidden="true" style={{ display: 'block', marginTop: 8 }}>
            {week.map((v, i) => (
              <g key={i}>
                <rect x={i * 46 + 8} y={48 - (v / wmax) * 44 - 1} width="28" height={Math.max(4, (v / wmax) * 44)} rx="6" fill={v ? accent : '#e7e4dc'} />
                <text x={i * 46 + 22} y="66" textAnchor="middle" fontSize="10" fill={muted} fontWeight="700">{'MTWTFSS'[i]}</text>
              </g>
            ))}
          </svg>
        </div>
        <button type="button" onClick={() => push({ id: 'summary', r: runs[0] })} style={{ display: 'flex', alignItems: 'center', gap: 12, width: 'calc(100% - 32px)', margin: '10px 16px 0', padding: 12, border: 'none', borderRadius: 20, background: card, color: ink, font: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
          <Thumb shape={runs[0].shape} accent={accent} size={46} />
          <span style={{ flex: 1 }}>
            <span style={{ display: 'block', fontSize: 12, color: muted, fontWeight: 700 }}>Last run</span>
            <span style={{ display: 'block', fontWeight: 800, fontSize: 15 }}>{km(runs[0].dist)} km · {mmss(runs[0].avg)} /km</span>
          </span>
          <Icon name="chev" size={18} color={muted} />
        </button>
      </>
    )
  }

  const phone = (
    <div style={{ position: 'relative', width: W, height: H, overflow: 'hidden', borderRadius: frame ? 46 : 0, background: bg, color: ink, fontFamily: "'Inter', -apple-system, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif", transition: 'background .3s' }}>
      <style>{`
        @keyframes rn-r { from { opacity: 0; transform: translateX(34px) } to { opacity: 1; transform: none } }
        @keyframes rn-l { from { opacity: 0; transform: translateX(-34px) } to { opacity: 1; transform: none } }
        @keyframes rn-cd { from { transform: scale(1.7); opacity: 0 } 25% { opacity: 1 } to { transform: scale(.8); opacity: .9 } }
        .rn-scroll { scrollbar-width: none } .rn-scroll::-webkit-scrollbar { display: none }
        .rn-app button:focus-visible { outline: 2px solid ${accent}; outline-offset: 2px }
        @media (prefers-reduced-motion: reduce) { .rn-app *, .rn-app *::before { animation-duration: .01ms !important; transition-duration: .01ms !important } }
      `}</style>
      <StatusBar frame={frame} color={ink} />
      <div key={`${tab}/${stack.map((s) => s.id).join('/')}`} className="rn-scroll" style={{ position: 'absolute', top: 54, bottom: tabbed ? 88 : 0, left: 0, right: 0, overflowY: 'auto', paddingBottom: tabbed ? 24 : 16, animation: `${dir > 0 ? 'rn-r' : 'rn-l'} .28s ease` }}>
        {body}
      </div>
      {tabbed && (
        <nav aria-label="Main" style={{ position: 'absolute', left: 14, right: 14, bottom: 22, height: 62, background: '#1a1a1f', borderRadius: 31, display: 'flex', justifyContent: 'space-around', alignItems: 'center', padding: '0 8px', boxShadow: '0 10px 28px rgba(26,26,31,.3)' }}>
          {NAV.map(([id, icon, label]) => (
            <button key={id} type="button" onClick={() => go(id)} aria-current={tab === id ? 'page' : undefined} style={{ border: 'none', font: 'inherit', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, height: 46, padding: '0 18px', borderRadius: 23, fontSize: 13, fontWeight: 800, background: tab === id ? accent : 'transparent', color: tab === id ? '#fff' : '#a9acb5' }}>
              <Icon name={icon} size={21} />
              {tab === id && label}
            </button>
          ))}
        </nav>
      )}
      {cd != null && (
        <div role="alert" style={{ position: 'absolute', inset: 0, zIndex: 40, background: accent, display: 'grid', placeItems: 'center', color: '#fff' }}>
          <div key={cd} style={{ fontSize: 170, fontWeight: 800, letterSpacing: '-.05em', animation: 'rn-cd .9s ease-out' }}>{cd}</div>
          <button type="button" onClick={() => setCd(null)} style={{ position: 'absolute', bottom: 70, border: '2px solid rgba(255,255,255,.7)', background: 'transparent', color: '#fff', font: 'inherit', fontWeight: 800, fontSize: 14, padding: '10px 26px', borderRadius: 24, cursor: 'pointer' }}>Cancel</button>
        </div>
      )}
      <div role="status" style={{ position: 'absolute', left: '50%', top: 58, zIndex: 50, transform: `translate(-50%, ${toast ? 0 : -90}px)`, transition: 'transform .35s cubic-bezier(.2,.8,.2,1)', padding: '10px 16px', borderRadius: 20, background: live ? '#fff' : '#1a1a1f', color: live ? '#1a1a1f' : '#fff', fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap' }}>{toast}</div>
      <div style={{ position: 'absolute', left: '50%', bottom: 8, width: 140, height: 5, marginLeft: -70, borderRadius: 3, background: ink, opacity: 0.8, zIndex: 45 }} />
    </div>
  )

  return (
    <div ref={box} className="rn-app" style={{ position: 'relative', width: '100%', height: '100%', display: 'grid', placeItems: 'center', overflow: 'hidden', background: 'radial-gradient(ellipse at 50% 30%, #f6ede4, #d8c9b8 80%)', ...style }}>
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: `translate(-50%, -50%) scale(${scale})`, transformOrigin: 'center' }}>
        {frame ? (
          <div style={{ padding: 12, borderRadius: 58, background: 'linear-gradient(145deg, #3a3f4a, #14171d 40%, #2b2f38)', boxShadow: '0 40px 80px rgba(60,40,20,.35), inset 0 0 0 2px #4b515e' }}>
            <div style={{ padding: 2, borderRadius: 48, background: '#000' }}>{phone}</div>
          </div>
        ) : (
          phone
        )}
      </div>
    </div>
  )
}
