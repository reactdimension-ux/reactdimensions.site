import { memo, useEffect, useId, useRef, useState } from 'react'

// A camera app on a phone, as a click-through prototype. The viewfinder is a
// live, animated SVG seascape (the sun crosses the sky, clouds drift, a boat
// sails, day turns to night). Drag the Photo / Portrait / Video / Pano
// carousel (or swipe the picture), tap anywhere to drop a focus ring, toggle
// flash / timer / grid, pick a filter (a real CSS-filter restyle with a
// strength slider) and press the shutter: the frame flashes, flies into the
// gallery thumbnail, and lands in Gallery. Video mode runs a recording timer.
// Open any shot in Photo detail to favourite it, change its filter, or delete
// it. Settings holds the camera options. The phone scales to fit its box.

const W = 390 // the phone screen, in CSS px
const H = 844
const INK = '#f4f4f6'
const MUTED = '#8d8f9a'
const BG = '#0b0b0e'
const PANEL = '#18181d'
const MODES = ['Photo', 'Portrait', 'Video', 'Pano']

const ICONS = {
  back: 'M15 5l-7 7 7 7',
  chev: 'M9 5l7 7-7 7',
  bolt: 'M13 3L5 13h6l-1 8 8-10h-6z',
  grid: 'M4 4h16v16H4zM9.3 4v16M14.7 4v16M4 9.3h16M4 14.7h16',
  timer: 'M12 8v5l3 2M9 2h6M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16z',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7 7 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z',
  flip: 'M4 8h13l-3-3M20 16H7l3 3',
  heart: 'M12 20s-7-4.4-9-9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c-2 4.6-9 9-9 9z',
  trash: 'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13M10 11v6M14 11v6',
  share: 'M12 15V4m0 0L8 8m4-4l4 4M5 13v6h14v-6',
  play: 'M8 5l11 7-11 7z',
  pause: 'M8 5v14M16 5v14',
  sliders: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4',
  check: 'M5 12l5 5 9-10',
  x: 'M6 6l12 12M18 6L6 18',
  image: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M9 9.5h.01',
  info: 'M12 8h.01M11 12h1v5h1M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
}

function Icon({ name, size = 22, color = 'currentColor', w = 1.9, fill = 'none' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  )
}

const FILTERS = [
  { id: 'none', name: 'Original', css: 'none' },
  { id: 'vivid', name: 'Vivid', css: 'saturate(1.7) contrast(1.12)' },
  { id: 'warm', name: 'Warm', css: 'sepia(.4) saturate(1.35) hue-rotate(-12deg) brightness(1.04)' },
  { id: 'cool', name: 'Cool', css: 'hue-rotate(18deg) saturate(1.15) brightness(1.05)' },
  { id: 'fade', name: 'Fade', css: 'contrast(.82) brightness(1.14) saturate(.75)' },
  { id: 'mono', name: 'Mono', css: 'grayscale(1) contrast(1.12)' },
  { id: 'noir', name: 'Noir', css: 'grayscale(1) contrast(1.6) brightness(.82)' },
  { id: 'dusk', name: 'Dusk', css: 'sepia(.55) hue-rotate(-35deg) saturate(1.5) contrast(1.05)' },
]
const filterCss = (id) => (FILTERS.find((f) => f.id === id) || FILTERS[0]).css

// ------------------------------------------------------------ scene (SVG)

