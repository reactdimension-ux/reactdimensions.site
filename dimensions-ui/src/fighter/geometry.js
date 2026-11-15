import * as THREE from 'three'
import { at, grid, join, loft, lower, profile, rib, smooth, tyreGeometry, upper } from '../airliner/geometry.js'
import { hull } from '../helicopter/geometry.js'

// Every surface of the fighter, built from its dimensions: a twin-engine
// stealth air-superiority type, 18.9 m long with a 13.6 m diamond wing, canted
// twin fins and two-dimensional thrust-vectoring nozzles. The mesh helpers and
// the aerofoil ribs are the airliner's; the superelliptic hulls are the
// helicopter's. Units are metres. As there, x (the station s) runs aft from
// the tip of the nose, y is up from the ground and +z is the port side; the
// starboard half of everything paired is the port half drawn through a mirror,
// except the fins, which carry lettering and are built for each side.

export const LENGTH = 18.92
export const BODY_END = 18.3 // the fuselage stops at the nozzle hinge line, behind a flat end plate
export const SPAN = 13.56
export const WING_Y = 2.12 // the wing plane at the fuselage side
export { smooth, tyreGeometry }

const rad = THREE.MathUtils.degToRad
const lerp = (a, b, t) => a + (b - a) * t
const V = (x, y, z) => new THREE.Vector3(x, y, z)

// ---------------------------------------------------------------- hulls
// The fuselage in one skin: a chined radome, the cockpit section, and the
// wide flat-bellied centre body that carries the weapon bays and tapers to
// the sting between the nozzles.
export const body = hull({
  top: profile([[0, 2.3], [0.2, 2.4], [0.6, 2.52], [1.2, 2.66], [2.0, 2.82], [3.0, 2.98], [3.6, 3.06], [7.4, 3.14], [8.6, 3.24], [10, 3.28], [13, 3.22], [15.5, 3.08], [17.3, 2.96], [BODY_END, 2.92]]),
  bot: profile([[0, 2.3], [0.2, 2.2], [0.6, 2.06], [1.2, 1.9], [2.0, 1.68], [3.0, 1.47], [4.0, 1.32], [5.0, 1.24], [6, 1.2], [14, 1.2], [15.5, 1.3], [17, 1.62], [BODY_END, 1.95]]),
  waist: profile([[0, 2.3], [0.6, 2.32], [2.0, 2.36], [4, 2.42], [8, 2.5], [12, 2.5], [16, 2.5], [BODY_END, 2.45]]),
  beam: profile([[0, 0], [0.2, 0.14], [0.6, 0.3], [1.2, 0.46], [2.0, 0.64], [3.0, 0.82], [4, 0.96], [5, 1.08], [6.5, 1.28], [8, 1.6], [10, 2.05], [12, 2.25], [14, 2.3], [16, 2.15], [17.3, 1.85], [BODY_END, 1.6]]),
  sq: profile([[0, 1.6], [2, 1.65], [4, 1.8], [7, 2.2], [9, 3.0], [14, 3.3], [BODY_END, 3.0]]),
  sqLo: profile([[0, 1.7], [1.5, 2.0], [3, 2.8], [5, 4.0], [7, 4.6], [14, 4.6], [17, 3.6], [BODY_END, 3.2]]),
})

