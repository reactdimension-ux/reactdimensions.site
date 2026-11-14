import { useEffect, useRef, useState } from 'react'

// A podcast app on a phone, as a click-through prototype. Five pages: Home,
// Show (pushed from Home or the Shows tab), Episode (pushed), Downloads and
// Settings. The mini player sits above the tab bar on every page and expands
// to a full-screen player: speed chips change how fast the simulated clock
// runs, the skip buttons jump back 15 s and forward 30 s, and a sleep timer
// pauses playback. Download buttons start real progress bars that tick up and
// land in Downloads, where you can pause, cancel or delete them. Settings
// toggles carry state. Artwork is drawn in SVG, no audio files. The phone
// scales to fit whatever box it is in.

const W = 390 // the phone screen, in CSS px (an iPhone's width)
const H = 844
const INK = '#2a1f1a'
const MUTED = '#8a7d73'
const BG = '#faf5ee'
const CARD = '#ffffff'
const LINE = '#eee4d8'
const FONT = "-apple-system, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif"
const SERIF = "Georgia, 'Iowan Old Style', 'Times New Roman', serif"

const SHOWS = [
  { id: 's1', title: 'The Long Way', host: 'Mara Quinn', hue: 18, pattern: 0, about: 'Slow travel stories told by people who took the scenic route, on purpose.' },
  { id: 's2', title: 'Signal & Noise', host: 'Dev Anand', hue: 212, pattern: 1, about: 'A weekly look at the technology behind the headlines, minus the hype.' },
  { id: 's3', title: 'Small Hours', host: 'Iris Vale', hue: 268, pattern: 2, about: 'Quiet late-night stories to fall asleep to. Best listened to in the dark.' },
  { id: 's4', title: 'Dirt Road Kitchen', host: 'Tom & Lena', hue: 96, pattern: 3, about: 'Two cooks, one old truck, and the best meals found off the main road.' },
]

const EPS = [
  { id: 'e1', show: 's1', title: 'Night train to nowhere', dur: 2412, date: 'Today', mb: 58, desc: 'Mara rides the overnight sleeper across the country and talks to everyone awake after midnight.', chap: [[0, 'Boarding'], [420, 'The dining car'], [1180, 'A stranger’s map'], [1900, 'Arrival']] },
  { id: 'e2', show: 's1', title: 'Lost luggage, found friends', dur: 1860, date: 'Mon', mb: 45, desc: 'What happens when the airline loses your bag and you spend three days in a town you never planned on.', chap: [[0, 'Baggage claim'], [600, 'The guesthouse'], [1400, 'Farewell']] },
  { id: 'e3', show: 's1', title: 'The coast road in winter', dur: 2250, date: 'Last week', mb: 54, desc: 'Empty beaches, closed cafes, and a lighthouse keeper with opinions.', chap: [[0, 'Off season'], [900, 'The lighthouse']] },
  { id: 'e4', show: 's2', title: 'Why your battery dies', dur: 2640, date: 'Today', mb: 63, desc: 'Chemistry, firmware, and a very patient engineer explain the slow death of a phone battery.', chap: [[0, 'Intro'], [500, 'Lithium basics'], [1500, 'What you can do']] },
  { id: 'e5', show: 's2', title: 'The cloud is a building', dur: 2100, date: 'Tue', mb: 50, desc: 'A tour of the warehouse-sized machines that store your photos.', chap: [[0, 'Intro'], [700, 'Cooling'], [1500, 'Water']] },
  { id: 'e6', show: 's2', title: 'Passwords, but kinder', dur: 1740, date: 'Last week', mb: 42, desc: 'Passkeys finally make sense. We explain how and why they are better.', chap: [[0, 'Intro'], [800, 'Passkeys']] },
  { id: 'e7', show: 's3', title: 'The lighthouse at Dun Rock', dur: 3300, date: 'Yesterday', mb: 79, desc: 'A gentle, unhurried story about the last keeper on a rocky island. Volume low, lights off.', chap: [[0, 'Settling in'], [1200, 'The storm'], [2400, 'Morning']] },
  { id: 'e8', show: 's3', title: 'Snowed in at the observatory', dur: 3000, date: 'Sat', mb: 72, desc: 'Three astronomers, one broken road, and a very long night.', chap: [[0, 'Settling in'], [1500, 'The stars']] },
  { id: 'e9', show: 's4', title: 'The perfect roadside pie', dur: 1980, date: 'Today', mb: 47, desc: 'Tom and Lena chase a legendary peach pie across three counties.', chap: [[0, 'The rumor'], [800, 'The diner'], [1500, 'The pie']] },
  { id: 'e10', show: 's4', title: 'Cooking on one burner', dur: 1620, date: 'Wed', mb: 39, desc: 'Dinner for six from a single camp stove. It can be done.', chap: [[0, 'Mise en place'], [700, 'The cook']] },
]
const EP = Object.fromEntries(EPS.map((e) => [e.id, e]))
const SHOW = Object.fromEntries(SHOWS.map((s) => [s.id, s]))
const SPEEDS = [0.8, 1, 1.25, 1.5, 2]
const SLEEPS = [0, 5, 15, 30]

const NAV = [
  ['home', 'home', 'Home'],
  ['shows', 'grid', 'Shows'],
  ['downloads', 'dl', 'Downloads'],
  ['settings', 'sliders', 'Settings'],
]

