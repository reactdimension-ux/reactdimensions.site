import * as THREE from 'three'

// A recordable compact disc, to the real dimensions (metres): 120 mm across,
// a 15 mm centre hole, 1.2 mm thick. The clear clamping hub runs out to the
// stacking ring; the reflective layer (and the printed label over it)
// covers the program area from 22 mm out to just inside the edge.
export const R = 0.06
export const HOLE = 0.0075
export const T = 0.0012
export const STACK_R = 0.0168 // the stacking ring on the data side
export const DATA_IN = 0.022 // the reflective layer starts here
export const DATA_OUT = 0.0588 // and ends here
export const LEAD_IN = 0.023 // where the recording starts (lead-in)
export const PROGRAM_OUT = 0.058 // where 80 minutes ends

function rng(seed) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const SERIF = "'Georgia', 'Times New Roman', 'Liberation Serif', serif"
const SANS = "'Helvetica Neue', Arial, 'Liberation Sans', sans-serif"

// Base colours of the printed top coat
export const FINISHES = {
  silver: { base: ['#efece9', '#e4e1e2', '#f3eee8'], ink: '#47464a', metal: 0.62, rough: 0.32 },
  white: { base: ['#fbfaf8', '#f4f3f1', '#fbfaf7'], ink: '#3a393c', metal: 0, rough: 0.55 },
  gold: { base: ['#efd9a4', '#e3c98d', '#f2deae'], ink: '#4a3b1d', metal: 0.75, rough: 0.3 },
}

// The printed label: a square canvas the size of the disc, only the ring
// between DATA_IN and the edge is used. px per metre = S / (2R).
export function labelTexture({ brand = 'RD', capacity = '700', finish = 'silver', seed = 7 }) {
  const S = 2048
  const c = document.createElement('canvas')
  c.width = c.height = S
  const g = c.getContext('2d')
  const F = FINISHES[finish] ?? FINISHES.silver
  const k = S / (2 * R)
  const cx = S / 2
  const cy = S / 2
  const r = rng(seed)

  // the lacquer: a soft pearly sweep, warm in one corner, cool in another,
  // as printed silver catches a room
  const lg = g.createLinearGradient(0, 0, S, S)
  lg.addColorStop(0, F.base[0])
  lg.addColorStop(0.5, F.base[1])
  lg.addColorStop(1, F.base[2])
  g.fillStyle = lg
  g.fillRect(0, 0, S, S)
  const warm = g.createRadialGradient(S * 0.78, S * 0.3, 0, S * 0.78, S * 0.3, S * 0.55)
  warm.addColorStop(0, finish === 'white' ? 'rgba(255,240,230,0.25)' : 'rgba(255,214,200,0.45)')
  warm.addColorStop(1, 'rgba(255,214,200,0)')
  g.fillStyle = warm
  g.fillRect(0, 0, S, S)
  const cool = g.createRadialGradient(S * 0.2, S * 0.85, 0, S * 0.2, S * 0.85, S * 0.5)
  cool.addColorStop(0, finish === 'white' ? 'rgba(225,232,245,0.25)' : 'rgba(210,220,236,0.5)')
  cool.addColorStop(1, 'rgba(210,220,236,0)')
  g.fillStyle = cool
  g.fillRect(0, 0, S, S)
  // print grain
  const img = g.getImageData(0, 0, S, S)
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (r() - 0.5) * 6
    img.data[i] += n
    img.data[i + 1] += n
    img.data[i + 2] += n
  }
  g.putImageData(img, 0, 0)

  // a fine inner rim where the print stops round the hub
  g.strokeStyle = 'rgba(60,58,62,0.55)'
  g.lineWidth = 0.0005 * k
  g.beginPath()
  g.arc(cx, cy, (DATA_IN + 0.0004) * k, 0, Math.PI * 2)
  g.stroke()

  const ink = F.ink
  // brand, top left of the hub
  g.fillStyle = ink
  g.textBaseline = 'alphabetic'
  g.font = `700 ${0.0072 * k}px ${SERIF}`
  g.textAlign = 'center'
  if ('letterSpacing' in g) g.letterSpacing = `${0.0011 * k}px`
  g.fillText(brand.toUpperCase().slice(0, 8), cx - 0.0395 * k, cy - 0.002 * k)
  if ('letterSpacing' in g) g.letterSpacing = '0px'

  // the format, big italic with a rose-to-gold ink
  g.font = `italic 400 ${0.0118 * k}px ${SERIF}`
  const fg = g.createLinearGradient(cx - 0.056 * k, cy, cx - 0.024 * k, cy + 0.012 * k)
  fg.addColorStop(0, '#c97b93')
  fg.addColorStop(0.5, '#e1a2b4')
  fg.addColorStop(1, '#d8b48c')
  g.fillStyle = fg
  g.fillText('CD-R', cx - 0.0395 * k, cy + 0.0125 * k)
  // a thin darker edge on the letters, as a second print pass
  g.lineWidth = 0.00012 * k
  g.strokeStyle = 'rgba(150,80,100,0.6)'
  g.strokeText('CD-R', cx - 0.0395 * k, cy + 0.0125 * k)

  // a "Recordable" badge of our own, top right
  const bx = cx + 0.0365 * k
  const by = cy - 0.012 * k
  g.strokeStyle = '#b8a6a8'
  g.lineWidth = 0.00035 * k
  const bw = 0.017 * k
  const bh = 0.0072 * k
  g.beginPath()
  g.roundRect?.(bx - bw / 2 - 0.004 * k, by - bh / 2, bw, bh, 0.0012 * k)
  if (!g.roundRect) g.rect(bx - bw / 2 - 0.004 * k, by - bh / 2, bw, bh)
  g.stroke()
  // a little disc glyph in the badge
  g.beginPath()
  g.arc(bx - bw / 2 + 0.0, by - 0.0003 * k, 0.0021 * k, 0, Math.PI * 2)
  g.stroke()
  g.beginPath()
  g.arc(bx - bw / 2 + 0.0, by - 0.0003 * k, 0.0006 * k, 0, Math.PI * 2)
  g.stroke()
  g.fillStyle = '#b39ea3'
  g.font = `600 ${0.0021 * k}px ${SANS}`
  g.textAlign = 'left'
  g.fillText('Recordable', bx - bw / 2 + 0.0031 * k, by + 0.0008 * k)
  g.font = `italic 700 ${0.0026 * k}px ${SANS}`
  g.fillStyle = '#c99aa9'
  g.fillText('80 MIN', bx + 0.0085 * k, by + 0.0009 * k)
  g.fillStyle = '#d8c3c8'
  g.fillRect(bx + 0.0085 * k, by + 0.0016 * k, 0.0098 * k, 0.00025 * k)
  g.fillRect(bx + 0.0085 * k, by + 0.0021 * k, 0.0098 * k, 0.00025 * k)

  // capacity, big italic serif with a small "MB"
  g.fillStyle = ink
  g.textAlign = 'right'
  g.font = `italic 700 ${0.0118 * k}px ${SERIF}`
  const mbW = 0.0088 * k
  g.fillText(String(capacity).slice(0, 4), cx + 0.0545 * k - mbW, cy + 0.0108 * k)
  g.font = `italic 700 ${0.0062 * k}px ${SERIF}`
  g.textAlign = 'left'
  g.fillText('MB', cx + 0.0545 * k - mbW + 0.0006 * k, cy + 0.0108 * k)

  // fine print round the bottom, set along the curve
  const arcText = (text, radius, centre, size, color) => {
    g.save()
    g.fillStyle = color
    g.font = `500 ${size}px ${SANS}`
    g.textAlign = 'center'
    const total = g.measureText(text).width
    let a = centre + total / 2 / radius
    for (const ch of text) {
      const w = g.measureText(ch).width
      a -= w / 2 / radius
      g.save()
      g.translate(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius)
      g.rotate(a - Math.PI / 2)
      g.fillText(ch, 0, 0)
      g.restore()
      a -= w / 2 / radius
    }
    g.restore()
  }
  arcText('1x – 52x  ·  80 min  ·  700 MB  ·  Data / Audio', 0.0528 * k, Math.PI / 2, 0.0016 * k, 'rgba(80,78,84,0.75)')

  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 16
  return t
}

