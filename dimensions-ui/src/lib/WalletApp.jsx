import { useEffect, useRef, useState } from 'react'

// A card wallet on a phone, as a click-through prototype. Five pages: Wallet,
// Card detail, Add card, Transactions and Settings. On Wallet the cards are a
// stack: tap it and the cards fan out, tap a card in the fan and it comes to
// the front (the others re-order with a slide). Tap the front card again to
// open its detail, where the card flips in 3D to show the magnetic strip and
// CVV. Add card has a live preview that formats the number, detects the brand
// (Visa, Mastercard, Amex, Discover) and flips to the back while you type the
// CVV. Freeze and limits are real: "Tap to pay" is declined on a frozen card
// or past its monthly limit, otherwise it adds a transaction. The phone
// scales to fit whatever box it is in.

const W = 390 // the phone screen, in CSS px (an iPhone's width)
const H = 844
const INK = '#1d1a17'
const MUTED = '#8a8178'
const BG = '#f3eee6'
const LINE = '#ece5da'
const FONT = "-apple-system, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif"

const CURRENCIES = { USD: ['$', 1], EUR: ['€', 0.92], GBP: ['£', 0.79] }

const BRANDS = {
  visa: { name: 'Visa', gaps: [4, 4, 4, 4], cvv: 3, a: '#1e3a8a', b: '#3b82f6' },
  mastercard: { name: 'Mastercard', gaps: [4, 4, 4, 4], cvv: 3, a: '#7c2d12', b: '#f97316' },
  amex: { name: 'Amex', gaps: [4, 6, 5], cvv: 4, a: '#065f46', b: '#34d399' },
  discover: { name: 'Discover', gaps: [4, 4, 4, 4], cvv: 3, a: '#3f3f46', b: '#a1a1aa' },
  unknown: { name: 'Card', gaps: [4, 4, 4, 4], cvv: 3, a: '#292524', b: '#78716c' },
}

const detectBrand = (d) => {
  if (/^4/.test(d)) return 'visa'
  if (/^(5[1-5]|2[2-7])/.test(d)) return 'mastercard'
  if (/^3[47]/.test(d)) return 'amex'
  if (/^(6011|65|64[4-9])/.test(d)) return 'discover'
  return 'unknown'
}

const maxLen = (brand) => BRANDS[brand].gaps.reduce((a, b) => a + b, 0)

// Group a string of digits (or placeholder dots) by the brand's gaps.
const groupBy = (s, brand) => {
  const out = []
  let i = 0
  for (const g of BRANDS[brand].gaps) {
    if (i >= s.length) break
    out.push(s.slice(i, i + g))
    i += g
  }
  return out.join(' ')
}

const luhn = (d) => {
  let sum = 0
  for (let i = 0; i < d.length; i++) {
    let n = +d[d.length - 1 - i]
    if (i % 2) {
      n *= 2
      if (n > 9) n -= 9
    }
    sum += n
  }
  return d.length > 0 && sum % 10 === 0
}

const expValid = (e) => {
  if (!/^\d\d\/\d\d$/.test(e)) return false
  const m = +e.slice(0, 2)
  const y = 2000 + +e.slice(3)
  if (m < 1 || m > 12) return false
  const now = new Date()
  return y > now.getFullYear() || (y === now.getFullYear() && m >= now.getMonth() + 1)
}

const CARDS0 = [
  { id: 'c1', brand: 'visa', nick: 'Everyday', holder: 'ALEX RIVERA', num: '4539148803434821', exp: '09/28', cvv: '214', a: '#1e3a8a', b: '#38bdf8', limit: 2500, frozen: false, online: true, tap: true },
  { id: 'c2', brand: 'mastercard', nick: 'Travel', holder: 'ALEX RIVERA', num: '5412751234121190', exp: '02/29', cvv: '908', a: '#111827', b: '#7c3aed', limit: 5000, frozen: false, online: true, tap: true },
  { id: 'c3', brand: 'amex', nick: 'Rewards', holder: 'ALEX RIVERA', num: '371449635398431', exp: '11/27', cvv: '4417', a: '#14532d', b: '#4ade80', limit: 3000, frozen: false, online: true, tap: false },
]

const TXNS0 = [
  { id: 't1', card: 'c1', name: 'Blue Bottle Coffee', cat: 'Food', amt: -6.5, day: 0, time: '08:12', icon: 'cup' },
  { id: 't2', card: 'c2', name: 'Delta Air Lines', cat: 'Travel', amt: -412.8, day: 0, time: '06:40', icon: 'plane' },
  { id: 't3', card: 'c1', name: 'Whole Foods', cat: 'Groceries', amt: -84.3, day: 1, time: '19:05', icon: 'bag' },
  { id: 't4', card: 'c3', name: 'Spotify', cat: 'Subscriptions', amt: -11.99, day: 1, time: '09:00', icon: 'music' },
  { id: 't5', card: 'c1', name: 'Metro card top-up', cat: 'Transport', amt: -25, day: 2, time: '18:40', icon: 'train' },
  { id: 't6', card: 'c3', name: 'Uniqlo', cat: 'Shopping', amt: -59.9, day: 3, time: '13:22', icon: 'bag' },
  { id: 't7', card: 'c2', name: 'Airbnb Lisbon', cat: 'Travel', amt: -286, day: 4, time: '21:10', icon: 'plane' },
  { id: 't8', card: 'c1', name: 'Refund — Zara', cat: 'Shopping', amt: 39, day: 5, time: '11:45', icon: 'in' },
  { id: 't9', card: 'c1', name: 'Joe & The Juice', cat: 'Food', amt: -9.4, day: 6, time: '12:30', icon: 'cup' },
  { id: 't10', card: 'c3', name: 'Apple Music', cat: 'Subscriptions', amt: -10.99, day: 6, time: '08:00', icon: 'music' },
]

const MERCHANTS = [
  ['Corner Bakery', 'Food', 'cup', 7.8],
  ['Shell Station', 'Transport', 'train', 48.25],
  ['Target', 'Shopping', 'bag', 62.4],
  ['Uber', 'Transport', 'train', 18.6],
]

const DAYNAMES = ['Today', 'Yesterday']
const dayLabel = (d) => {
  if (d < 2) return DAYNAMES[d]
  const dt = new Date()
  dt.setDate(dt.getDate() - d)
  return dt.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })
}

