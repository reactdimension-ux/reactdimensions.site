import { useEffect, useRef, useState } from 'react'

// A crypto portfolio on a phone, as a click-through prototype. Five pages:
// Portfolio, Coin detail, Buy, Activity and Settings. The coin chart is the
// showpiece: pinch it with two fingers (two-pointer pointer events), or zoom
// with the + / - buttons or the mouse wheel; with two fingers you also pan,
// and a pan slider appears once zoomed in. Hover or drag one finger and a
// crosshair reads out the price and time. Buy and Sell are a real flow
// (pick a coin, amount keypad, review, success) that updates your holdings,
// cash and the Activity list. Settings has a working accent picker, a blurred
// recovery phrase you tap to reveal, and a demo reset. The phone scales to fit
// whatever box it is in. Nothing here is real market data.

const W = 390 // the phone screen, in CSS px (an iPhone's width)
const H = 844
const INK = '#f1edff'
const MUTED = '#9a93bd'
const BG = '#0b0720'
const GLASS = 'rgba(255,255,255,.065)'
const GLASS2 = 'rgba(255,255,255,.11)'
const EDGE = 'rgba(255,255,255,.1)'
const UP = '#4ade80'
const DN = '#fb7185'
const FONT = "-apple-system, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif"
const SWATCHES = ['#8b5cf6', '#22d3ee', '#f97316', '#ec4899', '#4ade80']
const RANGES = ['1D', '1W', '1M', '1Y', 'ALL']
const RANGE_N = { '1D': 144, '1W': 168, '1M': 150, '1Y': 240, ALL: 240 }
const RANGE_MS = { '1D': 864e5, '1W': 7 * 864e5, '1M': 30 * 864e5, '1Y': 365 * 864e5, ALL: 1825 * 864e5 }
const RANGE_VOL = { '1D': 0.006, '1W': 0.012, '1M': 0.02, '1Y': 0.04, ALL: 0.065 }
const FEE = 0.008

const COINS = [
  { sym: 'BTC', name: 'Bitcoin', px: 67420, chg: 0.021, color: '#f7931a', glyph: '₿', vf: 1, cap: '1.33T', vol: '28.4B', supply: '19.7M', about: 'The original cryptocurrency: a fixed-supply digital asset secured by proof of work.' },
  { sym: 'ETH', name: 'Ethereum', px: 3540.2, chg: -0.014, color: '#7c8cf8', glyph: 'Ξ', vf: 1.2, cap: '425B', vol: '14.1B', supply: '120.2M', about: 'A programmable blockchain that runs smart contracts and most of decentralised finance.' },
  { sym: 'SOL', name: 'Solana', px: 172.35, chg: 0.048, color: '#14f195', glyph: 'S', vf: 1.8, cap: '80B', vol: '3.2B', supply: '464M', about: 'A high-throughput chain built for fast, cheap transactions.' },
  { sym: 'ADA', name: 'Cardano', px: 0.4621, chg: -0.006, color: '#38bdf8', glyph: 'A', vf: 1.7, cap: '16.4B', vol: '412M', supply: '35.6B', about: 'A proof-of-stake network developed through peer-reviewed research.' },
  { sym: 'DOGE', name: 'Dogecoin', px: 0.1624, chg: 0.093, color: '#e5b94a', glyph: 'Ð', vf: 2.3, cap: '23.7B', vol: '1.9B', supply: '146B', about: 'Started as a joke in 2013 and kept going. Popular for tipping and payments.' },
  { sym: 'XRP', name: 'XRP', px: 0.583, chg: 0.012, color: '#94a3b8', glyph: 'X', vf: 1.4, cap: '32.8B', vol: '1.1B', supply: '56.2B', about: 'A ledger built for quick, low-cost cross-border settlement.' },
  { sym: 'LINK', name: 'Chainlink', px: 14.82, chg: -0.027, color: '#3b82f6', glyph: 'L', vf: 1.6, cap: '9.3B', vol: '540M', supply: '626M', about: 'An oracle network that feeds real-world data to smart contracts.' },
]
const BY = Object.fromEntries(COINS.map((c) => [c.sym, c]))

const usd = (n, d) => {
  const dd = d ?? (Math.abs(n) < 1 ? 4 : 2)
  return `${n < 0 ? '−' : ''}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: dd, maximumFractionDigits: dd })}`
}
const qtyStr = (n) => (+n.toFixed(6)).toString()
const pct = (n) => `${n >= 0 ? '+' : '−'}${Math.abs(n * 100).toFixed(2)}%`

const hashStr = (s) => {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}
const rng = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
// A deterministic random walk, shaped so its last value is 1.
const walk = (key, n, vol) => {
  const r = rng(hashStr(key))
  const w = [0]
  for (let i = 1; i < n; i++) w.push(w[i - 1] + (r() + r() + r() - 1.5) * vol * 1.6)
  return w.map((v) => Math.exp(v - w[n - 1]))
}
const seriesFor = (sym, range) => walk(`${sym}/${range}`, RANGE_N[range], RANGE_VOL[range] * BY[sym].vf).map((v) => v * BY[sym].px)

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const stamp = (range, i, n) => {
  const ms = Date.now() - (1 - i / (n - 1)) * RANGE_MS[range]
  const d = new Date(ms)
  const step = RANGE_MS[range] / (n - 1)
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  if (step < 20 * 36e5) return range === '1D' ? hm : `${MON[d.getMonth()]} ${d.getDate()}, ${hm}`
  return `${MON[d.getMonth()]} ${d.getDate()}${range === '1Y' || range === 'ALL' ? `, ${d.getFullYear()}` : ''}`
}

const ICONS = {
  pie: 'M12 3a9 9 0 1 0 9 9h-9zM15 3.500A9 9 0 0 1 20.500 9H15z',
  swap: 'M4 8h14l-3-3M20 16H6l3 3',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2-1.2L14.2 3h-4l-.4 2.6a7 7 0 0 0-2 1.2l-2.3-.9-2 3.4 2 1.5a7 7 0 0 0 0 2.4l-2 1.5 2 3.4 2.3-.9a7 7 0 0 0 2 1.2l.4 2.6h4l.4-2.6a7 7 0 0 0 2-1.2l2.300.9 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z',
  back: 'M15 5l-7 7 7 7',
  chev: 'M9 5l7 7-7 7',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  eyeoff: 'M3 3l18 18M10.600 6.100A9.700 9.700 0 0 1 12 6c6 0 10 6 10 6a17 17 0 0 1-3.200 3.800M6.400 7.500C3.800 9.300 2 12 2 12s4 7 10 7c1.500 0 2.800-.4 4-1',
  bell: 'M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4',
  shield: 'M12 3l8 3v6c0 5-3.500 8-8 9-4.500-1-8-4-8-9V6z',
  check: 'M5 12l5 5 9-10',
  x: 'M6 6l12 12M18 6L6 18',
  down: 'M12 4v14m0 0l-5-5m5 5l5-5',
  up: 'M12 20V6m0 0l-5 5m5-5l5 5',
  bank: 'M3 10l9-6 9 6M5 10v8M9 10v8M15 10v8M19 10v8M3 20h18',
  gift: 'M4 11h16v9H4zM3 8h18v3H3zM12 8v12M12 8C9 8 8 4 10.500 4 12 4 12 8 12 8zm0 0c3 0 4-4 1.500-4C12 4 12 8 12 8z',
  full: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  copy: 'M9 9h10v11H9zM5 15V4h10',
  key: 'M8 14a4 4 0 1 1 3.800-5.200H21v3h-2v2h-3v-2h-4.200A4 4 0 0 1 8 14z',
}

