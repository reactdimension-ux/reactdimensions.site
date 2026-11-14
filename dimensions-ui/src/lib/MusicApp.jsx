import { useEffect, useRef, useState } from 'react'

// A music player on a phone, as a click-through prototype. Five pages: Now
// playing, Library, Queue, Album (pushed from Library) and Search. The player is
// real: play/pause, next/previous, shuffle and repeat (off / all / one) change
// state, and a simulated clock advances the position while playing and rolls
// over to the next track at the end. The waveform is scrubbable (drag it, or
// use the arrow keys), the cover spins while playing, and on Now playing you
// can swipe the queue sheet up from the bottom (or tap its handle). A mini
// player follows you on the other tabs. Everything is drawn in SVG/CSS, no audio.
// The phone scales to fit whatever box it is in.

const W = 390 // the phone screen, in CSS px (an iPhone's width)
const H = 844
const INK = '#f4f1fa'
const MUTED = '#8e88a3'
const BG = '#0d0b14'
const CARD = '#191527'
const LINE = 'rgba(255,255,255,.07)'
const FONT = "-apple-system, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif"

const ALBUMS = [
  { id: 'a1', title: 'Neon Tides', artist: 'Kito Rae', hue: 285, year: 2024, shape: 0 },
  { id: 'a2', title: 'Paper Moons', artist: 'Lumen', hue: 205, year: 2023, shape: 1 },
  { id: 'a3', title: 'Slow Static', artist: 'Orchid Club', hue: 335, year: 2025, shape: 2 },
  { id: 'a4', title: 'Golden Hours', artist: 'Marlo', hue: 38, year: 2022, shape: 3 },
]

const TRACKS = [
  { id: 't1', title: 'Afterglow Drive', album: 'a1', dur: 214, genre: 'Synthwave' },
  { id: 't2', title: 'Glass Harbor', album: 'a1', dur: 187, genre: 'Synthwave' },
  { id: 't3', title: 'Midnight Relay', album: 'a1', dur: 243, genre: 'Synthwave' },
  { id: 't4', title: 'Quiet Orbit', album: 'a2', dur: 201, genre: 'Lo-fi' },
  { id: 't5', title: 'Paper Lanterns', album: 'a2', dur: 176, genre: 'Lo-fi' },
  { id: 't6', title: 'Tape Hiss Lullaby', album: 'a2', dur: 229, genre: 'Lo-fi' },
  { id: 't7', title: 'Velvet Noise', album: 'a3', dur: 198, genre: 'Indie' },
  { id: 't8', title: 'Orchid Hours', album: 'a3', dur: 252, genre: 'Indie' },
  { id: 't9', title: 'Honey & Brass', album: 'a4', dur: 221, genre: 'Jazz' },
  { id: 't10', title: 'Late Train Home', album: 'a4', dur: 193, genre: 'Jazz' },
]
const TRK = Object.fromEntries(TRACKS.map((t) => [t.id, t]))
const ALB = Object.fromEntries(ALBUMS.map((a) => [a.id, a]))
const GENRES = [
  ['Synthwave', 285],
  ['Lo-fi', 205],
  ['Indie', 335],
  ['Jazz', 38],
]

const NAV = [
  ['now', 'disc', 'Now'],
  ['library', 'lib', 'Library'],
  ['search', 'search', 'Search'],
  ['queue', 'list', 'Queue'],
]

