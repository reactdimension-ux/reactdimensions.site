import { useEffect, useRef, useState } from 'react'

// A bill-splitting app on a phone, as a click-through prototype. Five tabs:
// Receipt (an SVG-drawn receipt with tip and tax chips + sliders, and an add-item
// form), Assign (drag a line item from the receipt onto a person's avatar at the
// bottom; drop on several people, or on "All", to share it and the cost splits
// evenly; tap an item then tap avatars works too), People (add / remove), Summary
// (each person's total with a bar chart; tap a person for their breakdown) and
// Pay (pay or request, then a success state). Tip and tax are spread over people
// in proportion to what they ordered. The phone scales to fit its box.

const W = 390
const H = 844
const INK = '#2a2622'
const MUTED = '#8a8175'
const BG = '#efe8da'
const PAPER = '#fffdf8'
const MONO = "ui-monospace, 'SF Mono', Menlo, Consolas, monospace"

const money = (n) => `$${(Math.round(n * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const HUES = [150, 20, 200, 320, 260, 50, 340, 100]

const ITEMS0 = [
  { id: 'i1', name: 'Truffle fries', price: 12 },
  { id: 'i2', name: 'Margherita pizza', price: 18.5 },
  { id: 'i3', name: 'Spicy rigatoni', price: 21 },
  { id: 'i4', name: 'Caesar salad', price: 14 },
  { id: 'i5', name: 'Burrata', price: 16 },
  { id: 'i6', name: 'Tiramisu', price: 9.5 },
  { id: 'i7', name: 'Aperol spritz x2', price: 22 },
  { id: 'i8', name: 'Sparkling water', price: 6 },
]
const PEOPLE0 = [
  { id: 'p1', name: 'You', hue: HUES[0] },
  { id: 'p2', name: 'Ava', hue: HUES[1] },
  { id: 'p3', name: 'Leo', hue: HUES[2] },
  { id: 'p4', name: 'Mia', hue: HUES[3] },
]
const ASSIGN0 = { i1: ['p1', 'p2', 'p3'], i2: ['p2'], i3: ['p3'], i4: ['p1'], i5: ['p1', 'p4'], i6: ['p2', 'p4'], i7: ['p3', 'p4'] }

const NAV = [
  ['receipt', 'receipt', 'Receipt'],
  ['assign', 'hand', 'Assign'],
  ['people', 'users', 'People'],
  ['summary', 'chart', 'Summary'],
  ['pay', 'wallet', 'Pay'],
]

const ICONS = {
  receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6',
  hand: 'M9 11V5a1.5 1.5 0 0 1 3 0v5m0 0V4a1.5 1.5 0 0 1 3 0v7m0-2a1.5 1.5 0 0 1 3 0v6a6 6 0 0 1-6 6h-1a6 6 0 0 1-5-3l-2-4a1.5 1.5 0 0 1 2.5-1.5L9 14',
  users: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14a6 6 0 0 1 3.5 6',
  chart: 'M5 20V10m7 10V4m7 16v-7',
  wallet: 'M4 7a2 2 0 0 1 2-2h11v4M4 7v10a2 2 0 0 0 2 2h13a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1H6a2 2 0 0 1-2-2zM16 14h.01',
  back: 'M15 5l-7 7 7 7',
  chev: 'M9 5l7 7-7 7',
  check: 'M5 12l5 5 9-10',
  x: 'M6 6l12 12M18 6L6 18',
  plus: 'M12 5v14M5 12h14',
  send: 'M4 12l16-8-6 16-3-7z',
}

function Icon({ name, size = 22, color = 'currentColor', w = 1.9 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  )
}

function Avatar({ p, size = 44, ring }) {
  return (
    <span style={{ width: size, height: size, borderRadius: '50%', display: 'grid', placeItems: 'center', flex: 'none', background: `hsl(${p.hue} 65% 88%)`, color: `hsl(${p.hue} 55% 28%)`, fontWeight: 800, fontSize: size * 0.4, boxShadow: ring ? `0 0 0 3px ${ring}` : 'none', transition: 'box-shadow .15s' }}>
      {p.name[0].toUpperCase()}
    </span>
  )
}

function StatusBar({ frame }) {
  const clock = new Date().toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' })
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20, height: 54, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 30px 0 36px', fontSize: 16, fontWeight: 600, color: INK, pointerEvents: 'none' }}>
      <span>{clock}</span>
      {frame && <span style={{ position: 'absolute', left: '50%', top: 11, width: 122, height: 35, marginLeft: -61, borderRadius: 20, background: '#000' }} />}
      <svg width="44" height="12" viewBox="0 0 44 12" aria-hidden="true">
        <g fill={INK}>
          <rect x="0" y="7" width="3" height="4" rx="1" />
          <rect x="5" y="5" width="3" height="6" rx="1" />
          <rect x="10" y="2.5" width="3" height="8.5" rx="1" />
          <rect x="15" y="0" width="3" height="11" rx="1" />
        </g>
        <rect x="21.500" y="0.500" width="22" height="11" rx="3.500" fill="none" stroke={INK} opacity=".45" />
        <rect x="23.500" y="2.500" width="16" height="7" rx="2" fill={INK} />
      </svg>
    </div>
  )
}

// ------------------------------------------------------------ the maths

function calc(items, assign, people, taxPct, tipPct) {
  const ids = new Set(people.map((p) => p.id))
  const sub = items.reduce((s, i) => s + i.price, 0)
  const tax = (sub * taxPct) / 100
  const tip = (sub * tipPct) / 100
  const share = {}
  people.forEach((p) => (share[p.id] = 0))
  let assigned = 0
  const unassigned = []
  items.forEach((it) => {
    const who = (assign[it.id] || []).filter((id) => ids.has(id))
    if (!who.length) return unassigned.push(it)
    assigned += it.price
    who.forEach((id) => (share[id] += it.price / who.length))
  })
  const per = people.map((p) => {
    const f = assigned > 0 ? share[p.id] / assigned : 0
    return { p, sub: share[p.id], tax: (assigned > 0 ? tax : 0) * f, tip: (assigned > 0 ? tip : 0) * f, total: share[p.id] + (assigned > 0 ? tax + tip : 0) * f }
  })
  return { sub, tax, tip, total: sub + tax + tip, per, unassigned, assigned }
}

// ------------------------------------------------------------ SVG receipt (stable component)

const RW = 330
function ReceiptSvg({ items, assign, people, c, taxPct, tipPct, mode, selected, dragId, restaurant, onRowDown, onRowMove, onRowUp }) {
  const rowH = mode === 'assign' ? 46 : 32
  const top = 92
  const listH = items.length * rowH
  const foot = top + listH + 14
  const total = foot + 150
  const zig = []
  for (let x = 0; x <= RW; x += 11) zig.push(`${x},${total + (Math.floor(x / 11) % 2 ? 0 : 9)}`)
  const edge = `M0,6 L${RW},6 L${RW},${total} ${zig.reverse().map((p) => 'L' + p).join(' ')} Z`
  return (
    <svg viewBox={`0 0 ${RW} ${total + 12}`} width="100%" style={{ display: 'block', filter: 'drop-shadow(0 8px 14px rgba(60,40,10,.18))', touchAction: mode === 'assign' ? 'pan-y' : 'auto' }} role="img" aria-label="Receipt">
      <path d={edge} fill={PAPER} stroke="#e7dfce" />
      <g fontFamily={MONO} fill={INK}>
        <text x={RW / 2} y="40" textAnchor="middle" fontSize="19" fontWeight="800" letterSpacing="3">{restaurant.toUpperCase()}</text>
        <text x={RW / 2} y="58" textAnchor="middle" fontSize="10" fill={MUTED}>14 HARBOUR ST · TABLE 12 · 4 GUESTS</text>
        <line x1="16" y1="72" x2={RW - 16} y2="72" stroke={MUTED} strokeDasharray="3 4" />
        {items.map((it, i) => {
          const y = top + i * rowH
          const who = (assign[it.id] || []).map((id) => people.find((p) => p.id === id)).filter(Boolean)
          const on = selected === it.id
          const drag = dragId === it.id
          const interactive = mode === 'assign'
          return (
            <g
              key={it.id}
              transform={`translate(0 ${y})`}
              opacity={drag ? 0.35 : 1}
              style={{ cursor: interactive ? 'grab' : 'default', touchAction: interactive ? 'none' : 'auto' }}
              onPointerDown={interactive ? (e) => onRowDown(e, it) : undefined}
              onPointerMove={interactive ? (e) => onRowMove(e, it) : undefined}
              onPointerUp={interactive ? (e) => onRowUp(e, it) : undefined}
              onPointerCancel={interactive ? (e) => onRowUp(e, it, true) : undefined}
            >
              {interactive && <rect x="8" y="2" width={RW - 16} height={rowH - 4} rx="8" fill={on ? '#fff3d6' : 'transparent'} stroke={on ? '#e0a63a' : 'transparent'} />}
              {interactive && (
                <g fill={MUTED} opacity=".7">
                  {[0, 1, 2].map((k) => (
                    <g key={k}>
                      <circle cx="20" cy={rowH / 2 - 6 + k * 6} r="1.4" />
                      <circle cx="26" cy={rowH / 2 - 6 + k * 6} r="1.4" />
                    </g>
                  ))}
                </g>
              )}
              <text x={interactive ? 38 : 20} y={interactive ? 19 : 21} fontSize="13" fontWeight="600">{it.name}</text>
              <text x={RW - 20} y={interactive ? 19 : 21} fontSize="13" fontWeight="700" textAnchor="end">{money(it.price)}</text>
              {interactive && (
                <g>
                  {who.length === 0 && <text x="38" y="36" fontSize="10" fill="#c2410c">unassigned - drag me</text>}
                  {who.map((p, k) => (
                    <g key={p.id} transform={`translate(${44 + k * 18} 31)`}>
                      <circle r="8" fill={`hsl(${p.hue} 65% 85%)`} stroke={PAPER} strokeWidth="1.5" />
                      <text y="3.500" textAnchor="middle" fontSize="9" fontWeight="800" fill={`hsl(${p.hue} 55% 28%)`} fontFamily="system-ui">{p.name[0].toUpperCase()}</text>
                    </g>
                  ))}
                  {who.length > 1 && <text x={RW - 20} y="36" fontSize="10" textAnchor="end" fill={MUTED}>{money(it.price / who.length)} each</text>}
                </g>
              )}
            </g>
          )
        })}
        <line x1="16" y1={foot} x2={RW - 16} y2={foot} stroke={MUTED} strokeDasharray="3 4" />
        {[['SUBTOTAL', c.sub], [`TAX ${taxPct}%`, c.tax], [`TIP ${tipPct}%`, c.tip]].map(([l, v], i) => (
          <g key={l}>
            <text x="20" y={foot + 24 + i * 20} fontSize="12" fill={MUTED}>{l}</text>
            <text x={RW - 20} y={foot + 24 + i * 20} fontSize="12" textAnchor="end">{money(v)}</text>
          </g>
        ))}
        <line x1="16" y1={foot + 78} x2={RW - 16} y2={foot + 78} stroke={INK} />
        <text x="20" y={foot + 102} fontSize="16" fontWeight="800">TOTAL</text>
        <text x={RW - 20} y={foot + 102} fontSize="16" fontWeight="800" textAnchor="end">{money(c.total)}</text>
        <g fill={INK}>
          {Array.from({ length: 46 }, (_, i) => (
            <rect key={i} x={50 + i * 5.5} y={foot + 114} width={i % 3 === 0 ? 3 : 1.6} height="14" />
          ))}
        </g>
      </g>
    </svg>
  )
}

// ---------------------------------------------------------------- app

export default function SplitApp({ name = 'Trattoria Sole', accent = '#0f9d6b', startScreen = 'receipt', frame = true, style }) {
  const box = useRef()
  const phoneRef = useRef()
  const toastTimer = useRef()
  const drag = useRef(null)
  const idN = useRef(100)
  const [scale, setScale] = useState(1)
  const [tab, setTab] = useState(startScreen)
  const [stack, setStack] = useState([])
  const [dir, setDir] = useState(1)
  const [toast, setToast] = useState('')
  const [items, setItems] = useState(ITEMS0)
  const [people, setPeople] = useState(PEOPLE0)
  const [assign, setAssign] = useState(ASSIGN0)
  const [taxPct, setTaxPct] = useState(8.25)
  const [tipPct, setTipPct] = useState(18)
  const [selected, setSelected] = useState(null)
  const [ghost, setGhost] = useState(null) // { id, x, y, over }
  const [newItem, setNewItem] = useState({ name: '', price: '' })
  const [newPerson, setNewPerson] = useState('')
  const [payer, setPayer] = useState('p1')
  const [status, setStatus] = useState({}) // pid -> 'requested' | 'paid'
  const [success, setSuccess] = useState(null)

  useEffect(() => (setTab(startScreen), setStack([])), [startScreen])

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
  useEffect(() => () => clearTimeout(toastTimer.current), [])

  const c = calc(items, assign, people, taxPct, tipPct)
  const top = stack[stack.length - 1]
  const push = (s) => (setDir(1), setStack((a) => [...a, s]))
  const pop = () => (setDir(-1), setStack((a) => a.slice(0, -1)))
  const go = (t) => (setDir(NAV.findIndex((n) => n[0] === t) > NAV.findIndex((n) => n[0] === tab) ? 1 : -1), setTab(t), setStack([]))

  // --- assigning
  const toggleOn = (itemId, pid) =>
    setAssign((a) => {
      const cur = a[itemId] || []
      return { ...a, [itemId]: cur.includes(pid) ? cur.filter((x) => x !== pid) : [...cur, pid] }
    })
  const setAll = (itemId) => setAssign((a) => ({ ...a, [itemId]: people.map((p) => p.id) }))

  const hit = (x, y) => {
    const els = phoneRef.current ? phoneRef.current.querySelectorAll('[data-drop]') : []
    for (const el of els) {
      const r = el.getBoundingClientRect()
      if (x >= r.left - 6 && x <= r.right + 6 && y >= r.top - 6 && y <= r.bottom + 6) return el.getAttribute('data-drop')
    }
    return null
  }
  const local = (e) => {
    const r = phoneRef.current.getBoundingClientRect()
    const s = r.width / W
    return { x: (e.clientX - r.left) / s, y: (e.clientY - r.top) / s }
  }
  const rowDown = (e, it) => {
    e.currentTarget.setPointerCapture?.(e.pointerId)
    drag.current = { id: it.id, sx: e.clientX, sy: e.clientY, live: false }
  }
  const rowMove = (e, it) => {
    const d = drag.current
    if (!d || d.id !== it.id) return
    if (!d.live && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 7) d.live = true
    if (d.live) {
      const l = local(e)
      setGhost({ id: it.id, name: it.name, price: it.price, x: l.x, y: l.y, over: hit(e.clientX, e.clientY) })
    }
  }
  const rowUp = (e, it, cancel) => {
    const d = drag.current
    drag.current = null
    if (!d) return
    if (d.live) {
      const over = cancel ? null : hit(e.clientX, e.clientY)
      setGhost(null)
      if (over === 'all') (setAll(it.id), say(`${it.name} shared by everyone`))
      else if (over) {
        const p = people.find((x) => x.id === over)
        setAssign((a) => {
          const cur = a[it.id] || []
          return cur.includes(over) ? a : { ...a, [it.id]: [...cur, over] }
        })
        say(`${it.name} to ${p.name}`)
      }
    } else setSelected((s) => (s === it.id ? null : it.id))
  }
  const tapPerson = (pid) => {
    if (!selected) return say('Drag an item onto a person, or tap an item first')
    toggleOn(selected, pid)
  }

  const addItem = () => {
    const price = parseFloat(newItem.price)
    if (!newItem.name.trim() || !(price > 0)) return say('Enter a name and a price')
    setItems((a) => [...a, { id: `i${++idN.current}`, name: newItem.name.trim(), price }])
    setNewItem({ name: '', price: '' })
    say('Item added')
  }
  const removeItem = (id) => (setItems((a) => a.filter((i) => i.id !== id)), setAssign((a) => ((a = { ...a }), delete a[id], a)))
  const addPerson = () => {
    const n = newPerson.trim()
    if (!n) return say('Type a name first')
    if (people.length >= 8) return say('Up to 8 people')
    const id = `p${++idN.current}`
    setPeople((a) => [...a, { id, name: n.slice(0, 12), hue: HUES[a.length % HUES.length] }])
    setNewPerson('')
    say(`${n} joined the table`)
  }
  const removePerson = (id) => {
    if (people.length <= 1) return say('Someone has to pay!')
    setPeople((a) => a.filter((p) => p.id !== id))
    setAssign((a) => Object.fromEntries(Object.entries(a).map(([k, v]) => [k, v.filter((x) => x !== id)])))
    if (payer === id) setPayer(people.find((p) => p.id !== id).id)
    setStatus((s) => ((s = { ...s }), delete s[id], s))
  }

  const settle = (pid, kind) => {
    setStatus((s) => ({ ...s, [pid]: kind }))
    const p = people.find((x) => x.id === pid)
    if (kind === 'requested') say(`Request sent to ${p.name}`)
    if (kind === 'paid') setSuccess({ p, amt: c.per.find((r) => r.p.id === pid)?.total || 0 })
  }
  const allSettled = people.filter((p) => p.id !== payer).every((p) => status[p.id] === 'paid')

  // ---- shared bits
  const iconBtn = { display: 'grid', placeItems: 'center', border: 'none', borderRadius: '50%', cursor: 'pointer', padding: 0, background: PAPER, color: INK, width: 38, height: 38 }
  const header = (title, back, sub) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 18px 6px', minHeight: 52 }}>
      {back && (
        <button type="button" onClick={back} aria-label="Back" style={iconBtn}>
          <Icon name="back" size={20} />
        </button>
      )}
      <div>
        <h1 style={{ margin: 0, fontSize: back ? 18 : 26, fontWeight: 800, letterSpacing: '-0.02em' }}>{title}</h1>
        {sub && <div style={{ fontSize: 12, color: MUTED, marginTop: 1 }}>{sub}</div>}
      </div>
    </div>
  )
  const chip = (label, on, fn, key) => (
    <button key={key || label} type="button" onClick={fn} aria-pressed={on} style={{ flex: 'none', height: 34, padding: '0 13px', borderRadius: 17, border: `1.5px solid ${on ? accent : '#d9cfbb'}`, background: on ? accent : 'transparent', color: on ? '#fff' : INK, font: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{label}</button>
  )
  const primary = (label, onClick, disabled) => (
    <button type="button" disabled={disabled} onClick={onClick} style={{ width: '100%', height: 52, borderRadius: 16, border: 'none', background: disabled ? '#cfc6b3' : accent, color: '#fff', font: 'inherit', fontSize: 15, fontWeight: 800, cursor: disabled ? 'default' : 'pointer' }}>{label}</button>
  )
  const input = { height: 42, borderRadius: 12, border: '1.5px solid #d9cfbb', background: PAPER, padding: '0 12px', font: 'inherit', fontSize: 14, color: INK, minWidth: 0 }
  const card = { margin: '0 18px', padding: 16, background: PAPER, borderRadius: 20, boxShadow: '0 1px 0 #e7dfce' }

  const unassignedBar = c.unassigned.length > 0 && (
    <div style={{ ...card, marginTop: 12, display: 'flex', alignItems: 'center', gap: 10, background: '#fff1e0', fontSize: 12.5 }}>
      <span style={{ flex: 1 }}><b>{c.unassigned.length} unassigned</b> ({money(c.unassigned.reduce((s, i) => s + i.price, 0))}) - not in anyone's total yet.</span>
      <button type="button" onClick={() => (c.unassigned.forEach((i) => setAll(i.id)), say('Split evenly'))} style={{ height: 32, padding: '0 12px', border: 'none', borderRadius: 16, background: accent, color: '#fff', font: 'inherit', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Split evenly</button>
    </div>
  )

  // ---- screens
  let body
  let tabbed = true
  let fixed = false
  if (top?.id === 'person') {
    tabbed = false
    const r = c.per.find((x) => x.p.id === top.pid)
    if (!r) body = <>{header('Person', pop)}</>
    else {
      const mine = items.filter((i) => (assign[i.id] || []).includes(r.p.id))
      body = (
        <>
          {header(r.p.name, pop, 'Breakdown')}
          <div style={{ textAlign: 'center', padding: '6px 20px 14px' }}>
            <Avatar p={r.p} size={68} />
            <div style={{ fontSize: 38, fontWeight: 800, letterSpacing: '-0.03em', marginTop: 8 }}>{money(r.total)}</div>
          </div>
          <div style={card}>
            {mine.map((i) => (
              <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 13.5, borderBottom: '1px solid #f0e9da' }}>
                <span>{i.name}{(assign[i.id] || []).length > 1 ? <i style={{ color: MUTED }}> / {(assign[i.id] || []).length}</i> : ''}</span>
                <b>{money(i.price / assign[i.id].length)}</b>
              </div>
            ))}
            {!mine.length && <div style={{ color: MUTED, fontSize: 13, padding: '6px 0' }}>Nothing assigned yet.</div>}
            {[['Food', r.sub], [`Tax ${taxPct}%`, r.tax], [`Tip ${tipPct}%`, r.tip]].map(([l, v]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0 0', fontSize: 13, color: MUTED }}><span>{l}</span><span>{money(v)}</span></div>
            ))}
          </div>
          <div style={{ padding: '16px 18px' }}>{primary('Go to Assign', () => go('assign'))}</div>
        </>
      )
    }
  } else if (tab === 'receipt') {
    body = (
      <>
        {header(name, null, 'Scan complete - 8 items')}
        <div style={{ padding: '6px 28px 0' }}>
          <ReceiptSvg items={items} assign={assign} people={people} c={c} taxPct={taxPct} tipPct={tipPct} mode="view" restaurant={name} />
        </div>
        <div style={{ ...card, marginTop: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 800 }}><span>Tip</span><span>{tipPct}% - {money(c.tip)}</span></div>
          <div style={{ display: 'flex', gap: 8, margin: '10px 0 8px', overflowX: 'auto' }} className="sp-scroll">{[0, 10, 15, 18, 20, 25].map((v) => chip(`${v}%`, tipPct === v, () => setTipPct(v)))}</div>
          <input type="range" min="0" max="30" step="1" value={tipPct} onChange={(e) => setTipPct(+e.target.value)} aria-label="Tip percent" style={{ width: '100%', accentColor: accent }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 800, marginTop: 14 }}><span>Tax</span><span>{taxPct}% - {money(c.tax)}</span></div>
          <div style={{ display: 'flex', gap: 8, margin: '10px 0 8px' }}>{[0, 5, 8.25, 10].map((v) => chip(`${v}%`, taxPct === v, () => setTaxPct(v)))}</div>
          <input type="range" min="0" max="15" step="0.25" value={taxPct} onChange={(e) => setTaxPct(+e.target.value)} aria-label="Tax percent" style={{ width: '100%', accentColor: accent }} />
        </div>
        <div style={{ ...card, marginTop: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 10 }}>Add a missed item</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={newItem.name} onChange={(e) => setNewItem((n) => ({ ...n, name: e.target.value }))} placeholder="Item" aria-label="Item name" style={{ ...input, flex: 1 }} />
            <input value={newItem.price} onChange={(e) => setNewItem((n) => ({ ...n, price: e.target.value }))} placeholder="0.00" inputMode="decimal" aria-label="Item price" style={{ ...input, width: 74 }} />
            <button type="button" onClick={addItem} aria-label="Add item" style={{ ...iconBtn, background: accent, color: '#fff', width: 42, height: 42, borderRadius: 12 }}><Icon name="plus" size={20} /></button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
            {items.slice(-3).map((i) => (
              <button key={i.id} type="button" onClick={() => (removeItem(i.id), say(`Removed ${i.name}`))} style={{ border: 'none', background: '#f3ecdd', borderRadius: 14, height: 28, padding: '0 10px', font: 'inherit', fontSize: 12, color: INK, cursor: 'pointer' }}>{i.name} &times;</button>
            ))}
          </div>
        </div>
        <div style={{ padding: '16px 18px' }}>{primary('Assign items', () => go('assign'))}</div>
      </>
    )
  } else if (tab === 'assign') {
    fixed = true
    body = (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {header('Assign items', null, selected ? 'Tap a person to add / remove' : 'Drag an item onto a person')}
        <div className="sp-scroll" style={{ flex: 1, overflowY: 'auto', padding: '4px 28px 10px' }}>
          <ReceiptSvg items={items} assign={assign} people={people} c={c} taxPct={taxPct} tipPct={tipPct} mode="assign" selected={selected} dragId={ghost?.id} restaurant={name} onRowDown={rowDown} onRowMove={rowMove} onRowUp={rowUp} />
        </div>
        <div style={{ padding: '8px 0 8px', background: '#e8dfcb', borderRadius: '22px 22px 0 0' }}>
          <div className="sp-scroll" style={{ display: 'flex', gap: 14, overflowX: 'auto', padding: '6px 18px 2px' }}>
            {[{ id: 'all', name: 'All', hue: 40 }, ...people].map((p) => {
              const over = ghost?.over === p.id
              const n = p.id === 'all' ? null : items.filter((i) => (assign[i.id] || []).includes(p.id)).length
              return (
                <button key={p.id} type="button" data-drop={p.id} onClick={() => (p.id === 'all' ? (selected ? (setAll(selected), say('Shared by everyone')) : say('Select an item first')) : tapPerson(p.id))} aria-label={`Assign to ${p.name}`} style={{ flex: 'none', display: 'grid', justifyItems: 'center', gap: 4, border: 'none', background: 'none', padding: 0, font: 'inherit', cursor: 'pointer', color: INK, transform: over ? 'scale(1.18)' : 'none', transition: 'transform .15s' }}>
                  {p.id === 'all' ? (
                    <span style={{ width: 54, height: 54, borderRadius: '50%', display: 'grid', placeItems: 'center', background: over ? accent : '#fff', color: over ? '#fff' : INK, fontWeight: 800, fontSize: 13, border: `2px dashed ${accent}` }}>ALL</span>
                  ) : (
                    <Avatar p={p} size={54} ring={over ? accent : selected && (assign[selected] || []).includes(p.id) ? '#e0a63a' : null} />
                  )}
                  <span style={{ fontSize: 11.5, fontWeight: 700 }}>{p.name}</span>
                  {n !== null && <span style={{ fontSize: 10.5, color: MUTED, marginTop: -3 }}>{n} item{n === 1 ? '' : 's'}</span>}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    )
  } else if (tab === 'people') {
    body = (
      <>
        {header('People', null, `${people.length} at the table`)}
        <div style={{ display: 'grid', gap: 8, padding: '4px 18px' }}>
          {c.per.map((r) => (
            <div key={r.p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: PAPER, borderRadius: 18 }}>
              <button type="button" onClick={() => push({ id: 'person', pid: r.p.id })} style={{ display: 'flex', flex: 1, alignItems: 'center', gap: 12, border: 'none', background: 'none', padding: 0, font: 'inherit', textAlign: 'left', cursor: 'pointer', color: INK }}>
                <Avatar p={r.p} />
                <span style={{ flex: 1 }}>
                  <span style={{ display: 'block', fontSize: 15, fontWeight: 700 }}>{r.p.name}</span>
                  <span style={{ display: 'block', fontSize: 12, color: MUTED }}>{items.filter((i) => (assign[i.id] || []).includes(r.p.id)).length} items - {money(r.total)}</span>
                </span>
                <Icon name="chev" size={18} color={MUTED} />
              </button>
              <button type="button" onClick={() => removePerson(r.p.id)} aria-label={`Remove ${r.p.name}`} style={{ ...iconBtn, background: '#f3ecdd', width: 34, height: 34 }}><Icon name="x" size={16} /></button>
            </div>
          ))}
        </div>
        <div style={{ ...card, marginTop: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 10 }}>Add someone</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={newPerson} onChange={(e) => setNewPerson(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addPerson()} placeholder="Name" aria-label="New person name" style={{ ...input, flex: 1 }} />
            <button type="button" onClick={addPerson} style={{ height: 42, padding: '0 18px', border: 'none', borderRadius: 12, background: accent, color: '#fff', font: 'inherit', fontWeight: 800, cursor: 'pointer' }}>Add</button>
          </div>
          <div style={{ fontSize: 12, color: MUTED, marginTop: 10 }}>Removing someone frees their items so you can reassign them.</div>
        </div>
        {unassignedBar}
      </>
    )
  } else if (tab === 'summary') {
    const mx = Math.max(1, ...c.per.map((r) => r.total))
    body = (
      <>
        {header('Summary', null, `${money(c.total)} bill`)}
        <div style={card}>
          <svg viewBox={`0 0 320 ${c.per.length * 44 + 4}`} width="100%" role="img" aria-label="Each person's total">
            {c.per.map((r, i) => (
              <g key={r.p.id} transform={`translate(0 ${i * 44})`} onClick={() => push({ id: 'person', pid: r.p.id })} style={{ cursor: 'pointer' }}>
                <text x="0" y="22" fontSize="13" fontWeight="700" fill={INK}>{r.p.name}</text>
                <rect x="62" y="6" width="190" height="22" rx="11" fill="#f1ead9" />
                <rect x="62" y="6" width={Math.max(8, (190 * r.total) / mx)} height="22" rx="11" fill={`hsl(${r.p.hue} 60% 52%)`} style={{ transition: 'width .4s' }} />
                <text x="320" y="22" fontSize="13" fontWeight="800" textAnchor="end" fill={INK}>{money(r.total)}</text>
              </g>
            ))}
          </svg>
        </div>
        <div style={{ ...card, marginTop: 12 }}>
          {[['Food', c.sub], [`Tax ${taxPct}%`, c.tax], [`Tip ${tipPct}%`, c.tip]].map(([l, v]) => (
            <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 14, color: MUTED }}><span>{l}</span><span>{money(v)}</span></div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 0', borderTop: '1px solid #eee5d2', marginTop: 6, fontSize: 16, fontWeight: 800 }}><span>Bill total</span><span>{money(c.total)}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0 0', fontSize: 12.5, color: MUTED }}><span>Split between people</span><span>{money(c.per.reduce((s, r) => s + r.total, 0))}</span></div>
        </div>
        {unassignedBar}
        <div style={{ padding: '16px 18px' }}>{primary('Continue to pay', () => go('pay'))}</div>
      </>
    )
  } else {
    body = (
      <>
        {header('Pay', null, 'Settle up')}
        <div style={{ padding: '0 18px 8px', fontSize: 13, color: MUTED }}>Who paid the restaurant?</div>
        <div style={{ display: 'flex', gap: 8, padding: '0 18px 12px', overflowX: 'auto' }} className="sp-scroll">{people.map((p) => chip(p.name, payer === p.id, () => (setPayer(p.id), setStatus({})), p.id))}</div>
        <div style={{ display: 'grid', gap: 8, padding: '0 18px' }}>
          {c.per.map((r) => {
            const st = status[r.p.id]
            const isPayer = r.p.id === payer
            return (
              <div key={r.p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: PAPER, borderRadius: 18 }}>
                <Avatar p={r.p} />
                <span style={{ flex: 1 }}>
                  <span style={{ display: 'block', fontSize: 15, fontWeight: 700 }}>{r.p.name}</span>
                  <span style={{ display: 'block', fontSize: 12, color: st === 'paid' ? accent : MUTED, fontWeight: st ? 700 : 400 }}>{isPayer ? 'Paid the bill' : st === 'paid' ? 'Paid' : st === 'requested' ? 'Requested' : `Owes ${money(r.total)}`}</span>
                </span>
                {isPayer ? (
                  <span style={{ fontSize: 14, fontWeight: 800 }}>{money(r.total)}</span>
                ) : st === 'paid' ? (
                  <span style={{ width: 34, height: 34, borderRadius: '50%', display: 'grid', placeItems: 'center', background: accent, color: '#fff' }}><Icon name="check" size={18} w={2.6} /></span>
                ) : (
                  <span style={{ display: 'flex', gap: 6 }}>
                    <button type="button" onClick={() => settle(r.p.id, 'requested')} disabled={st === 'requested'} style={{ height: 36, padding: '0 12px', borderRadius: 18, border: `1.5px solid ${accent}`, background: 'transparent', color: accent, font: 'inherit', fontSize: 12.5, fontWeight: 800, cursor: 'pointer', opacity: st === 'requested' ? 0.5 : 1 }}>{st === 'requested' ? 'Sent' : 'Request'}</button>
                    <button type="button" onClick={() => settle(r.p.id, 'paid')} style={{ height: 36, padding: '0 14px', borderRadius: 18, border: 'none', background: accent, color: '#fff', font: 'inherit', fontSize: 12.5, fontWeight: 800, cursor: 'pointer' }}>Pay {money(r.total)}</button>
                  </span>
                )}
              </div>
            )
          })}
        </div>
        {unassignedBar}
        <div style={{ padding: '16px 18px', display: 'grid', gap: 10 }}>
          {allSettled && people.length > 1 ? (
            <div style={{ textAlign: 'center', padding: 14, borderRadius: 16, background: '#dff5ea', color: '#0b6b47', fontWeight: 800, fontSize: 14 }}>Everyone is settled up. Nice!</div>
          ) : (
            primary('Request from everyone', () => (setStatus((s) => ({ ...s, ...Object.fromEntries(people.filter((p) => p.id !== payer && s[p.id] !== 'paid').map((p) => [p.id, 'requested'])) })), say('Requests sent')))
          )}
          <button type="button" onClick={() => (setStatus({}), setAssign(ASSIGN0), setItems(ITEMS0), setPeople(PEOPLE0), setPayer('p1'), go('receipt'), say('New bill'))} style={{ height: 44, border: 'none', background: 'none', font: 'inherit', fontSize: 14, fontWeight: 700, color: MUTED, cursor: 'pointer' }}>Start a new bill</button>
        </div>
      </>
    )
  }

  const phone = (
    <div ref={phoneRef} style={{ position: 'relative', width: W, height: H, overflow: 'hidden', borderRadius: frame ? 46 : 0, background: BG, color: INK, fontFamily: "-apple-system, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif", userSelect: 'none' }}>
      <style>{`
        @keyframes sp-r { from { opacity: 0; transform: translateX(34px) } to { opacity: 1; transform: none } }
        @keyframes sp-l { from { opacity: 0; transform: translateX(-34px) } to { opacity: 1; transform: none } }
        @keyframes sp-pop { from { transform: scale(.3); opacity: 0 } to { transform: none; opacity: 1 } }
        @keyframes sp-fade { from { opacity: 0 } to { opacity: 1 } }
        .sp-scroll { scrollbar-width: none } .sp-scroll::-webkit-scrollbar { display: none }
        .sp-app button:focus-visible, .sp-app input:focus-visible { outline: 2px solid ${accent}; outline-offset: 2px }
        .sp-app input::placeholder { color: #b4aa97 }
        @media (prefers-reduced-motion: reduce) { .sp-app * { animation: none !important; transition: none !important } }
      `}</style>
      <StatusBar frame={frame} />
      <div key={`${tab}/${stack.map((s) => s.id + (s.pid || '')).join('/')}`} className="sp-scroll" style={{ position: 'absolute', top: 54, bottom: tabbed ? 84 : 0, left: 0, right: 0, overflowY: fixed ? 'hidden' : 'auto', paddingBottom: fixed ? 0 : 24, animation: `${dir > 0 ? 'sp-r' : 'sp-l'} .28s ease` }}>
        {body}
      </div>
      {tabbed && (
        <nav aria-label="Main" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 84, background: PAPER, boxShadow: '0 -1px 0 #e0d6c1', display: 'flex', justifyContent: 'space-around', padding: '9px 6px 0', zIndex: 5 }}>
          {NAV.map(([id, icon, label]) => (
            <button key={id} type="button" onClick={() => go(id)} aria-current={tab === id ? 'page' : undefined} style={{ border: 'none', background: 'none', font: 'inherit', cursor: 'pointer', display: 'grid', justifyItems: 'center', alignContent: 'start', gap: 3, width: 66, height: 54, fontSize: 11, fontWeight: 700, color: tab === id ? accent : MUTED }}>
              <Icon name={icon} size={23} />
              {label}
            </button>
          ))}
        </nav>
      )}
      {ghost && (
        <div style={{ position: 'absolute', left: ghost.x, top: ghost.y, transform: 'translate(-50%, -120%) rotate(-3deg)', zIndex: 40, pointerEvents: 'none', padding: '8px 14px', borderRadius: 14, background: accent, color: '#fff', fontSize: 13, fontWeight: 800, boxShadow: '0 10px 22px rgba(0,0,0,.28)', whiteSpace: 'nowrap' }}>
          {ghost.name} - {money(ghost.price)}
        </div>
      )}
      {success && (
        <div role="dialog" aria-label="Payment sent" onClick={() => setSuccess(null)} style={{ position: 'absolute', inset: 0, zIndex: 50, background: 'rgba(42,38,34,.55)', display: 'grid', placeItems: 'center', animation: 'sp-fade .2s ease' }}>
          <div style={{ width: 290, padding: '30px 24px 22px', borderRadius: 28, background: PAPER, textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
            <span style={{ width: 86, height: 86, borderRadius: '50%', display: 'inline-grid', placeItems: 'center', background: accent, color: '#fff', animation: 'sp-pop .5s cubic-bezier(.2,1.4,.4,1) both' }}><Icon name="check" size={44} w={2.8} /></span>
            <div style={{ fontSize: 22, fontWeight: 800, marginTop: 16 }}>Payment sent</div>
            <div style={{ fontSize: 14, color: MUTED, margin: '6px 0 18px' }}>{money(success.amt)} from {success.p.name} to {people.find((p) => p.id === payer)?.name}</div>
            {primary('Done', () => setSuccess(null))}
          </div>
        </div>
      )}
      <div role="status" style={{ position: 'absolute', left: '50%', top: 58, zIndex: 60, transform: `translate(-50%, ${toast ? 0 : -90}px)`, transition: 'transform .35s cubic-bezier(.2,.8,.2,1)', padding: '10px 16px', borderRadius: 20, background: INK, color: '#fff', fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap' }}>{toast}</div>
      <div style={{ position: 'absolute', left: '50%', bottom: 8, width: 140, height: 5, marginLeft: -70, borderRadius: 3, background: INK, opacity: 0.8, zIndex: 55 }} />
    </div>
  )

  return (
    <div ref={box} className="sp-app" style={{ position: 'relative', width: '100%', height: '100%', display: 'grid', placeItems: 'center', overflow: 'hidden', background: 'radial-gradient(ellipse at 50% 30%, #f4ecda, #cdbf9f 80%)', ...style }}>
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: `translate(-50%, -50%) scale(${scale})`, transformOrigin: 'center' }}>
        {frame ? (
          <div style={{ padding: 12, borderRadius: 58, background: 'linear-gradient(145deg, #3d3a35, #17150f 40%, #2e2b25)', boxShadow: '0 40px 80px rgba(60,40,10,.35), inset 0 0 0 2px #53504a' }}>
            <div style={{ padding: 2, borderRadius: 48, background: '#000' }}>{phone}</div>
          </div>
        ) : (
          phone
        )}
      </div>
    </div>
  )
}