// An engine nacelle: boxy from the caret inlet back along the wing root,
// drawing in towards the centreline and squaring up into the nozzle. The
// inlet lip is raked, its top ahead of its bottom.
export const NAC = { s0: 3.9, rake: 0.8, sweep: 0.7, end: LENGTH - 0.6 }
const NL = LENGTH - NAC.s0
export const nacelle = hull({
  s0: NAC.s0,
  top: profile([[0, 2.62], [1, 2.72], [3, 2.9], [5.5, 3.02], [9, 3.0], [12, 2.92], [13.6, 2.84], [NL, 2.8]]),
  bot: profile([[0, 1.22], [9, 1.22], [11, 1.27], [12.5, 1.5], [13.8, 1.72], [NL, 1.85]]),
  waist: profile([[0, 1.95], [4, 2.2], [9, 2.3], [NL, 2.32]]),
  beam: profile([[0, 0.86], [3, 0.9], [8, 0.9], [11, 0.82], [13, 0.7], [NL, 0.6]]),
  sq: profile([[0, 4.4], [3, 3.6], [8, 3.4], [12, 3.0], [13.5, 3.2], [NL, 3.6]]),
  sqLo: profile([[0, 4.6], [3, 3.8], [8, 3.8], [12, 3.2], [13.5, 3.2], [NL, 3.6]]),
  zc: profile([[0, 1.25], [5, 1.25], [9, 1.2], [12, 1.0], [13.5, 0.85], [NL, 0.74]]),
})
// the station of the inlet lip round the section (keel at th = 0, outboard wall at pi / 2, crown at pi)
export const lipAt = (th) => NAC.s0 + (NAC.rake * (1 + Math.cos(th))) / 2 + (NAC.sweep * (1 + Math.sin(th))) / 2

// The boom outboard of each nozzle that carries the stabilator.
export const BOOM = { s0: 14.8, len: 4.4, z: 1.42 }
export const boom = hull({
  s0: BOOM.s0,
  top: profile([[0, 2.5], [2, 2.6], [4.4, 2.4]]),
  bot: profile([[0, 1.95], [2, 1.9], [4.4, 2.05]]),
  waist: profile([[0, 2.2], [4.4, 2.22]]),
  beam: profile([[0, 0.05], [0.6, 0.22], [2.5, 0.26], [4.0, 0.22], [4.4, 0.1]]),
  sq: profile([[0, 2.4], [4.4, 2.4]]),
  zc: profile([[0, BOOM.z], [4.4, BOOM.z]]),
})

// The canopy: a one-piece bubble whose waist sits just under the fuselage
// skin, so only its upper half shows.
export const CAN = { s0: 3.3, len: 3.9, pivot: 7.05 }
export const canopy = hull({
  s0: CAN.s0,
  top: profile([[0, 3.03], [0.25, 3.2], [0.7, 3.4], [1.3, 3.57], [1.9, 3.66], [2.5, 3.65], [3.1, 3.52], [3.55, 3.3], [3.9, 3.12]]),
  bot: profile([[0, 2.75], [3.9, 2.82]]),
  waist: profile([[0, 2.85], [3.9, 2.9]]),
  beam: profile([[0, 0.02], [0.25, 0.3], [0.7, 0.5], [1.3, 0.62], [1.9, 0.66], [2.5, 0.64], [3.1, 0.56], [3.55, 0.4], [3.9, 0.15]]),
  sq: profile([[0, 2.1], [3.9, 2.1]]),
})

function hullSkin(h, stations, uOf, NV = 96) {
  return grid(
    stations.length,
    NV + 1,
    (i, j, P, U) => {
      h.point(stations[i], (j / NV) * Math.PI * 2, 0, P)
      U.set(uOf(stations[i]), j / NV)
    },
    { wrap: true },
  )
}

export function bodyGeometry() {
  const st = []
  for (let k = 0; k <= 36; k++) st.push(1.6 * (k / 36) ** 2)
  for (let k = 1; k <= 30; k++) st.push(1.6 + (6.4 * k) / 30)
  for (let k = 1; k <= 40; k++) st.push(8 + (8 * k) / 40)
  for (let k = 1; k <= 14; k++) st.push(16 + ((BODY_END - 16) * k) / 14)
  return hullSkin(body, st, (s) => s / LENGTH, 128)
}
// the flat plate that closes the fuselage between and round the nozzles
export function bodyCapGeometry() {
  const N = 96
  const row = []
  for (let j = 0; j <= N; j++) row.push({ p: body.point(BODY_END, (j / N) * Math.PI * 2, -0.005), u: j / N, v: 0 })
  const c = new THREE.Vector3()
  row.forEach((q) => c.add(q.p))
  c.divideScalar(row.length)
  return loft([row.map(() => ({ p: c, u: 0.5, v: 1 })), row], { flip: true })
}

