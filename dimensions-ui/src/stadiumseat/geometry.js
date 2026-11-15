import * as THREE from 'three'
import { join, loft, smooth } from '../airliner/geometry.js'

// A one-piece injection-moulded stadium seat on two steel brackets, built
// from its real dimensions. Units are metres. x runs across the seat, y is up
// from the tread and +z is forward (the way the sitter faces).
//
// The shell is a single surface swept along its side profile (front lip, seat
// pan, the bend, the backrest, the rolled top) with a width that changes along
// it, dished across, and finished with a rolled edge and a skirt underneath.
// Its underside is a truss of ribs; the two brackets bolt to boxed bosses on
// the back of the backrest.

// ---------------------------------------------------------------- profile
// The centre line of the shell from the bottom of the front lip, over the
// seat pan, round the bend and up to the top edge, which rolls back.
const PROFILE = [
  [0.214, 0.384], [0.229, 0.404], [0.226, 0.426], [0.2, 0.438], [0.14, 0.436], [0.06, 0.426],
  [-0.02, 0.419], [-0.09, 0.425], [-0.14, 0.447], [-0.17, 0.482], [-0.184, 0.53], [-0.19, 0.6],
  [-0.199, 0.68], [-0.216, 0.76], [-0.236, 0.818], [-0.252, 0.846], [-0.27, 0.858], [-0.286, 0.853],
]
const curve = new THREE.CatmullRomCurve3(PROFILE.map(([z, y]) => new THREE.Vector3(0, y, z)), false, 'centripetal')
export const L = curve.getLength()

// position and sitter-side normal (in the y-z plane) at arc length s
const C = new THREE.Vector3()
const T = new THREE.Vector3()
function centre(s) {
  const t = Math.min(1, Math.max(0, s / L))
  curve.getPointAt(t, C)
  curve.getTangentAt(t, T)
  // the normal is the tangent turned a quarter towards the sitter
  return { y: C.y, z: C.z, ny: -T.z, nz: T.y }
}

// arc length of the bend between the seat pan and the backrest: where the
// profile turns through 45 degrees
export const SJ = (() => {
  for (let s = 0.1; s < L; s += 0.002) {
    const { ny, nz } = centre(s)
    if (nz > ny) return s
  }
  return L / 2
})()

// Piecewise eased interpolation through [s, value] knots.
function knots(pts) {
  return (s) => {
    if (s <= pts[0][0]) return pts[0][1]
    for (let i = 0; i < pts.length - 1; i++) {
      const [s0, a] = pts[i]
      const [s1, b] = pts[i + 1]
      if (s <= s1) return a + (b - a) * smooth((s - s0) / (s1 - s0))
    }
    return pts[pts.length - 1][1]
  }
}

// half width along the profile: full at the front of the seat, a waist at the
// bend, and a back a little narrower than the seat
const halfWidth = knots([[0, 0.226], [0.2, 0.229], [SJ - 0.02, 0.212], [SJ + 0.08, 0.206], [L - 0.15, 0.214], [L, 0.216]])
// how deep the seat and the back are dished across
const dishDepth = knots([[0, 0], [0.07, 0.016], [SJ - 0.06, 0.02], [SJ + 0.06, 0.024], [L - 0.16, 0.022], [L, 0]])
const RF = 0.075 // corner radius of the front of the seat
const RT = 0.105 // corner radius of the top of the back

export function width(s) {
  let w = halfWidth(s)
  const d0 = s
  const d1 = L - s
  if (d0 < RF) w -= RF - Math.sqrt(RF * RF - (RF - d0) ** 2)
  if (d1 < RT) w -= RT - Math.sqrt(RT * RT - (RT - d1) ** 2)
  return w
}

// A point on the sitting surface at u (-1 left edge .. 1 right edge) and arc
// length s: the swept profile, dished across with a raised rim at each side.
export function surface(u, s, out = new THREE.Vector3()) {
  const c = centre(s)
  const a = Math.abs(u)
  const dish = dishDepth(s) * (u * u - 1) + 0.006 * smooth((a - 0.82) / 0.18) * smooth(s / 0.08) * smooth((L - s) / 0.14)
  return out.set(u * width(s), c.y + c.ny * dish, c.z + c.nz * dish)
}

// The raised panel moulded into the front of the backrest: a rounded
// rectangle standing 1.6 mm proud, its edge eased over about a centimetre.
export const PANEL = { s0: SJ + 0.075, s1: L - 0.06, hw: 0.165, r: 0.05 }
export function panelRaise(u, s) {
  const { s0, s1, hw, r } = PANEL
  const qx = Math.abs(u * width(s)) - hw + r
  const qy = Math.abs(s - (s0 + s1) / 2) - (s1 - s0) / 2 + r
  const d = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r
  return 0.0016 * smooth(-d / 0.009)
}

