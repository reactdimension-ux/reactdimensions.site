import * as THREE from 'three'

// The sword's shapes, in metres. Sword frame: the guard's centre at the
// origin, the blade running down -y, the hilt up +y, the flats facing ±z.

export const BLADE_TOP = -0.012 // tucked under the guard's langet
export const BLADE_L = 0.8
export const tipY = BLADE_TOP - BLADE_L
export const POMMEL_TOP = 0.335

// ---- the blade ----
// s runs 0 at the guard to 1 at the tip. The blade narrows gently, then
// curves to a point over its last 14%; it is thickest down the middle and
// ground to a sharp edge; a fuller runs down three quarters of it.
const TIP_START = 0.86
const tipRound = (s) => (s < TIP_START ? 1 : Math.sqrt(Math.max(0, 1 - ((s - TIP_START) / (1 - TIP_START)) ** 2)))
export const halfWidth = (s) => (0.026 - 0.0075 * Math.min(s, TIP_START) / TIP_START) * tipRound(s)
const thickness = (s) => 0.0034 * (1 - 0.42 * s) * (0.35 + 0.65 * tipRound(s))
function fuller(x, s) {
  const end = 0.74
  if (s > end + 0.03) return 0
  const fw = 0.0078 * (1 - 0.35 * s) * (s > end ? Math.sqrt(Math.max(0, 1 - ((s - end) / 0.03) ** 2)) : 1)
  if (fw <= 0 || Math.abs(x) >= fw) return 0
  // a rounded groove, faded in just below the guard
  return 0.00115 * Math.sqrt(1 - (x / fw) ** 2) * Math.min(1, s / 0.03)
}
// The two flats as separate surfaces that meet at the edges, so the edges
// stay crisp. u runs across (0..1), v down the blade (0 at the guard).
export function bladeGeometry() {
  const NX = 44
  const NY = 260
  const pos = []
  const uv = []
  const idx = []
  for (const side of [1, -1]) {
    const base = pos.length / 3
    for (let i = 0; i <= NY; i++) {
      const s = i / NY
      const y = BLADE_TOP - s * BLADE_L
      const w = Math.max(halfWidth(s), 1e-5)
      const t = thickness(s)
      for (let j = 0; j <= NX; j++) {
        const u = j / NX
        const x = (u * 2 - 1) * w
        const z = Math.max(0, t * Math.pow(1 - Math.abs(x) / w, 0.82) - fuller(x, s))
        pos.push(x, y, side * z)
        uv.push(u, s)
      }
    }
    for (let i = 0; i < NY; i++)
      for (let j = 0; j < NX; j++) {
        const a = base + i * (NX + 1) + j
        const b = a + 1
        const c = a + NX + 1
        const d = c + 1
        if (side > 0) idx.push(a, c, b, b, c, d)
        else idx.push(a, b, c, b, d, c)
      }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

// ---- the guard ----
// A horn: a tube along a curve, tapering to a point and flattened a little.
function taperedTube(points, r0, r1, flat = 0.75, segs = 64, radial = 16) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), false, 'centripetal')
  const frames = curve.computeFrenetFrames(segs, false)
  const pos = []
  const uv = []
  const idx = []
  const P = new THREE.Vector3()
  for (let i = 0; i <= segs; i++) {
    const t = i / segs
    curve.getPointAt(t, P)
    const r = r0 + (r1 - r0) * Math.pow(t, 0.85)
    const N = frames.normals[i]
    const B = frames.binormals[i]
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2
      pos.push(P.x + (N.x * Math.cos(a) + B.x * Math.sin(a) * flat) * r, P.y + (N.y * Math.cos(a) + B.y * Math.sin(a) * flat) * r, P.z + (N.z * Math.cos(a) + B.z * Math.sin(a) * flat) * r)
      uv.push(t * 2, j / radial)
    }
  }
  for (let i = 0; i < segs; i++)
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j
      const b = a + radial + 1
      idx.push(a, b, a + 1, b, b + 1, a + 1)
    }
  // close the root
  const c0 = pos.length / 3
  curve.getPointAt(0, P)
  pos.push(P.x, P.y, P.z)
  uv.push(0, 0.5)
  for (let j = 0; j < radial; j++) idx.push(c0, j + 1, j)
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}
const mirrorX = (pts) => pts.map(([x, y, z]) => [-x, y, z])
export function guardGeometries() {
  // the big quillons: out from the block and curving down toward the blade
  const main = [
    [0.026, 0.006, 0],
    [0.058, 0.009, 0],
    [0.088, -0.003, 0.002],
    [0.107, -0.03, 0.005],
    [0.113, -0.064, 0.009],
  ]
  // small horns sweeping up beside the grip
  const upper = [
    [0.022, 0.03, 0],
    [0.043, 0.044, -0.002],
    [0.06, 0.066, -0.004],
    [0.066, 0.089, -0.007],
  ]
  // barbs below, beside the langet
  const barb = [
    [0.017, -0.026, 0],
    [0.031, -0.048, 0.001],
    [0.037, -0.078, 0.003],
  ]
  const horns = []
  for (const pts of [main, mirrorX(main)]) horns.push(taperedTube(pts, 0.0088, 0.0011, 0.72))
  for (const pts of [upper, mirrorX(upper)]) horns.push(taperedTube(pts, 0.0056, 0.0009, 0.8))
  for (const pts of [barb, mirrorX(barb)]) horns.push(taperedTube(pts, 0.0042, 0.0007, 0.8))

  // the block: a shield shape that runs down over the blade as a langet
  const pts = [
    [0, 0.05],
    [0.017, 0.048],
    [0.036, 0.024],
    [0.04, 0.0],
    [0.033, -0.022],
    [0.016, -0.05],
    [0, -0.068],
    [-0.016, -0.05],
    [-0.033, -0.022],
    [-0.04, 0.0],
    [-0.036, 0.024],
    [-0.017, 0.048],
  ]
  const curve = new THREE.CatmullRomCurve3(
    pts.map(([x, y]) => new THREE.Vector3(x, y, 0)),
    true,
    'centripetal',
  )
  const shape = new THREE.Shape(curve.getSpacedPoints(120).map((p) => new THREE.Vector2(p.x, p.y)))
  const block = new THREE.ExtrudeGeometry(shape, { depth: 0.016, bevelEnabled: true, bevelThickness: 0.0045, bevelSize: 0.004, bevelSegments: 5, curveSegments: 24 })
  block.translate(0, 0, -0.008)
  // the medallion on each face: a domed boss
  const boss = new THREE.LatheGeometry(
    [
      [0, 0.0065],
      [0.008, 0.0062],
      [0.014, 0.0048],
      [0.0175, 0.0026],
      [0.0188, 0.001],
      [0.0188, 0],
      [0, 0],
    ].map(([r, y]) => new THREE.Vector2(r, y)),
    48,
  ).rotateX(Math.PI / 2)
  // flat UVs across its face, for the chased pattern
  const bp = boss.attributes.position
  const buv = boss.attributes.uv
  for (let i = 0; i < bp.count; i++) buv.setXY(i, bp.getX(i) / 0.04 + 0.5, bp.getY(i) / 0.04 + 0.5)
  // a raised rim following the block's outline, just inside its edge
  const rimCurve = new THREE.CatmullRomCurve3(
    curve.getSpacedPoints(120).map((p) => new THREE.Vector3(p.x * 0.8, p.y * 0.8 - 0.002, 0)),
    true,
  )
  const rim = new THREE.TubeGeometry(rimCurve, 160, 0.0013, 8, true)
  return { horns, block, rim, boss }
}

