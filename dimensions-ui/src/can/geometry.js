import * as THREE from 'three'
import { lathe } from '../roulette/build.js'

// A 330 ml aluminium drinks can, built from its real dimensions. Units are
// metres; y is up from the table, the can's axis is the y axis and the tab
// points along +z (towards the front).

export const R = 0.0331 // body radius (66 mm can)
export const HEIGHT = 0.1155
export const NECK = 0.0265 // radius inside the top seam (a 202 end)
export const SEAM = 0.0288 // outside of the double seam
export const SEAM_Y = HEIGHT
export const LID_Y = HEIGHT - 0.0062 // the lid panel, down inside the countersink
const BASE_R = 0.0245 // the standing ring
const DOME = 0.0105 // how far the base domes up

// [radius, height] profiles for the roulette table's lathe, which maps u
// round the can and v along the profile in metres.

// From the centre of the domed base, out and down to the standing ring, up
// the chime into the straight wall, in through the neck and out to the seam.
export const BODY = [
  [0, DOME], [0.006, DOME - 0.0004], [0.012, DOME - 0.0024], [0.017, DOME - 0.0056], [0.0205, DOME - 0.0085], [0.0225, 0.0016], [0.0235, 0.0004],
  [BASE_R, 0], [BASE_R + 0.0012, 0], [BASE_R + 0.0028, 0.0006], [0.028, 0.0028], [0.0305, 0.0065], [0.032, 0.0105], [0.0328, 0.0145], [R, 0.019],
  [R, 0.096], [R - 0.0002, 0.0985], [0.0322, 0.1015], [0.0306, 0.1045], [0.0292, 0.1072], [0.0283, 0.1092], [0.0278, 0.1105], [0.0278, 0.1118],
  [0.0283, 0.1128], [SEAM, 0.1138], [SEAM, SEAM_Y - 0.0006],
]
// The end: up over the seam's rolled rim, down the countersink wall, and
// across the lid panel to the centre (it dishes a touch).
export const END = [
  [SEAM, SEAM_Y - 0.0006], [SEAM - 0.0003, SEAM_Y - 0.0001], [SEAM - 0.0012, SEAM_Y + 0.0003], [SEAM - 0.0022, SEAM_Y + 0.0001], [NECK + 0.0012, SEAM_Y - 0.0008],
  [NECK + 0.0004, SEAM_Y - 0.002], [NECK, SEAM_Y - 0.0036], [NECK, LID_Y + 0.0012], [NECK - 0.0005, LID_Y + 0.0003], [NECK - 0.0015, LID_Y], [0.018, LID_Y + 0.0002], [0.008, LID_Y + 0.0003], [0, LID_Y + 0.0003],
]

export const bodyGeometry = () => lathe(BODY, 160, 1, 0)
export const endGeometry = () => lathe(END, 160, 1, 0)

// ---------------------------------------------------------------- the opening
// The scored panel is a teardrop between the rivet and the rim, hinged at
// the rivet end; the tab's nose sits just over its narrow end.
export const RIVET = { z: -0.0035, r: 0.0022 }
export const PANEL = { hinge: 0.0014, tip: 0.0205, w: 0.0075 } // along +z from the rivet
export const HINGE_Z = RIVET.z + PANEL.hinge

// the panel's outline in the lid plane, about the hinge (z forward), as a closed Shape
export function panelShape(grow = 0) {
  const s = new THREE.Shape()
  const L = PANEL.tip - PANEL.hinge
  const w0 = 0.0046 + grow
  const w1 = PANEL.w + grow
  // a rounded wedge: narrow by the hinge, full width near the rim
  s.moveTo(-w0, -grow)
  s.bezierCurveTo(-w1 * 1.05, L * 0.25, -w1 * 1.05, L * 0.62, -w1 * 0.72, L * 0.9)
  s.bezierCurveTo(-w1 * 0.4, L + grow * 1.6, w1 * 0.4, L + grow * 1.6, w1 * 0.72, L * 0.9)
  s.bezierCurveTo(w1 * 1.05, L * 0.62, w1 * 1.05, L * 0.25, w0, -grow)
  s.closePath()
  return s
}

