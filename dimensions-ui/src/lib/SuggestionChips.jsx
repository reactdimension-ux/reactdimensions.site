import { useEffect, useState } from 'react'

const MESSAGE = 'I found three problems in Timer.jsx. What would you like to do next?'
const CHIPS = ['Fix all three', 'Explain the first one', 'Show me the diff', 'Write a test for it']

// Quick replies under an agent message. They slide in one after another; picking
// one marks it with a tick and fades the rest, then it resets for another go.
// The chips keep their places while fading, so nothing jumps.
export default function SuggestionChips({
  message = MESSAGE,
  chips = CHIPS,
  layout = 'wrap', // 'wrap' | 'stack'
  autoplay = true, // pick one by itself now and then, so the demo moves
  size = 15,
  width = 480,
  background = '#141414',
  chipColor = '#ece9e3',
  border = '#3a3936',
  accent = '#d77757',
  onPick,
}) {
  const [run, setRun] = useState(0) // bumps to replay the entrance
  const [picked, setPicked] = useState(null)

  const choose = (i) => {
    if (picked !== null) return
    setPicked(i)
    onPick?.(chips[i], i)
  }

  // after a pick, reset and play the entrance again
  useEffect(() => {
    if (picked === null) return
    const t = setTimeout(() => {
      setPicked(null)
      setRun((r) => r + 1)
    }, 2200)
    return () => clearTimeout(t)
  }, [picked])

  useEffect(() => {
    if (!autoplay || picked !== null) return
    const t = setTimeout(() => choose((run + 1) % chips.length), 3400)
    return () => clearTimeout(t)
  }, [autoplay, picked, run, chips.length])

  return (
    <div style={{ width: `min(${width}px, 100%)`, boxSizing: 'border-box', padding: '1.1em 1.2em 1.2em', borderRadius: 12, background, color: chipColor, font: `400 ${size}px/1.5 "Plus Jakarta Sans", system-ui, -apple-system, "Segoe UI", sans-serif` }}>
      <style>{`
        @keyframes sc-in{from{opacity:0;transform:translateY(8px) scale(.96)}to{opacity:1;transform:none}}
        @keyframes sc-tick{from{stroke-dashoffset:20}to{stroke-dashoffset:0}}
        @media (prefers-reduced-motion:reduce){.sc *{animation:none!important;transition:none!important}}
      `}</style>
      <div className="sc">
        <div style={{ display: 'flex', gap: '0.6em', marginBottom: '0.9em' }}>
          <span aria-hidden style={{ color: accent }}>✻</span>
          <span>{message}</span>
        </div>
        <div key={run} role="group" aria-label="Suggested replies" style={{ display: 'flex', flexDirection: layout === 'stack' ? 'column' : 'row', alignItems: layout === 'stack' ? 'stretch' : 'flex-start', flexWrap: 'wrap', gap: 8, paddingLeft: '1.6em' }}>
          {chips.map((c, i) => {
            const on = picked === i
            const off = picked !== null && !on
            return (
              <button
                key={c}
                type="button"
                onClick={() => choose(i)}
                aria-pressed={on}
                style={{
                  all: 'unset',
                  boxSizing: 'border-box',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                  padding: '0.45em 0.85em',
                  borderRadius: 999,
                  border: `1px solid ${on ? accent : border}`,
                  background: on ? `${accent}22` : 'transparent',
                  color: on ? accent : chipColor,
                  fontSize: '0.9em',
                  cursor: picked === null ? 'pointer' : 'default',
                  opacity: off ? 0.25 : 1,
                  transform: on ? 'scale(1.04)' : 'none',
                  transition: 'opacity .35s, transform .25s, border-color .25s, background .25s, color .25s',
                  animation: `sc-in .4s ${0.15 + i * 0.09}s ease-out backwards`,
                }}
              >
                {/* the tick slot always takes its width, so the chip does not resize when picked */}
                <svg viewBox="0 0 12 12" width="11" height="11" aria-hidden style={{ fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', display: 'block', flex: 'none' }}>
                  {on ? <path d="M2.5 6.2 5 8.5 9.5 3.5" style={{ strokeDasharray: 20, animation: 'sc-tick .3s ease-out' }} /> : <path d="M4 3l3 3-3 3" opacity=".6" />}
                </svg>
                {c}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
