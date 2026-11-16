'use client'

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'

// A full landing page for a fictional AI studio, "Lumo", built as one
// scrolling component. The scroll effects all run off the page's own scroll:
//   hero      - a glow of soft colour blobs drifting and melting together on a
//               canvas, a headline that sharpens word by word out of a blur, and
//               a prompt box whose placeholder types out ideas; send a prompt
//               and it "generates" three artworks beneath
//   statement - a line that lights up word by word as you scroll through it
//   gallery   - three columns drifting at different speeds, each card blurring
//               in and out of focus with its distance from the middle
//   steps     - a row of cards you drag sideways, with animated icons
//   numbers   - benchmark bars that fill and count up when they come into view
//   people    - a testimonial slider, then pricing with a monthly/yearly
//               switch, an FAQ accordion and a waitlist form
// Pass `images` to fill the gallery and the generated results with your own
// pictures; by default it draws its own artwork, so it needs no network.

// ---------------------------------------------------------------- artwork

// Abstract glow pieces drawn as SVG: ribbons, rings, ripples and arches in
// the accent's hue, so the page has pictures before you give it any.
function glowArt(seed, a, b) {
  const r = (n) => {
    const x = Math.sin(seed * 9.13 + n * 3.71) * 43758.5453
    return x - Math.floor(x)
  }
  const kind = seed % 5
  const w = 'rgba(255,255,255,'
  let body = ''
  if (kind === 0)
    for (let i = 0; i < 9; i++) body += `<path d="M-20 ${250 + i * 14} C 120 ${120 + r(i) * 80 + i * 10}, 260 ${330 - i * 6}, 420 ${150 + i * 18}" stroke="${w}${0.12 + i * 0.07})" stroke-width="${3 + i}" fill="none"/>`
  else if (kind === 1)
    for (let i = 0; i < 7; i++) body += `<ellipse cx="200" cy="${230 + i * 6}" rx="${70 + i * 26}" ry="${18 + i * 7}" stroke="${w}${0.75 - i * 0.09})" stroke-width="${2 + (i % 3)}" fill="none"/>`
  else if (kind === 2) {
    body += `<circle cx="${150 + r(1) * 100}" cy="150" r="70" fill="${w}0.85)"/>`
    for (let i = 0; i < 6; i++) body += `<path d="M0 ${300 + i * 16} Q 200 ${250 + i * 12} 400 ${300 + i * 16}" stroke="${w}${0.6 - i * 0.08})" stroke-width="3" fill="none"/>`
  } else if (kind === 3)
    for (let i = 0; i < 6; i++) body += `<path d="M${60 + i * 14} 400 A ${140 - i * 14} ${170 - i * 16} 0 0 1 ${340 - i * 14} 400" stroke="${w}${0.25 + i * 0.12})" stroke-width="${4 + i * 2}" fill="none"/>`
  else
    for (let i = 0; i < 14; i++) {
      const x = 40 + i * 24 + r(i) * 10
      body += `<path d="M${x} 400 Q ${x + (r(i + 4) - 0.5) * 60} ${260 - r(i + 7) * 80} ${x + (r(i + 2) - 0.5) * 30} ${120 + r(i + 9) * 90}" stroke="${w}${0.3 + r(i) * 0.5})" stroke-width="2" fill="none"/>`
    }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><defs><radialGradient id="g" cx="${0.3 + r(5) * 0.4}" cy="${0.3 + r(6) * 0.3}" r="0.9"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></radialGradient><filter id="s"><feGaussianBlur stdDeviation="1.2"/></filter></defs><rect width="400" height="400" fill="url(#g)"/><g filter="url(#s)">${body}</g></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

// ---------------------------------------------------------------- content

const PROMPTS = ['A lighthouse made of glass at dusk', 'Low-poly fox curled up in snow', 'A neon city seen through rain', 'Product shot of a ceramic mug, soft light', 'An astronaut drifting past a ringed planet']

const STEPS = [
  { title: 'Describe', body: 'Say what you want in plain words: a scene, a product shot, a whole brand world.', icon: 'chat' },
  { title: 'Generate', body: 'Lumo sketches several directions at once, each lit and composed to finish.', icon: 'stack' },
  { title: 'Refine', body: 'Nudge light, colour and camera by talking to it, or drag the sliders.', icon: 'sliders' },
  { title: 'Ship', body: 'Export stills, loops or 3D scenes, or push straight into your project.', icon: 'plane' },
]

const BENCH = [
  { name: 'Speed', rows: [['Lumo', 93.6], ['Studio A', 72.4], ['Studio B', 66.1], ['Studio C', 58.9]] },
  { name: 'Quality', rows: [['Lumo', 95.2], ['Studio A', 87.5], ['Studio B', 80.3], ['Studio C', 77.8]] },
  { name: 'Consistency', rows: [['Lumo', 97.4], ['Studio B', 82.6], ['Studio A', 79.1], ['Studio C', 71.2]] },
]

const PEOPLE = [
  { org: 'Northwind Studio', kind: 'Motion studio', quote: 'We used to storyboard for a week. Now we walk into the client call with twenty lit directions and pick one together.', name: 'Ines Okafor', role: 'Head of Motion', stats: [['Concepts per brief', '20+'], ['Pitch prep', '-70%'], ['Team', '9 artists']] },
  { org: 'Pebble Labs', kind: 'Hardware startup', quote: 'No in-house 3D team, and our launch renders still look like they came from one. Lumo paid for itself in the first week.', name: 'Tomas Lindqvist', role: 'Founder', stats: [['Render budget saved', '$90k'], ['Launch time', '3 weeks'], ['Shots made', '400+']] },
  { org: 'Atlas Publishing', kind: 'Enterprise', quote: 'Every cover, banner and social post now shares one look, across six teams and four time zones. That used to be impossible.', name: 'Priya Raman', role: 'Brand Director', stats: [['Brand match', '99%'], ['Seats', '150+'], ['Assets a month', '3,800']] },
]

const PLANS = [
  { name: 'Spark', note: 'For makers and side projects', price: 24, features: ['60 generations a month', 'Stills and loops', 'PNG, MP4 and GLB export', 'Community support'], cta: 'Start free' },
  { name: 'Studio', note: 'For small teams shipping often', price: 79, features: ['Unlimited generations', 'Brand styles and palettes', 'All export formats', 'Priority queue', '5 seats', 'API access'], cta: 'Choose Studio', featured: true },
  { name: 'Scale', note: 'For organisations', price: null, features: ['Everything in Studio', 'Unlimited seats', 'Custom style training', 'SSO and audit logs', 'Dedicated support'], cta: 'Talk to us' },
]

const FAQ = [
  ['What can Lumo make?', 'Stills, short loops and simple 3D scenes: product shots, illustrations, backgrounds, characters and brand imagery. Describe it in plain words and you get several finished directions to choose from.'],
  ['Can I keep a consistent look?', 'Yes. Save a brand style (palette, lighting, camera and texture) and every generation follows it, for every member of the team.'],
  ['Can I edit after generating?', 'Talk to it ("warmer light, lower camera") or use the sliders for light, colour and framing. Each change keeps the rest of the picture intact.'],
  ['Which formats can I export?', 'PNG and JPG for stills, MP4 and WebM for loops, and GLB for 3D scenes. Studio and Scale also export layered files.'],
  ['Who owns what I make?', 'You do. Your prompts and results are private to your workspace and are never used to train shared models.'],
]

// ---------------------------------------------------------------- styles

const CSS = `
.lumo{--lu-accent:#7c5cff;--lu-bg:#05060c;--lu-fg:#eef0f6;--lu-muted:rgba(238,240,246,.58);--lu-card:#0d0f1a;--lu-line:rgba(255,255,255,.08);position:relative;height:100%;overflow:auto;overflow-x:hidden;background:var(--lu-bg);color:var(--lu-fg);font-family:"Segoe UI Variable Display","Segoe UI",system-ui,-apple-system,"Helvetica Neue",sans-serif;-webkit-font-smoothing:antialiased;scroll-behavior:smooth}
.lumo[data-theme='light']{--lu-bg:#f6f6fa;--lu-fg:#11131c;--lu-muted:rgba(17,19,28,.58);--lu-card:#ffffff;--lu-line:rgba(17,19,28,.08)}
.lumo *{box-sizing:border-box}
.lumo button{font:inherit}
.lumo :focus-visible{outline:2px solid var(--lu-accent);outline-offset:3px;border-radius:10px}
.lumo__wrap{width:100%;max-width:1120px;margin:0 auto;padding:0 28px}
.lumo__nav{position:sticky;top:0;z-index:20;display:flex;align-items:center;justify-content:space-between;padding:18px 28px;backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);background:color-mix(in srgb,var(--lu-bg) 55%,transparent);border-bottom:1px solid var(--lu-line)}
.lumo__logo{display:flex;align-items:center;gap:9px;font-weight:800;letter-spacing:.12em;font-size:15px}
.lumo__links{display:flex;gap:26px;font-size:14px;font-weight:500}
.lumo__links a{color:inherit;text-decoration:none;opacity:.8}
.lumo__links a:hover{opacity:1}
.lumo__pill{border:none;border-radius:999px;padding:9px 16px;font-size:13px;font-weight:600;cursor:pointer;background:var(--lu-fg);color:var(--lu-bg)}
.lumo__hero{position:relative;min-height:640px;display:flex;align-items:center;overflow:hidden;padding:80px 0 70px}
.lumo__glow{position:absolute;inset:-10%;width:120%;height:120%;filter:blur(64px) saturate(1.2);opacity:.95}
.lumo__heroFade{position:absolute;left:0;right:0;bottom:0;height:45%;background:linear-gradient(to bottom,transparent,var(--lu-bg))}
.lumo__h1{font-size:clamp(38px,6.4vw,72px);line-height:1.04;letter-spacing:-.03em;font-weight:600;margin:0 0 30px}
.lumo__word{display:inline-block;animation:lu-blur-in .9s cubic-bezier(.2,.8,.2,1) both}
.lumo__h1 em{font-style:italic;font-weight:500;color:var(--lu-accent)}
.lumo__box{position:relative;max-width:780px;border-radius:24px;padding:18px 18px 14px;background:color-mix(in srgb,var(--lu-card) 72%,transparent);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);box-shadow:0 20px 60px rgba(0,0,0,.35),inset 0 0 0 1px var(--lu-line)}
.lumo__box textarea{width:100%;min-height:56px;resize:none;border:none;outline:none;background:transparent;color:inherit;font:inherit;font-size:16px;line-height:1.5}
.lumo__chips{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.lumo__chip{display:inline-flex;align-items:center;gap:6px;border:none;border-radius:999px;padding:8px 13px;font-size:13px;cursor:pointer;color:inherit;background:var(--lu-line)}
.lumo__chip[aria-pressed='true']{background:color-mix(in srgb,var(--lu-accent) 26%,transparent);box-shadow:inset 0 0 0 1px var(--lu-accent)}
.lumo__send{margin-left:auto;width:42px;height:42px;border:none;border-radius:50%;display:grid;place-items:center;cursor:pointer;background:var(--lu-accent);color:#fff;transition:transform .2s}
.lumo__send:hover{transform:scale(1.07)}
.lumo__send:disabled{opacity:.5;cursor:default;transform:none}
.lumo__results{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:14px}
.lumo__result{aspect-ratio:1;border-radius:14px;overflow:hidden;position:relative;background:var(--lu-line)}
.lumo__result img{width:100%;height:100%;object-fit:cover;display:block;animation:lu-blur-in 1s cubic-bezier(.2,.8,.2,1) both}
.lumo__shimmer{position:absolute;inset:0;background:linear-gradient(110deg,transparent 30%,rgba(255,255,255,.14) 50%,transparent 70%);background-size:200% 100%;animation:lu-shimmer 1.1s linear infinite}
.lumo__small{font-size:12px;color:var(--lu-muted)}
.lumo__section{padding:110px 0}
.lumo__eyebrow{font-size:12px;line-height:1;font-weight:500;letter-spacing:.24em;text-transform:uppercase;color:var(--lu-accent);margin-bottom:16px}
.lumo__h2{font-size:clamp(28px,4vw,46px);line-height:1.1;letter-spacing:-.025em;font-weight:600;margin:0 0 18px}
.lumo__lead{font-size:17px;line-height:1.6;color:var(--lu-muted);max-width:560px;margin:0}
.lumo__statement{font-size:clamp(30px,5vw,58px);line-height:1.14;letter-spacing:-.025em;font-weight:600;text-align:center;max-width:900px;margin:0 auto}
.lumo__statement span{transition:opacity .2s,filter .2s}
.lumo__gallery{display:grid;grid-template-columns:repeat(3,1fr);gap:22px;margin-top:40px}
.lumo__col{display:flex;flex-direction:column;gap:22px;will-change:transform}
.lumo__card{border-radius:18px;overflow:hidden;position:relative;box-shadow:0 18px 50px rgba(0,0,0,.3);will-change:filter,transform}
.lumo__card img{width:100%;height:100%;object-fit:cover;display:block}
.lumo__card span{position:absolute;left:16px;bottom:14px;font-weight:600;font-size:15px;color:#fff;text-shadow:0 2px 12px rgba(0,0,0,.6)}
.lumo__rail{display:flex;gap:16px;overflow-x:auto;scroll-snap-type:x mandatory;scroll-padding:0 2px;padding:6px 2px 24px;margin:36px 0 0;cursor:grab;scrollbar-width:none}
.lumo__rail::-webkit-scrollbar{display:none}
.lumo__rail[data-drag]{cursor:grabbing;scroll-snap-type:none}
.lumo__step{flex:0 0 min(330px,80%);scroll-snap-align:start;border-radius:20px;padding:26px;background:var(--lu-card);box-shadow:inset 0 0 0 1px var(--lu-line);min-height:330px;display:flex;flex-direction:column;user-select:none}
.lumo__step h3{margin:0 0 10px;font-size:20px;letter-spacing:-.01em}
.lumo__step p{margin:0;color:var(--lu-muted);font-size:15px;line-height:1.55}
.lumo__icon{margin-top:auto;align-self:center;transition:transform .5s cubic-bezier(.2,.8,.2,1)}
.lumo__step:hover .lumo__icon{transform:translateY(-8px) rotate(-4deg) scale(1.05)}
.lumo__bench{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:22px;margin-top:40px}
.lumo__benchCard{border-radius:20px;padding:24px;background:var(--lu-card);box-shadow:inset 0 0 0 1px var(--lu-line)}
.lumo__row{margin-top:16px}
.lumo__rowHead{display:flex;justify-content:space-between;font-size:13px;margin-bottom:7px;font-variant-numeric:tabular-nums}
.lumo__bar{height:8px;border-radius:5px;background:var(--lu-line);overflow:hidden}
.lumo__bar i{display:block;height:100%;border-radius:5px;transition:width 1.4s cubic-bezier(.2,.8,.2,1)}
.lumo__quoteCard{border-radius:26px;padding:40px;display:grid;grid-template-columns:1.7fr 1fr;gap:36px;background:linear-gradient(135deg,color-mix(in srgb,var(--lu-accent) 26%,var(--lu-card)),var(--lu-card));box-shadow:inset 0 0 0 1px var(--lu-line)}
.lumo__quote{font-size:clamp(18px,2.2vw,23px);line-height:1.5;margin:18px 0 28px;letter-spacing:-.01em}
.lumo__avatar{width:120px;height:150px;border-radius:999px;display:grid;place-items:center;font-size:40px;font-weight:700;color:#fff}
.lumo__stat{display:flex;justify-content:space-between;font-size:14px;padding:7px 0;border-bottom:1px solid var(--lu-line)}
.lumo__dots{display:flex;align-items:center;gap:8px}
.lumo__dot{width:8px;height:8px;border-radius:5px;border:none;padding:0;background:var(--lu-fg);opacity:.3;cursor:pointer;transition:width .35s,opacity .2s}
.lumo__dot[aria-current='true']{width:28px;opacity:1}
.lumo__round{width:44px;height:44px;border-radius:50%;border:none;display:grid;place-items:center;cursor:pointer;color:inherit;background:var(--lu-card);box-shadow:inset 0 0 0 1px var(--lu-line)}
.lumo__toggle{display:inline-flex;padding:4px;border-radius:999px;background:var(--lu-card);box-shadow:inset 0 0 0 1px var(--lu-line)}
.lumo__toggle button{border:none;border-radius:999px;padding:8px 16px;font-size:13px;font-weight:600;cursor:pointer;color:inherit;background:transparent}
.lumo__toggle button[aria-pressed='true']{background:var(--lu-fg);color:var(--lu-bg)}
.lumo__plans{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:20px;margin-top:36px;align-items:stretch}
.lumo__plan{border-radius:22px;padding:28px;background:var(--lu-card);box-shadow:inset 0 0 0 1px var(--lu-line);display:flex;flex-direction:column;position:relative}
.lumo__plan[data-featured]{box-shadow:inset 0 0 0 1.5px var(--lu-accent),0 30px 80px -30px var(--lu-accent)}
.lumo__price{font-size:44px;font-weight:700;letter-spacing:-.03em;margin:16px 0 4px}
.lumo__plan ul{list-style:none;padding:0;margin:20px 0 26px;display:grid;gap:10px;font-size:14px}
.lumo__plan li{display:flex;gap:9px;align-items:flex-start;color:var(--lu-muted)}
.lumo__cta{margin-top:auto;border:none;border-radius:12px;padding:13px;font-weight:600;cursor:pointer;color:var(--lu-fg);background:var(--lu-line)}
.lumo__plan[data-featured] .lumo__cta{background:var(--lu-accent);color:#fff}
.lumo__faq{display:grid;grid-template-columns:1fr 1.3fr;gap:40px}
.lumo__q{border-radius:16px;background:var(--lu-card);box-shadow:inset 0 0 0 1px var(--lu-line);margin-bottom:12px;overflow:hidden}
.lumo__q button{width:100%;display:flex;justify-content:space-between;align-items:center;gap:16px;padding:20px 22px;border:none;background:none;color:inherit;font-weight:600;font-size:15px;text-align:left;cursor:pointer}
.lumo__q button svg{transition:transform .3s;flex:none}
.lumo__q[data-open] button svg{transform:rotate(45deg)}
.lumo__a{display:grid;grid-template-rows:0fr;transition:grid-template-rows .35s cubic-bezier(.2,.8,.2,1)}
.lumo__q[data-open] .lumo__a{grid-template-rows:1fr}
.lumo__a>div{overflow:hidden}
.lumo__a p{margin:0;padding:0 22px 20px;color:var(--lu-muted);line-height:1.6;font-size:15px}
.lumo__join{position:relative;overflow:hidden;border-radius:30px;padding:70px 30px;text-align:center;background:var(--lu-card);box-shadow:inset 0 0 0 1px var(--lu-line)}
.lumo__form{display:flex;gap:10px;justify-content:center;margin-top:26px;flex-wrap:wrap}
.lumo__form input{min-width:260px;border:none;outline:none;border-radius:12px;padding:14px 16px;font:inherit;color:inherit;background:var(--lu-line)}
.lumo__foot{display:grid;grid-template-columns:1.4fr repeat(3,1fr);gap:24px;padding:60px 0 40px;font-size:14px;border-top:1px solid var(--lu-line);margin-top:40px}
.lumo__foot a{display:block;color:var(--lu-muted);text-decoration:none;margin-top:9px}
@keyframes lu-blur-in{from{opacity:0;filter:blur(14px);transform:translateY(14px)}to{opacity:1;filter:blur(0);transform:none}}
@keyframes lu-shimmer{from{background-position:200% 0}to{background-position:-200% 0}}
@keyframes lu-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
@media (max-width:760px){.lumo__links{display:none}.lumo__quoteCard,.lumo__faq{grid-template-columns:1fr}.lumo__gallery{grid-template-columns:repeat(2,1fr)}.lumo__gallery .lumo__col:nth-child(3){display:none}.lumo__foot{grid-template-columns:1fr 1fr}}
@media (prefers-reduced-motion:reduce){.lumo{scroll-behavior:auto}.lumo__word,.lumo__result img{animation:none}.lumo__bar i,.lumo__icon{transition:none}}
`

// ---------------------------------------------------------------- pieces

const clamp = (v, a, b) => Math.min(b, Math.max(a, v))

function Logo({ accent }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="none" stroke={accent} strokeWidth="2.2" />
      <circle cx="12" cy="12" r="4.2" fill="currentColor" />
      <circle cx="18.5" cy="6" r="2.2" fill={accent} />
    </svg>
  )
}

