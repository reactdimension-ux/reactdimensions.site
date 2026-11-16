import * as THREE from 'three'

// Every mesh of the Polygon Lion is made here from numbers: deformed
// icosahedra, tapered cylinders, tubes along curves and a few hand-placed
// triangles. No model files, no image textures.
//
// The lion faces +x, stands on y = 0 and its right side is +z. Parts are
// built in the coordinates they sit at, so a mesh needs no transform of its
// own; only the leg, head and tail groups move (about their pivots).

export const PALETTES = {
  golden: {
    body: '#D9A441', bodyHi: '#E9BD68', bodyLo: '#B9852F', belly: '#EBCB97',
    mane: '#A85E20', maneHi: '#D18A35', maneLo: '#713B1B',
    muzzle: '#E8C69B', nose: '#30231F', eyes: '#B67A25', paws: '#B87B35', tail: '#382319', ear: '#4a2e20', line: '#2a1d18',
  },
  dark: {
    body: '#C99238', bodyHi: '#DDAE5E', bodyLo: '#A5752A', belly: '#E3C08A',
    mane: '#5E3018', maneHi: '#8A4A22', maneLo: '#33180D',
    muzzle: '#E4C094', nose: '#2a1e1a', eyes: '#B67A25', paws: '#A86F2E', tail: '#24150f', ear: '#3a2218', line: '#22160f',
  },
  blond: {
    body: '#E0B25A', bodyHi: '#F0CC84', bodyLo: '#C39443', belly: '#F2DAB0',
    mane: '#C98B3C', maneHi: '#E8B566', maneLo: '#8C5A27',
    muzzle: '#F0D6AE', nose: '#3a2a24', eyes: '#B67A25', paws: '#C28B45', tail: '#4a3020', ear: '#5a3a28', line: '#2e2019',
  },
}

const V = (x, y, z) => new THREE.Vector3(x, y, z)
const UP = V(0, 1, 0)
const clamp01 = (x) => Math.max(0, Math.min(1, x))
export const bump = (t, c, w) => Math.exp(-(((t - c) / w) ** 2))

// a hash of a position, so duplicated vertices of a non-indexed mesh always
// move together (the mesh never tears)
const hash3 = (x, y, z) => {
  const s = Math.sin(Math.round(x * 1e4) * 12.9898 + Math.round(y * 1e4) * 78.233 + Math.round(z * 1e4) * 37.719) * 43758.5453
  return s - Math.floor(s)
}
export function rng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// An icosahedron of the given detail with every vertex passed through fn
// (which gets the unit-sphere point and moves it in place).
function ico(detail, fn) {
  const g = new THREE.IcosahedronGeometry(1, detail)
  const p = g.attributes.position
  const v = new THREE.Vector3()
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i)
    fn(v, hash3(v.x, v.y, v.z))
    p.setXYZ(i, v.x, v.y, v.z)
  }
  return g
}

// An ellipsoid blob: radii r, centre c, optional rotation (Euler, radians),
// and a little faceting jitter so it reads as cut, not turned.
export function blob(detail, r, c, { rot, jitter = 0.05, shape } = {}) {
  const q = rot ? new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)) : null
  return ico(detail, (v, h) => {
    if (shape) shape(v)
    v.multiplyScalar(1 + (h - 0.5) * jitter)
    v.set(v.x * r[0], v.y * r[1], v.z * r[2])
    if (q) v.applyQuaternion(q)
    v.add(c)
  })
}

// A tapered cylinder from a (radius ra) to b (radius rb).
function segment(a, b, ra, rb, sides = 7) {
  const d = new THREE.Vector3().subVectors(b, a)
  const len = d.length()
  const g = new THREE.CylinderGeometry(rb, ra, len, sides, 1, false)
  g.translate(0, len / 2, 0)
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, d.normalize()))
  g.translate(a.x, a.y, a.z)
  return g
}

// Joins geometries into one non-indexed, position-only geometry.
export function merge(list) {
  const parts = list.map((g) => (g.index ? g.toNonIndexed() : g))
  const n = parts.reduce((s, g) => s + g.attributes.position.count, 0)
  const out = new Float32Array(n * 3)
  let o = 0
  for (const g of parts) {
    out.set(g.attributes.position.array, o)
    o += g.attributes.position.array.length
  }
  const m = new THREE.BufferGeometry()
  m.setAttribute('position', new THREE.BufferAttribute(out, 3))
  return m
}

