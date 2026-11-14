import { useEffect, useRef, useState } from 'react'

// A boarding pass wallet on a phone, as a click-through prototype. Four tabs
// (Passes, Gate, Add, Settings) plus a pass detail screen that slides in from
// the right. Passes lists upcoming and past flights as tickets; tapping one
// opens its detail, where the card flips to a scannable barcode, you can check
// in, share or delete it. Gate shows a live countdown to boarding, a terminal
// map with a walking route, and a refresh that can really change the gate.
// Add is a working form: fill it in and a new pass with its own barcode is
// created, sorted into the wallet and opened. Settings (24-hour clock,
// reminders, name) carry through every screen. The phone scales to fit its box.

const W = 390 // the phone screen, in CSS px (an iPhone's width)
const H = 844
const BG = '#0a1224'
const PANEL = '#131d36'
const PAPER = '#f6f1e7'
const INK = '#101a33'
const MUTED = '#8a96b2'
const LINE = 'rgba(255,255,255,.09)'
const MIN = 60000

const AIRPORTS = {
  LHR: 'London', JFK: 'New York', SFO: 'San Francisco', CDG: 'Paris', HND: 'Tokyo', SIN: 'Singapore', DXB: 'Dubai', SYD: 'Sydney', LIS: 'Lisbon',
}
const AIRLINES = {
  SK: { name: 'Skyline Airways', hue: 212 },
  AU: { name: 'Aurora Air', hue: 160 },
  MD: { name: 'Meridian', hue: 28 },
  NB: { name: 'Nimbus Jet', hue: 280 },
}

const NAV = [
  ['passes', 'wallet', 'Passes'],
  ['gate', 'gate', 'Gate'],
  ['add', 'plus', 'Add'],
  ['settings', 'gear', 'Settings'],
]

const ICONS = {
  wallet: 'M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2H4zM4 9h16v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM15 14h2',
  gate: 'M4 20V9l8-5 8 5v11M9 20v-6h6v6',
  plus: 'M12 5v14M5 12h14',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14.2 3h-4l-.4 2.7a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.5a7 7 0 0 0 0 2.4l-2 1.5 2 3.4 2.4-1a7 7 0 0 0 2 1.2l.4 2.7h4l.4-2.7a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z',
  back: 'M15 5l-7 7 7 7',
  chev: 'M9 5l7 7-7 7',
  plane: 'M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z',
  flip: 'M4 12a8 8 0 0 1 14-5l2-2v6h-6l2.2-2.2A5.5 5.5 0 0 0 6.5 12M20 12a8 8 0 0 1-14 5l-2 2v-6h6l-2.2 2.2A5.5 5.5 0 0 0 17.5 12',
  share: 'M12 15V4m0 0L8 8m4-4l4 4M5 13v6h14v-6',
  trash: 'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13',
  check: 'M5 12l5 5 9-10',
  bell: 'M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4',
  refresh: 'M20 11a8 8 0 0 0-14-4L4 9M4 4v5h5M4 13a8 8 0 0 0 14 4l2-2M20 20v-5h-5',
  route: 'M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM8 17h6a3 3 0 0 0 0-6h-4a3 3 0 0 1 0-6h6',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 20a8 8 0 0 1 16 0',
  x: 'M6 6l12 12M18 6L6 18',
}

function Icon({ name, size = 22, color = 'currentColor', w = 1.9 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  )
}

const iconBtn = { display: 'grid', placeItems: 'center', border: 'none', borderRadius: '50%', cursor: 'pointer', padding: 0, background: PANEL, color: '#fff' }

// small seeded random so every pass gets its own stable barcode
function seeded(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619)
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    return ((h ^= h >>> 16) >>> 0) / 4294967296
  }
}

// a stacked 2D barcode drawn from the pass details (looks like a PDF417)
function Barcode({ seed, width = 300, height = 110 }) {
  const rnd = seeded(seed)
  const rows = 9
  const rh = height / rows
  const rects = []
  for (let r = 0; r < rows; r++) {
    let x = 14
    rects.push(<rect key={`s${r}`} x={0} y={r * rh} width={9} height={rh} fill="#000" />)
    let on = true
    while (x < width - 24) {
      const w = 2 + Math.floor(rnd() * 4) * 1.5
      if (on) rects.push(<rect key={`${r}-${x}`} x={x} y={r * rh} width={Math.min(w, width - 24 - x)} height={rh} fill="#000" />)
      x += w
      on = !on
    }
    rects.push(<rect key={`e${r}`} x={width - 12} y={r * rh} width={12} height={rh} fill="#000" />)
  }
  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Boarding pass barcode" preserveAspectRatio="none" style={{ display: 'block', height }}>
      {rects}
    </svg>
  )
}

