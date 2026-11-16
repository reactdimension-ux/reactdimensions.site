import { useEffect, useRef, useState } from 'react'
import { useOnScreen } from '../ui/onscreen.js'

// Glassmorphism desktop: a type designer's working screen on a Monday. The
// wallpaper is a plaster wall in window light, drawn in SVG: four panes of
// sun, fern shadows that sway inside the light (masked so shade only shows
// where the sun falls), a potted plant on a wooden sill and an out-of-focus
// leaf in the foreground for depth. Over it: a menu bar with a live clock, a
// side rail that opens, focuses and hides windows, four draggable glass
// windows (project files, today's agenda, music, focus timer) and a stack of
// dismissable notifications. The whole desk is laid out on a 1000x640 grid
// and scaled to fit, so it fills any container without clipping.

const REF_W = 1000, REF_H = 640, RAIL = 76, PAD = 14, TOP = 42

const WINS = {
  files: { title: 'Halden Sans', sub: 'v0.9 proofs', app: 'Files', w: 540, h: 372, x: 90, y: 52 },
  agenda: { title: 'Today', app: 'Calendar', w: 286, h: 338, x: 700, y: 284 },
  music: { title: 'Listening', app: 'Music', w: 336, h: 132, x: 90, y: 442 },
  focus: { title: 'Focus', app: 'Focus', w: 236, h: 168, x: 444, y: 442 },
}
const IDS = Object.keys(WINS)
const startPos = () => Object.fromEntries(IDS.map((id) => {
  const { w, h, x, y } = WINS[id]
  return [id, { fx: (x - RAIL) / (REF_W - PAD - RAIL - w), fy: (y - TOP) / (REF_H - PAD - TOP - h) }]
}))

const PALETTES = {
  morning: { wall0: '#e6d5bf', wall1: '#a98a6f', light: '#fff7e6', lightOp: 0.95, shade: '#cdb193', sill0: '#bb8c63', sill1: '#86603f', leaf: ['#5f8c57', '#41704a', '#7ba865'], pot: '#c8714a', potD: '#9a5135', far: '#2d4631', vase: '#e9e2d6', glass: '255,252,247', ink: '#2a221c', ink2: 'rgba(42,34,28,.6)', line: 'rgba(70,45,25,.12)', edge: 'rgba(255,255,255,.6)', bg: '#e4d3bf' },
  golden: { wall0: '#eebb8c', wall1: '#9c5a44', light: '#ffe0ad', lightOp: 0.95, shade: '#cf8d68', sill0: '#9d5f3d', sill1: '#6a3c27', leaf: ['#647d3d', '#44602f', '#8d9b4b'], pot: '#b85b38', potD: '#843a22', far: '#29301b', vase: '#f1d9bd', glass: '255,247,237', ink: '#2b1a12', ink2: 'rgba(43,26,18,.6)', line: 'rgba(80,40,20,.13)', edge: 'rgba(255,255,255,.55)', bg: '#d9a27c' },
  dusk: { wall0: '#5d4c6c', wall1: '#272033', light: '#f1a571', lightOp: 0.5, shade: '#4c3d5a', sill0: '#43302f', sill1: '#21171a', leaf: ['#3f5f4b', '#2c4637', '#5a7f5f'], pot: '#8b4b39', potD: '#5b2e24', far: '#110e16', vase: '#8f8197', glass: '38,30,48', ink: '#f7efe9', ink2: 'rgba(247,239,233,.62)', line: 'rgba(255,255,255,.1)', edge: 'rgba(255,255,255,.18)', bg: '#3b3048' },
}

const FILES = [
  { n: 'Halden-Regular.otf', k: 'OTF', c: '#d9643a', m: '09:12', s: '184 KB' },
  { n: 'Halden-Bold.otf', k: 'OTF', c: '#d9643a', m: 'Yesterday', s: '191 KB' },
  { n: 'kerning-notes.md', k: 'MD', c: '#5b7fa8', m: '08:47', s: '6 KB' },
  { n: 'specimen-A3-v4.pdf', k: 'PDF', c: '#b0473f', m: 'Fri', s: '2.4 MB' },
  { n: 'pellwick-feedback.eml', k: 'EML', c: '#7a6aa8', m: 'Thu', s: '38 KB' },
  { n: 'latin-ext-glyphs.csv', k: 'CSV', c: '#4f8a5b', m: '10 Nov', s: '12 KB' },
]

const EVENTS = [
  { s: 570, e: 585, t: 'Studio standup', p: 'Fieldnote · #general' },
  { s: 660, e: 720, t: 'Kerning review with Ilse', p: 'Big table by the window' },
  { s: 750, e: 810, t: 'Lunch with Tomás', p: 'Orrin Street Bakery' },
  { s: 885, e: 930, t: 'Specimen sign-off', p: 'Call · Pellwick Press' },
  { s: 1020, e: 1035, t: 'Collect A3 proofs', p: 'Ashby Print, Dock Road' },
  { s: 1140, e: 1260, t: 'Wheel-throwing class', p: 'Clayhouse, studio 2' },
]

const TRACKS = [
  { t: 'Low Light, Long Table', a: 'The Marrow Lanes', al: 'Greenhouse Tapes', d: 228, art: ['#e9a46a', '#6b8f71'] },
  { t: 'Paper Boats', a: 'Odalys Fenn', al: 'Small Hours, Vol. 2', d: 201, art: ['#9fb7d9', '#ecc9a4'] },
  { t: 'Kiln Weather', a: 'Hollis & the Quiet Room', al: 'Kiln Weather', d: 254, art: ['#c9705a', '#2f3d5c'] },
]

