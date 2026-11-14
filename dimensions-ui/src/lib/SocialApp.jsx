import { useEffect, useRef, useState } from 'react'

// A social profile app on a phone, as a click-through prototype. Three tabs
// (Feed, People, Profile) plus pushed pages (Post detail, Edit profile), so
// all five pages can be a start screen. Likes, saves, follows and comments
// update their counts live; the composer on the Feed publishes a real post;
// People lists followers and following with follow / unfollow buttons; and
// Edit profile changes the name, handle and bio shown on Profile. Pages slide
// in with a back button, and the phone scales to fit its box.

const W = 390
const H = 844
const INK = '#1c1530'
const MUTED = '#8a839c'
const BG = '#faf8ff'
const LINE = '#eee9f7'

const USERS = {
  mara: { id: 'mara', name: 'Mara Quinn', handle: 'maraquinn', hue: 340, bio: 'Film photographer. Chasing golden hour.' },
  jonah: { id: 'jonah', name: 'Jonah Reyes', handle: 'jonah.r', hue: 210, bio: 'Trail runner and bad puns.' },
  priya: { id: 'priya', name: 'Priya Nair', handle: 'priyanair', hue: 28, bio: 'Product designer, tea enthusiast.' },
  theo: { id: 'theo', name: 'Theo Bauer', handle: 'theobauer', hue: 150, bio: 'Building a tiny synth company.' },
  lena: { id: 'lena', name: 'Lena Fischer', handle: 'lena.f', hue: 270, bio: 'Plants, ceramics, slow mornings.' },
  kofi: { id: 'kofi', name: 'Kofi Mensah', handle: 'kofim', hue: 50, bio: 'Coffee roaster in Accra.' },
  ines: { id: 'ines', name: 'Ines Moreau', handle: 'ines.moreau', hue: 190, bio: 'Sketching cities one street at a time.' },
}
const FOLLOWERS = ['mara', 'theo', 'lena', 'kofi', 'ines', 'priya', 'jonah']

const POSTS0 = [
  { id: 'p1', by: 'mara', text: 'Found this little pier at sunrise. Nobody around, just gulls and a thermos.', hue: 20, kind: 0, likes: 248, ago: '12m', comments: [{ id: 'c1', by: 'jonah', text: 'That light is unreal.' }, { id: 'c2', by: 'lena', text: 'Saving this for wallpaper.' }] },
  { id: 'p2', by: 'jonah', text: 'Sub-4 hour long run done. Legs are noodles.', hue: 200, kind: 1, likes: 131, ago: '1h', comments: [{ id: 'c3', by: 'priya', text: 'Absolute machine.' }] },
  { id: 'p3', by: 'priya', text: 'New design system tokens landed. Contrast ratios have never been happier.', hue: 285, kind: 2, likes: 402, ago: '3h', comments: [] },
  { id: 'p4', by: 'me', text: 'Sketching out the next side project. Coffee first.', hue: 155, kind: 1, likes: 64, ago: '1d', comments: [{ id: 'c4', by: 'kofi', text: 'Send me a bag recipe!' }] },
  { id: 'p5', by: 'me', text: 'Tiny desk, big plans.', hue: 330, kind: 2, likes: 97, ago: '2d', comments: [] },
  { id: 'p6', by: 'me', text: 'Weekend market haul.', hue: 40, kind: 0, likes: 51, ago: '4d', comments: [] },
]

