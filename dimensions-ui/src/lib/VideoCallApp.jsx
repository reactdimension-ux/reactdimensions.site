import { useEffect, useRef, useState } from 'react'

// A group video call on a phone, as a click-through prototype. Five pages:
// Lobby (pre-join check with mic/camera toggles), Call, Participants, Chat and
// Settings, plus a Leave screen. In the call, SVG-avatar tiles sit in a grid
// that adapts to 2, 3, 4 or more people, and a simulated active speaker moves
// to the front tile on a timer: every tile is absolutely positioned, so the
// others slide smoothly into their new slots. Your self-view floats and can be
// dragged to any corner. The floating controls bar toggles mute, camera, flip,
// screen share, raised hand and ends the call. Participants has host controls
// (mute, pin, remove, invite) and Chat has simulated replies. The phone scales
// to fit whatever box it is in.

const W = 390 // the phone screen, in CSS px
const H = 844
const BG = '#0b0f1e'
const CARD = '#151b30'
const LINE = '#232b47'
const INK = '#eef1ff'
const MUTED = '#8a93b5'
const GOOD = '#34d399'
const BAD = '#f0506e'

const AREA = { x: 8, y: 106, w: 374, h: 618 } // where the tiles live, in phone px
const PIP = { w: 100, h: 136 }

const clock = () => new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
const rnd = (n) => Math.floor(Math.random() * n)

const OTHERS = [
  { id: 'ava', name: 'Ava Chen', hue: 205, look: 0, cam: true },
  { id: 'leo', name: 'Leo Martins', hue: 28, look: 1, cam: true },
  { id: 'mia', name: 'Mia Okafor', hue: 320, look: 2, cam: false },
  { id: 'sam', name: 'Sam Patel', hue: 150, look: 3, cam: true },
  { id: 'zoe', name: 'Zoe Laurent', hue: 262, look: 2, cam: true },
  { id: 'noor', name: 'Noor Haddad', hue: 350, look: 0, cam: false },
  { id: 'kai', name: 'Kai Tanaka', hue: 175, look: 1, cam: true },
]
const mk = (o) => ({ ...o, muted: false, hand: false })
const REPLIES = ['Sounds good to me', 'Can you share the link?', 'Agreed, let us ship it', 'One sec, joining from my phone', 'Thanks, that helps', 'Great point', 'Could you repeat that?']

const ICONS = {
  mic: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3',
  micoff: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3M4 4l16 16',
  cam: 'M3 7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM15 10l6-3v10l-6-3',
  camoff: 'M3 7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM15 10l6-3v10l-6-3M3 3l18 18',
  flip: 'M4 12a8 8 0 0 1 14-5.300L20 9M20 4v5h-5M20 12a8 8 0 0 1-14 5.300L4 15M4 20v-5h5',
  screen: 'M3 5h18v11H3zM8 20h8M12 16v4M12 13V8m0 0l-3 3m3-3l3 3',
  hand: 'M8 13V6a1.500 1.500 0 0 1 3 0v5m0-6V4a1.500 1.500 0 0 1 3 0v7m0-5a1.500 1.500 0 0 1 3 0v6m0-3a1.500 1.500 0 0 1 3 0v5a7 7 0 0 1-7 7h-1a7 7 0 0 1-5.500-2.700L3.500 14a1.500 1.500 0 0 1 2.300-1.900L8 14',
  end: 'M3 14c4-4 14-4 18 0l-2.500 2.500-3-1.500v-2.500a10 10 0 0 0-5 0V15l-3 1.500z',
  people: 'M9 11a3.500 3.500 0 1 0 0-7 3.500 3.500 0 0 0 0 7zM2.500 20a6.500 6.500 0 0 1 13 0M16 4.200a3.500 3.500 0 0 1 0 6.600M18 14a6.500 6.500 0 0 1 3.500 6',
  chat: 'M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-8l-5 4v-4H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z',
  gear: 'M4 7h9M17 7h3M4 17h3M11 17h9M13 7a2 2 0 1 0 4 0 2 2 0 1 0-4 0zM7 17a2 2 0 1 0 4 0 2 2 0 1 0-4 0z',
  video: 'M4 6h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zM18 10l4-2v8l-4-2',
  pin: 'M12 17v5M8 3h8l-1 7 3 3H6l3-3z',
  x: 'M6 6l12 12M18 6L6 18',
  back: 'M15 5l-7 7 7 7',
  chev: 'M9 5l7 7-7 7',
  send: 'M4 12l16-8-6 16-3-7z',
  check: 'M5 12l5 5 9-10',
  plus: 'M12 5v14M5 12h14',
  link: 'M10 14a4 4 0 0 0 5.700 0l3-3a4 4 0 0 0-5.700-5.700l-1 1M14 10a4 4 0 0 0-5.700 0l-3 3a4 4 0 0 0 5.700 5.700l1-1',
  star: 'M12 3l2.800 5.800 6.200.9-4.500 4.400 1.100 6.200L12 17.300 6.400 20.300l1.100-6.200L3 9.700l6.200-.9z',
  clock: 'M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
}

function Icon({ name, size = 22, color = 'currentColor', w = 1.9, fill = 'none' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  )
}

// A little illustrated person, used for tiles, the lobby preview and rows.
const SKIN = ['#f1c9a5', '#d9a37a', '#a9714b', '#7a4a2f']
function PersonArt({ hue, look = 0, talking, uid }) {
  const skin = SKIN[look % 4]
  const hair = ['#2b1d17', '#c47a2c', '#1b1b24', '#6b3b24'][(look + 1) % 4]
  const g = `pa-${uid}`
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }} aria-hidden="true">
      <defs>
        <linearGradient id={g} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={`hsl(${hue} 55% 52%)`} />
          <stop offset="1" stopColor={`hsl(${(hue + 40) % 360} 55% 24%)`} />
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill={`url(#${g})`} />
      <circle cx="82" cy="18" r="16" fill="#fff" opacity=".07" />
      <rect x="10" y="12" width="16" height="22" rx="2" fill="#fff" opacity=".08" />
      <path d="M12 100c0-20 16-30 38-30s38 10 38 30z" fill={`hsl(${(hue + 180) % 360} 45% 34%)`} />
      <rect x="44" y="56" width="12" height="16" rx="5" fill={skin} />
      {look % 4 === 2 && <path d="M30 48c-4 18 0 34 8 36l4-30zM70 48c4 18 0 34-8 36l-4-30z" fill={hair} />}
      <ellipse cx="50" cy="42" rx="16" ry="18" fill={skin} />
      {look % 4 === 0 && <path d="M33 40c0-16 8-22 17-22s17 6 17 22c-6-8-12-10-17-10s-11 2-17 10z" fill={hair} />}
      {look % 4 === 1 && <path d="M33 38c1-14 9-19 17-19s16 5 17 19c-4-5-9-7-17-7s-13 2-17 7z" fill={hair} />}
      {look % 4 === 2 && <path d="M33 38c1-15 9-20 17-20s16 5 17 20c-5-4-10-9-17-9s-12 5-17 9z" fill={hair} />}
      {look % 4 === 3 && (
        <>
          <circle cx="50" cy="19" r="7" fill={hair} />
          <path d="M33 38c1-14 9-18 17-18s16 4 17 18c-5-5-10-7-17-7s-12 2-17 7z" fill={hair} />
        </>
      )}
      <circle cx="43.500" cy="43" r="1.800" fill="#1b1220" />
      <circle cx="56.500" cy="43" r="1.800" fill="#1b1220" />
      {talking ? <ellipse cx="50" cy="52" rx="4" ry="3" fill="#7a2331" className="vc-mouth" /> : <path d="M44 51q6 5 12 0" fill="none" stroke="#7a2331" strokeWidth="1.600" strokeLinecap="round" />}
    </svg>
  )
}

