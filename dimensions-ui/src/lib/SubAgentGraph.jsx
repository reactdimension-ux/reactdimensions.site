import { useEffect, useState } from 'react'

const NODES = {
  lead: { x: 70, y: 150, label: 'Lead' },
  a: { x: 270, y: 50, label: 'Research' },
  b: { x: 270, y: 150, label: 'Code' },
  c: { x: 270, y: 250, label: 'Test' },
  review: { x: 470, y: 150, label: 'Review' },
}
const EDGES = [
  ['lead', 'a'], ['lead', 'b'], ['lead', 'c'],
  ['a', 'review'], ['b', 'review'], ['c', 'review'],
]
// each step: which node holds the work, and which edges carry a pulse
const STEPS = [
  { hold: ['lead'], edges: [] },
  { hold: ['lead'], edges: [0, 1, 2] },
  { hold: ['a', 'b', 'c'], edges: [] },
  { hold: ['a', 'b', 'c'], edges: [3, 4, 5] },
  { hold: ['review'], edges: [] },
]
const path = ([f, t]) => {
  const a = NODES[f]
  const b = NODES[t]
  const mx = (a.x + b.x) / 2
  return `M${a.x},${a.y} C${mx},${a.y} ${mx},${b.y} ${b.x},${b.y}`
}

// Several agents as nodes in an SVG. The node that holds the work glows, and a dot
// travels along an edge when work is handed on. The lead fans work out to three
// workers, they hand their results to a reviewer, and it starts again.
export default function SubAgentGraph({
  speed = 1,
  width = 560,
  background = '#0f0f0f',
  nodeColor = '#1b1b1b',
  lineColor = '#3a3a3a',
  textColor = '#e8e6e1',
  color = '#d77757',
}) {
  const [step, setStep] = useState(0)

  useEffect(() => {
    const t = setTimeout(() => setStep((s) => (s + 1) % STEPS.length), (step === STEPS.length - 1 ? 2200 : 1400) / speed)
    return () => clearTimeout(t)
  }, [step, speed])

  const S = STEPS[step]

  return (
    <svg
      viewBox="0 0 540 300"
      role="img"
      aria-label="Agents passing work between each other"
      style={{ width: `min(${width}px, 100%)`, height: 'auto', borderRadius: 10, background, display: 'block' }}
    >
      <style>{`@media (prefers-reduced-motion:reduce){.sg-dot{display:none}}`}</style>
      {EDGES.map((e, i) => (
        <path key={i} d={path(e)} fill="none" stroke={S.edges.includes(i) ? color : lineColor} strokeWidth="2" style={{ transition: 'stroke .3s' }} />
      ))}
      {/* the pulses: remounted every step so the motion restarts */}
      {S.edges.map((i) => (
        <circle key={`${step}-${i}`} className="sg-dot" r="5" fill={color} style={{ filter: `drop-shadow(0 0 5px ${color})` }}>
          <animateMotion dur={`${1.1 / speed}s`} fill="freeze" path={path(EDGES[i])} />
        </circle>
      ))}
      {Object.entries(NODES).map(([id, n]) => {
        const on = S.hold.includes(id)
        return (
          <g key={id} transform={`translate(${n.x} ${n.y})`}>
            <circle r="30" fill={nodeColor} stroke={on ? color : lineColor} strokeWidth={on ? 2.5 : 1.5} style={{ transition: 'stroke .3s', filter: on ? `drop-shadow(0 0 10px ${color}aa)` : 'none' }} />
            <text textAnchor="middle" dy="4" fontSize="12" fontFamily='ui-monospace, "SF Mono", Menlo, Consolas, monospace' fill={on ? textColor : '#8a8a8a'} style={{ transition: 'fill .3s' }}>
              {n.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
