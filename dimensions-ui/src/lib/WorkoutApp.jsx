import { useEffect, useRef, useState } from 'react'

// A workout tracker on a phone, as a click-through prototype (dark UI).
// Today shows the planned session; tap Start and the Workout tab runs it for
// real: a session clock ticks, each exercise has a set counter, tapping "Log
// set" records the reps and weight from the steppers and starts a rest ring
// that counts down (Skip or +15s), and when an exercise is done the app
// advances to the next one. Finishing shows a summary and adds the session to
// History, whose weekly volume bars update. Each exercise opens a detail page
// with an animated SVG form diagram and a chart of past top sets. Settings has
// the kg/lb toggle, which converts every weight in the app. The phone scales
// to fit its container.

const W = 390
const H = 844
const BG = '#0d0e11'
const CARD = '#171a1f'
const CARD2 = '#20242b'
const LINE = '#2a2f38'
const INK = '#f1f3f6'
const MUTED = '#8b94a3'
const LB = 2.20462

const PLAN = [
  { id: 'bench', name: 'Barbell Bench Press', short: 'Bench Press', muscle: 'Chest · Triceps', sets: 3, reps: 8, w: 60, kind: 'lying', cues: ['Shoulder blades pinched, feet planted', 'Lower the bar to mid-chest', 'Press up and slightly back over the shoulders'] },
  { id: 'incline', name: 'Incline Dumbbell Press', short: 'Incline DB Press', muscle: 'Upper chest · Shoulders', sets: 3, reps: 10, w: 22, kind: 'incline', cues: ['Bench at 30 degrees', 'Elbows about 45 degrees from the torso', 'Control the way down for two seconds'] },
  { id: 'ohp', name: 'Standing Overhead Press', short: 'Overhead Press', muscle: 'Shoulders · Triceps', sets: 3, reps: 8, w: 40, kind: 'stand', cues: ['Squeeze glutes, ribs down', 'Bar path travels close to the face', 'Finish with biceps by the ears'] },
  { id: 'fly', name: 'Cable Fly', short: 'Cable Fly', muscle: 'Chest', sets: 3, reps: 12, w: 15, kind: 'lying', cues: ['Soft bend in the elbows', 'Hug a tree, hands meet in front', 'Pause and squeeze at the middle'] },
]
const HIST0 = { bench: [52.5, 55, 55, 57.5, 60, 60], incline: [18, 20, 20, 22, 22, 22], ohp: [32.5, 35, 35, 37.5, 40, 40], fly: [10, 12.5, 12.5, 15, 15, 15] }
const WEEKS0 = [18200, 21400, 19800, 23100, 22600, 24800, 20900, 6200]
const WEEK_LABELS = ['W38', 'W39', 'W40', 'W41', 'W42', 'W43', 'W44', 'This']
const SEED_SESSIONS = [
  { id: 's1', name: 'Pull B', date: 'Tue 11 Nov', dur: 52, vol: 6200, lines: [{ n: 'Barbell Row', sets: [{ reps: 8, w: 60 }, { reps: 8, w: 60 }, { reps: 7, w: 60 }] }, { n: 'Lat Pulldown', sets: [{ reps: 10, w: 50 }, { reps: 10, w: 50 }] }] },
  { id: 's2', name: 'Push A', date: 'Sat 8 Nov', dur: 58, vol: 7480, lines: [{ n: 'Bench Press', sets: [{ reps: 8, w: 60 }, { reps: 8, w: 60 }, { reps: 7, w: 60 }] }, { n: 'Overhead Press', sets: [{ reps: 8, w: 40 }, { reps: 8, w: 40 }, { reps: 6, w: 40 }] }] },
  { id: 's3', name: 'Legs', date: 'Thu 6 Nov', dur: 64, vol: 11200, lines: [{ n: 'Back Squat', sets: [{ reps: 5, w: 90 }, { reps: 5, w: 90 }, { reps: 5, w: 90 }] }, { n: 'Romanian Deadlift', sets: [{ reps: 8, w: 80 }, { reps: 8, w: 80 }] }] },
  { id: 's4', name: 'Push A', date: 'Mon 3 Nov', dur: 55, vol: 7050, lines: [{ n: 'Bench Press', sets: [{ reps: 8, w: 57.5 }, { reps: 8, w: 57.5 }, { reps: 8, w: 57.5 }] }] },
]

const ICONS = {
  today: 'M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM4 10h16M9 4V2m6 2V2',
  bell: 'M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4',
  dumb: 'M3 9v6M6 6v12M18 6v12M21 9v6M6 12h12',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12l2-1-2-4-2 1-2-2 1-2-4-1-1 2h-2L8 3 4 4l1 2-2 2-2-1-1 4 2 1v2l-2 1 1 4 2-1 2 2-1 2 4 1 1-2h2l1 2 4-1-1-2 2-2 2 1 1-4-2-1z',
  back: 'M15 5l-7 7 7 7',
  chev: 'M9 5l7 7-7 7',
  check: 'M5 12l5 5 9-10',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  play: 'M7 4l13 8-13 8z',
  flame: 'M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-4-1-6 1-9z',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h.01',
  trophy: 'M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8',
}

function Icon({ name, size = 22, color = 'currentColor', w = 1.9 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  )
}

const mmss = (s) => {
  s = Math.max(0, Math.floor(s))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}
const fmtW = (kg, unit) => (unit === 'kg' ? String(Math.round(kg * 2) / 2) : String(Math.round(kg * LB)))
const fmtVol = (kg, unit) => Math.round(unit === 'kg' ? kg : kg * LB).toLocaleString('en-US')
const stepW = (kg, dir, unit) => Math.max(0, unit === 'kg' ? kg + dir * 2.5 : (Math.round(kg * LB) + dir * 5) / LB)