const ICONS = {
  wallet: 'M3 7a2 2 0 0 1 2-2h13v3M3 7v10a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1H5a2 2 0 0 1-2-1zM16 13.5h.01',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2-1.2L14.2 3h-4l-.4 2.6a7 7 0 0 0-2 1.2l-2.3-.9-2 3.4 2 1.5a7 7 0 0 0 0 2.4l-2 1.5 2 3.4 2.3-.9a7 7 0 0 0 2 1.2l.4 2.6h4l.4-2.6a7 7 0 0 0 2-1.2l2.3.9 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z',
  plus: 'M12 5v14M5 12h14',
  back: 'M15 5l-7 7 7 7',
  chev: 'M9 5l7 7-7 7',
  cup: 'M5 8h11v6a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4zM16 9h2a2 2 0 0 1 0 5h-2',
  in: 'M12 4v14m0 0l-5-5m5 5l5-5',
  train: 'M7 4h10a2 2 0 0 1 2 2v9a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V6a2 2 0 0 1 2-2zM5 11h14M8 21l2-3m6 3l-2-3',
  music: 'M9 18V6l10-2v12M9 18a3 3 0 1 1-3-3 3 3 0 0 1 3 3zm10-2a3 3 0 1 1-3-3 3 3 0 0 1 3 3z',
  bag: 'M5 8h14l-1 12H6zM9 8a3 3 0 0 1 6 0',
  plane: 'M3 13l18-8-5 15-4-6zM12 14l-1 5',
  snow: 'M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  bell: 'M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  check: 'M5 12l5 5 9-10',
  x: 'M6 6l12 12M18 6L6 18',
  flip: 'M4 12a8 8 0 0 1 14-5l2-2v6h-6l2-2a5 5 0 0 0-9 3M20 12a8 8 0 0 1-14 5l-2 2v-6h6l-2 2a5 5 0 0 0 9-3',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18',
  wave: 'M7 8a6 6 0 0 1 0 8M11 5a10 10 0 0 1 0 14M15 2a14 14 0 0 1 0 20',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM16 16l5 5',
  trash: 'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 20a8 8 0 0 1 16 0',
  phone: 'M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM11 18h2',
  coin: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v10M9.5 9.5c0-1 1-1.5 2.5-1.5s2.5.6 2.5 1.8c0 2-5 1.4-5 3.6 0 1.200 1.200 1.700 2.500 1.700s2.500-.6 2.500-1.600',
}

function Icon({ name, size = 22, color = 'currentColor', w = 1.9 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  )
}

const iconBtn = { display: 'grid', placeItems: 'center', border: 'none', borderRadius: '50%', cursor: 'pointer', padding: 0, background: 'transparent', color: INK }

function BrandMark({ brand, size = 1 }) {
  const s = { display: 'block' }
  if (brand === 'visa')
    return (
      <svg width={54 * size} height={20 * size} viewBox="0 0 54 20" style={s} aria-label="Visa">
        <text x="0" y="17" fontSize="21" fontWeight="800" fontStyle="italic" fill="#fff" fontFamily="Georgia, serif" letterSpacing="1">VISA</text>
      </svg>
    )
  if (brand === 'mastercard')
    return (
      <svg width={44 * size} height={28 * size} viewBox="0 0 44 28" style={s} aria-label="Mastercard">
        <circle cx="15" cy="14" r="12" fill="#ef4444" opacity=".92" />
        <circle cx="29" cy="14" r="12" fill="#fbbf24" opacity=".92" />
        <path d="M22 5.2a12 12 0 0 1 0 17.600 12 12 0 0 1 0-17.600z" fill="#f97316" />
      </svg>
    )
  if (brand === 'amex')
    return (
      <svg width={52 * size} height={22 * size} viewBox="0 0 52 22" style={s} aria-label="American Express">
        <rect x="0.5" y="0.5" width="51" height="21" rx="3" fill="rgba(255,255,255,.18)" stroke="#fff" />
        <text x="26" y="15" fontSize="10.500" fontWeight="800" fill="#fff" textAnchor="middle" fontFamily="Arial, sans-serif" letterSpacing="1">AMEX</text>
      </svg>
    )
  if (brand === 'discover')
    return (
      <svg width={66 * size} height={20 * size} viewBox="0 0 66 20" style={s} aria-label="Discover">
        <text x="0" y="14" fontSize="11" fontWeight="800" fill="#fff" fontFamily="Arial, sans-serif" letterSpacing=".5">DISCOVER</text>
        <circle cx="58" cy="9" r="6" fill="#fb923c" />
      </svg>
    )
  return <span style={{ width: 30, height: 20, display: 'block' }} />
}

function Chip({ size = 1 }) {
  return (
    <svg width={40 * size} height={30 * size} viewBox="0 0 40 30" aria-hidden="true" style={{ display: 'block' }}>
      <rect x="0" y="0" width="40" height="30" rx="6" fill="#e9c66b" />
      <path d="M0 10h13v10H0M27 10h13v10H27M13 0v30M27 0v30M13 10h14M13 20h14" stroke="#a8812c" strokeWidth="1.200" fill="none" />
    </svg>
  )
}

// What the card shows when partly typed or hidden: dots for the rest.
const maskedNumber = (c, show) => {
  const len = maxLen(c.brand)
  const digits = (c.num || '').slice(0, len)
  const full = digits.padEnd(len, '•')
  const shown = show ? full : full.replace(/\d/g, (ch, i) => (i >= len - 4 && digits.length === len ? ch : '•'))
  return groupBy(shown, c.brand)
}

function CardFront({ c, show, small }) {
  return (
    <div style={{ position: 'absolute', inset: 0, borderRadius: 22, padding: '14px 18px', color: '#fff', background: `linear-gradient(135deg, ${c.a}, ${c.b})`, boxShadow: '0 12px 26px rgba(40,30,20,.28)', overflow: 'hidden', backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(115deg, rgba(255,255,255,.07) 0 2px, transparent 2px 14px)' }} />
      <div style={{ position: 'absolute', right: -50, bottom: -70, width: 190, height: 190, borderRadius: '50%', background: 'rgba(255,255,255,.12)' }} />
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 26 }}>
        <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: '.01em' }}>{c.nick || BRANDS[c.brand].name}</span>
        <BrandMark brand={c.brand} size={0.8} />
      </div>
      {!small && (
        <>
          <div style={{ position: 'absolute', left: 18, top: 62, display: 'flex', alignItems: 'center', gap: 12 }}>
            <Chip size={0.9} />
            <Icon name="wave" size={22} color="rgba(255,255,255,.85)" />
          </div>
          <div style={{ position: 'absolute', left: 18, right: 18, bottom: 46, fontSize: 19, letterSpacing: '.07em', fontWeight: 600, fontVariantNumeric: 'tabular-nums', textShadow: '0 1px 2px rgba(0,0,0,.25)', whiteSpace: 'nowrap' }}>{maskedNumber(c, show)}</div>
          <div style={{ position: 'absolute', left: 18, right: 18, bottom: 16, display: 'flex', justifyContent: 'space-between', fontSize: 11.500, fontWeight: 600, letterSpacing: '.06em', opacity: 0.92 }}>
            <span>{c.holder || 'YOUR NAME'}</span>
            <span>{c.exp || 'MM/YY'}</span>
          </div>
        </>
      )}
      {c.frozen && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(210,230,255,.55)', backdropFilter: 'blur(2px)', display: 'grid', placeItems: 'center', color: '#0c4a6e' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 16, background: 'rgba(255,255,255,.9)', fontSize: 12.500, fontWeight: 800 }}>
            <Icon name="snow" size={15} /> Frozen
          </span>
        </div>
      )}
    </div>
  )
}

