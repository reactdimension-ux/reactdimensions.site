import { useEffect, useRef, useState } from 'react'

// A budget planner on a phone, as a click-through prototype. Five tabs
// (Overview, Categories, Add, Reports, Settings). Everything shares one piece
// of state: the Add expense keypad (amount, category, note) writes a real
// expense, and the Overview rings, the Categories list and the Reports charts
// all redraw from it. A category that passes its limit turns red and raises a
// warning. A category opens its own expense list (tap an expense to delete it),
// and Settings edits each monthly limit and the currency symbol. Pages slide
// in and out with a back stack. The phone scales to fit whatever box it is in.

const W = 390
const H = 844
const INK = '#23301f'
const MUTED = '#7d8573'
const BG = '#f6f1e4'
const CARD = '#fffdf6'
const LINE = '#e9e2cd'
const RED = '#d6453d'
const TODAY = 14 // pretend it is 14 November
const DAYS_IN_MONTH = 30

const CATS = [
  { id: 'food', name: 'Food', icon: 'fork', color: '#e08a2e', limit: 450 },
  { id: 'rent', name: 'Housing', icon: 'home', color: '#4f7cac', limit: 1200 },
  { id: 'move', name: 'Transport', icon: 'bus', color: '#2f9e8f', limit: 160 },
  { id: 'fun', name: 'Fun', icon: 'star', color: '#a45ab5', limit: 180 },
  { id: 'health', name: 'Health', icon: 'heart', color: '#d6637a', limit: 120 },
  { id: 'shop', name: 'Shopping', icon: 'bag', color: '#8a8f2a', limit: 220 },
]

const SEED = [
  ['rent', 1150, 'November rent', 1],
  ['food', 64.2, 'Weekly groceries', 2],
  ['move', 38, 'Monthly bus pass', 2],
  ['fun', 24.5, 'Cinema night', 4],
  ['food', 18.9, 'Lunch with Priya', 5],
  ['health', 42, 'Pharmacy', 6],
  ['shop', 96, 'Winter jacket', 7],
  ['food', 71.4, 'Groceries', 9],
  ['fun', 59, 'Concert ticket', 10],
  ['move', 21.5, 'Taxi home', 11],
  ['food', 112.8, 'Dinner party shop', 12],
  ['food', 46.3, 'Takeaway x3', 13],
  ['shop', 38.4, 'Kitchen bits', 13],
  ['food', 9.6, 'Morning coffee', 14],
  ['fun', 31, 'Board game', 14],
].map(([cat, amt, note, day], i) => ({ id: `s${i}`, cat, amt, note, day }))

const CURRENCIES = ['$', '€', '£', '¥']

const NAV = [
  ['overview', 'pie', 'Overview'],
  ['categories', 'grid', 'Categories'],
  ['add', 'plus', 'Add'],
  ['reports', 'bars', 'Reports'],
  ['settings', 'gear', 'Settings'],
]

const ICONS = {
  pie: 'M12 3a9 9 0 1 0 9 9h-9zM15 3.5A9 9 0 0 1 20.5 9H15z',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  plus: 'M12 5v14M5 12h14',
  bars: 'M5 20V11M12 20V4M19 20v-6',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12l2-1-1-3-2 .5-1.5-1.5.5-2-3-1-1 2h-2l-1-2-3 1 .5 2L6 8.500 4 8l-1 3 2 1v0l-2 1 1 3 2-.5L7.500 17l-.5 2 3 1 1-2h2l1 2 3-1-.5-2 1.500-1.500 2 .5 1-3z',
  back: 'M15 5l-7 7 7 7',
  chev: 'M9 5l7 7-7 7',
  fork: 'M7 3v7a2 2 0 0 0 2 2v9M11 3v7M7 3v7M17 21V3c-2 1-3 4-3 8h3',
  home: 'M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z',
  bus: 'M6 4h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM4 11h16M8 18v2m8-2v2',
  star: 'M12 3l2.800 5.800 6.200.9-4.500 4.400 1.100 6.200L12 17.300 6.400 20.300l1.100-6.200L3 9.700l6.200-.9z',
  heart: 'M12 20s-8-4.800-8-10.500A4.500 4.500 0 0 1 12 7a4.500 4.500 0 0 1 8 2.500C20 15.200 12 20 12 20z',
  bag: 'M5 8h14l-1 12H6zM9 8a3 3 0 0 1 6 0',
  warn: 'M12 4l9 16H3zM12 10v4m0 3h.01',
  check: 'M5 12l5 5 9-10',
  x: 'M6 6l12 12M18 6L6 18',
  trash: 'M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13',
  minus: 'M5 12h14',
  bell: 'M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4',
  reset: 'M4 12a8 8 0 1 0 3-6.200M4 4v5h5',
  del: 'M9 6h11v12H9l-5-6z M12 9.500l5 5m0-5l-5 5',
}

function Icon({ name, size = 22, color = 'currentColor', w = 1.9 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  )
}

