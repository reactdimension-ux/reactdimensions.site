'use client'

import { useEffect, useMemo, useRef } from 'react'

// A wall of pictures you scroll through with a sense of depth. Its columns
// drift at different speeds as you scroll, and each card is sharp only near
// the middle of the view: above and below, it softens, dims and shrinks a
// touch, as if passing out of a lens's focus. Pass `images` ({ src, title })
// for your own pictures; by default it draws its own glowing artwork.

const clamp = (v, a, b) => Math.min(b, Math.max(a, v))

// abstract glow pieces drawn as SVG (ribbons, rings, ripples, arches, grass)
function glowArt(seed, a, b) {
  const r = (n) => {
    const x = Math.sin(seed * 9.13 + n * 3.71) * 43758.5453
    return x - Math.floor(x)
  }
  const w = 'rgba(255,255,255,'
  let body = ''
  const kind = seed % 5
  if (kind === 0) for (let i = 0; i < 9; i++) body += `<path d="M-20 ${250 + i * 14} C 120 ${120 + r(i) * 80 + i * 10}, 260 ${330 - i * 6}, 420 ${150 + i * 18}" stroke="${w}${0.12 + i * 0.07})" stroke-width="${3 + i}" fill="none"/>`
  else if (kind === 1) for (let i = 0; i < 7; i++) body += `<ellipse cx="200" cy="${230 + i * 6}" rx="${70 + i * 26}" ry="${18 + i * 7}" stroke="${w}${0.75 - i * 0.09})" stroke-width="${2 + (i % 3)}" fill="none"/>`
  else if (kind === 2) {
    body += `<circle cx="${150 + r(1) * 100}" cy="150" r="70" fill="${w}0.85)"/>`
    for (let i = 0; i < 6; i++) body += `<path d="M0 ${300 + i * 16} Q 200 ${250 + i * 12} 400 ${300 + i * 16}" stroke="${w}${0.6 - i * 0.08})" stroke-width="3" fill="none"/>`
  } else if (kind === 3) for (let i = 0; i < 6; i++) body += `<path d="M${60 + i * 14} 400 A ${140 - i * 14} ${170 - i * 16} 0 0 1 ${340 - i * 14} 400" stroke="${w}${0.25 + i * 0.12})" stroke-width="${4 + i * 2}" fill="none"/>`
  else
    for (let i = 0; i < 14; i++) {
      const x = 40 + i * 24 + r(i) * 10
      body += `<path d="M${x} 400 Q ${x + (r(i + 4) - 0.5) * 60} ${260 - r(i + 7) * 80} ${x + (r(i + 2) - 0.5) * 30} ${120 + r(i + 9) * 90}" stroke="${w}${0.3 + r(i) * 0.5})" stroke-width="2" fill="none"/>`
    }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><defs><radialGradient id="g" cx="${0.3 + r(5) * 0.4}" cy="${0.3 + r(6) * 0.3}" r="0.9"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></radialGradient><filter id="s"><feGaussianBlur stdDeviation="1.2"/></filter></defs><rect width="400" height="400" fill="url(#g)"/><g filter="url(#s)">${body}</g></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

const NAMES = ['Ribbon', 'Halo', 'Dawn', 'Arches', 'Meadow']

export default function DepthGallery({ images, columns = 3, drift = 1, focus = 1, gap = 22, radius = 18, captions = true, background = '#05060c', color = '#eef0f6', style }) {
  const scroller = useRef(null)
  const cols = useRef([])
  const cards = useRef([])
  const opts = useRef({ drift, focus })
  opts.current = { drift, focus }
  const n = clamp(Math.round(columns), 2, 4)

  const art = useMemo(() => {
    if (images && images.length) return images
    return Array.from({ length: 16 }, (_, i) => ({ src: glowArt(i + 1, i % 3 === 1 ? '#ff8fb3' : '#8f86ff', i % 2 ? '#0a0b2e' : '#2a1f8f'), title: NAMES[i % 5] }))
  }, [images])
  const grid = useMemo(() => Array.from({ length: n }, (_, c) => art.filter((_, i) => i % n === c)), [art, n])
  // each column has its own speed; alternate directions so they slide past each other
  const speeds = [-120, 80, -50, 110].slice(0, n)

  useEffect(() => {
    const el = scroller.current
    let raf = 0
    const update = () => {
      raf = 0
      const o = opts.current
      const view = el.getBoundingClientRect()
      const vh = view.height
      const mid = view.top + vh / 2
      const prog = el.scrollTop / Math.max(1, el.scrollHeight - vh) - 0.5
      cols.current.forEach((c, i) => c && (c.style.transform = `translateY(${(prog * speeds[i] * 2 * o.drift).toFixed(1)}px)`))
      cards.current.forEach((c) => {
        if (!c) return
        const r = c.getBoundingClientRect()
        const d = Math.abs(r.top + r.height / 2 - mid) / vh
        const off = clamp(d - 0.22, 0, 0.6)
        c.style.filter = `blur(${clamp(off * 18 * o.focus, 0, 10).toFixed(1)}px) brightness(${(1.04 - off * 0.9 * o.focus).toFixed(2)})`
        c.style.transform = `scale(${(1 - off * 0.14 * o.focus).toFixed(3)})`
      })
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    const ro = new ResizeObserver(onScroll)
    ro.observe(el)
    update()
    return () => (el.removeEventListener('scroll', onScroll), ro.disconnect(), cancelAnimationFrame(raf))
  }, [n]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // settings changed: redraw once at the current scroll
    scroller.current?.dispatchEvent(new Event('scroll'))
  }, [drift, focus])

  let k = 0
  return (
    <div ref={scroller} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'auto', overflowX: 'hidden', background, color, ...style }}>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${n}, 1fr)`, gap, padding: `140px ${gap * 1.5}px 180px`, maxWidth: 1180, margin: '0 auto' }}>
        {grid.map((col, c) => (
          <div key={c} ref={(el) => (cols.current[c] = el)} style={{ display: 'flex', flexDirection: 'column', gap, marginTop: c % 2 ? 70 : 0, willChange: 'transform' }}>
            {col.map((item, i) => {
              const idx = k++
              return (
                <figure
                  key={i}
                  ref={(el) => (cards.current[idx] = el)}
                  style={{ margin: 0, position: 'relative', borderRadius: radius, overflow: 'hidden', aspectRatio: (c + i) % 2 ? '4 / 5' : '1', boxShadow: '0 18px 50px rgba(0,0,0,.32)', willChange: 'filter, transform', transition: 'filter .08s linear' }}
                >
                  <img src={item.src} alt={item.alt || item.title || ''} loading="lazy" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  {captions && item.title && (
                    <figcaption style={{ position: 'absolute', left: 16, bottom: 14, fontWeight: 600, fontSize: 15, color: '#fff', textShadow: '0 2px 12px rgba(0,0,0,.6)', fontFamily: '"Segoe UI Variable Display", "Segoe UI", system-ui, -apple-system, "Helvetica Neue", sans-serif' }}>{item.title}</figcaption>
                  )}
                </figure>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