// The hero's glow: big soft blobs on slow looping paths, melted together by
// a heavy CSS blur on the canvas.
function Glow({ accent, theme }) {
  const ref = useRef(null)
  useEffect(() => {
    const canvas = ref.current
    const g = canvas.getContext('2d')
    let raf = 0
    let visible = true
    const blobs = [
      { c: accent, r: 0.36, ax: 0.32, ay: 0.18, fx: 0.11, fy: 0.17, p: 0 },
      { c: '#3a2bff', r: 0.3, ax: 0.28, ay: 0.22, fx: 0.07, fy: 0.13, p: 2 },
      { c: theme === 'light' ? '#ffffff' : '#000000', r: 0.34, ax: 0.3, ay: 0.16, fx: 0.09, fy: 0.12, p: 4 },
      { c: '#ff6a9b', r: 0.2, ax: 0.36, ay: 0.24, fx: 0.13, fy: 0.08, p: 1 },
      { c: theme === 'light' ? '#c9c2ff' : '#0b0a3a', r: 0.42, ax: 0.18, ay: 0.12, fx: 0.05, fy: 0.07, p: 3 },
    ]
    const draw = (t) => {
      raf = 0
      const w = (canvas.width = canvas.clientWidth / 2)
      const h = (canvas.height = canvas.clientHeight / 2)
      g.clearRect(0, 0, w, h)
      const s = t / 1000
      for (const b of blobs) {
        const x = w * (0.5 + b.ax * Math.sin(s * b.fx * 6.28 + b.p))
        const y = h * (0.42 + b.ay * Math.cos(s * b.fy * 6.28 + b.p * 1.3))
        const r = Math.min(w, h) * b.r * (1 + 0.15 * Math.sin(s * 0.7 + b.p))
        const grad = g.createRadialGradient(x, y, 0, x, y, r)
        grad.addColorStop(0, b.c)
        grad.addColorStop(1, `${b.c}00`)
        g.fillStyle = grad
        g.beginPath()
        g.ellipse(x, y, r * 1.35, r, Math.sin(s * 0.2 + b.p), 0, Math.PI * 2)
        g.fill()
      }
      if (visible) raf = requestAnimationFrame(draw)
    }
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting
      if (visible && !raf) raf = requestAnimationFrame(draw)
    })
    io.observe(canvas)
    raf = requestAnimationFrame(draw)
    return () => (cancelAnimationFrame(raf), io.disconnect())
  }, [accent, theme])
  return <canvas ref={ref} className="lumo__glow" aria-hidden="true" />
}

