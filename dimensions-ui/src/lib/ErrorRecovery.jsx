import { useEffect, useState } from 'react'

// "That didn't work, trying another way…" A small state machine: trying, failed,
// retrying, then ok (or gave up when the retries run out). The demo plays it on a loop.
// `failures` is how many attempts fail before one works; if it is at least `maxRetries`
// the agent runs out of tries and stops with an error.
export default function ErrorRecovery({
  task = 'Run the test suite',
  failures = 2,
  maxRetries = 3,
  speed = 1,
  width = 460,
  size = 15,
  background = '#141414',
  textColor = '#e8e6e1',
  mutedColor = '#8a8a8a',
  color = '#d77757',
  okColor = '#4eba65',
  errorColor = '#e5534b',
}) {
  const [attempt, setAttempt] = useState(1)
  const [phase, setPhase] = useState('trying') // trying | failed | retrying | ok | gaveup

  useEffect(() => {
    const failing = attempt <= failures
    const last = attempt >= maxRetries
    let ms
    let next
    if (phase === 'trying' || phase === 'retrying') {
      ms = 1500
      next = () => (failing ? setPhase(last ? 'gaveup' : 'failed') : setPhase('ok'))
    } else if (phase === 'failed') {
      ms = 1100
      next = () => (setAttempt((a) => a + 1), setPhase('retrying'))
    } else {
      ms = 3000
      next = () => (setAttempt(1), setPhase('trying'))
    }
    const t = setTimeout(next, ms / speed)
    return () => clearTimeout(t)
  }, [phase, attempt, failures, maxRetries, speed])

  const busy = phase === 'trying' || phase === 'retrying'
  const c = { trying: color, retrying: color, failed: errorColor, gaveup: errorColor, ok: okColor }[phase]
  const line = {
    trying: `Running: ${task}`,
    failed: 'That didn’t work. Trying another way…',
    retrying: `Retrying: ${task}`,
    ok: `Done: ${task}`,
    gaveup: 'Out of retries. Stopping here.',
  }[phase]
  const icon = { failed: '✘', gaveup: '✘', ok: '✔' }[phase] || '⏺'

  return (
    <div
      role="status"
      aria-live="polite"
      style={{ width: `min(${width}px, 100%)`, boxSizing: 'border-box', padding: '1em 1.2em', borderRadius: 10, background, color: textColor, font: `400 ${size}px/1.4 ui-monospace, "SF Mono", Menlo, Consolas, monospace` }}
    >
      <style>{`
        @keyframes er-blink{0%,100%{opacity:1}50%{opacity:.25}}
        @keyframes er-shake{0%,100%{transform:none}25%{transform:translateX(-3px)}75%{transform:translateX(3px)}}
        @media (prefers-reduced-motion:reduce){.er *{animation:none!important}}
      `}</style>
      <div className="er" style={{ display: 'flex', gap: '0.7em', alignItems: 'baseline', animation: phase === 'failed' ? 'er-shake .3s' : 'none' }}>
        <span aria-hidden style={{ color: c, animation: busy ? 'er-blink 1s ease-in-out infinite' : 'none', transition: 'color .2s' }}>{icon}</span>
        <span style={{ flex: 1, color: phase === 'ok' ? okColor : textColor }}>{line}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5em', marginTop: '0.9em', paddingLeft: '1.4em', color: mutedColor }}>
        <span>Attempt</span>
        {Array.from({ length: maxRetries }, (_, i) => {
          const n = i + 1
          const state = n < attempt || (n === attempt && (phase === 'failed' || phase === 'gaveup')) ? 'fail' : n === attempt ? (phase === 'ok' ? 'ok' : 'now') : 'todo'
          const dc = { fail: errorColor, ok: okColor, now: color, todo: mutedColor + '55' }[state]
          return <span key={n} aria-hidden style={{ width: '0.7em', height: '0.7em', borderRadius: '50%', background: state === 'todo' ? 'transparent' : dc, border: `1.5px solid ${dc}`, transition: 'all .25s' }} />
        })}
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{Math.min(attempt, maxRetries)} of {maxRetries}</span>
      </div>
    </div>
  )
}
