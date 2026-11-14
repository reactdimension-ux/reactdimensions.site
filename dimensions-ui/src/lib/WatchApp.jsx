import { useEffect, useId, useRef, useState } from 'react'

// A smartwatch companion app on a phone, as a click-through prototype. The
// hero is a round watch drawn in SVG with a live analog and digital clock.
// Five tabs: Face (swipe the watch, turn its crown, or pick from a carousel of
// live face previews), Widgets (tap a slot on the watch, pick a widget, or turn
// the crown to cycle them; the face updates at once), Activity (Move,
// Exercise and Stand rings that animate, change when you log a workout, and
// open a goal editor), Apps (open an app on the watch, or Edit and remove and
// reinstall them) and Settings (wrist, 24-hour time, always-on display,
// brightness and strap colour all change the hero). The crown is a real drag
// control: drag it up or down, use the mouse wheel over it, or the arrow keys.
// The phone scales to fit whatever box it is in.

const W = 390
const H = 844
const C = { bg: '#eceff4', card: '#ffffff', ink: '#14161c', mute: '#7a8294', line: '#e3e7ee' }
const RING = ['#ff3b5c', '#9bf24a', '#2ad4ff'] // Move, Exercise, Stand

const pad = (n) => String(n).padStart(2, '0')

const ICONS = {
  watch: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM9 3h6l.5 3h-7zM9 21h6l.5-3h-7z',
  widgets: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  activity: 'M3 12h4l3-7 4 14 3-7h4',
  apps: 'M5 5h4v4H5zM15 5h4v4h-4zM5 15h4v4H5zM15 15h4v4h-4z',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12l2-1.5-2-3.5-2.3.7a7 7 0 0 0-1.7-1L14.5 4h-4l-.5 2.7a7 7 0 0 0-1.7 1L6 7l-2 3.5L6 12a7 7 0 0 0 0 2l-2 1.5L6 19l2.300-.7a7 7 0 0 0 1.700 1l.5 2.700h4l.5-2.700a7 7 0 0 0 1.700-1l2.300.7 2-3.500-2-1.500c.1-.7.1-1.300 0-2z',
  back: 'M15 5l-7 7 7 7',
  chev: 'M9 5l7 7-7 7',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  x: 'M6 6l12 12M18 6L6 18',
  check: 'M5 12l5 5 9-10',
  bell: 'M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4',
  workout: 'M3 12h2m14 0h2M5 8v8m14-8v8M8 6v12m8-12v12M8 12h8',
  heart: 'M12 20s-7-4.500-7-10a4 4 0 0 1 7-2.500A4 4 0 0 1 19 10c0 5.500-7 10-7 10z',
  music: 'M9 18V6l10-2v12M9 18a3 3 0 1 1-3-3 3 3 0 0 1 3 3zm10-2a3 3 0 1 1-3-3 3 3 0 0 1 3 3z',
  weather: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.500 1.500M17.500 17.500L19 19M5 19l1.500-1.500M17.500 6.500L19 5',
  timer: 'M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 9v4l2 2M10 2h4',
  maps: 'M12 21s-6-6-6-11a6 6 0 0 1 12 0c0 5-6 11-6 11zM12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  wallet: 'M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 10h18',
  breathe: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 3v3m0 12v3M3 12h3m12 0h3',
  messages: 'M4 5h16v11H9l-5 4z',
  sleep: 'M20 14A8 8 0 1 1 10 4a6.500 6.500 0 0 0 10 10z',
  camera: 'M4 8h4l2-3h4l2 3h4v11H4zM12 17a3.500 3.500 0 1 0 0-7 3.500 3.500 0 0 0 0 7z',
  torch: 'M8 3h8v5l-2 3v10h-4V11L8 8zM8 6h8',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  find: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
}

function Icon({ name, size = 22, color = 'currentColor', w = 1.9 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  )
}

const FACES = [
  ['classic', 'Classic'],
  ['modular', 'Modular'],
  ['minimal', 'Minimal'],
  ['neon', 'Neon'],
]
const THEME = {
  classic: { bg: '#0b0c10', fg: '#f4f4f6', dim: '#8c8f99', slot: '#1a1b22' },
  modular: { bg: '#0e1b2b', fg: '#ffffff', dim: '#7f93ad', slot: '#18304a' },
  minimal: { bg: '#eee7da', fg: '#1a1a1a', dim: '#80786b', slot: '#ddd3c1' },
  neon: { bg: '#08040f', fg: '#ffffff', dim: '#9a7fd0', slot: '#1c1031' },
}
// slot positions on the 94px-radius screen: [x, y, radius]
const SLOTS = {
  classic: { s1: [-40, -24, 19], s2: [40, -24, 19], s3: [-40, 38, 19], s4: [40, 38, 19] },
  modular: { s1: [-40, 12, 16], s2: [40, 12, 16], s3: [-40, 50, 16], s4: [40, 50, 16] },
  minimal: { s1: [0, -46, 14], s2: [46, 0, 14], s3: [0, 46, 14], s4: [-46, 0, 14] },
  neon: { s1: [-48, 48, 14], s2: [-16, 48, 14], s3: [16, 48, 14], s4: [48, 48, 14] },
}
const SLOT_IDS = ['s1', 's2', 's3', 's4']
const COMPS0 = {
  classic: { s1: 'weather', s2: 'heart', s3: 'steps', s4: 'battery' },
  modular: { s1: 'activity', s2: 'weather', s3: 'heart', s4: 'date' },
  minimal: { s1: 'date', s2: 'none', s3: 'battery', s4: 'none' },
  neon: { s1: 'heart', s2: 'steps', s3: 'activity', s4: 'battery' },
}
const WIDGETS = [
  ['weather', 'Weather', '#ffb020'],
  ['heart', 'Heart rate', '#ff3b5c'],
  ['steps', 'Steps', '#2ad4ff'],
  ['battery', 'Battery', '#4ade80'],
  ['activity', 'Activity rings', '#9bf24a'],
  ['date', 'Date', '#c084fc'],
  ['sunrise', 'Sunrise', '#fb923c'],
  ['none', 'Empty', '#9aa3b2'],
]

