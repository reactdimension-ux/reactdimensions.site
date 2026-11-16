'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

// A ring of cards turning in 3D, built from plain DOM and CSS transforms (no
// WebGL). Each card is cut into thin tiles bent round the ring, so the ring is
// truly round; cards fade toward the background as they turn away, and the
// insides of the far cards show through the gap. A soft sheen of light sweeps
// across each card as it swings to the front, and the ring can stand on a
// glossy floor that mirrors it.
//
// It drifts on its own, or steps card by card; drag or flick it (mouse, touch
// or a sideways trackpad scroll) and it glides with momentum, then settles on
// a card. Four shapes: a cylinder, an orbit of cards that always face you, a
// wheel that turns top to bottom, and a panorama seen from inside the ring.
// Arrow keys, Home/End, Enter, prev/next buttons and dots work too, with
// screen-reader announcements. Swap the items for a new set of the same
// length and each card crossfades to its new picture.
//
// Adapted and extended from CircularCarousel in React Bits
// (https://reactbits.dev, MIT + Commons Clause): restyled, made self-contained
// (inline CSS, built-in artwork instead of remote photos) and given a floor
// reflection, the light sheen, an accent colour, prev/next buttons and dots.

// ---------------------------------------------------------------- default art

// Ten small scenes drawn as SVG, so the carousel works out of the box with no
// network images. Replace them by passing `items`.
const SCENES = [
  ['Sunrise', 'Landscape', ['#ffb347', '#ff5e3a'], 'sun'],
  ['Peaks', 'Mountains', ['#8fb7ff', '#3446c9'], 'peaks'],
  ['Swell', 'Ocean', ['#56dcc8', '#0f6f9e'], 'waves'],
  ['Pines', 'Forest', ['#9bd86f', '#1f6e44'], 'trees'],
  ['Dusk', 'Sky', ['#d39bff', '#4e2394'], 'moon'],
  ['Dunes', 'Desert', ['#ffd98a', '#d27428'], 'dunes'],
  ['Night', 'Stars', ['#3b4a8c', '#0b1030'], 'stars'],
  ['Skyline', 'City', ['#ff9ac2', '#5a2a7a'], 'city'],
  ['Orbit', 'Space', ['#2b2f63', '#06071a'], 'planet'],
  ['Bloom', 'Garden', ['#ffc4d8', '#e0457b'], 'bloom'],
]

