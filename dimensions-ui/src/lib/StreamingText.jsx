import { useEffect, useMemo, useState } from 'react'

const SAMPLE =
  'Sure. I read the three files you mentioned and found the bug: the timer is started on every render, so each one keeps running after the next starts. Moving it into an effect with a cleanup fixes it, and the page stays at a steady 60 fps.'

// An agent reply that streams in a word at a time, the way a model answers,
// with a cursor at the end. The box is sized for the whole reply from the start,
// so nothing around it moves while the text arrives.
export default function StreamingText({
  text = SAMPLE,
  speed = 14, // words per second
  loop = true,
  cursor = 'block', // 'block' | 'bar' | 'dot'
  font = 'sans', // 'sans' | 'mono'
  size = 17,
  width = 460,
  color = '#e8e6e1',
  accent = '#d77757',
  background = '#141414',
}) {
  // split into words, keeping the spaces so the reply wraps exactly as the full text does
  const parts = useMemo(() => text.match(/\S+\s*/g) ?? [], [text])
  const [count, setCount] = useState(0)

  useEffect(() => {
    setCount(0)
  }, [text])

  useEffect(() => {
    let t
    if (count < parts.length) {
      // a little jitter, so it reads like a real stream and not a metronome
      const wait = (1000 / speed) * (0.55 + Math.random() * 0.9)
      t = setTimeout(() => setCount((n) => Math.min(n + 1 + (Math.random() < 0.25 ? 1 : 0), parts.length)), wait)
    } else if (loop) {
      t = setTimeout(() => setCount(0), 2400)
    }
    return () => clearTimeout(t)
  }, [count, parts.length, speed, loop])

  const done = count >= parts.length
  const family = font === 'mono' ? 'ui-monospace, "SF Mono", Menlo, Consolas, monospace' : '"Plus Jakarta Sans", system-ui, -apple-system, "Segoe UI", sans-serif'
  const caret = {
    block: { width: '0.55em', height: '1.05em', borderRadius: 2, verticalAlign: '-0.15em' },
    bar: { width: 2, height: '1.1em', verticalAlign: '-0.18em' },
    dot: { width: '0.5em', height: '0.5em', borderRadius: '50%', verticalAlign: '0.05em' },
  }[cursor] ?? {}

  return (
    <div
      aria-live="polite"
      aria-busy={!done}
      style={{ width: `min(${width}px, 100%)`, padding: '1.1em 1.3em', borderRadius: 10, background, color, font: `400 ${size}px/1.6 ${family}`, boxSizing: 'border-box' }}
    >
      <style>{`
        @keyframes st-in{from{opacity:0;filter:blur(2px)}to{opacity:1;filter:none}}
        @keyframes st-blink{0%,45%{opacity:1}55%,100%{opacity:0}}
        @media (prefers-reduced-motion:reduce){.st-word,.st-caret{animation:none!important}}
      `}</style>
      {/* both layers share one grid cell: the hidden full text fixes the size */}
      <div style={{ display: 'grid' }}>
        <div aria-hidden style={{ gridArea: '1 / 1', visibility: 'hidden' }}>
          {text}
          <span style={{ display: 'inline-block', marginLeft: 2, ...caret }} />
        </div>
        <div style={{ gridArea: '1 / 1' }}>
          {parts.slice(0, count).map((w, i) => (
            <span key={i} className="st-word" style={{ animation: 'st-in 0.35s ease-out' }}>
              {w}
            </span>
          ))}
          <span
            className="st-caret"
            aria-hidden
            style={{ display: 'inline-block', marginLeft: 2, background: accent, ...caret, animation: done ? 'st-blink 1s step-end infinite' : 'none' }}
          />
        </div>
      </div>
    </div>
  )
}
