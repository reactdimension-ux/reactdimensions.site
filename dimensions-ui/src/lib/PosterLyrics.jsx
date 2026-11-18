import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useOnScreen } from '../ui/onscreen.js'
import { parseLrc, autoTime } from './LyricSync.jsx'

// Poster lyrics: every line becomes a flat, three-colour poster scene, like the
// animated lyric videos made of big type and little drawings. Words are
// stretched to fill the frame, bent into an arch, laid on a road in
// perspective, or split around a drawing, and each word pops in as it is sung.
// A drawing (a boat, a moon, a lamp...) sits in the scene and moves with it.
//
// Lyrics are standard timed LRC text (see LyricSync). Start a line with
// {layout|drawing} to choose how it is set, e.g.
//   [00:26.00] {arch|waves} Down the silver stream
// Layouts: stack, arch, between, drive, perspective. Drawings: lamp, city,
// boat, moon, stars, sun, window, waves, heart, bird, cloud, key, note, leaf.
// Leave it out and the layout and drawing are picked from the words; use
// {|none} for a line with no drawing. Plain lyrics with no times are timed
// for you, and [00:12.00][01:30.00] repeats a line.

export const DEMO_POSTER_LRC = `[ti:Paper Boat]
[ar:Mira Vale]
[00:06.00] Streetlights hum a quiet tune
[00:09.80] While the sleepy city sways
[00:13.60] I fold the night into a boat
[00:17.40] {drive|boat} And let it drift away
[00:22.00] {drive|bird} Oh, <00:22.50>carry me, <00:24.00>carry me
[00:26.00] {arch|waves} Down the silver stream
[00:30.00] {stack|stars} Every little light I lost
[00:34.00] {perspective|moon} Is shining in a dream
[00:44.00] Morning spills on window glass
[00:47.80] {between|sun} Gold across the floor
[00:51.60] I hold the echo of your name
[00:55.40] {arch|heart} And I don't need more
[01:00.00] {drive|bird} Oh, <01:00.50>carry me, <01:02.00>carry me
[01:04.00] {arch|waves} Down the silver stream
[01:08.00] {stack|stars} Every little light I lost
[01:12.00] {perspective|moon} Is shining in a dream
[01:17.00] `

const LAYOUTS = ['stack', 'arch', 'between', 'drive', 'perspective']
const FONT = "Impact, Haettenschweiler, 'Arial Narrow Bold', 'Franklin Gothic Condensed', 'Helvetica Neue', Arial, sans-serif"
const CAP = 0.72 // cap height as a share of the font size
const CH = 0.84 // width of an average capital as a share of its height
const SP = 0.5 // a space, in capitals

const stamp = (m, s) => Number(m) * 60 + Number(s)

// {layout|drawing} hints are lifted off the lines before the normal LRC parse
function parsePoster(src) {
  src = String(src)
  if (!/\[\d+:\d+(?:\.\d+)?\]/.test(src) && /\S/.test(src.replace(/^\s*\[[a-z]{2,}:.*\]\s*$/gim, ''))) src = autoTime(src)
  const hints = new Map()
  const clean = src
    .split(/\r?\n/)
    .map((row) => {
      const m = row.match(/^((?:\s*\[\d+:\d+(?:\.\d+)?\])+)\s*\{([^}]*)\}\s*(.*)$/)
      if (!m) return row
      const [layout, icon] = m[2].split('|').map((x) => x.trim().toLowerCase())
      for (const t of m[1].matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g)) hints.set(stamp(t[1], t[2]).toFixed(2), { layout, icon })
      return `${m[1]} ${m[3]}`
    })
    .join('\n')
  const parsed = parseLrc(clean)
  let scene = 0
  const lines = parsed.lines.map((l) => ({ ...l, hint: (l.t0 !== undefined && hints.get(l.t0.toFixed(2))) || {}, scene: l.type === 'gap' ? -1 : scene++ }))
  return { ...parsed, lines }
}