function sceneSvg([, , [a, b], kind], i) {
  const w = 'rgba(255,255,255,0.88)'
  const s = 'rgba(255,255,255,0.32)'
  const d = 'rgba(0,0,0,0.18)'
  const shapes = {
    sun: `<circle cx="200" cy="250" r="78" fill="${w}"/><rect y="300" width="400" height="100" fill="${s}"/><rect y="330" width="400" height="70" fill="${d}"/>`,
    peaks: `<path d="M0 400 L120 170 L190 270 L280 110 L400 400Z" fill="${s}"/><path d="M110 400 L250 190 L400 400Z" fill="${w}"/>`,
    waves: `<path d="M0 260 Q50 220 100 260 T200 260 T300 260 T400 260 V400 H0Z" fill="${s}"/><path d="M0 310 Q50 270 100 310 T200 310 T300 310 T400 310 V400 H0Z" fill="${w}"/>`,
    trees: [60, 140, 220, 300].map((x, k) => `<path d="M${x} ${330 - (k % 2) * 40} l40 -${150 - (k % 2) * 30} l40 ${150 - (k % 2) * 30}Z" fill="${k % 2 ? w : s}"/>`).join('') + `<rect y="330" width="400" height="70" fill="${d}"/>`,
    moon: `<circle cx="250" cy="150" r="64" fill="${w}"/><circle cx="278" cy="132" r="58" fill="${b}"/><path d="M0 340 Q200 270 400 340 V400 H0Z" fill="${s}"/>`,
    dunes: `<circle cx="300" cy="120" r="40" fill="${w}"/><path d="M0 300 Q120 220 240 300 T400 290 V400 H0Z" fill="${s}"/><path d="M0 340 Q160 280 320 350 T400 340 V400 H0Z" fill="${w}"/>`,
    stars: Array.from({ length: 26 }, (_, k) => `<circle cx="${(k * 97) % 400}" cy="${(k * 61) % 300}" r="${1.5 + (k % 3)}" fill="${w}"/>`).join('') + `<path d="M0 360 Q200 300 400 360 V400 H0Z" fill="${s}"/>`,
    city: [20, 80, 130, 200, 260, 320].map((x, k) => `<rect x="${x}" y="${150 + ((k * 53) % 120)}" width="${48 + (k % 2) * 14}" height="400" fill="${k % 2 ? w : s}"/>`).join(''),
    planet: `<circle cx="200" cy="200" r="90" fill="${w}"/><ellipse cx="200" cy="205" rx="160" ry="34" fill="none" stroke="${s}" stroke-width="12"/>` + Array.from({ length: 14 }, (_, k) => `<circle cx="${(k * 131) % 400}" cy="${(k * 73) % 400}" r="2" fill="${w}"/>`).join(''),
    bloom: Array.from({ length: 8 }, (_, k) => `<ellipse cx="200" cy="140" rx="34" ry="78" fill="${k % 2 ? w : s}" transform="rotate(${k * 45} 200 210)"/>`).join('') + `<circle cx="200" cy="210" r="36" fill="${d}"/>`,
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><defs><linearGradient id="g${i}" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="400" height="400" fill="url(#g${i})"/>${shapes[kind]}</svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

const DEFAULT_ITEMS = SCENES.map((scene, i) => ({ src: sceneSvg(scene, i), alt: `${scene[0]}: ${scene[1].toLowerCase()} artwork`, title: scene[0], subtitle: scene[1] }))

// ---------------------------------------------------------------- shapes

const PRESETS = {
  cylinder: { axis: 'y', tilt: -5, perspective: 2500, curve: 1, spread: 1, inward: false, billboard: false, backfaces: true, window: 0 },
  orbit: { axis: 'y', tilt: -16, perspective: 1500, curve: 0, spread: 1.45, inward: false, billboard: true, backfaces: false, window: 0 },
  wheel: { axis: 'x', tilt: 0, perspective: 1800, curve: 0, spread: 1, inward: false, billboard: false, backfaces: true, window: 1.7 },
  panorama: { axis: 'y', tilt: 0, perspective: 0, curve: 1, spread: 1, inward: true, billboard: false, backfaces: false, window: 0 },
}

const INTRO_LENGTH = { assemble: 1500, rise: 1400, spin: 1800, none: 0 }
const TILES = 8
const OVERLAP = 2.5
const DRAG_THRESHOLD = 5
const SPRING = 118
const SETTLE_SPEED = 9
const CAPTION_SPACE = 76
const DOTS_SPACE = 30
const SWAP_LENGTH = 700
const SWAP_SPREAD = 420
const TO_RAD = Math.PI / 180

const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const wrap = (deg) => ((((deg + 180) % 360) + 360) % 360) - 180
const easeOut = (t) => 1 - Math.pow(1 - t, 4)
const easeOutQuint = (t) => 1 - Math.pow(1 - t, 5)
const rotateX = (p, deg) => {
  const r = deg * TO_RAD
  const c = Math.cos(r)
  const s = Math.sin(r)
  return [p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c]
}
const rotateY = (p, deg) => {
  const r = deg * TO_RAD
  const c = Math.cos(r)
  const s = Math.sin(r)
  return [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c]
}

// The component's own stylesheet, kept in the file so there is nothing to import.
const CSS = `
.halo{--hc-fade:#0b0b10;--hc-radius:14px;--hc-inner:.4;--hc-accent:#ff4d1a;position:relative;width:100%;height:100%;overflow:hidden;outline:none;touch-action:pan-y;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent}
.halo[data-axis='x']{touch-action:pan-x}
.halo[data-draggable]{cursor:grab}
.halo[data-dragging]{cursor:grabbing}
.halo:focus-visible{box-shadow:inset 0 0 0 2px var(--hc-accent)}
.halo__view{position:absolute;inset:0}
.halo[data-shape='wheel'] .halo__view--main{-webkit-mask-image:linear-gradient(to bottom,transparent,#000 18%,#000 82%,transparent);mask-image:linear-gradient(to bottom,transparent,#000 18%,#000 82%,transparent)}
.halo[data-shape='panorama'] .halo__view--main{-webkit-mask-image:linear-gradient(to right,transparent,#000 12%,#000 88%,transparent);mask-image:linear-gradient(to right,transparent,#000 12%,#000 88%,transparent)}
.halo__mirror{position:absolute;inset:0;pointer-events:none}
.halo__stage{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .45s ease}
.halo[data-ready] .halo__stage{opacity:1}
.halo__camera,.halo__ring,.halo__card{width:0;height:0;transform-style:preserve-3d}
.halo__camera{position:relative}
.halo__ring,.halo__card{position:absolute;left:0;top:0}
.halo__tile{position:absolute;outline:1px solid transparent;backface-visibility:hidden;-webkit-backface-visibility:hidden}
.halo__frame{position:absolute;left:0;top:0;width:100%;overflow:hidden}
.halo__photo{position:absolute;display:block;max-width:none;object-fit:cover;pointer-events:none;user-select:none;-webkit-user-drag:none}
.halo__photo--leaving{animation:halo-leave 700ms cubic-bezier(.33,1,.68,1) both}
.halo__shade,.halo__inner,.halo__sheen{position:absolute;pointer-events:none}
.halo__shade,.halo__inner{inset:0}
.halo__shade{background:var(--hc-fade);opacity:var(--hc-depth,0)}
.halo__inner{background:#000;opacity:var(--hc-inner)}
.halo__sheen{background:linear-gradient(105deg,transparent calc(var(--hc-sx,50%) - 22%),rgba(255,255,255,.55) var(--hc-sx,50%),transparent calc(var(--hc-sx,50%) + 22%));mix-blend-mode:screen;opacity:var(--hc-sa,0)}
.halo__caption{position:absolute;left:0;right:0;display:flex;flex-direction:column;align-items:center;gap:6px;padding:0 16px;color:inherit;text-align:center;pointer-events:none;animation:halo-reveal 900ms ease both}
.halo__title{display:flex;max-width:100%;flex-direction:column;align-items:center;font-size:15px;font-weight:600;line-height:1.35;letter-spacing:-.01em;animation:halo-title 520ms cubic-bezier(.22,1,.36,1)}
.halo__subtitle{font-weight:400;opacity:.6;font-size:13px}
.halo__count{display:inline-flex;align-items:center;gap:3px;font:500 11px/1 ui-monospace,Menlo,monospace;letter-spacing:.08em;font-variant-numeric:tabular-nums}
.halo__count>:first-child{color:var(--hc-accent)}
.halo__slash{opacity:.45}
.halo__digits{display:inline-flex}
.halo__digit{display:inline-block;height:1em;overflow:hidden}
.halo__reel{display:flex;flex-direction:column;transition:transform 600ms cubic-bezier(.22,1,.36,1)}
.halo__reel>span{height:1em}
.halo__nav{position:absolute;top:50%;width:38px;height:38px;margin-top:-19px;border:none;border-radius:50%;display:grid;place-items:center;cursor:pointer;color:inherit;background:rgba(127,127,140,.18);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);box-shadow:inset 0 0 0 1px rgba(255,255,255,.14);transition:background .2s,transform .2s;z-index:2}
.halo__nav:hover{background:var(--hc-accent);color:#fff;transform:scale(1.06)}
.halo__nav:focus-visible{outline:2px solid var(--hc-accent);outline-offset:2px}
.halo__dots{position:absolute;left:0;right:0;bottom:14px;display:flex;justify-content:center;gap:7px;z-index:2}
.halo__dot{width:7px;height:7px;padding:0;border:none;border-radius:4px;background:currentColor;opacity:.3;cursor:pointer;transition:width .35s cubic-bezier(.22,1,.36,1),opacity .2s,background .2s}
.halo__dot[aria-current='true']{width:22px;opacity:1;background:var(--hc-accent)}
.halo__dot:focus-visible{outline:2px solid var(--hc-accent);outline-offset:2px}
.halo__live{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
@keyframes halo-title{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@keyframes halo-leave{from{opacity:1}to{opacity:0}}
@keyframes halo-reveal{from{opacity:0}to{opacity:1}}
@media (prefers-reduced-motion:reduce){.halo__stage,.halo__reel,.halo__dot{transition:none}.halo__caption,.halo__title{animation:none}}
`

const Digits = ({ value }) => (
  <span className="halo__digits">
    {String(value)
      .padStart(2, '0')
      .split('')
      .map((digit, i) => (
        <span key={i} className="halo__digit">
          <span className="halo__reel" style={{ transform: `translateY(${-Number(digit) * 10}%)` }}>
            {'0123456789'.split('').map((n) => (
              <span key={n}>{n}</span>
            ))}
          </span>
        </span>
      ))}
  </span>
)

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const q = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!q) return undefined
    const update = () => setReduced(q.matches)
    update()
    q.addEventListener?.('change', update)
    return () => q.removeEventListener?.('change', update)
  }, [])
  return reduced
}

