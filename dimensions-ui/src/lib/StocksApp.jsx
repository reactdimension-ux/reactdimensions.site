import { useEffect, useRef, useState } from 'react'

// A stock watchlist on a phone, as a click-through prototype. Five pages:
// Watchlist, Stock detail, Alerts, Portfolio and Search. Prices tick on a
// timer (simulated, cleaned up on unmount) and pulse green or red whenever a
// price changes; every row has a live sparkline. Drag a watchlist row to the
// left to set a price alert for it. On a stock, the 1D/1W/1M/1Y chips redraw
// the chart and you can scrub it with a crosshair. Buy and Sell open a sheet
// that really updates your holdings, cash and the Portfolio page, and alerts
// fire a toast when a live price crosses them. The phone scales to fit
// whatever box it is in. Nothing here is real market data.

const W = 390 // the phone screen, in CSS px (an iPhone's width)
const H = 844
const INK = '#e8eef5'
const MUTED = '#7d8b9b'
const BG = '#0a0e13'
const PANEL = '#131a22'
const PANEL2 = '#1a232d'
const LINE = '#222e3b'
const UP = '#34d399'
const DN = '#f87171'
const FONT = "-apple-system, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif"

const UNIVERSE = [
  { sym: 'AAPL', name: 'Apple Inc.', px: 228.4, vol: 0.0009, sector: 'Tech', cap: '3.46T', pe: 34.8 },
  { sym: 'MSFT', name: 'Microsoft Corp.', px: 421.15, vol: 0.0008, sector: 'Tech', cap: '3.13T', pe: 36.2 },
  { sym: 'NVDA', name: 'NVIDIA Corp.', px: 138.7, vol: 0.0021, sector: 'Tech', cap: '3.40T', pe: 61.4 },
  { sym: 'TSLA', name: 'Tesla, Inc.', px: 352.9, vol: 0.0026, sector: 'Auto', cap: '1.13T', pe: 96.1 },
  { sym: 'AMZN', name: 'Amazon.com', px: 207.6, vol: 0.0012, sector: 'Consumer', cap: '2.19T', pe: 44.7 },
  { sym: 'GOOGL', name: 'Alphabet Inc.', px: 176.3, vol: 0.001, sector: 'Tech', cap: '2.18T', pe: 24.9 },
  { sym: 'META', name: 'Meta Platforms', px: 585.2, vol: 0.0014, sector: 'Tech', cap: '1.48T', pe: 28.6 },
  { sym: 'NFLX', name: 'Netflix, Inc.', px: 812.4, vol: 0.0016, sector: 'Consumer', cap: '348B', pe: 47.3 },
  { sym: 'DIS', name: 'Walt Disney Co.', px: 98.5, vol: 0.0011, sector: 'Consumer', cap: '178B', pe: 36.0 },
  { sym: 'NKE', name: 'Nike, Inc.', px: 78.2, vol: 0.0012, sector: 'Consumer', cap: '116B', pe: 23.5 },
  { sym: 'F', name: 'Ford Motor Co.', px: 11.3, vol: 0.0015, sector: 'Auto', cap: '45B', pe: 11.9 },
  { sym: 'JPM', name: 'JPMorgan Chase', px: 241.6, vol: 0.0009, sector: 'Finance', cap: '678B', pe: 13.2 },
  { sym: 'V', name: 'Visa Inc.', px: 311.9, vol: 0.0007, sector: 'Finance', cap: '602B', pe: 31.5 },
  { sym: 'XOM', name: 'Exxon Mobil', px: 116.4, vol: 0.001, sector: 'Energy', cap: '513B', pe: 14.8 },
]
const BY = Object.fromEntries(UNIVERSE.map((u) => [u.sym, u]))
const SECTORS = ['All', 'Tech', 'Auto', 'Consumer', 'Finance', 'Energy']
const RANGES = ['1D', '1W', '1M', '1Y']
const RANGE_N = { '1D': 78, '1W': 70, '1M': 60, '1Y': 120 }
const RANGE_VOL = { '1D': 1.1, '1W': 2.2, '1M': 3.6, '1Y': 8 }

const money = (n, d = 2) => `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })}`
const pct = (n) => `${n >= 0 ? '+' : '−'}${Math.abs(n * 100).toFixed(2)}%`
const signed = (n) => `${n >= 0 ? '+' : '−'}${money(n)}`

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