const fmt = (s) => {
  s = Math.max(0, Math.floor(s))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const x = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${x}` : `${m}:${x}`
}
const mins = (s) => `${Math.round(s / 60)} min`

const ICONS = {
  home: 'M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z',
  grid: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  dl: 'M12 4v11m0 0l-4-4m4 4l4-4M5 20h14',
  sliders: 'M4 7h10M18 7h2M4 17h2M10 17h10M14 5v4M6 15v4',
  back: 'M15 5l-7 7 7 7',
  chev: 'M9 5l7 7-7 7',
  down: 'M6 9l6 6 6-6',
  plus: 'M12 5v14M5 12h14',
  check: 'M5 12l5 5 9-10',
  x: 'M6 6l12 12M18 6L6 18',
  trash: 'M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13',
  share: 'M12 16V4m0 0l-4 4m4-4l4 4M5 12v7h14v-7',
  moon: 'M20 14a8 8 0 1 1-10-10 6 6 0 0 0 10 10z',
  bell: 'M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4',
  wifi: 'M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 19.5h.01',
  bolt: 'M13 3L5 14h6l-1 7 8-11h-6z',
  sort: 'M7 4v16m0 0l-3-3m3 3l3-3M17 20V4m0 0l-3 3m3-3l3 3',
  pause2: 'M9 5v14M15 5v14',
}
const FILLED = {
  play: 'M8 5v14l11-7z',
  pause: 'M7 5h4v14H7zM13 5h4v14h-4z',
}

function Icon({ name, size = 22, color = 'currentColor', w = 1.9 }) {
  if (FILLED[name]) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden="true">
        <path d={FILLED[name]} />
      </svg>
    )
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  )
}

// a circular arrow with the skip amount inside, back or forward
function Skip({ n, fwd, size = 40 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={fwd ? 'M32 21a12 12 0 1 1-4-9M28 5v7h-7' : 'M8 21a12 12 0 1 0 4-9M12 5v7h7'} />
      <text x="20" y="25.5" textAnchor="middle" fontSize="12" fontWeight="800" fill="currentColor" stroke="none">{n}</text>
    </svg>
  )
}

const iconBtn = { display: 'grid', placeItems: 'center', border: 'none', borderRadius: '50%', cursor: 'pointer', padding: 0, background: 'transparent', color: INK }

// show artwork drawn in SVG
function Art({ s, size = 60, radius = 14 }) {
  const h = s.hue
  const id = `pa${s.id}${size}`
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ borderRadius: radius, flex: 'none', display: 'block' }} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={`hsl(${h} 85% 62%)`} />
          <stop offset="1" stopColor={`hsl(${(h + 30) % 360} 70% 36%)`} />
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill={`url(#${id})`} />
      {s.pattern === 0 && (
        <>
          <path d="M-5 78Q30 40 55 62T105 40" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeDasharray="1 11" />
          <circle cx="74" cy="26" r="12" fill="#fff" opacity=".9" />
        </>
      )}
      {s.pattern === 1 && (
        <>
          <path d="M8 60h14l6-24 10 44 10-36 8 16h36" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {s.pattern === 2 && (
        <>
          <circle cx="62" cy="38" r="22" fill="#fff" opacity=".92" />
          <circle cx="72" cy="31" r="20" fill={`hsl(${h} 55% 30%)`} />
          {[[18, 22], [30, 70], [82, 78], [20, 48]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="2.4" fill="#fff" />)}
        </>
      )}
      {s.pattern === 3 && (
        <>
          <circle cx="50" cy="52" r="26" fill="#fff" opacity=".92" />
          <circle cx="50" cy="52" r="18" fill="none" stroke={`hsl(${h} 60% 40%)`} strokeWidth="4" />
          <path d="M22 80h56" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
        </>
      )}
    </svg>
  )
}

function StatusBar({ frame }) {
  const clock = new Date().toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' })
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 60, height: 54, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 30px 0 36px', fontSize: 16, fontWeight: 600, color: INK, pointerEvents: 'none' }}>
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

// the scaled phone, with an optional device frame
function Shell({ frame, backdrop, style, children }) {
  const box = useRef()
  const [scale, setScale] = useState(1)
  useEffect(() => {
    const ro = new ResizeObserver(([e]) => {
      const fw = frame ? W + 28 : W
      const fh = frame ? H + 28 : H
      setScale(Math.min(1.2, (e.contentRect.width - 24) / fw, (e.contentRect.height - 24) / fh))
    })
    ro.observe(box.current)
    return () => ro.disconnect()
  }, [frame])
  const phone = (
    <div style={{ position: 'relative', width: W, height: H, overflow: 'hidden', borderRadius: frame ? 46 : 0, background: BG, color: INK, fontFamily: FONT }}>{children}</div>
  )
  return (
    <div ref={box} className="pc-app" style={{ position: 'relative', width: '100%', height: '100%', display: 'grid', placeItems: 'center', overflow: 'hidden', background: backdrop, ...style }}>
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: `translate(-50%, -50%) scale(${scale})`, transformOrigin: 'center' }}>
        {frame ? (
          <div style={{ padding: 12, borderRadius: 58, background: 'linear-gradient(145deg, #4a4038, #1c1815 40%, #3a322b)', boxShadow: '0 40px 80px rgba(60,35,15,.35), inset 0 0 0 2px #5c5249' }}>
            <div style={{ padding: 2, borderRadius: 48, background: '#000' }}>{phone}</div>
          </div>
        ) : (
          phone
        )}
      </div>
    </div>
  )
}

function Bar({ value, color, h = 5 }) {
  return (
    <span style={{ display: 'block', height: h, borderRadius: h, background: LINE, overflow: 'hidden' }}>
      <span style={{ display: 'block', height: '100%', width: `${Math.min(100, Math.max(0, value * 100))}%`, background: color, borderRadius: h, transition: 'width .3s linear' }} />
    </span>
  )
}

// ---------------------------------------------------------------- app

export default function PodcastApp({ name = 'Pocketcast', accent = '#e8590c', startScreen = 'home', frame = true, style }) {
  const toastTimer = useRef()
  const init = (s) => (s === 'show' ? { tab: 'home', stack: [{ id: 'show', show: 's1' }] } : s === 'episode' ? { tab: 'home', stack: [{ id: 'show', show: 's1' }, { id: 'episode', ep: 'e1' }] } : { tab: s, stack: [] })
  const [tab, setTab] = useState(() => init(startScreen).tab)
  const [stack, setStack] = useState(() => init(startScreen).stack)
  const [dir, setDir] = useState(1)
  const [cur, setCur] = useState('e1') // episode loaded in the player
  const [playing, setPlaying] = useState(false)
  const [prog, setProg] = useState({ e1: 640, e4: 1210, e7: 3290 }) // seconds listened per episode
  const [speed, setSpeed] = useState(1)
  const [expanded, setExpanded] = useState(false)
  const [sleep, setSleep] = useState(0) // minutes chosen, 0 = off
  const [sleepLeft, setSleepLeft] = useState(0) // seconds
  const [subs, setSubs] = useState({ s1: true, s2: true, s3: true })
  const [dl, setDl] = useState({ e7: { p: 1, st: 'done' }, e4: { p: 0.46, st: 'down' } })
  const [oldest, setOldest] = useState(false)
  const [set, setSet] = useState({ auto: true, wifi: true, skipSilence: false, notify: true, trim: false })
  const [toast, setToast] = useState('')

  useEffect(() => {
    const i = init(startScreen)
    setTab(i.tab)
    setStack(i.stack)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startScreen])

  const say = (t) => {
    setToast(t)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 1700)
  }
  useEffect(() => () => clearTimeout(toastTimer.current), [])

  const ep = EP[cur]
  const pos = prog[cur] || 0
  const effSpeed = speed * (set.skipSilence ? 1.1 : 1)

  // the simulated playback clock (speed makes it run faster)
  useEffect(() => {
    if (!playing) return undefined
    const id = setInterval(() => {
      setProg((p) => {
        const e = EP[cur]
        const v = Math.min(e.dur, (p[cur] || 0) + 0.25 * effSpeed)
        return { ...p, [cur]: v }
      })
    }, 250)
    return () => clearInterval(id)
  }, [playing, cur, effSpeed])

  useEffect(() => {
    if (playing && pos >= ep.dur) {
      setPlaying(false)
      say('Episode finished')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos, playing])

  // the sleep timer counts real seconds while playing
  useEffect(() => {
    if (!playing || !sleepLeft) return undefined
    const id = setInterval(() => setSleepLeft((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(id)
  }, [playing, sleepLeft > 0])
  useEffect(() => {
    if (sleep && sleepLeft === 0) {
      setSleep(0)
      setPlaying(false)
      say('Sleep timer: paused')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sleepLeft])

  // downloads tick up while any are in progress
  const anyDown = Object.values(dl).some((d) => d.st === 'down')
  useEffect(() => {
    if (!anyDown) return undefined
    const id = setInterval(() => {
      setDl((d) => {
        const n = {}
        for (const [k, v] of Object.entries(d)) {
          if (v.st !== 'down') n[k] = v
          else {
            const p = Math.min(1, v.p + 0.04 + Math.random() * 0.06)
            n[k] = p >= 1 ? { p: 1, st: 'done' } : { p, st: 'down' }
          }
        }
        return n
      })
    }, 350)
    return () => clearInterval(id)
  }, [anyDown])

  const seek = (t) => setProg((p) => ({ ...p, [cur]: Math.min(ep.dur, Math.max(0, t)) }))
  const skip = (d) => seek(pos + d)
  const play = (id, at) => {
    if (id !== cur) setCur(id)
    if (at != null) setProg((p) => ({ ...p, [id]: at }))
    else if ((prog[id] || 0) >= EP[id].dur - 1) setProg((p) => ({ ...p, [id]: 0 }))
    setPlaying(true)
  }
  const startDl = (id) => {
    setDl((d) => ({ ...d, [id]: { p: 0, st: 'down' } }))
    say('Download started')
  }
  const cycleSleep = () => {
    const n = SLEEPS[(SLEEPS.indexOf(sleep) + 1) % SLEEPS.length]
    setSleep(n)
    setSleepLeft(n * 60)
    say(n ? `Sleep in ${n} min` : 'Sleep timer off')
  }

  const push = (s) => (setDir(1), setStack((a) => [...a, s]))
  const pop = () => (setDir(-1), setStack((a) => a.slice(0, -1)))
  const go = (t) => {
    setDir(NAV.findIndex((n) => n[0] === t) >= NAV.findIndex((n) => n[0] === tab) ? 1 : -1)
    setTab(t)
    setStack([])
  }

  const top = stack[stack.length - 1]
  const doneEp = (id) => (prog[id] || 0) >= EP[id].dur - 1

  // ---- shared bits
  const header = (title, back, right) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 18px 6px', minHeight: 52 }}>
      {back && (
        <button type="button" onClick={back} aria-label="Back" style={{ ...iconBtn, width: 38, height: 38, background: CARD, boxShadow: '0 1px 4px rgba(60,35,15,.1)' }}>
          <Icon name="back" size={20} />
        </button>
      )}
      <h1 style={{ margin: 0, flex: 1, fontFamily: SERIF, fontSize: back ? 19 : 30, fontWeight: 700, letterSpacing: '-0.01em', marginLeft: 4 }}>{title}</h1>
      {right}
    </div>
  )

  const dlButton = (id, size = 36) => {
    const d = dl[id]
    const common = { ...iconBtn, width: size, height: size, flex: 'none' }
    if (d?.st === 'done') return <button type="button" onClick={() => say('Downloaded. Remove it in Downloads')} aria-label="Downloaded" style={{ ...common, background: `${accent}1f`, color: accent }}><Icon name="check" size={18} /></button>
    if (d) {
      return (
        <button type="button" onClick={() => setDl((x) => ({ ...x, [id]: { ...x[id], st: x[id].st === 'down' ? 'paused' : 'down' } }))} aria-label={d.st === 'down' ? 'Pause download' : 'Resume download'} style={{ ...common, position: 'relative' }}>
          <svg width={size} height={size} viewBox="0 0 36 36" style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }} aria-hidden="true">
            <circle cx="18" cy="18" r="15" fill="none" stroke={LINE} strokeWidth="3" />
            <circle cx="18" cy="18" r="15" fill="none" stroke={accent} strokeWidth="3" strokeLinecap="round" strokeDasharray={`${d.p * 94.2} 94.2`} />
          </svg>
          <Icon name={d.st === 'down' ? 'pause' : 'play'} size={13} color={accent} />
        </button>
      )
    }
    return <button type="button" onClick={() => startDl(id)} aria-label="Download episode" style={{ ...common, background: '#f3ebe0' }}><Icon name="dl" size={18} /></button>
  }

  const epRow = (e, showArt = true) => {
    const s = SHOW[e.show]
    const active = cur === e.id
    const left = e.dur - (prog[e.id] || 0)
    return (
      <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 10px 10px 12px', borderRadius: 20, background: CARD, boxShadow: '0 1px 3px rgba(60,35,15,.07)', outline: active ? `2px solid ${accent}55` : 'none' }}>
        <button type="button" onClick={() => push({ id: 'episode', ep: e.id })} aria-label={`Open ${e.title}`} style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0, overflow: 'hidden', border: 'none', background: 'none', font: 'inherit', color: INK, textAlign: 'left', cursor: 'pointer', padding: 0 }}>
          {showArt && <Art s={s} size={54} radius={13} />}
          <span style={{ minWidth: 0, flex: 1 }}>
            <span style={{ display: 'block', fontSize: 11, color: accent, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em' }}>{s.title} · {e.date}</span>
            <span style={{ fontSize: 14.5, fontWeight: 700, marginTop: 2, lineHeight: 1.25, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{e.title}</span>
            <span style={{ display: 'block', fontSize: 12, color: MUTED, marginTop: 3 }}>{doneEp(e.id) ? 'Played' : prog[e.id] ? `${mins(left)} left` : mins(e.dur)}</span>
          </span>
        </button>
        {dlButton(e.id, 34)}
        <button type="button" onClick={() => (active && playing ? setPlaying(false) : play(e.id))} aria-label={active && playing ? 'Pause' : `Play ${e.title}`} style={{ ...iconBtn, width: 40, height: 40, flex: 'none', background: accent, color: '#fff' }}>
          <Icon name={active && playing ? 'pause' : 'play'} size={18} />
        </button>
      </div>
    )
  }

  const switchRow = (key, label, icon, sub) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 0', borderBottom: `1px solid ${LINE}` }}>
      <span style={{ width: 34, height: 34, borderRadius: 10, display: 'grid', placeItems: 'center', background: `${accent}1c`, color: accent, flex: 'none' }}><Icon name={icon} size={18} /></span>
      <span style={{ flex: 1 }}>
        <span style={{ display: 'block', fontSize: 14.5, fontWeight: 600 }}>{label}</span>
        {sub && <span style={{ display: 'block', fontSize: 12, color: MUTED, marginTop: 1 }}>{sub}</span>}
      </span>
      <button type="button" role="switch" aria-checked={set[key]} aria-label={label} onClick={() => (setSet((s) => ({ ...s, [key]: !s[key] })), say(`${label} ${set[key] ? 'off' : 'on'}`))} style={{ width: 48, height: 28, borderRadius: 14, border: 'none', padding: 3, background: set[key] ? accent : '#d9cfc3', cursor: 'pointer', transition: 'background .2s' }}>
        <span style={{ display: 'block', width: 22, height: 22, borderRadius: '50%', background: '#fff', transform: `translateX(${set[key] ? 20 : 0}px)`, transition: 'transform .2s' }} />
      </button>
    </div>
  )

  const section = (t, right) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '18px 20px 10px' }}>
      <h2 style={{ margin: 0, fontFamily: SERIF, fontSize: 19, fontWeight: 700 }}>{t}</h2>
      {right}
    </div>
  )

  // ---- screens
  let body
  if (top?.id === 'episode') {
    const e = EP[top.ep]
    const s = SHOW[e.show]
    const active = cur === e.id
    const d = dl[e.id]
    body = (
      <>
        {header('Episode', pop, <button type="button" onClick={() => say('Link copied')} aria-label="Share" style={{ ...iconBtn, width: 38, height: 38, background: CARD }}><Icon name="share" size={18} /></button>)}
        <div style={{ padding: '6px 20px 0', display: 'flex', gap: 14, alignItems: 'center' }}>
          <Art s={s} size={104} radius={22} />
          <div style={{ minWidth: 0 }}>
            <button type="button" onClick={() => push({ id: 'show', show: s.id })} style={{ border: 'none', background: 'none', padding: 0, color: accent, font: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{s.title} ›</button>
            <div style={{ fontFamily: SERIF, fontSize: 21, fontWeight: 700, lineHeight: 1.2, marginTop: 4 }}>{e.title}</div>
            <div style={{ fontSize: 12.5, color: MUTED, marginTop: 6 }}>{e.date} · {mins(e.dur)}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, padding: '16px 20px 6px', alignItems: 'center' }}>
          <button type="button" onClick={() => (active && playing ? setPlaying(false) : play(e.id))} style={{ flex: 1, height: 48, borderRadius: 24, border: 'none', background: accent, color: '#fff', font: 'inherit', fontSize: 15, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Icon name={active && playing ? 'pause' : 'play'} size={18} />
            {active && playing ? 'Pause' : prog[e.id] && !doneEp(e.id) ? `Resume · ${mins(e.dur - prog[e.id])} left` : 'Play'}
          </button>
          {dlButton(e.id, 48)}
        </div>
        {(prog[e.id] > 0 || d) && (
          <div style={{ padding: '4px 20px 0', fontSize: 12, color: MUTED, display: 'grid', gap: 6 }}>
            {prog[e.id] > 0 && <Bar value={prog[e.id] / e.dur} color={accent} />}
            {d && <div>{d.st === 'done' ? `Downloaded · ${e.mb} MB` : `${d.st === 'down' ? 'Downloading' : 'Paused'} · ${Math.round(d.p * 100)}% of ${e.mb} MB`}</div>}
          </div>
        )}
        {section('About this episode')}
        <p style={{ margin: '0 20px', fontSize: 14.5, lineHeight: 1.55, color: '#4b3f37' }}>{e.desc}</p>
        {section('Chapters')}
        <div style={{ margin: '0 20px', background: CARD, borderRadius: 20, padding: '2px 14px' }}>
          {e.chap.map(([t, c], i) => (
            <button key={t} type="button" onClick={() => (play(e.id, t), say(`Jumped to ${c}`))} style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 12, padding: '12px 0', border: 'none', borderBottom: i < e.chap.length - 1 ? `1px solid ${LINE}` : 'none', background: 'none', font: 'inherit', color: INK, textAlign: 'left', cursor: 'pointer' }}>
              <span style={{ fontSize: 12.5, color: accent, fontWeight: 700, width: 48, fontVariantNumeric: 'tabular-nums' }}>{fmt(t)}</span>
              <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{c}</span>
              <Icon name="play" size={14} color={MUTED} />
            </button>
          ))}
        </div>
        <div style={{ padding: '16px 20px 0' }}>
          <button type="button" onClick={() => (setProg((p) => ({ ...p, [e.id]: doneEp(e.id) ? 0 : e.dur })), say(doneEp(e.id) ? 'Marked unplayed' : 'Marked played'))} style={{ width: '100%', height: 46, borderRadius: 23, border: `1.5px solid ${LINE}`, background: 'none', font: 'inherit', fontSize: 14, fontWeight: 600, color: INK, cursor: 'pointer' }}>{doneEp(e.id) ? 'Mark as unplayed' : 'Mark as played'}</button>
        </div>
      </>
    )
  } else if (top?.id === 'show') {
    const s = SHOW[top.show]
    let list = EPS.filter((e) => e.show === s.id)
    if (oldest) list = [...list].reverse()
    body = (
      <>
        {header(s.title, pop)}
        <div style={{ textAlign: 'center', padding: '4px 20px 0' }}>
          <div style={{ display: 'inline-block', borderRadius: 28, boxShadow: `0 16px 34px hsl(${s.hue} 70% 40% / .35)` }}><Art s={s} size={150} radius={28} /></div>
          <div style={{ fontFamily: SERIF, fontSize: 24, fontWeight: 700, marginTop: 14 }}>{s.title}</div>
          <div style={{ fontSize: 13, color: MUTED, marginTop: 2 }}>{s.host}</div>
          <p style={{ margin: '10px 4px 0', fontSize: 13.5, lineHeight: 1.5, color: '#4b3f37' }}>{s.about}</p>
        </div>
        <div style={{ display: 'flex', gap: 10, padding: '14px 20px 0' }}>
          <button type="button" onClick={() => (setSubs((x) => ({ ...x, [s.id]: !x[s.id] })), say(subs[s.id] ? 'Unsubscribed' : `Subscribed to ${s.title}`))} aria-pressed={!!subs[s.id]} style={{ flex: 1, height: 46, borderRadius: 23, border: subs[s.id] ? `1.5px solid ${accent}` : 'none', background: subs[s.id] ? 'none' : accent, color: subs[s.id] ? accent : '#fff', font: 'inherit', fontSize: 14.5, fontWeight: 700, cursor: 'pointer' }}>{subs[s.id] ? 'Subscribed ✓' : 'Subscribe'}</button>
          <button type="button" onClick={() => play(list.find((e) => !doneEp(e.id))?.id || list[0].id)} style={{ flex: 1, height: 46, borderRadius: 23, border: 'none', background: '#f0e6d9', color: INK, font: 'inherit', fontSize: 14.5, fontWeight: 700, cursor: 'pointer' }}>Play latest</button>
        </div>
        {section('Episodes', <button type="button" onClick={() => setOldest(!oldest)} style={{ border: 'none', background: 'none', padding: 0, color: accent, font: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}><Icon name="sort" size={14} /> {oldest ? 'Oldest first' : 'Newest first'}</button>)}
        <div style={{ display: 'grid', gap: 8, padding: '0 20px' }}>{list.map((e) => epRow(e, false))}</div>
      </>
    )
  } else if (tab === 'home') {
    const resume = EP[cur]
    const fresh = EPS.filter((e) => subs[e.show] && !prog[e.id] && e.id !== cur).slice(0, 4)
    body = (
      <>
        <div style={{ padding: '8px 20px 0' }}>
          <div style={{ fontSize: 13, color: MUTED }}>Good evening</div>
          <h1 style={{ margin: 0, fontFamily: SERIF, fontSize: 30, fontWeight: 700, letterSpacing: '-0.01em' }}>{name}</h1>
        </div>
        <button type="button" onClick={() => setExpanded(true)} aria-label="Open player" style={{ display: 'block', width: 'calc(100% - 40px)', margin: '16px 20px 0', border: 'none', textAlign: 'left', font: 'inherit', cursor: 'pointer', borderRadius: 26, padding: 16, color: '#fff', background: `linear-gradient(135deg, hsl(${SHOW[resume.show].hue} 75% 50%), hsl(${(SHOW[resume.show].hue + 30) % 360} 65% 28%))`, boxShadow: `0 14px 30px hsl(${SHOW[resume.show].hue} 70% 40% / .35)` }}>
          <span style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <Art s={SHOW[resume.show]} size={78} radius={18} />
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', opacity: 0.85 }}>Continue listening</span>
              <span style={{ display: 'block', fontFamily: SERIF, fontSize: 18, fontWeight: 700, marginTop: 4, lineHeight: 1.2 }}>{resume.title}</span>
              <span style={{ display: 'block', fontSize: 12.5, opacity: 0.85, marginTop: 4 }}>{mins(resume.dur - pos)} left</span>
            </span>
          </span>
          <span style={{ display: 'block', height: 4, borderRadius: 2, background: 'rgba(255,255,255,.3)', marginTop: 14 }}><span style={{ display: 'block', height: '100%', width: `${(pos / resume.dur) * 100}%`, background: '#fff', borderRadius: 2 }} /></span>
        </button>
        {section('Your shows', <button type="button" onClick={() => go('shows')} style={{ border: 'none', background: 'none', padding: 0, color: accent, font: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>See all</button>)}
        <div className="pc-scroll" style={{ display: 'flex', gap: 12, padding: '0 20px 4px', overflowX: 'auto' }}>
          {SHOWS.filter((s) => subs[s.id]).map((s) => (
            <button key={s.id} type="button" onClick={() => push({ id: 'show', show: s.id })} style={{ flex: 'none', width: 108, border: 'none', background: 'none', padding: 0, font: 'inherit', color: INK, textAlign: 'left', cursor: 'pointer' }}>
              <Art s={s} size={108} radius={20} />
              <span style={{ display: 'block', fontSize: 13, fontWeight: 700, marginTop: 7, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.title}</span>
            </button>
          ))}
          {!Object.values(subs).some(Boolean) && <span style={{ fontSize: 13, color: MUTED, padding: '20px 0' }}>Subscribe to a show to see it here.</span>}
        </div>
        {section('New episodes')}
        <div style={{ display: 'grid', gap: 8, padding: '0 20px' }}>
          {fresh.map((e) => epRow(e))}
          {!fresh.length && <div style={{ textAlign: 'center', color: MUTED, fontSize: 13, padding: '20px 0' }}>You are all caught up.</div>}
        </div>
      </>
    )
  } else if (tab === 'shows') {
    body = (
      <>
        {header('Shows')}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, padding: '6px 20px 0' }}>
          {SHOWS.map((s) => (
            <div key={s.id}>
              <button type="button" onClick={() => push({ id: 'show', show: s.id })} aria-label={`Open ${s.title}`} style={{ border: 'none', background: 'none', padding: 0, font: 'inherit', color: INK, textAlign: 'left', cursor: 'pointer', display: 'block' }}>
                <Art s={s} size={158} radius={24} />
                <span style={{ display: 'block', fontFamily: SERIF, fontSize: 15.5, fontWeight: 700, marginTop: 8 }}>{s.title}</span>
                <span style={{ display: 'block', fontSize: 12, color: MUTED }}>{s.host}</span>
              </button>
              <button type="button" onClick={() => (setSubs((x) => ({ ...x, [s.id]: !x[s.id] })), say(subs[s.id] ? 'Unsubscribed' : 'Subscribed'))} aria-pressed={!!subs[s.id]} style={{ marginTop: 8, height: 32, padding: '0 14px', borderRadius: 16, border: subs[s.id] ? `1.5px solid ${accent}` : 'none', background: subs[s.id] ? 'none' : accent, color: subs[s.id] ? accent : '#fff', font: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>{subs[s.id] ? 'Subscribed' : '+ Subscribe'}</button>
            </div>
          ))}
        </div>
      </>
    )
  } else if (tab === 'downloads') {
    const ids = Object.keys(dl)
    const active = ids.filter((id) => dl[id].st !== 'done')
    const done = ids.filter((id) => dl[id].st === 'done')
    const used = done.reduce((n, id) => n + EP[id].mb, 0)
    const row = (id, isDone) => {
      const e = EP[id]
      const d = dl[id]
      return (
        <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 18, background: CARD, boxShadow: '0 1px 3px rgba(60,35,15,.07)' }}>
          <button type="button" onClick={() => push({ id: 'episode', ep: id })} aria-label={`Open ${e.title}`} style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0, overflow: 'hidden', border: 'none', background: 'none', font: 'inherit', color: INK, textAlign: 'left', cursor: 'pointer', padding: 0 }}>
            <Art s={SHOW[e.show]} size={48} radius={12} />
            <span style={{ minWidth: 0, flex: 1 }}>
              <span style={{ display: 'block', fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.title}</span>
              {isDone ? (
                <span style={{ display: 'block', fontSize: 12, color: MUTED, marginTop: 2 }}>{e.mb} MB · {mins(e.dur)}</span>
              ) : (
                <span style={{ display: 'block', marginTop: 6 }}>
                  <Bar value={d.p} color={accent} />
                  <span style={{ display: 'block', fontSize: 11.5, color: MUTED, marginTop: 4 }}>{d.st === 'down' ? 'Downloading' : 'Paused'} · {Math.round(d.p * 100)}% · {(e.mb * d.p).toFixed(1)} of {e.mb} MB</span>
                </span>
              )}
            </span>
          </button>
          {isDone ? (
            <button type="button" onClick={() => (cur === id && playing ? setPlaying(false) : play(id))} aria-label="Play" style={{ ...iconBtn, width: 38, height: 38, background: accent, color: '#fff' }}><Icon name={cur === id && playing ? 'pause' : 'play'} size={16} /></button>
          ) : (
            dlButton(id, 38)
          )}
          <button type="button" onClick={() => (setDl((x) => { const n = { ...x }; delete n[id]; return n }), say(isDone ? 'Download removed' : 'Download cancelled'))} aria-label={isDone ? 'Delete download' : 'Cancel download'} style={{ ...iconBtn, width: 34, height: 34, color: MUTED }}><Icon name={isDone ? 'trash' : 'x'} size={17} /></button>
        </div>
      )
    }
    body = (
      <>
        {header('Downloads')}
        <div style={{ margin: '4px 20px 0', padding: 16, borderRadius: 22, background: CARD, boxShadow: '0 1px 3px rgba(60,35,15,.07)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
            <span>Storage used</span>
            <span style={{ color: MUTED }}>{used} MB of 2 GB</span>
          </div>
          <Bar value={used / 2048} color={accent} h={8} />
        </div>
        {active.length > 0 && section('Downloading', <button type="button" onClick={() => (setDl((x) => Object.fromEntries(Object.entries(x).map(([k, v]) => [k, v.st === 'paused' ? { ...v, st: 'down' } : v]))), say('Resumed all'))} style={{ border: 'none', background: 'none', padding: 0, color: accent, font: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Resume all</button>)}
        <div style={{ display: 'grid', gap: 8, padding: '0 20px' }}>{active.map((id) => row(id, false))}</div>
        {section('On this phone', done.length > 0 && <button type="button" onClick={() => (setDl((x) => Object.fromEntries(Object.entries(x).filter(([, v]) => v.st !== 'done'))), say('Downloads removed'))} style={{ border: 'none', background: 'none', padding: 0, color: '#c2410c', font: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Delete all</button>)}
        <div style={{ display: 'grid', gap: 8, padding: '0 20px' }}>
          {done.map((id) => row(id, true))}
          {!ids.length && (
            <div style={{ textAlign: 'center', color: MUTED, fontSize: 13, padding: '24px 0' }}>
              Nothing downloaded yet.
              <button type="button" onClick={() => go('home')} style={{ display: 'block', margin: '10px auto 0', border: 'none', background: 'none', color: accent, font: 'inherit', fontWeight: 700, cursor: 'pointer' }}>Find an episode</button>
            </div>
          )}
        </div>
      </>
    )
  } else {
    body = (
      <>
        {header('Settings')}
        <div style={{ margin: '4px 20px 0', padding: '0 16px', background: CARD, borderRadius: 22 }}>
          {switchRow('auto', 'Auto-download new episodes', 'dl', 'For shows you subscribe to')}
          {switchRow('wifi', 'Wi-Fi only', 'wifi', 'Never download on mobile data')}
          {switchRow('skipSilence', 'Skip silence', 'bolt', 'Plays about 10% faster')}
          {switchRow('trim', 'Trim intros', 'moon')}
          {switchRow('notify', 'New episode alerts', 'bell')}
        </div>
        <div style={{ margin: '14px 20px 0', padding: 16, background: CARD, borderRadius: 22 }}>
          <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 10 }}>Default playback speed</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {SPEEDS.map((sp) => (
              <button key={sp} type="button" onClick={() => (setSpeed(sp), say(`Speed ${sp}×`))} aria-pressed={speed === sp} style={{ flex: 1, height: 38, borderRadius: 19, border: 'none', background: speed === sp ? accent : '#f3ebe0', color: speed === sp ? '#fff' : INK, font: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{sp}×</button>
            ))}
          </div>
        </div>
        <div style={{ display: 'grid', gap: 10, padding: '16px 20px' }}>
          <button type="button" onClick={() => (setDl({}), say('Downloads cleared'))} style={{ height: 48, borderRadius: 24, border: 'none', background: '#f0e6d9', font: 'inherit', fontSize: 14, fontWeight: 600, color: INK, cursor: 'pointer' }}>Clear all downloads</button>
          <button type="button" onClick={() => (setProg({ e1: 640, e4: 1210, e7: 3290 }), setSubs({ s1: true, s2: true, s3: true }), setDl({ e7: { p: 1, st: 'done' }, e4: { p: 0.46, st: 'down' } }), setCur('e1'), setPlaying(false), setSpeed(1), go('home'), say('Demo reset'))} style={{ height: 48, borderRadius: 24, border: 'none', background: 'none', font: 'inherit', fontSize: 14, fontWeight: 600, color: '#c2410c', cursor: 'pointer' }}>Reset demo</button>
        </div>
      </>
    )
  }

  const sleepLabel = sleep ? `Sleep ${Math.ceil(sleepLeft / 60)}m` : 'Sleep'
  return (
    <Shell frame={frame} backdrop="radial-gradient(ellipse at 50% 30%, #fbe7d3, #d8b998 75%)" style={style}>
      <style>{`
        @keyframes pc-r { from { opacity: 0; transform: translateX(34px) } to { opacity: 1; transform: none } }
        @keyframes pc-l { from { opacity: 0; transform: translateX(-34px) } to { opacity: 1; transform: none } }
        .pc-scroll { scrollbar-width: none } .pc-scroll::-webkit-scrollbar { display: none }
        .pc-app button:focus-visible, .pc-app input:focus-visible { outline: 2px solid ${accent}; outline-offset: 2px }
        .pc-app input[type=range] { accent-color: ${accent} }
        @media (prefers-reduced-motion: reduce) { .pc-page { animation: none !important } .pc-full { transition: none !important } }
      `}</style>
      <StatusBar frame={frame} />
      <div key={`${tab}/${stack.map((s) => s.id + (s.show || s.ep || '')).join('/')}`} className="pc-scroll pc-page" style={{ position: 'absolute', top: 54, bottom: 88 + 70, left: 0, right: 0, overflowY: 'auto', paddingBottom: 24, animation: `${dir > 0 ? 'pc-r' : 'pc-l'} .28s ease` }}>
        {body}
      </div>

      <div style={{ position: 'absolute', left: 10, right: 10, bottom: 98, height: 62, zIndex: 9, borderRadius: 20, background: INK, color: '#fff', boxShadow: '0 10px 26px rgba(42,31,26,.35)', display: 'flex', alignItems: 'center', gap: 4, padding: '0 8px 0 9px', overflow: 'hidden' }}>
        <button type="button" onClick={() => setExpanded(true)} aria-label="Expand player" style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, border: 'none', background: 'none', color: '#fff', font: 'inherit', textAlign: 'left', cursor: 'pointer', padding: 0 }}>
          <Art s={SHOW[ep.show]} size={44} radius={11} />
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ep.title}</span>
            <span style={{ display: 'block', fontSize: 11.5, opacity: 0.65 }}>{SHOW[ep.show].title} · {fmt(ep.dur - pos)} left</span>
          </span>
        </button>
        <button type="button" onClick={() => skip(-15)} aria-label="Back 15 seconds" style={{ ...iconBtn, width: 38, height: 38, color: '#fff' }}><Skip n={15} size={26} /></button>
        <button type="button" onClick={() => (playing ? setPlaying(false) : play(cur))} aria-label={playing ? 'Pause' : 'Play'} style={{ ...iconBtn, width: 42, height: 42, background: accent, color: '#fff' }}><Icon name={playing ? 'pause' : 'play'} size={20} /></button>
        <span style={{ position: 'absolute', left: 0, bottom: 0, height: 3, width: `${(pos / ep.dur) * 100}%`, background: accent }} />
      </div>

      <nav aria-label="Main" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 88, zIndex: 13, background: 'rgba(250,245,238,.97)', borderTop: `1px solid ${LINE}`, display: 'flex', justifyContent: 'space-around', padding: '10px 8px 0' }}>
        {NAV.map(([id, icon, label]) => (
          <button key={id} type="button" onClick={() => go(id)} aria-current={tab === id && !top ? 'page' : undefined} style={{ border: 'none', background: 'none', font: 'inherit', cursor: 'pointer', display: 'grid', justifyItems: 'center', alignContent: 'start', gap: 3, width: 76, height: 54, fontSize: 11, fontWeight: 700, color: tab === id ? accent : MUTED }}>
            <Icon name={icon} size={23} />
            {label}
          </button>
        ))}
      </nav>

      <div className="pc-full" aria-hidden={!expanded} style={{ position: 'absolute', inset: 0, zIndex: 35, background: `linear-gradient(180deg, hsl(${SHOW[ep.show].hue} 70% 90%), ${BG} 60%)`, transform: `translateY(${expanded ? 0 : 100}%)`, visibility: expanded ? 'visible' : 'hidden', transition: 'transform .4s cubic-bezier(.2,.8,.2,1), visibility .4s', padding: '62px 24px 0', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button type="button" onClick={() => setExpanded(false)} aria-label="Collapse player" tabIndex={expanded ? 0 : -1} style={{ ...iconBtn, width: 40, height: 40, background: 'rgba(255,255,255,.7)' }}><Icon name="down" size={22} /></button>
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: MUTED }}>Now playing</span>
          <button type="button" onClick={() => (setExpanded(false), push({ id: 'episode', ep: cur }))} aria-label="Episode details" tabIndex={expanded ? 0 : -1} style={{ ...iconBtn, width: 40, height: 40, background: 'rgba(255,255,255,.7)' }}><Icon name="chev" size={20} /></button>
        </div>
        <div style={{ display: 'grid', placeItems: 'center', padding: '22px 0 18px' }}>
          <div style={{ borderRadius: 34, boxShadow: `0 24px 46px hsl(${SHOW[ep.show].hue} 70% 40% / .4)` }}><Art s={SHOW[ep.show]} size={236} radius={34} /></div>
        </div>
        <div style={{ fontFamily: SERIF, fontSize: 23, fontWeight: 700, lineHeight: 1.2 }}>{ep.title}</div>
        <div style={{ fontSize: 14, color: MUTED, marginTop: 4 }}>{SHOW[ep.show].title}</div>
        <div style={{ marginTop: 16 }}>
          <input type="range" min="0" max={ep.dur} step="1" value={Math.floor(pos)} onChange={(e) => seek(+e.target.value)} aria-label="Seek" tabIndex={expanded ? 0 : -1} style={{ width: '100%', margin: 0 }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: MUTED, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
            <span>{fmt(pos)}</span>
            <span>-{fmt(ep.dur - pos)}</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 6px 0' }}>
          <button type="button" onClick={() => skip(-15)} aria-label="Back 15 seconds" tabIndex={expanded ? 0 : -1} style={{ ...iconBtn, width: 60, height: 60 }}><Skip n={15} size={44} /></button>
          <button type="button" onClick={() => (playing ? setPlaying(false) : play(cur))} aria-label={playing ? 'Pause' : 'Play'} tabIndex={expanded ? 0 : -1} style={{ ...iconBtn, width: 78, height: 78, background: accent, color: '#fff', boxShadow: `0 12px 28px ${accent}66` }}><Icon name={playing ? 'pause' : 'play'} size={36} /></button>
          <button type="button" onClick={() => skip(30)} aria-label="Forward 30 seconds" tabIndex={expanded ? 0 : -1} style={{ ...iconBtn, width: 60, height: 60 }}><Skip n={30} fwd size={44} /></button>
        </div>
        <div role="group" aria-label="Playback speed" style={{ display: 'flex', gap: 7, marginTop: 20 }}>
          {SPEEDS.map((sp) => (
            <button key={sp} type="button" onClick={() => setSpeed(sp)} aria-pressed={speed === sp} tabIndex={expanded ? 0 : -1} style={{ flex: 1, height: 38, borderRadius: 19, border: 'none', background: speed === sp ? INK : 'rgba(255,255,255,.75)', color: speed === sp ? '#fff' : INK, font: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{sp}×</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 14, alignItems: 'center' }}>
          <button type="button" onClick={cycleSleep} tabIndex={expanded ? 0 : -1} style={{ height: 40, padding: '0 16px', borderRadius: 20, border: 'none', background: sleep ? accent : 'rgba(255,255,255,.75)', color: sleep ? '#fff' : INK, font: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="moon" size={16} /> {sleepLabel}</button>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 12, color: MUTED }}>{dl[cur]?.st === 'done' ? 'Downloaded' : dl[cur] ? `${Math.round(dl[cur].p * 100)}%` : ''}</span>
          {dlButton(cur, 40)}
        </div>
      </div>

      <div role="status" style={{ position: 'absolute', left: '50%', top: 58, zIndex: 70, transform: `translate(-50%, ${toast ? 0 : -90}px)`, transition: 'transform .35s cubic-bezier(.2,.8,.2,1)', padding: '10px 16px', borderRadius: 20, background: INK, color: '#fff', fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap' }}>{toast}</div>
      <div style={{ position: 'absolute', left: '50%', bottom: 8, width: 140, height: 5, marginLeft: -70, borderRadius: 3, background: INK, opacity: 0.8, zIndex: 65 }} />
    </Shell>
  )
}
