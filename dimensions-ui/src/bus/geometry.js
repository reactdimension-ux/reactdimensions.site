import * as THREE from 'three'
import { grid, join, loft, profile, smooth, tyreGeometry } from '../airliner/geometry.js'
import { hull } from '../helicopter/geometry.js'

// Every surface of the city bus, built from its dimensions: a 12 m low-floor
// single-decker, 2.55 m wide and 3.15 m to the roof, with three plug doors
// on its right-hand side. The mesh helpers are the airliner's and the shell
// is one of the helicopter's superelliptic hulls. Units are metres. As with
// the aircraft, x (the station s) runs aft from the front of the shell, y is
// up from the ground and +z is the left-hand side; the doors are on the right
// (-z). The front and rear faces are built separately so each can carry its
// own flat drawing.

export const LENGTH = 12.0 // the shell; the faces add their bulge either end
export const HALF = 1.275
export const ROOF = 3.15
export const SKIRT = 0.34
export const FLOOR = 0.4 // the low floor
export const FLOOR_REAR = 0.76 // the raised floor over the engine and the rear axle
export const STEP_X = 8.1
export const AXLES = { front: 2.75, rear: 8.75 }
export const WHEEL = { R: 0.51, W: 0.3, zOuter: 1.08, zInner: 0.76 }
export const ARCH_R = 0.64
export const WINDOW = { y0: 1.5, y1: 2.78 }
export const DOORS = [
  { x0: 0.72, x1: 1.78 },
  { x0: 5.55, x1: 6.95 },
  { x0: 9.65, x1: 10.95 },
]
export const DOOR_TOP = 2.78
export const UNDER = { x0: 0.6, x1: 11.4, z: 1.05, y: 0.52 } // the floor pan over the open underside
export { smooth, tyreGeometry }

const lerp = (a, b, t) => a + (b - a) * t
const V = (x, y, z) => new THREE.Vector3(x, y, z)

// ---------------------------------------------------------------- the shell
export const shell = hull({
  top: profile([[0, ROOF], [LENGTH, ROOF]]),
  bot: profile([[0, SKIRT], [LENGTH, SKIRT]]),
  waist: profile([[0, 1.7], [LENGTH, 1.7]]),
  beam: profile([[0, HALF], [LENGTH, HALF]]),
  sq: profile([[0, 6.5], [LENGTH, 6.5]]),
  sqLo: profile([[0, 10], [LENGTH, 10]]),
})

export function shellGeometry() {
  const st = []
  for (let k = 0; k <= 120; k++) st.push((LENGTH * k) / 120)
  return grid(
    st.length,
    161,
    (i, j, P, U) => {
      shell.point(st[i], (j / 160) * Math.PI * 2, 0, P)
      U.set(st[i] / LENGTH, j / 160)
    },
    { wrap: true },
  )
}

// The front or rear face: the shell's end ring drawn in through rounded
// corners to a gently bulged, raked panel. Its uvs are the face seen square
// on (u across from the left, v up), for the drawing of the windscreen and
// the lamps, or the engine door.
export const FACE = { depth: 0.32, rake: 0.1 }
export function faceGeometry(front) {
  const s = front ? 0 : LENGTH
  const dir = front ? -1 : 1
  const N = 160
  const cy = (ROOF + SKIRT) / 2
  const rows = []
  const ks = [1, 0.97, 0.9, 0.78, 0.6, 0.36, 0.0]
  for (let r = 0; r < ks.length; r++) {
    const k = ks[r]
    const row = []
    const push = (1 - k) ** 0.55 * FACE.depth
    for (let j = 0; j <= N; j++) {
      const p = shell.point(s, (j / N) * Math.PI * 2, 0)
      const y = cy + (p.y - cy) * k
      const z = p.z * k
      // the top leans back a little, so the windscreen is raked
      const x = s + dir * (push - FACE.rake * ((y - cy) / (ROOF - cy)) * (1 - k) * 0.5)
      row.push({ p: V(x, y, z), u: 0.5 - (dir * z) / (2 * HALF), v: (y - SKIRT) / (ROOF - SKIRT) })
    }
    rows.push(row)
  }
  // the end panel faces out from the shell: forward for the front, aft for the rear
  return loft(rows, { flip: front })
}
// where a point of the face drawing lands in space: u across (0 left as seen), v up
export function facePoint(front, u, v) {
  const z = (0.5 - u) * 2 * HALF * (front ? -1 : 1)
  const y = SKIRT + v * (ROOF - SKIRT)
  const cy = (ROOF + SKIRT) / 2
  const k = Math.max(Math.abs(z) / HALF, Math.abs(y - cy) / (ROOF - cy))
  const push = (1 - Math.min(1, k)) ** 0.55 * FACE.depth
  const x = (front ? 0 : LENGTH) + (front ? -1 : 1) * (push - FACE.rake * ((y - cy) / (ROOF - cy)) * (1 - Math.min(1, k)) * 0.5)
  return V(x, y, z)
}

