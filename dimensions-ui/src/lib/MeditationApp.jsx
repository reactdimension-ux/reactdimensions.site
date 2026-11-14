import { useEffect, useRef, useState } from 'react'

// A meditation timer on a phone, as a click-through prototype. Five pages:
// Home (today's minutes against a daily goal, a mood check, a one-tap start),
// Session (pick a length and a sound, then begin), Library (sessions you can
// open and start), Stats (a weekly minutes chart, streak and totals) and
// Settings (breathing pattern, daily goal, reminders, reset). Starting a
// session runs a real countdown with a breathing circle that grows and
// shrinks with inhale / hold / exhale text; pause, resume or end it, and the
// minutes you sat are logged into Stats. With reduced motion the circle
// becomes a still ring with a progress arc. Night-sky indigo palette. The
// phone scales to fit whatever box it is in.

const W = 390
const H = 844
const INK = '#eef0ff'
const MUTED = '#9aa0c8'
const BG = '#0d1024'
const CARD = 'rgba(255,255,255,.07)'
const LINE = 'rgba(255,255,255,.12)'

const DAY = 86400000
const dayIdx = (t) => Math.floor((t - new Date(t).getTimezoneOffset() * 60000) / DAY)
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
const mins = (sec) => Math.round(sec / 60)

const PATTERNS = {
  calm: { name: 'Calm 4 / 6', phases: [['Inhale', 4], ['Exhale', 6]] },
  box: { name: 'Box 4-4-4-4', phases: [['Inhale', 4], ['Hold', 4], ['Exhale', 4], ['Hold', 4]] },
  relax: { name: 'Relax 4-7-8', phases: [['Inhale', 4], ['Hold', 7], ['Exhale', 8]] },
}

const LIBRARY = [
  { id: 'l1', title: 'Morning clarity', mins: 5, cat: 'Focus', kind: 'sun', hue: 35, desc: 'A short reset to begin the day with a clear head.' },
  { id: 'l2', title: 'Soft landing', mins: 10, cat: 'Calm', kind: 'wave', hue: 215, desc: 'Let the day settle. Follow the breath and release tension from the shoulders down.' },
  { id: 'l3', title: 'Deep sleep drift', mins: 20, cat: 'Sleep', kind: 'moon', hue: 255, desc: 'A slow, long exhale pattern to carry you towards sleep.' },
  { id: 'l4', title: 'Anxiety first aid', mins: 3, cat: 'Calm', kind: 'wave', hue: 170, desc: 'Three minutes of grounding when things feel like too much.' },
  { id: 'l5', title: 'Deep work prep', mins: 10, cat: 'Focus', kind: 'sun', hue: 20, desc: 'Quiet the noise before a stretch of focused work.' },
  { id: 'l6', title: 'Evening unwind', mins: 15, cat: 'Sleep', kind: 'moon', hue: 290, desc: 'Gently wind down after a long day.' },
  { id: 'l7', title: 'Box breathing', mins: 5, cat: 'Breathe', kind: 'ring', hue: 190, desc: 'Even four-count breathing used to steady the nervous system.' },
]
const CATS = ['All', 'Calm', 'Sleep', 'Focus', 'Breathe']
const SOUNDS = ['Silence', 'Rain', 'Ocean', 'Forest']
const LENGTHS = [1, 5, 10, 15, 20]

const NAV = [
  ['home', 'home', 'Home'],
  ['session', 'lotus', 'Session'],
  ['library', 'book', 'Library'],
  ['stats', 'chart', 'Stats'],
  ['settings', 'gear', 'Settings'],
]

const ICONS = {
  home: 'M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z',
  lotus: 'M12 20c-4 0-7-3-7-8 4 0 7 2 7 8zm0 0c4 0 7-3 7-8-4 0-7 2-7 8zm0 0c-2-3-3-6 0-10 3 4 2 7 0 10z',
  book: 'M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h11',
  chart: 'M5 20V10M12 20V4M19 20v-7',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12l2-1-1-3-2 .5-1.5-1.5.5-2-3-1-1 2h-2l-1-2-3 1 .5 2L6.5 8 4.5 7.5l-1 3 2 1v2l-2 1 1 3 2-.5L8 18.5l-.5 2 3 1 1-2h2l1 2 3-1-.5-2 1.5-1.5 2 .5 1-3-2-1z',
  back: 'M15 5l-7 7 7 7',
  chev: 'M9 5l7 7-7 7',
  play: 'M8 5l11 7-11 7z',
  pause: 'M8 5v14M16 5v14',
  x: 'M6 6l12 12M18 6L6 18',
  check: 'M5 12l5 5 9-10',
  flame: 'M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-4-1-6 1-9z',
  bell: 'M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4',
  minus: 'M5 12h14',
  plus: 'M12 5v14M5 12h14',
  wind: 'M3 9h11a3 3 0 1 0-3-3M3 15h15a3 3 0 1 1-3 3M3 12h8',
}

