import { useEffect, useRef, useState } from 'react'

// A password vault on a phone, as a click-through prototype. It opens on a
// lock screen with a PIN pad (the demo PIN is 1234; dots fill, a wrong PIN
// shakes, and a fake Face ID button unlocks too). Inside there are three tabs
// (Vault, Generator, Settings) and an item screen. A password stays masked
// until you HOLD the reveal button (it hides again on release or after a few
// seconds), and Copy gives a toast. The Generator makes a live password with
// a strength meter and "Use" saves it as a new vault item. Settings has a real
// auto-lock timer (a 10 s demo option) that locks the app after idle, plus a
// Lock now button. The phone scales to fit whatever box it is in.

const W = 390
const H = 844
const C = { bg: '#0b0f17', card: '#151b27', card2: '#1d2535', line: '#263045', ink: '#e9eef7', mute: '#8591a8' }
const PIN = '1234'

const ICONS = {
  vault: 'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM12 8V6m0 12v-2m-4-4H6m12 0h-2',
  gen: 'M20 6v5h-5M4 18v-5h5M18.5 9A7 7 0 0 0 6 7.5L4 10m1.5 5A7 7 0 0 0 18 16.5l2-2.5',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12l2-1.5-2-3.5-2.3.7a7 7 0 0 0-1.7-1L14.5 4h-4l-.5 2.7a7 7 0 0 0-1.7 1L6 7 4 10.500 6 12a7 7 0 0 0 0 2l-2 1.500 2 3.500 2.300-.7a7 7 0 0 0 1.700 1l.5 2.700h4l.5-2.700a7 7 0 0 0 1.700-1l2.300.7 2-3.500-2-1.500c.1-.7.1-1.300 0-2z',
  back: 'M15 5l-7 7 7 7',
  chev: 'M9 5l7 7-7 7',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  copy: 'M9 9h10v11H9zM5 15V4h10',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  star: 'M12 3l2.800 5.700 6.200.9-4.500 4.400 1 6.200L12 17.200 6.500 20.200l1-6.200L3 9.600l6.200-.9z',
  plus: 'M12 5v14M5 12h14',
  x: 'M6 6l12 12M18 6L6 18',
  face: 'M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2M9 10v1.500M15 10v1.500M12 10v4h-1M9 16.500a4 4 0 0 0 6 0',
  shield: 'M12 3l8 3v6c0 5-3.500 8-8 9-4.500-1-8-4-8-9V6z',
  trash: 'M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13',
  card: 'M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 10h18',
  wifi: 'M3 9a14 14 0 0 1 18 0M6 12.500a9 9 0 0 1 12 0M9 16a4 4 0 0 1 6 0M12 19.500h.01',
  note: 'M6 3h9l4 4v14H6zM14 3v5h5M9 13h6M9 17h6',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18',
  check: 'M5 12l5 5 9-10',
  lock: 'M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3',
  back2: 'M4 7h12a4 4 0 0 1 4 4v1a4 4 0 0 1-4 4H9M4 7l4-4M4 7l4 4',
}

function Icon({ name, size = 22, color = 'currentColor', w = 1.8, fill = 'none' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  )
}

const CATS = [
  ['All', 'vault'],
  ['Login', 'globe'],
  ['Card', 'card'],
  ['Wi-Fi', 'wifi'],
  ['Note', 'note'],
]
const CAT_HUE = { Login: 215, Card: 280, 'Wi-Fi': 160, Note: 40 }
const USER_LABEL = { Login: 'Username', Card: 'Card number', 'Wi-Fi': 'Network', Note: 'Title' }

const ITEMS0 = [
  { id: 'i1', name: 'GitHub', cat: 'Login', user: 'alex@northwind.dev', pw: 'ghp-Tr0ub4dor&3x', url: 'github.com', note: 'Two-factor on.', upd: '2 days ago', fav: true },
  { id: 'i2', name: 'Netflix', cat: 'Login', user: 'alex.rivera@mail.com', pw: 'netflix123', url: 'netflix.com', note: 'Family plan.', upd: '3 months ago', fav: false },
  { id: 'i3', name: 'Visa Travel', cat: 'Card', user: '4539 1488 0343 4821', pw: '917', url: 'bank.example', note: 'Exp 02/27. CVV below.', upd: '1 year ago', fav: true },
  { id: 'i4', name: 'Home Wi-Fi', cat: 'Wi-Fi', user: 'Rivera-5G', pw: 'orange-Lamp-Seven-42!', url: 'router.local', note: 'Guest network: Rivera-Guest.', upd: '5 days ago', fav: false },
  { id: 'i5', name: 'Spotify', cat: 'Login', user: 'alexr', pw: 'M!x7q$vP2#kLw9zE', url: 'spotify.com', note: '', upd: 'Last week', fav: false },
  { id: 'i6', name: 'Gym locker', cat: 'Note', user: 'Locker 114', pw: '0420', url: 'fitbox.example', note: 'Combination lock.', upd: '6 months ago', fav: false },
  { id: 'i7', name: 'Amazon', cat: 'Login', user: 'alex.rivera@mail.com', pw: 'Summer2024', url: 'amazon.com', note: 'Prime until March.', upd: '8 months ago', fav: false },
]

