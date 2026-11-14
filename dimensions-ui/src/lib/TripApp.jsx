import { useEffect, useRef, useState } from 'react'

// A trip planner on a phone, as a click-through prototype. Pages: Trips,
// Itinerary, Place, Map and Packing. The Itinerary is the hard part: grab a
// stop by its grip handle and drag it up or down. The list reflows live around
// a dashed placeholder, you can drop it into a different day (or an empty one),
// the page auto-scrolls near the edges, and the travel-time chips between stops
// (walk or transit, worked out from the map positions) are recomputed as you
// move. "Add stop" opens a place list, "Optimize" re-orders a day by nearest
// neighbour. Place detail holds notes, cost, booked and day, the Map draws
// numbered pins and a route per day from the same data (so it changes the
// moment you reorder), and Packing is a checklist by category with a progress
// ring and a running budget. startScreen: trips, itinerary, place, map, packing.

const W = 390
const H = 844
const INK = '#0e2a2f'
const MUTED = '#6b8387'
const BG = '#eef4f3'
const LINE = '#dbe6e5'
const TAB = 84
const DAY_COLORS = ['#0d9488', '#f97316', '#6366f1', '#e11d48']
const MAP_W = 100
const MAP_H = 120

const CATS = {
  sight: { label: 'Sight', c: '#0d9488', icon: 'camera' },
  food: { label: 'Food', c: '#f97316', icon: 'fork' },
  walk: { label: 'Walk', c: '#6366f1', icon: 'walk' },
  shop: { label: 'Shop', c: '#e11d48', icon: 'bag' },
}
const PACK_CATS = ['Documents', 'Clothes', 'Toiletries', 'Tech']

// place: [id, name, category, x, y, cost, minutes, blurb]
const P = (id, name, cat, x, y, cost, mins, blurb) => ({ id, name, cat, x, y, cost, mins, blurb })
const TRIPS = [
  {
    id: 'lisbon', name: 'Lisbon', country: 'Portugal', a: '#0ea5e9', b: '#fcd34d', art: 'coast', map: 'coast', start: 21, budget: 600,
    places: [
      P('praca', 'Praça do Comércio', 'walk', 56, 70, 0, 30, 'A grand riverside square framed by yellow arcades, perfect for a first stroll.'),
      P('market', 'Time Out Market', 'food', 46, 64, 25, 60, 'A buzzing hall of stalls from the city\'s best chefs. Go hungry.'),
      P('alfama', 'Alfama viewpoint', 'walk', 74, 56, 0, 60, 'Tiled lanes climb to a terrace over rooftops and the river.'),
      P('rooftop', 'Rooftop dinner', 'food', 58, 40, 40, 90, 'Grilled fish and a long sunset over the old town.'),
      P('belem', 'Belém Tower', 'sight', 12, 78, 8, 60, 'A fortified tower guarding the river mouth since 1519.'),
      P('pasteis', 'Pastéis de Belém', 'food', 22, 72, 6, 30, 'The original custard tarts, warm, with cinnamon.'),
      P('jeronimos', 'Jerónimos Monastery', 'sight', 18, 74, 12, 90, 'Lacy limestone cloisters and the tomb of Vasco da Gama.'),
      P('lx', 'LX Factory', 'shop', 30, 66, 0, 60, 'A converted mill full of studios, bookshops and street art.'),
      P('castle', 'São Jorge Castle', 'sight', 68, 44, 15, 90, 'Hilltop ramparts with the best panorama in town.'),
    ],
    days: [['praca', 'market', 'alfama', 'rooftop'], ['belem', 'pasteis', 'jeronimos'], ['lx', 'castle']],
  },
  {
    id: 'kyoto', name: 'Kyoto', country: 'Japan', a: '#be123c', b: '#fda4af', art: 'temple', map: 'river', start: 60, budget: 450,
    places: [
      P('fushimi', 'Fushimi Inari', 'sight', 80, 88, 0, 120, 'Thousands of vermilion gates winding up the mountain.'),
      P('nishiki', 'Nishiki Market', 'food', 42, 48, 15, 60, 'Five blocks of pickles, tofu and skewers.'),
      P('gion', 'Gion evening walk', 'walk', 58, 46, 0, 60, 'Wooden machiya streets and the chance of a geiko.'),
      P('kinkaku', 'Kinkaku-ji', 'sight', 22, 16, 5, 60, 'The golden pavilion mirrored in its pond.'),
      P('bamboo', 'Arashiyama Bamboo Grove', 'walk', 8, 40, 0, 60, 'A path through towering, creaking green stalks.'),
      P('ramen', 'Ichiran ramen', 'food', 46, 40, 12, 45, 'Solo booths, rich broth, zero small talk.'),
      P('kiyomizu', 'Kiyomizu-dera', 'sight', 66, 56, 6, 90, 'A wooden stage jutting out over the hillside.'),
      P('philo', 'Philosopher\'s Path', 'walk', 72, 22, 0, 60, 'A canal-side stroll lined with cherry trees.'),
    ],
    days: [['fushimi', 'nishiki', 'gion'], ['kinkaku', 'bamboo', 'ramen']],
  },
  {
    id: 'reykjavik', name: 'Reykjavik', country: 'Iceland', a: '#312e81', b: '#6ee7b7', art: 'aurora', map: 'bay', start: 100, budget: 900,
    places: [
      P('hallgrim', 'Hallgrímskirkja', 'sight', 50, 40, 10, 45, 'A basalt-column church with a view from its tower.'),
      P('harpa', 'Harpa Concert Hall', 'sight', 42, 30, 0, 45, 'A honeycomb of glass catching the harbour light.'),
      P('voyager', 'Sun Voyager', 'walk', 46, 22, 0, 20, 'A steel ship sculpture on the seafront path.'),
      P('hotdog', 'Bæjarins Beztu', 'food', 48, 34, 6, 20, 'The famous hot dog stand. One with everything.'),
      P('lagoon', 'Blue Lagoon', 'sight', 12, 88, 70, 180, 'Milky-blue geothermal water in a black lava field.'),
      P('perlan', 'Perlan', 'sight', 62, 54, 18, 60, 'A glass dome on the hill with an ice cave exhibit.'),
      P('pingvellir', 'Þingvellir', 'walk', 80, 8, 0, 150, 'A rift valley where two continents pull apart.'),
    ],
    days: [['hallgrim', 'harpa', 'voyager'], ['lagoon']],
  },
  {
    id: 'porto', name: 'Porto', country: 'Portugal', a: '#f59e0b', b: '#fef3c7', art: 'bridge', map: 'river', start: 14, budget: 350, fresh: true,
    places: [
      P('ribeira', 'Ribeira riverside', 'walk', 40, 60, 0, 60, 'Colourful houses stacked above the Douro.'),
      P('lello', 'Livraria Lello', 'shop', 50, 44, 6, 40, 'A carved wooden staircase of a bookshop.'),
      P('bridge', 'Dom Luís I Bridge', 'sight', 46, 62, 0, 30, 'Walk the iron upper deck for a dizzying view.'),
      P('cellar', 'Port cellar tour', 'food', 44, 78, 15, 75, 'Cool vaults, barrels and a tasting flight.'),
      P('francesinha', 'Café Santiago', 'food', 52, 40, 14, 60, 'The towering, sauce-drenched francesinha sandwich.'),
      P('foz', 'Foz do Douro', 'walk', 8, 52, 0, 60, 'Where the river meets the Atlantic.'),
    ],
    days: [[], []],
  },
]
TRIPS.forEach((t) => (t.byId = Object.fromEntries(t.places.map((p) => [p.id, p]))))
const tripOf = (id) => TRIPS.find((t) => t.id === id) || TRIPS[0]

