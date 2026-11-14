import { useEffect, useRef, useState } from 'react'

// A calendar on a phone, as a click-through prototype. Pages: Day, Week, Event
// detail, New event and Settings. The Day view is a real hour grid: drag an
// event up or down to move it, drag the handle on its bottom edge to resize it
// (both snap to 15 minutes), overlapping events are packed into side-by-side
// columns and re-laid out live while you drag, a red line tracks the current
// time, and tapping an empty slot starts a new event at that time. The Week
// view shows the same events as mini blocks (tap a block to open it, tap a day
// header to jump to it). Event detail edits title, date, times, colour and
// location, or deletes. Settings change the first day of the week and 12/24h
// time everywhere. startScreen: day, week, event, new or settings.

const W = 390
const H = 844
const INK = '#1b2230'
const MUTED = '#7a8394'
const LINE = '#e6e9ef'
const NOW = '#ef4444'
const HR = 56 // px per hour in the day grid
const WHR = 30 // px per hour in the week grid
const TAB = 82

const COLORS = ['#4f46e5', '#e11d48', '#d97706', '#059669', '#0284c7', '#9333ea']
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const pad = (n) => String(n).padStart(2, '0')
const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const parseKey = (k) => {
  const [y, m, d] = k.split('-').map(Number)
  return new Date(y, m - 1, d)
}
const addDays = (d, n) => {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}
const weekStart = (d, first) => addDays(d, -((d.getDay() - first + 7) % 7))
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

function fmt(m, h24, short) {
  const h = Math.floor(m / 60) % 24
  const mm = m % 60
  if (h24) return `${pad(h)}:${pad(mm)}`
  const base = `${h % 12 || 12}${short && !mm ? '' : `:${pad(mm)}`}`
  return short && !mm ? `${base} ${h < 12 ? 'AM' : 'PM'}` : `${base} ${h < 12 ? 'AM' : 'PM'}`
}
const hourLabel = (h, h24) => (h24 ? `${pad(h % 24)}:00` : `${h % 12 || 12} ${h % 24 < 12 ? 'AM' : 'PM'}`)

function seedEvents() {
  const t = new Date()
  const k = (n) => keyOf(addDays(t, n))
  return [
    { id: 'e1', title: 'Team standup', day: k(0), start: 540, end: 570, color: COLORS[4], loc: 'Zoom' },
    { id: 'e2', title: 'Design review', day: k(0), start: 555, end: 645, color: COLORS[5], loc: 'Studio B' },
    { id: 'e3', title: 'Lunch with Sam', day: k(0), start: 750, end: 810, color: COLORS[2], loc: 'Café Lumen' },
    { id: 'e4', title: 'Focus time', day: k(0), start: 840, end: 960, color: COLORS[0], loc: '' },
    { id: 'e5', title: '1:1 with Priya', day: k(0), start: 900, end: 945, color: COLORS[3], loc: 'Room 4' },
    { id: 'e6', title: 'Gym', day: k(0), start: 1050, end: 1110, color: COLORS[1], loc: 'Eastside Fitness' },
    { id: 'e7', title: 'Dentist', day: k(1), start: 600, end: 660, color: COLORS[1], loc: '12 Park Lane' },
    { id: 'e8', title: 'Sprint planning', day: k(1), start: 780, end: 900, color: COLORS[0], loc: 'Zoom' },
    { id: 'e9', title: 'Book club', day: k(2), start: 1140, end: 1230, color: COLORS[5], loc: 'Wren Books' },
    { id: 'e10', title: 'Coffee with Ana', day: k(-1), start: 510, end: 555, color: COLORS[2], loc: '' },
    { id: 'e11', title: 'Quarterly review', day: k(-1), start: 840, end: 960, color: COLORS[4], loc: 'Boardroom' },
    { id: 'e12', title: 'Hike', day: k(3), start: 480, end: 720, color: COLORS[3], loc: 'Ridge trail' },
    { id: 'e13', title: 'Movie night', day: k(3), start: 1170, end: 1290, color: COLORS[1], loc: 'Rialto' },
  ]
}

// pack overlapping events into columns: { id: { col, cols } }
function layout(list) {
  const res = {}
  const s = [...list].sort((a, b) => a.start - b.start || b.end - a.end)
  let cluster = []
  let cEnd = -1
  const flush = () => {
    if (!cluster.length) return
    const ends = []
    cluster.forEach((e) => {
      let c = ends.findIndex((x) => x <= e.start)
      if (c < 0) {
        c = ends.length
        ends.push(e.end)
      } else ends[c] = e.end
      res[e.id] = { col: c }
    })
    cluster.forEach((e) => (res[e.id].cols = ends.length))
    cluster = []
  }
  s.forEach((e) => {
    if (e.start >= cEnd) {
      flush()
      cEnd = e.end
    } else cEnd = Math.max(cEnd, e.end)
    cluster.push(e)
  })
  flush()
  return res
}

