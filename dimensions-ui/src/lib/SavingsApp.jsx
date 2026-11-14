import { useEffect, useRef, useState } from 'react'

// A savings-goals app on a phone, as a click-through prototype. Five pages:
// Goals (a shelf of jars that fill as you save, plus a form for a new goal),
// Goal detail (progress ring, projected finish date that moves when you change
// the monthly amount, that goal's deposits), Add money (pick a goal, type on a
// keypad or tap quick-add chips), Activity (every deposit, filterable) and
// Settings (auto-save, round-ups, and a payday button that deposits every
// goal's monthly amount). Fill a goal to its target and a confetti
// celebration appears. Mint and deep-teal palette. The phone scales to fit
// whatever box it is in.

const W = 390
const H = 844
const INK = '#10352f'
const MUTED = '#6f8a84'
const BG = '#eef7f2'
const CARD = '#ffffff'
const LINE = '#dcebe4'

const DAY = 86400000
const money = (n) => `$${Math.round(n * 100) % 100 === 0 ? Math.round(n).toLocaleString('en-US') : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const hsl = (h, s = 65, l = 48) => `hsl(${h} ${s}% ${l}%)`
const dayLabel = (t) => {
  const d = Math.round((new Date(new Date().toDateString()) - new Date(new Date(t).toDateString())) / DAY)
  return d <= 0 ? 'Today' : d === 1 ? 'Yesterday' : new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
const projected = (g) => {
  const left = g.target - g.saved
  if (left <= 0) return 'Reached'
  if (!g.monthly) return 'Set a monthly amount'
  return new Date(Date.now() + (left / g.monthly) * 30.4 * DAY).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

const ICONS = {
  jar: 'M8 4h8v3c3 1 4 3 4 6v5a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-5c0-3 1-5 4-6z',
  plus: 'M12 5v14M5 12h14',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12l2-1-1-3-2 .5-1.5-1.5.5-2-3-1-1 2h-2l-1-2-3 1 .5 2L6.5 8 4.5 7.5l-1 3 2 1v2l-2 1 1 3 2-.5L8 18.5l-.5 2 3 1 1-2h2l1 2 3-1-.5-2 1.5-1.5 2 .5 1-3-2-1z',
  back: 'M15 5l-7 7 7 7',
  chev: 'M9 5l7 7-7 7',
  check: 'M5 12l5 5 9-10',
  minus: 'M5 12h14',
  plane: 'M3 13l18-8-5 15-4-6zM12 14l9-9',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  laptop: 'M5 6h14v9H5zM2 19h20',
  gift: 'M4 10h16v10H4zM3 7h18v3H3zM12 7v13M12 7c-3 0-5-3-2.5-4S12 7 12 7zm0 0c3 0 5-3 2.5-4S12 7 12 7z',
  home: 'M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
  bell: 'M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4',
  coin: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v10M9.5 9.5c0-1 1-1.5 2.5-1.5s2.5.6 2.5 1.7c0 2-5 1.3-5 3.5 0 1.1 1 1.8 2.5 1.8s2.5-.6 2.5-1.5',
  bolt: 'M13 3L5 14h6l-1 7 8-11h-6z',
}
const GOAL_ICONS = ['plane', 'shield', 'laptop', 'gift', 'home', 'star']
const HUES = [200, 150, 280, 25, 340, 45]

const NAV = [
  ['goals', 'jar', 'Goals'],
  ['add', 'plus', 'Add money'],
  ['activity', 'list', 'Activity'],
  ['settings', 'gear', 'Settings'],
]

function Icon({ name, size = 22, color = 'currentColor', w = 1.9 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  )
}

const BODY = 'M30 14h40v8q14 6 14 22v56q0 14-14 14H30q-14 0-14-14V44q0-16 14-22z'

function Jar({ pct, hue, icon, uid, size = 110 }) {
  const level = Math.max(0, Math.min(1, pct))
  const y = 114 - level * 92
  return (
    <svg width={size} height={size * 1.2} viewBox="0 0 100 120" role="img" aria-label={`${Math.round(level * 100)} percent full`} style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <clipPath id={`sj-${uid}`}><path d={BODY} /></clipPath>
        <linearGradient id={`sg-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={hsl(hue, 70, 62)} />
          <stop offset="1" stopColor={hsl(hue, 70, 42)} />
        </linearGradient>
      </defs>
      <path d={BODY} fill="rgba(255,255,255,.7)" />
      <g clipPath={`url(#sj-${uid})`}>
        <g style={{ transform: `translateY(${y}px)`, transition: 'transform .9s cubic-bezier(.3,.8,.3,1)' }}>
          <rect x="0" y="4" width="100" height="120" fill={`url(#sg-${uid})`} />
          <g className="sv-wave">
            <path d="M-100 4q12-7 25 0t25 0t25 0t25 0t25 0t25 0t25 0t25 0V-2H-100z" fill={hsl(hue, 70, 62)} />
          </g>
        </g>
      </g>
      <path d={BODY} fill="none" stroke={hsl(hue, 30, 35)} strokeWidth="2.5" strokeLinejoin="round" opacity=".75" />
      <rect x="26" y="4" width="48" height="11" rx="4" fill={hsl(hue, 30, 35)} opacity=".85" />
      <path d="M26 50v38" stroke="#fff" strokeWidth="4" strokeLinecap="round" opacity=".55" />
      <g transform="translate(38 54)" opacity={level > 0.5 ? 0.95 : 0.7} style={{ color: level > 0.5 ? '#fff' : hsl(hue, 40, 35) }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d={ICONS[icon]} /></svg>
      </g>
    </svg>
  )
}