const APPS0 = [
  ['workout', 'Workout', '#ff6b3d', '#ff3b5c', 'workout'],
  ['heart', 'Heart', '#ff3b5c', '#b4003c', 'heart'],
  ['music', 'Music', '#fb7185', '#e11d48', 'music'],
  ['weather', 'Weather', '#38bdf8', '#2563eb', 'weather'],
  ['timer', 'Timer', '#fbbf24', '#f97316', 'timer'],
  ['maps', 'Maps', '#34d399', '#059669', 'maps'],
  ['wallet', 'Wallet', '#475569', '#1e293b', 'wallet'],
  ['breathe', 'Breathe', '#67e8f9', '#0ea5e9', 'breathe'],
  ['messages', 'Messages', '#4ade80', '#16a34a', 'messages'],
  ['sleep', 'Sleep', '#818cf8', '#4338ca', 'sleep'],
  ['camera', 'Camera', '#94a3b8', '#475569', 'camera'],
  ['torch', 'Torch', '#fde047', '#f59e0b', 'torch'],
]
const STRAPS = [
  ['Graphite', '#2b2f3a'],
  ['Coral', '#ff6a4d'],
  ['Ocean', '#2f6bff'],
  ['Forest', '#2fb67c'],
  ['Sand', '#c9a27a'],
]
// previous six days: Move kcal, Exercise min, Stand hours
const WEEK = [
  ['Fri', 540, 34, 12],
  ['Sat', 610, 41, 11],
  ['Sun', 330, 18, 9],
  ['Mon', 702, 47, 12],
  ['Tue', 488, 29, 10],
  ['Wed', 575, 33, 12],
]
const METRICS = [
  ['move', 'Move', 'kcal', 50],
  ['exercise', 'Exercise', 'min', 5],
  ['stand', 'Stand', 'hr', 1],
]

// ---------------------------------------------------------------- watch art

function RingsG({ vals, R, stroke, gap, on = true, ci = 0 }) {
  return vals.map((v, i) => {
    const col = RING[i + ci]
    const r = R - stroke / 2 - i * (stroke + gap)
    const L = 2 * Math.PI * r
    const f = on ? Math.max(0, Math.min(1, v)) : 0
    return (
      <g key={i} transform="rotate(-90)">
        <circle r={r} fill="none" stroke={col} strokeOpacity=".22" strokeWidth={stroke} />
        <circle r={r} fill="none" stroke={col} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={L} strokeDashoffset={L * (1 - f)} style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(.3,.8,.3,1)', opacity: f > 0.01 ? 1 : 0 }} />
      </g>
    )
  })
}

function Rings({ vals, size, stroke, gap = 4, label, ci = 0 }) {
  const [on, setOn] = useState(false)
  useEffect(() => {
    const id = setTimeout(() => setOn(true), 80)
    return () => clearTimeout(id)
  }, [])
  return (
    <svg width={size} height={size} viewBox={`${-size / 2} ${-size / 2} ${size} ${size}`} role="img" aria-label={label}>
      <RingsG vals={vals} R={size / 2} stroke={stroke} gap={gap} on={on} ci={ci} />
    </svg>
  )
}

function widgetData(kind, ctx) {
  switch (kind) {
    case 'weather': return { label: 'TEMP', value: '72°', color: '#ffb020' }
    case 'heart': return { label: 'BPM', value: String(ctx.hr), color: '#ff3b5c' }
    case 'steps': return { label: 'STEPS', value: `${(ctx.steps / 1000).toFixed(1)}k`, color: '#2ad4ff' }
    case 'battery': return { label: 'BATT', value: `${ctx.battery}%`, color: '#4ade80' }
    case 'date': return { label: ctx.now.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(), value: String(ctx.now.getDate()), color: '#c084fc' }
    case 'sunrise': return { label: 'RISE', value: '6:42', color: '#fb923c' }
    default: return null
  }
}

function AppView({ app, t, hr, playing, accent }) {
  const a = APPS0.find((x) => x[0] === app)
  const mm = `${pad(Math.floor(t / 60))}:${pad(t % 60)}`
  const txt = (y, size, s, fill = '#fff', w = 700) => <text y={y} fontSize={size} fontWeight={w} fill={fill} textAnchor="middle">{s}</text>
  if (app === 'torch') return <g><rect x="-100" y="-100" width="200" height="200" fill="#fff" />{txt(4, 11, 'Torch on', '#444')}</g>
  const left = Math.max(0, 300 - t)
  return (
    <g>
      <rect x="-100" y="-100" width="200" height="200" fill="#000" />
      {app === 'workout' && <>{txt(-40, 11, 'OUTDOOR RUN', '#ff6b3d')}{txt(8, 34, mm)}{txt(34, 11, `${hr} bpm · ${(t * 0.0032).toFixed(2)} km`, '#aaa', 600)}</>}
      {app === 'timer' && <><circle r="52" fill="none" stroke="#fbbf24" strokeOpacity=".2" strokeWidth="6" /><circle r="52" fill="none" stroke="#fbbf24" strokeWidth="6" strokeLinecap="round" strokeDasharray={326.7} strokeDashoffset={326.7 * (1 - left / 300)} transform="rotate(-90)" />{txt(8, 26, `${pad(Math.floor(left / 60))}:${pad(left % 60)}`)}</>}
      {app === 'heart' && <><g transform={`scale(${1 + (t % 2) * 0.12})`}><path d="M0 28 C-40 2 -26 -30 0 -14 C26 -30 40 2 0 28Z" fill="#ff3b5c" /></g>{txt(52, 18, `${hr} BPM`)}</>}
      {app === 'music' && <><circle cx="0" cy="-22" r="26" fill={playing ? accent : '#444'} />{txt(-17, 22, '♪', '#000')}{txt(22, 12, 'Midnight Drive')}{txt(36, 9, 'Neon Coast', '#888', 500)}{txt(58, 14, playing ? 'Playing' : 'Paused', playing ? accent : '#888')}</>}
      {app === 'weather' && <>{txt(-20, 44, '72°')}{txt(8, 13, 'Sunny', '#ffb020')}{txt(32, 10, 'H 75°  L 61°', '#9aa', 500)}</>}
      {app === 'breathe' && <><circle r={26 + 18 * Math.abs(Math.sin(t / 2.2))} fill="#0ea5e9" fillOpacity=".5" stroke="#67e8f9" strokeWidth="2" />{txt(4, 11, Math.sin(t / 2.2) > 0 ? 'Breathe in' : 'Breathe out')}</>}
      {app === 'wallet' && <><rect x="-52" y="-34" width="104" height="66" rx="10" fill="#334155" />{txt(-6, 11, 'Travel Credit')}{txt(14, 9, '•••• 1190', '#cbd5e1', 500)}</>}
      {app === 'messages' && <>{txt(-26, 11, 'Ava Chen', '#4ade80')}{txt(-4, 11, 'Lunch at 1?', '#fff', 500)}{txt(30, 10, 'Reply ▸ Yes · No', '#9aa', 500)}</>}
      {app === 'sleep' && <>{txt(-8, 30, '7h 24m')}{txt(18, 10, 'Slept last night', '#a5b4fc', 500)}</>}
      {app === 'maps' && <><path d="M-60 30 L-20 -10 L10 10 L52 -34" fill="none" stroke="#34d399" strokeWidth="4" strokeLinecap="round" /><circle cx="52" cy="-34" r="6" fill="#fff" />{txt(52, 11, 'Home · 12 min')}</>}
      {app === 'camera' && <><circle r="30" fill="none" stroke="#fff" strokeWidth="4" />{txt(4, 11, 'Shutter')}</>}
      {!['workout', 'timer', 'heart', 'music', 'weather', 'breathe', 'wallet', 'messages', 'sleep', 'maps', 'camera'].includes(app) && txt(4, 14, a?.[1] || app)}
    </g>
  )
}

