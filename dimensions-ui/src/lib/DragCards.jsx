'use client'

import { useEffect, useRef, useState } from 'react'

// A row of cards you grab and throw sideways. Let go mid-swipe and the row
// keeps gliding, slowing with friction, then settles with a card's edge
// lined up (or wherever it stops, with snapping off). Pulling past either end
// stretches a little and springs back. Arrow buttons, the arrow keys and a
// progress bar go with it; on touch screens it scrolls natively. Each card
// carries an icon that lifts as the card comes to rest under the pointer.

const DEFAULT_CARDS = [
  { title: 'Describe', body: 'Say what you want in plain words: a scene, a product shot, a whole brand world.', icon: 'chat' },
  { title: 'Generate', body: 'Several directions are sketched at once, each lit and composed to finish.', icon: 'stack' },
  { title: 'Refine', body: 'Nudge light, colour and camera by talking to it, or drag the sliders.', icon: 'sliders' },
  { title: 'Ship', body: 'Export stills, loops or 3D scenes, or push straight into your project.', icon: 'plane' },
  { title: 'Share', body: 'Send a live link; comments land right on the frame they are about.', icon: 'chat' },
  { title: 'Repeat', body: 'Save the look as a style and every new piece starts from it.', icon: 'stack' },
]

function Icon({ kind, accent }) {
  const p = { width: 140, height: 120, viewBox: '0 0 150 130', 'aria-hidden': true, className: 'dc__icon' }
  const fill = 'rgba(255,255,255,.92)'
  const shade = 'rgba(255,255,255,.35)'
  if (kind === 'chat')
    return (
      <svg {...p}>
        <rect x="18" y="18" width="104" height="70" rx="18" fill={shade} />
        <rect x="28" y="28" width="104" height="70" rx="18" fill={fill} />
        <path d="M48 98 l-10 20 l26-20z" fill={fill} />
        <rect x="44" y="50" width="50" height="7" rx="3.5" fill={accent} />
        <rect x="44" y="66" width="32" height="7" rx="3.5" fill={shade} />
      </svg>
    )
  if (kind === 'stack')
    return (
      <svg {...p}>
        <rect x="44" y="20" width="70" height="86" rx="14" fill={shade} transform="rotate(10 79 63)" />
        <rect x="40" y="24" width="70" height="86" rx="14" fill={fill} />
        <circle cx="62" cy="54" r="11" fill={accent} />
        <path d="M46 98 l20-24 l14 14 l10-10 l16 20z" fill={accent} opacity=".55" />
      </svg>
    )
  if (kind === 'sliders')
    return (
      <svg {...p}>
        <rect x="24" y="20" width="102" height="92" rx="18" fill={fill} />
        {[38, 62, 86].map((y, i) => (
          <g key={y}>
            <rect x="40" y={y - 2} width="70" height="4" rx="2" fill="rgba(0,0,0,.12)" />
            <circle cx={[88, 56, 76][i]} cy={y} r="8" fill={i === 1 ? accent : '#1b1d2a'} />
          </g>
        ))}
      </svg>
    )
  return (
    <svg {...p}>
      <path d="M22 70 L128 24 L92 112 L74 80 Z" fill={fill} />
      <path d="M74 80 L128 24 L64 74 Z" fill={shade} />
      <path d="M74 80 L80 104 L92 112 Z" fill={accent} />
    </svg>
  )
}

const CSS = `
.dc{position:relative;width:100%;height:100%;display:flex;flex-direction:column;justify-content:center;gap:22px;overflow:hidden;font-family:"Segoe UI Variable Display","Segoe UI",system-ui,-apple-system,"Helvetica Neue",sans-serif}
.dc__track{display:flex;overflow-x:auto;scrollbar-width:none;padding:8px 6%;cursor:grab;touch-action:pan-x;outline:none}
.dc__track::-webkit-scrollbar{display:none}
.dc__track[data-drag]{cursor:grabbing}
.dc__track:focus-visible{box-shadow:inset 0 0 0 2px var(--dc-accent)}
.dc__card{flex:0 0 auto;border-radius:22px;padding:26px;display:flex;flex-direction:column;user-select:none;-webkit-user-select:none;transition:box-shadow .3s}
.dc__card h3{margin:0 0 10px;font-size:22px;font-weight:600;letter-spacing:-.01em}
.dc__card p{margin:0;font-size:15px;line-height:1.55;opacity:.62}
.dc__icon{margin-top:auto;align-self:center;transition:transform .5s cubic-bezier(.2,.8,.2,1)}
.dc__card:hover .dc__icon{transform:translateY(-8px) rotate(-4deg) scale(1.05)}
.dc__bar{height:3px;border-radius:2px;overflow:hidden;background:rgba(127,127,140,.22);flex:1}
.dc__bar i{display:block;height:100%;background:var(--dc-accent);border-radius:2px}
.dc__btn{width:42px;height:42px;border-radius:50%;border:none;display:grid;place-items:center;cursor:pointer;color:inherit;background:rgba(127,127,140,.16);transition:background .2s}
.dc__btn:hover{background:var(--dc-accent);color:#fff}
.dc__btn:disabled{opacity:.35;cursor:default;background:rgba(127,127,140,.16);color:inherit}
@media (prefers-reduced-motion:reduce){.dc__icon{transition:none}}
`

