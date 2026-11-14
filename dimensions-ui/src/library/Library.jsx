import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { CATEGORIES, COMPONENTS, UI_STYLES, ICON_STYLES, OBJECT_STYLES, defaultsFor, loadSources, sourceFor, sourcesLoaded, usageFor, valueControls } from './registry.jsx'
import { highlight } from './highlight.js'
import { markdownFor, openPromptFor, promptFor, sourceText, typesFor } from './ai.js'
import { Icon } from '../Nav.jsx'
import ColorPicker from './ColorPicker.jsx'
import StageLoader from './StageLoader.jsx'
import './library.css'

const CAT_ICON = {
  All: <path d="M4 4h5v5H4zM11 4h5v5h-5zM4 11h5v5H4zM11 11h5v5h-5z" />,
  Text: <path d="M4 5.5V4h12v1.5M10 4v12M7.5 16h5" />,
  Animation: <path d="m5 3.5 9 5.2-3.9 1.2 2.4 4.1-1.8 1-2.4-4.1-2.7 2.9z" />,
  UI: <path d="M3 4.5h14v11H3zM3 7.5h14M6 11.5h4M13 11.5h1" />,
  'Phone UI': <path d="M6.5 2.5h7a1.5 1.5 0 0 1 1.5 1.5v12a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 5 16V4a1.5 1.5 0 0 1 1.5-1.5zM8.5 4.5h3M9.5 15h1" />,
  '3D & Materials': <path d="M10 2.5 16.5 6v8L10 17.5 3.5 14V6zM10 10 3.5 6M10 10l6.5-4M10 10v7.5" />,
  Backgrounds: <path d="M3.500 3.500h13v13h-13zM3.500 8h13M3.500 12h13M8 3.500v13M12 3.500v13" />,
  // a ball moving with speed lines trailing behind it
  'Motion Graphics': <path d="M11.5 10a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0-7 0zM2.5 7h6M4.5 10h4.5M2.5 13h6" />,
  'Icons & Emojis': <path d="M3.2 6.2a2.8 2.8 0 1 0 5.6 0a2.8 2.8 0 1 0-5.6 0zM11.5 3.4h5v5h-5zM10 11l4.5 6h-9z" />,
}

// Categories that are placeholders until their components land.
// A small copy button that sits on an icon/emoji card and copies its source.
function CopyChip({ comp }) {
  const [done, setDone] = useState(false)
  const copy = async (e) => {
    e.preventDefault()
    e.stopPropagation()
    try {
      const code = (await loadSources(comp))[0]?.code ?? ''
      await navigator.clipboard.writeText(code)
      setDone(true)
      setTimeout(() => setDone(false), 1400)
    } catch {}
  }
  return (
    <button type="button" className="copy-chip" onClick={copy} aria-label={done ? 'Copied' : 'Copy code'} title={done ? 'Copied' : 'Copy code'}>
      {done ? (
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4.5 10.5l3.5 3.5 7.5-8" /></svg>
      ) : (
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="7" y="7" width="9" height="9" rx="2" /><path d="M13 7V5.5A1.5 1.5 0 0 0 11.5 4h-6A1.5 1.5 0 0 0 4 5.5v6A1.5 1.5 0 0 0 5.5 13H7" /></svg>
      )}
    </button>
  )
}

// The Source section: fetches the component's files on first view.
function SourceFiles({ comp }) {
  const [files, setFiles] = useState(() => (sourcesLoaded(comp) ? sourceFor(comp) : null))
  useEffect(() => {
    let live = true
    setFiles(sourcesLoaded(comp) ? sourceFor(comp) : null)
    loadSources(comp).then((f) => live && setFiles(f))
    return () => {
      live = false
    }
  }, [comp])
  if (!files) return comp.files.map((f) => <CodeBlock key={f} title={f} code="// Loading source…" />)
  return files.map((f) => <CodeBlock key={f.file} title={f.file} code={f.code} />)
}

// Categories whose pages are split into sections.
const SECTIONS = { UI: UI_STYLES, '3D & Materials': OBJECT_STYLES, 'Icons & Emojis': ICON_STYLES }

const COMING_SOON = ['Icons & Emojis', 'Motion Graphics']

const PM = { npm: 'npm i', pnpm: 'pnpm add', yarn: 'yarn add', bun: 'bun add' }
const WIDTHS = { desktop: '100%', tablet: '768px', mobile: '390px' }

