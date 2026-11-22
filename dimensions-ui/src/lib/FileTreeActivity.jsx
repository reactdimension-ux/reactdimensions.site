import { useEffect, useState } from 'react'

// a flat list of paths; folders are worked out from them
const FILES = ['package.json', 'src/App.jsx', 'src/Timer.jsx', 'src/hooks/useTick.js', 'src/styles.css', 'tests/Timer.test.jsx', 'README.md']
// what the agent does, in order: read, edit, or create a file
const EVENTS = [
  { type: 'read', path: 'package.json' },
  { type: 'read', path: 'src/App.jsx' },
  { type: 'read', path: 'src/Timer.jsx' },
  { type: 'edit', path: 'src/Timer.jsx' },
  { type: 'create', path: 'src/hooks/useTick.js' },
  { type: 'read', path: 'tests/Timer.test.jsx' },
  { type: 'edit', path: 'tests/Timer.test.jsx' },
]

function tree(files) {
  const rows = []
  const seen = new Set()
  // folders before files at every level, then by name
  const order = (x, y) => {
    const a = x.split('/')
    const b = y.split('/')
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      if (a[i] === b[i]) continue
      const fa = i < a.length - 1
      const fb = i < b.length - 1
      return fa === fb ? a[i].localeCompare(b[i]) : fa ? -1 : 1
    }
    return a.length - b.length
  }
  for (const f of [...files].sort(order)) {
    const parts = f.split('/')
    parts.forEach((name, d) => {
      const path = parts.slice(0, d + 1).join('/')
      if (seen.has(path)) return
      seen.add(path)
      rows.push({ path, name, depth: d, folder: d < parts.length - 1 })
    })
  }
  return rows
}

// A project's files as an agent works through them: the file being read glows,
// edited files get an M, new ones an A, and a status line says what is happening.
export default function FileTreeActivity({
  files = FILES,
  events = EVENTS,
  speed = 1,
  loop = true,
  size = 13,
  width = 360,
  background = '#141414',
  textColor = '#d9d6cf',
  mutedColor = '#7c7a75',
  readColor = '#6aa9ff',
  editColor = '#d9a43a',
  createColor = '#4eba65',
}) {
  const [step, setStep] = useState(0) // how many events have happened
  const all = [...new Set([...files, ...events.map((e) => e.path)])]
  const rows = tree(all)

  useEffect(() => {
    const done = step >= events.length
    if (done && !loop) return
    const t = setTimeout(() => setStep((s) => (done ? 0 : s + 1)), (done ? 2800 : 1100) / speed)
    return () => clearTimeout(t)
  }, [step, events.length, loop, speed])

  const past = events.slice(0, step)
  const now = past[past.length - 1]
  const mark = (p) => {
    const hits = past.filter((e) => e.path === p)
    if (hits.some((e) => e.type === 'create')) return 'A'
    if (hits.some((e) => e.type === 'edit')) return 'M'
    return null
  }
  const created = new Set(events.filter((e) => e.type === 'create').map((e) => e.path))
  const verb = { read: 'Reading', edit: 'Editing', create: 'Creating' }
  const tone = { read: readColor, edit: editColor, create: createColor }

  return (
    <div style={{ width: `min(${width}px, 100%)`, borderRadius: 12, background, color: textColor, border: '1px solid #ffffff12', overflow: 'hidden', font: `400 ${size}px/1.5 ui-monospace, "SF Mono", Menlo, Consolas, monospace` }}>
      <style>{`
        @keyframes ft-glow{0%,100%{opacity:.55}50%{opacity:1}}
        @keyframes ft-in{from{opacity:0;transform:translateX(-6px)}to{opacity:1;transform:none}}
        @media (prefers-reduced-motion:reduce){.ft *{animation:none!important;transition:none!important}}
      `}</style>
      <div style={{ padding: '9px 12px', borderBottom: '1px solid #ffffff12', color: mutedColor, fontSize: '0.85em', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Explorer</div>
      {/* sized for every row, so files that appear later fold in without growing the box */}
      <ul className="ft" style={{ listStyle: 'none', margin: 0, padding: '6px 0', boxSizing: 'content-box', minHeight: `calc(${rows.length} * (1.5em + 4px))` }}>
        {rows.map((r) => {
          const active = now && !r.folder && now.path === r.path
          const exists = !created.has(r.path) || past.some((e) => e.path === r.path && e.type === 'create')
          // a folder that only holds files yet to be created stays hidden too
          const folderEmpty = r.folder && !all.some((f) => f.startsWith(r.path + '/') && (!created.has(f) || past.some((e) => e.path === f)))
          const hidden = (!r.folder && !exists) || folderEmpty
          const m = !r.folder && mark(r.path)
          return (
            <li
              key={r.path}
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                padding: `0 12px 0 ${12 + r.depth * 16}px`,
                boxSizing: 'border-box',
                height: hidden ? 0 : 'calc(1.5em + 4px)',
                overflow: 'hidden',
                opacity: hidden ? 0 : 1,
                transition: 'height .3s ease, opacity .3s',
                color: r.folder ? mutedColor : m === 'A' ? createColor : m === 'M' ? editColor : textColor,
                animation: !hidden && created.has(r.path) ? 'ft-in .3s ease-out' : 'none',
              }}
            >
              {active && <span aria-hidden style={{ position: 'absolute', inset: 0, background: `${tone[now.type]}22`, borderLeft: `2px solid ${tone[now.type]}`, animation: 'ft-glow 1.1s ease-in-out infinite' }} />}
              <span aria-hidden style={{ position: 'relative', width: '1em', textAlign: 'center', opacity: 0.8 }}>{r.folder ? '▾' : '·'}</span>
              <span style={{ position: 'relative', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.name}
                {r.folder && '/'}
              </span>
              {m && <span style={{ position: 'relative', fontSize: '0.85em', fontWeight: 700 }}>{m}</span>}
            </li>
          )
        })}
      </ul>
      <div aria-live="polite" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderTop: '1px solid #ffffff12', fontSize: '0.88em', color: mutedColor, whiteSpace: 'nowrap', overflow: 'hidden' }}>
        <span aria-hidden style={{ width: 7, height: 7, flex: 'none', borderRadius: '50%', background: now ? tone[now.type] : mutedColor, animation: step < events.length ? 'ft-glow 1s ease-in-out infinite' : 'none' }} />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{step >= events.length ? `Done · ${new Set(past.filter((e) => e.type !== 'read').map((e) => e.path)).size} files changed` : now ? `${verb[now.type]} ${now.path}` : 'Starting…'}</span>
      </div>
    </div>
  )
}