// Makes a geometry faceted: one normal and one colour per triangle. colour()
// gets (out colour, triangle centre, face normal, triangle index).
export function facet(geo, colour) {
  const g = geo.index ? geo.toNonIndexed() : geo
  for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k)
  const p = g.attributes.position
  const nor = new Float32Array(p.count * 3)
  const col = new Float32Array(p.count * 3)
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3()
  const n = new THREE.Vector3(), m = new THREE.Vector3(), out = new THREE.Color()
  for (let i = 0; i < p.count; i += 3) {
    a.fromBufferAttribute(p, i)
    b.fromBufferAttribute(p, i + 1)
    c.fromBufferAttribute(p, i + 2)
    n.subVectors(c, b).cross(m.subVectors(a, b)).normalize()
    m.copy(a).add(b).add(c).divideScalar(3)
    colour(out, m, n, i / 3)
    for (let k = 0; k < 3; k++) {
      nor.set([n.x, n.y, n.z], (i + k) * 3)
      col.set([out.r, out.g, out.b], (i + k) * 3)
    }
  }
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3))
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  g.computeBoundingSphere()
  return g
}

// A colouring rule for facet(): lit faces lean toward the highlight, faces
// turned down toward the shadow tone, an optional cream underside below
// `below`, and a small per-face jitter in lightness.
export function tone(base, hi, lo, { cream, below = -1, fade = 0.15, jitter = 0.05, seed = 1, warm = 0 } = {}) {
  const B = new THREE.Color(base), H = new THREE.Color(hi), L = new THREE.Color(lo)
  const C = cream ? new THREE.Color(cream) : null
  const r = rng(seed)
  return (out, ctr, n) => {
    out.copy(B)
    const up = n.y + warm * n.x
    if (up > 0) out.lerp(H, Math.min(1, up) * 0.65)
    else out.lerp(L, Math.min(1, -up) * 0.55)
    if (C && ctr.y < below) out.lerp(C, clamp01((below - ctr.y) / fade) * 0.75)
    out.offsetHSL(0, 0, (r() - 0.5) * jitter)
  }
}
const solid = (hex, jitter = 0.03, seed = 3) => tone(hex, hex, hex, { jitter, seed })

// ---------------------------------------------------------------- body ----

// The torso: one icosphere sculpted into a deep-chested, waisted cat body,
// shoulder blades and a slight dip behind them, a tucked belly toward the
// hind legs.
export function torsoGeometry(P) {
  const g = ico(3, (v, h) => {
    const t = v.x // -1 rump .. 1 chest
    const waist = bump(t, -0.2, 0.42)
    let ry = v.y > 0 ? 0.36 + 0.05 * t : 0.37 + 0.07 * t - 0.09 * waist
    let rz = 0.3 + 0.045 * t - 0.045 * waist
    let x = v.x * 0.98
    let y = v.y * ry
    let z = v.z * rz
    if (v.y > 0) y += (0.05 * bump(t, 0.55, 0.22) - 0.035 * bump(t, 0.05, 0.35)) * v.y // withers, then the back dips
    y += (h - 0.5) * 0.02
    v.set(x, y + 0.98, z)
  })
  return facet(g, tone(P.body, P.bodyHi, P.bodyLo, { cream: P.belly, below: 0.8, fade: 0.2, seed: 11 }))
}

// Haunches: the big rounded thigh muscle on each side over the hind legs.
export function haunchGeometry(P) {
  const parts = [1, -1].map((s) => blob(2, [0.37, 0.4, 0.16], V(-0.6, 0.9, 0.17 * s), { rot: [0, 0, 0.25] }))
  return facet(merge(parts), tone(P.body, P.bodyHi, P.bodyLo, { cream: P.belly, below: 0.66, seed: 12 }))
}

// The chest and the shoulders, the front of the body under the mane.
export function chestGeometry(P) {
  const parts = [
    blob(2, [0.43, 0.47, 0.37], V(0.66, 0.9, 0), { shape: (v) => v.y < 0 && (v.x *= 0.85) }),
    ...[1, -1].map((s) => blob(2, [0.3, 0.36, 0.15], V(0.58, 0.86, 0.2 * s), { rot: [0, 0, -0.25] })),
  ]
  return facet(merge(parts), tone(P.body, P.bodyHi, P.bodyLo, { cream: P.belly, below: 0.62, seed: 13 }))
}