// the surface normal (towards the sitter) at u, s
const A = new THREE.Vector3()
const B = new THREE.Vector3()
export function normal(u, s, out = new THREE.Vector3()) {
  const e = 0.002
  surface(Math.min(1, u + e), s, A).sub(surface(Math.max(-1, u - e), s, B))
  const du = A.clone()
  surface(u, Math.min(L, s + 0.002), A).sub(surface(u, Math.max(0, s - 0.002), B))
  // across x along gives the side facing the sitter (the seat's up)
  return out.crossVectors(du, A).normalize()
}

export const THICK = 0.0038 // wall thickness of the shell
const ROLL = 0.0075 // radius of the rolled edge
const WALL = 0.0032 // thickness of the skirt and the ribs
// depth of the skirt: shallow where the front lip and the top already roll
// over, full along the sides
export const skirtDepth = (s) => 0.008 + 0.026 * smooth(s / 0.1) * smooth((L - s) / 0.1)

const NS = 200 // samples along the profile
const NU = 61 // samples across

// ---------------------------------------------------------------- the shell
// The top surface, the underside a wall thickness below it, and the rolled
// edge running down into the skirt that joins them all the way round.
export function shellGeometry() {
  const P = []
  const N = []
  for (let i = 0; i < NS; i++) {
    const s = (i / (NS - 1)) * L
    P.push([])
    N.push([])
    for (let j = 0; j < NU; j++) {
      const u = (j / (NU - 1)) * 2 - 1
      const n = normal(u, s)
      P[i].push(surface(u, s))
      N[i].push(n)
    }
  }

  // the boundary, once round: left side forward to back, along the top,
  // down the right side, back along the front lip
  const ring = []
  for (let i = 0; i < NS; i++) ring.push([i, 0, i, 1])
  for (let j = 1; j < NU; j++) ring.push([NS - 1, j, NS - 2, j])
  for (let i = NS - 2; i >= 0; i--) ring.push([i, NU - 1, i, NU - 2])
  for (let j = NU - 2; j > 0; j--) ring.push([0, j, 1, j])
  const K = ring.length
  const outward = ring.map(([i, j, ii, jj], k) => {
    const [pi, pj] = ring[(k - 1 + K) % K]
    const [ni, nj] = ring[(k + 1) % K]
    const t = P[ni][nj].clone().sub(P[pi][pj])
    const o = new THREE.Vector3().crossVectors(t, N[i][j]).normalize()
    if (o.dot(P[i][j].clone().sub(P[ii][jj])) < 0) o.negate()
    return o
  })

  const uvAt = (i, j) => ({ u: j / (NU - 1), v: i / (NS - 1) })
  const top = P.map((row, i) => row.map((p, j) => ({ p: p.clone().addScaledVector(N[i][j], panelRaise((j / (NU - 1)) * 2 - 1, (i / (NS - 1)) * L)), ...uvAt(i, j) })))
  // the underside meets the inner face of the skirt
  const under = P.map((row, i) => row.map((p, j) => ({ p: p.clone().addScaledVector(N[i][j], -THICK), ...uvAt(i, j) })))
  ring.forEach(([i, j], k) => under[i][j].p.addScaledVector(outward[k], ROLL - WALL))

  // the rolled edge and skirt: a quarter round, straight down, across the
  // bottom of the wall and back up its inner face
  const rows = []
  for (let k = 0; k <= K; k++) {
    const [i, j] = ring[k % K]
    const p = P[i][j]
    const n = N[i][j]
    const o = outward[k % K]
    const D = skirtDepth((i / (NS - 1)) * L)
    const row = []
    const put = (a, b, v) => row.push({ p: p.clone().addScaledVector(o, a).addScaledVector(n, -b), u: k / K, v })
    for (let q = 0; q <= 6; q++) {
      const a = (q / 6) * (Math.PI / 2)
      put(ROLL * Math.sin(a), ROLL * (1 - Math.cos(a)), q / 12)
    }
    put(ROLL, D * 0.92, 0.7)
    put(ROLL - 0.0008, D, 0.8)
    put(ROLL - WALL + 0.0008, D, 0.85)
    put(ROLL - WALL, D * 0.92, 0.9)
    put(ROLL - WALL, THICK, 1)
    rows.push(row)
  }

  return {
    top: loft(top, { flip: true }),
    under: loft(under),
    skirt: loft(rows),
  }
}

