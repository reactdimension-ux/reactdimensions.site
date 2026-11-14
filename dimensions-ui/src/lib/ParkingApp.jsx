import { useEffect, useRef, useState } from 'react'

// A parking-finder app on a phone, as a click-through prototype. Pages: Map
// (an inline-SVG city map with price pins whose free-space counts tick live,
// plus working filter chips for EV, covered, under $X and saved lots, search,
// zoom and a lot carousel), Lot detail (a mini layout of every bay, tap a free
// bay to choose it, pick a duration, save the lot), Payment (vehicle, method,
// processing, then it really starts a session), Timer (a running countdown
// ring with extend buttons, an expiry warning and an overstay fee; a demo
// speed toggle lets you reach the warning quickly) and History (past sessions
// open a receipt, "Park again" jumps back to the lot). Live counts, saved
// lots, the active session and history are shared state across all pages.
// The phone scales to fit whatever box it is in. Nothing is loaded from the
// network; the map is drawn in SVG.

const W = 390
const H = 844
const INK = '#1d1b2f'
const MUTED = '#7c7a90'
const BG = '#f5f3ee'
const GREEN = '#16a34a'
const AMBER = '#f59e0b'
const RED = '#dc2626'

const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const usd = (n) => `$${n.toFixed(2)}`
const hm = (h) => (h < 1 ? `${Math.round(h * 60)} min` : `${Math.floor(h)} h${h % 1 ? ` ${Math.round((h % 1) * 60)} min` : ''}`)

const LOTS = [
  { id: 'L1', name: 'Plaza Garage', addr: '120 Market Street', x: 120, y: 245, price: 6, rows: 4, cols: 8, free0: 11, ev: 4, covered: true, open24: true, rating: 4.6, walk: 2 },
  { id: 'L2', name: 'Harbor Lot', addr: '8 Quay Road', x: 292, y: 335, price: 3.5, rows: 5, cols: 8, free0: 17, ev: 0, covered: false, open24: false, rating: 4.1, walk: 6 },
  { id: 'L3', name: 'City Hall Deck', addr: '1 Civic Plaza', x: 200, y: 440, price: 4.5, rows: 5, cols: 8, free0: 6, ev: 6, covered: true, open24: false, rating: 4.4, walk: 3 },
  { id: 'L4', name: 'Maple Street Lot', addr: '55 Maple Street', x: 78, y: 400, price: 2.5, rows: 3, cols: 8, free0: 9, ev: 0, covered: false, open24: false, rating: 3.9, walk: 9 },
  { id: 'L5', name: 'Station Park & Go', addr: '2 Rail Approach', x: 310, y: 205, price: 7, rows: 6, cols: 8, free0: 4, ev: 8, covered: true, open24: true, rating: 4.7, walk: 1 },
  { id: 'L6', name: 'Market Hall Garage', addr: '77 Fulton Avenue', x: 175, y: 540, price: 5, rows: 4, cols: 8, free0: 0, ev: 2, covered: true, open24: false, rating: 4.2, walk: 4 },
  { id: 'L7', name: 'Riverside Surface', addr: '300 Water Lane', x: 305, y: 505, price: 2, rows: 4, cols: 8, free0: 14, ev: 0, covered: false, open24: true, rating: 3.8, walk: 11 },
]

const PLATES = ['KJD 482', 'MRT 019']
const METHODS = ['Visa •• 4242', 'Apple Pay', 'Wallet · $24.10']
const CAPS = [null, 3, 5, 8]

const NAV = [
  ['map', 'map', 'Map'],
  ['timer', 'clock', 'Timer'],
  ['history', 'list', 'History'],
]

const ICONS = {
  map: 'M9 4L3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  list: 'M7 4h10a1 1 0 0 1 1 1v15l-3-2-3 2-3-2-3 2V5a1 1 0 0 1 1-1zM9 9h6M9 13h6',
  back: 'M15 5l-7 7 7 7',
  chev: 'M9 5l7 7-7 7',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  bolt: 'M13 3L5 14h6l-1 7 8-11h-6z',
  roof: 'M3 11l9-7 9 7M5 11v9h14v-9M9 20v-5h6v5',
  heart: 'M12 20s-7-4.500-7-10a4 4 0 0 1 7-2.500A4 4 0 0 1 19 10c0 5.500-7 10-7 10z',
  star: 'M12 3l2.700 5.600 6.100.9-4.400 4.300 1 6.100L12 17l-5.400 2.900 1-6.100L3.200 9.500l6.100-.9z',
  x: 'M6 6l12 12M18 6L6 18',
  check: 'M5 12l5 5 9-10',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  nav: 'M12 3l7 17-7-4-7 4z',
  locate: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v3M12 19v3M2 12h3M19 12h3',
  car: 'M5 16V12l2-5h10l2 5v4M3 16h18v3H3zM7 19v1M17 19v1M7 12h10',
  card: 'M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 10h18',
  warn: 'M12 3l10 18H2zM12 10v5M12 18h.01',
  walk: 'M13 4a1.500 1.500 0 1 0 0 .01zM10 21l2-6-2-3 1-5 3 3 3 1M10 12l-3 2',
  repeat: 'M4 12a8 8 0 0 1 14-5l2 2M20 12a8 8 0 0 1-14 5l-2-2M20 4v5h-5M4 20v-5h5',
}

function Icon({ name, size = 22, color = 'currentColor', w = 1.9, fill = 'none' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  )
}

const iconBtn = { display: 'grid', placeItems: 'center', border: 'none', borderRadius: '50%', cursor: 'pointer', padding: 0, background: '#fff', color: INK, boxShadow: '0 4px 14px rgba(29,27,47,.14)' }

function useReduced() {
  const [r, setR] = useState(false)
  useEffect(() => {
    if (!window.matchMedia) return undefined
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const f = () => setR(mq.matches)
    f()
    mq.addEventListener?.('change', f)
    return () => mq.removeEventListener?.('change', f)
  }, [])
  return r
}

