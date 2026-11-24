import { useEffect, useState } from 'react'

const FILES = [
  { name: 'report.pdf', size: '2.4 MB' },
  { name: 'screenshot.png', size: '840 KB' },
  { name: 'data.csv', size: '120 KB' },
]

// Files attached to a prompt. Each chip shows a progress ring while it uploads (an SVG
// circle drawn with stroke-dashoffset), then a tick, and has a remove button. In the demo
// the uploads run one after another and restart when you have removed them all.
export default function AttachmentChips({
  files = FILES,
  speed = 1,
  size = 14,
  background = '#141414',
  chipColor = '#222222',
  textColor = '#e8e6e1',
  mutedColor = '#8a8a8a',
  color = '#d77757',
  doneColor = '#4eba65',
}) {
  const [items, setItems] = useState(() => files.map((f, i) => ({ ...f, id: i, p: 0 })))
  const [run, setRun] = useState(0)

  // reset when the file list changes or the demo restarts
  useEffect(() => {
    setItems(files.map((f, i) => ({ ...f, id: i, p: 0 })))
  }, [files, run])

  // upload: the first unfinished chip gains progress
  useEffect(() => {
    const t = setInterval(() => {
      setItems((list) => {
        const i = list.findIndex((f) => f.p < 1)
        if (i < 0) return list
        return list.map((f, j) => (j === i ? { ...f, p: Math.min(1, f.p + 0.07 * speed + Math.random() * 0.03) } : f))
      })
    }, 100)
    return () => clearInterval(t)
  }, [speed, run])

  // restart a while after everything finished or was removed
  useEffect(() => {
    if (items.length && items.some((f) => f.p < 1)) return
    const t = setTimeout(() => setRun((n) => n + 1), items.length ? 3200 / speed : 1200)
    return () => clearTimeout(t)
  }, [items, speed])

  const R = 8
  const C = 2 * Math.PI * R

  return (
    <div
      role="list"
      aria-label="Attachments"
      style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6em', minHeight: '3.4em', alignContent: 'flex-start', boxSizing: 'border-box', padding: '0.9em', maxWidth: 520, borderRadius: 10, background, color: textColor, font: `400 ${size}px/1.2 ui-monospace, "SF Mono", Menlo, Consolas, monospace` }}
    >
      <style>{`
        @keyframes ac-in{from{opacity:0;transform:scale(.92)}to{opacity:1;transform:none}}
        @media (prefers-reduced-motion:reduce){.ac-chip{animation:none!important}}
      `}</style>
      {items.map((f) => {
        const done = f.p >= 1
        return (
          <div key={f.id} role="listitem" className="ac-chip" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.6em', padding: '0.5em 0.5em 0.5em 0.7em', borderRadius: 8, background: chipColor, animation: 'ac-in .25s ease-out' }}>
            <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden style={{ flex: 'none' }}>
              <circle cx="10" cy="10" r={R} fill="none" stroke={mutedColor + '44'} strokeWidth="2" />
              <circle cx="10" cy="10" r={R} fill="none" stroke={done ? doneColor : color} strokeWidth="2" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - f.p)} transform="rotate(-90 10 10)" style={{ transition: 'stroke-dashoffset .1s linear, stroke .3s' }} />
              {done && <path d="M6.5 10.3l2.3 2.3 4.7-4.9" fill="none" stroke={doneColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />}
            </svg>
            <span>
              {f.name}
              <span style={{ color: mutedColor }}> · {done ? f.size : `${Math.round(f.p * 100)}%`}</span>
            </span>
            <button
              onClick={() => setItems((l) => l.filter((x) => x.id !== f.id))}
              aria-label={`Remove ${f.name}`}
              style={{ all: 'unset', cursor: 'pointer', width: '1.5em', height: '1.5em', display: 'grid', placeItems: 'center', borderRadius: 5, color: mutedColor, fontSize: '1.1em', lineHeight: 1 }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#ffffff1a')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              ×
            </button>
          </div>
        )
      })}
    </div>
  )
}