const hhmm = (ms, h24) => new Date(ms).toLocaleTimeString(h24 ? 'en-GB' : 'en-US', { hour: h24 ? '2-digit' : 'numeric', minute: '2-digit', hour12: !h24 })
const dayStr = (ms) => new Date(ms).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
const durStr = (m) => `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`
function countdown(ms) {
  const s = Math.max(0, Math.floor(ms / 1000))
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  const pad = (n) => String(n).padStart(2, '0')
  return d > 0 ? { big: `${d}d ${pad(h)}h`, small: `${pad(m)}m ${pad(s % 60)}s` } : { big: `${pad(h)}:${pad(m)}`, small: `${pad(s % 60)}s` }
}

function seedPasses(name) {
  const base = Math.ceil(Date.now() / MIN) * MIN
  const mk = (id, flight, from, to, dep, dur, gate, term, seat, cls) => ({ id, flight, from, to, depAt: base + dep * MIN, dur, gate, term, seat, cls, seq: 20 + (id.length * 7) % 90, name, checked: false, status: 'On time' })
  return [
    mk('p1', 'SK 482', 'LHR', 'JFK', 105, 470, 'B22', '5', '14A', 'Economy'),
    mk('p2', 'AU 118', 'JFK', 'SFO', 60 * 26, 385, 'C7', '4', '3C', 'Business'),
    mk('p3', 'MD 907', 'SFO', 'HND', 60 * 24 * 9, 650, 'G12', 'I', '22K', 'Premium'),
    mk('p0', 'NB 031', 'CDG', 'LHR', -60 * 24 * 5, 80, 'D4', '2E', '9F', 'Economy'),
  ]
}

function StatusBar({ frame }) {
  const clock = new Date().toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' })
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20, height: 54, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 30px 0 36px', fontSize: 16, fontWeight: 600, color: '#fff', pointerEvents: 'none' }}>
      <span>{clock}</span>
      {frame && <span style={{ position: 'absolute', left: '50%', top: 11, width: 122, height: 35, marginLeft: -61, borderRadius: 20, background: '#000' }} />}
      <span style={{ display: 'flex', gap: 6, alignItems: 'center' }} aria-hidden="true">
        <svg width="18" height="11" viewBox="0 0 18 11" fill="#fff">
          <rect x="0" y="7" width="3" height="4" rx="1" />
          <rect x="5" y="5" width="3" height="6" rx="1" />
          <rect x="10" y="2.5" width="3" height="8.5" rx="1" />
          <rect x="15" y="0" width="3" height="11" rx="1" />
        </svg>
        <svg width="26" height="12" viewBox="0 0 26 12">
          <rect x="0.5" y="0.5" width="22" height="11" rx="3.5" fill="none" stroke="#fff" opacity=".45" />
          <rect x="2.5" y="2.5" width="16" height="7" rx="2" fill="#fff" />
          <rect x="23.5" y="4" width="2" height="4" rx="1" fill="#fff" opacity=".45" />
        </svg>
      </span>
    </div>
  )
}

