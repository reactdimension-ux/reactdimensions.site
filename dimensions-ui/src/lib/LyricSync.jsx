import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useOnScreen, useReducedMotion } from '../ui/onscreen.js'
import { contrast, textOn } from '../ui/color.js'

// Synced lyrics, the way Apple Music, Spotify and karaoke screens do them.
//
// The song is a standard timed-lyrics (LRC) text: `[mm:ss.xx] words`. Add
// `<mm:ss.xx>` before a word to time it exactly (enhanced LRC), otherwise the
// words share the line's time by their length. A long gap between lines
// becomes the three breathing dots. The built-in clock plays, pauses and
// scrubs; click a line to jump to it; scroll to look around and it eases back.
//
// Three looks share one engine:
//   Apple Music: the line you're on is large and bright and fills word by word,
//                the rest sit smaller and softly blurred by distance, and the
//                lines glide up with a slight cascade.
//   Spotify:     bold left-aligned lines on a colour field; sung lines stay
//                bright, upcoming lines are dim.
//   Karaoke:     centred, with a glowing pop on the word being sung.

export const DEMO_LRC = `[ti:Paper Boat]
[ar:Mira Vale]
[00:06.00] Streetlights hum a quiet tune
[00:09.80] While the sleepy city sways
[00:13.60] I fold the night into a boat
[00:17.40] And let it drift away
[00:22.00] Oh, <00:22.50>carry me, <00:24.00>carry me
[00:26.00] Down the silver stream
[00:30.00] Every little light I lost
[00:34.00] Is shining in a dream
[00:44.00] Morning spills on window glass
[00:47.80] Gold across the floor
[00:51.60] I hold the echo of your name
[00:55.40] And I don't need more
[01:00.00] Oh, <01:00.50>carry me, <01:02.00>carry me
[01:04.00] Down the silver stream
[01:08.00] Every little light I lost
[01:12.00] Is shining in a dream
[01:17.00] `

const stamp = (m, s) => Number(m) * 60 + Number(s)
const GAP_MIN = 5 // seconds of silence before the dots appear
const STAMPS = /\[(\d+):(\d+(?:\.\d+)?)\]/g
const hasStamps = (src) => /\[\d+:\d+(?:\.\d+)?\]/.test(src)
const stampText = (t) => {
  const cs = Math.max(0, Math.round(t * 100))
  return `${String(Math.floor(cs / 6000)).padStart(2, '0')}:${((cs % 6000) / 100).toFixed(2).padStart(5, '0')}`
}
// move every <mm:ss.xx> word time in a line by `delta` seconds
const shiftTags = (body, delta) => (delta === 0 ? body : body.replace(/<(\d+):(\d+(?:\.\d+)?)>/g, (_, m, s) => `<${stampText(stamp(m, s) + delta)}>`))

// Plain lyrics with no times at all: give each line a time from its length, so
// pasted words just work. A blank line is a short breath between verses.
export function autoTime(src) {
  let t = 1
  const out = []
  for (const row of String(src).split(/\r?\n/)) {
    if (/^\s*\[[a-z]{2,}:.*\]\s*$/i.test(row)) { out.push(row); continue }
    const text = row.trim()
    if (!text) { t += 1.6; continue }
    out.push(`[${stampText(t)}] ${text}`)
    t += Math.max(1.8, text.length * 0.09 + 1) + 0.4
  }
  out.push(`[${stampText(t)}] `)
  return out.join('\n')
}

