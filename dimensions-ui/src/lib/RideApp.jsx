import { memo, useEffect, useRef, useState } from 'react'

// A ride-hailing app on a phone, as a click-through prototype with a dark UI.
// Pages: Home (map + "Where to?"), Pick destination (live search list), Ride
// options (Economy / Comfort / XL, prices computed from the real route length),
// Trip (a driver car drives the drawn route, rotating to its heading, with an
// ETA countdown, a progress bar and a draggable driver sheet that has contact
// chat, share and cancel) and Receipt (fare breakdown, star rating, tip chips).
// Activity and Account tabs reuse the same state: finished rides land in
// Activity and open their receipt again, the promo code changes the fares.
// The city map is plain inline SVG; nothing is loaded from the network.
// The phone scales to fit whatever box it is in. Trip time is simulated.

const W = 390
const H = 844
const BG = '#0e1116'
const CARD = '#181c24'
const CARD2 = '#222834'
const LINE = '#2a313d'
const INK = '#f2f5f9'
const MUTED = '#8b95a5'
const ON = '#04150d'

const CELL = 65
const OY = 60
const gp = (gx, gy) => ({ x: gx * CELL, y: OY + gy * CELL })
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const usd = (n) => `$${n.toFixed(2)}`

const PICKUP = { gx: 2, gy: 5 }
const DRIVER_START = { gx: 5, gy: 6 }

const PLACES = [
  { id: 'home', name: 'Home', sub: '14 Linden Street', gx: 0, gy: 10, icon: 'home' },
  { id: 'work', name: 'Work', sub: 'Northwind HQ, 2nd Ave', gx: 5, gy: 2, icon: 'brief' },
  { id: 'airport', name: 'City Airport', sub: 'Terminal 1 departures', gx: 6, gy: 0, icon: 'plane' },
  { id: 'station', name: 'Central Station', sub: 'Platform entrance, Main St', gx: 1, gy: 3, icon: 'pin' },
  { id: 'mall', name: 'Skyline Mall', sub: '300 Market Street', gx: 5, gy: 8, icon: 'pin' },
  { id: 'museum', name: 'Museum Quarter', sub: 'Gallery Row', gx: 3, gy: 1, icon: 'pin' },
  { id: 'cafe', name: 'Maple Café', sub: 'Corner of 6th and Oak', gx: 1, gy: 7, icon: 'pin' },
  { id: 'park', name: 'Riverside Park', sub: 'South gate', gx: 4, gy: 11, icon: 'pin' },
  { id: 'library', name: 'Westside Library', sub: '8 Reading Lane', gx: 0, gy: 5, icon: 'pin' },
]

const RIDES = [
  { id: 'eco', name: 'Economy', sub: 'Affordable everyday ride', seats: 4, base: 2.4, perKm: 0.95, perMin: 0.2, wait: 3 },
  { id: 'comfort', name: 'Comfort', sub: 'Newer cars, extra legroom', seats: 4, base: 3.6, perKm: 1.3, perMin: 0.28, wait: 4 },
  { id: 'xl', name: 'XL', sub: 'SUVs and vans for groups', seats: 6, base: 4.8, perKm: 1.75, perMin: 0.36, wait: 6 },
]

const PAYS = ['Visa •• 4242', 'Cash', 'Ride Wallet · $18.40']
const CONTACTS = ['Sam Patel', 'Ava Chen', 'Mum']
const DRIVER = { name: 'Maya Torres', rating: 4.92, trips: 2318, car: 'Toyota Prius · Silver', plate: 'KJD 482' }
const QUICK = ['I am at the entrance', 'Be there in a minute', 'Thank you!']

const NAV = [
  ['home', 'home', 'Home'],
  ['activity', 'clock', 'Activity'],
  ['account', 'user', 'Account'],
]

const ICONS = {
  home: 'M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 20a8 8 0 0 1 16 0',
  back: 'M15 5l-7 7 7 7',
  chev: 'M9 5l7 7-7 7',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  pin: 'M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.800 12 21 12 21zM12 12a2.500 2.500 0 1 0 0-5 2.500 2.500 0 0 0 0 5z',
  brief: 'M4 8h16v11H4zM9 8V5h6v3M4 13h16',
  plane: 'M3 13l8-2 4-7 2 .5-2 7 5 1.500-.5 2-6-.5-3 5-2-.5 1-5.500-6 .5z',
  phone: 'M6 3h3l1.500 4-2 1.500a11 11 0 0 0 6 6l1.500-2 4 1.500v3a2 2 0 0 1-2 2A16 16 0 0 1 4 5a2 2 0 0 1 2-2z',
  msg: 'M4 5h16v11H9l-5 4z',
  share: 'M12 15V4m0 0L8 8m4-4l4 4M5 13v6h14v-6',
  x: 'M6 6l12 12M18 6L6 18',
  check: 'M5 12l5 5 9-10',
  card: 'M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 10h18',
  shield: 'M12 3l8 3v6c0 5-3.500 8-8 9-4.500-1-8-4-8-9V6z',
  tag: 'M3 12V4h8l10 10-8 8zM7.500 8.500h.01',
  send: 'M4 12l16-8-6 16-3-7z',
  user2: 'M9 11a3.500 3.500 0 1 0 0-7 3.500 3.500 0 0 0 0 7zM2 20a7 7 0 0 1 14 0M17 5a3 3 0 0 1 0 6M19 15a6 6 0 0 1 3 5',
  fast: 'M5 5l7 7-7 7M13 5l7 7-7 7',
}

function Icon({ name, size = 22, color = 'currentColor', w = 1.9 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  )
}

const iconBtn = { display: 'grid', placeItems: 'center', border: 'none', borderRadius: '50%', cursor: 'pointer', padding: 0, background: CARD, color: INK }

// ---------------------------------------------------------------- geometry

function routeBetween(a, b) {
  let pts
  if (a.gx === b.gx || a.gy === b.gy) pts = [gp(a.gx, a.gy), gp(b.gx, b.gy)]
  else {
    const mid = Math.round((a.gx + b.gx) / 2)
    pts = [gp(a.gx, a.gy), gp(mid, a.gy), gp(mid, b.gy), gp(b.gx, b.gy)]
  }
  return pts.filter((p, i) => i === 0 || p.x !== pts[i - 1].x || p.y !== pts[i - 1].y)
}

function measure(pts) {
  const cum = [0]
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y))
  return { pts, cum, total: cum[cum.length - 1] }
}

function rawAt(m, s) {
  const d = clamp(s, 0, m.total)
  let i = 1
  while (i < m.cum.length - 1 && m.cum[i] < d) i++
  const a = m.pts[i - 1]
  const b = m.pts[i]
  const seg = m.cum[i] - m.cum[i - 1] || 1
  const t = (d - m.cum[i - 1]) / seg
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
}

// position and smoothed heading (degrees) at distance s along the route
function at(m, s) {
  const p = rawAt(m, s)
  const a = rawAt(m, s - 14)
  const b = rawAt(m, s + 14)
  return { ...p, ang: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI }
}

// the path of the route cut off at distance s (for the "already driven" part)
function partial(m, s) {
  const d = clamp(s, 0, m.total)
  const out = [m.pts[0]]
  for (let i = 1; i < m.pts.length; i++) {
    if (m.cum[i] <= d) out.push(m.pts[i])
    else break
  }
  out.push(rawAt(m, d))
  return out
}