function Icon({ name, size = 22, color = 'currentColor', w = 1.9, fill = 'none' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  )
}

function Cover({ s, size = 56, radius = 18 }) {
  const a = `hsl(${s.hue} 70% 62%)`
  const b = `hsl(${s.hue + 40} 65% 30%)`
  const id = `mc-${s.id}-${size}`
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" style={{ borderRadius: radius, flex: 'none', display: 'block' }} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={a} />
          <stop offset="1" stopColor={b} />
        </linearGradient>
      </defs>
      <rect width="56" height="56" fill={`url(#${id})`} />
      {s.kind === 'sun' && (
        <>
          <circle cx="28" cy="34" r="11" fill="rgba(255,255,255,.85)" />
          <path d="M0 42q14-8 28 0t28 0v14H0z" fill="rgba(0,0,0,.25)" />
        </>
      )}
      {s.kind === 'moon' && (
        <>
          <path d="M34 12a15 15 0 1 0 10 24A13 13 0 0 1 34 12z" fill="rgba(255,255,255,.88)" />
          <circle cx="14" cy="14" r="1.5" fill="#fff" />
          <circle cx="44" cy="12" r="1.2" fill="#fff" />
        </>
      )}
      {s.kind === 'wave' && (
        <>
          <path d="M0 26q10-9 20 0t20 0t16 0v30H0z" fill="rgba(255,255,255,.35)" />
          <path d="M0 36q10-9 20 0t20 0t16 0v20H0z" fill="rgba(255,255,255,.35)" />
          <path d="M0 46q10-9 20 0t20 0t16 0v10H0z" fill="rgba(0,0,0,.25)" />
        </>
      )}
      {s.kind === 'ring' && (
        <>
          <circle cx="28" cy="28" r="16" fill="none" stroke="rgba(255,255,255,.85)" strokeWidth="3" />
          <circle cx="28" cy="28" r="7" fill="rgba(255,255,255,.35)" />
        </>
      )}
    </svg>
  )
}

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

function seedLog() {
  const now = Date.now()
  return [[1, 600, 'Soft landing'], [2, 900, 'Evening unwind'], [3, 600, 'Morning clarity'], [4, 1200, 'Deep sleep drift'], [6, 300, 'Box breathing'], [7, 600, 'Soft landing']].map(([d, sec, title], i) => ({ id: `s${i}`, t: now - d * DAY, sec, title }))
}

