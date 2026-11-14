import { useEffect, useRef, useState } from 'react'

// A period and cycle tracker on a phone, as a click-through prototype. Five
// pages (Calendar, Log day, Insights, Predictions, Settings). The month grid is
// phase-coloured (period, fertile window, ovulation, luteal, follicular) from a
// cycle start date, cycle length and period length that Settings edits, so the
// whole grid, the Today ring and the predictions recompute live. Swipe the grid
// or use the arrows to change month; tap a day to log flow, symptoms, mood,
// temperature and notes, which saves and puts dots on the calendar and feeds
// Insights. Predictions lists the next three periods and fertile windows with
// reminder toggles. Privacy settings include a real PIN lock and a hide-on-lock
// preview. Copy is neutral: for tracking only, not medical advice.
// The phone scales to fit whatever box it is in.

const W = 390
const H = 844
const INK = '#2d1b2e'
const MUTED = '#8a7584'
const BG = '#fbf4ef'
const LINE = '#f0e4dd'

const PH = {
  period: { label: 'Period', bg: '#e0446a', fg: '#fff' },
  fertile: { label: 'Fertile window', bg: '#bfe9e2', fg: '#0f5f58' },
  ovulation: { label: 'Ovulation', bg: '#1f9187', fg: '#fff' },
  luteal: { label: 'Luteal', bg: '#e4dbf7', fg: '#4a3a85' },
  follicular: { label: 'Follicular', bg: '#f7e6d3', fg: '#7a5430' },
}
const PH_ORDER = ['period', 'follicular', 'fertile', 'ovulation', 'luteal']

const SYMPTOMS = ['Cramps', 'Headache', 'Bloating', 'Fatigue', 'Tender', 'Cravings', 'Acne', 'Backache']
const MOODS = ['Low', 'Meh', 'Okay', 'Good', 'Great']
const FLOWS = ['None', 'Light', 'Medium', 'Heavy']
const HISTORY = [28, 30, 27, 29, 28, 31]
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const MON = MONTHS.map((m) => m.slice(0, 3))
const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

const NAV = [
  ['calendar', 'cal', 'Calendar'],
  ['log', 'pen', 'Log'],
  ['insights', 'chart', 'Insights'],
  ['predictions', 'clock', 'Predict'],
  ['settings', 'gear', 'Settings'],
]

const ICONS = {
  cal: 'M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zM4 10h16M8 3v4M16 3v4',
  pen: 'M4 20l1-4L16 5l3 3L8 19zM14 7l3 3',
  chart: 'M5 20V11M12 20V5M19 20v-6',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  gear: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4',
  back: 'M15 5l-7 7 7 7',
  chev: 'M9 5l7 7-7 7',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  check: 'M5 12l5 5 9-10',
  bell: 'M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4',
  lock: 'M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  drop: 'M12 3c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11z',
  temp: 'M10 14V5a2 2 0 0 1 4 0v9a4 4 0 1 1-4 0z',
  trash: 'M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v6M12 7.5h.01',
}

function Icon({ name, size = 22, color = 'currentColor', w = 1.9 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  )
}

// ---------------------------------------------------------------- dates + cycle maths

const pad = (n) => String(n).padStart(2, '0')
const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const midnight = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
const diffDays = (a, b) => Math.round((Date.UTC(a.getFullYear(), a.getMonth(), a.getDate()) - Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())) / 864e5)
const fmt = (d) => `${MON[d.getMonth()]} ${d.getDate()}`
const fmtLong = (d) => `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}`

function marks(cl, pl) {
  const ov = Math.max(pl + 2, cl - 14)
  const fs = Math.max(pl + 1, ov - 5)
  return { ov, fs }
}

function phaseOf(date, cfg) {
  const day = ((diffDays(date, cfg.start) % cfg.cl) + cfg.cl) % cfg.cl + 1
  const { ov, fs } = marks(cfg.cl, cfg.pl)
  let phase = 'follicular'
  if (day <= cfg.pl) phase = 'period'
  else if (day === ov) phase = 'ovulation'
  else if (day >= fs && day < ov) phase = 'fertile'
  else if (day > ov) phase = 'luteal'
  return { day, phase }
}

function seedLogs(today, start) {
  const o = (n, v) => [keyOf(addDays(start, n)), v]
  return Object.fromEntries([
    o(0, { flow: 2, sym: ['Cramps', 'Fatigue'], mood: 1, notes: '', temp: 36.4 }),
    o(1, { flow: 3, sym: ['Cramps', 'Backache'], mood: 1, notes: 'Slow day.', temp: null }),
    o(2, { flow: 1, sym: ['Fatigue'], mood: 2, notes: '', temp: 36.5 }),
    o(-28, { flow: 2, sym: ['Cramps', 'Bloating'], mood: 2, notes: '', temp: null }),
    o(-27, { flow: 1, sym: ['Headache'], mood: 2, notes: '', temp: null }),
    o(-14, { flow: 0, sym: ['Tender'], mood: 3, notes: '', temp: 36.7 }),
    o(5, { flow: 0, sym: [], mood: 4, notes: '', temp: null }),
  ].filter(([k]) => k <= keyOf(today)))
}

// ---------------------------------------------------------------- small parts