const fmt = (s) => {
  s = Math.max(0, Math.floor(s))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

// deterministic pseudo-random waveform for a track
const makeBars = (id, n = 60) => {
  let seed = 0
  for (const c of id) seed = (seed * 31 + c.charCodeAt(0)) % 9973
  return Array.from({ length: n }, (_, i) => {
    seed = (seed * 9301 + 49297) % 233280
    const r = seed / 233280
    const env = 0.45 + 0.55 * Math.sin((i / (n - 1)) * Math.PI)
    return 0.16 + 0.84 * Math.abs(r * 0.75 + 0.25 * Math.sin(i * 0.7)) * env
  })
}

const ICONS = {
  disc: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  lib: 'M5 4v16M10 4v16M15 5l4 15',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  list: 'M4 6h16M4 12h16M4 18h10',
  back: 'M15 5l-7 7 7 7',
  chev: 'M9 5l7 7-7 7',
  down: 'M6 9l6 6 6-6',
  up: 'M6 15l6-6 6 6',
  plus: 'M12 5v14M5 12h14',
  x: 'M6 6l12 12M18 6L6 18',
  trash: 'M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13',
  heart: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z',
  shuffle: 'M4 7h3c5 0 5 10 10 10h3m0 0l-3-3m3 3l-3 3M4 17h3c1.6 0 2.7-.8 3.6-2M13.4 9C14.3 7.800 15.400 7 17 7h3m0 0l-3-3m3 3l-3 3',
  repeat: 'M4 11V9a3 3 0 0 1 3-3h12m0 0l-3-3m3 3l-3 3M20 13v2a3 3 0 0 1-3 3H5m0 0l3 3m-3-3l3-3',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 20a8 8 0 0 1 16 0',
}
const FILLED = {
  play: 'M8 5v14l11-7z',
  pause: 'M7 5h4v14H7zM13 5h4v14h-4z',
  next: 'M6 5l9 7-9 7zM17 5h2v14h-2z',
  prev: 'M18 5l-9 7 9 7zM5 5h2v14H5z',
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

// album artwork, drawn as an SVG square
function Cover({ a, size = 48, radius = 12 }) {
  const h = a.hue
  const id = `cv${a.id}`
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ borderRadius: radius, flex: 'none', display: 'block' }} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={`hsl(${h} 80% 62%)`} />
          <stop offset="1" stopColor={`hsl(${(h + 50) % 360} 70% 22%)`} />
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill={`url(#${id})`} />
      {a.shape === 0 && (
        <>
          <circle cx="50" cy="62" r="26" fill={`hsl(${(h + 40) % 360} 90% 70%)`} opacity=".85" />
          {[0, 1, 2, 3].map((i) => <rect key={i} x="14" y={52 + i * 7} width="72" height="3" fill={`hsl(${h} 70% 18%)`} />)}
        </>
      )}
      {a.shape === 1 && (
        <>
          <circle cx="62" cy="38" r="22" fill="#fff" opacity=".9" />
          <circle cx="70" cy="32" r="20" fill={`hsl(${h} 60% 38%)`} />
          <path d="M0 80Q25 68 50 78T100 72V100H0z" fill={`hsl(${h} 60% 16%)`} />
        </>
      )}
      {a.shape === 2 && (
        <>
          {[0, 1, 2, 3, 4].map((i) => <circle key={i} cx="50" cy="50" r={12 + i * 9} fill="none" stroke={`hsl(${h} 90% ${80 - i * 10}%)`} strokeWidth="3" opacity=".8" />)}
        </>
      )}
      {a.shape === 3 && (
        <>
          <path d="M0 70L30 40l22 22 20-30 28 38v30H0z" fill={`hsl(${h} 80% 40%)`} opacity=".9" />
          <circle cx="74" cy="26" r="11" fill={`hsl(${h} 100% 78%)`} />
        </>
      )}
    </svg>
  )
}

// the spinning record on Now playing
function Disc({ a, size, playing }) {
  return (
    <div className="mu-disc" style={{ position: 'relative', width: size, height: size, borderRadius: '50%', boxShadow: `0 24px 50px hsl(${a.hue} 70% 30% / .55)`, animation: 'mu-spin 16s linear infinite', animationPlayState: playing ? 'running' : 'paused' }}>
      <div style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden' }}>
        <Cover a={a} size={size} radius={0} />
      </div>
      <svg width={size} height={size} viewBox="0 0 100 100" style={{ position: 'absolute', inset: 0 }} aria-hidden="true">
        {[46, 40, 34, 28].map((r) => <circle key={r} cx="50" cy="50" r={r} fill="none" stroke="#000" strokeOpacity=".16" strokeWidth=".6" />)}
        <circle cx="50" cy="50" r="9" fill={BG} />
        <circle cx="50" cy="50" r="2.4" fill="#fff" opacity=".7" />
      </svg>
    </div>
  )
}

// scrubbable waveform: drag, tap or use arrow keys. value is 0..1
function Waveform({ bars, value, onChange, accent, dur }) {
  const ref = useRef()
  const dragging = useRef(false)
  const frac = (e) => {
    const r = ref.current.getBoundingClientRect()
    return Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
  }
  const down = (e) => {
    dragging.current = true
    e.currentTarget.setPointerCapture?.(e.pointerId)
    onChange(frac(e), false)
  }
  const move = (e) => dragging.current && onChange(frac(e), false)
  const up = (e) => {
    if (!dragging.current) return
    dragging.current = false
    onChange(frac(e), true)
  }
  const key = (e) => {
    const d = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 5 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -5 : 0
    if (!d) return
    e.preventDefault()
    onChange(Math.min(1, Math.max(0, value + d / dur)), true)
  }
  const n = bars.length
  const step = 330 / n
  return (
    <div ref={ref} role="slider" tabIndex={0} aria-label="Seek" aria-valuemin={0} aria-valuemax={Math.round(dur)} aria-valuenow={Math.round(value * dur)} aria-valuetext={fmt(value * dur)} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onKeyDown={key} style={{ position: 'relative', height: 70, cursor: 'ew-resize', touchAction: 'none', userSelect: 'none', outline: 'none' }}>
      <svg width="100%" height="70" viewBox="0 0 330 70" preserveAspectRatio="none" style={{ display: 'block' }}>
        {bars.map((b, i) => {
          const h = Math.max(4, b * 62)
          const played = (i + 0.5) / n <= value
          return <rect key={i} x={i * step + 0.8} y={35 - h / 2} width={step - 2} height={h} rx={(step - 2) / 2} fill={played ? accent : '#fff'} opacity={played ? 1 : 0.22} />
        })}
      </svg>
      <span style={{ position: 'absolute', top: 0, bottom: 0, left: `${value * 100}%`, width: 2, marginLeft: -1, background: '#fff', borderRadius: 1, boxShadow: `0 0 10px ${accent}` }} />
      <span style={{ position: 'absolute', top: -4, left: `${value * 100}%`, width: 10, height: 10, marginLeft: -5, borderRadius: '50%', background: '#fff' }} />
    </div>
  )
}

