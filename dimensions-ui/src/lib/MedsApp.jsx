import { useEffect, useRef, useState } from 'react'

// A medication reminder on a phone, as a click-through prototype. Today is a
// timeline by time of day on a demo clock that really ticks (use +1h to skip
// ahead): drag a dose row RIGHT to mark it taken (check animation, stock goes
// down) or LEFT for a skip / snooze sheet; the adherence ring and the
// "next dose" countdown update live. Schedule is a weekly grid whose cells you
// can toggle, with an Add medication form. A medication opens a detail page
// with a pill drawing, dosage, stock left with a refill reminder, and editing.
// History is a calendar heatmap (tap a day), Settings has working toggles.
// The phone scales to fit its container.

const W = 390
const H = 844
const BG = '#f4f2fb'
const CARD = '#ffffff'
const INK = '#1f1b33'
const MUTED = '#7d7a93'
const LINE = '#e8e5f3'
const GREEN = '#22b573'
const AMBER = '#f0a020'
const RED = '#e5484d'
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const COLORS = ['#f4a3b5', '#ffd166', '#7dd3c0', '#9db8ff', '#c4a3f4', '#ff9f7a']
const SLOTS = [['08:00', 'Morning'], ['13:00', 'Lunch'], ['18:00', 'Evening'], ['22:00', 'Bedtime']]

const SEED_MEDS = [
  { id: 'm1', name: 'Metformin', dose: '500 mg', form: 'tablet', color: '#f4a3b5', per: 1, stock: 24, total: 60, refillAt: 10, times: ['08:00', '20:00'], days: [0, 1, 2, 3, 4, 5, 6], note: 'Take with food' },
  { id: 'm2', name: 'Vitamin D3', dose: '1000 IU', form: 'softgel', color: '#ffd166', per: 1, stock: 41, total: 60, refillAt: 10, times: ['08:00'], days: [0, 1, 2, 3, 4, 5, 6], note: 'With the biggest meal' },
  { id: 'm3', name: 'Lisinopril', dose: '10 mg', form: 'tablet', color: '#9db8ff', per: 1, stock: 11, total: 30, refillAt: 10, times: ['09:00'], days: [0, 1, 2, 3, 4, 5, 6], note: 'Same time every day' },
  { id: 'm4', name: 'Omega-3', dose: '1200 mg', form: 'capsule', color: '#7dd3c0', per: 2, stock: 52, total: 90, refillAt: 14, times: ['13:00'], days: [0, 2, 4, 5], note: 'Mon, Wed, Fri, Sat' },
  { id: 'm5', name: 'Melatonin', dose: '3 mg', form: 'capsule', color: '#c4a3f4', per: 1, stock: 18, total: 30, refillAt: 7, times: ['22:00'], days: [0, 1, 2, 3, 4, 5, 6], note: '30 minutes before bed' },
]

const ICONS = {
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4l1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  moon: 'M20 14A8 8 0 1 1 10 4a6.5 6.5 0 0 0 10 10z',
  today: 'M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM4 10h16M9 14l2 2 4-4',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12l2-1-2-4-2 1-2-2 1-2-4-1-1 2h-2L8 3 4 4l1 2-2 2-2-1-1 4 2 1v2l-2 1 1 4 2-1 2 2-1 2 4 1 1-2h2l1 2 4-1-1-2 2-2 2 1 1-4-2-1z',
  back: 'M15 5l-7 7 7 7',
  chev: 'M9 5l7 7-7 7',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  check: 'M5 12l5 5 9-10',
  x: 'M6 6l12 12M18 6L6 18',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13 7l4 4',
  trash: 'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13',
  bell: 'M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4',
  alert: 'M12 3l10 18H2zM12 10v5M12 18h.01',
  skip: 'M5 5l9 7-9 7zM17 5v14',
  snooze: 'M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 9v4l2 2M4 5l3-2M20 5l-3-2',
}

function Icon({ name, size = 22, color = 'currentColor', w = 1.9 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  )
}

