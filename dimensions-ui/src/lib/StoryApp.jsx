import { useEffect, useRef, useState } from 'react'

// A stories app on a phone, as a click-through prototype, in a dark, glowing
// look. Tabs: Feed (a ring row plus story cards), Create and Profile. Tapping
// a ring or card opens the full-screen Story player: segmented progress bars
// auto-advance (and roll into the next person), press and hold pauses, tap
// the left edge to go back and the right to go forward. "Send message" opens
// Reply, where messages (and quick emoji) are sent, marked Sent then Seen,
// and answered. Create builds a story from a backdrop, caption and sticker and
// adds it to your ring on the Feed. Timers are cleared when the app unmounts.

const W = 390
const H = 844
const INK = '#f4f1fa'
const MUTED = '#9a93b0'
const BG = '#0f0c18'
const CARD = '#1a1626'
const LINE = '#2a2438'
const DUR = 5000 // ms per slide

const BACKS = [
  ['#ff7a59', '#7c3aed'],
  ['#22d3ee', '#4f46e5'],
  ['#f472b6', '#fb923c'],
  ['#34d399', '#0ea5e9'],
  ['#fbbf24', '#ef4444'],
  ['#a78bfa', '#1e1b4b'],
]
const KINDS = ['sun', 'wave', 'peak', 'city', 'bloom']
const slide = (b, kind, text) => ({ id: `s${Math.random().toString(36).slice(2, 8)}`, b: BACKS[b], kind, text })

const USERS0 = [
  { id: 'you', name: 'You', hue: 262, slides: [slide(0, 'sun', 'Golden hour from my window')] },
  { id: 'nova', name: 'Nova', hue: 330, slides: [slide(2, 'sun', 'Beach day, finally'), slide(1, 'wave', 'Water was freezing'), slide(4, 'bloom', 'Sunset ritual')] },
  { id: 'kai', name: 'Kai', hue: 200, slides: [slide(1, 'peak', 'Summit at 6am'), slide(3, 'peak', 'Worth every step')] },
  { id: 'remy', name: 'Remy', hue: 150, slides: [slide(5, 'city', 'Night drive playlist'), slide(0, 'city', 'Neon everywhere'), slide(2, 'bloom', 'Late snack run')] },
  { id: 'sana', name: 'Sana', hue: 40, slides: [slide(3, 'bloom', 'Studio plants are thriving')] },
  { id: 'ode', name: 'Ode', hue: 290, slides: [slide(4, 'wave', 'Surf check'), slide(5, 'sun', 'Last light')] },
]
const REPLIES = ['Haha love this', 'Wait that is amazing', 'Send more photos!', 'Same energy 100%', 'Okay now I am jealous']
const EMOJI = ['🔥', '😍', '😂', '👏', '😮']

const ICONS = {
  home: 'M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z',
  plus: 'M12 5v14M5 12h14',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 20a8 8 0 0 1 16 0',
  back: 'M15 5l-7 7 7 7',
  x: 'M6 6l12 12M18 6L6 18',
  heart: 'M12 20s-7-4.4-9-9.2C1.8 7.3 4 4.5 7 4.5c2 0 3.6 1.1 5 3 1.4-1.9 3-3 5-3 3 0 5.2 2.8 4 6.3-2 4.8-9 9.2-9 9.2z',
  send: 'M4 12l16-8-6 16-3-7z',
  bell: 'M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4',
  check: 'M5 12l5 5 9-10',
  pause: 'M8 5v14M16 5v14',
  trash: 'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13',
}

function Icon({ name, size = 22, color = 'currentColor', w = 1.9, fill = 'none' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  )
}

const iconBtn = { display: 'grid', placeItems: 'center', border: 'none', borderRadius: '50%', cursor: 'pointer', padding: 0, background: 'transparent', color: INK }

