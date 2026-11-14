import { useState, useRef, useMemo, useLayoutEffect, useEffect, useId } from 'react'

// Type-to-search: focus the area and just start typing. There is no input box;
// a floating pill shows the query while the grid filters live, matched
// substrings are highlighted and the cards that stay glide to their new spots
// (FLIP via the Web Animations API). Backspace edits, Esc clears (or closes the
// detail), arrows move the selection, Enter opens it. It is a listbox with
// aria-activedescendant and an aria-live match count. Tap a card on touch.

const WORDS = ['Aurora', 'Basalt', 'Cobalt', 'Dune', 'Ember', 'Fjord', 'Glacier', 'Harbor', 'Indigo', 'Juniper', 'Krill', 'Lagoon', 'Meadow', 'Nimbus', 'Onyx', 'Prism', 'Quartz', 'Reef', 'Saffron', 'Tundra', 'Umber', 'Velvet', 'Willow', 'Zephyr']
const KINDS = ['Lamp', 'Chair', 'Vase', 'Clock', 'Rug', 'Shelf', 'Table', 'Mirror']
const TAGS = ['wood', 'steel', 'glass', 'soft', 'light', 'tall', 'round', 'matte', 'warm', 'cool']

const makeItems = (n) =>
  Array.from({ length: n }, (_, i) => ({
    id: i,
    name: `${WORDS[(i * 7) % WORDS.length]} ${KINDS[(i * 5 + (i >> 3)) % KINDS.length]}`,
    tags: [TAGS[i % TAGS.length], TAGS[(i * 3 + 2) % TAGS.length]].filter((t, k, a) => a.indexOf(t) === k),
    price: 40 + ((i * 37) % 260),
    hue: (i * 47) % 360,
  }))

function Hi({ text, q, mode, accent }) {
  const at = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1
  if (at < 0) return text
  const st =
    mode === 'underline'
      ? { textDecoration: 'underline', textDecorationColor: accent, textDecorationThickness: 3, textUnderlineOffset: 3 }
      : mode === 'bold'
        ? { fontWeight: 800, color: accent }
        : { background: accent, color: '#fff', borderRadius: 3, padding: '0 2px', margin: '0 -2px' }
  return (
    <>
      {text.slice(0, at)}
      <mark style={{ background: 'none', color: 'inherit', ...st }}>{text.slice(at, at + q.length)}</mark>
      {text.slice(at + q.length)}
    </>
  )
}

