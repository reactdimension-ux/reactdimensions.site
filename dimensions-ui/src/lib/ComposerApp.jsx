import { memo, useEffect, useId, useRef, useState } from 'react'

// A stories composer on a phone, as a click-through prototype. Camera picks a
// backdrop (a drawn SVG "photo") and shoots it; Edit is the real composer:
// drag text and stickers with one finger, pinch with two to scale AND rotate
// (or use the buttons / mouse wheel, shift + wheel to rotate), drag an item
// onto the bin to delete it, draw with a pen / marker / neon brush, restyle
// the backdrop with a filter, and write text in five font styles with colours
// and backgrounds. Stickers is a searchable emoji / shape / label picker.
// Share posts the story (audience, caption, toggles) and shows a success;
// Drafts saves and reopens your composition, and lists what you posted.
// The phone scales to fit whatever box it is in.

const W = 390 // the phone screen, in CSS px
const H = 844
const CW = 390 // the story canvas (9:16)
const CH = 693
const INK = '#f6f2fb'
const MUTED = '#9a91ad'
const BG = '#0f0b17'
const PANEL = 'rgba(255,255,255,.09)'
const SWATCH = ['#ffffff', '#111111', '#ff4f8b', '#ffd23f', '#3ddc97', '#38bdf8', '#a78bfa', '#ff7a1a']

const ICONS = {
  back: 'M15 5l-7 7 7 7',
  chev: 'M9 5l7 7-7 7',
  x: 'M6 6l12 12M18 6L6 18',
  text: 'M5 6V4h14v2M12 4v16M9 20h6',
  sticker: 'M20 12a8 8 0 1 1-8-8h1l7 7zM13 4v5a3 3 0 0 0 3 3h4M8.5 11h.01M8 15c1.2 1.4 3.2 1.8 5 1',
  brush: 'M4 20c0-2.5 1.5-4 4-4 0 2.5-1.5 4-4 4zM9 16l9-10a2 2 0 0 1 3 3L11 18z',
  filter: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4',
  bolt: 'M13 3L5 13h6l-1 8 8-10h-6z',
  drafts: 'M5 4h14v16H5zM8 9h8M8 13h8M8 17h4',
  flip: 'M4 8h13l-3-3M20 16H7l3 3',
  trash: 'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13M10 11v6M14 11v6',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  rotl: 'M4 12a8 8 0 1 0 3-6.2M4 4v5h5',
  rotr: 'M20 12a8 8 0 1 1-3-6.2M20 4v5h-5',
  copy: 'M8 8h11v12H8zM5 16V4h11',
  front: 'M12 4v14m0-14l-5 5m5-5l5 5M5 21h14',
  check: 'M5 12l5 5 9-10',
  send: 'M4 12l16-8-6 16-3-7z',
  undo: 'M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
  pin: 'M12 21s7-6.2 7-11a7 7 0 0 0-14 0c0 4.8 7 11 7 11zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 20a8 8 0 0 1 16 0',
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

// ------------------------------------------------------------ backdrops

const BACKDROPS = [
  { id: 'sunset', name: 'Sunset' },
  { id: 'city', name: 'City' },
  { id: 'forest', name: 'Forest' },
  { id: 'beach', name: 'Beach' },
  { id: 'desert', name: 'Desert' },
  { id: 'aurora', name: 'Aurora' },
]
const GRADS = [
  { id: 'g1', name: 'Berry', a: '#7b2ff7', b: '#ff4f8b' },
  { id: 'g2', name: 'Lagoon', a: '#0ea5e9', b: '#22d3a0' },
  { id: 'g3', name: 'Ember', a: '#ff7a1a', b: '#e11d48' },
  { id: 'g4', name: 'Night', a: '#0f172a', b: '#4338ca' },
]
const FILTERS = [
  ['none', 'Normal', 'none'],
  ['warm', 'Warm', 'sepia(.4) saturate(1.4) hue-rotate(-10deg)'],
  ['vivid', 'Vivid', 'saturate(1.8) contrast(1.1)'],
  ['mono', 'Mono', 'grayscale(1) contrast(1.15)'],
  ['fade', 'Fade', 'contrast(.8) brightness(1.15) saturate(.7)'],
]

const Backdrop = memo(function Backdrop({ id, front }) {
  const u = useId().replace(/:/g, '')
  const g = GRADS.find((x) => x.id === id)
  const defs = (stops, k = 'a', vertical = true) => (
    <linearGradient id={`${u}${k}`} x1="0" y1="0" x2={vertical ? 0 : 1} y2={vertical ? 1 : 1}>
      {stops.map(([o, c], i) => (
        <stop key={i} offset={o} stopColor={c} />
      ))}
    </linearGradient>
  )
  let art
  if (g) {
    art = (
      <>
        <defs>{defs([[0, g.a], [1, g.b]], 'a', false)}</defs>
        <rect width="390" height="693" fill={`url(#${u}a)`} />
        <circle cx="320" cy="120" r="150" fill="rgba(255,255,255,.1)" />
        <circle cx="40" cy="600" r="190" fill="rgba(255,255,255,.08)" />
      </>
    )
  } else if (id === 'sunset') {
    art = (
      <>
        <defs>{defs([[0, '#3a1c71'], [0.5, '#d76d77'], [1, '#ffaf7b']])}{defs([[0, '#ffaf7b'], [1, '#5b3a8a']], 'w')}</defs>
        <rect width="390" height="693" fill={`url(#${u}a)`} />
        <circle cx="195" cy="360" r="86" fill="#fff0c2" opacity=".95" />
        <path d="M0 400l70-110 60 80 70-130 80 150 50-70 60 90v300H0z" fill="#5b2f6b" opacity=".85" />
        <path d="M0 470c80-50 150-40 220-10s120 20 170-20v253H0z" fill="#3a1f55" />
        <rect y="470" width="390" height="223" fill={`url(#${u}w)`} />
        <rect x="150" y="474" width="90" height="200" fill="#ffe3b3" opacity=".25" />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <path key={i} d={`M${30 + ((i * 97) % 220)} ${500 + i * 28}h${60 + i * 12}`} stroke="rgba(255,255,255,.4)" strokeWidth="4" strokeLinecap="round" />
        ))}
      </>
    )
  } else if (id === 'city') {
    art = (
      <>
        <defs>{defs([[0, '#1b1148'], [0.6, '#8a2f8f'], [1, '#ff8a6b']])}</defs>
        <rect width="390" height="693" fill={`url(#${u}a)`} />
        <circle cx="270" cy="250" r="46" fill="#ffe3b3" />
        {Array.from({ length: 13 }, (_, i) => {
          const h = 160 + ((i * 97) % 230)
          return (
            <g key={i}>
              <rect x={i * 30} y={693 - h} width="29" height={h} fill={i % 2 ? '#1c1030' : '#2a1744'} />
              {Array.from({ length: Math.floor(h / 26) }, (_, k) => ((i * 7 + k * 3) % 4 ? <rect key={k} x={i * 30 + 6 + (k % 2) * 10} y={693 - h + 10 + k * 24} width="6" height="9" fill="#ffd36e" opacity=".9" /> : null))}
            </g>
          )
        })}
      </>
    )
  } else if (id === 'forest') {
    art = (
      <>
        <defs>{defs([[0, '#bfe8d0'], [1, '#f4f0cf']])}</defs>
        <rect width="390" height="693" fill={`url(#${u}a)`} />
        <circle cx="90" cy="150" r="40" fill="#fff7d6" opacity=".9" />
        {[0, 1, 2].map((l) => (
          <g key={l} fill={['#4c8c5c', '#2f6b45', '#17402b'][l]}>
            {Array.from({ length: 8 }, (_, i) => {
              const x = i * 56 - 10 + (l % 2) * 24
              const b = 460 + l * 110
              const t = b - 230 - l * 30 - ((i * 37) % 60)
              return <path key={i} d={`M${x} ${b}L${x + 34} ${t}L${x + 68} ${b}zM${x + 8} ${b - 70}L${x + 34} ${t - 40}L${x + 60} ${b - 70}z`} />
            })}
            <rect y={460 + l * 110} width="390" height="240" />
          </g>
        ))}
      </>
    )
  } else if (id === 'beach') {
    art = (
      <>
        <defs>{defs([[0, '#5fc3ff'], [1, '#d9f3ff']])}{defs([[0, '#1da1c9'], [1, '#6fe0e0']], 'w')}</defs>
        <rect width="390" height="693" fill={`url(#${u}a)`} />
        <circle cx="290" cy="170" r="48" fill="#fff6c9" />
        <rect y="330" width="390" height="220" fill={`url(#${u}w)`} />
        {[0, 1, 2, 3, 4].map((i) => (
          <path key={i} d={`M${20 + i * 40} ${360 + i * 36}h${70 + i * 8}`} stroke="rgba(255,255,255,.6)" strokeWidth="4" strokeLinecap="round" />
        ))}
        <path d="M0 520q90-34 190-12t200-24v209H0z" fill="#f4dcae" />
        <path d="M260 640V470" stroke="#6a4a36" strokeWidth="5" />
        <path d="M200 480a62 40 0 0 1 124 0z" fill="#ff5d73" />
        <path d="M262 480a31 40 0 0 1 62 0z" fill="#fff" opacity=".5" />
      </>
    )
  } else if (id === 'desert') {
    art = (
      <>
        <defs>{defs([[0, '#ffb86b'], [1, '#ffe9c4']])}</defs>
        <rect width="390" height="693" fill={`url(#${u}a)`} />
        <circle cx="110" cy="230" r="70" fill="#fff1c9" />
        <path d="M0 450q100-80 200-20t190-30v293H0z" fill="#e8a066" />
        <path d="M0 540q120-70 230-10t160-20v183H0z" fill="#d1814a" />
        <path d="M0 640q140-50 250-10t140-10v73H0z" fill="#a85f34" />
        <g fill="#2f6b45"><rect x="300" y="470" width="16" height="90" rx="8" /><rect x="282" y="500" width="30" height="12" rx="6" /><rect x="282" y="480" width="12" height="32" rx="6" /></g>
      </>
    )
  } else {
    art = (
      <>
        <defs>{defs([[0, '#050b1f'], [1, '#12304f']])}</defs>
        <rect width="390" height="693" fill={`url(#${u}a)`} />
        {Array.from({ length: 50 }, (_, i) => (
          <circle key={i} cx={(i * 131) % 390} cy={(i * 73) % 420} r={0.6 + ((i * 7) % 5) / 4} fill="#fff" opacity={0.4 + ((i * 13) % 6) / 10} />
        ))}
        <path d="M-10 240Q100 120 200 220T400 190" stroke="#4ade80" strokeWidth="46" fill="none" opacity=".3" />
        <path d="M-10 290Q120 200 210 270T400 250" stroke="#a78bfa" strokeWidth="30" fill="none" opacity=".3" />
        <path d="M0 560q80-60 170-30t220-50v213H0z" fill="#07101e" />
        <path d="M250 600l36-80 36 80z" fill="#ff9a3c" />
        <path d="M274 600l12-30 12 30z" fill="#ffe3a8" />
      </>
    )
  }
  return (
    <svg viewBox="0 0 390 693" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }} aria-hidden="true">
      {art}
      {front && (
        <g>
          <path d="M40 693c4-110 60-160 155-160s151 50 155 160z" fill="#16121f" />
          <rect x="175" y="470" width="40" height="70" rx="14" fill="#c98f6e" />
          <ellipse cx="195" cy="420" rx="52" ry="62" fill="#d9a07c" />
          <path d="M141 414c-3-58 36-80 62-74 36 4 50 36 44 74-10-30-28-40-54-40s-44 10-52 40z" fill="#241913" />
          <circle cx="175" cy="426" r="4" fill="#2b1d16" />
          <circle cx="215" cy="426" r="4" fill="#2b1d16" />
          <path d="M182 452q13 9 26 0" fill="none" stroke="#8a4a3a" strokeWidth="3.5" strokeLinecap="round" />
        </g>
      )}
    </svg>
  )
})