const poolOf = (s) => (/[a-z]/.test(s) ? 26 : 0) + (/[A-Z]/.test(s) ? 26 : 0) + (/\d/.test(s) ? 10 : 0) + (/[^A-Za-z0-9]/.test(s) ? 32 : 0)
const bitsOf = (s) => (s ? s.length * Math.log2(Math.max(2, poolOf(s))) : 0)
const rate = (b) => (b < 40 ? { l: 'Weak', c: '#f87171', n: 1 } : b < 60 ? { l: 'Fair', c: '#fbbf24', n: 2 } : b < 80 ? { l: 'Good', c: '#a3e635', n: 3 } : { l: 'Strong', c: '#34d399', n: 4 })

function genPw(len, o) {
  const sets = []
  if (o.lower) sets.push('abcdefghijkmnopqrstuvwxyz')
  if (o.upper) sets.push('ABCDEFGHJKLMNPQRSTUVWXYZ')
  if (o.digits) sets.push('23456789')
  if (o.symbols) sets.push('!@#$%^&*-_+=?')
  if (!sets.length) sets.push('abcdefghijkmnopqrstuvwxyz')
  const all = sets.join('')
  const rnd = (n) => {
    const a = new Uint32Array(1)
    if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(a)
    else a[0] = Math.floor(Math.random() * 4294967296)
    return a[0] % n
  }
  const out = sets.map((s) => s[rnd(s.length)])
  while (out.length < len) out.push(all[rnd(all.length)])
  for (let i = out.length - 1; i > 0; i--) {
    const j = rnd(i + 1)
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out.slice(0, len).join('')
}

const LOCK_OPTS = [
  ['Off', 0],
  ['10 s demo', 10],
  ['1 min', 60],
  ['5 min', 300],
]

function Badge({ cat, name, size = 44 }) {
  const h = CAT_HUE[cat] ?? 200
  return (
    <span style={{ width: size, height: size, borderRadius: size * 0.3, display: 'grid', placeItems: 'center', flex: 'none', background: `linear-gradient(145deg, hsl(${h} 60% 30%), hsl(${h} 55% 18%))`, color: `hsl(${h} 90% 80%)`, fontWeight: 800, fontSize: size * 0.4, boxShadow: `inset 0 0 0 1px hsl(${h} 60% 40% / .5)` }}>
      {name[0].toUpperCase()}
    </span>
  )
}

function StatusBar({ frame }) {
  const clock = new Date().toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' })
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 60, height: 54, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 30px 0 36px', fontSize: 16, fontWeight: 600, color: C.ink, pointerEvents: 'none' }}>
      <span>{clock}</span>
      {frame && <span style={{ position: 'absolute', left: '50%', top: 11, width: 122, height: 35, marginLeft: -61, borderRadius: 20, background: '#000' }} />}
      <span style={{ display: 'flex', gap: 6, alignItems: 'center' }} aria-hidden="true">
        <svg width="18" height="11" viewBox="0 0 18 11" fill={C.ink}>
          <rect x="0" y="7" width="3" height="4" rx="1" />
          <rect x="5" y="5" width="3" height="6" rx="1" />
          <rect x="10" y="2.500" width="3" height="8.500" rx="1" />
          <rect x="15" y="0" width="3" height="11" rx="1" />
        </svg>
        <svg width="26" height="12" viewBox="0 0 26 12">
          <rect x="0.500" y="0.500" width="22" height="11" rx="3.500" fill="none" stroke={C.ink} opacity=".45" />
          <rect x="2.500" y="2.500" width="16" height="7" rx="2" fill={C.ink} />
          <rect x="23.500" y="4" width="2" height="4" rx="1" fill={C.ink} opacity=".45" />
        </svg>
      </span>
    </div>
  )
}

function Meter({ bits, height = 6 }) {
  const r = rate(bits)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ flex: 1, display: 'flex', gap: 4 }} role="img" aria-label={`Strength ${r.l}`}>
        {[1, 2, 3, 4].map((i) => (
          <i key={i} style={{ flex: 1, height, borderRadius: height, background: i <= r.n ? r.c : C.line, transition: 'background .25s' }} />
        ))}
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color: r.c, minWidth: 44, textAlign: 'right' }}>{r.l}</span>
    </div>
  )
}

const NAV = [
  ['vault', 'vault', 'Vault'],
  ['generator', 'gen', 'Generator'],
  ['settings', 'gear', 'Settings'],
]

// ---------------------------------------------------------------- app

