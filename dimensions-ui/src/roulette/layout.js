// The roulette table's measurements, its plan outline, the wheel's number
// order and the betting layout. Plain data, no three.js.
//
// World layout (metres): the floor is y = 0 and the cloth is at y = TABLE.H.
// x runs along the table with the wheel at the -x end; +z is the front
// (the croupier's side), where the cloth's numbers read upright.

export const TABLE = {
  H: 0.8, // the cloth, above the floor
  railW: 0.15, // padded arm rail
  padH: 0.046, // how far the rail stands above the cloth
  apron: 0.165, // depth of the body below the cloth
  front: 0.53, // front edge (z)
  back: -0.53, // back edge of the layout end
  endR: 0.53, // the rounded layout end
  endX: 0.82,
  wheelR: 0.66, // the rounded wheel end, centred on the wheel
  fillet: 0.45, // the S-curve from the wheel end to the back edge
  gap: [-0.6, 0.1], // the croupier's stretch of the front: a wooden rail
}
export const WHEEL = { x: -0.69, z: TABLE.front - TABLE.wheelR, deck: 0.525 }

// ---- plan outline of the table's outer edge ----
// Runs along the front towards +x, round the layout end, back along the
// rear, through the S-curve and round the wheel end. Each point carries its
// inward normal (nx, nz) and its distance along the edge (s).
export function buildOutline(step = 0.012) {
  const { front, back, endR, endX, wheelR, fillet, gap } = TABLE
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
  // the fillet circle sits outside the back edge, touching it and the wheel end's circle
  const fz = back - fillet
  const fx = WHEEL.x + Math.sqrt((wheelR + fillet) ** 2 - (WHEEL.z - fz) ** 2)
  const aF = Math.atan2(WHEEL.z - fz, WHEEL.x - fx)

  line(WHEEL.x, front, gap[0], front)
  const g0 = P.length
  line(gap[0], front, gap[1], front)
  const g1 = P.length
  line(gap[1], front, endX, front)
  arc(endX, 0, endR, Math.PI / 2, -Math.PI / 2)
  line(endX, back, fx, back)
  arc(fx, fz, fillet, Math.PI / 2, aF)
  arc(WHEEL.x, WHEEL.z, wheelR, aF - Math.PI, -1.5 * Math.PI)

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
  return { pts, total, gap: [g0, g1] }
}

// ---- the wheel: a single-zero wheel, numbers clockwise from above ----
export const ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26]
const REDS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36])
export const colourOf = (n) => (n === 0 ? 'green' : REDS.has(n) ? 'red' : 'black')
export const INK = { red: '#b3161c', black: '#121214', green: '#0d7a3c' }

// ---- the betting layout on the cloth ----
export const LAY = {
  x: -0.1, // left edge of the zero
  z: -0.215, // back edge of the top row
  zero: 0.075,
  cw: 0.08, // a number's box
  ch: 0.092,
  col: 0.065, // the "2 to 1" boxes
  row: 0.065, // the dozens row and the even-chance row
  pad: 0.02, // clear margin round the print
}
export const LAY_W = LAY.zero + 12 * LAY.cw + LAY.col
export const LAY_H = 3 * LAY.ch + 2 * LAY.row

const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i)
// Every place a chip can go: its box on the cloth (x, z, w, h), the numbers
// it covers and what it pays (to one).
export const SPOTS = (() => {
  const { x, z, zero, cw, ch, col, row } = LAY
  const gx = x + zero
  const out = [{ id: 'n0', kind: 'zero', label: '0', x, z, w: zero, h: 3 * ch, nums: [0], pays: 35 }]
  for (let n = 1; n <= 36; n++) {
    const c = Math.floor((n - 1) / 3)
    const r = 2 - ((n - 1) % 3)
    out.push({ id: `n${n}`, kind: 'number', label: String(n), x: gx + c * cw, z: z + r * ch, w: cw, h: ch, nums: [n], pays: 35 })
  }
  for (let r = 0; r < 3; r++) out.push({ id: `col${r}`, kind: 'column', label: '2 to 1', x: gx + 12 * cw, z: z + r * ch, w: col, h: ch, nums: range(1, 36).filter((n) => 2 - ((n - 1) % 3) === r), pays: 2 })
  ;['1st 12', '2nd 12', '3rd 12'].forEach((label, i) => out.push({ id: `doz${i}`, kind: 'dozen', label, x: gx + i * 4 * cw, z: z + 3 * ch, w: 4 * cw, h: row, nums: range(i * 12 + 1, i * 12 + 12), pays: 2 }))
  const even = [
    ['low', '1-18', range(1, 18)],
    ['even', 'EVEN', range(1, 36).filter((n) => n % 2 === 0)],
    ['red', 'red', range(1, 36).filter((n) => colourOf(n) === 'red')],
    ['black', 'black', range(1, 36).filter((n) => colourOf(n) === 'black')],
    ['odd', 'ODD', range(1, 36).filter((n) => n % 2 === 1)],
    ['high', '19-36', range(19, 36)],
  ]
  even.forEach(([id, label, nums], i) => out.push({ id, kind: 'even', label, x: gx + i * 2 * cw, z: z + 3 * ch + row, w: 2 * cw, h: row, nums, pays: 1 }))
  return out
})()
export const SPOT = Object.fromEntries(SPOTS.map((s) => [s.id, s]))
export const spotAt = (x, z) => SPOTS.find((s) => x >= s.x && x < s.x + s.w && z >= s.z && z < s.z + s.h) || null
