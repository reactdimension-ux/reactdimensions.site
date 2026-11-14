import { useEffect, useRef, useState } from 'react'

// An event-invite app on a phone, as a click-through prototype. Five pages:
// Events (filterable cards), Event detail (pushed, with hero art, map, add to
// calendar and an inline RSVP), Guests (per-event list with status filter,
// nudge/remove and invite), RSVP (Going / Maybe / Can't go plus a +1 stepper)
// and Calendar (a real month grid that marks event days; tap a day to list
// its events). Answering Going bursts confetti (skipped for reduced motion)
// and every answer updates the guest count, the Events list and the Guests
// tab. Detail screens slide in with a back button. The phone scales to fit.

const W = 390
const H = 844
const INK = '#2b1838'
const MUTED = '#8a7691'
const BG = '#fff6ee'
const GOOD = '#16a34a'
const WARN = '#d97706'
const BAD = '#dc2626'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const TODAY = (() => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
})()
const addDays = (d, n) => {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}
const dkey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
const fmtDay = (d) => `${DOW[(d.getDay() + 6) % 7]} ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`

const EVENTS = [
  { id: 'e1', title: 'Rooftop Birthday', kind: 'party', hue: 335, off: 2, time: '19:30', place: 'Skyline Terrace, 14 Pier St', host: 'Mia Okafor', about: 'Mia turns 30. Dress up, bring good energy. Cake at nine, DJ until late, and a view of the whole harbour.' },
  { id: 'e2', title: 'Supper Club', kind: 'dinner', hue: 22, off: 6, time: '20:00', place: 'Number Nine, Elm Court', host: 'Leo Martins', about: 'Five courses, one long table. Tell Leo about allergies when you answer. Wine pairing is on the house.' },
  { id: 'e3', title: 'Sunrise Hike', kind: 'hike', hue: 150, off: 9, time: '05:15', place: 'Ridge trailhead, car park B', host: 'Sam Patel', about: 'Easy 6 km loop to catch the sunrise. Bring layers and a flask. We stop for pastries on the way down.' },
  { id: 'e4', title: 'Open Mic Night', kind: 'music', hue: 270, off: 15, time: '21:00', place: 'The Velvet Room', host: 'Zoe Laurent', about: 'Sign up to play three songs or just come and cheer. House band backs anyone who asks.' },
  { id: 'e5', title: 'Board Game Marathon', kind: 'games', hue: 200, off: 22, time: '14:00', place: "Ava's flat, 3B", host: 'Ava Chen', about: 'Catan, Codenames and the dreaded Monopoly. Snacks provided, bring a game you love.' },
].map((e) => ({ ...e, day: addDays(TODAY, e.off) }))

