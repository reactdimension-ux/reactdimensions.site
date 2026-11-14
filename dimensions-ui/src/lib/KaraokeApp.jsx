import { useEffect, useRef, useState } from 'react'

// A karaoke app on a phone, as a click-through prototype. Five tabs: Songs,
// Player, Queue, Recordings and Settings. On Player a simulated track timer
// runs while the song plays and the lyrics follow it word by word: the current
// word fills with colour as it is "sung", the line scrolls to the middle, and
// tapping any line seeks to it. Pitch (key), music and mic sliders change
// state, and the red record button (with an optional 3-2-1 countdown) captures
// a take while the song plays; stopping it, or reaching the end of the song,
// saves it to Recordings with a score, where you can play it back, favourite,
// share or delete it. Songs, lyrics and artwork are invented and drawn in
// SVG/CSS, no audio. The phone scales to fit whatever box it is in.

const W = 390 // the phone screen, in CSS px (an iPhone's width)
const H = 844
const INK = '#f5f0ff'
const MUTED = '#9b90b8'
const BG = '#0b0716'
const CARD = 'rgba(255,255,255,.065)'
const LINE = 'rgba(255,255,255,.09)'
const CYAN = '#38e1ff'
const FONT = "-apple-system, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif"

const RAW = [
  { id: 'k1', title: 'Midnight Highway', artist: 'Rue & The Rails', genre: 'Rock', hue: 12, intro: 6, gap: 15, text: ['Headlights paint the empty road', 'Radio hums a song I know', 'Every mile I leave behind', 'Is one more worry let go', 'So turn it up and drive on through', 'The city lights are fading blue', 'I am running toward the morning', 'And the morning is running too'] },
  { id: 'k2', title: 'Paper Hearts', artist: 'Lena Moro', genre: 'Ballad', hue: 330, intro: 8, gap: 16, text: ['You folded me a paper heart', 'Slipped it in my coat that day', 'Now it is creased and soft and worn', 'But it never fell away', 'If the rain comes washing in', 'I will keep the ink from running', 'Hold the corners hold them tight', 'Love was always worth the folding'] },
  { id: 'k3', title: 'Sunday Sugar', artist: 'Honey Static', genre: 'Pop', hue: 45, intro: 5, gap: 13, text: ['Pancakes on the kitchen floor', 'Dancing in our mismatched socks', 'Nothing in the world to do', 'But watch the clouds and stop the clocks', 'Sugar on a Sunday morning', 'Sweet as anything we know', 'Pour another cup of sunshine', 'Never let this feeling go'] },
  { id: 'k4', title: 'Echoes in the Hall', artist: 'Dual Voices', genre: 'Duet', hue: 265, intro: 7, gap: 15, text: ['I call your name across the room', 'And it comes back to me twice', 'Two voices find a single tune', 'Nothing here needs more advice', 'Sing it softly sing it loud', 'Let the whole wide hallway hear', 'We were always better together', 'Let the echo bring you near'] },
  { id: 'k5', title: 'Lantern Season', artist: 'Coast Kids', genre: 'Indie', hue: 190, intro: 6, gap: 14, text: ['Light a lantern light the sky', 'Let the whole town see it rise', 'Every wish a tiny flame', 'Carried up to meet the skies', 'We are small but we are many', 'Warm against the winter night', 'Hold my hand and watch them wander', 'Till the dark turns into light'] },
  { id: 'k6', title: 'Glitter Gravity', artist: 'Nova Pike', genre: 'Pop', hue: 300, intro: 5, gap: 12, text: ['You pull me in like gravity', 'Everything is glitter now', 'Spinning round your orbit', 'I forgot to ask you how', 'Hands up if you feel it too', 'Hands up if you do not care', 'We are comets in the city', 'Leaving sparkles in the air'] },
]

// work out when each line, and each word within it, is sung
const SONGS = RAW.map((s) => {
  const lines = s.text.map((txt, i) => {
    const start = s.intro + i * s.gap
    const ws = txt.split(' ')
    const tot = ws.reduce((n, w) => n + w.length + 1, 0)
    let c = start
    const words = ws.map((w) => {
      const d = ((w.length + 1) / tot) * s.gap * 0.86
      const o = { w, a: c, b: c + d }
      c += d
      return o
    })
    return { start, txt, words }
  })
  return { ...s, lines, dur: s.intro + s.text.length * s.gap + 4 }
})
const SONG = Object.fromEntries(SONGS.map((s) => [s.id, s]))
const GENRES = ['All', 'Pop', 'Rock', 'Ballad', 'Duet', 'Indie']

const NAV = [
  ['songs', 'mic', 'Songs'],
  ['player', 'play', 'Player'],
  ['queue', 'list', 'Queue'],
  ['recordings', 'rec', 'Takes'],
  ['settings', 'sliders', 'Settings'],
]

