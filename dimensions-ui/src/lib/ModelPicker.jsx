import { useEffect, useRef, useState } from 'react'

const MODELS = [
  { id: 'fast', name: 'Haiku', note: 'Quick answers', speed: 'Fast', cost: '$' },
  { id: 'balanced', name: 'Sonnet', note: 'Everyday work', speed: 'Balanced', cost: '$$' },
  { id: 'deep', name: 'Opus', note: 'Hard problems', speed: 'Slower', cost: '$$$' },
]

// A model dropdown with speed and cost tags. It is a real listbox: Enter or Space opens
// it, the arrow keys move, Enter picks, Escape closes. `defaultOpen` shows the list in
// the preview; the space for it is always reserved so the page never jumps.
export default function ModelPicker({
  models = MODELS,
  defaultOpen = true,
  showNotes = true,
  width = 320,
  size = 15,
  background = '#141414',
  textColor = '#e8e6e1',
  mutedColor = '#8a8a8a',
  color = '#d77757',
}) {
  const [open, setOpen] = useState(defaultOpen)
  const [sel, setSel] = useState(Math.min(1, models.length - 1))
  const [hi, setHi] = useState(sel)
  const root = useRef(null)

  useEffect(() => setOpen(defaultOpen), [defaultOpen])

  // click outside closes
  useEffect(() => {
    if (!open) return
    const off = (e) => !root.current?.contains(e.target) && setOpen(false)
    document.addEventListener('pointerdown', off)
    return () => document.removeEventListener('pointerdown', off)
  }, [open])

  const choose = (i) => {
    setSel(i)
    setOpen(false)
  }
  const onKey = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!open) return setOpen(true)
      setHi((h) => (h + (e.key === 'ArrowDown' ? 1 : -1) + models.length) % models.length)
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      open ? choose(hi) : (setHi(sel), setOpen(true))
    } else if (e.key === 'Escape') setOpen(false)
  }

  const tag = (t) => ({ fontSize: '0.8em', padding: '0.15em 0.55em', borderRadius: 99, border: `1px solid ${mutedColor}55`, color: mutedColor, whiteSpace: 'nowrap', ...t })
  const m = models[sel]

  return (
    <div ref={root} style={{ position: 'relative', width: `min(${width}px, 100%)`, height: `${models.length * (showNotes ? 3.6 : 2.8) + 4.6}em`, font: `400 ${size}px/1.2 ui-monospace, "SF Mono", Menlo, Consolas, monospace`, color: textColor }}>
      <button
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls="mp-list"
        onClick={() => (setHi(sel), setOpen((o) => !o))}
        onKeyDown={onKey}
        style={{ all: 'unset', boxSizing: 'border-box', width: '100%', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.7em', padding: '0.8em 1em', borderRadius: 10, background, border: `1px solid ${open ? color : mutedColor + '44'}`, transition: 'border-color .2s' }}
      >
        <span style={{ fontWeight: 600, flex: 1 }}>{m.name}</span>
        <span style={tag()}>{m.speed}</span>
        <span style={tag({ color })}>{m.cost}</span>
        <span aria-hidden style={{ color: mutedColor, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>▾</span>
      </button>
      <ul
        id="mp-list"
        role="listbox"
        style={{ position: 'absolute', top: '3.4em', left: 0, right: 0, margin: 0, padding: '0.35em', listStyle: 'none', borderRadius: 10, background, border: `1px solid ${mutedColor}44`, boxShadow: '0 12px 30px #0008', opacity: open ? 1 : 0, transform: open ? 'none' : 'translateY(-6px)', pointerEvents: open ? 'auto' : 'none', transition: 'opacity .15s, transform .15s', zIndex: 2 }}
      >
        {models.map((x, i) => (
          <li
            key={x.id}
            role="option"
            aria-selected={i === sel}
            onMouseEnter={() => setHi(i)}
            onClick={() => choose(i)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.7em', padding: '0.6em 0.7em', borderRadius: 7, cursor: 'pointer', background: i === hi ? '#ffffff12' : 'transparent' }}
          >
            <span aria-hidden style={{ width: '1em', color }}>{i === sel ? '✓' : ''}</span>
            <span style={{ flex: 1 }}>
              <span style={{ fontWeight: 600 }}>{x.name}</span>
              {showNotes && <span style={{ display: 'block', fontSize: '0.8em', color: mutedColor, marginTop: '0.2em' }}>{x.note}</span>}
            </span>
            <span style={tag()}>{x.speed}</span>
            <span style={tag({ color })}>{x.cost}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
