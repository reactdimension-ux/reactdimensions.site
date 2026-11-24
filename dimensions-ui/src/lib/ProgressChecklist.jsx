import { useEffect, useState } from 'react'

const ITEMS = ['Reproduce the bug', 'Write a failing test', 'Fix the timer cleanup', 'Update the docs', 'Open a pull request']

// A live todo list in the Claude Code style. The agent works down the list: the current
// item is marked in progress, finished items get a tick and a strike-through that draws
// across the text. The box keeps its size the whole time.
export default function ProgressChecklist({
  items = ITEMS,
  speed = 1,
  loop = true,
  size = 15,
  width = 380,
  background = '#141414',
  textColor = '#e8e6e1',
  mutedColor = '#7a7a7a',
  color = '#4eba65',
  activeColor = '#d77757',
}) {
  const [done, setDone] = useState(0)
  const n = items.length

  useEffect(() => {
    const finished = done >= n
    if (finished && !loop) return
    const t = setTimeout(() => setDone((d) => (finished ? 0 : d + 1)), (finished ? 2800 : 1600) / speed)
    return () => clearTimeout(t)
  }, [done, n, speed, loop])

  return (
    <div
      role="list"
      aria-live="polite"
      style={{ width: `min(${width}px, 100%)`, boxSizing: 'border-box', padding: '1.1em 1.3em', borderRadius: 10, background, color: textColor, font: `400 ${size}px/1.4 ui-monospace, "SF Mono", Menlo, Consolas, monospace` }}
    >
      <style>{`
        @keyframes pc-blink{0%,100%{opacity:1}50%{opacity:.3}}
        @media (prefers-reduced-motion:reduce){.pc-box{animation:none!important}.pc-text{transition:none!important}}
      `}</style>
      <div style={{ color: mutedColor, marginBottom: '0.7em' }}>
        Tasks · {Math.min(done, n)}/{n} done
      </div>
      <div style={{ display: 'grid', gap: '0.55em' }}>
        {items.map((label, i) => {
          const state = i < done ? 'done' : i === done ? 'doing' : 'todo'
          return (
            <div key={i} role="listitem" style={{ display: 'flex', gap: '0.7em', alignItems: 'baseline' }}>
              <span
                aria-hidden
                className="pc-box"
                style={{ width: '1em', flex: 'none', textAlign: 'center', color: state === 'done' ? color : state === 'doing' ? activeColor : mutedColor, animation: state === 'doing' ? 'pc-blink 1.2s ease-in-out infinite' : 'none', transition: 'color .3s' }}
              >
                {state === 'done' ? '✔' : state === 'doing' ? '◼' : '☐'}
              </span>
              <span
                className="pc-text"
                style={{
                  color: state === 'todo' ? mutedColor : state === 'done' ? mutedColor : textColor,
                  fontWeight: state === 'doing' ? 600 : 400,
                  // the strike-through is a gradient line that grows from the left
                  backgroundImage: `linear-gradient(${mutedColor}, ${mutedColor})`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: '0 55%',
                  backgroundSize: `${state === 'done' ? 100 : 0}% 1.5px`,
                  transition: 'background-size .45s ease, color .3s',
                }}
              >
                {label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
