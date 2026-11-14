import { useEffect, useRef, useState } from 'react'

// A smart-home app on a phone. Swipe the room cards sideways (they snap),
// tap a room's frosted status card to switch it, and tap any accessory tile
// to turn it on (it lights up white with an orange icon) or off. "Edit"
// makes the tiles jiggle the way an iPhone home screen does, with a remove
// badge on each; "+" puts back what you removed. The phone scales to fit
// whatever box it is in.

const W = 390 // the phone screen, in CSS px (an iPhone's width)
const H = 844

const ICONS = {
  ac: (
    <>
      <rect x="2.5" y="6" width="19" height="7" rx="1.5" />
      <path d="M5 10.5h14M7 16v2M12 16v3M17 16v2" />
    </>
  ),
  home: <path d="M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5h-5v5H5a1 1 0 0 1-1-1z" fill="currentColor" stroke="none" />,
  lamp: <path d="M8 4h8l3 7H5zM12 11v7M8.5 20h7" />,
  cloud: <path d="M7.5 18.5a4 4 0 0 1-.4-8A5.5 5.5 0 0 1 17.6 9a4.3 4.3 0 0 1-.6 9.5z" fill="currentColor" stroke="none" />,
  bookmark: <path d="M7 3.5h10v17l-5-3.6-5 3.6z" fill="currentColor" stroke="none" />,
  camera: <path d="M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5h-5v5H5a1 1 0 0 1-1-1z" fill="currentColor" stroke="none" />,
}
const Icon = ({ name, size = 22, color = 'currentColor' }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ color }} aria-hidden="true">
    {ICONS[name]}
  </svg>
)

const ACCESSORIES = [
  { id: 1, room: 'Living Room', name: 'Air Conditioner', icon: 'ac', on: true },
  { id: 2, room: 'Living Room', name: 'LG TV', icon: 'home', on: false },
  { id: 3, room: "Eythan's Room", name: 'Romantic Light', icon: 'lamp', on: false },
  { id: 4, room: 'Living Room', name: 'Netflix App', icon: 'cloud', on: true },
  { id: 5, room: "Eythan's Room", name: 'Amazon Prime App', icon: 'cloud', on: false },
  { id: 6, room: "Eythan's Room", name: 'Air Conditioner', icon: 'ac', on: false },
  { id: 7, room: 'To Do List', name: 'Reminders', icon: 'bookmark', on: true, always: true },
]

// An illustrated living room, so the card works without a photo: daylight
// window, wood stair, a low sofa, a round table and a pendant light.
function RoomArt({ variant = 0 }) {
  const warm = variant % 2 === 0
  return (
    <svg viewBox="0 0 360 230" preserveAspectRatio="xMidYMid slice" width="100%" height="100%" aria-hidden="true">
      <defs>
        <linearGradient id={`wall${variant}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={warm ? '#e9e2d6' : '#d8dde3'} />
          <stop offset="1" stopColor={warm ? '#b9ab97' : '#9aa3ad'} />
        </linearGradient>
        <linearGradient id={`win${variant}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#dff1ff" />
          <stop offset="1" stopColor="#9cc7a4" />
        </linearGradient>
        <linearGradient id={`floor${variant}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={warm ? '#7c5b3c' : '#5d5a57'} />
          <stop offset="1" stopColor={warm ? '#3e2b1c' : '#2a2928'} />
        </linearGradient>
        <radialGradient id={`glow${variant}`} cx="0.3" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#fff6e0" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fff6e0" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="360" height="230" fill={`url(#wall${variant})`} />
      {/* ceiling cove light */}
      <rect x="0" y="0" width="360" height="14" fill="#f4efe6" />
      <rect x="0" y="14" width="360" height="3" fill="#fff" opacity="0.9" />
      {/* window wall */}
      <rect x="18" y="34" width="120" height="112" rx="2" fill={`url(#win${variant})`} />
      <path d="M58 34v112M98 34v112M18 90h120" stroke="#5c5a55" strokeWidth="3" />
      {/* stair */}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <rect key={i} x={250 + i * 14} y={150 - i * 22} width="70" height="8" fill={warm ? '#b8834d' : '#8b8f94'} />
      ))}
      <path d="M248 158 L336 38" stroke="#3b3b3b" strokeWidth="2" />
      {/* pendant */}
      <path d="M190 17v40" stroke="#333" strokeWidth="1.5" />
      <circle cx="190" cy="64" r="11" fill="#f7e7c4" />
      <circle cx="190" cy="64" r="26" fill="#fff3d0" opacity="0.25" />
      {/* floor */}
      <path d="M0 160 H360 V230 H0z" fill={`url(#floor${variant})`} />
      <ellipse cx="200" cy="200" rx="80" ry="14" fill="#000" opacity="0.25" />
      {/* sofa */}
      <path d="M30 150 q0-14 14-14 h150 q14 0 14 14 v30 h-178z" fill={warm ? '#cfc6b8' : '#b9b6b1'} />
      <rect x="22" y="160" width="196" height="34" rx="10" fill={warm ? '#ddd4c6' : '#c9c6c1'} />
      <rect x="40" y="146" width="40" height="22" rx="6" fill="#efe9df" />
      {/* round table */}
      <ellipse cx="236" cy="196" rx="34" ry="8" fill="#3a2a1d" />
      <rect x="232" y="198" width="8" height="16" fill="#2a1d14" />
      <rect width="360" height="230" fill={`url(#glow${variant})`} />
    </svg>
  )
}

