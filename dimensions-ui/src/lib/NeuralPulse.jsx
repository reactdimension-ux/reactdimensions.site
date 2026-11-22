import { useEffect, useRef } from 'react'

// A network of nodes with light running along the links, like signals passing
// through a model. Nodes brighten as a pulse reaches them, then fade. Drawn on a
// canvas, so it stays smooth with hundreds of pulses.
export default function NeuralPulse({
  layout = 'layers', // 'layers' (input to output, left to right) | 'web' (a loose mesh)
  layers = [4, 7, 7, 3],
  nodes = 26, // used by the web layout
  speed = 1,
  rate = 1, // how often new pulses start
  width = 560,
  height = 320,
  background = '#0f0f0f',
  lineColor = '#ffffff',
  pulseColor = '#d77757',
  nodeColor = '#e8e6e1',
}) {
  const canvas = useRef(null)

  useEffect(() => {
    const c = canvas.current
    if (!c) return
    const ctx = c.getContext('2d')
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    c.width = width * dpr
    c.height = height * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    // build the graph: points and directed links
    const pad = 34
    const pts = []
    const links = []
    if (layout === 'web') {
      // a jittered grid keeps nodes evenly spread
      const cols = Math.ceil(Math.sqrt((nodes * width) / height))
      const rows = Math.ceil(nodes / cols)
      for (let i = 0; i < nodes; i++) {
        const gx = i % cols
        const gy = Math.floor(i / cols)
        pts.push({ x: pad + ((gx + 0.5 + (Math.random() - 0.5) * 0.7) / cols) * (width - 2 * pad), y: pad + ((gy + 0.5 + (Math.random() - 0.5) * 0.7) / rows) * (height - 2 * pad), glow: 0 })
      }
      pts.forEach((p, i) => {
        const near = pts.map((q, j) => ({ j, d: Math.hypot(p.x - q.x, p.y - q.y) })).filter((o) => o.j !== i).sort((x, y) => x.d - y.d).slice(0, 3)
        near.forEach(({ j }) => !links.some((l) => (l.a === j && l.b === i) || (l.a === i && l.b === j)) && links.push({ a: i, b: j }))
      })
    } else {
      const start = []
      layers.forEach((n, li) => {
        start.push(pts.length)
        for (let k = 0; k < n; k++) pts.push({ x: pad + (li / (layers.length - 1)) * (width - 2 * pad), y: height / 2 + (k - (n - 1) / 2) * Math.min(38, (height - 2 * pad) / Math.max(1, n - 1)), glow: 0, layer: li })
      })
      layers.forEach((n, li) => {
        if (li === layers.length - 1) return
        for (let k = 0; k < n; k++) for (let m = 0; m < layers[li + 1]; m++) links.push({ a: start[li] + k, b: start[li + 1] + m })
      })
    }
    const out = pts.map(() => [])
    links.forEach((l, i) => {
      out[l.a].push(i)
      if (layout === 'web') out[l.b].push(i)
    })

    const pulses = []
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const fire = (from) => {
      const opts = out[from]
      if (!opts.length) return
      const li = opts[(Math.random() * opts.length) | 0]
      const l = links[li]
      pulses.push({ link: li, rev: layout === 'web' && l.b === from, t: 0, hops: 0 })
    }
    const sources = () => (layout === 'web' ? pts.map((_, i) => i) : pts.map((p, i) => (p.layer === 0 ? i : -1)).filter((i) => i >= 0))

    let last = performance.now()
    let spawn = 0
    let raf
    const draw = (now) => {
      const dt = Math.min((now - last) / 1000, 0.05) * speed
      last = now
      ctx.clearRect(0, 0, width, height)

      // links
      ctx.lineWidth = 1
      ctx.strokeStyle = lineColor
      ctx.globalAlpha = 0.08
      ctx.beginPath()
      for (const l of links) {
        ctx.moveTo(pts[l.a].x, pts[l.a].y)
        ctx.lineTo(pts[l.b].x, pts[l.b].y)
      }
      ctx.stroke()
      ctx.globalAlpha = 1

      if (!reduce) {
        spawn += dt * rate * 3.2
        while (spawn > 1) {
          spawn -= 1
          const src = sources()
          fire(src[(Math.random() * src.length) | 0])
        }
      }

      // pulses: a bright head with a short fading tail
      for (let i = pulses.length - 1; i >= 0; i--) {
        const p = pulses[i]
        const l = links[p.link]
        const A = pts[p.rev ? l.b : l.a]
        const B = pts[p.rev ? l.a : l.b]
        p.t += dt * 1.3
        const t = Math.min(p.t, 1)
        const x = A.x + (B.x - A.x) * t
        const y = A.y + (B.y - A.y) * t
        const tt = Math.max(0, t - 0.22)
        const g = ctx.createLinearGradient(A.x + (B.x - A.x) * tt, A.y + (B.y - A.y) * tt, x, y)
        g.addColorStop(0, `${pulseColor}00`)
        g.addColorStop(1, pulseColor)
        ctx.strokeStyle = g
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(A.x + (B.x - A.x) * tt, A.y + (B.y - A.y) * tt)
        ctx.lineTo(x, y)
        ctx.stroke()
        ctx.fillStyle = pulseColor
        ctx.beginPath()
        ctx.arc(x, y, 2.2, 0, Math.PI * 2)
        ctx.fill()
        if (p.t >= 1) {
          const to = p.rev ? l.a : l.b
          pts[to].glow = 1
          pulses.splice(i, 1)
          // sometimes carry on to the next node
          if (p.hops < 6 && Math.random() < (layout === 'web' ? 0.6 : 0.85)) {
            const before = pulses.length
            fire(to)
            if (pulses.length > before) pulses[pulses.length - 1].hops = p.hops + 1
          }
        }
      }

      // nodes, with a halo while lit
      for (const p of pts) {
        p.glow = Math.max(0, p.glow - dt * 1.6)
        if (p.glow > 0) {
          ctx.globalAlpha = p.glow * 0.35
          ctx.fillStyle = pulseColor
          ctx.beginPath()
          ctx.arc(p.x, p.y, 4 + p.glow * 9, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.globalAlpha = 0.55 + p.glow * 0.45
        ctx.fillStyle = p.glow > 0.3 ? pulseColor : nodeColor
        ctx.beginPath()
        ctx.arc(p.x, p.y, 3.4, 0, Math.PI * 2)
        ctx.fill()
        ctx.globalAlpha = 1
      }
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [layout, layers.join(','), nodes, speed, rate, width, height, lineColor, pulseColor, nodeColor])

  return (
    <div style={{ width: `min(${width}px, 100%)`, aspectRatio: `${width} / ${height}`, borderRadius: 14, background, overflow: 'hidden' }}>
      <canvas ref={canvas} role="img" aria-label="A network of nodes with signals passing between them" style={{ display: 'block', width: '100%', height: '100%' }} />
    </div>
  )
}
