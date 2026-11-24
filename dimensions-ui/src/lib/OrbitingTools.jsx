import { useEffect, useState } from 'react'

const TOOLS = [
  { name: 'Search', icon: '⌕' },
  { name: 'Read', icon: '☰' },
  { name: 'Edit', icon: '✎' },
  { name: 'Run', icon: '▶' },
  { name: 'Browse', icon: '◎' },
  { name: 'Memory', icon: '❖' },
]

// Tool icons orbiting a central agent. A wrapper rotates, and every icon counter-rotates
// by the same amount so it stays upright. One tool at a time is "active": it glows and
// its name shows in the middle, then the glow moves to the next.
export default function OrbitingTools({
  tools = TOOLS,
  radius = 110,
  period = 24, // seconds per orbit
  speed = 1,
  size = 56,
  background = '#0f0f0f',
  coreColor = '#d77757',
  toolColor = '#1d1d1d',
  textColor = '#e8e6e1',
  glowColor = '#d77757',
}) {
  const [active, setActive] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setActive((a) => (a + 1) % tools.length), 1600 / speed)
    return () => clearInterval(t)
  }, [tools.length, speed])

  const dur = `${period / speed}s`
  const box = radius * 2 + size + 40

  return (
    <div
      role="img"
      aria-label={`Agent using tools, now ${tools[active]?.name}`}
      style={{ position: 'relative', width: box, height: box, maxWidth: '100%', borderRadius: 14, background, overflow: 'hidden' }}
    >
      <style>{`
        @keyframes ot-spin{to{transform:rotate(360deg)}}
        @keyframes ot-unspin{to{transform:rotate(-360deg)}}
        @keyframes ot-core{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}
        @media (prefers-reduced-motion:reduce){.ot *{animation:none!important}}
      `}</style>
      <div className="ot" style={{ position: 'absolute', inset: 0 }}>
        <div aria-hidden style={{ position: 'absolute', left: '50%', top: '50%', width: radius * 2, height: radius * 2, marginLeft: -radius, marginTop: -radius, borderRadius: '50%', border: `1px dashed ${textColor}22` }} />
        {/* the rotating ring */}
        <div style={{ position: 'absolute', left: '50%', top: '50%', width: 0, height: 0, animation: `ot-spin ${dur} linear infinite` }}>
          {tools.map((t, i) => {
            const a = (360 / tools.length) * i
            const on = i === active
            return (
              <div key={t.name} style={{ position: 'absolute', left: 0, top: 0, transform: `rotate(${a}deg) translateX(${radius}px) rotate(${-a}deg)` }}>
                <div style={{ width: size, height: size, marginLeft: -size / 2, marginTop: -size / 2, animation: `ot-unspin ${dur} linear infinite` }}>
                  <div
                    title={t.name}
                    style={{ width: '100%', height: '100%', borderRadius: '28%', display: 'grid', placeItems: 'center', background: toolColor, color: on ? glowColor : textColor, fontSize: size * 0.44, border: `1.5px solid ${on ? glowColor : '#ffffff1a'}`, boxShadow: on ? `0 0 ${size * 0.5}px ${glowColor}88` : 'none', transform: on ? 'scale(1.14)' : 'scale(1)', transition: 'all .35s ease' }}
                  >
                    {t.icon}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        {/* the agent in the middle */}
        <div style={{ position: 'absolute', left: '50%', top: '50%', width: size * 1.5, height: size * 1.5, marginLeft: -size * 0.75, marginTop: -size * 0.75, borderRadius: '50%', display: 'grid', placeItems: 'center', textAlign: 'center', background: `radial-gradient(circle at 35% 30%, ${coreColor}, ${coreColor}aa)`, color: '#1a1614', font: `700 ${Math.max(10, size * 0.22)}px/1.1 ui-monospace, Menlo, monospace`, boxShadow: `0 0 ${size * 0.6}px ${coreColor}55`, animation: 'ot-core 2.4s ease-in-out infinite' }}>
          {tools[active]?.name}
        </div>
      </div>
    </div>
  )
}
