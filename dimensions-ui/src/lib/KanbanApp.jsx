import { useEffect, useRef, useState } from 'react'

// A kanban board on a phone, as a click-through prototype, in a dark slate
// look. Five pages: Boards, Board, Card detail, Add card and Team. A board's
// columns scroll sideways (or jump from the column chips); cards can be dragged
// between columns (mouse anywhere on the card, touch from the grip) or moved
// with the Move to control in Card detail. Card detail edits the title,
// description, assignee, due date, checklist and labels live. Add card creates
// a card in the column you choose. Team lists members with their card counts;
// tap one to see their cards or filter the board by them. Pages slide in and
// out with a back stack. The phone scales to fit whatever box it is in.

const W = 390
const H = 844
const BG = '#12141c'
const SURF = '#1c202c'
const CARD = '#262b3a'
const LINE = '#333a4d'
const INK = '#eef0f7'
const MUTED = '#8b93a8'
const TODAY = '2026-11-14'

const MEMBERS = [
  { id: 'ana', name: 'Ana Ruiz', role: 'Design lead', hue: 330 },
  { id: 'ben', name: 'Ben Carter', role: 'iOS engineer', hue: 200 },
  { id: 'chi', name: 'Chidi Okoro', role: 'Backend engineer', hue: 40 },
  { id: 'dee', name: 'Dee Walsh', role: 'QA', hue: 150 },
  { id: 'eli', name: 'Eli Novak', role: 'Product manager', hue: 270 },
]

const LABELS = [
  { id: 'bug', name: 'Bug', color: '#ef5f67' },
  { id: 'feat', name: 'Feature', color: '#4c9aff' },
  { id: 'design', name: 'Design', color: '#d96bd0' },
  { id: 'ops', name: 'Ops', color: '#f2a93b' },
  { id: 'docs', name: 'Docs', color: '#3ec9a7' },
]

const COLS = [
  { id: 'todo', name: 'To do', color: '#8b93a8' },
  { id: 'doing', name: 'In progress', color: '#4c9aff' },
  { id: 'review', name: 'Review', color: '#f2a93b' },
  { id: 'done', name: 'Done', color: '#3ec9a7' },
]

const BOARDS0 = [
  { id: 'b1', name: 'Mobile launch', blurb: 'Ship v2.0 to the stores', color: '#4c9aff', art: 0 },
  { id: 'b2', name: 'Website redesign', blurb: 'New marketing site', color: '#d96bd0', art: 1 },
  { id: 'b3', name: 'Ops & support', blurb: 'Keep the lights on', color: '#f2a93b', art: 2 },
]

const ck = (...t) => t.map(([text, done], i) => ({ id: `k${i}`, text, done: !!done }))
const CARDS0 = [
  { id: 'c1', board: 'b1', col: 'todo', title: 'Write App Store listing', desc: 'Screenshots, subtitle and the keyword field. Check with marketing before submitting.', assignee: 'eli', due: '2026-11-20', labels: ['docs'], checklist: ck(['Draft subtitle'], ['Pick 6 screenshots'], ['Keywords']) },
  { id: 'c2', board: 'b1', col: 'todo', title: 'Dark mode for settings', desc: 'Settings screens still use hard-coded colours.', assignee: 'ben', due: '2026-11-22', labels: ['feat', 'design'], checklist: ck(['Audit colours', true], ['Swap tokens'], ['Snapshot tests']) },
  { id: 'c3', board: 'b1', col: 'doing', title: 'Fix crash on cold start', desc: 'Null session on first launch after update. Crash-free rate dropped to 98.2%.', assignee: 'ben', due: '2026-11-13', labels: ['bug'], checklist: ck(['Reproduce', true], ['Patch'], ['Ship hotfix']) },
  { id: 'c4', board: 'b1', col: 'doing', title: 'Push notification opt-in', desc: 'Soft prompt before the system dialog.', assignee: 'chi', due: '2026-11-18', labels: ['feat'], checklist: ck(['Copy review', true], ['Endpoint', true], ['Client flow']) },
  { id: 'c5', board: 'b1', col: 'review', title: 'Onboarding illustrations', desc: 'Three spot illustrations, exported as SVG.', assignee: 'ana', due: '2026-11-16', labels: ['design'], checklist: ck(['Sketch', true], ['Final art', true]) },
  { id: 'c6', board: 'b1', col: 'review', title: 'Rate limiter on /login', desc: '', assignee: 'chi', due: '2026-11-15', labels: ['ops'], checklist: [] },
  { id: 'c7', board: 'b1', col: 'done', title: 'Upgrade to React Native 0.76', desc: 'Done and merged to main.', assignee: 'ben', due: '2026-11-08', labels: ['ops'], checklist: ck(['Upgrade', true], ['Fix pods', true]) },
  { id: 'c8', board: 'b1', col: 'done', title: 'Beta feedback triage', desc: '', assignee: 'dee', due: '2026-11-10', labels: ['docs'], checklist: ck(['Sort 40 reports', true]) },
  { id: 'c9', board: 'b2', col: 'todo', title: 'Pricing page copy', desc: 'Three tiers, one FAQ block.', assignee: 'eli', due: '2026-11-24', labels: ['docs'], checklist: ck(['Tier names'], ['FAQ']) },
  { id: 'c10', board: 'b2', col: 'doing', title: 'Hero animation', desc: 'Loop under 3 seconds, respects reduced motion.', assignee: 'ana', due: '2026-11-19', labels: ['design', 'feat'], checklist: ck(['Storyboard', true], ['Build'], ['QA on Safari']) },
  { id: 'c11', board: 'b2', col: 'review', title: 'Navigation a11y pass', desc: 'Keyboard order and focus rings.', assignee: 'dee', due: '2026-11-14', labels: ['bug'], checklist: ck(['Tab order', true], ['Focus rings']) },
  { id: 'c12', board: 'b2', col: 'done', title: 'Pick CMS vendor', desc: '', assignee: 'chi', due: '2026-11-05', labels: ['ops'], checklist: [] },
  { id: 'c13', board: 'b3', col: 'todo', title: 'Rotate API keys', desc: 'Quarterly rotation for all vendors.', assignee: 'chi', due: '2026-11-30', labels: ['ops'], checklist: ck(['Stripe'], ['Mail'], ['Maps']) },
  { id: 'c14', board: 'b3', col: 'doing', title: 'Answer support backlog', desc: '23 open tickets older than 3 days.', assignee: 'dee', due: '2026-11-17', labels: ['docs'], checklist: ck(['Billing', true], ['Login'], ['Other']) },
]

