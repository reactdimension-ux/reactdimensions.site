import { useEffect, useRef, useState } from 'react'

// Presence cursors: a shared stage with a lamp that toggles when clicked, and
// colour-coded, name-tagged cursors for OTHER viewers (never your own). Real
// presence uses BroadcastChannel, so open this page in a second tab and you see
// each other's cursor, clicks and emoji reactions (heartbeat ~1s, peers dropped
// after ~3s of silence, a goodbye is sent on unmount/unload; positions are
// normalised to the stage size). Simulated visitors ("bots") wander on smooth
// paths, hover the lamp, sometimes click it and send a floating emoji. If
// BroadcastChannel is missing only the bots appear. Under reduced motion bots
// hop between points and reactions fade in place instead of floating. No network.

const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

const ADJ = ['Brisk', 'Calm', 'Clever', 'Dapper', 'Eager', 'Fuzzy', 'Gentle', 'Jolly', 'Keen', 'Lucky', 'Mellow', 'Nimble', 'Plucky', 'Quiet', 'Sunny', 'Witty']
const ANI = ['Otter', 'Fox', 'Heron', 'Lynx', 'Panda', 'Gecko', 'Falcon', 'Badger', 'Koala', 'Newt', 'Robin', 'Yak', 'Moose', 'Finch', 'Ibex', 'Wombat']
const EMOJI = ['\u{1F44D}', '\u{1F389}', '\u{1F525}', '\u{1F60D}', '✨', '\u{1F44F}', '\u{1F4A1}', '❤️']
const CHANNEL = 'dimensions-presence-cursors'

const makeName = (n) => `${ADJ[n % ADJ.length]} ${ANI[Math.floor(n / ADJ.length) % ANI.length]}`
const colorFor = (n) => `hsl(${(n * 47) % 360} 78% 52%)`
const rnd = (a, b) => a + Math.random() * (b - a)
const ease = (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2)

function getIdentity() {
  const fresh = () => {
    const n = Math.floor(Math.random() * ADJ.length * ANI.length)
    return { id: Math.random().toString(36).slice(2, 10), n }
  }
  let ident = null
  try {
    const raw = sessionStorage.getItem('presence-cursors-id')
    if (raw) ident = JSON.parse(raw)
  } catch { /* ignore */ }
  if (!ident || !ident.id) {
    ident = fresh()
    try { sessionStorage.setItem('presence-cursors-id', JSON.stringify(ident)) } catch { /* ignore */ }
  }
  return ident
}

function newSeg(b, now) {
  const near = Math.random() < 0.35
  const x1 = near ? rnd(0.44, 0.56) : rnd(0.08, 0.92)
  const y1 = near ? rnd(0.4, 0.62) : rnd(0.14, 0.9)
  const mx = (b.x + x1) / 2, my = (b.y + y1) / 2
  const off = rnd(-0.14, 0.14)
  b.seg = { x0: b.x, y0: b.y, x1, y1, cx: mx + (y1 - b.y) * off * 2, cy: my - (x1 - b.x) * off * 2, t0: now, dur: rnd(1300, 2700) }
  b.near = near
  b.pause = 0
  b.done = false
}

