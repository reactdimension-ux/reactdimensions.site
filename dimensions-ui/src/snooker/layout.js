// A full-size (12 ft) snooker table, in metres. x runs along the table from
// the baulk end (-x) to the top (black) end (+x); z runs across; y is up.
// The playing area is measured between the cushion noses.

export const PLAY = { len: 3.569, wid: 1.778 }
export const HX = PLAY.len / 2
export const HZ = PLAY.wid / 2

export const BALL_R = 0.02625 // 52.5 mm balls

export const TABLE = {
  bed: 0.82, // the cloth bed above the floor
  nose: 0.032, // cushion nose above the bed
  cushion: 0.05, // the cushion body, nose to rail
  rail: 0.105, // the whole rail, nose to outer edge
  railTop: 0.047, // rail top above the bed
  apron: 0.15, // the frame board below the rail
  legR: 0.085,
}
// the outside of the rail
export const OX = HX + TABLE.rail
export const OZ = HZ + TABLE.rail

// the markings, measured from the cushion faces as the rules have them
export const BAULK_X = -HX + 0.737
export const D_R = 0.292
export const SPOTS = {
  yellow: [BAULK_X, D_R],
  green: [BAULK_X, -D_R],
  brown: [BAULK_X, 0],
  blue: [0, 0],
  pink: [HX / 2, 0],
  black: [HX - 0.324, 0],
}
export const COLOURS = { yellow: '#f4c81d', green: '#0f6b2f', brown: '#6b3a1c', blue: '#1848b8', pink: '#f08aa8', black: '#0c0c0e', red: '#c4151c', white: '#f4f0e6' }

// The pockets: where they fall and how wide they open. Corner pockets fall
// just beyond the corner of the playing area; middle pockets straight out
// through the long cushions.
export const POCKETS = [
  ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => ({ x: sx * (HX + 0.028), z: sz * (HZ + 0.028), r: 0.046, corner: true, sx, sz }))),
  ...[-1, 1].map((sz) => ({ x: 0, z: sz * (HZ + 0.04), r: 0.047, corner: false, sx: 0, sz })),
]
export const JAW = { corner: 0.075, middle: 0.058 } // how far from the pocket's centre line each cushion stops

// eight legs: at the corners and a third of the way in
export const LEG_X = [-OX + 0.135, -(OX - 0.135) / 3, (OX - 0.135) / 3, OX - 0.135]
export const LEG_Z = OZ - 0.135

// the reds, racked behind the pink: rows of 1..5 towards the black
export function reds() {
  const d = BALL_R * 2 + 0.0008
  const apex = SPOTS.pink[0] + BALL_R * 2 + 0.004
  const out = []
  for (let row = 0; row < 5; row++) for (let k = 0; k <= row; k++) out.push([apex + row * d * Math.sqrt(3) * 0.5, (k - row / 2) * d])
  return out
}
