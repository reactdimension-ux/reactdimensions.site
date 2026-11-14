import { useEffect, useRef, useState } from 'react'

// A dating app on a phone, as a click-through prototype, in warm peach and
// plum tones. Tabs: Discover, Matches and Profile, plus pushed Chat and
// Filters pages. On Discover, drag the top card (LIKE and NOPE stamps fade in)
// or use the buttons to swipe; tap a card for more about the person. Liking
// someone who already likes you opens "It's a match" and adds them to Matches.
// Chat works, with a typing indicator and replies. Filters (age, distance,
// interests) change which cards are in the deck, live. Timers are cleared when
// the app unmounts.

const W = 390
const H = 844
const INK = '#2b1a2f'
const MUTED = '#8f7b94'
const BG = '#fff6ef'
const CARD = '#ffffff'
const LINE = '#f2e3dc'

const TAGS = ['Hiking', 'Coffee', 'Music', 'Travel', 'Cooking', 'Art', 'Gaming', 'Yoga', 'Books', 'Film']

const PEOPLE = [
  { id: 'ivy', name: 'Ivy', age: 27, dist: 3, hue: 340, tags: ['Art', 'Coffee', 'Books'], bio: 'Illustrator who judges cafes by their oat milk.', job: 'Illustrator', likesYou: true },
  { id: 'june', name: 'June', age: 29, dist: 6, hue: 20, tags: ['Hiking', 'Travel', 'Yoga'], bio: 'Will absolutely drag you up a mountain for sunrise.', job: 'Physio', likesYou: true },
  { id: 'milo', name: 'Milo', age: 31, dist: 9, hue: 205, tags: ['Cooking', 'Music', 'Film'], bio: 'Sunday ramen, Monday vinyl. Taking requests.', job: 'Chef', likesYou: true },
  { id: 'zara', name: 'Zara', age: 24, dist: 12, hue: 285, tags: ['Gaming', 'Music', 'Art'], bio: 'Looking for a co-op partner, in games and in life.', job: 'Game artist', likesYou: false },
  { id: 'theo', name: 'Theo', age: 34, dist: 18, hue: 150, tags: ['Hiking', 'Books', 'Coffee'], bio: 'Bookshop owner. I will recommend you something.', job: 'Bookseller', likesYou: true },
  { id: 'noor', name: 'Noor', age: 26, dist: 4, hue: 45, tags: ['Travel', 'Cooking', 'Yoga'], bio: 'Collecting passport stamps and spice blends.', job: 'Photographer', likesYou: false },
  { id: 'kian', name: 'Kian', age: 38, dist: 25, hue: 190, tags: ['Film', 'Gaming', 'Coffee'], bio: 'Film editor. Yes I will pause the movie to explain cuts.', job: 'Editor', likesYou: true },
  { id: 'lola', name: 'Lola', age: 22, dist: 8, hue: 320, tags: ['Music', 'Art', 'Travel'], bio: 'Drummer in two bands, neither of them good yet.', job: 'Student', likesYou: false },
  { id: 'omar', name: 'Omar', age: 42, dist: 40, hue: 25, tags: ['Cooking', 'Hiking', 'Books'], bio: 'Slow cooking and long trails.', job: 'Architect', likesYou: true },
]
const REPLIES = ['Haha, I like that.', 'Okay you have my attention.', 'Tell me more!', 'Free this weekend?', 'That made my day, honestly.', 'Coffee on Saturday?']

const ICONS = {
  flame: 'M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z',
  heart: 'M12 20s-7-4.4-9-9.2C1.8 7.3 4 4.5 7 4.5c2 0 3.6 1.1 5 3 1.4-1.9 3-3 5-3 3 0 5.2 2.8 4 6.3-2 4.8-9 9.2-9 9.2z',
  chat: 'M4 5h16v11H9l-5 4z',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 20a8 8 0 0 1 16 0',
  back: 'M15 5l-7 7 7 7',
  x: 'M6 6l12 12M18 6L6 18',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
  undo: 'M9 7L4 12l5 5M4 12h10a6 6 0 0 1 0 12h-3',
  sliders: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 4v6M9 14v6',
  send: 'M4 12l16-8-6 16-3-7z',
  check: 'M5 12l5 5 9-10',
  pin: 'M12 21s-6-5.5-6-10a6 6 0 0 1 12 0c0 4.5-6 10-6 10zM12 13a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
}

function Icon({ name, size = 22, color = 'currentColor', w = 1.9, fill = 'none' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  )
}

const iconBtn = { display: 'grid', placeItems: 'center', border: 'none', borderRadius: '50%', cursor: 'pointer', padding: 0, background: 'transparent', color: INK }

