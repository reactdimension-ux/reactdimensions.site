import { useEffect, useRef, useState } from 'react'

// A restaurant reservation app on a phone, as a click-through prototype.
// Discover lists restaurants you can search and filter by cuisine; a restaurant
// opens its page (menu, reviews and info tabs, heart to save) and Reserve goes
// to Pick time: choose a party size, a day and a free table slot (availability
// changes with the day and the party). Confirm takes a note and occasion and
// books the table, which lands in My bookings where you can modify it, cancel
// it, add it to a calendar, or book a past visit again. Saved holds your hearts.
// Detail screens slide in from the right. The phone scales to fit its box.

const W = 390 // the phone screen, in CSS px (an iPhone's width)
const H = 844
const BG = '#fbf3ee'
const INK = '#2a1a1d'
const MUTED = '#8d7b7c'
const LINE = '#eddcd3'
const DAY = 86400000

const TODAY = (() => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
})()
const dayDate = (n) => new Date(TODAY.getTime() + n * DAY)
const dayLabel = (n) => (n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : n === -7 ? 'Last week' : dayDate(n).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }))
const t12 = (s) => {
  const [h, m] = s.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

const LUNCH = ['12:00', '12:30', '13:00', '13:30', '14:00']
const DINNER = ['18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30']

const REST = [
  { id: 'r1', name: 'Osteria Lume', cuisine: 'Italian', price: 3, rating: 4.7, reviews: 1320, area: 'Old Town', hue: 18, dish: 'pasta', blurb: 'Hand-rolled pasta and a wood oven, lit by candles at every table.', menu: [['Cacio e pepe', 'Tonnarelli, pecorino, black pepper', 19], ['Burrata', 'Charred peach, basil oil', 16], ['Tagliata', 'Rib-eye, rocket, parmesan', 34], ['Tiramisu', 'Mascarpone, espresso', 10]], rev: [['Nina', 5, 'The best cacio e pepe outside Rome.'], ['Dev', 4, 'Loud and lovely. Book the corner table.']], lunch: true },
  { id: 'r2', name: 'Kiku Counter', cuisine: 'Japanese', price: 4, rating: 4.9, reviews: 612, area: 'Harbour', hue: 350, dish: 'sushi', blurb: 'An eight seat omakase counter. One sitting, twelve courses, no menu.', menu: [['Omakase', 'Twelve courses at the counter', 128], ['Sake pairing', 'Four small pours', 54], ['Chawanmushi', 'Savoury egg custard, crab', 14], ['Matcha ice', 'Hojicha crumble', 9]], rev: [['Yuki', 5, 'Every piece placed in your hand at the perfect moment.'], ['Tom', 5, 'Worth every dollar.']], lunch: false },
  { id: 'r3', name: 'Calle Sol', cuisine: 'Mexican', price: 2, rating: 4.4, reviews: 2045, area: 'Riverside', hue: 38, dish: 'taco', blurb: 'Street tacos, mezcal and a courtyard strung with lights.', menu: [['Al pastor tacos', 'Pineapple, onion, cilantro', 12], ['Guacamole', 'Made at the table', 11], ['Mole negro', 'Chicken, sesame, rice', 21], ['Churros', 'Cajeta dip', 8]], rev: [['Sam', 4, 'Great margaritas and a big patio.'], ['Lia', 5, 'The pastor is unreal.']], lunch: true },
  { id: 'r4', name: 'Ember & Oak', cuisine: 'Steakhouse', price: 4, rating: 4.6, reviews: 890, area: 'Midtown', hue: 8, dish: 'steak', blurb: 'Dry-aged beef cooked over oak embers, with a serious wine list.', menu: [['Ribeye 400g', 'Dry-aged 35 days', 62], ['Bone marrow', 'Toasted sourdough', 18], ['Truffle fries', 'Parmesan, chive', 12], ['Burnt cheesecake', 'Cherry compote', 11]], rev: [['Marc', 5, 'Perfect crust, perfect rest.'], ['Ana', 4, 'Pricey, but a proper occasion place.']], lunch: false },
  { id: 'r5', name: 'Maison Pale', cuisine: 'French', price: 3, rating: 4.5, reviews: 704, area: 'Garden District', hue: 330, dish: 'souffle', blurb: 'A neighbourhood bistro with zinc bar, steak frites and a famous souffle.', menu: [['Onion soup', 'Gruyere crouton', 14], ['Steak frites', 'Hanger, bearnaise', 29], ['Duck confit', 'Lentils, orange', 31], ['Grand Marnier souffle', 'Order with the main', 15]], rev: [['Elsa', 5, 'Like being in Paris for an evening.'], ['Jon', 4, 'Order the souffle early.']], lunch: true },
  { id: 'r6', name: 'Spice Route', cuisine: 'Indian', price: 2, rating: 4.5, reviews: 1587, area: 'Market Street', hue: 28, dish: 'curry', blurb: 'Clay oven breads and slow curries from three regions, served family style.', menu: [['Butter chicken', 'Tandoori thigh, tomato, cream', 18], ['Paneer tikka', 'Mint chutney', 14], ['Garlic naan', 'From the clay oven', 5], ['Kulfi', 'Pistachio, rose', 7]], rev: [['Ravi', 5, 'The naan alone is worth the trip.'], ['Kay', 4, 'Generous portions, friendly team.']], lunch: true },
]
const CUISINES = ['All', ...new Set(REST.map((r) => r.cuisine))]
const OCC = ['Birthday', 'Anniversary', 'Business', 'Window seat', 'Allergy note']

const ICONS = {
  compass: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM15.500 8.500l-2 5-5 2 2-5z',
  heart: 'M12 20s-7-4.400-9-9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c-2 4.600-9 9-9 9z',
  cal: 'M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zM4 10h16M8 3v4M16 3v4',
  back: 'M15 5l-7 7 7 7',
  chev: 'M9 5l7 7-7 7',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  pin: 'M12 21s-6-5.500-6-10a6 6 0 0 1 12 0c0 4.500-6 10-6 10zM12 13a2.500 2.500 0 1 0 0-5 2.500 2.500 0 0 0 0 5z',
  star: 'M12 3l2.700 5.600 6.100.8-4.500 4.200 1.100 6-5.400-3-5.400 3 1.100-6L3.200 9.400l6.100-.8z',
  check: 'M5 12l5 5 9-10',
  x: 'M6 6l12 12M18 6L6 18',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  users: 'M9 11a3.500 3.500 0 1 0 0-7 3.500 3.500 0 0 0 0 7zM2.500 20a6.500 6.500 0 0 1 13 0M16 4.500a3.500 3.500 0 0 1 0 6.500M18 14a6 6 0 0 1 3.500 6',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
}

function Icon({ name, size = 22, color = 'currentColor', w = 1.9, fill = 'none' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  )
}

// a plated-dish illustration on a coloured tablecloth
function DishArt({ r, height = 140, radius = 0 }) {
  const bgA = `hsl(${r.hue} 55% 30%)`
  const bgB = `hsl(${r.hue + 20} 60% 18%)`
  const gid = `rv-${r.id}`
  return (
    <svg viewBox="0 0 400 240" width="100%" height={height} preserveAspectRatio="xMidYMid slice" role="img" aria-label={`${r.name} dish illustration`} style={{ display: 'block', borderRadius: radius }}>
      <defs><radialGradient id={gid} cx=".5" cy=".4" r=".9"><stop offset="0" stopColor={bgA} /><stop offset="1" stopColor={bgB} /></radialGradient></defs>
      <rect width="400" height="240" fill={`url(#${gid})`} />
      {[40, 340, 80, 300].map((x, i) => <circle key={x} cx={x} cy={30 + i * 14} r="3" fill="#ffd9a0" opacity=".35" />)}
      <circle cx="200" cy="125" r="92" fill="#f7efe6" />
      <circle cx="200" cy="125" r="74" fill="#fff" stroke="#e4d6c8" strokeWidth="2" />
      {r.dish === 'pasta' && <g fill="none" strokeLinecap="round">{[0, 1, 2, 3, 4].map((i) => <path key={i} d={`M${150 + i * 4} ${105 + i * 9} q50 -${18 - i * 2} 100 0`} stroke="#eab45a" strokeWidth="7" />)}<circle cx="215" cy="104" r="5" fill="#3d8b4a" /><circle cx="180" cy="112" r="4" fill="#3d8b4a" /></g>}
      {r.dish === 'sushi' && <g>{[0, 1, 2, 3].map((i) => <g key={i} transform={`translate(${148 + i * 26} ${112 + (i % 2) * 12})`}><rect width="24" height="16" rx="5" fill="#f9f2e2" /><rect x="-2" y="-5" width="28" height="11" rx="5" fill={['#f07a6a', '#f5a05a', '#e85c5c', '#f6c18a'][i]} /></g>)}</g>}
      {r.dish === 'taco' && <g>{[0, 1].map((i) => <g key={i} transform={`translate(${i * 36} ${i * 8})`}><path d="M148 128 a38 38 0 0 1 76 0z" fill="#e9c57c" /><path d="M156 124 q30 -26 60 0" fill="none" stroke="#3d8b4a" strokeWidth="6" strokeLinecap="round" /><circle cx="186" cy="114" r="4" fill="#d6453a" /></g>)}</g>}
      {r.dish === 'steak' && <g><ellipse cx="200" cy="125" rx="46" ry="32" fill="#7a3328" /><ellipse cx="200" cy="122" rx="38" ry="25" fill="#a24432" /><path d="M170 120 h60M174 130 h52" stroke="#4d1d17" strokeWidth="3" strokeLinecap="round" /><circle cx="248" cy="108" r="7" fill="#3d8b4a" /></g>}
      {r.dish === 'souffle' && <g><rect x="170" y="108" width="60" height="40" rx="6" fill="#fff" stroke="#d9c9b8" strokeWidth="3" /><ellipse cx="200" cy="106" rx="34" ry="22" fill="#f4cf80" /><path d="M172 108 q28 -34 56 0" fill="#f2c066" /></g>}
      {r.dish === 'curry' && <g><circle cx="200" cy="125" r="42" fill="#d98a2b" /><circle cx="200" cy="125" r="34" fill="#e8a23a" /><circle cx="188" cy="118" r="7" fill="#fff3d4" /><circle cx="212" cy="130" r="7" fill="#fff3d4" /><path d="M244 100 q22 4 20 34 q-26 -6 -20 -34z" fill="#f0d9a0" stroke="#d8b96d" strokeWidth="2" /></g>}
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

const iconBtn = { display: 'grid', placeItems: 'center', border: 'none', borderRadius: '50%', cursor: 'pointer', padding: 0, background: '#fff', color: INK, boxShadow: '0 2px 8px rgba(70,20,30,.12)' }

const NAV = [
  ['discover', 'compass', 'Discover'],
  ['saved', 'heart', 'Saved'],
  ['bookings', 'cal', 'Bookings'],
]

// deterministic "is this table taken" so a given day always looks the same
function taken(rid, day, slot, party) {
  let h = 17
  for (const c of `${rid}${day}${slot}`) h = (h * 31 + c.charCodeAt(0)) % 997
  return h % 100 < 24 + Math.max(0, party - 4) * 12
}

const money = (n) => '$'.repeat(n) + '·'.repeat(4 - n)

// ---------------------------------------------------------------- app

export default function ReservationApp({ name = 'Tablewise', accent = '#b42343', startScreen = 'discover', frame = true, style }) {
  const box = useRef()
  const toastTimer = useRef()
  const [scale, setScale] = useState(1)
  const [tab, setTab] = useState('discover')
  const [stack, setStack] = useState([])
  const [dir, setDir] = useState(1)
  const [toast, setToast] = useState('')
  const [cuisine, setCuisine] = useState('All')
  const [query, setQuery] = useState('')
  const [saved, setSaved] = useState({ r2: true })
  const [rtab, setRtab] = useState('menu')
  const [sel, setSel] = useState({ rid: 'r1', party: 2, day: 1, slot: null, occ: [], note: '', sms: true, edit: null })
  const [seg, setSeg] = useState('up')
  const [ask, setAsk] = useState(null)
  const [rated, setRated] = useState({})
  const [books, setBooks] = useState(() => [
    { id: 'b1', rid: 'r4', party: 4, day: 5, slot: '20:00', note: 'Window seat', code: 'TW-4821', status: 'Confirmed' },
    { id: 'b0', rid: 'r6', party: 2, day: -7, slot: '19:00', note: '', code: 'TW-3317', status: 'Completed' },
  ])

  useEffect(() => {
    setDir(1)
    const rs = { id: 'restaurant', rid: 'r1' }
    setTab(startScreen === 'bookings' ? 'bookings' : 'discover')
    setRtab('menu')
    if (startScreen === 'restaurant') setStack([rs])
    else if (startScreen === 'time') (setSel((s) => ({ ...s, rid: 'r1', slot: null, edit: null })), setStack([rs, { id: 'time' }]))
    else if (startScreen === 'confirm') (setSel((s) => ({ ...s, rid: 'r1', day: 1, party: 2, slot: '19:30', edit: null })), setStack([rs, { id: 'time' }, { id: 'confirm' }]))
    else setStack([])
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
  const openRest = (rid) => (setRtab('menu'), setSel((s) => ({ ...s, rid, slot: null, edit: null, occ: [], note: '' })), push({ id: 'restaurant', rid }))

  const rest = REST.find((r) => r.id === sel.rid)

  const confirm = () => {
    const b = { id: sel.edit || `b${Date.now()}`, rid: sel.rid, party: sel.party, day: sel.day, slot: sel.slot, note: [...sel.occ, sel.note.trim()].filter(Boolean).join(' · '), code: `TW-${1000 + Math.floor(Math.random() * 8999)}`, status: 'Confirmed' }
    setBooks((a) => (sel.edit ? a.map((x) => (x.id === sel.edit ? { ...b, code: x.code } : x)) : [b, ...a]))
    setDir(1)
    setStack([{ id: 'done', b: sel.edit ? { ...b, code: books.find((x) => x.id === sel.edit)?.code || b.code } : b, edited: !!sel.edit }])
  }

  // ---- shared bits
  const header = (title, back, right) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px 6px', minHeight: 48 }}>
      {back && <button type="button" onClick={back} aria-label="Back" style={{ ...iconBtn, width: 38, height: 38 }}><Icon name="back" size={20} /></button>}
      <h1 style={{ margin: 0, flex: 1, fontSize: back ? 18 : 28, fontWeight: 800, fontFamily: 'Georgia, serif', fontStyle: back ? 'normal' : 'italic', letterSpacing: '-0.01em', marginLeft: 4 }}>{title}</h1>
      {right}
    </div>
  )

  const primary = (label, onClick, disabled) => (
    <button type="button" disabled={disabled} onClick={onClick} style={{ width: '100%', height: 52, borderRadius: 26, border: 'none', background: disabled ? '#d9c8c2' : accent, color: '#fff', font: 'inherit', fontSize: 15, fontWeight: 700, cursor: disabled ? 'default' : 'pointer' }}>{label}</button>
  )
  const ghost = (label, onClick) => (
    <button type="button" onClick={onClick} style={{ width: '100%', height: 46, borderRadius: 23, border: `1px solid ${LINE}`, background: '#fff', color: INK, font: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>{label}</button>
  )

  const heart = (r, size = 36) => (
    <button type="button" aria-label={saved[r.id] ? `Remove ${r.name} from saved` : `Save ${r.name}`} aria-pressed={!!saved[r.id]} onClick={(e) => { e.stopPropagation(); setSaved((s) => ({ ...s, [r.id]: !s[r.id] })); say(saved[r.id] ? 'Removed from Saved' : 'Saved') }} style={{ ...iconBtn, width: size, height: size, background: 'rgba(255,255,255,.92)', color: saved[r.id] ? '#e0475b' : INK }}>
      <Icon name="heart" size={size * 0.52} fill={saved[r.id] ? '#e0475b' : 'none'} />
    </button>
  )

  const chip = (label, on, fn) => (
    <button key={label} type="button" onClick={fn} aria-pressed={on} style={{ flex: 'none', height: 36, padding: '0 15px', borderRadius: 18, border: `1px solid ${on ? accent : LINE}`, background: on ? accent : '#fff', color: on ? '#fff' : INK, font: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{label}</button>
  )

  const restCard = (r) => (
    <div key={r.id} style={{ position: 'relative' }}>
      <button type="button" onClick={() => openRest(r.id)} style={{ display: 'block', width: '100%', padding: 0, border: 'none', borderRadius: 22, background: '#fff', font: 'inherit', textAlign: 'left', cursor: 'pointer', color: INK, overflow: 'hidden', boxShadow: '0 6px 18px rgba(90,30,40,.1)' }}>
        <DishArt r={r} height={130} />
        <div style={{ padding: '12px 14px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: 17, fontWeight: 800, fontFamily: 'Georgia, serif' }}>{r.name}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 13, fontWeight: 800, color: accent }}><Icon name="star" size={14} fill={accent} /> {r.rating}</span>
          </div>
          <div style={{ fontSize: 12.5, color: MUTED, marginTop: 3 }}>{r.cuisine} · {money(r.price)} · {r.area}</div>
          <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
            {(r.lunch ? ['13:00', '19:00', '20:30'] : ['18:30', '20:00', '21:30']).map((s) => (
              <span key={s} style={{ padding: '4px 10px', borderRadius: 12, background: `${accent}14`, color: accent, fontSize: 12, fontWeight: 700 }}>{t12(s)}</span>
            ))}
          </div>
        </div>
      </button>
      <span style={{ position: 'absolute', top: 10, right: 10 }}>{heart(r)}</span>
    </div>
  )

  const slotBtn = (s) => {
    const full = taken(sel.rid, sel.day, s, sel.party)
    const on = sel.slot === s
    return (
      <button key={s} type="button" disabled={full} aria-pressed={on} onClick={() => setSel((x) => ({ ...x, slot: s }))} style={{ height: 44, borderRadius: 14, border: `1px solid ${on ? accent : LINE}`, background: on ? accent : full ? '#f3e9e4' : '#fff', color: on ? '#fff' : full ? '#c2b0ab' : INK, font: 'inherit', fontSize: 13.5, fontWeight: 700, cursor: full ? 'default' : 'pointer', textDecoration: full ? 'line-through' : 'none' }}>{t12(s)}</button>
    )
  }

  const row = (k, v) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: `1px solid ${LINE}`, fontSize: 14 }}>
      <span style={{ color: MUTED }}>{k}</span><span style={{ fontWeight: 700, textAlign: 'right' }}>{v}</span>
    </div>
  )

  // ---- screens
  let body
  let tabbed = true
  if (top?.id === 'restaurant') {
    tabbed = false
    const r = REST.find((x) => x.id === sel.rid)
    body = (
      <>
        <div style={{ position: 'relative' }}>
          <DishArt r={r} height={230} />
          <span style={{ position: 'absolute', top: 6, left: 16 }}><button type="button" onClick={pop} aria-label="Back" style={{ ...iconBtn, width: 38, height: 38 }}><Icon name="back" size={20} /></button></span>
          <span style={{ position: 'absolute', top: 6, right: 16 }}>{heart(r, 38)}</span>
        </div>
        <div style={{ padding: '16px 20px 0' }}>
          <h2 style={{ margin: 0, fontSize: 26, fontFamily: 'Georgia, serif', letterSpacing: '-0.01em' }}>{r.name}</h2>
          <div style={{ fontSize: 13, color: MUTED, marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="star" size={14} fill={accent} color={accent} /> <b style={{ color: INK }}>{r.rating}</b> ({r.reviews.toLocaleString()}) · {r.cuisine} · {money(r.price)}</div>
          <p style={{ fontSize: 14, lineHeight: 1.5, color: '#5a4547', margin: '10px 0 0' }}>{r.blurb}</p>
        </div>
        <div role="tablist" style={{ display: 'flex', margin: '16px 20px 0', padding: 3, background: '#f1e4dc', borderRadius: 20 }}>
          {[['menu', 'Menu'], ['reviews', 'Reviews'], ['info', 'Info']].map(([id, l]) => (
            <button key={id} type="button" role="tab" aria-selected={rtab === id} onClick={() => setRtab(id)} style={{ flex: 1, height: 36, border: 'none', borderRadius: 17, background: rtab === id ? '#fff' : 'transparent', color: rtab === id ? INK : MUTED, font: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: rtab === id ? '0 2px 6px rgba(70,20,30,.1)' : 'none' }}>{l}</button>
          ))}
        </div>
        <div style={{ margin: '10px 20px 0', padding: '2px 16px', background: '#fff', borderRadius: 20 }}>
          {rtab === 'menu' && r.menu.map(([n, d, p]) => (
            <button key={n} type="button" onClick={() => say(`${n} added to your wishlist`)} style={{ display: 'flex', gap: 10, width: '100%', padding: '12px 0', border: 'none', borderBottom: `1px solid ${LINE}`, background: 'none', font: 'inherit', textAlign: 'left', cursor: 'pointer', color: INK }}>
              <span style={{ flex: 1 }}><span style={{ display: 'block', fontSize: 14.5, fontWeight: 700 }}>{n}</span><span style={{ fontSize: 12.5, color: MUTED }}>{d}</span></span>
              <span style={{ fontWeight: 800, fontSize: 14 }}>${p}</span>
            </button>
          ))}
          {rtab === 'reviews' && r.rev.map(([who, stars, txt]) => (
            <div key={who} style={{ padding: '12px 0', borderBottom: `1px solid ${LINE}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, fontWeight: 800 }}><span>{who}</span><span style={{ color: accent }}>{'★'.repeat(stars)}{'☆'.repeat(5 - stars)}</span></div>
              <div style={{ fontSize: 13.5, color: '#5a4547', marginTop: 4, lineHeight: 1.45 }}>{txt}</div>
            </div>
          ))}
          {rtab === 'info' && (
            <>
              {row('Area', r.area)}
              {row('Hours', r.lunch ? '12:00 to 22:00' : '18:00 to 23:00')}
              {row('Dress code', r.price >= 4 ? 'Smart' : 'Casual')}
              <button type="button" onClick={() => say('Calling the restaurant...')} style={{ display: 'block', width: '100%', padding: '13px 0', border: 'none', background: 'none', font: 'inherit', fontWeight: 700, color: accent, cursor: 'pointer', textAlign: 'left', fontSize: 14 }}>Call restaurant</button>
            </>
          )}
        </div>
        <div style={{ padding: '16px 20px' }}>{primary('Reserve a table', () => push({ id: 'time' }))}</div>
      </>
    )
  } else if (top?.id === 'time') {
    tabbed = false
    const slots = rest.lunch ? [...LUNCH, ...DINNER] : DINNER
    body = (
      <>
        {header(sel.edit ? 'Change booking' : 'Pick a time', pop)}
        <div style={{ padding: '0 20px', fontSize: 13.5, color: MUTED }}>{rest.name} · {rest.area}</div>
        <div style={{ margin: '12px 20px 0', padding: '4px 16px', background: '#fff', borderRadius: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15, fontWeight: 700 }}><Icon name="users" size={20} color={accent} /> Party size</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <button type="button" aria-label="Fewer guests" disabled={sel.party <= 1} onClick={() => setSel((s) => ({ ...s, party: s.party - 1, slot: null }))} style={{ ...iconBtn, width: 36, height: 36, border: `1px solid ${LINE}`, boxShadow: 'none', opacity: sel.party <= 1 ? 0.35 : 1 }}><Icon name="minus" size={17} /></button>
              <span style={{ width: 18, textAlign: 'center', fontSize: 17, fontWeight: 800 }}>{sel.party}</span>
              <button type="button" aria-label="More guests" disabled={sel.party >= 10} onClick={() => setSel((s) => ({ ...s, party: s.party + 1, slot: null }))} style={{ ...iconBtn, width: 36, height: 36, border: `1px solid ${LINE}`, boxShadow: 'none', opacity: sel.party >= 10 ? 0.35 : 1 }}><Icon name="plus" size={17} /></button>
            </span>
          </div>
        </div>
        <div className="rv-scroll" style={{ display: 'flex', gap: 8, padding: '14px 20px 6px', overflowX: 'auto' }} role="group" aria-label="Day">
          {[0, 1, 2, 3, 4, 5, 6].map((d) => (
            <button key={d} type="button" aria-pressed={sel.day === d} onClick={() => setSel((s) => ({ ...s, day: d, slot: null }))} style={{ flex: 'none', width: 62, padding: '9px 0', borderRadius: 16, border: `1px solid ${sel.day === d ? accent : LINE}`, background: sel.day === d ? accent : '#fff', color: sel.day === d ? '#fff' : INK, font: 'inherit', cursor: 'pointer' }}>
              <span style={{ display: 'block', fontSize: 11, fontWeight: 700, opacity: 0.8 }}>{d === 0 ? 'Today' : dayDate(d).toLocaleDateString('en-GB', { weekday: 'short' })}</span>
              <span style={{ display: 'block', fontSize: 18, fontWeight: 800 }}>{dayDate(d).getDate()}</span>
            </button>
          ))}
        </div>
        {[['Lunch', slots.filter((s) => s < '15:00')], ['Dinner', slots.filter((s) => s >= '15:00')]].filter(([, l]) => l.length).map(([label, l]) => (
          <div key={label} style={{ padding: '10px 20px 0' }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: MUTED, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 8 }}>{label}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>{l.map(slotBtn)}</div>
          </div>
        ))}
        <div style={{ padding: '10px 22px 0', fontSize: 12, color: MUTED }}>Crossed out times are fully booked for {sel.party} {sel.party > 1 ? 'guests' : 'guest'}.</div>
        <div style={{ padding: '14px 20px' }}>{primary(sel.slot ? `Continue · ${t12(sel.slot)}` : 'Choose a time', () => push({ id: 'confirm' }), !sel.slot)}</div>
      </>
    )
  } else if (top?.id === 'confirm') {
    tabbed = false
    body = (
      <>
        {header('Confirm', pop)}
        <div style={{ margin: '4px 20px 0', borderRadius: 22, overflow: 'hidden', background: '#fff' }}>
          <DishArt r={rest} height={90} />
          <div style={{ padding: '4px 16px 6px' }}>
            {row('Restaurant', rest.name)}
            {row('Date', dayLabel(sel.day))}
            {row('Time', t12(sel.slot || '19:00'))}
            <div style={{ borderBottom: 'none' }}>{row('Party', `${sel.party} ${sel.party > 1 ? 'guests' : 'guest'}`)}</div>
          </div>
        </div>
        <div style={{ padding: '16px 20px 0' }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: MUTED, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 8 }}>Occasion and requests</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {OCC.map((o) => chip(o, sel.occ.includes(o), () => setSel((s) => ({ ...s, occ: s.occ.includes(o) ? s.occ.filter((x) => x !== o) : [...s.occ, o] }))))}
          </div>
          <textarea value={sel.note} onChange={(e) => setSel((s) => ({ ...s, note: e.target.value }))} placeholder="Anything else the restaurant should know?" aria-label="Note" rows={2} style={{ width: '100%', boxSizing: 'border-box', marginTop: 12, padding: 12, borderRadius: 14, border: `1px solid ${LINE}`, background: '#fff', font: 'inherit', fontSize: 14, color: INK, resize: 'none' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 2px 0', fontSize: 14, fontWeight: 700 }}>
            SMS reminder 2 hours before
            <button type="button" role="switch" aria-checked={sel.sms} aria-label="SMS reminder" onClick={() => setSel((s) => ({ ...s, sms: !s.sms }))} style={{ width: 48, height: 28, borderRadius: 14, border: 'none', padding: 3, background: sel.sms ? accent : '#d9c8c2', cursor: 'pointer', transition: 'background .2s' }}>
              <span style={{ display: 'block', width: 22, height: 22, borderRadius: '50%', background: '#fff', transform: `translateX(${sel.sms ? 20 : 0}px)`, transition: 'transform .2s' }} />
            </button>
          </div>
        </div>
        <div style={{ padding: '16px 20px', display: 'grid', gap: 8 }}>
          {primary(sel.edit ? 'Save changes' : 'Confirm reservation', confirm, !sel.slot)}
          <div style={{ fontSize: 12, color: MUTED, textAlign: 'center' }}>Free to cancel up to 2 hours before.</div>
        </div>
      </>
    )
  } else if (top?.id === 'done') {
    tabbed = false
    const b = top.b
    const r = REST.find((x) => x.id === b.rid)
    body = (
      <div style={{ textAlign: 'center', padding: '80px 24px 0' }}>
        <span className="rv-anim" style={{ width: 92, height: 92, borderRadius: '50%', display: 'inline-grid', placeItems: 'center', background: `${accent}1f`, color: accent, animation: 'rv-pop .5s cubic-bezier(.2,1.4,.4,1) both' }}><Icon name="check" size={46} w={2.6} /></span>
        <div style={{ fontSize: 27, fontFamily: 'Georgia, serif', fontStyle: 'italic', fontWeight: 800, marginTop: 20 }}>{top.edited ? 'Booking updated' : 'Table reserved'}</div>
        <div style={{ fontSize: 14, color: MUTED, marginTop: 6, lineHeight: 1.5 }}>{r.name}<br />{dayLabel(b.day)} at {t12(b.slot)} · {b.party} {b.party > 1 ? 'guests' : 'guest'}</div>
        <div style={{ display: 'inline-block', marginTop: 16, padding: '8px 16px', borderRadius: 14, background: '#fff', fontSize: 13, fontWeight: 800, letterSpacing: '.1em' }}>{b.code}</div>
        <div style={{ display: 'grid', gap: 10, marginTop: 34 }}>
          {primary('View my bookings', () => (setSeg('up'), setDir(1), setTab('bookings'), setStack([])))}
          <button type="button" onClick={() => (setDir(-1), setTab('discover'), setStack([]))} style={{ height: 44, border: 'none', background: 'none', font: 'inherit', fontSize: 14, fontWeight: 600, color: MUTED, cursor: 'pointer' }}>Keep exploring</button>
        </div>
      </div>
    )
  } else if (tab === 'discover') {
    const list = REST.filter((r) => (cuisine === 'All' || r.cuisine === cuisine) && (!query || `${r.name} ${r.cuisine} ${r.area}`.toLowerCase().includes(query.toLowerCase())))
    body = (
      <>
        <div style={{ padding: '8px 20px 0' }}>
          <div style={{ fontSize: 13, color: MUTED }}>{name}</div>
          <h1 style={{ margin: '2px 0 0', fontSize: 30, lineHeight: 1.1, fontFamily: 'Georgia, serif', fontStyle: 'italic', letterSpacing: '-0.02em' }}>Dinner tonight?</h1>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 20px 0', padding: '0 14px', height: 46, borderRadius: 23, background: '#fff', boxShadow: '0 4px 14px rgba(90,30,40,.08)' }}>
          <Icon name="search" size={19} color={MUTED} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Restaurant, cuisine or area" aria-label="Search restaurants" style={{ flex: 1, border: 'none', outline: 'none', background: 'none', font: 'inherit', fontSize: 15, color: INK }} />
          {query && <button type="button" aria-label="Clear search" onClick={() => setQuery('')} style={{ ...iconBtn, width: 26, height: 26, boxShadow: 'none', background: '#f1e4dc' }}><Icon name="x" size={13} /></button>}
        </label>
        <div className="rv-scroll" style={{ display: 'flex', gap: 8, padding: '12px 20px 12px', overflowX: 'auto' }}>
          {CUISINES.map((c) => chip(c, cuisine === c, () => setCuisine(c)))}
        </div>
        <div style={{ display: 'grid', gap: 16, padding: '0 20px' }}>
          {list.map(restCard)}
          {!list.length && (
            <div style={{ textAlign: 'center', padding: '40px 16px', color: MUTED, fontSize: 14 }}>
              <div style={{ marginBottom: 14 }}>No restaurants match.</div>
              {ghost('Clear search', () => (setQuery(''), setCuisine('All')))}
            </div>
          )}
        </div>
      </>
    )
  } else if (tab === 'saved') {
    const list = REST.filter((r) => saved[r.id])
    body = (
      <>
        {header('Saved')}
        <div style={{ display: 'grid', gap: 16, padding: '4px 20px 0' }}>
          {list.map(restCard)}
          {!list.length && (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: MUTED, fontSize: 14 }}>
              <div style={{ marginBottom: 14 }}>Heart a restaurant to keep it here.</div>
              {ghost('Discover restaurants', () => go('discover'))}
            </div>
          )}
        </div>
      </>
    )
  } else {
    const list = books.filter((b) => (seg === 'up' ? b.day >= 0 && b.status !== 'Cancelled' : b.day < 0 || b.status === 'Cancelled')).sort((a, b) => a.day - b.day)
    body = (
      <>
        {header('My bookings')}
        <div role="group" aria-label="Booking filter" style={{ display: 'flex', margin: '4px 20px 14px', padding: 3, background: '#f1e4dc', borderRadius: 20 }}>
          {[['up', 'Upcoming'], ['past', 'Past and cancelled']].map(([id, l]) => (
            <button key={id} type="button" aria-pressed={seg === id} onClick={() => setSeg(id)} style={{ flex: 1, height: 36, border: 'none', borderRadius: 17, background: seg === id ? '#fff' : 'transparent', color: seg === id ? INK : MUTED, font: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{l}</button>
          ))}
        </div>
        <div style={{ display: 'grid', gap: 12, padding: '0 20px' }}>
          {list.map((b) => {
            const r = REST.find((x) => x.id === b.rid)
            const dead = b.status === 'Cancelled'
            return (
              <div key={b.id} style={{ background: '#fff', borderRadius: 22, overflow: 'hidden', boxShadow: '0 6px 18px rgba(90,30,40,.08)', opacity: dead ? 0.7 : 1 }}>
                <button type="button" onClick={() => openRest(b.rid)} style={{ display: 'flex', gap: 12, width: '100%', padding: 10, border: 'none', background: 'none', font: 'inherit', textAlign: 'left', cursor: 'pointer', color: INK }}>
                  <span style={{ width: 70, height: 70, borderRadius: 16, overflow: 'hidden', flex: 'none' }}><DishArt r={r} height={70} /></span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 16, fontWeight: 800, fontFamily: 'Georgia, serif' }}>{r.name}</span>
                    <span style={{ display: 'block', fontSize: 13, color: MUTED, marginTop: 2 }}>{dayLabel(b.day)} · {t12(b.slot)} · {b.party} {b.party > 1 ? 'guests' : 'guest'}</span>
                    <span style={{ display: 'inline-block', marginTop: 5, padding: '2px 9px', borderRadius: 10, fontSize: 11, fontWeight: 800, background: dead ? '#fde4e4' : b.status === 'Completed' ? '#f1e4dc' : `${accent}1a`, color: dead ? '#b42318' : b.status === 'Completed' ? MUTED : accent }}>{b.status} · {b.code}</span>
                  </span>
                </button>
                {b.note && <div style={{ padding: '0 14px 8px', fontSize: 12.5, color: MUTED }}>Note: {b.note}</div>}
                <div style={{ display: 'flex', gap: 8, padding: '0 12px 12px' }}>
                  {b.status === 'Confirmed' && (
                    <>
                      <button type="button" onClick={() => (setSel({ rid: b.rid, party: b.party, day: b.day, slot: null, occ: [], note: b.note, sms: true, edit: b.id }), setRtab('menu'), push({ id: 'time' }))} style={smallBtn(INK, '#f6ece6')}>Modify</button>
                      <button type="button" onClick={() => say('Added to your calendar')} style={smallBtn(INK, '#f6ece6')}>Calendar</button>
                      {ask === b.id ? (
                        <button type="button" onClick={() => (setBooks((a) => a.map((x) => (x.id === b.id ? { ...x, status: 'Cancelled' } : x))), setAsk(null), say('Booking cancelled'))} style={smallBtn('#fff', '#b42318')}>Confirm cancel</button>
                      ) : (
                        <button type="button" onClick={() => setAsk(b.id)} style={smallBtn('#b42318', '#fde4e4')}>Cancel</button>
                      )}
                    </>
                  )}
                  {b.status === 'Completed' && (
                    <>
                      <button type="button" onClick={() => (setSel({ rid: b.rid, party: b.party, day: 1, slot: null, occ: [], note: '', sms: true, edit: null }), push({ id: 'time' }))} style={smallBtn('#fff', accent)}>Book again</button>
                      <button type="button" onClick={() => { setRated((x) => ({ ...x, [b.id]: !x[b.id] })); say(rated[b.id] ? 'Rating removed' : 'Thanks for rating') }} aria-pressed={!!rated[b.id]} style={smallBtn(INK, '#f6ece6')}>{rated[b.id] ? '★ Rated' : '☆ Rate'}</button>
                    </>
                  )}
                  {dead && <button type="button" onClick={() => (setSel({ rid: b.rid, party: b.party, day: 1, slot: null, occ: [], note: '', sms: true, edit: null }), push({ id: 'time' }))} style={smallBtn('#fff', accent)}>Rebook</button>}
                </div>
              </div>
            )
          })}
          {!list.length && (
            <div style={{ textAlign: 'center', padding: '50px 20px', color: MUTED, fontSize: 14 }}>
              <div style={{ marginBottom: 14 }}>{seg === 'up' ? 'No upcoming reservations.' : 'Nothing here yet.'}</div>
              {seg === 'up' && ghost('Find a table', () => go('discover'))}
            </div>
          )}
        </div>
      </>
    )
  }

  const phone = (
    <div style={{ position: 'relative', width: W, height: H, overflow: 'hidden', borderRadius: frame ? 46 : 0, background: BG, color: INK, fontFamily: "-apple-system, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif" }}>
      <style>{`
        @keyframes rv-r { from { opacity: 0; transform: translateX(34px) } to { opacity: 1; transform: none } }
        @keyframes rv-l { from { opacity: 0; transform: translateX(-34px) } to { opacity: 1; transform: none } }
        @keyframes rv-pop { from { transform: scale(.3); opacity: 0 } to { transform: none; opacity: 1 } }
        .rv-scroll { scrollbar-width: none } .rv-scroll::-webkit-scrollbar { display: none }
        .rv-app button:focus-visible, .rv-app input:focus-visible, .rv-app textarea:focus-visible { outline: 2px solid ${accent}; outline-offset: 2px }
        @media (prefers-reduced-motion: reduce) { .rv-screen, .rv-anim { animation: none !important } }
      `}</style>
      <StatusBar frame={frame} />
      <div key={`${tab}/${stack.map((s) => s.id).join('/')}`} className="rv-scroll rv-screen" style={{ position: 'absolute', top: top?.id === 'restaurant' ? 0 : 54, bottom: tabbed ? 84 : 0, left: 0, right: 0, overflowY: 'auto', paddingBottom: 24, animation: `${dir > 0 ? 'rv-r' : 'rv-l'} .28s ease` }}>
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
    <div ref={box} className="rv-app" style={{ position: 'relative', width: '100%', height: '100%', display: 'grid', placeItems: 'center', overflow: 'hidden', background: 'radial-gradient(ellipse at 50% 30%, #f6dfd6, #c9a597 75%)', ...style }}>
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: `translate(-50%, -50%) scale(${scale})`, transformOrigin: 'center' }}>
        {frame ? (
          <div style={{ padding: 12, borderRadius: 58, background: 'linear-gradient(145deg, #3a3f4a, #14171d 40%, #2b2f38)', boxShadow: '0 40px 80px rgba(70,20,30,.35), inset 0 0 0 2px #4b515e' }}>
            <div style={{ padding: 2, borderRadius: 48, background: '#000' }}>{phone}</div>
          </div>
        ) : (
          phone
        )}
      </div>
    </div>
  )
}

const smallBtn = (color, bg) => ({ flex: 1, height: 38, borderRadius: 19, border: 'none', background: bg, color, font: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' })
