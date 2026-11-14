import { useEffect, useLayoutEffect, useRef, useState } from 'react'

// An ebook reader on a phone, as a click-through prototype. Five pages:
// Library (search, filters, book detail), Reader, Contents, Notes and Settings.
// The Reader really paginates: each chapter's words are measured against a
// hidden copy of the page (binary search on how many words fit), so changing
// font size, family or line spacing re-flows the book and keeps your place.
// Turn pages by tapping the left/right edge or dragging; the page is a CSS 3D
// flip hinged on the spine. Press and hold a sentence to highlight it and add a
// note (it shows up in Notes), tap the ribbon for a bookmark, drag the scrubber
// to jump, and pick paper / sepia / night to restyle the whole app live.
// The passages are original text written for this demo. The phone scales to fit
// its box; startScreen can be library, reader, contents, notes or settings.

const W = 390
const H = 844
const TAB = 76 // bottom tab bar height
const PAGE_H = H - 54 - TAB - 46 - 54 // reader page area (below status + top bar, above footer + tabs)
const TEXT_W = 330
const TEXT_H = PAGE_H - 36

const THEMES = {
  paper: { name: 'Paper', bg: '#ece5d6', paper: '#fbf8f1', ink: '#2b2620', muted: '#8a7f6e', card: '#fbf8f1', line: '#e0d7c3', bar: '#fbf8f1', dark: false },
  sepia: { name: 'Sepia', bg: '#d6c39b', paper: '#f1e2c0', ink: '#45331f', muted: '#8b7355', card: '#ead9b3', line: '#cdb88c', bar: '#ecdcb7', dark: false },
  night: { name: 'Night', bg: '#0c0d10', paper: '#17181d', ink: '#d6d3cc', muted: '#7d7a74', card: '#1e2026', line: '#2a2c33', bar: '#14151a', dark: true },
}
const FONTS = {
  serif: "Georgia, 'Iowan Old Style', 'Times New Roman', serif",
  sans: "-apple-system, 'SF Pro Text', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
}
const UI_FONT = FONTS.sans
const HL_COLORS = [
  { id: 'y', c: '#fbbf24' },
  { id: 'g', c: '#4ade80' },
  { id: 'p', c: '#f472b6' },
]

// ---------------------------------------------------------------- the books

const BOOKS = [
  {
    id: 'lamp', title: "The Lighthouse Keeper's Almanac", short: 'Lighthouse Almanac', author: 'M. Hollis', art: 'lamp', a: '#1e3a5f', b: '#f2b84b',
    lines: ['The Lighthouse', "Keeper's Almanac"],
    blurb: 'A season-by-season notebook from a keeper of the lamp: polishing brass, sounding the horn in fog, and learning to love the longest night.',
    chapters: [
      { title: 'The Lamp', paras: [
        'Every evening, a quarter hour before the sun touched the water, I climbed the one hundred and twelve steps to the lantern room and began my work. The brass wants polishing before it wants anything else; a lamp that shines through a smear shines a little less truly, and a ship may be counting on that little. I wipe the lens in slow circles, the way my father taught me, and I do not hurry, for hurry leaves lint.',
        'The light itself is a modest thing, a flame no larger than a thumb. It is the glass that makes it great. Ninety-two prisms gather that small fire and fling it twenty miles over the sea, and I have often thought there is a lesson folded in there somewhere, about how little a person needs to be, so long as the right things stand around them.',
        'When the wick catches, the whole room turns amber and the gulls on the rail lift off together as if someone had called their names. Then the clockwork begins its patient turning, and the first beam sweeps the cliff, the cove, the black rocks beyond, and goes out to look for anyone who is lost.',
      ] },
      { title: 'Fog', paras: [
        'Fog arrives without a sound. One minute the horizon is a ruled line, and the next it has been rubbed out by a thumb. On such nights the lamp is little use, for light cannot get through wool, and so I wind the horn instead. Three blasts, a long silence, three blasts again: the oldest sentence on this coast, and every captain can read it.',
        'I keep a tally in the margin of this almanac. Eleven fog nights in October, six in November. I write the hours and the wind and whether I heard any answering bell. Mostly I hear nothing. Once, near three in the morning, I heard a small bell very far off, a fishing boat feeling its way home, and I sounded the horn until my lips went numb, and at dawn there she was, sitting in the harbour mouth as though nothing at all had happened.',
        'Nothing had happened, and that is the point of the work. A good keeper\'s finest nights are the ones no one remembers.',
      ] },
      { title: 'The Long Night', paras: [
        'Midwinter brings the longest dark, sixteen hours of it, and I have come to regard it as a kind of companion rather than an enemy. I take my supper in the lantern room. The stars come out in a spill, more than a town-dweller would believe, and the sea below turns the colour of slate, then pitch, then a deep and breathing nothing.',
        'I read a great deal in these weeks. I have worked through the whole shelf twice: the sailing directions, a cracked herbal, three volumes of someone\'s sermons which I confess I read mainly for the rhythm. Between pages I stand and look at the light going out over the water, and I try to imagine the faces of the people it passes without ever meeting.',
        'At first grey I put out the flame and draw the curtains against the sun, so the brass will not blister. I sleep like a stone. And in the evening, a quarter hour before the sun touches the water, I climb the stairs again.',
      ] },
    ],
  },
  {
    id: 'weather', title: 'A Field Guide to Small Weather', short: 'Small Weather', author: 'Ines Varga', art: 'weather', a: '#7dd3fc', b: '#fef3c7',
    lines: ['A Field Guide', 'to Small Weather'],
    blurb: 'Dew, wind before rain and the first frost: how to read the sky and the grass without any instruments at all.',
    chapters: [
      { title: 'Dew', paras: [
        'Dew is not rain, and it is not a gift from the sky. It is the night\'s leftover breath, water that the air was carrying and could not keep once the grass grew cold. Go out before sunrise on a still, clear morning and you will find it everywhere: strung along spider silk, beaded on the fine hairs of lady\'s mantle, hanging in a bright row from the tip of every blade.',
        'Look for it when the sky has been empty of cloud. Clouds act like a blanket, and under a blanket the grass stays warm and dry. A heavy dew is therefore a small forecast. It tells you the night was clear and the air was calm, and that the day ahead will most likely be fair, at least until the afternoon.',
        'Try this: lay a dark plate in the open grass at dusk, and another beneath a tree. By morning the first will be wet and the second nearly dry. The tree, you will see, had been holding the heat in all night.',
      ] },
      { title: 'Wind Before Rain', paras: [
        'Long before the first drop, the wind will often change its mind. A steady breeze from the west that backs round to the south and begins to gust is one of the more reliable signs we have, older than any barometer. Swallows fly low, because the insects they follow have been pushed down toward the ground, and the leaves of maples turn their pale undersides to the sky.',
        'Smell is a better instrument than most people suppose. Before a rain the air carries a mineral, earthy sweetness, the scent of dry soil waking, and it can reach you an hour ahead of the clouds. Cattle lie down, or so the saying goes; I have never found them consistent, but I have found the smell dependable.',
        'None of these signs is a promise. Treat them as you would a friend\'s hint, worth hearing and worth weighing against what you can see for yourself in the western sky.',
      ] },
      { title: 'Frost', paras: [
        'Frost is dew that arrived too cold. On a hard clear night, when the temperature of the grass falls below freezing, the water vapour skips the liquid stage altogether and builds itself into feathers, needles and fern-shaped plates directly on every surface. A window pane in an unheated shed will show the best of them, each one growing along invisible lines of scratch and dust.',
        'Gardeners fear the white frost and respect the black. A white frost leaves its crystals on the leaf and is, in many cases, survivable; a black frost freezes the plant\'s own water from within, and by noon the dahlias are slumped and dark like wet paper. Cover tender things at dusk, and cover them to the ground so the earth\'s warmth is trapped beneath.',
        'Nothing is more beautiful than a frosted meadow lit from the side at sunrise, and nothing is shorter lived. By nine it is gone, and the grass is only grass, glistening, and the dew has come round again.',
      ] },
    ],
  },
  {
    id: 'orchard', title: 'Letters from the Orchard', short: 'Orchard Letters', author: 'T. Brandt', art: 'orchard', a: '#bbf7d0', b: '#fde68a',
    lines: ['Letters from', 'the Orchard'],
    blurb: 'A grower writes to his sister across one apple year, from the first pruning cut to the last cup of cloudy cider.',
    chapters: [
      { title: 'Spring Pruning', paras: [
        'Dear Nell, the apple trees have woken, and I with them. Today I took the long saw and the short knife down to the old rows and began the yearly argument about what must go. A tree wants to grow in every direction at once; the pruner\'s task is to say, politely, no. Out go the crossing branches, the water-sprouts that shoot straight up like startled hair, and the limbs that turn inward toward the trunk, because the sun cannot find the fruit in there.',
        'Father used to say you should prune so that a swallow could fly through the crown without touching a twig. I have never managed it, but I have come close with the Russets, which forgive a great deal. The cuts weep for an hour and then they are quiet. I always feel I should apologise to them, and I do, under my breath, where only the robin can hear.',
        'The blossom will be late this year, the buds still tight as fists. Come in May if you can. I will keep the best bench in the sun for you, and the tea strong, and I promise not to talk about trees for at least the first ten minutes. Yours, as ever, Tom.',
      ] },
      { title: 'The Windfall', paras: [
        'Dear Nell, September has shaken the orchard like a rug. Every morning I find the grass spangled with windfalls, bruised and wasp-drunk and smelling of cider before there is any cider. I gather them in the old blue barrow and sort them into three heaps: the sound, which go to the cellar; the speckled, which go to the press; and the broken, which go back to the ground, where the trees will have them again by spring.',
        'There is a lesson in that third heap, I suppose, but I am too tired to find it. The press is running from noon until dusk, and the whole yard hums with it. The children from the lower farm come to turn the handle in exchange for the first cup, which is always cloudy and always the best of the year.',
        'I have put a dozen of the Russets aside for you in straw. They will not be ready until Christmas, but they will keep, and so, I hope, will we. Write soon. Yours, Tom.',
      ] },
    ],
  },
]