const ICONS = {
  home: 'M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z',
  users: 'M9 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 19a6.5 6.5 0 0 1 13 0M16 5.5a3.5 3.5 0 0 1 0 6.5M18.5 14a6 6 0 0 1 3 5',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 20a8 8 0 0 1 16 0',
  back: 'M15 5l-7 7 7 7',
  heart: 'M12 20s-7-4.4-9-9.2C1.8 7.3 4 4.5 7 4.5c2 0 3.6 1.1 5 3 1.4-1.9 3-3 5-3 3 0 5.2 2.8 4 6.3-2 4.8-9 9.2-9 9.2z',
  chat: 'M4 5h16v11H9l-5 4z',
  share: 'M12 4v11M7 9l5-5 5 5M5 14v5h14v-5',
  mark: 'M6 4h12v16l-6-4-6 4z',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  check: 'M5 12l5 5 9-10',
  plus: 'M12 5v14M5 12h14',
  send: 'M4 12l16-8-6 16-3-7z',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13 7l4 4',
  grid: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
}

function Icon({ name, size = 22, color = 'currentColor', w = 1.9, fill = 'none' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  )
}

const iconBtn = { display: 'grid', placeItems: 'center', border: 'none', borderRadius: '50%', cursor: 'pointer', padding: 0, background: 'transparent', color: INK }

