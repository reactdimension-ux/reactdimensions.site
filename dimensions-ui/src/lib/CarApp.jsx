import { useEffect, useId, useRef, useState } from 'react'

// A connected-car app on a phone, as a click-through prototype. Five tabs:
// Car (a top-down SVG car whose doors, trunk and windows open and close for
// real, a range ring, battery and optional fuel, and a plug-in button that
// charges up to your limit), Climate (a temperature dial you drag round, seat
// heat, fan speed, defrost, and a pre-condition countdown that fires), Lock
// (lock, unlock, honk, flash and remote start, each with visible feedback on
// the car; you cannot lock with a door open), Trips (stats, a week chart, and
// a list with mini route maps that open a full route and speed profile) and
// Settings (units, charge limit, hybrid, paint, key sharing, auto-lock).
// The phone scales to fit whatever box it is in.

const W = 390
const H = 844
const C = { bg: '#070b14', card: 'rgba(255,255,255,.06)', cardS: 'rgba(255,255,255,.1)', line: 'rgba(255,255,255,.1)', ink: '#eaf1fb', mute: '#8a98b3' }
const PAINTS = [
  ['Pearl', '#e8ecf3'],
  ['Midnight', '#2a3347'],
  ['Crimson', '#c8283d'],
  ['Teal', '#1e8f94'],
]
const pad = (n) => String(n).padStart(2, '0')
const KM = 0.621371

const ICONS = {
  car: 'M5 16l1.500-5.500A2 2 0 0 1 8.400 9h7.200a2 2 0 0 1 1.900 1.500L19 16M4 16h16v3h-2.500v-1.500h-11V19H4zM7.500 13h.01M16.500 13h.01',
  climate: 'M12 3v18M5 7l14 10M5 17L19 7M9 4l3 2 3-2M9 20l3-2 3 2',
  lock: 'M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3',
  unlock: 'M6 11h12v9H6zM8 11V8a4 4 0 0 1 7.500-2',
  trips: 'M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM8 17h6a3 3 0 0 0 0-6h-4a3 3 0 0 1 0-6h6',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12l2-1.500-2-3.500-2.300.7a7 7 0 0 0-1.700-1L14.500 4h-4l-.5 2.700a7 7 0 0 0-1.700 1L6 7l-2 3.500L6 12a7 7 0 0 0 0 2l-2 1.500L6 19l2.300-.7a7 7 0 0 0 1.700 1l.5 2.700h4l.5-2.700a7 7 0 0 0 1.700-1l2.300.7 2-3.500-2-1.500c.1-.7.1-1.300 0-2z',
  back: 'M15 5l-7 7 7 7',
  chev: 'M9 5l7 7-7 7',
  bolt: 'M13 3L5 13h6l-1 8 8-10h-6z',
  plug: 'M9 3v5m6-5v5M7 8h10v3a5 5 0 0 1-10 0zM12 16v5',
  horn: 'M4 10v4h3l6 4V6L7 10zM16 9a4 4 0 0 1 0 6M18.500 6.500a8 8 0 0 1 0 11',
  light: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-3.500 10.900c.6.5 1 1.200 1 2.100h5c0-.9.4-1.600 1-2.100A6 6 0 0 0 12 3z',
  key: 'M8 15a4 4 0 1 1 3.500-6H21v3h-2v2h-3v-2h-4.500A4 4 0 0 1 8 15z',
  fan: 'M12 12m-1.500 0a1.500 1.500 0 1 0 3 0 1.500 1.500 0 1 0-3 0M12 10.500C12 6 9 4 8 6s1.500 4.500 4 4.500zM13.500 12c4.500 0 6.500 3 4.500 4s-4.500-1.500-4.500-4zM12 13.500c0 4.500 3 6.500 4 4.500s-1.500-4.500-4-4.500zM10.500 12C6 12 4 9 6 8s4.500 1.500 4.500 4z',
  seat: 'M8 4h6a2 2 0 0 1 2 2v7H9a1 1 0 0 0-1 1v0M16 13l1 6H7l1-5M7 19v2m10-2v2',
  defrost: 'M4 17c2-3 4-3 6 0s4 3 6 0M6 7c1.500-2 3-2 4.500 0s3 2 4.500 0M12 3v2m0 14v2',
  check: 'M5 12l5 5 9-10',
  x: 'M6 6l12 12M18 6L6 18',
  plus: 'M12 5v14M5 12h14',
  thermo: 'M10 14V5a2 2 0 0 1 4 0v9a4 4 0 1 1-4 0z',
  pin: 'M12 21s-6-6-6-11a6 6 0 0 1 12 0c0 5-6 11-6 11zM12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  shield: 'M12 3l8 3v6c0 5-3.500 8-8 9-4.500-1-8-4-8-9V6z',
}

function Icon({ name, size = 22, color = 'currentColor', w = 1.8 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  )
}

// ---------------------------------------------------------------- car art

const DOORS = {
  fl: { x: 33, y: 112, h: 64, side: 'l', label: 'Front left door' },
  fr: { x: 153, y: 112, h: 64, side: 'r', label: 'Front right door' },
  rl: { x: 33, y: 180, h: 60, side: 'l', label: 'Rear left door' },
  rr: { x: 153, y: 180, h: 60, side: 'r', label: 'Rear right door' },
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16)
  const f = (v) => Math.max(0, Math.min(255, Math.round(v + (amt > 0 ? (255 - v) * amt : v * amt))))
  return `rgb(${f(n >> 16)}, ${f((n >> 8) & 255)}, ${f(n & 255)})`
}

