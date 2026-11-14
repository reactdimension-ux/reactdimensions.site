import { useState, useRef, useEffect, useLayoutEffect, useId } from 'react'

// Keyboard-driven carousel: Left/Right, Home/End and 1-9 change slide, the
// track glides so the active slide sits in the middle, and a clear focus ring
// wraps the active slide while the carousel has focus. Roving tabindex (only
// the active slide is in the tab order), ARIA carousel semantics, and a polite
// "Slide 3 of 7" live region. Prev/next buttons, dots and touch drag/swipe too.

const SLIDES = [
  { t: 'Sunrise', c: ['#ffb347', '#ff6a3d'], art: 'sun' },
  { t: 'Peaks', c: ['#7aa7ff', '#3d4fd6'], art: 'peaks' },
  { t: 'Waves', c: ['#4dd6c1', '#1c7ea8'], art: 'waves' },
  { t: 'Forest', c: ['#8fd16b', '#2a7a4b'], art: 'trees' },
  { t: 'Dusk', c: ['#c58cff', '#5b2d9e'], art: 'moon' },
  { t: 'Desert', c: ['#ffd27a', '#d9822b'], art: 'dunes' },
  { t: 'Night', c: ['#35407a', '#0d1230'], art: 'stars' },
]

function Art({ kind }) {
  const w = 'rgba(255,255,255,.85)'
  const soft = 'rgba(255,255,255,.35)'
  return (
    <svg viewBox="0 0 200 120" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {kind === 'sun' && <><circle cx="100" cy="78" r="30" fill={w} /><path d="M0 100h200v20H0z" fill={soft} /></>}
      {kind === 'peaks' && <><path d="M0 120L50 50l30 40 35-60 45 90z" fill={soft} /><path d="M60 120L110 60l50 60z" fill={w} /></>}
      {kind === 'waves' && [0, 1, 2].map((i) => <path key={i} d={`M0 ${70 + i * 18}q25 -16 50 0t50 0t50 0t50 0`} stroke={w} strokeWidth="5" fill="none" opacity={1 - i * 0.25} />)}
      {kind === 'trees' && [40, 85, 130, 170].map((x, i) => <path key={x} d={`M${x} ${110}l-18 0l18 -${50 + i * 6}l18 ${50 + i * 6}z`} fill={i % 2 ? soft : w} />)}
      {kind === 'moon' && <><circle cx="100" cy="55" r="28" fill={w} /><circle cx="112" cy="48" r="26" fill="#5b2d9e" /></>}
      {kind === 'dunes' && <><path d="M0 95q50 -40 100 0t100 -10v35H0z" fill={w} /><path d="M0 110q60 -30 120 0t80 -5v15H0z" fill={soft} /></>}
      {kind === 'stars' && [[30, 30], [80, 70], [120, 25], [160, 80], [60, 100], [170, 40]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i % 2 ? 2.5 : 4} fill={w} />)}
    </svg>
  )
}