// A round watch: strap, case, and a live face. `bare` draws only the case.
function Watch({ face = 'classic', comps, now, hr, steps, battery, fr, strap, h24, accent, bare, selected, onSlot, app, appT, playing, awake = true, bright = 1, label }) {
  const uid = useId().replace(/\W/g, '')
  const th = THEME[face]
  const slots = SLOTS[face]
  const h = now.getHours()
  const m = now.getMinutes()
  const s = now.getSeconds()
  const ang = { h: ((h % 12) + m / 60) * 30, m: (m + s / 60) * 6, s: s * 6 }
  const hm = h24 ? `${pad(h)}:${pad(m)}` : `${h % 12 || 12}:${pad(m)}`
  const ctx = { hr, steps, battery, now }
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' }).toUpperCase()
  const analog = face === 'classic' || face === 'minimal'

  const slotEls = SLOT_IDS.map((id) => {
    const [x, y, r] = slots[id]
    const kind = comps[id]
    const d = kind === 'activity' ? null : widgetData(kind, ctx)
    const col = d?.color || RING[1]
    return (
      <g
        key={id}
        transform={`translate(${x} ${y})`}
        onClick={onSlot ? () => onSlot(id) : undefined}
        onKeyDown={onSlot ? (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onSlot(id)) : undefined}
        role={onSlot ? 'button' : undefined}
        tabIndex={onSlot ? 0 : undefined}
        aria-label={onSlot ? `Slot ${id.slice(1)}: ${kind}` : undefined}
        style={{ cursor: onSlot ? 'pointer' : 'default', outline: 'none' }}
      >
        {kind === 'none' ? (
          <circle r={r} fill="none" stroke={th.dim} strokeOpacity=".5" strokeDasharray="3 3" />
        ) : (
          <circle r={r} fill={th.slot} stroke={col} strokeOpacity=".75" strokeWidth="1.4" />
        )}
        {kind === 'none' && onSlot && <text y={r * 0.3} fontSize={r * 0.8} fill={th.dim} textAnchor="middle">{id.slice(1)}</text>}
        {kind === 'activity' && <RingsG vals={fr} R={r - 3} stroke={3} gap={1} />}
        {d && (
          <>
            <text y={-r * 0.08} fontSize={r * 0.62} fontWeight="700" fill={th.fg} textAnchor="middle">{d.value}</text>
            <text y={r * 0.56} fontSize={r * 0.3} fontWeight="700" fill={col} textAnchor="middle" letterSpacing=".04em">{d.label}</text>
          </>
        )}
        {onSlot && <circle r={r + 5} fill="transparent" />}
      </g>
    )
  })

  const hand = (a, len, w, col, tail = 0) => <line x1="0" y1={tail} x2="0" y2={-len} stroke={col} strokeWidth={w} strokeLinecap="round" transform={`rotate(${a})`} style={{ pointerEvents: 'none' }} />

  const faceEls = (
    <g>
      <circle r="94" fill={th.bg} />
      {face === 'modular' && <circle r="94" fill={`url(#mod${uid})`} />}
      {face === 'neon' && (
        <>
          <circle r="88" fill="none" stroke="#a855f7" strokeOpacity=".22" strokeWidth="4" />
          <circle r="88" fill="none" stroke="#22d3ee" strokeWidth="4" strokeLinecap="round" strokeDasharray="552.9" strokeDashoffset={552.9 * (1 - s / 60)} transform="rotate(-90)" style={{ transition: s === 0 ? 'none' : 'stroke-dashoffset 1s linear' }} />
        </>
      )}
      {analog &&
        Array.from({ length: 60 }, (_, i) => {
          const big = i % 5 === 0
          if (face === 'minimal' && !big) return null
          return <line key={i} x1="0" y1={-(big ? 80 : 86)} x2="0" y2="-91" stroke={big ? th.fg : th.dim} strokeWidth={big ? (face === 'minimal' ? 2.4 : 2.2) : 0.9} transform={`rotate(${i * 6})`} />
        })}
      {face === 'classic' && <text y="68" fontSize="10" fontWeight="600" fill={th.dim} textAnchor="middle" letterSpacing=".08em">{hm}</text>}
      {face === 'modular' && (
        <>
          <text y="-58" fontSize="9" fontWeight="700" fill={accent} textAnchor="middle" letterSpacing=".1em">{dateStr}</text>
          <text y="-26" fontSize="42" fontWeight="800" fill={th.fg} textAnchor="middle" style={{ fontVariantNumeric: 'tabular-nums' }}>{hm}</text>
          <text y="-10" fontSize="9" fill={th.dim} textAnchor="middle">:{pad(s)}</text>
        </>
      )}
      {face === 'neon' && (
        <>
          <text y="-44" fontSize="9" fontWeight="700" fill="#22d3ee" textAnchor="middle" letterSpacing=".12em">{dateStr}</text>
          <text y="-8" fontSize="40" fontWeight="800" fill={th.fg} textAnchor="middle" style={{ fontVariantNumeric: 'tabular-nums' }}>{hm}</text>
          <text y="12" fontSize="11" fontWeight="700" fill="#a855f7" textAnchor="middle">{pad(s)}</text>
        </>
      )}
      {slotEls}
      {analog && (
        <>
          {hand(ang.h, 46, 4.2, th.fg)}
          {hand(ang.m, 68, 3, th.fg)}
          {hand(ang.s, 76, 1.4, accent, 14)}
          <circle r="4" fill={accent} />
          <circle r="1.6" fill={th.bg} />
        </>
      )}
      {selected && SLOT_IDS.includes(selected) && (
        <circle className="wa-pulse" cx={slots[selected][0]} cy={slots[selected][1]} r={slots[selected][2] + 4} fill="none" stroke={accent} strokeWidth="2.4" strokeDasharray="4 3" style={{ pointerEvents: 'none' }} />
      )}
    </g>
  )

  return (
    <svg viewBox={bare ? '22 52 216 216' : '0 0 260 320'} width="100%" style={{ display: 'block', overflow: 'hidden' }} role="img" aria-label={label || `${face} watch face showing ${hm}`}>
      <defs>
        <linearGradient id={`case${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#d5d8df" />
          <stop offset=".45" stopColor="#6b7080" />
          <stop offset="1" stopColor="#2a2d36" />
        </linearGradient>
        <linearGradient id={`shade${uid}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#000" stopOpacity=".28" />
          <stop offset=".5" stopColor="#fff" stopOpacity=".12" />
          <stop offset="1" stopColor="#000" stopOpacity=".28" />
        </linearGradient>
        <radialGradient id={`mod${uid}`} cx=".3" cy=".2" r="1">
          <stop offset="0" stopColor="#2a4a72" stopOpacity=".55" />
          <stop offset="1" stopColor="#0e1b2b" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`glass${uid}`} cx=".3" cy=".2" r=".9">
          <stop offset="0" stopColor="#fff" stopOpacity=".22" />
          <stop offset=".5" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <clipPath id={`scr${uid}`}>
          <circle r="94" />
        </clipPath>
      </defs>
      {!bare && (
        <>
          <path d="M90 -10 L170 -10 L178 78 L82 78Z" fill={strap} />
          <path d="M90 -10 L170 -10 L178 78 L82 78Z" fill={`url(#shade${uid})`} />
          <path d="M82 242 L178 242 L170 330 L90 330Z" fill={strap} />
          <path d="M82 242 L178 242 L170 330 L90 330Z" fill={`url(#shade${uid})`} />
          {[262, 276, 290, 304].map((y) => <circle key={y} cx="130" cy={y} r="3" fill="#000" fillOpacity=".35" />)}
        </>
      )}
      <circle cx="130" cy="160" r="108" fill={`url(#case${uid})`} />
      <circle cx="130" cy="160" r="99" fill="#050507" stroke="#000" />
      <g transform="translate(130 160)" clipPath={`url(#scr${uid})`}>
        <g style={{ filter: `brightness(${bright})`, opacity: awake ? 1 : 0.14, transition: 'opacity .5s' }}>
          {app ? <AppView app={app} t={appT} hr={hr} playing={playing} accent={accent} /> : faceEls}
        </g>
        <circle r="94" fill={`url(#glass${uid})`} style={{ pointerEvents: 'none' }} />
      </g>
    </svg>
  )
}

