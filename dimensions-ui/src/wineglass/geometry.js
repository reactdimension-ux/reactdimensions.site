import * as THREE from 'three'

// A classic stemmed wine glass (a Bordeaux-style shape of our own), drawn
// as one closed profile turned on a lathe: so the glass has real thickness,
// a thin rounded rim, a thick lens of glass at the bottom of the bowl, a
// drawn stem that thickens where it meets the bowl and the foot, and a
// slightly domed foot. Metres, y up, the foot standing on y = 0.

export const H = 0.225 // overall height
export const Y0 = 0.102 // the outside bottom of the bowl
export const HB = H - Y0 // bowl height
export const RMAX = 0.044 // widest radius of the bowl
export const RRIM = 0.033 // rim radius (outside)
export const SM = 0.42 // where the bowl is widest, as a fraction of its height
export const WALL = 0.0011 // wall thickness
export const BASE = 0.0058 // the glass is this thick at the bottom of the bowl
export const FOOT_R = 0.039 // foot radius
export const IN_Y0 = Y0 + BASE // the inside bottom of the bowl
export const WIDE_Y = Y0 + SM * HB // height of the widest point

// the taper above the widest point, 0 there to 1 at the rim
const taper = (s) => Math.pow(Math.max(0, (s - SM) / (1 - SM)), 1.6)

// outside of the bowl, from its bottom (on the axis) to the widest point by
// angle, so the rounded bottom gets as many points as the sides
function outerBowl(from = -Math.PI / 2) {
  const pts = []
  const b = SM * HB
  for (let k = 0; k <= 44; k++) {
    const p = from + ((0 - from) * k) / 44
    pts.push([RMAX * Math.cos(p), WIDE_Y + b * Math.sin(p)])
  }
  for (let k = 1; k <= 48; k++) {
    const s = SM + ((1 - SM) * k) / 48
    pts.push([RMAX - (RMAX - RRIM) * taper(s), Y0 + s * HB])
  }
  return pts
}
// inside of the bowl, from the rim down to the bottom on the axis
function innerBowl() {
  const pts = []
  for (let k = 48; k >= 1; k--) {
    const s = SM + ((1 - SM) * k) / 48
    pts.push([RMAX - WALL - (RMAX - RRIM) * taper(s), Y0 + s * HB])
  }
  const b = SM * HB - BASE
  for (let k = 0; k <= 44; k++) {
    const p = (-Math.PI / 2) * (k / 44)
    pts.push([Math.max(0, (RMAX - WALL) * Math.cos(p)), WIDE_Y + b * Math.sin(p)])
  }
  pts[pts.length - 1][0] = 0
  return pts
}

export const innerRadius = (y) => {
  if (y <= IN_Y0) return 0
  if (y < WIDE_Y) {
    const u = (y - WIDE_Y) / (SM * HB - BASE)
    return (RMAX - WALL) * Math.sqrt(Math.max(0, 1 - u * u))
  }
  return RMAX - WALL - (RMAX - RRIM) * taper((y - Y0) / HB)
}

// the stem: thicker where it is drawn out of the foot and into the bowl
const stemR = (y) => 0.0033 + 0.0012 * Math.exp(-(y - 0.0145) / 0.005) + 0.0008 * Math.exp(-(0.095 - y) / 0.007)

export function profile() {
  const pts = []
  // underside of the foot: domed up a little in the middle
  for (let k = 0; k <= 24; k++) {
    const r = (0.0373 * k) / 24
    const q = 1 - (r / 0.0373) ** 2
    pts.push([r, 0.0003 + 0.0040 * q * q])
  }
  // the foot's rounded edge
  for (let k = 1; k <= 10; k++) {
    const a = -Math.PI / 2 + (Math.PI * k) / 10
    pts.push([0.0373 + 0.0013 * Math.cos(a), 0.0016 + 0.0013 * Math.sin(a)])
  }
  // top of the foot, rising into the stem
  for (let k = 1; k <= 30; k++) {
    const r = 0.0373 - ((0.0373 - 0.0046) * k) / 30
    const y = 0.0029 + 0.0024 * (1 - r / 0.0373) + 0.0095 * Math.pow(Math.max(0, (0.014 - r) / (0.014 - 0.0046)), 2.4)
    pts.push([r, y])
  }
  // the stem
  for (let k = 1; k <= 40; k++) {
    const y = 0.0155 + ((0.094 - 0.0155) * k) / 40
    pts.push([stemR(y), y])
  }
  // the knop where the stem flares into the bowl
  const end = [stemR(0.094), 0.094]
  const phi = -Math.acos(0.0085 / RMAX)
  const join = [0.0085, WIDE_Y + SM * HB * Math.sin(phi)]
  const ctl = [0.0047, join[1] - 0.0012]
  for (let k = 1; k < 12; k++) {
    const t = k / 12
    const u = 1 - t
    pts.push([u * u * end[0] + 2 * u * t * ctl[0] + t * t * join[0], u * u * end[1] + 2 * u * t * ctl[1] + t * t * join[1]])
  }
  pts.push(...outerBowl(phi))
  // the rim: a small round bead joining outside to inside
  const rc = RRIM - WALL / 2
  for (let k = 1; k < 12; k++) {
    const a = (Math.PI * k) / 12
    pts.push([rc + (WALL / 2) * Math.cos(a), H + (WALL / 2) * Math.sin(a) * 0.9])
  }
  pts.push(...innerBowl())
  return pts
}

export function glassGeometry(segments = 160) {
  const g = new THREE.LatheGeometry(
    profile().map(([r, y]) => new THREE.Vector2(r, y)),
    segments,
  )
  g.computeVertexNormals()
  return g
}

// the inside of the bowl as a dense list from the bottom up, a hair inside
// the glass, for building the wine
export const INNER = (() => {
  const out = []
  const n = 160
  for (let k = 0; k <= n; k++) {
    // more samples near the bottom, where the curve is tight
    const t = k / n
    const y = IN_Y0 + (H - IN_Y0) * (1 - Math.cos((t * Math.PI) / 2)) ** 0.9
    out.push([Math.max(0, innerRadius(y) - 0.00025), y])
  }
  out[0][0] = 0
  return out
})()

// how much the bowl holds up to height y, in millilitres
export function volumeTo(y) {
  let v = 0
  const n = 200
  const top = Math.min(y, H)
  for (let k = 0; k < n; k++) {
    const a = IN_Y0 + ((top - IN_Y0) * k) / n
    const b = IN_Y0 + ((top - IN_Y0) * (k + 1)) / n
    const r = innerRadius((a + b) / 2)
    v += Math.PI * r * r * (b - a)
  }
  return v * 1e6
}
export const CAPACITY = volumeTo(H)

// wine height for a fill fraction: 1 is a pour up to the widest point,
// which is as full as a wine glass is meant to be
export const levelFor = (fill) => IN_Y0 + Math.max(0, Math.min(1.9, fill)) * (WIDE_Y - IN_Y0)