const NAV = [
  ['boards', 'boards', 'Boards'],
  ['board', 'cols', 'Board'],
  ['add', 'plus', 'Add'],
  ['team', 'team', 'Team'],
]

const ICONS = {
  boards: 'M4 5h7v8H4zM13 5h7v5h-7zM13 12h7v7h-7zM4 15h7v4H4z',
  cols: 'M4 4h4v16H4zM10 4h4v10h-4zM16 4h4v13h-4z',
  plus: 'M12 5v14M5 12h14',
  team: 'M9 11a3.500 3.500 0 1 0 0-7 3.500 3.500 0 0 0 0 7zM2.500 20a6.500 6.500 0 0 1 13 0M16 4.500a3.500 3.500 0 0 1 0 6.500M18 14a6 6 0 0 1 3.500 6',
  back: 'M15 5l-7 7 7 7',
  chev: 'M9 5l7 7-7 7',
  check: 'M5 12l5 5 9-10',
  x: 'M6 6l12 12M18 6L6 18',
  trash: 'M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  list: 'M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2',
  move: 'M5 12h14m0 0l-5-5m5 5l-5 5',
  grip: 'M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01',
  msg: 'M4 5h16v11H9l-5 4z',
}

function Icon({ name, size = 20, color = 'currentColor', w = 1.9 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  )
}

function Avatar({ m, size = 26, ring }) {
  if (!m) return <span style={{ width: size, height: size, borderRadius: '50%', flex: 'none', display: 'inline-grid', placeItems: 'center', border: `1.5px dashed ${MUTED}`, color: MUTED, fontSize: size * 0.4 }}>?</span>
  return (
    <span title={m.name} style={{ width: size, height: size, borderRadius: '50%', display: 'inline-grid', placeItems: 'center', flex: 'none', background: `hsl(${m.hue} 55% 32%)`, color: `hsl(${m.hue} 80% 90%)`, fontWeight: 700, fontSize: size * 0.38, boxShadow: ring ? `0 0 0 2px ${ring}` : 'none' }}>
      {m.name.split(' ').map((s) => s[0]).join('')}
    </span>
  )
}

// Small inline drawings for the board covers.
function Cover({ art, color }) {
  const c2 = `${color}55`
  return (
    <svg viewBox="0 0 320 90" width="100%" height="90" preserveAspectRatio="xMidYMid slice" aria-hidden="true" style={{ display: 'block' }}>
      <rect width="320" height="90" fill={`${color}22`} />
      {art === 0 && (
        <>
          <rect x="196" y="12" width="46" height="84" rx="9" fill={color} opacity=".85" />
          <rect x="202" y="20" width="34" height="56" rx="4" fill="#12141c" />
          <rect x="250" y="30" width="38" height="70" rx="8" fill={c2} />
          <circle cx="40" cy="30" r="40" fill={c2} />
        </>
      )}
      {art === 1 && (
        <>
          <rect x="170" y="14" width="120" height="68" rx="8" fill={c2} />
          <rect x="178" y="22" width="60" height="8" rx="3" fill={color} />
          <rect x="178" y="38" width="104" height="5" rx="2" fill={color} opacity=".5" />
          <rect x="178" y="50" width="84" height="5" rx="2" fill={color} opacity=".5" />
          <circle cx="40" cy="60" r="44" fill={c2} />
        </>
      )}
      {art === 2 && (
        <>
          <circle cx="240" cy="45" r="30" fill="none" stroke={color} strokeWidth="10" opacity=".8" />
          <circle cx="240" cy="45" r="8" fill={color} />
          <path d="M240 8v14M240 68v14M203 45h14M263 45h14" stroke={color} strokeWidth="8" strokeLinecap="round" />
          <circle cx="50" cy="20" r="36" fill={c2} />
        </>
      )}
      {art > 2 && <circle cx="250" cy="45" r="40" fill={c2} />}
    </svg>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ padding: '0 18px 14px' }}>
      <div style={{ fontSize: 11.500, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 7 }}>{label}</div>
      {children}
    </div>
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
          <rect x="10" y="2.500" width="3" height="8.500" rx="1" />
          <rect x="15" y="0" width="3" height="11" rx="1" />
        </svg>
        <svg width="26" height="12" viewBox="0 0 26 12">
          <rect x="0.5" y="0.5" width="22" height="11" rx="3.500" fill="none" stroke={INK} opacity=".5" />
          <rect x="2.500" y="2.500" width="16" height="7" rx="2" fill={INK} />
          <rect x="23.500" y="4" width="2" height="4" rx="1" fill={INK} opacity=".5" />
        </svg>
      </span>
    </div>
  )
}

