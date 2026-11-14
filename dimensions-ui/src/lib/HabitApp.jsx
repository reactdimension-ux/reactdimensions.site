import { useEffect, useMemo, useRef, useState } from 'react'

// A habit-streak app on a phone, as a click-through prototype. Five pages:
// Today (check habits off with a little burst, progress ring, flame streaks),
// All habits (sortable list with a 7-day strip), Habit detail (a month
// heat-grid you can tap to toggle days, current and best streak), Stats (a
// 7 or 30 day chart that updates as you check things off) and Add habit (a
// real form that creates a habit which then shows up everywhere). Warm cream
// and ember palette. The phone scales to fit whatever box it is in.

const W = 390
const H = 844
const INK = '#3a2412'
const MUTED = '#9a8472'
const BG = '#fff7ec'
const CARD = '#ffffff'
const LINE = '#f1e4d2'

const DAY = 86400000
const keyOf = (d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

const ICONS = {
  today: 'M4 5h16v15H4zM4 10h16M9 3v4M15 3v4',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  chart: 'M5 20V10M12 20V4M19 20v-7',
  plus: 'M12 5v14M5 12h14',
  back: 'M15 5l-7 7 7 7',
  chev: 'M9 5l7 7-7 7',
  check: 'M5 12l5 5 9-10',
  flame: 'M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-4-1-6 1-9z',
  drop: 'M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z',
  book: 'M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h11',
  bolt: 'M13 3L5 14h6l-1 7 8-11h-6z',
  moon: 'M20 14A8 8 0 1 1 10 4a6.5 6.5 0 0 0 10 10z',
  leaf: 'M5 19C5 10 10 5 20 4c0 10-4 15-13 15zM5 19l7-7',
  heart: 'M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.5A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11z',
  trash: 'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13',
}
const PICK = ['drop', 'book', 'bolt', 'moon', 'leaf', 'heart']
const HUES = [18, 350, 160, 215, 275, 45]

const NAV = [
  ['today', 'today', 'Today'],
  ['all', 'list', 'Habits'],
  ['stats', 'chart', 'Stats'],
  ['add', 'plus', 'Add'],
]

function Icon({ name, size = 22, color = 'currentColor', w = 1.9, fill = 'none' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  )
}

const hue = (h, s = 85, l = 55) => `hsl(${h} ${s}% ${l}%)`

// deterministic pseudo random so the demo history is stable
function rnd(seed) {
  let x = seed * 9301 + 49297
  x = (x * 233280 + 11) % 2147483647
  return (x % 1000) / 1000
}

function seedHabits(today) {
  const defs = [
    ['h1', 'Drink 2L of water', 'drop', 18 + 180, 6, 0.9],
    ['h2', 'Read 20 pages', 'book', 275, 3, 0.7],
    ['h3', 'Morning run', 'bolt', 18, 0, 0.55],
    ['h4', 'Lights out by 11', 'moon', 215, 11, 0.75],
    ['h5', 'Water the plants', 'leaf', 160, 2, 0.8],
  ]
  return defs.map(([id, name, icon, h, streak, p], hi) => {
    const done = {}
    for (let i = 1; i <= 75; i++) {
      if (rnd(hi * 100 + i) < p) done[keyOf(addDays(today, -i))] = true
    }
    for (let i = 1; i <= streak; i++) done[keyOf(addDays(today, -i))] = true
    delete done[keyOf(addDays(today, -streak - 1))]
    if (id === 'h1') done[keyOf(today)] = true
    return { id, name, icon, h: h % 360, done }
  })
}

function streakOf(h, today) {
  let d = h.done[keyOf(today)] ? today : addDays(today, -1)
  let n = 0
  while (h.done[keyOf(d)]) (n++, (d = addDays(d, -1)))
  return n
}
function bestOf(h, today) {
  let best = 0
  let cur = 0
  for (let i = 400; i >= 0; i--) {
    if (h.done[keyOf(addDays(today, -i))]) best = Math.max(best, ++cur)
    else cur = 0
  }
  return best
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

function Ring({ value, size = 96, stroke = 10, color, track = LINE, children }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <div style={{ position: 'relative', width: size, height: size, flex: 'none' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(1, value))} style={{ transition: 'stroke-dashoffset .5s ease' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>{children}</div>
    </div>
  )
}

export default function HabitApp({ name = 'Ember', accent = '#f97316', startScreen = 'today', frame = true, style }) {
  const box = useRef()
  const toastTimer = useRef()
  const burstTimer = useRef()
  const [scale, setScale] = useState(1)
  const today = useMemo(() => new Date(), [])
  const [habits, setHabits] = useState(() => seedHabits(new Date()))
  const [tab, setTab] = useState('today')
  const [stack, setStack] = useState([])
  const [dir, setDir] = useState(1)
  const [toast, setToast] = useState('')
  const [burst, setBurst] = useState(null)
  const [sort, setSort] = useState('streak')
  const [range, setRange] = useState(7)
  const [month, setMonth] = useState({ y: today.getFullYear(), m: today.getMonth() })
  const [form, setForm] = useState({ name: '', icon: 'drop', h: 18 })

  useEffect(() => {
    setDir(1)
    if (startScreen === 'detail') {
      setTab('all')
      setStack([{ id: 'detail', habit: 'h3' }])
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

  useEffect(
    () => () => {
      clearTimeout(toastTimer.current)
      clearTimeout(burstTimer.current)
    },
    [],
  )

  const say = (t) => {
    setToast(t)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 1900)
  }

  const top = stack[stack.length - 1]
  const push = (s) => (setDir(1), setStack((a) => [...a, s]))
  const pop = () => (setDir(-1), setStack((a) => a.slice(0, -1)))
  const go = (t) => (setDir(NAV.findIndex((n) => n[0] === t) >= NAV.findIndex((n) => n[0] === tab) ? 1 : -1), setTab(t), setStack([]))

  const todayKey = keyOf(today)
  const doneToday = habits.filter((h) => h.done[todayKey]).length

  const toggleDay = (id, k, isToday) => {
    const h = habits.find((x) => x.id === id)
    const was = !!h.done[k]
    setHabits((a) => a.map((x) => (x.id === id ? { ...x, done: { ...x.done, [k]: !was } } : x)))
    if (!was && isToday) {
      setBurst({ id, n: Date.now() })
      clearTimeout(burstTimer.current)
      burstTimer.current = setTimeout(() => setBurst(null), 800)
      const after = doneToday + 1
      const st = streakOf({ ...h, done: { ...h.done, [k]: true } }, today)
      say(after === habits.length ? 'All habits done today!' : st > 1 ? `${st} day streak!` : 'Nice, first one!')
    }
  }

  const createHabit = () => {
    const nm = form.name.trim()
    if (!nm) return
    const id = `h${Date.now()}`
    setHabits((a) => [...a, { id, name: nm, icon: form.icon, h: form.h, done: {} }])
    setForm({ name: '', icon: 'drop', h: 18 })
    say(`"${nm}" added`)
    setDir(1)
    setTab('today')
    setStack([])
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

  const Burst = ({ h }) =>
    burst && burst.id === h.id ? (
      <span key={burst.n} aria-hidden="true" style={{ position: 'absolute', left: '50%', top: '50%', pointerEvents: 'none' }}>
        {Array.from({ length: 10 }).map((_, i) => (
          <i key={i} className="hb-p" style={{ '--a': `${i * 36}deg`, background: i % 2 ? hue(h.h) : accent }} />
        ))}
      </span>
    ) : null

  const checkBtn = (h, k, isToday = true) => {
    const on = !!h.done[k]
    return (
      <button type="button" onClick={() => toggleDay(h.id, k, isToday)} role="checkbox" aria-checked={on} aria-label={`${on ? 'Uncheck' : 'Check'} ${h.name}`} style={{ position: 'relative', width: 42, height: 42, flex: 'none', borderRadius: '50%', border: `2.5px solid ${on ? hue(h.h) : LINE}`, background: on ? hue(h.h) : '#fff', color: '#fff', display: 'grid', placeItems: 'center', cursor: 'pointer', padding: 0, transition: 'all .2s', transform: on ? 'scale(1)' : 'scale(.96)' }}>
        {on && <Icon name="check" size={22} w={3} />}
        <Burst h={h} />
      </button>
    )
  }

  const badge = (h, size = 44) => (
    <span style={{ width: size, height: size, borderRadius: size * 0.34, flex: 'none', display: 'grid', placeItems: 'center', background: hue(h.h, 90, 93), color: hue(h.h, 70, 42) }}>
      <Icon name={h.icon} size={size * 0.5} />
    </span>
  )

  const flame = (n, big) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontWeight: 800, fontSize: big ? 15 : 13, color: n ? accent : MUTED }}>
      <Icon name="flame" size={big ? 20 : 16} fill={n ? accent : 'none'} color={n ? accent : MUTED} w={1.6} />
      {n}
    </span>
  )

  const primary = (label, onClick, disabled) => (
    <button type="button" disabled={disabled} onClick={onClick} style={{ width: '100%', height: 52, borderRadius: 26, border: 'none', background: disabled ? '#e9dccb' : accent, color: '#fff', font: 'inherit', fontSize: 15, fontWeight: 700, cursor: disabled ? 'default' : 'pointer', boxShadow: disabled ? 'none' : `0 8px 18px ${accent}55` }}>
      {label}
    </button>
  )

  // ---- screens
  let body
  let tabbed = true
  if (top?.id === 'detail') {
    tabbed = false
    const h = habits.find((x) => x.id === top.habit)
    if (!h) {
      body = header('Habit', pop)
    } else {
      const st = streakOf(h, today)
      const first = new Date(month.y, month.m, 1)
      const nDays = new Date(month.y, month.m + 1, 0).getDate()
      const cells = [...Array(first.getDay()).fill(null), ...Array.from({ length: nDays }, (_, i) => new Date(month.y, month.m, i + 1))]
      const monthDone = cells.filter((d) => d && h.done[keyOf(d)]).length
      const total = Object.keys(h.done).filter((k) => h.done[k]).length
      const shift = (n) => setMonth((m) => {
        const d = new Date(m.y, m.m + n, 1)
        return { y: d.getFullYear(), m: d.getMonth() }
      })
      body = (
        <>
          {header(h.name, pop)}
          <div style={{ margin: '6px 18px 0', padding: 18, borderRadius: 26, background: `linear-gradient(135deg, ${hue(h.h, 90, 62)}, ${hue(h.h + 25, 85, 50)})`, color: '#fff', display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ width: 62, height: 62, borderRadius: 22, background: 'rgba(255,255,255,.22)', display: 'grid', placeItems: 'center' }}><Icon name={h.icon} size={32} /></span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12.5, opacity: 0.9 }}>Current streak</div>
              <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.1 }}>{st} <span style={{ fontSize: 15, fontWeight: 700 }}>{st === 1 ? 'day' : 'days'}</span></div>
            </div>
            <Icon name="flame" size={44} fill="rgba(255,255,255,.9)" color="#fff" w={1.4} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, padding: '10px 18px 0' }}>
            {[['Best', `${bestOf(h, today)}d`], ['This month', `${monthDone}d`], ['All time', total]].map(([l, v]) => (
              <div key={l} style={{ background: CARD, borderRadius: 18, padding: '10px 6px', textAlign: 'center' }}>
                <div style={{ fontSize: 19, fontWeight: 800 }}>{v}</div>
                <div style={{ fontSize: 11, color: MUTED, fontWeight: 600 }}>{l}</div>
              </div>
            ))}
          </div>
          <div style={{ margin: '10px 18px 0', background: CARD, borderRadius: 24, padding: '14px 14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <button type="button" onClick={() => shift(-1)} aria-label="Previous month" style={{ border: 'none', background: '#fbf1e2', width: 32, height: 32, borderRadius: '50%', cursor: 'pointer', color: INK, display: 'grid', placeItems: 'center', padding: 0 }}><Icon name="back" size={16} /></button>
              <span style={{ fontWeight: 800, fontSize: 15 }}>{MONTHS[month.m]} {month.y}</span>
              <button type="button" onClick={() => shift(1)} aria-label="Next month" style={{ border: 'none', background: '#fbf1e2', width: 32, height: 32, borderRadius: '50%', cursor: 'pointer', color: INK, display: 'grid', placeItems: 'center', padding: 0 }}><Icon name="chev" size={16} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
              {DOW.map((d, i) => <div key={i} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: MUTED }}>{d}</div>)}
              {cells.map((d, i) => {
                if (!d) return <span key={`e${i}`} />
                const k = keyOf(d)
                const on = !!h.done[k]
                const future = d > today && k !== todayKey
                return (
                  <button key={k} type="button" disabled={future} onClick={() => toggleDay(h.id, k, k === todayKey)} aria-pressed={on} aria-label={`${MONTHS[d.getMonth()]} ${d.getDate()}`} style={{ aspectRatio: '1', border: k === todayKey ? `2px solid ${INK}` : 'none', borderRadius: 11, background: on ? hue(h.h) : future ? 'transparent' : '#fbf1e2', color: on ? '#fff' : future ? '#d8c8b4' : MUTED, font: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: future ? 'default' : 'pointer', padding: 0, transition: 'background .15s' }}>{d.getDate()}</button>
                )
              })}
            </div>
            <div style={{ fontSize: 12, color: MUTED, textAlign: 'center', marginTop: 10 }}>Tap a day to mark it done or undo it.</div>
          </div>
          <div style={{ padding: '14px 18px' }}>
            <button type="button" onClick={() => { setHabits((a) => a.filter((x) => x.id !== h.id)); say('Habit deleted'); pop() }} style={{ width: '100%', height: 46, borderRadius: 23, border: 'none', background: 'none', color: '#dc2626', font: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Icon name="trash" size={18} /> Delete habit
            </button>
          </div>
        </>
      )
    }
  } else if (tab === 'today') {
    const pct = habits.length ? doneToday / habits.length : 0
    body = (
      <>
        <div style={{ padding: '8px 20px 0' }}>
          <div style={{ fontSize: 13, color: MUTED, fontWeight: 600 }}>{today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
          <h1 style={{ margin: '2px 0 0', fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em' }}>Today</h1>
        </div>
        <div style={{ margin: '14px 18px 0', padding: 16, borderRadius: 26, background: CARD, display: 'flex', alignItems: 'center', gap: 16, boxShadow: '0 8px 22px rgba(120,70,20,.07)' }}>
          <Ring value={pct} color={accent}>
            <div><div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1 }}>{doneToday}<span style={{ fontSize: 14, color: MUTED }}>/{habits.length}</span></div></div>
          </Ring>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 800 }}>{pct === 1 ? 'Perfect day!' : pct > 0.5 ? 'Almost there' : doneToday ? 'Good start' : `Let's go, ${name}`}</div>
            <div style={{ fontSize: 13, color: MUTED, marginTop: 3 }}>{habits.length - doneToday ? `${habits.length - doneToday} left to keep your streaks alive.` : 'Every streak is safe today.'}</div>
          </div>
        </div>
        <div style={{ display: 'grid', gap: 9, padding: '16px 18px 0' }}>
          {habits.map((h) => {
            const st = streakOf(h, today)
            return (
              <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 12px', borderRadius: 22, background: CARD }}>
                <button type="button" onClick={() => push({ id: 'detail', habit: h.id })} aria-label={`Open ${h.name}`} style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0, border: 'none', background: 'none', padding: 0, font: 'inherit', textAlign: 'left', cursor: 'pointer', color: INK }}>
                  {badge(h)}
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textDecoration: h.done[todayKey] ? 'line-through' : 'none', opacity: h.done[todayKey] ? 0.55 : 1 }}>{h.name}</span>
                    <span style={{ display: 'block', marginTop: 2 }}>{flame(st)}</span>
                  </span>
                </button>
                {checkBtn(h, todayKey)}
              </div>
            )
          })}
          {!habits.length && <div style={{ textAlign: 'center', color: MUTED, fontSize: 13, padding: '24px 0' }}>No habits yet. Add one from the Add tab.</div>}
        </div>
      </>
    )
  } else if (tab === 'all') {
    const list = [...habits].sort((a, b) => (sort === 'name' ? a.name.localeCompare(b.name) : streakOf(b, today) - streakOf(a, today)))
    body = (
      <>
        {header('All habits')}
        <div style={{ display: 'flex', gap: 8, padding: '2px 18px 10px' }} role="group" aria-label="Sort">
          {[['streak', 'Longest streak'], ['name', 'A to Z']].map(([id, l]) => (
            <button key={id} type="button" onClick={() => setSort(id)} aria-pressed={sort === id} style={{ height: 34, padding: '0 14px', borderRadius: 17, border: 'none', background: sort === id ? accent : CARD, color: sort === id ? '#fff' : INK, font: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{l}</button>
          ))}
        </div>
        <div style={{ display: 'grid', gap: 9, padding: '0 18px' }}>
          {list.map((h) => (
            <button key={h.id} type="button" onClick={() => push({ id: 'detail', habit: h.id })} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 22, border: 'none', background: CARD, font: 'inherit', textAlign: 'left', cursor: 'pointer', color: INK }}>
              {badge(h)}
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 15, fontWeight: 700 }}>{h.name}</span>
                <span style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                  {Array.from({ length: 7 }, (_, i) => {
                    const d = addDays(today, i - 6)
                    return <i key={i} style={{ width: 16, height: 16, borderRadius: 5, background: h.done[keyOf(d)] ? hue(h.h) : '#f4e8d6' }} />
                  })}
                </span>
              </span>
              <span style={{ display: 'grid', justifyItems: 'end', gap: 4 }}>
                {flame(streakOf(h, today), true)}
                <Icon name="chev" size={16} color={MUTED} />
              </span>
            </button>
          ))}
          <button type="button" onClick={() => go('add')} style={{ height: 54, borderRadius: 22, border: `2px dashed ${accent}88`, background: 'none', color: accent, font: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>+ New habit</button>
        </div>
      </>
    )
  } else if (tab === 'stats') {
    const days = Array.from({ length: range }, (_, i) => addDays(today, i - range + 1))
    const counts = days.map((d) => habits.filter((h) => h.done[keyOf(d)]).length)
    const max = Math.max(1, habits.length)
    const rate = Math.round((counts.reduce((a, b) => a + b, 0) / (max * range)) * 100)
    const bestStreak = Math.max(0, ...habits.map((h) => bestOf(h, today)))
    const cw = 354
    const bw = cw / range
    body = (
      <>
        {header('Stats')}
        <div style={{ display: 'flex', gap: 8, padding: '2px 18px 10px' }} role="group" aria-label="Range">
          {[7, 30].map((n) => (
            <button key={n} type="button" onClick={() => setRange(n)} aria-pressed={range === n} style={{ height: 34, padding: '0 16px', borderRadius: 17, border: 'none', background: range === n ? accent : CARD, color: range === n ? '#fff' : INK, font: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{n} days</button>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, padding: '0 18px' }}>
          {[['Completion', `${rate}%`], ['Best streak', `${bestStreak}d`], ['Today', `${doneToday}/${habits.length}`]].map(([l, v]) => (
            <div key={l} style={{ background: CARD, borderRadius: 18, padding: '12px 6px', textAlign: 'center' }}>
              <div style={{ fontSize: 21, fontWeight: 800 }}>{v}</div>
              <div style={{ fontSize: 11, color: MUTED, fontWeight: 600 }}>{l}</div>
            </div>
          ))}
        </div>
        <div style={{ margin: '12px 18px 0', background: CARD, borderRadius: 24, padding: '14px 12px 10px' }}>
          <div style={{ fontSize: 14, fontWeight: 800, padding: '0 4px 8px' }}>Habits done per day</div>
          <svg viewBox={`0 0 ${cw} 150`} width="100%" role="img" aria-label="Bar chart of habits completed per day">
            {[0, 0.5, 1].map((t) => <line key={t} x1="0" x2={cw} y1={120 - t * 100} y2={120 - t * 100} stroke={LINE} strokeDasharray="3 4" />)}
            {counts.map((c, i) => {
              const h = (c / max) * 100
              const isT = i === counts.length - 1
              return (
                <g key={i}>
                  <rect x={i * bw + bw * 0.16} y={120 - h} width={bw * 0.68} height={Math.max(h, 3)} rx={Math.min(7, bw * 0.3)} fill={isT ? accent : hue(18, 90, 82)} style={{ transition: 'all .4s' }} />
                  {(range === 7 || i % 5 === 4) && <text x={i * bw + bw / 2} y="140" textAnchor="middle" fontSize="10.5" fill={MUTED} fontWeight="600">{range === 7 ? DOW[days[i].getDay()] : days[i].getDate()}</text>}
                </g>
              )
            })}
          </svg>
        </div>
        <div style={{ margin: '12px 18px 0', background: CARD, borderRadius: 24, padding: '8px 14px' }}>
          {habits.map((h) => {
            const n = days.filter((d) => h.done[keyOf(d)]).length
            return (
              <button key={h.id} type="button" onClick={() => push({ id: 'detail', habit: h.id })} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 0', border: 'none', background: 'none', font: 'inherit', textAlign: 'left', cursor: 'pointer', color: INK }}>
                <span style={{ width: 90, fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.name}</span>
                <span style={{ flex: 1, height: 10, borderRadius: 5, background: '#f4e8d6', overflow: 'hidden' }}><i style={{ display: 'block', height: '100%', width: `${(n / range) * 100}%`, background: hue(h.h), borderRadius: 5, transition: 'width .4s' }} /></span>
                <span style={{ width: 34, textAlign: 'right', fontSize: 12, color: MUTED, fontWeight: 700 }}>{n}/{range}</span>
              </button>
            )
          })}
        </div>
      </>
    )
  } else {
    body = (
      <>
        {header('Add habit')}
        <div style={{ padding: '4px 18px 0', display: 'grid', gap: 14 }}>
          <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 700, color: MUTED }}>
            Name
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value.slice(0, 28) }))} onKeyDown={(e) => e.key === 'Enter' && createHabit()} placeholder="e.g. Stretch for 10 minutes" style={{ height: 52, borderRadius: 18, border: `2px solid ${LINE}`, background: CARD, padding: '0 16px', font: 'inherit', fontSize: 16, fontWeight: 600, color: INK, outline: 'none' }} />
          </label>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: MUTED, marginBottom: 8 }}>Icon</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {PICK.map((p) => (
                <button key={p} type="button" onClick={() => setForm((f) => ({ ...f, icon: p }))} aria-pressed={form.icon === p} aria-label={p} style={{ width: 50, height: 50, borderRadius: 17, border: form.icon === p ? `2.5px solid ${hue(form.h)}` : `2px solid ${LINE}`, background: form.icon === p ? hue(form.h, 90, 93) : CARD, color: form.icon === p ? hue(form.h, 70, 42) : MUTED, display: 'grid', placeItems: 'center', cursor: 'pointer', padding: 0 }}>
                  <Icon name={p} size={24} />
                </button>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: MUTED, marginBottom: 8 }}>Color</div>
            <div style={{ display: 'flex', gap: 10 }}>
              {HUES.map((h) => (
                <button key={h} type="button" onClick={() => setForm((f) => ({ ...f, h }))} aria-pressed={form.h === h} aria-label={`Color ${h}`} style={{ width: 38, height: 38, borderRadius: '50%', border: form.h === h ? `3px solid ${INK}` : '3px solid transparent', outline: `2px solid ${CARD}`, outlineOffset: -5, background: hue(h), cursor: 'pointer', padding: 0 }} />
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderRadius: 22, background: CARD, opacity: form.name.trim() ? 1 : 0.55 }}>
            {badge(form)}
            <div style={{ flex: 1, fontSize: 15, fontWeight: 700 }}>{form.name.trim() || 'Preview'}</div>
            <span style={{ width: 36, height: 36, borderRadius: '50%', border: `2.5px solid ${LINE}` }} />
          </div>
          {primary('Create habit', createHabit, !form.name.trim())}
        </div>
      </>
    )
  }

  const phone = (
    <div style={{ position: 'relative', width: W, height: H, overflow: 'hidden', borderRadius: frame ? 46 : 0, background: BG, color: INK, fontFamily: "'Nunito', 'Avenir Next', 'Segoe UI', system-ui, sans-serif" }}>
      <style>{`
        @keyframes hb-r { from { opacity: 0; transform: translateX(34px) } to { opacity: 1; transform: none } }
        @keyframes hb-l { from { opacity: 0; transform: translateX(-34px) } to { opacity: 1; transform: none } }
        @keyframes hb-p { from { transform: rotate(var(--a)) translateY(0) scale(1); opacity: 1 } to { transform: rotate(var(--a)) translateY(-34px) scale(.2); opacity: 0 } }
        .hb-p { position: absolute; left: -4px; top: -4px; width: 8px; height: 8px; border-radius: 50%; animation: hb-p .7s ease-out forwards }
        .hb-scroll { scrollbar-width: none } .hb-scroll::-webkit-scrollbar { display: none }
        .hb-app button:focus-visible, .hb-app input:focus-visible { outline: 2px solid ${accent}; outline-offset: 2px }
        @media (prefers-reduced-motion: reduce) { .hb-p { display: none } .hb-view { animation: none !important } }
      `}</style>
      <StatusBar frame={frame} />
      <div key={`${tab}/${stack.map((s) => s.id + (s.habit || '')).join('/')}`} className="hb-scroll hb-view" style={{ position: 'absolute', top: 54, bottom: tabbed ? 88 : 0, left: 0, right: 0, overflowY: 'auto', paddingBottom: 24, animation: `${dir > 0 ? 'hb-r' : 'hb-l'} .28s ease` }}>
        {body}
      </div>
      {tabbed && (
        <nav aria-label="Main" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 88, background: CARD, borderRadius: '26px 26px 0 0', boxShadow: '0 -6px 20px rgba(120,70,20,.08)', display: 'flex', justifyContent: 'space-around', padding: '10px 8px 0' }}>
          {NAV.map(([id, icon, label]) => (
            <button key={id} type="button" onClick={() => go(id)} aria-current={tab === id ? 'page' : undefined} style={{ border: 'none', background: 'none', font: 'inherit', cursor: 'pointer', display: 'grid', justifyItems: 'center', alignContent: 'start', gap: 3, width: 72, height: 54, fontSize: 11, fontWeight: 700, color: tab === id ? accent : MUTED }}>
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
    <div ref={box} className="hb-app" style={{ position: 'relative', width: '100%', height: '100%', display: 'grid', placeItems: 'center', overflow: 'hidden', background: 'radial-gradient(ellipse at 50% 30%, #ffe9cc, #f3c99b 75%)', ...style }}>
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: `translate(-50%, -50%) scale(${scale})`, transformOrigin: 'center' }}>
        {frame ? (
          <div style={{ padding: 12, borderRadius: 58, background: 'linear-gradient(145deg, #4a3a30, #1d1511 40%, #3a2c24)', boxShadow: '0 40px 80px rgba(90,50,10,.35), inset 0 0 0 2px #5b4a3e' }}>
            <div style={{ padding: 2, borderRadius: 48, background: '#000' }}>{phone}</div>
          </div>
        ) : (
          phone
        )}
      </div>
    </div>
  )
}