const NOTES = [
  { id: 1, app: 'Messages', from: 'Ilse Marr', msg: 'The “ft” ligature still collides at 9pt. Screenshot is in the proofs folder.', t: '2m' },
  { id: 2, app: 'Mail', from: 'Odile Brandt · Pellwick Press', msg: 'Re: Specimen sign-off. Could we push to 14:45?', t: '18m' },
  { id: 3, app: 'Ashby Print', from: 'Order #4417', msg: 'Your A3 proofs are trimmed and ready to collect.', t: '1h' },
]

const P = {
  files: 'M3 7.5A1.5 1.5 0 0 1 4.5 6h4l2 2h9A1.5 1.5 0 0 1 21 9.5v8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z',
  agenda: 'M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v12a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5zM4 10h16M8 3v4M16 3v4',
  music: 'M9 18V6l11-2v12M9 18a3 3 0 1 1-3-3 3 3 0 0 1 3 3zM20 16a3 3 0 1 1-3-3 3 3 0 0 1 3 3z',
  focus: 'M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 9v4l2.5 2M10 2h4',
  bell: 'M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15zM10 21h4',
  wifi: 'M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.5 16a5 5 0 0 1 7 0M12 19.5h.01',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  x: 'M7 7l10 10M17 7L7 17',
  leaf: 'M5 19C5 10 10 5 20 4c-1 10-6 15-15 15zM5 19l8-8',
  prev: 'M6 5v14M19 5 9 12l10 7z',
  next: 'M18 5v14M5 5l10 7-10 7z',
  play: 'M8 5v14l11-7z',
  pause: 'M7 5h3.5v14H7zM13.5 5H17v14h-3.5z',
  chev: 'M9 6l6 6-6 6',
}
const Icon = ({ d, size = 16, fill, sw = 1.7 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill={fill ? 'currentColor' : 'none'} stroke={fill ? 'none' : 'currentColor'} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
)

const leaf = (s, wd = 0.36) => `M0 0C${s * 0.3} ${-s * wd} ${s * 0.72} ${-s * wd} ${s} 0C${s * 0.72} ${s * wd} ${s * 0.3} ${s * wd} 0 0Z`
// Fern fronds for the shadow layer: leaflets alternate along a straight stem.
const FRONDS = [[520, 40, 62, 600, 10, 120], [930, 10, 104, 520, 9, 104], [1210, 150, 140, 420, 8, 92], [700, 520, 20, 360, 6, 80]].map(([x, y, a, len, n, s]) => {
  const r = (a * Math.PI) / 180
  return { x, y, a, len, leaves: Array.from({ length: n }, (_, i) => {
    const t = (i + 1) / (n + 1)
    return { x: x + Math.cos(r) * len * t, y: y + Math.sin(r) * len * t, a: a + (i % 2 ? 52 : -52), s: s * (1 - t * 0.45) }
  }) }
})
const PLANT = [[-150, 230, 0], [-128, 285, 1], [-104, 250, 2], [-82, 300, 0], [-62, 240, 1], [-40, 270, 2], [-18, 210, 0], [-140, 180, 2], [-60, 190, 2]]

function Wallpaper({ c }) {
  return (
    <svg className="gdk-wall" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="gdk-wallg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={c.wall0} />
          <stop offset="1" stopColor={c.wall1} />
        </linearGradient>
        <radialGradient id="gdk-glow" cx=".42" cy=".38" r=".55">
          <stop offset="0" stopColor={c.light} stopOpacity=".35" />
          <stop offset="1" stopColor={c.light} stopOpacity="0" />
        </radialGradient>
        <linearGradient id="gdk-sill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={c.sill0} />
          <stop offset="1" stopColor={c.sill1} />
        </linearGradient>
        <linearGradient id="gdk-pot" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={c.pot} />
          <stop offset="1" stopColor={c.potD} />
        </linearGradient>
        <filter id="gdk-soft" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="4" /></filter>
        <filter id="gdk-shade" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="7" /></filter>
        <filter id="gdk-cast" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="14" /></filter>
        <filter id="gdk-far" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="26" /></filter>
        <filter id="gdk-grain"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" stitchTiles="stitch" /><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .5 0" /></filter>
        <mask id="gdk-sun">
          <g transform="translate(600 90) skewX(-20)" filter="url(#gdk-soft)" fill="#fff">
            <rect width="300" height="340" rx="6" /><rect x="320" width="300" height="340" rx="6" />
            <rect y="360" width="300" height="340" rx="6" /><rect x="320" y="360" width="300" height="340" rx="6" />
          </g>
        </mask>
      </defs>
      <rect width="1600" height="1000" fill="url(#gdk-wallg)" />
      <rect width="1600" height="1000" fill="url(#gdk-glow)" />
      <g mask="url(#gdk-sun)">
        <rect width="1600" height="1000" fill={c.light} opacity={c.lightOp} />
        <g className="gdk-sway" fill={c.shade} stroke={c.shade} filter="url(#gdk-shade)" opacity=".92">
          {FRONDS.map((f, i) => (
            <g key={i}>
              <line x1={f.x} y1={f.y} x2={f.x + Math.cos((f.a * Math.PI) / 180) * f.len} y2={f.y + Math.sin((f.a * Math.PI) / 180) * f.len} strokeWidth="7" />
              {f.leaves.map((l, k) => <path key={k} d={leaf(l.s, 0.3)} transform={`translate(${l.x} ${l.y}) rotate(${l.a})`} stroke="none" />)}
            </g>
          ))}
        </g>
      </g>
      {/* plant's own shadow on the wall, thrown down and to the right */}
      <g transform="translate(1150 830) scale(1.2)" fill={c.shade} opacity=".7" filter="url(#gdk-cast)">
        {PLANT.map(([a, s], i) => <path key={i} d={leaf(s, 0.24)} transform={`rotate(${a + 8})`} />)}
      </g>
      <rect y="858" width="1600" height="142" fill="url(#gdk-sill)" />
      <rect y="856" width="1600" height="5" fill={c.light} opacity=".45" />
      {/* vase with a dried branch on the left of the sill */}
      <g transform="translate(330 860)">
        <path d="M0-30L-40-260M-22-150l-46-40M-30-200l34-48M-12-90l40-36" stroke={c.potD} strokeWidth="4" fill="none" strokeLinecap="round" />
        <path d="M-26 0c-14-40-10-82 8-110h36c18 28 22 70 8 110z" fill={c.vase} />
        <path d="M14 0c10-40 8-82-4-110h8c18 28 22 70 8 110z" fill="#000" opacity=".12" />
      </g>
      <g transform="translate(1080 800) scale(1.2)">
        {PLANT.map(([a, s, k], i) => (
          <g key={i} transform={`rotate(${a})`}>
            <path d={leaf(s, 0.24)} fill={c.leaf[k]} />
            <path d={`M6 0L${s * 0.92} 0`} stroke="#fff" strokeOpacity=".22" strokeWidth="2" />
          </g>
        ))}
        <path d="M-82 -6h164l-16 74h-132z" fill="url(#gdk-pot)" />
        <rect x="-90" y="-14" width="180" height="22" rx="4" fill={c.pot} />
        <rect x="-90" y="-14" width="180" height="5" rx="2" fill="#fff" opacity=".18" />
      </g>
      {/* out-of-focus leaves close to the lens */}
      <g fill={c.far} filter="url(#gdk-far)" opacity=".85">
        <path d={leaf(520, 0.3)} transform="translate(-120 1080) rotate(-58)" />
        <path d={leaf(380, 0.32)} transform="translate(-60 1060) rotate(-24)" />
      </g>
      <rect width="1600" height="1000" filter="url(#gdk-grain)" opacity=".22" style={{ mixBlendMode: 'multiply' }} />
    </svg>
  )
}

function useClock(active) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    if (!active) return
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [active])
  return now
}

