import { useEffect, useId, useRef, useState } from 'react'

// A movie-ticket app on a phone, as a click-through prototype. A five-step flow
// with a back button on each step: Now showing (a poster carousel drawn in SVG
// that you swipe or drag, the centre poster scales up; genre filter chips and a
// city picker), Movie (details, date and showtime chips), Seats (a curved
// screen, rows with aisles, taken seats that differ per showtime, tap to select
// with a live price total), Checkout (snack steppers, a promo code and a
// countdown that holds your seats; let it run out and the hold expires) and
// Ticket (QR-style code, a perforated edge and a tear-off animation). Posters
// are generated, there are no images. The phone scales to fit its box.

const W = 390
const H = 844
const BG = '#140a12'
const SURF = '#221320'
const SURF2 = '#33202f'
const INK = '#f6ecf1'
const MUTED = '#a58c9d'
const LINE = '#3a2536'

const ORDER = ['now', 'movie', 'seats', 'checkout', 'ticket']

const MOVIES = [
  { id: 'neon', title: 'Neon Tide', tags: ['Sci-Fi', 'Action'], mins: 128, rating: 'PG-13', score: 8.4, blurb: 'A courier who can read city lights follows a blackout across a drowned megacity, and the tide is not what it seems.', cast: ['Rhea Voss', 'Dario Kim', 'Ola Brandt'], a: '#2a0a5e', b: '#ff3d81' },
  { id: 'light', title: 'The Last Lighthouse', tags: ['Thriller', 'Drama'], mins: 112, rating: 'R', score: 7.9, blurb: 'A relief keeper arrives for one night and finds the lamp already burning. Someone has been signalling the ships.', cast: ['Nils Aaberg', 'Maren Ito', 'Joss Hale'], a: '#04161f', b: '#13788a' },
  { id: 'paper', title: 'Paper Planets', tags: ['Family'], mins: 96, rating: 'G', score: 8.1, blurb: 'Two siblings fold a galaxy from homework and have until bedtime to bring all the planets home.', cast: ['Tilly Moon', 'Bo Ferris', 'Ana Cruz'], a: '#ffcf5c', b: '#ff6a4d' },
  { id: 'dust', title: 'Dust and Thunder', tags: ['Action'], mins: 134, rating: 'PG-13', score: 7.2, blurb: 'One convoy, one storm front and three hundred miles of salt flats between a driver and her last delivery.', cast: ['Kai Mercer', 'Lou Park', 'Sade Okoro'], a: '#3a1205', b: '#ff8a2a' },
  { id: 'velvet', title: 'Velvet Hours', tags: ['Romance', 'Drama'], mins: 109, rating: 'PG-13', score: 8.0, blurb: 'Two night-shift strangers keep meeting in the same empty theatre and slowly rewrite the film that is playing.', cast: ['Iris Lund', 'Theo Marsh', 'Pia Costa'], a: '#3a0a1f', b: '#c9304f' },
  { id: 'pines', title: 'Hollow Pines', tags: ['Horror', 'Thriller'], mins: 101, rating: 'R', score: 7.0, blurb: 'The trail map says four miles. The forest keeps counting something else.', cast: ['Dane Rowe', 'Mika Sato', 'Cass Oyelaran'], a: '#04110c', b: '#24724a' },
]
const GENRES = ['All', 'Action', 'Sci-Fi', 'Drama', 'Family', 'Horror']
const CITIES = ['Downtown', 'Harbour', 'Uptown']
const SLOTS = [
  { t: '13:20', f: '2D', p: 12 },
  { t: '16:00', f: 'IMAX', p: 16 },
  { t: '19:30', f: '2D', p: 12 },
  { t: '22:15', f: 'IMAX', p: 16 },
]
const SNACKS = [
  { id: 'pop', name: 'Popcorn', note: 'Large, salted', price: 7.5 },
  { id: 'soda', name: 'Soda', note: '500 ml', price: 4.5 },
  { id: 'nach', name: 'Nachos', note: 'With cheese dip', price: 6 },
  { id: 'cand', name: 'Candy mix', note: 'Share bag', price: 3.5 },
]
const ROWS = 'ABCDEFGH'.split('')
const GROUPS = [3, 6, 3]
const PREMIUM_FROM = 6 // rows G and H
const PREMIUM_EXTRA = 4
const FEE = 1.5
const MAX_SEATS = 6

const money = (n) => `$${(Math.round(n * 100) / 100).toFixed(2)}`

const hash = (s) => {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) (h ^= s.charCodeAt(i)), (h = Math.imul(h, 16777619))
  return h >>> 0
}
const rng = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
// seat layout: columns 0..11 with aisles after col 2 and col 8
const COLS = Array.from({ length: 12 }, (_, i) => i)
const seatId = (r, c) => `${ROWS[r]}${c + 1}`
const takenFor = (movieId, d, s) => {
  const rand = rng(hash(`${movieId}|${d}|${s}`))
  const set = new Set()
  for (let r = 0; r < ROWS.length; r++) for (const c of COLS) if (rand() < (r < 2 ? 0.18 : 0.3)) set.add(seatId(r, c))
  return set
}
const pickDefault = (taken) => {
  for (let r = 3; r < 6; r++) for (let c = 3; c < 8; c++) if (!taken.has(seatId(r, c)) && !taken.has(seatId(r, c + 1))) return [seatId(r, c), seatId(r, c + 1)]
  return []
}
const dates = () =>
  Array.from({ length: 5 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i)
    return { label: i === 0 ? 'Today' : d.toLocaleDateString('en-US', { weekday: 'short' }), sub: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }
  })

const ICONS = {
  back: 'M15 5l-7 7 7 7',
  chev: 'M9 5l7 7-7 7',
  check: 'M5 12l5 5 9-10',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  pin: 'M12 21s-6-5.500-6-11a6 6 0 0 1 12 0c0 5.500-6 11-6 11zM12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  star: 'M12 3l2.700 5.600 6.100.9-4.400 4.300 1 6.100L12 17l-5.400 2.900 1-6.100L3.200 9.500l6.100-.9z',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  ticket: 'M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4zM14 6v12',
  share: 'M12 4v11m0-11L8 8m4-4l4 4M5 13v6a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-6',
}
function Icon({ name, size = 22, color = 'currentColor', w = 1.9, fill = 'none' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  )
}

