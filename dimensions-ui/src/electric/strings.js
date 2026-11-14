// The physics of an electric guitar's strings and floating tremolo, kept
// apart from the drawing. SI units (metres, newtons, kilograms, seconds).
//
// A string fixed at both ends sounds at  f = (1 / 2L) * sqrt(T / mu)
//   L   speaking length: saddle to nut, or saddle to the fret it is pressed at
//   T   tension: set by the tuner, and changed by the tremolo
//   mu  mass per metre, fixed by the gauge
//
// Tuners: winding the post by d(theta) pulls in r * d(theta) of string and
// the tension rises by dT = (E A / Ltot) r d(theta) (Hooke's law over the
// whole stretched length). The tuner is a 16:1 worm drive.
//
// Tremolo: the bridge is a plate that rocks on six screws at its front edge.
// The strings pull the tops of the saddles toward the neck (a torque that
// would tip it forward); springs in a cavity in the back pull the steel block
// under the plate toward the neck the other way. At rest the two balance.
// Rock the bridge by an angle a and every saddle moves along the string by
// h a, changing every string's tension at once by (E A / Ltot) h a, and the
// springs stretch or relax. Push the arm and all six strings go flat
// together; let go and the bridge swings back, overshoots and settles.
//
// Plucked at a fraction b of its length, a string starts as a triangle: the
// sum of its modes n = 1, 2, 3... with displacement amplitudes
//   y_n = 2 / (n² π² b (1 - b)) * sin(n π b)
// A magnetic pickup at distance p from the saddle senses the string's
// velocity right above it, so it hears mode n in proportion to
// n y_n sin(n π p / L): near the bridge it hears the high modes (bright,
// thin), near the neck it hears the low ones (round, warm), and any mode
// with a node right over the pickup is silent there.

export const SCALE = 0.648 // m, nut to saddle (25.5")
export const FRETS = 21
export const GEAR_RATIO = 16
export const POST_RADIUS = 0.003
const STEEL_E = 200e9
const KGF = 9.80665
const INCH = 0.0254

// low E to high e: a 10–46 nickel-wound set
export const STRINGS = [
  { name: 'E', octave: 2, freq: 82.41, gauge: 0.046, core: 0.018, tensionKg: 7.98, wound: true, B: 0.00005, decay: 6.5 },
  { name: 'A', octave: 2, freq: 110.0, gauge: 0.036, core: 0.016, tensionKg: 8.43, wound: true, B: 0.00006, decay: 6 },
  { name: 'D', octave: 3, freq: 146.83, gauge: 0.026, core: 0.014, tensionKg: 8.34, wound: true, B: 0.00008, decay: 5.5 },
  { name: 'G', octave: 3, freq: 196.0, gauge: 0.017, core: 0.017, tensionKg: 7.37, wound: false, B: 0.00018, decay: 5 },
  { name: 'B', octave: 3, freq: 246.94, gauge: 0.013, core: 0.013, tensionKg: 6.94, wound: false, B: 0.00022, decay: 4.5 },
  { name: 'e', octave: 4, freq: 329.63, gauge: 0.01, core: 0.01, tensionKg: 7.36, wound: false, B: 0.00028, decay: 4 },
].map((s, i) => {
  const T0 = s.tensionKg * KGF
  const area = Math.PI * ((s.core * INCH) / 2) ** 2
  return { ...s, index: i, T0, mu: T0 / (2 * SCALE * s.freq) ** 2, EA: STEEL_E * area, radius: (s.gauge * INCH) / 2 }
})

// stretched length, block to tuner post, per string
export const TOTAL_LENGTH = [0.79, 0.81, 0.83, 0.85, 0.87, 0.89]

export const springPerKeyRad = (i) => ((STRINGS[i].EA / TOTAL_LENGTH[i]) * POST_RADIUS) / GEAR_RATIO

// distance of fret k from the nut
export const fretFromNut = (k) => SCALE * (1 - 2 ** (-k / 12))

