import { useEffect, useRef, useState } from 'react'

// A messaging app on a phone, as a click-through prototype. Chats lists the
// conversations (unread badges clear when you open one); a conversation is a
// real chat: type and send, watch the typing dots, get a reply a moment later,
// double-tap a bubble to react with a heart, or hit the arrow on a bubble to
// reply to it. Contacts search and open a person's Profile (message, mute,
// block), and Settings has toggles and a bubble-colour picker that restyles
// every chat. Four tabs, with the conversation and profile pushed on top.
// The phone scales to fit whatever box it is in.

const W = 390 // the phone screen, in CSS px (an iPhone's width)
const H = 844
const INK = '#16181d'
const MUTED = '#8a8f9c'
const BG = '#f4f5f8'

const PEOPLE = {
  ava: { name: 'Ava Chen', hue: 200, status: 'Online', bio: 'Designer · coffee first' },
  leo: { name: 'Leo Martins', hue: 28, status: 'Last seen 12 min ago', bio: 'Cycling every weekend' },
  mia: { name: 'Mia Okafor', hue: 320, status: 'Online', bio: 'Product at a small startup' },
  sam: { name: 'Sam Patel', hue: 140, status: 'Last seen yesterday', bio: 'Always on the move' },
  zoe: { name: 'Zoe Laurent', hue: 260, status: 'Online', bio: 'Photos, trains, repeat' },
}

const REPLIES = ['Haha, yes!', 'Sounds good to me 👍', 'Give me five minutes', 'Love that idea', 'Can we do tomorrow instead?', 'On my way!', 'Send me the details', 'Okay, perfect']

const START = {
  ava: [
    { id: 1, me: false, text: 'Are we still on for lunch?', t: '09:41' },
    { id: 2, me: true, text: 'Yes! 12:30 at the usual place?', t: '09:42' },
    { id: 3, me: false, text: 'Perfect, I will book a table 🍜', t: '09:43' },
  ],
  leo: [{ id: 1, me: false, text: 'Did you see the route for Sunday?', t: 'Yesterday' }],
  mia: [
    { id: 1, me: true, text: 'Sent you the deck', t: 'Yesterday' },
    { id: 2, me: false, text: 'Got it, thanks! Reading now.', t: 'Yesterday' },
  ],
  sam: [{ id: 1, me: false, text: 'Happy birthday!! 🎂', t: 'Mon' }],
  zoe: [{ id: 1, me: false, text: 'Look at this view', t: 'Sun' }],
}
const UNREAD = { ava: 1, leo: 2, mia: 0, sam: 0, zoe: 3 }
const ORDER = ['ava', 'leo', 'mia', 'sam', 'zoe']
const NAV = [
  ['chats', 'chat', 'Chats'],
  ['contacts', 'people', 'Contacts'],
  ['profile', 'user', 'Me'],
  ['settings', 'gear', 'Settings'],
]

const ICONS = {
  chat: 'M4 5h16v11H9l-5 4z',
  people: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20a6.500 6.500 0 0 1 13 0M16 4.500a3.500 3.500 0 0 1 0 6.500M18 14a6 6 0 0 1 3.500 6',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 20a8 8 0 0 1 16 0',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12l2-1.500-2-3.500-2.300.8a7 7 0 0 0-1.500-.9L14.800 4h-4l-.4 2.400a7 7 0 0 0-1.500.9L6.600 6.500l-2 3.500L6.500 12l-1.900 2 2 3.500 2.300-.8a7 7 0 0 0 1.500.9l.4 2.400h4l.4-2.400a7 7 0 0 0 1.500-.9l2.300.8 2-3.500z',
  back: 'M15 5l-7 7 7 7',
  send: 'M4 12l16-8-6 16-3-7z',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-5-5',
  reply: 'M10 7L4 12l6 5M4 12h10a6 6 0 0 1 6 6',
  x: 'M6 6l12 12M18 6L6 18',
  bell: 'M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4',
  block: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM5.600 5.600l12.800 12.800',
}