function Tile({ a, edit, onToggle, onRemove, index }) {
  const lit = a.on
  return (
    <div style={{ position: 'relative', flex: 'none', width: 94, height: 108 }}>
      <button
        type="button"
        onClick={() => !edit && onToggle(a.id)}
        aria-pressed={lit}
        aria-label={`${a.room} ${a.name}: ${a.always ? 'always on' : lit ? 'on' : 'off'}`}
        style={{
          width: '100%',
          height: '100%',
          padding: '12px 10px 10px',
          border: 'none',
          borderRadius: 6,
          textAlign: 'left',
          cursor: edit ? 'grab' : 'pointer',
          display: 'flex',
          flexDirection: 'column',
          background: lit && !a.always ? '#fff' : '#3a3a3c',
          color: lit && !a.always ? '#1c1c1e' : '#fff',
          transition: 'background .25s, color .25s, transform .15s',
          animation: edit ? `sh-jiggle .28s ${index % 2 ? '-.14s' : '0s'} infinite alternate ease-in-out` : 'none',
          font: 'inherit',
        }}
      >
        <Icon name={a.icon} size={24} color={lit && !a.always ? '#f5a524' : '#2f8cff'} />
        <span style={{ marginTop: 10, font: '600 11px/1.25 inherit', fontFamily: 'inherit', fontWeight: 600, fontSize: 11, lineHeight: 1.25 }}>
          {a.room}
          <br />
          {a.name}
        </span>
        <span style={{ marginTop: 'auto', fontSize: 10.5, fontWeight: 500, opacity: lit && !a.always ? 0.7 : 0.45 }}>{a.always ? 'Always On' : lit ? 'On' : 'Off'}</span>
      </button>
      {edit && (
        <button
          type="button"
          onClick={() => onRemove(a.id)}
          aria-label={`Remove ${a.room} ${a.name}`}
          style={{ position: 'absolute', top: -7, left: -7, width: 20, height: 20, borderRadius: '50%', border: 'none', background: '#8e8e93', color: '#1c1c1e', font: '700 14px/20px system-ui', padding: 0, cursor: 'pointer' }}
        >
          −
        </button>
      )}
    </div>
  )
}