const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
const clamp = (v, a, b) => Math.min(Math.max(v, a), Math.max(a, b))

function Preview({ f }) {
  if (f.k === 'OTF') {
    const bold = f.n.includes('Bold')
    return (
      <div className="gdk-pv">
        <div className="gdk-glyph" style={{ fontWeight: bold ? 750 : 400 }}>Ag</div>
        <b>Halden Sans {bold ? 'Bold' : 'Regular'}</b>
        <p style={{ fontWeight: bold ? 700 : 400 }}>Quiet foxes hum by the jade kiln.</p>
        <dl><dt>Glyphs</dt><dd>{bold ? 398 : 412}</dd><dt>Version</dt><dd>0.9.3</dd><dt>Size</dt><dd>{f.s}</dd></dl>
      </div>
    )
  }
  if (f.k === 'MD') return (
    <div className="gdk-pv gdk-pv-text">
      <b># Kerning pass, Bold</b>
      <p>– T/o and T/a still loose at display sizes</p>
      <p>– “ft” collides at 9pt (Ilse)</p>
      <p>– Tighten r/comma by 10 units</p>
      <p>– Check Ŵ and Ŷ against the caps</p>
    </div>
  )
  if (f.k === 'PDF') return (
    <div className="gdk-pv">
      <div className="gdk-page"><i>Halden</i><span /><span /><span className="s" /><span /><span className="s" /></div>
      <b>A3 specimen, 4th proof</b>
      <p className="gdk-mute">2 pages · {f.s}</p>
    </div>
  )
  if (f.k === 'EML') return (
    <div className="gdk-pv gdk-pv-text">
      <b>Odile Brandt</b>
      <p className="gdk-mute">Pellwick Press · Thu 12 Nov</p>
      <p>“The italic hint in the R is lovely. Can the numerals sit a touch lower for the catalogue?”</p>
    </div>
  )
  return (
    <div className="gdk-pv gdk-pv-text">
      <b>Latin Extended</b>
      <table><tbody>
        {[['Drawn', 286], ['Spaced', 251], ['Kerned', 174], ['To do', 38]].map(([k, v]) => <tr key={k}><td>{k}</td><td>{v}</td></tr>)}
      </tbody></table>
    </div>
  )
}