// tokenise once: each chapter becomes a flat list of words that know their paragraph
BOOKS.forEach((b) => {
  b.total = 0
  b.chapters.forEach((c) => {
    c.toks = []
    c.paras.forEach((p, pi) => p.split(/\s+/).forEach((w, wi) => c.toks.push({ w, p: pi, first: wi === 0 })))
    c.start = b.total
    b.total += c.toks.length
  })
})
const bookOf = (id) => BOOKS.find((b) => b.id === id) || BOOKS[0]
const END_RE = /[.!?]["'”’)]*$/
function sentenceRange(toks, i) {
  let a = i
  while (a > 0 && toks[a - 1].p === toks[i].p && !END_RE.test(toks[a - 1].w)) a--
  let b = i
  while (b < toks.length - 1 && toks[b + 1].p === toks[i].p && !END_RE.test(toks[b].w)) b++
  return [a, b + 1]
}
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const frac = (book, pos) => (pos ? (book.chapters[pos.ch].start + pos.tok) / book.total : 0)

function pageHTML(book, ci, a, b, head) {
  const ch = book.chapters[ci]
  let h = head ? `<div class="k">Chapter ${ci + 1}</div><h2>${esc(ch.title)}</h2>` : ''
  let i = a
  while (i < b) {
    const p = ch.toks[i].p
    let j = i
    const ws = []
    while (j < b && ch.toks[j].p === p) ws.push(esc(ch.toks[j++].w))
    h += `<p${ch.toks[i].first ? '' : ' class="c"'}>${ws.join(' ')}</p>`
    i = j
  }
  return h
}

function paginate(m, book) {
  const out = []
  book.chapters.forEach((ch, ci) => {
    const N = ch.toks.length
    let s = 0
    while (s < N) {
      const head = s === 0
      const fits = (k) => {
        m.innerHTML = pageHTML(book, ci, s, k, head)
        return m.scrollHeight <= m.clientHeight
      }
      let lo = s + 1
      let hi = N
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1
        if (fits(mid)) lo = mid
        else hi = mid - 1
      }
      out.push({ ch: ci, a: s, b: lo })
      s = lo
    }
  })
  return out
}

// ---------------------------------------------------------------- bits

const ICONS = {
  library: 'M5 4v16M10 4v16M15 5l4 .8-3.2 14.4-4-.8z',
  reader: 'M12 6c-2-1.5-5-2-8-2v14c3 0 6 .5 8 2 2-1.5 5-2 8-2V4c-3 0-6 .5-8 2zM12 6v14',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  pen: 'M4 20l4-1 11-11-3-3L5 16zM14 6l3 3',
  sliders: 'M4 7h10M18 7h2M4 17h2M10 17h10M14 5v4M6 15v4',
  bookmark: 'M7 4h10v16l-5-4-5 4z',
  search: 'M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14zM20 20l-4-4',
  trash: 'M5 7h14M10 4h4M7 7l1 13h8l1-13',
  back: 'M15 5l-7 7 7 7',
  chev: 'M9 5l7 7-7 7',
  x: 'M6 6l12 12M18 6L6 18',
  check: 'M5 12l5 5 9-10',
}
function Icon({ name, size = 22, color = 'currentColor', w = 1.9, fill = 'none' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  )
}