const KEYS = [
  [0, '#3b2a6b', '#ff9a6b', '#5b4b8a', '#2c2347'],
  [0.25, '#2a7fe0', '#bfe6ff', '#1f7fb8', '#2f7d4f'],
  [0.5, '#4a2a7a', '#ff6a4d', '#6a3a7a', '#2a2040'],
  [0.75, '#050a1f', '#1b2a55', '#0b1735', '#0a1020'],
  [1, '#3b2a6b', '#ff9a6b', '#5b4b8a', '#2c2347'],
]
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
const lerpHex = (a, b, t) => {
  const A = rgb(a)
  const B = rgb(b)
  return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`
}
const CYCLE = 80 // seconds for a full day
const dayU = (phase) => (((phase / CYCLE) % 1) + 1) % 1
const isDark = (phase) => {
  const u = dayU(phase)
  return u > 0.58 && u < 0.92
}
function palette(u) {
  let i = 0
  while (i < KEYS.length - 2 && u > KEYS[i + 1][0]) i++
  const a = KEYS[i]
  const b = KEYS[i + 1]
  const t = (u - a[0]) / (b[0] - a[0])
  return [1, 2, 3, 4].map((k) => lerpHex(a[k], b[k], t))
}
const STARS = Array.from({ length: 30 }, (_, i) => [(i * 137) % 390, (i * 71) % 230, 0.6 + ((i * 29) % 10) / 9])
const CLOUDS = [
  [30, 7, 70, 1],
  [210, 4, 110, 0.8],
  [330, 11, 50, 0.6],
]

function Person() {
  return (
    <svg viewBox="0 0 390 520" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} aria-hidden="true">
      <path d="M40 520c4-90 60-130 155-130s151 40 155 130z" fill="#15131c" />
      <path d="M40 520c4-90 60-130 155-130" fill="none" stroke="rgba(255,190,140,.45)" strokeWidth="3" />
      <rect x="175" y="345" width="40" height="50" rx="14" fill="#c98f6e" />
      <ellipse cx="195" cy="310" rx="47" ry="56" fill="#d9a07c" />
      <path d="M146 304c-2-52 34-70 58-66 32 3 44 30 40 66-10-26-26-34-50-34s-40 8-48 34z" fill="#241913" />
      <circle cx="177" cy="314" r="3.5" fill="#2b1d16" />
      <circle cx="213" cy="314" r="3.5" fill="#2b1d16" />
      <path d="M184 338q11 8 22 0" fill="none" stroke="#8a4a3a" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

const Seascape = memo(function Seascape({ phase, vb }) {
  const uid = useId().replace(/:/g, '')
  const u = dayU(phase)
  const [top, bot, sea, hill] = palette(u)
  const night = Math.max(0, Math.min(1, 1 - Math.abs(u - 0.75) / 0.2))
  const sunU = u < 0.55 ? u / 0.55 : null
  const moonU = u >= 0.55 ? (u - 0.55) / 0.45 : null
  const arc = (m) => [40 + m * 310, 330 - Math.sin(Math.PI * m) * 230]
  const [bx, by] = sunU !== null ? arc(sunU) : arc(moonU)
  const boatX = ((phase * 7 + 60) % 520) - 80
  const boatY = 395 + Math.sin(phase * 1.6) * 2.2
  const birdX = ((phase * 22) % 520) - 60
  const birdY = 140 + Math.sin(phase) * 18
  const flap = Math.sin(phase * 9) * 5
  return (
    <svg viewBox={vb} preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }} aria-hidden="true">
      <defs>
        <linearGradient id={`${uid}s`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={top} />
          <stop offset="1" stopColor={bot} />
        </linearGradient>
        <linearGradient id={`${uid}w`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={bot} />
          <stop offset="0.35" stopColor={sea} />
          <stop offset="1" stopColor={top} />
        </linearGradient>
        <radialGradient id={`${uid}g`}>
          <stop offset="0" stopColor={sunU !== null ? '#fff1b8' : '#dfe8ff'} stopOpacity=".9" />
          <stop offset="1" stopColor={sunU !== null ? '#ffb347' : '#8fa4ff'} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="390" height="520" fill={`url(#${uid}s)`} />
      {STARS.map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill="#fff" opacity={night * (0.5 + 0.5 * Math.sin(phase * 2 + i))} />
      ))}
      <circle cx={bx} cy={by} r="80" fill={`url(#${uid}g)`} />
      <circle cx={bx} cy={by} r={sunU !== null ? 26 : 20} fill={sunU !== null ? '#fff6d0' : '#f4f1de'} />
      {sunU === null && (
        <>
          <circle cx={bx - 6} cy={by - 4} r="4" fill="#d9d5be" />
          <circle cx={bx + 7} cy={by + 6} r="3" fill="#d9d5be" />
        </>
      )}
      {CLOUDS.map(([x0, sp, y, s], i) => {
        const x = ((x0 + phase * sp) % 560) - 110
        return (
          <g key={i} transform={`translate(${x} ${y * 1.0 + 40}) scale(${s})`} opacity={0.9 - night * 0.55}>
            <ellipse cx="0" cy="0" rx="46" ry="13" fill={lerpHex('#ffffff', bot.startsWith('rgb') ? '#b9a6d9' : bot, 0.12 + night * 0.4)} />
            <ellipse cx="-16" cy="-9" rx="22" ry="12" fill="rgba(255,255,255,.75)" />
            <ellipse cx="14" cy="-12" rx="26" ry="14" fill="rgba(255,255,255,.75)" />
          </g>
        )
      })}
      <g transform={`translate(${birdX} ${birdY})`} fill="none" stroke="rgba(20,20,30,.75)" strokeWidth="2" strokeLinecap="round">
        <path d={`M-10,${flap} Q-5,-7 0,0 Q5,-7 10,${flap}`} />
      </g>
      <path d="M0 330l60-90 40 50 55-120 70 130 50-60 60 70 55-90v200H0z" fill={hill} opacity=".7" />
      <path d="M0 360c60-40 110-60 170-30s120 10 220-30v220H0z" fill={hill} />
      {/* lighthouse */}
      <g transform="translate(318 292)">
        <path d="M-9 70l5-52h8l5 52z" fill="#e9e4dc" />
        <path d="M-6 38h12l1 10h-14zM-4 18h8l-1-8h-6z" fill="#c0392b" />
        <rect x="-6" y="4" width="12" height="9" rx="2" fill="#ffe28a" opacity={0.4 + night * 0.6} />
        <path d="M0 8l-130-18v36z" fill="#fff7c0" opacity={night * 0.28} />
      </g>
      <rect y="368" width="390" height="152" fill={`url(#${uid}w)`} />
      <rect x={bx - 14} y="370" width="28" height="140" fill={sunU !== null ? '#fff3c0' : '#dfe8ff'} opacity={0.22 + night * 0.1} />
      {Array.from({ length: 9 }, (_, i) => (
        <path key={i} d={`M${((i * 61 + phase * 9) % 440) - 30} ${384 + i * 14}h${30 + i * 3}`} stroke="rgba(255,255,255,.35)" strokeWidth="2" strokeLinecap="round" />
      ))}
      <g transform={`translate(${boatX} ${boatY}) rotate(${Math.sin(phase * 1.6) * 2.5})`}>
        <path d="M-22 0h44l-8 11h-28z" fill="#2b2230" />
        <path d="M0-4V-42l22 34z" fill="#f7f1e6" />
        <path d="M-2-4V-34l-16 30z" fill="#ffd58a" />
      </g>
      <path d="M0 520V455l30-28 24 28v-40l36-34 34 40v118z" fill="#07140d" opacity=".92" />
      <path d="M34 520l20-60 20 60zM82 520l24-80 26 80z" fill="#0a2012" />
      <path d="M390 520v-50c-30-8-52 4-60 20-8-14-26-18-46-8v38z" fill="#101319" />
    </svg>
  )
})

// The picture itself. `filter` + `strength` restyle it with CSS filters.
const Scene = memo(function Scene({ phase, filter = 'none', strength = 1, portrait, front, zoom = 1, vb = '0 0 390 520' }) {
  const css = filterCss(filter)
  const layer = (extra) => (
    <div style={{ position: 'absolute', inset: 0, ...extra }}>
      <div style={{ position: 'absolute', inset: 0, transform: `scale(${zoom}) ${front ? 'scaleX(-1)' : ''}`, transformOrigin: '50% 50%' }}>
        <div style={{ position: 'absolute', inset: 0, filter: portrait ? 'blur(5px)' : 'none', transform: portrait ? 'scale(1.04)' : 'none' }}>
          <Seascape phase={phase} vb={vb} />
        </div>
        {(portrait || front) && <Person />}
      </div>
    </div>
  )
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: '#000' }}>
      {layer()}
      {css !== 'none' && layer({ filter: css, opacity: strength })}
    </div>
  )
})

// A scene that animates itself (so the app does not re-render ten times a second).
function LiveScene({ phaseRef, start = 18, ...rest }) {
  const [phase, setPhase] = useState(() => phaseRef.current ?? start)
  useEffect(() => {
    phaseRef.current = phase
  })
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined
    const t0 = performance.now() - ((phaseRef.current ?? start) * 1000)
    const id = setInterval(() => setPhase((performance.now() - t0) / 1000), 90)
    return () => clearInterval(id)
  }, [phaseRef, start])
  return <Scene phase={phase} {...rest} />
}

