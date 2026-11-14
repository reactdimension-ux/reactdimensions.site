import { useEffect, useRef, useState } from 'react'

// A short-video feed on a phone, as a click-through prototype. Five pages:
// For you, Following, Comments, Profile and Upload. The feed is a full-height
// vertical snap-scroll of animated SVG "videos" with a progress bar that
// auto-advances to the next one. Tap a video to play/pause, double-tap to like
// it with a burst heart, and use the like / comment / share / follow buttons,
// which all update real counts. Comments open in a bottom sheet where you can
// post. Upload lets you pick a scene, write a caption and post, and the new
// video lands at the top of the feed and on your Profile. Tapping a creator
// pushes their profile with a back button. The phone scales to fit its box.

const W = 390 // the phone screen, in CSS px
const H = 844
const BG = '#0a0a10'
const CARD = '#171722'
const INK = '#f5f5fa'
const MUTED = '#8c8ca0'
const DUR = 9000 // how long each video plays before auto-advancing

const fmt = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : `${n}`)
const rnd = (i, s = 1) => {
  const x = Math.sin(i * 127.1 + s * 311.7) * 43758.5453
  return x - Math.floor(x)
}
const wave = (y, amp) => `M0 ${y} ${Array.from({ length: 12 }, () => `q16.25 ${-amp} 32.5 0 q16.25 ${amp} 32.5 0`).join(' ')} L780 900 L0 900 Z`
const an = (name, dur, delay = 0, ease = 'linear') => ({ animation: `${name} ${dur}s ${ease} ${delay}s infinite` })

const CREATORS = {
  mira: { id: 'mira', name: 'mira.sky', hue: 20, bio: 'Chasing golden hours' },
  owl: { id: 'owl', name: 'nightowl', hue: 270, bio: 'City lights after dark' },
  cosmo: { id: 'cosmo', name: 'cosmo', hue: 230, bio: 'Tiny universes in loops' },
  tidal: { id: 'tidal', name: 'tidal', hue: 190, bio: 'Sea air and slow waves' },
  fern: { id: 'fern', name: 'fern.walks', hue: 140, bio: 'Quiet forests, glowing bugs' },
  dj: { id: 'dj', name: 'djloop', hue: 320, bio: 'Beats you can see' },
  you: { id: 'you', name: 'you', hue: 210, bio: 'Making my first loops' },
}

const SCENE_NAMES = { sunset: 'Sunset', neon: 'Neon city', space: 'Deep space', ocean: 'Ocean', forest: 'Forest', pulse: 'Beat drop' }

const mkC = (id, user, text, t, likes = 0) => ({ id, user, text, t, likes, liked: false })

const SEED = [
  { id: 'v1', by: 'mira', scene: 'sunset', caption: 'Golden hour never gets old #sunset', sound: 'Slow Burn - mira', likes: 12400, shares: 310, comments: [mkC(1, 'fern.walks', 'Those colours!!', '2h', 24), mkC(2, 'tidal', 'Saving this for later', '1h', 3), mkC(3, 'cosmo', 'Wallpaper material', '40m', 9)] },
  { id: 'v2', by: 'owl', scene: 'neon', caption: 'Night shift in the neon district #city', sound: 'Midnight Drive - owl', likes: 8900, shares: 205, comments: [mkC(4, 'djloop', 'This needs a synth track', '3h', 14), mkC(5, 'mira.sky', 'The windows flickering are perfect', '1h', 6)] },
  { id: 'v3', by: 'cosmo', scene: 'space', caption: 'A planet with a very good ring #space', sound: 'Orbit - cosmo', likes: 21300, shares: 880, comments: [mkC(6, 'nightowl', 'Saturn who?', '5h', 40), mkC(7, 'tidal', 'Look at that shooting star', '2h', 11)] },
  { id: 'v4', by: 'tidal', scene: 'ocean', caption: 'Lazy waves, small boat #ocean', sound: 'Salt - tidal', likes: 5600, shares: 94, comments: [mkC(8, 'mira.sky', 'Peaceful', '4h', 5)] },
  { id: 'v5', by: 'fern', scene: 'forest', caption: 'Fireflies are out #forest #calm', sound: 'Moss - fern', likes: 15200, shares: 402, comments: [mkC(9, 'cosmo', 'Tiny stars on the ground', '6h', 31), mkC(10, 'nightowl', 'Take me here', '3h', 8)] },
  { id: 'v6', by: 'dj', scene: 'pulse', caption: 'Drop it. Watch the rings #beats', sound: 'Pulse Check - djloop', likes: 30100, shares: 1200, comments: [mkC(11, 'tidal', 'Bass face activated', '1d', 52), mkC(12, 'fern.walks', 'Replay x10', '8h', 17)] },
  { id: 'm1', by: 'you', scene: 'ocean', caption: 'My first loop, be kind', sound: 'Original sound', mine: true, likes: 214, shares: 6, comments: [mkC(13, 'tidal', 'Welcome!', '2d', 4)] },
  { id: 'm2', by: 'you', scene: 'sunset', caption: 'Evening walk home', sound: 'Original sound', mine: true, likes: 98, shares: 2, comments: [] },
]

const ICONS = {
  home: 'M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z',
  users: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20a6.5 6.5 0 0 1 13 0M16 4.2a3.5 3.5 0 0 1 0 6.6M18 14a6.5 6.5 0 0 1 3.5 6',
  plus: 'M12 5v14M5 12h14',
  msg: 'M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-8l-5 4v-4H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 20a8 8 0 0 1 16 0',
  share: 'M13 4l8 7-8 7v-4.5C7 13.500 4.500 16 3 20c.5-6 3-11 10-11.500z',
  back: 'M15 5l-7 7 7 7',
  x: 'M6 6l12 12M18 6L6 18',
  music: 'M9 18V6l10-2v12M9 18a3 3 0 1 1-3-3 3 3 0 0 1 3 3zm10-2a3 3 0 1 1-3-3 3 3 0 0 1 3 3z',
  play: 'M8 5l11 7-11 7z',
  send: 'M4 12l16-8-6 16-3-7z',
  check: 'M5 12l5 5 9-10',
  grid: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13 7l4 4',
}
const HEART = 'M12 21s-7.500-4.600-9.500-9.300C1 8 3.200 5 6.300 5c2 0 3.700 1.100 5.700 3.200C14 6.100 15.700 5 17.700 5c3.100 0 5.300 3 3.800 6.700C19.500 16.400 12 21 12 21z'

