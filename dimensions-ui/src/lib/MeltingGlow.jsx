'use client'

import { useEffect, useRef } from 'react'

// Soft blobs of colour drifting on slow looping paths and melting into one
// another, like light through frosted glass. They are drawn small on a canvas
// and smeared by a heavy CSS blur, so the effect is cheap however large it is.
// The blobs lean toward the pointer and breathe in size; a fine film grain can
// sit on top to stop the gradients banding. Anything you pass as children is
// laid over the glow, centred.

const PALETTES = {
  dusk: ['#7c5cff', '#3a2bff', '#ff6a9b', '#000000', '#0b0a3a'],
  ocean: ['#28c2ff', '#0b5cff', '#00e0b8', '#001426', '#06305c'],
  ember: ['#ff7a2f', '#ff2d55', '#ffc24a', '#1a0505', '#4a0f12'],
  aurora: ['#3dffb4', '#2f8cff', '#b65cff', '#02101a', '#0a2a3a'],
  mono: ['#ffffff', '#9aa0aa', '#55595f', '#0c0d10', '#25272c'],
}

// a fine noise tile, as a data URI, for the grain
const GRAIN = `url("data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch"/></filter><rect width="160" height="160" filter="url(#n)" opacity=".55"/></svg>')}")`

export default function MeltingGlow({ palette = 'dusk', speed = 1, blur = 64, size = 1, follow = 0.4, grain = true, background, children, style }) {
  const canvas = useRef(null)
  const box = useRef(null)
  const pointer = useRef({ x: 0.5, y: 0.45, tx: 0.5, ty: 0.45 })
  const opts = useRef({ palette, speed, size, follow })
  opts.current = { palette, speed, size, follow }

  useEffect(() => {
    const c = canvas.current
    const g = c.getContext('2d')
    let raf = 0
    let visible = true
    let t = 0
    let last = performance.now()
    const blobs = [
      { r: 0.36, ax: 0.32, ay: 0.18, fx: 0.11, fy: 0.17, p: 0, pull: 1 },
      { r: 0.3, ax: 0.28, ay: 0.22, fx: 0.07, fy: 0.13, p: 2, pull: 0.6 },
      { r: 0.22, ax: 0.36, ay: 0.24, fx: 0.13, fy: 0.08, p: 1, pull: 0.8 },
      { r: 0.34, ax: 0.3, ay: 0.16, fx: 0.09, fy: 0.12, p: 4, pull: -0.4 },
      { r: 0.44, ax: 0.18, ay: 0.12, fx: 0.05, fy: 0.07, p: 3, pull: 0.2 },
    ]
    const draw = (now) => {
      raf = 0
      const o = opts.current
      const colors = PALETTES[o.palette] || PALETTES.dusk
      t += Math.min(0.05, (now - last) / 1000) * o.speed
      last = now
      const P = pointer.current
      P.x += (P.tx - P.x) * 0.04
      P.y += (P.ty - P.y) * 0.04
      // drawn at a quarter size: the blur hides it, and it is four times cheaper
      const w = (c.width = Math.max(1, Math.round(c.clientWidth / 4)))
      const h = (c.height = Math.max(1, Math.round(c.clientHeight / 4)))
      g.fillStyle = colors[4]
      g.fillRect(0, 0, w, h)
      blobs.forEach((b, i) => {
        const lean = o.follow * b.pull
        const x = w * (0.5 + b.ax * Math.sin(t * b.fx * 6.28 + b.p) + (P.x - 0.5) * lean)
        const y = h * (0.45 + b.ay * Math.cos(t * b.fy * 6.28 + b.p * 1.3) + (P.y - 0.45) * lean)
        const r = Math.min(w, h) * b.r * o.size * (1 + 0.15 * Math.sin(t * 0.7 + b.p))
        const col = colors[i % 4]
        const grad = g.createRadialGradient(x, y, 0, x, y, r)
        grad.addColorStop(0, col)
        grad.addColorStop(1, `${col}00`)
        g.fillStyle = grad
        g.beginPath()
        g.ellipse(x, y, r * 1.35, r, Math.sin(t * 0.2 + b.p), 0, Math.PI * 2)
        g.fill()
      })
      if (visible && !document.hidden) raf = requestAnimationFrame(draw)
    }
    const wake = () => {
      if (!raf && visible && !document.hidden) {
        last = performance.now()
        raf = requestAnimationFrame(draw)
      }
    }
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting
      wake()
    })
    io.observe(c)
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce) opts.current.speed = 0
    document.addEventListener('visibilitychange', wake)
    wake()
    return () => (cancelAnimationFrame(raf), io.disconnect(), document.removeEventListener('visibilitychange', wake))
  }, [])

  const onMove = (e) => {
    const r = box.current.getBoundingClientRect()
    pointer.current.tx = (e.clientX - r.left) / r.width
    pointer.current.ty = (e.clientY - r.top) / r.height
  }
  const onLeave = () => {
    pointer.current.tx = 0.5
    pointer.current.ty = 0.45
  }

  const base = background || (PALETTES[palette] || PALETTES.dusk)[4]
  return (
    <div ref={box} onPointerMove={onMove} onPointerLeave={onLeave} style={{ position: 'relative', overflow: 'hidden', width: '100%', height: '100%', background: base, ...style }}>
      <canvas ref={canvas} aria-hidden="true" style={{ position: 'absolute', inset: '-12%', width: '124%', height: '124%', filter: `blur(${blur}px) saturate(1.25)` }} />
      {grain && <div aria-hidden="true" style={{ position: 'absolute', inset: 0, backgroundImage: GRAIN, opacity: 0.18, mixBlendMode: 'overlay', pointerEvents: 'none' }} />}
      {children && <div style={{ position: 'relative', zIndex: 1, height: '100%', display: 'grid', placeItems: 'center' }}>{children}</div>}
    </div>
  )
}