export default function VaultApp({ name = 'Vaultly', accent = '#34d399', startScreen = 'lock', frame = true, style }) {
  const box = useRef()
  const timers = useRef([])
  const toastTimer = useRef()
  const lastAct = useRef(Date.now())
  const holdTimer = useRef()
  const startTab = startScreen === 'generator' || startScreen === 'settings' ? startScreen : 'vault'
  const [scale, setScale] = useState(1)
  const [locked, setLocked] = useState(startScreen === 'lock')
  const [lockMsg, setLockMsg] = useState('')
  const [pin, setPin] = useState('')
  const [shake, setShake] = useState(false)
  const [busy, setBusy] = useState(false)
  const [scan, setScan] = useState(false)
  const [tab, setTab] = useState(startTab)
  const [stack, setStack] = useState(startScreen === 'item' ? [{ id: 'item', itemId: 'i1' }] : [])
  const [dir, setDir] = useState(1)
  const [items, setItems] = useState(ITEMS0)
  const [query, setQuery] = useState('')
  const [cat, setCat] = useState('All')
  const [toast, setToast] = useState('')
  const [reveal, setReveal] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const [len, setLen] = useState(16)
  const [opts, setOpts] = useState({ upper: true, lower: true, digits: true, symbols: true })
  const [pw, setPw] = useState(() => genPw(16, { upper: true, lower: true, digits: true, symbols: true }))
  const [newName, setNewName] = useState('New login')
  const [autoLock, setAutoLock] = useState(60)
  const [faceId, setFaceId] = useState(true)
  const [clearClip, setClearClip] = useState(true)
  const [tick, setTick] = useState(0)

  const later = (fn, ms) => {
    const id = setTimeout(fn, ms)
    timers.current.push(id)
    return id
  }
  useEffect(() => () => (timers.current.forEach(clearTimeout), clearTimeout(toastTimer.current), clearTimeout(holdTimer.current)), [])

  useEffect(() => {
    setLocked(startScreen === 'lock')
    setPin('')
    setTab(startScreen === 'generator' || startScreen === 'settings' ? startScreen : 'vault')
    setStack(startScreen === 'item' ? [{ id: 'item', itemId: 'i1' }] : [])
    lastAct.current = Date.now()
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

  const doLock = (msg = '') => {
    setLocked(true)
    setLockMsg(msg)
    setPin('')
    setReveal(false)
    setScan(false)
    setBusy(false)
  }

  // idle timer: one interval that checks how long since the last touch
  useEffect(() => {
    const id = setInterval(() => {
      if (reveal) lastAct.current = Date.now()
      setTick((n) => n + 1)
      if (!locked && autoLock > 0 && Date.now() - lastAct.current >= autoLock * 1000) doLock('Locked after inactivity')
    }, 500)
    return () => clearInterval(id)
  }, [locked, autoLock, reveal])

  const bump = () => {
    lastAct.current = Date.now()
  }

  // generator follows its options
  useEffect(() => setPw(genPw(len, opts)), [len, opts])

  // ---- lock screen logic
  const unlock = () => {
    setLocked(false)
    setPin('')
    setLockMsg('')
    setBusy(false)
    setScan(false)
    bump()
  }
  const press = (d) => {
    if (busy) return
    if (d === 'del') return setPin((p) => p.slice(0, -1))
    const next = (pin + d).slice(0, 4)
    setPin(next)
    if (next.length === 4) {
      setBusy(true)
      if (next === PIN) later(unlock, 220)
      else {
        later(() => setShake(true), 160)
        later(() => (setShake(false), setPin(''), setBusy(false)), 700)
      }
    }
  }
  const useFace = () => {
    if (busy) return
    if (!faceId) return say('Face ID is off in Settings')
    setBusy(true)
    setScan(true)
    later(unlock, 1100)
  }

  // ---- navigation
  const top = stack[stack.length - 1]
  const push = (s) => (setDir(1), setReveal(false), setConfirmDel(false), setStack((a) => [...a, s]))
  const pop = () => (setDir(-1), setReveal(false), setConfirmDel(false), setStack((a) => a.slice(0, -1)))
  const go = (t) => (setDir(NAV.findIndex((n) => n[0] === t) > NAV.findIndex((n) => n[0] === tab) ? 1 : -1), setTab(t), setStack([]), setReveal(false))

  const copy = (text, what) => {
    try {
      navigator.clipboard?.writeText(text).catch(() => {})
    } catch {
      /* clipboard may be blocked, the toast is the feedback */
    }
    say(`${what} copied${clearClip ? ' · clears in 30 s' : ''}`)
  }

  const startHold = () => {
    setReveal(true)
    clearTimeout(holdTimer.current)
    holdTimer.current = setTimeout(() => setReveal(false), 8000)
  }
  const endHold = () => {
    clearTimeout(holdTimer.current)
    setReveal(false)
  }

  const weak = items.filter((i) => rate(bitsOf(i.pw)).n <= 2)
  const q = query.trim().toLowerCase()
  const shown = items
    .filter((i) => (cat === 'All' || i.cat === cat) && (!q || i.name.toLowerCase().includes(q) || i.user.toLowerCase().includes(q)))
    .sort((a, b) => Number(b.fav) - Number(a.fav))
  const left = Math.max(0, Math.ceil((autoLock * 1000 - (Date.now() - lastAct.current)) / 1000))
  void tick

  const saveGenerated = () => {
    const nm = newName.trim() || 'New login'
    const it = { id: `i${Date.now()}`, name: nm, cat: 'Login', user: 'alex@northwind.dev', pw, url: `${nm.toLowerCase().replace(/[^a-z0-9]+/g, '') || 'site'}.com`, note: 'Created with the generator.', upd: 'Just now', fav: false }
    setItems((a) => [it, ...a])
    setCat('All')
    setQuery('')
    setDir(1)
    setTab('vault')
    setStack([{ id: 'item', itemId: it.id }])
    say('Saved to your vault')
  }

  // ---- shared bits
  const header = (title, back, right) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 18px 8px', minHeight: 52 }}>
      {back && (
        <button type="button" onClick={back} aria-label="Back" style={{ ...circ, background: C.card }}>
          <Icon name="back" size={20} />
        </button>
      )}
      <h1 style={{ margin: 0, flex: 1, fontSize: back ? 18 : 28, fontWeight: 800, letterSpacing: '-0.02em', marginLeft: 4 }}>{title}</h1>
      {right}
    </div>
  )
  const card = { margin: '0 18px', padding: '4px 16px', background: C.card, borderRadius: 20, border: `1px solid ${C.line}` }
  const rowStyle = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '13px 0', borderBottom: `1px solid ${C.line}`, fontSize: 14 }
  const toggle = (on, set, label) => (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => set(!on)} style={{ width: 48, height: 28, borderRadius: 14, border: 'none', padding: 3, background: on ? accent : '#2c3649', cursor: 'pointer', transition: 'background .2s', flex: 'none' }}>
      <span style={{ display: 'block', width: 22, height: 22, borderRadius: '50%', background: on ? '#04140d' : '#9aa6bd', transform: `translateX(${on ? 20 : 0}px)`, transition: 'transform .2s' }} />
    </button>
  )

  // ---- screens
  let body
  let tabbed = true
  const item = top?.id === 'item' ? items.find((i) => i.id === top.itemId) : null

  if (top?.id === 'item' && item) {
    tabbed = false
    const bits = bitsOf(item.pw)
    body = (
      <>
        {header(item.name, pop, (
          <button type="button" aria-label={item.fav ? 'Remove favorite' : 'Add favorite'} aria-pressed={item.fav} onClick={() => setItems((a) => a.map((i) => (i.id === item.id ? { ...i, fav: !i.fav } : i)))} style={{ ...circ, background: C.card, color: item.fav ? '#fbbf24' : C.mute }}>
            <Icon name="star" size={19} fill={item.fav ? '#fbbf24' : 'none'} />
          </button>
        ))}
        <div style={{ textAlign: 'center', padding: '6px 20px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'center' }}><Badge cat={item.cat} name={item.name} size={72} /></div>
          <div style={{ fontSize: 13, color: C.mute, marginTop: 8 }}>{item.cat} · {item.url}</div>
        </div>
        <div style={card}>
          <div style={rowStyle}>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 11.5, color: C.mute, marginBottom: 3 }}>{USER_LABEL[item.cat]}</span>
              <span style={{ display: 'block', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.user}</span>
            </span>
            <button type="button" onClick={() => copy(item.user, USER_LABEL[item.cat])} aria-label={`Copy ${USER_LABEL[item.cat]}`} style={{ ...circ, background: C.card2 }}>
              <Icon name="copy" size={18} />
            </button>
          </div>
          <div style={{ ...rowStyle, flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
            <span style={{ fontSize: 11.5, color: C.mute }}>{item.cat === 'Card' ? 'CVV' : item.cat === 'Note' ? 'Code' : 'Password'}</span>
            <span aria-live="polite" style={{ fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: 18, fontWeight: 600, letterSpacing: reveal ? '.02em' : '.2em', wordBreak: 'break-all', minHeight: 26, color: reveal ? accent : C.ink }}>
              {reveal ? item.pw : '•'.repeat(Math.min(item.pw.length, 18))}
            </span>
            <Meter bits={bits} />
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                className="vt-hold"
                onPointerDown={(e) => (e.currentTarget.setPointerCapture?.(e.pointerId), startHold())}
                onPointerUp={endHold}
                onPointerCancel={endHold}
                onLostPointerCapture={endHold}
                onKeyDown={(e) => (e.key === ' ' || e.key === 'Enter') && !e.repeat && startHold()}
                onKeyUp={(e) => (e.key === ' ' || e.key === 'Enter') && endHold()}
                onBlur={endHold}
                onContextMenu={(e) => e.preventDefault()}
                style={{ flex: 1, height: 46, borderRadius: 23, border: `1.5px solid ${reveal ? accent : C.line}`, background: reveal ? `${accent}22` : C.card2, color: reveal ? accent : C.ink, font: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, touchAction: 'none', userSelect: 'none' }}
              >
                <Icon name="eye" size={19} /> {reveal ? 'Release to hide' : 'Hold to reveal'}
              </button>
              <button type="button" onClick={() => copy(item.pw, 'Password')} style={{ height: 46, padding: '0 18px', borderRadius: 23, border: 'none', background: accent, color: '#04140d', font: 'inherit', fontSize: 14, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icon name="copy" size={17} /> Copy
              </button>
            </div>
          </div>
          <div style={rowStyle}><span style={{ color: C.mute }}>Website</span><span style={{ fontWeight: 600 }}>{item.url}</span></div>
          <div style={rowStyle}><span style={{ color: C.mute }}>Notes</span><span style={{ fontWeight: 600, textAlign: 'right' }}>{item.note || 'None'}</span></div>
          <div style={{ ...rowStyle, borderBottom: 'none' }}><span style={{ color: C.mute }}>Updated</span><span style={{ fontWeight: 600 }}>{item.upd}</span></div>
        </div>
        <div style={{ padding: '16px 18px' }}>
          <button
            type="button"
            onClick={() => {
              if (!confirmDel) return (setConfirmDel(true), later(() => setConfirmDel(false), 2500))
              setItems((a) => a.filter((i) => i.id !== item.id))
              pop()
              say(`${item.name} deleted`)
            }}
            style={{ width: '100%', height: 48, borderRadius: 24, border: `1px solid ${confirmDel ? '#f87171' : C.line}`, background: confirmDel ? '#f8717126' : 'transparent', color: '#f87171', font: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            <Icon name="trash" size={18} /> {confirmDel ? 'Tap again to delete' : 'Delete item'}
          </button>
        </div>
      </>
    )
  } else if (top?.id === 'audit') {
    tabbed = false
    body = (
      <>
        {header('Security check', pop)}
        <div style={{ ...card, padding: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ width: 54, height: 54, borderRadius: 18, display: 'grid', placeItems: 'center', background: weak.length ? '#f8717122' : `${accent}22`, color: weak.length ? '#f87171' : accent }}><Icon name="shield" size={28} /></span>
          <span>
            <span style={{ display: 'block', fontSize: 18, fontWeight: 800 }}>{weak.length ? `${weak.length} weak password${weak.length > 1 ? 's' : ''}` : 'All passwords look strong'}</span>
            <span style={{ display: 'block', fontSize: 12.500, color: C.mute, marginTop: 2 }}>Tap one to open it, then make a stronger one in the Generator.</span>
          </span>
        </div>
        <div style={{ display: 'grid', gap: 8, padding: '14px 18px' }}>
          {weak.map((i) => (
            <button key={i.id} type="button" onClick={() => push({ id: 'item', itemId: i.id })} style={{ ...listRow }}>
              <Badge cat={i.cat} name={i.name} size={40} />
              <span style={{ flex: 1, minWidth: 0 }}><span style={{ display: 'block', fontWeight: 700, fontSize: 14.500 }}>{i.name}</span><span style={{ display: 'block', fontSize: 12, color: C.mute }}>{i.user}</span></span>
              <span style={{ fontSize: 12, fontWeight: 700, color: rate(bitsOf(i.pw)).c }}>{rate(bitsOf(i.pw)).l}</span>
            </button>
          ))}
        </div>
      </>
    )
  } else if (tab === 'vault') {
    body = (
      <>
        {header('Vault', null, (
          <button type="button" aria-label="New password" onClick={() => go('generator')} style={{ ...circ, background: accent, color: '#04140d' }}>
            <Icon name="plus" size={20} w={2.400} />
          </button>
        ))}
        <div style={{ padding: '2px 18px 10px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, height: 46, padding: '0 14px', borderRadius: 23, background: C.card, border: `1px solid ${C.line}`, color: C.mute }}>
            <Icon name="search" size={18} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search your vault" aria-label="Search your vault" style={{ flex: 1, minWidth: 0, background: 'none', border: 'none', outline: 'none', color: C.ink, font: 'inherit', fontSize: 15 }} />
            {query && (
              <button type="button" onClick={() => setQuery('')} aria-label="Clear search" style={{ ...circ, width: 24, height: 24, background: C.card2, color: C.mute }}>
                <Icon name="x" size={13} />
              </button>
            )}
          </label>
        </div>
        <div className="vt-scroll" style={{ display: 'flex', gap: 8, padding: '0 18px 12px', overflowX: 'auto' }}>
          {CATS.map(([c, ic]) => {
            const n = c === 'All' ? items.length : items.filter((i) => i.cat === c).length
            const on = cat === c
            return (
              <button key={c} type="button" onClick={() => setCat(c)} aria-pressed={on} style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 6, height: 36, padding: '0 14px', borderRadius: 18, border: `1px solid ${on ? accent : C.line}`, background: on ? `${accent}22` : C.card, color: on ? accent : C.ink, font: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                <Icon name={ic} size={15} /> {c} <span style={{ opacity: 0.6 }}>{n}</span>
              </button>
            )
          })}
        </div>
        {weak.length > 0 && !q && cat === 'All' && (
          <button type="button" onClick={() => push({ id: 'audit' })} style={{ ...listRow, margin: '0 18px 12px', width: 'calc(100% - 36px)', background: '#f8717114', border: '1px solid #f8717144' }}>
            <span style={{ color: '#f87171', display: 'flex' }}><Icon name="shield" size={22} /></span>
            <span style={{ flex: 1, fontSize: 13.500, fontWeight: 600 }}>{weak.length} weak password{weak.length > 1 ? 's' : ''} to fix</span>
            <Icon name="chev" size={17} color={C.mute} />
          </button>
        )}
        <div style={{ display: 'grid', gap: 8, padding: '0 18px' }}>
          {shown.map((i) => (
            <button key={i.id} type="button" onClick={() => push({ id: 'item', itemId: i.id })} style={listRow}>
              <Badge cat={i.cat} name={i.name} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{i.name}</span>
                <span style={{ display: 'block', fontSize: 12, color: C.mute, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{i.user}</span>
              </span>
              {i.fav && <Icon name="star" size={15} color="#fbbf24" fill="#fbbf24" />}
              <Icon name="chev" size={17} color={C.mute} />
            </button>
          ))}
          {!shown.length && <div style={{ textAlign: 'center', color: C.mute, padding: '40px 0', fontSize: 14 }}>Nothing matches "{query}".</div>}
        </div>
      </>
    )
  } else if (tab === 'generator') {
    const bits = bitsOf(pw)
    body = (
      <>
        {header('Generator')}
        <div style={{ ...card, padding: 16, marginBottom: 14 }}>
          <div aria-live="polite" style={{ fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: 21, fontWeight: 600, wordBreak: 'break-all', lineHeight: 1.35, minHeight: 58, color: accent }}>{pw}</div>
          <div style={{ margin: '12px 0 14px' }}><Meter bits={bits} height={7} /></div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" onClick={() => setPw(genPw(len, opts))} style={{ flex: 1, height: 44, borderRadius: 22, border: `1px solid ${C.line}`, background: C.card2, color: C.ink, font: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
              <Icon name="gen" size={17} /> Regenerate
            </button>
            <button type="button" onClick={() => copy(pw, 'Password')} style={{ flex: 1, height: 44, borderRadius: 22, border: `1px solid ${C.line}`, background: C.card2, color: C.ink, font: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
              <Icon name="copy" size={17} /> Copy
            </button>
          </div>
        </div>
        <div style={card}>
          <div style={{ ...rowStyle, flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
            <span style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}><span>Length</span><span style={{ color: accent }}>{len}</span></span>
            <input type="range" min="8" max="32" value={len} onChange={(e) => setLen(+e.target.value)} aria-label="Password length" style={{ width: '100%', accentColor: accent }} />
          </div>
          {[
            ['upper', 'Uppercase (A–Z)'],
            ['lower', 'Lowercase (a–z)'],
            ['digits', 'Numbers (0–9)'],
            ['symbols', 'Symbols (!@#)'],
          ].map(([k, l], i, a) => (
            <div key={k} style={{ ...rowStyle, borderBottom: i === a.length - 1 ? 'none' : rowStyle.borderBottom }}>
              <span style={{ fontWeight: 600 }}>{l}</span>
              {toggle(opts[k], (v) => setOpts((o) => (Object.values(o).filter(Boolean).length === 1 && !v ? o : { ...o, [k]: v })), l)}
            </div>
          ))}
        </div>
        <div style={{ padding: '14px 18px', display: 'grid', gap: 10 }}>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} aria-label="Name for the new item" placeholder="Item name" style={{ height: 46, borderRadius: 23, padding: '0 18px', background: C.card, border: `1px solid ${C.line}`, color: C.ink, font: 'inherit', fontSize: 15, outline: 'none' }} />
          <button type="button" onClick={saveGenerated} style={{ height: 52, borderRadius: 26, border: 'none', background: accent, color: '#04140d', font: 'inherit', fontSize: 15, fontWeight: 800, cursor: 'pointer' }}>Use this password</button>
        </div>
      </>
    )
  } else {
    body = (
      <>
        {header('Settings')}
        <div style={card}>
          <div style={{ ...rowStyle, flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
            <span style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
              <span>Auto-lock</span>
              <span style={{ color: autoLock ? accent : C.mute, fontVariantNumeric: 'tabular-nums' }}>{autoLock ? `locks in ${left} s` : 'never'}</span>
            </span>
            <div role="radiogroup" aria-label="Auto-lock after" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4, padding: 3, borderRadius: 14, background: C.bg }}>
              {LOCK_OPTS.map(([l, s]) => (
                <button key={l} type="button" role="radio" aria-checked={autoLock === s} onClick={() => (setAutoLock(s), bump())} style={{ height: 36, border: 'none', borderRadius: 11, background: autoLock === s ? accent : 'transparent', color: autoLock === s ? '#04140d' : C.ink, font: 'inherit', fontSize: 11.500, fontWeight: 700, cursor: 'pointer' }}>{l}</button>
              ))}
            </div>
            <span style={{ fontSize: 12, color: C.mute }}>Leave the phone alone and the vault locks itself.</span>
          </div>
          <div style={rowStyle}><span style={{ fontWeight: 600 }}>Unlock with Face ID</span>{toggle(faceId, setFaceId, 'Face ID')}</div>
          <div style={{ ...rowStyle, borderBottom: 'none' }}><span style={{ fontWeight: 600 }}>Clear clipboard after 30 s</span>{toggle(clearClip, setClearClip, 'Clear clipboard')}</div>
        </div>
        <div style={{ ...card, marginTop: 12 }}>
          <button type="button" onClick={() => push({ id: 'audit' })} style={{ ...rowStyle, width: '100%', border: 'none', borderBottom: 'none', background: 'none', color: C.ink, font: 'inherit', cursor: 'pointer' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 600 }}><Icon name="shield" size={20} color={accent} /> Security check</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: weak.length ? '#f87171' : C.mute, fontSize: 13 }}>{weak.length} weak <Icon name="chev" size={17} color={C.mute} /></span>
          </button>
        </div>
        <div style={{ padding: '16px 18px', display: 'grid', gap: 10 }}>
          <button type="button" onClick={() => doLock('Locked')} style={{ height: 52, borderRadius: 26, border: 'none', background: accent, color: '#04140d', font: 'inherit', fontSize: 15, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Icon name="lock" size={19} /> Lock now
          </button>
          <button type="button" onClick={() => (setItems(ITEMS0), setAutoLock(60), setFaceId(true), setClearClip(true), setCat('All'), setQuery(''), say('Demo reset'))} style={{ height: 46, borderRadius: 23, border: `1px solid ${C.line}`, background: 'transparent', color: C.ink, font: 'inherit', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Reset demo</button>
          <div style={{ textAlign: 'center', fontSize: 12, color: C.mute }}>{name} · {items.length} items</div>
        </div>
      </>
    )
  }

  // ---- lock screen
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'face', '0', 'del']
  const lockScreen = (
    <div style={{ position: 'absolute', inset: 0, zIndex: 50, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '86px 0 34px', background: `radial-gradient(ellipse at 50% 18%, ${accent}33, transparent 60%), linear-gradient(180deg, #0f1522, ${C.bg})` }}>
      <span style={{ width: 66, height: 66, borderRadius: 22, display: 'grid', placeItems: 'center', background: `linear-gradient(145deg, ${accent}, ${accent}88)`, color: '#04140d', boxShadow: `0 10px 30px ${accent}44` }}>
        <Icon name="lock" size={32} w={2.200} />
      </span>
      <h1 style={{ margin: '16px 0 4px', fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em' }}>{name}</h1>
      <div style={{ fontSize: 13.500, color: scan ? accent : C.mute, minHeight: 20 }}>{scan ? 'Scanning your face…' : lockMsg || 'Enter your PIN'}</div>
      <div className={shake ? 'vt-shake' : ''} role="img" aria-label={`${pin.length} of 4 digits entered`} style={{ display: 'flex', gap: 18, margin: '26px 0 34px' }}>
        {[0, 1, 2, 3].map((i) => (
          <i key={i} style={{ width: 15, height: 15, borderRadius: '50%', border: `2px solid ${shake ? '#f87171' : pin.length > i ? accent : '#4a566e'}`, background: pin.length > i ? (shake ? '#f87171' : accent) : 'transparent', transition: 'background .12s, border-color .12s', transform: pin.length > i ? 'scale(1.1)' : 'none' }} />
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 76px)', gap: '14px 26px' }}>
        {keys.map((k) => (
          <button
            key={k}
            type="button"
            className="vt-key"
            aria-label={k === 'face' ? 'Use Face ID' : k === 'del' ? 'Delete' : k}
            onClick={() => (k === 'face' ? useFace() : press(k))}
            style={{ width: 76, height: 76, borderRadius: '50%', border: 'none', background: k === 'face' || k === 'del' ? 'transparent' : 'rgba(255,255,255,.07)', color: k === 'face' ? accent : C.ink, font: 'inherit', fontSize: 30, fontWeight: 500, cursor: 'pointer', display: 'grid', placeItems: 'center', position: 'relative' }}
          >
            {k === 'face' ? (
              <span className={scan ? 'vt-scan' : ''} style={{ display: 'flex' }}><Icon name="face" size={34} w={1.600} /></span>
            ) : k === 'del' ? (
              <Icon name="back2" size={28} color={C.mute} />
            ) : (
              k
            )}
          </button>
        ))}
      </div>
      <div style={{ marginTop: 'auto', fontSize: 12, color: C.mute }}>Demo PIN: <b style={{ color: C.ink, letterSpacing: '.1em' }}>{PIN}</b></div>
    </div>
  )

  const phone = (
    <div onPointerDownCapture={bump} onPointerMoveCapture={bump} onKeyDownCapture={bump} style={{ position: 'relative', width: W, height: H, overflow: 'hidden', borderRadius: frame ? 46 : 0, background: C.bg, color: C.ink, fontFamily: "-apple-system, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif" }}>
      <style>{`
        @keyframes vt-r { from { opacity: 0; transform: translateX(34px) } to { opacity: 1; transform: none } }
        @keyframes vt-l { from { opacity: 0; transform: translateX(-34px) } to { opacity: 1; transform: none } }
        @keyframes vt-shake { 0%,100% { transform: translateX(0) } 20% { transform: translateX(-14px) } 40% { transform: translateX(12px) } 60% { transform: translateX(-9px) } 80% { transform: translateX(6px) } }
        @keyframes vt-scan { 0%,100% { transform: scale(1); opacity: 1 } 50% { transform: scale(1.18); opacity: .5 } }
        .vt-shake { animation: vt-shake .5s ease }
        .vt-scan { animation: vt-scan .7s ease-in-out infinite }
        .vt-scroll { scrollbar-width: none } .vt-scroll::-webkit-scrollbar { display: none }
        .vt-key:active { background: rgba(255,255,255,.18) !important }
        .vt-app button:focus-visible, .vt-app input:focus-visible { outline: 2px solid ${accent}; outline-offset: 2px }
        .vt-hold { -webkit-touch-callout: none }
        @media (prefers-reduced-motion: reduce) { .vt-app *, .vt-app *::before { animation-duration: .01ms !important; transition-duration: .01ms !important } }
      `}</style>
      <StatusBar frame={frame} />
      <div key={`${tab}/${stack.map((s) => s.id + (s.itemId || '')).join('/')}`} className="vt-scroll" style={{ position: 'absolute', top: 54, bottom: tabbed ? 88 : 0, left: 0, right: 0, overflowY: 'auto', paddingBottom: 24, animation: `${dir > 0 ? 'vt-r' : 'vt-l'} .28s ease` }}>
        {body}
      </div>
      {tabbed && (
        <nav aria-label="Main" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 88, background: C.card, borderTop: `1px solid ${C.line}`, display: 'flex', justifyContent: 'space-around', padding: '10px 8px 0' }}>
          {NAV.map(([id, icon, label]) => (
            <button key={id} type="button" onClick={() => go(id)} aria-current={tab === id ? 'page' : undefined} style={{ border: 'none', background: 'none', font: 'inherit', cursor: 'pointer', display: 'grid', justifyItems: 'center', alignContent: 'start', gap: 3, width: 84, height: 54, fontSize: 11, fontWeight: 600, color: tab === id ? accent : C.mute }}>
              <Icon name={icon} size={23} />
              {label}
            </button>
          ))}
        </nav>
      )}
      {locked && lockScreen}
      <div role="status" style={{ position: 'absolute', left: '50%', top: 58, zIndex: 70, transform: `translate(-50%, ${toast ? 0 : -90}px)`, transition: 'transform .35s cubic-bezier(.2,.8,.2,1)', padding: '10px 16px', borderRadius: 20, background: C.ink, color: C.bg, fontSize: 12.500, fontWeight: 700, whiteSpace: 'nowrap' }}>{toast}</div>
      <div style={{ position: 'absolute', left: '50%', bottom: 8, width: 140, height: 5, marginLeft: -70, borderRadius: 3, background: C.ink, opacity: 0.8, zIndex: 65 }} />
    </div>
  )

  return (
    <div ref={box} className="vt-app" style={{ position: 'relative', width: '100%', height: '100%', display: 'grid', placeItems: 'center', overflow: 'hidden', background: 'radial-gradient(ellipse at 50% 30%, #1a2233, #05070b 75%)', ...style }}>
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: `translate(-50%, -50%) scale(${scale})`, transformOrigin: 'center' }}>
        {frame ? (
          <div style={{ padding: 12, borderRadius: 58, background: 'linear-gradient(145deg, #3a3f4a, #14171d 40%, #2b2f38)', boxShadow: '0 40px 80px rgba(0,0,0,.6), inset 0 0 0 2px #4b515e' }}>
            <div style={{ padding: 2, borderRadius: 48, background: '#000' }}>{phone}</div>
          </div>
        ) : (
          phone
        )}
      </div>
    </div>
  )
}

const circ = { width: 38, height: 38, display: 'grid', placeItems: 'center', border: 'none', borderRadius: '50%', cursor: 'pointer', padding: 0, color: C.ink, flex: 'none' }
const listRow = { display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '11px 14px', border: `1px solid ${C.line}`, borderRadius: 18, background: C.card, font: 'inherit', textAlign: 'left', cursor: 'pointer', color: C.ink }