export default function TypeSearch({ accent = '#ff4d1a', items = 24, highlight = 'background', style }) {
  const uid = useId().replace(/:/g, '')
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const [open, setOpen] = useState(null)
  const [focused, setFocused] = useState(false)
  const gridRef = useRef(null)
  const rects = useRef(new Map())
  const reduce = useRef(false)

  useEffect(() => {
    reduce.current = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  }, [])

  const all = useMemo(() => makeItems(Math.max(1, Math.round(items))), [items])
  const results = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return all
    return all.filter((it) => it.name.toLowerCase().includes(s) || it.tags.some((t) => t.includes(s)))
  }, [all, q])

  const active = Math.min(sel, Math.max(0, results.length - 1))

  // FLIP: animate cards from their previous spot to the new one
  useLayoutEffect(() => {
    const grid = gridRef.current
    if (!grid) return
    const next = new Map()
    for (const el of grid.children) {
      const id = el.dataset.id
      const r = el.getBoundingClientRect()
      next.set(id, r)
      if (reduce.current || !el.animate) continue
      const p = rects.current.get(id)
      if (p) {
        const dx = p.left - r.left
        const dy = p.top - r.top
        if (dx || dy) el.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'none' }], { duration: 320, easing: 'cubic-bezier(.2,.8,.2,1)' })
      } else if (rects.current.size) {
        el.animate([{ opacity: 0, transform: 'scale(.92)' }, { opacity: 1, transform: 'none' }], { duration: 280, easing: 'ease-out' })
      }
    }
    rects.current = next
  })

  useEffect(() => {
    gridRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView?.({ block: 'nearest' })
  }, [active, q])

  const cols = () => {
    const ch = gridRef.current?.children
    if (!ch || ch.length < 2) return 1
    const top = ch[0].offsetTop
    let n = 0
    while (n < ch.length && ch[n].offsetTop === top) n++
    return Math.max(1, n)
  }

  const onKeyDown = (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return
    const k = e.key
    if (k === 'Escape') {
      e.preventDefault()
      if (open) setOpen(null)
      else { setQ(''); setSel(0) }
    } else if (k === 'Backspace') {
      e.preventDefault()
      setQ((v) => v.slice(0, -1)); setSel(0)
    } else if (k === 'Enter') {
      if (results[active]) { e.preventDefault(); setOpen(results[active]) }
    } else if (k.startsWith('Arrow')) {
      e.preventDefault()
      const d = k === 'ArrowLeft' ? -1 : k === 'ArrowRight' ? 1 : k === 'ArrowUp' ? -cols() : cols()
      setSel(Math.max(0, Math.min(results.length - 1, active + d)))
    } else if (k.length === 1 && (k !== ' ' || q)) {
      e.preventDefault()
      setOpen(null)
      setQ((v) => (v + k).slice(0, 24)); setSel(0)
    } else if (k === ' ') e.preventDefault()
  }

  const tint = (h, l) => `hsl(${h} 45% ${l}%)`

  return (
    <div
      tabIndex={0}
      role="group"
      aria-label="Type to search"
      onKeyDown={onKeyDown}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: '#f4f1ea', color: '#1c1a16', font: '400 14px/1.4 system-ui, sans-serif', outline: 'none', boxShadow: focused ? `inset 0 0 0 2px ${accent}` : 'none', ...style }}
    >
      <style>{`
        .ts-${uid} .ts-card { transition: box-shadow 160ms, background 160ms; }
        @media (prefers-reduced-motion: reduce) { .ts-${uid} .ts-card, .ts-${uid} .ts-pill { transition: none !important; } }
      `}</style>
      <div className={`ts-${uid}`} style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '14px 16px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontSize: 12, color: '#6b665c' }}>
          <span>{focused ? 'Just start typing. Arrows select, Enter opens, Esc clears.' : 'Click here, then type'}</span>
          <span aria-live="polite" role="status" style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: '#1c1a16' }}>
            {results.length === 0 ? 'No matches' : `${results.length} of ${all.length} ${results.length === 1 ? 'match' : 'items'}`}
          </span>
        </div>

        <div
          ref={gridRef}
          role="listbox"
          aria-label="Items"
          aria-activedescendant={results[active] ? `${uid}-${results[active].id}` : undefined}
          style={{ flex: 1, overflow: 'auto', padding: '4px 16px 72px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10, alignContent: 'start' }}
        >
          {results.map((it, i) => {
            const on = i === active
            return (
              <div
                key={it.id}
                id={`${uid}-${it.id}`}
                data-id={it.id}
                role="option"
                aria-selected={on}
                className="ts-card"
                onClick={() => { setSel(i); setOpen(it) }}
                style={{ background: '#fff', borderRadius: 12, padding: 10, cursor: 'pointer', boxShadow: on ? `0 0 0 2px ${accent}, 0 6px 16px rgba(0,0,0,.12)` : '0 0 0 1px rgba(0,0,0,.08)' }}
              >
                <div style={{ height: 44, borderRadius: 8, marginBottom: 8, background: `linear-gradient(135deg, ${tint(it.hue, 78)}, ${tint(it.hue + 30, 62)})` }} />
                <div style={{ fontWeight: 600 }}><Hi text={it.name} q={q.trim()} mode={highlight} accent={accent} /></div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
                  {it.tags.map((t) => (
                    <span key={t} style={{ fontSize: 11, padding: '1px 7px', borderRadius: 999, background: '#efebe1', color: '#4b463c' }}>
                      <Hi text={t} q={q.trim()} mode={highlight} accent={accent} />
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {q && (
          <div className="ts-pill" style={{ position: 'absolute', left: '50%', bottom: 18, transform: 'translateX(-50%)', background: '#1c1a16', color: '#f4f1ea', padding: '8px 16px', borderRadius: 999, font: '600 15px/1 ui-monospace, monospace', boxShadow: '0 8px 24px rgba(0,0,0,.25)', whiteSpace: 'nowrap', maxWidth: '90%' }}>
            <span style={{ opacity: 0.5, marginRight: 6 }}>search</span>
            {q}
            <span style={{ display: 'inline-block', width: 2, height: 15, background: accent, marginLeft: 2, verticalAlign: -2 }} />
          </div>
        )}

        {open && (
          <div role="dialog" aria-label={`${open.name} details`} style={{ position: 'absolute', right: 16, top: 48, width: 220, background: '#1c1a16', color: '#f4f1ea', borderRadius: 14, padding: 14, boxShadow: '0 12px 32px rgba(0,0,0,.3)' }}>
            <div style={{ height: 56, borderRadius: 8, marginBottom: 10, background: `linear-gradient(135deg, ${tint(open.hue, 70)}, ${tint(open.hue + 30, 50)})` }} />
            <div style={{ fontWeight: 700, fontSize: 16 }}>{open.name}</div>
            <div style={{ opacity: 0.7, margin: '4px 0 8px' }}>{open.tags.join(' / ')} &middot; ${open.price}</div>
            <button
              type="button"
              onClick={() => setOpen(null)}
              style={{ background: accent, color: '#fff', border: 0, borderRadius: 8, padding: '6px 12px', font: 'inherit', fontWeight: 600, cursor: 'pointer' }}
            >
              Close (Esc)
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
