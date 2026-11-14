import { useEffect, useRef, useState } from 'react'

// A notification centre on a phone, as a click-through prototype, in a dark
// glass look. Five pages: All (newest first; swipe a row left to dismiss or
// right to mark read, or use the dot and the cross), Grouped (one card per
// app with expand/collapse, mark group read, clear group), Detail (pushed
// when you tap a notification: reply, mute the app, delete), Filters (really
// filter category, read state and age, shared by All and Grouped) and
// Settings (a switch per category, banners, previews, quiet hours). The plus
// button simulates an incoming notification, which settings can block.
// The phone scales to fit.

const W = 390
const H = 844
const INK = '#eef0fb'
const MUTED = '#8f93ae'
const BG = '#0d0e1b'
const GLASS = 'rgba(255,255,255,.07)'
const LINE = 'rgba(255,255,255,.1)'

const APPS = {
  messages: { name: 'Messages', color: '#34d399', icon: 'chat', cat: 'people' },
  mail: { name: 'Mail', color: '#fbbf24', icon: 'mail', cat: 'people' },
  pulse: { name: 'Pulse', color: '#f472b6', icon: 'heart', cat: 'social' },
  bank: { name: 'Northwind', color: '#60a5fa', icon: 'card', cat: 'money' },
  calendar: { name: 'Calendar', color: '#fb923c', icon: 'cal', cat: 'reminders' },
  fit: { name: 'Fitness', color: '#4ade80', icon: 'bolt', cat: 'reminders' },
  system: { name: 'System', color: '#a5b4fc', icon: 'gear', cat: 'system' },
}
const CATS = [
  ['people', 'People', 'Messages and mail from real humans'],
  ['social', 'Social', 'Likes, follows and mentions'],
  ['money', 'Money', 'Payments, transfers and alerts'],
  ['reminders', 'Reminders', 'Events and activity nudges'],
  ['system', 'System', 'Updates and security'],
]

const SEED = [
  { id: 'n1', app: 'messages', title: 'Ava Chen', body: 'Are we still on for lunch at 1? I can move it if you are running late.', full: 'Are we still on for lunch at 1? I can move it if you are running late. Also, I found that ramen place you mentioned. It has a huge queue so maybe we should go early.', ago: 3, read: false },
  { id: 'n2', app: 'messages', title: 'Design team', body: 'Leo: pushed the new onboarding screens to the shared file.', full: 'Leo: pushed the new onboarding screens to the shared file. Please leave comments by Thursday so we can lock the flow before handoff.', ago: 14, read: false },
  { id: 'n3', app: 'bank', title: 'Payment received', body: '$40.00 from Ava Chen landed in your Everyday account.', full: '$40.00 from Ava Chen landed in your Everyday account. Reference: lunch split. Your new balance is $8,460.50.', ago: 26, read: false },
  { id: 'n4', app: 'calendar', title: 'Standup in 15 minutes', body: 'Daily standup · Meet room 2', full: 'Daily standup starts at 10:00 in Meet room 2. Agenda: sprint board review, blocked items and the Friday demo.', ago: 38, read: false },
  { id: 'n5', app: 'pulse', title: 'Mia liked your photo', body: 'and 12 others liked "Harbour at dusk".', full: 'Mia Okafor and 12 others liked "Harbour at dusk". It is your most popular post this month.', ago: 74, read: true },
  { id: 'n6', app: 'pulse', title: 'New follower', body: 'Zoe Laurent started following you.', full: 'Zoe Laurent started following you. You have 248 followers now.', ago: 130, read: false },
  { id: 'n7', app: 'mail', title: 'Your invoice is ready', body: 'Invoice #2041 from Studio Hale, due in 7 days.', full: 'Invoice #2041 from Studio Hale for $1,200.00 is attached and due in 7 days. Reply to this email if anything looks off.', ago: 190, read: true },
  { id: 'n8', app: 'fit', title: 'Goal reached', body: 'You hit 10,000 steps. Streak: 6 days.', full: 'You hit 10,000 steps today. That is a 6 day streak, your best this year. Keep it going tomorrow.', ago: 260, read: true },
  { id: 'n9', app: 'bank', title: 'New sign-in', body: 'Your account was opened on a new device.', full: 'Your account was opened on an iPad in Lisbon. If this was not you, freeze your cards and change your PIN straight away.', ago: 420, read: false },
  { id: 'n10', app: 'system', title: 'Update available', body: 'Version 4.2 adds a new lock-screen widget.', full: 'Version 4.2 adds a new lock-screen widget, faster photo search and security fixes. It will install tonight while charging.', ago: 1500, read: true },
  { id: 'n11', app: 'messages', title: 'Sam Patel', body: 'Sent a photo.', full: 'Sam Patel sent a photo from the Sunrise Hike. "Worth the 5am alarm."', ago: 1700, read: true },
  { id: 'n12', app: 'calendar', title: 'Dentist tomorrow', body: 'Tomorrow, 09:30 · Dr. Lindqvist', full: 'Appointment tomorrow at 09:30 with Dr. Lindqvist, Harbour Clinic, second floor. Bring your insurance card.', ago: 2000, read: true },
]
const INCOMING = [
  { app: 'messages', title: 'Noah Kim', body: 'Did you see the game last night?' },
  { app: 'pulse', title: 'Ivy commented', body: '"This colour is unreal."' },
  { app: 'bank', title: 'Card payment', body: '$6.50 at Blue Bottle Coffee.' },
  { app: 'calendar', title: 'Event starts soon', body: 'Rooftop Birthday · 19:30' },
  { app: 'system', title: 'Battery tip', body: 'Low Power Mode can add up to 3 hours.' },
  { app: 'mail', title: 'Receipt', body: 'Your order has shipped.' },
]