// A progress ring; it fills as spending grows and turns red past the limit.
function Ring({ pct, color, size = 64, stroke = 8, children }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const over = pct > 1
  const col = over ? RED : color
  return (
    <span style={{ position: 'relative', width: size, height: size, display: 'inline-grid', placeItems: 'center', flex: 'none' }}>
      <svg width={size} height={size} style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={over ? '#f6d5d2' : LINE} strokeWidth={stroke} />
        <circle className="bd-ring" cx={size / 2} cy={size / 2} r={r} fill="none" stroke={col} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(1, pct))} />
      </svg>
      {children}
    </span>
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
          <rect x="0.5" y="0.5" width="22" height="11" rx="3.500" fill="none" stroke={INK} opacity=".45" />
          <rect x="2.500" y="2.500" width="16" height="7" rx="2" fill={INK} />
          <rect x="23.500" y="4" width="2" height="4" rx="1" fill={INK} opacity=".45" />
        </svg>
      </span>
    </div>
  )
}

const dayLabel = (d) => (d === TODAY ? 'Today' : d === TODAY - 1 ? 'Yesterday' : `${d} Nov`)
const sum = (a) => a.reduce((s, x) => s + x.amt, 0)

// ---------------------------------------------------------------- app

export default function BudgetApp({ name = 'Fernwood', accent = '#2f7d4f', startScreen = 'overview', currency: startCurrency = '$', frame = true, style }) {
  const box = useRef()
  const toastTimer = useRef()
  const [scale, setScale] = useState(1)
  const [tab, setTab] = useState(startScreen)
  const [stack, setStack] = useState([])
  const [dir, setDir] = useState(1)
  const [toast, setToast] = useState('')
  const [expenses, setExpenses] = useState(SEED)
  const [limits, setLimits] = useState(() => Object.fromEntries(CATS.map((c) => [c.id, c.limit])))
  const [cur, setCur] = useState(startCurrency)
  const [alerts, setAlerts] = useState(true)
  const [form, setForm] = useState({ amt: '', cat: 'food', note: '' })
  const [period, setPeriod] = useState('week')
  const [pick, setPick] = useState(null)

  useEffect(() => (setTab(startScreen), setStack([])), [startScreen])
  useEffect(() => setCur(startCurrency), [startCurrency])

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
    toastTimer.current = setTimeout(() => setToast(''), 2200)
  }
  useEffect(() => () => clearTimeout(toastTimer.current), [])

  const top = stack[stack.length - 1]
  const push = (s) => (setDir(1), setStack((a) => [...a, s]))
  const pop = () => (setDir(-1), setStack((a) => a.slice(0, -1)))
  const go = (t) => (setDir(NAV.findIndex((n) => n[0] === t) >= NAV.findIndex((n) => n[0] === tab) ? 1 : -1), setTab(t), setStack([]), setPick(null))

  const fmt = (n, dec) => `${cur}${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: dec ?? (Number.isInteger(n) ? 0 : 2), maximumFractionDigits: dec ?? 2 })}`
  const spentBy = (id) => sum(expenses.filter((e) => e.cat === id))
  const totalLimit = CATS.reduce((s, c) => s + limits[c.id], 0)
  const totalSpent = sum(expenses)
  const overCats = CATS.filter((c) => spentBy(c.id) > limits[c.id])
  const daysLeft = DAYS_IN_MONTH - TODAY

  const amount = parseFloat(form.amt) || 0
  const tap = (k) =>
    setForm((f) => {
      let a = f.amt
      if (k === 'del') a = a.slice(0, -1)
      else if (k === '.') {
        if (a.includes('.')) return f
        a = a ? `${a}.` : '0.'
      } else {
        if (a.includes('.') && a.split('.')[1].length >= 2) return f
        if (a.replace('.', '').length >= 7) return f
        a = a === '0' ? k : a + k
      }
      return { ...f, amt: a }
    })

  const save = () => {
    const cat = CATS.find((c) => c.id === form.cat)
    const before = spentBy(cat.id)
    const e = { id: `e${Date.now()}`, cat: cat.id, amt: amount, note: form.note.trim() || cat.name, day: TODAY }
    setExpenses((a) => [e, ...a])
    setForm({ amt: '', cat: form.cat, note: '' })
    const after = before + amount
    if (after > limits[cat.id]) say(alerts ? `${cat.name} is over budget by ${fmt(after - limits[cat.id])}` : `Added ${fmt(amount)}`)
    else say(`Added ${fmt(amount)} to ${cat.name}`)
    setDir(1)
    setTab('overview')
    setStack([])
  }

  // ---- shared bits
  const header = (title, back, right) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 20px 8px', minHeight: 52 }}>
      {back && (
        <button type="button" onClick={back} aria-label="Back" style={{ ...iconBtn, width: 38, height: 38, background: CARD, border: `1px solid ${LINE}` }}>
          <Icon name="back" size={20} />
        </button>
      )}
      <h1 style={{ margin: 0, flex: 1, fontSize: back ? 19 : 28, fontWeight: 700, fontFamily: SERIF, letterSpacing: '-0.01em' }}>{title}</h1>
      {right}
    </div>
  )

  const catChip = (c, size = 42) => (
    <span style={{ width: size, height: size, borderRadius: size * 0.34, display: 'grid', placeItems: 'center', flex: 'none', background: `${c.color}22`, color: c.color }}>
      <Icon name={c.icon} size={size * 0.5} />
    </span>
  )

  const expenseRow = (e, onClick) => {
    const c = CATS.find((x) => x.id === e.cat)
    return (
      <button key={e.id} type="button" onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '11px 14px', border: `1px solid ${LINE}`, borderRadius: 16, background: CARD, font: 'inherit', textAlign: 'left', cursor: 'pointer', color: INK }}>
        {catChip(c, 38)}
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.note}</span>
          <span style={{ display: 'block', fontSize: 12, color: MUTED, marginTop: 2 }}>{c.name} · {dayLabel(e.day)}</span>
        </span>
        <span style={{ fontSize: 14.500, fontWeight: 700 }}>−{fmt(e.amt)}</span>
      </button>
    )
  }

  const warnBanner = (list) =>
    list.length > 0 && (
      <button type="button" onClick={() => push({ id: 'cat', cat: list[0].id })} style={{ display: 'flex', alignItems: 'center', gap: 10, width: 'calc(100% - 40px)', margin: '12px 20px 0', padding: '12px 14px', borderRadius: 16, border: `1px solid #f0c3bf`, background: '#fdecea', color: '#9b2c25', font: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
        <Icon name="warn" size={22} color={RED} />
        <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>
          {list.length === 1 ? `${list[0].name} is over budget by ${fmt(spentBy(list[0].id) - limits[list[0].id])}` : `${list.length} categories are over budget`}
        </span>
        <Icon name="chev" size={16} />
      </button>
    )

  // ---- screens
  let body
  let tabbed = true
  if (top?.id === 'cat') {
    tabbed = false
    const c = CATS.find((x) => x.id === top.cat)
    const spent = spentBy(c.id)
    const lim = limits[c.id]
    const list = expenses.filter((e) => e.cat === c.id)
    body = (
      <>
        {header(c.name, pop)}
        <div style={{ margin: '4px 20px 0', padding: 18, borderRadius: 24, background: CARD, border: `1px solid ${LINE}`, display: 'flex', alignItems: 'center', gap: 18 }}>
          <Ring pct={spent / lim} color={c.color} size={96} stroke={11}>
            <span style={{ fontSize: 18, fontWeight: 700, color: spent > lim ? RED : INK }}>{Math.round((spent / lim) * 100)}%</span>
          </Ring>
          <div>
            <div style={{ fontSize: 26, fontWeight: 700, fontFamily: SERIF, color: spent > lim ? RED : INK }}>{fmt(spent)}</div>
            <div style={{ fontSize: 13, color: MUTED }}>of {fmt(lim)} limit</div>
            <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4, color: spent > lim ? RED : accent }}>{spent > lim ? `${fmt(spent - lim)} over` : `${fmt(lim - spent)} left`}</div>
          </div>
        </div>
        {spent > lim && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '12px 20px 0', fontSize: 13, color: '#9b2c25', fontWeight: 600 }}>
            <Icon name="warn" size={18} color={RED} /> Over budget. Raise the limit or slow down.
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, padding: '14px 20px 0' }}>
          <button type="button" onClick={() => (setForm((f) => ({ ...f, cat: c.id })), go('add'))} style={{ ...pill(accent, '#fff'), flex: 1 }}>Add expense</button>
          <button type="button" onClick={() => (setLimits((l) => ({ ...l, [c.id]: l[c.id] + 50 })), say(`${c.name} limit raised to ${fmt(lim + 50)}`))} style={{ ...pill(CARD, INK), flex: 1, border: `1px solid ${LINE}` }}>Raise limit +50</button>
        </div>
        <div style={{ padding: '18px 20px 8px', fontSize: 12, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '.07em' }}>Expenses ({list.length})</div>
        <div style={{ display: 'grid', gap: 8, padding: '0 20px' }}>
          {list.map((e) => expenseRow(e, () => push({ id: 'exp', exp: e.id })))}
          {!list.length && <div style={{ textAlign: 'center', color: MUTED, fontSize: 13, padding: '24px 0' }}>Nothing spent here yet.</div>}
        </div>
      </>
    )
  } else if (top?.id === 'exp') {
    tabbed = false
    const e = expenses.find((x) => x.id === top.exp)
    const c = e && CATS.find((x) => x.id === e.cat)
    body = e ? (
      <>
        {header('Expense', pop)}
        <div style={{ textAlign: 'center', padding: '18px 20px' }}>
          {catChip(c, 64)}
          <div style={{ fontSize: 38, fontWeight: 700, fontFamily: SERIF, marginTop: 12 }}>−{fmt(e.amt)}</div>
          <div style={{ fontSize: 14, color: MUTED, marginTop: 2 }}>{e.note}</div>
        </div>
        <div style={{ margin: '0 20px', padding: '4px 16px', background: CARD, borderRadius: 20, border: `1px solid ${LINE}` }}>
          {row('Category', c.name)}
          {row('Date', `${dayLabel(e.day)}${e.day === TODAY ? '' : ''} (${e.day} Nov)`)}
          {row('Share of category', `${Math.round((e.amt / Math.max(1, spentBy(c.id))) * 100)}%`)}
        </div>
        <div style={{ padding: '16px 20px' }}>
          <button type="button" onClick={() => (setExpenses((a) => a.filter((x) => x.id !== e.id)), pop(), say('Expense deleted'))} style={{ ...pill('#fdecea', '#9b2c25'), width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Icon name="trash" size={18} /> Delete expense
          </button>
        </div>
      </>
    ) : (
      <>{header('Expense', pop)}</>
    )
  } else if (tab === 'overview') {
    const pct = totalSpent / totalLimit
    const left = totalLimit - totalSpent
    body = (
      <>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 20px 0' }}>
          <div>
            <div style={{ fontSize: 13, color: MUTED }}>{name} · November</div>
            <div style={{ fontSize: 28, fontWeight: 700, fontFamily: SERIF }}>Your month</div>
          </div>
          <button type="button" onClick={() => say(overCats.length ? `${overCats.length} budget alert${overCats.length > 1 ? 's' : ''}` : 'No alerts, all on track')} aria-label="Alerts" style={{ ...iconBtn, width: 42, height: 42, background: CARD, border: `1px solid ${LINE}`, position: 'relative' }}>
            <Icon name="bell" size={20} />
            {overCats.length > 0 && <i style={{ position: 'absolute', top: 8, right: 9, width: 9, height: 9, borderRadius: '50%', background: RED }} />}
          </button>
        </div>
        <div style={{ margin: '14px 20px 0', padding: '20px 18px', borderRadius: 28, color: '#fff', background: pct > 1 ? `linear-gradient(135deg, ${RED}, #8c2620)` : `linear-gradient(135deg, ${accent}, #17432b)`, display: 'flex', alignItems: 'center', gap: 18, position: 'relative', overflow: 'hidden', boxShadow: `0 14px 28px ${accent}40` }}>
          <svg width="160" height="160" viewBox="0 0 160 160" style={{ position: 'absolute', right: -40, top: -50, opacity: 0.12 }} aria-hidden="true">
            <path d="M80 10c40 20 60 50 50 90-10 30-40 50-70 40S10 90 20 60 50 20 80 10z" fill="#fff" />
          </svg>
          <span style={{ position: 'relative', width: 112, height: 112, display: 'inline-grid', placeItems: 'center' }}>
            <svg width="112" height="112" style={{ position: 'absolute', transform: 'rotate(-90deg)' }} aria-hidden="true">
              <circle cx="56" cy="56" r="48" fill="none" stroke="rgba(255,255,255,.22)" strokeWidth="12" />
              <circle className="bd-ring" cx="56" cy="56" r="48" fill="none" stroke="#fff" strokeWidth="12" strokeLinecap="round" strokeDasharray={2 * Math.PI * 48} strokeDashoffset={2 * Math.PI * 48 * (1 - Math.min(1, pct))} />
            </svg>
            <span style={{ fontSize: 24, fontWeight: 700, fontFamily: SERIF }}>{Math.round(pct * 100)}%</span>
          </span>
          <div style={{ position: 'relative' }}>
            <div style={{ fontSize: 12.500, opacity: 0.85 }}>{left >= 0 ? 'Left to spend' : 'Over by'}</div>
            <div style={{ fontSize: 32, fontWeight: 700, fontFamily: SERIF, lineHeight: 1.1 }}>{fmt(left)}</div>
            <div style={{ fontSize: 12.500, opacity: 0.85, marginTop: 6 }}>{fmt(totalSpent)} of {fmt(totalLimit)}</div>
            <div style={{ fontSize: 12.500, opacity: 0.85 }}>{daysLeft} days left{left > 0 ? ` · ${fmt(left / daysLeft, 0)}/day` : ''}</div>
          </div>
        </div>
        {warnBanner(overCats)}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '18px 20px 10px' }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, fontFamily: SERIF }}>Categories</h2>
          <button type="button" onClick={() => go('categories')} style={linkBtn(accent)}>See all</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, padding: '0 20px' }}>
          {CATS.map((c) => {
            const s = spentBy(c.id)
            const over = s > limits[c.id]
            return (
              <button key={c.id} type="button" onClick={() => push({ id: 'cat', cat: c.id })} aria-label={`${c.name}, ${fmt(s)} of ${fmt(limits[c.id])}`} style={{ display: 'grid', justifyItems: 'center', gap: 6, padding: '12px 4px 10px', border: `1px solid ${over ? '#f0c3bf' : LINE}`, borderRadius: 20, background: over ? '#fff6f5' : CARD, font: 'inherit', cursor: 'pointer', color: INK }}>
                <Ring pct={s / limits[c.id]} color={c.color} size={60} stroke={7}>
                  <Icon name={c.icon} size={22} color={over ? RED : c.color} />
                </Ring>
                <span style={{ fontSize: 12, fontWeight: 600 }}>{c.name}</span>
                <span style={{ fontSize: 11, color: over ? RED : MUTED, fontWeight: over ? 700 : 500 }}>{over ? 'Over budget' : `${fmt(limits[c.id] - s, 0)} left`}</span>
              </button>
            )
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '18px 20px 10px' }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, fontFamily: SERIF }}>Recent</h2>
          <button type="button" onClick={() => go('reports')} style={linkBtn(accent)}>Reports</button>
        </div>
        <div style={{ display: 'grid', gap: 8, padding: '0 20px' }}>{expenses.slice(0, 3).map((e) => expenseRow(e, () => push({ id: 'exp', exp: e.id })))}</div>
      </>
    )
  } else if (tab === 'categories') {
    body = (
      <>
        {header('Categories')}
        <div style={{ padding: '0 20px 10px', fontSize: 13, color: MUTED }}>{fmt(totalSpent)} spent of {fmt(totalLimit)} · tap one for its expenses</div>
        {warnBanner(overCats)}
        <div style={{ display: 'grid', gap: 10, padding: '12px 20px 0' }}>
          {CATS.map((c) => {
            const s = spentBy(c.id)
            const lim = limits[c.id]
            const over = s > lim
            return (
              <button key={c.id} type="button" onClick={() => push({ id: 'cat', cat: c.id })} style={{ display: 'block', padding: '14px 16px', border: `1px solid ${over ? '#f0c3bf' : LINE}`, borderRadius: 20, background: over ? '#fff6f5' : CARD, font: 'inherit', textAlign: 'left', cursor: 'pointer', color: INK }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {catChip(c, 40)}
                  <span style={{ flex: 1 }}>
                    <span style={{ display: 'block', fontSize: 15, fontWeight: 700 }}>{c.name}</span>
                    <span style={{ display: 'block', fontSize: 12, color: over ? RED : MUTED, fontWeight: over ? 700 : 500, marginTop: 1 }}>{over ? `${fmt(s - lim)} over budget` : `${fmt(lim - s)} left`}</span>
                  </span>
                  <span style={{ textAlign: 'right' }}>
                    <span style={{ display: 'block', fontSize: 15, fontWeight: 700, color: over ? RED : INK }}>{fmt(s)}</span>
                    <span style={{ display: 'block', fontSize: 11.500, color: MUTED }}>of {fmt(lim)}</span>
                  </span>
                </span>
                <span style={{ display: 'block', height: 8, borderRadius: 4, background: over ? '#f6d5d2' : LINE, marginTop: 12, overflow: 'hidden' }}>
                  <span className="bd-bar" style={{ display: 'block', height: '100%', width: `${Math.min(100, (s / lim) * 100)}%`, borderRadius: 4, background: over ? RED : c.color }} />
                </span>
              </button>
            )
          })}
        </div>
      </>
    )
  } else if (tab === 'add') {
    const c = CATS.find((x) => x.id === form.cat)
    const projected = spentBy(c.id) + amount
    const wouldOver = amount > 0 && projected > limits[c.id]
    body = (
      <>
        {header('Add expense')}
        <div style={{ textAlign: 'center', padding: '2px 20px 0' }}>
          <div style={{ fontSize: 52, fontWeight: 700, fontFamily: SERIF, letterSpacing: '-0.02em', color: wouldOver ? RED : INK }}>{cur}{form.amt || '0'}</div>
          <div style={{ fontSize: 12.500, minHeight: 18, color: wouldOver ? RED : MUTED, fontWeight: wouldOver ? 700 : 500 }}>
            {wouldOver ? `This puts ${c.name} ${fmt(projected - limits[c.id])} over budget` : `${c.name}: ${fmt(Math.max(0, limits[c.id] - spentBy(c.id)))} left`}
          </div>
        </div>
        <div className="bd-scroll" style={{ display: 'flex', gap: 8, padding: '12px 20px 8px', overflowX: 'auto' }} role="group" aria-label="Category">
          {CATS.map((x) => (
            <button key={x.id} type="button" onClick={() => setForm((f) => ({ ...f, cat: x.id }))} aria-pressed={form.cat === x.id} style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 6, height: 38, padding: '0 14px 0 10px', borderRadius: 19, border: `1.5px solid ${form.cat === x.id ? x.color : LINE}`, background: form.cat === x.id ? `${x.color}22` : CARD, color: INK, font: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              <Icon name={x.icon} size={17} color={x.color} />
              {x.name}
            </button>
          ))}
        </div>
        <div style={{ padding: '0 20px' }}>
          <input value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} placeholder="Add a note (optional)" aria-label="Note" maxLength={40} style={{ width: '100%', boxSizing: 'border-box', height: 44, padding: '0 14px', borderRadius: 14, border: `1px solid ${LINE}`, background: CARD, font: 'inherit', fontSize: 14, color: INK }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, padding: '12px 28px 10px' }}>
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del'].map((k) => (
            <button key={k} type="button" onClick={() => tap(k)} aria-label={k === 'del' ? 'Delete' : k} style={{ height: 52, border: `1px solid ${LINE}`, borderRadius: 16, background: CARD, font: 'inherit', fontSize: 22, fontWeight: 600, cursor: 'pointer', color: INK, display: 'grid', placeItems: 'center' }}>
              {k === 'del' ? <Icon name="del" size={24} /> : k}
            </button>
          ))}
        </div>
        <div style={{ padding: '4px 20px' }}>
          <button type="button" disabled={amount <= 0} onClick={save} style={{ ...pill(amount > 0 ? accent : '#c9c8b8', '#fff'), width: '100%', height: 52, borderRadius: 26 }}>
            Save expense
          </button>
        </div>
      </>
    )
  } else if (tab === 'reports') {
    const buckets =
      period === 'week'
        ? Array.from({ length: 7 }, (_, i) => {
            const d = TODAY - 6 + i
            return { label: ['S', 'M', 'T', 'W', 'T', 'F', 'S'][(d + 5) % 7], sub: `${d} Nov`, v: sum(expenses.filter((e) => e.day === d)) }
          })
        : [[1, 7], [8, 14], [15, 21], [22, 28], [29, 30]].map(([a, b], i) => ({ label: `W${i + 1}`, sub: `${a}-${b} Nov`, v: sum(expenses.filter((e) => e.day >= a && e.day <= b)) }))
    const max = Math.max(1, ...buckets.map((b) => b.v))
    const sel = pick != null && buckets[pick] ? buckets[pick] : null
    const inPeriod = period === 'week' ? expenses.filter((e) => e.day > TODAY - 7) : expenses
    const pTotal = sum(inPeriod)
    const shares = CATS.map((c) => ({ c, v: sum(inPeriod.filter((e) => e.cat === c.id)) })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v)
    // donut
    const R = 52
    const C = 2 * Math.PI * R
    let acc = 0
    body = (
      <>
        {header('Reports')}
        <div style={{ display: 'flex', margin: '0 20px', padding: 4, borderRadius: 16, background: '#ebe4cf' }} role="group" aria-label="Period">
          {[['week', 'Last 7 days'], ['month', 'This month']].map(([id, l]) => (
            <button key={id} type="button" onClick={() => (setPeriod(id), setPick(null))} aria-pressed={period === id} style={{ flex: 1, height: 36, border: 'none', borderRadius: 12, background: period === id ? CARD : 'transparent', boxShadow: period === id ? '0 1px 4px rgba(35,48,31,.15)' : 'none', font: 'inherit', fontSize: 13, fontWeight: 600, color: INK, cursor: 'pointer' }}>{l}</button>
          ))}
        </div>
        <div style={{ margin: '14px 20px 0', padding: 16, borderRadius: 24, background: CARD, border: `1px solid ${LINE}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: 13, color: MUTED }}>{sel ? sel.sub : period === 'week' ? 'Spent in 7 days' : 'Spent this month'}</span>
            <span style={{ fontSize: 22, fontWeight: 700, fontFamily: SERIF }}>{fmt(sel ? sel.v : pTotal)}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: period === 'week' ? 8 : 14, height: 130, marginTop: 14 }}>
            {buckets.map((b, i) => (
              <button key={i} type="button" onClick={() => setPick(pick === i ? null : i)} aria-label={`${b.sub}: ${fmt(b.v)}`} style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', gap: 6, border: 'none', background: 'none', padding: 0, cursor: 'pointer', font: 'inherit' }}>
                <span className="bd-grow" style={{ width: '100%', height: `${(b.v / max) * 100}%`, minHeight: b.v ? 4 : 2, borderRadius: 8, background: pick === i ? INK : b.v ? accent : LINE, opacity: pick != null && pick !== i ? 0.45 : 1 }} />
                <span style={{ fontSize: 11, color: MUTED, fontWeight: 600 }}>{b.label}</span>
              </button>
            ))}
          </div>
        </div>
        <div style={{ margin: '12px 20px 0', padding: 16, borderRadius: 24, background: CARD, border: `1px solid ${LINE}`, display: 'flex', alignItems: 'center', gap: 16 }}>
          <svg width="128" height="128" viewBox="0 0 128 128" style={{ flex: 'none', transform: 'rotate(-90deg)' }} role="img" aria-label="Spending by category">
            <circle cx="64" cy="64" r={R} fill="none" stroke={LINE} strokeWidth="18" />
            {shares.map(({ c, v }) => {
              const len = (v / Math.max(1, pTotal)) * C
              const el = <circle key={c.id} cx="64" cy="64" r={R} fill="none" stroke={c.color} strokeWidth="18" strokeDasharray={`${Math.max(0, len - 2)} ${C}`} strokeDashoffset={-acc} />
              acc += len
              return el
            })}
          </svg>
          <div style={{ flex: 1, display: 'grid', gap: 7 }}>
            {shares.slice(0, 5).map(({ c, v }) => (
              <button key={c.id} type="button" onClick={() => push({ id: 'cat', cat: c.id })} style={{ display: 'flex', alignItems: 'center', gap: 8, border: 'none', background: 'none', padding: 0, font: 'inherit', fontSize: 12.500, color: INK, cursor: 'pointer', textAlign: 'left' }}>
                <i style={{ width: 10, height: 10, borderRadius: 3, background: c.color, flex: 'none' }} />
                <span style={{ flex: 1, fontWeight: 600 }}>{c.name}</span>
                <span style={{ color: MUTED }}>{Math.round((v / Math.max(1, pTotal)) * 100)}%</span>
              </button>
            ))}
            {!shares.length && <span style={{ fontSize: 13, color: MUTED }}>No spending in this period.</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, padding: '12px 20px 0' }}>
          {[['Average / day', fmt(pTotal / (period === 'week' ? 7 : TODAY), 0)], ['Biggest', shares[0] ? shares[0].c.name : 'None']].map(([l, v]) => (
            <div key={l} style={{ flex: 1, padding: '12px 14px', borderRadius: 18, background: CARD, border: `1px solid ${LINE}` }}>
              <div style={{ fontSize: 12, color: MUTED }}>{l}</div>
              <div style={{ fontSize: 17, fontWeight: 700, fontFamily: SERIF, marginTop: 2 }}>{v}</div>
            </div>
          ))}
        </div>
      </>
    )
  } else {
    body = (
      <>
        {header('Settings')}
        <div style={{ padding: '0 20px 8px', fontSize: 12, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '.07em' }}>Currency</div>
        <div style={{ display: 'flex', gap: 8, padding: '0 20px' }} role="group" aria-label="Currency symbol">
          {CURRENCIES.map((s) => (
            <button key={s} type="button" onClick={() => (setCur(s), say(`Currency set to ${s}`))} aria-pressed={cur === s} style={{ flex: 1, height: 46, borderRadius: 14, border: `1.5px solid ${cur === s ? accent : LINE}`, background: cur === s ? `${accent}18` : CARD, font: 'inherit', fontSize: 20, fontWeight: 700, color: cur === s ? accent : INK, cursor: 'pointer' }}>{s}</button>
          ))}
        </div>
        <div style={{ padding: '18px 20px 8px', fontSize: 12, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '.07em' }}>Monthly limits · {fmt(totalLimit)} total</div>
        <div style={{ margin: '0 20px', padding: '2px 14px', borderRadius: 20, background: CARD, border: `1px solid ${LINE}` }}>
          {CATS.map((c, i) => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: i < CATS.length - 1 ? `1px solid ${LINE}` : 'none' }}>
              {catChip(c, 34)}
              <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{c.name}</span>
              <button type="button" onClick={() => setLimits((l) => ({ ...l, [c.id]: Math.max(10, l[c.id] - 10) }))} aria-label={`Lower ${c.name} limit`} style={stepBtn}><Icon name="minus" size={16} /></button>
              <span style={{ minWidth: 58, textAlign: 'center', fontSize: 14, fontWeight: 700 }}>{fmt(limits[c.id], 0)}</span>
              <button type="button" onClick={() => setLimits((l) => ({ ...l, [c.id]: l[c.id] + 10 }))} aria-label={`Raise ${c.name} limit`} style={stepBtn}><Icon name="plus" size={16} /></button>
            </div>
          ))}
        </div>
        <div style={{ margin: '14px 20px 0', padding: '12px 14px', borderRadius: 20, background: CARD, border: `1px solid ${LINE}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, fontWeight: 600 }}><Icon name="bell" size={20} color={accent} /> Over-budget alerts</span>
          <button type="button" role="switch" aria-checked={alerts} aria-label="Over-budget alerts" onClick={() => (setAlerts(!alerts), say(alerts ? 'Alerts off' : 'Alerts on'))} style={{ width: 48, height: 28, borderRadius: 14, border: 'none', padding: 3, background: alerts ? accent : '#c9c8b8', cursor: 'pointer', transition: 'background .2s' }}>
            <span style={{ display: 'block', width: 22, height: 22, borderRadius: '50%', background: '#fff', transform: `translateX(${alerts ? 20 : 0}px)`, transition: 'transform .2s' }} />
          </button>
        </div>
        <div style={{ padding: '14px 20px' }}>
          <button type="button" onClick={() => (setExpenses(SEED), setLimits(Object.fromEntries(CATS.map((c) => [c.id, c.limit]))), setCur(startCurrency), setForm({ amt: '', cat: 'food', note: '' }), say('Demo data reset'))} style={{ ...pill('#ebe4cf', INK), width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Icon name="reset" size={18} /> Reset demo data
          </button>
        </div>
      </>
    )
  }

  const phone = (
    <div style={{ position: 'relative', width: W, height: H, overflow: 'hidden', borderRadius: frame ? 46 : 0, background: BG, color: INK, fontFamily: "'Avenir Next', 'Segoe UI', system-ui, sans-serif" }}>
      <style>{`
        @keyframes bd-r { from { opacity: 0; transform: translateX(34px) } to { opacity: 1; transform: none } }
        @keyframes bd-l { from { opacity: 0; transform: translateX(-34px) } to { opacity: 1; transform: none } }
        @keyframes bd-up { from { transform: scaleY(0) } to { transform: scaleY(1) } }
        .bd-ring { transition: stroke-dashoffset .7s cubic-bezier(.2,.8,.2,1), stroke .3s }
        .bd-bar { transition: width .6s cubic-bezier(.2,.8,.2,1) }
        .bd-grow { transform-origin: bottom; animation: bd-up .5s cubic-bezier(.2,.8,.2,1) both; transition: height .4s, opacity .2s, background .2s }
        .bd-scroll { scrollbar-width: none } .bd-scroll::-webkit-scrollbar { display: none }
        .bd-app button:focus-visible, .bd-app input:focus-visible { outline: 2px solid ${accent}; outline-offset: 2px }
        .bd-app button:disabled { cursor: default }
        @media (prefers-reduced-motion: reduce) {
          .bd-page, .bd-grow { animation: none !important }
          .bd-ring, .bd-bar, .bd-toast { transition: none !important }
        }
      `}</style>
      <StatusBar frame={frame} />
      <div key={`${tab}/${stack.map((s) => s.id).join('/')}`} className="bd-scroll bd-page" style={{ position: 'absolute', top: 54, bottom: tabbed ? 86 : 0, left: 0, right: 0, overflowY: 'auto', paddingBottom: 24, animation: `${dir > 0 ? 'bd-r' : 'bd-l'} .28s ease` }}>
        {body}
      </div>
      {tabbed && (
        <nav aria-label="Main" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 86, background: CARD, borderTop: `1px solid ${LINE}`, display: 'flex', justifyContent: 'space-around', padding: '8px 4px 0' }}>
          {NAV.map(([id, icon, label]) =>
            id === 'add' ? (
              <button key={id} type="button" onClick={() => go(id)} aria-label="Add expense" aria-current={tab === id ? 'page' : undefined} style={{ border: 'none', cursor: 'pointer', width: 54, height: 54, marginTop: -4, borderRadius: 20, background: accent, color: '#fff', display: 'grid', placeItems: 'center', boxShadow: `0 8px 18px ${accent}66`, outline: tab === id ? `3px solid ${accent}55` : 'none' }}>
                <Icon name="plus" size={28} w={2.4} />
              </button>
            ) : (
              <button key={id} type="button" onClick={() => go(id)} aria-current={tab === id ? 'page' : undefined} style={{ border: 'none', background: 'none', font: 'inherit', cursor: 'pointer', display: 'grid', justifyItems: 'center', alignContent: 'start', gap: 3, width: 64, height: 54, fontSize: 10.500, fontWeight: 600, color: tab === id ? accent : MUTED }}>
                <Icon name={icon} size={23} />
                {label}
              </button>
            )
          )}
        </nav>
      )}
      <div className="bd-toast" role="status" style={{ position: 'absolute', left: '50%', top: 58, zIndex: 30, transform: `translate(-50%, ${toast ? 0 : -90}px)`, transition: 'transform .35s cubic-bezier(.2,.8,.2,1)', padding: '10px 16px', borderRadius: 20, background: INK, color: '#fff', fontSize: 12.500, fontWeight: 600, whiteSpace: 'nowrap', maxWidth: 350, overflow: 'hidden', textOverflow: 'ellipsis' }}>{toast}</div>
      <div style={{ position: 'absolute', left: '50%', bottom: 8, width: 140, height: 5, marginLeft: -70, borderRadius: 3, background: INK, opacity: 0.8, zIndex: 25 }} />
    </div>
  )

  return (
    <div ref={box} className="bd-app" style={{ position: 'relative', width: '100%', height: '100%', display: 'grid', placeItems: 'center', overflow: 'hidden', background: 'radial-gradient(ellipse at 50% 30%, #efe7d0, #c9c3a6 75%)', ...style }}>
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: `translate(-50%, -50%) scale(${scale})`, transformOrigin: 'center' }}>
        {frame ? (
          <div style={{ padding: 12, borderRadius: 58, background: 'linear-gradient(145deg, #4a4a40, #1a1a15 40%, #34342b)', boxShadow: '0 40px 80px rgba(35,48,31,.35), inset 0 0 0 2px #5a5a4c' }}>
            <div style={{ padding: 2, borderRadius: 48, background: '#000' }}>{phone}</div>
          </div>
        ) : (
          phone
        )}
      </div>
    </div>
  )

  function row(label, value) {
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '13px 0', borderBottom: `1px solid ${LINE}`, fontSize: 14 }}>
        <span style={{ color: MUTED }}>{label}</span>
        <span style={{ fontWeight: 600 }}>{value}</span>
      </div>
    )
  }
}

const SERIF = "Georgia, 'Iowan Old Style', 'Times New Roman', serif"
const iconBtn = { display: 'grid', placeItems: 'center', borderRadius: '50%', cursor: 'pointer', padding: 0, color: INK }
const stepBtn = { width: 30, height: 30, borderRadius: 10, border: `1px solid ${LINE}`, background: BG, color: INK, display: 'grid', placeItems: 'center', cursor: 'pointer', padding: 0 }
const linkBtn = (c) => ({ border: 'none', background: 'none', padding: 0, font: 'inherit', fontSize: 13, color: c, fontWeight: 700, cursor: 'pointer' })
const pill = (bg, color) => ({ height: 46, padding: '0 16px', borderRadius: 23, border: 'none', background: bg, color, font: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer' })
