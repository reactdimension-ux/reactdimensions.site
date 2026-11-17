import * as THREE from 'three'

// Low-poly GT race car, metres. +x is the nose, +y up, +z the right side.
// About 4.65 m long, 2.0 m wide and 1.17 m tall on a 2.64 m wheelbase.
export const WHEEL_R = 0.345
export const WHEEL_W = 0.28
export const FRONT_AXLE = 1.32
export const REAR_AXLE = -1.32
export const WHEELBASE = FRONT_AXLE - REAR_AXLE
export const WHEEL_Z = 0.845 // wheel centre, either side
export const NOSE = 2.32
export const TAIL = -2.32
export const ARCH_R = 0.41
const WELL_W = 0.66 // inner wall of the wheel wells

// Cross sections along the car. Each half ring, from the roof centre down the
// right side: E (centre top), D (top edge), C (shoulder / belt), B (widest),
// A2 (lower corner), A (floor edge). Values are [y, z] pairs, linear in x.
//                x      yE    yD   zD    yC   zC    yB   zB    yA2  zA2   yb   zA
const KEYS = [
  [NOSE, /*    */ 0.47, 0.47, 0.4, 0.44, 0.62, 0.38, 0.66, 0.3, 0.62, 0.26, 0.55],
  [2.18, /*    */ 0.57, 0.6, 0.62, 0.56, 0.86, 0.36, 0.9, 0.24, 0.86, 0.16, 0.78],
  [1.95, /*    */ 0.66, 0.71, 0.68, 0.7, 0.95, 0.4, 0.98, 0.24, 0.95, 0.14, 0.86],
  [1.32, /*    */ 0.78, 0.85, 0.72, 0.84, 0.96, 0.44, 0.99, 0.26, 0.96, 0.14, 0.88],
  [0.95, /*    */ 0.86, 0.87, 0.7, 0.83, 0.94, 0.44, 0.99, 0.26, 0.96, 0.14, 0.88],
  [0.0, /*     */ 1.17, 1.15, 0.56, 0.86, 0.92, 0.45, 0.99, 0.26, 0.96, 0.14, 0.88],
  [-0.6, /*    */ 1.16, 1.14, 0.56, 0.88, 0.94, 0.46, 1.0, 0.26, 0.97, 0.15, 0.88],
  [-1.0, /*    */ 1.05, 1.04, 0.6, 0.9, 0.97, 0.46, 1.0, 0.26, 0.97, 0.15, 0.88],
  [-1.9, /*    */ 0.95, 0.95, 0.66, 0.9, 0.96, 0.46, 1.0, 0.26, 0.97, 0.18, 0.88],
  [-2.2, /*    */ 0.92, 0.92, 0.7, 0.88, 0.92, 0.48, 0.95, 0.3, 0.9, 0.24, 0.8],
  [TAIL, /*    */ 0.87, 0.87, 0.66, 0.84, 0.86, 0.5, 0.88, 0.38, 0.82, 0.34, 0.72],
]

function keyAt(x) {
  for (let i = 0; i < KEYS.length - 1; i++) {
    const a = KEYS[i]
    const b = KEYS[i + 1]
    if (x <= a[0] && x >= b[0]) {
      const t = (a[0] - x) / (a[0] - b[0] || 1)
      return a.map((v, j) => v + (b[j] - v) * t)
    }
  }
  return x > 0 ? KEYS[0] : KEYS[KEYS.length - 1]
}

// Height of the wheel arch over x (null outside an arch).
function archY(x) {
  for (const cx of [FRONT_AXLE, REAR_AXLE]) {
    const d = x - cx
    if (Math.abs(d) <= ARCH_R + 1e-6) return WHEEL_R + Math.sqrt(Math.max(ARCH_R * ARCH_R - d * d, 0))
  }
  return null
}

// Right half ring [E, D, C, B, A2, A] as [y, z].
function halfRing(x) {
  const [, yE, yD, zD, yC, zC, yB, zB, yA2, zA2, yb, zA] = keyAt(x)
  const ay = archY(x)
  if (ay === null) {
    return [[yE, 0], [yD, zD], [yC, zC], [yB, zB], [yA2, zA2], [yb, zA]]
  }
  // Over a wheel the lower side steps in to the well wall and up over the arch.
  const by = Math.max(yB, ay + 0.03)
  const cy = Math.max(yC, by + 0.05)
  return [[yE, 0], [yD, zD], [cy, zC], [by, zB], [ay, WELL_W], [yb, WELL_W]]
}

// Stations: the body keys plus faceted arches (6 segments each) with a
// near-coincident pair at each arch edge so the side drops cleanly.
function stations() {
  const xs = new Set(KEYS.map((k) => k[0]))
  for (const cx of [FRONT_AXLE, REAR_AXLE]) {
    for (let i = 0; i <= 6; i++) xs.add(+(cx + ARCH_R * Math.cos((i / 6) * Math.PI)).toFixed(4))
    xs.add(cx + ARCH_R + 0.02)
    xs.add(cx - ARCH_R - 0.02)
  }
  xs.add(0.45)
  xs.add(-0.3)
  xs.add(-1.45)
  return [...xs].sort((a, b) => b - a) // nose first
}

