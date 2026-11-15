import * as THREE from 'three'
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

// Vehicles, drawn as three instanced parts each:
//   body   – painted panels (the paint colour is the instance colour)
//   trim   – glass, tyres, bumpers, grilles, the cab's roof sign (vertex colours)
//   lights – head and tail lamps; the vertex colour says which lamp is which
//            (r = tail, g = head) and the instance colour how bright each is
// Lengths along +x, the nose at +x, wheels on the ground at y = 0.

function colored(g, c) {
  const n = g.attributes.position.count
  const col = new Float32Array(n * 3)
  const cc = new THREE.Color(c)
  for (let i = 0; i < n; i++) col.set([cc.r, cc.g, cc.b], i * 3)
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  return g
}
const strip = (g) => {
  const out = g.index ? g.toNonIndexed() : g
  for (const k of Object.keys(out.attributes)) if (!['position', 'normal', 'color'].includes(k)) out.deleteAttribute(k)
  return out
}

// side profile (x, y) extruded across the width, with rounded edges
function extrude(pts, width, bevel = 0.07) {
  const s = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)))
  const g = new THREE.ExtrudeGeometry(s, { depth: width - bevel * 2, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 1, curveSegments: 2 })
  g.translate(0, 0, -(width - bevel * 2) / 2)
  g.computeVertexNormals()
  return g
}
// shrink/grow a convex outline toward/away from its centroid
function inset(pts, k) {
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length
  const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length
  return pts.map(([x, y]) => [cx + (x - cx) * k, cy + (y - cy) * k])
}
function boxAt(w, h, d, x, y, z) {
  return new THREE.BoxGeometry(w, h, d).translate(x, y, z)
}
function wheels(xs, r, width, half) {
  const out = []
  for (const x of xs)
    for (const s of [-1, 1]) {
      const t = new THREE.CylinderGeometry(r, r, width, 8, 1).rotateX(Math.PI / 2).translate(x, r, s * half)
      out.push(colored(strip(t), '#0b0b0c'))
    }
  return out
}
const GLASS = '#0a0d10'

// A car from its body outline and its glasshouse (the windows' outline).
function car({ body, cabin, width, wheelX, wheelR = 0.34, extras = [], roofSign = false }) {
  const W = width
  const bodyG = strip(extrude(body, W))
  const trim = []
  // side windows: the glasshouse, a little in from the frame, standing proud of the sides
  trim.push(colored(strip(extrude(inset(cabin, 0.9), W + 0.03, 0)), GLASS))
  // windscreen and back light: the glasshouse a touch larger, narrower than the body
  trim.push(colored(strip(extrude(inset(cabin, 1.025), W - 0.22, 0)), GLASS))
  trim.push(...wheels(wheelX, wheelR, 0.24, W / 2 - 0.1))
  const xs = body.map((p) => p[0])
  const front = Math.max(...xs)
  const back = Math.min(...xs)
  // bumpers and grille
  trim.push(colored(strip(boxAt(0.12, 0.22, W * 0.96, front - 0.02, 0.42, 0)), '#16171a'))
  trim.push(colored(strip(boxAt(0.12, 0.22, W * 0.96, back + 0.02, 0.42, 0)), '#16171a'))
  if (roofSign) {
    const roofY = Math.max(...body.map((p) => p[1]))
    trim.push(colored(strip(boxAt(0.95, 0.32, 0.26, -0.15, roofY + 0.2, 0)), '#f2efe2'))
    trim.push(colored(strip(boxAt(0.4, 0.05, 0.22, -0.15, roofY + 0.04, 0)), '#16171a'))
  }
  trim.push(...extras)
  const lights = [
    colored(strip(boxAt(0.06, 0.12, 0.34, front + 0.01, 0.72, W / 2 - 0.3)), '#00ff00'),
    colored(strip(boxAt(0.06, 0.12, 0.34, front + 0.01, 0.72, -W / 2 + 0.3)), '#00ff00'),
    colored(strip(boxAt(0.06, 0.14, 0.3, back - 0.01, 0.82, W / 2 - 0.25)), '#ff0000'),
    colored(strip(boxAt(0.06, 0.14, 0.3, back - 0.01, 0.82, -W / 2 + 0.25)), '#ff0000'),
  ]
  // indexed, so each shared corner is shaded once
  return { body: mergeVertices(bodyG), trim: mergeVertices(mergeGeometries(trim)), lights: mergeVertices(mergeGeometries(lights)), length: front - back, width: W }
}