// ---- the hilt ----
// The grip: wire-bound in raised rings over its length, swelling slightly
// in the middle where the hand sits.
export function gripGeometry() {
  const pts = []
  const y0 = 0.05
  const y1 = 0.232
  const rings = 9
  for (let i = 0; i <= 260; i++) {
    const y = y0 + ((y1 - y0) * i) / 260
    const t = (y - y0) / (y1 - y0)
    const swell = 0.0135 + 0.0018 * Math.sin(Math.PI * t)
    const ring = Math.pow(Math.abs(Math.sin(Math.PI * t * rings)), 0.6)
    pts.push(new THREE.Vector2(swell + 0.0028 * ring, y))
  }
  return new THREE.LatheGeometry(pts, 48)
}
// ferrules, the collars at each end of the grip
export function ferruleGeometry() {
  return new THREE.LatheGeometry(
    [
      [0.0145, -0.008],
      [0.019, -0.0065],
      [0.0205, -0.003],
      [0.0205, 0.003],
      [0.019, 0.0065],
      [0.0145, 0.008],
    ].map(([r, y]) => new THREE.Vector2(r, y)),
    48,
  )
}
// the pommel: a ringed finial rising to a four-sided spike
export function pommelGeometry() {
  const prof = [
    [0.0001, 0.236],
    [0.016, 0.236],
    [0.0185, 0.242],
    [0.013, 0.248],
    [0.019, 0.258],
    [0.022, 0.268],
    [0.019, 0.278],
    [0.012, 0.284],
    [0.0165, 0.29],
    [0.0165, 0.295],
    [0.009, 0.3],
    [0.0001, 0.301],
  ].map(([r, y]) => new THREE.Vector2(r, y))
  const body = new THREE.LatheGeometry(prof, 48)
  const spike = new THREE.ConeGeometry(0.0085, 0.036, 4).translate(0, 0.299 + 0.018, 0)
  return { body, spike }
}