function Icon({ name, size = 24, color = 'currentColor', w = 1.9, fill = 'none' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={name === 'heart' ? HEART : ICONS[name]} />
    </svg>
  )
}

// ---------------------------------------------------------------- scenes
// Animated 390x844 SVG scenes. They pause when `play` is false and respect
// prefers-reduced-motion through the stylesheet in the app.

const STARS = Array.from({ length: 56 }, (_, i) => ({ x: rnd(i) * 390, y: rnd(i, 2) * 560, r: 0.6 + rnd(i, 3) * 1.6, d: rnd(i, 4) * 3 }))
const BUILD = Array.from({ length: 9 }, (_, i) => ({ x: i * 46 - 6, h: 160 + rnd(i, 5) * 240, w: 40 }))
const FIREFLIES = Array.from({ length: 16 }, (_, i) => ({ x: 20 + rnd(i, 6) * 350, y: 520 + rnd(i, 7) * 260, d: rnd(i, 8) * 5 }))
const TREES = Array.from({ length: 9 }, (_, i) => ({ x: 10 + i * 46 + rnd(i, 9) * 14, h: 150 + rnd(i, 10) * 150, d: rnd(i, 11) * 3 }))

const SCENES = {
  sunset: (
    <>
      <defs>
        <linearGradient id="vs-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2b1055" />
          <stop offset=".42" stopColor="#ff4f81" />
          <stop offset=".62" stopColor="#ffb36b" />
        </linearGradient>
        <linearGradient id="vs-sea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ff9a6b" />
          <stop offset="1" stopColor="#1b0f3b" />
        </linearGradient>
      </defs>
      <rect width="390" height="844" fill="url(#vs-sky)" />
      <g style={an('vf-float', 6, 0, 'ease-in-out')}>
        <circle cx="195" cy="470" r="124" fill="#fff1c9" opacity=".16" />
        <circle cx="195" cy="470" r="86" fill="#fff1c9" />
      </g>
      <rect y="520" width="390" height="324" fill="url(#vs-sea)" />
      {Array.from({ length: 9 }, (_, i) => (
        <rect key={i} x={150 + rnd(i, 12) * 90} y={528 + i * 20} width={20 + rnd(i, 13) * 50} height="4" rx="2" fill="#fff1c9" style={an('vf-twk', 2 + rnd(i, 14), rnd(i, 15) * 2)} />
      ))}
      <g style={an('vf-wave', 9)}><path d={wave(600, 7)} fill="#2b1055" opacity=".45" /></g>
      <g style={an('vf-wave', 6)}><path d={wave(690, 9)} fill="#1b0f3b" opacity=".7" /></g>
      {[200, 250, 310].map((y, i) => (
        <g key={y} style={an('vf-fly', 11 + i * 3, i * 2.5)}><path d="M0 0q8-9 16 0q8-9 16 0" fill="none" stroke="#2b1055" strokeWidth="2.4" strokeLinecap="round" transform={`translate(0 ${y})`} /></g>
      ))}
    </>
  ),
  neon: (
    <>
      <defs>
        <linearGradient id="vn-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0b0620" />
          <stop offset="1" stopColor="#4a1a9c" />
        </linearGradient>
      </defs>
      <rect width="390" height="844" fill="url(#vn-sky)" />
      <g style={an('vf-float', 8, 0, 'ease-in-out')}><circle cx="290" cy="190" r="46" fill="#ffd6f5" /><circle cx="306" cy="180" r="40" fill="#0b0620" opacity=".18" /></g>
      {BUILD.map((b, i) => (
        <g key={i}>
          <rect x={b.x} y={780 - b.h} width={b.w} height={b.h + 64} fill={i % 2 ? '#150a33' : '#1e0f45'} />
          {Array.from({ length: Math.floor(b.h / 34) }, (_, r) =>
            [0, 1].map((c) => <rect key={`${r}-${c}`} x={b.x + 7 + c * 18} y={780 - b.h + 12 + r * 30} width="11" height="15" rx="1.500" fill={rnd(i * 20 + r * 2 + c, 20) > 0.5 ? '#ffd166' : '#5ff3ff'} style={an('vf-twk', 2 + rnd(i + r, 21) * 3, rnd(r + c, 22) * 3)} />),
          )}
        </g>
      ))}
      <rect y="780" width="390" height="64" fill="#0b0620" />
      <rect y="780" width="390" height="3" fill="#ff3d9a" style={an('vf-twk', 3)} />
      <g style={an('vf-fly', 5, 0)}><rect y="808" width="44" height="6" rx="3" fill="#ff3d9a" /><rect x="-30" y="808" width="26" height="6" rx="3" fill="#5ff3ff" /></g>
    </>
  ),
  space: (
    <>
      <defs>
        <radialGradient id="vp-bg" cx=".5" cy=".4" r=".9">
          <stop offset="0" stopColor="#2b1c66" />
          <stop offset="1" stopColor="#04030f" />
        </radialGradient>
        <radialGradient id="vp-pl" cx=".35" cy=".3" r=".8">
          <stop offset="0" stopColor="#ffd9a0" />
          <stop offset="1" stopColor="#c2563a" />
        </radialGradient>
      </defs>
      <rect width="390" height="844" fill="url(#vp-bg)" />
      {STARS.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#fff" style={an('vf-twk', 2.5, s.d)} />)}
      <g style={an('vf-float', 9, 0, 'ease-in-out')}>
        <ellipse cx="195" cy="400" rx="170" ry="34" fill="none" stroke="#ffd9a0" strokeWidth="10" opacity=".55" transform="rotate(-18 195 400)" />
        <circle cx="195" cy="400" r="92" fill="url(#vp-pl)" />
        <path d="M110 430q85 40 170-6" fill="none" stroke="#a63f2a" strokeWidth="6" opacity=".5" />
        <ellipse cx="195" cy="400" rx="170" ry="34" fill="none" stroke="#ffd9a0" strokeWidth="10" opacity=".9" transform="rotate(-18 195 400)" strokeDasharray="190 400" strokeDashoffset="-60" />
      </g>
      <g style={an('vf-shoot', 6, 1)}><line x1="330" y1="80" x2="380" y2="50" stroke="#fff" strokeWidth="2.500" strokeLinecap="round" /></g>
      <g style={an('vf-spin', 40)}><circle cx="70" cy="650" r="26" fill="#5b6cff" opacity=".8" /><circle cx="62" cy="644" r="6" fill="#3a49c9" /><circle cx="80" cy="660" r="4" fill="#3a49c9" /></g>
    </>
  ),
  ocean: (
    <>
      <defs>
        <linearGradient id="vo-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7cd4ff" />
          <stop offset="1" stopColor="#e6fbff" />
        </linearGradient>
      </defs>
      <rect width="390" height="844" fill="url(#vo-sky)" />
      <circle cx="300" cy="230" r="48" fill="#fff6c2" style={an('vf-float', 7, 0, 'ease-in-out')} />
      {[[100, 70, 8], [180, 120, 11]].map(([y, x, d], i) => <g key={i} style={an('vf-fly', d * 3, i * 4)}><ellipse cx={x} cy={y} rx="46" ry="12" fill="#fff" opacity=".9" /></g>)}
      <g style={an('vf-wave', 14)}><path d={wave(470, 6)} fill="#6fd0e6" /></g>
      <g style={an('vf-float', 3.500, 0, 'ease-in-out')}>
        <path d="M120 468h110l-18 28h-74z" fill="#d94f4f" />
        <rect x="172" y="404" width="4" height="64" fill="#5a3b2a" />
        <path d="M178 410l40 50h-40z" fill="#fff" />
        <path d="M170 418l-30 42h30z" fill="#ffe6a8" />
      </g>
      <g style={an('vf-wave', 10)}><path d={wave(520, 8)} fill="#2aa6c9" /></g>
      <g style={an('vf-wave', 7)}><path d={wave(600, 10)} fill="#137fa8" /></g>
      <g style={an('vf-wave', 5)}><path d={wave(700, 12)} fill="#0b5a82" /></g>
    </>
  ),
  forest: (
    <>
      <defs>
        <linearGradient id="vf-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0e2a3b" />
          <stop offset=".6" stopColor="#2c6e63" />
          <stop offset="1" stopColor="#7bc79a" />
        </linearGradient>
      </defs>
      <rect width="390" height="844" fill="url(#vf-sky)" />
      <circle cx="90" cy="170" r="34" fill="#f3f7d0" opacity=".9" style={an('vf-float', 8, 0, 'ease-in-out')} />
      <path d="M0 560q110-100 220-30t170-20v334H0z" fill="#1d5a4a" />
      <path d="M0 640q130-70 260-10t130-20v234H0z" fill="#134536" />
      {TREES.map((t, i) => (
        <g key={i} style={{ ...an('vf-sway', 4 + t.d, t.d, 'ease-in-out'), transformOrigin: '50% 100%' }}>
          <rect x={t.x + 14} y={760 - 20} width="6" height="24" fill="#3b2a1d" />
          <path d={`M${t.x} 750l17 -${t.h}l17 ${t.h}z`} fill={i % 2 ? '#0d3a2c' : '#0a2d23'} />
        </g>
      ))}
      {FIREFLIES.map((f, i) => <circle key={i} cx={f.x} cy={f.y} r="3" fill="#f6ff9a" style={an('vf-rise', 4 + f.d, f.d)} />)}
    </>
  ),
  pulse: (
    <>
      <defs>
        <radialGradient id="vu-bg" cx=".5" cy=".45" r=".8">
          <stop offset="0" stopColor="#7a1fa2" />
          <stop offset="1" stopColor="#14041f" />
        </radialGradient>
      </defs>
      <rect width="390" height="844" fill="url(#vu-bg)" />
      {[0, 1, 2, 3, 4].map((i) => <circle key={i} cx="195" cy="380" r="120" fill="none" stroke={i % 2 ? '#ff4fa3' : '#5ff3ff'} strokeWidth="4" style={an('vf-ring', 3.500, i * 0.7, 'ease-out')} />)}
      <circle cx="195" cy="380" r="64" fill="#ff4fa3" style={an('vf-beat', 0.9, 0, 'ease-in-out')} />
      <circle cx="195" cy="380" r="30" fill="#fff" opacity=".85" />
      {Array.from({ length: 15 }, (_, i) => (
        <rect key={i} x={14 + i * 24.500} y={620} width="16" height="150" rx="8" fill={i % 3 ? '#5ff3ff' : '#ffd166'} style={{ ...an('vf-eq', 0.7 + rnd(i, 30) * 0.8, rnd(i, 31)), transformOrigin: '50% 100%' }} />
      ))}
    </>
  ),
}

function Scene({ id, play }) {
  return (
    <svg className={`vf-s vf-anim${play ? '' : ' vf-paused'}`} viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }} aria-hidden="true">
      {SCENES[id]}
    </svg>
  )
}