const timeLabel = (range, i, n) => {
  if (range === '1D') {
    const m = 570 + Math.round((i / (n - 1)) * 390)
    const h = Math.floor(m / 60)
    return `${h > 12 ? h - 12 : h}:${String(m % 60).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
  }
  const back = { '1W': 7, '1M': 30, '1Y': 365 }[range]
  const d = new Date(Date.now() - (1 - i / (n - 1)) * back * 864e5)
  return d.toLocaleDateString('en-US', range === '1Y' ? { month: 'short', year: '2-digit' } : { month: 'short', day: 'numeric' })
}

const ICONS = {
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  pie: 'M12 3a9 9 0 1 0 9 9h-9zM15 3.500A9 9 0 0 1 20.500 9H15z',
  bell: 'M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM16 16l5 5',
  back: 'M15 5l-7 7 7 7',
  chev: 'M9 5l7 7-7 7',
  star: 'M12 3l2.700 5.600 6.100.8-4.500 4.200 1.100 6.100L12 16.800 6.600 19.700l1.100-6.100L3.200 9.400l6.100-.8z',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  x: 'M6 6l12 12M18 6L6 18',
  check: 'M5 12l5 5 9-10',
  trash: 'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13',
  pulse: 'M3 12h4l2-6 4 12 2-6h6',
}

function Icon({ name, size = 22, color = 'currentColor', w = 1.9, fill = 'none' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  )
}

const iconBtn = { display: 'grid', placeItems: 'center', border: 'none', borderRadius: '50%', cursor: 'pointer', padding: 0, background: 'transparent', color: INK }

function Logo({ sym, size = 40 }) {
  const hue = hashStr(sym) % 360
  return (
    <span style={{ width: size, height: size, borderRadius: size * 0.32, display: 'grid', placeItems: 'center', flex: 'none', background: `hsl(${hue} 55% 22%)`, color: `hsl(${hue} 85% 78%)`, fontWeight: 800, fontSize: size * (sym.length > 3 ? 0.27 : 0.33), letterSpacing: '-0.02em' }}>
      {sym.length > 4 ? sym.slice(0, 4) : sym}
    </span>
  )
}

function Spark({ data, up, w = 64, h = 28 }) {
  const lo = Math.min(...data)
  const hi = Math.max(...data)
  const d = data.map((v, i) => `${i ? 'L' : 'M'}${((i / (data.length - 1)) * w).toFixed(1)} ${(h - 3 - ((v - lo) / (hi - lo || 1)) * (h - 6)).toFixed(1)}`).join('')
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" style={{ display: 'block', flex: 'none' }}>
      <path d={d} fill="none" stroke={up ? UP : DN} strokeWidth="1.700" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

// Price text that pulses when its flash counter changes.
function Price({ v, f, size = 15, weight = 700 }) {
  return (
    <span key={f ? f.n : 0} className={f ? (f.dir > 0 ? 'sk-up' : 'sk-dn') : undefined} style={{ fontSize: size, fontWeight: weight, fontVariantNumeric: 'tabular-nums', borderRadius: 6, padding: '1px 4px', margin: '-1px -4px' }}>
      {money(v)}
    </span>
  )
}

// A line chart with a scrub crosshair. Owns its own pointer state.
function Chart({ series, range, up, h = 190, accent }) {
  const [hover, setHover] = useState(null)
  const wd = 350
  const lo = Math.min(...series)
  const hi = Math.max(...series)
  const pad = (hi - lo) * 0.12 || 1
  const y = (v) => 8 + (1 - (v - lo + pad) / (hi - lo + pad * 2)) * (h - 16)
  const x = (i) => (i / (series.length - 1)) * wd
  const line = series.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join('')
  const col = up ? UP : DN
  const gid = `sk-g-${up ? 'u' : 'd'}`
  const move = (e) => {
    const r = e.currentTarget.getBoundingClientRect()
    const f = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
    setHover(Math.round(f * (series.length - 1)))
  }
  return (
    <div>
      <div style={{ height: 20, fontSize: 12.500, color: MUTED, display: 'flex', justifyContent: 'space-between', fontVariantNumeric: 'tabular-nums' }}>
        <span>{hover !== null ? timeLabel(range, hover, series.length) : ''}</span>
        <span style={{ color: INK, fontWeight: 700 }}>{hover !== null ? money(series[hover]) : ''}</span>
      </div>
      <svg viewBox={`0 0 ${wd} ${h}`} width="100%" style={{ display: 'block', touchAction: 'pan-y', cursor: 'crosshair' }} onPointerMove={move} onPointerDown={move} onPointerLeave={() => setHover(null)} onPointerUp={(e) => e.pointerType === 'touch' && setHover(null)} onPointerCancel={() => setHover(null)} role="img" aria-label={`${range} price chart`}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={col} stopOpacity=".3" />
            <stop offset="1" stopColor={col} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1="0" x2={wd} y1={h * f} y2={h * f} stroke={LINE} strokeDasharray="2 5" />
        ))}
        <path d={`${line}L${wd} ${h}L0 ${h}Z`} fill={`url(#${gid})`} />
        <path key={range} className="sk-draw" d={line} pathLength="1" fill="none" stroke={col} strokeWidth="2.200" strokeLinejoin="round" strokeLinecap="round" />
        {hover !== null && (
          <g pointerEvents="none">
            <line x1={x(hover)} x2={x(hover)} y1="0" y2={h} stroke={accent} strokeWidth="1" />
            <circle cx={x(hover)} cy={y(series[hover])} r="5" fill={BG} stroke={col} strokeWidth="2.500" />
          </g>
        )}
      </svg>
    </div>
  )
}

// A watchlist row you can drag left to reveal "Alert".
function Row({ s, price, open, hist, flash, onOpen, onAlert, hasAlert, accent }) {
  const [dx, setDx] = useState(0)
  const [drag, setDrag] = useState(false)
  const st = useRef({ id: null, x: 0, y: 0, moved: false })
  const chg = price / open - 1
  const up = chg >= 0
  const onDown = (e) => {
    st.current = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false }
    setDrag(true)
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  const onMove = (e) => {
    const t = st.current
    if (t.id !== e.pointerId) return
    const sc = e.currentTarget.getBoundingClientRect().width / e.currentTarget.offsetWidth || 1
    const d = (e.clientX - t.x) / sc
    if (Math.abs(d) > 6) t.moved = true
    setDx(Math.max(-130, Math.min(0, d)))
  }
  const end = (e) => {
    const t = st.current
    if (t.id !== e.pointerId) return
    t.id = null
    setDrag(false)
    if (dx < -70) onAlert(s.sym)
    setDx(0)
  }
  return (
    <div style={{ position: 'relative', borderRadius: 18, overflow: 'hidden', background: dx < -2 ? accent : 'transparent' }}>
      <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 130, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#04130c', fontWeight: 800, fontSize: 14, opacity: Math.min(1, -dx / 60) }}>
        <Icon name="bell" size={20} w={2.2} /> {hasAlert ? 'Edit alert' : 'Set alert'}
      </div>
      <div role="button" tabIndex={0} aria-label={`${s.sym} ${s.name}. Drag left to set an alert.`} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={end} onPointerCancel={end} onClick={() => !st.current.moved && onOpen(s.sym)} onKeyDown={(e) => e.key === 'Enter' && onOpen(s.sym)} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: PANEL, touchAction: 'pan-y', cursor: drag ? 'grabbing' : 'pointer', userSelect: 'none', transform: `translateX(${dx}px)`, transition: drag ? 'none' : 'transform .3s cubic-bezier(.3,.8,.3,1)' }}>
        <Logo sym={s.sym} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 15.500, fontWeight: 800 }}>{s.sym}{hasAlert && <Icon name="bell" size={12} color={accent} fill={accent} w={1.500} />}</span>
          <span style={{ display: 'block', fontSize: 12, color: MUTED, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</span>
        </span>
        <Spark data={hist} up={up} />
        <span style={{ width: 82, textAlign: 'right' }}>
          <span style={{ display: 'block' }}><Price v={price} f={flash} /></span>
          <span style={{ display: 'inline-block', marginTop: 3, padding: '2px 7px', borderRadius: 7, fontSize: 12, fontWeight: 700, color: up ? UP : DN, background: up ? 'rgba(52,211,153,.13)' : 'rgba(248,113,113,.13)', fontVariantNumeric: 'tabular-nums' }}>{pct(chg)}</span>
        </span>
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
  ['watchlist', 'list', 'Watchlist'],
  ['portfolio', 'pie', 'Portfolio'],
  ['alerts', 'bell', 'Alerts'],
  ['search', 'search', 'Search'],
]

const initMarket = () => {
  const px = {}
  const open = {}
  const hist = {}
  const flash = {}
  UNIVERSE.forEach((u) => {
    const r = rng(hashStr(u.sym))
    open[u.sym] = u.px * (1 + (r() - 0.45) * 0.03)
    px[u.sym] = u.px
    hist[u.sym] = walk(`${u.sym}/spark`, 40, 0.012).map((v) => v * u.px)
  })
  return { px, open, hist, flash }
}

// ---------------------------------------------------------------- app

export default function StocksApp({ name = 'Alex', accent = '#34d399', startScreen = 'watchlist', frame = true, tickMs = 1100, style }) {
  const box = useRef()
  const toastTimer = useRef()
  const idN = useRef(1)
  const [scale, setScale] = useState(1)
  const [tab, setTab] = useState('watchlist')
  const [stack, setStack] = useState([])
  const [dir, setDir] = useState(1)
  const [toast, setToast] = useState('')
  const [mkt, setMkt] = useState(initMarket)
  const mktRef = useRef(mkt)
  const [live, setLive] = useState(true)
  const [watch, setWatch] = useState(['AAPL', 'NVDA', 'TSLA', 'MSFT', 'AMZN', 'META'])
  const [range, setRange] = useState('1D')
  const [alerts, setAlerts] = useState(() => [
    { id: 'a0', sym: 'TSLA', dir: 'above', price: Math.round(BY.TSLA.px * 1.004 * 100) / 100, on: true, hit: false },
    { id: 'a00', sym: 'NVDA', dir: 'below', price: Math.round(BY.NVDA.px * 0.96 * 100) / 100, on: true, hit: false },
  ])
  const alertsRef = useRef(alerts)
  const [cash, setCash] = useState(2400)
  const [hold, setHold] = useState({ AAPL: { sh: 12, avg: 196.4 }, NVDA: { sh: 5, avg: 118.2 }, MSFT: { sh: 4, avg: 395.7 } })
  const [orders, setOrders] = useState([])
  const [sheet, setSheet] = useState(null) // { kind: 'trade', sym, mode } | { kind: 'alert', sym, dir, price, id? }
  const [qty, setQty] = useState('1')
  const [query, setQuery] = useState('')
  const [sector, setSector] = useState('All')
  const [prange, setPrange] = useState('1M')

  mktRef.current = mkt
  alertsRef.current = alerts

  useEffect(() => {
    setSheet(null)
    setRange('1D')
    if (startScreen === 'detail') {
      setTab('watchlist')
      setStack([{ id: 'detail', sym: 'NVDA' }])
    } else {
      setTab(NAV.some((n) => n[0] === startScreen) ? startScreen : 'watchlist')
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
    toastTimer.current = setTimeout(() => setToast(''), 2300)
  }
  const sayRef = useRef(say)
  sayRef.current = say

  // The market: one interval, cleared on unmount or when paused.
  useEffect(() => {
    if (!live) return undefined
    const id = setInterval(() => {
      const m = mktRef.current
      const px = { ...m.px }
      const hist = { ...m.hist }
      const flash = { ...m.flash }
      UNIVERSE.forEach((u) => {
        if (Math.random() > 0.75) return
        const old = px[u.sym]
        const next = Math.max(0.5, +(old * (1 + (Math.random() - 0.5) * 2 * u.vol * 2.4)).toFixed(2))
        if (next === old) return
        px[u.sym] = next
        hist[u.sym] = [...hist[u.sym].slice(1), next]
        flash[u.sym] = { dir: next > old ? 1 : -1, n: (flash[u.sym]?.n || 0) + 1 }
      })
      const nm = { ...m, px, hist, flash }
      mktRef.current = nm
      setMkt(nm)
      // alerts fire when a live price crosses them
      let fired = null
      const next = alertsRef.current.map((a) => {
        if (!a.on || a.hit) return a
        const p = px[a.sym]
        if ((a.dir === 'above' && p >= a.price) || (a.dir === 'below' && p <= a.price)) {
          fired = a
          return { ...a, hit: true }
        }
        return a
      })
      if (fired) {
        setAlerts(next)
        sayRef.current(`${fired.sym} ${fired.dir === 'above' ? 'rose above' : 'fell below'} ${money(fired.price)}`)
      }
    }, tickMs)
    return () => clearInterval(id)
  }, [live, tickMs])

  const top = stack[stack.length - 1]
  const push = (s) => (setDir(1), setStack((a) => [...a, s]))
  const pop = () => (setDir(-1), setStack((a) => a.slice(0, -1)))
  const go = (t) => (setDir(NAV.findIndex((n) => n[0] === t) > NAV.findIndex((n) => n[0] === tab) ? 1 : -1), setTab(t), setStack([]))
  const open = (sym) => (setRange('1D'), push({ id: 'detail', sym }))

  const P = (sym) => mkt.px[sym]
  const chgOf = (sym) => mkt.px[sym] / mkt.open[sym] - 1
  const openAlert = (sym, a) => {
    const p = P(sym)
    setSheet({ kind: 'alert', sym, dir: a?.dir || 'above', price: a?.price ?? Math.round(p * 1.02 * 100) / 100, id: a?.id })
  }
  const openTrade = (sym, mode) => (setQty('1'), setSheet({ kind: 'trade', sym, mode }))

  const nQty = Math.floor(+qty) || 0
  const posValue = Object.entries(hold).reduce((s, [k, v]) => s + v.sh * P(k), 0)
  const posCost = Object.entries(hold).reduce((s, [k, v]) => s + v.sh * v.avg, 0)
  const dayPL = Object.entries(hold).reduce((s, [k, v]) => s + v.sh * (P(k) - mkt.open[k]), 0)
  const total = posValue + cash

  const confirmTrade = () => {
    const { sym, mode } = sheet
    const p = P(sym)
    const cost = +(nQty * p).toFixed(2)
    if (mode === 'buy') {
      setCash((c) => +(c - cost).toFixed(2))
      setHold((h) => {
        const cur = h[sym] || { sh: 0, avg: 0 }
        const sh = cur.sh + nQty
        return { ...h, [sym]: { sh, avg: (cur.sh * cur.avg + nQty * p) / sh } }
      })
    } else {
      setCash((c) => +(c + cost).toFixed(2))
      setHold((h) => {
        const left = h[sym].sh - nQty
        const n = { ...h }
        if (left <= 0) delete n[sym]
        else n[sym] = { ...h[sym], sh: left }
        return n
      })
    }
    setOrders((o) => [{ id: `o${idN.current++}`, sym, mode, sh: nQty, p, t: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) }, ...o])
    setSheet(null)
    say(`${mode === 'buy' ? 'Bought' : 'Sold'} ${nQty} ${sym} at ${money(p)}`)
  }

  // ---- shared bits
  const header = (title, back, right) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px 6px', minHeight: 50 }}>
      {back && (
        <button type="button" onClick={back} aria-label="Back" style={{ ...iconBtn, width: 38, height: 38, background: PANEL }}>
          <Icon name="back" size={20} />
        </button>
      )}
      <h1 style={{ margin: 0, flex: 1, fontSize: back ? 18 : 28, fontWeight: 800, letterSpacing: '-0.02em', marginLeft: 4 }}>{title}</h1>
      {right}
    </div>
  )

  const primary = (label, onClick, disabled, color = accent) => (
    <button type="button" disabled={disabled} onClick={onClick} style={{ width: '100%', height: 52, borderRadius: 16, border: 'none', background: disabled ? '#2a3542' : color, color: disabled ? '#6b7888' : '#04130c', font: 'inherit', fontSize: 15, fontWeight: 800, cursor: disabled ? 'default' : 'pointer' }}>
      {label}
    </button>
  )

  const chips = (items, val, set, label) => (
    <div className="sk-scroll" style={{ display: 'flex', gap: 8, overflowX: 'auto' }} role="group" aria-label={label}>
      {items.map((c) => (
        <button key={c} type="button" onClick={() => set(c)} aria-pressed={val === c} style={{ flex: 'none', height: 32, padding: '0 14px', borderRadius: 16, border: 'none', background: val === c ? accent : PANEL, color: val === c ? '#04130c' : INK, font: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{c}</button>
      ))}
    </div>
  )

  const toggle = (on, set, label) => (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => set(!on)} style={{ width: 46, height: 27, borderRadius: 14, border: 'none', padding: 3, background: on ? accent : '#2a3542', cursor: 'pointer', transition: 'background .2s', flex: 'none' }}>
      <span style={{ display: 'block', width: 21, height: 21, borderRadius: '50%', background: on ? '#04130c' : '#9aa7b6', transform: `translateX(${on ? 19 : 0}px)`, transition: 'transform .2s' }} />
    </button>
  )

  const rowBtn = { display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '12px 14px', border: 'none', borderRadius: 18, background: PANEL, font: 'inherit', textAlign: 'left', cursor: 'pointer', color: INK }

  const quoteRow = (sym, extra) => (
    <div key={sym} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <button type="button" onClick={() => open(sym)} style={{ ...rowBtn, flex: 1, minWidth: 0 }}>
        <Logo sym={sym} size={38} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 15, fontWeight: 800 }}>{sym}</span>
          <span style={{ display: 'block', fontSize: 12, color: MUTED, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{BY[sym].name}</span>
        </span>
        <span style={{ textAlign: 'right' }}>
          <span style={{ display: 'block' }}><Price v={P(sym)} f={mkt.flash[sym]} size={14.500} /></span>
          <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: chgOf(sym) >= 0 ? UP : DN, marginTop: 2 }}>{pct(chgOf(sym))}</span>
        </span>
      </button>
      {extra}
    </div>
  )

  // ---- screens
  let body
  let tabbed = true
  if (top?.id === 'detail') {
    tabbed = false
    const sym = top.sym
    const u = BY[sym]
    const p = P(sym)
    const base = walk(`${sym}/${range}`, RANGE_N[range], u.vol * 14 * RANGE_VOL[range])
    const series = base.map((v) => v * p)
    const start = series[0]
    const rangeChg = p / start - 1
    const hi = Math.max(...series)
    const lo = Math.min(...series)
    const h = hold[sym]
    const al = alerts.filter((a) => a.sym === sym)
    const starred = watch.includes(sym)
    body = (
      <>
        {header(sym, pop, (
          <button type="button" onClick={() => (setWatch((w) => (starred ? w.filter((x) => x !== sym) : [...w, sym])), say(starred ? `${sym} removed from watchlist` : `${sym} added to watchlist`))} aria-label={starred ? 'Remove from watchlist' : 'Add to watchlist'} aria-pressed={starred} style={{ ...iconBtn, width: 38, height: 38, background: PANEL, color: starred ? '#fbbf24' : MUTED }}>
            <Icon name="star" size={20} fill={starred ? '#fbbf24' : 'none'} />
          </button>
        ))}
        <div style={{ padding: '2px 20px 0' }}>
          <div style={{ fontSize: 13, color: MUTED }}>{u.name} · {u.sector}</div>
          <div style={{ marginTop: 6, display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <Price v={p} f={mkt.flash[sym]} size={38} weight={800} />
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: rangeChg >= 0 ? UP : DN, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
            {signed(p - start)} ({pct(rangeChg)}) <span style={{ color: MUTED, fontWeight: 500 }}>{{ '1D': 'today', '1W': 'past week', '1M': 'past month', '1Y': 'past year' }[range]}</span>
          </div>
        </div>
        <div style={{ padding: '10px 20px 0' }}>
          <Chart series={series} range={range} up={rangeChg >= 0} accent={accent} />
        </div>
        <div style={{ display: 'flex', gap: 6, padding: '10px 20px 0', justifyContent: 'space-between' }} role="group" aria-label="Chart range">
          {RANGES.map((r) => (
            <button key={r} type="button" onClick={() => setRange(r)} aria-pressed={range === r} style={{ flex: 1, height: 36, borderRadius: 12, border: 'none', background: range === r ? PANEL2 : 'transparent', color: range === r ? accent : MUTED, font: 'inherit', fontSize: 13.500, fontWeight: 800, cursor: 'pointer' }}>{r}</button>
          ))}
        </div>
        <div style={{ margin: '14px 20px 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, borderRadius: 18, overflow: 'hidden', background: LINE }}>
          {[['Open', money(mkt.open[sym])], ['Range high', money(hi)], ['Range low', money(lo)], ['Mkt cap', u.cap], ['P/E', u.pe.toFixed(1)], ['Sector', u.sector]].map(([k, v]) => (
            <div key={k} style={{ background: PANEL, padding: '11px 14px', display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: MUTED }}>{k}</span>
              <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{v}</span>
            </div>
          ))}
        </div>
        {h && (
          <div style={{ margin: '12px 20px 0', padding: '12px 14px', borderRadius: 18, background: PANEL, display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span><span style={{ color: MUTED }}>Your position</span><br /><b style={{ fontSize: 15 }}>{h.sh} shares</b> · avg {money(h.avg)}</span>
            <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}><b style={{ fontSize: 15 }}>{money(h.sh * p)}</b><br /><span style={{ color: p >= h.avg ? UP : DN, fontWeight: 700 }}>{signed(h.sh * (p - h.avg))}</span></span>
          </div>
        )}
        <div style={{ margin: '12px 20px 0' }}>
          <button type="button" onClick={() => openAlert(sym)} style={{ ...rowBtn, justifyContent: 'space-between' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, fontWeight: 700 }}><Icon name="bell" size={19} color={accent} /> {al.length ? `${al.length} alert${al.length > 1 ? 's' : ''} set` : 'Set a price alert'}</span>
            <Icon name="plus" size={18} color={MUTED} />
          </button>
        </div>
        <div style={{ display: 'flex', gap: 10, padding: '14px 20px' }}>
          <div style={{ flex: 1 }}>{primary('Buy', () => openTrade(sym, 'buy'))}</div>
          <div style={{ flex: 1 }}>{primary('Sell', () => openTrade(sym, 'sell'), !h, DN)}</div>
        </div>
      </>
    )
  } else if (tab === 'watchlist') {
    const idx = [['S&P 500', 5845.2, 0.62], ['NASDAQ', 18620.4, 0.88], ['DOW', 42890.1, 0.31]]
    const avg = UNIVERSE.reduce((s, x) => s + chgOf(x.sym), 0) / UNIVERSE.length
    body = (
      <>
        {header('Watchlist', null, (
          <button type="button" onClick={() => (setLive((l) => !l), say(live ? 'Prices paused' : 'Live prices on'))} aria-pressed={live} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 12px', borderRadius: 16, border: 'none', background: PANEL, color: live ? accent : MUTED, font: 'inherit', fontSize: 12.500, fontWeight: 800, cursor: 'pointer' }}>
            <span className={live ? 'sk-live' : undefined} style={{ width: 8, height: 8, borderRadius: '50%', background: live ? accent : MUTED }} /> {live ? 'LIVE' : 'PAUSED'}
          </button>
        ))}
        <div className="sk-scroll" style={{ display: 'flex', gap: 8, padding: '4px 20px 12px', overflowX: 'auto' }}>
          {idx.map(([n, v, c]) => {
            const cc = c / 100 + avg
            return (
              <div key={n} style={{ flex: 'none', minWidth: 112, padding: '9px 12px', borderRadius: 14, background: PANEL }}>
                <div style={{ fontSize: 11.500, color: MUTED, fontWeight: 600 }}>{n}</div>
                <div style={{ fontSize: 14, fontWeight: 800, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>{(v * (1 + avg)).toLocaleString('en-US', { maximumFractionDigits: 1, minimumFractionDigits: 1 })}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: cc >= 0 ? UP : DN }}>{pct(cc)}</div>
              </div>
            )
          })}
        </div>
        <div style={{ padding: '0 22px 8px', fontSize: 12, color: MUTED }}>Drag a row left to set an alert</div>
        <div style={{ display: 'grid', gap: 8, padding: '0 20px' }}>
          {watch.map((sym) => (
            <Row key={sym} s={BY[sym]} price={P(sym)} open={mkt.open[sym]} hist={mkt.hist[sym]} flash={mkt.flash[sym]} onOpen={open} onAlert={(s) => openAlert(s, alerts.find((a) => a.sym === s))} hasAlert={alerts.some((a) => a.sym === sym && a.on && !a.hit)} accent={accent} />
          ))}
          {!watch.length && (
            <div style={{ textAlign: 'center', color: MUTED, fontSize: 13.500, padding: '30px 10px' }}>
              Your watchlist is empty.
              <div style={{ marginTop: 14 }}>{primary('Find stocks', () => go('search'))}</div>
            </div>
          )}
          {watch.length > 0 && (
            <button type="button" onClick={() => go('search')} style={{ height: 50, borderRadius: 16, border: `1.5px dashed ${accent}77`, background: 'none', color: accent, font: 'inherit', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>+ Add stocks</button>
          )}
        </div>
      </>
    )
  } else if (tab === 'portfolio') {
    const pvals = walk(`PORT/${prange}`, RANGE_N[prange], 0.03 * RANGE_VOL[prange] / 2).map((v) => v * total)
    const pchg = total / pvals[0] - 1
    const entries = Object.entries(hold).map(([k, v]) => ({ k, v, val: v.sh * P(k) })).sort((a, b) => b.val - a.val)
    const palette = [accent, '#60a5fa', '#fbbf24', '#c084fc', '#fb923c', '#f472b6']
    const slices = [...entries.map((e) => [e.k, e.val]), ['Cash', cash]]
    let acc = 0
    const R = 46
    const C = 2 * Math.PI * R
    body = (
      <>
        {header('Portfolio')}
        <div style={{ padding: '0 20px' }}>
          <div style={{ fontSize: 13, color: MUTED }}>Total value</div>
          <div style={{ fontSize: 38, fontWeight: 800, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }}>{money(total)}</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: dayPL >= 0 ? UP : DN }}>{signed(dayPL)} today <span style={{ color: pchg >= 0 ? UP : DN }}>· {pct(pchg)} {prange}</span></div>
        </div>
        <div style={{ padding: '8px 20px 0' }}>
          <Chart series={pvals} range={prange} up={pchg >= 0} accent={accent} h={150} />
        </div>
        <div style={{ padding: '4px 20px 0' }}>{chips(RANGES, prange, setPrange, 'Portfolio range')}</div>
        <div style={{ margin: '16px 20px 0', padding: 16, borderRadius: 20, background: PANEL, display: 'flex', alignItems: 'center', gap: 16 }}>
          <svg width="112" height="112" viewBox="0 0 112 112" role="img" aria-label="Allocation">
            <g transform="rotate(-90 56 56)">
              {slices.map(([k, v], i) => {
                const f = v / total
                const el = <circle key={k} cx="56" cy="56" r={R} fill="none" stroke={k === 'Cash' ? '#3b4756' : palette[i % palette.length]} strokeWidth="14" strokeDasharray={`${Math.max(0, f * C - 2)} ${C}`} strokeDashoffset={-acc * C} style={{ transition: 'all .4s' }} />
                acc += f
                return el
              })}
            </g>
            <text x="56" y="53" textAnchor="middle" fontSize="11" fill={MUTED}>Invested</text>
            <text x="56" y="70" textAnchor="middle" fontSize="15" fontWeight="800" fill={INK}>{Math.round((posValue / total) * 100)}%</text>
          </svg>
          <div style={{ flex: 1, display: 'grid', gap: 6, fontSize: 13 }}>
            {slices.map(([k, v], i) => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <i style={{ width: 9, height: 9, borderRadius: 3, background: k === 'Cash' ? '#3b4756' : palette[i % palette.length] }} />
                <span style={{ flex: 1, fontWeight: 700 }}>{k}</span>
                <span style={{ color: MUTED, fontVariantNumeric: 'tabular-nums' }}>{((v / total) * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '18px 20px 8px' }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Positions</h2>
          <span style={{ fontSize: 12.500, color: MUTED }}>Cash {money(cash)} · P/L <b style={{ color: posValue >= posCost ? UP : DN }}>{signed(posValue - posCost)}</b></span>
        </div>
        <div style={{ display: 'grid', gap: 8, padding: '0 20px' }}>
          {entries.map(({ k, v, val }) => (
            <button key={k} type="button" onClick={() => open(k)} style={rowBtn}>
              <Logo sym={k} size={38} />
              <span style={{ flex: 1 }}>
                <span style={{ display: 'block', fontSize: 15, fontWeight: 800 }}>{k}</span>
                <span style={{ display: 'block', fontSize: 12, color: MUTED, marginTop: 2 }}>{v.sh} sh · avg {money(v.avg)}</span>
              </span>
              <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                <span style={{ display: 'block', fontSize: 14.500, fontWeight: 700 }}>{money(val)}</span>
                <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: P(k) >= v.avg ? UP : DN, marginTop: 2 }}>{signed(v.sh * (P(k) - v.avg))}</span>
              </span>
            </button>
          ))}
          {!entries.length && <div style={{ textAlign: 'center', color: MUTED, fontSize: 13.500, padding: '20px 0' }}>No positions yet. Open a stock and tap Buy.</div>}
        </div>
        {orders.length > 0 && (
          <>
            <h2 style={{ margin: 0, padding: '18px 20px 8px', fontSize: 16, fontWeight: 800 }}>Recent orders</h2>
            <div style={{ display: 'grid', gap: 6, padding: '0 20px' }}>
              {orders.slice(0, 5).map((o) => (
                <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 14, background: PANEL, fontSize: 13.500 }}>
                  <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11.500, fontWeight: 800, background: o.mode === 'buy' ? 'rgba(52,211,153,.15)' : 'rgba(248,113,113,.15)', color: o.mode === 'buy' ? UP : DN }}>{o.mode.toUpperCase()}</span>
                  <span style={{ flex: 1, fontWeight: 700 }}>{o.sh} {o.sym}</span>
                  <span style={{ color: MUTED, fontVariantNumeric: 'tabular-nums' }}>@ {money(o.p)} · {o.t}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </>
    )
  } else if (tab === 'alerts') {
    body = (
      <>
        {header('Alerts', null, (
          <button type="button" onClick={() => openAlert(watch[0] || 'AAPL')} aria-label="New alert" style={{ ...iconBtn, width: 38, height: 38, background: accent, color: '#04130c' }}>
            <Icon name="plus" size={20} w={2.400} />
          </button>
        ))}
        <div style={{ padding: '0 22px 10px', fontSize: 13, color: MUTED }}>You will be notified when a live price crosses a level.</div>
        <div style={{ display: 'grid', gap: 8, padding: '0 20px' }}>
          {alerts.map((a) => (
            <div key={a.id} style={{ borderRadius: 18, background: PANEL, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, opacity: a.on || a.hit ? 1 : 0.55 }}>
              <button type="button" onClick={() => open(a.sym)} aria-label={`Open ${a.sym}`} style={{ ...iconBtn, background: 'none' }}><Logo sym={a.sym} size={38} /></button>
              <button type="button" onClick={() => openAlert(a.sym, a)} style={{ flex: 1, minWidth: 0, border: 'none', background: 'none', font: 'inherit', color: INK, textAlign: 'left', cursor: 'pointer', padding: 0 }}>
                <span style={{ display: 'block', fontSize: 15, fontWeight: 800 }}>{a.sym} {a.dir === 'above' ? '≥' : '≤'} {money(a.price)}</span>
                <span style={{ display: 'block', fontSize: 12, marginTop: 2, color: a.hit ? accent : MUTED, fontVariantNumeric: 'tabular-nums' }}>{a.hit ? 'Triggered' : `Now ${money(P(a.sym))} · ${a.dir === 'above' ? 'rises above' : 'falls below'}`}</span>
              </button>
              {a.hit ? (
                <button type="button" onClick={() => (setAlerts((l) => l.map((x) => (x.id === a.id ? { ...x, hit: false } : x))), say('Alert re-armed'))} style={{ height: 30, padding: '0 10px', borderRadius: 10, border: `1.5px solid ${accent}`, background: 'none', color: accent, font: 'inherit', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>Re-arm</button>
              ) : (
                toggle(a.on, (v) => setAlerts((l) => l.map((x) => (x.id === a.id ? { ...x, on: v } : x))), `Alert ${a.sym}`)
              )}
              <button type="button" onClick={() => (setAlerts((l) => l.filter((x) => x.id !== a.id)), say('Alert deleted'))} aria-label={`Delete ${a.sym} alert`} style={{ ...iconBtn, width: 30, height: 30, color: MUTED }}><Icon name="trash" size={17} /></button>
            </div>
          ))}
          {!alerts.length && (
            <div style={{ textAlign: 'center', color: MUTED, fontSize: 13.500, padding: '40px 20px' }}>
              <Icon name="bell" size={34} color={MUTED} />
              <div style={{ marginTop: 10 }}>No alerts yet. Tap + or drag a watchlist row to the left.</div>
            </div>
          )}
        </div>
      </>
    )
  } else {
    const q = query.trim().toLowerCase()
    const res = UNIVERSE.filter((u) => (sector === 'All' || u.sector === sector) && (!q || u.sym.toLowerCase().includes(q) || u.name.toLowerCase().includes(q)))
    const movers = [...UNIVERSE].sort((a, b) => Math.abs(chgOf(b.sym)) - Math.abs(chgOf(a.sym))).slice(0, 4)
    body = (
      <>
        {header('Search')}
        <div style={{ padding: '2px 20px 10px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, height: 44, padding: '0 14px', borderRadius: 14, background: PANEL, color: MUTED }}>
            <Icon name="search" size={18} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ticker or company" aria-label="Search stocks" style={{ flex: 1, border: 'none', outline: 'none', background: 'none', font: 'inherit', fontSize: 15, color: INK, minWidth: 0 }} />
            {query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search" style={{ ...iconBtn, width: 24, height: 24, color: MUTED }}><Icon name="x" size={16} /></button>}
          </label>
        </div>
        <div style={{ padding: '0 20px 10px' }}>{chips(SECTORS, sector, setSector, 'Sector')}</div>
        {!q && sector === 'All' && (
          <div style={{ padding: '4px 20px 10px' }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: MUTED, letterSpacing: '.06em', marginBottom: 8 }}>BIGGEST MOVERS</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {movers.map((m) => (
                <button key={m.sym} type="button" onClick={() => open(m.sym)} style={{ border: 'none', borderRadius: 16, background: PANEL, padding: 12, font: 'inherit', color: INK, textAlign: 'left', cursor: 'pointer' }}>
                  <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 800, fontSize: 14.500 }}>{m.sym}<span style={{ fontSize: 12, color: chgOf(m.sym) >= 0 ? UP : DN }}>{pct(chgOf(m.sym))}</span></span>
                  <span style={{ display: 'block', marginTop: 6 }}><Spark data={mkt.hist[m.sym]} up={chgOf(m.sym) >= 0} w={140} h={30} /></span>
                </button>
              ))}
            </div>
          </div>
        )}
        <div style={{ display: 'grid', gap: 8, padding: '0 20px' }}>
          {res.map((u) =>
            quoteRow(
              u.sym,
              <button type="button" onClick={() => (setWatch((w) => (w.includes(u.sym) ? w.filter((x) => x !== u.sym) : [...w, u.sym])), say(watch.includes(u.sym) ? `${u.sym} removed` : `${u.sym} added to watchlist`))} aria-label={watch.includes(u.sym) ? `Remove ${u.sym} from watchlist` : `Add ${u.sym} to watchlist`} aria-pressed={watch.includes(u.sym)} style={{ ...iconBtn, width: 42, height: 42, flex: 'none', background: watch.includes(u.sym) ? accent : PANEL, color: watch.includes(u.sym) ? '#04130c' : accent }}>
                <Icon name={watch.includes(u.sym) ? 'check' : 'plus'} size={20} w={2.400} />
              </button>,
            ),
          )}
          {!res.length && <div style={{ textAlign: 'center', color: MUTED, fontSize: 13.500, padding: '30px 0' }}>No matches for “{query}”.</div>}
        </div>
      </>
    )
  }

  // ---- bottom sheet
  let sheetEl = null
  if (sheet?.kind === 'trade') {
    const { sym, mode } = sheet
    const p = P(sym)
    const cost = nQty * p
    const owned = hold[sym]?.sh || 0
    const err = nQty < 1 ? 'Enter at least 1 share' : mode === 'buy' && cost > cash ? `Not enough cash (${money(cash)} available)` : mode === 'sell' && nQty > owned ? `You only own ${owned}` : ''
    const col = mode === 'buy' ? accent : DN
    sheetEl = (
      <>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Logo sym={sym} size={42} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{mode === 'buy' ? 'Buy' : 'Sell'} {sym}</div>
            <div style={{ fontSize: 13, color: MUTED, fontVariantNumeric: 'tabular-nums' }}>Market price <Price v={p} f={mkt.flash[sym]} size={13} /></div>
          </div>
          <div style={{ display: 'flex', background: PANEL2, borderRadius: 12, padding: 3 }} role="group" aria-label="Order side">
            {['buy', 'sell'].map((m) => (
              <button key={m} type="button" disabled={m === 'sell' && !owned} onClick={() => setSheet({ ...sheet, mode: m })} aria-pressed={mode === m} style={{ height: 30, padding: '0 12px', borderRadius: 9, border: 'none', background: mode === m ? (m === 'buy' ? accent : DN) : 'transparent', color: mode === m ? '#04130c' : m === 'sell' && !owned ? '#4a5766' : INK, font: 'inherit', fontSize: 12.500, fontWeight: 800, cursor: 'pointer', textTransform: 'capitalize' }}>{m}</button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, margin: '20px 0 12px' }}>
          <button type="button" onClick={() => setQty(String(Math.max(0, nQty - 1)))} aria-label="Fewer shares" style={{ ...iconBtn, width: 46, height: 46, background: PANEL2 }}><Icon name="minus" size={20} /></button>
          <input value={qty} inputMode="numeric" aria-label="Shares" onChange={(e) => setQty(e.target.value.replace(/\D/g, '').slice(0, 5))} style={{ width: 120, height: 56, textAlign: 'center', borderRadius: 14, border: `1.5px solid ${LINE}`, background: BG, color: INK, font: 'inherit', fontSize: 28, fontWeight: 800 }} />
          <button type="button" onClick={() => setQty(String(nQty + 1))} aria-label="More shares" style={{ ...iconBtn, width: 46, height: 46, background: PANEL2 }}><Icon name="plus" size={20} /></button>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          {[1, 5, 10, 25].map((n) => (
            <button key={n} type="button" onClick={() => setQty(String(n))} style={{ height: 30, padding: '0 14px', borderRadius: 15, border: 'none', background: nQty === n ? PANEL2 : 'transparent', color: MUTED, font: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer', outline: `1px solid ${LINE}` }}>{n}</button>
          ))}
          {mode === 'sell' && <button type="button" onClick={() => setQty(String(owned))} style={{ height: 30, padding: '0 14px', borderRadius: 15, border: 'none', background: 'transparent', color: DN, font: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer', outline: `1px solid ${LINE}` }}>All</button>}
        </div>
        <div style={{ margin: '16px 0 4px', padding: '4px 0', borderTop: `1px solid ${LINE}`, fontSize: 14 }}>
          {[[mode === 'buy' ? 'Estimated cost' : 'Estimated proceeds', money(cost)], ['Cash after', money(mode === 'buy' ? cash - cost : cash + cost)], [mode === 'buy' ? 'Shares after' : 'Shares left', String(mode === 'buy' ? owned + nQty : Math.max(0, owned - nQty))]].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
              <span style={{ color: MUTED }}>{k}</span>
              <b style={{ fontVariantNumeric: 'tabular-nums', color: k === 'Cash after' && cash - cost < 0 && mode === 'buy' ? DN : INK }}>{v}</b>
            </div>
          ))}
        </div>
        <div style={{ minHeight: 18, fontSize: 12.500, color: DN, textAlign: 'center', marginBottom: 6 }}>{err}</div>
        {primary(`${mode === 'buy' ? 'Buy' : 'Sell'} ${nQty || ''} ${sym}`.replace('  ', ' '), confirmTrade, !!err, col)}
      </>
    )
  } else if (sheet?.kind === 'alert') {
    const { sym, dir: d, price } = sheet
    const p = P(sym)
    const step = (f) => setSheet({ ...sheet, price: Math.max(0.01, Math.round(price * (1 + f) * 100) / 100) })
    sheetEl = (
      <>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Logo sym={sym} size={42} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{sheet.id ? 'Edit alert' : 'Price alert'}</div>
            <div style={{ fontSize: 13, color: MUTED }}>{sym} now {money(p)}</div>
          </div>
        </div>
        <div className="sk-scroll" style={{ display: 'flex', gap: 8, marginTop: 14, overflowX: 'auto' }} role="group" aria-label="Symbol">
          {[...new Set([...watch, sym])].map((s) => (
            <button key={s} type="button" onClick={() => setSheet({ ...sheet, sym: s, price: Math.round(P(s) * (d === 'above' ? 1.02 : 0.98) * 100) / 100 })} aria-pressed={s === sym} style={{ flex: 'none', height: 30, padding: '0 12px', borderRadius: 15, border: 'none', background: s === sym ? PANEL2 : 'transparent', outline: `1px solid ${s === sym ? accent : LINE}`, color: s === sym ? accent : MUTED, font: 'inherit', fontSize: 12.500, fontWeight: 800, cursor: 'pointer' }}>{s}</button>
          ))}
        </div>
        <div style={{ display: 'flex', background: PANEL2, borderRadius: 12, padding: 3, marginTop: 14 }} role="group" aria-label="Direction">
          {[['above', 'Rises above'], ['below', 'Falls below']].map(([k, l]) => (
            <button key={k} type="button" onClick={() => setSheet({ ...sheet, dir: k, price: Math.round(p * (k === 'above' ? 1.02 : 0.98) * 100) / 100 })} aria-pressed={d === k} style={{ flex: 1, height: 34, borderRadius: 9, border: 'none', background: d === k ? accent : 'transparent', color: d === k ? '#04130c' : INK, font: 'inherit', fontSize: 13.500, fontWeight: 800, cursor: 'pointer' }}>{l}</button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, margin: '18px 0 6px' }}>
          <button type="button" onClick={() => step(-0.01)} aria-label="Lower by 1%" style={{ ...iconBtn, width: 46, height: 46, background: PANEL2 }}><Icon name="minus" size={20} /></button>
          <div style={{ width: 150, textAlign: 'center', fontSize: 28, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{money(price)}</div>
          <button type="button" onClick={() => step(0.01)} aria-label="Raise by 1%" style={{ ...iconBtn, width: 46, height: 46, background: PANEL2 }}><Icon name="plus" size={20} /></button>
        </div>
        <div style={{ textAlign: 'center', fontSize: 12.500, color: MUTED, marginBottom: 16 }}>{pct(price / p - 1)} from current price</div>
        {primary(sheet.id ? 'Save alert' : 'Create alert', () => {
          if (sheet.id) setAlerts((l) => l.map((a) => (a.id === sheet.id ? { ...a, sym, dir: d, price, on: true, hit: false } : a)))
          else setAlerts((l) => [{ id: `a${idN.current++}`, sym, dir: d, price, on: true, hit: false }, ...l])
          setSheet(null)
          say(`Alert set: ${sym} ${d === 'above' ? 'above' : 'below'} ${money(price)}`)
        })}
      </>
    )
  }

  const phone = (
    <div style={{ position: 'relative', width: W, height: H, overflow: 'hidden', borderRadius: frame ? 46 : 0, background: BG, color: INK, fontFamily: FONT }}>
      <style>{`
        @keyframes sk-r { from { opacity: 0; transform: translateX(34px) } to { opacity: 1; transform: none } }
        @keyframes sk-l { from { opacity: 0; transform: translateX(-34px) } to { opacity: 1; transform: none } }
        @keyframes sk-up { 0% { background: rgba(52,211,153,.5); color: #6ee7b7 } 100% { background: transparent } }
        @keyframes sk-dn { 0% { background: rgba(248,113,113,.5); color: #fca5a5 } 100% { background: transparent } }
        @keyframes sk-draw { from { stroke-dashoffset: 1 } to { stroke-dashoffset: 0 } }
        @keyframes sk-pulse { 0%,100% { opacity: 1 } 50% { opacity: .35 } }
        @keyframes sk-sheet { from { transform: translateY(100%) } to { transform: none } }
        .sk-up { animation: sk-up .9s ease-out } .sk-dn { animation: sk-dn .9s ease-out }
        .sk-draw { stroke-dasharray: 1; animation: sk-draw .7s ease-out }
        .sk-live { animation: sk-pulse 1.4s infinite }
        .sk-scroll { scrollbar-width: none } .sk-scroll::-webkit-scrollbar { display: none }
        .sk-app button:focus-visible, .sk-app input:focus-visible, .sk-app [role=button]:focus-visible { outline: 2px solid ${accent}; outline-offset: 2px }
        .sk-app button:disabled { cursor: default }
        @media (prefers-reduced-motion: reduce) { .sk-app *, .sk-app *::before { animation: none !important; transition: none !important } .sk-draw { stroke-dasharray: none !important } }
      `}</style>
      <StatusBar frame={frame} />
      <div key={`${tab}/${stack.map((s) => s.id + (s.sym || '')).join('/')}`} className="sk-scroll" style={{ position: 'absolute', top: 54, bottom: tabbed ? 88 : 0, left: 0, right: 0, overflowY: 'auto', overflowX: 'hidden', paddingBottom: 24, animation: `${dir > 0 ? 'sk-r' : 'sk-l'} .28s ease` }}>
        {body}
      </div>
      {tabbed && (
        <nav aria-label="Main" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 88, background: PANEL, borderTop: `1px solid ${LINE}`, display: 'flex', justifyContent: 'space-around', padding: '10px 8px 0' }}>
          {NAV.map(([id, icon, label]) => (
            <button key={id} type="button" onClick={() => go(id)} aria-current={tab === id ? 'page' : undefined} style={{ border: 'none', background: 'none', font: 'inherit', cursor: 'pointer', display: 'grid', justifyItems: 'center', alignContent: 'start', gap: 3, width: 72, height: 54, fontSize: 11, fontWeight: 700, color: tab === id ? accent : MUTED, position: 'relative' }}>
              <Icon name={icon} size={23} />
              {label}
              {id === 'alerts' && alerts.some((a) => a.hit) && <i style={{ position: 'absolute', top: 0, right: 20, width: 9, height: 9, borderRadius: '50%', background: DN }} />}
            </button>
          ))}
        </nav>
      )}
      {sheetEl && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 40 }}>
          <button type="button" aria-label="Close sheet" onClick={() => setSheet(null)} style={{ position: 'absolute', inset: 0, border: 'none', background: 'rgba(0,0,0,.6)', cursor: 'pointer' }} />
          <div role="dialog" aria-modal="true" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '10px 20px 30px', borderRadius: '26px 26px 0 0', background: PANEL, animation: 'sk-sheet .32s cubic-bezier(.2,.8,.2,1)', boxShadow: '0 -10px 40px rgba(0,0,0,.5)' }}>
            <div style={{ width: 40, height: 4, borderRadius: 2, background: '#33404e', margin: '0 auto 16px' }} />
            {sheetEl}
          </div>
        </div>
      )}
      <div role="status" style={{ position: 'absolute', left: '50%', top: 58, zIndex: 50, transform: `translate(-50%, ${toast ? 0 : -90}px)`, transition: 'transform .35s cubic-bezier(.2,.8,.2,1)', padding: '10px 16px', borderRadius: 20, background: '#e8eef5', color: '#0a0e13', fontSize: 12.500, fontWeight: 700, whiteSpace: 'nowrap', maxWidth: 350, overflow: 'hidden', textOverflow: 'ellipsis' }}>{toast}</div>
      <div style={{ position: 'absolute', left: '50%', bottom: 8, width: 140, height: 5, marginLeft: -70, borderRadius: 3, background: INK, opacity: 0.7, zIndex: 60 }} />
    </div>
  )

  return (
    <div ref={box} className="sk-app" style={{ position: 'relative', width: '100%', height: '100%', display: 'grid', placeItems: 'center', overflow: 'hidden', background: 'radial-gradient(ellipse at 50% 30%, #1c2733, #05080b 78%)', ...style }}>
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