function Face({ u, size = 56 }) {
  const h = u.hue
  const hair = u.id.length % 3
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" style={{ display: 'block', borderRadius: '50%' }} aria-hidden="true">
      <defs>
        <linearGradient id={`fa-${u.id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={`hsl(${h} 85% 70%)`} />
          <stop offset="1" stopColor={`hsl(${(h + 50) % 360} 75% 45%)`} />
        </linearGradient>
      </defs>
      <rect width="48" height="48" fill={`url(#fa-${u.id})`} />
      <path d="M6 48c1-10 8-14 18-14s17 4 18 14z" fill={`hsl(${h} 40% 20%)`} />
      <circle cx="24" cy="21" r="8.5" fill="#f1c9a5" />
      {hair === 0 && <path d="M15 20c0-8 5-11 10-11s9 3 8 11c-2-4-5-5-9-5s-7 1-9 5z" fill="#231812" />}
      {hair === 1 && <path d="M14.5 24c-2-10 4-15 10-15s11 5 9 15c-1-5-3-8-9-8s-8 3-10 8z" fill="#7a4524" />}
      {hair === 2 && <path d="M15 19c1-6 5-9 9-9s8 3 9 9c-3-2-6-3-9-3s-6 1-9 3z" fill="#e5b04a" />}
    </svg>
  )
}

// a story ring: gradient when unseen, grey once viewed
function Ring({ u, size = 64, seen, accent, plus }) {
  return (
    <span style={{ position: 'relative', display: 'inline-grid', padding: 3, borderRadius: '50%', background: seen ? '#3a3450' : `conic-gradient(${accent}, #f59e0b, #ec4899, ${accent})`, flex: 'none' }}>
      <span style={{ display: 'block', padding: 2.5, borderRadius: '50%', background: BG }}>
        <Face u={u} size={size} />
      </span>
      {plus && (
        <span style={{ position: 'absolute', right: -2, bottom: -2, width: 22, height: 22, borderRadius: '50%', display: 'grid', placeItems: 'center', background: accent, color: '#fff', border: `2px solid ${BG}` }}>
          <Icon name="plus" size={13} w={2.8} />
        </span>
      )}
    </span>
  )
}

// the picture behind a story, drawn from gradients and shapes
function Scene({ s, id }) {
  const [a, b] = s.b
  return (
    <svg viewBox="0 0 390 700" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" style={{ display: 'block' }} aria-hidden="true">
      <defs>
        <linearGradient id={`sg-${id}`} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor={a} />
          <stop offset="1" stopColor={b} />
        </linearGradient>
      </defs>
      <rect width="390" height="700" fill={`url(#sg-${id})`} />
      {s.kind === 'sun' && (
        <>
          <circle cx="195" cy="300" r="92" fill="#fff" opacity=".85" />
          <circle cx="195" cy="300" r="130" fill="#fff" opacity=".15" />
          <path d="M0 470q100-50 195-10t195-30v270H0z" fill="#000" opacity=".3" />
        </>
      )}
      {s.kind === 'wave' && (
        <>
          <path d="M0 360q60-40 130 0t130 0 130 0v340H0z" fill="#fff" opacity=".22" />
          <path d="M0 440q60-40 130 0t130 0 130 0v260H0z" fill="#000" opacity=".22" />
          <path d="M0 530q60-40 130 0t130 0 130 0v170H0z" fill="#000" opacity=".3" />
        </>
      )}
      {s.kind === 'peak' && (
        <>
          <path d="M0 520L120 320l80 120 100-200 90 160v300H0z" fill="#000" opacity=".35" />
          <path d="M300 240l-34 60h68z" fill="#fff" opacity=".8" />
          <circle cx="90" cy="150" r="34" fill="#fff" opacity=".7" />
        </>
      )}
      {s.kind === 'city' && (
        <>
          {[[20, 380, 60], [90, 300, 70], [170, 420, 50], [230, 270, 80], [320, 360, 60]].map(([x, y, w], i) => (
            <rect key={i} x={x} y={y} width={w} height={700 - y} fill="#000" opacity=".45" />
          ))}
          {[[40, 410], [110, 330], [250, 300], [340, 390], [190, 450]].map(([x, y], i) => (
            <rect key={i} x={x} y={y} width="14" height="14" fill="#fde68a" opacity=".85" />
          ))}
        </>
      )}
      {s.kind === 'bloom' && (
        <g transform="translate(195 340)">
          {[0, 60, 120, 180, 240, 300].map((r) => (
            <ellipse key={r} rx="38" ry="90" transform={`rotate(${r}) translate(0 -70)`} fill="#fff" opacity=".35" />
          ))}
          <circle r="34" fill="#fde68a" />
        </g>
      )}
    </svg>
  )
}

function StatusBar({ frame }) {
  const clock = new Date().toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' })
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 40, height: 54, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 30px 0 36px', fontSize: 16, fontWeight: 600, color: '#fff', pointerEvents: 'none' }}>
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

// ------------------------------------------------------------ player

function Player({ users, u, i, setCur, onClose, onReply, onView, liked, toggleLike, accent }) {
  const order = users.filter((x) => x.slides.length).map((x) => x.id)
  const user = users.find((x) => x.id === u) || users[0]
  const s = user.slides[Math.min(i, user.slides.length - 1)]
  const [p, setP] = useState(0)
  const [held, setHeld] = useState(false)
  const pRef = useRef(0)
  const heldRef = useRef(false)
  const downAt = useRef(0)
  const nav = useRef({})

  const next = () => {
    if (i < user.slides.length - 1) return setCur({ u, i: i + 1 })
    const nu = order[order.indexOf(u) + 1]
    if (nu) setCur({ u: nu, i: 0 })
    else onClose()
  }
  const prev = () => {
    if (i > 0) return setCur({ u, i: i - 1 })
    const pu = order[order.indexOf(u) - 1]
    if (pu) setCur({ u: pu, i: 0 })
    else (pRef.current = 0, setP(0))
  }
  nav.current = { next, prev }

  useEffect(() => {
    pRef.current = 0
    setP(0)
  }, [u, i])
  useEffect(() => onView(u), [u]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const t = setInterval(() => {
      if (heldRef.current) return
      pRef.current += 50 / DUR
      if (pRef.current >= 1) {
        pRef.current = 0
        nav.current.next()
      }
      setP(pRef.current)
    }, 50)
    return () => clearInterval(t)
  }, [])

  const key = `${u}:${i}`
  const release = (go, x, w) => {
    heldRef.current = false
    setHeld(false)
    if (go && Date.now() - downAt.current < 240) (x < w * 0.35 ? prev : next)()
  }

  return (
    <div style={{ position: 'absolute', inset: 0, background: '#000' }}>
      <div style={{ position: 'absolute', inset: 0 }}>
        <Scene s={s} id={`p${key}`} />
      </div>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,.45), transparent 22%, transparent 70%, rgba(0,0,0,.5))' }} />
      {s.text && (
        <div style={{ position: 'absolute', left: 28, right: 28, top: '58%', textAlign: 'center', fontSize: 28, fontWeight: 800, lineHeight: 1.15, color: '#fff', textShadow: '0 2px 18px rgba(0,0,0,.45)', letterSpacing: '-0.02em' }}>
          {s.text}
          {s.sticker && <div style={{ fontSize: 54, marginTop: 12 }}>{s.sticker}</div>}
        </div>
      )}
      {/* tap / hold layer */}
      <div
        role="presentation"
        style={{ position: 'absolute', inset: 0, touchAction: 'none', cursor: 'pointer' }}
        onPointerDown={() => ((downAt.current = Date.now()), (heldRef.current = true), setHeld(true))}
        onPointerUp={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          release(true, e.clientX - r.left, r.width)
        }}
        onPointerLeave={() => heldRef.current && release(false)}
        onPointerCancel={() => release(false)}
      />
      {/* progress */}
      <div style={{ position: 'absolute', top: 58, left: 12, right: 12, display: 'flex', gap: 4, pointerEvents: 'none' }} role="progressbar" aria-valuemin={0} aria-valuemax={user.slides.length} aria-valuenow={i + 1}>
        {user.slides.map((x, k) => (
          <span key={x.id} style={{ flex: 1, height: 3, borderRadius: 2, background: 'rgba(255,255,255,.35)', overflow: 'hidden' }}>
            <span style={{ display: 'block', height: '100%', background: '#fff', width: `${k < i ? 100 : k === i ? p * 100 : 0}%` }} />
          </span>
        ))}
      </div>
      <div style={{ position: 'absolute', top: 72, left: 14, right: 14, display: 'flex', alignItems: 'center', gap: 10, pointerEvents: 'none' }}>
        <Face u={user} size={34} />
        <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{user.name}</span>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,.75)' }}>{i + 1 === user.slides.length ? 'just now' : `${(i + 1) * 3}h`}</span>
        <span style={{ flex: 1 }} />
        {held && <span style={{ display: 'flex', color: '#fff' }}><Icon name="pause" size={18} /></span>}
        <button type="button" onClick={onClose} aria-label="Close story" style={{ ...iconBtn, width: 36, height: 36, color: '#fff', pointerEvents: 'auto' }}>
          <Icon name="x" size={22} />
        </button>
      </div>
      {/* reply bar */}
      <div style={{ position: 'absolute', left: 14, right: 14, bottom: 26, display: 'flex', gap: 10, alignItems: 'center' }}>
        <button type="button" onClick={onReply} style={{ flex: 1, height: 46, borderRadius: 23, border: '1.5px solid rgba(255,255,255,.7)', background: 'rgba(0,0,0,.25)', color: '#fff', font: 'inherit', fontSize: 14, fontWeight: 600, textAlign: 'left', padding: '0 18px', cursor: 'pointer' }}>
          {user.id === 'you' ? 'Viewers can reply here' : `Send message to ${user.name}`}
        </button>
        <button type="button" onClick={() => toggleLike(key)} aria-pressed={!!liked[key]} aria-label="Like story" style={{ ...iconBtn, width: 46, height: 46, color: liked[key] ? '#fb7185' : '#fff' }}>
          <Icon name="heart" size={28} fill={liked[key] ? '#fb7185' : 'none'} />
        </button>
        <button type="button" onClick={onReply} aria-label="Send" style={{ ...iconBtn, width: 46, height: 46, color: '#fff', background: accent }}>
          <Icon name="send" size={20} />
        </button>
      </div>
    </div>
  )
}

