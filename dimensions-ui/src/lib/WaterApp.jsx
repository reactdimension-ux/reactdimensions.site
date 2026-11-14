import { useEffect, useRef, useState } from 'react'

// A water-intake tracker on a phone, as a click-through prototype. Five tabs
// (Today, History, Goals, Reminders, Settings). Tap a drink size on Today and
// the big wave-filled bubble rises, the log gains a line and History's bar for
// today grows; tap a log line to edit or delete it, undo the last sip, or switch
// the drink type (coffee and tea count a little less). Goals has a real daily
// goal slider with a weight-based suggestion and badges that unlock as you hit
// targets. Reminders has an interval picker, an editable window and a test
// notification. Settings switches ml/oz. Detail screens slide in from the
// right. The phone scales to fit its box; the wave respects prefers-reduced-motion.

const W = 390
const H = 844
const INK = '#0b2b3f'
const MUTED = '#6a8799'
const BG = '#eaf7fb'
const FONT = "-apple-system, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif"

const DRINKS = {
  water: { label: 'Water', f: 1, color: '#2bb3e6' },
  tea: { label: 'Tea', f: 0.9, color: '#c58a4b' },
  coffee: { label: 'Coffee', f: 0.8, color: '#7a4b2a' },
  juice: { label: 'Juice', f: 0.85, color: '#f08a24' },
}
const SIZES = [150, 250, 330, 500]

const ICONS = {
  drop: 'M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z',
  chart: 'M5 20V10M12 20V4M19 20v-7',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 12h.01',
  bell: 'M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.4 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.4-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.2-.8.2-1.2z',
  back: 'M15 5l-7 7 7 7',
  chev: 'M9 5l7 7-7 7',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  x: 'M6 6l12 12M18 6L6 18',
  check: 'M5 12l5 5 9-10',
  undo: 'M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
  trash: 'M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13',
  flame: 'M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z',
  trophy: 'M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8',
  cup: 'M5 8h11v6a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4zM16 9h2a2 2 0 0 1 0 5h-2',
}

function Icon({ name, size = 22, color = 'currentColor', w = 1.9 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  )
}

const iconBtn = { display: 'grid', placeItems: 'center', border: 'none', borderRadius: '50%', cursor: 'pointer', padding: 0, background: '#fff', color: INK }

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

const NAV = [
  ['today', 'drop', 'Today'],
  ['history', 'chart', 'History'],
  ['goals', 'target', 'Goals'],
  ['reminders', 'bell', 'Reminders'],
  ['settings', 'gear', 'Settings'],
]
const PAGE_IDS = NAV.map((n) => n[0])

const hhmm = (d = new Date()) => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
const fmtHour = (h) => `${String(h).padStart(2, '0')}:00`

// ---------------------------------------------------------------- app

