import { useEffect, useRef, useState } from 'react'

// Trackpad scrub: a ruler timeline with a playhead drives a little sky scene
// (a sun crossing the sky, colours shifting with the hour). Two-finger scroll
// on a trackpad (or a mouse wheel) over the timeline moves the playhead and
// it keeps gliding with decaying inertia. You can also drag the playhead,
// click the ruler to jump, and use arrow keys (Shift for big steps).
// The wheel listener is non-passive and only active on this component, so the
// page and browser back-swipe are left alone elsewhere. Under reduced motion
// there is no inertia.

const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
const mix = (a, b, t) => {
  const A = hex(a)
  const B = hex(b)
  return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`
}
// piecewise colour ramp over stops [[p, '#hex'], ...]
const ramp = (stops, p) => {
  for (let i = 1; i < stops.length; i++) {
    if (p <= stops[i][0]) {
      const [p0, c0] = stops[i - 1]
      const [p1, c1] = stops[i]
      return mix(c0, c1, (p - p0) / (p1 - p0 || 1))
    }
  }
  return mix(stops[stops.length - 1][1], stops[stops.length - 1][1], 0)
}
const SKY_TOP = [[0, '#10163a'], [0.1, '#3b4a8c'], [0.22, '#5aa6e6'], [0.5, '#2f86e0'], [0.78, '#5a90d8'], [0.9, '#7a4a8c'], [1, '#10163a']]
const SKY_LOW = [[0, '#2a2a5a'], [0.1, '#f2955f'], [0.25, '#bfe3f7'], [0.5, '#9fd4f5'], [0.75, '#bfe0f0'], [0.9, '#f07a5a'], [1, '#2a2a5a']]
const MARKERS = [[0, 'Sunrise'], [0.25, 'Morning'], [0.5, 'Noon'], [0.75, 'Evening'], [1, 'Sunset']]

const fmt = (s) => {
  const m = Math.floor(s / 60)
  const r = s - m * 60
  return `${String(m).padStart(2, '0')}:${r.toFixed(1).padStart(4, '0')}`
}

export default function TrackpadScrub({ friction = 4, sensitivity = 1, accent = '#ff4d1a', axis = 'x', duration = 60, style }) {
  const root = useRef(null)
  const track = useRef(null)
  const s = useRef({ t: 0, vel: 0, lastWheel: 0, hover: false, drag: false })
  const cfg = useRef({})
  const [t, setT] = useState(0)
  const [ax, setAx] = useState(axis)
  const dur = Math.max(1, duration)
  cfg.current = { friction, sensitivity, axis: ax, dur }

  useEffect(() => setAx(axis), [axis])
  // keep the playhead inside a shortened duration
  useEffect(() => {
    if (s.current.t > dur) { s.current.t = dur; setT(dur) }
  }, [dur])

  const reduced = () => typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const move = (v) => {
    const p = s.current
    p.t = clamp(v, 0, cfg.current.dur)
    setT(p.t)
  }

  useEffect(() => {
    const el = root.current
    const p = s.current
    const onEnter = () => { p.hover = true }
    const onLeave = () => { p.hover = false }
    const onWheel = (e) => {
      if (!p.hover) return
      const c = cfg.current
      const k = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1
      const dx = e.deltaX * k
      const dy = e.deltaY * k
      const d = c.axis === 'x' ? dx : c.axis === 'y' ? dy : Math.abs(dx) >= Math.abs(dy) ? dx : dy
      if (d === 0) return
      e.preventDefault()
      const now = performance.now()
      const dT = (d * c.sensitivity * c.dur) / 1200
      const before = p.t
      p.t = clamp(p.t + dT, 0, c.dur)
      setT(p.t)
      const dtSec = Math.max(0.008, Math.min(0.1, (now - p.lastWheel) / 1000))
      const inst = (p.t - before) / dtSec
      p.vel = reduced() ? 0 : p.vel * 0.5 + inst * 0.5
      p.lastWheel = now
    }
    el.addEventListener('mouseenter', onEnter)
    el.addEventListener('mouseleave', onLeave)
    el.addEventListener('wheel', onWheel, { passive: false })

    let raf = 0
    let last = performance.now()
    const step = (now) => {
      const dt = Math.min((now - last) / 1000, 1 / 30)
      last = now
      if (!p.drag && Math.abs(p.vel) > 0.01 && now - p.lastWheel > 60) {
        if (reduced()) p.vel = 0
        else {
          const c = cfg.current
          p.t += p.vel * dt
          p.vel *= Math.exp(-c.friction * dt)
          if (p.t <= 0 || p.t >= c.dur) { p.t = clamp(p.t, 0, c.dur); p.vel = 0 }
          setT(p.t)
        }
      } else if (Math.abs(p.vel) <= 0.01) p.vel = 0
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => {
      cancelAnimationFrame(raf)
      el.removeEventListener('mouseenter', onEnter)
      el.removeEventListener('mouseleave', onLeave)
      el.removeEventListener('wheel', onWheel)
    }
  }, [])

  const fromPointer = (e) => {
    const r = track.current.getBoundingClientRect()
    move(clamp((e.clientX - r.left) / r.width, 0, 1) * cfg.current.dur)
  }
  const onDown = (e) => {
    if (e.button > 0) return
    root.current.focus({ preventScroll: true })
    e.currentTarget.setPointerCapture?.(e.pointerId)
    s.current.drag = true
    s.current.vel = 0
    fromPointer(e)
  }
  const onMove = (e) => { if (s.current.drag) fromPointer(e) }
  const onUp = () => { s.current.drag = false }

  const onKey = (e) => {
    const big = e.shiftKey ? dur / 10 : dur / 60
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); s.current.vel = 0; move(s.current.t + big) }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); s.current.vel = 0; move(s.current.t - big) }
    else if (e.key === 'Home') { e.preventDefault(); move(0) }
    else if (e.key === 'End') { e.preventDefault(); move(dur) }
  }

  // ruler ticks
  const steps = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 1800, 3600]
  const major = steps.find((v) => dur / v <= 12) || 3600
  const nMajor = Math.floor(dur / major)
  const ticks = []
  for (let i = 0; i <= nMajor * 5; i++) {
    const tt = (i * major) / 5
    if (tt > dur + 1e-6) break
    ticks.push({ p: tt / dur, big: i % 5 === 0, label: i % 5 === 0 ? (major >= 60 && major % 60 === 0 ? `${tt / 60}m` : `${Math.round(tt)}s`) : '' })
  }

  const p = clamp(t / dur, 0, 1)
  const ang = Math.PI * p
  const sunX = 400 - Math.cos(ang) * 320
  const sunY = 230 - Math.sin(ang) * 170
  const high = Math.sin(ang)
  const night = clamp(1 - high * 4, 0, 1)
  const sunCol = mix('#ff6a2b', '#fff3b0', clamp(high * 1.6, 0, 1))
  const top = ramp(SKY_TOP, p)
  const low = ramp(SKY_LOW, p)
  const stars = [[60, 40], [140, 90], [230, 30], [330, 70], [470, 40], [560, 85], [650, 35], [730, 80], [90, 130], [700, 140]]

  const seg = (v) => ({
    font: '600 11px system-ui, sans-serif', padding: '3px 9px', border: 'none', cursor: 'pointer',
    background: ax === v ? accent : 'transparent', color: ax === v ? '#fff' : '#444',
  })

  return (
    <div
      ref={root}
      tabIndex={0}
      onKeyDown={onKey}
      style={{
        position: 'relative', width: '100%', height: '100%', minHeight: 320, boxSizing: 'border-box', overflow: 'hidden',
        background: '#f3f0ea', fontFamily: 'system-ui, sans-serif', color: '#1b1b1f', outline: 'none',
        display: 'flex', flexDirection: 'column', gap: 10, padding: 14,
        overscrollBehaviorX: 'contain', overscrollBehavior: 'contain', userSelect: 'none',
        ...style,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ font: '700 22px ui-monospace, Menlo, monospace', letterSpacing: 0.5 }} aria-live="off">
          {fmt(t)} <span style={{ fontSize: 12, opacity: 0.5, fontWeight: 500 }}>/ {fmt(dur)}</span>
        </div>
        <div style={{ display: 'flex', borderRadius: 999, border: `1.5px solid ${accent}`, overflow: 'hidden' }} role="group" aria-label="Scroll axis">
          {['x', 'y', 'both'].map((v) => (
            <button key={v} type="button" onClick={() => setAx(v)} style={seg(v)}>{v}</button>
          ))}
        </div>
      </div>

      <div
        ref={track}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        style={{ position: 'relative', height: 86, flex: 'none', touchAction: 'none', cursor: 'ew-resize', background: '#fff', borderRadius: 10, boxShadow: '0 1px 0 rgba(0,0,0,.08) inset', margin: '0 10px' }}
      >
        {ticks.map((k, i) => (
          <div key={i} style={{ position: 'absolute', left: `${k.p * 100}%`, bottom: 0, width: 1, height: k.big ? 26 : 13, background: '#8a8780' }}>
            {k.label && <span style={{ position: 'absolute', bottom: 28, left: 3, fontSize: 10, color: '#77746c', whiteSpace: 'nowrap' }}>{k.label}</span>}
          </div>
        ))}
        {MARKERS.map(([mp, name]) => (
          <div key={name} style={{ position: 'absolute', left: `${mp * 100}%`, top: 6, transform: `translateX(${mp === 0 ? '4px' : mp === 1 ? 'calc(-100% - 4px)' : '-50%'})`, fontSize: 11, fontWeight: 600, color: '#1b1b1f', whiteSpace: 'nowrap' }}>
            <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: 3, background: accent, marginRight: 4 }} />
            {name}
          </div>
        ))}
        <div style={{ position: 'absolute', left: `${p * 100}%`, top: 0, bottom: 0, width: 0, pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', left: -1, top: 0, bottom: 0, width: 2, background: accent }} />
          <div style={{ position: 'absolute', left: -7, top: -4, width: 14, height: 14, borderRadius: 7, background: accent, boxShadow: '0 1px 4px rgba(0,0,0,.3)' }} />
        </div>
      </div>

      <div style={{ position: 'relative', flex: 1, minHeight: 120, borderRadius: 12, overflow: 'hidden' }}>
        <svg viewBox="0 0 800 300" preserveAspectRatio="xMidYMid slice" style={{ width: '100%', height: '100%', display: 'block' }} role="img" aria-label={`Sky scene at ${fmt(t)}`}>
          <defs>
            <linearGradient id="tsSky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={top} />
              <stop offset="1" stopColor={low} />
            </linearGradient>
            <radialGradient id="tsGlow">
              <stop offset="0" stopColor={sunCol} stopOpacity="0.8" />
              <stop offset="1" stopColor={sunCol} stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect width="800" height="300" fill="url(#tsSky)" />
          {stars.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="1.6" fill="#fff" opacity={night * 0.9} />)}
          <circle cx={sunX} cy={sunY} r="70" fill="url(#tsGlow)" />
          <circle cx={sunX} cy={sunY} r="26" fill={sunCol} />
          <path d="M0 250 Q120 205 240 240 T480 235 T800 225 L800 300 L0 300 Z" fill={mix('#1d3a2e', '#0b1220', night)} />
          <path d="M0 275 Q200 245 400 270 T800 262 L800 300 L0 300 Z" fill={mix('#142c22', '#070b16', night)} />
        </svg>
      </div>

      <div style={{ fontSize: 11, textAlign: 'center', opacity: 0.6 }}>Scroll with two fingers over the timeline</div>
    </div>
  )
}