const Arrow = ({ dir }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={dir < 0 ? 'M10 3L5 8l5 5' : 'M6 3l5 5-5 5'} />
  </svg>
)

export default function HaloCarousel({
  items = DEFAULT_ITEMS,
  preset = 'cylinder',
  intro = 'rise',
  cardWidth = 220,
  aspectRatio = 1,
  gap = 25,
  curve,
  tilt,
  perspective,
  autoplay = 'drift',
  speed = 14,
  interval = 3,
  direction = 'left',
  draggable = true,
  momentum = 0.6,
  snap = true,
  pauseOnHover = true,
  focusOnClick = true,
  parallax = 0.3,
  stretch = 0.5,
  depthFade = 0.55,
  fadeColor = '#0b0b10',
  innerShade = 0.6,
  cornerRadius = 14,
  sheen = 0.6,
  reflection = true,
  accent = '#ff4d1a',
  controls = true,
  captions = true,
  background = '#0b0b10',
  color = '#f4f2ee',
  onChange,
  onItemClick,
  className = '',
  style,
}) {
  const incoming = items && items.length ? items : DEFAULT_ITEMS
  const [list, setList] = useState(incoming)
  const [leaving, setLeaving] = useState(null)
  const count = list.length
  const shape = PRESETS[preset] ? preset : 'cylinder'
  const layout = PRESETS[shape]
  const axis = layout.axis
  const tiltValue = tilt ?? layout.tilt
  const curveValue = layout.billboard ? 0 : clamp(curve ?? layout.curve, 0, 1)
  const reduced = usePrefersReducedMotion()
  // the floor only makes sense under a ring that turns about the vertical, seen from outside
  const mirror = reflection && axis === 'y' && !layout.inward

  const cardW = Math.max(40, cardWidth)
  const cardH = cardW / clamp(aspectRatio, 0.2, 5)
  const along = axis === 'x' ? cardH : cardW
  const step = 360 / count

  const radius = useMemo(() => {
    const n = Math.max(count, 3)
    const pitch = (along + gap) * layout.spread
    const chord = pitch / (2 * Math.sin(Math.PI / n))
    const arc = (n * pitch) / (2 * Math.PI)
    return Math.max(chord + (arc - chord) * curveValue, along * 0.6)
  }, [count, along, gap, curveValue, layout.spread])

  // each card as a run of thin tiles bent round the ring
  const tiles = useMemo(() => {
    const total = curveValue > 0.001 ? TILES : 1
    const length = along / total
    const bend = curveValue > 0.001 ? radius / curveValue : 0
    return Array.from({ length: total }, (_, index) => {
      const start = index * length - (index > 0 ? OVERLAP / 2 : 0)
      const end = (index + 1) * length + (index < total - 1 ? OVERLAP / 2 : 0)
      const center = (start + end) / 2 - along / 2
      const alpha = bend ? center / bend : 0
      const shift = bend ? bend * Math.sin(alpha) : center
      const sink = bend ? bend * (1 - Math.cos(alpha)) : 0
      const depth = layout.inward ? sink : -sink
      const turn = ((layout.inward ? -alpha : alpha) * 180) / Math.PI
      const move = axis === 'x' ? `translate3d(0px, ${shift}px, ${depth}px) rotateX(${-turn}deg)` : `translate3d(${shift}px, 0px, ${depth}px) rotateY(${turn}deg)`
      return { index, total, start, end, size: end - start, move }
    })
  }, [along, axis, curveValue, layout.inward, radius])

  const rootRef = useRef(null)
  const stageRefs = useRef([])
  const cameraRefs = useRef([])
  const ringRefs = useRef([])
  const cardRefs = useRef([[], []]) // [main ring, mirrored ring]
  const mirrorRef = useRef(null)
  const wakeRef = useRef(() => {})
  const measureRef = useRef(() => {})
  const activeRef = useRef(0)
  const [active, setActive] = useState(0)
  const [ready, setReady] = useState(false)
  const [dragging, setDragging] = useState(false)
  const readyRef = useRef(false)
  readyRef.current = ready

  const stateRef = useRef({
    angle: 0,
    velocity: 0,
    target: null,
    dir: 0,
    press: null,
    drag: false,
    hover: false,
    pointer: { inside: false, x: 0, y: 0 },
    yaw: 0,
    pitch: 0,
    intro: null,
    introDone: false,
    holdUntil: 0,
    stepAt: 0,
    suppressClick: false,
    wheelTimer: 0,
    fit: 1,
    shift: 0,
    drop: 0,
    last: 0,
  })

  const settings = {
    count,
    step,
    radius,
    layout,
    axis,
    tilt: tiltValue,
    perspective: layout.inward ? radius : perspective ?? layout.perspective,
    cardW,
    cardH,
    intro: reduced ? 'none' : intro in INTRO_LENGTH ? intro : 'rise',
    autoplay: reduced ? 'off' : autoplay,
    speed,
    interval: Math.max(0.5, interval),
    draggable,
    momentum: clamp(momentum, 0, 1),
    snap,
    pauseOnHover,
    parallax: reduced ? 0 : clamp(parallax, 0, 1),
    stretch: reduced ? 0 : clamp(stretch, 0, 1),
    depthFade: clamp(depthFade, 0, 1),
    sheen: clamp(sheen, 0, 1),
    mirror,
    captions,
    controls,
    reduced,
  }
  const settingsRef = useRef(settings)
  settingsRef.current = settings

  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  const dragSign = layout.inward ? -1 : 1
  const directionSign = (direction === 'right' ? 1 : -1) * dragSign

  useEffect(() => {
    stateRef.current.dir = directionSign
    wakeRef.current()
  }, [directionSign])

  // load the pictures before the entrance; a new set of the same length crossfades in
  const incomingRef = useRef(incoming)
  incomingRef.current = incoming
  const listRef = useRef(list)
  listRef.current = list
  const sourcesKey = incoming.map((item) => item.src).join('|')

  useEffect(() => {
    let cancelled = false
    const next = incomingRef.current
    const smooth = readyRef.current && next.length === listRef.current.length
    if (!smooth) {
      setReady(false)
      setLeaving(null)
      setList(next)
    }
    const sources = next.slice(0, 16).map((item) => item.src)
    const load = (src) =>
      new Promise((resolve) => {
        const image = new Image()
        image.decoding = 'async'
        image.onload = () => (image.decode ? image.decode().then(resolve, resolve) : resolve())
        image.onerror = resolve
        image.src = src
      })
    const timeout = new Promise((resolve) => setTimeout(resolve, 2400))
    Promise.race([Promise.all(sources.map(load)), timeout]).then(() => {
      if (cancelled) return
      const state = stateRef.current
      if (smooth) {
        const previous = listRef.current
        const s = settingsRef.current
        if (!s.reduced && previous !== next) {
          setLeaving((current) => ({
            id: (current?.id || 0) + 1,
            items: previous,
            delays: previous.map((_, i) => (Math.abs(wrap(i * s.step + state.angle)) / 180) * SWAP_SPREAD),
          }))
        }
        setList(next)
        wakeRef.current()
        return
      }
      state.introDone = false
      state.intro = null
      setReady(true)
      wakeRef.current()
    })
    return () => {
      cancelled = true
    }
  }, [sourcesKey])

  useEffect(() => {
    if (!leaving) return undefined
    const timer = setTimeout(() => setLeaving(null), SWAP_LENGTH + SWAP_SPREAD + 80)
    return () => clearTimeout(timer)
  }, [leaving])

  // the animation loop: physics in advance(), transforms in render()
  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root || !stageRefs.current[0]) return undefined
    const state = stateRef.current
    let raf = 0
    let visible = true

    const nearest = (angle) => Math.round(angle / settingsRef.current.step) * settingsRef.current.step

    const measure = () => {
      const s = settingsRef.current
      const rect = root.getBoundingClientRect()
      if (!rect.width || !rect.height) return
      const room = (s.captions ? CAPTION_SPACE : 0) + (s.controls ? DOTS_SPACE : 0)
      const floor = s.mirror ? 0.2 : 0
      const width = rect.width * 0.94 - (s.controls ? 96 : 0)
      const height = (rect.height - room) * (s.axis === 'x' ? 1 : 0.92 - floor)
      const P = s.perspective
      let minX = Infinity
      let maxX = -Infinity
      let minY = Infinity
      let maxY = -Infinity
      if (s.layout.inward) {
        minX = -width / 2
        maxX = width / 2
        minY = -s.cardH / 2
        maxY = s.cardH / 2
      } else {
        const corners = [
          [-s.cardW / 2, -s.cardH / 2],
          [s.cardW / 2, -s.cardH / 2],
          [-s.cardW / 2, s.cardH / 2],
          [s.cardW / 2, s.cardH / 2],
        ]
        const limit = s.layout.window ? s.layout.window * s.step : 180
        for (let a = -limit; a <= limit; a += limit / 24) {
          for (const [cx, cy] of corners) {
            let p
            if (s.axis === 'x') p = rotateY(rotateX([cx, cy, s.radius], -a), s.tilt)
            else if (s.layout.billboard) {
              const c = rotateY([0, 0, s.radius], a)
              p = rotateX([c[0] + cx, cy, c[2]], s.tilt)
            } else p = rotateX(rotateY([cx, cy, s.radius], a), s.tilt)
            p = [p[0], p[1], p[2] - s.radius]
            if (p[2] >= P * 0.95) continue
            const k = P / (P - p[2])
            minX = Math.min(minX, p[0] * k)
            maxX = Math.max(maxX, p[0] * k)
            minY = Math.min(minY, p[1] * k)
            maxY = Math.max(maxY, p[1] * k)
          }
        }
      }
      const spanX = Math.max(maxX - minX, 1)
      const spanY = Math.max(maxY - minY, 1)
      const fit = Math.min(1, width / spanX, height / spanY)
      state.fit = fit
      // lift the ring to leave room for its reflection on the floor
      state.shift = -((minY + maxY) / 2) * fit - (s.axis === 'x' ? 0 : room / 2) - (s.mirror ? spanY * fit * floor * 1.1 : 0)
      state.drop = s.axis === 'x' ? (rect.width / fit) * 0.55 + s.cardW : (rect.height / fit) * 0.55 + s.cardH
      stageRefs.current.forEach((stage) => {
        if (!stage) return
        stage.style.perspective = `${P}px`
        stage.style.transform = `translate3d(0, ${state.shift}px, 0) scale(${fit})`
      })
      // the floor line runs just under the ring's lowest edge; the mirror flips about it
      if (mirrorRef.current) {
        const floorY = state.shift + maxY * fit + 6
        const mid = rect.height / 2
        mirrorRef.current.style.transform = `translateY(${2 * floorY}px) scaleY(-1)`
        const line = ((mid + floorY) / rect.height) * 100
        const mask = `linear-gradient(to bottom, transparent ${line}%, rgba(0,0,0,.42) ${line + 0.5}%, transparent ${Math.min(100, line + 22)}%)`
        mirrorRef.current.parentElement.style.webkitMaskImage = mask
        mirrorRef.current.parentElement.style.maskImage = mask
      }
    }
    measureRef.current = measure

    const introCard = (elapsed, landing) => {
      if (!state.intro) return { radius: 1, lift: 0 }
      const type = state.intro.type
      const reach = Math.abs(wrap(landing + state.angle))
      if (type === 'assemble') {
        const p = easeOut(clamp((elapsed - (reach / 180) * 420) / 1080, 0, 1))
        return { radius: 1 + 0.6 * (1 - p), lift: 0 }
      }
      if (type === 'rise') {
        const p = easeOutQuint(clamp((elapsed - (reach / 180) * 480) / 900, 0, 1))
        return { radius: 1, lift: (1 - p) * state.drop }
      }
      if (type === 'spin') {
        const p = easeOut(clamp(elapsed / INTRO_LENGTH.spin, 0, 1))
        return { radius: 1 + 0.28 * (1 - p), lift: 0 }
      }
      return { radius: 1, lift: 0 }
    }

    const advance = (s, dt, now) => {
      if (!state.introDone && readyRef.current) {
        if (!state.intro) {
          if (s.intro === 'none') state.introDone = true
          else state.intro = { type: s.intro, start: now }
        }
        if (state.intro && now - state.intro.start >= INTRO_LENGTH[state.intro.type]) {
          state.intro = null
          state.introDone = true
        }
      }
      const paused = (s.pauseOnHover && state.hover) || state.drag || now < state.holdUntil
      const cruise = s.autoplay === 'drift' && !paused && !state.intro ? s.speed * state.dir : 0
      let busy = Boolean(state.intro) || state.drag

      if (state.drag || state.intro) {
        state.velocity = state.drag ? state.velocity : 0
      } else if (state.target !== null) {
        // a critically damped spring onto the target card
        let remaining = dt
        const damping = 2 * Math.sqrt(SPRING)
        while (remaining > 0) {
          const h = Math.min(remaining, 1 / 240)
          const accel = SPRING * (state.target - state.angle) - damping * state.velocity
          state.velocity += accel * h
          state.angle += state.velocity * h
          remaining -= h
        }
        if (Math.abs(state.target - state.angle) < 0.004 && Math.abs(state.velocity) < 0.03) {
          state.angle = state.target
          state.velocity = 0
          state.target = null
        }
        busy = true
      } else {
        const tau = 0.18 + s.momentum * 1.5
        state.velocity += (cruise - state.velocity) * (1 - Math.exp(-dt / tau))
        state.angle += state.velocity * dt
        if (cruise === 0 && s.snap && Math.abs(state.velocity) < SETTLE_SPEED) state.target = nearest(state.angle)
        busy = busy || cruise !== 0 || Math.abs(state.velocity) > 0.01 || state.target !== null
      }

      if (s.autoplay === 'step' && !paused && !state.intro && state.introDone) {
        if (!state.stepAt) state.stepAt = now + s.interval * 1000
        if (now >= state.stepAt) {
          state.target = (state.target ?? nearest(state.angle)) + s.step * state.dir
          state.stepAt = now + s.interval * 1000
        }
        busy = true
      } else state.stepAt = 0

      if (now < state.holdUntil) busy = true

      const ease = 1 - Math.exp(-dt / 0.35)
      const aimYaw = state.pointer.inside ? state.pointer.x * s.parallax * 9 : 0
      const aimPitch = state.pointer.inside ? -state.pointer.y * s.parallax * 6 : 0
      state.yaw += (aimYaw - state.yaw) * ease
      state.pitch += (aimPitch - state.pitch) * ease
      if (Math.abs(aimYaw - state.yaw) > 0.01 || Math.abs(aimPitch - state.pitch) > 0.01) busy = true
      return busy
    }

    const render = (s, now) => {
      const elapsed = state.intro ? now - state.intro.start : 0
      const swell = 1 + s.stretch * 0.12 * Math.min(1, Math.abs(state.velocity) / 420)
      let spinOffset = 0
      if (state.intro?.type === 'spin') spinOffset = -300 * state.dir * (1 - easeOut(clamp(elapsed / INTRO_LENGTH.spin, 0, 1)))
      else if (state.intro?.type === 'assemble') spinOffset = -32 * state.dir * (1 - easeOut(clamp(elapsed / INTRO_LENGTH.assemble, 0, 1)))
      const angle = state.angle + spinOffset
      const R = s.radius * swell

      let cameraT
      let ringT
      if (s.axis === 'x') {
        cameraT = `translate3d(0, 0, ${-R}px) rotateY(${s.tilt + state.yaw}deg) rotateX(${state.pitch}deg)`
        ringT = `rotateX(${-angle}deg)`
      } else if (s.layout.inward) {
        cameraT = `translate3d(0, 0, ${s.perspective - 1}px) rotateX(${s.tilt + state.pitch}deg) rotateY(${state.yaw}deg)`
        ringT = `rotateY(${angle}deg)`
      } else {
        cameraT = `translate3d(0, 0, ${-R}px) rotateX(${s.tilt + state.pitch}deg) rotateY(${state.yaw}deg)`
        ringT = `rotateY(${angle}deg)`
      }
      cameraRefs.current.forEach((c) => c && (c.style.transform = cameraT))
      ringRefs.current.forEach((r) => r && (r.style.transform = ringT))

      for (let index = 0; index < s.count; index++) {
        const base = index * s.step
        const mod = introCard(elapsed, base)
        const r = R * mod.radius
        let transform
        if (s.axis === 'x') transform = `rotateX(${-base}deg) translateZ(${r}px)`
        else if (s.layout.inward) transform = `rotateY(${base}deg) translateZ(${-r}px)`
        else {
          transform = `rotateY(${base}deg) translateZ(${r}px)`
          if (s.layout.billboard) transform += ` rotateY(${-(base + angle)}deg)`
        }
        if (mod.lift) transform += s.axis === 'x' ? ` translateX(${mod.lift}px)` : ` translateY(${mod.lift}px)`
        const world = wrap(base + angle)
        const facing = Math.cos(world * TO_RAD)
        const fade = (s.depthFade * Math.pow((1 - facing) / 2, 1.25)).toFixed(3)
        // the sheen: a band of light that crosses the card as it swings through the front
        const sx = `${(50 - world * 2.4).toFixed(1)}%`
        const sa = (s.sheen * Math.pow(Math.max(0, facing), 6) * clamp(1 - Math.abs(world) / 40, 0, 1)).toFixed(3)
        for (const set of cardRefs.current) {
          const card = set[index]
          if (!card) continue
          card.style.transform = transform
          if (s.layout.inward) card.style.visibility = Math.abs(world) > 86 ? 'hidden' : ''
          card.style.setProperty('--hc-depth', fade)
          card.style.setProperty('--hc-sx', sx)
          card.style.setProperty('--hc-sa', sa)
        }
      }

      const index = ((Math.round(-state.angle / s.step) % s.count) + s.count) % s.count || 0
      if (index !== activeRef.current) {
        activeRef.current = index
        setActive(index)
        onChangeRef.current?.(index)
      }
    }

    const frame = (now) => {
      raf = 0
      const s = settingsRef.current
      const dt = state.last ? Math.min((now - state.last) / 1000, 0.05) : 1 / 60
      state.last = now
      const busy = advance(s, dt, now)
      render(s, now)
      if (busy && visible && !document.hidden) raf = requestAnimationFrame(frame)
      else state.last = 0
    }
    const wake = () => {
      if (!raf && visible && !document.hidden) raf = requestAnimationFrame(frame)
    }
    wakeRef.current = wake

    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf)
        raf = 0
        state.last = 0
      } else wake()
    }
    const resize = new ResizeObserver(() => {
      measure()
      wake()
    })
    resize.observe(root)
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      if (visible) wake()
      else {
        cancelAnimationFrame(raf)
        raf = 0
        state.last = 0
      }
    })
    io.observe(root)

    const onWheel = (event) => {
      const s = settingsRef.current
      if (!s.draggable) return
      const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : 0
      if (!delta) return
      event.preventDefault()
      const perPixel = 180 / (Math.PI * s.radius * state.fit)
      const sign = s.layout.inward ? -1 : 1
      state.target = null
      state.angle -= delta * perPixel * sign
      state.velocity = -delta * perPixel * sign * 30
      state.holdUntil = performance.now() + 1600
      clearTimeout(state.wheelTimer)
      state.wheelTimer = setTimeout(() => {
        if (settingsRef.current.snap) state.target = nearest(state.angle + state.velocity * 0.12)
        wake()
      }, 140)
      wake()
    }
    root.addEventListener('wheel', onWheel, { passive: false })
    document.addEventListener('visibilitychange', onVisibility)

    measure()
    render(settingsRef.current, performance.now())
    wake()

    return () => {
      cancelAnimationFrame(raf)
      resize.disconnect()
      io.disconnect()
      clearTimeout(state.wheelTimer)
      root.removeEventListener('wheel', onWheel)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  useLayoutEffect(() => {
    measureRef.current()
    wakeRef.current()
  }, [radius, cardW, cardH, tiltValue, perspective, preset, captions, controls, mirror, count])

  useEffect(() => {
    wakeRef.current()
  })

  const focusIndex = useCallback((index) => {
    const state = stateRef.current
    const s = settingsRef.current
    let target = -index * s.step
    target += 360 * Math.round((state.angle - target) / 360)
    state.target = target
    state.holdUntil = performance.now() + 2800
    wakeRef.current()
  }, [])

  const stepBy = useCallback((delta) => {
    const state = stateRef.current
    const s = settingsRef.current
    const base = state.target ?? Math.round(state.angle / s.step) * s.step
    state.target = base - delta * s.step * (s.layout.inward ? -1 : 1)
    state.holdUntil = performance.now() + 2800
    wakeRef.current()
  }, [])

  const updatePointer = (event) => {
    const rect = rootRef.current.getBoundingClientRect()
    const pointer = stateRef.current.pointer
    pointer.x = clamp(((event.clientX - rect.left) / rect.width) * 2 - 1, -1, 1)
    pointer.y = clamp(((event.clientY - rect.top) / rect.height) * 2 - 1, -1, 1)
  }

  const onUi = (event) => Boolean(event.target.closest?.('[data-hc-ui]'))

  const handlePointerDown = (event) => {
    const state = stateRef.current
    state.suppressClick = false
    if (!draggable || event.button !== 0 || onUi(event)) return
    state.press = { id: event.pointerId, x: event.clientX, y: event.clientY, angle: state.angle, moved: false, origin: 0, samples: [{ time: performance.now(), angle: state.angle }] }
  }

  const handlePointerMove = (event) => {
    const state = stateRef.current
    if (event.pointerType === 'mouse') {
      state.pointer.inside = true
      updatePointer(event)
    }
    const press = state.press
    if (!press || press.id !== event.pointerId) {
      wakeRef.current()
      return
    }
    const s = settingsRef.current
    const delta = s.axis === 'x' ? event.clientY - press.y : event.clientX - press.x
    const cross = s.axis === 'x' ? event.clientX - press.x : event.clientY - press.y
    if (!press.moved) {
      if (Math.abs(delta) < DRAG_THRESHOLD) return
      if (Math.abs(cross) > Math.abs(delta) * 1.2 && event.pointerType !== 'mouse') {
        state.press = null
        return
      }
      press.moved = true
      press.origin = delta
      state.drag = true
      state.target = null
      state.velocity = 0
      setDragging(true)
      try {
        rootRef.current.setPointerCapture(event.pointerId)
      } catch {}
    }
    const perPixel = 180 / (Math.PI * s.radius * state.fit)
    state.angle = press.angle + (delta - press.origin) * perPixel * (s.layout.inward ? -1 : 1)
    const now = performance.now()
    press.samples.push({ time: now, angle: state.angle })
    while (press.samples.length > 2 && now - press.samples[0].time > 110) press.samples.shift()
    wakeRef.current()
  }

  const releasePointer = (event) => {
    const state = stateRef.current
    const press = state.press
    if (!press || press.id !== event.pointerId) return
    state.press = null
    if (!press.moved) return
    state.drag = false
    setDragging(false)
    state.suppressClick = true
    const s = settingsRef.current
    const first = press.samples[0]
    const last = press.samples[press.samples.length - 1]
    const span = (last.time - first.time) / 1000
    const velocity = span > 0.008 ? clamp((last.angle - first.angle) / span, -1400, 1400) : 0
    state.velocity = velocity
    if (Math.abs(velocity) > 60) state.dir = Math.sign(velocity)
    const coasting = s.autoplay === 'drift' && !(s.pauseOnHover && state.hover && event.pointerType === 'mouse')
    if (s.snap && !coasting) {
      const tau = 0.18 + s.momentum * 1.5
      state.target = Math.round((state.angle + velocity * tau * 0.55) / s.step) * s.step
    }
    wakeRef.current()
  }

  const handlePointerEnter = (event) => {
    if (event.pointerType !== 'mouse') return
    stateRef.current.hover = true
    wakeRef.current()
  }
  const handlePointerLeave = (event) => {
    const state = stateRef.current
    if (event.pointerType === 'mouse') {
      state.hover = false
      state.pointer.inside = false
    }
    wakeRef.current()
  }

  const handleClick = (event) => {
    const state = stateRef.current
    if (state.suppressClick) {
      state.suppressClick = false
      return
    }
    if (onUi(event)) return
    const card = event.target.closest?.('[data-hc-index]')
    if (!card) return
    const index = Number(card.getAttribute('data-hc-index'))
    if (focusOnClick) focusIndex(index)
    onItemClick?.(list[index], index)
  }

  const handleKeyDown = (event) => {
    if (onUi(event)) return
    const forward = axis === 'x' ? 'ArrowDown' : 'ArrowRight'
    const backward = axis === 'x' ? 'ArrowUp' : 'ArrowLeft'
    if (event.key === forward) stepBy(1)
    else if (event.key === backward) stepBy(-1)
    else if (event.key === 'Home') focusIndex(0)
    else if (event.key === 'End') focusIndex(count - 1)
    else if (event.key === 'Enter' || event.key === ' ') onItemClick?.(list[activeRef.current], activeRef.current)
    else return
    event.preventDefault()
  }

  const current = list[active] || list[0]
  const label = current ? current.title || current.alt || `Image ${active + 1}` : ''

  const renderTile = (item, tile, back, index) => {
    const strip = back ? tile.total - 1 - tile.index : tile.index
    const first = strip === 0
    const last = strip === tile.total - 1
    const r = 'var(--hc-radius)'
    const frameRadius = axis === 'x' ? `${first ? r : 0} ${first ? r : 0} ${last ? r : 0} ${last ? r : 0}` : `${first ? r : 0} ${last ? r : 0} ${last ? r : 0} ${first ? r : 0}`
    const offset = back ? along - tile.end : tile.start
    const size = tile.size
    const box = axis === 'x' ? { left: -cardW / 2, top: -size / 2, width: cardW, height: size } : { left: -size / 2, top: -cardH / 2, width: size, height: cardH }
    const photoStyle = axis === 'x' ? { left: 0, top: -offset, width: cardW, height: cardH } : { left: -offset, top: 0, width: cardW, height: cardH }
    const flip = axis === 'x' ? ' rotateX(180deg)' : ' rotateY(180deg)'
    const gone = leaving?.items[index]
    return (
      <div key={`${back ? 'b' : 'f'}${tile.index}`} className="halo__tile" style={{ ...box, transform: tile.move + (back ? flip : '') }} aria-hidden="true">
        <div className="halo__frame" style={{ height: axis === 'x' ? size : cardH, borderRadius: frameRadius }}>
          <img className="halo__photo" src={item.src} alt="" draggable={false} decoding="async" style={photoStyle} />
          {gone && <img key={`leaving-${leaving.id}`} className="halo__photo halo__photo--leaving" src={gone.src} alt="" draggable={false} decoding="async" style={{ ...photoStyle, animationDelay: `${Math.round(leaving.delays[index])}ms` }} />}
          {!back && <div className="halo__sheen" style={photoStyle} />}
          {back && <div className="halo__inner" />}
          <div className="halo__shade" />
        </div>
      </div>
    )
  }

  // one ring of cards; drawn twice when there is a floor, the second flipped as its reflection
  const ringView = (k) => (
    <div ref={(el) => (stageRefs.current[k] = el)} className="halo__stage">
      <div ref={(el) => (cameraRefs.current[k] = el)} className="halo__camera">
        <div ref={(el) => (ringRefs.current[k] = el)} className="halo__ring">
          {list.map((item, index) => (
            <div
              key={index}
              ref={(el) => {
                cardRefs.current[k][index] = el
              }}
              className="halo__card"
              data-hc-index={k === 0 ? index : undefined}
              role={k === 0 ? 'group' : undefined}
              aria-roledescription={k === 0 ? 'slide' : undefined}
              aria-label={k === 0 ? `${item.title || item.alt || `Image ${index + 1}`}, ${index + 1} of ${count}` : undefined}
            >
              {tiles.map((tile) => renderTile(item, tile, false, index))}
              {layout.backfaces && tiles.map((tile) => renderTile(item, tile, true, index))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
  if (!mirror) {
    stageRefs.current.length = 1
    cameraRefs.current.length = 1
    ringRefs.current.length = 1
    cardRefs.current[1] = []
  }

  return (
    <div
      ref={rootRef}
      className={`halo ${className}`.trim()}
      style={{
        background,
        color,
        ...style,
        '--hc-fade': fadeColor,
        '--hc-radius': `${Math.max(0, cornerRadius)}px`,
        '--hc-inner': (1 - clamp(innerShade, 0, 1)).toFixed(3),
        '--hc-accent': accent,
      }}
      role="region"
      aria-roledescription="carousel"
      aria-label="Image carousel"
      tabIndex={0}
      data-axis={axis}
      data-shape={shape}
      data-ready={ready ? '' : undefined}
      data-draggable={draggable ? '' : undefined}
      data-dragging={dragging ? '' : undefined}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={releasePointer}
      onPointerCancel={releasePointer}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <style>{CSS}</style>
      {mirror && (
        <div className="halo__view" aria-hidden="true" style={{ pointerEvents: 'none' }}>
          <div ref={mirrorRef} className="halo__mirror">
            {ringView(1)}
          </div>
        </div>
      )}
      <div className="halo__view halo__view--main" style={{ bottom: axis === 'x' ? (captions ? CAPTION_SPACE + 14 : 0) + (controls ? DOTS_SPACE : 0) : 0 }}>
        {ringView(0)}
      </div>
      {controls && (
        <>
          <button type="button" className="halo__nav" data-hc-ui="" style={{ left: 14 }} aria-label="Previous" onClick={() => stepBy(-1)}>
            <Arrow dir={-1} />
          </button>
          <button type="button" className="halo__nav" data-hc-ui="" style={{ right: 14 }} aria-label="Next" onClick={() => stepBy(1)}>
            <Arrow dir={1} />
          </button>
          <div className="halo__dots" data-hc-ui="" role="tablist" aria-label="Choose a card">
            {list.map((item, i) => (
              <button key={i} type="button" className="halo__dot" role="tab" aria-current={i === active ? 'true' : 'false'} aria-selected={i === active} aria-label={item.title || item.alt || `Card ${i + 1}`} onClick={() => focusIndex(i)} />
            ))}
          </div>
        </>
      )}
      {captions && current && (
        <div className="halo__caption" aria-hidden="true" style={{ bottom: controls ? 22 + DOTS_SPACE : 22 }}>
          <span key={active} className="halo__title">
            {current.title || current.alt}
            {current.subtitle && <span className="halo__subtitle">{current.subtitle}</span>}
          </span>
          <span className="halo__count">
            <Digits value={active + 1} />
            <span className="halo__slash">/</span>
            <span>{String(count).padStart(2, '0')}</span>
          </span>
        </div>
      )}
      <div className="halo__live" aria-live="polite" aria-atomic="true">
        {`${label}, ${active + 1} of ${count}`}
      </div>
    </div>
  )
}