// The clear hub, seen from either side: the moulded matrix number round the
// stacking ring, and a frosted band where the hub is clamped. Alpha only
// where there is something, so the clear plastic shows the table through.
export function hubTexture({ seed = 3 }) {
  const S = 1024
  const span = 2 * DATA_IN // the texture covers the hub out to DATA_IN
  const k = S / span
  const c = document.createElement('canvas')
  c.width = c.height = S
  const g = c.getContext('2d')
  const cx = S / 2
  const r = rng(seed)
  g.clearRect(0, 0, S, S)
  // frosted clamping band
  const fg = g.createRadialGradient(cx, cx, (HOLE + 0.0006) * k, cx, cx, 0.0135 * k)
  fg.addColorStop(0, 'rgba(255,255,255,0.0)')
  fg.addColorStop(0.1, 'rgba(255,255,255,0.32)')
  fg.addColorStop(0.92, 'rgba(255,255,255,0.28)')
  fg.addColorStop(1, 'rgba(255,255,255,0.0)')
  g.fillStyle = fg
  g.beginPath()
  g.arc(cx, cx, 0.0135 * k, 0, Math.PI * 2)
  g.arc(cx, cx, (HOLE + 0.0006) * k, 0, Math.PI * 2, true)
  g.fill()
  // matrix / ID code, moulded into the plastic
  const code = `RD${Math.floor(r() * 9000 + 1000)}C${Math.floor(r() * 90 + 10)}A${Math.floor(r() * 9e6 + 1e6)}`
  const radius = 0.0142 * k
  g.font = `600 ${0.00135 * k}px ui-monospace, Menlo, monospace`
  g.fillStyle = 'rgba(70,72,78,0.55)'
  g.textAlign = 'center'
  let a = Math.PI * 0.62
  for (const ch of code) {
    g.save()
    g.translate(cx + Math.cos(a) * radius, cx + Math.sin(a) * radius)
    g.rotate(a + Math.PI / 2)
    g.fillText(ch, 0, 0)
    g.restore()
    a -= 0.0011 * k / radius
  }
  // a second, smaller stamp opposite
  g.font = `500 ${0.0009 * k}px ui-monospace, Menlo, monospace`
  g.fillStyle = 'rgba(70,72,78,0.4)'
  a = -Math.PI * 0.32
  for (const ch of 'SID L201  ·  52X') {
    g.save()
    g.translate(cx + Math.cos(a) * radius, cx + Math.sin(a) * radius)
    g.rotate(a + Math.PI / 2)
    g.fillText(ch, 0, 0)
    g.restore()
    a -= 0.0008 * k / radius
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}