// ------------------------------------------------------------ pieces

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

const fmtDur = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
const iconBtn = { display: 'grid', placeItems: 'center', border: 'none', borderRadius: '50%', cursor: 'pointer', padding: 0, background: 'transparent', color: INK }

const SEED = [
  { id: 'p1', phase: 22, mode: 'Photo', filter: 'none', label: 'Today, 08:12' },
  { id: 'p2', phase: 51, mode: 'Photo', filter: 'warm', label: 'Today, 07:40', fav: true },
  { id: 'p3', phase: 61, mode: 'Portrait', filter: 'fade', label: 'Yesterday, 19:05' },
  { id: 'p4', phase: 69, mode: 'Photo', filter: 'noir', label: 'Yesterday, 18:20' },
  { id: 'p5', phase: 8, mode: 'Video', filter: 'vivid', label: 'Mon 10 Nov', dur: 12 },
  { id: 'p6', phase: 36, mode: 'Pano', filter: 'cool', label: 'Sun 9 Nov' },
].map((p) => ({ zoom: 1, strength: 1, fav: false, front: false, ...p }))

function Thumb({ p, size = '100%', radius = 0 }) {
  return (
    <span style={{ position: 'relative', display: 'block', width: size, height: size, overflow: 'hidden', borderRadius: radius }}>
      <Scene phase={p.phase} filter={p.filter} strength={p.strength} portrait={p.mode === 'Portrait'} front={p.front} zoom={p.zoom} vb={p.mode === 'Pano' ? '0 150 390 220' : '0 60 390 390'} />
    </span>
  )
}

