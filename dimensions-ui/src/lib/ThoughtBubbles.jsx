import { useEffect, useRef, useState } from 'react'

const WORDS = ['hmm', 'maybe', '?', 'aha', '…', 'what if']

// Little bubbles that rise from an avatar while it thinks. Each one is added by a timer,
// floats up and fades with a CSS animation, and is removed again when its animation
// ends, so the list never grows. Every third bubble carries a word. Turn `thinking` off
// and no new bubbles start; the ones in flight finish rising.
export default function ThoughtBubbles({
  thinking = true,
  rate = 1, // bubbles per second, roughly
  speed = 1,
  height = 300,
  width = 320,
  background = '#141414',
  avatarColor = '#d77757',
  bubbleColor = '#e8e6e1',
  textColor = '#1a1a1a',
}) {
  const [bubbles, setBubbles] = useState([])
  const id = useRef(0)

  useEffect(() => {
    if (!thinking) return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const add = () => {
      const n = id.current++
      const word = n % 3 === 2 ? WORDS[(n / 3 | 0) % WORDS.length] : ''
      const b = { id: n, word, x: (Math.random() - 0.5) * 70, drift: (Math.random() - 0.5) * 50, d: word ? 40 + Math.random() * 8 : 10 + Math.random() * 16, dur: (3.6 + Math.random() * 1.2) / speed }
      setBubbles((l) => [...l.slice(-12), b])
    }
    add()
    const t = setInterval(add, (reduce ? 1800 : 650) / rate / speed)
    return () => clearInterval(t)
  }, [thinking, rate, speed])

  const drop = (n) => setBubbles((l) => l.filter((b) => b.id !== n))

  return (
    <div
      role="img"
      aria-label={thinking ? 'The agent is thinking' : 'The agent is idle'}
      style={{ position: 'relative', width: `min(${width}px, 100%)`, height, borderRadius: 10, background, overflow: 'hidden' }}
    >
      <style>{`
        @keyframes tb-rise{0%{opacity:0;transform:translate(0,0) scale(.3)}12%{opacity:1}100%{opacity:0;transform:translate(var(--dx),-210px) scale(1)}}
        @keyframes tb-blink{0%,92%,100%{transform:scaleY(1)}96%{transform:scaleY(.1)}}
        @keyframes tb-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
        @media (prefers-reduced-motion:reduce){.tb *{animation-duration:0s!important}}
      `}</style>
      <div className="tb" style={{ position: 'absolute', inset: 0 }}>
        {bubbles.map((b) => (
          <span
            key={b.id}
            onAnimationEnd={() => drop(b.id)}
            style={{
              '--dx': `${b.drift}px`,
              position: 'absolute', left: `calc(50% + ${b.x}px)`, bottom: 88,
              width: b.d, height: b.d, marginLeft: -b.d / 2, borderRadius: '50%',
              display: 'grid', placeItems: 'center',
              background: bubbleColor, color: textColor, font: '600 12px/1 ui-monospace, Menlo, monospace',
              boxShadow: 'inset 0 -3px 0 #0001', opacity: 0,
              animation: `tb-rise ${b.dur}s ease-out forwards`,
            }}
          >
            {b.word}
          </span>
        ))}
        {/* the avatar: a round face with two eyes */}
        <div style={{ position: 'absolute', left: '50%', bottom: 20, width: 64, height: 64, marginLeft: -32, borderRadius: '50%', background: avatarColor, animation: thinking ? 'tb-bob 1.6s ease-in-out infinite' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
          {[0, 1].map((i) => (
            <i key={i} style={{ display: 'block', width: 8, height: 12, borderRadius: 4, background: '#1a1614', position: 'relative', left: thinking ? 4 : 0, top: thinking ? -4 : 0, transition: 'left .3s, top .3s', animation: 'tb-blink 4s infinite' }} />
          ))}
        </div>
      </div>
    </div>
  )
}