const NAV = [
  ['feed', 'home', 'Feed'],
  ['create', 'plus', 'Create'],
  ['profile', 'user', 'Profile'],
]
const SCREENS = ['feed', 'player', 'reply', 'profile', 'create']

function initFor(s) {
  if (s === 'player') return { tab: 'feed', stack: [{ id: 'player' }], cur: { u: 'nova', i: 0 } }
  if (s === 'reply') return { tab: 'feed', stack: [{ id: 'player' }, { id: 'reply' }], cur: { u: 'nova', i: 0 } }
  return { tab: SCREENS.includes(s) ? s : 'feed', stack: [], cur: { u: 'nova', i: 0 } }
}

// ---------------------------------------------------------------- app

export default function StoryApp({ name = 'You', accent = '#ec4899', startScreen = 'feed', frame = true, style }) {
  const box = useRef()
  const toastTimer = useRef()
  const timers = useRef([])
  const [scale, setScale] = useState(1)
  const init = initFor(startScreen)
  const [tab, setTab] = useState(init.tab)
  const [stack, setStack] = useState(init.stack)
  const [cur, setCur] = useState(init.cur)
  const [dir, setDir] = useState(1)
  const [toast, setToast] = useState('')
  const [users, setUsers] = useState(USERS0)
  const [viewed, setViewed] = useState({})
  const [liked, setLiked] = useState({})
  const [msgs, setMsgs] = useState({})
  const [text, setText] = useState('')
  const [draft, setDraft] = useState({ b: 0, kind: 'sun', text: '', sticker: '' })
  const [prefs, setPrefs] = useState({ sound: true, archive: true, mute: false })
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const i = initFor(startScreen)
    setTab(i.tab)
    setStack(i.stack)
    setCur(i.cur)
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
  const open = (u, i = 0) => (setCur({ u, i }), push({ id: 'player' }))
  const toggleLike = (k) => setLiked((l) => ({ ...l, [k]: !l[k] }))
  const markViewed = (u) => setViewed((v) => (v[u] ? v : { ...v, [u]: true }))
  const me = users[0]
  const target = users.find((x) => x.id === cur.u) || users[1]

  const sendMsg = (uid, body) => {
    const t = body.trim()
    if (!t) return
    const id = `m${Date.now()}${Math.random()}`
    setMsgs((m) => ({ ...m, [uid]: [...(m[uid] || []), { id, text: t, from: 'me', state: 'sent' }] }))
    later(() => setMsgs((m) => ({ ...m, [uid]: (m[uid] || []).map((x) => (x.id === id ? { ...x, state: 'seen' } : x)) })), 1300)
    if (uid !== 'you') later(() => setMsgs((m) => ({ ...m, [uid]: [...(m[uid] || []), { id: `r${id}`, text: REPLIES[Math.floor(Math.random() * REPLIES.length)], from: 'them' }] })), 2400)
  }

  const shareStory = () => {
    const s = { id: `s${Date.now()}`, b: BACKS[draft.b], kind: draft.kind, text: draft.text.trim(), sticker: draft.sticker }
    setUsers((a) => a.map((x) => (x.id === 'you' ? { ...x, slides: [...x.slides, s] } : x)))
    setViewed((v) => ({ ...v, you: false }))
    setDraft({ b: 0, kind: 'sun', text: '', sticker: '' })
    go('feed')
    say('Story shared to your ring')
  }

  // ---- shared bits
  const header = (title, back, right) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px 6px', minHeight: 50 }}>
      {back && (
        <button type="button" onClick={back} aria-label="Back" style={{ ...iconBtn, width: 38, height: 38, background: CARD }}>
          <Icon name="back" size={20} />
        </button>
      )}
      <h1 style={{ margin: 0, flex: 1, fontSize: back ? 18 : 26, fontWeight: 800, letterSpacing: '-0.02em', marginLeft: 4 }}>{title}</h1>
      {right}
    </div>
  )

  const toggle = (on, set, label) => (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => set(!on)} style={{ width: 48, height: 28, borderRadius: 14, border: 'none', padding: 3, background: on ? accent : '#3a3450', cursor: 'pointer', transition: 'background .2s' }}>
      <span style={{ display: 'block', width: 22, height: 22, borderRadius: '50%', background: '#fff', transform: `translateX(${on ? 20 : 0}px)`, transition: 'transform .2s' }} />
    </button>
  )

  // ---- screens
  let body
  let tabbed = true
  let full = false
  if (top?.id === 'reply') {
    tabbed = false
    const thread = msgs[target.id] || []
    const sl = target.slides[Math.min(cur.i, target.slides.length - 1)]
    const lastMine = [...thread].reverse().find((m) => m.from === 'me')
    body = (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {header(`Reply to ${target.name}`, pop)}
        <div className="st-scroll" style={{ flex: 1, overflowY: 'auto', padding: '6px 16px' }}>
          <div style={{ width: 120, height: 190, margin: '0 auto 14px', borderRadius: 18, overflow: 'hidden', position: 'relative', boxShadow: '0 10px 30px rgba(0,0,0,.5)' }}>
            <Scene s={sl} id={`r${target.id}${cur.i}`} />
            <div style={{ position: 'absolute', left: 8, right: 8, bottom: 12, fontSize: 11, fontWeight: 800, textAlign: 'center', color: '#fff', textShadow: '0 1px 8px rgba(0,0,0,.5)' }}>{sl.text}</div>
          </div>
          <div style={{ textAlign: 'center', fontSize: 12, color: MUTED, marginBottom: 12 }}>Replying to this story</div>
          <div style={{ display: 'grid', gap: 6 }}>
            {thread.map((m) => (
              <div key={m.id} style={{ justifySelf: m.from === 'me' ? 'end' : 'start', maxWidth: 260 }}>
                <div style={{ padding: '9px 14px', borderRadius: m.from === 'me' ? '18px 18px 4px 18px' : '18px 18px 18px 4px', background: m.from === 'me' ? accent : CARD, color: '#fff', fontSize: 14.5 }}>{m.text}</div>
                {m === lastMine && <div style={{ textAlign: 'right', fontSize: 11, color: MUTED, marginTop: 3 }}>{m.state === 'seen' ? 'Seen' : 'Sent'}</div>}
              </div>
            ))}
          </div>
        </div>
        <div style={{ padding: '8px 16px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            {EMOJI.map((e) => (
              <button key={e} type="button" onClick={() => sendMsg(target.id, e)} aria-label={`Send ${e}`} style={{ width: 52, height: 44, borderRadius: 22, border: `1px solid ${LINE}`, background: CARD, fontSize: 22, cursor: 'pointer' }}>{e}</button>
            ))}
          </div>
          <form onSubmit={(e) => (e.preventDefault(), sendMsg(target.id, text), setText(''))} style={{ display: 'flex', gap: 8, paddingBottom: 30 }}>
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder={`Message ${target.name}`} aria-label="Message" style={{ flex: 1, minWidth: 0, height: 46, padding: '0 18px', borderRadius: 23, border: `1px solid ${LINE}`, background: CARD, font: 'inherit', fontSize: 14.5, color: INK, outline: 'none' }} />
            <button type="submit" aria-label="Send message" style={{ ...iconBtn, width: 46, height: 46, background: accent, color: '#fff' }}><Icon name="send" size={20} /></button>
          </form>
        </div>
      </div>
    )
  } else if (top?.id === 'player') {
    tabbed = false
    full = true
    body = <Player users={users} u={cur.u} i={cur.i} setCur={setCur} onClose={pop} onReply={() => push({ id: 'reply' })} onView={markViewed} liked={liked} toggleLike={toggleLike} accent={accent} />
  } else if (tab === 'feed') {
    const withStories = users.filter((x) => x.slides.length)
    body = (
      <>
        {header('Stories', null, <button type="button" onClick={() => say(prefs.mute ? 'Notifications are muted' : 'No new notifications')} aria-label="Notifications" style={{ ...iconBtn, width: 40, height: 40, background: CARD }}><Icon name="bell" size={20} /></button>)}
        <div className="st-scroll" style={{ display: 'flex', gap: 14, padding: '8px 16px 14px', overflowX: 'auto' }}>
          {users.map((x) => {
            const mine = x.id === 'you'
            const none = !x.slides.length
            return (
              <button key={x.id} type="button" onClick={() => (none ? go('create') : open(x.id))} aria-label={mine ? 'Your story' : `${x.name}'s story`} style={{ flex: 'none', border: 'none', background: 'none', padding: 0, font: 'inherit', cursor: 'pointer', display: 'grid', justifyItems: 'center', gap: 6, color: INK, width: 74 }}>
                <Ring u={x} size={58} seen={!!viewed[x.id] || none} accent={accent} plus={mine} />
                <span style={{ fontSize: 12, fontWeight: 600, color: viewed[x.id] ? MUTED : INK }}>{mine ? 'Your story' : x.name}</span>
              </button>
            )
          })}
        </div>
        <h2 style={{ margin: '4px 20px 10px', fontSize: 15, fontWeight: 800 }}>Latest</h2>
        <div style={{ display: 'grid', gap: 14, padding: '0 20px' }}>
          {withStories.filter((x) => x.id !== 'you').map((x) => {
            const last = x.slides[x.slides.length - 1]
            return (
              <button key={x.id} type="button" onClick={() => open(x.id)} aria-label={`Open ${x.name}'s stories`} style={{ position: 'relative', height: 170, padding: 0, border: 'none', borderRadius: 22, overflow: 'hidden', cursor: 'pointer', textAlign: 'left', background: CARD, boxShadow: viewed[x.id] ? 'none' : `0 0 0 2px ${accent}` }}>
                <div style={{ position: 'absolute', inset: 0, filter: viewed[x.id] ? 'saturate(.4) brightness(.8)' : 'none' }}><Scene s={last} id={`c${x.id}`} /></div>
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,.35), transparent 40%, rgba(0,0,0,.6))' }} />
                <div style={{ position: 'absolute', left: 14, top: 14, display: 'flex', alignItems: 'center', gap: 8, color: '#fff' }}>
                  <Face u={x} size={30} />
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{x.name}</span>
                </div>
                <div style={{ position: 'absolute', right: 14, top: 18, fontSize: 11, fontWeight: 700, color: '#fff', padding: '3px 9px', borderRadius: 10, background: 'rgba(0,0,0,.4)' }}>{x.slides.length} {x.slides.length === 1 ? 'story' : 'stories'}</div>
                <div style={{ position: 'absolute', left: 14, right: 14, bottom: 12, fontSize: 15, fontWeight: 700, color: '#fff' }}>{last.text}</div>
              </button>
            )
          })}
        </div>
      </>
    )
  } else if (tab === 'create') {
    const preview = { b: BACKS[draft.b], kind: draft.kind, text: draft.text, sticker: draft.sticker }
    body = (
      <>
        {header('New story')}
        <div style={{ position: 'relative', width: 200, height: 310, margin: '4px auto 0', borderRadius: 24, overflow: 'hidden', boxShadow: '0 14px 36px rgba(0,0,0,.5)' }}>
          <Scene s={preview} id="cr" />
          <div style={{ position: 'absolute', left: 14, right: 14, top: '56%', textAlign: 'center', fontSize: 19, fontWeight: 800, color: '#fff', lineHeight: 1.15, textShadow: '0 2px 12px rgba(0,0,0,.45)' }}>
            {draft.text || <span style={{ opacity: 0.55 }}>Your caption</span>}
            {draft.sticker && <div style={{ fontSize: 38, marginTop: 6 }}>{draft.sticker}</div>}
          </div>
        </div>
        <div style={{ padding: '16px 20px 0', display: 'grid', gap: 12 }}>
          <input value={draft.text} maxLength={40} onChange={(e) => setDraft({ ...draft, text: e.target.value })} placeholder="Add a caption" aria-label="Caption" style={{ height: 46, padding: '0 16px', borderRadius: 16, border: `1px solid ${LINE}`, background: CARD, font: 'inherit', fontSize: 14.5, color: INK, outline: 'none' }} />
          <div style={{ display: 'flex', gap: 10 }} role="group" aria-label="Backdrop">
            {BACKS.map((b, k) => (
              <button key={k} type="button" onClick={() => setDraft({ ...draft, b: k })} aria-label={`Backdrop ${k + 1}`} aria-pressed={draft.b === k} style={{ width: 38, height: 38, borderRadius: '50%', border: draft.b === k ? '3px solid #fff' : `3px solid ${BG}`, background: `linear-gradient(135deg, ${b[0]}, ${b[1]})`, cursor: 'pointer', padding: 0 }} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }} className="st-scroll" role="group" aria-label="Scene">
            {KINDS.map((k) => (
              <button key={k} type="button" onClick={() => setDraft({ ...draft, kind: k })} aria-pressed={draft.kind === k} style={{ flex: 'none', height: 34, padding: '0 14px', borderRadius: 17, border: 'none', background: draft.kind === k ? accent : CARD, color: '#fff', font: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize' }}>{k}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }} role="group" aria-label="Sticker">
            {['', '🔥', '✨', '😎', '🌈', '☕'].map((e) => (
              <button key={e || 'none'} type="button" onClick={() => setDraft({ ...draft, sticker: e })} aria-pressed={draft.sticker === e} style={{ width: 46, height: 40, borderRadius: 14, border: `1.5px solid ${draft.sticker === e ? accent : LINE}`, background: CARD, color: MUTED, fontSize: e ? 20 : 12, cursor: 'pointer', font: 'inherit' }}>{e || 'None'}</button>
            ))}
          </div>
          <button type="button" onClick={shareStory} style={{ height: 50, borderRadius: 25, border: 'none', background: accent, color: '#fff', font: 'inherit', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>Share to your story</button>
        </div>
      </>
    )
  } else {
    body = (
      <>
        {header('Profile')}
        <div style={{ textAlign: 'center', padding: '6px 20px 14px' }}>
          <Ring u={me} size={76} seen={!!viewed.you || !me.slides.length} accent={accent} />
          <div style={{ fontSize: 20, fontWeight: 800, marginTop: 10 }}>{name}</div>
          <div style={{ fontSize: 13, color: MUTED }}>{me.slides.length} {me.slides.length === 1 ? 'story' : 'stories'} live · {viewed.you ? 'seen by you' : 'unseen'}</div>
        </div>
        <div style={{ display: 'flex', gap: 10, padding: '0 20px' }}>
          <button type="button" onClick={() => (me.slides.length ? open('you') : say('No stories yet. Create one!'))} style={{ flex: 1, height: 44, borderRadius: 22, border: 'none', background: accent, color: '#fff', font: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>View my story</button>
          <button type="button" onClick={() => go('create')} style={{ flex: 1, height: 44, borderRadius: 22, border: `1px solid ${LINE}`, background: CARD, color: INK, font: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>New story</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, padding: '16px 20px 0' }}>
          {me.slides.map((s, k) => (
            <button key={s.id} type="button" onClick={() => open('you', k)} aria-label={`Open story ${k + 1}`} style={{ position: 'relative', height: 150, padding: 0, border: 'none', borderRadius: 14, overflow: 'hidden', cursor: 'pointer', background: CARD }}>
              <Scene s={s} id={`pf${s.id}`} />
              <span style={{ position: 'absolute', left: 6, right: 6, bottom: 8, fontSize: 10.5, fontWeight: 700, color: '#fff', textShadow: '0 1px 6px rgba(0,0,0,.6)' }}>{s.text}</span>
            </button>
          ))}
          {!me.slides.length && <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: MUTED, fontSize: 13, padding: '20px 0' }}>No stories yet.</div>}
        </div>
        <div style={{ margin: '18px 20px 0', padding: '2px 16px', background: CARD, borderRadius: 20 }}>
          {[['sound', 'Sound on'], ['archive', 'Save to archive'], ['mute', 'Mute notifications']].map(([k, l], n) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 0', borderTop: n ? `1px solid ${LINE}` : 'none', fontSize: 14, fontWeight: 600 }}>
              {l}
              {toggle(prefs[k], (v) => (setPrefs((p) => ({ ...p, [k]: v })), say(`${l}: ${v ? 'on' : 'off'}`)), l)}
            </div>
          ))}
        </div>
        <div style={{ padding: '14px 20px' }}>
          <button type="button" onClick={() => (setUsers((a) => a.map((x) => (x.id === 'you' ? { ...x, slides: [] } : x))), say('Your stories were deleted'))} style={{ width: '100%', height: 46, borderRadius: 23, border: 'none', background: CARD, color: '#fb7185', font: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><Icon name="trash" size={18} /> Delete my stories</button>
        </div>
      </>
    )
  }

  const phone = (
    <div style={{ position: 'relative', width: W, height: H, overflow: 'hidden', borderRadius: frame ? 46 : 0, background: BG, color: INK, fontFamily: "-apple-system, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif" }}>
      <style>{`
        @keyframes st-r { from { opacity: 0; transform: translateX(34px) } to { opacity: 1; transform: none } }
        @keyframes st-l { from { opacity: 0; transform: translateX(-34px) } to { opacity: 1; transform: none } }
        .st-scroll { scrollbar-width: none } .st-scroll::-webkit-scrollbar { display: none }
        .st-app button:focus-visible, .st-app input:focus-visible { outline: 2px solid ${accent}; outline-offset: 2px }
        .st-app input::placeholder { color: ${MUTED} }
        @media (prefers-reduced-motion: reduce) { .st-page { animation: none !important } .st-app * { transition: none !important } }
      `}</style>
      <StatusBar frame={frame} />
      <div key={`${tab}/${stack.map((s) => s.id).join('/')}`} className="st-scroll st-page" style={{ position: 'absolute', top: full ? 0 : 54, bottom: tabbed ? 88 : 0, left: 0, right: 0, overflowY: full || top?.id === 'reply' ? 'hidden' : 'auto', paddingBottom: full || top?.id === 'reply' ? 0 : 24, animation: reduced ? 'none' : `${dir > 0 ? 'st-r' : 'st-l'} .28s ease` }}>
        {body}
      </div>
      {tabbed && (
        <nav aria-label="Main" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 88, background: CARD, borderRadius: '26px 26px 0 0', boxShadow: '0 -6px 24px rgba(0,0,0,.4)', display: 'flex', justifyContent: 'space-around', padding: '10px 8px 0' }}>
          {NAV.map(([id, icon, label]) => (
            <button key={id} type="button" onClick={() => go(id)} aria-current={tab === id ? 'page' : undefined} style={{ border: 'none', background: 'none', font: 'inherit', cursor: 'pointer', display: 'grid', justifyItems: 'center', alignContent: 'start', gap: 3, width: 76, height: 54, fontSize: 11, fontWeight: 600, color: tab === id ? accent : MUTED }}>
              <Icon name={icon} size={23} />
              {label}
            </button>
          ))}
        </nav>
      )}
      <div role="status" style={{ position: 'absolute', left: '50%', top: 58, zIndex: 50, transform: `translate(-50%, ${toast ? 0 : -90}px)`, transition: 'transform .35s cubic-bezier(.2,.8,.2,1)', padding: '10px 16px', borderRadius: 20, background: '#fff', color: '#14101e', fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap' }}>{toast}</div>
      <div style={{ position: 'absolute', left: '50%', bottom: 8, width: 140, height: 5, marginLeft: -70, borderRadius: 3, background: '#fff', opacity: 0.8, zIndex: 45 }} />
    </div>
  )

  return (
    <div ref={box} className="st-app" style={{ position: 'relative', width: '100%', height: '100%', display: 'grid', placeItems: 'center', overflow: 'hidden', background: 'radial-gradient(ellipse at 50% 30%, #2a1f44, #0b0812 75%)', ...style }}>
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