function StepIcon({ kind, accent }) {
  const common = { width: 150, height: 130, viewBox: '0 0 150 130', className: 'lumo__icon', 'aria-hidden': true }
  const fill = 'rgba(255,255,255,.92)'
  const shade = 'rgba(255,255,255,.35)'
  if (kind === 'chat')
    return (
      <svg {...common}>
        <rect x="18" y="18" width="104" height="70" rx="18" fill={shade} />
        <rect x="28" y="28" width="104" height="70" rx="18" fill={fill} />
        <path d="M48 98 l-10 20 l26-20z" fill={fill} />
        <rect x="44" y="50" width="50" height="7" rx="3.5" fill={accent} />
        <rect x="44" y="66" width="32" height="7" rx="3.5" fill={shade} />
        <rect x="100" y="48" width="3" height="28" rx="1.5" fill={accent} style={{ animation: 'lu-float 1.2s steps(2) infinite' }} />
      </svg>
    )
  if (kind === 'stack')
    return (
      <svg {...common}>
        <rect x="44" y="20" width="70" height="86" rx="14" fill={shade} transform="rotate(10 79 63)" />
        <rect x="38" y="22" width="70" height="86" rx="14" fill="rgba(255,255,255,.6)" transform="rotate(-6 73 65)" />
        <rect x="40" y="24" width="70" height="86" rx="14" fill={fill} />
        <circle cx="62" cy="54" r="11" fill={accent} />
        <path d="M46 98 l20-24 l14 14 l10-10 l16 20z" fill={accent} opacity=".55" />
        <path d="M118 22 l3 9 l9 3 l-9 3 l-3 9 l-3-9 l-9-3 l9-3z" fill={accent} style={{ animation: 'lu-float 2s ease-in-out infinite' }} />
      </svg>
    )
  if (kind === 'sliders')
    return (
      <svg {...common}>
        <rect x="24" y="20" width="102" height="92" rx="18" fill={fill} />
        {[38, 62, 86].map((y, i) => (
          <g key={y}>
            <rect x="40" y={y - 2} width="70" height="4" rx="2" fill="rgba(0,0,0,.12)" />
            <circle cx={[88, 56, 76][i]} cy={y} r="8" fill={i === 1 ? accent : '#1b1d2a'} style={{ animation: `lu-float ${1.6 + i * 0.4}s ease-in-out infinite` }} />
          </g>
        ))}
      </svg>
    )
  return (
    <svg {...common}>
      <path d="M22 70 L128 24 L92 112 L74 80 Z" fill={fill} />
      <path d="M74 80 L128 24 L64 74 Z" fill={shade} />
      <path d="M74 80 L80 104 L92 112 Z" fill={accent} />
      {[0, 1, 2].map((i) => (
        <rect key={i} x={6 + i * 6} y={84 + i * 10} width={22 - i * 4} height="3" rx="1.5" fill={accent} opacity={0.8 - i * 0.2} />
      ))}
    </svg>
  )
}