const ICONS = {
  day: 'M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM4 9h16M9 13h6',
  week: 'M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM4 9h16M9 9v11M15 9v11',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3 1a7 7 0 0 0-2.1-1.2L14 3h-4l-.5 2.7A7 7 0 0 0 7.4 7l-2.3-1-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 2.1 1.2L10 21h4l.5-2.7a7 7 0 0 0 2.1-1.2l2.3 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z',
  plus: 'M12 5v14M5 12h14',
  back: 'M15 5l-7 7 7 7',
  chev: 'M9 5l7 7-7 7',
  trash: 'M5 7h14M10 4h4M7 7l1 13h8l1-13',
  pin: 'M12 21s-6-5.6-6-11a6 6 0 0 1 12 0c0 5.4-6 11-6 11zM12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  check: 'M5 12l5 5 9-10',
  minus: 'M5 12h14',
}
function Icon({ name, size = 22, color = 'currentColor', w = 1.9 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
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
          <rect x="0" y="7" width="3" height="4" rx="1" /><rect x="5" y="5" width="3" height="6" rx="1" /><rect x="10" y="2.5" width="3" height="8.5" rx="1" /><rect x="15" y="0" width="3" height="11" rx="1" />
        </svg>
        <svg width="26" height="12" viewBox="0 0 26 12">
          <rect x="0.5" y="0.5" width="22" height="11" rx="3.5" fill="none" stroke={INK} opacity=".45" /><rect x="2.5" y="2.5" width="16" height="7" rx="2" fill={INK} /><rect x="23.5" y="4" width="2" height="4" rx="1" fill={INK} opacity=".45" />
        </svg>
      </span>
    </div>
  )
}

function Switch({ on, set, label, accent }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => set(!on)} style={{ width: 48, height: 28, borderRadius: 14, border: 'none', padding: 3, background: on ? accent : '#cbd2de', cursor: 'pointer', transition: 'background .2s', flex: 'none' }}>
      <span style={{ display: 'block', width: 22, height: 22, borderRadius: '50%', background: '#fff', transform: `translateX(${on ? 20 : 0}px)`, transition: 'transform .2s' }} />
    </button>
  )
}

const NAV = [
  ['day', 'day', 'Day'],
  ['week', 'week', 'Week'],
  ['new', 'plus', 'New'],
  ['settings', 'gear', 'Settings'],
]

function initial(s) {
  if (s === 'event') return { tab: 'day', stack: [{ id: 'event', ev: 'e2' }] }
  if (s === 'new') return { tab: 'day', stack: [{ id: 'new' }] }
  return { tab: ['day', 'week', 'settings'].includes(s) ? s : 'day', stack: [] }
}

// ---------------------------------------------------------------- app