export default function KeyCarousel({ wrap = true, gap = 20, accent = '#ff4d1a', speed = 450, style }) {
  const uid = useId().replace(/:/g, '')
  const n = SLIDES.length
  const [idx, setIdx] = useState(0)
  const [drag, setDrag] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [focused, setFocused] = useState(false)
  const [width, setWidth] = useState(600)
  const boxRef = useRef(null)
  const slideRefs = useRef([])
  const start = useRef(null)
  const reduce = useRef(false)

  useEffect(() => {
    reduce.current = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  }, [])
  useLayoutEffect(() => {
    const el = boxRef.current
    if (!el) return
    const m = () => setWidth(el.clientWidth || 600)
    m()
    const ro = new ResizeObserver(m)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const go = (to, focus) => {
    let t = to
    if (wrap) t = ((to % n) + n) % n
    else t = Math.max(0, Math.min(n - 1, to))
    setIdx(t)
    if (focus) slideRefs.current[t]?.focus({ preventScroll: true })
  }

  const onKeyDown = (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return
    const k = e.key
    if (k === 'ArrowRight') go(idx + 1, true)
    else if (k === 'ArrowLeft') go(idx - 1, true)
    else if (k === 'Home') go(0, true)
    else if (k === 'End') go(n - 1, true)
    else if (/^[1-9]$/.test(k) && +k <= n) go(+k - 1, true)
    else return
    e.preventDefault()
  }

  const sw = Math.min(340, width * 0.66)
  const sh = sw * 0.62
  const x = width / 2 - (idx * (sw + gap) + sw / 2) + drag
  const dur = reduce.current || dragging ? 0 : speed

  const onDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    start.current = { x: e.clientX, id: e.pointerId }
  }
  const onMove = (e) => {
    const s = start.current
    if (!s) return
    const dx = e.clientX - s.x
    if (!dragging && Math.abs(dx) > 6) {
      setDragging(true)
      e.currentTarget.setPointerCapture?.(e.pointerId)
    }
    if (dragging || Math.abs(dx) > 6) setDrag(dx)
  }
  const onUp = () => {
    const s = start.current
    start.current = null
    if (!s) return
    const moved = drag
    setDragging(false)
    setDrag(0)
    if (Math.abs(moved) > Math.min(60, sw / 4)) go(idx + (moved < 0 ? 1 : -1))
  }

  const btn = { all: 'unset', cursor: 'pointer', width: 36, height: 36, borderRadius: 999, background: '#1c1a16', color: '#f4f1ea', display: 'grid', placeItems: 'center', fontSize: 16 }

  return (
    <div
      ref={boxRef}
      className={`kc-${uid}`}
      role="region"
      aria-roledescription="carousel"
      aria-label="Scenery carousel"
      onKeyDown={onKeyDown}
      onFocus={() => setFocused(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setFocused(false)}
      style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: '#f4f1ea', color: '#1c1a16', font: '400 14px/1.4 system-ui, sans-serif', userSelect: 'none', WebkitUserSelect: 'none', ...style }}
    >
      <style>{`
        .kc-${uid} .kc-slide { outline: none; }
        .kc-${uid} .kc-slide:focus-visible { box-shadow: 0 0 0 4px #f4f1ea, 0 0 0 8px ${accent}; }
        .kc-${uid} button:focus-visible { outline: 3px solid ${accent}; outline-offset: 3px; }
      `}</style>
      <div style={{ position: 'absolute', top: 14, left: 0, right: 0, textAlign: 'center', fontSize: 12, color: '#6b665c' }}>
        {focused ? 'Left/Right, Home/End or 1-9 to browse' : 'Click here, then use the arrow keys'}
      </div>

      <div
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: sh + 40, marginTop: -(sh + 40) / 2 - 10, touchAction: 'pan-y', cursor: dragging ? 'grabbing' : 'grab' }}
      >
        <div
          style={{ display: 'flex', gap, alignItems: 'center', height: '100%', transform: `translateX(${x}px)`, transition: `transform ${dur}ms cubic-bezier(.2,.8,.2,1)`, willChange: 'transform' }}
        >
          {SLIDES.map((s, i) => {
            const on = i === idx
            return (
              <div
                key={s.t}
                ref={(el) => (slideRefs.current[i] = el)}
                className="kc-slide"
                role="group"
                aria-roledescription="slide"
                aria-label={`${i + 1} of ${n}: ${s.t}`}
                tabIndex={on ? 0 : -1}
                onClick={() => !drag && go(i)}
                style={{ flex: 'none', width: sw, height: sh, borderRadius: 16, overflow: 'hidden', position: 'relative', background: `linear-gradient(135deg, ${s.c[0]}, ${s.c[1]})`, opacity: on ? 1 : 0.55, transform: `scale(${on ? 1 : 0.9})`, transition: `opacity ${dur}ms, transform ${dur}ms cubic-bezier(.2,.8,.2,1), box-shadow 160ms`, boxShadow: on ? (focused ? `0 0 0 4px #f4f1ea, 0 0 0 8px ${accent}` : '0 10px 28px rgba(0,0,0,.2)') : 'none' }}
              >
                <Art kind={s.art} />
                <div style={{ position: 'absolute', left: 14, bottom: 10, color: '#fff', fontWeight: 700, fontSize: 18, textShadow: '0 1px 6px rgba(0,0,0,.35)' }}>{s.t}</div>
              </div>
            )
          })}
        </div>
      </div>

      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
        <button type="button" style={{ ...btn, opacity: !wrap && idx === 0 ? 0.35 : 1 }} aria-label="Previous slide" onClick={() => go(idx - 1)}>&#8249;</button>
        <div role="group" aria-label="Choose slide" style={{ display: 'flex', gap: 8 }}>
          {SLIDES.map((s, i) => (
            <button key={s.t} type="button" tabIndex={-1} aria-label={`Go to slide ${i + 1}`} aria-current={i === idx ? 'true' : undefined} onClick={() => go(i)} style={{ all: 'unset', cursor: 'pointer', width: i === idx ? 22 : 9, height: 9, borderRadius: 999, background: i === idx ? accent : 'rgba(0,0,0,.25)', transition: 'width 200ms, background 200ms' }} />
          ))}
        </div>
        <button type="button" style={{ ...btn, opacity: !wrap && idx === n - 1 ? 0.35 : 1 }} aria-label="Next slide" onClick={() => go(idx + 1)}>&#8250;</button>
      </div>
      <div aria-live="polite" role="status" style={{ position: 'absolute', right: 16, top: 12, fontSize: 12, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
        Slide {idx + 1} of {n}
      </div>
    </div>
  )
}