function StatusBar({ frame }) {
  const clock = new Date().toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' })
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20, height: 54, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 30px 0 36px', fontSize: 16, fontWeight: 600, color: INK, pointerEvents: 'none' }}>
      <span>{clock}</span>
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

function Ring({ pct, size = 190, stroke = 12, color, children }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={LINE} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(1, pct)))} style={{ transition: 'stroke-dashoffset .25s linear' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>{children}</div>
    </div>
  )
}

function Stepper({ label, value, unit, onDec, onInc, accent }) {
  const b = { width: 52, height: 52, borderRadius: 16, border: 'none', background: CARD2, color: INK, display: 'grid', placeItems: 'center', cursor: 'pointer', padding: 0 }
  return (
    <div style={{ flex: 1, background: CARD, borderRadius: 22, padding: '12px 12px 14px', textAlign: 'center' }}>
      <div style={{ fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: MUTED, fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 38, fontWeight: 800, letterSpacing: '-.03em', margin: '4px 0 8px', color: accent, fontVariantNumeric: 'tabular-nums' }}>
        {value}
        <span style={{ fontSize: 14, color: MUTED, fontWeight: 600, marginLeft: 3 }}>{unit}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
        <button type="button" aria-label={`Decrease ${label}`} onClick={onDec} style={b}><Icon name="minus" size={22} /></button>
        <button type="button" aria-label={`Increase ${label}`} onClick={onInc} style={b}><Icon name="plus" size={22} /></button>
      </div>
    </div>
  )
}

// SVG form diagram: a stick figure whose arms move between two phases.
function FormDiagram({ kind, phase, accent }) {
  const hand = kind === 'stand' ? (phase ? { x: 130, y: 20 } : { x: 124, y: 78 }) : phase ? { x: 112, y: 58 } : { x: 112, y: 106 }
  const sh = kind === 'stand' ? { x: 150, y: 84 } : { x: 112, y: 120 }
  const el = kind === 'stand' ? (phase ? { x: 126, y: 52 } : { x: 112, y: 104 }) : { x: sh.x + (phase ? 2 : 22), y: (sh.y + hand.y) / 2 }
  const arm = `M${sh.x} ${sh.y} L${el.x} ${el.y} L${hand.x} ${hand.y}`
  const arm2 = kind === 'stand' ? `M${sh.x} ${sh.y} L${300 - el.x} ${el.y} L${300 - hand.x} ${hand.y}` : null
  const down = kind === 'stand' ? { x: 124, y: 78 } : { x: 112, y: 106 }
  const up = kind === 'stand' ? { x: 130, y: 20 } : { x: 112, y: 58 }
  const body = { stroke: INK, strokeWidth: 6, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' }
  return (
    <svg viewBox="0 0 300 190" width="100%" role="img" aria-label={`${kind === 'stand' ? 'Standing' : 'Lying'} form diagram, ${phase ? 'top' : 'bottom'} position`} style={{ display: 'block' }}>
      <rect width="300" height="190" rx="20" fill={CARD} />
      <line x1="20" y1="176" x2="280" y2="176" stroke={LINE} strokeWidth="2" />
      <g transform={kind === 'incline' ? 'rotate(-18 150 130)' : undefined}>
        {kind === 'stand' ? (
          <>
            <circle cx="150" cy="50" r="12" fill={INK} />
            <path d="M150 64 L150 124 M150 124 L138 174 M150 124 L162 174" {...body} />
            <path d={arm} {...body} stroke={accent} />
            <path d={arm2} {...body} stroke={accent} opacity=".6" />
            <line x1={hand.x - 6} y1={hand.y} x2={300 - hand.x + 6} y2={hand.y} stroke={MUTED} strokeWidth="4" strokeLinecap="round" />
            <circle cx={hand.x - 12} cy={hand.y} r="9" fill={accent} />
            <circle cx={300 - hand.x + 12} cy={hand.y} r="9" fill={accent} />
          </>
        ) : (
          <>
            <rect x="60" y="132" width="190" height="10" rx="4" fill={LINE} />
            <path d="M70 176 V142 M240 176 V142" stroke={LINE} strokeWidth="6" />
            <circle cx="80" cy="116" r="12" fill={INK} />
            <path d="M94 122 L190 124 L224 134 L224 174" {...body} />
            <path d={arm} {...body} stroke={accent} />
            {kind === 'lying' && sh.x ? <circle cx={hand.x} cy={hand.y} r="15" fill="none" stroke={accent} strokeWidth="5" /> : <circle cx={hand.x} cy={hand.y} r="12" fill="none" stroke={accent} strokeWidth="5" />}
            <circle cx={hand.x} cy={hand.y} r="3" fill={accent} />
          </>
        )}
        <path d={`M${up.x + 40} ${up.y} L${down.x + 40} ${down.y}`} stroke={MUTED} strokeWidth="2" strokeDasharray="4 5" fill="none" />
        <path d={`M${down.x + 40} ${down.y} l-4 -9 m4 9 l4 -9`} stroke={MUTED} strokeWidth="2" fill="none" strokeLinecap="round" />
      </g>
      <text x="284" y="26" textAnchor="end" fontSize="12" fontWeight="700" fill={MUTED}>{phase ? 'TOP' : 'BOTTOM'}</text>
    </svg>
  )
}

function LineChart({ data, unit, accent }) {
  const vals = data.map((d) => (unit === 'kg' ? d : d * LB))
  const lo = Math.min(...vals) * 0.92
  const hi = Math.max(...vals) * 1.04
  const x = (i) => 28 + (i * 262) / Math.max(1, vals.length - 1)
  const y = (v) => 120 - ((v - lo) / (hi - lo || 1)) * 92
  return (
    <svg viewBox="0 0 320 150" width="100%" role="img" aria-label="Top set weight per session" style={{ display: 'block' }}>
      {[0, 1, 2].map((i) => <line key={i} x1="14" x2="306" y1={28 + i * 46} y2={28 + i * 46} stroke={LINE} strokeDasharray="3 5" />)}
      <path d={`${vals.map((v, i) => `${i ? 'L' : 'M'}${x(i)} ${y(v)}`).join(' ')} L${x(vals.length - 1)} 132 L${x(0)} 132 Z`} fill={accent} opacity=".12" />
      <path d={vals.map((v, i) => `${i ? 'L' : 'M'}${x(i)} ${y(v)}`).join(' ')} fill="none" stroke={accent} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      {vals.map((v, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(v)} r="4.5" fill={BG} stroke={accent} strokeWidth="2.5" />
          <text x={x(i)} y={y(v) - 10} textAnchor="middle" fontSize="10.5" fill={INK} fontWeight="700">{Math.round(v * 2) / 2}</text>
          <text x={x(i)} y="146" textAnchor="middle" fontSize="10" fill={MUTED}>{i === vals.length - 1 ? 'Last' : `-${vals.length - 1 - i}`}</text>
        </g>
      ))}
    </svg>
  )
}