// ------------------------------------------------------------ stickers

const EMOJI = [
  ['😀', 'smile happy'], ['😍', 'love heart eyes'], ['😎', 'cool sunglasses'], ['🥳', 'party celebrate'], ['😂', 'laugh funny'], ['🥹', 'cute emotional'],
  ['🔥', 'fire hot'], ['✨', 'sparkles magic'], ['💖', 'love heart'], ['🎉', 'party confetti'], ['🌈', 'rainbow'], ['☀️', 'sun summer'],
  ['🌙', 'moon night'], ['⭐', 'star'], ['🌸', 'flower blossom'], ['🌴', 'palm beach'], ['🍕', 'pizza food'], ['🍦', 'ice cream'],
  ['☕', 'coffee'], ['🍓', 'strawberry fruit'], ['🎧', 'music headphones'], ['📸', 'camera photo'], ['✈️', 'travel plane'], ['🏖️', 'beach holiday'],
  ['🐶', 'dog pet'], ['🐱', 'cat pet'], ['🦋', 'butterfly'], ['🌻', 'sunflower'], ['💯', 'hundred'], ['👏', 'clap'],
  ['🙌', 'hands'], ['💪', 'strong gym'], ['🎂', 'cake birthday'], ['🎈', 'balloon party'], ['🚀', 'rocket launch'], ['👑', 'crown'],
]

const SHAPES = {
  heart: { name: 'heart love', body: <path d="M32 56C10 40 4 26 10 16c6-9 18-8 22 2 4-10 16-11 22-2 6 10 0 24-22 40z" fill="#ff4d6d" /> },
  star: { name: 'star gold', body: <path d="M32 4l8.5 18.5 20 2.3-15 13.7 4.2 19.9L32 48l-17.7 10.4 4.2-19.9-15-13.7 20-2.3z" fill="#ffd23f" /> },
  bolt: { name: 'bolt lightning energy', body: <path d="M36 2L10 36h16l-6 26 32-38H34z" fill="#ffb703" /> },
  sun: {
    name: 'sun summer',
    body: (
      <>
        <circle cx="32" cy="32" r="12" fill="#ffd23f" />
        {Array.from({ length: 8 }, (_, i) => <path key={i} d="M32 6v8" stroke="#ffb703" strokeWidth="4" strokeLinecap="round" transform={`rotate(${i * 45} 32 32)`} />)}
      </>
    ),
  },
  cloud: { name: 'cloud sky', body: <path d="M18 48a12 12 0 0 1 1-24 16 16 0 0 1 30 4 10 10 0 0 1-2 20z" fill="#e8f1ff" /> },
  burst: { name: 'burst pop', body: <path d={Array.from({ length: 24 }, (_, i) => { const a = (i * Math.PI) / 12; const r = i % 2 ? 20 : 30; return `${i ? 'L' : 'M'}${(32 + Math.cos(a) * r).toFixed(1)} ${(32 + Math.sin(a) * r).toFixed(1)}` }).join('') + 'z'} fill="#ff4f8b" /> },
  arrow: { name: 'arrow point', body: <path d="M6 24h34V12l18 20-18 20V40H6z" fill="#3ddc97" /> },
  speech: { name: 'speech bubble chat', body: <><path d="M8 8h48a4 4 0 0 1 4 4v28a4 4 0 0 1-4 4H30L16 58V44H8a4 4 0 0 1-4-4V12a4 4 0 0 1 4-4z" fill="#fff" /><text x="32" y="32" textAnchor="middle" fontSize="15" fontWeight="800" fill="#111" fontFamily="system-ui">hey!</text></> },
  flame: { name: 'flame fire', body: <><path d="M32 4c4 12 18 18 18 34a18 18 0 0 1-36 0c0-8 4-12 8-16 0 6 4 8 6 8 0-12-2-16 4-26z" fill="#ff7a1a" /><path d="M32 30c2 6 8 8 8 15a8 8 0 0 1-16 0c0-4 2-6 4-8z" fill="#ffd23f" /></> },
  rainbow: { name: 'rainbow', body: <>{['#ff4d6d', '#ffb703', '#3ddc97', '#38bdf8'].map((c, i) => <path key={c} d={`M${6 + i * 6} 50a${26 - i * 6} ${26 - i * 6} 0 0 1 ${52 - i * 12} 0`} stroke={c} strokeWidth="6" fill="none" strokeLinecap="round" />)}</> },
}

