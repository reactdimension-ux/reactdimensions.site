import { useEffect, useRef, useState } from 'react'

// A voice-notes app on a phone, as a click-through prototype. Five pages:
// Recordings, Record, Playback, Folders and Settings. Record shows a live
// scrolling waveform fed by simulated levels, with a timer and pause/resume,
// and saving keeps the exact waveform you just recorded. Playback draws that
// waveform with a moving cursor you can drag to scrub, speed chips, skip
// buttons and draggable trim handles that really cut the clip. You can
// rename, favourite, move and delete recordings, and Folders both organises
// and filters them. No microphone is used; the levels are made up. Detail
// screens slide in from the right with a back button, and the phone scales to
// fit whatever box it is in.

const W = 390 // the phone screen, in CSS px
const H = 844
const PAPER = '#f6f1ea'
const CARD = '#ffffff'
const INK = '#241b17'
const MUTED = '#8a7d74'
const LINE = '#e9e0d5'
const TICK = 100 // ms per waveform sample

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v))
const rnd = (i, s = 1) => {
  const x = Math.sin(i * 127.1 + s * 311.7) * 43758.5453
  return x - Math.floor(x)
}
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
const mmsst = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}.${Math.floor((s * 10) % 10)}`
const clockNow = () => new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

// a speech-like waveform: phrases with gaps in between
function genWave(seed, secs) {
  const out = []
  let env = 0
  let target = 0
  for (let i = 0; i < secs * 10; i++) {
    if (i % (6 + Math.floor(rnd(i, seed) * 10)) === 0) target = rnd(i, seed + 3) < 0.2 ? 0.02 : 0.3 + rnd(i, seed + 5) * 0.65
    env += (target - env) * 0.4
    out.push(clamp(env * (0.65 + 0.35 * rnd(i, seed + 9))))
  }
  return out
}

const SEED = [
  { id: 'r1', title: 'Standup notes', folder: 'Work', day: 'Today', time: '09:12', fav: true, levels: genWave(1, 94) },
  { id: 'r2', title: 'Song idea: chorus', folder: 'Ideas', day: 'Today', time: '07:48', fav: false, levels: genWave(2, 41) },
  { id: 'r3', title: 'Grocery list', folder: 'Personal', day: 'Yesterday', time: '18:20', fav: false, levels: genWave(3, 18) },
  { id: 'r4', title: 'Lecture: Cell biology', folder: 'School', day: 'Yesterday', time: '11:05', fav: true, levels: genWave(4, 156) },
  { id: 'r5', title: 'Voicemail from Dad', folder: 'Personal', day: 'Mon 10 Nov', time: '20:31', fav: false, levels: genWave(5, 27) },
  { id: 'r6', title: 'Podcast intro, take 3', folder: 'Work', day: 'Sun 9 Nov', time: '16:02', fav: false, levels: genWave(6, 63) },
]
const FOLDERS = ['Work', 'Ideas', 'Personal', 'School']
const SPEEDS = [0.5, 1, 1.5, 2]
const RATE = { Standard: 16, High: 32, Lossless: 90 } // KB per second

const ICONS = {
  mic: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3',
  play: 'M8 5l11 7-11 7z',
  pause: 'M7 5h3.500v14H7zM13.500 5H17v14h-3.500z',
  stop: 'M6 6h12v12H6z',
  star: 'M12 3l2.800 5.800 6.200.9-4.500 4.400 1.100 6.200L12 17.300 6.400 20.300l1.100-6.200L3 9.700l6.200-.9z',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6',
  folder: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  wave: 'M4 10v4M8 6v12M12 3v18M16 8v8M20 11v2',
  gear: 'M4 7h9M17 7h3M4 17h3M11 17h9M13 7a2 2 0 1 0 4 0 2 2 0 1 0-4 0zM7 17a2 2 0 1 0 4 0 2 2 0 1 0-4 0z',
  scissors: 'M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8.500 7.500L20 18M8.500 16.500L20 6',
  back5: 'M4 12a8 8 0 1 0 3-6.200M4 4v4h4',
  fwd5: 'M20 12a8 8 0 1 1-3-6.200M20 4v4h-4',
  share: 'M12 15V4m0 0l-4 4m4-4l4 4M5 13v6h14v-6',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  edit: 'M4 20h4L19 9l-4-4L4 16z',
  back: 'M15 5l-7 7 7 7',
  chev: 'M9 5l7 7-7 7',
  check: 'M5 12l5 5 9-10',
  x: 'M6 6l12 12M18 6L6 18',
  plus: 'M12 5v14M5 12h14',
}
const SOLID = { play: 1, pause: 1, stop: 1 }

function Icon({ name, size = 22, color = 'currentColor', w = 1.9, fill }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill || (SOLID[name] ? color : 'none')} stroke={SOLID[name] && !fill ? 'none' : color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  )
}

const bucket = (levels, n) => {
  if (!levels.length) return Array.from({ length: n }, () => 0.03)
  return Array.from({ length: n }, (_, i) => {
    const a = Math.floor((i / n) * levels.length)
    const b = Math.max(a + 1, Math.floor(((i + 1) / n) * levels.length))
    let m = 0
    for (let k = a; k < b; k++) m = Math.max(m, levels[k] || 0)
    return m
  })
}

function MiniWave({ levels, color }) {
  const bars = bucket(levels, 44)
  return (
    <svg viewBox="0 0 132 22" width="100%" height="22" preserveAspectRatio="none" aria-hidden="true" style={{ display: 'block' }}>
      {bars.map((v, i) => <rect key={i} x={i * 3} y={11 - Math.max(1, v * 10)} width="1.800" height={Math.max(2, v * 20)} rx="0.9" fill={color} opacity=".75" />)}
    </svg>
  )
}

// The playback waveform: moving cursor, drag anywhere to scrub, and optional
// trim handles. It owns the drag so it stays a stable component.
const NB = 72
function Scrubber({ levels, pos, onSeek, trim, onTrim, accent }) {
  const el = useRef()
  const mode = useRef(null)
  const bars = bucket(levels, NB)
  const frac = (e) => {
    const r = el.current.getBoundingClientRect()
    return clamp((e.clientX - r.left) / r.width)
  }
  const down = (e) => {
    el.current.setPointerCapture(e.pointerId)
    mode.current = 'seek'
    onSeek(frac(e))
  }
  const grab = (which) => (e) => {
    e.stopPropagation()
    el.current.setPointerCapture(e.pointerId)
    mode.current = which
  }
  const move = (e) => {
    if (!mode.current) return
    const f = frac(e)
    if (mode.current === 'seek') onSeek(f)
    else if (mode.current === 'a') onTrim(clamp(f, 0, trim.b - 0.05), trim.b)
    else onTrim(trim.a, clamp(f, trim.a + 0.05, 1))
  }
  const up = () => {
    mode.current = null
  }
  const handle = (which, at) => (
    <div role="slider" tabIndex={0} aria-label={which === 'a' ? 'Trim start' : 'Trim end'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(at * 100)} onPointerDown={grab(which)} onKeyDown={(e) => {
      const d = e.key === 'ArrowLeft' ? -0.02 : e.key === 'ArrowRight' ? 0.02 : 0
      if (!d) return
      if (which === 'a') onTrim(clamp(trim.a + d, 0, trim.b - 0.05), trim.b)
      else onTrim(trim.a, clamp(trim.b + d, trim.a + 0.05, 1))
    }} style={{ position: 'absolute', top: -6, bottom: -6, left: `${at * 100}%`, width: 26, marginLeft: which === 'a' ? -26 : 0, touchAction: 'none', cursor: 'ew-resize', display: 'flex', justifyContent: which === 'a' ? 'flex-end' : 'flex-start', zIndex: 3 }}>
      <span style={{ width: 8, height: '100%', background: '#f5b301', borderRadius: which === 'a' ? '6px 0 0 6px' : '0 6px 6px 0', display: 'grid', placeItems: 'center' }}>
        <i style={{ width: 2, height: 22, borderRadius: 1, background: '#5a4300' }} />
      </span>
    </div>
  )
  return (
    <div ref={el} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} style={{ position: 'relative', height: 150, touchAction: 'none', cursor: 'pointer', userSelect: 'none' }}>
      <svg viewBox={`0 0 ${NB * 5} 150`} width="100%" height="150" preserveAspectRatio="none" aria-hidden="true" style={{ display: 'block' }}>
        {bars.map((v, i) => {
          const f = (i + 0.5) / NB
          const out = trim && (f < trim.a || f > trim.b)
          const h = Math.max(4, v * 140)
          return <rect key={i} x={i * 5 + 0.5} y={75 - h / 2} width="3.400" height={h} rx="1.700" fill={f <= pos ? accent : '#cdbfb2'} opacity={out ? 0.28 : 1} />
        })}
      </svg>
      {trim && (
        <>
          <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${trim.a * 100}%`, width: `${(trim.b - trim.a) * 100}%`, borderTop: '2px solid #f5b301', borderBottom: '2px solid #f5b301', background: 'rgba(245,179,1,.08)', pointerEvents: 'none' }} />
          {handle('a', trim.a)}
          {handle('b', trim.b)}
        </>
      )}
      <div style={{ position: 'absolute', top: -4, bottom: -4, left: `${pos * 100}%`, width: 2, marginLeft: -1, background: INK, pointerEvents: 'none', zIndex: 2 }}>
        <i style={{ position: 'absolute', top: -4, left: -4, width: 10, height: 10, borderRadius: '50%', background: INK }} />
      </div>
    </div>
  )
}

