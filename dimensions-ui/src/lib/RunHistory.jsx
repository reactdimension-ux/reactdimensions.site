import { useMemo, useState } from 'react'

const RUNS = [
  { id: 'run-148', task: 'Fix the timer cleanup bug', status: 'done', secs: 94, cost: 0.31, ago: 4 },
  { id: 'run-147', task: 'Write release notes for 1.4', status: 'done', secs: 41, cost: 0.12, ago: 38 },
  { id: 'run-146', task: 'Migrate settings to the new API', status: 'error', secs: 212, cost: 0.88, ago: 95 },
  { id: 'run-145', task: 'Summarise the support inbox', status: 'running', secs: 18, cost: 0.04, ago: 1 },
  { id: 'run-144', task: 'Refactor the checkout form', status: 'done', secs: 305, cost: 1.42, ago: 190 },
  { id: 'run-143', task: 'Triage open issues', status: 'done', secs: 77, cost: 0.27, ago: 360 },
]

const COLS = [
  { key: 'task', label: 'Run', align: 'left' },
  { key: 'status', label: 'Status', align: 'left' },
  { key: 'secs', label: 'Time', align: 'right' },
  { key: 'cost', label: 'Cost', align: 'right' },
  { key: 'ago', label: 'When', align: 'right' },
]
const dur = (s) => (s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`)
const when = (m) => (m < 60 ? `${m}m ago` : `${Math.floor(m / 60)}h ago`)

// A table of past agent runs: task, status, duration, cost and age. Click a column header
// to sort by it, click again to flip the order. The status cell is a small dot and a
// word, coloured by status; a running run has a pulsing dot.
export default function RunHistory({
  runs = RUNS,
  width = 640,
  size = 14,
  background = '#141414',
  rowColor = '#1b1b1b',
  textColor = '#e8e6e1',
  mutedColor = '#8a8a8a',
  color = '#d77757',
  doneColor = '#4eba65',
  errorColor = '#e5534b',
  runningColor = '#5b9bd5',
}) {
  const [sort, setSort] = useState({ key: 'ago', dir: 1 })
  const sc = { done: doneColor, error: errorColor, running: runningColor }

  const rows = useMemo(() => {
    const { key, dir } = sort
    return runs.slice().sort((a, b) => (typeof a[key] === 'string' ? a[key].localeCompare(b[key]) : a[key] - b[key]) * dir)
  }, [runs, sort])

  const total = runs.reduce((n, r) => n + r.cost, 0)

  return (
    <div
      style={{ width: `min(${width}px, 100%)`, boxSizing: 'border-box', padding: '0.9em 1em', borderRadius: 10, background, color: textColor, overflowX: 'auto', font: `400 ${size}px/1.3 ui-monospace, "SF Mono", Menlo, Consolas, monospace` }}
    >
      <style>{`
        @keyframes rh-pulse{0%,100%{opacity:1}50%{opacity:.3}}
        .rh-row:hover td{background:#ffffff0a}
        @media (prefers-reduced-motion:reduce){.rh-dot{animation:none!important}}
      `}</style>
      <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, minWidth: 460 }}>
        <thead>
          <tr>
            {COLS.map((c) => {
              const on = sort.key === c.key
              return (
                <th key={c.key} scope="col" aria-sort={on ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'} style={{ textAlign: c.align, padding: '0 0.7em 0.6em', fontWeight: 400 }}>
                  <button
                    onClick={() => setSort((s) => ({ key: c.key, dir: s.key === c.key ? -s.dir : 1 }))}
                    style={{ all: 'unset', cursor: 'pointer', color: on ? color : mutedColor, fontSize: '0.85em', letterSpacing: '0.08em', textTransform: 'uppercase' }}
                  >
                    {c.label} <span aria-hidden>{on ? (sort.dir === 1 ? '▲' : '▼') : ''}</span>
                  </button>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="rh-row">
              <td style={{ padding: '0.65em 0.7em', borderTop: '1px solid #ffffff12', maxWidth: 220, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {r.task}
                <div style={{ color: mutedColor, fontSize: '0.8em' }}>{r.id}</div>
              </td>
              <td style={{ padding: '0.65em 0.7em', borderTop: '1px solid #ffffff12', color: sc[r.status], whiteSpace: 'nowrap' }}>
                <span aria-hidden className="rh-dot" style={{ display: 'inline-block', width: '0.55em', height: '0.55em', borderRadius: '50%', background: sc[r.status], marginRight: '0.5em', animation: r.status === 'running' ? 'rh-pulse 1.2s ease-in-out infinite' : 'none' }} />
                {r.status}
              </td>
              <td style={{ padding: '0.65em 0.7em', borderTop: '1px solid #ffffff12', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{dur(r.secs)}</td>
              <td style={{ padding: '0.65em 0.7em', borderTop: '1px solid #ffffff12', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>${r.cost.toFixed(2)}</td>
              <td style={{ padding: '0.65em 0.7em', borderTop: '1px solid #ffffff12', textAlign: 'right', color: mutedColor, whiteSpace: 'nowrap' }}>{when(r.ago)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: '0.4em', padding: '0.6em 0.7em 0', borderTop: '1px solid #ffffff12', display: 'flex', justifyContent: 'space-between', color: mutedColor, fontSize: '0.9em' }}>
        <span>{runs.length} runs</span>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>Total ${total.toFixed(2)}</span>
      </div>
    </div>
  )
}
