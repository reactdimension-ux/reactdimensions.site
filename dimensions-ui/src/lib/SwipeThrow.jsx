import { useEffect, useRef, useState } from 'react'

// Swipe-to-throw card stack: drag the top card; let go with enough upward
// distance or speed and it is thrown off the top, carrying your release
// velocity and spinning as it fades, while the next card scales up into
// place. Let go too softly and it springs back on a damped spring.
// Arrow Up (when focused) or the Throw button do the same; Undo flies the
// last card back in. Under reduced motion cards simply fade out and in.

const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const TITLES = ['Dawn', 'Ridge', 'Harbour', 'Dunes', 'Orchard', 'Aurora', 'Lagoon', 'Canyon', 'Meadow', 'Glacier', 'Mesa', 'Tundra']

// small deterministic generator so each card's art is stable
function rng(seed) {
  let s = (seed * 9301 + 49297) % 233280
  return () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
}

function CardArt({ i, accent }) {
  const r = rng(i + 3)
  const hue = Math.round(r() * 360)
  const h2 = (hue + 40 + Math.round(r() * 60)) % 360
  const sunX = 30 + r() * 140
  const sunY = 40 + r() * 40
  const ridges = [0, 1, 2].map((k) => {
    const base = 110 + k * 22
    let d = `M0 ${base}`
    for (let x = 0; x <= 200; x += 25) d += ` L${x} ${base - 8 - r() * (28 - k * 6)}`
    return `${d} L200 170 L0 170 Z`
  })
  return (
    <svg viewBox="0 0 200 170" preserveAspectRatio="xMidYMid slice" style={{ width: '100%', height: '100%', display: 'block' }} aria-hidden="true">
      <defs>
        <linearGradient id={`sky${i}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={`hsl(${hue} 70% 62%)`} />
          <stop offset="1" stopColor={`hsl(${h2} 80% 82%)`} />
        </linearGradient>
      </defs>
      <rect width="200" height="170" fill={`url(#sky${i})`} />
      <circle cx={sunX} cy={sunY} r={16 + r() * 8} fill="#fff6dc" opacity="0.92" />
      {ridges.map((d, k) => (
        <path key={k} d={d} fill={`hsl(${hue} ${35 + k * 8}% ${46 - k * 12}%)`} />
      ))}
      <rect x="0" y="0" width="200" height="6" fill={accent} />
    </svg>
  )
}

export default function SwipeThrow({ threshold = 120, stiffness = 180, count = 6, accent = '#ff4d1a', style }) {
  const n = clamp(Math.round(count) || 6, 2, 12)
  const root = useRef(null)
  const els = useRef([])
  const bodies = useRef([])
  const idxRef = useRef(0)
  const drag = useRef(null)
  const size = useRef({ w: 240, h: 300 })
  const props = useRef({})
  const [idx, setIdx] = useState(0)
  const [dims, setDims] = useState({ w: 240, h: 300 })
  const [history, setHistory] = useState(0)
  props.current = { threshold, stiffness }

  const reduced = () => typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const setIndex = (v) => {
    idxRef.current = v
    setIdx(v)
  }

  // measure the stage so cards fit
  useEffect(() => {
    const el = root.current
    const measure = () => {
      const r = el.getBoundingClientRect()
      const w = clamp(Math.min(r.width * 0.62, (r.height - 110) / 1.25), 120, 280)
      size.current = { w, h: w * 1.25 }
      setDims({ w, h: w * 1.25 })
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return undefined
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // (re)build bodies when the count changes
  useEffect(() => {
    bodies.current = Array.from({ length: n }, (_, i) => ({ x: 0, y: 0, vx: 0, vy: 0, a: 0, va: 0, o: 1, d: i, mode: 'rest', fade: false }))
    setIndex(0)
    setHistory(0)
  }, [n])

  // animation loop
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const step = (now) => {
      const dt = Math.min((now - last) / 1000, 1 / 30)
      last = now
      const k = props.current.stiffness
      const c = 2 * Math.sqrt(k) * 0.5
      const rm = reduced()
      const cur = idxRef.current
      bodies.current.forEach((b, i) => {
        const el = els.current[i]
        if (!el) return
        const target = Math.max(0, i - cur)
        if (b.mode === 'drag') {
          // position is set by the pointer
        } else if (b.mode === 'fly') {
          b.x += b.vx * dt
          b.y += b.vy * dt
          b.a += b.va * dt
          b.o -= dt * 1.5
          if (b.o <= 0) { b.o = 0; b.mode = 'gone' }
        } else if (b.mode === 'fade') {
          b.o -= dt * 6
          if (b.o <= 0) { b.o = 0; b.mode = 'gone' }
        } else if (b.mode === 'gone') {
          // hidden
        } else {
          if (b.fadeIn) { b.o = Math.min(1, b.o + dt * 6); if (b.o >= 1) b.fadeIn = false }
          // damped spring toward rest (substepped for stability)
          const sub = 4
          const h = dt / sub
          for (let s = 0; s < sub; s++) {
            b.vx += (-k * b.x - c * b.vx) * h
            b.vy += (-k * b.y - c * b.vy) * h
            b.va += (-k * b.a - c * b.va) * h
            b.x += b.vx * h
            b.y += b.vy * h
            b.a += b.va * h
          }
        }
        // depth easing (next card scales up into place)
        if (rm) b.d = target
        else b.d += (target - b.d) * (1 - Math.exp(-10 * dt))
        const d = b.d
        const vis = b.o * clamp(3.5 - d, 0, 1)
        el.style.transform = `translate(${b.x}px, ${b.y + d * 16}px) rotate(${b.a}deg) scale(${1 - d * 0.06})`
        el.style.opacity = vis
        el.style.visibility = vis <= 0.001 ? 'hidden' : 'visible'
      })
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [])

  const throwTop = (vx, vy) => {
    const i = idxRef.current
    const b = bodies.current[i]
    if (!b || i >= n) return
    drag.current = null
    if (reduced()) {
      b.mode = 'fade'
    } else {
      b.mode = 'fly'
      b.vx = vx
      b.vy = Math.min(vy, -900)
      b.va = vx * 0.08 + (Math.random() - 0.5) * 120
    }
    setIndex(i + 1)
    setHistory((h) => h + 1)
  }

  const undo = () => {
    const i = idxRef.current - 1
    const b = bodies.current[i]
    if (!b) return
    b.vx = b.vy = b.va = 0
    b.mode = 'rest'
    if (reduced()) {
      b.x = b.y = b.a = 0
      b.o = 0
      b.fadeIn = true
    } else {
      b.x = 0
      b.y = -size.current.h * 1.5
      b.a = -22
      b.o = 1
    }
    setIndex(i)
  }

  const reset = () => {
    bodies.current.forEach((b, i) => {
      Object.assign(b, { vx: 0, vy: 0, va: 0, mode: 'rest', fadeIn: false })
      if (reduced()) { b.x = b.y = b.a = 0; b.o = 0; b.fadeIn = true }
      else { b.x = 0; b.y = -size.current.h * 1.4 - i * 40; b.a = (i % 2 ? 1 : -1) * 18; b.o = 1 }
    })
    setIndex(0)
  }

  const onDown = (e, i) => {
    if (i !== idxRef.current || e.button > 0) return
    const b = bodies.current[i]
    e.currentTarget.setPointerCapture?.(e.pointerId)
    b.mode = 'drag'
    drag.current = { i, sx: e.clientX, sy: e.clientY, bx: b.x, by: b.y, samples: [{ t: performance.now(), x: e.clientX, y: e.clientY }] }
  }
  const onMove = (e) => {
    const d = drag.current
    if (!d) return
    const b = bodies.current[d.i]
    b.x = d.bx + (e.clientX - d.sx)
    b.y = d.by + (e.clientY - d.sy)
    b.a = (b.x / size.current.w) * 12
    const t = performance.now()
    d.samples.push({ t, x: e.clientX, y: e.clientY })
    while (d.samples.length > 2 && t - d.samples[0].t > 100) d.samples.shift()
  }
  const onUp = (e) => {
    const d = drag.current
    if (!d) return
    drag.current = null
    const b = bodies.current[d.i]
    const s = d.samples
    const t = performance.now()
    const a = s[0]
    const z = s[s.length - 1]
    // a pause before release means no flick
    const span = Math.max(16, z.t - a.t)
    let vx = ((z.x - a.x) / span) * 1000
    let vy = ((z.y - a.y) / span) * 1000
    if (t - z.t > 90) { vx = 0; vy = 0 }
    const dist = d.by - b.y
    if (dist > props.current.threshold || (vy < -700 && dist > 12)) {
      throwTop(vx, vy)
    } else {
      b.mode = 'rest'
      b.vx = clamp(vx, -1500, 1500) * 0.3
      b.vy = clamp(vy, -1500, 1500) * 0.3
      b.va = 0
    }
    void e
  }

  const onKey = (e) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      throwTop(0, -1400)
    } else if (e.key === 'ArrowDown' && idxRef.current > 0) {
      e.preventDefault()
      undo()
    }
  }

  const empty = idx >= n
  const btn = {
    font: '600 13px system-ui, sans-serif',
    padding: '8px 16px',
    borderRadius: 999,
    border: `1.5px solid ${accent}`,
    background: 'transparent',
    color: '#1b1b1f',
    cursor: 'pointer',
  }

  return (
    <div
      ref={root}
      tabIndex={0}
      onKeyDown={onKey}
      style={{
        position: 'relative', width: '100%', height: '100%', minHeight: 360, overflow: 'hidden',
        background: '#f3f0ea', fontFamily: 'system-ui, sans-serif', color: '#1b1b1f', outline: 'none', userSelect: 'none',
        ...style,
      }}
    >
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 70, display: 'grid', placeItems: 'center' }}>
        <div style={{ position: 'relative', width: dims.w, height: dims.h }}>
          {empty && (
            <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
              <div>
                <div style={{ fontSize: 15, marginBottom: 12, opacity: 0.7 }}>All cards thrown</div>
                <button type="button" onClick={reset} style={{ ...btn, background: accent, color: '#fff' }}>Reset</button>
              </div>
            </div>
          )}
          {Array.from({ length: n }, (_, i) => (
            <div
              key={i}
              ref={(el) => { els.current[i] = el }}
              onPointerDown={(e) => onDown(e, i)}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
              style={{
                position: 'absolute', inset: 0, borderRadius: 18, overflow: 'hidden', background: '#fff',
                boxShadow: '0 10px 30px rgba(20,20,30,.22)', touchAction: 'none', zIndex: n - i,
                cursor: i === idx ? 'grab' : 'default', willChange: 'transform',
                display: 'flex', flexDirection: 'column',
              }}
            >
              <div style={{ flex: 1, minHeight: 0 }}><CardArt i={i} accent={accent} /></div>
              <div style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <strong style={{ fontSize: 16 }}>{TITLES[i % TITLES.length]}</strong>
                <span style={{ fontSize: 12, color: accent, fontWeight: 700 }}>{String(i + 1).padStart(2, '0')}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 14, display: 'flex', gap: 10, justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="button" onClick={() => undo()} disabled={idx === 0} style={{ ...btn, opacity: idx === 0 ? 0.4 : 1 }}>Undo</button>
        <span style={{ font: '600 13px system-ui, sans-serif', minWidth: 64, textAlign: 'center' }} aria-live="polite">
          {Math.min(idx, n)} / {n}
        </span>
        <button type="button" onClick={() => throwTop(0, -1400)} disabled={empty} style={{ ...btn, background: accent, color: '#fff', opacity: empty ? 0.4 : 1 }}>Throw</button>
      </div>
      <div style={{ position: 'absolute', top: 10, left: 0, right: 0, textAlign: 'center', fontSize: 11, opacity: 0.55 }} data-thrown={history}>
        Swipe a card up - or press Arrow Up
      </div>
    </div>
  )
}
