import { useEffect, useRef, useState } from 'react'

// A weather app on a phone, as a click-through prototype. Five tabs (Today,
// Hourly, 7-day, Cities, Settings). Picking a city on the Cities tab really
// switches the whole app: the sky, the current conditions, the hourly strip and
// the week all change with it. Tap a tile on Today for its detail, tap a day in
// the 7-day list to expand it, tap an hour to inspect it, add or remove cities,
// and flip units in Settings (°C/°F, km/h / mph) to see every number update.
// Detail screens slide in from the right with a back button. The phone scales
// to fit whatever box it is in. Animation respects prefers-reduced-motion.

const W = 390
const H = 844
const FONT = "-apple-system, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif"

const CONDS = ['sunny', 'partly', 'cloudy', 'rain', 'storm', 'snow']
const COND_LABEL = { sunny: 'Sunny', clear: 'Clear', partly: 'Partly cloudy', cloudy: 'Overcast', rain: 'Rain', storm: 'Thunderstorms', snow: 'Snow' }
const SKY = {
  sunny: ['#2b7bd6', '#6fb8f2'],
  partly: ['#3a6fb5', '#8fb4d9'],
  cloudy: ['#4b5668', '#8d98a8'],
  rain: ['#2f3d55', '#5d7190'],
  storm: ['#1f2233', '#4a4d6b'],
  snow: ['#5b7aa0', '#c3d3e6'],
  night: ['#0d1330', '#2a3566'],
}

const CITIES = [
  { id: 'sf', name: 'San Francisco', region: 'California', cond: 'partly', t: 17, hi: 20, lo: 12, hum: 68, wind: 19, uv: 5, vis: 14, pres: 1016, off: -8, rise: '06:52', set: '17:08' },
  { id: 'nyc', name: 'New York', region: 'New York', cond: 'rain', t: 11, hi: 13, lo: 8, hum: 82, wind: 22, uv: 1, vis: 8, pres: 1009, off: -5, rise: '06:30', set: '16:44' },
  { id: 'lon', name: 'London', region: 'England', cond: 'cloudy', t: 9, hi: 11, lo: 6, hum: 77, wind: 15, uv: 1, vis: 10, pres: 1013, off: 0, rise: '07:12', set: '16:09' },
  { id: 'tyo', name: 'Tokyo', region: 'Japan', cond: 'sunny', t: 18, hi: 21, lo: 11, hum: 54, wind: 9, uv: 4, vis: 20, pres: 1021, off: 9, rise: '06:21', set: '16:36' },
  { id: 'syd', name: 'Sydney', region: 'Australia', cond: 'storm', t: 24, hi: 27, lo: 19, hum: 71, wind: 28, uv: 8, vis: 9, pres: 1004, off: 11, rise: '05:44', set: '19:46' },
  { id: 'rey', name: 'Reykjavik', region: 'Iceland', cond: 'snow', t: -2, hi: 0, lo: -5, hum: 85, wind: 31, uv: 0, vis: 6, pres: 998, off: 0, rise: '09:48', set: '15:57' },
  { id: 'dxb', name: 'Dubai', region: 'UAE', cond: 'sunny', t: 31, hi: 34, lo: 25, hum: 40, wind: 12, uv: 9, vis: 18, pres: 1011, off: 4, rise: '06:38', set: '17:25' },
  { id: 'par', name: 'Paris', region: 'France', cond: 'partly', t: 12, hi: 14, lo: 8, hum: 70, wind: 13, uv: 2, vis: 12, pres: 1015, off: 1, rise: '07:35', set: '17:03' },
  { id: 'rio', name: 'Rio de Janeiro', region: 'Brazil', cond: 'rain', t: 26, hi: 29, lo: 22, hum: 80, wind: 16, uv: 6, vis: 10, pres: 1008, off: -3, rise: '05:15', set: '18:30' },
]

const ICONS = {
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  cal: 'M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zM4 10h16M8 3v4M16 3v4',
  pin: 'M12 21s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.4 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.4-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.2-.8.2-1.2z',
  back: 'M15 5l-7 7 7 7',
  chev: 'M9 5l7 7-7 7',
  plus: 'M12 5v14M5 12h14',
  x: 'M6 6l12 12M18 6L6 18',
  check: 'M5 12l5 5 9-10',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  drop: 'M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z',
  wind: 'M3 9h11a3 3 0 1 0-3-3M3 15h15a3 3 0 1 1-3 3M3 12h7',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  gauge: 'M4 18a9 9 0 1 1 16 0M12 14l4-5',
  therm: 'M10 14V5a2 2 0 0 1 4 0v9a4 4 0 1 1-4 0z',
  bell: 'M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4',
  trash: 'M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13',
}

function Icon({ name, size = 22, color = 'currentColor', w = 1.9 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  )
}

const CLOUD = 'M7 19a4.5 4.5 0 0 1-.4-9A6 6 0 0 1 18 9.5 4.8 4.8 0 0 1 17.5 19z'

