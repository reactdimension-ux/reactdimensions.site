import { useEffect, useState } from 'react'

const CALLS = [
  { tool: 'Read', args: 'src/Timer.jsx', result: 'Read 84 lines' },
  { tool: 'Search', args: '"setInterval" in src', result: 'Found 3 matches in 2 files' },
  { tool: 'Edit', args: 'src/Timer.jsx', result: 'Updated with 4 additions and 2 removals', error: 'File changed on disk, re-reading first' },
]

// Agent tool calls in the Claude Code style: a dot and the call, then a result line
// underneath. Each call runs (dot blinking, "Running…") and then turns green when it
// finishes, or red when it fails. The box keeps its size the whole time.
export default function ToolCallCard({
  calls = CALLS,
  fail = false, // the last call fails instead of succeeding
  speed = 1,
  size = 15,
  width = 520,
  background = '#141414',
  textColor = '#e8e6e1',
  mutedColor = '#8a8a8a',
  runningColor = '#9a9a9a',
  doneColor = '#4eba65',
  errorColor = '#e5534b',
}) {
  // which call is running; past ones are finished, later ones not started yet
  const [step, setStep] = useState(0)
  const [secs, setSecs] = useState(0)

  useEffect(() => {
    const finished = step >= calls.length
    const t = setTimeout(() => setStep((s) => (finished ? 0 : s + 1)), (finished ? 3200 : 1700) / speed)
    return () => clearTimeout(t)
  }, [step, calls.length, speed])

  useEffect(() => {
    setSecs(0)
    if (step >= calls.length) return
    const t = setInterval(() => setSecs((n) => n + 1), 1000 / speed)
    return () => clearInterval(t)
  }, [step, calls.length, speed])

  return (
    <div
      role="log"
      aria-live="polite"
      style={{ width: `min(${width}px, 100%)`, boxSizing: 'border-box', padding: '1em 1.2em', borderRadius: 10, background, color: textColor, font: `400 ${size}px/1.5 ui-monospace, "SF Mono", Menlo, Consolas, monospace` }}
    >
      <style>{`
        @keyframes tc-blink{0%,100%{opacity:1}50%{opacity:.2}}
        @keyframes tc-in{from{opacity:0;transform:translateY(3px)}to{opacity:1;transform:none}}
        @media (prefers-reduced-motion:reduce){.tc *{animation:none!important}}
      `}</style>
      <div className="tc" style={{ display: 'grid', gap: '0.75em' }}>
        {calls.map((c, i) => {
          const state = i < step ? (fail && i === calls.length - 1 ? 'error' : 'done') : i === step ? 'running' : 'waiting'
          const dot = { running: runningColor, done: doneColor, error: errorColor }[state]
          const line = state === 'running' ? `Running… ${secs}s` : state === 'error' ? `Error: ${c.error ?? 'the tool call failed'}` : c.result
          return (
            // calls that have not started keep their space, so the box does not grow
            <div key={i} style={{ visibility: state === 'waiting' ? 'hidden' : 'visible', animation: state === 'running' ? 'tc-in .25s ease-out' : 'none' }}>
              <div style={{ display: 'flex', gap: '0.6em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                <span aria-hidden style={{ color: dot, animation: state === 'running' ? 'tc-blink 1s ease-in-out infinite' : 'none', transition: 'color .3s' }}>
                  ⏺
                </span>
                <span>
                  <b style={{ fontWeight: 600 }}>{c.tool}</b>
                  <span style={{ color: mutedColor }}>(</span>
                  {c.args}
                  <span style={{ color: mutedColor }}>)</span>
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.6em', color: state === 'error' ? errorColor : mutedColor, paddingLeft: '0.35em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                <span aria-hidden>⎿</span>
                <span>{line}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