// ---------------------------------------------------------------- legs ----

// Each leg is a chain of tapered cylinders with a faceted joint at every
// bend, built relative to its hip so its group can swing about the hip.
// Points are given in model space; hip is the first.
export const LEGS = [
  // front: shoulder, elbow, wrist, foot
  { key: 'fl', front: true, side: -1, pts: [[0.6, 0.92], [0.55, 0.5], [0.6, 0.17], [0.66, 0.07]], r: [0.15, 0.11, 0.075, 0.07], z: 0.2 },
  { key: 'fr', front: true, side: 1, pts: [[0.6, 0.92], [0.55, 0.5], [0.6, 0.17], [0.66, 0.07]], r: [0.15, 0.11, 0.075, 0.07], z: 0.2 },
  // hind: hip, stifle, hock, foot
  { key: 'hl', front: false, side: -1, pts: [[-0.62, 0.96], [-0.47, 0.58], [-0.75, 0.3], [-0.68, 0.11], [-0.64, 0.07]], r: [0.19, 0.12, 0.08, 0.068, 0.066], z: 0.19 },
  { key: 'hr', front: false, side: 1, pts: [[-0.62, 0.96], [-0.47, 0.58], [-0.75, 0.3], [-0.68, 0.11], [-0.64, 0.07]], r: [0.19, 0.12, 0.08, 0.068, 0.066], z: 0.19 },
]
export const legHip = (L) => V(L.pts[0][0], L.pts[0][1], L.z * L.side)

export function legGeometry(L, P) {
  const hip = legHip(L)
  const pts = L.pts.map(([x, y], i) => V(x, y, L.z * L.side + (i === 1 ? 0.012 * L.side : 0)).sub(hip))
  const parts = []
  for (let i = 0; i < pts.length - 1; i++) parts.push(segment(pts[i], pts[i + 1], L.r[i], L.r[i + 1]))
  for (let i = 1; i < pts.length - 1; i++) parts.push(blob(1, [L.r[i] * 1.05, L.r[i] * 1.05, L.r[i] * 1.05], pts[i], { jitter: 0.08 }))
  // the upper limb's muscle: a long blob down the front of the forearm / the
  // back of the thigh so it is not a plain cone
  if (L.front) parts.push(blob(1, [0.1, 0.24, 0.1], pts[0].clone().lerp(pts[1], 0.45).add(V(0.03, 0, 0)), { rot: [0, 0, 0.12] }))
  else parts.push(blob(1, [0.14, 0.26, 0.12], pts[0].clone().lerp(pts[1], 0.5).add(V(-0.03, 0, 0)), { rot: [0, 0, -0.4] }))
  return facet(merge(parts), tone(P.body, P.bodyHi, P.bodyLo, { cream: P.belly, below: -0.35, seed: 20 + L.side }))
}

// A broad paw flat on the ground: a pad, four toes split by small gaps,
// relative to the leg's hip like the leg itself.
export function pawGeometry(L, P) {
  const hip = legHip(L)
  const [fx] = L.pts[L.pts.length - 1]
  const c = V(fx + 0.03, 0, L.z * L.side).sub(hip)
  const flat = (v) => (v.y = Math.max(v.y, -0.55)) // flat sole
  const parts = [blob(1, [0.12, 0.075, 0.105], c.clone().add(V(-0.02, 0.06, 0)), { shape: flat })]
  for (let k = 0; k < 4; k++) {
    const a = (k - 1.5) * 0.42
    const o = V(Math.cos(a) * 0.085, 0.037, Math.sin(a) * 0.08)
    parts.push(blob(1, [0.042, 0.04, 0.034], c.clone().add(o), { shape: flat, rot: [0, -a, 0] }))
  }
  const g = merge(parts)
  // sit the sole exactly on the ground
  g.computeBoundingBox()
  g.translate(0, -hip.y - g.boundingBox.min.y, 0)
  return facet(g, tone(P.paws, P.body, P.bodyLo, { seed: 30 }))
}

// ---------------------------------------------------------------- head ----
// Head parts are in the head's own frame: its centre at the origin, facing +x.

