import * as THREE from 'three'

// A casino clay chip at real size and in detail: 39 mm across, 3.3 mm thick
// (about 10 g), with softly rounded edges; eight edge spots that run through
// the chip, so they show on both faces and round the side, lined up; eight
// engraved squares between them; a ring of small dashes; and a slightly
// recessed inlay printed with the value. The surface has the fine sandy
// texture of compression-moulded clay.
//
// The dimensions match the roulette and poker tables' chips (0.0195 m
// radius, 0.0033 m thick).

export const CHIP = { r: 0.0195, h: 0.0033, edge: 0.0006 }

// The common casino colour convention (there is no single binding rule;
// casinos and jurisdictions vary, $10 and $1,000 most of all).
export const DENOMINATIONS = [
  { value: 1, label: '1', color: '#f1f0ea', spot: '#2a4fa6', ink: '#2a4fa6' },
  { value: 5, label: '5', color: '#c21d24', spot: '#f4f3ee', ink: '#f4f3ee' },
  { value: 10, label: '10', color: '#1e4db0', spot: '#f4f3ee', ink: '#f4f3ee' },
  { value: 25, label: '25', color: '#1d7a3b', spot: '#f4f3ee', ink: '#f4f3ee' },
  { value: 100, label: '100', color: '#19191b', spot: '#f4f3ee', ink: '#f4f3ee' },
  { value: 500, label: '500', color: '#5a2a8a', spot: '#f4f3ee', ink: '#f4f3ee' },
  { value: 1000, label: '1000', color: '#efc21a', spot: '#19191b', ink: '#19191b' },
]

const SPOTS = 8
const SPOT_W = (17 / 360) * Math.PI * 2 // each spot spans 17 degrees
// angles in the lathe's convention: a point at angle a sits at
// (x, z) = (sin a, cos a) * r. Spots are centred between the squares.
const spotAngle = (k) => ((k + 0.5) / SPOTS) * Math.PI * 2
const squareAngle = (k) => (k / SPOTS) * Math.PI * 2

// a face canvas point for angle a, radius f (fraction of R): the cap's UVs
// put world +x to the right and world +z down the canvas
const at = (S, a, f) => [S / 2 + Math.sin(a) * f * (S / 2), S / 2 + Math.cos(a) * f * (S / 2)]

function sector(g, S, a0, a1, f0, f1) {
  // canvas angle for our angle a: x = sin a, y = cos a  ->  atan2(cos, sin) = pi/2 - a
  const c0 = Math.PI / 2 - a0
  const c1 = Math.PI / 2 - a1
  g.beginPath()
  g.arc(S / 2, S / 2, f1 * (S / 2), c0, c1, true)
  g.arc(S / 2, S / 2, f0 * (S / 2), c1, c0, false)
  g.closePath()
}

function mix(hex, other, t) {
  return '#' + new THREE.Color(hex).lerp(new THREE.Color(other), t).getHexString()
}

// the face's colour: spots, squares, dashes, inlay and value
export function faceTexture(d, showValue = true) {
  const S = 1024
  const c = Object.assign(document.createElement('canvas'), { width: S, height: S })
  const g = c.getContext('2d')
  g.fillStyle = d.color
  g.fillRect(0, 0, S, S)
  // edge spots
  g.fillStyle = d.spot
  for (let k = 0; k < SPOTS; k++) {
    sector(g, S, spotAngle(k) - SPOT_W / 2, spotAngle(k) + SPOT_W / 2, 0.79, 1.02)
    g.fill()
  }
  // the engraved squares: a faint darker outline in the colour too
  g.strokeStyle = mix(d.color, '#000000', 0.22)
  g.lineWidth = S * 0.006
  for (let k = 0; k < SPOTS; k++) {
    const [x, y] = at(S, squareAngle(k), 0.875)
    g.save()
    g.translate(x, y)
    g.rotate(-squareAngle(k))
    const s = S * 0.06
    g.strokeRect(-s / 2, -s / 2, s, s)
    g.strokeRect(-s * 0.36, -s * 0.36, s * 0.72, s * 0.72)
    g.restore()
  }
  // a ring of dashes round the inlay
  g.fillStyle = d.spot
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI * 2
    sector(g, S, a - 0.07, a + 0.07, 0.655, 0.69)
    g.fill()
  }
  // the inlay: a touch lighter, with a fine edge
  g.fillStyle = mix(d.color, d.color === '#19191b' ? '#4a4a50' : '#ffffff', d.color === '#f1f0ea' ? 0 : 0.08)
  g.beginPath()
  g.arc(S / 2, S / 2, 0.62 * (S / 2), 0, Math.PI * 2)
  g.fill()
  g.strokeStyle = mix(d.color, '#000000', 0.25)
  g.lineWidth = S * 0.004
  g.stroke()
  if (showValue) {
    g.fillStyle = d.ink
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    const big = d.label.length > 3 ? 0.16 : d.label.length > 2 ? 0.2 : 0.25
    g.font = `800 ${Math.round(S * big)}px "Helvetica Neue", Arial, sans-serif`
    g.fillText(d.label, S / 2, S / 2 + S * 0.012)
    g.font = `700 ${Math.round(S * 0.045)}px "Helvetica Neue", Arial, sans-serif`
    g.fillText('REACT DIMENSIONS', S / 2, S / 2 - S * 0.19)
    g.fillText('CASINO', S / 2, S / 2 + S * 0.2)
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 16
  return t
}