export default function MeditationApp({ name = 'Stillwater', accent = '#8b7cf6', startScreen = 'home', frame = true, style }) {
  const box = useRef()
  const toastTimer = useRef()
  const [scale, setScale] = useState(1)
  const [tab, setTab] = useState(startScreen)
  const [stack, setStack] = useState([])
  const [dir, setDir] = useState(1)
  const [toast, setToast] = useState('')
  const [log, setLog] = useState(seedLog)
  const [len, setLen] = useState(10)
  const [sound, setSound] = useState('Rain')
  const [cat, setCat] = useState('All')
  const [mood, setMood] = useState(null)
  const [run, setRun] = useState(null) // { title, total, left, paused, sound }
  const [pattern, setPattern] = useState('calm')
  const [goal, setGoal] = useState(10)
  const [remind, setRemind] = useState(true)
  const [bell, setBell] = useState(true)
  const [reduced, setReduced] = useState(false)

  useEffect(() => (setTab(startScreen), setStack([]), setDir(1)), [startScreen])

  useEffect(() => {
    const q = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(q.matches)
    const f = (e) => setReduced(e.matches)
    q.addEventListener('change', f)
    return () => q.removeEventListener('change', f)
  }, [])

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

  const running = !!run
  const paused = run?.paused
  useEffect(() => {
    if (!running || paused) return undefined
    const id = setInterval(() => setRun((r) => (r ? { ...r, left: Math.max(0, r.left - 1) } : r)), 1000)
    return () => clearInterval(id)
  }, [running, paused])

  const say = (t) => {
    setToast(t)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 1900)
  }

  const top = stack[stack.length - 1]
  const push = (s) => (setDir(1), setStack((a) => [...a, s]))
  const pop = () => (setDir(-1), setStack((a) => a.slice(0, -1)))
  const go = (t) => (setDir(NAV.findIndex((n) => n[0] === t) >= NAV.findIndex((n) => n[0] === tab) ? 1 : -1), setTab(t), setStack([]))

  const begin = (title, minutes, snd = sound) => {
    setRun({ title, total: minutes * 60, left: minutes * 60, paused: false, sound: snd })
    setDir(1)
    setStack([{ id: 'run' }])
  }

  const finish = (r, complete) => {
    const sec = r.total - r.left
    if (sec >= 10) setLog((a) => [...a, { id: `s${Date.now()}`, t: Date.now(), sec, title: r.title }])
    setRun(null)
    setDir(1)
    setStack([{ id: 'done', sec, title: r.title, complete }])
  }

  useEffect(() => {
    if (run && run.left === 0) finish(run, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run?.left])

  const today = dayIdx(Date.now())
  const perDay = (d) => log.filter((l) => dayIdx(l.t) === d).reduce((a, l) => a + l.sec, 0)
  const todaySec = perDay(today)
  let streak = 0
  for (let d = perDay(today) ? today : today - 1; perDay(d) > 0; d--) streak++
  const totalSec = log.reduce((a, l) => a + l.sec, 0)

  const header = (title, back, sub) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 18px 6px', minHeight: 48 }}>
      {back && (
        <button type="button" onClick={back} aria-label="Back" style={{ display: 'grid', placeItems: 'center', width: 38, height: 38, border: 'none', borderRadius: '50%', background: CARD, cursor: 'pointer', color: INK, padding: 0 }}>
          <Icon name="back" size={20} />
        </button>
      )}
      <div style={{ marginLeft: 4 }}>
        <h1 style={{ margin: 0, fontSize: back ? 18 : 28, fontWeight: 700, letterSpacing: '-0.02em' }}>{title}</h1>
        {sub && <div style={{ fontSize: 13, color: MUTED }}>{sub}</div>}
      </div>
    </div>
  )

  const primary = (label, onClick, icon) => (
    <button type="button" onClick={onClick} style={{ width: '100%', height: 54, borderRadius: 27, border: 'none', background: `linear-gradient(135deg, ${accent}, #6366f1)`, color: '#fff', font: 'inherit', fontSize: 15.5, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: `0 10px 26px ${accent}55` }}>
      {icon && <Icon name={icon} size={18} fill="#fff" />}
      {label}
    </button>
  )

  const secondary = (label, onClick) => (
    <button type="button" onClick={onClick} style={{ width: '100%', height: 48, borderRadius: 24, border: `1px solid ${LINE}`, background: CARD, color: INK, font: 'inherit', fontSize: 14.5, fontWeight: 600, cursor: 'pointer' }}>{label}</button>
  )

  const chip = (on, label, onClick) => (
    <button key={label} type="button" onClick={onClick} aria-pressed={on} style={{ flex: 'none', height: 38, padding: '0 16px', borderRadius: 19, border: on ? 'none' : `1px solid ${LINE}`, background: on ? accent : CARD, color: on ? '#fff' : INK, font: 'inherit', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>{label}</button>
  )

  const toggle = (on, set, label) => (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => set(!on)} style={{ width: 48, height: 28, borderRadius: 14, border: 'none', padding: 3, background: on ? accent : 'rgba(255,255,255,.2)', cursor: 'pointer', transition: 'background .2s' }}>
      <span style={{ display: 'block', width: 22, height: 22, borderRadius: '50%', background: '#fff', transform: `translateX(${on ? 20 : 0}px)`, transition: 'transform .2s' }} />
    </button>
  )

  const sessionRow = (s) => (
    <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 10, borderRadius: 22, background: CARD, border: `1px solid ${LINE}` }}>
      <button type="button" onClick={() => push({ id: 'lib', s })} aria-label={`Open ${s.title}`} style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0, border: 'none', background: 'none', padding: 0, font: 'inherit', textAlign: 'left', cursor: 'pointer', color: INK }}>
        <Cover s={s} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 15, fontWeight: 700 }}>{s.title}</span>
          <span style={{ display: 'block', fontSize: 12.5, color: MUTED, marginTop: 2 }}>{s.cat} · {s.mins} min</span>
        </span>
      </button>
      <button type="button" onClick={() => begin(s.title, s.mins)} aria-label={`Start ${s.title}`} style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', background: accent, color: '#fff', display: 'grid', placeItems: 'center', cursor: 'pointer', padding: 0 }}>
        <Icon name="play" size={16} fill="#fff" />
      </button>
    </div>
  )

  // ---- screens
  let body
  let tabbed = true
  let bare = false
  if (top?.id === 'run' && run) {
    tabbed = false
    bare = true
    const pat = PATTERNS[pattern]
    const elapsed = run.total - run.left
    const cycle = pat.phases.reduce((a, p) => a + p[1], 0)
    let t = elapsed % cycle
    let pi = 0
    while (t >= pat.phases[pi][1]) (t -= pat.phases[pi][1], pi++)
    const [label, psec] = pat.phases[pi]
    const prevInhale = pat.phases.slice(0, pi + 1).reverse().find((p) => p[0] !== 'Hold')?.[0] || 'Inhale'
    const big = label === 'Inhale' || (label === 'Hold' && prevInhale === 'Inhale')
    const target = elapsed < 1 ? 0.6 : big ? 1 : 0.6
    const pct = elapsed / run.total
    const R = 124
    const C = 2 * Math.PI * R
    body = (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '6px 24px 26px' }}>
        <div style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between' }}>
          <button type="button" onClick={() => finish(run, false)} aria-label="End session" style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', background: CARD, color: INK, display: 'grid', placeItems: 'center', cursor: 'pointer', padding: 0 }}><Icon name="x" size={20} /></button>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{run.title}</div>
            <div style={{ fontSize: 12, color: MUTED }}>{run.sound === 'Silence' ? 'No sound' : `${run.sound} sound`} · {PATTERNS[pattern].name}</div>
          </div>
          <span style={{ width: 40 }} />
        </div>
        <div style={{ flex: 1, display: 'grid', placeItems: 'center' }}>
          <div style={{ position: 'relative', width: 280, height: 280, display: 'grid', placeItems: 'center' }}>
            <svg width="280" height="280" style={{ position: 'absolute', transform: 'rotate(-90deg)' }} aria-hidden="true">
              <circle cx="140" cy="140" r={R} fill="none" stroke={LINE} strokeWidth="4" />
              <circle cx="140" cy="140" r={R} fill="none" stroke={accent} strokeWidth="4" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - pct)} style={{ transition: 'stroke-dashoffset 1s linear' }} />
            </svg>
            {!reduced && (
              <div aria-hidden="true" style={{ position: 'absolute', width: 220, height: 220, borderRadius: '50%', background: `radial-gradient(circle at 35% 30%, ${accent}ee, ${accent}55 60%, ${accent}22)`, boxShadow: `0 0 60px ${accent}66`, transform: `scale(${run.paused ? 0.8 : target})`, transition: `transform ${run.paused ? 0.4 : psec}s ease-in-out` }} />
            )}
            <div style={{ position: 'relative', textAlign: 'center' }} role="status" aria-live="off">
              <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.01em' }}>{run.paused ? 'Paused' : label}</div>
              {!run.paused && <div style={{ fontSize: 14, color: reduced ? MUTED : 'rgba(255,255,255,.75)', marginTop: 2 }}>{psec - t}</div>}
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 44, fontWeight: 300, letterSpacing: '.02em', fontVariantNumeric: 'tabular-nums' }}>{mmss(run.left)}</div>
          <div style={{ fontSize: 13, color: MUTED }}>remaining of {mmss(run.total)}</div>
        </div>
        <div style={{ display: 'flex', gap: 14, width: '100%' }}>
          <div style={{ flex: 1 }}>{secondary('End session', () => finish(run, false))}</div>
          <button type="button" onClick={() => setRun((r) => ({ ...r, paused: !r.paused }))} style={{ flex: 1, height: 48, borderRadius: 24, border: 'none', background: accent, color: '#fff', font: 'inherit', fontSize: 14.5, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Icon name={run.paused ? 'play' : 'pause'} size={17} fill={run.paused ? '#fff' : 'none'} />
            {run.paused ? 'Resume' : 'Pause'}
          </button>
        </div>
      </div>
    )
  } else if (top?.id === 'done') {
    tabbed = false
    body = (
      <div style={{ textAlign: 'center', padding: '90px 26px 0' }}>
        <span style={{ width: 96, height: 96, borderRadius: '50%', display: 'inline-grid', placeItems: 'center', background: `radial-gradient(circle at 35% 30%, ${accent}, ${accent}55)`, boxShadow: `0 0 50px ${accent}66`, animation: 'md-pop .6s cubic-bezier(.2,1.4,.4,1) both' }}>
          <Icon name="check" size={46} w={2.6} color="#fff" />
        </span>
        <div style={{ fontSize: 26, fontWeight: 700, marginTop: 24 }}>{top.complete ? 'Session complete' : 'Session ended'}</div>
        <div style={{ fontSize: 14, color: MUTED, marginTop: 6 }}>{top.title}</div>
        <div style={{ margin: '26px 0 0', padding: 18, borderRadius: 24, background: CARD, border: `1px solid ${LINE}`, display: 'flex', justifyContent: 'space-around' }}>
          <div><div style={{ fontSize: 28, fontWeight: 700 }}>{top.sec >= 10 ? Math.max(1, mins(top.sec)) : 0}</div><div style={{ fontSize: 12, color: MUTED }}>min logged</div></div>
          <div><div style={{ fontSize: 28, fontWeight: 700 }}>{mins(todaySec)}</div><div style={{ fontSize: 12, color: MUTED }}>min today</div></div>
          <div><div style={{ fontSize: 28, fontWeight: 700 }}>{streak}</div><div style={{ fontSize: 12, color: MUTED }}>day streak</div></div>
        </div>
        {top.sec < 10 && <div style={{ fontSize: 12.5, color: MUTED, marginTop: 10 }}>Sessions under 10 seconds are not logged.</div>}
        <div style={{ display: 'grid', gap: 10, marginTop: 30 }}>
          {primary('See my stats', () => go('stats'))}
          {secondary('Back to Home', () => go('home'))}
        </div>
      </div>
    )
  } else if (top?.id === 'lib') {
    tabbed = false
    const s = top.s
    body = (
      <>
        {header(s.title, pop)}
        <div style={{ margin: '8px 18px 0', height: 210, borderRadius: 28, overflow: 'hidden' }}>
          <Cover s={s} size={354} radius={0} />
        </div>
        <div style={{ padding: '18px 22px 0' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {[s.cat, `${s.mins} min`, PATTERNS[pattern].name].map((t) => <span key={t} style={{ padding: '5px 11px', borderRadius: 14, background: CARD, border: `1px solid ${LINE}`, fontSize: 12, fontWeight: 600 }}>{t}</span>)}
          </div>
          <p style={{ fontSize: 15, lineHeight: 1.55, color: '#cfd3f2', margin: '14px 0 0' }}>{s.desc}</p>
          <div style={{ display: 'grid', gap: 10, marginTop: 24 }}>
            {primary(`Begin ${s.mins} minutes`, () => begin(s.title, s.mins), 'play')}
            {secondary('Customise in Session', () => (setLen(LENGTHS.includes(s.mins) ? s.mins : 10), go('session')))}
          </div>
        </div>
      </>
    )
  } else if (tab === 'home') {
    const hr = new Date().getHours()
    const rec = mood === 'Restless' ? LIBRARY[3] : mood === 'Low' ? LIBRARY[1] : mood === 'Tired' ? LIBRARY[2] : LIBRARY[0]
    const pct = Math.min(1, todaySec / (goal * 60))
    body = (
      <>
        <div style={{ padding: '8px 20px 0' }}>
          <div style={{ fontSize: 13, color: MUTED }}>{name}</div>
          <h1 style={{ margin: '2px 0 0', fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em' }}>{hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening'}</h1>
        </div>
        <div style={{ margin: '16px 18px 0', padding: 18, borderRadius: 28, background: `linear-gradient(145deg, ${accent}55, rgba(99,102,241,.18))`, border: `1px solid ${LINE}`, display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ position: 'relative', width: 92, height: 92, flex: 'none' }}>
            <svg width="92" height="92" style={{ transform: 'rotate(-90deg)' }} aria-hidden="true">
              <circle cx="46" cy="46" r="40" fill="none" stroke={LINE} strokeWidth="8" />
              <circle cx="46" cy="46" r="40" fill="none" stroke={accent} strokeWidth="8" strokeLinecap="round" strokeDasharray={251.3} strokeDashoffset={251.3 * (1 - pct)} style={{ transition: 'stroke-dashoffset .6s' }} />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}><div><div style={{ fontSize: 24, fontWeight: 700, lineHeight: 1 }}>{mins(todaySec)}</div><div style={{ fontSize: 10.5, color: MUTED }}>of {goal} min</div></div></div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{pct >= 1 ? 'Goal reached' : 'Daily goal'}</div>
            <div style={{ fontSize: 13, color: '#cfd3f2', marginTop: 3 }}>{pct >= 1 ? 'A calm mind today.' : `${Math.max(1, goal - mins(todaySec))} min to go.`}</div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 8, fontSize: 13, fontWeight: 700, color: '#fcd34d' }}><Icon name="flame" size={16} color="#fcd34d" fill="#fcd34d" w={1.4} /> {streak} day streak</div>
          </div>
        </div>
        <div style={{ padding: '16px 18px 0' }}>{primary(`Begin ${len} min session`, () => begin('Open meditation', len), 'play')}</div>
        <div style={{ padding: '20px 20px 8px', fontSize: 15, fontWeight: 700 }}>How are you feeling?</div>
        <div style={{ display: 'flex', gap: 8, padding: '0 18px' }}>
          {['Calm', 'Restless', 'Low', 'Tired'].map((m) => chip(mood === m, m, () => (setMood(m), say(m === 'Calm' ? 'Lovely. Keep it going.' : 'We picked a session for you'))))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '20px 20px 10px' }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{mood ? 'Recommended for you' : 'Suggested'}</h2>
          <button type="button" onClick={() => go('library')} style={{ border: 'none', background: 'none', padding: 0, font: 'inherit', fontSize: 13, color: accent, fontWeight: 600, cursor: 'pointer' }}>Library</button>
        </div>
        <div style={{ padding: '0 18px', display: 'grid', gap: 9 }}>{[rec, ...LIBRARY.filter((l) => l.id !== rec.id).slice(0, 1)].map(sessionRow)}</div>
      </>
    )
  } else if (tab === 'session') {
    body = (
      <>
        {header('Session', null, 'Set up your sit')}
        <div style={{ padding: '14px 20px 8px', fontSize: 13, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '.08em' }}>Length</div>
        <div style={{ display: 'flex', gap: 8, padding: '0 18px', flexWrap: 'wrap' }}>{LENGTHS.map((n) => chip(len === n, `${n} min`, () => setLen(n)))}</div>
        <div style={{ textAlign: 'center', padding: '26px 0 10px' }}>
          <div style={{ width: 150, height: 150, margin: '0 auto', borderRadius: '50%', display: 'grid', placeItems: 'center', background: `radial-gradient(circle at 35% 30%, ${accent}dd, ${accent}33 70%)`, boxShadow: `0 0 50px ${accent}55` }}>
            <div><div style={{ fontSize: 44, fontWeight: 300, lineHeight: 1 }}>{len}</div><div style={{ fontSize: 13, opacity: 0.85 }}>minutes</div></div>
          </div>
        </div>
        <div style={{ padding: '10px 20px 8px', fontSize: 13, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '.08em' }}>Background sound</div>
        <div style={{ display: 'flex', gap: 8, padding: '0 18px', flexWrap: 'wrap' }}>{SOUNDS.map((s) => chip(sound === s, s, () => setSound(s)))}</div>
        <div style={{ padding: '10px 20px 0', fontSize: 12.5, color: MUTED }}>Breathing: {PATTERNS[pattern].name}. Change it in Settings.</div>
        <div style={{ padding: '22px 18px 0' }}>{primary('Start', () => begin('Open meditation', len), 'play')}</div>
      </>
    )
  } else if (tab === 'library') {
    const list = LIBRARY.filter((s) => cat === 'All' || s.cat === cat)
    body = (
      <>
        {header('Library')}
        <div className="md-scroll" style={{ display: 'flex', gap: 8, padding: '2px 18px 12px', overflowX: 'auto' }} role="group" aria-label="Category">{CATS.map((c) => chip(cat === c, c, () => setCat(c)))}</div>
        <div style={{ display: 'grid', gap: 9, padding: '0 18px' }}>{list.map(sessionRow)}</div>
      </>
    )
  } else if (tab === 'stats') {
    const days = Array.from({ length: 7 }, (_, i) => today - 6 + i)
    const vals = days.map((d) => mins(perDay(d)))
    const max = Math.max(goal, ...vals, 1)
    const recent = [...log].sort((a, b) => b.t - a.t).slice(0, 4)
    body = (
      <>
        {header('Stats')}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, padding: '0 18px' }}>
          {[['Total', `${mins(totalSec)}m`], ['Sessions', log.length], ['Streak', `${streak}d`]].map(([l, v]) => (
            <div key={l} style={{ background: CARD, border: `1px solid ${LINE}`, borderRadius: 20, padding: '14px 6px', textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{v}</div>
              <div style={{ fontSize: 11.5, color: MUTED }}>{l}</div>
            </div>
          ))}
        </div>
        <div style={{ margin: '12px 18px 0', background: CARD, border: `1px solid ${LINE}`, borderRadius: 24, padding: '14px 12px 8px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, padding: '0 4px 8px' }}>Minutes this week</div>
          <svg viewBox="0 0 354 160" width="100%" role="img" aria-label="Minutes meditated each day this week">
            <line x1="0" x2="354" y1={130 - (goal / max) * 105} y2={130 - (goal / max) * 105} stroke={accent} strokeDasharray="4 5" opacity=".7" />
            <text x="352" y={124 - (goal / max) * 105} textAnchor="end" fontSize="10" fill={accent}>goal {goal}</text>
            {vals.map((v, i) => {
              const h = (v / max) * 105
              const isT = i === 6
              return (
                <g key={i}>
                  <rect x={i * 50.5 + 9} y={130 - Math.max(h, 3)} width="32" height={Math.max(h, 3)} rx="9" fill={isT ? accent : 'rgba(255,255,255,.22)'} style={{ transition: 'all .4s' }} />
                  {v > 0 && <text x={i * 50.5 + 25} y={124 - h} textAnchor="middle" fontSize="11" fill={INK} fontWeight="600">{v}</text>}
                  <text x={i * 50.5 + 25} y="152" textAnchor="middle" fontSize="11" fill={MUTED}>{isT ? 'Today' : DOW[new Date(Date.now() - (6 - i) * DAY).getDay()]}</text>
                </g>
              )
            })}
          </svg>
        </div>
        <div style={{ padding: '16px 20px 8px', fontSize: 15, fontWeight: 700 }}>Recent sessions</div>
        <div style={{ display: 'grid', gap: 8, padding: '0 18px' }}>
          {recent.map((l) => (
            <button key={l.id} type="button" onClick={() => say(`${l.title}: ${mins(l.sec)} min`)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 20, border: `1px solid ${LINE}`, background: CARD, font: 'inherit', textAlign: 'left', color: INK, cursor: 'pointer' }}>
              <span style={{ flex: 1, fontSize: 14.5, fontWeight: 600 }}>{l.title}</span>
              <span style={{ fontSize: 12.5, color: MUTED }}>{DOW[new Date(l.t).getDay()]}</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: accent }}>{Math.max(1, mins(l.sec))} min</span>
            </button>
          ))}
        </div>
      </>
    )
  } else {
    const row = (icon, label, right) => (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 0', borderBottom: `1px solid ${LINE}` }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14.5, fontWeight: 600 }}><Icon name={icon} size={20} color={accent} /> {label}</span>
        {right}
      </div>
    )
    body = (
      <>
        {header('Settings')}
        <div style={{ padding: '6px 20px 8px', fontSize: 13, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '.08em' }}>Breathing pattern</div>
        <div style={{ display: 'grid', gap: 8, padding: '0 18px' }}>
          {Object.entries(PATTERNS).map(([id, p]) => (
            <button key={id} type="button" onClick={() => (setPattern(id), say(`${p.name} selected`))} aria-pressed={pattern === id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', borderRadius: 20, border: pattern === id ? `1.5px solid ${accent}` : `1px solid ${LINE}`, background: pattern === id ? `${accent}28` : CARD, color: INK, font: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
              <Icon name="wind" size={20} color={accent} />
              <span style={{ flex: 1 }}>
                <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700 }}>{p.name}</span>
                <span style={{ display: 'block', fontSize: 12, color: MUTED }}>{p.phases.map((x) => `${x[0]} ${x[1]}s`).join(' · ')}</span>
              </span>
              {pattern === id && <Icon name="check" size={18} color={accent} w={2.6} />}
            </button>
          ))}
        </div>
        <div style={{ margin: '14px 18px 0', padding: '2px 16px', background: CARD, border: `1px solid ${LINE}`, borderRadius: 22 }}>
          {row('flame', 'Daily goal', (
            <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button type="button" onClick={() => setGoal((g) => Math.max(5, g - 5))} aria-label="Decrease goal" style={{ width: 30, height: 30, borderRadius: '50%', border: `1px solid ${LINE}`, background: 'none', color: INK, cursor: 'pointer', display: 'grid', placeItems: 'center', padding: 0 }}><Icon name="minus" size={14} /></button>
              <b style={{ minWidth: 52, textAlign: 'center', fontSize: 14 }}>{goal} min</b>
              <button type="button" onClick={() => setGoal((g) => Math.min(60, g + 5))} aria-label="Increase goal" style={{ width: 30, height: 30, borderRadius: '50%', border: `1px solid ${LINE}`, background: 'none', color: INK, cursor: 'pointer', display: 'grid', placeItems: 'center', padding: 0 }}><Icon name="plus" size={14} /></button>
            </span>
          ))}
          {row('bell', 'Daily reminder, 8:00', toggle(remind, (v) => (setRemind(v), say(v ? 'Reminder on' : 'Reminder off')), 'Daily reminder'))}
          <div style={{ padding: '13px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14.5, fontWeight: 600 }}><Icon name="bell" size={20} color={accent} /> End bell</span>
              {toggle(bell, setBell, 'End bell')}
            </div>
          </div>
        </div>
        <div style={{ padding: '14px 18px 0' }}>{secondary('Reset my stats', () => (setLog([]), say('Stats cleared')))}</div>
      </>
    )
  }

  const phone = (
    <div style={{ position: 'relative', width: W, height: H, overflow: 'hidden', borderRadius: frame ? 46 : 0, background: `radial-gradient(ellipse at 50% 0%, #2a2564, ${BG} 62%)`, color: INK, fontFamily: "'Avenir Next', 'Segoe UI', system-ui, sans-serif" }}>
      <style>{`
        @keyframes md-r { from { opacity: 0; transform: translateX(34px) } to { opacity: 1; transform: none } }
        @keyframes md-l { from { opacity: 0; transform: translateX(-34px) } to { opacity: 1; transform: none } }
        @keyframes md-pop { from { transform: scale(.3); opacity: 0 } to { transform: none; opacity: 1 } }
        .md-scroll { scrollbar-width: none } .md-scroll::-webkit-scrollbar { display: none }
        .md-app button:focus-visible { outline: 2px solid ${accent}; outline-offset: 2px }
        @media (prefers-reduced-motion: reduce) { .md-view { animation: none !important } }
      `}</style>
      <StatusBar frame={frame} />
      <div key={`${tab}/${stack.map((s) => s.id + (s.s?.id || '')).join('/')}`} className="md-scroll md-view" style={{ position: 'absolute', top: 54, bottom: tabbed ? 88 : 0, left: 0, right: 0, overflowY: bare ? 'hidden' : 'auto', paddingBottom: bare ? 0 : 24, animation: `${dir > 0 ? 'md-r' : 'md-l'} .28s ease` }}>
        {body}
      </div>
      {tabbed && (
        <nav aria-label="Main" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 88, background: 'rgba(18,20,50,.92)', borderTop: `1px solid ${LINE}`, borderRadius: '26px 26px 0 0', display: 'flex', justifyContent: 'space-around', padding: '10px 4px 0' }}>
          {NAV.map(([id, icon, label]) => (
            <button key={id} type="button" onClick={() => go(id)} aria-current={tab === id ? 'page' : undefined} style={{ border: 'none', background: 'none', font: 'inherit', cursor: 'pointer', display: 'grid', justifyItems: 'center', alignContent: 'start', gap: 3, width: 64, height: 54, fontSize: 11, fontWeight: 600, color: tab === id ? accent : MUTED }}>
              <Icon name={icon} size={23} />
              {label}
            </button>
          ))}
        </nav>
      )}
      <div role="status" style={{ position: 'absolute', left: '50%', top: 58, zIndex: 30, transform: `translate(-50%, ${toast ? 0 : -90}px)`, transition: 'transform .35s cubic-bezier(.2,.8,.2,1)', padding: '10px 16px', borderRadius: 20, background: '#fff', color: '#1b1d45', fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap' }}>{toast}</div>
      <div style={{ position: 'absolute', left: '50%', bottom: 8, width: 140, height: 5, marginLeft: -70, borderRadius: 3, background: '#fff', opacity: 0.7, zIndex: 25 }} />
    </div>
  )

  return (
    <div ref={box} className="md-app" style={{ position: 'relative', width: '100%', height: '100%', display: 'grid', placeItems: 'center', overflow: 'hidden', background: 'radial-gradient(ellipse at 50% 30%, #2b2766, #0a0c1e 78%)', ...style }}>
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: `translate(-50%, -50%) scale(${scale})`, transformOrigin: 'center' }}>
        {frame ? (
          <div style={{ padding: 12, borderRadius: 58, background: 'linear-gradient(145deg, #3a3f5a, #12141f 40%, #2b2f44)', boxShadow: '0 40px 80px rgba(0,0,0,.5), inset 0 0 0 2px #4b516e' }}>
            <div style={{ padding: 2, borderRadius: 48, background: '#000' }}>{phone}</div>
          </div>
        ) : (
          phone
        )}
      </div>
    </div>
  )
}