function Segment({ options, value, onChange, accent, label }) {
  return (
    <div role="group" aria-label={label} style={{ display: 'flex', background: '#26262d', borderRadius: 10, padding: 2 }}>
      {options.map(([v, l]) => (
        <button key={String(v)} type="button" onClick={() => onChange(v)} aria-pressed={value === v} style={{ flex: 1, height: 30, minWidth: 46, padding: '0 8px', border: 'none', borderRadius: 8, background: value === v ? accent : 'transparent', color: value === v ? '#111' : INK, font: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
          {l}
        </button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------- app

export default function CameraApp({ name = 'Lumen', accent = '#ffd23f', startScreen = 'viewfinder', frame = true, style }) {
  const box = useRef()
  const toastTimer = useRef()
  const focusTimer = useRef()
  const countTimer = useRef()
  const recTimer = useRef()
  const flyTimer = useRef()
  const pressTimer = useRef()
  const phaseRef = useRef(null)
  const recSecs = useRef(0)
  const drag = useRef(null)
  const swipe = useRef(null)
  const [scale, setScale] = useState(1)
  const [stack, setStack] = useState([])
  const [dir, setDir] = useState(1)
  const [toast, setToast] = useState('')
  const [photos, setPhotos] = useState(SEED)
  const [mode, setMode] = useState(0)
  const [dragDx, setDragDx] = useState(0)
  const [flash, setFlash] = useState('auto') // off | auto | on
  const [timer, setTimer] = useState(0)
  const [count, setCount] = useState(0)
  const [front, setFront] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [filter, setFilter] = useState('none')
  const [strength, setStrength] = useState(1)
  const [ring, setRing] = useState(null)
  const [flashKey, setFlashKey] = useState(0)
  const [fly, setFly] = useState(null)
  const [thumbId, setThumbId] = useState('p1')
  const [press, setPress] = useState(false)
  const [rec, setRec] = useState(0) // seconds recorded, 0 = not recording
  const [recording, setRecording] = useState(false)
  const [libFilter, setLibFilter] = useState('All')
  const [confirm, setConfirm] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [playT, setPlayT] = useState(0)
  const [cfg, setCfg] = useState({ grid: false, hdr: true, sound: true, geo: false, fmt: 'HEIF', quality: 85 })

  const initStack = (s) => {
    if (s === 'viewfinder' || !s) return []
    return [s === 'detail' ? { id: 'detail', pid: SEED[1].id } : { id: s }]
  }
  useEffect(() => {
    setStack(initStack(startScreen))
  }, [startScreen]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const ro = new ResizeObserver(([e]) => {
      const fw = frame ? W + 28 : W
      const fh = frame ? H + 28 : H
      setScale(Math.min(1.2, (e.contentRect.width - 24) / fw, (e.contentRect.height - 24) / fh))
    })
    ro.observe(box.current)
    return () => ro.disconnect()
  }, [frame])

  useEffect(
    () => () => {
      ;[toastTimer, focusTimer, flyTimer, pressTimer].forEach((r) => clearTimeout(r.current))
      clearInterval(countTimer.current)
      clearInterval(recTimer.current)
    },
    [],
  )

  const say = (t) => {
    setToast(t)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 1800)
  }

  const top = stack[stack.length - 1]
  const screen = top?.id || 'viewfinder'
  const curMode = MODES[mode]

  const addPhoto = (extra) => {
    const p = { id: `n${Date.now()}`, phase: phaseRef.current ?? 18, mode: curMode, filter, strength, zoom, front, fav: false, label: `Today, ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`, ...extra }
    setPhotos((a) => [p, ...a])
    return p
  }

  const stopRec = () => {
    clearInterval(recTimer.current)
    setRecording(false)
    const secs = recSecs.current - 1
    recSecs.current = 0
    setRec(0)
    if (secs >= 0) {
      const p = addPhoto({ mode: 'Video', dur: Math.max(1, secs) })
      say(`Video saved · ${fmtDur(Math.max(1, secs))}`)
      setThumbId(p.id)
    }
  }

  const push = (s) => {
    if (recording) stopRec()
    clearInterval(countTimer.current)
    setCount(0)
    setDir(1)
    setConfirm(false)
    setPlaying(false)
    setPlayT(0)
    setStack((a) => [...a, s])
  }
  const pop = () => {
    setDir(-1)
    setConfirm(false)
    setPlaying(false)
    setPlayT(0)
    setStack((a) => a.slice(0, -1))
  }

  const shoot = () => {
    const p = addPhoto({ mode: curMode })
    const needFlash = flash === 'on' || (flash === 'auto' && isDark(phaseRef.current ?? 18))
    if (needFlash && !front) setFlashKey((k) => k + 1)
    setPress(true)
    clearTimeout(pressTimer.current)
    pressTimer.current = setTimeout(() => setPress(false), 150)
    setFly(p)
    clearTimeout(flyTimer.current)
    flyTimer.current = setTimeout(() => {
      setFly(null)
      setThumbId(p.id)
    }, 650)
    if (cfg.sound) say('Click')
  }

  const onShutter = () => {
    if (curMode === 'Video') {
      if (recording) return stopRec()
      setRecording(true)
      recSecs.current = 1
      setRec(1)
      clearInterval(recTimer.current)
      recTimer.current = setInterval(() => {
        recSecs.current += 1
        setRec(recSecs.current)
      }, 1000)
      return undefined
    }
    if (count > 0) {
      clearInterval(countTimer.current)
      setCount(0)
      return undefined
    }
    if (timer > 0) {
      let n = timer
      setCount(n)
      clearInterval(countTimer.current)
      countTimer.current = setInterval(() => {
        n -= 1
        if (n <= 0) {
          clearInterval(countTimer.current)
          setCount(0)
          shoot()
        } else setCount(n)
      }, 1000)
      return undefined
    }
    shoot()
    return undefined
  }

  const setModeSafe = (i) => {
    const n = Math.max(0, Math.min(MODES.length - 1, i))
    if (recording) stopRec()
    setMode(n)
  }

  // carousel drag
  const cDown = (e) => {
    const mi = e.target.closest?.('[data-mi]')
    drag.current = { x: e.clientX, moved: false, mi: mi ? +mi.getAttribute('data-mi') : null }
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  const cMove = (e) => {
    if (!drag.current) return
    const dx = (e.clientX - drag.current.x) / scale
    if (Math.abs(dx) > 4) drag.current.moved = true
    setDragDx(dx)
  }
  const cUp = () => {
    if (!drag.current) return
    const dx = dragDx
    const tapped = !drag.current.moved ? drag.current.mi : null
    drag.current = null
    setDragDx(0)
    if (tapped != null) setModeSafe(tapped)
    else if (Math.abs(dx) > 28) setModeSafe(mode + (dx < 0 ? 1 : -1) * Math.max(1, Math.round(Math.abs(dx) / 80)))
  }

  // viewfinder: tap = focus, swipe = change mode
  const vDown = (e) => {
    const r = e.currentTarget.getBoundingClientRect()
    swipe.current = { x: e.clientX, y: e.clientY }
    const x = (e.clientX - r.left) / scale
    const y = (e.clientY - r.top) / scale
    setRing({ x, y, k: Date.now() })
    clearTimeout(focusTimer.current)
    focusTimer.current = setTimeout(() => setRing(null), 1400)
  }
  const vUp = (e) => {
    const s = swipe.current
    swipe.current = null
    if (!s) return
    const dx = e.clientX - s.x
    if (Math.abs(dx) > 60 * scale && Math.abs(e.clientY - s.y) < 40 * scale) {
      setModeSafe(mode + (dx < 0 ? 1 : -1))
      setRing(null)
    }
  }

  const cycleFlash = () => {
    const n = flash === 'off' ? 'auto' : flash === 'auto' ? 'on' : 'off'
    setFlash(n)
    say(`Flash ${n}`)
  }
  const cycleTimer = () => {
    const n = timer === 0 ? 3 : timer === 3 ? 10 : 0
    setTimer(n)
    say(n ? `Timer ${n}s` : 'Timer off')
  }

  const toggleFav = (id) => setPhotos((a) => a.map((p) => (p.id === id ? { ...p, fav: !p.fav } : p)))
  const setPhotoFilter = (id, f) => setPhotos((a) => a.map((p) => (p.id === id ? { ...p, filter: f } : p)))
  const del = (id) => {
    setPhotos((a) => a.filter((p) => p.id !== id))
    setThumbId((t) => (t === id ? null : t))
    setConfirm(false)
    say('Photo deleted')
    setDir(-1)
    setStack((s) => s.slice(0, -1))
  }

  // video playback in detail
  const detailPhoto = screen === 'detail' ? photos.find((p) => p.id === top.pid) : null
  useEffect(() => {
    if (!playing || !detailPhoto?.dur) return undefined
    const id = setInterval(
      () =>
        setPlayT((t) => {
          if (t + 0.1 >= detailPhoto.dur) {
            setPlaying(false)
            return 0
          }
          return t + 0.1
        }),
      100,
    )
    return () => clearInterval(id)
  }, [playing, detailPhoto?.dur])

  const thumbPhoto = photos.find((p) => p.id === thumbId) || photos[0]
  const shown = photos.filter((p) => (libFilter === 'All' ? true : libFilter === 'Favourites' ? p.fav : p.mode === 'Video'))

  const header = (title, right) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px 6px', minHeight: 52 }}>
      <button type="button" onClick={pop} aria-label="Back" style={{ ...iconBtn, width: 38, height: 38, background: '#232329' }}>
        <Icon name="back" size={20} />
      </button>
      <h1 style={{ margin: 0, flex: 1, fontSize: 18, fontWeight: 700, marginLeft: 4 }}>{title}</h1>
      {right}
    </div>
  )

  const switchRow = (label, sub, on, set) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 0', borderBottom: '1px solid #26262d' }}>
      <span>
        <span style={{ display: 'block', fontSize: 14.5, fontWeight: 600 }}>{label}</span>
        {sub && <span style={{ display: 'block', fontSize: 12, color: MUTED, marginTop: 2 }}>{sub}</span>}
      </span>
      <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => set(!on)} style={{ width: 48, height: 28, borderRadius: 14, border: 'none', padding: 3, background: on ? accent : '#3a3a43', cursor: 'pointer', transition: 'background .2s', flex: 'none' }}>
        <span style={{ display: 'block', width: 22, height: 22, borderRadius: '50%', background: on ? '#111' : '#fff', transform: `translateX(${on ? 20 : 0}px)`, transition: 'transform .2s' }} />
      </button>
    </div>
  )

  // ---------------- screens
  let body
  let overlay = null
  if (screen === 'gallery') {
    body = (
      <>
        {header('Library', <span style={{ fontSize: 12.5, color: MUTED, paddingRight: 6 }}>{photos.length} items</span>)}
        <div style={{ padding: '4px 14px 12px' }}>
          <Segment label="Show" accent={accent} value={libFilter} onChange={setLibFilter} options={[['All', 'All'], ['Favourites', 'Favourites'], ['Videos', 'Videos']]} />
        </div>
        {shown.length ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>
            {shown.map((p) => (
              <button key={p.id} type="button" onClick={() => push({ id: 'detail', pid: p.id })} aria-label={`Open ${p.mode} from ${p.label}`} style={{ position: 'relative', aspectRatio: '1', padding: 0, border: 'none', background: '#000', cursor: 'pointer' }}>
                <Thumb p={p} />
                {p.fav && <span style={{ position: 'absolute', left: 6, bottom: 6, color: '#ff5d73', display: 'flex' }}><Icon name="heart" size={15} fill="#ff5d73" color="#ff5d73" /></span>}
                {p.dur && <span style={{ position: 'absolute', right: 6, bottom: 6, fontSize: 11, fontWeight: 700, color: '#fff', textShadow: '0 1px 3px #000' }}>{fmtDur(p.dur)}</span>}
                {p.mode === 'Pano' && <span style={{ position: 'absolute', left: 6, top: 6, fontSize: 10, fontWeight: 800, color: '#fff', background: 'rgba(0,0,0,.5)', padding: '1px 5px', borderRadius: 5 }}>PANO</span>}
              </button>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', color: MUTED, fontSize: 14, padding: '80px 30px' }}>
            <Icon name="image" size={42} color={MUTED} />
            <div style={{ marginTop: 12 }}>{libFilter === 'All' ? 'No photos yet. Go take some.' : `No ${libFilter.toLowerCase()} yet.`}</div>
          </div>
        )}
      </>
    )
  } else if (screen === 'detail') {
    const p = detailPhoto
    if (!p) {
      body = (
        <>
          {header('Photo')}
          <div style={{ textAlign: 'center', color: MUTED, padding: '100px 30px' }}>This photo is gone.</div>
        </>
      )
    } else {
      const idx = photos.findIndex((x) => x.id === p.id)
      const nav = (d) => {
        const n = photos[idx + d]
        if (n) {
          setDir(d)
          setPlaying(false)
          setPlayT(0)
          setStack((s) => [...s.slice(0, -1), { id: 'detail', pid: n.id }])
        }
      }
      body = (
        <>
          {header(p.label, <button type="button" onClick={() => (toggleFav(p.id), say(p.fav ? 'Removed from favourites' : 'Added to favourites'))} aria-label={p.fav ? 'Unfavourite' : 'Favourite'} aria-pressed={!!p.fav} style={{ ...iconBtn, width: 38, height: 38, color: p.fav ? '#ff5d73' : INK }}><Icon name="heart" size={22} fill={p.fav ? '#ff5d73' : 'none'} /></button>)}
          <div
            style={{ position: 'relative', margin: '4px 0 0', height: 470, background: '#000', touchAction: 'pan-y' }}
            onPointerDown={(e) => (swipe.current = { x: e.clientX })}
            onPointerUp={(e) => {
              const s = swipe.current
              swipe.current = null
              if (s && Math.abs(e.clientX - s.x) > 50 * scale) nav(e.clientX < s.x ? 1 : -1)
            }}
          >
            <Scene phase={p.phase + (p.dur ? playT * 1.5 : 0)} filter={p.filter} strength={p.strength} portrait={p.mode === 'Portrait'} front={p.front} zoom={p.zoom} vb={p.mode === 'Pano' ? '0 150 390 220' : '0 0 390 520'} />
            {p.mode === 'Pano' && <span style={{ position: 'absolute', left: 10, top: 10, fontSize: 11, fontWeight: 800, background: 'rgba(0,0,0,.55)', padding: '2px 7px', borderRadius: 6 }}>PANORAMA</span>}
            {p.dur && (
              <>
                <button type="button" onClick={() => setPlaying((v) => !v)} aria-label={playing ? 'Pause' : 'Play'} style={{ ...iconBtn, position: 'absolute', left: '50%', top: '50%', width: 64, height: 64, marginLeft: -32, marginTop: -32, background: 'rgba(0,0,0,.5)', opacity: playing ? 0.35 : 1 }}>
                  <Icon name={playing ? 'pause' : 'play'} size={28} fill={playing ? 'none' : '#fff'} />
                </button>
                <div style={{ position: 'absolute', left: 14, right: 14, bottom: 12, height: 4, borderRadius: 2, background: 'rgba(255,255,255,.3)' }}>
                  <div style={{ width: `${(playT / p.dur) * 100}%`, height: '100%', borderRadius: 2, background: accent }} />
                </div>
              </>
            )}
            {idx > 0 && <button type="button" onClick={() => nav(-1)} aria-label="Newer" style={{ ...iconBtn, position: 'absolute', left: 8, top: '50%', width: 34, height: 34, background: 'rgba(0,0,0,.45)' }}><Icon name="back" size={18} /></button>}
            {idx < photos.length - 1 && <button type="button" onClick={() => nav(1)} aria-label="Older" style={{ ...iconBtn, position: 'absolute', right: 8, top: '50%', width: 34, height: 34, background: 'rgba(0,0,0,.45)' }}><Icon name="chev" size={18} /></button>}
          </div>
          <div className="cam-scroll" style={{ display: 'flex', gap: 8, padding: '10px 14px 4px', overflowX: 'auto' }} role="group" aria-label="Filter">
            {FILTERS.map((f) => (
              <button key={f.id} type="button" onClick={() => setPhotoFilter(p.id, f.id)} aria-pressed={p.filter === f.id} style={{ flex: 'none', height: 30, padding: '0 12px', borderRadius: 15, border: 'none', background: p.filter === f.id ? accent : '#26262d', color: p.filter === f.id ? '#111' : INK, font: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>{f.name}</button>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-around', padding: '8px 14px 0' }}>
            {[['share', 'Share', () => say('Link copied')], ['heart', p.fav ? 'Unfavourite' : 'Favourite', () => (toggleFav(p.id), say(p.fav ? 'Removed from favourites' : 'Added to favourites'))], ['info', `${p.mode}${p.dur ? ' ' + fmtDur(p.dur) : ''} · ${cfg.fmt}`, () => say(`${p.mode} · ${FILTERS.find((f) => f.id === p.filter).name} · ${p.zoom}x`)], ['trash', 'Delete', () => setConfirm(true)]].map(([ic, l, fn]) => (
              <button key={ic} type="button" onClick={fn} style={{ border: 'none', background: 'none', color: ic === 'trash' ? '#ff6b6b' : INK, font: 'inherit', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'grid', justifyItems: 'center', gap: 4, maxWidth: 84 }}>
                <Icon name={ic} size={22} fill={ic === 'heart' && p.fav ? '#ff5d73' : 'none'} color={ic === 'heart' && p.fav ? '#ff5d73' : 'currentColor'} />
                {l}
              </button>
            ))}
          </div>
        </>
      )
      if (confirm) {
        overlay = (
          <div style={{ position: 'absolute', inset: 0, zIndex: 18, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'flex-end' }}>
            <div style={{ width: '100%', background: PANEL, borderRadius: '24px 24px 0 0', padding: '20px 20px 34px', display: 'grid', gap: 10, animation: 'cam-up .25s ease' }}>
              <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 16 }}>Delete this {p.dur ? 'video' : 'photo'}?</div>
              <div style={{ textAlign: 'center', color: MUTED, fontSize: 13, marginBottom: 6 }}>It will be removed from your library.</div>
              <button type="button" onClick={() => del(p.id)} style={{ height: 50, border: 'none', borderRadius: 14, background: '#ff4d4d', color: '#fff', font: 'inherit', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>Delete</button>
              <button type="button" onClick={() => setConfirm(false)} style={{ height: 50, border: 'none', borderRadius: 14, background: '#2a2a31', color: INK, font: 'inherit', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        )
      }
    }
  } else if (screen === 'filters') {
    const cur = FILTERS.find((f) => f.id === filter)
    body = (
      <>
        {header('Filters', <button type="button" onClick={() => (say(`${cur.name} applied`), pop())} style={{ border: 'none', background: accent, color: '#111', height: 34, padding: '0 16px', borderRadius: 17, font: 'inherit', fontSize: 13.5, fontWeight: 800, cursor: 'pointer' }}>Done</button>)}
        <div style={{ position: 'relative', height: 360, margin: '4px 14px 0', borderRadius: 22, overflow: 'hidden', background: '#000' }}>
          <LiveScene phaseRef={phaseRef} filter={filter} strength={strength} portrait={curMode === 'Portrait'} front={front} zoom={zoom} />
          <span style={{ position: 'absolute', left: 12, bottom: 12, padding: '4px 10px', borderRadius: 12, background: 'rgba(0,0,0,.55)', fontSize: 12.5, fontWeight: 700 }}>{cur.name}</span>
        </div>
        <div style={{ padding: '14px 20px 4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600 }}>
            <span>Strength</span>
            <span style={{ color: MUTED }}>{Math.round(strength * 100)}%</span>
          </div>
          <input type="range" min="0" max="100" value={Math.round(strength * 100)} onChange={(e) => setStrength(+e.target.value / 100)} aria-label="Filter strength" disabled={filter === 'none'} style={{ width: '100%', marginTop: 8, accentColor: accent }} />
        </div>
        <div className="cam-scroll" style={{ display: 'flex', gap: 10, padding: '8px 14px', overflowX: 'auto' }} role="group" aria-label="Choose filter">
          {FILTERS.map((f) => (
            <button key={f.id} type="button" onClick={() => setFilter(f.id)} aria-pressed={filter === f.id} style={{ flex: 'none', border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: filter === f.id ? accent : INK, font: 'inherit', fontSize: 11.5, fontWeight: 700, display: 'grid', gap: 6, justifyItems: 'center' }}>
              <span style={{ width: 70, height: 70, borderRadius: 16, overflow: 'hidden', outline: filter === f.id ? `3px solid ${accent}` : '3px solid transparent', outlineOffset: 1, position: 'relative', display: 'block' }}>
                <Scene phase={phaseRef.current ?? 18} filter={f.id} vb="0 80 390 390" portrait={curMode === 'Portrait'} front={front} />
              </span>
              {f.name}
            </button>
          ))}
        </div>
      </>
    )
  } else if (screen === 'settings') {
    const set = (k) => (v) => setCfg((c) => ({ ...c, [k]: v }))
    body = (
      <>
        {header('Camera settings')}
        <div style={{ margin: '6px 16px 0', padding: '2px 16px', background: PANEL, borderRadius: 18 }}>
          {switchRow('Grid', 'Rule-of-thirds guide lines', cfg.grid, set('grid'))}
          {switchRow('Smart HDR', 'Blend exposures in bright scenes', cfg.hdr, set('hdr'))}
          {switchRow('Shutter sound', null, cfg.sound, set('sound'))}
          {switchRow('Location tags', 'Save where you shot', cfg.geo, (v) => (set('geo')(v), say(v ? 'Location on' : 'Location off')))}
        </div>
        <div style={{ margin: '14px 16px 0', padding: '14px 16px', background: PANEL, borderRadius: 18, display: 'grid', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <span style={{ fontSize: 14.5, fontWeight: 600 }}>Flash</span>
            <Segment label="Flash" accent={accent} value={flash} onChange={setFlash} options={[['off', 'Off'], ['auto', 'Auto'], ['on', 'On']]} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <span style={{ fontSize: 14.5, fontWeight: 600 }}>Timer</span>
            <Segment label="Timer" accent={accent} value={timer} onChange={setTimer} options={[[0, 'Off'], [3, '3s'], [10, '10s']]} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <span style={{ fontSize: 14.5, fontWeight: 600 }}>Format</span>
            <Segment label="Format" accent={accent} value={cfg.fmt} onChange={set('fmt')} options={[['HEIF', 'HEIF'], ['JPG', 'JPEG']]} />
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14.5, fontWeight: 600 }}>
              <span>Quality</span>
              <span style={{ color: MUTED }}>{cfg.quality}%</span>
            </div>
            <input type="range" min="40" max="100" value={cfg.quality} onChange={(e) => set('quality')(+e.target.value)} aria-label="Quality" style={{ width: '100%', marginTop: 8, accentColor: accent }} />
          </div>
        </div>
        <div style={{ padding: '14px 16px', display: 'grid', gap: 10 }}>
          <button type="button" onClick={() => push({ id: 'gallery' })} style={{ height: 48, borderRadius: 14, border: 'none', background: '#26262d', color: INK, font: 'inherit', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Storage: {photos.length} items · Open library</button>
          <button type="button" onClick={() => (setPhotos(SEED), setThumbId('p1'), setCfg({ grid: false, hdr: true, sound: true, geo: false, fmt: 'HEIF', quality: 85 }), setFlash('auto'), setTimer(0), setFilter('none'), say('Camera reset'))} style={{ height: 48, borderRadius: 14, border: 'none', background: 'none', color: '#ff6b6b', font: 'inherit', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Reset camera</button>
        </div>
      </>
    )
  } else {
    // viewfinder
    const pano = curMode === 'Pano'
    const vid = curMode === 'Video'
    body = (
      <div style={{ position: 'absolute', inset: 0, background: '#000' }}>
        <div style={{ position: 'absolute', top: 54, left: 0, right: 0, height: 50, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px', zIndex: 5 }}>
          <div style={{ display: 'flex', gap: 4 }}>
            <button type="button" onClick={cycleFlash} aria-label={`Flash ${flash}`} style={{ ...iconBtn, width: 42, height: 42, color: flash === 'off' ? MUTED : accent, position: 'relative' }}>
              <Icon name="bolt" size={22} fill={flash === 'on' ? accent : 'none'} />
              <span style={{ position: 'absolute', bottom: 3, fontSize: 9, fontWeight: 800 }}>{flash === 'auto' ? 'A' : ''}</span>
              {flash === 'off' && <span style={{ position: 'absolute', width: 24, height: 2, background: MUTED, transform: 'rotate(-45deg)' }} />}
            </button>
            <button type="button" onClick={cycleTimer} aria-label={`Timer ${timer ? timer + ' seconds' : 'off'}`} style={{ ...iconBtn, width: 42, height: 42, color: timer ? accent : INK, position: 'relative' }}>
              <Icon name="timer" size={22} />
              {timer > 0 && <span style={{ position: 'absolute', right: 3, bottom: 4, fontSize: 10, fontWeight: 800 }}>{timer}</span>}
            </button>
            <button type="button" onClick={() => setCfg((c) => ({ ...c, grid: !c.grid }))} aria-label="Grid" aria-pressed={cfg.grid} style={{ ...iconBtn, width: 42, height: 42, color: cfg.grid ? accent : INK }}>
              <Icon name="grid" size={21} />
            </button>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <button type="button" onClick={() => push({ id: 'filters' })} aria-label="Filters" style={{ ...iconBtn, width: 42, height: 42, color: filter !== 'none' ? accent : INK }}>
              <Icon name="sliders" size={22} />
            </button>
            <button type="button" onClick={() => push({ id: 'settings' })} aria-label="Settings" style={{ ...iconBtn, width: 42, height: 42 }}>
              <Icon name="gear" size={22} />
            </button>
          </div>
        </div>

        <div onPointerDown={vDown} onPointerUp={vUp} style={{ position: 'absolute', top: 104, left: 0, width: 390, height: 520, overflow: 'hidden', touchAction: 'pan-y', cursor: 'crosshair', background: '#000' }} aria-label="Viewfinder. Tap to focus, swipe to change mode.">
          <div style={{ position: 'absolute', left: 0, right: 0, top: pano ? 150 : 0, height: pano ? 220 : 520, transition: 'top .3s, height .3s', overflow: 'hidden' }}>
            <LiveScene phaseRef={phaseRef} filter={filter} strength={strength} portrait={curMode === 'Portrait'} front={front} zoom={zoom} vb={pano ? '0 150 390 220' : '0 0 390 520'} />
          </div>
          {pano && (
            <div style={{ position: 'absolute', left: 0, right: 0, top: 380, textAlign: 'center', fontSize: 12.5, fontWeight: 600, color: accent }}>
              Move slowly to the right →
            </div>
          )}
          {cfg.grid && (
            <svg viewBox="0 0 390 520" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} aria-hidden="true">
              <path d="M130 0v520M260 0v520M0 173h390M0 347h390" stroke="rgba(255,255,255,.5)" strokeWidth="1" />
            </svg>
          )}
          {curMode === 'Portrait' && <div style={{ position: 'absolute', left: 14, top: 14, padding: '3px 9px', borderRadius: 10, background: 'rgba(0,0,0,.5)', fontSize: 11, fontWeight: 700, color: accent, pointerEvents: 'none' }}>f/1.8 · Depth</div>}
          {recording && (
            <div style={{ position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 7, padding: '4px 12px', borderRadius: 14, background: '#e53935', fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums', pointerEvents: 'none' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff', animation: 'cam-blink 1s steps(2) infinite' }} />
              {fmtDur(rec - 1)}
            </div>
          )}
          {ring && (
            <div key={ring.k} style={{ position: 'absolute', left: ring.x - 36, top: ring.y - 36, width: 72, height: 72, border: `2px solid ${accent}`, borderRadius: 14, pointerEvents: 'none', animation: 'cam-focus 1.4s ease-out forwards' }}>
              <span style={{ position: 'absolute', right: -22, top: 6, color: accent, display: 'flex' }}><Icon name="bolt" size={14} /></span>
            </div>
          )}
          {count > 0 && (
            <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'rgba(0,0,0,.25)', pointerEvents: 'none' }}>
              <span key={count} style={{ fontSize: 120, fontWeight: 800, color: '#fff', animation: 'cam-count 1s ease-out' }}>{count}</span>
            </div>
          )}
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 10, display: 'flex', justifyContent: 'center', gap: 8, pointerEvents: 'none' }}>
            {[1, 2, 3].map((z) => (
              <button key={z} type="button" onPointerDown={(e) => e.stopPropagation()} onClick={() => setZoom(z)} aria-pressed={zoom === z} style={{ pointerEvents: 'auto', width: zoom === z ? 38 : 32, height: zoom === z ? 38 : 32, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,.55)', color: zoom === z ? accent : '#fff', font: 'inherit', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>{z}x</button>
            ))}
          </div>
          {flashKey > 0 && <div key={flashKey} style={{ position: 'absolute', inset: 0, background: '#fff', pointerEvents: 'none', animation: 'cam-flash .45s ease-out forwards' }} />}
        </div>

        {/* mode carousel */}
        <div onPointerDown={cDown} onPointerMove={cMove} onPointerUp={cUp} onPointerCancel={cUp} style={{ position: 'absolute', top: 634, left: 0, right: 0, height: 36, overflow: 'hidden', touchAction: 'none', cursor: 'grab' }} role="tablist" aria-label="Camera mode">
          <div style={{ position: 'absolute', left: '50%', top: 0, display: 'flex', transform: `translateX(${-mode * 82 - 41 + dragDx}px)`, transition: drag.current ? 'none' : 'transform .3s cubic-bezier(.2,.8,.2,1)' }}>
            {MODES.map((m, i) => (
              <button key={m} type="button" role="tab" data-mi={i} aria-selected={mode === i} onClick={() => setModeSafe(i)} style={{ width: 82, height: 36, border: 'none', background: 'none', color: mode === i ? accent : '#d6d6dc', font: 'inherit', fontSize: 13.5, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', cursor: 'inherit' }}>{m}</button>
            ))}
          </div>
        </div>

        {/* bottom controls */}
        <div style={{ position: 'absolute', top: 680, left: 0, right: 0, height: 110, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 28px' }}>
          <button type="button" onClick={() => push({ id: 'gallery' })} aria-label="Open library" style={{ width: 56, height: 56, borderRadius: 14, border: '2px solid #fff', padding: 0, overflow: 'hidden', cursor: 'pointer', background: '#000', position: 'relative', animation: thumbId === thumbPhoto?.id && thumbId?.startsWith('n') ? 'cam-bump .4s ease' : 'none' }}>
            <Thumb p={thumbPhoto} />
          </button>
          <button type="button" onClick={onShutter} aria-label={vid ? (recording ? 'Stop recording' : 'Start recording') : count > 0 ? 'Cancel timer' : 'Take photo'} style={{ width: 82, height: 82, borderRadius: '50%', border: '4px solid #fff', background: 'transparent', padding: 5, cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
            <span style={{ display: 'block', width: '100%', height: '100%', borderRadius: recording ? 12 : '50%', background: vid ? '#e53935' : '#fff', transform: `scale(${press ? 0.84 : recording ? 0.5 : 1})`, transition: 'transform .12s, border-radius .2s' }} />
          </button>
          <button type="button" onClick={() => (setFront((f) => !f), say(front ? 'Rear camera' : 'Front camera'))} aria-label="Flip camera" style={{ ...iconBtn, width: 56, height: 56, background: '#232329' }}>
            <Icon name="flip" size={26} />
          </button>
        </div>

        {fly && (
          <div key={fly.id} style={{ position: 'absolute', left: 0, top: 104, width: 390, height: 520, transformOrigin: '0 0', borderRadius: 8, overflow: 'hidden', pointerEvents: 'none', zIndex: 8, animation: 'cam-fly .62s cubic-bezier(.55,0,.75,.4) forwards' }}>
            <Scene phase={fly.phase} filter={fly.filter} strength={fly.strength} portrait={fly.mode === 'Portrait'} front={fly.front} zoom={fly.zoom} />
          </div>
        )}
      </div>
    )
  }

  const phone = (
    <div style={{ position: 'relative', width: W, height: H, overflow: 'hidden', borderRadius: frame ? 46 : 0, background: BG, color: INK, fontFamily: "-apple-system, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif" }}>
      <style>{`
        @keyframes cam-r { from { opacity: 0; transform: translateX(34px) } to { opacity: 1; transform: none } }
        @keyframes cam-l { from { opacity: 0; transform: translateX(-34px) } to { opacity: 1; transform: none } }
        @keyframes cam-up { from { transform: translateY(60px); opacity: 0 } to { transform: none; opacity: 1 } }
        @keyframes cam-flash { 0% { opacity: .95 } 100% { opacity: 0 } }
        @keyframes cam-blink { 50% { opacity: .2 } }
        @keyframes cam-focus { 0% { transform: scale(1.5); opacity: 0 } 18% { transform: scale(1); opacity: 1 } 80% { opacity: 1 } 100% { transform: scale(.94); opacity: 0 } }
        @keyframes cam-count { from { transform: scale(1.5); opacity: 0 } 25% { opacity: 1 } to { transform: scale(.9); opacity: .6 } }
        @keyframes cam-fly { 0% { transform: translate(0,0) scale(1); opacity: 1 } 70% { opacity: 1 } 100% { transform: translate(24px, 594px) scale(.13); opacity: .3 } }
        @keyframes cam-bump { 0% { transform: scale(1) } 50% { transform: scale(1.18) } 100% { transform: scale(1) } }
        .cam-scroll { scrollbar-width: none } .cam-scroll::-webkit-scrollbar { display: none }
        .cam-app button:focus-visible, .cam-app input:focus-visible { outline: 2px solid ${accent}; outline-offset: 2px }
        @media (prefers-reduced-motion: reduce) {
          .cam-app *, .cam-app *::before { animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important }
        }
      `}</style>
      <StatusBar frame={frame} />
      <div key={screen + (top?.pid ? '' : '')} className="cam-scroll" style={{ position: 'absolute', top: screen === 'viewfinder' ? 0 : 54, bottom: 0, left: 0, right: 0, overflowY: screen === 'viewfinder' ? 'hidden' : 'auto', paddingBottom: screen === 'viewfinder' ? 0 : 30, animation: `${dir > 0 ? 'cam-r' : 'cam-l'} .28s ease` }}>
        {body}
      </div>
      {overlay}
      <div role="status" style={{ position: 'absolute', left: '50%', top: 58, zIndex: 30, transform: `translate(-50%, ${toast ? 0 : -90}px)`, transition: 'transform .35s cubic-bezier(.2,.8,.2,1)', padding: '9px 16px', borderRadius: 20, background: 'rgba(40,40,48,.95)', color: '#fff', fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap' }}>{toast}</div>
      <div style={{ position: 'absolute', left: '50%', bottom: 8, width: 140, height: 5, marginLeft: -70, borderRadius: 3, background: '#fff', opacity: 0.8, zIndex: 25, pointerEvents: 'none' }} />
    </div>
  )

  return (
    <div ref={box} className="cam-app" aria-label={name} style={{ position: 'relative', width: '100%', height: '100%', display: 'grid', placeItems: 'center', overflow: 'hidden', background: 'radial-gradient(ellipse at 50% 30%, #2a2c36, #0d0e12 75%)', ...style }}>
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
