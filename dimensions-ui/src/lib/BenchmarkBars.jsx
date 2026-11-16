'use client'

import { useEffect, useRef, useState } from 'react'

// Benchmark bars that race to their values the first time they scroll into
// view: each group's bars fill one after another while the numbers count up,
// and the leading row is drawn in the accent gradient. Hover a row to dim the
// others. Two layouts: a card per group, or a compact list. Pass `groups` to
// show your own figures.

const FONT = '"Segoe UI Variable Display", "Segoe UI", system-ui, -apple-system, "Helvetica Neue", sans-serif'

const DEFAULT_GROUPS = [
  { name: 'Speed', rows: [['Ours', 93.6], ['Studio A', 72.4], ['Studio B', 66.1], ['Studio C', 58.9]] },
  { name: 'Quality', rows: [['Ours', 95.2], ['Studio A', 87.5], ['Studio B', 80.3], ['Studio C', 77.8]] },
  { name: 'Consistency', rows: [['Ours', 97.4], ['Studio B', 82.6], ['Studio A', 79.1], ['Studio C', 71.2]] },
]

const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const ease = (t) => 1 - Math.pow(1 - t, 3)

export default function BenchmarkBars({ groups = DEFAULT_GROUPS, layout = 'cards', duration = 1400, stagger = 120, accent = '#7c5cff', accent2 = '#ff8fb3', theme = 'dark', title = 'Faster, sharper, more consistent', label = 'Benchmarks', style }) {
  const root = useRef(null)
  const [t, setT] = useState(0) // ms since the bars started
  const [hover, setHover] = useState(null)
  const dark = theme === 'dark'

  useEffect(() => {
    let raf = 0
    let start = 0
    const tick = (now) => {
      if (!start) start = now
      const e = now - start
      setT(e)
      if (e < duration + stagger * 6) raf = requestAnimationFrame(tick)
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && !start) raf = requestAnimationFrame(tick)
      },
      { threshold: 0.3 },
    )
    io.observe(root.current)
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) setT(1e6)
    return () => (io.disconnect(), cancelAnimationFrame(raf))
  }, [duration, stagger])

  const fg = dark ? '#eef0f6' : '#11131c'
  const card = dark ? '#0d0f1a' : '#ffffff'
  const line = dark ? 'rgba(255,255,255,.08)' : 'rgba(17,19,28,.08)'
  const compact = layout === 'compact'

  return (
    <div ref={root} style={{ width: '100%', height: '100%', overflow: 'auto', background: dark ? '#05060c' : '#f6f6f8', color: fg, fontFamily: FONT, padding: '48px 6%', boxSizing: 'border-box', ...style }}>
      <div style={{ fontSize: 12, letterSpacing: '.22em', textTransform: 'uppercase', opacity: 0.55, marginBottom: 14 }}>{label}</div>
      <h2 style={{ fontSize: 'clamp(26px, 3.6vw, 42px)', fontWeight: 600, letterSpacing: '-.02em', lineHeight: 1.1, margin: '0 0 32px' }}>{title}</h2>
      <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : 'repeat(auto-fit, minmax(240px, 1fr))', gap: compact ? 26 : 20 }}>
        {groups.map((g, gi) => {
          const top = Math.max(...g.rows.map((r) => r[1]))
          return (
            <section key={g.name} style={compact ? {} : { borderRadius: 20, padding: 24, background: card, boxShadow: `inset 0 0 0 1px ${line}` }}>
              <div style={{ fontWeight: 600, fontSize: 17, marginBottom: 4 }}>{g.name}</div>
              {g.rows.map(([name, value], ri) => {
                const delay = (gi * g.rows.length + ri) * stagger * 0.5 + ri * stagger
                const k = ease(clamp((t - delay) / duration, 0, 1))
                const lead = value === top
                const id = `${gi}-${ri}`
                const dim = hover && hover !== id
                return (
                  <div key={name} onMouseEnter={() => setHover(id)} onMouseLeave={() => setHover(null)} style={{ marginTop: 15, opacity: dim ? 0.4 : 1, transition: 'opacity .2s' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 7, fontVariantNumeric: 'tabular-nums' }}>
                      <span style={{ fontWeight: lead ? 700 : 500, opacity: lead ? 1 : 0.7 }}>{name}</span>
                      <span style={{ fontWeight: lead ? 700 : 500 }}>{(value * k).toFixed(1)}</span>
                    </div>
                    <div style={{ height: compact ? 6 : 8, borderRadius: 5, background: line, overflow: 'hidden' }} role="meter" aria-label={`${g.name}: ${name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}>
                      <i style={{ display: 'block', height: '100%', borderRadius: 5, width: `${value * k}%`, background: lead ? `linear-gradient(90deg, ${accent}, ${accent2})` : fg, opacity: lead ? 1 : 0.28 }} />
                    </div>
                  </div>
                )
              })}
            </section>
          )
        })}
      </div>
    </div>
  )
}