function StatusBar({ frame }) {
  const clock = new Date().toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' })
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20, height: 54, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 30px 0 36px', fontSize: 16, fontWeight: 600, color: INK, pointerEvents: 'none' }}>
      <span>{clock}</span>
      {frame && <span style={{ position: 'absolute', left: '50%', top: 11, width: 122, height: 35, marginLeft: -61, borderRadius: 20, background: '#000' }} />}
      <svg width="44" height="12" viewBox="0 0 44 12" aria-hidden="true">
        <g fill={INK}>
          <rect x="0" y="7" width="3" height="4" rx="1" />
          <rect x="5" y="5" width="3" height="6" rx="1" />
          <rect x="10" y="2.5" width="3" height="8.5" rx="1" />
          <rect x="15" y="0" width="3" height="11" rx="1" />
        </g>
        <rect x="21.5" y="0.5" width="22" height="11" rx="3.5" fill="none" stroke={INK} opacity=".45" />
        <rect x="23.5" y="2.5" width="16" height="7" rx="2" fill={INK} />
      </svg>
    </div>
  )
}

// ------------------------------------------------------------ generated posters

function Poster({ m, width = 200 }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const g = `pg${uid}`
  const words = m.title.toUpperCase().split(' ')
  const cut = words.length > 2 ? Math.ceil(words.length / 2) : words.length > 1 ? 1 : 1
  const lines = words.length > 1 ? [words.slice(0, cut).join(' '), words.slice(cut).join(' ')] : [words[0]]
  let art = null
  if (m.id === 'neon')
    art = (
      <g>
        <circle cx="100" cy="130" r="56" fill={`url(#${g}s)`} />
        {[112, 124, 136, 148, 160].map((y, i) => <rect key={y} x="30" y={y} width="140" height={2 + i * 1.6} fill={m.a} />)}
        {[0, 1, 2].map((i) => <path key={i} d={`M0 ${196 + i * 14} Q50 ${186 + i * 14} 100 ${196 + i * 14} T200 ${196 + i * 14}`} fill="none" stroke="#7dd3fc" strokeOpacity={0.7 - i * 0.2} strokeWidth="2" />)}
      </g>
    )
  else if (m.id === 'light')
    art = (
      <g>
        <polygon points="100,70 200,20 200,120" fill="#fef3c7" fillOpacity=".22" />
        <polygon points="100,70 0,40 0,110" fill="#fef3c7" fillOpacity=".12" />
        <path d="M88 200 L94 90 H106 L112 200 Z" fill="#f5efe6" />
        <path d="M91 150 H109 L108 168 H92 Z M93 112 H107 L106 128 H94 Z" fill="#c9304f" />
        <rect x="92" y="76" width="16" height="14" fill="#fde68a" />
        <path d="M0 214 Q40 196 80 206 L120 206 Q170 190 200 212 V240 H0 Z" fill="#07262e" />
        <path d="M0 232 Q50 220 100 232 T200 230" fill="none" stroke="#5eead4" strokeOpacity=".5" strokeWidth="2" />
      </g>
    )
  else if (m.id === 'paper')
    art = (
      <g>
        {[[40, 60, 4], [160, 90, 3], [70, 190, 3], [150, 40, 2.500]].map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} fill="#fff" fillOpacity=".8" />)}
        <circle cx="76" cy="126" r="34" fill="#7c3aed" />
        <ellipse cx="76" cy="126" rx="52" ry="10" fill="none" stroke="#fff" strokeWidth="4" transform="rotate(-18 76 126)" />
        <circle cx="140" cy="94" r="18" fill="#22c1c3" />
        <circle cx="132" cy="170" r="12" fill="#fff" />
        <polygon points="40,206 118,176 92,214 82,200" fill="#fff" />
        <polygon points="82,200 92,214 88,204" fill="#d6d3d1" />
      </g>
    )
  else if (m.id === 'dust')
    art = (
      <g>
        <circle cx="140" cy="100" r="34" fill="#ffd166" />
        <polygon points="0,200 40,130 70,170 110,110 160,180 200,140 200,240 0,240" fill="#2a0d04" />
        <polygon points="0,220 50,170 90,206 140,160 200,214 200,240 0,240" fill="#7a2a0a" />
        <polygon points="96,40 76,112 98,106 84,168 128,90 104,96 120,40" fill="#fff6c8" />
      </g>
    )
  else if (m.id === 'velvet')
    art = (
      <g>
        <circle cx="100" cy="96" r="44" fill="#fde1e8" />
        <circle cx="116" cy="88" r="40" fill={m.a} />
        {[[30, 40], [168, 60], [150, 150], [44, 150], [176, 120]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="1.800" fill="#fff" />)}
        <circle cx="72" cy="168" r="10" fill="#14040a" />
        <path d="M58 214 Q58 180 72 180 Q86 180 86 214 Z" fill="#14040a" />
        <circle cx="130" cy="164" r="10" fill="#14040a" />
        <path d="M116 214 Q116 176 130 176 Q144 176 144 214 Z" fill="#14040a" />
      </g>
    )
  else
    art = (
      <g>
        <circle cx="146" cy="56" r="20" fill="#d9f99d" fillOpacity=".85" />
        {[[30, 190, 1], [64, 200, 1.200], [100, 196, 1.500], [140, 202, 1.100], [176, 192, 1.300]].map(([x, y, s], i) => (
          <g key={i} transform={`translate(${x} ${y}) scale(${s})`}>
            <polygon points="0,-90 18,-50 -18,-50" fill="#05150e" />
            <polygon points="0,-70 24,-24 -24,-24" fill="#07200f" />
            <polygon points="0,-46 30,0 -30,0" fill="#0a2d18" />
          </g>
        ))}
        <rect x="0" y="150" width="200" height="40" fill="#bbf7d0" fillOpacity=".08" />
        <circle cx="84" cy="150" r="2" fill="#fde047" />
        <circle cx="94" cy="150" r="2" fill="#fde047" />
      </g>
    )
  return (
    <svg viewBox="0 0 200 300" width={width} height={(width * 3) / 2} role="img" aria-label={`${m.title} poster`} style={{ display: 'block', borderRadius: 14 }}>
      <defs>
        <linearGradient id={g} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={m.a} />
          <stop offset="1" stopColor={m.b} />
        </linearGradient>
        <linearGradient id={`${g}s`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fde047" />
          <stop offset="1" stopColor="#ff3d81" />
        </linearGradient>
        <linearGradient id={`${g}f`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity=".75" />
        </linearGradient>
      </defs>
      <rect width="200" height="300" fill={`url(#${g})`} />
      {art}
      <rect y="170" width="200" height="130" fill={`url(#${g}f)`} />
      <g fontFamily="system-ui, sans-serif" fill="#fff" textAnchor="middle" fontWeight="900">
        {lines.map((l, i) => <text key={i} x="100" y={258 - (lines.length - 1 - i) * 24 + (lines.length > 1 ? 0 : 12)} fontSize={l.length > 9 ? 21 : 26} letterSpacing="1.500">{l}</text>)}
        <text x="100" y="286" fontSize="8" fontWeight="600" letterSpacing="3" fillOpacity=".7">{m.tags[0].toUpperCase()}</text>
      </g>
    </svg>
  )
}

function SnackArt({ id }) {
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" aria-hidden="true">
      {id === 'pop' && (
        <g>
          {[[12, 12], [20, 8], [28, 12], [16, 16], [24, 16], [32, 17], [10, 18]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="5" fill="#fde68a" />)}
          <path d="M9 19 H35 L32 40 H12 Z" fill="#ef4444" />
          <path d="M16 19 L17 40 M22 19 V40 M28 19 L27 40" stroke="#fff" strokeWidth="3" />
        </g>
      )}
      {id === 'soda' && (
        <g>
          <path d="M26 4 L24 14" stroke="#fff" strokeWidth="2.500" />
          <rect x="10" y="12" width="24" height="5" rx="2" fill="#fff" />
          <path d="M12 17 H32 L30 40 H14 Z" fill="#2563eb" />
          <rect x="13" y="24" width="18" height="7" fill="#fff" fillOpacity=".85" />
        </g>
      )}
      {id === 'nach' && (
        <g>
          <path d="M6 30 H38 L34 40 H10 Z" fill="#ef4444" />
          <polygon points="8,30 18,12 24,30" fill="#fbbf24" />
          <polygon points="18,30 28,8 34,30" fill="#f59e0b" />
          <polygon points="26,30 36,16 40,30" fill="#fbbf24" />
          <ellipse cx="22" cy="31" rx="14" ry="3" fill="#fb923c" />
        </g>
      )}
      {id === 'cand' && (
        <g>
          <path d="M4 22 L11 17 V27 Z M40 22 L33 17 V27 Z" fill="#f472b6" />
          <rect x="10" y="14" width="24" height="16" rx="6" fill="#ec4899" />
          <path d="M16 14 L14 30 M22 14 L20 30 M28 14 L26 30" stroke="#fff" strokeOpacity=".6" strokeWidth="2.500" />
        </g>
      )}
    </svg>
  )
}

