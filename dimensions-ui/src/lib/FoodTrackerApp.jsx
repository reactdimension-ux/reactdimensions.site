import { useEffect, useRef, useState } from 'react'

// An AI food-tracking app on a phone, all in one component. It opens on a
// welcome screen where the AI tags each fruit with its calories; "Get
// Started" leads to the dashboard: a ring of tiles fills as the day's meals
// add up, and each meal card can be resized (pencil) or removed. Recipes
// filter by category and can be starred or added to the day; the orange
// button in the middle "scans" a plate, picks out what is on it and logs it.
// Saved shows the starred recipes; Settings changes the daily goal. The
// phone scales to fit whatever box it is in. Every picture is drawn in SVG.

const W = 390 // the phone screen, in CSS px (an iPhone's width)
const H = 844
const INK = '#1d1c1a'
const MUTED = '#9b958d'
const CREAM = '#f4efe9'

// a small seeded random generator, so the drawings are the same every time
const rng = (seed) => () => {
  seed |= 0
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

// ---------------------------------------------------------------- food art

// what goes in each bowl, as sectors seen from above
const BOWLS = {
  quinoa: [
    ['grain', '#e9d9b0'],
    ['leaf', '#4f8f35'],
    ['tomato', '#e2432d'],
    ['avocado', '#7fae3e'],
    ['grain', '#a33a57'],
    ['cube', '#f0c35a'],
  ],
  green: [
    ['leaf', '#5e9d3c'],
    ['avocado', '#86b543'],
    ['leaf', '#3f7a2a'],
    ['tomato', '#f05a3a'],
    ['grain', '#efe1bd'],
  ],
  chicken: [
    ['cube', '#d9a46a'],
    ['grain', '#f3ecdc'],
    ['leaf', '#4b8a33'],
    ['tomato', '#e8492f'],
  ],
  salmon: [
    ['cube', '#f2875f'],
    ['grain', '#f7f2e6'],
    ['avocado', '#80ad3f'],
    ['leaf', '#2f6b2a'],
  ],
  berry: [
    ['berry', '#3d3a8c'],
    ['grain', '#fbf6ec'],
    ['berry', '#c8283d'],
    ['grain', '#e3c98d'],
  ],
}

function Bowl({ kind = 'quinoa', size = 48, seed = 3 }) {
  const id = `fb-${kind}-${seed}`
  const parts = BOWLS[kind] ?? BOWLS.quinoa
  const r = rng(seed * 97 + kind.length)
  const shapes = []
  const n = parts.length
  parts.forEach(([type, color], s) => {
    const a0 = (s / n) * Math.PI * 2 + 0.06
    const a1 = ((s + 1) / n) * Math.PI * 2 - 0.06
    // a bed of the ingredient under the pieces, so the bowl looks heaped
    const p = (t, d) => `${50 + Math.cos(t) * d} ${50 + Math.sin(t) * d}`
    shapes.push(<path key={`bed${s}`} d={`M50 50L${p(a0 - 0.08, 42)}A42 42 0 0 1 ${p(a1 + 0.08, 42)}Z`} fill={color} opacity={type === 'grain' ? 0.85 : 0.55} />)
    const count = type === 'grain' ? 190 : type === 'leaf' ? 18 : type === 'cube' ? 15 : type === 'berry' ? 26 : type === 'tomato' ? 9 : 7
    for (let i = 0; i < count; i++) {
      const a = a0 + (a1 - a0) * r()
      const d = 3 + Math.sqrt(r()) * 36
      const x = 50 + Math.cos(a) * d
      const y = 50 + Math.sin(a) * d
      const rot = r() * 180
      const k = `${s}-${i}`
      if (type === 'grain') shapes.push(<ellipse key={k} cx={x} cy={y} rx={1.5} ry={1.1} transform={`rotate(${rot} ${x} ${y})`} fill={r() < 0.3 ? '#fffaf0' : color} stroke="#000" strokeOpacity=".12" strokeWidth=".3" />)
      else if (type === 'leaf')
        shapes.push(
          <g key={k} transform={`rotate(${rot} ${x} ${y})`}>
            <ellipse cx={x} cy={y} rx={7} ry={4} fill={color} />
            <path d={`M${x - 6} ${y}h12`} stroke="#ffffff" strokeOpacity=".25" strokeWidth=".6" />
          </g>,
        )
      else if (type === 'tomato')
        shapes.push(
          <g key={k}>
            <circle cx={x} cy={y} r={4.6} fill={color} />
            <circle cx={x} cy={y} r={2.6} fill="#f68b6c" />
            <circle cx={x - 1.4} cy={y - 1.6} r={1} fill="#fff" opacity=".55" />
          </g>,
        )
      else if (type === 'avocado')
        shapes.push(
          <g key={k} transform={`rotate(${rot} ${x} ${y})`}>
            <ellipse cx={x} cy={y} rx={8} ry={3.6} fill="#2f4d1d" />
            <ellipse cx={x} cy={y} rx={7.2} ry={2.9} fill={color} />
            <ellipse cx={x + 1} cy={y - 0.4} rx={5} ry={1.6} fill="#d4e48a" opacity=".8" />
          </g>,
        )
      else if (type === 'cube')
        shapes.push(<rect key={k} x={x - 3.6} y={y - 3.6} width={7.2} height={7.2} rx={1.8} transform={`rotate(${rot} ${x} ${y})`} fill={color} stroke="#000" strokeOpacity=".12" strokeWidth=".5" />)
      else if (type === 'berry')
        shapes.push(
          <g key={k}>
            <circle cx={x} cy={y} r={3.3} fill={color} />
            <circle cx={x - 1} cy={y - 1.1} r={0.9} fill="#fff" opacity=".5" />
          </g>,
        )
    }
  })
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true" style={{ display: 'block' }}>
      <defs>
        <radialGradient id={`${id}-rim`} cx=".4" cy=".35" r=".7">
          <stop offset=".75" stopColor="#ffffff" />
          <stop offset="1" stopColor="#d9d2c8" />
        </radialGradient>
        <radialGradient id={`${id}-in`} cx=".5" cy=".5" r=".5">
          <stop offset=".7" stopColor="#ece4d6" />
          <stop offset="1" stopColor="#c9bfae" />
        </radialGradient>
        <clipPath id={`${id}-c`}>
          <circle cx="50" cy="50" r="40" />
        </clipPath>
      </defs>
      <circle cx="51" cy="53" r="48" fill="#000" opacity=".12" />
      <circle cx="50" cy="50" r="48" fill={`url(#${id}-rim)`} />
      <circle cx="50" cy="50" r="41" fill={`url(#${id}-in)`} />
      <g clipPath={`url(#${id}-c)`}>{shapes}</g>
      <circle cx="50" cy="50" r="41" fill="none" stroke="#000" strokeOpacity=".08" strokeWidth="1.5" />
    </svg>
  )
}

