import { useEffect, useState } from 'react'

const WORDS = ['Marinating', 'Thinking', 'Pondering', 'Brewing', 'Simmering', 'Cooking', 'Mulling', 'Noodling', 'Percolating', 'Ruminating']
// the spinner glyphs, played forwards then back
const GLYPHS = ['·', '✢', '✳', '∗', '✻', '✽']
const FRAMES = [...GLYPHS, ...GLYPHS.slice(1, -1).reverse()]

// An agent "working" line in the Claude Code style: a glyph that grows and shrinks
// beside a status word with a light sweeping through it, then an ellipsis.
export default function ThinkingIndicator({
  word = 'Marinating',
  cycle = false,
  details = false,
  color = '#d77757',
  textColor = '#d77757',
  speed = 1,
  size = 18,
  background = '#141414',
}) {
  const [frame, setFrame] = useState(0)
  const [w, setW] = useState(0)
  const [secs, setSecs] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setFrame((n) => (n + 1) % FRAMES.length), 130 / speed)
    return () => clearInterval(t)
  }, [speed])
  useEffect(() => {
    if (!cycle) return
    const t = setInterval(() => setW((n) => (n + 1) % WORDS.length), 3200 / speed)
    return () => clearInterval(t)
  }, [cycle, speed])
  useEffect(() => {
    if (!details) return
    const t = setInterval(() => setSecs((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [details])

  const label = cycle ? WORDS[w] : word
  // the box keeps one size: the label reserves room for the longest word it can show
  const chars = Math.max(cycle ? Math.max(...WORDS.map((x) => x.length)) : 0, word.length) + 1
  return (
    <div
      role="status"
      aria-live="polite"
      style={{ display: 'inline-flex', alignItems: 'baseline', gap: '0.7em', padding: '0.7em 1.1em', borderRadius: 10, background, font: `400 ${size}px/1.2 ui-monospace, "SF Mono", Menlo, Consolas, monospace` }}
    >
      <style>{`
        @keyframes ti-sweep{from{background-position:130% 0}to{background-position:-30% 0}}
        @media (prefers-reduced-motion:reduce){.ti-word{animation:none!important}}
      `}</style>
      <span aria-hidden style={{ color, display: 'inline-block', width: '1em', textAlign: 'center' }}>
        {FRAMES[frame]}
      </span>
      <span
        className="ti-word"
        style={{
          backgroundImage: `linear-gradient(100deg, ${textColor} 40%, #f6c4b0 50%, ${textColor} 60%)`,
          backgroundSize: '250% 100%',
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          color: 'transparent',
          animation: `ti-sweep ${2.4 / speed}s linear infinite`,
          display: 'inline-block',
          minWidth: `${chars}ch`,
          whiteSpace: 'nowrap',
        }}
      >
        {label}…
      </span>
      {details && <span style={{ color: '#8a8a8a', fontSize: '0.85em', display: 'inline-block', minWidth: '24ch', whiteSpace: 'nowrap' }}>(esc to interrupt · {secs}s)</span>}
    </div>
  )
}
