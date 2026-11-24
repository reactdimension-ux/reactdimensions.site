import { useEffect, useRef, useState } from 'react'

// A dial showing how sure the agent is. The arc is an SVG path drawn with
// stroke-dasharray, and the needle follows the value on a damped spring, so it
// overshoots and settles. With `autoplay` on, the demo picks a new value every few
// seconds; turn it off and set `value` yourself (0 to 100).
export default function ConfidenceGauge({
  value = 72,
  autoplay = true,
  lowAt = 40,
  highAt = 75,
  stiffness = 90,
  damping = 9,
  label = 'Confidence',
  size = 260,
  background = '#141414',
  textColor = '#e8e6e1',
  mutedColor = '#8a8a8a',
  lowColor = '#e5534b',
  midColor = '#e0a030',
  highColor = '#4eba65',
}) {
  const [target, setTarget] = useState(autoplay ? 35 : value)
  const [v, setV] = useState(autoplay ? 35 : value)
  const sim = useRef({ x: v, vel: 0 })

  useEffect(() => {
    if (!autoplay) return setTarget(value)
    const t = setInterval(() => setTarget(Math.round(8 + Math.random() * 90)), 2600)
    return () => clearInterval(t)
  }, [autoplay, value])

  // damped spring toward the target
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    let raf
    let last = performance.now()
    const tick = (now) => {
      const dt = Math.min(0.032, (now - last) / 1000)
      last = now
      const s = sim.current
      if (reduce) s.x = target
      else {
        s.vel += (stiffness * (target - s.x) - damping * s.vel) * dt
        s.x += s.vel * dt
      }
      setV(s.x)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, stiffness, damping])

  const R = 90
  const arc = `M ${100 - R} 110 A ${R} ${R} 0 0 1 ${100 + R} 110`
  const len = Math.PI * R
  const shown = Math.max(0, Math.min(100, v))
  const c = target >= highAt ? highColor : target >= lowAt ? midColor : lowColor
  const angle = -90 + (Math.max(-4, Math.min(104, v)) / 100) * 180

  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(target)}
      style={{ width: `min(${size}px, 100%)`, boxSizing: 'border-box', padding: '0.8em 1em 1em', borderRadius: 10, background, color: textColor }}
    >
      <svg viewBox="0 0 200 156" style={{ width: '100%', display: 'block' }}>
        <path d={arc} fill="none" stroke={mutedColor + '33'} strokeWidth="14" strokeLinecap="round" />
        <path d={arc} fill="none" stroke={c} strokeWidth="14" strokeLinecap="round" strokeDasharray={len} strokeDashoffset={len * (1 - shown / 100)} style={{ transition: 'stroke .3s' }} />
        {/* needle */}
        <g transform={`rotate(${angle} 100 110)`}>
          <path d="M100 110 L100 34" stroke={textColor} strokeWidth="3" strokeLinecap="round" />
        </g>
        <circle cx="100" cy="110" r="8" fill={textColor} />
        <circle cx="100" cy="110" r="3" fill={background} />
        <text x="100" y="140" textAnchor="middle" fontSize="26" fontWeight="700" fill={textColor} fontFamily='ui-monospace, "SF Mono", Menlo, monospace'>
          {Math.round(shown)}%
        </text>
        <text x="100" y="153" textAnchor="middle" fontSize="9" letterSpacing="1.5" fill={mutedColor} fontFamily='ui-monospace, "SF Mono", Menlo, monospace'>
          {label.toUpperCase()}
        </text>
      </svg>
    </div>
  )
}