function Icon({ name, size = 22, color = 'currentColor', w = 1.9 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  )
}

const iconBtn = { display: 'grid', placeItems: 'center', border: 'none', borderRadius: '50%', cursor: 'pointer', padding: 0, background: 'transparent', color: INK }

function Avatar({ p, size = 48, online }) {
  return (
    <span style={{ position: 'relative', width: size, height: size, borderRadius: '50%', display: 'grid', placeItems: 'center', flex: 'none', background: `hsl(${p.hue} 75% 88%)`, color: `hsl(${p.hue} 55% 30%)`, fontWeight: 700, fontSize: size * 0.36 }}>
      {p.name.split(' ').map((s) => s[0]).join('')}
      {online && <i style={{ position: 'absolute', right: 0, bottom: 0, width: size * 0.26, height: size * 0.26, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 0 2px #fff' }} />}
    </span>
  )
}

function StatusBar({ frame }) {
  const clock = new Date().toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' })
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20, height: 54, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 30px 0 36px', fontSize: 16, fontWeight: 600, color: INK, pointerEvents: 'none' }}>
      <span>{clock}</span>
      {frame && <span style={{ position: 'absolute', left: '50%', top: 11, width: 122, height: 35, marginLeft: -61, borderRadius: 20, background: '#000' }} />}
      <span style={{ display: 'flex', gap: 6, alignItems: 'center' }} aria-hidden="true">
        <svg width="18" height="11" viewBox="0 0 18 11" fill={INK}>
          <rect x="0" y="7" width="3" height="4" rx="1" />
          <rect x="5" y="5" width="3" height="6" rx="1" />
          <rect x="10" y="2.5" width="3" height="8.5" rx="1" />
          <rect x="15" y="0" width="3" height="11" rx="1" />
        </svg>
        <svg width="26" height="12" viewBox="0 0 26 12">
          <rect x="0.5" y="0.5" width="22" height="11" rx="3.5" fill="none" stroke={INK} opacity=".45" />
          <rect x="2.5" y="2.5" width="16" height="7" rx="2" fill={INK} />
          <rect x="23.5" y="4" width="2" height="4" rx="1" fill={INK} opacity=".45" />
        </svg>
      </span>
    </div>
  )
}

// ---------------------------------------------------------------- app

export default function MessengerApp({ name = 'Chatter', accent = '#2f7cf6', startScreen = 'chats', frame = true, style }) {
  const box = useRef()
  const toastTimer = useRef()
  const replyTimer = useRef()
  const endRef = useRef()
  const nextId = useRef(100)
  const lastTap = useRef({ id: 0, at: 0 })
  const [scale, setScale] = useState(1)
  const [tab, setTab] = useState(startScreen === 'conversation' ? 'chats' : startScreen)
  const [stack, setStack] = useState(startScreen === 'conversation' ? [{ id: 'chat', who: 'ava' }] : [])
  const [dir, setDir] = useState(1)
  const [msgs, setMsgs] = useState(START)
  const [unread, setUnread] = useState(UNREAD)
  const [hearts, setHearts] = useState({})
  const [typing, setTyping] = useState(null)
  const [draft, setDraft] = useState('')
  const [replyTo, setReplyTo] = useState(null)
  const [query, setQuery] = useState('')
  const [muted, setMuted] = useState({})
  const [blocked, setBlocked] = useState({})
  const [prefs, setPrefs] = useState({ read: true, sounds: true, dark: false })
  const [bubble, setBubble] = useState(accent)
  const [toast, setToast] = useState('')

  useEffect(() => {
    setTab(startScreen === 'conversation' ? 'chats' : startScreen)
    setStack(startScreen === 'conversation' ? [{ id: 'chat', who: 'ava' }] : [])
  }, [startScreen])
  useEffect(() => setBubble(accent), [accent])

  useEffect(() => {
    const ro = new ResizeObserver(([e]) => {
      const fw = frame ? W + 28 : W
      const fh = frame ? H + 28 : H
      setScale(Math.min(1.2, (e.contentRect.width - 24) / fw, (e.contentRect.height - 24) / fh))
    })
    ro.observe(box.current)
    return () => ro.disconnect()
  }, [frame])

  useEffect(
    () => () => {
      clearTimeout(toastTimer.current)
      clearTimeout(replyTimer.current)
    },
    [],
  )
  const say = (t) => {
    setToast(t)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 1900)
  }

  const top = stack[stack.length - 1]
  const push = (s) => (setDir(1), setStack((a) => [...a, s]))
  const pop = () => (setDir(-1), setStack((a) => a.slice(0, -1)))
  const go = (t) => (setDir(NAV.findIndex((n) => n[0] === t) >= NAV.findIndex((n) => n[0] === tab) ? 1 : -1), setTab(t), setStack([]))
  const open = (who) => (setUnread((u) => ({ ...u, [who]: 0 })), setReplyTo(null), setDraft(''), push({ id: 'chat', who }))

  // keep the newest message in view
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [msgs, typing, top?.who])

  const now = () => new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

  const send = (e) => {
    e.preventDefault()
    const text = draft.trim()
    if (!text || !top?.who || blocked[top.who]) return
    const who = top.who
    const m = { id: nextId.current++, me: true, text, t: now(), quote: replyTo }
    setMsgs((x) => ({ ...x, [who]: [...x[who], m] }))
    setDraft('')
    setReplyTo(null)
    clearTimeout(replyTimer.current)
    replyTimer.current = setTimeout(() => {
      setTyping(who)
      replyTimer.current = setTimeout(() => {
        setTyping(null)
        setMsgs((x) => ({ ...x, [who]: [...x[who], { id: nextId.current++, me: false, text: REPLIES[Math.floor(Math.random() * REPLIES.length)], t: now() }] }))
      }, 1500)
    }, 600)
  }

  // double-tap a bubble to heart it
  const tapBubble = (id) => {
    const n = Date.now()
    if (lastTap.current.id === id && n - lastTap.current.at < 320) setHearts((h) => ({ ...h, [id]: !h[id] }))
    lastTap.current = { id, at: n }
  }

  const header = (title, back, right) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px 6px', minHeight: 48 }}>
      {back && (
        <button type="button" onClick={back} aria-label="Back" style={{ ...iconBtn, width: 38, height: 38, background: '#fff' }}>
          <Icon name="back" size={20} />
        </button>
      )}
      <h1 style={{ margin: 0, flex: 1, fontSize: back ? 18 : 28, fontWeight: 800, letterSpacing: '-0.02em', marginLeft: 4 }}>{title}</h1>
      {right}
    </div>
  )

  const toggle = (on, set, label) => (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => set(!on)} style={{ width: 48, height: 28, borderRadius: 14, border: 'none', padding: 3, background: on ? accent : '#cdd2dc', cursor: 'pointer', transition: 'background .2s', flex: 'none' }}>
      <span style={{ display: 'block', width: 22, height: 22, borderRadius: '50%', background: '#fff', transform: `translateX(${on ? 20 : 0}px)`, transition: 'transform .2s' }} />
    </button>
  )

  const personRow = (id, onClick, sub) => (
    <button key={id} type="button" onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '11px 14px', border: 'none', borderRadius: 18, background: '#fff', font: 'inherit', textAlign: 'left', cursor: 'pointer', color: INK }}>
      <Avatar p={PEOPLE[id]} online={PEOPLE[id].status === 'Online'} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 15, fontWeight: 700 }}>{PEOPLE[id].name}</span>
        <span style={{ display: 'block', fontSize: 13, color: MUTED, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</span>
      </span>
    </button>
  )

  // ---- screens
  let body
  let tabbed = true
  if (top?.id === 'chat') {
    tabbed = false
    const p = PEOPLE[top.who]
    const list = msgs[top.who]
    body = (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', paddingTop: 54 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 14px 10px', background: '#fff', boxShadow: '0 1px 0 #eceff4' }}>
          <button type="button" onClick={pop} aria-label="Back" style={{ ...iconBtn, width: 36, height: 36 }}>
            <Icon name="back" size={22} />
          </button>
          <button type="button" onClick={() => push({ id: 'person', who: top.who })} style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, border: 'none', background: 'none', padding: 0, font: 'inherit', textAlign: 'left', cursor: 'pointer', color: INK }}>
            <Avatar p={p} size={38} online={p.status === 'Online'} />
            <span>
              <span style={{ display: 'block', fontSize: 15, fontWeight: 700 }}>{p.name}</span>
              <span style={{ display: 'block', fontSize: 11.5, color: typing === top.who ? accent : MUTED }}>{typing === top.who ? 'typing…' : p.status}</span>
            </span>
          </button>
        </div>
        <div className="ms-scroll" style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 6px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {list.map((m) => (
            <div key={m.id} style={{ alignSelf: m.me ? 'flex-end' : 'flex-start', maxWidth: '78%', display: 'flex', alignItems: 'center', gap: 6, flexDirection: m.me ? 'row-reverse' : 'row', animation: m.id >= 100 ? 'ms-pop .25s ease' : 'none' }}>
              <div onClick={() => tapBubble(m.id)} style={{ position: 'relative', padding: '9px 13px', borderRadius: 20, borderBottomRightRadius: m.me ? 6 : 20, borderBottomLeftRadius: m.me ? 20 : 6, background: m.me ? bubble : '#fff', color: m.me ? '#fff' : INK, fontSize: 15, lineHeight: 1.35, cursor: 'pointer', userSelect: 'none' }}>
                {m.quote && <div style={{ fontSize: 12, padding: '3px 8px', marginBottom: 5, borderRadius: 8, borderLeft: `3px solid ${m.me ? '#ffffffaa' : accent}`, background: m.me ? 'rgba(255,255,255,.18)' : '#f0f2f6', opacity: 0.9 }}>{m.quote}</div>}
                {m.text}
                <div style={{ fontSize: 10.5, opacity: 0.65, marginTop: 3, textAlign: m.me ? 'right' : 'left' }}>{m.t}{m.me && prefs.read ? ' ✓✓' : ''}</div>
                {hearts[m.id] && <span style={{ position: 'absolute', [m.me ? 'left' : 'right']: -8, bottom: -10, fontSize: 16, animation: 'ms-pop .3s cubic-bezier(.2,1.5,.4,1)' }}>❤️</span>}
              </div>
              <button type="button" onClick={() => setReplyTo(m.text)} aria-label="Reply to this message" style={{ ...iconBtn, width: 26, height: 26, color: MUTED, flex: 'none' }}>
                <Icon name="reply" size={15} />
              </button>
            </div>
          ))}
          {typing === top.who && (
            <div style={{ alignSelf: 'flex-start', padding: '12px 14px', borderRadius: 20, borderBottomLeftRadius: 6, background: '#fff', display: 'flex', gap: 4 }} aria-label="typing">
              {[0, 1, 2].map((i) => (
                <i key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: MUTED, animation: `ms-dot 1s ${i * 0.15}s infinite` }} />
              ))}
            </div>
          )}
          <div ref={endRef} />
        </div>
        {blocked[top.who] ? (
          <div style={{ padding: '14px 16px 36px', textAlign: 'center', fontSize: 13, color: MUTED, background: '#fff' }}>You blocked this contact. Unblock them from their profile to chat.</div>
        ) : (
          <form onSubmit={send} style={{ background: '#fff', padding: '8px 12px 30px', boxShadow: '0 -1px 0 #eceff4' }}>
            {replyTo && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', marginBottom: 8, borderRadius: 12, background: '#f0f2f6', borderLeft: `3px solid ${accent}`, fontSize: 12.5 }}>
                <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Replying to: {replyTo}</span>
                <button type="button" onClick={() => setReplyTo(null)} aria-label="Cancel reply" style={{ ...iconBtn, width: 22, height: 22 }}>
                  <Icon name="x" size={14} />
                </button>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Message" aria-label="Message" style={{ flex: 1, minWidth: 0, height: 44, padding: '0 16px', borderRadius: 22, border: 'none', outline: 'none', background: '#f0f2f6', font: 'inherit', fontSize: 15, color: INK }} />
              <button type="submit" aria-label="Send" disabled={!draft.trim()} style={{ ...iconBtn, width: 44, height: 44, background: draft.trim() ? accent : '#cdd2dc', color: '#fff', cursor: draft.trim() ? 'pointer' : 'default', transition: 'background .2s' }}>
                <Icon name="send" size={20} />
              </button>
            </div>
          </form>
        )}
      </div>
    )
  } else if (top?.id === 'person' || (tab === 'profile' && !top)) {
    const mine = !top
    const id = top?.who
    const p = mine ? { name: 'Alex Rivera', hue: 220, status: 'Online', bio: 'Building things, one message at a time' } : PEOPLE[id]
    tabbed = mine
    body = (
      <>
        {header(mine ? 'Me' : 'Profile', mine ? null : pop)}
        <div style={{ textAlign: 'center', padding: '14px 20px 18px' }}>
          <Avatar p={p} size={92} online={p.status === 'Online'} />
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 12 }}>{p.name}</div>
          <div style={{ fontSize: 13.5, color: MUTED, marginTop: 4 }}>{p.bio}</div>
        </div>
        {mine ? (
          <div style={{ margin: '0 20px', padding: '4px 16px', background: '#fff', borderRadius: 20 }}>
            {[['Phone', '+1 555 0142'], ['Username', `@alex.${name.toLowerCase()}`], ['Status', 'Available']].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '13px 0', borderBottom: '1px solid #eef1f5', fontSize: 14 }}>
                <span style={{ color: MUTED }}>{k}</span>
                <span style={{ fontWeight: 600 }}>{v}</span>
              </div>
            ))}
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 10, padding: '0 20px' }}>
              <button type="button" onClick={() => (setDir(1), setStack([{ id: 'chat', who: id }]), setUnread((u) => ({ ...u, [id]: 0 })))} disabled={blocked[id]} style={{ flex: 1, height: 48, borderRadius: 24, border: 'none', background: blocked[id] ? '#cdd2dc' : accent, color: '#fff', font: 'inherit', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>Message</button>
            </div>
            <div style={{ margin: '14px 20px 0', padding: '4px 16px', background: '#fff', borderRadius: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #eef1f5' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, fontWeight: 600 }}><Icon name="bell" size={20} color={accent} /> Mute notifications</span>
                {toggle(!!muted[id], (v) => (setMuted((m) => ({ ...m, [id]: v })), say(v ? 'Muted' : 'Unmuted')), 'Mute notifications')}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, fontWeight: 600, color: '#dc2626' }}><Icon name="block" size={20} /> Block {p.name.split(' ')[0]}</span>
                {toggle(!!blocked[id], (v) => (setBlocked((m) => ({ ...m, [id]: v })), say(v ? 'Contact blocked' : 'Contact unblocked')), 'Block contact')}
              </div>
            </div>
          </>
        )}
      </>
    )
  } else if (tab === 'chats') {
    const sorted = ORDER // order stays put; newest-first would jump rows under the finger
    body = (
      <>
        {header('Chats')}
        <div style={{ display: 'grid', gap: 8, padding: '6px 20px 0' }}>
          {sorted.map((id) => {
            const last = msgs[id][msgs[id].length - 1]
            return (
              <button key={id} type="button" onClick={() => open(id)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', border: 'none', borderRadius: 18, background: '#fff', font: 'inherit', textAlign: 'left', cursor: 'pointer', color: INK }}>
                <Avatar p={PEOPLE[id]} online={PEOPLE[id].status === 'Online'} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 15, fontWeight: 700 }}>{PEOPLE[id].name}</span>
                  <span style={{ display: 'block', fontSize: 13.5, color: unread[id] ? INK : MUTED, fontWeight: unread[id] ? 600 : 400, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{last.me ? 'You: ' : ''}{last.text}</span>
                </span>
                <span style={{ display: 'grid', justifyItems: 'end', gap: 6, flex: 'none' }}>
                  <span style={{ fontSize: 11.5, color: MUTED }}>{last.t}</span>
                  {unread[id] > 0 && !muted[id] ? <span style={{ minWidth: 20, height: 20, padding: '0 6px', borderRadius: 10, background: accent, color: '#fff', fontSize: 11.5, fontWeight: 700, display: 'grid', placeItems: 'center' }}>{unread[id]}</span> : <span style={{ height: 20 }} />}
                </span>
              </button>
            )
          })}
        </div>
      </>
    )
  } else if (tab === 'contacts') {
    const q = query.trim().toLowerCase()
    const list = ORDER.filter((id) => PEOPLE[id].name.toLowerCase().includes(q)).sort((a, b) => PEOPLE[a].name.localeCompare(PEOPLE[b].name))
    body = (
      <>
        {header('Contacts')}
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, height: 42, margin: '4px 20px 12px', padding: '0 14px', borderRadius: 21, background: '#fff', color: MUTED }}>
          <Icon name="search" size={18} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search contacts" aria-label="Search contacts" style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'none', font: 'inherit', fontSize: 14, color: INK }} />
        </label>
        <div style={{ display: 'grid', gap: 8, padding: '0 20px' }}>
          {list.map((id) => personRow(id, () => push({ id: 'person', who: id }), PEOPLE[id].status))}
          {!list.length && <div style={{ textAlign: 'center', color: MUTED, fontSize: 13, padding: '30px 0' }}>No one by that name.</div>}
        </div>
      </>
    )
  } else if (tab === 'settings') {
    const colors = ['#2f7cf6', '#8b5cf6', '#ec4899', '#10b981', '#f97316']
    body = (
      <>
        {header('Settings')}
        <div style={{ margin: '4px 20px 0', padding: '4px 16px', background: '#fff', borderRadius: 20 }}>
          {[['read', 'Read receipts'], ['sounds', 'Message sounds']].map(([k, l]) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 0', borderBottom: '1px solid #eef1f5', fontSize: 14, fontWeight: 600 }}>
              {l}
              {toggle(prefs[k], (v) => setPrefs((p) => ({ ...p, [k]: v })), l)}
            </div>
          ))}
          <div style={{ padding: '14px 0 16px' }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Bubble colour</div>
            <div style={{ display: 'flex', gap: 12 }} role="group" aria-label="Bubble colour">
              {colors.map((c) => (
                <button key={c} type="button" onClick={() => (setBubble(c), say('Bubble colour updated'))} aria-pressed={bubble === c} aria-label={c} style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: c, cursor: 'pointer', boxShadow: bubble === c ? `0 0 0 3px #fff, 0 0 0 5px ${c}` : 'none' }} />
              ))}
            </div>
          </div>
        </div>
        <div style={{ padding: '16px 20px' }}>
          <button type="button" onClick={() => (setMsgs(START), setUnread(UNREAD), setHearts({}), setMuted({}), setBlocked({}), setBubble(accent), say('Demo reset'))} style={{ width: '100%', height: 48, borderRadius: 24, border: 'none', background: '#e4e8f0', font: 'inherit', fontSize: 14, fontWeight: 600, color: INK, cursor: 'pointer' }}>Reset demo</button>
        </div>
      </>
    )
  }

  const phone = (
    <div style={{ position: 'relative', width: W, height: H, overflow: 'hidden', borderRadius: frame ? 46 : 0, background: BG, color: INK, fontFamily: "-apple-system, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif" }}>
      <style>{`
        @keyframes ms-r { from { opacity: 0; transform: translateX(34px) } to { opacity: 1; transform: none } }
        @keyframes ms-l { from { opacity: 0; transform: translateX(-34px) } to { opacity: 1; transform: none } }
        @keyframes ms-pop { from { opacity: 0; transform: scale(.85) } to { opacity: 1; transform: none } }
        @keyframes ms-dot { 0%, 60%, 100% { transform: none; opacity: .4 } 30% { transform: translateY(-4px); opacity: 1 } }
        .ms-scroll { scrollbar-width: none } .ms-scroll::-webkit-scrollbar { display: none }
        .ms-app button:focus-visible, .ms-app input:focus-visible { outline: 2px solid ${accent}; outline-offset: 2px }
      `}</style>
      <StatusBar frame={frame} />
      {top?.id === 'chat' ? (
        <div key={`chat-${top.who}`} style={{ position: 'absolute', inset: 0, animation: `${dir > 0 ? 'ms-r' : 'ms-l'} .28s ease` }}>{body}</div>
      ) : (
        <div key={`${tab}/${top?.id ?? ''}/${top?.who ?? ''}`} className="ms-scroll" style={{ position: 'absolute', top: 54, bottom: tabbed ? 88 : 0, left: 0, right: 0, overflowY: 'auto', paddingBottom: 24, animation: `${dir > 0 ? 'ms-r' : 'ms-l'} .28s ease` }}>
          {body}
        </div>
      )}
      {tabbed && !top && (
        <nav aria-label="Main" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 88, background: '#fff', borderRadius: '26px 26px 0 0', boxShadow: '0 -6px 20px rgba(22,24,29,.07)', display: 'flex', justifyContent: 'space-around', padding: '10px 8px 0' }}>
          {NAV.map(([id, icon, label]) => {
            const n = id === 'chats' ? Object.entries(unread).filter(([k]) => !muted[k]).reduce((s, [, v]) => s + v, 0) : 0
            return (
              <button key={id} type="button" onClick={() => go(id)} aria-current={tab === id ? 'page' : undefined} style={{ position: 'relative', border: 'none', background: 'none', font: 'inherit', cursor: 'pointer', display: 'grid', justifyItems: 'center', alignContent: 'start', gap: 3, width: 70, height: 54, fontSize: 11, fontWeight: 600, color: tab === id ? accent : MUTED }}>
                <Icon name={icon} size={23} />
                {label}
                {n > 0 && <span style={{ position: 'absolute', top: -2, right: 14, minWidth: 17, height: 17, padding: '0 4px', borderRadius: 9, background: '#ef4444', color: '#fff', fontSize: 10.5, fontWeight: 700, display: 'grid', placeItems: 'center' }}>{n}</span>}
              </button>
            )
          })}
        </nav>
      )}
      <div role="status" style={{ position: 'absolute', left: '50%', top: 58, zIndex: 30, transform: `translate(-50%, ${toast ? 0 : -90}px)`, transition: 'transform .35s cubic-bezier(.2,.8,.2,1)', padding: '10px 16px', borderRadius: 20, background: INK, color: '#fff', fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap' }}>{toast}</div>
      <div style={{ position: 'absolute', left: '50%', bottom: 8, width: 140, height: 5, marginLeft: -70, borderRadius: 3, background: INK, opacity: 0.8, zIndex: 25 }} />
    </div>
  )

  return (
    <div ref={box} className="ms-app" style={{ position: 'relative', width: '100%', height: '100%', display: 'grid', placeItems: 'center', overflow: 'hidden', background: 'radial-gradient(ellipse at 50% 30%, #e6ebf5, #b8c3d9 75%)', ...style }}>
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: `translate(-50%, -50%) scale(${scale})`, transformOrigin: 'center' }}>
        {frame ? (
          <div style={{ padding: 12, borderRadius: 58, background: 'linear-gradient(145deg, #3a3f4a, #14171d 40%, #2b2f38)', boxShadow: '0 40px 80px rgba(22,24,29,.35), inset 0 0 0 2px #4b515e' }}>
            <div style={{ padding: 2, borderRadius: 48, background: '#000' }}>{phone}</div>
          </div>
        ) : (
          phone
        )}
      </div>
    </div>
  )
}