function Avatar({ c, size = 44, ring }) {
  return (
    <span style={{ width: size, height: size, borderRadius: '50%', display: 'inline-grid', placeItems: 'center', flex: 'none', background: `linear-gradient(135deg, hsl(${c.hue} 80% 62%), hsl(${(c.hue + 50) % 360} 70% 40%))`, color: '#fff', fontWeight: 800, fontSize: size * 0.4, boxShadow: ring ? `0 0 0 2px ${BG}, 0 0 0 4px ${ring}` : 'none' }}>
      {c.name[0].toUpperCase()}
    </span>
  )
}

function StatusBar({ frame }) {
  const clock = new Date().toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' })
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 40, height: 54, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 30px 0 36px', fontSize: 16, fontWeight: 600, color: '#fff', pointerEvents: 'none', textShadow: '0 1px 6px rgba(0,0,0,.4)' }}>
      <span>{clock}</span>
      {frame && <span style={{ position: 'absolute', left: '50%', top: 11, width: 122, height: 35, marginLeft: -61, borderRadius: 20, background: '#000' }} />}
      <span style={{ display: 'flex', gap: 6, alignItems: 'center' }} aria-hidden="true">
        <svg width="18" height="11" viewBox="0 0 18 11" fill="#fff">
          <rect x="0" y="7" width="3" height="4" rx="1" />
          <rect x="5" y="5" width="3" height="6" rx="1" />
          <rect x="10" y="2.500" width="3" height="8.500" rx="1" />
          <rect x="15" y="0" width="3" height="11" rx="1" />
        </svg>
        <svg width="26" height="12" viewBox="0 0 26 12">
          <rect x="0.5" y="0.5" width="22" height="11" rx="3.500" fill="none" stroke="#fff" opacity=".5" />
          <rect x="2.500" y="2.500" width="16" height="7" rx="2" fill="#fff" />
          <rect x="23.500" y="4" width="2" height="4" rx="1" fill="#fff" opacity=".5" />
        </svg>
      </span>
    </div>
  )
}