// the ticket face shared by the wallet list and the pass detail
function Ticket({ p, now, h24, accent, onClick }) {
  const al = AIRLINES[p.flight.slice(0, 2)] || AIRLINES.SK
  const board = p.depAt - 40 * MIN
  const left = board - now
  const stub = p.depAt < now ? 'Departed' : left <= 0 ? 'Boarding now' : `Boards in ${countdown(left).big}`
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag type={onClick ? 'button' : undefined} onClick={onClick} style={{ position: 'relative', display: 'block', width: '100%', padding: 0, border: 'none', textAlign: 'left', font: 'inherit', color: INK, background: PAPER, borderRadius: 24, overflow: 'hidden', cursor: onClick ? 'pointer' : 'default', boxShadow: '0 14px 30px rgba(0,0,0,.35)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px', background: `hsl(${al.hue} 60% 32%)`, color: '#fff', fontSize: 12.5, fontWeight: 700, letterSpacing: '.04em' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}><Icon name="plane" size={15} /> {al.name.toUpperCase()}</span>
        <span>{p.flight}</span>
      </div>
      <div style={{ padding: '16px 18px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 38, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1 }}>{p.from}</div>
            <div style={{ fontSize: 12, color: '#5b6580', marginTop: 3 }}>{AIRPORTS[p.from]}</div>
          </div>
          <svg width="92" height="30" viewBox="0 0 92 30" aria-hidden="true">
            <path d="M4 22 Q46 -6 88 22" fill="none" stroke="#9aa3ba" strokeWidth="1.6" strokeDasharray="3 4" />
            <g transform="translate(34 4) rotate(90 12 12) scale(1)"><path d={ICONS.plane} fill={`hsl(${al.hue} 60% 32%)`} transform="scale(.9)" /></g>
          </svg>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 38, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1 }}>{p.to}</div>
            <div style={{ fontSize: 12, color: '#5b6580', marginTop: 3 }}>{AIRPORTS[p.to]}</div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr .8fr .8fr', gap: 8, marginTop: 16 }}>
          {[['Date', dayStr(p.depAt)], ['Departs', hhmm(p.depAt, h24)], ['Gate', p.gate], ['Seat', p.seat]].map(([k, v]) => (
            <div key={k}>
              <div style={{ fontSize: 10.5, color: '#7a839b', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' }}>{k}</div>
              <div style={{ fontSize: 14.5, fontWeight: 700, marginTop: 2, whiteSpace: 'nowrap' }}>{v}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ position: 'relative', borderTop: '2px dashed #cfc7b4', margin: '0 14px' }}>
        <i style={{ position: 'absolute', left: -25, top: -12, width: 22, height: 22, borderRadius: '50%', background: BG }} />
        <i style={{ position: 'absolute', right: -25, top: -12, width: 22, height: 22, borderRadius: '50%', background: BG }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 18px 13px', fontSize: 13, fontWeight: 700 }}>
        <span style={{ color: p.status === 'Delayed' ? '#b45309' : '#0f7a4a' }}>{p.checked ? 'Checked in' : p.status}</span>
        <span style={{ color: accent === '#38bdf8' ? '#0b6fa0' : INK }}>{stub}</span>
      </div>
    </Tag>
  )
}

// ---------------------------------------------------------------- app

export default function BoardingPassApp({ name = 'Alex Rivera', accent = '#38bdf8', startScreen = 'passes', frame = true, style }) {
  const box = useRef()
  const toastTimer = useRef()
  const [scale, setScale] = useState(1)
  const [tab, setTab] = useState('passes')
  const [stack, setStack] = useState([])
  const [dir, setDir] = useState(1)
  const [passes, setPasses] = useState(() => seedPasses(name))
  const [who, setWho] = useState(name)
  const [now, setNow] = useState(() => Date.now())
  const [toast, setToast] = useState('')
  const [seg, setSeg] = useState('up')
  const [flipped, setFlipped] = useState(false)
  const [gateId, setGateId] = useState(null)
  const [route, setRoute] = useState(false)
  const [remind, setRemind] = useState({ p1: true })
  const [h24, setH24] = useState(true)
  const [alerts, setAlerts] = useState(true)
  const [bright, setBright] = useState(true)
  const [form, setForm] = useState(() => ({ air: 'SK', num: '', from: 'LHR', to: 'SFO', date: new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 10), time: '10:30', seat: '', cls: 'Economy' }))
  const [err, setErr] = useState('')

  useEffect(() => {
    const g = (s) => {
      setDir(1)
      if (s === 'detail') {
        setTab('passes')
        setFlipped(false)
        setStack([{ id: 'detail', pid: 'p1' }])
      } else {
        setTab(s)
        setStack([])
      }
    }
    g(startScreen)
  }, [startScreen])

  useEffect(() => setWho(name), [name])

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
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
  const open = (pid) => (setFlipped(false), push({ id: 'detail', pid }))
  const patch = (id, o) => setPasses((a) => a.map((p) => (p.id === id ? { ...p, ...o } : p)))

  const sorted = [...passes].sort((a, b) => a.depAt - b.depAt)
  const upcoming = sorted.filter((p) => p.depAt + 30 * MIN >= now)
  const past = sorted.filter((p) => p.depAt + 30 * MIN < now).reverse()

  const submit = () => {
    const num = form.num.trim()
    const dep = new Date(`${form.date}T${form.time}`).getTime()
    if (!/^\d{1,4}$/.test(num)) return setErr('Enter a flight number, 1 to 4 digits')
    if (form.from === form.to) return setErr('Departure and arrival must differ')
    if (!dep || Number.isNaN(dep)) return setErr('Pick a valid date and time')
    setErr('')
    const rnd = seeded(`${form.air}${num}${form.date}`)
    const p = {
      id: `n${Date.now()}`,
      flight: `${form.air} ${num}`,
      from: form.from,
      to: form.to,
      depAt: dep,
      dur: 90 + Math.floor(rnd() * 600),
      gate: `${'ABCDG'[Math.floor(rnd() * 5)]}${1 + Math.floor(rnd() * 30)}`,
      term: String(1 + Math.floor(rnd() * 5)),
      seat: (form.seat || `${10 + Math.floor(rnd() * 25)}${'ABCDEF'[Math.floor(rnd() * 6)]}`).toUpperCase(),
      cls: form.cls,
      seq: 10 + Math.floor(rnd() * 80),
      name: who,
      checked: false,
      status: 'On time',
    }
    setPasses((a) => [...a, p])
    setForm((f) => ({ ...f, num: '', seat: '' }))
    setSeg('up')
    setFlipped(false)
    setDir(1)
    setTab('passes')
    setStack([{ id: 'detail', pid: p.id }])
    say('Pass added to your wallet')
  }

  const refreshGate = (p) => {
    const rnd = Math.random()
    if (rnd < 0.5) {
      const g = `${p.gate[0]}${1 + Math.floor(Math.random() * 30)}`
      patch(p.id, { gate: g, status: 'Gate changed' })
      say(`Gate changed to ${g}`)
    } else if (rnd < 0.75) {
      patch(p.id, { status: 'Delayed', depAt: p.depAt + 15 * MIN })
      say('Delayed 15 min')
    } else {
      patch(p.id, { status: 'On time' })
      say('Still on time')
    }
  }

  // ---- shared bits
  const header = (title, back, right) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px 8px', minHeight: 50 }}>
      {back && (
        <button type="button" onClick={back} aria-label="Back" style={{ ...iconBtn, width: 38, height: 38 }}>
          <Icon name="back" size={20} />
        </button>
      )}
      <h1 style={{ margin: 0, flex: 1, fontSize: back ? 18 : 28, fontWeight: 800, letterSpacing: '-0.02em', marginLeft: 4 }}>{title}</h1>
      {right}
    </div>
  )

  const pill = (label, on, fn) => (
    <button key={label} type="button" onClick={fn} aria-pressed={on} style={{ flex: 1, height: 36, borderRadius: 18, border: 'none', background: on ? accent : 'transparent', color: on ? '#04121f' : MUTED, font: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{label}</button>
  )

  const btn = (label, fn, o = {}) => (
    <button type="button" onClick={fn} disabled={o.disabled} style={{ flex: o.flex, width: o.flex ? undefined : '100%', height: 50, borderRadius: 25, border: o.ghost ? `1px solid ${LINE}` : 'none', background: o.ghost ? PANEL : o.danger ? '#3a1520' : accent, color: o.ghost ? '#fff' : o.danger ? '#ff8a9b' : '#04121f', font: 'inherit', fontSize: 14.5, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: o.disabled ? 0.5 : 1 }}>
      {o.icon && <Icon name={o.icon} size={18} />}
      {label}
    </button>
  )

  const toggle = (on, set, label) => (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => set(!on)} style={{ width: 48, height: 28, borderRadius: 14, border: 'none', padding: 3, background: on ? accent : '#2a3555', cursor: 'pointer', transition: 'background .2s', flex: 'none' }}>
      <span style={{ display: 'block', width: 22, height: 22, borderRadius: '50%', background: '#fff', transform: `translateX(${on ? 20 : 0}px)`, transition: 'transform .2s' }} />
    </button>
  )

  const setRow = (icon, label, sub, right) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 0', borderBottom: `1px solid ${LINE}` }}>
      <span style={{ width: 38, height: 38, borderRadius: 12, display: 'grid', placeItems: 'center', background: '#1b2848', color: accent, flex: 'none' }}><Icon name={icon} size={19} /></span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700 }}>{label}</span>
        {sub && <span style={{ display: 'block', fontSize: 12, color: MUTED, marginTop: 1 }}>{sub}</span>}
      </span>
      {right}
    </div>
  )

  const field = { width: '100%', height: 46, borderRadius: 14, border: `1px solid ${LINE}`, background: PANEL, color: '#fff', font: 'inherit', fontSize: 15, padding: '0 12px', boxSizing: 'border-box', colorScheme: 'dark' }
  const lab = { display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: MUTED, margin: '0 0 6px 2px' }

  // ---- screens
  let body
  let tabbed = true
  if (top?.id === 'detail') {
    tabbed = false
    const p = passes.find((x) => x.id === top.pid)
    if (!p) {
      body = <>{header('Pass', pop)}<div style={{ textAlign: 'center', color: MUTED, padding: 60 }}>This pass was removed.</div></>
    } else {
      const left = p.depAt - 40 * MIN - now
      body = (
        <>
          {header('Boarding pass', pop, <button type="button" onClick={() => { setFlipped((f) => !f) }} aria-label="Flip pass" style={{ ...iconBtn, width: 38, height: 38 }}><Icon name="flip" size={19} /></button>)}
          <div style={{ padding: '6px 20px 0', perspective: 1200 }}>
            <button type="button" onClick={() => setFlipped((f) => !f)} aria-label={flipped ? 'Show front of pass' : 'Show barcode'} className="bp-flip" style={{ position: 'relative', display: 'block', width: '100%', minHeight: 300, padding: 0, border: 'none', background: 'none', cursor: 'pointer', transformStyle: 'preserve-3d', transition: 'transform .6s cubic-bezier(.3,.7,.2,1)', transform: flipped ? 'rotateY(180deg)' : 'none' }}>
              <div style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}>
                <Ticket p={p} now={now} h24={h24} accent={accent} />
              </div>
              <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)', borderRadius: 24, background: '#fff', color: '#000', padding: '18px 16px', boxSizing: 'border-box', boxShadow: bright ? `0 0 50px ${accent}88` : '0 14px 30px rgba(0,0,0,.35)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', textAlign: 'left' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, color: '#444' }}>
                  <span>{p.name.toUpperCase()}</span>
                  <span>{p.flight} · SEQ {String(p.seq).padStart(3, '0')}</span>
                </div>
                <Barcode seed={`${p.flight}${p.from}${p.to}${p.depAt}${p.seat}${p.name}`} />
                <div style={{ textAlign: 'center', fontSize: 11.5, color: '#555', fontWeight: 600 }}>
                  {bright ? 'Brightness boosted for scanning · ' : ''}Hold near the reader
                </div>
              </div>
            </button>
          </div>
          <div style={{ textAlign: 'center', fontSize: 12, color: MUTED, margin: '12px 0 4px' }}>Tap the pass to flip it</div>
          <div style={{ margin: '8px 20px 0', padding: '4px 16px', background: PANEL, borderRadius: 20 }}>
            {[['Passenger', p.name], ['Class', p.cls], ['Terminal', p.term], ['Boarding', left <= 0 ? 'Now' : hhmm(p.depAt - 40 * MIN, h24)], ['Duration', durStr(p.dur)]].map(([k, v], i, a) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 0', borderBottom: i < a.length - 1 ? `1px solid ${LINE}` : 'none', fontSize: 14 }}>
                <span style={{ color: MUTED }}>{k}</span>
                <span style={{ fontWeight: 700 }}>{v}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gap: 10, padding: '16px 20px' }}>
            <div style={{ display: 'flex', gap: 10 }}>
              {btn(p.checked ? 'Checked in' : 'Check in', () => (patch(p.id, { checked: !p.checked }), say(p.checked ? 'Check-in undone' : 'You are checked in')), { flex: 1, icon: 'check' })}
              {btn('Gate info', () => (setGateId(p.id), setDir(1), setTab('gate'), setStack([])), { flex: 1, ghost: true, icon: 'gate' })}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              {btn('Share', () => say('Pass link copied'), { flex: 1, ghost: true, icon: 'share' })}
              {btn('Delete', () => (setPasses((a) => a.filter((x) => x.id !== p.id)), pop(), say('Pass deleted')), { flex: 1, danger: true, icon: 'trash' })}
            </div>
          </div>
        </>
      )
    }
  } else if (tab === 'passes') {
    const list = seg === 'up' ? upcoming : past
    body = (
      <>
        {header('Wallet', null, <span style={{ fontSize: 12.5, color: MUTED, fontWeight: 600 }}>{upcoming.length} upcoming</span>)}
        <div role="group" aria-label="Pass filter" style={{ display: 'flex', margin: '4px 20px 14px', padding: 3, background: PANEL, borderRadius: 21 }}>
          {pill('Upcoming', seg === 'up', () => setSeg('up'))}
          {pill('Past', seg === 'past', () => setSeg('past'))}
        </div>
        <div style={{ display: 'grid', gap: 16, padding: '0 20px' }}>
          {list.map((p) => <Ticket key={p.id} p={p} now={now} h24={h24} accent={accent} onClick={() => open(p.id)} />)}
          {!list.length && (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: MUTED, fontSize: 14 }}>
              <div style={{ marginBottom: 16 }}>{seg === 'up' ? 'No upcoming flights.' : 'No past flights.'}</div>
              {seg === 'up' && btn('Add a flight', () => go('add'), { icon: 'plus' })}
            </div>
          )}
        </div>
      </>
    )
  } else if (tab === 'gate') {
    const p = upcoming.find((x) => x.id === gateId) || upcoming[0]
    if (!p) {
      body = (
        <>
          {header('Gate info')}
          <div style={{ textAlign: 'center', padding: '70px 30px', color: MUTED, fontSize: 14 }}>
            <div style={{ marginBottom: 16 }}>No upcoming flight to track.</div>
            {btn('Add a flight', () => go('add'), { icon: 'plus' })}
          </div>
        </>
      )
    } else {
      const board = p.depAt - 40 * MIN
      const left = board - now
      const c = countdown(left)
      const prog = Math.min(1, Math.max(0, 1 - left / (180 * MIN)))
      const gx = 40 + (parseInt(p.gate.slice(1), 10) % 15) * 20
      const gy = p.gate.charCodeAt(0) % 2 ? 36 : 124
      body = (
        <>
          {header('Gate info')}
          <div className="bp-scroll" style={{ display: 'flex', gap: 8, padding: '0 20px 12px', overflowX: 'auto' }}>
            {upcoming.map((x) => (
              <button key={x.id} type="button" onClick={() => setGateId(x.id)} aria-pressed={x.id === p.id} style={{ flex: 'none', height: 34, padding: '0 14px', borderRadius: 17, border: 'none', background: x.id === p.id ? accent : PANEL, color: x.id === p.id ? '#04121f' : '#fff', font: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{x.from} → {x.to}</button>
            ))}
          </div>
          <div style={{ margin: '0 20px', padding: '18px 16px', borderRadius: 24, background: PANEL, textAlign: 'center' }}>
            <div style={{ position: 'relative', width: 190, height: 190, margin: '0 auto' }}>
              <svg width="190" height="190" viewBox="0 0 190 190" aria-hidden="true">
                <circle cx="95" cy="95" r="84" fill="none" stroke="#223055" strokeWidth="10" />
                <circle cx="95" cy="95" r="84" fill="none" stroke={left <= 0 ? '#34d399' : accent} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${prog * 528} 528`} transform="rotate(-90 95 95)" />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'grid', placeContent: 'center' }}>
                <div style={{ fontSize: 11.5, color: MUTED, fontWeight: 700, letterSpacing: '.08em' }}>{left <= 0 ? 'BOARDING' : 'BOARDS IN'}</div>
                <div style={{ fontSize: left <= 0 ? 30 : 38, fontWeight: 800, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{left <= 0 ? 'Go now' : c.big}</div>
                {left > 0 && <div style={{ fontSize: 14, color: MUTED, fontVariantNumeric: 'tabular-nums' }}>{c.small}</div>}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 14 }}>
              {[['Gate', p.gate], ['Terminal', p.term], ['Departs', hhmm(p.depAt, h24)]].map(([k, v]) => (
                <div key={k} style={{ background: '#1b2848', borderRadius: 14, padding: '10px 4px' }}>
                  <div style={{ fontSize: 10.5, color: MUTED, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' }}>{k}</div>
                  <div style={{ fontSize: 20, fontWeight: 800, marginTop: 2 }}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 13, marginTop: 12, color: p.status === 'On time' ? '#34d399' : '#fbbf24', fontWeight: 700 }}>{p.status} · {p.flight} to {AIRPORTS[p.to]}</div>
          </div>
          <div style={{ margin: '14px 20px 0', borderRadius: 20, background: PANEL, padding: 12 }}>
            <svg viewBox="0 0 330 160" width="100%" role="img" aria-label={`Terminal map, gate ${p.gate}`}>
              <rect x="6" y="64" width="318" height="32" rx="8" fill="#1b2848" />
              {Array.from({ length: 15 }).map((_, i) => (
                <g key={i}>
                  <rect x={30 + i * 20} y="26" width="16" height="30" rx="4" fill="#223055" />
                  <rect x={30 + i * 20} y="104" width="16" height="30" rx="4" fill="#223055" />
                </g>
              ))}
              <rect x={gx - 10} y={gy - 10} width="16" height="30" rx="4" fill={accent} transform={`translate(0 ${gy === 36 ? -1 : 0})`} />
              <text x={gx - 2} y={gy === 36 ? 18 : 152} textAnchor="middle" fontSize="11" fontWeight="800" fill={accent}>{p.gate}</text>
              {route && <path d={`M22 80 L${gx - 2} 80 L${gx - 2} ${gy === 36 ? 56 : 104}`} fill="none" stroke={accent} strokeWidth="3" strokeDasharray="6 5" strokeLinecap="round" />}
              <circle cx="22" cy="80" r="7" fill="#fff" />
              <circle cx="22" cy="80" r="12" fill="none" stroke="#fff" opacity=".35" />
              <text x="22" y="108" textAnchor="middle" fontSize="9" fill={MUTED}>You</text>
            </svg>
            <div style={{ fontSize: 12.5, color: MUTED, textAlign: 'center' }}>{route ? `${6 + (parseInt(p.gate.slice(1), 10) % 15)} min walk from security` : 'Tap directions to show the walking route'}</div>
          </div>
          <div style={{ display: 'grid', gap: 10, padding: '14px 20px' }}>
            <div style={{ display: 'flex', gap: 10 }}>
              {btn(route ? 'Hide route' : 'Directions', () => setRoute((r) => !r), { flex: 1, icon: 'route' })}
              {btn('Refresh', () => refreshGate(p), { flex: 1, ghost: true, icon: 'refresh' })}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 4px 0' }}>
              <span style={{ fontSize: 14, fontWeight: 700, display: 'flex', gap: 10, alignItems: 'center' }}><Icon name="bell" size={19} color={accent} /> Boarding reminder</span>
              {toggle(!!remind[p.id], (v) => (setRemind((r) => ({ ...r, [p.id]: v })), say(v ? 'Reminder set' : 'Reminder off')), 'Boarding reminder')}
            </div>
            {btn('Open pass', () => open(p.id), { ghost: true })}
          </div>
        </>
      )
    }
  } else if (tab === 'add') {
    const upd = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
    body = (
      <>
        {header('Add flight')}
        <div style={{ display: 'grid', gap: 14, padding: '4px 20px 0' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 10 }}>
            <label><span style={lab}>Airline</span>
              <select value={form.air} onChange={upd('air')} style={field}>{Object.entries(AIRLINES).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}</select>
            </label>
            <label><span style={lab}>Flight no.</span>
              <input value={form.num} onChange={upd('num')} inputMode="numeric" placeholder="482" maxLength={4} style={field} />
            </label>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <label><span style={lab}>From</span>
              <select value={form.from} onChange={upd('from')} style={field}>{Object.entries(AIRPORTS).map(([k, v]) => <option key={k} value={k}>{k} · {v}</option>)}</select>
            </label>
            <label><span style={lab}>To</span>
              <select value={form.to} onChange={upd('to')} style={field}>{Object.entries(AIRPORTS).map(([k, v]) => <option key={k} value={k}>{k} · {v}</option>)}</select>
            </label>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 10 }}>
            <label><span style={lab}>Date</span><input type="date" value={form.date} onChange={upd('date')} style={field} /></label>
            <label><span style={lab}>Time</span><input type="time" value={form.time} onChange={upd('time')} style={field} /></label>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: 10 }}>
            <label><span style={lab}>Seat</span><input value={form.seat} onChange={upd('seat')} placeholder="Auto" maxLength={3} style={field} /></label>
            <label><span style={lab}>Class</span>
              <select value={form.cls} onChange={upd('cls')} style={field}>{['Economy', 'Premium', 'Business', 'First'].map((c) => <option key={c}>{c}</option>)}</select>
            </label>
          </div>
          <div role="alert" style={{ minHeight: 18, fontSize: 13, color: '#ff8a9b', fontWeight: 600 }}>{err}</div>
          {btn('Create boarding pass', submit, { icon: 'plus' })}
        </div>
      </>
    )
  } else {
    body = (
      <>
        {header('Settings')}
        <div style={{ textAlign: 'center', padding: '6px 20px 14px' }}>
          <span style={{ width: 70, height: 70, borderRadius: '50%', display: 'inline-grid', placeItems: 'center', background: accent, color: '#04121f', fontSize: 26, fontWeight: 800 }}>{who.split(' ').map((s) => s[0]).join('').slice(0, 2).toUpperCase() || '?'}</span>
        </div>
        <div style={{ padding: '0 20px 12px' }}>
          <label><span style={lab}>Name on passes</span><input value={who} onChange={(e) => setWho(e.target.value)} style={field} /></label>
        </div>
        <div style={{ margin: '0 20px', padding: '0 16px', background: PANEL, borderRadius: 20 }}>
          {setRow('clock', '24-hour clock', h24 ? 'Showing 14:05' : 'Showing 2:05 PM', toggle(h24, setH24, '24-hour clock'))}
          {setRow('bell', 'Flight alerts', 'Gate changes and delays', toggle(alerts, (v) => (setAlerts(v), say(v ? 'Alerts on' : 'Alerts off')), 'Flight alerts'))}
          {setRow('sun', 'Boost brightness', 'When showing the barcode', toggle(bright, setBright, 'Boost brightness'))}
          <button type="button" onClick={() => { const n = past.length; setPasses((a) => a.filter((p) => p.depAt + 30 * MIN >= now)); say(n ? `Removed ${n} past pass${n > 1 ? 'es' : ''}` : 'No past passes to clear') }} style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'none', color: 'inherit', font: 'inherit', padding: 0, cursor: 'pointer' }}>
            {setRow('trash', 'Clear past passes', `${past.length} in your wallet`, <Icon name="chev" size={18} color={MUTED} />)}
          </button>
        </div>
        <div style={{ padding: '16px 20px', display: 'grid', gap: 10 }}>
          {btn('Reset demo', () => (setPasses(seedPasses(who)), setRemind({ p1: true }), setGateId(null), setRoute(false), go('passes'), say('Demo reset')), { ghost: true })}
        </div>
      </>
    )
  }

  function shell(content, isTabbed) {
    return (
      <Stage box={box} scale={scale} frame={frame} style={style}>
        <style>{`
          @keyframes bp-r { from { opacity: 0; transform: translateX(34px) } to { opacity: 1; transform: none } }
          @keyframes bp-l { from { opacity: 0; transform: translateX(-34px) } to { opacity: 1; transform: none } }
          .bp-scroll { scrollbar-width: none } .bp-scroll::-webkit-scrollbar { display: none }
          .bp-app button:focus-visible, .bp-app input:focus-visible, .bp-app select:focus-visible { outline: 2px solid ${accent}; outline-offset: 2px }
          @media (prefers-reduced-motion: reduce) { .bp-screen { animation: none !important } .bp-flip { transition: none !important } }
        `}</style>
        <StatusBar frame={frame} />
        <div key={`${tab}/${stack.map((s) => s.id + (s.pid || '')).join('/')}`} className="bp-scroll bp-screen" style={{ position: 'absolute', top: 54, bottom: isTabbed ? 84 : 0, left: 0, right: 0, overflowY: 'auto', paddingBottom: 24, animation: `${dir > 0 ? 'bp-r' : 'bp-l'} .28s ease` }}>
          {content}
        </div>
        {isTabbed && (
          <nav aria-label="Main" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 84, background: '#0f1830', borderTop: `1px solid ${LINE}`, display: 'flex', justifyContent: 'space-around', padding: '10px 8px 0' }}>
            {NAV.map(([id, icon, label]) => (
              <button key={id} type="button" onClick={() => go(id)} aria-current={tab === id ? 'page' : undefined} style={{ border: 'none', background: 'none', font: 'inherit', cursor: 'pointer', display: 'grid', justifyItems: 'center', alignContent: 'start', gap: 3, width: 70, height: 54, fontSize: 11, fontWeight: 700, color: tab === id ? accent : MUTED }}>
                <Icon name={icon} size={23} />
                {label}
              </button>
            ))}
          </nav>
        )}
        <div role="status" style={{ position: 'absolute', left: '50%', top: 58, zIndex: 30, transform: `translate(-50%, ${toast ? 0 : -90}px)`, transition: 'transform .35s cubic-bezier(.2,.8,.2,1)', padding: '10px 16px', borderRadius: 20, background: '#fff', color: INK, fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap' }}>{toast}</div>
        <div style={{ position: 'absolute', left: '50%', bottom: 8, width: 140, height: 5, marginLeft: -70, borderRadius: 3, background: '#fff', opacity: 0.7, zIndex: 25 }} />
      </Stage>
    )
  }

  return shell(body, tabbed)
}

function Stage({ box, scale, frame, style, children }) {
  const phone = (
    <div style={{ position: 'relative', width: W, height: H, overflow: 'hidden', borderRadius: frame ? 46 : 0, background: BG, color: '#fff', fontFamily: "-apple-system, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif" }}>{children}</div>
  )
  return (
    <div ref={box} className="bp-app" style={{ position: 'relative', width: '100%', height: '100%', display: 'grid', placeItems: 'center', overflow: 'hidden', background: 'radial-gradient(ellipse at 50% 30%, #1d2c52, #070c1a 75%)', ...style }}>
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
