import * as THREE from 'three'

// Procedural textures for the electric guitar: no image files.

function rng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const canvas = (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h })
const tex = (c, srgb = true) => {
  const t = new THREE.CanvasTexture(c)
  if (srgb) t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

// A sunburst over alder: the burst follows the body's own outline, dark at
// the edge through red and orange to an amber centre, with the wood's grain
// showing through the tint. `box` is the outline's bounds; the texture maps
// onto the extruded body's world-space UVs.
export function sunburstTexture(outline, box, colors) {
  const W = 1024
  const H = Math.round((W * (box.max.y - box.min.y)) / (box.max.x - box.min.x))
  const c = canvas(W, H)
  const g = c.getContext('2d')
  const px = (x) => ((x - box.min.x) / (box.max.x - box.min.x)) * W
  const py = (y) => H - ((y - box.min.y) / (box.max.y - box.min.y)) * H
  const cx = (box.min.x + box.max.x) / 2 - 0.01
  const cy = box.min.y + (box.max.y - box.min.y) * 0.36
  const path = (s) => {
    g.beginPath()
    outline.forEach((p, i) => {
      const x = px(cx + (p.x - cx) * s)
      const y = py(cy + (p.y - cy) * s)
      i ? g.lineTo(x, y) : g.moveTo(x, y)
    })
    g.closePath()
  }
  g.fillStyle = colors[0]
  g.fillRect(0, 0, W, H)
  const steps = [
    [0.9, colors[1], 34],
    [0.76, colors[2], 46],
    [0.6, colors[3], 60],
    [0.42, colors[4], 70],
  ]
  for (const [s, col, blur] of steps) {
    g.filter = `blur(${blur}px)`
    g.fillStyle = col
    path(s)
    g.fill()
  }
  g.filter = 'none'
  // alder grain: long, gently wandering lines up the body
  const r = rng(21)
  g.globalCompositeOperation = 'multiply'
  for (let i = 0; i < 160; i++) {
    const x0 = r() * W
    g.strokeStyle = `rgba(80,40,10,${0.04 + r() * 0.07})`
    g.lineWidth = 0.6 + r() * 2.4
    g.beginPath()
    for (let y = -10; y <= H + 10; y += 20) {
      const x = x0 + Math.sin(y / (140 + r() * 40) + i) * 9
      y < 0 ? g.moveTo(x, y) : g.lineTo(x, y)
    }
    g.stroke()
  }
  g.globalCompositeOperation = 'source-over'
  const t = tex(c)
  t.repeat.set(1 / (box.max.x - box.min.x), 1 / (box.max.y - box.min.y))
  t.offset.set(-box.min.x / (box.max.x - box.min.x), -box.min.y / (box.max.y - box.min.y))
  return t
}

// Wood with its grain running along v (the length of the neck).
function lengthGrain({ base, dark, lines, streaks, seed, w = 256, h = 1024, pores = 0 }) {
  const c = canvas(w, h)
  const g = c.getContext('2d')
  const r = rng(seed)
  g.fillStyle = base
  g.fillRect(0, 0, w, h)
  for (let i = 0; i < streaks; i++) {
    g.fillStyle = dark
    g.globalAlpha = 0.04 + r() * 0.12
    const x = r() * w
    g.fillRect(x, 0, 4 + r() * 26, h)
  }
  g.globalAlpha = 1
  for (let i = 0; i < lines; i++) {
    const x0 = r() * w
    g.strokeStyle = dark
    g.globalAlpha = 0.1 + r() * 0.25
    g.lineWidth = 0.5 + r() * 1.4
    g.beginPath()
    for (let y = 0; y <= h; y += 16) {
      const x = x0 + Math.sin(y / (90 + r() * 60) + i) * 2.5
      y ? g.lineTo(x, y) : g.moveTo(x, y)
    }
    g.stroke()
  }
  g.fillStyle = dark
  for (let i = 0; i < pores; i++) {
    g.globalAlpha = 0.25 + r() * 0.4
    g.fillRect(r() * w, r() * h, 1, 2 + r() * 6)
  }
  g.globalAlpha = 1
  const t = tex(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

// Rosewood: dark brown with darker and redder streaks, and open pores.
export const rosewoodTexture = () => lengthGrain({ base: '#4a2b1c', dark: '#1d0f08', lines: 120, streaks: 40, seed: 5, pores: 2500 })
// Maple: pale and close-grained under an amber satin lacquer.
export const mapleTexture = () => lengthGrain({ base: '#e5c38a', dark: '#b88a4c', lines: 70, streaks: 14, seed: 8 })

// Wound strings: the winding, as fine bands across the string (a bump map).
export function windingTexture() {
  const c = canvas(8, 256)
  const g = c.getContext('2d')
  for (let y = 0; y < 256; y++) {
    const v = 120 + 120 * Math.abs(Math.sin((y / 256) * Math.PI * 32))
    g.fillStyle = `rgb(${v},${v},${v})`
    g.fillRect(0, y, 8, 1)
  }
  const t = tex(c, false)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

// A knob's skirt: numbers 0 to 10 round it over 300°, and its top: the label.
export function knobSkirtTexture() {
  const c = canvas(1024, 64)
  const g = c.getContext('2d')
  g.fillStyle = '#f2efe6'
  g.fillRect(0, 0, 1024, 64)
  g.fillStyle = '#5a5751'
  g.font = '600 30px Arial, sans-serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  for (let k = 0; k <= 10; k++) {
    // u runs round the knob; 0 sits at -150°, 10 at +150°
    const a = (-150 + k * 30) / 360
    const x = ((0.25 - a + 1) % 1) * 1024
    g.save()
    g.translate(x, 32)
    g.fillText(String(k), 0, 0)
    g.restore()
  }
  return tex(c)
}
export function knobTopTexture(label) {
  const c = canvas(256, 256)
  const g = c.getContext('2d')
  g.fillStyle = '#f2efe6'
  g.fillRect(0, 0, 256, 256)
  g.fillStyle = '#6a665f'
  g.font = '700 30px Arial, sans-serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(label, 128, 128)
  // the pointer line
  g.fillRect(124, 18, 8, 46)
  return tex(c)
}
