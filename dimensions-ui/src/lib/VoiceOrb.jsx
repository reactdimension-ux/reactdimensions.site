import { useEffect, useRef, useState } from 'react'

const STATES = ['idle', 'listening', 'speaking']

// A glowing orb for voice agents. `amplitude` (0 to 1) scales it; with no microphone the
// demo drives it from smoothed random noise. Each state has its own colour and pace:
// idle breathes slowly, listening ripples inward, speaking swells with the voice.
export default function VoiceOrb({
  state = 'listening', // 'idle' | 'listening' | 'speaking'
  cycle = false, // walk through the states by itself
  amplitude = null, // 0..1, overrides the fake noise when set
  speed = 1,
  size = 160,
  idleColor = '#8a8a8a',
  listenColor = '#5b9bd5',
  speakColor = '#d77757',
  background = '#0f0f0f',
}) {
  const [auto, setAuto] = useState(0)
  const [level, setLevel] = useState(0.2)
  const val = useRef(0.2)

  useEffect(() => {
    if (!cycle) return
    const t = setInterval(() => setAuto((n) => (n + 1) % STATES.length), 3500 / speed)
    return () => clearInterval(t)
  }, [cycle, speed])

  const s = cycle ? STATES[auto] : STATES.includes(state) ? state : 'idle'

  // fake audio: smoothed random noise, stronger while speaking
  useEffect(() => {
    if (amplitude != null) return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    let raf
    let target = 0.3
    let last = 0
    const loop = (now) => {
      if (now - last > 120 / speed) {
        last = now
        target = s === 'speaking' ? 0.25 + Math.random() * 0.75 : s === 'listening' ? 0.15 + Math.random() * 0.45 : 0.1
      }
      val.current += (target - val.current) * 0.12
      setLevel(reduce ? 0.3 : val.current)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [s, amplitude, speed])

  const a = Math.max(0, Math.min(1, amplitude ?? level))
  const c = { idle: idleColor, listening: listenColor, speaking: speakColor }[s]
  const scale = 0.78 + a * 0.4

  return (
    <div
      role="img"
      aria-label={`Voice agent ${s}`}
      style={{ position: 'relative', width: size * 1.7, height: size * 1.7, display: 'grid', placeItems: 'center', background, borderRadius: 14, maxWidth: '100%' }}
    >
      <style>{`
        @keyframes vo-breathe{0%,100%{transform:scale(.94)}50%{transform:scale(1.04)}}
        @keyframes vo-ring{0%{transform:scale(1.55);opacity:0}30%{opacity:.5}100%{transform:scale(.9);opacity:0}}
        @media (prefers-reduced-motion:reduce){.vo *{animation:none!important}}
      `}</style>
      <div className="vo" style={{ position: 'relative', width: size, height: size, display: 'grid', placeItems: 'center' }}>
        {s === 'listening' &&
          [0, 1, 2].map((i) => (
            <span key={i} aria-hidden style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `2px solid ${c}`, animation: `vo-ring ${2.4 / speed}s ${(i * 0.8) / speed}s ease-out infinite` }} />
          ))}
        <div style={{ position: 'absolute', inset: 0, animation: s === 'idle' ? `vo-breathe ${4 / speed}s ease-in-out infinite` : 'none' }}>
          <div
            style={{
              width: '100%', height: '100%', borderRadius: '50%',
              background: `radial-gradient(circle at 35% 30%, ${c}ff, ${c}cc 35%, ${c}44 70%, ${c}00 100%)`,
              boxShadow: `0 0 ${size * 0.35}px ${c}${s === 'idle' ? '33' : '88'}`,
              transform: s === 'idle' ? 'none' : `scale(${scale})`,
              transition: 'background .5s, box-shadow .5s',
            }}
          />
        </div>
      </div>
    </div>
  )
}
