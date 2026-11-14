import * as THREE from 'three'
import { SCALE, FRETS, fretFromNut } from './strings.js'

// Outlines and layout of the guitar, in metres. Guitar frame: x across
// (bass side negative), y up the neck from the bottom of the body, z out of
// the top. A double-cutaway solid body with an offset waist and a longer
// bass horn, three single coils, a vibrato bridge, and a six-in-line
// headstock of our own design.

export const BODY_T = 0.045
export const TOP = BODY_T / 2
export const BODY_BEVEL = 0.0085

export const SADDLE_Y = 0.112
export const NUT_Y = SADDLE_Y + SCALE
export const FB = TOP + 0.0125 // fretboard surface
export const FB_END = NUT_Y - fretFromNut(FRETS) - 0.007
export const NECK_W_NUT = 0.0425
export const NECK_W_END = 0.0565
export const neckWidth = (y) => NECK_W_END + ((NECK_W_NUT - NECK_W_END) * (y - FB_END)) / (NUT_Y - FB_END)
export const HS_TOP = FB - 0.0065 // the headstock face sits a little below the fretboard
export const HS_T = 0.0145

// strings: where each crosses the saddle and the nut, and its height there
export const STRING_SADDLE_X = (i) => (i - 2.5) * 0.0105
export const STRING_NUT_X = (i) => (i - 2.5) * 0.0073
export const Z_SADDLE = TOP + 0.0172
export const Z_NUT = FB + 0.0017
export function stringPoint(i, y, out = new THREE.Vector3()) {
  const t = (y - SADDLE_Y) / SCALE
  return out.set(STRING_SADDLE_X(i) + (STRING_NUT_X(i) - STRING_SADDLE_X(i)) * t, y, Z_SADDLE + (Z_NUT - Z_SADDLE) * t)
}
export const fretY = (k) => NUT_Y - fretFromNut(k)

// a smooth closed outline through control points
function smooth(points, n = 220) {
  const c = new THREE.CatmullRomCurve3(
    points.map(([x, y]) => new THREE.Vector3(x, y, 0)),
    true,
    'centripetal',
  )
  return c.getSpacedPoints(n).slice(0, -1).map((p) => new THREE.Vector2(p.x, p.y))
}
const shapeFrom = (pts) => new THREE.Shape(pts)

// the body, drawn a bevel's width inside its finished edge
const BODY_PTS = [
  [0, 0.012],
  [0.08, 0.02],
  [0.132, 0.055],
  [0.152, 0.11],
  [0.148, 0.168],
  [0.132, 0.215],
  [0.128, 0.255],
  [0.134, 0.3],
  [0.126, 0.346],
  [0.104, 0.383],
  [0.086, 0.394],
  [0.07, 0.378],
  [0.056, 0.352],
  [0.038, 0.338],
  [0, 0.334],
  [-0.036, 0.343],
  [-0.052, 0.364],
  [-0.064, 0.4],
  [-0.078, 0.436],
  [-0.098, 0.449],
  [-0.116, 0.436],
  [-0.13, 0.395],
  [-0.138, 0.335],
  [-0.134, 0.282],
  [-0.137, 0.24],
  [-0.152, 0.19],
  [-0.16, 0.125],
  [-0.15, 0.062],
  [-0.104, 0.022],
]
export const bodyOutline = () => smooth(BODY_PTS, 260)
export const bodyShape = () => shapeFrom(bodyOutline())

// the pickguard: under the neck end, round the pickups, cut back round the
// bridge, and out to a lobe that carries the controls
const GUARD_PTS = [
  [-0.03, 0.338],
  [-0.052, 0.33],
  [-0.072, 0.3],
  [-0.084, 0.25],
  [-0.082, 0.2],
  [-0.068, 0.157],
  [-0.05, 0.142],
  [-0.03, 0.143],
  [0.0, 0.146],
  [0.03, 0.145],
  [0.046, 0.138],
  [0.056, 0.118],
  [0.068, 0.088],
  [0.086, 0.07],
  [0.108, 0.068],
  [0.122, 0.082],
  [0.126, 0.112],
  [0.122, 0.16],
  [0.114, 0.21],
  [0.108, 0.262],
  [0.09, 0.305],
  [0.07, 0.33],
  [0.04, 0.338],
]
export const guardOutline = () => smooth(GUARD_PTS, 200)
export const guardShape = () => shapeFrom(guardOutline())

// the headstock: straight off the nut, flaring out on the bass side to carry
// six tuners in a line, with a long swept treble edge and a cut-off tip
const HEAD_PTS = [
  [0.0215, NUT_Y - 0.004],
  [0.022, NUT_Y + 0.03],
  [0.024, NUT_Y + 0.08],
  [0.03, NUT_Y + 0.135],
  [0.036, NUT_Y + 0.172],
  [0.03, NUT_Y + 0.19],
  [0.008, NUT_Y + 0.196],
  [-0.032, NUT_Y + 0.192],
  [-0.048, NUT_Y + 0.18],
  [-0.053, NUT_Y + 0.15],
  [-0.051, NUT_Y + 0.1],
  [-0.047, NUT_Y + 0.06],
  [-0.038, NUT_Y + 0.03],
  [-0.026, NUT_Y + 0.012],
  [-0.0215, NUT_Y - 0.004],
]
export const headOutline = () => smooth(HEAD_PTS, 160)
export const headShape = () => shapeFrom(headOutline())

// tuner posts, low E (nearest the nut) to high e
export const POSTS = [0, 1, 2, 3, 4, 5].map((k) => ({ x: -0.0315 - k * 0.0012, y: NUT_Y + 0.036 + k * 0.0262 }))
export const KEY_X = -0.068

// hardware on the top
export const PICKUP_Y = { neck: SADDLE_Y + 0.161, middle: SADDLE_Y + 0.1, bridge: SADDLE_Y + 0.041 }
export const BRIDGE_PU_SLANT = -0.13
export const KNOBS = [
  { x: 0.072, y: 0.158, label: 'VOLUME' },
  { x: 0.089, y: 0.128, label: 'TONE' },
  { x: 0.103, y: 0.097, label: 'TONE' },
]
export const SWITCH = { x: 0.079, y: 0.196, angle: -0.6 }
export const JACK = { x: 0.112, y: 0.05, angle: 0.8 }
export const PIVOT_Y = SADDLE_Y + 0.024
export const ARM_ROOT = { x: 0.036, y: SADDLE_Y - 0.014 }
