// The street grid, in metres, laid out like Manhattan: wide one-way avenues
// running along z, narrow one-way cross streets along x, long blocks between.
// Everything else (the buildings, the road markings in the shader, the
// signals and the traffic) is placed from these numbers.

export const AVE = 170 // avenue spacing, centre to centre
export const ST = 72 // street spacing
export const AVE_HALF = 10.5 // half the avenue roadway
export const ST_HALF = 5.5 // half the street roadway
export const AVE_WALK = 5.5 // sidewalk widths
export const ST_WALK = 4.5
export const CURB = 0.15

// The detailed grid: avenues i = -I..I, streets j = J0..J1.
export const I = 3
export const J0 = -13
export const J1 = 5
export const aveX = (i) => i * AVE
export const stZ = (j) => j * ST
// one-way directions: +1 runs toward +z (or +x), -1 the other way
export const aveDir = (i) => (((i % 2) + 2) % 2 === 0 ? -1 : 1)
export const stDir = (j) => (((j % 2) + 2) % 2 === 0 ? 1 : -1)

// avenue cross-section, from the west curb (a = -AVE_HALF) to the east:
// parking | bike lane | buffer | 4 traffic lanes | parking
export const AVE_LANES = [-3.6, -0.4, 2.8, 6.0]
export const AVE_PARK = [-9.2, 9.1]
// street: parking | 2 lanes | parking
export const ST_LANES = [-1.55, 1.55]
export const ST_PARK = [-4.3, 4.3]

// stop lines, measured from the centre of the crossing road
export const AVE_STOP = ST_HALF + 5.2 // on an avenue, before a street
export const ST_STOP = AVE_HALF + 5.4 // on a street, before an avenue

export const fract = (v) => v - Math.floor(v)
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
export const sstep = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1)
  return t * t * (3 - 2 * t)
}
export function rng(seed = 1) {
  let s = seed >>> 0 || 1
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// The signal cycle, in seconds. Avenues get the longer green; each
// crossing is offset so a green wave rolls up the avenue at ~11 m/s.
export const CYCLE = 64
export function signal(i, j, t) {
  const off = (aveDir(i) * stZ(j)) / 11 + i * 7
  const p = (((t + off) % CYCLE) + CYCLE) % CYCLE
  // avenue: green 0-32, amber 32-35, red 35-64; street: red 0-37, green 37-59, amber 59-62, red 62-64
  const ave = p < 32 ? 0 : p < 35 ? 1 : 2
  const st = p < 37 ? 2 : p < 59 ? 0 : p < 62 ? 1 : 2
  // pedestrians walk with the green, then a flashing hand
  const aveWalk = p < 24 ? 0 : p < 32 ? 1 : 2
  const stWalk = p >= 37 && p < 52 ? 0 : p >= 37 && p < 59 ? 1 : 2
  return { ave, st, aveWalk, stWalk }
}

// The block interiors (where buildings stand), within the detailed grid.
export function blocks() {
  const out = []
  for (let i = -I - 1; i <= I; i++)
    for (let j = J0 - 1; j <= J1; j++) {
      const x0 = aveX(i) + AVE_HALF + AVE_WALK
      const x1 = aveX(i + 1) - AVE_HALF - AVE_WALK
      const z0 = stZ(j) + ST_HALF + ST_WALK
      const z1 = stZ(j + 1) - ST_HALF - ST_WALK
      out.push({ i, j, x0, x1, z0, z1 })
    }
  return out
}

// How tall the city stands here: a midtown cluster up the avenue, a second
// rise to one side, lower ground at the edges.
export function tallness(x, z) {
  const mid = Math.exp(-((x * x) / (260 * 260) + ((z + 520) * (z + 520)) / (380 * 380)))
  const two = Math.exp(-(((x - 420) * (x - 420)) / (200 * 200) + ((z + 120) * (z + 120)) / (240 * 240))) * 0.7
  const edge = 1 - sstep(700, 1400, Math.hypot(x * 0.8, z + 400))
  return Math.max(0.12, Math.max(mid, two)) * (0.35 + 0.65 * edge)
}