// the panel itself: a thin plate, its pivot at the hinge
export function panelGeometry() {
  const g = new THREE.ExtrudeGeometry(panelShape(-0.0002), { depth: 0.00022, bevelEnabled: false, curveSegments: 24 })
  g.rotateX(Math.PI / 2) // shape y -> +z, depth -> -y (the plate hangs under its hinge)
  return g
}

// the score line round the panel: a fine groove, as a dark tube
export function scoreGeometry() {
  const pts = panelShape(0).getPoints(48).map((p) => new THREE.Vector3(p.x, 0, p.y))
  // a closed curve must not repeat its first point, or it loops back on itself
  if (pts[pts.length - 1].distanceTo(pts[0]) < 1e-6) pts.pop()
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 160, 0.00018, 6, true)
}

// the lid's stiffening bead: a ring pressed round the panel area
export function beadGeometry() {
  const g = new THREE.TorusGeometry(0.0205, 0.0005, 8, 96)
  g.rotateX(Math.PI / 2)
  return g
}

// ---------------------------------------------------------------- the tab
// A stay-on tab: a finger ring at the back, a waist where it folds, and a
// broad nose over the panel, all one stamped plate with a rolled edge.
export const TAB = { back: -0.0128, nose: 0.0088, w: 0.0062, ringR: 0.0045, t: 0.00032 }
export function tabGeometry() {
  const s = new THREE.Shape()
  const { back, nose, w } = TAB
  const rb = 0.0066 // the ring's outer radius
  const cz = back + rb // ring centre
  const a0 = Math.acos(-w / rb) // where the ring meets the straight sides
  s.moveTo(-w, 0.001)
  // round the finger ring
  s.absarc(0, cz, rb, a0, Math.PI * 2 - a0, false)
  s.lineTo(w, 0.001)
  // the nose
  s.lineTo(w, nose - 0.0028)
  s.quadraticCurveTo(w, nose, w - 0.0028, nose)
  s.lineTo(-w + 0.0028, nose)
  s.quadraticCurveTo(-w, nose, -w, nose - 0.0028)
  s.closePath()
  // the finger hole
  const hole = new THREE.Path()
  hole.absarc(0, cz, TAB.ringR, 0, Math.PI * 2, true)
  s.holes.push(hole)
  // the keyhole round the rivet, with a slit so the nose can lever
  const key = new THREE.Path()
  key.absarc(0, 0, 0.0027, 0, Math.PI * 2, true)
  s.holes.push(key)
  const g = new THREE.ExtrudeGeometry(s, { depth: TAB.t, bevelEnabled: true, bevelThickness: 0.00012, bevelSize: 0.00012, bevelSegments: 2, curveSegments: 20 })
  g.rotateX(Math.PI / 2)
  g.translate(0, TAB.t + 0.00012, 0)
  return g
}
// the rolled edge round the tab, as a tube, so it reads as a stamped part
export function tabEdgeGeometry() {
  const { back, nose, w } = TAB
  const rb = 0.0066
  const cz = back + rb
  const a0 = Math.acos(-w / rb)
  const pts = []
  for (let k = 0; k <= 40; k++) {
    const a = a0 + (k / 40) * (Math.PI * 2 - 2 * a0)
    pts.push(new THREE.Vector3(rb * Math.cos(a), 0, cz + rb * Math.sin(a)))
  }
  pts.push(new THREE.Vector3(w, 0, nose - 0.0028), new THREE.Vector3(w - 0.0028, 0, nose), new THREE.Vector3(-w + 0.0028, 0, nose), new THREE.Vector3(-w, 0, nose - 0.0028))
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true, 'centripetal', 0.3), 200, 0.00028, 6, true)
}

// the rivet: a mushroom head with a washer under it
export const rivetGeometry = () => lathe([[0, 0.0013], [0.0012, 0.00125], [0.002, 0.0009], [RIVET.r, 0.0003], [RIVET.r, 0], [0.0017, 0], [0.0017, -0.0012]], 32, 1, 0)