const toMin = (t) => parseInt(t.slice(0, 2), 10) * 60 + parseInt(t.slice(3), 10)
const fmt = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(Math.floor(m % 60)).padStart(2, '0')}`
const until = (d) => {
  const a = Math.abs(Math.round(d))
  return a >= 60 ? `${Math.floor(a / 60)}h ${a % 60 ? `${a % 60}m` : ''}`.trim() : `${a} min`
}
const hash = (n) => ((n * 9301 + 49297) % 233280) / 233280
const PERIODS = [
  { id: 'morning', label: 'Morning', icon: 'sun', test: (t) => t < 720 },
  { id: 'afternoon', label: 'Afternoon', icon: 'sun', test: (t) => t < 1020 },
  { id: 'evening', label: 'Evening', icon: 'moon', test: (t) => t < 1260 },
  { id: 'night', label: 'Night', icon: 'moon', test: () => true },
]

function Pill({ form, color, size = 56, tilt = -30 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" style={{ flex: 'none', display: 'block' }}>
      <g transform={`rotate(${tilt} 50 50)`}>
        {form === 'capsule' ? (
          <>
            <rect x="12" y="30" width="76" height="40" rx="20" fill="#fff" stroke={color} strokeWidth="3" />
            <path d="M50 30H32a20 20 0 0 0 0 40h18z" fill={color} />
            <rect x="20" y="36" width="44" height="7" rx="3.5" fill="#fff" opacity=".45" />
          </>
        ) : form === 'softgel' ? (
          <>
            <ellipse cx="50" cy="50" rx="38" ry="24" fill={color} />
            <ellipse cx="50" cy="50" rx="38" ry="24" fill="none" stroke="rgba(0,0,0,.1)" strokeWidth="2" />
            <ellipse cx="38" cy="40" rx="16" ry="6" fill="#fff" opacity=".55" />
          </>
        ) : (
          <>
            <circle cx="50" cy="50" r="34" fill={color} />
            <circle cx="50" cy="50" r="34" fill="none" stroke="rgba(0,0,0,.1)" strokeWidth="2" />
            <path d="M22 50h56" stroke="rgba(0,0,0,.18)" strokeWidth="4" strokeLinecap="round" />
            <ellipse cx="38" cy="34" rx="11" ry="5" fill="#fff" opacity=".5" transform="rotate(-30 38 34)" />
          </>
        )}
      </g>
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

// A dose row you drag sideways: right = taken, left = skip or snooze.
// The phone is CSS-scaled, so pointer deltas are divided by `scale`.
function SwipeRow({ scale, onRight, onLeft, onTap, locked, taken, children, accent }) {
  const [dx, setDx] = useState(0)
  const [drag, setDrag] = useState(false)
  const st = useRef(null)
  const cb = useRef({})
  cb.current = { onRight, onLeft, onTap }
  const LIMIT = 96
  const down = (e) => {
    if (e.button > 0) return
    st.current = { x: e.clientX, moved: false }
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch (err) {
      /* ignore */
    }
  }
  const move = (e) => {
    if (!st.current) return
    const d = (e.clientX - st.current.x) / scale
    if (Math.abs(d) > 6) st.current.moved = true
    if (st.current.moved) {
      setDrag(true)
      setDx(Math.max(-150, Math.min(150, d)))
    }
  }
  const end = (cancel) => {
    const s = st.current
    st.current = null
    if (!s) return
    const d = dx
    setDrag(false)
    setDx(0)
    if (cancel) return
    if (!s.moved) cb.current.onTap()
    else if (d > LIMIT) cb.current.onRight()
    else if (d < -LIMIT) cb.current.onLeft()
  }
  const right = dx > 0
  const reach = Math.min(1, Math.abs(dx) / LIMIT)
  return (
    <div style={{ position: 'relative', borderRadius: 20, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: right ? 'flex-start' : 'flex-end', padding: '0 22px', background: right ? GREEN : AMBER, color: '#fff', fontWeight: 800, fontSize: 14, gap: 8, opacity: dx === 0 ? 0 : 0.4 + reach * 0.6 }}>
        {right ? (
          <>
            <Icon name="check" size={26} w={3} style={{ transform: `scale(${0.7 + reach * 0.4})` }} /> {reach >= 1 ? 'Release to take' : 'Take'}
          </>
        ) : (
          <>
            {reach >= 1 ? 'Release for options' : 'Skip / snooze'} <Icon name="snooze" size={24} w={2.4} />
          </>
        )}
      </div>
      <div
        role="button"
        tabIndex={0}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={() => end(false)}
        onPointerCancel={() => end(true)}
        onKeyDown={(e) => e.key === 'Enter' && cb.current.onTap()}
        style={{ position: 'relative', touchAction: 'pan-y', userSelect: 'none', WebkitUserSelect: 'none', cursor: drag ? 'grabbing' : 'grab', transform: `translateX(${dx}px)`, transition: drag ? 'none' : 'transform .28s cubic-bezier(.2,1.2,.4,1)', background: taken ? '#e7f8ef' : CARD, borderRadius: 20, boxShadow: drag ? '0 8px 22px rgba(31,27,51,.15)' : '0 1px 0 rgba(31,27,51,.04)', outlineColor: accent }}
      >
        {children}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- app

export default function MedsApp({ name = 'Dose', accent = '#6c5ce7', startScreen = 'today', frame = true, style }) {
  const box = useRef()
  const toastTimer = useRef()
  const [scale, setScale] = useState(1)
  const [tab, setTab] = useState('today')
  const [stack, setStack] = useState([])
  const [dir, setDir] = useState(1)
  const [toast, setToast] = useState('')
  const [meds, setMeds] = useState(SEED_MEDS)
  const [log, setLog] = useState({ 'm1@08:00': { s: 'taken', at: 482 }, 'm2@08:00': { s: 'taken', at: 483 } })
  const [clock, setClock] = useState(9 * 60 + 40)
  const [sheet, setSheet] = useState(null)
  const [edit, setEdit] = useState(null)
  const [form, setForm] = useState({ name: '', dose: '', form: 'tablet', color: COLORS[0], times: ['08:00'], stock: 30, per: 1 })
  const [refill, setRefill] = useState({})
  const [monthOff, setMonthOff] = useState(0)
  const [selDay, setSelDay] = useState(null)
  const [set, setSet] = useState({ remind: true, snooze: 15, refillAlert: true, quiet: false, haptic: true, sound: true })

  const todayIdx = (new Date().getDay() + 6) % 7

  useEffect(() => {
    if (startScreen === 'medication') {
      setTab('schedule')
      setStack([{ id: 'med', mid: 'm3' }])
    } else {
      setTab(startScreen)
      setStack([])
    }
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

  // the demo clock: one minute passes every two seconds
  useEffect(() => {
    const id = setInterval(() => setClock((c) => Math.min(1439, c + 0.5)), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => () => clearTimeout(toastTimer.current), [])
  const say = (t) => {
    setToast(t)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 2000)
  }

  const NAV = [['today', 'today', 'Today'], ['schedule', 'grid', 'Schedule'], ['history', 'clock', 'History'], ['settings', 'gear', 'Settings']]
  const top = stack[stack.length - 1]
  const push = (s) => (setDir(1), setStack((a) => [...a, s]))
  const pop = () => (setDir(-1), setEdit(null), setStack((a) => a.slice(0, -1)))
  const go = (t) => (setDir(NAV.findIndex((n) => n[0] === t) >= NAV.findIndex((n) => n[0] === tab) ? 1 : -1), setTab(t), setStack([]), setEdit(null), setSheet(null))

  // ---- doses
  const doses = meds
    .flatMap((m) => (m.days.includes(todayIdx) ? m.times.map((t) => ({ key: `${m.id}@${t}`, med: m, time: t, t: toMin(t) })) : []))
    .sort((a, b) => a.t - b.t)
  const stOf = (d) => log[d.key]
  const eff = (d) => (stOf(d)?.s === 'snoozed' ? stOf(d).until : d.t)
  const pending = doses.filter((d) => !stOf(d) || stOf(d).s === 'snoozed').sort((a, b) => eff(a) - eff(b))
  const nextDose = pending[0]
  const takenN = doses.filter((d) => stOf(d)?.s === 'taken').length
  const pct = doses.length ? takenN / doses.length : 0

  const take = (d) => {
    if (stOf(d)?.s === 'taken') return
    setLog((l) => ({ ...l, [d.key]: { s: 'taken', at: Math.floor(clock) } }))
    const left = Math.max(0, d.med.stock - d.med.per)
    setMeds((a) => a.map((m) => (m.id === d.med.id ? { ...m, stock: left } : m)))
    if (set.refillAlert && left <= d.med.refillAt && d.med.stock > d.med.refillAt) say(`${d.med.name}: only ${left} left. Time to refill`)
    else say(`${d.med.name} taken`)
  }
  const undo = (d) => {
    setLog((l) => {
      const n = { ...l }
      delete n[d.key]
      return n
    })
    setMeds((a) => a.map((m) => (m.id === d.med.id ? { ...m, stock: m.stock + m.per } : m)))
    say('Marked as not taken')
  }
  const snooze = (d, mins) => {
    setLog((l) => ({ ...l, [d.key]: { s: 'snoozed', until: Math.max(clock, d.t) + mins } }))
    setSheet(null)
    say(`Snoozed ${d.med.name} for ${mins >= 60 ? `${mins / 60} hour` : `${mins} min`}`)
  }
  const skip = (d) => {
    setLog((l) => ({ ...l, [d.key]: { s: 'skipped' } }))
    setSheet(null)
    say(`${d.med.name} skipped`)
  }

  // ---- shared bits
  const header = (title, back, right) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 18px', minHeight: 52 }}>
      {back && (
        <button type="button" onClick={back} aria-label="Back" style={{ width: 38, height: 38, borderRadius: '50%', border: 'none', background: CARD, color: INK, display: 'grid', placeItems: 'center', cursor: 'pointer', padding: 0 }}>
          <Icon name="back" size={20} />
        </button>
      )}
      <h1 style={{ margin: 0, flex: 1, fontSize: back ? 18 : 28, fontWeight: 800, letterSpacing: '-0.03em' }}>{title}</h1>
      {right}
    </div>
  )
  const roundBtn = (icon, label, onClick, bg = CARD, color = INK) => (
    <button type="button" aria-label={label} onClick={onClick} style={{ width: 38, height: 38, borderRadius: '50%', border: 'none', background: bg, color, display: 'grid', placeItems: 'center', cursor: 'pointer', padding: 0 }}>
      <Icon name={icon} size={20} />
    </button>
  )
  const primary = (label, onClick, o = {}) => (
    <button type="button" disabled={o.disabled} onClick={onClick} style={{ width: '100%', height: 52, borderRadius: 26, border: o.ghost ? `1.5px solid ${LINE}` : 'none', background: o.disabled ? '#cfcbe0' : o.ghost ? 'transparent' : o.bg || accent, color: o.ghost ? o.color || INK : '#fff', font: 'inherit', fontSize: 15, fontWeight: 800, cursor: o.disabled ? 'default' : 'pointer' }}>
      {label}
    </button>
  )
  const toggle = (on, onSet, label) => (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onSet(!on)} style={{ width: 48, height: 28, borderRadius: 14, border: 'none', padding: 3, background: on ? accent : '#d6d2e6', cursor: 'pointer', transition: 'background .2s', flex: 'none' }}>
      <span style={{ display: 'block', width: 22, height: 22, borderRadius: '50%', background: '#fff', transform: `translateX(${on ? 20 : 0}px)`, transition: 'transform .2s' }} />
    </button>
  )
  const stepper = (val, onDec, onInc, label) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <button type="button" aria-label={`Decrease ${label}`} onClick={onDec} style={{ width: 34, height: 34, borderRadius: 11, border: 'none', background: '#efecf9', color: INK, cursor: 'pointer', display: 'grid', placeItems: 'center', padding: 0 }}><Icon name="minus" size={18} /></button>
      <span style={{ minWidth: 30, textAlign: 'center', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{val}</span>
      <button type="button" aria-label={`Increase ${label}`} onClick={onInc} style={{ width: 34, height: 34, borderRadius: 11, border: 'none', background: '#efecf9', color: INK, cursor: 'pointer', display: 'grid', placeItems: 'center', padding: 0 }}><Icon name="plus" size={18} /></button>
    </span>
  )
  const field = { width: '100%', height: 46, borderRadius: 14, border: `1.5px solid ${LINE}`, background: '#fff', padding: '0 14px', font: 'inherit', fontSize: 15, color: INK, boxSizing: 'border-box' }
  const label = (t) => <div style={{ fontSize: 12, fontWeight: 800, color: MUTED, letterSpacing: '.08em', textTransform: 'uppercase', margin: '16px 4px 6px' }}>{t}</div>
  const chip = (text, on, onClick, key) => (
    <button key={key || text} type="button" aria-pressed={on} onClick={onClick} style={{ height: 38, padding: '0 14px', borderRadius: 19, border: on ? 'none' : `1.5px solid ${LINE}`, background: on ? accent : '#fff', color: on ? '#fff' : INK, font: 'inherit', fontWeight: 700, fontSize: 13.5, cursor: 'pointer', textTransform: 'capitalize' }}>{text}</button>
  )

  const doseRow = (d) => {
    const s = stOf(d)
    const state = s?.s
    const overdue = !state && d.t < clock
    const snoozedLeft = state === 'snoozed' ? s.until - clock : 0
    return (
      <div key={d.key} style={{ display: 'flex', gap: 10, alignItems: 'stretch' }}>
        <div style={{ width: 44, paddingTop: 20, fontSize: 12.5, fontWeight: 700, color: MUTED, fontVariantNumeric: 'tabular-nums' }}>{d.time}</div>
        <div style={{ position: 'relative', width: 14, flex: 'none' }}>
          <span style={{ position: 'absolute', left: 6, top: 0, bottom: -8, width: 2, background: LINE }} />
          <span style={{ position: 'absolute', left: 1, top: 24, width: 12, height: 12, borderRadius: '50%', background: state === 'taken' ? GREEN : state === 'skipped' ? '#b7b3cc' : overdue ? RED : state === 'snoozed' ? AMBER : '#fff', border: `2.5px solid ${state === 'taken' ? GREEN : state === 'skipped' ? '#b7b3cc' : overdue ? RED : state === 'snoozed' ? AMBER : accent}`, boxSizing: 'border-box' }} />
        </div>
        <div style={{ flex: 1, minWidth: 0, marginBottom: 8 }}>
          <SwipeRow scale={scale} accent={accent} taken={state === 'taken'} onRight={() => take(d)} onLeft={() => state !== 'taken' && setSheet(d)} onTap={() => push({ id: 'med', mid: d.med.id })}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px 10px 10px', opacity: state === 'skipped' ? 0.55 : 1 }}>
              <span style={{ width: 48, height: 48, borderRadius: 16, background: `${d.med.color}44`, display: 'grid', placeItems: 'center', flex: 'none' }}>
                <Pill form={d.med.form} color={d.med.color} size={40} />
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 15.5, fontWeight: 800, textDecoration: state === 'taken' ? 'line-through' : 'none', textDecorationColor: GREEN }}>{d.med.name}</span>
                <span style={{ display: 'block', fontSize: 12.5, color: MUTED, marginTop: 2 }}>
                  {d.med.per > 1 ? `${d.med.per} x ` : ''}{d.med.dose}
                  {state === 'taken' ? ` · taken ${fmt(s.at)}` : state === 'skipped' ? ' · skipped' : state === 'snoozed' ? ` · snoozed ${until(snoozedLeft)}` : overdue ? '' : ` · ${d.med.note.toLowerCase()}`}
                </span>
                {overdue && <span style={{ display: 'block', fontSize: 12, fontWeight: 800, color: RED, marginTop: 2 }}>Overdue by {until(clock - d.t)}</span>}
              </span>
              <button
                type="button"
                aria-label={state === 'taken' ? `Undo ${d.med.name}` : `Mark ${d.med.name} taken`}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => (e.stopPropagation(), state === 'taken' ? undo(d) : take(d))}
                style={{ position: 'relative', width: 38, height: 38, borderRadius: '50%', border: state === 'taken' ? 'none' : `2px solid ${LINE}`, background: state === 'taken' ? GREEN : 'transparent', color: '#fff', display: 'grid', placeItems: 'center', cursor: 'pointer', padding: 0, flex: 'none' }}
              >
                {state === 'taken' && (
                  <>
                    <span key={`b${s.at}`} style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `2px solid ${GREEN}`, animation: 'md-burst .6s ease-out forwards' }} />
                    <span key={`c${s.at}`} style={{ display: 'grid', animation: 'md-pop .45s cubic-bezier(.2,1.6,.4,1)' }}><Icon name="check" size={22} w={3.2} /></span>
                  </>
                )}
              </button>
            </div>
          </SwipeRow>
        </div>
      </div>
    )
  }

  // ---- screens
  let body
  let tabbed = true
  if (top?.id === 'med') {
    tabbed = false
    const m = meds.find((x) => x.id === top.mid)
    if (!m) {
      body = header('Medication', pop)
    } else if (edit) {
      body = (
        <>
          {header(`Edit ${m.name}`, () => setEdit(null))}
          <div style={{ padding: '0 18px' }}>
            {label('Name')}
            <input aria-label="Name" style={field} value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            {label('Dosage')}
            <input aria-label="Dosage" style={field} value={edit.dose} onChange={(e) => setEdit({ ...edit, dose: e.target.value })} />
            {label('Pills per dose')}
            {stepper(edit.per, () => setEdit({ ...edit, per: Math.max(1, edit.per - 1) }), () => setEdit({ ...edit, per: edit.per + 1 }), 'pills per dose')}
            {label('Stock')}
            {stepper(edit.stock, () => setEdit({ ...edit, stock: Math.max(0, edit.stock - 5) }), () => setEdit({ ...edit, stock: edit.stock + 5 }), 'stock')}
            {label('Daily times')}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {SLOTS.map(([t, l]) => chip(`${l} ${t}`, edit.times.includes(t), () => setEdit({ ...edit, times: edit.times.includes(t) ? edit.times.filter((x) => x !== t) : [...edit.times, t].sort() }), t))}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <div style={{ flex: 1 }}>{primary('Cancel', () => setEdit(null), { ghost: true })}</div>
              <div style={{ flex: 1 }}>{primary('Save', () => (setMeds((a) => a.map((x) => (x.id === m.id ? { ...x, ...edit, name: edit.name.trim() || x.name } : x))), setEdit(null), say('Changes saved')), { disabled: !edit.times.length })}</div>
            </div>
          </div>
        </>
      )
    } else {
      const perDay = m.per * m.times.length
      const daysLeft = Math.floor(m.stock / Math.max(1, perDay))
      const low = m.stock <= m.refillAt
      body = (
        <>
          {header(m.name, pop, roundBtn('edit', 'Edit medication', () => setEdit({ name: m.name, dose: m.dose, per: m.per, stock: m.stock, times: m.times })))}
          <div style={{ display: 'grid', placeItems: 'center', margin: '4px 18px 14px', height: 180, borderRadius: 28, background: `linear-gradient(145deg, ${m.color}66, ${m.color}22)`, position: 'relative' }}>
            <div style={{ animation: 'md-float 3.4s ease-in-out infinite' }}><Pill form={m.form} color={m.color} size={120} /></div>
            <span style={{ position: 'absolute', left: 14, bottom: 12, padding: '5px 12px', borderRadius: 14, background: 'rgba(255,255,255,.85)', fontSize: 12.5, fontWeight: 800, textTransform: 'capitalize' }}>{m.form}</span>
          </div>
          <div style={{ padding: '0 18px' }}>
            <div style={{ display: 'flex', gap: 8 }}>
              {[[m.dose, 'Strength'], [`${m.per}`, m.per > 1 ? 'Pills per dose' : 'Pill per dose'], [`${m.times.length}x`, 'Per day']].map(([v, l]) => (
                <div key={l} style={{ flex: 1, background: CARD, borderRadius: 18, padding: '12px 6px', textAlign: 'center' }}>
                  <div style={{ fontSize: 17, fontWeight: 800 }}>{v}</div>
                  <div style={{ fontSize: 11, color: MUTED, fontWeight: 600, marginTop: 2 }}>{l}</div>
                </div>
              ))}
            </div>
            <div style={{ background: CARD, borderRadius: 20, padding: 14, margin: '12px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontWeight: 800, fontSize: 15 }}>Stock</span>
                <span style={{ fontSize: 13, color: low ? RED : MUTED, fontWeight: 700 }}>{m.stock} left · about {daysLeft} days</span>
              </div>
              <div style={{ position: 'relative', height: 12, borderRadius: 6, background: '#ece9f6', margin: '12px 0 8px' }}>
                <div style={{ width: `${Math.min(100, (m.stock / Math.max(m.total, m.stock)) * 100)}%`, height: '100%', borderRadius: 6, background: low ? RED : GREEN, transition: 'width .4s' }} />
                <span style={{ position: 'absolute', left: `${Math.min(100, (m.refillAt / Math.max(m.total, m.stock)) * 100)}%`, top: -4, width: 3, height: 20, borderRadius: 2, background: INK }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, color: MUTED, fontWeight: 600 }}>
                <span>Remind me at</span>
                {stepper(m.refillAt, () => setMeds((a) => a.map((x) => (x.id === m.id ? { ...x, refillAt: Math.max(1, x.refillAt - 1) } : x))), () => setMeds((a) => a.map((x) => (x.id === m.id ? { ...x, refillAt: x.refillAt + 1 } : x))), 'refill reminder')}
              </div>
              {low && (
                <div style={{ marginTop: 12, padding: 12, borderRadius: 14, background: '#fdeceb', color: RED, display: 'flex', gap: 10, alignItems: 'center', fontSize: 13, fontWeight: 700 }}>
                  <Icon name="alert" size={20} /> Running low. Refill soon.
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <div style={{ flex: 1 }}>{primary(refill[m.id] ? 'Refill requested' : 'Request refill', () => (setRefill((r) => ({ ...r, [m.id]: true })), say('Refill request sent to your pharmacy')), { disabled: !!refill[m.id], bg: low ? RED : accent })}</div>
                <div style={{ flex: 1 }}>{primary('Add 30 pills', () => (setMeds((a) => a.map((x) => (x.id === m.id ? { ...x, stock: x.stock + 30, total: Math.max(x.total, x.stock + 30) } : x))), setRefill((r) => ({ ...r, [m.id]: false })), say('Stock updated: +30')), { ghost: true })}</div>
              </div>
            </div>
            <div style={{ background: CARD, borderRadius: 20, padding: '4px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '13px 0', borderBottom: `1px solid ${LINE}`, fontSize: 14 }}><span style={{ color: MUTED }}>Times</span><b>{m.times.join(', ')}</b></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '13px 0', borderBottom: `1px solid ${LINE}`, fontSize: 14 }}><span style={{ color: MUTED }}>Days</span><b>{m.days.length === 7 ? 'Every day' : m.days.map((d) => DAYS[d]).join(' ')}</b></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '13px 0', fontSize: 14 }}><span style={{ color: MUTED }}>Note</span><b>{m.note}</b></div>
            </div>
            <div style={{ margin: '14px 0 0' }}>{primary('Delete medication', () => (setMeds((a) => a.filter((x) => x.id !== m.id)), setStack((s) => s.slice(0, -1)), setDir(-1), say(`${m.name} removed`)), { ghost: true, color: RED })}</div>
          </div>
        </>
      )
    }
  } else if (top?.id === 'add') {
    tabbed = false
    const ok = form.name.trim().length > 0 && form.times.length > 0
    body = (
      <>
        {header('Add medication', pop)}
        <div style={{ padding: '0 18px' }}>
          <div style={{ display: 'grid', placeItems: 'center', height: 110, borderRadius: 24, background: `${form.color}33`, marginTop: 4 }}>
            <Pill form={form.form} color={form.color} size={84} />
          </div>
          {label('Name')}
          <input aria-label="Name" style={field} placeholder="e.g. Ibuprofen" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          {label('Dosage')}
          <input aria-label="Dosage" style={field} placeholder="e.g. 200 mg" value={form.dose} onChange={(e) => setForm({ ...form, dose: e.target.value })} />
          {label('Form')}
          <div style={{ display: 'flex', gap: 8 }}>{['tablet', 'capsule', 'softgel'].map((f) => chip(f, form.form === f, () => setForm({ ...form, form: f })))}</div>
          {label('Colour')}
          <div style={{ display: 'flex', gap: 10 }}>
            {COLORS.map((c) => (
              <button key={c} type="button" aria-label={`Colour ${c}`} aria-pressed={form.color === c} onClick={() => setForm({ ...form, color: c })} style={{ width: 38, height: 38, borderRadius: '50%', border: form.color === c ? `3px solid ${INK}` : '3px solid transparent', background: c, cursor: 'pointer', padding: 0, boxShadow: 'inset 0 0 0 2px #fff' }} />
            ))}
          </div>
          {label('Times')}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {SLOTS.map(([t, l]) => chip(`${l} ${t}`, form.times.includes(t), () => setForm({ ...form, times: form.times.includes(t) ? form.times.filter((x) => x !== t) : [...form.times, t].sort() }), t))}
          </div>
          {label('Pills in the box')}
          {stepper(form.stock, () => setForm({ ...form, stock: Math.max(1, form.stock - 5) }), () => setForm({ ...form, stock: form.stock + 5 }), 'stock')}
          <div style={{ marginTop: 22 }}>
            {primary('Save medication', () => {
              const id = `m${Date.now()}`
              setMeds((a) => [...a, { id, name: form.name.trim(), dose: form.dose.trim() || '1 dose', form: form.form, color: form.color, per: 1, stock: form.stock, total: form.stock, refillAt: Math.max(3, Math.round(form.stock * 0.2)), times: form.times, days: [0, 1, 2, 3, 4, 5, 6], note: 'Added by you' }])
              setForm({ name: '', dose: '', form: 'tablet', color: COLORS[0], times: ['08:00'], stock: 30, per: 1 })
              setStack([])
              setDir(-1)
              setTab('schedule')
              say('Medication added')
            }, { disabled: !ok })}
          </div>
        </div>
      </>
    )
  } else if (tab === 'today') {
    const hh = Math.floor(clock / 60)
    const R = 44
    const C = 2 * Math.PI * R
    const nd = nextDose
    const nT = nd ? eff(nd) : 0
    body = (
      <>
        <div style={{ display: 'flex', alignItems: 'center', padding: '8px 22px 0', gap: 8 }}>
          <span style={{ flex: 1, color: MUTED, fontSize: 13, fontWeight: 600 }}>{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
          <button type="button" onClick={() => (setClock((c) => Math.min(1439, c + 60)), say('Skipped ahead one hour'))} aria-label="Skip the demo clock ahead one hour" style={{ height: 30, padding: '0 12px', borderRadius: 15, border: 'none', background: '#e6e2f7', color: accent, font: 'inherit', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>{fmt(clock)} · +1h</button>
        </div>
        {header(hh < 12 ? `Good morning, ${name}` : hh < 18 ? `Good afternoon, ${name}` : `Good evening, ${name}`)}
        <div style={{ display: 'flex', gap: 12, padding: '0 18px 14px' }}>
          <div style={{ width: 150, background: CARD, borderRadius: 26, padding: '14px 0 12px', display: 'grid', justifyItems: 'center' }}>
            <div style={{ position: 'relative', width: 104, height: 104 }}>
              <svg width="104" height="104" viewBox="0 0 104 104" style={{ transform: 'rotate(-90deg)' }} role="img" aria-label={`${takenN} of ${doses.length} doses taken`}>
                <circle cx="52" cy="52" r={R} fill="none" stroke="#ece9f6" strokeWidth="10" />
                <circle cx="52" cy="52" r={R} fill="none" stroke={pct >= 1 ? GREEN : accent} strokeWidth="10" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - pct)} style={{ transition: 'stroke-dashoffset .6s cubic-bezier(.3,1.2,.4,1), stroke .3s' }} />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
                <div>
                  <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-.03em' }}>{Math.round(pct * 100)}%</div>
                </div>
              </div>
            </div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: MUTED, marginTop: 6 }}>{takenN} of {doses.length} taken</div>
          </div>
          <button type="button" onClick={() => nd && push({ id: 'med', mid: nd.med.id })} style={{ flex: 1, minWidth: 0, border: 'none', borderRadius: 26, padding: 16, textAlign: 'left', cursor: 'pointer', font: 'inherit', color: '#fff', background: nd && nT < clock ? `linear-gradient(150deg, ${RED}, #ff7a59)` : `linear-gradient(150deg, ${accent}, #9b8cff)`, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', right: -14, bottom: -18, opacity: 0.35 }}>{nd && <Pill form={nd.med.form} color="#fff" size={96} />}</div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.1em', opacity: 0.85 }}>{nd ? (nT < clock ? 'DUE NOW' : 'NEXT DOSE') : 'ALL DONE'}</div>
            {nd ? (
              <>
                <div style={{ fontSize: 19, fontWeight: 800, marginTop: 6, letterSpacing: '-.02em' }}>{nd.med.name}</div>
                <div style={{ fontSize: 13, opacity: 0.9, marginTop: 2 }}>{fmt(nT)}</div>
                <div style={{ fontSize: 22, fontWeight: 800, marginTop: 10, fontVariantNumeric: 'tabular-nums' }}>{nT < clock ? `${until(clock - nT)} ago` : `in ${until(nT - clock)}`}</div>
              </>
            ) : (
              <div style={{ fontSize: 17, fontWeight: 800, marginTop: 10 }}>Nothing left today. Nice work!</div>
            )}
          </button>
        </div>
        <div style={{ padding: '0 22px 8px', fontSize: 12, color: MUTED, fontWeight: 600 }}>Swipe a dose right to take it, left to skip or snooze.</div>
        <div style={{ padding: '0 18px' }}>
          {PERIODS.map((p, pi) => {
            const list = doses.filter((d) => p.test(d.t) && !(pi > 0 && PERIODS[pi - 1].test(d.t)))
            if (!list.length) return null
            return (
              <div key={p.id} style={{ marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0 8px 0', fontWeight: 800, fontSize: 14, color: INK }}>
                  <span style={{ color: accent, display: 'flex' }}><Icon name={p.icon} size={18} /></span> {p.label}
                </div>
                {list.map(doseRow)}
              </div>
            )
          })}
          {doses.length === 0 && <div style={{ textAlign: 'center', color: MUTED, padding: 30 }}>No doses scheduled today.</div>}
        </div>
      </>
    )
  } else if (tab === 'schedule') {
    body = (
      <>
        {header('Schedule', null, roundBtn('plus', 'Add medication', () => push({ id: 'add' }), accent, '#fff'))}
        <div style={{ margin: '0 18px', background: CARD, borderRadius: 24, padding: '12px 10px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr repeat(7, 26px)', gap: 2, alignItems: 'center', padding: '0 4px 6px' }}>
            <span />
            {DAYS.map((d, i) => <span key={d} style={{ textAlign: 'center', fontSize: 10.5, fontWeight: 800, color: i === todayIdx ? accent : MUTED }}>{d.slice(0, 2)}</span>)}
          </div>
          {meds.map((m) => (
            <div key={m.id} style={{ display: 'grid', gridTemplateColumns: '1fr repeat(7, 26px)', gap: 2, alignItems: 'center', padding: '5px 4px', borderTop: `1px solid ${LINE}` }}>
              <button type="button" onClick={() => push({ id: 'med', mid: m.id })} style={{ display: 'flex', alignItems: 'center', gap: 6, border: 'none', background: 'none', font: 'inherit', textAlign: 'left', cursor: 'pointer', color: INK, padding: 0, minWidth: 0 }}>
                <Pill form={m.form} color={m.color} size={26} />
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 12.5, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</span>
                  <span style={{ display: 'block', fontSize: 10.5, color: MUTED }}>{m.times.join(' ')}</span>
                </span>
              </button>
              {DAYS.map((d, i) => {
                const on = m.days.includes(i)
                return (
                  <button key={d} type="button" aria-label={`${m.name} on ${d}`} aria-pressed={on} onClick={() => setMeds((a) => a.map((x) => (x.id === m.id ? { ...x, days: on ? x.days.filter((y) => y !== i) : [...x.days, i].sort() } : x)))} style={{ width: 26, height: 36, borderRadius: 10, border: 'none', background: i === todayIdx ? '#f0edfb' : 'transparent', cursor: 'pointer', display: 'grid', placeItems: 'center', padding: 0 }}>
                    <span style={{ width: 20, height: 20, borderRadius: '50%', display: 'grid', placeItems: 'center', background: on ? m.color : 'transparent', border: on ? 'none' : `2px dashed ${LINE}`, boxSizing: 'border-box', color: '#fff' }}>{on && <Icon name="check" size={13} w={3.4} />}</span>
                  </button>
                )
              })}
            </div>
          ))}
        </div>
        <div style={{ padding: '4px 22px 0', fontSize: 12, color: MUTED, margin: '8px 0' }}>Tap a cell to turn a day on or off.</div>
        <div style={{ padding: '4px 18px 0', display: 'grid', gap: 8 }}>
          {meds.map((m) => (
            <button key={m.id} type="button" onClick={() => push({ id: 'med', mid: m.id })} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: 12, border: 'none', borderRadius: 20, background: CARD, color: INK, font: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
              <span style={{ width: 46, height: 46, borderRadius: 15, background: `${m.color}44`, display: 'grid', placeItems: 'center' }}><Pill form={m.form} color={m.color} size={36} /></span>
              <span style={{ flex: 1 }}>
                <span style={{ display: 'block', fontWeight: 800, fontSize: 15 }}>{m.name} <span style={{ color: MUTED, fontWeight: 600, fontSize: 13 }}>{m.dose}</span></span>
                <span style={{ display: 'block', fontSize: 12, color: m.stock <= m.refillAt ? RED : MUTED, fontWeight: m.stock <= m.refillAt ? 800 : 500, marginTop: 2 }}>{m.stock <= m.refillAt ? `Low: ${m.stock} left` : `${m.stock} left`}</span>
              </span>
              <Icon name="chev" size={18} color={MUTED} />
            </button>
          ))}
          <button type="button" onClick={() => push({ id: 'add' })} style={{ height: 52, borderRadius: 20, border: `2px dashed ${LINE}`, background: 'transparent', color: accent, font: 'inherit', fontWeight: 800, fontSize: 14.5, cursor: 'pointer' }}>+ Add medication</button>
        </div>
      </>
    )
  } else if (tab === 'history') {
    const now = new Date()
    const first = new Date(now.getFullYear(), now.getMonth() + monthOff, 1)
    const dim = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
    const lead = (first.getDay() + 6) % 7
    const isCur = monthOff === 0
    const seedDay = (d) => {
      const per = Math.max(2, doses.length || 6)
      const ds = Array.from({ length: per }, (_, i) => {
        const h = hash(first.getMonth() * 40 + d * 7 + i)
        const badDay = hash(first.getMonth() * 31 + d) < 0.18
        return h < (badDay ? 0.45 : 0.93) ? 'taken' : h < 0.97 ? 'skipped' : 'missed'
      })
      return ds
    }
    const dayInfo = (d) => {
      if (isCur && d === now.getDate()) {
        return { list: doses.map((x) => ({ n: `${x.med.name} ${x.time}`, s: stOf(x)?.s === 'taken' ? 'taken' : stOf(x)?.s === 'skipped' ? 'skipped' : 'pending' })), pct: pct, today: true }
      }
      if (isCur && d > now.getDate()) return null
      const labels = meds.flatMap((m) => m.times.map((t) => `${m.name} ${t}`)).sort((a, b) => a.slice(-5).localeCompare(b.slice(-5)))
      const st = seedDay(d)
      const list = st.map((s, i) => ({ n: labels[i % labels.length], s }))
      return { list, pct: st.filter((s) => s === 'taken').length / st.length }
    }
    const shade = (p) => (p >= 0.99 ? accent : p >= 0.8 ? `color-mix(in srgb, ${accent} 70%, #fff)` : p >= 0.5 ? `color-mix(in srgb, ${accent} 40%, #fff)` : `color-mix(in srgb, ${RED} 35%, #fff)`)
    const infos = Array.from({ length: dim }, (_, i) => dayInfo(i + 1))
    const valid = infos.filter(Boolean)
    const avg = valid.length ? valid.reduce((a, x) => a + x.pct, 0) / valid.length : 0
    let streak = 0
    for (let i = infos.length - 1; i >= 0; i--) {
      if (!infos[i]) continue
      if (infos[i].pct >= 0.8) streak++
      else break
    }
    const sel = selDay && infos[selDay - 1] ? infos[selDay - 1] : null
    body = (
      <>
        {header('History')}
        <div style={{ display: 'flex', gap: 8, padding: '0 18px 12px' }}>
          {[[`${Math.round(avg * 100)}%`, 'Adherence'], [streak, 'Day streak'], [valid.length, 'Days tracked']].map(([v, l]) => (
            <div key={l} style={{ flex: 1, background: CARD, borderRadius: 18, padding: '12px 6px', textAlign: 'center' }}>
              <div style={{ fontSize: 21, fontWeight: 800 }}>{v}</div>
              <div style={{ fontSize: 11, color: MUTED, fontWeight: 600 }}>{l}</div>
            </div>
          ))}
        </div>
        <div style={{ margin: '0 18px', background: CARD, borderRadius: 24, padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <button type="button" aria-label="Previous month" disabled={monthOff <= -1} onClick={() => (setMonthOff(monthOff - 1), setSelDay(null))} style={{ width: 34, height: 34, borderRadius: '50%', border: 'none', background: '#efecf9', color: INK, cursor: 'pointer', display: 'grid', placeItems: 'center', padding: 0, opacity: monthOff <= -1 ? 0.35 : 1 }}><Icon name="back" size={18} /></button>
            <b style={{ fontSize: 16 }}>{first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</b>
            <button type="button" aria-label="Next month" disabled={monthOff >= 0} onClick={() => (setMonthOff(monthOff + 1), setSelDay(null))} style={{ width: 34, height: 34, borderRadius: '50%', border: 'none', background: '#efecf9', color: INK, cursor: 'pointer', display: 'grid', placeItems: 'center', padding: 0, opacity: monthOff >= 0 ? 0.35 : 1 }}><Icon name="chev" size={18} /></button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
            {DAYS.map((d) => <span key={d} style={{ textAlign: 'center', fontSize: 10.5, fontWeight: 800, color: MUTED }}>{d[0]}</span>)}
            {Array.from({ length: lead }, (_, i) => <span key={`l${i}`} />)}
            {infos.map((inf, i) => {
              const d = i + 1
              const isToday = isCur && d === now.getDate()
              return (
                <button key={d} type="button" disabled={!inf} aria-label={`Day ${d}${inf ? `, ${Math.round(inf.pct * 100)} percent` : ''}`} onClick={() => setSelDay(d)} style={{ aspectRatio: '1', borderRadius: 10, border: selDay === d ? `2.5px solid ${INK}` : isToday ? `2px solid ${accent}` : 'none', background: inf ? shade(inf.pct) : '#f4f2fb', color: inf && inf.pct >= 0.8 ? '#fff' : INK, font: 'inherit', fontSize: 11.5, fontWeight: 700, cursor: inf ? 'pointer' : 'default', padding: 0, boxSizing: 'border-box' }}>{d}</button>
              )
            })}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, fontSize: 11, color: MUTED, fontWeight: 600 }}>
            Less {[0.3, 0.6, 0.85, 1].map((p) => <i key={p} style={{ width: 16, height: 16, borderRadius: 5, background: shade(p) }} />)} More
          </div>
        </div>
        <div style={{ margin: '12px 18px 0', background: CARD, borderRadius: 22, padding: '12px 16px', minHeight: 70 }}>
          {sel ? (
            <>
              <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 4 }}>{new Date(first.getFullYear(), first.getMonth(), selDay).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })} · {Math.round(sel.pct * 100)}%</div>
              {sel.list.map((x, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, borderTop: i ? `1px solid ${LINE}` : 'none' }}>
                  <span>{x.n}</span>
                  <b style={{ color: x.s === 'taken' ? GREEN : x.s === 'skipped' ? AMBER : x.s === 'pending' ? MUTED : RED, textTransform: 'capitalize' }}>{x.s}</b>
                </div>
              ))}
            </>
          ) : (
            <div style={{ color: MUTED, fontSize: 13.5, paddingTop: 8, textAlign: 'center' }}>Tap a day to see its doses.</div>
          )}
        </div>
      </>
    )
  } else {
    const row = (icon, title, sub, right) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 0', borderBottom: `1px solid ${LINE}` }}>
        <span style={{ width: 36, height: 36, borderRadius: 12, background: '#efecf9', color: accent, display: 'grid', placeItems: 'center', flex: 'none' }}><Icon name={icon} size={19} /></span>
        <span style={{ flex: 1 }}>
          <span style={{ display: 'block', fontWeight: 700, fontSize: 14.5 }}>{title}</span>
          <span style={{ display: 'block', fontSize: 12, color: MUTED, marginTop: 1 }}>{sub}</span>
        </span>
        {right}
      </div>
    )
    body = (
      <>
        {header('Settings')}
        <div style={{ margin: '0 18px', background: CARD, borderRadius: 22, padding: '0 16px' }}>
          {row('bell', 'Dose reminders', set.remind ? 'Notify me at dose time' : 'Reminders are off', toggle(set.remind, (v) => (setSet({ ...set, remind: v }), say(v ? 'Reminders on' : 'Reminders off')), 'Dose reminders'))}
          {row('snooze', 'Snooze length', 'Used by the skip / snooze sheet', stepper(`${set.snooze}m`, () => setSet({ ...set, snooze: Math.max(5, set.snooze - 5) }), () => setSet({ ...set, snooze: Math.min(60, set.snooze + 5) }), 'snooze'))}
          {row('alert', 'Refill alerts', 'Warn when stock runs low', toggle(set.refillAlert, (v) => setSet({ ...set, refillAlert: v }), 'Refill alerts'))}
          {row('moon', 'Quiet hours', '23:00 to 07:00, no sound', toggle(set.quiet, (v) => setSet({ ...set, quiet: v }), 'Quiet hours'))}
          {row('check', 'Haptic feedback', 'Buzz when a dose is taken', toggle(set.haptic, (v) => setSet({ ...set, haptic: v }), 'Haptic feedback'))}
          <div style={{ padding: '4px 0 0' }}>{row('bell', 'Sound', 'Reminder chime', toggle(set.sound, (v) => setSet({ ...set, sound: v }), 'Sound'))}</div>
        </div>
        <div style={{ padding: '16px 18px', display: 'grid', gap: 10 }}>
          {primary('Send a test reminder', () => say(set.remind ? `Reminder: ${nextDose ? `${nextDose.med.name} at ${fmt(eff(nextDose))}` : 'nothing due'}` : 'Reminders are off'))}
          {primary('Reset demo', () => (setMeds(SEED_MEDS), setLog({ 'm1@08:00': { s: 'taken', at: 482 }, 'm2@08:00': { s: 'taken', at: 483 } }), setClock(9 * 60 + 40), setRefill({}), say('Demo reset')), { ghost: true })}
        </div>
      </>
    )
  }

  const phone = (
    <div style={{ position: 'relative', width: W, height: H, overflow: 'hidden', borderRadius: frame ? 46 : 0, background: BG, color: INK, fontFamily: "'Nunito', 'Inter', -apple-system, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif" }}>
      <style>{`
        @keyframes md-r { from { opacity: 0; transform: translateX(34px) } to { opacity: 1; transform: none } }
        @keyframes md-l { from { opacity: 0; transform: translateX(-34px) } to { opacity: 1; transform: none } }
        @keyframes md-pop { from { transform: scale(0) rotate(-40deg) } to { transform: none } }
        @keyframes md-burst { from { transform: scale(1); opacity: .9 } to { transform: scale(2.1); opacity: 0 } }
        @keyframes md-float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-8px) } }
        @keyframes md-sheet { from { transform: translateY(100%) } to { transform: none } }
        .md-scroll { scrollbar-width: none } .md-scroll::-webkit-scrollbar { display: none }
        .md-app button:focus-visible, .md-app input:focus-visible, .md-app [role=button]:focus-visible { outline: 2px solid ${accent}; outline-offset: 2px }
        @media (prefers-reduced-motion: reduce) { .md-app *, .md-app *::before { animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important } }
      `}</style>
      <StatusBar frame={frame} />
      <div key={`${tab}/${stack.map((s) => s.id).join('/')}/${edit ? 'e' : ''}`} className="md-scroll" style={{ position: 'absolute', top: 54, bottom: tabbed ? 88 : 0, left: 0, right: 0, overflowY: 'auto', paddingBottom: 24, animation: `${dir > 0 ? 'md-r' : 'md-l'} .28s ease` }}>
        {body}
      </div>
      {tabbed && (
        <nav aria-label="Main" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 88, background: '#fff', borderRadius: '28px 28px 0 0', boxShadow: '0 -6px 24px rgba(31,27,51,.08)', display: 'flex', justifyContent: 'space-around', padding: '10px 8px 0' }}>
          {NAV.map(([id, icon, l]) => (
            <button key={id} type="button" onClick={() => go(id)} aria-current={tab === id ? 'page' : undefined} style={{ border: 'none', background: 'none', font: 'inherit', cursor: 'pointer', display: 'grid', justifyItems: 'center', alignContent: 'start', gap: 3, width: 72, height: 54, fontSize: 11, fontWeight: 800, color: tab === id ? accent : MUTED, position: 'relative' }}>
              <span style={{ width: 52, height: 30, borderRadius: 15, display: 'grid', placeItems: 'center', background: tab === id ? `${accent}22` : 'transparent', transition: 'background .2s' }}><Icon name={icon} size={22} /></span>
              {l}
              {id === 'today' && pending.some((d) => eff(d) < clock) && <span style={{ position: 'absolute', top: 0, right: 16, width: 9, height: 9, borderRadius: '50%', background: RED }} />}
            </button>
          ))}
        </nav>
      )}
      {sheet && (
        <>
          <button type="button" aria-label="Close" onClick={() => setSheet(null)} style={{ position: 'absolute', inset: 0, zIndex: 35, border: 'none', background: 'rgba(31,27,51,.4)', cursor: 'default' }} />
          <div role="dialog" aria-label="Skip or snooze" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 36, background: '#fff', borderRadius: '28px 28px 0 0', padding: '14px 20px 34px', animation: 'md-sheet .3s cubic-bezier(.2,.9,.3,1)' }}>
            <div style={{ width: 40, height: 5, borderRadius: 3, background: LINE, margin: '0 auto 14px' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <Pill form={sheet.med.form} color={sheet.med.color} size={46} />
              <div>
                <div style={{ fontWeight: 800, fontSize: 17 }}>{sheet.med.name} · {sheet.time}</div>
                <div style={{ fontSize: 13, color: MUTED }}>Not taking it right now?</div>
              </div>
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              {primary(`Snooze ${set.snooze} minutes`, () => snooze(sheet, set.snooze), { bg: AMBER })}
              {primary('Snooze 1 hour', () => snooze(sheet, 60), { ghost: true })}
              {primary('Skip this dose', () => skip(sheet), { ghost: true, color: RED })}
            </div>
          </div>
        </>
      )}
      <div role="status" style={{ position: 'absolute', left: '50%', top: 58, zIndex: 50, transform: `translate(-50%, ${toast ? 0 : -90}px)`, transition: 'transform .35s cubic-bezier(.2,.8,.2,1)', padding: '10px 16px', borderRadius: 20, background: INK, color: '#fff', fontSize: 12.5, fontWeight: 700, maxWidth: 340, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{toast}</div>
      <div style={{ position: 'absolute', left: '50%', bottom: 8, width: 140, height: 5, marginLeft: -70, borderRadius: 3, background: INK, opacity: 0.8, zIndex: 45 }} />
    </div>
  )

  return (
    <div ref={box} className="md-app" style={{ position: 'relative', width: '100%', height: '100%', display: 'grid', placeItems: 'center', overflow: 'hidden', background: 'radial-gradient(ellipse at 50% 30%, #ece8fb, #c8c1e8 80%)', ...style }}>
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: `translate(-50%, -50%) scale(${scale})`, transformOrigin: 'center' }}>
        {frame ? (
          <div style={{ padding: 12, borderRadius: 58, background: 'linear-gradient(145deg, #3a3f4a, #14171d 40%, #2b2f38)', boxShadow: '0 40px 80px rgba(60,50,110,.35), inset 0 0 0 2px #4b515e' }}>
            <div style={{ padding: 2, borderRadius: 48, background: '#000' }}>{phone}</div>
          </div>
        ) : (
          phone
        )}
      </div>
    </div>
  )
}