// the nacelle skin, started at the raked lip, and the duct that runs in from it
export function nacelleGeometry() {
  const NS = 72
  const NV = 72
  const skin = grid(
    NS + 1,
    NV + 1,
    (i, j, P, U) => {
      const th = (j / NV) * Math.PI * 2
      const lip = lipAt(th)
      const s = lip + (NAC.end - lip) * (i / NS) ** 1.5
      nacelle.point(s, th, 0, P)
      U.set((s - NAC.s0) / NL, j / NV)
    },
    { wrap: true },
  )
  const ring = (d, lift, v) => {
    const row = []
    for (let j = 0; j <= NV; j++) {
      const th = (j / NV) * Math.PI * 2
      row.push({ p: nacelle.point(lipAt(th) + d, th, lift), u: j / NV, v })
    }
    return row
  }
  const rows = [ring(0, 0, 0), ring(0.015, -0.03, 0.05), ring(0.4, -0.08, 0.2), ring(1.4, -0.17, 0.5), ring(2.8, -0.3, 0.85), ring(3.3, -0.42, 1)]
  const duct = loft(rows, { flip: true })
  const last = rows[rows.length - 1]
  const c = new THREE.Vector3()
  last.forEach((q) => c.add(q.p))
  c.divideScalar(last.length)
  const cap = loft([last.map(() => ({ p: c, u: 0.5, v: 1 })), last])
  return { skin, duct: join([duct, cap]) }
}

export function boomGeometry() {
  const st = []
  for (let k = 0; k <= 30; k++) st.push(BOOM.s0 + BOOM.len * (k / 30))
  return hullSkin(boom, st, (s) => (s - BOOM.s0) / BOOM.len, 40)
}

export function canopyGeometry() {
  const NS = 48
  const NV = 40
  return grid(
    NS + 1,
    NV + 1,
    (i, j, P, U) => {
      const s = CAN.s0 + CAN.len * (i / NS)
      canopy.point(s, Math.PI / 2 + (j / NV) * Math.PI, 0, P)
      U.set(i / NS, j / NV)
    },
  )
}

// ---------------------------------------------------------------- lifting surfaces
// A frame is one rib, as the airliner has it: leading edge O, thickness
// direction n, chord c, thickness ratio tc, and q along the span.
const frame = (O, n, c, tc, q) => ({ O, n, c, tc, m: 0, tw: 0, q })

// rows down the top and the bottom of a rib between chord fractions xa..xb
function pair(f, xa, xb, N, u) {
  const top = []
  const bot = []
  for (let k = 0; k < N; k++) {
    const x = lerp(xa, xb, 0.5 - 0.5 * Math.cos((Math.PI * k) / (N - 1)))
    top.push({ p: at(f, x, upper(f, x)), u, v: 0.5 - 0.5 * x })
    bot.push({ p: at(f, x, lower(f, x)), u, v: 0.5 + 0.5 * x })
  }
  return [top, bot]
}
// a fan over a closed outline; faces +z as drawn when the outline runs anticlockwise seen from +z
function fan(pts, back) {
  const c = new THREE.Vector3()
  pts.forEach((q) => c.add(q.p))
  c.divideScalar(pts.length)
  return loft([pts.map((q) => ({ p: c, u: q.u, v: 0.5 })), pts], { flip: back })
}
// A closed box of a surface from [top, bot] rows per frame: both skins, the
// spar faces front and rear, and the end caps.
function panel(pairs, { front = true, rear = true, root = true, tip = true } = {}) {
  const tops = pairs.map((r) => r[0])
  const bots = pairs.map((r) => r[1])
  const parts = [loft(tops), loft(bots, { flip: true })]
  if (front) parts.push(loft([tops.map((r) => r[0]), bots.map((r) => r[0])]))
  if (rear) parts.push(loft([tops.map((r) => r[r.length - 1]), bots.map((r) => r[r.length - 1])], { flip: true }))
  const outline = (i) => [...tops[i], ...[...bots[i]].reverse()]
  if (root) parts.push(fan(outline(0), false))
  if (tip) parts.push(fan(outline(pairs.length - 1), true))
  return join(parts)
}
// A nose piece from rib rows (trailing edge over the leading edge and back):
// the skin, the face that closes it behind, and the end caps.
function nose(rows, { root = true, tip = true } = {}) {
  const parts = [loft(rows, { flip: true }), loft([rows.map((r) => r[0]), rows.map((r) => r[r.length - 1])], { flip: true })]
  if (root) parts.push(fan(rows[0], true))
  if (tip) parts.push(fan(rows[rows.length - 1], false))
  return join(parts)
}
// Re-expresses a geometry about a hinge from A to B: A becomes the origin
// and the hinge the local z axis, so the part turns with rotation-z.
function onHinge(g, A, B) {
  const q = new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), B.clone().sub(A).normalize())
  g.translate(-A.x, -A.y, -A.z).applyQuaternion(q.clone().invert())
  return { geometry: g, position: A.toArray(), quaternion: q }
}
const span = (z0, z1, n) => Array.from({ length: n + 1 }, (_, i) => lerp(z0, z1, i / n))