function Pill({ children, bg = '#fff', color = '#111', extra }) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 999, background: bg, color, fontSize: 20, fontWeight: 800, whiteSpace: 'nowrap', boxShadow: '0 4px 14px rgba(0,0,0,.25)', ...extra }}>{children}</div>
}
const LABELS = {
  time: { name: 'time clock', node: () => <Pill><Icon name="bolt" size={20} color="#ff4f8b" />{new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</Pill> },
  location: { name: 'location place pin', node: () => <Pill><Icon name="pin" size={20} color="#ff4f8b" />San Francisco</Pill> },
  hashtag: { name: 'hashtag goldenhour', node: () => <Pill bg="linear-gradient(90deg,#ff4f8b,#ff7a1a)" color="#fff">#goldenhour</Pill> },
  mention: { name: 'mention friend', node: () => <Pill bg="#111" color="#fff">@bestie</Pill> },
  poll: {
    name: 'poll vote question',
    node: () => (
      <div style={{ width: 230, borderRadius: 20, overflow: 'hidden', background: '#fff', color: '#111', boxShadow: '0 6px 18px rgba(0,0,0,.3)', textAlign: 'center' }}>
        <div style={{ padding: '10px 12px', fontSize: 17, fontWeight: 800 }}>Beach or city?</div>
        <div style={{ display: 'flex', borderTop: '1px solid #eee' }}>
          <span style={{ flex: 1, padding: 10, fontSize: 15, fontWeight: 800, color: '#ff4f8b' }}>Beach</span>
          <span style={{ flex: 1, padding: 10, fontSize: 15, fontWeight: 800, borderLeft: '1px solid #eee' }}>City</span>
        </div>
      </div>
    ),
  },
  countdown: {
    name: 'countdown timer launch',
    node: () => (
      <div style={{ padding: '10px 18px', borderRadius: 20, background: 'linear-gradient(135deg,#7b2ff7,#ff4f8b)', color: '#fff', textAlign: 'center', boxShadow: '0 6px 18px rgba(0,0,0,.3)' }}>
        <div style={{ fontSize: 13, fontWeight: 700, opacity: 0.9, letterSpacing: '.08em' }}>LAUNCH DAY</div>
        <div style={{ fontSize: 28, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>02 : 14 : 09</div>
      </div>
    ),
  },
}

const FONTS = [
  ['classic', 'Classic', { fontFamily: "Georgia, 'Times New Roman', serif", fontWeight: 700 }],
  ['modern', 'Modern', { fontFamily: "-apple-system, 'Segoe UI', system-ui, sans-serif", fontWeight: 800, letterSpacing: '-0.02em' }],
  ['script', 'Script', { fontFamily: "'Segoe Script', 'Brush Script MT', cursive", fontWeight: 400 }],
  ['mono', 'Mono', { fontFamily: "ui-monospace, Consolas, 'Courier New', monospace", fontWeight: 700 }],
  ['neon', 'Neon', { fontFamily: "-apple-system, 'Segoe UI', system-ui, sans-serif", fontWeight: 700, letterSpacing: '.04em' }],
]
const lum = (c) => {
  const n = parseInt(c.slice(1), 16)
  return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255
}
function textStyle(it) {
  const f = FONTS.find((x) => x[0] === it.font) || FONTS[0]
  const s = { ...f[2], fontSize: it.size || 34, lineHeight: 1.15, textAlign: 'center', whiteSpace: 'pre-wrap', padding: '6px 14px', borderRadius: 12, maxWidth: 320, color: it.color, wordBreak: 'break-word' }
  if (it.bgMode === 1) {
    s.background = it.color
    s.color = lum(it.color) > 0.55 ? '#111' : '#fff'
  } else if (it.bgMode === 2) s.background = 'rgba(0,0,0,.55)'
  else if (it.font === 'neon') s.textShadow = `0 0 6px ${it.color}, 0 0 16px ${it.color}, 0 0 30px ${it.color}`
  else s.textShadow = '0 2px 8px rgba(0,0,0,.45)'
  return s
}

function ItemBody({ it }) {
  if (it.type === 'text') return <div style={textStyle(it)}>{it.text}</div>
  if (it.type === 'emoji') return <div style={{ fontSize: 76, lineHeight: 1, filter: 'drop-shadow(0 4px 8px rgba(0,0,0,.3))' }}>{it.char}</div>
  if (it.type === 'shape') return <svg width="96" height="96" viewBox="0 0 64 64" style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,.3))', display: 'block' }}>{SHAPES[it.shape]?.body}</svg>
  return LABELS[it.label]?.node() || null
}

const strokePath = (pts) => (pts.length === 1 ? `M${pts[0][0]} ${pts[0][1]}l.01 0` : pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(''))

// Draws the whole story. Static: all gestures are handled by the parent.
function StoryLayers({ comp, selId, dragId, over, front }) {
  const css = FILTERS.find((f) => f[0] === comp.filter)?.[2] || 'none'
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: '#000' }}>
      <div style={{ position: 'absolute', inset: 0, filter: css }}>
        <Backdrop id={comp.bg} front={front} />
      </div>
      <svg viewBox={`0 0 ${CW} ${CH}`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} aria-hidden="true">
        {comp.strokes.map((s) => (
          <g key={s.id} fill="none" strokeLinecap="round" strokeLinejoin="round">
            {s.type === 'neon' && <path d={strokePath(s.pts)} stroke={s.color} strokeWidth={s.size * 2.6} opacity=".35" />}
            <path d={strokePath(s.pts)} stroke={s.type === 'neon' ? '#fff' : s.color} strokeWidth={s.type === 'marker' ? s.size * 1.8 : s.size} opacity={s.type === 'marker' ? 0.55 : 1} />
          </g>
        ))}
      </svg>
      {comp.items.map((it) => (
        <div key={it.id} data-id={it.id} style={{ position: 'absolute', left: it.x, top: it.y, width: 'max-content', transform: `translate(-50%, -50%) rotate(${it.r}deg) scale(${dragId === it.id && over ? it.s * 0.5 : it.s})`, transformOrigin: 'center', opacity: dragId === it.id && over ? 0.6 : 1, transition: dragId === it.id ? 'opacity .15s' : 'none', outline: selId === it.id ? '2px dashed rgba(255,255,255,.85)' : 'none', outlineOffset: 6, borderRadius: 8, touchAction: 'none', cursor: 'grab', userSelect: 'none' }}>
          <ItemBody it={it} />
        </div>
      ))}
    </div>
  )
}