// avocado toast on a small plate
function Toast({ size = 48 }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true" style={{ display: 'block' }}>
      <circle cx="51" cy="53" r="48" fill="#000" opacity=".1" />
      <circle cx="50" cy="50" r="48" fill="#fbf8f3" />
      <circle cx="50" cy="50" r="40" fill="none" stroke="#e8e1d6" strokeWidth="2" />
      <path d="M24 34q0-12 13-12h26q13 0 13 12v32q0 10-10 10H34q-10 0-10-10z" fill="#c98c4c" />
      <path d="M28 36q0-9 10-9h24q10 0 10 9v28q0 8-8 8H36q-8 0-8-8z" fill="#e7bb7b" />
      <path d="M31 40q8-8 19-4t19 2v22q-6 8-19 6t-19-4z" fill="#9cc04f" />
      {[[40, 46], [56, 44], [48, 56], [62, 58]].map(([x, y], i) => (
        <g key={i}>
          <ellipse cx={x} cy={y} rx="6" ry="4" fill="#fffaf0" />
          <circle cx={x} cy={y} r="2.4" fill="#f5b52e" />
        </g>
      ))}
      <circle cx="36" cy="58" r="1" fill="#c0392b" />
      <circle cx="58" cy="51" r="1" fill="#c0392b" />
      <circle cx="45" cy="40" r="1" fill="#c0392b" />
    </svg>
  )
}

const Dish = ({ kind, size, seed }) => (kind === 'toast' ? <Toast size={size} /> : <Bowl kind={kind} size={size} seed={seed} />)

// a citrus cut in half: rind, pith and juicy segments
function Citrus({ cx, cy, r, rind, flesh, deep, n = 10 }) {
  const segs = []
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2 + 0.05
    const a1 = ((i + 1) / n) * Math.PI * 2 - 0.05
    const ri = r * 0.06
    const ro = r * 0.84
    const p = (a, d) => `${cx + Math.cos(a) * d} ${cy + Math.sin(a) * d}`
    segs.push(<path key={i} d={`M${p(a0, ri)}L${p(a0, ro)}A${ro} ${ro} 0 0 1 ${p(a1, ro)}L${p(a1, ri)}Z`} fill={`url(#ft-seg-${rind.slice(1)})`} />)
  }
  return (
    <g>
      <defs>
        <radialGradient id={`ft-seg-${rind.slice(1)}`} cx={cx} cy={cy} r={r} gradientUnits="userSpaceOnUse">
          <stop offset=".1" stopColor={flesh} />
          <stop offset="1" stopColor={deep} />
        </radialGradient>
      </defs>
      <circle cx={cx + 4} cy={cy + 8} r={r} fill="#000" opacity=".15" />
      <circle cx={cx} cy={cy} r={r} fill={rind} />
      <circle cx={cx} cy={cy} r={r * 0.93} fill="#fff4dc" />
      {segs}
      <circle cx={cx} cy={cy} r={r * 0.07} fill="#fff4dc" />
    </g>
  )
}

function Broccoli({ x, y, s = 1 }) {
  const r = rng(11)
  const florets = []
  for (let i = 0; i < 46; i++) {
    const a = r() * Math.PI * 2
    const d = Math.sqrt(r()) * 52
    const fx = Math.cos(a) * d * 1.15
    const fy = Math.sin(a) * d * 0.8 - 6
    florets.push(<circle key={i} cx={fx} cy={fy} r={10 + r() * 8} fill={['#2f6a24', '#3c7d2b', '#4a8f33', '#356f27'][i % 4]} />)
    if (i % 2) florets.push(<circle key={`d${i}`} cx={fx - 3} cy={fy - 3} r={3} fill="#7fb456" opacity=".7" />)
  }
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-14 40q6 30-4 70h40q-12-38-2-70z" fill="#a7c66a" />
      <path d="M-4 44q-30 2-44 -10M14 44q26 0 38-16" stroke="#9fbe5f" strokeWidth="10" strokeLinecap="round" fill="none" />
      {florets}
    </g>
  )
}

function Cabbage({ x, y, s = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {[
        [0, 0, 78, 64, '#c6df95', -20],
        [-24, 10, 60, 48, '#b0d07c', 25],
        [26, 14, 58, 44, '#a3c66e', -35],
        [0, 20, 48, 36, '#d7eab0', 0],
      ].map(([cx, cy, rx, ry, c, rot], i) => (
        <g key={i} transform={`rotate(${rot} ${cx} ${cy})`}>
          <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={c} />
          <path d={`M${cx - rx * 0.8} ${cy}Q${cx} ${cy - ry * 0.4} ${cx + rx * 0.8} ${cy}`} stroke="#eef6d8" strokeWidth="3" fill="none" opacity=".8" />
          <path d={`M${cx} ${cy}l${-rx * 0.4} ${-ry * 0.6}M${cx} ${cy}l${rx * 0.4} ${-ry * 0.55}`} stroke="#eef6d8" strokeWidth="1.6" fill="none" opacity=".7" />
        </g>
      ))}
    </g>
  )
}