export default function CalendarApp({ name = 'Cadence', accent = '#4f46e5', startScreen = 'day', frame = true, style }) {
  const box = useRef()
  const toastTimer = useRef()
  const dayScroll = useRef()
  const weekScroll = useRef()
  const memo = useRef({ day: null, week: null })
  const dragRef = useRef(null)
  const [scale, setScale] = useState(1)
  const [tab, setTab] = useState(() => initial(startScreen).tab)
  const [stack, setStack] = useState(() => initial(startScreen).stack)
  const [dir, setDir] = useState(1)
  const [toast, setToast] = useState('')
  const [events, setEvents] = useState(seedEvents)
  const [sel, setSel] = useState(() => keyOf(new Date()))
  const [drag, setDrag] = useState(null) // { id, s, e } live while dragging
  const [now, setNow] = useState(() => new Date())
  const [prefs, setPrefs] = useState({ first: 1, h24: false, dur: 60, nowLine: true, dim: true })
  const [form, setForm] = useState({ title: '', day: keyOf(new Date()), start: 600, end: 660, color: COLORS[0], loc: '' })

  useEffect(() => {
    const i = initial(startScreen)
    setTab(i.tab)
    setStack(i.stack)
  }, [startScreen])
  useEffect(() => {
    const ro = new ResizeObserver(([e]) => {
      const fw = frame ? W + 28 : W
      const fh = frame ? H + 28 : H
      setScale(Math.min(1.2, (e.contentRect.width - 24) / fw, (e.contentRect.height - 24) / fh))
    })
    ro.observe(box.current)
    return () => ro.disconnect()
  }, [frame])
  useEffect(() => {
    const i = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(i)
  }, [])
  useEffect(() => () => clearTimeout(toastTimer.current), [])

  // restore (or pick) the scroll position when a grid appears
  const top = stack[stack.length - 1]
  useEffect(() => {
    const t = new Date()
    if (!top && tab === 'day' && dayScroll.current) dayScroll.current.scrollTop = memo.current.day ?? Math.max(0, (t.getHours() - 2) * HR)
    if (!top && tab === 'week' && weekScroll.current) weekScroll.current.scrollTop = memo.current.week ?? Math.max(0, 6 * WHR)
  }, [tab, top])

  const say = (t) => {
    setToast(t)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 1900)
  }
  const push = (s) => (setDir(1), setStack((a) => [...a, s]))
  const pop = () => (setDir(-1), setStack((a) => a.slice(0, -1)))
  const go = (t) => {
    if (t === 'new') return openNew(sel, null)
    setDir(NAV.findIndex((n) => n[0] === t) >= NAV.findIndex((n) => n[0] === tab) ? 1 : -1)
    setTab(t)
    setStack([])
  }
  const openNew = (day, start) => {
    const s = start ?? Math.min(1380 - prefs.dur, Math.max(0, Math.ceil((now.getHours() * 60 + now.getMinutes()) / 30) * 30))
    setForm({ title: '', day, start: s, end: Math.min(1440, s + prefs.dur), color: COLORS[0], loc: '' })
    setDir(1)
    setStack([{ id: 'new' }])
  }
  const upd = (id, patch) => setEvents((a) => a.map((e) => (e.id === id ? { ...e, ...patch } : e)))
  const h24 = prefs.h24
  const T = (m, short) => fmt(m, h24, short)
  const todayKey = keyOf(now)
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const selDate = parseKey(sel)

  // ---- drag to move / resize
  const startDrag = (e, ev, mode) => {
    e.stopPropagation()
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch (err) { /* ignore */ }
    dragRef.current = { id: ev.id, mode, y0: e.clientY, s0: ev.start, e0: ev.end, moved: false, cur: { s: ev.start, e: ev.end } }
  }
  const moveDrag = (e) => {
    const d = dragRef.current
    if (!d) return
    const dy = (e.clientY - d.y0) / scale
    if (!d.moved && Math.abs(dy) < 4) return
    d.moved = true
    const dm = Math.round((dy / HR) * 4) * 15
    let s = d.s0
    let en = d.e0
    if (d.mode === 'move') {
      s = clamp(d.s0 + dm, 0, 1440 - (d.e0 - d.s0))
      en = s + (d.e0 - d.s0)
    } else en = clamp(d.e0 + dm, d.s0 + 15, 1440)
    d.cur = { s, e: en }
    setDrag({ id: d.id, s, e: en })
  }
  const endDrag = (e) => {
    const d = dragRef.current
    dragRef.current = null
    if (!d) return
    setDrag(null)
    if (!d.moved) {
      if (d.mode === 'move') push({ id: 'event', ev: d.id })
      return
    }
    if (e.type === 'pointercancel') return
    upd(d.id, { start: d.cur.s, end: d.cur.e })
    say(d.mode === 'move' ? `Moved to ${T(d.cur.s)}` : `Now ${T(d.cur.s)} – ${T(d.cur.e)}`)
  }

  const evOf = (day) => events.filter((e) => e.day === day).map((e) => (drag && drag.id === e.id ? { ...e, start: drag.s, end: drag.e } : e))
  const headerBtn = { display: 'grid', placeItems: 'center', width: 36, height: 36, borderRadius: '50%', border: `1px solid ${LINE}`, background: '#fff', color: INK, cursor: 'pointer', padding: 0 }

  const stripStart = weekStart(selDate, prefs.first)
  const strip = Array.from({ length: 7 }, (_, i) => addDays(stripStart, i))

  // a draggable block in the day grid
  const dayBlock = (ev, lay) => {
    const dragging = drag && drag.id === ev.id
    const h = Math.max(14, ((ev.end - ev.start) / 60) * HR - 2)
    const w = 100 / lay.cols
    return (
      <div
        key={ev.id}
        role="button"
        tabIndex={0}
        aria-label={`${ev.title || 'Event'}, ${T(ev.start)} to ${T(ev.end)}. Drag to move.`}
        onPointerDown={(e) => startDrag(e, ev, 'move')}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === 'Enter' && push({ id: 'event', ev: ev.id })}
        style={{
          position: 'absolute', top: (ev.start / 60) * HR + 1, height: h, left: `calc(${lay.col * w}% + 1px)`, width: `calc(${w}% - 3px)`, boxSizing: 'border-box',
          padding: '4px 7px 12px', borderRadius: 8, borderLeft: `4px solid ${ev.color}`, background: dragging ? `${ev.color}40` : `${ev.color}24`, color: INK, overflow: 'hidden', cursor: 'grab', touchAction: 'none', userSelect: 'none',
          boxShadow: dragging ? `0 8px 22px ${ev.color}66` : 'none', zIndex: dragging ? 6 : 2, transition: dragging ? 'none' : 'left .2s, width .2s, box-shadow .2s',
          outline: 'none',
        }}
      >
        <div style={{ fontSize: 12.5, fontWeight: 700, lineHeight: 1.2, whiteSpace: h < 34 ? 'nowrap' : 'normal', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.title || '(No title)'}</div>
        {h >= 34 && <div style={{ fontSize: 11, color: dragging ? ev.color : MUTED, fontWeight: dragging ? 700 : 500, marginTop: 1 }}>{T(ev.start, true)} – {T(ev.end, true)}</div>}
        {h >= 62 && ev.loc && <div style={{ fontSize: 11, color: MUTED, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.loc}</div>}
        <div
          role="slider"
          aria-label="Resize event"
          aria-valuenow={ev.end}
          onPointerDown={(e) => startDrag(e, ev, 'resize')}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 14, cursor: 'ns-resize', touchAction: 'none', display: 'grid', placeItems: 'center' }}
        >
          <span style={{ width: 22, height: 4, borderRadius: 2, background: ev.color, opacity: dragging ? 1 : 0.55 }} />
        </div>
      </div>
    )
  }

  // ---- shared bits
  const header = (title, back, right) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 18px 6px', minHeight: 50 }}>
      {back && <button type="button" onClick={back} aria-label="Back" style={headerBtn}><Icon name="back" size={19} /></button>}
      <h1 style={{ margin: 0, flex: 1, fontSize: back ? 18 : 28, fontWeight: 800, letterSpacing: '-0.02em' }}>{title}</h1>
      {right}
    </div>
  )
  const primary = (label, fn, disabled, ghost, danger) => (
    <button type="button" disabled={disabled} onClick={fn} style={{ width: '100%', height: 50, borderRadius: 14, border: ghost ? `1.5px solid ${danger ? '#fecaca' : LINE}` : 'none', background: ghost ? 'transparent' : disabled ? '#cbd2de' : accent, color: ghost ? (danger ? '#dc2626' : INK) : '#fff', font: 'inherit', fontSize: 15, fontWeight: 700, cursor: disabled ? 'default' : 'pointer' }}>{label}</button>
  )
  const stepper = (label, val, dec, inc) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: `1px solid ${LINE}` }}>
      <span style={{ flex: 1, fontSize: 14, color: MUTED }}>{label}</span>
      <button type="button" aria-label={`Earlier ${label}`} onClick={dec} style={{ ...headerBtn, width: 32, height: 32 }}><Icon name="minus" size={16} /></button>
      <span style={{ minWidth: 76, textAlign: 'center', fontSize: 15, fontWeight: 700 }}>{val}</span>
      <button type="button" aria-label={`Later ${label}`} onClick={inc} style={{ ...headerBtn, width: 32, height: 32 }}><Icon name="plus" size={16} /></button>
    </div>
  )
  const swatches = (cur, set) => (
    <div style={{ display: 'flex', gap: 12, padding: '14px 0', borderBottom: `1px solid ${LINE}` }} role="group" aria-label="Colour">
      {COLORS.map((c) => (
        <button key={c} type="button" aria-label={`Colour ${c}`} aria-pressed={cur === c} onClick={() => set(c)} style={{ width: 34, height: 34, borderRadius: '50%', border: 'none', background: c, cursor: 'pointer', padding: 0, display: 'grid', placeItems: 'center', color: '#fff', boxShadow: cur === c ? `0 0 0 3px #fff, 0 0 0 5px ${c}` : 'none' }}>
          {cur === c && <Icon name="check" size={16} w={3} />}
        </button>
      ))}
    </div>
  )
  const field = (icon, node) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0', borderBottom: `1px solid ${LINE}` }}>
      <Icon name={icon} size={18} color={MUTED} />
      {node}
    </div>
  )
  const inputStyle = { flex: 1, minWidth: 0, height: 42, border: 'none', outline: 'none', background: 'transparent', font: 'inherit', fontSize: 15, color: INK }

  // ---- screens
  let body
  let tabbed = true
  let fixed = false // grid screens scroll themselves
  if (top?.id === 'event') {
    tabbed = false
    const ev = events.find((x) => x.id === top.ev)
    if (!ev) body = <div style={{ padding: 30, color: MUTED }}>This event was deleted.</div>
    else {
      body = (
        <>
          {header('Event', pop, <button type="button" aria-label="Delete event" onClick={() => (setEvents((a) => a.filter((x) => x.id !== ev.id)), pop(), say('Event deleted'))} style={{ ...headerBtn, color: '#dc2626' }}><Icon name="trash" size={18} /></button>)}
          <div style={{ margin: '4px 18px 0', padding: '16px 16px 4px', borderRadius: 20, background: `${ev.color}14`, borderLeft: `6px solid ${ev.color}` }}>
            <input value={ev.title} onChange={(e) => upd(ev.id, { title: e.target.value })} placeholder="Title" aria-label="Title" style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', height: 40, fontSize: 22, fontWeight: 800, letterSpacing: '-0.01em' }} />
            <div style={{ fontSize: 13, color: MUTED, padding: '2px 0 12px' }}>
              {DAYS[parseKey(ev.day).getDay()]}, {parseKey(ev.day).getDate()} {MONTHS[parseKey(ev.day).getMonth()]} · {T(ev.start)} – {T(ev.end)} ({ev.end - ev.start >= 60 ? `${Math.floor((ev.end - ev.start) / 60)} h ` : ''}{(ev.end - ev.start) % 60 ? `${(ev.end - ev.start) % 60} min` : ''})
            </div>
          </div>
          <div style={{ padding: '4px 22px 0' }}>
            {field('day', <input type="date" value={ev.day} onChange={(e) => e.target.value && upd(ev.id, { day: e.target.value })} aria-label="Date" style={inputStyle} />)}
            {stepper('Starts', T(ev.start), () => { const s = Math.max(0, ev.start - 15); upd(ev.id, { start: s, end: ev.end - (ev.start - s) }) }, () => { const s = Math.min(1440 - (ev.end - ev.start), ev.start + 15); upd(ev.id, { start: s, end: ev.end + (s - ev.start) }) })}
            {stepper('Ends', T(ev.end), () => upd(ev.id, { end: Math.max(ev.start + 15, ev.end - 15) }), () => upd(ev.id, { end: Math.min(1440, ev.end + 15) }))}
            {swatches(ev.color, (c) => upd(ev.id, { color: c }))}
            {field('pin', <input value={ev.loc} onChange={(e) => upd(ev.id, { loc: e.target.value })} placeholder="Add location" aria-label="Location" style={inputStyle} />)}
          </div>
          <div style={{ padding: '18px 22px', display: 'grid', gap: 10 }}>
            {primary('Show in Day view', () => (setSel(ev.day), setDir(-1), setTab('day'), setStack([])))}
            {primary('Delete event', () => (setEvents((a) => a.filter((x) => x.id !== ev.id)), pop(), say('Event deleted')), false, true, true)}
          </div>
        </>
      )
    }
  } else if (top?.id === 'new') {
    tabbed = false
    const set = (p) => setForm((f) => ({ ...f, ...p }))
    body = (
      <>
        {header('New event', pop)}
        <div style={{ padding: '4px 22px 0' }}>
          <div style={{ borderLeft: `6px solid ${form.color}`, paddingLeft: 12, borderBottom: `1px solid ${LINE}` }}>
            <input value={form.title} onChange={(e) => set({ title: e.target.value })} placeholder="Event title" aria-label="Title" style={{ ...inputStyle, height: 52, width: '100%', fontSize: 22, fontWeight: 800 }} />
          </div>
          {field('day', <input type="date" value={form.day} onChange={(e) => e.target.value && set({ day: e.target.value })} aria-label="Date" style={inputStyle} />)}
          {stepper('Starts', T(form.start), () => { const s = Math.max(0, form.start - 15); set({ start: s, end: form.end - (form.start - s) }) }, () => { const s = Math.min(1440 - (form.end - form.start), form.start + 15); set({ start: s, end: form.end + (s - form.start) }) })}
          {stepper('Ends', T(form.end), () => set({ end: Math.max(form.start + 15, form.end - 15) }), () => set({ end: Math.min(1440, form.end + 15) }))}
          {swatches(form.color, (c) => set({ color: c }))}
          {field('pin', <input value={form.loc} onChange={(e) => set({ loc: e.target.value })} placeholder="Add location" aria-label="Location" style={inputStyle} />)}
        </div>
        <div style={{ padding: '18px 22px', display: 'grid', gap: 10 }}>
          {primary('Add event', () => {
            const id = `e${Date.now()}`
            setEvents((a) => [...a, { id, title: form.title.trim() || 'New event', day: form.day, start: form.start, end: form.end, color: form.color, loc: form.loc }])
            setSel(form.day)
            setDir(1)
            setTab('day')
            setStack([])
            say('Event added')
          })}
          {primary('Cancel', pop, false, true)}
        </div>
      </>
    )
  } else if (tab === 'day') {
    fixed = true
    const list = evOf(sel)
    const lay = layout(list)
    const isToday = sel === todayKey
    const countOn = (d) => events.filter((e) => e.day === keyOf(d)).length
    body = (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 18px 4px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: accent, letterSpacing: '.06em', textTransform: 'uppercase' }}>{name}</div>
            <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>{MONTHS[selDate.getMonth()]} <span style={{ color: MUTED, fontWeight: 600 }}>{selDate.getFullYear()}</span></div>
          </div>
          <button type="button" onClick={() => setSel(todayKey)} disabled={isToday} style={{ height: 34, padding: '0 14px', borderRadius: 17, border: `1px solid ${LINE}`, background: '#fff', color: isToday ? MUTED : accent, font: 'inherit', fontSize: 13, fontWeight: 700, cursor: isToday ? 'default' : 'pointer' }}>Today</button>
          <button type="button" aria-label="Previous day" onClick={() => setSel(keyOf(addDays(selDate, -1)))} style={headerBtn}><Icon name="back" size={18} /></button>
          <button type="button" aria-label="Next day" onClick={() => setSel(keyOf(addDays(selDate, 1)))} style={headerBtn}><Icon name="chev" size={18} /></button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 12px 8px' }} role="group" aria-label="Pick a day">
          {strip.map((d) => {
            const k = keyOf(d)
            const on = k === sel
            return (
              <button key={k} type="button" onClick={() => setSel(k)} aria-pressed={on} aria-label={`${DAYS[d.getDay()]} ${d.getDate()}`} style={{ width: 48, border: 'none', background: 'none', font: 'inherit', cursor: 'pointer', display: 'grid', justifyItems: 'center', gap: 3, color: INK, padding: 0 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: MUTED }}>{DAYS[d.getDay()].slice(0, 3)}</span>
                <span style={{ width: 36, height: 36, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 16, fontWeight: 700, background: on ? accent : 'transparent', color: on ? '#fff' : k === todayKey ? accent : INK, boxShadow: !on && k === todayKey ? `inset 0 0 0 1.5px ${accent}` : 'none' }}>{d.getDate()}</span>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: countOn(d) ? (on ? accent : MUTED) : 'transparent' }} />
              </button>
            )
          })}
        </div>
        <div ref={dayScroll} className="cl-scroll" onScroll={(e) => (memo.current.day = e.currentTarget.scrollTop)} style={{ flex: 1, minHeight: 0, overflowY: 'auto', borderTop: `1px solid ${LINE}`, background: '#fff', position: 'relative' }}>
          <div
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect()
              const m = clamp(Math.floor((((e.clientY - r.top) / scale / HR) * 60) / 15) * 15, 0, 1425)
              openNew(sel, Math.min(m, 1440 - 30))
            }}
            style={{ position: 'relative', height: 24 * HR + 20, cursor: 'copy' }}
            aria-label="Day grid: tap an empty slot to add an event"
          >
            {Array.from({ length: 24 }, (_, h) => (
              <div key={h} style={{ position: 'absolute', left: 0, right: 0, top: h * HR + 10 }}>
                <span style={{ position: 'absolute', left: 8, top: -7, width: 44, fontSize: 10.5, color: MUTED, textAlign: 'right', background: '#fff', pointerEvents: 'none' }}>{h ? hourLabel(h, h24) : ''}</span>
                <div style={{ position: 'absolute', left: 58, right: 0, height: 1, background: LINE }} />
                <div style={{ position: 'absolute', left: 58, right: 0, top: HR / 2, height: 1, background: '#f3f5f8' }} />
              </div>
            ))}
            {prefs.dim && isToday && <div style={{ position: 'absolute', left: 58, right: 0, top: 10, height: (nowMin / 60) * HR, background: 'rgba(27,34,48,.035)', pointerEvents: 'none' }} />}
            <div style={{ position: 'absolute', left: 62, right: 8, top: 10, height: 24 * HR }}>
              {list.map((ev) => dayBlock(ev, lay[ev.id] || { col: 0, cols: 1 }))}
              {prefs.nowLine && isToday && (
                <div style={{ position: 'absolute', left: -6, right: -8, top: (nowMin / 60) * HR - 1, height: 2, background: NOW, zIndex: 8, pointerEvents: 'none' }} aria-label={`Now ${T(nowMin)}`}>
                  <span style={{ position: 'absolute', left: -1, top: -4, width: 10, height: 10, borderRadius: '50%', background: NOW }} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  } else if (tab === 'week') {
    fixed = true
    const wk = Array.from({ length: 7 }, (_, i) => addDays(weekStart(selDate, prefs.first), i))
    const colW = (W - 36 - 6) / 7
    body = (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 18px 6px' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: accent, letterSpacing: '.06em', textTransform: 'uppercase' }}>Week</div>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>{wk[0].getDate()} {MONTHS[wk[0].getMonth()].slice(0, 3)} – {wk[6].getDate()} {MONTHS[wk[6].getMonth()].slice(0, 3)}</div>
          </div>
          <button type="button" onClick={() => setSel(todayKey)} style={{ height: 34, padding: '0 14px', borderRadius: 17, border: `1px solid ${LINE}`, background: '#fff', color: accent, font: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Today</button>
          <button type="button" aria-label="Previous week" onClick={() => setSel(keyOf(addDays(selDate, -7)))} style={headerBtn}><Icon name="back" size={18} /></button>
          <button type="button" aria-label="Next week" onClick={() => setSel(keyOf(addDays(selDate, 7)))} style={headerBtn}><Icon name="chev" size={18} /></button>
        </div>
        <div style={{ display: 'flex', padding: '2px 3px 6px 36px' }}>
          {wk.map((d) => {
            const k = keyOf(d)
            return (
              <button key={k} type="button" onClick={() => (setSel(k), setDir(-1), setTab('day'))} aria-label={`Open ${DAYS[d.getDay()]} ${d.getDate()}`} style={{ width: colW, border: 'none', background: 'none', font: 'inherit', cursor: 'pointer', display: 'grid', justifyItems: 'center', gap: 2, padding: 0, color: INK }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: MUTED }}>{DAYS[d.getDay()].slice(0, 3)}</span>
                <span style={{ width: 30, height: 30, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 14, fontWeight: 700, background: k === todayKey ? accent : k === sel ? `${accent}22` : 'transparent', color: k === todayKey ? '#fff' : INK }}>{d.getDate()}</span>
              </button>
            )
          })}
        </div>
        <div ref={weekScroll} className="cl-scroll" onScroll={(e) => (memo.current.week = e.currentTarget.scrollTop)} style={{ flex: 1, minHeight: 0, overflowY: 'auto', borderTop: `1px solid ${LINE}`, background: '#fff' }}>
          <div style={{ position: 'relative', height: 24 * WHR + 16 }}>
            {Array.from({ length: 24 }, (_, h) => (
              <div key={h} style={{ position: 'absolute', left: 0, right: 0, top: h * WHR + 8 }}>
                <span style={{ position: 'absolute', left: 2, top: -6, width: 30, fontSize: 9, color: MUTED, textAlign: 'right', pointerEvents: 'none' }}>{h ? (h24 ? pad(h) : `${h % 12 || 12}${h < 12 ? 'a' : 'p'}`) : ''}</span>
                <div style={{ position: 'absolute', left: 36, right: 0, height: 1, background: LINE }} />
              </div>
            ))}
            {wk.map((d, i) => {
              const k = keyOf(d)
              const list = events.filter((e) => e.day === k)
              const lay = layout(list)
              return (
                <div key={k} style={{ position: 'absolute', left: 36 + i * colW, width: colW, top: 8, height: 24 * WHR, borderLeft: `1px solid ${LINE}`, background: k === todayKey ? `${accent}08` : 'transparent' }}>
                  {list.map((ev) => {
                    const l = lay[ev.id]
                    const w = 100 / l.cols
                    return (
                      <button key={ev.id} type="button" onClick={() => push({ id: 'event', ev: ev.id })} aria-label={`${ev.title}, ${T(ev.start)}`} style={{ position: 'absolute', top: (ev.start / 60) * WHR + 1, height: Math.max(10, ((ev.end - ev.start) / 60) * WHR - 2), left: `calc(${l.col * w}% + 1px)`, width: `calc(${w}% - 2px)`, boxSizing: 'border-box', padding: '1px 2px', border: 'none', borderLeft: `2.5px solid ${ev.color}`, borderRadius: 4, background: `${ev.color}30`, color: INK, font: 'inherit', fontSize: 8.5, fontWeight: 700, lineHeight: 1.1, textAlign: 'left', overflow: 'hidden', cursor: 'pointer' }}>
                        {ev.title}
                      </button>
                    )
                  })}
                  {prefs.nowLine && k === todayKey && <div style={{ position: 'absolute', left: 0, right: 0, top: (nowMin / 60) * WHR - 1, height: 2, background: NOW, pointerEvents: 'none' }} />}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  } else {
    const seg = (opts, val, set) => (
      <div style={{ display: 'flex', padding: 3, borderRadius: 12, background: '#edf0f5' }} role="group">
        {opts.map(([v, l]) => (
          <button key={String(v)} type="button" onClick={() => set(v)} aria-pressed={val === v} style={{ flex: 1, height: 34, borderRadius: 9, border: 'none', background: val === v ? '#fff' : 'transparent', boxShadow: val === v ? '0 1px 3px rgba(0,0,0,.12)' : 'none', color: INK, font: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{l}</button>
        ))}
      </div>
    )
    const lab = { fontSize: 12, fontWeight: 700, color: MUTED, letterSpacing: '.06em', textTransform: 'uppercase', margin: '0 0 8px' }
    body = (
      <>
        {header('Settings')}
        <div style={{ padding: '6px 18px 0', display: 'grid', gap: 18 }}>
          <div style={{ padding: 16, background: '#fff', borderRadius: 20 }}>
            <div style={lab}>First day of week</div>
            {seg([[0, 'Sun'], [1, 'Mon'], [6, 'Sat']], prefs.first, (v) => setPrefs((p) => ({ ...p, first: v })))}
            <div style={{ ...lab, marginTop: 16 }}>Time format</div>
            {seg([[false, '12-hour'], [true, '24-hour']], prefs.h24, (v) => setPrefs((p) => ({ ...p, h24: v })))}
            <div style={{ fontSize: 12.5, color: MUTED, marginTop: 8 }}>Example: {fmt(15 * 60 + 30, prefs.h24)}</div>
            <div style={{ ...lab, marginTop: 16 }}>Default event length</div>
            {seg([[30, '30m'], [45, '45m'], [60, '1h'], [90, '90m']], prefs.dur, (v) => setPrefs((p) => ({ ...p, dur: v })))}
          </div>
          <div style={{ padding: '4px 16px', background: '#fff', borderRadius: 20 }}>
            {[['nowLine', 'Show current-time line'], ['dim', 'Dim past hours today']].map(([k, l]) => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: k === 'nowLine' ? `1px solid ${LINE}` : 'none', fontSize: 14, fontWeight: 600 }}>
                {l}
                <Switch on={prefs[k]} set={(v) => setPrefs((p) => ({ ...p, [k]: v }))} label={l} accent={accent} />
              </div>
            ))}
          </div>
          {primary('Reset demo events', () => (setEvents(seedEvents()), say('Demo events restored')), false, true)}
        </div>
      </>
    )
  }

  const phone = (
    <div style={{ position: 'relative', width: W, height: H, overflow: 'hidden', borderRadius: frame ? 46 : 0, background: '#f4f6fa', color: INK, fontFamily: "-apple-system, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif" }}>
      <style>{`
        @keyframes cl-r { from { opacity: 0; transform: translateX(30px) } to { opacity: 1; transform: none } }
        @keyframes cl-l { from { opacity: 0; transform: translateX(-30px) } to { opacity: 1; transform: none } }
        .cl-scroll { scrollbar-width: none } .cl-scroll::-webkit-scrollbar { display: none }
        .cl-app button:focus-visible, .cl-app input:focus-visible, .cl-app [role=button]:focus-visible { outline: 2px solid ${accent}; outline-offset: 1px }
        .cl-app input[type=date] { font-family: inherit }
        @media (prefers-reduced-motion: reduce) { .cl-view { animation: none !important } }
      `}</style>
      <StatusBar frame={frame} />
      <div key={`${tab}/${stack.map((s) => s.id).join('/')}`} className="cl-scroll cl-view" style={{ position: 'absolute', top: 54, bottom: tabbed ? TAB : 0, left: 0, right: 0, overflowY: fixed ? 'hidden' : 'auto', paddingBottom: fixed ? 0 : 24, animation: `${dir > 0 ? 'cl-r' : 'cl-l'} .26s ease` }}>
        {body}
      </div>
      {tabbed && (
        <nav aria-label="Main" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: TAB, background: 'rgba(255,255,255,.96)', borderTop: `1px solid ${LINE}`, display: 'flex', justifyContent: 'space-around', alignItems: 'flex-start', padding: '8px 10px 0' }}>
          {NAV.map(([id, icon, label]) =>
            id === 'new' ? (
              <button key={id} type="button" onClick={() => go('new')} aria-label="New event" style={{ width: 54, height: 54, marginTop: -2, borderRadius: 18, border: 'none', background: accent, color: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center', boxShadow: `0 8px 18px ${accent}66` }}>
                <Icon name="plus" size={26} w={2.4} />
              </button>
            ) : (
              <button key={id} type="button" onClick={() => go(id)} aria-current={tab === id ? 'page' : undefined} style={{ border: 'none', background: 'none', font: 'inherit', cursor: 'pointer', display: 'grid', justifyItems: 'center', alignContent: 'start', gap: 3, width: 64, height: 54, fontSize: 11, fontWeight: 600, color: tab === id ? accent : MUTED }}>
                <Icon name={icon} size={23} />
                {label}
              </button>
            ),
          )}
        </nav>
      )}
      <div role="status" style={{ position: 'absolute', left: '50%', top: 58, zIndex: 30, transform: `translate(-50%, ${toast ? 0 : -90}px)`, transition: 'transform .35s cubic-bezier(.2,.8,.2,1)', padding: '10px 16px', borderRadius: 20, background: INK, color: '#fff', fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap' }}>{toast}</div>
      <div style={{ position: 'absolute', left: '50%', bottom: 8, width: 140, height: 5, marginLeft: -70, borderRadius: 3, background: INK, opacity: 0.8, zIndex: 25, pointerEvents: 'none' }} />
    </div>
  )

  return (
    <div ref={box} className="cl-app" style={{ position: 'relative', width: '100%', height: '100%', display: 'grid', placeItems: 'center', overflow: 'hidden', background: 'radial-gradient(ellipse at 50% 30%, #e8eaf6, #b7bcd6 75%)', ...style }}>
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: `translate(-50%, -50%) scale(${scale})`, transformOrigin: 'center' }}>
        {frame ? (
          <div style={{ padding: 12, borderRadius: 58, background: 'linear-gradient(145deg, #3a3f4a, #14171d 40%, #2b2f38)', boxShadow: '0 40px 80px rgba(20,25,60,.35), inset 0 0 0 2px #4b515e' }}>
            <div style={{ padding: 2, borderRadius: 48, background: '#000' }}>{phone}</div>
          </div>
        ) : (
          phone
        )}
      </div>
    </div>
  )
}
