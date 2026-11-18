import { fbm, makeTrack, noise, sstep } from '../circuit/track.js'

// The Alpine Ice Circuit: a closed lap marked out on a frozen lake. The track
// is the shared `makeTrack` spline with its own control points; this file also
// holds the shape of the lake and the one ground function everything stands on.
//
// Units are metres. The lap runs anticlockwise seen from above (x right, z
// towards the default camera), so the pit straight is the long side nearest
// the camera and "left" (the +n side) is the infield.

const PTS = [
  [-120, 95], [-40, 95], [40, 95], [120, 95], // pit straight
  [175, 78], [195, 30], [172, -12], // turn 1, a long left
  [125, -28], [88, -10], [50, -22], [38, -62], [78, -92], [130, -100], // infield S, then a hairpin
  [118, -128], [40, -130], [-50, -130], [-130, -122], // back straight
  [-185, -88], [-205, -35], [-190, 15], [-155, 30], [-170, 62], [-160, 90], // sweep, flick, last corner
]

export const TRACK = makeTrack(PTS, {
  start: [40, 95],
  stands: [
    [-58, 95, 40, 6, false],
    [34, 95, 46, 7, true],
    [192, 36, 32, 6, false],
    [-204, -34, 32, 6, false],
  ],
})

export const WORLD = { x: 1160, z: 1000 }

// The lake, a squashed superellipse with a slightly wandering shore.
// 1 is the shoreline; inside it the ice is dead flat.
export const lakeD = (x, z) => {
  const a = Math.abs(x) / 300
  const b = Math.abs(z) / 205
  return Math.pow(a ** 2.6 + b ** 2.6, 1 / 2.6) * (1 + 0.07 * (fbm(x * 0.006 + 4, z * 0.006 + 9) - 0.5))
}

// The chalet that holds the pit garages, on the infield side of the pit straight.
export const CHALET = { x0: -64, x1: 56, z: 72.5, depth: 11, bays: 6 }

// The one ground truth for the terrain mesh and everything standing on it:
// dead level inside the lake, then a snow beach, then forested slopes that
// climb to mountains on every side.
export function groundAt(x, z) {
  const d = lakeD(x, z)
  const onLake = 1 - sstep(0.98, 1.0, d)
  let y = 0
  if (d > 0.98) {
    const beach = sstep(1.0, 1.25, d) * 2.4
    const slope = sstep(1.12, 2.7, d) * (16 + 90 * fbm(x * 0.0045 + 2, z * 0.0045 + 7)) + sstep(1.5, 3, d) * 26 * (fbm(x * 0.02, z * 0.02) - 0.5)
    y = (beach + slope + (noise(x * 0.05, z * 0.05) - 0.5) * 1.4 * sstep(1.1, 1.4, d)) * (1 - onLake)
  }
  return { y, d, onLake }
}
