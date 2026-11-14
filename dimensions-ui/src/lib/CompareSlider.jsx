import { useEffect, useRef, useState } from 'react'

// Compare slider: one illustrated sneaker drawn twice with two different presets
// (colourway, finish, shape), layered, with a draggable divider that reveals one
// over the other through a clip-path. Drag the handle (mouse or touch), click
// either side to glide the divider there, or focus the handle and use Left/Right
// (Up/Down when vertical), Home/End, and Shift for bigger steps. The side
// labels fade out as the divider covers them. Under reduced motion the jump is
// instant instead of animated.

const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

const PRESETS = {
  Classic: { bg: '#efe9df', body: '#f4f1ea', panel: '#1f2a44', sole: '#d9d2c4', lace: '#1f2a44', gloss: 0.15, high: false },
  Volt: { bg: '#1b1f2a', body: '#d7ff3a', panel: '#101319', sole: '#f4f4f4', lace: '#101319', gloss: 0.45, high: false },
  Sunset: { bg: '#f7d7c2', body: '#ff7a45', panel: '#7a2e5e', sole: '#fff1e2', lace: '#fff1e2', gloss: 0.3, high: false },
  'High Top': { bg: '#dfe7ea', body: '#3c6e71', panel: '#e9f0ef', sole: '#16292b', lace: '#e9f0ef', gloss: 0.1, high: true },
  Noir: { bg: '#cfcfd4', body: '#17171b', panel: '#8a8a95', sole: '#f1f1f1', lace: '#8a8a95', gloss: 0.6, high: true },
}
const NAMES = Object.keys(PRESETS)

