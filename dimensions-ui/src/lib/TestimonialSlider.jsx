'use client'

import { useEffect, useRef, useState } from 'react'

// A testimonial slider of large cards: the company, the quote, the person,
// an initials portrait and a few results. Slides change with a soft blur
// cross-fade; it advances on its own with a progress line under the dots,
// pauses while you hover or focus it, and can be swiped, clicked through with
// the arrows or dots, or driven with the arrow keys. Pass `items` for your own.

const FONT = '"Segoe UI Variable Display", "Segoe UI", system-ui, -apple-system, "Helvetica Neue", sans-serif'

const DEFAULT_ITEMS = [
  { org: 'Northwind Studio', kind: 'Motion studio', quote: 'We used to storyboard for a week. Now we walk into the client call with twenty lit directions and pick one together.', name: 'Ines Okafor', role: 'Head of Motion', stats: [['Concepts per brief', '20+'], ['Pitch prep', '-70%'], ['Team', '9 artists']], hue: '#7c5cff' },
  { org: 'Pebble Labs', kind: 'Hardware startup', quote: 'No in-house 3D team, and our launch renders still look like they came from one. It paid for itself in the first week.', name: 'Tomas Lindqvist', role: 'Founder', stats: [['Render budget saved', '$90k'], ['Launch time', '3 weeks'], ['Shots made', '400+']], hue: '#ff6a9b' },
  { org: 'Atlas Publishing', kind: 'Enterprise', quote: 'Every cover, banner and social post now shares one look, across six teams and four time zones. That used to be impossible.', name: 'Priya Raman', role: 'Brand Director', stats: [['Brand match', '99%'], ['Seats', '150+'], ['Assets a month', '3,800']], hue: '#2fc4a8' },
]

const CSS = `
@keyframes ts-in{from{opacity:0;filter:blur(12px);transform:translateY(12px) scale(.985)}to{opacity:1;filter:blur(0);transform:none}}
@keyframes ts-bar{from{transform:scaleX(0)}to{transform:scaleX(1)}}
.ts__btn{width:44px;height:44px;border-radius:50%;border:none;display:grid;place-items:center;cursor:pointer;color:inherit;transition:background .2s,color .2s}
.ts__btn:hover{background:var(--ts-accent)!important;color:#fff}
.ts__btn:focus-visible,.ts__dot:focus-visible,.ts:focus-visible{outline:2px solid var(--ts-accent);outline-offset:3px}
.ts__dot{height:8px;border-radius:5px;border:none;padding:0;cursor:pointer;background:currentColor;transition:width .35s cubic-bezier(.2,.8,.2,1),opacity .2s}
@media (prefers-reduced-motion:reduce){.ts__card{animation:none!important}}
`