function CopyButton({ text, label = 'Copy' }) {
  const [done, setDone] = useState(false)
  return (
    <button
      className="lib-copy"
      onClick={() => {
        navigator.clipboard?.writeText(text).catch(() => {})
        setDone(true)
        setTimeout(() => setDone(false), 1400)
      }}
    >
      {done ? 'Copied' : label}
    </button>
  )
}

function CodeBlock({ title, code }) {
  const html = useMemo(() => highlight(code), [code])
  return (
    <div className="lib-code">
      <div className="lib-code-bar">
        <span>{title}</span>
        <CopyButton text={code} />
      </div>
      <pre>
        <code dangerouslySetInnerHTML={{ __html: html }} />
      </pre>
    </div>
  )
}

function Control({ c, value, onChange, onPatch, current }) {
  const id = `ctl-${c.name}`
  if (c.type === 'presets') {
    return (
      <div className="ctl ctl-presets">
        <span className="ctl-name">{c.name}</span>
        <div className="presets" role="group" aria-label={c.name}>
          {c.options.map((o) => {
            const on = Object.entries(o.values).every(([k, v]) => String(current[k]).toLowerCase() === String(v).toLowerCase())
            return (
              <button key={o.name} className={on ? 'on' : ''} onClick={() => onPatch(o.values)} aria-pressed={on}>
                <span className="dots">
                  {Object.values(o.values)
                    .filter((v) => /^#/.test(v))
                    .slice(0, 3)
                    .map((v, i) => (
                      <i key={i} style={{ background: v }} />
                    ))}
                </span>
                {o.name}
              </button>
            )
          })}
        </div>
      </div>
    )
  }
  if (c.type === 'toggle') {
    return (
      <label className="ctl ctl-toggle" htmlFor={id}>
        <span className="ctl-name">{c.name}</span>
        <input id={id} type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
        <span className="switch" aria-hidden="true" />
      </label>
    )
  }
  if (c.type === 'select') {
    return (
      <div className="ctl">
        <label className="ctl-name" htmlFor={id}>
          {c.name}
        </label>
        <div className="seg" role="radiogroup" aria-label={c.name}>
          {c.options.map((o) => (
            <button key={o} role="radio" aria-checked={value === o} className={value === o ? 'on' : ''} onClick={() => onChange(o)}>
              {o}
            </button>
          ))}
        </div>
      </div>
    )
  }
  if (c.type === 'text') {
    return (
      <div className="ctl">
        <label className="ctl-name" htmlFor={id}>
          {c.name}
        </label>
        <input id={id} className="ctl-text" value={value} maxLength={c.maxLength ?? 32} onChange={(e) => onChange(e.target.value)} />
      </div>
    )
  }
  if (c.type === 'textarea') {
    return (
      <div className="ctl ctl-wide">
        <label className="ctl-name" htmlFor={id}>
          {c.name}
          {c.hint && <span className="ctl-hint">{c.hint}</span>}
        </label>
        <textarea id={id} className="ctl-text ctl-area" value={value} rows={c.rows ?? 8} maxLength={c.maxLength ?? 6000} spellCheck={false} onChange={(e) => onChange(e.target.value)} />
      </div>
    )
  }
  if (c.type === 'image') {
    // Read the chosen file as a data URL, so the preview works without a server.
    const pick = (e) => {
      const file = e.target.files?.[0]
      e.target.value = ''
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => onChange(String(reader.result))
      reader.readAsDataURL(file)
    }
    return (
      <div className="ctl">
        <span className="ctl-name">{c.name}</span>
        <div className="ctl-image">
          {value ? <img src={value} alt="" /> : <span className="ctl-image-empty">None</span>}
          <label className="ctl-image-btn">
            {value ? 'Replace' : 'Upload'}
            <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" onChange={pick} />
          </label>
          {value && (
            <button type="button" className="ctl-image-btn" onClick={() => onChange('')}>
              Remove
            </button>
          )}
        </div>
      </div>
    )
  }
  if (c.type === 'color') {
    return <ColorPicker id={id} name={c.name} value={value} onChange={onChange} />
  }
  return (
    <div className="ctl">
      <label className="ctl-name" htmlFor={id}>
        {c.name}
        <span className="ctl-val">
          {value}
          {c.unit || ''}
        </span>
      </label>
      <input
        id={id}
        type="range"
        min={c.min}
        max={c.max}
        step={c.step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ '--p': `${((value - c.min) / (c.max - c.min)) * 100}%` }}
      />
    </div>
  )
}