// the welcome screen's still life
function Hero() {
  return (
    <svg viewBox="0 0 360 400" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" aria-hidden="true" style={{ display: 'block' }}>
      <defs>
        <linearGradient id="ft-hero-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#dfe8d2" />
          <stop offset="1" stopColor="#f6efe6" />
        </linearGradient>
        <filter id="ft-soft">
          <feGaussianBlur stdDeviation="5" />
        </filter>
      </defs>
      <rect width="360" height="400" fill="url(#ft-hero-bg)" />
      <g filter="url(#ft-soft)" opacity=".8">
        <Cabbage x={20} y={40} s={1.3} />
      </g>
      <Cabbage x={60} y={120} s={1} />
      <Broccoli x={250} y={110} s={1.05} />
      <Citrus cx={40} cy={300} r={74} rind="#e5674f" flesh="#fbb2a0" deep="#ec6d58" n={11} />
      <Citrus cx={200} cy={300} r={104} rind="#f28c12" flesh="#ffd36b" deep="#f6951b" n={10} />
      <Citrus cx={340} cy={330} r={60} rind="#e5674f" flesh="#fbb2a0" deep="#ec6d58" n={9} />
      {/* a fade into the page, so the headline sits on cream */}
      <rect y="300" width="360" height="100" fill={CREAM} opacity="0" />
    </svg>
  )
}

// ---------------------------------------------------------------- icons

const PATHS = {
  home: <path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4v-5h-6v5H5a1 1 0 0 1-1-1z" />,
  book: <path d="M5 4.5h10.5a2 2 0 0 1 2 2V20H7a2 2 0 0 1-2-2zM5 18a2 2 0 0 1 2-2h10.5M9 8.5h5" />,
  star: <path d="m12 3.8 2.5 5.1 5.6.8-4 3.9 1 5.6-5.1-2.7-5 2.7 1-5.6-4-3.9 5.5-.8z" />,
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M5.6 18.4l1.6-1.6M16.8 7.2l1.6-1.6" />
    </>
  ),
  scan: (
    <>
      <path d="M4 8.5V6a2 2 0 0 1 2-2h2.5M15.5 4H18a2 2 0 0 1 2 2v2.5M20 15.5V18a2 2 0 0 1-2 2h-2.5M8.5 20H6a2 2 0 0 1-2-2v-2.5" />
      <circle cx="12" cy="12" r="3.2" />
    </>
  ),
  bell: <path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 1.5H5zM10 20.5h4" />,
  search: <path d="M10.5 17a6.5 6.5 0 1 1 0-13 6.5 6.5 0 0 1 0 13zM15.5 15.5 20 20" />,
  pencil: <path d="m14.5 5.5 4 4L9 19H5v-4zM12.5 7.5l4 4" />,
  flame: <path d="M12 21c-3.9 0-6.5-2.6-6.5-6.2 0-3.4 2.6-5.6 4-8.3.5 1.7 1.4 2.7 2.6 3.3.2-2.6 1.3-4.8 3.4-6.3-.3 3.4 3 5.6 3 9.6 0 4.6-2.8 7.9-6.5 7.9z" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4.5l3 1.8" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6 6 18" />,
  user: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20.5a7.5 7.5 0 0 1 15 0" />,
}
const Icon = ({ name, size = 22, color = 'currentColor', fill = 'none', w = 1.8 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill={fill} stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: 'block', flex: 'none' }}>
    {PATHS[name]}
  </svg>
)