const PACK_SEED = [
  ['Documents', 'Passport', true], ['Documents', 'Boarding passes', false], ['Documents', 'Travel insurance', false],
  ['Clothes', 'Walking shoes', true], ['Clothes', 'Rain jacket', false], ['Clothes', 'T-shirts (4)', false],
  ['Toiletries', 'Toothbrush', true], ['Toiletries', 'Sunscreen', false],
  ['Tech', 'Phone charger', true], ['Tech', 'Power adapter', false], ['Tech', 'Camera', false],
]
const seedState = () =>
  Object.fromEntries(
    TRIPS.map((t) => [
      t.id,
      {
        days: t.days.map((d, i) => ({ id: `d${i + 1}`, stops: [...d] })),
        budget: t.budget,
        meta: {},
        pack: PACK_SEED.map(([cat, name, done], i) => ({ id: `${t.id}${i}`, cat, name, done: t.fresh ? false : done })),
      },
    ]),
  )

const pad = (n) => String(n).padStart(2, '0')
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const dayDate = (t, i) => {
  const d = new Date()
  d.setDate(d.getDate() + t.start + i)
  return d
}
const dayLabel = (t, i) => {
  const d = dayDate(t, i)
  return `${DOW[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}`
}
const money = (n) => `$${Math.round(n).toLocaleString('en-US')}`
const dur = (m) => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}` : `${m} min`)

function hop(a, b) {
  const km = Math.hypot(a.x - b.x, a.y - b.y) * 0.11
  if (km < 1.4) return { mode: 'walk', min: Math.max(2, Math.round((km / 5) * 60)), km }
  return { mode: 'transit', min: Math.round((km / 22) * 60) + 6, km }
}

// ---------------------------------------------------------------- icons & art

const ICONS = {
  trips: 'M3 11l18-7-7 18-3-8z',
  plan: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  map: 'M9 4L3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14',
  bag: 'M5 8h14l-1 12H6zM9 8a3 3 0 0 1 6 0',
  suitcase: 'M5 8h14a1 1 0 0 1 1 1v10H4V9a1 1 0 0 1 1-1zM9 8V5h6v3M9 11v5M15 11v5',
  camera: 'M4 8h3l2-3h6l2 3h3v11H4zM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
  fork: 'M7 3v7a2 2 0 0 0 4 0V3M9 10v11M17 21V3c-2 1-3 4-3 7s1 3 3 3',
  walk: 'M13 5a1.5 1.5 0 1 0 0 .01M10 21l2-6-3-3 1-5 3 1 2 3 3 1M9 12l-3 3',
  train: 'M7 4h10a2 2 0 0 1 2 2v9a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V6a2 2 0 0 1 2-2zM5 11h14M8 21l2-3m6 3l-2-3',
  grip: 'M9 6h.01M9 12h.01M9 18h.01M15 6h.01M15 12h.01M15 18h.01',
  back: 'M15 5l-7 7 7 7',
  chev: 'M9 5l7 7-7 7',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  x: 'M6 6l12 12M18 6L6 18',
  check: 'M5 12l5 5 9-10',
  trash: 'M5 7h14M10 4h4M7 7l1 13h8l1-13',
  wand: 'M5 19L15 9M14 4l1 2 2 1-2 1-1 2-1-2-2-1 2-1zM19 12l.7 1.3L21 14l-1.3.7L19 16l-.7-1.3L17 14l1.3-.7z',
  pin: 'M12 21s-6-5.6-6-11a6 6 0 0 1 12 0c0 5.4-6 11-6 11zM12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
}
function Icon({ name, size = 22, color = 'currentColor', w = 1.9 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  )
}

function TripArt({ t, h = 120 }) {
  const id = `ta-${t.id}`
  let art = null
  if (t.art === 'coast') art = (<g><circle cx="300" cy="40" r="22" fill="#fef3c7" /><path d="M0 80q40-14 80 0t80 0 80 0 80 0V120H0z" fill="#0369a1" opacity=".55" /><path d="M0 96q40-12 80 0t80 0 80 0 80 0V120H0z" fill="#075985" opacity=".7" /></g>)
  else if (t.art === 'temple') art = (<g><circle cx="300" cy="38" r="20" fill="#fff1f2" opacity=".9" /><rect x="70" y="40" width="9" height="70" fill="#9f1239" /><rect x="130" y="40" width="9" height="70" fill="#9f1239" /><rect x="58" y="34" width="94" height="9" rx="3" fill="#be123c" /><rect x="66" y="52" width="78" height="6" fill="#9f1239" /><path d="M170 120l50-44 50 44z" fill="#881337" opacity=".5" /></g>)
  else if (t.art === 'aurora') art = (<g><path d="M0 50q60-40 120-10t120-10 120 10v-40H0z" fill="#6ee7b7" opacity=".45" /><path d="M0 70q70-30 140-6t140-8 80 6" fill="none" stroke="#a7f3d0" strokeWidth="6" opacity=".6" /><path d="M0 120l70-50 50 30 60-60 80 80z" fill="#1e1b4b" opacity=".8" /></g>)
  else art = (<g><circle cx="300" cy="36" r="18" fill="#fffbeb" /><path d="M60 100q70-90 140 0" fill="none" stroke="#78350f" strokeWidth="6" /><path d="M40 100H220" stroke="#78350f" strokeWidth="5" /><path d="M0 104h400V120H0z" fill="#b45309" opacity=".5" /></g>)
  return (
    <svg viewBox="0 0 400 120" preserveAspectRatio="xMidYMid slice" width="100%" height={h} style={{ display: 'block' }} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={t.a} />
          <stop offset="1" stopColor={t.b} />
        </linearGradient>
      </defs>
      <rect width="400" height="120" fill={`url(#${id})`} />
      {art}
    </svg>
  )
}

// a stylised street map; deterministic block texture so it never flickers
function MapArt({ kind }) {
  const blocks = []
  let s = 7
  for (let i = 0; i < 46; i++) {
    s = (s * 9301 + 49297) % 233280
    const x = (s / 233280) * 94
    s = (s * 9301 + 49297) % 233280
    const y = (s / 233280) * 114
    blocks.push(<rect key={i} x={x} y={y} width={4 + (i % 4) * 2} height={3 + (i % 3) * 2} rx="0.8" fill="#dfe9e6" />)
  }
  const water = { coast: 'M0 90Q25 84 50 92T100 84V120H0z', river: 'M58 0Q50 30 56 60T44 120H54Q66 60 62 30T68 0z', bay: 'M0 0H40Q30 20 38 30T30 40Q10 44 0 36z M0 96Q30 90 60 104T100 98V120H0z' }[kind]
  return (
    <g>
      <rect width={MAP_W} height={MAP_H} fill="#f3f1e8" />
      {blocks}
      <g stroke="#fff" strokeWidth="1.6" fill="none" opacity=".95">
        <path d="M0 30H100M0 62H100M20 0V120M72 0V120" />
        <path d="M0 10L100 50M30 120L90 0" strokeWidth="1" />
      </g>
      <path d="M8 40q10-8 20 0t-4 14q-10 4-16-4z" fill="#cde8d3" />
      <path d="M78 70q10-6 16 2t-6 12q-10 2-12-6z" fill="#cde8d3" />
      <path d={water} fill="#bfe3ee" />
    </g>
  )
}

