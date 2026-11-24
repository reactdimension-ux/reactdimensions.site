import { useEffect, useState } from 'react'

const STATES = ['idle', 'thinking', 'working', 'done', 'error']
const LABELS = { idle: 'Idle', thinking: 'Thinking', working: 'Working', done: 'Done', error: 'Error' }

// A small pill that shows what the agent is doing. Each status maps to one colour and
// the dot only pulses while the agent is active (thinking or working). With `cycle` on,
// the demo walks through every status; turn it off and set `status` yourself.
export default function StatusPill({
  status = 'thinking', // 'idle' | 'thinking' | 'working' | 'done' | 'error'
  cycle = true,
  label = '', // overrides the default word
  speed = 1,
  size = 20,
  background = '#141414',
  idleColor = '#8a8a8a',
  thinkingColor = '#d77757',
  workingColor = '#5b9bd5',
  doneColor = '#4eba65',
  errorColor = '#e5534b',
}) {
  const [i, setI] = useState(Math.max(0, STATES.indexOf(status)))

  useEffect(() => {
    if (!cycle) return
    const t = setInterval(() => setI((n) => (n + 1) % STATES.length), 1800 / speed)
    return () => clearInterval(t)
  }, [cycle, speed])

  const s = cycle ? STATES[i] : STATES.includes(status) ? status : 'idle'
  const c = { idle: idleColor, thinking: thinkingColor, working: workingColor, done: doneColor, error: errorColor }[s]
  const active = s === 'thinking' || s === 'working'

  return (
    <span
      role="status"
      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.55em', boxSizing: 'border-box', padding: '0.45em 0.95em 0.45em 0.8em', borderRadius: 999, background, border: `1px solid ${c}55`, color: c, whiteSpace: 'nowrap', font: `500 ${size}px/1.2 ui-monospace, "SF Mono", Menlo, Consolas, monospace`, transition: 'color .3s, border-color .3s' }}
    >
      <style>{`
        @keyframes sp-pulse{0%{box-shadow:0 0 0 0 var(--sp-c)}100%{box-shadow:0 0 0 .5em transparent}}
        @media (prefers-reduced-motion:reduce){.sp-dot{animation:none!important}}
      `}</style>
      <span aria-hidden className="sp-dot" style={{ '--sp-c': c + '99', width: '0.6em', height: '0.6em', borderRadius: '50%', background: c, animation: active ? 'sp-pulse 1.3s ease-out infinite' : 'none', transition: 'background .3s' }} />
      <span style={{ display: 'inline-block', minWidth: '4.8em' }}>{label || LABELS[s]}</span>
    </span>
  )
}
