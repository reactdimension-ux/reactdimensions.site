import { useState, useRef, useEffect, useId } from 'react'

// Hold Space to freeze everything: a CSS-animated tile, a canvas particle
// field, an rAF-driven orbiting shape and a looping SVG animation all stop
// together while the key is down (ribbon + dimming vignette), and carry on from
// exactly where they were on release. Nothing unmounts: the rAF loops read one
// shared pause ref and advance their own simulation clock only while it is
// false, and the CSS/SVG animations use animation-play-state. A hold-to-pause
// button covers touch. With prefers-reduced-motion the scene starts calm.

const isTyping = (t) => t && (/^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(t.tagName) || t.isContentEditable)

export default function SpacePause({ particles = 120, speed = 1, accent = '#ff4d1a', requireFocus = true, style }) {
  const uid = useId().replace(/:/g, '')
  const [paused, setPaused] = useState(false)
  const [focused, setFocused] = useState(false)
  const [reduce, setReduce] = useState(false)
  const pausedRef = useRef(false)
  const holders = useRef(new Set())
  const rateRef = useRef(1)
  const canvasRef = useRef(null)
  const orbitRef = useRef(null)
  const rootRef = useRef(null)

  useEffect(() => {
    const m = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!m) return
    setReduce(m.matches)
    const f = () => setReduce(m.matches)
    m.addEventListener?.('change', f)
    return () => m.removeEventListener?.('change', f)
  }, [])

  const rate = (reduce ? 0.1 : 1) * speed
  rateRef.current = rate

  const hold = (src, on) => {
    on ? holders.current.add(src) : holders.current.delete(src)
    const p = holders.current.size > 0
    pausedRef.current = p
    setPaused(p)
  }

  // keyboard: on the root when requireFocus, otherwise anywhere on the page
  useEffect(() => {
    const el = requireFocus ? rootRef.current : window
    if (!el) return
    const down = (e) => {
      if (e.code !== 'Space' && e.key !== ' ') return
      if (!requireFocus && isTyping(e.target)) return
      e.preventDefault()
      if (!e.repeat) hold('key', true)
    }
    const up = (e) => {
      if (e.code !== 'Space' && e.key !== ' ') return
      if (!requireFocus && isTyping(e.target)) return
      e.preventDefault()
      hold('key', false)
    }
    const release = () => hold('key', false)
    el.addEventListener('keydown', down)
    el.addEventListener('keyup', up)
    el.addEventListener('blur', release)
    window.addEventListener('blur', release)
    return () => {
      el.removeEventListener('keydown', down)
      el.removeEventListener('keyup', up)
      el.removeEventListener('blur', release)
      window.removeEventListener('blur', release)
      hold('key', false)
    }
  }, [requireFocus])

  // rAF loop: particles on a canvas + an orbiting shape, on a pausable sim clock
  useEffect(() => {
    const cv = canvasRef.current
    const ctx = cv.getContext('2d')
    let w = 0
    let h = 0
    const size = () => {
      const r = cv.getBoundingClientRect()
      w = cv.width = Math.max(1, Math.round(r.width))
      h = cv.height = Math.max(1, Math.round(r.height))
    }
    size()
    const ro = new ResizeObserver(size)
    ro.observe(cv)
    const ps = Array.from({ length: Math.max(0, Math.round(particles)) }, () => ({
      x: Math.random(), y: Math.random(), vx: (Math.random() - 0.5) * 0.06, vy: -0.02 - Math.random() * 0.06, r: 1 + Math.random() * 2.5,
    }))
    let sim = 0
    let last = performance.now()
    let raf = 0
    const tick = (now) => {
      const dt = Math.min(64, now - last) / 1000
      last = now
      if (!pausedRef.current) sim += dt * rateRef.current // frozen clock while held
      const step = pausedRef.current ? 0 : dt * rateRef.current
      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = accent
      for (const p of ps) {
        p.x = (p.x + p.vx * step + 1) % 1
        p.y = (p.y + p.vy * step + 1) % 1
        ctx.globalAlpha = 0.25 + 0.5 * p.r / 3.5
        ctx.beginPath()
        ctx.arc(p.x * w, p.y * h, p.r, 0, 6.2832)
        ctx.fill()
      }
      ctx.globalAlpha = 1
      const o = orbitRef.current
      if (o) {
        const a = sim * 1.4
        o.style.transform = `translate(${Math.cos(a) * 70}px, ${Math.sin(a) * 36}px) rotate(${(a * 57.3).toFixed(1)}deg)`
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [particles, accent])

  const ps = paused ? 'paused' : 'running'
  const dur = (s) => `${(s / Math.max(0.05, rate)).toFixed(2)}s`

  return (
    <div
      ref={rootRef}
      tabIndex={0}
      role="group"
      aria-label="Busy scene. Hold Space to pause all motion."
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      className={`sp-${uid}`}
      style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: '#14120f', color: '#f4f1ea', font: '400 14px/1.4 system-ui, sans-serif', outline: 'none', boxShadow: focused ? `inset 0 0 0 2px ${accent}` : 'none', userSelect: 'none', WebkitUserSelect: 'none', ...style }}
    >
      <style>{`
        @keyframes sp-spin-${uid} { to { transform: rotate(360deg) } }
        @keyframes sp-bob-${uid} { 0%,100% { transform: translateY(0) scale(1) } 50% { transform: translateY(-18px) scale(1.12) } }
        @keyframes sp-dash-${uid} { to { stroke-dashoffset: -200 } }
        @keyframes sp-pulse-${uid} { 0%,100% { r: 6 } 50% { r: 14 } }
      `}</style>

      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />

      {/* CSS-animated tiles */}
      <div style={{ position: 'absolute', left: '12%', top: '30%', width: 70, height: 70, borderRadius: 14, background: accent, animation: `sp-spin-${uid} ${dur(4)} linear infinite`, animationPlayState: ps }} />
      <div style={{ position: 'absolute', left: '12%', top: '62%', width: 26, height: 26, borderRadius: 999, background: '#f4f1ea', marginLeft: 22, animation: `sp-bob-${uid} ${dur(1.6)} ease-in-out infinite`, animationPlayState: ps }} />

      {/* rAF orbit */}
      <div style={{ position: 'absolute', left: '50%', top: '50%', width: 0, height: 0 }}>
        <div style={{ position: 'absolute', left: -2, top: -2, width: 4, height: 4, borderRadius: 4, background: 'rgba(255,255,255,.4)' }} />
        <div ref={orbitRef} style={{ position: 'absolute', left: -16, top: -16, width: 32, height: 32, borderRadius: 8, border: `3px solid ${accent}`, background: 'rgba(255,255,255,.12)' }} />
      </div>

      {/* looping SVG */}
      <svg viewBox="0 0 120 120" width="120" height="120" style={{ position: 'absolute', right: '10%', top: '32%' }} aria-hidden="true">
        <circle cx="60" cy="60" r="46" fill="none" stroke="rgba(255,255,255,.15)" strokeWidth="6" />
        <circle cx="60" cy="60" r="46" fill="none" stroke={accent} strokeWidth="6" strokeLinecap="round" strokeDasharray="60 230" style={{ animation: `sp-dash-${uid} ${dur(2.4)} linear infinite`, animationPlayState: ps }} />
        <circle cx="60" cy="60" r="10" fill="#f4f1ea" style={{ animation: `sp-pulse-${uid} ${dur(1.8)} ease-in-out infinite`, animationPlayState: ps }} />
      </svg>

      <div style={{ position: 'absolute', left: 0, right: 0, top: 12, textAlign: 'center', fontSize: 12, opacity: 0.7, pointerEvents: 'none' }}>
        {requireFocus ? (focused ? 'Hold Space to pause everything' : 'Click here, then hold Space') : 'Hold Space anywhere on the page'}
      </div>

      {/* dimming vignette + ribbon */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(ellipse at center, rgba(0,0,0,0) 35%, rgba(0,0,0,.65) 100%)', opacity: paused ? 1 : 0, transition: 'opacity 220ms' }} />
      <div role="status" style={{ position: 'absolute', left: 0, right: 0, top: '50%', marginTop: -92, textAlign: 'center', pointerEvents: 'none', opacity: paused ? 1 : 0, transform: paused ? 'none' : 'translateY(-8px)', transition: 'opacity 200ms, transform 200ms' }}>
        <span style={{ display: 'inline-block', padding: '6px 22px', background: accent, color: '#fff', font: '800 13px/1 system-ui, sans-serif', letterSpacing: '.2em', textTransform: 'uppercase', clipPath: 'polygon(0 0, 100% 0, calc(100% - 10px) 50%, 100% 100%, 0 100%, 10px 50%)' }}>{paused ? 'Paused' : ''}</span>
      </div>

      <button
        type="button"
        aria-label="Hold to pause"
        tabIndex={-1}
        onPointerDown={(e) => { e.currentTarget.setPointerCapture?.(e.pointerId); hold('ptr', true) }}
        onPointerUp={() => hold('ptr', false)}
        onPointerCancel={() => hold('ptr', false)}
        onLostPointerCapture={() => hold('ptr', false)}
        onContextMenu={(e) => e.preventDefault()}
        style={{ all: 'unset', position: 'absolute', right: 14, bottom: 14, padding: '10px 16px', borderRadius: 999, background: paused ? accent : 'rgba(255,255,255,.12)', color: '#fff', font: '600 13px/1 system-ui, sans-serif', cursor: 'pointer', touchAction: 'none', boxShadow: '0 0 0 1px rgba(255,255,255,.2)' }}
      >
        Hold to pause
      </button>
    </div>
  )
}