// QR-style code from a seed string
function QrArt({ seed, size = 132, color = '#16101a' }) {
  const N = 25
  const r = rng(hash(seed))
  const finder = (x, y) => x < 8 && y < 8 ? [x, y] : x >= N - 8 && y < 8 ? [x - (N - 7), y] : x < 8 && y >= N - 8 ? [x, y - (N - 7)] : null
  let d = ''
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const f = finder(x, y)
      let on
      if (f) {
        const [fx, fy] = f
        on = fx >= 0 && fx <= 6 && fy >= 0 && fy <= 6 && (fx === 0 || fx === 6 || fy === 0 || fy === 6 || (fx >= 2 && fx <= 4 && fy >= 2 && fy <= 4))
      } else on = r() < 0.5
      if (on) d += `M${x} ${y}h1v1h-1z`
    }
  return (
    <svg viewBox={`-1 -1 ${N + 2} ${N + 2}`} width={size} height={size} role="img" aria-label="Ticket QR code" shapeRendering="crispEdges">
      <rect x="-1" y="-1" width={N + 2} height={N + 2} fill="#fff" />
      <path d={d} fill={color} />
    </svg>
  )
}

// ---------------------------------------------------------------- app

const initFor = (sc) => {
  const si = Math.max(0, ORDER.indexOf(sc))
  const m = MOVIES[0]
  const slot = si >= 1 ? { d: 0, s: 2 } : null
  const taken = takenFor(m.id, 0, 2)
  return {
    stack: sc === 'ticket' ? ['now', 'ticket'] : ORDER.slice(0, si + 1),
    slot,
    seats: si === 2 || si === 3 || si === 4 ? pickDefault(taken) : [],
    snacks: si >= 3 ? { pop: 1 } : {},
  }
}