const Check = ({ accent }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" style={{ flex: 'none', marginTop: 2 }}>
    <circle cx="8" cy="8" r="8" fill={accent} opacity=".18" />
    <path d="M4.6 8.2l2.2 2.2 4.6-4.8" stroke={accent} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const Plus = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
    <path d="M9 3v12M3 9h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
)

const Chevron = ({ dir }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={dir < 0 ? 'M10 3L5 8l5 5' : 'M6 3l5 5-5 5'} />
  </svg>
)

// ---------------------------------------------------------------- the page

export default function AiLanding({ brand = 'Lumo', accent = '#7c5cff', theme = 'dark', images, style }) {
  const uid = useId().replace(/:/g, '')
  const root = useRef(null)
  const statement = useRef(null)
  const words = useRef([])
  const gallery = useRef(null)
  const cols = useRef([])
  const cards = useRef([])
  const bench = useRef(null)
  const rail = useRef(null)
  const [benchOn, setBenchOn] = useState(false)

  // artwork: given images, or our own
  const art = useMemo(() => {
    if (images && images.length) return images
    return Array.from({ length: 12 }, (_, i) => ({ src: glowArt(i + 1, i % 3 === 1 ? '#ff8fb3' : '#8f86ff', i % 2 ? '#0a0b2e' : '#2a1f8f'), title: ['Ribbon', 'Halo', 'Dawn', 'Arches', 'Meadow'][i % 5] }))
  }, [images])

  // ------------------------------------------------ hero prompt
  const [prompt, setPrompt] = useState('')
  const [hint, setHint] = useState('')
  const [mode, setMode] = useState('Image')
  const [busy, setBusy] = useState(false)
  const [results, setResults] = useState(null)
  useEffect(() => {
    // the placeholder types out ideas, one after another
    let i = 0
    let c = 0
    let dir = 1
    const t = setInterval(() => {
      const p = PROMPTS[i]
      c += dir
      if (c > p.length + 18) dir = -1
      if (c <= 0 && dir < 0) {
        dir = 1
        i = (i + 1) % PROMPTS.length
      }
      setHint(p.slice(0, clamp(c, 0, p.length)))
    }, 55)
    return () => clearInterval(t)
  }, [])
  const generate = () => {
    if (busy) return
    const text = (prompt || hint || PROMPTS[0]).trim()
    let h = 0
    for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) >>> 0
    setBusy(true)
    setResults([null, null, null])
    setTimeout(() => {
      setResults([0, 1, 2].map((k) => (art.length ? art[(h + k * 5) % art.length].src : glowArt(h + k, accent, '#0a0b2e'))))
      setBusy(false)
    }, 1500)
  }

  // ------------------------------------------------ scroll effects
  useEffect(() => {
    const el = root.current
    let raf = 0
    const update = () => {
      raf = 0
      const vh = el.clientHeight
      const view = el.getBoundingClientRect()
      // statement: words light up as the line crosses the middle of the view
      const st = statement.current
      if (st) {
        const r = st.getBoundingClientRect()
        const p = clamp((view.top + vh * 0.85 - r.top) / (vh * 0.6 + r.height * 0.5), 0, 1)
        const n = words.current.length
        words.current.forEach((w, i) => {
          if (!w) return
          const k = clamp(p * n - i, 0, 1)
          w.style.opacity = String(0.14 + 0.86 * k)
          w.style.filter = `blur(${(1 - k) * 4}px)`
        })
      }
      // gallery: columns drift at different speeds; cards blur away from the middle
      const gal = gallery.current
      if (gal) {
        const r = gal.getBoundingClientRect()
        const prog = (view.top + vh / 2 - (r.top + r.height / 2)) / vh
        cols.current.forEach((c, i) => c && (c.style.transform = `translateY(${prog * [-120, 70, -40][i]}px)`))
        const mid = view.top + vh / 2
        cards.current.forEach((c) => {
          if (!c) return
          const cr = c.getBoundingClientRect()
          const d = Math.abs(cr.top + cr.height / 2 - mid) / vh
          c.style.filter = `blur(${clamp((d - 0.25) * 16, 0, 9).toFixed(1)}px) brightness(${(1.05 - clamp(d - 0.2, 0, 0.6)).toFixed(2)})`
          c.style.transform = `scale(${(1 - clamp(d - 0.25, 0, 0.5) * 0.12).toFixed(3)})`
        })
      }
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    const ro = new ResizeObserver(onScroll)
    ro.observe(el)
    update()
    // the benchmark bars fill the first time they come into view
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setBenchOn(true), { root: el, threshold: 0.35 })
    if (bench.current) io.observe(bench.current)
    return () => (el.removeEventListener('scroll', onScroll), ro.disconnect(), io.disconnect(), cancelAnimationFrame(raf))
  }, [])

  // ------------------------------------------------ drag the steps rail
  const drag = useRef(null)
  const onRailDown = (e) => {
    if (e.pointerType !== 'mouse') return
    drag.current = { x: e.clientX, left: rail.current.scrollLeft }
    rail.current.setAttribute('data-drag', '')
    rail.current.setPointerCapture(e.pointerId)
  }
  const onRailMove = (e) => {
    if (!drag.current) return
    rail.current.scrollLeft = drag.current.left - (e.clientX - drag.current.x)
  }
  const onRailUp = () => {
    drag.current = null
    rail.current?.removeAttribute('data-drag')
  }

  // ------------------------------------------------ count-up numbers
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!benchOn) return undefined
    let raf
    const t0 = performance.now()
    const tick = (t) => {
      const k = clamp((t - t0) / 1400, 0, 1)
      setCount(1 - Math.pow(1 - k, 3))
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [benchOn])

  // ------------------------------------------------ testimonials
  const [who, setWho] = useState(0)
  const [hold, setHold] = useState(false)
  useEffect(() => {
    if (hold) return undefined
    const t = setTimeout(() => setWho((w) => (w + 1) % PEOPLE.length), 7000)
    return () => clearTimeout(t)
  }, [who, hold])

  const [yearly, setYearly] = useState(false)
  const [open, setOpen] = useState(0)
  const [email, setEmail] = useState('')
  const [joined, setJoined] = useState(false)

  const statementText = `Describe a world. Watch ${brand} light it, frame it and set it moving, before your coffee cools.`
  const person = PEOPLE[who]
  const hue = ['#7c5cff', '#ff6a9b', '#2fc4a8'][who]
  const columns = [0, 1, 2].map((c) => art.filter((_, i) => i % 3 === c).slice(0, 4))
  let cardIndex = 0

  return (
    <div ref={root} className="lumo" data-theme={theme} style={{ '--lu-accent': accent, ...style }} id={`lumo-${uid}`}>
      <style>{CSS}</style>
      <nav className="lumo__nav" aria-label={`${brand} site`}>
        <div className="lumo__logo">
          <Logo accent={accent} />
          {brand.toUpperCase()}
        </div>
        <div className="lumo__links">
          {['Features', 'Gallery', 'Pricing', 'FAQ'].map((l) => (
            <a key={l} href={`#lumo-${uid}-${l.toLowerCase()}`}>
              {l}
            </a>
          ))}
        </div>
        <button type="button" className="lumo__pill" onClick={() => root.current.querySelector('.lumo__join input')?.focus()}>
          Join waitlist
        </button>
      </nav>

      {/* hero */}
      <header className="lumo__hero">
        <Glow accent={accent} theme={theme} />
        <div className="lumo__heroFade" />
        <div className="lumo__wrap" style={{ position: 'relative' }}>
          <h1 className="lumo__h1">
            {['Shape', 'ideas', 'in', 'light'].map((w, i) => (
              <span key={w} className="lumo__word" style={{ animationDelay: `${120 + i * 110}ms` }}>
                {w}&nbsp;
              </span>
            ))}
            <span className="lumo__word" style={{ animationDelay: '560ms' }}>
              —
            </span>
            <br />
            {['the', 'next', 'dimension', 'of', 'design'].map((w, i) => (
              <span key={w} className="lumo__word" style={{ animationDelay: `${680 + i * 110}ms` }}>
                {w === 'next' ? <em>next</em> : w}
                {i < 4 ? ' ' : ''}
              </span>
            ))}
          </h1>
          <form
            className="lumo__box"
            onSubmit={(e) => {
              e.preventDefault()
              generate()
            }}
          >
            <textarea
              aria-label={`Describe what ${brand} should make`}
              value={prompt}
              placeholder={hint ? `${hint}…` : `Ask ${brand} anything…`}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  generate()
                }
              }}
            />
            <div className="lumo__chips">
              {['Image', 'Loop', '3D scene'].map((m) => (
                <button key={m} type="button" className="lumo__chip" aria-pressed={mode === m} onClick={() => setMode(m)}>
                  {m}
                </button>
              ))}
              <button type="submit" className="lumo__send" aria-label="Generate" disabled={busy}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3 9h12M10 4l5 5-5 5" />
                </svg>
              </button>
            </div>
            {results && (
              <div className="lumo__results" aria-live="polite" aria-busy={busy}>
                {results.map((src, k) => (
                  <div key={k} className="lumo__result">
                    {src ? <img src={src} alt={`Generated ${mode.toLowerCase()} option ${k + 1}`} style={{ animationDelay: `${k * 140}ms` }} /> : <div className="lumo__shimmer" />}
                  </div>
                ))}
              </div>
            )}
          </form>
          <p className="lumo__small" style={{ marginTop: 14 }}>
            {brand} can make mistakes. It learns from every fix you make.
          </p>
        </div>
      </header>

      {/* statement */}
      <section className="lumo__section" style={{ paddingTop: 140, paddingBottom: 140 }}>
        <div className="lumo__wrap">
          <p ref={statement} className="lumo__statement">
            {statementText.split(' ').map((w, i) => (
              <span key={i} ref={(el) => (words.current[i] = el)}>
                {w}{' '}
              </span>
            ))}
          </p>
        </div>
      </section>

      {/* gallery */}
      <section className="lumo__section" id={`lumo-${uid}-gallery`} style={{ paddingTop: 40 }}>
        <div className="lumo__wrap">
          <div className="lumo__eyebrow">Made with {brand}</div>
          <h2 className="lumo__h2">Start from a look you love</h2>
          <p className="lumo__lead">Styles for launches, shops and dashboards, tuned by people who make them for a living. Pick one and make it yours.</p>
          <div ref={gallery} className="lumo__gallery">
            {columns.map((col, c) => (
              <div key={c} ref={(el) => (cols.current[c] = el)} className="lumo__col" style={{ marginTop: c === 1 ? 60 : 0 }}>
                {col.map((item, k) => {
                  const ci = cardIndex++
                  return (
                    <div key={k} ref={(el) => (cards.current[ci] = el)} className="lumo__card" style={{ aspectRatio: (c + k) % 2 ? '4 / 5' : '1' }}>
                      <img src={item.src} alt={item.alt || item.title || ''} loading="lazy" draggable={false} />
                      {item.title && <span>{item.title}</span>}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* steps */}
      <section className="lumo__section" id={`lumo-${uid}-features`}>
        <div className="lumo__wrap">
          <div className="lumo__eyebrow">How it works</div>
          <h2 className="lumo__h2">From a sentence to a finished scene in four steps</h2>
          <div ref={rail} className="lumo__rail" onPointerDown={onRailDown} onPointerMove={onRailMove} onPointerUp={onRailUp} onPointerCancel={onRailUp} role="list">
            {STEPS.map((s, i) => (
              <article key={s.title} className="lumo__step" role="listitem">
                <div className="lumo__small" style={{ fontFamily: 'ui-monospace, Menlo, monospace', marginBottom: 14 }}>
                  0{i + 1}
                </div>
                <h3>{s.title}</h3>
                <p>{s.body.replace('Lumo', brand)}</p>
                <StepIcon kind={s.icon} accent={accent} />
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* benchmarks */}
      <section className="lumo__section" style={{ paddingTop: 40 }}>
        <div className="lumo__wrap" ref={bench}>
          <div className="lumo__eyebrow">Benchmarks</div>
          <h2 className="lumo__h2">Faster, sharper, more consistent</h2>
          <p className="lumo__lead">Scored in blind tests by working designers, against three leading AI studios, across a thousand briefs.</p>
          <div className="lumo__bench">
            {BENCH.map((b) => (
              <div key={b.name} className="lumo__benchCard">
                <div style={{ fontWeight: 700, fontSize: 17 }}>{b.name}</div>
                {b.rows.map(([n, v]) => {
                  const ours = n === 'Lumo'
                  return (
                    <div key={n} className="lumo__row">
                      <div className="lumo__rowHead">
                        <span style={{ fontWeight: ours ? 700 : 500, opacity: ours ? 1 : 0.7 }}>{ours ? brand : n}</span>
                        <span style={{ fontWeight: ours ? 700 : 500 }}>{(v * count).toFixed(1)}</span>
                      </div>
                      <div className="lumo__bar">
                        <i style={{ width: benchOn ? `${v}%` : '0%', background: ours ? `linear-gradient(90deg, ${accent}, #ff8fb3)` : 'currentColor', opacity: ours ? 1 : 0.28 }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* testimonials */}
      <section className="lumo__section" style={{ paddingTop: 40 }} onMouseEnter={() => setHold(true)} onMouseLeave={() => setHold(false)}>
        <div className="lumo__wrap">
          <div className="lumo__eyebrow">Stories</div>
          <h2 className="lumo__h2" style={{ marginBottom: 34 }}>
            Loved by teams who ship
          </h2>
          <div className="lumo__quoteCard" aria-roledescription="slide" aria-label={`${who + 1} of ${PEOPLE.length}`} key={who} style={{ animation: 'lu-blur-in .6s cubic-bezier(.2,.8,.2,1)' }}>
            <div>
              <span className="lumo__chip" style={{ cursor: 'default' }}>
                {person.kind}
              </span>
              <h3 style={{ fontSize: 34, margin: '16px 0 0', letterSpacing: '-.02em' }}>{person.org}</h3>
              <p className="lumo__quote">“{person.quote.replace('Lumo', brand)}”</p>
              <div style={{ fontWeight: 700 }}>{person.name}</div>
              <div className="lumo__small">{person.role}</div>
            </div>
            <div>
              <div className="lumo__avatar" style={{ background: `linear-gradient(160deg, ${hue}, #141633)` }} aria-hidden="true">
                {person.name
                  .split(' ')
                  .map((p) => p[0])
                  .join('')}
              </div>
              <div className="lumo__small" style={{ margin: '22px 0 8px', letterSpacing: '.1em', textTransform: 'uppercase' }}>
                With {brand}
              </div>
              {person.stats.map(([k, v]) => (
                <div key={k} className="lumo__stat">
                  <span style={{ opacity: 0.7 }}>{k}</span>
                  <b>{v}</b>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 22 }}>
            <div className="lumo__dots">
              {PEOPLE.map((p, i) => (
                <button key={p.org} type="button" className="lumo__dot" aria-label={`Story ${i + 1}: ${p.org}`} aria-current={i === who ? 'true' : 'false'} onClick={() => setWho(i)} />
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="lumo__round" aria-label="Previous story" onClick={() => setWho((who + PEOPLE.length - 1) % PEOPLE.length)}>
                <Chevron dir={-1} />
              </button>
              <button type="button" className="lumo__round" aria-label="Next story" onClick={() => setWho((who + 1) % PEOPLE.length)}>
                <Chevron dir={1} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* pricing */}
      <section className="lumo__section" id={`lumo-${uid}-pricing`} style={{ paddingTop: 40 }}>
        <div className="lumo__wrap">
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
            <div>
              <div className="lumo__eyebrow">Pricing</div>
              <h2 className="lumo__h2" style={{ marginBottom: 0 }}>
                Simple plans, no surprises
              </h2>
            </div>
            <div className="lumo__toggle" role="group" aria-label="Billing period">
              <button type="button" aria-pressed={!yearly} onClick={() => setYearly(false)}>
                Monthly
              </button>
              <button type="button" aria-pressed={yearly} onClick={() => setYearly(true)}>
                Yearly <span style={{ color: accent, marginLeft: 4 }}>-20%</span>
              </button>
            </div>
          </div>
          <div className="lumo__plans">
            {PLANS.map((p) => (
              <div key={p.name} className="lumo__plan" data-featured={p.featured ? '' : undefined}>
                {p.featured && (
                  <span className="lumo__chip" style={{ position: 'absolute', top: 22, right: 22, background: accent, color: '#fff', cursor: 'default', fontSize: 12 }}>
                    Most popular
                  </span>
                )}
                <div style={{ fontWeight: 700, fontSize: 18 }}>{p.name}</div>
                <div className="lumo__small" style={{ marginTop: 6 }}>
                  {p.note}
                </div>
                <div className="lumo__price">
                  {p.price == null ? 'Custom' : `$${yearly ? Math.round(p.price * 0.8) : p.price}`}
                  {p.price != null && <span style={{ fontSize: 15, fontWeight: 500, opacity: 0.6 }}>/mo</span>}
                </div>
                <div className="lumo__small">{p.price == null ? 'Volume pricing for your team' : yearly ? `$${Math.round(p.price * 0.8 * 12)} billed yearly` : 'Billed monthly, cancel any time'}</div>
                <ul>
                  {p.features.map((f) => (
                    <li key={f}>
                      <Check accent={accent} />
                      {f}
                    </li>
                  ))}
                </ul>
                <button type="button" className="lumo__cta">
                  {p.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* faq */}
      <section className="lumo__section" id={`lumo-${uid}-faq`} style={{ paddingTop: 40 }}>
        <div className="lumo__wrap lumo__faq">
          <div>
            <div className="lumo__eyebrow">FAQ</div>
            <h2 className="lumo__h2">Questions, answered</h2>
            <p className="lumo__lead">Something else on your mind? Our team replies within a day.</p>
          </div>
          <div>
            {FAQ.map(([q, a], i) => (
              <div key={q} className="lumo__q" data-open={open === i ? '' : undefined}>
                <button type="button" aria-expanded={open === i} aria-controls={`lumo-${uid}-a${i}`} onClick={() => setOpen(open === i ? -1 : i)}>
                  {q.replace('Lumo', brand)}
                  <Plus />
                </button>
                <div className="lumo__a" id={`lumo-${uid}-a${i}`} role="region">
                  <div>
                    <p>{a}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* waitlist */}
      <section className="lumo__section" style={{ paddingTop: 30, paddingBottom: 30 }}>
        <div className="lumo__wrap">
          <div className="lumo__join">
            <div style={{ position: 'absolute', inset: 0, opacity: 0.55 }}>
              <Glow accent={accent} theme={theme} />
            </div>
            <div style={{ position: 'relative' }}>
              <div className="lumo__eyebrow">Early access</div>
              <h2 className="lumo__h2" style={{ textAlign: 'center', maxWidth: 640, marginLeft: 'auto', marginRight: 'auto' }}>
                Be first to make something new
              </h2>
              <p className="lumo__lead" style={{ margin: '0 auto' }}>
                We ship new tools every week. Join the waitlist and help shape what comes next.
              </p>
              {joined ? (
                <p role="status" style={{ marginTop: 26, fontWeight: 600 }}>
                  You’re on the list. We’ll be in touch soon.
                </p>
              ) : (
                <form
                  className="lumo__form"
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (/\S+@\S+\.\S+/.test(email)) setJoined(true)
                  }}
                >
                  <input type="email" required placeholder="you@studio.com" aria-label="Email address" value={email} onChange={(e) => setEmail(e.target.value)} />
                  <button type="submit" className="lumo__cta" style={{ background: accent, color: '#fff', padding: '14px 22px', marginTop: 0 }}>
                    Join waitlist
                  </button>
                </form>
              )}
              <p className="lumo__small" style={{ marginTop: 16 }}>
                No spam. Product news only, and you can leave any time.
              </p>
            </div>
          </div>

          <footer className="lumo__foot">
            <div>
              <div className="lumo__logo">
                <Logo accent={accent} />
                {brand.toUpperCase()}
              </div>
              <p className="lumo__small" style={{ marginTop: 14, maxWidth: 240 }}>
                The AI studio for light, motion and 3D.
              </p>
            </div>
            {[
              ['Product', ['Features', 'Pricing', 'Changelog', 'Roadmap']],
              ['Company', ['About', 'Journal', 'Careers', 'Press']],
              ['Help', ['Docs', 'Guides', 'Community', 'Status']],
            ].map(([h, ls]) => (
              <div key={h}>
                <b>{h}</b>
                {ls.map((l) => (
                  <a key={l} href="#" onClick={(e) => e.preventDefault()}>
                    {l}
                  </a>
                ))}
              </div>
            ))}
          </footer>
          <p className="lumo__small" style={{ paddingBottom: 30 }}>
            © {new Date().getFullYear()} {brand}. A demo page: the product, people and figures are made up.
          </p>
        </div>
      </section>
    </div>
  )
}