function Eq({ on, color = '#fff' }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'flex-end', gap: 2, height: 12 }} aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <i key={i} className={on ? 'vc-eq' : ''} style={{ width: 3, height: on ? 12 : 4, borderRadius: 2, background: color, animationDelay: `${i * 0.15}s`, transformOrigin: '50% 100%' }} />
      ))}
    </span>
  )
}

// A video tile. Position comes from `rect`, so changing it slides the tile.
function Tile({ p, rect, speaking, pinned, accent, onTap, uid }) {
  return (
    <button
      type="button"
      onClick={onTap}
      aria-label={`${p.name}${speaking ? ', speaking' : ''}${pinned ? ', pinned' : ''}. Tap to ${pinned ? 'unpin' : 'pin'}`}
      className="vc-tile"
      style={{ position: 'absolute', left: rect.x, top: rect.y, width: rect.w, height: rect.h, padding: 0, border: 'none', borderRadius: 20, overflow: 'hidden', background: '#10152a', cursor: 'pointer', color: '#fff', font: 'inherit', textAlign: 'left', boxShadow: speaking ? `0 0 0 3px ${accent}, 0 0 22px ${accent}88` : `0 0 0 1px ${LINE}`, transition: 'left .5s cubic-bezier(.3,.8,.3,1), top .5s cubic-bezier(.3,.8,.3,1), width .5s cubic-bezier(.3,.8,.3,1), height .5s cubic-bezier(.3,.8,.3,1), box-shadow .25s' }}
    >
      {p.cam ? (
        <PersonArt hue={p.hue} look={p.look} talking={speaking && !p.muted} uid={`${uid}-${p.id}`} />
      ) : (
        <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'linear-gradient(160deg, #1a2140, #0d1226)' }}>
          <span style={{ position: 'relative', display: 'grid', placeItems: 'center', width: 76, height: 76, borderRadius: '50%', background: `hsl(${p.hue} 50% 38%)`, fontSize: 28, fontWeight: 800 }}>
            {speaking && <i className="vc-halo" style={{ position: 'absolute', inset: -4, borderRadius: '50%', border: `3px solid ${accent}` }} />}
            {p.name.split(' ').map((s) => s[0]).join('')}
          </span>
        </span>
      )}
      <span style={{ position: 'absolute', left: 8, bottom: 8, display: 'flex', alignItems: 'center', gap: 6, maxWidth: 'calc(100% - 16px)', padding: '4px 9px 4px 7px', borderRadius: 14, background: 'rgba(8,10,22,.62)', backdropFilter: 'blur(6px)', fontSize: 12, fontWeight: 600 }}>
        {p.muted ? <Icon name="micoff" size={13} color={BAD} /> : <Eq on={speaking} color={speaking ? accent : '#cbd2f0'} />}
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name.split(' ')[0]}</span>
      </span>
      <span style={{ position: 'absolute', right: 8, top: 8, display: 'flex', gap: 6 }}>
        {pinned && <span style={{ width: 26, height: 26, borderRadius: 13, display: 'grid', placeItems: 'center', background: 'rgba(8,10,22,.62)' }}><Icon name="pin" size={13} /></span>}
        {p.hand && <span className="vc-wave" style={{ width: 28, height: 28, borderRadius: 14, display: 'grid', placeItems: 'center', background: '#fbbf24', color: '#3b2a00' }}><Icon name="hand" size={16} /></span>}
      </span>
    </button>
  )
}

// Your floating self-view. It owns its drag state and snaps to a corner.
function SelfView({ me, scale, accent, big, onTap, sharing, mirror, speaking }) {
  const [corner, setCorner] = useState('br')
  const [dp, setDp] = useState(null)
  const start = useRef(null)
  const pw = big ? 140 : PIP.w
  const ph = big ? 190 : PIP.h
  const spots = { tl: [14, 108], tr: [W - pw - 14, 108], bl: [14, AREA.y + AREA.h - ph - 6], br: [W - pw - 14, AREA.y + AREA.h - ph - 6] }
  const [x, y] = dp ? [dp.x, dp.y] : spots[corner]

  const down = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    start.current = { cx: e.clientX, cy: e.clientY, x, y, moved: false }
  }
  const move = (e) => {
    const s = start.current
    if (!s) return
    const dx = (e.clientX - s.cx) / scale
    const dy = (e.clientY - s.cy) / scale
    if (Math.abs(dx) + Math.abs(dy) > 4) s.moved = true
    if (s.moved) setDp({ x: Math.max(4, Math.min(W - pw - 4, s.x + dx)), y: Math.max(100, Math.min(H - ph - 120, s.y + dy)) })
  }
  const up = () => {
    const s = start.current
    start.current = null
    if (!s) return
    if (!s.moved) return onTap()
    const cx = (dp ? dp.x : x) + pw / 2
    const cy = (dp ? dp.y : y) + ph / 2
    setCorner(`${cy < (AREA.y + AREA.h / 2 + 40) ? 't' : 'b'}${cx < W / 2 ? 'l' : 'r'}`)
    setDp(null)
  }
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Your self-view. Drag to a corner, tap to resize"
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onKeyDown={(e) => e.key === 'Enter' && onTap()}
      style={{ position: 'absolute', zIndex: 12, left: x, top: y, width: pw, height: ph, borderRadius: 18, overflow: 'hidden', touchAction: 'none', cursor: dp ? 'grabbing' : 'grab', userSelect: 'none', boxShadow: speaking ? `0 0 0 3px ${accent}, 0 10px 26px rgba(0,0,0,.5)` : '0 0 0 2px rgba(255,255,255,.28), 0 10px 26px rgba(0,0,0,.5)', transition: dp ? 'none' : 'left .3s cubic-bezier(.3,.8,.3,1), top .3s cubic-bezier(.3,.8,.3,1), width .25s, height .25s', background: '#10152a' }}
    >
      {sharing ? (
        <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'linear-gradient(160deg, #1d2a5a, #0f1630)', textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#cdd6ff', padding: 8 }}>
          <span><Icon name="screen" size={28} color={accent} /><br />Sharing your screen</span>
        </span>
      ) : me.cam ? (
        <span style={{ position: 'absolute', inset: 0, transform: mirror ? 'scaleX(-1)' : 'none' }}>
          <PersonArt hue={me.flip ? 120 : 215} look={1} talking={speaking} uid="me" />
        </span>
      ) : (
        <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'linear-gradient(160deg, #1a2140, #0d1226)', color: '#8a93b5' }}><Icon name="camoff" size={26} /></span>
      )}
      <span style={{ position: 'absolute', left: 6, bottom: 6, display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 12, background: 'rgba(8,10,22,.62)', fontSize: 11, fontWeight: 600, color: '#fff' }}>
        {me.muted && <Icon name="micoff" size={12} color={BAD} />}You
      </span>
      {me.hand && <span style={{ position: 'absolute', right: 6, top: 6, width: 24, height: 24, borderRadius: 12, display: 'grid', placeItems: 'center', background: '#fbbf24', color: '#3b2a00' }}><Icon name="hand" size={14} /></span>}
    </div>
  )
}

