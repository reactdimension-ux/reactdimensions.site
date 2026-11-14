import { useEffect, useRef, useState } from 'react'

// A hotel booking app on a phone, as a click-through prototype. Search takes a
// destination, dates and guests; Results shows only the stays that are free on
// those dates and fit the party, with sorting and filter chips and a heart on
// every card; a hotel opens its detail (tap the photo for more views, pick a
// room, see the price add up) and Book puts it in Trips. Dates and guests is a
// real calendar plus counters, reachable from Search, Results and the detail.
// Trips lists bookings you can expand and cancel; Saved holds your hearts.
// Detail screens slide in from the right. The phone scales to fit its box.

const W = 390 // the phone screen, in CSS px (an iPhone's width)
const H = 844
const BG = '#faf6ef'
const INK = '#1d2a2c'
const MUTED = '#7c8786'
const LINE = '#ece5d8'
const WARM = '#d9703c'
const DAY = 86400000

const TODAY = (() => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
})()
const dateOf = (off) => {
  const d = new Date(TODAY)
  d.setDate(d.getDate() + off)
  return d
}
const fmt = (off, o = { weekday: 'short', day: 'numeric', month: 'short' }) => dateOf(off).toLocaleDateString('en-GB', o)
const range = (a, b) => (a == null || b == null ? 'Pick dates' : `${fmt(a, { day: 'numeric', month: 'short' })} – ${fmt(b, { day: 'numeric', month: 'short' })}`)
const usd = (n) => `$${Math.round(n).toLocaleString('en-US')}`

const CITIES = ['Lisbon', 'Kyoto', 'New York', 'Bali']

const ROOMS = [
  { name: 'Classic room', add: 0, desc: 'Queen bed · 24 m²' },
  { name: 'Deluxe with view', add: 38, desc: 'King bed · 32 m² · balcony' },
  { name: 'Suite', add: 94, desc: 'King bed · 48 m² · lounge' },
]

const HOTELS = [
  { id: 'h1', name: 'Casa do Tejo', city: 'Lisbon', kind: 'city', stars: 4, rating: 9.1, reviews: 1284, price: 168, cap: 3, amen: ['breakfast', 'wifi', 'gym'], cancel: true, blackout: [[12, 15]], blurb: 'A restored townhouse above the river, five minutes from Alfama on foot.' },
  { id: 'h2', name: 'Miradouro Palace', city: 'Lisbon', kind: 'city', stars: 5, rating: 9.4, reviews: 862, price: 289, cap: 2, amen: ['pool', 'spa', 'breakfast', 'wifi'], cancel: false, blackout: [[6, 9]], blurb: 'Rooftop pool and a spa under the old city roofs. Dinner on the terrace at sunset.' },
  { id: 'h3', name: 'Kamo River Ryokan', city: 'Kyoto', kind: 'ryokan', stars: 4, rating: 9.3, reviews: 540, price: 214, cap: 3, amen: ['breakfast', 'spa', 'wifi'], cancel: true, blackout: [[9, 12]], blurb: 'Tatami rooms, an onsen bath and kaiseki breakfast beside the Kamo river.' },
  { id: 'h4', name: 'Gion Garden Inn', city: 'Kyoto', kind: 'ryokan', stars: 3, rating: 8.6, reviews: 731, price: 119, cap: 2, amen: ['wifi', 'pets'], cancel: true, blackout: [], blurb: 'Quiet lanes, paper lanterns and a small garden courtyard in the heart of Gion.' },
  { id: 'h5', name: 'The Hudson Line', city: 'New York', kind: 'city', stars: 4, rating: 8.8, reviews: 2210, price: 246, cap: 4, amen: ['gym', 'wifi', 'pets'], cancel: true, blackout: [[8, 11]], blurb: 'Loft-style rooms with big windows, two blocks from the High Line.' },
  { id: 'h6', name: 'Parkside Grand', city: 'New York', kind: 'city', stars: 5, rating: 9.2, reviews: 1655, price: 392, cap: 3, amen: ['pool', 'spa', 'gym', 'breakfast', 'wifi'], cancel: false, blackout: [], blurb: 'Classic address on the park with a marble lobby and an indoor pool.' },
  { id: 'h7', name: 'Ubud Canopy Villas', city: 'Bali', kind: 'beach', stars: 5, rating: 9.5, reviews: 418, price: 203, cap: 3, amen: ['pool', 'spa', 'breakfast', 'wifi'], cancel: true, blackout: [[14, 18]], blurb: 'Private villas in the rice terraces, each with its own plunge pool.' },
  { id: 'h8', name: 'Seminyak Surf House', city: 'Bali', kind: 'beach', stars: 3, rating: 8.4, reviews: 956, price: 88, cap: 4, amen: ['pool', 'wifi', 'pets'], cancel: true, blackout: [], blurb: 'Relaxed beach hostel-style stay, a short walk to the surf break.' },
]

const AMEN = { pool: 'Pool', breakfast: 'Breakfast', wifi: 'Wi-Fi', spa: 'Spa', gym: 'Gym', pets: 'Pets OK' }

const ICONS = {
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  heart: 'M12 20s-7-4.4-9-9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c-2 4.6-9 9-9 9z',
  trip: 'M5 8h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1zM9 8V5h6v3M4 13h16',
  back: 'M15 5l-7 7 7 7',
  chev: 'M9 5l7 7-7 7',
  pin: 'M12 21s-6-5.5-6-10a6 6 0 0 1 12 0c0 4.5-6 10-6 10zM12 13a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  cal: 'M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zM4 10h16M8 3v4M16 3v4',
  users: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14a6 6 0 0 1 3.5 6',
  star: 'M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-3-5.4 3 1.1-6L3.2 9.4l6.1-.8z',
  check: 'M5 12l5 5 9-10',
  x: 'M6 6l12 12M18 6L6 18',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  pool: 'M3 17c2 0 2 1.5 4.500 1.500S10 17 12 17s2.500 1.500 5 1.500S19 17 21 17M8 14V6a2 2 0 0 1 4 0M16 14V6a2 2 0 0 0-4 0M8 9h8',
  breakfast: 'M5 9h11v5a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4zM16 10h2a2 2 0 0 1 0 4h-2',
  wifi: 'M3 9a14 14 0 0 1 18 0M6 12.500a9 9 0 0 1 12 0M9 16a4.500 4.500 0 0 1 6 0M12 19.500h.01',
  spa: 'M12 20c-4 0-7-3-7-7 4 0 7 3 7 7zm0 0c4 0 7-3 7-7-4 0-7 3-7 7zM12 14c-2-2-2-6 0-9 2 3 2 7 0 9z',
  gym: 'M3 9v6M6 7v10M18 7v10M21 9v6M6 12h12',
  pets: 'M7 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM11 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM14 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM12 20c-3 0-5-1.500-4-4 1-2 2-3 4-3s3 1 4 3c1 2.500-1 4-4 4z',
  tune: 'M4 7h10M18 7h2M4 17h2M10 17h10M16 4v6M8 14v6',
  bell: 'M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4',
}