// little category pictures
const CAT_ART = {
  All: <Bowl kind="quinoa" size={30} seed={9} />,
  Vegan: <Bowl kind="green" size={30} seed={4} />,
  Protein: (
    <svg viewBox="0 0 30 30" width="30" height="30" aria-hidden="true">
      <path d="M17 4c5 0 9 4 9 9 0 6-6 8-10 8l-5 5a2.5 2.5 0 1 1-3.5-3.5 2.5 2.5 0 1 1-1-3l5-5c0-4 1-10.5 5.5-10.5z" fill="#c8743a" />
      <path d="M18 7c3 0 5.5 2.4 5.5 5.5" stroke="#f0b27a" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  ),
  Snacks: (
    <svg viewBox="0 0 30 30" width="30" height="30" aria-hidden="true">
      {[8, 11, 14, 17, 20].map((x, i) => (
        <rect key={x} x={x} y={3 + (i % 2) * 3} width="2.6" height="14" rx="1" fill="#f5c542" transform={`rotate(${(i - 2) * 6} ${x} 16)`} />
      ))}
      <path d="M6 13h18l-2.5 14h-13z" fill="#e8452f" />
      <path d="M11 18h8" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
}

// ---------------------------------------------------------------- data

const RECIPES = [
  { id: 'quinoa', name: 'Quinoa Veggie Bowl', kcal: 750, min: 15, level: 1, cat: 'Vegan', dish: 'quinoa', p: 28, c: 92, f: 30 },
  { id: 'salmon', name: 'Salmon Rice Bowl', kcal: 690, min: 25, level: 2, cat: 'Protein', dish: 'salmon', p: 42, c: 70, f: 24 },
  { id: 'toast', name: 'Avocado Toast', kcal: 410, min: 8, level: 1, cat: 'Vegan', dish: 'toast', p: 14, c: 38, f: 22 },
  { id: 'chicken', name: 'Grilled Chicken Plate', kcal: 620, min: 30, level: 3, cat: 'Protein', dish: 'chicken', p: 54, c: 48, f: 18 },
  { id: 'berry', name: 'Berry Yogurt Cup', kcal: 280, min: 5, level: 1, cat: 'Snacks', dish: 'berry', p: 12, c: 40, f: 8 },
  { id: 'green', name: 'Green Goddess Salad', kcal: 360, min: 10, level: 1, cat: 'Vegan', dish: 'green', p: 11, c: 26, f: 23 },
]
const LEVEL = ['', 'Easy', 'Medium', 'Hard']
const MEALS = [
  { id: 1, label: 'Lunch', time: '12:30 PM', dish: 'quinoa', kcal: 693, p: 46, c: 81, f: 25, portion: 1 },
  { id: 2, label: 'Breakfast', time: '11:30 AM', dish: 'toast', kcal: 500, p: 18, c: 52, f: 25, portion: 1 },
]
// what the scanner "finds" on the plate, placed over the bowl
const FOUND = [
  { name: 'Quinoa', kcal: 220, x: 72, y: 62 },
  { name: 'Avocado', kcal: 160, x: 28, y: 22 },
  { name: 'Tomato', kcal: 25, x: 20, y: 58 },
  { name: 'Greens', kcal: 30, x: 50, y: 86 },
]
const mealLabel = (d) => {
  const h = d.getHours()
  return h < 11 ? 'Breakfast' : h < 15 ? 'Lunch' : h < 18 ? 'Snack' : 'Dinner'
}
const timeNow = () => new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

// ---------------------------------------------------------------- pieces

// the dashboard's ring of tiles: they light up, left to right, as the day fills
function Gauge({ eaten, goal, accent }) {
  const n = 13
  const lit = Math.round(Math.min(1, eaten / goal) * n)
  const cx = 150
  const cy = 150
  const R = 112
  const tiles = []
  for (let i = 0; i < n; i++) {
    const a = 205 - (i * 230) / (n - 1) // degrees, from lower left over the top to lower right
    const rad = (a * Math.PI) / 180
    const x = cx + Math.cos(rad) * R
    const y = cy - Math.sin(rad) * R
    const on = i < lit
    tiles.push(
      <rect
        key={i}
        x={x - 13}
        y={y - 20}
        width="26"
        height="40"
        rx="9"
        transform={`rotate(${90 - a} ${x} ${y})`}
        fill={on ? accent : '#e9e3dc'}
        opacity={on ? 0.42 + (0.58 * (i + 1)) / Math.max(lit, 1) : 1}
        style={{ transition: `fill .4s ${i * 0.04}s, opacity .4s ${i * 0.04}s` }}
      />,
    )
  }
  return (
    <svg viewBox="0 0 300 230" width="300" height="230" role="img" aria-label={`${eaten} of ${goal} kcal`} style={{ display: 'block', margin: '0 auto' }}>
      {tiles}
    </svg>
  )
}

const Macro = ({ k, v }) => (
  <div>
    <div style={{ fontSize: 10.5, color: MUTED }}>{k}</div>
    <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2 }}>{v}g</div>
  </div>
)

function MealCard({ m, goal, accent, onPortion, onRemove }) {
  const [edit, setEdit] = useState(false)
  const kcal = Math.round(m.kcal * m.portion)
  return (
    <div style={{ background: '#fff', borderRadius: 22, padding: '14px 14px 12px', boxShadow: '0 1px 0 rgba(0,0,0,.03)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Dish kind={m.dish} size={46} seed={m.id} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{m.label}</div>
          <div style={{ fontSize: 11.5, color: MUTED, marginTop: 2 }}>{m.time}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em' }}>{kcal} kcal</div>
          <div style={{ fontSize: 11, color: accent, marginTop: 2, fontWeight: 600 }}>{Math.round((kcal / goal) * 100)}% of goal</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 22, marginTop: 12 }}>
        <Macro k="Protein" v={Math.round(m.p * m.portion)} />
        <Macro k="Carbs" v={Math.round(m.c * m.portion)} />
        <Macro k="Fat" v={Math.round(m.f * m.portion)} />
        <div style={{ flex: 1 }} />
        <button type="button" onClick={() => setEdit((e) => !e)} aria-label={`Edit ${m.label}`} aria-expanded={edit} style={{ ...iconBtn, width: 30, height: 30, background: edit ? INK : 'transparent', color: edit ? '#fff' : INK }}>
          <Icon name="pencil" size={17} />
        </button>
      </div>
      {edit && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, paddingTop: 12, borderTop: '1px solid #f0ebe5', animation: 'ft-in .25s ease' }}>
          <span style={{ fontSize: 11.5, color: MUTED, marginRight: 4 }}>Portion</span>
          {[0.5, 1, 1.5, 2].map((q) => (
            <button key={q} type="button" onClick={() => onPortion(m.id, q)} aria-pressed={m.portion === q} style={{ height: 26, padding: '0 10px', borderRadius: 13, border: 'none', cursor: 'pointer', font: 'inherit', fontSize: 12, fontWeight: 600, background: m.portion === q ? accent : '#f3eee8', color: m.portion === q ? '#fff' : INK }}>
              {q === 0.5 ? '½' : q === 1.5 ? '1½' : q}×
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <button type="button" onClick={() => onRemove(m.id)} style={{ border: 'none', background: 'none', color: '#c0392b', font: 'inherit', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            Remove
          </button>
        </div>
      )}
    </div>
  )
}

const iconBtn = { display: 'grid', placeItems: 'center', border: 'none', borderRadius: '50%', cursor: 'pointer', padding: 0, background: 'transparent', color: INK }

function RecipeCard({ r, accent, starred, onStar, onAdd, big }) {
  return (
    <div style={{ background: '#fff', borderRadius: 24, padding: 14, animation: 'ft-in .3s ease' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{r.name}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: MUTED, marginTop: 4 }}>
            <Icon name="clock" size={13} color={accent} w={2} />
            {r.min} min
          </div>
        </div>
        <button type="button" onClick={() => onStar(r.id)} aria-pressed={starred} aria-label={starred ? `Unsave ${r.name}` : `Save ${r.name}`} style={{ ...iconBtn, width: 30, height: 30 }}>
          <Icon name="star" size={21} fill={starred ? INK : 'none'} />
        </button>
      </div>
      <div style={{ display: 'grid', placeItems: 'center', margin: big ? '6px 0 8px' : '4px 0' }}>
        <Dish kind={r.dish} size={big ? 200 : 120} seed={r.id.length * 7} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12, color: MUTED }}>{LEVEL[r.level]}</span>
        <span style={{ display: 'flex', gap: 3 }} aria-hidden="true">
          {[1, 2, 3, 4].map((k) => (
            <span key={k} style={{ width: 7, height: 16, borderRadius: 3, background: k <= r.level + 1 ? accent : '#f1e2d6', opacity: k <= r.level + 1 ? 1 - (k - 1) * 0.15 : 1 }} />
          ))}
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>{r.kcal} kcal</span>
        <button type="button" onClick={() => onAdd(r)} aria-label={`Add ${r.name} to today`} style={{ ...iconBtn, width: 32, height: 32, background: accent, color: '#fff', fontSize: 20, lineHeight: 1 }}>
          +
        </button>
      </div>
    </div>
  )
}

