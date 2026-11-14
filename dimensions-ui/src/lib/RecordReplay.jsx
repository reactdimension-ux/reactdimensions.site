import { useEffect, useMemo, useRef, useState } from 'react'

// Record and replay: a tiny playground (a draggable ball, two toggle buttons, a
// row of colour swatches). Press Record to capture timestamped interactions for
// up to maxSeconds (red dot and timer while recording), Stop, then Play to watch
// the clip back on the same stage with a ghost cursor following the recorded
// pointer path. Speed 0.5x/1x/2x, loop, and a scrubbable timeline: state at any
// time t is rebuilt by folding the recorded events up to t, so seeking is exact.
// Copy clip / Paste clip move the clip as JSON; Delete clip clears it. Under
// reduced motion the ghost cursor hops between samples instead of gliding.

const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

const SWATCHES = ['#ff4d1a', '#ffb703', '#2ec4b6', '#4361ee', '#b5179e']
const INIT = { bx: 0.5, by: 0.5, drag: false, glow: false, square: false, color: SWATCHES[0] }
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))

// Pure reducer: applying the same events in order always gives the same state.
function apply(s, e) {
  switch (e.k) {
    case 'bd': return { ...s, bx: e.x, by: e.y, drag: true }
    case 'bm': return { ...s, bx: e.x, by: e.y }
    case 'bu': return { ...s, drag: false }
    case 'tg': return { ...s, [e.n]: !s[e.n] }
    case 'co': return { ...s, color: e.c }
    default: return s
  }
}
function stateAt(init, events, t) {
  let s = init
  for (let i = 0; i < events.length && events[i].t <= t; i++) s = apply(s, events[i])
  return s
}
function ghostAt(events, t) {
  let a = null, b = null
  for (let i = 0; i < events.length; i++) {
    if (events[i].k !== 'mv') continue
    if (events[i].t <= t) a = events[i]
    else { b = events[i]; break }
  }
  if (!a) return null
  if (!b || reduced()) return a
  const k = (t - a.t) / Math.max(1, b.t - a.t)
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k }
}
const fmt = (ms) => (ms / 1000).toFixed(1) + 's'

