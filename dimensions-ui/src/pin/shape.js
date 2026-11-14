import * as THREE from 'three'
import { Body } from './physics.js'

// A tenpin to the USBC specification: 15 in tall, 4.766 in across the belly
// 4.5 in up, 1.797 in at the neck, 2.547 in across the head, 2.03 in across
// the base; 3 lb 6 oz to 3 lb 10 oz, with its centre of gravity low, about
// 5.7 in up, because the maple core is hollowed out above the belly.
// Metres from here on. Origin at the middle of the base, axis +y.

const IN = 0.0254
export const PIN_H = 15 * IN
export const PIN_M = 1.58
export const PIN_COM = 5.7 * IN

// diameter (in) at height (in), from the spec's profile table
const TABLE = [
  [0, 2.03],
  [0.375, 2.53],
  [0.75, 2.828],
  [1.5, 3.42],
  [2.25, 3.906],
  [3.375, 4.51],
  [4.5, 4.766],
  [5.875, 4.563],
  [7.25, 3.703],
  [8.625, 2.472],
  [9.375, 1.95],
  [10, 1.797],
  [10.875, 1.87],
  [11.75, 2.161],
  [12.625, 2.42],
  [13.5, 2.547],
  [14.125, 2.4],
  [14.55, 2.0],
  [14.82, 1.4],
  [14.96, 0.7],
]
const curve = new THREE.CatmullRomCurve3(
  TABLE.map(([h, d]) => new THREE.Vector3((d / 2) * IN, h * IN, 0)),
  false,
  'centripetal',
)
const DENSE = curve.getPoints(600)

// radius of the pin at height y
export function radiusAt(y) {
  if (y <= 0) return (2.03 / 2) * IN
  for (let i = 1; i < DENSE.length; i++) {
    if (DENSE[i].y >= y) {
      const a = DENSE[i - 1]
      const b = DENSE[i]
      return a.x + ((b.x - a.x) * (y - a.y)) / (b.y - a.y || 1)
    }
  }
  return 0
}

// The outline to turn on the lathe: the base, with a small chamfer, the
// profile, and a rounded crown to close the top. Spaced evenly up the
// height so a texture's v can be the height.
export function profile(n = 280) {
  const pts = [new THREE.Vector2(0, 0), new THREE.Vector2(radiusAt(0) - 0.0016, 0), new THREE.Vector2(radiusAt(0.0016), 0.0016)]
  const top = 14.96 * IN
  for (let i = 1; i <= n; i++) {
    const y = 0.0016 + ((top - 0.0016) * i) / n
    pts.push(new THREE.Vector2(radiusAt(y), y))
  }
  // the crown: a quarter circle from the last ring to the top
  const r0 = pts[pts.length - 1].x
  for (let k = 1; k <= 8; k++) {
    const a = (k / 8) * (Math.PI / 2)
    pts.push(new THREE.Vector2(r0 * Math.cos(a), top + (PIN_H - top) * Math.sin(a)))
  }
  pts[pts.length - 1].x = 0
  return pts
}

// Collision spheres, relative to the centre of gravity: a stack up the axis
// each as wide as the pin there, and a ring round the base.
export function pinSpheres() {
  const out = []
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2
    const rr = radiusAt(0) - 0.004
    out.push([Math.cos(a) * rr, 0.004, Math.sin(a) * rr, 0.004])
  }
  for (let y = 0.03; y < PIN_H - 0.01; y += 0.014) {
    const r = radiusAt(y)
    if (y - r < 0.003 || y + r > PIN_H + 0.004) continue
    out.push([0, y, 0, r])
  }
  out.push([0, PIN_H - 0.026, 0, 0.026])
  return out.map(([x, y, z, r]) => [x, y - PIN_COM, z, r])
}

// moments of inertia (kg m²) about the centre of gravity, from the volume,
// weighted for the core being hollowed above the belly
export const PIN_I = [0.0168, 0.0031, 0.0168]

export function pinBody() {
  return new Body({ m: PIN_M, I: PIN_I, spheres: pinSpheres(), e: 0.4, mu: 0.22, roll: 1.6, bound: 0.25 })
}

// A bowling ball: 8.5 in across, 15 lb, reactive resin
export const BALL_R = 0.1085
export const BALL_M = 6.8
export function ballBody() {
  const I = 0.4 * BALL_M * BALL_R * BALL_R
  return new Body({ m: BALL_M, I: [I, I, I], spheres: [[0, 0, 0, BALL_R]], e: 0.2, mu: 0.12, roll: 0.04, bound: BALL_R })
}

// the rack: headpin at the origin, rows back along -z, 12 in apart
export const RACK = (() => {
  const s = 12 * IN
  const out = []
  for (let row = 0; row < 4; row++) for (let i = 0; i <= row; i++) out.push([(i - row / 2) * s, -row * s * Math.sin(Math.PI / 3)])
  return out
})()
