import { useState } from 'react'

// Flat UI widget dashboard: icon rail, slim top bar, and a 3x3 grid of white
// widget cards in teal / purple / orange / grey: line and area charts, donuts,
// grouped bars, a step timeline, an icon list and a dot-matrix chart.
// Solid fills only: no gradients or shadows.

const RAIL = [
  'M3 15l5-6 3 3 6-8M3 3v13h14',
  'M10 2l7 4v8l-7 4-7-4V6zM3 6l7 4 7-4M10 10v8',
  'M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12.5 7.5c-.5-1-1.4-1.5-2.5-1.5-1.4 0-2.5.8-2.5 2s1.1 1.7 2.5 2 2.5.8 2.5 2-1.1 2-2.5 2c-1.1 0-2-.5-2.5-1.5M10 4.5v11',
  'M2 5h16v10H2zM2 9h16M5 12h3',
  'M10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM10 2v2.5M10 15.5V18M2 10h2.5M15.5 10H18M4.3 4.3l1.8 1.8M13.9 13.9l1.8 1.8M4.3 15.7l1.8-1.8M13.9 6.1l1.8-1.8',
]

// Content: website + marketing analytics for "Juniper Lane", a fictional online
// homeware store. Figures are invented but cross-consistent between widgets.

// Daily visitors Nov 6–15, in hundreds (chart max 80 = 8,000). Sum 37,100.
const LINE = [12, 40, 55, 20, 45, 30, 50, 34, 70, 15]
const DAYS = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
const OPTIONS = [
  ['Mobile', '61% of visitors · 2m 14s avg. session'],
  ['Desktop & tablet', '39% of visitors · 3m 48s avg. session'],
]
const WAVES = [
  [40, 55, 48, 62, 50, 58, 44, 52, 40, 46],
  [30, 42, 36, 50, 38, 46, 34, 40, 30, 36],
]
const GROUPS = [
  [[60, 'purple'], [32, 'teal'], [86, 'orange'], [56, 'grey']],
  [[24, 'purple'], [52, 'teal'], [72, 'orange'], [92, 'grey']],
]
const ZIG = [
  [30, 55, 40, 80, 50, 90, 45, 70, 35, 60, 40, 85],
  [20, 35, 28, 50, 34, 58, 30, 44, 24, 40, 30, 52],
]
// Bars are $k of attributed revenue on a $20k scale: Oct $46.8k, Nov 1–15 $48.0k.
const CHANNELS = { purple: ['Paid search', '$4.8k'], teal: ['Social ads', '$10.4k'], orange: ['Email', '$14.4k'], grey: ['Affiliates', '$18.4k'] }
// Checkout funnel, Nov 1–15: each tip shows the step's volume and its onward rate.
const STEPS = [
  ['Viewed', '41,200', 'sessions viewed a product', '11.2%', 'of them added an item to cart'],
  ['Carted', '4,620', 'sessions added to cart', '50.0%', 'of them went on to checkout'],
  ['Checkout', '2,310', 'sessions started checkout', '54.0%', 'of them completed payment'],
  ['Purchased', '1,247', 'orders placed', '3.0%', 'of product viewers placed an order'],
]
const PIE = [[34, 'teal', 'Organic search'], [16, 'purple', 'Social'], [22, 'grey', 'Direct'], [28, 'orange', 'Email & referral']]
const LIST = [
  ['M4 5h12v10H4zM8 9h4', '1,247', 'teal', 'Orders placed'],
  ['M5 3l3 1 1 4-2 1a8 8 0 0 0 4 4l1-2 4 1 1 3c-6 1-13-6-12-12z', '$40.5k', 'orange', 'Mobile revenue (52%)'],
  ['M3 4h2l2 9h9l2-6H6M8 17h.01M15 17h.01', '$62.40', 'teal', 'Avg. order value'],
  ['M3 5h14v10H3zM3 5l7 6 7-6', '+1,284', 'teal', 'New newsletter subs'],
  ['M5 6h10l-1 11H6zM8 6V4h4v2M3 6h14', '3.1%', 'purple', 'Orders returned'],
  ['M10 3v6M7 6v6M13 6v6M5 12c0 3 2 5 5 5s5-2 5-5', '28%', 'purple', 'Repeat customers'],
]
// Daily ad spend Nov 7–15, one block = $100; orange days went over the $500 cap. Sum $4,800.
const DOTS = [[5, 'teal'], [3, 'teal'], [6, 'orange'], [2, 'teal'], [8, 'orange'], [7, 'orange'], [4, 'teal'], [8, 'orange'], [5, 'teal']]