function CardBack({ c, show }) {
  return (
    <div style={{ position: 'absolute', inset: 0, borderRadius: 22, color: '#fff', background: `linear-gradient(135deg, ${c.b}, ${c.a})`, boxShadow: '0 12px 26px rgba(40,30,20,.28)', overflow: 'hidden', transform: 'rotateY(180deg)', backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 24, height: 42, background: 'linear-gradient(#0b0b0d,#232327 50%,#0b0b0d)' }} aria-label="Magnetic strip" />
      <div style={{ position: 'absolute', left: 18, right: 18, top: 84, height: 36, display: 'flex' }}>
        <div style={{ flex: 1, background: 'repeating-linear-gradient(-45deg,#f8f5ee 0 6px,#e8e3d6 6px 12px)', borderRadius: '4px 0 0 4px', display: 'flex', alignItems: 'center', paddingLeft: 8, fontFamily: 'cursive', fontSize: 14, color: '#555' }}>{(c.holder || '').toLowerCase()}</div>
        <div style={{ width: 62, background: '#fff', borderRadius: '0 4px 4px 0', display: 'grid', placeItems: 'center', color: '#111', fontWeight: 800, fontStyle: 'italic', fontSize: 16, letterSpacing: '.1em' }}>{show ? c.cvv || '' : '•'.repeat(c.cvv ? c.cvv.length : BRANDS[c.brand].cvv)}</div>
      </div>
      <div style={{ position: 'absolute', left: 18, right: 18, bottom: 16, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 9.500, lineHeight: 1.4, opacity: 0.85, maxWidth: 190 }}>This card is issued under licence. Lost or stolen? Freeze it in the app or call 1-800-555-0148.</span>
        <BrandMark brand={c.brand} size={0.8} />
      </div>
    </div>
  )
}

function FlipCard({ c, flipped, show, onClick, height = 200, small }) {
  return (
    <div onClick={onClick} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined} aria-label={onClick ? 'Flip card' : undefined} onKeyDown={(e) => onClick && (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onClick())} style={{ position: 'relative', height, perspective: 1100, cursor: onClick ? 'pointer' : 'default' }}>
      <div style={{ position: 'absolute', inset: 0, transformStyle: 'preserve-3d', transition: 'transform .7s cubic-bezier(.3,.8,.3,1)', transform: `rotateY(${flipped ? 180 : 0}deg)` }}>
        <CardFront c={c} show={show} small={small} />
        <CardBack c={c} show={show} />
      </div>
    </div>
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
  ['wallet', 'wallet', 'Wallet'],
  ['transactions', 'list', 'Activity'],
  ['add', 'plus', 'Add'],
  ['settings', 'gear', 'Settings'],
]

const FAN_STEP = 98
const STACK_STEP = 30
const CARD_H = 200

// ---------------------------------------------------------------- app

