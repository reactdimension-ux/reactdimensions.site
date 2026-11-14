import { ORDER } from './layout.js'

// The roulette ball and rotor, simulated. Plain numbers, no three.js: the
// wheel component steps this and draws what it says.
//
// The ball is a point on the wheel's surfaces, in polar form: an angle th
// round the wheel, a radius r, a height y above the cloth, and their rates
// w, vr and vy. An angle a is the point (sin a, cos a) in plan.

export const TAU = Math.PI * 2
export const SEG = TAU / ORDER.length
export const BALL = 0.01
const GRAV = 9.81
const ROLL = (GRAV * 5) / 7 // a rolling ball answers a slope more slowly than a sliding one

// radii the ball's centre can reach, and the surfaces under it
export const R = { track: 0.3485, rotor: 0.262, ring: 0.215, cone: 0.172, pocketIn: 0.182, pocketOut: 0.205, hub: 0.062 }
export const SLOPE = { apron: 0.33, ring: 0.278, cone: 0.287 }
export const Y = { apron: 0.025, ring: 0.012, floor: 0.004, cone: 0.013, fret: 0.0125 }
const LOW = 0.0095 // below this the ball is down among the separators
export const DIAMOND_R = 0.305
export const DIAMONDS = Array.from({ length: 8 }, (_, k) => (k + 0.5) * (TAU / 8))

// the surface under a ball at radius r: [height, slope outwards]
export function ground(r) {
  if (r >= R.rotor) return [Y.apron + (r - R.rotor) * SLOPE.apron, SLOPE.apron]
  if (r >= R.ring) return [Y.ring + (r - R.ring) * SLOPE.ring, SLOPE.ring]
  if (r >= R.cone) return [Y.floor, 0]
  return [Y.cone + (R.cone - r) * SLOPE.cone, -SLOPE.cone]
}
const wrap = (a) => a - TAU * Math.round(a / TAU)
export const rand = (a, b) => a + Math.random() * (b - a)
// pocket k (the k-th number clockwise from zero) is centred at this angle on the rotor
const pocketAngle = (k) => -(k + 0.5) * SEG
const pocketAt = (a) => Math.floor((((-a % TAU) + TAU) % TAU) / SEG) % ORDER.length

export function newSim() {
  const pocket = ORDER.indexOf(17)
  return { mode: 'settled', A: 0, W: 0, th: pocketAngle(pocket), r: R.pocketOut, y: Y.floor, w: 0, vr: 0, vy: 0, phi: pocketAngle(pocket), pocket, caught: true, pk: -1, dia: -1, t: 0, dir: 1 }
}