// --- drawings, chosen from the words when not given ---
const KEYWORDS = [
  ['lamp', /street ?light|lamp/], ['city', /city|town|street/], ['boat', /boat|sail|drift|paper/], ['waves', /stream|river|water|sea|wave/],
  ['stars', /star|light|shin/], ['moon', /moon|dream|night|sleep/], ['window', /window|glass|morning/], ['sun', /sun|gold|floor|day/],
  ['heart', /heart|name|echo|love|hold/], ['bird', /carry|fly|wing|bird/], ['cloud', /cloud|rain|sky/], ['key', /key|door|lock|more|need/],
  ['note', /tune|song|sing|hum|music/], ['leaf', /leaf|green|grow/],
]
const ICON_ORDER = ['moon', 'boat', 'stars', 'lamp', 'sun', 'waves', 'heart', 'bird', 'city', 'window', 'note', 'leaf', 'cloud', 'key']
function matchIcon(text) {
  const t = text.toLowerCase()
  for (const [name, re] of KEYWORDS) if (re.test(t)) return name
  return null
}
// drawings: 'auto' picks by the words (or the next one in turn), 'matching'
// only draws when a word calls for it, 'off' draws nothing; a hint always wins
function pickIcon(line, n, mode) {
  const h = line.hint.icon
  if (h === 'none') return null
  if (ICONS[h]) return h
  if (mode === 'off') return null
  return matchIcon(line.text) || (mode === 'matching' ? null : ICON_ORDER[n % ICON_ORDER.length])
}
function pickLayout(line, n, hasIcon) {
  const words = line.words.length
  const chars = line.text.length
  if (words >= 6 || chars > 30) return 'stack'
  const order = ['between', 'arch', 'perspective', 'drive', 'stack']
  let l = order[n % order.length]
  if (l === 'between' && (words < 2 || words > 4 || chars > 22)) l = 'stack'
  if (l === 'arch' && (words < 2 || chars > 24)) l = 'stack'
  if (l === 'perspective' && chars > 28) l = 'stack'
  if (l === 'drive' && !hasIcon) l = 'stack'
  return l
}

// --- fitting words to a box, with no font measuring: SVG textLength does the stretch ---
const cw = (c) => ('Iil1.,;:\'!|'.includes(c) ? 0.45 : 'ftrj'.includes(c) ? 0.7 : 'MW'.includes(c) ? 1.25 : 'mw'.includes(c) ? 1.15 : 1)
const seg = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null
const graphemes = (s) => (seg ? Array.from(seg.segment(s), (x) => x.segment) : [...s])
const EMOJI = /\p{Extended_Pictographic}/u
const weightOf = (s) => graphemes(s).reduce((a, c) => a + (EMOJI.test(c) ? 1.5 : cw(c)), 0)
// scripts and emoji that stand taller than Latin capitals (Indic, CJK, emoji...)
const isTall = (w) => /[^\u0000-\u024F\u2000-\u206F]/.test(w)

// split words into at most R rows of even weight
function split(words, R) {
  const n = words.length
  R = Math.max(1, Math.min(R, n))
  const wt = words.map(weightOf)
  const pre = [0]
  wt.forEach((w, i) => pre.push(pre[i] + w + SP))
  const seg = (i, j) => pre[j] - pre[i] - SP
  const best = Array.from({ length: R + 1 }, () => Array(n + 1).fill(Infinity))
  const cut = Array.from({ length: R + 1 }, () => Array(n + 1).fill(0))
  best[0][0] = 0
  for (let r = 1; r <= R; r++) for (let j = r; j <= n; j++) for (let i = r - 1; i < j; i++) {
    const v = Math.max(best[r - 1][i], seg(i, j))
    if (v < best[r][j]) { best[r][j] = v; cut[r][j] = i }
  }
  const rows = []
  let j = n
  for (let r = R; r >= 1; r--) { const i = cut[r][j]; rows.unshift(words.slice(i, j)); j = i }
  return rows
}

// words laid out in a row of the given width: [{ text, x, w }] and the row's weight
function slots(words, width) {
  const total = words.reduce((a, w) => a + weightOf(w), 0) + SP * (words.length - 1)
  const scale = width / total
  let x = 0
  return words.map((text) => {
    const w = weightOf(text) * scale
    const it = { text, x, w }
    x += w + SP * scale
    return it
  })
}

// rows of words stretched to fill (x, y, w, h): rows with fewer letters are taller
function fitRows(words, box, { maxRows = 4 } = {}) {
  const chars = words.join('').length
  const R = Math.max(1, Math.min(Math.round(Math.sqrt(chars / 4)), maxRows, words.length))
  const rows = split(words, R)
  const caps = rows.map((r) => {
    const wt = r.reduce((a, w) => a + weightOf(w), 0) + SP * (r.length - 1)
    return box.w / (wt * CH)
  })
  const gap = (caps.reduce((a, b) => a + b, 0) / rows.length) * 0.16
  const T = caps.reduce((a, b) => a + b, 0) + gap * (rows.length - 1)
  const k = Math.min(3, Math.max(0.3, box.h / T))
  const used = T * k
  let y = box.y + (box.h - used) / 2
  return rows.map((r, i) => {
    const h = caps[i] * k
    const out = { y, h, items: slots(r, box.w).map((it) => ({ ...it, x: it.x + box.x })) }
    y += h + gap * k
    return out
  })
}