const fmt = (s) => {
  s = Math.max(0, Math.floor(s))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
const clamp = (n, a, b) => Math.min(b, Math.max(a, n))

const makeBars = (id, n = 40) => {
  let seed = 7
  for (const c of id) seed = (seed * 31 + c.charCodeAt(0)) % 9973
  return Array.from({ length: n }, () => {
    seed = (seed * 9301 + 49297) % 233280
    return 0.2 + 0.8 * (seed / 233280)
  })
}

const ICONS = {
  mic: 'M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zM6 11a6 6 0 0 0 12 0M12 17v4M9 21h6',
  list: 'M4 6h16M4 12h16M4 18h10',
  sliders: 'M4 7h10M18 7h2M4 17h2M10 17h10M14 5v4M6 15v4',
  rec: 'M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16z',
  plus: 'M12 5v14M5 12h14',
  x: 'M6 6l12 12M18 6L6 18',
  up: 'M6 15l6-6 6 6',
  down: 'M6 9l6 6 6-6',
  trash: 'M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13',
  heart: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z',
  share: 'M12 16V4m0 0l-4 4m4-4l4 4M5 12v7h14v-7',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  note: 'M9 18V6l10-2v12M9 18a3 3 0 1 1-3-3 3 3 0 0 1 3 3zm10-2a3 3 0 1 1-3-3 3 3 0 0 1 3 3z',
}
const FILLED = {
  play: 'M8 5v14l11-7z',
  pause: 'M7 5h4v14H7zM13 5h4v14h-4z',
  next: 'M6 5l9 7-9 7zM17 5h2v14h-2z',
  prev: 'M18 5l-9 7 9 7zM5 5h2v14H5z',
  stop: 'M7 7h10v10H7z',
}

function Icon({ name, size = 22, color = 'currentColor', w = 1.9, on }) {
  if (FILLED[name]) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden="true">
        <path d={FILLED[name]} />
      </svg>
    )
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={on ? color : 'none'} stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  )
}

const iconBtn = { display: 'grid', placeItems: 'center', border: 'none', borderRadius: '50%', cursor: 'pointer', padding: 0, background: 'transparent', color: INK }

// song artwork: a neon gradient tile with equalizer bars
function Art({ s, size = 54, radius = 14 }) {
  const h = s.hue
  const id = `ka${s.id}${size}`
  const bars = [0.4, 0.75, 0.55, 0.95, 0.5, 0.7]
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ borderRadius: radius, flex: 'none', display: 'block' }} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={`hsl(${h} 90% 58%)`} />
          <stop offset="1" stopColor={`hsl(${(h + 70) % 360} 80% 24%)`} />
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill={`url(#${id})`} />
      <circle cx="78" cy="22" r="16" fill="#fff" opacity=".16" />
      {bars.map((b, i) => <rect key={i} x={14 + i * 13} y={84 - b * 56} width="8" height={b * 56} rx="4" fill="#fff" opacity={0.55 + (i % 3) * 0.15} />)}
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
    <div ref={box} className="kk-app" style={{ position: 'relative', width: '100%', height: '100%', display: 'grid', placeItems: 'center', overflow: 'hidden', background: backdrop, ...style }}>
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: `translate(-50%, -50%) scale(${scale})`, transformOrigin: 'center' }}>
        {frame ? (
          <div style={{ padding: 12, borderRadius: 58, background: 'linear-gradient(145deg, #3a3550, #12101c 40%, #2a2640)', boxShadow: '0 40px 80px rgba(0,0,0,.5), inset 0 0 0 2px #4b4766' }}>
            <div style={{ padding: 2, borderRadius: 48, background: '#000' }}>{phone}</div>
          </div>
        ) : (
          phone
        )}
      </div>
    </div>
  )
}

