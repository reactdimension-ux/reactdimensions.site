import { AVE_HALF, AVE_LANES, AVE_PARK, AVE_STOP, AVE_WALK, I, J0, J1, ST_HALF, ST_LANES, ST_PARK, ST_STOP, ST_WALK, aveDir, aveX, rng, signal, stDir, stZ } from './layout.js'

// Traffic on the grid. Every lane is a loop: a car that leaves one end comes
// back in at the other. Cars follow the Intelligent Driver Model: each
// accelerates toward its own cruising speed and brakes for whatever is
// ahead, the car in front or a stop line whose light is red (or amber, if
// it can still stop). Nobody turns or overtakes, so each lane keeps its
// order and the leader of each car is simply the next one along.

const KINDS = ['sedan', 'sedan', 'taxi', 'taxi', 'taxi', 'suv', 'suv', 'sedan', 'van', 'taxi']

// IDM parameters
const A = 1.6 // comfortable acceleration
const Bc = 2.4 // comfortable braking
const S0 = 2.2 // standstill gap
const T = 1.25 // time headway

export function makeTraffic(kinds, density = 1) {
  const r = rng(77)
  const lanes = []
  const zMin = stZ(J0) - 200
  const zMax = stZ(J1) + 260
  const xMin = aveX(-I) - 130
  const xMax = aveX(I) + 130
  // avenues: four lanes each, along z
  for (let i = -I; i <= I; i++) {
    const d = aveDir(i)
    AVE_LANES.forEach((off, k) => {
      const stops = []
      for (let j = J0; j <= J1; j++) stops.push({ q: d * stZ(j) - AVE_STOP, i, j })
      lanes.push({ axis: 'z', fixed: aveX(i) + off, dir: d, q0: d > 0 ? zMin : -zMax, len: zMax - zMin, stops: stops.sort((a, b) => a.q - b.q), v0: 12 + k * 0.8, bus: k === 3 })
    })
  }
  // streets: two lanes each, along x
  for (let j = J0; j <= J1; j++) {
    const e = stDir(j)
    ST_LANES.forEach((off) => {
      const stops = []
      for (let i = -I; i <= I; i++) stops.push({ q: e * aveX(i) - ST_STOP, i, j })
      lanes.push({ axis: 'x', fixed: stZ(j) + off, dir: e, q0: e > 0 ? xMin : -xMax, len: xMax - xMin, stops: stops.sort((a, b) => a.q - b.q), v0: 8.5 })
    })
  }
  const cars = []
  for (const L of lanes) {
    const n = Math.floor((L.len / (L.axis === 'z' ? 22 : 30)) * density * (0.6 + r() * 0.5))
    const list = []
    for (let k = 0; k < n; k++) {
      let kind = KINDS[Math.floor(r() * KINDS.length)]
      if (L.bus && r() < 0.25) kind = 'bus'
      const len = kinds[kind].length
      list.push({ lane: L, kind, len, q: 0, v: 0, v0: L.v0 * (0.85 + r() * 0.3), paint: Math.floor(r() * 16), brake: 0 })
    }
    // spread them round the loop
    let q = L.q0 + r() * 10
    const step = L.len / Math.max(1, list.length)
    for (const c of list) {
      c.q = q
      c.v = c.v0 * 0.6
      q += step * (0.7 + r() * 0.6)
      if (q > L.q0 + L.len) q = L.q0 + L.len - 1
    }
    L.cars = list
    cars.push(...list)
  }
  return { lanes, cars }
}

const wrap = (q, L) => {
  const t = (q - L.q0) % L.len
  return L.q0 + (t < 0 ? t + L.len : t)
}