// Filled weather glyph. `night` swaps the sun for a moon.
function WIcon({ c, size = 40, night }) {
  const sun = (cx, cy, r) => (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="#ffd34d" />
      <g stroke="#ffd34d" strokeWidth="2" strokeLinecap="round">
        {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
          <line key={a} x1={cx + Math.cos((a * Math.PI) / 180) * (r + 3)} y1={cy + Math.sin((a * Math.PI) / 180) * (r + 3)} x2={cx + Math.cos((a * Math.PI) / 180) * (r + 6)} y2={cy + Math.sin((a * Math.PI) / 180) * (r + 6)} />
        ))}
      </g>
    </g>
  )
  const moon = <path d="M17 4a8 8 0 1 0 5 12 7 7 0 0 1-5-12z" fill="#f4efc8" transform="translate(-4 2)" />
  const cloud = (fill = '#fff', t = '') => <path d={CLOUD} fill={fill} transform={t} />
  const drops = (
    <g stroke="#7cc4ff" strokeWidth="2.2" strokeLinecap="round">
      <line x1="9" y1="21" x2="8" y2="24" />
      <line x1="13" y1="21" x2="12" y2="24" />
      <line x1="17" y1="21" x2="16" y2="24" />
    </g>
  )
  let inner
  if (c === 'sunny' || c === 'clear') inner = night || c === 'clear' ? moon : sun(12, 12, 5)
  else if (c === 'partly') inner = <>{night ? <g transform="translate(-2 -2) scale(.8)">{moon}</g> : sun(8, 8, 3.6)}{cloud('#fff', 'translate(2 1)')}</>
  else if (c === 'cloudy') inner = <>{cloud('#c4ccd8', 'translate(-2 -2) scale(.8)')}{cloud('#fff', 'translate(1 1)')}</>
  else if (c === 'rain') inner = <>{cloud('#dfe6ef', 'translate(0 -3)')}{drops}</>
  else if (c === 'storm') inner = <>{cloud('#b5bccc', 'translate(0 -3)')}<path d="M12 15l-3 5h3l-1 4 5-6h-3l1-3z" fill="#ffd34d" /></>
  else inner = <>{cloud('#e8f0fa', 'translate(0 -3)')}<g fill="#fff"><circle cx="8" cy="21" r="1.4" /><circle cx="12.5" cy="22.5" r="1.4" /><circle cx="17" cy="21" r="1.4" /></g></>
  return (
    <svg width={size} height={size} viewBox="0 0 26 26" aria-hidden="true">
      {inner}
    </svg>
  )
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
          <rect x="0.5" y="0.5" width="22" height="11" rx="3.5" fill="none" stroke="#fff" opacity=".5" />
          <rect x="2.5" y="2.5" width="16" height="7" rx="2" fill="#fff" />
          <rect x="23.5" y="4" width="2" height="4" rx="1" fill="#fff" opacity=".5" />
        </svg>
      </span>
    </div>
  )
}

// Deterministic forecast data derived from a city.
function hoursFor(city) {
  const now = new Date().getHours()
  const mean = (city.hi + city.lo) / 2
  const amp = (city.hi - city.lo) / 2
  const base = CONDS.indexOf(city.cond)
  return Array.from({ length: 24 }, (_, i) => {
    const h = (now + i) % 24
    const t = mean + amp * Math.sin(((h - 9) * Math.PI * 2) / 24)
    const swing = [0, 0, 0, 1, 0, 0, 2, 0, 0, 0, 0, 0][(i * 5 + base) % 12]
    const cond = swing ? CONDS[(base + swing) % CONDS.length] : city.cond
    const night = h < 6 || h >= 19
    const pop = { rain: 70, storm: 85, snow: 65, cloudy: 25, partly: 10, sunny: 0 }[cond]
    return { i, h, t, cond, night, pop: Math.min(100, pop + ((i * 7) % 15)) }
  })
}

function weekFor(city) {
  const base = CONDS.indexOf(city.cond)
  const names = ['Today', 'Tomorrow']
  const d0 = new Date()
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(d0.getTime() + i * 86400000)
    return {
      i,
      day: names[i] || d.toLocaleDateString('en-US', { weekday: 'long' }),
      date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      cond: CONDS[(base + [0, 0, 1, 2, 3, 1, 0][i]) % CONDS.length],
      hi: city.hi + [0, 1, -2, 2, -1, 0, 3][i],
      lo: city.lo + [0, 1, -1, 1, -2, 0, 2][i],
      hum: city.hum + [0, 2, 6, 8, 3, -4, -6][i],
      wind: city.wind + [0, -3, 4, 6, 2, -5, -2][i],
      pop: [10, 20, 40, 70, 85, 30, 5][i],
    }
  })
}

const iconBtn = { display: 'grid', placeItems: 'center', border: 'none', borderRadius: '50%', cursor: 'pointer', padding: 0, background: 'rgba(255,255,255,.16)', color: '#fff' }
const glass = { background: 'rgba(255,255,255,.14)', border: '1px solid rgba(255,255,255,.2)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', borderRadius: 22 }

