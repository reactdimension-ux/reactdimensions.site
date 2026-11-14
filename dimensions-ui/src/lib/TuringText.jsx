import { useEffect, useRef } from 'react'

// Animal markings growing into the letters. This is a real reaction-diffusion
// simulation (the Gray-Scott model), the mechanism Alan Turing proposed for
// how spots and stripes form on skin: two chemicals spread through the
// tissue at different speeds while one feeds on the other. Where they react,
// the slower "activator" clumps into spots or runs into stripes all by
// itself, with a spacing set by the chemistry rather than drawn by anyone.
//
// The reaction is only tuned to sustain markings inside the letters; outside
// them the activator dies away, so a few seeds planted in the letters grow,
// divide and spread until they fill each shape. Click or drag to plant more.

// feed (F) and kill (k) rates for the classic Gray-Scott regimes
const PATTERNS = {
  spots: [0.0367, 0.0649], // leopard-like spots that divide as they spread
  stripes: [0.029, 0.057], // a labyrinth of zebra-like stripes
  coral: [0.0545, 0.062], // branching coral growth
  holes: [0.039, 0.058], // a mesh with round holes, like a giraffe's net
}
const OUT = [0.03, 0.075] // outside the letters: nothing can survive
const DU = 1
const DV = 0.5

const hex = (h) => {
  const n = parseInt(h.replace('#', '').padEnd(6, '0').slice(0, 6), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export default function TuringText({
  text = 'WILD',
  pattern = 'spots',
  speed = 1,
  scale = 3,
  background = '#efe7da',
  skin = '#e3b260',
  marking = '#2b1b12',
  style,
}) {
  const box = useRef()
  const cv = useRef()

  useEffect(() => {
    const el = box.current
    const c = cv.current
    const g = c.getContext('2d')
    const W = el.clientWidth
    const H = el.clientHeight
    // every screen pixel is shaded each frame, so cap the density
    const dpr = Math.min(1.5, window.devicePixelRatio || 1)
    c.width = Math.round(W * dpr)
    c.height = Math.round(H * dpr)
    const CS = Math.max(1.5, scale) // css pixels per simulation cell
    const cw = Math.max(8, Math.ceil(W / CS))
    const ch = Math.max(8, Math.ceil(H / CS))

    // the letter mask, at simulation resolution
    const m = document.createElement('canvas')
    m.width = cw
    m.height = ch
    const mg = m.getContext('2d', { willReadFrequently: true })
    const font = (s) => `900 ${s}px 'Arial Black', 'Helvetica Neue', Impact, sans-serif`
    let size = ch * 0.62
    mg.font = font(size)
    const tw = mg.measureText(text).width
    if (tw > cw * 0.86) size *= (cw * 0.86) / tw
    mg.font = font(size)
    mg.textAlign = 'center'
    mg.textBaseline = 'middle'
    mg.fillText(text, cw / 2, ch / 2 + size * 0.04)
    const md = mg.getImageData(0, 0, cw, ch).data
    const N = cw * ch
    const mask = new Float32Array(N)
    for (let i = 0; i < N; i++) mask[i] = md[i * 4 + 3] / 255

    // feed and kill rates per cell: the chosen pattern inside the letters,
    // a hostile chemistry outside, blended across the antialiased edge
    const [Fp, Kp] = PATTERNS[pattern] || PATTERNS.spots
    const F = new Float32Array(N)
    const K = new Float32Array(N)
    for (let i = 0; i < N; i++) {
      const a = mask[i]
      F[i] = OUT[0] + (Fp - OUT[0]) * a
      K[i] = OUT[1] + (Kp - OUT[1]) * a
    }

    // U: the substrate, everywhere at 1; V: the activator, only in seeds
    let U = new Float32Array(N).fill(1)
    let V = new Float32Array(N)
    let U2 = new Float32Array(N)
    let V2 = new Float32Array(N)
    const seed = (sx, sy, r) => {
      for (let y = Math.max(1, Math.floor(sy - r)); y < Math.min(ch - 1, sy + r); y++)
        for (let x = Math.max(1, Math.floor(sx - r)); x < Math.min(cw - 1, sx + r); x++) {
          if (Math.hypot(x - sx, y - sy) > r) continue
          const i = y * cw + x
          U[i] = 0.5
          V[i] = 0.25 + Math.random() * 0.02
        }
    }
    // seeds scattered through the letters, about one per 250 cells: sparser
    // or smaller and the spot and coral regimes never take hold
    const inside = []
    for (let i = 0; i < N; i++) if (mask[i] > 0.9) inside.push(i)
    const nSeeds = Math.max(4, Math.round(inside.length / 250))
    for (let s = 0; s < nSeeds && inside.length; s++) {
      const i = inside[(Math.random() * inside.length) | 0]
      seed(i % cw, (i / cw) | 0, 4)
    }

    const step = () => {
      for (let y = 1; y < ch - 1; y++) {
        for (let x = 1; x < cw - 1; x++) {
          const i = y * cw + x
          const u = U[i]
          const v = V[i]
          // 9-point Laplacian: neighbours 0.2, diagonals 0.05
          const lu = 0.2 * (U[i - 1] + U[i + 1] + U[i - cw] + U[i + cw]) + 0.05 * (U[i - cw - 1] + U[i - cw + 1] + U[i + cw - 1] + U[i + cw + 1]) - u
          const lv = 0.2 * (V[i - 1] + V[i + 1] + V[i - cw] + V[i + cw]) + 0.05 * (V[i - cw - 1] + V[i - cw + 1] + V[i + cw - 1] + V[i + cw + 1]) - v
          const uvv = u * v * v
          U2[i] = u + DU * lu - uvv + F[i] * (1 - u)
          V2[i] = v + DV * lv + uvv - (F[i] + K[i]) * v
        }
      }
      let t = U
      U = U2
      U2 = t
      t = V
      V = V2
      V2 = t
    }

    // drawing, at full screen resolution so every edge is crisp. Stretching
    // the coarse simulation grid up to the screen made the letters and the
    // spots soft and blocky. Instead the letters are drawn again at full
    // resolution for their outline, and each pixel samples the activator
    // between grid cells (bilinear) and cuts it at a narrow threshold, which
    // traces the spots' outlines smoothly at any size.
    const PW = c.width
    const PH = c.height
    const px = CS * dpr // screen pixels per cell
    const full = document.createElement('canvas')
    full.width = PW
    full.height = PH
    const fg = full.getContext('2d', { willReadFrequently: true })
    fg.font = font(size * px)
    fg.textAlign = 'center'
    fg.textBaseline = 'middle'
    fg.fillText(text, (cw / 2) * px, (ch / 2 + size * 0.04) * px)
    const fd = fg.getImageData(0, 0, PW, PH).data
    const A = new Float32Array(PW * PH)
    for (let i = 0; i < PW * PH; i++) A[i] = fd[i * 4 + 3] / 255
    const img = g.createImageData(PW, PH)
    const d = img.data
    const bg = hex(background)
    const sk = hex(skin)
    const mk = hex(marking)
    // paint the whole picture once: background, with the letters in skin
    // colour. Only pixels inside the letters can change after that, so for
    // each of those, work out up front where it falls between grid cells
    // and what its unmarked colour is; a frame then touches only them.
    let n = 0
    for (let p = 0; p < PW * PH; p++) {
      const a = A[p]
      for (let k = 0; k < 3; k++) d[p * 4 + k] = bg[k] + (sk[k] - bg[k]) * a
      d[p * 4 + 3] = 255
      if (a > 0) n++
    }
    const P = new Int32Array(n) // byte offset in the image
    const I = new Int32Array(n) // grid cell to the upper left
    const FX = new Float32Array(n)
    const FY = new Float32Array(n)
    const AM = new Float32Array(n) // letter coverage (antialiased edge)
    const BR = new Float32Array(n)
    const BG = new Float32Array(n)
    const BB = new Float32Array(n)
    for (let p = 0, j = 0; p < PW * PH; p++) {
      if (!(A[p] > 0)) continue
      const gx = Math.min(cw - 1.001, Math.max(0, (p % PW) / px - 0.5))
      const gy = Math.min(ch - 1.001, Math.max(0, ((p / PW) | 0) / px - 0.5))
      P[j] = p * 4
      I[j] = (gy | 0) * cw + (gx | 0)
      FX[j] = gx - (gx | 0)
      FY[j] = gy - (gy | 0)
      AM[j] = A[p]
      BR[j] = d[p * 4]
      BG[j] = d[p * 4 + 1]
      BB[j] = d[p * 4 + 2]
      j++
    }
    const [mr, mgr, mb] = mk
    const LO = 0.17
    const INV = 1 / 0.06 // the outline is cut between V = 0.17 and 0.23
    const draw = () => {
      for (let j = 0; j < n; j++) {
        const i = I[j]
        const fx = FX[j]
        const top = V[i] + (V[i + 1] - V[i]) * fx
        const bot = V[i + cw] + (V[i + cw + 1] - V[i + cw]) * fx
        let s = (top + (bot - top) * FY[j] - LO) * INV
        s = s < 0 ? 0 : s > 1 ? 1 : s
        const t = s * s * (3 - 2 * s) * AM[j]
        const o = P[j]
        const r = BR[j]
        const gg = BG[j]
        const b = BB[j]
        d[o] = r + (mr - r) * t
        d[o + 1] = gg + (mgr - gg) * t
        d[o + 2] = b + (mb - b) * t
      }
      g.putImageData(img, 0, 0)
    }

    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    let visible = true
    const frame = () => {
      if (visible) {
        const iters = Math.max(1, Math.round(8 * speed))
        for (let s = 0; s < iters; s++) step()
        draw()
      }
      raf = requestAnimationFrame(frame)
    }
    if (reduce) {
      // no growth animation: work out the grown pattern up front
      for (let s = 0; s < 2600; s++) step()
      draw()
    } else raf = requestAnimationFrame(frame)

    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting))
    io.observe(el)

    // click or drag to plant new seeds
    let down = false
    const plant = (e) => {
      const r = el.getBoundingClientRect()
      seed((e.clientX - r.left) / CS, (e.clientY - r.top) / CS, 4)
      if (reduce) {
        for (let s = 0; s < 1200; s++) step()
        draw()
      }
    }
    const onDown = (e) => {
      down = true
      el.setPointerCapture?.(e.pointerId)
      plant(e)
    }
    const onMove = (e) => down && !reduce && plant(e)
    const onUp = () => (down = false)
    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onUp)
    return () => {
      cancelAnimationFrame(raf)
      io.disconnect()
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onUp)
    }
  }, [text, pattern, speed, scale, background, skin, marking])

  return (
    <div ref={box} role="img" aria-label={text} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background, cursor: 'crosshair', touchAction: 'none', ...style }}>
      <canvas ref={cv} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
    </div>
  )
}
