import * as THREE from 'three'

// Rigid-ball physics with real numbers (SI units: metres, kilograms,
// seconds), no physics library.
//
// (Adapted from the football's physics.) A tennis ball is a pressurised
// rubber core about 3 mm thick under felt, so its moment of inertia sits
// between a thin shell (2/3 m r^2) and a solid ball (2/5): about 0.6 m r^2. In the air it
// feels gravity, quadratic air drag (F = 1/2 rho Cd A v^2) and the Magnus
// force from its spin (F ~ 1/2 rho A r (w x v)), which is what bends a
// struck ball. When it touches a surface it gets a normal impulse with a
// speed-dependent coefficient of restitution (a hard hit bounces a little
// less than a soft one, and a very slow contact doesn't bounce at all, so it
// can come to rest), plus a Coulomb friction impulse at the contact point
// that turns sliding into rolling and converts spin into sideways motion.
// Rolling resistance slowly takes the rest away.

const RHO = 1.2 // air density, kg/m^3
const _a = new THREE.Vector3()
const _b = new THREE.Vector3()
const _c = new THREE.Vector3()
const _q = new THREE.Quaternion()

export function createBall({ r, m, y = 1.2, k = 0.6 }) {
  return {
    r,
    m,
    I: k * m * r * r,
    p: new THREE.Vector3(0, y, 0),
    v: new THREE.Vector3(),
    w: new THREE.Vector3(),
    q: new THREE.Quaternion(),
    squash: 0, // visual compression at the contact, 0..~0.2
    squashV: 0,
    held: null, // { target: Vector3 } while the pointer holds it
    onGround: false,
  }
}

// P: { g, Cd, Cl, e0, mu, crr }, planes: [{ n: Vector3, d }]
// onHit(speed, kind) is called for every impact with the normal speed.
export function stepBall(b, h, P, planes, onHit) {
  const A = Math.PI * b.r * b.r
  if (b.held) {
    // carried by the hand: a stiff, critically damped spring to the pointer
    _a.copy(b.held.target).sub(b.p).multiplyScalar(420)
    _a.addScaledVector(b.v, -2 * Math.sqrt(420))
    b.v.addScaledVector(_a, h)
    b.w.multiplyScalar(Math.exp(-h * 6))
  } else {
    b.v.y -= P.g * h
    const sp = b.v.length()
    if (sp > 1e-4) {
      // drag
      b.v.addScaledVector(b.v, (-0.5 * RHO * P.Cd * A * sp * h) / b.m)
      // Magnus (lift from spin)
      _a.crossVectors(b.w, b.v).multiplyScalar((0.5 * RHO * A * b.r * P.Cl * h) / b.m)
      b.v.add(_a)
    }
    // spin decays slowly from air friction on the surface
    b.w.multiplyScalar(Math.exp(-h * 0.08))
  }
  b.p.addScaledVector(b.v, h)

  b.onGround = false
  for (const pl of planes) {
    const dist = pl.n.dot(b.p) - pl.d - b.r
    if (dist >= 0) continue
    b.p.addScaledVector(pl.n, -dist)
    const vn = b.v.dot(pl.n)
    let jn = 0
    if (vn < 0) {
      // restitution falls off for very slow contacts so it can settle
      const s = -vn
      const e = s < 0.18 ? 0 : P.e0 * Math.min(1, 0.55 + 0.45 * Math.min(1, s / 1.2)) * (1 - Math.min(0.12, s * 0.004))
      jn = -(1 + e) * vn * b.m
      b.v.addScaledVector(pl.n, jn / b.m)
      if (s > 0.25) onHit?.(s, pl.kind)
      // the core flattens against the surface: a tennis ball squashes far
      // more than a football for its size
      b.squashV += s * 1.5
    }
    if (pl.kind === 'floor') b.onGround = true
    // friction at the contact point: velocity of the point touching the
    // surface is v + w x (-r n)
    _b.copy(pl.n).multiplyScalar(-b.r)
    _c.crossVectors(b.w, _b).add(b.v)
    _c.addScaledVector(pl.n, -_c.dot(pl.n)) // tangential slip velocity
    const slip = _c.length()
    if (slip > 1e-5) {
      // impulse that would stop the slip outright (shell: 1/m + r^2/I)
      const k = 1 / (1 / b.m + (b.r * b.r) / b.I)
      let jt = slip * k
      // resting contact still presses with its weight
      const press = Math.max(jn, b.m * P.g * h * Math.max(0, pl.n.y))
      jt = Math.min(jt, P.mu * press)
      _c.multiplyScalar(-jt / slip)
      b.v.addScaledVector(_c, 1 / b.m)
      _a.crossVectors(_b, _c).multiplyScalar(1 / b.I)
      b.w.add(_a)
    }
    if (pl.kind === 'floor') {
      // rolling resistance: a little energy lost every turn of the ball
      const vt = Math.hypot(b.v.x, b.v.z)
      if (vt > 1e-4) {
        const k = Math.max(0, 1 - (P.crr * P.g * h) / vt)
        b.v.x *= k
        b.v.z *= k
        b.w.x *= k
        b.w.z *= k
      }
      // twisting on the spot is stopped by the contact patch
      b.w.y *= Math.exp(-h * 2.5)
    }
  }

  // orientation: dq/dt = 1/2 w q
  const wl = b.w.length()
  if (wl > 1e-6) {
    _q.setFromAxisAngle(_a.copy(b.w).multiplyScalar(1 / wl), wl * h)
    b.q.premultiply(_q).normalize()
  }

  // the core squashes on impact and springs back (slowed down to be seen;
  // the real contact lasts about 5 ms)
  b.squashV += (-b.squash * 12000 - b.squashV * 80) * h
  b.squash = Math.max(-0.04, Math.min(0.22, b.squash + b.squashV * h))
}