const fmtDue = (d) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '')
const COL_W = 276
const COL_GAP = 12

// ---------------------------------------------------------------- app

export default function KanbanApp({ name = 'Plank', accent = '#6c7bff', startScreen = 'boards', frame = true, style }) {
  const box = useRef()
  const phoneRef = useRef()
  const scroller = useRef()
  const toastTimer = useRef()
  const edgeTimer = useRef()
  const dragRef = useRef(null)
  const justDragged = useRef(false)
  const scaleRef = useRef(1)
  const [scale, setScale] = useState(1)
  const [tab, setTab] = useState(startScreen === 'card' ? 'board' : startScreen)
  const [stack, setStack] = useState(startScreen === 'card' ? [{ id: 'card', card: 'c3' }] : [])
  const [dir, setDir] = useState(1)
  const [toast, setToast] = useState('')
  const [boards, setBoards] = useState(BOARDS0)
  const [cards, setCards] = useState(CARDS0)
  const [boardId, setBoardId] = useState('b1')
  const [who, setWho] = useState(null) // member filter
  const [drag, setDrag] = useState(null) // { id, x, y, over }
  const [form, setForm] = useState({ title: '', desc: '', col: 'todo', assignee: null, labels: [] })
  const [newItem, setNewItem] = useState('')

  useEffect(() => {
    setTab(startScreen === 'card' ? 'board' : startScreen)
    setStack(startScreen === 'card' ? [{ id: 'card', card: 'c3' }] : [])
  }, [startScreen])

  useEffect(() => {
    const ro = new ResizeObserver(([e]) => {
      const fw = frame ? W + 28 : W
      const fh = frame ? H + 28 : H
      const s = Math.min(1.2, (e.contentRect.width - 24) / fw, (e.contentRect.height - 24) / fh)
      scaleRef.current = s
      setScale(s)
    })
    ro.observe(box.current)
    return () => ro.disconnect()
  }, [frame])

  const say = (t) => {
    setToast(t)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 2000)
  }
  useEffect(
    () => () => {
      clearTimeout(toastTimer.current)
      clearInterval(edgeTimer.current)
    },
    []
  )

  const top = stack[stack.length - 1]
  const push = (s) => (setDir(1), setStack((a) => [...a, s]))
  const pop = () => (setDir(-1), setStack((a) => a.slice(0, -1)))
  const go = (t) => (setDir(NAV.findIndex((n) => n[0] === t) >= NAV.findIndex((n) => n[0] === tab) ? 1 : -1), setTab(t), setStack([]))

  const board = boards.find((b) => b.id === boardId) || boards[0]
  const member = (id) => MEMBERS.find((m) => m.id === id)
  const colName = (id) => COLS.find((c) => c.id === id).name
  const upd = (id, patch) => setCards((a) => a.map((c) => (c.id === id ? { ...c, ...patch } : c)))

  const moveCard = (id, col, beforeId) => {
    setCards((a) => {
      const c = a.find((x) => x.id === id)
      if (!c) return a
      const rest = a.filter((x) => x.id !== id)
      const moved = { ...c, col }
      const at = beforeId ? rest.findIndex((x) => x.id === beforeId) : -1
      if (at < 0) return [...rest, moved]
      return [...rest.slice(0, at), moved, ...rest.slice(at)]
    })
  }

  // ---- drag between columns
  const stopEdge = () => (clearInterval(edgeTimer.current), (edgeTimer.current = null))
  const startPress = (e, c) => {
    if (e.button > 0) return
    if (e.pointerType !== 'mouse' && !e.target.closest('[data-grip]')) return
    const sx = e.clientX
    const sy = e.clientY
    let active = false
    const rect = () => phoneRef.current.getBoundingClientRect()
    const pos = (ev) => ({ x: (ev.clientX - rect().left) / scaleRef.current, y: (ev.clientY - rect().top) / scaleRef.current })
    const overOf = (ev) => {
      const els = document.elementsFromPoint(ev.clientX, ev.clientY)
      const colEl = els.find((n) => n.dataset && n.dataset.col)
      const cardEl = els.find((n) => n.dataset && n.dataset.card && n.dataset.card !== c.id)
      return { col: colEl ? colEl.dataset.col : null, before: cardEl && colEl && cardEl.dataset.cardcol === colEl.dataset.col ? cardEl.dataset.card : null }
    }
    const move = (ev) => {
      if (!active) {
        if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 6) return
        active = true
        justDragged.current = true
        edgeTimer.current = setInterval(() => {
          const d = dragRef.current
          if (!d || !scroller.current) return
          if (d.x < 44) scroller.current.scrollLeft -= 12
          else if (d.x > W - 44) scroller.current.scrollLeft += 12
        }, 16)
      }
      const p = pos(ev)
      const o = overOf(ev)
      dragRef.current = { id: c.id, ...p, over: o.col, before: o.before }
      setDrag(dragRef.current)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      stopEdge()
      const d = dragRef.current
      dragRef.current = null
      setDrag(null)
      if (active && d && d.over) {
        moveCard(c.id, d.over, d.before)
        if (d.over !== c.col) say(`Moved to ${colName(d.over)}`)
      }
      setTimeout(() => (justDragged.current = false), 0)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  const reduced = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const jumpCol = (i) => scroller.current && scroller.current.scrollTo({ left: i * (COL_W + COL_GAP), behavior: reduced ? 'auto' : 'smooth' })

  // ---- shared bits
  const header = (title, back, right, sub) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 18px 8px', minHeight: 52 }}>
      {back && (
        <button type="button" onClick={back} aria-label="Back" style={{ ...roundBtn, width: 38, height: 38 }}>
          <Icon name="back" size={20} />
        </button>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <h1 style={{ margin: 0, fontSize: back ? 18 : 27, fontWeight: 800, letterSpacing: '-0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</h1>
        {sub && <div style={{ fontSize: 12.500, color: MUTED, marginTop: 1 }}>{sub}</div>}
      </div>
      {right}
    </div>
  )

  const labelPill = (l) => (
    <span key={l.id} style={{ height: 8, width: 30, borderRadius: 4, background: l.color, display: 'inline-block' }} title={l.name} />
  )

  const cardView = (c, { ghost } = {}) => {
    const done = c.checklist.filter((k) => k.done).length
    const overdue = c.due && c.due < TODAY && c.col !== 'done'
    return (
      <div
        key={c.id}
        data-card={ghost ? undefined : c.id}
        data-cardcol={c.col}
        role={ghost ? undefined : 'button'}
        tabIndex={ghost ? -1 : 0}
        aria-label={ghost ? undefined : `Open ${c.title}`}
        onPointerDown={ghost ? undefined : (e) => startPress(e, c)}
        onClick={ghost ? undefined : () => !justDragged.current && push({ id: 'card', card: c.id })}
        onKeyDown={ghost ? undefined : (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), push({ id: 'card', card: c.id }))}
        style={{ position: 'relative', padding: '11px 12px 10px', borderRadius: 14, background: CARD, border: `1px solid ${LINE}`, cursor: ghost ? 'grabbing' : 'grab', userSelect: 'none', WebkitUserSelect: 'none', opacity: !ghost && drag && drag.id === c.id ? 0.3 : 1, boxShadow: ghost ? '0 18px 32px rgba(0,0,0,.5)' : 'none', width: ghost ? COL_W - 24 : 'auto', boxSizing: ghost ? 'border-box' : undefined }}
      >
        {c.labels.length > 0 && <div style={{ display: 'flex', gap: 5, marginBottom: 8, flexWrap: 'wrap' }}>{c.labels.map((id) => labelPill(LABELS.find((l) => l.id === id)))}</div>}
        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
          <div style={{ flex: 1, fontSize: 14, fontWeight: 600, lineHeight: 1.3 }}>{c.title}</div>
          <span data-grip="1" style={{ touchAction: 'none', margin: '-6px -6px 0 0', padding: 6, color: MUTED, display: 'grid' }} aria-hidden="true">
            <Icon name="grip" size={16} w={3} />
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, fontSize: 11.500, color: MUTED }}>
          {c.due && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: overdue ? '#ff8b8b' : MUTED, fontWeight: overdue ? 700 : 500 }}>
              <Icon name="clock" size={13} /> {fmtDue(c.due)}
            </span>
          )}
          {c.checklist.length > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: done === c.checklist.length ? '#5fdcb8' : MUTED }}>
              <Icon name="list" size={13} /> {done}/{c.checklist.length}
            </span>
          )}
          {c.desc && <Icon name="msg" size={13} />}
          <span style={{ flex: 1 }} />
          <Avatar m={member(c.assignee)} size={24} />
        </div>
      </div>
    )
  }

  const memberPicker = (value, set) => (
    <div className="kb-scroll" style={{ display: 'flex', gap: 8, overflowX: 'auto' }} role="group" aria-label="Assignee">
      {[null, ...MEMBERS].map((m) => (
        <button key={m ? m.id : 'none'} type="button" onClick={() => set(m ? m.id : null)} aria-pressed={value === (m ? m.id : null)} style={{ ...chip(value === (m ? m.id : null), accent), flex: 'none', display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 6 }}>
          <Avatar m={m} size={22} />
          {m ? m.name.split(' ')[0] : 'Nobody'}
        </button>
      ))}
    </div>
  )

  const labelPicker = (value, set) => (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }} role="group" aria-label="Labels">
      {LABELS.map((l) => {
        const on = value.includes(l.id)
        return (
          <button key={l.id} type="button" onClick={() => set(on ? value.filter((x) => x !== l.id) : [...value, l.id])} aria-pressed={on} style={{ height: 34, padding: '0 13px 0 10px', borderRadius: 17, border: `1.5px solid ${on ? l.color : LINE}`, background: on ? `${l.color}30` : 'transparent', color: INK, font: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}>
            <i style={{ width: 10, height: 10, borderRadius: 3, background: l.color }} />
            {l.name}
          </button>
        )
      })}
    </div>
  )

  const colPicker = (value, set, count) => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }} role="group" aria-label="Column">
      {COLS.map((c) => (
        <button key={c.id} type="button" onClick={() => set(c.id)} aria-pressed={value === c.id} style={{ ...chip(value === c.id, c.color), display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
          <i style={{ width: 9, height: 9, borderRadius: '50%', background: c.color }} />
          {c.name}
          {count && <span style={{ color: MUTED, fontSize: 12 }}>{count(c.id)}</span>}
        </button>
      ))}
    </div>
  )

  // ---- screens
  let body
  let tabbed = true
  let fill = false
  const boardCards = cards.filter((c) => c.board === board.id)
  const shown = boardCards.filter((c) => !who || c.assignee === who)

  if (top?.id === 'card') {
    tabbed = false
    const c = cards.find((x) => x.id === top.card)
    if (!c) {
      body = <>{header('Card', pop)}</>
    } else {
      const done = c.checklist.filter((k) => k.done).length
      const bd = boards.find((b) => b.id === c.board)
      body = (
        <>
          {header('Card detail', pop, <button type="button" onClick={() => (setCards((a) => a.filter((x) => x.id !== c.id)), pop(), say('Card deleted'))} aria-label="Delete card" style={{ ...roundBtn, width: 38, height: 38, color: '#ff8b8b' }}><Icon name="trash" size={18} /></button>, `${bd.name} · ${colName(c.col)}`)}
          <div style={{ padding: '4px 18px 14px' }}>
            <input value={c.title} onChange={(e) => upd(c.id, { title: e.target.value })} aria-label="Title" style={{ ...input, fontSize: 19, fontWeight: 800, height: 50 }} />
          </div>
          <Field label="Move to">{colPicker(c.col, (id) => (moveCard(c.id, id), id !== c.col && say(`Moved to ${colName(id)}`)))}</Field>
          <Field label="Description">
            <textarea value={c.desc} onChange={(e) => upd(c.id, { desc: e.target.value })} placeholder="Add a description" aria-label="Description" rows={3} style={{ ...input, height: 'auto', padding: '10px 14px', resize: 'none', lineHeight: 1.4 }} />
          </Field>
          <Field label="Assignee">{memberPicker(c.assignee, (id) => upd(c.id, { assignee: id }))}</Field>
          <Field label="Due date">
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="date" value={c.due || ''} onChange={(e) => upd(c.id, { due: e.target.value })} aria-label="Due date" style={{ ...input, flex: 1, colorScheme: 'dark' }} />
              <button type="button" onClick={() => (upd(c.id, { due: '' }), say('Due date cleared'))} style={{ ...chip(false, accent), height: 44 }}>Clear</button>
            </div>
          </Field>
          <Field label="Labels">{labelPicker(c.labels, (l) => upd(c.id, { labels: l }))}</Field>
          <Field label={`Checklist${c.checklist.length ? ` · ${done}/${c.checklist.length}` : ''}`}>
            {c.checklist.length > 0 && (
              <div style={{ height: 6, borderRadius: 3, background: LINE, marginBottom: 10, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(done / c.checklist.length) * 100}%`, background: '#3ec9a7', transition: 'width .3s' }} />
              </div>
            )}
            <div style={{ display: 'grid', gap: 6 }}>
              {c.checklist.map((k) => (
                <div key={k.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 12, background: SURF }}>
                  <button type="button" role="checkbox" aria-checked={k.done} aria-label={k.text} onClick={() => upd(c.id, { checklist: c.checklist.map((x) => (x.id === k.id ? { ...x, done: !x.done } : x)) })} style={{ width: 24, height: 24, borderRadius: 8, border: `2px solid ${k.done ? '#3ec9a7' : MUTED}`, background: k.done ? '#3ec9a7' : 'transparent', color: '#0e2a22', display: 'grid', placeItems: 'center', padding: 0, cursor: 'pointer', flex: 'none' }}>
                    {k.done && <Icon name="check" size={15} w={3} />}
                  </button>
                  <span style={{ flex: 1, fontSize: 14, textDecoration: k.done ? 'line-through' : 'none', color: k.done ? MUTED : INK }}>{k.text}</span>
                  <button type="button" onClick={() => upd(c.id, { checklist: c.checklist.filter((x) => x.id !== k.id) })} aria-label={`Remove ${k.text}`} style={{ ...roundBtn, width: 28, height: 28, color: MUTED }}><Icon name="x" size={15} /></button>
                </div>
              ))}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (!newItem.trim()) return
                upd(c.id, { checklist: [...c.checklist, { id: `k${Date.now()}`, text: newItem.trim(), done: false }] })
                setNewItem('')
              }}
              style={{ display: 'flex', gap: 8, marginTop: 8 }}
            >
              <input value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder="Add an item" aria-label="New checklist item" style={{ ...input, flex: 1 }} />
              <button type="submit" style={{ ...chip(true, accent, true), height: 44, width: 60, color: '#fff' }}>Add</button>
            </form>
          </Field>
        </>
      )
    }
  } else if (top?.id === 'member') {
    tabbed = false
    const m = member(top.member)
    const list = cards.filter((c) => c.assignee === m.id)
    body = (
      <>
        {header(m.name, pop, null, m.role)}
        <div style={{ display: 'flex', gap: 8, padding: '4px 18px 0' }}>
          <button type="button" onClick={() => (setWho(m.id), go('board'), say(`Board filtered to ${m.name.split(' ')[0]}`))} style={{ ...chip(true, accent, true), flex: 1, height: 44, color: '#fff' }}>Filter board</button>
          <button type="button" onClick={() => (setForm((f) => ({ ...f, assignee: m.id })), go('add'))} style={{ ...chip(false, accent), flex: 1, height: 44 }}>Assign new card</button>
        </div>
        <div style={{ display: 'grid', gap: 8, padding: '16px 18px 0' }}>
          {list.map((c) => (
            <button key={c.id} type="button" onClick={() => push({ id: 'card', card: c.id })} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 14, border: `1px solid ${LINE}`, background: CARD, color: INK, font: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
              <i style={{ width: 8, height: 36, borderRadius: 4, background: COLS.find((x) => x.id === c.col).color, flex: 'none' }} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 14, fontWeight: 600 }}>{c.title}</span>
                <span style={{ display: 'block', fontSize: 12, color: MUTED, marginTop: 2 }}>{boards.find((b) => b.id === c.board).name} · {colName(c.col)}</span>
              </span>
              <Icon name="chev" size={16} color={MUTED} />
            </button>
          ))}
          {!list.length && <div style={{ textAlign: 'center', color: MUTED, fontSize: 13, padding: '30px 0' }}>No cards assigned.</div>}
        </div>
      </>
    )
  } else if (tab === 'boards') {
    body = (
      <>
        {header('Boards', null, <span style={{ fontSize: 12.500, color: MUTED, fontWeight: 600 }}>{name}</span>)}
        <div style={{ display: 'grid', gap: 14, padding: '6px 18px 0' }}>
          {boards.map((b) => {
            const bc = cards.filter((c) => c.board === b.id)
            const dn = bc.filter((c) => c.col === 'done').length
            return (
              <button key={b.id} type="button" onClick={() => (setBoardId(b.id), setWho(null), go('board'))} style={{ display: 'block', padding: 0, border: `1px solid ${LINE}`, borderRadius: 22, overflow: 'hidden', background: SURF, color: INK, font: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
                <Cover art={b.art} color={b.color} />
                <span style={{ display: 'block', padding: '12px 16px 14px' }}>
                  <span style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 17, fontWeight: 800 }}>{b.name}</span>
                    <span style={{ fontSize: 12, color: MUTED }}>{bc.length} cards</span>
                  </span>
                  <span style={{ display: 'block', fontSize: 12.500, color: MUTED, marginTop: 2 }}>{b.blurb}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
                    <span style={{ flex: 1, height: 6, borderRadius: 3, background: LINE, overflow: 'hidden' }}>
                      <span style={{ display: 'block', height: '100%', width: `${bc.length ? (dn / bc.length) * 100 : 0}%`, background: b.color, transition: 'width .4s' }} />
                    </span>
                    <span style={{ fontSize: 11.500, color: MUTED, fontWeight: 600 }}>{dn}/{bc.length} done</span>
                  </span>
                </span>
              </button>
            )
          })}
          <button type="button" onClick={() => { const n = boards.length + 1; const nb = { id: `b${Date.now()}`, name: `Untitled board ${n}`, blurb: 'A fresh board', color: ['#3ec9a7', '#ef5f67', '#a78bfa'][n % 3], art: 3 }; setBoards((a) => [...a, nb]); say('Board created') }} style={{ height: 56, borderRadius: 20, border: `2px dashed ${LINE}`, background: 'none', color: MUTED, font: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>+ New board</button>
        </div>
      </>
    )
  } else if (tab === 'board') {
    fill = true
    body = (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {header(board.name, () => go('boards'), <span style={{ fontSize: 12, color: MUTED, fontWeight: 600 }}>{shown.length} cards</span>)}
        <div className="kb-scroll" style={{ display: 'flex', gap: 8, padding: '0 18px 8px', overflowX: 'auto', flex: 'none' }} role="group" aria-label="Filter by member">
          <button type="button" onClick={() => setWho(null)} aria-pressed={!who} style={{ ...chip(!who, accent), flex: 'none', height: 34 }}>Everyone</button>
          {MEMBERS.map((m) => (
            <button key={m.id} type="button" onClick={() => setWho(who === m.id ? null : m.id)} aria-pressed={who === m.id} aria-label={m.name} style={{ ...chip(who === m.id, accent), flex: 'none', height: 34, display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 5 }}>
              <Avatar m={m} size={22} />
              {m.name.split(' ')[0]}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6, padding: '0 18px 10px', flex: 'none' }}>
          {COLS.map((c, i) => (
            <button key={c.id} type="button" onClick={() => jumpCol(i)} style={{ flex: 1, height: 26, border: 'none', borderRadius: 8, background: 'transparent', color: MUTED, font: 'inherit', fontSize: 11, fontWeight: 700, cursor: 'pointer', borderBottom: `3px solid ${c.color}`, padding: 0 }}>
              {c.name} {shown.filter((x) => x.col === c.id).length}
            </button>
          ))}
        </div>
        <div ref={scroller} className="kb-scroll" style={{ flex: 1, minHeight: 0, display: 'flex', gap: COL_GAP, padding: '0 18px', overflowX: 'auto', scrollSnapType: drag ? 'none' : 'x proximity', scrollPaddingLeft: 18 }}>
          {COLS.map((col) => {
            const list = shown.filter((c) => c.col === col.id)
            const over = drag && drag.over === col.id
            return (
              <section key={col.id} data-col={col.id} aria-label={col.name} style={{ flex: 'none', width: COL_W, scrollSnapAlign: 'start', display: 'flex', flexDirection: 'column', borderRadius: 18, background: SURF, border: `1.5px solid ${over ? col.color : 'transparent'}`, maxHeight: '100%', transition: 'border-color .15s' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px 8px', flex: 'none' }}>
                  <i style={{ width: 10, height: 10, borderRadius: '50%', background: col.color }} />
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 800 }}>{col.name}</span>
                  <span style={{ fontSize: 12, color: MUTED, fontWeight: 700 }}>{list.length}</span>
                  <button type="button" onClick={() => (setForm((f) => ({ ...f, col: col.id })), go('add'))} aria-label={`Add card to ${col.name}`} style={{ ...roundBtn, width: 28, height: 28 }}><Icon name="plus" size={16} /></button>
                </div>
                <div className="kb-scroll" style={{ display: 'grid', gap: 8, alignContent: 'start', padding: '0 10px 12px', overflowY: drag ? 'hidden' : 'auto', minHeight: 60 }}>
                  {list.map((c) => cardView(c))}
                  {!list.length && <div style={{ textAlign: 'center', color: MUTED, fontSize: 12.500, padding: '22px 0', border: `1.5px dashed ${LINE}`, borderRadius: 12 }}>{drag ? 'Drop here' : 'No cards'}</div>}
                </div>
              </section>
            )
          })}
          <span style={{ flex: 'none', width: 6 }} />
        </div>
      </div>
    )
  } else if (tab === 'add') {
    const ok = form.title.trim().length > 0
    body = (
      <>
        {header('Add card', null, null, `to ${board.name}`)}
        <Field label="Title">
          <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="What needs doing?" aria-label="Title" maxLength={70} style={input} />
        </Field>
        <Field label="Column">{colPicker(form.col, (id) => setForm((f) => ({ ...f, col: id })), (id) => boardCards.filter((c) => c.col === id).length)}</Field>
        <Field label="Description">
          <textarea value={form.desc} onChange={(e) => setForm((f) => ({ ...f, desc: e.target.value }))} placeholder="Optional details" aria-label="Description" rows={2} style={{ ...input, height: 'auto', padding: '10px 14px', resize: 'none' }} />
        </Field>
        <Field label="Assignee">{memberPicker(form.assignee, (id) => setForm((f) => ({ ...f, assignee: id })))}</Field>
        <Field label="Labels">{labelPicker(form.labels, (l) => setForm((f) => ({ ...f, labels: l })))}</Field>
        <div style={{ padding: '0 18px' }}>
          <button
            type="button"
            disabled={!ok}
            onClick={() => {
              const c = { id: `c${Date.now()}`, board: board.id, col: form.col, title: form.title.trim(), desc: form.desc.trim(), assignee: form.assignee, due: '', labels: form.labels, checklist: [] }
              setCards((a) => [...a, c])
              setForm({ title: '', desc: '', col: form.col, assignee: null, labels: [] })
              setWho(null)
              say(`Card added to ${colName(c.col)}`)
              go('board')
              setTimeout(() => jumpCol(COLS.findIndex((x) => x.id === c.col)), 60)
            }}
            style={{ width: '100%', height: 52, borderRadius: 26, border: 'none', background: ok ? accent : LINE, color: ok ? '#fff' : MUTED, font: 'inherit', fontSize: 15, fontWeight: 800, cursor: ok ? 'pointer' : 'default' }}
          >
            Create card
          </button>
        </div>
      </>
    )
  } else {
    body = (
      <>
        {header('Team', null, null, `${MEMBERS.length} members · ${cards.length} cards`)}
        <div style={{ display: 'grid', gap: 10, padding: '6px 18px 0' }}>
          {MEMBERS.map((m) => {
            const mine = cards.filter((c) => c.assignee === m.id)
            const open = mine.filter((c) => c.col !== 'done').length
            return (
              <button key={m.id} type="button" onClick={() => push({ id: 'member', member: m.id })} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px', borderRadius: 18, border: `1px solid ${LINE}`, background: SURF, color: INK, font: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
                <Avatar m={m} size={46} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 15, fontWeight: 700 }}>{m.name}</span>
                  <span style={{ display: 'block', fontSize: 12, color: MUTED, marginTop: 1 }}>{m.role}</span>
                  <span style={{ display: 'flex', gap: 3, marginTop: 7 }}>
                    {COLS.map((c) => (
                      <i key={c.id} title={c.name} style={{ flex: Math.max(0, mine.filter((x) => x.col === c.id).length) || 0.0001, height: 5, borderRadius: 3, background: c.color, minWidth: mine.some((x) => x.col === c.id) ? 6 : 0 }} />
                    ))}
                  </span>
                </span>
                <span style={{ textAlign: 'right' }}>
                  <span style={{ display: 'block', fontSize: 22, fontWeight: 800 }}>{mine.length}</span>
                  <span style={{ display: 'block', fontSize: 11, color: MUTED }}>{open} open</span>
                </span>
              </button>
            )
          })}
          {cards.some((c) => !c.assignee) && (
            <div style={{ textAlign: 'center', fontSize: 12.500, color: MUTED, padding: '6px 0' }}>{cards.filter((c) => !c.assignee).length} cards are unassigned</div>
          )}
        </div>
      </>
    )
  }

  const dragCard = drag && cards.find((c) => c.id === drag.id)

  const phone = (
    <div ref={phoneRef} style={{ position: 'relative', width: W, height: H, overflow: 'hidden', borderRadius: frame ? 46 : 0, background: BG, color: INK, fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>
      <style>{`
        @keyframes kb-r { from { opacity: 0; transform: translateX(34px) } to { opacity: 1; transform: none } }
        @keyframes kb-l { from { opacity: 0; transform: translateX(-34px) } to { opacity: 1; transform: none } }
        .kb-scroll { scrollbar-width: none } .kb-scroll::-webkit-scrollbar { display: none }
        .kb-app button:focus-visible, .kb-app input:focus-visible, .kb-app textarea:focus-visible, .kb-app [role=button]:focus-visible { outline: 2px solid ${accent}; outline-offset: 2px }
        .kb-app input::placeholder, .kb-app textarea::placeholder { color: ${MUTED} }
        @media (prefers-reduced-motion: reduce) { .kb-page { animation: none !important } .kb-app * { transition: none !important } }
      `}</style>
      <StatusBar frame={frame} />
      <div key={`${tab}/${stack.map((s) => s.id).join('/')}`} className="kb-scroll kb-page" style={{ position: 'absolute', top: 54, bottom: tabbed ? 84 : 0, left: 0, right: 0, overflowY: fill ? 'hidden' : 'auto', paddingBottom: fill ? 0 : 28, animation: `${dir > 0 ? 'kb-r' : 'kb-l'} .28s ease` }}>
        {body}
      </div>
      {tabbed && (
        <nav aria-label="Main" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 84, background: SURF, borderTop: `1px solid ${LINE}`, display: 'flex', justifyContent: 'space-around', padding: '8px 8px 0' }}>
          {NAV.map(([id, icon, label]) => (
            <button key={id} type="button" onClick={() => go(id)} aria-current={tab === id ? 'page' : undefined} style={{ border: 'none', background: 'none', font: 'inherit', cursor: 'pointer', display: 'grid', justifyItems: 'center', alignContent: 'start', gap: 3, width: 72, height: 54, fontSize: 11, fontWeight: 700, color: tab === id ? accent : MUTED }}>
              <span style={{ width: 46, height: 28, borderRadius: 14, display: 'grid', placeItems: 'center', background: tab === id ? `${accent}30` : 'transparent', transition: 'background .2s' }}>
                <Icon name={icon} size={22} />
              </span>
              {label}
            </button>
          ))}
        </nav>
      )}
      {drag && dragCard && (
        <div style={{ position: 'absolute', left: 0, top: 0, zIndex: 40, pointerEvents: 'none', transform: `translate(${drag.x - (COL_W - 24) / 2}px, ${drag.y - 24}px) rotate(3deg)` }}>{cardView(dragCard, { ghost: true })}</div>
      )}
      <div role="status" style={{ position: 'absolute', left: '50%', top: 58, zIndex: 50, transform: `translate(-50%, ${toast ? 0 : -90}px)`, transition: 'transform .35s cubic-bezier(.2,.8,.2,1)', padding: '10px 16px', borderRadius: 20, background: INK, color: BG, fontSize: 12.500, fontWeight: 700, whiteSpace: 'nowrap' }}>{toast}</div>
      <div style={{ position: 'absolute', left: '50%', bottom: 8, width: 140, height: 5, marginLeft: -70, borderRadius: 3, background: INK, opacity: 0.7, zIndex: 25 }} />
    </div>
  )

  return (
    <div ref={box} className="kb-app" style={{ position: 'relative', width: '100%', height: '100%', display: 'grid', placeItems: 'center', overflow: 'hidden', background: 'radial-gradient(ellipse at 50% 30%, #2a3050, #0c0e15 75%)', ...style }}>
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: `translate(-50%, -50%) scale(${scale})`, transformOrigin: 'center' }}>
        {frame ? (
          <div style={{ padding: 12, borderRadius: 58, background: 'linear-gradient(145deg, #3a3f4a, #14171d 40%, #2b2f38)', boxShadow: '0 40px 80px rgba(0,0,0,.55), inset 0 0 0 2px #4b515e' }}>
            <div style={{ padding: 2, borderRadius: 48, background: '#000' }}>{phone}</div>
          </div>
        ) : (
          phone
        )}
      </div>
    </div>
  )
}

const roundBtn = { display: 'grid', placeItems: 'center', border: `1px solid ${LINE}`, borderRadius: '50%', cursor: 'pointer', padding: 0, background: SURF, color: INK, flex: 'none' }
const input = { width: '100%', boxSizing: 'border-box', height: 44, padding: '0 14px', borderRadius: 12, border: `1px solid ${LINE}`, background: SURF, color: INK, font: 'inherit', fontSize: 14 }
const chip = (on, c, solid) => ({ height: 40, padding: '0 14px', borderRadius: 20, border: `1.5px solid ${on ? c : LINE}`, background: on ? (solid ? c : `${c}33`) : 'transparent', color: INK, font: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer' })