// A knurled crown: drag it up or down, use the wheel over it, or the arrow keys.
function Crown({ side, onTurn, label }) {
  const [rot, setRot] = useState(0)
  const acc = useRef(0)
  const last = useRef(null)
  const STEP = 22
  const move = (dy) => {
    setRot((r) => r + dy)
    acc.current += dy
    while (Math.abs(acc.current) >= STEP) {
      const sgn = Math.sign(acc.current)
      acc.current -= sgn * STEP
      onTurn(sgn)
    }
  }
  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(((rot % 200) + 200) % 200) / 2}
      onPointerDown={(e) => (last.current = e.clientY, e.currentTarget.setPointerCapture?.(e.pointerId))}
      onPointerMove={(e) => {
        if (last.current == null) return
        const dy = e.clientY - last.current
        last.current = e.clientY
        move(dy)
      }}
      onPointerUp={() => (last.current = null)}
      onPointerCancel={() => (last.current = null)}
      onWheel={(e) => move(Math.sign(e.deltaY) * 11)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowRight') (e.preventDefault(), move(-STEP))
        if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') (e.preventDefault(), move(STEP))
      }}
      style={{ position: 'absolute', top: '50%', marginTop: -30, [side === 'right' ? 'right' : 'left']: '-1%', width: 16, height: 60, borderRadius: 6, cursor: 'ns-resize', touchAction: 'none', background: 'repeating-linear-gradient(180deg, #c9ccd4 0 2px, #5a5e6b 2px 5px)', backgroundPositionY: rot, boxShadow: '0 2px 6px rgba(0,0,0,.4), inset 0 0 0 1px rgba(0,0,0,.35)' }}
    />
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
  ['face', 'watch', 'Face'],
  ['complications', 'widgets', 'Widgets'],
  ['activity', 'activity', 'Activity'],
  ['apps', 'apps', 'Apps'],
  ['settings', 'gear', 'Settings'],
]
const PAGES = NAV.map((n) => n[0])

const circ = { width: 38, height: 38, display: 'grid', placeItems: 'center', border: 'none', borderRadius: '50%', cursor: 'pointer', padding: 0, color: C.ink, flex: 'none', background: '#fff' }
const cardS = { margin: '0 18px', padding: '4px 16px', background: C.card, borderRadius: 22, boxShadow: '0 1px 0 rgba(20,22,28,.04), 0 8px 24px rgba(20,22,28,.05)' }
const rowS = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '13px 0', borderBottom: `1px solid ${C.line}`, fontSize: 14 }

// ---------------------------------------------------------------- app

