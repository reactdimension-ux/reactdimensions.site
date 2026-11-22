import { useEffect, useState } from 'react'

export const AVATAR_STATES = ['auto', 'idle', 'listening', 'thinking', 'speaking', 'done', 'error']
const CYCLE = ['idle', 'listening', 'thinking', 'speaking', 'done']
const LABEL = { idle: 'Ready', listening: 'Listening', thinking: 'Thinking', speaking: 'Answering', done: 'Done', error: 'Something went wrong' }

// A small face for an agent that shows what it is doing: it blinks when idle,
// opens its eyes wide and sends out rings when listening, glances up with dots
// orbiting while thinking, talks while answering, and smiles when it is done.
export default function AgentAvatar({
  state = 'auto',
  shape = 'squircle', // 'squircle' | 'circle'
  label = true,
  size = 120,
  color = '#d77757',
  face = '#1a1614',
  background = 'transparent',
}) {
  const [i, setI] = useState(0)
  useEffect(() => {
    if (state !== 'auto') return
    const t = setInterval(() => setI((n) => (n + 1) % CYCLE.length), 2600)
    return () => clearInterval(t)
  }, [state])
  const s = state === 'auto' ? CYCLE[i] : state

  const radius = shape === 'circle' ? '50%' : '30%'
  // eye and mouth shapes for each state, drawn in a 100 × 100 box
  const eyes = {
    idle: { ry: 8, y: 44, dx: 0 },
    listening: { ry: 11, y: 43, dx: 0 },
    thinking: { ry: 7, y: 40, dx: 5 },
    speaking: { ry: 8, y: 44, dx: 0 },
    done: { ry: 0, y: 44, dx: 0 },
    error: { ry: 6, y: 45, dx: 0 },
  }[s]
  const mouth = {
    idle: 'M40 66 Q50 70 60 66',
    listening: 'M44 66 Q50 69 56 66',
    thinking: 'M42 67 Q50 65 58 67',
    speaking: 'M40 64 Q50 74 60 64',
    done: 'M36 62 Q50 78 64 62',
    error: 'M40 70 Q50 62 60 70',
  }[s]
  const tint = s === 'error' ? '#e5534b' : color

  return (
    <div style={{ display: 'inline-grid', justifyItems: 'center', gap: 12, padding: 16, borderRadius: 16, background, font: '500 14px/1 "Plus Jakarta Sans", system-ui, sans-serif' }}>
      <style>{`
        @keyframes av-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
        @keyframes av-blink{0%,92%,100%{transform:scaleY(1)}95%{transform:scaleY(.1)}}
        @keyframes av-ring{from{transform:scale(.9);opacity:.7}to{transform:scale(1.45);opacity:0}}
        @keyframes av-orbit{to{transform:rotate(360deg)}}
        @keyframes av-talk{0%,100%{transform:scaleY(.55)}50%{transform:scaleY(1.15)}}
        @keyframes av-pop{0%{transform:scale(0) rotate(0);opacity:0}50%{opacity:1}100%{transform:scale(1) rotate(90deg);opacity:0}}
        @keyframes av-shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-4px)}40%,80%{transform:translateX(4px)}}
        .av-face *{transform-box:fill-box;transform-origin:center}
        @media (prefers-reduced-motion:reduce){.av *{animation:none!important}}
      `}</style>
      <div className="av" role="img" aria-label={`Agent: ${LABEL[s]}`} style={{ position: 'relative', width: size, height: size }}>
        {s === 'listening' &&
          [0, 0.6].map((d) => <span key={d} style={{ position: 'absolute', inset: 0, borderRadius: radius, border: `2px solid ${tint}`, animation: `av-ring 1.2s ${d}s ease-out infinite` }} />)}
        {s === 'thinking' && (
          // three dots on a ring just outside the face, the ring turning
          <span style={{ position: 'absolute', zIndex: 1, inset: -14, animation: 'av-orbit 1.6s linear infinite' }}>
            {[0, 1, 2].map((d) => {
              const a = ((-90 - d * 28) * Math.PI) / 180
              const r = size / 2 + 10
              return <span key={d} style={{ position: 'absolute', left: size / 2 + 14 + r * Math.cos(a) - 4, top: size / 2 + 14 + r * Math.sin(a) - 4, width: 8, height: 8, borderRadius: '50%', background: tint, opacity: 1 - d * 0.3 }} />
            })}
          </span>
        )}
        {s === 'done' &&
          [[-8, 10], [size - 4, 4], [size - 14, size - 8]].map(([x, y], d) => (
            <span key={d} style={{ position: 'absolute', left: x, top: y, color: tint, fontSize: 14, animation: `av-pop 1.3s ${d * 0.25}s ease-out infinite` }}>✦</span>
          ))}
        <svg
          viewBox="0 0 100 100"
          width={size}
          height={size}
          className="av-face"
          style={{ position: 'relative', display: 'block', borderRadius: radius, background: tint, transition: 'background .4s', animation: s === 'error' ? 'av-shake .5s ease-in-out' : s === 'idle' || s === 'done' ? 'av-float 3s ease-in-out infinite' : 'none' }}
        >
          <defs>
            <radialGradient id="av-shine" cx="30%" cy="25%" r="80%">
              <stop offset="0" stopColor="#fff" stopOpacity=".35" />
              <stop offset=".6" stopColor="#fff" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect width="100" height="100" fill="url(#av-shine)" />
          {[-1, 1].map((side) => (
            <g key={side} style={{ transform: `translateX(${eyes.dx}px)`, transition: 'transform .4s' }}>
              {s === 'done' ? (
                <path d={`M${50 + side * 15 - 7} 46 Q${50 + side * 15} 38 ${50 + side * 15 + 7} 46`} fill="none" stroke={face} strokeWidth="4.5" strokeLinecap="round" />
              ) : (
                <ellipse cx={50 + side * 15} cy={eyes.y} rx="6" ry={eyes.ry} fill={face} style={{ transition: 'ry .3s, cy .3s', animation: s === 'idle' ? 'av-blink 4s ease-in-out infinite' : 'none' }} />
              )}
            </g>
          ))}
          <path d={mouth} fill="none" stroke={face} strokeWidth="4.5" strokeLinecap="round" style={{ transition: 'd .35s', animation: s === 'speaking' ? 'av-talk .28s ease-in-out infinite' : 'none' }} />
        </svg>
      </div>
      {label && (
        <span aria-live="polite" style={{ color: tint, display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: '9em', justifyContent: 'center' }}>
          <span aria-hidden style={{ width: 7, height: 7, borderRadius: '50%', background: tint }} />
          {LABEL[s]}
        </span>
      )}
    </div>
  )
}
