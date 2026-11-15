import * as THREE from 'three'

// Units are roughly metres. The tiger faces +x, y is up, z is its width.
export const PALETTE = {
  orange: '#f57a0a',
  black: '#352b2b',
  cream: '#f9e7ca',
  nose: '#3a2a2a',
  iris: '#f6a40c',
  toeLine: '#c9b091',
}

const ORANGE = new THREE.Color(PALETTE.orange)
const BLACK = new THREE.Color(PALETTE.black)
const CREAM = new THREE.Color(PALETTE.cream)

export const HIP_Y = 0.7 // height of the shoulder / hip joints
export const KNEE_Y = -0.34 // knee, measured down from the hip

// ---------------------------------------------------------------------------
// Triangle builder. Every triangle gets its own three vertices and one colour,
// so faces shade flat and stripes end exactly on polygon edges.
// ---------------------------------------------------------------------------
const _ab = new THREE.Vector3()
const _ac = new THREE.Vector3()

function makeBuilder() {
  const pos = []
  const col = []
  return {
    // `out` is any vector pointing away from the inside of the shape;
    // the triangle is wound so that its normal agrees with it.
    tri(a, b, c, color, out) {
      _ab.subVectors(b, a)
      _ac.subVectors(c, a)
      if (_ab.cross(_ac).dot(out) < 0) [b, c] = [c, b]
      for (const v of [a, b, c]) {
        pos.push(v.x, v.y, v.z)
        col.push(color.r, color.g, color.b)
      }
    },
    build() {
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
      g.computeVertexNormals()
      return g
    },
  }
}

function centroid(ring) {
  const c = new THREE.Vector3()
  for (const p of ring) c.add(p)
  return c.multiplyScalar(1 / ring.length)
}

// Skin a list of rings (closed loops with the same point count).
// paint(i, k) colours the quad between ring i and i+1 at side k. It returns
// one colour, or two to colour the quad's triangles separately.
// capStart / capEnd are (k) => colour and close the ends with a fan.
function loft(b, rings, paint, { capStart, capEnd } = {}) {
  const n = rings[0].length
  const cents = rings.map(centroid)
  for (let i = 0; i < rings.length - 1; i++) {
    const mid = cents[i].clone().add(cents[i + 1]).multiplyScalar(0.5)
    for (let k = 0; k < n; k++) {
      const k1 = (k + 1) % n
      const a = rings[i][k]
      const b2 = rings[i][k1]
      const c = rings[i + 1][k1]
      const d = rings[i + 1][k]
      const out = a.clone().add(b2).add(c).add(d).multiplyScalar(0.25).sub(mid)
      const colour = paint(i, k)
      const [c1, c2] = Array.isArray(colour) ? colour : [colour, colour]
      b.tri(a, b2, c, c1, out)
      b.tri(a, c, d, c2, out)
    }
  }
  const cap = (ring, cent, out, colourAt) => {
    for (let k = 0; k < n; k++) b.tri(cent, ring[k], ring[(k + 1) % n], colourAt(k), out)
  }
  const last = rings.length - 1
  if (capStart) cap(rings[0], cents[0], cents[0].clone().sub(cents[1]), capStart)
  if (capEnd) cap(rings[last], cents[last], cents[last].clone().sub(cents[last - 1]), capEnd)
}

// Ten-sided cross-section for the body and head, in the y/z plane at x.
// Sides (k): 9 top, 0/8 upper chamfer, 1/7 upper side, 2/6 lower side,
// 3/5 lower chamfer, 4 belly. `lean` shears the ring so stripes tilt.
function ring10(x, yc, hh, hw, { lean = 0, tw = 0.4, bw = 0.4 } = {}) {
  const P = (z, y) => new THREE.Vector3(x + lean * (y - yc), y, z)
  const top = yc + hh
  const up = yc + hh * 0.55
  const low = yc - hh * 0.6
  const bot = yc - hh
  return [
    P(tw * hw, top),
    P(0.9 * hw, up),
    P(hw, yc),
    P(0.8 * hw, low),
    P(bw * hw, bot),
    P(-bw * hw, bot),
    P(-0.8 * hw, low),
    P(-hw, yc),
    P(-0.9 * hw, up),
    P(-tw * hw, top),
  ]
}