// Favourites live in localStorage and are shared by the sidebar and the toolbar.
const FAV_KEY = 'rd-favs'
function readFavs() {
  try {
    return JSON.parse(localStorage.getItem(FAV_KEY) || '[]')
  } catch {
    return []
  }
}
function useFavs() {
  const [favs, setFavs] = useState(readFavs)
  useEffect(() => {
    const on = () => setFavs(readFavs())
    window.addEventListener('rd:favs', on)
    window.addEventListener('storage', on)
    return () => {
      window.removeEventListener('rd:favs', on)
      window.removeEventListener('storage', on)
    }
  }, [])
  const toggle = (slug) => {
    const next = favs.includes(slug) ? favs.filter((x) => x !== slug) : [...favs, slug]
    try {
      localStorage.setItem(FAV_KEY, JSON.stringify(next))
    } catch {}
    setFavs(next)
    window.dispatchEvent(new Event('rd:favs'))
  }
  return [favs, toggle]
}

// "Copy for AI": prompt, Markdown or plain source, ready to paste into an assistant.
function AiMenu({ comp, props }) {
  const [open, setOpen] = useState(false)
  const [done, setDone] = useState('')
  const box = useRef(null)
  useEffect(() => {
    if (!open) return
    const on = (e) => !box.current?.contains(e.target) && setOpen(false)
    const key = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', on)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('pointerdown', on)
      document.removeEventListener('keydown', key)
    }
  }, [open])
  // the source loads on demand: start fetching as the menu opens, so it is
  // usually there by the time an item is picked
  useEffect(() => {
    if (open) loadSources(comp)
  }, [open, comp])
  const copy = async (label, make) => {
    if (!sourcesLoaded(comp)) await loadSources(comp)
    navigator.clipboard?.writeText(make()).catch(() => {})
    setDone(label)
    setOpen(false)
    setTimeout(() => setDone(''), 1800)
  }
  // Open an assistant with a short prompt that links to this page, the
  // component's registry JSON and llms.txt (the assistant fetches the source).
  const openIn = (base) => {
    const q = openPromptFor(comp, props, window.location.origin)
    window.open(base + encodeURIComponent(q), '_blank', 'noopener,noreferrer')
    setOpen(false)
  }
  return (
    <div className="ai-menu" ref={box}>
      <button className="tool-btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {done ? `✓ ${done}` : '✦ Copy for AI ▾'}
      </button>
      {open && (
        <div className="ai-pop" role="menu">
          <button role="menuitem" onClick={() => copy('Prompt copied', () => promptFor(comp, props))}>
            <strong>Copy as prompt</strong>
            <small>Usage, props table, full source and integration steps, ready to paste into an assistant</small>
          </button>
          <button role="menuitem" onClick={() => copy('Markdown copied', () => markdownFor(comp, props))}>
            <strong>Copy as Markdown</strong>
            <small>This page as a .md document</small>
          </button>
          <button role="menuitem" onClick={() => copy('Source copied', () => sourceText(comp))}>
            <strong>Copy source only</strong>
            <small>{comp.files.length} file{comp.files.length > 1 ? 's' : ''}, with file names as comments</small>
          </button>
          <div className="ai-sep" role="separator" />
          <button role="menuitem" className="ai-open" onClick={() => openIn('https://chatgpt.com/?q=')}>
            <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" aria-hidden="true">
              <path d="M10 2.8l6.2 3.6v7.2L10 17.2l-6.2-3.6V6.4z" />
              <path d="M10 2.8v7.2l6.2 3.6M10 10l-6.2 3.6M3.8 6.4L10 10" />
            </svg>
            <strong>Open in ChatGPT</strong>
          </button>
          <button role="menuitem" className="ai-open" onClick={() => openIn('https://claude.ai/new?q=')}>
            <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
              <path d="M10 2.5v15M2.5 10h15M4.7 4.7l10.6 10.6M15.3 4.7L4.7 15.3M6.2 3.4l7.6 13.2M13.8 3.4L6.2 16.6" />
            </svg>
            <strong>Open in Claude</strong>
          </button>
        </div>
      )}
    </div>
  )
}

function Section({ id, title, note, actions, children }) {
  return (
    <section className="lib-section" id={id}>
      <header>
        <h2>
          {title}
          {note && <small>{note}</small>}
        </h2>
        {actions}
      </header>
      {children}
    </section>
  )
}