export default function WatchApp({ name = 'Orbit', accent = '#ff5a36', startScreen = 'face', frame = true, style }) {
  const box = useRef()
  const toastTimer = useRef()
  const awakeTimer = useRef()
  const strip = useRef()
  const swipe = useRef(null)
  const [scale, setScale] = useState(1)
  const [tab, setTab] = useState(PAGES.includes(startScreen) ? startScreen : 'face')
  const [stack, setStack] = useState([])
  const [dir, setDir] = useState(1)
  const [toast, setToast] = useState('')
  const [now, setNow] = useState(() => new Date())
  const [hr, setHr] = useState(68)
  const [faceIdx, setFaceIdx] = useState(0)
  const [comps, setComps] = useState(COMPS0)
  const [slot, setSlot] = useState('s1')
  const [act, setAct] = useState({ move: 412, exercise: 21, stand: 8 })
  const [goals, setGoals] = useState({ move: 600, exercise: 30, stand: 12 })
  const [day, setDay] = useState(6)
  const [apps, setApps] = useState(APPS0.map((a) => a[0]))
  const [edit, setEdit] = useState(false)
  const [playing, setPlaying] = useState(true)
  const [wrist, setWrist] = useState('right')
  const [h24, setH24] = useState(false)
  const [aod, setAod] = useState(true)
  const [bright, setBright] = useState(1)
  const [strapIdx, setStrapIdx] = useState(2)
  const [haptic, setHaptic] = useState(true)
  const [awake, setAwake] = useState(true)
  const [ping, setPing] = useState(false)

  const face = FACES[faceIdx][0]
  const strap = STRAPS[strapIdx][1]
  const steps = Math.round(act.move * 14.6)
  const fr = [act.move / goals.move, act.exercise / goals.exercise, act.stand / goals.stand]

  useEffect(() => {
    setTab(PAGES.includes(startScreen) ? startScreen : 'face')
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

  useEffect(() => {
    const a = setInterval(() => setNow(new Date()), 1000)
    const b = setInterval(() => setHr((v) => Math.max(58, Math.min(84, v + Math.round(Math.random() * 6 - 3)))), 2500)
    return () => (clearInterval(a), clearInterval(b))
  }, [])

  const say = (t) => {
    setToast(t)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 1900)
  }
  // with always-on display off, the watch screen sleeps after a few seconds
  const wake = () => {
    setAwake(true)
    clearTimeout(awakeTimer.current)
    if (!aod) awakeTimer.current = setTimeout(() => setAwake(false), 7000)
  }
  useEffect(() => {
    wake()
    return () => clearTimeout(awakeTimer.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aod])
  useEffect(() => () => clearTimeout(toastTimer.current), [])

  // keep the selected face centred in the carousel
  useEffect(() => {
    const el = strip.current?.children[faceIdx]
    if (el && strip.current) strip.current.scrollTo({ left: el.offsetLeft - (strip.current.clientWidth - el.offsetWidth) / 2, behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  }, [faceIdx, tab])

  const top = stack[stack.length - 1]
  const push = (s) => (setDir(1), setStack((a) => [...a, s]))
  const pop = () => (setDir(-1), setStack((a) => a.slice(0, -1)))
  const go = (t) => (setDir(PAGES.indexOf(t) > PAGES.indexOf(tab) ? 1 : -1), setTab(t), setStack([]), setEdit(false))

  const buzz = () => {
    if (haptic) try { navigator.vibrate?.(8) } catch { /* not supported */ }
  }
  const pickFace = (i) => {
    setFaceIdx(((i % 4) + 4) % 4)
    wake()
  }
  const crownFace = (s) => (buzz(), pickFace(faceIdx + s))
  const setWidget = (id, kind) => setComps((c) => ({ ...c, [face]: { ...c[face], [id]: kind } }))
  const crownWidget = (s) => {
    buzz()
    wake()
    const cur = WIDGETS.findIndex((w) => w[0] === comps[face][slot])
    setWidget(slot, WIDGETS[(cur + s + WIDGETS.length) % WIDGETS.length][0])
  }

  const addAct = (d, msg) => {
    setAct((a) => ({ move: a.move + (d.move || 0), exercise: a.exercise + (d.exercise || 0), stand: Math.min(goals.stand + 4, a.stand + (d.stand || 0)) }))
    say(msg)
    wake()
  }

  const watchProps = { now, hr, steps, battery: 82, fr, strap, h24, accent, awake, bright }

  const header = (title, back, right) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 18px 8px', minHeight: 52 }}>
      {back && (
        <button type="button" onClick={back} aria-label="Back" style={circ}>
          <Icon name="back" size={20} />
        </button>
      )}
      <h1 style={{ margin: 0, flex: 1, fontSize: back ? 18 : 28, fontWeight: 800, letterSpacing: '-0.02em', marginLeft: 4 }}>{title}</h1>
      {right}
    </div>
  )
  const toggle = (on, set, label) => (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => set(!on)} style={{ width: 48, height: 28, borderRadius: 14, border: 'none', padding: 3, background: on ? accent : '#cdd3de', cursor: 'pointer', transition: 'background .2s', flex: 'none' }}>
      <span style={{ display: 'block', width: 22, height: 22, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.25)', transform: `translateX(${on ? 20 : 0}px)`, transition: 'transform .2s' }} />
    </button>
  )
  const pill = (label, onClick, kind = 'solid', icon) => (
    <button type="button" onClick={onClick} style={{ flex: 1, height: 48, borderRadius: 24, border: kind === 'solid' ? 'none' : `1px solid ${C.line}`, background: kind === 'solid' ? accent : '#fff', color: kind === 'solid' ? '#fff' : C.ink, font: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
      {icon && <Icon name={icon} size={18} />} {label}
    </button>
  )
  const stage = { margin: '4px 18px 0', borderRadius: 32, background: 'radial-gradient(ellipse at 50% 35%, #ffffff, #d9dee8 80%)', boxShadow: 'inset 0 0 0 1px rgba(20,22,28,.05)', position: 'relative', overflow: 'hidden' }

  // ---- screens
  let body
  let tabbed = true
  if (top?.id === 'app') {
    tabbed = false
    const a = APPS0.find((x) => x[0] === top.app)
    const t = Math.max(0, Math.floor((now.getTime() - top.t0) / 1000))
    body = (
      <>
        {header(a[1], pop)}
        <div style={{ ...stage, padding: '10px 0 6px' }} onPointerDown={wake}>
          <div style={{ position: 'relative', width: 220, margin: '0 auto' }}>
            <Watch {...watchProps} face={face} comps={comps[face]} app={a[0]} appT={t} playing={playing} label={`${a[1]} open on the watch`} />
            <Crown side={wrist} onTurn={() => buzz()} label="Watch crown" />
          </div>
        </div>
        <div style={{ padding: '16px 18px', display: 'grid', gap: 10 }}>
          <div style={{ textAlign: 'center', fontSize: 13, color: C.mute }}>{a[1]} is open on your watch · {Math.floor(t / 60)}:{pad(t % 60)}</div>
          {a[0] === 'music' && <div style={{ display: 'flex' }}>{pill(playing ? 'Pause' : 'Play', () => setPlaying((p) => !p), 'solid', 'music')}</div>}
          <div style={{ display: 'flex', gap: 10 }}>
            {pill('Back to face', () => go('face'), 'ghost', 'watch')}
            {pill('Remove', () => (setApps((l) => l.filter((x) => x !== a[0])), pop(), say(`${a[1]} removed`)), 'ghost', 'x')}
          </div>
        </div>
      </>
    )
  } else if (top?.id === 'ring') {
    tabbed = false
    const [key, label, unit, step] = METRICS.find((m) => m[0] === top.key)
    const i = METRICS.findIndex((m) => m[0] === top.key)
    const bars = [...WEEK.map((w) => w[i + 1]), act[key]]
    const max = Math.max(...bars, goals[key])
    body = (
      <>
        {header(label, pop)}
        <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
          <div style={{ display: 'inline-block' }}>
            <Rings vals={[act[key] / goals[key]]} size={180} stroke={22} label={`${label} ring`} ci={i} />
          </div>
        </div>
        <div style={{ textAlign: 'center', fontSize: 34, fontWeight: 800, letterSpacing: '-0.03em', color: RING[i] === '#9bf24a' ? '#5a9a1c' : RING[i] }}>{act[key]}<span style={{ fontSize: 16, color: C.mute }}> / {goals[key]} {unit}</span></div>
        <div style={{ ...cardS, margin: '16px 18px 0', padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 700 }}>Daily goal</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button type="button" aria-label="Lower goal" onClick={() => setGoals((g) => ({ ...g, [key]: Math.max(step, g[key] - step) }))} style={{ ...circ, background: '#eef1f6' }}><Icon name="minus" size={18} /></button>
              <b style={{ minWidth: 70, textAlign: 'center', fontSize: 17 }}>{goals[key]} {unit}</b>
              <button type="button" aria-label="Raise goal" onClick={() => setGoals((g) => ({ ...g, [key]: g[key] + step }))} style={{ ...circ, background: '#eef1f6' }}><Icon name="plus" size={18} /></button>
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 90, marginTop: 18 }}>
            {bars.map((v, j) => (
              <div key={j} style={{ flex: 1, display: 'grid', justifyItems: 'center', gap: 4 }}>
                <div style={{ width: '100%', height: Math.max(4, (v / max) * 70), borderRadius: 6, background: j === 6 ? RING[i] : `${RING[i]}66`, transition: 'height .6s' }} />
                <span style={{ fontSize: 10.500, color: C.mute }}>{j === 6 ? 'Today' : WEEK[j][0]}</span>
              </div>
            ))}
          </div>
        </div>
      </>
    )
  } else if (tab === 'face') {
    body = (
      <>
        {header('Watch', null, <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.500, fontWeight: 700, color: '#15803d', background: '#dcfce7', padding: '6px 11px', borderRadius: 16 }}><i style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e' }} /> Connected · 82%</span>)}
        <div
          style={stage}
          onPointerDown={(e) => (swipe.current = e.clientX, wake())}
          onPointerUp={(e) => {
            if (swipe.current == null) return
            const dx = e.clientX - swipe.current
            swipe.current = null
            if (Math.abs(dx) > 40) pickFace(faceIdx + (dx < 0 ? 1 : -1))
          }}
        >
          <div className={ping ? 'wa-ping' : ''} style={{ position: 'relative', width: 240, margin: '8px auto 0', touchAction: 'pan-y' }}>
            <Watch {...watchProps} face={face} comps={comps[face]} label={`${FACES[faceIdx][1]} watch face`} />
            <Crown side={wrist} onTurn={crownFace} label="Watch crown. Turn to change face" />
          </div>
          <div style={{ textAlign: 'center', padding: '0 0 14px', fontSize: 13, color: C.mute }}>
            <b style={{ color: C.ink, fontSize: 15 }}>{FACES[faceIdx][1]}</b> · swipe the watch or turn the crown
          </div>
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.mute, padding: '16px 22px 8px', letterSpacing: '.04em', textTransform: 'uppercase' }}>Watch faces</div>
        <div ref={strip} className="wa-scroll" style={{ display: 'flex', gap: 12, padding: '0 18px', overflowX: 'auto', scrollSnapType: 'x mandatory' }}>
          {FACES.map(([id, label], i) => (
            <button key={id} type="button" onClick={() => (pickFace(i), say(`${label} face set`))} aria-pressed={faceIdx === i} style={{ flex: 'none', width: 104, padding: 8, borderRadius: 22, border: `2px solid ${faceIdx === i ? accent : 'transparent'}`, background: '#fff', font: 'inherit', cursor: 'pointer', scrollSnapAlign: 'center', color: C.ink, boxShadow: '0 4px 14px rgba(20,22,28,.07)' }}>
              <Watch {...watchProps} face={id} comps={comps[id]} bare label={`${label} preview`} />
              <span style={{ display: 'block', fontSize: 12.500, fontWeight: 700, marginTop: 4 }}>{label}</span>
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, padding: '16px 18px 0' }}>
          {pill('Edit widgets', () => go('complications'), 'solid', 'widgets')}
          {pill('Find watch', () => (setPing(true), setTimeout(() => setPing(false), 1600), say('Watch is pinging…')), 'ghost', 'find')}
        </div>
      </>
    )
  } else if (tab === 'complications') {
    const cur = comps[face][slot]
    body = (
      <>
        {header('Widgets', null, <span style={{ fontSize: 13, fontWeight: 700, color: C.mute }}>{FACES[faceIdx][1]} face</span>)}
        <div style={stage} onPointerDown={wake}>
          <div style={{ position: 'relative', width: 212, margin: '6px auto 0' }}>
            <Watch {...watchProps} face={face} comps={comps[face]} selected={slot} onSlot={(id) => (setSlot(id), wake())} label="Watch face with editable widget slots" />
            <Crown side={wrist} onTurn={crownWidget} label="Watch crown. Turn to change the selected widget" />
          </div>
          <div style={{ textAlign: 'center', padding: '0 0 12px', fontSize: 12.500, color: C.mute }}>Tap a slot on the watch · turn the crown to cycle widgets</div>
        </div>
        <div style={{ display: 'flex', gap: 8, padding: '14px 18px 4px' }} role="tablist" aria-label="Slot">
          {SLOT_IDS.map((id) => (
            <button key={id} type="button" role="tab" aria-selected={slot === id} onClick={() => setSlot(id)} style={{ flex: 1, height: 38, borderRadius: 19, border: 'none', background: slot === id ? C.ink : '#fff', color: slot === id ? '#fff' : C.ink, font: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Slot {id.slice(1)}</button>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '10px 18px 0' }}>
          {WIDGETS.map(([k, label, col]) => {
            const d = widgetData(k, { hr, steps, battery: 82, now })
            const on = cur === k
            return (
              <button key={k} type="button" onClick={() => (setWidget(slot, k), wake(), say(`${label} → slot ${slot.slice(1)}`))} aria-pressed={on} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 18, border: `2px solid ${on ? accent : 'transparent'}`, background: '#fff', font: 'inherit', textAlign: 'left', cursor: 'pointer', color: C.ink }}>
                <span style={{ width: 38, height: 38, borderRadius: '50%', display: 'grid', placeItems: 'center', background: `${col}26`, color: col, fontWeight: 800, fontSize: 11.500, flex: 'none' }}>
                  {k === 'activity' ? <Rings vals={fr} size={26} stroke={3} gap={1} label="Rings" /> : d ? d.value : '·'}
                </span>
                <span style={{ fontSize: 13.500, fontWeight: 700, flex: 1 }}>{label}</span>
                {on && <Icon name="check" size={17} color={accent} w={2.600} />}
              </button>
            )
          })}
        </div>
        <div style={{ padding: '14px 18px 0', display: 'flex' }}>
          {pill('Reset this face', () => (setComps((c) => ({ ...c, [face]: COMPS0[face] })), say('Widgets reset')), 'ghost')}
        </div>
      </>
    )
  } else if (tab === 'activity') {
    const sel = day === 6 ? act : { move: WEEK[day][1], exercise: WEEK[day][2], stand: WEEK[day][3] }
    const sfr = [sel.move / goals.move, sel.exercise / goals.exercise, sel.stand / goals.stand]
    const dayName = day === 6 ? 'Today' : WEEK[day][0]
    const dayKey = `${day}`
    body = (
      <>
        {header('Activity')}
        <div style={{ ...cardS, padding: '16px 16px 12px', textAlign: 'center' }}>
          <div key={dayKey} style={{ display: 'inline-block' }}>
            <Rings vals={sfr} size={210} stroke={24} gap={4} label={`${dayName} activity rings`} />
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.mute, margin: '4px 0 10px' }}>{dayName}{sfr.every((f) => f >= 1) ? ' · all rings closed!' : ''}</div>
          <div style={{ display: 'grid', gap: 2 }}>
            {METRICS.map(([k, label, unit], i) => (
              <button key={k} type="button" onClick={() => push({ id: 'ring', key: k })} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 6px', border: 'none', borderRadius: 14, background: 'none', font: 'inherit', cursor: 'pointer', color: C.ink, textAlign: 'left' }}>
                <i style={{ width: 12, height: 12, borderRadius: '50%', background: RING[i] }} />
                <span style={{ fontWeight: 700, flex: 1 }}>{label}</span>
                <span style={{ fontSize: 15, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{sel[k]}<span style={{ color: C.mute, fontWeight: 600 }}>/{goals[k]} {unit}</span></span>
                <Icon name="chev" size={16} color={C.mute} />
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, padding: '14px 18px 4px' }} role="tablist" aria-label="Day">
          {[...WEEK.map((w) => w[0]), 'Today'].map((d, i) => (
            <button key={d} type="button" role="tab" aria-selected={day === i} onClick={() => setDay(i)} style={{ flex: 1, height: 42, borderRadius: 14, border: 'none', background: day === i ? C.ink : '#fff', color: day === i ? '#fff' : C.ink, font: 'inherit', fontSize: 11.500, fontWeight: 700, cursor: 'pointer' }}>{d === 'Today' ? 'Now' : d}</button>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, padding: '10px 18px 0', opacity: day === 6 ? 1 : 0.45 }}>
          {[
            ['Walk 10 min', { move: 55, exercise: 10 }, 'Walk logged: +55 kcal, +10 min'],
            ['Run 20 min', { move: 210, exercise: 20 }, 'Run logged: +210 kcal, +20 min'],
            ['Stand up', { stand: 1 }, 'Stood up: +1 hour'],
          ].map(([l, d, msg]) => (
            <button key={l} type="button" disabled={day !== 6} onClick={() => addAct(d, msg)} style={{ height: 52, borderRadius: 18, border: 'none', background: '#fff', font: 'inherit', fontSize: 12.500, fontWeight: 700, cursor: day === 6 ? 'pointer' : 'default', color: C.ink, boxShadow: '0 4px 14px rgba(20,22,28,.06)' }}>{l}</button>
          ))}
        </div>
        {day !== 6 && <div style={{ textAlign: 'center', fontSize: 12, color: C.mute, padding: '8px 0' }}>Select Now to log activity.</div>}
      </>
    )
  } else if (tab === 'apps') {
    const inst = apps.map((id) => APPS0.find((a) => a[0] === id))
    const avail = APPS0.filter((a) => !apps.includes(a[0]))
    body = (
      <>
        {header('Apps', null, <button type="button" onClick={() => setEdit((e) => !e)} style={{ height: 36, padding: '0 16px', borderRadius: 18, border: 'none', background: edit ? accent : '#fff', color: edit ? '#fff' : C.ink, font: 'inherit', fontSize: 13.500, fontWeight: 700, cursor: 'pointer' }}>{edit ? 'Done' : 'Edit'}</button>)}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '18px 8px', padding: '10px 18px 0' }}>
          {inst.map((a) => (
            <div key={a[0]} style={{ position: 'relative', display: 'grid', justifyItems: 'center', gap: 6 }}>
              <button type="button" className={edit ? 'wa-jig' : ''} onClick={() => (edit ? null : push({ id: 'app', app: a[0], t0: Date.now() }))} aria-label={`Open ${a[1]}`} style={{ width: 66, height: 66, borderRadius: '50%', border: 'none', background: `linear-gradient(145deg, ${a[2]}, ${a[3]})`, color: '#fff', display: 'grid', placeItems: 'center', cursor: 'pointer', boxShadow: `0 8px 18px ${a[3]}55` }}>
                <Icon name={a[4]} size={30} w={1.8} />
              </button>
              <span style={{ fontSize: 11.500, fontWeight: 600 }}>{a[1]}</span>
              {edit && (
                <button type="button" aria-label={`Remove ${a[1]}`} onClick={() => (setApps((l) => l.filter((x) => x !== a[0])), say(`${a[1]} removed`))} style={{ position: 'absolute', top: -4, left: 2, width: 24, height: 24, borderRadius: '50%', border: '2px solid #fff', background: '#ef4444', color: '#fff', display: 'grid', placeItems: 'center', cursor: 'pointer', padding: 0 }}>
                  <Icon name="minus" size={13} w={3} />
                </button>
              )}
            </div>
          ))}
        </div>
        {!inst.length && <div style={{ textAlign: 'center', color: C.mute, padding: '30px 0', fontSize: 14 }}>No apps on your watch.</div>}
        {avail.length > 0 && (
          <>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.mute, padding: '24px 22px 8px', letterSpacing: '.04em', textTransform: 'uppercase' }}>Available</div>
            <div style={{ ...cardS, padding: '2px 14px' }}>
              {avail.map((a, i) => (
                <div key={a[0]} style={{ ...rowS, borderBottom: i === avail.length - 1 ? 'none' : rowS.borderBottom }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 12, fontWeight: 600 }}>
                    <span style={{ width: 36, height: 36, borderRadius: '50%', display: 'grid', placeItems: 'center', background: `linear-gradient(145deg, ${a[2]}, ${a[3]})`, color: '#fff' }}><Icon name={a[4]} size={18} /></span>
                    {a[1]}
                  </span>
                  <button type="button" onClick={() => (setApps((l) => [...l, a[0]]), say(`${a[1]} installed`))} style={{ height: 32, padding: '0 16px', borderRadius: 16, border: 'none', background: '#eef1f6', font: 'inherit', fontSize: 13, fontWeight: 700, color: accent, cursor: 'pointer' }}>Get</button>
                </div>
              ))}
            </div>
          </>
        )}
      </>
    )
  } else {
    body = (
      <>
        {header('Settings')}
        <div style={cardS}>
          <div style={{ ...rowS, flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
            <span style={{ fontWeight: 600 }}>Worn on</span>
            <div role="radiogroup" aria-label="Wrist" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, padding: 3, borderRadius: 14, background: '#eef1f6' }}>
              {['left', 'right'].map((w) => (
                <button key={w} type="button" role="radio" aria-checked={wrist === w} onClick={() => (setWrist(w), say(`Crown on the ${w === 'right' ? 'right' : 'left'}`))} style={{ height: 36, border: 'none', borderRadius: 11, background: wrist === w ? '#fff' : 'transparent', boxShadow: wrist === w ? '0 1px 4px rgba(0,0,0,.12)' : 'none', color: C.ink, font: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer', textTransform: 'capitalize' }}>{w} wrist</button>
              ))}
            </div>
          </div>
          <div style={rowS}><span style={{ fontWeight: 600 }}>24-hour time</span>{toggle(h24, setH24, '24-hour time')}</div>
          <div style={rowS}><span style={{ fontWeight: 600 }}>Always-on display</span>{toggle(aod, setAod, 'Always-on display')}</div>
          <div style={rowS}><span style={{ fontWeight: 600 }}>Haptic crown ticks</span>{toggle(haptic, setHaptic, 'Haptics')}</div>
          <div style={{ ...rowS, flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
            <span style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}><span>Brightness</span><span style={{ color: C.mute }}>{Math.round(bright * 100)}%</span></span>
            <input type="range" min="0.5" max="1.2" step="0.05" value={bright} onChange={(e) => (setBright(+e.target.value), wake())} aria-label="Brightness" style={{ width: '100%', accentColor: accent }} />
          </div>
          <div style={{ ...rowS, flexDirection: 'column', alignItems: 'stretch', gap: 10, borderBottom: 'none' }}>
            <span style={{ fontWeight: 600 }}>Strap · {STRAPS[strapIdx][0]}</span>
            <div style={{ display: 'flex', gap: 12 }}>
              {STRAPS.map(([n, c], i) => (
                <button key={n} type="button" aria-label={n} aria-pressed={strapIdx === i} onClick={() => setStrapIdx(i)} style={{ width: 40, height: 40, borderRadius: '50%', border: `3px solid ${strapIdx === i ? C.ink : '#fff'}`, background: c, cursor: 'pointer', boxShadow: '0 0 0 1px rgba(20,22,28,.15)', padding: 0 }} />
              ))}
            </div>
          </div>
        </div>
        <div style={{ ...cardS, marginTop: 12 }}>
          <div style={rowS}><span style={{ color: C.mute }}>Model</span><b>{name} Series 4 · 42 mm</b></div>
          <div style={rowS}><span style={{ color: C.mute }}>Software</span><b>v 4.2.1</b></div>
          <div style={{ ...rowS, borderBottom: 'none' }}><span style={{ color: C.mute }}>Apps on watch</span><b>{apps.length}</b></div>
        </div>
        <div style={{ padding: '14px 18px', display: 'flex', gap: 10 }}>
          {pill('Reset demo', () => (setComps(COMPS0), setApps(APPS0.map((a) => a[0])), setAct({ move: 412, exercise: 21, stand: 8 }), setGoals({ move: 600, exercise: 30, stand: 12 }), setH24(false), setAod(true), setWrist('right'), setBright(1), setStrapIdx(2), setFaceIdx(0), say('Demo reset')), 'ghost')}
        </div>
      </>
    )
  }

  const phone = (
    <div style={{ position: 'relative', width: W, height: H, overflow: 'hidden', borderRadius: frame ? 46 : 0, background: C.bg, color: C.ink, fontFamily: "-apple-system, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif" }}>
      <style>{`
        @keyframes wa-r { from { opacity: 0; transform: translateX(34px) } to { opacity: 1; transform: none } }
        @keyframes wa-l { from { opacity: 0; transform: translateX(-34px) } to { opacity: 1; transform: none } }
        @keyframes wa-pulse { 0%,100% { opacity: 1 } 50% { opacity: .3 } }
        @keyframes wa-ping { 0%,100% { transform: translateX(0) } 15% { transform: translateX(-6px) rotate(-2deg) } 30% { transform: translateX(6px) rotate(2deg) } 45% { transform: translateX(-5px) } 60% { transform: translateX(5px) } }
        @keyframes wa-jig { 0%,100% { transform: rotate(-3deg) } 50% { transform: rotate(3deg) } }
        .wa-pulse { animation: wa-pulse 1.1s ease-in-out infinite }
        .wa-ping { animation: wa-ping .5s ease 3 }
        .wa-jig { animation: wa-jig .22s ease-in-out infinite }
        .wa-scroll { scrollbar-width: none } .wa-scroll::-webkit-scrollbar { display: none }
        .wa-app button:focus-visible, .wa-app [role=slider]:focus-visible, .wa-app [role=button]:focus-visible { outline: 2px solid ${accent}; outline-offset: 2px }
        @media (prefers-reduced-motion: reduce) { .wa-app *, .wa-app *::before { animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important } }
      `}</style>
      <StatusBar frame={frame} />
      <div key={`${tab}/${stack.map((s) => s.id + (s.key || s.app || '')).join('/')}`} className="wa-scroll" style={{ position: 'absolute', top: 54, bottom: 0, left: 0, right: 0, overflowY: 'auto', paddingBottom: tabbed ? 120 : 30, animation: `${dir > 0 ? 'wa-r' : 'wa-l'} .28s ease` }}>
        {body}
      </div>
      {tabbed && (
        <nav aria-label="Main" style={{ position: 'absolute', left: 14, right: 14, bottom: 22, height: 66, borderRadius: 33, background: 'rgba(255,255,255,.92)', backdropFilter: 'blur(12px)', boxShadow: '0 10px 30px rgba(20,22,28,.16)', display: 'flex', justifyContent: 'space-around', alignItems: 'center', padding: '0 6px' }}>
          {NAV.map(([id, icon, label]) => (
            <button key={id} type="button" onClick={() => go(id)} aria-current={tab === id ? 'page' : undefined} style={{ border: 'none', background: tab === id ? `${accent}1f` : 'none', borderRadius: 26, font: 'inherit', cursor: 'pointer', display: 'grid', justifyItems: 'center', alignContent: 'center', gap: 2, width: 66, height: 54, fontSize: 10.500, fontWeight: 700, color: tab === id ? accent : C.mute }}>
              <Icon name={icon} size={22} />
              {label}
            </button>
          ))}
        </nav>
      )}
      <div role="status" style={{ position: 'absolute', left: '50%', top: 58, zIndex: 30, transform: `translate(-50%, ${toast ? 0 : -90}px)`, transition: 'transform .35s cubic-bezier(.2,.8,.2,1)', padding: '10px 16px', borderRadius: 20, background: C.ink, color: '#fff', fontSize: 12.500, fontWeight: 600, whiteSpace: 'nowrap' }}>{toast}</div>
      <div style={{ position: 'absolute', left: '50%', bottom: 8, width: 140, height: 5, marginLeft: -70, borderRadius: 3, background: C.ink, opacity: 0.8, zIndex: 25 }} />
    </div>
  )

  return (
    <div ref={box} className="wa-app" style={{ position: 'relative', width: '100%', height: '100%', display: 'grid', placeItems: 'center', overflow: 'hidden', background: 'radial-gradient(ellipse at 50% 30%, #f4f6fa, #b8c0d0 78%)', ...style }}>
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: `translate(-50%, -50%) scale(${scale})`, transformOrigin: 'center' }}>
        {frame ? (
          <div style={{ padding: 12, borderRadius: 58, background: 'linear-gradient(145deg, #3a3f4a, #14171d 40%, #2b2f38)', boxShadow: '0 40px 80px rgba(20,22,28,.35), inset 0 0 0 2px #4b515e' }}>
            <div style={{ padding: 2, borderRadius: 48, background: '#000' }}>{phone}</div>
          </div>
        ) : (
          phone
        )}
      </div>
    </div>
  )
}