function Shoe({ p, uid }) {
  const top = p.high ? 60 : 118
  const body = `M70 205 L70 ${top + 10} Q70 ${top} 84 ${top} L142 ${top} Q150 ${top} 154 ${top + 12} Q166 150 206 160 Q268 172 318 196 Q336 206 334 222 L334 232 L70 232 Z`
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid meet" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
      <defs>
        <linearGradient id={`g${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity={p.gloss} />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.15" />
        </linearGradient>
      </defs>
      <ellipse cx="204" cy="252" rx="150" ry="10" fill="#000" opacity="0.12" />
      <path d={body} fill={p.body} />
      <path d={body} fill={`url(#g${uid})`} />
      <path d={`M70 190 Q150 170 210 186 Q280 204 334 210 L334 232 L70 232 Z`} fill={p.panel} opacity="0.9" />
      <path d="M160 160 Q220 172 262 200" stroke={p.panel} strokeWidth="9" strokeLinecap="round" fill="none" />
      <rect x="66" y="228" width="272" height="22" rx="11" fill={p.sole} />
      {[0, 1, 2, 3].map((i) => (
        <line key={i} x1={150 + i * 18} y1={p.high ? 96 + i * 8 : 150 + i * 6} x2={172 + i * 18} y2={p.high ? 108 + i * 8 : 160 + i * 6} stroke={p.lace} strokeWidth="4" strokeLinecap="round" />
      ))}
      {p.high && [0, 1, 2].map((i) => <line key={i} x1="84" y1={80 + i * 22} x2="116" y2={86 + i * 22} stroke={p.lace} strokeWidth="4" strokeLinecap="round" />)}
    </svg>
  )
}

export default function CompareSlider({
  presetA = 'Classic',
  presetB = 'Volt',
  orientation = 'horizontal',
  initial = 50,
  accent = '#ff4d1a',
  showLabels = true,
  style,
}) {
  const vertical = orientation === 'vertical'
  const [pos, setPos] = useState(Math.min(100, Math.max(0, initial)))
  const [dragging, setDragging] = useState(false)
  const [focus, setFocus] = useState(false)
  const root = useRef(null)
  const posRef = useRef(pos)
  const raf = useRef(0)
  const uid = useRef(Math.random().toString(36).slice(2, 7)).current

  useEffect(() => () => cancelAnimationFrame(raf.current), [])
  useEffect(() => { go(initial, true) }, [initial])

  const set = (v) => { posRef.current = v; setPos(v) }
  const go = (target, instant) => {
    cancelAnimationFrame(raf.current)
    target = Math.min(100, Math.max(0, target))
    if (instant || reduced()) { set(target); return }
    const from = posRef.current
    const t0 = performance.now()
    const step = (now) => {
      const k = Math.min(1, (now - t0) / 380)
      set(from + (target - from) * (1 - Math.pow(1 - k, 3)))
      if (k < 1) raf.current = requestAnimationFrame(step)
    }
    raf.current = requestAnimationFrame(step)
  }

  const fromEvent = (e) => {
    const r = root.current.getBoundingClientRect()
    return vertical ? ((e.clientY - r.top) / r.height) * 100 : ((e.clientX - r.left) / r.width) * 100
  }

  const onHandleDown = (e) => {
    e.stopPropagation()
    cancelAnimationFrame(raf.current)
    e.currentTarget.setPointerCapture?.(e.pointerId)
    setDragging(true)
    set(Math.min(100, Math.max(0, fromEvent(e))))
  }
  const onHandleMove = (e) => {
    if (!dragging) return
    set(Math.min(100, Math.max(0, fromEvent(e))))
  }
  const onHandleUp = (e) => {
    e.currentTarget.releasePointerCapture?.(e.pointerId)
    setDragging(false)
  }
  const onRootDown = (e) => { go(fromEvent(e)) }

  const onKey = (e) => {
    const big = e.shiftKey ? 10 : 2
    const k = e.key
    let t = null
    if (k === 'ArrowLeft' || (vertical && k === 'ArrowUp')) t = posRef.current - big
    else if (k === 'ArrowRight' || (vertical && k === 'ArrowDown')) t = posRef.current + big
    else if (!vertical && k === 'ArrowUp') t = posRef.current - big
    else if (!vertical && k === 'ArrowDown') t = posRef.current + big
    else if (k === 'Home') t = 0
    else if (k === 'End') t = 100
    if (t == null) return
    e.preventDefault()
    cancelAnimationFrame(raf.current)
    set(Math.min(100, Math.max(0, t)))
  }

  const A = PRESETS[presetA] || PRESETS.Classic
  const B = PRESETS[presetB] || PRESETS.Volt
  const clip = vertical ? `inset(${pos}% 0 0 0)` : `inset(0 0 0 ${pos}%)`
  const label = (side, text, dark) => ({
    position: 'absolute',
    [vertical ? (side === 'a' ? 'top' : 'bottom') : (side === 'a' ? 'left' : 'right')]: 14,
    [vertical ? 'left' : 'top']: 14,
    padding: '4px 10px', borderRadius: 999, font: '600 12px system-ui, sans-serif', letterSpacing: 0.4,
    color: dark ? '#fff' : '#111', background: dark ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.75)',
    opacity: showLabels ? (side === 'a' ? (pos > 12 ? 1 : 0) : (pos < 88 ? 1 : 0)) : 0,
    transition: 'opacity 0.2s', pointerEvents: 'none',
  })
  const handleStyle = vertical
    ? { left: 0, right: 0, top: `${pos}%`, height: 0 }
    : { top: 0, bottom: 0, left: `${pos}%`, width: 0 }

  return (
    <div
      ref={root}
      onPointerDown={onRootDown}
      style={{ position: 'relative', width: '100%', height: '100%', minHeight: 220, overflow: 'hidden', userSelect: 'none', touchAction: 'none', cursor: vertical ? 'row-resize' : 'col-resize', background: A.bg, ...style }}
    >
      <div style={{ position: 'absolute', inset: 0, background: A.bg }}><Shoe p={A} uid={`a${uid}`} /></div>
      <div style={{ position: 'absolute', inset: 0, background: B.bg, clipPath: clip, WebkitClipPath: clip }}><Shoe p={B} uid={`b${uid}`} /></div>
      <div style={label('a', presetA, !isLight(A.bg))}>{presetA}</div>
      <div style={label('b', presetB, !isLight(B.bg))}>{presetB}</div>
      <div style={{ position: 'absolute', ...handleStyle, pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', background: accent, ...(vertical ? { left: 0, right: 0, top: -1, height: 3 } : { top: 0, bottom: 0, left: -1, width: 3 }) }} />
        <div
          role="slider"
          tabIndex={0}
          aria-label="Compare presets"
          aria-orientation={vertical ? 'vertical' : 'horizontal'}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pos)}
          aria-valuetext={`${Math.round(pos)}% of ${presetA} shown`}
          onPointerDown={onHandleDown}
          onPointerMove={onHandleMove}
          onPointerUp={onHandleUp}
          onPointerCancel={onHandleUp}
          onKeyDown={onKey}
          onFocus={(e) => setFocus(e.currentTarget.matches(':focus-visible'))}
          onBlur={() => setFocus(false)}
          style={{
            position: 'absolute', left: -20, top: vertical ? -20 : '50%', marginTop: vertical ? 0 : -20, width: 40, height: 40, borderRadius: '50%',
            background: accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'auto',
            cursor: 'grab', boxShadow: '0 2px 10px rgba(0,0,0,0.35)', outline: focus ? '3px solid #fff' : 'none', outlineOffset: 2,
            ...(focus ? { boxShadow: `0 0 0 6px ${accent}66, 0 2px 10px rgba(0,0,0,0.35)` } : null),
            ...(vertical ? { left: '50%', marginLeft: -20 } : null),
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ transform: vertical ? 'rotate(90deg)' : 'none' }}>
            <path d="M9 6l-6 6 6 6M15 6l6 6-6 6" />
          </svg>
        </div>
      </div>
    </div>
  )
}

function isLight(hex) {
  const n = parseInt(hex.slice(1), 16)
  return ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000 > 140
}