const NAV = [
  ['today', 'sun', 'Today'],
  ['hourly', 'clock', 'Hourly'],
  ['week', 'cal', '7-day'],
  ['cities', 'pin', 'Cities'],
  ['settings', 'gear', 'Settings'],
]
const PAGE_IDS = NAV.map((n) => n[0])

// ---------------------------------------------------------------- app

export default function WeatherApp({ name = 'Skyline', accent = '#ffd34d', startScreen = 'today', frame = true, style }) {
  const box = useRef()
  const toastTimer = useRef()
  const [scale, setScale] = useState(1)
  const [tab, setTab] = useState(PAGE_IDS.includes(startScreen) ? startScreen : 'today')
  const [stack, setStack] = useState([])
  const [dir, setDir] = useState(1)
  const [toast, setToast] = useState('')
  const [cityIds, setCityIds] = useState(['sf', 'nyc', 'lon', 'tyo'])
  const [cur, setCur] = useState('sf')
  const [editing, setEditing] = useState(false)
  const [unitF, setUnitF] = useState(false)
  const [mph, setMph] = useState(false)
  const [alerts, setAlerts] = useState(true)
  const [daily, setDaily] = useState(false)
  const [motion, setMotion] = useState(true)
  const [openDay, setOpenDay] = useState(0)
  const [hourSel, setHourSel] = useState(0)
  const [q, setQ] = useState('')

  useEffect(() => {
    setTab(PAGE_IDS.includes(startScreen) ? startScreen : 'today')
    setStack([])
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
  const go = (t) => (setDir(NAV.findIndex((n) => n[0] === t) >= NAV.findIndex((n) => n[0] === tab) ? 1 : -1), setTab(t), setStack([]))

  const city = CITIES.find((c) => c.id === cur)
  const hours = hoursFor(city)
  const week = weekFor(city)
  const T = (c) => Math.round(unitF ? (c * 9) / 5 + 32 : c)
  const deg = (c) => `${T(c)}°`
  const spd = (k) => `${Math.round(mph ? k * 0.621 : k)} ${mph ? 'mph' : 'km/h'}`
  const nowH = new Date().getHours()
  const isNight = nowH < 6 || nowH >= 19
  const skyKey = isNight && (city.cond === 'sunny' || city.cond === 'partly') ? 'night' : city.cond
  const [skyA, skyB] = SKY[skyKey]
  const cityTime = (c) => {
    const d = new Date(Date.now() + new Date().getTimezoneOffset() * 60000 + c.off * 3600000)
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  }
  const feels = city.t - (city.wind > 20 ? 2 : 0) + (city.hum > 75 && city.t > 20 ? 2 : 0)

  const switchTo = (id) => {
    setCur(id)
    setHourSel(0)
    setOpenDay(0)
    setDir(-1)
    setTab('today')
    setStack([])
    say(`Showing ${CITIES.find((c) => c.id === id).name}`)
  }

  const header = (title, back, right) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 20px 6px', minHeight: 50 }}>
      {back && (
        <button type="button" onClick={back} aria-label="Back" style={{ ...iconBtn, width: 38, height: 38 }}>
          <Icon name="back" size={20} />
        </button>
      )}
      <h1 style={{ margin: 0, flex: 1, fontSize: back ? 18 : 28, fontWeight: 700, letterSpacing: '-0.02em', marginLeft: back ? 4 : 0 }}>{title}</h1>
      {right}
    </div>
  )

  const seg = (opts, val, set, label) => (
    <div role="group" aria-label={label} style={{ display: 'flex', padding: 3, borderRadius: 14, background: 'rgba(255,255,255,.14)' }}>
      {opts.map(([v, l]) => (
        <button key={String(v)} type="button" aria-pressed={val === v} onClick={() => set(v)} style={{ height: 30, padding: '0 14px', border: 'none', borderRadius: 11, font: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer', background: val === v ? '#fff' : 'transparent', color: val === v ? '#23314d' : '#fff' }}>{l}</button>
      ))}
    </div>
  )

  const toggle = (on, set, label) => (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => set(!on)} style={{ width: 48, height: 28, borderRadius: 14, border: 'none', padding: 3, background: on ? accent : 'rgba(255,255,255,.28)', cursor: 'pointer', transition: 'background .2s', flex: 'none' }}>
      <span style={{ display: 'block', width: 22, height: 22, borderRadius: '50%', background: on ? '#3b2f00' : '#fff', transform: `translateX(${on ? 20 : 0}px)`, transition: 'transform .2s' }} />
    </button>
  )

  const METRICS = [
    { id: 'feels', icon: 'therm', label: 'Feels like', val: deg(feels), note: `Wind and humidity make it feel ${feels < city.t ? 'cooler' : feels > city.t ? 'warmer' : 'about the same'} than the actual ${deg(city.t)}.` },
    { id: 'hum', icon: 'drop', label: 'Humidity', val: `${city.hum}%`, note: `The dew point is ${deg(city.t - (100 - city.hum) / 5)}. ${city.hum > 75 ? 'It feels muggy.' : 'The air feels comfortable.'}` },
    { id: 'wind', icon: 'wind', label: 'Wind', val: spd(city.wind), note: `Gusts up to ${spd(city.wind + 10)} from the ${['NW', 'W', 'SW', 'N', 'E'][CITIES.indexOf(city) % 5]}.` },
    { id: 'uv', icon: 'sun', label: 'UV index', val: String(city.uv), note: city.uv >= 8 ? 'Very high. Cover up and use SPF 50.' : city.uv >= 5 ? 'Moderate to high. Wear sunscreen at midday.' : 'Low. No protection needed.' },
    { id: 'vis', icon: 'eye', label: 'Visibility', val: `${mph ? Math.round(city.vis * 0.621) : city.vis} ${mph ? 'mi' : 'km'}`, note: city.vis < 9 ? 'Reduced visibility, take care driving.' : 'Clear line of sight.' },
    { id: 'pres', icon: 'gauge', label: 'Pressure', val: `${city.pres} hPa`, note: city.pres < 1008 ? 'Low and falling, unsettled weather ahead.' : 'Steady, fair conditions.' },
  ]

  // ---- screens
  let body
  let tabbed = true
  if (top?.id === 'metric') {
    tabbed = false
    const m = METRICS.find((x) => x.id === top.m)
    const bars = hours.slice(0, 12)
    body = (
      <>
        {header(m.label, pop)}
        <div style={{ textAlign: 'center', padding: '14px 24px' }}>
          <Icon name={m.icon} size={34} />
          <div style={{ fontSize: 54, fontWeight: 300, letterSpacing: '-0.03em', marginTop: 6 }}>{m.val}</div>
          <div style={{ fontSize: 14, opacity: 0.85, marginTop: 4 }}>{city.name}</div>
        </div>
        <div style={{ margin: '0 20px', padding: 16, ...glass }}>
          <div style={{ fontSize: 13, fontWeight: 600, opacity: 0.8, marginBottom: 10 }}>Next 12 hours</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 80 }}>
            {bars.map((h, i) => (
              <span key={i} style={{ flex: 1, borderRadius: 4, background: i === 0 ? accent : 'rgba(255,255,255,.55)', height: `${30 + ((h.t - city.lo + (i % 4) * 2) / (city.hi - city.lo + 8)) * 70}%` }} />
            ))}
          </div>
          <p style={{ margin: '14px 0 0', fontSize: 14, lineHeight: 1.45 }}>{m.note}</p>
        </div>
        <div style={{ padding: '16px 20px' }}>
          <button type="button" onClick={() => say(`Alert set for ${m.label.toLowerCase()}`)} style={{ width: '100%', height: 50, borderRadius: 25, border: 'none', background: accent, color: '#3b2f00', font: 'inherit', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>Notify me of changes</button>
        </div>
      </>
    )
  } else if (top?.id === 'add') {
    tabbed = false
    const list = CITIES.filter((c) => !cityIds.includes(c.id) && (c.name + c.region).toLowerCase().includes(q.trim().toLowerCase()))
    body = (
      <>
        {header('Add a city', () => (setQ(''), pop()))}
        <div style={{ margin: '4px 20px 12px', display: 'flex', alignItems: 'center', gap: 8, padding: '0 14px', height: 44, ...glass, borderRadius: 16 }}>
          <Icon name="search" size={18} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search cities" aria-label="Search cities" style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: '#fff', font: 'inherit', fontSize: 15 }} />
        </div>
        <div style={{ display: 'grid', gap: 8, padding: '0 20px' }}>
          {list.map((c) => (
            <button key={c.id} type="button" onClick={() => (setCityIds((a) => [...a, c.id]), setQ(''), pop(), say(`${c.name} added`))} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', color: '#fff', font: 'inherit', textAlign: 'left', cursor: 'pointer', ...glass, borderRadius: 18 }}>
              <span style={{ flex: 1 }}>
                <span style={{ display: 'block', fontSize: 15, fontWeight: 600 }}>{c.name}</span>
                <span style={{ display: 'block', fontSize: 12, opacity: 0.75 }}>{c.region}</span>
              </span>
              <Icon name="plus" size={20} />
            </button>
          ))}
          {!list.length && <div style={{ textAlign: 'center', opacity: 0.8, fontSize: 13, padding: '30px 0' }}>{cityIds.length === CITIES.length ? 'All cities are already added.' : 'No cities match.'}</div>}
        </div>
      </>
    )
  } else if (top?.id === 'about') {
    tabbed = false
    body = (
      <>
        {header('About', pop)}
        <div style={{ margin: '10px 20px 0', padding: '4px 16px', ...glass }}>
          {[['App', name], ['Version', '4.2.0'], ['Data', 'Demo forecast'], ['Updated', 'Just now']].map(([l, v]) => (
            <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '13px 0', borderBottom: '1px solid rgba(255,255,255,.14)', fontSize: 14 }}>
              <span style={{ opacity: 0.75 }}>{l}</span>
              <span style={{ fontWeight: 600 }}>{v}</span>
            </div>
          ))}
        </div>
      </>
    )
  } else if (tab === 'today') {
    const sunPct = Math.max(0, Math.min(1, (nowH - 6) / 13))
    const ang = Math.PI * (1 - sunPct)
    body = (
      <>
        <div style={{ textAlign: 'center', padding: '8px 20px 0', position: 'relative' }}>
          <button type="button" onClick={() => go('cities')} style={{ border: 'none', background: 'none', color: '#fff', font: 'inherit', fontSize: 24, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Icon name="pin" size={18} /> {city.name}
          </button>
          <div style={{ fontSize: 13, opacity: 0.8 }}>{cityTime(city)} local time</div>
          <div style={{ display: 'grid', placeItems: 'center', marginTop: 10, animation: motion ? 'wx-bob 5s ease-in-out infinite' : 'none' }}>
            <WIcon c={city.cond} size={110} night={isNight} />
          </div>
          <div style={{ fontSize: 88, fontWeight: 200, letterSpacing: '-0.05em', lineHeight: 1, marginTop: 2 }}>{deg(city.t)}</div>
          <div style={{ fontSize: 18, fontWeight: 500 }}>{COND_LABEL[city.cond]}</div>
          <div style={{ fontSize: 14, opacity: 0.85, marginTop: 2 }}>H:{deg(city.hi)}  L:{deg(city.lo)}</div>
        </div>
        {alerts && (city.cond === 'storm' || city.cond === 'snow' || city.wind > 25) && (
          <button type="button" onClick={() => push({ id: 'metric', m: 'wind' })} style={{ display: 'flex', alignItems: 'center', gap: 10, width: 'calc(100% - 40px)', margin: '14px 20px 0', padding: '12px 14px', color: '#fff', font: 'inherit', textAlign: 'left', cursor: 'pointer', ...glass, borderRadius: 18, borderColor: accent }}>
            <Icon name="bell" size={20} color={accent} />
            <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{city.cond === 'storm' ? 'Thunderstorm warning until 21:00' : city.cond === 'snow' ? 'Snow advisory until midnight' : 'Strong wind advisory'}</span>
            <Icon name="chev" size={16} />
          </button>
        )}
        <button type="button" onClick={() => go('hourly')} style={{ display: 'block', width: 'calc(100% - 40px)', margin: '14px 20px 0', padding: '12px 4px 12px 14px', color: '#fff', font: 'inherit', textAlign: 'left', cursor: 'pointer', ...glass }}>
          <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.75, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Next hours</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingRight: 10 }}>
            {hours.slice(0, 5).map((h) => (
              <span key={h.i} style={{ display: 'grid', justifyItems: 'center', gap: 3, fontSize: 13, fontWeight: 600 }}>
                <span style={{ opacity: 0.8, fontSize: 12 }}>{h.i === 0 ? 'Now' : `${String(h.h).padStart(2, '0')}`}</span>
                <WIcon c={h.cond} night={h.night} size={30} />
                {deg(h.t)}
              </span>
            ))}
          </div>
        </button>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '12px 20px 0' }}>
          {METRICS.map((m) => (
            <button key={m.id} type="button" onClick={() => push({ id: 'metric', m: m.id })} style={{ padding: 14, color: '#fff', font: 'inherit', textAlign: 'left', cursor: 'pointer', ...glass, borderRadius: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, opacity: 0.75, textTransform: 'uppercase', letterSpacing: '.05em' }}><Icon name={m.icon} size={14} /> {m.label}</div>
              <div style={{ fontSize: 26, fontWeight: 600, marginTop: 6 }}>{m.val}</div>
            </button>
          ))}
        </div>
        <div style={{ margin: '12px 20px 0', padding: 14, ...glass }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600 }}>
            <span>Sunrise {city.rise}</span>
            <span>Sunset {city.set}</span>
          </div>
          <svg viewBox="0 0 300 80" style={{ width: '100%', marginTop: 6 }} aria-hidden="true">
            <path d="M10 70 A140 60 0 0 1 290 70" fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="2" strokeDasharray="4 5" />
            <line x1="0" y1="70" x2="300" y2="70" stroke="rgba(255,255,255,.3)" />
            <circle cx={150 + Math.cos(ang) * 140} cy={70 - Math.sin(ang) * 60} r="8" fill={accent} />
          </svg>
        </div>
      </>
    )
  } else if (tab === 'hourly') {
    const sel = hours[hourSel]
    const ts = hours.map((h) => h.t)
    const mn = Math.min(...ts)
    const mx = Math.max(...ts)
    const px = (i) => 14 + (i * 332) / 23
    const py = (t) => 120 - ((t - mn) / (mx - mn || 1)) * 90
    const pts = hours.map((h) => `${px(h.i)},${py(h.t)}`).join(' ')
    body = (
      <>
        {header('Hourly', null, <span style={{ fontSize: 13, opacity: 0.85 }}>{city.name}</span>)}
        <div style={{ margin: '4px 20px 0', padding: 16, textAlign: 'center', ...glass }}>
          <WIcon c={sel.cond} night={sel.night} size={52} />
          <div style={{ fontSize: 44, fontWeight: 300, letterSpacing: '-0.03em' }}>{deg(sel.t)}</div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{COND_LABEL[sel.cond]} at {String(sel.h).padStart(2, '0')}:00</div>
          <div style={{ fontSize: 12.5, opacity: 0.8, marginTop: 4 }}>{sel.pop}% chance of precipitation · {spd(city.wind)}</div>
        </div>
        <div style={{ margin: '12px 20px 0', padding: '12px 4px 8px', ...glass }}>
          <svg viewBox="0 0 360 150" style={{ width: '100%' }} role="img" aria-label="Temperature over 24 hours">
            <polyline points={pts} fill="none" stroke="#fff" strokeWidth="2.5" strokeLinejoin="round" />
            {hours.map((h) => (
              <g key={h.i} onClick={() => setHourSel(h.i)} style={{ cursor: 'pointer' }}>
                <rect x={px(h.i) - 7} y="0" width="14" height="150" fill="transparent" />
                <circle cx={px(h.i)} cy={py(h.t)} r={h.i === hourSel ? 6 : 3} fill={h.i === hourSel ? accent : '#fff'} />
              </g>
            ))}
            <text x="14" y="146" fill="#fff" opacity=".7" fontSize="10">Now</text>
            <text x="346" y="146" fill="#fff" opacity=".7" fontSize="10" textAnchor="end">+24h</text>
          </svg>
        </div>
        <div style={{ display: 'grid', gap: 8, padding: '12px 20px 0' }}>
          {hours.map((h) => (
            <button key={h.i} type="button" onClick={() => setHourSel(h.i)} aria-pressed={hourSel === h.i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 14px', color: '#fff', font: 'inherit', textAlign: 'left', cursor: 'pointer', ...glass, borderRadius: 16, background: hourSel === h.i ? 'rgba(255,255,255,.3)' : glass.background }}>
              <span style={{ width: 54, fontSize: 14, fontWeight: 600 }}>{h.i === 0 ? 'Now' : `${String(h.h).padStart(2, '0')}:00`}</span>
              <WIcon c={h.cond} night={h.night} size={30} />
              <span style={{ flex: 1, fontSize: 12.5, opacity: 0.8, display: 'flex', alignItems: 'center', gap: 4 }}><Icon name="drop" size={12} /> {h.pop}%</span>
              <span style={{ fontSize: 16, fontWeight: 700 }}>{deg(h.t)}</span>
            </button>
          ))}
        </div>
      </>
    )
  } else if (tab === 'week') {
    const lo = Math.min(...week.map((d) => d.lo))
    const hi = Math.max(...week.map((d) => d.hi))
    body = (
      <>
        {header('7-day forecast', null, <span style={{ fontSize: 13, opacity: 0.85 }}>{city.name}</span>)}
        <div style={{ display: 'grid', gap: 8, padding: '4px 20px 0' }}>
          {week.map((d) => {
            const open = openDay === d.i
            const l = ((d.lo - lo) / (hi - lo || 1)) * 100
            const r = ((d.hi - lo) / (hi - lo || 1)) * 100
            return (
              <div key={d.i} style={{ ...glass, borderRadius: 20, overflow: 'hidden' }}>
                <button type="button" aria-expanded={open} onClick={() => setOpenDay(open ? -1 : d.i)} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '12px 14px', border: 'none', background: 'none', color: '#fff', font: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
                  <span style={{ width: 86 }}>
                    <span style={{ display: 'block', fontSize: 15, fontWeight: 600 }}>{d.day}</span>
                    <span style={{ display: 'block', fontSize: 11.5, opacity: 0.7 }}>{d.date}</span>
                  </span>
                  <WIcon c={d.cond} size={30} />
                  <span style={{ width: 28, fontSize: 13, opacity: 0.75, textAlign: 'right' }}>{deg(d.lo)}</span>
                  <span style={{ flex: 1, height: 6, borderRadius: 3, background: 'rgba(255,255,255,.2)', position: 'relative' }}>
                    <span style={{ position: 'absolute', top: 0, bottom: 0, left: `${l}%`, width: `${Math.max(8, r - l)}%`, borderRadius: 3, background: `linear-gradient(90deg, #7cc4ff, ${accent})` }} />
                  </span>
                  <span style={{ width: 30, fontSize: 14, fontWeight: 700 }}>{deg(d.hi)}</span>
                </button>
                {open && (
                  <div style={{ padding: '0 14px 14px', animation: 'wx-r .22s ease' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>{COND_LABEL[d.cond]}, high of {deg(d.hi)} and low of {deg(d.lo)}.</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                      {[['Rain', `${d.pop}%`], ['Humidity', `${Math.min(99, d.hum)}%`], ['Wind', spd(d.wind)]].map(([l, v]) => (
                        <div key={l} style={{ padding: '8px 6px', borderRadius: 12, background: 'rgba(255,255,255,.14)', textAlign: 'center' }}>
                          <div style={{ fontSize: 11, opacity: 0.75 }}>{l}</div>
                          <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>{v}</div>
                        </div>
                      ))}
                    </div>
                    <button type="button" onClick={() => say(`Reminder set for ${d.day}`)} style={{ marginTop: 10, height: 34, padding: '0 14px', borderRadius: 17, border: 'none', background: accent, color: '#3b2f00', font: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Remind me</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </>
    )
  } else if (tab === 'cities') {
    body = (
      <>
        {header('Cities', null, <button type="button" onClick={() => setEditing(!editing)} style={{ border: 'none', background: 'none', color: '#fff', font: 'inherit', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>{editing ? 'Done' : 'Edit'}</button>)}
        <div style={{ display: 'grid', gap: 10, padding: '4px 20px 0' }}>
          {cityIds.map((id) => {
            const c = CITIES.find((x) => x.id === id)
            const [a, b] = SKY[c.cond]
            return (
              <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {editing && id !== cur && (
                  <button type="button" onClick={() => (setCityIds((l) => l.filter((x) => x !== id)), say(`${c.name} removed`))} aria-label={`Remove ${c.name}`} style={{ ...iconBtn, width: 30, height: 30, background: '#e5484d', flex: 'none' }}>
                    <Icon name="x" size={16} />
                  </button>
                )}
                <button type="button" onClick={() => switchTo(id)} aria-current={id === cur ? 'true' : undefined} style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', border: id === cur ? `2px solid ${accent}` : '2px solid transparent', borderRadius: 22, color: '#fff', font: 'inherit', textAlign: 'left', cursor: 'pointer', background: `linear-gradient(135deg, ${a}, ${b})` }}>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 18, fontWeight: 700 }}>{c.name}</span>
                    <span style={{ display: 'block', fontSize: 12, opacity: 0.85 }}>{cityTime(c)} · {COND_LABEL[c.cond]}</span>
                    <span style={{ display: 'block', fontSize: 12, opacity: 0.85 }}>H:{deg(c.hi)}  L:{deg(c.lo)}</span>
                  </span>
                  <WIcon c={c.cond} size={38} night={false} />
                  <span style={{ fontSize: 34, fontWeight: 300, width: 64, textAlign: 'right' }}>{deg(c.t)}</span>
                </button>
              </div>
            )
          })}
          <button type="button" onClick={() => push({ id: 'add' })} style={{ height: 54, borderRadius: 22, border: '2px dashed rgba(255,255,255,.5)', background: 'none', color: '#fff', font: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>+ Add city</button>
        </div>
      </>
    )
  } else {
    const row = (icon, label, right, onClick) => {
      const Tag = onClick ? 'button' : 'div'
      return (
        <Tag type={onClick ? 'button' : undefined} onClick={onClick} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '13px 0', border: 'none', borderBottom: '1px solid rgba(255,255,255,.14)', background: 'none', color: '#fff', font: 'inherit', textAlign: 'left', cursor: onClick ? 'pointer' : 'default' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14.5, fontWeight: 600 }}><Icon name={icon} size={19} /> {label}</span>
          {right}
        </Tag>
      )
    }
    body = (
      <>
        {header('Settings')}
        <div style={{ margin: '4px 20px 0', padding: '0 16px', ...glass }}>
          {row('therm', 'Temperature', seg([[false, '°C'], [true, '°F']], unitF, setUnitF, 'Temperature unit'))}
          {row('wind', 'Wind speed', seg([[false, 'km/h'], [true, 'mph']], mph, setMph, 'Wind unit'))}
          {row('bell', 'Severe weather alerts', toggle(alerts, setAlerts, 'Severe weather alerts'))}
          {row('clock', 'Daily summary at 7:00', toggle(daily, (v) => (setDaily(v), say(v ? 'Daily summary on' : 'Daily summary off')), 'Daily summary'))}
          {row('sun', 'Animated sky', toggle(motion, setMotion, 'Animated sky'))}
          {row('gauge', 'About', <Icon name="chev" size={18} />, () => push({ id: 'about' }))}
        </div>
        <div style={{ padding: '16px 20px' }}>
          <button type="button" onClick={() => (setUnitF(false), setMph(false), setAlerts(true), setDaily(false), setMotion(true), setCityIds(['sf', 'nyc', 'lon', 'tyo']), setCur('sf'), say('Demo reset'))} style={{ width: '100%', height: 48, borderRadius: 24, border: 'none', background: 'rgba(255,255,255,.2)', color: '#fff', font: 'inherit', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Reset demo</button>
        </div>
      </>
    )
  }

  const phone = (
    <div style={{ position: 'relative', width: W, height: H, overflow: 'hidden', borderRadius: frame ? 46 : 0, background: `linear-gradient(180deg, ${skyA}, ${skyB})`, transition: 'background .5s', color: '#fff', fontFamily: FONT }}>
      <style>{`
        @keyframes wx-r { from { opacity: 0; transform: translateX(34px) } to { opacity: 1; transform: none } }
        @keyframes wx-l { from { opacity: 0; transform: translateX(-34px) } to { opacity: 1; transform: none } }
        @keyframes wx-bob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-8px) } }
        @keyframes wx-drift { from { transform: translateX(-60px) } to { transform: translateX(460px) } }
        @keyframes wx-fall { from { transform: translateY(-30px) } to { transform: translateY(300px) } }
        .wx-scroll { scrollbar-width: none } .wx-scroll::-webkit-scrollbar { display: none }
        .wx-app button:focus-visible, .wx-app input:focus-visible { outline: 2px solid #fff; outline-offset: 2px }
        @media (prefers-reduced-motion: reduce) { .wx-app * { animation: none !important; transition: none !important } }
      `}</style>
      {motion && (
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
          {(city.cond === 'cloudy' || city.cond === 'partly' || city.cond === 'rain' || city.cond === 'storm') &&
            [90, 200, 330].map((y, i) => (
              <svg key={y} width="120" height="60" viewBox="0 0 26 26" style={{ position: 'absolute', top: y, left: 0, opacity: 0.18, animation: `wx-drift ${46 + i * 14}s linear ${-i * 17}s infinite` }}>
                <path d={CLOUD} fill="#fff" />
              </svg>
            ))}
          {(city.cond === 'rain' || city.cond === 'storm' || city.cond === 'snow') &&
            Array.from({ length: 16 }, (_, i) => (
              <i key={i} style={{ position: 'absolute', top: 0, left: `${(i * 37) % 100}%`, width: city.cond === 'snow' ? 6 : 2, height: city.cond === 'snow' ? 6 : 16, borderRadius: 4, background: 'rgba(255,255,255,.5)', animation: `wx-fall ${city.cond === 'snow' ? 5 + (i % 4) : 0.9 + (i % 3) * 0.2}s linear ${-(i % 7) * 0.4}s infinite` }} />
            ))}
        </div>
      )}
      <StatusBar frame={frame} />
      <div key={`${tab}/${cur}/${stack.map((s) => s.id + (s.m || '')).join('/')}`} className="wx-scroll" style={{ position: 'absolute', top: 54, bottom: tabbed ? 84 : 0, left: 0, right: 0, overflowY: 'auto', paddingBottom: 24, animation: `${dir > 0 ? 'wx-r' : 'wx-l'} .28s ease` }}>
        {body}
      </div>
      {tabbed && (
        <nav aria-label="Main" style={{ position: 'absolute', left: 12, right: 12, bottom: 18, height: 62, borderRadius: 31, display: 'flex', justifyContent: 'space-around', alignItems: 'center', background: 'rgba(10,18,40,.45)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,.18)' }}>
          {NAV.map(([id, icon, label]) => (
            <button key={id} type="button" onClick={() => go(id)} aria-current={tab === id ? 'page' : undefined} style={{ border: 'none', background: tab === id ? 'rgba(255,255,255,.2)' : 'none', borderRadius: 24, font: 'inherit', cursor: 'pointer', display: 'grid', justifyItems: 'center', alignContent: 'center', gap: 2, width: 64, height: 50, fontSize: 10.5, fontWeight: 600, color: tab === id ? accent : 'rgba(255,255,255,.8)' }}>
              <Icon name={icon} size={21} />
              {label}
            </button>
          ))}
        </nav>
      )}
      <div role="status" style={{ position: 'absolute', left: '50%', top: 58, zIndex: 30, transform: `translate(-50%, ${toast ? 0 : -90}px)`, transition: 'transform .35s cubic-bezier(.2,.8,.2,1)', padding: '10px 16px', borderRadius: 20, background: 'rgba(10,18,40,.9)', color: '#fff', fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap' }}>{toast}</div>
      <div style={{ position: 'absolute', left: '50%', bottom: 7, width: 140, height: 5, marginLeft: -70, borderRadius: 3, background: '#fff', opacity: 0.8, zIndex: 25 }} />
    </div>
  )

  return (
    <div ref={box} className="wx-app" style={{ position: 'relative', width: '100%', height: '100%', display: 'grid', placeItems: 'center', overflow: 'hidden', background: 'radial-gradient(ellipse at 50% 30%, #dfe8f5, #a9b8d0 75%)', ...style }}>
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: `translate(-50%, -50%) scale(${scale})`, transformOrigin: 'center' }}>
        {frame ? (
          <div style={{ padding: 12, borderRadius: 58, background: 'linear-gradient(145deg, #3a3f4a, #14171d 40%, #2b2f38)', boxShadow: '0 40px 80px rgba(15,27,45,.35), inset 0 0 0 2px #4b515e' }}>
            <div style={{ padding: 2, borderRadius: 48, background: '#000' }}>{phone}</div>
          </div>
        ) : (
          phone
        )}
      </div>
    </div>
  )
}