// -> { lines: [{ t, end, type, words: [{ t, e, text }] }], duration, title, artist }
export function parseLrc(src) {
  src = String(src)
  if (!hasStamps(src) && /\S/.test(src.replace(/^\s*\[[a-z]{2,}:.*\]\s*$/gim, ''))) src = autoTime(src)
  const meta = {}
  const raw = []
  for (const row of src.split(/\r?\n/)) {
    const tag = row.match(/^\s*\[([a-z]{2,}):(.*)\]\s*$/i)
    if (tag) { meta[tag[1].toLowerCase()] = tag[2].trim(); continue }
    // one or more times in front: [00:12.00][01:30.00] repeats the line
    const m = row.match(/^((?:\s*\[\d+:\d+(?:\.\d+)?\])+)(.*)$/)
    if (!m) continue
    const times = [...m[1].matchAll(STAMPS)].map((x) => stamp(x[1], x[2]))
    times.forEach((t) => raw.push({ t0: t, t, body: shiftTags(m[2], t - times[0]) }))
  }
  // [offset:+500] makes the words come 500 ms sooner
  const off = (parseFloat(String(meta.offset || '0').replace('+', '')) || 0) / 1000
  if (off) raw.forEach((r) => { r.t = Math.max(0, r.t - off); r.body = shiftTags(r.body, -off) })
  raw.sort((a, b) => a.t - b.t)

  const lines = []
  raw.forEach((r, i) => {
    const text = r.body.replace(/<\d+:\d+(?:\.\d+)?>/g, '').trim()
    if (!text) return
    const next = raw.slice(i + 1).find((x) => x.t > r.t)
    const sung = Math.max(0.6, text.length * 0.095 + 0.6)
    const end = next ? Math.max(r.t + 0.6, Math.min(next.t - 0.12, r.t + sung)) : r.t + sung
    // words: explicit <mm:ss.xx> starts where given, otherwise shared by length
    const parts = []
    let cursor = null
    for (const piece of r.body.split(/(<\d+:\d+(?:\.\d+)?>)/)) {
      const tg = piece.match(/^<(\d+):(\d+(?:\.\d+)?)>$/)
      if (tg) { cursor = stamp(tg[1], tg[2]); continue }
      for (const w of piece.split(/\s+/).filter(Boolean)) { parts.push({ text: w, at: cursor }); cursor = null }
    }
    if (!parts.length) return
    const weight = parts.map((p) => p.text.length + 1)
    let acc = 0
    const total = weight.reduce((a, b) => a + b, 0)
    parts.forEach((p, k) => {
      if (p.at == null) p.at = r.t + ((end - r.t) * acc) / total
      acc += weight[k]
    })
    parts[0].at = r.t
    for (let k = 1; k < parts.length; k++) parts[k].at = Math.max(parts[k].at, parts[k - 1].at + 0.05)
    // a line never ends before its last timed word has been sung
    const lastAt = parts[parts.length - 1].at
    const lineEnd = lastAt + 0.4 > end ? Math.min(next ? next.t - 0.1 : Infinity, lastAt + 0.9) : end
    const words = parts.map((p, k) => ({ text: p.text, t: p.at, e: k + 1 < parts.length ? Math.max(p.at + 0.05, parts[k + 1].at) : Math.max(p.at + 0.2, lineEnd) }))
    lines.push({ t: r.t, t0: r.t0, end: lineEnd, type: 'line', text, words })
  })

  // breathing dots where the singer rests
  const withGaps = []
  const gap = (from, to) => {
    if (to - from < GAP_MIN) return
    const t = from + 0.4, end = to - 0.15
    const d = (end - t) / 3
    withGaps.push({ t, end, type: 'gap', text: '', words: [0, 1, 2].map((k) => ({ text: '', t: t + k * d, e: t + (k + 1) * d })) })
  }
  gap(0, lines[0]?.t ?? 0)
  lines.forEach((l, i) => { withGaps.push(l); if (lines[i + 1]) gap(l.end, lines[i + 1].t) })
  const duration = (lines.length ? lines[lines.length - 1].end : 0) + 2.5
  return { lines: withGaps, duration, title: meta.ti, artist: meta.ar }
}

// the line being sung at time t: the last one that has started
const lineAt = (L, t) => { let a = 0; for (let i = 0; i < L.length; i++) if (L[i].t <= t + 0.02) a = i; return a }
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
const clamp01 = (v) => Math.min(1, Math.max(0, v))