export default function WalletApp({ name = 'Alex Rivera', accent = '#f0643a', startScreen = 'wallet', frame = true, style }) {
  const box = useRef()
  const toastTimer = useRef()
  const idN = useRef(100)
  const [scale, setScale] = useState(1)
  const [cards, setCards] = useState(CARDS0)
  const [order, setOrder] = useState(['c3', 'c2', 'c1']) // back to front
  const [fan, setFan] = useState(false)
  const [txns, setTxns] = useState(TXNS0)
  const [tab, setTab] = useState('wallet')
  const [stack, setStack] = useState([])
  const [dir, setDir] = useState(1)
  const [toast, setToast] = useState('')
  const [flip, setFlip] = useState(false)
  const [show, setShow] = useState(false)
  const [shake, setShake] = useState('')
  const [payN, setPayN] = useState(0)
  const [cur, setCur] = useState('USD')
  const [prefs, setPrefs] = useState({ faceId: true, notify: true, roundUp: false })
  const [devices, setDevices] = useState(['iPhone 15 · this device', 'iPad Air · Lisbon', 'Apple Watch'])
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [barSel, setBarSel] = useState(null)
  const [confirmDel, setConfirmDel] = useState(false)
  const [form, setForm] = useState({ num: '', name: '', exp: '', cvv: '' })
  const [backFocus, setBackFocus] = useState(false)

  const front = order[order.length - 1]
  const frontCard = cards.find((c) => c.id === front)

  // startScreen jumps to any of the five pages.
  useEffect(() => {
    setFan(false)
    setFlip(false)
    setShow(false)
    if (startScreen === 'detail') {
      setTab('wallet')
      setStack([{ id: 'detail', card: 'c1' }])
    } else if (startScreen === 'add') {
      setTab('wallet')
      setStack([{ id: 'add' }])
    } else {
      setTab(startScreen === 'transactions' || startScreen === 'settings' ? startScreen : 'wallet')
      setStack([])
    }
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

  const shakeTimer = useRef()
  useEffect(() => () => (clearTimeout(toastTimer.current), clearTimeout(shakeTimer.current)), [])

  const say = (t) => {
    setToast(t)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 2100)
  }

  const [sym, rate] = CURRENCIES[cur]
  const fmt = (n, sign) => {
    const v = Math.abs(n * rate)
    const s = v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    return `${n < 0 ? '−' : sign && n > 0 ? '+' : ''}${sym}${s}`
  }

  const top = stack[stack.length - 1]
  const push = (s) => (setDir(1), setStack((a) => [...a, s]))
  const pop = () => (setDir(-1), setStack((a) => a.slice(0, -1)))
  const go = (t) => (setDir(NAV.findIndex((n) => n[0] === t) > NAV.findIndex((n) => n[0] === tab) ? 1 : -1), setTab(t), setStack([]))

  const patch = (id, p) => setCards((a) => a.map((c) => (c.id === id ? { ...c, ...p } : c)))
  const used = (id) => txns.filter((t) => t.card === id && t.amt < 0).reduce((s, t) => s - t.amt, 0)
  const bringFront = (id) => setOrder((o) => [...o.filter((x) => x !== id), id])
  const cardLabel = (id) => {
    const c = cards.find((x) => x.id === id)
    return c ? `${c.nick} ••${c.num.slice(-4)}` : 'Removed card'
  }

  const openDetail = (id) => {
    setFlip(false)
    setShow(false)
    setConfirmDel(false)
    push({ id: 'detail', card: id })
  }

  const onStackTap = (id) => {
    if (!fan) return setFan(true)
    if (id === front) return openDetail(id)
    bringFront(id)
    setFan(false)
    say(`${cardLabel(id)} is now on top`)
  }

  const pay = () => {
    const c = frontCard
    if (!c) return say('Add a card first')
    const [m, cat, icon, base] = MERCHANTS[payN % MERCHANTS.length]
    const amt = base
    setPayN((n) => n + 1)
    const decline = (msg) => {
      setShake(c.id)
      clearTimeout(shakeTimer.current)
      shakeTimer.current = setTimeout(() => setShake(''), 500)
      say(msg)
    }
    if (c.frozen) return decline('Declined: card is frozen')
    if (!c.tap) return decline('Declined: tap to pay is off for this card')
    if (used(c.id) + amt > c.limit) return decline('Declined: monthly limit reached')
    const t = { id: `t${++idN.current}`, card: c.id, name: m, cat, amt: -amt, day: 0, time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }), icon }
    setTxns((a) => [t, ...a])
    say(`Paid ${fmt(amt)} at ${m}`)
  }

  const resetForm = () => (setForm({ num: '', name: '', exp: '', cvv: '' }), setBackFocus(false))

  // ---- shared bits
  const header = (title, back, right) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px 6px', minHeight: 50 }}>
      {back && (
        <button type="button" onClick={back} aria-label="Back" style={{ ...iconBtn, width: 38, height: 38, background: '#fff' }}>
          <Icon name="back" size={20} />
        </button>
      )}
      <h1 style={{ margin: 0, flex: 1, fontSize: back ? 18 : 28, fontWeight: 800, letterSpacing: '-0.02em', marginLeft: 4 }}>{title}</h1>
      {right}
    </div>
  )

  const primary = (label, onClick, disabled) => (
    <button type="button" disabled={disabled} onClick={onClick} style={{ width: '100%', height: 52, borderRadius: 26, border: 'none', background: disabled ? '#d6cfc4' : accent, color: '#fff', font: 'inherit', fontSize: 15, fontWeight: 700, cursor: disabled ? 'default' : 'pointer' }}>
      {label}
    </button>
  )

  const ghost = (label, onClick, color = INK) => (
    <button type="button" onClick={onClick} style={{ height: 46, borderRadius: 23, border: 'none', background: '#e9e2d6', font: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer', color }}>{label}</button>
  )

  const toggle = (on, set, label) => (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => set(!on)} style={{ width: 48, height: 28, borderRadius: 14, border: 'none', padding: 3, background: on ? accent : '#d6cfc4', cursor: 'pointer', transition: 'background .2s', flex: 'none' }}>
      <span style={{ display: 'block', width: 22, height: 22, borderRadius: '50%', background: '#fff', transform: `translateX(${on ? 20 : 0}px)`, transition: 'transform .2s' }} />
    </button>
  )

  const setRow = (icon, label, right, last) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '13px 0', borderBottom: last ? 'none' : `1px solid ${LINE}` }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, fontWeight: 600 }}>
        <span style={{ width: 32, height: 32, borderRadius: 10, display: 'grid', placeItems: 'center', background: `${accent}1f`, color: accent }}><Icon name={icon} size={18} /></span>
        {label}
      </span>
      {right}
    </div>
  )

  const card$ = { margin: '0 20px', padding: '2px 16px', background: '#fff', borderRadius: 22 }

  const txnRow = (t, showCard) => (
    <button key={t.id} type="button" onClick={() => push({ id: 'txn', txn: t.id })} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '11px 14px', border: 'none', borderRadius: 18, background: '#fff', font: 'inherit', textAlign: 'left', cursor: 'pointer', color: INK }}>
      <span style={{ width: 40, height: 40, borderRadius: 14, display: 'grid', placeItems: 'center', background: t.amt > 0 ? '#dcfce7' : '#f3ece0', color: t.amt > 0 ? '#15803d' : INK, flex: 'none' }}>
        <Icon name={t.icon} size={19} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 14.500, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}{t.disputed ? ' · disputed' : ''}</span>
        <span style={{ display: 'block', fontSize: 12, color: MUTED, marginTop: 2 }}>{t.cat} · {t.time}{showCard ? ` · ${cardLabel(t.card)}` : ''}</span>
      </span>
      <span style={{ fontSize: 14.500, fontWeight: 700, color: t.amt > 0 ? '#15803d' : INK }}>{fmt(t.amt, true)}</span>
    </button>
  )

  // ---- screens
  let body
  let tabbed = true

  if (top?.id === 'detail') {
    tabbed = false
    const c = cards.find((x) => x.id === top.card)
    if (!c) {
      body = <>{header('Card', pop)}<div style={{ padding: 30, textAlign: 'center', color: MUTED }}>This card was removed.</div></>
    } else {
      const u = used(c.id)
      const pct = Math.min(100, (u / c.limit) * 100)
      body = (
        <>
          {header(`${c.nick} ••${c.num.slice(-4)}`, pop)}
          <div style={{ padding: '10px 20px 0' }}>
            <FlipCard c={c} flipped={flip} show={show} onClick={() => setFlip((f) => !f)} />
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
              <button type="button" onClick={() => setFlip((f) => !f)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 34, padding: '0 14px', borderRadius: 17, border: 'none', background: '#fff', font: 'inherit', fontSize: 12.500, fontWeight: 700, color: INK, cursor: 'pointer' }}>
                <Icon name="flip" size={16} color={accent} /> {flip ? 'Show front' : 'Show back · CVV'}
              </button>
            </div>
          </div>
          <div style={{ ...card$, marginTop: 16 }}>
            {setRow('snow', 'Freeze card', toggle(c.frozen, (v) => (patch(c.id, { frozen: v }), say(v ? 'Card frozen' : 'Card active')), 'Freeze card'))}
            {setRow('eye', 'Reveal number & CVV', toggle(show, setShow, 'Reveal number and CVV'))}
            {setRow('globe', 'Online payments', toggle(c.online, (v) => (patch(c.id, { online: v }), say(v ? 'Online payments on' : 'Online payments off')), 'Online payments'))}
            {setRow('wave', 'Tap to pay', toggle(c.tap, (v) => (patch(c.id, { tap: v }), say(v ? 'Tap to pay on' : 'Tap to pay off')), 'Tap to pay'), true)}
          </div>
          <div style={{ ...card$, marginTop: 12, padding: '14px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 700 }}>
              <span>Monthly limit</span>
              <span>{fmt(c.limit).replace(/\.00$/, '')}</span>
            </div>
            <input type="range" min="200" max="10000" step="100" value={c.limit} onChange={(e) => patch(c.id, { limit: +e.target.value })} aria-label="Monthly limit" style={{ width: '100%', marginTop: 10, accentColor: accent }} />
            <div style={{ height: 8, borderRadius: 4, background: '#efe8dc', overflow: 'hidden', marginTop: 4 }}>
              <div style={{ width: `${pct}%`, height: '100%', background: pct > 90 ? '#dc2626' : accent, transition: 'width .3s' }} />
            </div>
            <div style={{ fontSize: 12, color: MUTED, marginTop: 6 }}>{fmt(u)} spent · {fmt(Math.max(0, c.limit - u))} left</div>
          </div>
          <div style={{ padding: '16px 20px 6px', fontSize: 15, fontWeight: 800 }}>On this card</div>
          <div style={{ display: 'grid', gap: 8, padding: '0 20px' }}>
            {txns.filter((t) => t.card === c.id).slice(0, 4).map((t) => txnRow(t))}
            {!txns.some((t) => t.card === c.id) && <div style={{ color: MUTED, fontSize: 13, textAlign: 'center', padding: 14 }}>No transactions yet.</div>}
          </div>
          <div style={{ padding: '16px 20px', display: 'grid', gap: 10 }}>
            {ghost('Make default (bring to front)', () => (bringFront(c.id), say(`${c.nick} is now your default`)))}
            {ghost(confirmDel ? 'Tap again to remove card' : 'Remove card', () => {
              if (!confirmDel) return setConfirmDel(true)
              setCards((a) => a.filter((x) => x.id !== c.id))
              setOrder((o) => o.filter((x) => x !== c.id))
              setConfirmDel(false)
              pop()
              say('Card removed')
            }, '#dc2626')}
          </div>
        </>
      )
    }
  } else if (top?.id === 'add') {
    tabbed = false
    const brand = detectBrand(form.num)
    const len = maxLen(brand)
    const full = form.num.length === len
    const lOk = full && luhn(form.num)
    const eOk = expValid(form.exp)
    const cvOk = form.cvv.length === BRANDS[brand].cvv
    const nOk = form.name.trim().length >= 2
    const ok = lOk && eOk && cvOk && nOk
    const preview = { brand, nick: brand === 'unknown' ? 'New card' : BRANDS[brand].name, holder: form.name.trim().toUpperCase(), num: form.num, exp: form.exp, cvv: form.cvv, a: BRANDS[brand].a, b: BRANDS[brand].b }
    const inp = { width: '100%', boxSizing: 'border-box', height: 48, borderRadius: 14, border: `1.5px solid ${LINE}`, background: '#fff', padding: '0 14px', font: 'inherit', fontSize: 16, color: INK, fontVariantNumeric: 'tabular-nums' }
    const lab = { display: 'block', fontSize: 12, fontWeight: 700, color: MUTED, margin: '0 0 6px 2px' }
    const missing = !full ? 'Enter the full card number' : !lOk ? 'That number fails the check digit' : !nOk ? 'Enter the name on the card' : !eOk ? 'Enter a valid expiry' : !cvOk ? `Enter the ${BRANDS[brand].cvv}-digit code` : ''
    body = (
      <>
        {header('Add card', () => (resetForm(), pop()))}
        <div style={{ padding: '8px 20px 0' }}>
          <FlipCard c={preview} flipped={backFocus} show />
        </div>
        <div style={{ padding: '16px 20px 0', display: 'grid', gap: 12 }}>
          <div>
            <label style={lab} htmlFor="wl-num">Card number {brand !== 'unknown' && <span style={{ color: accent }}>· {BRANDS[brand].name}</span>}</label>
            <input id="wl-num" inputMode="numeric" autoComplete="off" placeholder={brand === 'amex' ? '3782 822463 10005' : '1234 5678 9012 3456'} value={groupBy(form.num, brand)} onFocus={() => setBackFocus(false)} onChange={(e) => {
              const d = e.target.value.replace(/\D/g, '')
              setForm((f) => ({ ...f, num: d.slice(0, maxLen(detectBrand(d))), cvv: f.cvv.slice(0, BRANDS[detectBrand(d)].cvv) }))
            }} style={{ ...inp, borderColor: full && !lOk ? '#dc2626' : lOk ? '#16a34a' : LINE }} />
          </div>
          <div>
            <label style={lab} htmlFor="wl-name">Name on card</label>
            <input id="wl-name" autoComplete="off" placeholder="Alex Rivera" value={form.name} onFocus={() => setBackFocus(false)} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value.replace(/[^a-zA-Z .'-]/g, '').slice(0, 24) }))} style={inp} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={lab} htmlFor="wl-exp">Expiry</label>
              <input id="wl-exp" inputMode="numeric" autoComplete="off" placeholder="MM/YY" value={form.exp} onFocus={() => setBackFocus(false)} onChange={(e) => {
                let d = e.target.value.replace(/\D/g, '').slice(0, 4)
                if (d.length === 1 && +d > 1) d = `0${d}`
                setForm((f) => ({ ...f, exp: d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d }))
              }} style={{ ...inp, borderColor: form.exp.length === 5 && !eOk ? '#dc2626' : LINE }} />
            </div>
            <div>
              <label style={lab} htmlFor="wl-cvv">{brand === 'amex' ? 'CID (4 digits)' : 'CVV'}</label>
              <input id="wl-cvv" inputMode="numeric" autoComplete="off" placeholder={brand === 'amex' ? '1234' : '123'} value={form.cvv} onFocus={() => setBackFocus(true)} onBlur={() => setBackFocus(false)} onChange={(e) => setForm((f) => ({ ...f, cvv: e.target.value.replace(/\D/g, '').slice(0, BRANDS[brand].cvv) }))} style={inp} />
            </div>
          </div>
          <div style={{ minHeight: 18, fontSize: 12.500, color: ok ? '#15803d' : MUTED, textAlign: 'center' }}>{ok ? 'Looks good. Ready to add.' : missing}</div>
          {primary('Add card', () => {
            const id = `c${++idN.current}`
            const nc = { id, brand, nick: BRANDS[brand].name, holder: preview.holder, num: form.num, exp: form.exp, cvv: form.cvv, a: BRANDS[brand].a, b: BRANDS[brand].b, limit: 2000, frozen: false, online: true, tap: true }
            setCards((a) => [...a, nc])
            setOrder((o) => [...o, id])
            resetForm()
            setFan(false)
            setDir(-1)
            setTab('wallet')
            setStack([])
            say(`${BRANDS[brand].name} ••${form.num.slice(-4)} added`)
          }, !ok)}
          <button type="button" onClick={() => setForm({ num: '4242424242424242', name: 'Alex Rivera', exp: '12/30', cvv: '123' })} style={{ height: 40, border: 'none', background: 'none', font: 'inherit', fontSize: 13.500, fontWeight: 700, color: accent, cursor: 'pointer' }}>Fill with a test card</button>
        </div>
      </>
    )
  } else if (top?.id === 'txn') {
    tabbed = false
    const t = txns.find((x) => x.id === top.txn)
    body = (
      <>
        {header('Transaction', pop)}
        <div style={{ padding: '14px 20px', textAlign: 'center' }}>
          <span style={{ width: 64, height: 64, borderRadius: 22, display: 'inline-grid', placeItems: 'center', background: t.amt > 0 ? '#dcfce7' : '#f3ece0', color: t.amt > 0 ? '#15803d' : accent }}>
            <Icon name={t.icon} size={30} />
          </span>
          <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-0.03em', marginTop: 12 }}>{fmt(t.amt, true)}</div>
          <div style={{ fontSize: 14, color: MUTED, marginTop: 4 }}>{t.name}</div>
        </div>
        <div style={card$}>
          {[['Category', t.cat], ['Date', `${dayLabel(t.day)}, ${t.time}`], ['Card', cardLabel(t.card)], ['Status', t.disputed ? 'Under review' : 'Completed'], ['Reference', `#${t.id.replace(/\D/g, '').padStart(6, '0')}`]].map(([k, v], i, a) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '13px 0', borderBottom: i < a.length - 1 ? `1px solid ${LINE}` : 'none', fontSize: 14 }}>
              <span style={{ color: MUTED }}>{k}</span>
              <span style={{ fontWeight: 600 }}>{v}</span>
            </div>
          ))}
        </div>
        <div style={{ padding: '16px 20px', display: 'grid', gap: 10 }}>
          {ghost('Save receipt', () => say('Receipt saved to your files'))}
          {t.disputed ? ghost('Dispute opened', () => say('We are reviewing this charge')) : ghost('Report a problem', () => (setTxns((a) => a.map((x) => (x.id === t.id ? { ...x, disputed: true } : x))), say('Dispute opened, we will email you')), '#dc2626')}
        </div>
      </>
    )
  } else if (top?.id === 'security') {
    tabbed = false
    body = (
      <>
        {header('Security', pop)}
        <div style={{ ...card$, marginTop: 8 }}>
          {setRow('user', 'Face ID to pay', toggle(prefs.faceId, (v) => setPrefs((p) => ({ ...p, faceId: v })), 'Face ID'), true)}
        </div>
        <div style={{ padding: '18px 20px 8px', fontSize: 15, fontWeight: 800 }}>Signed-in devices</div>
        <div style={{ ...card$ }}>
          {devices.map((d, i) => (
            <div key={d} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: i < devices.length - 1 ? `1px solid ${LINE}` : 'none', fontSize: 14, fontWeight: 600 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Icon name="phone" size={18} color={accent} />{d}</span>
              {i > 0 && <button type="button" onClick={() => (setDevices((a) => a.filter((x) => x !== d)), say('Device signed out'))} style={{ border: 'none', background: 'none', color: '#dc2626', font: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Sign out</button>}
            </div>
          ))}
        </div>
        <div style={{ padding: '16px 20px' }}>{primary('Change PIN', () => say('PIN change link sent'))}</div>
      </>
    )
  } else if (top?.id === 'default') {
    tabbed = false
    body = (
      <>
        {header('Default card', pop)}
        <div style={{ display: 'grid', gap: 8, padding: '8px 20px' }}>
          {[...order].reverse().map((id) => {
            const c = cards.find((x) => x.id === id)
            return (
              <button key={id} type="button" onClick={() => (bringFront(id), say(`${c.nick} is now your default`))} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', border: `2px solid ${id === front ? accent : 'transparent'}`, borderRadius: 18, background: '#fff', font: 'inherit', textAlign: 'left', cursor: 'pointer', color: INK }}>
                <span style={{ width: 46, height: 30, borderRadius: 7, background: `linear-gradient(135deg, ${c.a}, ${c.b})`, flex: 'none' }} />
                <span style={{ flex: 1, fontSize: 14.500, fontWeight: 700 }}>{c.nick} <span style={{ color: MUTED, fontWeight: 500 }}>••{c.num.slice(-4)}</span></span>
                {id === front && <Icon name="check" size={20} color={accent} />}
              </button>
            )
          })}
        </div>
      </>
    )
  } else if (tab === 'wallet') {
    const n = order.length
    const step = fan ? FAN_STEP : STACK_STEP
    const stackH = n ? CARD_H + (n - 1) * step : 120
    const avail = cards.filter((c) => !c.frozen).reduce((s, c) => s + Math.max(0, c.limit - used(c.id)), 0)
    body = (
      <>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 20px 0' }}>
          <div>
            <div style={{ fontSize: 13, color: MUTED }}>Available to spend</div>
            <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.03em' }}>{fmt(avail)}</div>
          </div>
          <button type="button" onClick={() => go('settings')} aria-label="Open settings" style={{ ...iconBtn, width: 44, height: 44, background: accent, color: '#fff', fontWeight: 800, fontSize: 15 }}>{name.split(' ').map((s) => s[0]).join('').slice(0, 2)}</button>
        </div>
        <div style={{ padding: '14px 20px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12.500, color: MUTED }}>{fan ? 'Tap a card to bring it forward' : `${n} card${n === 1 ? '' : 's'} · tap to fan out`}</span>
          {fan && <button type="button" onClick={() => setFan(false)} style={{ border: 'none', background: 'none', color: accent, font: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Stack</button>}
        </div>
        {n === 0 ? (
          <div style={{ margin: '10px 20px', padding: 30, borderRadius: 22, border: `2px dashed ${accent}88`, textAlign: 'center', color: MUTED }}>
            No cards yet.
            <div style={{ marginTop: 14 }}>{primary('Add a card', () => push({ id: 'add' }))}</div>
          </div>
        ) : (
          <div style={{ position: 'relative', margin: '0 20px', height: stackH, transition: 'height .45s cubic-bezier(.3,.8,.3,1)' }}>
            {order.map((id, i) => {
              const c = cards.find((x) => x.id === id)
              const depth = n - 1 - i
              const sc = fan ? 1 : 1 - Math.min(depth, 4) * 0.035
              const isFront = i === n - 1
              return (
                <div key={id} role="button" tabIndex={0} aria-label={`${c.nick} card ending ${c.num.slice(-4)}${isFront ? ', front card' : ''}`} onClick={() => onStackTap(id)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onStackTap(id))} style={{ position: 'absolute', left: 0, right: 0, top: 0, height: CARD_H, zIndex: i, cursor: 'pointer', transform: `translateY(${i * step}px) scale(${sc})`, transformOrigin: '50% 0', transition: 'transform .5s cubic-bezier(.3,.8,.3,1)', animation: shake === id ? 'wl-shake .45s' : 'none' }}>
                  <div style={{ position: 'absolute', inset: 0 }}>
                    <CardFront c={c} show={false} small={!fan && !isFront} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
        {frontCard && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-around', padding: '20px 20px 4px' }}>
              {[['wave', 'Tap to pay', pay], ['snow', frontCard.frozen ? 'Unfreeze' : 'Freeze', () => (patch(frontCard.id, { frozen: !frontCard.frozen }), say(frontCard.frozen ? 'Card active' : 'Card frozen'))], ['eye', 'Details', () => openDetail(frontCard.id)], ['plus', 'Add card', () => push({ id: 'add' })]].map(([ic, l, fn]) => (
                <button key={l} type="button" onClick={fn} style={{ border: 'none', background: 'none', font: 'inherit', cursor: 'pointer', color: INK, display: 'grid', justifyItems: 'center', gap: 6, fontSize: 12, fontWeight: 600 }}>
                  <span style={{ width: 54, height: 54, borderRadius: 18, display: 'grid', placeItems: 'center', background: '#fff', color: accent }}><Icon name={ic} size={22} /></span>
                  {l}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '14px 20px 10px' }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Recent on {frontCard.nick}</h2>
              <button type="button" onClick={() => go('transactions')} style={{ border: 'none', background: 'none', padding: 0, font: 'inherit', fontSize: 13, color: accent, fontWeight: 700, cursor: 'pointer' }}>See all</button>
            </div>
            <div style={{ display: 'grid', gap: 8, padding: '0 20px' }}>{txns.filter((t) => t.card === front).slice(0, 3).map((t) => txnRow(t))}</div>
          </>
        )}
      </>
    )
  } else if (tab === 'transactions') {
    const q = query.trim().toLowerCase()
    const list = txns.filter((t) => (filter === 'all' || t.card === filter) && (!q || `${t.name} ${t.cat}`.toLowerCase().includes(q)))
    const days = [...new Set(list.map((t) => t.day))].sort((a, b) => a - b)
    const week = Array.from({ length: 7 }, (_, i) => 6 - i).map((d) => ({ d, v: list.filter((t) => t.day === d && t.amt < 0).reduce((s, t) => s - t.amt, 0) }))
    const mx = Math.max(1, ...week.map((x) => x.v))
    const total = list.filter((t) => t.amt < 0).reduce((s, t) => s - t.amt, 0)
    body = (
      <>
        {header('Activity')}
        <div style={{ margin: '4px 20px 0', padding: '14px 16px 10px', background: '#fff', borderRadius: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: 12.500, color: MUTED }}>{barSel !== null ? dayLabel(barSel) : 'Spent this week'}</span>
            <span style={{ fontSize: 20, fontWeight: 800 }}>{fmt(barSel !== null ? week.find((x) => x.d === barSel).v : total)}</span>
          </div>
          <svg viewBox="0 0 320 90" width="100%" style={{ display: 'block', marginTop: 8 }} role="img" aria-label="Spending by day">
            {week.map((x, i) => {
              const h = Math.max(4, (x.v / mx) * 62)
              return (
                <g key={x.d} onClick={() => setBarSel(barSel === x.d ? null : x.d)} style={{ cursor: 'pointer' }}>
                  <rect x={i * 46 + 2} y="0" width="38" height="72" fill="transparent" />
                  <rect x={i * 46 + 6} y={70 - h} width="30" height={h} rx="8" fill={barSel === x.d || barSel === null ? accent : `${accent}44`} style={{ transition: 'all .3s' }} />
                  <text x={i * 46 + 21} y="86" fontSize="10" textAnchor="middle" fill={MUTED}>{x.d === 0 ? 'Today' : new Date(Date.now() - x.d * 864e5).toLocaleDateString('en-US', { weekday: 'short' })}</text>
                </g>
              )
            })}
          </svg>
        </div>
        <div style={{ padding: '12px 20px 0' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, height: 42, padding: '0 14px', borderRadius: 21, background: '#fff', color: MUTED }}>
            <Icon name="search" size={18} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search transactions" aria-label="Search transactions" style={{ flex: 1, border: 'none', outline: 'none', background: 'none', font: 'inherit', fontSize: 14, color: INK, minWidth: 0 }} />
            {query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search" style={{ ...iconBtn, width: 22, height: 22, color: MUTED }}><Icon name="x" size={16} /></button>}
          </label>
        </div>
        <div className="wl-scroll" style={{ display: 'flex', gap: 8, padding: '10px 20px', overflowX: 'auto' }} role="group" aria-label="Filter by card">
          {[['all', 'All cards'], ...cards.map((c) => [c.id, `${c.nick} ••${c.num.slice(-4)}`])].map(([id, l]) => (
            <button key={id} type="button" onClick={() => setFilter(id)} aria-pressed={filter === id} style={{ flex: 'none', height: 34, padding: '0 14px', borderRadius: 17, border: 'none', background: filter === id ? INK : '#fff', color: filter === id ? '#fff' : INK, font: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{l}</button>
          ))}
        </div>
        <div style={{ padding: '0 20px', display: 'grid', gap: 8 }}>
          {days.map((d) => (
            <div key={d} style={{ display: 'grid', gap: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: MUTED, margin: '8px 0 0', textTransform: 'uppercase', letterSpacing: '.06em' }}>{dayLabel(d)}</div>
              {list.filter((t) => t.day === d).map((t) => txnRow(t, true))}
            </div>
          ))}
          {!list.length && <div style={{ textAlign: 'center', color: MUTED, fontSize: 13, padding: '30px 0' }}>No transactions match.</div>}
        </div>
      </>
    )
  } else {
    body = (
      <>
        {header('Settings')}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '4px 20px 16px' }}>
          <span style={{ width: 62, height: 62, borderRadius: '50%', display: 'grid', placeItems: 'center', background: accent, color: '#fff', fontSize: 22, fontWeight: 800 }}>{name.split(' ').map((s) => s[0]).join('').slice(0, 2)}</span>
          <div>
            <div style={{ fontSize: 19, fontWeight: 800 }}>{name}</div>
            <div style={{ fontSize: 13, color: MUTED }}>{cards.length} card{cards.length === 1 ? '' : 's'} in wallet</div>
          </div>
        </div>
        <div style={card$}>
          {setRow('bell', 'Purchase alerts', toggle(prefs.notify, (v) => (setPrefs((p) => ({ ...p, notify: v })), say(v ? 'Alerts on' : 'Alerts off')), 'Purchase alerts'))}
          {setRow('coin', 'Round up purchases', toggle(prefs.roundUp, (v) => (setPrefs((p) => ({ ...p, roundUp: v })), say(v ? 'Rounding up to savings' : 'Round up off')), 'Round up'))}
          <button type="button" onClick={() => push({ id: 'default' })} style={{ display: 'block', width: '100%', padding: 0, border: 'none', background: 'none', font: 'inherit', cursor: 'pointer', color: INK, textAlign: 'left' }}>
            {setRow('wallet', 'Default card', <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: MUTED }}>{frontCard ? frontCard.nick : 'None'}<Icon name="chev" size={16} /></span>)}
          </button>
          <button type="button" onClick={() => push({ id: 'security' })} style={{ display: 'block', width: '100%', padding: 0, border: 'none', background: 'none', font: 'inherit', cursor: 'pointer', color: INK, textAlign: 'left' }}>
            {setRow('shield', 'Security', <Icon name="chev" size={16} color={MUTED} />, true)}
          </button>
        </div>
        <div style={{ ...card$, marginTop: 12, padding: '14px 16px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Currency</div>
          <div style={{ display: 'flex', gap: 8 }} role="group" aria-label="Currency">
            {Object.keys(CURRENCIES).map((k) => (
              <button key={k} type="button" aria-pressed={cur === k} onClick={() => (setCur(k), say(`Showing amounts in ${k}`))} style={{ flex: 1, height: 38, borderRadius: 19, border: 'none', background: cur === k ? accent : '#f3ece0', color: cur === k ? '#fff' : INK, font: 'inherit', fontSize: 13.500, fontWeight: 700, cursor: 'pointer' }}>{CURRENCIES[k][0]} {k}</button>
            ))}
          </div>
        </div>
        <div style={{ padding: '16px 20px', display: 'grid', gap: 10 }}>
          {ghost('Reset demo', () => (setCards(CARDS0), setOrder(['c3', 'c2', 'c1']), setTxns(TXNS0), setCur('USD'), setFan(false), setDevices(['iPhone 15 · this device', 'iPad Air · Lisbon', 'Apple Watch']), say('Demo reset')))}
          {ghost('Sign out', () => say('Signed out (demo)'), '#dc2626')}
        </div>
      </>
    )
  }

  const phone = (
    <div style={{ position: 'relative', width: W, height: H, overflow: 'hidden', borderRadius: frame ? 46 : 0, background: BG, color: INK, fontFamily: FONT }}>
      <style>{`
        @keyframes wl-r { from { opacity: 0; transform: translateX(34px) } to { opacity: 1; transform: none } }
        @keyframes wl-l { from { opacity: 0; transform: translateX(-34px) } to { opacity: 1; transform: none } }
        @keyframes wl-shake { 0%,100% { margin-left: 0 } 20% { margin-left: -9px } 40% { margin-left: 9px } 60% { margin-left: -6px } 80% { margin-left: 5px } }
        .wl-scroll { scrollbar-width: none } .wl-scroll::-webkit-scrollbar { display: none }
        .wl-app button:focus-visible, .wl-app input:focus-visible, .wl-app [role=button]:focus-visible { outline: 2px solid ${accent}; outline-offset: 2px }
        .wl-app button:disabled { cursor: default }
        @media (prefers-reduced-motion: reduce) { .wl-app *, .wl-app *::before { animation: none !important; transition: none !important } }
      `}</style>
      <StatusBar frame={frame} />
      <div key={`${tab}/${stack.map((s) => s.id).join('/')}`} className="wl-scroll" style={{ position: 'absolute', top: 54, bottom: tabbed ? 88 : 0, left: 0, right: 0, overflowY: 'auto', overflowX: 'hidden', paddingBottom: 24, animation: `${dir > 0 ? 'wl-r' : 'wl-l'} .28s ease` }}>
        {body}
      </div>
      {tabbed && (
        <nav aria-label="Main" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 88, background: '#fff', borderRadius: '26px 26px 0 0', boxShadow: '0 -6px 20px rgba(60,40,20,.08)', display: 'flex', justifyContent: 'space-around', padding: '10px 8px 0' }}>
          {NAV.map(([id, icon, label]) =>
            id === 'add' ? (
              <button key={id} type="button" onClick={() => (resetForm(), push({ id: 'add' }))} aria-label="Add card" style={{ border: 'none', cursor: 'pointer', width: 54, height: 54, borderRadius: 20, marginTop: -2, background: accent, color: '#fff', display: 'grid', placeItems: 'center', boxShadow: `0 8px 18px ${accent}66` }}>
                <Icon name="plus" size={26} w={2.4} />
              </button>
            ) : (
              <button key={id} type="button" onClick={() => go(id)} aria-current={tab === id ? 'page' : undefined} style={{ border: 'none', background: 'none', font: 'inherit', cursor: 'pointer', display: 'grid', justifyItems: 'center', alignContent: 'start', gap: 3, width: 64, height: 54, fontSize: 11, fontWeight: 600, color: tab === id ? accent : MUTED }}>
                <Icon name={icon} size={23} />
                {label}
              </button>
            ),
          )}
        </nav>
      )}
      <div role="status" style={{ position: 'absolute', left: '50%', top: 58, zIndex: 30, transform: `translate(-50%, ${toast ? 0 : -90}px)`, transition: 'transform .35s cubic-bezier(.2,.8,.2,1)', padding: '10px 16px', borderRadius: 20, background: INK, color: '#fff', fontSize: 12.500, fontWeight: 600, whiteSpace: 'nowrap', maxWidth: 350, overflow: 'hidden', textOverflow: 'ellipsis' }}>{toast}</div>
      <div style={{ position: 'absolute', left: '50%', bottom: 8, width: 140, height: 5, marginLeft: -70, borderRadius: 3, background: INK, opacity: 0.8, zIndex: 25 }} />
    </div>
  )

  return (
    <div ref={box} className="wl-app" style={{ position: 'relative', width: '100%', height: '100%', display: 'grid', placeItems: 'center', overflow: 'hidden', background: 'radial-gradient(ellipse at 50% 30%, #efe6d8, #cdbfa8 78%)', ...style }}>
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: `translate(-50%, -50%) scale(${scale})`, transformOrigin: 'center' }}>
        {frame ? (
          <div style={{ padding: 12, borderRadius: 58, background: 'linear-gradient(145deg, #3a3f4a, #14171d 40%, #2b2f38)', boxShadow: '0 40px 80px rgba(40,30,20,.35), inset 0 0 0 2px #4b515e' }}>
            <div style={{ padding: 2, borderRadius: 48, background: '#000' }}>{phone}</div>
          </div>
        ) : (
          phone
        )}
      </div>
    </div>
  )
}