// Piecewise-linear profile lookup. Rows are [x, yCentre, halfHeight, halfWidth].
function sample(profile, x) {
  let i = 0
  while (i < profile.length - 2 && x > profile[i + 1][0]) i++
  const a = profile[i]
  const b = profile[i + 1]
  const t = THREE.MathUtils.clamp((x - a[0]) / (b[0] - a[0]), 0, 1)
  return [1, 2, 3].map((j) => a[j] + (b[j] - a[j]) * t)
}

const isBelly = (k) => k >= 3 && k <= 5

// ---------------------------------------------------------------------------
// Body: rump -> hips -> waist -> ribcage -> shoulders -> neck.
// ---------------------------------------------------------------------------
const BODY_PROFILE = [
  [-0.86, 0.81, 0.12, 0.1],
  [-0.74, 0.78, 0.22, 0.21],
  [-0.5, 0.77, 0.25, 0.25],
  [-0.1, 0.76, 0.23, 0.235],
  [0.3, 0.77, 0.26, 0.26],
  [0.58, 0.79, 0.27, 0.25],
  [0.78, 0.86, 0.24, 0.21],
  [0.95, 0.95, 0.2, 0.18],
]

// [x, a stripe starts here, lean]. Each stripe is its own thin ring segment.
const BODY_STATIONS = [
  [-0.86, 0, 0],
  [-0.74, 0, 0],
  [-0.66, 1, -0.14],
  [-0.58, 0, -0.14],
  [-0.42, 1, 0.1],
  [-0.33, 0, 0.1],
  [-0.17, 1, -0.1],
  [-0.09, 0, -0.1],
  [0.07, 1, 0.12],
  [0.16, 0, 0.12],
  [0.31, 1, -0.1],
  [0.39, 0, -0.1],
  [0.53, 1, 0.1],
  [0.6, 0, 0.1],
  [0.78, 0, 0],
  [0.95, 0, 0],
]

export function bodyGeometry() {
  const b = makeBuilder()
  const rings = BODY_STATIONS.map(([x, , lean]) => {
    const [yc, hh, hw] = sample(BODY_PROFILE, x)
    return ring10(x, yc, hh, hw, { lean })
  })
  const paint = (i, k) => {
    if (isBelly(k)) return CREAM
    const chest = BODY_STATIONS[i][0] >= 0.6
    if (!BODY_STATIONS[i][1]) return chest && (k === 2 || k === 6) ? CREAM : ORANGE
    // Stripes run over the back and taper to a point on the lower flank.
    if (k === 2) return [ORANGE, BLACK]
    if (k === 6) return [BLACK, ORANGE]
    return BLACK
  }
  loft(b, rings, paint, { capStart: () => ORANGE, capEnd: () => CREAM })
  return b.build()
}

// ---------------------------------------------------------------------------
// Head (local space: origin at the skull centre, +x out through the face).
// ---------------------------------------------------------------------------
const HEAD_PROFILE = [
  [-0.3, 0.0, 0.17, 0.17],
  [-0.17, 0.02, 0.27, 0.29],
  [0.03, 0.02, 0.285, 0.33],
  [0.15, 0.0, 0.26, 0.3],
  [0.23, -0.005, 0.22, 0.25],
]

const HEAD_STATIONS = [
  [-0.3, 0],
  [-0.17, 0],
  [-0.1, 1],
  [-0.05, 0],
  [0.03, 1],
  [0.08, 0],
  [0.15, 0],
  [0.23, 0],
]

export function headGeometry() {
  const b = makeBuilder()
  const rings = HEAD_STATIONS.map(([x]) => {
    const [yc, hh, hw] = sample(HEAD_PROFILE, x)
    return ring10(x, yc, hh, hw, { tw: 0.5, bw: 0.45 })
  })
  const paint = (i, k) => {
    if (isBelly(k)) return CREAM
    const cheek = k === 2 || k === 6
    const front = i >= 3 // cream cheeks only toward the face
    if (!HEAD_STATIONS[i][1]) return cheek && front ? CREAM : ORANGE
    // Stripes cross the crown and taper to a point. The rear one ends on
    // the temple; the front one runs on down to mark the cheek.
    const taperAt = front ? 2 : 1
    if (k === taperAt) return [front ? CREAM : ORANGE, BLACK]
    if (k === 9 - taperAt) return [BLACK, front ? CREAM : ORANGE]
    if (cheek) return ORANGE
    return BLACK
  }
  const face = (k) => (isBelly(k) || k === 2 || k === 6 ? CREAM : ORANGE)
  loft(b, rings, paint, { capStart: () => ORANGE, capEnd: face })
  return b.build()
}