// deterministic shuffle so a lot always has the same bays taken first
function shuffled(n, seed) {
  const a = Array.from({ length: n }, (_, i) => i)
  let s = seed * 9301 + 49297
  for (let i = n - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280
    const j = Math.floor((s / 233280) * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const lotSeed = (lot) => lot.id.charCodeAt(1) * 7
const bayName = (lot, i) => `${String.fromCharCode(65 + Math.floor(i / lot.cols))}${(i % lot.cols) + 1}`
const cap = (lot) => lot.rows * lot.cols
const evBays = (lot) => Array.from({ length: lot.ev }, (_, k) => k * lot.cols) // first column, top-down
const lotTone = (free, total) => (free === 0 ? '#8b8a9b' : free / total > 0.25 ? GREEN : free / total > 0.1 ? AMBER : RED)

const fmtT = (s) => {
  const a = Math.abs(Math.floor(s))
  const h = Math.floor(a / 3600)
  const m = Math.floor((a % 3600) / 60)
  const sec = a % 60
  return `${h ? `${h}:` : ''}${String(m).padStart(h ? 2 : 1, '0')}:${String(sec).padStart(2, '0')}`
}

// ---------------------------------------------------------------- map art

const BUILDINGS = Array.from({ length: 60 }, (_, i) => {
  const r = (n) => ((i * 9301 + n * 49297) % 233280) / 233280
  return { x: 10 + r(1) * 360, y: 130 + r(2) * 560, w: 14 + r(3) * 26, h: 12 + r(4) * 22 }
})

function MapArt() {
  return (
    <g>
      <rect x={-200} y={-200} width={800} height={1300} fill="#ecebe3" />
      {BUILDINGS.map((b, i) => <rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} rx={3} fill="#e0ded3" />)}
      <rect x={14} y={118} width={92} height={88} rx={14} fill="#cfe5c9" />
      <rect x={236} y={560} width={110} height={78} rx={14} fill="#cfe5c9" />
      <path d="M-30 640 C100 590 180 700 300 650 S 420 560 470 600" fill="none" stroke="#bcd9ec" strokeWidth={46} strokeLinecap="round" />
      {/* road casing then fill */}
      {[
        ['M-20 250 L410 222', 16],
        ['M-20 440 L410 462', 16],
        ['M70 60 L112 800', 16],
        ['M272 40 L246 800', 16],
        ['M-20 720 L410 330', 12],
        ['M-20 345 L410 338', 9],
        ['M-20 545 L410 566', 9],
        ['M172 40 L182 800', 9],
        ['M340 40 L322 800', 9],
      ].map(([d, w], i) => <path key={`c${i}`} d={d} stroke="#d4d2c6" strokeWidth={w + 3} fill="none" />)}
      {[
        ['M-20 250 L410 222', 16],
        ['M-20 440 L410 462', 16],
        ['M70 60 L112 800', 16],
        ['M272 40 L246 800', 16],
        ['M-20 720 L410 330', 12],
        ['M-20 345 L410 338', 9],
        ['M-20 545 L410 566', 9],
        ['M172 40 L182 800', 9],
        ['M340 40 L322 800', 9],
      ].map(([d, w], i) => <path key={`f${i}`} d={d} stroke="#fff" strokeWidth={w} fill="none" />)}
      <text x={20} y={246} fontSize={9} fontWeight={700} fill="#a9a79a">MARKET ST</text>
      <text x={20} y={456} fontSize={9} fontWeight={700} fill="#a9a79a">FULTON AVE</text>
      <text x={300} y={655} fontSize={9} fontWeight={700} fill="#8fb3cc" fontStyle="italic">River Aldan</text>
      <text x={24} y={160} fontSize={9} fontWeight={700} fill="#79a874">Old Town Park</text>
    </g>
  )
}

function Pin({ lot, free, selected, accent, x, y, flash, onClick }) {
  const tone = lotTone(free, cap(lot))
  const w = 76
  return (
    <g transform={`translate(${x} ${y})`} onClick={onClick} style={{ cursor: 'pointer' }} role="button" aria-label={`${lot.name}, ${usd(lot.price)} per hour, ${free} free`}>
      <path d={`M${-w / 2 + 12} -34 h${w - 24} a12 12 0 0 1 12 12 v10 a12 12 0 0 1 -12 12 h${-(w / 2 - 18)} l-6 7 l-6 -7 h${-(w / 2 - 18)} a12 12 0 0 1 -12 -12 v-10 a12 12 0 0 1 12 -12z`} fill={selected ? accent : '#fff'} stroke={flash ? tone : 'rgba(29,27,47,.18)'} strokeWidth={flash ? 2.500 : 1} style={{ filter: 'drop-shadow(0 3px 4px rgba(29,27,47,.25))' }} />
      <text x={-w / 2 + 11} y={-17} fontSize={13} fontWeight={800} fill={selected ? '#fff' : INK}>${lot.price % 1 ? lot.price.toFixed(1) : lot.price}</text>
      <circle cx={w / 2 - 26} cy={-21} r={3.500} fill={selected ? '#fff' : tone} />
      <text x={w / 2 - 20} y={-17} fontSize={12} fontWeight={800} fill={selected ? '#fff' : tone}>{free}</text>
    </g>
  )
}

function StatusBar({ frame, color = INK }) {
  const clock = new Date().toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' })
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 40, height: 54, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 30px 0 36px', fontSize: 16, fontWeight: 600, color, pointerEvents: 'none' }}>
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

// ---------------------------------------------------------------- lot layout

function LotLayout({ lot, free, bay, onPick, accent }) {
  const n = cap(lot)
  const order = shuffled(n, lotSeed(lot))
  const ev = evBays(lot)
  const taken = new Set(order.slice(0, n - free))
  const bw = 31
  const bh = 24
  const gap = 4
  const half = lot.cols / 2
  const aisle = 34
  const wd = lot.cols * (bw + gap) + aisle
  const ht = lot.rows * (bh + gap) + 28
  return (
    <svg viewBox={`0 0 ${wd} ${ht}`} width="100%" role="group" aria-label="Lot layout" style={{ display: 'block' }}>
      <rect x={0} y={0} width={wd} height={ht} rx={14} fill="#e9e7df" />
      <path d={`M${half * (bw + gap) + aisle / 2} ${ht - 8} V12`} stroke="#fff" strokeWidth={2} strokeDasharray="5 6" />
      <path d={`M${half * (bw + gap) + aisle / 2 - 6} 20 l6 -8 l6 8`} fill="none" stroke="#b5b3a6" strokeWidth={2} />
      <text x={wd / 2} y={ht - 6} textAnchor="middle" fontSize={8} fontWeight={700} fill="#a4a294">ENTRY</text>
      {Array.from({ length: n }, (_, i) => {
        const r = Math.floor(i / lot.cols)
        const c = i % lot.cols
        const x = c * (bw + gap) + (c >= half ? aisle : 0) + 3
        const y = r * (bh + gap) + 8
        const isTaken = taken.has(i)
        const isEv = ev.includes(i)
        const picked = bay === i && !isTaken
        const label = bayName(lot, i)
        return (
          <g key={i} onClick={() => !isTaken && onPick(i)} style={{ cursor: isTaken ? 'default' : 'pointer' }} role="button" aria-label={`Bay ${label} ${isTaken ? 'taken' : 'free'}${isEv ? ', EV charger' : ''}`}>
            <rect x={x} y={y} width={bw} height={bh} rx={5} fill={picked ? accent : isTaken ? '#b6b4c4' : isEv ? '#d6f5e3' : '#fff'} stroke={picked ? accent : isEv ? '#34d399' : '#cfcdbf'} strokeWidth={1.200} />
            {isTaken && <rect x={x + 5} y={y + 5} width={bw - 10} height={bh - 10} rx={4} fill="#8c8aa0" />}
            {!isTaken && isEv && !picked && <path d={`M${x + bw / 2 + 1.500} ${y + 5} l-5 8 h4 l-1 6 l5.500 -8 h-4z`} fill="#059669" />}
            {picked && <text x={x + bw / 2} y={y + bh / 2 + 3.500} textAnchor="middle" fontSize={10} fontWeight={800} fill="#fff">{label}</text>}
          </g>
        )
      })}
    </svg>
  )
}

// ---------------------------------------------------------------- app

const SEED_HISTORY = [
  { id: 'p1', lot: 'L1', date: 'Yesterday', start: '09:10', hours: 3, cost: 18.5, bay: 'B3' },
  { id: 'p2', lot: 'L4', date: 'Mon 10 Nov', start: '13:40', hours: 1.5, cost: 4.25, bay: 'A6' },
  { id: 'p3', lot: 'L5', date: 'Fri 7 Nov', start: '18:00', hours: 4, cost: 28.5, bay: 'D2' },
]

const initStack = (s) => (s === 'lot' ? [{ id: 'lot', lot: 'L2' }] : s === 'payment' ? [{ id: 'payment' }] : [])

export default function ParkingApp({ name = 'Parkly', accent = '#4f46e5', startScreen = 'map', frame = true, style }) {
  const box = useRef()
  const toastTimer = useRef()
  const payTimer = useRef()
  const carousel = useRef()
  const warned = useRef(0)
  const reduced = useReduced()
  const [scale, setScale] = useState(1)
  const [tab, setTab] = useState(['timer', 'history'].includes(startScreen) ? startScreen : 'map')
  const [stack, setStack] = useState(() => initStack(startScreen))
  const [dir, setDir] = useState(1)
  const [toast, setToast] = useState('')
  const [free, setFree] = useState(() => Object.fromEntries(LOTS.map((l) => [l.id, l.free0])))
  const [flash, setFlash] = useState({})
  const [fEv, setFEv] = useState(false)
  const [fCov, setFCov] = useState(false)
  const [fSaved, setFSaved] = useState(false)
  const [capIx, setCapIx] = useState(0)
  const [q, setQ] = useState('')
  const [zoom, setZoom] = useState(1)
  const [sel, setSel] = useState(null)
  const [saved, setSaved] = useState({ L1: true })
  const [hours, setHours] = useState(2)
  const [bay, setBay] = useState(null)
  const [plate, setPlate] = useState(0)
  const [method, setMethod] = useState(0)
  const [paying, setPaying] = useState(false)
  const [history, setHistory] = useState(SEED_HISTORY)
  const [speed, setSpeed] = useState(1)
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [session, setSession] = useState(() => (startScreen === 'timer' ? { lot: 'L2', bay: 7, bayLabel: 'B3', plate: 0, remaining: 40 * 60, total: 120 * 60, cost: 7 } : null))

  useEffect(() => {
    setTab(['timer', 'history'].includes(startScreen) ? startScreen : 'map')
    setStack(initStack(startScreen))
    if (startScreen === 'timer') setSession((s) => s || { lot: 'L2', bay: 7, bayLabel: 'B3', plate: 0, remaining: 40 * 60, total: 120 * 60, cost: 7 })
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

  const say = (t) => {
    setToast(t)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 2000)
  }
  useEffect(() => () => (clearTimeout(toastTimer.current), clearTimeout(payTimer.current)), [])

  // simulated live availability
  useEffect(() => {
    let clear
    const id = setInterval(() => {
      const picks = [LOTS[Math.floor(Math.random() * LOTS.length)], LOTS[Math.floor(Math.random() * LOTS.length)]]
      const ch = {}
      setFree((f) => {
        const n = { ...f }
        picks.forEach((l) => {
          const d = (Math.random() < 0.5 ? -1 : 1) * (1 + Math.floor(Math.random() * 2))
          const v = clamp(n[l.id] + d, 0, cap(l))
          if (v !== n[l.id]) ch[l.id] = v > n[l.id] ? 'up' : 'down'
          n[l.id] = v
        })
        return n
      })
      setFlash(ch)
      clearTimeout(clear)
      clear = setTimeout(() => setFlash({}), 1000)
    }, 2400)
    return () => (clearInterval(id), clearTimeout(clear))
  }, [])

  // session countdown (demo speed multiplies it)
  const live = !!session
  useEffect(() => {
    if (!live) return undefined
    let last = performance.now()
    const id = setInterval(() => {
      const n = performance.now()
      const dt = (n - last) / 1000
      last = n
      setSession((s) => (s ? { ...s, remaining: s.remaining - dt * speed } : s))
    }, 250)
    return () => clearInterval(id)
  }, [live, speed])

  const level = !session ? 0 : session.remaining <= 0 ? 2 : session.remaining <= 300 ? 1 : 0
  useEffect(() => {
    if (!session) return
    if (level > warned.current) say(level === 2 ? 'Parking expired. Extend now to avoid a fine' : '5 minutes left on your parking')
    warned.current = level
  }, [level, !session])

  const top = stack[stack.length - 1]
  const push = (s) => (setDir(1), setStack((a) => [...a, s]))
  const pop = () => (setDir(-1), setStack((a) => a.slice(0, -1)))
  const go = (t) => (setDir(NAV.findIndex((n) => n[0] === t) > NAV.findIndex((n) => n[0] === tab) ? 1 : -1), setTab(t), setStack([]))
  const lotOf = (id) => LOTS.find((l) => l.id === id)
  const openLot = (id) => (setHours(2), setBay(null), push({ id: 'lot', lot: id }))

  const capV = CAPS[capIx]
  const visible = LOTS.filter((l) => (!fEv || l.ev > 0) && (!fCov || l.covered) && (!fSaved || saved[l.id]) && (!capV || l.price <= capV) && (l.name + l.addr).toLowerCase().includes(q.trim().toLowerCase()))
  const selLot = visible.find((l) => l.id === sel)

  const chooseOnMap = (id) => {
    setSel(id)
    const i = visible.findIndex((l) => l.id === id)
    if (carousel.current && i >= 0) carousel.current.scrollTo({ left: i * 292, behavior: reduced ? 'auto' : 'smooth' })
  }

  const startSession = (lot) => {
    const label = bay === null ? 'Any' : bayName(lot, bay)
    const total = hours * 3600
    setSession({ lot: lot.id, bay, bayLabel: label, plate, remaining: total, total, cost: +(lot.price * hours).toFixed(2) })
    setSpeed(1)
    warned.current = 0
    setPaying(false)
    setDir(1)
    setTab('timer')
    setStack([])
    say(`Parking started${bay === null ? '' : ` · Bay ${label}`}`)
  }

  const endSession = () => {
    const l = lotOf(session.lot)
    const over = session.remaining < 0 ? +((-session.remaining / 3600) * l.price * 1.5).toFixed(2) : 0
    const used = Math.max(0, session.total - Math.max(0, session.remaining))
    setHistory((h) => [{ id: `p${Date.now()}`, lot: l.id, date: 'Today', start: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }), hours: +(used / 3600).toFixed(2), cost: +(session.cost + over).toFixed(2), bay: session.bayLabel }, ...h])
    setSession(null)
    setConfirmEnd(false)
    say(over ? `Session ended · overstay fee ${usd(over)}` : 'Session ended. Safe travels')
    go('history')
  }

  const extend = (mins) => {
    const l = lotOf(session.lot)
    const c = +((l.price * mins) / 60).toFixed(2)
    setSession((s) => ({ ...s, remaining: Math.max(s.remaining, 0) + mins * 60, total: s.total + mins * 60 + Math.max(0, -s.remaining), cost: +(s.cost + c).toFixed(2) }))
    say(`Extended by ${mins} min · +${usd(c)}`)
  }

  const header = (title, back, right) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px 6px', minHeight: 48 }}>
      {back && <button type="button" onClick={back} aria-label="Back" style={{ ...iconBtn, width: 38, height: 38 }}><Icon name="back" size={20} /></button>}
      <h1 style={{ margin: 0, flex: 1, fontSize: back ? 18 : 28, fontWeight: 800, letterSpacing: '-0.02em', marginLeft: 4 }}>{title}</h1>
      {right}
    </div>
  )

  const primary = (label, onClick, disabled) => (
    <button type="button" disabled={disabled} onClick={onClick} style={{ width: '100%', height: 54, borderRadius: 18, border: 'none', background: disabled ? '#cfcddb' : accent, color: '#fff', font: 'inherit', fontSize: 16, fontWeight: 700, cursor: disabled ? 'default' : 'pointer', boxShadow: disabled ? 'none' : `0 10px 20px ${accent}44` }}>{label}</button>
  )

  const chip = (on, label, onClick, icon) => (
    <button type="button" onClick={onClick} aria-pressed={on} style={{ flex: 'none', height: 36, padding: '0 13px', borderRadius: 18, border: 'none', display: 'flex', alignItems: 'center', gap: 6, background: on ? accent : '#fff', color: on ? '#fff' : INK, font: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 3px 10px rgba(29,27,47,.12)' }}>
      {icon && <Icon name={icon} size={15} w={2.200} />}{label}
    </button>
  )

  const lotCard = (l, fullW) => {
    const f = free[l.id]
    const tone = lotTone(f, cap(l))
    return (
      <button key={l.id} type="button" onClick={() => openLot(l.id)} style={{ flex: 'none', width: fullW ? '100%' : 280, scrollSnapAlign: 'start', textAlign: 'left', padding: 14, borderRadius: 22, border: `2px solid ${sel === l.id ? accent : 'transparent'}`, background: '#fff', color: INK, font: 'inherit', cursor: 'pointer', boxShadow: '0 8px 22px rgba(29,27,47,.14)' }}>
        <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontSize: 16, fontWeight: 800 }}>{l.name}</span>
          <span style={{ fontSize: 17, fontWeight: 800 }}>{usd(l.price)}<span style={{ fontSize: 11, color: MUTED, fontWeight: 600 }}>/hr</span></span>
        </span>
        <span style={{ display: 'block', fontSize: 12.500, color: MUTED, margin: '2px 0 10px' }}>{l.addr} · {l.walk} min walk</span>
        <span style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ padding: '4px 9px', borderRadius: 10, background: `${tone}1f`, color: tone, fontSize: 12, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{f === 0 ? 'Full' : `${f} free`}</span>
          {l.ev > 0 && <span style={{ padding: '4px 9px', borderRadius: 10, background: '#d6f5e3', color: '#047857', fontSize: 12, fontWeight: 700 }}>EV · {l.ev}</span>}
          {l.covered && <span style={{ padding: '4px 9px', borderRadius: 10, background: '#e8e7fb', color: accent, fontSize: 12, fontWeight: 700 }}>Covered</span>}
          {saved[l.id] && <Icon name="heart" size={16} color="#ec4899" fill="#ec4899" />}
        </span>
      </button>
    )
  }

  let body
  let tabbed = !top
  if (top?.id === 'lot') {
    const l = lotOf(top.lot)
    const f = free[l.id]
    const tone = lotTone(f, cap(l))
    const validBay = bay !== null && !new Set(shuffled(cap(l), lotSeed(l)).slice(0, cap(l) - f)).has(bay) ? bay : null
    const total = +(l.price * hours).toFixed(2)
    body = (
      <div className="pk-scroll" style={{ height: '100%', overflowY: 'auto', paddingBottom: 30 }}>
        <div style={{ position: 'relative', height: 190, background: `linear-gradient(160deg, ${accent}, #1d1b2f)`, overflow: 'hidden' }}>
          <svg viewBox="0 0 390 190" width="100%" height="190" aria-hidden="true" style={{ position: 'absolute', inset: 0 }}>
            <rect x={30} y={70} width={120} height={120} fill="#ffffff22" />
            <rect x={170} y={40} width={90} height={150} fill="#ffffff1a" />
            <rect x={280} y={85} width={110} height={105} fill="#ffffff22" />
            {Array.from({ length: 30 }, (_, i) => <rect key={i} x={40 + (i % 6) * 18} y={82 + Math.floor(i / 6) * 20} width={9} height={11} fill="#ffffff33" />)}
            <rect x={0} y={166} width={390} height={24} fill="#12111f" />
            <path d="M0 178H390" stroke="#ffffff55" strokeWidth={2} strokeDasharray="14 12" />
            <rect x={200} y={44} width={48} height={48} rx={10} fill="#fff" />
            <text x={224} y={80} textAnchor="middle" fontSize={36} fontWeight={900} fill={accent}>P</text>
            <rect x={222} y={92} width={4} height={40} fill="#fff" />
          </svg>
          <button type="button" onClick={pop} aria-label="Back" style={{ ...iconBtn, position: 'absolute', top: 60, left: 16, width: 40, height: 40 }}><Icon name="back" size={20} /></button>
          <button type="button" onClick={() => (setSaved((s) => ({ ...s, [l.id]: !s[l.id] })), say(saved[l.id] ? 'Removed from saved' : `${l.name} saved`))} aria-pressed={!!saved[l.id]} aria-label="Save lot" style={{ ...iconBtn, position: 'absolute', top: 60, right: 16, width: 40, height: 40 }}><Icon name="heart" size={20} color={saved[l.id] ? '#ec4899' : INK} fill={saved[l.id] ? '#ec4899' : 'none'} /></button>
        </div>
        <div style={{ margin: '-24px 16px 0', position: 'relative', background: '#fff', borderRadius: 24, padding: 18, boxShadow: '0 10px 26px rgba(29,27,47,.12)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>{l.name}</div>
              <div style={{ fontSize: 13, color: MUTED, marginTop: 2 }}>{l.addr}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 22, fontWeight: 800 }}>{usd(l.price)}</div>
              <div style={{ fontSize: 11.500, color: MUTED }}>per hour</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12, fontSize: 12, fontWeight: 700 }}>
            <span style={{ padding: '5px 10px', borderRadius: 10, background: '#fef3c7', color: '#92400e' }}>★ {l.rating}</span>
            <span style={{ padding: '5px 10px', borderRadius: 10, background: '#f1f0ea' }}>{l.walk} min walk</span>
            {l.covered && <span style={{ padding: '5px 10px', borderRadius: 10, background: '#e8e7fb', color: accent }}>Covered</span>}
            {l.ev > 0 && <span style={{ padding: '5px 10px', borderRadius: 10, background: '#d6f5e3', color: '#047857' }}>{l.ev} EV chargers</span>}
            <span style={{ padding: '5px 10px', borderRadius: 10, background: '#f1f0ea' }}>{l.open24 ? 'Open 24h' : '06:00 – 23:00'}</span>
          </div>
        </div>
        <div style={{ margin: '14px 16px 0', background: '#fff', borderRadius: 24, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 15, fontWeight: 800 }}>Choose a bay</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: tone, fontVariantNumeric: 'tabular-nums' }}>{f === 0 ? 'Lot full' : `${f} of ${cap(l)} free`} {flash[l.id] ? (flash[l.id] === 'up' ? '▲' : '▼') : ''}</div>
          </div>
          <LotLayout lot={l} free={f} bay={validBay} onPick={(i) => (setBay(i === bay ? null : i), say(i === bay ? 'Bay choice cleared' : `Bay ${bayName(l, i)} selected`))} accent={accent} />
          <div style={{ display: 'flex', gap: 14, fontSize: 11.500, color: MUTED, marginTop: 10, flexWrap: 'wrap' }}>
            {[['#fff', '#cfcdbf', 'Free'], ['#8c8aa0', '#8c8aa0', 'Taken'], ['#d6f5e3', '#34d399', 'EV charger'], [accent, accent, 'Yours']].map(([bgc, bc, t]) => (
              <span key={t} style={{ display: 'flex', alignItems: 'center', gap: 5 }}><i style={{ width: 12, height: 12, borderRadius: 3, background: bgc, border: `1.5px solid ${bc}` }} />{t}</span>
            ))}
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, marginTop: 10 }}>{validBay === null ? 'Tap a free bay, or let us assign one' : `Bay ${bayName(l, validBay)} selected`}</div>
        </div>
        <div style={{ margin: '14px 16px 0', background: '#fff', borderRadius: 24, padding: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 10 }}>Duration</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <button type="button" onClick={() => setHours((h) => clamp(h - 0.5, 0.5, 12))} aria-label="Less time" style={{ ...iconBtn, width: 46, height: 46, background: '#f1f0ea', boxShadow: 'none' }}><Icon name="minus" /></button>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 26, fontWeight: 800 }}>{hm(hours)}</div>
              <div style={{ fontSize: 12.500, color: MUTED }}>until {new Date(Date.now() + hours * 3600000).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
            <button type="button" onClick={() => setHours((h) => clamp(h + 0.5, 0.5, 12))} aria-label="More time" style={{ ...iconBtn, width: 46, height: 46, background: '#f1f0ea', boxShadow: 'none' }}><Icon name="plus" /></button>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            {[1, 2, 4, 8].map((h) => <button key={h} type="button" onClick={() => setHours(h)} aria-pressed={hours === h} style={{ flex: 1, height: 36, borderRadius: 12, border: 'none', background: hours === h ? `${accent}1f` : '#f1f0ea', color: hours === h ? accent : INK, font: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{h} h</button>)}
          </div>
        </div>
        <div style={{ padding: '14px 16px 0', display: 'grid', gap: 10 }}>
          {primary(f === 0 ? 'Lot is full right now' : `Reserve · ${usd(total)}`, () => push({ id: 'payment', lot: l.id }), f === 0)}
          <button type="button" onClick={() => say(`Navigating to ${l.name} · ${l.walk + 4} min drive`)} style={{ height: 48, borderRadius: 16, border: 'none', background: '#e9e7df', color: INK, font: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center' }}><Icon name="nav" size={18} /> Navigate there</button>
        </div>
      </div>
    )
  } else if (top?.id === 'payment') {
    const l = lotOf(top.lot || 'L2')
    const fee = 0.5
    const total = +(l.price * hours + fee).toFixed(2)
    body = (
      <div className="pk-scroll" style={{ height: '100%', overflowY: 'auto', paddingTop: 54, paddingBottom: 30 }}>
        {header('Payment', paying ? null : pop)}
        <div style={{ margin: '6px 16px 0', background: '#fff', borderRadius: 22, padding: '6px 16px' }}>
          {[['Lot', l.name], ['Bay', bay === null ? 'Assigned on arrival' : bayName(l, bay)], ['Duration', hm(hours)], ['Rate', `${usd(l.price)} / hr`], ['Booking fee', usd(fee)]].map(([a, b]) => (
            <div key={a} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #f0eee7', fontSize: 14 }}><span style={{ color: MUTED }}>{a}</span><span style={{ fontWeight: 700 }}>{b}</span></div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 0', fontSize: 18, fontWeight: 800 }}><span>Total</span><span>{usd(total)}</span></div>
        </div>
        <div style={{ padding: '16px 20px 8px', fontSize: 12, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '.06em' }}>Vehicle</div>
        <div style={{ display: 'flex', gap: 8, padding: '0 16px' }}>
          {PLATES.map((p, i) => (
            <button key={p} type="button" onClick={() => setPlate(i)} aria-pressed={plate === i} style={{ flex: 1, height: 52, borderRadius: 16, border: `2px solid ${plate === i ? accent : 'transparent'}`, background: '#fff', color: INK, font: 'inherit', fontSize: 14, fontWeight: 800, letterSpacing: '.06em', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><Icon name="car" size={18} color={accent} />{p}</button>
          ))}
        </div>
        <div style={{ padding: '16px 20px 8px', fontSize: 12, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '.06em' }}>Pay with</div>
        <div style={{ margin: '0 16px', background: '#fff', borderRadius: 22, padding: '2px 16px' }}>
          {METHODS.map((m, i) => (
            <button key={m} type="button" onClick={() => setMethod(i)} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '14px 0', border: 'none', borderTop: i ? '1px solid #f0eee7' : 'none', background: 'none', color: INK, font: 'inherit', fontSize: 14.500, fontWeight: 600, cursor: 'pointer' }}>
              <Icon name="card" size={20} color={accent} /><span style={{ flex: 1, textAlign: 'left' }}>{m}</span>
              <span style={{ width: 22, height: 22, borderRadius: '50%', border: `2px solid ${method === i ? accent : '#d6d4c8'}`, display: 'grid', placeItems: 'center' }}>{method === i && <span style={{ width: 10, height: 10, borderRadius: '50%', background: accent }} />}</span>
            </button>
          ))}
        </div>
        <div style={{ padding: '18px 16px 0' }}>
          {primary(paying ? 'Processing…' : `Pay ${usd(total)} and start`, () => { setPaying(true); clearTimeout(payTimer.current); payTimer.current = setTimeout(() => startSession(l), 1100) }, paying)}
        </div>
      </div>
    )
  } else if (top?.id === 'receipt') {
    const e = top.entry
    const l = lotOf(e.lot)
    tabbed = false
    body = (
      <div className="pk-scroll" style={{ height: '100%', overflowY: 'auto', paddingTop: 54, paddingBottom: 30 }}>
        {header('Receipt', pop)}
        <div style={{ margin: '10px 16px 0', background: '#fff', borderRadius: 22, padding: '8px 18px', textAlign: 'center' }}>
          <div style={{ fontSize: 34, fontWeight: 800, padding: '14px 0 2px' }}>{usd(e.cost)}</div>
          <div style={{ fontSize: 13, color: MUTED, paddingBottom: 12 }}>{l.name}</div>
          {[['Date', `${e.date}, ${e.start}`], ['Duration', hm(e.hours)], ['Bay', e.bay], ['Vehicle', PLATES[0]], ['Paid with', METHODS[0]]].map(([a, b]) => (
            <div key={a} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderTop: '1px solid #f0eee7', fontSize: 14 }}><span style={{ color: MUTED }}>{a}</span><span style={{ fontWeight: 700 }}>{b}</span></div>
          ))}
        </div>
        <div style={{ padding: '16px 16px 0', display: 'grid', gap: 10 }}>
          {primary('Park here again', () => (setDir(1), setTab('map'), setStack([]), openLot(l.id)))}
          <button type="button" onClick={() => say('Receipt emailed')} style={{ height: 46, border: 'none', background: 'none', color: MUTED, font: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Email receipt</button>
        </div>
      </div>
    )
  } else if (tab === 'timer') {
    if (!session) {
      body = (
        <div style={{ height: '100%', display: 'grid', alignContent: 'center', justifyItems: 'center', textAlign: 'center', padding: '0 40px 80px' }}>
          <span style={{ width: 96, height: 96, borderRadius: '50%', display: 'grid', placeItems: 'center', background: `${accent}18`, color: accent }}><Icon name="clock" size={46} /></span>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 20 }}>No active parking</div>
          <div style={{ fontSize: 14, color: MUTED, margin: '6px 0 24px' }}>Find a lot, reserve a bay and your countdown starts here.</div>
          <div style={{ width: '100%' }}>{primary('Find parking', () => go('map'))}</div>
        </div>
      )
    } else {
      const l = lotOf(session.lot)
      const rem = session.remaining
      const frac = clamp(rem / session.total, 0, 1)
      const tone = level === 2 ? RED : level === 1 ? AMBER : accent
      const R = 96
      const C = 2 * Math.PI * R
      const over = rem < 0 ? (-rem / 3600) * l.price * 1.5 : 0
      body = (
        <div className="pk-scroll" style={{ height: '100%', overflowY: 'auto', paddingTop: 54, paddingBottom: 110 }}>
          {header('Parking timer')}
          {level > 0 && (
            <div role="alert" className="pk-shake" style={{ margin: '4px 16px 0', padding: '12px 14px', borderRadius: 16, background: level === 2 ? '#fee2e2' : '#fef3c7', color: level === 2 ? '#991b1b' : '#92400e', display: 'flex', gap: 10, alignItems: 'center', fontSize: 13.500, fontWeight: 700 }}>
              <Icon name="warn" size={22} />
              <span style={{ flex: 1 }}>{level === 2 ? `Expired. Overstay fee ${usd(over)} and rising.` : 'Less than 5 minutes left. Extend to avoid a fine.'}</span>
            </div>
          )}
          <div style={{ display: 'grid', placeItems: 'center', padding: '18px 0 6px' }}>
            <div style={{ position: 'relative', width: 240, height: 240 }}>
              <svg width="240" height="240" viewBox="0 0 240 240" role="img" aria-label={`${fmtT(rem)} remaining`}>
                <circle cx="120" cy="120" r={R} fill="#fff" stroke="#e9e7df" strokeWidth="16" />
                <circle cx="120" cy="120" r={R} fill="none" stroke={tone} strokeWidth="16" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - frac)} transform="rotate(-90 120 120)" style={{ transition: 'stroke .3s' }} />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'grid', placeContent: 'center', textAlign: 'center' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '.08em' }}>{rem < 0 ? 'Overtime' : 'Time left'}</div>
                <div style={{ fontSize: 44, fontWeight: 800, letterSpacing: '-0.03em', color: level ? tone : INK, fontVariantNumeric: 'tabular-nums' }}>{rem < 0 ? '+' : ''}{fmtT(rem)}</div>
                <div style={{ fontSize: 12.500, color: MUTED }}>ends {new Date(Date.now() + rem * 1000).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>
              </div>
            </div>
          </div>
          <div style={{ margin: '8px 16px 0', background: '#fff', borderRadius: 22, padding: '4px 16px' }}>
            {[['Lot', l.name], ['Bay', session.bayLabel], ['Vehicle', PLATES[session.plate]], ['Cost so far', usd(session.cost + over)]].map(([a, b]) => (
              <div key={a} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #f0eee7', fontSize: 14 }}><span style={{ color: MUTED }}>{a}</span><span style={{ fontWeight: 700 }}>{b}</span></div>
            ))}
          </div>
          <div style={{ padding: '16px 20px 8px', fontSize: 12, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '.06em' }}>Extend time</div>
          <div style={{ display: 'flex', gap: 8, padding: '0 16px' }}>
            {[15, 30, 60].map((m) => (
              <button key={m} type="button" onClick={() => extend(m)} style={{ flex: 1, height: 56, borderRadius: 16, border: 'none', background: level ? accent : '#fff', color: level ? '#fff' : INK, font: 'inherit', fontSize: 15, fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 12px rgba(29,27,47,.08)' }}>
                +{m === 60 ? '1 h' : `${m} min`}
                <span style={{ display: 'block', fontSize: 11, fontWeight: 600, opacity: 0.75 }}>{usd((l.price * m) / 60)}</span>
              </button>
            ))}
          </div>
          <div style={{ display: 'grid', gap: 8, padding: '16px 16px 0' }}>
            <button type="button" onClick={() => setConfirmEnd(true)} style={{ height: 50, borderRadius: 16, border: `2px solid ${RED}`, background: 'none', color: RED, font: 'inherit', fontSize: 15, fontWeight: 800, cursor: 'pointer' }}>End session</button>
            <button type="button" onClick={() => setSpeed((s) => (s === 1 ? 30 : 1))} aria-pressed={speed > 1} style={{ height: 40, border: 'none', background: 'none', color: speed > 1 ? accent : MUTED, font: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{speed > 1 ? 'Demo speed ×30 on. Tap to slow down' : 'Demo: run the clock ×30'}</button>
          </div>
        </div>
      )
    }
  } else if (tab === 'history') {
    const total = history.reduce((a, h) => a + h.cost, 0)
    body = (
      <div className="pk-scroll" style={{ height: '100%', overflowY: 'auto', paddingTop: 54, paddingBottom: 110 }}>
        {header('History')}
        <div style={{ margin: '4px 16px 12px', padding: 18, borderRadius: 22, color: '#fff', background: `linear-gradient(135deg, ${accent}, #1d1b2f)` }}>
          <div style={{ fontSize: 12.500, opacity: 0.8 }}>Spent on parking · {history.length} sessions</div>
          <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-0.02em' }}>{usd(total)}</div>
        </div>
        <div style={{ display: 'grid', gap: 10, padding: '0 16px' }}>
          {history.map((h) => {
            const l = lotOf(h.lot)
            return (
              <div key={h.id} style={{ background: '#fff', borderRadius: 20, padding: 14 }}>
                <button type="button" onClick={() => push({ id: 'receipt', entry: h })} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', border: 'none', background: 'none', padding: 0, font: 'inherit', color: INK, textAlign: 'left', cursor: 'pointer' }}>
                  <span style={{ width: 44, height: 44, borderRadius: 14, display: 'grid', placeItems: 'center', background: `${accent}18`, color: accent, fontWeight: 900, fontSize: 20 }}>P</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 15, fontWeight: 700 }}>{l.name}</span>
                    <span style={{ display: 'block', fontSize: 12, color: MUTED, marginTop: 2 }}>{h.date}, {h.start} · {hm(h.hours)}</span>
                  </span>
                  <span style={{ fontSize: 15, fontWeight: 800 }}>{usd(h.cost)}</span>
                </button>
                <button type="button" onClick={() => openLot(h.lot)} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, border: 'none', background: `${accent}12`, color: accent, height: 34, padding: '0 12px', borderRadius: 12, font: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}><Icon name="repeat" size={15} /> Park again</button>
              </div>
            )
          })}
        </div>
      </div>
    )
  } else {
    const cx = W / 2
    const cy = 380
    const pos = (l) => ({ x: cx + (l.x - cx) * zoom, y: cy + (l.y - cy) * zoom })
    const order = [...visible].sort((a, b) => (a.id === sel) - (b.id === sel))
    body = (
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: '#ecebe3' }}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} role="img" aria-label="Parking map" onClick={() => setSel(null)}>
          <g style={{ transform: `translate(${cx}px, ${cy}px) scale(${zoom}) translate(${-cx}px, ${-cy}px)`, transition: reduced ? 'none' : 'transform .35s ease' }}>
            <MapArt />
          </g>
          {(() => {
            const me = pos({ x: 195, y: 352 })
            return (
              <g>
                <circle cx={me.x} cy={me.y} r={18} fill="#3b82f6" opacity={0.2}>{!reduced && <animate attributeName="r" values="10;24;10" dur="2.600s" repeatCount="indefinite" />}</circle>
                <circle cx={me.x} cy={me.y} r={7} fill="#3b82f6" stroke="#fff" strokeWidth={3} />
              </g>
            )
          })()}
          {order.map((l) => {
            const p = pos(l)
            return <Pin key={l.id} lot={l} free={free[l.id]} selected={sel === l.id} accent={accent} x={p.x} y={p.y} flash={!!flash[l.id]} onClick={(e) => (e.stopPropagation(), chooseOnMap(l.id))} />
          })}
        </svg>
        <div style={{ position: 'absolute', top: 54, left: 0, right: 0, padding: '4px 16px 0', zIndex: 5 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 48, padding: '0 16px', borderRadius: 24, background: '#fff', boxShadow: '0 6px 18px rgba(29,27,47,.16)' }}>
            <Icon name="search" size={20} color={accent} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a street or lot" aria-label="Search parking" style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'none', font: 'inherit', fontSize: 15, color: INK }} />
            {q && <button type="button" onClick={() => setQ('')} aria-label="Clear search" style={{ ...iconBtn, width: 26, height: 26, background: '#f1f0ea', boxShadow: 'none' }}><Icon name="x" size={14} /></button>}
          </div>
          <div className="pk-scroll" role="group" aria-label="Filters" style={{ display: 'flex', gap: 8, padding: '10px 0 8px', overflowX: 'auto' }}>
            {chip(fEv, 'EV', () => setFEv(!fEv), 'bolt')}
            {chip(fCov, 'Covered', () => setFCov(!fCov), 'roof')}
            {chip(capV !== null, capV ? `Under $${capV}` : 'Under $X', () => setCapIx((i) => (i + 1) % CAPS.length))}
            {chip(fSaved, 'Saved', () => setFSaved(!fSaved), 'heart')}
          </div>
        </div>
        <div style={{ position: 'absolute', right: 16, top: 190, display: 'grid', gap: 8, zIndex: 5 }}>
          <button type="button" onClick={() => setZoom((z) => clamp(+(z + 0.2).toFixed(1), 1, 1.6))} aria-label="Zoom in" style={{ ...iconBtn, width: 42, height: 42 }}><Icon name="plus" size={20} /></button>
          <button type="button" onClick={() => setZoom((z) => clamp(+(z - 0.2).toFixed(1), 1, 1.6))} aria-label="Zoom out" style={{ ...iconBtn, width: 42, height: 42 }}><Icon name="minus" size={20} /></button>
          <button type="button" onClick={() => (setZoom(1), setSel(null), say('Centered on you'))} aria-label="Center on me" style={{ ...iconBtn, width: 42, height: 42 }}><Icon name="locate" size={20} color="#3b82f6" /></button>
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 98, zIndex: 5 }}>
          <div style={{ padding: '0 18px 8px', fontSize: 12.500, fontWeight: 800, color: INK }}>
            <span style={{ padding: '5px 10px', borderRadius: 12, background: 'rgba(255,255,255,.92)' }}>{visible.length} lot{visible.length === 1 ? '' : 's'} nearby · live availability</span>
          </div>
          {visible.length ? (
            <div ref={carousel} className="pk-scroll" style={{ display: 'flex', gap: 12, overflowX: 'auto', padding: '0 16px 14px', scrollSnapType: 'x mandatory' }}>
              {visible.map((l) => lotCard(l))}
            </div>
          ) : (
            <div style={{ margin: '0 16px', padding: 18, borderRadius: 20, background: '#fff', textAlign: 'center', fontSize: 14, color: MUTED }}>
              No lots match these filters.
              <button type="button" onClick={() => (setFEv(false), setFCov(false), setFSaved(false), setCapIx(0), setQ(''))} style={{ display: 'block', margin: '8px auto 0', border: 'none', background: 'none', color: accent, font: 'inherit', fontWeight: 800, cursor: 'pointer' }}>Clear filters</button>
            </div>
          )}
        </div>
      </div>
    )
    void selLot
  }

  const phone = (
    <div data-phone="1" style={{ position: 'relative', width: W, height: H, overflow: 'hidden', borderRadius: frame ? 46 : 0, background: BG, color: INK, fontFamily: "-apple-system, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif" }}>
      <style>{`
        @keyframes pk-r { from { opacity: 0; transform: translateX(34px) } to { opacity: 1; transform: none } }
        @keyframes pk-l { from { opacity: 0; transform: translateX(-34px) } to { opacity: 1; transform: none } }
        @keyframes pk-sh { 0%, 100% { transform: none } 20% { transform: translateX(-4px) } 40% { transform: translateX(4px) } 60% { transform: translateX(-3px) } 80% { transform: translateX(3px) } }
        .pk-scroll { scrollbar-width: none } .pk-scroll::-webkit-scrollbar { display: none }
        .pk-shake { animation: pk-sh .5s ease 2 }
        .pk-app button:focus-visible, .pk-app input:focus-visible, .pk-app [role=button]:focus-visible { outline: 2px solid ${accent}; outline-offset: 2px }
        @media (prefers-reduced-motion: reduce) { .pk-slide, .pk-shake { animation: none !important } }
      `}</style>
      <StatusBar frame={frame} color={top?.id === 'lot' ? '#fff' : INK} />
      <div key={`${tab}/${stack.map((s) => s.id).join('/')}`} className="pk-slide" style={{ position: 'absolute', inset: 0, overflow: 'hidden', animation: `${dir > 0 ? 'pk-r' : 'pk-l'} .28s ease` }}>
        {body}
      </div>
      {tabbed && (
        <nav aria-label="Main" style={{ position: 'absolute', left: 20, right: 20, bottom: 24, height: 62, borderRadius: 31, background: INK, display: 'flex', justifyContent: 'space-around', alignItems: 'center', padding: '0 8px', boxShadow: '0 14px 30px rgba(29,27,47,.35)', zIndex: 10 }}>
          {NAV.map(([id, icon, label]) => {
            const on = tab === id
            return (
              <button key={id} type="button" onClick={() => go(id)} aria-current={on ? 'page' : undefined} style={{ position: 'relative', border: 'none', borderRadius: 24, background: on ? accent : 'none', font: 'inherit', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, height: 46, padding: '0 18px', fontSize: 13, fontWeight: 700, color: on ? '#fff' : '#a9a7c0' }}>
                <Icon name={icon} size={21} />
                {on && label}
                {id === 'timer' && session && !on && <i style={{ position: 'absolute', top: 7, right: 12, width: 9, height: 9, borderRadius: '50%', background: level ? RED : GREEN, border: `2px solid ${INK}` }} />}
              </button>
            )
          })}
        </nav>
      )}
      {confirmEnd && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 30, background: 'rgba(29,27,47,.5)', display: 'grid', alignItems: 'end' }} onClick={() => setConfirmEnd(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: '26px 26px 0 0', padding: '22px 20px 40px' }}>
            <div style={{ fontSize: 19, fontWeight: 800 }}>End parking now?</div>
            <div style={{ fontSize: 14, color: MUTED, margin: '6px 0 18px' }}>You will be charged for the time used. Unused time is not refunded.</div>
            <div style={{ display: 'grid', gap: 8 }}>
              {primary('End session', endSession)}
              <button type="button" onClick={() => setConfirmEnd(false)} style={{ height: 44, border: 'none', background: 'none', color: MUTED, font: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Keep parking</button>
            </div>
          </div>
        </div>
      )}
      <div role="status" style={{ position: 'absolute', left: '50%', top: 58, zIndex: 50, transform: `translate(-50%, ${toast ? 0 : -90}px)`, transition: 'transform .35s cubic-bezier(.2,.8,.2,1)', padding: '10px 16px', borderRadius: 20, background: INK, color: '#fff', fontSize: 12.500, fontWeight: 700, whiteSpace: 'nowrap', maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis' }}>{toast}</div>
      <div style={{ position: 'absolute', left: '50%', bottom: 8, width: 140, height: 5, marginLeft: -70, borderRadius: 3, background: INK, opacity: 0.8, zIndex: 45 }} />
    </div>
  )

  return (
    <div ref={box} className="pk-app" style={{ position: 'relative', width: '100%', height: '100%', display: 'grid', placeItems: 'center', overflow: 'hidden', background: 'radial-gradient(ellipse at 50% 30%, #e7e4f7, #b8b3d6 75%)', ...style }}>
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: `translate(-50%, -50%) scale(${scale})`, transformOrigin: 'center' }}>
        {frame ? (
          <div style={{ padding: 12, borderRadius: 58, background: 'linear-gradient(145deg, #3a3f4a, #14171d 40%, #2b2f38)', boxShadow: '0 40px 80px rgba(29,27,47,.35), inset 0 0 0 2px #4b515e' }}>
            <div style={{ padding: 2, borderRadius: 48, background: '#000' }}>{phone}</div>
          </div>
        ) : (
          phone
        )}
      </div>
    </div>
  )
}