function Face({ i, size = 30, on, accent }) {
  const ys = [11.2, 14, 16, 18, 20.2]
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill={on ? accent : '#fff'} stroke={on ? accent : '#d8c7cf'} strokeWidth="1.6" />
      <circle cx="8.6" cy="9.6" r="1.1" fill={on ? '#fff' : INK} />
      <circle cx="15.4" cy="9.6" r="1.1" fill={on ? '#fff' : INK} />
      <path d={`M8 ${i < 2 ? 16.5 : 14.4} Q12 ${ys[i]} 16 ${i < 2 ? 16.5 : 14.4}`} fill="none" stroke={on ? '#fff' : INK} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function Ring({ day, cl, pl, accent, size = 150 }) {
  const r = 60
  const C = 2 * Math.PI * r
  const segs = []
  const { ov, fs } = marks(cl, pl)
  const ph = (d) => (d <= pl ? 'period' : d === ov ? 'ovulation' : d >= fs && d < ov ? 'fertile' : d > ov ? 'luteal' : 'follicular')
  let s = 1
  for (let d = 2; d <= cl + 1; d++) {
    if (d === cl + 1 || ph(d) !== ph(s)) {
      segs.push({ from: s - 1, to: d - 1, p: ph(s) })
      s = d
    }
  }
  const ang = ((day - 0.5) / cl) * 2 * Math.PI - Math.PI / 2
  const cx = 80 + r * Math.cos(ang)
  const cy = 80 + r * Math.sin(ang)
  return (
    <svg width={size} height={size} viewBox="0 0 160 160" role="img" aria-label={`Day ${day} of ${cl}`}>
      {segs.map((g) => {
        const len = ((g.to - g.from) / cl) * C
        return <circle key={g.from} cx="80" cy="80" r={r} fill="none" stroke={PH[g.p].bg} strokeWidth="13" strokeDasharray={`${Math.max(0, len - 2)} ${C}`} strokeDashoffset={-((g.from / cl) * C) - 1} transform="rotate(-90 80 80)" />
      })}
      <circle cx={cx} cy={cy} r="9" fill="#fff" stroke={INK} strokeWidth="3" />
      <text x="80" y="78" textAnchor="middle" fontSize="11" fill={MUTED} fontWeight="600">Day</text>
      <text x="80" y="104" textAnchor="middle" fontSize="34" fontWeight="800" fill={INK}>{day}</text>
      <circle cx="80" cy="80" r="0" fill={accent} />
    </svg>
  )
}

function Stepper({ value, label, onMinus, onPlus, accent, disabledMinus, disabledPlus }) {
  const b = (dis) => ({ width: 34, height: 34, borderRadius: '50%', border: 'none', background: dis ? '#f0e4dd' : accent, color: '#fff', display: 'grid', placeItems: 'center', cursor: dis ? 'default' : 'pointer', padding: 0 })
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <button type="button" aria-label={`${label} down`} disabled={disabledMinus} onClick={onMinus} style={b(disabledMinus)}><Icon name="minus" size={16} w={2.6} /></button>
      <span style={{ minWidth: 62, textAlign: 'center', fontSize: 15, fontWeight: 700 }}>{value}</span>
      <button type="button" aria-label={`${label} up`} disabled={disabledPlus} onClick={onPlus} style={b(disabledPlus)}><Icon name="plus" size={16} w={2.6} /></button>
    </span>
  )
}

