import { useEffect, useState } from 'react'

const STEPS = ['Read the failing test', 'Find the cause in Timer.jsx', 'Fix the interval cleanup', 'Run the test suite', 'Summarise the change']

// An agent plan as a vertical timeline. Done steps are filled, the active step pulses,
// upcoming steps are hollow, and the connector between steps fills as work moves on.
export default function StepTimeline({
  steps = STEPS,
  autoplay = true,
  active = 0, // used when autoplay is off
  speed = 1,
  size = 15,
  width = 380,
  background = '#141414',
  textColor = '#e8e6e1',
  mutedColor = '#6f6f6f',
  color = '#d77757',
}) {
  const [auto, setAuto] = useState(0)
  const n = steps.length

  useEffect(() => {
    if (!autoplay) return
    const finished = auto >= n
    const t = setTimeout(() => setAuto((a) => (finished ? 0 : a + 1)), (finished ? 2800 : 1500) / speed)
    return () => clearTimeout(t)
  }, [autoplay, auto, n, speed])

  const cur = Math.max(0, Math.min(autoplay ? auto : active, n))

  return (
    <ol
      aria-label="Plan"
      style={{ listStyle: 'none', margin: 0, width: `min(${width}px, 100%)`, boxSizing: 'border-box', padding: '1.1em 1.3em', borderRadius: 10, background, color: textColor, font: `400 ${size}px/1.3 ui-monospace, "SF Mono", Menlo, Consolas, monospace` }}
    >
      <style>{`
        @keyframes st-pulse{0%{box-shadow:0 0 0 0 var(--st-c)}100%{box-shadow:0 0 0 .6em transparent}}
        @media (prefers-reduced-motion:reduce){.st-dot{animation:none!important}.st-line i{transition:none!important}}
      `}</style>
      {steps.map((label, i) => {
        const state = i < cur ? 'done' : i === cur ? 'active' : 'todo'
        const last = i === n - 1
        return (
          <li key={i} aria-current={state === 'active' ? 'step' : undefined} style={{ display: 'flex', gap: '0.9em', minHeight: last ? 0 : '2.6em', '--st-c': color + '88' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '1em', flex: 'none' }}>
              <span
                className="st-dot"
                style={{
                  width: '0.8em', height: '0.8em', borderRadius: '50%', boxSizing: 'border-box', marginTop: '0.25em',
                  border: `2px solid ${state === 'todo' ? mutedColor : color}`,
                  background: state === 'done' ? color : state === 'active' ? background : 'transparent',
                  animation: state === 'active' ? 'st-pulse 1.4s ease-out infinite' : 'none',
                  transition: 'background .3s, border-color .3s',
                }}
              />
              {!last && (
                <span className="st-line" style={{ flex: 1, width: 2, marginTop: 3, background: mutedColor + '55', overflow: 'hidden', borderRadius: 1 }}>
                  <i style={{ display: 'block', height: '100%', background: color, transformOrigin: 'top', transform: `scaleY(${i < cur ? 1 : 0})`, transition: 'transform .45s ease' }} />
                </span>
              )}
            </div>
            <span style={{ color: state === 'todo' ? mutedColor : textColor, fontWeight: state === 'active' ? 600 : 400, transition: 'color .3s' }}>
              {label}
              {state === 'active' && <span aria-hidden style={{ color }}>…</span>}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
