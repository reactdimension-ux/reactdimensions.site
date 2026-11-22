import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CATEGORIES, COMPONENTS } from './library/registry.jsx'
import { Icon } from './Nav.jsx'

// Command-palette search across every component. Open it with / or Ctrl/Cmd+K.
export default function SearchDialog({ open, onClose }) {
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const input = useRef(null)
  const list = useRef(null)
  const navigate = useNavigate()

  const results = useMemo(() => {
    const t = q.trim().toLowerCase()
    // name matches first, then matches in the category or description
    const score = (c) => (c.name.toLowerCase().startsWith(t) ? 0 : c.name.toLowerCase().includes(t) ? 1 : 2)
    return COMPONENTS.filter((c) => !t || `${c.name} ${c.category} ${c.description}`.toLowerCase().includes(t)).sort((x, y) => (t ? score(x) - score(y) : 0))
  }, [q])

  useEffect(() => {
    if (open) {
      setQ('')
      setSel(0)
      setTimeout(() => input.current?.focus(), 0)
    }
  }, [open])
  useEffect(() => setSel(0), [q])
  useEffect(() => {
    list.current?.querySelector('.sel')?.scrollIntoView({ block: 'nearest' })
  }, [sel])

  if (!open) return null

  const go = (c) => {
    navigate(`/library/${c.slug}`)
    onClose()
  }
  const onKey = (e) => {
    if (e.key === 'Escape') onClose()
    else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSel((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSel((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && results[sel]) go(results[sel])
  }

  let n = -1
  return (
    <div className="sd-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sd" role="dialog" aria-label="Search components" onKeyDown={onKey}>
        <div className="sd-top">
          {Icon.search}
          <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${COMPONENTS.length} components…`} aria-label="Search" />
          <kbd className="kbd">esc</kbd>
        </div>
        <div className="sd-list" ref={list}>
          {results.length === 0 && <div className="sd-empty">No components match “{q}”.</div>}
          {(q.trim() ? [null] : CATEGORIES).map((cat) => {
            const items = cat ? results.filter((c) => c.category === cat) : results
            if (!items.length) return null
            return (
              <div key={cat || 'results'}>
                <div className="sd-group">{cat || 'Results'}</div>
                {items.map((c) => {
                  n++
                  const idx = n
                  return (
                    <button key={c.slug} className={`sd-item${idx === sel ? ' sel' : ''}`} onMouseMove={() => setSel(idx)} onClick={() => go(c)}>
                      <span>
                        {c.name}
                        <small>{c.description.length > 86 ? `${c.description.slice(0, 86)}…` : c.description}</small>
                      </span>
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
        <div className="sd-foot">
          <span>
            <kbd className="kbd">↑↓</kbd>navigate
          </span>
          <span>
            <kbd className="kbd">↵</kbd>open
          </span>
        </div>
      </div>
    </div>
  )
}