function Icon({ name, size = 22, color = 'currentColor', w = 1.9 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  )
}

const iconBtn = { display: 'grid', placeItems: 'center', border: 'none', borderRadius: '50%', cursor: 'pointer', padding: 0, background: 'transparent', color: INK }
const glass = { background: GLASS, border: `1px solid ${EDGE}`, borderRadius: 22, backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)' }

function CoinIcon({ c, size = 42 }) {
  return (
    <span style={{ width: size, height: size, borderRadius: '50%', display: 'grid', placeItems: 'center', flex: 'none', background: `radial-gradient(circle at 30% 25%, ${c.color}, ${c.color}88 70%, #0000 71%), ${c.color}33`, boxShadow: `0 0 0 1.5px ${c.color}66, 0 6px 16px ${c.color}33`, color: '#0b0720', fontWeight: 900, fontSize: size * 0.46 }}>
      {c.glyph}
    </span>
  )
}

function Spark({ data, up, w = 70, h = 28 }) {
  const lo = Math.min(...data)
  const hi = Math.max(...data)
  const d = data.map((v, i) => `${i ? 'L' : 'M'}${((i / (data.length - 1)) * w).toFixed(1)} ${(h - 3 - ((v - lo) / (hi - lo || 1)) * (h - 6)).toFixed(1)}`).join('')
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" style={{ display: 'block', flex: 'none' }}>
      <path d={d} fill="none" stroke={up ? UP : DN} strokeWidth="1.700" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

// The zoomable chart. Owns the zoom window and all pointer state; remount it
// (change its key) to reset the zoom when the coin or range changes.
function ZoomChart({ series, range, accent, h = 210 }) {
  const n = series.length
  const [view, setView] = useState({ s: 0, e: n - 1 })
  const [hover, setHover] = useState(null)
  const wrap = useRef()
  const pts = useRef(new Map())
  const last = useRef(null) // { dist, mx }
  const MIN = 10
  const wd = 340

  const zoom = (factor, frac) =>
    setView((v) => {
      const len = v.e - v.s
      const nl = clamp(len / factor, MIN, n - 1)
      const anchor = v.s + len * frac
      const s = clamp(anchor - nl * frac, 0, n - 1 - nl)
      return { s, e: s + nl }
    })
  const pan = (dIdx) =>
    setView((v) => {
      const len = v.e - v.s
      const s = clamp(v.s + dIdx, 0, n - 1 - len)
      return { s, e: s + len }
    })

  // Wheel zoom needs a non-passive listener so the page does not scroll.
  useEffect(() => {
    const el = wrap.current
    const onWheel = (e) => {
      e.preventDefault()
      const r = el.getBoundingClientRect()
      zoom(Math.exp(-e.deltaY * 0.0018), clamp((e.clientX - r.left) / r.width, 0, 1))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n])

  const frac = (e) => {
    const r = wrap.current.getBoundingClientRect()
    return clamp((e.clientX - r.left) / r.width, 0, 1)
  }
  const info = () => {
    const [a, b] = [...pts.current.values()]
    return { dist: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2 }
  }
  const down = (e) => {
    wrap.current.setPointerCapture?.(e.pointerId)
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pts.current.size === 2) {
      last.current = info()
      setHover(null)
    } else setHover(Math.round(view.s + frac(e) * (view.e - view.s)))
  }
  const move = (e) => {
    if (pts.current.has(e.pointerId)) pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pts.current.size >= 2 && last.current) {
      const cur = info()
      const r = wrap.current.getBoundingClientRect()
      if (last.current.dist > 4 && cur.dist > 4) zoom(cur.dist / last.current.dist, clamp((cur.mx - r.left) / r.width, 0, 1))
      pan((-(cur.mx - last.current.mx) / r.width) * (view.e - view.s))
      last.current = cur
      return
    }
    setHover(Math.round(view.s + frac(e) * (view.e - view.s)))
  }
  const up = (e) => {
    pts.current.delete(e.pointerId)
    last.current = null
    if (e.pointerType !== 'mouse') setHover(null)
  }

  const len = view.e - view.s
  const i0 = Math.ceil(view.s)
  const i1 = Math.floor(view.e)
  const idx = []
  for (let i = i0; i <= i1; i++) idx.push(i)
  const vis = idx.map((i) => series[i])
  const lo = Math.min(...vis)
  const hi = Math.max(...vis)
  const padv = (hi - lo) * 0.14 || 1
  const x = (i) => ((i - view.s) / len) * wd
  const y = (v) => 10 + (1 - (v - lo + padv) / (hi - lo + padv * 2)) * (h - 20)
  const line = idx.map((i, k) => `${k ? 'L' : 'M'}${x(i).toFixed(1)} ${y(series[i]).toFixed(1)}`).join('')
  const first = series[i0]
  const endV = series[i1]
  const rising = endV >= first
  const col = rising ? UP : DN
  const hv = hover === null ? null : clamp(hover, i0, i1)
  const shownV = hv === null ? endV : series[hv]
  const gid = `cr-g-${rising ? 'u' : 'd'}`

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', minHeight: 40 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{usd(shownV)}</div>
          <div style={{ fontSize: 12, color: MUTED }}>{hv === null ? 'Latest' : stamp(range, hv, n)}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: rising ? UP : DN }}>{pct(shownV / first - 1)}</div>
          <div style={{ fontSize: 12, color: MUTED }}>in view</div>
        </div>
      </div>
      <div ref={wrap} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerLeave={(e) => e.pointerType === 'mouse' && setHover(null)} style={{ position: 'relative', touchAction: 'none', cursor: 'crosshair', userSelect: 'none', marginTop: 6 }} role="img" aria-label={`${range} price chart. Pinch, scroll or use the zoom buttons.`}>
        <svg viewBox={`0 0 ${wd} ${h}`} width="100%" style={{ display: 'block' }}>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={col} stopOpacity=".32" />
              <stop offset="1" stopColor={col} stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0.2, 0.4, 0.6, 0.8].map((f) => (
            <line key={f} x1="0" x2={wd} y1={h * f} y2={h * f} stroke="rgba(255,255,255,.07)" strokeDasharray="2 5" />
          ))}
          <path d={`${line}L${x(i1).toFixed(1)} ${h}L${x(i0).toFixed(1)} ${h}Z`} fill={`url(#${gid})`} />
          <path d={line} fill="none" stroke={col} strokeWidth="2.200" strokeLinejoin="round" strokeLinecap="round" />
          <text x="4" y="12" fontSize="9.500" fill={MUTED}>{usd(hi)}</text>
          <text x="4" y={h - 5} fontSize="9.500" fill={MUTED}>{usd(lo)}</text>
          {hv !== null && (
            <g pointerEvents="none">
              <line x1={x(hv)} x2={x(hv)} y1="0" y2={h} stroke={accent} strokeWidth="1" />
              <line x1="0" x2={wd} y1={y(series[hv])} y2={y(series[hv])} stroke={accent} strokeWidth="1" strokeDasharray="3 4" opacity=".6" />
              <circle cx={x(hv)} cy={y(series[hv])} r="5.500" fill={BG} stroke={col} strokeWidth="2.500" />
            </g>
          )}
        </svg>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
        {[['minus', 'Zoom out', () => zoom(1 / 1.6, 0.5)], ['plus', 'Zoom in', () => zoom(1.6, 0.5)], ['full', 'Reset zoom', () => setView({ s: 0, e: n - 1 })]].map(([ic, l, fn]) => (
          <button key={l} type="button" onClick={fn} aria-label={l} style={{ ...iconBtn, width: 34, height: 34, borderRadius: 11, background: GLASS2 }}>
            <Icon name={ic} size={17} />
          </button>
        ))}
        <span style={{ fontSize: 12.500, fontWeight: 800, color: accent, minWidth: 44, fontVariantNumeric: 'tabular-nums' }}>×{((n - 1) / len).toFixed(1)}</span>
        <input type="range" min="0" max={Math.max(0.001, n - 1 - len)} step="0.1" value={view.s} disabled={len >= n - 1 - 0.01} onChange={(e) => pan(+e.target.value - view.s)} aria-label="Pan chart" style={{ flex: 1, minWidth: 0, accentColor: accent, opacity: len >= n - 1 - 0.01 ? 0.3 : 1 }} />
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
  ['portfolio', 'pie', 'Portfolio'],
  ['buy', 'swap', 'Trade'],
  ['activity', 'list', 'Activity'],
  ['settings', 'gear', 'Settings'],
]