// a drawn person: gradient backdrop, shoulders, head and a hairstyle
function Avatar({ u, size = 44, ring }) {
  const h = u.hue
  const hair = u.id.length % 3
  const svg = (
    <svg width={size} height={size} viewBox="0 0 48 48" style={{ display: 'block', borderRadius: '50%' }} aria-hidden="true">
      <defs>
        <linearGradient id={`sa-${u.id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={`hsl(${h} 80% 82%)`} />
          <stop offset="1" stopColor={`hsl(${(h + 40) % 360} 70% 62%)`} />
        </linearGradient>
      </defs>
      <rect width="48" height="48" fill={`url(#sa-${u.id})`} />
      <path d="M6 48c1-10 8-14 18-14s17 4 18 14z" fill={`hsl(${h} 45% 30%)`} />
      <circle cx="24" cy="21" r="8.5" fill="#f1c9a5" />
      {hair === 0 && <path d="M15 20c0-8 5-11 10-11s9 3 8 11c-2-4-5-5-9-5s-7 1-9 5z" fill="#2b1d16" />}
      {hair === 1 && <path d="M14.5 24c-2-10 4-15 10-15s11 5 9 15c-1-5-3-8-9-8s-8 3-10 8z" fill="#6b3a1e" />}
      {hair === 2 && <path d="M15 19c1-6 5-9 9-9s8 3 9 9c-3-2-6-3-9-3s-6 1-9 3z" fill="#d9a441" />}
    </svg>
  )
  if (!ring) return svg
  return (
    <span style={{ display: 'inline-grid', padding: 2.5, borderRadius: '50%', background: `conic-gradient(${ring}, #f59e0b, ${ring})`, flex: 'none' }}>
      <span style={{ display: 'block', padding: 2, borderRadius: '50%', background: '#fff' }}>{svg}</span>
    </span>
  )
}

// post imagery drawn from gradients and shapes
function PostArt({ hue, kind, h = 280, id }) {
  const a = `hsl(${hue} 85% 72%)`
  const b = `hsl(${(hue + 50) % 360} 75% 48%)`
  return (
    <svg viewBox="0 0 360 280" width="100%" height={h} preserveAspectRatio="xMidYMid slice" style={{ display: 'block' }} aria-hidden="true">
      <defs>
        <linearGradient id={`pa-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={a} />
          <stop offset="1" stopColor={b} />
        </linearGradient>
      </defs>
      <rect width="360" height="280" fill={`url(#pa-${id})`} />
      {kind === 0 && (
        <>
          <circle cx="250" cy="100" r="46" fill="#fff" opacity=".85" />
          <path d="M0 200q70-50 140-10t220-20v110H0z" fill={`hsl(${hue} 50% 28%)`} opacity=".85" />
          <path d="M0 235q90-40 180-5t180-10v60H0z" fill={`hsl(${hue} 55% 18%)`} />
        </>
      )}
      {kind === 1 && (
        <>
          <path d="M0 220L90 110l60 70 70-100 140 140v40H0z" fill={`hsl(${hue} 55% 26%)`} opacity=".9" />
          <path d="M220 80l-30 45h60z" fill="#fff" opacity=".8" />
          <circle cx="70" cy="60" r="22" fill="#fff" opacity=".7" />
        </>
      )}
      {kind === 2 && (
        <>
          <rect x="60" y="60" width="110" height="110" rx="24" fill="#fff" opacity=".8" />
          <circle cx="240" cy="150" r="64" fill={`hsl(${hue} 60% 30%)`} opacity=".85" />
          <rect x="200" y="200" width="120" height="14" rx="7" fill="#fff" opacity=".6" />
        </>
      )}
    </svg>
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

const NAV = [
  ['feed', 'home', 'Feed'],
  ['people', 'users', 'People'],
  ['profile', 'user', 'Profile'],
]
const SCREENS = ['feed', 'profile', 'post', 'followers', 'edit']

// where each start screen lands: a tab, plus any pushed pages on top
function initFor(s) {
  if (s === 'post') return { tab: 'feed', stack: [{ id: 'post', pid: 'p1' }] }
  if (s === 'followers') return { tab: 'people', stack: [] }
  if (s === 'edit') return { tab: 'profile', stack: [{ id: 'edit' }] }
  return { tab: SCREENS.includes(s) ? s : 'feed', stack: [] }
}

const fmt = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1).replace('.0', '')}k` : `${n}`)

// ---------------------------------------------------------------- app

export default function SocialApp({ name = 'Alex Rivera', accent = '#7c3aed', startScreen = 'feed', frame = true, style }) {
  const box = useRef()
  const toastTimer = useRef()
  const [scale, setScale] = useState(1)
  const init = initFor(startScreen)
  const [tab, setTab] = useState(init.tab)
  const [stack, setStack] = useState(init.stack)
  const [dir, setDir] = useState(1)
  const [toast, setToast] = useState('')
  const [posts, setPosts] = useState(POSTS0)
  const [liked, setLiked] = useState({ p3: true })
  const [saved, setSaved] = useState({})
  const [following, setFollowing] = useState({ mara: true, jonah: true, priya: true })
  const [seg, setSeg] = useState('followers')
  const [draft, setDraft] = useState('')
  const [comment, setComment] = useState('')
  const [me, setMe] = useState({ name, handle: name.toLowerCase().replace(/\s+/g, '.'), bio: 'Designer and maker. Sharing small experiments.' })
  const [form, setForm] = useState(me)
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const i = initFor(startScreen)
    setTab(i.tab)
    setStack(i.stack)
    setSeg('followers')
  }, [startScreen])
  useEffect(() => {
    setMe((m) => ({ ...m, name, handle: name.toLowerCase().replace(/\s+/g, '.') }))
  }, [name])
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (mq) setReduced(mq.matches)
  }, [])

  useEffect(() => {
    const ro = new ResizeObserver(([e]) => {
      const fw = frame ? W + 28 : W
      const fh = frame ? H + 28 : H
      setScale(Math.min(1.2, (e.contentRect.width - 24) / fw, (e.contentRect.height - 24) / fh))
    })
    ro.observe(box.current)
    return () => ro.disconnect()
  }, [frame])

  const say = (t) => {
    setToast(t)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 1900)
  }
  useEffect(() => () => clearTimeout(toastTimer.current), [])

  const top = stack[stack.length - 1]
  const push = (s) => (setDir(1), setStack((a) => [...a, s]))
  const pop = () => (setDir(-1), setStack((a) => a.slice(0, -1)))
  const go = (t) => (setDir(NAV.findIndex((n) => n[0] === t) >= NAV.findIndex((n) => n[0] === tab) ? 1 : -1), setTab(t), setStack([]))

  const who = (id) => (id === 'me' ? { id: 'me', name: me.name, handle: me.handle, hue: 262 } : USERS[id])
  const toggleLike = (id) => setLiked((l) => ({ ...l, [id]: !l[id] }))
  const likeCount = (p) => p.likes + (liked[p.id] ? 1 : 0) - (p.id === 'p3' ? 1 : 0)
  const toggleFollow = (id) => {
    const on = !following[id]
    setFollowing((f) => ({ ...f, [id]: on }))
    say(on ? `Following ${USERS[id].name.split(' ')[0]}` : `Unfollowed ${USERS[id].name.split(' ')[0]}`)
  }
  const followingN = Object.values(following).filter(Boolean).length
  const myPosts = posts.filter((p) => p.by === 'me')

  const publish = () => {
    const t = draft.trim()
    if (!t) return say('Write something first')
    setPosts((a) => [{ id: `n${Date.now()}`, by: 'me', text: t, hue: Math.floor(Math.random() * 360), kind: Math.floor(Math.random() * 3), likes: 0, ago: 'now', comments: [] }, ...a])
    setDraft('')
    say('Posted to your feed')
  }
  const addComment = (pid) => {
    const t = comment.trim()
    if (!t) return
    setPosts((a) => a.map((p) => (p.id === pid ? { ...p, comments: [...p.comments, { id: `c${Date.now()}`, by: 'me', text: t }] } : p)))
    setComment('')
  }

  // ---- shared bits
  const header = (title, back, right) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px 6px', minHeight: 50 }}>
      {back && (
        <button type="button" onClick={back} aria-label="Back" style={{ ...iconBtn, width: 38, height: 38, background: '#fff', boxShadow: `0 0 0 1px ${LINE}` }}>
          <Icon name="back" size={20} />
        </button>
      )}
      <h1 style={{ margin: 0, flex: 1, fontSize: back ? 18 : 26, fontWeight: 800, letterSpacing: '-0.02em', marginLeft: 4 }}>{title}</h1>
      {right}
    </div>
  )

  const followBtn = (id, small) => (
    <button type="button" onClick={() => toggleFollow(id)} aria-pressed={!!following[id]} style={{ flex: 'none', height: small ? 30 : 34, padding: '0 14px', borderRadius: 17, border: following[id] ? `1px solid ${LINE}` : 'none', background: following[id] ? '#fff' : accent, color: following[id] ? INK : '#fff', font: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
      {following[id] ? 'Following' : 'Follow'}
    </button>
  )

  const actions = (p) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '8px 10px 0' }}>
      <button type="button" onClick={() => toggleLike(p.id)} aria-pressed={!!liked[p.id]} aria-label="Like" style={{ ...iconBtn, width: 'auto', height: 36, padding: '0 8px', gap: 6, borderRadius: 18, display: 'flex', alignItems: 'center', color: liked[p.id] ? '#e11d48' : INK, fontSize: 13, fontWeight: 700 }}>
        <Icon name="heart" size={22} fill={liked[p.id] ? '#e11d48' : 'none'} /> {fmt(likeCount(p))}
      </button>
      <button type="button" onClick={() => push({ id: 'post', pid: p.id })} aria-label="Comments" style={{ ...iconBtn, width: 'auto', height: 36, padding: '0 8px', gap: 6, borderRadius: 18, display: 'flex', alignItems: 'center', fontSize: 13, fontWeight: 700 }}>
        <Icon name="chat" size={21} /> {p.comments.length}
      </button>
      <button type="button" onClick={() => say('Link copied')} aria-label="Share" style={{ ...iconBtn, width: 36, height: 36 }}>
        <Icon name="share" size={20} />
      </button>
      <span style={{ flex: 1 }} />
      <button type="button" onClick={() => (setSaved((s) => ({ ...s, [p.id]: !s[p.id] })), say(saved[p.id] ? 'Removed from saved' : 'Saved'))} aria-pressed={!!saved[p.id]} aria-label="Save" style={{ ...iconBtn, width: 36, height: 36, color: saved[p.id] ? accent : INK }}>
        <Icon name="mark" size={21} fill={saved[p.id] ? accent : 'none'} />
      </button>
    </div>
  )

  const postHead = (p) => {
    const u = who(p.by)
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px 10px' }}>
        <Avatar u={u} size={38} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 14, fontWeight: 700 }}>{u.name}</span>
          <span style={{ display: 'block', fontSize: 12, color: MUTED }}>@{u.handle} · {p.ago}</span>
        </span>
        {p.by !== 'me' && followBtn(p.by, true)}
      </div>
    )
  }

  const input = (value, onChange, ph, extra) => (
    <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={ph} aria-label={ph} style={{ flex: 1, minWidth: 0, height: 40, padding: '0 14px', borderRadius: 20, border: `1px solid ${LINE}`, background: '#fff', font: 'inherit', fontSize: 14, color: INK, outline: 'none', ...extra }} />
  )

  // ---- screens
  let body
  let tabbed = true
  if (top?.id === 'post') {
    tabbed = false
    const p = posts.find((x) => x.id === top.pid) || posts[0]
    body = (
      <>
        {header('Post', pop)}
        <div style={{ margin: '4px 16px 0', background: '#fff', borderRadius: 22, overflow: 'hidden', boxShadow: `0 0 0 1px ${LINE}` }}>
          {postHead(p)}
          <PostArt hue={p.hue} kind={p.kind} id={`d${p.id}`} h={250} />
          {actions(p)}
          <p style={{ margin: 0, padding: '8px 16px 14px', fontSize: 14.5, lineHeight: 1.45 }}>{p.text}</p>
        </div>
        <h2 style={{ margin: '18px 20px 8px', fontSize: 15, fontWeight: 800 }}>Comments ({p.comments.length})</h2>
        <div style={{ display: 'grid', gap: 10, padding: '0 16px' }}>
          {p.comments.map((c) => (
            <div key={c.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <Avatar u={who(c.by)} size={32} />
              <div style={{ background: '#fff', borderRadius: '4px 16px 16px 16px', padding: '8px 12px', boxShadow: `0 0 0 1px ${LINE}` }}>
                <div style={{ fontSize: 12, fontWeight: 700 }}>{who(c.by).name}</div>
                <div style={{ fontSize: 13.5, marginTop: 1 }}>{c.text}</div>
              </div>
            </div>
          ))}
          {!p.comments.length && <div style={{ color: MUTED, fontSize: 13, textAlign: 'center', padding: '8px 0' }}>Be the first to comment.</div>}
        </div>
        <form onSubmit={(e) => (e.preventDefault(), addComment(p.id))} style={{ display: 'flex', gap: 8, padding: '14px 16px' }}>
          {input(comment, setComment, 'Add a comment')}
          <button type="submit" aria-label="Send comment" style={{ ...iconBtn, width: 40, height: 40, background: accent, color: '#fff' }}><Icon name="send" size={18} /></button>
        </form>
      </>
    )
  } else if (top?.id === 'edit') {
    tabbed = false
    const save = () => {
      setMe({ name: form.name.trim() || me.name, handle: form.handle.trim().replace(/^@/, '') || me.handle, bio: form.bio })
      say('Profile updated')
      pop()
    }
    const field = (label, key, multi) => (
      <label style={{ display: 'block', margin: '0 0 14px' }}>
        <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: MUTED, margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</span>
        {multi ? (
          <textarea value={form[key]} maxLength={90} rows={3} onChange={(e) => setForm({ ...form, [key]: e.target.value })} style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: 16, border: `1px solid ${LINE}`, background: '#fff', font: 'inherit', fontSize: 14.5, color: INK, resize: 'none', outline: 'none' }} />
        ) : (
          <input value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} style={{ width: '100%', boxSizing: 'border-box', height: 46, padding: '0 14px', borderRadius: 16, border: `1px solid ${LINE}`, background: '#fff', font: 'inherit', fontSize: 14.5, color: INK, outline: 'none' }} />
        )}
        {multi && <span style={{ display: 'block', textAlign: 'right', fontSize: 11, color: MUTED, marginTop: 4 }}>{form[key].length}/90</span>}
      </label>
    )
    body = (
      <>
        {header('Edit profile', pop)}
        <div style={{ textAlign: 'center', padding: '8px 0 18px' }}>
          <Avatar u={{ id: 'me', hue: 262 }} size={86} />
          <div><button type="button" onClick={() => say('Photo picker would open')} style={{ border: 'none', background: 'none', font: 'inherit', fontSize: 13, fontWeight: 700, color: accent, cursor: 'pointer', marginTop: 8 }}>Change photo</button></div>
        </div>
        <div style={{ padding: '0 20px' }}>
          {field('Name', 'name')}
          {field('Username', 'handle')}
          {field('Bio', 'bio', true)}
          <button type="button" onClick={save} style={{ width: '100%', height: 50, borderRadius: 25, border: 'none', background: accent, color: '#fff', font: 'inherit', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>Save changes</button>
          <button type="button" onClick={() => (setForm(me), pop())} style={{ width: '100%', height: 44, border: 'none', background: 'none', font: 'inherit', fontSize: 14, fontWeight: 600, color: MUTED, cursor: 'pointer', marginTop: 4 }}>Cancel</button>
        </div>
      </>
    )
  } else if (tab === 'feed') {
    body = (
      <>
        {header('Feed', null, <button type="button" onClick={() => say('You are all caught up')} aria-label="Notifications" style={{ ...iconBtn, width: 40, height: 40, background: '#fff', boxShadow: `0 0 0 1px ${LINE}` }}><Icon name="heart" size={20} /></button>)}
        <form onSubmit={(e) => (e.preventDefault(), publish())} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '4px 16px 12px' }}>
          <Avatar u={{ id: 'me', hue: 262 }} size={38} />
          {input(draft, setDraft, "What's on your mind?")}
          <button type="submit" style={{ height: 40, padding: '0 16px', borderRadius: 20, border: 'none', background: accent, color: '#fff', font: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Post</button>
        </form>
        <div style={{ display: 'grid', gap: 14, padding: '0 16px' }}>
          {posts.map((p) => (
            <article key={p.id} style={{ background: '#fff', borderRadius: 22, overflow: 'hidden', boxShadow: `0 0 0 1px ${LINE}` }}>
              {postHead(p)}
              <button type="button" onClick={() => push({ id: 'post', pid: p.id })} aria-label="Open post" style={{ display: 'block', width: '100%', padding: 0, border: 'none', background: 'none', cursor: 'pointer' }}>
                <PostArt hue={p.hue} kind={p.kind} id={`f${p.id}`} h={190} />
              </button>
              {actions(p)}
              <p style={{ margin: 0, padding: '6px 16px 14px', fontSize: 14, lineHeight: 1.45 }}>{p.text}</p>
            </article>
          ))}
        </div>
      </>
    )
  } else if (tab === 'people') {
    const list = seg === 'followers' ? FOLLOWERS : Object.keys(following).filter((k) => following[k])
    body = (
      <>
        {header('People')}
        <div role="tablist" style={{ display: 'flex', margin: '4px 20px 12px', padding: 4, borderRadius: 20, background: '#efe9fb' }}>
          {[['followers', `Followers · ${FOLLOWERS.length}`], ['following', `Following · ${followingN}`]].map(([id, l]) => (
            <button key={id} type="button" role="tab" aria-selected={seg === id} onClick={() => setSeg(id)} style={{ flex: 1, height: 34, borderRadius: 16, border: 'none', background: seg === id ? '#fff' : 'transparent', color: seg === id ? INK : MUTED, font: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: seg === id ? '0 1px 4px rgba(28,21,48,.12)' : 'none' }}>{l}</button>
          ))}
        </div>
        <div style={{ display: 'grid', gap: 8, padding: '0 20px' }}>
          {list.map((id) => {
            const u = USERS[id]
            return (
              <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 18, background: '#fff', boxShadow: `0 0 0 1px ${LINE}` }}>
                <Avatar u={u} size={44} />
                <button type="button" onClick={() => say(u.bio)} style={{ flex: 1, minWidth: 0, border: 'none', background: 'none', padding: 0, font: 'inherit', textAlign: 'left', cursor: 'pointer', color: INK }}>
                  <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700 }}>{u.name}</span>
                  <span style={{ display: 'block', fontSize: 12, color: MUTED, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>@{u.handle}</span>
                </button>
                {followBtn(id)}
              </div>
            )
          })}
          {!list.length && <div style={{ textAlign: 'center', color: MUTED, fontSize: 13, padding: '34px 0' }}>You are not following anyone yet.</div>}
        </div>
      </>
    )
  } else {
    const totalLikes = myPosts.reduce((s, p) => s + likeCount(p), 0)
    body = (
      <>
        <div style={{ height: 130, background: `linear-gradient(120deg, ${accent}, #f472b6 60%, #fbbf24)`, position: 'relative' }}>
          <svg width="100%" height="130" viewBox="0 0 390 130" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0 }} aria-hidden="true">
            <path d="M0 90q80-40 170 0t220-20v60H0z" fill="#fff" opacity=".18" />
            <circle cx="320" cy="40" r="26" fill="#fff" opacity=".25" />
          </svg>
        </div>
        <div style={{ padding: '0 20px', marginTop: -44, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <span style={{ borderRadius: '50%', padding: 4, background: BG, display: 'inline-block' }}><Avatar u={{ id: 'me', hue: 262 }} size={84} /></span>
          <button type="button" onClick={() => (setForm(me), push({ id: 'edit' }))} style={{ height: 38, padding: '0 16px', borderRadius: 19, border: `1px solid ${LINE}`, background: '#fff', font: 'inherit', fontSize: 13, fontWeight: 700, color: INK, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="edit" size={15} /> Edit profile</button>
        </div>
        <div style={{ padding: '10px 20px 0' }}>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>{me.name}</div>
          <div style={{ fontSize: 13, color: MUTED }}>@{me.handle}</div>
          <p style={{ margin: '8px 0 0', fontSize: 14, lineHeight: 1.45 }}>{me.bio}</p>
        </div>
        <div style={{ display: 'flex', margin: '14px 20px 0', padding: '12px 0', borderRadius: 18, background: '#fff', boxShadow: `0 0 0 1px ${LINE}` }}>
          {[['Posts', myPosts.length, null], ['Followers', FOLLOWERS.length, 'followers'], ['Following', followingN, 'following']].map(([l, n, s]) => (
            <button key={l} type="button" onClick={() => (s ? (setSeg(s), go('people')) : say(`${totalLikes} likes across your posts`))} style={{ flex: 1, border: 'none', background: 'none', font: 'inherit', cursor: 'pointer', color: INK, display: 'grid', gap: 2 }}>
              <span style={{ fontSize: 19, fontWeight: 800 }}>{n}</span>
              <span style={{ fontSize: 12, color: MUTED }}>{l}</span>
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '18px 20px 8px', fontSize: 15, fontWeight: 800 }}><Icon name="grid" size={17} /> Your posts</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3, padding: '0 20px' }}>
          {myPosts.map((p) => (
            <button key={p.id} type="button" onClick={() => push({ id: 'post', pid: p.id })} aria-label="Open post" style={{ padding: 0, border: 'none', cursor: 'pointer', borderRadius: 10, overflow: 'hidden', background: 'none', aspectRatio: '1' }}>
              <PostArt hue={p.hue} kind={p.kind} id={`g${p.id}`} h={102} />
            </button>
          ))}
        </div>
      </>
    )
  }

  const phone = (
    <div style={{ position: 'relative', width: W, height: H, overflow: 'hidden', borderRadius: frame ? 46 : 0, background: BG, color: INK, fontFamily: "-apple-system, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif" }}>
      <style>{`
        @keyframes sc-r { from { opacity: 0; transform: translateX(34px) } to { opacity: 1; transform: none } }
        @keyframes sc-l { from { opacity: 0; transform: translateX(-34px) } to { opacity: 1; transform: none } }
        .sc-scroll { scrollbar-width: none } .sc-scroll::-webkit-scrollbar { display: none }
        .sc-app button:focus-visible, .sc-app input:focus-visible, .sc-app textarea:focus-visible { outline: 2px solid ${accent}; outline-offset: 2px }
        @media (prefers-reduced-motion: reduce) { .sc-page { animation: none !important } .sc-app * { transition: none !important } }
      `}</style>
      <StatusBar frame={frame} />
      <div key={`${tab}/${stack.map((s) => s.id + (s.pid || '')).join('/')}`} className="sc-scroll sc-page" style={{ position: 'absolute', top: 54, bottom: tabbed ? 88 : 0, left: 0, right: 0, overflowY: 'auto', paddingBottom: 24, animation: reduced ? 'none' : `${dir > 0 ? 'sc-r' : 'sc-l'} .28s ease` }}>
        {body}
      </div>
      {tabbed && (
        <nav aria-label="Main" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 88, background: '#fff', borderRadius: '26px 26px 0 0', boxShadow: '0 -6px 20px rgba(28,21,48,.07)', display: 'flex', justifyContent: 'space-around', padding: '10px 8px 0' }}>
          {NAV.map(([id, icon, label]) => (
            <button key={id} type="button" onClick={() => go(id)} aria-current={tab === id ? 'page' : undefined} style={{ border: 'none', background: 'none', font: 'inherit', cursor: 'pointer', display: 'grid', justifyItems: 'center', alignContent: 'start', gap: 3, width: 76, height: 54, fontSize: 11, fontWeight: 600, color: tab === id ? accent : MUTED }}>
              <Icon name={icon} size={23} />
              {label}
            </button>
          ))}
        </nav>
      )}
      <div role="status" style={{ position: 'absolute', left: '50%', top: 58, zIndex: 30, transform: `translate(-50%, ${toast ? 0 : -90}px)`, transition: 'transform .35s cubic-bezier(.2,.8,.2,1)', padding: '10px 16px', borderRadius: 20, background: INK, color: '#fff', fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap', maxWidth: 340, overflow: 'hidden', textOverflow: 'ellipsis' }}>{toast}</div>
      <div style={{ position: 'absolute', left: '50%', bottom: 8, width: 140, height: 5, marginLeft: -70, borderRadius: 3, background: INK, opacity: 0.8, zIndex: 25 }} />
    </div>
  )

  return (
    <div ref={box} className="sc-app" style={{ position: 'relative', width: '100%', height: '100%', display: 'grid', placeItems: 'center', overflow: 'hidden', background: 'radial-gradient(ellipse at 50% 30%, #efe7ff, #cbbdf0 75%)', ...style }}>
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: `translate(-50%, -50%) scale(${scale})`, transformOrigin: 'center' }}>
        {frame ? (
          <div style={{ padding: 12, borderRadius: 58, background: 'linear-gradient(145deg, #3a3f4a, #14171d 40%, #2b2f38)', boxShadow: '0 40px 80px rgba(28,21,48,.35), inset 0 0 0 2px #4b515e' }}>
            <div style={{ padding: 2, borderRadius: 48, background: '#000' }}>{phone}</div>
          </div>
        ) : (
          phone
        )}
      </div>
    </div>
  )
}