function Ring({ value, size = 150, stroke = 14, color, children }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <div style={{ position: 'relative', width: size, height: size, margin: '0 auto' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={LINE} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(1, value))} style={{ transition: 'stroke-dashoffset .8s ease' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>{children}</div>
    </div>
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
          <rect x="0.5" y="0.5" width="22" height="11" rx="3.5" fill="none" stroke={INK} opacity=".45" />
          <rect x="2.5" y="2.5" width="16" height="7" rx="2" fill={INK} />
          <rect x="23.5" y="4" width="2" height="4" rx="1" fill={INK} opacity=".45" />
        </svg>
      </span>
    </div>
  )
}

const SEED_GOALS = [
  { id: 'g1', name: 'Japan trip', target: 3000, saved: 1860, monthly: 200, hue: 200, icon: 'plane' },
  { id: 'g2', name: 'Emergency fund', target: 5000, saved: 3150, monthly: 250, hue: 150, icon: 'shield' },
  { id: 'g3', name: 'New laptop', target: 1800, saved: 1710, monthly: 150, hue: 280, icon: 'laptop' },
  { id: 'g4', name: 'Mum’s gift', target: 400, saved: 120, monthly: 40, hue: 25, icon: 'gift' },
]
const seedDeposits = () => {
  const n = Date.now()
  return [['g3', 150, 0.2, 'Freelance payment'], ['g1', 200, 1, 'Monthly auto-save'], ['g2', 250, 1, 'Monthly auto-save'], ['g4', 40, 3, 'Monthly auto-save'], ['g1', 60, 6, 'Sold old bike'], ['g3', 75, 9, 'Quick add'], ['g2', 100, 12, 'Birthday money']].map(([goal, amt, d, note], i) => ({ id: `d${i}`, goal, amt, t: n - d * DAY, note }))
}

export default function SavingsApp({ name = 'Jarful', accent = '#0d9488', startScreen = 'goals', frame = true, style }) {
  const box = useRef()
  const toastTimer = useRef()
  const [scale, setScale] = useState(1)
  const [tab, setTab] = useState('goals')
  const [stack, setStack] = useState([])
  const [dir, setDir] = useState(1)
  const [toast, setToast] = useState('')
  const [goals, setGoals] = useState(SEED_GOALS)
  const [deposits, setDeposits] = useState(seedDeposits)
  const [pick, setPick] = useState('g3')
  const [amt, setAmt] = useState('')
  const [filter, setFilter] = useState('all')
  const [auto, setAuto] = useState(true)
  const [roundUps, setRoundUps] = useState(false)
  const [notify, setNotify] = useState(true)
  const [form, setForm] = useState({ name: '', target: '', hue: 200, icon: 'star' })

  useEffect(() => {
    setDir(1)
    if (startScreen === 'detail') {
      setTab('goals')
      setStack([{ id: 'goal', goal: 'g1' }])
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
  const push = (s) => (setDir(1), setStack((a) => [...a, s]))
  const pop = () => (setDir(-1), setStack((a) => a.slice(0, -1)))
  const go = (t) => (setDir(NAV.findIndex((n) => n[0] === t) >= NAV.findIndex((n) => n[0] === tab) ? 1 : -1), setTab(t), setStack([]))

  const goalOf = (id) => goals.find((g) => g.id === id)
  const total = goals.reduce((a, g) => a + g.saved, 0)
  const totalTarget = goals.reduce((a, g) => a + g.target, 0)

  // adds money to goals; entries: [[goalId, amount, note]]
  const deposit = (entries) => {
    const now = Date.now()
    const reached = entries.map(([id, a]) => ({ g: goalOf(id), a })).find(({ g, a }) => g.saved < g.target && g.saved + a >= g.target)
    setGoals((a) => a.map((g) => {
      const add = entries.filter((e) => e[0] === g.id).reduce((s, e) => s + e[1], 0)
      return add ? { ...g, saved: +(g.saved + add).toFixed(2) } : g
    }))
    setDeposits((a) => [...entries.map(([goal, amount, note], i) => ({ id: `d${now}${i}`, goal, amt: amount, t: now, note })), ...a])
    return reached?.g
  }

  const submitAdd = () => {
    const a = parseFloat(amt)
    if (!(a > 0)) return
    const done = deposit([[pick, a, 'Quick add']])
    setAmt('')
    setDir(1)
    setTab('goals')
    if (done) setStack([{ id: 'goal', goal: pick }, { id: 'celebrate', goal: pick }])
    else {
      setStack([{ id: 'goal', goal: pick }])
      say(`${money(a)} added to ${goalOf(pick).name}`)
    }
  }

  const tap = (k) =>
    setAmt((s) => {
      if (k === '⌫') return s.slice(0, -1)
      if (k === '.' && s.includes('.')) return s
      if (s.includes('.') && s.split('.')[1].length >= 2) return s
      if (s.length >= 7) return s
      if (k === '.' && !s) return '0.'
      return s + k
    })

  const createGoal = () => {
    const t = parseFloat(form.target)
    if (!form.name.trim() || !(t > 0)) return
    const id = `g${Date.now()}`
    setGoals((a) => [...a, { id, name: form.name.trim(), target: t, saved: 0, monthly: Math.max(10, Math.round(t / 12 / 10) * 10), hue: form.hue, icon: form.icon }])
    setPick(id)
    setForm({ name: '', target: '', hue: 200, icon: 'star' })
    say('New jar created')
    setDir(-1)
    setStack([{ id: 'goal', goal: id }])
  }

  const payday = () => {
    if (!auto) return say('Turn on auto-save first')
    const entries = goals.filter((g) => g.saved < g.target && g.monthly).map((g) => [g.id, Math.min(g.monthly, g.target - g.saved), 'Monthly auto-save'])
    if (!entries.length) return say('Nothing left to fund')
    const done = deposit(entries)
    say(`${money(entries.reduce((a, e) => a + e[1], 0))} saved across ${entries.length} jars`)
    if (done) {
      setDir(1)
      setTab('goals')
      setStack([{ id: 'celebrate', goal: done.id }])
    }
  }

  const header = (title, back, right) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 18px 6px', minHeight: 48 }}>
      {back && (
        <button type="button" onClick={back} aria-label="Back" style={{ display: 'grid', placeItems: 'center', width: 38, height: 38, border: 'none', borderRadius: '50%', background: CARD, cursor: 'pointer', color: INK, padding: 0 }}>
          <Icon name="back" size={20} />
        </button>
      )}
      <h1 style={{ margin: 0, flex: 1, fontSize: back ? 18 : 28, fontWeight: 800, letterSpacing: '-0.02em', marginLeft: 4 }}>{title}</h1>
      {right}
    </div>
  )

  const primary = (label, onClick, disabled) => (
    <button type="button" disabled={disabled} onClick={onClick} style={{ width: '100%', height: 52, borderRadius: 26, border: 'none', background: disabled ? '#c9ddd5' : accent, color: '#fff', font: 'inherit', fontSize: 15, fontWeight: 700, cursor: disabled ? 'default' : 'pointer', boxShadow: disabled ? 'none' : `0 8px 18px ${accent}44` }}>{label}</button>
  )
  const secondary = (label, onClick) => (
    <button type="button" onClick={onClick} style={{ width: '100%', height: 48, borderRadius: 24, border: 'none', background: '#dcebe4', color: INK, font: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>{label}</button>
  )
  const chip = (on, label, onClick) => (
    <button key={label} type="button" onClick={onClick} aria-pressed={on} style={{ flex: 'none', height: 36, padding: '0 14px', borderRadius: 18, border: 'none', background: on ? accent : CARD, color: on ? '#fff' : INK, font: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{label}</button>
  )
  const toggle = (on, set, label) => (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => set(!on)} style={{ width: 48, height: 28, borderRadius: 14, border: 'none', padding: 3, background: on ? accent : '#c9ddd5', cursor: 'pointer', transition: 'background .2s', flex: 'none' }}>
      <span style={{ display: 'block', width: 22, height: 22, borderRadius: '50%', background: '#fff', transform: `translateX(${on ? 20 : 0}px)`, transition: 'transform .2s' }} />
    </button>
  )
  const depositRow = (d) => {
    const g = goalOf(d.goal)
    if (!g) return null
    return (
      <button key={d.id} type="button" onClick={() => push({ id: 'goal', goal: g.id })} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '11px 14px', border: 'none', borderRadius: 20, background: CARD, font: 'inherit', textAlign: 'left', cursor: 'pointer', color: INK }}>
        <span style={{ width: 40, height: 40, borderRadius: 14, display: 'grid', placeItems: 'center', background: hsl(g.hue, 70, 92), color: hsl(g.hue, 55, 35) }}><Icon name={g.icon} size={20} /></span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700 }}>{g.name}</span>
          <span style={{ display: 'block', fontSize: 12, color: MUTED, marginTop: 2 }}>{d.note} · {dayLabel(d.t)}</span>
        </span>
        <span style={{ fontSize: 14.5, fontWeight: 800, color: '#15803d' }}>+{money(d.amt)}</span>
      </button>
    )
  }

  // ---- screens
  let body
  let tabbed = true
  if (top?.id === 'celebrate') {
    tabbed = false
    const g = goalOf(top.goal)
    const bits = Array.from({ length: 26 }, (_, i) => ({ x: (i * 37) % 100, d: (i % 7) * 0.12, c: [hsl(g.hue, 75, 55), '#f59e0b', '#ef4444', '#8b5cf6', '#10b981'][i % 5], r: (i * 53) % 360 }))
    body = (
      <div style={{ position: 'relative', textAlign: 'center', padding: '80px 24px 0', overflow: 'hidden', height: '100%' }}>
        {bits.map((b, i) => <i key={i} className="sv-conf" style={{ left: `${b.x}%`, background: b.c, animationDelay: `${b.d}s`, '--r': `${b.r}deg` }} />)}
        <div style={{ display: 'inline-block', animation: 'sv-pop .6s cubic-bezier(.2,1.4,.4,1) both' }}><Jar pct={1} hue={g.hue} icon={g.icon} uid="cele" size={150} /></div>
        <div style={{ fontSize: 28, fontWeight: 800, marginTop: 22, letterSpacing: '-0.02em' }}>Goal reached!</div>
        <div style={{ fontSize: 15, color: MUTED, marginTop: 8, lineHeight: 1.5 }}>You saved {money(g.target)} for <b style={{ color: INK }}>{g.name}</b>.<br />Time to enjoy it.</div>
        <div style={{ display: 'grid', gap: 10, marginTop: 34 }}>
          {primary('See my goals', () => go('goals'))}
          {secondary('View goal', () => (setDir(-1), setStack([{ id: 'goal', goal: g.id }])))}
        </div>
      </div>
    )
  } else if (top?.id === 'goal') {
    tabbed = false
    const g = goalOf(top.goal)
    if (!g) {
      body = header('Goal', pop)
    } else {
      const pct = g.saved / g.target
      const mine = deposits.filter((d) => d.goal === g.id)
      body = (
        <>
          {header(g.name, pop)}
          <div style={{ margin: '6px 18px 0', padding: '22px 16px 18px', borderRadius: 28, background: CARD, textAlign: 'center' }}>
            <Ring value={pct} color={hsl(g.hue)} size={164}>
              <div>
                <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1 }}>{Math.min(100, Math.floor(pct * 100))}%</div>
                <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>funded</div>
              </div>
            </Ring>
            <div style={{ fontSize: 24, fontWeight: 800, marginTop: 14 }}>{money(g.saved)} <span style={{ fontSize: 15, color: MUTED, fontWeight: 600 }}>of {money(g.target)}</span></div>
            <div style={{ fontSize: 13, color: MUTED, marginTop: 2 }}>{g.saved >= g.target ? 'Goal complete' : `${money(g.target - g.saved)} to go`}</div>
          </div>
          <div style={{ margin: '10px 18px 0', padding: '14px 16px', borderRadius: 22, background: CARD, display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13.5, color: MUTED }}>Projected finish</span>
              <b style={{ fontSize: 15, color: g.saved >= g.target ? '#15803d' : INK }}>{projected(g)}</b>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13.5, color: MUTED }}>Monthly saving</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button type="button" onClick={() => setGoals((a) => a.map((x) => (x.id === g.id ? { ...x, monthly: Math.max(0, x.monthly - 10) } : x)))} aria-label="Decrease monthly" style={{ width: 30, height: 30, borderRadius: '50%', border: `1px solid ${LINE}`, background: 'none', color: INK, cursor: 'pointer', display: 'grid', placeItems: 'center', padding: 0 }}><Icon name="minus" size={14} /></button>
                <b style={{ minWidth: 56, textAlign: 'center', fontSize: 15 }}>{money(g.monthly)}</b>
                <button type="button" onClick={() => setGoals((a) => a.map((x) => (x.id === g.id ? { ...x, monthly: x.monthly + 10 } : x)))} aria-label="Increase monthly" style={{ width: 30, height: 30, borderRadius: '50%', border: `1px solid ${LINE}`, background: 'none', color: INK, cursor: 'pointer', display: 'grid', placeItems: 'center', padding: 0 }}><Icon name="plus" size={14} /></button>
              </span>
            </div>
          </div>
          <div style={{ padding: '12px 18px 0' }}>{primary('Add money', () => (setPick(g.id), setDir(1), setTab('add'), setStack([])))}</div>
          <div style={{ padding: '18px 20px 8px', fontSize: 15, fontWeight: 800 }}>Deposits</div>
          <div style={{ display: 'grid', gap: 8, padding: '0 18px' }}>
            {mine.slice(0, 5).map(depositRow)}
            {!mine.length && <div style={{ textAlign: 'center', color: MUTED, fontSize: 13, padding: '16px 0' }}>No deposits yet. Add your first one.</div>}
          </div>
        </>
      )
    }
  } else if (top?.id === 'newgoal') {
    tabbed = false
    const valid = form.name.trim() && parseFloat(form.target) > 0
    body = (
      <>
        {header('New goal', pop)}
        <div style={{ display: 'grid', gap: 14, padding: '4px 18px 0' }}>
          <div style={{ display: 'grid', placeItems: 'center', padding: '4px 0' }}><Jar pct={0.35} hue={form.hue} icon={form.icon} uid="new" size={96} /></div>
          <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 700, color: MUTED }}>
            What are you saving for?
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value.slice(0, 22) }))} placeholder="e.g. New camera" style={{ height: 50, borderRadius: 16, border: `2px solid ${LINE}`, background: CARD, padding: '0 14px', font: 'inherit', fontSize: 16, fontWeight: 600, color: INK, outline: 'none' }} />
          </label>
          <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 700, color: MUTED }}>
            Target amount ($)
            <input inputMode="decimal" value={form.target} onChange={(e) => setForm((f) => ({ ...f, target: e.target.value.replace(/[^0-9.]/g, '').slice(0, 7) }))} placeholder="1000" style={{ height: 50, borderRadius: 16, border: `2px solid ${LINE}`, background: CARD, padding: '0 14px', font: 'inherit', fontSize: 16, fontWeight: 600, color: INK, outline: 'none' }} />
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            {GOAL_ICONS.map((i) => (
              <button key={i} type="button" onClick={() => setForm((f) => ({ ...f, icon: i }))} aria-pressed={form.icon === i} aria-label={i} style={{ width: 46, height: 46, borderRadius: 15, border: form.icon === i ? `2.5px solid ${hsl(form.hue)}` : `2px solid ${LINE}`, background: CARD, color: form.icon === i ? hsl(form.hue) : MUTED, display: 'grid', placeItems: 'center', cursor: 'pointer', padding: 0 }}><Icon name={i} size={22} /></button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {HUES.map((h) => (
              <button key={h} type="button" onClick={() => setForm((f) => ({ ...f, hue: h }))} aria-pressed={form.hue === h} aria-label={`Colour ${h}`} style={{ width: 38, height: 38, borderRadius: '50%', border: form.hue === h ? `3px solid ${INK}` : '3px solid transparent', outline: '2px solid #fff', outlineOffset: -5, background: hsl(h), cursor: 'pointer', padding: 0 }} />
            ))}
          </div>
          {primary('Create jar', createGoal, !valid)}
        </div>
      </>
    )
  } else if (tab === 'goals') {
    body = (
      <>
        <div style={{ padding: '8px 20px 0' }}>
          <div style={{ fontSize: 13, color: MUTED, fontWeight: 600 }}>{name}</div>
          <h1 style={{ margin: '2px 0 0', fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em' }}>My goals</h1>
        </div>
        <div style={{ margin: '14px 18px 0', padding: 18, borderRadius: 26, color: '#fff', background: `linear-gradient(135deg, ${accent}, #064e46)`, boxShadow: `0 14px 28px ${accent}44` }}>
          <div style={{ fontSize: 13, opacity: 0.85 }}>Total saved</div>
          <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-0.03em' }}>{money(total)}</div>
          <div style={{ height: 8, borderRadius: 4, background: 'rgba(255,255,255,.25)', marginTop: 10, overflow: 'hidden' }}><i style={{ display: 'block', height: '100%', width: `${(total / totalTarget) * 100}%`, background: '#fff', borderRadius: 4, transition: 'width .6s' }} /></div>
          <div style={{ fontSize: 12.5, opacity: 0.85, marginTop: 6 }}>{Math.round((total / totalTarget) * 100)}% of {money(totalTarget)} across {goals.length} goals</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '14px 18px 0' }}>
          {goals.map((g) => (
            <button key={g.id} type="button" onClick={() => push({ id: 'goal', goal: g.id })} aria-label={`Open ${g.name}`} style={{ border: 'none', borderRadius: 24, background: CARD, padding: '14px 10px 12px', font: 'inherit', cursor: 'pointer', color: INK, display: 'grid', justifyItems: 'center', gap: 6 }}>
              <Jar pct={g.saved / g.target} hue={g.hue} icon={g.icon} uid={g.id} size={86} />
              <span style={{ fontSize: 14, fontWeight: 800, textAlign: 'center' }}>{g.name}</span>
              <span style={{ fontSize: 12, color: MUTED, fontWeight: 600 }}>{g.saved >= g.target ? 'Complete' : `${money(g.saved)} / ${money(g.target)}`}</span>
            </button>
          ))}
          <button type="button" onClick={() => push({ id: 'newgoal' })} style={{ minHeight: 190, border: `2px dashed ${accent}77`, borderRadius: 24, background: 'none', color: accent, font: 'inherit', fontSize: 14, fontWeight: 800, cursor: 'pointer', display: 'grid', placeItems: 'center', alignContent: 'center', gap: 6 }}>
            <Icon name="plus" size={30} w={2.2} />
            New goal
          </button>
        </div>
      </>
    )
  } else if (tab === 'add') {
    const a = parseFloat(amt) || 0
    const g = goalOf(pick) || goals[0]
    body = (
      <>
        {header('Add money')}
        <div className="sv-scroll" style={{ display: 'flex', gap: 8, padding: '2px 18px 8px', overflowX: 'auto' }} role="group" aria-label="Goal">
          {goals.map((x) => chip(pick === x.id, x.name, () => setPick(x.id)))}
        </div>
        <div style={{ textAlign: 'center', padding: '8px 20px 0' }}>
          <div style={{ fontSize: 13, color: MUTED }}>Into {g.name} · {money(g.saved)} of {money(g.target)}</div>
          <div style={{ fontSize: 50, fontWeight: 800, letterSpacing: '-0.03em', color: amt ? INK : '#b6cdc5' }}>${amt || '0'}</div>
          <div style={{ fontSize: 12.5, color: MUTED, minHeight: 18 }}>{a > 0 ? (g.saved + a >= g.target ? 'This completes your goal!' : `New total ${money(g.saved + a)}`) : ' '}</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: '8px 18px' }}>
          {[10, 25, 50, 100].map((n) => (
            <button key={n} type="button" onClick={() => setAmt(String(((parseFloat(amt) || 0) + n)))} style={{ height: 36, padding: '0 14px', borderRadius: 18, border: `1.5px solid ${accent}`, background: 'none', color: accent, font: 'inherit', fontSize: 13.5, fontWeight: 800, cursor: 'pointer' }}>+${n}</button>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, padding: '6px 28px 10px' }}>
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'].map((k) => (
            <button key={k} type="button" onClick={() => tap(k)} aria-label={k === '⌫' ? 'Delete' : k} style={{ height: 52, border: 'none', borderRadius: 16, background: CARD, font: 'inherit', fontSize: 22, fontWeight: 700, cursor: 'pointer', color: INK }}>{k}</button>
          ))}
        </div>
        <div style={{ padding: '2px 20px' }}>{primary(a > 0 ? `Add ${money(a)}` : 'Add money', submitAdd, !(a > 0))}</div>
      </>
    )
  } else if (tab === 'activity') {
    const list = deposits.filter((d) => filter === 'all' || d.goal === filter)
    const days = [...new Set(list.map((d) => dayLabel(d.t)))]
    body = (
      <>
        {header('Activity')}
        <div className="sv-scroll" style={{ display: 'flex', gap: 8, padding: '2px 18px 10px', overflowX: 'auto' }} role="group" aria-label="Filter">
          {chip(filter === 'all', 'All', () => setFilter('all'))}
          {goals.map((g) => chip(filter === g.id, g.name, () => setFilter(g.id)))}
        </div>
        <div style={{ padding: '0 18px', display: 'grid', gap: 8 }}>
          <div style={{ padding: '4px 4px 2px', fontSize: 13, color: MUTED }}>{list.length} deposits · {money(list.reduce((a, d) => a + d.amt, 0))} saved</div>
          {days.map((d) => (
            <div key={d} style={{ display: 'grid', gap: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: MUTED, margin: '6px 0 0', textTransform: 'uppercase', letterSpacing: '.06em' }}>{d}</div>
              {list.filter((x) => dayLabel(x.t) === d).map(depositRow)}
            </div>
          ))}
          {!list.length && <div style={{ textAlign: 'center', color: MUTED, fontSize: 13, padding: '30px 0' }}>No deposits yet.</div>}
        </div>
      </>
    )
  } else {
    const row = (icon, label, sub, right) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 0', borderBottom: `1px solid ${LINE}` }}>
        <span style={{ width: 36, height: 36, borderRadius: 12, display: 'grid', placeItems: 'center', background: `${accent}1f`, color: accent, flex: 'none' }}><Icon name={icon} size={19} /></span>
        <span style={{ flex: 1 }}>
          <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700 }}>{label}</span>
          <span style={{ display: 'block', fontSize: 12, color: MUTED, marginTop: 1 }}>{sub}</span>
        </span>
        {right}
      </div>
    )
    body = (
      <>
        {header('Settings')}
        <div style={{ margin: '4px 18px 0', padding: '2px 16px', background: CARD, borderRadius: 22 }}>
          {row('coin', 'Auto-save', 'Deposit each goal’s monthly amount', toggle(auto, (v) => (setAuto(v), say(v ? 'Auto-save on' : 'Auto-save off')), 'Auto-save'))}
          {row('bolt', 'Round-ups', 'Round purchases up and save the change', toggle(roundUps, (v) => (setRoundUps(v), say(v ? 'Round-ups on' : 'Round-ups off')), 'Round-ups'))}
          {row('bell', 'Goal reminders', 'A nudge when you fall behind', toggle(notify, setNotify, 'Goal reminders'))}
        </div>
        <div style={{ margin: '14px 18px 0', padding: 16, borderRadius: 22, background: CARD }}>
          <div style={{ fontSize: 15, fontWeight: 800 }}>Payday</div>
          <div style={{ fontSize: 13, color: MUTED, margin: '3px 0 12px', lineHeight: 1.45 }}>Deposit this month's amount into every unfinished goal now: {money(goals.filter((g) => g.saved < g.target).reduce((a, g) => a + Math.min(g.monthly, g.target - g.saved), 0))} in total.</div>
          {primary('Run auto-save now', payday)}
        </div>
        <div style={{ padding: '14px 18px 0' }}>{secondary('Reset demo data', () => (setGoals(SEED_GOALS), setDeposits(seedDeposits()), setAmt(''), say('Demo reset')))}</div>
      </>
    )
  }

  const phone = (
    <div style={{ position: 'relative', width: W, height: H, overflow: 'hidden', borderRadius: frame ? 46 : 0, background: BG, color: INK, fontFamily: "'Nunito', 'Avenir Next', 'Segoe UI', system-ui, sans-serif" }}>
      <style>{`
        @keyframes sv-r { from { opacity: 0; transform: translateX(34px) } to { opacity: 1; transform: none } }
        @keyframes sv-l { from { opacity: 0; transform: translateX(-34px) } to { opacity: 1; transform: none } }
        @keyframes sv-pop { from { transform: scale(.3); opacity: 0 } to { transform: none; opacity: 1 } }
        @keyframes sv-wave { from { transform: translateX(0) } to { transform: translateX(50px) } }
        @keyframes sv-fall { from { transform: translateY(-20px) rotate(0); opacity: 1 } to { transform: translateY(760px) rotate(var(--r)); opacity: .9 } }
        .sv-wave { animation: sv-wave 2.4s linear infinite }
        .sv-conf { position: absolute; top: 0; width: 9px; height: 14px; border-radius: 2px; animation: sv-fall 2.6s ease-in both }
        .sv-scroll { scrollbar-width: none } .sv-scroll::-webkit-scrollbar { display: none }
        .sv-app button:focus-visible, .sv-app input:focus-visible { outline: 2px solid ${accent}; outline-offset: 2px }
        @media (prefers-reduced-motion: reduce) { .sv-wave, .sv-conf { animation: none } .sv-conf { display: none } .sv-view { animation: none !important } }
      `}</style>
      <StatusBar frame={frame} />
      <div key={`${tab}/${stack.map((s) => s.id + (s.goal || '')).join('/')}`} className="sv-scroll sv-view" style={{ position: 'absolute', top: 54, bottom: tabbed ? 88 : 0, left: 0, right: 0, overflowY: 'auto', paddingBottom: 24, animation: `${dir > 0 ? 'sv-r' : 'sv-l'} .28s ease` }}>
        {body}
      </div>
      {tabbed && (
        <nav aria-label="Main" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 88, background: CARD, borderRadius: '26px 26px 0 0', boxShadow: '0 -6px 20px rgba(16,53,47,.08)', display: 'flex', justifyContent: 'space-around', padding: '10px 8px 0' }}>
          {NAV.map(([id, icon, label]) => (
            <button key={id} type="button" onClick={() => go(id)} aria-current={tab === id ? 'page' : undefined} style={{ border: 'none', background: 'none', font: 'inherit', cursor: 'pointer', display: 'grid', justifyItems: 'center', alignContent: 'start', gap: 3, width: 76, height: 54, fontSize: 11, fontWeight: 700, color: tab === id ? accent : MUTED }}>
              <Icon name={icon} size={23} />
              {label}
            </button>
          ))}
        </nav>
      )}
      <div role="status" style={{ position: 'absolute', left: '50%', top: 58, zIndex: 30, transform: `translate(-50%, ${toast ? 0 : -90}px)`, transition: 'transform .35s cubic-bezier(.2,.8,.2,1)', padding: '10px 16px', borderRadius: 20, background: INK, color: '#fff', fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap' }}>{toast}</div>
      <div style={{ position: 'absolute', left: '50%', bottom: 8, width: 140, height: 5, marginLeft: -70, borderRadius: 3, background: INK, opacity: 0.8, zIndex: 25 }} />
    </div>
  )

  return (
    <div ref={box} className="sv-app" style={{ position: 'relative', width: '100%', height: '100%', display: 'grid', placeItems: 'center', overflow: 'hidden', background: 'radial-gradient(ellipse at 50% 30%, #d8f1e6, #9cc9b8 75%)', ...style }}>
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: `translate(-50%, -50%) scale(${scale})`, transformOrigin: 'center' }}>
        {frame ? (
          <div style={{ padding: 12, borderRadius: 58, background: 'linear-gradient(145deg, #34433f, #111a18 40%, #2a3532)', boxShadow: '0 40px 80px rgba(16,53,47,.35), inset 0 0 0 2px #476059' }}>
            <div style={{ padding: 2, borderRadius: 48, background: '#000' }}>{phone}</div>
          </div>
        ) : (
          phone
        )}
      </div>
    </div>
  )
}