function hueShift(hex, deg) {
  let h = hex.replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  const n = parseInt(h, 16)
  const r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min
  let hh = 0, s = 0
  if (d) {
    s = d / (1 - Math.abs(2 * l - 1))
    hh = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
    hh *= 60
  }
  return `hsl(${Math.round((hh + deg + 360) % 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%)`
}

// the "upcoming" colour on a Spotify-style colour field: a shade of the field
// that is still readable (3:1, as large bold text may be) on it
function dimOn(bg) {
  const target = contrast('#000000', bg) >= 3.2 ? '#000000' : '#ffffff'
  const hex = (c) => c.replace('#', '')
  const mixHex = (a, b, t) => {
    const pa = parseInt(hex(a).padEnd(6, '0'), 16), pb = parseInt(hex(b).padEnd(6, '0'), 16)
    const ch = (s) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t)
    return '#' + [16, 8, 0].map((s) => ch(s).toString(16).padStart(2, '0')).join('')
  }
  let best = mixHex(bg, target, 0.5)
  for (let t = 0.35; t <= 0.9; t += 0.05) {
    best = mixHex(bg, target, t)
    if (contrast(best, bg) >= 3.2) break
  }
  return best
}

export default function LyricSync({
  lyrics = DEMO_LRC,
  look = 'Apple Music',
  title = '',
  artist = '',
  bgColor = '#0e0f14',
  textColor = '#ffffff',
  accentColor = '#7c5cff',
  size = 1,
  speed = 1,
  depthBlur = true,
  autoPlay = true,
  loop = true,
  showPlayer = true,
  style,
}) {
  const parsed = useMemo(() => parseLrc(lyrics), [lyrics])
  const { lines, duration } = parsed
  const songTitle = title || parsed.title || 'Paper Boat'
  const songArtist = artist || parsed.artist || 'Mira Vale'

  const root = useRef(null)
  const view = useRef(null)
  const list = useRef(null)
  const slider = useRef(null)
  const dragging = useRef(false)
  const clockEl = useRef(null)
  const visible = useOnScreen(root)
  const reduced = useReducedMotion()

  const [active, setActive] = useState(0)
  const [playing, setPlaying] = useState(autoPlay)
  const sim = useRef({
    time: 0, active: -1, playing: autoPlay, speed, loop, last: 0,
    off: [], tops: [], heights: [], H: 0, wheel: 0, wheelUntil: 0, manual: false, ready: false, sec: -1,
    p: new WeakMap(), lineEls: [], wordEls: [],
  })
  const live = useRef({ lines, duration, look, reduced })
  live.current = { lines, duration, look, reduced }
  sim.current.speed = speed
  sim.current.loop = loop

  // colours
  const fieldColor = look === 'Spotify' ? accentColor : bgColor
  const lit = look === 'Spotify' ? (contrast('#ffffff', accentColor) >= 3 ? '#ffffff' : textOn(accentColor)) : textColor
  const vars = {
    '--ly-bg': fieldColor,
    '--ly-lit': lit,
    '--ly-accent': accentColor,
    '--ly-dim': look === 'Spotify' ? dimOn(accentColor) : `color-mix(in srgb, ${lit} 52%, ${fieldColor})`,
    '--ly-b1': accentColor,
    '--ly-b2': hueShift(accentColor, 48),
    '--ly-b3': hueShift(accentColor, -52),
    '--ly-size': size,
  }

  // --- measuring: where each line sits, so the list can glide to the active one ---
  const measure = useCallback(() => {
    const s = sim.current
    const ul = list.current, v = view.current
    if (!ul || !v) return
    s.H = v.clientHeight
    s.tops = []
    s.heights = []
    Array.from(ul.children).forEach((li, i) => { s.tops[i] = li.offsetTop; s.heights[i] = li.offsetHeight })
  }, [])
  const anchor = () => sim.current.H * (live.current.look === 'Spotify' ? 0.34 : 0.36)
  const targetFor = (i) => {
    const s = sim.current
    const k = Math.min(Math.max(i, 0), s.tops.length - 1)
    return (s.tops[k] || 0) + (s.heights[k] || 0) / 2 - anchor()
  }

  useEffect(() => {
    measure()
    const ro = new ResizeObserver(() => { measure(); sim.current.ready = false })
    if (view.current) ro.observe(view.current)
    if (list.current) ro.observe(list.current)
    return () => ro.disconnect()
  }, [measure, lines, size, look])

  // collect element refs once the lines are on screen
  useEffect(() => {
    const s = sim.current
    s.lineEls = Array.from(list.current.children)
    s.wordEls = s.lineEls.map((li) => Array.from(li.querySelectorAll('[data-w]')))
    s.off = new Array(s.lineEls.length).fill(0)
    s.active = -1
    s.ready = false
    s.p = new WeakMap()
    measure()
  }, [lines, look, measure])

  const setP = (el, v) => {
    const s = sim.current
    const q = Math.round(v * 400) / 400
    if (s.p.get(el) === q) return
    s.p.set(el, q)
    el.style.setProperty('--p', q)
  }

  // --- the clock and the animation loop ---
  const seek = useCallback((t) => {
    const s = sim.current
    s.time = Math.min(Math.max(t, 0), live.current.duration)
    s.last = 0
    s.sec = -1
  }, [])

  useEffect(() => {
    if (!visible) return
    let raf = 0
    const tick = (now) => {
      raf = requestAnimationFrame(tick)
      const s = sim.current
      const { lines: L, duration: D, reduced: red } = live.current
      const dt = s.last ? Math.min((now - s.last) / 1000, 0.05) : 0
      s.last = now
      if (s.playing) {
        s.time += dt * s.speed
        if (s.time >= D) {
          if (s.loop) s.time = 0
          else { s.time = D; s.playing = false; setPlaying(false) }
        }
      }
      const t = s.time

      // which line are we on
      if (!L.length) return
      const a = lineAt(L, t)
      if (a !== s.active) {
        s.active = a
        setActive(a)
        // every other line is shown whole; the active one fills as it's sung
        s.wordEls.forEach((ws, i) => { if (i !== a) ws.forEach((w) => setP(w, 1)) })
      }
      const aw = s.wordEls[a] || []
      const line = L[a]
      const before = t < line.t
      aw.forEach((el, k) => {
        const w = line.words[k]
        const p = before ? 0 : clamp01((t - w.t) / Math.max(w.e - w.t, 0.05))
        setP(el, p)
        const cur = p > 0 && p < 1
        if (el.dataset.cur !== String(cur)) el.dataset.cur = String(cur)
      })

      // gliding: each line eases to its place, later lines a little behind
      if (s.tops.length) {
        let snap = false
        if (!s.ready) { measure(); s.ready = true; snap = true }
        if (performance.now() > s.wheelUntil) {
          s.wheel *= Math.exp(-dt * 6)
          if (Math.abs(s.wheel) < 2) s.wheel = 0
          if (s.manual && s.wheel === 0) { s.manual = false; root.current?.removeAttribute('data-manual') }
        }
        const base = targetFor(a) + s.wheel
        s.lineEls.forEach((el, i) => {
          const d = i - a
          const rate = red ? 80 : d > 0 ? 9.5 - Math.min(d, 8) * 0.85 : 9.5
          if (snap || dt === 0) s.off[i] = base
          else s.off[i] += (base - s.off[i]) * (1 - Math.exp(-dt * rate))
          el.style.transform = `translate3d(0, ${(-s.off[i]).toFixed(1)}px, 0)`
        })
      }

      // slider and clock readout, without re-rendering
      if (slider.current && !dragging.current) slider.current.value = t
      if (slider.current) slider.current.style.setProperty('--pp', `${(t / D) * 100}%`)
      const sec = Math.floor(t)
      if (sec !== s.sec) {
        s.sec = sec
        if (clockEl.current) clockEl.current.textContent = fmt(t)
        if (slider.current) slider.current.setAttribute('aria-valuetext', `${fmt(t)} of ${fmt(D)}`)
      }
    }
    raf = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf); sim.current.last = 0 }
  }, [visible, measure, lines])

  // scrolling with the wheel looks around the song, then the list eases back.
  // It takes the wheel only while it can still move that way, so the page
  // scrolls on as usual at the top and bottom.
  useEffect(() => {
    const el = view.current
    if (!el) return
    const onWheel = (e) => {
      const s = sim.current
      if (e.ctrlKey || !s.tops.length) return
      const L = live.current.lines
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY
      const lo = targetFor(0) - targetFor(s.active), hi = targetFor(L.length - 1) - targetFor(s.active)
      const next = Math.min(hi, Math.max(lo, s.wheel + dy))
      if (next === s.wheel) return
      e.preventDefault()
      s.wheel = next
      s.wheelUntil = performance.now() + 2600
      if (!s.manual) { s.manual = true; root.current?.setAttribute('data-manual', '') }
    }
    // the list is moved by transforms, so the box must never scroll itself
    // (focusing a line would otherwise scroll it into view and shift the lot)
    const noScroll = () => { if (el.scrollTop || el.scrollLeft) { el.scrollTop = 0; el.scrollLeft = 0 } }
    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('scroll', noScroll)
    return () => { el.removeEventListener('wheel', onWheel); el.removeEventListener('scroll', noScroll) }
  }, [])

  const toggle = () => {
    const s = sim.current
    if (!s.playing && s.time >= live.current.duration - 0.05) seek(0)
    s.playing = !s.playing
    setPlaying(s.playing)
  }
  const jump = (i) => { seek(lines[i].t + 0.001); sim.current.wheel = 0 }
  // keyboard: the lyrics are one tab stop. Up/Down step between lines (Up first
  // restarts the current line), Space or Enter plays and pauses.
  const onLyricsKey = (e) => {
    const s = sim.current
    const L = live.current.lines
    const real = (i, dir) => { while (i >= 0 && i < L.length && L[i].type === 'gap') i += dir; return i }
    if (e.key === 'ArrowDown' || e.key === 'PageDown') {
      e.preventDefault()
      const n = real(lineAt(L, s.time) + 1, 1)
      if (n < L.length) jump(n)
    } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
      e.preventDefault()
      const a = lineAt(L, s.time)
      const n = real(L[a]?.type === 'line' && s.time - L[a].t <= 1.2 ? a - 1 : a, -1)
      if (n >= 0) jump(n)
      else seek(0)
    } else if (e.key === 'Home') { e.preventDefault(); seek(0) }
    else if (e.key === 'End') { e.preventDefault(); seek(live.current.duration - 0.5) }
    else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle() }
  }
  const onSliderKey = (e) => {
    const step = { ArrowLeft: -5, ArrowRight: 5, PageDown: -15, PageUp: 15 }[e.key]
    if (step) { e.preventDefault(); seek(sim.current.time + step) }
    if (e.key === 'Home') { e.preventDefault(); seek(0) }
    if (e.key === 'End') { e.preventDefault(); seek(duration - 0.5) }
  }

  const word = (w, k, type) =>
    type === 'gap' ? (
      <span key={k} data-w="" className="ly-dot" />
    ) : (
      <span key={k}>
        <span data-w="" className="ly-w" aria-hidden="true">{w.text}</span>
        {' '}
      </span>
    )

  return (
    <div ref={root} className="ly-root" data-look={look} data-blur={depthBlur ? '' : undefined} data-paused={visible ? undefined : ''} style={{ ...vars, ...style }}>
      <style>{`
        .ly-root { position: relative; width: 100%; height: 100%; container-type: size; overflow: hidden; display: flex; flex-direction: column; background: var(--ly-bg); color: var(--ly-lit); font-family: ui-rounded, 'SF Pro Rounded', system-ui, -apple-system, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased; }
        :where(.ly-root) button { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; }
        .ly-root[data-paused] * { animation-play-state: paused !important; }
        .ly-bg { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
        .ly-bg i { position: absolute; width: 70%; aspect-ratio: 1; border-radius: 50%; filter: blur(48px); opacity: .5; will-change: transform; }
        .ly-bg i:nth-child(1) { left: -20%; top: -25%; background: var(--ly-b1); animation: ly-a 19s ease-in-out infinite alternate; }
        .ly-bg i:nth-child(2) { right: -25%; top: 20%; background: var(--ly-b2); animation: ly-b 23s ease-in-out infinite alternate; }
        .ly-bg i:nth-child(3) { left: 5%; bottom: -35%; background: var(--ly-b3); animation: ly-c 27s ease-in-out infinite alternate; }
        @keyframes ly-a { to { transform: translate(30%, 25%) scale(1.15); } }
        @keyframes ly-b { to { transform: translate(-28%, 18%) scale(.9); } }
        @keyframes ly-c { to { transform: translate(24%, -22%) scale(1.2); } }
        .ly-root[data-look='Spotify'] .ly-bg i { display: none; }
        .ly-root[data-look='Spotify'] .ly-bg { background: linear-gradient(180deg, rgba(255,255,255,.1), rgba(0,0,0,.18)); }
        .ly-shade { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(0,0,0,.3), rgba(0,0,0,.45)); pointer-events: none; }
        .ly-root[data-look='Spotify'] .ly-shade { display: none; }

        .ly-head { position: relative; z-index: 2; display: flex; align-items: center; gap: 12px; padding: 16px 20px 6px; }
        .ly-cover { width: 44px; height: 44px; border-radius: 9px; flex: none; background: linear-gradient(135deg, var(--ly-b2), var(--ly-b1) 55%, var(--ly-b3)); box-shadow: 0 6px 16px rgba(0,0,0,.35), inset 0 0 0 1px rgba(255,255,255,.2); display: grid; place-items: center; }
        .ly-cover svg { width: 20px; height: 20px; color: #fff; opacity: .9; }
        .ly-head b { display: block; font-size: 15px; letter-spacing: -.01em; }
        .ly-head small { display: block; margin-top: 2px; font-size: 13px; opacity: .82; }

        .ly-view { position: relative; z-index: 1; flex: 1; min-height: 0; overflow: hidden; overflow: clip; -webkit-mask-image: linear-gradient(180deg, transparent 0, #000 9%, #000 78%, transparent 100%); mask-image: linear-gradient(180deg, transparent 0, #000 9%, #000 78%, transparent 100%); }
        .ly-list { position: relative; margin: 0; padding: 0 clamp(18px, 6cqw, 52px); list-style: none; }
        .ly-li { position: relative; margin: 0; padding: clamp(5px, 1.2cqh, 12px) 0; will-change: transform; }
        .ly-line { display: block; width: 100%; text-align: left; border-radius: 14px; outline-offset: 2px; transform-origin: 0 55%; font-weight: 700; letter-spacing: -.025em; line-height: 1.16; font-size: calc(clamp(22px, 6.4cqw, 46px) * var(--ly-size)); transition: transform .55s cubic-bezier(.2,.8,.2,1), opacity .45s ease, filter .45s ease; }
        .ly-line:focus-visible { outline: 3px solid var(--ly-accent); }
        .ly-view:focus-visible { outline: 3px solid var(--ly-accent); outline-offset: -3px; border-radius: 12px; }

        /* the words: lit up to --p, dim after, with a soft edge between */
        .ly-w { color: var(--ly-lit); -webkit-text-fill-color: transparent; background: linear-gradient(90deg, var(--ly-lit) calc(var(--p, 1) * 124% - 24%), var(--ly-dim) calc(var(--p, 1) * 124%)); -webkit-background-clip: text; background-clip: text; display: inline-block; white-space: pre; transition: transform .3s cubic-bezier(.2,.8,.2,1), filter .3s; }
        .ly-dot { display: inline-block; width: .5em; height: .5em; margin-right: .3em; border-radius: 50%; background: var(--ly-lit); opacity: calc(.3 + var(--p, 1) * .7); transform: scale(calc(.8 + var(--p, 1) * .3)); }
        .ly-gap .ly-line { display: flex; align-items: center; height: 1.2em; }
        .ly-gap[data-on='true'] .ly-dot { animation: ly-breathe 2.4s ease-in-out infinite; }
        .ly-gap[data-on='true'] .ly-dot:nth-child(2) { animation-delay: .25s; } .ly-gap[data-on='true'] .ly-dot:nth-child(3) { animation-delay: .5s; }
        @keyframes ly-breathe { 50% { transform: scale(1.18); } }

        /* Apple Music: current line big and bright; others smaller, soft, blurred by distance */
        .ly-root[data-look='Apple Music'] .ly-line, .ly-root[data-look='Karaoke'] .ly-line { opacity: .5; transform: scale(.9); }
        .ly-root[data-look='Apple Music'][data-blur] .ly-line { filter: blur(calc(min(var(--d), 4) * .9px)); }
        .ly-root[data-look='Apple Music'] .ly-li[data-on='true'] .ly-line, .ly-root[data-look='Karaoke'] .ly-li[data-on='true'] .ly-line { opacity: 1; transform: scale(1); filter: none; }
        .ly-root[data-manual] .ly-line { filter: none !important; opacity: .75 !important; }

        /* Spotify: line-level colour, sung lines stay bright */
        .ly-root[data-look='Spotify'] .ly-line { font-size: calc(clamp(24px, 7cqw, 50px) * var(--ly-size)); font-weight: 800; letter-spacing: -.03em; }
        .ly-root[data-look='Spotify'] .ly-w { background: none; -webkit-text-fill-color: currentColor; color: var(--ly-dim); transition: color .35s ease; }
        .ly-root[data-look='Spotify'] .ly-li[data-past='true'] .ly-w, .ly-root[data-look='Spotify'] .ly-li[data-on='true'] .ly-w { color: var(--ly-lit); }
        .ly-root[data-look='Spotify'] .ly-dot { background: var(--ly-lit); }

        /* Karaoke: centred, the sung word pops with a glow */
        .ly-root[data-look='Karaoke'] .ly-line { text-align: center; transform-origin: 50% 55%; font-weight: 800; }
        .ly-root[data-look='Karaoke'] .ly-gap .ly-line { justify-content: center; }
        .ly-root[data-look='Karaoke'] .ly-li[data-on='true'] .ly-w { background: linear-gradient(90deg, var(--ly-accent) calc(var(--p, 1) * 124% - 24%), var(--ly-lit) calc(var(--p, 1) * 124%)); -webkit-background-clip: text; background-clip: text; }
        .ly-root[data-look='Karaoke'] .ly-li[data-on='true'] .ly-w[data-cur='true'] { transform: translateY(-.05em) scale(1.05); filter: drop-shadow(0 0 .35em color-mix(in srgb, var(--ly-accent) 80%, transparent)); }
        .ly-root[data-look='Karaoke'] .ly-li:not([data-on='true']) .ly-w { background: none; -webkit-text-fill-color: currentColor; color: var(--ly-lit); }

        .ly-bar { position: relative; z-index: 2; display: flex; align-items: center; gap: 12px; padding: 8px 20px 16px; font-size: 12px; font-variant-numeric: tabular-nums; }
        .ly-play { width: 40px; height: 40px; border-radius: 50%; flex: none; display: grid; place-items: center; background: var(--ly-lit); color: var(--ly-bg); transition: transform .15s; }
        .ly-play:active { transform: scale(.92); }
        .ly-play:focus-visible, .ly-seek:focus-visible { outline: 3px solid var(--ly-accent); outline-offset: 3px; }
        .ly-time { min-width: 2.6em; opacity: .9; }
        .ly-time:last-child { text-align: right; }
        .ly-seek { flex: 1; min-width: 0; height: 20px; margin: 0; background: transparent; -webkit-appearance: none; appearance: none; cursor: pointer; --pp: 0%; }
        .ly-seek::-webkit-slider-runnable-track { height: 4px; border-radius: 2px; background: linear-gradient(90deg, var(--ly-lit) var(--pp), color-mix(in srgb, var(--ly-lit) 30%, transparent) var(--pp)); }
        .ly-seek::-moz-range-track { height: 4px; border-radius: 2px; background: color-mix(in srgb, var(--ly-lit) 30%, transparent); }
        .ly-seek::-moz-range-progress { height: 4px; border-radius: 2px; background: var(--ly-lit); }
        .ly-seek::-webkit-slider-thumb { -webkit-appearance: none; width: 12px; height: 12px; margin-top: -4px; border-radius: 50%; background: var(--ly-lit); box-shadow: 0 1px 4px rgba(0,0,0,.4); }
        .ly-seek::-moz-range-thumb { width: 12px; height: 12px; border: 0; border-radius: 50%; background: var(--ly-lit); }
        @container (max-width: 420px) { .ly-head { padding: 12px 16px 4px; } .ly-bar { padding: 6px 16px 12px; gap: 8px; } }
        @media (prefers-reduced-motion: reduce) { .ly-bg i { animation: none; } .ly-line, .ly-w { transition: none; } .ly-gap[data-on='true'] .ly-dot { animation: none; } }
      `}</style>

      <div className="ly-bg" aria-hidden="true"><i /><i /><i /></div>
      <div className="ly-shade" aria-hidden="true" />

      {showPlayer && (
        <div className="ly-head">
          <div className="ly-cover" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 17.5V6.6l10-2v10.5a2.6 2.6 0 1 1-1.6-2.4V7.5L10.6 8.8v8.7A2.6 2.6 0 1 1 9 17.5Z" /></svg>
          </div>
          <div>
            <b>{songTitle}</b>
            <small>{songArtist}</small>
          </div>
        </div>
      )}

      <div ref={view} className="ly-view" role="region" tabIndex={0} aria-label={`Lyrics for ${songTitle}. Up and down arrows move between lines, space plays or pauses.`} onKeyDown={onLyricsKey}>
        <ol ref={list} className="ly-list">
          {lines.map((l, i) => (
            <li key={`${l.t}-${i}`} className={`ly-li${l.type === 'gap' ? ' ly-gap' : ''}`} data-on={i === active} data-past={i < active} style={{ '--d': Math.abs(i - active) }}>
              {l.type === 'gap' ? (
                <span className="ly-line" role="img" aria-label="Instrumental" aria-current={i === active ? 'true' : undefined}>
                  {l.words.map((w, k) => word(w, k, 'gap'))}
                </span>
              ) : (
                <button type="button" className="ly-line" aria-label={l.text} aria-current={i === active ? 'true' : undefined} tabIndex={-1} onClick={() => jump(i)}>
                  {l.words.map((w, k) => word(w, k, 'line'))}
                </button>
              )}
            </li>
          ))}
        </ol>
      </div>

      {showPlayer && (
        <div className="ly-bar">
          <button type="button" className="ly-play" aria-label={playing ? 'Pause' : 'Play'} onClick={toggle}>
            <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">{playing ? <path d="M5.5 4h3.2v12H5.5zM11.3 4h3.2v12h-3.2z" /> : <path d="M6.5 4.2v11.6L15.8 10z" />}</svg>
          </button>
          <span ref={clockEl} className="ly-time">0:00</span>
          <input
            ref={slider}
            className="ly-seek"
            type="range"
            min="0"
            max={duration}
            step="any"
            defaultValue="0"
            aria-label="Seek"
            onPointerDown={() => { dragging.current = true }}
            onPointerUp={() => { dragging.current = false }}
            onPointerCancel={() => { dragging.current = false }}
            onInput={(e) => seek(Number(e.target.value))}
            onKeyDown={onSliderKey}
          />
          <span className="ly-time">{fmt(duration)}</span>
        </div>
      )}
    </div>
  )
}
