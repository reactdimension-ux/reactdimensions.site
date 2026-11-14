import { useEffect, useRef, useState } from 'react'

// A sleep tracker on a phone, as a click-through prototype in a dark, starry
// night palette. Five tabs (Last night, Trends, Alarm, Sounds, Settings). Last
// night has a score ring, a tappable sleep-stage chart and stage rows that open
// a detail screen; you can log how you feel. Trends flips between week and
// month and each bar opens that night. Alarm has a real editable time (hours,
// minutes, AM/PM), repeat days, smart wake and a live "rings in" countdown.
// Sounds are selectable: tap one and it plays (animated bars, running clock,
// volume, sleep timer that really counts down and stops it) with a mini player
// that follows you across tabs. Detail screens slide in from the right. The
// phone scales to fit its box; animation respects prefers-reduced-motion.

const W = 390
const H = 844
const INK = '#eef0ff'
const MUTED = '#9aa0c8'
const BG = '#0c1030'
const PANEL = '#171c4a'
const FONT = "-apple-system, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif"

const STAGE = {
  awake: { label: 'Awake', color: '#f59e6b', lvl: 0, note: 'Brief wake-ups are normal. Most people wake 2 to 4 times a night without remembering.' },
  rem: { label: 'REM', color: '#c084fc', lvl: 1, note: 'Dreaming sleep. It supports memory and mood, and fills roughly a quarter of the night.' },
  light: { label: 'Light', color: '#7c8cff', lvl: 2, note: 'The gateway stage. Heart rate and temperature drop and the body prepares for deeper rest.' },
  deep: { label: 'Deep', color: '#3b5bdb', lvl: 3, note: 'Physical restoration. Hard to wake from, strongest in the first half of the night.' },
}
const NIGHT = [
  ['awake', 6], ['light', 28], ['deep', 52], ['light', 24], ['rem', 14], ['light', 30], ['deep', 38], ['light', 22], ['rem', 22],
  ['awake', 4], ['light', 36], ['deep', 20], ['light', 28], ['rem', 34], ['light', 26], ['awake', 8], ['light', 30], ['rem', 28], ['light', 20], ['awake', 5],
]
const BED_MIN = 23 * 60 + 20

const SOUNDS = [
  { id: 'rain', name: 'Soft rain', tag: 'Nature', a: '#4f6bd6', b: '#7fa2f0' },
  { id: 'ocean', name: 'Ocean waves', tag: 'Nature', a: '#2a8fb8', b: '#5fd0d6' },
  { id: 'forest', name: 'Night forest', tag: 'Nature', a: '#2e7a5a', b: '#7ccf9b' },
  { id: 'white', name: 'White noise', tag: 'Noise', a: '#6b7090', b: '#aab0d4' },
  { id: 'fire', name: 'Fireplace', tag: 'Cosy', a: '#c0562e', b: '#f2a65a' },
  { id: 'lull', name: 'Lullaby piano', tag: 'Music', a: '#8a4fc7', b: '#cf9bf0' },
]
const TIMERS = [['off', 'Off'], [15, '15 min'], [30, '30 min'], [60, '1 hour']]

const ICONS = {
  moon: 'M20 14.5A8.5 8.5 0 1 1 9.5 4 7 7 0 0 0 20 14.5z',
  chart: 'M5 20V10M12 20V4M19 20v-7',
  alarm: 'M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 9v4l2.5 1.5M4 6l3-3M20 6l-3-3',
  note: 'M9 18V6l10-2v12M9 18a3 3 0 1 1-3-3 3 3 0 0 1 3 3zm10-2a3 3 0 1 1-3-3 3 3 0 0 1 3 3z',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.4 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.4-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.2-.8.2-1.2z',
  back: 'M15 5l-7 7 7 7',
  chev: 'M9 5l7 7-7 7',
  up: 'M6 15l6-6 6 6',
  down: 'M6 9l6 6 6-6',
  plus: 'M12 5v14M5 12h14',
  x: 'M6 6l12 12M18 6L6 18',
  play: 'M8 5l11 7-11 7z',
  pause: 'M8 5v14M16 5v14',
  bulb: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z',
  heart: 'M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11z',
}

function Icon({ name, size = 22, color = 'currentColor', w = 1.9, fill = 'none' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  )
}

const iconBtn = { display: 'grid', placeItems: 'center', border: 'none', borderRadius: '50%', cursor: 'pointer', padding: 0, background: PANEL, color: INK }

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
          <rect x="0.5" y="0.5" width="22" height="11" rx="3.5" fill="none" stroke={INK} opacity=".5" />
          <rect x="2.5" y="2.5" width="16" height="7" rx="2" fill={INK} />
          <rect x="23.5" y="4" width="2" height="4" rx="1" fill={INK} opacity=".5" />
        </svg>
      </span>
    </div>
  )
}

const NAV = [
  ['last', 'moon', 'Last night'],
  ['trends', 'chart', 'Trends'],
  ['alarm', 'alarm', 'Alarm'],
  ['sounds', 'note', 'Sounds'],
  ['settings', 'gear', 'Settings'],
]
const PAGE_IDS = NAV.map((n) => n[0])