const ICONS = {
  bell: 'M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4',
  layers: 'M12 4l9 5-9 5-9-5zM3 14l9 5 9-5',
  sliders: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2-1.2L14.300 3h-4l-.3 2.600a7 7 0 0 0-2 1.200l-2.300-.9-2 3.400 2 1.500a7 7 0 0 0 0 2.400l-2 1.500 2 3.400 2.300-.9a7 7 0 0 0 2 1.200l.3 2.600h4l.3-2.600a7 7 0 0 0 2-1.200l2.300.9 2-3.400-2-1.500c.1-.4.100-.8.100-1.200z',
  chat: 'M4 5h16v11H9l-5 4z',
  mail: 'M3 6h18v12H3zM3 7l9 7 9-7',
  heart: 'M12 20s-8-5-8-11a4.500 4.500 0 0 1 8-2.800A4.500 4.500 0 0 1 20 9c0 6-8 11-8 11z',
  card: 'M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 10h18',
  cal: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  bolt: 'M13 3L5 13h6l-1 8 8-10h-6z',
  back: 'M15 5l-7 7 7 7',
  chev: 'M9 5l7 7-7 7',
  down: 'M6 9l6 6 6-6',
  check: 'M5 12l5 5 9-10',
  checks: 'M2 13l4 4 8-9M12 15l2 2 8-9',
  x: 'M6 6l12 12M18 6L6 18',
  plus: 'M12 5v14M5 12h14',
  trash: 'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13',
  mute: 'M4 9v6h4l5 4V5L8 9zM17 9l4 6M21 9l-4 6',
  reply: 'M10 7L4 12l6 5M4 12h10a6 6 0 0 1 6 6',
  moon: 'M20 14A8 8 0 0 1 10 4a8 8 0 1 0 10 10z',
}

function Icon({ name, size = 22, color = 'currentColor', w = 1.9 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  )
}

const ago = (m) => (m < 1 ? 'now' : m < 60 ? `${m}m ago` : m < 1440 ? `${Math.floor(m / 60)}h ago` : `${Math.floor(m / 1440)}d ago`)
const iconBtn = { display: 'grid', placeItems: 'center', border: `1px solid ${LINE}`, borderRadius: '50%', cursor: 'pointer', padding: 0, background: GLASS, color: INK }

function AppBadge({ app, size = 40 }) {
  const a = APPS[app]
  return (
    <span style={{ width: size, height: size, borderRadius: size * 0.3, display: 'grid', placeItems: 'center', flex: 'none', background: `linear-gradient(145deg, ${a.color}, ${a.color}99)`, color: '#0d0e1b', boxShadow: `0 6px 14px ${a.color}33` }}>
      <Icon name={a.icon} size={size * 0.5} w={2.2} />
    </span>
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
          <rect x="10" y="2.500" width="3" height="8.500" rx="1" />
          <rect x="15" y="0" width="3" height="11" rx="1" />
        </svg>
        <svg width="26" height="12" viewBox="0 0 26 12">
          <rect x="0.5" y="0.5" width="22" height="11" rx="3.500" fill="none" stroke={INK} opacity=".45" />
          <rect x="2.500" y="2.500" width="16" height="7" rx="2" fill={INK} />
          <rect x="23.500" y="4" width="2" height="4" rx="1" fill={INK} opacity=".45" />
        </svg>
      </span>
    </div>
  )
}