export default function CinemaApp({ name = 'Marquee', accent = '#f5b942', startScreen = 'now', holdSeconds = 300, frame = true, style }) {
  const box = useRef()
  const toastTimer = useRef()
  const dragR = useRef(null)
  const wasDrag = useRef(false)
  const tearTimer = useRef()
  const first = useRef(initFor(startScreen))
  const [scale, setScale] = useState(1)
  const [stack, setStack] = useState(first.current.stack)
  const [dir, setDir] = useState(1)
  const [toast, setToast] = useState('')
  const [genre, setGenre] = useState('All')
  const [city, setCity] = useState(0)
  const [pos, setPos] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [slot, setSlot] = useState(first.current.slot) // { d, s }
  const [dayI, setDayI] = useState(0)
  const [seats, setSeats] = useState(first.current.seats)
  const [snacks, setSnacks] = useState(first.current.snacks)
  const [promo, setPromo] = useState('')
  const [promoOn, setPromoOn] = useState(false)
  const [pay, setPay] = useState('Card')
  const [left, setLeft] = useState(holdSeconds)
  const [holdKey, setHoldKey] = useState(0)
  const [booking, setBooking] = useState(null)
  const [torn, setTorn] = useState(false)
  const [tearing, setTearing] = useState(false)

  const list = MOVIES.filter((m) => genre === 'All' || m.tags.includes(genre))
  const idx = Math.max(0, Math.min(list.length - 1, Math.round(pos)))
  const movie = list[idx] || MOVIES[0]
  const days = dates()
  const top = stack[stack.length - 1]

  // booking for the ticket start screen
  useEffect(() => {
    const init = initFor(startScreen)
    setStack(init.stack)
    setSlot(init.slot)
    setSeats(init.seats)
    setSnacks(init.snacks)
    setTorn(false)
    setTearing(false)
    if (startScreen === 'ticket') {
      const m = MOVIES[0]
      setBooking(makeBooking(m, 0, { d: 0, s: 2 }, init.seats, { pop: 1 }, false))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  useEffect(() => () => (clearTimeout(toastTimer.current), clearTimeout(tearTimer.current)), [])

  // seat hold countdown while on Checkout
  useEffect(() => {
    if (top !== 'checkout') return undefined
    const end = Date.now() + holdSeconds * 1000
    setLeft(holdSeconds)
    const id = setInterval(() => {
      const l = Math.max(0, Math.ceil((end - Date.now()) / 1000))
      setLeft(l)
      if (l <= 0) clearInterval(id)
    }, 500)
    return () => clearInterval(id)
  }, [top, holdSeconds, holdKey])

  const say = (t) => {
    setToast(t)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 1900)
  }
  const push = (id) => (setDir(1), setStack((a) => [...a, id]))
  const pop = () => (setDir(-1), setStack((a) => (a.length > 1 ? a.slice(0, -1) : a)))
  const home = () => (setDir(-1), setStack(['now']), setTorn(false), setTearing(false))

  // --- carousel
  const STEP = 172
  const snap = (p) => setPos(Math.max(0, Math.min(list.length - 1, Math.round(p))))
  const down = (e) => {
    dragR.current = { x: e.clientX, p: pos, lx: e.clientX, lt: performance.now(), v: 0, cap: false, id: e.pointerId }
    wasDrag.current = false
  }
  const move = (e) => {
    const d = dragR.current
    if (!d) return
    const dx = e.clientX - d.x
    if (!d.cap && Math.abs(dx) > 6) {
      d.cap = true
      wasDrag.current = true
      setDragging(true)
      e.currentTarget.setPointerCapture?.(d.id)
    }
    if (d.cap) {
      const now = performance.now()
      d.v = (e.clientX - d.lx) / Math.max(1, now - d.lt)
      d.lx = e.clientX
      d.lt = now
      const raw = d.p - dx / STEP
      setPos(Math.max(-0.3, Math.min(list.length - 0.7, raw)))
    }
  }
  const up = () => {
    const d = dragR.current
    dragR.current = null
    if (!d || !d.cap) return
    setDragging(false)
    setPos((p) => Math.max(0, Math.min(list.length - 1, Math.round(p - d.v * 1.6))))
    setTimeout(() => (wasDrag.current = false), 0)
  }
  const tapPoster = (i) => {
    if (wasDrag.current) return
    if (i === idx) open(list[i])
    else snap(i)
  }
  const open = (m) => {
    setSlot(null)
    setSeats([])
    setDayI(0)
    push('movie')
    void m
  }

  // --- derived
  const slotInfo = slot ? SLOTS[slot.s] : null
  const taken = slot ? takenFor(movie.id, dayI, slot.s) : new Set()
  const seatPrice = (id) => (slotInfo ? slotInfo.p + (ROWS.indexOf(id[0]) >= PREMIUM_FROM ? PREMIUM_EXTRA : 0) : 0)
  const ticketsTotal = seats.reduce((s, id) => s + seatPrice(id), 0)
  const snackTotal = SNACKS.reduce((s, k) => s + (snacks[k.id] || 0) * k.price, 0)
  const discount = promoOn ? ticketsTotal * 0.1 : 0
  const feeTotal = seats.length * FEE
  const grand = ticketsTotal - discount + snackTotal + feeTotal

  function makeBooking(m, d, sl, st, sn, promoApplied) {
    const info = SLOTS[sl.s]
    const tk = st.reduce((s, id) => s + info.p + (ROWS.indexOf(id[0]) >= PREMIUM_FROM ? PREMIUM_EXTRA : 0), 0)
    const snk = SNACKS.reduce((s, k) => s + (sn[k.id] || 0) * k.price, 0)
    const total = tk * (promoApplied ? 0.9 : 1) + snk + st.length * FEE
    const day = dates()[d]
    return { movie: m, day, info, seats: st, total, code: `MQ-${hash(`${m.id}${d}${sl.s}${st.join()}`).toString(36).toUpperCase().slice(0, 6)}`, snacks: SNACKS.filter((k) => sn[k.id]).map((k) => `${sn[k.id]}x ${k.name}`) }
  }

  const toggleSeat = (id) => {
    if (taken.has(id)) return say('That seat is taken')
    setSeats((a) => (a.includes(id) ? a.filter((x) => x !== id) : a.length >= MAX_SEATS ? (say(`Up to ${MAX_SEATS} seats`), a) : [...a, id].sort()))
  }
  const bump = (id, d) => setSnacks((s) => ({ ...s, [id]: Math.max(0, Math.min(9, (s[id] || 0) + d)) }))
  const applyPromo = () => {
    if (promo.trim().toUpperCase() === 'FILM10') (setPromoOn(true), say('FILM10 applied: 10% off tickets'))
    else say('Code not recognised (try FILM10)')
  }
  const payNow = () => {
    setBooking(makeBooking(movie, dayI, slot, seats, snacks, promoOn))
    setTorn(false)
    setTearing(false)
    setDir(1)
    setStack(['now', 'ticket'])
  }
  const tear = () => {
    if (torn || tearing) return
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return setTorn(true)
    setTearing(true)
    tearTimer.current = setTimeout(() => (setTearing(false), setTorn(true)), 1000)
  }

  // ---- shared bits
  const header = (title, back = true, sub) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 18px 8px', minHeight: 52 }}>
      {back && (
        <button type="button" onClick={pop} aria-label="Back" style={{ display: 'grid', placeItems: 'center', width: 38, height: 38, borderRadius: '50%', border: 'none', background: SURF2, color: INK, cursor: 'pointer', padding: 0 }}>
          <Icon name="back" size={20} />
        </button>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <h1 style={{ margin: 0, fontSize: back ? 18 : 26, fontWeight: 800, letterSpacing: '-0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</h1>
        {sub && <div style={{ fontSize: 12, color: MUTED }}>{sub}</div>}
      </div>
    </div>
  )
  const steps = (n) => (
    <div style={{ display: 'flex', gap: 6, padding: '0 18px 10px' }} aria-label={`Step ${n} of 4`}>
      {[1, 2, 3, 4].map((i) => <span key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= n ? accent : LINE }} />)}
    </div>
  )
  const chip = (label, on, fn, key, dis) => (
    <button key={key || label} type="button" onClick={fn} disabled={dis} aria-pressed={on} style={{ flex: 'none', height: 34, padding: '0 14px', borderRadius: 17, border: `1.5px solid ${on ? accent : LINE}`, background: on ? accent : 'transparent', color: on ? '#1a0f10' : INK, font: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{label}</button>
  )
  const primary = (label, onClick, disabled) => (
    <button type="button" disabled={disabled} onClick={onClick} style={{ width: '100%', height: 52, borderRadius: 26, border: 'none', background: disabled ? SURF2 : accent, color: disabled ? MUTED : '#1a0f10', font: 'inherit', fontSize: 15, fontWeight: 800, cursor: disabled ? 'default' : 'pointer' }}>{label}</button>
  )
  const footBar = (children) => <div style={{ padding: '12px 18px 26px', background: '#1b0f1a', borderTop: `1px solid ${LINE}`, display: 'grid', gap: 8 }}>{children}</div>

  // ---- screens
  let main
  let foot = null
  if (top === 'ticket' && booking) {
    const b = booking
    const stubStyle = { position: 'relative', padding: '14px 20px 18px', background: '#fbf7f0', color: '#16101a', borderRadius: '0 0 22px 22px', transformOrigin: 'left top', animation: tearing ? 'cn-tear 1s ease-in forwards' : 'none', visibility: torn ? 'hidden' : 'visible' }
    main = (
      <div style={{ padding: '4px 30px 0' }}>
        <div style={{ textAlign: 'center', margin: '4px 0 14px' }}>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{torn ? 'Enjoy the show!' : 'You are going!'}</div>
          <div style={{ fontSize: 13, color: MUTED }}>{torn ? 'Stub torn and scanned at the door' : `Booking ${b.code}`}</div>
        </div>
        <div style={{ position: 'relative', filter: 'drop-shadow(0 18px 24px rgba(0,0,0,.45))', animation: tearing ? 'cn-jig .3s ease 2' : 'none' }}>
          <div style={{ display: 'flex', gap: 14, padding: 18, borderRadius: '22px 22px 0 0', background: `linear-gradient(140deg, ${b.movie.b}, ${b.movie.a})` }}>
            <Poster m={b.movie} width={92} />
            <div style={{ flex: 1, minWidth: 0, color: '#fff' }}>
              <div style={{ fontSize: 10.5, letterSpacing: '.18em', opacity: 0.75, fontWeight: 700 }}>ADMIT {b.seats.length}</div>
              <div style={{ fontSize: 19, fontWeight: 900, lineHeight: 1.15, margin: '3px 0 8px' }}>{b.movie.title}</div>
              <div style={{ fontSize: 12, lineHeight: 1.6, opacity: 0.92 }}>{b.day.label}, {b.day.sub}<br />{b.info.t} - {b.info.f}<br />{CITIES[city]} - Screen 4</div>
            </div>
          </div>
          <div style={{ display: 'flex', background: '#fbf7f0', color: '#16101a', padding: '12px 18px', justifyContent: 'space-between', fontSize: 12 }}>
            <span><span style={{ color: '#8a7a83', display: 'block', fontSize: 10, letterSpacing: '.1em' }}>SEATS</span><b style={{ fontSize: 15 }}>{b.seats.join(', ')}</b></span>
            <span style={{ textAlign: 'right' }}><span style={{ color: '#8a7a83', display: 'block', fontSize: 10, letterSpacing: '.1em' }}>PAID</span><b style={{ fontSize: 15 }}>{money(b.total)}</b></span>
          </div>
          {/* perforation: notches + dashed line */}
          <div aria-hidden="true" style={{ position: 'relative', height: 0 }}>
            <span style={{ position: 'absolute', left: -13, top: -13, width: 26, height: 26, borderRadius: '50%', background: BG }} />
            <span style={{ position: 'absolute', right: -13, top: -13, width: 26, height: 26, borderRadius: '50%', background: BG }} />
            <span style={{ position: 'absolute', left: 18, right: 18, top: -1, borderTop: '2px dashed #cbbfc6' }} />
          </div>
          <div style={stubStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingTop: 8 }}>
              <QrArt seed={b.code} size={118} />
              <div style={{ fontSize: 11.5, color: '#5b4a55', lineHeight: 1.55 }}>
                <b style={{ fontSize: 13, color: '#16101a' }}>{b.code}</b><br />Show this code at the door.<br />{b.snacks.length ? `Pick up: ${b.snacks.join(', ')}` : 'No snacks ordered'}
              </div>
            </div>
          </div>
          {torn && <div style={{ padding: '18px 20px', borderRadius: '0 0 22px 22px', background: '#fbf7f0', color: '#8a7a83', fontSize: 12, textAlign: 'center', marginTop: -86, height: 86, boxSizing: 'border-box', display: 'grid', placeItems: 'center', clipPath: 'polygon(0 0, 8% 14%, 17% 0, 27% 16%, 38% 0, 49% 14%, 60% 0, 71% 16%, 82% 0, 92% 14%, 100% 0, 100% 100%, 0 100%)' }}>Torn at the perforation</div>}
        </div>
      </div>
    )
    foot = footBar(
      <>
        {!torn ? primary(tearing ? 'Tearing...' : 'Tear off stub (at the door)', tear, tearing) : primary('Book another film', home)}
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={() => say('Added to your wallet')} style={{ flex: 1, height: 40, borderRadius: 20, border: `1px solid ${LINE}`, background: 'transparent', color: INK, font: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Add to wallet</button>
          <button type="button" onClick={() => say('Ticket link copied')} style={{ flex: 1, height: 40, borderRadius: 20, border: `1px solid ${LINE}`, background: 'transparent', color: INK, font: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Share</button>
        </div>
      </>
    )
  } else if (top === 'checkout') {
    const mm = String(Math.floor(left / 60)).padStart(2, '0')
    const ss = String(left % 60).padStart(2, '0')
    const expired = left <= 0
    main = (
      <>
        {header('Checkout', true, `${movie.title} - ${days[dayI].label} ${slotInfo.t}`)}
        {steps(4)}
        <div style={{ margin: '0 18px', padding: '12px 14px', borderRadius: 16, background: expired ? '#4a1620' : SURF, display: 'flex', alignItems: 'center', gap: 12 }}>
          <Icon name="clock" size={22} color={expired ? '#ff8a9a' : accent} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: MUTED }}>{expired ? 'Hold expired' : 'Seats held for'}</div>
            <div style={{ height: 4, borderRadius: 2, background: LINE, marginTop: 6, overflow: 'hidden' }}><div style={{ width: `${(left / holdSeconds) * 100}%`, height: '100%', background: left < 60 ? '#ff6b81' : accent, transition: 'width .5s linear' }} /></div>
          </div>
          <b style={{ fontSize: 22, fontVariantNumeric: 'tabular-nums', color: left < 60 ? '#ff8a9a' : INK }}>{mm}:{ss}</b>
        </div>
        <div style={{ margin: '12px 18px 0', display: 'flex', gap: 12, padding: 12, borderRadius: 18, background: SURF }}>
          <Poster m={movie} width={56} />
          <div style={{ fontSize: 13, lineHeight: 1.55 }}>
            <b style={{ fontSize: 15 }}>{movie.title}</b><br /><span style={{ color: MUTED }}>{days[dayI].label}, {days[dayI].sub} - {slotInfo.t} {slotInfo.f}</span><br />Seats <b>{seats.join(', ')}</b>
          </div>
        </div>
        <div style={{ padding: '16px 18px 8px', fontSize: 14, fontWeight: 800 }}>Add snacks</div>
        <div style={{ display: 'grid', gap: 8, padding: '0 18px' }}>
          {SNACKS.map((k) => (
            <div key={k.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', borderRadius: 16, background: SURF }}>
              <SnackArt id={k.id} />
              <span style={{ flex: 1 }}><span style={{ display: 'block', fontSize: 14, fontWeight: 700 }}>{k.name}</span><span style={{ display: 'block', fontSize: 11.5, color: MUTED }}>{k.note} - {money(k.price)}</span></span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button type="button" onClick={() => bump(k.id, -1)} disabled={!snacks[k.id]} aria-label={`Fewer ${k.name}`} style={{ width: 30, height: 30, borderRadius: '50%', border: `1px solid ${LINE}`, background: 'transparent', color: INK, display: 'grid', placeItems: 'center', cursor: 'pointer', padding: 0, opacity: snacks[k.id] ? 1 : 0.35 }}><Icon name="minus" size={16} /></button>
                <b style={{ width: 14, textAlign: 'center' }}>{snacks[k.id] || 0}</b>
                <button type="button" onClick={() => bump(k.id, 1)} aria-label={`More ${k.name}`} style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', background: accent, color: '#1a0f10', display: 'grid', placeItems: 'center', cursor: 'pointer', padding: 0 }}><Icon name="plus" size={16} w={2.4} /></button>
              </span>
            </div>
          ))}
        </div>
        <div style={{ padding: '16px 18px 8px', fontSize: 14, fontWeight: 800 }}>Promo code</div>
        <div style={{ display: 'flex', gap: 8, padding: '0 18px' }}>
          <input value={promo} onChange={(e) => setPromo(e.target.value)} placeholder="FILM10" aria-label="Promo code" style={{ flex: 1, height: 44, borderRadius: 14, border: `1.5px solid ${promoOn ? accent : LINE}`, background: SURF, color: INK, padding: '0 14px', font: 'inherit', fontSize: 14, minWidth: 0 }} />
          <button type="button" onClick={applyPromo} style={{ height: 44, padding: '0 18px', borderRadius: 14, border: 'none', background: SURF2, color: INK, font: 'inherit', fontWeight: 700, cursor: 'pointer' }}>{promoOn ? 'Applied' : 'Apply'}</button>
        </div>
        <div style={{ padding: '16px 18px 8px', fontSize: 14, fontWeight: 800 }}>Pay with</div>
        <div style={{ display: 'flex', gap: 8, padding: '0 18px' }}>{['Card', 'Apple Pay', 'Gift card'].map((p) => chip(p, pay === p, () => setPay(p)))}</div>
        <div style={{ margin: '16px 18px 0', padding: 14, borderRadius: 18, background: SURF, fontSize: 13.5 }}>
          {[[`Tickets (${seats.length})`, ticketsTotal], ...(promoOn ? [['Promo FILM10', -discount]] : []), ['Snacks', snackTotal], ['Booking fee', feeTotal]].map(([l, v]) => (
            <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', color: MUTED }}><span>{l}</span><span>{v < 0 ? '-' : ''}{money(Math.abs(v))}</span></div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0 0', marginTop: 6, borderTop: `1px solid ${LINE}`, fontSize: 18, fontWeight: 800 }}><span>Total</span><span style={{ color: accent }}>{money(grand)}</span></div>
        </div>
      </>
    )
    foot = footBar(expired ? primary('Hold expired - pick seats again', () => (setSeats([]), pop())) : primary(`Pay ${money(grand)} with ${pay}`, payNow, !seats.length))
  } else if (top === 'seats') {
    const SW = 376
    const x0 = 30
    const stepX = 24
    const aisle = 16
    const colX = (c) => x0 + c * stepX + (c >= GROUPS[0] ? aisle : 0) + (c >= GROUPS[0] + GROUPS[1] ? aisle : 0)
    main = (
      <>
        {header('Choose seats', true, `${movie.title} - ${days[dayI].label} ${slotInfo.t} ${slotInfo.f}`)}
        {steps(3)}
        <svg viewBox="0 0 376 70" width="100%" role="img" aria-label="Screen" style={{ display: 'block' }}>
          <defs>
            <linearGradient id="cn-glow" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={accent} stopOpacity=".45" />
              <stop offset="1" stopColor={accent} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M40 18 Q188 -6 336 18 L372 70 H4 Z" fill="url(#cn-glow)" />
          <path d="M40 18 Q188 -6 336 18" fill="none" stroke={accent} strokeWidth="4" strokeLinecap="round" style={{ filter: `drop-shadow(0 0 6px ${accent})` }} />
          <text x="188" y="44" textAnchor="middle" fontSize="10" letterSpacing="5" fill={MUTED}>SCREEN</text>
        </svg>
        <svg viewBox={`0 0 ${SW} ${ROWS.length * 28 + 6}`} width="100%" role="group" aria-label="Seat map" style={{ display: 'block' }}>
          {ROWS.map((row, r) => (
            <g key={row}>
              <text x="12" y={r * 28 + 20} fontSize="10" fill={MUTED} textAnchor="middle">{row}</text>
              <text x={SW - 12} y={r * 28 + 20} fontSize="10" fill={MUTED} textAnchor="middle">{row}</text>
              {COLS.map((c) => {
                const id = seatId(r, c)
                const isTaken = taken.has(id)
                const on = seats.includes(id)
                const prem = r >= PREMIUM_FROM
                return (
                  <rect key={id} x={colX(c)} y={r * 28 + 6} width="20" height="19" rx="6" role="checkbox" aria-checked={on} aria-label={`Seat ${id}${isTaken ? ' taken' : ''}${prem ? ' premium' : ''}`} tabIndex={isTaken ? -1 : 0} onClick={() => toggleSeat(id)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), toggleSeat(id))}
                    fill={isTaken ? '#2a1a27' : on ? accent : prem ? '#5a3a1e' : '#4c3347'} stroke={on ? '#fff' : prem && !isTaken ? accent : 'transparent'} strokeWidth={on ? 1.5 : 1} strokeOpacity={on ? 0.9 : 0.5} style={{ cursor: isTaken ? 'not-allowed' : 'pointer', transition: 'fill .15s' }} />
                )
              })}
            </g>
          ))}
        </svg>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, padding: '12px 18px 6px', fontSize: 11.5, color: MUTED, flexWrap: 'wrap' }}>
          {[['Available', '#4c3347'], ['Premium +$4', '#5a3a1e'], ['Selected', accent], ['Taken', '#2a1a27']].map(([l, c]) => (
            <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><i style={{ width: 14, height: 14, borderRadius: 5, background: c, border: l === 'Premium +$4' ? `1px solid ${accent}` : 'none' }} />{l}</span>
          ))}
        </div>
      </>
    )
    foot = footBar(
      <>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 13, color: MUTED }}>
          <span>{seats.length ? `${seats.length} seat${seats.length > 1 ? 's' : ''}: ${seats.join(', ')}` : 'Tap seats to select (max 6)'}</span>
          <b style={{ fontSize: 20, color: INK }}>{money(ticketsTotal)}</b>
        </div>
        {primary('Continue to checkout', () => push('checkout'), !seats.length)}
      </>
    )
  } else if (top === 'movie') {
    main = (
      <>
        {header(movie.title, true)}
        {steps(2)}
        <div style={{ display: 'flex', gap: 16, padding: '4px 18px 0' }}>
          <Poster m={movie} width={130} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{movie.tags.map((t) => <span key={t} style={{ padding: '3px 10px', borderRadius: 12, background: SURF2, fontSize: 11.5, fontWeight: 700 }}>{t}</span>)}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, margin: '12px 0 4px', fontSize: 15, fontWeight: 800 }}><Icon name="star" size={17} color={accent} fill={accent} w={1} /> {movie.score}<span style={{ color: MUTED, fontWeight: 500, fontSize: 12 }}> / 10</span></div>
            <div style={{ fontSize: 12.5, color: MUTED }}>{Math.floor(movie.mins / 60)}h {movie.mins % 60}m - {movie.rating}</div>
            <div style={{ fontSize: 12, color: MUTED, marginTop: 10, lineHeight: 1.5 }}>Cast<br /><span style={{ color: INK }}>{movie.cast.join(', ')}</span></div>
          </div>
        </div>
        <p style={{ margin: '14px 18px 4px', fontSize: 13.5, lineHeight: 1.55, color: '#d9c8d2' }}>{movie.blurb}</p>
        <div style={{ padding: '12px 18px 8px', fontSize: 14, fontWeight: 800 }}>Date</div>
        <div className="cn-scroll" style={{ display: 'flex', gap: 8, padding: '0 18px', overflowX: 'auto' }}>
          {days.map((d, i) => (
            <button key={d.sub} type="button" onClick={() => (setDayI(i), setSlot(null), setSeats([]))} aria-pressed={dayI === i} style={{ flex: 'none', width: 64, padding: '8px 0', borderRadius: 16, border: `1.5px solid ${dayI === i ? accent : LINE}`, background: dayI === i ? `${accent}22` : 'transparent', color: INK, font: 'inherit', cursor: 'pointer' }}>
              <span style={{ display: 'block', fontSize: 12, fontWeight: 800, color: dayI === i ? accent : INK }}>{d.label}</span>
              <span style={{ display: 'block', fontSize: 11, color: MUTED }}>{d.sub}</span>
            </button>
          ))}
        </div>
        <div style={{ padding: '14px 18px 8px', fontSize: 14, fontWeight: 800 }}>Showtimes - {CITIES[city]}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '0 18px' }}>
          {SLOTS.map((s, i) => {
            const full = takenFor(movie.id, dayI, i)
            const free = ROWS.length * 12 - full.size
            const on = slot && slot.s === i
            return (
              <button key={s.t} type="button" onClick={() => (setSlot({ d: dayI, s: i }), setSeats([]))} aria-pressed={on} style={{ width: 'calc(50% - 4px)', padding: '10px 12px', borderRadius: 16, border: `1.5px solid ${on ? accent : LINE}`, background: on ? accent : 'transparent', color: on ? '#1a0f10' : INK, font: 'inherit', cursor: 'pointer', textAlign: 'left' }}>
                <span style={{ display: 'block', fontSize: 17, fontWeight: 800 }}>{s.t}</span>
                <span style={{ display: 'block', fontSize: 11.5, opacity: 0.8 }}>{s.f} - {money(s.p)} - {free} left</span>
              </button>
            )
          })}
        </div>
      </>
    )
    foot = footBar(primary(slot ? `Select seats - ${slotInfo.t} ${slotInfo.f}` : 'Pick a showtime', () => push('seats'), !slot))
  } else {
    main = (
      <>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 18px 6px' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: MUTED, letterSpacing: '.14em', fontWeight: 700 }}>{name.toUpperCase()} CINEMAS</div>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em' }}>Now showing</h1>
          </div>
          <button type="button" onClick={() => setCity((c) => (c + 1) % CITIES.length)} aria-label="Change cinema" style={{ display: 'flex', alignItems: 'center', gap: 4, height: 34, padding: '0 12px', borderRadius: 17, border: `1px solid ${LINE}`, background: SURF, color: INK, font: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}><Icon name="pin" size={14} />{CITIES[city]}</button>
          <button type="button" onClick={() => (booking ? (setDir(1), setStack(['now', 'ticket'])) : say('No tickets yet - book a film'))} aria-label="My ticket" style={{ display: 'grid', placeItems: 'center', width: 38, height: 38, borderRadius: '50%', border: 'none', background: booking ? accent : SURF2, color: booking ? '#1a0f10' : INK, cursor: 'pointer', padding: 0 }}><Icon name="ticket" size={19} /></button>
        </div>
        <div className="cn-scroll" role="group" aria-label="Genre" style={{ display: 'flex', gap: 8, padding: '8px 18px 6px', overflowX: 'auto' }}>
          {GENRES.map((g) => chip(g, genre === g, () => (setGenre(g), setPos(0))))}
        </div>
        <div
          tabIndex={0}
          aria-roledescription="carousel"
          aria-label="Movie posters. Swipe or use arrow keys."
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          onKeyDown={(e) => (e.key === 'ArrowRight' ? snap(idx + 1) : e.key === 'ArrowLeft' ? snap(idx - 1) : e.key === 'Enter' ? open(movie) : null)}
          style={{ position: 'relative', height: 336, margin: '6px 0 0', touchAction: 'pan-y', cursor: dragging ? 'grabbing' : 'grab', outline: 'none', overflow: 'hidden' }}
        >
          {list.map((m, i) => {
            const d = i - pos
            const a = Math.min(1, Math.abs(d))
            const s = 1 - 0.28 * a
            return (
              <div key={m.id} onClick={() => tapPoster(i)} aria-label={m.title} style={{ position: 'absolute', left: '50%', top: 14, marginLeft: -100, width: 200, transform: `translateX(${d * STEP}px) scale(${s}) rotateY(${Math.max(-1, Math.min(1, d)) * -14}deg)`, transformOrigin: 'center', zIndex: 20 - Math.round(Math.abs(d) * 4), opacity: Math.max(0.35, 1 - 0.4 * Math.abs(d)), transition: dragging ? 'none' : 'transform .38s cubic-bezier(.2,.8,.2,1), opacity .3s', filter: `brightness(${1 - 0.35 * a})`, boxShadow: i === idx ? `0 24px 40px rgba(0,0,0,.55)` : 'none', borderRadius: 14, userSelect: 'none', pointerEvents: Math.abs(d) > 1.6 ? 'none' : 'auto' }}>
                <Poster m={m} />
              </div>
            )
          })}
          {!list.length && <div style={{ textAlign: 'center', color: MUTED, paddingTop: 120 }}>Nothing showing in {genre}.</div>}
        </div>
        {list.length > 0 && (
          <div style={{ textAlign: 'center', padding: '6px 24px 0' }}>
            <div key={movie.id} style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.01em', animation: 'cn-fade .3s ease' }}>{movie.title}</div>
            <div style={{ fontSize: 13, color: MUTED, marginTop: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6 }}>{movie.tags.join(' / ')} - {Math.floor(movie.mins / 60)}h {movie.mins % 60}m - <Icon name="star" size={13} color={accent} fill={accent} w={1} />{movie.score}</div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 7, margin: '12px 0 14px' }}>
              {list.map((m, i) => <button key={m.id} type="button" onClick={() => snap(i)} aria-label={`Show ${m.title}`} style={{ width: i === idx ? 22 : 8, height: 8, padding: 0, borderRadius: 4, border: 'none', background: i === idx ? accent : LINE, cursor: 'pointer', transition: 'width .25s' }} />)}
            </div>
          </div>
        )}
      </>
    )
    foot = footBar(primary(list.length ? `Get tickets - ${movie.title}` : 'Clear filter', list.length ? () => open(movie) : () => setGenre('All')))
  }

  const phone = (
    <div style={{ position: 'relative', width: W, height: H, overflow: 'hidden', borderRadius: frame ? 46 : 0, background: `radial-gradient(ellipse at 50% -10%, #3a1a38, ${BG} 55%)`, color: INK, fontFamily: "-apple-system, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif" }}>
      <style>{`
        @keyframes cn-r { from { opacity: 0; transform: translateX(34px) } to { opacity: 1; transform: none } }
        @keyframes cn-l { from { opacity: 0; transform: translateX(-34px) } to { opacity: 1; transform: none } }
        @keyframes cn-fade { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: none } }
        @keyframes cn-tear { 0% { transform: none; opacity: 1 } 25% { transform: rotate(2deg) translateY(4px) } 100% { transform: rotate(14deg) translate(30px, 260px); opacity: 0 } }
        @keyframes cn-jig { 0%, 100% { transform: none } 25% { transform: translateX(-3px) } 75% { transform: translateX(3px) } }
        .cn-scroll, .cn-main { scrollbar-width: none } .cn-scroll::-webkit-scrollbar, .cn-main::-webkit-scrollbar { display: none }
        .cn-app button:focus-visible, .cn-app input:focus-visible, .cn-app [tabindex]:focus-visible { outline: 2px solid ${accent}; outline-offset: 2px }
        .cn-app input::placeholder { color: #7a6473 }
        @media (prefers-reduced-motion: reduce) { .cn-app * { animation: none !important; transition: none !important } }
      `}</style>
      <StatusBar frame={frame} />
      <div key={top} style={{ position: 'absolute', top: 54, bottom: 0, left: 0, right: 0, display: 'flex', flexDirection: 'column', animation: `${dir > 0 ? 'cn-r' : 'cn-l'} .28s ease` }}>
        <div className="cn-main" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', paddingBottom: 12 }}>{main}</div>
        {foot}
      </div>
      {top === 'checkout' && left <= 0 && (
        <div role="alertdialog" aria-label="Seat hold expired" style={{ position: 'absolute', inset: 0, zIndex: 40, background: 'rgba(10,4,9,.7)', display: 'grid', placeItems: 'center' }}>
          <div style={{ width: 290, padding: 24, borderRadius: 26, background: SURF, textAlign: 'center' }}>
            <div style={{ fontSize: 40 }} aria-hidden="true">&#9203;</div>
            <div style={{ fontSize: 20, fontWeight: 800, margin: '6px 0' }}>Your hold ran out</div>
            <div style={{ fontSize: 13.5, color: MUTED, marginBottom: 16 }}>Seats {seats.join(', ')} were released. Hold them again for another {Math.round(holdSeconds / 60)} minutes?</div>
            <div style={{ display: 'grid', gap: 8 }}>
              {primary('Hold again', () => setHoldKey((k) => k + 1))}
              <button type="button" onClick={() => (setSeats([]), pop())} style={{ height: 42, border: 'none', background: 'none', color: MUTED, font: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Choose different seats</button>
            </div>
          </div>
        </div>
      )}
      <div role="status" style={{ position: 'absolute', left: '50%', top: 58, zIndex: 60, transform: `translate(-50%, ${toast ? 0 : -90}px)`, transition: 'transform .35s cubic-bezier(.2,.8,.2,1)', padding: '10px 16px', borderRadius: 20, background: accent, color: '#1a0f10', fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap' }}>{toast}</div>
      <div style={{ position: 'absolute', left: '50%', bottom: 8, width: 140, height: 5, marginLeft: -70, borderRadius: 3, background: INK, opacity: 0.7, zIndex: 55, pointerEvents: 'none' }} />
    </div>
  )

  return (
    <div ref={box} className="cn-app" style={{ position: 'relative', width: '100%', height: '100%', display: 'grid', placeItems: 'center', overflow: 'hidden', background: 'radial-gradient(ellipse at 50% 30%, #3b1f3a, #0b050a 80%)', ...style }}>
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: `translate(-50%, -50%) scale(${scale})`, transformOrigin: 'center' }}>
        {frame ? (
          <div style={{ padding: 12, borderRadius: 58, background: 'linear-gradient(145deg, #4a3a47, #120a10 40%, #2e2029)', boxShadow: '0 40px 80px rgba(0,0,0,.55), inset 0 0 0 2px #5a4857' }}>
            <div style={{ padding: 2, borderRadius: 48, background: '#000' }}>{phone}</div>
          </div>
        ) : (
          phone
        )}
      </div>
    </div>
  )
}