const Icon = ({ d, size = 18 }) => (
  <svg viewBox="0 0 20 20" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
)

const pts = (arr, w, h, max = 100) => arr.map((v, i) => `${(i / (arr.length - 1)) * w},${h - (v / max) * h}`).join(' ')

function Donut({ parts, size = 80, stroke = 14, hole, children }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  let off = 0
  return (
    <div style={{ position: 'relative', width: size, height: size, flex: 'none' }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} style={{ transform: 'rotate(-90deg)' }} aria-hidden="true">
        {hole && <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={hole} strokeWidth={stroke} />}
        {parts.map(([pct, color], i) => {
          const len = (pct / 100) * c
          const el = <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-off} />
          off += len
          return el
        })}
      </svg>
      {children && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 14, fontWeight: 700 }}>{children}</div>}
    </div>
  )
}

const Note = ({ w = '100%', children }) => (
  <p className="fw-note" style={{ maxWidth: w }}>{children}</p>
)

export default function FlatDashboardWidgets({
  teal = '#1fb5a5',
  purple = '#922b7e',
  orange = '#f4a623',
  grey = '#7c7f86',
  radius = 6,
  style,
}) {
  const [nav, setNav] = useState(2)
  const [option, setOption] = useState(0)
  const [step, setStep] = useState(1)
  const col = { teal, purple, orange, grey }

  return (
    <div className="fw-wrap" style={{ '--teal': teal, '--purple': purple, '--orange': orange, '--grey': grey, '--r': `${radius}px`, ...style }}>
      <div className="fw">
      <style>{`
        .fw-wrap { container-type: inline-size; width: 100%; height: 100%; }
        .fw { display: grid; grid-template-columns: 64px minmax(0, 1fr); grid-template-rows: 56px minmax(0, 1fr); width: 100%; height: 100%; background: #eef1f2; color: #3c4048; font: 400 11px/1.35 system-ui, -apple-system, 'Segoe UI', sans-serif; overflow: hidden; }
        .fw * { box-sizing: border-box; }
        .fw button { font: inherit; border: 0; cursor: pointer; }
        .fw-burger { background: #fff; display: grid; place-items: center; color: #4a4e57; border-right: 1px solid #eef1f2; }
        .fw-rail { background: #fff; display: flex; flex-direction: column; align-items: center; gap: 6px; padding-top: 14px; }
        .fw-rail button { position: relative; width: 100%; height: 48px; background: transparent; color: #a3a8b1; display: grid; place-items: center; }
        .fw-rail button:hover { color: #4a4e57; }
        .fw-rail button[aria-current='page'] { color: var(--teal); }
        .fw-rail button[aria-current='page']::after { content: ''; position: absolute; right: 0; top: 8px; bottom: 8px; width: 3px; background: var(--teal); }
        .fw-top { background: #fff; display: flex; align-items: center; gap: 16px; padding: 0 18px 0 22px; min-width: 0; }
        .fw-logo { width: 26px; height: 26px; border: 1.5px solid #d4d8de; border-radius: 4px; display: grid; place-items: center; font-weight: 800; font-size: 12px; color: #4a4e57; }
        .fw-cta { margin-left: auto; background: var(--teal); color: #fff; padding: 7px 26px; border-radius: 3px; font-weight: 500; }
        .fw-cta:hover { background: color-mix(in srgb, var(--teal), black 12%); }
        .fw-icons { display: flex; align-items: center; gap: 18px; padding: 0 18px; margin-left: 18px; border-left: 1px solid #eef1f2; border-right: 1px solid #eef1f2; height: 100%; color: #b8bcc4; }
        .fw-bell { position: relative; }
        .fw-bell i { position: absolute; top: -4px; right: -5px; width: 9px; height: 9px; border-radius: 50%; background: var(--orange); }
        .fw-user { display: flex; align-items: center; gap: 10px; font-size: 13px; white-space: nowrap; }
        .fw-av { width: 30px; height: 30px; border-radius: 50%; background: #fbe6c5; color: #9a6a12; display: grid; place-items: center; font-weight: 700; font-size: 11px; }
        /* Rows grow to fit their cards (never squeezed and cut off); the grid scrolls
           instead, settling on whole rows rather than stopping halfway through a card. */
        .fw-grid { padding: 18px; display: grid; grid-template-columns: 1.15fr 1fr 1fr; grid-auto-rows: minmax(200px, auto); align-content: start; gap: 16px; min-width: 0; min-height: 0; overflow-y: auto; overscroll-behavior: contain; scroll-snap-type: y proximity; scroll-padding: 18px; scrollbar-width: thin; }
        .fw-grid > * { scroll-snap-align: start; }
        .fw-c { background: #fff; border-radius: var(--r); padding: 12px 14px; min-width: 0; min-height: 0; overflow: hidden; display: flex; flex-direction: column; }
        .fw-note { margin: 0; font-size: 7px; line-height: 1.5; color: #9a9ea7; }
        .fw-note strong { display: block; font-size: 10px; font-weight: 700; color: #3c4048; }
        .fw-brand { font-size: 13px; font-weight: 700; color: #3c4048; white-space: nowrap; }
        .fw-brand span { font-weight: 400; color: #9a9ea7; }
        .fw-key { display: flex; gap: 12px; font-size: 7px; color: #5a5e66; margin-bottom: 6px; }
        .fw-key span { display: flex; align-items: center; gap: 4px; }
        .fw-key i { width: 10px; height: 6px; display: block; }
        .fw-h { margin: 0 0 8px; font-size: 7.5px; font-weight: 800; text-transform: uppercase; letter-spacing: .04em; color: #3c4048; }
        .fw-chart { flex: 1; min-height: 70px; width: 100%; }
        .fw-ax { display: flex; justify-content: space-between; font-size: 6.5px; font-weight: 700; color: #5a5e66; }
        .fw-two { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 8px; }
        .fw-opt { display: flex; gap: 8px; align-items: flex-start; background: transparent; text-align: left; padding: 0; margin-bottom: 8px; }
        .fw-opt i { width: 10px; height: 10px; border-radius: 50%; border: 1.5px solid #c9cdd4; flex: none; margin-top: 1px; display: grid; place-items: center; }
        .fw-opt[aria-checked='true'] i { border-color: var(--purple); }
        .fw-opt[aria-checked='true'] i::after { content: ''; width: 4px; height: 4px; border-radius: 50%; background: var(--purple); }
        .fw-donuts { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; flex: 1; min-height: 110px; align-items: center; }
        .fw-donuts > div { display: flex; flex-direction: column; align-items: center; gap: 8px; height: 100%; }
        .fw-bars { flex: 1; min-height: 70px; display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
        .fw-bgrp { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; align-items: end; }
        .fw-bcol { height: 100%; background: #e6e8eb; display: flex; align-items: flex-end; }
        .fw-bcol i { display: block; width: 100%; transition: height 300ms; }
        .fw-leg { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 12px; margin-top: 8px; }
        .fw-leg div { display: flex; gap: 6px; align-items: center; }
        .fw-leg b { width: 14px; height: 14px; border-radius: 50%; flex: none; display: grid; place-items: center; color: #fff; font-size: 7px; }
        .fw-tl { flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 12px; }
        .fw-tips { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding: 0 6%; }
        .fw-tip { border: 1px solid; border-radius: 4px; padding: 6px 8px; }
        .fw-track { position: relative; display: flex; justify-content: space-between; align-items: center; padding: 0 6%; }
        .fw-track::before { content: ''; position: absolute; left: 6%; right: 6%; top: 50%; height: 1.5px; background: #d5d9de; }
        .fw-step { position: relative; display: flex; flex-direction: column; align-items: center; gap: 8px; background: transparent; padding: 0; font-size: 7.5px; font-weight: 800; text-transform: uppercase; color: #3c4048; }
        .fw-step i { width: 10px; height: 10px; border-radius: 50%; background: var(--teal); outline: 0 solid transparent; transition: outline 150ms; }
        .fw-step[aria-current='step'] i { background: var(--orange); outline: 6px solid color-mix(in srgb, var(--purple) 55%, transparent); }
        .fw-step span { position: absolute; top: 20px; white-space: nowrap; }
        .fw-pie { display: flex; gap: 14px; align-items: center; flex: 1; }
        .fw-pie > div:last-child { display: grid; gap: 8px; flex: 1; min-width: 0; }
        .fw-pie .fw-note { border-bottom: 1px solid #e3e6ea; padding-bottom: 6px; display: flex; align-items: center; gap: 6px; }
        .fw-pie .fw-note i { width: 7px; height: 7px; border-radius: 50%; flex: none; }
        .fw-pie .fw-note b { margin-left: auto; color: #3c4048; }
        .fw-list { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 14px; align-content: center; flex: 1; }
        .fw-list > div { display: flex; align-items: center; gap: 8px; min-width: 0; }
        .fw-ic { width: 24px; height: 24px; border-radius: 50%; border: 1.5px solid; display: grid; place-items: center; flex: none; }
        .fw-list b { display: block; font-size: 8px; font-weight: 700; }
        .fw-dotc { display: grid; grid-template-columns: 1fr auto; gap: 12px; flex: 1; min-height: 90px; }
        .fw-dots { display: grid; grid-template-columns: repeat(9, 1fr); gap: 4px; align-items: end; }
        .fw-dcol { display: flex; flex-direction: column-reverse; gap: 2px; align-items: center; }
        .fw-dcol i { width: 7px; height: 5px; display: block; }
        .fw-tot { display: grid; gap: 8px; align-content: center; }
        .fw-tot b { display: block; background: #f1f3f5; padding: 4px 8px; font-size: 13px; font-weight: 600; }

        @container (max-width: 900px) {
          .fw-grid { grid-template-columns: 1fr 1fr; }
          .fw-icons { display: none; }
        }
        @container (max-width: 560px) {
          .fw { grid-template-columns: 1fr; }
          .fw-burger, .fw-rail { display: none; }
          .fw-grid { grid-template-columns: 1fr; padding: 12px; }
          .fw-user span { display: none; }
        }
      `}</style>

      <button className="fw-burger" aria-label="Menu"><Icon d="M3 5h14M3 10h14M3 15h14" size={22} /></button>

      <header className="fw-top">
        <div className="fw-logo">J</div>
        <div className="fw-brand">Juniper Lane <span>· Marketing analytics</span></div>
        <button className="fw-cta">New campaign</button>
        <div className="fw-icons">
          <Icon d="M2 5h16v11H2zM2 5l8 6 8-6" />
          <span className="fw-bell"><Icon d="M5 14V9a5 5 0 0 1 10 0v5l1.5 2h-13zM8.5 18h3" /><i /></span>
        </div>
        <div className="fw-user"><div className="fw-av">RL</div><span>Rhea Lindqvist ▾</span></div>
      </header>

      <nav className="fw-rail" aria-label="Sections">
        {RAIL.map((d, i) => (
          <button key={i} aria-current={i === nav ? 'page' : undefined} onClick={() => setNav(i)}><Icon d={d} size={22} /></button>
        ))}
      </nav>

      <div className="fw-grid">
        {/* 1. line chart on a grid */}
        <section className="fw-c">
          <h3 className="fw-h">Daily visitors · Nov 6–15 (0–8k)</h3>
          <div className="fw-ax">{DAYS.map((n) => <span key={n}>{n}</span>)}</div>
          <svg className="fw-chart" viewBox="0 0 300 100" preserveAspectRatio="none" role="img" aria-label="Line chart">
            {Array.from({ length: 10 }, (_, i) => <line key={`v${i}`} x1={i * 33.3} x2={i * 33.3} y1="0" y2="100" stroke="#e3e6ea" vectorEffect="non-scaling-stroke" />)}
            {Array.from({ length: 5 }, (_, i) => <line key={`h${i}`} x1="0" x2="300" y1={i * 25} y2={i * 25} stroke="#e3e6ea" vectorEffect="non-scaling-stroke" />)}
            <polyline points={pts(LINE, 300, 100, 80)} fill="none" stroke={teal} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
          </svg>
          <div className="fw-two">
            <Note><strong>37,100</strong>Visitors in 10 days, up 12% on the previous 10</Note>
            <Note><strong>7,000</strong>Peak on Nov 14, the day the winter sale email went out</Note>
          </div>
        </section>

        {/* 2. radio options over an area chart */}
        <section className="fw-c">
          <h3 style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, textAlign: 'center' }}>Visitors by device</h3>
          <div role="radiogroup" aria-label="Highlight device">
            {OPTIONS.map(([name, desc], i) => (
              <button key={i} role="radio" className="fw-opt" aria-checked={i === option} onClick={() => setOption(i)}>
                <i /><span className="fw-note"><b style={{ color: '#3c4048' }}>{name}</b> · {desc}</span>
              </button>
            ))}
          </div>
          <svg className="fw-chart" viewBox="0 0 300 70" preserveAspectRatio="none" aria-hidden="true">
            {WAVES.map((w, k) => (
              <polygon key={k} points={`0,70 ${pts(w.map((v) => v + (k === option ? 10 : 0)), 300, 70)} 300,70`} fill={purple} opacity={k ? 0.9 : 0.35} />
            ))}
          </svg>
          <div className="fw-ax" style={{ fontWeight: 400, color: '#9a9ea7', marginTop: 4 }}>{DAYS.map((n) => <span key={n}>Nov {n}</span>).filter((_, i) => i % 3 === 0)}</div>
        </section>

        {/* 3. two percentage donuts */}
        <section className="fw-c">
          <div className="fw-donuts">
            {[
              [18, teal, 'Cart recovery', '191 of 1,063 abandoned checkouts won back by reminder emails'],
              [24, orange, 'Email open rate', '10,032 of 41,800 winter sale newsletters opened'],
            ].map(([v, c, title, note], i) => (
              <div key={i}>
                <div><h4 className="fw-h" style={{ marginBottom: 2 }}>{title}</h4><Note>{note}</Note></div>
                <Donut parts={[[v, c]]} hole="#d6d9de" size={74} stroke={14}>{v}%</Donut>
              </div>
            ))}
          </div>
        </section>

        {/* 4. grouped bars with legend */}
        <section className="fw-c">
          <h3 className="fw-h">Campaign revenue by channel (0–$20k)</h3>
          <div className="fw-bars">
            {GROUPS.map((g, gi) => (
              <div key={gi} className="fw-bgrp">
                {g.map(([h, c], i) => <div key={i} className="fw-bcol"><i style={{ height: `${h}%`, background: col[c] }} /></div>)}
              </div>
            ))}
          </div>
          <div className="fw-two" style={{ marginTop: 4, gap: 18 }}>
            <div className="fw-ax" style={{ justifyContent: 'center' }}>October · $46.8k</div>
            <div className="fw-ax" style={{ justifyContent: 'center' }}>Nov 1–15 · $48.0k</div>
          </div>
          <div className="fw-leg">
            {['purple', 'orange', 'teal', 'grey'].map((c) => (
              <div key={c}><b style={{ background: col[c] }}>{CHANNELS[c][0][0]}</b><span className="fw-note">{CHANNELS[c][0]} · <b style={{ all: 'unset', color: '#3c4048', fontWeight: 700 }}>{CHANNELS[c][1]}</b> this month</span></div>
            ))}
          </div>
        </section>

        {/* 5. zig-zag twin line chart */}
        <section className="fw-c">
          <h3 className="fw-h">Pageviews vs. unique visitors · this week (0–10k)</h3>
          <div className="fw-key">
            <span><i style={{ background: teal, opacity: 0.35 }} />Pageviews</span>
            <span><i style={{ height: 0, borderTop: `1.5px solid ${teal}` }} />Unique visitors</span>
          </div>
          <svg className="fw-chart" viewBox="0 0 300 120" preserveAspectRatio="none" role="img" aria-label="Two series line chart">
            {[0, 1, 2, 3, 4].map((i) => <line key={i} x1="0" x2="300" y1={i * 30} y2={i * 30} stroke="#e3e6ea" vectorEffect="non-scaling-stroke" />)}
            <polygon points={`0,120 ${pts(ZIG[0], 300, 120)} 300,120`} fill={teal} opacity=".12" />
            {ZIG.map((z, i) => <polyline key={i} points={pts(z, 300, 120)} fill="none" stroke={teal} strokeWidth="1.3" vectorEffect="non-scaling-stroke" />)}
          </svg>
          <div className="fw-ax" style={{ fontWeight: 400, color: '#9a9ea7', marginTop: 4 }}>{['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => <span key={d}>{d}</span>)}</div>
        </section>

        {/* 6. step timeline with callouts */}
        <section className="fw-c">
          <h3 className="fw-h" style={{ textAlign: 'center' }}>Checkout funnel · Nov 1–15</h3>
          <div className="fw-tl">
            <div className="fw-tips">
              <div className="fw-tip" style={{ borderColor: orange }}><Note><strong>{STEPS[step][1]}</strong>{STEPS[step][2]}</Note></div>
              <div className="fw-tip" style={{ borderColor: teal }}><Note><strong>{STEPS[step][3]}</strong>{STEPS[step][4]}</Note></div>
            </div>
            <div className="fw-track">
              {STEPS.map(([s], i) => (
                <button key={s} className="fw-step" aria-current={i === step ? 'step' : undefined} onClick={() => setStep(i)}>
                  <i /><span>{s}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* 7. multi-part donut with notes */}
        <section className="fw-c">
          <h3 className="fw-h" style={{ textAlign: 'right' }}>Traffic sources · share of visits</h3>
          <div className="fw-pie">
            <Donut parts={PIE.map(([v, c]) => [v, col[c]])} size={84} stroke={18} />
            <div>{PIE.map(([v, c, label]) => <Note key={label}><i style={{ background: col[c] }} />{label}<b>{v}%</b></Note>)}</div>
          </div>
        </section>

        {/* 8. icon list */}
        <section className="fw-c">
          <h3 className="fw-h">Store KPIs · Nov 1–15</h3>
          <div className="fw-list">
            {LIST.map(([d, v, c, label], i) => (
              <div key={i}>
                <span className="fw-ic" style={{ borderColor: col[c], color: col[c] }}><Icon d={d} size={12} /></span>
                <div style={{ minWidth: 0 }}><b style={{ color: col[c] }}>{v}</b><span className="fw-note">{label}</span></div>
              </div>
            ))}
          </div>
        </section>

        {/* 9. dot-matrix columns with totals */}
        <section className="fw-c">
          <h3 className="fw-h">Daily ad spend · Nov 7–15 (1 block = $100)</h3>
          <div className="fw-key">
            <span><i style={{ background: teal }} />Within $500 cap</span>
            <span><i style={{ background: orange }} />Over cap</span>
          </div>
          <div className="fw-dotc">
            <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <div className="fw-ax" style={{ fontSize: 6, marginBottom: 6 }}>{DAYS.slice(1).map((n) => <span key={n}>{n}</span>)}</div>
              <div className="fw-dots" style={{ flex: 1 }}>
                {DOTS.map(([n, c], i) => (
                  <div key={i} className="fw-dcol">{Array.from({ length: n }, (_, k) => <i key={k} style={{ background: col[c] }} />)}</div>
                ))}
              </div>
            </div>
            <div className="fw-tot">
              <div><b>$4,800</b><Note w="70px">Spent in 9 days</Note></div>
              <div><b>$200</b><Note w="70px">Left of $5,000 budget</Note></div>
            </div>
          </div>
        </section>
      </div>
      </div>
    </div>
  )
}
