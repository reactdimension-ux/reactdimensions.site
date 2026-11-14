import * as THREE from 'three'
import { FRETS } from './strings.js'
import {
  BODY_BEVEL,
  BODY_T,
  FB,
  FB_END,
  HS_T,
  HS_TOP,
  NUT_Y,
  TOP,
  bodyShape,
  fretY,
  guardOutline,
  guardShape,
  headShape,
  neckWidth,
} from './shapes.js'

// The guitar's wooden parts and plates, built from the outlines in
// shapes.js. Guitar frame: x across (bass side negative), y up the neck,
// z out of the top; metres.

export const FB_T = 0.006 // fretboard thickness
export const FB_RADIUS = 0.2413 // 9.5" radius
// the fretboard's surface height across it (it is cambered)
export const fbZ = (x) => FB - (x * x) / (2 * FB_RADIUS)

export const HEEL_Y = FB_END - 0.072 // where the neck ends, inside the body's pocket

// ---- body: extruded with a rolled edge ----
export function bodyGeometry() {
  const depth = BODY_T - 2 * BODY_BEVEL
  const g = new THREE.ExtrudeGeometry(bodyShape(), { depth, bevelEnabled: true, bevelThickness: BODY_BEVEL, bevelSize: BODY_BEVEL, bevelSegments: 10, curveSegments: 1, steps: 1 })
  g.translate(0, 0, -depth / 2)
  return g
}

export function guardGeometry() {
  const g = new THREE.ExtrudeGeometry(guardShape(), { depth: 0.0016, bevelEnabled: true, bevelThickness: 0.0004, bevelSize: 0.0007, bevelSegments: 2, curveSegments: 1 })
  g.translate(0, 0, TOP + 0.0004)
  return g
}
// screws round the pickguard's edge, a little inside it
export function guardScrews() {
  const pts = guardOutline()
  const out = []
  const n = 11
  for (let k = 0; k < n; k++) {
    const i = Math.floor((k / n) * pts.length)
    const p = pts[i]
    const q = pts[(i + 4) % pts.length]
    const t = new THREE.Vector2(q.x - p.x, q.y - p.y).normalize()
    // inward is to the left of the outline's direction (it runs anticlockwise)
    out.push([p.x - t.y * 0.0045, p.y + t.x * 0.0045])
  }
  return out
}