export function craniumGeometry(P) {
  const parts = [
    // skull: broad, flat-topped forehead
    blob(2, [0.25, 0.235, 0.255], V(0, 0.045, 0), { shape: (v) => v.y > 0 && (v.y *= 0.88) }),
    // cheeks: the wide jowls that make a lion's face square
    ...[1, -1].map((s) => blob(1, [0.15, 0.13, 0.12], V(0.13, -0.06, 0.13 * s))),
    // the bridge of the nose sloping down to the nose
    blob(1, [0.2, 0.072, 0.092], V(0.23, 0.02, 0), { rot: [0, 0, -0.28] }),
    // the snout under it
    blob(1, [0.16, 0.12, 0.15], V(0.24, -0.075, 0)),
  ]
  return facet(merge(parts), tone(P.body, P.bodyHi, P.bodyLo, { seed: 40, warm: 0.2 }))
}

export function muzzleGeometry(P) {
  const parts = [
    // the two whisker pads
    ...[1, -1].map((s) => blob(1, [0.1, 0.08, 0.095], V(0.33, -0.105, 0.07 * s))),
    // the chin
    blob(1, [0.11, 0.06, 0.1], V(0.275, -0.19, 0)),
  ]
  const g = facet(merge(parts), tone(P.muzzle, '#f6e2c4', P.belly, { seed: 41, jitter: 0.03 }))
  // whisker spots: darken a few pad facets
  const col = g.attributes.color
  const pos = g.attributes.position
  const r = rng(7)
  for (let i = 0; i < pos.count; i += 3) {
    const x = pos.getX(i), y = pos.getY(i), z = Math.abs(pos.getZ(i))
    if (x > 0.37 && y > -0.15 && y < -0.08 && z > 0.06 && r() < 0.35) for (let k = 0; k < 3; k++) col.setXYZ(i + k, col.getX(i) * 0.72, col.getY(i) * 0.68, col.getZ(i) * 0.64)
  }
  return g
}

// The nose: an inverted triangle with a bevelled top that runs back up the
// bridge, built triangle by triangle.
export function noseGeometry(P) {
  const w = 0.058
  const T0 = V(0.4, 0.0, -w), T1 = V(0.4, 0.0, w) // top edge, front
  const B = V(0.418, -0.06, 0) // bottom point
  const K0 = V(0.33, 0.045, -w * 0.55), K1 = V(0.33, 0.045, w * 0.55) // back up the bridge
  const S0 = V(0.37, -0.03, -w * 0.9), S1 = V(0.37, -0.03, w * 0.9) // sides, tucked back
  const tris = [
    [T0, B, T1], // front face
    [T0, T1, K1], [T0, K1, K0], // top bevel
    [T0, S0, B], [T1, B, S1], // nostril flanks
    [T0, K0, S0], [T1, S1, K1],
    [S0, K0, K1], [S0, K1, S1], [S0, S1, B], // underside
  ]
  const a = new Float32Array(tris.length * 9)
  tris.forEach((t, i) => t.forEach((v, k) => a.set([v.x, v.y, v.z], i * 9 + k * 3)))
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(a, 3))
  return facet(g, tone(P.nose, '#5a4038', P.nose, { jitter: 0.02 }))
}

// The mouth: a dark line from under the nose that splits and curves down and
// out along the bottoms of the whisker pads.
export function mouthGeometry(P) {
  const parts = [1, -1].map((s) => {
    const c = new THREE.CatmullRomCurve3([V(0.418, -0.06, 0), V(0.412, -0.12, 0.004 * s), V(0.398, -0.162, 0.055 * s), V(0.36, -0.172, 0.105 * s), V(0.31, -0.155, 0.14 * s)])
    return new THREE.TubeGeometry(c, 14, 0.0085, 4, false)
  })
  return facet(merge(parts), solid(P.line, 0.01))
}

export function earGeometry(P) {
  const outer = []
  const inner = []
  for (const s of [1, -1]) {
    const rot = [0.55 * s, -0.35 * s, 0]
    const half = (v) => (v.y = v.y < -0.3 ? -0.3 : v.y) // a flat base sunk in the head
    outer.push(blob(1, [0.04, 0.09, 0.08], V(-0.01, 0.255, 0.19 * s), { rot, shape: half }))
    inner.push(blob(1, [0.02, 0.062, 0.054], V(0.022, 0.255, 0.185 * s), { rot, shape: half }))
  }
  return {
    outer: facet(merge(outer), tone(P.body, P.bodyHi, P.maneLo, { seed: 50 })),
    inner: facet(merge(inner), tone(P.ear, P.ear, '#1e120c', { seed: 51 })),
  }
}