const clamp = (v, a, b) => Math.min(b, Math.max(a, v))

export default function DragCards({ cards = DEFAULT_CARDS, cardWidth = 320, gap = 16, friction = 0.94, snap = true, accent = '#7c5cff', theme = 'dark', style }) {
  const track = useRef(null)
  const [progress, setProgress] = useState(0)
  const [edges, setEdges] = useState([true, false])
  const dark = theme === 'dark'
  const opts = useRef({ friction, snap, cardWidth, gap })
  opts.current = { friction, snap, cardWidth, gap }

  useEffect(() => {
    const el = track.current
    let raf = 0
    let down = null
    let v = 0
    let stretch = 0
    const max = () => el.scrollWidth - el.clientWidth
    const report = () => {
      const m = max()
      setProgress(m > 0 ? el.scrollLeft / m : 0)
      setEdges([el.scrollLeft <= 1, el.scrollLeft >= m - 1])
    }
    const setStretch = (s) => {
      stretch = s
      el.firstChild.style.transform = s ? `translateX(${s}px)` : ''
    }
    // glide after a throw, then settle on the nearest card edge
    const glide = () => {
      raf = 0
      const o = opts.current
      if (stretch) {
        setStretch(Math.abs(stretch) < 0.5 ? 0 : stretch * 0.82)
        if (stretch) raf = requestAnimationFrame(glide)
        return
      }
      if (Math.abs(v) > 0.4) {
        el.scrollLeft -= v
        v *= o.friction
        if (el.scrollLeft <= 0 || el.scrollLeft >= max()) v = 0
        raf = requestAnimationFrame(glide)
      } else if (o.snap) {
        const step = o.cardWidth + o.gap
        el.scrollTo({ left: clamp(Math.round(el.scrollLeft / step) * step, 0, max()), behavior: 'smooth' })
      }
    }
    const onDown = (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return
      cancelAnimationFrame(raf)
      raf = 0
      down = { x: e.clientX, left: el.scrollLeft, last: e.clientX, t: performance.now() }
      v = 0
      el.setAttribute('data-drag', '')
      el.setPointerCapture(e.pointerId)
    }
    const onMove = (e) => {
      if (!down) return
      const target = down.left - (e.clientX - down.x)
      const m = max()
      // past either end the row stretches instead of scrolling
      if (target < 0) setStretch(-target * 0.35)
      else if (target > m) setStretch(-(target - m) * 0.35)
      else setStretch(0)
      el.scrollLeft = clamp(target, 0, m)
      const now = performance.now()
      const dt = Math.max(1, now - down.t)
      v = ((e.clientX - down.last) / dt) * 16
      down.last = e.clientX
      down.t = now
    }
    const onUp = () => {
      if (!down) return
      down = null
      el.removeAttribute('data-drag')
      if (!raf) raf = requestAnimationFrame(glide)
    }
    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onUp)
    el.addEventListener('scroll', report, { passive: true })
    report()
    return () => {
      cancelAnimationFrame(raf)
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onUp)
      el.removeEventListener('scroll', report)
    }
  }, [])

  const nudge = (dir) => track.current.scrollBy({ left: dir * (cardWidth + gap), behavior: 'smooth' })
  const onKey = (e) => {
    if (e.key === 'ArrowRight') nudge(1)
    else if (e.key === 'ArrowLeft') nudge(-1)
    else return
    e.preventDefault()
  }

  return (
    <div className="dc" style={{ background: dark ? '#05060c' : '#f4f4f8', color: dark ? '#eef0f6' : '#11131c', '--dc-accent': accent, ...style }}>
      <style>{CSS}</style>
      <div ref={track} className="dc__track" tabIndex={0} role="region" aria-roledescription="carousel" aria-label="Cards: drag sideways, or use the arrow keys" onKeyDown={onKey}>
        <div style={{ display: 'flex', gap, transition: 'transform 0s' }}>
          {cards.map((c, i) => (
            <article key={i} className="dc__card" style={{ width: cardWidth, minHeight: cardWidth * 1.02, background: dark ? '#0d0f1a' : '#ffffff', boxShadow: `inset 0 0 0 1px ${dark ? 'rgba(255,255,255,.08)' : 'rgba(17,19,28,.08)'}` }}>
              <div style={{ fontSize: 12, letterSpacing: '.18em', opacity: 0.55, marginBottom: 14 }}>{String(i + 1).padStart(2, '0')}</div>
              <h3>{c.title}</h3>
              <p>{c.body}</p>
              <Icon kind={c.icon || 'chat'} accent={accent} />
            </article>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '0 6%' }}>
        <div className="dc__bar" aria-hidden="true">
          <i style={{ width: `${Math.max(8, progress * 100)}%` }} />
        </div>
        <button type="button" className="dc__btn" aria-label="Previous cards" disabled={edges[0]} onClick={() => nudge(-1)}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M10 3L5 8l5 5" />
          </svg>
        </button>
        <button type="button" className="dc__btn" aria-label="Next cards" disabled={edges[1]} onClick={() => nudge(1)}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 3l5 5-5 5" />
          </svg>
        </button>
      </div>
    </div>
  )
}