// one snap-scroll page of the feed; holds no state of its own
function VideoItem({ v, active, playing, bursts, accent, followed, onTap, onLike, onComment, onShare, onFollow, onCreator }) {
  const c = CREATORS[v.by]
  const stop = (fn) => (e) => {
    e.stopPropagation()
    fn()
  }
  const railBtn = { border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: '#fff', display: 'grid', justifyItems: 'center', gap: 4, font: 'inherit', fontSize: 12, fontWeight: 700, textShadow: '0 1px 6px rgba(0,0,0,.5)' }
  return (
    <section onClick={(e) => onTap(e, v)} style={{ position: 'relative', height: H, scrollSnapAlign: 'start', scrollSnapStop: 'always', overflow: 'hidden', cursor: 'pointer' }} aria-label={`Video by ${c.name}`}>
      <Scene id={v.scene} play={active && playing} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,.35), transparent 22%, transparent 58%, rgba(0,0,0,.72))', pointerEvents: 'none' }} />
      {active && !playing && (
        <span style={{ position: 'absolute', left: '50%', top: '46%', width: 84, height: 84, marginLeft: -42, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'rgba(0,0,0,.45)', color: '#fff', pointerEvents: 'none', animation: 'vf-pop .25s ease both' }}>
          <Icon name="play" size={38} fill="#fff" w={1} />
        </span>
      )}
      {bursts.filter((b) => b.vid === v.id).map((b) => (
        <span key={b.id} style={{ position: 'absolute', left: b.x - 40, top: b.y - 40, width: 80, height: 80, pointerEvents: 'none', '--r': `${b.r}deg`, animation: 'vf-burst .85s ease-out both' }}>
          <Icon name="heart" size={80} fill={accent} color={accent} w={0} />
        </span>
      ))}
      <div style={{ position: 'absolute', right: 12, bottom: 112, display: 'grid', gap: 18, justifyItems: 'center' }}>
        <div style={{ position: 'relative', marginBottom: 8 }}>
          <button type="button" onClick={stop(() => onCreator(c, v))} aria-label={`Open ${c.name}`} style={{ ...railBtn }}>
            <Avatar c={c} size={50} ring="#fff" />
          </button>
          {v.by !== 'you' && (
            <button type="button" onClick={stop(() => onFollow(v.by))} aria-label={followed ? `Unfollow ${c.name}` : `Follow ${c.name}`} style={{ position: 'absolute', left: '50%', bottom: -10, marginLeft: -11, width: 22, height: 22, borderRadius: '50%', border: 'none', background: followed ? '#fff' : accent, color: followed ? accent : '#fff', display: 'grid', placeItems: 'center', cursor: 'pointer', padding: 0, transition: 'background .2s' }}>
              <Icon name={followed ? 'check' : 'plus'} size={14} w={3} />
            </button>
          )}
        </div>
        <button type="button" onClick={stop(() => onLike(v.id))} aria-pressed={v.liked} aria-label="Like" style={railBtn}>
          <Icon name="heart" size={36} fill={v.liked ? accent : 'rgba(255,255,255,.12)'} color={v.liked ? accent : '#fff'} w={v.liked ? 0 : 1.8} />
          {fmt(v.likes)}
        </button>
        <button type="button" onClick={stop(() => onComment(v.id))} aria-label="Comments" style={railBtn}>
          <Icon name="msg" size={34} />
          {fmt(v.comments.length + (v.extra || 0))}
        </button>
        <button type="button" onClick={stop(() => onShare(v.id))} aria-label="Share" style={railBtn}>
          <Icon name="share" size={34} />
          {fmt(v.shares)}
        </button>
      </div>
      <div style={{ position: 'absolute', left: 16, right: 84, bottom: 104, color: '#fff', textShadow: '0 1px 8px rgba(0,0,0,.55)' }}>
        <button type="button" onClick={stop(() => onCreator(c, v))} style={{ border: 'none', background: 'none', padding: 0, color: '#fff', font: 'inherit', fontSize: 16, fontWeight: 800, cursor: 'pointer' }}>@{c.name}</button>
        <div style={{ fontSize: 14, lineHeight: 1.35, marginTop: 4 }}>{v.caption}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: 12.5, fontWeight: 600 }}>
          <Icon name="music" size={15} /> <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.sound}</span>
        </div>
      </div>
    </section>
  )
}

const NAV = [
  ['foryou', 'home', 'Home'],
  ['following', 'users', 'Following'],
  ['upload', 'plus', ''],
  ['comments', 'msg', 'Comments'],
  ['profile', 'user', 'Profile'],
]

// ---------------------------------------------------------------- app