// Eyes: a dark socket, the amber iris turned a little outward, a round pupil
// and a catch-light, with a heavy brow ridge over each.
export const EYES = [1, -1].map((s) => ({ s, at: V(0.24, 0.072, 0.118 * s), yaw: 0.42 * s }))
export function eyeGeometry(P) {
  const socket = []
  const brow = []
  for (const { s, at } of EYES) {
    socket.push(blob(1, [0.035, 0.036, 0.056], at.clone().add(V(-0.012, 0, 0)), { rot: [0, -0.42 * s, 0.1 * s] }))
    brow.push(blob(1, [0.065, 0.024, 0.05], at.clone().add(V(-0.005, 0.045, 0.012 * s)), { rot: [-0.3 * s, -0.35 * s, 0.12] }))
    // the dark tear line running down from the inner corner
    brow.push(blob(0, [0.012, 0.04, 0.012], at.clone().add(V(0.035, -0.045, -0.035 * s)), { rot: [0.2 * s, 0, -0.5] }))
  }
  return {
    socket: facet(merge(socket), solid('#3b2418', 0.02)),
    brow: facet(merge(brow.slice(0, 1).concat(brow.slice(2, 3))), tone(P.bodyHi, '#f3d59a', P.body, { seed: 60 })),
    tear: facet(merge([brow[1], brow[3]]), solid(P.line, 0.02)),
    iris: new THREE.IcosahedronGeometry(1, 2).scale(0.42, 1, 1),
    pupil: new THREE.IcosahedronGeometry(1, 1).scale(0.3, 1, 1),
  }
}

// ---------------------------------------------------------------- mane ----

// One tuft: a five-sided spike, thick at its root at the origin and pointed
// at y = 1. It is instanced 40-odd times with its own size, turn and shade.
export function tuftGeometry() {
  const g = ico(0, (v) => {
    const u = (v.y + 1) / 2 // 0 root .. 1 tip
    const w = (1 - u ** 0.9 * 0.93) * (u < 0.15 ? 0.7 + u * 2 : 1)
    v.set(v.x * w, u, v.z * w)
  })
  return g
}

// The mane's solid core: a deep ruff round the back of the head and down the
// neck into the chest, so the tufts grow out of one mass and never float.
export function maneCoreGeometry(P) {
  const parts = [
    blob(2, [0.3, 0.5, 0.49], V(-0.12, -0.03, 0), { jitter: 0.1 }),
    blob(2, [0.42, 0.42, 0.37], V(-0.38, -0.26, 0), { jitter: 0.1 }),
    blob(1, [0.24, 0.3, 0.3], V(-0.05, -0.36, 0), { jitter: 0.12 }),
  ]
  return facet(merge(parts), tone(P.mane, P.maneHi, P.maneLo, { seed: 70, jitter: 0.1 }))
}