const mkSession = (back = 0) => ({ start: Date.now() - back, exIdx: 0, logs: {}, draft: {}, rest: null, endedAt: null, committed: false })

// ---------------------------------------------------------------- app

export default function WorkoutApp({ name = 'Forge', accent = '#c8f542', startScreen = 'today', frame = true, style }) {
  const box = useRef()
  const toastTimer = useRef()
  const [scale, setScale] = useState(1)
  const [tab, setTab] = useState('today')
  const [stack, setStack] = useState([])
  const [dir, setDir] = useState(1)
  const [toast, setToast] = useState('')
  const [unit, setUnit] = useState('kg')
  const [restSec, setRestSec] = useState(90)
  const [auto, setAuto] = useState(true)
  const [haptics, setHaptics] = useState(true)
  const [sess, setSess] = useState(null)
  const [now, setNow] = useState(() => Date.now())
  const [sessions, setSessions] = useState(SEED_SESSIONS)
  const [weeks, setWeeks] = useState(WEEKS0)
  const [hist, setHist] = useState(HIST0)
  const [selWeek, setSelWeek] = useState(7)
  const [phase, setPhase] = useState(0)
  const ink = '#10130a'

  // jump to a page when startScreen changes
  useEffect(() => {
    if (startScreen === 'workout') {
      const s = mkSession(12 * 60000 + 14000)
      s.logs = { bench: [{ reps: 8, w: 60 }, { reps: 8, w: 60 }] }
      setSess(s)
      setTab('workout')
      setStack([])
    } else if (startScreen === 'exercise') {
      setTab('today')
      setStack([{ id: 'exercise', exId: 'bench' }])
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

  const running = !!sess && !sess.endedAt
  useEffect(() => {
    if (!running) return undefined
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [running])

  // auto-play the form diagram unless the user prefers reduced motion
  const topId = stack[stack.length - 1]?.id
  useEffect(() => {
    if (topId !== 'exercise') return undefined
    if (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined
    const id = setInterval(() => setPhase((p) => 1 - p), 1300)
    return () => clearInterval(id)
  }, [topId])

  useEffect(() => () => clearTimeout(toastTimer.current), [])
  const say = (t) => {
    setToast(t)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 1900)
  }

  const NAV = [['today', 'today', 'Today'], ['workout', 'dumb', 'Workout'], ['history', 'clock', 'History'], ['settings', 'gear', 'Settings']]
  const top = stack[stack.length - 1]
  const push = (s) => (setDir(1), setStack((a) => [...a, s]))
  const pop = () => (setDir(-1), setStack((a) => a.slice(0, -1)))
  const go = (t) => (setDir(NAV.findIndex((n) => n[0] === t) >= NAV.findIndex((n) => n[0] === tab) ? 1 : -1), setTab(t), setStack([]))

  // ---- session logic
  const endRest = () =>
    setSess((s) => {
      if (!s || !s.rest) return s
      const adv = s.rest.advance && s.exIdx < PLAN.length - 1
      return { ...s, rest: null, exIdx: adv ? s.exIdx + 1 : s.exIdx }
    })
  const restLeft = sess?.rest ? Math.max(0, Math.ceil((sess.rest.end - now) / 1000)) : 0
  useEffect(() => {
    if (sess?.rest && now >= sess.rest.end) endRest()
  }, [now]) // eslint-disable-line react-hooks/exhaustive-deps

  const startSession = () => {
    setSess(mkSession())
    setNow(Date.now())
    setDir(1)
    setTab('workout')
    setStack([])
    say('Session started. Good luck!')
  }

  const draftOf = (ex) => (sess && sess.draft[ex.id]) || { reps: ex.reps, w: ex.w }
  const setDraft = (ex, patch) => setSess((s) => ({ ...s, draft: { ...s.draft, [ex.id]: { ...draftOf(ex), ...patch } } }))

  const finishSession = (over) => {
    const s = over || sess
    const lines = PLAN.filter((e) => (s.logs[e.id] || []).length).map((e) => ({ n: e.short, sets: s.logs[e.id], id: e.id }))
    if (!lines.length) {
      setSess(null)
      say('Workout discarded')
      return
    }
    const endedAt = Date.now()
    const vol = lines.reduce((a, l) => a + l.sets.reduce((b, x) => b + x.reps * x.w, 0), 0)
    const dur = Math.max(1, Math.round((endedAt - s.start) / 60000))
    const prs = lines.filter((l) => Math.max(...l.sets.map((x) => x.w)) > Math.max(...hist[l.id])).map((l) => l.n)
    const rec = { id: `s${endedAt}`, name: 'Push A', date: 'Today', dur, vol, lines }
    setSess({ ...s, endedAt, rest: null, committed: true, result: { vol, dur, sets: lines.reduce((a, l) => a + l.sets.length, 0), prs, lines } })
    setSessions((a) => [rec, ...a])
    setWeeks((w) => w.map((v, i) => (i === w.length - 1 ? v + vol : v)))
    setHist((h) => {
      const n = { ...h }
      lines.forEach((l) => (n[l.id] = [...h[l.id], Math.max(...l.sets.map((x) => x.w))]))
      return n
    })
    setDir(1)
    setStack([{ id: 'summary' }])
  }

  const logSet = () => {
    const ex = PLAN[sess.exIdx]
    const d = draftOf(ex)
    const done = (sess.logs[ex.id] || []).length
    if (done >= ex.sets) return
    const last = sess.exIdx === PLAN.length - 1 && done + 1 === ex.sets
    const logs = { ...sess.logs, [ex.id]: [...(sess.logs[ex.id] || []), { reps: d.reps, w: d.w }] }
    if (last) {
      // finish inline using updated logs
      finishSession({ ...sess, logs })
      return
    }
    const complete = done + 1 === ex.sets
    setSess({ ...sess, logs, rest: { end: Date.now() + restSec * 1000, total: restSec, advance: complete && auto } })
    setNow(Date.now())
    say(`Set ${done + 1} logged: ${d.reps} x ${fmtW(d.w, unit)}${unit}`)
  }

  const Back = ({ onClick }) => (
    <button type="button" onClick={onClick} aria-label="Back" style={{ width: 38, height: 38, borderRadius: '50%', border: 'none', background: CARD, color: INK, display: 'grid', placeItems: 'center', cursor: 'pointer', padding: 0 }}>
      <Icon name="back" size={20} />
    </button>
  )
  const header = (title, back, right) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 18px 8px', minHeight: 52 }}>
      {back && <Back onClick={back} />}
      <h1 style={{ margin: 0, flex: 1, fontSize: back ? 18 : 28, fontWeight: 800, letterSpacing: '-0.02em' }}>{title}</h1>
      {right}
    </div>
  )
  const bigBtn = (label, onClick, opts = {}) => (
    <button type="button" onClick={onClick} style={{ width: '100%', height: 56, borderRadius: 18, border: opts.ghost ? `1.5px solid ${LINE}` : 'none', background: opts.ghost ? 'transparent' : accent, color: opts.ghost ? INK : ink, font: 'inherit', fontSize: 16, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
      {opts.icon && <Icon name={opts.icon} size={20} />}
      {label}
    </button>
  )
  const toggle = (on, set, label) => (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => set(!on)} style={{ width: 48, height: 28, borderRadius: 14, border: 'none', padding: 3, background: on ? accent : LINE, cursor: 'pointer', transition: 'background .2s', flex: 'none' }}>
      <span style={{ display: 'block', width: 22, height: 22, borderRadius: '50%', background: on ? ink : '#fff', transform: `translateX(${on ? 20 : 0}px)`, transition: 'transform .2s' }} />
    </button>
  )
  const stat = (v, l) => (
    <div style={{ flex: 1, background: CARD, borderRadius: 18, padding: '12px 8px', textAlign: 'center' }}>
      <div style={{ fontSize: 20, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{v}</div>
      <div style={{ fontSize: 11, color: MUTED, marginTop: 2, fontWeight: 600 }}>{l}</div>
    </div>
  )

  const exRow = (e, i) => {
    const done = sess ? (sess.logs[e.id] || []).length : 0
    return (
      <button key={e.id} type="button" onClick={() => push({ id: 'exercise', exId: e.id })} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '12px 14px', border: 'none', borderRadius: 18, background: CARD, font: 'inherit', textAlign: 'left', cursor: 'pointer', color: INK }}>
        <span style={{ width: 38, height: 38, borderRadius: 12, display: 'grid', placeItems: 'center', background: done >= e.sets ? accent : CARD2, color: done >= e.sets ? ink : accent, fontWeight: 800, fontSize: 15 }}>{done >= e.sets ? <Icon name="check" size={20} w={2.6} /> : i + 1}</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 15, fontWeight: 700 }}>{e.short}</span>
          <span style={{ display: 'block', fontSize: 12, color: MUTED, marginTop: 2 }}>{e.sets} x {e.reps} · {fmtW(e.w, unit)}{unit}{sess ? ` · ${done}/${e.sets} done` : ''}</span>
        </span>
        <Icon name="chev" size={18} color={MUTED} />
      </button>
    )
  }

  // ---- screens
  let body
  let tabbed = true
  if (top?.id === 'exercise') {
    tabbed = false
    const e = PLAN.find((x) => x.id === top.exId)
    const h = hist[e.id]
    body = (
      <>
        {header(e.short, pop)}
        <div style={{ padding: '0 18px' }}>
          <FormDiagram kind={e.kind} phase={phase} accent={accent} />
          <div style={{ display: 'flex', gap: 8, margin: '10px 0 14px' }}>
            {['Bottom', 'Top'].map((l, i) => (
              <button key={l} type="button" aria-pressed={phase === i} onClick={() => setPhase(i)} style={{ flex: 1, height: 38, borderRadius: 12, border: 'none', background: phase === i ? accent : CARD, color: phase === i ? ink : INK, font: 'inherit', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>{l} position</button>
            ))}
          </div>
          <div style={{ fontSize: 12, color: MUTED, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 8 }}>{e.muscle}</div>
          <div style={{ background: CARD, borderRadius: 20, padding: '6px 16px', marginBottom: 14 }}>
            {e.cues.map((c, i) => (
              <div key={c} style={{ display: 'flex', gap: 12, padding: '11px 0', borderBottom: i < e.cues.length - 1 ? `1px solid ${LINE}` : 'none', fontSize: 14 }}>
                <span style={{ color: accent, fontWeight: 800 }}>{i + 1}</span>{c}
              </div>
            ))}
          </div>
          <div style={{ background: CARD, borderRadius: 20, padding: '14px 12px 8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 6px 6px', fontSize: 13, fontWeight: 700 }}>
              <span>Top set history</span>
              <span style={{ color: MUTED }}>{unit}</span>
            </div>
            <LineChart data={h.slice(-6)} unit={unit} accent={accent} />
          </div>
          <div style={{ marginTop: 14 }}>{bigBtn(sess && running ? 'Back to workout' : 'Start session', () => (sess && running ? go('workout') : startSession()), { icon: 'play' })}</div>
        </div>
      </>
    )
  } else if (top?.id === 'summary') {
    tabbed = false
    const r = sess.result
    body = (
      <>
        <div style={{ textAlign: 'center', padding: '16px 24px 8px' }}>
          <span style={{ width: 84, height: 84, borderRadius: '50%', display: 'inline-grid', placeItems: 'center', background: accent, color: ink, animation: 'wk-pop .5s cubic-bezier(.2,1.4,.4,1)' }}>
            <Icon name="check" size={46} w={3} />
          </span>
          <h1 style={{ margin: '14px 0 2px', fontSize: 28, fontWeight: 800, letterSpacing: '-.02em' }}>Workout done</h1>
          <div style={{ color: MUTED, fontSize: 14 }}>Push A · {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, padding: '10px 18px' }}>
          {stat(`${r.dur}m`, 'Duration')}
          {stat(r.sets, 'Sets')}
          {stat(`${fmtVol(r.vol, unit)}`, `Volume ${unit}`)}
        </div>
        {r.prs.length > 0 && (
          <div style={{ margin: '0 18px 10px', padding: 14, borderRadius: 18, background: `${accent}22`, border: `1px solid ${accent}66`, display: 'flex', gap: 10, alignItems: 'center', color: accent, fontWeight: 700, fontSize: 14 }}>
            <Icon name="trophy" size={22} /> New top set: {r.prs.join(', ')}
          </div>
        )}
        <div style={{ margin: '0 18px', background: CARD, borderRadius: 20, padding: '6px 16px' }}>
          {r.lines.map((l, i) => (
            <div key={l.id} style={{ padding: '11px 0', borderBottom: i < r.lines.length - 1 ? `1px solid ${LINE}` : 'none' }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{l.n}</div>
              <div style={{ color: MUTED, fontSize: 12.5, marginTop: 3 }}>{l.sets.map((x) => `${x.reps} x ${fmtW(x.w, unit)}`).join('  ·  ')} {unit}</div>
            </div>
          ))}
        </div>
        <div style={{ padding: '16px 18px' }}>
          {bigBtn('Done', () => (setSess(null), setDir(1), setTab('history'), setStack([]), setSelWeek(7), say('Saved to History')))}
        </div>
      </>
    )
  } else if (top?.id === 'session') {
    tabbed = false
    const s = top.s
    body = (
      <>
        {header(s.name, pop)}
        <div style={{ display: 'flex', gap: 8, padding: '4px 18px 10px' }}>
          {stat(s.date, 'Date')}
          {stat(`${s.dur}m`, 'Duration')}
          {stat(fmtVol(s.vol, unit), `Volume ${unit}`)}
        </div>
        <div style={{ margin: '0 18px', background: CARD, borderRadius: 20, padding: '6px 16px' }}>
          {s.lines.map((l, i) => (
            <div key={l.n} style={{ padding: '12px 0', borderBottom: i < s.lines.length - 1 ? `1px solid ${LINE}` : 'none' }}>
              <div style={{ fontWeight: 700, fontSize: 14.5 }}>{l.n}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {l.sets.map((x, j) => <span key={j} style={{ padding: '4px 10px', borderRadius: 10, background: CARD2, fontSize: 12.5, fontWeight: 600 }}>{x.reps} x {fmtW(x.w, unit)}{unit}</span>)}
              </div>
            </div>
          ))}
        </div>
      </>
    )
  } else if (tab === 'today') {
    const p = running ? PLAN.reduce((a, e) => a + Math.min((sess.logs[e.id] || []).length, e.sets), 0) : 0
    const total = PLAN.reduce((a, e) => a + e.sets, 0)
    body = (
      <>
        <div style={{ padding: '8px 22px 0', color: MUTED, fontSize: 13, fontWeight: 600 }}>{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        {header(`Hey, ${name}`, null, <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: accent, fontWeight: 800, fontSize: 14 }}><Icon name="flame" size={18} /> 5 day streak</span>)}
        <div style={{ margin: '4px 18px 14px', padding: 18, borderRadius: 26, background: `linear-gradient(135deg, ${accent}, #7bd84a)`, color: ink, position: 'relative', overflow: 'hidden' }}>
          <svg width="150" height="150" viewBox="0 0 24 24" style={{ position: 'absolute', right: -24, top: -10, opacity: 0.18 }} fill="none" stroke={ink} strokeWidth="1.6" strokeLinecap="round"><path d={ICONS.dumb} /></svg>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', opacity: 0.7 }}>Planned today</div>
          <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-.03em', margin: '2px 0' }}>Push A</div>
          <div style={{ fontSize: 14, fontWeight: 600, opacity: 0.75 }}>{PLAN.length} exercises · {total} sets · about 55 min</div>
          <button type="button" onClick={running ? () => go('workout') : startSession} style={{ marginTop: 14, height: 48, padding: '0 22px', borderRadius: 24, border: 'none', background: ink, color: accent, font: 'inherit', fontWeight: 800, fontSize: 15, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Icon name="play" size={16} /> {running ? `Resume · ${p}/${total} sets` : 'Start workout'}
          </button>
        </div>
        <div style={{ padding: '0 18px', display: 'grid', gap: 8 }}>{PLAN.map(exRow)}</div>
        <div style={{ padding: '16px 18px 0' }}>
          <div style={{ fontSize: 13, color: MUTED, fontWeight: 700, margin: '0 4px 8px' }}>Last session</div>
          <button type="button" onClick={() => push({ id: 'session', s: sessions[0] })} style={{ display: 'flex', alignItems: 'center', width: '100%', padding: '14px', border: 'none', borderRadius: 18, background: CARD, color: INK, font: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
            <span style={{ flex: 1 }}>
              <span style={{ display: 'block', fontWeight: 700, fontSize: 15 }}>{sessions[0].name}</span>
              <span style={{ display: 'block', color: MUTED, fontSize: 12, marginTop: 2 }}>{sessions[0].date} · {sessions[0].dur} min</span>
            </span>
            <span style={{ fontWeight: 800 }}>{fmtVol(sessions[0].vol, unit)} {unit}</span>
          </button>
        </div>
      </>
    )
  } else if (tab === 'workout') {
    if (!sess || sess.endedAt) {
      body = (
        <>
          {header('Workout')}
          <div style={{ textAlign: 'center', padding: '50px 30px' }}>
            <span style={{ width: 96, height: 96, borderRadius: '50%', display: 'inline-grid', placeItems: 'center', background: CARD, color: accent }}><Icon name="dumb" size={44} /></span>
            <h2 style={{ margin: '18px 0 6px', fontSize: 22 }}>No session running</h2>
            <p style={{ margin: '0 0 22px', color: MUTED, fontSize: 14 }}>Start Push A to log sets and run rest timers.</p>
            {bigBtn('Start Push A', startSession, { icon: 'play' })}
          </div>
        </>
      )
    } else {
      const ex = PLAN[sess.exIdx]
      const logs = sess.logs[ex.id] || []
      const d = draftOf(ex)
      const resting = !!sess.rest
      const pct = resting ? restLeft / sess.rest.total : 0
      body = (
        <>
          <div style={{ display: 'flex', alignItems: 'center', padding: '8px 18px 0', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: MUTED, fontWeight: 700, letterSpacing: '.1em' }}>SESSION TIME</div>
              <div style={{ fontSize: 32, fontWeight: 800, fontVariantNumeric: 'tabular-nums', letterSpacing: '-.02em' }} aria-label="Session elapsed">{mmss((now - sess.start) / 1000)}</div>
            </div>
            <button type="button" onClick={() => finishSession()} style={{ height: 40, padding: '0 16px', borderRadius: 20, border: 'none', background: CARD, color: INK, font: 'inherit', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Finish</button>
          </div>
          <div style={{ display: 'flex', gap: 6, padding: '12px 18px 4px' }}>
            {PLAN.map((e, i) => {
              const dn = (sess.logs[e.id] || []).length
              return (
                <button key={e.id} type="button" aria-label={`Exercise ${i + 1}: ${e.short}`} onClick={() => setSess((s) => ({ ...s, exIdx: i, rest: null }))} style={{ flex: 1, border: 'none', background: 'none', padding: 0, cursor: 'pointer' }}>
                  <span style={{ display: 'block', height: 6, borderRadius: 3, background: i === sess.exIdx ? accent : dn >= e.sets ? `${accent}99` : LINE }} />
                  <span style={{ display: 'block', fontSize: 10.5, marginTop: 5, color: i === sess.exIdx ? INK : MUTED, fontWeight: 700 }}>{i + 1}. {e.short.split(' ')[0]}</span>
                </button>
              )
            })}
          </div>
          <div key={ex.id} style={{ padding: '10px 18px 0', animation: 'wk-r .3s ease' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.02em' }}>{ex.name}</div>
                <div style={{ fontSize: 13, color: MUTED, marginTop: 2 }}>{ex.muscle} · target {ex.sets} x {ex.reps}</div>
              </div>
              <button type="button" aria-label="Exercise details" onClick={() => push({ id: 'exercise', exId: ex.id })} style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', background: CARD, color: accent, display: 'grid', placeItems: 'center', cursor: 'pointer', padding: 0 }}><Icon name="info" size={20} /></button>
            </div>
            <div style={{ display: 'flex', gap: 10, margin: '16px 0' }} role="list" aria-label="Sets">
              {Array.from({ length: ex.sets }, (_, i) => {
                const l = logs[i]
                const cur = i === logs.length
                return (
                  <div key={i} role="listitem" style={{ flex: 1, height: 74, borderRadius: 18, display: 'grid', placeItems: 'center', alignContent: 'center', background: l ? accent : CARD, color: l ? ink : cur ? INK : MUTED, border: cur && !resting ? `2px solid ${accent}` : '2px solid transparent', fontWeight: 800 }}>
                    {l ? (
                      <>
                        <Icon name="check" size={20} w={3} />
                        <span style={{ fontSize: 12, marginTop: 2 }}>{l.reps} x {fmtW(l.w, unit)}</span>
                      </>
                    ) : (
                      <>
                        <span style={{ fontSize: 20 }}>{i + 1}</span>
                        <span style={{ fontSize: 11, fontWeight: 600 }}>{cur ? 'next' : 'set'}</span>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
            {resting ? (
              <div style={{ display: 'grid', justifyItems: 'center', gap: 14, animation: 'wk-pop .3s ease' }}>
                <Ring pct={pct} size={196} stroke={13} color={accent}>
                  <div>
                    <div style={{ fontSize: 11, color: MUTED, fontWeight: 700, letterSpacing: '.12em' }}>REST</div>
                    <div style={{ fontSize: 48, fontWeight: 800, fontVariantNumeric: 'tabular-nums', letterSpacing: '-.03em' }} role="timer">{mmss(restLeft)}</div>
                    <div style={{ fontSize: 12, color: MUTED }}>{sess.rest.advance ? `Next: ${PLAN[Math.min(sess.exIdx + 1, PLAN.length - 1)].short}` : `Set ${logs.length + 1} up next`}</div>
                  </div>
                </Ring>
                <div style={{ display: 'flex', gap: 10, width: '100%' }}>
                  <button type="button" onClick={() => setSess((s) => ({ ...s, rest: { ...s.rest, end: s.rest.end + 15000, total: s.rest.total + 15 } }))} style={{ flex: 1, height: 50, borderRadius: 16, border: 'none', background: CARD, color: INK, font: 'inherit', fontWeight: 800, fontSize: 15, cursor: 'pointer' }}>+15s</button>
                  <button type="button" onClick={endRest} style={{ flex: 1, height: 50, borderRadius: 16, border: 'none', background: accent, color: ink, font: 'inherit', fontWeight: 800, fontSize: 15, cursor: 'pointer' }}>Skip rest</button>
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 10 }}>
                  <Stepper label="Reps" value={d.reps} unit="" accent={accent} onDec={() => setDraft(ex, { reps: Math.max(1, d.reps - 1) })} onInc={() => setDraft(ex, { reps: d.reps + 1 })} />
                  <Stepper label="Weight" value={fmtW(d.w, unit)} unit={unit} accent={accent} onDec={() => setDraft(ex, { w: stepW(d.w, -1, unit) })} onInc={() => setDraft(ex, { w: stepW(d.w, 1, unit) })} />
                </div>
                <div style={{ marginTop: 14 }}>{bigBtn(logs.length >= ex.sets ? 'All sets done' : `Log set ${logs.length + 1} of ${ex.sets}`, logSet, { icon: 'check' })}</div>
                {logs.length >= ex.sets && sess.exIdx < PLAN.length - 1 && (
                  <div style={{ marginTop: 10 }}>{bigBtn('Next exercise', () => setSess((s) => ({ ...s, exIdx: s.exIdx + 1 })), { ghost: true })}</div>
                )}
              </>
            )}
          </div>
        </>
      )
    }
  } else if (tab === 'history') {
    const max = Math.max(...weeks)
    const sel = weeks[selWeek]
    body = (
      <>
        {header('History')}
        <div style={{ margin: '0 18px', background: CARD, borderRadius: 24, padding: 16 }}>
          <div style={{ fontSize: 12, color: MUTED, fontWeight: 700 }}>{selWeek === 7 ? 'This week' : `Week ${WEEK_LABELS[selWeek].slice(1)}`} volume</div>
          <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-.03em' }}>{fmtVol(sel, unit)} <span style={{ fontSize: 14, color: MUTED }}>{unit}</span></div>
          <svg viewBox="0 0 320 150" width="100%" role="img" aria-label="Weekly volume" style={{ display: 'block', marginTop: 8 }}>
            {weeks.map((v, i) => {
              const h = (v / max) * 100
              return (
                <g key={i} onClick={() => setSelWeek(i)} style={{ cursor: 'pointer' }} role="button" aria-label={`${WEEK_LABELS[i]}: ${fmtVol(v, unit)} ${unit}`}>
                  <rect x={i * 40 + 4} y="0" width="32" height="150" fill="transparent" />
                  <rect x={i * 40 + 6} y={126 - h} width="28" height={h} rx="7" fill={i === selWeek ? accent : '#3a414d'} style={{ transition: 'height .4s, y .4s, fill .2s' }} />
                  <text x={i * 40 + 20} y="144" textAnchor="middle" fontSize="10" fill={i === selWeek ? INK : MUTED} fontWeight="700">{WEEK_LABELS[i]}</text>
                </g>
              )
            })}
          </svg>
        </div>
        <div style={{ padding: '16px 18px 0', display: 'grid', gap: 8 }}>
          <div style={{ fontSize: 13, color: MUTED, fontWeight: 700, margin: '0 4px' }}>Sessions</div>
          {sessions.map((s) => (
            <button key={s.id} type="button" onClick={() => push({ id: 'session', s })} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: 14, border: 'none', borderRadius: 18, background: CARD, color: INK, font: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
              <span style={{ flex: 1 }}>
                <span style={{ display: 'block', fontWeight: 700, fontSize: 15 }}>{s.name}</span>
                <span style={{ display: 'block', color: MUTED, fontSize: 12, marginTop: 2 }}>{s.date} · {s.dur} min</span>
              </span>
              <span style={{ fontWeight: 800, fontSize: 14 }}>{fmtVol(s.vol, unit)} {unit}</span>
              <Icon name="chev" size={16} color={MUTED} />
            </button>
          ))}
        </div>
      </>
    )
  } else {
    body = (
      <>
        {header('Settings')}
        <div style={{ margin: '0 18px', background: CARD, borderRadius: 20, padding: '4px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: `1px solid ${LINE}` }}>
            <span style={{ fontWeight: 600, fontSize: 14.5 }}>Units</span>
            <span role="group" aria-label="Units" style={{ display: 'flex', padding: 3, borderRadius: 12, background: CARD2 }}>
              {['kg', 'lb'].map((u) => (
                <button key={u} type="button" aria-pressed={unit === u} onClick={() => (setUnit(u), say(`Weights shown in ${u}`))} style={{ width: 54, height: 32, border: 'none', borderRadius: 10, background: unit === u ? accent : 'transparent', color: unit === u ? ink : MUTED, font: 'inherit', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>{u}</button>
              ))}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: `1px solid ${LINE}` }}>
            <span style={{ fontWeight: 600, fontSize: 14.5 }}>Rest timer</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button type="button" aria-label="Shorter rest" onClick={() => setRestSec((r) => Math.max(15, r - 15))} style={{ width: 34, height: 34, borderRadius: 11, border: 'none', background: CARD2, color: INK, cursor: 'pointer', display: 'grid', placeItems: 'center', padding: 0 }}><Icon name="minus" size={18} /></button>
              <span style={{ width: 44, textAlign: 'center', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{mmss(restSec)}</span>
              <button type="button" aria-label="Longer rest" onClick={() => setRestSec((r) => Math.min(300, r + 15))} style={{ width: 34, height: 34, borderRadius: 11, border: 'none', background: CARD2, color: INK, cursor: 'pointer', display: 'grid', placeItems: 'center', padding: 0 }}><Icon name="plus" size={18} /></button>
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: `1px solid ${LINE}` }}>
            <span style={{ fontWeight: 600, fontSize: 14.5 }}>Auto-advance exercise</span>
            {toggle(auto, setAuto, 'Auto-advance')}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0' }}>
            <span style={{ fontWeight: 600, fontSize: 14.5 }}>Haptics and sound</span>
            {toggle(haptics, setHaptics, 'Haptics and sound')}
          </div>
        </div>
        <div style={{ padding: '16px 18px' }}>
          {bigBtn('Reset demo data', () => (setSessions(SEED_SESSIONS), setWeeks(WEEKS0), setHist(HIST0), setSess(null), setSelWeek(7), say('Demo reset')), { ghost: true })}
        </div>
      </>
    )
  }

  const phone = (
    <div style={{ position: 'relative', width: W, height: H, overflow: 'hidden', borderRadius: frame ? 46 : 0, background: BG, color: INK, fontFamily: "'Inter', -apple-system, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif" }}>
      <style>{`
        @keyframes wk-r { from { opacity: 0; transform: translateX(34px) } to { opacity: 1; transform: none } }
        @keyframes wk-l { from { opacity: 0; transform: translateX(-34px) } to { opacity: 1; transform: none } }
        @keyframes wk-pop { from { transform: scale(.6); opacity: 0 } to { transform: none; opacity: 1 } }
        .wk-scroll { scrollbar-width: none } .wk-scroll::-webkit-scrollbar { display: none }
        .wk-app button:focus-visible { outline: 2px solid ${accent}; outline-offset: 2px }
        @media (prefers-reduced-motion: reduce) { .wk-app *, .wk-app *::before { animation-duration: .01ms !important; transition-duration: .01ms !important } }
      `}</style>
      <StatusBar frame={frame} />
      <div key={`${tab}/${stack.map((s) => s.id).join('/')}`} className="wk-scroll" style={{ position: 'absolute', top: 54, bottom: tabbed ? 88 : 0, left: 0, right: 0, overflowY: 'auto', paddingBottom: 24, animation: `${dir > 0 ? 'wk-r' : 'wk-l'} .28s ease` }}>
        {body}
      </div>
      {tabbed && (
        <nav aria-label="Main" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 88, background: '#13151a', borderTop: `1px solid ${LINE}`, display: 'flex', justifyContent: 'space-around', padding: '10px 8px 0' }}>
          {NAV.map(([id, icon, label]) => (
            <button key={id} type="button" onClick={() => go(id)} aria-current={tab === id ? 'page' : undefined} style={{ position: 'relative', border: 'none', background: 'none', font: 'inherit', cursor: 'pointer', display: 'grid', justifyItems: 'center', alignContent: 'start', gap: 3, width: 72, height: 54, fontSize: 11, fontWeight: 700, color: tab === id ? accent : MUTED }}>
              <Icon name={icon} size={23} />
              {label}
              {id === 'workout' && running && <span style={{ position: 'absolute', top: 0, right: 18, width: 9, height: 9, borderRadius: '50%', background: accent }} />}
            </button>
          ))}
        </nav>
      )}
      <div role="status" style={{ position: 'absolute', left: '50%', top: 58, zIndex: 30, transform: `translate(-50%, ${toast ? 0 : -90}px)`, transition: 'transform .35s cubic-bezier(.2,.8,.2,1)', padding: '10px 16px', borderRadius: 20, background: INK, color: BG, fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap' }}>{toast}</div>
      <div style={{ position: 'absolute', left: '50%', bottom: 8, width: 140, height: 5, marginLeft: -70, borderRadius: 3, background: INK, opacity: 0.8, zIndex: 25 }} />
    </div>
  )

  return (
    <div ref={box} className="wk-app" style={{ position: 'relative', width: '100%', height: '100%', display: 'grid', placeItems: 'center', overflow: 'hidden', background: 'radial-gradient(ellipse at 50% 30%, #2a2f3a, #0a0b0e 80%)', ...style }}>
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: `translate(-50%, -50%) scale(${scale})`, transformOrigin: 'center' }}>
        {frame ? (
          <div style={{ padding: 12, borderRadius: 58, background: 'linear-gradient(145deg, #3a3f4a, #14171d 40%, #2b2f38)', boxShadow: '0 40px 80px rgba(0,0,0,.5), inset 0 0 0 2px #4b515e' }}>
            <div style={{ padding: 2, borderRadius: 48, background: '#000' }}>{phone}</div>
          </div>
        ) : (
          phone
        )}
      </div>
    </div>
  )
}
