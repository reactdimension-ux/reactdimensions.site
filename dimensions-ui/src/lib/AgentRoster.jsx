import { useEffect, useState } from 'react'

const AGENTS = [
  { name: 'Scout', role: 'Research', status: 'working' },
  { name: 'Forge', role: 'Code', status: 'thinking' },
  { name: 'Probe', role: 'Testing', status: 'idle' },
  { name: 'Quill', role: 'Docs', status: 'working' },
  { name: 'Warden', role: 'Review', status: 'done' },
  { name: 'Relay', role: 'Deploy', status: 'error' },
]
const seed = (n) => {
  let s = n * 9301 + 49297
  return () => ((s = (s * 9301 + 49297) % 233280) / 233280)
}

// A grid of agent cards: a name, a role, a status dot and a tiny sparkline of recent
// activity, drawn as one SVG polyline. Active agents (working or thinking) keep adding
// points, so their line slowly scrolls; idle, done and failed ones stay still.
export default function AgentRoster({
  agents = AGENTS,
  columns = 3,
  speed = 1,
  width = 640,
  size = 14,
  background = '#141414',
  cardColor = '#1d1d1d',
  textColor = '#e8e6e1',
  mutedColor = '#8a8a8a',
  color = '#d77757',
  doneColor = '#4eba65',
  errorColor = '#e5534b',
  workingColor = '#5b9bd5',
}) {
  const POINTS = 20
  const [series, setSeries] = useState(() => agents.map((_, i) => { const r = seed(i + 3); return Array.from({ length: POINTS }, () => 0.15 + r() * 0.7) }))

  useEffect(() => {
    const t = setInterval(() => {
      setSeries((all) => all.map((s, i) => {
        const st = agents[i]?.status
        if (st !== 'working' && st !== 'thinking') return s
        return [...s.slice(1), Math.max(0.08, Math.min(0.95, s[s.length - 1] + (Math.random() - 0.5) * 0.5))]
      }))
    }, 900 / speed)
    return () => clearInterval(t)
  }, [agents, speed])

  const sc = { idle: mutedColor, thinking: color, working: workingColor, done: doneColor, error: errorColor }

  return (
    <div
      role="list"
      style={{ width: `min(${width}px, 100%)`, boxSizing: 'border-box', display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, Math.round(columns))}, minmax(0, 1fr))`, gap: '0.7em', padding: '0.9em', borderRadius: 10, background, color: textColor, font: `400 ${size}px/1.3 ui-monospace, "SF Mono", Menlo, Consolas, monospace` }}
    >
      <style>{`
        @keyframes ar-pulse{0%{box-shadow:0 0 0 0 var(--ar-c)}100%{box-shadow:0 0 0 .5em transparent}}
        @media (prefers-reduced-motion:reduce){.ar-dot{animation:none!important}}
      `}</style>
      {agents.map((a, i) => {
        const c = sc[a.status] || mutedColor
        const active = a.status === 'working' || a.status === 'thinking'
        const pts = (series[i] || []).map((y, k, arr) => `${(k / (arr.length - 1)) * 100},${30 - y * 28}`).join(' ')
        return (
          <div key={a.name} role="listitem" style={{ padding: '0.8em 0.9em', borderRadius: 9, background: cardColor, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5em' }}>
              <span aria-hidden className="ar-dot" style={{ '--ar-c': c + '88', width: '0.55em', height: '0.55em', borderRadius: '50%', background: c, flex: 'none', animation: active ? 'ar-pulse 1.4s ease-out infinite' : 'none' }} />
              <b style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</b>
            </div>
            <div style={{ color: mutedColor, fontSize: '0.85em', margin: '0.15em 0 0.5em' }}>
              {a.role} · <span style={{ color: c }}>{a.status}</span>
            </div>
            <svg viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden style={{ width: '100%', height: '1.9em', display: 'block', overflow: 'visible' }}>
              <polyline points={pts} fill="none" stroke={c} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" opacity={active ? 1 : 0.5} />
            </svg>
          </div>
        )
      })}
    </div>
  )
}