export default function VideoFeedApp({ name = 'Reelz', accent = '#ff2d6f', startScreen = 'foryou', frame = true, style }) {
  const box = useRef()
  const scroller = useRef()
  const bar = useRef()
  const prog = useRef(0)
  const toastTimer = useRef()
  const tapTimer = useRef()
  const lastTap = useRef(0)
  const burstTimers = useRef([])
  const jump = useRef(null)
  const [scale, setScale] = useState(1)
  const [tab, setTab] = useState(startScreen === 'comments' ? 'comments' : startScreen)
  const [stack, setStack] = useState([])
  const [dir, setDir] = useState(1)
  const [vids, setVids] = useState(SEED)
  const [followed, setFollowed] = useState({ owl: true, fern: true })
  const [active, setActive] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [bursts, setBursts] = useState([])
  const [sheet, setSheet] = useState(null) // video id whose comments are open
  const [draft, setDraft] = useState('')
  const [toast, setToast] = useState('')
  const [bio, setBio] = useState('Making my first loops')
  const [editBio, setEditBio] = useState(false)
  const [priv, setPriv] = useState(false)
  const [ptab, setPtab] = useState('videos')
  const [up, setUp] = useState({ scene: 'sunset', caption: '', sound: 'Original sound' })

  useEffect(() => {
    setTab(startScreen)
    setStack([])
    setSheet(null)
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

  const say = (t) => {
    setToast(t)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 1900)
  }
  useEffect(
    () => () => {
      clearTimeout(toastTimer.current)
      clearTimeout(tapTimer.current)
      burstTimers.current.forEach(clearTimeout)
    },
    [],
  )

  const top = stack[stack.length - 1]
  const onFeed = (tab === 'foryou' || tab === 'following') && !top
  const list = tab === 'following' ? vids.filter((v) => followed[v.by]) : vids
  const sheetVid = vids.find((v) => v.id === sheet)

  const push = (s) => (setDir(1), setStack((a) => [...a, s]))
  const pop = () => {
    if (top?.resume) jump.current = top.resume
    setDir(-1)
    setStack((a) => a.slice(0, -1))
  }
  const go = (t) => {
    setDir(NAV.findIndex((n) => n[0] === t) > NAV.findIndex((n) => n[0] === tab) ? 1 : -1)
    setTab(t)
    setStack([])
    setSheet(null)
    setActive(0)
    setPlaying(true)
  }
  const watch = (id) => {
    jump.current = id
    go('foryou')
  }

  // restore a scroll position after the feed (re)mounts
  useEffect(() => {
    if (!onFeed) return
    const el = scroller.current
    if (!el) return
    if (jump.current) {
      const i = Math.max(0, list.findIndex((v) => v.id === jump.current))
      jump.current = null
      el.scrollTop = i * H
      setActive(i)
    } else {
      el.scrollTop = 0
    }
    prog.current = 0
  }, [onFeed, tab]) // eslint-disable-line react-hooks/exhaustive-deps

  // progress bar + auto-advance
  useEffect(() => {
    prog.current = 0
    if (bar.current) bar.current.style.transform = 'scaleX(0)'
  }, [active, tab])
  useEffect(() => {
    if (!onFeed) return undefined
    const id = setInterval(() => {
      if (!playing || sheet) return
      prog.current += 100 / DUR
      if (prog.current >= 1) {
        prog.current = 0
        const el = scroller.current
        if (el && active < list.length - 1) el.scrollTo({ top: (active + 1) * H, behavior: 'smooth' })
      }
      if (bar.current) bar.current.style.transform = `scaleX(${Math.min(1, prog.current)})`
    }, 100)
    return () => clearInterval(id)
  }, [onFeed, playing, sheet, active, list.length])

  const onScroll = () => {
    const i = Math.round(scroller.current.scrollTop / H)
    if (i !== active) {
      setActive(i)
      setPlaying(true)
    }
  }

  const like = (id, forceOn) => setVids((a) => a.map((v) => (v.id === id ? (forceOn && v.liked ? v : { ...v, liked: !v.liked, likes: v.likes + (v.liked ? -1 : 1) }) : v)))
  const follow = (by) => {
    setFollowed((f) => ({ ...f, [by]: !f[by] }))
    say(followed[by] ? `Unfollowed @${CREATORS[by].name}` : `Following @${CREATORS[by].name}`)
  }
  const share = (id) => {
    setVids((a) => a.map((v) => (v.id === id ? { ...v, shares: v.shares + 1 } : v)))
    say('Link copied to clipboard')
  }
  const tapVideo = (e, v) => {
    const now = Date.now()
    if (now - lastTap.current < 300) {
      clearTimeout(tapTimer.current)
      lastTap.current = 0
      const r = e.currentTarget.getBoundingClientRect()
      const id = now + Math.random()
      setBursts((b) => [...b, { id, vid: v.id, x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale, r: Math.round(Math.random() * 40 - 20) }])
      burstTimers.current.push(setTimeout(() => setBursts((b) => b.filter((x) => x.id !== id)), 900))
      like(v.id, true)
    } else {
      lastTap.current = now
      tapTimer.current = setTimeout(() => setPlaying((p) => !p), 280)
    }
  }
  const openCreator = (c, v) => (c.id === 'you' ? go('profile') : push({ id: 'creator', creator: c.id, resume: v.id }))

  const postComment = () => {
    const text = draft.trim()
    if (!text || !sheet) return
    setVids((a) => a.map((v) => (v.id === sheet ? { ...v, comments: [mkC(Date.now(), 'you', text, 'now'), ...v.comments] } : v)))
    setDraft('')
  }
  const likeComment = (vid, cid) => setVids((a) => a.map((v) => (v.id === vid ? { ...v, comments: v.comments.map((c) => (c.id === cid ? { ...c, liked: !c.liked, likes: c.likes + (c.liked ? -1 : 1) } : c)) } : v)))

  const publish = () => {
    const v = { id: `u${Date.now()}`, by: 'you', scene: up.scene, caption: up.caption.trim() || 'Untitled loop', sound: up.sound, mine: true, likes: 0, shares: 0, comments: [] }
    setVids((a) => [v, ...a])
    setUp({ scene: 'sunset', caption: '', sound: 'Original sound' })
    say('Posted! Your video is live')
    watch(v.id)
  }

  // ---- shared bits
  const header = (title, back) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px 6px', minHeight: 48 }}>
      {back && (
        <button type="button" onClick={back} aria-label="Back" style={{ width: 38, height: 38, borderRadius: '50%', border: 'none', background: CARD, color: INK, display: 'grid', placeItems: 'center', cursor: 'pointer', padding: 0 }}>
          <Icon name="back" size={20} />
        </button>
      )}
      <h1 style={{ margin: 0, fontSize: back ? 18 : 26, fontWeight: 800, letterSpacing: '-0.02em', marginLeft: 4 }}>{title}</h1>
    </div>
  )
  const pill = (label, onClick, on) => (
    <button type="button" onClick={onClick} style={{ height: 34, padding: '0 16px', borderRadius: 17, border: 'none', background: on ? accent : CARD, color: '#fff', font: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{label}</button>
  )
  const thumbGrid = (items, empty) =>
    items.length ? (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3, padding: '0 3px' }}>
        {items.map((v) => (
          <button key={v.id} type="button" onClick={() => watch(v.id)} aria-label={`Watch: ${v.caption}`} style={{ position: 'relative', aspectRatio: '3/4', border: 'none', padding: 0, overflow: 'hidden', background: CARD, cursor: 'pointer' }}>
            <Scene id={v.scene} play={false} />
            <span style={{ position: 'absolute', left: 6, bottom: 5, display: 'flex', alignItems: 'center', gap: 3, color: '#fff', fontSize: 11, fontWeight: 700, textShadow: '0 1px 4px rgba(0,0,0,.7)' }}>
              <Icon name="play" size={11} fill="#fff" w={1} /> {fmt(v.likes)}
            </span>
          </button>
        ))}
      </div>
    ) : (
      <div style={{ textAlign: 'center', color: MUTED, fontSize: 13, padding: '36px 30px' }}>{empty}</div>
    )

  // ---- screens
  let body = null
  let feed = null
  let chrome = true // bottom nav translucent over a feed vs solid
  if (top?.id === 'creator') {
    const c = CREATORS[top.creator]
    const theirs = vids.filter((v) => v.by === c.id)
    const total = theirs.reduce((s, v) => s + v.likes, 0)
    body = (
      <>
        {header(`@${c.name}`, pop)}
        <div style={{ textAlign: 'center', padding: '10px 20px 14px' }}>
          <Avatar c={c} size={86} />
          <div style={{ fontSize: 13, color: MUTED, marginTop: 10 }}>{c.bio}</div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 28, margin: '14px 0' }}>
            {[[fmt(1200 + c.hue * 9), 'Followers'], [fmt(total), 'Likes'], [theirs.length, 'Videos']].map(([n, l]) => (
              <div key={l}><div style={{ fontSize: 17, fontWeight: 800 }}>{n}</div><div style={{ fontSize: 11.5, color: MUTED }}>{l}</div></div>
            ))}
          </div>
          <button type="button" onClick={() => follow(c.id)} style={{ height: 44, padding: '0 40px', borderRadius: 22, border: 'none', background: followed[c.id] ? CARD : accent, color: '#fff', font: 'inherit', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>{followed[c.id] ? 'Following' : 'Follow'}</button>
        </div>
        {thumbGrid(theirs, 'No videos yet.')}
      </>
    )
  } else if (onFeed) {
    chrome = false
    feed = list.length ? (
      <div key={tab} ref={scroller} onScroll={onScroll} className="vf-scroll" style={{ position: 'absolute', inset: 0, overflowY: 'scroll', scrollSnapType: 'y mandatory' }}>
        {list.map((v, i) => (
          <VideoItem key={v.id} v={v} active={i === active} playing={playing} bursts={bursts} accent={accent} followed={!!followed[v.by]} onTap={tapVideo} onLike={like} onComment={(id) => (setSheet(id), setDraft(''))} onShare={share} onFollow={follow} onCreator={openCreator} />
        ))}
      </div>
    ) : (
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center', padding: 40 }}>
        <div>
          <Icon name="users" size={48} color={MUTED} />
          <div style={{ fontSize: 18, fontWeight: 800, marginTop: 12 }}>Nobody followed yet</div>
          <div style={{ fontSize: 13, color: MUTED, margin: '6px 0 18px' }}>Follow creators on For you and their videos show up here.</div>
          {pill('Browse For you', () => go('foryou'), true)}
        </div>
      </div>
    )
  } else if (tab === 'comments') {
    const all = vids.flatMap((v) => v.comments.map((c) => ({ ...c, v }))).sort((a, b) => b.id - a.id)
    body = (
      <>
        {header('Comments')}
        <div style={{ padding: '0 16px 8px', fontSize: 13, color: MUTED }}>Latest comments across the feed. Tap one to open the thread.</div>
        <div style={{ display: 'grid', gap: 8, padding: '0 16px' }}>
          {all.map((c) => (
            <button key={c.id} type="button" onClick={() => (setSheet(c.v.id), setDraft(''))} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', border: 'none', borderRadius: 16, background: CARD, color: INK, font: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
              <Avatar c={{ name: c.user, hue: (c.user.length * 47) % 360 }} size={40} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 13, fontWeight: 700 }}>{c.user} <span style={{ color: MUTED, fontWeight: 500 }}>{c.t}</span></span>
                <span style={{ display: 'block', fontSize: 13.5, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.text}</span>
              </span>
              <span style={{ position: 'relative', width: 40, height: 52, borderRadius: 8, overflow: 'hidden', flex: 'none' }}><Scene id={c.v.scene} play={false} /></span>
            </button>
          ))}
        </div>
      </>
    )
  } else if (tab === 'profile') {
    const mine = vids.filter((v) => v.mine)
    const liked = vids.filter((v) => v.liked)
    const likes = mine.reduce((s, v) => s + v.likes, 0)
    const following = Object.values(followed).filter(Boolean).length
    body = (
      <>
        {header(`@${CREATORS.you.name}`)}
        <div style={{ textAlign: 'center', padding: '4px 20px 12px' }}>
          <Avatar c={CREATORS.you} size={84} ring={accent} />
          <div style={{ display: 'flex', justifyContent: 'center', gap: 26, margin: '14px 0 10px' }}>
            {[[following, 'Following'], ['2.4K', 'Followers'], [fmt(likes), 'Likes']].map(([n, l]) => (
              <div key={l}><div style={{ fontSize: 17, fontWeight: 800 }}>{n}</div><div style={{ fontSize: 11.5, color: MUTED }}>{l}</div></div>
            ))}
          </div>
          {editBio ? (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <input value={bio} onChange={(e) => setBio(e.target.value)} maxLength={60} aria-label="Bio" style={{ flex: 1, height: 38, borderRadius: 19, border: 'none', background: CARD, color: INK, padding: '0 14px', font: 'inherit', fontSize: 13 }} />
              {pill('Save', () => (setEditBio(false), say('Bio updated')), true)}
            </div>
          ) : (
            <div style={{ fontSize: 13.5, color: MUTED }}>{bio}</div>
          )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12 }}>
            <button type="button" onClick={() => setEditBio(true)} style={{ height: 40, padding: '0 18px', borderRadius: 20, border: 'none', background: CARD, color: INK, font: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="edit" size={15} /> Edit profile</button>
            <button type="button" role="switch" aria-checked={priv} onClick={() => (setPriv(!priv), say(priv ? 'Account is public' : 'Account is private'))} style={{ height: 40, padding: '0 18px', borderRadius: 20, border: 'none', background: priv ? accent : CARD, color: '#fff', font: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{priv ? 'Private' : 'Public'}</button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', padding: '4px 0 10px' }}>
          {pill(`Videos ${mine.length}`, () => setPtab('videos'), ptab === 'videos')}
          {pill(`Liked ${liked.length}`, () => setPtab('liked'), ptab === 'liked')}
        </div>
        {ptab === 'videos' ? thumbGrid(mine, 'Nothing posted yet. Tap + to upload.') : thumbGrid(liked, 'Videos you like will show up here.')}
      </>
    )
  } else if (tab === 'upload') {
    body = (
      <>
        {header('New video')}
        <div style={{ display: 'flex', gap: 14, padding: '4px 16px' }}>
          <div style={{ position: 'relative', width: 150, height: 200, borderRadius: 18, overflow: 'hidden', flex: 'none', boxShadow: '0 10px 24px rgba(0,0,0,.5)' }}>
            <Scene id={up.scene} play />
            <div style={{ position: 'absolute', left: 8, right: 8, bottom: 8, color: '#fff', fontSize: 11.5, fontWeight: 600, textShadow: '0 1px 4px rgba(0,0,0,.8)', lineHeight: 1.25 }}>{up.caption || 'Your caption here'}</div>
          </div>
          <div style={{ flex: 1, minWidth: 0, display: 'grid', alignContent: 'start', gap: 8 }}>
            <label htmlFor="vf-cap" style={{ fontSize: 12, color: MUTED, fontWeight: 600 }}>Caption</label>
            <textarea id="vf-cap" value={up.caption} onChange={(e) => setUp((u) => ({ ...u, caption: e.target.value }))} maxLength={80} placeholder="Say something about it #tags" style={{ height: 96, resize: 'none', borderRadius: 14, border: 'none', background: CARD, color: INK, padding: 10, font: 'inherit', fontSize: 13, lineHeight: 1.35 }} />
            <div style={{ fontSize: 11.5, color: MUTED, textAlign: 'right' }}>{up.caption.length}/80</div>
          </div>
        </div>
        <div style={{ padding: '14px 16px 6px', fontSize: 13, fontWeight: 700 }}>Pick a scene</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, padding: '0 16px' }}>
          {Object.keys(SCENES).map((id) => (
            <button key={id} type="button" onClick={() => setUp((u) => ({ ...u, scene: id }))} aria-pressed={up.scene === id} style={{ position: 'relative', height: 92, borderRadius: 14, overflow: 'hidden', border: `2.5px solid ${up.scene === id ? accent : 'transparent'}`, padding: 0, background: CARD, cursor: 'pointer' }}>
              <Scene id={id} play={false} />
              <span style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '10px 0 4px', background: 'linear-gradient(transparent, rgba(0,0,0,.7))', color: '#fff', fontSize: 11, fontWeight: 700 }}>{SCENE_NAMES[id]}</span>
            </button>
          ))}
        </div>
        <div style={{ padding: '14px 16px 6px', fontSize: 13, fontWeight: 700 }}>Sound</div>
        <div className="vf-scroll" style={{ display: 'flex', gap: 8, padding: '0 16px', overflowX: 'auto' }}>
          {['Original sound', 'Slow Burn', 'Midnight Drive', 'Pulse Check'].map((s) => <span key={s} style={{ flex: 'none' }}>{pill(s, () => setUp((u) => ({ ...u, sound: s })), up.sound === s)}</span>)}
        </div>
        <div style={{ padding: '18px 16px' }}>
          <button type="button" onClick={publish} style={{ width: '100%', height: 52, borderRadius: 26, border: 'none', background: accent, color: '#fff', font: 'inherit', fontSize: 15, fontWeight: 800, cursor: 'pointer' }}>Post video</button>
        </div>
      </>
    )
  }

  const phone = (
    <div style={{ position: 'relative', width: W, height: H, overflow: 'hidden', borderRadius: frame ? 46 : 0, background: BG, color: INK, fontFamily: "-apple-system, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif" }}>
      <style>{`
        @keyframes vf-r { from { opacity: 0; transform: translateX(34px) } to { opacity: 1; transform: none } }
        @keyframes vf-l { from { opacity: 0; transform: translateX(-34px) } to { opacity: 1; transform: none } }
        @keyframes vf-pop { from { transform: scale(.4); opacity: 0 } to { transform: none; opacity: 1 } }
        @keyframes vf-burst { 0% { transform: scale(.2) rotate(var(--r)); opacity: 0 } 20% { transform: scale(1.25) rotate(var(--r)); opacity: 1 } 70% { opacity: 1 } 100% { transform: translateY(-110px) scale(1) rotate(var(--r)); opacity: 0 } }
        @keyframes vf-sheet { from { transform: translateY(100%) } to { transform: none } }
        @keyframes vf-float { 0%, 100% { transform: translateY(0) } 50% { transform: translateY(-14px) } }
        @keyframes vf-twk { 0%, 100% { opacity: .2 } 50% { opacity: 1 } }
        @keyframes vf-wave { from { transform: translateX(0) } to { transform: translateX(-390px) } }
        @keyframes vf-fly { from { transform: translateX(-80px) } to { transform: translateX(470px) } }
        @keyframes vf-sway { 0%, 100% { transform: rotate(-3deg) } 50% { transform: rotate(3deg) } }
        @keyframes vf-rise { 0% { transform: translateY(0); opacity: 0 } 25% { opacity: 1 } 100% { transform: translateY(-170px); opacity: 0 } }
        @keyframes vf-ring { 0% { transform: scale(.45); opacity: .9 } 100% { transform: scale(1.7); opacity: 0 } }
        @keyframes vf-eq { 0%, 100% { transform: scaleY(.15) } 50% { transform: scaleY(1) } }
        @keyframes vf-beat { 0%, 100% { transform: scale(1) } 50% { transform: scale(1.18) } }
        @keyframes vf-spin { to { transform: rotate(360deg) } }
        @keyframes vf-shoot { 0% { transform: translate(0,0); opacity: 0 } 8% { opacity: 1 } 35% { transform: translate(-330px,240px); opacity: 0 } 100% { transform: translate(-330px,240px); opacity: 0 } }
        .vf-s * { transform-box: fill-box; transform-origin: center }
        .vf-paused * { animation-play-state: paused !important }
        .vf-scroll { scrollbar-width: none } .vf-scroll::-webkit-scrollbar { display: none }
        .vf-app button:focus-visible, .vf-app input:focus-visible, .vf-app textarea:focus-visible { outline: 2px solid ${accent}; outline-offset: 2px }
        .vf-app input::placeholder, .vf-app textarea::placeholder { color: ${MUTED} }
        @media (prefers-reduced-motion: reduce) { .vf-anim *, .vf-app [data-vf-fx] { animation: none !important } }
      `}</style>
      <StatusBar frame={frame} />
      {feed}
      {body && (
        <div key={`${tab}/${stack.map((s) => s.id + (s.creator || '')).join('/')}`} className="vf-scroll" style={{ position: 'absolute', top: 54, bottom: 84, left: 0, right: 0, overflowY: 'auto', paddingBottom: 24, animation: `${dir > 0 ? 'vf-r' : 'vf-l'} .28s ease` }}>
          {body}
        </div>
      )}
      {onFeed && list.length > 0 && (
        <>
          <div style={{ position: 'absolute', top: 58, left: 0, right: 0, zIndex: 15, display: 'flex', justifyContent: 'center', gap: 22, fontSize: 16, fontWeight: 800, textShadow: '0 1px 6px rgba(0,0,0,.5)' }} role="tablist" aria-label="Feed">
            {[['following', 'Following'], ['foryou', 'For you']].map(([id, l]) => (
              <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => go(id)} style={{ border: 'none', background: 'none', padding: '4px 2px', font: 'inherit', color: '#fff', opacity: tab === id ? 1 : 0.6, cursor: 'pointer', borderBottom: `2.5px solid ${tab === id ? '#fff' : 'transparent'}` }}>{l}</button>
            ))}
          </div>
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 82, height: 3, background: 'rgba(255,255,255,.22)', zIndex: 15 }}>
            <div ref={bar} style={{ height: '100%', background: '#fff', transformOrigin: '0 50%', transform: 'scaleX(0)' }} />
          </div>
        </>
      )}
      <nav aria-label="Main" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 82, zIndex: 20, background: chrome ? BG : 'linear-gradient(transparent, rgba(0,0,0,.82) 40%)', display: 'flex', justifyContent: 'space-around', alignItems: 'flex-start', padding: '10px 4px 0', borderTop: chrome ? '1px solid #22222e' : 'none' }}>
        {NAV.map(([id, icon, label]) => {
          const on = tab === id && !top
          if (id === 'upload')
            return (
              <button key={id} type="button" onClick={() => go('upload')} aria-label="Upload" aria-current={on ? 'page' : undefined} style={{ width: 54, height: 36, border: 'none', borderRadius: 12, cursor: 'pointer', color: '#fff', background: `linear-gradient(90deg, #22d3ee 0 22%, ${accent} 22% 100%)`, display: 'grid', placeItems: 'center', padding: 0, outline: on ? '2px solid #fff' : 'none', outlineOffset: 2, marginTop: 2 }}>
                <span style={{ width: 42, height: 36, borderRadius: 11, background: '#fff', color: '#000', display: 'grid', placeItems: 'center' }}><Icon name="plus" size={22} w={2.6} /></span>
              </button>
            )
          return (
            <button key={id} type="button" onClick={() => go(id)} aria-current={on ? 'page' : undefined} style={{ border: 'none', background: 'none', font: 'inherit', cursor: 'pointer', display: 'grid', justifyItems: 'center', alignContent: 'start', gap: 3, width: 66, height: 54, fontSize: 10.5, fontWeight: 700, color: on ? '#fff' : '#9a9aae' }}>
              <Icon name={icon} size={24} w={on ? 2.4 : 1.8} />
              {label}
            </button>
          )
        })}
      </nav>
      {sheetVid && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 35 }}>
          <button type="button" aria-label="Close comments" onClick={() => setSheet(null)} style={{ position: 'absolute', inset: 0, border: 'none', background: 'rgba(0,0,0,.5)', cursor: 'pointer' }} />
          <div role="dialog" aria-label="Comments" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 560, borderRadius: '22px 22px 0 0', background: '#12121b', display: 'flex', flexDirection: 'column', animation: 'vf-sheet .3s cubic-bezier(.2,.8,.2,1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', height: 52, fontSize: 14, fontWeight: 800 }}>
              {sheetVid.comments.length} comments
              <button type="button" onClick={() => setSheet(null)} aria-label="Close" style={{ position: 'absolute', right: 12, top: 8, width: 34, height: 34, borderRadius: '50%', border: 'none', background: 'none', color: INK, cursor: 'pointer', display: 'grid', placeItems: 'center' }}><Icon name="x" size={20} /></button>
            </div>
            <div className="vf-scroll" style={{ flex: 1, overflowY: 'auto', padding: '0 16px' }}>
              {sheetVid.comments.map((c) => (
                <div key={c.id} style={{ display: 'flex', gap: 10, padding: '9px 0' }}>
                  <Avatar c={{ name: c.user, hue: c.user === 'you' ? 210 : (c.user.length * 47) % 360 }} size={34} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: MUTED, fontWeight: 600 }}>{c.user} · {c.t}</div>
                    <div style={{ fontSize: 14, marginTop: 2, lineHeight: 1.35, overflowWrap: 'anywhere' }}>{c.text}</div>
                  </div>
                  <button type="button" onClick={() => likeComment(sheetVid.id, c.id)} aria-pressed={c.liked} aria-label="Like comment" style={{ border: 'none', background: 'none', color: c.liked ? accent : MUTED, display: 'grid', justifyItems: 'center', gap: 1, cursor: 'pointer', fontSize: 11, font: 'inherit', fontWeight: 700 }}>
                    <Icon name="heart" size={18} fill={c.liked ? accent : 'none'} w={c.liked ? 0 : 1.8} />
                    {c.likes}
                  </button>
                </div>
              ))}
              {!sheetVid.comments.length && <div style={{ textAlign: 'center', color: MUTED, fontSize: 13, padding: '50px 0' }}>No comments yet. Be the first!</div>}
            </div>
            <form onSubmit={(e) => (e.preventDefault(), postComment())} style={{ display: 'flex', gap: 8, padding: '10px 14px 26px', borderTop: '1px solid #22222e' }}>
              <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add a comment..." aria-label="Add a comment" maxLength={140} style={{ flex: 1, height: 42, borderRadius: 21, border: 'none', background: CARD, color: INK, padding: '0 16px', font: 'inherit', fontSize: 14 }} />
              <button type="submit" disabled={!draft.trim()} aria-label="Post comment" style={{ width: 42, height: 42, borderRadius: '50%', border: 'none', background: draft.trim() ? accent : CARD, color: '#fff', display: 'grid', placeItems: 'center', cursor: draft.trim() ? 'pointer' : 'default', padding: 0 }}><Icon name="send" size={19} /></button>
            </form>
          </div>
        </div>
      )}
      <div role="status" style={{ position: 'absolute', left: '50%', top: 58, zIndex: 45, transform: `translate(-50%, ${toast ? 0 : -90}px)`, transition: 'transform .35s cubic-bezier(.2,.8,.2,1)', padding: '10px 16px', borderRadius: 20, background: '#fff', color: '#111', fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap' }}>{toast}</div>
      <div style={{ position: 'absolute', left: '50%', bottom: 8, width: 140, height: 5, marginLeft: -70, borderRadius: 3, background: '#fff', opacity: 0.8, zIndex: 50, pointerEvents: 'none' }} />
    </div>
  )

  return (
    <div ref={box} className="vf-app" aria-label={name} style={{ position: 'relative', width: '100%', height: '100%', display: 'grid', placeItems: 'center', overflow: 'hidden', background: 'radial-gradient(ellipse at 50% 30%, #2a2540, #0a0912 75%)', ...style }}>
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
