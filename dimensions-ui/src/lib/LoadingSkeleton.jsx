// Placeholder lines shaped like an agent reply, shown while it is still being written. A
// soft highlight sweeps across them (the same background-position trick as the Thinking
// Indicator shimmer). Line widths are fixed, so the shape matches a real paragraph and
// nothing jumps when the text arrives.
const WIDTHS = [96, 100, 88, 100, 62]

export default function LoadingSkeleton({
  lines = 5,
  avatar = true,
  speed = 1,
  width = 440,
  lineHeight = 12,
  background = '#141414',
  baseColor = '#262626',
  shineColor = '#3a3a3a',
}) {
  const n = Math.max(1, Math.round(lines))
  const bar = {
    height: lineHeight,
    borderRadius: lineHeight / 2,
    backgroundColor: baseColor,
    backgroundImage: `linear-gradient(90deg, transparent 0%, ${shineColor} 50%, transparent 100%)`,
    backgroundSize: '200% 100%',
    backgroundRepeat: 'no-repeat',
    animation: `ls-sweep ${1.6 / speed}s ease-in-out infinite`,
  }
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading reply"
      style={{ display: 'flex', gap: 14, width: `min(${width}px, 100%)`, boxSizing: 'border-box', padding: '1.1em 1.2em', borderRadius: 10, background }}
    >
      <style>{`
        @keyframes ls-sweep{0%{background-position:150% 0}100%{background-position:-50% 0}}
        @media (prefers-reduced-motion:reduce){.ls-bar{animation:none!important}}
      `}</style>
      {avatar && <div className="ls-bar" style={{ ...bar, width: 34, height: 34, borderRadius: '50%', flex: 'none' }} />}
      <div style={{ flex: 1, display: 'grid', gap: lineHeight * 0.9, alignContent: 'start', paddingTop: 4 }}>
        <div className="ls-bar" style={{ ...bar, width: '34%', height: lineHeight * 1.15, marginBottom: lineHeight * 0.3 }} />
        {Array.from({ length: n }, (_, i) => (
          <div key={i} className="ls-bar" style={{ ...bar, width: `${i === n - 1 ? 58 : WIDTHS[i % WIDTHS.length]}%`, animationDelay: `${i * 0.08}s` }} />
        ))}
      </div>
    </div>
  )
}