const toPath = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('')

function fitTo(pts, rect) {
  const xs = pts.map((p) => p.x)
  const ys = pts.map((p) => p.y)
  const x0 = Math.min(...xs)
  const x1 = Math.max(...xs)
  const y0 = Math.min(...ys)
  const y1 = Math.max(...ys)
  const s = clamp(Math.min((rect.r - rect.l) / Math.max(x1 - x0, 60), (rect.b - rect.t) / Math.max(y1 - y0, 60)), 0.75, 1.6)
  return { s, x: (rect.l + rect.r) / 2 - ((x0 + x1) / 2) * s, y: (rect.t + rect.b) / 2 - ((y0 + y1) / 2) * s }
}

function buildTrip(place, rideId, promo) {
  const dest = PLACES.find((p) => p.id === place) || PLACES[1]
  const route = measure(routeBetween(PICKUP, dest))
  const drv = measure(routeBetween(DRIVER_START, PICKUP))
  const km = (route.total / CELL) * 0.5
  const min = Math.max(4, Math.round(km * 2.9 + 2))
  const fares = {}
  RIDES.forEach((r) => {
    fares[r.id] = +(r.base + r.perKm * km + r.perMin * min).toFixed(2)
  })
  return { dest, ride: rideId, route, drv, km, min, fares, promo: promo || 0 }
}

const finalFare = (trip) => +(trip.fares[trip.ride] * (1 - trip.promo)).toFixed(2)

// ---------------------------------------------------------------- hooks

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

function useRaf(on, cb) {
  const ref = useRef(cb)
  ref.current = cb
  useEffect(() => {
    if (!on) return undefined
    let id
    let last = performance.now()
    const loop = (t) => {
      const dt = Math.min(100, t - last)
      last = t
      ref.current(dt)
      id = requestAnimationFrame(loop)
    }
    id = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(id)
  }, [on])
}

// ---------------------------------------------------------------- map art

const CityBase = memo(function CityBase() {
  const xs = [-3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
  const ys = [-4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]
  const parks = [[0, 3], [3, 4], [4, 9], [1, 10], [5, 5]]
  return (
    <g>
      <rect x={-300} y={-300} width={1000} height={1500} fill="#10141b" />
      {xs.slice(0, -1).map((gx) => ys.slice(0, -1).map((gy) => {
        const park = parks.some((p) => p[0] === gx && p[1] === gy)
        const a = gp(gx, gy)
        return <rect key={`${gx}_${gy}`} x={a.x + 5} y={a.y + 5} width={CELL - 10} height={CELL - 10} rx={5} fill={park ? '#14261f' : (gx + gy) % 3 === 0 ? '#181d27' : '#151a23'} />
      }))}
      {parks.map(([gx, gy]) => {
        const a = gp(gx, gy)
        return <circle key={`t${gx}${gy}`} cx={a.x + 32} cy={a.y + 32} r={12} fill="#1b3a2c" />
      })}
      <path d="M-300 500 C-60 470 80 640 250 600 S 520 560 700 700" fill="none" stroke="#12233a" strokeWidth={46} strokeLinecap="round" />
      {xs.map((gx) => <line key={`v${gx}`} x1={gx * CELL} y1={-300} x2={gx * CELL} y2={1200} stroke="#262d39" strokeWidth={9} />)}
      {ys.map((gy) => <line key={`h${gy}`} x1={-300} y1={OY + gy * CELL} x2={700} y2={OY + gy * CELL} stroke="#262d39" strokeWidth={9} />)}
      {xs.map((gx) => <line key={`vd${gx}`} x1={gx * CELL} y1={-300} x2={gx * CELL} y2={1200} stroke="#323a48" strokeWidth={1} strokeDasharray="6 8" />)}
      {ys.map((gy) => <line key={`hd${gy}`} x1={-300} y1={OY + gy * CELL} x2={700} y2={OY + gy * CELL} stroke="#323a48" strokeWidth={1} strokeDasharray="6 8" />)}
      {[1, 3, 4, 6].map((gy, i) => <text key={gy} x={14 + (i % 2) * 150} y={OY + gy * CELL - 8} fontSize={8} fontWeight={600} fill="#566176">{['Oak St', 'Elm St', 'Main St', 'Pine St'][i]}</text>)}
    </g>
  )
})

function CarIcon({ x, y, ang, color, size = 1, shadow = true }) {
  return (
    <g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${ang.toFixed(1)}) scale(${size})`}>
      {shadow && <rect x={-12} y={-7} width={26} height={16} rx={6} fill="#000" opacity={0.35} />}
      <rect x={-13} y={-7.500} width={26} height={15} rx={5} fill={color} stroke="#0e1116" strokeWidth={1.500} />
      <rect x={-2} y={-5.500} width={8} height={11} rx={2} fill="#0e1116" opacity={0.75} />
      <rect x={-9} y={-5.500} width={4} height={11} rx={1.500} fill="#0e1116" opacity={0.45} />
      <rect x={11} y={-6} width={2} height={3} rx={1} fill="#fff7c2" />
      <rect x={11} y={3} width={2} height={3} rx={1} fill="#fff7c2" />
    </g>
  )
}

function Pin({ x, y, color, label }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M0 0C-12-14-12-30 0-30S12-14 0 0z" fill={color} stroke="#0e1116" strokeWidth={2} />
      <circle cx={0} cy={-20} r={4.500} fill="#0e1116" />
      {label && <text x={0} y={14} textAnchor="middle" fontSize={10} fontWeight={700} fill={INK} stroke="#0e1116" strokeWidth={3} paintOrder="stroke">{label}</text>}
    </g>
  )
}

function MapView({ tf, reduced, children }) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} aria-label="City map" role="img">
      <g style={{ transform: `translate(${tf.x}px, ${tf.y}px) scale(${tf.s})`, transformOrigin: '0 0', transition: reduced ? 'none' : 'transform .5s ease' }}>
        <CityBase />
        {children}
      </g>
    </svg>
  )
}

function IdleCars({ reduced }) {
  const [t, setT] = useState(0)
  useRaf(!reduced, (dt) => setT((v) => v + dt))
  const cars = [
    { gy: 4, dir: 1, sp: 0.03, off: 100, c: '#9aa5b6' },
    { gy: 7, dir: -1, sp: 0.025, off: 300, c: '#c7ced9' },
    { gx: 4, dir: 1, sp: 0.028, off: 40, c: '#9aa5b6' },
    { gx: 1, dir: -1, sp: 0.022, off: 500, c: '#7c8798' },
  ]
  return (
    <g>
      {cars.map((c, i) => {
        const pos = ((t * c.sp * c.dir + c.off) % 600 + 600) % 600 - 100
        if (c.gy !== undefined) return <CarIcon key={i} x={pos} y={OY + c.gy * CELL + (c.dir > 0 ? 8 : -8)} ang={c.dir > 0 ? 0 : 180} color={c.c} size={0.8} />
        return <CarIcon key={i} x={c.gx * CELL + (c.dir > 0 ? -8 : 8)} y={pos + 100} ang={c.dir > 0 ? 90 : -90} color={c.c} size={0.8} />
      })}
    </g>
  )
}

function RouteLine({ pts, accent, dim, dash }) {
  const d = toPath(pts)
  return (
    <g>
      <path d={d} fill="none" stroke="#0e1116" strokeWidth={dash ? 7 : 11} strokeLinecap="round" strokeLinejoin="round" opacity={dim ? 0.4 : 0.9} />
      <path d={d} fill="none" stroke={accent} strokeWidth={dash ? 3 : 6} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={dash ? '2 7' : undefined} opacity={dim ? 0.35 : 1} />
    </g>
  )
}

function Stars({ value, onChange, size = 38 }) {
  return (
    <div role="radiogroup" aria-label="Rating" style={{ display: 'flex', justifyContent: 'center', gap: 6 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} star${n > 1 ? 's' : ''}`} onClick={() => onChange(n)} style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', transform: value >= n ? 'scale(1.08)' : 'none', transition: 'transform .15s' }}>
          <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 3l2.700 5.600 6.100.9-4.400 4.300 1 6.100L12 17l-5.400 2.900 1-6.100L3.200 9.500l6.100-.9z" fill={value >= n ? '#fbbf24' : 'none'} stroke={value >= n ? '#fbbf24' : '#566176'} strokeWidth={1.600} strokeLinejoin="round" />
          </svg>
        </button>
      ))}
    </div>
  )
}