// Side scrolling for a mouse as well as touch: drag the row sideways (it
// flicks on with the speed you let go at, then snaps), or turn the wheel.
// A drag doesn't count as a tap on whatever it started over.
function sideScroll(el, scale) {
  if (!el) return
  let down = null
  let last = 0
  let v = 0
  let moved = false
  let raf = 0
  const snap = el.style.scrollSnapType
  const onDown = (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return
    cancelAnimationFrame(raf)
    down = { x: e.clientX, left: el.scrollLeft, t: performance.now() }
    last = e.clientX
    v = 0
    moved = false
  }
  const onMove = (e) => {
    if (!down) return
    const k = scale.current || 1
    if (!moved && Math.abs(e.clientX - down.x) > 5) {
      moved = true
      el.style.scrollSnapType = 'none'
      el.style.cursor = 'grabbing'
      el.setPointerCapture(e.pointerId)
    }
    if (!moved) return
    const now = performance.now()
    v = (-(e.clientX - last) / k) / Math.max(1, now - down.t)
    down.t = now
    last = e.clientX
    el.scrollLeft = down.left - (e.clientX - down.x) / k
  }
  const onUp = () => {
    if (!down) return
    down = null
    el.style.cursor = ''
    if (!moved) return
    // coast, then hand back to the snap
    const coast = () => {
      v *= 0.92
      el.scrollLeft += v * 16
      if (Math.abs(v) > 0.05) raf = requestAnimationFrame(coast)
      else el.style.scrollSnapType = snap
    }
    raf = requestAnimationFrame(coast)
  }
  const onClick = (e) => {
    if (moved) {
      e.stopPropagation()
      e.preventDefault()
      moved = false
    }
  }
  const onWheel = (e) => {
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return
    const max = el.scrollWidth - el.clientWidth
    const atEnd = (e.deltaY > 0 && el.scrollLeft >= max - 1) || (e.deltaY < 0 && el.scrollLeft <= 0)
    if (max <= 0 || atEnd || !e.shiftKey) return
    e.preventDefault()
    el.scrollBy({ left: e.deltaY, behavior: 'smooth' })
  }
  el.addEventListener('pointerdown', onDown)
  el.addEventListener('pointermove', onMove)
  el.addEventListener('pointerup', onUp)
  el.addEventListener('pointercancel', onUp)
  el.addEventListener('click', onClick, true)
  el.addEventListener('wheel', onWheel, { passive: false })
  return () => {
    cancelAnimationFrame(raf)
    el.removeEventListener('pointerdown', onDown)
    el.removeEventListener('pointermove', onMove)
    el.removeEventListener('pointerup', onUp)
    el.removeEventListener('pointercancel', onUp)
    el.removeEventListener('click', onClick, true)
    el.removeEventListener('wheel', onWheel)
  }
}

