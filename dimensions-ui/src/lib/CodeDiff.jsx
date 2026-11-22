import { useEffect, useState } from 'react'

// one line per entry: ' ' unchanged, '-' removed, '+' added
const DIFF = [
  ' export default function Timer() {',
  '   const [n, setN] = useState(0)',
  '-  setInterval(() => setN((x) => x + 1), 1000)',
  '+  useEffect(() => {',
  '+    const id = setInterval(() => setN((x) => x + 1), 1000)',
  '+    return () => clearInterval(id)',
  '+  }, [])',
  '   return <span>{n}s</span>',
  ' }',
]

// A change an agent proposes, shown as a diff. Lines arrive one by one, then you
// Accept (the removed lines fold away) or Reject (the added ones do). The box keeps
// the height of the full diff the whole time.
export default function CodeDiff({
  diff = DIFF,
  file = 'src/Timer.jsx',
  autoplay = true, // play, accept, and start again by itself
  speed = 1,
  size = 13,
  width = 560,
  background = '#121212',
  textColor = '#d9d6cf',
  addColor = '#4eba65',
  removeColor = '#e5534b',
  accent = '#d77757',
  onDecide,
}) {
  const [shown, setShown] = useState(0)
  const [decision, setDecision] = useState(null) // 'accept' | 'reject' | null

  useEffect(() => {
    let t
    if (shown < diff.length) t = setTimeout(() => setShown((n) => n + 1), (diff[shown][0] === ' ' ? 90 : 260) / speed)
    else if (decision) t = setTimeout(() => (setDecision(null), setShown(0)), 2600 / speed)
    else if (autoplay) t = setTimeout(() => setDecision('accept'), 1800 / speed)
    return () => clearTimeout(t)
  }, [shown, decision, autoplay, diff, speed])

  const decide = (d) => {
    setDecision(d)
    onDecide?.(d)
  }
  const adds = diff.filter((l) => l[0] === '+').length
  const dels = diff.filter((l) => l[0] === '-').length
  const lh = 1.7
  let a = 0
  let b = 0 // old and new line numbers

  return (
    <div style={{ width: `min(${width}px, 100%)`, borderRadius: 12, overflow: 'hidden', background, border: '1px solid #ffffff14', color: textColor, font: `400 ${size}px/${lh} ui-monospace, "SF Mono", Menlo, Consolas, monospace` }}>
      <style>{`
        @keyframes cd-in{from{opacity:0;transform:translateX(-6px)}to{opacity:1;transform:none}}
        @media (prefers-reduced-motion:reduce){.cd *{animation:none!important;transition:none!important}}
      `}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderBottom: '1px solid #ffffff12', background: '#ffffff08' }}>
        <span style={{ color: accent }}>✻</span>
        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file}</span>
        <span style={{ color: addColor }}>+{adds}</span>
        <span style={{ color: removeColor }}>−{dels}</span>
      </div>
      {/* the height is fixed to the full diff, so folding lines away does not shrink the box */}
      <div className="cd" style={{ boxSizing: 'content-box', height: `${diff.length * lh}em`, padding: '8px 0', overflow: 'hidden' }}>
        {diff.map((l, i) => {
          const sign = l[0]
          if (sign !== '+') a++
          if (sign !== '-') b++
          const gone = (decision === 'accept' && sign === '-') || (decision === 'reject' && sign === '+')
          const tint = sign === '+' ? addColor : sign === '-' ? removeColor : null
          return (
            <div
              key={i}
              style={{
                display: 'grid',
                gridTemplateColumns: '2.6em 2.6em 1.4em 1fr',
                height: gone ? 0 : `${lh}em`,
                opacity: i < shown && !gone ? 1 : 0,
                background: tint && !decision ? `${tint}1c` : 'transparent',
                transition: 'height .35s ease, opacity .25s, background .4s',
                animation: i < shown ? 'cd-in .25s ease-out' : 'none',
                whiteSpace: 'pre',
                overflow: 'hidden',
              }}
            >
              <span style={{ textAlign: 'right', paddingRight: 8, color: '#ffffff40' }}>{sign === '+' ? '' : a}</span>
              <span style={{ textAlign: 'right', paddingRight: 8, color: '#ffffff40' }}>{sign === '-' ? '' : b}</span>
              <span style={{ color: tint ?? 'transparent', textAlign: 'center' }}>{decision ? '' : sign}</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', textDecoration: sign === '-' && !decision ? `line-through ${removeColor}88` : 'none' }}>{l.slice(1)}</span>
            </div>
          )
        })}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderTop: '1px solid #ffffff12', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif', fontSize: size }}>
        {decision ? (
          <span aria-live="polite" style={{ color: decision === 'accept' ? addColor : removeColor, fontWeight: 600 }}>
            {decision === 'accept' ? '✓ Change applied' : '✗ Change rejected'}
          </span>
        ) : (
          <span style={{ color: '#8f8c86' }}>Apply this change?</span>
        )}
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 8, opacity: decision ? 0.35 : 1, transition: 'opacity .2s' }}>
          <button type="button" disabled={!!decision || shown < diff.length} onClick={() => decide('reject')} style={{ all: 'unset', padding: '6px 12px', borderRadius: 8, border: '1px solid #ffffff26', cursor: 'pointer', fontWeight: 500 }}>
            Reject
          </button>
          <button type="button" disabled={!!decision || shown < diff.length} onClick={() => decide('accept')} style={{ all: 'unset', padding: '6px 12px', borderRadius: 8, background: accent, color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
            Accept
          </button>
        </span>
      </div>
    </div>
  )
}