const ACT0 = [
  { id: 'x1', kind: 'buy', sym: 'ETH', qty: 0.5, usd: 1770.1, day: 'Today', time: '09:14' },
  { id: 'x2', kind: 'deposit', usd: 2000, day: 'Yesterday', time: '18:02' },
  { id: 'x3', kind: 'sell', sym: 'SOL', qty: 4, usd: 689.4, day: 'Yesterday', time: '11:30' },
  { id: 'x4', kind: 'reward', sym: 'SOL', qty: 0.012, usd: 2.07, day: 'Mon 10 Nov', time: '00:00' },
  { id: 'x5', kind: 'buy', sym: 'BTC', qty: 0.05, usd: 3371, day: 'Sun 9 Nov', time: '21:47' },
]
const HOLD0 = { BTC: 0.42, ETH: 3.1, SOL: 18, DOGE: 5200 }
const PHRASE = ['orbit', 'velvet', 'canyon', 'mirror', 'lantern', 'quartz', 'harbor', 'ember', 'tulip', 'glacier', 'noble', 'saddle']
const KIND = { buy: ['Bought', 'down', UP], sell: ['Sold', 'up', DN], deposit: ['Deposit', 'bank', '#60a5fa'], reward: ['Staking reward', 'gift', '#fbbf24'] }

// ---------------------------------------------------------------- app

