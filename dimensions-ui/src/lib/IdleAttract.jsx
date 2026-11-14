import { useEffect, useRef, useState } from 'react'

// Idle attract loop. A little retro gadget (lid, volume knob, display, button)
// that you can play with: drag the knob, tap the lid, press the button. Leave
// it alone for idleSeconds and it runs a short scripted demo by itself: the
// knob swings, the lid lifts, the display scrolls, the button dips, and an
// accent ring hops from part to part with a "Tap to take over" hint. Any input
// anywhere (pointer, touch, key, wheel) cancels the demo and every part eases
// back to where you left it. A thin ring in the corner counts down to the next
// run. Under reduced motion the demo is a plain sequence of state changes: no
// easing, no scrolling, no ring travel.

const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const reduced = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

const PARTS = {
  knob: { x: 105, y: 185, rx: 42, ry: 42 },
  lid: { x: 200, y: 92, rx: 160, ry: 34 },
  display: { x: 220, y: 168, rx: 74, ry: 34 },
  btn: { x: 315, y: 205, rx: 30, ry: 30 },
}
const SCRIPT = [
  { ms: 800, part: 'knob', set: { knob: 0.88 } },
  { ms: 700, part: 'knob', set: { knob: 0.2 } },
  { ms: 800, part: 'lid', set: { lid: 1 } },
  { ms: 1900, part: 'display', set: {}, scroll: true },
  { ms: 450, part: 'btn', set: { btn: 1 } },
  { ms: 400, part: 'btn', set: { btn: 0 }, play: true },
  { ms: 800, part: 'lid', set: { lid: 0 } },
  { ms: 500, part: null, set: {} },
]
const MESSAGE = 'IDLE DEMO  *  TURN  *  OPEN  *  PLAY  *  '
const CIRC = 2 * Math.PI * 13