export default function GlassDesktop({ blur = 18, frost = 0.16, light = 'morning', accent = '#d9643a', style }) {
  const root = useRef(null)
  const visible = useOnScreen(root)
  const now = useClock(visible)
  const c = PALETTES[light] || PALETTES.morning

  const [size, setSize] = useState({ w: REF_W, h: REF_H })
  useEffect(() => {
    const el = root.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect
      if (width > 0 && height > 0) setSize({ w: width, h: height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const s = Math.min(1.25, size.w / REF_W, size.h / REF_H)
  const L = { w: size.w / s, h: size.h / s }

  const [pos, setPos] = useState(startPos)
  const [open, setOpen] = useState({ files: true, agenda: true, music: true, focus: true })
  const [order, setOrder] = useState(['music', 'focus', 'agenda', 'files'])
  const [showNotes, setShowNotes] = useState(true)
  const [notes, setNotes] = useState(NOTES)
  const [sel, setSel] = useState(0)
  const drag = useRef(null)

  const raise = (id) => setOrder((o) => (o[o.length - 1] === id ? o : [...o.filter((k) => k !== id), id]))
  const topId = [...order].reverse().find((id) => open[id])
  const box = (id) => {
    const { w, h } = WINS[id]
    return { w, h, left: RAIL + pos[id].fx * Math.max(0, L.w - PAD - RAIL - w), top: TOP + pos[id].fy * Math.max(0, L.h - PAD - TOP - h) }
  }
  const railClick = (id) => {
    if (!open[id]) { setOpen((o) => ({ ...o, [id]: true })); raise(id) }
    else if (topId === id) setOpen((o) => ({ ...o, [id]: false }))
    else raise(id)
  }

  const onDown = (e, id) => {
    if (e.button !== 0) return
    const b = box(id)
    drag.current = { id, x: e.clientX, y: e.clientY, left: b.left, top: b.top, w: b.w, h: b.h }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onMove = (e) => {
    const d = drag.current
    if (!d) return
    const left = clamp(d.left + (e.clientX - d.x) / s, RAIL, L.w - PAD - d.w)
    const top = clamp(d.top + (e.clientY - d.y) / s, TOP, L.h - PAD - d.h)
    const fw = L.w - PAD - RAIL - d.w, fh = L.h - PAD - TOP - d.h
    setPos((p) => ({ ...p, [d.id]: { fx: fw > 0 ? (left - RAIL) / fw : 0, fy: fh > 0 ? (top - TOP) / fh : 0 } }))
  }
  const onUp = () => { drag.current = null }

  // Focus timer
  const TOTAL = 25 * 60
  const [left, setLeft] = useState(TOTAL - 6 * 60 - 18)
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(2)
  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setLeft((v) => Math.max(0, v - 1)), 1000)
    return () => clearInterval(id)
  }, [running])
  useEffect(() => {
    if (left > 0 || !running) return
    setRunning(false)
    setDone((d) => Math.min(4, d + 1))
    setNotes((n) => [{ id: Date.now(), app: 'Focus', from: 'Session complete', msg: 'Kerning pass logged. Stand up and look at something far away for five minutes.', t: 'now' }, ...n])
    setShowNotes(true)
  }, [left, running])

  // Music
  const [track, setTrack] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [at, setAt] = useState(94)
  useEffect(() => {
    if (!playing || !visible) return
    const id = setInterval(() => setAt((v) => v + 1), 1000)
    return () => clearInterval(id)
  }, [playing, visible])
  useEffect(() => {
    if (at >= TRACKS[track].d) { setTrack((t) => (t + 1) % TRACKS.length); setAt(0) }
  }, [at, track])
  const skip = (dir) => { setTrack((t) => (t + dir + TRACKS.length) % TRACKS.length); setAt(0) }
  const tr = TRACKS[track]

  const nowMin = now.getHours() * 60 + now.getMinutes()
  const nextIdx = EVENTS.findIndex((ev) => ev.e > nowMin)
  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const R = 34, C = 2 * Math.PI * R

  const win = (id, body, cls = '') => {
    if (!open[id]) return null
    const b = box(id), W = WINS[id]
    return (
      <section key={id} className={`gdk-win gdk-glass ${cls}${topId === id ? ' is-top' : ''}`} style={{ left: b.left, top: b.top, width: b.w, height: b.h, zIndex: 2 + order.indexOf(id) }} onPointerDown={() => raise(id)} aria-label={W.title}>
        <header className="gdk-tb" onPointerDown={(e) => onDown(e, id)} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
          <span className="gdk-tb-t"><Icon d={P[id]} size={14} /><b>{W.title}</b>{W.sub && <span className="sub">{W.sub}</span>}</span>
          <button className="gdk-x" aria-label={`Hide ${W.title}`} onPointerDown={(e) => e.stopPropagation()} onClick={() => setOpen((o) => ({ ...o, [id]: false }))}><Icon d={P.x} size={12} sw={2} /></button>
        </header>
        {body}
      </section>
    )
  }

  return (
    <div ref={root} className="gdk-wrap" data-paused={visible ? undefined : ''} style={{ '--blur': `${blur}px`, '--a': Math.min(0.85, 0.2 + frost * 1.1), '--glass': c.glass, '--ink': c.ink, '--ink2': c.ink2, '--line': c.line, '--edge': c.edge, '--accent': accent, background: c.bg, ...style }}>
      <style>{`
        .gdk-wrap { position: relative; width: 100%; height: 100%; overflow: hidden; color: var(--ink); font: 400 12.5px/1.4 system-ui, -apple-system, 'Segoe UI', sans-serif; -webkit-font-smoothing: antialiased; user-select: none; }
        .gdk-wrap * { box-sizing: border-box; }
        :where(.gdk-wrap) button { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; }
        .gdk-wrap button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
        .gdk-wall { position: absolute; inset: 0; width: 100%; height: 100%; }
        .gdk-sway { transform-box: view-box; transform-origin: 40% 0; animation: gdk-sway 9s ease-in-out infinite alternate; }
        @keyframes gdk-sway { from { transform: rotate(-1.2deg) translateX(-6px); } to { transform: rotate(1.4deg) translateX(10px); } }
        .gdk-stage { position: absolute; left: 0; top: 0; transform-origin: 0 0; }
        .gdk-glass { background: rgba(var(--glass), var(--a)); border: 1px solid var(--edge); -webkit-backdrop-filter: blur(var(--blur)) saturate(165%); backdrop-filter: blur(var(--blur)) saturate(165%); box-shadow: inset 0 1px 0 var(--edge), 0 2px 6px rgba(40,22,10,.08), 0 22px 48px -18px rgba(40,22,10,.38); }
        .gdk-bar { position: absolute; left: 0; right: 0; top: 0; height: 30px; display: flex; align-items: center; gap: 18px; padding: 0 14px; border-width: 0 0 1px; z-index: 50; font-size: 12.5px; }
        .gdk-bar b { font-weight: 700; }
        .gdk-bar .menu { color: var(--ink2); display: flex; gap: 16px; }
        .gdk-bar .r { margin-left: auto; display: flex; align-items: center; gap: 14px; font-variant-numeric: tabular-nums; font-weight: 600; }
        .gdk-bar .pill { display: inline-flex; align-items: center; gap: 6px; padding: 2px 9px; border-radius: 999px; background: var(--accent); color: #fff; font-size: 11.5px; }
        .gdk-batt { display: inline-flex; align-items: center; gap: 5px; }
        .gdk-batt i { width: 22px; height: 11px; border: 1.5px solid currentColor; border-radius: 3px; position: relative; opacity: .85; }
        .gdk-batt i::after { content: ''; position: absolute; inset: 1.5px; right: 5px; background: currentColor; border-radius: 1px; }
        .gdk-rail { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); width: 50px; padding: 7px; border-radius: 18px; display: flex; flex-direction: column; gap: 6px; z-index: 40; }
        .gdk-rail button { position: relative; width: 36px; height: 36px; border-radius: 11px; display: grid; place-items: center; color: var(--ink); opacity: .7; transition: background 150ms, opacity 150ms; }
        .gdk-rail button:hover { background: rgba(var(--glass), .5); opacity: 1; }
        .gdk-rail button.on { opacity: 1; }
        .gdk-rail button.on::before { content: ''; position: absolute; left: -6px; top: 50%; width: 3px; height: 14px; margin-top: -7px; border-radius: 2px; background: var(--ink); opacity: .45; }
        .gdk-rail button.top { background: var(--accent); color: #fff; }
        .gdk-rail button.top::before { opacity: .9; background: var(--accent); }
        .gdk-rail hr { width: 22px; border: 0; border-top: 1px solid var(--line); margin: 2px auto; }
        .gdk-badge { position: absolute; top: 3px; right: 3px; min-width: 15px; height: 15px; padding: 0 4px; border-radius: 8px; background: var(--accent); color: #fff; font-size: 9.5px; font-weight: 800; line-height: 15px; }
        .gdk-win { position: absolute; border-radius: 16px; display: flex; flex-direction: column; overflow: hidden; }
        .gdk-win.is-top { box-shadow: inset 0 1px 0 var(--edge), 0 2px 8px rgba(40,22,10,.1), 0 34px 70px -20px rgba(40,22,10,.55); }
        .gdk-tb { flex: none; height: 34px; display: flex; align-items: center; justify-content: space-between; padding: 0 8px 0 13px; cursor: grab; touch-action: none; border-bottom: 1px solid var(--line); }
        .gdk-tb:active { cursor: grabbing; }
        .gdk-tb-t { display: flex; align-items: center; gap: 7px; min-width: 0; white-space: nowrap; }
        .gdk-tb-t b { font-weight: 650; }
        .gdk-tb-t .sub { color: var(--ink2); }
        .gdk-tb-t .sub::before { content: '/'; margin-right: 6px; opacity: .6; }
        .gdk-win:not(.is-top) .gdk-tb-t { opacity: .65; }
        .gdk-x { width: 22px; height: 22px; border-radius: 7px; display: grid; place-items: center; color: var(--ink2); }
        .gdk-x:hover { background: rgba(var(--glass), .6); color: var(--ink); }
        .gdk-mute { color: var(--ink2); }
        .gdk-tools { flex: none; height: 38px; display: flex; align-items: center; gap: 6px; padding: 0 12px; border-bottom: 1px solid var(--line); color: var(--ink2); font-size: 12px; }
        .gdk-tools b { color: var(--ink); font-weight: 600; }
        .gdk-search { margin-left: auto; display: flex; align-items: center; gap: 6px; width: 140px; height: 24px; padding: 0 8px; border-radius: 8px; background: rgba(var(--glass), .45); border: 1px solid var(--line); }
        .gdk-fbody { flex: 1; min-height: 0; display: grid; grid-template-columns: 1fr 196px; }
        .gdk-list { padding: 6px; border-right: 1px solid var(--line); overflow: hidden; }
        .gdk-lh { display: grid; grid-template-columns: 1fr 70px; padding: 4px 8px 6px; font-size: 10.5px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--ink2); }
        .gdk-row { width: 100%; display: grid; grid-template-columns: 34px 1fr 70px; align-items: center; height: 36px; padding: 0 8px; border-radius: 9px; text-align: left; }
        .gdk-row:hover { background: rgba(var(--glass), .35); }
        .gdk-row.sel { background: color-mix(in srgb, var(--accent) 20%, transparent); }
        .gdk-row span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500; }
        .gdk-row small { color: var(--ink2); font-size: 11.5px; text-align: right; }
        .gdk-kind { width: 26px; height: 20px; border-radius: 5px; display: grid; place-items: center; color: #fff; font-size: 8.5px; font-weight: 800; letter-spacing: .04em; }
        .gdk-foot { flex: none; height: 28px; display: flex; align-items: center; justify-content: space-between; padding: 0 14px; border-top: 1px solid var(--line); color: var(--ink2); font-size: 11.5px; }
        .gdk-foot i { display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: #4fa36a; margin-right: 6px; }
        .gdk-pv { padding: 14px 14px 12px; display: flex; flex-direction: column; gap: 4px; min-width: 0; }
        .gdk-pv b { font-weight: 650; }
        .gdk-pv p { margin: 0; font-size: 12px; }
        .gdk-glyph { height: 104px; display: grid; place-items: center; font-size: 84px; line-height: 1; letter-spacing: -0.03em; border-radius: 12px; background: rgba(var(--glass), .45); border: 1px solid var(--line); margin-bottom: 8px; }
        .gdk-pv dl { margin: 6px 0 0; display: grid; grid-template-columns: auto 1fr; gap: 3px 10px; font-size: 11.5px; }
        .gdk-pv dt { color: var(--ink2); }
        .gdk-pv dd { margin: 0; text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; }
        .gdk-pv-text { gap: 8px; }
        .gdk-pv-text p { line-height: 1.45; }
        .gdk-pv table { width: 100%; border-collapse: collapse; font-size: 12px; }
        .gdk-pv td { padding: 5px 0; border-bottom: 1px solid var(--line); }
        .gdk-pv td + td { text-align: right; font-weight: 650; font-variant-numeric: tabular-nums; }
        .gdk-page { height: 140px; width: 100px; margin: 0 auto 10px; background: #fbf8f2; color: #2a221c; border-radius: 3px; padding: 12px 10px; display: flex; flex-direction: column; gap: 6px; box-shadow: 0 8px 18px -6px rgba(0,0,0,.35); }
        .gdk-page i { font: 700 22px/1 system-ui, sans-serif; font-style: normal; letter-spacing: -0.02em; }
        .gdk-page span { height: 4px; border-radius: 2px; background: #2a221c; opacity: .25; }
        .gdk-page span.s { width: 60%; }
        .gdk-ag { flex: 1; min-height: 0; padding: 10px 12px 12px; display: flex; flex-direction: column; }
        .gdk-ag-h { display: flex; align-items: baseline; justify-content: space-between; padding: 0 4px 8px; }
        .gdk-ag-h b { font-size: 17px; font-weight: 700; letter-spacing: -0.01em; }
        .gdk-ev { display: grid; grid-template-columns: 46px 1fr; align-items: center; gap: 8px; height: 40px; padding: 0 6px 0 4px; border-radius: 10px; position: relative; }
        .gdk-ev time { font-variant-numeric: tabular-nums; color: var(--ink2); font-size: 12px; font-weight: 600; }
        .gdk-ev div { min-width: 0; display: flex; flex-direction: column; border-left: 3px solid var(--line); padding-left: 9px; }
        .gdk-ev div b, .gdk-ev div small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .gdk-ev div b { font-weight: 600; font-size: 12.5px; }
        .gdk-ev div small { color: var(--ink2); font-size: 11px; }
        .gdk-ev.past { opacity: .45; }
        .gdk-ev.next { background: color-mix(in srgb, var(--accent) 16%, transparent); }
        .gdk-ev.next div { border-left-color: var(--accent); }
        .gdk-ev .chip { position: absolute; right: 8px; top: 7px; padding: 1px 7px; border-radius: 999px; background: var(--accent); color: #fff; font-size: 10px; font-weight: 700; }
        .gdk-mu { flex: 1; padding: 12px 14px; display: flex; flex-direction: column; gap: 10px; }
        .gdk-mu-r { display: flex; align-items: center; gap: 12px; min-width: 0; }
        .gdk-art { flex: none; width: 46px; height: 46px; border-radius: 10px; position: relative; overflow: hidden; box-shadow: 0 6px 14px -6px rgba(0,0,0,.4); }
        .gdk-art::after { content: ''; position: absolute; width: 26px; height: 26px; right: -6px; bottom: -6px; border-radius: 50%; background: rgba(255,255,255,.35); }
        .gdk-mu-t { flex: 1; min-width: 0; display: flex; flex-direction: column; }
        .gdk-mu-t b, .gdk-mu-t small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .gdk-mu-t b { font-weight: 650; }
        .gdk-mu-t small { color: var(--ink2); font-size: 11.5px; }
        .gdk-ctl { display: flex; align-items: center; gap: 2px; }
        .gdk-ctl button { width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; }
        .gdk-ctl button:hover { background: rgba(var(--glass), .55); }
        .gdk-ctl button.pp { background: var(--ink); color: rgb(var(--glass)); }
        .gdk-prog { display: grid; grid-template-columns: 34px 1fr 34px; align-items: center; gap: 8px; font-size: 10.5px; color: var(--ink2); font-variant-numeric: tabular-nums; }
        .gdk-prog span:last-child { text-align: right; }
        .gdk-track { height: 4px; border-radius: 2px; background: var(--line); overflow: hidden; }
        .gdk-track i { display: block; height: 100%; background: var(--ink); border-radius: 2px; transition: width 900ms linear; }
        .gdk-eq { display: inline-flex; align-items: flex-end; gap: 2px; height: 10px; margin-left: 6px; }
        .gdk-eq i { width: 2.5px; height: 100%; background: var(--accent); border-radius: 1px; transform-origin: bottom; animation: gdk-eq 900ms ease-in-out infinite alternate; }
        .gdk-eq i:nth-child(2) { animation-delay: -300ms; } .gdk-eq i:nth-child(3) { animation-delay: -600ms; }
        .gdk-eq.off i { animation: none; transform: scaleY(.3); }
        @keyframes gdk-eq { from { transform: scaleY(.25); } to { transform: scaleY(1); } }
        .gdk-fo { flex: 1; padding: 12px 14px; display: flex; align-items: center; gap: 12px; }
        .gdk-ring { position: relative; flex: none; width: 80px; height: 80px; display: grid; place-items: center; }
        .gdk-ring svg { position: absolute; inset: 0; }
        .gdk-ring b { font-size: 19px; font-weight: 600; font-variant-numeric: tabular-nums; letter-spacing: -0.02em; }
        .gdk-fo-r { min-width: 0; display: flex; flex-direction: column; gap: 6px; }
        .gdk-fo-r small { color: var(--ink2); font-size: 11px; }
        .gdk-dots { display: flex; gap: 4px; }
        .gdk-dots i { width: 8px; height: 8px; border-radius: 50%; border: 1.5px solid var(--accent); }
        .gdk-dots i.on { background: var(--accent); }
        .gdk-btns { display: flex; gap: 6px; }
        .gdk-btn { padding: 4px 11px; border-radius: 999px; font-weight: 650; font-size: 11.5px; border: 1px solid var(--line) !important; }
        .gdk-btn.main { background: var(--accent) !important; color: #fff !important; border-color: transparent !important; }
        .gdk-btn:hover { filter: brightness(1.06); background: rgba(var(--glass), .5); }
        .gdk-nc { position: absolute; width: 286px; display: flex; flex-direction: column; gap: 8px; z-index: 30; }
        .gdk-nc-h { display: flex; justify-content: space-between; align-items: center; padding: 0 4px; font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--ink2); }
        .gdk-nc-h button { text-transform: none; letter-spacing: 0; font-weight: 600; padding: 1px 8px; border-radius: 999px; }
        .gdk-nc-h button:hover { background: rgba(var(--glass), .5); color: var(--ink); }
        .gdk-note { position: relative; border-radius: 14px; padding: 9px 32px 9px 12px; animation: gdk-in 320ms cubic-bezier(.2,.8,.2,1) both; }
        .gdk-note header { display: flex; gap: 6px; align-items: baseline; font-size: 11px; color: var(--ink2); }
        .gdk-note header b { color: var(--ink); font-weight: 700; }
        .gdk-note header span { margin-left: auto; }
        .gdk-note p { margin: 2px 0 0; font-size: 12px; line-height: 1.38; }
        .gdk-note p .from { font-weight: 650; display: block; }
        .gdk-note .gdk-x { position: absolute; right: 7px; top: 7px; width: 20px; height: 20px; opacity: 0; transition: opacity 150ms; }
        .gdk-note:hover .gdk-x, .gdk-note .gdk-x:focus-visible { opacity: 1; }
        @media (hover: none) { .gdk-note .gdk-x { opacity: 1; } }
        @keyframes gdk-in { from { opacity: 0; transform: translateX(16px); } }
        .gdk-wrap[data-paused] .gdk-sway, .gdk-wrap[data-paused] .gdk-eq i { animation-play-state: paused; }
        @media (prefers-reduced-motion: reduce) {
          .gdk-sway, .gdk-eq i, .gdk-note { animation: none !important; }
          .gdk-track i { transition: none; }
        }
      `}</style>

      <Wallpaper c={c} />

      <div className="gdk-stage" style={{ width: L.w, height: L.h, transform: `scale(${s})` }}>
        <header className="gdk-bar gdk-glass">
          <Icon d={P.leaf} size={15} sw={1.9} />
          <b>{WINS[topId]?.app || 'Desk'}</b>
          <span className="menu"><span>File</span><span>Edit</span><span>View</span><span>Window</span></span>
          <span className="r">
            {running && <span className="pill"><Icon d={P.focus} size={12} sw={2.2} />{mmss(left)}</span>}
            <Icon d={P.wifi} size={15} />
            <span className="gdk-batt"><i />86%</span>
            <span>{now.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })}</span>
            <span>{time}</span>
          </span>
        </header>

        <nav className="gdk-rail gdk-glass" aria-label="Apps">
          {IDS.map((id) => (
            <button key={id} className={`${open[id] ? 'on' : ''}${topId === id ? ' top' : ''}`} aria-label={WINS[id].app} aria-pressed={open[id]} title={WINS[id].app} onClick={() => railClick(id)}>
              <Icon d={P[id]} size={19} />
            </button>
          ))}
          <hr />
          <button className={showNotes ? 'on' : ''} aria-label="Notifications" aria-pressed={showNotes} title="Notifications" onClick={() => setShowNotes(!showNotes)}>
            <Icon d={P.bell} size={19} />
            {notes.length > 0 && <span className="gdk-badge">{notes.length}</span>}
          </button>
        </nav>

        {win('files', <>
          <div className="gdk-tools">
            <span>Fieldnote</span><Icon d={P.chev} size={12} /><span>Halden Sans</span><Icon d={P.chev} size={12} /><b>v0.9 proofs</b>
            <span className="gdk-search"><Icon d={P.search} size={13} />Search</span>
          </div>
          <div className="gdk-fbody">
            <div className="gdk-list">
              <div className="gdk-lh"><span style={{ paddingLeft: 34 }}>Name</span><span style={{ textAlign: 'right' }}>Modified</span></div>
              {FILES.map((f, i) => (
                <button key={f.n} className={`gdk-row${sel === i ? ' sel' : ''}`} onClick={() => setSel(i)} aria-pressed={sel === i}>
                  <i className="gdk-kind" style={{ background: f.c }}>{f.k}</i>
                  <span>{f.n}</span>
                  <small>{f.m}</small>
                </button>
              ))}
            </div>
            <Preview f={FILES[sel]} />
          </div>
          <div className="gdk-foot"><span>6 items · 2.8 MB</span><span><i />Synced 4 min ago</span></div>
        </>)}

        {win('agenda', (
          <div className="gdk-ag">
            <div className="gdk-ag-h">
              <b>{now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}</b>
            </div>
            {EVENTS.map((ev, i) => {
              const past = ev.e <= nowMin, cur = i === nextIdx
              const inMin = ev.s - nowMin
              return (
                <div key={ev.t} className={`gdk-ev${past ? ' past' : ''}${cur ? ' next' : ''}`}>
                  <time>{hhmm(ev.s)}</time>
                  <div><b>{ev.t}</b><small>{ev.p}</small></div>
                  {cur && <span className="chip">{inMin <= 0 ? 'Now' : inMin < 60 ? `in ${inMin} min` : `in ${Math.floor(inMin / 60)}h ${inMin % 60}m`}</span>}
                </div>
              )
            })}
          </div>
        ))}

        {win('music', (
          <div className="gdk-mu">
            <div className="gdk-mu-r">
              <div className="gdk-art" style={{ background: `linear-gradient(135deg, ${tr.art[0]}, ${tr.art[1]})` }} />
              <div className="gdk-mu-t">
                <b>{tr.t}<span className={`gdk-eq${playing ? '' : ' off'}`} aria-hidden="true"><i /><i /><i /></span></b>
                <small>{tr.a} · {tr.al}</small>
              </div>
              <div className="gdk-ctl">
                <button aria-label="Previous track" onClick={() => skip(-1)}><Icon d={P.prev} size={14} fill /></button>
                <button className="pp" aria-label={playing ? 'Pause' : 'Play'} onClick={() => setPlaying(!playing)}><Icon d={playing ? P.pause : P.play} size={14} fill /></button>
                <button aria-label="Next track" onClick={() => skip(1)}><Icon d={P.next} size={14} fill /></button>
              </div>
            </div>
            <div className="gdk-prog"><span>{mmss(at)}</span><div className="gdk-track"><i style={{ width: `${(at / tr.d) * 100}%` }} /></div><span>{mmss(tr.d)}</span></div>
          </div>
        ))}

        {win('focus', (
          <div className="gdk-fo">
            <div className="gdk-ring">
              <svg viewBox="0 0 84 84" aria-hidden="true">
                <circle cx="42" cy="42" r={R} fill="none" stroke="var(--line)" strokeWidth="6" />
                <circle cx="42" cy="42" r={R} fill="none" stroke="var(--accent)" strokeWidth="6" strokeLinecap="round" strokeDasharray={`${((TOTAL - left) / TOTAL) * C} ${C}`} transform="rotate(-90 42 42)" style={{ transition: 'stroke-dasharray 900ms linear' }} />
              </svg>
              <b>{mmss(left)}</b>
            </div>
            <div className="gdk-fo-r">
              <b>Kerning pass, Bold</b>
              <div className="gdk-dots" title={`${done} of 4 sessions`}>{[0, 1, 2, 3].map((k) => <i key={k} className={k < done ? 'on' : ''} />)}</div>
              <small>{left === 0 ? 'Session done' : `${done} of 4 today`}</small>
              <div className="gdk-btns">
                <button className="gdk-btn main" onClick={() => (left === 0 ? (setLeft(TOTAL), setRunning(true)) : setRunning(!running))}>{running ? 'Pause' : left === 0 ? 'Again' : 'Start'}</button>
                <button className="gdk-btn" onClick={() => { setRunning(false); setLeft(TOTAL) }}>Reset</button>
              </div>
            </div>
          </div>
        ))}

        {showNotes && (
          <aside className="gdk-nc" style={{ left: L.w - PAD - 286, top: 46 }} aria-label="Notifications">
            <div className="gdk-nc-h"><span>Notifications</span>{notes.length > 0 && <button onClick={() => setNotes([])}>Clear all</button>}</div>
            {notes.length === 0 && <div className="gdk-note gdk-glass"><p className="gdk-mute">All caught up. Nothing new since 08:40.</p></div>}
            {notes.slice(0, L.h >= 740 ? 3 : 2).map((n) => (
              <div key={n.id} className="gdk-note gdk-glass">
                <header><b>{n.app}</b><span>{n.t}</span></header>
                <p><span className="from">{n.from}</span>{n.msg}</p>
                <button className="gdk-x" aria-label={`Dismiss ${n.app} notification`} onClick={() => setNotes((all) => all.filter((k) => k.id !== n.id))}><Icon d={P.x} size={12} sw={2} /></button>
              </div>
            ))}
          </aside>
        )}
      </div>
    </div>
  )
}