// one lyric line; the current word fills with colour as t passes through it
function LyricLine({ i, line, t, active, past, size, accent, onSeek }) {
  return (
    <button type="button" data-i={i} onClick={() => onSeek(i)} aria-label={`Seek to: ${line.txt}`} aria-current={active ? 'true' : undefined} style={{ display: 'block', width: '100%', border: 'none', background: 'none', font: 'inherit', cursor: 'pointer', textAlign: 'center', padding: '8px 18px', color: INK, opacity: active ? 1 : past ? 0.5 : 0.42, transform: active ? 'scale(1)' : 'scale(.93)', transition: 'opacity .3s, transform .3s' }}>
      <span style={{ fontSize: size, fontWeight: 800, lineHeight: 1.25, letterSpacing: '-0.01em' }}>
        {line.words.map((w, k) => {
          const p = past ? 1 : active ? clamp((t - w.a) / (w.b - w.a), 0, 1) : 0
          const style = p >= 1 ? { color: accent, textShadow: active ? `0 0 16px ${accent}88` : 'none' } : p <= 0 ? { color: '#fff' } : { backgroundImage: `linear-gradient(90deg, ${accent} ${p * 100}%, #fff ${p * 100}%)`, WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent', color: 'transparent' }
          return <span key={k} style={{ ...style, display: 'inline-block', marginRight: '0.28em' }}>{w.w}</span>
        })}
      </span>
    </button>
  )
}

// ---------------------------------------------------------------- app

export default function KaraokeApp({ name = 'Neon Mic', accent = '#ff3d8b', startScreen = 'songs', frame = true, style }) {
  const toastTimer = useRef()
  const lyricBox = useRef()
  const [tab, setTab] = useState(startScreen)
  const [dir, setDir] = useState(1)
  const [cur, setCur] = useState('k1')
  const [t, setT] = useState(37)
  const [playing, setPlaying] = useState(false)
  const [queue, setQueue] = useState(['k3', 'k5'])
  const [pitch, setPitch] = useState(0)
  const [music, setMusic] = useState(70)
  const [mic, setMic] = useState(80)
  const [recording, setRecording] = useState(false)
  const [recSec, setRecSec] = useState(0)
  const [cd, setCd] = useState(0) // countdown 3..1 before a take starts
  const [takes, setTakes] = useState([
    { id: 'r1', song: 'k2', dur: 118, date: 'Yesterday', score: 91, fav: true, pitch: 0 },
    { id: 'r2', song: 'k1', dur: 74, date: 'Mon', score: 78, fav: false, pitch: 2 },
  ])
  const [openTake, setOpenTake] = useState(null)
  const [rp, setRp] = useState(null) // { id, t } recording playback
  const [q, setQ] = useState('')
  const [genre, setGenre] = useState('All')
  const [set, setSet] = useState({ guide: true, countdown: true, autotune: false, pitchBar: true, echo: 30, size: 'M' })
  const [toast, setToast] = useState('')

  useEffect(() => setTab(startScreen), [startScreen])

  const say = (m) => {
    setToast(m)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 1700)
  }
  useEffect(() => () => clearTimeout(toastTimer.current), [])

  const song = SONG[cur]
  const lineIdx = (() => {
    let k = -1
    song.lines.forEach((l, i) => {
      if (t >= l.start) k = i
    })
    return k
  })()

  // the simulated track timer
  useEffect(() => {
    if (!playing) return undefined
    const id = setInterval(() => {
      setT((x) => x + 0.1)
      if (recording) setRecSec((x) => x + 0.1)
    }, 100)
    return () => clearInterval(id)
  }, [playing, recording])

  // 3-2-1 before recording starts
  useEffect(() => {
    if (!cd) return undefined
    const id = setTimeout(() => {
      if (cd > 1) setCd(cd - 1)
      else {
        setCd(0)
        setRecording(true)
        setRecSec(0)
        setPlaying(true)
      }
    }, 800)
    return () => clearTimeout(id)
  }, [cd])

  // recording playback clock
  useEffect(() => {
    if (!rp || rp.paused) return undefined
    const id = setInterval(() => {
      setRp((r) => {
        if (!r) return r
        const tk = takes.find((x) => x.id === r.id)
        const n = r.t + 0.1
        return tk && n >= tk.dur ? null : { ...r, t: n }
      })
    }, 100)
    return () => clearInterval(id)
  }, [rp?.id, rp?.paused, takes])

  const saveTake = (secs, songId, label = 'Just now') => {
    if (secs < 2) return say('Take too short to save')
    const score = 70 + Math.floor(Math.random() * 29)
    setTakes((a) => [{ id: `r${Date.now()}`, song: songId, dur: Math.round(secs), date: label, score, fav: false, pitch }, ...a])
    say(`Saved to Takes · score ${score}`)
  }
  const stopRec = () => {
    setRecording(false)
    saveTake(recSec, cur)
    setRecSec(0)
  }

  const loadSong = (id, autoplay = true) => {
    setCur(id)
    setT(0)
    setPlaying(autoplay)
  }
  const next = () => {
    if (recording) stopRec()
    if (!queue.length) {
      setPlaying(false)
      setT(0)
      return say('Queue is empty')
    }
    const [n, ...rest] = queue
    setQueue(rest)
    loadSong(n)
  }
  const prev = () => (recording ? say('Stop recording first') : setT(0))

  useEffect(() => {
    if (playing && t >= song.dur) {
      if (recording) {
        setRecording(false)
        saveTake(recSec, cur)
        setRecSec(0)
      }
      if (queue.length) {
        const [n, ...rest] = queue
        setQueue(rest)
        loadSong(n)
      } else {
        setPlaying(false)
        setT(0)
        say('Song finished')
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t, playing])

  const record = () => {
    if (recording) return stopRec()
    if (cd) return setCd(0)
    if (set.countdown) setCd(3)
    else {
      setRecording(true)
      setRecSec(0)
      setPlaying(true)
    }
  }
  const seekLine = (i) => {
    setT(song.lines[i].start)
    say(`Jumped to line ${i + 1}`)
  }

  const go = (to) => {
    setDir(NAV.findIndex((n) => n[0] === to) >= NAV.findIndex((n) => n[0] === tab) ? 1 : -1)
    setTab(to)
  }
  const singNow = (id) => {
    if (recording) stopRec()
    loadSong(id)
    go('player')
  }
  const enqueue = (id) => {
    setQueue((a) => [...a, id])
    say('Added to queue')
  }

  // keep the current lyric line centred
  useEffect(() => {
    const box = lyricBox.current
    if (!box || tab !== 'player') return
    const el = box.querySelector(`[data-i="${Math.max(0, lineIdx)}"]`)
    if (!el) return
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    box.scrollTo({ top: el.offsetTop - box.clientHeight / 2 + el.offsetHeight / 2, behavior: reduce ? 'auto' : 'smooth' })
  }, [lineIdx, tab, cur, set.size])

  // ---- shared bits
  const header = (title, right) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 20px 8px', minHeight: 54 }}>
      <h1 style={{ margin: 0, flex: 1, fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em' }}>{title}</h1>
      {right}
    </div>
  )
  const lyricSize = set.size === 'S' ? 20 : set.size === 'L' ? 29 : 24
  const sliderRow = (label, value, onChange, min, max, fmtv, color) => (
    <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, fontWeight: 700, color: MUTED }}>
      <span style={{ width: 44 }}>{label}</span>
      <input type="range" min={min} max={max} step="1" value={value} onChange={(e) => onChange(+e.target.value)} aria-label={label} style={{ flex: 1, accentColor: color || accent, margin: 0 }} />
      <span style={{ width: 40, textAlign: 'right', color: INK, fontVariantNumeric: 'tabular-nums' }}>{fmtv(value)}</span>
    </label>
  )
  const bestScore = (id) => takes.filter((x) => x.song === id).reduce((m, x) => Math.max(m, x.score), 0)

  const songRow = (s, extra) => (
    <div key={s.id + (extra?.key || '')} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '8px 8px 8px 10px', borderRadius: 18, background: CARD, border: `1px solid ${cur === s.id ? `${accent}66` : 'transparent'}` }}>
      <button type="button" onClick={() => singNow(s.id)} aria-label={`Sing ${s.title}`} style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0, overflow: 'hidden', border: 'none', background: 'none', font: 'inherit', color: INK, textAlign: 'left', cursor: 'pointer', padding: 0 }}>
        <Art s={s} size={50} radius={13} />
        <span style={{ minWidth: 0, flex: 1 }}>
          <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.title}</span>
          <span style={{ display: 'block', fontSize: 12, color: MUTED, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.artist} · {fmt(s.dur)}</span>
        </span>
        {bestScore(s.id) > 0 && <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 8px', borderRadius: 10, background: `${CYAN}22`, color: CYAN }}>{bestScore(s.id)}</span>}
      </button>
      {extra?.node || (
        <button type="button" onClick={() => enqueue(s.id)} aria-label={`Add ${s.title} to queue`} style={{ ...iconBtn, width: 36, height: 36, color: MUTED }}><Icon name="plus" size={19} /></button>
      )}
    </div>
  )

  // ---- screens
  let body
  if (tab === 'songs') {
    const ql = q.trim().toLowerCase()
    const list = SONGS.filter((s) => (genre === 'All' || s.genre === genre) && (!ql || `${s.title} ${s.artist}`.toLowerCase().includes(ql)))
    body = (
      <>
        {header('Songs', <span style={{ fontSize: 12, fontWeight: 700, color: accent }}>{name}</span>)}
        <div style={{ padding: '0 20px 10px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, height: 44, padding: '0 14px', borderRadius: 22, background: CARD, color: MUTED }}>
            <Icon name="search" size={18} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a song or artist" aria-label="Search songs" style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'none', color: INK, font: 'inherit', fontSize: 15 }} />
            {q && <button type="button" onClick={() => setQ('')} aria-label="Clear search" style={{ ...iconBtn, width: 24, height: 24, color: MUTED }}><Icon name="x" size={16} /></button>}
          </label>
        </div>
        <div className="kk-scroll" style={{ display: 'flex', gap: 8, padding: '0 20px 12px', overflowX: 'auto' }} role="group" aria-label="Genre">
          {GENRES.map((g) => (
            <button key={g} type="button" onClick={() => setGenre(g)} aria-pressed={genre === g} style={{ flex: 'none', height: 34, padding: '0 15px', borderRadius: 17, border: 'none', background: genre === g ? accent : CARD, color: genre === g ? '#fff' : INK, font: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{g}</button>
          ))}
        </div>
        <div style={{ display: 'grid', gap: 8, padding: '0 20px' }}>
          {list.map((s) => songRow(s))}
          {!list.length && <div style={{ textAlign: 'center', color: MUTED, fontSize: 13, padding: '34px 0' }}>No songs match. Try another genre.</div>}
        </div>
      </>
    )
  } else if (tab === 'player') {
    const L = Math.max(0, lineIdx)
    body = (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 20px 6px' }}>
          <Art s={song} size={46} radius={12} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{song.title}</div>
            <div style={{ fontSize: 12.5, color: MUTED }}>{song.artist}</div>
          </div>
          <button type="button" onClick={() => (setPitch(0), say('Key reset'))} style={{ height: 32, padding: '0 12px', borderRadius: 16, border: 'none', background: pitch ? `${CYAN}25` : CARD, color: pitch ? CYAN : MUTED, font: 'inherit', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>Key {pitch > 0 ? `+${pitch}` : pitch}</button>
        </div>
        {recording && (
          <div style={{ margin: '2px 20px 0', display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px', borderRadius: 14, background: 'rgba(255,40,60,.14)' }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#ff3b4e', animation: 'kk-pulse 1s ease-in-out infinite' }} />
            <span style={{ fontSize: 12.5, fontWeight: 800, color: '#ff7a86' }}>REC {fmt(recSec)}</span>
            <span aria-hidden="true" style={{ flex: 1, display: 'flex', gap: 2, alignItems: 'center', height: 16, justifyContent: 'flex-end' }}>
              {Array.from({ length: 14 }, (_, i) => <i key={i} style={{ width: 3, borderRadius: 2, background: '#ff7a86', height: 3 + Math.abs(Math.sin(t * 7 + i * 1.3) * Math.sin(t * 2.7 + i)) * 13 * (mic / 100) }} />)}
            </span>
          </div>
        )}
        <div ref={lyricBox} className="kk-scroll" style={{ position: 'relative', flex: 1, overflowY: 'auto', padding: '110px 0', WebkitMaskImage: 'linear-gradient(transparent, #000 18%, #000 82%, transparent)', maskImage: 'linear-gradient(transparent, #000 18%, #000 82%, transparent)' }}>
          {lineIdx < 0 && (
            <div style={{ textAlign: 'center', fontSize: 14, fontWeight: 700, color: MUTED, paddingBottom: 6 }}>♪ intro · starts in {Math.max(0, Math.ceil(song.intro - t))}s</div>
          )}
          {song.lines.map((l, i) => (
            <LyricLine key={i} i={i} line={l} t={t} active={i === lineIdx} past={i < lineIdx} size={lyricSize} accent={accent} onSeek={seekLine} />
          ))}
        </div>
        <div style={{ padding: '4px 22px 0' }}>
          <input type="range" min="0" max={Math.floor(song.dur)} step="1" value={Math.floor(t)} onChange={(e) => setT(+e.target.value)} aria-label="Song position" style={{ width: '100%', margin: 0, accentColor: accent }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: MUTED, fontVariantNumeric: 'tabular-nums' }}>
            <span>{fmt(t)}</span>
            <span>Line {L + 1} of {song.lines.length}</span>
            <span>{fmt(song.dur)}</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 30px 2px' }}>
          <button type="button" onClick={prev} aria-label="Restart" style={{ ...iconBtn, width: 46, height: 46 }}><Icon name="prev" size={26} /></button>
          <button type="button" onClick={() => setPlaying(!playing)} aria-label={playing ? 'Pause' : 'Play'} style={{ ...iconBtn, width: 60, height: 60, background: INK, color: BG }}><Icon name={playing ? 'pause' : 'play'} size={28} /></button>
          <button type="button" onClick={next} aria-label="Next song" style={{ ...iconBtn, width: 46, height: 46 }}><Icon name="next" size={26} /></button>
          <button type="button" onClick={record} aria-label={recording ? 'Stop recording' : cd ? 'Cancel countdown' : 'Record'} aria-pressed={recording} style={{ ...iconBtn, width: 60, height: 60, background: 'rgba(255,60,80,.16)', border: '2px solid #ff3b4e', color: '#ff3b4e' }}>
            {recording ? <Icon name="stop" size={24} /> : cd ? <span style={{ fontSize: 24, fontWeight: 800 }}>{cd}</span> : <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#ff3b4e', display: 'block' }} />}
          </button>
        </div>
        <div style={{ display: 'grid', gap: 2, padding: '4px 22px 14px' }}>
          {sliderRow('Pitch', pitch, setPitch, -6, 6, (v) => (v > 0 ? `+${v}` : v), CYAN)}
          {sliderRow('Music', music, setMusic, 0, 100, (v) => `${v}%`)}
          {sliderRow('Mic', mic, setMic, 0, 100, (v) => `${v}%`)}
        </div>
      </div>
    )
  } else if (tab === 'queue') {
    const move = (i, d) => {
      const j = i + d
      if (j < 0 || j >= queue.length) return
      setQueue((a) => {
        const c = [...a]
        ;[c[i], c[j]] = [c[j], c[i]]
        return c
      })
    }
    body = (
      <>
        {header('Queue', queue.length > 0 && <button type="button" onClick={() => (setQueue([]), say('Queue cleared'))} style={{ border: 'none', background: 'none', color: accent, font: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Clear</button>)}
        <div style={{ padding: '0 20px', display: 'grid', gap: 8 }}>
          <div style={{ fontSize: 11.5, fontWeight: 800, color: MUTED, textTransform: 'uppercase', letterSpacing: '.1em' }}>On stage</div>
          <button type="button" onClick={() => go('player')} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, border: `1px solid ${accent}66`, borderRadius: 18, background: `${accent}18`, font: 'inherit', color: INK, textAlign: 'left', cursor: 'pointer' }}>
            <Art s={song} size={50} radius={13} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 15, fontWeight: 800 }}>{song.title}</span>
              <span style={{ display: 'block', fontSize: 12, color: MUTED }}>{song.artist} · {playing ? 'singing now' : 'paused'}</span>
            </span>
            <Icon name="play" size={18} color={accent} />
          </button>
          <div style={{ fontSize: 11.5, fontWeight: 800, color: MUTED, textTransform: 'uppercase', letterSpacing: '.1em', marginTop: 8 }}>Up next · {queue.length}</div>
          {queue.map((id, i) => {
            const s = SONG[id]
            return songRow(s, {
              key: `q${i}`,
              node: (
                <span style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={{ display: 'grid' }}>
                    <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up" style={{ ...iconBtn, width: 28, height: 22, color: i === 0 ? '#4a4360' : MUTED }}><Icon name="up" size={15} /></button>
                    <button type="button" onClick={() => move(i, 1)} disabled={i === queue.length - 1} aria-label="Move down" style={{ ...iconBtn, width: 28, height: 22, color: i === queue.length - 1 ? '#4a4360' : MUTED }}><Icon name="down" size={15} /></button>
                  </span>
                  <button type="button" onClick={() => setQueue((a) => a.filter((_, k) => k !== i))} aria-label="Remove from queue" style={{ ...iconBtn, width: 34, height: 34, color: MUTED }}><Icon name="x" size={17} /></button>
                </span>
              ),
            })
          })}
          {!queue.length && (
            <div style={{ textAlign: 'center', color: MUTED, fontSize: 13, padding: '26px 0' }}>
              Nobody is waiting to sing.
              <button type="button" onClick={() => go('songs')} style={{ display: 'block', margin: '10px auto 0', border: 'none', background: 'none', color: accent, font: 'inherit', fontWeight: 700, cursor: 'pointer' }}>Pick songs</button>
            </div>
          )}
        </div>
      </>
    )
  } else if (tab === 'recordings') {
    body = (
      <>
        {header('Takes', <span style={{ fontSize: 12.5, color: MUTED, fontWeight: 600 }}>{takes.length} saved</span>)}
        <div style={{ padding: '0 20px', display: 'grid', gap: 8 }}>
          {takes.map((r) => {
            const s = SONG[r.song]
            const isPlay = rp?.id === r.id
            const open = openTake === r.id
            const bars = makeBars(r.id)
            const frac = isPlay ? clamp(rp.t / r.dur, 0, 1) : 0
            return (
              <div key={r.id} style={{ borderRadius: 20, background: CARD, padding: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button type="button" onClick={() => (isPlay && !rp.paused ? setRp({ ...rp, paused: true }) : setRp(isPlay ? { ...rp, paused: false } : { id: r.id, t: 0 }))} aria-label={isPlay && !rp.paused ? 'Pause take' : 'Play take'} style={{ ...iconBtn, width: 44, height: 44, background: accent, color: '#fff', flex: 'none' }}>
                    <Icon name={isPlay && !rp.paused ? 'pause' : 'play'} size={18} />
                  </button>
                  <button type="button" onClick={() => setOpenTake(open ? null : r.id)} aria-expanded={open} style={{ flex: 1, minWidth: 0, border: 'none', background: 'none', font: 'inherit', color: INK, textAlign: 'left', cursor: 'pointer', padding: 0 }}>
                    <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.title}</span>
                    <span style={{ display: 'block', fontSize: 12, color: MUTED, marginTop: 2 }}>{r.date} · {fmt(r.dur)}{r.pitch ? ` · key ${r.pitch > 0 ? '+' : ''}${r.pitch}` : ''}</span>
                  </button>
                  <span style={{ fontSize: 13, fontWeight: 800, padding: '4px 10px', borderRadius: 12, background: `${CYAN}22`, color: CYAN }}>{r.score}</span>
                  <button type="button" onClick={() => setTakes((a) => a.map((x) => (x.id === r.id ? { ...x, fav: !x.fav } : x)))} aria-pressed={r.fav} aria-label="Favourite" style={{ ...iconBtn, width: 34, height: 34, color: r.fav ? accent : MUTED }}><Icon name="heart" size={18} on={r.fav} /></button>
                </div>
                <div aria-hidden="true" style={{ display: 'flex', gap: 2, alignItems: 'center', height: 28, margin: '8px 2px 0' }}>
                  {bars.map((b, i) => <i key={i} style={{ flex: 1, height: `${b * 100}%`, borderRadius: 2, background: (i + 0.5) / bars.length <= frac ? accent : 'rgba(255,255,255,.2)' }} />)}
                </div>
                {open && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <button type="button" onClick={() => singNow(r.song)} style={{ flex: 1, height: 38, borderRadius: 19, border: 'none', background: `${accent}28`, color: accent, font: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Sing again</button>
                    <button type="button" onClick={() => say('Share link copied')} aria-label="Share" style={{ flex: 1, height: 38, borderRadius: 19, border: 'none', background: CARD, color: INK, font: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Share</button>
                    <button type="button" onClick={() => (setTakes((a) => a.filter((x) => x.id !== r.id)), rp?.id === r.id && setRp(null), setOpenTake(null), say('Take deleted'))} aria-label="Delete take" style={{ ...iconBtn, width: 38, height: 38, background: CARD, color: '#ff7a86' }}><Icon name="trash" size={17} /></button>
                  </div>
                )}
              </div>
            )
          })}
          {!takes.length && (
            <div style={{ textAlign: 'center', color: MUTED, fontSize: 13, padding: '30px 0' }}>
              No takes yet. Hit the red button while a song plays.
              <button type="button" onClick={() => go('player')} style={{ display: 'block', margin: '10px auto 0', border: 'none', background: 'none', color: accent, font: 'inherit', fontWeight: 700, cursor: 'pointer' }}>Go to the stage</button>
            </div>
          )}
        </div>
      </>
    )
  } else {
    const sw = (key, label, sub) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 0', borderBottom: `1px solid ${LINE}` }}>
        <span style={{ flex: 1 }}>
          <span style={{ display: 'block', fontSize: 14.5, fontWeight: 600 }}>{label}</span>
          <span style={{ display: 'block', fontSize: 12, color: MUTED, marginTop: 1 }}>{sub}</span>
        </span>
        <button type="button" role="switch" aria-checked={set[key]} aria-label={label} onClick={() => (setSet((s) => ({ ...s, [key]: !s[key] })), say(`${label} ${set[key] ? 'off' : 'on'}`))} style={{ width: 48, height: 28, borderRadius: 14, border: 'none', padding: 3, background: set[key] ? accent : 'rgba(255,255,255,.18)', cursor: 'pointer', transition: 'background .2s' }}>
          <span style={{ display: 'block', width: 22, height: 22, borderRadius: '50%', background: '#fff', transform: `translateX(${set[key] ? 20 : 0}px)`, transition: 'transform .2s' }} />
        </button>
      </div>
    )
    body = (
      <>
        {header('Settings')}
        <div style={{ margin: '0 20px', padding: '0 16px', background: CARD, borderRadius: 22 }}>
          {sw('guide', 'Guide vocals', 'A faint singer to follow')}
          {sw('countdown', '3-2-1 countdown', 'Before a take starts')}
          {sw('autotune', 'Auto-tune', 'Nudge notes into key')}
          {sw('pitchBar', 'Pitch bar', 'Show your pitch on screen')}
        </div>
        <div style={{ margin: '14px 20px 0', padding: 16, background: CARD, borderRadius: 22, display: 'grid', gap: 14 }}>
          <div>
            <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 10 }}>Lyric size</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {['S', 'M', 'L'].map((z) => (
                <button key={z} type="button" onClick={() => setSet((s) => ({ ...s, size: z }))} aria-pressed={set.size === z} style={{ flex: 1, height: 38, borderRadius: 19, border: 'none', background: set.size === z ? accent : 'rgba(255,255,255,.1)', color: '#fff', font: 'inherit', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>{z}</button>
              ))}
            </div>
          </div>
          {sliderRow('Echo', set.echo, (v) => setSet((s) => ({ ...s, echo: v })), 0, 100, (v) => `${v}%`)}
        </div>
        <div style={{ display: 'grid', gap: 10, padding: '16px 20px' }}>
          <button type="button" onClick={() => (setTakes([]), setRp(null), say('All takes deleted'))} style={{ height: 48, borderRadius: 24, border: 'none', background: CARD, font: 'inherit', fontSize: 14, fontWeight: 600, color: INK, cursor: 'pointer' }}>Delete all takes</button>
          <button type="button" onClick={() => (setQueue(['k3', 'k5']), setCur('k1'), setT(37), setPlaying(false), setRecording(false), setPitch(0), setMusic(70), setMic(80), setSet({ guide: true, countdown: true, autotune: false, pitchBar: true, echo: 30, size: 'M' }), go('songs'), say('Demo reset'))} style={{ height: 48, borderRadius: 24, border: 'none', background: 'none', font: 'inherit', fontSize: 14, fontWeight: 600, color: '#ff7a86', cursor: 'pointer' }}>Reset demo</button>
        </div>
      </>
    )
  }

  const showMini = tab !== 'player'
  const bottomPad = 88 + (showMini ? 64 : 0)
  return (
    <Shell frame={frame} backdrop="radial-gradient(ellipse at 50% 30%, #2a1650, #07040f 75%)" style={style}>
      <style>{`
        @keyframes kk-r { from { opacity: 0; transform: translateX(34px) } to { opacity: 1; transform: none } }
        @keyframes kk-l { from { opacity: 0; transform: translateX(-34px) } to { opacity: 1; transform: none } }
        @keyframes kk-pulse { 50% { opacity: .25 } }
        .kk-scroll { scrollbar-width: none } .kk-scroll::-webkit-scrollbar { display: none }
        .kk-app button:focus-visible, .kk-app input:focus-visible { outline: 2px solid ${accent}; outline-offset: 2px }
        .kk-app input::placeholder { color: ${MUTED} }
        @media (prefers-reduced-motion: reduce) { .kk-page, .kk-app i, .kk-app span { animation: none !important } }
      `}</style>
      <StatusBar frame={frame} />
      <div aria-hidden="true" style={{ position: 'absolute', top: -100, right: -80, width: 320, height: 320, borderRadius: '50%', background: `${accent}38`, filter: 'blur(70px)' }} />
      <div aria-hidden="true" style={{ position: 'absolute', bottom: 40, left: -90, width: 280, height: 280, borderRadius: '50%', background: `${CYAN}1f`, filter: 'blur(70px)' }} />
      <div key={tab} className="kk-scroll kk-page" style={{ position: 'absolute', top: 54, bottom: tab === 'player' ? 88 : bottomPad, left: 0, right: 0, overflowY: tab === 'player' ? 'hidden' : 'auto', paddingBottom: tab === 'player' ? 0 : 20, animation: `${dir > 0 ? 'kk-r' : 'kk-l'} .28s ease` }}>
        {body}
      </div>

      {showMini && (
        <div style={{ position: 'absolute', left: 10, right: 10, bottom: 98, height: 58, zIndex: 9, borderRadius: 18, background: '#241a40', border: `1px solid ${recording ? '#ff3b4e' : LINE}`, boxShadow: '0 8px 22px rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', gap: 4, padding: '0 6px 0 8px', overflow: 'hidden' }}>
          <button type="button" onClick={() => go('player')} aria-label="Open player" style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, border: 'none', background: 'none', color: INK, font: 'inherit', textAlign: 'left', cursor: 'pointer', padding: 0 }}>
            <Art s={song} size={40} radius={10} />
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{song.title}</span>
              <span style={{ display: 'block', fontSize: 11.5, color: recording ? '#ff7a86' : MUTED }}>{recording ? `● REC ${fmt(recSec)}` : `${song.artist} · ${fmt(t)}`}</span>
            </span>
          </button>
          <button type="button" onClick={() => setPlaying(!playing)} aria-label={playing ? 'Pause' : 'Play'} style={{ ...iconBtn, width: 40, height: 40 }}><Icon name={playing ? 'pause' : 'play'} size={22} /></button>
          <button type="button" onClick={next} aria-label="Next song" style={{ ...iconBtn, width: 40, height: 40 }}><Icon name="next" size={22} /></button>
          <span style={{ position: 'absolute', left: 0, bottom: 0, height: 2.5, width: `${(t / song.dur) * 100}%`, background: accent }} />
        </div>
      )}

      <nav aria-label="Main" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 88, zIndex: 13, background: 'rgba(14,9,26,.96)', borderTop: `1px solid ${LINE}`, display: 'flex', justifyContent: 'space-around', padding: '10px 4px 0' }}>
        {NAV.map(([id, icon, label]) => (
          <button key={id} type="button" onClick={() => go(id)} aria-current={tab === id ? 'page' : undefined} style={{ border: 'none', background: 'none', font: 'inherit', cursor: 'pointer', display: 'grid', justifyItems: 'center', alignContent: 'start', gap: 3, width: 64, height: 54, fontSize: 11, fontWeight: 700, color: tab === id ? accent : MUTED, position: 'relative' }}>
            <Icon name={icon} size={23} on={id === 'rec' && recording} color={id === 'rec' && recording ? '#ff3b4e' : 'currentColor'} />
            {label}
          </button>
        ))}
      </nav>

      {cd > 0 && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 45, display: 'grid', placeItems: 'center', background: 'rgba(7,4,15,.7)', pointerEvents: 'none' }}>
          <span key={cd} style={{ fontSize: 120, fontWeight: 900, color: accent, textShadow: `0 0 40px ${accent}`, animation: 'kk-r .5s ease' }}>{cd}</span>
        </div>
      )}
      <div role="status" style={{ position: 'absolute', left: '50%', top: 58, zIndex: 70, transform: `translate(-50%, ${toast ? 0 : -90}px)`, transition: 'transform .35s cubic-bezier(.2,.8,.2,1)', padding: '10px 16px', borderRadius: 20, background: INK, color: BG, fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap' }}>{toast}</div>
      <div style={{ position: 'absolute', left: '50%', bottom: 8, width: 140, height: 5, marginLeft: -70, borderRadius: 3, background: INK, opacity: 0.8, zIndex: 65 }} />
    </Shell>
  )
}