// ---- neck: a lofted C profile under the fretboard, squarer at the heel ----
export function neckGeometry() {
  const NY = 90
  const NP = 28
  const y0 = HEEL_Y
  const y1 = NUT_Y + 0.004
  const top = FB - FB_T
  const pos = []
  const uv = []
  const idx = []
  for (let j = 0; j <= NY; j++) {
    const y = y0 + ((y1 - y0) * j) / NY
    const w = neckWidth(Math.max(y, FB_END))
    // depth: 21 mm at the nut to 23.5 mm at the 12th, deeper at the heel
    const t12 = (NUT_Y - y) / (NUT_Y - fretY(12))
    const d = y < FB_END ? 0.026 : 0.021 + 0.0025 * Math.min(1, Math.max(0, t12))
    // the heel is squared off; the playing neck is a soft C
    const n = y < FB_END - 0.01 ? 6 : 2.3
    for (let k = 0; k <= NP; k++) {
      const a = (k / NP) * Math.PI
      const c = Math.cos(a)
      const s = Math.sin(a)
      const x = (w / 2) * Math.sign(c) * Math.pow(Math.abs(c), 2 / n)
      const z = top - d * Math.pow(s, 2 / n)
      pos.push(x, y, z)
      uv.push(k / NP, (y - y0) / 0.3)
    }
  }
  for (let j = 0; j < NY; j++)
    for (let k = 0; k < NP; k++) {
      const a = j * (NP + 1) + k
      const b = a + NP + 1
      idx.push(a, a + 1, b, a + 1, b + 1, b)
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

// ---- fretboard: cambered top, square sides, capped end ----
export function fretboardGeometry() {
  const NY = 60
  const NX = 14
  const y0 = FB_END
  const y1 = NUT_Y
  const pos = []
  const uv = []
  const idx = []
  const add = (x, y, z, u, v) => (pos.push(x, y, z), uv.push(u, v), pos.length / 3 - 1)
  // top
  const grid = []
  for (let j = 0; j <= NY; j++) {
    const y = y0 + ((y1 - y0) * j) / NY
    const w = neckWidth(y)
    const row = []
    for (let i = 0; i <= NX; i++) {
      const x = -w / 2 + (w * i) / NX
      row.push(add(x, y, fbZ(x), i / NX, (y - y0) / 0.25))
    }
    grid.push(row)
  }
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) idx.push(grid[j][i], grid[j][i + 1], grid[j + 1][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i])
  // the two sides
  for (const side of [-1, 1]) {
    const col = []
    for (let j = 0; j <= NY; j++) {
      const y = y0 + ((y1 - y0) * j) / NY
      const x = (side * neckWidth(y)) / 2
      col.push([add(x, y, fbZ(x), 0.02, (y - y0) / 0.25), add(x, y, FB - FB_T, 0, (y - y0) / 0.25)])
    }
    for (let j = 0; j < NY; j++) {
      const [a0, b0] = col[j]
      const [a1, b1] = col[j + 1]
      if (side > 0) idx.push(a0, b0, a1, b0, b1, a1)
      else idx.push(a0, a1, b0, b0, a1, b1)
    }
  }
  // the end, towards the body
  {
    const w = neckWidth(y0)
    const c = add(0, y0, FB - FB_T / 2, 0.5, 0)
    const ring = []
    for (let i = 0; i <= NX; i++) {
      const x = -w / 2 + (w * i) / NX
      ring.push(add(x, y0, fbZ(x), i / NX, 0))
    }
    ring.push(add(w / 2, y0, FB - FB_T, 1, 0), add(-w / 2, y0, FB - FB_T, 0, 0))
    for (let i = 0; i < ring.length; i++) idx.push(c, ring[(i + 1) % ring.length], ring[i])
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

// a fret: nickel-silver wire bent to the board's radius, its crown standing
// about 1.1 mm proud
export function fretGeometries() {
  return Array.from({ length: FRETS }, (_, n) => {
    const y = fretY(n + 1)
    const w = neckWidth(y) - 0.0008
    const pts = []
    for (let i = 0; i <= 10; i++) {
      const x = -w / 2 + (w * i) / 10
      pts.push(new THREE.Vector3(x, y, fbZ(x)))
    }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, 0.00115, 8, false)
  })
}
// position markers: single dots, a pair at the 12th
export function dotPositions() {
  const mid = (k) => (fretY(k) + fretY(k - 1)) / 2
  const d = [3, 5, 7, 9, 15, 17, 19, 21].map((k) => [0, mid(k)])
  d.push([-0.0095, mid(12)], [0.0095, mid(12)])
  return d
}

// ---- headstock ----
export function headGeometry() {
  const depth = HS_T - 0.003
  const g = new THREE.ExtrudeGeometry(headShape(), { depth, bevelEnabled: true, bevelThickness: 0.0015, bevelSize: 0.0012, bevelSegments: 4, curveSegments: 1 })
  g.translate(0, 0, HS_TOP - depth - 0.0015)
  return g
}

// ---- small turned parts ----
export const lathe = (pts, seg = 32) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg)

// a single-coil cover: a rounded slot shape with a domed top
export function pickupGeometry() {
  const L = 0.0835
  const W = 0.0185
  const r = W / 2
  const s = new THREE.Shape()
  s.moveTo(-L / 2 + r, -r)
  s.lineTo(L / 2 - r, -r)
  s.absarc(L / 2 - r, 0, r, -Math.PI / 2, Math.PI / 2, false)
  s.lineTo(-L / 2 + r, r)
  s.absarc(-L / 2 + r, 0, r, Math.PI / 2, (3 * Math.PI) / 2, false)
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.0072, bevelEnabled: true, bevelThickness: 0.0024, bevelSize: 0.0016, bevelSegments: 6, curveSegments: 24 })
  return g
}

// rounded plate (for the neck plate and the back cover)
export function plateGeometry(w, h, r, t) {
  const s = new THREE.Shape()
  s.moveTo(-w / 2 + r, -h / 2)
  s.lineTo(w / 2 - r, -h / 2)
  s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r)
  s.lineTo(w / 2, h / 2 - r)
  s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2)
  s.lineTo(-w / 2 + r, h / 2)
  s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r)
  s.lineTo(-w / 2, -h / 2 + r)
  s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2)
  return new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: true, bevelThickness: t * 0.3, bevelSize: t * 0.4, bevelSegments: 2, curveSegments: 8 })
}