// ---- the wing: a 42 degree diamond with a full-span leading-edge flap, a flaperon and an aileron
export const WING = { zRoot: 1.55, zWall: 1.9, zTip: 6.78, le0: 8.05, te0: 15.3, tanLE: Math.tan(rad(42)), tanTE: Math.tan(rad(17)), xa: 0.17, xb: 0.74, anh: rad(3), flaperon: [1.9, 4.3], aileron: [4.4, 6.66] }
export function wingFrame(z) {
  const le = WING.le0 + WING.tanLE * (z - WING.zWall)
  const te = WING.te0 - WING.tanTE * (z - WING.zWall)
  const k = (z - WING.zRoot) / (WING.zTip - WING.zRoot)
  return frame(V(le, WING_Y - Math.tan(WING.anh) * (z - WING.zWall), z), V(0, Math.cos(WING.anh), Math.sin(WING.anh)), te - le, lerp(0.058, 0.042, k), z)
}
export const wingU = (z) => (z - WING.zRoot) / (WING.zTip - WING.zRoot)
export const wingPoint = (z, x, y = 0) => at(wingFrame(z), x, y)

export function wingGeometry() {
  const { xa, xb } = WING
  // the box: behind the leading-edge flap to the hinge line, closed out to the tip behind the aileron
  const zs = [...span(WING.zRoot, WING.aileron[1], 24), WING.aileron[1] + 0.001, WING.zTip]
  const box = panel(zs.map((z, i) => pair(wingFrame(z), xa, i >= zs.length - 2 ? 1 : xb, 12, wingU(z))))
  const leFlap = nose(span(WING.zRoot + 0.3, WING.zTip, 26).map((z) => rib(wingFrame(z), xa, 16, wingU(z))))
  const hinge = (z) => at(wingFrame(z), xb, 0)
  const flap = (z0, z1) => onHinge(panel(span(z0, z1, 10).map((z) => pair(wingFrame(z), xb, 1, 8, wingU(z)))), hinge(z0), hinge(z1))
  return {
    box,
    leFlap: onHinge(leFlap, at(wingFrame(WING.zRoot + 0.3), xa, 0), at(wingFrame(WING.zTip), xa, 0)),
    flaperon: flap(...WING.flaperon),
    aileron: flap(...WING.aileron),
  }
}

