import { useEffect, useRef, useState } from 'react'

const STEPS = ['Read the failing test', 'Find the cause in Timer.jsx', 'Fix the interval cleanup', 'Run the test suite']

// An editable agent plan. Drag a step by its handle to reorder it (or focus the handle
// and use the arrow keys), edit a step's text in place, remove it with ×, add new steps
// at the bottom, and press Run to watch the agent work down the list. Rows have a fixed
// height, so the drag maths is just "pointer offset divided by row height".
export default function PlanEditor({
  steps = STEPS,
  width = 440,
  size = 14,
  background = '#141414',
  rowColor = '#1d1d1d',
  textColor = '#e8e6e1',
  mutedColor = '#8a8a8a',
  color = '#d77757',
  doneColor = '#4eba65',
}) {
  const nextId = useRef(steps.length)
  const [items, setItems] = useState(() => steps.map((t, id) => ({ id, t })))
  const [drag, setDrag] = useState(null) // { id, dy }
  const [running, setRunning] = useState(-1) // index being run; items.length = finished
  const [draft, setDraft] = useState('')
  const start = useRef(null)
  const ROW = Math.round(size * 3.1)
  const GAP = 8

  useEffect(() => setItems(steps.map((t, id) => ({ id, t }))), [steps])

  // running: step down the list
  useEffect(() => {
    if (running < 0) return
    const t = setTimeout(() => setRunning((r) => (r >= items.length ? -1 : r + 1)), running >= items.length ? 1800 : 900)
    return () => clearTimeout(t)
  }, [running, items.length])

  const move = (from, to) =>
    setItems((l) => {
      if (to < 0 || to >= l.length || from === to) return l
      const c = l.slice()
      c.splice(to, 0, c.splice(from, 1)[0])
      return c
    })

  const down = (e, id, i) => {
    if (running >= 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    start.current = { y: e.clientY, i }
    setDrag({ id, dy: 0 })
  }
  const moveP = (e, id) => {
    if (!start.current) return
    const dy = e.clientY - start.current.y
    const cur = items.findIndex((x) => x.id === id)
    // the row has crossed its neighbour's midpoint: swap places and re-anchor
    const shift = Math.round(dy / (ROW + GAP))
    if (shift !== 0) {
      const to = Math.max(0, Math.min(items.length - 1, cur + shift))
      if (to !== cur) {
        move(cur, to)
        start.current.y += (to - cur) * (ROW + GAP)
      }
    }
    setDrag({ id, dy: e.clientY - start.current.y })
  }
  const up = () => {
    start.current = null
    setDrag(null)
  }

  const add = () => {
    const t = draft.trim()
    if (!t) return
    setItems((l) => [...l, { id: nextId.current++, t }])
    setDraft('')
  }
  const running_ = running >= 0

  const ghost = { all: 'unset', cursor: 'pointer', color: mutedColor, width: '1.8em', height: '1.8em', display: 'grid', placeItems: 'center', borderRadius: 6 }

  return (
    <div
      style={{ width: `min(${width}px, 100%)`, boxSizing: 'border-box', padding: '1em', borderRadius: 10, background, color: textColor, font: `400 ${size}px/1.2 ui-monospace, "SF Mono", Menlo, Consolas, monospace` }}
    >
      <style>{`
        .pe-row{transition:transform .18s ease, box-shadow .18s}
        .pe-ghost:hover{background:#ffffff14}
        @keyframes pe-blink{0%,100%{opacity:1}50%{opacity:.3}}
        @media (prefers-reduced-motion:reduce){.pe-row{transition:none}.pe-run{animation:none!important}}
      `}</style>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.8em' }}>
        <span style={{ flex: 1, color: mutedColor }}>Plan · {items.length} step{items.length === 1 ? '' : 's'}</span>
        <button
          onClick={() => setRunning(running_ ? -1 : 0)}
          disabled={!items.length}
          style={{ cursor: 'pointer', font: 'inherit', fontWeight: 600, padding: '0.4em 1em', borderRadius: 6, border: `1px solid ${color}`, background: running_ ? 'transparent' : color, color: running_ ? color : '#0b0b0b' }}
        >
          {running_ ? 'Stop' : '▶ Run'}
        </button>
      </div>
      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: GAP }}>
        {items.map((it, i) => {
          const dragging = drag?.id === it.id
          const state = !running_ ? 'idle' : i < running ? 'done' : i === running ? 'running' : 'todo'
          return (
            <li
              key={it.id}
              className="pe-row"
              style={{ height: ROW, boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: '0.4em', padding: '0 0.4em 0 0.2em', borderRadius: 8, background: rowColor, border: `1px solid ${state === 'running' ? color : 'transparent'}`, position: 'relative', zIndex: dragging ? 2 : 0, transform: dragging ? `translateY(${drag.dy}px)` : 'none', transition: dragging ? 'none' : undefined, boxShadow: dragging ? '0 10px 24px #0008' : 'none' }}
            >
              <span
                role="button"
                tabIndex={running_ ? -1 : 0}
                aria-label={`Move step ${i + 1}: ${it.t}. Use the up and down arrow keys.`}
                onPointerDown={(e) => down(e, it.id, i)}
                onPointerMove={(e) => moveP(e, it.id)}
                onPointerUp={up}
                onPointerCancel={up}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowUp') (e.preventDefault(), move(i, i - 1))
                  if (e.key === 'ArrowDown') (e.preventDefault(), move(i, i + 1))
                }}
                style={{ ...ghost, cursor: running_ ? 'default' : dragging ? 'grabbing' : 'grab', touchAction: 'none', opacity: running_ ? 0.3 : 1 }}
              >
                ⠿
              </span>
              <span aria-hidden style={{ width: '1.2em', textAlign: 'center', color: state === 'done' ? doneColor : state === 'running' ? color : mutedColor }} className={state === 'running' ? 'pe-run' : undefined}>
                {state === 'done' ? '✔' : state === 'running' ? '⏺' : i + 1}
              </span>
              <input
                value={it.t}
                disabled={running_}
                aria-label={`Step ${i + 1}`}
                onChange={(e) => setItems((l) => l.map((x) => (x.id === it.id ? { ...x, t: e.target.value } : x)))}
                style={{ flex: 1, minWidth: 0, font: 'inherit', color: state === 'done' ? mutedColor : textColor, background: 'transparent', border: 'none', outline: 'none', textOverflow: 'ellipsis' }}
              />
              <button className="pe-ghost" aria-label={`Remove step ${i + 1}`} disabled={running_} onClick={() => setItems((l) => l.filter((x) => x.id !== it.id))} style={{ ...ghost, opacity: running_ ? 0.3 : 1 }}>
                ×
              </button>
            </li>
          )
        })}
      </ol>
      <div style={{ display: 'flex', gap: '0.5em', marginTop: '0.8em' }}>
        <input
          value={draft}
          disabled={running_}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="Add a step…"
          aria-label="New step"
          style={{ flex: 1, minWidth: 0, font: 'inherit', color: textColor, padding: '0.55em 0.8em', borderRadius: 8, border: `1px solid ${mutedColor}44`, background: '#0e0e0e', outline: 'none' }}
        />
        <button onClick={add} disabled={running_} style={{ cursor: 'pointer', font: 'inherit', fontWeight: 600, color: textColor, padding: '0 1em', borderRadius: 8, border: `1px solid ${mutedColor}66`, background: 'transparent' }}>
          Add
        </button>
      </div>
    </div>
  )
}