const NAMES = ['Ava Chen', 'Leo Martins', 'Mia Okafor', 'Sam Patel', 'Zoe Laurent', 'Noah Kim', 'Ivy Brooks', 'Omar Haddad', 'Lena Fischer', 'Tariq Ali']
const STS = ['going', 'going', 'maybe', 'going', 'no', 'going', 'maybe', 'invited']
const makeGuests = (idx) => NAMES.map((n, i) => ({ id: `g${i}`, name: n, hue: (i * 47 + 10) % 360, st: STS[(i + idx) % STS.length] }))
const EXTRA = ['Pia Romano', 'Jonas Weber', 'Hana Sato', 'Cleo Duval', 'Ben Adler']
const CONFETTI = ['#f43f5e', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#facc15']
const STATUS = { going: ['Going', GOOD, '#dcfce7'], maybe: ['Maybe', WARN, '#fef3c7'], no: ["Can't go", BAD, '#fee2e2'], invited: ['Invited', MUTED, '#efe7f3'] }

const NAV = [
  ['events', 'ticket', 'Events'],
  ['guests', 'users', 'Guests'],
  ['rsvp', 'mail', 'RSVP'],
  ['calendar', 'cal', 'Calendar'],
]

const ICONS = {
  ticket: 'M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4zM14 6v12',
  users: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.2 3.2 0 0 1 0 6.2M18 14a6 6 0 0 1 3.5 6',
  mail: 'M3 6h18v12H3zM3 7l9 7 9-7',
  cal: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  back: 'M15 5l-7 7 7 7',
  chev: 'M9 5l7 7-7 7',
  pin: 'M12 21s7-6 7-11a7 7 0 0 0-14 0c0 5 7 11 7 11zM12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  check: 'M5 12l5 5 9-10',
  x: 'M6 6l12 12M18 6L6 18',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  share: 'M12 4v11M8 8l4-4 4 4M5 13v6h14v-6',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 20a8 8 0 0 1 16 0',
  bell: 'M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4',
  help: 'M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01',
}

function Icon({ name, size = 22, color = 'currentColor', w = 1.9 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  )
}

const iconBtn = { display: 'grid', placeItems: 'center', border: 'none', borderRadius: '50%', cursor: 'pointer', padding: 0, background: '#fff', color: INK }

function Avatar({ p, size = 40 }) {
  return (
    <span style={{ width: size, height: size, borderRadius: '50%', display: 'grid', placeItems: 'center', flex: 'none', background: `hsl(${p.hue} 75% 90%)`, color: `hsl(${p.hue} 55% 30%)`, fontWeight: 700, fontSize: size * 0.36, border: '2px solid #fff', boxSizing: 'border-box' }}>
      {p.name.split(' ').map((s) => s[0]).join('')}
    </span>
  )
}

// Inline scene per kind of event, tinted by the event's hue.
function EventArt({ kind, hue, h = 150, radius = 22 }) {
  const a = `hsl(${hue} 85% 62%)`
  const b = `hsl(${(hue + 40) % 360} 85% 45%)`
  const light = `hsl(${hue} 90% 88%)`
  const id = `ea-${kind}`
  let scene = null
  if (kind === 'party') {
    scene = [[60, 70, 26, '#fde68a'], [110, 50, 30, '#fff'], [170, 80, 24, light], [250, 52, 32, '#fde68a'], [320, 78, 26, '#fff']].map(([x, y, r, c], i) => (
      <g key={i}>
        <path d={`M${x} ${y + r} q ${i % 2 ? 10 : -10} 30 0 ${h - y - r}`} stroke="#fff" strokeOpacity=".6" fill="none" />
        <ellipse cx={x} cy={y} rx={r * 0.85} ry={r} fill={c} opacity=".92" />
        <ellipse cx={x - r * 0.3} cy={y - r * 0.35} rx={r * 0.18} ry={r * 0.3} fill="#fff" opacity=".6" />
      </g>
    ))
  } else if (kind === 'dinner') {
    scene = (
      <g>
        <rect x="0" y={h - 46} width="390" height="46" fill="#000" opacity=".22" />
        <circle cx="195" cy={h - 52} r="46" fill="#fff" opacity=".95" />
        <circle cx="195" cy={h - 52} r="30" fill="none" stroke={a} strokeWidth="3" />
        {[70, 310].map((x) => (
          <g key={x}>
            <rect x={x - 5} y={h - 100} width="10" height="54" fill="#fff" opacity=".9" />
            <path d={`M${x} ${h - 128} q 10 14 0 24 q -10 -10 0 -24z`} fill="#fcd34d" />
          </g>
        ))}
      </g>
    )
  } else if (kind === 'hike') {
    scene = (
      <g>
        <circle cx="285" cy="58" r="30" fill="#fde68a" />
        <path d={`M0 ${h} L70 70 L130 ${h - 50} L200 40 L300 ${h} Z`} fill={b} opacity=".85" />
        <path d={`M120 ${h} L240 80 L320 ${h - 40} L390 60 L390 ${h} Z`} fill="#000" opacity=".28" />
        <path d="M200 40 l-18 26 q 18 -6 36 0z" fill="#fff" opacity=".9" />
      </g>
    )
  } else if (kind === 'music') {
    scene = (
      <g fill="none" stroke="#fff" strokeLinecap="round">
        {[0, 1, 2, 3].map((i) => (
          <path key={i} d={`M0 ${50 + i * 24} q 48 -${24 + i * 5} 97 0 t 97 0 t 98 0 t 98 0`} strokeOpacity={0.7 - i * 0.12} strokeWidth="3" />
        ))}
        <circle cx="300" cy="60" r="18" fill="#fff" stroke="none" opacity=".9" />
        <path d="M312 60V28l16 6" strokeWidth="4" />
      </g>
    )
  } else {
    scene = (
      <g>
        {[[80, 80, -14], [175, 60, 10], [280, 88, -6]].map(([x, y, r], i) => (
          <g key={i} transform={`rotate(${r} ${x} ${y})`}>
            <rect x={x - 28} y={y - 28} width="56" height="56" rx="12" fill="#fff" opacity=".95" />
            {[[-12, -12], [12, 12], [0, 0], [12, -12], [-12, 12]].slice(0, 2 + i * 2 - (i === 2 ? 1 : 0)).map(([dx, dy], j) => <circle key={j} cx={x + dx} cy={y + dy} r="5" fill={b} />)}
          </g>
        ))}
      </g>
    )
  }
  return (
    <svg viewBox={`0 0 390 ${h}`} preserveAspectRatio="xMidYMid slice" style={{ display: 'block', width: '100%', height: h, borderRadius: radius }} aria-hidden="true">
      <defs>
        <linearGradient id={id + hue} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={a} />
          <stop offset="1" stopColor={b} />
        </linearGradient>
      </defs>
      <rect width="390" height={h} fill={`url(#${id + hue})`} />
      {scene}
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
          <rect x="0.5" y="0.5" width="22" height="11" rx="3.5" fill="none" stroke={INK} opacity=".45" />
          <rect x="2.5" y="2.5" width="16" height="7" rx="2" fill={INK} />
          <rect x="23.5" y="4" width="2" height="4" rx="1" fill={INK} opacity=".45" />
        </svg>
      </span>
    </div>
  )
}

const initNav = (start) => (start === 'detail' ? { tab: 'events', stack: [{ id: 'detail', ev: 'e1' }] } : { tab: NAV.some((n) => n[0] === start) ? start : 'events', stack: [] })

// ---------------------------------------------------------------- app

export default function EventApp({ name = 'Gather', accent = '#e8467c', startScreen = 'events', frame = true, style }) {
  const box = useRef()
  const toastTimer = useRef()
  const burstTimer = useRef()
  const [scale, setScale] = useState(1)
  const [nav, setNav] = useState(() => initNav(startScreen))
  const { tab, stack } = nav
  const [dir, setDir] = useState(1)
  const [toast, setToast] = useState('')
  const [rsvp, setRsvp] = useState({ e1: null, e2: 'maybe', e3: null, e4: null, e5: 'going' })
  const [plus, setPlus] = useState({})
  const [guests, setGuests] = useState(() => Object.fromEntries(EVENTS.map((e, i) => [e.id, makeGuests(i)])))
  const [added, setAdded] = useState({})
  const [selId, setSelId] = useState('e1')
  const [filter, setFilter] = useState('All')
  const [gFilter, setGFilter] = useState('all')
  const [openGuest, setOpenGuest] = useState(null)
  const [month, setMonth] = useState({ y: TODAY.getFullYear(), m: TODAY.getMonth() })
  const [selDay, setSelDay] = useState(dkey(TODAY))
  const [pieces, setPieces] = useState(null)

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
    toastTimer.current = setTimeout(() => setToast(''), 1900)
  }
  useEffect(() => () => (clearTimeout(toastTimer.current), clearTimeout(burstTimer.current)), [])

  const top = stack[stack.length - 1]
  const push = (s) => (setDir(1), setNav((n) => ({ ...n, stack: [...n.stack, s] })))
  const pop = () => (setDir(-1), setNav((n) => ({ ...n, stack: n.stack.slice(0, -1) })))
  const go = (t) => (setDir(NAV.findIndex((n) => n[0] === t) >= NAV.findIndex((n) => n[0] === tab) ? 1 : -1), setNav({ tab: t, stack: [] }))
  const openEvent = (id) => (setSelId(id), push({ id: 'detail', ev: id }))

  const goingCount = (id) => guests[id].filter((g) => g.st === 'going').length + (rsvp[id] === 'going' ? 1 + (plus[id] || 0) : 0)
  const countOf = (id, st) => guests[id].filter((g) => g.st === st).length + (rsvp[id] === st ? 1 : 0)

  const answer = (id, v) => {
    const ev = EVENTS.find((e) => e.id === id)
    setRsvp((r) => ({ ...r, [id]: v }))
    say(v === 'going' ? `You're going to ${ev.title}!` : v === 'maybe' ? 'Marked as maybe' : "Maybe next time — host notified")
    if (v === 'going' && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setPieces(Array.from({ length: 38 }, (_, i) => ({ id: i, dx: (Math.random() - 0.5) * 360, dy: -(140 + Math.random() * 300), r: Math.random() * 720 - 360, c: CONFETTI[i % CONFETTI.length], d: 1 + Math.random() * 0.6, w: 6 + Math.random() * 6 })))
      clearTimeout(burstTimer.current)
      burstTimer.current = setTimeout(() => setPieces(null), 1900)
    }
  }

  // ---- shared bits
  const header = (title, back, right) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px 6px', minHeight: 48 }}>
      {back && (
        <button type="button" onClick={back} aria-label="Back" style={{ ...iconBtn, width: 38, height: 38 }}>
          <Icon name="back" size={20} />
        </button>
      )}
      <h1 style={{ margin: 0, flex: 1, fontFamily: "Georgia, 'Times New Roman', serif", fontSize: back ? 19 : 28, fontWeight: 700, letterSpacing: '-0.01em', marginLeft: 4 }}>{title}</h1>
      {right}
    </div>
  )

  const chips = (list, val, set) => (
    <div className="ev-scroll" style={{ display: 'flex', gap: 8, padding: '4px 20px 10px', overflowX: 'auto' }}>
      {list.map(([id, label]) => (
        <button key={id} type="button" onClick={() => set(id)} aria-pressed={val === id} style={{ flex: 'none', height: 34, padding: '0 14px', borderRadius: 17, border: 'none', background: val === id ? INK : '#fff', color: val === id ? '#fff' : INK, font: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{label}</button>
      ))}
    </div>
  )

  const pill = (st) => {
    const [l, c, bg] = STATUS[st]
    return <span style={{ padding: '3px 10px', borderRadius: 12, background: bg, color: c, fontSize: 11.5, fontWeight: 700 }}>{l}</span>
  }

  const rsvpButtons = (id) => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
      {[['going', 'Going', 'check', GOOD], ['maybe', 'Maybe', 'help', WARN], ['no', "Can't go", 'x', BAD]].map(([v, l, ic, c]) => {
        const on = rsvp[id] === v
        return (
          <button key={v} type="button" aria-pressed={on} onClick={() => answer(id, v)} style={{ height: 66, borderRadius: 18, border: `2px solid ${on ? c : 'transparent'}`, background: on ? c : '#fff', color: on ? '#fff' : INK, font: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'grid', placeItems: 'center', alignContent: 'center', gap: 4, transition: 'background .2s' }}>
            <Icon name={ic} size={20} color={on ? '#fff' : c} w={2.3} />
            {l}
          </button>
        )
      })}
    </div>
  )

  const faces = (id) => (
    <span style={{ display: 'flex' }}>
      {guests[id].filter((g) => g.st === 'going').slice(0, 4).map((g, i) => (
        <span key={g.id} style={{ marginLeft: i ? -10 : 0 }}><Avatar p={g} size={30} /></span>
      ))}
    </span>
  )

  const eventCard = (e) => (
    <button key={e.id} type="button" onClick={() => openEvent(e.id)} style={{ display: 'block', width: '100%', padding: 0, border: 'none', borderRadius: 24, background: '#fff', font: 'inherit', textAlign: 'left', cursor: 'pointer', color: INK, overflow: 'hidden', boxShadow: '0 8px 22px rgba(80,30,70,.1)' }}>
      <div style={{ position: 'relative' }}>
        <EventArt kind={e.kind} hue={e.hue} h={118} radius={0} />
        <span style={{ position: 'absolute', left: 12, top: 12, borderRadius: 14, background: '#fff', padding: '5px 10px', textAlign: 'center', lineHeight: 1.05, boxShadow: '0 4px 10px rgba(0,0,0,.15)' }}>
          <span style={{ display: 'block', fontSize: 10, fontWeight: 800, color: accent, textTransform: 'uppercase' }}>{MONTHS[e.day.getMonth()].slice(0, 3)}</span>
          <span style={{ display: 'block', fontSize: 19, fontWeight: 800 }}>{e.day.getDate()}</span>
        </span>
        {rsvp[e.id] && <span style={{ position: 'absolute', right: 12, top: 12 }}>{pill(rsvp[e.id])}</span>}
      </div>
      <div style={{ padding: '12px 16px 14px' }}>
        <div style={{ fontFamily: "Georgia, serif", fontSize: 18, fontWeight: 700 }}>{e.title}</div>
        <div style={{ fontSize: 12.5, color: MUTED, marginTop: 3 }}>{fmtDay(e.day)} · {e.time} · {e.place.split(',')[0]}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
          {faces(e.id)}
          <span style={{ fontSize: 12.5, fontWeight: 600, color: INK }}>{goingCount(e.id)} going</span>
        </div>
      </div>
    </button>
  )

  // ---- screens
  let body
  let tabbed = true
  if (top?.id === 'detail') {
    tabbed = false
    const e = EVENTS.find((x) => x.id === top.ev)
    body = (
      <>
        <div style={{ position: 'relative' }}>
          <EventArt kind={e.kind} hue={e.hue} h={210} radius={0} />
          <button type="button" onClick={pop} aria-label="Back" style={{ ...iconBtn, position: 'absolute', left: 16, top: 8, width: 38, height: 38 }}><Icon name="back" size={20} /></button>
          <button type="button" onClick={() => say('Invite link copied')} aria-label="Share" style={{ ...iconBtn, position: 'absolute', right: 16, top: 8, width: 38, height: 38 }}><Icon name="share" size={19} /></button>
        </div>
        <div style={{ margin: '-26px 16px 0', position: 'relative', background: '#fff', borderRadius: 26, padding: '18px 18px 16px', boxShadow: '0 10px 26px rgba(80,30,70,.12)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 8 }}>
            <h2 style={{ margin: 0, fontFamily: 'Georgia, serif', fontSize: 25, lineHeight: 1.1 }}>{e.title}</h2>
            {rsvp[e.id] && pill(rsvp[e.id])}
          </div>
          <div style={{ display: 'grid', gap: 10, marginTop: 14, fontSize: 13.5 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><Icon name="cal" size={18} color={accent} />{fmtDay(e.day)}, {e.day.getFullYear()}</div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><Icon name="clock" size={18} color={accent} />{e.time}</div>
            <button type="button" onClick={() => say('Opening directions…')} style={{ display: 'flex', gap: 10, alignItems: 'center', border: 'none', background: 'none', padding: 0, font: 'inherit', cursor: 'pointer', color: INK, textAlign: 'left' }}><Icon name="pin" size={18} color={accent} /><span style={{ textDecoration: 'underline', textDecorationColor: `${accent}88` }}>{e.place}</span></button>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><Icon name="user" size={18} color={accent} />Hosted by {e.host}</div>
          </div>
          <p style={{ margin: '14px 0 0', fontSize: 13.5, lineHeight: 1.5, color: '#5b4766' }}>{e.about}</p>
        </div>
        <button type="button" onClick={() => (setSelId(e.id), go('guests'))} style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '12px 16px 0', width: 'calc(100% - 32px)', padding: '12px 16px', border: 'none', borderRadius: 20, background: '#fff', font: 'inherit', cursor: 'pointer', color: INK, textAlign: 'left' }}>
          {faces(e.id)}
          <span style={{ flex: 1, fontSize: 13.5, fontWeight: 700 }}>{goingCount(e.id)} going · {countOf(e.id, 'maybe')} maybe</span>
          <Icon name="chev" size={18} color={MUTED} />
        </button>
        <div style={{ padding: '12px 16px 0' }}>{rsvpButtons(e.id)}</div>
        <div style={{ padding: '12px 16px 0' }}>
          <button type="button" onClick={() => (setAdded((a) => ({ ...a, [e.id]: !a[e.id] })), say(added[e.id] ? 'Removed from calendar' : 'Added to your calendar'))} style={{ width: '100%', height: 50, borderRadius: 25, border: 'none', background: added[e.id] ? '#fff' : accent, color: added[e.id] ? accent : '#fff', font: 'inherit', fontSize: 14.5, fontWeight: 700, cursor: 'pointer', boxShadow: added[e.id] ? `inset 0 0 0 2px ${accent}` : 'none' }}>{added[e.id] ? 'Added to calendar ✓' : 'Add to calendar'}</button>
        </div>
      </>
    )
  } else if (tab === 'events') {
    const list = EVENTS.filter((e) => filter === 'All' || (filter === 'Pending' ? !rsvp[e.id] : rsvp[e.id] === filter.toLowerCase()))
    body = (
      <>
        {header(`${name} events`, null, <button type="button" onClick={() => say('3 invitations waiting')} aria-label="Invitations" style={{ ...iconBtn, width: 40, height: 40 }}><Icon name="bell" size={19} /></button>)}
        {chips([['All', 'All'], ['Going', 'Going'], ['Maybe', 'Maybe'], ['Pending', 'Awaiting reply']], filter, setFilter)}
        <div style={{ display: 'grid', gap: 14, padding: '0 20px' }}>
          {list.map(eventCard)}
          {!list.length && <div style={{ textAlign: 'center', color: MUTED, fontSize: 13, padding: '30px 0' }}>No events here yet.</div>}
        </div>
      </>
    )
  } else if (tab === 'guests') {
    const e = EVENTS.find((x) => x.id === selId)
    const list = guests[e.id].filter((g) => gFilter === 'all' || g.st === gFilter)
    const tot = guests[e.id].length + 1
    const segs = ['going', 'maybe', 'no', 'invited']
    body = (
      <>
        {header('Guests', null, <button type="button" onClick={() => { const n = EXTRA[guests[e.id].length % EXTRA.length]; setGuests((g) => ({ ...g, [e.id]: [...g[e.id], { id: `x${Date.now()}`, name: n, hue: (n.length * 53) % 360, st: 'invited' }] })); say(`Invited ${n}`) }} aria-label="Invite someone" style={{ ...iconBtn, width: 40, height: 40, background: accent, color: '#fff' }}><Icon name="plus" size={20} /></button>)}
        {chips(EVENTS.map((x) => [x.id, x.title]), selId, (id) => (setSelId(id), setOpenGuest(null)))}
        <div style={{ margin: '0 20px 10px', padding: 14, background: '#fff', borderRadius: 20 }}>
          <div style={{ display: 'flex', height: 12, borderRadius: 6, overflow: 'hidden', background: '#efe7f3' }}>
            {segs.map((s) => <span key={s} style={{ width: `${(countOf(e.id, s) / tot) * 100}%`, background: STATUS[s][1], transition: 'width .3s' }} />)}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 12 }}>
            {segs.map((s) => <span key={s} style={{ color: STATUS[s][1], fontWeight: 700 }}>{countOf(e.id, s)} {STATUS[s][0].toLowerCase()}</span>)}
          </div>
        </div>
        {chips([['all', 'Everyone'], ...segs.map((s) => [s, STATUS[s][0]])], gFilter, setGFilter)}
        <div style={{ display: 'grid', gap: 8, padding: '0 20px' }}>
          {rsvp[e.id] && (gFilter === 'all' || gFilter === rsvp[e.id]) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 18, background: `${accent}18`, border: `1.5px solid ${accent}55` }}>
              <Avatar p={{ name: 'You', hue: 330 }} />
              <span style={{ flex: 1, fontSize: 14.5, fontWeight: 700 }}>You{plus[e.id] && rsvp[e.id] === 'going' ? ` +${plus[e.id]}` : ''}</span>
              {pill(rsvp[e.id])}
            </div>
          )}
          {list.map((g) => (
            <div key={g.id} style={{ background: '#fff', borderRadius: 18, overflow: 'hidden' }}>
              <button type="button" onClick={() => setOpenGuest(openGuest === g.id ? null : g.id)} aria-expanded={openGuest === g.id} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '10px 14px', border: 'none', background: 'none', font: 'inherit', textAlign: 'left', cursor: 'pointer', color: INK }}>
                <Avatar p={g} />
                <span style={{ flex: 1, fontSize: 14.5, fontWeight: 600 }}>{g.name}</span>
                {pill(g.st)}
              </button>
              {openGuest === g.id && (
                <div style={{ display: 'flex', gap: 8, padding: '0 14px 12px' }}>
                  <button type="button" onClick={() => say(`Nudged ${g.name.split(' ')[0]}`)} style={{ flex: 1, height: 38, borderRadius: 19, border: 'none', background: accent, color: '#fff', font: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{g.st === 'invited' ? 'Send reminder' : 'Say hi'}</button>
                  <button type="button" onClick={() => (setGuests((all) => ({ ...all, [e.id]: all[e.id].filter((x) => x.id !== g.id) })), setOpenGuest(null), say(`Removed ${g.name.split(' ')[0]}`))} style={{ height: 38, padding: '0 16px', borderRadius: 19, border: 'none', background: '#fee2e2', color: BAD, font: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Remove</button>
                </div>
              )}
            </div>
          ))}
          {!list.length && !(rsvp[e.id] && gFilter === rsvp[e.id]) && <div style={{ textAlign: 'center', color: MUTED, fontSize: 13, padding: '24px 0' }}>Nobody with this status.</div>}
        </div>
      </>
    )
  } else if (tab === 'rsvp') {
    const e = EVENTS.find((x) => x.id === selId)
    const pending = EVENTS.filter((x) => !rsvp[x.id])
    body = (
      <>
        {header('RSVP')}
        {chips(EVENTS.map((x) => [x.id, x.title]), selId, setSelId)}
        <div style={{ margin: '0 20px', background: '#fff', borderRadius: 26, overflow: 'hidden', boxShadow: '0 8px 22px rgba(80,30,70,.1)' }}>
          <EventArt kind={e.kind} hue={e.hue} h={104} radius={0} />
          <div style={{ padding: 16 }}>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 20, fontWeight: 700 }}>{e.title}</div>
            <div style={{ fontSize: 12.5, color: MUTED, margin: '2px 0 14px' }}>{fmtDay(e.day)} · {e.time}</div>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Will you be there?</div>
            {rsvpButtons(e.id)}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, padding: '10px 12px', borderRadius: 16, background: BG, opacity: rsvp[e.id] === 'going' ? 1 : 0.5 }}>
              <span style={{ fontSize: 13.5, fontWeight: 600 }}>Bringing guests</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button type="button" disabled={rsvp[e.id] !== 'going' || !(plus[e.id] > 0)} onClick={() => setPlus((p) => ({ ...p, [e.id]: p[e.id] - 1 }))} aria-label="Fewer guests" style={{ ...iconBtn, width: 32, height: 32 }}><Icon name="minus" size={16} /></button>
                <b style={{ minWidth: 14, textAlign: 'center' }}>{plus[e.id] || 0}</b>
                <button type="button" disabled={rsvp[e.id] !== 'going' || (plus[e.id] || 0) >= 4} onClick={() => setPlus((p) => ({ ...p, [e.id]: (p[e.id] || 0) + 1 }))} aria-label="More guests" style={{ ...iconBtn, width: 32, height: 32 }}><Icon name="plus" size={16} /></button>
              </span>
            </div>
            <div style={{ textAlign: 'center', fontSize: 13, color: MUTED, marginTop: 12 }}>
              <b style={{ color: INK }}>{goingCount(e.id)}</b> going · <b style={{ color: INK }}>{countOf(e.id, 'maybe')}</b> maybe
            </div>
          </div>
        </div>
        <div style={{ padding: '16px 20px 8px', fontSize: 13, fontWeight: 800, color: MUTED, textTransform: 'uppercase', letterSpacing: '.06em' }}>Awaiting your reply</div>
        <div style={{ display: 'grid', gap: 8, padding: '0 20px' }}>
          {pending.map((x) => (
            <button key={x.id} type="button" onClick={() => setSelId(x.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', border: 'none', borderRadius: 18, background: '#fff', font: 'inherit', textAlign: 'left', cursor: 'pointer', color: INK }}>
              <span style={{ width: 48, height: 40, borderRadius: 12, overflow: 'hidden', flex: 'none' }}><EventArt kind={x.kind} hue={x.hue} h={40} radius={0} /></span>
              <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{x.title}<span style={{ display: 'block', fontSize: 12, color: MUTED, fontWeight: 400 }}>{fmtDay(x.day)}</span></span>
              <Icon name="chev" size={18} color={MUTED} />
            </button>
          ))}
          {!pending.length && <div style={{ textAlign: 'center', color: MUTED, fontSize: 13, padding: '14px 0' }}>All caught up — nothing waiting.</div>}
        </div>
      </>
    )
  } else {
    const first = new Date(month.y, month.m, 1)
    const lead = (first.getDay() + 6) % 7
    const days = new Date(month.y, month.m + 1, 0).getDate()
    const cells = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => new Date(month.y, month.m, i + 1))]
    const shift = (n) => setMonth(({ y, m }) => { const d = new Date(y, m + n, 1); return { y: d.getFullYear(), m: d.getMonth() } })
    const evOn = (k) => EVENTS.filter((e) => dkey(e.day) === k)
    const picked = evOn(selDay)
    body = (
      <>
        {header('Calendar')}
        <div style={{ margin: '4px 20px 0', background: '#fff', borderRadius: 26, padding: '14px 12px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px 10px' }}>
            <button type="button" onClick={() => shift(-1)} aria-label="Previous month" style={{ ...iconBtn, width: 34, height: 34, background: BG }}><Icon name="back" size={18} /></button>
            <b style={{ fontFamily: 'Georgia, serif', fontSize: 17 }}>{MONTHS[month.m]} {month.y}</b>
            <button type="button" onClick={() => shift(1)} aria-label="Next month" style={{ ...iconBtn, width: 34, height: 34, background: BG }}><Icon name="chev" size={18} /></button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', fontSize: 10.5, fontWeight: 700, color: MUTED, paddingBottom: 4 }}>{DOW.map((d) => <span key={d}>{d.slice(0, 2)}</span>)}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
            {cells.map((d, i) => {
              if (!d) return <span key={i} />
              const k = dkey(d)
              const evs = evOn(k)
              const sel = selDay === k
              const isToday = k === dkey(TODAY)
              return (
                <button key={k} type="button" onClick={() => setSelDay(k)} aria-label={`${d.getDate()} ${MONTHS[month.m]}${evs.length ? `, ${evs.length} event` : ''}`} aria-pressed={sel} style={{ height: 46, border: isToday && !sel ? `1.5px solid ${accent}` : '1.5px solid transparent', borderRadius: 14, background: sel ? accent : 'none', color: sel ? '#fff' : INK, font: 'inherit', fontSize: 14, fontWeight: evs.length ? 800 : 500, cursor: 'pointer', display: 'grid', placeItems: 'center', alignContent: 'center', gap: 3 }}>
                  {d.getDate()}
                  <span style={{ display: 'flex', gap: 2, height: 6 }}>{evs.map((e) => <i key={e.id} style={{ width: 6, height: 6, borderRadius: '50%', background: sel ? '#fff' : `hsl(${e.hue} 80% 50%)` }} />)}</span>
                </button>
              )
            })}
          </div>
        </div>
        <div style={{ padding: '16px 20px 8px', fontSize: 13, fontWeight: 800, color: MUTED, textTransform: 'uppercase', letterSpacing: '.06em' }}>{(() => { const [y, m, dd] = selDay.split('-').map(Number); return fmtDay(new Date(y, m, dd)) })()}</div>
        <div style={{ display: 'grid', gap: 8, padding: '0 20px' }}>
          {picked.map((e) => (
            <button key={e.id} type="button" onClick={() => openEvent(e.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', border: 'none', borderRadius: 18, background: '#fff', font: 'inherit', textAlign: 'left', cursor: 'pointer', color: INK }}>
              <span style={{ width: 6, height: 40, borderRadius: 3, background: `hsl(${e.hue} 80% 55%)` }} />
              <span style={{ flex: 1, fontSize: 14.5, fontWeight: 700 }}>{e.title}<span style={{ display: 'block', fontSize: 12, color: MUTED, fontWeight: 400 }}>{e.time} · {e.place.split(',')[0]}</span></span>
              {rsvp[e.id] ? pill(rsvp[e.id]) : <Icon name="chev" size={18} color={MUTED} />}
            </button>
          ))}
          {!picked.length && (
            <div style={{ textAlign: 'center', padding: '14px 0', color: MUTED, fontSize: 13 }}>
              Nothing planned.
              <button type="button" onClick={() => say('Ideas: plan something fun!')} style={{ display: 'block', margin: '8px auto 0', border: 'none', background: 'none', color: accent, font: 'inherit', fontWeight: 700, cursor: 'pointer' }}>+ Plan an event</button>
            </div>
          )}
        </div>
      </>
    )
  }

  const phone = (
    <div style={{ position: 'relative', width: W, height: H, overflow: 'hidden', borderRadius: frame ? 46 : 0, background: BG, color: INK, fontFamily: "'Avenir Next', 'Trebuchet MS', 'Segoe UI', system-ui, sans-serif" }}>
      <style>{`
        @keyframes ev-r { from { opacity: 0; transform: translateX(34px) } to { opacity: 1; transform: none } }
        @keyframes ev-l { from { opacity: 0; transform: translateX(-34px) } to { opacity: 1; transform: none } }
        @keyframes ev-c { 0% { transform: translate(0,0) rotate(0); opacity: 1 } 40% { opacity: 1 } 100% { transform: translate(var(--dx), calc(var(--dy) + 560px)) rotate(var(--r)); opacity: 0 } }
        .ev-scroll { scrollbar-width: none } .ev-scroll::-webkit-scrollbar { display: none }
        .ev-app button:focus-visible { outline: 2px solid ${accent}; outline-offset: 2px }
        .ev-app button:disabled { cursor: default }
        @media (prefers-reduced-motion: reduce) { .ev-page, .ev-confetti i { animation: none !important } }
      `}</style>
      <StatusBar frame={frame} />
      <div key={`${tab}/${stack.map((s) => s.id + (s.ev || '')).join('/')}`} className="ev-scroll ev-page" style={{ position: 'absolute', top: top?.id === 'detail' ? 0 : 54, bottom: tabbed ? 88 : 0, left: 0, right: 0, overflowY: 'auto', paddingBottom: 24, animation: `${dir > 0 ? 'ev-r' : 'ev-l'} .28s ease` }}>
        {body}
      </div>
      {tabbed && (
        <nav aria-label="Main" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 88, background: '#fff', borderRadius: '26px 26px 0 0', boxShadow: '0 -6px 20px rgba(80,30,70,.08)', display: 'flex', justifyContent: 'space-around', padding: '10px 8px 0' }}>
          {NAV.map(([id, icon, label]) => (
            <button key={id} type="button" onClick={() => go(id)} aria-current={tab === id ? 'page' : undefined} style={{ border: 'none', background: 'none', font: 'inherit', cursor: 'pointer', display: 'grid', justifyItems: 'center', alignContent: 'start', gap: 3, width: 72, height: 54, fontSize: 11, fontWeight: 700, color: tab === id ? accent : MUTED }}>
              <Icon name={icon} size={23} />
              {label}
            </button>
          ))}
        </nav>
      )}
      {pieces && (
        <div className="ev-confetti" aria-hidden="true" style={{ position: 'absolute', left: '50%', top: '58%', zIndex: 40, pointerEvents: 'none' }}>
          {pieces.map((p) => (
            <i key={p.id} style={{ position: 'absolute', width: p.w, height: p.w * 0.5, background: p.c, borderRadius: 1, '--dx': `${p.dx}px`, '--dy': `${p.dy}px`, '--r': `${p.r}deg`, animation: `ev-c ${p.d}s cubic-bezier(.2,.7,.4,1) forwards` }} />
          ))}
        </div>
      )}
      <div role="status" style={{ position: 'absolute', left: '50%', top: 58, zIndex: 30, transform: `translate(-50%, ${toast ? 0 : -90}px)`, transition: 'transform .35s cubic-bezier(.2,.8,.2,1)', padding: '10px 16px', borderRadius: 20, background: INK, color: '#fff', fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap' }}>{toast}</div>
      <div style={{ position: 'absolute', left: '50%', bottom: 8, width: 140, height: 5, marginLeft: -70, borderRadius: 3, background: INK, opacity: 0.8, zIndex: 25 }} />
    </div>
  )

  return (
    <div ref={box} className="ev-app" style={{ position: 'relative', width: '100%', height: '100%', display: 'grid', placeItems: 'center', overflow: 'hidden', background: 'radial-gradient(ellipse at 50% 30%, #ffe3ec, #e9b7cf 75%)', ...style }}>
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: `translate(-50%, -50%) scale(${scale})`, transformOrigin: 'center' }}>
        {frame ? (
          <div style={{ padding: 12, borderRadius: 58, background: 'linear-gradient(145deg, #3a3340, #17121c 40%, #2f2836)', boxShadow: '0 40px 80px rgba(60,20,50,.35), inset 0 0 0 2px #54495d' }}>
            <div style={{ padding: 2, borderRadius: 48, background: '#000' }}>{phone}</div>
          </div>
        ) : (
          phone
        )}
      </div>
    </div>
  )
}