function StatusBar({ dark, frame }) {
  const c = dark ? '#fff' : INK
  const clock = new Date().toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' })
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20, height: 54, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 30px 0 36px', fontSize: 16, fontWeight: 600, color: c, pointerEvents: 'none' }}>
      <span>{clock}</span>
      {frame && <span style={{ position: 'absolute', left: '50%', top: 11, width: 122, height: 35, marginLeft: -61, borderRadius: 20, background: '#000' }} />}
      <span style={{ display: 'flex', gap: 6, alignItems: 'center' }} aria-hidden="true">
        <svg width="18" height="11" viewBox="0 0 18 11" fill={c}>
          <rect x="0" y="7" width="3" height="4" rx="1" />
          <rect x="5" y="5" width="3" height="6" rx="1" />
          <rect x="10" y="2.5" width="3" height="8.5" rx="1" />
          <rect x="15" y="0" width="3" height="11" rx="1" />
        </svg>
        <svg width="26" height="12" viewBox="0 0 26 12">
          <rect x="0.5" y="0.5" width="22" height="11" rx="3.5" fill="none" stroke={c} opacity=".45" />
          <rect x="2.5" y="2.5" width="16" height="7" rx="2" fill={c} />
          <rect x="23.5" y="4" width="2" height="4" rx="1" fill={c} opacity=".45" />
        </svg>
      </span>
    </div>
  )
}

// ---------------------------------------------------------------- app