function Icon({ name, size = 22, color = 'currentColor', w = 1.9, fill = 'none' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  )
}

const SKIES = [
  ['#a9dbf0', '#fdf0d2'],
  ['#5f6bb0', '#f6a97a'],
  ['#0f1c3f', '#44498f'],
]

// a little illustrated scene per hotel; three variants (day, dusk, night)
function HotelArt({ h, v = 0, height = 150, radius = 0 }) {
  const [a, b] = SKIES[v % 3]
  const night = v % 3 === 2
  const gid = `ht-${h.id}-${v % 3}`
  const wall = night ? '#232c52' : `hsl(${(h.id.charCodeAt(1) * 37) % 360} 28% 82%)`
  const win = night ? '#ffd36b' : '#ffffffaa'
  return (
    <svg viewBox="0 0 400 240" width="100%" height={height} preserveAspectRatio="xMidYMid slice" role="img" aria-label={`${h.name} illustration`} style={{ display: 'block', borderRadius: radius }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={a} />
          <stop offset="1" stopColor={b} />
        </linearGradient>
      </defs>
      <rect width="400" height="240" fill={`url(#${gid})`} />
      <circle cx={v % 3 === 1 ? 300 : 80} cy={v % 3 === 1 ? 150 : 56} r="26" fill={night ? '#f3efe0' : '#fff6cc'} opacity={night ? 0.95 : 0.9} />
      {night && [30, 120, 200, 260, 350, 170].map((x, i) => <circle key={x} cx={x} cy={20 + ((i * 29) % 70)} r="1.6" fill="#fff" />)}
      {h.kind === 'city' && (
        <g>
          {[[10, 110, 60], [64, 80, 56], [214, 96, 64], [284, 70, 54], [336, 120, 60]].map(([x, y, w], i) => (
            <g key={i}>
              <rect x={x} y={y} width={w} height={240 - y} fill={night ? '#1a2244' : `hsl(${220 + i * 8} 14% ${70 - i * 3}%)`} />
              {Array.from({ length: Math.floor((240 - y) / 22) }).map((_, r) => <rect key={r} x={x + 10} y={y + 10 + r * 22} width={w - 20} height="8" rx="2" fill={win} opacity={(r + i) % 3 ? 0.85 : 0.25} />)}
            </g>
          ))}
          <rect x="120" y="70" width="104" height="170" fill={wall} />
          <rect x="120" y="62" width="104" height="10" fill={night ? '#3a4678' : '#8e8a7c'} />
          {[0, 1, 2, 3, 4, 5].map((r) => [0, 1, 2].map((c) => <rect key={`${r}${c}`} x={132 + c * 30} y={84 + r * 24} width="18" height="12" rx="2" fill={win} opacity={(r * 3 + c) % 4 ? 0.9 : 0.35} />))}
          <rect x="160" y="208" width="24" height="32" rx="3" fill={night ? '#ffd36b' : '#6b5b4a'} />
        </g>
      )}
      {h.kind === 'beach' && (
        <g>
          <rect y="150" width="400" height="90" fill={night ? '#142a56' : '#2aa7b8'} />
          {[0, 1, 2, 3].map((i) => <path key={i} d={`M0 ${166 + i * 18} q25 -8 50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0`} fill="none" stroke="#fff" opacity=".35" strokeWidth="2" />)}
          <path d="M0 200 q120 -34 240 -6 t160 0 V240 H0z" fill={night ? '#3a3a52' : '#f2d9a6'} />
          <rect x="200" y="132" width="130" height="56" fill={wall} />
          <path d="M190 134 L265 100 L340 134z" fill={night ? '#4a3a42' : '#b8693d'} />
          <rect x="224" y="150" width="22" height="38" fill={win} /><rect x="276" y="150" width="30" height="22" fill={win} />
          <path d="M70 215 q4 -60 -2 -86" stroke="#6b4a2e" strokeWidth="5" fill="none" strokeLinecap="round" />
          {[[-34, -6], [-24, -22], [4, -26], [30, -12], [26, 6]].map(([dx, dy], i) => <path key={i} d={`M68 129 q${dx / 2} ${dy - 12} ${dx} ${dy + 8}`} stroke={night ? '#1f6f55' : '#2f9a5a'} strokeWidth="6" fill="none" strokeLinecap="round" />)}
        </g>
      )}
      {h.kind === 'ryokan' && (
        <g>
          <path d="M0 150 q60 -50 120 -10 t140 -20 t140 20 V240 H0z" fill={night ? '#162548' : '#8bb89a'} opacity=".7" />
          <rect x="0" y="190" width="400" height="50" fill={night ? '#1d2a3f' : '#7a9a78'} />
          <rect x="70" y="130" width="260" height="60" fill={night ? '#3a2f3a' : '#e8dcc2'} />
          <path d="M44 134 Q200 86 356 134 L340 144 Q200 104 60 144z" fill={night ? '#252036' : '#5a4636'} />
          {[0, 1, 2, 3, 4].map((i) => <rect key={i} x={86 + i * 48} y="148" width="36" height="42" fill={night ? '#ffcf70' : '#f9f3df'} stroke={night ? '#3a2f3a' : '#b9a67e'} strokeWidth="2" />)}
          {[352, 366, 380].map((x, i) => <rect key={x} x={x} y={120 + i * 4} width="5" height={70 - i * 4} fill={night ? '#2d6a4e' : '#4f9a64'} rx="2" />)}
          <ellipse cx="42" cy="206" rx="22" ry="6" fill="#fff" opacity=".18" />
        </g>
      )}
      {h.kind === 'mountain' && (
        <g>
          <path d="M0 200 L90 90 L160 170 L240 70 L340 190 L400 140 V240 H0z" fill={night ? '#26325e' : '#8aa6b8'} />
          <rect x="140" y="170" width="120" height="50" fill={wall} /><path d="M130 172 L200 136 L270 172z" fill="#7a4a3a" />
        </g>
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
          <rect x="0.5" y="0.5" width="22" height="11" rx="3.5" fill="none" stroke={INK} opacity=".45" />
          <rect x="2.5" y="2.5" width="16" height="7" rx="2" fill={INK} />
          <rect x="23.5" y="4" width="2" height="4" rx="1" fill={INK} opacity=".45" />
        </svg>
      </span>
    </div>
  )
}

const iconBtn = { display: 'grid', placeItems: 'center', border: 'none', borderRadius: '50%', cursor: 'pointer', padding: 0, background: '#fff', color: INK, boxShadow: '0 2px 8px rgba(60,40,10,.1)' }

const NAV = [
  ['search', 'search', 'Search'],
  ['saved', 'heart', 'Saved'],
  ['trips', 'trip', 'Trips'],
]

const nightsOf = (a, b) => (a == null || b == null ? 0 : b - a)
const free = (h, a, b) => !h.blackout.some(([s, e]) => a < e && b > s)

// ---------------------------------------------------------------- app

export default function HotelApp({ name = 'Wayfarer', accent = '#0f766e', startScreen = 'search', frame = true, style }) {
  const box = useRef()
  const toastTimer = useRef()
  const [scale, setScale] = useState(1)
  const [tab, setTab] = useState('search')
  const [stack, setStack] = useState([])
  const [dir, setDir] = useState(1)
  const [toast, setToast] = useState('')
  const [q, setQ] = useState({ city: 'Lisbon', inn: 7, out: 10, adults: 2, kids: 0, rooms: 1 })
  const [sort, setSort] = useState('rec')
  const [filt, setFilt] = useState({})
  const [saved, setSaved] = useState({ h3: true })
  const [roomIx, setRoomIx] = useState(0)
  const [view, setView] = useState(0)
  const [openTrip, setOpenTrip] = useState(null)
  const [askCancel, setAskCancel] = useState(null)
  const [trips, setTrips] = useState(() => [
    { id: 't1', hid: 'h3', inn: 40, out: 44, adults: 2, kids: 0, rooms: 1, room: 1, total: 1031, code: 'WF7K2Q', status: 'Confirmed' },
    { id: 't0', hid: 'h5', inn: -30, out: -27, adults: 2, kids: 0, rooms: 1, room: 0, total: 827, code: 'WF3M9D', status: 'Completed' },
  ])

  useEffect(() => {
    setDir(1)
    setStack(startScreen === 'results' ? [{ id: 'results' }] : startScreen === 'detail' ? [{ id: 'results' }, { id: 'detail', hid: 'h1' }] : startScreen === 'dates' ? [{ id: 'dates' }] : [])
    setTab(startScreen === 'trips' ? 'trips' : 'search')
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
    toastTimer.current = setTimeout(() => setToast(''), 1900)
  }
  useEffect(() => () => clearTimeout(toastTimer.current), [])

  const top = stack[stack.length - 1]
  const push = (s) => (setDir(1), setStack((a) => [...a, s]))
  const pop = () => (setDir(-1), setStack((a) => a.slice(0, -1)))
  const go = (t) => (setDir(NAV.findIndex((n) => n[0] === t) > NAV.findIndex((n) => n[0] === tab) ? 1 : -1), setTab(t), setStack([]))
  const openHotel = (hid) => (setRoomIx(0), setView(0), push({ id: 'detail', hid }))

  const nights = nightsOf(q.inn, q.out)
  const guests = q.adults + q.kids
  const fits = (h) => h.cap * q.rooms >= guests && (q.inn == null || q.out == null || free(h, q.inn, q.out))
  const cityHotels = HOTELS.filter((h) => !q.city || h.city === q.city)
  const priced = (h, r = 0) => (h.price + ROOMS[r].add) * Math.max(1, nights) * q.rooms
  const total = (h, r = 0) => priced(h, r) * 1.12

  const book = (h) => {
    const t = { id: `t${Date.now()}`, hid: h.id, inn: q.inn, out: q.out, adults: q.adults, kids: q.kids, rooms: q.rooms, room: roomIx, total: total(h, roomIx), code: `WF${Math.random().toString(36).slice(2, 6).toUpperCase()}${Math.floor(Math.random() * 9)}`, status: 'Confirmed' }
    setTrips((a) => [t, ...a])
    setOpenTrip(t.id)
    setDir(1)
    setStack([{ id: 'booked', trip: t }])
  }

  // ---- shared bits
  const header = (title, back, right) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px 6px', minHeight: 48 }}>
      {back && (
        <button type="button" onClick={back} aria-label="Back" style={{ ...iconBtn, width: 38, height: 38 }}>
          <Icon name="back" size={20} />
        </button>
      )}
      <h1 style={{ margin: 0, flex: 1, fontSize: back ? 18 : 28, fontWeight: 800, fontFamily: 'Georgia, serif', letterSpacing: '-0.01em', marginLeft: 4 }}>{title}</h1>
      {right}
    </div>
  )

  const primary = (label, onClick, disabled) => (
    <button type="button" disabled={disabled} onClick={onClick} style={{ width: '100%', height: 52, borderRadius: 16, border: 'none', background: disabled ? '#cfc8ba' : accent, color: '#fff', font: 'inherit', fontSize: 15, fontWeight: 700, cursor: disabled ? 'default' : 'pointer' }}>{label}</button>
  )

  const heart = (h, size = 36) => (
    <button type="button" aria-label={saved[h.id] ? `Remove ${h.name} from saved` : `Save ${h.name}`} aria-pressed={!!saved[h.id]} onClick={(e) => { e.stopPropagation(); setSaved((s) => ({ ...s, [h.id]: !s[h.id] })); say(saved[h.id] ? 'Removed from Saved' : 'Saved') }} style={{ ...iconBtn, width: size, height: size, background: 'rgba(255,255,255,.92)', color: saved[h.id] ? '#e0475b' : INK }}>
      <Icon name="heart" size={size * 0.52} fill={saved[h.id] ? '#e0475b' : 'none'} />
    </button>
  )

  const chip = (label, on, fn, key) => (
    <button key={key || label} type="button" onClick={fn} aria-pressed={on} style={{ flex: 'none', height: 34, padding: '0 14px', borderRadius: 17, border: `1px solid ${on ? accent : LINE}`, background: on ? accent : '#fff', color: on ? '#fff' : INK, font: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{label}</button>
  )

  const hotelCard = (h) => {
    const t = total(h)
    return (
      <div key={h.id} style={{ position: 'relative' }}>
        <button type="button" onClick={() => openHotel(h.id)} style={{ display: 'block', width: '100%', padding: 0, border: 'none', borderRadius: 22, background: '#fff', font: 'inherit', textAlign: 'left', cursor: 'pointer', color: INK, overflow: 'hidden', boxShadow: '0 6px 18px rgba(80,60,20,.09)' }}>
          <HotelArt h={h} height={150} />
          <div style={{ padding: '12px 14px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: 16.5, fontWeight: 800, fontFamily: 'Georgia, serif' }}>{h.name}</span>
              <span style={{ flex: 'none', padding: '2px 8px', borderRadius: 8, background: accent, color: '#fff', fontSize: 12.5, fontWeight: 800, height: 22, lineHeight: '22px' }}>{h.rating}</span>
            </div>
            <div style={{ fontSize: 12.5, color: MUTED, marginTop: 2 }}>{h.city} · {'★'.repeat(h.stars)} · {h.reviews.toLocaleString()} reviews</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 10 }}>
              <span style={{ display: 'flex', gap: 8, color: accent }}>{h.amen.slice(0, 4).map((a) => <Icon key={a} name={a} size={17} />)}</span>
              <span style={{ textAlign: 'right' }}>
                <span style={{ fontSize: 19, fontWeight: 800 }}>{usd(h.price)}</span>
                <span style={{ fontSize: 12, color: MUTED }}> /night</span>
                {nights > 0 && <span style={{ display: 'block', fontSize: 11.5, color: MUTED }}>{usd(t)} for {nights} night{nights > 1 ? 's' : ''}</span>}
              </span>
            </div>
          </div>
        </button>
        <span style={{ position: 'absolute', top: 10, right: 10 }}>{heart(h)}</span>
        {h.cancel && <span style={{ position: 'absolute', top: 12, left: 12, padding: '4px 10px', borderRadius: 12, background: 'rgba(255,255,255,.92)', fontSize: 11, fontWeight: 700, color: accent }}>Free cancellation</span>}
      </div>
    )
  }

  const stepper = (label, sub, val, min, max, set) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: `1px solid ${LINE}` }}>
      <span><span style={{ display: 'block', fontSize: 15, fontWeight: 700 }}>{label}</span><span style={{ fontSize: 12, color: MUTED }}>{sub}</span></span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <button type="button" aria-label={`Fewer ${label}`} disabled={val <= min} onClick={() => set(val - 1)} style={{ ...iconBtn, width: 36, height: 36, border: `1px solid ${LINE}`, boxShadow: 'none', opacity: val <= min ? 0.35 : 1 }}><Icon name="minus" size={17} /></button>
        <span style={{ width: 18, textAlign: 'center', fontSize: 16, fontWeight: 800 }}>{val}</span>
        <button type="button" aria-label={`More ${label}`} disabled={val >= max} onClick={() => set(val + 1)} style={{ ...iconBtn, width: 36, height: 36, border: `1px solid ${LINE}`, boxShadow: 'none', opacity: val >= max ? 0.35 : 1 }}><Icon name="plus" size={17} /></button>
      </span>
    </div>
  )

  const summaryRow = (icon, label, value, fn) => (
    <button type="button" onClick={fn} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '13px 14px', border: 'none', borderBottom: `1px solid ${LINE}`, background: 'none', font: 'inherit', textAlign: 'left', cursor: 'pointer', color: INK }}>
      <Icon name={icon} size={20} color={accent} />
      <span style={{ flex: 1 }}><span style={{ display: 'block', fontSize: 11, color: MUTED, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase' }}>{label}</span><span style={{ fontSize: 15, fontWeight: 700 }}>{value}</span></span>
      <Icon name="chev" size={17} color={MUTED} />
    </button>
  )

  const guestText = `${q.adults} adult${q.adults > 1 ? 's' : ''}${q.kids ? `, ${q.kids} child${q.kids > 1 ? 'ren' : ''}` : ''} · ${q.rooms} room${q.rooms > 1 ? 's' : ''}`

  const pickDay = (off) => {
    if (q.inn == null || q.out != null) setQ((s) => ({ ...s, inn: off, out: null }))
    else if (off > q.inn) setQ((s) => ({ ...s, out: off }))
    else setQ((s) => ({ ...s, inn: off }))
  }

  // ---- screens
  let body
  let tabbed = true
  if (top?.id === 'dates') {
    tabbed = false
    const months = [0, 1, 2].map((i) => {
      const first = new Date(TODAY.getFullYear(), TODAY.getMonth() + i, 1)
      const lead = (first.getDay() + 6) % 7
      const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
      return { first, lead, days }
    })
    body = (
      <>
        {header('Dates and guests', pop)}
        <div style={{ margin: '4px 20px 0', padding: '4px 16px 10px', background: '#fff', borderRadius: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0 4px', fontSize: 13.5, fontWeight: 700 }}>
            <span style={{ color: accent }}>{q.inn == null ? 'Check-in' : fmt(q.inn)}</span>
            <span style={{ color: MUTED }}>{q.inn != null && q.out != null ? `${nights} night${nights > 1 ? 's' : ''}` : q.inn != null ? 'Pick check-out' : ''}</span>
            <span style={{ color: accent }}>{q.out == null ? 'Check-out' : fmt(q.out)}</span>
          </div>
          <div style={{ maxHeight: 300, overflowY: 'auto' }} className="ht-scroll">
            {months.map(({ first, lead, days }) => (
              <div key={first.getTime()} style={{ marginTop: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 800, fontFamily: 'Georgia, serif', margin: '6px 0' }}>{first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', rowGap: 2, textAlign: 'center' }}>
                  {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <span key={i} style={{ fontSize: 11, color: MUTED, fontWeight: 700, padding: '2px 0' }}>{d}</span>)}
                  {Array.from({ length: lead }).map((_, i) => <span key={`l${i}`} />)}
                  {Array.from({ length: days }).map((_, i) => {
                    const off = Math.round((new Date(first.getFullYear(), first.getMonth(), i + 1) - TODAY) / DAY)
                    const past = off < 0
                    const edge = off === q.inn || off === q.out
                    const mid = q.inn != null && q.out != null && off > q.inn && off < q.out
                    return (
                      <button key={i} type="button" disabled={past} onClick={() => pickDay(off)} aria-label={fmt(off)} aria-pressed={edge} style={{ height: 36, border: 'none', borderRadius: edge ? 18 : mid ? 0 : 18, background: edge ? accent : mid ? `${accent}22` : 'transparent', color: edge ? '#fff' : past ? '#cdc7ba' : INK, font: 'inherit', fontSize: 13.5, fontWeight: edge ? 800 : 600, cursor: past ? 'default' : 'pointer' }}>{i + 1}</button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ margin: '12px 20px 0', padding: '0 16px', background: '#fff', borderRadius: 22 }}>
          {stepper('Adults', 'Age 13+', q.adults, 1, 8, (v) => setQ((s) => ({ ...s, adults: v })))}
          {stepper('Children', 'Age 0 to 12', q.kids, 0, 6, (v) => setQ((s) => ({ ...s, kids: v })))}
          <div style={{ borderBottom: 'none' }}>{stepper('Rooms', 'Max 4', q.rooms, 1, 4, (v) => setQ((s) => ({ ...s, rooms: v })))}</div>
        </div>
        <div style={{ padding: '14px 20px' }}>{primary(q.out == null ? 'Pick a check-out date' : 'Done', () => (pop(), say(`${range(q.inn, q.out)} · ${guests} guest${guests > 1 ? 's' : ''}`)), q.out == null)}</div>
      </>
    )
  } else if (top?.id === 'detail') {
    tabbed = false
    const h = HOTELS.find((x) => x.id === top.hid)
    const ok = nights > 0 && fits(h)
    const reason = nights <= 0 ? 'Pick your dates to book' : h.cap * q.rooms < guests ? `Sleeps ${h.cap * q.rooms} with ${q.rooms} room${q.rooms > 1 ? 's' : ''}; add a room` : !free(h, q.inn, q.out) ? 'Not available on these dates' : ''
    const base = priced(h, roomIx)
    body = (
      <>
        <div style={{ position: 'relative' }}>
          <button type="button" onClick={() => setView((v) => (v + 1) % 3)} aria-label="Next photo" style={{ display: 'block', width: '100%', padding: 0, border: 'none', background: 'none', cursor: 'pointer' }}>
            <HotelArt h={h} v={view} height={260} />
          </button>
          <span style={{ position: 'absolute', top: 6, left: 16 }}><button type="button" onClick={pop} aria-label="Back" style={{ ...iconBtn, width: 38, height: 38 }}><Icon name="back" size={20} /></button></span>
          <span style={{ position: 'absolute', top: 6, right: 16 }}>{heart(h, 38)}</span>
          <span style={{ position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 6 }}>
            {[0, 1, 2].map((i) => <i key={i} style={{ width: i === view ? 18 : 6, height: 6, borderRadius: 3, background: '#fff', opacity: i === view ? 1 : 0.6, transition: 'width .2s' }} />)}
          </span>
        </div>
        <div style={{ padding: '16px 20px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
            <h2 style={{ margin: 0, fontSize: 24, fontFamily: 'Georgia, serif', letterSpacing: '-0.01em' }}>{h.name}</h2>
            <span style={{ padding: '4px 10px', borderRadius: 10, background: accent, color: '#fff', fontSize: 14, fontWeight: 800 }}>{h.rating}</span>
          </div>
          <div style={{ fontSize: 13, color: MUTED, marginTop: 4, display: 'flex', alignItems: 'center', gap: 5 }}><Icon name="pin" size={15} /> {h.city} · {'★'.repeat(h.stars)} · {h.reviews.toLocaleString()} reviews</div>
          <p style={{ fontSize: 14, lineHeight: 1.5, color: '#4a5655', margin: '12px 0 0' }}>{h.blurb}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
            {h.amen.map((a) => <span key={a} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 11px', borderRadius: 14, background: '#fff', fontSize: 12.5, fontWeight: 600, color: accent }}><Icon name={a} size={15} /> {AMEN[a]}</span>)}
          </div>
        </div>
        <div style={{ margin: '16px 20px 0', background: '#fff', borderRadius: 20 }}>
          {summaryRow('cal', 'Dates', `${range(q.inn, q.out)}${nights ? ` · ${nights} night${nights > 1 ? 's' : ''}` : ''}`, () => push({ id: 'dates' }))}
          <div style={{ marginBottom: -1 }}>{summaryRow('users', 'Guests', guestText, () => push({ id: 'dates' }))}</div>
        </div>
        <h3 style={{ margin: '18px 20px 8px', fontSize: 16, fontFamily: 'Georgia, serif' }}>Choose a room</h3>
        <div style={{ display: 'grid', gap: 8, padding: '0 20px' }} role="radiogroup" aria-label="Room type">
          {ROOMS.map((r, i) => (
            <button key={r.name} type="button" role="radio" aria-checked={roomIx === i} onClick={() => setRoomIx(i)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 16, border: `2px solid ${roomIx === i ? accent : 'transparent'}`, background: '#fff', font: 'inherit', textAlign: 'left', cursor: 'pointer', color: INK }}>
              <span style={{ width: 22, height: 22, borderRadius: '50%', border: `2px solid ${roomIx === i ? accent : '#cfc8ba'}`, display: 'grid', placeItems: 'center', flex: 'none' }}>{roomIx === i && <i style={{ width: 10, height: 10, borderRadius: '50%', background: accent }} />}</span>
              <span style={{ flex: 1 }}><span style={{ display: 'block', fontSize: 14.5, fontWeight: 700 }}>{r.name}</span><span style={{ fontSize: 12, color: MUTED }}>{r.desc}</span></span>
              <span style={{ fontSize: 14, fontWeight: 800 }}>{usd(h.price + r.add)}</span>
            </button>
          ))}
        </div>
        <div style={{ margin: '16px 20px 0', padding: '4px 16px', background: '#fff', borderRadius: 20, fontSize: 14 }}>
          {[[`${usd(h.price + ROOMS[roomIx].add)} × ${Math.max(1, nights)} night${nights > 1 ? 's' : ''}${q.rooms > 1 ? ` × ${q.rooms} rooms` : ''}`, usd(base)], ['Taxes and fees (12%)', usd(base * 0.12)]].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 0', borderBottom: `1px solid ${LINE}` }}><span style={{ color: MUTED }}>{k}</span><span style={{ fontWeight: 600 }}>{v}</span></div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', fontSize: 16, fontWeight: 800 }}><span>Total</span><span>{usd(base * 1.12)}</span></div>
        </div>
        <div style={{ padding: '14px 20px 6px' }}>
          <div style={{ fontSize: 12.5, color: reason ? '#c0392b' : MUTED, textAlign: 'center', marginBottom: 8, fontWeight: 600 }}>{reason || (h.cancel ? 'Free cancellation until 48 hours before check-in' : 'Non-refundable rate')}</div>
          {primary(`Book · ${usd(base * 1.12)}`, () => book(h), !ok)}
        </div>
      </>
    )
  } else if (top?.id === 'results') {
    tabbed = false
    let list = cityHotels.filter(fits)
    if (filt.pool) list = list.filter((h) => h.amen.includes('pool'))
    if (filt.breakfast) list = list.filter((h) => h.amen.includes('breakfast'))
    if (filt.cancel) list = list.filter((h) => h.cancel)
    if (filt.cheap) list = list.filter((h) => h.price < 200)
    list = [...list].sort((a, b) => (sort === 'price' ? a.price - b.price : sort === 'rating' ? b.rating - a.rating : b.reviews * b.rating - a.reviews * a.rating))
    const hidden = cityHotels.length - cityHotels.filter(fits).length
    body = (
      <>
        {header(q.city || 'Anywhere', pop)}
        <button type="button" onClick={() => push({ id: 'dates' })} style={{ display: 'flex', alignItems: 'center', gap: 10, width: 'calc(100% - 40px)', margin: '0 20px 10px', padding: '10px 14px', border: `1px solid ${LINE}`, borderRadius: 16, background: '#fff', font: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: INK, textAlign: 'left' }}>
          <Icon name="cal" size={18} color={accent} />
          <span style={{ flex: 1 }}>{range(q.inn, q.out)} · {guests} guest{guests > 1 ? 's' : ''}, {q.rooms} room{q.rooms > 1 ? 's' : ''}</span>
          <span style={{ color: accent, fontWeight: 800 }}>Edit</span>
        </button>
        <div className="ht-scroll" style={{ display: 'flex', gap: 8, padding: '0 20px 6px', overflowX: 'auto' }}>
          {[['rec', 'Top picks'], ['price', 'Lowest price'], ['rating', 'Best rated']].map(([id, l]) => chip(l, sort === id, () => setSort(id), id))}
        </div>
        <div className="ht-scroll" style={{ display: 'flex', gap: 8, padding: '4px 20px 10px', overflowX: 'auto' }}>
          {[['pool', 'Pool'], ['breakfast', 'Breakfast'], ['cancel', 'Free cancellation'], ['cheap', 'Under $200']].map(([id, l]) => chip(l, !!filt[id], () => setFilt((f) => ({ ...f, [id]: !f[id] })), id))}
        </div>
        <div style={{ padding: '0 22px 8px', fontSize: 12.5, color: MUTED }}>{list.length} stay{list.length === 1 ? '' : 's'}{hidden ? ` · ${hidden} unavailable for your dates or party` : ''}</div>
        <div style={{ display: 'grid', gap: 16, padding: '0 20px' }}>
          {list.map(hotelCard)}
          {!list.length && (
            <div style={{ textAlign: 'center', padding: '40px 16px', color: MUTED, fontSize: 14 }}>
              <div style={{ marginBottom: 14 }}>Nothing matches. Try other dates or loosen the filters.</div>
              <button type="button" onClick={() => setFilt({})} style={{ height: 42, padding: '0 20px', borderRadius: 21, border: 'none', background: accent, color: '#fff', font: 'inherit', fontWeight: 700, cursor: 'pointer' }}>Clear filters</button>
            </div>
          )}
        </div>
      </>
    )
  } else if (top?.id === 'booked') {
    tabbed = false
    const t = top.trip
    const h = HOTELS.find((x) => x.id === t.hid)
    body = (
      <div style={{ textAlign: 'center', padding: '70px 24px 0' }}>
        <span style={{ width: 92, height: 92, borderRadius: '50%', display: 'inline-grid', placeItems: 'center', background: `${accent}22`, color: accent, animation: 'ht-pop .5s cubic-bezier(.2,1.4,.4,1) both' }} className="ht-anim"><Icon name="check" size={46} w={2.6} /></span>
        <div style={{ fontSize: 26, fontFamily: 'Georgia, serif', fontWeight: 800, marginTop: 20 }}>You are booked</div>
        <div style={{ fontSize: 14, color: MUTED, marginTop: 6 }}>{h.name}, {h.city}<br />{range(t.inn, t.out)} · {usd(t.total)}</div>
        <div style={{ display: 'inline-block', marginTop: 18, padding: '8px 16px', borderRadius: 14, background: '#fff', fontSize: 13, fontWeight: 700, letterSpacing: '.1em' }}>{t.code}</div>
        <div style={{ display: 'grid', gap: 10, marginTop: 36 }}>
          {primary('View in Trips', () => (setDir(1), setTab('trips'), setStack([])))}
          <button type="button" onClick={() => (setDir(-1), setTab('search'), setStack([]))} style={{ height: 44, border: 'none', background: 'none', font: 'inherit', fontSize: 14, fontWeight: 600, color: MUTED, cursor: 'pointer' }}>Keep exploring</button>
        </div>
      </div>
    )
  } else if (tab === 'search') {
    body = (
      <>
        <div style={{ padding: '8px 20px 0' }}>
          <div style={{ fontSize: 13, color: MUTED }}>{name}</div>
          <h1 style={{ margin: '2px 0 0', fontSize: 30, lineHeight: 1.1, fontFamily: 'Georgia, serif', letterSpacing: '-0.02em' }}>Where to next?</h1>
        </div>
        <div style={{ margin: '16px 20px 0', background: '#fff', borderRadius: 22, boxShadow: '0 8px 24px rgba(80,60,20,.1)', overflow: 'hidden' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px', borderBottom: `1px solid ${LINE}` }}>
            <Icon name="search" size={20} color={accent} />
            <span style={{ flex: 1 }}>
              <span style={{ display: 'block', fontSize: 11, color: MUTED, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase' }}>Destination</span>
              <input value={q.city} onChange={(e) => setQ((s) => ({ ...s, city: e.target.value }))} placeholder="Anywhere" aria-label="Destination" style={{ width: '100%', border: 'none', outline: 'none', background: 'none', font: 'inherit', fontSize: 16, fontWeight: 700, color: INK, padding: 0 }} />
            </span>
            {q.city && <button type="button" aria-label="Clear destination" onClick={() => setQ((s) => ({ ...s, city: '' }))} style={{ ...iconBtn, width: 28, height: 28, boxShadow: 'none', background: '#f1ece0' }}><Icon name="x" size={14} /></button>}
          </label>
          {summaryRow('cal', 'Dates', `${range(q.inn, q.out)}${nights ? ` · ${nights} night${nights > 1 ? 's' : ''}` : ''}`, () => push({ id: 'dates' }))}
          <div style={{ marginBottom: -1 }}>{summaryRow('users', 'Guests', guestText, () => push({ id: 'dates' }))}</div>
        </div>
        <div className="ht-scroll" style={{ display: 'flex', gap: 8, padding: '12px 20px 0', overflowX: 'auto' }}>
          {CITIES.map((c) => chip(c, q.city === c, () => setQ((s) => ({ ...s, city: c })), c))}
        </div>
        <div style={{ padding: '16px 20px 0' }}>{primary(`Search ${q.city || 'all stays'}`, () => (setFilt({}), push({ id: 'results' })), q.out == null)}</div>
        <h2 style={{ margin: '22px 20px 10px', fontSize: 18, fontFamily: 'Georgia, serif' }}>Popular right now</h2>
        <div className="ht-scroll" style={{ display: 'flex', gap: 12, padding: '0 20px', overflowX: 'auto' }}>
          {[HOTELS[2], HOTELS[6], HOTELS[1], HOTELS[5]].map((h) => (
            <button key={h.id} type="button" onClick={() => (setQ((s) => ({ ...s, city: h.city })), openHotel(h.id))} style={{ flex: 'none', width: 220, padding: 0, border: 'none', borderRadius: 20, overflow: 'hidden', background: '#fff', textAlign: 'left', font: 'inherit', cursor: 'pointer', color: INK, boxShadow: '0 6px 18px rgba(80,60,20,.09)' }}>
              <HotelArt h={h} v={1} height={110} />
              <div style={{ padding: '10px 12px 12px' }}>
                <div style={{ fontSize: 14.5, fontWeight: 800, fontFamily: 'Georgia, serif' }}>{h.name}</div>
                <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{h.city} · from {usd(h.price)}</div>
              </div>
            </button>
          ))}
        </div>
      </>
    )
  } else if (tab === 'saved') {
    const list = HOTELS.filter((h) => saved[h.id])
    body = (
      <>
        {header('Saved')}
        <div style={{ display: 'grid', gap: 16, padding: '4px 20px 0' }}>
          {list.map(hotelCard)}
          {!list.length && (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: MUTED, fontSize: 14 }}>
              <div style={{ marginBottom: 14 }}>Tap the heart on any stay to keep it here.</div>
              <button type="button" onClick={() => go('search')} style={{ height: 42, padding: '0 20px', borderRadius: 21, border: 'none', background: accent, color: '#fff', font: 'inherit', fontWeight: 700, cursor: 'pointer' }}>Start searching</button>
            </div>
          )}
        </div>
      </>
    )
  } else {
    body = (
      <>
        {header('Trips')}
        <div style={{ display: 'grid', gap: 12, padding: '4px 20px 0' }}>
          {trips.map((t) => {
            const h = HOTELS.find((x) => x.id === t.hid)
            const isOpen = openTrip === t.id
            const dead = t.status === 'Cancelled'
            return (
              <div key={t.id} style={{ background: '#fff', borderRadius: 22, overflow: 'hidden', boxShadow: '0 6px 18px rgba(80,60,20,.08)', opacity: dead ? 0.65 : 1 }}>
                <button type="button" onClick={() => (setOpenTrip(isOpen ? null : t.id), setAskCancel(null))} aria-expanded={isOpen} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: 10, border: 'none', background: 'none', font: 'inherit', textAlign: 'left', cursor: 'pointer', color: INK }}>
                  <span style={{ width: 76, height: 76, borderRadius: 16, overflow: 'hidden', flex: 'none' }}><HotelArt h={h} height={76} /></span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 15.5, fontWeight: 800, fontFamily: 'Georgia, serif' }}>{h.name}</span>
                    <span style={{ display: 'block', fontSize: 12.5, color: MUTED, marginTop: 2 }}>{range(t.inn, t.out)}</span>
                    <span style={{ display: 'inline-block', marginTop: 5, padding: '2px 9px', borderRadius: 10, fontSize: 11, fontWeight: 800, background: dead ? '#fde4e4' : t.status === 'Completed' ? '#eee8da' : `${accent}1f`, color: dead ? '#b42318' : t.status === 'Completed' ? MUTED : accent }}>{t.status}</span>
                  </span>
                  <span style={{ transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }}><Icon name="chev" size={18} color={MUTED} /></span>
                </button>
                {isOpen && (
                  <div style={{ padding: '0 16px 14px', borderTop: `1px solid ${LINE}`, fontSize: 13.5 }}>
                    {[['Confirmation', t.code], ['Room', ROOMS[t.room].name], ['Guests', `${t.adults + t.kids} · ${t.rooms} room${t.rooms > 1 ? 's' : ''}`], ['Nights', nightsOf(t.inn, t.out)], ['Total paid', usd(t.total)]].map(([k, v]) => (
                      <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: `1px solid ${LINE}` }}><span style={{ color: MUTED }}>{k}</span><span style={{ fontWeight: 700 }}>{v}</span></div>
                    ))}
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                      <button type="button" onClick={() => (setQ((s) => ({ ...s, city: h.city, inn: t.inn > 0 ? t.inn : 7, out: t.inn > 0 ? t.out : 10 })), openHotel(h.id))} style={{ flex: 1, height: 42, borderRadius: 14, border: `1px solid ${LINE}`, background: '#fff', font: 'inherit', fontWeight: 700, fontSize: 13, cursor: 'pointer', color: INK }}>{t.status === 'Completed' ? 'Book again' : 'View hotel'}</button>
                      {t.status === 'Confirmed' && (askCancel === t.id ? (
                        <button type="button" onClick={() => (setTrips((a) => a.map((x) => (x.id === t.id ? { ...x, status: 'Cancelled' } : x))), setAskCancel(null), say(h.cancel ? 'Cancelled, full refund coming' : 'Cancelled, fee applies'))} style={{ flex: 1, height: 42, borderRadius: 14, border: 'none', background: '#b42318', color: '#fff', font: 'inherit', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Yes, cancel</button>
                      ) : (
                        <button type="button" onClick={() => setAskCancel(t.id)} style={{ flex: 1, height: 42, borderRadius: 14, border: 'none', background: '#fde4e4', color: '#b42318', font: 'inherit', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Cancel booking</button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
          {!trips.length && <div style={{ textAlign: 'center', padding: '50px 0', color: MUTED }}>No trips yet.</div>}
        </div>
      </>
    )
  }

  const phone = (
    <div style={{ position: 'relative', width: W, height: H, overflow: 'hidden', borderRadius: frame ? 46 : 0, background: BG, color: INK, fontFamily: "-apple-system, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif" }}>
      <style>{`
        @keyframes ht-r { from { opacity: 0; transform: translateX(34px) } to { opacity: 1; transform: none } }
        @keyframes ht-l { from { opacity: 0; transform: translateX(-34px) } to { opacity: 1; transform: none } }
        @keyframes ht-pop { from { transform: scale(.3); opacity: 0 } to { transform: none; opacity: 1 } }
        .ht-scroll { scrollbar-width: none } .ht-scroll::-webkit-scrollbar { display: none }
        .ht-app button:focus-visible, .ht-app input:focus-visible { outline: 2px solid ${accent}; outline-offset: 2px }
        @media (prefers-reduced-motion: reduce) { .ht-screen, .ht-anim { animation: none !important } }
      `}</style>
      <StatusBar frame={frame} />
      <div key={`${tab}/${stack.map((s) => s.id + (s.hid || '')).join('/')}`} className="ht-scroll ht-screen" style={{ position: 'absolute', top: top?.id === 'detail' ? 0 : 54, bottom: tabbed ? 84 : 0, left: 0, right: 0, overflowY: 'auto', paddingBottom: 24, animation: `${dir > 0 ? 'ht-r' : 'ht-l'} .28s ease` }}>
        {body}
      </div>
      {tabbed && (
        <nav aria-label="Main" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 84, background: '#fff', borderTop: `1px solid ${LINE}`, display: 'flex', justifyContent: 'space-around', padding: '10px 8px 0' }}>
          {NAV.map(([id, icon, label]) => (
            <button key={id} type="button" onClick={() => go(id)} aria-current={tab === id ? 'page' : undefined} style={{ border: 'none', background: 'none', font: 'inherit', cursor: 'pointer', display: 'grid', justifyItems: 'center', alignContent: 'start', gap: 3, width: 80, height: 54, fontSize: 11, fontWeight: 700, color: tab === id ? accent : MUTED }}>
              <Icon name={icon} size={23} />
              {label}
            </button>
          ))}
        </nav>
      )}
      <div role="status" style={{ position: 'absolute', left: '50%', top: 58, zIndex: 30, transform: `translate(-50%, ${toast ? 0 : -90}px)`, transition: 'transform .35s cubic-bezier(.2,.8,.2,1)', padding: '10px 16px', borderRadius: 20, background: INK, color: '#fff', fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap' }}>{toast}</div>
      <div style={{ position: 'absolute', left: '50%', bottom: 8, width: 140, height: 5, marginLeft: -70, borderRadius: 3, background: INK, opacity: 0.8, zIndex: 25 }} />
    </div>
  )

  return (
    <div ref={box} className="ht-app" style={{ position: 'relative', width: '100%', height: '100%', display: 'grid', placeItems: 'center', overflow: 'hidden', background: 'radial-gradient(ellipse at 50% 30%, #f3e7d0, #d3c3a4 75%)', ...style }}>
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: `translate(-50%, -50%) scale(${scale})`, transformOrigin: 'center' }}>
        {frame ? (
          <div style={{ padding: 12, borderRadius: 58, background: 'linear-gradient(145deg, #3a3f4a, #14171d 40%, #2b2f38)', boxShadow: '0 40px 80px rgba(60,40,10,.35), inset 0 0 0 2px #4b515e' }}>
            <div style={{ padding: 2, borderRadius: 48, background: '#000' }}>{phone}</div>
          </div>
        ) : (
          phone
        )}
      </div>
    </div>
  )
}
