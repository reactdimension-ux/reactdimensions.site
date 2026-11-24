import { useMemo, useState } from 'react'

const CHATS = [
  { title: 'Fix the timer cleanup bug', group: 'Today' },
  { title: 'Write release notes for 1.4', group: 'Today' },
  { title: 'Plan the onboarding flow', group: 'Yesterday' },
  { title: 'Explain React Server Components', group: 'Yesterday' },
  { title: 'Refactor the settings page', group: 'Earlier' },
  { title: 'Draft a reply to the design team', group: 'Earlier' },
  { title: 'Compare Postgres and SQLite', group: 'Earlier' },
]
const ORDER = ['Today', 'Yesterday', 'Earlier']

// A sidebar of past chats: a new-chat button, a search box that filters in memory, and
// the list grouped under Today, Yesterday and Earlier. The active chat is highlighted.
export default function ConversationList({
  chats = CHATS,
  width = 300,
  height = 400,
  size = 14,
  background = '#141414',
  textColor = '#e8e6e1',
  mutedColor = '#8a8a8a',
  color = '#d77757',
}) {
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)

  const groups = useMemo(() => {
    const k = q.trim().toLowerCase()
    return ORDER.map((g) => ({ g, items: chats.map((c, i) => ({ ...c, i })).filter((c) => c.group === g && c.title.toLowerCase().includes(k)) })).filter((x) => x.items.length)
  }, [chats, q])

  return (
    <nav
      aria-label="Conversations"
      style={{ width: `min(${width}px, 100%)`, height, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '0.7em', padding: '0.8em', borderRadius: 10, background, color: textColor, font: `400 ${size}px/1.3 ui-monospace, "SF Mono", Menlo, Consolas, monospace` }}
    >
      <button
        onClick={() => setActive(-1)}
        style={{ cursor: 'pointer', font: 'inherit', fontWeight: 600, color: textColor, padding: '0.6em 0.8em', borderRadius: 8, border: `1px solid ${color}88`, background: 'transparent', textAlign: 'left' }}
      >
        <span style={{ color }}>＋</span> New chat
      </button>
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search chats…"
        aria-label="Search chats"
        style={{ font: 'inherit', color: textColor, padding: '0.6em 0.8em', borderRadius: 8, border: `1px solid ${mutedColor}44`, background: '#0e0e0e', outline: 'none' }}
        onFocus={(e) => (e.currentTarget.style.borderColor = color)}
        onBlur={(e) => (e.currentTarget.style.borderColor = mutedColor + '44')}
      />
      <div style={{ flex: 1, overflowY: 'auto', display: 'grid', alignContent: 'start', gap: '0.9em' }}>
        {groups.length === 0 && <div style={{ color: mutedColor, padding: '0.4em 0.8em' }}>No chats match.</div>}
        {groups.map(({ g, items }) => (
          <div key={g}>
            <div style={{ color: mutedColor, fontSize: '0.8em', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '0 0.8em 0.4em' }}>{g}</div>
            {items.map((c) => (
              <button
                key={c.i}
                onClick={() => setActive(c.i)}
                aria-current={active === c.i ? 'true' : undefined}
                style={{ all: 'unset', boxSizing: 'border-box', display: 'block', width: '100%', cursor: 'pointer', padding: '0.55em 0.8em', borderRadius: 7, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', background: active === c.i ? color + '22' : 'transparent', color: active === c.i ? color : textColor, transition: 'background .15s' }}
                onMouseEnter={(e) => active !== c.i && (e.currentTarget.style.background = '#ffffff0d')}
                onMouseLeave={(e) => active !== c.i && (e.currentTarget.style.background = 'transparent')}
              >
                {c.title}
              </button>
            ))}
          </div>
        ))}
      </div>
    </nav>
  )
}
