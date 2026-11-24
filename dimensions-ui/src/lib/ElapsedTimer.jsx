import { useEffect, useState } from 'react'

const fmt = (s) => (s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`)

// The working line's timer: "● 12s · esc to interrupt". It ticks while `running` is on
// and stops (keeping the time) when it is off. Turn `cycle` on in the demo to have it
// run for a while, pause, and restart by itself.
export default function ElapsedTimer({
  running = true,
  cycle = true,
  hint = 'esc to interrupt',
  showDot = true,
  speed = 1,
  size = 16,
  background = '#141414',
  textColor = '#e8e6e1',
  mutedColor = '#8a8a8a',
  color = '#d77757',
}) {
  const [secs, setSecs] = useState(0)
  const [auto, setAuto] = useState(true)
  const on = running && (cycle ? auto : true)

  useEffect(() => {
    if (!on) return
    const t = setInterval(() => setSecs((n) => n + 1), 1000 / speed)
    return () => clearInterval(t)
  }, [on, speed])

  // demo cycle: work for 14s, rest for 3s, then start again from zero
  useEffect(() => {
    if (!cycle || !running) return
    if (auto && secs >= 14) setAuto(false)
    if (!auto) {
      const t = setTimeout(() => {
        setSecs(0)
        setAuto(true)
      }, 3000 / speed)
      return () => clearTimeout(t)
    }
  }, [cycle, running, auto, secs, speed])

  return (
    <div
      role="timer"
      aria-label={`Elapsed ${fmt(secs)}`}
      style={{ display: 'inline-flex', alignItems: 'baseline', gap: '0.6em', boxSizing: 'border-box', padding: '0.8em 1.1em', borderRadius: 10, background, color: textColor, whiteSpace: 'nowrap', font: `400 ${size}px/1.2 ui-monospace, "SF Mono", Menlo, Consolas, monospace` }}
    >
      <style>{`
        @keyframes et-blink{0%,100%{opacity:1}50%{opacity:.25}}
        @media (prefers-reduced-motion:reduce){.et-dot{animation:none!important}}
      `}</style>
      {showDot && (
        <span aria-hidden className="et-dot" style={{ color: on ? color : mutedColor, animation: on ? 'et-blink 1.2s ease-in-out infinite' : 'none' }}>
          ⏺
        </span>
      )}
      <span style={{ fontVariantNumeric: 'tabular-nums', minWidth: '3.6em' }}>{fmt(secs)}</span>
      {hint && (
        <span style={{ color: mutedColor }}>
          · {hint}
        </span>
      )}
    </div>
  )
}