// ---- the fins: canted 28 degrees outboard, with a rudder on the trailing edge
export const FIN = { R: V(0, 3.05, 1.52), cant: rad(28), h0: -0.3, h1: 2.15, le0: 11.9, te0: 16.5, tanLE: Math.tan(rad(50)), tanTE: Math.tan(rad(12)), xr: 0.64 }
export function finFrame(t, side = 1) {
  const d = V(0, Math.cos(FIN.cant), side * Math.sin(FIN.cant))
  const n = V(0, side * Math.sin(FIN.cant), -Math.cos(FIN.cant)) // x, n, d right-handed, so the faces come out right on both sides
  const le = FIN.le0 + FIN.tanLE * t
  const te = FIN.te0 - FIN.tanTE * t
  const O = V(le, FIN.R.y, side * FIN.R.z).addScaledVector(d, t)
  return frame(O, n, te - le, lerp(0.05, 0.04, t / FIN.h1), t)
}
export const finU = (t) => t / FIN.h1
export const finPoint = (t, x, side = 1) => at(finFrame(t, side), x, 0)
export function finGeometry(side = 1) {
  const ts = span(FIN.h0, FIN.h1, 22)
  const fin = nose(ts.map((t) => rib(finFrame(t, side), FIN.xr, 16, finU(t))), { root: false })
  const h = (t) => at(finFrame(t, side), FIN.xr, 0)
  const rudder = panel(span(FIN.h0 + 0.5, FIN.h1 - 0.05, 10).map((t) => pair(finFrame(t, side), FIN.xr, 1, 8, finU(t))))
  return { fin, rudder: onHinge(rudder, h(FIN.h0 + 0.5), h(FIN.h1 - 0.05)) }
}

// ---- the stabilators: all-moving, pivoting on a spanwise shaft
export const STAB = { zRoot: 1.25, zTip: 4.0, y: 2.2, pivot: 16.9 }
export function stabFrame(z) {
  const le = 15.1 + Math.tan(rad(42)) * (z - 1.7)
  const te = Math.min(18.95, 19.0 - 0.23 * (z - 1.7))
  return frame(V(le, STAB.y, z), V(0, 1, 0), te - le, 0.05, z)
}
export const stabU = (z) => (z - STAB.zRoot) / (STAB.zTip - STAB.zRoot)
export function stabGeometry() {
  const g = nose(span(STAB.zRoot, STAB.zTip, 18).map((z) => rib(stabFrame(z), 1, 18, stabU(z))))
  return onHinge(g, V(STAB.pivot, STAB.y, STAB.zRoot), V(STAB.pivot, STAB.y, STAB.zTip))
}

// ---------------------------------------------------------------- nozzles
// The two-dimensional nozzle: faceted convergent petals outside, the duct
// back to the afterburner flame holder inside, and the plume.
export const NOZ = { exit: LENGTH + 0.08, holder: LENGTH - 1.9 }
export function nozzleGeometry() {
  const N = 28
  const ring = (s, lift, v) => {
    const row = []
    for (let j = 0; j <= N; j++) {
      const th = (j / N) * Math.PI * 2
      row.push({ p: nacelle.point(s, th, lift), u: j / N, v })
    }
    return row
  }
  const petals = loft([ring(NAC.end - 0.02, 0, 0), ring(NAC.end + 0.22, -0.01, 0.3), ring(LENGTH - 0.12, -0.05, 0.75), ring(NOZ.exit, -0.11, 1)]).toNonIndexed()
  petals.computeVertexNormals()
  const inner = [ring(NOZ.exit, -0.14, 0), ring(LENGTH - 0.3, -0.17, 0.3), ring(LENGTH - 1.3, -0.2, 0.7), ring(NOZ.holder, -0.22, 1)]
  const liner = loft(inner)
  const back = inner[inner.length - 1]
  const c = new THREE.Vector3()
  back.forEach((q) => c.add(q.p))
  c.divideScalar(back.length)
  const plate = loft([back.map(() => ({ p: c, u: 0.5, v: 1 })), back], { flip: true })
  const holder = loft([ring(NOZ.holder + 0.05, -0.24, 0), ring(NOZ.holder + 0.05, -0.33, 1)])
  // the plume: the exit outline relaxing into a circle and shrinking away aft
  const K = 24
  const rows = []
  const e = ring(NOZ.exit, -0.15, 0)
  const ce = new THREE.Vector3()
  e.forEach((q) => ce.add(q.p))
  ce.divideScalar(e.length)
  for (let k = 0; k <= K; k++) {
    const t = k / K
    const L = 7 * t ** 1.15
    const r = (0.2 + 0.07 * Math.sin(t * 9)) * (1 - t) ** 0.9 + 0.02
    rows.push(
      e.map((q, j) => {
        const th = (j / N) * Math.PI * 2 - Math.PI / 2
        const round = V(ce.x + L, ce.y + r * Math.cos(th) * 0.9, ce.z + r * Math.sin(th))
        const p = q.p.clone().setX(ce.x + L).lerp(round, smooth(t * 2.5)).lerp(V(ce.x + L, ce.y, ce.z), 0.22)
        return { p, u: t, v: j / N }
      }),
    )
  }
  const plume = loft(rows)
  return { petals, liner: join([liner, plate]), holder, plume }
}