export default function IdleAttract({
  idleSeconds = 5,
  speed = 1,
  accent = '#ff4d1a',
  showCountdown = true,
  color = '#2a2824',
  textColor = '#1c1a16',
  style,
}) {
  const [demo, setDemo] = useState(false)
  const el = useRef({})
  const user = useRef({ knob: 0.35, lid: 0, playing: false })
  const cur = useRef({ knob: 0.35, lid: 0, btn: 0, scroll: 0, ...PARTS.knob, ha: 0 })
  const D = useRef({ on: false, i: 0, t0: 0, t: {}, play: false })
  const lastIn = useRef(typeof performance !== 'undefined' ? performance.now() : 0)
  const drag = useRef(null)
  const btnDown = useRef(false)

  useEffect(() => {
    const idleMs = Math.max(1, idleSeconds) * 1000
    const sp = Math.max(0.2, speed)
    const d = D.current
    const c = cur.current
    let raf = 0
    let last = performance.now()
    let shown = ''

    const poke = () => {
      lastIn.current = performance.now()
      if (d.on) { d.on = false; setDemo(false) }
    }
    const evs = ['pointerdown', 'pointermove', 'touchstart', 'keydown', 'wheel']
    evs.forEach((n) => window.addEventListener(n, poke, { passive: true }))

    const applyStep = () => {
      const s = SCRIPT[d.i]
      Object.assign(d.t, s.set)
      if (s.play) d.play = !d.play
    }

    const tick = (now) => {
      const dt = Math.min((now - last) / 1000, 1 / 20)
      last = now
      const rm = reduced()
      const u = user.current
      if (!d.on && !drag.current && !btnDown.current && now - lastIn.current >= idleMs) {
        d.on = true; d.i = 0; d.t0 = now; d.play = u.playing
        d.t = { knob: u.knob, lid: u.lid, btn: 0 }
        applyStep()
        setDemo(true)
      }
      if (d.on) {
        const s = SCRIPT[d.i]
        const dur = rm ? 1000 : s.ms
        if ((now - d.t0) * sp >= dur) {
          d.i++
          d.t0 = now
          if (d.i >= SCRIPT.length) { d.on = false; lastIn.current = now; setDemo(false) } else applyStep()
        }
      }
      const tgt = d.on ? d.t : { knob: u.knob, lid: u.lid, btn: btnDown.current ? 1 : 0 }
      const k = rm ? 1 : 1 - Math.exp(-9 * dt * (d.on ? Math.max(1, sp) : 1))
      c.knob += (tgt.knob - c.knob) * k
      c.lid += (tgt.lid - c.lid) * k
      c.btn += (tgt.btn - c.btn) * Math.min(1, k * 1.6)
      const s = d.on ? SCRIPT[d.i] : null
      const part = s && s.part ? PARTS[s.part] : null
      const hk = rm ? 1 : 1 - Math.exp(-8 * dt)
      if (part) {
        if (c.ha < 0.05) { c.x = part.x; c.y = part.y; c.rx = part.rx; c.ry = part.ry }
        c.x += (part.x - c.x) * hk; c.y += (part.y - c.y) * hk
        c.rx += (part.rx - c.rx) * hk; c.ry += (part.ry - c.ry) * hk
      }
      c.ha += ((part ? 1 : 0) - c.ha) * (rm ? 1 : 1 - Math.exp(-10 * dt))
      c.scroll = s && s.scroll && !rm ? c.scroll + dt * 90 * sp : s && s.scroll ? 0 : 0

      const e = el.current
      e.knob?.setAttribute('transform', `rotate(${(-135 + 270 * c.knob).toFixed(2)} 105 185)`)
      e.lid?.setAttribute('transform', `rotate(${(-26 * c.lid).toFixed(2)} 50 116)`)
      e.btn?.setAttribute('transform', `translate(0 ${(c.btn * 4).toFixed(2)})`)
      if (e.ring) {
        e.ring.setAttribute('cx', c.x.toFixed(1)); e.ring.setAttribute('cy', c.y.toFixed(1))
        e.ring.setAttribute('rx', c.rx.toFixed(1)); e.ring.setAttribute('ry', c.ry.toFixed(1))
        e.ring.setAttribute('opacity', c.ha.toFixed(3))
      }
      const vol = Math.round(c.knob * 100)
      const playing = d.on ? d.play : u.playing
      const text = s && s.scroll ? MESSAGE + MESSAGE : `${playing ? 'PLAY' : 'VOL'} ${String(vol).padStart(2, '0')}`
      if (e.text) {
        if (text !== shown) { e.text.textContent = text; shown = text }
        const off = s && s.scroll ? -(c.scroll % 260) : 0
        e.text.setAttribute('transform', `translate(${(170 + off).toFixed(1)} 174)`)
      }
      const f = clamp((now - lastIn.current) / idleMs, 0, 1)
      if (e.cd) {
        e.cd.setAttribute('stroke-dashoffset', (d.on ? CIRC : f * CIRC).toFixed(2))
        e.cdg?.setAttribute('opacity', d.on ? 0 : 1)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      evs.forEach((n) => window.removeEventListener(n, poke))
    }
  }, [idleSeconds, speed])

  const knobDown = (e) => {
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY }
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  const knobMove = (e) => {
    const g = drag.current
    if (!g || g.id !== e.pointerId) return
    const dv = (g.x - e.clientX) * -0.006 + (g.y - e.clientY) * 0.006
    user.current.knob = clamp(user.current.knob + dv, 0, 1)
    g.x = e.clientX; g.y = e.clientY
  }
  const knobUp = (e) => { if (drag.current?.id === e.pointerId) drag.current = null }
  const toggleLid = () => { user.current.lid = user.current.lid > 0.5 ? 0 : 1 }
  const pressDown = (e) => { btnDown.current = true; e.currentTarget.setPointerCapture?.(e.pointerId) }
  const pressUp = () => {
    if (!btnDown.current) return
    btnDown.current = false
    user.current.playing = !user.current.playing
  }
  const keyDown = (e) => {
    const u = user.current
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') u.knob = clamp(u.knob + 0.05, 0, 1)
    else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') u.knob = clamp(u.knob - 0.05, 0, 1)
    else if (e.key === 'Enter' || e.key === 'l') toggleLid()
    else if (e.key === ' ') u.playing = !u.playing
    else return
    e.preventDefault()
  }
  const ref = (n) => (node) => { el.current[n] = node }
  const part = { cursor: 'pointer' }

  return (
    <>
      <style>{`
        .ia { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; box-sizing: border-box; padding: 16px; background: #f4f1ea; color: var(--ia-ink); outline: none; touch-action: none; user-select: none; -webkit-user-select: none; -webkit-tap-highlight-color: transparent; font: 500 11px/1 ui-monospace, Menlo, monospace; letter-spacing: .12em; text-transform: uppercase; }
        .ia:focus-visible { box-shadow: inset 0 0 0 3px var(--ia-accent); }
        .ia svg { width: 100%; max-width: 520px; height: auto; max-height: 100%; overflow: visible; }
        .ia-hint { min-height: 14px; opacity: .6; text-align: center; }
        .ia[data-demo='true'] .ia-hint { opacity: 1; color: var(--ia-accent); animation: ia-pulse 1.1s ease-in-out infinite; }
        @keyframes ia-pulse { 50% { opacity: .45; } }
        @media (prefers-reduced-motion: reduce) { .ia-hint { animation: none !important; } }
      `}</style>
      <div
        className="ia"
        data-demo={demo}
        tabIndex={0}
        role="group"
        aria-label="Interactive gadget. Arrow keys turn the knob, Enter opens the lid, Space plays."
        onKeyDown={keyDown}
        style={{ '--ia-accent': accent, '--ia-ink': textColor, ...style }}
      >
        <svg viewBox="0 0 400 300" aria-hidden="true">
          <ellipse cx="200" cy="270" rx="170" ry="10" fill="#1c1a16" opacity=".12" />
          <rect x="50" y="110" width="300" height="150" rx="22" fill={color} />
          <rect x="70" y="106" width="260" height="10" rx="4" fill="#0d0c0a" />
          <rect x="62" y="238" width="276" height="4" rx="2" fill="#fff" opacity=".08" />
          {/* display */}
          <rect x="160" y="146" width="120" height="44" rx="7" fill="#0f1a14" stroke="#000" strokeWidth="2" />
          <clipPath id="ia-clip"><rect x="164" y="150" width="112" height="36" rx="4" /></clipPath>
          <g clipPath="url(#ia-clip)">
            <text ref={ref('text')} fill={accent} fontFamily="ui-monospace, Menlo, monospace" fontSize="15" fontWeight="700" letterSpacing="2" style={{ whiteSpace: 'pre' }} />
          </g>
          {/* knob */}
          <g onPointerDown={knobDown} onPointerMove={knobMove} onPointerUp={knobUp} onPointerCancel={knobUp} style={{ ...part, touchAction: 'none' }}>
            <circle cx="105" cy="185" r="38" fill="#171512" />
            <g ref={ref('knob')}>
              <circle cx="105" cy="185" r="30" fill="#4a463e" stroke="#6b665b" strokeWidth="2" />
              <line x1="105" y1="185" x2="105" y2="162" stroke={accent} strokeWidth="5" strokeLinecap="round" />
            </g>
          </g>
          {/* button */}
          <circle cx="315" cy="205" r="22" fill="#171512" />
          <g ref={ref('btn')} onPointerDown={pressDown} onPointerUp={pressUp} onPointerCancel={pressUp} style={{ ...part, touchAction: 'none' }}>
            <circle cx="315" cy="203" r="17" fill={accent} stroke="#00000033" strokeWidth="2" />
            <circle cx="310" cy="198" r="5" fill="#fff" opacity=".3" />
          </g>
          {/* lid, hinged at the left */}
          <g ref={ref('lid')} onClick={toggleLid} style={part}>
            <rect x="50" y="68" width="300" height="48" rx="14" fill="#3d3a33" stroke="#57534a" strokeWidth="2" />
            <rect x="64" y="78" width="272" height="6" rx="3" fill="#fff" opacity=".1" />
            <rect x="180" y="96" width="40" height="8" rx="4" fill="#171512" />
          </g>
          <ellipse ref={ref('ring')} cx="105" cy="185" rx="42" ry="42" fill="none" stroke={accent} strokeWidth="3" strokeDasharray="7 6" opacity="0" pointerEvents="none" />
          {showCountdown && (
            <g ref={ref('cdg')} transform="translate(372 28)">
              <circle r="13" fill="none" stroke="#1c1a16" strokeOpacity=".12" strokeWidth="3" />
              <circle ref={ref('cd')} r="13" fill="none" stroke={accent} strokeWidth="3" strokeLinecap="round" strokeDasharray={CIRC} strokeDashoffset="0" transform="rotate(-90)" />
            </g>
          )}
        </svg>
        <div className="ia-hint" aria-live="polite">{demo ? 'Tap to take over' : 'Leave it alone and it will show off'}</div>
      </div>
    </>
  )
}