// the face's relief, the same for every chip: clay grain, the engraved
// squares, the raised dashes, and the inlay sitting a little lower
export function faceBump() {
  const S = 1024
  const c = Object.assign(document.createElement('canvas'), { width: S, height: S })
  const g = c.getContext('2d')
  const img = g.createImageData(S, S)
  for (let i = 0; i < S * S; i++) {
    const v = 150 + Math.random() * 26
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v
    img.data[i * 4 + 3] = 255
  }
  g.putImageData(img, 0, 0)
  // the inlay, recessed
  g.fillStyle = 'rgba(70,70,70,0.75)'
  g.beginPath()
  g.arc(S / 2, S / 2, 0.62 * (S / 2), 0, Math.PI * 2)
  g.fill()
  // the dashes, raised
  g.fillStyle = 'rgba(255,255,255,0.5)'
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI * 2
    sector(g, S, a - 0.07, a + 0.07, 0.655, 0.69)
    g.fill()
  }
  // the squares, cut in
  g.strokeStyle = 'rgba(0,0,0,0.9)'
  g.lineWidth = S * 0.007
  for (let k = 0; k < SPOTS; k++) {
    const [x, y] = at(S, squareAngle(k), 0.875)
    g.save()
    g.translate(x, y)
    g.rotate(-squareAngle(k))
    const s = S * 0.06
    g.strokeRect(-s / 2, -s / 2, s, s)
    g.strokeRect(-s * 0.36, -s * 0.36, s * 0.72, s * 0.72)
    g.restore()
  }
  const t = new THREE.CanvasTexture(c)
  t.anisotropy = 16
  return t
}

// the side: the chip's colour with the spots running across it, lined up
// with the spots on the faces
export function sideTexture(d) {
  const W = 2048
  const H = 64
  const c = Object.assign(document.createElement('canvas'), { width: W, height: H })
  const g = c.getContext('2d')
  g.fillStyle = d.color
  g.fillRect(0, 0, W, H)
  g.fillStyle = d.spot
  for (let k = 0; k < SPOTS; k++) {
    const u = spotAngle(k) / (Math.PI * 2)
    const w = SPOT_W / (Math.PI * 2)
    g.fillRect((u - w / 2) * W, 0, w * W, H)
  }
  // clay grain
  for (let i = 0; i < 9000; i++) {
    g.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)'
    g.fillRect(Math.random() * W, Math.random() * H, 1.5, 1.5)
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = THREE.RepeatWrapping
  t.anisotropy = 8
  return t
}

// The geometry, centred on the origin with its faces up and down: the rim
// is a lathe with rounded edges (its u runs round the chip, matching the
// side texture), the faces are flat caps inside the rounding.
export function chipGeometry() {
  const { r: R, h, edge: e } = CHIP
  const pts = []
  const top = h / 2
  for (let i = 0; i <= 6; i++) {
    const a = (i / 6) * (Math.PI / 2)
    pts.push(new THREE.Vector2(R - e + Math.sin(a) * e, top - e + Math.cos(a) * e))
  }
  for (let i = 0; i <= 6; i++) {
    const a = Math.PI / 2 + (i / 6) * (Math.PI / 2)
    pts.push(new THREE.Vector2(R - e + Math.sin(a) * e, -top + e + Math.cos(a) * e))
  }
  // run the profile downwards so the lathe's faces point outwards
  const rim = new THREE.LatheGeometry(pts, 96)
  const capR = R - e * 0.35
  const topCap = new THREE.CircleGeometry(capR, 96).rotateX(-Math.PI / 2).translate(0, top - 0.00002, 0)
  const bottomCap = new THREE.CircleGeometry(capR, 96).rotateX(Math.PI / 2).translate(0, -top + 0.00002, 0)
  // stretch the caps' UVs so the canvas spans the full radius R
  for (const cap of [topCap, bottomCap]) {
    const uv = cap.attributes.uv
    for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.5 + (uv.getX(i) - 0.5) * (capR / R), 0.5 + (uv.getY(i) - 0.5) * (capR / R))
  }
  return { rim, topCap, bottomCap }
}