// Paint zones for one quad. band 0 = top (E-D), 1 = upper side (D-C),
// 2 = side (C-B), 3 = lower side (B-A2), 4 = sill (A2-A), 5 = floor.
function zone(band, x, arch) {
  if (band === 5) return 'under'
  if (arch && (band === 3 || band === 4)) return 'well'
  if (band === 0) {
    if (x < 0.95 && x > 0.0) return 'glass' // windshield
    if (x < -0.6 && x > -1.0) return 'glass' // rear window
    if (x < -1.0 && x > -2.0) return 'trim' // louvred engine cover
    return 'paint'
  }
  if (band === 1) return x < 0.95 && x > -1.0 ? 'glass' : 'paint'
  if (band === 4) return 'trim'
  if (band === 3 && (x > 1.9 || x < -2.0)) return 'trim'
  return 'paint'
}

// Builds the faceted shell as one non-indexed geometry per paint zone.
export function bodyGeometries() {
  const xs = stations()
  const rings = xs.map((x) => {
    const half = halfRing(x)
    // Full ring: E, right side down, floor, left side up.
    const right = half.map(([y, z]) => new THREE.Vector3(x, y, z))
    const left = half.slice(1).reverse().map(([y, z]) => new THREE.Vector3(x, y, -z))
    return { x, arch: archY(x) !== null, pts: [...right, ...left] }
  })
  const bands = [0, 1, 2, 3, 4, 5, 4, 3, 2, 1, 0]
  const zones = {}
  const push = (name, ...tri) => {
    ;(zones[name] ||= []).push(...tri.flatMap((v) => [v.x, v.y, v.z]))
  }
  for (let i = 0; i < rings.length - 1; i++) {
    // rings run nose -> tail, so ring i+1 is further back.
    const front = rings[i]
    const back = rings[i + 1]
    const xm = (front.x + back.x) / 2
    const arch = front.arch && back.arch
    const n = front.pts.length
    for (let k = 0; k < n; k++) {
      const k2 = (k + 1) % n
      const a0 = back.pts[k]
      const b0 = back.pts[k2]
      const a1 = front.pts[k]
      const b1 = front.pts[k2]
      const name = zone(bands[k], xm, arch)
      push(name, a0, b0, b1)
      push(name, a0, b1, a1)
    }
  }
  // End caps: a fan round each end ring.
  const cap = (ring, name, flip) => {
    const c = ring.pts.reduce((s, p) => s.add(p), new THREE.Vector3()).divideScalar(ring.pts.length)
    const n = ring.pts.length
    for (let k = 0; k < n; k++) {
      const p = ring.pts[k]
      const q = ring.pts[(k + 1) % n]
      if (flip) push(name, c, q, p)
      else push(name, c, p, q)
    }
  }
  cap(rings[0], 'trim', false)
  cap(rings[rings.length - 1], 'trim', true)

  const out = {}
  for (const [name, arr] of Object.entries(zones)) {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3))
    g.computeVertexNormals()
    out[name] = g
  }
  return out
}

// The body surface at x on the right side, for placing decals and mirrors.
export function sideAt(x, y) {
  const half = halfRing(x)
  for (let i = 0; i < half.length - 1; i++) {
    const [y0, z0] = half[i]
    const [y1, z1] = half[i + 1]
    if ((y <= y0 && y >= y1) || (y >= y0 && y <= y1)) {
      const t = (y - y0) / (y1 - y0 || 1)
      return { z: z0 + (z1 - z0) * t, tilt: Math.atan2(z0 - z1, y0 - y1) }
    }
  }
  return { z: half[3][1], tilt: 0 }
}

// Centre-line height of the top surface at x (hood, roof, deck).
export const topAt = (x) => halfRing(x)[0][0]
// Top edge [y, z] at x, for things sitting on the hood.
export const topEdgeAt = (x) => halfRing(x)[1]

// Low-poly tyre: a 14-sided drum with chamfered shoulders, axis along y.
export function tyreGeometry() {
  const r = WHEEL_R
  const w = WHEEL_W / 2
  const pts = [
    new THREE.Vector2(0.22, -w),
    new THREE.Vector2(r - 0.03, -w),
    new THREE.Vector2(r, -w + 0.04),
    new THREE.Vector2(r, w - 0.04),
    new THREE.Vector2(r - 0.03, w),
    new THREE.Vector2(0.22, w),
  ]
  const g = new THREE.LatheGeometry(pts, 14).toNonIndexed()
  g.computeVertexNormals()
  return g
}