// ---------------------------------------------------------------- stores
// An air-to-air missile: an ogive nose, the body, four mid-body fins and four tail fins.
export const AAM = { len: 3.66, r: 0.089 }
export function missileGeometry() {
  const pts = []
  const N = 24
  for (let k = 0; k <= N; k++) {
    const t = k / N
    const x = 0.5 * t
    pts.push(new THREE.Vector2(AAM.r * Math.sqrt(1 - (1 - t) ** 2) * (0.35 + 0.65 * t), x))
  }
  pts.push(new THREE.Vector2(AAM.r, AAM.len - 0.04), new THREE.Vector2(AAM.r * 0.8, AAM.len), new THREE.Vector2(0, AAM.len))
  const body = new THREE.LatheGeometry(pts, 32).rotateZ(Math.PI / 2).rotateY(Math.PI)
  const fin = (len, h, sweep) => {
    const shape = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(len, 0), new THREE.Vector2(len, h * 0.35), new THREE.Vector2(sweep, h)])
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.008, bevelEnabled: false })
    g.translate(0, AAM.r * 0.9, -0.004)
    return g
  }
  return { body, midFin: fin(0.5, 0.17, 0.42), tailFin: fin(0.42, 0.25, 0.3) }
}

// a flat panel with bevelled edges, for the doors
export function doorGeometry(w, h, t = 0.03) {
  const shape = new THREE.Shape([new THREE.Vector2(-w / 2, -h / 2), new THREE.Vector2(w / 2, -h / 2), new THREE.Vector2(w / 2, h / 2), new THREE.Vector2(-w / 2, h / 2)])
  const g = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.006, bevelSegments: 2 })
  g.rotateX(Math.PI / 2).translate(0, t / 2, 0)
  return g
}

// a thin swept blade standing off the skin: an aerial
export function bladeGeometry(len, h, sweep, t) {
  const shape = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(len, 0), new THREE.Vector2(sweep + len * 0.32, h), new THREE.Vector2(sweep, h)])
  const g = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: true, bevelSize: t * 0.4, bevelThickness: t * 0.4, bevelSegments: 2 })
  g.translate(0, 0, -t / 2)
  return g
}

// ---------------------------------------------------------------- openings
// Where the skin is cut away, in the fuselage's own terms, shared by the mask
// texture, the doors and the bays.
export const COCKPIT = { s0: 3.6, s1: 6.95 }
export const BAY = { s0: 6.9, s1: 11.1, z0: 0.14, z1: 0.98, depth: 0.8 } // each main weapon bay, port
export const NOSE_WELL = { s0: 3.95, s1: 5.65, z: 0.3 }
export const MAIN_WELL = { s0: 9.75, s1: 11.45, z0: 1.02, z1: 1.5 }
export const GEAR = { nose: { s: 4.9, R: 0.33, W: 0.2 }, main: { s: 10.6, z: 1.27, R: 0.47, W: 0.3 } }

// the angle round the fuselage section at station s of the point at offset z, on the top or the bottom
export function thetaAtZ(s, z, top) {
  const k = body.section(s)
  const n = top ? k.n : k.nLo
  const a = Math.asin(Math.min(1, Math.abs(z) / k.w) ** (n / 2))
  const th = top ? Math.PI - a : a
  return z >= 0 ? th : Math.PI * 2 - th
}