const NAV = [
  ['all', 'bell', 'All'],
  ['grouped', 'layers', 'Grouped'],
  ['filters', 'sliders', 'Filters'],
  ['settings', 'gear', 'Settings'],
]
const initNav = (s) => (s === 'detail' ? { tab: 'all', stack: [{ id: 'detail', nid: 'n1' }] } : { tab: NAV.some((n) => n[0] === s) ? s : 'all', stack: [] })

// ---------------------------------------------------------------- app

export default function NotificationsApp({ name = 'Inbox', accent = '#8b7bff', startScreen = 'all', frame = true, style }) {
  const box = useRef()
  const toastTimer = useRef()
  const timers = useRef(new Set())
  const [scale, setScale] = useState(1)
  const [nav, setNav] = useState(() => initNav(startScreen))
  const { tab, stack } = nav
  const [dir, setDir] = useState(1)
  const [toast, setToast] = useState('')
  const [items, setItems] = useState(SEED)
  const [leaving, setLeaving] = useState({}) // id -> 'left' | 'right'
  const [open, setOpen] = useState({ messages: true, bank: true })
  const [fCats, setFCats] = useState({ people: true, social: true, money: true, reminders: true, system: true })
  const [fState, setFState] = useState('all')
  const [fAge, setFAge] = useState('any')
  const [muted, setMuted] = useState({})
  const [set, setSet] = useState({ people: true, social: true, money: true, reminders: true, system: false, banners: true, sounds: true, badges: true, previews: true, dnd: false, quiet: false })
  const seq = useRef(100)

  useEffect(() => setNav(initNav(startScreen)), [startScreen])

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
    toastTimer.current = setTimeout(() => setToast(''), 2100)
  }
  useEffect(() => () => (clearTimeout(toastTimer.current), timers.current.forEach(clearTimeout)), [])

  const top = stack[stack.length - 1]
  const push = (s) => (setDir(1), setNav((n) => ({ ...n, stack: [...n.stack, s] })))
  const pop = () => (setDir(-1), setNav((n) => ({ ...n, stack: n.stack.slice(0, -1) })))
  const go = (t) => (setDir(NAV.findIndex((n) => n[0] === t) >= NAV.findIndex((n) => n[0] === tab) ? 1 : -1), setNav({ tab: t, stack: [] }))

  const setRead = (id, v) => setItems((a) => a.map((n) => (n.id === id ? { ...n, read: v } : n)))
  const remove = (id, how = 'left') => {
    setLeaving((l) => ({ ...l, [id]: how }))
    const t = setTimeout(() => {
      timers.current.delete(t)
      setItems((a) => a.filter((n) => n.id !== id))
      setLeaving(({ [id]: _gone, ...rest }) => rest)
    }, 220)
    timers.current.add(t)
  }

  const visible = items
    .filter((n) => fCats[APPS[n.app].cat] && !muted[n.app] && (fState === 'all' || (fState === 'unread' ? !n.read : n.read)) && (fAge === 'any' || n.ago <= (fAge === 'hour' ? 60 : 1440)))
    .sort((a, b) => a.ago - b.ago)
  const unread = items.filter((n) => !n.read && !muted[n.app]).length
  const filtersOn = Object.values(fCats).some((v) => !v) + (fState !== 'all') + (fAge !== 'any') + Object.keys(muted).filter((k) => muted[k]).length

  const simulate = () => {
    const t = INCOMING[seq.current++ % INCOMING.length]
    const a = APPS[t.app]
    if (!set[a.cat]) return say(`Blocked: ${CATS.find((c) => c[0] === a.cat)[1]} is switched off`)
    if (muted[t.app]) return say(`${a.name} is muted`)
    setItems((l) => [{ ...t, id: `n${seq.current}`, full: `${t.body} This is a simulated notification from ${a.name}.`, ago: 0, read: false }, ...l])
    say(set.dnd ? 'Delivered silently (Do not disturb)' : set.banners ? `${a.name}: ${t.title}` : 'New notification')
  }

  // ---- swipeable row
  const row = (n) => <Row key={n.id} n={n} />
  function Row({ n }) {
    const [dx, setDx] = useState(0)
    const st = useRef(null)
    const out = leaving[n.id]
    const a = APPS[n.app]
    const onDown = (e) => {
      if (e.button > 0) return
      st.current = { x: e.clientX, moved: false }
      e.currentTarget.setPointerCapture?.(e.pointerId)
    }
    const onMove = (e) => {
      if (!st.current) return
      const d = (e.clientX - st.current.x) / scale
      if (Math.abs(d) > 6) st.current.moved = true
      if (st.current.moved) setDx(Math.max(-160, Math.min(160, d)))
    }
    const onUp = () => {
      if (!st.current) return
      const moved = st.current.moved
      st.current = null
      if (moved) {
        if (dx < -80) return remove(n.id, 'left')
        if (dx > 80) {
          setRead(n.id, !n.read)
          say(n.read ? 'Marked unread' : 'Marked read')
        }
        setDx(0)
      } else {
        setRead(n.id, true)
        push({ id: 'detail', nid: n.id })
      }
    }
    const stop = (e) => e.stopPropagation()
    const shift = out ? (out === 'left' ? -420 : 420) : dx
    return (
      <div style={{ position: 'relative', borderRadius: 20, opacity: out ? 0 : 1, transition: out ? 'opacity .22s' : 'none' }}>
        <div style={{ position: 'absolute', inset: 0, borderRadius: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 20px', background: dx > 0 ? '#16a34a' : '#dc2626', color: '#fff', fontSize: 12, fontWeight: 700 }} aria-hidden="true">
          <span>{dx > 0 ? (n.read ? 'Unread' : 'Read') : ''}</span>
          <span>{dx < 0 ? 'Dismiss' : ''}</span>
        </div>
        <div
          role="button"
          tabIndex={0}
          aria-label={`${a.name}: ${n.title}`}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={() => (st.current = null, setDx(0))}
          onKeyDown={(e) => { if (e.key === 'Enter') { setRead(n.id, true); push({ id: 'detail', nid: n.id }) } if (e.key === 'Delete') remove(n.id) }}
          style={{ position: 'relative', display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 12px 12px 14px', borderRadius: 20, background: n.read ? '#171829' : '#22243b', border: `1px solid ${n.read ? LINE : `${accent}66`}`, transform: `translateX(${shift}px)`, transition: st.current?.moved ? 'none' : 'transform .22s ease', cursor: 'pointer', touchAction: 'pan-y', userSelect: 'none' }}
        >
          <AppBadge app={n.app} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11.5, color: MUTED }}>
              <span style={{ textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 700 }}>{a.name}</span>
              <span>{ago(n.ago)}</span>
            </div>
            <div style={{ fontSize: 14.5, fontWeight: n.read ? 600 : 800, marginTop: 2 }}>{n.title}</div>
            <div style={{ fontSize: 13, color: n.read ? MUTED : '#c7cae0', marginTop: 2, lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{set.previews ? n.body : 'Preview hidden'}</div>
          </div>
          <div style={{ display: 'grid', gap: 8, justifyItems: 'center' }}>
            <button type="button" onPointerDown={stop} onClick={(e) => (stop(e), setRead(n.id, !n.read))} aria-label={n.read ? 'Mark unread' : 'Mark read'} style={{ ...iconBtn, width: 26, height: 26, border: 'none', background: 'none' }}>
              <span style={{ width: 11, height: 11, borderRadius: '50%', background: n.read ? 'transparent' : accent, border: n.read ? `1.5px solid ${MUTED}` : 'none', boxSizing: 'border-box' }} />
            </button>
            <button type="button" onPointerDown={stop} onClick={(e) => (stop(e), remove(n.id))} aria-label="Dismiss" style={{ ...iconBtn, width: 26, height: 26, border: 'none', background: 'none', color: MUTED }}>
              <Icon name="x" size={15} />
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ---- shared bits
  const header = (title, back, right, sub) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px 6px', minHeight: 48 }}>
      {back && (
        <button type="button" onClick={back} aria-label="Back" style={{ ...iconBtn, width: 38, height: 38 }}>
          <Icon name="back" size={20} />
        </button>
      )}
      <div style={{ flex: 1, marginLeft: 4 }}>
        <h1 style={{ margin: 0, fontSize: back ? 18 : 28, fontWeight: 800, letterSpacing: '-0.02em' }}>{title}</h1>
        {sub && <div style={{ fontSize: 12.5, color: MUTED, marginTop: 1 }}>{sub}</div>}
      </div>
      {right}
    </div>
  )

  const toggle = (on, fn, label) => (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => fn(!on)} style={{ width: 48, height: 28, borderRadius: 14, border: 'none', padding: 3, background: on ? accent : 'rgba(255,255,255,.18)', cursor: 'pointer', transition: 'background .2s', flex: 'none' }}>
      <span style={{ display: 'block', width: 22, height: 22, borderRadius: '50%', background: '#fff', transform: `translateX(${on ? 20 : 0}px)`, transition: 'transform .2s' }} />
    </button>
  )

  const pillBtn = (label, on, fn) => (
    <button key={label} type="button" aria-pressed={on} onClick={fn} style={{ height: 36, padding: '0 15px', borderRadius: 18, border: `1px solid ${on ? accent : LINE}`, background: on ? `${accent}33` : GLASS, color: on ? '#fff' : INK, font: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{label}</button>
  )

  const empty = (
    <div style={{ textAlign: 'center', padding: '60px 30px', color: MUTED, fontSize: 13.5 }}>
      <svg width="86" height="86" viewBox="0 0 86 86" fill="none" aria-hidden="true"><circle cx="43" cy="43" r="38" stroke={accent} strokeOpacity=".4" strokeWidth="2" strokeDasharray="4 6" /><path d="M28 52V42a15 15 0 0 1 30 0v10l4 4H24zM38 62h10" stroke={accent} strokeWidth="2.500" strokeLinecap="round" strokeLinejoin="round" /></svg>
      <div style={{ fontSize: 17, fontWeight: 800, color: INK, marginTop: 10 }}>All clear</div>
      <div style={{ marginTop: 4 }}>{items.length ? 'Nothing matches your filters.' : 'No notifications.'}</div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
        {items.length ? <button type="button" onClick={() => (setFCats({ people: true, social: true, money: true, reminders: true, system: true }), setFState('all'), setFAge('any'), setMuted({}), say('Filters reset'))} style={{ height: 40, padding: '0 18px', borderRadius: 20, border: 'none', background: accent, color: '#fff', font: 'inherit', fontWeight: 700, cursor: 'pointer' }}>Reset filters</button> : null}
        <button type="button" onClick={() => (setItems(SEED), say('Restored sample notifications'))} style={{ height: 40, padding: '0 18px', borderRadius: 20, border: `1px solid ${LINE}`, background: GLASS, color: INK, font: 'inherit', fontWeight: 700, cursor: 'pointer' }}>Restore samples</button>
      </div>
    </div>
  )

  // ---- screens
  let body
  let tabbed = true
  const detailItem = top?.id === 'detail' ? items.find((n) => n.id === top.nid) : null
  if (top?.id === 'detail' && detailItem) {
    tabbed = false
    const n = detailItem
    const a = APPS[n.app]
    const act = (icon, label, fn, danger) => (
      <button type="button" onClick={fn} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '14px 16px', border: 'none', borderBottom: `1px solid ${LINE}`, background: 'none', color: danger ? '#fb7185' : INK, font: 'inherit', fontSize: 14.5, fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}>
        <Icon name={icon} size={20} color={danger ? '#fb7185' : a.color} />
        {label}
      </button>
    )
    body = (
      <>
        {header('Notification', pop)}
        <div style={{ textAlign: 'center', padding: '14px 24px 6px' }}>
          <AppBadge app={n.app} size={64} />
          <div style={{ fontSize: 12, fontWeight: 700, color: a.color, textTransform: 'uppercase', letterSpacing: '.08em', marginTop: 12 }}>{a.name}</div>
          <h2 style={{ margin: '4px 0 0', fontSize: 23, fontWeight: 800, letterSpacing: '-0.02em' }}>{n.title}</h2>
          <div style={{ fontSize: 12.5, color: MUTED, marginTop: 4 }}>{ago(n.ago)} · {n.read ? 'Read' : 'Unread'}</div>
        </div>
        <div style={{ margin: '12px 20px 0', padding: 16, borderRadius: 22, background: GLASS, border: `1px solid ${LINE}`, fontSize: 14.5, lineHeight: 1.55, color: '#d6d8ec' }}>{n.full}</div>
        <div style={{ margin: '14px 20px 0', borderRadius: 22, background: GLASS, border: `1px solid ${LINE}`, overflow: 'hidden' }}>
          {act('reply', `Open in ${a.name}`, () => say(`Opening ${a.name}…`))}
          {act('chat', 'Quick reply', () => say('Reply sent'))}
          {act('check', n.read ? 'Mark as unread' : 'Mark as read', () => (setRead(n.id, !n.read), say(n.read ? 'Marked unread' : 'Marked read')))}
          {act('mute', muted[n.app] ? `Unmute ${a.name}` : `Mute ${a.name}`, () => { setMuted((m) => ({ ...m, [n.app]: !m[n.app] })); say(muted[n.app] ? `${a.name} unmuted` : `${a.name} muted`) })}
          {act('trash', 'Delete', () => (remove(n.id), pop(), say('Notification deleted')), true)}
        </div>
      </>
    )
  } else if (tab === 'all' || (top?.id === 'detail' && !detailItem)) {
    const sections = [['New', visible.filter((n) => n.ago < 60)], ['Earlier today', visible.filter((n) => n.ago >= 60 && n.ago < 1440)], ['Earlier', visible.filter((n) => n.ago >= 1440)]].filter((s) => s[1].length)
    const hb = (icon, label, fn) => <button type="button" onClick={fn} aria-label={label} style={{ ...iconBtn, width: 38, height: 38 }}><Icon name={icon} size={18} /></button>
    body = (
      <>
        {header('Notifications', null, <div style={{ display: 'flex', gap: 6 }}>{hb('checks', 'Mark all read', () => (setItems((a) => a.map((n) => ({ ...n, read: true }))), say('All marked read')))}{hb('trash', 'Clear all', () => (visible.forEach((n) => remove(n.id)), say(visible.length ? `Cleared ${visible.length}` : 'Nothing to clear')))}<button type="button" onClick={simulate} aria-label="Simulate incoming" style={{ ...iconBtn, width: 38, height: 38, background: accent, border: 'none', color: '#fff' }}><Icon name="plus" size={20} /></button></div>, `${unread} unread${filtersOn ? ` · ${filtersOn} filter${filtersOn > 1 ? 's' : ''} on` : ''}`)}
        <div style={{ padding: '4px 20px', display: 'grid', gap: 8 }}>
          {sections.map(([label, list]) => (
            <div key={label} style={{ display: 'grid', gap: 8 }}>
              <div style={{ fontSize: 11.5, fontWeight: 800, color: MUTED, textTransform: 'uppercase', letterSpacing: '.08em', margin: '8px 0 0' }}>{label}</div>
              {list.map(row)}
            </div>
          ))}
          {!visible.length && empty}
          {!!visible.length && <div style={{ textAlign: 'center', fontSize: 11.5, color: MUTED, padding: '10px 0' }}>Swipe left to dismiss, right to mark read</div>}
        </div>
      </>
    )
  } else if (tab === 'grouped') {
    const apps = Object.keys(APPS).filter((k) => visible.some((n) => n.app === k)).sort((x, y) => Math.min(...visible.filter((n) => n.app === x).map((n) => n.ago)) - Math.min(...visible.filter((n) => n.app === y).map((n) => n.ago)))
    const allOpen = apps.length && apps.every((k) => open[k])
    body = (
      <>
        {header('By app', null, <button type="button" onClick={() => setOpen(Object.fromEntries(apps.map((k) => [k, !allOpen])))} style={{ height: 36, padding: '0 14px', borderRadius: 18, border: `1px solid ${LINE}`, background: GLASS, color: INK, font: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>{allOpen ? 'Collapse all' : 'Expand all'}</button>, `${visible.length} notifications in ${apps.length} apps`)}
        <div style={{ padding: '6px 20px', display: 'grid', gap: 12 }}>
          {apps.map((k) => {
            const list = visible.filter((n) => n.app === k)
            const un = list.filter((n) => !n.read).length
            const isOpen = !!open[k]
            return (
              <div key={k} style={{ position: 'relative' }}>
                {!isOpen && list.length > 1 && <div aria-hidden="true" style={{ position: 'absolute', left: 14, right: 14, bottom: -6, height: 20, borderRadius: '0 0 18px 18px', background: '#1c1d31', border: `1px solid ${LINE}` }} />}
                <div style={{ position: 'relative', borderRadius: 22, background: GLASS, border: `1px solid ${LINE}`, padding: 8, backdropFilter: 'blur(8px)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <button type="button" onClick={() => setOpen((o) => ({ ...o, [k]: !o[k] }))} aria-expanded={isOpen} aria-label={`${APPS[k].name}, ${list.length} notifications`} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, padding: 6, border: 'none', background: 'none', color: INK, font: 'inherit', cursor: 'pointer', textAlign: 'left' }}>
                      <AppBadge app={k} size={34} />
                      <span style={{ flex: 1 }}>
                        <span style={{ display: 'block', fontSize: 14.5, fontWeight: 800 }}>{APPS[k].name}</span>
                        <span style={{ display: 'block', fontSize: 12, color: MUTED }}>{isOpen ? `${list.length} notification${list.length > 1 ? 's' : ''}` : list[0].title}</span>
                      </span>
                      {un > 0 && <span style={{ minWidth: 22, height: 22, borderRadius: 11, background: accent, color: '#fff', fontSize: 12, fontWeight: 800, display: 'grid', placeItems: 'center', padding: '0 6px' }}>{un}</span>}
                      <span style={{ display: 'flex', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s', color: MUTED }}><Icon name="down" size={18} /></span>
                    </button>
                  </div>
                  {isOpen && (
                    <div style={{ display: 'grid', gap: 8, padding: '6px 0 4px' }}>
                      {list.map(row)}
                      <div style={{ display: 'flex', gap: 8, padding: '2px 0' }}>
                        <button type="button" onClick={() => (list.forEach((n) => setRead(n.id, true)), say(`${APPS[k].name} marked read`))} style={{ flex: 1, height: 36, borderRadius: 18, border: `1px solid ${LINE}`, background: GLASS, color: INK, font: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>Mark group read</button>
                        <button type="button" onClick={() => (list.forEach((n) => remove(n.id)), say(`Cleared ${APPS[k].name}`))} style={{ flex: 1, height: 36, borderRadius: 18, border: 'none', background: 'rgba(251,113,133,.18)', color: '#fb7185', font: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>Clear group</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
          {!visible.length && empty}
        </div>
      </>
    )
  } else if (tab === 'filters') {
    const ml = Object.keys(muted).filter((k) => muted[k])
    body = (
      <>
        {header('Filters', null, <button type="button" onClick={() => (setFCats({ people: true, social: true, money: true, reminders: true, system: true }), setFState('all'), setFAge('any'), setMuted({}), say('Filters reset'))} style={{ height: 36, padding: '0 14px', borderRadius: 18, border: `1px solid ${LINE}`, background: GLASS, color: INK, font: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>Reset</button>)}
        <div style={{ padding: '4px 20px', display: 'grid', gap: 18 }}>
          <section>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: MUTED, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>Category</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{CATS.map(([id, l]) => pillBtn(l, fCats[id], () => setFCats((c) => ({ ...c, [id]: !c[id] }))))}</div>
          </section>
          <section>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: MUTED, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>Status</div>
            <div style={{ display: 'flex', gap: 8 }}>{[['all', 'All'], ['unread', 'Unread'], ['read', 'Read']].map(([id, l]) => pillBtn(l, fState === id, () => setFState(id)))}</div>
          </section>
          <section>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: MUTED, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>Age</div>
            <div style={{ display: 'flex', gap: 8 }}>{[['any', 'Any time'], ['day', 'Last 24h'], ['hour', 'Last hour']].map(([id, l]) => pillBtn(l, fAge === id, () => setFAge(id)))}</div>
          </section>
          <section>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: MUTED, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>Muted apps</div>
            {ml.length ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{ml.map((k) => pillBtn(`${APPS[k].name} ✕`, true, () => setMuted((m) => ({ ...m, [k]: false }))))}</div> : <div style={{ fontSize: 13, color: MUTED }}>None. Mute an app from a notification's detail page.</div>}
          </section>
          <button type="button" onClick={() => go('all')} style={{ height: 52, borderRadius: 26, border: 'none', background: accent, color: '#fff', font: 'inherit', fontSize: 15, fontWeight: 800, cursor: 'pointer' }}>Show {visible.length} result{visible.length === 1 ? '' : 's'}</button>
        </div>
      </>
    )
  } else {
    const grp = (rows) => <div style={{ margin: '0 20px 16px', borderRadius: 22, background: GLASS, border: `1px solid ${LINE}`, padding: '2px 16px' }}>{rows}</div>
    const srow = (label, sub, key, last) => (
      <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 0', borderBottom: last ? 'none' : `1px solid ${LINE}` }}>
        <span style={{ flex: 1 }}>
          <span style={{ display: 'block', fontSize: 14.5, fontWeight: 600 }}>{label}</span>
          {sub && <span style={{ display: 'block', fontSize: 12, color: MUTED, marginTop: 1 }}>{sub}</span>}
        </span>
        {toggle(set[key], (v) => (setSet((s) => ({ ...s, [key]: v })), say(`${label} ${v ? 'on' : 'off'}`)), label)}
      </div>
    )
    body = (
      <>
        {header('Settings')}
        <div style={{ padding: '4px 36px 8px', fontSize: 11.5, fontWeight: 800, color: MUTED, textTransform: 'uppercase', letterSpacing: '.08em' }}>Allow by category</div>
        {grp(CATS.map(([id, l, sub], i) => srow(l, sub, id, i === CATS.length - 1)))}
        <div style={{ padding: '0 36px 8px', fontSize: 11.5, fontWeight: 800, color: MUTED, textTransform: 'uppercase', letterSpacing: '.08em' }}>Delivery</div>
        {grp([srow('Banners', 'Pop-up on arrival', 'banners'), srow('Sounds', null, 'sounds'), srow('Badge count', 'Show unread on the app icon', 'badges'), srow('Show previews', 'Hide message text when off', 'previews', true)])}
        <div style={{ padding: '0 36px 8px', fontSize: 11.5, fontWeight: 800, color: MUTED, textTransform: 'uppercase', letterSpacing: '.08em' }}>Focus</div>
        {grp([srow('Do not disturb', 'Deliver silently', 'dnd'), srow('Quiet hours', '22:00 to 07:00', 'quiet', true)])}
        <div style={{ padding: '0 20px' }}>
          <button type="button" onClick={() => (setItems(SEED), setMuted({}), say('Sample notifications restored'))} style={{ width: '100%', height: 48, borderRadius: 24, border: `1px solid ${LINE}`, background: GLASS, color: INK, font: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Restore sample notifications</button>
        </div>
      </>
    )
  }

  const phone = (
    <div style={{ position: 'relative', width: W, height: H, overflow: 'hidden', borderRadius: frame ? 46 : 0, background: BG, color: INK, fontFamily: "'Inter', 'SF Pro Text', 'Segoe UI', system-ui, sans-serif" }}>
      <style>{`
        @keyframes nt-r { from { opacity: 0; transform: translateX(34px) } to { opacity: 1; transform: none } }
        @keyframes nt-l { from { opacity: 0; transform: translateX(-34px) } to { opacity: 1; transform: none } }
        .nt-scroll { scrollbar-width: none } .nt-scroll::-webkit-scrollbar { display: none }
        .nt-app button:focus-visible, .nt-app [role=button]:focus-visible { outline: 2px solid ${accent}; outline-offset: 2px }
        @media (prefers-reduced-motion: reduce) { .nt-page { animation: none !important } .nt-app * { transition: none !important } }
      `}</style>
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: `radial-gradient(circle at 15% 8%, ${accent}55, transparent 45%), radial-gradient(circle at 90% 70%, #0ea5e955, transparent 45%)` }} />
      <StatusBar frame={frame} />
      <div key={`${tab}/${stack.map((s) => s.id + (s.nid || '')).join('/')}`} className="nt-scroll nt-page" style={{ position: 'absolute', top: 54, bottom: tabbed ? 88 : 0, left: 0, right: 0, overflowY: 'auto', overflowX: 'hidden', paddingBottom: 24, animation: `${dir > 0 ? 'nt-r' : 'nt-l'} .28s ease` }}>
        {body}
      </div>
      {tabbed && (
        <nav aria-label="Main" style={{ position: 'absolute', left: 12, right: 12, bottom: 22, height: 64, borderRadius: 32, background: 'rgba(30,31,52,.82)', border: `1px solid ${LINE}`, backdropFilter: 'blur(14px)', display: 'flex', justifyContent: 'space-around', alignItems: 'center', padding: '0 6px' }}>
          {NAV.map(([id, icon, label]) => (
            <button key={id} type="button" onClick={() => go(id)} aria-current={tab === id ? 'page' : undefined} style={{ position: 'relative', border: 'none', background: tab === id ? `${accent}33` : 'none', borderRadius: 24, font: 'inherit', cursor: 'pointer', display: 'grid', justifyItems: 'center', alignContent: 'center', gap: 2, width: 76, height: 50, fontSize: 10.5, fontWeight: 700, color: tab === id ? '#fff' : MUTED }}>
              <Icon name={icon} size={21} />
              {label}
              {id === 'all' && set.badges && unread > 0 && <span style={{ position: 'absolute', top: 2, right: 14, minWidth: 17, height: 17, borderRadius: 9, background: '#fb7185', color: '#fff', fontSize: 10, fontWeight: 800, display: 'grid', placeItems: 'center', padding: '0 4px' }}>{unread}</span>}
              {id === 'filters' && filtersOn > 0 && <span style={{ position: 'absolute', top: 6, right: 20, width: 9, height: 9, borderRadius: '50%', background: accent }} />}
            </button>
          ))}
        </nav>
      )}
      <div role="status" style={{ position: 'absolute', left: '50%', top: 58, zIndex: 30, transform: `translate(-50%, ${toast ? 0 : -90}px)`, transition: 'transform .35s cubic-bezier(.2,.8,.2,1)', padding: '10px 16px', borderRadius: 20, background: '#f4f5ff', color: '#14152a', fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap', maxWidth: 350, overflow: 'hidden', textOverflow: 'ellipsis' }}>{toast}</div>
      <div style={{ position: 'absolute', left: '50%', bottom: 8, width: 140, height: 5, marginLeft: -70, borderRadius: 3, background: INK, opacity: 0.7, zIndex: 25 }} />
    </div>
  )

  return (
    <div ref={box} className="nt-app" style={{ position: 'relative', width: '100%', height: '100%', display: 'grid', placeItems: 'center', overflow: 'hidden', background: 'radial-gradient(ellipse at 50% 30%, #2a2c52, #0a0b16 75%)', ...style }}>
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
