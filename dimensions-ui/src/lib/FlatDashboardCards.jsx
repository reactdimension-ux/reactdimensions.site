import { useState } from 'react'

// Flat UI card-grid dashboard: slim dark icon rail, rounded colour-block cards
// (coral / teal / yellow) and white outlined chart cards. No gradients or shadows.

const NAV = [
  'M3 15l5-8 3 4 2-3 4 7z',
  'M2 10s3-5 8-5 8 5 8 5-3 5-8 5-8-5-8-5zM10 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  'M4 16V9M8 16V4M12 16v-6M16 16V7',
  'M10 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM4 17c0-3.3 2.7-5 6-5s6 1.7 6 5',
  'M10 3v9M6 9l4 4 4-4M4 17h12',
  'M4 5h12v12H4zM4 9h12M7 3v4M13 3v4',
  'M10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM10 2v2.5M10 15.5V18M2 10h2.5M15.5 10H18M4.3 4.3l1.8 1.8M13.9 13.9l1.8 1.8M4.3 15.7l1.8-1.8M13.9 6.1l1.8-1.8',
]

// Kitebird Studio workspace, Monday 16 November 2026.
const TASKS = [
  ['Review homepage copy', 'Fernwood shop', 'Ines K.', '12:00'],
  ['Finalise onboarding screens', 'Orbit app', 'Maya L.', '14:00'],
  ['QA checkout flow on iOS', 'Fernwood shop', 'Theo B.', '16:30'],
  ['Write 2.4.1 release notes', 'Orbit app', 'Sam O.', '17:00'],
  ['Export icon set v3 for print', 'Lumen rebrand', 'Ines K.', '18:00'],
]

const MONTHS = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct']
const LINES = {
  Completed: [46, 52, 58, 50, 30, 66, 74],
  Opened: [52, 55, 61, 49, 38, 71, 70],
}

const KPIS = [
  ['Open tasks', '47', '5 due today', 'coral'],
  ['Hours logged · Nov', '612 h', '+8 % vs Oct', 'teal'],
  ['Files shared · Nov', '64', '', 'yellow'],
  ['Team members', '9', '+1 new', 'teal'],
]

const DOWNLOADS = [
  ['Lumen', '42', 'brand-guidelines-v3.pdf · client downloads · Nov 13'],
  ['Orbit', '27', 'Orbit 2.4 TestFlight build · tester installs · Nov 14'],
  ['Fernwood', '18', 'homepage-mockups.fig · review links opened · Nov 11'],
  ['Lumen', '12', 'logo-pack-svg.zip · client downloads · Nov 9'],
  ['Internal', '9', 'q4-roadmap.pdf · team views · Nov 4'],
]

const DONUT = [['Orbit app', 38, 'teal', 233], ['Fernwood', 30, 'blue', 184], ['Lumen', 20, 'yellow', 122], ['Internal', 12, 'coral', 73]]

// 4-week calendar starting Mon 16 Nov; index 0 = Nov 16.
const CAL_START = new Date(2026, 10, 16)
const calDate = (i) => new Date(CAL_START.getFullYear(), CAL_START.getMonth(), CAL_START.getDate() + i)

const EVENTS = [
  ['Mon 16', '09:30', 'Studio standup (daily)'],
  ['Wed 18', '14:00', 'Orbit client review, sprint 14'],
  ['Fri 20', '16:00', 'Lumen brand handoff deadline'],
  ['Wed 25', '11:00', 'Fernwood shop launch'],
  ['Tue 1', '10:00', 'Orbit 2.5 sprint planning'],
  ['Fri 4', '15:00', 'Orbit 2.5 App Store submission'],
]

const Icon = ({ d }) => (
  <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
)

