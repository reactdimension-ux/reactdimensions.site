import { useEffect, useState } from 'react'

const MEMORIES = [
  { text: 'Prefers short answers', side: 'left', top: 6 },
  { text: 'Works in React and Vite', side: 'right', top: 26 },
  { text: 'Launching on Friday', side: 'left', top: 56 },
  { text: 'Dislikes emoji in docs', side: 'right', top: 66 },
]

// An agent reply with small "remembered" cards that fade in beside it, one after the
// other, and drift slowly while they stay. Each card is positioned absolutely at the
// side of the message, so the message itself never moves. The sequence repeats.
export default function MemoryRecall({
  message = 'Here is the plan for Friday, kept short and in React, as you like it.',
  memories = MEMORIES,
  hold = 4, // seconds the cards stay before the demo restarts
  speed = 1,
  width = 640,
  height = 280,
  size = 14,
  background = '#141414',
  textColor = '#e8e6e1',
  mutedColor = '#8a8a8a',
  color = '#d77757',
}) {
  const [run, setRun] = useState(0)

  useEffect(() => {
    const total = (memories.length * 0.7 + 0.8 + hold) * 1000 / speed
    const t = setTimeout(() => setRun((n) => n + 1), total)
    return () => clearTimeout(t)
  }, [run, memories.length, hold, speed])

  return (
    <div
      key={run}
      style={{ position: 'relative', width: `min(${width}px, 100%)`, height, boxSizing: 'border-box', borderRadius: 10, background, color: textColor, overflow: 'hidden', font: `400 ${size}px/1.4 ui-monospace, "SF Mono", Menlo, Consolas, monospace` }}
    >
      <style>{`
        @keyframes mr-in{from{opacity:0;transform:translateY(10px) scale(.96)}to{opacity:1;transform:none}}
        @keyframes mr-drift{0%,100%{translate:0 0}50%{translate:0 -5px}}
        @media (prefers-reduced-motion:reduce){.mr-card{animation:none!important}}
      `}</style>
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: '46%', padding: '1em 1.1em', borderRadius: 10, background: '#1e1e1e', border: '1px solid #ffffff12' }}>
        <div style={{ color, marginBottom: '0.4em', fontWeight: 600 }}>⏺ Agent</div>
        {message}
      </div>
      {memories.map((m, i) => (
        <div
          key={m.text}
          className="mr-card"
          style={{ position: 'absolute', [m.side]: '3%', top: `${m.top}%`, maxWidth: '24%', animation: `mr-in .5s ${(0.5 + i * 0.7) / speed}s both ease-out, mr-drift ${5 / speed}s ${(i * 0.9) / speed}s ease-in-out infinite` }}
        >
          <div style={{ padding: '0.5em 0.8em', borderRadius: 8, border: `1px solid ${color}66`, background: color + '14', color: textColor, fontSize: '0.88em' }}>
            <div style={{ color: mutedColor, fontSize: '0.8em', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.2em' }}>Remembered</div>
            {m.text}
          </div>
        </div>
      ))}
    </div>
  )
}
