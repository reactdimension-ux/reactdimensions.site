import { useEffect, useRef, useState } from 'react'

// A banking app on a phone, as a click-through prototype. Five tabs (Home,
// Cards, Activity, Send, Profile) and every row, card and button leads
// somewhere: a transaction opens its detail, a card opens its controls
// (freeze, limits, show number), and Send is a four-step flow (pick a person,
// type an amount, review, done) that really moves the balance and adds a line
// to Activity. Detail screens slide in from the right with a back button.
// The phone scales to fit whatever box it is in.

const W = 390 // the phone screen, in CSS px (an iPhone's width)
const H = 844
const INK = '#0f1b2d'
const MUTED = '#7b8799'
const BG = '#f3f5f9'

const money = (n, sign) => `${sign && n > 0 ? '+' : n < 0 ? '−' : ''}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const PEOPLE = [
  { id: 'ava', name: 'Ava Chen', hue: 200 },
  { id: 'leo', name: 'Leo Martins', hue: 30 },
  { id: 'mia', name: 'Mia Okafor', hue: 320 },
  { id: 'sam', name: 'Sam Patel', hue: 140 },
  { id: 'zoe', name: 'Zoe Laurent', hue: 260 },
]

const TXNS = [
  { id: 't1', name: 'Blue Bottle Coffee', cat: 'Food', amt: -6.5, day: 'Today', time: '08:12', icon: 'cup' },
  { id: 't2', name: 'Salary — Northwind', cat: 'Income', amt: 3240, day: 'Today', time: '06:00', icon: 'in' },
  { id: 't3', name: 'Metro card top-up', cat: 'Transport', amt: -25, day: 'Yesterday', time: '18:40', icon: 'train' },
  { id: 't4', name: 'Spotify', cat: 'Subscriptions', amt: -11.99, day: 'Yesterday', time: '09:00', icon: 'music' },
  { id: 't5', name: 'Whole Foods', cat: 'Groceries', amt: -84.3, day: 'Mon 10 Nov', time: '19:05', icon: 'bag' },
  { id: 't6', name: 'From Ava Chen', cat: 'Transfer', amt: 40, day: 'Mon 10 Nov', time: '12:30', icon: 'in' },
]

const CARDS = [
  { id: 'c1', name: 'Everyday Debit', last: '4821', num: '4539 1488 0343 4821', exp: '09/28', limit: 2000, a: '#1d4ed8', b: '#38bdf8' },
  { id: 'c2', name: 'Travel Credit', last: '1190', num: '5412 7512 3412 1190', exp: '02/27', limit: 5000, a: '#111827', b: '#6d28d9' },
]

const NAV = [
  ['home', 'home', 'Home'],
  ['cards', 'card', 'Cards'],
  ['activity', 'list', 'Activity'],
  ['send', 'send', 'Send'],
  ['profile', 'user', 'Profile'],
]

const ICONS = {
  home: 'M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z',
  card: 'M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 10h18',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  send: 'M4 12l16-8-6 16-3-7z',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 20a8 8 0 0 1 16 0',
  back: 'M15 5l-7 7 7 7',
  chev: 'M9 5l7 7-7 7',
  cup: 'M5 8h11v6a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4zM16 9h2a2 2 0 0 1 0 5h-2',
  in: 'M12 4v14m0 0l-5-5m5 5l5-5',
  train: 'M7 4h10a2 2 0 0 1 2 2v9a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V6a2 2 0 0 1 2-2zM5 11h14M8 21l2-3m6 3l-2-3',
  music: 'M9 18V6l10-2v12M9 18a3 3 0 1 1-3-3 3 3 0 0 1 3 3zm10-2a3 3 0 1 1-3-3 3 3 0 0 1 3 3z',
  bag: 'M5 8h14l-1 12H6zM9 8a3 3 0 0 1 6 0',
  snow: 'M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  bell: 'M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  check: 'M5 12l5 5 9-10',
  x: 'M6 6l12 12M18 6L6 18',
  plus: 'M12 5v14M5 12h14',
}

function Icon({ name, size = 22, color = 'currentColor', w = 1.9 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  )
}

const iconBtn = { display: 'grid', placeItems: 'center', border: 'none', borderRadius: '50%', cursor: 'pointer', padding: 0, background: 'transparent', color: INK }

function Avatar({ p, size = 44 }) {
  return (
    <span style={{ width: size, height: size, borderRadius: '50%', display: 'grid', placeItems: 'center', flex: 'none', background: `hsl(${p.hue} 70% 90%)`, color: `hsl(${p.hue} 55% 32%)`, fontWeight: 700, fontSize: size * 0.36 }}>
      {p.name.split(' ').map((s) => s[0]).join('')}
    </span>
  )
}

function CardArt({ c, accent, frozen, show, small }) {
  return (
    <div style={{ position: 'relative', height: small ? 150 : 200, borderRadius: 22, padding: 18, color: '#fff', background: `linear-gradient(135deg, ${c.a}, ${c.b})`, boxShadow: '0 14px 30px rgba(15,27,45,.22)', overflow: 'hidden', filter: frozen ? 'grayscale(.9) brightness(.9)' : 'none', transition: 'filter .3s' }}>
      <div style={{ position: 'absolute', right: -40, top: -40, width: 150, height: 150, borderRadius: '50%', background: 'rgba(255,255,255,.12)' }} />
      <div style={{ fontSize: 13, fontWeight: 600, opacity: 0.9 }}>{c.name}</div>
      <div style={{ position: 'absolute', left: 18, bottom: small ? 40 : 52, fontSize: small ? 16 : 19, letterSpacing: '.08em', fontWeight: 600 }}>{show ? c.num : `•••• •••• •••• ${c.last}`}</div>
      <div style={{ position: 'absolute', left: 18, bottom: 16, fontSize: 12, opacity: 0.85 }}>Exp {c.exp}</div>
      <span style={{ position: 'absolute', right: 18, bottom: 14, display: 'flex' }} aria-hidden="true">
        <i style={{ width: 26, height: 26, borderRadius: '50%', background: '#ef4444', opacity: 0.9 }} />
        <i style={{ width: 26, height: 26, borderRadius: '50%', background: '#f59e0b', opacity: 0.9, marginLeft: -10 }} />
      </span>
      {frozen && <span style={{ position: 'absolute', right: 16, top: 16, padding: '4px 10px', borderRadius: 12, background: 'rgba(255,255,255,.9)', color: INK, fontSize: 11, fontWeight: 700 }}>Frozen</span>}
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

// ---------------------------------------------------------------- app

export default function BankingApp({ name = 'Northwind', accent = '#2563eb', balance: startBalance = 8420.5, startScreen = 'home', frame = true, style }) {
  const box = useRef()
  const toastTimer = useRef()
  const [scale, setScale] = useState(1)
  const [tab, setTab] = useState(startScreen)
  const [stack, setStack] = useState([]) // pushed screens on top of the tab: { id, ...params }
  const [dir, setDir] = useState(1) // 1 slides in from the right, -1 from the left
  const [balance, setBalance] = useState(startBalance)
  const [txns, setTxns] = useState(TXNS)
  const [frozen, setFrozen] = useState({})
  const [shown, setShown] = useState({})
  const [limits, setLimits] = useState({ c1: 2000, c2: 5000 })
  const [toast, setToast] = useState('')
  const [filter, setFilter] = useState('All')
  const [hide, setHide] = useState(false)
  const [notify, setNotify] = useState(true)
  const [flow, setFlow] = useState({ to: null, amt: '' })

  useEffect(() => (setTab(startScreen), setStack([])), [startScreen])
  useEffect(() => setBalance(startBalance), [startBalance])

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
  const go = (t) => (setDir(t === tab ? 1 : NAV.findIndex((n) => n[0] === t) > NAV.findIndex((n) => n[0] === tab) ? 1 : -1), setTab(t), setStack([]))

  const amount = parseFloat(flow.amt) || 0
  const fee = amount > 0 ? 0 : 0
  const canSend = amount > 0 && amount + fee <= balance

  const tap = (k) =>
    setFlow((f) => {
      if (k === '⌫') return { ...f, amt: f.amt.slice(0, -1) }
      if (k === '.' && f.amt.includes('.')) return f
      if (f.amt.includes('.') && f.amt.split('.')[1].length >= 2) return f
      if (f.amt.length >= 7) return f
      if (k === '.' && !f.amt) return { ...f, amt: '0.' }
      return { ...f, amt: f.amt + k }
    })

  const confirmSend = () => {
    const t = { id: `t${Date.now()}`, name: `To ${flow.to.name}`, cat: 'Transfer', amt: -amount, day: 'Today', time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }), icon: 'send' }
    setTxns((a) => [t, ...a])
    setBalance((b) => +(b - amount).toFixed(2))
    setDir(1)
    setStack([{ id: 'done', txn: t }])
  }

  // ---- shared bits
  const header = (title, back) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px 6px', minHeight: 48 }}>
      {back && (
        <button type="button" onClick={back} aria-label="Back" style={{ ...iconBtn, width: 38, height: 38, background: '#fff' }}>
          <Icon name="back" size={20} />
        </button>
      )}
      <h1 style={{ margin: 0, fontSize: back ? 18 : 26, fontWeight: 800, letterSpacing: '-0.02em', marginLeft: back ? 4 : 4 }}>{title}</h1>
    </div>
  )

  const txnRow = (t) => (
    <button key={t.id} type="button" onClick={() => push({ id: 'txn', txn: t })} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '12px 14px', border: 'none', borderRadius: 18, background: '#fff', font: 'inherit', textAlign: 'left', cursor: 'pointer', color: INK }}>
      <span style={{ width: 42, height: 42, borderRadius: 14, display: 'grid', placeItems: 'center', background: t.amt > 0 ? '#dcfce7' : '#eef2f7', color: t.amt > 0 ? '#15803d' : INK }}>
        <Icon name={t.icon} size={20} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 14.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</span>
        <span style={{ display: 'block', fontSize: 12, color: MUTED, marginTop: 2 }}>{t.cat} · {t.time}</span>
      </span>
      <span style={{ fontSize: 14.5, fontWeight: 700, color: t.amt > 0 ? '#15803d' : INK }}>{money(t.amt, true)}</span>
    </button>
  )

  const primary = (label, onClick, disabled) => (
    <button type="button" disabled={disabled} onClick={onClick} style={{ width: '100%', height: 52, borderRadius: 26, border: 'none', background: disabled ? '#cbd5e1' : accent, color: '#fff', font: 'inherit', fontSize: 15, fontWeight: 700, cursor: disabled ? 'default' : 'pointer' }}>
      {label}
    </button>
  )

  const row = (label, value) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '13px 0', borderBottom: '1px solid #eef1f5', fontSize: 14 }}>
      <span style={{ color: MUTED }}>{label}</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  )

  const toggle = (on, set, label) => (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => set(!on)} style={{ width: 48, height: 28, borderRadius: 14, border: 'none', padding: 3, background: on ? accent : '#cbd5e1', cursor: 'pointer', transition: 'background .2s' }}>
      <span style={{ display: 'block', width: 22, height: 22, borderRadius: '50%', background: '#fff', transform: `translateX(${on ? 20 : 0}px)`, transition: 'transform .2s' }} />
    </button>
  )

  // ---- screens
  let body
  let tabbed = true
  if (top?.id === 'txn') {
    tabbed = false
    const t = top.txn
    body = (
      <>
        {header('Transaction', pop)}
        <div style={{ padding: '14px 20px', textAlign: 'center' }}>
          <span style={{ width: 64, height: 64, borderRadius: 22, display: 'inline-grid', placeItems: 'center', background: t.amt > 0 ? '#dcfce7' : '#e0e7ff', color: t.amt > 0 ? '#15803d' : accent }}>
            <Icon name={t.icon} size={30} />
          </span>
          <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-0.03em', marginTop: 12 }}>{money(t.amt, true)}</div>
          <div style={{ fontSize: 14, color: MUTED, marginTop: 4 }}>{t.name}</div>
        </div>
        <div style={{ margin: '0 20px', padding: '4px 16px', background: '#fff', borderRadius: 20 }}>
          {row('Category', t.cat)}
          {row('Date', `${t.day}, ${t.time}`)}
          {row('Status', 'Completed')}
          {row('Reference', `#${t.id.slice(-6).toUpperCase().padStart(6, '0')}`)}
        </div>
        <div style={{ padding: '16px 20px', display: 'grid', gap: 10 }}>
          <button type="button" onClick={() => say('Receipt saved to your files')} style={{ height: 48, borderRadius: 24, border: 'none', background: '#e4e9f1', font: 'inherit', fontSize: 14, fontWeight: 600, cursor: 'pointer', color: INK }}>Download receipt</button>
          <button type="button" onClick={() => say('Report sent — we will email you')} style={{ height: 48, borderRadius: 24, border: 'none', background: 'none', font: 'inherit', fontSize: 14, fontWeight: 600, cursor: 'pointer', color: '#dc2626' }}>Report a problem</button>
        </div>
      </>
    )
  } else if (top?.id === 'card') {
    tabbed = false
    const c = CARDS.find((x) => x.id === top.card)
    body = (
      <>
        {header(c.name, pop)}
        <div style={{ padding: '10px 20px 0' }}>
          <CardArt c={c} frozen={frozen[c.id]} show={shown[c.id]} />
        </div>
        <div style={{ margin: '16px 20px 0', background: '#fff', borderRadius: 20, padding: '4px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #eef1f5' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, fontWeight: 600 }}><Icon name="snow" size={20} color={accent} /> Freeze card</span>
            {toggle(!!frozen[c.id], (v) => (setFrozen((f) => ({ ...f, [c.id]: v })), say(v ? 'Card frozen' : 'Card active')), 'Freeze card')}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #eef1f5' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, fontWeight: 600 }}><Icon name="eye" size={20} color={accent} /> Show card number</span>
            {toggle(!!shown[c.id], (v) => setShown((f) => ({ ...f, [c.id]: v })), 'Show card number')}
          </div>
          <div style={{ padding: '14px 0 12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 600 }}>
              <span>Monthly limit</span>
              <span>${limits[c.id].toLocaleString()}</span>
            </div>
            <input type="range" min="500" max="10000" step="100" value={limits[c.id]} onChange={(e) => setLimits((l) => ({ ...l, [c.id]: +e.target.value }))} aria-label="Monthly limit" style={{ width: '100%', marginTop: 10, accentColor: accent }} />
          </div>
        </div>
        <div style={{ padding: '14px 20px' }}>{primary('Add to Apple Wallet', () => say('Added to your wallet'))}</div>
      </>
    )
  } else if (top?.id === 'amount') {
    tabbed = false
    body = (
      <>
        {header(`Send to ${flow.to.name.split(' ')[0]}`, pop)}
        <div style={{ textAlign: 'center', padding: '20px 20px 6px' }}>
          <Avatar p={flow.to} size={60} />
          <div style={{ fontSize: 46, fontWeight: 800, letterSpacing: '-0.03em', marginTop: 14, color: amount > balance ? '#dc2626' : INK }}>${flow.amt || '0'}</div>
          <div style={{ fontSize: 13, color: amount > balance ? '#dc2626' : MUTED }}>{amount > balance ? 'More than your balance' : `Balance ${money(balance)}`}</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, padding: '14px 28px 10px' }}>
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'].map((k) => (
            <button key={k} type="button" onClick={() => tap(k)} aria-label={k === '⌫' ? 'Delete' : k} style={{ height: 56, border: 'none', borderRadius: 16, background: '#fff', font: 'inherit', fontSize: 22, fontWeight: 600, cursor: 'pointer', color: INK }}>{k}</button>
          ))}
        </div>
        <div style={{ padding: '4px 20px' }}>{primary('Review', () => push({ id: 'review' }), !canSend)}</div>
      </>
    )
  } else if (top?.id === 'review') {
    tabbed = false
    body = (
      <>
        {header('Review', pop)}
        <div style={{ padding: '16px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: MUTED }}>You are sending</div>
          <div style={{ fontSize: 44, fontWeight: 800, letterSpacing: '-0.03em' }}>{money(amount)}</div>
        </div>
        <div style={{ margin: '0 20px', padding: '4px 16px', background: '#fff', borderRadius: 20 }}>
          {row('To', flow.to.name)}
          {row('From', 'Everyday Debit ••4821')}
          {row('Fee', 'Free')}
          {row('Arrives', 'Instantly')}
          {row('New balance', money(balance - amount))}
        </div>
        <div style={{ padding: '18px 20px', display: 'grid', gap: 10 }}>
          {primary(`Send ${money(amount)}`, confirmSend)}
          <button type="button" onClick={pop} style={{ height: 44, border: 'none', background: 'none', font: 'inherit', fontSize: 14, fontWeight: 600, color: MUTED, cursor: 'pointer' }}>Edit amount</button>
        </div>
      </>
    )
  } else if (top?.id === 'done') {
    tabbed = false
    body = (
      <div style={{ textAlign: 'center', padding: '110px 24px 0' }}>
        <span style={{ width: 92, height: 92, borderRadius: '50%', display: 'inline-grid', placeItems: 'center', background: '#dcfce7', color: '#15803d', animation: 'bk-pop .5s cubic-bezier(.2,1.4,.4,1) both' }}>
          <Icon name="check" size={46} w={2.6} />
        </span>
        <div style={{ fontSize: 24, fontWeight: 800, marginTop: 22 }}>Money sent</div>
        <div style={{ fontSize: 14, color: MUTED, marginTop: 6 }}>{money(-top.txn.amt)} to {top.txn.name.replace('To ', '')}</div>
        <div style={{ display: 'grid', gap: 10, marginTop: 40 }}>
          {primary('View in Activity', () => (setFlow({ to: null, amt: '' }), setDir(1), setTab('activity'), setStack([])))}
          <button type="button" onClick={() => (setFlow({ to: null, amt: '' }), setDir(-1), setTab('home'), setStack([]))} style={{ height: 44, border: 'none', background: 'none', font: 'inherit', fontSize: 14, fontWeight: 600, color: MUTED, cursor: 'pointer' }}>Back to Home</button>
        </div>
      </div>
    )
  } else if (tab === 'home') {
    body = (
      <>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 20px 0' }}>
          <div>
            <div style={{ fontSize: 13, color: MUTED }}>Good morning</div>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>Alex Rivera</div>
          </div>
          <button type="button" onClick={() => say('No new notifications')} aria-label="Notifications" style={{ ...iconBtn, width: 42, height: 42, background: '#fff' }}>
            <Icon name="bell" size={20} />
          </button>
        </div>
        <div style={{ margin: '16px 20px 0', borderRadius: 26, padding: 20, color: '#fff', background: `linear-gradient(135deg, ${accent}, #0b1b4d)`, boxShadow: `0 16px 32px ${accent}44` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, opacity: 0.85 }}>
            <span>{name} · Total balance</span>
            <button type="button" onClick={() => setHide(!hide)} aria-label={hide ? 'Show balance' : 'Hide balance'} style={{ ...iconBtn, width: 24, height: 24, color: '#fff' }}><Icon name="eye" size={18} /></button>
          </div>
          <div style={{ fontSize: 38, fontWeight: 800, letterSpacing: '-0.03em', marginTop: 6 }}>{hide ? '$••••••' : money(balance)}</div>
          <div style={{ fontSize: 12.5, opacity: 0.85, marginTop: 2 }}>+$3,240.00 this month</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-around', padding: '18px 20px 4px' }}>
          {[['send', 'Send', () => go('send')], ['card', 'Cards', () => go('cards')], ['plus', 'Top up', () => say('Top up from a linked bank')], ['list', 'History', () => go('activity')]].map(([ic, l, fn]) => (
            <button key={l} type="button" onClick={fn} style={{ border: 'none', background: 'none', font: 'inherit', cursor: 'pointer', color: INK, display: 'grid', justifyItems: 'center', gap: 6, fontSize: 12, fontWeight: 600 }}>
              <span style={{ width: 54, height: 54, borderRadius: 18, display: 'grid', placeItems: 'center', background: '#fff', color: accent }}><Icon name={ic} size={22} /></span>
              {l}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '14px 20px 10px' }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Recent</h2>
          <button type="button" onClick={() => go('activity')} style={{ border: 'none', background: 'none', padding: 0, font: 'inherit', fontSize: 13, color: accent, fontWeight: 600, cursor: 'pointer' }}>See all</button>
        </div>
        <div style={{ display: 'grid', gap: 8, padding: '0 20px' }}>{txns.slice(0, 4).map(txnRow)}</div>
      </>
    )
  } else if (tab === 'cards') {
    body = (
      <>
        {header('Cards')}
        <div style={{ display: 'grid', gap: 14, padding: '8px 20px 0' }}>
          {CARDS.map((c) => (
            <button key={c.id} type="button" onClick={() => push({ id: 'card', card: c.id })} aria-label={`Open ${c.name}`} style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}>
              <CardArt c={c} small frozen={frozen[c.id]} />
            </button>
          ))}
          <button type="button" onClick={() => say('Virtual card requested')} style={{ height: 56, borderRadius: 20, border: `2px dashed ${accent}88`, background: 'none', color: accent, font: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>+ New virtual card</button>
        </div>
      </>
    )
  } else if (tab === 'activity') {
    const cats = ['All', 'Income', 'Food', 'Groceries', 'Transport', 'Transfer']
    const list = txns.filter((t) => filter === 'All' || t.cat === filter)
    const days = [...new Set(list.map((t) => t.day))]
    body = (
      <>
        {header('Activity')}
        <div className="bk-scroll" style={{ display: 'flex', gap: 8, padding: '6px 20px 10px', overflowX: 'auto' }} role="group" aria-label="Filter">
          {cats.map((c) => (
            <button key={c} type="button" onClick={() => setFilter(c)} aria-pressed={filter === c} style={{ flex: 'none', height: 34, padding: '0 14px', borderRadius: 17, border: 'none', background: filter === c ? accent : '#fff', color: filter === c ? '#fff' : INK, font: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{c}</button>
          ))}
        </div>
        <div style={{ padding: '0 20px', display: 'grid', gap: 8 }}>
          {days.map((d) => (
            <div key={d} style={{ display: 'grid', gap: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: MUTED, margin: '8px 0 0', textTransform: 'uppercase', letterSpacing: '.06em' }}>{d}</div>
              {list.filter((t) => t.day === d).map(txnRow)}
            </div>
          ))}
          {!list.length && <div style={{ textAlign: 'center', color: MUTED, fontSize: 13, padding: '30px 0' }}>Nothing in this category.</div>}
        </div>
      </>
    )
  } else if (tab === 'send') {
    body = (
      <>
        {header('Send money')}
        <div style={{ padding: '4px 20px 10px', fontSize: 13, color: MUTED }}>Choose who to send to</div>
        <div style={{ display: 'grid', gap: 8, padding: '0 20px' }}>
          {PEOPLE.map((p) => (
            <button key={p.id} type="button" onClick={() => (setFlow({ to: p, amt: '' }), push({ id: 'amount' }))} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', border: 'none', borderRadius: 18, background: '#fff', font: 'inherit', textAlign: 'left', cursor: 'pointer', color: INK }}>
              <Avatar p={p} />
              <span style={{ flex: 1, fontSize: 15, fontWeight: 600 }}>{p.name}</span>
              <Icon name="chev" size={18} color={MUTED} />
            </button>
          ))}
        </div>
      </>
    )
  } else {
    body = (
      <>
        {header('Profile')}
        <div style={{ textAlign: 'center', padding: '10px 20px 16px' }}>
          <Avatar p={{ name: 'Alex Rivera', hue: 220 }} size={78} />
          <div style={{ fontSize: 20, fontWeight: 800, marginTop: 10 }}>Alex Rivera</div>
          <div style={{ fontSize: 13, color: MUTED }}>alex@{name.toLowerCase()}.com</div>
        </div>
        <div style={{ margin: '0 20px', padding: '4px 16px', background: '#fff', borderRadius: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #eef1f5' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, fontWeight: 600 }}><Icon name="bell" size={20} color={accent} /> Notifications</span>
            {toggle(notify, setNotify, 'Notifications')}
          </div>
          <button type="button" onClick={() => push({ id: 'security' })} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '14px 0', border: 'none', background: 'none', font: 'inherit', cursor: 'pointer', color: INK }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, fontWeight: 600 }}><Icon name="shield" size={20} color={accent} /> Security</span>
            <Icon name="chev" size={18} color={MUTED} />
          </button>
        </div>
        <div style={{ padding: '16px 20px' }}>
          <button type="button" onClick={() => (setTxns(TXNS), setBalance(startBalance), setFrozen({}), setShown({}), go('home'), say('Demo reset'))} style={{ width: '100%', height: 48, borderRadius: 24, border: 'none', background: '#e4e9f1', font: 'inherit', fontSize: 14, fontWeight: 600, color: INK, cursor: 'pointer' }}>Reset demo</button>
        </div>
      </>
    )
  }
  if (top?.id === 'security') {
    tabbed = false
    body = (
      <>
        {header('Security', pop)}
        <div style={{ margin: '10px 20px 0', padding: '4px 16px', background: '#fff', borderRadius: 20 }}>
          {row('Face ID', 'On')}
          {row('Two-step sign in', 'On')}
          {row('Last sign in', 'Today, 07:58')}
          {row('Device', 'iPhone 15')}
        </div>
        <div style={{ padding: '16px 20px' }}>{primary('Change PIN', () => say('PIN change link sent'))}</div>
      </>
    )
  }

  const phone = (
    <div style={{ position: 'relative', width: W, height: H, overflow: 'hidden', borderRadius: frame ? 46 : 0, background: BG, color: INK, fontFamily: "-apple-system, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif" }}>
      <style>{`
        @keyframes bk-r { from { opacity: 0; transform: translateX(34px) } to { opacity: 1; transform: none } }
        @keyframes bk-l { from { opacity: 0; transform: translateX(-34px) } to { opacity: 1; transform: none } }
        @keyframes bk-pop { from { transform: scale(.3); opacity: 0 } to { transform: none; opacity: 1 } }
        .bk-scroll { scrollbar-width: none } .bk-scroll::-webkit-scrollbar { display: none }
        .bk-app button:focus-visible, .bk-app input:focus-visible { outline: 2px solid ${accent}; outline-offset: 2px }
        .bk-app button:disabled { cursor: default }
      `}</style>
      <StatusBar frame={frame} />
      <div key={`${tab}/${stack.map((s) => s.id).join('/')}`} className="bk-scroll" style={{ position: 'absolute', top: 54, bottom: tabbed ? 88 : 0, left: 0, right: 0, overflowY: 'auto', paddingBottom: 24, animation: `${dir > 0 ? 'bk-r' : 'bk-l'} .28s ease` }}>
        {body}
      </div>
      {tabbed && (
        <nav aria-label="Main" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 88, background: '#fff', borderRadius: '26px 26px 0 0', boxShadow: '0 -6px 20px rgba(15,27,45,.07)', display: 'flex', justifyContent: 'space-around', padding: '10px 8px 0' }}>
          {NAV.map(([id, icon, label]) => (
            <button key={id} type="button" onClick={() => go(id)} aria-current={tab === id ? 'page' : undefined} style={{ border: 'none', background: 'none', font: 'inherit', cursor: 'pointer', display: 'grid', justifyItems: 'center', alignContent: 'start', gap: 3, width: 64, height: 54, fontSize: 11, fontWeight: 600, color: tab === id ? accent : MUTED }}>
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
    <div ref={box} className="bk-app" style={{ position: 'relative', width: '100%', height: '100%', display: 'grid', placeItems: 'center', overflow: 'hidden', background: 'radial-gradient(ellipse at 50% 30%, #e3e9f4, #b9c4d8 75%)', ...style }}>
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
