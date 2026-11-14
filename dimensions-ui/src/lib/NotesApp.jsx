import { useEffect, useRef, useState } from 'react'

// A notes app on a phone, as a click-through prototype, with a warm paper look.
// Five pages: Notes (pinned first, pin from a row, folder filter, new note
// button), Editor (pushed: live title and body editing, pin, move to a folder,
// two-tap delete), Checklist (pick a checklist, tick items, add and remove
// them, clear the done ones, progress ring), Folders (counts; tap one to
// filter the list; add a folder) and Search (matches in titles, bodies and
// checklist items are highlighted; recent searches). Everything edits real
// state. The phone scales to fit.

const W = 390
const H = 844
const INK = '#2e2a22'
const MUTED = '#948a78'
const PAPER = '#fbf6e9'
const CARD = '#fffdf6'
const LINE = '#eadfc4'

const NOW = Date.now()
const MIN = 60000
const SEED = [
  { id: 'a1', title: 'Trip to Lisbon', body: 'Flights land Friday 14:20. Book the tram tour, try pastéis de nata at Manteigaria, and ask Ana about the rooftop bar in Alfama.', pin: true, folder: 'Personal', type: 'note', t: NOW - 20 * MIN },
  { id: 'a2', title: 'Packing list', body: '', pin: true, folder: 'Personal', type: 'check', items: [{ id: 'i1', t: 'Passport', done: true }, { id: 'i2', t: 'Phone charger', done: true }, { id: 'i3', t: 'Sunscreen', done: false }, { id: 'i4', t: 'Camera batteries', done: false }, { id: 'i5', t: 'Walking shoes', done: false }], t: NOW - 55 * MIN },
  { id: 'a3', title: 'Sprint planning', body: 'Goals: ship onboarding v2, fix the login bug, and write the release notes. Demo is on Friday at 15:00.', pin: false, folder: 'Work', type: 'note', t: NOW - 3 * 3600000 },
  { id: 'a4', title: 'App ideas', body: 'A plant-watering reminder that learns from photos. A shared grocery list with price memory. A tiny habit tracker with streak art.', pin: false, folder: 'Ideas', type: 'note', t: NOW - 26 * 3600000 },
  { id: 'a5', title: 'Groceries', body: '', pin: false, folder: 'Personal', type: 'check', items: [{ id: 'g1', t: 'Oat milk', done: false }, { id: 'g2', t: 'Sourdough', done: true }, { id: 'g3', t: 'Basil', done: false }, { id: 'g4', t: 'Lemons', done: false }], t: NOW - 30 * 3600000 },
  { id: 'a6', title: 'Book notes: Deep Work', body: 'Focus is a skill. Schedule long blocks, protect them, and shut down the day with a ritual.', pin: false, folder: 'Ideas', type: 'note', t: NOW - 80 * 3600000 },
]
const FOLDERS = ['Personal', 'Work', 'Ideas']

const ICONS = {
  note: 'M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5',
  check: 'M4 12l5 5L20 6',
  box: 'M4 5h16v14H4zM4 9h16M8 13h8',
  folder: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-5-5',
  pin: 'M9 4h6l-1 6 3 3H7l3-3zM12 13v8',
  back: 'M15 5l-7 7 7 7',
  chev: 'M9 5l7 7-7 7',
  plus: 'M12 5v14M5 12h14',
  trash: 'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13',
  x: 'M6 6l12 12M18 6L6 18',
}

function Icon({ name, size = 22, color = 'currentColor', w = 1.9, fill = 'none' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  )
}

const iconBtn = { display: 'grid', placeItems: 'center', border: 'none', borderRadius: '50%', cursor: 'pointer', padding: 0, background: CARD, color: INK }
const serif = "Georgia, 'Iowan Old Style', 'Times New Roman', serif"

const rel = (t) => {
  const m = Math.round((Date.now() - t) / MIN)
  return m < 1 ? 'Just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.floor(m / 60)} h ago` : `${Math.floor(m / 1440)} d ago`
}
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function Hl({ text, q }) {
  const s = q.trim()
  if (!s) return text
  return text.split(new RegExp(`(${esc(s)})`, 'ig')).map((p, i) =>
    p.toLowerCase() === s.toLowerCase() ? <mark key={i} style={{ background: '#fde047', color: INK, borderRadius: 3, padding: '0 1px' }}>{p}</mark> : p,
  )
}