function TrackRow({ t, accent, active, playing, onPlay, onAdd, onLike, liked, sub }) {
  const a = ALB[t.album]
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 8px 8px 10px', borderRadius: 16, background: active ? `${accent}22` : CARD }}>
      <button type="button" onClick={onPlay} aria-label={`Play ${t.title}`} style={{ ...iconBtn, flex: 1, minWidth: 0, justifyContent: 'start', gridTemplateColumns: 'auto 1fr', gap: 12, borderRadius: 12, textAlign: 'left', font: 'inherit', placeItems: 'center start' }}>
        <span style={{ position: 'relative', display: 'block' }}>
          <Cover a={a} size={44} radius={10} />
          {active && (
            <span style={{ position: 'absolute', inset: 0, borderRadius: 10, background: 'rgba(0,0,0,.5)', display: 'grid', placeItems: 'center' }}>
              <span className="mu-eq" style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 14 }}>
                {[0, 1, 2].map((i) => <i key={i} style={{ width: 3, height: '100%', background: '#fff', borderRadius: 1, transformOrigin: 'bottom', animation: `mu-eq .8s ${i * 0.17}s ease-in-out infinite alternate`, animationPlayState: playing ? 'running' : 'paused' }} />)}
              </span>
            </span>
          )}
        </span>
        <span style={{ minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 14.5, fontWeight: 600, color: active ? accent : INK, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</span>
          <span style={{ display: 'block', fontSize: 12, color: MUTED, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub || `${a.artist} · ${fmt(t.dur)}`}</span>
        </span>
      </button>
      {onLike && (
        <button type="button" onClick={onLike} aria-label={liked ? 'Unlike' : 'Like'} aria-pressed={!!liked} style={{ ...iconBtn, width: 34, height: 34, color: liked ? accent : MUTED }}>
          <Icon name="heart" size={18} on={liked} />
        </button>
      )}
      {onAdd && (
        <button type="button" onClick={onAdd} aria-label={`Add ${t.title} to queue`} style={{ ...iconBtn, width: 34, height: 34, color: MUTED }}>
          <Icon name="plus" size={18} />
        </button>
      )}
    </div>
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
    <div ref={box} className="mu-app" style={{ position: 'relative', width: '100%', height: '100%', display: 'grid', placeItems: 'center', overflow: 'hidden', background: backdrop, ...style }}>
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: `translate(-50%, -50%) scale(${scale})`, transformOrigin: 'center' }}>
        {frame ? (
          <div style={{ padding: 12, borderRadius: 58, background: 'linear-gradient(145deg, #3a3f4a, #14171d 40%, #2b2f38)', boxShadow: '0 40px 80px rgba(0,0,0,.45), inset 0 0 0 2px #4b515e' }}>
            <div style={{ padding: 2, borderRadius: 48, background: '#000' }}>{phone}</div>
          </div>
        ) : (
          phone
        )}
      </div>
    </div>
  )
}

const SHEET_H = 430
const PEEK = 74

// ---------------------------------------------------------------- app