export default function FlatDashboardCards({
  coral = '#ff8068',
  teal = '#0fcfa0',
  yellow = '#ffd27a',
  rail = '#2f6577',
  radius = 14,
  style,
}) {
  const [nav, setNav] = useState(1)
  const [series, setSeries] = useState('Completed')
  const [picked, setPicked] = useState(() => new Set([2, 4, 9, 15, 18]))
  const pts = LINES[series]
  const path = pts.map((v, i) => `${i ? 'L' : 'M'}${20 + i * 46} ${100 - v}`).join(' ')
  const col = { coral, teal, yellow, blue: '#2aa8d8' }

  const R = 30, C = 2 * Math.PI * R
  let off = 0

  return (
    <div className="fc-wrap" style={{ '--coral': coral, '--teal': teal, '--yellow': yellow, '--rail': rail, '--r': `${radius}px`, ...style }}>
      <div className="fc">
      <style>{`
        .fc-wrap { container-type: inline-size; width: 100%; height: 100%; }
        .fc { display: grid; grid-template-columns: 48px minmax(0, 1fr); width: 100%; height: 100%; background: #f5f6f8; color: #2b3a46; font: 400 12px/1.35 system-ui, -apple-system, 'Segoe UI', sans-serif; overflow: hidden; }
        .fc * { box-sizing: border-box; }
        .fc button { font: inherit; border: 0; cursor: pointer; }
        .fc-rail { background: var(--rail); display: flex; flex-direction: column; align-items: center; gap: 2px; padding-bottom: 10px; }
        .fc-rail button { width: 100%; height: 44px; background: transparent; color: #cfe1e8; display: grid; place-items: center; }
        .fc-rail button:hover { color: #fff; }
        .fc-rail button[aria-current='page'] { background: #f5f6f8; color: var(--coral); }
        .fc-rail button:first-child { height: 52px; color: #fff; }
        .fc-grid { display: grid; grid-template-columns: repeat(12, 1fr); grid-template-rows: 1.5fr .6fr 1.3fr; gap: 12px; padding: 14px; min-height: 0; min-width: 0; }
        .fc-card { border-radius: var(--r); padding: 12px 14px; min-width: 0; min-height: 0; overflow: hidden; display: flex; flex-direction: column; }
        .fc-t { font-size: 9px; letter-spacing: .08em; text-transform: uppercase; margin: 0 0 8px; font-weight: 700; display: flex; justify-content: space-between; align-items: center; }
        .coral { background: var(--coral); color: #fff; }
        .teal { background: var(--teal); color: #fff; }
        .yellow { background: var(--yellow); color: #5b4a22; }
        .fc-out { background: #fff; border: 1.5px solid var(--rail); color: #2b3a46; }
        .fc-tasks { grid-column: 1 / 4; }
        .fc-stats { grid-column: 4 / 10; }
        .fc-vis { grid-column: 10 / 13; }
        .fc-kpi { grid-column: span 3; justify-content: center; }
        .fc-kpi small { font-size: 9px; letter-spacing: .06em; text-transform: uppercase; font-weight: 700; }
        .fc-kpi div { display: flex; align-items: baseline; justify-content: space-between; font-size: 22px; font-weight: 700; margin-top: 2px; }
        .fc-kpi em { font-style: normal; font-family: inherit; color: inherit; opacity: .85; font-size: 11px; font-weight: 600; }
        .fc-down { grid-column: 1 / 6; }
        .fc-cal { grid-column: 6 / 13; }
        .fc-task { margin-bottom: 8px; }
        .fc-task b { display: flex; align-items: center; gap: 6px; font-size: 13px; }
        .fc-task b i { width: 12px; height: 9px; background: var(--yellow); border-radius: 2px; }
        .fc-task p { margin: 2px 0 0; font-size: 10px; opacity: .9; }
        .fc-seg { display: flex; gap: 10px; font-size: 9px; letter-spacing: .06em; text-transform: uppercase; }
        .fc-seg button { background: transparent; color: #8a97a1; padding: 0; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; font-size: 9px; }
        .fc-seg button[aria-pressed='true'] { color: var(--coral); }
        .fc-chart { flex: 1; min-height: 0; width: 100%; }
        .fc-donut { flex: 1; display: flex; align-items: center; gap: 10px; min-height: 0; }
        .fc-donut svg { height: 100%; max-height: 110px; aspect-ratio: 1; flex: none; }
        .fc-leg { list-style: none; margin: 0; padding: 0; display: grid; gap: 3px; font-size: 9px; text-transform: uppercase; letter-spacing: .04em; }
        .fc-leg i { display: inline-block; width: 6px; height: 6px; border-radius: 50%; margin-right: 5px; }
        .fc-dl { display: grid; gap: 8px; }
        .fc-dl li { display: grid; grid-template-columns: 78px 52px 1fr; align-items: center; gap: 10px; }
        .fc-dl span { background: #fff; padding: 4px 8px; font-size: 10px; font-weight: 700; text-transform: uppercase; border-radius: 3px; }
        .fc-dl b { font-size: 18px; font-weight: 400; }
        .fc-dl small { font-size: 8px; opacity: .8; }
        .fc-dl { list-style: none; margin: 0; padding: 0; }
        .fc-calbody { display: grid; grid-template-columns: 1fr 1.1fr; gap: 14px; flex: 1; min-height: 0; }
        .fc-days { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; align-content: start; }
        .fc-days button { aspect-ratio: 1; border-radius: 2px; background: var(--teal); padding: 0; }
        .fc-days button[aria-pressed='true'] { background: var(--coral); }
        .fc-ev { overflow: hidden; font-size: 9px; }
        .fc-ev h5 { margin: 0 0 4px; font-size: 9px; letter-spacing: .06em; text-transform: uppercase; }
        .fc-ev p { margin: 0 0 6px; display: flex; gap: 6px; }
        .fc-ev p b { font-weight: 700; }
        @container (max-width: 760px) {
          .fc-grid { grid-template-rows: auto; grid-auto-rows: minmax(0, auto); overflow: hidden; }
          .fc-tasks { display: none; }
          .fc-stats { grid-column: 1 / 8; min-height: 140px; }
          .fc-vis { grid-column: 8 / 13; }
          .fc-kpi { grid-column: span 6; }
          .fc-down { grid-column: 1 / 13; }
          .fc-cal { display: none; }
        }
        @container (max-width: 480px) {
          .fc { grid-template-columns: 1fr; }
          .fc-rail { display: none; }
          .fc-stats, .fc-vis, .fc-down { grid-column: 1 / 13; }
          .fc-vis { display: none; }
        }
      `}</style>

      <nav className="fc-rail" aria-label="Sections">
        {NAV.map((d, i) => (
          <button key={i} aria-current={i === nav ? 'page' : undefined} onClick={() => setNav(i)}><Icon d={d} /></button>
        ))}
      </nav>

      <div className="fc-grid">
        <section className="fc-card coral fc-tasks">
          <h3 className="fc-t"><span>Due today</span><span>Mon 16 Nov</span></h3>
          {TASKS.map(([name, project, owner, due]) => (
            <div key={name} className="fc-task">
              <b><i />{name}</b>
              <p>{project} · {owner} · due {due}</p>
            </div>
          ))}
        </section>

        <section className="fc-card fc-out fc-stats">
          <h3 className="fc-t">
            <span>Tasks per month · 2026</span>
            <span className="fc-seg">
              {Object.keys(LINES).map((k) => (
                <button key={k} aria-pressed={k === series} onClick={() => setSeries(k)}>{k}</button>
              ))}
            </span>
          </h3>
          <svg className="fc-chart" viewBox="0 0 330 120" preserveAspectRatio="none" role="img" aria-label={`Tasks ${series.toLowerCase()} per month, April to October`}>
            <path d={path} fill="none" stroke={coral} strokeWidth="2" vectorEffect="non-scaling-stroke" />
            {pts.map((v, i) => <circle key={i} cx={20 + i * 46} cy={100 - v} r="3" fill={coral} />)}
          </svg>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#4b5a66', padding: '4px 6px 0' }}>
            {MONTHS.map((m, i) => <span key={m} style={{ textAlign: 'center' }}><b style={{ display: 'block', color: '#2b3a46' }}>{pts[i]}</b>{m}</span>)}
          </div>
        </section>

        <section className="fc-card teal fc-vis">
          <h3 className="fc-t"><span>Hours by project</span><span>Nov</span></h3>
          <div className="fc-donut">
            <svg viewBox="0 0 80 80" role="img" aria-label="612 hours logged in November, split by project">
              {DONUT.map(([name, pct, c]) => {
                const len = (pct / 100) * C
                const el = (
                  <circle key={name} cx="40" cy="40" r={R} fill="none" stroke={col[c]} strokeWidth="12"
                    strokeDasharray={`${len - 1.5} ${C - len + 1.5}`} strokeDashoffset={-off} transform="rotate(-90 40 40)" />
                )
                off += len
                return el
              })}
              <text x="40" y="40" textAnchor="middle" fill="#fff" fontSize="13" fontWeight="700">612</text>
              <text x="40" y="50" textAnchor="middle" fill="#fff" fontSize="7" letterSpacing=".5">HOURS</text>
            </svg>
            <ul className="fc-leg">
              {DONUT.map(([name, pct, c, h]) => <li key={name} style={{ whiteSpace: 'nowrap' }}><i style={{ background: col[c] === teal ? '#fff' : col[c] }} />{name}<span style={{ display: 'block', paddingLeft: 11, opacity: .85 }}>{h} h · {pct} %</span></li>)}
            </ul>
          </div>
        </section>

        {KPIS.map(([label, val, delta, c]) => (
          <section key={label} className={`fc-card fc-kpi ${c}`}>
            <small>{label}</small>
            <div>{val}{delta && <em>{delta}</em>}</div>
          </section>
        ))}

        <section className="fc-card yellow fc-down">
          <h3 className="fc-t"><span>Shared files · top this month</span><span>Downloads</span></h3>
          <ul className="fc-dl">
            {DOWNLOADS.map(([n, v, note]) => (
              <li key={note}><span>{n}</span><b>{v}</b><small>{note}</small></li>
            ))}
          </ul>
        </section>

        <section className="fc-card fc-out fc-cal">
          <h3 className="fc-t"><span>Deadlines</span><span style={{ color: coral }}>▾ 16 Nov – 13 Dec</span></h3>
          <div className="fc-calbody">
            <div className="fc-days">
              {Array.from({ length: 28 }, (_, i) => {
                const d = calDate(i)
                return (
                  <button key={i} aria-label={`${d.toDateString()}${picked.has(i) ? ', deadline' : ''}`} aria-pressed={picked.has(i)}
                    style={{ color: '#fff', fontSize: 9, fontWeight: 700 }}
                    onClick={() => setPicked((s) => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n })}>{d.getDate()}</button>
                )
              })}
            </div>
            <div className="fc-ev">
              <h5>Upcoming events</h5>
              {EVENTS.map(([day, time, text]) => <p key={text}><b style={{ minWidth: 40 }}>{day}</b><b style={{ minWidth: 28, fontWeight: 400, opacity: .7 }}>{time}</b><span>{text}</span></p>)}
            </div>
          </div>
        </section>
      </div>
      </div>
    </div>
  )
}