// ---------------------------------------------------------------- openings
// A wheel arch: the half tube behind the opening and the wall at its inner end.
export function archGeometry() {
  const N = 40
  const zOut = HALF + 0.02
  const zIn = 0.62
  const ring = (z) => {
    const row = []
    for (let j = 0; j <= N; j++) {
      const a = Math.PI * (j / N)
      row.push({ p: V(Math.cos(a) * ARCH_R, WHEEL.R + Math.sin(a) * ARCH_R, z), u: j / N, v: z })
    }
    return row
  }
  const tube = loft([ring(zOut), ring(zIn)], { flip: true })
  const inner = ring(zIn)
  inner.push({ p: V(-ARCH_R, SKIRT - 0.02, zIn) }, { p: V(ARCH_R, SKIRT - 0.02, zIn) })
  const c = V(0, WHEEL.R, zIn)
  const wall = loft([inner.map(() => ({ p: c })), inner])
  // the end plates, from the ends of the arch down to the skirt, so the well is closed
  const plate = (x, back) =>
    loft(
      [
        [{ p: V(x, WHEEL.R, zOut) }, { p: V(x, WHEEL.R, zIn) }],
        [{ p: V(x, SKIRT - 0.02, zOut) }, { p: V(x, SKIRT - 0.02, zIn) }],
      ],
      { flip: back },
    )
  return join([tube, wall, plate(ARCH_R, true), plate(-ARCH_R, false)])
}

// a steel wheel: the dish with its hand holes, and the nuts round the hub
export function rimGeometry(R, W) {
  const shape = new THREE.Shape()
  shape.absarc(0, 0, R - 0.004, 0, Math.PI * 2, false)
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2
    const hole = new THREE.Path()
    hole.absarc(Math.cos(a) * R * 0.62, Math.sin(a) * R * 0.62, R * 0.1, 0, Math.PI * 2, true)
    shape.holes.push(hole)
  }
  const g = new THREE.ExtrudeGeometry(shape, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.005, bevelSegments: 1, curveSegments: 16 })
  g.translate(0, 0, W / 2 - 0.05)
  return g
}

// a door leaf: a framed pane, its frame as a bevelled slab with the glass cut from the mask
export function leafGeometry(w, h) {
  const shape = new THREE.Shape([new THREE.Vector2(-w / 2, 0), new THREE.Vector2(w / 2, 0), new THREE.Vector2(w / 2, h), new THREE.Vector2(-w / 2, h)])
  const g = new THREE.ExtrudeGeometry(shape, { depth: 0.04, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.004, bevelSegments: 1 })
  g.translate(0, 0, -0.02)
  // uvs across the leaf, so one texture serves every leaf
  const uv = g.attributes.uv
  const pos = g.attributes.position
  for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / w + 0.5, pos.getY(i) / h)
  return g
}

// ---------------------------------------------------------------- fittings
// the mirror arm: a tube from the top corner of the windscreen out and down
export function mirrorArmGeometry(side) {
  const pts = [V(0.08, 2.62, side * 1.14), V(-0.12, 2.9, side * 1.3), V(-0.42, 2.92, side * 1.46), V(-0.5, 2.6, side * 1.5), V(-0.5, 2.15, side * 1.5)]
  const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.3)
  return new THREE.TubeGeometry(curve, 40, 0.028, 12, false)
}
export const MIRROR_HEAD = (side) => V(-0.5, 1.92, side * 1.5)

// a passenger seat: shell with a shaped back
export function seatGeometry() {
  const shape = new THREE.Shape()
  shape.moveTo(0, 0)
  shape.lineTo(0.44, 0)
  shape.lineTo(0.44, 0.06)
  shape.lineTo(0.1, 0.08)
  shape.quadraticCurveTo(0.03, 0.1, 0.02, 0.2)
  shape.lineTo(-0.04, 0.5)
  shape.quadraticCurveTo(-0.05, 0.56, 0.0, 0.57)
  shape.lineTo(0.04, 0.55)
  shape.lineTo(0.1, 0.1)
  shape.lineTo(0.44, 0.09)
  shape.lineTo(0.44, 0.0)
  const g = new THREE.ExtrudeGeometry(shape, { depth: 0.42, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 2 })
  g.translate(0, 0, -0.21)
  return g
}

// a hanging strap: the loop
export function strapGeometry() {
  const shape = new THREE.Shape()
  shape.absellipse(0, 0, 0.07, 0.05, 0, Math.PI * 2, false)
  const hole = new THREE.Path()
  hole.absellipse(0, 0, 0.055, 0.035, 0, Math.PI * 2, true)
  shape.holes.push(hole)
  return new THREE.ExtrudeGeometry(shape, { depth: 0.012, bevelEnabled: false }).translate(0, 0, -0.006)
}

// the steering wheel
export function wheelRimGeometry() {
  return new THREE.TorusGeometry(0.22, 0.02, 10, 40)
}

// where the side texture puts a point of the side view: th round the section at height y
export const sideV = (y, side = 1) => {
  const v = shell.thetaAt(1, y) / (Math.PI * 2)
  return side > 0 ? v : 1 - v
}
// the angle round the section of a point on the roof or floor at offset z
export function thetaAtZ(z, top) {
  const k = shell.section(1)
  const n = top ? k.n : k.nLo
  const a = Math.asin(Math.min(1, Math.abs(z) / k.w) ** (n / 2))
  const th = top ? Math.PI - a : a
  return z >= 0 ? th : Math.PI * 2 - th
}
export const lerpN = lerp
