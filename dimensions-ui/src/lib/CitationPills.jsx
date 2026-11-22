import { useEffect, useState } from 'react'

// text pieces: a string, or a number that points into `sources` (1-based)
const TEXT = [
  'React re-renders a component whenever its state changes',
  1,
  '. Effects run after that render is on screen',
  2,
  ', and the function an effect returns runs before the next effect and when the component goes away',
  3,
  '. That cleanup is the right place to stop a timer',
  2,
  '.',
]
const SOURCES = [
  { title: 'State: a component’s memory', site: 'react.dev', snippet: 'Setting state requests a new render, so React calls your component again with the new value.' },
  { title: 'Synchronizing with Effects', site: 'react.dev', snippet: 'Effects run at the end of a commit, after the screen updates. Return a cleanup function to undo what the effect did.' },
  { title: 'setInterval() global function', site: 'developer.mozilla.org', snippet: 'Repeatedly calls a function with a fixed delay. Call clearInterval() with the returned ID to stop it.' },
]

// An answer with numbered source pills inline. Hovering or focusing a pill opens
// a small preview card; on its own the demo walks through the sources in turn.
export default function CitationPills({
  text = TEXT,
  sources = SOURCES,
  autoplay = true,
  list = true, // show the source list under the answer
  size = 15,
  width = 500,
  background = '#141414',
  textColor = '#e8e6e1',
  mutedColor = '#8f8c86',
  accent = '#d77757',
  cardColor = '#232220',
}) {
  const [hover, setHover] = useState(null) // the pill (index into text) being pointed at
  const [auto, setAuto] = useState(0)
  const pills = text.map((t, i) => (typeof t === 'number' ? i : -1)).filter((i) => i >= 0)

  useEffect(() => {
    if (!autoplay || hover !== null) return
    const t = setInterval(() => setAuto((n) => (n + 1) % (pills.length + 1)), 2200)
    return () => clearInterval(t)
  }, [autoplay, hover, pills.length])

  // the open pill: the one pointed at, or the demo's turn (one step in each loop shows none)
  const open = hover ?? (autoplay && auto < pills.length ? pills[auto] : null)

  return (
    <div style={{ width: `min(${width}px, 100%)`, boxSizing: 'border-box', padding: '1.2em 1.3em', borderRadius: 12, background, color: textColor, font: `400 ${size}px/1.75 "Plus Jakarta Sans", system-ui, -apple-system, "Segoe UI", sans-serif` }}>
      <style>{`
        @keyframes cp-in{from{opacity:0;transform:translate(-50%,4px) scale(.97)}to{opacity:1;transform:translate(-50%,0)}}
        @media (prefers-reduced-motion:reduce){.cp *{animation:none!important;transition:none!important}}
      `}</style>
      <p className="cp" style={{ margin: 0 }}>
        {text.map((t, i) => {
          if (typeof t !== 'number') return <span key={i}>{t}</span>
          const s = sources[t - 1]
          const on = open === i
          return (
            <span key={i} style={{ position: 'relative', display: 'inline-block' }}>
              <a
                href={`https://${s.site}`}
                target="_blank"
                rel="noreferrer"
                aria-describedby={on ? `cp-card-${i}` : undefined}
                onPointerEnter={() => setHover(i)}
                onPointerLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                style={{ display: 'inline-grid', placeItems: 'center', minWidth: '1.45em', height: '1.45em', margin: '0 0.15em', padding: '0 0.3em', boxSizing: 'border-box', borderRadius: 6, verticalAlign: '0.12em', font: `600 ${size * 0.68}px/1 ui-monospace, Menlo, monospace`, textDecoration: 'none', color: on ? background : mutedColor, background: on ? accent : `${mutedColor}2a`, transition: 'background .2s, color .2s' }}
              >
                {t}
              </a>
              {on && (
                <span
                  id={`cp-card-${i}`}
                  role="tooltip"
                  style={{ position: 'absolute', zIndex: 2, top: 'calc(100% + 6px)', left: '50%', width: 250, padding: '10px 12px', borderRadius: 10, background: cardColor, border: `1px solid ${mutedColor}33`, boxShadow: '0 16px 36px -14px rgba(0,0,0,.7)', lineHeight: 1.45, pointerEvents: 'none', animation: 'cp-in .18s ease-out forwards' }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 7, color: mutedColor, fontSize: '0.75em' }}>
                    <span aria-hidden style={{ width: 16, height: 16, borderRadius: 4, display: 'grid', placeItems: 'center', background: accent, color: background, fontSize: 10, fontWeight: 700 }}>
                      {s.site[0].toUpperCase()}
                    </span>
                    {s.site}
                  </span>
                  <span style={{ display: 'block', margin: '5px 0 3px', fontSize: '0.86em', fontWeight: 600, color: textColor }}>{s.title}</span>
                  <span style={{ display: 'block', fontSize: '0.78em', color: mutedColor }}>{s.snippet}</span>
                </span>
              )}
            </span>
          )
        })}
      </p>
      {list && (
        <ol style={{ margin: '0.9em 0 0', padding: '0.8em 0 0', listStyle: 'none', borderTop: `1px solid ${mutedColor}2a`, display: 'grid', gap: 4, fontSize: '0.8em', lineHeight: 1.4 }}>
          {sources.map((s, n) => {
            const lit = open !== null && text[open] === n + 1
            return (
              <li key={n} style={{ display: 'flex', gap: 8, color: lit ? textColor : mutedColor, transition: 'color .2s' }}>
                <span style={{ color: lit ? accent : mutedColor, fontFamily: 'ui-monospace, Menlo, monospace', transition: 'color .2s' }}>{n + 1}</span>
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {s.title} <span style={{ opacity: 0.7 }}>· {s.site}</span>
                </span>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