function StatusBar({ frame }) {
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 40, height: 54, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 30px 0 36px', fontSize: 16, fontWeight: 600, color: INK, pointerEvents: 'none' }}>
      <span>{new Date().toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' })}</span>
      {frame && <span style={{ position: 'absolute', left: '50%', top: 11, width: 122, height: 35, marginLeft: -61, borderRadius: 20, background: '#000' }} />}
      <span style={{ display: 'flex', gap: 6, alignItems: 'center' }} aria-hidden="true">
        <svg width="18" height="11" viewBox="0 0 18 11" fill={INK}>
          <rect x="0" y="7" width="3" height="4" rx="1" />
          <rect x="5" y="5" width="3" height="6" rx="1" />
          <rect x="10" y="2.500" width="3" height="8.500" rx="1" />
          <rect x="15" y="0" width="3" height="11" rx="1" />
        </svg>
        <svg width="26" height="12" viewBox="0 0 26 12">
          <rect x="0.5" y="0.5" width="22" height="11" rx="3.500" fill="none" stroke={INK} opacity=".45" />
          <rect x="2.500" y="2.500" width="16" height="7" rx="2" fill={INK} />
          <rect x="23.500" y="4" width="2" height="4" rx="1" fill={INK} opacity=".45" />
        </svg>
      </span>
    </div>
  )
}

const NAV = [
  ['recordings', 'wave', 'Recordings'],
  ['folders', 'folder', 'Folders'],
  ['record', 'mic', ''],
  ['settings', 'gear', 'Settings'],
]
const ORDER = ['recordings', 'folders', 'record', 'settings']
const sIdx = (t) => ORDER.indexOf(t)

// ---------------------------------------------------------------- app