export default function TestimonialSlider({ items = DEFAULT_ITEMS, interval = 7, autoplay = true, accent = '#7c5cff', theme = 'dark', style }) {
  const [i, setI] = useState(0)
  const [paused, setPaused] = useState(false)
  const swipe = useRef(null)
  const dark = theme === 'dark'
  const n = items.length
  const go = (k) => setI(((k % n) + n) % n)

  useEffect(() => {
    if (!autoplay || paused) return undefined
    const t = setTimeout(() => go(i + 1), interval * 1000)
    return () => clearTimeout(t)
  }, [i, paused, autoplay, interval]) // eslint-disable-line react-hooks/exhaustive-deps

  const p = items[i]
  const fg = dark ? '#eef0f6' : '#11131c'
  const card = dark ? '#0d0f1a' : '#ffffff'
  const line = dark ? 'rgba(255,255,255,.1)' : 'rgba(17,19,28,.09)'
  const hue = p.hue || accent
  const initials = p.name
    .split(' ')
    .map((s) => s[0])
    .join('')
    .slice(0, 2)

  return (
    <div
      className="ts"
      tabIndex={0}
      role="region"
      aria-roledescription="carousel"
      aria-label="Testimonials"
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') go(i + 1)
        else if (e.key === 'ArrowLeft') go(i - 1)
      }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onPointerDown={(e) => (swipe.current = e.clientX)}
      onPointerUp={(e) => {
        if (swipe.current == null) return
        const d = e.clientX - swipe.current
        swipe.current = null
        if (Math.abs(d) > 50) go(i + (d < 0 ? 1 : -1))
      }}
      style={{ width: '100%', height: '100%', boxSizing: 'border-box', padding: '44px 6%', display: 'flex', flexDirection: 'column', justifyContent: 'safe center', overflow: 'auto', background: dark ? '#05060c' : '#f6f6f8', color: fg, fontFamily: FONT, '--ts-accent': accent, outline: 'none', ...style }}
    >
      <style>{CSS}</style>
      <div
        key={i}
        className="ts__card"
        aria-roledescription="slide"
        aria-label={`${i + 1} of ${n}`}
        style={{ animation: 'ts-in .7s cubic-bezier(.2,.8,.2,1)', borderRadius: 26, padding: 'clamp(24px, 4vw, 42px)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 34, background: `linear-gradient(135deg, color-mix(in srgb, ${hue} 22%, ${card}), ${card})`, boxShadow: `inset 0 0 0 1px ${line}` }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ alignSelf: 'flex-start', fontSize: 12, letterSpacing: '.18em', textTransform: 'uppercase', padding: '7px 12px', borderRadius: 999, background: line }}>{p.kind}</span>
          <h3 style={{ fontSize: 'clamp(26px, 3.4vw, 36px)', fontWeight: 600, letterSpacing: '-.02em', margin: '18px 0 0' }}>{p.org}</h3>
          <blockquote style={{ fontSize: 'clamp(17px, 2vw, 22px)', lineHeight: 1.5, margin: '18px 0 26px', fontWeight: 400 }}>“{p.quote}”</blockquote>
          <div style={{ marginTop: 'auto' }}>
            <div style={{ fontWeight: 600 }}>{p.name}</div>
            <div style={{ fontSize: 13, opacity: 0.6 }}>{p.role}</div>
          </div>
        </div>
        <div>
          <div aria-hidden="true" style={{ width: 120, height: 150, borderRadius: 999, display: 'grid', placeItems: 'center', fontSize: 40, fontWeight: 600, color: '#fff', background: `linear-gradient(160deg, ${hue}, #141633)` }}>
            {initials}
          </div>
          <div style={{ fontSize: 11, letterSpacing: '.22em', textTransform: 'uppercase', opacity: 0.55, margin: '22px 0 8px' }}>Results</div>
          {p.stats.map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '8px 0', borderBottom: `1px solid ${line}` }}>
              <span style={{ opacity: 0.7 }}>{k}</span>
              <b style={{ fontWeight: 600 }}>{v}</b>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 22, gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {items.map((it, k) => (
              <button key={k} type="button" className="ts__dot" aria-label={`Show ${it.org}`} aria-current={k === i ? 'true' : 'false'} onClick={() => go(k)} style={{ width: k === i ? 28 : 8, opacity: k === i ? 1 : 0.3 }} />
            ))}
          </div>
          {autoplay && (
            <div style={{ width: 90, height: 2, borderRadius: 1, background: line, overflow: 'hidden' }} aria-hidden="true">
              <div key={`${i}-${paused}`} style={{ height: '100%', background: accent, transformOrigin: 'left', animation: paused ? 'none' : `ts-bar ${interval}s linear both`, transform: paused ? 'scaleX(0)' : undefined }} />
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, letterSpacing: '.12em', fontVariantNumeric: 'tabular-nums', opacity: 0.6, marginRight: 6, padding: '6px 10px', borderRadius: 8, boxShadow: `inset 0 0 0 1px ${line}` }}>
            {String(i + 1).padStart(2, '0')} / {String(n).padStart(2, '0')}
          </span>
          <button type="button" className="ts__btn" aria-label="Previous" onClick={() => go(i - 1)} style={{ background: card, boxShadow: `inset 0 0 0 1px ${line}` }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M10 3L5 8l5 5" />
            </svg>
          </button>
          <button type="button" className="ts__btn" aria-label="Next" onClick={() => go(i + 1)} style={{ background: card, boxShadow: `inset 0 0 0 1px ${line}` }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 3l5 5-5 5" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