const catSlug = (c) => c.toLowerCase().replace(/[^a-z0-9]+/g, '-')

// The sidebar remounts between pages, so remember the chosen category here.
let lastCat = 'All'

function Sidebar({ active, open, onClose, favs, category }) {
  const navigate = useNavigate()
  const [hover, setHover] = useState(null)
  const [cat, setCat] = useState(category ?? lastCat)
  useEffect(() => {
    if (!category) return
    lastCat = category
    setCat(category)
  }, [category])
  const [query, setQuery] = useState('')
  const [edge, setEdge] = useState({ top: true, bottom: false })
  const scroller = useRef(null)
  const search = useRef(null)
  const tabs = ['All', ...CATEGORIES]
  const q = query.trim().toLowerCase()
  const catMatch = cat === 'All' ? CATEGORIES : [cat]
  const visible = CATEGORIES.map((c) => ({
    name: c,
    items: COMPONENTS.filter((x) => x.category === c && catMatch.includes(c) && (!q || x.name.toLowerCase().includes(q) || c.toLowerCase().includes(q) || (x.style ?? '').toLowerCase().includes(q))),
  })).filter((g) => g.items.length)
  // favourites float to the top when browsing everything
  if (!q && cat === 'All') {
    const fav = COMPONENTS.filter((x) => favs.includes(x.slug))
    if (fav.length) visible.unshift({ name: 'Favourites', items: fav, fav: true })
  }

  const showHover = (c, el) => {
    if (window.matchMedia('(max-width: 900px)').matches) return
    const r = el.getBoundingClientRect()
    const side = el.closest('.lib-side').getBoundingClientRect()
    const h = 276
    setHover({ c, top: Math.min(Math.max(r.top - 8, 72), window.innerHeight - h - 12), left: side.right + 12 })
  }

  const measure = () => {
    const el = scroller.current
    if (el) setEdge({ top: el.scrollTop < 6, bottom: el.scrollTop + el.clientHeight > el.scrollHeight - 6 })
  }
  useEffect(measure, [cat, query])
  // keep the current page in view in the list
  useEffect(() => {
    scroller.current?.querySelector('.active')?.scrollIntoView({ block: 'nearest' })
  }, [active])

  return (
    <>
      <div className={`lib-backdrop${open ? ' show' : ''}`} onClick={onClose} />
      <aside className={`lib-side${open ? ' open' : ''}`} aria-label="Components">
        <div className="lib-side-top">
          <Link className="lib-browse-all" to="/library/c/all" onClick={onClose}>
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {CAT_ICON.All}
            </svg>
            Browse all components
          </Link>
          <div className="cat-picker" role="tablist" aria-label="Category" style={{ '--col': Math.max(0, tabs.indexOf(cat)) % 4, '--row': Math.floor(Math.max(0, tabs.indexOf(cat)) / 4) }}>
            <span className="pill-bg" aria-hidden="true" />
            {tabs.map((t) => (
              <button key={t} role="tab" aria-selected={cat === t} aria-label={t} title={t} onClick={() => { onClose(); navigate(`/library/c/${catSlug(t)}`) }}>
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  {CAT_ICON[t]}
                </svg>
              </button>
            ))}
          </div>
          <div className="lib-filter">
            {Icon.search}
            <input ref={search} placeholder={cat === 'All' ? `Filter ${COMPONENTS.length} components…` : `Filter ${COMPONENTS.filter((x) => x.category === cat).length} in ${cat}…`} value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Filter components" />
          </div>
        </div>
        <nav className={`lib-list${edge.top ? ' at-top' : ''}${edge.bottom ? ' at-bottom' : ''}`} ref={scroller} onScroll={measure}>
          {visible.map((g) => (
            <div className={`lib-cat${g.fav ? ' favs' : ''}`} key={g.name}>
              <h4>{g.fav ? '★ ' : ''}{g.name}</h4>
              {(SECTIONS[g.name] ? SECTIONS[g.name].map((st) => ({ st, items: g.items.filter((c) => c.style === st) })).filter((x) => x.items.length) : [{ st: null, items: g.items }]).map(({ st, items }) => (
                <div className={st ? 'lib-style' : undefined} key={st ?? 'all'}>
                {st && <h5>{st}</h5>}
              {items.map((c) => (
                <Link
                  key={c.slug}
                  to={`/library/${c.slug}`}
                  className={c.slug === active ? 'active' : ''}
                  onClick={onClose}
                  onMouseEnter={(e) => showHover(c, e.currentTarget)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={(e) => showHover(c, e.currentTarget)}
                  onBlur={() => setHover(null)}
                >
                  {c.name}
                  {c.isNew && <span className="badge">New</span>}
                </Link>
              ))}
                </div>
              ))}
            </div>
          ))}
          {!visible.length && <p className="lib-none">{COMING_SOON.includes(cat) && !q ? `${cat} components are coming soon.` : 'No matching components'}</p>}
        </nav>
      </aside>
      {hover && (
        <div className="hover-card" style={{ top: hover.top, left: hover.left }} aria-hidden="true">
          <img src={`/previews/${hover.c.slug}.jpg`} alt="" />
          <div>
            <strong>{hover.c.name}</strong>
            <small>{hover.c.style ? `${hover.c.category} · ${hover.c.style}` : hover.c.category}</small>
          </div>
        </div>
      )}
    </>
  )
}

const SORTS = [
  ['az', 'A to Z'],
  ['za', 'Z to A'],
]

function SortMenu({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const root = useRef(null)
  const trigger = useRef(null)

  useEffect(() => {
    if (!open) return
    root.current.querySelector('[aria-checked="true"]')?.focus()
    const down = (e) => !root.current.contains(e.target) && setOpen(false)
    const key = (e) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      trigger.current.focus()
    }
    document.addEventListener('pointerdown', down)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('pointerdown', down)
      document.removeEventListener('keydown', key)
    }
  }, [open])

  const pick = (v) => {
    onChange(v)
    setOpen(false)
    trigger.current.focus()
  }
  const arrows = (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const items = [...e.currentTarget.querySelectorAll('button')]
    const step = e.key === 'ArrowDown' ? 1 : -1
    items[(items.indexOf(document.activeElement) + step + items.length) % items.length].focus()
  }

  return (
    <div className="sort" ref={root}>
      <button ref={trigger} className={`sort-btn${open ? ' open' : ''}`} aria-haspopup="menu" aria-expanded={open} aria-label="Sort" onClick={() => setOpen((o) => !o)}>
        {SORTS.find(([v]) => v === value)[1]}
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m5.5 8 4.500 4.500L14.500 8" />
        </svg>
      </button>
      {open && (
        <div className="sort-menu" role="menu" onKeyDown={arrows}>
          {SORTS.map(([v, label]) => (
            <button key={v} role="menuitemradio" aria-checked={v === value} onClick={() => pick(v)}>
              {label}
              {v === value && (
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m4.500 10.500 3.500 3.500 7.500-8" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// A grid of every component in a category, opened from the sidebar's category icons.
export function CategoryPage() {
  const { cat } = useParams()
  const name = cat === 'all' ? 'All' : CATEGORIES.find((c) => catSlug(c) === cat)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('az')
  // A sectioned category (styles, or icons and emojis) opens on "All
  // components", with a chip per section to narrow it down.
  const firstStyle = 'All'
  const [style, setStyle] = useState(firstStyle)
  const [drawer, setDrawer] = useState(false)
  const [favs] = useFavs()
  const title = name === 'All' ? 'All components' : name

  useEffect(() => {
    setQuery('')
    setStyle(firstStyle)
    setDrawer(false)
    if (name) document.title = `${title} — React Dimensions`
    window.scrollTo({ top: 0 })
  }, [cat])

  useEffect(() => {
    const on = () => setDrawer((d) => !d)
    window.addEventListener('rd:sidebar', on)
    return () => window.removeEventListener('rd:sidebar', on)
  }, [])

  if (!name) return <Navigate to="/library/c/all" replace />

  const q = query.trim().toLowerCase()
  const items = COMPONENTS.filter((c) => (name === 'All' || c.category === name) && (style === 'All' || c.style === style) && (!q || c.name.toLowerCase().includes(q) || (c.style ?? '').toLowerCase().includes(q)))
  items.sort((a, b) => (sort === 'az' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)))

  return (
    <div className="lib lib-browse">
      <Sidebar open={drawer} onClose={() => setDrawer(false)} favs={favs} category={name} />
      <div className="lib-main">
        <header className="browse-head">
          <h1 className="lib-title">{title}</h1>
          <div className="browse-tools">
            <div className="lib-filter">
              {Icon.search}
              <input placeholder="Search…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label={`Search ${title}`} />
            </div>
            <SortMenu value={sort} onChange={setSort} />
          </div>
        </header>
        {SECTIONS[name] && (
          <div className="style-chips" role="group" aria-label="Filter by style">
            <button aria-pressed={style === 'All'} onClick={() => setStyle('All')}>
              All components<span>{COMPONENTS.filter((c) => c.category === name).length}</span>
            </button>
            {SECTIONS[name].map((st) => {
              const n = COMPONENTS.filter((c) => c.category === name && c.style === st).length
              return (
                <button key={st} aria-pressed={style === st} onClick={() => setStyle(st)}>
                  {st}<span>{n}</span>
                </button>
              )
            })}
          </div>
        )}
        <div className={name === 'Icons & Emojis' ? 'browse-grid compact' : 'browse-grid'}>
          {items.map((c) => (
            <Link className={c.category === 'Icons & Emojis' ? 'browse-card icon' : 'browse-card'} key={c.slug} to={`/library/${c.slug}`}>
              {/* icons are tiny SVGs, so the card draws them live instead of loading a screenshot */}
              {c.category === 'Icons & Emojis' ? (
                <span className="browse-icon">
                  {c.preview({ ...defaultsFor(c), size: 36, color: 'currentColor' })}
                  <CopyChip comp={c} />
                </span>
              ) : (
                <img src={`/previews/${c.slug}.jpg`} alt="" loading="lazy" />
              )}
              <strong>
                {c.name}
                {c.isNew && <span className="badge">New</span>}
              </strong>
              {c.category !== 'Icons & Emojis' && <small>{c.style ? `${c.category} · ${c.style}` : c.category}</small>}
            </Link>
          ))}
        </div>
        {!items.length && <p className="lib-none">{COMING_SOON.includes(name) && !q ? `${name} components are coming soon.` : 'No matching components'}</p>}
      </div>
    </div>
  )
}

export default function Library() {
  const { slug } = useParams()
  const index = COMPONENTS.findIndex((c) => c.slug === slug)
  const comp = COMPONENTS[index]
  const [tab, setTab] = useState('preview')
  const [values, setValues] = useState(() => (comp ? defaultsFor(comp) : {}))
  const [reload, setReload] = useState(0)
  const stageRef = useRef(null)
  const [width, setWidth] = useState('desktop')
  const [pm, setPm] = useState('npm')
  const [drawer, setDrawer] = useState(false)
  const [spy, setSpy] = useState('')
  const [linkCopied, setLinkCopied] = useState(false)
  const [favs, toggleFav] = useFavs()
  const [lang, setLangState] = useState(() => {
    try {
      return localStorage.getItem('rd-lang') || 'js'
    } catch {
      return 'js'
    }
  })
  const setLang = (l) => {
    setLangState(l)
    try {
      localStorage.setItem('rd-lang', l)
    } catch {}
  }

  useEffect(() => {
    if (!comp) return
    setValues(defaultsFor(comp))
    setTab('preview')
    setReload(0)
    setWidth('desktop')
    setDrawer(false)
    document.title = `${comp.name} — React Dimensions`
    window.scrollTo({ top: 0 })
  }, [slug])

  // the header's menu button opens the component list on small screens
  useEffect(() => {
    const on = () => setDrawer((d) => !d)
    window.addEventListener('rd:sidebar', on)
    return () => window.removeEventListener('rd:sidebar', on)
  }, [])

  // highlight the section being read in "On this page"
  useEffect(() => {
    const ids = tab === 'preview' ? ['preview', 'customize', 'props', 'dependencies'] : ['install', 'usage', 'types', 'source']
    setSpy(ids[0])
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        if (hit) setSpy(hit.target.id)
      },
      { rootMargin: '-90px 0px -60% 0px' },
    )
    ids.forEach((id) => document.getElementById(id) && io.observe(document.getElementById(id)))
    return () => io.disconnect()
  }, [tab, slug])

  if (!comp) return <Navigate to={`/library/${COMPONENTS[0].slug}`} replace />

  // Values from the previous component can linger for one render after navigation.
  const props = { ...defaultsFor(comp), ...Object.fromEntries(Object.entries(values).filter(([k]) => valueControls(comp).some((c) => c.name === k))) }
  const vc = valueControls(comp)
  const prev = COMPONENTS[index - 1]
  const next = COMPONENTS[index + 1]
  const changed = vc.some((c) => props[c.name] !== c.default)
  const related = [...COMPONENTS.filter((c) => c.category === comp.category && c.slug !== slug), ...COMPONENTS.filter((c) => c.category !== comp.category && c.slug !== slug)].slice(0, 3)
  const ts = lang === 'ts'
  const isFav = favs.includes(slug)
  const toc = tab === 'preview' ? [['preview', 'Preview'], ['customize', 'Customize'], ['props', 'Props'], ['dependencies', 'Dependencies']] : [['install', 'Install'], ['usage', 'Usage'], ...(ts ? [['types', 'Types']] : []), ['source', 'Source']]
  const deps = ['react', ...comp.deps]
  const installText = `${PM[pm]} ${deps.join(' ')}` + (ts ? `\n${PM[pm]} -D typescript @types/react${comp.deps.includes('three') ? ' @types/three' : ''}` : '')
  const typeOf = (c) => (c.type === 'range' ? 'number' : c.type === 'toggle' ? 'boolean' : c.type === 'select' ? c.options.map((o) => `'${o}'`).join(' | ') : 'string')

  return (
    <div className={`lib${comp.category === 'UI' || comp.category === 'Phone UI' ? ' lib-wide' : ''}`}>
      <Sidebar active={slug} open={drawer} onClose={() => setDrawer(false)} favs={favs} />

      <div className="lib-main">
        <div className="lib-crumb-row">
          <p className="lib-crumb">
            Library <span>/</span> {comp.category} <span>/</span> <b>{comp.name}</b>
          </p>
          {/* the same previous / next as the bottom of the page, compact */}
          <nav className="lib-pager-top" aria-label="Previous and next component (top)">
            {prev ? (
              <Link to={`/library/${prev.slug}`} title={`Previous: ${prev.name}`}>
                ← <span>{prev.name}</span>
              </Link>
            ) : (
              <span className="off">←</span>
            )}
            {next ? (
              <Link to={`/library/${next.slug}`} title={`Next: ${next.name}`}>
                <span>{next.name}</span> →
              </Link>
            ) : (
              <span className="off">→</span>
            )}
          </nav>
        </div>
        <h1 className="lib-title">
          {comp.name}
          {comp.isNew && <span className="badge badge-lg">New</span>}
        </h1>
        <p className="lib-desc">{comp.description}</p>

        <div className="docs-toolbar">
          <div className="pillswitch" role="tablist" style={{ '--i': tab === 'preview' ? 0 : 1 }}>
            <span className="pill-bg" aria-hidden="true" />
            {['preview', 'code'].map((t) => (
              <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
                {t === 'preview' ? 'Preview' : 'Code'}
              </button>
            ))}
          </div>
          <div className="tool-actions">
            {tab === 'preview' && (
              <div className="width-presets" role="group" aria-label="Preview width">
                {Object.keys(WIDTHS).map((w) => (
                  <button key={w} className={width === w ? 'on' : ''} aria-pressed={width === w} onClick={() => setWidth(w)}>
                    {w}
                  </button>
                ))}
              </div>
            )}
            <AiMenu comp={comp} props={props} />
            <button
              className={`tool-btn fav-btn${isFav ? ' on' : ''}`}
              onClick={() => toggleFav(slug)}
              aria-pressed={isFav}
              title={isFav ? 'Remove from favourites' : 'Add to favourites'}
              aria-label={isFav ? 'Remove from favourites' : 'Add to favourites'}
            >
              {isFav ? '★' : '☆'}
            </button>
            <button className="tool-btn" onClick={() => setReload((n) => n + 1)} title="Reload the preview" aria-label="Reload the preview">
              Reload
            </button>
            <button
              className="tool-btn"
              title="Copy a link to this page"
              onClick={() => {
                navigator.clipboard?.writeText(window.location.href).catch(() => {})
                setLinkCopied(true)
                setTimeout(() => setLinkCopied(false), 1400)
              }}
            >
              {linkCopied ? '✓ Copied' : '⎘ Link'}
            </button>
          </div>
        </div>

        {tab === 'preview' ? (
          <>
            <div className="stage-shell" id="preview">
              <div className={`lib-stage${comp.fill ? ' fill' : ''}${comp.category === 'UI' || comp.category === 'Phone UI' ? ' screen' : ''}`} style={{ maxWidth: WIDTHS[width] }}>
                <div className="lib-stage-inner" key={`${slug}-${reload}`} ref={stageRef}>
                  {comp.preview(props, (patch) => setValues((s) => ({ ...s, ...patch })))}
                </div>
                <StageLoader key={`load-${slug}-${reload}`} target={stageRef} expectCanvas={!!comp.deps?.includes('@react-three/fiber')} />
              </div>
            </div>

            <Section
              id="customize"
              title="Customize"
              actions={
                changed && (
                  <button className="lib-reset" onClick={() => setValues(defaultsFor(comp))}>
                    Reset
                  </button>
                )
              }
            >
              <div className="ctl-grid">
                {comp.controls.map((c) => (
                  <Control key={c.name} c={c} value={props[c.name]} current={props} onChange={(v) => setValues((s) => ({ ...s, [c.name]: v }))} onPatch={(patch) => setValues((s) => ({ ...s, ...patch }))} />
                ))}
              </div>
            </Section>

            <Section id="props" title="Props">
              <div className="lib-table-wrap">
                <table className="lib-table">
                  <thead>
                    <tr>
                      <th>Prop</th>
                      <th>Type</th>
                      <th>Default</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vc.map((c) => (
                      <tr key={c.name}>
                        <td>
                          <code>{c.name}</code>
                        </td>
                        <td>{typeOf(c)}</td>
                        <td>
                          <code>{String(c.default)}</code>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>

            <Section id="dependencies" title="Dependencies">
              <div className="dep-list">
                {deps.map((d) => (
                  <code key={d}>{d}</code>
                ))}
              </div>
            </Section>
          </>
        ) : (
          <>
            <div className="lang-row">
              <div className="seg lang-seg" role="radiogroup" aria-label="Language">
                {[['js', 'JavaScript'], ['ts', 'TypeScript']].map(([k, label]) => (
                  <button key={k} role="radio" aria-checked={lang === k} className={lang === k ? 'on' : ''} onClick={() => setLang(k)}>
                    {label}
                  </button>
                ))}
              </div>
              <span className="lang-note">
                {ts ? 'The components are plain JSX; TypeScript projects add the types below.' : 'Styling is inline, so there is no CSS or Tailwind variant to choose.'}
              </span>
            </div>
            <Section id="install" title="Install">
              <div className="pm-tabs" role="tablist" aria-label="Package manager">
                {Object.keys(PM).map((k) => (
                  <button key={k} role="tab" aria-selected={pm === k} className={pm === k ? 'on' : ''} onClick={() => setPm(k)}>
                    {k}
                  </button>
                ))}
              </div>
              <CodeBlock title="Terminal" code={installText}
              />
            </Section>
            <Section id="usage" title="Usage" note={changed ? 'with your settings' : undefined}>
              <CodeBlock title={ts ? 'App.tsx' : 'App.jsx'} code={usageFor(comp, props)} />
            </Section>
            {ts && (
              <Section id="types" title="Types" note="props">
                <CodeBlock title={`${comp.files[0].replace(/^.*\//, '').replace(/\.jsx$/, '')}.d.ts`} code={typesFor(comp)} />
              </Section>
            )}
            <Section id="source" title="Source" note={`${comp.files.length} file${comp.files.length > 1 ? 's' : ''}`}>
              <SourceFiles comp={comp} />
            </Section>
          </>
        )}

        <section className="lib-related">
          <h2>Related components</h2>
          <div className="related-grid">
            {related.map((c) => (
              <Link key={c.slug} to={`/library/${c.slug}`}>
                <img className="rel-img" src={`/previews/${c.slug}.jpg`} alt="" loading="lazy" />
                <span className="rel-cat">{c.category}</span>
                <strong>
                  {c.name}
                  {c.isNew && <span className="badge">New</span>}
                </strong>
                <small>{c.description.length > 96 ? `${c.description.slice(0, 96)}…` : c.description}</small>
              </Link>
            ))}
          </div>
        </section>

        <nav className="lib-pager" aria-label="Previous and next component">
          {prev ? (
            <Link to={`/library/${prev.slug}`}>
              <small>Previous</small>← {prev.name}
            </Link>
          ) : (
            <span />
          )}
          {next && (
            <Link to={`/library/${next.slug}`} className="next">
              <small>Next</small>
              {next.name} →
            </Link>
          )}
        </nav>
      </div>

      <aside className="lib-toc" aria-label="On this page">
        <h4>On this page</h4>
        {toc.map(([id, label]) => (
          <a
            key={id}
            href={`#${id}`}
            className={spy === id ? 'on' : ''}
            onClick={(e) => {
              e.preventDefault()
              document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
            }}
          >
            {label}
          </a>
        ))}
      </aside>
    </div>
  )
}
