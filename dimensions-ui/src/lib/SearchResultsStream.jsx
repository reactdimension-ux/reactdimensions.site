import { useEffect, useState } from 'react'

const RESULTS = [
  { title: 'React docs: Synchronizing with Effects', host: 'react.dev', snippet: 'Effects let you run code after rendering so you can keep a component in sync with something outside React.' },
  { title: 'A complete guide to useEffect', host: 'overreacted.io', snippet: 'Each render has its own props, state, and effects. Once you see that, the rest follows.' },
  { title: 'Cleaning up timers in React', host: 'blog.example.com', snippet: 'Return a function from the effect that clears the interval, or the timer keeps running after unmount.' },
  { title: 'Why does my interval run twice?', host: 'stackoverflow.com', snippet: 'In development, Strict Mode mounts components twice to help you find missing cleanup.' },
]

// Search results arriving one at a time as an agent finds them. The header counts up,
// each card slides in, and the list keeps its full height from the start, so the box
// never grows. When all are in, it waits and starts a new search.
export default function SearchResultsStream({
  query = 'react useEffect interval cleanup',
  results = RESULTS,
  speed = 1,
  width = 520,
  size = 14,
  background = '#141414',
  cardColor = '#1d1d1d',
  textColor = '#e8e6e1',
  mutedColor = '#8a8a8a',
  color = '#d77757',
}) {
  const [n, setN] = useState(0)

  useEffect(() => {
    const done = n >= results.length
    const t = setTimeout(() => setN((c) => (done ? 0 : c + 1)), (done ? 3200 : n === 0 ? 900 : 1100) / speed)
    return () => clearTimeout(t)
  }, [n, results.length, speed])

  const done = n >= results.length

  return (
    <div
      role="feed"
      aria-busy={!done}
      style={{ width: `min(${width}px, 100%)`, boxSizing: 'border-box', padding: '1em 1.1em', borderRadius: 10, background, color: textColor, font: `400 ${size}px/1.4 ui-monospace, "SF Mono", Menlo, Consolas, monospace` }}
    >
      <style>{`
        @keyframes sr-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
        @keyframes sr-blink{0%,100%{opacity:1}50%{opacity:.25}}
        @media (prefers-reduced-motion:reduce){.sr *{animation:none!important}}
      `}</style>
      <div className="sr" style={{ display: 'flex', gap: '0.6em', marginBottom: '0.8em', color: mutedColor }}>
        <span aria-hidden style={{ color: done ? '#4eba65' : color, animation: done ? 'none' : 'sr-blink 1s ease-in-out infinite' }}>⏺</span>
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {done ? 'Found' : 'Searching'} <b style={{ color: textColor, fontWeight: 600 }}>{query}</b> · {n} result{n === 1 ? '' : 's'}
        </span>
      </div>
      <div className="sr" style={{ display: 'grid', gap: '0.6em' }}>
        {results.map((r, i) => (
          // cards not found yet keep their space, so the box keeps its size
          <div key={r.title} style={{ visibility: i < n ? 'visible' : 'hidden', animation: i === n - 1 ? 'sr-in .35s ease-out' : 'none', padding: '0.7em 0.9em', borderRadius: 8, background: cardColor }}>
            <div style={{ color, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.title}</div>
            <div style={{ color: mutedColor, fontSize: '0.85em', margin: '0.15em 0 0.35em' }}>{r.host}</div>
            <div style={{ fontSize: '0.92em', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{r.snippet}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