// Where every tuft goes, in the head's frame. Rings around the face (the
// angle a is around the x axis: 0 is up, +pi/2 is the lion's right), a back
// layer over the neck, and a bib hanging under the chin.
export function maneLayout(P) {
  const r = rng(91)
  const out = []
  const pal = [P.maneLo, P.mane, P.maneHi]
  const add = (base, dir, len, wid, shade) => out.push({ base, dir: dir.normalize(), len, wid, roll: r() * Math.PI * 2, col: new THREE.Color(pal[shade]).offsetHSL(0, 0, (r() - 0.5) * 0.06) })
  const ring = (a) => V(0, Math.cos(a), Math.sin(a))
  // the outer ring: the big silhouette, pointed tufts swept back
  for (let k = 0; k < 18; k++) {
    const a = (k / 18) * Math.PI * 2 + (r() - 0.5) * 0.15
    const low = Math.max(0, -Math.cos(a)) // longer under the chin
    add(V(-0.12, -0.02, 0).addScaledVector(ring(a), 0.36), ring(a).add(V(-0.45, -0.25 * low, 0)), 0.3 + r() * 0.08 + low * 0.08, 0.15 + r() * 0.03, r() < 0.35 ? 0 : 1)
  }
  // the inner ring framing the face, lighter, a little forward; it leaves gaps for the ears
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * Math.PI * 2 + 0.11
    const nearEar = Math.min(Math.abs(a - 0.72), Math.abs(a - (Math.PI * 2 - 0.72)))
    if (nearEar < 0.32) continue
    add(V(0.0, -0.03, 0).addScaledVector(ring(a), 0.27), ring(a).add(V(0.12, 0, 0)), 0.2 + r() * 0.06, 0.12 + r() * 0.02, r() < 0.6 ? 2 : 1)
  }
  // the back layer down the neck to the shoulders
  for (let k = 0; k < 11; k++) {
    const a = (k / 11) * Math.PI * 2 + 0.2
    add(V(-0.36, -0.12, 0).addScaledVector(ring(a), 0.3), ring(a).multiplyScalar(0.8).add(V(-0.7, -0.15, 0)), 0.3 + r() * 0.07, 0.15, r() < 0.5 ? 0 : 1)
  }
  // a tuft on the crown between the ears
  add(V(-0.02, 0.27, 0), V(-0.2, 1, 0), 0.16, 0.1, 2)
  add(V(-0.1, 0.3, 0.08), V(-0.5, 1, 0.3), 0.18, 0.11, 1)
  add(V(-0.1, 0.3, -0.08), V(-0.5, 1, -0.3), 0.18, 0.11, 1)
  // the bib under the chin, hanging over the chest
  for (let k = 0; k < 6; k++) {
    const s = k % 2 ? 1 : -1
    const j = Math.floor(k / 2)
    add(V(-0.04 - j * 0.12, -0.42 - j * 0.03, s * (0.08 + j * 0.03)), V(0.1, -1, s * 0.25), 0.22 + j * 0.03, 0.12, j === 0 ? 1 : 0)
  }
  return out
}

// ---------------------------------------------------------------- tail ----
// Built from its root (inside the rump) so its group can sway about it.

export const TAIL_ROOT = V(-0.9, 1.06, 0)

export function tailGeometry(P) {
  const curve = new THREE.CatmullRomCurve3([V(0, 0, 0), V(-0.26, -0.03, 0), V(-0.5, -0.22, 0.03), V(-0.62, -0.5, 0.06), V(-0.6, -0.7, 0.1), V(-0.5, -0.8, 0.14)])
  const N = 40
  const R = 5
  const g = new THREE.TubeGeometry(curve, N, 1, R, false)
  // taper: TubeGeometry lays rings of R+1 vertices at curve.getPointAt(i/N)
  const p = g.attributes.position
  const c = new THREE.Vector3()
  const v = new THREE.Vector3()
  for (let i = 0; i <= N; i++) {
    curve.getPointAt(i / N, c)
    const rad = 0.052 - 0.026 * (i / N)
    for (let j = 0; j <= R; j++) {
      const k = i * (R + 1) + j
      v.fromBufferAttribute(p, k).sub(c).multiplyScalar(rad).add(c)
      p.setXYZ(k, v.x, v.y, v.z)
    }
  }
  const tube = facet(g, tone(P.body, P.bodyHi, P.bodyLo, { seed: 80 }))
  // the tuft: dark spikes fanned around the tip, plus a solid knot
  const end = curve.getPointAt(1)
  const tan = curve.getTangentAt(1)
  const r = rng(5)
  const spikes = [blob(1, [0.06, 0.06, 0.06], end.clone().addScaledVector(tan, 0.02), { jitter: 0.2 })]
  const tuft = tuftGeometry()
  for (let k = 0; k < 9; k++) {
    const d = tan.clone().add(V(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(k ? 1.3 : 0.2)).normalize()
    const s = tuft.clone()
    const len = 0.13 + r() * 0.07
    s.scale(0.055, len, 0.045)
    s.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, d))
    s.translate(end.x - tan.x * 0.03, end.y - tan.y * 0.03, end.z - tan.z * 0.03)
    spikes.push(s)
  }
  return { tube, tuft: facet(merge(spikes), tone(P.tail, '#5a3a2a', '#1a0f0a', { seed: 81, jitter: 0.06 })), end }
}