// one step of the ball and the rotor; `click(strength)` is called on a knock
export function step(s, dt, click) {
  s.A += s.W * dt
  if (s.mode === 'pickup') {
    // the croupier sets the rotor turning, lifts the ball and flicks it into the track
    s.W += (s.Wt - s.W) * (1 - Math.exp(-5 * dt))
    s.t += dt
    const k = Math.min(1, s.t / 0.75)
    const e = k * k * (3 - 2 * k)
    s.r = s.r0 + (R.track - s.r0) * e
    s.y = s.y0 + (ground(R.track)[0] - s.y0) * e + Math.sin(Math.PI * k) * 0.05
    s.th = s.th0 + s.dir * 1.3 * k * k
    if (k >= 1) Object.assign(s, { mode: 'run', t: 0, w: s.dir * s.w0, vr: 0, vy: 0, r: R.track, y: ground(R.track)[0], caught: false, pk: -1, dia: -1 })
    return
  }
  // the rotor runs down on its bearing
  const drag = (0.03 + 0.06 * Math.abs(s.W)) * dt
  s.W = Math.abs(s.W) <= drag ? 0 : s.W - Math.sign(s.W) * drag
  if (s.mode === 'settled') {
    s.th = s.A + s.phi
    return
  }
  s.t += dt
  const [h, slope] = ground(s.r)
  const onRotor = s.r < R.rotor
  const air = s.y > h + 0.0005 || s.vy > 0
  if (!air) {
    // on a surface: thrown outwards by its own speed, drawn down the slope
    s.vr += (s.r * s.w * s.w - ROLL * slope) * dt
    if (onRotor) {
      // the turning rotor drags the ball round with it
      s.w += (s.W - s.w) * (1 - Math.exp(-(s.caught ? 6 : 1.2) * dt))
      s.vr *= Math.exp(-(s.caught ? 8 : 2.5) * dt)
      if (s.caught) s.w -= wrap(s.th - s.A - pocketAngle(s.pocket)) * 180 * dt
    } else {
      const d = (0.3 + 0.014 * s.w * s.w) * dt
      s.w = Math.abs(s.w) <= d ? 0 : s.w - Math.sign(s.w) * d
      s.vr *= Math.exp(-1.2 * dt)
    }
  }
  s.w -= ((2 * s.vr * s.w) / s.r) * dt // moving inwards, it speeds up round the wheel
  s.r += s.vr * dt
  s.th += s.w * dt
  if (s.r > R.track) {
    s.r = R.track
    if (s.vr > 0) s.vr = 0
  }
  if (s.r < R.hub) {
    s.r = R.hub
    s.vr = Math.abs(s.vr) * 0.4
  }
  // down in a pocket the ball is held between its front and back walls
  if (s.y < LOW) {
    if (s.r > R.pocketOut) {
      s.r = R.pocketOut
      if (s.vr > 0) s.vr *= -0.3
    } else if (s.r < R.pocketIn) {
      s.r = R.pocketIn
      if (s.vr < 0) s.vr *= -0.3
    }
  }
  // falling, bouncing or resting
  const h2 = ground(s.r)[0]
  if (air || h2 < s.y - 0.002) {
    s.vy -= GRAV * dt
    s.y += s.vy * dt
    if (s.y <= h2) {
      s.y = h2
      if (s.vy < -0.35) {
        s.vy *= -0.3
        click(-s.vy)
      } else s.vy = 0
    }
  } else {
    s.y = h2
    s.vy = 0
  }
  const grounded = s.y <= h2 + 0.0005 && s.vy <= 0

  // the deflectors on the apron
  if (!onRotor && s.r < 0.34 && s.y - h2 < 0.008) {
    let touching = -1
    for (let k = 0; k < 8; k++) {
      const da = Math.abs(wrap(s.th - DIAMONDS[k])) * s.r
      const dr = Math.abs(s.r - DIAMOND_R)
      if (k % 2 ? dr < 0.015 && da < 0.03 : dr < 0.03 && da < 0.015) touching = k
    }
    if (touching >= 0 && touching !== s.dia) {
      const v = Math.abs(s.w) * s.r
      const upright = touching % 2 === 0 // lying up the slope, across the ball's path
      s.w *= upright ? rand(0.35, 0.7) : rand(0.55, 0.85)
      s.vr = upright || Math.random() < 0.7 ? -rand(0.12, 0.45) : rand(0.05, 0.2)
      s.vy = rand(0.3, 0.8) * Math.min(1, v / 0.6 + 0.3)
      click(v)
    }
    s.dia = touching
  }

  // the separators between the pockets
  if (s.y < LOW && s.r < R.ring && s.r > R.cone) {
    const k = pocketAt(s.th - s.A)
    const rel = s.w - s.W
    const v = Math.abs(rel) * s.r
    const back = () => {
      // put the ball back just inside the pocket it was in
      s.th = s.A - (s.pk + (rel < 0 ? 0.96 : 0.04)) * SEG
    }
    if (s.pk < 0) s.pk = k
    else if (k !== s.pk) {
      if (s.caught) {
        s.w = s.W - rel * 0.3
        back()
      } else if (Math.random() < 0.72) {
        // over the separator, losing speed, on into the next pockets
        s.w = s.W + rel * rand(0.35, 0.7)
        s.vy = 0.25 + v * rand(0.2, 0.55)
        s.vr += rand(-0.12, 0.12)
        s.pk = -1
      } else {
        // straight back off it
        s.w = s.W - rel * rand(0.3, 0.5)
        s.vy = 0.1 + v * 0.15
        back()
      }
      click(v)
    } else if (!s.caught && grounded && v < 0.3) {
      // too slow to climb a separator: this pocket has it
      s.caught = true
      s.pocket = k
    }
    if (s.caught && grounded && Math.abs(rel) < 0.04 && Math.abs(s.vr) < 0.01 && Math.abs(wrap(s.th - s.A - pocketAngle(s.pocket))) < 0.012) {
      s.mode = 'settled'
      s.phi = wrap(s.th - s.A)
      return ORDER[s.pocket]
    }
  } else if (s.y >= Y.fret) s.pk = -1
  // a ball that somehow never comes to rest is dropped into the pocket under it
  if (s.t > 45) {
    s.pocket = pocketAt(s.th - s.A)
    Object.assign(s, { mode: 'settled', caught: true, phi: pocketAngle(s.pocket), r: R.pocketOut, y: Y.floor, w: s.W, vr: 0, vy: 0 })
    return ORDER[s.pocket]
  }
}
