'use client'

import { useEffect, useRef, useState } from 'react'

// A headline that comes into focus word by word. Two ways to play it:
//   intro  - each word rises and sharpens out of a blur in turn, as the
//            headline arrives (or each time it scrolls into view)
//   scroll - the words stay dim and soft until you scroll the line through
//            the middle of the view, then light up one by one with the scroll,
//            and dim again if you scroll back
// Wrap a word in *asterisks* to set it in the accent colour and italics.

// split into words, keeping *highlighted* ones marked
function parse(text) {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => {
      const m = w.match(/^\*(.+)\*([.,!?;:—-]*)$/)
      return m ? { word: m[1], tail: m[2], hi: true } : { word: w, tail: '', hi: false }
    })
}

const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const FONT = '"Segoe UI Variable Display", "Segoe UI", system-ui, -apple-system, "Helvetica Neue", sans-serif'

export default function FocusHeadline({ text = 'Shape ideas in light — the *next* dimension of design', label = 'The approach', mode = 'intro', stagger = 110, blur = 14, rise = 16, size = 64, accent = '#7c5cff', color = '#eef0f6', background = '#05060c', align = 'left', style }) {
  const words = parse(text)
  const root = useRef(null)
  const line = useRef(null)
  const spans = useRef([])
  const [run, setRun] = useState(0) // bumps to replay the intro

  // intro: replay each time the headline comes back into view
  useEffect(() => {
    if (mode !== 'intro') return undefined
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setRun((r) => r + 1), { threshold: 0.4 })
    io.observe(line.current)
    return () => io.disconnect()
  }, [mode])

  // scroll: light words by how far the line has travelled through the view
  useEffect(() => {
    if (mode !== 'scroll') return undefined
    const scroller = root.current
    let raf = 0
    const update = () => {
      raf = 0
      const view = scroller.getBoundingClientRect()
      const r = line.current.getBoundingClientRect()
      const vh = view.height
      const p = clamp((view.top + vh * 0.85 - r.top) / (vh * 0.6 + r.height * 0.5), 0, 1)
      const n = spans.current.length
      spans.current.forEach((s, i) => {
        if (!s) return
        const k = clamp(p * n - i, 0, 1)
        s.style.opacity = String(0.2 + 0.8 * k)
        s.style.filter = `blur(${((1 - k) * blur * 0.08).toFixed(2)}px)`
        s.style.transform = `translateY(${((1 - k) * rise * 0.4).toFixed(1)}px)`
      })
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }
    scroller.addEventListener('scroll', onScroll, { passive: true })
    update()
    return () => (scroller.removeEventListener('scroll', onScroll), cancelAnimationFrame(raf))
  }, [mode, blur, rise, text])

  const scroll = mode === 'scroll'
  const heading = (
    <h2
      ref={line}
      key={scroll ? 'scroll' : run}
      style={{ margin: 0, fontSize: size, lineHeight: 1.1, letterSpacing: '-0.025em', fontWeight: 600, textAlign: align, maxWidth: 1000, fontFamily: FONT }}
    >
      {words.map((w, i) => (
        <span
          key={i}
          ref={(el) => (spans.current[i] = el)}
          style={{
            display: 'inline-block',
            whiteSpace: 'pre',
            color: w.hi ? accent : undefined,
            fontStyle: w.hi ? 'italic' : undefined,
            fontWeight: w.hi ? 500 : undefined,
            ...(scroll ? { opacity: 0.2, transition: 'opacity .15s, filter .15s, transform .15s' } : { animation: `fh-in 0.9s cubic-bezier(.2,.8,.2,1) ${i * stagger}ms both` }),
          }}
        >
          {w.word}
          {w.tail}
          {i < words.length - 1 ? ' ' : ''}
        </span>
      ))}
    </h2>
  )

  // a small, widely spaced label above the headline
  const eyebrow = label ? <div style={{ fontFamily: FONT, fontSize: 12, letterSpacing: '.24em', textTransform: 'uppercase', opacity: 0.5, marginBottom: 22, textAlign: align }}>{label}</div> : null

  return (
    <div ref={root} style={{ position: 'relative', width: '100%', height: '100%', overflow: scroll ? 'auto' : 'hidden', background, color, ...style }}>
      <style>{`@keyframes fh-in{from{opacity:0;filter:blur(${blur}px);transform:translateY(${rise}px)}to{opacity:1;filter:blur(0);transform:none}}@media (prefers-reduced-motion:reduce){[style*='fh-in']{animation:none!important}}`}</style>
      {scroll ? (
        <div style={{ padding: '0 8%' }}>
          <div style={{ height: '75vh', minHeight: 360, display: 'grid', placeItems: 'center', opacity: 0.45, fontSize: 12, letterSpacing: '.24em', textTransform: 'uppercase', fontFamily: FONT }}>Scroll down ↓</div>
          {eyebrow}
          {heading}
          <div style={{ height: '90vh', minHeight: 420 }} />
        </div>
      ) : (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 8%' }}>
          {eyebrow}
          {heading}
        </div>
      )}
    </div>
  )
}