export default function MusicApp({ name = 'Tidal Fm', accent = '#b36bff', startScreen = 'now', frame = true, style }) {
  const toastTimer = useRef()
  const sheetDrag = useRef(null)
  const [tab, setTab] = useState(startScreen === 'album' ? 'library' : startScreen)
  const [stack, setStack] = useState(startScreen === 'album' ? [{ id: 'album', album: 'a1' }] : [])
  const [dir, setDir] = useState(1)
  const [queue, setQueue] = useState(['t1', 't2', 't3', 't4', 't5', 't7', 't9', 't10'])
  const [idx, setIdx] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [pos, setPos] = useState(42)
  const [scrub, setScrub] = useState(null)
  const [shuffle, setShuffle] = useState(false)
  const [repeat, setRepeat] = useState('off') // off | all | one
  const [liked, setLiked] = useState({ t2: true, t8: true })
  const [libTab, setLibTab] = useState('Songs')
  const [q, setQ] = useState('')
  const [recents, setRecents] = useState(['Quiet Orbit', 'Lumen'])
  const [sheet, setSheet] = useState(false)
  const [sheetDy, setSheetDy] = useState(null) // live drag offset while swiping, else null
  const [toast, setToast] = useState('')

  useEffect(() => {
    setTab(startScreen === 'album' ? 'library' : startScreen)
    setStack(startScreen === 'album' ? [{ id: 'album', album: 'a1' }] : [])
  }, [startScreen])

  const say = (t) => {
    setToast(t)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 1700)
  }
  useEffect(() => () => clearTimeout(toastTimer.current), [])

  const cur = TRK[queue[idx]]
  const curAlbum = cur ? ALB[cur.album] : null
  const bars = cur ? makeBars(cur.id) : []

  // the simulated clock
  useEffect(() => {
    if (!playing) return undefined
    const id = setInterval(() => setPos((p) => p + 0.25), 250)
    return () => clearInterval(id)
  }, [playing])

  const jump = (i) => (setIdx(i), setPos(0))
  const nextIndex = (auto) => {
    if (!queue.length) return -1
    if (shuffle && queue.length > 1) {
      let r
      do r = Math.floor(Math.random() * queue.length)
      while (r === idx)
      return r
    }
    if (idx < queue.length - 1) return idx + 1
    return repeat === 'all' || !auto ? 0 : -1
  }
  const next = (auto) => {
    if (auto && repeat === 'one') return setPos(0)
    const i = nextIndex(auto)
    if (i < 0) return (setPlaying(false), setPos(0))
    jump(i)
  }
  const prev = () => (pos > 3 ? setPos(0) : jump(idx > 0 ? idx - 1 : Math.max(0, queue.length - 1)))

  useEffect(() => {
    if (cur && pos >= cur.dur) next(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos])

  const playList = (ids, start = 0) => {
    setQueue(ids)
    setIdx(start)
    setPos(0)
    setPlaying(true)
  }
  const addToQueue = (id, atNext) => {
    setQueue((qq) => {
      const copy = [...qq]
      copy.splice(atNext ? idx + 1 : copy.length, 0, id)
      return copy
    })
    say(atNext ? 'Playing next' : 'Added to queue')
  }
  const removeAt = (i) => {
    if (queue.length <= 1) return say('Queue needs at least one track')
    setQueue((qq) => qq.filter((_, k) => k !== i))
    if (i < idx) setIdx(idx - 1)
    else if (i === idx) {
      setIdx(Math.min(idx, queue.length - 2))
      setPos(0)
    }
  }
  const moveAt = (i, d) => {
    const j = i + d
    if (j < 0 || j >= queue.length) return
    setQueue((qq) => {
      const copy = [...qq]
      ;[copy[i], copy[j]] = [copy[j], copy[i]]
      return copy
    })
    if (idx === i) setIdx(j)
    else if (idx === j) setIdx(i)
  }
  const toggleLike = (id) => setLiked((l) => ({ ...l, [id]: !l[id] }))

  const push = (s) => (setDir(1), setStack((a) => [...a, s]))
  const pop = () => (setDir(-1), setStack((a) => a.slice(0, -1)))
  const go = (t) => {
    setDir(NAV.findIndex((n) => n[0] === t) >= NAV.findIndex((n) => n[0] === tab) ? 1 : -1)
    setTab(t)
    setStack([])
    setSheet(false)
  }

  // the queue sheet: drag its header up or down, or tap it
  const sheetDown = (e) => {
    sheetDrag.current = { y: e.clientY, moved: false }
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  const sheetMove = (e) => {
    const d = sheetDrag.current
    if (!d) return
    const dy = e.clientY - d.y
    if (Math.abs(dy) > 4) d.moved = true
    setSheetDy(dy)
  }
  const sheetUp = (e) => {
    const d = sheetDrag.current
    if (!d) return
    sheetDrag.current = null
    const dy = e.clientY - d.y
    setSheetDy(null)
    if (!d.moved) setSheet((s) => !s)
    else if (dy < -40) setSheet(true)
    else if (dy > 40) setSheet(false)
  }
  const sheetBase = sheet ? 0 : SHEET_H - PEEK
  const sheetY = Math.min(SHEET_H - PEEK, Math.max(0, sheetBase + (sheetDy || 0)))

  // ---- shared bits
  const header = (title, back, right) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px 6px', minHeight: 50 }}>
      {back && (
        <button type="button" onClick={back} aria-label="Back" style={{ ...iconBtn, width: 38, height: 38, background: CARD }}>
          <Icon name="back" size={20} />
        </button>
      )}
      <h1 style={{ margin: 0, flex: 1, fontSize: back ? 18 : 28, fontWeight: 800, letterSpacing: '-0.02em', marginLeft: 4 }}>{title}</h1>
      {right}
    </div>
  )
  const pill = (label, onClick, filled, icon) => (
    <button type="button" onClick={onClick} style={{ flex: 1, height: 46, borderRadius: 23, border: 'none', background: filled ? accent : CARD, color: filled ? '#160a26' : INK, font: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
      {icon}
      {label}
    </button>
  )
  const trackRow = (t, ids, i, opts = {}) => (
    <TrackRow key={`${t.id}-${i}`} t={t} accent={accent} active={cur && cur.id === t.id && queue[idx] === t.id} playing={playing} liked={liked[t.id]} onLike={() => toggleLike(t.id)} onAdd={() => addToQueue(t.id, false)} onPlay={() => playList(ids, i)} {...opts} />
  )

  const top = stack[stack.length - 1]
  const shown = scrub != null && cur ? scrub * cur.dur : pos
  const mini = tab !== 'now' && cur
  const ctl = (icon, label, onClick, on, size = 40) => (
    <button type="button" onClick={onClick} aria-label={label} aria-pressed={on === undefined ? undefined : !!on} style={{ ...iconBtn, width: size, height: size, color: on ? accent : INK, position: 'relative' }}>
      {icon}
    </button>
  )

  // ---- screens
  let body
  if (top?.id === 'album') {
    const a = ALB[top.album]
    const ids = TRACKS.filter((t) => t.album === a.id).map((t) => t.id)
    body = (
      <>
        {header(a.title, pop)}
        <div style={{ textAlign: 'center', padding: '8px 20px 4px' }}>
          <div style={{ display: 'inline-block', boxShadow: `0 20px 44px hsl(${a.hue} 70% 30% / .6)`, borderRadius: 22 }}>
            <Cover a={a} size={196} radius={22} />
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 16, letterSpacing: '-0.02em' }}>{a.title}</div>
          <div style={{ fontSize: 13.5, color: MUTED, marginTop: 3 }}>{a.artist} · {a.year} · {ids.length} songs</div>
        </div>
        <div style={{ display: 'flex', gap: 10, padding: '14px 20px' }}>
          {pill('Play', () => playList(ids, 0), true, <Icon name="play" size={18} />)}
          {pill('Shuffle', () => (setShuffle(true), playList([...ids].sort(() => Math.random() - 0.5), 0)), false, <Icon name="shuffle" size={18} />)}
        </div>
        <div style={{ display: 'grid', gap: 8, padding: '0 20px' }}>{ids.map((id, i) => trackRow(TRK[id], ids, i, { sub: `Track ${i + 1} · ${fmt(TRK[id].dur)}` }))}</div>
      </>
    )
  } else if (tab === 'now') {
    body = cur && (
      <>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 20px 0' }}>
          <button type="button" onClick={() => push({ id: 'album', album: cur.album })} style={{ border: 'none', background: 'none', color: INK, font: 'inherit', textAlign: 'left', cursor: 'pointer', padding: 0 }}>
            <span style={{ display: 'block', fontSize: 11, color: MUTED, letterSpacing: '.1em', textTransform: 'uppercase', fontWeight: 700 }}>Playing from album</span>
            <span style={{ display: 'block', fontSize: 15, fontWeight: 700, marginTop: 2 }}>{curAlbum.title}</span>
          </button>
          <button type="button" onClick={() => go('search')} aria-label="Search" style={{ ...iconBtn, width: 40, height: 40, background: CARD }}>
            <Icon name="search" size={19} />
          </button>
        </div>
        <div style={{ display: 'grid', placeItems: 'center', padding: '22px 0 20px' }}>
          <Disc a={curAlbum} size={236} playing={playing} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 26px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 23, fontWeight: 800, letterSpacing: '-0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cur.title}</div>
            <div style={{ fontSize: 14.5, color: MUTED, marginTop: 3 }}>{curAlbum.artist}</div>
          </div>
          <button type="button" onClick={() => (toggleLike(cur.id), say(liked[cur.id] ? 'Removed from Liked' : 'Added to Liked'))} aria-label="Like" aria-pressed={!!liked[cur.id]} style={{ ...iconBtn, width: 44, height: 44, color: liked[cur.id] ? accent : MUTED }}>
            <Icon name="heart" size={24} on={liked[cur.id]} />
          </button>
        </div>
        <div style={{ padding: '18px 26px 0' }}>
          <Waveform bars={bars} value={Math.min(1, shown / cur.dur)} accent={accent} dur={cur.dur} onChange={(f, fin) => (fin ? (setPos(f * cur.dur), setScrub(null)) : setScrub(f))} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: MUTED, marginTop: 6, fontVariantNumeric: 'tabular-nums' }}>
            <span style={{ color: scrub != null ? accent : MUTED }}>{fmt(shown)}</span>
            <span>-{fmt(cur.dur - shown)}</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 30px 0' }}>
          {ctl(<Icon name="shuffle" size={22} />, 'Shuffle', () => (setShuffle(!shuffle), say(shuffle ? 'Shuffle off' : 'Shuffle on')), shuffle)}
          {ctl(<Icon name="prev" size={30} />, 'Previous', prev, undefined, 48)}
          <button type="button" onClick={() => setPlaying(!playing)} aria-label={playing ? 'Pause' : 'Play'} style={{ ...iconBtn, width: 70, height: 70, background: accent, color: '#160a26', boxShadow: `0 10px 28px ${accent}66` }}>
            <Icon name={playing ? 'pause' : 'play'} size={32} />
          </button>
          {ctl(<Icon name="next" size={30} />, 'Next', () => next(false), undefined, 48)}
          {ctl(
            <>
              <Icon name="repeat" size={22} />
              {repeat === 'one' && <span style={{ position: 'absolute', fontSize: 9, fontWeight: 800, top: 9, left: '50%', marginLeft: -2 }}>1</span>}
            </>,
            `Repeat ${repeat}`,
            () => {
              const n = repeat === 'off' ? 'all' : repeat === 'all' ? 'one' : 'off'
              setRepeat(n)
              say(`Repeat ${n}`)
            },
            repeat !== 'off',
          )}
        </div>
      </>
    )
  } else if (tab === 'library') {
    const likedIds = TRACKS.filter((t) => liked[t.id]).map((t) => t.id)
    const all = TRACKS.map((t) => t.id)
    const artists = [...new Set(ALBUMS.map((a) => a.artist))]
    body = (
      <>
        {header('Library')}
        <div style={{ display: 'flex', gap: 8, padding: '4px 20px 12px' }} role="group" aria-label="Library view">
          {['Songs', 'Albums', 'Artists', 'Liked'].map((c) => (
            <button key={c} type="button" onClick={() => setLibTab(c)} aria-pressed={libTab === c} style={{ flex: 'none', height: 34, padding: '0 14px', borderRadius: 17, border: 'none', background: libTab === c ? accent : CARD, color: libTab === c ? '#160a26' : INK, font: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{c}</button>
          ))}
        </div>
        <div style={{ display: 'grid', gap: 8, padding: '0 20px' }}>
          {libTab === 'Songs' && TRACKS.map((t, i) => trackRow(t, all, i))}
          {libTab === 'Liked' && (likedIds.length ? likedIds.map((id, i) => trackRow(TRK[id], likedIds, i)) : <div style={{ textAlign: 'center', color: MUTED, fontSize: 13, padding: '40px 0' }}>Tap the heart on a song to like it.</div>)}
          {libTab === 'Albums' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {ALBUMS.map((a) => (
                <button key={a.id} type="button" onClick={() => push({ id: 'album', album: a.id })} style={{ border: 'none', background: 'none', padding: 0, font: 'inherit', color: INK, textAlign: 'left', cursor: 'pointer' }}>
                  <Cover a={a} size={158} radius={18} />
                  <span style={{ display: 'block', fontSize: 14, fontWeight: 700, marginTop: 8 }}>{a.title}</span>
                  <span style={{ display: 'block', fontSize: 12, color: MUTED }}>{a.artist}</span>
                </button>
              ))}
            </div>
          )}
          {libTab === 'Artists' &&
            artists.map((ar) => {
              const al = ALBUMS.find((a) => a.artist === ar)
              return (
                <button key={ar} type="button" onClick={() => (setQ(ar), go('search'))} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', border: 'none', borderRadius: 16, background: CARD, font: 'inherit', color: INK, textAlign: 'left', cursor: 'pointer' }}>
                  <span style={{ borderRadius: '50%', overflow: 'hidden', display: 'block', width: 48, height: 48 }}><Cover a={al} size={48} radius={0} /></span>
                  <span style={{ flex: 1, fontSize: 15, fontWeight: 600 }}>{ar}</span>
                  <Icon name="chev" size={18} color={MUTED} />
                </button>
              )
            })}
        </div>
      </>
    )
  } else if (tab === 'search') {
    const ql = q.trim().toLowerCase()
    const res = ql ? TRACKS.filter((t) => `${t.title} ${ALB[t.album].artist} ${ALB[t.album].title} ${t.genre}`.toLowerCase().includes(ql)) : []
    const ids = res.map((t) => t.id)
    const resAlbums = ql ? ALBUMS.filter((a) => `${a.title} ${a.artist}`.toLowerCase().includes(ql)) : []
    body = (
      <>
        {header('Search')}
        <div style={{ padding: '2px 20px 12px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, height: 46, padding: '0 14px', borderRadius: 23, background: CARD, color: MUTED }}>
            <Icon name="search" size={18} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Songs, albums, artists" aria-label="Search" style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'none', color: INK, font: 'inherit', fontSize: 15 }} />
            {q && (
              <button type="button" onClick={() => setQ('')} aria-label="Clear search" style={{ ...iconBtn, width: 24, height: 24, color: MUTED }}>
                <Icon name="x" size={16} />
              </button>
            )}
          </label>
        </div>
        {!ql ? (
          <>
            <div style={{ padding: '0 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <h2 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 800 }}>Recent</h2>
                <button type="button" onClick={() => setRecents([])} style={{ border: 'none', background: 'none', color: accent, font: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 0 }}>Clear</button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {recents.map((r) => (
                  <button key={r} type="button" onClick={() => setQ(r)} style={{ height: 34, padding: '0 14px', borderRadius: 17, border: 'none', background: CARD, color: INK, font: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{r}</button>
                ))}
                {!recents.length && <span style={{ fontSize: 13, color: MUTED }}>No recent searches.</span>}
              </div>
              <h2 style={{ margin: '22px 0 10px', fontSize: 15, fontWeight: 800 }}>Browse genres</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: '0 20px' }}>
              {GENRES.map(([g, h]) => (
                <button key={g} type="button" onClick={() => setQ(g)} style={{ height: 88, borderRadius: 18, border: 'none', padding: 14, textAlign: 'left', cursor: 'pointer', color: '#fff', font: 'inherit', fontSize: 17, fontWeight: 800, background: `linear-gradient(135deg, hsl(${h} 80% 55%), hsl(${(h + 60) % 360} 70% 25%))` }}>{g}</button>
              ))}
            </div>
          </>
        ) : (
          <div style={{ display: 'grid', gap: 8, padding: '0 20px' }}>
            {resAlbums.map((a) => (
              <button key={a.id} type="button" onClick={() => (setRecents((r) => [q.trim(), ...r.filter((x) => x !== q.trim())].slice(0, 5)), push({ id: 'album', album: a.id }))} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', border: 'none', borderRadius: 16, background: CARD, font: 'inherit', color: INK, textAlign: 'left', cursor: 'pointer' }}>
                <Cover a={a} size={44} radius={10} />
                <span style={{ flex: 1 }}>
                  <span style={{ display: 'block', fontSize: 14.5, fontWeight: 600 }}>{a.title}</span>
                  <span style={{ display: 'block', fontSize: 12, color: MUTED }}>Album · {a.artist}</span>
                </span>
                <Icon name="chev" size={18} color={MUTED} />
              </button>
            ))}
            {res.map((t, i) => trackRow(t, ids, i, { onPlay: () => (setRecents((r) => [q.trim(), ...r.filter((x) => x !== q.trim())].slice(0, 5)), playList(ids, i)) }))}
            {!res.length && !resAlbums.length && <div style={{ textAlign: 'center', color: MUTED, fontSize: 13, padding: '40px 0' }}>No matches for “{q}”.</div>}
          </div>
        )}
      </>
    )
  } else {
    // queue
    body = (
      <>
        {header('Queue', null, <button type="button" onClick={() => (setQueue(cur ? [cur.id] : []), setIdx(0), say('Upcoming cleared'))} style={{ border: 'none', background: 'none', color: accent, font: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Clear upcoming</button>)}
        <div style={{ padding: '0 20px', display: 'grid', gap: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '.08em', margin: '4px 0 0' }}>Now playing</div>
          {cur && <TrackRow t={cur} accent={accent} active playing={playing} onPlay={() => setPlaying(!playing)} />}
          <div style={{ fontSize: 12, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '.08em', margin: '10px 0 0' }}>Up next · {queue.length - idx - 1}</div>
          {queue.slice(idx + 1).map((id, k) => {
            const i = idx + 1 + k
            return (
              <div key={`${id}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <TrackRow t={TRK[id]} accent={accent} onPlay={() => (jump(i), setPlaying(true))} />
                </div>
                <div style={{ display: 'grid' }}>
                  <button type="button" onClick={() => moveAt(i, -1)} disabled={i === idx + 1} aria-label="Move up" style={{ ...iconBtn, width: 28, height: 24, color: i === idx + 1 ? '#444' : MUTED }}><Icon name="up" size={16} /></button>
                  <button type="button" onClick={() => moveAt(i, 1)} disabled={i === queue.length - 1} aria-label="Move down" style={{ ...iconBtn, width: 28, height: 24, color: i === queue.length - 1 ? '#444' : MUTED }}><Icon name="down" size={16} /></button>
                </div>
                <button type="button" onClick={() => removeAt(i)} aria-label="Remove from queue" style={{ ...iconBtn, width: 34, height: 34, color: MUTED }}><Icon name="trash" size={17} /></button>
              </div>
            )
          })}
          {queue.length - idx - 1 <= 0 && (
            <div style={{ textAlign: 'center', color: MUTED, fontSize: 13, padding: '28px 0' }}>
              Nothing queued.
              <button type="button" onClick={() => go('library')} style={{ display: 'block', margin: '10px auto 0', border: 'none', background: 'none', color: accent, font: 'inherit', fontWeight: 700, cursor: 'pointer' }}>Browse the library</button>
            </div>
          )}
        </div>
      </>
    )
  }

  const bottomPad = 88 + (mini ? 66 : 0)
  const upNext = queue.slice(idx + 1)
  return (
    <Shell frame={frame} backdrop="radial-gradient(ellipse at 50% 30%, #2a2145, #0a0812 75%)" style={style}>
      <style>{`
        @keyframes mu-r { from { opacity: 0; transform: translateX(34px) } to { opacity: 1; transform: none } }
        @keyframes mu-l { from { opacity: 0; transform: translateX(-34px) } to { opacity: 1; transform: none } }
        @keyframes mu-spin { to { transform: rotate(360deg) } }
        @keyframes mu-eq { from { transform: scaleY(.25) } to { transform: scaleY(1) } }
        .mu-scroll { scrollbar-width: none } .mu-scroll::-webkit-scrollbar { display: none }
        .mu-app button:focus-visible, .mu-app input:focus-visible, .mu-app [role=slider]:focus-visible { outline: 2px solid ${accent}; outline-offset: 2px }
        .mu-app input::placeholder { color: ${MUTED} }
        @media (prefers-reduced-motion: reduce) {
          .mu-disc, .mu-eq i, .mu-page { animation: none !important }
        }
      `}</style>
      <StatusBar frame={frame} />
      <div aria-hidden="true" style={{ position: 'absolute', top: -120, left: -60, width: 300, height: 300, borderRadius: '50%', background: curAlbum ? `hsl(${curAlbum.hue} 80% 45% / .28)` : 'transparent', filter: 'blur(60px)', transition: 'background .6s' }} />
      <div key={`${tab}/${stack.map((s) => s.id + (s.album || '')).join('/')}`} className="mu-scroll mu-page" style={{ position: 'absolute', top: 54, bottom: bottomPad, left: 0, right: 0, overflowY: tab === 'now' && !top ? 'hidden' : 'auto', paddingBottom: tab === 'now' && !top ? 0 : 20, animation: `${dir > 0 ? 'mu-r' : 'mu-l'} .28s ease` }}>
        {body}
      </div>

      {tab === 'now' && !top && cur && (
        <>
          {sheet && <div onClick={() => setSheet(false)} style={{ position: 'absolute', inset: 0, zIndex: 11, background: 'rgba(0,0,0,.45)' }} />}
          <section aria-label="Up next" style={{ position: 'absolute', left: 0, right: 0, bottom: 88, height: SHEET_H, zIndex: 12, transform: `translateY(${sheetY}px)`, transition: sheetDy == null ? 'transform .3s cubic-bezier(.2,.8,.2,1)' : 'none', background: '#201a33', borderRadius: '26px 26px 0 0', boxShadow: '0 -10px 30px rgba(0,0,0,.4)', display: 'flex', flexDirection: 'column' }}>
            <div onPointerDown={sheetDown} onPointerMove={sheetMove} onPointerUp={sheetUp} onPointerCancel={sheetUp} role="button" tabIndex={0} aria-expanded={sheet} aria-label="Queue sheet. Drag up or press to open" onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setSheet(!sheet))} style={{ height: PEEK, flex: 'none', cursor: 'grab', touchAction: 'none', userSelect: 'none', padding: '9px 22px 0', outline: 'none' }}>
              <div style={{ width: 40, height: 5, borderRadius: 3, background: 'rgba(255,255,255,.3)', margin: '0 auto 12px' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 15, fontWeight: 800 }}>Up next</span>
                <span style={{ fontSize: 12.5, color: MUTED }}>{upNext.length ? `${TRK[upNext[0]].title} · ${upNext.length} queued` : 'Queue is empty'}</span>
              </div>
            </div>
            <div className="mu-scroll" style={{ flex: 1, overflowY: 'auto', padding: '4px 16px 16px', display: 'grid', gap: 6, alignContent: 'start' }}>
              {upNext.map((id, k) => (
                <button key={`${id}-${k}`} type="button" onClick={() => (jump(idx + 1 + k), setPlaying(true), setSheet(false))} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 8px', border: 'none', borderRadius: 14, background: 'rgba(255,255,255,.05)', font: 'inherit', color: INK, textAlign: 'left', cursor: 'pointer' }}>
                  <Cover a={ALB[TRK[id].album]} size={38} radius={9} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{TRK[id].title}</span>
                    <span style={{ display: 'block', fontSize: 11.5, color: MUTED }}>{ALB[TRK[id].album].artist}</span>
                  </span>
                  <span style={{ fontSize: 12, color: MUTED }}>{fmt(TRK[id].dur)}</span>
                </button>
              ))}
              <button type="button" onClick={() => (setSheet(false), go('queue'))} style={{ height: 42, border: 'none', borderRadius: 21, background: 'none', color: accent, font: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Open full queue</button>
            </div>
          </section>
        </>
      )}

      {mini && (
        <div style={{ position: 'absolute', left: 10, right: 10, bottom: 98, height: 58, zIndex: 9, borderRadius: 18, background: '#241d3a', boxShadow: '0 8px 22px rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', gap: 4, padding: '0 6px 0 8px', overflow: 'hidden' }}>
          <button type="button" onClick={() => go('now')} aria-label="Open player" style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, border: 'none', background: 'none', color: INK, font: 'inherit', textAlign: 'left', cursor: 'pointer', padding: 0 }}>
            <Cover a={curAlbum} size={42} radius={10} />
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cur.title}</span>
              <span style={{ display: 'block', fontSize: 11.5, color: MUTED }}>{curAlbum.artist}</span>
            </span>
          </button>
          <button type="button" onClick={() => setPlaying(!playing)} aria-label={playing ? 'Pause' : 'Play'} style={{ ...iconBtn, width: 40, height: 40 }}><Icon name={playing ? 'pause' : 'play'} size={22} /></button>
          <button type="button" onClick={() => next(false)} aria-label="Next" style={{ ...iconBtn, width: 40, height: 40 }}><Icon name="next" size={22} /></button>
          <span style={{ position: 'absolute', left: 0, bottom: 0, height: 2.5, width: `${Math.min(100, (pos / cur.dur) * 100)}%`, background: accent }} />
        </div>
      )}

      <nav aria-label="Main" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 88, zIndex: 13, background: '#120f1d', borderTop: `1px solid ${LINE}`, display: 'flex', justifyContent: 'space-around', padding: '10px 8px 0' }}>
        {NAV.map(([id, icon, label]) => (
          <button key={id} type="button" onClick={() => go(id)} aria-current={tab === id && !top ? 'page' : undefined} style={{ border: 'none', background: 'none', font: 'inherit', cursor: 'pointer', display: 'grid', justifyItems: 'center', alignContent: 'start', gap: 3, width: 72, height: 54, fontSize: 11, fontWeight: 600, color: tab === id ? accent : MUTED }}>
            <Icon name={icon} size={23} />
            {label}
          </button>
        ))}
      </nav>
      <div role="status" style={{ position: 'absolute', left: '50%', top: 58, zIndex: 50, transform: `translate(-50%, ${toast ? 0 : -90}px)`, transition: 'transform .35s cubic-bezier(.2,.8,.2,1)', padding: '10px 16px', borderRadius: 20, background: INK, color: BG, fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap' }}>{toast}</div>
      <div style={{ position: 'absolute', left: '50%', bottom: 8, width: 140, height: 5, marginLeft: -70, borderRadius: 3, background: INK, opacity: 0.8, zIndex: 25 }} />
    </Shell>
  )
}