export default function VoiceNotesApp({ name = 'Murmur', accent = '#e8452c', startScreen = 'recordings', frame = true, style }) {
  const box = useRef()
  const toastTimer = useRef()
  const levels = useRef([]) // the take being recorded
  const gen = useRef({ env: 0, target: 0, n: 0 })
  const [scale, setScale] = useState(1)
  const [tab, setTab] = useState(startScreen === 'playback' ? 'recordings' : startScreen)
  const [stack, setStack] = useState(startScreen === 'playback' ? [{ id: 'playback', rec: 'r1' }] : [])
  const [dir, setDir] = useState(1)
  const [recs, setRecs] = useState(SEED)
  const [folders, setFolders] = useState(FOLDERS)
  const [filter, setFilter] = useState('All')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('new')
  const [edit, setEdit] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const [toast, setToast] = useState('')
  const [st, setSt] = useState('idle') // idle | rec | paused | review
  const [, setTick] = useState(0)
  const [level, setLevel] = useState(0)
  const [draft, setDraft] = useState({ title: '', folder: 'Work' })
  const [playing, setPlaying] = useState(false)
  const [pos, setPos] = useState(0)
  const [speed, setSpeed] = useState(1)
  const [trim, setTrim] = useState(null)
  const [renaming, setRenaming] = useState(false)
  const [newFolder, setNewFolder] = useState('')
  const [set, setSet] = useState({ quality: 'High', autoPause: true, skipSilence: false, defSpeed: 1, defFolder: 'Work', haptics: true })
  const setRef = useRef(set)
  setRef.current = set

  useEffect(() => {
    setTab(startScreen === 'playback' ? 'recordings' : startScreen)
    setStack(startScreen === 'playback' ? [{ id: 'playback', rec: 'r1' }] : [])
    setPlaying(false)
    setPos(0)
    setTrim(null)
  }, [startScreen])

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
  const cur = top?.id === 'playback' ? recs.find((r) => r.id === top.rec) : null
  const curDur = cur ? cur.levels.length / 10 : 0

  // simulated microphone: runs while recording, even if you leave the page
  useEffect(() => {
    if (st !== 'rec') return undefined
    const id = setInterval(() => {
      const g = gen.current
      if (g.n % (7 + (g.n % 5)) === 0) g.target = Math.random() < 0.2 ? 0.02 : 0.3 + Math.random() * 0.65
      g.n++
      g.env += (g.target - g.env) * 0.4
      const v = clamp(g.env * (0.65 + 0.35 * Math.random()))
      setLevel(v)
      if (setRef.current.autoPause && v < 0.06) return // silence is skipped
      levels.current.push(v)
      setTick((t) => t + 1)
    }, TICK)
    return () => clearInterval(id)
  }, [st])

  // playback cursor
  useEffect(() => {
    if (!playing || !curDur) return undefined
    const id = setInterval(() => {
      setPos((p) => {
        const i = Math.min(cur.levels.length - 1, Math.floor(p * cur.levels.length))
        const quiet = setRef.current.skipSilence && cur.levels[i] < 0.06
        const next = p + ((0.06 * speed * (quiet ? 5 : 1)) / curDur)
        const end = trim ? trim.b : 1
        if (next >= end) {
          setPlaying(false)
          return end
        }
        return next
      })
    }, 60)
    return () => clearInterval(id)
  }, [playing, curDur, speed, cur?.id, trim]) // eslint-disable-line react-hooks/exhaustive-deps

  const push = (s) => (setDir(1), setStack((a) => [...a, s]))
  const pop = () => (setDir(-1), setStack((a) => a.slice(0, -1)), setPlaying(false), setTrim(null), setRenaming(false), setConfirm(null))
  const go = (t) => {
    setDir(sIdx(t) >= sIdx(tab) ? 1 : -1)
    setTab(t)
    setStack([])
    setPlaying(false)
    setTrim(null)
    setConfirm(null)
    setEdit(false)
    setRenaming(false)
  }
  const open = (r, autoplay) => {
    setPos(0)
    setSpeed(set.defSpeed)
    setTrim(null)
    setPlaying(!!autoplay)
    push({ id: 'playback', rec: r.id })
  }
  const upd = (id, patch) => setRecs((a) => a.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  const del = (id) => {
    setRecs((a) => a.filter((r) => r.id !== id))
    setConfirm(null)
    say('Recording deleted')
  }

  // recording controls
  const startRec = () => {
    levels.current = []
    gen.current = { env: 0, target: 0, n: 0 }
    setSt('rec')
  }
  const stopRec = () => {
    if (levels.current.length < 5) {
      setSt('idle')
      say('Too short, nothing saved')
      return
    }
    setDraft({ title: `Recording ${recs.length + 1}`, folder: set.defFolder })
    setSt('review')
  }
  const saveRec = () => {
    const r = { id: `r${Date.now()}`, title: draft.title.trim() || 'Untitled', folder: draft.folder, day: 'Today', time: clockNow(), fav: false, levels: levels.current.slice() }
    setRecs((a) => [r, ...a])
    levels.current = []
    setSt('idle')
    setDir(1)
    setTab('recordings')
    setStack([])
    open(r, false)
    say('Saved to ' + r.folder)
  }
  const discardRec = () => {
    levels.current = []
    setSt('idle')
    say('Recording discarded')
  }

  const applyTrim = () => {
    const a = Math.floor(trim.a * cur.levels.length)
    const b = Math.max(a + 5, Math.ceil(trim.b * cur.levels.length))
    upd(cur.id, { levels: cur.levels.slice(a, b) })
    setTrim(null)
    setPos(0)
    setPlaying(false)
    say(`Trimmed to ${mmss((b - a) / 10)}`)
  }

  // ---- shared bits
  const iconBtn = { width: 38, height: 38, borderRadius: '50%', border: 'none', background: CARD, color: INK, display: 'grid', placeItems: 'center', cursor: 'pointer', padding: 0, boxShadow: '0 1px 3px rgba(60,40,20,.12)' }
  const header = (title, back, right) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px 6px', minHeight: 48 }}>
      {back && <button type="button" onClick={back} aria-label="Back" style={iconBtn}><Icon name="back" size={20} /></button>}
      <h1 style={{ margin: 0, flex: 1, fontFamily: "Georgia, 'Times New Roman', serif", fontSize: back ? 19 : 30, fontWeight: 700, letterSpacing: '-0.01em', marginLeft: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</h1>
      {right}
    </div>
  )
  const chip = (label, on, onClick) => (
    <button key={label} type="button" onClick={onClick} aria-pressed={on} style={{ flex: 'none', height: 34, padding: '0 15px', borderRadius: 17, border: `1px solid ${on ? accent : LINE}`, background: on ? accent : CARD, color: on ? '#fff' : INK, font: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{label}</button>
  )
  const toggle = (on, setter, label) => (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => setter(!on)} style={{ width: 48, height: 28, borderRadius: 14, border: 'none', padding: 3, background: on ? accent : '#d6cabd', cursor: 'pointer', transition: 'background .2s', flex: 'none' }}>
      <span style={{ display: 'block', width: 22, height: 22, borderRadius: '50%', background: '#fff', transform: `translateX(${on ? 20 : 0}px)`, transition: 'transform .2s' }} />
    </button>
  )
  const primary = (label, onClick, bg) => (
    <button type="button" onClick={onClick} style={{ width: '100%', height: 52, borderRadius: 26, border: 'none', background: bg || accent, color: '#fff', font: 'inherit', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>{label}</button>
  )

  const recRow = (r) => (
    <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 10px 10px 12px', borderRadius: 20, background: CARD, boxShadow: '0 1px 3px rgba(60,40,20,.08)' }}>
      <button type="button" onClick={() => open(r, true)} aria-label={`Play ${r.title}`} style={{ width: 44, height: 44, borderRadius: '50%', border: 'none', background: `${accent}1f`, color: accent, display: 'grid', placeItems: 'center', cursor: 'pointer', padding: 0, flex: 'none' }}><Icon name="play" size={20} /></button>
      <button type="button" onClick={() => open(r, false)} style={{ flex: 1, minWidth: 0, border: 'none', background: 'none', padding: 0, font: 'inherit', color: INK, textAlign: 'left', cursor: 'pointer' }}>
        <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontSize: 14.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.title}</span>
          <span style={{ fontSize: 12.5, color: MUTED, fontVariantNumeric: 'tabular-nums', flex: 'none' }}>{mmss(r.levels.length / 10)}</span>
        </span>
        <span style={{ display: 'block', margin: '4px 0 2px' }}><MiniWave levels={r.levels} color={accent} /></span>
        <span style={{ display: 'block', fontSize: 11.5, color: MUTED }}>{r.folder} · {r.day}, {r.time}</span>
      </button>
      {edit ? (
        <button type="button" onClick={() => (confirm === r.id ? del(r.id) : setConfirm(r.id))} aria-label={`Delete ${r.title}`} style={{ height: 36, minWidth: 36, padding: confirm === r.id ? '0 10px' : 0, borderRadius: 18, border: 'none', background: confirm === r.id ? '#dc2626' : '#f3e9df', color: confirm === r.id ? '#fff' : '#b45309', font: 'inherit', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'grid', placeItems: 'center' }}>{confirm === r.id ? 'Delete?' : <Icon name="trash" size={17} />}</button>
      ) : (
        <button type="button" onClick={() => upd(r.id, { fav: !r.fav })} aria-pressed={r.fav} aria-label={r.fav ? 'Remove favourite' : 'Add favourite'} style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: 'none', color: r.fav ? '#f5b301' : '#cbbfb2', cursor: 'pointer', display: 'grid', placeItems: 'center', padding: 0 }}><Icon name="star" size={20} fill={r.fav ? '#f5b301' : 'none'} w={r.fav ? 1 : 1.8} /></button>
      )}
    </div>
  )

  const card = { margin: '0 16px', padding: '2px 16px', background: CARD, borderRadius: 22, boxShadow: '0 1px 3px rgba(60,40,20,.08)' }
  const setRow = (label, sub, ctl, last) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '13px 0', borderBottom: last ? 'none' : `1px solid ${LINE}` }}>
      <span><span style={{ display: 'block', fontSize: 14, fontWeight: 600 }}>{label}</span>{sub && <span style={{ display: 'block', fontSize: 12, color: MUTED, marginTop: 2 }}>{sub}</span>}</span>
      {ctl}
    </div>
  )

  // ---- screens
  let body
  let tabbed = true
  const recording = st === 'rec' || st === 'paused'
  if (top?.id === 'playback') {
    tabbed = false
    if (!cur) {
      body = <>{header('Playback', pop)}<div style={{ padding: 40, textAlign: 'center', color: MUTED }}>This recording was deleted.</div></>
    } else {
      const secs = curDur
      const lo = trim ? trim.a * secs : 0
      const hi = trim ? trim.b * secs : secs
      body = (
        <>
          {header('Playback', pop, (
            <>
              <button type="button" onClick={() => upd(cur.id, { fav: !cur.fav })} aria-pressed={cur.fav} aria-label="Favourite" style={{ ...iconBtn, color: cur.fav ? '#f5b301' : INK }}><Icon name="star" size={19} fill={cur.fav ? '#f5b301' : 'none'} w={cur.fav ? 1 : 1.9} /></button>
              <button type="button" onClick={() => (confirm === cur.id ? (del(cur.id), pop()) : setConfirm(cur.id))} aria-label="Delete" style={{ ...iconBtn, width: confirm === cur.id ? 'auto' : 38, padding: confirm === cur.id ? '0 14px' : 0, background: confirm === cur.id ? '#dc2626' : CARD, color: confirm === cur.id ? '#fff' : INK, font: 'inherit', fontSize: 12.5, fontWeight: 700, borderRadius: 19 }}>{confirm === cur.id ? 'Delete?' : <Icon name="trash" size={19} />}</button>
            </>
          ))}
          <div style={{ padding: '12px 20px 0' }}>
            {renaming ? (
              <input autoFocus value={cur.title} onChange={(e) => upd(cur.id, { title: e.target.value.slice(0, 40) })} onBlur={() => setRenaming(false)} onKeyDown={(e) => e.key === 'Enter' && setRenaming(false)} aria-label="Recording name" style={{ width: '100%', boxSizing: 'border-box', height: 44, borderRadius: 14, border: `2px solid ${accent}`, background: CARD, color: INK, padding: '0 12px', fontFamily: "Georgia, serif", fontSize: 21, fontWeight: 700 }} />
            ) : (
              <button type="button" onClick={() => setRenaming(true)} aria-label="Rename recording" style={{ display: 'flex', alignItems: 'center', gap: 8, border: 'none', background: 'none', padding: 0, color: INK, cursor: 'pointer', maxWidth: '100%' }}>
                <span style={{ fontFamily: 'Georgia, serif', fontSize: 24, fontWeight: 700, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cur.title}</span>
                <Icon name="edit" size={16} color={MUTED} />
              </button>
            )}
            <div style={{ fontSize: 12.5, color: MUTED, marginTop: 4 }}>{cur.folder} · {cur.day}, {cur.time}</div>
          </div>
          <div style={{ margin: '18px 16px 0', padding: '22px 14px 12px', background: CARD, borderRadius: 26, boxShadow: '0 1px 3px rgba(60,40,20,.08)' }}>
            <Scrubber levels={cur.levels} pos={pos} onSeek={setPos} trim={trim} onTrim={(a, b) => setTrim({ a, b })} accent={accent} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: MUTED, fontVariantNumeric: 'tabular-nums', marginTop: 10 }}>
              <span style={{ color: INK, fontWeight: 700 }}>{mmss(pos * secs)}</span>
              <span>{trim ? `Keep ${mmss(lo)} to ${mmss(hi)}` : mmss(secs)}</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 26, padding: '20px 0 10px' }}>
            <button type="button" onClick={() => setPos((p) => clamp(p - 5 / secs))} aria-label="Back 5 seconds" style={{ ...iconBtn, width: 48, height: 48, background: 'none', boxShadow: 'none' }}><Icon name="back5" size={30} /></button>
            <button type="button" onClick={() => (pos >= (trim ? trim.b : 1) - 0.002 && setPos(trim ? trim.a : 0), setPlaying((p) => !p))} aria-label={playing ? 'Pause' : 'Play'} style={{ width: 70, height: 70, borderRadius: '50%', border: 'none', background: accent, color: '#fff', display: 'grid', placeItems: 'center', cursor: 'pointer', boxShadow: `0 10px 22px ${accent}55`, padding: 0 }}><Icon name={playing ? 'pause' : 'play'} size={30} /></button>
            <button type="button" onClick={() => setPos((p) => clamp(p + 5 / secs))} aria-label="Forward 5 seconds" style={{ ...iconBtn, width: 48, height: 48, background: 'none', boxShadow: 'none' }}><Icon name="fwd5" size={30} /></button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: '6px 16px' }} role="group" aria-label="Playback speed">
            {SPEEDS.map((s) => chip(`${s}x`, speed === s, () => setSpeed(s)))}
          </div>
          {trim ? (
            <div style={{ display: 'flex', gap: 10, padding: '14px 16px 0' }}>
              <button type="button" onClick={() => setTrim(null)} style={{ flex: 1, height: 48, borderRadius: 24, border: `1px solid ${LINE}`, background: CARD, color: INK, font: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
              <button type="button" onClick={applyTrim} style={{ flex: 1.4, height: 48, borderRadius: 24, border: 'none', background: '#f5b301', color: '#3b2a00', font: 'inherit', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>Apply trim</button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 10, padding: '14px 16px 0' }}>
              <button type="button" onClick={() => setTrim({ a: 0.1, b: 0.9 })} style={{ flex: 1, height: 46, borderRadius: 23, border: 'none', background: CARD, color: INK, font: 'inherit', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, boxShadow: '0 1px 3px rgba(60,40,20,.1)' }}><Icon name="scissors" size={17} />Trim</button>
              <button type="button" onClick={() => say('Share link copied')} style={{ flex: 1, height: 46, borderRadius: 23, border: 'none', background: CARD, color: INK, font: 'inherit', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, boxShadow: '0 1px 3px rgba(60,40,20,.1)' }}><Icon name="share" size={17} />Share</button>
            </div>
          )}
          <div style={{ padding: '16px 16px 0' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Folder</div>
            <div className="vn-scroll" style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
              {folders.map((f) => chip(f, cur.folder === f, () => (upd(cur.id, { folder: f }), say(`Moved to ${f}`))))}
            </div>
          </div>
        </>
      )
    }
  } else if (top?.id === 'folder') {
    tabbed = false
    const list = recs.filter((r) => (top.name === 'Favourites' ? r.fav : r.folder === top.name))
    const custom = !FOLDERS.includes(top.name) && top.name !== 'Favourites'
    body = (
      <>
        {header(top.name, pop, custom && <button type="button" onClick={() => (list.length ? say('Move its recordings first') : (setFolders((a) => a.filter((f) => f !== top.name)), pop(), say('Folder deleted')))} aria-label="Delete folder" style={iconBtn}><Icon name="trash" size={19} /></button>)}
        <div style={{ padding: '0 16px 10px', fontSize: 13, color: MUTED }}>{list.length} recording{list.length === 1 ? '' : 's'}</div>
        <div style={{ display: 'grid', gap: 10, padding: '0 16px' }}>
          {list.map(recRow)}
          {!list.length && <div style={{ textAlign: 'center', color: MUTED, fontSize: 13, padding: '40px 0' }}>Nothing here yet. Move a recording into this folder from Playback.</div>}
        </div>
      </>
    )
  } else if (tab === 'recordings') {
    const q = query.trim().toLowerCase()
    let list = recs.filter((r) => (filter === 'All' ? true : filter === 'Favourites' ? r.fav : r.folder === filter) && (!q || r.title.toLowerCase().includes(q)))
    if (sort === 'long') list = [...list].sort((a, b) => b.levels.length - a.levels.length)
    body = (
      <>
        {header('Voice Notes', null, (
          <button type="button" onClick={() => (setEdit(!edit), setConfirm(null))} style={{ height: 36, padding: '0 16px', borderRadius: 18, border: 'none', background: edit ? INK : CARD, color: edit ? '#fff' : INK, font: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 1px 3px rgba(60,40,20,.12)' }}>{edit ? 'Done' : 'Edit'}</button>
        ))}
        <div style={{ padding: '4px 16px 10px', display: 'flex', gap: 8 }}>
          <label style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, height: 42, borderRadius: 21, background: CARD, padding: '0 14px', color: MUTED, boxShadow: '0 1px 3px rgba(60,40,20,.08)' }}>
            <Icon name="search" size={18} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search recordings" aria-label="Search recordings" style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'none', font: 'inherit', fontSize: 14, color: INK }} />
            {query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search" style={{ border: 'none', background: 'none', color: MUTED, cursor: 'pointer', padding: 0, display: 'grid' }}><Icon name="x" size={16} /></button>}
          </label>
          <button type="button" onClick={() => setSort(sort === 'new' ? 'long' : 'new')} aria-label={`Sort: ${sort === 'new' ? 'newest first' : 'longest first'}`} style={{ height: 42, padding: '0 14px', borderRadius: 21, border: 'none', background: CARD, color: INK, font: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', boxShadow: '0 1px 3px rgba(60,40,20,.08)' }}>{sort === 'new' ? 'Newest' : 'Longest'}</button>
        </div>
        <div className="vn-scroll" style={{ display: 'flex', gap: 8, padding: '0 16px 12px', overflowX: 'auto' }} role="group" aria-label="Filter by folder">
          {['All', 'Favourites', ...folders].map((f) => chip(f, filter === f, () => setFilter(f)))}
        </div>
        <div style={{ display: 'grid', gap: 10, padding: '0 16px' }}>
          {list.map(recRow)}
          {!list.length && <div style={{ textAlign: 'center', color: MUTED, fontSize: 13, padding: '40px 0' }}>No recordings match. Tap the red mic to make one.</div>}
        </div>
      </>
    )
  } else if (tab === 'record') {
    const n = levels.current.length
    const BARS = 60
    const recent = levels.current.slice(-BARS)
    const pad = BARS - recent.length
    const secs = n / 10
    body = (
      <>
        {header('Record')}
        <div style={{ textAlign: 'center', padding: '20px 20px 0' }}>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 58, fontWeight: 700, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', color: st === 'paused' ? MUTED : INK }}>{mmsst(secs)}</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: st === 'rec' ? accent : MUTED, marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {st === 'rec' && <i className="vn-blink" style={{ width: 8, height: 8, borderRadius: 4, background: accent }} />}
            {st === 'idle' ? 'Ready' : st === 'rec' ? (set.autoPause && level < 0.06 ? 'Listening, paused on silence' : 'Recording') : 'Paused'}
          </div>
        </div>
        <div style={{ margin: '26px 16px 0', height: 190, borderRadius: 26, background: CARD, boxShadow: '0 1px 3px rgba(60,40,20,.08)', position: 'relative', overflow: 'hidden' }}>
          <svg viewBox={`0 0 ${BARS * 6} 190`} width="100%" height="190" preserveAspectRatio="none" aria-label="Live waveform" role="img">
            <line x1="0" x2={BARS * 6} y1="95" y2="95" stroke={LINE} strokeWidth="1" />
            {Array.from({ length: BARS }, (_, i) => {
              const v = i < pad ? 0 : recent[i - pad]
              const h = Math.max(3, v * 150)
              return <rect key={i} x={i * 6 + 1} y={95 - h / 2} width="3.600" height={h} rx="1.800" fill={st === 'paused' ? '#cdbfb2' : accent} opacity={i < pad ? 0.35 : 0.35 + 0.65 * (i / BARS)} fillOpacity={i < pad ? 0.5 : 1} />
            })}
          </svg>
          <div style={{ position: 'absolute', right: 10, top: 10, width: 6, height: 40, borderRadius: 3, background: '#efe6db', overflow: 'hidden' }} aria-hidden="true">
            <i style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: `${st === 'rec' ? level * 100 : 0}%`, background: accent }} />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 34, padding: '34px 0 0' }}>
          <button type="button" disabled={!recording} onClick={() => setSt(st === 'rec' ? 'paused' : 'rec')} aria-label={st === 'paused' ? 'Resume' : 'Pause'} style={{ width: 62, height: 62, borderRadius: '50%', border: 'none', background: CARD, color: INK, display: 'grid', placeItems: 'center', cursor: recording ? 'pointer' : 'default', opacity: recording ? 1 : 0.4, boxShadow: '0 2px 6px rgba(60,40,20,.15)', padding: 0 }}><Icon name={st === 'paused' ? 'play' : 'pause'} size={24} /></button>
          <button type="button" onClick={recording ? stopRec : startRec} aria-label={recording ? 'Stop and save' : 'Start recording'} style={{ width: 92, height: 92, borderRadius: '50%', border: `5px solid ${accent}33`, background: accent, color: '#fff', display: 'grid', placeItems: 'center', cursor: 'pointer', boxShadow: `0 14px 30px ${accent}66`, padding: 0 }}>
            <Icon name={recording ? 'stop' : 'mic'} size={recording ? 30 : 38} />
          </button>
          <button type="button" disabled={!recording} onClick={() => (levels.current = [], setSt('idle'), say('Take cleared'))} aria-label="Discard take" style={{ width: 62, height: 62, borderRadius: '50%', border: 'none', background: CARD, color: INK, display: 'grid', placeItems: 'center', cursor: recording ? 'pointer' : 'default', opacity: recording ? 1 : 0.4, boxShadow: '0 2px 6px rgba(60,40,20,.15)', padding: 0 }}><Icon name="trash" size={22} /></button>
        </div>
        <div style={{ textAlign: 'center', color: MUTED, fontSize: 12.5, padding: '18px 40px 0' }}>{recording ? 'Tap the square to stop and save. Leaving this page keeps recording.' : 'Tap the mic to start. Levels are simulated, no microphone is used.'}</div>
      </>
    )
  } else if (tab === 'folders') {
    const rows = [['Favourites', recs.filter((r) => r.fav).length, 'star'], ...folders.map((f) => [f, recs.filter((r) => r.folder === f).length, 'folder'])]
    body = (
      <>
        {header('Folders')}
        <div style={{ display: 'grid', gap: 10, padding: '4px 16px 0' }}>
          <button type="button" onClick={() => (setFilter('All'), go('recordings'))} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px', border: 'none', borderRadius: 20, background: CARD, font: 'inherit', textAlign: 'left', cursor: 'pointer', color: INK, boxShadow: '0 1px 3px rgba(60,40,20,.08)' }}>
            <span style={{ width: 42, height: 42, borderRadius: 14, display: 'grid', placeItems: 'center', background: `${accent}1f`, color: accent }}><Icon name="wave" size={20} /></span>
            <span style={{ flex: 1, fontSize: 15, fontWeight: 700 }}>All recordings</span>
            <span style={{ fontSize: 13, color: MUTED }}>{recs.length}</span>
            <Icon name="chev" size={17} color={MUTED} />
          </button>
          {rows.map(([f, c, ic]) => (
            <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button type="button" onClick={() => push({ id: 'folder', name: f })} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12, padding: '14px', border: 'none', borderRadius: 20, background: CARD, font: 'inherit', textAlign: 'left', cursor: 'pointer', color: INK, boxShadow: '0 1px 3px rgba(60,40,20,.08)' }}>
                <span style={{ width: 42, height: 42, borderRadius: 14, display: 'grid', placeItems: 'center', background: ic === 'star' ? '#fdf1c4' : '#efe6db', color: ic === 'star' ? '#b78600' : '#7a5f44' }}><Icon name={ic} size={20} /></span>
                <span style={{ flex: 1, fontSize: 15, fontWeight: 700 }}>{f}</span>
                <span style={{ fontSize: 13, color: MUTED }}>{c}</span>
                <Icon name="chev" size={17} color={MUTED} />
              </button>
              <button type="button" onClick={() => (setFilter(f), go('recordings'))} aria-label={`Filter Recordings by ${f}`} style={{ width: 44, height: 44, borderRadius: 14, border: 'none', background: filter === f ? accent : '#efe6db', color: filter === f ? '#fff' : '#7a5f44', display: 'grid', placeItems: 'center', cursor: 'pointer', padding: 0 }}><Icon name="search" size={18} /></button>
            </div>
          ))}
          <form onSubmit={(e) => {
            e.preventDefault()
            const nm = newFolder.trim()
            if (!nm || folders.includes(nm) || nm === 'Favourites' || nm === 'All') return say('Pick a different name')
            setFolders((a) => [...a, nm])
            setNewFolder('')
            say(`Folder "${nm}" created`)
          }} style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <input value={newFolder} onChange={(e) => setNewFolder(e.target.value.slice(0, 18))} placeholder="New folder name" aria-label="New folder name" style={{ flex: 1, height: 46, borderRadius: 23, border: `1px dashed ${accent}`, background: 'none', padding: '0 16px', font: 'inherit', fontSize: 14, color: INK }} />
            <button type="submit" aria-label="Create folder" disabled={!newFolder.trim()} style={{ width: 46, height: 46, borderRadius: '50%', border: 'none', background: newFolder.trim() ? accent : '#d6cabd', color: '#fff', display: 'grid', placeItems: 'center', cursor: 'pointer', padding: 0 }}><Icon name="plus" size={22} /></button>
          </form>
        </div>
      </>
    )
  } else {
    const secsAll = recs.reduce((s, r) => s + r.levels.length / 10, 0)
    const mb = (secsAll * RATE[set.quality]) / 1024
    body = (
      <>
        {header('Settings')}
        <div style={card}>
          <div style={{ padding: '13px 0', borderBottom: `1px solid ${LINE}` }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Recording quality</div>
            <div style={{ display: 'flex', gap: 8 }}>{Object.keys(RATE).map((q) => chip(q, set.quality === q, () => setSet((s) => ({ ...s, quality: q }))))}</div>
          </div>
          {setRow('Pause on silence', 'Quiet moments are not recorded', toggle(set.autoPause, (v) => setSet((s) => ({ ...s, autoPause: v })), 'Pause on silence'))}
          {setRow('Skip silence in playback', 'Jump over quiet parts', toggle(set.skipSilence, (v) => setSet((s) => ({ ...s, skipSilence: v })), 'Skip silence'))}
          {setRow('Haptic feedback', null, toggle(set.haptics, (v) => setSet((s) => ({ ...s, haptics: v })), 'Haptic feedback'), true)}
        </div>
        <div style={{ ...card, marginTop: 12, padding: '14px 16px' }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Default playback speed</div>
          <div style={{ display: 'flex', gap: 8 }}>{SPEEDS.map((s) => chip(`${s}x`, set.defSpeed === s, () => setSet((v) => ({ ...v, defSpeed: s }))))}</div>
          <div style={{ fontSize: 14, fontWeight: 600, margin: '16px 0 8px' }}>Save new recordings to</div>
          <div className="vn-scroll" style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>{folders.map((f) => chip(f, set.defFolder === f, () => setSet((v) => ({ ...v, defFolder: f }))))}</div>
        </div>
        <div style={{ ...card, marginTop: 12, padding: '14px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 600 }}><span>Storage</span><span style={{ color: MUTED }}>{mb.toFixed(1)} MB of 5 GB</span></div>
          <div style={{ height: 8, borderRadius: 4, background: '#efe6db', marginTop: 10, overflow: 'hidden' }}><i style={{ display: 'block', height: '100%', width: `${Math.max(1, (mb / 5120) * 100 * 40)}%`, background: accent, borderRadius: 4 }} /></div>
          <div style={{ fontSize: 12, color: MUTED, marginTop: 8 }}>{recs.length} recordings, {mmss(secsAll)} in total</div>
        </div>
        <div style={{ padding: '16px 16px', display: 'grid', gap: 10 }}>
          <button type="button" onClick={() => (confirm === 'all' ? (setRecs([]), setConfirm(null), say('All recordings deleted')) : setConfirm('all'))} style={{ height: 48, borderRadius: 24, border: 'none', background: confirm === 'all' ? '#dc2626' : CARD, color: confirm === 'all' ? '#fff' : '#dc2626', font: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>{confirm === 'all' ? 'Tap again to delete everything' : 'Delete all recordings'}</button>
          <button type="button" onClick={() => (setRecs(SEED), setFolders(FOLDERS), setFilter('All'), setConfirm(null), say('Demo reset'))} style={{ height: 48, borderRadius: 24, border: 'none', background: '#efe6db', color: INK, font: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Reset demo</button>
        </div>
      </>
    )
  }

  const phone = (
    <div style={{ position: 'relative', width: W, height: H, overflow: 'hidden', borderRadius: frame ? 46 : 0, background: PAPER, color: INK, fontFamily: "-apple-system, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif" }}>
      <style>{`
        @keyframes vn-r { from { opacity: 0; transform: translateX(34px) } to { opacity: 1; transform: none } }
        @keyframes vn-l { from { opacity: 0; transform: translateX(-34px) } to { opacity: 1; transform: none } }
        @keyframes vn-blink { 50% { opacity: .25 } }
        @keyframes vn-sheet { from { transform: translateY(100%) } to { transform: none } }
        .vn-blink { animation: vn-blink 1.1s ease-in-out infinite }
        .vn-scroll { scrollbar-width: none } .vn-scroll::-webkit-scrollbar { display: none }
        .vn-app button:focus-visible, .vn-app input:focus-visible, .vn-app [role=slider]:focus-visible { outline: 2px solid ${accent}; outline-offset: 2px }
        .vn-app input::placeholder { color: ${MUTED} }
        @media (prefers-reduced-motion: reduce) { .vn-blink { animation: none !important } }
      `}</style>
      <StatusBar frame={frame} />
      <div key={`${tab}/${stack.map((s) => s.id + (s.rec || s.name || '')).join('/')}`} className="vn-scroll" style={{ position: 'absolute', top: 54, bottom: tabbed ? 88 : 0, left: 0, right: 0, overflowY: 'auto', paddingBottom: 24, animation: `${dir > 0 ? 'vn-r' : 'vn-l'} .28s ease` }}>
        {body}
      </div>
      {recording && tab !== 'record' && (
        <button type="button" onClick={() => go('record')} style={{ position: 'absolute', left: 16, right: 16, bottom: 96, zIndex: 20, height: 46, borderRadius: 23, border: 'none', background: INK, color: '#fff', font: 'inherit', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <i className={st === 'rec' ? 'vn-blink' : ''} style={{ width: 9, height: 9, borderRadius: 5, background: accent }} />
          {st === 'rec' ? 'Recording' : 'Paused'} {mmsst(levels.current.length / 10)} · tap to open
        </button>
      )}
      {tabbed && (
        <nav aria-label="Main" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 88, background: CARD, borderRadius: '26px 26px 0 0', boxShadow: '0 -6px 20px rgba(60,40,20,.08)', display: 'flex', justifyContent: 'space-around', padding: '10px 8px 0', zIndex: 18 }}>
          {NAV.map(([id, icon, label]) =>
            id === 'record' ? (
              <button key={id} type="button" onClick={() => go('record')} aria-label="Record" aria-current={tab === id ? 'page' : undefined} style={{ width: 62, height: 62, marginTop: -26, borderRadius: '50%', border: `5px solid ${PAPER}`, background: accent, color: '#fff', display: 'grid', placeItems: 'center', cursor: 'pointer', boxShadow: `0 8px 18px ${accent}66`, padding: 0 }}>
                <Icon name={recording ? 'stop' : 'mic'} size={recording ? 22 : 26} />
              </button>
            ) : (
              <button key={id} type="button" onClick={() => go(id)} aria-current={tab === id ? 'page' : undefined} style={{ border: 'none', background: 'none', font: 'inherit', cursor: 'pointer', display: 'grid', justifyItems: 'center', alignContent: 'start', gap: 3, width: 78, height: 54, fontSize: 11, fontWeight: 600, color: tab === id ? accent : MUTED }}>
                <Icon name={icon} size={23} />
                {label}
              </button>
            ),
          )}
        </nav>
      )}
      {st === 'review' && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 35 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(36,27,23,.5)' }} />
          <div role="dialog" aria-label="Save recording" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '18px 18px 34px', borderRadius: '26px 26px 0 0', background: PAPER, animation: 'vn-sheet .3s cubic-bezier(.2,.8,.2,1)' }}>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 700 }}>Save recording</div>
            <div style={{ fontSize: 12.5, color: MUTED, margin: '2px 0 12px' }}>{mmss(levels.current.length / 10)} captured</div>
            <div style={{ background: CARD, borderRadius: 16, padding: '8px 10px', marginBottom: 12 }}><MiniWave levels={levels.current} color={accent} /></div>
            <input value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value.slice(0, 40) }))} aria-label="Recording title" style={{ width: '100%', boxSizing: 'border-box', height: 46, borderRadius: 14, border: `1px solid ${LINE}`, background: CARD, padding: '0 14px', font: 'inherit', fontSize: 15, fontWeight: 600, color: INK }} />
            <div className="vn-scroll" style={{ display: 'flex', gap: 8, overflowX: 'auto', margin: '12px 0 16px' }}>{folders.map((f) => chip(f, draft.folder === f, () => setDraft((d) => ({ ...d, folder: f }))))}</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={discardRec} style={{ flex: 1, height: 50, borderRadius: 25, border: `1px solid ${LINE}`, background: CARD, color: '#dc2626', font: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Discard</button>
              <button type="button" onClick={() => setSt('paused')} style={{ flex: 1, height: 50, borderRadius: 25, border: `1px solid ${LINE}`, background: CARD, color: INK, font: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Keep going</button>
              <div style={{ flex: 1.3 }}>{primary('Save', saveRec)}</div>
            </div>
          </div>
        </div>
      )}
      <div role="status" style={{ position: 'absolute', left: '50%', top: 58, zIndex: 45, transform: `translate(-50%, ${toast ? 0 : -90}px)`, transition: 'transform .35s cubic-bezier(.2,.8,.2,1)', padding: '10px 16px', borderRadius: 20, background: INK, color: '#fff', fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap' }}>{toast}</div>
      <div style={{ position: 'absolute', left: '50%', bottom: 8, width: 140, height: 5, marginLeft: -70, borderRadius: 3, background: INK, opacity: 0.8, zIndex: 50, pointerEvents: 'none' }} />
    </div>
  )

  return (
    <div ref={box} className="vn-app" aria-label={name} style={{ position: 'relative', width: '100%', height: '100%', display: 'grid', placeItems: 'center', overflow: 'hidden', background: 'radial-gradient(ellipse at 50% 30%, #f0e3d2, #cdb9a0 75%)', ...style }}>
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: `translate(-50%, -50%) scale(${scale})`, transformOrigin: 'center' }}>
        {frame ? (
          <div style={{ padding: 12, borderRadius: 58, background: 'linear-gradient(145deg, #3a3f4a, #14171d 40%, #2b2f38)', boxShadow: '0 40px 80px rgba(60,40,20,.35), inset 0 0 0 2px #4b515e' }}>
            <div style={{ padding: 2, borderRadius: 48, background: '#000' }}>{phone}</div>
          </div>
        ) : (
          phone
        )}
      </div>
    </div>
  )
}