// ---- the tremolo ----
export const TREM = {
  h: 0.0135, // saddle top above the pivot line
  d: 0.042, // spring anchor on the block, below the pivot
  k: 4500, // three springs, N/m together
  I: 4e-4, // kg m², the bridge and block plus what the strings and springs carry
  zeta: 0.07,
  min: -0.14, // how far it can dive (rad) before the arm meets the body
  max: 0.035, // how far it can pull up before the block hits the rout
}
const stringStiff = STRINGS.reduce((t, s, i) => t + s.EA / TOTAL_LENGTH[i], 0)
export const TREM_K = TREM.h * TREM.h * stringStiff + TREM.d * TREM.d * TREM.k // N·m/rad

// tension in string i for a tuner key angle (rad of the key, 0 = at pitch)
// and a bridge angle (rad, negative = arm pushed down)
export function tension(i, keyAngle, bridge) {
  const s = STRINGS[i]
  const dTrem = (s.EA / TOTAL_LENGTH[i]) * TREM.h * bridge
  return Math.max(s.T0 * 0.03, s.T0 + springPerKeyRad(i) * keyAngle + dTrem)
}

// frequency of string i
export function frequency(i, keyAngle, bridge, fret) {
  const s = STRINGS[i]
  const L = SCALE - fretFromNut(Math.max(0, fret))
  return (1 / (2 * L)) * Math.sqrt(tension(i, keyAngle, bridge) / s.mu)
}

// the key angle that puts string i `cents` off its standard pitch
export function keyAngleFor(i, cents) {
  const s = STRINGS[i]
  const T = s.T0 * 2 ** (cents / 600)
  return (T - s.T0) / springPerKeyRad(i)
}

// One step of the bridge: the strings' and springs' restoring torque, the
// damping, and any torque from a hand on the arm. Hits its stops.
export function stepTremolo(st, hand, dt) {
  const w = Math.sqrt(TREM_K / TREM.I)
  const acc = (-TREM_K * st.a - 2 * TREM.zeta * w * TREM.I * st.v + hand) / TREM.I
  st.v += acc * dt
  st.a += st.v * dt
  if (st.a < TREM.min) {
    st.a = TREM.min
    if (st.v < 0) st.v = 0
  }
  if (st.a > TREM.max) {
    st.a = TREM.max
    if (st.v > 0) st.v = -st.v * 0.3
  }
}

// mode n's share in what a pickup at `p` (m from the saddle) hears, for a
// pluck at `b` (fraction of L from the saddle), on a speaking length L
export function pickupMode(n, b, p, L) {
  const pb = Math.min(0.97, Math.max(0.03, b))
  const y = (2 / (n * n * Math.PI * Math.PI * pb * (1 - pb))) * Math.sin(n * Math.PI * pb)
  return n * y * Math.sin((n * Math.PI * Math.min(p, L)) / L)
}

const NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']
// nearest note and how many cents off it a frequency is
export function noteOf(f) {
  const m = 69 + 12 * Math.log2(f / 440)
  const r = Math.round(m)
  return { name: NAMES[((r % 12) + 12) % 12], octave: Math.floor(r / 12) - 1, cents: Math.round((m - r) * 100) }
}

// chord shapes: the fret on each string, low E to high e (0 open, -1 muted)
export const CHORDS = {
  open: [0, 0, 0, 0, 0, 0],
  E: [0, 2, 2, 1, 0, 0],
  Em: [0, 2, 2, 0, 0, 0],
  A: [-1, 0, 2, 2, 2, 0],
  Am: [-1, 0, 2, 2, 1, 0],
  C: [-1, 3, 2, 0, 1, 0],
  D: [-1, -1, 0, 2, 3, 2],
  G: [3, 2, 0, 0, 0, 3],
  A5: [5, 7, 7, -1, -1, -1],
  E7: [0, 2, 0, 1, 0, 0],
}

// tunings, in cents from standard on each string
export const TUNINGS = {
  standard: [0, 0, 0, 0, 0, 0],
  'drop D': [-200, 0, 0, 0, 0, 0],
  'half step down': [-100, -100, -100, -100, -100, -100],
  'open G': [-200, -200, 0, 0, 0, -200],
  'out of tune': [-35, 18, -22, 30, -15, 25],
}