export default function SmartHomeApp({
  home = "Eythan's Home",
  accent = '#2f8cff',
  photo = '',
  frame = true,
  style,
}) {
  const box = useRef()
  const [scale, setScale] = useState(1)
  const scaleRef = useRef(1)
  scaleRef.current = scale
  const roomRow = useRef()
  const tileRow = useRef()
  useEffect(() => {
    const a = sideScroll(roomRow.current, scaleRef)
    const b = sideScroll(tileRow.current, scaleRef)
    return () => { a?.(); b?.() }
  }, [])
  const [items, setItems] = useState(ACCESSORIES)
  const [edit, setEdit] = useState(false)
  const [rooms, setRooms] = useState([
    { id: 'door', name: 'Main Door Cameras', on: true },
    { id: 'ac', name: 'Living Room Air Conditioner', on: true },
    { id: 'light', name: 'Hallway Lights', on: false },
  ])
  const now = new Date()
  const day = now.toLocaleDateString('en-GB', { weekday: 'short' }).toUpperCase()
  const month = now.toLocaleDateString('en-GB', { month: 'long' }).toUpperCase()
  const clock = now.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' })

  // fit the phone into the box
  useEffect(() => {
    const ro = new ResizeObserver(([e]) => {
      const fw = frame ? W + 28 : W
      const fh = frame ? H + 28 : H
      setScale(Math.min(1.2, (e.contentRect.width - 24) / fw, (e.contentRect.height - 24) / fh))
    })
    ro.observe(box.current)
    return () => ro.disconnect()
  }, [frame])

  const toggle = (id) => setItems((xs) => xs.map((x) => (x.id === id && !x.always ? { ...x, on: !x.on } : x)))
  const remove = (id) => setItems((xs) => xs.filter((x) => x.id !== id))
  const restore = () => {
    setItems((xs) => [...xs, ...ACCESSORIES.filter((a) => !xs.some((x) => x.id === a.id))].sort((p, q) => p.id - q.id))
    setEdit(false)
  }

  const screen = (
    <div
      style={{
        position: 'relative',
        width: W,
        height: H,
        overflow: 'hidden',
        borderRadius: frame ? 46 : 0,
        background: 'linear-gradient(#1f1f21, #161617 60%, #111112)',
        color: '#fff',
        fontFamily: "-apple-system, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif",
      }}
    >
      <style>{`
        @keyframes sh-jiggle { from { transform: rotate(-1.6deg) } to { transform: rotate(1.6deg) } }
        .sh-scroll { scrollbar-width: none; } .sh-drag { cursor: grab; user-select: none; -webkit-user-drag: none; } .sh-drag img { -webkit-user-drag: none; pointer-events: none; } .sh-scroll::-webkit-scrollbar { display: none; }
      `}</style>
      {/* status bar and Dynamic Island */}
      <div style={{ height: 54, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 30px 0 36px', fontSize: 16, fontWeight: 600 }}>
        <span>{clock}</span>
        {frame && <span style={{ position: 'absolute', left: '50%', top: 11, width: 122, height: 35, marginLeft: -61, borderRadius: 20, background: '#000' }} />}
        <span style={{ display: 'flex', gap: 6, alignItems: 'center' }} aria-hidden="true">
          <svg width="18" height="11" viewBox="0 0 18 11" fill="#fff">
            <rect x="0" y="7" width="3" height="4" rx="1" />
            <rect x="5" y="5" width="3" height="6" rx="1" />
            <rect x="10" y="2.5" width="3" height="8.5" rx="1" />
            <rect x="15" y="0" width="3" height="11" rx="1" />
          </svg>
          <svg width="16" height="11" viewBox="0 0 16 11" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round">
            <path d="M1.5 4a9.5 9.5 0 0 1 13 0M4 6.6a6 6 0 0 1 8 0" />
            <circle cx="8" cy="9.3" r="1" fill="#fff" stroke="none" />
          </svg>
          <svg width="26" height="12" viewBox="0 0 26 12">
            <rect x="0.5" y="0.5" width="22" height="11" rx="3.5" fill="none" stroke="#fff" opacity=".45" />
            <rect x="2.5" y="2.5" width="16" height="7" rx="2" fill="#fff" />
            <rect x="23.5" y="4" width="2" height="4" rx="1" fill="#fff" opacity=".45" />
          </svg>
        </span>
      </div>

      <div className="sh-scroll" style={{ position: 'absolute', top: 54, bottom: 0, left: 0, right: 0, overflowY: 'auto', paddingBottom: 40 }}>
        <div style={{ padding: '14px 22px 0' }}>
          <button type="button" aria-label="Menu" style={{ border: 'none', background: 'none', padding: 4, marginLeft: -4, cursor: 'pointer' }}>
            <svg width="24" height="18" viewBox="0 0 24 18" stroke="#fff" strokeWidth="2.2" strokeLinecap="round">
              <path d="M2 2h20M2 9h20M2 16h13" />
            </svg>
          </button>
          <div style={{ marginTop: 30, fontSize: 12.5, fontWeight: 600, letterSpacing: '0.02em', opacity: 0.85 }}>
            {now.getDate()} {day}, {month}
          </div>
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 }}>
            <h1 style={{ margin: 0, fontSize: 24, lineHeight: 1.2, fontWeight: 300 }}>
              Welcome Back,
              <br />
              <b style={{ fontWeight: 700 }}>{home}</b>
            </h1>
            <div style={{ display: 'flex', gap: 10, paddingBottom: 4 }}>
              <button
                type="button"
                onClick={() => setEdit((e) => !e)}
                aria-pressed={edit}
                style={{ height: 28, padding: '0 15px', borderRadius: 14, border: 'none', background: edit ? accent : '#2c2c2e', color: '#fff', fontSize: 13, cursor: 'pointer' }}
              >
                {edit ? 'Done' : 'Edit'}
              </button>
              <button type="button" onClick={restore} aria-label="Add accessories" style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', background: '#2c2c2e', color: '#fff', fontSize: 18, lineHeight: '28px', padding: 0, cursor: 'pointer' }}>
                +
              </button>
            </div>
          </div>
        </div>

        {/* rooms: a snapping horizontal carousel */}
        <div ref={roomRow} className="sh-scroll sh-drag" style={{ marginTop: 26, display: 'flex', gap: 10, overflowX: 'auto', scrollSnapType: 'x mandatory', padding: '0 22px', scrollPaddingLeft: 22 }}>
          {rooms.map((r, i) => (
            <div key={r.id} style={{ position: 'relative', flex: 'none', width: 300, height: 232, scrollSnapAlign: 'start' }}>
              <div style={{ position: 'absolute', inset: '0 0 32px 0', overflow: 'hidden', borderRadius: 4 }}>
                {photo && i === 0 ? <img src={photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <RoomArt variant={i} />}
              </div>
              <button
                type="button"
                onClick={() => setRooms((rs) => rs.map((x) => (x.id === r.id ? { ...x, on: !x.on } : x)))}
                aria-pressed={r.on}
                style={{
                  position: 'absolute',
                  left: 26,
                  right: 0,
                  bottom: 0,
                  height: 78,
                  padding: '10px 12px',
                  border: 'none',
                  borderRadius: 6,
                  textAlign: 'left',
                  color: '#fff',
                  cursor: 'pointer',
                  background: 'rgba(40,40,42,.55)',
                  backdropFilter: 'blur(14px) saturate(140%)',
                  WebkitBackdropFilter: 'blur(14px) saturate(140%)',
                  boxShadow: 'inset 0 0 0 0.5px rgba(255,255,255,.18)',
                  font: 'inherit',
                }}
              >
                <Icon name={i === 1 ? 'ac' : 'home'} size={20} color={r.on ? accent : '#8e8e93'} />
                <div style={{ marginTop: 6, fontSize: 11.5, fontWeight: 600 }}>{r.name}</div>
                <div style={{ fontSize: 10.5, opacity: 0.7 }}>{r.on ? 'On' : 'Off'}</div>
              </button>
            </div>
          ))}
          <div style={{ flex: 'none', width: 12 }} />
        </div>

        <div style={{ marginTop: 34, padding: '0 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 500 }}>Favorite Accessories</h2>
          <button type="button" style={{ border: 'none', background: 'none', color: accent, fontSize: 14, fontWeight: 600, padding: 0, cursor: 'pointer' }}>
            See all
          </button>
        </div>

        {/* two rows of tiles that scroll sideways together */}
        <div ref={tileRow} className="sh-scroll sh-drag" style={{ marginTop: 16, overflowX: 'auto', padding: '8px 22px 8px' }}>
          <div style={{ display: 'grid', gridTemplateRows: 'repeat(2, 108px)', gridAutoFlow: 'column', gridAutoColumns: 94, gap: 9, width: 'max-content' }}>
            {items.map((a, i) => (
              <Tile key={a.id} a={a} index={i} edit={edit} onToggle={toggle} onRemove={remove} />
            ))}
          </div>
        </div>
      </div>

      {/* home indicator */}
      <div style={{ position: 'absolute', left: '50%', bottom: 8, width: 140, height: 5, marginLeft: -70, borderRadius: 3, background: '#fff', opacity: 0.85 }} />
    </div>
  )

  return (
    <div ref={box} style={{ position: 'relative', width: '100%', height: '100%', display: 'grid', placeItems: 'center', overflow: 'hidden', background: 'radial-gradient(ellipse at 50% 30%, #3a3a3e, #121214 70%)', ...style }}>
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: `translate(-50%, -50%) scale(${scale})`, transformOrigin: 'center' }}>
        {frame ? (
          // the phone body: a titanium band round a black bezel
          <div style={{ padding: 12, borderRadius: 58, background: 'linear-gradient(145deg, #5b5b60, #2a2a2e 40%, #4a4a4f)', boxShadow: '0 40px 80px rgba(0,0,0,.55), inset 0 0 0 2px #1a1a1c' }}>
            <div style={{ padding: 2, borderRadius: 48, background: '#000' }}>{screen}</div>
          </div>
        ) : (
          screen
        )}
      </div>
    </div>
  )
}