function CarSvg({ open, win, color, accent, locked, running, flash, honk, onPart }) {
  const uid = useId().replace(/\W/g, '')
  const lo = shade(color, 0.2)
  const dk = shade(color, -0.35)
  const glass = '#0e1624'
  const T = '.55s cubic-bezier(.3,.8,.3,1)'
  const part = (id, label, extra) => (onPart ? { onClick: () => onPart(id), role: 'button', tabIndex: 0, 'aria-label': `${label}: ${open[id] ? 'open' : 'closed'}`, onKeyDown: (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onPart(id)), style: { cursor: 'pointer', outline: 'none', ...extra } } : { style: extra })
  return (
    <svg viewBox="0 -40 200 460" width="100%" style={{ display: 'block', overflow: 'visible' }} role="img" aria-label={`Car, ${locked ? 'locked' : 'unlocked'}`}>
      <defs>
        <linearGradient id={`b${uid}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={dk} />
          <stop offset=".35" stopColor={lo} />
          <stop offset=".65" stopColor={color} />
          <stop offset="1" stopColor={dk} />
        </linearGradient>
        <radialGradient id={`g${uid}`} cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor={accent} stopOpacity=".55" />
          <stop offset="1" stopColor={accent} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`beam${uid}`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#fff7c2" stopOpacity=".9" />
          <stop offset="1" stopColor="#fff7c2" stopOpacity="0" />
        </linearGradient>
      </defs>
      <ellipse cx="100" cy="206" rx="86" ry="210" fill={`url(#g${uid})`} className={running ? 'ca-glow' : ''} style={{ opacity: running ? 1 : 0.18, transition: 'opacity .5s' }} />
      {/* tyres */}
      {[[32, 62], [158, 62], [32, 292], [158, 292]].map(([x, y]) => <rect key={`${x}${y}`} x={x} y={y} width="11" height="40" rx="4" fill="#06080d" />)}
      {/* headlight beams when flashing */}
      {flash && (
        <g className="ca-flash" style={{ pointerEvents: 'none' }}>
          <path d="M62 22 L40 -36 L92 -36 Z" fill={`url(#beam${uid})`} />
          <path d="M138 22 L108 -36 L160 -36 Z" fill={`url(#beam${uid})`} />
        </g>
      )}
      {/* honk waves */}
      {honk && (
        <g style={{ pointerEvents: 'none' }} fill="none" stroke={accent} strokeWidth="3" strokeLinecap="round">
          {[0, 1, 2].map((i) => <path key={i} className="ca-wave" style={{ animationDelay: `${i * 0.18}s` }} d={`M${70 - i * 8} ${-6 - i * 9} Q100 ${-26 - i * 12} ${130 + i * 8} ${-6 - i * 9}`} />)}
        </g>
      )}
      {/* body */}
      <path d="M100 14 C140 14 152 50 154 100 L158 290 C158 350 140 386 100 386 C60 386 42 350 42 290 L46 100 C48 50 60 14 100 14Z" fill={`url(#b${uid})`} stroke={dk} strokeWidth="1.5" />
      <path d="M100 30 C124 30 140 52 142 100 M100 30 C76 30 60 52 58 100" fill="none" stroke="#fff" strokeOpacity=".14" strokeWidth="2" />
      {/* glass */}
      <path d="M62 108 Q100 92 138 108 L146 152 L54 152Z" fill={glass} stroke="#000" strokeOpacity=".4" />
      <path d="M58 264 L142 264 L136 300 Q100 312 64 300Z" fill={glass} stroke="#000" strokeOpacity=".4" />
      <rect x="56" y="154" width="88" height="108" rx="14" fill="#16233a" stroke="#000" strokeOpacity=".35" />
      <path d="M62 160 L100 160 L72 256 L62 256Z" fill="#fff" fillOpacity=".06" />
      {/* lights */}
      {[70, 130].map((x) => <ellipse key={x} cx={x} cy="28" rx="11" ry="4.500" fill={flash ? '#fff7c2' : '#d6e4f5'} stroke={dk} />)}
      {[66, 134].map((x) => <rect key={x} x={x - 10} y="378" width="20" height="4" rx="2" fill="#ff3b4e" fillOpacity={flash ? 1 : 0.8} />)}
      {/* mirrors */}
      <ellipse cx="38" cy="112" rx="6" ry="4" fill={color} stroke={dk} />
      <ellipse cx="162" cy="112" rx="6" ry="4" fill={color} stroke={dk} />
      {/* trunk: cavity under a lid that lifts */}
      <path d="M66 326 H134 Q140 326 140 334 V362 Q100 380 60 362 V334 Q60 326 66 326Z" fill="#04060a" />
      <g {...part('trunk', 'Trunk', { transformOrigin: '100px 326px', transform: `scaleY(${open.trunk ? 0.42 : 1})`, transition: `transform ${T}` })}>
        <path d="M66 326 H134 Q140 326 140 334 V362 Q100 380 60 362 V334 Q60 326 66 326Z" fill={lo} stroke={dk} strokeWidth="1.500" />
        <path d="M74 346 H126" stroke={dk} strokeOpacity=".5" strokeWidth="2" strokeLinecap="round" />
      </g>
      {/* doors with windows */}
      {Object.entries(DOORS).map(([id, d]) => {
        const hx = d.x + 7
        const winH = win[id] ? 9 : d.h - 20
        return (
          <g key={id} {...part(id, d.label, { transformOrigin: `${hx}px ${d.y}px`, transform: `rotate(${open[id] ? (d.side === 'l' ? 52 : -52) : 0}deg)`, transition: `transform ${T}` })}>
            <rect x={d.x} y={d.y} width="14" height={d.h} rx="6" fill={lo} stroke={dk} strokeWidth="1.500" />
            <rect x={d.x + 3} y={d.y + 8} width="8" rx="3" fill="#16233a" style={{ height: winH, transition: `height ${T}` }} />
            <rect x={d.x + 3} y={d.y + d.h - 11} width="8" height="3" rx="1.500" fill={dk} />
          </g>
        )
      })}
      {/* lock badge */}
      <g transform="translate(100 208)" style={{ pointerEvents: 'none' }}>
        <circle r="15" fill={locked ? '#0f3d2e' : '#4a3410'} stroke={locked ? '#34d399' : '#fbbf24'} strokeWidth="2" />
        <g transform="translate(-9 -9) scale(.75)" fill="none" stroke={locked ? '#34d399' : '#fbbf24'} strokeWidth="2.200" strokeLinecap="round" strokeLinejoin="round">
          <path d={locked ? ICONS.lock : ICONS.unlock} />
        </g>
      </g>
    </svg>
  )
}

function RangeRing({ batt, fuel, limit, range, unit, hybrid, accent, charging }) {
  const R = 52
  const L = 2 * Math.PI * R
  const R2 = 38
  const L2 = 2 * Math.PI * R2
  const la = (limit / 100) * 360 - 90
  return (
    <svg width="136" height="136" viewBox="-68 -68 136 136" role="img" aria-label={`Range ${range} ${unit}, battery ${Math.round(batt)} percent`}>
      <g transform="rotate(-90)">
        <circle r={R} fill="none" stroke="#fff" strokeOpacity=".1" strokeWidth="10" />
        <circle r={R} fill="none" stroke={accent} strokeWidth="10" strokeLinecap="round" strokeDasharray={L} strokeDashoffset={L * (1 - batt / 100)} style={{ transition: 'stroke-dashoffset .8s ease' }} />
        {hybrid && (
          <>
            <circle r={R2} fill="none" stroke="#fff" strokeOpacity=".1" strokeWidth="6" />
            <circle r={R2} fill="none" stroke="#fbbf24" strokeWidth="6" strokeLinecap="round" strokeDasharray={L2} strokeDashoffset={L2 * (1 - fuel / 100)} />
          </>
        )}
      </g>
      <line x1={Math.cos((la * Math.PI) / 180) * (R - 8)} y1={Math.sin((la * Math.PI) / 180) * (R - 8)} x2={Math.cos((la * Math.PI) / 180) * (R + 8)} y2={Math.sin((la * Math.PI) / 180) * (R + 8)} stroke="#fff" strokeWidth="2.500" strokeLinecap="round" />
      <text y="-1" textAnchor="middle" fontSize="26" fontWeight="800" fill="#fff" style={{ fontVariantNumeric: 'tabular-nums' }}>{range}</text>
      <text y="14" textAnchor="middle" fontSize="10.500" fontWeight="700" fill="#8a98b3">{unit} range</text>
      {charging && <text y="30" textAnchor="middle" fontSize="9.500" fontWeight="800" fill={accent}>CHARGING</text>}
    </svg>
  )
}

const A0 = 135
const SWEEP = 270
const polar = (cx, cy, r, a) => [cx + r * Math.cos((a * Math.PI) / 180), cy + r * Math.sin((a * Math.PI) / 180)]
function arc(cx, cy, r, a0, a1) {
  const [x0, y0] = polar(cx, cy, r, a0)
  const [x1, y1] = polar(cx, cy, r, a1)
  return `M${x0} ${y0} A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1} ${y1}`
}

// A temperature dial: drag round the ring, or use the arrow keys.
function Dial({ value, min, max, step = 0.5, onChange, disabled, accent, display, sub, label }) {
  const uid = useId().replace(/\W/g, '')
  const ref = useRef()
  const dragging = useRef(false)
  const frac = (value - min) / (max - min)
  const ang = A0 + SWEEP * frac
  const pick = (e) => {
    const r = ref.current.getBoundingClientRect()
    let t = (Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180) / Math.PI
    if (t < 0) t += 360
    if (t < A0) t += 360
    if (t > A0 + SWEEP) t = t < A0 + SWEEP + (360 - SWEEP) / 2 ? A0 + SWEEP : A0
    const f = Math.max(0, Math.min(1, (t - A0) / SWEEP))
    onChange(Math.round((min + f * (max - min)) / step) * step)
  }
  const [tx, ty] = polar(125, 125, 98, ang)
  return (
    <svg
      ref={ref}
      viewBox="0 0 250 250"
      width="250"
      height="250"
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      onPointerDown={(e) => (!disabled && ((dragging.current = true), e.currentTarget.setPointerCapture?.(e.pointerId), pick(e)))}
      onPointerMove={(e) => dragging.current && pick(e)}
      onPointerUp={() => (dragging.current = false)}
      onPointerCancel={() => (dragging.current = false)}
      onKeyDown={(e) => {
        if (disabled) return
        if (e.key === 'ArrowUp' || e.key === 'ArrowRight') (e.preventDefault(), onChange(Math.min(max, value + step)))
        if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') (e.preventDefault(), onChange(Math.max(min, value - step)))
      }}
      style={{ touchAction: 'none', cursor: disabled ? 'default' : 'grab', display: 'block', margin: '0 auto', opacity: disabled ? 0.45 : 1, transition: 'opacity .3s', outline: 'none' }}
    >
      <defs>
        <linearGradient id={`d${uid}`} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#38bdf8" />
          <stop offset=".5" stopColor="#a78bfa" />
          <stop offset="1" stopColor="#fb7185" />
        </linearGradient>
      </defs>
      <path d={arc(125, 125, 98, A0, A0 + SWEEP)} fill="none" stroke="#fff" strokeOpacity=".09" strokeWidth="18" strokeLinecap="round" />
      <path d={arc(125, 125, 98, A0, Math.max(A0 + 0.1, ang))} fill="none" stroke={`url(#d${uid})`} strokeWidth="18" strokeLinecap="round" />
      {Array.from({ length: 28 }, (_, i) => {
        const a = A0 + (SWEEP * i) / 27
        const [x0, y0] = polar(125, 125, 74, a)
        const [x1, y1] = polar(125, 125, i % 3 === 0 ? 66 : 69, a)
        return <line key={i} x1={x0} y1={y0} x2={x1} y2={y1} stroke="#fff" strokeOpacity={a <= ang ? 0.5 : 0.18} strokeWidth="1.500" />
      })}
      <circle cx={tx} cy={ty} r="15" fill="#fff" stroke={accent} strokeWidth="4" style={{ filter: 'drop-shadow(0 3px 6px rgba(0,0,0,.5))' }} />
      <text x="125" y="132" textAnchor="middle" fontSize="50" fontWeight="800" fill="#fff" style={{ fontVariantNumeric: 'tabular-nums', userSelect: 'none' }}>{display}</text>
      <text x="125" y="158" textAnchor="middle" fontSize="13" fontWeight="600" fill="#8a98b3" style={{ userSelect: 'none' }}>{sub}</text>
    </svg>
  )
}

// small deterministic helpers for the trip charts
function rng(seed) {
  let s = seed
  return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296)
}
function routePts(seed, n = 20) {
  const r = rng(seed)
  let x = 0
  let y = 0
  let a = (r() - 0.5) * 2
  const raw = [[0, 0]]
  for (let i = 0; i < n; i++) {
    a += (r() - 0.5) * 1.3
    x += Math.cos(a) * 10
    y += Math.sin(a) * 10
    raw.push([x, y])
  }
  const xs = raw.map((p) => p[0])
  const ys = raw.map((p) => p[1])
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  const k = Math.min(88 / (Math.max(...xs) - minX || 1), 48 / (Math.max(...ys) - minY || 1))
  return raw.map(([px, py]) => [6 + (px - minX) * k, 6 + (py - minY) * k])
}
const smooth = (pts) => pts.reduce((d, p, i) => (i === 0 ? `M${p[0]} ${p[1]}` : i === pts.length - 1 ? `${d} L${p[0]} ${p[1]}` : `${d} Q${p[0]} ${p[1]} ${(p[0] + pts[i + 1][0]) / 2} ${(p[1] + pts[i + 1][1]) / 2}`), '')
function speeds(seed, n = 36) {
  const r = rng(seed + 7)
  let v = 30
  return Array.from({ length: n }, (_, i) => (v = Math.max(0, Math.min(115, v + (r() - 0.45) * 38 + (i % 12 === 0 ? -25 : 0)))))
}

function RouteChart({ seed, w = 100, h = 60, stroke = 2.600, accent, big }) {
  const pts = routePts(seed)
  const a = pts[0]
  const b = pts[pts.length - 1]
  return (
    <svg viewBox="0 0 100 60" width={w} height={h} role="img" aria-label="Route map" style={{ display: 'block', borderRadius: big ? 18 : 10, background: big ? 'linear-gradient(135deg,#0f1a2e,#0b1322)' : 'rgba(255,255,255,.04)' }}>
      {big && [20, 40, 60, 80].map((v) => <line key={v} x1={v} y1="0" x2={v} y2="60" stroke="#fff" strokeOpacity=".05" />)}
      {big && [15, 30, 45].map((v) => <line key={v} x1="0" y1={v} x2="100" y2={v} stroke="#fff" strokeOpacity=".05" />)}
      <path d={smooth(pts)} fill="none" stroke={accent} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={a[0]} cy={a[1]} r={big ? 2.800 : 3} fill="#fff" />
      <circle cx={b[0]} cy={b[1]} r={big ? 2.800 : 3} fill={accent} stroke="#fff" strokeWidth="1.200" />
    </svg>
  )
}

function StatusBar({ frame }) {
  const clock = new Date().toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' })
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20, height: 54, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 30px 0 36px', fontSize: 16, fontWeight: 600, color: C.ink, pointerEvents: 'none' }}>
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

const NAV = [
  ['car', 'car', 'Car'],
  ['climate', 'climate', 'Climate'],
  ['lock', 'lock', 'Lock'],
  ['trips', 'trips', 'Trips'],
  ['settings', 'gear', 'Settings'],
]
const PAGES = NAV.map((n) => n[0])

const TRIPS = [
  { id: 'tr1', from: 'Home', to: 'Office', day: 6, label: 'Sun', km: 18.4, min: 31, eff: 148, seed: 11 },
  { id: 'tr2', from: 'Office', to: 'Gym', day: 5, label: 'Sat', km: 6.2, min: 14, eff: 171, seed: 23 },
  { id: 'tr3', from: 'Gym', to: 'Home', day: 5, label: 'Sat', km: 8.9, min: 19, eff: 159, seed: 37 },
  { id: 'tr4', from: 'Home', to: 'Lakeside trailhead', day: 4, label: 'Fri', km: 64.8, min: 62, eff: 138, seed: 41 },
  { id: 'tr5', from: 'Lakeside trailhead', to: 'Home', day: 4, label: 'Fri', km: 65.1, min: 66, eff: 142, seed: 58 },
  { id: 'tr6', from: 'Home', to: 'Airport', day: 2, label: 'Wed', km: 32.7, min: 38, eff: 151, seed: 66 },
  { id: 'tr7', from: 'Airport', to: 'Home', day: 2, label: 'Wed', km: 33.0, min: 41, eff: 156, seed: 79 },
  { id: 'tr8', from: 'Home', to: 'Office', day: 0, label: 'Mon', km: 18.2, min: 29, eff: 145, seed: 83 },
]
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const circ = { width: 38, height: 38, display: 'grid', placeItems: 'center', border: 'none', borderRadius: '50%', cursor: 'pointer', padding: 0, color: C.ink, flex: 'none', background: 'rgba(255,255,255,.1)' }
const glass = { background: C.card, border: `1px solid ${C.line}`, borderRadius: 24, backdropFilter: 'blur(14px)' }
const rowS = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '13px 0', borderBottom: `1px solid ${C.line}`, fontSize: 14 }

// ---------------------------------------------------------------- app

export default function CarApp({ name = 'Aurora', accent = '#22d3ee', startScreen = 'car', frame = true, style }) {
  const box = useRef()
  const toastTimer = useRef()
  const timers = useRef([])
  const [scale, setScale] = useState(1)
  const [tab, setTab] = useState(PAGES.includes(startScreen) ? startScreen : 'car')
  const [stack, setStack] = useState([])
  const [dir, setDir] = useState(1)
  const [toast, setToast] = useState('')
  const [open, setOpen] = useState({ fl: false, fr: false, rl: false, rr: false, trunk: false })
  const [win, setWin] = useState({ fl: false, fr: false, rl: false, rr: false })
  const [locked, setLocked] = useState(true)
  const [running, setRunning] = useState(false)
  const [runEnd, setRunEnd] = useState(0)
  const [fx, setFx] = useState({ flash: false, honk: false, ripple: 0, kind: '' })
  const [batt, setBatt] = useState(74)
  const [fuel] = useState(64)
  const [charging, setCharging] = useState(false)
  const [limit, setLimit] = useState(90)
  const [hybrid, setHybrid] = useState(false)
  const [paint, setPaint] = useState(0)
  const [metric, setMetric] = useState(true)
  const [sentry, setSentry] = useState(false)
  const [valet, setValet] = useState(false)
  const [autoLock, setAutoLock] = useState(true)
  const [keys, setKeys] = useState([
    { id: 'k1', name: 'Alex’s phone', kind: 'Phone key', on: true },
    { id: 'k2', name: 'Key card', kind: 'NFC card', on: true },
    { id: 'k3', name: 'Sam (guest)', kind: 'Guest, weekends', on: false },
  ])
  const [temp, setTemp] = useState(21)
  const [ac, setAc] = useState(false)
  const [fan, setFan] = useState(3)
  const [seat, setSeat] = useState({ d: 0, p: 0 })
  const [defF, setDefF] = useState(false)
  const [defR, setDefR] = useState(false)
  const [cabin, setCabin] = useState(26.4)
  const [preSel, setPreSel] = useState(0)
  const [pre, setPre] = useState(null)
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [mode, setMode] = useState('week')
  const [dayF, setDayF] = useState(null)

  const later = (fn, ms) => {
    const id = setTimeout(fn, ms)
    timers.current.push(id)
  }
  const say = (t) => {
    setToast(t)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 2000)
  }
  useEffect(() => () => (timers.current.forEach(clearTimeout), clearTimeout(toastTimer.current)), [])

  useEffect(() => {
    setTab(PAGES.includes(startScreen) ? startScreen : 'car')
    setStack([])
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

  // one clock: countdowns, pre-conditioning, remote-start timeout
  useEffect(() => {
    const id = setInterval(() => {
      const t = Date.now()
      setNowMs(t)
      if (runEnd && t >= runEnd) {
        setRunning(false)
        setRunEnd(0)
      }
    }, 500)
    return () => clearInterval(id)
  }, [runEnd])

  // the pre-condition timer fires once when it runs out
  useEffect(() => {
    if (!pre) return
    const id = setTimeout(() => {
      setPre(null)
      setAc(true)
      setFan((f) => Math.max(f, 3))
      say(`Cabin pre-conditioned to ${temp}°C`)
    }, Math.max(0, pre.end - Date.now()))
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pre])

  // cabin temperature chases the target while the climate is on
  useEffect(() => {
    const id = setInterval(() => {
      setCabin((c) => {
        const goal = ac ? temp : 14
        const rate = ac ? 0.15 + fan * 0.07 : 0.03
        return Math.abs(goal - c) < rate ? goal : c + Math.sign(goal - c) * rate
      })
    }, 1000)
    return () => clearInterval(id)
  }, [ac, temp, fan])

  // charging
  useEffect(() => {
    if (!charging) return
    const id = setInterval(() => setBatt((b) => Math.min(100, +(b + 1).toFixed(0))), 1500)
    return () => clearInterval(id)
  }, [charging])
  useEffect(() => {
    if (charging && batt >= limit) {
      setCharging(false)
      say(`Charged to your ${limit}% limit`)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batt, charging, limit])

  // auto-lock: leave it unlocked and closed for a while and it locks itself
  const allClosed = !Object.values(open).some(Boolean)
  useEffect(() => {
    if (!autoLock || locked || !allClosed) return
    const id = setTimeout(() => (setLocked(true), say('Auto-locked')), 15000)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLock, locked, allClosed])

  const top = stack[stack.length - 1]
  const push = (s) => (setDir(1), setStack((a) => [...a, s]))
  const pop = () => (setDir(-1), setStack((a) => a.slice(0, -1)))
  const go = (t) => (setDir(PAGES.indexOf(t) > PAGES.indexOf(tab) ? 1 : -1), setTab(t), setStack([]))

  const dist = (km) => (metric ? km : km * KM)
  const du = metric ? 'km' : 'mi'
  const dt = (c) => (metric ? `${(+c).toFixed(1).replace(/\.0$/, '')}°` : `${Math.round((c * 9) / 5 + 32)}°`)
  const range = Math.round(dist(batt * 4.2 + (hybrid ? fuel * 6.2 : 0)))
  const carColor = PAINTS[paint][1]
  const openCount = Object.values(open).filter(Boolean).length

  const toggleOpen = (id) => {
    if (locked && !open[id]) return say('Unlock the car first')
    if (valet && id === 'trunk' && !open.trunk) return say('Trunk is locked in valet mode')
    setOpen((o) => ({ ...o, [id]: !o[id] }))
  }
  const toggleWin = (id) => setWin((w) => ({ ...w, [id]: !w[id] }))

  const pulse = (kind, extra = {}, ms = 1500) => {
    setFx((f) => ({ ...f, kind, ripple: f.ripple + 1, ...extra }))
    later(() => setFx((f) => ({ ...f, flash: false, honk: false, kind: '' })), ms)
  }
  const doLock = () => {
    if (locked) {
      setLocked(false)
      pulse('unlock', { flash: true }, 1200)
      return say('Unlocked')
    }
    if (!allClosed) return say(`Close ${openCount} open door${openCount > 1 ? 's' : ''} before locking`)
    setLocked(true)
    pulse('lock', { flash: true }, 1200)
    say(Object.values(win).some(Boolean) ? 'Locked · a window is still down' : 'Locked')
  }
  const doHonk = () => (pulse('honk', { honk: true }, 1400), say('Honk!'))
  const doFlash = () => (pulse('flash', { flash: true }, 1800), say('Lights flashing'))
  const doStart = () => {
    if (running) {
      setRunning(false)
      setRunEnd(0)
      return say('Engine off')
    }
    if (!allClosed) return say('Close all doors to start')
    setRunning(true)
    setRunEnd(Date.now() + 10 * 60 * 1000)
    pulse('start', {}, 1200)
    say('Started · runs for 10 min')
  }

  const toggle = (on, set, label) => (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => set(!on)} style={{ width: 48, height: 28, borderRadius: 14, border: 'none', padding: 3, background: on ? accent : 'rgba(255,255,255,.18)', cursor: 'pointer', transition: 'background .2s', flex: 'none' }}>
      <span style={{ display: 'block', width: 22, height: 22, borderRadius: '50%', background: on ? '#04161c' : '#d6deec', transform: `translateX(${on ? 20 : 0}px)`, transition: 'transform .2s' }} />
    </button>
  )
  const header = (title, back, right, sub) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 18px 8px', minHeight: 56 }}>
      {back && (
        <button type="button" onClick={back} aria-label="Back" style={circ}>
          <Icon name="back" size={20} />
        </button>
      )}
      <div style={{ flex: 1, marginLeft: 4 }}>
        <h1 style={{ margin: 0, fontSize: back ? 18 : 28, fontWeight: 800, letterSpacing: '-0.02em' }}>{title}</h1>
        {sub && <div style={{ fontSize: 12.500, color: C.mute, marginTop: 1 }}>{sub}</div>}
      </div>
      {right}
    </div>
  )
  const chip = (on, label, sub, onClick, aria) => (
    <button type="button" onClick={onClick} aria-pressed={on} aria-label={aria} style={{ textAlign: 'left', padding: '10px 12px', borderRadius: 16, border: `1px solid ${on ? accent : C.line}`, background: on ? `${accent}22` : C.card, color: C.ink, font: 'inherit', cursor: 'pointer' }}>
      <span style={{ display: 'block', fontSize: 12.500, fontWeight: 700 }}>{label}</span>
      <span style={{ display: 'block', fontSize: 11.500, color: on ? accent : C.mute, marginTop: 1 }}>{sub}</span>
    </button>
  )
  const big = (label, icon, onClick, on, sub) => (
    <button type="button" onClick={onClick} aria-pressed={on} style={{ display: 'grid', justifyItems: 'center', gap: 6, padding: '16px 8px 12px', borderRadius: 24, border: `1px solid ${on ? accent : C.line}`, background: on ? `${accent}24` : C.card, color: on ? accent : C.ink, font: 'inherit', cursor: 'pointer' }}>
      <Icon name={icon} size={30} w={1.7} />
      <span style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>{label}</span>
      <span style={{ fontSize: 11.500, color: C.mute }}>{sub}</span>
    </button>
  )

  const carArt = (onPart) => <CarSvg open={open} win={win} color={carColor} accent={accent} locked={locked} running={running} flash={fx.flash} honk={fx.honk} onPart={onPart} />

  // ---- screens
  let body
  let tabbed = true
  if (top?.id === 'trip') {
    tabbed = false
    const t = TRIPS.find((x) => x.id === top.tripId)
    const sp = speeds(t.seed)
    const maxS = Math.max(...sp)
    const avg = (t.km / t.min) * 60
    const line = sp.map((v, i) => `${(i / (sp.length - 1)) * 300} ${90 - (v / maxS) * 80}`)
    const kwh = (t.km * t.eff) / 1000
    body = (
      <>
        {header(`${t.from} → ${t.to}`, pop, null, `${t.label} · ${DAYS[t.day]}`)}
        <div style={{ padding: '4px 18px' }}>
          <RouteChart seed={t.seed} w="100%" h={190} big accent={accent} stroke={2.200} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '14px 18px 0' }}>
          {[
            ['Distance', `${dist(t.km).toFixed(1)} ${du}`],
            ['Duration', `${t.min} min`],
            ['Avg speed', `${Math.round(dist(avg))} ${du}/h`],
            ['Efficiency', `${Math.round(metric ? t.eff : t.eff * 1.609)} Wh/${du}`],
            ['Energy used', `${kwh.toFixed(1)} kWh`],
            ['Top speed', `${Math.round(dist(maxS))} ${du}/h`],
          ].map(([l, v]) => (
            <div key={l} style={{ ...glass, padding: '12px 14px', borderRadius: 18 }}>
              <div style={{ fontSize: 11.500, color: C.mute }}>{l}</div>
              <div style={{ fontSize: 18, fontWeight: 800, marginTop: 2 }}>{v}</div>
            </div>
          ))}
        </div>
        <div style={{ ...glass, margin: '12px 18px 0', padding: 14 }}>
          <div style={{ fontSize: 12.500, fontWeight: 700, color: C.mute, marginBottom: 6 }}>Speed profile</div>
          <svg viewBox="0 0 300 96" width="100%" role="img" aria-label="Speed over the trip">
            <defs>
              <linearGradient id="ca-sp" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={accent} stopOpacity=".5" />
                <stop offset="1" stopColor={accent} stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={`M0 90 L${line.join(' L')} L300 90Z`} fill="url(#ca-sp)" />
            <path d={`M${line.join(' L')}`} fill="none" stroke={accent} strokeWidth="2" strokeLinejoin="round" />
          </svg>
        </div>
      </>
    )
  } else if (top?.id === 'keys') {
    tabbed = false
    body = (
      <>
        {header('Digital keys', pop)}
        <div style={{ ...glass, margin: '0 18px', padding: '4px 16px' }}>
          {keys.map((k, i) => (
            <div key={k.id} style={{ ...rowS, borderBottom: i === keys.length - 1 ? 'none' : rowS.borderBottom }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                <span style={{ width: 38, height: 38, borderRadius: 13, display: 'grid', placeItems: 'center', background: `${accent}22`, color: accent, flex: 'none' }}><Icon name="key" size={20} /></span>
                <span><span style={{ display: 'block', fontWeight: 700 }}>{k.name}</span><span style={{ display: 'block', fontSize: 12, color: C.mute }}>{k.kind}</span></span>
              </span>
              {toggle(k.on, (v) => (setKeys((a) => a.map((x) => (x.id === k.id ? { ...x, on: v } : x))), say(`${k.name} ${v ? 'enabled' : 'disabled'}`)), k.name)}
            </div>
          ))}
        </div>
        <div style={{ padding: '14px 18px' }}>
          <button type="button" onClick={() => (setKeys((a) => [...a, { id: `k${Date.now()}`, name: `Guest ${a.length - 1}`, kind: 'Guest, 24 hours', on: true }]), say('Guest key added'))} style={{ width: '100%', height: 50, borderRadius: 25, border: 'none', background: accent, color: '#04161c', font: 'inherit', fontSize: 15, fontWeight: 800, cursor: 'pointer' }}>Add guest key</button>
        </div>
      </>
    )
  } else if (tab === 'car') {
    const doorSub = (id) => (open[id] ? 'Open' : 'Closed')
    body = (
      <>
        {header(name, null, <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.500, fontWeight: 700, padding: '6px 12px', borderRadius: 16, background: locked ? '#0f3d2e' : '#4a3410', color: locked ? '#34d399' : '#fbbf24' }}><Icon name={locked ? 'lock' : 'unlock'} size={14} w={2.200} />{locked ? 'Locked' : 'Unlocked'}</span>, 'Model R · ABC 1234')}
        <div style={{ ...glass, margin: '4px 18px 0', padding: '14px 14px 12px', display: 'grid', gridTemplateColumns: '132px 1fr', gap: 8, alignItems: 'center', overflow: 'hidden' }}>
          <div style={{ marginTop: -6, width: 132, justifySelf: 'center' }}>{carArt(toggleOpen)}</div>
          <div style={{ display: 'grid', justifyItems: 'center', gap: 10 }}>
            <RangeRing batt={batt} fuel={fuel} limit={limit} range={range} unit={du} hybrid={hybrid} accent={accent} charging={charging} />
            <div style={{ fontSize: 12.500, color: C.mute, textAlign: 'center' }}><b style={{ color: C.ink, fontSize: 15 }}>{Math.round(batt)}%</b> battery{hybrid && <> · <b style={{ color: '#fbbf24' }}>{fuel}%</b> fuel</>}</div>
            <button type="button" onClick={() => (setCharging((c) => !c), say(charging ? 'Charging paused' : batt >= limit ? `Already at your ${limit}% limit` : 'Charging started'))} style={{ display: 'flex', alignItems: 'center', gap: 6, height: 36, padding: '0 16px', borderRadius: 18, border: `1px solid ${charging ? accent : C.line}`, background: charging ? `${accent}22` : 'transparent', color: charging ? accent : C.ink, font: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              <Icon name="plug" size={16} /> {charging ? 'Charging…' : 'Plug in'}
            </button>
          </div>
        </div>
        <div style={{ fontSize: 12.500, fontWeight: 700, color: C.mute, padding: '16px 22px 8px', letterSpacing: '.05em', textTransform: 'uppercase' }}>Doors and trunk · tap the car too</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, padding: '0 18px' }}>
          {Object.entries(DOORS).map(([id, d]) => chip(open[id], d.label.replace(' door', ''), doorSub(id), () => toggleOpen(id), d.label))}
          {chip(open.trunk, 'Trunk', doorSub('trunk'), () => toggleOpen('trunk'), 'Trunk')}
        </div>
        <div style={{ fontSize: 12.500, fontWeight: 700, color: C.mute, padding: '16px 22px 8px', letterSpacing: '.05em', textTransform: 'uppercase' }}>Windows</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, padding: '0 18px' }}>
          {Object.keys(win).map((id) => chip(win[id], id.toUpperCase(), win[id] ? 'Down' : 'Up', () => toggleWin(id), `Window ${id}`))}
        </div>
        <div style={{ display: 'flex', gap: 10, padding: '12px 18px 0' }}>
          {[['Vent all', true], ['Close all', false]].map(([l, v]) => (
            <button key={l} type="button" onClick={() => (setWin({ fl: v, fr: v, rl: v, rr: v }), say(v ? 'Windows vented' : 'Windows closed'))} style={{ flex: 1, height: 44, borderRadius: 22, border: `1px solid ${C.line}`, background: C.card, color: C.ink, font: 'inherit', fontSize: 13.500, fontWeight: 700, cursor: 'pointer' }}>{l}</button>
          ))}
        </div>
      </>
    )
  } else if (tab === 'climate') {
    const preOpts = [['1 min', 60], ['10 min', 600], ['30 min', 1800]]
    const left = pre ? Math.max(0, Math.ceil((pre.end - nowMs) / 1000)) : 0
    const heat = (k, label) => (
      <button key={k} type="button" onClick={() => setSeat((s) => ({ ...s, [k]: (s[k] + 1) % 4 }))} aria-label={`${label} seat heat level ${seat[k]}`} style={{ ...glass, borderRadius: 20, padding: '12px 14px', color: C.ink, font: 'inherit', cursor: 'pointer', textAlign: 'left', border: `1px solid ${seat[k] ? '#fb923c' : C.line}` }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: seat[k] ? '#fb923c' : C.mute }}><Icon name="seat" size={22} /><span style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{label}</span></span>
        <span style={{ display: 'flex', gap: 4, marginTop: 10 }}>
          {[1, 2, 3].map((n) => <i key={n} style={{ flex: 1, height: 5, borderRadius: 3, background: n <= seat[k] ? '#fb923c' : 'rgba(255,255,255,.14)', transition: 'background .2s' }} />)}
        </span>
      </button>
    )
    body = (
      <>
        {header('Climate', null, toggle(ac, (v) => (setAc(v), say(v ? 'Climate on' : 'Climate off')), 'Climate power'), ac ? `Cooling to ${dt(temp)}` : 'Off')}
        <div style={{ padding: '4px 0 0' }}>
          <Dial value={temp} min={16} max={30} onChange={(v) => (setTemp(v), ac || setAc(true))} disabled={false} accent={accent} display={dt(temp)} sub={`Cabin ${dt(cabin)}`} label="Target temperature" />
        </div>
        <div style={{ ...glass, margin: '8px 18px 0', padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}><span className={ac && fan ? 'ca-spin' : ''} style={{ display: 'flex', color: accent }}><Icon name="fan" size={22} /></span> Fan</span>
            <span style={{ fontSize: 13, color: C.mute }}>{fan ? `Speed ${fan}` : 'Off'}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6 }} role="radiogroup" aria-label="Fan speed">
            {[0, 1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" role="radio" aria-checked={fan === n} onClick={() => (setFan(n), n && !ac && setAc(true))} style={{ height: 40, borderRadius: 12, border: 'none', background: fan === n ? accent : n < fan ? `${accent}44` : 'rgba(255,255,255,.08)', color: fan === n ? '#04161c' : C.ink, font: 'inherit', fontWeight: 800, cursor: 'pointer' }}>{n}</button>
            ))}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '10px 18px 0' }}>
          {heat('d', 'Driver')}
          {heat('p', 'Passenger')}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '10px 18px 0' }}>
          {[['Front defrost', defF, setDefF], ['Rear defrost', defR, setDefR]].map(([l, v, set]) => (
            <button key={l} type="button" aria-pressed={v} onClick={() => (set(!v), v || (l[0] === 'F' && (setAc(true), setFan((f) => Math.max(f, 4)))), say(`${l} ${v ? 'off' : 'on'}`))} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px', borderRadius: 20, border: `1px solid ${v ? accent : C.line}`, background: v ? `${accent}22` : C.card, color: v ? accent : C.ink, font: 'inherit', fontWeight: 700, fontSize: 13.500, cursor: 'pointer' }}>
              <Icon name="defrost" size={22} /> {l}
            </button>
          ))}
        </div>
        <div style={{ ...glass, margin: '10px 18px 0', padding: '14px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700 }}>Pre-condition</span>
            <span style={{ fontSize: 22, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: pre ? accent : C.mute }}>{pre ? `${pad(Math.floor(left / 60))}:${pad(left % 60)}` : '--:--'}</span>
          </div>
          <div style={{ fontSize: 12, color: C.mute, margin: '2px 0 10px' }}>{pre ? `Warming the cabin to ${dt(temp)} when the timer ends.` : 'Start the climate before you get in.'}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 10 }} role="radiogroup" aria-label="Pre-condition in">
            {preOpts.map(([l], i) => (
              <button key={l} type="button" role="radio" aria-checked={preSel === i} onClick={() => setPreSel(i)} style={{ height: 36, borderRadius: 12, border: 'none', background: preSel === i ? 'rgba(255,255,255,.2)' : 'rgba(255,255,255,.07)', color: C.ink, font: 'inherit', fontSize: 12.500, fontWeight: 700, cursor: 'pointer' }}>In {l}</button>
            ))}
          </div>
          <button type="button" onClick={() => (pre ? (setPre(null), say('Pre-condition cancelled')) : (setPre({ end: Date.now() + preOpts[preSel][1] * 1000 }), say(`Pre-conditioning in ${preOpts[preSel][0]}`)))} style={{ width: '100%', height: 46, borderRadius: 23, border: pre ? `1px solid ${C.line}` : 'none', background: pre ? 'transparent' : accent, color: pre ? C.ink : '#04161c', font: 'inherit', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>{pre ? 'Cancel timer' : 'Start timer'}</button>
        </div>
      </>
    )
  } else if (tab === 'lock') {
    const runLeft = running ? Math.max(0, Math.ceil((runEnd - nowMs) / 1000)) : 0
    body = (
      <>
        {header('Lock', null, null, running ? `Running · ${Math.floor(runLeft / 60)}:${pad(runLeft % 60)} left` : locked ? 'Your car is locked' : 'Your car is unlocked')}
        <div style={{ position: 'relative', height: 330, display: 'grid', placeItems: 'center' }}>
          {fx.ripple > 0 && fx.kind && [0, 1, 2].map((i) => (
            <span key={`${fx.ripple}-${i}`} className="ca-ripple" style={{ position: 'absolute', width: 120, height: 120, borderRadius: '50%', border: `2px solid ${fx.kind === 'lock' ? '#34d399' : fx.kind === 'honk' ? '#fbbf24' : accent}`, animationDelay: `${i * 0.25}s` }} />
          ))}
          <div style={{ width: 138 }} aria-live="polite">{carArt(null)}</div>
          <div style={{ position: 'absolute', bottom: 4, left: 0, right: 0, textAlign: 'center', fontSize: 13, fontWeight: 700, color: fx.kind ? accent : C.mute, minHeight: 18 }}>
            {{ lock: 'Locking…', unlock: 'Unlocking…', honk: 'Honking', flash: 'Flashing lights', start: 'Starting…' }[fx.kind] || (openCount ? `${openCount} open` : 'All closed')}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: '0 18px' }}>
          {big(locked ? 'Unlock' : 'Lock', locked ? 'unlock' : 'lock', doLock, !locked, locked ? 'Tap to unlock' : 'Tap to lock')}
          {big('Start', 'bolt', doStart, running, running ? 'Tap to stop' : 'Remote start')}
          {big('Honk', 'horn', doHonk, fx.honk, 'Sound the horn')}
          {big('Flash', 'light', doFlash, fx.flash && fx.kind === 'flash', 'Flash the lights')}
        </div>
      </>
    )
  } else if (tab === 'trips') {
    const wk = TRIPS
    const weekKm = wk.reduce((s, t) => s + t.km, 0)
    const f = mode === 'week' ? 1 : 4.3
    const totalKm = weekKm * f
    const totalMin = wk.reduce((s, t) => s + t.min, 0) * f
    const effAvg = wk.reduce((s, t) => s + t.eff * t.km, 0) / weekKm
    const byDay = DAYS.map((_, i) => wk.filter((t) => t.day === i).reduce((s, t) => s + t.km, 0))
    const bars = mode === 'week' ? byDay : [0.9, 1.1, 1, 1.2].map((m) => weekKm * m)
    const labels = mode === 'week' ? DAYS : ['Wk 1', 'Wk 2', 'Wk 3', 'Wk 4']
    const maxB = Math.max(...bars)
    const list = mode === 'week' && dayF != null ? wk.filter((t) => t.day === dayF) : wk
    body = (
      <>
        {header('Trips')}
        <div style={{ padding: '0 18px 10px' }}>
          <div role="radiogroup" aria-label="Period" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, padding: 3, borderRadius: 14, background: 'rgba(255,255,255,.07)' }}>
            {[['week', 'This week'], ['month', 'Last 30 days']].map(([k, l]) => (
              <button key={k} type="button" role="radio" aria-checked={mode === k} onClick={() => (setMode(k), setDayF(null))} style={{ height: 36, border: 'none', borderRadius: 11, background: mode === k ? 'rgba(255,255,255,.18)' : 'transparent', color: C.ink, font: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{l}</button>
            ))}
          </div>
        </div>
        <div style={{ ...glass, margin: '0 18px', padding: '16px 16px 12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, textAlign: 'center' }}>
            {[[Math.round(dist(totalKm)), du], [`${Math.floor(totalMin / 60)}h ${Math.round(totalMin % 60)}m`, 'driving'], [Math.round(metric ? effAvg : effAvg * 1.609), `Wh/${du}`]].map(([v, l]) => (
              <div key={l}><div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>{v}</div><div style={{ fontSize: 11.500, color: C.mute }}>{l}</div></div>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 92, marginTop: 14 }}>
            {bars.map((v, i) => {
              const on = mode === 'week' && dayF === i
              return (
                <button key={i} type="button" disabled={mode !== 'week' || !v} onClick={() => setDayF(on ? null : i)} aria-pressed={on} aria-label={`${labels[i]}: ${Math.round(dist(v))} ${du}`} style={{ flex: 1, display: 'grid', alignContent: 'end', justifyItems: 'center', gap: 4, height: '100%', border: 'none', background: 'none', padding: 0, cursor: mode === 'week' && v ? 'pointer' : 'default', font: 'inherit' }}>
                  <span style={{ width: '100%', height: Math.max(3, (v / maxB) * 64), borderRadius: 6, background: on || dayF == null ? accent : `${accent}44`, transition: 'height .5s, background .2s' }} />
                  <span style={{ fontSize: 10.500, color: on ? C.ink : C.mute, fontWeight: on ? 800 : 500 }}>{labels[i]}</span>
                </button>
              )
            })}
          </div>
        </div>
        <div style={{ display: 'grid', gap: 8, padding: '14px 18px 0' }}>
          {list.map((t) => (
            <button key={t.id} type="button" onClick={() => push({ id: 'trip', tripId: t.id })} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '10px 14px 10px 10px', border: `1px solid ${C.line}`, borderRadius: 20, background: C.card, font: 'inherit', textAlign: 'left', cursor: 'pointer', color: C.ink }}>
              <RouteChart seed={t.seed} w={74} h={46} accent={accent} stroke={3.400} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.from} → {t.to}</span>
                <span style={{ display: 'block', fontSize: 12, color: C.mute, marginTop: 2 }}>{t.label} · {t.min} min</span>
              </span>
              <span style={{ fontSize: 14, fontWeight: 800 }}>{dist(t.km).toFixed(1)} <span style={{ fontSize: 11, color: C.mute, fontWeight: 600 }}>{du}</span></span>
            </button>
          ))}
          {!list.length && <div style={{ textAlign: 'center', color: C.mute, padding: 24 }}>No trips that day.</div>}
        </div>
      </>
    )
  } else {
    body = (
      <>
        {header('Settings')}
        <div style={{ ...glass, margin: '0 18px', padding: '4px 16px' }}>
          <div style={{ ...rowS, flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
            <span style={{ fontWeight: 600 }}>Units</span>
            <div role="radiogroup" aria-label="Units" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, padding: 3, borderRadius: 14, background: 'rgba(255,255,255,.07)' }}>
              {[[true, 'Metric · km · °C'], [false, 'Imperial · mi · °F']].map(([v, l]) => (
                <button key={l} type="button" role="radio" aria-checked={metric === v} onClick={() => setMetric(v)} style={{ height: 36, border: 'none', borderRadius: 11, background: metric === v ? 'rgba(255,255,255,.18)' : 'transparent', color: C.ink, font: 'inherit', fontSize: 12.500, fontWeight: 700, cursor: 'pointer' }}>{l}</button>
              ))}
            </div>
          </div>
          <div style={{ ...rowS, flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
            <span style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}><span>Charge limit</span><span style={{ color: accent }}>{limit}%</span></span>
            <input type="range" min="50" max="100" step="5" value={limit} onChange={(e) => setLimit(+e.target.value)} aria-label="Charge limit" style={{ width: '100%', accentColor: accent }} />
          </div>
          <div style={rowS}><span style={{ fontWeight: 600 }}>Hybrid (adds fuel range)</span>{toggle(hybrid, setHybrid, 'Hybrid')}</div>
          <div style={rowS}><span style={{ fontWeight: 600 }}>Auto-lock when closed</span>{toggle(autoLock, setAutoLock, 'Auto-lock')}</div>
          <div style={rowS}><span style={{ fontWeight: 600 }}>Sentry mode</span>{toggle(sentry, (v) => (setSentry(v), say(v ? 'Sentry watching' : 'Sentry off')), 'Sentry mode')}</div>
          <div style={rowS}><span style={{ fontWeight: 600 }}>Valet mode (locks trunk)</span>{toggle(valet, (v) => (setValet(v), v && setOpen((o) => ({ ...o, trunk: false })), say(v ? 'Valet mode on' : 'Valet mode off')), 'Valet mode')}</div>
          <div style={{ ...rowS, flexDirection: 'column', alignItems: 'stretch', gap: 10, borderBottom: 'none' }}>
            <span style={{ fontWeight: 600 }}>Paint · {PAINTS[paint][0]}</span>
            <div style={{ display: 'flex', gap: 12 }}>
              {PAINTS.map(([n, c], i) => (
                <button key={n} type="button" aria-label={n} aria-pressed={paint === i} onClick={() => setPaint(i)} style={{ width: 40, height: 40, borderRadius: '50%', border: `3px solid ${paint === i ? accent : 'rgba(255,255,255,.2)'}`, background: c, cursor: 'pointer', padding: 0 }} />
              ))}
            </div>
          </div>
        </div>
        <div style={{ ...glass, margin: '12px 18px 0', padding: '2px 16px' }}>
          <button type="button" onClick={() => push({ id: 'keys' })} style={{ ...rowS, width: '100%', border: 'none', background: 'none', color: C.ink, font: 'inherit', cursor: 'pointer', borderBottom: 'none' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 600 }}><Icon name="key" size={20} color={accent} /> Digital keys</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: C.mute, fontSize: 13 }}>{keys.filter((k) => k.on).length} active <Icon name="chev" size={17} /></span>
          </button>
        </div>
        <div style={{ padding: '14px 18px' }}>
          <button type="button" onClick={() => (setOpen({ fl: false, fr: false, rl: false, rr: false, trunk: false }), setWin({ fl: false, fr: false, rl: false, rr: false }), setLocked(true), setRunning(false), setBatt(74), setCharging(false), setLimit(90), setHybrid(false), setPaint(0), setMetric(true), setAc(false), setTemp(21), setPre(null), say('Demo reset'))} style={{ width: '100%', height: 48, borderRadius: 24, border: `1px solid ${C.line}`, background: 'transparent', color: C.ink, font: 'inherit', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Reset demo</button>
        </div>
      </>
    )
  }

  const phone = (
    <div style={{ position: 'relative', width: W, height: H, overflow: 'hidden', borderRadius: frame ? 46 : 0, background: `radial-gradient(ellipse at 50% 0%, #15244a, ${C.bg} 62%)`, color: C.ink, fontFamily: "-apple-system, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif" }}>
      <style>{`
        @keyframes ca-r { from { opacity: 0; transform: translateX(34px) } to { opacity: 1; transform: none } }
        @keyframes ca-l { from { opacity: 0; transform: translateX(-34px) } to { opacity: 1; transform: none } }
        @keyframes ca-flash { 0%,100% { opacity: 0 } 15%,55% { opacity: 1 } 35%,75% { opacity: .1 } }
        @keyframes ca-wave { 0% { opacity: 0 } 40% { opacity: 1 } 100% { opacity: 0; transform: translateY(-10px) } }
        @keyframes ca-glow { 0%,100% { opacity: .5 } 50% { opacity: 1 } }
        @keyframes ca-ripple { from { transform: scale(.6); opacity: .9 } to { transform: scale(2.6); opacity: 0 } }
        @keyframes ca-spin { to { transform: rotate(360deg) } }
        .ca-flash { animation: ca-flash 1.6s ease both }
        .ca-wave { animation: ca-wave 1.2s ease both }
        .ca-glow { animation: ca-glow 2.4s ease-in-out infinite }
        .ca-ripple { animation: ca-ripple 1.1s ease-out both }
        .ca-spin { animation: ca-spin 1.2s linear infinite }
        .ca-scroll { scrollbar-width: none } .ca-scroll::-webkit-scrollbar { display: none }
        .ca-app button:focus-visible, .ca-app [role=slider]:focus-visible, .ca-app [role=button]:focus-visible { outline: 2px solid ${accent}; outline-offset: 2px }
        @media (prefers-reduced-motion: reduce) { .ca-app *, .ca-app *::before { animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important } }
      `}</style>
      <StatusBar frame={frame} />
      <div key={`${tab}/${stack.map((s) => s.id + (s.tripId || '')).join('/')}`} className="ca-scroll" style={{ position: 'absolute', top: 54, bottom: tabbed ? 84 : 0, left: 0, right: 0, overflowY: 'auto', paddingBottom: 28, animation: `${dir > 0 ? 'ca-r' : 'ca-l'} .28s ease` }}>
        {body}
      </div>
      {tabbed && (
        <nav aria-label="Main" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 84, background: 'rgba(10,16,30,.86)', backdropFilter: 'blur(16px)', borderTop: `1px solid ${C.line}`, display: 'flex', justifyContent: 'space-around', padding: '10px 6px 0' }}>
          {NAV.map(([id, icon, label]) => (
            <button key={id} type="button" onClick={() => go(id)} aria-current={tab === id ? 'page' : undefined} style={{ position: 'relative', border: 'none', background: 'none', font: 'inherit', cursor: 'pointer', display: 'grid', justifyItems: 'center', alignContent: 'start', gap: 3, width: 68, height: 54, fontSize: 11, fontWeight: 600, color: tab === id ? accent : C.mute }}>
              {tab === id && <span style={{ position: 'absolute', top: -11, width: 26, height: 3, borderRadius: 2, background: accent }} />}
              <Icon name={icon} size={23} />
              {label}
            </button>
          ))}
        </nav>
      )}
      <div role="status" style={{ position: 'absolute', left: '50%', top: 58, zIndex: 30, transform: `translate(-50%, ${toast ? 0 : -90}px)`, transition: 'transform .35s cubic-bezier(.2,.8,.2,1)', padding: '10px 16px', borderRadius: 20, background: C.ink, color: '#0a1020', fontSize: 12.500, fontWeight: 700, whiteSpace: 'nowrap' }}>{toast}</div>
      <div style={{ position: 'absolute', left: '50%', bottom: 8, width: 140, height: 5, marginLeft: -70, borderRadius: 3, background: C.ink, opacity: 0.8, zIndex: 25 }} />
    </div>
  )

  return (
    <div ref={box} className="ca-app" style={{ position: 'relative', width: '100%', height: '100%', display: 'grid', placeItems: 'center', overflow: 'hidden', background: 'radial-gradient(ellipse at 50% 30%, #16213a, #04060c 75%)', ...style }}>
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
