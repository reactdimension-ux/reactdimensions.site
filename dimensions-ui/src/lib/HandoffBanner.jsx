import { useEffect, useState } from 'react'

// "Passing you to a human." Two avatars with a line between them. While the handoff is
// connecting, dots travel along the line from the agent to the person; once it connects
// the line fills in, the person lights up and the banner says who joined. It loops.
export default function HandoffBanner({
  title = 'Passing you to a human',
  agent = 'AI',
  person = 'Sam',
  joinedText = 'Sam from support joined the chat',
  speed = 1,
  width = 480,
  size = 15,
  background = '#141414',
  textColor = '#e8e6e1',
  mutedColor = '#8a8a8a',
  color = '#d77757',
  okColor = '#4eba65',
}) {
  const [done, setDone] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setDone((d) => !d), (done ? 3200 : 3600) / speed)
    return () => clearTimeout(t)
  }, [done, speed])

  const dot = (d) => ({ position: 'absolute', top: '50%', left: 0, width: 7, height: 7, marginTop: -3.5, borderRadius: '50%', background: color, opacity: 0, animation: `hb-run ${1.6 / speed}s ${d / speed}s linear infinite` })
  const avatar = (bg, ring) => ({ width: '3.2em', height: '3.2em', borderRadius: '50%', display: 'grid', placeItems: 'center', background: bg, color: '#1a1614', font: '700 0.95em ui-monospace, Menlo, monospace', boxShadow: ring ? `0 0 0 4px ${ring}44` : 'none', transition: 'all .4s' })

  return (
    <div
      role="status"
      aria-live="polite"
      style={{ width: `min(${width}px, 100%)`, boxSizing: 'border-box', padding: '1.1em 1.3em', borderRadius: 10, background, color: textColor, font: `400 ${size}px/1.3 ui-monospace, "SF Mono", Menlo, Consolas, monospace` }}
    >
      <style>{`
        @keyframes hb-run{0%{left:0;opacity:0}15%{opacity:1}85%{opacity:1}100%{left:calc(100% - 7px);opacity:0}}
        @media (prefers-reduced-motion:reduce){.hb *{animation:none!important}}
      `}</style>
      <div className="hb" style={{ display: 'flex', alignItems: 'center', gap: '0.9em' }}>
        <div style={avatar(color)}>{agent}</div>
        <div style={{ flex: 1, position: 'relative', height: 7 }}>
          <div style={{ position: 'absolute', left: 0, right: 0, top: 3, height: 2, borderRadius: 1, background: mutedColor + '44' }} />
          <div style={{ position: 'absolute', left: 0, top: 3, height: 2, borderRadius: 1, background: okColor, width: done ? '100%' : '0%', transition: 'width .6s ease' }} />
          {!done && [0, 0.5, 1].map((d) => <i key={d} style={dot(d)} />)}
        </div>
        <div style={avatar(done ? okColor : mutedColor + '88', done ? okColor : null)}>{person.slice(0, 2)}</div>
      </div>
      <div style={{ marginTop: '1em', textAlign: 'center', minHeight: '1.4em', color: done ? okColor : textColor, fontWeight: 600, transition: 'color .3s' }}>
        {done ? `✔ ${joinedText}` : `${title}…`}
      </div>
    </div>
  )
}
