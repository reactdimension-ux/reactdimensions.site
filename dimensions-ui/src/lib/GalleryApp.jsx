import { memo, useEffect, useId, useRef, useState } from 'react'

// A photo gallery on a phone, as a click-through prototype. 105 "photos" are
// generated as inline SVG (mountains, beaches, cities, forests, flowers, night
// skies, food) and the Photos tab zooms between Years, Months and Days
// layouts: pinch with two fingers, ctrl + mouse wheel, the +/- buttons or the
// segmented control; tapping a year or month zooms into it. The full-screen
// viewer swipes between photos (drag), double-taps to zoom (then drags to
// pan), favourites, adds to albums, shows info and deletes. Albums opens
// albums (create, add, remove, delete); Search finds by tag, month or colour.
// The phone scales to fit whatever box it is in.

const W = 390 // the phone screen, in CSS px
const H = 844
const INK = '#241f1b'
const MUTED = '#8a8178'
const BG = '#f6f1ea'
const CARD = '#fffdf9'
const LINE = '#e8e0d4'
const SERIF = "'Fraunces', Georgia, 'Times New Roman', serif"

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const ICONS = {
  photos: 'M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM4 16l5-5 4 4 3-3 4 4M9 9.5h.01',
  albums: 'M4 7h16v12H4zM7 4h10M5.5 5.5h13',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  back: 'M15 5l-7 7 7 7',
  chev: 'M9 5l7 7-7 7',
  heart: 'M12 20s-7-4.4-9-9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c-2 4.6-9 9-9 9z',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  x: 'M6 6l12 12M18 6L6 18',
  info: 'M12 8h.01M11 12h1v5h1M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
  share: 'M12 15V4m0 0L8 8m4-4l4 4M5 13v6h14v-6',
  trash: 'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13M10 11v6M14 11v6',
  addalbum: 'M4 7h16v12H4zM12 10v6M9 13h6',
  check: 'M5 12l5 5 9-10',
  tag: 'M3 12V4h8l10 10-8 8zM7.5 7.5h.01',
  edit: 'M4 20h4l11-11-4-4L4 16zM13.5 6.5l4 4',
}

function Icon({ name, size = 22, color = 'currentColor', w = 1.9, fill = 'none' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  )
}

const iconBtn = { display: 'grid', placeItems: 'center', border: 'none', borderRadius: '50%', cursor: 'pointer', padding: 0, background: 'transparent', color: INK }

// ------------------------------------------------------------ the photos

function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const KINDS = ['mountain', 'beach', 'city', 'forest', 'flower', 'night', 'food']
const BASE_HUE = { mountain: 210, beach: 190, city: 280, forest: 130, flower: 330, night: 250, food: 30 }
const KIND_TAGS = {
  mountain: ['mountain', 'travel', 'nature', 'hike'],
  beach: ['beach', 'summer', 'travel', 'sea'],
  city: ['city', 'street', 'travel', 'architecture'],
  forest: ['forest', 'nature', 'trees'],
  flower: ['flower', 'garden', 'spring', 'nature'],
  night: ['night', 'stars', 'sky'],
  food: ['food', 'dinner', 'family'],
}
const COLOURS = [
  ['red', '#e0443c'],
  ['orange', '#f08a24'],
  ['yellow', '#f2c230'],
  ['green', '#3fa55b'],
  ['teal', '#1fa6a0'],
  ['blue', '#2f6fdd'],
  ['purple', '#8454d6'],
  ['pink', '#e86aa8'],
]
function colourName(h) {
  h = ((h % 360) + 360) % 360
  return h < 15 ? 'red' : h < 45 ? 'orange' : h < 70 ? 'yellow' : h < 165 ? 'green' : h < 200 ? 'teal' : h < 255 ? 'blue' : h < 290 ? 'purple' : h < 340 ? 'pink' : 'red'
}

function makePhotos() {
  const out = []
  let n = 0
  for (let year = 2023; year <= 2025; year++) {
    for (let m = 0; m < 12; m++) {
      if (year === 2025 && m > 10) continue
      const days = [4 + (m % 5), 4 + (m % 5), 17 + (m % 7)]
      for (let k = 0; k < 3; k++) {
        const kind = KINDS[(n * 3 + (n >> 2)) % KINDS.length]
        const hue = (BASE_HUE[kind] + ((n * 47) % 90) - 45 + 360) % 360
        const colour = colourName(hue)
        const tags = [...KIND_TAGS[kind]]
        if ((kind === 'mountain' || kind === 'beach' || kind === 'city') && (hue < 45 || hue > 330)) tags.push('sunset')
        if (n % 5 === 0) tags.push('friends')
        out.push({ id: `ph${n}`, seed: n * 7919 + 13, kind, hue, colour, tags, year, month: m, day: days[k], fav: n % 9 === 4 })
        n++
      }
    }
  }
  return out.reverse()
}
const PHOTOS = makePhotos()
const dateOf = (p) => new Date(p.year, p.month, p.day)
const dayLabel = (p) => `${DAYS[dateOf(p).getDay()]} ${p.day} ${MONTHS[p.month].slice(0, 3)} ${p.year}`
const searchText = (p) => `${p.tags.join(' ')} ${p.colour} ${MONTHS[p.month]} ${p.year}`.toLowerCase()

const ridge = (r, y0, amp, n) => {
  let d = `M0 ${y0}`
  for (let i = 1; i <= n; i++) d += ` L${(120 / n) * i} ${(y0 - r() * amp).toFixed(1)}`
  return `${d} V100 H0Z`
}