// --- the drawings, flat in two colours on a 100 x 100 sheet ---
const star = (cx, cy, s, fill, cls, style) => (
  <path className={cls} style={style} fill={fill} d={`M${cx} ${cy - s} L${cx + s * 0.25} ${cy - s * 0.25} L${cx + s} ${cy} L${cx + s * 0.25} ${cy + s * 0.25} L${cx} ${cy + s} L${cx - s * 0.25} ${cy + s * 0.25} L${cx - s} ${cy} L${cx - s * 0.25} ${cy - s * 0.25} Z`} />
)
const ICONS = {
  lamp: (a, b) => (
    <g>
      <path className="pl-glow" fill={b} opacity=".4" d="M38 32 H62 L84 94 H16 Z" />
      <rect x="47" y="26" width="6" height="68" fill={a} />
      <path fill={a} d="M26 32 Q50 2 74 32 Z" />
      <rect x="28" y="92" width="44" height="6" rx="3" fill={a} />
    </g>
  ),
  city: (a, b) => (
    <g className="pl-sway">
      {[[4, 44, 20], [26, 20, 22], [50, 34, 18], [70, 12, 26]].map(([x, y, w], i) => (
        <g key={i}>
          <rect x={x} y={y} width={w} height={96 - y} fill={a} />
          {[0, 1, 2, 3].map((r) => y + 8 + r * 16 < 88 && <rect key={r} x={x + 4} y={y + 8 + r * 16} width={w - 8} height="7" fill={b} />)}
        </g>
      ))}
    </g>
  ),
  boat: (a, b) => (
    <g>
      <g className="pl-bob">
        <path d="M8 62 H92 L76 82 H24 Z" fill={a} />
        <path d="M48 14 V58 H16 Z" fill={b} />
        <path d="M54 26 V58 H84 Z" fill={a} />
      </g>
      <path d="M0 90 Q12 80 25 90 T50 90 T75 90 T100 90" stroke={b} strokeWidth="5" fill="none" strokeLinecap="round" />
    </g>
  ),
  moon: (a, b) => (
    <g>
      <path className="pl-bob" fill={a} d="M60 8 A42 42 0 1 0 92 66 A34 34 0 1 1 60 8 Z" />
      {star(80, 22, 7, b, 'pl-twinkle')}{star(92, 44, 4, b, 'pl-twinkle', { animationDelay: '.6s' })}{star(66, 40, 4, b, 'pl-twinkle', { animationDelay: '1.2s' })}
    </g>
  ),
  stars: (a, b) => (
    <g>
      {star(50, 52, 30, a, 'pl-twinkle')}{star(18, 24, 14, b, 'pl-twinkle', { animationDelay: '.5s' })}{star(82, 24, 12, b, 'pl-twinkle', { animationDelay: '1s' })}{star(80, 82, 10, a, 'pl-twinkle', { animationDelay: '1.5s' })}{star(20, 80, 8, a, 'pl-twinkle', { animationDelay: '.2s' })}
    </g>
  ),
  sun: (a, b) => (
    <g>
      <g className="pl-spin">{Array.from({ length: 12 }, (_, i) => <rect key={i} x="47" y="2" width="6" height="18" rx="3" fill={b} transform={`rotate(${i * 30} 50 50)`} />)}</g>
      <circle cx="50" cy="50" r="26" fill={a} />
    </g>
  ),
  window: (a, b) => (
    <g>
      <rect x="12" y="8" width="76" height="84" rx="4" fill={a} />
      <rect className="pl-glow" x="20" y="16" width="60" height="68" fill={b} />
      <rect x="47" y="16" width="6" height="68" fill={a} /><rect x="20" y="47" width="60" height="6" fill={a} />
      <circle cx="34" cy="30" r="7" fill={a} opacity=".35" />
    </g>
  ),
  waves: (a, b) => (
    <g>
      {[22, 46, 70].map((y, i) => <path key={y} className="pl-flow" style={{ animationDelay: `${i * 0.4}s` }} d={`M-10 ${y} Q4 ${y - 12} 18 ${y} T46 ${y} T74 ${y} T102 ${y}`} stroke={i === 1 ? b : a} strokeWidth="9" fill="none" strokeLinecap="round" />)}
    </g>
  ),
  heart: (a, b) => (
    <g className="pl-beat">
      <path fill={a} d="M50 90 C6 58 10 18 34 18 C44 18 50 27 50 27 C50 27 56 18 66 18 C90 18 94 58 50 90 Z" />
      <path fill={b} d="M26 34 Q32 26 40 30" stroke={b} strokeWidth="5" strokeLinecap="round" opacity=".9" />
    </g>
  ),
  bird: (a, b) => (
    <g className="pl-flap">
      <path fill={a} d="M4 40 Q28 6 50 44 Q72 6 96 40 Q72 34 50 66 Q28 34 4 40 Z" />
      <circle cx="50" cy="48" r="5" fill={b} />
    </g>
  ),
  cloud: (a, b) => (
    <g>
      <g className="pl-bob"><path fill={a} d="M26 62 A18 18 0 0 1 30 28 A24 24 0 0 1 76 30 A16 16 0 0 1 76 62 Z" /></g>
      {[30, 50, 70].map((x, i) => <path key={x} className="pl-drip" style={{ animationDelay: `${i * 0.35}s` }} d={`M${x} 72 l-4 12 a5 5 0 1 0 8 0 z`} fill={b} />)}
    </g>
  ),
  key: (a, b) => (
    <g className="pl-bob">
      <circle cx="28" cy="50" r="20" fill={a} /><circle cx="28" cy="50" r="8" fill={b} />
      <rect x="46" y="45" width="46" height="10" fill={a} /><rect x="74" y="55" width="8" height="14" fill={a} /><rect x="86" y="55" width="6" height="10" fill={a} />
    </g>
  ),
  note: (a, b) => (
    <g className="pl-bob">
      <ellipse cx="32" cy="76" rx="18" ry="13" fill={a} transform="rotate(-18 32 76)" />
      <rect x="44" y="14" width="7" height="62" fill={a} />
      <path d="M51 14 Q82 20 80 52 Q70 32 51 34 Z" fill={b} />
    </g>
  ),
  leaf: (a, b) => (
    <g className="pl-sway">
      <path fill={a} d="M12 88 C6 40 40 8 90 10 C92 60 60 94 12 88 Z" />
      <path d="M14 86 C34 60 56 38 82 18" stroke={b} strokeWidth="5" fill="none" strokeLinecap="round" />
    </g>
  ),
}