export function muzzleGeometry() {
  const b = makeBuilder()
  const rings = [
    ring10(0.18, -0.115, 0.1, 0.145),
    ring10(0.31, -0.115, 0.095, 0.125),
    ring10(0.35, -0.105, 0.065, 0.085),
  ]
  loft(b, rings, () => CREAM, { capEnd: () => CREAM })
  return b.build()
}

// ---------------------------------------------------------------------------
// Legs: six-sided tubes running down -y from the joint at the origin.
// Rows are [y, radiusX, radiusZ, xOffset, colour of the segment below].
// ---------------------------------------------------------------------------
function ring6(y, rx, rz, dx) {
  const pts = []
  for (let j = 0; j < 6; j++) {
    const a = Math.PI / 6 + (j * Math.PI) / 3
    pts.push(new THREE.Vector3(dx + rx * Math.cos(a), y, rz * Math.sin(a)))
  }
  return pts
}

const LEG_THICKNESS = 1.22 // chunky, toy-like legs

function legGeometry(rows, capColour) {
  const b = makeBuilder()
  const rings = rows.map(([y, rx, rz, dx]) => ring6(y, rx * LEG_THICKNESS, rz * LEG_THICKNESS, dx))
  loft(b, rings, (i) => rows[i][4], { capEnd: () => capColour })
  return b.build()
}

export function legUpperGeometry(hind) {
  const rows = hind
    ? [
        [0.14, 0.2, 0.13, -0.02, ORANGE],
        [-0.06, 0.18, 0.12, -0.01, ORANGE],
        [-0.14, 0.15, 0.11, 0, BLACK],
        [-0.2, 0.14, 0.105, 0, ORANGE],
        [-0.36, 0.1, 0.088, 0],
      ]
    : [
        [0.12, 0.14, 0.12, 0, ORANGE],
        [-0.08, 0.13, 0.11, 0, ORANGE],
        [-0.15, 0.12, 0.105, 0, BLACK],
        [-0.21, 0.115, 0.1, 0, ORANGE],
        [-0.36, 0.095, 0.085, 0],
      ]
  return legGeometry(rows, ORANGE)
}

// Shin plus the cream paw; the foot sole ends at y = -0.36.
export function legLowerGeometry() {
  return legGeometry(
    [
      [0.02, 0.095, 0.085, 0, ORANGE],
      [-0.07, 0.09, 0.08, 0, BLACK],
      [-0.12, 0.088, 0.078, 0, ORANGE],
      [-0.26, 0.08, 0.074, 0, CREAM],
      [-0.29, 0.105, 0.1, 0.025, CREAM],
      [-0.36, 0.11, 0.105, 0.035],
    ],
    CREAM,
  )
}

// ---------------------------------------------------------------------------
// Small parts built from stock shapes.
// ---------------------------------------------------------------------------

// Four-sided pyramid, flattened front to back, with a flat face forward.
export function earGeometry() {
  const g = new THREE.ConeGeometry(0.17, 0.19, 4)
  g.rotateY(Math.PI / 4)
  g.scale(0.45, 1, 1)
  return g
}

export function tuftGeometry() {
  const g = new THREE.ConeGeometry(0.1, 0.15, 4)
  g.rotateY(Math.PI / 4)
  g.scale(0.55, 1, 1)
  return g
}

// Five-sided tail piece that starts at the origin and runs up +y.
export function tailSegmentGeometry(len, rBase, rTip) {
  const overlap = 0.03 // hides the gap where two pieces bend
  const g = new THREE.CylinderGeometry(rTip, rBase, len + overlap, 5, 1)
  g.translate(0, (len - overlap) / 2, 0)
  return g
}
