import { useEffect, useRef, useState } from 'react'

// An expense-scanner app on a phone, as a click-through prototype. Five tabs:
// Scan (an SVG receipt "photo" in a viewfinder; a scan line sweeps down it and
// line items are detected one by one with boxes and confidence labels, no real
// camera), Review (edit each item's name, amount and category chip, remove or
// add lines, with the totals recomputed live; Save files it into History),
// Categories (a donut chart for this receipt or all history, tap a slice for its
// items), History (grouped by month with live search, tap for detail / delete)
// and Export (CSV or PDF-style, scope, a generated preview and a working Copy
// button). The phone scales to fit its box.

const W = 390
const H = 844
const BG = '#0c1210'
const SURF = '#151e1a'
const SURF2 = '#1f2b26'
const INK = '#e8f2ec'
const MUTED = '#7e978b'
const LINE = '#26352e'
const TAX = 0.065

const CATS = [
  ['Groceries', '#6ee7a8'],
  ['Dining', '#fbbf5c'],
  ['Household', '#60a5fa'],
  ['Health', '#f472b6'],
  ['Transport', '#a78bfa'],
  ['Other', '#94a3b8'],
]
const CCOL = Object.fromEntries(CATS)

const num = (s) => {
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : 0
}
const money = (n) => `$${(Math.round(n * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const sumOf = (items) => items.reduce((s, i) => s + num(i.amt), 0)
const totalOf = (items) => sumOf(items) * (1 + TAX)
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const monthOf = (d) => `${MONTHS[+d.slice(5, 7) - 1]} ${d.slice(0, 4)}`
const dayOf = (d) => `${MONTHS[+d.slice(5, 7) - 1].slice(0, 3)} ${+d.slice(8, 10)}`

const mk = (merchant, rows) => ({ merchant, items: rows.map(([name, amt, cat], i) => ({ id: `${merchant}${i}`, name, amt: String(amt), cat })) })
const SAMPLES = [
  mk('Green Basket Market', [['Organic bananas', 3.49, 'Groceries'], ['Oat milk 1L', 4.99, 'Groceries'], ['Sourdough loaf', 6.25, 'Groceries'], ['Dish soap', 3.89, 'Household'], ['Vitamin C 60ct', 12.49, 'Health'], ['Salmon fillet', 14.8, 'Groceries'], ['Dark chocolate', 4.25, 'Groceries'], ['Paper towels', 8.99, 'Household']]),
  mk('Corner Cafe', [['Flat white', 4.6, 'Dining'], ['Almond croissant', 4.2, 'Dining'], ['Avocado toast', 11.5, 'Dining'], ['Cold brew', 5.0, 'Dining'], ['Bus ticket', 2.75, 'Transport']]),
]

const HIST0 = [
  { id: 'h1', date: '2026-11-09', ...mk('Whole Foods', [['Produce', 31.2, 'Groceries'], ['Eggs', 5.4, 'Groceries'], ['Cheese', 9.8, 'Groceries']]) },
  { id: 'h2', date: '2026-11-05', ...mk('Blue Door Bistro', [['Pasta', 18.5, 'Dining'], ['Wine', 12, 'Dining']]) },
  { id: 'h3', date: '2026-11-02', ...mk('City Pharmacy', [['Allergy tablets', 14.99, 'Health'], ['Plasters', 4.5, 'Health']]) },
  { id: 'h4', date: '2026-10-28', ...mk('Hardware Hub', [['Light bulbs', 11.2, 'Household'], ['Batteries', 9.5, 'Household'], ['Tape', 3.2, 'Household']]) },
  { id: 'h5', date: '2026-10-19', ...mk('Metro Transit', [['Monthly pass', 64, 'Transport']]) },
  { id: 'h6', date: '2026-10-11', ...mk('Corner Cafe', [['Latte', 4.8, 'Dining'], ['Muffin', 3.9, 'Dining']]) },
  { id: 'h7', date: '2026-09-30', ...mk('Green Basket Market', [['Rice 5kg', 12.5, 'Groceries'], ['Chicken', 13.2, 'Groceries'], ['Soap', 2.9, 'Household']]) },
  { id: 'h8', date: '2026-09-14', ...mk('Sunrise Diner', [['Pancakes', 9.5, 'Dining'], ['Coffee', 3, 'Dining']]) },
]

const NAV = [
  ['scan', 'scan', 'Scan'],
  ['review', 'list', 'Review'],
  ['categories', 'pie', 'Categories'],
  ['history', 'clock', 'History'],
  ['export', 'share', 'Export'],
]
const ICONS = {
  scan: 'M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M4 12h16',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  pie: 'M12 3v9h9a9 9 0 1 1-9-9zM15 3.5A9 9 0 0 1 20.500 9H15z',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  share: 'M12 4v11m0-11L8 8m4-4l4 4M5 13v6a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-6',
  back: 'M15 5l-7 7 7 7',
  chev: 'M9 5l7 7-7 7',
  check: 'M5 12l5 5 9-10',
  x: 'M6 6l12 12M18 6L6 18',
  plus: 'M12 5v14M5 12h14',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  copy: 'M9 9h10v11H9zM5 15V4h10',
  trash: 'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13',
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
      <svg width="44" height="12" viewBox="0 0 44 12" aria-hidden="true">
        <g fill={INK}>
          <rect x="0" y="7" width="3" height="4" rx="1" />
          <rect x="5" y="5" width="3" height="6" rx="1" />
          <rect x="10" y="2.5" width="3" height="8.5" rx="1" />
          <rect x="15" y="0" width="3" height="11" rx="1" />
        </g>
        <rect x="21.5" y="0.5" width="22" height="11" rx="3.5" fill="none" stroke={INK} opacity=".45" />
        <rect x="23.5" y="2.5" width="16" height="7" rx="2" fill={INK} />
      </svg>
    </div>
  )
}

// ------------------------------------------------------------ receipt "photo" (stable component)

const ROW0 = 112
const ROWH = 28
function Photo({ merchant, items, progress, accent, done }) {
  const total = sumOf(items)
  const paperBottom = ROW0 + items.length * ROWH + 74
  const scanY = 30 + progress * (paperBottom - 20)
  const scanning = progress > 0 && progress < 1
  return (
    <svg viewBox={`0 0 300 ${Math.max(380, paperBottom + 30)}`} height="372" role="img" aria-label="Receipt photo" style={{ display: 'block', margin: '0 auto', maxWidth: '100%' }}>
      <defs>
        <linearGradient id="rc-sweep" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={accent} stopOpacity="0" />
          <stop offset="1" stopColor={accent} stopOpacity=".5" />
        </linearGradient>
        <filter id="rc-sh" x="-20%" y="-10%" width="140%" height="130%">
          <feDropShadow dx="0" dy="6" stdDeviation="7" floodColor="#000" floodOpacity=".5" />
        </filter>
      </defs>
      <g transform="rotate(-1.6 150 190)">
        <path d={`M40 14 H260 V${paperBottom} ${Array.from({ length: 11 }, (_, i) => `L${260 - (i + 1) * 20},${paperBottom + (i % 2 ? 0 : 9)}`).join(' ')} Z`} fill="#f5f1e6" filter="url(#rc-sh)" />
        <g fontFamily="ui-monospace, Menlo, Consolas, monospace" fill="#3c3a33">
          <text x="150" y="44" textAnchor="middle" fontSize="14" fontWeight="800" letterSpacing="1.5">{merchant.toUpperCase().slice(0, 22)}</text>
          <text x="150" y="60" textAnchor="middle" fontSize="8" fill="#8b867a">TEL 555-0142 · 18 NOV 2026 · 12:41</text>
          <line x1="52" y1="72" x2="248" y2="72" stroke="#b9b3a2" strokeDasharray="2 3" />
          <text x="52" y="90" fontSize="8" fill="#8b867a">QTY  ITEM</text>
          <text x="248" y="90" fontSize="8" fill="#8b867a" textAnchor="end">PRICE</text>
          {items.map((it, i) => {
            const y = ROW0 + i * ROWH
            const seen = done || scanY > y + 8
            return (
              <g key={it.id}>
                <text x="52" y={y} fontSize="10.5" opacity={seen ? 1 : 0.35}>1  {it.name.slice(0, 20)}</text>
                <text x="248" y={y} fontSize="10.5" textAnchor="end" opacity={seen ? 1 : 0.35}>{num(it.amt).toFixed(2)}</text>
              </g>
            )
          })}
          <line x1="52" y1={ROW0 + items.length * ROWH - 12} x2="248" y2={ROW0 + items.length * ROWH - 12} stroke="#b9b3a2" strokeDasharray="2 3" />
          <text x="52" y={ROW0 + items.length * ROWH + 6} fontSize="9" fill="#8b867a">SUBTOTAL</text>
          <text x="248" y={ROW0 + items.length * ROWH + 6} fontSize="9" fill="#8b867a" textAnchor="end">{total.toFixed(2)}</text>
          <text x="52" y={ROW0 + items.length * ROWH + 22} fontSize="9" fill="#8b867a">TAX 6.5%</text>
          <text x="248" y={ROW0 + items.length * ROWH + 22} fontSize="9" fill="#8b867a" textAnchor="end">{(total * TAX).toFixed(2)}</text>
          <text x="52" y={ROW0 + items.length * ROWH + 44} fontSize="13" fontWeight="800">TOTAL</text>
          <text x="248" y={ROW0 + items.length * ROWH + 44} fontSize="13" fontWeight="800" textAnchor="end">{(total * (1 + TAX)).toFixed(2)}</text>
        </g>
        {/* detected boxes + labels, popping in as the scan line passes */}
        {items.map((it, i) => {
          const y = ROW0 + i * ROWH
          if (!(done || scanY > y + 8)) return null
          const col = CCOL[it.cat] || accent
          return (
            <g key={it.id} className="rc-pop" style={{ transformBox: 'fill-box', transformOrigin: 'left center' }}>
              <rect x="47" y={y - 14} width="206" height="21" rx="4" fill={col} fillOpacity=".12" stroke={col} strokeWidth="1.2" />
              <rect x="47" y={y - 22} width={it.cat.length * 5.4 + 26} height="11" rx="5.5" fill={col} />
              <text x="53" y={y - 14} fontSize="7.5" fontWeight="800" fill="#0c1210" fontFamily="system-ui">{it.cat.toUpperCase()} {97 - ((i * 3) % 7)}%</text>
            </g>
          )
        })}
      </g>
      {scanning && (
        <g>
          <rect x="20" y={scanY - 50} width="260" height="50" fill="url(#rc-sweep)" />
          <line x1="20" y1={scanY} x2="280" y2={scanY} stroke={accent} strokeWidth="2.5" style={{ filter: `drop-shadow(0 0 6px ${accent})` }} />
        </g>
      )}
    </svg>
  )
}

function Donut({ data, total, size = 190, sel, onSel }) {
  const r = 70
  const C = 2 * Math.PI * r
  let acc = 0
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} role="img" aria-label="Spending by category">
      <circle cx="100" cy="100" r={r} fill="none" stroke={SURF2} strokeWidth="26" />
      {data.map(([c, v, col]) => {
        const len = total > 0 ? (v / total) * C : 0
        const el = (
          <circle key={c} cx="100" cy="100" r={r} fill="none" stroke={col} strokeWidth={sel === c ? 32 : 26} strokeDasharray={`${Math.max(0, len - 2)} ${C}`} strokeDashoffset={-acc} transform="rotate(-90 100 100)" onClick={() => onSel(sel === c ? null : c)} style={{ cursor: 'pointer', transition: 'stroke-width .2s, stroke-dasharray .5s', opacity: sel && sel !== c ? 0.35 : 1 }} />
        )
        acc += len
        return el
      })}
      <text x="100" y="96" textAnchor="middle" fontSize="11" fill={MUTED}>{sel || 'Total'}</text>
      <text x="100" y="118" textAnchor="middle" fontSize="20" fontWeight="800" fill={INK}>{money(sel ? (data.find((d) => d[0] === sel) || [0, 0])[1] : total)}</text>
    </svg>
  )
}

// ---------------------------------------------------------------- app

export default function ReceiptApp({ name = 'Tally', accent = '#6ee7a8', startScreen = 'scan', frame = true, style }) {
  const box = useRef()
  const toastTimer = useRef()
  const scanTimer = useRef()
  const copyTimer = useRef()
  const idN = useRef(100)
  const sampleN = useRef(0)
  const fresh = startScreen === 'scan'
  const [scale, setScale] = useState(1)
  const [tab, setTab] = useState(startScreen)
  const [stack, setStack] = useState([])
  const [dir, setDir] = useState(1)
  const [toast, setToast] = useState('')
  const [merchant, setMerchant] = useState(SAMPLES[0].merchant)
  const [items, setItems] = useState(SAMPLES[0].items)
  const [progress, setProgress] = useState(fresh ? 0 : 1)
  const [saved, setSaved] = useState(false)
  const [hist, setHist] = useState(HIST0)
  const [open, setOpen] = useState(null) // expanded review row
  const [scope, setScope] = useState('now')
  const [catScope, setCatScope] = useState('now')
  const [sel, setSel] = useState(null)
  const [query, setQuery] = useState('')
  const [fmt, setFmt] = useState('csv')
  const [copied, setCopied] = useState(false)

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
  useEffect(
    () => () => {
      clearTimeout(toastTimer.current)
      clearTimeout(copyTimer.current)
      clearInterval(scanTimer.current)
    },
    []
  )

  const say = (t) => {
    setToast(t)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 1900)
  }
  const top = stack[stack.length - 1]
  const push = (s) => (setDir(1), setStack((a) => [...a, s]))
  const pop = () => (setDir(-1), setStack((a) => a.slice(0, -1)))
  const go = (t) => (setDir(NAV.findIndex((n) => n[0] === t) > NAV.findIndex((n) => n[0] === tab) ? 1 : -1), setTab(t), setStack([]))

  const startScan = (next) => {
    clearInterval(scanTimer.current)
    if (next) {
      sampleN.current = (sampleN.current + 1) % SAMPLES.length
      const s = SAMPLES[sampleN.current]
      setMerchant(s.merchant)
      setItems(s.items.map((i) => ({ ...i })))
    }
    setSaved(false)
    setOpen(null)
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setProgress(1)
      return
    }
    let p = 0.001
    setProgress(p)
    scanTimer.current = setInterval(() => {
      p += 0.016
      if (p >= 1) {
        p = 1
        clearInterval(scanTimer.current)
      }
      setProgress(p)
    }, 34)
  }

  const setItem = (id, patch) => (setItems((a) => a.map((i) => (i.id === id ? { ...i, ...patch } : i))), setSaved(false))
  const addLine = () => {
    const id = `n${++idN.current}`
    setItems((a) => [...a, { id, name: 'New item', amt: '0.00', cat: 'Other' }])
    setOpen(id)
    setSaved(false)
  }
  const save = () => {
    if (saved) return say('Already saved')
    const d = new Date()
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    setHist((h) => [{ id: `h${++idN.current}`, date, merchant, items: items.map((i) => ({ ...i })) }, ...h])
    setSaved(true)
    say('Saved to History')
  }

  const scanning = progress > 0 && progress < 1
  const nowReceipt = { id: 'now', date: '2026-11-18', merchant, items }
  const allRows = (list) => list.flatMap((r) => r.items.map((i) => ({ ...i, merchant: r.merchant, date: r.date })))

  // ---- shared bits
  const header = (title, back, right) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 18px 8px', minHeight: 52 }}>
      {back && (
        <button type="button" onClick={back} aria-label="Back" style={{ display: 'grid', placeItems: 'center', width: 38, height: 38, borderRadius: '50%', border: 'none', background: SURF, color: INK, cursor: 'pointer', padding: 0 }}>
          <Icon name="back" size={20} />
        </button>
      )}
      <h1 style={{ margin: 0, flex: 1, fontSize: back ? 18 : 26, fontWeight: 800, letterSpacing: '-0.02em' }}>{title}</h1>
      {right}
    </div>
  )
  const chip = (label, on, fn, col, key) => (
    <button key={key || label} type="button" onClick={fn} aria-pressed={on} style={{ flex: 'none', height: 32, padding: '0 12px', borderRadius: 16, border: `1.5px solid ${on ? col || accent : LINE}`, background: on ? (col || accent) : 'transparent', color: on ? '#0c1210' : INK, font: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>{label}</button>
  )
  const primary = (label, onClick, disabled, ghost) => (
    <button type="button" disabled={disabled} onClick={onClick} style={{ width: '100%', height: 52, borderRadius: 16, border: ghost ? `1.5px solid ${LINE}` : 'none', background: ghost ? 'transparent' : disabled ? '#2a3a33' : accent, color: ghost ? INK : disabled ? MUTED : '#0c1210', font: 'inherit', fontSize: 15, fontWeight: 800, cursor: disabled ? 'default' : 'pointer' }}>{label}</button>
  )
  const card = { margin: '0 18px', padding: 16, background: SURF, borderRadius: 20 }
  const field = { height: 38, borderRadius: 10, border: `1px solid ${LINE}`, background: SURF2, padding: '0 10px', font: 'inherit', fontSize: 14, color: INK, minWidth: 0 }
  const totals = (list) => (
    <div style={{ ...card, marginTop: 12 }}>
      {[['Subtotal', sumOf(list)], [`Tax ${(TAX * 100).toFixed(1)}%`, sumOf(list) * TAX]].map(([l, v]) => (
        <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13.5, color: MUTED }}><span>{l}</span><span>{money(v)}</span></div>
      ))}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0 0', marginTop: 4, borderTop: `1px solid ${LINE}`, fontSize: 18, fontWeight: 800 }}><span>Total</span><span style={{ color: accent }}>{money(totalOf(list))}</span></div>
    </div>
  )

  // ---- export text
  const buildExport = () => {
    const rows = scope === 'now' ? [nowReceipt] : [...hist].sort((a, b) => (a.date < b.date ? 1 : -1))
    if (fmt === 'csv') {
      const q = (s) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)
      return ['date,merchant,item,category,amount', ...allRows(rows).map((r) => [r.date, q(r.merchant), q(r.name), r.cat, num(r.amt).toFixed(2)].join(','))].join('\n')
    }
    const L = []
    L.push(`${name.toUpperCase()}  EXPENSE REPORT`, '='.repeat(40))
    rows.forEach((r) => {
      L.push(`${r.merchant}  (${dayOf(r.date)})`)
      r.items.forEach((i) => L.push(`  ${i.name.slice(0, 24).padEnd(26)}${num(i.amt).toFixed(2).padStart(10)}`))
      L.push(`  ${'Total incl. tax'.padEnd(26)}${totalOf(r.items).toFixed(2).padStart(10)}`, '-'.repeat(40))
    })
    L.push(`GRAND TOTAL ${money(rows.reduce((s, r) => s + totalOf(r.items), 0))}`)
    return L.join('\n')
  }
  const copyExport = async () => {
    const text = buildExport()
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      try {
        const ta = document.createElement('textarea')
        ta.value = text
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        ta.remove()
      } catch { /* clipboard unavailable: still show the confirmation */ }
    }
    setCopied(true)
    clearTimeout(copyTimer.current)
    copyTimer.current = setTimeout(() => setCopied(false), 1800)
    say('Copied to clipboard')
  }

  // ---- screens
  let body
  let tabbed = true
  if (top?.id === 'receipt') {
    tabbed = false
    const r = hist.find((x) => x.id === top.rid)
    body = !r ? header('Receipt', pop) : (
      <>
        {header(r.merchant, pop)}
        <div style={{ padding: '0 18px 12px', color: MUTED, fontSize: 13 }}>{dayOf(r.date)}, {r.date.slice(0, 4)} - {r.items.length} items</div>
        <div style={card}>
          {r.items.map((i) => (
            <div key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: `1px solid ${LINE}`, fontSize: 14 }}>
              <i style={{ width: 9, height: 9, borderRadius: '50%', background: CCOL[i.cat] || MUTED }} />
              <span style={{ flex: 1 }}>{i.name}<span style={{ color: MUTED, fontSize: 11.5 }}> - {i.cat}</span></span>
              <b>{money(num(i.amt))}</b>
            </div>
          ))}
        </div>
        {totals(r.items)}
        <div style={{ padding: '16px 18px', display: 'grid', gap: 10 }}>
          {primary('Load into Review', () => (setMerchant(r.merchant), setItems(r.items.map((i) => ({ ...i }))), setProgress(1), setSaved(true), go('review'), say('Loaded')))}
          <button type="button" onClick={() => (setHist((h) => h.filter((x) => x.id !== r.id)), pop(), say('Receipt deleted'))} style={{ height: 44, border: 'none', background: 'none', color: '#f87171', font: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><Icon name="trash" size={17} /> Delete receipt</button>
        </div>
      </>
    )
  } else if (tab === 'scan') {
    const found = Math.min(items.length, items.filter((_, i) => progress >= 1 || 30 + progress * (ROW0 + items.length * ROWH + 54) > ROW0 + i * ROWH + 8).length)
    body = (
      <>
        {header('Scan receipt', null, <button type="button" onClick={() => (startScan(true), say('Loaded another sample'))} style={{ height: 34, padding: '0 12px', borderRadius: 17, border: `1px solid ${LINE}`, background: SURF, color: INK, font: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>Try another</button>)}
        <div style={{ position: 'relative', margin: '0 18px', padding: '14px 12px 8px', borderRadius: 24, background: 'radial-gradient(ellipse at 50% 40%, #26352e, #0a0f0d 80%)', overflow: 'hidden' }}>
          <Photo merchant={merchant} items={items} progress={progress} accent={accent} done={progress >= 1} />
          {[[0, 0], [1, 0], [0, 1], [1, 1]].map(([x, y]) => (
            <span key={`${x}${y}`} aria-hidden="true" style={{ position: 'absolute', [x ? 'right' : 'left']: 12, [y ? 'bottom' : 'top']: 12, width: 24, height: 24, borderColor: accent, borderStyle: 'solid', borderWidth: `${y ? 0 : 3}px ${x ? 3 : 0}px ${y ? 3 : 0}px ${x ? 0 : 3}px`, borderRadius: 6 }} />
          ))}
        </div>
        <div style={{ textAlign: 'center', padding: '14px 18px 4px' }}>
          <div style={{ fontSize: 15, fontWeight: 800 }}>{progress === 0 ? 'Align the receipt in the frame' : scanning ? `Scanning... ${Math.round(progress * 100)}%` : `${items.length} items detected - ${money(totalOf(items))}`}</div>
          <div style={{ fontSize: 12.5, color: MUTED, marginTop: 3, minHeight: 18 }}>{scanning ? `${found} of ${items.length} line items read` : progress >= 1 ? `${merchant} - tax and total matched` : 'Tap the shutter to capture'}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 26, padding: '8px 18px' }}>
          <button type="button" onClick={() => (startScan(true), say('Picked from gallery'))} aria-label="Pick from gallery" style={{ width: 46, height: 46, borderRadius: 14, border: `1px solid ${LINE}`, background: SURF, color: INK, display: 'grid', placeItems: 'center', cursor: 'pointer' }}><Icon name="plus" size={20} /></button>
          <button type="button" onClick={() => startScan(false)} disabled={scanning} aria-label={progress >= 1 ? 'Rescan' : 'Capture'} style={{ width: 70, height: 70, borderRadius: '50%', border: `4px solid ${accent}`, background: 'transparent', padding: 4, cursor: scanning ? 'default' : 'pointer' }}>
            <span style={{ display: 'block', width: '100%', height: '100%', borderRadius: '50%', background: scanning ? SURF2 : accent }} />
          </button>
          <button type="button" onClick={() => progress >= 1 ? go('review') : say('Scan a receipt first')} aria-label="Review items" style={{ width: 46, height: 46, borderRadius: 14, border: `1px solid ${progress >= 1 ? accent : LINE}`, background: SURF, color: progress >= 1 ? accent : MUTED, display: 'grid', placeItems: 'center', cursor: 'pointer' }}><Icon name="chev" size={20} /></button>
        </div>
        {progress >= 1 && <div style={{ padding: '6px 18px' }}>{primary('Review items', () => go('review'))}</div>}
      </>
    )
  } else if (tab === 'review') {
    body = (
      <>
        {header('Review items', null, <span style={{ fontSize: 12.5, color: MUTED }}>{merchant}</span>)}
        <div style={{ display: 'grid', gap: 8, padding: '0 18px' }}>
          {items.map((it) => (
            <div key={it.id} style={{ padding: 10, background: SURF, borderRadius: 16, border: `1px solid ${open === it.id ? CCOL[it.cat] || accent : 'transparent'}` }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input value={it.name} onChange={(e) => setItem(it.id, { name: e.target.value })} aria-label="Item name" style={{ ...field, flex: 1 }} />
                <span style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 9, top: 9, color: MUTED, fontSize: 14 }}>$</span>
                  <input value={it.amt} onChange={(e) => setItem(it.id, { amt: e.target.value.replace(/[^0-9.]/g, '') })} inputMode="decimal" aria-label="Amount" style={{ ...field, width: 78, paddingLeft: 20, textAlign: 'right' }} />
                </span>
                <button type="button" onClick={() => (setItems((a) => a.filter((x) => x.id !== it.id)), setSaved(false))} aria-label={`Remove ${it.name}`} style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', background: SURF2, color: MUTED, display: 'grid', placeItems: 'center', cursor: 'pointer', padding: 0 }}><Icon name="x" size={14} /></button>
              </div>
              <button type="button" onClick={() => setOpen(open === it.id ? null : it.id)} style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', background: 'none', padding: 0, font: 'inherit', fontSize: 12, color: MUTED, cursor: 'pointer' }}>
                <i style={{ width: 9, height: 9, borderRadius: '50%', background: CCOL[it.cat] }} /> {it.cat} {open === it.id ? '(choose below)' : '- change'}
              </button>
              {open === it.id && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  {CATS.map(([c, col]) => chip(c, it.cat === c, () => setItem(it.id, { cat: c }), col))}
                </div>
              )}
            </div>
          ))}
          <button type="button" onClick={addLine} style={{ height: 46, borderRadius: 16, border: `1.5px dashed ${LINE}`, background: 'none', color: accent, font: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>+ Add line</button>
        </div>
        {totals(items)}
        <div style={{ padding: '14px 18px', display: 'grid', gap: 10 }}>
          {primary(saved ? 'Saved' : 'Save receipt', save, saved || items.length === 0)}
          {saved && primary('Go to History', () => go('history'), false, true)}
        </div>
      </>
    )
  } else if (tab === 'categories') {
    const rows = catScope === 'now' ? [nowReceipt] : hist
    const flat = allRows(rows)
    const data = CATS.map(([c, col]) => [c, flat.filter((i) => i.cat === c).reduce((s, i) => s + num(i.amt), 0), col]).filter((d) => d[1] > 0)
    const total = data.reduce((s, d) => s + d[1], 0)
    body = (
      <>
        {header('Categories')}
        <div style={{ display: 'flex', gap: 8, padding: '0 18px 8px' }}>{chip('This receipt', catScope === 'now', () => (setCatScope('now'), setSel(null)))}{chip('All history', catScope === 'all', () => (setCatScope('all'), setSel(null)))}</div>
        <div style={{ display: 'grid', placeItems: 'center', padding: '4px 0 6px' }}>
          <Donut data={data} total={total} sel={sel} onSel={setSel} />
        </div>
        <div style={{ display: 'grid', gap: 6, padding: '0 18px' }}>
          {data.map(([c, v, col]) => (
            <button key={c} type="button" onClick={() => setSel(sel === c ? null : c)} aria-pressed={sel === c} style={{ display: 'flex', alignItems: 'center', gap: 10, height: 44, padding: '0 14px', borderRadius: 14, border: `1.5px solid ${sel === c ? col : 'transparent'}`, background: SURF, color: INK, font: 'inherit', fontSize: 14, cursor: 'pointer', textAlign: 'left' }}>
              <i style={{ width: 12, height: 12, borderRadius: 4, background: col }} />
              <span style={{ flex: 1, fontWeight: 700 }}>{c}</span>
              <span style={{ color: MUTED, fontSize: 12.5 }}>{Math.round((v / total) * 100)}%</span>
              <b style={{ width: 70, textAlign: 'right' }}>{money(v)}</b>
            </button>
          ))}
        </div>
        {sel && (
          <div style={{ ...card, marginTop: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: CCOL[sel], marginBottom: 6 }}>{sel} items</div>
            {flat.filter((i) => i.cat === sel).map((i) => (
              <div key={`${i.id}${i.date}`} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13 }}><span>{i.name} <span style={{ color: MUTED }}>- {i.merchant}</span></span><b>{money(num(i.amt))}</b></div>
            ))}
          </div>
        )}
      </>
    )
  } else if (tab === 'history') {
    const q = query.trim().toLowerCase()
    const list = [...hist].sort((a, b) => (a.date < b.date ? 1 : -1)).filter((r) => !q || r.merchant.toLowerCase().includes(q) || r.items.some((i) => i.name.toLowerCase().includes(q) || i.cat.toLowerCase().includes(q)))
    const months = [...new Set(list.map((r) => monthOf(r.date)))]
    body = (
      <>
        {header('History')}
        <div style={{ position: 'relative', margin: '0 18px 10px' }}>
          <span style={{ position: 'absolute', left: 12, top: 11, color: MUTED }}><Icon name="search" size={18} /></span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search merchant, item or category" aria-label="Search history" style={{ ...field, width: '100%', boxSizing: 'border-box', height: 44, borderRadius: 14, paddingLeft: 38 }} />
        </div>
        {months.map((m) => {
          const rs = list.filter((r) => monthOf(r.date) === m)
          return (
            <div key={m} style={{ padding: '0 18px 10px', display: 'grid', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 800, color: MUTED, textTransform: 'uppercase', letterSpacing: '.06em', padding: '6px 2px 0' }}><span>{m}</span><span>{money(rs.reduce((s, r) => s + totalOf(r.items), 0))}</span></div>
              {rs.map((r) => {
                const main = CATS.map(([c]) => [c, r.items.filter((i) => i.cat === c).reduce((s, i) => s + num(i.amt), 0)]).sort((a, b) => b[1] - a[1])[0][0]
                return (
                  <button key={r.id} type="button" onClick={() => push({ id: 'receipt', rid: r.id })} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 12px', border: 'none', borderRadius: 16, background: SURF, color: INK, font: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
                    <span style={{ width: 40, height: 40, borderRadius: 12, display: 'grid', placeItems: 'center', background: `${CCOL[main]}26`, color: CCOL[main], fontWeight: 800, fontSize: 15 }}>{r.merchant[0]}</span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.merchant}</span>
                      <span style={{ display: 'block', fontSize: 12, color: MUTED }}>{dayOf(r.date)} - {r.items.length} items - {main}</span>
                    </span>
                    <b style={{ fontSize: 14.5 }}>{money(totalOf(r.items))}</b>
                  </button>
                )
              })}
            </div>
          )
        })}
        {!list.length && <div style={{ textAlign: 'center', color: MUTED, fontSize: 13, padding: '34px 0' }}>No receipts match "{query}".</div>}
      </>
    )
  } else {
    const text = buildExport()
    body = (
      <>
        {header('Export')}
        <div style={{ padding: '0 18px 6px', fontSize: 12, color: MUTED, fontWeight: 700 }}>FORMAT</div>
        <div style={{ display: 'flex', gap: 8, padding: '0 18px 10px' }}>{chip('CSV', fmt === 'csv', () => setFmt('csv'))}{chip('PDF', fmt === 'pdf', () => setFmt('pdf'))}</div>
        <div style={{ padding: '0 18px 6px', fontSize: 12, color: MUTED, fontWeight: 700 }}>WHAT</div>
        <div style={{ display: 'flex', gap: 8, padding: '0 18px 12px' }}>{chip('This receipt', scope === 'now', () => setScope('now'))}{chip(`All history (${hist.length})`, scope === 'all', () => setScope('all'))}</div>
        <div style={{ margin: '0 18px', borderRadius: 16, background: fmt === 'pdf' ? '#f5f1e6' : '#050807', border: `1px solid ${LINE}`, overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: fmt === 'pdf' ? '#e4ddca' : SURF, fontSize: 11, fontWeight: 800, color: fmt === 'pdf' ? '#3c3a33' : MUTED }}><span>PREVIEW</span><span>{fmt === 'pdf' ? 'expense-report.pdf' : 'expenses.csv'}</span></div>
          <pre tabIndex={0} className="rc-scroll" style={{ margin: 0, padding: 12, maxHeight: 250, overflow: 'auto', fontSize: 10.5, lineHeight: 1.5, color: fmt === 'pdf' ? '#2b2a25' : accent, fontFamily: "ui-monospace, Menlo, Consolas, monospace", whiteSpace: 'pre' }}>{text}</pre>
        </div>
        <div style={{ padding: '14px 18px', display: 'grid', gap: 10 }}>
          <button type="button" onClick={copyExport} style={{ height: 52, borderRadius: 16, border: 'none', background: copied ? '#fff' : accent, color: '#0c1210', font: 'inherit', fontSize: 15, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Icon name={copied ? 'check' : 'copy'} size={18} w={2.4} /> {copied ? 'Copied!' : 'Copy to clipboard'}
          </button>
          {primary('Download file', () => {
            try {
              const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }))
              const a = document.createElement('a')
              a.href = url
              a.download = fmt === 'csv' ? 'expenses.csv' : 'expense-report.txt'
              a.click()
              setTimeout(() => URL.revokeObjectURL(url), 1000)
            } catch { /* download blocked */ }
            say(`${fmt.toUpperCase()} ready`)
          }, false, true)}
        </div>
      </>
    )
  }

  const phone = (
    <div style={{ position: 'relative', width: W, height: H, overflow: 'hidden', borderRadius: frame ? 46 : 0, background: BG, color: INK, fontFamily: "-apple-system, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif" }}>
      <style>{`
        @keyframes rc-r { from { opacity: 0; transform: translateX(34px) } to { opacity: 1; transform: none } }
        @keyframes rc-l { from { opacity: 0; transform: translateX(-34px) } to { opacity: 1; transform: none } }
        @keyframes rc-pop { from { opacity: 0; transform: scale(.6) } to { opacity: 1; transform: none } }
        .rc-pop { animation: rc-pop .35s cubic-bezier(.2,1.4,.4,1) both }
        .rc-scroll, .rc-body { scrollbar-width: none } .rc-scroll::-webkit-scrollbar, .rc-body::-webkit-scrollbar { display: none }
        .rc-app button:focus-visible, .rc-app input:focus-visible { outline: 2px solid ${accent}; outline-offset: 2px }
        .rc-app input::placeholder { color: #5d776a }
        @media (prefers-reduced-motion: reduce) { .rc-app * { animation: none !important; transition: none !important } }
      `}</style>
      <StatusBar frame={frame} />
      <div key={`${tab}/${stack.map((s) => s.id + (s.rid || '')).join('/')}`} className="rc-body" style={{ position: 'absolute', top: 54, bottom: tabbed ? 84 : 0, left: 0, right: 0, overflowY: 'auto', paddingBottom: 20, animation: `${dir > 0 ? 'rc-r' : 'rc-l'} .28s ease` }}>
        {body}
      </div>
      {tabbed && (
        <nav aria-label="Main" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 84, background: '#101814', borderTop: `1px solid ${LINE}`, display: 'flex', justifyContent: 'space-around', padding: '9px 4px 0', zIndex: 5 }}>
          {NAV.map(([id, icon, label]) => (
            <button key={id} type="button" onClick={() => go(id)} aria-current={tab === id ? 'page' : undefined} style={{ border: 'none', background: 'none', font: 'inherit', cursor: 'pointer', display: 'grid', justifyItems: 'center', alignContent: 'start', gap: 3, width: 70, height: 54, fontSize: 10.5, fontWeight: 700, color: tab === id ? accent : MUTED }}>
              <Icon name={icon} size={23} />
              {label}
            </button>
          ))}
        </nav>
      )}
      <div role="status" style={{ position: 'absolute', left: '50%', top: 58, zIndex: 60, transform: `translate(-50%, ${toast ? 0 : -90}px)`, transition: 'transform .35s cubic-bezier(.2,.8,.2,1)', padding: '10px 16px', borderRadius: 20, background: accent, color: '#0c1210', fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap' }}>{toast}</div>
      <div style={{ position: 'absolute', left: '50%', bottom: 8, width: 140, height: 5, marginLeft: -70, borderRadius: 3, background: INK, opacity: 0.7, zIndex: 55 }} />
    </div>
  )

  return (
    <div ref={box} className="rc-app" style={{ position: 'relative', width: '100%', height: '100%', display: 'grid', placeItems: 'center', overflow: 'hidden', background: 'radial-gradient(ellipse at 50% 30%, #1d2c25, #070b09 80%)', ...style }}>
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: `translate(-50%, -50%) scale(${scale})`, transformOrigin: 'center' }}>
        {frame ? (
          <div style={{ padding: 12, borderRadius: 58, background: 'linear-gradient(145deg, #3a423e, #0e1210 40%, #262e2a)', boxShadow: '0 40px 80px rgba(0,0,0,.5), inset 0 0 0 2px #4a544f' }}>
            <div style={{ padding: 2, borderRadius: 48, background: '#000' }}>{phone}</div>
          </div>
        ) : (
          phone
        )}
      </div>
    </div>
  )
}
