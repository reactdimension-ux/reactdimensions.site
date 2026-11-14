// The poker table's measurements, its plan outline and where the seats,
// cup holders and dealer's fittings go. Plain data, no three.js.
//
// World layout (metres): the floor is y = 0 and the cloth is at y = TABLE.H.
// x runs along the table; the dealer stands at the back (-z), where the arm
// rail is cut away.

export const TABLE = {
  H: 0.76, // the cloth, above the floor
  len: 2.44,
  wid: 1.12,
  railW: 0.16, // padded arm rail
  padH: 0.042, // how far the rail stands above the cloth
  slab: 0.05, // thickness of the top below the cloth
  track: 0.046, // the wooden racetrack showing inside the rail
  gap: 0.36, // half the dealer's cut-out in the rail
  nose: 0.06, // the rail's rounded ends run this far into the cut-out
  seats: 10,
  inner: 0.4, // the betting line, in from the table's edge
}
export const R = TABLE.wid / 2
export const L = (TABLE.len - TABLE.wid) / 2

// Traces a closed plan path drawn with line() and arc(). Each point carries
// its inward normal (nx, nz) and its distance along the path (s). Paths run
// along the front towards +x, round the +x end and back along the rear.
export function trace(draw, step = 0.008) {
  const P = []
  const line = (x0, z0, x1, z1) => {
    const n = Math.max(1, Math.round(Math.hypot(x1 - x0, z1 - z0) / step))
    for (let i = 0; i < n; i++) P.push([x0 + ((x1 - x0) * i) / n, z0 + ((z1 - z0) * i) / n])
  }
  const arc = (cx, cz, r, a0, a1) => {
    const n = Math.max(2, Math.round((Math.abs(a1 - a0) * r) / step))
    for (let i = 0; i < n; i++) {
      const a = a0 + ((a1 - a0) * i) / n
      P.push([cx + r * Math.cos(a), cz + r * Math.sin(a)])
    }
  }
  const marks = draw(line, arc, () => P.length)
  const N = P.length
  const pts = []
  let s = 0
  for (let i = 0; i < N; i++) {
    const a = P[(i + N - 1) % N]
    const b = P[(i + 1) % N]
    const l = Math.hypot(b[0] - a[0], b[1] - a[1])
    if (i > 0) s += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1])
    pts.push({ x: P[i][0], z: P[i][1], nx: (b[1] - a[1]) / l, nz: -(b[0] - a[0]) / l, s })
  }
  const total = s + Math.hypot(P[0][0] - P[N - 1][0], P[0][1] - P[N - 1][1])
  return { pts, total, marks }
}

// a stadium (two straights and two half circles) about the origin
export const stadium = (l, r, step) =>
  trace((line, arc) => {
    line(-l, r, l, r)
    arc(l, 0, r, Math.PI / 2, -Math.PI / 2)
    line(l, -r, -l, -r)
    arc(-l, 0, r, -Math.PI / 2, -1.5 * Math.PI)
  }, step)

// a rectangle with rounded corners
export const roundRect = (hx, hz, r, cx = 0, cz = 0, step = 0.003) =>
  trace((line, arc) => {
    line(cx - hx + r, cz + hz, cx + hx - r, cz + hz)
    arc(cx + hx - r, cz + hz - r, r, Math.PI / 2, 0)
    line(cx + hx, cz + hz - r, cx + hx, cz - hz + r)
    arc(cx + hx - r, cz - hz + r, r, 0, -Math.PI / 2)
    line(cx + hx - r, cz - hz, cx - hx + r, cz - hz)
    arc(cx - hx + r, cz - hz + r, r, -Math.PI / 2, -Math.PI)
    line(cx - hx, cz - hz + r, cx - hx, cz + hz - r)
    arc(cx - hx + r, cz + hz - r, r, -Math.PI, -1.5 * Math.PI)
  }, step)

// ---- the table's outer edge ----
// gap = the point indices where the dealer's cut-out starts and ends.
export const OUTLINE = (() => {
  const g = TABLE.gap
  const o = trace((line, arc, mark) => {
    line(-L, R, L, R)
    arc(L, 0, R, Math.PI / 2, -Math.PI / 2)
    line(L, -R, g, -R)
    const g0 = mark()
    line(g, -R, -g, -R)
    const g1 = mark()
    line(-g, -R, -L, -R)
    arc(-L, 0, R, -Math.PI / 2, -1.5 * Math.PI)
    return [g0, g1]
  })
  return { pts: o.pts, total: o.total, gap: o.marks }
})()

// the edge point nearest a distance s along it (s wraps)
export function edgeAt(s) {
  const { pts, total } = OUTLINE
  const t = ((s % total) + total) % total
  return pts.reduce((best, p) => (Math.abs(p.s - t) < Math.abs(best.s - t) ? p : best))
}

// ---- seats ----
// The rail outside the dealer's cut-out is shared out equally. Each seat
// has a cup holder let into the rail at its middle; DIVIDERS are the lines
// printed on the cloth between neighbours (and at the cut-out's two ends).
const SEAT0 = OUTLINE.pts[OUTLINE.gap[1]].s
const SEAT_W = (OUTLINE.total - 2 * TABLE.gap) / TABLE.seats
export const CUP = { inset: 0.075, r: 0.0385, flange: 0.046, y: 0.037 }
export const CUPS = Array.from({ length: TABLE.seats }, (_, i) => {
  const p = edgeAt(SEAT0 + (i + 0.5) * SEAT_W)
  return { x: p.x + p.nx * CUP.inset, z: p.z + p.nz * CUP.inset }
})
export const DIVIDERS = Array.from({ length: TABLE.seats + 1 }, (_, i) => edgeAt(SEAT0 + i * SEAT_W))

// ---- the dealer's fittings ----
// The chip tray: a steel well let into the cloth, with a half-round channel
// for each stack of chips.
export const TRAY = { x: 0.045, z: -R + 0.15, hx: 0.215, hz: 0.1, lip: 0.0098, tubes: 10, axis: -0.01, floor: -0.032 }
export const TUBE = (TRAY.hx - TRAY.lip) / TRAY.tubes // a channel's radius
// the drop slot beside it
export const SLOT = { x: -0.235, z: -R + 0.125, hx: 0.027, hz: 0.055 }

// ---- the base ----
export const LEG_X = 0.62 // the two pedestals
export const FOOTREST = { l: 0.6, r: 0.45, y: 0.115, tube: 0.019 }