export function vehicleTypes() {
  const sedanBody = [
    [-2.4, 0.3],
    [2.32, 0.3],
    [2.45, 0.55],
    [2.38, 0.8],
    [1.2, 0.95],
    [0.42, 1.42],
    [-0.9, 1.45],
    [-1.75, 1.0],
    [-2.35, 0.95],
    [-2.45, 0.6],
  ]
  const sedanCabin = [
    [1.12, 0.98],
    [0.42, 1.39],
    [-0.88, 1.42],
    [-1.66, 1.02],
  ]
  const sedan = car({ body: sedanBody, cabin: sedanCabin, width: 1.84, wheelX: [1.45, -1.45] })
  const taxi = car({ body: sedanBody, cabin: sedanCabin, width: 1.84, wheelX: [1.45, -1.45], roofSign: true })
  const suv = car({
    body: [
      [-2.45, 0.38],
      [2.4, 0.38],
      [2.5, 0.7],
      [2.42, 1.02],
      [1.55, 1.15],
      [0.95, 1.8],
      [-2.3, 1.84],
      [-2.48, 1.2],
      [-2.5, 0.7],
    ],
    cabin: [
      [1.48, 1.18],
      [0.95, 1.76],
      [-2.2, 1.8],
      [-2.38, 1.22],
    ],
    width: 1.96,
    wheelX: [1.5, -1.5],
    wheelR: 0.38,
  })
  // a city bus: a long box with a band of glass and a lit destination sign
  const busBody = [
    [-6.0, 0.35],
    [5.9, 0.35],
    [6.05, 0.6],
    [6.05, 2.9],
    [5.85, 3.1],
    [-5.9, 3.1],
    [-6.05, 2.9],
    [-6.05, 0.6],
  ]
  const busCabin = [
    [6.07, 1.05],
    [6.07, 2.75],
    [-5.85, 2.75],
    [-5.85, 1.3],
  ]
  const busExtras = [colored(strip(boxAt(0.04, 0.28, 1.6, 6.08, 2.92, 0)), '#ffb020')]
  const bus = car({ body: busBody, cabin: busCabin, width: 2.55, wheelX: [4.2, -2.6], wheelR: 0.5, extras: busExtras })
  // a box truck: cab and a tall box behind
  const van = car({
    body: [
      [-3.4, 0.4],
      [3.25, 0.4],
      [3.35, 0.7],
      [3.3, 1.2],
      [2.75, 1.35],
      [2.35, 2.25],
      [1.6, 2.3],
      [1.55, 3.2],
      [-3.4, 3.2],
      [-3.45, 0.7],
    ],
    cabin: [
      [2.7, 1.38],
      [2.33, 2.18],
      [1.7, 2.22],
      [1.7, 1.4],
    ],
    width: 2.3,
    wheelX: [2.4, -2.1],
    wheelR: 0.42,
  })
  return { sedan, taxi, suv, bus, van }
}

// The paint each kind comes in.
export const PAINTS = {
  sedan: ['#1b1c1f', '#e8e8e6', '#8a8d92', '#2b3a55', '#5c1418', '#c9cbcc', '#3d4148', '#0f2a20', '#efe9dc', '#22262c'],
  taxi: ['#f2b705', '#f0b000', '#f5bd0c'],
  suv: ['#121315', '#f1f1ef', '#4a4e55', '#1e2a3d', '#6d6f73', '#2e3b2a'],
  bus: ['#e9ecef'],
  van: ['#f4f4f2', '#d9dcdf', '#f4f4f2'],
}

// A soft dark patch to sit under each vehicle, for the shadow it would cast.
export function contactShadowTexture() {
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 64
  const g = c.getContext('2d')
  const grd = g.createRadialGradient(32, 32, 4, 32, 32, 32)
  grd.addColorStop(0, 'rgba(0,0,0,0.85)')
  grd.addColorStop(0.55, 'rgba(0,0,0,0.5)')
  grd.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = grd
  g.fillRect(0, 0, 64, 64)
  return new THREE.CanvasTexture(c)
}