// ---------------------------------------------------------------- the ribs
// A rib stands off the underside along a path in (u, s), as deep as the skirt
// so the bottoms sit flush. Flat-shaded so its edges read crisply.
function ribGeometry(path, depth = null) {
  const pts = []
  for (let k = 0; k < path.length - 1; k++) {
    const [u0, s0] = path[k]
    const [u1, s1] = path[k + 1]
    const n = Math.max(2, Math.ceil(Math.hypot((u1 - u0) * 0.22, s1 - s0) / 0.01))
    for (let q = k ? 1 : 0; q <= n; q++) pts.push([u0 + ((u1 - u0) * q) / n, s0 + ((s1 - s0) * q) / n])
  }
  const base = pts.map(([u, s]) => {
    const n = normal(u, s)
    return { p: surface(u, s).addScaledVector(n, -THICK * 0.5), n, d: (depth ?? skirtDepth(s)) - THICK * 0.5 }
  })
  const rows = base.map((b, k) => {
    const a = base[Math.max(0, k - 1)].p
    const c = base[Math.min(base.length - 1, k + 1)].p
    const side = new THREE.Vector3().crossVectors(c.clone().sub(a), b.n).normalize().multiplyScalar(WALL / 2)
    const low = b.p.clone().addScaledVector(b.n, -b.d)
    return [b.p.clone().add(side), low.clone().add(side), low.clone().sub(side), b.p.clone().sub(side)].map((p) => ({ p }))
  })
  // close the two ends
  const g = loft(rows).toNonIndexed()
  g.computeVertexNormals()
  const ends = [rows[0], rows[rows.length - 1]].map((r) => {
    const e = new THREE.BufferGeometry().setFromPoints([r[0].p, r[1].p, r[2].p, r[0].p, r[2].p, r[3].p])
    e.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(12).fill(0), 2))
    e.computeVertexNormals()
    return e
  })
  return [g, ...ends]
}

// u of the bracket centre lines
export const BRACKET_U = 0.7
// arc length on the back where the clamps grip
export const CLAMP_S = SJ + 0.075

export function ribsGeometry() {
  const f = (t) => 0.05 + t * (SJ - 0.06) // seat pan, front (0) to bend (1)
  const m = (list) => [...list, ...list.map((p) => p.map(([u, s]) => [-u, s]))]
  const paths = m([
    // the truss under the seat pan
    [[0.8, f(0)], [0.8, f(1)]],
    [[0.4, f(0.3)], [0.4, f(1)]],
    [[0.8, f(0.02)], [0, f(0.3)]],
    [[0.4, f(0.3)], [0, f(0.64)]],
    [[0.4, f(0.64)], [0, f(0.98)]],
    [[0.8, f(0.3)], [0.4, f(0.64)]],
    [[0.8, f(0.64)], [0.4, f(0.98)]],
    // the boxed bosses the brackets bolt to, on the back of the backrest
    [[BRACKET_U - 0.11, SJ - 0.03], [BRACKET_U - 0.11, CLAMP_S + 0.07]],
    [[BRACKET_U + 0.11, SJ - 0.03], [BRACKET_U + 0.11, CLAMP_S + 0.07]],
    [[BRACKET_U - 0.11, CLAMP_S + 0.07], [BRACKET_U + 0.11, CLAMP_S + 0.07]],
    [[BRACKET_U - 0.11, CLAMP_S - 0.035], [BRACKET_U + 0.11, CLAMP_S - 0.035]],
    [[BRACKET_U - 0.11, CLAMP_S + 0.025], [BRACKET_U + 0.11, CLAMP_S + 0.025]],
    [[BRACKET_U + 0.11, CLAMP_S], [0.97, CLAMP_S]],
  ])
  paths.push(
    [[0, f(0)], [0, f(0.3)]],
    [[-0.97, f(0.3)], [0.97, f(0.3)]],
    [[-0.97, f(0.64)], [0.97, f(0.64)]],
    [[-0.97, f(1)], [0.97, f(1)]],
    [[-BRACKET_U + 0.11, CLAMP_S], [BRACKET_U - 0.11, CLAMP_S]],
  )
  return join(paths.flatMap((p) => ribGeometry(p)))
}

// ---------------------------------------------------------------- brackets
// Where a bracket meets the shell: the bottom of its boss on the back.
export function clampPoint(side) {
  const u = side * BRACKET_U
  const n = normal(u, CLAMP_S)
  const p = surface(u, CLAMP_S).addScaledVector(n, -(skirtDepth(CLAMP_S) + 0.001))
  return { p, n }
}