export default function RecordReplay({
  maxSeconds = 10,
  defaultSpeed = '1x',
  accent = '#ff4d1a',
  showGhost = true,
  style,
}) {
  const [live, setLive] = useState(INIT)
  const [mode, setMode] = useState('idle') // idle | rec | replay
  const [clip, setClip] = useState(null) // { duration, init, events }
  const [elapsed, setElapsed] = useState(0)
  const [t, setT] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(parseFloat(defaultSpeed) || 1)
  const [loop, setLoop] = useState(false)
  const [paste, setPaste] = useState(null) // null or textarea text
  const [msg, setMsg] = useState('')

  const rootRef = useRef(null)
  const stageRef = useRef(null)
  const barRef = useRef(null)
  const liveRef = useRef(INIT)
  const rec = useRef({ start: 0, init: INIT, events: [], lastMv: 0 })
  const raf = useRef(0)
  const msgTimer = useRef(0)
  const seeking = useRef(false)
  const dragging = useRef(false)
  const st = useRef({})
  st.current = { clip, speed, loop, maxSeconds, mode, playing, t }

  useEffect(() => { setSpeed(parseFloat(defaultSpeed) || 1) }, [defaultSpeed])
  useEffect(() => () => { cancelAnimationFrame(raf.current); clearTimeout(msgTimer.current) }, [])

  const flash = (m) => { setMsg(m); clearTimeout(msgTimer.current); msgTimer.current = setTimeout(() => setMsg(''), 2200) }

  // One rAF loop drives both the recording timer and playback.
  useEffect(() => {
    if (mode !== 'rec' && !(mode === 'replay' && playing)) return
    let last = performance.now()
    const tick = (now) => {
      const { clip: c, speed: sp, loop: lp, maxSeconds: mx } = st.current
      if (mode === 'rec') {
        const el = now - rec.current.start
        if (el >= mx * 1000) { stopRec(mx * 1000); return }
        setElapsed(el)
      } else if (c) {
        const dt = (now - last) * sp
        setT((prev) => {
          const n = prev + dt
          if (n >= c.duration) {
            if (lp) return n % Math.max(1, c.duration)
            setPlaying(false)
            return c.duration
          }
          return n
        })
      }
      last = now
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [mode, playing])

  const push = (ev) => {
    if (st.current.mode !== 'rec') return
    rec.current.events.push({ t: Math.round(performance.now() - rec.current.start), ...ev })
  }
  const dispatch = (ev) => {
    liveRef.current = apply(liveRef.current, ev)
    setLive(liveRef.current)
    push(ev)
  }

  const startRec = () => {
    if (st.current.mode === 'replay') { setPlaying(false) }
    setMode('rec'); setElapsed(0); setT(0)
    rec.current = { start: performance.now(), init: liveRef.current, events: [], lastMv: 0 }
    st.current.mode = 'rec'
  }
  const stopRec = (dur) => {
    cancelAnimationFrame(raf.current)
    const r = rec.current
    const duration = dur ?? Math.round(performance.now() - r.start)
    dragging.current = false
    st.current.mode = 'idle'
    setMode('idle')
    setElapsed(0)
    if (r.events.length) setClip({ duration, init: r.init, events: r.events })
    else flash('Nothing recorded')
  }

  const play = () => {
    if (!clip) return
    if (mode === 'replay' && playing) { setPlaying(false); return }
    if (mode !== 'replay' || t >= clip.duration) setT(0)
    setMode('replay'); setPlaying(true)
  }
  const exitReplay = () => { setPlaying(false); setMode('idle') }
  const del = () => { setClip(null); setPlaying(false); setMode('idle'); setT(0) }

  // Normalised pointer position relative to the root (for ghost) and the stage (for the ball).
  const norm = (el, e) => {
    const r = el.getBoundingClientRect()
    return { x: clamp((e.clientX - r.left) / r.width, 0, 1), y: clamp((e.clientY - r.top) / r.height, 0, 1) }
  }
  const onRootMove = (e) => {
    if (mode !== 'rec') return
    const now = performance.now()
    if (now - rec.current.lastMv < 30) return
    rec.current.lastMv = now
    push({ k: 'mv', ...norm(rootRef.current, e) })
  }
  const onBallDown = (e) => {
    if (mode === 'replay') return
    e.stopPropagation()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    dragging.current = true
    const p = norm(stageRef.current, e)
    dispatch({ k: 'bd', x: p.x, y: p.y })
  }
  const onBallMove = (e) => {
    if (!dragging.current) return
    const p = norm(stageRef.current, e)
    dispatch({ k: 'bm', x: p.x, y: p.y })
  }
  const onBallUp = (e) => {
    if (!dragging.current) return
    dragging.current = false
    e.currentTarget.releasePointerCapture?.(e.pointerId)
    dispatch({ k: 'bu' })
  }
  const locked = mode === 'replay'
  const onToggle = (n) => { if (!locked) dispatch({ k: 'tg', n }) }
  const onColor = (c) => { if (!locked) dispatch({ k: 'co', c }) }

  // Timeline scrubbing
  const seekFrom = (e) => {
    if (!clip || mode === 'rec') return
    const r = barRef.current.getBoundingClientRect()
    setMode('replay')
    setT(clamp((e.clientX - r.left) / r.width, 0, 1) * clip.duration)
  }
  const barDown = (e) => {
    if (!clip || mode === 'rec') return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    seeking.current = true
    seekFrom(e)
  }
  const barMove = (e) => { if (seeking.current) seekFrom(e) }
  const barUp = (e) => { seeking.current = false; e.currentTarget.releasePointerCapture?.(e.pointerId) }
  const barKey = (e) => {
    if (!clip || mode === 'rec') return
    const d = e.key === 'ArrowLeft' ? -250 : e.key === 'ArrowRight' ? 250 : 0
    if (!d && e.key !== 'Home' && e.key !== 'End') return
    e.preventDefault()
    setMode('replay')
    setT((p) => clamp(e.key === 'Home' ? 0 : e.key === 'End' ? clip.duration : p + d, 0, clip.duration))
  }

  // Copy / paste
  const copy = async () => {
    if (!clip) return
    const json = JSON.stringify({ v: 1, ...clip })
    try { await navigator.clipboard.writeText(json); flash('Clip copied') }
    catch { setPaste(json); flash('Copy from the box') }
  }
  const openPaste = async () => {
    if (paste !== null) { setPaste(null); return }
    let txt = ''
    try { txt = await navigator.clipboard.readText() } catch { /* ignore */ }
    setPaste(txt || '')
  }
  const loadPaste = () => {
    try {
      const o = JSON.parse(paste)
      if (!o || !Array.isArray(o.events) || typeof o.duration !== 'number' || !o.init) throw new Error('bad')
      const events = o.events.filter((e) => e && typeof e.t === 'number' && typeof e.k === 'string').sort((a, b) => a.t - b.t)
      setClip({ duration: Math.max(1, o.duration), init: { ...INIT, ...o.init }, events })
      setPaste(null); setPlaying(false); setMode('idle'); setT(0)
      flash('Clip loaded')
    } catch { flash('Not a valid clip') }
  }

  // What the stage shows
  const shown = useMemo(
    () => (mode === 'replay' && clip ? stateAt(clip.init, clip.events, t) : live),
    [mode, clip, t, live],
  )
  const ghost = mode === 'replay' && clip && showGhost ? ghostAt(clip.events, t) : null
  const dur = clip ? clip.duration : 0
  const frac = clip && mode === 'replay' ? clamp(t / dur, 0, 1) : 0
  const recording = mode === 'rec'

  const btn = (on, danger) => ({
    border: `1px solid ${on ? accent : 'rgba(255,255,255,0.22)'}`, background: on ? accent : 'rgba(255,255,255,0.06)',
    color: danger ? '#ff6b6b' : '#fff', borderRadius: 8, padding: '6px 11px', font: '600 12px system-ui, sans-serif', cursor: 'pointer',
  })
  const dis = { opacity: 0.4, cursor: 'default' }

  return (
    <div
      ref={rootRef}
      onPointerMove={onRootMove}
      style={{ position: 'relative', width: '100%', height: '100%', minHeight: 300, display: 'flex', flexDirection: 'column', gap: 8, padding: 10, boxSizing: 'border-box', background: '#14161c', color: '#fff', font: '12px system-ui, sans-serif', userSelect: 'none', overflow: 'hidden', ...style }}
    >
      <div ref={stageRef} style={{ position: 'relative', flex: 1, minHeight: 120, borderRadius: 12, background: 'radial-gradient(circle at 50% 40%, #262a36, #181b23)', border: `2px solid ${recording ? '#ff3b3b' : 'rgba(255,255,255,0.1)'}`, touchAction: 'none', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 10, top: 8, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, opacity: 0.85 }}>
          {recording && <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff3b3b', animation: 'rrblink 1s steps(2) infinite' }} />}
          <span>{recording ? `REC ${fmt(elapsed)} / ${maxSeconds}s` : mode === 'replay' ? `REPLAY ${fmt(t)}` : 'Drag the ball'}</span>
        </div>
        <style>{'@keyframes rrblink{50%{opacity:.2}} @media (prefers-reduced-motion: reduce){@keyframes rrblink{50%{opacity:1}}}'}</style>
        <div
          onPointerDown={onBallDown}
          onPointerMove={onBallMove}
          onPointerUp={onBallUp}
          onPointerCancel={onBallUp}
          style={{
            position: 'absolute', left: `${shown.bx * 100}%`, top: `${shown.by * 100}%`, width: 56, height: 56, margin: -28,
            borderRadius: shown.square ? 12 : '50%', background: shown.color, cursor: locked ? 'default' : shown.drag ? 'grabbing' : 'grab',
            transform: shown.drag ? 'scale(1.12)' : 'scale(1)', transition: 'transform 0.12s, border-radius 0.2s, background 0.2s',
            boxShadow: shown.glow ? `0 0 0 6px ${shown.color}55, 0 0 34px 8px ${shown.color}` : '0 4px 12px rgba(0,0,0,0.5)',
            touchAction: 'none',
          }}
        />
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        <button style={{ ...btn(false), ...(recording ? { borderColor: '#ff3b3b' } : null) }} onClick={() => (recording ? stopRec() : startRec())}>
          {recording ? '■ Stop' : '● Record'}
        </button>
        <button style={{ ...btn(playing && mode === 'replay'), ...(!clip || recording ? dis : null) }} disabled={!clip || recording} onClick={play}>
          {playing && mode === 'replay' ? '❚❚ Pause' : '▶ Play'}
        </button>
        {mode === 'replay' && <button style={btn(false)} onClick={exitReplay}>Live</button>}
        <span style={{ opacity: 0.5, margin: '0 2px' }}>|</span>
        {[0.5, 1, 2].map((s) => (
          <button key={s} style={btn(speed === s)} onClick={() => setSpeed(s)} aria-pressed={speed === s}>{s}x</button>
        ))}
        <button style={btn(loop)} onClick={() => setLoop(!loop)} aria-pressed={loop}>Loop</button>
        <span style={{ flex: 1 }} />
        <button style={{ ...btn(false), ...(!clip ? dis : null) }} disabled={!clip} onClick={copy}>Copy clip</button>
        <button style={btn(paste !== null)} onClick={openPaste}>Paste clip</button>
        <button style={{ ...btn(false, true), ...(!clip ? dis : null) }} disabled={!clip} onClick={del}>Delete</button>
      </div>

      {paste !== null && (
        <div style={{ display: 'flex', gap: 6 }}>
          <textarea value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="Paste clip JSON here" rows={2} style={{ flex: 1, resize: 'none', background: '#0d0f14', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, font: '11px monospace', padding: 6 }} />
          <button style={btn(true)} onClick={loadPaste}>Load</button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div
          ref={barRef}
          role="slider"
          tabIndex={clip ? 0 : -1}
          aria-label="Clip timeline"
          aria-valuemin={0}
          aria-valuemax={Math.round(dur)}
          aria-valuenow={Math.round(mode === 'replay' ? t : 0)}
          onPointerDown={barDown}
          onPointerMove={barMove}
          onPointerUp={barUp}
          onPointerCancel={barUp}
          onKeyDown={barKey}
          style={{ position: 'relative', flex: 1, height: 22, borderRadius: 11, background: 'rgba(255,255,255,0.1)', touchAction: 'none', cursor: clip ? 'pointer' : 'default', outlineOffset: 2 }}
        >
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${frac * 100}%`, borderRadius: 11, background: accent, opacity: 0.85 }} />
          {clip && clip.events.filter((e) => e.k === 'tg' || e.k === 'co').map((e, i) => (
            <div key={i} style={{ position: 'absolute', left: `${(e.t / dur) * 100}%`, top: 3, width: 3, height: 16, borderRadius: 2, background: '#fff', opacity: 0.8 }} />
          ))}
          {clip && <div style={{ position: 'absolute', left: `calc(${frac * 100}% - 7px)`, top: 4, width: 14, height: 14, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.5)' }} />}
        </div>
        <span style={{ minWidth: 86, textAlign: 'right', opacity: 0.7, fontVariantNumeric: 'tabular-nums' }}>
          {clip ? `${fmt(mode === 'replay' ? t : 0)} / ${fmt(dur)}` : 'No clip'}
        </span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        <button style={{ ...btn(shown.glow), ...(locked ? dis : null) }} onClick={() => onToggle('glow')} aria-pressed={shown.glow}>Glow</button>
        <button style={{ ...btn(shown.square), ...(locked ? dis : null) }} onClick={() => onToggle('square')} aria-pressed={shown.square}>Square</button>
        <span style={{ opacity: 0.5, margin: '0 2px' }}>|</span>
        {SWATCHES.map((c) => (
          <button
            key={c}
            aria-label={`Colour ${c}`}
            onClick={() => onColor(c)}
            style={{ width: 24, height: 24, borderRadius: '50%', background: c, cursor: locked ? 'default' : 'pointer', border: shown.color === c ? '3px solid #fff' : '2px solid rgba(255,255,255,0.25)', opacity: locked ? 0.6 : 1, padding: 0 }}
          />
        ))}
        <span style={{ flex: 1 }} />
        <span style={{ opacity: 0.75 }}>{msg}</span>
      </div>

      {ghost && (
        <svg width="22" height="22" viewBox="0 0 22 22" style={{ position: 'absolute', left: `${ghost.x * 100}%`, top: `${ghost.y * 100}%`, pointerEvents: 'none', filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.6))', opacity: 0.85 }}>
          <path d="M3 2 L3 17 L7 13 L10 20 L13 19 L10 12 L16 12 Z" fill="#fff" stroke={accent} strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  )
}