// where each tile goes inside the tile area for n people
function tileRects(n, w, h, mode) {
  const g = 8
  if (n === 0) return []
  if (n === 1) return [{ x: 0, y: 0, w, h }]
  if (n === 2) {
    const th = (h - g) / 2
    return [{ x: 0, y: 0, w, h: th }, { x: 0, y: th + g, w, h: th }]
  }
  const big = mode === 'speaker' && n % 2 === 1
  const rest = big ? n - 1 : n
  const rows = Math.ceil(rest / 2)
  const bigH = big ? Math.round(h * 0.36) : 0
  const top = big ? bigH + g : 0
  const rh = (h - top - g * (rows - 1)) / rows
  const cw = (w - g) / 2
  const out = big ? [{ x: 0, y: 0, w, h: bigH }] : []
  for (let i = 0; i < rest; i++) {
    const r = Math.floor(i / 2)
    const c = i % 2
    const alone = rest % 2 === 1 && i === rest - 1
    out.push({ x: alone ? 0 : c * (cw + g), y: top + r * (rh + g), w: alone ? w : cw, h: rh })
  }
  return out
}

function StatusBar({ frame }) {
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 40, height: 54, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 30px 0 36px', fontSize: 16, fontWeight: 600, color: INK, pointerEvents: 'none' }}>
      <span>{new Date().toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' })}</span>
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

const TABS = [
  ['call', 'video', 'Call'],
  ['participants', 'people', 'People'],
  ['chat', 'chat', 'Chat'],
  ['settings', 'gear', 'Settings'],
]
const ORDER = ['lobby', 'call', 'participants', 'chat', 'settings', 'left']

// ---------------------------------------------------------------- app

export default function VideoCallApp({ name = 'Huddle', accent = '#6d6bff', startScreen = 'lobby', frame = true, style }) {
  const box = useRef()
  const toastTimer = useRef()
  const replyTimers = useRef([])
  const chatEnd = useRef()
  const peopleRef = useRef([])
  const [scale, setScale] = useState(1)
  const [scr, setScr] = useState(startScreen)
  const [stack, setStack] = useState([])
  const [dir, setDir] = useState(1)
  const [joined, setJoined] = useState(startScreen !== 'lobby')
  const [secs, setSecs] = useState(0)
  const [people, setPeople] = useState(() => OTHERS.slice(0, 3).map(mk))
  const [pool, setPool] = useState(OTHERS.slice(3))
  const [order, setOrder] = useState(['ava', 'leo', 'mia'])
  const [speaker, setSpeaker] = useState('ava')
  const [pinned, setPinned] = useState(null)
  const [me, setMe] = useState({ name: 'You', muted: false, cam: true, hand: false, flip: false })
  const [sharing, setSharing] = useState(false)
  const [big, setBig] = useState(false)
  const [msgs, setMsgs] = useState([
    { id: 1, from: 'ava', text: 'Morning all, can everyone hear me?', t: '09:58' },
    { id: 2, from: 'leo', text: 'Loud and clear', t: '09:59' },
    { id: 3, from: 'mia', text: 'Camera is off, bad wifi today', t: '10:00' },
  ])
  const [draft, setDraft] = useState('')
  const [unread, setUnread] = useState(0)
  const [toast, setToast] = useState('')
  const [rating, setRating] = useState(0)
  const [lastSecs, setLastSecs] = useState(0)
  const [confirm, setConfirm] = useState(null)
  const [set, setSet] = useState({ noise: true, hd: false, mirror: true, auto: true, layout: 'speaker', mic: 'Default', volume: 70, captions: false })

  peopleRef.current = people

  useEffect(() => {
    setScr(startScreen)
    setStack([])
    setJoined(startScreen !== 'lobby')
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
  useEffect(
    () => () => {
      clearTimeout(toastTimer.current)
      replyTimers.current.forEach(clearTimeout)
    },
    [],
  )

  const live = joined && scr !== 'left' && scr !== 'lobby'

  // call timer
  useEffect(() => {
    if (!live) return undefined
    const id = setInterval(() => setSecs((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [live])

  // simulated active speaker + the odd raised hand
  useEffect(() => {
    if (!live || !set.auto) return undefined
    const id = setInterval(() => {
      const cands = peopleRef.current.filter((p) => !p.muted).map((p) => p.id)
      if (!cands.length) return setSpeaker(null)
      const pick = cands[rnd(cands.length)]
      setSpeaker((cur) => {
        const next = cands.length > 1 && pick === cur ? cands[(cands.indexOf(pick) + 1) % cands.length] : pick
        setOrder((o) => [next, ...o.filter((x) => x !== next)])
        return next
      })
      if (Math.random() < 0.18) setPeople((a) => a.map((p, i) => (i === rnd(a.length) ? { ...p, hand: !p.hand } : p)))
    }, 3200)
    return () => clearInterval(id)
  }, [live, set.auto])

  const top = stack[stack.length - 1]
  const push = (s) => (setDir(1), setStack((a) => [...a, s]))
  const pop = () => (setDir(-1), setStack((a) => a.slice(0, -1)))
  const go = (id) => {
    setDir(ORDER.indexOf(id) >= ORDER.indexOf(scr) ? 1 : -1)
    setScr(id)
    setStack([])
    setConfirm(null)
    if (id === 'chat') setUnread(0)
  }
  const home = () => go(joined ? 'call' : 'lobby')

  const upd = (id, patch) => setPeople((a) => a.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  const join = () => {
    setJoined(true)
    setSecs(0)
    go('call')
    say('You joined the call')
  }
  const leave = () => {
    setLastSecs(secs)
    setJoined(false)
    setSharing(false)
    setStack([])
    setDir(1)
    setScr('left')
  }
  const invite = () => {
    if (!pool.length) return
    const [n, ...rest] = pool
    setPool(rest)
    setPeople((a) => [...a, mk(n)])
    setOrder((o) => [...o, n.id])
    say(`${n.name.split(' ')[0]} joined`)
  }
  const remove = (id) => {
    const p = people.find((x) => x.id === id)
    setPeople((a) => a.filter((x) => x.id !== id))
    setPool((a) => [p, ...a].map((x) => ({ id: x.id, name: x.name, hue: x.hue, look: x.look, cam: x.cam })))
    if (pinned === id) setPinned(null)
    if (speaker === id) setSpeaker(null)
    setConfirm(null)
    say(`${p.name.split(' ')[0]} was removed`)
  }
  const togglePin = (id) => {
    setPinned((c) => (c === id ? null : id))
    say(pinned === id ? 'Unpinned' : `Pinned ${people.find((p) => p.id === id).name.split(' ')[0]}`)
  }
  const sendMsg = (text) => {
    const t = (text ?? draft).trim()
    if (!t) return
    setMsgs((a) => [...a, { id: Date.now(), from: 'you', text: t, t: clock() }])
    setDraft('')
    const who = peopleRef.current
    if (who.length) {
      replyTimers.current.push(
        setTimeout(() => {
          const p = who[rnd(who.length)]
          setMsgs((a) => [...a, { id: Date.now() + 1, from: p.id, text: REPLIES[rnd(REPLIES.length)], t: clock() }])
          setUnread((u) => (scrRef.current === 'chat' ? u : u + 1))
        }, 1400),
      )
    }
  }
  const scrRef = useRef(scr)
  scrRef.current = scr
  useEffect(() => {
    if (scr === 'chat') chatEnd.current?.scrollIntoView({ block: 'end' })
  }, [msgs, scr])

  const nameOf = (id) => (id === 'you' ? me.name : OTHERS.find((o) => o.id === id)?.name || id)

  // ---- derived tile layout
  const ids = people.map((p) => p.id)
  let ord = order.filter((id) => ids.includes(id))
  ids.forEach((id) => !ord.includes(id) && ord.push(id))
  if (pinned && ids.includes(pinned)) ord = [pinned, ...ord.filter((x) => x !== pinned)]
  const rects = tileRects(ord.length, AREA.w, AREA.h - (sharing ? 28 : 0), set.layout)
  const allMuted = people.length > 0 && people.every((p) => p.muted)

  // ---- shared bits
  const header = (title, back, right) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px 6px', minHeight: 48 }}>
      {back && (
        <button type="button" onClick={back} aria-label="Back" style={{ width: 38, height: 38, borderRadius: '50%', border: 'none', background: CARD, color: INK, display: 'grid', placeItems: 'center', cursor: 'pointer', padding: 0 }}>
          <Icon name="back" size={20} />
        </button>
      )}
      <h1 style={{ margin: 0, flex: 1, fontSize: back ? 18 : 26, fontWeight: 800, letterSpacing: '-0.02em', marginLeft: 4 }}>{title}</h1>
      {right}
    </div>
  )
  const card = { margin: '0 16px', padding: '2px 16px', background: CARD, borderRadius: 20 }
  const toggle = (on, setter, label) => (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => setter(!on)} style={{ width: 48, height: 28, borderRadius: 14, border: 'none', padding: 3, background: on ? accent : '#2c3557', cursor: 'pointer', transition: 'background .2s', flex: 'none' }}>
      <span style={{ display: 'block', width: 22, height: 22, borderRadius: '50%', background: '#fff', transform: `translateX(${on ? 20 : 0}px)`, transition: 'transform .2s' }} />
    </button>
  )
  const setRow = (icon, label, ctl, last) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '13px 0', borderBottom: last ? 'none' : `1px solid ${LINE}` }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, fontWeight: 600 }}><Icon name={icon} size={19} color={accent} />{label}</span>
      {ctl}
    </div>
  )
  const primary = (label, onClick, opts = {}) => (
    <button type="button" disabled={opts.disabled} onClick={onClick} style={{ width: '100%', height: 52, borderRadius: 26, border: 'none', background: opts.disabled ? '#2c3557' : opts.bad ? BAD : accent, color: '#fff', font: 'inherit', fontSize: 15, fontWeight: 700, cursor: opts.disabled ? 'default' : 'pointer', boxShadow: opts.disabled ? 'none' : `0 10px 24px ${(opts.bad ? BAD : accent)}55` }}>
      {label}
    </button>
  )
  const ghost = (label, onClick) => (
    <button type="button" onClick={onClick} style={{ width: '100%', height: 46, border: 'none', background: 'none', font: 'inherit', fontSize: 14, fontWeight: 600, color: MUTED, cursor: 'pointer' }}>{label}</button>
  )
  const roundBtn = (icon, label, on, onClick, opts = {}) => (
    <button key={label} type="button" onClick={onClick} aria-label={label} aria-pressed={on} style={{ width: opts.w || 48, height: 48, borderRadius: 24, border: 'none', cursor: 'pointer', display: 'grid', placeItems: 'center', padding: 0, flex: 'none', background: opts.bad ? BAD : on ? (opts.onBg || '#fff') : 'rgba(255,255,255,.13)', color: opts.bad ? '#fff' : on ? (opts.onFg || '#10152a') : '#fff', transition: 'background .2s, color .2s' }}>
      <Icon name={icon} size={22} />
    </button>
  )
  const miniAvatar = (p, size = 42) => (
    <span style={{ position: 'relative', width: size, height: size, borderRadius: '50%', overflow: 'hidden', flex: 'none', display: 'inline-block' }}>
      <PersonArt hue={p.hue} look={p.look} uid={`m-${p.id}`} />
    </span>
  )
  const meP = { id: 'you', name: me.name, hue: 215, look: 1 }

  // ---- screens
  let body
  let tabbed = false
  let bare = false // call screen draws its own chrome
  if (top?.id === 'person') {
    const p = people.find((x) => x.id === top.pid)
    if (!p) {
      body = <div style={{ padding: 40, textAlign: 'center', color: MUTED }}>{header('Participant', pop)}This person left the call.</div>
    } else {
      body = (
        <>
          {header('Participant', pop)}
          <div style={{ textAlign: 'center', padding: '8px 20px 14px' }}>
            <span style={{ position: 'relative', display: 'inline-block', width: 108, height: 108, borderRadius: '50%', overflow: 'hidden', boxShadow: speaker === p.id ? `0 0 0 4px ${accent}` : 'none' }}>
              <PersonArt hue={p.hue} look={p.look} talking={speaker === p.id} uid={`d-${p.id}`} />
            </span>
            <div style={{ fontSize: 22, fontWeight: 800, marginTop: 12 }}>{p.name}</div>
            <div style={{ fontSize: 13, color: MUTED, marginTop: 2 }}>{speaker === p.id ? 'Speaking now' : p.muted ? 'Muted' : 'Listening'} · {p.cam ? 'Camera on' : 'Camera off'}</div>
          </div>
          <div style={{ ...card, display: 'grid' }}>
            {[
              [p.muted ? 'micoff' : 'mic', p.muted ? 'Unmute' : 'Mute', () => (upd(p.id, { muted: !p.muted }), say(p.muted ? 'Unmuted' : 'Muted'))],
              ['pin', pinned === p.id ? 'Unpin from screen' : 'Pin to screen', () => togglePin(p.id)],
              ['chat', 'Message', () => (setDraft(`@${p.name.split(' ')[0]} `), go('chat'))],
              ...(p.hand ? [['hand', 'Lower hand', () => upd(p.id, { hand: false })]] : []),
            ].map(([ic, l, fn], i, a) => (
              <button key={l} type="button" onClick={fn} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 0', border: 'none', borderBottom: i < a.length - 1 ? `1px solid ${LINE}` : 'none', background: 'none', color: INK, font: 'inherit', fontSize: 14, fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}>
                <Icon name={ic} size={20} color={accent} />{l}
              </button>
            ))}
          </div>
          <div style={{ padding: '16px 16px' }}>{primary(confirm === p.id ? 'Tap again to remove' : 'Remove from call', () => (confirm === p.id ? (remove(p.id), pop()) : setConfirm(p.id)), { bad: true })}</div>
        </>
      )
    }
  } else if (scr === 'lobby') {
    body = (
      <>
        {header('Ready to join?', null, <button type="button" onClick={() => go('settings')} aria-label="Settings" style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', background: CARD, color: INK, display: 'grid', placeItems: 'center', cursor: 'pointer', padding: 0 }}><Icon name="gear" size={20} /></button>)}
        <div style={{ padding: '0 16px', fontSize: 13, color: MUTED }}>Design sync · weekly · code <b style={{ color: INK }}>qzt-mwe-418</b></div>
        <div style={{ position: 'relative', margin: '14px 16px 0', height: 330, borderRadius: 26, overflow: 'hidden', background: '#10152a', boxShadow: `0 0 0 1px ${LINE}` }}>
          {me.cam ? (
            <span style={{ position: 'absolute', inset: 0, transform: set.mirror ? 'scaleX(-1)' : 'none' }}><PersonArt hue={215} look={1} uid="lobby" /></span>
          ) : (
            <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'linear-gradient(160deg,#1a2140,#0d1226)', color: MUTED, textAlign: 'center', fontSize: 13 }}><span><Icon name="camoff" size={36} /><br />Camera is off</span></span>
          )}
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 14, display: 'flex', justifyContent: 'center', gap: 14 }}>
            {roundBtn(me.muted ? 'micoff' : 'mic', me.muted ? 'Unmute microphone' : 'Mute microphone', !me.muted, () => setMe((m) => ({ ...m, muted: !m.muted })))}
            {roundBtn(me.cam ? 'cam' : 'camoff', me.cam ? 'Turn camera off' : 'Turn camera on', me.cam, () => setMe((m) => ({ ...m, cam: !m.cam })))}
            {roundBtn('flip', 'Flip camera', false, () => (setMe((m) => ({ ...m, flip: !m.flip })), say(me.flip ? 'Front camera' : 'Back camera')))}
          </div>
        </div>
        <div style={{ margin: '14px 16px 0', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 18, background: CARD }}>
          <label htmlFor="vc-name" style={{ fontSize: 12, color: MUTED, fontWeight: 600 }}>Your name</label>
          <input id="vc-name" value={me.name} onChange={(e) => setMe((m) => ({ ...m, name: e.target.value.slice(0, 18) }))} style={{ flex: 1, height: 34, border: 'none', borderRadius: 10, background: '#0f1429', color: INK, padding: '0 10px', font: 'inherit', fontSize: 14, fontWeight: 600 }} />
        </div>
        <div style={{ margin: '14px 16px 0', display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, color: MUTED }}>
          <span style={{ display: 'flex' }}>{people.slice(0, 3).map((p, i) => <span key={p.id} style={{ marginLeft: i ? -10 : 0, borderRadius: '50%', boxShadow: `0 0 0 2px ${BG}` }}>{miniAvatar(p, 32)}</span>)}</span>
          <span>{people.length ? `${people[0].name.split(' ')[0]}${people.length > 1 ? ` and ${people.length - 1} other${people.length > 2 ? 's' : ''}` : ''} ${people.length > 1 ? 'are' : 'is'} here` : 'Nobody is here yet'}</span>
        </div>
        <div style={{ padding: '18px 16px 0', display: 'grid', gap: 4 }}>
          {primary('Join call', join)}
          {ghost('Copy invite link', () => say('Invite link copied'))}
        </div>
      </>
    )
  } else if (scr === 'call') {
    bare = true
    body = null
  } else if (scr === 'participants') {
    tabbed = true
    const sorted = [...people].sort((a, b) => Number(b.hand) - Number(a.hand))
    body = (
      <>
        {header(`People (${people.length + 1})`, home)}
        <div style={{ display: 'flex', gap: 8, padding: '4px 16px 12px' }}>
          <button type="button" onClick={() => (setPeople((a) => a.map((p) => ({ ...p, muted: true }))), say('Muted everyone'))} style={{ flex: 1, height: 42, borderRadius: 21, border: 'none', background: CARD, color: INK, font: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><Icon name="micoff" size={16} color={BAD} />Mute all</button>
          <button type="button" disabled={!pool.length} onClick={invite} style={{ flex: 1, height: 42, borderRadius: 21, border: 'none', background: pool.length ? accent : '#2c3557', color: '#fff', font: 'inherit', fontSize: 13, fontWeight: 700, cursor: pool.length ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><Icon name="plus" size={16} />{pool.length ? 'Invite someone' : 'Everyone is here'}</button>
        </div>
        <div style={{ display: 'grid', gap: 8, padding: '0 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 18, background: CARD }}>
            {miniAvatar(meP)}
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700 }}>{me.name} <span style={{ fontSize: 10.5, padding: '2px 7px', borderRadius: 8, background: `${accent}33`, color: accent, marginLeft: 4 }}>Host</span></span>
              <span style={{ display: 'block', fontSize: 12, color: MUTED }}>{me.muted ? 'Muted' : 'Mic on'} · {me.cam ? 'Camera on' : 'Camera off'}</span>
            </span>
            <button type="button" onClick={() => setMe((m) => ({ ...m, muted: !m.muted }))} aria-label={me.muted ? 'Unmute yourself' : 'Mute yourself'} style={{ width: 38, height: 38, borderRadius: '50%', border: 'none', background: '#1d2542', color: me.muted ? BAD : GOOD, display: 'grid', placeItems: 'center', cursor: 'pointer', padding: 0 }}><Icon name={me.muted ? 'micoff' : 'mic'} size={18} /></button>
          </div>
          {sorted.map((p) => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 18, background: CARD, boxShadow: speaker === p.id ? `inset 0 0 0 2px ${accent}` : 'none' }}>
              <button type="button" onClick={() => push({ id: 'person', pid: p.id })} aria-label={`Open ${p.name}`} style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0, border: 'none', background: 'none', padding: 0, color: INK, font: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
                {miniAvatar(p)}
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}{pinned === p.id && <Icon name="pin" size={12} color={accent} />}</span>
                  <span style={{ display: 'block', fontSize: 12, color: p.hand ? '#fbbf24' : MUTED }}>{p.hand ? 'Hand raised' : speaker === p.id ? 'Speaking' : p.muted ? 'Muted' : 'Listening'}</span>
                </span>
              </button>
              <button type="button" onClick={() => upd(p.id, { muted: !p.muted })} aria-label={p.muted ? `Unmute ${p.name}` : `Mute ${p.name}`} style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: '#1d2542', color: p.muted ? BAD : GOOD, display: 'grid', placeItems: 'center', cursor: 'pointer', padding: 0 }}><Icon name={p.muted ? 'micoff' : 'mic'} size={17} /></button>
              <button type="button" onClick={() => (confirm === p.id ? remove(p.id) : setConfirm(p.id))} aria-label={`Remove ${p.name}`} style={{ height: 36, minWidth: 36, padding: confirm === p.id ? '0 10px' : 0, borderRadius: 18, border: 'none', background: confirm === p.id ? BAD : '#1d2542', color: confirm === p.id ? '#fff' : MUTED, font: 'inherit', fontSize: 12, fontWeight: 700, display: 'grid', placeItems: 'center', cursor: 'pointer' }}>{confirm === p.id ? 'Remove?' : <Icon name="x" size={17} />}</button>
            </div>
          ))}
        </div>
      </>
    )
  } else if (scr === 'chat') {
    tabbed = true
    body = (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {header('Chat', home)}
        <div className="vc-scroll" style={{ flex: 1, overflowY: 'auto', padding: '6px 16px', display: 'grid', alignContent: 'start', gap: 10 }}>
          {msgs.map((m) => {
            const mine = m.from === 'you'
            return (
              <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start' }}>
                <span style={{ fontSize: 11, color: MUTED, margin: '0 6px 3px' }}>{mine ? 'You' : nameOf(m.from).split(' ')[0]} · {m.t}</span>
                <span style={{ maxWidth: 270, padding: '9px 14px', borderRadius: mine ? '18px 18px 4px 18px' : '18px 18px 18px 4px', background: mine ? accent : CARD, fontSize: 14, lineHeight: 1.35, overflowWrap: 'anywhere' }}>{m.text}</span>
              </div>
            )
          })}
          <div ref={chatEnd} />
        </div>
        <div className="vc-scroll" style={{ display: 'flex', gap: 8, padding: '6px 16px', overflowX: 'auto', flex: 'none' }}>
          {['Sounds good', 'Thanks!', 'Be right back', 'Can you repeat?'].map((q) => (
            <button key={q} type="button" onClick={() => sendMsg(q)} style={{ flex: 'none', height: 32, padding: '0 13px', borderRadius: 16, border: `1px solid ${LINE}`, background: 'none', color: INK, font: 'inherit', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>{q}</button>
          ))}
        </div>
        <form onSubmit={(e) => (e.preventDefault(), sendMsg())} style={{ display: 'flex', gap: 8, padding: '6px 16px 10px', flex: 'none' }}>
          <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Message everyone" aria-label="Message" style={{ flex: 1, height: 44, borderRadius: 22, border: 'none', background: CARD, color: INK, padding: '0 16px', font: 'inherit', fontSize: 14 }} />
          <button type="submit" disabled={!draft.trim()} aria-label="Send" style={{ width: 44, height: 44, borderRadius: '50%', border: 'none', background: draft.trim() ? accent : CARD, color: '#fff', display: 'grid', placeItems: 'center', cursor: draft.trim() ? 'pointer' : 'default', padding: 0 }}><Icon name="send" size={19} /></button>
        </form>
      </div>
    )
  } else if (scr === 'settings') {
    tabbed = true
    body = (
      <>
        {header('Settings', home)}
        <div style={card}>
          {setRow('mic', 'Noise suppression', toggle(set.noise, (v) => setSet((s) => ({ ...s, noise: v })), 'Noise suppression'))}
          {setRow('cam', 'HD video', toggle(set.hd, (v) => setSet((s) => ({ ...s, hd: v })), 'HD video'))}
          {setRow('flip', 'Mirror my video', toggle(set.mirror, (v) => setSet((s) => ({ ...s, mirror: v })), 'Mirror my video'))}
          {setRow('chat', 'Live captions', toggle(set.captions, (v) => setSet((s) => ({ ...s, captions: v })), 'Live captions'))}
          {setRow('people', 'Simulate active speaker', toggle(set.auto, (v) => setSet((s) => ({ ...s, auto: v })), 'Simulate active speaker'), true)}
        </div>
        <div style={{ ...card, marginTop: 12, padding: '14px 16px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Call layout</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[['speaker', 'Speaker first'], ['grid', 'Even grid']].map(([id, l]) => (
              <button key={id} type="button" aria-pressed={set.layout === id} onClick={() => setSet((s) => ({ ...s, layout: id }))} style={{ flex: 1, height: 40, borderRadius: 20, border: 'none', background: set.layout === id ? accent : '#1d2542', color: '#fff', font: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{l}</button>
            ))}
          </div>
        </div>
        <div style={{ ...card, marginTop: 12, padding: '14px 16px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Microphone</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {['Default', 'Headset', 'Bluetooth'].map((m) => (
              <button key={m} type="button" aria-pressed={set.mic === m} onClick={() => (setSet((s) => ({ ...s, mic: m })), say(`Using ${m}`))} style={{ height: 36, padding: '0 16px', borderRadius: 18, border: 'none', background: set.mic === m ? accent : '#1d2542', color: '#fff', font: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{m}</button>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600, margin: '16px 0 6px' }}><span>Speaker volume</span><span style={{ color: MUTED }}>{set.volume}%</span></div>
          <input type="range" min="0" max="100" value={set.volume} onChange={(e) => setSet((s) => ({ ...s, volume: +e.target.value }))} aria-label="Speaker volume" style={{ width: '100%', accentColor: accent }} />
        </div>
        <div style={{ padding: '16px 16px' }}>
          {joined ? primary('Leave call', leave, { bad: true }) : primary('Back to lobby', () => go('lobby'))}
        </div>
      </>
    )
  } else {
    // left
    body = (
      <div style={{ textAlign: 'center', padding: '90px 24px 0' }}>
        <span style={{ width: 88, height: 88, borderRadius: '50%', display: 'inline-grid', placeItems: 'center', background: '#2a1620', color: BAD }}><Icon name="end" size={40} /></span>
        <div style={{ fontSize: 24, fontWeight: 800, marginTop: 20 }}>You left the call</div>
        <div style={{ fontSize: 14, color: MUTED, marginTop: 6 }}>Design sync · {mmss(lastSecs)}</div>
        <div style={{ margin: '28px 0 8px', fontSize: 13, color: MUTED }}>How was the call quality?</div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" onClick={() => (setRating(n), say('Thanks for the feedback'))} aria-label={`${n} star${n > 1 ? 's' : ''}`} aria-pressed={rating >= n} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 2, color: rating >= n ? '#fbbf24' : '#3a4366' }}>
              <Icon name="star" size={34} fill={rating >= n ? '#fbbf24' : 'none'} w={1.5} />
            </button>
          ))}
        </div>
        <div style={{ display: 'grid', gap: 6, marginTop: 36 }}>
          {primary('Rejoin call', () => (setJoined(true), setSecs(lastSecs), go('call'), say('Welcome back')))}
          {ghost('Back to lobby', () => (setRating(0), go('lobby')))}
        </div>
      </div>
    )
  }

  const phone = (
    <div style={{ position: 'relative', width: W, height: H, overflow: 'hidden', borderRadius: frame ? 46 : 0, background: `radial-gradient(ellipse at 50% 0%, #1b2350, ${BG} 60%)`, color: INK, fontFamily: "-apple-system, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif" }}>
      <style>{`
        @keyframes vc-r { from { opacity: 0; transform: translateX(34px) } to { opacity: 1; transform: none } }
        @keyframes vc-l { from { opacity: 0; transform: translateX(-34px) } to { opacity: 1; transform: none } }
        @keyframes vc-eq { 0%, 100% { transform: scaleY(.3) } 50% { transform: scaleY(1) } }
        @keyframes vc-mouth { 0%, 100% { transform: scaleY(.4) } 50% { transform: scaleY(1.3) } }
        @keyframes vc-halo { 0% { transform: scale(1); opacity: .9 } 100% { transform: scale(1.35); opacity: 0 } }
        @keyframes vc-wave { 0%, 100% { transform: rotate(-12deg) } 50% { transform: rotate(14deg) } }
        @keyframes vc-blink { 50% { opacity: .35 } }
        .vc-eq { animation: vc-eq .7s ease-in-out infinite }
        .vc-mouth { animation: vc-mouth .45s ease-in-out infinite; transform-box: fill-box; transform-origin: center }
        .vc-halo { animation: vc-halo 1.2s ease-out infinite }
        .vc-wave { animation: vc-wave .9s ease-in-out infinite }
        .vc-rec { animation: vc-blink 1.4s ease-in-out infinite }
        .vc-scroll { scrollbar-width: none } .vc-scroll::-webkit-scrollbar { display: none }
        .vc-app button:focus-visible, .vc-app input:focus-visible, .vc-app [role=button]:focus-visible { outline: 2px solid ${accent}; outline-offset: 2px }
        .vc-app input::placeholder { color: ${MUTED} }
        @media (prefers-reduced-motion: reduce) { .vc-eq, .vc-mouth, .vc-halo, .vc-wave, .vc-rec { animation: none !important } .vc-tile { transition: none !important } }
      `}</style>
      <StatusBar frame={frame} />
      {!bare && (
        <div key={`${scr}/${stack.map((s) => s.id + (s.pid || '')).join('/')}`} className="vc-scroll" style={{ position: 'absolute', top: 54, bottom: tabbed && !top ? 88 : 0, left: 0, right: 0, overflowY: 'auto', paddingBottom: 24, animation: `${dir > 0 ? 'vc-r' : 'vc-l'} .28s ease` }}>
          {body}
        </div>
      )}
      {bare && !top && (
        <>
          <div style={{ position: 'absolute', top: 54, left: 12, right: 12, zIndex: 14, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 36, padding: '0 14px 0 12px', borderRadius: 18, background: 'rgba(8,10,22,.6)', backdropFilter: 'blur(8px)', fontSize: 14, fontWeight: 700 }}>
              <i className="vc-rec" style={{ width: 8, height: 8, borderRadius: 4, background: BAD }} />
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{mmss(secs)}</span>
              <span style={{ color: MUTED, fontWeight: 600 }}>Design sync</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[['people', 'Participants', 'participants', people.length + 1], ['chat', 'Chat', 'chat', unread], ['gear', 'Settings', 'settings', 0]].map(([ic, l, to, badge]) => (
                <button key={to} type="button" onClick={() => go(to)} aria-label={badge ? `${l}, ${badge}` : l} style={{ position: 'relative', width: 40, height: 36, borderRadius: 18, border: 'none', background: 'rgba(8,10,22,.6)', backdropFilter: 'blur(8px)', color: '#fff', display: 'grid', placeItems: 'center', cursor: 'pointer', padding: 0 }}>
                  <Icon name={ic} size={19} />
                  {badge > 0 && <span style={{ position: 'absolute', right: -3, top: -4, minWidth: 17, height: 17, borderRadius: 9, padding: '0 4px', background: to === 'chat' ? BAD : accent, fontSize: 10.5, fontWeight: 800, display: 'grid', placeItems: 'center' }}>{badge}</span>}
                </button>
              ))}
            </div>
          </div>
          {sharing && (
            <div style={{ position: 'absolute', top: 100, left: 12, right: 12, zIndex: 14, height: 28, borderRadius: 14, background: GOOD, color: '#04251a', fontSize: 12.5, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Icon name="screen" size={14} w={2.4} /> You are sharing your screen
            </div>
          )}
          <div style={{ position: 'absolute', left: AREA.x, top: AREA.y + (sharing ? 28 : 0), width: AREA.w, height: AREA.h - (sharing ? 28 : 0) }}>
            {ord.length === 0 && (
              <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center', borderRadius: 24, border: `2px dashed ${LINE}`, color: MUTED, fontSize: 14, padding: 30 }}>
                <div>
                  <Icon name="people" size={42} color={accent} />
                  <div style={{ margin: '10px 0 14px' }}>You are the only one here.</div>
                  <button type="button" onClick={() => go('participants')} style={{ height: 40, padding: '0 22px', borderRadius: 20, border: 'none', background: accent, color: '#fff', font: 'inherit', fontWeight: 700, cursor: 'pointer' }}>Invite people</button>
                </div>
              </div>
            )}
            {ord.map((id, i) => {
              const p = people.find((x) => x.id === id)
              return <Tile key={id} p={p} rect={rects[i]} speaking={speaker === id && !p.muted} pinned={pinned === id} accent={accent} onTap={() => togglePin(id)} uid="call" />
            })}
          </div>
          {set.captions && speaker && people.find((p) => p.id === speaker) && (
            <div style={{ position: 'absolute', left: 24, right: 24, bottom: 130, zIndex: 13, padding: '8px 12px', borderRadius: 12, background: 'rgba(0,0,0,.72)', fontSize: 13, textAlign: 'center' }}>
              <b>{people.find((p) => p.id === speaker).name.split(' ')[0]}:</b> ...and that is why the second option works better.
            </div>
          )}
          {allMuted && <div style={{ position: 'absolute', left: '50%', top: 112, transform: 'translateX(-50%)', zIndex: 13, padding: '5px 12px', borderRadius: 14, background: 'rgba(8,10,22,.75)', fontSize: 12, fontWeight: 700, color: '#fbbf24' }}>Everyone is muted</div>}
          <SelfView me={me} scale={scale} accent={accent} big={big} onTap={() => setBig((b) => !b)} sharing={sharing} mirror={set.mirror && !me.flip} speaking={false} />
          <div style={{ position: 'absolute', left: 12, right: 12, bottom: 32, zIndex: 16, height: 68, borderRadius: 34, background: 'rgba(14,18,38,.78)', backdropFilter: 'blur(14px)', border: '1px solid rgba(255,255,255,.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 10px' }}>
            {roundBtn(me.muted ? 'micoff' : 'mic', me.muted ? 'Unmute' : 'Mute', !me.muted, () => (setMe((m) => ({ ...m, muted: !m.muted })), say(me.muted ? 'Microphone on' : 'Microphone muted')))}
            {roundBtn(me.cam ? 'cam' : 'camoff', me.cam ? 'Camera off' : 'Camera on', me.cam, () => (setMe((m) => ({ ...m, cam: !m.cam })), say(me.cam ? 'Camera off' : 'Camera on')))}
            {roundBtn('flip', 'Flip camera', me.flip, () => (setMe((m) => ({ ...m, flip: !m.flip })), say(me.flip ? 'Front camera' : 'Back camera')), { onBg: accent, onFg: '#fff' })}
            {roundBtn('screen', sharing ? 'Stop sharing' : 'Share screen', sharing, () => (setSharing(!sharing), say(sharing ? 'Stopped sharing' : 'Sharing your screen')), { onBg: GOOD, onFg: '#04251a' })}
            {roundBtn('hand', me.hand ? 'Lower hand' : 'Raise hand', me.hand, () => (setMe((m) => ({ ...m, hand: !m.hand })), say(me.hand ? 'Hand lowered' : 'Hand raised')), { onBg: '#fbbf24', onFg: '#3b2a00' })}
            {roundBtn('end', 'Leave call', false, leave, { bad: true, w: 56 })}
          </div>
        </>
      )}
      {tabbed && !top && (
        <nav aria-label="Main" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 88, background: '#0f1429', borderRadius: '26px 26px 0 0', borderTop: `1px solid ${LINE}`, display: 'flex', justifyContent: 'space-around', padding: '10px 8px 0', zIndex: 18 }}>
          {TABS.map(([id, icon, label]) => (
            <button key={id} type="button" onClick={() => go(id === 'call' && !joined ? 'lobby' : id)} aria-current={scr === id ? 'page' : undefined} style={{ position: 'relative', border: 'none', background: 'none', font: 'inherit', cursor: 'pointer', display: 'grid', justifyItems: 'center', alignContent: 'start', gap: 3, width: 70, height: 54, fontSize: 11, fontWeight: 600, color: scr === id ? accent : MUTED }}>
              <Icon name={icon} size={23} />
              {label}
              {id === 'chat' && unread > 0 && <span style={{ position: 'absolute', right: 14, top: 0, minWidth: 17, height: 17, borderRadius: 9, padding: '0 4px', background: BAD, color: '#fff', fontSize: 10.5, fontWeight: 800, display: 'grid', placeItems: 'center' }}>{unread}</span>}
            </button>
          ))}
        </nav>
      )}
      <div role="status" style={{ position: 'absolute', left: '50%', top: 58, zIndex: 45, transform: `translate(-50%, ${toast ? 0 : -90}px)`, transition: 'transform .35s cubic-bezier(.2,.8,.2,1)', padding: '10px 16px', borderRadius: 20, background: '#fff', color: '#10152a', fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap' }}>{toast}</div>
      <div style={{ position: 'absolute', left: '50%', bottom: 8, width: 140, height: 5, marginLeft: -70, borderRadius: 3, background: '#fff', opacity: 0.75, zIndex: 50, pointerEvents: 'none' }} />
    </div>
  )

  return (
    <div ref={box} className="vc-app" aria-label={name} style={{ position: 'relative', width: '100%', height: '100%', display: 'grid', placeItems: 'center', overflow: 'hidden', background: 'radial-gradient(ellipse at 50% 30%, #262e5c, #090c1b 75%)', ...style }}>
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