// A hand-drawn ring showing how much of a checklist is done.
function Ring({ done, total, size = 44, color }) {
  const r = size / 2 - 4
  const c = 2 * Math.PI * r
  const f = total ? done / total : 0
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label={`${done} of ${total} done`} role="img">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={LINE} strokeWidth="4" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeDasharray={`${c * f} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: 'stroke-dasharray .3s' }} />
      <text x="50%" y="53%" textAnchor="middle" dominantBaseline="middle" fontSize={size * 0.27} fontWeight="800" fill={INK}>{done}/{total}</text>
    </svg>
  )
}

function StatusBar({ frame }) {
  const clock = new Date().toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' })
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20, height: 54, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 30px 0 36px', fontSize: 16, fontWeight: 600, color: INK, pointerEvents: 'none' }}>
      <span>{clock}</span>
      {frame && <span style={{ position: 'absolute', left: '50%', top: 11, width: 122, height: 35, marginLeft: -61, borderRadius: 20, background: '#000' }} />}
      <span style={{ display: 'flex', gap: 6, alignItems: 'center' }} aria-hidden="true">
        <svg width="18" height="11" viewBox="0 0 18 11" fill={INK}>
          <rect x="0" y="7" width="3" height="4" rx="1" />
          <rect x="5" y="5" width="3" height="6" rx="1" />
          <rect x="10" y="2.5" width="3" height="8.5" rx="1" />
          <rect x="15" y="0" width="3" height="11" rx="1" />
        </svg>
        <svg width="26" height="12" viewBox="0 0 26 12">
          <rect x="0.5" y="0.5" width="22" height="11" rx="3.5" fill="none" stroke={INK} opacity=".45" />
          <rect x="2.5" y="2.5" width="16" height="7" rx="2" fill={INK} />
          <rect x="23.5" y="4" width="2" height="4" rx="1" fill={INK} opacity=".45" />
        </svg>
      </span>
    </div>
  )
}

const NAV = [
  ['notes', 'note', 'Notes'],
  ['checklist', 'box', 'Checklist'],
  ['folders', 'folder', 'Folders'],
  ['search', 'search', 'Search'],
]
const initNav = (s) => (s === 'editor' ? { tab: 'notes', stack: [{ id: 'editor', nid: 'a1' }] } : { tab: NAV.some((n) => n[0] === s) ? s : 'notes', stack: [] })

// ---------------------------------------------------------------- app

export default function NotesApp({ name = 'Jotter', accent = '#d97706', startScreen = 'notes', frame = true, style }) {
  const box = useRef()
  const toastTimer = useRef()
  const savedTimer = useRef()
  const [scale, setScale] = useState(1)
  const [nav, setNav] = useState(() => initNav(startScreen))
  const { tab, stack } = nav
  const [dir, setDir] = useState(1)
  const [toast, setToast] = useState('')
  const [notes, setNotes] = useState(SEED)
  const [folders, setFolders] = useState(FOLDERS)
  const [folder, setFolder] = useState('All')
  const [checkId, setCheckId] = useState('a2')
  const [newItem, setNewItem] = useState('')
  const [newFolder, setNewFolder] = useState('')
  const [q, setQ] = useState('')
  const [recent, setRecent] = useState(['Lisbon', 'ideas'])
  const [confirmDel, setConfirmDel] = useState(false)
  const [saved, setSaved] = useState(false)
  const seq = useRef(1)

  useEffect(() => setNav(initNav(startScreen)), [startScreen])

  useEffect(() => {
    const ro = new ResizeObserver(([e]) => {
      const fw = frame ? W + 28 : W
      const fh = frame ? H + 28 : H
      setScale(Math.min(1.2, (e.contentRect.width - 24) / fw, (e.contentRect.height - 24) / fh))
    })
    ro.observe(box.current)
    return () => ro.disconnect()
  }, [frame])

  const say = (t) => {
    setToast(t)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 1900)
  }
  useEffect(() => () => (clearTimeout(toastTimer.current), clearTimeout(savedTimer.current)), [])

  const top = stack[stack.length - 1]
  const push = (s) => (setDir(1), setConfirmDel(false), setNav((n) => ({ ...n, stack: [...n.stack, s] })))
  const go = (t) => (setDir(NAV.findIndex((n) => n[0] === t) >= NAV.findIndex((n) => n[0] === tab) ? 1 : -1), setConfirmDel(false), setNav({ tab: t, stack: [] }))

  const patch = (id, p) => {
    setNotes((a) => a.map((n) => (n.id === id ? { ...n, ...p, t: Date.now() } : n)))
    setSaved(true)
    clearTimeout(savedTimer.current)
    savedTimer.current = setTimeout(() => setSaved(false), 1200)
  }
  const patchQuiet = (id, p) => setNotes((a) => a.map((n) => (n.id === id ? { ...n, ...p } : n)))

  const newNote = (type = 'note') => {
    const id = `n${Date.now()}${seq.current++}`
    const f = folder === 'All' ? folders[0] || 'Personal' : folder
    setNotes((a) => [{ id, title: '', body: '', pin: false, folder: f, type, items: type === 'check' ? [] : undefined, t: Date.now() }, ...a])
    return id
  }
  const remove = (id) => {
    setNotes((a) => a.filter((n) => n.id !== id))
    if (checkId === id) setCheckId(null)
  }
  const back = () => {
    // leaving an untouched new note throws it away
    const n = notes.find((x) => x.id === top?.nid)
    if (n && n.type === 'note' && !n.title.trim() && !n.body.trim()) remove(n.id)
    setDir(-1)
    setConfirmDel(false)
    setNav((s) => ({ ...s, stack: s.stack.slice(0, -1) }))
  }
  const openNote = (n) => {
    if (n.type === 'check') {
      setCheckId(n.id)
      go('checklist')
    } else push({ id: 'editor', nid: n.id })
  }

  const sorted = [...notes].sort((a, b) => b.pin - a.pin || b.t - a.t)
  const inFolder = (n) => folder === 'All' || n.folder === folder
  const checks = sorted.filter((n) => n.type === 'check')

  // ---- shared bits
  const header = (title, onBack, right, sub) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px 6px', minHeight: 48 }}>
      {onBack && (
        <button type="button" onClick={onBack} aria-label="Back" style={{ ...iconBtn, width: 38, height: 38, boxShadow: `inset 0 0 0 1px ${LINE}` }}>
          <Icon name="back" size={20} />
        </button>
      )}
      <div style={{ flex: 1, marginLeft: 4 }}>
        <h1 style={{ margin: 0, fontFamily: serif, fontSize: onBack ? 19 : 30, fontWeight: 700, letterSpacing: '-0.01em' }}>{title}</h1>
        {sub && <div style={{ fontSize: 12.5, color: MUTED }}>{sub}</div>}
      </div>
      {right}
    </div>
  )

  const noteCard = (n, query = '') => {
    const done = n.items?.filter((i) => i.done).length || 0
    const snippet = n.type === 'check' ? (n.items.map((i) => i.t).join(' · ') || 'Empty checklist') : n.body || 'No additional text'
    return (
      <div key={n.id} style={{ position: 'relative', display: 'flex', background: CARD, border: `1px solid ${LINE}`, borderRadius: 18, overflow: 'hidden' }}>
        <span style={{ width: 5, background: n.pin ? accent : n.type === 'check' ? '#65a30d' : 'transparent' }} />
        <button type="button" onClick={() => openNote(n)} style={{ flex: 1, minWidth: 0, display: 'flex', gap: 10, alignItems: 'center', padding: '12px 8px 12px 12px', border: 'none', background: 'none', font: 'inherit', textAlign: 'left', cursor: 'pointer', color: INK }}>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontFamily: serif, fontSize: 16.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}><Hl text={n.title || 'Untitled'} q={query} /></span>
            <span style={{ display: 'block', fontSize: 13, color: MUTED, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}><Hl text={snippet} q={query} /></span>
            <span style={{ display: 'flex', gap: 8, fontSize: 11, color: MUTED, marginTop: 6, alignItems: 'center' }}>
              <span style={{ padding: '1px 8px', borderRadius: 8, background: '#f3ead0', fontWeight: 700 }}>{n.folder}</span>
              {rel(n.t)}
            </span>
          </span>
          {n.type === 'check' && <Ring done={done} total={n.items.length} size={40} color="#65a30d" />}
        </button>
        <button type="button" onClick={() => (patchQuiet(n.id, { pin: !n.pin }), say(n.pin ? 'Unpinned' : 'Pinned to top'))} aria-label={n.pin ? 'Unpin' : 'Pin'} aria-pressed={n.pin} style={{ ...iconBtn, background: 'none', width: 42, alignSelf: 'stretch', borderRadius: 0, color: n.pin ? accent : '#cfc4a8' }}>
          <Icon name="pin" size={18} fill={n.pin ? accent : 'none'} />
        </button>
      </div>
    )
  }

  // ---- screens
  let body
  let tabbed = true
  const cur = top?.id === 'editor' ? notes.find((n) => n.id === top.nid) : null
  if (cur) {
    tabbed = false
    const words = cur.body.trim() ? cur.body.trim().split(/\s+/).length : 0
    body = (
      <>
        {header('', back, (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: MUTED, minWidth: 50, textAlign: 'right' }}>{saved ? 'Saved ✓' : rel(cur.t)}</span>
            <button type="button" onClick={() => patch(cur.id, { pin: !cur.pin })} aria-label={cur.pin ? 'Unpin' : 'Pin'} aria-pressed={cur.pin} style={{ ...iconBtn, width: 38, height: 38, color: cur.pin ? accent : INK }}><Icon name="pin" size={18} fill={cur.pin ? accent : 'none'} /></button>
            <button type="button" onClick={() => { if (confirmDel) { remove(cur.id); setDir(-1); setNav((s) => ({ ...s, stack: s.stack.slice(0, -1) })); setConfirmDel(false); say('Note deleted') } else { setConfirmDel(true); say('Tap again to delete') } }} aria-label={confirmDel ? 'Confirm delete' : 'Delete'} style={{ ...iconBtn, width: confirmDel ? 74 : 38, height: 38, borderRadius: 19, background: confirmDel ? '#dc2626' : CARD, color: confirmDel ? '#fff' : INK, fontSize: 12, fontWeight: 700, gap: 4, gridAutoFlow: 'column', transition: 'width .2s' }}>
              <Icon name="trash" size={17} />{confirmDel && 'Delete?'}
            </button>
          </div>
        ))}
        <div style={{ padding: '4px 22px 0' }}>
          <input value={cur.title} onChange={(e) => patch(cur.id, { title: e.target.value })} placeholder="Title" aria-label="Note title" autoFocus={!cur.title && !cur.body} style={{ width: '100%', boxSizing: 'border-box', border: 'none', outline: 'none', background: 'none', fontFamily: serif, fontSize: 27, fontWeight: 700, color: INK, padding: '6px 0' }} />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '4px 0 8px' }}>
            {folders.map((f) => (
              <button key={f} type="button" aria-pressed={cur.folder === f} onClick={() => (patch(cur.id, { folder: f }), say(`Moved to ${f}`))} style={{ height: 28, padding: '0 12px', borderRadius: 14, border: 'none', background: cur.folder === f ? accent : '#f3ead0', color: cur.folder === f ? '#fff' : INK, font: 'inherit', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{f}</button>
            ))}
          </div>
          <div style={{ backgroundImage: `repeating-linear-gradient(transparent 0 27px, ${LINE} 27px 28px)`, borderRadius: 4 }}>
            <textarea value={cur.body} onChange={(e) => patch(cur.id, { body: e.target.value })} placeholder="Start writing…" aria-label="Note body" style={{ width: '100%', boxSizing: 'border-box', height: 400, resize: 'none', border: 'none', outline: 'none', background: 'none', font: 'inherit', fontSize: 16, lineHeight: '28px', color: INK, padding: 0 }} />
          </div>
          <div style={{ fontSize: 12, color: MUTED, paddingTop: 6 }}>{words} word{words === 1 ? '' : 's'} · {cur.body.length} characters</div>
        </div>
      </>
    )
  } else if (tab === 'notes') {
    const list = sorted.filter(inFolder)
    const pinned = list.filter((n) => n.pin)
    const rest = list.filter((n) => !n.pin)
    const sect = (label, arr) => arr.length > 0 && (
      <div style={{ display: 'grid', gap: 10 }}>
        <div style={{ fontSize: 11.5, fontWeight: 800, color: MUTED, textTransform: 'uppercase', letterSpacing: '.08em', margin: '6px 0 0' }}>{label}</div>
        {arr.map((n) => noteCard(n))}
      </div>
    )
    body = (
      <>
        {header(folder === 'All' ? name : folder, null, <div style={{ display: 'flex', gap: 6 }}><button type="button" onClick={() => (setCheckId(newNote('check')), go('checklist'), say('New checklist'))} aria-label="New checklist" style={{ ...iconBtn, width: 40, height: 40, boxShadow: `inset 0 0 0 1px ${LINE}` }}><Icon name="check" size={19} /></button></div>, `${list.length} note${list.length === 1 ? '' : 's'}`)}
        {folder !== 'All' && (
          <div style={{ padding: '0 20px 8px' }}>
            <button type="button" onClick={() => setFolder('All')} style={{ height: 30, padding: '0 12px', borderRadius: 15, border: 'none', background: INK, color: '#fff', font: 'inherit', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Folder: {folder} ✕</button>
          </div>
        )}
        <div style={{ display: 'grid', gap: 12, padding: '0 20px' }}>
          {sect('Pinned', pinned)}
          {sect(pinned.length ? 'Notes' : 'All notes', rest)}
          {!list.length && <div style={{ textAlign: 'center', color: MUTED, padding: '50px 0', fontSize: 14 }}>Nothing here yet.<br />Tap + to write your first note.</div>}
        </div>
      </>
    )
  } else if (tab === 'checklist') {
    const n = notes.find((x) => x.id === checkId && x.type === 'check') || null
    const done = n ? n.items.filter((i) => i.done).length : 0
    const addItem = () => {
      const t = newItem.trim()
      if (!t || !n) return
      patch(n.id, { items: [...n.items, { id: `i${Date.now()}`, t, done: false }] })
      setNewItem('')
    }
    body = (
      <>
        {header('Checklist', null, <button type="button" onClick={() => (setCheckId(newNote('check')), say('New checklist'))} aria-label="New checklist" style={{ ...iconBtn, width: 40, height: 40, background: accent, color: '#fff' }}><Icon name="plus" size={20} /></button>)}
        <div className="nt-scroll" style={{ display: 'flex', gap: 8, padding: '2px 20px 12px', overflowX: 'auto' }}>
          {checks.map((c) => (
            <button key={c.id} type="button" onClick={() => setCheckId(c.id)} aria-pressed={checkId === c.id} style={{ flex: 'none', height: 34, padding: '0 14px', borderRadius: 17, border: 'none', background: checkId === c.id ? INK : CARD, color: checkId === c.id ? '#fff' : INK, font: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: `inset 0 0 0 1px ${LINE}` }}>{c.title || 'Untitled'}</button>
          ))}
        </div>
        {n ? (
          <div style={{ margin: '0 20px', background: CARD, border: `1px solid ${LINE}`, borderRadius: 24, padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <Ring done={done} total={n.items.length} size={58} color="#65a30d" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <input value={n.title} onChange={(e) => patch(n.id, { title: e.target.value })} placeholder="Checklist name" aria-label="Checklist name" style={{ width: '100%', boxSizing: 'border-box', border: 'none', outline: 'none', background: 'none', fontFamily: serif, fontSize: 21, fontWeight: 700, color: INK, padding: 0 }} />
                <div style={{ fontSize: 12.5, color: MUTED }}>{n.items.length && done === n.items.length ? 'All done. Nice work!' : `${n.items.length - done} left`}</div>
              </div>
              <button type="button" onClick={() => (remove(n.id), say('Checklist deleted'))} aria-label="Delete checklist" style={{ ...iconBtn, width: 34, height: 34, background: 'none', color: MUTED }}><Icon name="trash" size={17} /></button>
            </div>
            <div style={{ marginTop: 12 }}>
              {n.items.map((i) => (
                <div key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: `1px solid ${LINE}` }}>
                  <button type="button" role="checkbox" aria-checked={i.done} aria-label={i.t} onClick={() => patch(n.id, { items: n.items.map((x) => (x.id === i.id ? { ...x, done: !x.done } : x)) })} style={{ width: 26, height: 26, borderRadius: 8, border: `2px solid ${i.done ? '#65a30d' : '#cfc4a8'}`, background: i.done ? '#65a30d' : 'none', color: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center', padding: 0, flex: 'none', transition: 'background .15s' }}>{i.done && <Icon name="check" size={16} w={3} />}</button>
                  <span style={{ flex: 1, fontSize: 15, color: i.done ? MUTED : INK, textDecoration: i.done ? 'line-through' : 'none' }}>{i.t}</span>
                  <button type="button" onClick={() => patch(n.id, { items: n.items.filter((x) => x.id !== i.id) })} aria-label={`Remove ${i.t}`} style={{ ...iconBtn, width: 28, height: 28, background: 'none', color: '#cfc4a8' }}><Icon name="x" size={15} /></button>
                </div>
              ))}
              <form onSubmit={(e) => (e.preventDefault(), addItem())} style={{ display: 'flex', gap: 8, paddingTop: 12, borderTop: `1px solid ${LINE}` }}>
                <input value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder="Add an item…" aria-label="New item" style={{ flex: 1, minWidth: 0, height: 42, borderRadius: 14, border: `1px solid ${LINE}`, background: PAPER, padding: '0 14px', font: 'inherit', fontSize: 14.5, color: INK, outline: 'none' }} />
                <button type="submit" disabled={!newItem.trim()} style={{ height: 42, padding: '0 16px', borderRadius: 14, border: 'none', background: newItem.trim() ? accent : '#e5dcc4', color: '#fff', font: 'inherit', fontWeight: 700, cursor: newItem.trim() ? 'pointer' : 'default' }}>Add</button>
              </form>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button type="button" disabled={!done} onClick={() => (patch(n.id, { items: n.items.filter((i) => !i.done) }), say('Cleared completed'))} style={{ flex: 1, height: 40, borderRadius: 20, border: 'none', background: done ? '#ecfccb' : '#f3ead0', color: done ? '#3f6212' : MUTED, font: 'inherit', fontSize: 13, fontWeight: 700, cursor: done ? 'pointer' : 'default' }}>Clear done ({done})</button>
              <button type="button" disabled={!n.items.length} onClick={() => patch(n.id, { items: n.items.map((i) => ({ ...i, done: false })) })} style={{ flex: 1, height: 40, borderRadius: 20, border: 'none', background: '#f3ead0', color: INK, font: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Uncheck all</button>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', color: MUTED, padding: '60px 30px', fontSize: 14 }}>No checklist selected.<br />
            <button type="button" onClick={() => setCheckId(newNote('check'))} style={{ marginTop: 14, height: 44, padding: '0 20px', borderRadius: 22, border: 'none', background: accent, color: '#fff', font: 'inherit', fontWeight: 700, cursor: 'pointer' }}>Start a checklist</button>
          </div>
        )}
      </>
    )
  } else if (tab === 'folders') {
    const addFolder = () => {
      const f = newFolder.trim()
      if (!f || folders.includes(f)) return say(f ? 'That folder exists' : 'Name the folder first')
      setFolders((a) => [...a, f])
      setNewFolder('')
      say(`Folder “${f}” created`)
    }
    const tiles = [['All', notes.length], ...folders.map((f) => [f, notes.filter((n) => n.folder === f).length])]
    body = (
      <>
        {header('Folders', null, null, `${folders.length} folders`)}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: '4px 20px' }}>
          {tiles.map(([f, c], i) => (
            <div key={f} style={{ position: 'relative' }}>
              <button type="button" onClick={() => (setFolder(f), go('notes'))} aria-label={`${f}, ${c} notes`} style={{ width: '100%', textAlign: 'left', border: `1px solid ${LINE}`, borderRadius: 22, padding: '14px 14px 12px', background: CARD, font: 'inherit', cursor: 'pointer', color: INK, boxShadow: folder === f ? `0 0 0 2px ${accent}` : 'none' }}>
                <svg width="56" height="44" viewBox="0 0 56 44" aria-hidden="true"><path d="M2 8a4 4 0 0 1 4-4h14l5 5h25a4 4 0 0 1 4 4v23a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4z" fill={`hsl(${(i * 47 + 36) % 360} 70% 72%)`} /><path d="M2 16h52v20a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4z" fill={`hsl(${(i * 47 + 36) % 360} 75% 62%)`} /></svg>
                <div style={{ fontFamily: serif, fontSize: 17, fontWeight: 700, marginTop: 6 }}>{f}</div>
                <div style={{ fontSize: 12.5, color: MUTED }}>{c} note{c === 1 ? '' : 's'}</div>
              </button>
              {f !== 'All' && !c && (
                <button type="button" onClick={() => (setFolders((a) => a.filter((x) => x !== f)), folder === f && setFolder('All'), say('Empty folder removed'))} aria-label={`Delete folder ${f}`} style={{ ...iconBtn, position: 'absolute', right: 8, top: 8, width: 28, height: 28, background: '#fee2e2', color: '#dc2626' }}><Icon name="x" size={14} /></button>
              )}
            </div>
          ))}
        </div>
        <form onSubmit={(e) => (e.preventDefault(), addFolder())} style={{ display: 'flex', gap: 8, padding: '16px 20px' }}>
          <input value={newFolder} onChange={(e) => setNewFolder(e.target.value)} placeholder="New folder name" aria-label="New folder name" style={{ flex: 1, minWidth: 0, height: 46, borderRadius: 16, border: `1px solid ${LINE}`, background: CARD, padding: '0 14px', font: 'inherit', fontSize: 14.5, color: INK, outline: 'none' }} />
          <button type="submit" style={{ height: 46, padding: '0 18px', borderRadius: 16, border: 'none', background: accent, color: '#fff', font: 'inherit', fontWeight: 700, cursor: 'pointer' }}>Add</button>
        </form>
      </>
    )
  } else {
    const s = q.trim().toLowerCase()
    const hits = s ? sorted.filter((n) => n.title.toLowerCase().includes(s) || n.body.toLowerCase().includes(s) || n.items?.some((i) => i.t.toLowerCase().includes(s))) : []
    const commit = (v) => v.trim() && setRecent((r) => [v.trim(), ...r.filter((x) => x.toLowerCase() !== v.trim().toLowerCase())].slice(0, 5))
    body = (
      <>
        {header('Search')}
        <form onSubmit={(e) => (e.preventDefault(), commit(q))} style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 20px 12px', height: 46, padding: '0 14px', borderRadius: 23, background: CARD, border: `1px solid ${LINE}` }}>
          <Icon name="search" size={18} color={MUTED} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search titles, text and items" aria-label="Search notes" style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'none', font: 'inherit', fontSize: 15, color: INK }} />
          {q && <button type="button" onClick={() => setQ('')} aria-label="Clear search" style={{ ...iconBtn, width: 26, height: 26, background: '#f3ead0' }}><Icon name="x" size={13} /></button>}
        </form>
        <div style={{ padding: '0 20px', display: 'grid', gap: 10 }}>
          {!s && (
            <>
              <div style={{ fontSize: 11.5, fontWeight: 800, color: MUTED, textTransform: 'uppercase', letterSpacing: '.08em' }}>Recent</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {recent.map((r) => <button key={r} type="button" onClick={() => setQ(r)} style={{ height: 34, padding: '0 14px', borderRadius: 17, border: `1px solid ${LINE}`, background: CARD, font: 'inherit', fontSize: 13, fontWeight: 600, color: INK, cursor: 'pointer' }}>{r}</button>)}
                {!recent.length && <span style={{ fontSize: 13, color: MUTED }}>No recent searches.</span>}
              </div>
              {!!recent.length && <button type="button" onClick={() => (setRecent([]), say('History cleared'))} style={{ justifySelf: 'start', border: 'none', background: 'none', padding: 0, color: accent, font: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Clear history</button>}
            </>
          )}
          {s && <div style={{ fontSize: 12.5, color: MUTED }}>{hits.length} result{hits.length === 1 ? '' : 's'} for “{q.trim()}”</div>}
          {s && hits.map((n) => {
            const at = n.body.toLowerCase().indexOf(s)
            const matchItem = n.items?.find((i) => i.t.toLowerCase().includes(s))
            const view = n.type === 'check' ? { ...n, body: '', items: matchItem ? [matchItem] : n.items } : { ...n, body: at > 30 ? `…${n.body.slice(at - 24)}` : n.body }
            return noteCard({ ...view, items: view.items }, q)
          })}
          {s && !hits.length && <div style={{ textAlign: 'center', color: MUTED, padding: '40px 0', fontSize: 14 }}>No notes match.</div>}
        </div>
      </>
    )
  }

  const showFab = tabbed && tab === 'notes'
  const phone = (
    <div style={{ position: 'relative', width: W, height: H, overflow: 'hidden', borderRadius: frame ? 46 : 0, background: PAPER, color: INK, fontFamily: "'Avenir Next', 'Segoe UI', system-ui, sans-serif" }}>
      <style>{`
        @keyframes nt-r { from { opacity: 0; transform: translateX(34px) } to { opacity: 1; transform: none } }
        @keyframes nt-l { from { opacity: 0; transform: translateX(-34px) } to { opacity: 1; transform: none } }
        .nt-scroll { scrollbar-width: none } .nt-scroll::-webkit-scrollbar { display: none }
        .nt-app button:focus-visible, .nt-app input:focus-visible, .nt-app textarea:focus-visible { outline: 2px solid ${accent}; outline-offset: 2px }
        @media (prefers-reduced-motion: reduce) { .nt-page { animation: none !important } .nt-app * { transition: none !important } }
      `}</style>
      <StatusBar frame={frame} />
      <div key={`${tab}/${stack.map((s) => s.id + (s.nid || '')).join('/')}`} className="nt-scroll nt-page" style={{ position: 'absolute', top: 54, bottom: tabbed ? 88 : 0, left: 0, right: 0, overflowY: 'auto', overflowX: 'hidden', paddingBottom: 90, animation: `${dir > 0 ? 'nt-r' : 'nt-l'} .28s ease` }}>
        {body}
      </div>
      {showFab && (
        <button type="button" onClick={() => push({ id: 'editor', nid: newNote() })} aria-label="New note" style={{ position: 'absolute', right: 22, bottom: 106, zIndex: 15, width: 58, height: 58, borderRadius: 20, border: 'none', background: accent, color: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center', boxShadow: `0 10px 22px ${accent}66` }}>
          <Icon name="plus" size={28} w={2.4} />
        </button>
      )}
      {tabbed && (
        <nav aria-label="Main" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 88, background: CARD, borderTop: `1px solid ${LINE}`, display: 'flex', justifyContent: 'space-around', padding: '10px 8px 0' }}>
          {NAV.map(([id, icon, label]) => (
            <button key={id} type="button" onClick={() => { if (id === 'notes' && tab === 'notes') setFolder('All'); go(id) }} aria-current={tab === id ? 'page' : undefined} style={{ border: 'none', background: 'none', font: 'inherit', cursor: 'pointer', display: 'grid', justifyItems: 'center', alignContent: 'start', gap: 3, width: 72, height: 54, fontSize: 11, fontWeight: 700, color: tab === id ? accent : MUTED }}>
              <Icon name={icon} size={23} />
              {label}
            </button>
          ))}
        </nav>
      )}
      <div role="status" style={{ position: 'absolute', left: '50%', top: 58, zIndex: 30, transform: `translate(-50%, ${toast ? 0 : -90}px)`, transition: 'transform .35s cubic-bezier(.2,.8,.2,1)', padding: '10px 16px', borderRadius: 20, background: INK, color: '#fff', fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap' }}>{toast}</div>
      <div style={{ position: 'absolute', left: '50%', bottom: 8, width: 140, height: 5, marginLeft: -70, borderRadius: 3, background: INK, opacity: 0.8, zIndex: 25 }} />
    </div>
  )

  return (
    <div ref={box} className="nt-app" style={{ position: 'relative', width: '100%', height: '100%', display: 'grid', placeItems: 'center', overflow: 'hidden', background: 'radial-gradient(ellipse at 50% 30%, #f6ecd0, #cdb98a 80%)', ...style }}>
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: `translate(-50%, -50%) scale(${scale})`, transformOrigin: 'center' }}>
        {frame ? (
          <div style={{ padding: 12, borderRadius: 58, background: 'linear-gradient(145deg, #4a4338, #1a1712 40%, #35302a)', boxShadow: '0 40px 80px rgba(60,40,10,.35), inset 0 0 0 2px #5b5446' }}>
            <div style={{ padding: 2, borderRadius: 48, background: '#000' }}>{phone}</div>
          </div>
        ) : (
          phone
        )}
      </div>
    </div>
  )
}