// --- scenes ---
function sceneColors(n, A, B, C) {
  // alternate: berry field with marigold type, then teal field with berry type
  return n % 2 === 0 ? { bg: A, ink: B, accent: C } : { bg: C, ink: A, accent: B }
}

function Icon({ name, x, y, size, ink, accent, travel, pop = true }) {
  const draw = ICONS[name]
  if (!draw) return null
  return (
    <g data-travel={travel ? '' : undefined} transform={`translate(${x} ${y}) scale(${size / 100})`} className={pop ? 'pl-icon' : undefined}>
      {draw(ink, accent)}
    </g>
  )
}

const wordProps = (extra = {}) => ({ className: 'pl-w', 'data-w': '', ...extra })

function Row({ row, fill, hop }) {
  return row.items.map((it, k) => (
    <text key={k} {...wordProps({ 'data-cx': it.x + it.w / 2, 'data-hopper': hop ? '' : undefined })} x={it.x} y={row.y + row.h * (isTall(it.text) ? 0.84 : 1)} fontSize={row.h / (isTall(it.text) ? 1.05 : CAP)} textLength={it.w} lengthAdjust="spacingAndGlyphs" fill={fill}>
      {it.text.toUpperCase()}
    </text>
  ))
}

function Scene({ line, w, h, pad, layout, icon, colors, hasPlayer, big }) {
  const { bg, ink, accent } = colors
  const words = line.words.map((x) => x.text.replace(/[,.;:!?"“”()]/g, '') || x.text)
  const top = pad
  const bottom = h - (hasPlayer ? 66 : pad)
  const box = { x: pad, y: top, w: w - pad * 2, h: bottom - top }
  let body = null

  if (line.type === 'gap') {
    const r = Math.min(box.h * 0.16, box.w * 0.09)
    body = [0, 1, 2].map((i) => <circle key={i} {...wordProps({ 'data-cx': box.x + box.w / 2 + (i - 1) * r * 3 })} cx={box.x + box.w / 2 + (i - 1) * r * 3} cy={box.y + box.h / 2} r={r} fill={i === 1 ? accent : ink} />)
  } else if (layout === 'arch') {
    const R = Math.min(box.w * 0.5, box.h * 0.86)
    const cx = box.x + box.w / 2, cy = box.y + box.h
    const arc = Math.PI * R
    const weight = words.reduce((a, t) => a + weightOf(t), 0) + SP * (words.length - 1)
    const f = Math.min((arc * 0.82) / (weight * 0.64), R * 0.5)
    const iconSize = R * 0.5
    body = (
      <>
        <path id="pl-arc" d={`M${cx - R} ${cy} A${R} ${R} 0 0 1 ${cx + R} ${cy}`} fill="none" />
        <text fontSize={f} fill={ink} style={{ fontFamily: FONT, fontWeight: 900 }}>
          <textPath href="#pl-arc" startOffset="50%" textAnchor="middle">
            {words.map((t, i) => (
              <tspan key={i}>
                <tspan {...wordProps()} fillOpacity="0">{t.toUpperCase()}</tspan>
                {i < words.length - 1 && <tspan>{' '}</tspan>}
              </tspan>
            ))}
          </textPath>
        </text>
        {icon && <Icon name={icon} x={cx - iconSize / 2} y={cy - iconSize * 1.05} size={iconSize} ink={ink} accent={accent} />}
      </>
    )
  } else if (layout === 'between') {
    const half = Math.ceil(words.length / 2)
    const L = words.slice(0, half), Rr = words.slice(half)
    const wl = L.reduce((a, t) => a + weightOf(t), 0) + SP * (L.length - 1)
    const wr = Rr.reduce((a, t) => a + weightOf(t), 0) + SP * Math.max(0, Rr.length - 1)
    const IW = icon ? 1.65 : 0, G = icon ? 0.4 : SP / 2
    const U = wl + wr + IW + 2 * G
    let ch = box.w / (U * CH) // the cap height that fills the row
    ch = Math.min(ch, box.h * 0.6)
    const unit = ch * CH
    const total = U * unit
    let x = box.x + (box.w - total) / 2
    const y = box.y + (box.h - ch) / 2
    const place = (ws) => {
      const out = []
      ws.forEach((t) => { const ww = weightOf(t) * unit; out.push({ text: t, x, w: ww }); x += ww + SP * unit })
      x -= SP * unit
      return out
    }
    const left = place(L)
    x += G * unit
    const ix = x
    x += IW * unit + G * unit
    const right = place(Rr)
    body = (
      <>
        {[left, right].map((items, s) => <Row key={s} row={{ y, h: ch, items }} fill={s === 0 ? ink : accent} />)}
        {icon && <Icon name={icon} x={ix} y={y - ch * 0.12} size={IW * unit} ink={accent === bg ? ink : accent} accent={ink} />}
      </>
    )
  } else if (layout === 'drive') {
    const lane = box.h * 0.3
    const rows = fitRows(words, { ...box, h: box.h - lane - 8 }, { maxRows: 2 })
    const isz = Math.min(lane * 1.05, box.w * 0.26)
    const gy = box.y + box.h - lane * 0.1
    body = (
      <>
        {rows.map((r, i) => <Row key={i} row={r} fill={i % 2 ? accent : ink} hop />)}
        <rect x={box.x} y={gy - 5} width={box.w} height="5" rx="2.5" fill={accent} />
        {icon && <Icon name={icon} x={-isz} y={gy - isz - 2} size={isz} ink={ink} accent={accent} travel pop={false} />}
      </>
    )
  } else if (layout === 'perspective') {
    // a road running away from us: rows are laid out flat, then squeezed
    // towards a vanishing point (no 3D transforms, so it draws the same everywhere)
    const isz = Math.min(box.h * 0.28, box.w * 0.18)
    const yb = box.y + box.h, yt = box.y + isz * 0.9
    const Wn = box.w * 0.94
    const a = 2.4 // how fast the road narrows
    const PHp = box.h * 1.5
    const flat = fitRows(words, { x: 0, y: 0, w: Wn * 0.84, h: PHp * 0.86 }, { maxRows: 4 })
    const g = (u) => (1 - 1 / (1 + a * u)) / (1 - 1 / (1 + a))
    const Y = (u) => yb - (yb - yt) * g(u)
    const sc = (u) => 1 / (1 + a * u)
    const cx = box.x + box.w / 2
    const shift = PHp * 0.07
    const rows = flat.map((r) => {
      const u0 = 1 - (r.y + r.h + shift) / PHp, u1 = 1 - (r.y + shift) / PHp
      const um = Math.max(0, (u0 + u1) / 2)
      const sm = sc(um)
      const y1 = Y(Math.max(0, u1)), y0 = Y(Math.max(0, u0))
      return { y: y1, h: y0 - y1, items: r.items.map((it) => ({ ...it, x: cx - (Wn * 0.84) / 2 * sm + it.x * sm, w: it.w * sm })) }
    })
    const dashes = [0.08, 0.3, 0.52, 0.72, 0.88].map((u) => [Y(u), Y(u + 0.07), sc(u), sc(u + 0.07)])
    body = (
      <>
        <polygon points={`${cx - Wn / 2},${yb} ${cx + Wn / 2},${yb} ${cx + (Wn * sc(1)) / 2},${yt} ${cx - (Wn * sc(1)) / 2},${yt}`} fill={ink} />
        {dashes.map(([ya, yb2, sa, sb], i) => <polygon key={i} points={`${cx - Wn * sa * 0.012},${ya} ${cx + Wn * sa * 0.012},${ya} ${cx + Wn * sb * 0.012},${yb2} ${cx - Wn * sb * 0.012},${yb2}`} fill={bg} opacity=".55" />)}
        {rows.map((r, i) => <Row key={i} row={r} fill={i % 2 ? bg : accent} />)}
        {icon && <Icon name={icon} x={cx - isz / 2} y={box.y - isz * 0.1} size={isz} ink={ink} accent={accent} />}
      </>
    )
  } else {
    // stack: words stretched to fill the frame, rows in turn colours
    const iconSize = icon && !big ? Math.min(box.h * 0.3, box.w * 0.22) : 0
    const rows = fitRows(words, { ...box, h: box.h - (iconSize ? iconSize + 6 : 0) })
    body = (
      <>
        {rows.map((r, i) => <Row key={i} row={r} fill={i % 2 ? accent : ink} />)}
        {iconSize > 0 && <Icon name={icon} x={box.x + box.w / 2 - iconSize / 2} y={box.y + box.h - iconSize} size={iconSize} ink={ink} accent={accent} />}
      </>
    )
  }
  return (
    <svg className="pl-scene" width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="presentation" style={{ fontFamily: FONT, fontWeight: 900 }}>
      <rect width={w} height={h} fill={bg} />
      {body}
    </svg>
  )
}

export default function PosterLyrics({
  lyrics = DEMO_POSTER_LRC,
  layout = 'auto',
  drawings = 'auto',
  colorA = '#7a2b50',
  colorB = '#f5a44b',
  colorC = '#43898b',
  speed = 1,
  loop = true,
  autoPlay = true,
  showPlayer = true,
  style,
}) {
  const parsed = useMemo(() => parsePoster(lyrics), [lyrics])
  const { lines, duration } = parsed
  const root = useRef(null)
  const slider = useRef(null)
  const clockEl = useRef(null)
  const dragging = useRef(false)
  const visible = useOnScreen(root)
  const [size, setSize] = useState({ w: 800, h: 500 })
  const [active, setActive] = useState(0)
  const [playing, setPlaying] = useState(autoPlay)
  const sim = useRef({ time: 0, playing: autoPlay, speed, loop, last: 0, active: -1, scene: -1, words: [], travel: null, sec: -1 })
  const live = useRef({ lines, duration })
  live.current = { lines, duration }
  sim.current.speed = speed
  sim.current.loop = loop

  useEffect(() => {
    const el = root.current
    const ro = new ResizeObserver(() => setSize({ w: Math.max(200, el.clientWidth), h: Math.max(160, el.clientHeight) }))
    ro.observe(el)
    setSize({ w: Math.max(200, el.clientWidth), h: Math.max(160, el.clientHeight) })
    return () => ro.disconnect()
  }, [])

  const line = lines[Math.min(active, lines.length - 1)]
  const hasPlayer = showPlayer
  const pad = Math.round(Math.min(size.w, size.h) * 0.06)
  const icon = line && line.type !== 'gap' ? pickIcon(line, line.scene, drawings) : null
  const chosen = line
    ? line.type === 'gap' ? 'gap'
      : LAYOUTS.includes(line.hint.layout) ? line.hint.layout
      : layout !== 'auto' && LAYOUTS.includes(layout) ? layout
      : pickLayout(line, line.scene, !!icon)
    : 'stack'
  const colors = sceneColors(Math.max(line?.scene ?? 0, 0), colorA, colorB, colorC)

  // after each scene mounts, collect its words and the travelling drawing
  useLayoutEffect(() => {
    const s = sim.current
    const svg = root.current?.querySelector('.pl-scene')
    s.words = svg ? Array.from(svg.querySelectorAll('[data-w]')) : []
    s.travel = svg ? svg.querySelector('[data-travel]') : null
    s.scene = active
    s.words.forEach((el) => el.classList.remove('on'))
  }, [active, size.w, size.h, layout, lyrics, colorA, colorB, colorC, showPlayer])

  const seek = useCallback((t) => {
    const s = sim.current
    s.time = Math.min(Math.max(t, 0), live.current.duration)
    s.last = 0
    s.sec = -1
  }, [])

  useEffect(() => {
    if (!visible) return
    let raf = 0
    const fmt = (v) => `${Math.floor(v / 60)}:${String(Math.floor(v % 60)).padStart(2, '0')}`
    const tick = (now) => {
      raf = requestAnimationFrame(tick)
      const s = sim.current
      const { lines: L, duration: D } = live.current
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
      if (!L.length) return
      let a = 0
      for (let i = 0; i < L.length; i++) if (L[i].t <= t + 0.02) a = i
      if (a !== s.active) { s.active = a; setActive(a) }
      if (s.scene === a) {
        const ln = L[a]
        s.words.forEach((el, k) => {
          const w = ln.words[k]
          if (!w) return
          el.classList.toggle('on', t >= w.t - 0.02)
        })
        if (s.travel) {
          const prog = Math.min(1, Math.max(0, (t - ln.t) / Math.max(ln.end - ln.t, 0.5)))
          const svg = s.travel.ownerSVGElement
          const W = svg.viewBox.baseVal.width
          const m = s.travel.getAttribute('transform').match(/translate\(([-\d.]+) ([-\d.]+)\) scale\(([\d.]+)\)/)
          if (m) {
            const size = 100 * Number(m[3])
            const x = -size + prog * (W + size * 1.3)
            s.travel.setAttribute('transform', `translate(${x.toFixed(1)} ${m[2]}) scale(${m[3]})`)
            s.words.forEach((el) => {
              if (el.dataset.hopper === undefined) return
              el.classList.toggle('hop', Math.abs(x + size / 2 - Number(el.dataset.cx)) < size * 0.55)
            })
          }
        }
      }
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
  }, [visible, lines])

  const toggle = () => {
    const s = sim.current
    if (!s.playing && s.time >= live.current.duration - 0.05) seek(0)
    s.playing = !s.playing
    setPlaying(s.playing)
  }
  const stepLine = (dir) => {
    const s = sim.current
    const L = live.current.lines
    let a = 0
    for (let i = 0; i < L.length; i++) if (L[i].t <= s.time + 0.02) a = i
    const real = (i) => { while (i >= 0 && i < L.length && L[i].type === 'gap') i += dir; return i }
    const n = dir > 0 ? real(a + 1) : real(L[a].type === 'line' && s.time - L[a].t <= 1.2 ? a - 1 : a)
    if (n >= 0 && n < L.length) seek(L[n].t + 0.001)
    else if (dir < 0) seek(0)
  }
  const onKey = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); stepLine(1) }
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); stepLine(-1) }
    else if (e.key === 'Home') { e.preventDefault(); seek(0) }
    else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle() }
  }
  const fmtT = (v) => `${Math.floor(v / 60)}:${String(Math.floor(v % 60)).padStart(2, '0')}`

  return (
    <div ref={root} className="pl-root" data-paused={visible ? undefined : ''} style={{ background: colors.bg, ...style }} tabIndex={0} role="group" aria-label="Poster lyrics. Up and down arrows move between lines, space plays or pauses." onKeyDown={onKey}>
      <style>{`
        .pl-root { position: relative; width: 100%; height: 100%; overflow: hidden; -webkit-font-smoothing: antialiased; outline: none; container-type: size; }
        .pl-root:focus-visible { box-shadow: inset 0 0 0 3px #fff; }
        .pl-root[data-paused] * { animation-play-state: paused !important; }
        .pl-scene { position: absolute; inset: 0; display: block; animation: pl-in .18s cubic-bezier(.2,.9,.3,1); }
        @keyframes pl-in { from { transform: scale(1.035); opacity: .6; } }
        .pl-w { opacity: 0; transform: scale(.72) translateY(10%); transform-box: fill-box; transform-origin: 50% 100%; transition: opacity .1s linear, transform .32s cubic-bezier(.2,1.7,.4,1); }
        .pl-w.on { opacity: 1; transform: none; }
        .pl-w.on.hop { transform: translateY(-9%); transition: transform .12s ease-out; }
        tspan.pl-w { transform: none !important; fill-opacity: 0; transition: fill-opacity .12s linear; }
        tspan.pl-w.on { fill-opacity: 1; }
        .pl-icon { transform-box: fill-box; animation: pl-icon-in .45s cubic-bezier(.2,1.5,.4,1) .08s backwards; }
        @keyframes pl-icon-in { from { opacity: 0; transform: translateY(14px) scale(.7); } }
        /* little motions on the drawings */
        .pl-bob { transform-box: fill-box; transform-origin: 50% 80%; animation: pl-bob 3.2s ease-in-out infinite; }
        @keyframes pl-bob { 50% { transform: translateY(-4px) rotate(3deg); } }
        .pl-twinkle { transform-box: fill-box; transform-origin: 50% 50%; animation: pl-tw 2.2s ease-in-out infinite; }
        @keyframes pl-tw { 50% { transform: scale(.55) rotate(20deg); opacity: .6; } }
        .pl-spin { transform-box: view-box; transform-origin: 50px 50px; animation: pl-spin 18s linear infinite; }
        @keyframes pl-spin { to { transform: rotate(360deg); } }
        .pl-sway { transform-box: fill-box; transform-origin: 50% 100%; animation: pl-sway 4s ease-in-out infinite; }
        @keyframes pl-sway { 50% { transform: skewX(-4deg); } }
        .pl-flow { animation: pl-flow 2.4s ease-in-out infinite; }
        @keyframes pl-flow { 50% { transform: translateX(6px); } }
        .pl-beat { transform-box: fill-box; transform-origin: 50% 60%; animation: pl-beat 1.2s ease-in-out infinite; }
        @keyframes pl-beat { 0%, 40%, 100% { transform: scale(1); } 15% { transform: scale(1.12); } 30% { transform: scale(.97); } }
        .pl-flap { transform-box: fill-box; transform-origin: 50% 60%; animation: pl-flap .7s ease-in-out infinite; }
        @keyframes pl-flap { 50% { transform: scaleY(.55); } }
        .pl-glow { animation: pl-glow 2.6s ease-in-out infinite; }
        @keyframes pl-glow { 50% { opacity: .85; } }
        .pl-drip { animation: pl-drip 1.2s linear infinite; }
        @keyframes pl-drip { 0% { transform: translateY(-6px); opacity: 0; } 30% { opacity: 1; } 100% { transform: translateY(14px); opacity: 0; } }
        .pl-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

        .pl-bar { position: absolute; left: 14px; right: 14px; bottom: 12px; display: flex; align-items: center; gap: 10px; padding: 7px 12px 7px 8px; border-radius: 999px; background: rgba(0,0,0,.42); -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px); color: #fff; font: 600 12px/1 ui-sans-serif, system-ui, sans-serif; font-variant-numeric: tabular-nums; }
        .pl-bar button { width: 32px; height: 32px; border-radius: 50%; border: 0; padding: 0; background: #fff; color: #1a1a1a; display: grid; place-items: center; cursor: pointer; flex: none; }
        .pl-bar button:focus-visible, .pl-seek:focus-visible { outline: 3px solid #fff; outline-offset: 2px; }
        .pl-seek { flex: 1; min-width: 0; height: 18px; margin: 0; background: transparent; -webkit-appearance: none; appearance: none; cursor: pointer; --pp: 0%; }
        .pl-seek::-webkit-slider-runnable-track { height: 4px; border-radius: 2px; background: linear-gradient(90deg, #fff var(--pp), rgba(255,255,255,.35) var(--pp)); }
        .pl-seek::-moz-range-track { height: 4px; border-radius: 2px; background: rgba(255,255,255,.35); }
        .pl-seek::-moz-range-progress { height: 4px; border-radius: 2px; background: #fff; }
        .pl-seek::-webkit-slider-thumb { -webkit-appearance: none; width: 12px; height: 12px; margin-top: -4px; border-radius: 50%; background: #fff; }
        .pl-seek::-moz-range-thumb { width: 12px; height: 12px; border: 0; border-radius: 50%; background: #fff; }
        @media (prefers-reduced-motion: reduce) { .pl-scene, .pl-icon, .pl-w { animation: none; transition: none; } .pl-bob, .pl-twinkle, .pl-spin, .pl-sway, .pl-flow, .pl-beat, .pl-flap, .pl-glow, .pl-drip { animation: none; } }
      `}</style>

      {line && (
        <Scene key={`${active}-${chosen}`} line={line} w={size.w} h={size.h} pad={pad} layout={chosen} icon={icon} colors={colors} hasPlayer={hasPlayer} big={false} />
      )}
      <div className="pl-sr" aria-live="polite">{line?.text}</div>

      {showPlayer && (
        <div className="pl-bar">
          <button type="button" aria-label={playing ? 'Pause' : 'Play'} onClick={toggle}>
            <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">{playing ? <path d="M5.5 4h3.2v12H5.5zM11.3 4h3.2v12h-3.2z" /> : <path d="M6.5 4.2v11.6L15.8 10z" />}</svg>
          </button>
          <span ref={clockEl}>0:00</span>
          <input
            ref={slider}
            className="pl-seek"
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
            onKeyDown={(e) => {
              const step = { ArrowLeft: -5, ArrowRight: 5 }[e.key]
              if (step) { e.preventDefault(); e.stopPropagation(); seek(sim.current.time + step) }
            }}
          />
          <span>{fmtT(duration)}</span>
        </div>
      )}
    </div>
  )
}