const PhotoArt = memo(function PhotoArt({ p }) {
  const uid = useId().replace(/:/g, '')
  const r = rng(p.seed)
  const h = p.hue
  let art
  if (p.kind === 'mountain') {
    const sx = 18 + r() * 84
    art = (
      <>
        <rect width="120" height="100" fill={`url(#${uid})`} />
        <circle cx={sx} cy={22 + r() * 8} r="9" fill="hsl(45 100% 88%)" />
        <path d={ridge(r, 72, 42, 7)} fill={`hsl(${h} 30% 58%)`} />
        <path d={ridge(r, 86, 34, 9)} fill={`hsl(${h} 38% 36%)`} />
        <path d={ridge(r, 100, 16, 12)} fill={`hsl(${h} 40% 20%)`} />
      </>
    )
  } else if (p.kind === 'beach') {
    art = (
      <>
        <rect width="120" height="100" fill={`url(#${uid})`} />
        <circle cx={30 + r() * 60} cy="34" r="11" fill="hsl(45 100% 88%)" />
        <rect y="52" width="120" height="30" fill={`hsl(${h} 60% 50%)`} />
        {[0, 1, 2, 3].map((i) => (
          <path key={i} d={`M${r() * 60} ${58 + i * 6}h${20 + r() * 30}`} stroke="rgba(255,255,255,.6)" strokeWidth="1.5" strokeLinecap="round" />
        ))}
        <path d="M0 80q30-8 60-2t60-4v26H0z" fill="hsl(40 60% 82%)" />
        <path d="M82 92V64" stroke="#5b3a29" strokeWidth="1.5" />
        <path d="M72 66a10 8 0 0 1 20 0z" fill={`hsl(${(h + 150) % 360} 80% 60%)`} />
      </>
    )
  } else if (p.kind === 'city') {
    art = (
      <>
        <rect width="120" height="100" fill={`url(#${uid})`} />
        <circle cx={20 + r() * 80} cy="22" r="7" fill="hsl(50 90% 90%)" />
        {Array.from({ length: 12 }, (_, i) => {
          const bh = 22 + r() * 46
          return (
            <g key={i}>
              <rect x={i * 10} y={100 - bh} width="9.4" height={bh} fill={`hsl(${h} 30% ${14 + (i % 3) * 5}%)`} />
              {Array.from({ length: Math.floor(bh / 9) }, (_, k) => (r() > 0.45 ? <rect key={k} x={i * 10 + 2 + (k % 2) * 3.4} y={100 - bh + 3 + k * 8} width="2" height="3" fill="hsl(48 100% 70%)" /> : null))}
            </g>
          )
        })}
      </>
    )
  } else if (p.kind === 'forest') {
    art = (
      <>
        <rect width="120" height="100" fill={`url(#${uid})`} />
        {[0, 1, 2].map((l) => (
          <g key={l} fill={`hsl(${h} ${35 + l * 6}% ${50 - l * 15}%)`}>
            {Array.from({ length: 9 }, (_, i) => {
              const x = i * 14 + r() * 8 - 6
              const base = 62 + l * 14
              const ht = 26 + r() * 20
              return <path key={i} d={`M${x} ${base}L${x + 7} ${base - ht}L${x + 14} ${base}zM${x + 2} ${base - 8}L${x + 7} ${base - ht - 6}L${x + 12} ${base - 8}z`} />
            })}
            <rect y={72 + l * 14} width="120" height="30" />
          </g>
        ))}
      </>
    )
  } else if (p.kind === 'flower') {
    art = (
      <>
        <rect width="120" height="100" fill={`url(#${uid})`} />
        <path d="M60 100C58 80 64 70 60 48" stroke="hsl(120 40% 32%)" strokeWidth="3" fill="none" />
        <path d="M60 82q-18-4-22-16 16 0 22 16zM60 74q16-2 22-14-14-2-22 14z" fill="hsl(125 40% 38%)" />
        {Array.from({ length: 9 }, (_, i) => (
          <ellipse key={i} cx="60" cy="30" rx="6.5" ry="15" fill={`hsl(${h} 80% ${58 + (i % 2) * 8}%)`} transform={`rotate(${i * 40} 60 46)`} />
        ))}
        <circle cx="60" cy="46" r="7" fill="hsl(44 95% 55%)" />
        {Array.from({ length: 6 }, (_, i) => (
          <circle key={i} cx={r() * 120} cy={r() * 40 + 55} r="1.6" fill="rgba(255,255,255,.7)" />
        ))}
      </>
    )
  } else if (p.kind === 'night') {
    art = (
      <>
        <rect width="120" height="100" fill={`url(#${uid})`} />
        {Array.from({ length: 34 }, (_, i) => (
          <circle key={i} cx={r() * 120} cy={r() * 62} r={0.4 + r() * 0.9} fill="#fff" opacity={0.5 + r() * 0.5} />
        ))}
        <path d={`M-5 40Q30 ${15 + r() * 20} 60 38T125 30`} stroke="hsl(150 80% 60%)" strokeWidth="9" fill="none" opacity=".28" />
        <circle cx={20 + r() * 80} cy="20" r="6" fill="hsl(55 70% 92%)" />
        <path d={ridge(r, 78, 24, 8)} fill="hsl(230 40% 8%)" />
        <path d="M84 100l8-20 8 20z" fill="#e8b25d" />
        <path d="M88 100l4-9 4 9z" fill="#ffe7a8" />
      </>
    )
  } else {
    art = (
      <>
        <rect width="120" height="100" fill={`url(#${uid})`} />
        <circle cx="60" cy="52" r="38" fill="#fdfbf7" />
        <circle cx="60" cy="52" r="30" fill="hsl(40 30% 94%)" />
        {Array.from({ length: 7 }, (_, i) => {
          const a = r() * 6.28
          const d = r() * 18
          return <circle key={i} cx={60 + Math.cos(a) * d} cy={52 + Math.sin(a) * d} r={4 + r() * 5} fill={`hsl(${(h + i * 28 - 20 + 360) % 360} 70% ${48 + r() * 14}%)`} />
        })}
        <path d="M104 18v50M101 18v12M107 18v12" stroke="#c9c4bd" strokeWidth="2" strokeLinecap="round" />
      </>
    )
  }
  const grad = {
    mountain: [`hsl(${h} 75% 78%)`, `hsl(${(h + 30) % 360} 85% 92%)`],
    beach: [`hsl(${h} 80% 72%)`, `hsl(${(h + 20) % 360} 90% 90%)`],
    city: [`hsl(${h} 50% 30%)`, `hsl(${(h + 70) % 360} 80% 65%)`],
    forest: [`hsl(${h} 40% 80%)`, `hsl(${h} 30% 94%)`],
    flower: [`hsl(${h} 70% 92%)`, `hsl(${(h + 30) % 360} 70% 80%)`],
    night: [`hsl(${h} 55% 8%)`, `hsl(${h} 50% 28%)`],
    food: [`hsl(${h} 45% 66%)`, `hsl(${h} 40% 52%)`],
  }[p.kind]
  return (
    <svg viewBox="0 0 120 100" preserveAspectRatio="xMidYMid slice" style={{ width: '100%', height: '100%', display: 'block' }} aria-hidden="true">
      <defs>
        <linearGradient id={uid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={grad[0]} />
          <stop offset="1" stopColor={grad[1]} />
        </linearGradient>
      </defs>
      {art}
    </svg>
  )
})

// ------------------------------------------------------------ pieces

function StatusBar({ frame, color = INK }) {
  const clock = new Date().toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' })
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 40, height: 54, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 30px 0 36px', fontSize: 16, fontWeight: 600, color, pointerEvents: 'none' }}>
      <span>{clock}</span>
      {frame && <span style={{ position: 'absolute', left: '50%', top: 11, width: 122, height: 35, marginLeft: -61, borderRadius: 20, background: '#000' }} />}
      <span style={{ display: 'flex', gap: 6, alignItems: 'center' }} aria-hidden="true">
        <svg width="18" height="11" viewBox="0 0 18 11" fill={color}>
          <rect x="0" y="7" width="3" height="4" rx="1" />
          <rect x="5" y="5" width="3" height="6" rx="1" />
          <rect x="10" y="2.5" width="3" height="8.5" rx="1" />
          <rect x="15" y="0" width="3" height="11" rx="1" />
        </svg>
        <svg width="26" height="12" viewBox="0 0 26 12">
          <rect x="0.5" y="0.5" width="22" height="11" rx="3.5" fill="none" stroke={color} opacity=".45" />
          <rect x="2.5" y="2.5" width="16" height="7" rx="2" fill={color} />
          <rect x="23.5" y="4" width="2" height="4" rx="1" fill={color} opacity=".45" />
        </svg>
      </span>
    </div>
  )
}

