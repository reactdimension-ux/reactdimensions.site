import { useEffect, useState } from 'react'

const THOUGHTS = [
  'The user says the page slows down the longer it stays open.',
  'That points to work piling up, not one slow render.',
  'Timer.jsx calls setInterval in the component body, so every render starts another timer.',
  'None of them are cleared, so after a minute there are dozens running.',
  'Moving it into useEffect with clearInterval in the cleanup keeps exactly one.',
]

// The "thinking" box an agent shows above its answer. While it thinks, the header
// shimmers and the latest thought shows underneath. When it is done the header
// reads "Thought for 6s" and the box opens to show every step.
export default function ReasoningPanel({
  thoughts = THOUGHTS,
  summary = 'Found a timer that is never cleared',
  loop = true,
  speed = 1,
  size = 15,
  width = 500,
  background = '#141414',
  textColor = '#e8e6e1',
  mutedColor = '#8f8c86',
  accent = '#d77757',
}) {
  // step < thoughts.length: still thinking, showing that thought
  const [step, setStep] = useState(0)
  const [open, setOpen] = useState(false)
  const thinking = step < thoughts.length
  const secs = Math.max(1, Math.round((thoughts.length * 1.4) / speed))

  useEffect(() => {
    if (!thinking && (!loop || open)) return
    const t = setTimeout(() => setStep((s) => (s < thoughts.length ? s + 1 : 0)), (thinking ? 1400 : 5200) / speed)
    return () => clearTimeout(t)
  }, [step, thinking, loop, open, thoughts.length, speed])

  // a new run starts closed
  useEffect(() => {
    if (step === 0) setOpen(false)
  }, [step])

  const one = { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
  return (
    <div
      style={{ width: `min(${width}px, 100%)`, boxSizing: 'border-box', borderRadius: 10, background, color: textColor, font: `400 ${size}px/1.55 "Plus Jakarta Sans", system-ui, -apple-system, "Segoe UI", sans-serif`, overflow: 'hidden' }}
    >
      <style>{`
        @keyframes rp-sweep{from{background-position:130% 0}to{background-position:-30% 0}}
        @keyframes rp-in{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
        @media (prefers-reduced-motion:reduce){.rp *{animation:none!important;transition:none!important}}
      `}</style>
      <div className="rp">
        <button
          type="button"
          onClick={() => !thinking && setOpen((o) => !o)}
          aria-expanded={open}
          disabled={thinking}
          style={{ all: 'unset', boxSizing: 'border-box', width: '100%', padding: '0.9em 1.1em 0.25em', display: 'flex', alignItems: 'center', gap: '0.55em', cursor: thinking ? 'default' : 'pointer' }}
        >
          <span aria-hidden style={{ color: accent }}>✻</span>
          <span
            style={
              thinking
                ? { backgroundImage: `linear-gradient(100deg, ${mutedColor} 40%, ${textColor} 50%, ${mutedColor} 60%)`, backgroundSize: '250% 100%', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', animation: `rp-sweep ${2.2 / speed}s linear infinite` }
                : { color: mutedColor }
            }
          >
            {thinking ? 'Thinking…' : `Thought for ${secs}s`}
          </span>
          <span aria-hidden style={{ marginLeft: 'auto', color: mutedColor, opacity: thinking ? 0 : 1, transform: `rotate(${open ? 90 : 0}deg)`, transition: 'transform .25s, opacity .25s' }}>
            ›
          </span>
        </button>

        {/* one line under the header, so the closed box is the same height in both states */}
        <div aria-live="polite" style={{ ...one, padding: '0 1.1em 0.9em 2.25em', color: mutedColor, fontStyle: 'italic', fontSize: '0.92em' }}>
          <span key={step} style={{ display: 'inline-block', animation: 'rp-in .3s ease-out' }}>
            {thinking ? thoughts[step] : summary}
          </span>
        </div>

        {/* the full reasoning: opens by animating the grid row from 0fr to 1fr */}
        <div style={{ display: 'grid', gridTemplateRows: open ? '1fr' : '0fr', transition: 'grid-template-rows .35s ease' }}>
          <div style={{ overflow: 'hidden' }}>
            <ol style={{ margin: 0, padding: '0.2em 1.1em 1em 2.25em', listStyle: 'none', borderTop: `1px solid ${mutedColor}33`, display: 'grid', gap: '0.5em', fontSize: '0.92em', color: mutedColor }}>
              {thoughts.map((t, i) => (
                <li key={i} style={{ position: 'relative', paddingTop: i ? 0 : '0.7em' }}>
                  <span aria-hidden style={{ position: 'absolute', left: '-1.15em', color: `${mutedColor}88` }}>
                    {i + 1}
                  </span>
                  {t}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}