function Ring({ value, size = 132, color }) {
  const r = (size - 16) / 2
  const c = 2 * Math.PI * r
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${Math.round(value * 100)} percent packed`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={LINE} strokeWidth="12" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value)} transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: 'stroke-dashoffset .5s ease' }} />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" fontSize="28" fontWeight="800" fill={INK}>{Math.round(value * 100)}%</text>
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
          <rect x="0" y="7" width="3" height="4" rx="1" /><rect x="5" y="5" width="3" height="6" rx="1" /><rect x="10" y="2.5" width="3" height="8.5" rx="1" /><rect x="15" y="0" width="3" height="11" rx="1" />
        </svg>
        <svg width="26" height="12" viewBox="0 0 26 12">
          <rect x="0.5" y="0.5" width="22" height="11" rx="3.5" fill="none" stroke={INK} opacity=".45" /><rect x="2.5" y="2.5" width="16" height="7" rx="2" fill={INK} /><rect x="23.5" y="4" width="2" height="4" rx="1" fill={INK} opacity=".45" />
        </svg>
      </span>
    </div>
  )
}

function Switch({ on, set, label, accent }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => set(!on)} style={{ width: 48, height: 28, borderRadius: 14, border: 'none', padding: 3, background: on ? accent : '#c3d3d1', cursor: 'pointer', transition: 'background .2s', flex: 'none' }}>
      <span style={{ display: 'block', width: 22, height: 22, borderRadius: '50%', background: '#fff', transform: `translateX(${on ? 20 : 0}px)`, transition: 'transform .2s' }} />
    </button>
  )
}

const NAV = [
  ['trips', 'trips', 'Trips'],
  ['itinerary', 'plan', 'Itinerary'],
  ['map', 'map', 'Map'],
  ['packing', 'suitcase', 'Packing'],
]
function initial(s) {
  if (s === 'place') return { tab: 'itinerary', stack: [{ id: 'place', pid: 'castle' }] }
  return { tab: NAV.some((n) => n[0] === s) ? s : 'trips', stack: [] }
}

// ---------------------------------------------------------------- app

export default function TripApp({ name = 'Wayfarer', accent = '#0d9488', startScreen = 'trips', frame = true, style }) {
  const box = useRef()
  const view = useRef()
  const cont = useRef()
  const toastTimer = useRef()
  const dragRef = useRef(null)
  const overRef = useRef(null)
  const rowRefs = useRef({})
  const dayRefs = useRef({})
  const live = useRef({})
  const [scale, setScale] = useState(1)
  const [tab, setTab] = useState(() => initial(startScreen).tab)
  const [stack, setStack] = useState(() => initial(startScreen).stack)
  const [dir, setDir] = useState(1)
  const [toast, setToast] = useState('')
  const [tripId, setTripId] = useState('lisbon')
  const [shown, setShown] = useState(['lisbon', 'kyoto', 'reykjavik'])
  const [ts, setTs] = useState(seedState)
  const [drag, setDrag] = useState(null) // { pid, y, h } while dragging
  const [over, setOver] = useState(null) // { day, idx } where the placeholder sits
  const [sheet, setSheet] = useState(null) // { day }
  const [addCat, setAddCat] = useState('all')
  const [mapDay, setMapDay] = useState('all')
  const [mapSel, setMapSel] = useState(null)
  const [zoom, setZoom] = useState(1)
  const [packIn, setPackIn] = useState('')
  const [packCat, setPackCat] = useState('Clothes')

  useEffect(() => {
    const i = initial(startScreen)
    setTab(i.tab)
    setStack(i.stack)
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

  const trip = tripOf(tripId)
  const st = ts[tripId]
  const days = st.days
  const say = (t) => {
    setToast(t)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 1900)
  }
  const top = stack[stack.length - 1]
  const push = (s) => (setDir(1), setStack((a) => [...a, s]))
  const pop = () => (setDir(-1), setStack((a) => a.slice(0, -1)))
  const go = (t) => (setDir(NAV.findIndex((n) => n[0] === t) >= NAV.findIndex((n) => n[0] === tab) ? 1 : -1), setTab(t), setStack([]), setSheet(null))
  const upT = (fn) => setTs((s) => ({ ...s, [tripId]: fn(s[tripId]) }))
  const costOf = (pid) => st.meta[pid]?.cost ?? trip.byId[pid].cost
  const where = (pid) => {
    for (let i = 0; i < days.length; i++) {
      const k = days[i].stops.indexOf(pid)
      if (k >= 0) return { day: i, idx: k }
    }
    return null
  }
  const planned = days.reduce((a, d) => a + d.stops.reduce((b, p) => b + costOf(p), 0), 0)
  const stopCount = days.reduce((a, d) => a + d.stops.length, 0)
  const apply = (pid, dayId, idx) =>
    upT((s) => {
      const nd = s.days.map((d) => ({ ...d, stops: d.stops.filter((p) => p !== pid) }))
      const t = nd.find((d) => d.id === dayId)
      t.stops.splice(Math.min(idx, t.stops.length), 0, pid)
      return { ...s, days: nd }
    })
  const addStop = (pid, dayId) => {
    apply(pid, dayId, 999)
    say(`Added to Day ${days.findIndex((d) => d.id === dayId) + 1}`)
  }
  const removeStop = (pid) => upT((s) => ({ ...s, days: s.days.map((d) => ({ ...d, stops: d.stops.filter((p) => p !== pid) })) }))
  const shift = (pid, delta) => {
    const w = where(pid)
    if (!w) return
    const to = w.idx + delta
    if (to < 0 || to >= days[w.day].stops.length) return
    apply(pid, days[w.day].id, to)
  }
  live.current = { days, apply, scale, tripId }

  // ---- drag to reorder (listeners on window so it survives the row re-rendering)
  const startDrag = (e, pid, dayId) => {
    e.preventDefault()
    const row = rowRefs.current[pid]
    if (!row || !cont.current) return
    const r = row.getBoundingClientRect()
    const c = cont.current.getBoundingClientRect()
    dragRef.current = { pid, offY: e.clientY - r.top, ptrY: e.clientY, h: r.height / scale, from: dayId }
    overRef.current = { day: dayId, idx: Math.max(0, days.find((d) => d.id === dayId).stops.indexOf(pid)) }
    setOver(overRef.current)
    setDrag({ pid, y: (r.top - c.top) / scale, h: r.height / scale })
  }
  const dragging = !!drag
  useEffect(() => {
    if (!dragging) return undefined
    const follow = () => {
      const d = dragRef.current
      if (!d || !cont.current) return
      const L = live.current
      const c = cont.current.getBoundingClientRect()
      setDrag((x) => x && { ...x, y: (d.ptrY - d.offY - c.top) / L.scale })
      let best = null
      let bd = 1e9
      L.days.forEach((day) => {
        const el = dayRefs.current[day.id]
        if (!el) return
        const r = el.getBoundingClientRect()
        const dist = d.ptrY < r.top ? r.top - d.ptrY : d.ptrY > r.bottom ? d.ptrY - r.bottom : 0
        if (dist < bd) {
          bd = dist
          best = day
        }
      })
      if (!best) return
      const idx = best.stops.filter((p) => {
        if (p === d.pid) return false
        const el = rowRefs.current[p]
        if (!el) return false
        const r = el.getBoundingClientRect()
        return r.top + r.height / 2 < d.ptrY
      }).length
      const o = overRef.current
      if (!o || o.day !== best.id || o.idx !== idx) {
        overRef.current = { day: best.id, idx }
        setOver(overRef.current)
      }
    }
    const move = (e) => {
      if (!dragRef.current) return
      dragRef.current.ptrY = e.clientY
      follow()
    }
    const end = (e) => {
      const d = dragRef.current
      const o = overRef.current
      dragRef.current = null
      overRef.current = null
      setDrag(null)
      setOver(null)
      if (!d || !o || e.type === 'pointercancel') return
      live.current.apply(d.pid, o.day, o.idx)
      say(o.day !== d.from ? `Moved to Day ${live.current.days.findIndex((x) => x.id === o.day) + 1}` : 'Order updated')
    }
    const tick = setInterval(() => {
      const d = dragRef.current
      const v = view.current
      if (!d || !v) return
      const r = v.getBoundingClientRect()
      const edge = 64 * live.current.scale
      let dy = 0
      if (d.ptrY < r.top + edge) dy = -11
      else if (d.ptrY > r.bottom - edge) dy = 11
      if (dy) {
        v.scrollTop += dy
        follow()
      }
    }, 16)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
    return () => {
      clearInterval(tick)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging])

  // ---- shared bits
  const card = { background: '#fff', borderRadius: 20, boxShadow: '0 2px 10px rgba(14,42,47,.06)' }
  const btn = { display: 'grid', placeItems: 'center', width: 36, height: 36, borderRadius: '50%', border: 'none', background: '#fff', color: INK, cursor: 'pointer', padding: 0, boxShadow: '0 1px 4px rgba(14,42,47,.1)' }
  const header = (title, back, right) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 20px 6px', minHeight: 50 }}>
      {back && <button type="button" onClick={back} aria-label="Back" style={btn}><Icon name="back" size={19} /></button>}
      <h1 style={{ margin: 0, flex: 1, fontSize: back ? 18 : 28, fontWeight: 800, letterSpacing: '-0.02em' }}>{title}</h1>
      {right}
    </div>
  )
  const primary = (label, fn, o = {}) => (
    <button type="button" onClick={fn} disabled={o.disabled} style={{ width: '100%', height: 48, borderRadius: 24, border: o.ghost ? `1.5px solid ${o.danger ? '#fecdd3' : LINE}` : 'none', background: o.ghost ? 'transparent' : o.disabled ? '#c3d3d1' : accent, color: o.ghost ? (o.danger ? '#e11d48' : INK) : '#fff', font: 'inherit', fontSize: 14.5, fontWeight: 700, cursor: o.disabled ? 'default' : 'pointer' }}>{label}</button>
  )
  const chip = (on, label, fn, c = accent) => (
    <button key={label} type="button" onClick={fn} aria-pressed={on} style={{ flex: 'none', height: 32, padding: '0 13px', borderRadius: 16, border: `1.5px solid ${on ? c : LINE}`, background: on ? c : '#fff', color: on ? '#fff' : INK, font: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>{label}</button>
  )
  const catBadge = (cat, size = 38) => (
    <span style={{ width: size, height: size, borderRadius: size / 3, display: 'grid', placeItems: 'center', background: `${CATS[cat].c}1f`, color: CATS[cat].c, flex: 'none' }}>
      <Icon name={CATS[cat].icon} size={size * 0.52} />
    </span>
  )
  const chipHop = (a, b) => {
    const h = hop(trip.byId[a], trip.byId[b])
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 30, paddingLeft: 17 }} aria-label={`${h.min} minutes by ${h.mode} to next stop`}>
        <span style={{ width: 2, alignSelf: 'stretch', background: `repeating-linear-gradient(${LINE} 0 3px, transparent 3px 6px)`, marginRight: 5 }} />
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 22, padding: '0 9px', borderRadius: 11, background: '#e2efed', color: '#25585a', fontSize: 11.5, fontWeight: 700 }}>
          <Icon name={h.mode === 'walk' ? 'walk' : 'train'} size={13} w={2.2} /> {h.min} min · {h.km.toFixed(1)} km
        </span>
      </div>
    )
  }
  const stopCard = (pid, n, o = {}) => {
    const p = trip.byId[pid]
    const dc = DAY_COLORS[(o.dayIdx || 0) % DAY_COLORS.length]
    return (
      <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 8px 10px 10px', boxShadow: o.float ? '0 16px 34px rgba(14,42,47,.28)' : card.boxShadow, transform: o.float ? 'scale(1.02)' : 'none', border: o.float ? `1.5px solid ${accent}` : '1.5px solid transparent' }}>
        <span style={{ width: 26, height: 26, borderRadius: '50%', background: dc, color: '#fff', display: 'grid', placeItems: 'center', fontSize: 12.5, fontWeight: 800, flex: 'none' }}>{n}</span>
        <button type="button" onClick={o.float ? undefined : () => push({ id: 'place', pid })} style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10, border: 'none', background: 'none', padding: 0, font: 'inherit', color: INK, textAlign: 'left', cursor: 'pointer' }}>
          {catBadge(p.cat, 38)}
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
            <span style={{ display: 'block', fontSize: 11.5, color: MUTED, marginTop: 1 }}>{CATS[p.cat].label} · {dur(p.mins)} · {costOf(pid) ? money(costOf(pid)) : 'Free'}{st.meta[pid]?.booked ? ' · Booked' : ''}</span>
          </span>
        </button>
        <button
          type="button"
          aria-label={`Reorder ${p.name}. Drag, or use arrow keys.`}
          onPointerDown={o.float ? undefined : (e) => startDrag(e, pid, o.day)}
          onKeyDown={(e) => (e.key === 'ArrowUp' ? (e.preventDefault(), shift(pid, -1)) : e.key === 'ArrowDown' ? (e.preventDefault(), shift(pid, 1)) : null)}
          style={{ width: 38, height: 44, border: 'none', background: 'none', color: MUTED, cursor: 'grab', touchAction: 'none', display: 'grid', placeItems: 'center', padding: 0 }}
        >
          <Icon name="grip" size={22} w={3.2} />
        </button>
      </div>
    )
  }

  // ---- screens
  let body
  let tabbed = true
  if (top?.id === 'place') {
    tabbed = false
    const p = trip.byId[top.pid]
    const w = where(p.id)
    const meta = st.meta[p.id] || {}
    const setMeta = (patch) => upT((s) => ({ ...s, meta: { ...s.meta, [p.id]: { ...s.meta[p.id], ...patch } } }))
    const cost = costOf(p.id)
    body = (
      <>
        {header('Place', pop)}
        <div style={{ margin: '2px 20px 0', borderRadius: 22, overflow: 'hidden', position: 'relative' }}>
          <svg viewBox="0 0 350 150" width="100%" height="150" style={{ display: 'block' }} aria-hidden="true">
            <defs><linearGradient id="pl-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={CATS[p.cat].c} /><stop offset="1" stopColor={trip.b} /></linearGradient></defs>
            <rect width="350" height="150" fill="url(#pl-g)" />
            <circle cx="290" cy="44" r="46" fill="#fff" opacity=".18" />
            <circle cx="60" cy="140" r="70" fill="#fff" opacity=".14" />
            <path d="M0 120q60-30 120-8t120-10 110 12V150H0z" fill="#fff" opacity=".22" />
          </svg>
          <div style={{ position: 'absolute', left: 16, bottom: 14, color: '#fff' }}>
            <div style={{ fontSize: 22, fontWeight: 800, textShadow: '0 1px 6px rgba(0,0,0,.25)' }}>{p.name}</div>
            <div style={{ fontSize: 12.5, opacity: 0.95 }}>{CATS[p.cat].label} · {trip.name} · {dur(p.mins)}</div>
          </div>
        </div>
        <p style={{ margin: '12px 24px 0', fontSize: 14, lineHeight: 1.5, color: '#2c4a4f' }}>{p.blurb}</p>
        <div style={{ ...card, margin: '14px 20px 0', padding: '4px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 0', borderBottom: `1px solid ${LINE}` }}>
            <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>Cost</span>
            <button type="button" aria-label="Decrease cost" onClick={() => setMeta({ cost: Math.max(0, cost - 5) })} style={{ ...btn, width: 30, height: 30, background: '#eef4f3' }}><Icon name="minus" size={15} /></button>
            <span style={{ minWidth: 56, textAlign: 'center', fontSize: 16, fontWeight: 800 }}>{money(cost)}</span>
            <button type="button" aria-label="Increase cost" onClick={() => setMeta({ cost: cost + 5 })} style={{ ...btn, width: 30, height: 30, background: '#eef4f3' }}><Icon name="plus" size={15} /></button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 0', fontSize: 14, fontWeight: 600 }}>
            Booked
            <Switch on={!!meta.booked} set={(v) => (setMeta({ booked: v }), say(v ? 'Marked as booked' : 'Booking cleared'))} label="Booked" accent={accent} />
          </div>
        </div>
        <div style={{ ...card, margin: '12px 20px 0', padding: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: MUTED, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 6 }}>Notes</div>
          <textarea value={meta.note || ''} onChange={(e) => setMeta({ note: e.target.value })} placeholder="Opening hours, tickets, who is coming…" aria-label="Notes" rows={3} style={{ width: '100%', boxSizing: 'border-box', border: 'none', outline: 'none', resize: 'none', font: 'inherit', fontSize: 14, color: INK, background: 'transparent' }} />
        </div>
        <div style={{ margin: '12px 20px 0' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: MUTED, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 8 }}>{w ? `In itinerary · Day ${w.day + 1}, stop ${w.idx + 1}` : 'Not planned yet'}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {days.map((d, i) => chip(w?.day === i, `Day ${i + 1}`, () => (apply(p.id, d.id, 999), say(`Moved to Day ${i + 1}`)), DAY_COLORS[i % 4]))}
          </div>
        </div>
        <div style={{ padding: '16px 20px', display: 'grid', gap: 10 }}>
          {primary('Show on map', () => (setMapSel(p.id), setMapDay('all'), setDir(1), setTab('map'), setStack([])))}
          {w && primary('Remove from itinerary', () => (removeStop(p.id), say('Removed from itinerary')), { ghost: true, danger: true })}
        </div>
      </>
    )
  } else if (tab === 'trips') {
    const hidden = TRIPS.filter((t) => !shown.includes(t.id))
    body = (
      <>
        <div style={{ padding: '8px 20px 4px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: accent }}>{name}</div>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 800, letterSpacing: '-0.02em' }}>Your trips</h1>
        </div>
        <div style={{ display: 'grid', gap: 14, padding: '12px 20px 0' }}>
          {shown.map((id) => {
            const t = tripOf(id)
            const s = ts[id]
            const n = s.days.reduce((a, d) => a + d.stops.length, 0)
            const cost = s.days.reduce((a, d) => a + d.stops.reduce((b, p) => b + (s.meta[p]?.cost ?? t.byId[p].cost), 0), 0)
            const active = id === tripId
            const left = t.start
            return (
              <button key={id} type="button" onClick={() => (setTripId(id), setMapSel(null), setMapDay('all'), setDir(1), setTab('itinerary'), setStack([]))} aria-label={`Open ${t.name} trip`} style={{ ...card, padding: 0, overflow: 'hidden', border: active ? `2px solid ${accent}` : '2px solid transparent', textAlign: 'left', font: 'inherit', color: INK, cursor: 'pointer', display: 'block' }}>
                <div style={{ position: 'relative' }}>
                  <TripArt t={t} h={112} />
                  <span style={{ position: 'absolute', left: 12, top: 10, padding: '4px 10px', borderRadius: 12, background: 'rgba(255,255,255,.88)', fontSize: 11.5, fontWeight: 700 }}>In {left} days</span>
                </div>
                <div style={{ padding: '12px 16px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontSize: 19, fontWeight: 800 }}>{t.name}</span>
                    <span style={{ fontSize: 12.5, color: MUTED }}>{t.country}</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: MUTED, marginTop: 3 }}>{dayLabel(t, 0)} · {s.days.length} days · {n} stops · {money(cost)} of {money(s.budget)}</div>
                </div>
              </button>
            )
          })}
          {hidden.length > 0 ? (
            <button type="button" onClick={() => { const t = hidden[0]; setShown((a) => [...a, t.id]); setTripId(t.id); setDir(1); setTab('itinerary'); setStack([]); say(`${t.name} trip created`) }} style={{ height: 58, borderRadius: 20, border: `2px dashed ${accent}88`, background: 'none', color: accent, font: 'inherit', fontSize: 14.5, fontWeight: 700, cursor: 'pointer' }}>+ Plan a new trip</button>
          ) : (
            <div style={{ textAlign: 'center', fontSize: 12.5, color: MUTED, padding: '6px 0' }}>That is every destination in this demo. Open one to keep planning.</div>
          )}
        </div>
      </>
    )
  } else if (tab === 'itinerary') {
    const pct = Math.min(1, planned / st.budget)
    const over$ = planned > st.budget
    body = (
      <div ref={cont} style={{ position: 'relative' }}>
        <div style={{ margin: '0 0 0', position: 'relative' }}>
          <TripArt t={trip} h={96} />
          <div style={{ position: 'absolute', left: 20, bottom: 10, color: '#fff', textShadow: '0 1px 6px rgba(0,0,0,.35)' }}>
            <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em' }}>{trip.name}</div>
            <div style={{ fontSize: 12.5 }}>{dayLabel(trip, 0)} – {dayLabel(trip, days.length - 1)} · {stopCount} stops</div>
          </div>
        </div>
        <div style={{ ...card, margin: '-14px 20px 0', padding: '12px 14px', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11.5, color: MUTED, fontWeight: 600 }}>Planned budget</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: over$ ? '#e11d48' : INK }}>{money(planned)} <span style={{ fontSize: 13, color: MUTED, fontWeight: 600 }}>of {money(st.budget)}</span></div>
            </div>
            <button type="button" aria-label="Lower budget" onClick={() => upT((s) => ({ ...s, budget: Math.max(50, s.budget - 50) }))} style={{ ...btn, width: 30, height: 30, background: '#eef4f3' }}><Icon name="minus" size={15} /></button>
            <button type="button" aria-label="Raise budget" onClick={() => upT((s) => ({ ...s, budget: s.budget + 50 }))} style={{ ...btn, width: 30, height: 30, background: '#eef4f3' }}><Icon name="plus" size={15} /></button>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: LINE, marginTop: 8, overflow: 'hidden' }}><div style={{ width: `${pct * 100}%`, height: '100%', background: over$ ? '#e11d48' : accent, transition: 'width .3s' }} /></div>
        </div>
        <div style={{ padding: '6px 20px 0', fontSize: 12, color: MUTED }}>Drag the grip on a stop to reorder it, or drop it onto another day.</div>
        {days.map((day, di) => {
          const items = day.stops.filter((p) => !drag || p !== drag.pid).map((p) => ({ pid: p }))
          if (drag && over && over.day === day.id) items.splice(over.idx, 0, { ph: true, pid: drag.pid })
          let travel = 0
          let dayCost = 0
          items.forEach((it, i) => {
            dayCost += costOf(it.pid)
            if (i) travel += hop(trip.byId[items[i - 1].pid], trip.byId[it.pid]).min
          })
          const dc = DAY_COLORS[di % DAY_COLORS.length]
          return (
            <section key={day.id} ref={(el) => (dayRefs.current[day.id] = el)} style={{ padding: '14px 20px 0' }} aria-label={`Day ${di + 1}`}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ width: 8, height: 30, borderRadius: 4, background: dc }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 800 }}>Day {di + 1} <span style={{ fontWeight: 600, color: MUTED, fontSize: 13 }}>· {dayLabel(trip, di)}</span></div>
                  <div style={{ fontSize: 11.5, color: MUTED }}>{items.length} stops · {money(dayCost)}{travel ? ` · ${travel} min travelling` : ''}</div>
                </div>
                <button
                  type="button"
                  disabled={day.stops.length < 3}
                  onClick={() => {
                    const left = day.stops.slice(1)
                    const out = day.stops.slice(0, 1)
                    while (left.length) {
                      const last = trip.byId[out[out.length - 1]]
                      let bi = 0
                      left.forEach((p, i) => { if (hop(last, trip.byId[p]).min < hop(last, trip.byId[left[bi]]).min) bi = i })
                      out.push(left.splice(bi, 1)[0])
                    }
                    const calc = (a) => a.reduce((s, p, i) => s + (i ? hop(trip.byId[a[i - 1]], trip.byId[p]).min : 0), 0)
                    const saved = calc(day.stops) - calc(out)
                    upT((s) => ({ ...s, days: s.days.map((d) => (d.id === day.id ? { ...d, stops: out } : d)) }))
                    say(saved > 0 ? `Route optimized, ${saved} min saved` : 'Already the shortest route')
                  }}
                  aria-label={`Optimize Day ${di + 1} route`}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 30, padding: '0 11px', borderRadius: 15, border: `1.5px solid ${LINE}`, background: '#fff', color: day.stops.length < 3 ? '#a6bbb9' : accent, font: 'inherit', fontSize: 12, fontWeight: 700, cursor: day.stops.length < 3 ? 'default' : 'pointer' }}
                >
                  <Icon name="wand" size={14} /> Optimize
                </button>
              </div>
              <div>
                {items.map((it, i) => (
                  <div key={it.ph ? 'ph' : it.pid}>
                    {i > 0 && chipHop(items[i - 1].pid, it.pid)}
                    {it.ph ? (
                      <div style={{ height: drag.h, borderRadius: 20, border: `2px dashed ${accent}`, background: `${accent}12`, display: 'grid', placeItems: 'center', color: accent, fontSize: 12.5, fontWeight: 700 }}>{trip.byId[it.pid].name}</div>
                    ) : (
                      <div ref={(el) => (rowRefs.current[it.pid] = el)}>{stopCard(it.pid, i + 1, { day: day.id, dayIdx: di })}</div>
                    )}
                  </div>
                ))}
                {!items.length && <div style={{ height: 64, borderRadius: 20, border: `2px dashed ${LINE}`, display: 'grid', placeItems: 'center', color: MUTED, fontSize: 13 }}>Nothing planned. Drop a stop here or add one.</div>}
              </div>
              <button type="button" onClick={() => (setAddCat('all'), setSheet({ day: day.id }))} style={{ marginTop: 10, width: '100%', height: 42, borderRadius: 21, border: `1.5px dashed ${accent}88`, background: 'none', color: accent, font: 'inherit', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>+ Add stop to Day {di + 1}</button>
            </section>
          )
        })}
        <div style={{ padding: '16px 20px 0' }}>
          {primary('+ Add a day', () => (upT((s) => ({ ...s, days: [...s.days, { id: `d${Date.now()}`, stops: [] }] })), say('Day added')), { ghost: true })}
        </div>
        {drag && (
          <div style={{ position: 'absolute', left: 20, right: 20, top: drag.y, zIndex: 12, pointerEvents: 'none' }}>
            {stopCard(drag.pid, (over ? over.idx : 0) + 1, { float: true, dayIdx: Math.max(0, days.findIndex((d) => over && d.id === over.day)) })}
          </div>
        )}
      </div>
    )
  } else if (tab === 'map') {
    const vis = days.map((d, i) => ({ d, i })).filter(({ d }) => mapDay === 'all' || mapDay === d.id)
    const sched = new Set(days.flatMap((d) => d.stops))
    const selP = mapSel ? trip.byId[mapSel] : null
    const selW = selP ? where(selP.id) : null
    const vw = MAP_W / zoom
    const vh = MAP_H / zoom
    const cx = selP ? selP.x : MAP_W / 2
    const cy = selP ? selP.y : MAP_H / 2
    const vx = Math.max(0, Math.min(MAP_W - vw, cx - vw / 2))
    const vy = Math.max(0, Math.min(MAP_H - vh, cy - vh / 2))
    const prev = selW && selW.idx > 0 ? days[selW.day].stops[selW.idx - 1] : null
    body = (
      <>
        {header('Map', null, <span style={{ fontSize: 13, fontWeight: 700, color: accent }}>{trip.name}</span>)}
        <div className="tr-x" style={{ display: 'flex', gap: 8, padding: '2px 20px 10px', overflowX: 'auto' }}>
          {chip(mapDay === 'all', 'All days', () => setMapDay('all'))}
          {days.map((d, i) => chip(mapDay === d.id, `Day ${i + 1}`, () => setMapDay(d.id), DAY_COLORS[i % 4]))}
        </div>
        <div style={{ position: 'relative', margin: '0 20px', borderRadius: 22, overflow: "hidden", boxShadow: "0 2px 10px rgba(14,42,47,.1)", height: 400 }}>
          <svg viewBox={`${vx} ${vy} ${vw} ${vh}`} width="100%" height="100%" preserveAspectRatio="xMidYMid slice" role="img" aria-label={`Map of ${trip.name} with numbered stops`} style={{ display: 'block', background: '#f3f1e8' }}>
            <MapArt kind={trip.map} />
            {vis.map(({ d, i }) => d.stops.length > 1 && (
              <polyline key={d.id} points={d.stops.map((p) => `${trip.byId[p].x},${trip.byId[p].y}`).join(' ')} fill="none" stroke={DAY_COLORS[i % 4]} strokeWidth="1.1" strokeDasharray="2.2 1.6" strokeLinecap="round" strokeLinejoin="round" opacity=".9" />
            ))}
            {trip.places.filter((p) => !sched.has(p.id)).map((p) => (
              <g key={p.id} onClick={() => setMapSel(p.id)} style={{ cursor: 'pointer' }}>
                <circle cx={p.x} cy={p.y} r="4" fill="transparent" />
                <circle cx={p.x} cy={p.y} r="1.7" fill="#fff" stroke={CATS[p.cat].c} strokeWidth="0.8" />
              </g>
            ))}
            {vis.map(({ d, i }) => d.stops.map((pid, k) => {
              const p = trip.byId[pid]
              const on = pid === mapSel
              return (
                <g key={pid} onClick={() => setMapSel(pid)} style={{ cursor: 'pointer' }} role="button" aria-label={`Stop ${k + 1}: ${p.name}`}>
                  {on && <circle cx={p.x} cy={p.y} r="5.6" fill={DAY_COLORS[i % 4]} opacity=".25" />}
                  <circle cx={p.x} cy={p.y} r={on ? 3.9 : 3.3} fill={DAY_COLORS[i % 4]} stroke="#fff" strokeWidth="0.9" />
                  <text x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central" fontSize="3.6" fontWeight="800" fill="#fff" style={{ pointerEvents: 'none' }}>{k + 1}</text>
                </g>
              )
            }))}
          </svg>
          <div style={{ position: 'absolute', right: 10, top: 10, display: 'grid', gap: 6 }}>
            <button type="button" aria-label="Zoom in" onClick={() => setZoom((z) => Math.min(3, z + 0.5))} style={btn}><Icon name="plus" size={17} /></button>
            <button type="button" aria-label="Zoom out" onClick={() => setZoom((z) => Math.max(1, z - 0.5))} style={btn}><Icon name="minus" size={17} /></button>
          </div>
        </div>
        <div style={{ ...card, margin: '12px 20px 0', padding: '12px 14px' }}>
          {selP ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {catBadge(selP.cat, 40)}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selP.name}</div>
                  <div style={{ fontSize: 12, color: MUTED }}>{selW ? `Day ${selW.day + 1} · stop ${selW.idx + 1}` : 'Not planned yet'}{prev ? ` · ${hop(trip.byId[prev], selP).min} min from previous` : ''}</div>
                </div>
                <button type="button" onClick={() => push({ id: 'place', pid: selP.id })} style={{ height: 34, padding: '0 14px', borderRadius: 17, border: 'none', background: accent, color: '#fff', font: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>Open</button>
              </div>
              {!selW && (
                <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                  {days.map((d, i) => chip(false, `Add to Day ${i + 1}`, () => addStop(selP.id, d.id), DAY_COLORS[i % 4]))}
                </div>
              )}
            </>
          ) : (
            <div style={{ fontSize: 13, color: MUTED, textAlign: 'center', padding: '4px 0' }}>Tap a numbered pin for details. Hollow dots are places you have not planned yet.</div>
          )}
        </div>
      </>
    )
  } else {
    const done = st.pack.filter((x) => x.done).length
    const addItem = () => {
      const n = packIn.trim()
      if (!n) return
      upT((s) => ({ ...s, pack: [...s.pack, { id: `i${Date.now()}`, cat: packCat, name: n, done: false }] }))
      setPackIn('')
      say(`Added to ${packCat}`)
    }
    body = (
      <>
        {header('Packing', null, <span style={{ fontSize: 13, fontWeight: 700, color: accent }}>{trip.name}</span>)}
        <div style={{ ...card, margin: '4px 20px 0', padding: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
          <Ring value={st.pack.length ? done / st.pack.length : 0} color={accent} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 20, fontWeight: 800 }}>{done} of {st.pack.length}</div>
            <div style={{ fontSize: 12.5, color: MUTED, marginBottom: 8 }}>items packed</div>
            <div style={{ fontSize: 12.5, color: MUTED }}>Budget so far</div>
            <div style={{ fontSize: 17, fontWeight: 800 }}>{money(planned)} <span style={{ fontSize: 12, color: MUTED, fontWeight: 600 }}>/ {money(st.budget)}</span></div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, padding: '10px 20px 0' }}>
          <button type="button" onClick={() => (upT((s) => ({ ...s, pack: s.pack.map((x) => ({ ...x, done: true })) })), say('Everything packed'))} style={{ flex: 1, height: 36, borderRadius: 18, border: `1.5px solid ${LINE}`, background: '#fff', color: INK, font: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>Check all</button>
          <button type="button" onClick={() => (upT((s) => ({ ...s, pack: s.pack.map((x) => ({ ...x, done: false })) })), say('List reset'))} style={{ flex: 1, height: 36, borderRadius: 18, border: `1.5px solid ${LINE}`, background: '#fff', color: INK, font: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>Uncheck all</button>
        </div>
        {PACK_CATS.map((cat) => {
          const list = st.pack.filter((x) => x.cat === cat)
          if (!list.length) return null
          return (
            <div key={cat} style={{ padding: '14px 20px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, color: MUTED, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 6 }}>
                <span>{cat}</span><span>{list.filter((x) => x.done).length}/{list.length}</span>
              </div>
              <div style={{ ...card, padding: '2px 12px' }}>
                {list.map((x, i) => (
                  <div key={x.id} style={{ display: 'flex', alignItems: 'center', gap: 6, borderBottom: i < list.length - 1 ? `1px solid ${LINE}` : 'none' }}>
                    <button type="button" role="checkbox" aria-checked={x.done} onClick={() => upT((s) => ({ ...s, pack: s.pack.map((y) => (y.id === x.id ? { ...y, done: !y.done } : y)) }))} style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 12, height: 46, border: 'none', background: 'none', font: 'inherit', color: x.done ? MUTED : INK, textAlign: 'left', cursor: 'pointer', padding: 0 }}>
                      <span style={{ width: 24, height: 24, borderRadius: 8, border: `2px solid ${x.done ? accent : '#b4c8c6'}`, background: x.done ? accent : 'transparent', display: 'grid', placeItems: 'center', color: '#fff', flex: 'none', transition: 'background .15s' }}>{x.done && <Icon name="check" size={15} w={3} />}</span>
                      <span style={{ fontSize: 14.5, fontWeight: 600, textDecoration: x.done ? 'line-through' : 'none' }}>{x.name}</span>
                    </button>
                    <button type="button" aria-label={`Remove ${x.name}`} onClick={() => upT((s) => ({ ...s, pack: s.pack.filter((y) => y.id !== x.id) }))} style={{ width: 34, height: 34, border: 'none', background: 'none', color: '#9bb3b0', cursor: 'pointer', display: 'grid', placeItems: 'center', padding: 0 }}><Icon name="x" size={16} /></button>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
        <div style={{ ...card, margin: '16px 20px 0', padding: 12 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={packIn} onChange={(e) => setPackIn(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addItem()} placeholder="Add an item" aria-label="New item" style={{ flex: 1, minWidth: 0, height: 40, padding: '0 12px', borderRadius: 12, border: `1.5px solid ${LINE}`, outline: 'none', font: 'inherit', fontSize: 14, color: INK, background: '#f7fafa' }} />
            <button type="button" onClick={addItem} disabled={!packIn.trim()} aria-label="Add item" style={{ width: 40, height: 40, borderRadius: 12, border: 'none', background: packIn.trim() ? accent : '#c3d3d1', color: '#fff', cursor: packIn.trim() ? 'pointer' : 'default', display: 'grid', placeItems: 'center', padding: 0 }}><Icon name="plus" size={20} w={2.4} /></button>
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }} role="group" aria-label="Category">
            {PACK_CATS.map((c) => chip(packCat === c, c, () => setPackCat(c)))}
          </div>
        </div>
      </>
    )
  }

  const sheetEl = sheet && (
    <div style={{ position: 'absolute', inset: 0, zIndex: 40 }}>
      <button type="button" aria-label="Close" onClick={() => setSheet(null)} style={{ position: 'absolute', inset: 0, border: 'none', background: 'rgba(14,42,47,.45)', cursor: 'pointer' }} />
      <div className="tr-sheet" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '78%', display: 'flex', flexDirection: 'column', borderRadius: '26px 26px 0 0', background: BG, boxShadow: '0 -10px 30px rgba(0,0,0,.2)' }}>
        <div style={{ padding: '10px 20px 4px' }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: LINE, margin: '0 auto 12px' }} />
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ flex: 1, fontSize: 19, fontWeight: 800 }}>Add to Day {days.findIndex((d) => d.id === sheet.day) + 1}</div>
            <button type="button" aria-label="Close" onClick={() => setSheet(null)} style={btn}><Icon name="x" size={17} /></button>
          </div>
          <div className="tr-x" style={{ display: 'flex', gap: 8, padding: '10px 0 6px', overflowX: 'auto' }}>
            {chip(addCat === 'all', 'All', () => setAddCat('all'))}
            {Object.entries(CATS).map(([k, c]) => chip(addCat === k, c.label, () => setAddCat(k)))}
          </div>
        </div>
        <div className="tr-x" style={{ overflowY: 'auto', padding: '4px 20px 34px', display: 'grid', gap: 8 }}>
          {trip.places.filter((p) => addCat === 'all' || p.cat === addCat).map((p) => {
            const w = where(p.id)
            return (
              <div key={p.id} style={{ ...card, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px' }}>
                {catBadge(p.cat, 38)}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                  <div style={{ fontSize: 11.5, color: MUTED }}>{CATS[p.cat].label} · {dur(p.mins)} · {costOf(p.id) ? money(costOf(p.id)) : 'Free'}</div>
                </div>
                {w ? (
                  <span style={{ fontSize: 12, fontWeight: 700, color: MUTED, padding: '0 6px' }}>Day {w.day + 1}</span>
                ) : (
                  <button type="button" onClick={() => (addStop(p.id, sheet.day), setSheet(null))} style={{ height: 32, padding: '0 14px', borderRadius: 16, border: 'none', background: accent, color: '#fff', font: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>Add</button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )

  const phone = (
    <div style={{ position: 'relative', width: W, height: H, overflow: 'hidden', borderRadius: frame ? 46 : 0, background: BG, color: INK, fontFamily: "-apple-system, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif", userSelect: drag ? 'none' : 'auto' }}>
      <style>{`
        @keyframes tr-r { from { opacity: 0; transform: translateX(30px) } to { opacity: 1; transform: none } }
        @keyframes tr-l { from { opacity: 0; transform: translateX(-30px) } to { opacity: 1; transform: none } }
        @keyframes tr-up { from { transform: translateY(100%) } to { transform: none } }
        .tr-x { scrollbar-width: none } .tr-x::-webkit-scrollbar { display: none }
        .tr-sheet { animation: tr-up .3s cubic-bezier(.2,.8,.2,1) }
        .tr-app button:focus-visible, .tr-app input:focus-visible, .tr-app textarea:focus-visible, .tr-app [role=button]:focus-visible { outline: 2px solid ${accent}; outline-offset: 2px }
        @media (prefers-reduced-motion: reduce) { .tr-sheet, .tr-view { animation: none !important } }
      `}</style>
      <StatusBar frame={frame} />
      <div ref={view} key={`${tab}/${stack.map((s) => s.id).join('/')}`} className="tr-x tr-view" style={{ position: 'absolute', top: 54, bottom: tabbed ? TAB : 0, left: 0, right: 0, overflowY: 'auto', paddingBottom: 24, animation: `${dir > 0 ? 'tr-r' : 'tr-l'} .26s ease`, touchAction: drag ? 'none' : 'auto' }}>
        {body}
      </div>
      {tabbed && (
        <nav aria-label="Main" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: TAB, background: '#fff', borderRadius: '24px 24px 0 0', boxShadow: '0 -6px 20px rgba(14,42,47,.08)', display: 'flex', justifyContent: 'space-around', padding: '10px 8px 0' }}>
          {NAV.map(([id, icon, label]) => (
            <button key={id} type="button" onClick={() => go(id)} aria-current={tab === id ? 'page' : undefined} style={{ border: 'none', background: 'none', font: 'inherit', cursor: 'pointer', display: 'grid', justifyItems: 'center', alignContent: 'start', gap: 3, width: 70, height: 54, fontSize: 11, fontWeight: 700, color: tab === id ? accent : MUTED }}>
              <span style={{ width: 46, height: 28, borderRadius: 14, display: 'grid', placeItems: 'center', background: tab === id ? `${accent}1f` : 'transparent', transition: 'background .2s' }}><Icon name={icon} size={22} /></span>
              {label}
            </button>
          ))}
        </nav>
      )}
      {sheetEl}
      <div role="status" style={{ position: 'absolute', left: '50%', top: 58, zIndex: 50, transform: `translate(-50%, ${toast ? 0 : -90}px)`, transition: 'transform .35s cubic-bezier(.2,.8,.2,1)', padding: '10px 16px', borderRadius: 20, background: INK, color: '#fff', fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap' }}>{toast}</div>
      <div style={{ position: 'absolute', left: '50%', bottom: 8, width: 140, height: 5, marginLeft: -70, borderRadius: 3, background: INK, opacity: 0.8, zIndex: 45, pointerEvents: 'none' }} />
    </div>
  )

  return (
    <div ref={box} className="tr-app" style={{ position: 'relative', width: '100%', height: '100%', display: 'grid', placeItems: 'center', overflow: 'hidden', background: 'radial-gradient(ellipse at 50% 30%, #dff1ee, #9fc3be 78%)', ...style }}>
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: `translate(-50%, -50%) scale(${scale})`, transformOrigin: 'center' }}>
        {frame ? (
          <div style={{ padding: 12, borderRadius: 58, background: 'linear-gradient(145deg, #3a3f4a, #14171d 40%, #2b2f38)', boxShadow: '0 40px 80px rgba(10,50,55,.35), inset 0 0 0 2px #4b515e' }}>
            <div style={{ padding: 2, borderRadius: 48, background: '#000' }}>{phone}</div>
          </div>
        ) : (
          phone
        )}
      </div>
    </div>
  )
}