const dur = (m) => `${Math.floor(m / 60)}h ${String(Math.round(m % 60)).padStart(2, '0')}m`
const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// ---------------------------------------------------------------- app

export default function SleepApp({ name = 'Nightfall', accent = '#8b7bff', startScreen = 'last', goalHours: startGoal = 8, frame = true, style }) {
  const box = useRef()
  const toastTimer = useRef()
  const [scale, setScale] = useState(1)
  const [tab, setTab] = useState(PAGE_IDS.includes(startScreen) ? startScreen : 'last')
  const [stack, setStack] = useState([])
  const [dir, setDir] = useState(1)
  const [toast, setToast] = useState('')
  const [stageSel, setStageSel] = useState(null)
  const [mood, setMood] = useState(null)
  const [range, setRange] = useState('week')
  const [h24, setH24] = useState(false)
  const [goal, setGoal] = useState(startGoal)
  const [alarmOn, setAlarmOn] = useState(true)
  const [alarm, setAlarm] = useState(6 * 60 + 50) // minutes since midnight
  const [days, setDays] = useState({ Mon: true, Tue: true, Wed: true, Thu: true, Fri: true })
  const [smart, setSmart] = useState(true)
  const [snooze, setSnooze] = useState(9)
  const [tone, setTone] = useState('lull')
  const [playing, setPlaying] = useState(null)
  const [paused, setPaused] = useState(false)
  const [sel, setSel] = useState('rain')
  const [elapsed, setElapsed] = useState(0)
  const [timer, setTimer] = useState('off')
  const [left, setLeft] = useState(0)
  const [volume, setVolume] = useState(60)
  const [wind, setWind] = useState(true)
  const [dnd, setDnd] = useState(true)
  const [sync, setSync] = useState(false)
  const [bedRem, setBedRem] = useState(true)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    setTab(PAGE_IDS.includes(startScreen) ? startScreen : 'last')
    setStack([])
  }, [startScreen])
  useEffect(() => setGoal(startGoal), [startGoal])

  useEffect(() => {
    const ro = new ResizeObserver(([e]) => {
      const fw = frame ? W + 28 : W
      const fh = frame ? H + 28 : H
      setScale(Math.min(1.2, (e.contentRect.width - 24) / fw, (e.contentRect.height - 24) / fh))
    })
    ro.observe(box.current)
    return () => ro.disconnect()
  }, [frame])

  // wall clock for the alarm countdown
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15000)
    return () => clearInterval(id)
  }, [])

  // playback clock + sleep timer
  useEffect(() => {
    if (!playing || paused) return undefined
    const id = setInterval(() => {
      setElapsed((e) => e + 1)
      setLeft((l) => (l > 0 ? l - 1 : l))
    }, 1000)
    return () => clearInterval(id)
  }, [playing, paused])
  useEffect(() => {
    if (playing && timer !== 'off' && left === 0 && elapsed > 0) {
      setPlaying(null)
      setPaused(false)
      setTimer('off')
      say('Sleep timer ended, sounds stopped')
    }
  }, [left, playing, timer, elapsed])

  const say = (t) => {
    setToast(t)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 1900)
  }
  useEffect(() => () => clearTimeout(toastTimer.current), [])

  const top = stack[stack.length - 1]
  const push = (s) => (setDir(1), setStack((a) => [...a, s]))
  const pop = () => (setDir(-1), setStack((a) => a.slice(0, -1)))
  const go = (t) => (setDir(NAV.findIndex((n) => n[0] === t) >= NAV.findIndex((n) => n[0] === tab) ? 1 : -1), setTab(t), setStack([]))

  const play = (id) => {
    setSel(id)
    if (playing === id) return setPaused((p) => !p)
    setPlaying(id)
    setPaused(false)
    setElapsed(0)
    setLeft(timer === 'off' ? 0 : timer * 60)
    say(`Playing ${SOUNDS.find((s) => s.id === id).name}`)
  }
  const chooseTimer = (t) => {
    setTimer(t)
    setLeft(t === 'off' ? 0 : t * 60)
    say(t === 'off' ? 'Sleep timer off' : `Stops in ${t} minutes`)
  }

  // ---- derived data
  const totals = { awake: 0, rem: 0, light: 0, deep: 0 }
  NIGHT.forEach(([s, m]) => (totals[s] += m))
  const inBed = NIGHT.reduce((s, [, m]) => s + m, 0)
  const asleep = inBed - totals.awake
  const score = Math.round(Math.min(100, (asleep / (goal * 60)) * 60 + (totals.deep / asleep) * 100 + (totals.rem / asleep) * 60))
  const clockOf = (min) => {
    const m = ((min % 1440) + 1440) % 1440
    const hh = Math.floor(m / 60)
    const mi = String(m % 60).padStart(2, '0')
    if (h24) return `${String(hh).padStart(2, '0')}:${mi}`
    return `${hh % 12 || 12}:${mi} ${hh < 12 ? 'AM' : 'PM'}`
  }
  const wakeMin = BED_MIN + inBed

  const nightCount = range === 'week' ? 7 : 28
  const nights = Array.from({ length: nightCount }, (_, i) => {
    const back = nightCount - 1 - i
    const d = new Date(Date.now() - back * 86400000)
    const min = back === 0 ? asleep : 330 + ((i * 53 + 17) % 170)
    return { i, back, label: d.toLocaleDateString('en-US', { weekday: 'short' }), date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), min, bed: 22 * 60 + ((i * 37) % 110), score: back === 0 ? score : 58 + ((i * 11) % 36) }
  })
  const avgMin = Math.round(nights.reduce((s, n) => s + n.min, 0) / nights.length)
  const debt = Math.max(0, goal * 60 - avgMin)

  const ringsIn = (() => {
    const t = new Date(now)
    t.setHours(Math.floor(alarm / 60), alarm % 60, 0, 0)
    const dayOn = (d) => days[DAYS[(d.getDay() + 6) % 7]]
    for (let k = 0; k < 8; k++) {
      const c = new Date(t.getTime() + k * 86400000)
      if (c > now && dayOn(c)) return Math.round((c - now) / 60000)
    }
    return null
  })()

  const mood3 = [['rested', 'Rested'], ['ok', 'Okay'], ['groggy', 'Groggy']]

  // ---- shared bits
  const header = (title, back, right) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 20px 6px', minHeight: 50 }}>
      {back && (
        <button type="button" onClick={back} aria-label="Back" style={{ ...iconBtn, width: 38, height: 38 }}>
          <Icon name="back" size={20} />
        </button>
      )}
      <h1 style={{ margin: 0, flex: 1, fontSize: back ? 18 : 28, fontWeight: 800, letterSpacing: '-0.02em', marginLeft: back ? 4 : 0 }}>{title}</h1>
      {right}
    </div>
  )
  const card = { background: PANEL, borderRadius: 22, padding: 16 }
  const line = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '13px 0', borderBottom: '1px solid rgba(255,255,255,.08)', fontSize: 14.5, fontWeight: 600 }

  const toggle = (on, set, label) => (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => set(!on)} style={{ width: 48, height: 28, borderRadius: 14, border: 'none', padding: 3, background: on ? accent : '#3a3f78', cursor: 'pointer', transition: 'background .2s', flex: 'none' }}>
      <span style={{ display: 'block', width: 22, height: 22, borderRadius: '50%', background: '#fff', transform: `translateX(${on ? 20 : 0}px)`, transition: 'transform .2s' }} />
    </button>
  )
  const chip = (label, on, onClick) => (
    <button key={label} type="button" aria-pressed={on} onClick={onClick} style={{ flex: 'none', height: 36, padding: '0 14px', borderRadius: 18, border: 'none', background: on ? accent : PANEL, color: on ? '#fff' : INK, font: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{label}</button>
  )
  const primary = (label, onClick, tone) => (
    <button type="button" onClick={onClick} style={{ width: '100%', height: 52, borderRadius: 26, border: 'none', background: tone || accent, color: '#fff', font: 'inherit', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>{label}</button>
  )
  const arrow = (dirn, onClick, label) => (
    <button type="button" onClick={onClick} aria-label={label} style={{ ...iconBtn, width: 40, height: 32, borderRadius: 12, background: '#232968', color: accent }}>
      <Icon name={dirn} size={18} />
    </button>
  )

  const eq = (active) => (
    <span aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'flex-end', gap: 2, height: 16 }}>
      {[0, 1, 2, 3].map((i) => (
        <i key={i} className={active ? 'sl-eq' : ''} style={{ width: 3, height: active ? 16 : 5, borderRadius: 2, background: '#fff', transformOrigin: 'bottom', animationDelay: `${i * 0.17}s` }} />
      ))}
    </span>
  )

  // ---- screens
  let body
  let tabbed = true
  if (top?.id === 'stage') {
    tabbed = false
    const s = STAGE[top.s]
    const m = totals[top.s]
    body = (
      <>
        {header(`${s.label} sleep`, pop)}
        <div style={{ textAlign: 'center', padding: '16px 24px' }}>
          <span style={{ width: 86, height: 86, borderRadius: '50%', display: 'inline-grid', placeItems: 'center', background: `${s.color}33`, color: s.color, fontSize: 28, fontWeight: 800 }}>{Math.round((m / inBed) * 100)}%</span>
          <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-0.03em', marginTop: 10 }}>{dur(m)}</div>
        </div>
        <div style={{ margin: '0 20px', ...card }}>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>{s.note}</p>
          <div style={{ ...line, marginTop: 10 }}><span style={{ color: MUTED }}>Typical range</span><span>{{ awake: '5-10%', rem: '20-25%', light: '45-55%', deep: '13-23%' }[top.s]}</span></div>
          <div style={{ ...line, borderBottom: 'none' }}><span style={{ color: MUTED }}>Cycles</span><span>{NIGHT.filter(([k]) => k === top.s).length}</span></div>
        </div>
        <div style={{ padding: '16px 20px' }}>{primary('See how to improve it', () => push({ id: 'tip' }))}</div>
      </>
    )
  } else if (top?.id === 'tip') {
    tabbed = false
    body = (
      <>
        {header('Sleep tips', pop)}
        <div style={{ display: 'grid', gap: 10, padding: '6px 20px' }}>
          {[['Keep a steady wake time', 'Even on weekends. It anchors your body clock.'], ['Dim lights an hour before bed', 'Warm, low light helps melatonin rise.'], ['Cool, dark room', 'Around 18 °C (65 °F) is a good target.'], ['Caffeine curfew at 14:00', 'Its half-life is about 5 to 6 hours.']].map(([t, d]) => (
            <button key={t} type="button" onClick={() => say(`Saved: ${t}`)} style={{ ...card, border: 'none', font: 'inherit', textAlign: 'left', cursor: 'pointer', color: INK, display: 'flex', gap: 12, alignItems: 'center' }}>
              <Icon name="bulb" size={22} color={accent} />
              <span style={{ flex: 1 }}>
                <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700 }}>{t}</span>
                <span style={{ display: 'block', fontSize: 12.5, color: MUTED, marginTop: 2 }}>{d}</span>
              </span>
              <Icon name="plus" size={18} color={MUTED} />
            </button>
          ))}
        </div>
      </>
    )
  } else if (top?.id === 'night') {
    tabbed = false
    const n = nights[top.i]
    body = (
      <>
        {header(n.back === 0 ? 'Last night' : `${n.label}, ${n.date}`, pop)}
        <div style={{ textAlign: 'center', padding: '16px 20px' }}>
          <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: '-0.03em' }}>{dur(n.min)}</div>
          <div style={{ fontSize: 13, color: n.min >= goal * 60 ? '#6ee7a8' : MUTED }}>{n.min >= goal * 60 ? 'Goal met' : `${dur(goal * 60 - n.min)} short of your goal`}</div>
        </div>
        <div style={{ margin: '0 20px', ...card }}>
          <div style={line}><span style={{ color: MUTED }}>Score</span><span>{n.score}</span></div>
          <div style={line}><span style={{ color: MUTED }}>Bedtime</span><span>{clockOf(n.back === 0 ? BED_MIN : n.bed)}</span></div>
          <div style={{ ...line, borderBottom: 'none' }}><span style={{ color: MUTED }}>Woke up</span><span>{clockOf((n.back === 0 ? BED_MIN : n.bed) + n.min + 15)}</span></div>
        </div>
        {n.back === 0 && <div style={{ padding: '16px 20px' }}>{primary('See stages', () => go('last'))}</div>}
      </>
    )
  } else if (top?.id === 'tones') {
    tabbed = false
    body = (
      <>
        {header('Alarm tone', pop)}
        <div style={{ display: 'grid', gap: 8, padding: '6px 20px' }}>
          {SOUNDS.map((s) => (
            <button key={s.id} type="button" aria-pressed={tone === s.id} onClick={() => (setTone(s.id), say(`Tone: ${s.name}`))} style={{ ...card, padding: '13px 16px', border: tone === s.id ? `2px solid ${accent}` : '2px solid transparent', font: 'inherit', textAlign: 'left', cursor: 'pointer', color: INK, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 14.5, fontWeight: 700 }}>
              {s.name}
              {tone === s.id && <span style={{ color: accent, fontSize: 13 }}>Selected</span>}
            </button>
          ))}
        </div>
      </>
    )
  } else if (tab === 'last') {
    const R = 52
    const C = 2 * Math.PI * R
    const spanX = (m) => (m / inBed) * 340
    let acc = 0
    body = (
      <>
        {header('Last night', null, <span style={{ fontSize: 13, color: MUTED }}>{now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>)}
        <div style={{ margin: '4px 20px 0', ...card, display: 'flex', alignItems: 'center', gap: 16 }}>
          <svg width="124" height="124" viewBox="0 0 124 124" role="img" aria-label={`Sleep score ${score}`}>
            <circle cx="62" cy="62" r={R} fill="none" stroke="#2a3070" strokeWidth="10" />
            <circle cx="62" cy="62" r={R} fill="none" stroke={accent} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${(score / 100) * C} ${C}`} transform="rotate(-90 62 62)" style={{ transition: 'stroke-dasharray 1s ease' }} />
            <text x="62" y="68" textAnchor="middle" fill={INK} fontSize="34" fontWeight="800">{score}</text>
            <text x="62" y="86" textAnchor="middle" fill={MUTED} fontSize="10" fontWeight="700">SCORE</text>
          </svg>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.03em' }}>{dur(asleep)}</div>
            <div style={{ fontSize: 12.5, color: MUTED }}>asleep of {goal}h goal</div>
            <div style={{ fontSize: 12.5, marginTop: 8 }}>{clockOf(BED_MIN)} to {clockOf(wakeMin)}</div>
            <button type="button" onClick={() => push({ id: 'night', i: nights.length - 1 })} style={{ marginTop: 8, border: 'none', background: 'none', padding: 0, color: accent, font: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Night details</button>
          </div>
        </div>
        <div style={{ margin: '12px 20px 0', ...card }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 800 }}>Sleep stages</span>
            <span style={{ fontSize: 12, color: MUTED }}>{stageSel != null ? `${STAGE[NIGHT[stageSel][0]].label} · ${dur(NIGHT[stageSel][1])}` : 'Tap the chart'}</span>
          </div>
          <svg viewBox="0 0 340 100" style={{ width: '100%' }} role="img" aria-label="Sleep stage chart">
            {NIGHT.map(([s, m], i) => {
              const x = acc
              acc += spanX(m)
              return (
                <rect key={i} x={x} y={STAGE[s].lvl * 24 + 2} width={Math.max(2, spanX(m) - 1)} height="20" rx="4" fill={STAGE[s].color} opacity={stageSel == null || stageSel === i ? 1 : 0.35} onClick={() => setStageSel(stageSel === i ? null : i)} style={{ cursor: 'pointer' }} />
              )
            })}
          </svg>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: MUTED, marginTop: 2 }}>
            <span>{clockOf(BED_MIN)}</span><span>{clockOf(BED_MIN + inBed / 2)}</span><span>{clockOf(wakeMin)}</span>
          </div>
        </div>
        <div style={{ display: 'grid', gap: 8, padding: '12px 20px 0' }}>
          {Object.entries(STAGE).map(([k, s]) => (
            <button key={k} type="button" onClick={() => push({ id: 'stage', s: k })} style={{ ...card, padding: '12px 16px', border: 'none', font: 'inherit', textAlign: 'left', cursor: 'pointer', color: INK, display: 'flex', alignItems: 'center', gap: 12 }}>
              <i style={{ width: 12, height: 12, borderRadius: 4, background: s.color }} />
              <span style={{ flex: 1, fontSize: 14.5, fontWeight: 700 }}>{s.label}</span>
              <span style={{ fontSize: 14, fontWeight: 700 }}>{dur(totals[k])}</span>
              <span style={{ width: 38, textAlign: 'right', fontSize: 12, color: MUTED }}>{Math.round((totals[k] / inBed) * 100)}%</span>
              <Icon name="chev" size={16} color={MUTED} />
            </button>
          ))}
        </div>
        <div style={{ margin: '12px 20px 0', ...card }}>
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 10 }}>How do you feel?</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {mood3.map(([k, l]) => chip(l, mood === k, () => (setMood(k), say(`Logged: ${l.toLowerCase()}`))))}
          </div>
        </div>
        <div style={{ padding: '12px 20px 0' }}>
          <button type="button" onClick={() => push({ id: 'tip' })} style={{ ...card, width: '100%', border: 'none', font: 'inherit', textAlign: 'left', cursor: 'pointer', color: INK, display: 'flex', alignItems: 'center', gap: 12 }}>
            <Icon name="bulb" size={22} color={accent} />
            <span style={{ flex: 1, fontSize: 14, fontWeight: 700 }}>Tips for deeper sleep</span>
            <Icon name="chev" size={16} color={MUTED} />
          </button>
        </div>
      </>
    )
  } else if (tab === 'trends') {
    const mx = Math.max(goal * 60, ...nights.map((n) => n.min)) * 1.08
    body = (
      <>
        {header('Trends')}
        <div style={{ display: 'flex', gap: 8, padding: '2px 20px 10px' }}>
          {chip('Week', range === 'week', () => setRange('week'))}
          {chip('Month', range === 'month', () => setRange('month'))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, padding: '0 20px' }}>
          {[['Average', dur(avgMin)], ['Sleep debt', dur(debt)], ['Best', dur(Math.max(...nights.map((n) => n.min)))]].map(([l, v]) => (
            <div key={l} style={{ ...card, padding: '12px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: MUTED, fontWeight: 700 }}>{l}</div>
              <div style={{ fontSize: 15, fontWeight: 800, marginTop: 3 }}>{v}</div>
            </div>
          ))}
        </div>
        <div style={{ margin: '12px 20px 0', ...card }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', gap: range === 'week' ? 10 : 2, height: 180 }}>
            <span style={{ position: 'absolute', left: 0, right: 0, bottom: `${((goal * 60) / mx) * 100}%`, borderTop: `2px dashed ${accent}99` }} />
            {nights.map((n) => (
              <button key={n.i} type="button" onClick={() => push({ id: 'night', i: n.i })} aria-label={`${n.label} ${n.date}: ${dur(n.min)}`} style={{ flex: 1, height: '100%', border: 'none', background: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'flex-end' }}>
                <span style={{ width: '100%', height: `${(n.min / mx) * 100}%`, borderRadius: range === 'week' ? 8 : 3, background: n.back === 0 ? accent : n.min >= goal * 60 ? '#6e7bd6' : '#3b4290' }} />
              </button>
            ))}
          </div>
          {range === 'week' && (
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              {nights.map((n) => <span key={n.i} style={{ flex: 1, textAlign: 'center', fontSize: 11.5, fontWeight: n.back === 0 ? 800 : 600, color: n.back === 0 ? INK : MUTED }}>{n.label}</span>)}
            </div>
          )}
          <div style={{ fontSize: 12, color: MUTED, marginTop: 10 }}>Dashed line is your {goal}h goal. Tap a bar for that night.</div>
        </div>
        <div style={{ margin: '12px 20px 0', ...card }}>
          <div style={line}><span style={{ color: MUTED }}>Average bedtime</span><span>{clockOf(Math.round(nights.reduce((s, n) => s + n.bed, 0) / nights.length))}</span></div>
          <div style={{ ...line, borderBottom: 'none' }}><span style={{ color: MUTED }}>Nights on goal</span><span>{nights.filter((n) => n.min >= goal * 60).length} of {nights.length}</span></div>
        </div>
      </>
    )
  } else if (tab === 'alarm') {
    const hh = Math.floor(alarm / 60)
    const mi = alarm % 60
    const pm = hh >= 12
    const hDisp = h24 ? String(hh).padStart(2, '0') : String(hh % 12 || 12)
    const setH = (d) => setAlarm(((hh + d + 24) % 24) * 60 + mi)
    const setM = (d) => setAlarm(hh * 60 + ((mi + d + 60) % 60))
    const col = (label, val, up, dn) => (
      <div style={{ display: 'grid', justifyItems: 'center', gap: 6 }}>
        {arrow('up', up, `Increase ${label}`)}
        <span style={{ fontSize: 66, fontWeight: 200, letterSpacing: '-0.04em', lineHeight: 1, minWidth: 100, textAlign: 'center' }}>{val}</span>
        {arrow('down', dn, `Decrease ${label}`)}
      </div>
    )
    body = (
      <>
        {header('Alarm', null, toggle(alarmOn, (v) => (setAlarmOn(v), say(v ? 'Alarm on' : 'Alarm off')), 'Alarm'))}
        <div style={{ margin: '4px 20px 0', ...card, opacity: alarmOn ? 1 : 0.55, transition: 'opacity .2s' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            {col('hours', hDisp, () => setH(1), () => setH(-1))}
            <span style={{ fontSize: 56, fontWeight: 200, paddingBottom: 2 }}>:</span>
            {col('minutes', String(mi).padStart(2, '0'), () => setM(5), () => setM(-5))}
            {!h24 && (
              <button type="button" onClick={() => setAlarm((alarm + 720) % 1440)} aria-label="Toggle AM or PM" style={{ marginLeft: 6, height: 40, padding: '0 12px', borderRadius: 14, border: 'none', background: '#232968', color: accent, font: 'inherit', fontSize: 15, fontWeight: 800, cursor: 'pointer' }}>{pm ? 'PM' : 'AM'}</button>
            )}
          </div>
          <div style={{ textAlign: 'center', fontSize: 13, color: MUTED, marginTop: 12 }}>
            {alarmOn ? (ringsIn == null ? 'No repeat day selected' : `Rings in ${dur(ringsIn)}`) : 'Alarm is off'}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 20px 0' }} role="group" aria-label="Repeat days">
          {DAYS.map((d) => (
            <button key={d} type="button" aria-pressed={!!days[d]} onClick={() => setDays((o) => ({ ...o, [d]: !o[d] }))} style={{ width: 70 * 0.5, height: 40, borderRadius: 20, border: 'none', background: days[d] ? accent : PANEL, color: days[d] ? '#fff' : MUTED, font: 'inherit', fontSize: 11.5, fontWeight: 800, cursor: 'pointer' }}>{d.slice(0, 2)}</button>
          ))}
        </div>
        <div style={{ margin: '14px 20px 0', ...card, padding: '4px 16px' }}>
          <div style={line}><span>Smart wake (30 min window)</span>{toggle(smart, setSmart, 'Smart wake')}</div>
          <div style={line}><span>Snooze</span><span style={{ display: 'flex', gap: 6 }}>{[5, 9, 15].map((n) => chip(`${n}m`, snooze === n, () => setSnooze(n)))}</span></div>
          <button type="button" onClick={() => push({ id: 'tones' })} style={{ ...line, width: '100%', border: 'none', background: 'none', font: 'inherit', cursor: 'pointer', color: INK }}>
            <span>Tone</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: MUTED }}>{SOUNDS.find((s) => s.id === tone).name}<Icon name="chev" size={16} /></span>
          </button>
        </div>
        <div style={{ padding: '14px 20px 0' }}>
          {primary('Preview alarm', () => say(`Alarm preview: ${SOUNDS.find((s) => s.id === tone).name}`), '#232968')}
        </div>
      </>
    )
  } else if (tab === 'sounds') {
    const cur = SOUNDS.find((s) => s.id === sel)
    const isPlaying = playing === sel && !paused
    body = (
      <>
        {header('Sounds')}
        <div style={{ margin: '0 20px', borderRadius: 24, padding: 18, color: '#fff', background: `linear-gradient(135deg, ${cur.a}, ${cur.b})`, display: 'flex', alignItems: 'center', gap: 14 }}>
          <button type="button" onClick={() => play(sel)} aria-label={isPlaying ? 'Pause' : 'Play'} style={{ ...iconBtn, width: 58, height: 58, background: 'rgba(255,255,255,.25)', color: '#fff' }}>
            <Icon name={isPlaying ? 'pause' : 'play'} size={26} fill={isPlaying ? 'none' : '#fff'} />
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 800 }}>{cur.name}</div>
            <div style={{ fontSize: 12.5, opacity: 0.9, display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
              {eq(isPlaying)} {playing === sel ? (paused ? 'Paused' : 'Playing') : 'Tap play'} {playing === sel ? `· ${mmss(elapsed)}` : ''}
            </div>
          </div>
        </div>
        <div style={{ margin: '12px 20px 0', ...card, padding: '12px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontWeight: 700 }}>
            <span style={{ color: MUTED }}>Volume</span>
            <input type="range" min="0" max="100" value={volume} onChange={(e) => setVolume(+e.target.value)} aria-label="Volume" style={{ flex: 1, accentColor: accent }} />
            <span style={{ width: 34, textAlign: 'right' }}>{volume}%</span>
          </div>
          <div style={{ marginTop: 12, fontSize: 13, fontWeight: 700, color: MUTED }}>Sleep timer{timer !== 'off' && playing ? ` · ${mmss(left)} left` : ''}</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            {TIMERS.map(([v, l]) => chip(l, timer === v, () => chooseTimer(v)))}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '12px 20px 0' }}>
          {SOUNDS.map((s) => {
            const on = playing === s.id
            return (
              <button key={s.id} type="button" onClick={() => play(s.id)} aria-pressed={sel === s.id} style={{ position: 'relative', height: 96, padding: 14, border: sel === s.id ? '2px solid #fff' : '2px solid transparent', borderRadius: 20, background: `linear-gradient(135deg, ${s.a}, ${s.b})`, color: '#fff', font: 'inherit', textAlign: 'left', cursor: 'pointer', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, fontWeight: 700, opacity: 0.9 }}>{s.tag}{on && !paused && eq(true)}{on && paused && <Icon name="pause" size={14} />}</span>
                <span style={{ fontSize: 15, fontWeight: 800 }}>{s.name}</span>
              </button>
            )
          })}
        </div>
      </>
    )
  } else {
    body = (
      <>
        {header('Settings')}
        <div style={{ margin: '4px 20px 0', ...card, padding: '4px 16px' }}>
          <div style={line}><span>Sleep goal</span><span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>{arrow('down', () => setGoal((g) => Math.max(5, g - 0.5)), 'Decrease goal')}<b style={{ minWidth: 46, textAlign: 'center' }}>{goal}h</b>{arrow('up', () => setGoal((g) => Math.min(11, g + 0.5)), 'Increase goal')}</span></div>
          <div style={line}><span>Bedtime reminder</span>{toggle(bedRem, (v) => (setBedRem(v), say(v ? 'Reminder at 22:45' : 'Reminder off')), 'Bedtime reminder')}</div>
          <div style={line}><span>Wind-down mode</span>{toggle(wind, setWind, 'Wind-down mode')}</div>
          <div style={line}><span>Do not disturb at night</span>{toggle(dnd, setDnd, 'Do not disturb')}</div>
          <div style={line}><span>Health sync</span>{toggle(sync, (v) => (setSync(v), say(v ? 'Health sync connected' : 'Health sync off')), 'Health sync')}</div>
          <div style={{ ...line, borderBottom: 'none' }}><span>Time format</span><span style={{ display: 'flex', gap: 6 }}>{chip('12h', !h24, () => setH24(false))}{chip('24h', h24, () => setH24(true))}</span></div>
        </div>
        <div style={{ padding: '14px 20px', display: 'grid', gap: 10 }}>
          <button type="button" onClick={() => say('Report saved to your files')} style={{ height: 48, borderRadius: 24, border: 'none', background: PANEL, font: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer', color: INK }}>Export sleep report</button>
          <button type="button" onClick={() => (setGoal(startGoal), setAlarm(6 * 60 + 50), setDays({ Mon: true, Tue: true, Wed: true, Thu: true, Fri: true }), setPlaying(null), setTimer('off'), setMood(null), setH24(false), go('last'), say('Demo reset'))} style={{ height: 48, borderRadius: 24, border: 'none', background: PANEL, font: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer', color: INK }}>Reset demo</button>
        </div>
      </>
    )
  }

  const playingSound = SOUNDS.find((s) => s.id === playing)
  const stars = [[40, 90, 1.6], [120, 40, 1.2], [210, 120, 1.4], [300, 70, 1.8], [350, 160, 1.2], [70, 200, 1.3], [260, 230, 1.5], [180, 330, 1.2]]

  const phone = (
    <div style={{ position: 'relative', width: W, height: H, overflow: 'hidden', borderRadius: frame ? 46 : 0, background: `radial-gradient(ellipse at 70% -10%, #2a2f7a, ${BG} 60%)`, color: INK, fontFamily: FONT }}>
      <style>{`
        @keyframes sl-r { from { opacity: 0; transform: translateX(34px) } to { opacity: 1; transform: none } }
        @keyframes sl-l { from { opacity: 0; transform: translateX(-34px) } to { opacity: 1; transform: none } }
        @keyframes sl-eq { 0%,100% { transform: scaleY(.3) } 50% { transform: scaleY(1) } }
        @keyframes sl-tw { 0%,100% { opacity: .25 } 50% { opacity: .9 } }
        .sl-eq { animation: sl-eq .9s ease-in-out infinite }
        .sl-star { animation: sl-tw 3.4s ease-in-out infinite }
        .sl-scroll { scrollbar-width: none } .sl-scroll::-webkit-scrollbar { display: none }
        .sl-app button:focus-visible, .sl-app input:focus-visible { outline: 2px solid ${accent}; outline-offset: 2px }
        @media (prefers-reduced-motion: reduce) { .sl-app * { animation: none !important; transition: none !important } }
      `}</style>
      <svg width={W} height="360" aria-hidden="true" style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
        {stars.map(([x, y, r], i) => <circle key={i} className="sl-star" cx={x} cy={y} r={r} fill="#fff" style={{ animationDelay: `${i * 0.45}s` }} />)}
      </svg>
      <StatusBar frame={frame} />
      <div key={`${tab}/${stack.map((s) => s.id + (s.i ?? '') + (s.s ?? '')).join('/')}`} className="sl-scroll" style={{ position: 'absolute', top: 54, bottom: tabbed ? (playing ? 148 : 88) : 0, left: 0, right: 0, overflowY: 'auto', paddingBottom: 24, animation: `${dir > 0 ? 'sl-r' : 'sl-l'} .28s ease` }}>
        {body}
      </div>
      {tabbed && playing && tab !== 'sounds' && (
        <div style={{ position: 'absolute', left: 12, right: 12, bottom: 96, height: 52, zIndex: 15, borderRadius: 18, display: 'flex', alignItems: 'center', gap: 10, padding: '0 8px 0 12px', background: `linear-gradient(135deg, ${playingSound.a}, ${playingSound.b})`, color: '#fff' }}>
          {eq(!paused)}
          <button type="button" onClick={() => go('sounds')} style={{ flex: 1, minWidth: 0, border: 'none', background: 'none', color: '#fff', font: 'inherit', textAlign: 'left', cursor: 'pointer', padding: 0 }}>
            <span style={{ display: 'block', fontSize: 13.5, fontWeight: 800 }}>{playingSound.name}</span>
            <span style={{ display: 'block', fontSize: 11.5, opacity: 0.9 }}>{mmss(elapsed)}{timer !== 'off' ? ` · stops in ${mmss(left)}` : ''}</span>
          </button>
          <button type="button" onClick={() => setPaused((p) => !p)} aria-label={paused ? 'Resume' : 'Pause'} style={{ ...iconBtn, width: 36, height: 36, background: 'rgba(255,255,255,.25)', color: '#fff' }}><Icon name={paused ? 'play' : 'pause'} size={18} fill={paused ? '#fff' : 'none'} /></button>
          <button type="button" onClick={() => (setPlaying(null), setPaused(false), say('Stopped'))} aria-label="Stop" style={{ ...iconBtn, width: 36, height: 36, background: 'rgba(255,255,255,.25)', color: '#fff' }}><Icon name="x" size={18} /></button>
        </div>
      )}
      {tabbed && (
        <nav aria-label="Main" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 88, background: '#11154a', borderRadius: '26px 26px 0 0', boxShadow: '0 -6px 24px rgba(0,0,0,.35)', display: 'flex', justifyContent: 'space-around', padding: '10px 4px 0', zIndex: 16 }}>
          {NAV.map(([id, icon, label]) => (
            <button key={id} type="button" onClick={() => go(id)} aria-current={tab === id ? 'page' : undefined} style={{ border: 'none', background: 'none', font: 'inherit', cursor: 'pointer', display: 'grid', justifyItems: 'center', alignContent: 'start', gap: 3, width: 70, height: 54, fontSize: 10.5, fontWeight: 700, color: tab === id ? accent : MUTED }}>
              <Icon name={icon} size={23} />
              {label}
            </button>
          ))}
        </nav>
      )}
      <div role="status" style={{ position: 'absolute', left: '50%', top: 58, zIndex: 30, transform: `translate(-50%, ${toast ? 0 : -90}px)`, transition: 'transform .35s cubic-bezier(.2,.8,.2,1)', padding: '10px 16px', borderRadius: 20, background: '#fff', color: '#14174a', fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap' }}>{toast}</div>
      <div style={{ position: 'absolute', left: '50%', bottom: 8, width: 140, height: 5, marginLeft: -70, borderRadius: 3, background: INK, opacity: 0.8, zIndex: 25 }} />
    </div>
  )

  return (
    <div ref={box} className="sl-app" style={{ position: 'relative', width: '100%', height: '100%', display: 'grid', placeItems: 'center', overflow: 'hidden', background: 'radial-gradient(ellipse at 50% 30%, #2b3170, #0a0c26 75%)', ...style }}>
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