function Tile({ p, onOpen, radius = 0, showFav = true, fill, children }) {
  return (
    <button type="button" onClick={() => onOpen(p)} aria-label={`Photo, ${p.kind}, ${dayLabel(p)}`} style={{ position: 'relative', display: 'block', width: '100%', height: fill ? '100%' : undefined, aspectRatio: fill ? 'auto' : '1', padding: 0, border: 'none', borderRadius: radius, overflow: 'hidden', cursor: 'pointer', background: LINE }}>
      <PhotoArt p={p} />
      {showFav && p.fav && (
        <span style={{ position: 'absolute', left: 5, bottom: 5, display: 'flex', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,.5))' }}>
          <Icon name="heart" size={14} fill="#fff" color="#fff" />
        </span>
      )}
      {children}
    </button>
  )
}

function Sheet({ title, onClose, children }) {
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 35, background: 'rgba(20,14,8,.5)', display: 'flex', alignItems: 'flex-end', animation: 'gl-fade .2s ease' }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title} style={{ width: '100%', maxHeight: '78%', overflowY: 'auto', background: CARD, color: INK, borderRadius: '26px 26px 0 0', padding: '14px 20px 34px', animation: 'gl-up .26s ease' }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: LINE, margin: '0 auto 12px' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <h2 style={{ margin: 0, fontFamily: SERIF, fontSize: 21, fontWeight: 600 }}>{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" style={{ ...iconBtn, width: 34, height: 34, background: BG }}>
            <Icon name="x" size={17} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

const ZOOMS = ['Years', 'Months', 'Days']

// ---------------------------------------------------------------- app

export default function GalleryApp({ name = 'Folio', accent = '#e4572e', startScreen = 'photos', frame = true, style }) {
  const box = useRef()
  const toastTimer = useRef()
  const settleTimer = useRef()
  const pointers = useRef(new Map())
  const pinch = useRef(null)
  const pinchedAt = useRef(0)
  const wheelAcc = useRef(0)
  const scroller = useRef()
  const stage = useRef()
  const tap = useRef({ t: 0, x: 0, y: 0 })
  const vdrag = useRef(null)
  const [scale, setScale] = useState(1)
  const [tab, setTab] = useState('photos')
  const [stack, setStack] = useState([])
  const [dir, setDir] = useState(1)
  const [toast, setToast] = useState('')
  const [photos, setPhotos] = useState(PHOTOS)
  const [albums, setAlbums] = useState(() => [
    { id: 'travel', name: 'Travel', ids: PHOTOS.filter((p) => p.tags.includes('travel')).slice(0, 18).map((p) => p.id) },
    { id: 'nature', name: 'Nature walks', ids: PHOTOS.filter((p) => p.tags.includes('nature')).slice(0, 14).map((p) => p.id) },
    { id: 'night', name: 'After dark', ids: PHOTOS.filter((p) => p.kind === 'night' || p.tags.includes('sunset')).slice(0, 12).map((p) => p.id) },
    { id: 'food', name: 'Dinner club', ids: PHOTOS.filter((p) => p.kind === 'food').slice(0, 10).map((p) => p.id) },
  ])
  const [z, setZ] = useState(1) // 0 years, 1 months, 2 days
  const [zdir, setZdir] = useState(1)
  const [focus, setFocus] = useState(null)
  const [favOnly, setFavOnly] = useState(false)
  const [q, setQ] = useState('')
  const [colour, setColour] = useState(null)
  const [sheet, setSheet] = useState(null) // 'info' | 'add' | 'new' | 'pick'
  const [newName, setNewName] = useState('')
  const [editing, setEditing] = useState(false)
  const [picked, setPicked] = useState([])
  const [vx, setVx] = useState(0)
  const [settling, setSettling] = useState(false)
  const [vz, setVz] = useState({ s: 1, x: 0, y: 0 })

  const byId = (id) => photos.find((p) => p.id === id)
  const sorted = photos

  useEffect(() => {
    setSheet(null)
    setEditing(false)
    setVz({ s: 1, x: 0, y: 0 })
    if (startScreen === 'album') {
      setTab('albums')
      setStack([{ id: 'album', album: 'travel' }])
    } else if (startScreen === 'viewer') {
      setTab('photos')
      setStack([{ id: 'viewer', ids: PHOTOS.map((p) => p.id), i: 0 }])
    } else {
      setTab(['photos', 'albums', 'search'].includes(startScreen) ? startScreen : 'photos')
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

  useEffect(
    () => () => {
      clearTimeout(toastTimer.current)
      clearTimeout(settleTimer.current)
    },
    [],
  )

  const say = (t) => {
    setToast(t)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 1800)
  }

  const top = stack[stack.length - 1]
  const push = (s) => (setDir(1), setSheet(null), setEditing(false), setVz({ s: 1, x: 0, y: 0 }), setStack((a) => [...a, s]))
  const pop = () => (setDir(-1), setSheet(null), setEditing(false), setStack((a) => a.slice(0, -1)))
  const go = (t) => {
    const order = ['photos', 'albums', 'search']
    setDir(order.indexOf(t) >= order.indexOf(tab) ? 1 : -1)
    setTab(t)
    setStack([])
    setSheet(null)
  }

  // ---- zoom levels
  const zoomTo = (n, f) => {
    const nz = Math.max(0, Math.min(2, n))
    if (nz === z) return
    setZdir(nz > z ? 1 : -1)
    setZ(nz)
    setFocus(f || null)
  }
  const zoomRef = useRef(null)
  zoomRef.current = { z, zoomTo }

  useEffect(() => {
    if (!focus) return
    const sel = focus.m ? `[data-m="${focus.m}"]` : `[data-y="${focus.y}"]`
    const el = scroller.current?.querySelector(sel)
    el?.scrollIntoView({ block: 'start' })
  }, [focus, z])

  // ctrl + wheel (native listener so it can preventDefault)
  const photosVisible = tab === 'photos' && !top
  useEffect(() => {
    const el = scroller.current
    if (!el || !photosVisible) return undefined
    const onWheel = (e) => {
      if (!e.ctrlKey) return
      e.preventDefault()
      wheelAcc.current += e.deltaY
      if (Math.abs(wheelAcc.current) > 50) {
        const step = wheelAcc.current < 0 ? 1 : -1
        wheelAcc.current = 0
        zoomRef.current.zoomTo(zoomRef.current.z + step)
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [photosVisible])

  // pinch with two pointers
  const gDown = (e) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      pinch.current = Math.hypot(a.x - b.x, a.y - b.y)
    }
  }
  const gMove = (e) => {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()]
      const d = Math.hypot(a.x - b.x, a.y - b.y)
      const ratio = d / pinch.current
      if (ratio > 1.3 || ratio < 0.77) {
        pinchedAt.current = Date.now()
        zoomRef.current.zoomTo(zoomRef.current.z + (ratio > 1 ? 1 : -1))
        pinch.current = d
      }
    }
  }
  const gUp = (e) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinch.current = null
  }

  // ---- photo actions
  const toggleFav = (id) => {
    const p = byId(id)
    setPhotos((a) => a.map((x) => (x.id === id ? { ...x, fav: !x.fav } : x)))
    say(p?.fav ? 'Removed from favourites' : 'Added to favourites')
  }
  const openViewer = (list, p) => {
    if (Date.now() - pinchedAt.current < 400) return
    push({ id: 'viewer', ids: list.map((x) => x.id), i: Math.max(0, list.findIndex((x) => x.id === p.id)) })
  }
  const deletePhoto = (id) => {
    setPhotos((a) => a.filter((x) => x.id !== id))
    setAlbums((a) => a.map((al) => ({ ...al, ids: al.ids.filter((i) => i !== id) })))
    setSheet(null)
    setStack((s) => {
      const t = s[s.length - 1]
      const ids = t.ids.filter((i) => i !== id)
      if (!ids.length) return s.slice(0, -1)
      return [...s.slice(0, -1), { ...t, ids, i: Math.min(t.i, ids.length - 1) }]
    })
    setVz({ s: 1, x: 0, y: 0 })
    say('Moved to bin')
  }
  const addToAlbum = (albumId, id) => {
    setAlbums((a) => a.map((al) => (al.id === albumId ? { ...al, ids: al.ids.includes(id) ? al.ids : [id, ...al.ids] } : al)))
    setSheet(null)
    say(`Added to ${albums.find((a) => a.id === albumId).name}`)
  }
  const albumPhotos = (al) => (al.id === 'fav' ? sorted.filter((p) => p.fav) : al.ids.map(byId).filter(Boolean))
  const allAlbums = [{ id: 'fav', name: 'Favourites', virtual: true }, ...albums]

  // ---- viewer gestures
  const setIndex = (i) => setStack((s) => [...s.slice(0, -1), { ...s[s.length - 1], i }])
  const vDown = (e) => {
    vdrag.current = { x: e.clientX, y: e.clientY, moved: false, ox: vz.x, oy: vz.y }
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  const vMove = (e) => {
    const d = vdrag.current
    if (!d || settling) return
    const dx = (e.clientX - d.x) / scale
    const dy = (e.clientY - d.y) / scale
    if (Math.abs(dx) + Math.abs(dy) > 5) d.moved = true
    if (vz.s > 1) {
      const lim = ((vz.s - 1) * W) / 2
      setVz((v) => ({ ...v, x: Math.max(-lim, Math.min(lim, d.ox + dx)), y: Math.max(-lim * 0.9, Math.min(lim * 0.9, d.oy + dy)) }))
    } else setVx(dx)
  }
  const vUp = (e) => {
    const d = vdrag.current
    vdrag.current = null
    if (!d) return
    if (!d.moved) {
      // tap: double-tap toggles zoom around the tap point
      const now = Date.now()
      const r = stage.current.getBoundingClientRect()
      const px = (e.clientX - r.left) / scale - W / 2
      const py = (e.clientY - r.top) / scale - r.height / scale / 2
      const t = tap.current
      if (now - t.t < 320 && Math.hypot(px - t.x, py - t.y) < 40) {
        tap.current = { t: 0, x: 0, y: 0 }
        setVz((v) => (v.s > 1 ? { s: 1, x: 0, y: 0 } : { s: 2.5, x: -px * 1.5, y: -py * 1.5 }))
      } else tap.current = { t: now, x: px, y: py }
      return
    }
    if (vz.s > 1) return
    const n = top.ids.length
    if (Math.abs(vx) > 60 && ((vx < 0 && top.i < n - 1) || (vx > 0 && top.i > 0))) {
      const step = vx < 0 ? 1 : -1
      setSettling(true)
      setVx(-step * W)
      clearTimeout(settleTimer.current)
      settleTimer.current = setTimeout(() => {
        setSettling(false)
        setVx(0)
        setIndex(top.i + step)
      }, 230)
    } else setVx(0)
  }
  const goTo = (step) => {
    if (settling) return
    const n = top.ids.length
    if (top.i + step < 0 || top.i + step >= n) return
    setVz({ s: 1, x: 0, y: 0 })
    setSettling(true)
    setVx(-step * W)
    clearTimeout(settleTimer.current)
    settleTimer.current = setTimeout(() => {
      setSettling(false)
      setVx(0)
      setIndex(top.i + step)
    }, 230)
  }

  // ---------------- screens
  const largeTitle = (title, sub, right) => (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: '8px 20px 8px' }}>
      <div>
        <h1 style={{ margin: 0, fontFamily: SERIF, fontSize: 34, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.05 }}>{title}</h1>
        {sub && <div style={{ fontSize: 12.5, color: MUTED, marginTop: 3 }}>{sub}</div>}
      </div>
      {right}
    </div>
  )

  const backHeader = (title, right) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px 6px', minHeight: 52 }}>
      <button type="button" onClick={pop} aria-label="Back" style={{ ...iconBtn, width: 38, height: 38, background: CARD, boxShadow: `0 0 0 1px ${LINE}` }}>
        <Icon name="back" size={20} />
      </button>
      <h1 style={{ margin: 0, flex: 1, fontFamily: SERIF, fontSize: 22, fontWeight: 600, marginLeft: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</h1>
      {right}
    </div>
  )

  const chip = (label, on, fn, extra) => (
    <button key={label} type="button" onClick={fn} aria-pressed={on} style={{ flex: 'none', height: 34, padding: '0 14px', borderRadius: 17, border: on ? 'none' : `1px solid ${LINE}`, background: on ? INK : CARD, color: on ? '#fff' : INK, font: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
      {extra}
      {label}
    </button>
  )

  let body
  let overlay = null
  let tabbed = true
  let dark = false

  if (top?.id === 'viewer') {
    tabbed = false
    dark = true
    const cur = byId(top.ids[top.i])
    const prev = top.i > 0 ? byId(top.ids[top.i - 1]) : null
    const next = top.i < top.ids.length - 1 ? byId(top.ids[top.i + 1]) : null
    const slide = (p, off) =>
      p && (
        <div key={p.id} style={{ position: 'absolute', left: 0, top: 0, width: W, height: '100%', display: 'grid', placeItems: 'center', transform: `translateX(${off * W + vx}px)`, transition: settling ? 'transform .22s ease-out' : 'none' }}>
          <div style={{ width: W, aspectRatio: '6 / 5', overflow: 'hidden', transform: off === 0 ? `translate(${vz.x}px, ${vz.y}px) scale(${vz.s})` : 'none', transition: vdrag.current ? 'none' : 'transform .3s cubic-bezier(.2,.8,.2,1)' }}>
            <PhotoArt p={p} />
          </div>
        </div>
      )
    body = cur ? (
      <div style={{ position: 'absolute', inset: 0, background: '#0d0b09', color: '#fff' }}>
        <div ref={stage} onPointerDown={vDown} onPointerMove={vMove} onPointerUp={vUp} onPointerCancel={() => ((vdrag.current = null), setVx(0))} style={{ position: 'absolute', top: 100, bottom: 120, left: 0, right: 0, overflow: 'hidden', touchAction: 'none', cursor: vz.s > 1 ? 'grab' : 'ew-resize' }} aria-label="Photo. Swipe to change, double-tap to zoom.">
          {slide(prev, -1)}
          {slide(cur, 0)}
          {slide(next, 1)}
        </div>
        <div style={{ position: 'absolute', top: 54, left: 0, right: 0, height: 46, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px' }}>
          <button type="button" onClick={pop} aria-label="Close viewer" style={{ ...iconBtn, width: 38, height: 38, background: 'rgba(255,255,255,.14)', color: '#fff' }}>
            <Icon name="back" size={20} />
          </button>
          <div style={{ textAlign: 'center', lineHeight: 1.2 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700 }}>{dayLabel(cur)}</div>
            <div style={{ fontSize: 11, opacity: 0.6 }}>{top.i + 1} of {top.ids.length}{vz.s > 1 ? ' · zoomed' : ''}</div>
          </div>
          <button type="button" onClick={() => goTo(1)} aria-label="Next photo" disabled={!next} style={{ ...iconBtn, width: 38, height: 38, background: 'rgba(255,255,255,.14)', color: '#fff', opacity: next ? 1 : 0.35 }}>
            <Icon name="chev" size={20} />
          </button>
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 120, display: 'flex', justifyContent: 'space-around', alignItems: 'flex-start', padding: '20px 10px 0' }}>
          {[
            ['heart', cur.fav ? 'Favourited' : 'Favourite', () => toggleFav(cur.id), cur.fav],
            ['addalbum', 'Album', () => setSheet('add')],
            ['share', 'Share', () => say('Link copied')],
            ['info', 'Info', () => setSheet('info')],
            ['trash', 'Delete', () => deletePhoto(cur.id)],
          ].map(([ic, l, fn, on]) => (
            <button key={ic} type="button" onClick={fn} aria-label={l} style={{ border: 'none', background: 'none', color: ic === 'trash' ? '#ff8a7a' : '#fff', font: 'inherit', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'grid', justifyItems: 'center', gap: 5, width: 62 }}>
              <Icon name={ic} size={24} fill={on ? '#ff5d73' : 'none'} color={on ? '#ff5d73' : 'currentColor'} />
              {l}
            </button>
          ))}
        </div>
      </div>
    ) : (
      <div style={{ padding: 80, textAlign: 'center' }}>No photo</div>
    )
    if (sheet === 'info' && cur) {
      overlay = (
        <Sheet title="Info" onClose={() => setSheet(null)}>
          <div style={{ display: 'grid', gap: 0 }}>
            {[['Date', dayLabel(cur)], ['Subject', cur.kind[0].toUpperCase() + cur.kind.slice(1)], ['Dominant colour', cur.colour], ['Size', '4032 × 3024 · 3.2 MB']].map(([a, b]) => (
              <div key={a} style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 0', borderBottom: `1px solid ${LINE}`, fontSize: 14 }}>
                <span style={{ color: MUTED }}>{a}</span>
                <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{b}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingTop: 14 }}>
            {cur.tags.map((t) => (
              <button key={t} type="button" onClick={() => (setSheet(null), setQ(t), setColour(null), setStack([]), setTab('search'))} style={{ height: 30, padding: '0 12px', borderRadius: 15, border: `1px solid ${LINE}`, background: BG, font: 'inherit', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', color: INK }}>#{t}</button>
            ))}
          </div>
        </Sheet>
      )
    } else if (sheet === 'add' && cur) {
      overlay = (
        <Sheet title="Add to album" onClose={() => setSheet(null)}>
          <div style={{ display: 'grid', gap: 8 }}>
            {albums.map((al) => (
              <button key={al.id} type="button" onClick={() => addToAlbum(al.id, cur.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 16, border: `1px solid ${LINE}`, background: BG, font: 'inherit', cursor: 'pointer', color: INK, textAlign: 'left' }}>
                <span style={{ width: 44, height: 44, borderRadius: 12, overflow: 'hidden', flex: 'none', background: LINE }}>{al.ids[0] && byId(al.ids[0]) && <PhotoArt p={byId(al.ids[0])} />}</span>
                <span style={{ flex: 1, fontSize: 14.5, fontWeight: 600 }}>{al.name}<span style={{ display: 'block', fontSize: 12, color: MUTED, fontWeight: 500 }}>{al.ids.includes(cur.id) ? 'Already in album' : `${al.ids.length} photos`}</span></span>
                {al.ids.includes(cur.id) && <Icon name="check" size={18} color={accent} />}
              </button>
            ))}
          </div>
        </Sheet>
      )
    }
  } else if (top?.id === 'album') {
    tabbed = false
    const al = allAlbums.find((a) => a.id === top.album)
    const list = al ? albumPhotos(al) : []
    body = al ? (
      <>
        {backHeader(al.name, !al.virtual && list.length > 0 && <button type="button" onClick={() => setEditing((v) => !v)} style={{ height: 34, padding: '0 14px', borderRadius: 17, border: 'none', background: editing ? accent : CARD, boxShadow: editing ? 'none' : `0 0 0 1px ${LINE}`, color: editing ? '#fff' : INK, font: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{editing ? 'Done' : 'Edit'}</button>)}
        <div style={{ padding: '0 20px 10px', fontSize: 12.5, color: MUTED }}>{list.length} {list.length === 1 ? 'photo' : 'photos'}{al.virtual ? ' · updates automatically' : ''}</div>
        {list.length ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3, padding: '0 3px' }}>
            {list.map((p) => (
              <div key={p.id} style={{ position: 'relative' }}>
                <Tile p={p} onOpen={editing ? () => {} : (x) => openViewer(list, x)} />
                {editing && (
                  <button type="button" onClick={() => (setAlbums((a) => a.map((x) => (x.id === al.id ? { ...x, ids: x.ids.filter((i) => i !== p.id) } : x))), say('Removed from album'))} aria-label="Remove from album" style={{ ...iconBtn, position: 'absolute', top: 5, right: 5, width: 26, height: 26, background: '#e0443c', color: '#fff' }}>
                    <Icon name="minus" size={15} w={2.6} />
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', color: MUTED, fontSize: 14, padding: '70px 30px' }}>
            <Icon name="albums" size={40} color={MUTED} />
            <div style={{ marginTop: 10 }}>This album is empty.</div>
          </div>
        )}
        {!al.virtual && (
          <div style={{ padding: '18px 20px', display: 'grid', gap: 10 }}>
            <button type="button" onClick={() => (setPicked([]), setSheet('pick'))} style={{ height: 50, borderRadius: 25, border: 'none', background: accent, color: '#fff', font: 'inherit', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>Add photos</button>
            {editing && <button type="button" onClick={() => (setAlbums((a) => a.filter((x) => x.id !== al.id)), pop(), say('Album deleted'))} style={{ height: 46, borderRadius: 23, border: 'none', background: 'none', color: '#d03a2f', font: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Delete album</button>}
          </div>
        )}
      </>
    ) : (
      <>
        {backHeader('Album')}
        <div style={{ padding: 60, textAlign: 'center', color: MUTED }}>Album not found.</div>
      </>
    )
    if (sheet === 'pick' && al) {
      const cand = sorted.filter((p) => !al.ids.includes(p.id)).slice(0, 30)
      overlay = (
        <Sheet title="Add photos" onClose={() => setSheet(null)}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
            {cand.map((p) => {
              const on = picked.includes(p.id)
              return (
                <button key={p.id} type="button" onClick={() => setPicked((a) => (on ? a.filter((i) => i !== p.id) : [...a, p.id]))} aria-pressed={on} aria-label={`Select ${p.kind} photo`} style={{ position: 'relative', aspectRatio: '1', padding: 0, border: 'none', borderRadius: 10, overflow: 'hidden', cursor: 'pointer', outline: on ? `3px solid ${accent}` : 'none', outlineOffset: -3 }}>
                  <PhotoArt p={p} />
                  {on && <span style={{ position: 'absolute', right: 4, top: 4, width: 20, height: 20, borderRadius: '50%', background: accent, color: '#fff', display: 'grid', placeItems: 'center' }}><Icon name="check" size={13} w={3} /></span>}
                </button>
              )
            })}
          </div>
          <button type="button" disabled={!picked.length} onClick={() => (setAlbums((a) => a.map((x) => (x.id === al.id ? { ...x, ids: [...picked, ...x.ids] } : x))), setSheet(null), say(`Added ${picked.length} photo${picked.length > 1 ? 's' : ''}`))} style={{ marginTop: 14, width: '100%', height: 50, borderRadius: 25, border: 'none', background: picked.length ? accent : '#d9d0c3', color: '#fff', font: 'inherit', fontSize: 15, fontWeight: 700, cursor: picked.length ? 'pointer' : 'default' }}>
            {picked.length ? `Add ${picked.length}` : 'Pick some photos'}
          </button>
        </Sheet>
      )
    }
  } else if (tab === 'photos') {
    const list = favOnly ? sorted.filter((p) => p.fav) : sorted
    const years = [...new Set(list.map((p) => p.year))]
    const monthKey = (p) => `${p.year}-${String(p.month + 1).padStart(2, '0')}`
    const months = [...new Set(list.map(monthKey))]
    const dayKey = (p) => `${monthKey(p)}-${String(p.day).padStart(2, '0')}`
    const dayKeys = [...new Set(list.map(dayKey))]
    const open = (p) => openViewer(list, p)
    let layout
    if (z === 0) {
      layout = (
        <div style={{ display: 'grid', gap: 14, padding: '4px 16px' }}>
          {years.map((y) => {
            const items = list.filter((p) => p.year === y)
            return (
              <button key={y} type="button" data-y={y} onClick={() => zoomTo(1, { y })} aria-label={`Open ${y}, ${items.length} photos`} style={{ scrollMarginTop: 120, border: 'none', padding: 0, background: CARD, borderRadius: 24, overflow: 'hidden', cursor: 'pointer', textAlign: 'left', color: INK, boxShadow: `0 0 0 1px ${LINE}` }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gridTemplateRows: '70px 70px', gap: 2 }}>
                  {items.slice(0, 5).map((p, i) => (
                    <span key={p.id} style={{ gridRow: i === 0 ? 'span 2' : 'auto', display: 'block', overflow: 'hidden', background: LINE }}>
                      <PhotoArt p={p} />
                    </span>
                  ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '12px 16px 14px' }}>
                  <span style={{ fontFamily: SERIF, fontSize: 30, fontWeight: 600, letterSpacing: '-0.02em' }}>{y}</span>
                  <span style={{ fontSize: 13, color: MUTED }}>{items.length} photos</span>
                </div>
              </button>
            )
          })}
        </div>
      )
    } else if (z === 1) {
      layout = (
        <div style={{ display: 'grid', gap: 18, padding: '0 3px' }}>
          {months.map((mk) => {
            const items = list.filter((p) => monthKey(p) === mk)
            const p0 = items[0]
            return (
              <section key={mk} data-y={p0.year} data-m={mk} style={{ scrollMarginTop: 118 }}>
                <button type="button" onClick={() => zoomTo(2, { m: mk })} style={{ display: 'flex', alignItems: 'baseline', gap: 8, width: '100%', padding: '0 14px 8px', border: 'none', background: 'none', font: 'inherit', cursor: 'pointer', color: INK, textAlign: 'left' }}>
                  <span style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 600 }}>{MONTHS[p0.month]}</span>
                  <span style={{ fontSize: 13, color: MUTED }}>{p0.year} · {items.length}</span>
                  <span style={{ marginLeft: 'auto', display: 'flex' }}><Icon name="chev" size={16} color={MUTED} /></span>
                </button>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3 }}>
                  {items.map((p) => (
                    <Tile key={p.id} p={p} onOpen={open} />
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )
    } else {
      layout = (
        <div style={{ display: 'grid', gap: 18, padding: '0 14px' }}>
          {dayKeys.map((dk) => {
            const items = list.filter((p) => dayKey(p) === dk)
            return (
              <section key={dk} data-m={dk.slice(0, 7)} style={{ scrollMarginTop: 118 }}>
                <div style={{ fontSize: 13, fontWeight: 700, padding: '0 2px 8px' }}>{dayLabel(items[0])}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {items.map((p) => (
                    <div key={p.id} style={{ aspectRatio: '1.15', borderRadius: 18, overflow: 'hidden', position: 'relative' }}>
                      <Tile p={p} onOpen={open} fill />
                    </div>
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )
    }
    body = (
      <div onPointerDown={gDown} onPointerMove={gMove} onPointerUp={gUp} onPointerCancel={gUp} style={{ touchAction: 'pan-y', minHeight: '100%' }}>
        <div style={{ position: 'sticky', top: 0, zIndex: 6, background: `${BG}f2`, backdropFilter: 'blur(10px)', paddingBottom: 8 }}>
          {largeTitle('Photos', `${list.length} items · ${ZOOMS[z]} view`, (
            <div style={{ display: 'flex', gap: 6 }}>
              <button type="button" onClick={() => zoomTo(z - 1)} disabled={z === 0} aria-label="Zoom out" style={{ ...iconBtn, width: 38, height: 38, background: CARD, boxShadow: `0 0 0 1px ${LINE}`, opacity: z === 0 ? 0.4 : 1 }}><Icon name="minus" size={18} /></button>
              <button type="button" onClick={() => zoomTo(z + 1)} disabled={z === 2} aria-label="Zoom in" style={{ ...iconBtn, width: 38, height: 38, background: CARD, boxShadow: `0 0 0 1px ${LINE}`, opacity: z === 2 ? 0.4 : 1 }}><Icon name="plus" size={18} /></button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, padding: '8px 20px 0', alignItems: 'center' }}>
            <div role="group" aria-label="Zoom level" style={{ display: 'flex', background: '#ebe3d6', borderRadius: 12, padding: 3, flex: 1 }}>
              {ZOOMS.map((l, i) => (
                <button key={l} type="button" onClick={() => zoomTo(i)} aria-pressed={z === i} style={{ flex: 1, height: 30, border: 'none', borderRadius: 9, background: z === i ? CARD : 'transparent', boxShadow: z === i ? '0 1px 3px rgba(60,40,10,.18)' : 'none', color: INK, font: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{l}</button>
              ))}
            </div>
            <button type="button" onClick={() => setFavOnly((v) => !v)} aria-pressed={favOnly} aria-label="Favourites only" style={{ ...iconBtn, width: 38, height: 38, background: favOnly ? accent : CARD, boxShadow: `0 0 0 1px ${favOnly ? accent : LINE}`, color: favOnly ? '#fff' : INK }}>
              <Icon name="heart" size={18} fill={favOnly ? '#fff' : 'none'} />
            </button>
          </div>
        </div>
        <div key={`${z}${favOnly}`} style={{ animation: `${zdir > 0 ? 'gl-zin' : 'gl-zout'} .3s ease`, paddingTop: 6 }}>
          {list.length ? layout : <div style={{ textAlign: 'center', color: MUTED, padding: '80px 30px', fontSize: 14 }}>No favourites yet. Tap the heart on a photo.</div>}
        </div>
        <div style={{ textAlign: 'center', fontSize: 11.5, color: MUTED, padding: '18px 0 4px' }}>Pinch, ctrl + scroll, or use +/- to zoom</div>
      </div>
    )
  } else if (tab === 'albums') {
    body = (
      <>
        {largeTitle('Albums', `${allAlbums.length} albums`, <button type="button" onClick={() => (setNewName(''), setSheet('new'))} aria-label="New album" style={{ ...iconBtn, width: 40, height: 40, background: accent, color: '#fff' }}><Icon name="plus" size={20} w={2.4} /></button>)}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, padding: '12px 20px' }}>
          {allAlbums.map((al) => {
            const list = albumPhotos(al)
            return (
              <button key={al.id} type="button" onClick={() => push({ id: 'album', album: al.id })} aria-label={`Open album ${al.name}`} style={{ border: 'none', background: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', color: INK, font: 'inherit' }}>
                <span style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: 2, aspectRatio: '1', borderRadius: 20, overflow: 'hidden', background: LINE, boxShadow: `0 0 0 1px ${LINE}` }}>
                  {list.length === 0 && <span style={{ gridColumn: 'span 2', gridRow: 'span 2', display: 'grid', placeItems: 'center', color: MUTED }}><Icon name="albums" size={30} /></span>}
                  {list.length > 0 && list.length < 4 && <span style={{ gridColumn: 'span 2', gridRow: 'span 2', overflow: 'hidden' }}><PhotoArt p={list[0]} /></span>}
                  {list.length >= 4 && list.slice(0, 4).map((p) => <span key={p.id} style={{ overflow: 'hidden' }}><PhotoArt p={p} /></span>)}
                </span>
                <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700, marginTop: 8 }}>
                  {al.virtual && <Icon name="heart" size={13} fill={accent} color={accent} />} {al.name}
                </span>
                <span style={{ display: 'block', fontSize: 12, color: MUTED }}>{list.length} photos</span>
              </button>
            )
          })}
        </div>
      </>
    )
    if (sheet === 'new') {
      const create = () => {
        const nm = newName.trim() || 'Untitled'
        const id = `al${Date.now()}`
        setAlbums((a) => [...a, { id, name: nm, ids: [] }])
        setSheet(null)
        push({ id: 'album', album: id })
        say('Album created')
      }
      overlay = (
        <Sheet title="New album" onClose={() => setSheet(null)}>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && create()} placeholder="Album name" aria-label="Album name" maxLength={30} autoFocus style={{ width: '100%', boxSizing: 'border-box', height: 48, borderRadius: 14, border: `1px solid ${LINE}`, background: BG, padding: '0 14px', font: 'inherit', fontSize: 15, color: INK }} />
          <button type="button" onClick={create} style={{ marginTop: 12, width: '100%', height: 50, borderRadius: 25, border: 'none', background: accent, color: '#fff', font: 'inherit', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>Create album</button>
        </Sheet>
      )
    }
  } else {
    const ql = q.trim().toLowerCase()
    const results = ql || colour ? sorted.filter((p) => (!colour || p.colour === colour) && (!ql || ql.split(/\s+/).every((w) => searchText(p).includes(w)))) : []
    const allTags = [...new Set(KINDS.flatMap((k) => KIND_TAGS[k]).concat('sunset'))].sort()
    body = (
      <>
        {largeTitle('Search', 'By tag, month or colour')}
        <div style={{ padding: '8px 20px 4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 48, padding: '0 14px', borderRadius: 24, background: CARD, boxShadow: `0 0 0 1px ${LINE}` }}>
            <Icon name="search" size={19} color={MUTED} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Try “beach”, “june 2024”, “night”" aria-label="Search photos" style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'none', font: 'inherit', fontSize: 15, color: INK }} />
            {(q || colour) && <button type="button" onClick={() => (setQ(''), setColour(null))} aria-label="Clear search" style={{ ...iconBtn, width: 26, height: 26, background: '#e7dfd2' }}><Icon name="x" size={14} /></button>}
          </div>
        </div>
        <div style={{ padding: '14px 20px 4px', fontSize: 12, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '.07em' }}>Colour</div>
        <div className="gl-scroll" style={{ display: 'flex', gap: 12, padding: '4px 20px 8px', overflowX: 'auto' }} role="group" aria-label="Colour">
          {COLOURS.map(([n, c]) => (
            <button key={n} type="button" onClick={() => setColour(colour === n ? null : n)} aria-pressed={colour === n} aria-label={n} style={{ flex: 'none', border: 'none', background: 'none', padding: 0, cursor: 'pointer', display: 'grid', justifyItems: 'center', gap: 4, font: 'inherit', fontSize: 11, fontWeight: 600, color: INK }}>
              <span style={{ width: 38, height: 38, borderRadius: '50%', background: c, outline: colour === n ? `3px solid ${INK}` : '3px solid transparent', outlineOffset: 2, display: 'grid', placeItems: 'center', color: '#fff' }}>{colour === n && <Icon name="check" size={18} w={3} />}</span>
              {n}
            </button>
          ))}
        </div>
        {results.length || ql || colour ? (
          <>
            <div style={{ padding: '10px 20px 8px', fontSize: 13, color: MUTED }}>{results.length} {results.length === 1 ? 'result' : 'results'}{colour ? ` · ${colour}` : ''}</div>
            {results.length ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3, padding: '0 3px' }}>
                {results.map((p) => (
                  <Tile key={p.id} p={p} onOpen={(x) => openViewer(results, x)} />
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: MUTED, fontSize: 14, padding: '40px 30px' }}>Nothing matches. Try another tag or colour.</div>
            )}
          </>
        ) : (
          <>
            <div style={{ padding: '10px 20px 8px', fontSize: 12, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '.07em' }}>Tags</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '0 20px' }}>
              {allTags.map((t) => chip(t, false, () => setQ(t), <Icon name="tag" size={14} color={accent} />))}
            </div>
            <div style={{ padding: '18px 20px 8px', fontSize: 12, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '.07em' }}>Years</div>
            <div style={{ display: 'flex', gap: 8, padding: '0 20px' }}>{['2023', '2024', '2025'].map((y) => chip(y, false, () => setQ(y)))}</div>
          </>
        )}
      </>
    )
  }

  const NAV = [['photos', 'Photos'], ['albums', 'Albums'], ['search', 'Search']]
  const phone = (
    <div style={{ position: 'relative', width: W, height: H, overflow: 'hidden', borderRadius: frame ? 46 : 0, background: dark ? '#0d0b09' : BG, color: INK, fontFamily: "-apple-system, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif" }}>
      <style>{`
        @keyframes gl-r { from { opacity: 0; transform: translateX(34px) } to { opacity: 1; transform: none } }
        @keyframes gl-l { from { opacity: 0; transform: translateX(-34px) } to { opacity: 1; transform: none } }
        @keyframes gl-fade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes gl-up { from { transform: translateY(50px); opacity: 0 } to { transform: none; opacity: 1 } }
        @keyframes gl-zin { from { opacity: 0; transform: scale(.92) } to { opacity: 1; transform: none } }
        @keyframes gl-zout { from { opacity: 0; transform: scale(1.08) } to { opacity: 1; transform: none } }
        .gl-scroll { scrollbar-width: none } .gl-scroll::-webkit-scrollbar { display: none }
        .gl-app button:focus-visible, .gl-app input:focus-visible { outline: 2px solid ${accent}; outline-offset: 2px }
        @media (prefers-reduced-motion: reduce) {
          .gl-app *, .gl-app *::before { animation-duration: .01ms !important; transition-duration: .01ms !important }
        }
      `}</style>
      <StatusBar frame={frame} color={dark ? '#fff' : INK} />
      <div key={`${tab}/${top?.id || ''}/${top?.album || ''}`} ref={scroller} className="gl-scroll" style={{ position: 'absolute', top: dark ? 0 : 54, bottom: tabbed ? 0 : 0, left: 0, right: 0, overflowY: dark ? 'hidden' : 'auto', paddingBottom: tabbed ? 110 : 30, animation: `${dir > 0 ? 'gl-r' : 'gl-l'} .26s ease` }}>
        {body}
      </div>
      {tabbed && (
        <nav aria-label="Main" style={{ position: 'absolute', left: 50, right: 50, bottom: 22, height: 58, borderRadius: 29, background: 'rgba(36,31,27,.92)', backdropFilter: 'blur(12px)', boxShadow: '0 10px 28px rgba(40,25,5,.3)', display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '0 6px', zIndex: 10 }}>
          {NAV.map(([id, label]) => (
            <button key={id} type="button" onClick={() => go(id)} aria-current={tab === id ? 'page' : undefined} aria-label={label} style={{ border: 'none', cursor: 'pointer', font: 'inherit', height: 44, padding: tab === id ? '0 16px' : '0 12px', borderRadius: 22, background: tab === id ? accent : 'transparent', color: '#fff', display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 700, transition: 'background .2s' }}>
              <Icon name={id} size={21} />
              {tab === id && label}
            </button>
          ))}
        </nav>
      )}
      {overlay}
      <div role="status" style={{ position: 'absolute', left: '50%', top: 58, zIndex: 50, transform: `translate(-50%, ${toast ? 0 : -90}px)`, transition: 'transform .35s cubic-bezier(.2,.8,.2,1)', padding: '10px 16px', borderRadius: 20, background: INK, color: '#fff', fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap', boxShadow: '0 6px 18px rgba(0,0,0,.25)' }}>{toast}</div>
      <div style={{ position: 'absolute', left: '50%', bottom: 8, width: 140, height: 5, marginLeft: -70, borderRadius: 3, background: dark ? '#fff' : INK, opacity: 0.75, zIndex: 45, pointerEvents: 'none' }} />
    </div>
  )

  return (
    <div ref={box} className="gl-app" aria-label={name} style={{ position: 'relative', width: '100%', height: '100%', display: 'grid', placeItems: 'center', overflow: 'hidden', background: 'radial-gradient(ellipse at 50% 30%, #f4ead9, #cdbfa8 78%)', ...style }}>
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: `translate(-50%, -50%) scale(${scale})`, transformOrigin: 'center' }}>
        {frame ? (
          <div style={{ padding: 12, borderRadius: 58, background: 'linear-gradient(145deg, #4a443c, #1a1713 40%, #38322a)', boxShadow: '0 40px 80px rgba(60,40,10,.35), inset 0 0 0 2px #5a5348' }}>
            <div style={{ padding: 2, borderRadius: 48, background: '#000' }}>{phone}</div>
          </div>
        ) : (
          phone
        )}
      </div>
    </div>
  )
}