function Mini({ comp, k = 0.4 }) {
  return (
    <div style={{ position: 'relative', width: CW * k, height: CH * k, overflow: 'hidden', borderRadius: 14, background: '#000' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, width: CW, height: CH, transform: `scale(${k})`, transformOrigin: '0 0' }}>
        <StoryLayers comp={comp} />
      </div>
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

const ago = (t) => {
  const m = Math.round((Date.now() - t) / 60000)
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`
}
const PEOPLE = ['Ava', 'Leo', 'Mia', 'Sam', 'Zoe']
let uidCounter = 1
const nid = (p) => `${p}${Date.now().toString(36)}${uidCounter++}`
const blank = (bg = 'sunset') => ({ bg, filter: 'none', items: [], strokes: [] })
const txt = (text, o = {}) => ({ id: nid('t'), type: 'text', text, color: '#ffffff', font: 'modern', bgMode: 0, size: 38, x: 195, y: 250, s: 1, r: 0, ...o })

// ---------------------------------------------------------------- app

export default function ComposerApp({ name = 'Spark', accent = '#ff4f8b', startScreen = 'camera', frame = true, style }) {
  const box = useRef()
  const canvas = useRef()
  const toastTimer = useRef()
  const flashTimer = useRef()
  const postTimer = useRef()
  const ptrs = useRef(new Map())
  const gesture = useRef(null)
  const compRef = useRef(null)
  const selRef = useRef(null)
  const toolRef = useRef('none')
  const brushRef = useRef({ color: '#ffffff', size: 8, type: 'pen' })
  const lastTap = useRef({ id: null, t: 0 })
  const [scale, setScale] = useState(1)
  const [stack, setStack] = useState([])
  const [dir, setDir] = useState(1)
  const [toast, setToast] = useState('')
  const [comp, setComp] = useState(() => blank())
  const [draftId, setDraftId] = useState(null)
  const [sel, setSel] = useState(null)
  const [tool, setTool] = useState('none') // none | draw
  const [brush, setBrush] = useState({ color: '#ffffff', size: 8, type: 'pen' })
  const [textEdit, setTextEdit] = useState(null)
  const [drag, setDrag] = useState(null) // { id, over }
  const [leave, setLeave] = useState(false)
  const [camMode, setCamMode] = useState('story')
  const [camBg, setCamBg] = useState('sunset')
  const [camGrad, setCamGrad] = useState('g1')
  const [front, setFront] = useState(false)
  const [flash, setFlash] = useState(false)
  const [flashKey, setFlashKey] = useState(0)
  const [drafts, setDrafts] = useState(() => {
    const now = Date.now()
    return [
      { id: 'd1', saved: now - 2 * 3600e3, comp: { bg: 'city', filter: 'vivid', strokes: [], items: [txt('Night out', { id: 'a1', font: 'neon', color: '#ff4f8b', y: 210, r: -6, size: 52 }), { id: 'a2', type: 'emoji', char: '🥳', x: 290, y: 430, s: 1, r: 14 }] } },
      { id: 'd2', saved: now - 26 * 3600e3, comp: { bg: 'g3', filter: 'none', strokes: [], items: [txt('Monday mood', { id: 'b1', font: 'classic', bgMode: 1, color: '#ffd23f', y: 300 }), { id: 'b2', type: 'shape', shape: 'star', color: '', x: 120, y: 470, s: 1.3, r: -12 }] } },
    ]
  })
  const [posted, setPosted] = useState([])
  const [draftTab, setDraftTab] = useState('drafts')
  const [stickTab, setStickTab] = useState('emoji')
  const [stickQ, setStickQ] = useState('')
  const [share, setShare] = useState({ audience: 'story', caption: '', feed: false, replies: true, to: [] })
  const [posting, setPosting] = useState(false)

  compRef.current = comp
  selRef.current = sel
  toolRef.current = tool
  brushRef.current = brush

  const startComp = () => ({ bg: 'sunset', filter: 'none', strokes: [], items: [txt('Golden hour', { id: 's1', font: 'classic', y: 230, size: 46 }), { id: 's2', type: 'emoji', char: '🌅', x: 280, y: 420, s: 1, r: 12 }] })
  const initStack = (s) => {
    if (s === 'edit') return [{ id: 'edit' }]
    if (s === 'stickers') return [{ id: 'edit' }, { id: 'stickers' }]
    if (s === 'share') return [{ id: 'edit' }, { id: 'share' }]
    if (s === 'drafts') return [{ id: 'drafts' }]
    return []
  }
  useEffect(() => {
    if (startScreen !== 'camera') {
      setComp(startComp())
      setDraftId(null)
    }
    setStack(initStack(startScreen))
    setSel(null)
    setTool('none')
    setTextEdit(null)
    setLeave(false)
    setPosting(false)
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
      clearTimeout(toastTimer.current)
      clearTimeout(flashTimer.current)
      clearTimeout(postTimer.current)
    },
    [],
  )

  const say = (t) => {
    setToast(t)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 1800)
  }
  const top = stack[stack.length - 1]
  const screen = top?.id || 'camera'
  const push = (s) => (setDir(1), setStack((a) => [...a, s]))
  const pop = () => (setDir(-1), setStack((a) => a.slice(0, -1)))
  const reset = (to = []) => (setDir(-1), setStack(to), setSel(null), setTool('none'))

  const patch = (id, p) => setComp((c) => ({ ...c, items: c.items.map((i) => (i.id === id ? { ...i, ...(typeof p === 'function' ? p(i) : p) } : i)) }))
  const addItem = (it) => {
    setComp((c) => ({ ...c, items: [...c.items, it] }))
    setSel(it.id)
  }
  const removeItem = (id) => {
    setComp((c) => ({ ...c, items: c.items.filter((i) => i.id !== id) }))
    setSel((s) => (s === id ? null : s))
  }
  const dirty = comp.items.length > 0 || comp.strokes.length > 0

  // ---- shoot
  const shoot = () => {
    if (flash && !front) {
      setFlashKey((k) => k + 1)
    }
    clearTimeout(flashTimer.current)
    flashTimer.current = setTimeout(() => {
      const bg = camMode === 'text' ? camGrad : camBg
      setComp({ ...blank(bg), items: [] })
      setDraftId(null)
      setSel(null)
      push({ id: 'edit' })
      if (camMode === 'text') setTextEdit({ id: null, text: '', color: '#ffffff', font: 'modern', bgMode: 0, size: 40 })
    }, 220)
  }

  // ---- canvas gestures
  const toCanvas = (e) => {
    const r = canvas.current.getBoundingClientRect()
    return { x: ((e.clientX - r.left) * CW) / r.width, y: ((e.clientY - r.top) * CH) / r.height }
  }
  const onDown = (e) => {
    if (textEdit) return
    const pt = toCanvas(e)
    ptrs.current.set(e.pointerId, pt)
    canvas.current.setPointerCapture?.(e.pointerId)
    const items = compRef.current.items
    if (ptrs.current.size === 2) {
      const id = gesture.current?.id ?? selRef.current
      const it = items.find((i) => i.id === id)
      if (!it) return
      const [a, b] = [...ptrs.current.values()]
      gesture.current = { mode: 'pinch', id, d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, a0: Math.atan2(b.y - a.y, b.x - a.x), s0: it.s, r0: it.r }
      setDrag(null)
      return
    }
    if (toolRef.current === 'draw') {
      const b = brushRef.current
      const stroke = { id: nid('k'), color: b.color, size: b.size, type: b.type, pts: [[pt.x, pt.y]] }
      gesture.current = { mode: 'draw', sid: stroke.id }
      setComp((c) => ({ ...c, strokes: [...c.strokes, stroke] }))
      return
    }
    const hit = e.target.closest?.('[data-id]')
    const it = hit && items.find((i) => i.id === hit.getAttribute('data-id'))
    if (it) {
      gesture.current = { mode: 'drag', id: it.id, ox: it.x - pt.x, oy: it.y - pt.y, sx: pt.x, sy: pt.y, moved: false, was: selRef.current === it.id }
      setSel(it.id)
    } else {
      gesture.current = null
      setSel(null)
    }
  }
  const onMove = (e) => {
    if (!ptrs.current.has(e.pointerId)) return
    const pt = toCanvas(e)
    ptrs.current.set(e.pointerId, pt)
    const g = gesture.current
    if (!g) return
    if (g.mode === 'pinch' && ptrs.current.size >= 2) {
      const [a, b] = [...ptrs.current.values()]
      const d = Math.hypot(a.x - b.x, a.y - b.y)
      const ang = Math.atan2(b.y - a.y, b.x - a.x)
      patch(g.id, { s: Math.max(0.25, Math.min(6, (g.s0 * d) / g.d0)), r: g.r0 + ((ang - g.a0) * 180) / Math.PI })
    } else if (g.mode === 'drag') {
      const x = Math.max(0, Math.min(CW, pt.x + g.ox))
      const y = Math.max(0, Math.min(CH, pt.y + g.oy))
      if (!g.moved && Math.hypot(pt.x - g.sx, pt.y - g.sy) < 4) return
      g.moved = true
      patch(g.id, { x, y })
      setDrag({ id: g.id, over: Math.hypot(pt.x - CW / 2, pt.y - 640) < 58 })
    } else if (g.mode === 'draw') {
      setComp((c) => ({ ...c, strokes: c.strokes.map((s) => (s.id === g.sid ? { ...s, pts: [...s.pts, [pt.x, pt.y]] } : s)) }))
    }
  }
  const onUp = (e) => {
    const pt = ptrs.current.get(e.pointerId) || toCanvas(e)
    ptrs.current.delete(e.pointerId)
    const g = gesture.current
    if (!g) return
    if (g.mode === 'pinch') {
      if (ptrs.current.size === 1) {
        const [rest] = [...ptrs.current.values()]
        const it = compRef.current.items.find((i) => i.id === g.id)
        gesture.current = it ? { mode: 'drag', id: g.id, ox: it.x - rest.x, oy: it.y - rest.y, sx: rest.x, sy: rest.y, moved: true, was: true } : null
      } else gesture.current = null
      return
    }
    gesture.current = null
    if (g.mode === 'drag') {
      const it = compRef.current.items.find((i) => i.id === g.id)
      if (g.moved && Math.hypot(pt.x - CW / 2, pt.y - 640) < 58) {
        removeItem(g.id)
        say('Removed')
      } else if (!g.moved && it) {
        const now = Date.now()
        if (it.type === 'text' && (g.was || (lastTap.current.id === it.id && now - lastTap.current.t < 350))) {
          setTextEdit({ id: it.id, text: it.text, color: it.color, font: it.font, bgMode: it.bgMode, size: it.size })
        }
        lastTap.current = { id: it.id, t: now }
      }
      setDrag(null)
    }
  }
  const onWheel = (e) => {
    const id = selRef.current
    if (!id) return
    if (e.shiftKey) patch(id, (i) => ({ r: i.r + (e.deltaY > 0 ? 8 : -8) }))
    else patch(id, (i) => ({ s: Math.max(0.25, Math.min(6, i.s * Math.exp(-e.deltaY * 0.002))) }))
  }

  const commitText = () => {
    const t = textEdit
    setTextEdit(null)
    if (!t.text.trim()) {
      if (t.id) removeItem(t.id)
      return
    }
    if (t.id) patch(t.id, { text: t.text, color: t.color, font: t.font, bgMode: t.bgMode, size: t.size })
    else addItem(txt(t.text, { color: t.color, font: t.font, bgMode: t.bgMode, size: t.size, y: 280 + (comp.items.length % 4) * 50 }))
  }

  const saveDraft = () => {
    const id = draftId || nid('d')
    const snap = { ...comp, items: comp.items.map((i) => ({ ...i })), strokes: comp.strokes.map((s) => ({ ...s })) }
    setDrafts((a) => [{ id, saved: Date.now(), comp: snap }, ...a.filter((d) => d.id !== id)])
    setDraftId(id)
    say('Saved to Drafts')
    return id
  }

  const doPost = () => {
    setPosting(true)
    clearTimeout(postTimer.current)
    postTimer.current = setTimeout(() => {
      setPosting(false)
      const aud = share.audience === 'friends' ? 'Close friends' : share.to.length ? `${share.to.length} people` : 'Your story'
      setPosted((a) => [{ id: nid('p'), comp, at: Date.now(), aud, caption: share.caption, views: 0 }, ...a])
      if (draftId) setDrafts((a) => a.filter((d) => d.id !== draftId))
      setDir(1)
      setStack((s) => [...s, { id: 'done', aud }])
    }, 1100)
  }

  const header = (title, right, onBack = pop) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px 6px', minHeight: 52 }}>
      <button type="button" onClick={onBack} aria-label="Back" style={{ ...iconBtn, width: 38, height: 38, background: PANEL }}>
        <Icon name="back" size={20} />
      </button>
      <h1 style={{ margin: 0, flex: 1, fontSize: 19, fontWeight: 800, marginLeft: 4 }}>{title}</h1>
      {right}
    </div>
  )
  const gradBtn = (label, onClick, disabled, extra) => (
    <button type="button" onClick={onClick} disabled={disabled} style={{ height: 50, padding: '0 24px', borderRadius: 25, border: 'none', background: disabled ? '#3a3347' : `linear-gradient(135deg, ${accent}, #ff7a1a)`, color: '#fff', font: 'inherit', fontSize: 15, fontWeight: 800, cursor: disabled ? 'default' : 'pointer', boxShadow: disabled ? 'none' : `0 8px 22px ${accent}55`, ...extra }}>
      {label}
    </button>
  )
  const switchRow = (label, sub, on, set) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,.07)' }}>
      <span>
        <span style={{ display: 'block', fontSize: 14.5, fontWeight: 600 }}>{label}</span>
        {sub && <span style={{ display: 'block', fontSize: 12, color: MUTED }}>{sub}</span>}
      </span>
      <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => set(!on)} style={{ width: 48, height: 28, borderRadius: 14, border: 'none', padding: 3, background: on ? accent : '#3a3347', cursor: 'pointer', transition: 'background .2s', flex: 'none' }}>
        <span style={{ display: 'block', width: 22, height: 22, borderRadius: '50%', background: '#fff', transform: `translateX(${on ? 20 : 0}px)`, transition: 'transform .2s' }} />
      </button>
    </div>
  )

  // ---------------- screens
  let body
  let overlay = null
  let full = false // body fills the phone (no 54px inset)

  if (screen === 'edit') {
    full = true
    const it = comp.items.find((i) => i.id === sel)
    const drawing = tool === 'draw'
    const filterIdx = FILTERS.findIndex((f) => f[0] === comp.filter)
    const back = () => (dirty ? setLeave(true) : (setTool('none'), pop()))
    const railBtn = (icon, label, fn, on) => (
      <button type="button" onClick={fn} aria-label={label} aria-pressed={!!on} style={{ ...iconBtn, width: 42, height: 42, background: on ? accent : 'rgba(0,0,0,.45)', backdropFilter: 'blur(6px)', color: '#fff' }}>
        <Icon name={icon} size={21} />
      </button>
    )
    body = (
      <div style={{ position: 'absolute', inset: 0 }}>
        <div
          ref={canvas}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onWheel={onWheel}
          aria-label="Story canvas"
          style={{ position: 'absolute', left: 0, top: 54, width: CW, height: CH, touchAction: 'none', cursor: drawing ? 'crosshair' : 'default', overflow: 'hidden' }}
        >
          <StoryLayers comp={comp} selId={drawing ? null : sel} dragId={drag?.id} over={drag?.over} />
          {drag && (
            <div style={{ position: 'absolute', left: CW / 2 - 30, top: 640 - 30, width: 60, height: 60, borderRadius: '50%', display: 'grid', placeItems: 'center', background: drag.over ? '#e5383b' : 'rgba(0,0,0,.55)', color: '#fff', transform: `scale(${drag.over ? 1.3 : 1})`, transition: 'transform .15s, background .15s', pointerEvents: 'none', boxShadow: '0 6px 18px rgba(0,0,0,.4)' }}>
              <Icon name="trash" size={26} />
            </div>
          )}
        </div>
        {/* top bar */}
        {!textEdit && (
          <div style={{ position: 'absolute', top: 58, left: 12, right: 12, display: 'flex', justifyContent: 'space-between', pointerEvents: 'none' }}>
            <div style={{ pointerEvents: 'auto' }}>{railBtn('back', 'Back', back)}</div>
            <div style={{ display: 'flex', gap: 8, pointerEvents: 'auto' }}>
              {railBtn('text', 'Add text', () => (setTool('none'), setTextEdit({ id: null, text: '', color: '#ffffff', font: 'modern', bgMode: 0, size: 40 })))}
              {railBtn('sticker', 'Stickers', () => (setTool('none'), push({ id: 'stickers' })))}
              {railBtn('brush', 'Draw', () => (setSel(null), setTool(drawing ? 'none' : 'draw')), drawing)}
              {railBtn('filter', `Filter: ${FILTERS[filterIdx][1]}`, () => {
                const n = FILTERS[(filterIdx + 1) % FILTERS.length]
                setComp((c) => ({ ...c, filter: n[0] }))
                say(`Filter: ${n[1]}`)
              })}
            </div>
          </div>
        )}
        {/* selection toolbar */}
        {it && !drawing && !textEdit && !drag && (
          <div style={{ position: 'absolute', left: '50%', top: 54 + 676, transform: 'translate(-50%, -100%)', display: 'flex', gap: 4, padding: 5, borderRadius: 26, background: 'rgba(15,11,23,.82)', backdropFilter: 'blur(10px)', boxShadow: '0 8px 24px rgba(0,0,0,.4)' }} role="toolbar" aria-label="Selected item">
            {it.type === 'text' && <button type="button" onClick={() => setTextEdit({ id: it.id, text: it.text, color: it.color, font: it.font, bgMode: it.bgMode, size: it.size })} aria-label="Edit text" style={{ ...iconBtn, width: 38, height: 38 }}><Icon name="edit" size={19} /></button>}
            <button type="button" onClick={() => patch(it.id, (i) => ({ s: Math.max(0.25, i.s / 1.18) }))} aria-label="Smaller" style={{ ...iconBtn, width: 38, height: 38 }}><Icon name="minus" size={19} /></button>
            <button type="button" onClick={() => patch(it.id, (i) => ({ s: Math.min(6, i.s * 1.18) }))} aria-label="Bigger" style={{ ...iconBtn, width: 38, height: 38 }}><Icon name="plus" size={19} /></button>
            <button type="button" onClick={() => patch(it.id, (i) => ({ r: i.r - 15 }))} aria-label="Rotate left" style={{ ...iconBtn, width: 38, height: 38 }}><Icon name="rotl" size={19} /></button>
            <button type="button" onClick={() => patch(it.id, (i) => ({ r: i.r + 15 }))} aria-label="Rotate right" style={{ ...iconBtn, width: 38, height: 38 }}><Icon name="rotr" size={19} /></button>
            <button type="button" onClick={() => (addItem({ ...it, id: nid('c'), x: Math.min(CW, it.x + 28), y: Math.min(CH, it.y + 28) }), say('Duplicated'))} aria-label="Duplicate" style={{ ...iconBtn, width: 38, height: 38 }}><Icon name="copy" size={19} /></button>
            <button type="button" onClick={() => (setComp((c) => ({ ...c, items: [...c.items.filter((i) => i.id !== it.id), it] })), say('Brought to front'))} aria-label="Bring to front" style={{ ...iconBtn, width: 38, height: 38 }}><Icon name="front" size={19} /></button>
            <button type="button" onClick={() => (removeItem(it.id), say('Removed'))} aria-label="Delete item" style={{ ...iconBtn, width: 38, height: 38, color: '#ff6b6b' }}><Icon name="trash" size={19} /></button>
          </div>
        )}
        {/* draw panel */}
        {drawing && !textEdit && (
          <div style={{ position: 'absolute', left: 10, right: 10, top: 54 + 520, padding: '12px 14px', borderRadius: 22, background: 'rgba(15,11,23,.85)', backdropFilter: 'blur(12px)', display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {[['pen', 'Pen'], ['marker', 'Marker'], ['neon', 'Neon']].map(([k, l]) => (
                <button key={k} type="button" onClick={() => setBrush((b) => ({ ...b, type: k }))} aria-pressed={brush.type === k} style={{ height: 32, padding: '0 14px', borderRadius: 16, border: 'none', background: brush.type === k ? accent : PANEL, color: '#fff', font: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>{l}</button>
              ))}
              <span style={{ flex: 1 }} />
              <button type="button" onClick={() => setComp((c) => ({ ...c, strokes: c.strokes.slice(0, -1) }))} disabled={!comp.strokes.length} aria-label="Undo stroke" style={{ ...iconBtn, width: 34, height: 34, background: PANEL, opacity: comp.strokes.length ? 1 : 0.4 }}><Icon name="undo" size={17} /></button>
              <button type="button" onClick={() => setTool('none')} style={{ height: 34, padding: '0 14px', borderRadius: 17, border: 'none', background: '#fff', color: '#111', font: 'inherit', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>Done</button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ display: 'flex', gap: 8, flex: 1 }}>
                {SWATCH.map((c) => (
                  <button key={c} type="button" onClick={() => setBrush((b) => ({ ...b, color: c }))} aria-label={`Colour ${c}`} aria-pressed={brush.color === c} style={{ width: 26, height: 26, borderRadius: '50%', border: brush.color === c ? '3px solid #fff' : '2px solid rgba(255,255,255,.35)', background: c, padding: 0, cursor: 'pointer' }} />
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: MUTED }}>
              Size
              <input type="range" min="3" max="28" value={brush.size} onChange={(e) => setBrush((b) => ({ ...b, size: +e.target.value }))} aria-label="Brush size" style={{ flex: 1, accentColor: accent }} />
              <span style={{ width: brush.size, height: brush.size, borderRadius: '50%', background: brush.color, flex: 'none', maxWidth: 28 }} />
            </div>
          </div>
        )}
        {/* bottom bar */}
        <div style={{ position: 'absolute', left: 0, right: 0, top: 54 + CH, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px 12px' }}>
          <button type="button" onClick={saveDraft} style={{ height: 46, padding: '0 18px', borderRadius: 23, border: 'none', background: PANEL, color: INK, font: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="drafts" size={18} /> Save draft
          </button>
          {gradBtn(<span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>Share <Icon name="chev" size={17} w={2.6} /></span>, () => (setTool('none'), setSel(null), push({ id: 'share' })), false, { height: 46 })}
        </div>
        {/* text editor */}
        {textEdit && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 20, background: 'rgba(8,5,14,.78)', backdropFilter: 'blur(8px)', animation: 'cp-fade .2s ease' }}>
            <div style={{ position: 'absolute', top: 58, left: 14, right: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button type="button" onClick={() => setTextEdit(null)} aria-label="Cancel text" style={{ ...iconBtn, width: 40, height: 40, background: PANEL }}><Icon name="x" size={20} /></button>
              <button type="button" onClick={() => setTextEdit((t) => ({ ...t, bgMode: (t.bgMode + 1) % 3 }))} aria-label="Text background" style={{ ...iconBtn, width: 40, height: 40, background: textEdit.bgMode ? '#fff' : PANEL, color: textEdit.bgMode ? '#111' : '#fff', fontWeight: 800, fontSize: 17, fontFamily: 'Georgia, serif' }}>A</button>
              <button type="button" onClick={commitText} style={{ height: 40, padding: '0 20px', borderRadius: 20, border: 'none', background: '#fff', color: '#111', font: 'inherit', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>Done</button>
            </div>
            <div className="cp-scroll" style={{ position: 'absolute', top: 112, left: 0, right: 0, display: 'flex', gap: 8, padding: '0 14px', overflowX: 'auto' }} role="group" aria-label="Font style">
              {FONTS.map(([k, l, fs]) => (
                <button key={k} type="button" onClick={() => setTextEdit((t) => ({ ...t, font: k }))} aria-pressed={textEdit.font === k} style={{ flex: 'none', height: 38, padding: '0 16px', borderRadius: 19, border: 'none', background: textEdit.font === k ? '#fff' : PANEL, color: textEdit.font === k ? '#111' : '#fff', fontSize: 16, cursor: 'pointer', ...fs }}>{l}</button>
              ))}
            </div>
            <div style={{ position: 'absolute', top: 180, left: 20, right: 20, bottom: 200, display: 'grid', placeItems: 'center' }}>
              <textarea
                autoFocus
                value={textEdit.text}
                onChange={(e) => setTextEdit((t) => ({ ...t, text: e.target.value }))}
                placeholder="Type something"
                aria-label="Story text"
                rows={3}
                maxLength={120}
                style={{ ...textStyle({ ...textEdit, text: '' }), width: 330, minHeight: 90, border: 'none', outline: 'none', resize: 'none', background: textEdit.bgMode === 0 ? 'transparent' : textStyle(textEdit).background, caretColor: '#fff', boxSizing: 'border-box', overflow: 'hidden' }}
              />
            </div>
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 40, display: 'grid', gap: 14, padding: '0 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: MUTED }}>
                Size
                <input type="range" min="22" max="72" value={textEdit.size} onChange={(e) => setTextEdit((t) => ({ ...t, size: +e.target.value }))} aria-label="Text size" style={{ flex: 1, accentColor: accent }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                {SWATCH.map((c) => (
                  <button key={c} type="button" onClick={() => setTextEdit((t) => ({ ...t, color: c }))} aria-label={`Text colour ${c}`} aria-pressed={textEdit.color === c} style={{ width: 32, height: 32, borderRadius: '50%', border: textEdit.color === c ? '3px solid #fff' : '2px solid rgba(255,255,255,.35)', background: c, padding: 0, cursor: 'pointer' }} />
                ))}
              </div>
            </div>
          </div>
        )}
        {leave && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 25, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'flex-end', animation: 'cp-fade .2s ease' }}>
            <div style={{ width: '100%', background: '#1c1527', borderRadius: '24px 24px 0 0', padding: '22px 20px 34px', display: 'grid', gap: 10, animation: 'cp-up .25s ease' }}>
              <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 17 }}>Discard this story?</div>
              <div style={{ textAlign: 'center', color: MUTED, fontSize: 13, marginBottom: 6 }}>If you go back now, you will lose your edits.</div>
              {gradBtn('Save as draft', () => (saveDraft(), setLeave(false), setTool('none'), pop()), false, { width: '100%' })}
              <button type="button" onClick={() => (setLeave(false), setTool('none'), pop())} style={{ height: 48, border: 'none', borderRadius: 24, background: 'rgba(229,56,59,.18)', color: '#ff6b6b', font: 'inherit', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>Discard</button>
              <button type="button" onClick={() => setLeave(false)} style={{ height: 44, border: 'none', background: 'none', color: INK, font: 'inherit', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Keep editing</button>
            </div>
          </div>
        )}
      </div>
    )
  } else if (screen === 'stickers') {
    const q = stickQ.trim().toLowerCase()
    const match = (n) => !q || n.toLowerCase().includes(q)
    const addSticker = (it) => {
      setComp((c) => ({ ...c, items: [...c.items, { id: nid('s'), x: 195 + ((c.items.length * 23) % 80) - 40, y: 340 + ((c.items.length * 31) % 120), s: 1, r: ((c.items.length * 7) % 20) - 10, ...it }] }))
      setSel(null)
      pop()
      say('Sticker added. Drag, pinch or use the toolbar.')
    }
    const tabs = [['emoji', 'Emoji'], ['shapes', 'Shapes'], ['labels', 'Labels']]
    let grid
    if (stickTab === 'emoji') {
      const list = EMOJI.filter(([, n]) => match(n))
      grid = (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
          {list.map(([c, n]) => (
            <button key={c} type="button" onClick={() => addSticker({ type: 'emoji', char: c })} aria-label={n.split(' ')[0]} style={{ aspectRatio: '1', border: 'none', borderRadius: 16, background: PANEL, fontSize: 32, cursor: 'pointer' }}>{c}</button>
          ))}
          {!list.length && <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: MUTED, padding: 30 }}>No emoji match.</div>}
        </div>
      )
    } else if (stickTab === 'shapes') {
      const list = Object.entries(SHAPES).filter(([, v]) => match(v.name))
      grid = (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {list.map(([k, v]) => (
            <button key={k} type="button" onClick={() => addSticker({ type: 'shape', shape: k })} aria-label={v.name.split(' ')[0]} style={{ aspectRatio: '1', border: 'none', borderRadius: 20, background: PANEL, cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
              <svg width="64" height="64" viewBox="0 0 64 64">{v.body}</svg>
            </button>
          ))}
          {!list.length && <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: MUTED, padding: 30 }}>No shapes match.</div>}
        </div>
      )
    } else {
      const list = Object.entries(LABELS).filter(([, v]) => match(v.name))
      grid = (
        <div style={{ display: 'grid', gap: 12 }}>
          {list.map(([k, v]) => (
            <button key={k} type="button" onClick={() => addSticker({ type: 'label', label: k })} aria-label={v.name.split(' ')[0]} style={{ border: 'none', borderRadius: 20, background: PANEL, cursor: 'pointer', padding: '16px 10px', display: 'grid', placeItems: 'center' }}>
              <div style={{ transform: 'scale(.8)', transformOrigin: 'center' }}>{v.node()}</div>
            </button>
          ))}
          {!list.length && <div style={{ textAlign: 'center', color: MUTED, padding: 30 }}>No labels match.</div>}
        </div>
      )
    }
    body = (
      <>
        {header('Stickers')}
        <div style={{ padding: '4px 16px 8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 44, padding: '0 14px', borderRadius: 22, background: PANEL }}>
            <Icon name="search" size={18} color={MUTED} />
            <input value={stickQ} onChange={(e) => setStickQ(e.target.value)} placeholder="Search stickers" aria-label="Search stickers" style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'none', font: 'inherit', fontSize: 15, color: INK }} />
            {stickQ && <button type="button" onClick={() => setStickQ('')} aria-label="Clear" style={{ ...iconBtn, width: 24, height: 24 }}><Icon name="x" size={15} /></button>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, padding: '4px 16px 12px' }} role="tablist">
          {tabs.map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={stickTab === k} onClick={() => setStickTab(k)} style={{ flex: 1, height: 38, borderRadius: 19, border: 'none', background: stickTab === k ? '#fff' : PANEL, color: stickTab === k ? '#111' : INK, font: 'inherit', fontSize: 13.5, fontWeight: 800, cursor: 'pointer' }}>{l}</button>
          ))}
        </div>
        <div style={{ padding: '0 16px' }}>{grid}</div>
      </>
    )
  } else if (screen === 'share') {
    const toggleTo = (p) => setShare((s) => ({ ...s, to: s.to.includes(p) ? s.to.filter((x) => x !== p) : [...s.to, p] }))
    const radio = (k, label, sub) => (
      <button key={k} type="button" onClick={() => setShare((s) => ({ ...s, audience: k }))} role="radio" aria-checked={share.audience === k} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '12px 14px', border: 'none', borderRadius: 16, background: share.audience === k ? `${accent}26` : PANEL, outline: share.audience === k ? `2px solid ${accent}` : 'none', color: INK, font: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
        <span style={{ width: 36, height: 36, borderRadius: '50%', display: 'grid', placeItems: 'center', background: k === 'friends' ? '#22c55e' : `linear-gradient(135deg, ${accent}, #ff7a1a)`, color: '#fff' }}><Icon name={k === 'friends' ? 'user' : 'plus'} size={18} /></span>
        <span style={{ flex: 1, fontSize: 14.5, fontWeight: 700 }}>{label}<span style={{ display: 'block', fontSize: 12, color: MUTED, fontWeight: 500 }}>{sub}</span></span>
        {share.audience === k && <Icon name="check" size={20} color={accent} w={2.6} />}
      </button>
    )
    body = (
      <>
        {header('Share story')}
        <div style={{ display: 'flex', gap: 14, padding: '4px 16px 12px' }}>
          <Mini comp={comp} k={0.36} />
          <div style={{ flex: 1, display: 'grid', alignContent: 'start', gap: 8 }}>
            <label htmlFor="cp-cap" style={{ fontSize: 12, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '.07em' }}>Caption</label>
            <textarea id="cp-cap" value={share.caption} onChange={(e) => setShare((s) => ({ ...s, caption: e.target.value }))} placeholder="Write a caption…" maxLength={90} rows={4} style={{ width: '100%', boxSizing: 'border-box', borderRadius: 14, border: 'none', background: PANEL, color: INK, font: 'inherit', fontSize: 14, padding: 12, resize: 'none', outline: 'none' }} />
            <div style={{ fontSize: 11.5, color: MUTED, textAlign: 'right' }}>{share.caption.length}/90</div>
          </div>
        </div>
        <div role="radiogroup" aria-label="Audience" style={{ display: 'grid', gap: 8, padding: '0 16px' }}>
          {radio('story', 'Your story', 'Visible to followers for 24 hours')}
          {radio('friends', 'Close friends', '12 people')}
        </div>
        <div style={{ padding: '14px 16px 6px', fontSize: 12, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '.07em' }}>Also send to</div>
        <div className="cp-scroll" style={{ display: 'flex', gap: 12, padding: '0 16px', overflowX: 'auto' }}>
          {PEOPLE.map((p, i) => {
            const on = share.to.includes(p)
            return (
              <button key={p} type="button" onClick={() => toggleTo(p)} aria-pressed={on} style={{ flex: 'none', border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: INK, font: 'inherit', fontSize: 12, fontWeight: 600, display: 'grid', justifyItems: 'center', gap: 5 }}>
                <span style={{ position: 'relative', width: 54, height: 54, borderRadius: '50%', display: 'grid', placeItems: 'center', background: `hsl(${i * 70 + 200} 60% 45%)`, fontSize: 19, fontWeight: 800, outline: on ? `3px solid ${accent}` : '3px solid transparent', outlineOffset: 2 }}>
                  {p[0]}
                  {on && <span style={{ position: 'absolute', right: -2, bottom: -2, width: 20, height: 20, borderRadius: '50%', background: accent, display: 'grid', placeItems: 'center' }}><Icon name="check" size={12} w={3.2} /></span>}
                </span>
                {p}
              </button>
            )
          })}
        </div>
        <div style={{ margin: '14px 16px 0', padding: '0 14px', background: PANEL, borderRadius: 18 }}>
          {switchRow('Also share to feed', null, share.feed, (v) => setShare((s) => ({ ...s, feed: v })))}
          {switchRow('Allow replies', 'Anyone who can see it', share.replies, (v) => setShare((s) => ({ ...s, replies: v })))}
        </div>
        <div style={{ padding: '16px 16px 6px' }}>{gradBtn(posting ? 'Posting…' : share.to.length && share.audience === 'story' ? `Share · send to ${share.to.length}` : 'Share', doPost, posting, { width: '100%' })}</div>
      </>
    )
  } else if (screen === 'done') {
    full = true
    body = (
      <div style={{ position: 'absolute', inset: 0, display: 'grid', alignContent: 'center', justifyItems: 'center', textAlign: 'center', padding: '0 30px', background: `radial-gradient(circle at 50% 35%, ${accent}33, transparent 60%)` }}>
        <span style={{ width: 104, height: 104, borderRadius: '50%', display: 'grid', placeItems: 'center', background: `linear-gradient(135deg, ${accent}, #ff7a1a)`, boxShadow: `0 14px 40px ${accent}66`, animation: 'cp-pop .55s cubic-bezier(.2,1.4,.4,1) both' }}>
          <Icon name="check" size={54} w={2.8} color="#fff" />
        </span>
        <div style={{ fontSize: 26, fontWeight: 800, marginTop: 22 }}>Story posted</div>
        <div style={{ fontSize: 14, color: MUTED, marginTop: 6 }}>Shared with {top.aud}. It disappears in 24 hours.</div>
        <div style={{ margin: '22px 0 0' }}><Mini comp={posted[0]?.comp || comp} k={0.3} /></div>
        <div style={{ display: 'grid', gap: 10, marginTop: 24, width: '100%' }}>
          {gradBtn('New story', () => (setComp(blank()), setDraftId(null), setShare({ audience: 'story', caption: '', feed: false, replies: true, to: [] }), reset([])), false, { width: '100%' })}
          <button type="button" onClick={() => (setDraftTab('posted'), setDir(1), setStack([{ id: 'drafts' }]))} style={{ height: 46, border: 'none', borderRadius: 23, background: PANEL, color: INK, font: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>See your posted stories</button>
        </div>
      </div>
    )
  } else if (screen === 'drafts') {
    const list = draftTab === 'drafts' ? drafts : posted
    body = (
      <>
        {header('Your stories', gradBtn('New', () => (setComp(blank()), setDraftId(null), reset([])), false, { height: 36, padding: '0 16px', fontSize: 13 }))}
        <div style={{ display: 'flex', background: PANEL, borderRadius: 14, padding: 3, margin: '2px 16px 12px' }} role="tablist">
          {[['drafts', `Drafts (${drafts.length})`], ['posted', `Posted (${posted.length})`]].map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={draftTab === k} onClick={() => setDraftTab(k)} style={{ flex: 1, height: 34, border: 'none', borderRadius: 11, background: draftTab === k ? '#fff' : 'transparent', color: draftTab === k ? '#111' : INK, font: 'inherit', fontSize: 13.5, fontWeight: 800, cursor: 'pointer' }}>{l}</button>
          ))}
        </div>
        {list.length ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, padding: '0 16px', justifyItems: 'center' }}>
            {list.map((d) => (
              <div key={d.id} style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => {
                    if (draftTab === 'drafts') {
                      setComp({ ...d.comp, items: d.comp.items.map((i) => ({ ...i })), strokes: d.comp.strokes.map((s) => ({ ...s })) })
                      setDraftId(d.id)
                      setSel(null)
                      setTool('none')
                      setDir(1)
                      setStack([{ id: 'edit' }])
                      say('Draft reopened')
                    } else say(`${d.views + 24 + (d.at % 90)} views · ${d.aud}`)
                  }}
                  aria-label={draftTab === 'drafts' ? 'Reopen draft' : 'Posted story'}
                  style={{ border: 'none', padding: 0, background: 'none', cursor: 'pointer', color: INK, font: 'inherit', textAlign: 'left', display: 'block' }}
                >
                  <Mini comp={d.comp} k={0.42} />
                  <span style={{ display: 'block', fontSize: 12.5, fontWeight: 700, marginTop: 6 }}>{draftTab === 'drafts' ? `${d.comp.items.length} items` : d.aud}</span>
                  <span style={{ display: 'block', fontSize: 11.5, color: MUTED }}>{ago(d.saved || d.at)}</span>
                </button>
                {draftTab === 'drafts' && (
                  <button type="button" onClick={() => (setDrafts((a) => a.filter((x) => x.id !== d.id)), say('Draft deleted'))} aria-label="Delete draft" style={{ ...iconBtn, position: 'absolute', top: 6, right: 6, width: 28, height: 28, background: 'rgba(0,0,0,.6)', color: '#fff' }}>
                    <Icon name="x" size={15} />
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', color: MUTED, padding: '70px 30px', fontSize: 14 }}>
            <Icon name="drafts" size={42} color={MUTED} />
            <div style={{ margin: '10px 0 18px' }}>{draftTab === 'drafts' ? 'No drafts. Save a story from the editor.' : 'Nothing posted yet.'}</div>
            {gradBtn('Create a story', () => (setComp(blank()), reset([])))}
          </div>
        )}
      </>
    )
  } else {
    // camera
    full = true
    const isText = camMode === 'text'
    const cur = isText ? camGrad : camBg
    body = (
      <div style={{ position: 'absolute', inset: 0 }}>
        <div style={{ position: 'absolute', left: 0, top: 54, width: CW, height: CH, overflow: 'hidden', borderRadius: 0 }}>
          <div className="cp-drift" style={{ position: 'absolute', inset: 0 }}>
            <Backdrop id={cur} front={front && !isText} />
          </div>
          {isText && (
            <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 36, fontWeight: 800, opacity: 0.85, textAlign: 'center', padding: 40, textShadow: '0 2px 10px rgba(0,0,0,.3)' }}>Tap Aa to type something</div>
          )}
          {flashKey > 0 && <div key={flashKey} style={{ position: 'absolute', inset: 0, background: '#fff', animation: 'cp-flash .5s ease-out forwards', pointerEvents: 'none' }} />}
        </div>
        <div style={{ position: 'absolute', top: 58, left: 12, right: 12, display: 'flex', justifyContent: 'space-between' }}>
          <button type="button" onClick={() => push({ id: 'drafts' })} aria-label="Drafts" style={{ ...iconBtn, height: 40, padding: '0 14px 0 10px', borderRadius: 20, background: 'rgba(0,0,0,.45)', gap: 6, display: 'flex', alignItems: 'center', font: 'inherit', fontSize: 13, fontWeight: 700 }}>
            <Icon name="drafts" size={19} /> Drafts{drafts.length ? ` ${drafts.length}` : ''}
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={() => (setFlash((f) => !f), say(flash ? 'Flash off' : 'Flash on'))} aria-label="Flash" aria-pressed={flash} style={{ ...iconBtn, width: 40, height: 40, background: flash ? '#ffd23f' : 'rgba(0,0,0,.45)', color: flash ? '#111' : '#fff' }}><Icon name="bolt" size={20} fill={flash ? '#111' : 'none'} /></button>
            <button type="button" onClick={() => (setFront((f) => !f), say(front ? 'Rear camera' : 'Front camera'))} aria-label="Flip camera" style={{ ...iconBtn, width: 40, height: 40, background: 'rgba(0,0,0,.45)' }}><Icon name="flip" size={20} /></button>
          </div>
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 54 + CH - 250, display: 'flex', justifyContent: 'center', gap: 22 }} role="tablist" aria-label="Create mode">
          {[['story', 'STORY'], ['text', 'TEXT']].map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={camMode === k} onClick={() => setCamMode(k)} style={{ border: 'none', background: 'none', color: camMode === k ? '#fff' : 'rgba(255,255,255,.6)', font: 'inherit', fontSize: 13, fontWeight: 800, letterSpacing: '.1em', cursor: 'pointer', borderBottom: camMode === k ? '2px solid #fff' : '2px solid transparent', paddingBottom: 3, textShadow: '0 1px 6px rgba(0,0,0,.5)' }}>{l}</button>
          ))}
        </div>
        <div className="cp-scroll" style={{ position: 'absolute', left: 0, right: 0, top: 54 + CH - 214, display: 'flex', gap: 10, padding: '0 16px', overflowX: 'auto' }} role="group" aria-label="Backdrops">
          {(isText ? GRADS : BACKDROPS).map((b) => (
            <button key={b.id} type="button" onClick={() => (isText ? setCamGrad(b.id) : setCamBg(b.id))} aria-pressed={cur === b.id} aria-label={b.name} style={{ flex: 'none', width: 54, height: 78, borderRadius: 14, padding: 0, overflow: 'hidden', cursor: 'pointer', border: cur === b.id ? '3px solid #fff' : '3px solid transparent', position: 'relative', background: '#000' }}>
              <span style={{ position: 'absolute', left: 0, top: 0, width: CW, height: CH, transform: 'scale(.14)', transformOrigin: '0 0' }}>
                <Backdrop id={b.id} />
              </span>
            </button>
          ))}
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 54 + CH, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 34, padding: '0 0 10px' }}>
          <button type="button" onClick={() => (setComp(startComp()), setDraftId(null), push({ id: 'edit' }), say('Opened sample story'))} style={{ ...iconBtn, width: 46, height: 46, borderRadius: 12, background: PANEL, flexDirection: 'column', fontSize: 9, fontWeight: 700, gap: 2 }} aria-label="Open sample from gallery"><Icon name="sticker" size={20} /></button>
          <button type="button" onClick={shoot} aria-label={isText ? 'Create text story' : 'Take photo'} style={{ width: 72, height: 72, borderRadius: '50%', border: '4px solid #fff', background: 'transparent', padding: 4, cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
            <span style={{ width: '100%', height: '100%', borderRadius: '50%', background: isText ? `linear-gradient(135deg, ${accent}, #ff7a1a)` : '#fff', display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 800, fontSize: 22, fontFamily: 'Georgia, serif' }}>{isText ? 'Aa' : ''}</span>
          </button>
          <button type="button" onClick={() => (setCamBg(BACKDROPS[(BACKDROPS.findIndex((b) => b.id === camBg) + 1) % BACKDROPS.length].id), setCamMode('story'))} style={{ ...iconBtn, width: 46, height: 46, borderRadius: 12, background: PANEL }} aria-label="Next backdrop"><Icon name="chev" size={22} /></button>
        </div>
      </div>
    )
  }

  const phone = (
    <div style={{ position: 'relative', width: W, height: H, overflow: 'hidden', borderRadius: frame ? 46 : 0, background: BG, color: INK, fontFamily: "-apple-system, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif" }}>
      <style>{`
        @keyframes cp-r { from { opacity: 0; transform: translateX(34px) } to { opacity: 1; transform: none } }
        @keyframes cp-l { from { opacity: 0; transform: translateX(-34px) } to { opacity: 1; transform: none } }
        @keyframes cp-fade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes cp-up { from { transform: translateY(60px); opacity: 0 } to { transform: none; opacity: 1 } }
        @keyframes cp-pop { from { transform: scale(.3); opacity: 0 } to { transform: none; opacity: 1 } }
        @keyframes cp-flash { 0% { opacity: .95 } 100% { opacity: 0 } }
        @keyframes cp-drift { from { transform: scale(1.04) translateX(-8px) } to { transform: scale(1.04) translateX(8px) } }
        .cp-drift { animation: cp-drift 9s ease-in-out infinite alternate }
        .cp-scroll { scrollbar-width: none } .cp-scroll::-webkit-scrollbar { display: none }
        .cp-app button:focus-visible, .cp-app input:focus-visible, .cp-app textarea:focus-visible { outline: 2px solid ${accent}; outline-offset: 2px }
        .cp-app textarea::placeholder, .cp-app input::placeholder { color: rgba(255,255,255,.4) }
        @media (prefers-reduced-motion: reduce) {
          .cp-app *, .cp-app *::before { animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important }
        }
      `}</style>
      <StatusBar frame={frame} />
      <div key={`${screen}`} className="cp-scroll" style={{ position: 'absolute', top: full ? 0 : 54, bottom: 0, left: 0, right: 0, overflowY: full ? 'hidden' : 'auto', paddingBottom: full ? 0 : 30, animation: `${dir > 0 ? 'cp-r' : 'cp-l'} .26s ease` }}>
        {body}
      </div>
      {overlay}
      <div role="status" style={{ position: 'absolute', left: '50%', top: 112, zIndex: 50, transform: `translate(-50%, ${toast ? 0 : -160}px)`, transition: 'transform .35s cubic-bezier(.2,.8,.2,1)', padding: '10px 16px', borderRadius: 20, background: 'rgba(40,32,56,.96)', color: '#fff', fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap', maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis' }}>{toast}</div>
      <div style={{ position: 'absolute', left: '50%', bottom: 8, width: 140, height: 5, marginLeft: -70, borderRadius: 3, background: '#fff', opacity: 0.8, zIndex: 45, pointerEvents: 'none' }} />
    </div>
  )

  return (
    <div ref={box} className="cp-app" aria-label={name} style={{ position: 'relative', width: '100%', height: '100%', display: 'grid', placeItems: 'center', overflow: 'hidden', background: 'radial-gradient(ellipse at 50% 30%, #2d1f45, #0b0712 75%)', ...style }}>
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