export default function FoodTrackerApp({ name = 'NutriLens', accent = '#f2763a', goal: initialGoal = 2000, startScreen = 'welcome', frame = true, style }) {
  const box = useRef()
  const [scale, setScale] = useState(1)
  const [screen, setScreen] = useState(startScreen)
  useEffect(() => setScreen(startScreen), [startScreen])
  const [goal, setGoal] = useState(initialGoal)
  useEffect(() => setGoal(initialGoal), [initialGoal])
  const [meals, setMeals] = useState(MEALS)
  const [cat, setCat] = useState('All')
  const [query, setQuery] = useState('')
  const [starred, setStarred] = useState(['quinoa'])
  const [toast, setToast] = useState('')
  const [scan, setScan] = useState('idle') // idle → looking → found
  const [slide, setSlide] = useState(0)

  // fit the phone into the box
  useEffect(() => {
    const ro = new ResizeObserver(([e]) => {
      const fw = frame ? W + 28 : W
      const fh = frame ? H + 28 : H
      setScale(Math.min(1.2, (e.contentRect.width - 24) / fw, (e.contentRect.height - 24) / fh))
    })
    ro.observe(box.current)
    return () => ro.disconnect()
  }, [frame])

  // the welcome screen's AI tags appear one after another, on a loop of three "slides"
  useEffect(() => {
    if (screen !== 'welcome') return
    const t = setInterval(() => setSlide((s) => (s + 1) % 3), 2600)
    return () => clearInterval(t)
  }, [screen])

  // the scanner looks for a moment, then shows what it found
  useEffect(() => {
    if (screen !== 'scan') return setScan('idle')
    setScan('looking')
    const t = setTimeout(() => setScan('found'), 2200)
    return () => clearTimeout(t)
  }, [screen])

  const say = (t) => {
    setToast(t)
    clearTimeout(say.t)
    say.t = setTimeout(() => setToast(''), 1800)
  }
  const eaten = meals.reduce((s, m) => s + Math.round(m.kcal * m.portion), 0)
  const addMeal = (r, from = 'recipe') => {
    const now = new Date()
    setMeals((ms) => [{ id: Date.now(), label: mealLabel(now), time: timeNow(), dish: r.dish, kcal: r.kcal, p: r.p, c: r.c, f: r.f, portion: 1 }, ...ms])
    say(from === 'scan' ? `Logged ${r.kcal} kcal from your scan` : `${r.name} added`)
    setScreen('home')
  }
  const star = (id) => setStarred((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  const shown = RECIPES.filter((r) => (cat === 'All' || r.cat === cat) && r.name.toLowerCase().includes(query.trim().toLowerCase()))
  const today = new Date()
  const dateLabel = `${today.getDate()} ${today.toLocaleDateString('en-GB', { month: 'short' })}`

  const header = (title, right) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 20px 0' }}>
      <button type="button" aria-label="Profile" onClick={() => setScreen('settings')} style={{ ...iconBtn, width: 38, height: 38, background: INK, color: '#fff' }}>
        <Icon name="user" size={18} />
      </button>
      <div style={{ fontSize: 14, fontWeight: 600 }}>{title}</div>
      {right ?? (
        <button type="button" aria-label="Notifications" onClick={() => say('No new notifications')} style={{ ...iconBtn, width: 38, height: 38, background: '#fff' }}>
          <Icon name="bell" size={18} />
        </button>
      )}
    </div>
  )

  const NAV = [
    ['home', 'home', 'Dashboard'],
    ['recipes', 'book', 'Recipes'],
    ['scan', 'scan', 'Scan food'],
    ['saved', 'star', 'Saved'],
    ['settings', 'gear', 'Settings'],
  ]

  let body = null
  if (screen === 'welcome') {
    const tags = [
      { t: '170 kcal', x: 8, y: 10, dx: 30, dy: 52 },
      { t: '90 kcal', x: 30, y: 32, dx: 42, dy: 64 },
      { t: '110 kcal', x: 68, y: 12, dx: 72, dy: 40 },
    ]
    body = (
      <div style={{ position: 'absolute', inset: 0, background: CREAM }}>
        <div style={{ position: 'absolute', inset: '0 0 auto 0', height: 470, overflow: 'hidden', borderRadius: '0 0 34px 34px' }}>
          <Hero />
          <div style={{ position: 'absolute', inset: 'auto 0 0 0', height: 120, background: `linear-gradient(transparent, ${CREAM})` }} />
          {tags.map((g, i) => (
            <div key={g.t} style={{ position: 'absolute', left: `${g.x}%`, top: `${g.y + 6}%`, opacity: slide >= i || slide === 2 ? 1 : 0.0, transform: `translateY(${slide >= i || slide === 2 ? 0 : 6}px)`, transition: 'opacity .5s, transform .5s' }}>
              <span style={{ display: 'inline-block', padding: '7px 12px', borderRadius: 16, background: 'rgba(255,255,255,.72)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', fontSize: 12.5, fontWeight: 600 }}>{g.t}</span>
              <svg width="60" height="90" style={{ position: 'absolute', left: 26, top: 30, overflow: 'visible' }} aria-hidden="true">
                <path d={`M0 0V${g.dy}`} stroke="#fff" strokeWidth="1.4" strokeDasharray="3 3" />
                <circle cx="0" cy={g.dy} r="5" fill="#fff" stroke={INK} strokeWidth="1.5" />
              </svg>
            </div>
          ))}
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 470, padding: '6px 28px 0', textAlign: 'center' }}>
          <h1 style={{ margin: 0, fontSize: 38, lineHeight: 1.06, fontWeight: 600, letterSpacing: '-0.03em' }}>
            Your Food,
            <br />
            Decoded By AI
          </h1>
          <p style={{ margin: '16px auto 0', maxWidth: 270, fontSize: 13.5, lineHeight: 1.5, color: MUTED }}>From scanning to tracking — everything happens automatically.</p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 5, marginTop: 26 }} aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <span key={i} style={{ width: i === slide ? 18 : 6, height: 6, borderRadius: 3, background: i === slide ? INK : '#d6cfc6', transition: 'width .3s' }} />
            ))}
          </div>
        </div>
        <button type="button" onClick={() => setScreen('home')} style={{ position: 'absolute', left: 24, right: 24, bottom: 40, height: 58, borderRadius: 29, border: 'none', background: INK, color: '#fff', font: 'inherit', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
          Get Started
        </button>
      </div>
    )
  } else if (screen === 'home') {
    body = (
      <>
        {header('Dashboard')}
        <div style={{ position: 'relative', marginTop: 8 }}>
          <Gauge eaten={eaten} goal={goal} accent={accent} />
          <div style={{ position: 'absolute', left: 0, right: 0, top: 92, textAlign: 'center' }}>
            <div style={{ display: 'grid', placeItems: 'center' }}>
              <Icon name="flame" size={20} color={accent} fill={accent} w={1} />
            </div>
            <div style={{ fontSize: 12, color: MUTED, marginTop: 6 }}>{dateLabel}</div>
            <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.03em', marginTop: 2 }}>{eaten} kcal</div>
            <div style={{ fontSize: 11.5, color: MUTED, marginTop: 2 }}>{Math.max(0, goal - eaten)} left of {goal}</div>
          </div>
        </div>
        <div style={{ padding: '0 20px' }}>
          <button type="button" onClick={() => setScreen('recipes')} aria-label="Add food" style={{ width: '100%', height: 42, border: 'none', borderRadius: 21, background: '#e9e3dc', color: INK, fontSize: 22, fontWeight: 300, cursor: 'pointer' }}>
            +
          </button>
          <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
            {meals.map((m) => (
              <MealCard key={m.id} m={m} goal={goal} accent={accent} onPortion={(id, q) => setMeals((ms) => ms.map((x) => (x.id === id ? { ...x, portion: q } : x)))} onRemove={(id) => setMeals((ms) => ms.filter((x) => x.id !== id))} />
            ))}
            {!meals.length && <div style={{ textAlign: 'center', color: MUTED, fontSize: 13, padding: '24px 0' }}>Nothing logged yet — scan a plate or add a recipe.</div>}
          </div>
        </div>
      </>
    )
  } else if (screen === 'recipes' || screen === 'saved') {
    const saved = screen === 'saved'
    const list = saved ? RECIPES.filter((r) => starred.includes(r.id)) : shown
    body = (
      <>
        {saved ? (
          header('Saved')
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 20px 0' }}>
            <label style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, height: 42, padding: '0 14px', borderRadius: 21, background: '#fff', color: MUTED }}>
              <Icon name="search" size={18} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" aria-label="Search recipes" style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'none', font: 'inherit', fontSize: 14, color: INK }} />
            </label>
            <button type="button" aria-label="Notifications" onClick={() => say('No new notifications')} style={{ ...iconBtn, width: 42, height: 42, background: '#fff' }}>
              <Icon name="bell" size={18} />
            </button>
          </div>
        )}
        {!saved && (
          <div style={{ display: 'flex', gap: 10, padding: '16px 20px 0' }} role="group" aria-label="Category">
            {Object.keys(CAT_ART).map((k) => (
              <button key={k} type="button" onClick={() => setCat(k)} aria-pressed={cat === k} style={{ flex: 1, border: 'none', background: 'none', padding: 0, cursor: 'pointer', font: 'inherit', color: INK }}>
                <span style={{ display: 'grid', placeItems: 'center', height: 54, borderRadius: 16, background: '#fff', boxShadow: cat === k ? `inset 0 0 0 2px ${accent}` : 'none', transition: 'box-shadow .2s' }}>{CAT_ART[k]}</span>
                <span style={{ display: 'block', fontSize: 11.5, marginTop: 6, fontWeight: cat === k ? 700 : 500 }}>{k}</span>
              </button>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '18px 20px 10px' }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{saved ? `${list.length} saved recipe${list.length === 1 ? '' : 's'}` : cat === 'All' ? 'Trending Recipes' : `${cat} Recipes`}</h2>
          {!saved && (
            <button type="button" onClick={() => (setCat('All'), setQuery(''))} style={{ border: 'none', background: 'none', padding: 0, font: 'inherit', fontSize: 12, color: MUTED, cursor: 'pointer' }}>
              See All
            </button>
          )}
        </div>
        <div style={{ display: 'grid', gap: 10, padding: '0 20px' }}>
          {list.map((r, i) => (
            <RecipeCard key={r.id} r={r} big={i === 0} accent={accent} starred={starred.includes(r.id)} onStar={star} onAdd={addMeal} />
          ))}
          {!list.length && <div style={{ textAlign: 'center', color: MUTED, fontSize: 13, padding: '30px 0' }}>{saved ? 'Tap the star on a recipe to keep it here.' : 'No recipes match.'}</div>}
        </div>
      </>
    )
  } else if (screen === 'settings') {
    body = (
      <>
        {header('Settings')}
        <div style={{ padding: '22px 20px 0', display: 'grid', gap: 10 }}>
          <div style={{ background: '#fff', borderRadius: 22, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: 14, fontWeight: 700 }}>Daily goal</span>
              <span style={{ fontSize: 22, fontWeight: 800 }}>{goal} kcal</span>
            </div>
            <input type="range" min="1200" max="3600" step="50" value={goal} onChange={(e) => setGoal(+e.target.value)} aria-label="Daily goal" style={{ width: '100%', marginTop: 14, accentColor: accent }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: MUTED }}>
              <span>1200</span>
              <span>3600</span>
            </div>
          </div>
          <div style={{ background: '#fff', borderRadius: 22, padding: 16, fontSize: 13, lineHeight: 1.55, color: MUTED }}>
            <b style={{ color: INK }}>{name}</b> estimates portions from a photo of your plate. Numbers are estimates — adjust a meal's portion with the pencil on its card.
          </div>
          <button type="button" onClick={() => (setMeals(MEALS), setStarred(['quinoa']), setScreen('welcome'))} style={{ height: 48, borderRadius: 24, border: 'none', background: '#e9e3dc', font: 'inherit', fontSize: 14, fontWeight: 600, color: INK, cursor: 'pointer' }}>
            Reset & show welcome
          </button>
        </div>
      </>
    )
  } else if (screen === 'scan') {
    const total = FOUND.reduce((s, f) => s + f.kcal, 0)
    body = (
      <div style={{ position: 'absolute', inset: 0, background: '#151412', color: '#fff' }}>
        {/* the "camera": the plate on a dark wooden table */}
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 40%, #4a3a2c, #1a1512 70%)' }} />
        <div style={{ position: 'absolute', left: '50%', top: 300, transform: 'translate(-50%, -50%)' }}>
          <Bowl kind="quinoa" size={300} seed={21} />
        </div>
        <div style={{ position: 'absolute', left: 30, right: 30, top: 140, height: 320 }}>
          {/* viewfinder corners */}
          {[
            [0, 0, 'M2 26V8a6 6 0 0 1 6-6h18'],
            [1, 0, 'M4 2h18a6 6 0 0 1 6 6v18'],
            [0, 1, 'M2 4v18a6 6 0 0 0 6 6h18'],
            [1, 1, 'M28 4v18a6 6 0 0 1-6 6H4'],
          ].map(([r, b, d], i) => (
            <svg key={i} width="30" height="30" style={{ position: 'absolute', [r ? 'right' : 'left']: 0, [b ? 'bottom' : 'top']: 0 }} aria-hidden="true">
              <path d={d} stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" />
            </svg>
          ))}
          {scan === 'looking' && <div style={{ position: 'absolute', left: 6, right: 6, height: 2, borderRadius: 1, background: accent, boxShadow: `0 0 18px 4px ${accent}`, animation: 'ft-scan 1.1s ease-in-out infinite alternate' }} />}
          {scan === 'found' &&
            FOUND.map((f, i) => (
              <span key={f.name} style={{ position: 'absolute', left: `${f.x}%`, top: `${f.y}%`, transform: 'translate(-50%, -50%)', padding: '6px 10px', borderRadius: 14, background: 'rgba(255,255,255,.82)', color: INK, fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', animation: `ft-pop .35s ${i * 0.12}s both` }}>
                {f.name} · {f.kcal}
              </span>
            ))}
        </div>
        <button type="button" onClick={() => setScreen('home')} aria-label="Close scanner" style={{ ...iconBtn, position: 'absolute', right: 20, top: 62, width: 38, height: 38, background: 'rgba(255,255,255,.16)', color: '#fff' }}>
          <Icon name="close" size={18} />
        </button>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 70, textAlign: 'center', fontSize: 14, fontWeight: 600 }}>{scan === 'found' ? 'Found 4 ingredients' : 'Hold steady…'}</div>
        <div style={{ position: 'absolute', left: 14, right: 14, bottom: 30, borderRadius: 28, background: CREAM, color: INK, padding: 18, transform: scan === 'found' ? 'none' : 'translateY(130%)', transition: 'transform .45s cubic-bezier(.2,.8,.2,1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: 16, fontWeight: 700 }}>Quinoa Veggie Bowl</span>
            <span style={{ fontSize: 24, fontWeight: 800 }}>{total} kcal</span>
          </div>
          <div style={{ display: 'flex', gap: 22, marginTop: 10 }}>
            <Macro k="Protein" v={16} />
            <Macro k="Carbs" v={52} />
            <Macro k="Fat" v={21} />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button type="button" onClick={() => (setScan('looking'), setTimeout(() => setScan('found'), 2200))} style={{ flex: 1, height: 48, borderRadius: 24, border: 'none', background: '#e9e3dc', font: 'inherit', fontSize: 14, fontWeight: 600, color: INK, cursor: 'pointer' }}>
              Retake
            </button>
            <button type="button" onClick={() => addMeal({ name: 'Scanned bowl', dish: 'quinoa', kcal: total, p: 16, c: 52, f: 21 }, 'scan')} style={{ flex: 2, height: 48, borderRadius: 24, border: 'none', background: accent, font: 'inherit', fontSize: 14, fontWeight: 600, color: '#fff', cursor: 'pointer' }}>
              Log this meal
            </button>
          </div>
        </div>
      </div>
    )
  }

  const full = screen === 'welcome' || screen === 'scan'
  const phone = (
    <div
      style={{
        position: 'relative',
        width: W,
        height: H,
        overflow: 'hidden',
        borderRadius: frame ? 46 : 0,
        background: CREAM,
        color: INK,
        fontFamily: "-apple-system, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif",
      }}
    >
      <style>{`
        @keyframes ft-in { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: none } }
        @keyframes ft-pop { from { opacity: 0; transform: translate(-50%, -50%) scale(.6) } to { opacity: 1; transform: translate(-50%, -50%) scale(1) } }
        @keyframes ft-scan { from { top: 4% } to { top: 96% } }
        .ft-scroll { scrollbar-width: none } .ft-scroll::-webkit-scrollbar { display: none }
        .ft-app button:focus-visible, .ft-app input:focus-visible { outline: 2px solid ${accent}; outline-offset: 2px }
      `}</style>
      <StatusBar dark={screen === 'scan'} frame={frame} />
      {full ? (
        <div key={screen} style={{ position: 'absolute', inset: 0, animation: 'ft-in .35s ease' }}>
          {body}
        </div>
      ) : (
        <div key={screen} className="ft-scroll" style={{ position: 'absolute', top: 54, bottom: 92, left: 0, right: 0, overflowY: 'auto', paddingBottom: 20, animation: 'ft-in .3s ease' }}>
          {body}
        </div>
      )}

      {/* the tab bar */}
      {!full && (
        <nav aria-label="Main" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 92, background: INK, borderRadius: '28px 28px 0 0', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-around', padding: '16px 14px 0' }}>
          {NAV.map(([id, icon, label]) =>
            id === 'scan' ? (
              <button key={id} type="button" onClick={() => setScreen('scan')} aria-label={label} style={{ ...iconBtn, width: 52, height: 52, marginTop: -4, borderRadius: 16, background: accent, color: '#fff', boxShadow: `0 8px 20px ${accent}66` }}>
                <Icon name={icon} size={24} />
              </button>
            ) : (
              <button key={id} type="button" onClick={() => setScreen(id)} aria-label={label} aria-current={screen === id ? 'page' : undefined} style={{ ...iconBtn, width: 44, height: 44, color: screen === id ? '#fff' : '#8d8880' }}>
                <Icon name={icon} size={22} fill={screen === id && (id === 'home' || id === 'saved') ? '#fff' : 'none'} />
              </button>
            ),
          )}
        </nav>
      )}

      {/* a small confirmation that slides down from the top */}
      <div role="status" style={{ position: 'absolute', left: '50%', top: 58, zIndex: 30, transform: `translate(-50%, ${toast ? 0 : -90}px)`, transition: 'transform .35s cubic-bezier(.2,.8,.2,1)', padding: '10px 16px', borderRadius: 20, background: INK, color: '#fff', fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap' }}>
        {toast}
      </div>

      {/* home indicator */}
      <div style={{ position: 'absolute', left: '50%', bottom: 8, width: 140, height: 5, marginLeft: -70, borderRadius: 3, background: full && screen === 'welcome' ? INK : '#fff', opacity: 0.85, zIndex: 25 }} />
    </div>
  )

  return (
    <div ref={box} className="ft-app" style={{ position: 'relative', width: '100%', height: '100%', display: 'grid', placeItems: 'center', overflow: 'hidden', background: 'radial-gradient(ellipse at 50% 30%, #ece6df, #cfc7bd 75%)', ...style }}>
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: `translate(-50%, -50%) scale(${scale})`, transformOrigin: 'center' }}>
        {frame ? (
          // the phone body: a pale aluminium band round a black bezel
          <div style={{ padding: 12, borderRadius: 58, background: 'linear-gradient(145deg, #f3f1ee, #c9c5bf 40%, #e8e5e1)', boxShadow: '0 40px 80px rgba(60,40,20,.28), inset 0 0 0 2px #b9b4ad' }}>
            <div style={{ padding: 2, borderRadius: 48, background: '#000' }}>{phone}</div>
          </div>
        ) : (
          phone
        )}
      </div>
    </div>
  )
}