function Cover({ book, w = 120 }) {
  const h = w * 1.42
  const gid = `cv-${book.id}`
  let art = null
  if (book.art === 'lamp') {
    art = (
      <g>
        <rect y="100" width="120" height="70" fill="#0b2239" />
        <path d="M0 112q15-8 30 0t30 0 30 0 30 0V170H0z" fill="#163a5c" />
        <path d="M0 126q15-8 30 0t30 0 30 0 30 0V170H0z" fill="#0f2c48" />
        <polygon points="52,100 68,100 65,52 55,52" fill="#f8fafc" />
        <polygon points="54,84 66,84 65.4,72 54.6,72" fill="#dc2626" />
        <rect x="53" y="42" width="14" height="10" fill="#fde68a" />
        <polygon points="50,42 70,42 60,33" fill="#334155" />
        <polygon points="67,47 120,30 120,64" fill="#fde68a" opacity=".4" />
        <polygon points="53,47 0,34 0,60" fill="#fde68a" opacity=".25" />
      </g>
    )
  } else if (book.art === 'weather') {
    art = (
      <g>
        <circle cx="86" cy="42" r="15" fill="#fbbf24" />
        <g fill="#fff">
          <circle cx="40" cy="66" r="14" /><circle cx="56" cy="60" r="18" /><circle cx="74" cy="68" r="13" /><rect x="30" y="66" width="56" height="14" rx="7" />
        </g>
        <g stroke="#38bdf8" strokeWidth="2.4" strokeLinecap="round">
          <path d="M44 90l-3 9M58 90l-3 9M72 90l-3 9" />
        </g>
        <path d="M0 150q30-20 60-6t60-10V170H0z" fill="#65a30d" opacity=".75" />
      </g>
    )
  } else {
    art = (
      <g>
        <ellipse cx="30" cy="150" rx="80" ry="30" fill="#4d7c0f" />
        <ellipse cx="100" cy="158" rx="70" ry="30" fill="#65a30d" />
        <rect x="38" y="90" width="6" height="40" fill="#78350f" />
        <rect x="88" y="98" width="6" height="34" fill="#78350f" />
        <circle cx="41" cy="78" r="22" fill="#15803d" /><circle cx="91" cy="86" r="18" fill="#16a34a" />
        <g fill="#dc2626"><circle cx="34" cy="74" r="3" /><circle cx="47" cy="84" r="3" /><circle cx="42" cy="66" r="3" /><circle cx="86" cy="82" r="3" /><circle cx="97" cy="90" r="3" /></g>
      </g>
    )
  }
  const dark = book.art === 'lamp'
  return (
    <svg width={w} height={h} viewBox="0 0 120 170" role="img" aria-label={`${book.title} cover`} style={{ display: 'block', borderRadius: 6, boxShadow: '0 8px 18px rgba(0,0,0,.28)' }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={book.a} />
          <stop offset="1" stopColor={book.b} />
        </linearGradient>
      </defs>
      <rect width="120" height="170" fill={`url(#${gid})`} />
      {art}
      <rect width="120" height="170" fill="none" stroke="rgba(0,0,0,.18)" />
      <rect width="5" height="170" fill="rgba(0,0,0,.16)" />
      {book.lines.map((l, i) => (
        <text key={l} x="62" y={16 + i * 11} textAnchor="middle" fontFamily="Georgia, serif" fontWeight="700" fontSize="9.5" fill={dark ? '#fef3c7' : '#1e293b'}>{l}</text>
      ))}
    </svg>
  )
}

function Switch({ on, set, label, accent, T }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => set(!on)} style={{ width: 48, height: 28, borderRadius: 14, border: 'none', padding: 3, background: on ? accent : T.line, cursor: 'pointer', transition: 'background .2s', flex: 'none' }}>
      <span style={{ display: 'block', width: 22, height: 22, borderRadius: '50%', background: '#fff', transform: `translateX(${on ? 20 : 0}px)`, transition: 'transform .2s' }} />
    </button>
  )
}

function StatusBar({ frame, ink }) {
  const clock = new Date().toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' })
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20, height: 54, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 30px 0 36px', fontSize: 16, fontWeight: 600, color: ink, pointerEvents: 'none' }}>
      <span>{clock}</span>
      {frame && <span style={{ position: 'absolute', left: '50%', top: 11, width: 122, height: 35, marginLeft: -61, borderRadius: 20, background: '#000' }} />}
      <span style={{ display: 'flex', gap: 6, alignItems: 'center' }} aria-hidden="true">
        <svg width="18" height="11" viewBox="0 0 18 11" fill={ink}>
          <rect x="0" y="7" width="3" height="4" rx="1" /><rect x="5" y="5" width="3" height="6" rx="1" /><rect x="10" y="2.5" width="3" height="8.5" rx="1" /><rect x="15" y="0" width="3" height="11" rx="1" />
        </svg>
        <svg width="26" height="12" viewBox="0 0 26 12">
          <rect x="0.5" y="0.5" width="22" height="11" rx="3.5" fill="none" stroke={ink} opacity=".45" /><rect x="2.5" y="2.5" width="16" height="7" rx="2" fill={ink} /><rect x="23.5" y="4" width="2" height="4" rx="1" fill={ink} opacity=".45" />
        </svg>
      </span>
    </div>
  )
}

function hlBg(id, dark) {
  const c = HL_COLORS.find((x) => x.id === id) || HL_COLORS[0]
  return c.c + (dark ? '66' : '88')
}

// one page of text; module level so it keeps a stable identity while pages flip
function PageFace({ page, book, hls, sel, T, txt }) {
  if (!page) return <div style={{ position: 'absolute', inset: 0, background: T.paper }} />
  const ch = book.chapters[page.ch]
  const out = []
  let i = page.a
  while (i < page.b) {
    const p = ch.toks[i].p
    const first = ch.toks[i].first
    const kids = []
    while (i < page.b && ch.toks[i].p === p) {
      const idx = i
      const h = hls.find((x) => x.ch === page.ch && idx >= x.a && idx < x.b)
      const inSel = sel && sel.ch === page.ch && idx >= sel.a && idx < sel.b
      const bg = inSel ? hlBg(sel.color, T.dark) : h ? hlBg(h.color, T.dark) : undefined
      kids.push(
        <span key={idx} data-t={idx} data-h={h && !inSel ? h.id : undefined} style={bg ? { background: bg, borderRadius: 3, textDecoration: h && h.note ? 'underline dotted' : 'none' } : undefined}>
          {ch.toks[idx].w}{' '}
        </span>,
      )
      i++
    }
    out.push(<p key={`p${page.a}-${p}`} className={first ? undefined : 'c'}>{kids}</p>)
  }
  return (
    <div style={{ position: 'absolute', inset: 0, background: T.paper, padding: '18px 30px', boxSizing: 'border-box' }}>
      <div className="rd-txt" lang="en" style={txt}>
        {page.a === 0 && (
          <>
            <div className="k">Chapter {page.ch + 1}</div>
            <h2>{ch.title}</h2>
          </>
        )}
        {out}
      </div>
    </div>
  )
}

function TypeControls({ prefs, set, T, accent }) {
  const lab = { fontSize: 12, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: T.muted, margin: '16px 0 8px' }
  const chip = (on) => ({ flex: 1, height: 40, borderRadius: 12, border: `1.5px solid ${on ? accent : T.line}`, background: on ? `${accent}22` : 'transparent', color: T.ink, font: 'inherit', fontSize: 14, fontWeight: 600, cursor: 'pointer' })
  return (
    <div>
      <div style={{ ...lab, marginTop: 4 }}>Theme</div>
      <div style={{ display: 'flex', gap: 8 }} role="group" aria-label="Theme">
        {Object.entries(THEMES).map(([id, t]) => (
          <button key={id} type="button" onClick={() => set({ theme: id })} aria-pressed={prefs.theme === id} style={{ ...chip(prefs.theme === id), height: 58, display: 'grid', placeItems: 'center', gap: 2, paddingTop: 4 }}>
            <span style={{ width: 28, height: 28, borderRadius: '50%', background: t.paper, color: t.ink, border: `1px solid ${t.line}`, display: 'grid', placeItems: 'center', fontFamily: FONTS.serif, fontSize: 13, fontWeight: 700 }}>Aa</span>
            <span style={{ fontSize: 11 }}>{t.name}</span>
          </button>
        ))}
      </div>
      <div style={lab}>Font size · {prefs.size}px</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>A</span>
        <input type="range" min="15" max="26" step="1" value={prefs.size} onChange={(e) => set({ size: +e.target.value })} aria-label="Font size" style={{ flex: 1, accentColor: accent }} />
        <span style={{ fontSize: 22, fontWeight: 700 }}>A</span>
      </div>
      <div style={lab}>Font</div>
      <div style={{ display: 'flex', gap: 8 }} role="group" aria-label="Font">
        <button type="button" onClick={() => set({ family: 'serif' })} aria-pressed={prefs.family === 'serif'} style={{ ...chip(prefs.family === 'serif'), fontFamily: FONTS.serif, fontSize: 16 }}>Serif</button>
        <button type="button" onClick={() => set({ family: 'sans' })} aria-pressed={prefs.family === 'sans'} style={{ ...chip(prefs.family === 'sans'), fontFamily: FONTS.sans, fontSize: 16 }}>Sans</button>
      </div>
      <div style={lab}>Line spacing · {prefs.lh.toFixed(2)}</div>
      <input type="range" min="1.3" max="2.1" step="0.05" value={prefs.lh} onChange={(e) => set({ lh: +e.target.value })} aria-label="Line spacing" style={{ width: '100%', accentColor: accent }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, fontSize: 14, fontWeight: 600 }}>
        Justify text <Switch on={prefs.justify} set={(v) => set({ justify: v })} label="Justify text" accent={accent} T={T} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, fontSize: 14, fontWeight: 600 }}>
        Page-curl animation <Switch on={prefs.curl} set={(v) => set({ curl: v })} label="Page curl animation" accent={accent} T={T} />
      </div>
    </div>
  )
}