function PinPad({ title, sub, onDone, onCancel, accent }) {
  const [digits, setDigits] = useState('')
  const [err, setErr] = useState(false)
  useEffect(() => {
    if (digits.length < 4) return
    const r = onDone(digits)
    setDigits('')
    setErr(r === 'bad')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digits])
  const tap = (k) => {
    setErr(false)
    if (k === 'x') setDigits((d) => d.slice(0, -1))
    else setDigits((d) => (d.length < 4 ? d + k : d))
  }
  return (
    <div style={{ textAlign: 'center', padding: '40px 28px 0' }}>
      <span style={{ width: 60, height: 60, borderRadius: '50%', display: 'inline-grid', placeItems: 'center', background: '#fff', color: accent }}><Icon name="lock" size={26} /></span>
      <div style={{ fontSize: 21, fontWeight: 800, marginTop: 14 }}>{title}</div>
      <div style={{ fontSize: 13, color: err ? '#c0264b' : MUTED, marginTop: 4, minHeight: 18 }}>{err ? 'That did not match. Try again.' : sub}</div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 14, margin: '20px 0 10px' }} aria-label={`${digits.length} of 4 digits`}>
        {[0, 1, 2, 3].map((i) => <i key={i} style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${accent}`, background: i < digits.length ? accent : 'transparent' }} />)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, padding: '10px 14px' }}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'x'].map((k, i) =>
          k === '' ? <span key={i} /> : (
            <button key={k} type="button" onClick={() => tap(k)} aria-label={k === 'x' ? 'Delete' : k} style={{ height: 58, border: 'none', borderRadius: 18, background: '#fff', font: 'inherit', fontSize: 22, fontWeight: 600, cursor: 'pointer', color: INK }}>{k === 'x' ? '⌫' : k}</button>
          ))}
      </div>
      {onCancel && <button type="button" onClick={onCancel} style={{ border: 'none', background: 'none', font: 'inherit', fontSize: 14, fontWeight: 600, color: MUTED, cursor: 'pointer', padding: 12 }}>Cancel</button>}
    </div>
  )
}

function PinSetup({ accent, onSet, onCancel }) {
  const [first, setFirst] = useState(null)
  return (
    <PinPad
      accent={accent}
      onCancel={onCancel}
      title={first ? 'Confirm your PIN' : 'Choose a 4-digit PIN'}
      sub={first ? 'Enter it once more' : 'You will use it to open the app'}
      onDone={(code) => {
        if (!first) return setFirst(code), 'next'
        if (code !== first) return setFirst(null), 'bad'
        onSet(code)
        return 'ok'
      }}
    />
  )
}

function LogForm({ date, initial, phase, accent, onSave, onClear, onShift }) {
  const [flow, setFlow] = useState(initial?.flow ?? 0)
  const [sym, setSym] = useState(initial?.sym ?? [])
  const [mood, setMood] = useState(initial?.mood ?? null)
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [temp, setTemp] = useState(initial?.temp ?? null)
  const chip = (on) => ({ height: 36, padding: '0 14px', borderRadius: 18, border: `1.5px solid ${on ? accent : '#e6d6dc'}`, background: on ? accent : '#fff', color: on ? '#fff' : INK, font: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer' })
  const label = (t) => <div style={{ fontSize: 12, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '.07em', margin: '18px 0 8px' }}>{t}</div>
  const nudge = (d) => setTemp((t) => Math.min(38, Math.max(35.5, +((t ?? 36.5) + d).toFixed(1))))
  const p = PH[phase]
  return (
    <div style={{ padding: '0 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button type="button" aria-label="Previous day" onClick={() => onShift(-1)} style={{ width: 36, height: 36, border: 'none', borderRadius: '50%', background: '#fff', display: 'grid', placeItems: 'center', cursor: 'pointer', color: INK }}><Icon name="back" size={18} /></button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 17, fontWeight: 800 }}>{fmtLong(date)}</div>
          <span style={{ display: 'inline-block', marginTop: 4, padding: '2px 10px', borderRadius: 10, background: p.bg, color: p.fg, fontSize: 11.5, fontWeight: 700 }}>{p.label}</span>
        </div>
        <button type="button" aria-label="Next day" onClick={() => onShift(1)} style={{ width: 36, height: 36, border: 'none', borderRadius: '50%', background: '#fff', display: 'grid', placeItems: 'center', cursor: 'pointer', color: INK }}><Icon name="chev" size={18} /></button>
      </div>
      {label('Flow')}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        {FLOWS.map((f, i) => (
          <button key={f} type="button" onClick={() => setFlow(i)} aria-pressed={flow === i} style={{ ...chip(flow === i), height: 62, padding: 0, display: 'grid', placeItems: 'center', alignContent: 'center', gap: 3, borderRadius: 16 }}>
            <span style={{ display: 'flex', gap: 1 }}>{i === 0 ? <i style={{ width: 14, height: 2, background: flow === i ? '#fff' : MUTED, margin: '8px 0' }} /> : Array.from({ length: i }, (_, k) => <Icon key={k} name="drop" size={13 + i * 2} color={flow === i ? '#fff' : '#e0446a'} w={2.2} />)}</span>
            <span style={{ fontSize: 11.5 }}>{f}</span>
          </button>
        ))}
      </div>
      {label('Symptoms')}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {SYMPTOMS.map((s) => {
          const on = sym.includes(s)
          return <button key={s} type="button" aria-pressed={on} onClick={() => setSym((a) => (on ? a.filter((x) => x !== s) : [...a, s]))} style={chip(on)}>{s}</button>
        })}
      </div>
      {label('Mood')}
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        {MOODS.map((m, i) => (
          <button key={m} type="button" aria-pressed={mood === i} aria-label={m} onClick={() => setMood(mood === i ? null : i)} style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'grid', justifyItems: 'center', gap: 3, font: 'inherit', fontSize: 11, fontWeight: 600, color: mood === i ? accent : MUTED, width: 56 }}>
            <Face i={i} size={34} on={mood === i} accent={accent} />
            {m}
          </button>
        ))}
      </div>
      {label('Temperature')}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', borderRadius: 18, padding: '10px 14px' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600 }}><Icon name="temp" size={20} color={accent} /> {temp == null ? 'Not recorded' : `${temp.toFixed(1)} °C`}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {temp != null && <button type="button" onClick={() => setTemp(null)} style={{ border: 'none', background: 'none', font: 'inherit', fontSize: 12, color: MUTED, fontWeight: 600, cursor: 'pointer' }}>Clear</button>}
          <Stepper value={temp == null ? '36.5' : temp.toFixed(1)} label="Temperature" accent={accent} onMinus={() => nudge(-0.1)} onPlus={() => nudge(0.1)} disabledMinus={temp != null && temp <= 35.5} disabledPlus={temp != null && temp >= 38} />
        </span>
      </div>
      {label('Notes')}
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={160} placeholder="Anything worth remembering" aria-label="Notes" style={{ width: '100%', boxSizing: 'border-box', height: 76, borderRadius: 16, border: '1.5px solid #e6d6dc', padding: 12, font: 'inherit', fontSize: 14, resize: 'none', background: '#fff', color: INK }} />
      <div style={{ display: 'grid', gap: 8, padding: '16px 0 6px' }}>
        <button type="button" onClick={() => onSave({ flow, sym, mood, notes, temp })} style={{ height: 52, borderRadius: 26, border: 'none', background: accent, color: '#fff', font: 'inherit', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>Save entry</button>
        {initial && <button type="button" onClick={onClear} style={{ height: 40, border: 'none', background: 'none', font: 'inherit', fontSize: 13.5, fontWeight: 600, color: '#c0264b', cursor: 'pointer' }}>Delete this entry</button>}
      </div>
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

// ---------------------------------------------------------------- app

export default function CycleApp({ name = 'Bloom', accent = '#d9467a', startScreen = 'calendar', frame = true, style }) {
  const box = useRef()
  const toastTimer = useRef()
  const swipe = useRef({ x: null, moved: false })
  const [today] = useState(() => midnight(new Date()))
  const [scale, setScale] = useState(1)
  const [tab, setTab] = useState(startScreen)
  const [stack, setStack] = useState([])
  const [dir, setDir] = useState(1)
  const [toast, setToast] = useState('')
  const [cfg, setCfg] = useState(() => ({ start: addDays(midnight(new Date()), -11), cl: 28, pl: 5 }))
  const [logs, setLogs] = useState(() => seedLogs(midnight(new Date()), addDays(midnight(new Date()), -11)))
  const [view, setView] = useState({ y: today.getFullYear(), m: today.getMonth() })
  const [mdir, setMdir] = useState(1)
  const [sel, setSel] = useState(today)
  const [remind, setRemind] = useState({})
  const [pin, setPin] = useState(null)
  const [locked, setLocked] = useState(false)
  const [hideLock, setHideLock] = useState(true)

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

  const top = stack[stack.length - 1]
  const push = (s) => (setDir(1), setStack((a) => [...a, s]))
  const pop = () => (setDir(-1), setStack((a) => a.slice(0, -1)))
  const go = (t) => (setDir(NAV.findIndex((n) => n[0] === t) >= NAV.findIndex((n) => n[0] === tab) ? 1 : -1), setTab(t), setStack([]))

  const info = phaseOf(today, cfg)
  const { ov, fs } = marks(cfg.cl, cfg.pl)
  const nextStart = addDays(cfg.start, cfg.cl * (Math.floor(diffDays(today, cfg.start) / cfg.cl) + 1))
  const daysToNext = diffDays(nextStart, today)

  const shiftMonth = (n) => {
    setMdir(n)
    setView((v) => {
      const d = new Date(v.y, v.m + n, 1)
      return { y: d.getFullYear(), m: d.getMonth() }
    })
  }
  const saveLog = (d, v, back) => {
    const empty = v.flow === 0 && !v.sym.length && v.mood == null && !v.notes.trim() && v.temp == null
    setLogs((l) => {
      const n = { ...l }
      if (empty) delete n[keyOf(d)]
      else n[keyOf(d)] = v
      return n
    })
    say(empty ? 'Nothing to save' : `Saved ${fmt(d)}`)
    if (back) pop()
  }
  const clearLog = (d, back) => {
    setLogs((l) => {
      const n = { ...l }
      delete n[keyOf(d)]
      return n
    })
    say('Entry deleted')
    if (back) pop()
  }
  const openDay = (d) => {
    setSel(d)
    if (d.getMonth() !== view.m) setView({ y: d.getFullYear(), m: d.getMonth() })
    push({ id: 'logday' })
  }
  const shiftSel = (n) => setSel((d) => addDays(d, n))

  // ---- shared bits
  const header = (title, back, right) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px 6px', minHeight: 48 }}>
      {back && <button type="button" onClick={back} aria-label="Back" style={{ width: 38, height: 38, border: 'none', borderRadius: '50%', background: '#fff', display: 'grid', placeItems: 'center', cursor: 'pointer', color: INK, padding: 0 }}><Icon name="back" size={20} /></button>}
      <h1 style={{ margin: 0, fontSize: back ? 18 : 26, fontWeight: 800, letterSpacing: '-0.02em', marginLeft: 4, flex: 1 }}>{title}</h1>
      {right}
    </div>
  )
  const card = { margin: '0 20px 14px', padding: 16, background: '#fff', borderRadius: 22, boxShadow: '0 2px 10px rgba(120,60,80,.05)' }
  const toggle = (on, set, label) => (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => set(!on)} style={{ width: 48, height: 28, borderRadius: 14, border: 'none', padding: 3, background: on ? accent : '#dccbd2', cursor: 'pointer', transition: 'background .2s', flex: 'none' }}>
      <span style={{ display: 'block', width: 22, height: 22, borderRadius: '50%', background: '#fff', transform: `translateX(${on ? 20 : 0}px)`, transition: 'transform .2s' }} />
    </button>
  )
  const setRow = (icon, label, right, sub) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '12px 0', borderBottom: `1px solid ${LINE}` }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, fontWeight: 600, minWidth: 0 }}>
        <Icon name={icon} size={20} color={accent} />
        <span>{label}{sub && <span style={{ display: 'block', fontSize: 11.5, color: MUTED, fontWeight: 500 }}>{sub}</span>}</span>
      </span>
      {right}
    </div>
  )

  // ---- calendar
  const renderCalendar = () => {
    const first = new Date(view.y, view.m, 1)
    const count = new Date(view.y, view.m + 1, 0).getDate()
    const lead = first.getDay()
    const cells = [...Array.from({ length: lead }, () => null), ...Array.from({ length: count }, (_, i) => new Date(view.y, view.m, i + 1))]
    while (cells.length % 7) cells.push(null)
    const status = info.phase === 'period' ? `Period day ${info.day}` : daysToNext === 1 ? 'Next period tomorrow' : `Next period in ${daysToNext} days`
    return (
      <>
        {header(name, null, <span style={{ fontSize: 12.5, color: MUTED, fontWeight: 600 }}>{fmtLong(today)}</span>)}
        <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px' }}>
          <Ring day={info.day} cl={cfg.cl} pl={cfg.pl} accent={accent} size={138} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '.07em' }}>Today</div>
            <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-0.02em', margin: '2px 0 6px' }}>{status}</div>
            <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 10, background: PH[info.phase].bg, color: PH[info.phase].fg, fontSize: 12, fontWeight: 700 }}>{PH[info.phase].label}</span>
            <div style={{ fontSize: 12, color: MUTED, marginTop: 8 }}>Expected {fmt(nextStart)}</div>
            <button type="button" onClick={() => openDay(today)} style={{ marginTop: 8, height: 32, padding: '0 14px', border: 'none', borderRadius: 16, background: accent, color: '#fff', font: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>Log today</button>
          </div>
        </div>
        <div style={{ ...card, padding: '12px 10px 10px', touchAction: 'pan-y', userSelect: 'none' }}
          onPointerDown={(e) => { swipe.current = { x: e.clientX, moved: false } }}
          onPointerUp={(e) => {
            const dx = e.clientX - (swipe.current.x ?? e.clientX)
            if (Math.abs(dx) > 45) { swipe.current.moved = true; shiftMonth(dx < 0 ? 1 : -1) }
          }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 6px 8px' }}>
            <button type="button" aria-label="Previous month" onClick={() => shiftMonth(-1)} style={{ width: 34, height: 34, border: 'none', borderRadius: '50%', background: BG, display: 'grid', placeItems: 'center', cursor: 'pointer', color: INK, padding: 0 }}><Icon name="back" size={18} /></button>
            <button type="button" onClick={() => { setMdir(view.y * 12 + view.m > today.getFullYear() * 12 + today.getMonth() ? -1 : 1); setView({ y: today.getFullYear(), m: today.getMonth() }) }} aria-label="Jump to this month" style={{ border: 'none', background: 'none', font: 'inherit', fontSize: 16, fontWeight: 800, color: INK, cursor: 'pointer' }}>{MONTHS[view.m]} {view.y}</button>
            <button type="button" aria-label="Next month" onClick={() => shiftMonth(1)} style={{ width: 34, height: 34, border: 'none', borderRadius: '50%', background: BG, display: 'grid', placeItems: 'center', cursor: 'pointer', color: INK, padding: 0 }}><Icon name="chev" size={18} /></button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', fontSize: 11, fontWeight: 700, color: MUTED, paddingBottom: 4 }}>
            {DOW.map((d, i) => <span key={i}>{d}</span>)}
          </div>
          <div key={`${view.y}-${view.m}`} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', rowGap: 2, animation: `${mdir > 0 ? 'cy-r' : 'cy-l'} .26s ease` }}>
            {cells.map((d, i) => {
              if (!d) return <span key={i} />
              const p = phaseOf(d, cfg)
              const P = PH[p.phase]
              const isToday = keyOf(d) === keyOf(today)
              const lg = logs[keyOf(d)]
              return (
                <button key={i} type="button" onClick={() => { if (!swipe.current.moved) openDay(d) }} aria-label={`${fmtLong(d)}, ${P.label}${lg ? ', logged' : ''}`}
                  style={{ border: 'none', background: 'none', padding: '2px 0', cursor: 'pointer', display: 'grid', justifyItems: 'center', gap: 1, font: 'inherit' }}>
                  <span style={{ width: 36, height: 36, borderRadius: '50%', display: 'grid', placeItems: 'center', background: P.bg, color: P.fg, fontSize: 13.5, fontWeight: isToday ? 800 : 600, boxShadow: isToday ? `0 0 0 2px #fff, 0 0 0 4px ${INK}` : 'none', opacity: p.phase === 'follicular' || p.phase === 'luteal' ? 0.85 : 1 }}>{d.getDate()}</span>
                  <i style={{ width: 5, height: 5, borderRadius: '50%', background: lg ? INK : 'transparent' }} />
                </button>
              )
            })}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 12px', justifyContent: 'center', paddingTop: 8 }}>
            {PH_ORDER.map((k) => (
              <span key={k} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: MUTED, fontWeight: 600 }}>
                <i style={{ width: 10, height: 10, borderRadius: '50%', background: PH[k].bg }} />{PH[k].label}
              </span>
            ))}
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: MUTED, fontWeight: 600 }}><i style={{ width: 5, height: 5, borderRadius: '50%', background: INK }} />Logged</span>
          </div>
        </div>
        <div style={{ textAlign: 'center', fontSize: 11.5, color: MUTED, padding: '0 20px' }}>Swipe the month or tap a day to log it.</div>
      </>
    )
  }

  // ---- insights
  const renderInsights = () => {
    const lens = [...HISTORY, cfg.cl]
    const avg = lens.reduce((a, b) => a + b, 0) / lens.length
    const lo = Math.min(...lens)
    const hi = Math.max(...lens)
    const bw = 30
    const gap = (320 - lens.length * bw) / (lens.length + 1)
    const y = (v) => 130 - ((v - 20) / 14) * 120
    const entries = Object.values(logs)
    const counts = SYMPTOMS.map((s) => [s, entries.filter((e) => e.sym.includes(s)).length]).sort((a, b) => b[1] - a[1])
    const mx = Math.max(1, counts[0][1])
    const stat = (v, l) => (
      <div style={{ flex: 1, background: '#fff', borderRadius: 20, padding: '14px 8px', textAlign: 'center', boxShadow: '0 2px 10px rgba(120,60,80,.05)' }}>
        <div style={{ fontSize: 24, fontWeight: 800, color: accent, letterSpacing: '-0.02em' }}>{v}</div>
        <div style={{ fontSize: 11.5, color: MUTED, fontWeight: 600 }}>{l}</div>
      </div>
    )
    return (
      <>
        {header('Insights')}
        <div style={{ display: 'flex', gap: 10, padding: '0 20px 14px' }}>
          {stat(avg.toFixed(1), 'Avg cycle (days)')}
          {stat(cfg.pl, 'Period (days)')}
          {stat(`${lo}-${hi}`, 'Range')}
        </div>
        <div style={card}>
          <div style={{ fontSize: 15, fontWeight: 800 }}>Cycle length</div>
          <div style={{ fontSize: 12, color: MUTED, marginBottom: 6 }}>Past cycles and your current setting</div>
          <svg viewBox="0 0 320 160" width="100%" role="img" aria-label="Cycle length bar chart">
            {[24, 28, 32].map((v) => (
              <g key={v}>
                <line x1="0" x2="320" y1={y(v)} y2={y(v)} stroke={LINE} />
                <text x="2" y={y(v) - 3} fontSize="9" fill={MUTED}>{v}</text>
              </g>
            ))}
            {lens.map((v, i) => {
              const x = gap + i * (bw + gap)
              const cur = i === lens.length - 1
              return (
                <g key={i}>
                  <rect x={x} y={y(v)} width={bw} height={130 - y(v)} rx="8" fill={cur ? accent : '#f0b8c9'} />
                  <text x={x + bw / 2} y={y(v) - 4} textAnchor="middle" fontSize="10" fontWeight="700" fill={INK}>{v}</text>
                  <text x={x + bw / 2} y="146" textAnchor="middle" fontSize="9.5" fill={MUTED}>{cur ? 'Now' : `C${i + 1}`}</text>
                </g>
              )
            })}
            <line x1="0" x2="320" y1={y(avg)} y2={y(avg)} stroke={INK} strokeDasharray="4 4" strokeWidth="1.2" />
          </svg>
          <div style={{ fontSize: 11.5, color: MUTED, fontWeight: 600 }}>Dashed line: average {avg.toFixed(1)} days</div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 2 }}>Symptom frequency</div>
          <div style={{ fontSize: 12, color: MUTED, marginBottom: 10 }}>Across {entries.length} logged {entries.length === 1 ? 'day' : 'days'}</div>
          {counts.map(([s, n]) => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0', fontSize: 13 }}>
              <span style={{ width: 70, fontWeight: 600 }}>{s}</span>
              <span style={{ flex: 1, height: 10, borderRadius: 5, background: BG, overflow: 'hidden' }}>
                <i style={{ display: 'block', height: '100%', width: `${(n / mx) * 100}%`, borderRadius: 5, background: accent, transition: 'width .4s' }} />
              </span>
              <span style={{ width: 20, textAlign: 'right', color: MUTED, fontWeight: 700 }}>{n}</span>
            </div>
          ))}
        </div>
      </>
    )
  }

  // ---- predictions
  const renderPredictions = () => {
    const k0 = Math.floor(diffDays(today, cfg.start) / cfg.cl)
    const periods = [1, 2, 3].map((i) => addDays(cfg.start, cfg.cl * (k0 + i)))
    const wins = []
    for (let i = 0; wins.length < 3; i++) {
      const s = addDays(cfg.start, cfg.cl * (k0 + i))
      const a = addDays(s, fs - 1)
      const b = addDays(s, ov - 1)
      if (diffDays(b, today) >= 0) wins.push([a, b])
    }
    const item = (id, color, title, sub, badge) => (
      <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: `1px solid ${LINE}` }}>
        <span style={{ width: 8, alignSelf: 'stretch', borderRadius: 4, background: color }} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700 }}>{title}</span>
          <span style={{ display: 'block', fontSize: 12, color: MUTED, marginTop: 2 }}>{sub}</span>
        </span>
        <span style={{ display: 'grid', justifyItems: 'center', gap: 3, fontSize: 10.5, color: MUTED, fontWeight: 600 }}>
          {toggle(!!remind[id], (v) => (setRemind((r) => ({ ...r, [id]: v })), say(v ? 'Reminder added' : 'Reminder removed')), `Reminder for ${title}`)}
          {badge}
        </span>
      </div>
    )
    const inDays = (d) => { const n = diffDays(d, today); return n <= 0 ? 'now' : n === 1 ? 'tomorrow' : `in ${n} days` }
    return (
      <>
        {header('Predictions')}
        <div style={{ padding: '0 20px 10px', fontSize: 12.5, color: MUTED }}>Estimates from a {cfg.cl}-day cycle and a {cfg.pl}-day period. Real life varies.</div>
        <div style={card}>
          <div style={{ fontSize: 15, fontWeight: 800 }}>Next periods</div>
          {periods.map((d) => item(`p${keyOf(d)}`, PH.period.bg, fmtLong(d), `${cfg.pl} days · ${inDays(d)}`, 'Remind'))}
        </div>
        <div style={card}>
          <div style={{ fontSize: 15, fontWeight: 800 }}>Fertile windows</div>
          {wins.map(([a, b]) => item(`f${keyOf(a)}`, PH.ovulation.bg, `${fmt(a)} - ${fmt(b)}`, `Ovulation around ${fmt(b)}`, 'Remind'))}
        </div>
        <div style={{ textAlign: 'center', fontSize: 12, color: MUTED, padding: '0 20px' }}>{Object.values(remind).filter(Boolean).length} reminder(s) on</div>
      </>
    )
  }

  // ---- settings
  const renderSettings = () => {
    const nudgeStart = (n) => setCfg((c) => ({ ...c, start: addDays(c.start, n) }))
    const preview = hideLock ? 'Reminder' : 'Period expected tomorrow'
    return (
      <>
        {header('Settings')}
        <div style={card}>
          <div style={{ fontSize: 15, fontWeight: 800 }}>Your cycle</div>
          {setRow('cal', 'Last period started', <Stepper value={fmt(cfg.start)} label="Start date" accent={accent} onMinus={() => nudgeStart(-1)} onPlus={() => nudgeStart(1)} disabledPlus={diffDays(cfg.start, today) >= 0} />)}
          {setRow('clock', 'Cycle length', <Stepper value={`${cfg.cl} days`} label="Cycle length" accent={accent} onMinus={() => setCfg((c) => ({ ...c, cl: c.cl - 1 }))} onPlus={() => setCfg((c) => ({ ...c, cl: c.cl + 1 }))} disabledMinus={cfg.cl <= 21} disabledPlus={cfg.cl >= 40} />)}
          {setRow('drop', 'Period length', <Stepper value={`${cfg.pl} days`} label="Period length" accent={accent} onMinus={() => setCfg((c) => ({ ...c, pl: c.pl - 1 }))} onPlus={() => setCfg((c) => ({ ...c, pl: c.pl + 1 }))} disabledMinus={cfg.pl <= 2} disabledPlus={cfg.pl >= 9} />)}
          <button type="button" onClick={() => (setCfg((c) => ({ ...c, start: today })), say('Period started today'))} style={{ width: '100%', height: 42, marginTop: 12, border: 'none', borderRadius: 21, background: '#fde6ee', color: accent, font: 'inherit', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>My period started today</button>
        </div>
        <div style={card}>
          <div style={{ fontSize: 15, fontWeight: 800 }}>Privacy</div>
          {setRow('lock', 'PIN lock', toggle(!!pin, (v) => (v ? push({ id: 'pin' }) : (setPin(null), say('PIN lock off'))), 'PIN lock'), pin ? 'On' : 'Off')}
          {setRow('eye', 'Hide on lock screen', toggle(hideLock, setHideLock, 'Hide on lock screen'), 'Keeps notification text generic')}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '12px 0 0', padding: 12, borderRadius: 16, background: BG }}>
            <span style={{ width: 32, height: 32, borderRadius: 9, background: accent, display: 'grid', placeItems: 'center', color: '#fff' }}><Icon name="bell" size={16} /></span>
            <span style={{ fontSize: 12.5 }}><b>{hideLock ? 'Notification' : name}</b><br /><span style={{ color: MUTED }}>{preview}</span></span>
          </div>
          <button type="button" disabled={!pin} onClick={() => setLocked(true)} style={{ width: '100%', height: 42, marginTop: 12, border: 'none', borderRadius: 21, background: pin ? INK : '#e6d6dc', color: '#fff', font: 'inherit', fontSize: 13.5, fontWeight: 700, cursor: pin ? 'pointer' : 'default' }}>{pin ? 'Lock now' : 'Turn on PIN to lock'}</button>
        </div>
        <div style={{ display: 'flex', gap: 8, margin: '0 20px 12px' }}>
          <button type="button" onClick={() => say('Export saved to your files')} style={{ flex: 1, height: 44, border: 'none', borderRadius: 22, background: '#fff', font: 'inherit', fontSize: 13.5, fontWeight: 700, color: INK, cursor: 'pointer' }}>Export data</button>
          <button type="button" onClick={() => (setCfg({ start: addDays(today, -11), cl: 28, pl: 5 }), setLogs(seedLogs(today, addDays(today, -11))), setRemind({}), setPin(null), setHideLock(true), say('Demo reset'))} style={{ flex: 1, height: 44, border: 'none', borderRadius: 22, background: '#fff', font: 'inherit', fontSize: 13.5, fontWeight: 700, color: '#c0264b', cursor: 'pointer' }}>Reset demo</button>
        </div>
        <div style={{ display: 'flex', gap: 8, margin: '0 24px', fontSize: 11.5, color: MUTED, lineHeight: 1.45 }}>
          <Icon name="info" size={16} color={MUTED} />
          <span>For tracking only, not medical advice. Predictions are estimates.</span>
        </div>
      </>
    )
  }

  // ---- compose
  let body
  let tabbed = true
  const logFor = (d) => logs[keyOf(d)]
  if (top?.id === 'logday') {
    tabbed = false
    body = (
      <>
        {header('Log day', pop)}
        <LogForm key={keyOf(sel)} date={sel} initial={logFor(sel)} phase={phaseOf(sel, cfg).phase} accent={accent} onShift={shiftSel} onSave={(v) => saveLog(sel, v, true)} onClear={() => clearLog(sel, true)} />
      </>
    )
  } else if (top?.id === 'pin') {
    tabbed = false
    body = (
      <>
        {header('PIN lock', pop)}
        <PinSetup accent={accent} onCancel={pop} onSet={(c) => (setPin(c), say('PIN lock on'), pop())} />
      </>
    )
  } else if (tab === 'calendar') body = renderCalendar()
  else if (tab === 'log') {
    body = (
      <>
        {header('Log day')}
        <LogForm key={keyOf(sel)} date={sel} initial={logFor(sel)} phase={phaseOf(sel, cfg).phase} accent={accent} onShift={shiftSel} onSave={(v) => saveLog(sel, v, false)} onClear={() => clearLog(sel, false)} />
      </>
    )
  } else if (tab === 'insights') body = renderInsights()
  else if (tab === 'predictions') body = renderPredictions()
  else body = renderSettings()

  const phone = (
    <div style={{ position: 'relative', width: W, height: H, overflow: 'hidden', borderRadius: frame ? 46 : 0, background: BG, color: INK, fontFamily: "-apple-system, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif" }}>
      <style>{`
        @keyframes cy-r { from { opacity: 0; transform: translateX(30px) } to { opacity: 1; transform: none } }
        @keyframes cy-l { from { opacity: 0; transform: translateX(-30px) } to { opacity: 1; transform: none } }
        .cy-scroll { scrollbar-width: none } .cy-scroll::-webkit-scrollbar { display: none }
        .cy-app button:focus-visible, .cy-app textarea:focus-visible { outline: 2px solid ${accent}; outline-offset: 2px }
        @media (prefers-reduced-motion: reduce) { .cy-app * { animation: none !important; transition: none !important } }
      `}</style>
      <StatusBar frame={frame} />
      <div key={`${tab}/${stack.map((s) => s.id).join('/')}`} className="cy-scroll" style={{ position: 'absolute', top: 54, bottom: tabbed ? 88 : 0, left: 0, right: 0, overflowY: 'auto', paddingBottom: 24, animation: `${dir > 0 ? 'cy-r' : 'cy-l'} .28s ease` }}>
        {body}
      </div>
      {tabbed && (
        <nav aria-label="Main" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 88, background: '#fff', borderRadius: '26px 26px 0 0', boxShadow: '0 -6px 20px rgba(120,60,80,.08)', display: 'flex', justifyContent: 'space-around', padding: '10px 4px 0' }}>
          {NAV.map(([id, icon, label]) => (
            <button key={id} type="button" onClick={() => go(id)} aria-current={tab === id ? 'page' : undefined} style={{ border: 'none', background: 'none', font: 'inherit', cursor: 'pointer', display: 'grid', justifyItems: 'center', alignContent: 'start', gap: 3, width: 68, height: 54, fontSize: 11, fontWeight: 600, color: tab === id ? accent : MUTED }}>
              <Icon name={icon} size={23} />
              {label}
            </button>
          ))}
        </nav>
      )}
      {locked && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 40, background: BG, paddingTop: 54 }}>
          <PinPad accent={accent} title="Locked" sub="Enter your PIN" onDone={(c) => (c === pin ? (setLocked(false), 'ok') : 'bad')} />
        </div>
      )}
      <div role="status" style={{ position: 'absolute', left: '50%', top: 58, zIndex: 50, transform: `translate(-50%, ${toast ? 0 : -90}px)`, transition: 'transform .35s cubic-bezier(.2,.8,.2,1)', padding: '10px 16px', borderRadius: 20, background: INK, color: '#fff', fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap' }}>{toast}</div>
      <div style={{ position: 'absolute', left: '50%', bottom: 8, width: 140, height: 5, marginLeft: -70, borderRadius: 3, background: INK, opacity: 0.8, zIndex: 55 }} />
    </div>
  )

  return (
    <div ref={box} className="cy-app" style={{ position: 'relative', width: '100%', height: '100%', display: 'grid', placeItems: 'center', overflow: 'hidden', background: 'radial-gradient(ellipse at 50% 30%, #fde9ee, #d9b9c6 75%)', ...style }}>
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: `translate(-50%, -50%) scale(${scale})`, transformOrigin: 'center' }}>
        {frame ? (
          <div style={{ padding: 12, borderRadius: 58, background: 'linear-gradient(145deg, #3a3f4a, #14171d 40%, #2b2f38)', boxShadow: '0 40px 80px rgba(60,20,40,.35), inset 0 0 0 2px #4b515e' }}>
            <div style={{ padding: 2, borderRadius: 48, background: '#000' }}>{phone}</div>
          </div>
        ) : (
          phone
        )}
      </div>
    </div>
  )
}