export function stepTraffic(traffic, t, dt) {
  for (const L of traffic.lanes) {
    const list = L.cars
    const n = list.length
    if (!n) continue
    // keep the loop's order: front of the queue last
    list.sort((a, b) => a.q - b.q)
    for (let k = 0; k < n; k++) {
      const c = list[k]
      const lead = list[(k + 1) % n]
      let gap = lead.q - lead.len / 2 - (c.q + c.len / 2)
      if (k === n - 1) gap += L.len
      if (n === 1) gap = 1e4
      let dv = c.v - lead.v
      // the next stop line ahead, if its light says stop
      const front = c.q + c.len / 2
      for (const s of L.stops) {
        const ahead = s.q - front
        if (ahead < -0.5) continue
        if (ahead > 70) break
        const sig = signal(s.i, s.j, t)
        const state = L.axis === 'z' ? sig.ave : sig.st
        const stop = state === 2 || (state === 1 && ahead > (c.v * c.v) / (2 * 3.5))
        if (stop && ahead < gap) {
          gap = ahead
          dv = c.v
        }
        break
      }
      gap = Math.max(gap, 0.1)
      const sStar = S0 + Math.max(0, c.v * T + (c.v * dv) / (2 * Math.sqrt(A * Bc)))
      const acc = A * (1 - Math.pow(c.v / c.v0, 4) - (sStar / gap) * (sStar / gap))
      c.acc = Math.max(acc, -8)
      c.brake = c.acc < -0.6 || c.v < 0.3 ? 1 : 0
    }
    for (const c of list) {
      c.v = Math.max(0, c.v + c.acc * dt)
      c.q = wrap(c.q + c.v * dt, L)
    }
  }
}

// a car's place in the world: x, z and heading (radians about y)
export function carPose(c) {
  const L = c.lane
  const along = c.q * L.dir
  if (L.axis === 'z') return [L.fixed, along, L.dir > 0 ? -Math.PI / 2 : Math.PI / 2]
  return [along, L.fixed, L.dir > 0 ? 0 : Math.PI]
}

// Parked cars along both kerbs, gaps at hydrants and the corners.
export function parkedCars(kinds) {
  const r = rng(91)
  const out = []
  // only where the eye can make them out
  const park = (x, z, heading, kind) => {
    if (z > -700 && z < 260 && Math.abs(x) < 430) out.push({ x, z, heading, kind, paint: Math.floor(r() * 16) })
  }
  for (let i = -I; i <= I; i++)
    for (let j = J0; j < J1; j++) {
      // avenue kerbs between street j and j+1
      for (const off of AVE_PARK) {
        let z = stZ(j) + ST_HALF + 13
        while (z < stZ(j + 1) - ST_HALF - 13) {
          const kind = r() < 0.08 ? 'van' : r() < 0.5 ? 'sedan' : r() < 0.6 ? 'taxi' : 'suv'
          const len = kinds[kind].length
          if (r() < 0.82) park(aveX(i) + off, z + len / 2, aveDir(i) > 0 ? -Math.PI / 2 : Math.PI / 2, kind)
          z += len + 1.2 + r() * 2.5
        }
      }
    }
  for (let j = J0; j <= J1; j++)
    for (let i = -I - 1; i <= I; i++) {
      for (const off of ST_PARK) {
        let x = aveX(i) + AVE_HALF + 14
        while (x < aveX(i + 1) - AVE_HALF - 14) {
          const kind = r() < 0.06 ? 'van' : r() < 0.55 ? 'sedan' : r() < 0.62 ? 'taxi' : 'suv'
          const len = kinds[kind].length
          if (r() < 0.85) park(x + len / 2, stZ(j) + off, stDir(j) > 0 ? 0 : Math.PI, kind)
          x += len + 1.0 + r() * 2.5
        }
      }
    }
  return out
}

// Pedestrians walking the sidewalks, each on a straight beat that loops.
export function makePeople(count = 900) {
  const r = rng(13)
  const out = []
  for (let k = 0; k < count; k++) {
    const onAve = r() < 0.55
    const speed = (1.1 + r() * 0.5) * (r() < 0.5 ? 1 : -1)
    if (onAve) {
      const i = -I + Math.floor(r() * (2 * I + 1))
      const side = r() < 0.5 ? -1 : 1
      out.push({ axis: 'z', fixed: aveX(i) + side * (AVE_HALF + 0.9 + r() * (AVE_WALK - 1.8)), q: stZ(J0) + r() * (stZ(J1) - stZ(J0)), lo: stZ(J0), hi: stZ(J1), speed, phase: r() * 10, h: 1.6 + r() * 0.25, c: Math.floor(r() * 12) })
    } else {
      const j = J0 + Math.floor(r() * (J1 - J0 + 1))
      const side = r() < 0.5 ? -1 : 1
      out.push({ axis: 'x', fixed: stZ(j) + side * (ST_HALF + 0.8 + r() * (ST_WALK - 1.6)), q: aveX(-I) + r() * (aveX(I) - aveX(-I)), lo: aveX(-I - 1), hi: aveX(I + 1), speed, phase: r() * 10, h: 1.6 + r() * 0.25, c: Math.floor(r() * 12) })
    }
  }
  return out
}
