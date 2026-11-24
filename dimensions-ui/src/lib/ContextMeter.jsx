import { useEffect, useState } from 'react'

const nf = new Intl.NumberFormat('en-US')

// A bar that shows how much of the model's context window is used. The fill turns from
// green to amber to red as it passes the two thresholds. With `autoplay` on, the demo
// fills up and resets; turn it off and set `used` yourself.
export default function ContextMeter({
  used = 64000, // tokens used (when autoplay is off)
  limit = 200000,
  autoplay = true,
  warnAt = 70, // percent
  dangerAt = 90, // percent
  showNumbers = true,
  speed = 1,
  size = 14,
  width = 400,
  background = '#141414',
  textColor = '#e8e6e1',
  mutedColor = '#8a8a8a',
  okColor = '#4eba65',
  warnColor = '#e0a030',
  dangerColor = '#e5534b',
}) {
  const [auto, setAuto] = useState(0.08)

  useEffect(() => {
    if (!autoplay) return
    const t = setInterval(() => setAuto((a) => (a >= 0.99 ? 0.08 : Math.min(1, a + 0.045))), 450 / speed)
    return () => clearInterval(t)
  }, [autoplay, speed])

  const frac = Math.max(0, Math.min(1, autoplay ? auto : used / limit))
  const pct = frac * 100
  const c = pct >= dangerAt ? dangerColor : pct >= warnAt ? warnColor : okColor

  return (
    <div
      role="meter"
      aria-label="Context window used"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      style={{ width: `min(${width}px, 100%)`, boxSizing: 'border-box', padding: '1em 1.2em', borderRadius: 10, background, color: textColor, font: `400 ${size}px/1.3 ui-monospace, "SF Mono", Menlo, Consolas, monospace` }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.7em', color: mutedColor }}>
        <span>Context</span>
        <span style={{ color: c, fontVariantNumeric: 'tabular-nums', transition: 'color .3s' }}>{Math.round(pct)}%</span>
      </div>
      <div style={{ position: 'relative', height: '0.65em', borderRadius: 99, background: mutedColor + '33', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, borderRadius: 99, background: c, transition: 'width .45s ease, background .3s' }} />
      </div>
      {showNumbers && (
        <div style={{ marginTop: '0.7em', color: mutedColor, fontVariantNumeric: 'tabular-nums' }}>
          {nf.format(Math.round(frac * limit))} / {nf.format(limit)} tokens
        </div>
      )}
    </div>
  )
}
