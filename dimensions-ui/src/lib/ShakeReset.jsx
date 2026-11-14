import { useEffect, useRef, useState } from 'react'

// Shake to reset: a snow globe whose flakes swirl up when you shake, then drift
// down and settle, next to three settings (wind, fall speed, night mode) that
// you can change and that glide back to their defaults on every shake.
// Shake detection: the phone's accelerometer (devicemotion; iPhones ask via an
// "Enable motion" button), or on desktop shaking the mouse back and forth over
// the page, the Shake button, or the S key. Under reduced motion the flakes
// barely stir and the settings jump straight back.

const DEFAULTS = { wind: 0, fall: 1, night: 1 } // night: 1 = on
const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export default function ShakeReset({
  flakes = 160,
  sensitivity = 1,
  accent = '#ff4d1a',
  snowColor = '#ffffff',
  bgColor = '#1d2b4f',
  style,
}) {
  const box = useRef(null)
  const cv = useRef(null)
  const sim = useRef({ f: [], agit: 0, w: 300, h: 300, glow: 1 })
  const set = useRef({ ...DEFAULTS }) // live values read by the loop
  const tween = useRef(null)
  const [vals, setVals] = useState({ ...DEFAULTS })
  const [shakes, setShakes] = useState(0)
  const [needsPerm, setNeedsPerm] = useState(false)
  const [note, setNote] = useState('')
  const opts = useRef({})
  opts.current = { flakes, sensitivity, accent, snowColor, bgColor }

  const update = (patch) => {
    tween.current = null
    set.current = { ...set.current, ...patch }
    setVals(set.current)
  }

  const shake = () => {
    const s = sim.current
    const reduce = reducedMotion()
    s.agit = reduce ? 0.15 : 1
    for (const p of s.f) {
      const a = Math.random() * Math.PI * 2
      const v = (0.4 + Math.random()) * (reduce ? 30 : 260)
      p.vx += Math.cos(a) * v
      p.vy += Math.sin(a) * v - (reduce ? 0 : 160)
    }
    setShakes((n) => n + 1)
    // settings glide back to their defaults
    if (reduce) {
      set.current = { ...DEFAULTS }
      setVals(set.current)
      return
    }
    tween.current = { from: { ...set.current }, t0: performance.now() }
  }
  const shakeRef = useRef(shake)
  shakeRef.current = shake

  // tween settings back to defaults
  useEffect(() => {
    let raf = 0
    const tick = (now) => {
      const t = tween.current
      if (t) {
        const k = Math.min(1, (now - t.t0) / 700)
        const e = 1 - Math.pow(1 - k, 3)
        const next = {}
        for (const key of Object.keys(DEFAULTS)) next[key] = t.from[key] + (DEFAULTS[key] - t.from[key]) * e
        set.current = next
        setVals(next)
        if (k >= 1) tween.current = null
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  // shake detection: devicemotion, mouse shaking, S key
  useEffect(() => {
    let last = 0
    const fire = () => {
      const now = performance.now()
      if (now - last < 900) return
      last = now
      shakeRef.current()
    }
    const onMotion = (e) => {
      const a = e.acceleration && e.acceleration.x != null ? e.acceleration : null
      let m
      if (a) m = Math.hypot(a.x, a.y, a.z)
      else {
        const g = e.accelerationIncludingGravity
        if (!g || g.x == null) return
        m = Math.abs(Math.hypot(g.x, g.y, g.z) - 9.81)
      }
      if (m > 14 / Math.max(0.2, opts.current.sensitivity)) fire()
    }
    let lx = 0
    let lt = 0
    let dir = 0
    let revs = []
    const onMove = (e) => {
      const now = performance.now()
      const dx = e.clientX - lx
      const dt = now - lt
      lx = e.clientX
      lt = now
      if (e.pointerType === 'touch' || dt > 250 || dt <= 0) return
      const speed = Math.abs(dx) / dt // px per ms
      if (speed < 0.7 / Math.max(0.2, opts.current.sensitivity) || Math.abs(dx) < 4) return
      const d = Math.sign(dx)
      if (dir !== 0 && d !== dir) {
        revs.push(now)
        revs = revs.filter((t) => now - t < 700)
        if (revs.length >= Math.max(3, Math.round(5 / Math.max(0.2, opts.current.sensitivity)))) {
          revs = []
          fire()
        }
      }
      dir = d
    }
    const onKey = (e) => {
      if ((e.key === 's' || e.key === 'S') && !e.ctrlKey && !e.metaKey && !e.altKey && !/^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName || '')) fire()
    }
    window.addEventListener('devicemotion', onMotion)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('devicemotion', onMotion)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  useEffect(() => {
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') setNeedsPerm(true)
  }, [])
  const enableMotion = async () => {
    try {
      const r = await DeviceMotionEvent.requestPermission()
      if (r === 'granted') {
        setNeedsPerm(false)
        setNote('')
      } else setNote('Motion access denied - use the Shake button instead.')
    } catch {
      setNote('Motion is unavailable - use the Shake button instead.')
    }
  }

  // the globe
  useEffect(() => {
    const c = cv.current
    const g = c.getContext('2d')
    const s = sim.current
    const reduce = reducedMotion()
    let dpr = 1
    const resize = () => {
      const r = box.current.getBoundingClientRect()
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      s.w = Math.max(120, r.width)
      s.h = Math.max(120, r.height)
      c.width = s.w * dpr
      c.height = s.h * dpr
      c.style.width = s.w + 'px'
      c.style.height = s.h + 'px'
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(box.current)

    const geom = () => {
      const R = Math.min(s.w * 0.42, s.h * 0.4)
      return { R, cx: s.w / 2, cy: s.h * 0.46, floor: s.h * 0.46 + R * 0.78 }
    }
    const spawn = (p, gm, anywhere) => {
      const a = Math.random() * Math.PI * 2
      const rr = Math.sqrt(Math.random()) * gm.R * 0.92
      p.x = gm.cx + Math.cos(a) * rr
      p.y = anywhere ? gm.cy + Math.sin(a) * rr * 0.9 : gm.floor
      p.vx = 0
      p.vy = 0
      p.r = 1 + Math.random() * 2.2
      p.ph = Math.random() * 6.28
    }
    let raf = 0
    let last = performance.now()
    const frame = (now) => {
      const dt = Math.min((now - last) / 1000, 1 / 30)
      last = now
      const o = opts.current
      const st = set.current
      const gm = geom()
      const want = Math.round(o.flakes)
      while (s.f.length < want) {
        const p = {}
        spawn(p, gm, true)
        s.f.push(p)
      }
      if (s.f.length > want) s.f.length = want
      s.agit = Math.max(0, s.agit - dt * 0.35)
      const night = st.night
      s.glow += (night - s.glow) * Math.min(1, dt * 6)

      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.clearRect(0, 0, s.w, s.h)
      // glass
      const sky = g.createRadialGradient(gm.cx, gm.cy - gm.R * 0.3, gm.R * 0.1, gm.cx, gm.cy, gm.R)
      const mix = (a, b, t) => Math.round(a + (b - a) * t)
      sky.addColorStop(0, `rgb(${mix(190, 70, s.glow)},${mix(215, 90, s.glow)},${mix(240, 150, s.glow)})`)
      sky.addColorStop(1, `rgb(${mix(120, 20, s.glow)},${mix(160, 30, s.glow)},${mix(210, 70, s.glow)})`)
      g.fillStyle = sky
      g.beginPath()
      g.arc(gm.cx, gm.cy, gm.R, 0, Math.PI * 2)
      g.fill()

      // house + tree inside
      g.save()
      g.beginPath()
      g.arc(gm.cx, gm.cy, gm.R, 0, Math.PI * 2)
      g.clip()
      g.fillStyle = '#f4f1ea'
      g.beginPath()
      g.ellipse(gm.cx, gm.floor + gm.R * 0.1, gm.R * 1.1, gm.R * 0.32, 0, 0, Math.PI * 2)
      g.fill()
      const hx = gm.cx - gm.R * 0.12
      const hw = gm.R * 0.34
      const hh = gm.R * 0.24
      g.fillStyle = '#8a5a3c'
      g.fillRect(hx - hw / 2, gm.floor - hh, hw, hh)
      g.fillStyle = o.accent
      g.beginPath()
      g.moveTo(hx - hw * 0.62, gm.floor - hh)
      g.lineTo(hx, gm.floor - hh - hw * 0.5)
      g.lineTo(hx + hw * 0.62, gm.floor - hh)
      g.closePath()
      g.fill()
      g.fillStyle = `rgba(255,214,120,${0.35 + 0.65 * s.glow})`
      g.fillRect(hx - hw * 0.12, gm.floor - hh * 0.65, hw * 0.24, hw * 0.24)
      g.fillStyle = '#2f5d3a'
      const tx = gm.cx + gm.R * 0.34
      for (let i = 0; i < 3; i++) {
        const w = gm.R * (0.2 - i * 0.045)
        const y = gm.floor - gm.R * (0.08 + i * 0.1)
        g.beginPath()
        g.moveTo(tx - w, y)
        g.lineTo(tx, y - gm.R * 0.16)
        g.lineTo(tx + w, y)
        g.closePath()
        g.fill()
      }

      // flakes
      g.fillStyle = o.snowColor
      const fallV = (reduce ? 14 : 28) * st.fall
      for (const p of s.f) {
        const wind = st.wind * 0.6
        p.vx += (wind - p.vx * 0.5 * 0) * dt * 2
        p.vx += Math.sin(now / 900 + p.ph) * 14 * dt
        p.vx += (Math.random() - 0.5) * 900 * s.agit * dt
        p.vy += (Math.random() - 0.5) * 900 * s.agit * dt
        // drag, and a pull toward the terminal falling speed
        const drag = Math.exp(-dt * (1.5 + (1 - s.agit) * 1.5))
        p.vx *= drag
        p.vy = p.vy * drag + (fallV * (0.6 + p.r * 0.25) - p.vy * 0) * (1 - drag)
        p.x += p.vx * dt
        p.y += p.vy * dt
        // stay inside the globe, rest on the floor
        let dx = p.x - gm.cx
        let dy = p.y - gm.cy
        const d = Math.hypot(dx, dy)
        const lim = gm.R - 4
        if (d > lim) {
          p.x = gm.cx + (dx / d) * lim
          p.y = gm.cy + (dy / d) * lim
          p.vx *= -0.4
          p.vy *= -0.4
        }
        if (p.y > gm.floor - 1 - p.r * 0.3) {
          p.y = gm.floor - 1 - p.r * 0.3
          p.vy = 0
          p.vx *= 0.6
        }
        g.beginPath()
        g.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        g.fill()
      }
      g.restore()

      // glass highlight + rim
      g.strokeStyle = 'rgba(255,255,255,.55)'
      g.lineWidth = 2
      g.beginPath()
      g.arc(gm.cx, gm.cy, gm.R, 0, Math.PI * 2)
      g.stroke()
      g.strokeStyle = 'rgba(255,255,255,.7)'
      g.lineWidth = 5
      g.lineCap = 'round'
      g.beginPath()
      g.arc(gm.cx, gm.cy, gm.R * 0.86, Math.PI * 1.08, Math.PI * 1.3)
      g.stroke()
      // base
      g.fillStyle = o.accent
      g.beginPath()
      const by = gm.cy + gm.R * 0.8
      g.moveTo(gm.cx - gm.R * 0.74, by)
      g.lineTo(gm.cx + gm.R * 0.74, by)
      g.lineTo(gm.cx + gm.R * 0.9, by + gm.R * 0.3)
      g.lineTo(gm.cx - gm.R * 0.9, by + gm.R * 0.3)
      g.closePath()
      g.fill()
      g.fillStyle = 'rgba(0,0,0,.25)'
      g.fillRect(gm.cx - gm.R * 0.9, by + gm.R * 0.25, gm.R * 1.8, gm.R * 0.05)

      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [])

  const mono = '500 11px/1.4 ui-monospace, Menlo, monospace'
  const btn = { padding: '9px 14px', borderRadius: 999, border: 'none', cursor: 'pointer', background: accent, color: '#fff', font: '700 12px/1 system-ui, sans-serif', letterSpacing: '.03em' }
  const row = { display: 'grid', gap: 4 }
  const lab = { display: 'flex', justifyContent: 'space-between', font: mono, letterSpacing: '.06em', textTransform: 'uppercase', opacity: 0.85 }

  return (
    <div
      style={{ position: 'relative', width: '100%', height: 460, display: 'flex', flexWrap: 'wrap', background: bgColor, color: '#f4f1ea', overflow: 'hidden', ...style }}
    >
      <div ref={box} style={{ position: 'relative', flex: '1 1 300px', minHeight: 260, minWidth: 0 }}>
        <canvas ref={cv} style={{ display: 'block', position: 'absolute', left: 0, top: 0 }} aria-label="Snow globe" role="img" />
      </div>
      <div style={{ flex: '0 0 220px', maxWidth: '100%', boxSizing: 'border-box', padding: 18, display: 'flex', flexDirection: 'column', gap: 14, justifyContent: 'center', margin: '0 auto' }}>
        <div style={{ font: mono, letterSpacing: '.12em', opacity: 0.7 }}>SETTINGS &middot; SHAKES {shakes}</div>
        <label style={row}>
          <span style={lab}>
            <span>Wind</span>
            <span>{Math.round(vals.wind)}</span>
          </span>
          <input type="range" min={-60} max={60} step={1} value={vals.wind} onChange={(e) => update({ wind: +e.target.value })} style={{ accentColor: accent }} />
        </label>
        <label style={row}>
          <span style={lab}>
            <span>Fall speed</span>
            <span>{vals.fall.toFixed(1)}x</span>
          </span>
          <input type="range" min={0.2} max={3} step={0.1} value={vals.fall} onChange={(e) => update({ fall: +e.target.value })} style={{ accentColor: accent }} />
        </label>
        <label style={row}>
          <span style={lab}>
            <span>Night</span>
            <span>{vals.night > 0.5 ? 'on' : 'off'}</span>
          </span>
          <input type="checkbox" checked={vals.night > 0.5} onChange={(e) => update({ night: e.target.checked ? 1 : 0 })} style={{ accentColor: accent, width: 20, height: 20, margin: 0 }} />
        </label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="button" onClick={() => shake()} style={btn}>
            Shake
          </button>
          {needsPerm && (
            <button type="button" onClick={enableMotion} style={{ ...btn, background: 'rgba(255,255,255,.16)' }}>
              Enable motion
            </button>
          )}
        </div>
        <div style={{ font: mono, opacity: 0.6, fontSize: 10 }}>
          {note || 'Shake your phone, shake the mouse, or press S. Settings return to default.'}
        </div>
      </div>
    </div>
  )
}
