import { useEffect, useState } from 'react'

const GOOD = ['Accurate', 'Clear', 'Creative', 'Fast']
const BAD = ['Wrong answer', 'Unclear', 'Too long', 'Not what I asked']

// "Was this helpful?" that grows into a reason picker. Three steps: idle (thumbs up or
// down), reasons (pick one or more chips), thanks. In the demo it resets a moment
// after the thank-you.
export default function FeedbackBar({
  question = 'Was this helpful?',
  onSubmit = () => {},
  demo = true,
  width = 420,
  size = 14,
  background = '#141414',
  textColor = '#e8e6e1',
  mutedColor = '#8a8a8a',
  color = '#d77757',
}) {
  const [step, setStep] = useState('idle') // idle | reasons | thanks
  const [vote, setVote] = useState(null) // 'up' | 'down'
  const [picked, setPicked] = useState([])

  useEffect(() => {
    if (step !== 'thanks' || !demo) return
    const t = setTimeout(() => {
      setStep('idle')
      setVote(null)
      setPicked([])
    }, 2600)
    return () => clearTimeout(t)
  }, [step, demo])

  const send = () => {
    onSubmit({ vote, reasons: picked })
    setStep('thanks')
  }
  const chip = (on) => ({ cursor: 'pointer', font: 'inherit', fontSize: '0.92em', padding: '0.4em 0.85em', borderRadius: 99, border: `1px solid ${on ? color : mutedColor + '55'}`, background: on ? color + '22' : 'transparent', color: on ? color : textColor, transition: 'all .15s' })
  const thumb = (on) => ({ cursor: 'pointer', font: 'inherit', fontSize: '1.15em', width: '2.2em', height: '2.2em', borderRadius: 8, border: `1px solid ${on ? color : mutedColor + '55'}`, background: on ? color + '22' : 'transparent', color: on ? color : textColor })

  return (
    <div
      aria-live="polite"
      style={{ width: `min(${width}px, 100%)`, boxSizing: 'border-box', padding: '1em 1.2em', borderRadius: 10, background, color: textColor, font: `400 ${size}px/1.3 ui-monospace, "SF Mono", Menlo, Consolas, monospace` }}
    >
      <style>{`
        @keyframes fb-in{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
        @media (prefers-reduced-motion:reduce){.fb-step{animation:none!important}}
      `}</style>
      {step === 'thanks' ? (
        <div className="fb-step" style={{ animation: 'fb-in .25s ease-out', display: 'grid', placeItems: 'center', minHeight: '3.2em', color }}>
          <span style={{ fontWeight: 600 }}>✔ Thanks for the feedback</span>
        </div>
      ) : (
        <div className="fb-step" key={step} style={{ animation: 'fb-in .25s ease-out' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8em' }}>
            <span style={{ flex: 1, color: mutedColor }}>{question}</span>
            <button aria-label="Yes, helpful" aria-pressed={vote === 'up'} style={thumb(vote === 'up')} onClick={() => (setVote('up'), setPicked([]), setStep('reasons'))}>
              👍
            </button>
            <button aria-label="No, not helpful" aria-pressed={vote === 'down'} style={thumb(vote === 'down')} onClick={() => (setVote('down'), setPicked([]), setStep('reasons'))}>
              👎
            </button>
          </div>
          {step === 'reasons' && (
            <div style={{ marginTop: '0.9em' }}>
              <div style={{ color: mutedColor, marginBottom: '0.6em' }}>{vote === 'up' ? 'What worked?' : 'What went wrong?'}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5em', marginBottom: '0.9em' }}>
                {(vote === 'up' ? GOOD : BAD).map((r) => (
                  <button key={r} aria-pressed={picked.includes(r)} style={chip(picked.includes(r))} onClick={() => setPicked((p) => (p.includes(r) ? p.filter((x) => x !== r) : [...p, r]))}>
                    {r}
                  </button>
                ))}
              </div>
              <button onClick={send} style={{ cursor: 'pointer', font: 'inherit', fontWeight: 600, padding: '0.45em 1.1em', borderRadius: 6, border: `1px solid ${color}`, background: color, color: '#0b0b0b' }}>
                Send
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