// small round avatar
function Face({ p, size = 56 }) {
  const h = p.hue
  const hair = p.id.length % 3
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" style={{ display: 'block', borderRadius: '50%' }} aria-hidden="true">
      <defs>
        <linearGradient id={`fd-${p.id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={`hsl(${h} 85% 82%)`} />
          <stop offset="1" stopColor={`hsl(${(h + 40) % 360} 70% 62%)`} />
        </linearGradient>
      </defs>
      <rect width="48" height="48" fill={`url(#fd-${p.id})`} />
      <path d="M6 48c1-10 8-14 18-14s17 4 18 14z" fill={`hsl(${h} 45% 28%)`} />
      <circle cx="24" cy="21" r="8.5" fill="#f1c9a5" />
      {hair === 0 && <path d="M15 20c0-8 5-11 10-11s9 3 8 11c-2-4-5-5-9-5s-7 1-9 5z" fill="#2b1d16" />}
      {hair === 1 && <path d="M14.5 24c-2-10 4-15 10-15s11 5 9 15c-1-5-3-8-9-8s-8 3-10 8z" fill="#6b3a1e" />}
      {hair === 2 && <path d="M15 19c1-6 5-9 9-9s8 3 9 9c-3-2-6-3-9-3s-6 1-9 3z" fill="#d9a441" />}
    </svg>
  )
}

// the big card portrait
function Portrait({ p }) {
  const h = p.hue
  const hair = p.id.length % 3
  return (
    <svg viewBox="0 0 300 440" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" style={{ display: 'block' }} aria-hidden="true">
      <defs>
        <linearGradient id={`pt-${p.id}`} x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0" stopColor={`hsl(${h} 90% 80%)`} />
          <stop offset="1" stopColor={`hsl(${(h + 60) % 360} 70% 48%)`} />
        </linearGradient>
      </defs>
      <rect width="300" height="440" fill={`url(#pt-${p.id})`} />
      <circle cx="240" cy="90" r="70" fill="#fff" opacity=".18" />
      <circle cx="40" cy="300" r="90" fill="#fff" opacity=".12" />
      <path d="M20 440c4-80 60-120 130-120s126 40 130 120z" fill={`hsl(${h} 45% 24%)`} />
      <rect x="128" y="250" width="44" height="50" rx="14" fill="#e8b994" />
      <ellipse cx="150" cy="200" rx="56" ry="66" fill="#f1c9a5" />
      {hair === 0 && <path d="M92 200c-8-70 38-100 62-100s70 30 58 100c-8-40-30-58-60-58s-52 18-60 58z" fill="#2b1d16" />}
      {hair === 1 && <path d="M90 240c-20-90 20-140 62-140s84 50 62 140c-6-50-20-86-62-86s-56 36-62 86z" fill="#6b3a1e" />}
      {hair === 2 && <path d="M94 190c4-50 30-80 58-80s54 30 58 80c-20-24-38-34-58-34s-38 10-58 34z" fill="#d9a441" />}
      <circle cx="130" cy="205" r="5" fill="#2b1a2f" />
      <circle cx="170" cy="205" r="5" fill="#2b1a2f" />
      <path d="M134 232q16 14 32 0" fill="none" stroke="#b4574a" strokeWidth="4" strokeLinecap="round" />
    </svg>
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

const NAV = [
  ['discover', 'flame', 'Discover'],
  ['matches', 'chat', 'Matches'],
  ['profile', 'user', 'Profile'],
]
const SCREENS = ['discover', 'matches', 'chat', 'profile', 'filters']
const FILTERS0 = { min: 18, max: 45, dist: 50, tags: [] }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

function initFor(s) {
  if (s === 'chat') return { tab: 'matches', stack: [{ id: 'chat', pid: 'ivy' }] }
  if (s === 'filters') return { tab: 'discover', stack: [{ id: 'filters' }] }
  return { tab: SCREENS.includes(s) ? s : 'discover', stack: [] }
}

const SEED_MSGS = { ivy: [{ id: 'a1', from: 'them', text: 'Hey! Your hiking photo is great.' }] }

// ---------------------------------------------------------------- app

export default function DatingApp({ name = 'Sky', accent = '#ff4d6d', startScreen = 'discover', frame = true, style }) {
  const box = useRef()
  const toastTimer = useRef()
  const timers = useRef([])
  const drag = useRef({ on: false, sx: 0, sy: 0, moved: false })
  const flying = useRef(false)
  const [scale, setScale] = useState(1)
  const init = initFor(startScreen)
  const [tab, setTab] = useState(init.tab)
  const [stack, setStack] = useState(init.stack)
  const [dir, setDir] = useState(1)
  const [toast, setToast] = useState('')
  const [swiped, setSwiped] = useState({ ivy: 'like', june: 'like' })
  const [matches, setMatches] = useState(['ivy', 'june'])
  const [msgs, setMsgs] = useState(SEED_MSGS)
  const [typing, setTyping] = useState({})
  const [filters, setFilters] = useState(FILTERS0)
  const [off, setOff] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const [fly, setFly] = useState(null)
  const [info, setInfo] = useState(false)
  const [popup, setPopup] = useState(null)
  const [last, setLast] = useState([])
  const [text, setText] = useState('')
  const [mine, setMine] = useState({ tags: ['Coffee', 'Music', 'Travel'], visible: true, notify: true })
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const i = initFor(startScreen)
    setTab(i.tab)
    setStack(i.stack)
  }, [startScreen])
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (mq) setReduced(mq.matches)
  }, [])
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
  useEffect(
    () => () => {
      clearTimeout(toastTimer.current)
      timers.current.forEach(clearTimeout)
    },
    []
  )
  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms))

  const top = stack[stack.length - 1]
  const push = (s) => (setDir(1), setStack((a) => [...a, s]))
  const pop = () => (setDir(-1), setStack((a) => a.slice(0, -1)))
  const go = (t) => (setDir(NAV.findIndex((n) => n[0] === t) >= NAV.findIndex((n) => n[0] === tab) ? 1 : -1), setTab(t), setStack([]))
  const person = (id) => PEOPLE.find((p) => p.id === id)

  const deck = PEOPLE.filter((p) => !swiped[p.id] && p.age >= filters.min && p.age <= filters.max && p.dist <= filters.dist && (!filters.tags.length || p.tags.some((t) => filters.tags.includes(t))))
  const cur = deck[0]
  const filtered = filters.min !== 18 || filters.max !== 45 || filters.dist !== 50 || filters.tags.length > 0
  const likedYou = PEOPLE.filter((p) => !swiped[p.id] && p.likesYou).length

  const decide = (p, verdict) => {
    setSwiped((s) => ({ ...s, [p.id]: verdict }))
    setLast((l) => [...l, p.id])
    setOff({ x: 0, y: 0 })
    setFly(null)
    setInfo(false)
    flying.current = false
    if (verdict !== 'nope' && p.likesYou) {
      setMatches((m) => (m.includes(p.id) ? m : [p.id, ...m]))
      setPopup(p)
    }
  }
  const fling = (verdict) => {
    if (!cur || flying.current) return
    const p = cur
    if (reduced) return decide(p, verdict)
    flying.current = true
    setFly(verdict)
    later(() => decide(p, verdict), 280)
  }
  const undo = () => {
    const id = last[last.length - 1]
    if (!id) return say('Nothing to undo')
    setLast((l) => l.slice(0, -1))
    setSwiped((s) => {
      const n = { ...s }
      delete n[id]
      return n
    })
    say(`Brought back ${person(id).name}`)
  }

  const onDown = (e) => {
    if (flying.current) return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    drag.current = { on: true, sx: e.clientX, sy: e.clientY, moved: false }
    setDragging(true)
  }
  const onMove = (e) => {
    const d = drag.current
    if (!d.on) return
    const dx = (e.clientX - d.sx) / scale
    const dy = (e.clientY - d.sy) / scale
    if (Math.abs(dx) + Math.abs(dy) > 6) d.moved = true
    setOff({ x: dx, y: dy })
  }
  const onUp = () => {
    const d = drag.current
    if (!d.on) return
    d.on = false
    setDragging(false)
    if (!d.moved) return setInfo((v) => !v)
    if (off.x > 100) fling('like')
    else if (off.x < -100) fling('nope')
    else setOff({ x: 0, y: 0 })
  }

  const sendMsg = (id, body) => {
    const t = body.trim()
    if (!t) return
    setMsgs((m) => ({ ...m, [id]: [...(m[id] || []), { id: `m${Date.now()}`, from: 'me', text: t }] }))
    setTyping((x) => ({ ...x, [id]: true }))
    later(() => {
      setTyping((x) => ({ ...x, [id]: false }))
      setMsgs((m) => ({ ...m, [id]: [...(m[id] || []), { id: `r${Date.now()}`, from: 'them', text: REPLIES[Math.floor(Math.random() * REPLIES.length)] }] }))
    }, 1500)
  }

  // ---- shared bits
  const header = (title, back, right) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px 6px', minHeight: 50 }}>
      {back && (
        <button type="button" onClick={back} aria-label="Back" style={{ ...iconBtn, width: 38, height: 38, background: CARD, boxShadow: `0 0 0 1px ${LINE}` }}>
          <Icon name="back" size={20} />
        </button>
      )}
      {typeof title === 'string' ? <h1 style={{ margin: 0, flex: 1, fontSize: back ? 18 : 26, fontWeight: 800, letterSpacing: '-0.02em', marginLeft: 4 }}>{title}</h1> : <div style={{ flex: 1, minWidth: 0 }}>{title}</div>}
      {right}
    </div>
  )

  const chip = (label, on, onClick) => (
    <button key={label} type="button" onClick={onClick} aria-pressed={on} style={{ height: 34, padding: '0 14px', borderRadius: 17, border: on ? 'none' : `1px solid ${LINE}`, background: on ? accent : CARD, color: on ? '#fff' : INK, font: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{label}</button>
  )

  const toggle = (on, set, label) => (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => set(!on)} style={{ width: 48, height: 28, borderRadius: 14, border: 'none', padding: 3, background: on ? accent : '#e2d3cc', cursor: 'pointer', transition: 'background .2s' }}>
      <span style={{ display: 'block', width: 22, height: 22, borderRadius: '50%', background: '#fff', transform: `translateX(${on ? 20 : 0}px)`, transition: 'transform .2s' }} />
    </button>
  )

  const roundBtn = (ic, label, color, size, onClick, fill) => (
    <button type="button" onClick={onClick} aria-label={label} style={{ width: size, height: size, borderRadius: '50%', border: 'none', background: CARD, color, display: 'grid', placeItems: 'center', cursor: 'pointer', boxShadow: '0 8px 20px rgba(80,30,50,.16)' }}>
      <Icon name={ic} size={size * 0.46} w={2.4} fill={fill ? color : 'none'} />
    </button>
  )

  const stampStyle = (c, rot) => ({ position: 'absolute', top: 34, padding: '4px 14px', border: `4px solid ${c}`, borderRadius: 10, color: c, fontSize: 34, fontWeight: 900, letterSpacing: '.04em', transform: `rotate(${rot}deg)`, pointerEvents: 'none' })

  const cardFace = (p, interactive, depth) => {
    const dx = interactive ? (fly === 'like' ? 500 : fly === 'nope' ? -500 : off.x) : 0
    const dy = interactive ? (fly === 'super' ? -600 : off.y * 0.4) : 0
    const likeA = interactive ? (fly === 'like' ? 1 : clamp(off.x / 100, 0, 1)) : 0
    const nopeA = interactive ? (fly === 'nope' ? 1 : clamp(-off.x / 100, 0, 1)) : 0
    const superA = interactive && fly === 'super' ? 1 : 0
    return (
      <div
        key={p.id}
        {...(interactive ? { onPointerDown: onDown, onPointerMove: onMove, onPointerUp: onUp, onPointerCancel: onUp } : {})}
        role={interactive ? 'group' : undefined}
        aria-label={interactive ? `${p.name}, ${p.age}. Drag right to like, left to pass, or tap for more.` : undefined}
        style={{ position: 'absolute', inset: 0, borderRadius: 28, overflow: 'hidden', background: CARD, boxShadow: '0 18px 40px rgba(80,30,50,.22)', touchAction: 'none', cursor: interactive ? 'grab' : 'default', userSelect: 'none', transform: interactive ? `translate(${dx}px, ${dy}px) rotate(${dx / 18}deg)` : `scale(${1 - depth * 0.05}) translateY(${depth * 14}px)`, transition: dragging || reduced ? 'none' : 'transform .28s ease', zIndex: 3 - depth }}
      >
        <Portrait p={p} />
        <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, transparent 45%, rgba(30,10,30,${info ? 0.88 : 0.72}))`, transition: 'background .2s' }} />
        <span style={{ ...stampStyle('#22c55e', -14), left: 22, opacity: likeA }}>LIKE</span>
        <span style={{ ...stampStyle('#ef4444', 14), right: 22, opacity: nopeA }}>NOPE</span>
        <span style={{ ...stampStyle('#38bdf8', 0), left: '50%', marginLeft: -62, top: 90, opacity: superA }}>SUPER</span>
        <div style={{ position: 'absolute', left: 20, right: 20, bottom: 18, color: '#fff' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.02em' }}>{p.name}</span>
            <span style={{ fontSize: 24, fontWeight: 500 }}>{p.age}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, opacity: 0.9, marginTop: 2 }}><Icon name="pin" size={14} /> {p.dist} km away{info ? ` · ${p.job}` : ''}</div>
          {info && <p style={{ margin: '8px 0 0', fontSize: 14.5, lineHeight: 1.4 }}>{p.bio}</p>}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
            {p.tags.map((t) => (
              <span key={t} style={{ padding: '4px 11px', borderRadius: 13, background: 'rgba(255,255,255,.22)', fontSize: 12, fontWeight: 600, backdropFilter: 'blur(4px)' }}>{t}</span>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ---- screens
  let body
  let tabbed = true
  if (top?.id === 'chat') {
    tabbed = false
    const p = person(top.pid)
    const thread = msgs[p.id] || []
    body = (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {header(
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 4 }}>
            <Face p={p} size={36} />
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, lineHeight: 1.1 }}>{p.name}</div>
              <div style={{ fontSize: 11.5, color: typing[p.id] ? accent : '#22a55e', fontWeight: 600 }}>{typing[p.id] ? 'typing…' : 'online'}</div>
            </div>
          </div>,
          pop
        )}
        <div className="dt-scroll" style={{ flex: 1, overflowY: 'auto', padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ textAlign: 'center', fontSize: 12, color: MUTED, margin: '4px 0 8px' }}>You matched with {p.name}. Say hi!</div>
          {thread.map((m) => (
            <div key={m.id} style={{ alignSelf: m.from === 'me' ? 'flex-end' : 'flex-start', maxWidth: 260, padding: '10px 14px', borderRadius: m.from === 'me' ? '20px 20px 4px 20px' : '20px 20px 20px 4px', background: m.from === 'me' ? accent : CARD, color: m.from === 'me' ? '#fff' : INK, fontSize: 14.5, boxShadow: m.from === 'me' ? 'none' : `0 0 0 1px ${LINE}` }}>{m.text}</div>
          ))}
          {typing[p.id] && <div style={{ alignSelf: 'flex-start', padding: '10px 14px', borderRadius: '20px 20px 20px 4px', background: CARD, color: MUTED, fontSize: 18, letterSpacing: 2, lineHeight: 0.8, boxShadow: `0 0 0 1px ${LINE}` }}>•••</div>}
        </div>
        <form onSubmit={(e) => (e.preventDefault(), sendMsg(p.id, text), setText(''))} style={{ display: 'flex', gap: 8, padding: '8px 16px 30px' }}>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder={`Message ${p.name}`} aria-label="Message" style={{ flex: 1, minWidth: 0, height: 46, padding: '0 18px', borderRadius: 23, border: `1px solid ${LINE}`, background: CARD, font: 'inherit', fontSize: 14.5, color: INK, outline: 'none' }} />
          <button type="submit" aria-label="Send message" style={{ ...iconBtn, width: 46, height: 46, background: accent, color: '#fff' }}><Icon name="send" size={20} /></button>
        </form>
      </div>
    )
  } else if (top?.id === 'filters') {
    tabbed = false
    const slider = (label, value, min, max, set, fmt) => (
      <div style={{ padding: '10px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 700 }}><span>{label}</span><span style={{ color: accent }}>{fmt}</span></div>
        <input type="range" min={min} max={max} value={value} onChange={(e) => set(+e.target.value)} aria-label={label} style={{ width: '100%', marginTop: 8, accentColor: accent }} />
      </div>
    )
    body = (
      <>
        {header('Filters', pop, <button type="button" onClick={() => (setFilters(FILTERS0), say('Filters reset'))} style={{ border: 'none', background: 'none', font: 'inherit', fontSize: 14, fontWeight: 700, color: accent, cursor: 'pointer', padding: '0 6px' }}>Reset</button>)}
        <div style={{ margin: '6px 20px 0', padding: '4px 18px', background: CARD, borderRadius: 22, boxShadow: `0 0 0 1px ${LINE}` }}>
          {slider('Minimum age', filters.min, 18, 60, (v) => setFilters((f) => ({ ...f, min: Math.min(v, f.max) })), filters.min)}
          {slider('Maximum age', filters.max, 18, 60, (v) => setFilters((f) => ({ ...f, max: Math.max(v, f.min) })), filters.max)}
          {slider('Distance', filters.dist, 1, 50, (v) => setFilters((f) => ({ ...f, dist: v })), `${filters.dist} km`)}
        </div>
        <h2 style={{ margin: '20px 20px 10px', fontSize: 15, fontWeight: 800 }}>Interests</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '0 20px' }}>
          {TAGS.map((t) => chip(t, filters.tags.includes(t), () => setFilters((f) => ({ ...f, tags: f.tags.includes(t) ? f.tags.filter((x) => x !== t) : [...f.tags, t] }))))}
        </div>
        <div style={{ padding: '24px 20px' }}>
          <button type="button" onClick={pop} style={{ width: '100%', height: 52, borderRadius: 26, border: 'none', background: accent, color: '#fff', font: 'inherit', fontSize: 15, fontWeight: 700, cursor: 'pointer', boxShadow: `0 10px 24px ${accent}55` }}>Show {deck.length} {deck.length === 1 ? 'person' : 'people'}</button>
        </div>
      </>
    )
  } else if (tab === 'discover') {
    body = (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {header(
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 4, fontSize: 26, fontWeight: 900, letterSpacing: '-0.03em', color: accent }}><Icon name="flame" size={28} fill={accent} w={1.4} /> spark</div>,
          null,
          <button type="button" onClick={() => push({ id: 'filters' })} aria-label="Filters" style={{ ...iconBtn, width: 42, height: 42, background: CARD, boxShadow: `0 0 0 1px ${LINE}`, position: 'relative' }}>
            <Icon name="sliders" size={20} />
            {filtered && <span style={{ position: 'absolute', top: 7, right: 7, width: 9, height: 9, borderRadius: '50%', background: accent }} />}
          </button>
        )}
        <div style={{ position: 'relative', flex: 1, margin: '6px 18px 0', minHeight: 0 }}>
          {cur ? (
            <>
              {deck.slice(1, 3).reverse().map((p, k, a) => cardFace(p, false, a.length - k))}
              {cardFace(cur, true, 0)}
            </>
          ) : (
            <div style={{ position: 'absolute', inset: 0, borderRadius: 28, border: `2px dashed ${LINE}`, display: 'grid', placeItems: 'center', textAlign: 'center', padding: 30 }}>
              <div>
                <div style={{ fontSize: 40 }}>🔍</div>
                <div style={{ fontSize: 19, fontWeight: 800, marginTop: 8 }}>No one new nearby</div>
                <div style={{ fontSize: 13.5, color: MUTED, margin: '6px 0 18px' }}>{filtered ? 'Try widening your filters.' : 'You have seen everyone. Bring everyone back?'}</div>
                <div style={{ display: 'grid', gap: 8 }}>
                  {filtered && <button type="button" onClick={() => setFilters(FILTERS0)} style={{ height: 44, borderRadius: 22, border: 'none', background: accent, color: '#fff', font: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Reset filters</button>}
                  <button type="button" onClick={() => (setSwiped(matches.reduce((o, id) => ({ ...o, [id]: 'like' }), {})), setLast([]), say('Fresh deck loaded'))} style={{ height: 44, borderRadius: 22, border: `1px solid ${LINE}`, background: CARD, color: INK, font: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Refresh deck</button>
                </div>
              </div>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, padding: '14px 0 8px' }}>
          {roundBtn('undo', 'Undo last swipe', '#f59e0b', 46, undo)}
          {roundBtn('x', 'Nope', '#ef4444', 62, () => fling('nope'))}
          {roundBtn('star', 'Super like', '#38bdf8', 46, () => fling('super'), true)}
          {roundBtn('heart', 'Like', '#22c55e', 62, () => fling('like'), true)}
        </div>
      </div>
    )
  } else if (tab === 'matches') {
    const fresh = matches.filter((id) => !(msgs[id] || []).length)
    const talking = matches.filter((id) => (msgs[id] || []).length)
    body = (
      <>
        {header('Matches')}
        <button type="button" onClick={() => (likedYou ? go('discover') : say('No one new yet'))} style={{ display: 'flex', alignItems: 'center', gap: 10, width: 'calc(100% - 40px)', margin: '4px 20px 0', padding: '12px 16px', borderRadius: 20, border: 'none', background: `linear-gradient(120deg, ${accent}, #ff9a6b)`, color: '#fff', font: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
          <Icon name="heart" size={22} fill="#fff" />
          <span style={{ flex: 1, fontSize: 14, fontWeight: 700 }}>{likedYou} {likedYou === 1 ? 'person likes' : 'people like'} you</span>
          <span style={{ fontSize: 12.5, fontWeight: 600, opacity: 0.9 }}>Swipe now</span>
        </button>
        <h2 style={{ margin: '18px 20px 10px', fontSize: 15, fontWeight: 800 }}>New matches</h2>
        <div className="dt-scroll" style={{ display: 'flex', gap: 14, padding: '0 20px', overflowX: 'auto' }}>
          {fresh.map((id) => (
            <button key={id} type="button" onClick={() => push({ id: 'chat', pid: id })} aria-label={`Chat with ${person(id).name}`} style={{ flex: 'none', border: 'none', background: 'none', padding: 0, cursor: 'pointer', font: 'inherit', color: INK, display: 'grid', justifyItems: 'center', gap: 6 }}>
              <span style={{ padding: 3, borderRadius: '50%', background: `linear-gradient(135deg, ${accent}, #fbbf24)`, display: 'inline-grid' }}><span style={{ padding: 2, borderRadius: '50%', background: BG, display: 'block' }}><Face p={person(id)} size={62} /></span></span>
              <span style={{ fontSize: 12.5, fontWeight: 600 }}>{person(id).name}</span>
            </button>
          ))}
          {!fresh.length && <div style={{ color: MUTED, fontSize: 13, padding: '16px 0' }}>Everyone new has been messaged.</div>}
        </div>
        <h2 style={{ margin: '20px 20px 10px', fontSize: 15, fontWeight: 800 }}>Messages</h2>
        <div style={{ display: 'grid', gap: 8, padding: '0 20px' }}>
          {talking.map((id) => {
            const p = person(id)
            const m = msgs[id][msgs[id].length - 1]
            return (
              <button key={id} type="button" onClick={() => push({ id: 'chat', pid: id })} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', border: 'none', borderRadius: 18, background: CARD, boxShadow: `0 0 0 1px ${LINE}`, font: 'inherit', textAlign: 'left', cursor: 'pointer', color: INK }}>
                <Face p={p} size={48} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 15, fontWeight: 700 }}>{p.name}</span>
                  <span style={{ display: 'block', fontSize: 13, color: MUTED, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.from === 'me' ? 'You: ' : ''}{m.text}</span>
                </span>
                {m.from === 'them' && <span style={{ width: 10, height: 10, borderRadius: '50%', background: accent }} />}
              </button>
            )
          })}
          {!talking.length && <div style={{ color: MUTED, fontSize: 13, padding: '10px 0' }}>No conversations yet. Tap a match to say hi.</div>}
        </div>
      </>
    )
  } else {
    const me = { id: 'me', hue: 350 }
    body = (
      <>
        {header('Profile')}
        <div style={{ textAlign: 'center', padding: '4px 20px 12px' }}>
          <span style={{ padding: 4, borderRadius: '50%', background: `linear-gradient(135deg, ${accent}, #fbbf24)`, display: 'inline-grid' }}><span style={{ padding: 3, borderRadius: '50%', background: BG, display: 'block' }}><Face p={me} size={96} /></span></span>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 10 }}>{name}, 28</div>
          <div style={{ fontSize: 13, color: MUTED }}>Designer · 2 km away</div>
        </div>
        <div style={{ display: 'flex', margin: '0 20px', padding: '12px 0', borderRadius: 20, background: CARD, boxShadow: `0 0 0 1px ${LINE}` }}>
          {[['Likes sent', Object.values(swiped).filter((v) => v !== 'nope').length], ['Matches', matches.length], ['Passed', Object.values(swiped).filter((v) => v === 'nope').length]].map(([l, n]) => (
            <button key={l} type="button" onClick={() => (l === 'Matches' ? go('matches') : say(`${n} ${l.toLowerCase()}`))} style={{ flex: 1, border: 'none', background: 'none', font: 'inherit', cursor: 'pointer', color: INK, display: 'grid', gap: 2 }}>
              <span style={{ fontSize: 20, fontWeight: 800 }}>{n}</span>
              <span style={{ fontSize: 12, color: MUTED }}>{l}</span>
            </button>
          ))}
        </div>
        <h2 style={{ margin: '18px 20px 10px', fontSize: 15, fontWeight: 800 }}>My interests</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '0 20px' }}>
          {TAGS.map((t) => chip(t, mine.tags.includes(t), () => setMine((m) => ({ ...m, tags: m.tags.includes(t) ? m.tags.filter((x) => x !== t) : [...m.tags, t] }))))}
        </div>
        <div style={{ margin: '18px 20px 0', padding: '2px 16px', background: CARD, borderRadius: 20, boxShadow: `0 0 0 1px ${LINE}` }}>
          {[['visible', 'Show me on Discover'], ['notify', 'Match notifications']].map(([k, l], n) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 0', borderTop: n ? `1px solid ${LINE}` : 'none', fontSize: 14, fontWeight: 600 }}>
              {l}
              {toggle(mine[k], (v) => (setMine((m) => ({ ...m, [k]: v })), say(`${l}: ${v ? 'on' : 'off'}`)), l)}
            </div>
          ))}
          <button type="button" onClick={() => push({ id: 'filters' })} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '13px 0', border: 'none', borderTop: `1px solid ${LINE}`, background: 'none', font: 'inherit', fontSize: 14, fontWeight: 600, color: INK, cursor: 'pointer' }}>Discovery filters<Icon name="sliders" size={18} color={accent} /></button>
        </div>
        <div style={{ padding: '14px 20px' }}>
          <button type="button" onClick={() => (setSwiped({ ivy: 'like', june: 'like' }), setMatches(['ivy', 'june']), setMsgs(SEED_MSGS), setFilters(FILTERS0), setLast([]), say('Demo reset'))} style={{ width: '100%', height: 46, borderRadius: 23, border: 'none', background: '#f7e6dd', color: INK, font: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Reset demo</button>
        </div>
      </>
    )
  }

  const phone = (
    <div style={{ position: 'relative', width: W, height: H, overflow: 'hidden', borderRadius: frame ? 46 : 0, background: `linear-gradient(180deg, ${BG}, #ffeae0)`, color: INK, fontFamily: "-apple-system, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif" }}>
      <style>{`
        @keyframes dt-r { from { opacity: 0; transform: translateX(34px) } to { opacity: 1; transform: none } }
        @keyframes dt-l { from { opacity: 0; transform: translateX(-34px) } to { opacity: 1; transform: none } }
        @keyframes dt-pop { from { transform: scale(.7); opacity: 0 } to { transform: none; opacity: 1 } }
        .dt-scroll { scrollbar-width: none } .dt-scroll::-webkit-scrollbar { display: none }
        .dt-app button:focus-visible, .dt-app input:focus-visible { outline: 2px solid ${accent}; outline-offset: 2px }
        @media (prefers-reduced-motion: reduce) { .dt-page, .dt-pop { animation: none !important } .dt-app * { transition: none !important } }
      `}</style>
      <StatusBar frame={frame} />
      <div key={`${tab}/${stack.map((s) => s.id + (s.pid || '')).join('/')}`} className="dt-scroll dt-page" style={{ position: 'absolute', top: 54, bottom: tabbed ? 88 : 0, left: 0, right: 0, overflowY: tab === 'discover' && !top || top?.id === 'chat' ? 'hidden' : 'auto', paddingBottom: tab === 'discover' && !top || top?.id === 'chat' ? 0 : 24, animation: reduced ? 'none' : `${dir > 0 ? 'dt-r' : 'dt-l'} .28s ease` }}>
        {body}
      </div>
      {tabbed && (
        <nav aria-label="Main" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 88, background: CARD, borderRadius: '26px 26px 0 0', boxShadow: '0 -6px 20px rgba(80,30,50,.08)', display: 'flex', justifyContent: 'space-around', padding: '10px 8px 0' }}>
          {NAV.map(([id, icon, label]) => (
            <button key={id} type="button" onClick={() => go(id)} aria-current={tab === id ? 'page' : undefined} style={{ border: 'none', background: 'none', font: 'inherit', cursor: 'pointer', display: 'grid', justifyItems: 'center', alignContent: 'start', gap: 3, width: 76, height: 54, fontSize: 11, fontWeight: 600, color: tab === id ? accent : MUTED, position: 'relative' }}>
              <Icon name={icon} size={23} fill={tab === id && id === 'discover' ? accent : 'none'} />
              {label}
              {id === 'matches' && matches.some((m) => !(msgs[m] || []).length) && <span style={{ position: 'absolute', top: 0, right: 22, width: 9, height: 9, borderRadius: '50%', background: accent }} />}
            </button>
          ))}
        </nav>
      )}
      {popup && (
        <div role="dialog" aria-label="It's a match" style={{ position: 'absolute', inset: 0, zIndex: 35, background: 'linear-gradient(160deg, rgba(255,77,109,.96), rgba(120,40,110,.96))', display: 'grid', placeItems: 'center', textAlign: 'center', color: '#fff', padding: 30 }}>
          <div className="dt-pop" style={{ animation: 'dt-pop .45s cubic-bezier(.2,1.4,.4,1) both' }}>
            <div style={{ fontSize: 40, fontWeight: 900, letterSpacing: '-0.03em', fontStyle: 'italic' }}>It's a match!</div>
            <div style={{ fontSize: 14, opacity: 0.9, margin: '6px 0 26px' }}>You and {popup.name} like each other.</div>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <span style={{ border: '4px solid #fff', borderRadius: '50%', transform: 'rotate(-8deg)' }}><Face p={{ id: 'me', hue: 350 }} size={110} /></span>
              <span style={{ border: '4px solid #fff', borderRadius: '50%', marginLeft: -16, transform: 'rotate(8deg)' }}><Face p={popup} size={110} /></span>
            </div>
            <div style={{ display: 'grid', gap: 10, marginTop: 34 }}>
              <button type="button" onClick={() => { const id = popup.id; setPopup(null); setDir(1); setTab('matches'); setStack([{ id: 'chat', pid: id }]) }} style={{ height: 50, borderRadius: 25, border: 'none', background: '#fff', color: accent, font: 'inherit', fontSize: 15, fontWeight: 800, cursor: 'pointer' }}>Send a message</button>
              <button type="button" onClick={() => setPopup(null)} style={{ height: 46, borderRadius: 23, border: '1.5px solid rgba(255,255,255,.7)', background: 'none', color: '#fff', font: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Keep swiping</button>
            </div>
          </div>
        </div>
      )}
      <div role="status" style={{ position: 'absolute', left: '50%', top: 58, zIndex: 50, transform: `translate(-50%, ${toast ? 0 : -90}px)`, transition: 'transform .35s cubic-bezier(.2,.8,.2,1)', padding: '10px 16px', borderRadius: 20, background: INK, color: '#fff', fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap' }}>{toast}</div>
      <div style={{ position: 'absolute', left: '50%', bottom: 8, width: 140, height: 5, marginLeft: -70, borderRadius: 3, background: INK, opacity: 0.8, zIndex: 45 }} />
    </div>
  )

  return (
    <div ref={box} className="dt-app" style={{ position: 'relative', width: '100%', height: '100%', display: 'grid', placeItems: 'center', overflow: 'hidden', background: 'radial-gradient(ellipse at 50% 30%, #ffe1d2, #e9a9a9 75%)', ...style }}>
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: `translate(-50%, -50%) scale(${scale})`, transformOrigin: 'center' }}>
        {frame ? (
          <div style={{ padding: 12, borderRadius: 58, background: 'linear-gradient(145deg, #3a3f4a, #14171d 40%, #2b2f38)', boxShadow: '0 40px 80px rgba(80,30,50,.35), inset 0 0 0 2px #4b515e' }}>
            <div style={{ padding: 2, borderRadius: 48, background: '#000' }}>{phone}</div>
          </div>
        ) : (
          phone
        )}
      </div>
    </div>
  )
}