export default function CryptoApp({ name = 'Alex', accent: accentProp = '#8b5cf6', startScreen = 'portfolio', frame = true, style }) {
  const box = useRef()
  const toastTimer = useRef()
  const idN = useRef(100)
  const [scale, setScale] = useState(1)
  const [accent, setAccent] = useState(accentProp)
  const [tab, setTab] = useState('portfolio')
  const [stack, setStack] = useState([])
  const [dir, setDir] = useState(1)
  const [toast, setToast] = useState('')
  const [hold, setHold] = useState(HOLD0)
  const [cash, setCash] = useState(2500)
  const [acts, setActs] = useState(ACT0)
  const [flow, setFlow] = useState({ sym: 'BTC', mode: 'buy', amt: '', pay: 'cash' })
  const [range, setRange] = useState('1M')
  const [prange, setPrange] = useState('1M')
  const [filter, setFilter] = useState('All')
  const [hide, setHide] = useState(false)
  const [prefs, setPrefs] = useState({ alerts: true, bio: true, twofa: true })
  const [reveal, setReveal] = useState(false)

  useEffect(() => setAccent(accentProp), [accentProp])

  useEffect(() => {
    setRange('1M')
    if (startScreen === 'detail') {
      setTab('portfolio')
      setStack([{ id: 'coin', sym: 'ETH' }])
    } else {
      setTab(NAV.some((n) => n[0] === startScreen) ? startScreen : 'portfolio')
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

  useEffect(() => () => clearTimeout(toastTimer.current), [])
  const say = (t) => {
    setToast(t)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 2100)
  }

  const top = stack[stack.length - 1]
  const push = (s) => (setDir(1), setStack((a) => [...a, s]))
  const pop = () => (setDir(-1), setStack((a) => a.slice(0, -1)))
  const go = (t) => (setDir(NAV.findIndex((n) => n[0] === t) > NAV.findIndex((n) => n[0] === tab) ? 1 : -1), setTab(t), setStack([]))
  const trade = (sym, mode) => (setFlow({ sym, mode, amt: '', pay: 'cash' }), go('buy'))

  const holdVal = (sym) => (hold[sym] || 0) * BY[sym].px
  const holdings = COINS.filter((c) => hold[c.sym] > 0)
  const assets = holdings.reduce((s, c) => s + holdVal(c.sym), 0)
  const total = assets + cash
  const day24 = holdings.reduce((s, c) => s + holdVal(c.sym) * (1 - 1 / (1 + c.chg)), 0)
  const mask = (s) => (hide ? '••••••' : s)

  // ---- trade flow
  const coin = BY[flow.sym]
  const amount = parseFloat(flow.amt) || 0
  const fee = amount * FEE
  const buyTotal = amount + fee
  const maxSell = holdVal(flow.sym)
  const payCash = flow.pay === 'cash'
  const flowErr =
    amount <= 0 ? '' : flow.mode === 'buy' ? (amount < 5 ? 'Minimum is $5' : payCash && buyTotal > cash ? `Cash balance is ${usd(cash)}` : '') : amount > maxSell + 0.005 ? `You hold ${usd(maxSell)} of ${flow.sym}` : ''
  const canGo = amount > 0 && !flowErr
  const getQty = flow.mode === 'buy' ? amount / coin.px : (amount - fee) / coin.px

  const tap = (k) =>
    setFlow((f) => {
      if (k === '⌫') return { ...f, amt: f.amt.slice(0, -1) }
      if (k === '.' && f.amt.includes('.')) return f
      if (f.amt.includes('.') && f.amt.split('.')[1].length >= 2) return f
      if (f.amt.length >= 7) return f
      if (k === '.' && !f.amt) return { ...f, amt: '0.' }
      if (f.amt === '0' && k !== '.') return { ...f, amt: k }
      return { ...f, amt: f.amt + k }
    })

  const confirm = () => {
    const sym = flow.sym
    const qty = flow.mode === 'buy' ? amount / coin.px : amount / coin.px
    const t = { id: `x${idN.current++}`, kind: flow.mode, sym, qty: +qty.toFixed(8), usd: amount, day: 'Today', time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }), fee, pay: flow.mode === 'buy' ? (payCash ? 'Cash balance' : 'Bank ••4821') : 'Cash balance' }
    if (flow.mode === 'buy') {
      setHold((h) => ({ ...h, [sym]: (h[sym] || 0) + (amount / coin.px) }))
      if (payCash) setCash((c) => +(c - buyTotal).toFixed(2))
    } else {
      setHold((h) => ({ ...h, [sym]: Math.max(0, (h[sym] || 0) - amount / coin.px) }))
      setCash((c) => +(c + amount - fee).toFixed(2))
    }
    setActs((a) => [t, ...a])
    setDir(1)
    setTab('buy')
    setStack([{ id: 'success', tx: t }])
  }

  // ---- shared bits
  const header = (title, back, right) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px 6px', minHeight: 50 }}>
      {back && (
        <button type="button" onClick={back} aria-label="Back" style={{ ...iconBtn, width: 38, height: 38, background: GLASS2 }}>
          <Icon name="back" size={20} />
        </button>
      )}
      <h1 style={{ margin: 0, flex: 1, fontSize: back ? 18 : 28, fontWeight: 800, letterSpacing: '-0.02em', marginLeft: 4 }}>{title}</h1>
      {right}
    </div>
  )

  const primary = (label, onClick, disabled, bg) => (
    <button type="button" disabled={disabled} onClick={onClick} style={{ width: '100%', height: 54, borderRadius: 27, border: 'none', background: disabled ? 'rgba(255,255,255,.1)' : bg || `linear-gradient(135deg, ${accent}, ${accent}bb)`, color: disabled ? MUTED : '#fff', font: 'inherit', fontSize: 15.500, fontWeight: 800, cursor: disabled ? 'default' : 'pointer', boxShadow: disabled ? 'none' : `0 10px 24px ${accent}55` }}>
      {label}
    </button>
  )

  const secondary = (label, onClick, color = INK) => (
    <button type="button" onClick={onClick} style={{ height: 48, borderRadius: 24, border: `1px solid ${EDGE}`, background: GLASS, font: 'inherit', fontSize: 14.500, fontWeight: 700, color, cursor: 'pointer' }}>{label}</button>
  )

  const chips = (items, val, set, label) => (
    <div className="cr-scroll" style={{ display: 'flex', gap: 8, overflowX: 'auto' }} role="group" aria-label={label}>
      {items.map((c) => (
        <button key={c} type="button" onClick={() => set(c)} aria-pressed={val === c} style={{ flex: 'none', height: 32, padding: '0 15px', borderRadius: 16, border: `1px solid ${val === c ? accent : EDGE}`, background: val === c ? `${accent}44` : 'transparent', color: val === c ? '#fff' : MUTED, font: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{c}</button>
      ))}
    </div>
  )

  const toggle = (on, set, label) => (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => set(!on)} style={{ width: 48, height: 28, borderRadius: 14, border: 'none', padding: 3, background: on ? accent : 'rgba(255,255,255,.18)', cursor: 'pointer', transition: 'background .2s', flex: 'none' }}>
      <span style={{ display: 'block', width: 22, height: 22, borderRadius: '50%', background: '#fff', transform: `translateX(${on ? 20 : 0}px)`, transition: 'transform .2s' }} />
    </button>
  )

  const setRow = (icon, label, right, last, onClick) => {
    const inner = (
      <>
        <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14.500, fontWeight: 600 }}>
          <span style={{ width: 32, height: 32, borderRadius: 10, display: 'grid', placeItems: 'center', background: `${accent}33`, color: accent }}><Icon name={icon} size={18} /></span>
          {label}
        </span>
        {right}
      </>
    )
    const st = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '12px 0', borderBottom: last ? 'none' : `1px solid ${EDGE}` }
    return onClick ? (
      <button type="button" onClick={onClick} style={{ ...st, width: '100%', border: 'none', borderBottom: st.borderBottom, background: 'none', font: 'inherit', color: INK, cursor: 'pointer', textAlign: 'left' }}>{inner}</button>
    ) : (
      <div style={st}>{inner}</div>
    )
  }

  const coinRow = (c, sub, right) => (
    <button key={c.sym} type="button" onClick={() => (setRange('1M'), push({ id: 'coin', sym: c.sym }))} style={{ ...glass, display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '11px 14px', borderRadius: 18, font: 'inherit', textAlign: 'left', cursor: 'pointer', color: INK }}>
      <CoinIcon c={c} size={40} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 15, fontWeight: 800 }}>{c.name}</span>
        <span style={{ display: 'block', fontSize: 12, color: MUTED, marginTop: 2 }}>{sub}</span>
      </span>
      <Spark data={seriesFor(c.sym, '1W').filter((_, i) => i % 6 === 0)} up={c.chg >= 0} w={54} />
      <span style={{ textAlign: 'right', minWidth: 74 }}>{right}</span>
    </button>
  )

  const actRow = (t) => {
    const [label, icon, col] = KIND[t.kind]
    return (
      <button key={t.id} type="button" onClick={() => push({ id: 'tx', tx: t.id })} style={{ ...glass, display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '11px 14px', borderRadius: 18, font: 'inherit', textAlign: 'left', cursor: 'pointer', color: INK }}>
        <span style={{ width: 40, height: 40, borderRadius: 14, display: 'grid', placeItems: 'center', background: `${col}22`, color: col, flex: 'none' }}><Icon name={icon} size={20} /></span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 14.500, fontWeight: 700 }}>{t.kind === 'deposit' ? 'Cash deposit' : `${label} ${t.sym}`}</span>
          <span style={{ display: 'block', fontSize: 12, color: MUTED, marginTop: 2 }}>{t.day} · {t.time}</span>
        </span>
        <span style={{ textAlign: 'right' }}>
          <span style={{ display: 'block', fontSize: 14.500, fontWeight: 800, color: t.kind === 'sell' || t.kind === 'deposit' || t.kind === 'reward' ? UP : INK }}>{t.kind === 'buy' ? '−' : '+'}{usd(t.usd)}</span>
          {t.sym && <span style={{ display: 'block', fontSize: 12, color: MUTED, marginTop: 2 }}>{qtyStr(t.qty)} {t.sym}</span>}
        </span>
      </button>
    )
  }

  // ---- screens
  let body
  let tabbed = true
  if (top?.id === 'coin') {
    tabbed = false
    const c = BY[top.sym]
    const series = seriesFor(c.sym, range)
    const mine = hold[c.sym] || 0
    body = (
      <>
        {header(c.name, pop, <CoinIcon c={c} size={36} />)}
        <div style={{ padding: '4px 20px 0' }}>
          <div style={{ fontSize: 13, color: MUTED }}>{c.sym} · 24h <b style={{ color: c.chg >= 0 ? UP : DN }}>{pct(c.chg)}</b></div>
        </div>
        <div style={{ padding: '8px 20px 0' }}>
          <ZoomChart key={`${c.sym}/${range}`} series={series} range={range} accent={accent} />
        </div>
        <div style={{ padding: '12px 20px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }} role="group" aria-label="Chart range">
            {RANGES.map((r) => (
              <button key={r} type="button" onClick={() => setRange(r)} aria-pressed={range === r} style={{ flex: 1, height: 36, borderRadius: 12, border: 'none', background: range === r ? GLASS2 : 'transparent', color: range === r ? '#fff' : MUTED, font: 'inherit', fontSize: 13.500, fontWeight: 800, cursor: 'pointer' }}>{r}</button>
            ))}
          </div>
        </div>
        <div style={{ ...glass, margin: '14px 20px 0', padding: '12px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: 13, color: MUTED }}>Your holdings</span>
            <span style={{ fontSize: 18, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{mask(usd(mine * c.px))}</span>
          </div>
          <div style={{ fontSize: 12.500, color: MUTED, marginTop: 2 }}>{mask(`${qtyStr(mine)} ${c.sym}`)}</div>
        </div>
        <div style={{ ...glass, margin: '10px 20px 0', padding: '4px 16px' }}>
          {[['Market cap', c.cap], ['24h volume', c.vol], ['Circulating supply', `${c.supply} ${c.sym}`]].map(([k, v], i, a) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 0', borderBottom: i < a.length - 1 ? `1px solid ${EDGE}` : 'none', fontSize: 13.500 }}>
              <span style={{ color: MUTED }}>{k}</span>
              <span style={{ fontWeight: 700 }}>{v}</span>
            </div>
          ))}
        </div>
        <p style={{ margin: '12px 22px 0', fontSize: 13, lineHeight: 1.5, color: MUTED }}>{c.about}</p>
        <div style={{ display: 'flex', gap: 10, padding: '16px 20px' }}>
          <div style={{ flex: 1 }}>{primary('Buy', () => trade(c.sym, 'buy'))}</div>
          <div style={{ flex: 1 }}>{primary('Sell', () => trade(c.sym, 'sell'), !mine, `linear-gradient(135deg, ${DN}, #e11d48)`)}</div>
        </div>
      </>
    )
  } else if (top?.id === 'review') {
    tabbed = false
    const buy = flow.mode === 'buy'
    body = (
      <>
        {header('Review order', pop)}
        <div style={{ textAlign: 'center', padding: '16px 20px' }}>
          <CoinIcon c={coin} size={58} />
          <div style={{ fontSize: 13, color: MUTED, marginTop: 12 }}>{buy ? 'You are buying' : 'You are selling'}</div>
          <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }}>{qtyStr(getQty)} {coin.sym}</div>
        </div>
        {buy && (
          <div style={{ margin: '0 20px 12px', display: 'flex', background: GLASS, borderRadius: 14, padding: 3, border: `1px solid ${EDGE}` }} role="group" aria-label="Pay with">
            {[['cash', `Cash ${usd(cash, 0)}`], ['bank', 'Bank ••4821']].map(([k, l]) => (
              <button key={k} type="button" onClick={() => setFlow((f) => ({ ...f, pay: k }))} aria-pressed={flow.pay === k} style={{ flex: 1, height: 38, borderRadius: 11, border: 'none', background: flow.pay === k ? accent : 'transparent', color: flow.pay === k ? '#fff' : MUTED, font: 'inherit', fontSize: 13.500, fontWeight: 800, cursor: 'pointer' }}>{l}</button>
            ))}
          </div>
        )}
        <div style={{ ...glass, margin: '0 20px', padding: '4px 16px' }}>
          {[[buy ? 'Amount' : 'Selling', usd(amount)], ['Rate', `1 ${coin.sym} = ${usd(coin.px)}`], [`Fee (${(FEE * 100).toFixed(1)}%)`, usd(fee)], [buy ? 'Total' : 'You receive', usd(buy ? buyTotal : amount - fee)], [buy ? 'Pay with' : 'Credited to', buy ? (payCash ? 'Cash balance' : 'Bank ••4821') : 'Cash balance']].map(([k, v], i, a) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '13px 0', borderBottom: i < a.length - 1 ? `1px solid ${EDGE}` : 'none', fontSize: 14, fontWeight: i === 3 ? 800 : 500 }}>
              <span style={{ color: MUTED, fontWeight: 500 }}>{k}</span>
              <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{v}</span>
            </div>
          ))}
        </div>
        <div style={{ padding: '18px 20px', display: 'grid', gap: 10 }}>
          {primary(buy ? `Buy ${coin.sym}` : `Sell ${coin.sym}`, confirm, buy && payCash && buyTotal > cash)}
          {buy && payCash && buyTotal > cash && <div style={{ textAlign: 'center', fontSize: 12.500, color: DN }}>Not enough cash, pick Bank instead.</div>}
          <button type="button" onClick={pop} style={{ height: 40, border: 'none', background: 'none', font: 'inherit', fontSize: 14, fontWeight: 700, color: MUTED, cursor: 'pointer' }}>Edit amount</button>
        </div>
      </>
    )
  } else if (top?.id === 'success') {
    tabbed = false
    const t = top.tx
    body = (
      <div style={{ textAlign: 'center', padding: '100px 24px 0' }}>
        <span style={{ width: 96, height: 96, borderRadius: '50%', display: 'inline-grid', placeItems: 'center', background: `${UP}22`, color: UP, boxShadow: `0 0 0 10px ${UP}11, 0 0 50px ${UP}44`, animation: 'cr-pop .5s cubic-bezier(.2,1.4,.4,1) both' }}>
          <Icon name="check" size={48} w={2.600} />
        </span>
        <div style={{ fontSize: 26, fontWeight: 800, marginTop: 26 }}>{t.kind === 'buy' ? 'Purchase complete' : 'Sale complete'}</div>
        <div style={{ fontSize: 15, color: MUTED, marginTop: 8 }}>{t.kind === 'buy' ? 'You bought' : 'You sold'} <b style={{ color: INK }}>{qtyStr(t.qty)} {t.sym}</b> for <b style={{ color: INK }}>{usd(t.usd)}</b></div>
        <div style={{ fontSize: 13, color: MUTED, marginTop: 4 }}>You now hold {qtyStr(hold[t.sym] || 0)} {t.sym}</div>
        <div style={{ display: 'grid', gap: 10, marginTop: 44 }}>
          {primary('View in Activity', () => (setFlow((f) => ({ ...f, amt: '' })), go('activity')))}
          {secondary('Back to portfolio', () => (setFlow((f) => ({ ...f, amt: '' })), go('portfolio')))}
        </div>
      </div>
    )
  } else if (top?.id === 'tx') {
    tabbed = false
    const t = acts.find((x) => x.id === top.tx)
    const [label, icon, col] = KIND[t.kind]
    body = (
      <>
        {header('Transaction', pop)}
        <div style={{ textAlign: 'center', padding: '14px 20px' }}>
          <span style={{ width: 64, height: 64, borderRadius: 22, display: 'inline-grid', placeItems: 'center', background: `${col}22`, color: col }}><Icon name={icon} size={30} /></span>
          <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.03em', marginTop: 12 }}>{t.kind === 'buy' ? '−' : '+'}{usd(t.usd)}</div>
          <div style={{ fontSize: 14, color: MUTED, marginTop: 4 }}>{t.kind === 'deposit' ? 'Cash deposit' : `${label} ${qtyStr(t.qty)} ${t.sym}`}</div>
        </div>
        <div style={{ ...glass, margin: '0 20px', padding: '4px 16px' }}>
          {[['Status', 'Completed'], ['Date', `${t.day}, ${t.time}`], ...(t.sym ? [['Price', usd(t.usd / t.qty)]] : []), ['Fee', usd(t.fee || 0)], ['Method', t.pay || (t.kind === 'deposit' ? 'Bank ••4821' : 'Cash balance')], ['Reference', `#${hashStr(t.id).toString(16).slice(0, 8).toUpperCase()}`]].map(([k, v], i, a) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '13px 0', borderBottom: i < a.length - 1 ? `1px solid ${EDGE}` : 'none', fontSize: 14 }}>
              <span style={{ color: MUTED }}>{k}</span>
              <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{v}</span>
            </div>
          ))}
        </div>
        <div style={{ padding: '16px 20px', display: 'grid', gap: 10 }}>
          {secondary('Copy reference', () => say('Reference copied'))}
          {t.sym && secondary(`Open ${t.sym}`, () => (setRange('1M'), push({ id: 'coin', sym: t.sym })))}
        </div>
      </>
    )
  } else if (top?.id === 'security') {
    tabbed = false
    body = (
      <>
        {header('Security', pop)}
        <div style={{ ...glass, margin: '8px 20px 0', padding: '4px 16px' }}>
          {setRow('shield', 'Two-step sign in', toggle(prefs.twofa, (v) => (setPrefs((p) => ({ ...p, twofa: v })), say(v ? '2-step on' : '2-step off')), 'Two-step sign in'))}
          {setRow('key', 'Face ID to trade', toggle(prefs.bio, (v) => setPrefs((p) => ({ ...p, bio: v })), 'Face ID to trade'), true)}
        </div>
        <div style={{ padding: '18px 22px 8px', fontSize: 15, fontWeight: 800 }}>Recovery phrase</div>
        <div style={{ ...glass, margin: '0 20px', padding: 14, position: 'relative' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, filter: reveal ? 'none' : 'blur(7px)', transition: 'filter .3s', userSelect: reveal ? 'text' : 'none' }}>
            {PHRASE.map((w, i) => (
              <span key={w} style={{ padding: '7px 8px', borderRadius: 10, background: GLASS2, fontSize: 12.500, fontWeight: 700 }}><span style={{ color: MUTED, marginRight: 4 }}>{i + 1}</span>{w}</span>
            ))}
          </div>
          {!reveal && (
            <button type="button" onClick={() => setReveal(true)} style={{ position: 'absolute', inset: 0, border: 'none', background: 'none', color: INK, font: 'inherit', fontSize: 14, fontWeight: 800, cursor: 'pointer', display: 'grid', placeItems: 'center' }}>Tap to reveal</button>
          )}
        </div>
        <div style={{ padding: '16px 20px', display: 'grid', gap: 10 }}>
          {secondary(reveal ? 'Hide phrase' : 'Reveal phrase', () => setReveal((r) => !r))}
          {secondary('Copy phrase', () => say(reveal ? 'Copied. Clear your clipboard soon.' : 'Reveal the phrase first'))}
        </div>
      </>
    )
  } else if (tab === 'portfolio') {
    const pser = walk(`PORT/${prange}`, RANGE_N[prange], RANGE_VOL[prange] * 0.6).map((v) => v * total)
    const pchg = total / pser[0] - 1
    const pd = pser.map((v, i) => `${i ? 'L' : 'M'}${((i / (pser.length - 1)) * 350).toFixed(1)} ${(70 - ((v - Math.min(...pser)) / (Math.max(...pser) - Math.min(...pser) || 1)) * 60).toFixed(1)}`).join('')
    const others = COINS.filter((c) => !(hold[c.sym] > 0))
    body = (
      <>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 20px 0' }}>
          <div>
            <div style={{ fontSize: 13, color: MUTED }}>Hi {name}, your portfolio</div>
          </div>
          <button type="button" onClick={() => setHide(!hide)} aria-label={hide ? 'Show balances' : 'Hide balances'} style={{ ...iconBtn, width: 38, height: 38, background: GLASS2 }}><Icon name={hide ? 'eyeoff' : 'eye'} size={19} /></button>
        </div>
        <div style={{ padding: '4px 20px 0' }}>
          <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }}>{mask(usd(total))}</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: day24 >= 0 ? UP : DN }}>{mask(`${day24 >= 0 ? '+' : '−'}${usd(Math.abs(day24))}`)} <span style={{ color: MUTED, fontWeight: 500 }}>24h</span></div>
        </div>
        <svg viewBox="0 0 350 80" width="calc(100% - 40px)" style={{ display: 'block', margin: '8px 20px 0' }} role="img" aria-label="Portfolio value over time">
          <defs>
            <linearGradient id="cr-pg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={accent} stopOpacity=".4" /><stop offset="1" stopColor={accent} stopOpacity="0" /></linearGradient>
          </defs>
          <path d={`${pd}L350 80L0 80Z`} fill="url(#cr-pg)" />
          <path d={pd} fill="none" stroke={accent} strokeWidth="2.200" strokeLinejoin="round" />
        </svg>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 20px 0' }}>
          {chips(['1D', '1W', '1M', '1Y'], prange, setPrange, 'Portfolio range')}
          <span style={{ fontSize: 13, fontWeight: 800, color: pchg >= 0 ? UP : DN }}>{pct(pchg)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-around', padding: '18px 20px 4px' }}>
          {[['down', 'Buy', () => trade('BTC', 'buy')], ['up', 'Sell', () => trade(holdings[0]?.sym || 'BTC', 'sell')], ['bank', 'Deposit', () => (setCash((c) => c + 500), setActs((a) => [{ id: `x${idN.current++}`, kind: 'deposit', usd: 500, day: 'Today', time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) }, ...a]), say('$500.00 deposited'))], ['list', 'Activity', () => go('activity')]].map(([ic, l, fn]) => (
            <button key={l} type="button" onClick={fn} style={{ border: 'none', background: 'none', font: 'inherit', cursor: 'pointer', color: INK, display: 'grid', justifyItems: 'center', gap: 6, fontSize: 12, fontWeight: 600 }}>
              <span style={{ ...glass, width: 54, height: 54, borderRadius: 18, display: 'grid', placeItems: 'center', color: accent }}><Icon name={ic} size={22} /></span>
              {l}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', margin: '14px 20px 0', height: 8, borderRadius: 4, overflow: 'hidden', background: GLASS2 }} aria-label="Allocation">
          {holdings.map((c) => <i key={c.sym} title={c.sym} style={{ width: `${(holdVal(c.sym) / total) * 100}%`, background: c.color, transition: 'width .4s' }} />)}
          <i title="Cash" style={{ width: `${(cash / total) * 100}%`, background: '#64748b' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 22px 0', fontSize: 12, color: MUTED }}>
          <span>Cash {mask(usd(cash))}</span>
          <span>{holdings.length} assets</span>
        </div>
        <h2 style={{ margin: 0, padding: '16px 20px 8px', fontSize: 16, fontWeight: 800 }}>Your assets</h2>
        <div style={{ display: 'grid', gap: 8, padding: '0 20px' }}>
          {holdings.map((c) => coinRow(c, mask(`${qtyStr(hold[c.sym])} ${c.sym}`), (
            <>
              <span style={{ display: 'block', fontSize: 14.500, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{mask(usd(holdVal(c.sym), 2))}</span>
              <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: c.chg >= 0 ? UP : DN, marginTop: 2 }}>{pct(c.chg)}</span>
            </>
          )))}
        </div>
        <h2 style={{ margin: 0, padding: '18px 20px 8px', fontSize: 16, fontWeight: 800 }}>Market</h2>
        <div style={{ display: 'grid', gap: 8, padding: '0 20px' }}>
          {others.map((c) => coinRow(c, c.sym, (
            <>
              <span style={{ display: 'block', fontSize: 14.500, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{usd(c.px)}</span>
              <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: c.chg >= 0 ? UP : DN, marginTop: 2 }}>{pct(c.chg)}</span>
            </>
          )))}
        </div>
      </>
    )
  } else if (tab === 'buy') {
    const buy = flow.mode === 'buy'
    body = (
      <>
        {header('Trade')}
        <div style={{ margin: '0 20px', display: 'flex', background: GLASS, borderRadius: 16, padding: 3, border: `1px solid ${EDGE}` }} role="group" aria-label="Order side">
          {[['buy', 'Buy'], ['sell', 'Sell']].map(([k, l]) => (
            <button key={k} type="button" onClick={() => setFlow((f) => ({ ...f, mode: k, amt: '' }))} aria-pressed={flow.mode === k} style={{ flex: 1, height: 40, borderRadius: 13, border: 'none', background: flow.mode === k ? (k === 'buy' ? accent : DN) : 'transparent', color: flow.mode === k ? '#fff' : MUTED, font: 'inherit', fontSize: 14.500, fontWeight: 800, cursor: 'pointer' }}>{l}</button>
          ))}
        </div>
        <div className="cr-scroll" style={{ display: 'flex', gap: 8, padding: '14px 20px 4px', overflowX: 'auto' }} role="group" aria-label="Coin">
          {COINS.map((c) => (
            <button key={c.sym} type="button" onClick={() => setFlow((f) => ({ ...f, sym: c.sym, amt: '' }))} aria-pressed={flow.sym === c.sym} style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 7, height: 40, padding: '0 14px 0 6px', borderRadius: 20, border: `1.5px solid ${flow.sym === c.sym ? c.color : EDGE}`, background: flow.sym === c.sym ? `${c.color}26` : 'transparent', color: INK, font: 'inherit', fontSize: 13.500, fontWeight: 800, cursor: 'pointer' }}>
              <CoinIcon c={c} size={28} />{c.sym}
            </button>
          ))}
        </div>
        <div style={{ textAlign: 'center', padding: '14px 20px 0' }}>
          <div style={{ fontSize: 52, fontWeight: 800, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums', color: flowErr ? DN : INK }}>${flow.amt || '0'}</div>
          <div style={{ fontSize: 13.500, color: flowErr ? DN : MUTED, minHeight: 20 }}>{flowErr || `≈ ${qtyStr(amount / coin.px)} ${coin.sym} · ${buy ? `Cash ${usd(cash)}` : `You hold ${usd(maxSell)}`}`}</div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 8 }}>
            {[50, 100, 250].map((v) => (
              <button key={v} type="button" onClick={() => setFlow((f) => ({ ...f, amt: String(v) }))} style={{ height: 30, padding: '0 14px', borderRadius: 15, border: `1px solid ${EDGE}`, background: 'none', color: MUTED, font: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>${v}</button>
            ))}
            <button type="button" onClick={() => setFlow((f) => ({ ...f, amt: String(Math.floor((buy ? Math.max(0, cash / (1 + FEE)) : maxSell) * 100) / 100) }))} style={{ height: 30, padding: '0 14px', borderRadius: 15, border: `1px solid ${EDGE}`, background: 'none', color: accent, font: 'inherit', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>Max</button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, padding: '14px 28px 10px' }}>
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'].map((k) => (
            <button key={k} type="button" onClick={() => tap(k)} aria-label={k === '⌫' ? 'Delete' : k} style={{ height: 52, border: 'none', borderRadius: 16, background: GLASS, font: 'inherit', fontSize: 22, fontWeight: 600, cursor: 'pointer', color: INK }}>{k}</button>
          ))}
        </div>
        <div style={{ padding: '4px 20px' }}>{primary(`Review ${buy ? 'purchase' : 'sale'}`, () => push({ id: 'review' }), !canGo)}</div>
      </>
    )
  } else if (tab === 'activity') {
    const kinds = { All: null, Buys: 'buy', Sells: 'sell', Deposits: 'deposit' }
    const list = acts.filter((t) => !kinds[filter] || t.kind === kinds[filter])
    const days = [...new Set(list.map((t) => t.day))]
    body = (
      <>
        {header('Activity')}
        <div style={{ padding: '4px 20px 10px' }}>{chips(Object.keys(kinds), filter, setFilter, 'Filter')}</div>
        <div style={{ padding: '0 20px', display: 'grid', gap: 8 }}>
          {days.map((d) => (
            <div key={d} style={{ display: 'grid', gap: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: MUTED, margin: '8px 0 0', textTransform: 'uppercase', letterSpacing: '.06em' }}>{d}</div>
              {list.filter((t) => t.day === d).map(actRow)}
            </div>
          ))}
          {!list.length && <div style={{ textAlign: 'center', color: MUTED, fontSize: 13.500, padding: '30px 0' }}>Nothing here yet.</div>}
        </div>
      </>
    )
  } else {
    body = (
      <>
        {header('Settings')}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '4px 20px 16px' }}>
          <span style={{ width: 62, height: 62, borderRadius: '50%', display: 'grid', placeItems: 'center', background: `linear-gradient(135deg, ${accent}, #22d3ee)`, color: '#fff', fontSize: 24, fontWeight: 800 }}>{name.slice(0, 1).toUpperCase()}</span>
          <div>
            <div style={{ fontSize: 19, fontWeight: 800 }}>{name} Rivera</div>
            <div style={{ fontSize: 13, color: MUTED }}>Verified · Level 2</div>
          </div>
        </div>
        <div style={{ ...glass, margin: '0 20px', padding: '2px 16px' }}>
          {setRow('bell', 'Price alerts', toggle(prefs.alerts, (v) => (setPrefs((p) => ({ ...p, alerts: v })), say(v ? 'Price alerts on' : 'Price alerts off')), 'Price alerts'))}
          {setRow('eye', 'Hide balances', toggle(hide, (v) => (setHide(v), say(v ? 'Balances hidden' : 'Balances visible')), 'Hide balances'))}
          {setRow('shield', 'Security & recovery', <Icon name="chev" size={16} color={MUTED} />, true, () => push({ id: 'security' }))}
        </div>
        <div style={{ ...glass, margin: '12px 20px 0', padding: '14px 16px' }}>
          <div style={{ fontSize: 14.500, fontWeight: 700, marginBottom: 12 }}>Accent colour</div>
          <div style={{ display: 'flex', gap: 12 }} role="group" aria-label="Accent colour">
            {SWATCHES.map((c) => (
              <button key={c} type="button" onClick={() => (setAccent(c), say('Accent updated'))} aria-label={`Accent ${c}`} aria-pressed={accent === c} style={{ width: 40, height: 40, borderRadius: '50%', border: accent === c ? '3px solid #fff' : '3px solid transparent', background: c, cursor: 'pointer', boxShadow: `0 4px 12px ${c}66` }} />
            ))}
          </div>
        </div>
        <div style={{ padding: '16px 20px', display: 'grid', gap: 10 }}>
          {secondary('Reset demo', () => (setHold(HOLD0), setCash(2500), setActs(ACT0), setFlow({ sym: 'BTC', mode: 'buy', amt: '', pay: 'cash' }), setHide(false), setReveal(false), say('Demo reset')))}
          {secondary('Sign out', () => say('Signed out (demo)'), DN)}
        </div>
      </>
    )
  }

  const phone = (
    <div style={{ position: 'relative', width: W, height: H, overflow: 'hidden', borderRadius: frame ? 46 : 0, background: BG, color: INK, fontFamily: FONT }}>
      <style>{`
        @keyframes cr-r { from { opacity: 0; transform: translateX(34px) } to { opacity: 1; transform: none } }
        @keyframes cr-l { from { opacity: 0; transform: translateX(-34px) } to { opacity: 1; transform: none } }
        @keyframes cr-pop { from { transform: scale(.3); opacity: 0 } to { transform: none; opacity: 1 } }
        @keyframes cr-drift { from { transform: translate(0,0) } to { transform: translate(24px,30px) } }
        .cr-scroll { scrollbar-width: none } .cr-scroll::-webkit-scrollbar { display: none }
        .cr-app button:focus-visible, .cr-app input:focus-visible { outline: 2px solid ${accent}; outline-offset: 2px }
        .cr-app button:disabled { cursor: default }
        @media (prefers-reduced-motion: reduce) { .cr-app *, .cr-app *::before { animation: none !important; transition: none !important } }
      `}</style>
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: `radial-gradient(circle at 15% 8%, ${accent}55, transparent 45%), radial-gradient(circle at 95% 40%, #22d3ee33, transparent 42%), radial-gradient(circle at 20% 95%, #ec489933, transparent 45%)`, animation: 'cr-drift 14s ease-in-out infinite alternate' }} />
      <StatusBar frame={frame} />
      <div key={`${tab}/${stack.map((s) => s.id + (s.sym || '')).join('/')}`} className="cr-scroll" style={{ position: 'absolute', top: 54, bottom: tabbed ? 88 : 0, left: 0, right: 0, overflowY: 'auto', overflowX: 'hidden', paddingBottom: 24, animation: `${dir > 0 ? 'cr-r' : 'cr-l'} .28s ease` }}>
        {body}
      </div>
      {tabbed && (
        <nav aria-label="Main" style={{ position: 'absolute', left: 14, right: 14, bottom: 22, height: 64, ...glass, borderRadius: 32, background: 'rgba(30,22,64,.78)', display: 'flex', justifyContent: 'space-around', alignItems: 'center', padding: '0 6px' }}>
          {NAV.map(([id, icon, label]) => (
            <button key={id} type="button" onClick={() => (id === 'buy' && setFlow((f) => ({ ...f, amt: '' })), go(id))} aria-current={tab === id ? 'page' : undefined} style={{ border: 'none', background: tab === id ? `${accent}44` : 'none', font: 'inherit', cursor: 'pointer', display: 'grid', justifyItems: 'center', alignContent: 'center', gap: 2, width: 76, height: 50, borderRadius: 25, fontSize: 10.500, fontWeight: 700, color: tab === id ? '#fff' : MUTED }}>
              <Icon name={icon} size={21} />
              {label}
            </button>
          ))}
        </nav>
      )}
      <div role="status" style={{ position: 'absolute', left: '50%', top: 58, zIndex: 30, transform: `translate(-50%, ${toast ? 0 : -90}px)`, transition: 'transform .35s cubic-bezier(.2,.8,.2,1)', padding: '10px 16px', borderRadius: 20, background: '#fff', color: '#1a1040', fontSize: 12.500, fontWeight: 700, whiteSpace: 'nowrap', maxWidth: 350, overflow: 'hidden', textOverflow: 'ellipsis' }}>{toast}</div>
      <div style={{ position: 'absolute', left: '50%', bottom: 8, width: 140, height: 5, marginLeft: -70, borderRadius: 3, background: INK, opacity: 0.6, zIndex: 25 }} />
    </div>
  )

  return (
    <div ref={box} className="cr-app" style={{ position: 'relative', width: '100%', height: '100%', display: 'grid', placeItems: 'center', overflow: 'hidden', background: 'radial-gradient(ellipse at 50% 30%, #2a1b5e, #07041a 78%)', ...style }}>
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: `translate(-50%, -50%) scale(${scale})`, transformOrigin: 'center' }}>
        {frame ? (
          <div style={{ padding: 12, borderRadius: 58, background: 'linear-gradient(145deg, #3a3f4a, #14171d 40%, #2b2f38)', boxShadow: '0 40px 80px rgba(0,0,0,.55), inset 0 0 0 2px #4b515e' }}>
            <div style={{ padding: 2, borderRadius: 48, background: '#000' }}>{phone}</div>
          </div>
        ) : (
          phone
        )}
      </div>
    </div>
  )
}