export default function WaterApp({ name = 'Dewdrop', accent = '#1fa8e0', startScreen = 'today', goal: startGoal = 2400, frame = true, style }) {
  const box = useRef()
  const toastTimer = useRef()
  const nid = useRef(10)
  const [scale, setScale] = useState(1)
  const [tab, setTab] = useState(PAGE_IDS.includes(startScreen) ? startScreen : 'today')
  const [stack, setStack] = useState([])
  const [dir, setDir] = useState(1)
  const [toast, setToast] = useState('')
  const [goal, setGoal] = useState(startGoal)
  const [drink, setDrink] = useState('water')
  const [log, setLog] = useState([
    { id: 1, ml: 250, type: 'water', time: '07:30' },
    { id: 2, ml: 330, type: 'coffee', time: '09:10' },
    { id: 3, ml: 500, type: 'water', time: '11:45' },
  ])
  const [oz, setOz] = useState(false)
  const [range, setRange] = useState('week')
  const [pickDay, setPickDay] = useState(null)
  const [weight, setWeight] = useState(72)
  const [active, setActive] = useState(true)
  const [hot, setHot] = useState(false)
  const [remOn, setRemOn] = useState(true)
  const [every, setEvery] = useState(2)
  const [from, setFrom] = useState(8)
  const [to, setTo] = useState(20)
  const [off, setOff] = useState({})
  const [sound, setSound] = useState(true)
  const [banner, setBanner] = useState(false)
  const bannerTimer = useRef()

  useEffect(() => {
    setTab(PAGE_IDS.includes(startScreen) ? startScreen : 'today')
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

  const say = (t) => {
    setToast(t)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 1900)
  }
  useEffect(() => () => (clearTimeout(toastTimer.current), clearTimeout(bannerTimer.current)), [])

  const top = stack[stack.length - 1]
  const push = (s) => (setDir(1), setStack((a) => [...a, s]))
  const pop = () => (setDir(-1), setStack((a) => a.slice(0, -1)))
  const go = (t) => (setDir(NAV.findIndex((n) => n[0] === t) >= NAV.findIndex((n) => n[0] === tab) ? 1 : -1), setTab(t), setStack([]))

  const eff = (e) => Math.round(e.ml * DRINKS[e.type].f)
  const total = log.reduce((s, e) => s + eff(e), 0)
  const pct = Math.min(1, total / goal)
  const U = (ml) => (oz ? `${(ml / 29.57).toFixed(1)} oz` : `${ml.toLocaleString()} ml`)
  const Un = (ml) => (oz ? (ml / 29.57).toFixed(oz ? 0 : 0) : String(ml))
  const suggested = Math.round((weight * 33 + (active ? 400 : 0) + (hot ? 300 : 0)) / 50) * 50

  const add = (ml, type = drink) => {
    const e = { id: nid.current++, ml, type, time: hhmm() }
    const before = total
    const after = before + Math.round(ml * DRINKS[type].f)
    setLog((l) => [...l, e])
    if (before < goal && after >= goal) say('Goal reached. Great work!')
    else say(`+${U(ml)} ${DRINKS[type].label.toLowerCase()}`)
  }
  const undo = () => {
    if (!log.length) return say('Nothing to undo')
    setLog((l) => l.slice(0, -1))
    say('Last entry removed')
  }

  // history: six earlier days + today live
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const todayIdx = (new Date().getDay() + 6) % 7
  const pastWeek = [1900, 2600, 2250, 1500, 2700, 2100]
  const week = Array.from({ length: 7 }, (_, i) => {
    const back = 6 - i
    return { label: dayNames[(todayIdx - back + 7) % 7], ml: i === 6 ? total : pastWeek[i], today: i === 6 }
  })
  const month = Array.from({ length: 28 }, (_, i) => ({ label: `Day ${i + 1}`, ml: i === 27 ? total : 1300 + ((i * 397) % 1500), today: i === 27 }))
  const series = range === 'week' ? week : month
  const avg = Math.round(series.reduce((s, d) => s + d.ml, 0) / series.length)
  let streak = 0
  for (let i = week.length - 1; i >= 0; i--) {
    if (week[i].ml >= goal * 0.9 || (week[i].today && total < goal)) {
      if (week[i].today && total < goal) continue
      streak++
    } else break
  }
  const hits = series.filter((d) => d.ml >= goal).length

  const BADGES = [
    { id: 'first', label: 'First sip', note: 'Log your first drink', ok: log.length > 0 },
    { id: 'half', label: 'Halfway', note: 'Reach 50% of your goal', ok: pct >= 0.5 },
    { id: 'goal', label: 'Goal crusher', note: 'Hit your daily goal', ok: pct >= 1 },
    { id: 'streak', label: 'Three in a row', note: '3 days on target', ok: streak >= 3 },
    { id: 'var', label: 'Variety pack', note: 'Log 3 drink types', ok: new Set(log.map((e) => e.type)).size >= 3 },
  ]

  const reminderTimes = []
  for (let h = from; h <= to; h += every) reminderTimes.push(h)

  const testReminder = () => {
    setBanner(true)
    clearTimeout(bannerTimer.current)
    bannerTimer.current = setTimeout(() => setBanner(false), 3200)
  }

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

  const card = { background: '#fff', borderRadius: 22, padding: 16 }

  const toggle = (on, set, label) => (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => set(!on)} style={{ width: 48, height: 28, borderRadius: 14, border: 'none', padding: 3, background: on ? accent : '#c3d5de', cursor: 'pointer', transition: 'background .2s', flex: 'none' }}>
      <span style={{ display: 'block', width: 22, height: 22, borderRadius: '50%', background: '#fff', transform: `translateX(${on ? 20 : 0}px)`, transition: 'transform .2s' }} />
    </button>
  )

  const line = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 0', borderBottom: '1px solid #e6eff3', fontSize: 14.5, fontWeight: 600, gap: 10 }

  const stepper = (val, dec, inc, label) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <button type="button" onClick={dec} aria-label={`Decrease ${label}`} style={{ ...iconBtn, width: 32, height: 32, background: '#e1f1f7', color: accent }}><Icon name="minus" size={16} /></button>
      <span style={{ minWidth: 58, textAlign: 'center', fontWeight: 800 }}>{val}</span>
      <button type="button" onClick={inc} aria-label={`Increase ${label}`} style={{ ...iconBtn, width: 32, height: 32, background: '#e1f1f7', color: accent }}><Icon name="plus" size={16} /></button>
    </span>
  )

  const chip = (label, on, onClick) => (
    <button key={label} type="button" aria-pressed={on} onClick={onClick} style={{ flex: 'none', height: 36, padding: '0 14px', borderRadius: 18, border: 'none', background: on ? accent : '#fff', color: on ? '#fff' : INK, font: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{label}</button>
  )

  const primary = (label, onClick, tone) => (
    <button type="button" onClick={onClick} style={{ width: '100%', height: 52, borderRadius: 26, border: 'none', background: tone || accent, color: '#fff', font: 'inherit', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>{label}</button>
  )

  const entryRow = (e) => (
    <button key={e.id} type="button" onClick={() => push({ id: 'entry', eid: e.id })} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '11px 14px', border: 'none', borderRadius: 18, background: '#fff', font: 'inherit', textAlign: 'left', cursor: 'pointer', color: INK }}>
      <span style={{ width: 40, height: 40, borderRadius: 14, display: 'grid', placeItems: 'center', background: `${DRINKS[e.type].color}22`, color: DRINKS[e.type].color }}>
        <Icon name={e.type === 'water' ? 'drop' : 'cup'} size={20} />
      </span>
      <span style={{ flex: 1 }}>
        <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700 }}>{DRINKS[e.type].label}</span>
        <span style={{ display: 'block', fontSize: 12, color: MUTED }}>{e.time}</span>
      </span>
      <span style={{ fontSize: 15, fontWeight: 800 }}>{U(e.ml)}</span>
    </button>
  )

  // ---- screens
  let body
  let tabbed = true
  if (top?.id === 'entry') {
    tabbed = false
    const e = log.find((x) => x.id === top.eid)
    if (!e) {
      body = <>{header('Entry', pop)}<div style={{ padding: 30, textAlign: 'center', color: MUTED }}>This entry was removed.</div></>
    } else {
      body = (
        <>
          {header('Edit entry', pop)}
          <div style={{ textAlign: 'center', padding: '10px 20px' }}>
            <span style={{ width: 72, height: 72, borderRadius: 26, display: 'inline-grid', placeItems: 'center', background: `${DRINKS[e.type].color}22`, color: DRINKS[e.type].color }}><Icon name="drop" size={34} /></span>
            <div style={{ fontSize: 38, fontWeight: 800, letterSpacing: '-0.03em', marginTop: 10 }}>{U(e.ml)}</div>
            <div style={{ fontSize: 13, color: MUTED }}>{DRINKS[e.type].label} at {e.time} · counts as {U(eff(e))}</div>
          </div>
          <div style={{ margin: '0 20px', ...card }}>
            <div style={line}>
              <span>Amount</span>
              {stepper(Un(e.ml), () => setLog((l) => l.map((x) => (x.id === e.id ? { ...x, ml: Math.max(50, x.ml - 50) } : x))), () => setLog((l) => l.map((x) => (x.id === e.id ? { ...x, ml: Math.min(1500, x.ml + 50) } : x))), 'amount')}
            </div>
            <div style={{ padding: '12px 0 4px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {Object.entries(DRINKS).map(([k, d]) => chip(d.label, e.type === k, () => setLog((l) => l.map((x) => (x.id === e.id ? { ...x, type: k } : x)))))}
            </div>
          </div>
          <div style={{ padding: '16px 20px', display: 'grid', gap: 10 }}>
            {primary('Done', () => (pop(), say('Entry updated')))}
            {primary('Delete entry', () => (setLog((l) => l.filter((x) => x.id !== e.id)), pop(), say('Entry deleted')), '#e5484d')}
          </div>
        </>
      )
    }
  } else if (top?.id === 'day') {
    tabbed = false
    const d = series[top.i]
    body = (
      <>
        {header(d.today ? 'Today' : d.label, pop)}
        <div style={{ textAlign: 'center', padding: '14px 20px' }}>
          <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: '-0.03em' }}>{U(d.ml)}</div>
          <div style={{ fontSize: 13, color: d.ml >= goal ? '#12905f' : MUTED }}>{d.ml >= goal ? 'Goal met' : `${U(goal - d.ml)} short of goal`}</div>
        </div>
        <div style={{ margin: '0 20px', ...card }}>
          <div style={line}><span style={{ color: MUTED }}>Percent of goal</span><span>{Math.round((d.ml / goal) * 100)}%</span></div>
          <div style={line}><span style={{ color: MUTED }}>Versus average</span><span>{d.ml >= avg ? '+' : '−'}{U(Math.abs(d.ml - avg))}</span></div>
          <div style={{ ...line, borderBottom: 'none' }}><span style={{ color: MUTED }}>Glasses (250 ml)</span><span>{(d.ml / 250).toFixed(1)}</span></div>
        </div>
        {d.today && <div style={{ padding: '16px 20px' }}>{primary('Back to today', () => go('today'))}</div>}
      </>
    )
  } else if (top?.id === 'badge') {
    tabbed = false
    const b = BADGES.find((x) => x.id === top.b)
    body = (
      <>
        {header('Badge', pop)}
        <div style={{ textAlign: 'center', padding: '30px 24px' }}>
          <span style={{ width: 110, height: 110, borderRadius: '50%', display: 'inline-grid', placeItems: 'center', background: b.ok ? '#fff3c4' : '#dbe7ec', color: b.ok ? '#c98a00' : '#8aa2ae' }}><Icon name="trophy" size={52} /></span>
          <div style={{ fontSize: 24, fontWeight: 800, marginTop: 16 }}>{b.label}</div>
          <div style={{ fontSize: 14, color: MUTED, marginTop: 4 }}>{b.note}</div>
          <div style={{ marginTop: 14, fontWeight: 700, color: b.ok ? '#12905f' : MUTED }}>{b.ok ? 'Unlocked' : 'Not yet unlocked'}</div>
          {!b.ok && <div style={{ padding: '24px 0 0' }}>{primary('Log a drink now', () => go('today'))}</div>}
        </div>
      </>
    )
  } else if (tab === 'today') {
    const y = 250 - pct * 230 // wave surface in the bubble's 250px box
    body = (
      <>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 20px 0' }}>
          <div>
            <div style={{ fontSize: 13, color: MUTED }}>Stay hydrated</div>
            <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em' }}>{name}</div>
          </div>
          <button type="button" onClick={undo} aria-label="Undo last entry" style={{ ...iconBtn, width: 42, height: 42 }}><Icon name="undo" size={20} /></button>
        </div>
        <div style={{ display: 'grid', placeItems: 'center', padding: '14px 0 0' }}>
          <div style={{ position: 'relative', width: 250, height: 250 }}>
            <svg width="250" height="250" viewBox="0 0 250 250" role="img" aria-label={`${Math.round(pct * 100)} percent of daily goal`}>
              <defs>
                <clipPath id="wt-clip"><circle cx="125" cy="125" r="118" /></clipPath>
              </defs>
              <circle cx="125" cy="125" r="120" fill="#fff" stroke="#bfe6f4" strokeWidth="4" />
              <g clipPath="url(#wt-clip)">
                <g style={{ transform: `translateY(${y}px)`, transition: 'transform .9s cubic-bezier(.2,.8,.2,1)' }}>
                  <g className="wt-wave2" opacity=".45">
                    <path d="M0 0 q62.5 -18 125 0 t125 0 t125 0 t125 0 t125 0 t125 0 V300 H0z" fill={accent} />
                  </g>
                  <g className="wt-wave">
                    <path d="M0 4 q62.5 18 125 0 t125 0 t125 0 t125 0 t125 0 t125 0 V300 H0z" fill={accent} />
                  </g>
                </g>
              </g>
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'grid', placeContent: 'center', textAlign: 'center', color: pct > 0.55 ? '#fff' : INK, transition: 'color .4s' }}>
              <div style={{ fontSize: 50, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1 }}>{Math.round(pct * 100)}%</div>
              <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>{U(total)}</div>
              <div style={{ fontSize: 12, opacity: 0.8 }}>of {U(goal)}</div>
            </div>
          </div>
          <div style={{ fontSize: 13, color: pct >= 1 ? '#12905f' : MUTED, marginTop: 8, fontWeight: 600 }}>{pct >= 1 ? 'Daily goal reached' : `${U(goal - total)} to go`}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, padding: '14px 20px 0', justifyContent: 'center', flexWrap: 'wrap' }}>
          {Object.entries(DRINKS).map(([k, d]) => chip(d.label, drink === k, () => setDrink(k)))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, padding: '14px 20px 0' }}>
          {SIZES.map((ml) => (
            <button key={ml} type="button" onClick={() => add(ml)} aria-label={`Add ${U(ml)}`} style={{ padding: '10px 0 8px', border: 'none', borderRadius: 18, background: '#fff', color: INK, font: 'inherit', cursor: 'pointer', display: 'grid', justifyItems: 'center', gap: 4 }}>
              <span style={{ color: DRINKS[drink].color }}><Icon name="cup" size={22} /></span>
              <span style={{ fontSize: 13, fontWeight: 800 }}>+{Un(ml)}</span>
              <span style={{ fontSize: 10.5, color: MUTED }}>{oz ? 'oz' : 'ml'}</span>
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '18px 20px 10px' }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Today's log</h2>
          <button type="button" onClick={() => go('history')} style={{ border: 'none', background: 'none', padding: 0, font: 'inherit', fontSize: 13, color: accent, fontWeight: 700, cursor: 'pointer' }}>History</button>
        </div>
        <div style={{ display: 'grid', gap: 8, padding: '0 20px' }}>
          {[...log].reverse().map(entryRow)}
          {!log.length && <div style={{ textAlign: 'center', color: MUTED, fontSize: 13, padding: '16px 0' }}>Nothing logged yet. Tap a size above.</div>}
        </div>
      </>
    )
  } else if (tab === 'history') {
    const mx = Math.max(goal, ...series.map((d) => d.ml)) * 1.08
    body = (
      <>
        {header('History')}
        <div style={{ display: 'flex', gap: 8, padding: '2px 20px 10px' }}>
          {chip('Week', range === 'week', () => setRange('week'))}
          {chip('Month', range === 'month', () => setRange('month'))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, padding: '0 20px' }}>
          {[['Average', U(avg)], ['Goal days', `${hits}/${series.length}`], ['Streak', `${streak} d`]].map(([l, v]) => (
            <div key={l} style={{ ...card, padding: '12px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: MUTED, fontWeight: 700 }}>{l}</div>
              <div style={{ fontSize: 16, fontWeight: 800, marginTop: 3 }}>{v}</div>
            </div>
          ))}
        </div>
        <div style={{ margin: '12px 20px 0', ...card }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', gap: range === 'week' ? 10 : 2, height: 170 }}>
            <span style={{ position: 'absolute', left: 0, right: 0, bottom: `${(goal / mx) * 100}%`, borderTop: `2px dashed ${accent}88` }} />
            {series.map((d, i) => (
              <button key={i} type="button" onClick={() => push({ id: 'day', i })} aria-label={`${d.label}: ${U(d.ml)}`} style={{ flex: 1, height: '100%', border: 'none', background: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'flex-end' }}>
                <span style={{ width: '100%', height: `${(d.ml / mx) * 100}%`, borderRadius: range === 'week' ? 8 : 3, background: d.today ? accent : d.ml >= goal ? '#5ec8ec' : '#bfe0ee', transition: 'height .6s cubic-bezier(.2,.8,.2,1)' }} />
              </button>
            ))}
          </div>
          {range === 'week' && (
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              {week.map((d, i) => <span key={i} style={{ flex: 1, textAlign: 'center', fontSize: 11.5, fontWeight: d.today ? 800 : 600, color: d.today ? INK : MUTED }}>{d.label}</span>)}
            </div>
          )}
          <div style={{ fontSize: 12, color: MUTED, marginTop: 10 }}>Dashed line is your goal ({U(goal)}). Tap a bar for the day.</div>
        </div>
      </>
    )
  } else if (tab === 'goals') {
    body = (
      <>
        {header('Goals')}
        <div style={{ margin: '4px 20px 0', ...card, textAlign: 'center' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '.06em' }}>Daily goal</div>
          <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: '-0.03em', margin: '4px 0' }}>{U(goal)}</div>
          <input type="range" min="1000" max="4500" step="50" value={goal} onChange={(e) => setGoal(+e.target.value)} aria-label="Daily goal" style={{ width: '100%', accentColor: accent }} />
          <div style={{ fontSize: 12, color: MUTED }}>About {(goal / 250).toFixed(1)} glasses of 250 ml</div>
        </div>
        <div style={{ margin: '12px 20px 0', ...card, padding: '4px 16px' }}>
          <div style={line}><span>Weight</span>{stepper(`${weight} kg`, () => setWeight((w) => Math.max(35, w - 1)), () => setWeight((w) => Math.min(160, w + 1)), 'weight')}</div>
          <div style={line}><span>Active day (+400 ml)</span>{toggle(active, setActive, 'Active day')}</div>
          <div style={{ ...line, borderBottom: 'none' }}><span>Hot weather (+300 ml)</span>{toggle(hot, setHot, 'Hot weather')}</div>
        </div>
        <div style={{ padding: '12px 20px 0' }}>
          {primary(`Use suggested ${U(suggested)}`, () => (setGoal(Math.max(1000, Math.min(4500, suggested))), say('Goal updated')))}
        </div>
        <h2 style={{ margin: 0, padding: '18px 20px 10px', fontSize: 16, fontWeight: 800 }}>Badges</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, padding: '0 20px' }}>
          {BADGES.map((b) => (
            <button key={b.id} type="button" onClick={() => push({ id: 'badge', b: b.id })} style={{ ...card, padding: '14px 6px', border: 'none', font: 'inherit', cursor: 'pointer', display: 'grid', justifyItems: 'center', gap: 6, color: b.ok ? INK : MUTED, opacity: b.ok ? 1 : 0.75 }}>
              <span style={{ color: b.ok ? '#c98a00' : '#8aa2ae' }}><Icon name="trophy" size={28} /></span>
              <span style={{ fontSize: 11.5, fontWeight: 700, textAlign: 'center' }}>{b.label}</span>
            </button>
          ))}
        </div>
      </>
    )
  } else if (tab === 'reminders') {
    body = (
      <>
        {header('Reminders')}
        <div style={{ margin: '4px 20px 0', ...card, padding: '4px 16px' }}>
          <div style={line}><span style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Icon name="bell" size={20} color={accent} /> Remind me to drink</span>{toggle(remOn, setRemOn, 'Reminders')}</div>
          <div style={{ padding: '12px 0', opacity: remOn ? 1 : 0.45, pointerEvents: remOn ? 'auto' : 'none' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: MUTED, marginBottom: 8 }}>EVERY</div>
            <div style={{ display: 'flex', gap: 8 }}>{[1, 2, 3, 4].map((n) => chip(`${n} h`, every === n, () => setEvery(n)))}</div>
          </div>
          <div style={{ ...line, opacity: remOn ? 1 : 0.45, pointerEvents: remOn ? 'auto' : 'none' }}><span>From</span>{stepper(fmtHour(from), () => setFrom((h) => Math.max(5, h - 1)), () => setFrom((h) => Math.min(to - 1, h + 1)), 'start hour')}</div>
          <div style={{ ...line, borderBottom: 'none', opacity: remOn ? 1 : 0.45, pointerEvents: remOn ? 'auto' : 'none' }}><span>Until</span>{stepper(fmtHour(to), () => setTo((h) => Math.max(from + 1, h - 1)), () => setTo((h) => Math.min(23, h + 1)), 'end hour')}</div>
        </div>
        <h2 style={{ margin: 0, padding: '16px 20px 8px', fontSize: 16, fontWeight: 800 }}>Schedule</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '0 20px', opacity: remOn ? 1 : 0.45 }}>
          {reminderTimes.map((h) => chip(fmtHour(h), remOn && !off[h], () => (setOff((o) => ({ ...o, [h]: !o[h] })), say(off[h] ? `${fmtHour(h)} on` : `${fmtHour(h)} skipped`))))}
        </div>
        <div style={{ padding: '18px 20px' }}>{primary('Send a test reminder', testReminder)}</div>
      </>
    )
  } else {
    body = (
      <>
        {header('Settings')}
        <div style={{ margin: '4px 20px 0', ...card, padding: '4px 16px' }}>
          <div style={line}><span>Units</span><span style={{ display: 'flex', gap: 6 }}>{chip('ml', !oz, () => setOz(false))}{chip('fl oz', oz, () => setOz(true))}</span></div>
          <div style={line}><span>Reminder sound</span>{toggle(sound, setSound, 'Reminder sound')}</div>
          <button type="button" onClick={() => push({ id: 'badges-all' })} style={{ ...line, width: '100%', border: 'none', borderBottom: 'none', background: 'none', font: 'inherit', cursor: 'pointer', color: INK }}><span>Drink hydration values</span><Icon name="chev" size={18} color={MUTED} /></button>
        </div>
        <div style={{ padding: '14px 20px', display: 'grid', gap: 10 }}>
          <button type="button" onClick={() => say('Export saved to your files')} style={{ height: 48, borderRadius: 24, border: 'none', background: '#d6eaf2', font: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer', color: INK }}>Export data</button>
          <button type="button" onClick={() => (setLog([]), say('Today cleared'))} style={{ height: 48, borderRadius: 24, border: 'none', background: 'none', font: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer', color: '#e5484d' }}>Clear today's log</button>
          <button type="button" onClick={() => (setLog([{ id: 1, ml: 250, type: 'water', time: '07:30' }, { id: 2, ml: 330, type: 'coffee', time: '09:10' }, { id: 3, ml: 500, type: 'water', time: '11:45' }]), setGoal(startGoal), setOz(false), go('today'), say('Demo reset'))} style={{ height: 48, borderRadius: 24, border: 'none', background: '#d6eaf2', font: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer', color: INK }}>Reset demo</button>
        </div>
      </>
    )
  }
  if (top?.id === 'badges-all') {
    tabbed = false
    body = (
      <>
        {header('Hydration values', pop)}
        <div style={{ padding: '4px 20px 10px', fontSize: 13, color: MUTED }}>How much of each drink counts toward your goal.</div>
        <div style={{ margin: '0 20px', ...card, padding: '4px 16px' }}>
          {Object.values(DRINKS).map((d) => (
            <div key={d.label} style={line}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}><i style={{ width: 12, height: 12, borderRadius: '50%', background: d.color }} />{d.label}</span>
              <span>{Math.round(d.f * 100)}%</span>
            </div>
          ))}
        </div>
      </>
    )
  }

  const phone = (
    <div style={{ position: 'relative', width: W, height: H, overflow: 'hidden', borderRadius: frame ? 46 : 0, background: BG, color: INK, fontFamily: FONT }}>
      <style>{`
        @keyframes wt-r { from { opacity: 0; transform: translateX(34px) } to { opacity: 1; transform: none } }
        @keyframes wt-l { from { opacity: 0; transform: translateX(-34px) } to { opacity: 1; transform: none } }
        @keyframes wt-slide { from { transform: translateX(0) } to { transform: translateX(-250px) } }
        @keyframes wt-slide2 { from { transform: translateX(-250px) } to { transform: translateX(0) } }
        @keyframes wt-drop { from { transform: translateY(-120%) } to { transform: none } }
        .wt-wave { animation: wt-slide 4s linear infinite } .wt-wave2 { animation: wt-slide2 6s linear infinite }
        .wt-scroll { scrollbar-width: none } .wt-scroll::-webkit-scrollbar { display: none }
        .wt-app button:focus-visible, .wt-app input:focus-visible { outline: 2px solid ${accent}; outline-offset: 2px }
        @media (prefers-reduced-motion: reduce) { .wt-app * { animation: none !important; transition: none !important } }
      `}</style>
      <StatusBar frame={frame} />
      <div key={`${tab}/${stack.map((s) => s.id + (s.i ?? '') + (s.eid ?? '')).join('/')}`} className="wt-scroll" style={{ position: 'absolute', top: 54, bottom: tabbed ? 88 : 0, left: 0, right: 0, overflowY: 'auto', paddingBottom: 24, animation: `${dir > 0 ? 'wt-r' : 'wt-l'} .28s ease` }}>
        {body}
      </div>
      {tabbed && (
        <nav aria-label="Main" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 88, background: '#fff', borderRadius: '26px 26px 0 0', boxShadow: '0 -6px 20px rgba(11,43,63,.07)', display: 'flex', justifyContent: 'space-around', padding: '10px 4px 0' }}>
          {NAV.map(([id, icon, label]) => (
            <button key={id} type="button" onClick={() => go(id)} aria-current={tab === id ? 'page' : undefined} style={{ border: 'none', background: 'none', font: 'inherit', cursor: 'pointer', display: 'grid', justifyItems: 'center', alignContent: 'start', gap: 3, width: 68, height: 54, fontSize: 10.5, fontWeight: 700, color: tab === id ? accent : MUTED }}>
              <Icon name={icon} size={23} />
              {label}
            </button>
          ))}
        </nav>
      )}
      {banner && (
        <div role="alert" style={{ position: 'absolute', left: 12, right: 12, top: 60, zIndex: 40, display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 20, background: 'rgba(255,255,255,.96)', boxShadow: '0 10px 30px rgba(11,43,63,.25)', animation: 'wt-drop .4s cubic-bezier(.2,.9,.3,1)' }}>
          <span style={{ width: 36, height: 36, borderRadius: 11, display: 'grid', placeItems: 'center', background: accent, color: '#fff' }}><Icon name="drop" size={20} /></span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 13, fontWeight: 800 }}>{name}</span>
            <span style={{ display: 'block', fontSize: 12.5, color: MUTED }}>Time for a glass of water{sound ? '' : ' (silent)'}</span>
          </span>
          <button type="button" onClick={() => (add(250, 'water'), setBanner(false), go('today'))} style={{ height: 32, padding: '0 12px', borderRadius: 16, border: 'none', background: accent, color: '#fff', font: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>+250</button>
        </div>
      )}
      <div role="status" style={{ position: 'absolute', left: '50%', top: 58, zIndex: 30, transform: `translate(-50%, ${toast ? 0 : -90}px)`, transition: 'transform .35s cubic-bezier(.2,.8,.2,1)', padding: '10px 16px', borderRadius: 20, background: INK, color: '#fff', fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap' }}>{toast}</div>
      <div style={{ position: 'absolute', left: '50%', bottom: 8, width: 140, height: 5, marginLeft: -70, borderRadius: 3, background: INK, opacity: 0.8, zIndex: 25 }} />
    </div>
  )

  return (
    <div ref={box} className="wt-app" style={{ position: 'relative', width: '100%', height: '100%', display: 'grid', placeItems: 'center', overflow: 'hidden', background: 'radial-gradient(ellipse at 50% 30%, #dff4fa, #9fd3e6 75%)', ...style }}>
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: `translate(-50%, -50%) scale(${scale})`, transformOrigin: 'center' }}>
        {frame ? (
          <div style={{ padding: 12, borderRadius: 58, background: 'linear-gradient(145deg, #3a3f4a, #14171d 40%, #2b2f38)', boxShadow: '0 40px 80px rgba(11,43,63,.35), inset 0 0 0 2px #4b515e' }}>
            <div style={{ padding: 2, borderRadius: 48, background: '#000' }}>{phone}</div>
          </div>
        ) : (
          phone
        )}
      </div>
    </div>
  )
}