const NAV = [
  ['library', 'library', 'Library'],
  ['reader', 'reader', 'Reader'],
  ['contents', 'list', 'Contents'],
  ['notes', 'pen', 'Notes'],
  ['settings', 'sliders', 'Settings'],
]

// ---------------------------------------------------------------- app

export default function ReaderApp({ name = 'Folio', accent = '#b4532a', startScreen = 'library', frame = true, style }) {
  const box = useRef()
  const meas = useRef()
  const toastTimer = useRef()
  const holdTimer = useRef()
  const raf = useRef(0)
  const drag = useRef(null)
  const live = useRef({})
  const [scale, setScale] = useState(1)
  const [tab, setTab] = useState(startScreen)
  const [stack, setStack] = useState([])
  const [dir, setDir] = useState(1)
  const [toast, setToast] = useState('')
  const [bookId, setBookId] = useState('lamp')
  const [pos, setPos] = useState({ lamp: { ch: 0, tok: 40 }, weather: { ch: 1, tok: 30 } })
  const [prefs, setPrefsRaw] = useState({ theme: 'paper', size: 19, family: 'serif', lh: 1.6, justify: false, curl: true })
  const [pg, setPg] = useState({ key: '', list: [] })
  const [turn, setTurn] = useState(null)
  const [chrome, setChrome] = useState(true)
  const [sheet, setSheet] = useState(null) // 'type' | 'hl'
  const [draft, setDraft] = useState(null)
  const [hls, setHls] = useState(() => {
    const t = BOOKS[0].chapters[0].toks
    const [a, b] = sentenceRange(t, 0)
    return [{ id: 'h0', book: 'lamp', ch: 0, a, b, color: 'y', note: 'Love the image of hurry leaving lint.', text: t.slice(a, b).map((x) => x.w).join(' ') }]
  })
  const [marks, setMarks] = useState([{ id: 'b0', book: 'weather', ch: 1, tok: 0, text: 'Long before the first drop, the wind…' }])
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('All')
  const [noteTab, setNoteTab] = useState('highlights')

  useEffect(() => (setTab(startScreen), setStack([])), [startScreen])
  useEffect(() => {
    const ro = new ResizeObserver(([e]) => {
      const fw = frame ? W + 28 : W
      const fh = frame ? H + 28 : H
      setScale(Math.min(1.2, (e.contentRect.width - 24) / fw, (e.contentRect.height - 24) / fh))
    })
    ro.observe(box.current)
    return () => ro.disconnect()
  }, [frame])
  useEffect(() => () => (clearTimeout(toastTimer.current), clearTimeout(holdTimer.current), cancelAnimationFrame(raf.current)), [])

  const say = (t) => {
    setToast(t)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 1900)
  }
  const setPrefs = (p) => setPrefsRaw((o) => ({ ...o, ...p }))
  const T = THEMES[prefs.theme]
  const book = bookOf(bookId)
  const top = stack[stack.length - 1]
  const push = (s) => (setDir(1), setStack((a) => [...a, s]))
  const pop = () => (setDir(-1), setStack((a) => a.slice(0, -1)))
  const go = (t) => (setDir(NAV.findIndex((n) => n[0] === t) >= NAV.findIndex((n) => n[0] === tab) ? 1 : -1), setTab(t), setStack([]), setSheet(null))
  const jump = (bid, ch, tok) => (setBookId(bid), setPos((p) => ({ ...p, [bid]: { ch, tok } })), setDir(1), setTab('reader'), setStack([]), setSheet(null), setTurn(null))

  // ---- pagination (re-runs when the type changes, keeps your place via pos)
  const key = `${book.id}|${prefs.size}|${prefs.family}|${prefs.lh}|${prefs.justify}`
  const txt = { fontFamily: FONTS[prefs.family], fontSize: prefs.size, lineHeight: prefs.lh, textAlign: prefs.justify ? 'justify' : 'left', color: T.ink, hyphens: 'auto', WebkitHyphens: 'auto' }
  useLayoutEffect(() => {
    if (meas.current) setPg({ key, list: paginate(meas.current, book) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  const pages = pg.key === key ? pg.list : []
  const anchor = pos[book.id] || { ch: 0, tok: 0 }
  let idx = pages.findIndex((p) => p.ch === anchor.ch && anchor.tok >= p.a && anchor.tok < p.b)
  if (idx < 0) idx = 0
  const cur = pages[idx]
  live.current = { pages, idx, book, bookId: book.id, scale }
  const bookHls = hls.filter((h) => h.book === book.id)
  const marked = !!cur && marks.some((m) => m.book === book.id && m.ch === cur.ch && m.tok >= cur.a && m.tok < cur.b)

  // ---- page turning
  const commit = (d) => {
    const L = live.current
    const p = L.pages[L.idx + d]
    if (p) setPos((o) => ({ ...o, [L.bookId]: { ch: p.ch, tok: p.a } }))
  }
  const animate = (d, from, to) => {
    cancelAnimationFrame(raf.current)
    raf.current = 0
    const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce || !prefs.curl) {
      if (to === 1) commit(d)
      setTurn(null)
      return
    }
    const dur = Math.max(140, 420 * Math.abs(to - from))
    const t0 = performance.now()
    const step = (now) => {
      const k = Math.min(1, (now - t0) / dur)
      const e = 1 - Math.pow(1 - k, 3)
      if (k < 1) {
        setTurn({ dir: d, t: from + (to - from) * e })
        raf.current = requestAnimationFrame(step)
      } else {
        raf.current = 0
        if (to === 1) commit(d)
        setTurn(null)
      }
    }
    raf.current = requestAnimationFrame(step)
  }
  const flip = (d) => {
    const L = live.current
    if (raf.current || !L.pages[L.idx + d]) return
    animate(d, 0, 1)
  }

  const onDown = (e) => {
    if (raf.current) return
    const d = { x: e.clientX, y: e.clientY, active: false, held: false, moved: false, dir: 0, t: 0, lx: e.clientX, lt: performance.now(), v: 0 }
    const el = e.target.closest && e.target.closest('[data-t]')
    d.hid = el && el.dataset.h
    drag.current = d
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch (err) { /* ignore */ }
    if (el) {
      const t = +el.dataset.t
      clearTimeout(holdTimer.current)
      holdTimer.current = setTimeout(() => {
        const L = live.current
        const pgx = L.pages[L.idx]
        if (!pgx || !drag.current) return
        d.held = true
        const [a, b] = sentenceRange(L.book.chapters[pgx.ch].toks, t)
        setDraft({ id: null, ch: pgx.ch, a, b, color: 'y', note: '' })
        setSheet('hl')
      }, 480)
    }
  }
  const onMove = (e) => {
    const d = drag.current
    if (!d || d.held) return
    const dx = e.clientX - d.x
    const dy = e.clientY - d.y
    if (!d.active) {
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        d.active = true
        clearTimeout(holdTimer.current)
      } else {
        if (Math.hypot(dx, dy) > 10) {
          d.moved = true
          clearTimeout(holdTimer.current)
        }
        return
      }
    }
    const L = live.current
    const dd = dx < 0 ? 1 : -1
    const now = performance.now()
    d.v = (e.clientX - d.lx) / Math.max(1, now - d.lt)
    d.lx = e.clientX
    d.lt = now
    if (!L.pages[L.idx + dd]) {
      d.dir = 0
      setTurn(null)
      return
    }
    const w = e.currentTarget.getBoundingClientRect().width
    d.dir = dd
    d.t = Math.min(1, Math.abs(dx) / (w * 0.8))
    setTurn({ dir: dd, t: d.t })
  }
  const onUp = (e) => {
    clearTimeout(holdTimer.current)
    const d = drag.current
    drag.current = null
    if (!d || d.held) return
    if (d.active) {
      if (d.dir) {
        const fast = d.dir * -d.v > 0.35
        if (d.t > 0.3 || fast) animate(d.dir, d.t, 1)
        else animate(d.dir, d.t, 0)
      }
      return
    }
    if (d.moved) return
    if (d.hid) {
      const h = hls.find((x) => x.id === d.hid)
      if (h) (setDraft({ ...h }), setSheet('hl'))
      return
    }
    const r = e.currentTarget.getBoundingClientRect()
    const f = (e.clientX - r.left) / r.width
    if (f < 0.3) flip(-1)
    else if (f > 0.7) flip(1)
    else setChrome((c) => !c)
  }
  const onCancel = () => (clearTimeout(holdTimer.current), (drag.current = null), turn && animate(turn.dir, turn.t, 0))

  const saveDraft = () => {
    const b = bookOf(book.id)
    const text = b.chapters[draft.ch].toks.slice(draft.a, draft.b).map((x) => x.w).join(' ')
    if (draft.id) setHls((a) => a.map((h) => (h.id === draft.id ? { ...h, color: draft.color, note: draft.note } : h)))
    else setHls((a) => [...a, { ...draft, id: `h${Date.now()}`, book: b.id, text }])
    setSheet(null)
    say(draft.note ? 'Note saved — see Notes' : 'Highlight saved')
  }
  const toggleMark = () => {
    if (!cur) return
    if (marked) {
      setMarks((a) => a.filter((m) => !(m.book === book.id && m.ch === cur.ch && m.tok >= cur.a && m.tok < cur.b)))
      say('Bookmark removed')
    } else {
      const t = book.chapters[cur.ch].toks
      setMarks((a) => [...a, { id: `b${Date.now()}`, book: book.id, ch: cur.ch, tok: cur.a, text: t.slice(cur.a, cur.a + 8).map((x) => x.w).join(' ') + '…' }])
      say('Page bookmarked')
    }
  }

  // ---- shared pieces
  const card = { background: T.card, border: `1px solid ${T.line}`, borderRadius: 18 }
  const h1 = (t, back) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 20px 6px', minHeight: 50 }}>
      {back && (
        <button type="button" onClick={back} aria-label="Back" style={{ display: 'grid', placeItems: 'center', width: 36, height: 36, borderRadius: '50%', border: `1px solid ${T.line}`, background: T.card, color: T.ink, cursor: 'pointer', padding: 0 }}>
          <Icon name="back" size={19} />
        </button>
      )}
      <h1 style={{ margin: 0, fontFamily: FONTS.serif, fontSize: back ? 19 : 30, fontWeight: 700, letterSpacing: '-0.01em' }}>{t}</h1>
    </div>
  )
  const solid = (label, fn, ghost) => (
    <button type="button" onClick={fn} style={{ width: '100%', height: 50, borderRadius: 25, border: ghost ? `1.5px solid ${T.line}` : 'none', background: ghost ? 'transparent' : accent, color: ghost ? T.ink : '#fff', font: 'inherit', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>{label}</button>
  )
  const bar = (p) => (
    <div style={{ height: 5, borderRadius: 3, background: T.line, overflow: 'hidden' }}>
      <div style={{ width: `${Math.round(p * 100)}%`, height: '100%', background: accent, borderRadius: 3 }} />
    </div>
  )
  const startedBooks = BOOKS.filter((b) => pos[b.id])

  // ---- screens
  let body
  let tabbed = true
  let reader = false
  if (top?.id === 'book') {
    tabbed = false
    const b = bookOf(top.book)
    const p = frac(b, pos[b.id])
    body = (
      <>
        {h1('Book', pop)}
        <div style={{ display: 'grid', justifyItems: 'center', padding: '10px 20px 0' }}>
          <Cover book={b} w={150} />
          <div style={{ fontFamily: FONTS.serif, fontSize: 22, fontWeight: 700, textAlign: 'center', marginTop: 18 }}>{b.title}</div>
          <div style={{ fontSize: 13, color: T.muted, marginTop: 3 }}>{b.author} · {b.chapters.length} chapters · {b.total} words</div>
        </div>
        <p style={{ margin: '14px 24px 0', fontSize: 14, lineHeight: 1.55, color: T.ink, opacity: 0.85, textAlign: 'center' }}>{b.blurb}</p>
        <div style={{ padding: '16px 24px 0' }}>
          {bar(p)}
          <div style={{ fontSize: 12, color: T.muted, marginTop: 6 }}>{p > 0 ? `${Math.round(p * 100)}% read` : 'Not started'}</div>
        </div>
        <div style={{ padding: '14px 24px', display: 'grid', gap: 10 }}>
          {solid(pos[b.id] ? 'Continue reading' : 'Start reading', () => jump(b.id, pos[b.id]?.ch || 0, pos[b.id]?.tok || 0))}
          {solid('Table of contents', () => (setBookId(b.id), setDir(1), setStack([]), setTab('contents')), true)}
        </div>
      </>
    )
  } else if (tab === 'library') {
    const q = query.trim().toLowerCase()
    const list = BOOKS.filter((b) => (!q || (b.title + b.author).toLowerCase().includes(q)) && (filter === 'All' || (filter === 'Reading' ? frac(b, pos[b.id]) > 0 : frac(b, pos[b.id]) === 0)))
    const hero = bookOf(bookId)
    body = (
      <>
        <div style={{ padding: '8px 20px 0' }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: accent }}>{name}</div>
          <h1 style={{ margin: '2px 0 0', fontFamily: FONTS.serif, fontSize: 32, fontWeight: 700 }}>Library</h1>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '12px 20px 0', padding: '0 14px', height: 42, borderRadius: 21, ...card }}>
          <Icon name="search" size={18} color={T.muted} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search title or author" aria-label="Search library" style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', font: 'inherit', fontSize: 14, color: T.ink }} />
          {query && <button type="button" aria-label="Clear search" onClick={() => setQuery('')} style={{ border: 'none', background: 'none', color: T.muted, padding: 0, cursor: 'pointer', display: 'grid' }}><Icon name="x" size={16} /></button>}
        </label>
        <div style={{ display: 'flex', gap: 8, padding: '12px 20px 4px' }} role="group" aria-label="Filter">
          {['All', 'Reading', 'New'].map((f) => (
            <button key={f} type="button" onClick={() => setFilter(f)} aria-pressed={filter === f} style={{ height: 32, padding: '0 14px', borderRadius: 16, border: `1px solid ${filter === f ? accent : T.line}`, background: filter === f ? accent : 'transparent', color: filter === f ? '#fff' : T.ink, font: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{f}</button>
          ))}
        </div>
        {!q && filter === 'All' && startedBooks.length > 0 && (
          <button type="button" onClick={() => jump(hero.id, (pos[hero.id] || { ch: 0 }).ch, (pos[hero.id] || { tok: 0 }).tok)} style={{ display: 'flex', gap: 14, alignItems: 'center', width: 'calc(100% - 40px)', margin: '10px 20px 0', padding: 14, textAlign: 'left', font: 'inherit', color: T.ink, cursor: 'pointer', ...card }}>
            <Cover book={hero} w={64} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: accent }}>Continue reading</span>
              <span style={{ display: 'block', fontFamily: FONTS.serif, fontSize: 17, fontWeight: 700, margin: '3px 0 8px' }}>{hero.title}</span>
              {bar(frac(hero, pos[hero.id]))}
              <span style={{ display: 'block', fontSize: 12, color: T.muted, marginTop: 5 }}>{Math.round(frac(hero, pos[hero.id]) * 100)}% · {hero.chapters[(pos[hero.id] || { ch: 0 }).ch].title}</span>
            </span>
          </button>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px 14px', padding: '18px 20px 0' }}>
          {list.map((b) => (
            <button key={b.id} type="button" onClick={() => push({ id: 'book', book: b.id })} aria-label={`Open ${b.title}`} style={{ border: 'none', background: 'none', padding: 0, textAlign: 'left', font: 'inherit', color: T.ink, cursor: 'pointer' }}>
              <Cover book={b} w={160} />
              <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, marginTop: 9 }}>{b.short}</span>
              <span style={{ display: 'block', fontSize: 12, color: T.muted }}>{b.author}{frac(b, pos[b.id]) > 0 ? ` · ${Math.round(frac(b, pos[b.id]) * 100)}%` : ''}</span>
            </button>
          ))}
        </div>
        {!list.length && <div style={{ textAlign: 'center', color: T.muted, fontSize: 13, padding: '36px 0' }}>No books match.</div>}
      </>
    )
  } else if (tab === 'reader') {
    reader = true
    const f = pages.length ? (idx + 1) / pages.length : 0
    const hide = { opacity: chrome ? 1 : 0, pointerEvents: chrome ? 'auto' : 'none', transition: 'opacity .25s' }
    const ib = { display: 'grid', placeItems: 'center', width: 38, height: 38, border: 'none', borderRadius: '50%', background: 'transparent', color: T.ink, cursor: 'pointer', padding: 0 }
    let flipper = null
    let baseP = cur
    if (turn && pages.length) {
      const t = turn.t
      const fwd = turn.dir > 0
      baseP = fwd ? pages[idx + 1] : cur
      const front = fwd ? cur : pages[idx - 1]
      const ang = fwd ? -180 * t : -180 * (1 - t)
      const s = Math.sin(Math.PI * t)
      const face = { position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }
      flipper = (
        <div style={{ position: 'absolute', inset: 0, zIndex: 3, transformOrigin: '0 50%', transformStyle: 'preserve-3d', transform: `rotateY(${ang}deg)`, willChange: 'transform' }}>
          <div style={face}>
            <PageFace page={front} book={book} hls={bookHls} sel={null} T={T} txt={txt} />
            <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(to ${fwd ? 'left' : 'right'}, rgba(0,0,0,${0.22 * s}), transparent 45%)` }} />
          </div>
          <div style={{ ...face, transform: 'rotateY(180deg)', background: T.paper }}>
            <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(to right, rgba(0,0,0,${0.2 * s}), rgba(0,0,0,.03) 55%, rgba(0,0,0,${0.1}))` }} />
          </div>
        </div>
      )
      var shade = 0.16 * s
    }
    const sel = sheet === 'hl' && draft && !draft.id ? draft : sheet === 'hl' && draft ? { ...draft } : null
    body = (
      <>
        <div style={{ height: 46, display: 'flex', alignItems: 'center', padding: '0 10px 0 22px', ...hide }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{book.short}</div>
            <div style={{ fontSize: 11.5, color: T.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cur ? `Ch. ${cur.ch + 1} · ${book.chapters[cur.ch].title}` : ''}</div>
          </div>
          <button type="button" onClick={() => setSheet('type')} aria-label="Appearance" style={{ ...ib, fontFamily: FONTS.serif, fontSize: 17, fontWeight: 700 }}>Aa</button>
          <button type="button" onClick={toggleMark} aria-label={marked ? 'Remove bookmark' : 'Add bookmark'} aria-pressed={marked} style={{ ...ib, color: marked ? accent : T.ink }}>
            <Icon name="bookmark" size={21} fill={marked ? accent : 'none'} />
          </button>
        </div>
        <div
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onCancel}
          style={{ position: 'relative', height: PAGE_H, perspective: 1800, touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none', overflow: 'hidden', boxShadow: `inset 0 1px 0 ${T.line}, inset 0 -1px 0 ${T.line}` }}
        >
          <div style={{ position: 'absolute', inset: 0 }}>
            <PageFace page={baseP} book={book} hls={bookHls} sel={turn ? null : sel} T={T} txt={txt} />
            {turn && <div style={{ position: 'absolute', inset: 0, background: `rgba(0,0,0,${shade})`, pointerEvents: 'none' }} />}
          </div>
          {flipper}
          {marked && !turn && (
            <svg width="22" height="38" viewBox="0 0 22 38" style={{ position: 'absolute', right: 26, top: 0, zIndex: 2, pointerEvents: 'none' }} aria-hidden="true">
              <path d="M0 0h22v38l-11-9-11 9z" fill={accent} />
            </svg>
          )}
          {!pages.length && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: T.muted, fontSize: 13 }}>Laying out pages…</div>}
        </div>
        <div style={{ height: 54, padding: '8px 22px 0', ...hide }}>
          <input
            type="range" min="1" max={Math.max(1, pages.length)} value={idx + 1}
            onChange={(e) => {
              const p = pages[+e.target.value - 1]
              if (p) setPos((o) => ({ ...o, [book.id]: { ch: p.ch, tok: p.a } }))
            }}
            aria-label="Reading progress" style={{ width: '100%', accentColor: accent, display: 'block', margin: 0, height: 18 }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: T.muted, marginTop: 4 }}>
            <span>Page {idx + 1} of {pages.length || '…'}</span>
            <span>{Math.round(f * 100)}%</span>
          </div>
        </div>
      </>
    )
  } else if (tab === 'contents') {
    const chFirst = (ci) => pages.findIndex((p) => p.ch === ci && p.a === 0) + 1
    body = (
      <>
        {h1('Contents')}
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '4px 20px 14px' }}>
          <Cover book={book} w={58} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: FONTS.serif, fontSize: 17, fontWeight: 700 }}>{book.title}</div>
            <div style={{ fontSize: 12.5, color: T.muted, margin: '2px 0 8px' }}>{book.author}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {BOOKS.filter((b) => b.id !== book.id).map((b) => (
                <button key={b.id} type="button" onClick={() => (setBookId(b.id), say(`Switched to ${b.short}`))} style={{ height: 26, padding: '0 10px', borderRadius: 13, border: `1px solid ${T.line}`, background: 'transparent', color: T.ink, font: 'inherit', fontSize: 11.5, fontWeight: 600, cursor: 'pointer' }}>{b.short}</button>
              ))}
            </div>
          </div>
        </div>
        <div style={{ display: 'grid', gap: 8, padding: '0 20px' }}>
          {book.chapters.map((c, ci) => {
            const here = anchor.ch === ci
            const pn = chFirst(ci)
            return (
              <button key={c.title} type="button" onClick={() => jump(book.id, ci, 0)} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', textAlign: 'left', font: 'inherit', color: T.ink, cursor: 'pointer', ...card, borderColor: here ? accent : T.line }}>
                <span style={{ fontFamily: FONTS.serif, fontSize: 22, fontWeight: 700, color: accent, width: 28 }}>{ci + 1}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 15.5, fontWeight: 700 }}>{c.title}</span>
                  <span style={{ display: 'block', fontSize: 12, color: T.muted, marginTop: 2 }}>{c.toks.length} words · {Math.max(1, Math.round(c.toks.length / 220))} min{here ? ' · you are here' : ''}</span>
                </span>
                <span style={{ fontSize: 13, color: T.muted }}>{pn ? `p. ${pn}` : ''}</span>
                <Icon name="chev" size={16} color={T.muted} />
              </button>
            )
          })}
        </div>
      </>
    )
  } else if (tab === 'notes') {
    const hl = hls.map((h) => ({ ...h, b: bookOf(h.book) }))
    const mk = marks.map((m) => ({ ...m, b: bookOf(m.book) }))
    body = (
      <>
        {h1('Notes')}
        <div style={{ display: 'flex', margin: '4px 20px 12px', padding: 3, borderRadius: 14, background: T.line }} role="tablist">
          {[['highlights', `Highlights (${hl.length})`], ['bookmarks', `Bookmarks (${mk.length})`]].map(([id, l]) => (
            <button key={id} type="button" role="tab" aria-selected={noteTab === id} onClick={() => setNoteTab(id)} style={{ flex: 1, height: 36, borderRadius: 11, border: 'none', background: noteTab === id ? T.card : 'transparent', color: T.ink, font: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{l}</button>
          ))}
        </div>
        <div style={{ display: 'grid', gap: 10, padding: '0 20px' }}>
          {noteTab === 'highlights' && hl.map((h) => (
            <div key={h.id} style={{ display: 'flex', ...card, overflow: 'hidden' }}>
              <button type="button" onClick={() => jump(h.book, h.ch, h.a)} style={{ flex: 1, minWidth: 0, display: 'block', padding: '12px 4px 12px 14px', border: 'none', borderLeft: `5px solid ${HL_COLORS.find((c) => c.id === h.color).c}`, background: 'transparent', textAlign: 'left', font: 'inherit', color: T.ink, cursor: 'pointer' }}>
                <span style={{ display: 'block', fontFamily: FONTS.serif, fontSize: 14.5, lineHeight: 1.45 }}>“{h.text}”</span>
                {h.note && <span style={{ display: 'block', fontSize: 13, marginTop: 6, color: accent, fontWeight: 600 }}>{h.note}</span>}
                <span style={{ display: 'block', fontSize: 11.5, color: T.muted, marginTop: 6 }}>{h.b.short} · {h.b.chapters[h.ch].title}</span>
              </button>
              <button type="button" aria-label="Delete highlight" onClick={() => (setHls((a) => a.filter((x) => x.id !== h.id)), say('Highlight deleted'))} style={{ width: 44, border: 'none', background: 'transparent', color: T.muted, cursor: 'pointer', display: 'grid', placeItems: 'center' }}><Icon name="trash" size={18} /></button>
            </div>
          ))}
          {noteTab === 'bookmarks' && mk.map((m) => (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', ...card }}>
              <button type="button" onClick={() => jump(m.book, m.ch, m.tok)} style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 12, padding: '13px 4px 13px 14px', border: 'none', background: 'transparent', textAlign: 'left', font: 'inherit', color: T.ink, cursor: 'pointer' }}>
                <Icon name="bookmark" size={20} color={accent} fill={accent} />
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.text}</span>
                  <span style={{ display: 'block', fontSize: 11.5, color: T.muted, marginTop: 2 }}>{m.b.short} · {m.b.chapters[m.ch].title}</span>
                </span>
              </button>
              <button type="button" aria-label="Delete bookmark" onClick={() => (setMarks((a) => a.filter((x) => x.id !== m.id)), say('Bookmark removed'))} style={{ width: 44, height: 44, border: 'none', background: 'transparent', color: T.muted, cursor: 'pointer', display: 'grid', placeItems: 'center' }}><Icon name="trash" size={18} /></button>
            </div>
          ))}
          {((noteTab === 'highlights' && !hl.length) || (noteTab === 'bookmarks' && !mk.length)) && (
            <div style={{ textAlign: 'center', color: T.muted, fontSize: 13.5, lineHeight: 1.5, padding: '40px 20px' }}>
              {noteTab === 'highlights' ? 'Nothing here yet. In the Reader, press and hold a sentence to highlight it and add a note.' : 'No bookmarks. Tap the ribbon icon in the Reader to mark a page.'}
            </div>
          )}
        </div>
      </>
    )
  } else {
    body = (
      <>
        {h1('Settings')}
        <div style={{ margin: '4px 20px 0', padding: '16px 18px', ...card }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: T.muted, marginBottom: 6 }}>Preview</div>
          <div style={{ ...txt, fontSize: prefs.size, lineHeight: prefs.lh }}>The lamp turns, and the first beam goes out to look for anyone who is lost.</div>
        </div>
        <div style={{ margin: '12px 20px 0', padding: '14px 18px 18px', ...card }}>
          <TypeControls prefs={prefs} set={setPrefs} T={T} accent={accent} />
        </div>
        <div style={{ padding: '14px 20px 0', display: 'grid', gap: 10 }}>
          {solid('Reset reading progress', () => (setPos({}), say('Progress reset')), true)}
          {solid('Clear notes & bookmarks', () => (setHls([]), setMarks([]), say('Notes cleared')), true)}
        </div>
      </>
    )
  }

  const sheetEl = sheet && (
    <div style={{ position: 'absolute', inset: 0, zIndex: 40 }}>
      <button type="button" aria-label="Close" onClick={() => setSheet(null)} style={{ position: 'absolute', inset: 0, border: 'none', background: 'rgba(0,0,0,.4)', cursor: 'pointer' }} />
      <div className="rd-sheet" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '82%', overflowY: 'auto', padding: '10px 20px 34px', borderRadius: '26px 26px 0 0', background: T.card, color: T.ink, boxShadow: '0 -10px 30px rgba(0,0,0,.25)' }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: T.line, margin: '0 auto 14px' }} />
        {sheet === 'type' && (
          <>
            <div style={{ fontFamily: FONTS.serif, fontSize: 20, fontWeight: 700, marginBottom: 10 }}>Appearance</div>
            <TypeControls prefs={prefs} set={setPrefs} T={T} accent={accent} />
            <div style={{ marginTop: 16 }}>{solid('Done', () => setSheet(null))}</div>
          </>
        )}
        {sheet === 'hl' && draft && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: T.muted }}>{draft.id ? 'Edit highlight' : 'New highlight'}</div>
            <div style={{ fontFamily: FONTS.serif, fontSize: 15, lineHeight: 1.5, margin: '8px 0 12px', padding: '2px 10px', borderLeft: `4px solid ${HL_COLORS.find((c) => c.id === draft.color).c}` }}>
              “{book.chapters[draft.ch].toks.slice(draft.a, draft.b).map((x) => x.w).join(' ')}”
            </div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 12 }} role="group" aria-label="Highlight colour">
              {HL_COLORS.map((c) => (
                <button key={c.id} type="button" aria-label={`Colour ${c.id}`} aria-pressed={draft.color === c.id} onClick={() => setDraft((d) => ({ ...d, color: c.id }))} style={{ width: 34, height: 34, borderRadius: '50%', border: draft.color === c.id ? `3px solid ${T.ink}` : `3px solid transparent`, background: c.c, cursor: 'pointer', padding: 0 }} />
              ))}
            </div>
            <textarea value={draft.note} onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))} placeholder="Add a note (optional)" aria-label="Note" rows={3} style={{ width: '100%', boxSizing: 'border-box', resize: 'none', padding: 12, borderRadius: 14, border: `1px solid ${T.line}`, background: T.paper, color: T.ink, font: 'inherit', fontSize: 14, outline: 'none' }} />
            <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
              {solid(draft.id ? 'Save changes' : 'Save highlight', saveDraft)}
              {draft.id
                ? solid('Delete highlight', () => (setHls((a) => a.filter((h) => h.id !== draft.id)), setSheet(null), say('Highlight deleted')), true)
                : solid('Cancel', () => setSheet(null), true)}
            </div>
          </>
        )}
      </div>
    </div>
  )

  const phone = (
    <div style={{ position: 'relative', width: W, height: H, overflow: 'hidden', borderRadius: frame ? 46 : 0, background: T.bg, color: T.ink, fontFamily: UI_FONT, transition: 'background .3s, color .3s' }}>
      <style>{`
        @keyframes rd-r { from { opacity: 0; transform: translateX(30px) } to { opacity: 1; transform: none } }
        @keyframes rd-l { from { opacity: 0; transform: translateX(-30px) } to { opacity: 1; transform: none } }
        @keyframes rd-up { from { transform: translateY(100%) } to { transform: none } }
        .rd-txt { width: ${TEXT_W}px; height: ${TEXT_H}px; overflow: hidden; box-sizing: content-box }
        .rd-txt p { margin: 0; text-indent: 1.5em } .rd-txt p.c { text-indent: 0 }
        .rd-txt h2 { margin: 0 0 .6em; font-size: 1.5em; line-height: 1.2; font-weight: 700 }
        .rd-txt .k { font-family: ${FONTS.sans}; font-size: .6em; letter-spacing: .22em; text-transform: uppercase; opacity: .6; margin: .6em 0 .5em }
        .rd-scroll { scrollbar-width: none } .rd-scroll::-webkit-scrollbar { display: none }
        .rd-sheet { animation: rd-up .3s cubic-bezier(.2,.8,.2,1) }
        .rd-app button:focus-visible, .rd-app input:focus-visible, .rd-app textarea:focus-visible { outline: 2px solid ${accent}; outline-offset: 2px }
        @media (prefers-reduced-motion: reduce) { .rd-sheet, .rd-view { animation: none !important } }
      `}</style>
      <StatusBar frame={frame} ink={T.ink} />
      <div
        ref={meas}
        className="rd-txt"
        aria-hidden="true"
        lang="en"
        style={{ ...txt, position: 'absolute', left: 30, top: 0, visibility: 'hidden', pointerEvents: 'none' }}
      />
      <div key={`${tab}/${stack.map((s) => s.id).join('/')}`} className="rd-scroll rd-view" style={{ position: 'absolute', top: 54, bottom: tabbed ? TAB : 0, left: 0, right: 0, overflowY: reader ? 'hidden' : 'auto', paddingBottom: reader ? 0 : 24, animation: `${dir > 0 ? 'rd-r' : 'rd-l'} .26s ease` }}>
        {body}
      </div>
      {tabbed && (
        <nav aria-label="Main" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: TAB, background: T.bar, borderTop: `1px solid ${T.line}`, display: 'flex', justifyContent: 'space-around', padding: '8px 6px 0', transition: 'background .3s' }}>
          {NAV.map(([id, icon, label]) => (
            <button key={id} type="button" onClick={() => go(id)} aria-current={tab === id ? 'page' : undefined} style={{ position: 'relative', border: 'none', background: 'none', font: 'inherit', cursor: 'pointer', display: 'grid', justifyItems: 'center', alignContent: 'start', gap: 3, width: 66, height: 50, fontSize: 11, fontWeight: 600, color: tab === id ? accent : T.muted }}>
              <Icon name={icon} size={22} />
              {label}
              {id === 'notes' && hls.length + marks.length > 0 && <span style={{ position: 'absolute', top: -1, right: 12, minWidth: 16, height: 16, borderRadius: 8, background: accent, color: '#fff', fontSize: 10, display: 'grid', placeItems: 'center', padding: '0 4px' }}>{hls.length + marks.length}</span>}
            </button>
          ))}
        </nav>
      )}
      {sheetEl}
      <div role="status" style={{ position: 'absolute', left: '50%', top: 58, zIndex: 50, transform: `translate(-50%, ${toast ? 0 : -90}px)`, transition: 'transform .35s cubic-bezier(.2,.8,.2,1)', padding: '10px 16px', borderRadius: 20, background: T.dark ? '#e7e3da' : '#2b2620', color: T.dark ? '#17181d' : '#fff', fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap' }}>{toast}</div>
      <div style={{ position: 'absolute', left: '50%', bottom: 8, width: 140, height: 5, marginLeft: -70, borderRadius: 3, background: T.ink, opacity: 0.7, zIndex: 45, pointerEvents: 'none' }} />
    </div>
  )

  return (
    <div ref={box} className="rd-app" style={{ position: 'relative', width: '100%', height: '100%', display: 'grid', placeItems: 'center', overflow: 'hidden', background: 'radial-gradient(ellipse at 50% 30%, #efe7d6, #b9ab8e 80%)', ...style }}>
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: `translate(-50%, -50%) scale(${scale})`, transformOrigin: 'center' }}>
        {frame ? (
          <div style={{ padding: 12, borderRadius: 58, background: 'linear-gradient(145deg, #3a3f4a, #14171d 40%, #2b2f38)', boxShadow: '0 40px 80px rgba(40,30,10,.35), inset 0 0 0 2px #4b515e' }}>
            <div style={{ padding: 2, borderRadius: 48, background: '#000' }}>{phone}</div>
          </div>
        ) : (
          phone
        )}
      </div>
    </div>
  )
}
