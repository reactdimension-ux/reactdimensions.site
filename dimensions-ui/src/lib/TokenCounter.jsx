import { useEffect, useRef, useState } from 'react'

// Token usage that counts up with easing, plus a small cost readout. Each cycle the
// target grows (as if the model kept generating), the number eases to it, and after a
// pause it starts again from zero. Set `value` to drive it yourself with autoplay off.
export default function TokenCounter({
  autoplay = true,
  value = 12480, // used when autoplay is off
  max = 48000, // top of the autoplay range
  pricePerMillion = 3, // dollars per million tokens
  showCost = true,
  speed = 1,
  size = 34,
  background = '#141414',
  textColor = '#e8e6e1',
  mutedColor = '#8a8a8a',
  color = '#d77757',
}) {
  const [shown, setShown] = useState(autoplay ? 0 : value)
  const [round, setRound] = useState(0)
  const cur = useRef(shown)
  cur.current = shown

  // each round eases to a new target; in autoplay a timer then starts the next round
  useEffect(() => {
    const to = autoplay ? (round % 3 === 2 ? 0 : Math.round((max * (0.35 + 0.65 * Math.random())) / 10) * 10) : value
    const fromN = cur.current
    const dur = 1400 / speed
    const t0 = performance.now()
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    let raf
    const step = (now) => {
      const k = reduce ? 1 : Math.min(1, (now - t0) / dur)
      setShown(Math.round(fromN + (to - fromN) * (1 - Math.pow(1 - k, 3))))
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    const next = autoplay ? setTimeout(() => setRound((r) => r + 1), (dur + 2200)) : null
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(next)
    }
  }, [round, autoplay, value, max, speed])

  const nf = new Intl.NumberFormat('en-US')
  const cost = (shown / 1e6) * pricePerMillion

  return (
    <div
      role="status"
      aria-label={`${nf.format(shown)} tokens`}
      style={{ display: 'inline-flex', flexDirection: 'column', gap: '0.25em', boxSizing: 'border-box', padding: '0.9em 1.2em', minWidth: '9em', borderRadius: 10, background, color: textColor, font: `400 ${size}px/1.1 ui-monospace, "SF Mono", Menlo, Consolas, monospace` }}
    >
      <span style={{ fontSize: '0.38em', letterSpacing: '0.12em', textTransform: 'uppercase', color: mutedColor }}>Tokens</span>
      <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', color }}>{nf.format(shown)}</span>
      {showCost && (
        <span style={{ fontSize: '0.42em', color: mutedColor, fontVariantNumeric: 'tabular-nums' }}>≈ ${cost.toFixed(cost < 1 ? 4 : 2)}</span>
      )}
    </div>
  )
}