function StatusBar({ frame }) {
  const clock = new Date().toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' })
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 40, height: 54, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 30px 0 36px', fontSize: 16, fontWeight: 600, color: INK, pointerEvents: 'none' }}>
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

const fmtClock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

// ---------------------------------------------------------------- receipt

function Receipt({ trip, accent, saved, onDone, say }) {
  const [rating, setRating] = useState(saved?.rating || 0)
  const [tip, setTip] = useState(saved?.tip ?? 0)
  const fare = finalFare(trip)
  const svc = +(fare * 0.12).toFixed(2)
  const base = +(fare - svc).toFixed(2)
  const labels = ['', 'Poor', 'Could be better', 'Good', 'Great', 'Excellent']
  const vb = (() => {
    const xs = trip.route.pts.map((p) => p.x)
    const ys = trip.route.pts.map((p) => p.y)
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2
    const w = Math.max(Math.max(...xs) - Math.min(...xs) + 90, (Math.max(...ys) - Math.min(...ys) + 90) * (340 / 140), 200)
    const h = w * (140 / 340)
    return `${cx - w / 2} ${cy - h / 2} ${w} ${h}`
  })()
  const row = (l, v, bold) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', fontSize: 14, color: bold ? INK : MUTED, fontWeight: bold ? 800 : 500 }}>
      <span>{l}</span>
      <span style={{ color: INK, fontWeight: bold ? 800 : 600 }}>{v}</span>
    </div>
  )
  return (
    <div className="rd-scroll" style={{ height: '100%', overflowY: 'auto', paddingTop: 54, paddingBottom: 48 }}>
      <div style={{ padding: '10px 20px 0', fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em' }}>Trip receipt</div>
      <div style={{ padding: '0 20px', fontSize: 13, color: MUTED, marginTop: 2 }}>{saved?.date || 'Just now'} · {RIDES.find((r) => r.id === trip.ride).name}</div>
      <div style={{ margin: '14px 20px 0', borderRadius: 20, overflow: 'hidden', height: 140, position: 'relative', border: `1px solid ${LINE}` }}>
        <svg viewBox={vb} preserveAspectRatio="xMidYMid slice" style={{ width: '100%', height: '100%', display: 'block' }} aria-label="Route map" role="img">
          <CityBase />
          <RouteLine pts={trip.route.pts} accent={accent} />
          <circle cx={trip.route.pts[0].x} cy={trip.route.pts[0].y} r={6} fill={INK} stroke="#0e1116" strokeWidth={2} />
          <Pin x={trip.route.pts[trip.route.pts.length - 1].x} y={trip.route.pts[trip.route.pts.length - 1].y} color={accent} />
        </svg>
      </div>
      <div style={{ margin: '12px 20px 0', padding: '4px 16px', background: CARD, borderRadius: 20 }}>
        {row('To', trip.dest.name)}
        {row('Distance', `${trip.km.toFixed(1)} km · ${trip.min} min`)}
        {row('Base + distance', usd(base))}
        {row('Service fee', usd(svc))}
        {trip.promo > 0 && row('Promo RIDE10', `−${usd(trip.fares[trip.ride] - fare)}`)}
        {row('Tip', usd(tip))}
        <div style={{ borderTop: `1px solid ${LINE}`, marginTop: 4 }} />
        {row('Total', usd(fare + tip), true)}
      </div>
      <div style={{ margin: '16px 20px 0', padding: '16px 14px', background: CARD, borderRadius: 20, textAlign: 'center' }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Rate {DRIVER.name.split(' ')[0]}</div>
        <Stars value={rating} onChange={(n) => (setRating(n), say(`${n} star${n > 1 ? 's' : ''} — ${labels[n]}`))} />
        <div style={{ height: 18, fontSize: 12.5, color: MUTED, marginTop: 8 }}>{labels[rating]}</div>
        <div style={{ fontSize: 13, color: MUTED, margin: '8px 0 8px' }}>Add a tip</div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          {[0, 1, 2, 5].map((t) => (
            <button key={t} type="button" onClick={() => setTip(t)} aria-pressed={tip === t} style={{ height: 38, minWidth: 58, borderRadius: 19, border: `1.5px solid ${tip === t ? accent : LINE}`, background: tip === t ? `${accent}22` : 'transparent', color: tip === t ? accent : INK, font: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              {t ? `$${t}` : 'No tip'}
            </button>
          ))}
        </div>
      </div>
      <div style={{ padding: '16px 20px 0', display: 'grid', gap: 8 }}>
        <button type="button" onClick={() => onDone(rating, tip)} style={{ height: 52, borderRadius: 26, border: 'none', background: accent, color: ON, font: 'inherit', fontSize: 15, fontWeight: 800, cursor: 'pointer' }}>Done · {usd(fare + tip)}</button>
        <button type="button" onClick={() => say('Receipt emailed to alex@northwind.com')} style={{ height: 44, border: 'none', background: 'none', font: 'inherit', fontSize: 14, fontWeight: 600, color: MUTED, cursor: 'pointer' }}>Email receipt</button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- trip

const SNAPS = [150, 350, 520]
const PICK_SEC = 9
const FIND_SEC = 2

function TripScreen({ trip, accent, say, reduced, onCancel, onFinish }) {
  const { route, drv } = trip
  const rideSec = clamp(trip.km * 6, 14, 28)
  const [st, setSt] = useState({ phase: 'search', p: 0, t: 0 })
  const stRef = useRef(st)
  const [ff, setFf] = useState(1)
  const [sheet, setSheet] = useState(SNAPS[1])
  const [dragging, setDragging] = useState(false)
  const [panel, setPanel] = useState(null)
  const [msgs, setMsgs] = useState([{ from: 'd', t: 'Hi! I am on my way in a silver Prius.' }])
  const [draft, setDraft] = useState('')
  const [shared, setShared] = useState({})
  const [calling, setCalling] = useState(0)
  const drag = useRef(null)
  const timers = useRef([])

  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  useEffect(() => {
    if (!calling) return undefined
    const id = setInterval(() => setCalling((c) => c + 1), 1000)
    return () => clearInterval(id)
  }, [calling > 0])

  useRaf(st.phase !== 'arrived', (dt) => {
    let { phase, p, t } = stRef.current
    t += (dt * ff) / 1000
    if (phase === 'search' && t >= FIND_SEC) (phase = 'pickup'), (t = 0), (p = 0)
    else if (phase === 'pickup') {
      p = Math.min(1, t / PICK_SEC)
      if (p >= 1) (phase = 'ride'), (t = 0), (p = 0)
    } else if (phase === 'ride') {
      p = Math.min(1, t / rideSec)
      if (p >= 1) phase = 'arrived'
    }
    stRef.current = { phase, p, t }
    setSt(stRef.current)
  })

  const phase = st.phase
  useEffect(() => {
    if (phase === 'pickup') say(`${DRIVER.name.split(' ')[0]} accepted your ride`)
    if (phase === 'ride') say('Your ride has started')
    if (phase === 'arrived') say('You have arrived')
  }, [phase])

  const send = (text) => {
    const v = text.trim()
    if (!v) return
    setMsgs((m) => [...m, { from: 'me', t: v }])
    setDraft('')
    timers.current.push(setTimeout(() => setMsgs((m) => [...m, { from: 'd', t: 'Got it, see you soon.' }]), 1100))
  }

  // positions
  let car
  if (phase === 'search') car = at(drv, 0)
  else if (phase === 'pickup') car = at(drv, st.p * drv.total)
  else car = at(route, (phase === 'arrived' ? 1 : st.p) * route.total)
  const driven = phase === 'ride' || phase === 'arrived' ? partial(route, (phase === 'arrived' ? 1 : st.p) * route.total) : null

  const pickMin = 4
  const remain = phase === 'pickup' ? pickMin * 60 * (1 - st.p) : phase === 'ride' ? trip.min * 60 * (1 - st.p) : phase === 'search' ? pickMin * 60 : 0
  const arrive = new Date(Date.now() + remain * 1000).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  const pct = phase === 'ride' ? st.p : phase === 'arrived' ? 1 : phase === 'pickup' ? st.p : 0
  const title = { search: 'Finding your driver…', pickup: `${DRIVER.name.split(' ')[0]} is arriving`, ride: `Heading to ${trip.dest.name}`, arrived: 'You have arrived' }[phase]
  const startPts = [...drv.pts, ...route.pts]
  const tf = fitTo(phase === 'search' || phase === 'pickup' ? startPts : route.pts, { l: 50, r: 320, t: 130, b: H - sheet - 40 })

  const down = (e) => {
    const phoneEl = e.currentTarget.closest('[data-phone]')
    const k = phoneEl ? phoneEl.getBoundingClientRect().width / W : 1
    e.currentTarget.setPointerCapture?.(e.pointerId)
    drag.current = { y: e.clientY, h: sheet, k, moved: false }
    setDragging(true)
  }
  const move = (e) => {
    const d = drag.current
    if (!d) return
    const dy = (e.clientY - d.y) / d.k
    if (Math.abs(dy) > 3) d.moved = true
    setSheet(clamp(d.h - dy, SNAPS[0], SNAPS[2]))
  }
  const up = () => {
    const d = drag.current
    drag.current = null
    setDragging(false)
    if (!d) return
    if (!d.moved) setSheet((h) => SNAPS[(SNAPS.indexOf(SNAPS.reduce((a, b) => (Math.abs(b - h) < Math.abs(a - h) ? b : a))) + 1) % 3])
    else setSheet((h) => SNAPS.reduce((a, b) => (Math.abs(b - h) < Math.abs(a - h) ? b : a)))
  }

  const act = (icon, label, fn, danger) => (
    <button type="button" onClick={fn} style={{ flex: 1, display: 'grid', justifyItems: 'center', gap: 6, border: 'none', background: 'none', font: 'inherit', fontSize: 12, fontWeight: 600, color: danger ? '#f87171' : INK, cursor: 'pointer', padding: 0 }}>
      <span style={{ width: 48, height: 48, borderRadius: '50%', display: 'grid', placeItems: 'center', background: CARD2, color: danger ? '#f87171' : accent }}><Icon name={icon} size={21} /></span>
      {label}
    </button>
  )

  const sheetBtn = { height: 46, borderRadius: 23, border: 'none', font: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer' }

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: BG }}>
      <MapView tf={tf} reduced={reduced}>
        {(phase === 'search' || phase === 'pickup') && <RouteLine pts={drv.pts} accent="#8b95a5" dash />}
        <RouteLine pts={route.pts} accent={accent} dim={!!driven} />
        {driven && <RouteLine pts={driven} accent={accent} />}
        <circle cx={route.pts[0].x} cy={route.pts[0].y} r={7} fill={INK} stroke="#0e1116" strokeWidth={2.500} />
        <Pin x={route.pts[route.pts.length - 1].x} y={route.pts[route.pts.length - 1].y} color={accent} label={trip.dest.name} />
        <CarIcon x={car.x} y={car.y} ang={car.ang} color={accent} size={1.15} />
      </MapView>

      <div style={{ position: 'absolute', top: 60, left: 16, right: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 5 }}>
        <span style={{ padding: '9px 14px', borderRadius: 20, background: 'rgba(24,28,36,.92)', fontSize: 13, fontWeight: 700, display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: phase === 'arrived' ? '#fbbf24' : accent }} />
          {phase === 'arrived' ? 'Arrived' : `Arrive ${arrive}`}
        </span>
        <button type="button" onClick={() => setFf((v) => (v === 1 ? 4 : 1))} aria-pressed={ff > 1} aria-label="Fast forward the simulation" style={{ ...iconBtn, width: 44, height: 44, background: ff > 1 ? accent : 'rgba(24,28,36,.92)', color: ff > 1 ? ON : INK }}>
          <Icon name="fast" size={20} />
        </button>
      </div>

      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: sheet, background: CARD, borderRadius: '26px 26px 0 0', boxShadow: '0 -10px 30px rgba(0,0,0,.45)', transition: dragging || reduced ? 'none' : 'height .25s ease', overflow: 'hidden', zIndex: 6 }}>
        <div onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} role="button" tabIndex={0} aria-label="Drag to resize the trip sheet" onKeyDown={(e) => (e.key === 'ArrowUp' ? setSheet((h) => clamp(h + 80, SNAPS[0], SNAPS[2])) : e.key === 'ArrowDown' ? setSheet((h) => clamp(h - 80, SNAPS[0], SNAPS[2])) : null)} style={{ touchAction: 'none', cursor: 'grab', padding: '10px 20px 12px' }}>
          <div style={{ width: 44, height: 5, borderRadius: 3, background: '#3a4352', margin: '0 auto 12px' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-0.01em' }}>{title}</div>
            {phase !== 'arrived' && phase !== 'search' && <div style={{ fontSize: 18, fontWeight: 800, color: accent, fontVariantNumeric: 'tabular-nums' }}>{fmtClock(remain)}</div>}
          </div>
          <div style={{ height: 6, borderRadius: 3, background: CARD2, marginTop: 10, overflow: 'hidden' }}>
            <div style={{ width: `${pct * 100}%`, height: '100%', background: accent, borderRadius: 3 }} />
          </div>
          <div style={{ fontSize: 12, color: MUTED, marginTop: 6 }}>
            {phase === 'search' ? 'Matching you with a nearby driver' : phase === 'pickup' ? `Pickup in ${Math.max(1, Math.ceil(remain / 60))} min · ${DRIVER.car}` : phase === 'ride' ? `${(trip.km * (1 - st.p)).toFixed(1)} km to go · ${Math.round(pct * 100)}% complete` : 'Thanks for riding with us'}
          </div>
        </div>

        <div className="rd-scroll" style={{ position: 'absolute', top: 100, bottom: 0, left: 0, right: 0, overflowY: 'auto', padding: '0 20px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderRadius: 18, background: CARD2 }}>
            <span style={{ width: 48, height: 48, borderRadius: '50%', display: 'grid', placeItems: 'center', background: `${accent}33`, color: accent, fontWeight: 800 }}>MT</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 15, fontWeight: 700 }}>{DRIVER.name} <span style={{ color: '#fbbf24', fontSize: 13 }}>★ {DRIVER.rating}</span></span>
              <span style={{ display: 'block', fontSize: 12, color: MUTED, marginTop: 2 }}>{DRIVER.car}</span>
            </span>
            <span style={{ padding: '6px 10px', borderRadius: 9, background: '#fff', color: '#111', fontSize: 13, fontWeight: 800, letterSpacing: '.05em' }}>{DRIVER.plate}</span>
          </div>
          <div style={{ display: 'flex', padding: '16px 0 6px' }}>
            {act('msg', 'Contact', () => setPanel('contact'))}
            {act('share', Object.values(shared).some(Boolean) ? 'Shared' : 'Share', () => setPanel('share'))}
            {phase === 'arrived' ? act('check', 'Pay & rate', onFinish) : act('x', 'Cancel', () => setPanel('cancel'), true)}
          </div>
          {phase === 'arrived' && <button type="button" onClick={onFinish} style={{ ...sheetBtn, width: '100%', background: accent, color: ON, marginTop: 8 }}>Pay {usd(finalFare(trip))} and rate</button>}
          <div style={{ marginTop: 10, padding: '4px 14px', borderRadius: 18, background: CARD2, fontSize: 13.5 }}>
            {[['Pickup', 'Elm St & 2nd Ave'], ['Dropoff', trip.dest.name], ['Ride', `${RIDES.find((r) => r.id === trip.ride).name} · ${usd(finalFare(trip))}`], ['Distance', `${trip.km.toFixed(1)} km`]].map(([l, v]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 0', borderBottom: `1px solid ${LINE}` }}>
                <span style={{ color: MUTED }}>{l}</span>
                <span style={{ fontWeight: 600 }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {panel && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 20, display: 'flex', alignItems: 'flex-end', background: 'rgba(0,0,0,.55)' }} onClick={() => setPanel(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxHeight: 560, overflowY: 'auto', background: CARD, borderRadius: '26px 26px 0 0', padding: '18px 20px 32px' }}>
            {panel === 'contact' && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>{DRIVER.name}</div>
                  <button type="button" onClick={() => setCalling((c) => (c ? 0 : 1))} style={{ ...sheetBtn, height: 38, padding: '0 16px', background: calling ? '#dc2626' : accent, color: calling ? '#fff' : ON }}>
                    {calling ? `End call ${fmtClock(calling)}` : 'Call'}
                  </button>
                </div>
                <div style={{ display: 'grid', gap: 8, margin: '14px 0', minHeight: 70 }}>
                  {msgs.map((m, i) => (
                    <div key={i} style={{ justifySelf: m.from === 'me' ? 'end' : 'start', maxWidth: '78%', padding: '9px 13px', borderRadius: 16, background: m.from === 'me' ? accent : CARD2, color: m.from === 'me' ? ON : INK, fontSize: 14 }}>{m.t}</div>
                  ))}
                </div>
                <div className="rd-scroll" style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 10 }}>
                  {QUICK.map((q) => <button key={q} type="button" onClick={() => send(q)} style={{ flex: 'none', height: 34, padding: '0 13px', borderRadius: 17, border: `1px solid ${LINE}`, background: 'none', color: INK, font: 'inherit', fontSize: 13, cursor: 'pointer' }}>{q}</button>)}
                </div>
                <form onSubmit={(e) => (e.preventDefault(), send(draft))} style={{ display: 'flex', gap: 8 }}>
                  <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Message your driver" aria-label="Message" style={{ flex: 1, height: 44, borderRadius: 22, border: `1px solid ${LINE}`, background: CARD2, color: INK, padding: '0 16px', font: 'inherit', fontSize: 14, outline: 'none' }} />
                  <button type="submit" aria-label="Send" style={{ ...iconBtn, width: 44, height: 44, background: accent, color: ON }}><Icon name="send" size={19} /></button>
                </form>
              </>
            )}
            {panel === 'share' && (
              <>
                <div style={{ fontSize: 18, fontWeight: 800 }}>Share trip status</div>
                <div style={{ fontSize: 13, color: MUTED, margin: '4px 0 12px' }}>They see your live location, driver and plate.</div>
                {CONTACTS.map((c) => (
                  <button key={c} type="button" onClick={() => (setShared((s) => ({ ...s, [c]: !s[c] })), say(shared[c] ? `Stopped sharing with ${c}` : `Sharing with ${c}`))} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '13px 0', border: 'none', borderBottom: `1px solid ${LINE}`, background: 'none', color: INK, font: 'inherit', fontSize: 15, cursor: 'pointer' }}>
                    <span>{c}</span>
                    <span style={{ width: 26, height: 26, borderRadius: '50%', display: 'grid', placeItems: 'center', background: shared[c] ? accent : CARD2, color: ON }}>{shared[c] && <Icon name="check" size={16} w={3} />}</span>
                  </button>
                ))}
                <button type="button" onClick={() => (say('Trip link copied'), setPanel(null))} style={{ ...sheetBtn, width: '100%', marginTop: 16, background: CARD2, color: INK }}>Copy trip link</button>
              </>
            )}
            {panel === 'cancel' && (
              <>
                <div style={{ fontSize: 18, fontWeight: 800 }}>Cancel this ride?</div>
                <div style={{ fontSize: 13.5, color: MUTED, margin: '6px 0 16px' }}>
                  {phase === 'search' ? 'No charge, you can request again any time.' : phase === 'pickup' ? 'A $3.00 cancellation fee applies because your driver is already on the way.' : 'You will be charged for the distance travelled so far.'}
                </div>
                <div style={{ display: 'grid', gap: 8 }}>
                  <button type="button" onClick={() => setPanel(null)} style={{ ...sheetBtn, background: accent, color: ON }}>Keep my ride</button>
                  <button type="button" onClick={() => onCancel(phase === 'search' ? 0 : phase === 'pickup' ? 3 : +(finalFare(trip) * st.p).toFixed(2))} style={{ ...sheetBtn, background: 'none', color: '#f87171' }}>Cancel ride</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- app

const initStack = (s, trip) => (s === 'home' || s === 'activity' || s === 'account' ? [] : [s === 'trip' || s === 'receipt' ? { id: s, trip } : { id: s }])

const SEED = [
  { id: 'h1', place: 'work', ride: 'eco', date: 'Yesterday, 18:20', rating: 5, tip: 2 },
  { id: 'h2', place: 'museum', ride: 'comfort', date: 'Mon 10 Nov, 11:05', rating: 4, tip: 0 },
  { id: 'h3', place: 'airport', ride: 'xl', date: 'Sat 8 Nov, 05:40', rating: 5, tip: 5 },
]

export default function RideApp({ name = 'Ridely', accent = '#2dd4a0', startScreen = 'home', frame = true, style }) {
  const box = useRef()
  const toastTimer = useRef()
  const reduced = useReduced()
  const [scale, setScale] = useState(1)
  const [tab, setTab] = useState(['activity', 'account'].includes(startScreen) ? startScreen : 'home')
  const [dest, setDest] = useState('work')
  const [rideId, setRideId] = useState('comfort')
  const [pay, setPay] = useState(0)
  const [promo, setPromo] = useState(0)
  const [promoText, setPromoText] = useState('')
  const [q, setQ] = useState('')
  const [history, setHistory] = useState(SEED)
  const [stack, setStack] = useState(() => initStack(startScreen, buildTrip('work', 'comfort', 0)))
  const [dir, setDir] = useState(1)
  const [toast, setToast] = useState('')
  const [opts, setOpts] = useState({ auto: false, pin: true })

  useEffect(() => {
    setTab(['activity', 'account'].includes(startScreen) ? startScreen : 'home')
    setStack(initStack(startScreen, buildTrip(dest, rideId, promo)))
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
  const toHome = () => (setDir(-1), setTab('home'), setStack([]))

  const pickDest = (id) => (setDest(id), push({ id: 'options' }))
  const trip = buildTrip(dest, rideId, promo)
  const tabbed = !top
  const place = (id) => PLACES.find((p) => p.id === id)

  const header = (title, back) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px 6px', minHeight: 48 }}>
      {back && <button type="button" onClick={back} aria-label="Back" style={{ ...iconBtn, width: 38, height: 38 }}><Icon name="back" size={20} /></button>}
      <h1 style={{ margin: 0, fontSize: back ? 18 : 26, fontWeight: 800, letterSpacing: '-0.02em', marginLeft: 4 }}>{title}</h1>
    </div>
  )

  const placeRow = (p, onClick, extra) => (
    <button key={p.id} type="button" onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '11px 4px', border: 'none', borderBottom: `1px solid ${LINE}`, background: 'none', font: 'inherit', textAlign: 'left', cursor: 'pointer', color: INK }}>
      <span style={{ width: 40, height: 40, borderRadius: '50%', display: 'grid', placeItems: 'center', background: CARD2, color: accent, flex: 'none' }}><Icon name={p.icon} size={19} /></span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 15, fontWeight: 600 }}>{p.name}</span>
        <span style={{ display: 'block', fontSize: 12.500, color: MUTED, marginTop: 1 }}>{p.sub}</span>
      </span>
      {extra}
    </button>
  )

  let body
  if (top?.id === 'trip') {
    body = (
      <TripScreen
        key={top.trip.dest.id + top.trip.ride}
        trip={top.trip}
        accent={accent}
        say={say}
        reduced={reduced}
        onCancel={(fee) => (toHome(), say(fee ? `Ride cancelled · ${usd(fee)} fee` : 'Ride cancelled'))}
        onFinish={() => (setDir(1), setStack([{ id: 'receipt', trip: top.trip }]))}
      />
    )
  } else if (top?.id === 'receipt') {
    body = (
      <Receipt
        key={top.trip.dest.id + (top.saved?.id || 'new')}
        trip={top.trip}
        saved={top.saved}
        accent={accent}
        say={say}
        onDone={(rating, tip) => {
          const entry = { id: top.saved?.id || `h${Date.now()}`, place: top.trip.dest.id, ride: top.trip.ride, date: top.saved?.date || 'Today', rating, tip, promo: top.trip.promo }
          setHistory((h) => (top.saved ? h.map((x) => (x.id === entry.id ? entry : x)) : [entry, ...h]))
          go('activity')
          say(rating ? `Thanks! You rated ${rating} star${rating > 1 ? 's' : ''}` : 'Receipt saved')
        }}
      />
    )
  } else if (top?.id === 'destination') {
    const list = PLACES.filter((p) => (p.name + p.sub).toLowerCase().includes(q.trim().toLowerCase()))
    body = (
      <div className="rd-scroll" style={{ height: '100%', overflowY: 'auto', paddingTop: 54, paddingBottom: 24 }}>
        {header('Where to?', () => (setQ(''), pop()))}
        <div style={{ margin: '6px 16px 0', borderRadius: 18, background: CARD, padding: '4px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 44, borderBottom: `1px solid ${LINE}`, fontSize: 14 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: INK }} />
            <span style={{ color: MUTED }}>Pickup</span><span style={{ fontWeight: 600 }}>Elm St & 2nd Ave</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 46 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: accent }} />
            <input autoFocus={false} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search destination" aria-label="Search destination" style={{ flex: 1, minWidth: 0, background: 'none', border: 'none', outline: 'none', color: INK, font: 'inherit', fontSize: 15, fontWeight: 600 }} />
            {q && <button type="button" onClick={() => setQ('')} aria-label="Clear" style={{ ...iconBtn, width: 26, height: 26, background: CARD2 }}><Icon name="x" size={14} /></button>}
          </div>
        </div>
        <div style={{ padding: '14px 20px 4px', fontSize: 12, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '.06em' }}>{q ? `${list.length} result${list.length === 1 ? '' : 's'}` : 'Saved and suggested'}</div>
        <div style={{ padding: '0 16px' }}>
          {list.map((p) => {
            const km = ((Math.abs(p.gx - PICKUP.gx) + Math.abs(p.gy - PICKUP.gy)) * 0.5)
            return placeRow(p, () => pickDest(p.id), <span style={{ fontSize: 12, color: MUTED, fontWeight: 600 }}>{km.toFixed(1)} km</span>)
          })}
          {!list.length && <div style={{ textAlign: 'center', color: MUTED, fontSize: 13, padding: '34px 0' }}>No places match “{q}”.</div>}
        </div>
      </div>
    )
  } else if (top?.id === 'options') {
    const tf = fitTo(trip.route.pts, { l: 50, r: 330, t: 130, b: H - 490 })
    const sel = RIDES.find((r) => r.id === rideId)
    body = (
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
        <MapView tf={tf} reduced={reduced}>
          <RouteLine pts={trip.route.pts} accent={accent} />
          <circle cx={trip.route.pts[0].x} cy={trip.route.pts[0].y} r={7} fill={INK} stroke="#0e1116" strokeWidth={2.500} />
          <Pin x={trip.route.pts[trip.route.pts.length - 1].x} y={trip.route.pts[trip.route.pts.length - 1].y} color={accent} label={trip.dest.name} />
        </MapView>
        <button type="button" onClick={pop} aria-label="Back" style={{ ...iconBtn, position: 'absolute', top: 62, left: 16, width: 42, height: 42, zIndex: 5 }}><Icon name="back" size={20} /></button>
        <span style={{ position: 'absolute', top: 66, right: 16, padding: '9px 14px', borderRadius: 20, background: 'rgba(24,28,36,.92)', fontSize: 13, fontWeight: 700, zIndex: 5 }}>{trip.km.toFixed(1)} km · {trip.min} min</span>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, background: CARD, borderRadius: '26px 26px 0 0', padding: '14px 16px 30px', boxShadow: '0 -10px 30px rgba(0,0,0,.45)', zIndex: 6 }}>
          <div style={{ width: 44, height: 5, borderRadius: 3, background: '#3a4352', margin: '0 auto 12px' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 4px 8px', alignItems: 'baseline' }}>
            <span style={{ fontSize: 18, fontWeight: 800 }}>Choose a ride</span>
            <button type="button" onClick={() => push({ id: 'destination' })} style={{ border: 'none', background: 'none', color: accent, font: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>To {trip.dest.name} · Change</button>
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {RIDES.map((r) => {
              const f = trip.fares[r.id]
              const on = r.id === rideId
              return (
                <button key={r.id} type="button" onClick={() => setRideId(r.id)} aria-pressed={on} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 18, border: `2px solid ${on ? accent : 'transparent'}`, background: on ? `${accent}14` : CARD2, color: INK, font: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
                  <svg width="58" height="34" viewBox="-30 -17 60 34" aria-hidden="true"><CarIcon x={0} y={0} ang={0} color={r.id === 'xl' ? '#a5b4fc' : r.id === 'comfort' ? '#e5e7eb' : '#94a3b8'} size={r.id === 'xl' ? 1.7 : 1.4} shadow={false} /></svg>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 15, fontWeight: 700 }}>{r.name} <span style={{ fontSize: 12, color: MUTED, fontWeight: 500 }}>· {r.seats} seats</span></span>
                    <span style={{ display: 'block', fontSize: 12, color: MUTED, marginTop: 2 }}>{r.wait} min away · {r.sub}</span>
                  </span>
                  <span style={{ textAlign: 'right' }}>
                    <span style={{ display: 'block', fontSize: 16, fontWeight: 800 }}>{usd(f * (1 - promo))}</span>
                    {promo > 0 && <span style={{ display: 'block', fontSize: 11.500, color: MUTED, textDecoration: 'line-through' }}>{usd(f)}</span>}
                  </span>
                </button>
              )
            })}
          </div>
          <button type="button" onClick={() => (setPay((p) => (p + 1) % PAYS.length), say(`Paying with ${PAYS[(pay + 1) % PAYS.length]}`))} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', margin: '12px 0 10px', padding: '10px 6px', border: 'none', background: 'none', color: INK, font: 'inherit', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            <Icon name="card" size={20} color={accent} /><span style={{ flex: 1, textAlign: 'left' }}>{PAYS[pay]}</span><span style={{ color: MUTED, fontSize: 12.500 }}>{promo > 0 ? 'RIDE10 applied' : 'Tap to switch'}</span>
          </button>
          <button type="button" onClick={() => push({ id: 'trip', trip })} style={{ width: '100%', height: 54, borderRadius: 27, border: 'none', background: accent, color: ON, font: 'inherit', fontSize: 16, fontWeight: 800, cursor: 'pointer' }}>Confirm {sel.name} · {usd(trip.fares[rideId] * (1 - promo))}</button>
        </div>
      </div>
    )
  } else if (tab === 'activity') {
    body = (
      <div className="rd-scroll" style={{ height: '100%', overflowY: 'auto', paddingTop: 54, paddingBottom: 24 }}>
        {header('Activity')}
        <div style={{ padding: '4px 16px', display: 'grid', gap: 10 }}>
          {history.map((h) => {
            const t = buildTrip(h.place, h.ride, h.promo || 0)
            return (
              <button key={h.id} type="button" onClick={() => push({ id: 'receipt', trip: t, saved: h })} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, borderRadius: 20, border: 'none', background: CARD, color: INK, font: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
                <span style={{ width: 44, height: 44, borderRadius: 14, display: 'grid', placeItems: 'center', background: CARD2, color: accent }}><Icon name={t.dest.icon} size={20} /></span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 15, fontWeight: 700 }}>{t.dest.name}</span>
                  <span style={{ display: 'block', fontSize: 12, color: MUTED, marginTop: 2 }}>{h.date} · {RIDES.find((r) => r.id === h.ride).name}{h.rating ? ` · ${'★'.repeat(h.rating)}` : ''}</span>
                </span>
                <span style={{ fontSize: 15, fontWeight: 800 }}>{usd(finalFare(t) + h.tip)}</span>
              </button>
            )
          })}
        </div>
      </div>
    )
  } else if (tab === 'account') {
    body = (
      <div className="rd-scroll" style={{ height: '100%', overflowY: 'auto', paddingTop: 54, paddingBottom: 24 }}>
        {header('Account')}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '6px 20px 14px' }}>
          <span style={{ width: 62, height: 62, borderRadius: '50%', display: 'grid', placeItems: 'center', background: `${accent}33`, color: accent, fontSize: 22, fontWeight: 800 }}>AR</span>
          <span><span style={{ display: 'block', fontSize: 19, fontWeight: 800 }}>Alex Rivera</span><span style={{ fontSize: 13, color: MUTED }}>{name} member · {history.length} rides · ★ 4.9</span></span>
        </div>
        <div style={{ margin: '0 16px', background: CARD, borderRadius: 20, padding: '6px 16px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: MUTED, padding: '8px 0', textTransform: 'uppercase', letterSpacing: '.06em' }}>Payment method</div>
          {PAYS.map((p, i) => (
            <button key={p} type="button" onClick={() => (setPay(i), say(`${p} selected`))} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '12px 0', border: 'none', borderTop: `1px solid ${LINE}`, background: 'none', color: INK, font: 'inherit', fontSize: 14.500, cursor: 'pointer' }}>
              <span>{p}</span>
              <span style={{ width: 22, height: 22, borderRadius: '50%', border: `2px solid ${pay === i ? accent : LINE}`, display: 'grid', placeItems: 'center' }}>{pay === i && <span style={{ width: 10, height: 10, borderRadius: '50%', background: accent }} />}</span>
            </button>
          ))}
        </div>
        <div style={{ margin: '12px 16px 0', background: CARD, borderRadius: 20, padding: '12px 16px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}><Icon name="tag" size={18} color={accent} /> Promo code</div>
          <form onSubmit={(e) => { e.preventDefault(); const c = promoText.trim().toUpperCase(); if (c === 'RIDE10') (setPromo(0.1), say('RIDE10 applied · 10% off every ride')); else say(c ? 'Code not valid. Try RIDE10' : 'Enter a code') }} style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <input value={promoText} onChange={(e) => setPromoText(e.target.value)} placeholder={promo ? 'RIDE10 active' : 'Try RIDE10'} aria-label="Promo code" style={{ flex: 1, minWidth: 0, height: 42, borderRadius: 21, border: `1px solid ${LINE}`, background: CARD2, color: INK, padding: '0 14px', font: 'inherit', fontSize: 14, outline: 'none' }} />
            <button type="submit" style={{ height: 42, padding: '0 18px', borderRadius: 21, border: 'none', background: accent, color: ON, font: 'inherit', fontWeight: 800, cursor: 'pointer' }}>Apply</button>
          </form>
        </div>
        <div style={{ margin: '12px 16px 0', background: CARD, borderRadius: 20, padding: '4px 16px' }}>
          {[['auto', 'Auto-share trips with contacts', 'share'], ['pin', 'Ride PIN verification', 'shield']].map(([k, l, ic]) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 0', borderBottom: k === 'auto' ? `1px solid ${LINE}` : 'none' }}>
              <span style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 14, fontWeight: 600 }}><Icon name={ic} size={19} color={accent} />{l}</span>
              <button type="button" role="switch" aria-checked={opts[k]} aria-label={l} onClick={() => setOpts((o) => ({ ...o, [k]: !o[k] }))} style={{ width: 48, height: 28, borderRadius: 14, border: 'none', padding: 3, background: opts[k] ? accent : '#3a4352', cursor: 'pointer', transition: 'background .2s' }}>
                <span style={{ display: 'block', width: 22, height: 22, borderRadius: '50%', background: '#fff', transform: `translateX(${opts[k] ? 20 : 0}px)`, transition: 'transform .2s' }} />
              </button>
            </div>
          ))}
        </div>
        <div style={{ padding: '14px 16px' }}>
          <button type="button" onClick={() => (setHistory(SEED), setPromo(0), setPromoText(''), setPay(0), go('home'), say('Demo reset'))} style={{ width: '100%', height: 48, borderRadius: 24, border: 'none', background: CARD2, color: INK, font: 'inherit', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Reset demo</button>
        </div>
      </div>
    )
  } else {
    const tf = { s: 1.15, x: W / 2 - gp(PICKUP.gx, PICKUP.gy).x * 1.15, y: 230 - gp(PICKUP.gx, PICKUP.gy).y * 1.15 }
    const pk = gp(PICKUP.gx, PICKUP.gy)
    body = (
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
        <MapView tf={tf} reduced={reduced}>
          <IdleCars reduced={reduced} />
          <circle cx={pk.x} cy={pk.y} r={26} fill={accent} opacity={0.18}>{!reduced && <animate attributeName="r" values="14;34;14" dur="2.400s" repeatCount="indefinite" />}</circle>
          <circle cx={pk.x} cy={pk.y} r={8} fill={accent} stroke="#fff" strokeWidth={3} />
        </MapView>
        <div style={{ position: 'absolute', top: 62, left: 16, padding: '10px 15px', borderRadius: 20, background: 'rgba(24,28,36,.92)', fontSize: 14, fontWeight: 700, zIndex: 5 }}>Good evening, Alex</div>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, background: CARD, borderRadius: '26px 26px 0 0', padding: '14px 16px 18px', boxShadow: '0 -10px 30px rgba(0,0,0,.45)', zIndex: 6 }}>
          <div style={{ width: 44, height: 5, borderRadius: 3, background: '#3a4352', margin: '0 auto 14px' }} />
          <button type="button" onClick={() => push({ id: 'destination' })} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', height: 56, padding: '0 18px', borderRadius: 28, border: 'none', background: CARD2, color: INK, font: 'inherit', fontSize: 17, fontWeight: 700, cursor: 'pointer', textAlign: 'left' }}>
            <Icon name="search" size={22} color={accent} /> Where to?
            <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, padding: '6px 12px', borderRadius: 14, background: CARD }}>Now</span>
          </button>
          <div style={{ display: 'flex', gap: 10, margin: '14px 0 6px' }}>
            {['home', 'work'].map((id) => {
              const p = place(id)
              return (
                <button key={id} type="button" onClick={() => pickDest(id)} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, height: 48, padding: '0 14px', borderRadius: 16, border: `1px solid ${LINE}`, background: 'none', color: INK, font: 'inherit', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                  <Icon name={p.icon} size={19} color={accent} />{p.name}
                </button>
              )
            })}
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '.06em', padding: '8px 4px 0' }}>Recent</div>
          {history.slice(0, 2).map((h) => placeRow(place(h.place), () => pickDest(h.place), <Icon name="chev" size={16} color={MUTED} />))}
        </div>
      </div>
    )
  }

  const phone = (
    <div data-phone="1" style={{ position: 'relative', width: W, height: H, overflow: 'hidden', borderRadius: frame ? 46 : 0, background: BG, color: INK, fontFamily: "-apple-system, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif" }}>
      <style>{`
        @keyframes rd-r { from { opacity: 0; transform: translateX(34px) } to { opacity: 1; transform: none } }
        @keyframes rd-l { from { opacity: 0; transform: translateX(-34px) } to { opacity: 1; transform: none } }
        .rd-scroll { scrollbar-width: none } .rd-scroll::-webkit-scrollbar { display: none }
        .rd-app button:focus-visible, .rd-app input:focus-visible, .rd-app [role=button]:focus-visible { outline: 2px solid ${accent}; outline-offset: 2px }
        .rd-app input::placeholder { color: ${MUTED} }
        @media (prefers-reduced-motion: reduce) { .rd-slide { animation: none !important } }
      `}</style>
      <StatusBar frame={frame} />
      <div key={`${tab}/${stack.map((s) => s.id).join('/')}`} className="rd-slide" style={{ position: 'absolute', top: 0, bottom: tabbed ? 84 : 0, left: 0, right: 0, overflow: 'hidden', animation: `${dir > 0 ? 'rd-r' : 'rd-l'} .28s ease` }}>
        {body}
      </div>
      {tabbed && (
        <nav aria-label="Main" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 84, background: '#12161d', borderTop: `1px solid ${LINE}`, display: 'flex', justifyContent: 'space-around', padding: '10px 8px 0', zIndex: 10 }}>
          {NAV.map(([id, icon, label]) => (
            <button key={id} type="button" onClick={() => go(id)} aria-current={tab === id ? 'page' : undefined} style={{ border: 'none', background: 'none', font: 'inherit', cursor: 'pointer', display: 'grid', justifyItems: 'center', alignContent: 'start', gap: 3, width: 84, height: 54, fontSize: 11, fontWeight: 600, color: tab === id ? accent : MUTED }}>
              <Icon name={icon} size={23} />
              {label}
            </button>
          ))}
        </nav>
      )}
      <div role="status" style={{ position: 'absolute', left: '50%', top: 58, zIndex: 50, transform: `translate(-50%, ${toast ? 0 : -90}px)`, transition: 'transform .35s cubic-bezier(.2,.8,.2,1)', padding: '10px 16px', borderRadius: 20, background: INK, color: BG, fontSize: 12.500, fontWeight: 700, whiteSpace: 'nowrap', maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis' }}>{toast}</div>
      <div style={{ position: 'absolute', left: '50%', bottom: 8, width: 140, height: 5, marginLeft: -70, borderRadius: 3, background: INK, opacity: 0.8, zIndex: 45 }} />
    </div>
  )

  return (
    <div ref={box} className="rd-app" style={{ position: 'relative', width: '100%', height: '100%', display: 'grid', placeItems: 'center', overflow: 'hidden', background: 'radial-gradient(ellipse at 50% 30%, #2a3140, #0b0d11 75%)', ...style }}>
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