export default function PresenceCursors({
  simulate = true,
  botCount = 3,
  accent = '#ff4d1a',
  showNames = true,
  style,
}) {
  const [on, setOn] = useState(false)
  const [, setFrame] = useState(0)
  const [reactions, setReactions] = useState([])
  const [channelOk, setChannelOk] = useState(false)
  const me = useRef(null)
  if (!me.current) me.current = getIdentity()
  const stage = useRef(null)
  const chan = useRef(null)
  const peers = useRef(new Map())
  const bots = useRef([])
  const onRef = useRef(false)
  const pos = useRef({ x: null, y: null })
  const lastSend = useRef(0)
  const timers = useRef(new Set())
  const uid = useRef(0)
  const cfg = useRef({})
  cfg.current = { simulate, botCount }

  const myName = makeName(me.current.n)
  const myColor = colorFor(me.current.n)

  const send = (m) => { try { chan.current?.postMessage({ ...m, id: me.current.id, name: myName, color: myColor }) } catch { /* ignore */ } }

  const addReaction = (x, y, emoji, color) => {
    const id = ++uid.current
    setReactions((r) => [...r, { id, x, y, emoji, color }])
    const t = setTimeout(() => { timers.current.delete(t); setReactions((r) => r.filter((q) => q.id !== id)) }, 1900)
    timers.current.add(t)
  }
  const setLamp = (v) => { onRef.current = v; setOn(v) }

  // Channel + heartbeat
  useEffect(() => {
    let ch = null
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        ch = new BroadcastChannel(CHANNEL)
        chan.current = ch
        setChannelOk(true)
      }
    } catch { ch = null }
    const hb = () => send({ t: 'hb', x: pos.current.x, y: pos.current.y })
    if (ch) {
      ch.onmessage = (ev) => {
        const m = ev.data
        if (!m || typeof m !== 'object' || m.id === me.current.id || typeof m.id !== 'string') return
        const now = performance.now()
        if (m.t === 'bye') { peers.current.delete(m.id); return }
        let p = peers.current.get(m.id)
        if (!p) {
          p = { id: m.id, name: String(m.name || 'Guest').slice(0, 24), color: typeof m.color === 'string' ? m.color : '#888', x: null, y: null, tx: null, ty: null, seen: now }
          peers.current.set(m.id, p)
          hb() // introduce myself right away
        }
        p.seen = now
        if (typeof m.x === 'number' && typeof m.y === 'number') {
          if (p.x == null) { p.x = m.x; p.y = m.y }
          p.tx = m.x; p.ty = m.y
        } else if (m.t === 'move' || m.t === 'hb') { p.tx = null; p.ty = null; p.x = null; p.y = null }
        if (m.t === 'click') {
          setLamp(!!m.on)
          if (m.emoji) addReaction(p.tx ?? 0.5, p.ty ?? 0.5, m.emoji, p.color)
        }
      }
      hb()
    }
    const iv = setInterval(hb, 1000)
    const bye = () => send({ t: 'bye' })
    window.addEventListener('pagehide', bye)
    window.addEventListener('beforeunload', bye)
    return () => {
      clearInterval(iv)
      window.removeEventListener('pagehide', bye)
      window.removeEventListener('beforeunload', bye)
      bye()
      if (ch) { ch.onmessage = null; ch.close() }
      chan.current = null
      peers.current.clear()
      timers.current.forEach(clearTimeout)
      timers.current.clear()
    }
  }, [])

  // Animation loop: bots, peer smoothing, stale cleanup
  useEffect(() => {
    let raf = 0, last = performance.now()
    const tick = (now) => {
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      const { simulate: sim, botCount: n } = cfg.current
      const rm = reduced()
      const arr = bots.current
      if (!sim) arr.length = 0
      else {
        while (arr.length > Math.max(0, Math.min(8, Math.round(n)))) arr.pop()
        while (arr.length < Math.max(0, Math.min(8, Math.round(n)))) {
          const k = arr.length
          const nn = (me.current.n + 17 + k * 29) % (ADJ.length * ANI.length)
          const b = { id: 'bot' + k, name: makeName(nn), color: colorFor(nn + 5), x: rnd(0.1, 0.9), y: rnd(0.15, 0.9), bot: true }
          newSeg(b, now)
          arr.push(b)
        }
      }
      for (const b of arr) {
        const s = b.seg
        const k = Math.min(1, (now - s.t0) / s.dur)
        if (rm) { if (k >= 1) { b.x = s.x1; b.y = s.y1 } }
        else {
          const e = ease(k), u = 1 - e
          b.x = u * u * s.x0 + 2 * u * e * s.cx + e * e * s.x1
          b.y = u * u * s.y0 + 2 * u * e * s.cy + e * e * s.y1
        }
        if (k >= 1) {
          if (!b.done) {
            b.done = true
            b.pause = now + (b.near ? rnd(700, 1500) : rnd(150, 700))
            if (b.near && Math.random() < 0.5) {
              b.pendingClick = now + rnd(300, 600)
            }
          }
          if (b.pendingClick && now >= b.pendingClick) {
            b.pendingClick = 0
            setLamp(!onRef.current)
            addReaction(b.x, b.y, EMOJI[Math.floor(Math.random() * EMOJI.length)], b.color)
          }
          if (now >= b.pause) { b.x = s.x1; b.y = s.y1; newSeg(b, now) }
        }
      }
      const f = 1 - Math.exp(-dt * 16)
      for (const [id, p] of peers.current) {
        if (now - p.seen > 3000) { peers.current.delete(id); continue }
        if (p.tx != null && p.x != null) {
          if (rm) { p.x = p.tx; p.y = p.ty } else { p.x += (p.tx - p.x) * f; p.y += (p.ty - p.y) * f }
        }
      }
      setFrame((v) => (v + 1) % 1e6)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  const norm = (e) => {
    const r = stage.current.getBoundingClientRect()
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) }
  }
  const onMove = (e) => {
    const p = norm(e)
    pos.current = p
    const now = performance.now()
    if (now - lastSend.current < 40) return
    lastSend.current = now
    send({ t: 'move', x: p.x, y: p.y })
  }
  const onLeave = () => { pos.current = { x: null, y: null }; send({ t: 'move', x: null, y: null }) }
  const toggle = (e) => {
    const v = !onRef.current
    setLamp(v)
    const emoji = EMOJI[Math.floor(Math.random() * EMOJI.length)]
    const p = e && e.clientX != null && e.detail !== 0 ? norm(e) : { x: 0.5, y: 0.5 }
    addReaction(p.x, p.y, emoji, myColor)
    send({ t: 'click', on: v, x: p.x, y: p.y, emoji })
  }

  const others = [...peers.current.values(), ...bots.current].filter((o) => o.x != null && o.y != null)
  const people = [{ id: 'me', name: `${myName} (you)`, color: myColor }, ...peers.current.values(), ...bots.current]
  const shownAv = people.slice(0, 6)
  const glow = accent

  return (
    <div
      ref={stage}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      style={{
        position: 'relative', width: '100%', height: '100%', minHeight: 240, overflow: 'hidden', userSelect: 'none', touchAction: 'pan-y',
        background: on ? 'radial-gradient(circle at 50% 45%, #3a3224, #15171d 75%)' : 'radial-gradient(circle at 50% 45%, #232733, #12141a 75%)',
        transition: 'background 0.4s', font: '12px system-ui, sans-serif', color: '#fff', ...style,
      }}
    >
      <style>{`
        @keyframes pcfloat{0%{transform:translate(-50%,-50%) scale(.6);opacity:0}15%{opacity:1}100%{transform:translate(-50%,-190%) scale(1.2);opacity:0}}
        @keyframes pcfade{0%{opacity:0}20%{opacity:1}100%{opacity:0}}
      `}</style>

      <svg
        viewBox="0 0 200 280"
        role="button"
        tabIndex={0}
        aria-pressed={on}
        aria-label="Lamp, click to toggle"
        onClick={toggle}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle() } }}
        style={{ position: 'absolute', left: '50%', top: '52%', width: 'min(34%, 190px)', minWidth: 110, transform: 'translate(-50%,-50%)', cursor: 'pointer', overflow: 'visible', outlineOffset: 6 }}
      >
        <defs>
          <radialGradient id="pcglow" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor={glow} stopOpacity="0.55" />
            <stop offset="1" stopColor={glow} stopOpacity="0" />
          </radialGradient>
        </defs>
        <ellipse cx="100" cy="95" rx="190" ry="170" fill="url(#pcglow)" style={{ opacity: on ? 1 : 0, transition: 'opacity 0.35s' }} pointerEvents="none" />
        <ellipse cx="100" cy="262" rx="55" ry="9" fill="#000" opacity="0.35" />
        <rect x="94" y="120" width="12" height="132" rx="5" fill="#8b8f9c" />
        <path d="M60 262 Q60 246 100 246 Q140 246 140 262 Z" fill="#6c7080" />
        <path d="M38 118 L66 30 Q100 18 134 30 L162 118 Z" fill={on ? '#ffe9a6' : '#8d8a7c'} style={{ transition: 'fill 0.35s' }} />
        <path d="M66 30 Q100 18 134 30 L132 38 Q100 28 68 38 Z" fill="#fff" opacity={on ? 0.5 : 0.15} />
        <circle cx="100" cy="118" r="10" fill={on ? '#fff7d6' : '#555a66'} style={{ transition: 'fill 0.35s' }} />
      </svg>

      {others.map((o) => (
        <div key={o.id} style={{ position: 'absolute', left: `${o.x * 100}%`, top: `${o.y * 100}%`, pointerEvents: 'none', zIndex: 3 }}>
          <svg width="20" height="22" viewBox="0 0 20 22" style={{ display: 'block', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.6))' }}>
            <path d="M2 1 L2 17 L6.5 13 L10 20.5 L13 19 L9.6 12 L15.5 12 Z" fill={o.color} stroke="#fff" strokeWidth="1.3" strokeLinejoin="round" />
          </svg>
          {showNames && (
            <span style={{ position: 'absolute', left: 14, top: 18, whiteSpace: 'nowrap', background: o.color, color: '#fff', padding: '2px 8px', borderRadius: 999, font: '600 11px system-ui, sans-serif', boxShadow: '0 1px 4px rgba(0,0,0,0.4)' }}>
              {o.name}
            </span>
          )}
        </div>
      ))}

      {reactions.map((r) => (
        <span
          key={r.id}
          style={{
            position: 'absolute', left: `${r.x * 100}%`, top: `${r.y * 100}%`, fontSize: 26, pointerEvents: 'none', zIndex: 4,
            transform: 'translate(-50%,-50%)', animation: `${reduced() ? 'pcfade' : 'pcfloat'} 1.8s ease-out forwards`,
          }}
        >
          {r.emoji}
        </span>
      ))}

      <div style={{ position: 'absolute', left: 10, top: 10, display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px 5px 6px', borderRadius: 999, background: 'rgba(0,0,0,0.45)', zIndex: 5 }}>
        <div style={{ display: 'flex' }}>
          {shownAv.map((p, i) => (
            <span key={p.id} title={p.name} style={{ width: 22, height: 22, marginLeft: i ? -6 : 0, borderRadius: '50%', background: p.color, border: `2px solid ${p.id === 'me' ? accent : '#14161c'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>
              {p.name[0]}
            </span>
          ))}
          {people.length > 6 && <span style={{ marginLeft: 4, alignSelf: 'center', opacity: 0.8 }}>+{people.length - 6}</span>}
        </div>
        <span style={{ fontWeight: 600 }}>{people.length} here</span>
      </div>
      <div style={{ position: 'absolute', right: 10, bottom: 8, opacity: 0.6, zIndex: 5 }}>
        {channelOk ? 'Open this page in another tab to see live cursors' : 'Cross-tab presence unavailable'}
      </div>
    </div>
  )
}