export const LEG = { w: 0.042, t: 0.006 } // the flat bar that stands behind the back
const HOLE = 0.0045

// The upright: a flat steel bar, face to the front, punched with fixing
// holes, from the tread up past the clamp.
export function legGeometry(top) {
  const s = new THREE.Shape()
  const w = LEG.w / 2
  const r = 0.006
  s.moveTo(-w, 0)
  s.lineTo(w, 0)
  s.lineTo(w, top - r)
  s.quadraticCurveTo(w, top, w - r, top)
  s.lineTo(-w + r, top)
  s.quadraticCurveTo(-w, top, -w, top - r)
  s.lineTo(-w, 0)
  const holes = [0.045, 0.09, 0.135, 0.18, top - 0.075, top - 0.03]
  holes.forEach((y) => {
    const h = new THREE.Path()
    h.absarc(0, y, HOLE, 0, Math.PI * 2, true)
    s.holes.push(h)
  })
  const g = new THREE.ExtrudeGeometry(s, { depth: LEG.t, bevelEnabled: true, bevelThickness: 0.0006, bevelSize: 0.0006, bevelSegments: 2, curveSegments: 20 })
  g.translate(0, 0, -LEG.t)
  return g
}

// The gusset: a plate that runs forward from the upright under the seat pan,
// its top edge following the bottom of the ribs and its front edge sloping
// down to the foot.
export function gussetGeometry(side, legZ) {
  const u = side * (BRACKET_U + 0.11)
  const pts = []
  for (let q = 0; q <= 24; q++) {
    const s = SJ * 0.56 + (q / 24) * (CLAMP_S - 0.03 - SJ * 0.56)
    const p = surface(u, s).addScaledVector(normal(u, s), -(skirtDepth(s) + 0.0005))
    if (p.z < legZ - LEG.t) break
    pts.push(p)
  }
  const s = new THREE.Shape()
  s.moveTo(legZ + 0.04, 0)
  pts.forEach((p, k) => (k ? s.lineTo(p.z, p.y) : s.lineTo(p.z, p.y)))
  const last = pts[pts.length - 1]
  s.lineTo(legZ - LEG.t, last.y)
  s.lineTo(legZ - LEG.t, 0)
  s.lineTo(legZ + 0.04, 0)
  const t = 0.006
  const g = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: true, bevelThickness: 0.0006, bevelSize: 0.0006, bevelSegments: 2, curveSegments: 24 })
  // the shape's x is the seat's z; lay it in the y-z plane
  g.rotateY(-Math.PI / 2)
  g.translate(t, 0, 0) // spans x 0..t
  return g
}

// the foot plate the bracket stands on, with its two anchor holes
export function footGeometry() {
  const s = new THREE.Shape()
  const w = 0.03
  const d = 0.06
  const r = 0.008
  s.moveTo(-w + r, -d)
  s.lineTo(w - r, -d)
  s.quadraticCurveTo(w, -d, w, -d + r)
  s.lineTo(w, d - r)
  s.quadraticCurveTo(w, d, w - r, d)
  s.lineTo(-w + r, d)
  s.quadraticCurveTo(-w, d, -w, d - r)
  s.lineTo(-w, -d + r)
  s.quadraticCurveTo(-w, -d, -w + r, -d)
  ;[-0.038, 0.038].forEach((z) => {
    const h = new THREE.Path()
    h.absarc(0, z, 0.0065, 0, Math.PI * 2, true)
    s.holes.push(h)
  })
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.0008, bevelSize: 0.0008, bevelSegments: 2, curveSegments: 16 })
  g.rotateX(Math.PI / 2)
  g.translate(0, 0.006, 0)
  return g
}

// a hex bolt head with its washer, axis along +z
export function boltGeometry() {
  const head = new THREE.CylinderGeometry(0.0068, 0.0068, 0.0045, 6)
  head.rotateX(Math.PI / 2)
  head.translate(0, 0, 0.0035)
  const washer = new THREE.CylinderGeometry(0.0095, 0.0095, 0.0012, 28)
  washer.rotateX(Math.PI / 2)
  washer.translate(0, 0, 0.0006)
  const tip = new THREE.CylinderGeometry(0.0045, 0.0045, 0.006, 16)
  tip.rotateX(Math.PI / 2)
  tip.translate(0, 0, 0.0075)
  return join([head.toNonIndexed(), washer.toNonIndexed(), tip.toNonIndexed()])
}
