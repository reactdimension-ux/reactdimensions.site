import * as THREE from 'three'

// Rigid-body physics for tenpins and a bowling ball, with no physics library.
// SI units: metres, kilograms, seconds, real gravity. +y up.
//
// A pin's shape is a stack of spheres up its axis, each as wide as the pin is
// at that height, plus a ring of small spheres round the edge of its base.
// Standing, it rests on that ring, so it wobbles and rights itself until its
// centre of gravity (low, 145 mm up) passes over the edge. Lying down, it
// rests on its belly and head, which are different sizes, so a fallen pin
// rolls round in an arc the way real ones do.
//
// Contacts against the lane, the kickbacks and the pit are planes; each
// touching sphere gets a normal impulse (with a bounce) and a Coulomb
// friction impulse at the contact point. Pins, and the ball, meet each other
// sphere to sphere with an impulse on both, which wakes them.

export const G = 9.81
const _v = new THREE.Vector3()
const _w = new THREE.Vector3()
const _r = new THREE.Vector3()
const _n = new THREE.Vector3()
const _t = new THREE.Vector3()
const _k = new THREE.Vector3()
const _m3 = new THREE.Matrix3()
const _m4 = new THREE.Matrix4()

export class Body {
  constructor({ m, I, spheres, e = 0.3, mu = 0.5, roll = 0, bound = 0.3 }) {
    this.m = m
    this.invI = new THREE.Vector3(1 / I[0], 1 / I[1], 1 / I[2])
    this.spheres = spheres.map(([x, y, z, r]) => ({ p: new THREE.Vector3(x, y, z), r, w: new THREE.Vector3() }))
    this.e = e
    this.mu = mu
    this.roll = roll
    this.bound = bound // radius of a sphere round the whole body, for quick rejection
    this.pos = new THREE.Vector3()
    this.quat = new THREE.Quaternion()
    this.vel = new THREE.Vector3()
    this.ang = new THREE.Vector3()
    this.active = false
    this.still = 0
    this.grounded = false
    this.invIw = new THREE.Matrix3()
  }

  invInertia(out = this.invIw) {
    _m4.makeRotationFromQuaternion(this.quat)
    const e = _m3.setFromMatrix4(_m4).elements
    const d = this.invI
    const o = out.elements
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++) o[j * 3 + i] = e[i] * d.x * e[j] + e[3 + i] * d.y * e[3 + j] + e[6 + i] * d.z * e[6 + j]
    return out
  }
  pointVel(p, out) {
    _r.subVectors(p, this.pos)
    return out.crossVectors(this.ang, _r).add(this.vel)
  }
  applyImpulse(J, p, invIw = this.invIw) {
    this.vel.addScaledVector(J, 1 / this.m)
    _r.subVectors(p, this.pos)
    this.ang.add(_w.crossVectors(_r, J).applyMatrix3(invIw))
  }
  kAt(p, n, invIw = this.invIw) {
    _r.subVectors(p, this.pos)
    _w.crossVectors(_r, n).applyMatrix3(invIw)
    _k.crossVectors(_w, _r)
    return 1 / this.m + n.dot(_k)
  }
  wake() {
    this.active = true
    this.still = 0
  }
  // world positions of the spheres, after a move
  update() {
    for (const s of this.spheres) s.w.copy(s.p).applyQuaternion(this.quat).add(this.pos)
    this.invInertia()
  }

  // planes: [{ n, d, e?, mu? }] keep n·x >= d
  step(dt, planes, onHit) {
    if (!this.active) return
    this.vel.y -= G * dt
    this.pos.addScaledVector(this.vel, dt)
    const a = this.ang.length()
    if (a > 1e-9) {
      const dq = new THREE.Quaternion().setFromAxisAngle(_v.copy(this.ang).divideScalar(a), a * dt)
      this.quat.premultiply(dq).normalize()
    }
    this.update()
    this.grounded = false
    const cp = new THREE.Vector3()
    const vp = new THREE.Vector3()
    const nrm = new THREE.Vector3()
    const push = new THREE.Vector3()
    for (const pl of planes) {
      let pen = 0
      for (const s of this.spheres) {
        // how deep this sphere is in the surface, and the surface's normal there
        const d = contactDepth(pl, s.w, s.r, nrm)
        if (d <= 0) continue
        if (pl.floor) this.grounded = true
        if (d > pen) {
          pen = d
          push.copy(nrm)
        }
        cp.copy(s.w).addScaledVector(nrm, -s.r)
        this.pointVel(cp, vp)
        const vn = vp.dot(nrm)
        if (vn >= 0) continue
        const ee = -vn > 0.35 ? (pl.e ?? this.e) : 0
        const jn = (-(1 + ee) * vn) / this.kAt(cp, nrm)
        this.applyImpulse(_n.copy(nrm).multiplyScalar(jn), cp)
        if (onHit && -vn > 0.4) onHit(this, -vn, pl)
        this.pointVel(cp, vp)
        vp.addScaledVector(nrm, -vp.dot(nrm))
        const vt = vp.length()
        if (vt > 1e-6) {
          _t.copy(vp).divideScalar(-vt)
          const jt = Math.min(vt / this.kAt(cp, _t), (pl.mu ?? this.mu) * jn)
          this.applyImpulse(_t.multiplyScalar(jt), cp)
        }
      }
      if (pen > 0) {
        this.pos.addScaledVector(push, pen)
        this.update()
      }
    }
    if (this.grounded && this.roll) {
      this.ang.multiplyScalar(Math.exp(-this.roll * dt))
      const kl = Math.exp(-this.roll * 0.5 * dt)
      this.vel.x *= kl
      this.vel.z *= kl
    }
    this.ang.multiplyScalar(Math.exp(-0.05 * dt))
    if (this.grounded && this.vel.lengthSq() < 0.0004 && this.ang.lengthSq() < 0.03) {
      this.still += dt
      if (this.still > 0.5) {
        this.active = false
        this.vel.set(0, 0, 0)
        this.ang.set(0, 0, 0)
      }
    } else this.still = 0
  }
}

// A surface is either a plane { n, d } (keeping n·x >= d) or anything with a
// test(centre, radius, normalOut) that returns how deep a sphere is in it.
function contactDepth(pl, w, r, out) {
  if (pl.test) return pl.test(w, r, out)
  out.copy(pl.n)
  return r - (pl.n.dot(w) - pl.d)
}

// The lane with its gutters: flat maple across the lane, a half-round
// channel of radius `R` either side of it (running from the pit to the foul
// line), and flat capping beyond. In a channel a sphere meets the curved
// floor; above the opening it can only catch the two edges. Behind the deck
// (z < zFrom) is the pit, `pitDepth` lower, with the deck's square end face
// between them, so what goes off the back of the deck or out of a gutter
// drops in.
export function laneSurface({ halfWidth, R, zFrom, zTo, pitDepth = 0.25 }) {
  const edge = new THREE.Vector3()
  return {
    floor: true,
    test(w, r, out) {
      if (w.z < zFrom) {
        // the pit floor
        let best = r - (w.y + pitDepth)
        out.set(0, 1, 0)
        if (w.y < 0) {
          // the deck's end face
          const face = w.z + r - zFrom
          if (face > best) {
            best = face
            out.set(0, 0, -1)
          }
        } else {
          // the deck's back edge
          edge.set(0, w.y, w.z - zFrom)
          const d = edge.length()
          if (r - d > best && d > 1e-7) {
            best = r - d
            out.copy(edge).divideScalar(d)
          }
        }
        return best
      }
      const ax = Math.abs(w.x)
      const s = Math.sign(w.x) || 1
      const inChannel = ax > halfWidth && ax < halfWidth + 2 * R && w.z > zFrom && w.z < zTo
      if (!inChannel) {
        out.set(0, 1, 0)
        return r - w.y
      }
      const cx = s * (halfWidth + R)
      if (w.y < 0) {
        // inside the channel: the curved floor is R from its axis
        const dx = w.x - cx
        const d = Math.hypot(dx, w.y)
        if (d < 1e-7) return 0
        out.set(-dx / d, -w.y / d, 0)
        return d + r - R
      }
      // over the opening: the nearer lip
      let best = -1
      for (const ex of [s * halfWidth, s * (halfWidth + 2 * R)]) {
        edge.set(w.x - ex, w.y, 0)
        const d = edge.length()
        const depth = r - d
        if (depth > best && d > 1e-7) {
          best = depth
          out.copy(edge).divideScalar(d)
        }
      }
      return best
    },
  }
}

// One body's spheres against another's: an impulse at every touching pair,
// and the overlap pushed apart in proportion to mass. Returns the hardest
// closing speed, for the sound.
export function collidePair(A, B, e, mu) {
  if (!A.active && !B.active) return 0
  if (A.pos.distanceTo(B.pos) > A.bound + B.bound) return 0
  let hardest = 0
  const n = new THREE.Vector3()
  const p = new THREE.Vector3()
  const va = new THREE.Vector3()
  const vb = new THREE.Vector3()
  for (const sa of A.spheres) {
    for (const sb of B.spheres) {
      n.subVectors(sa.w, sb.w)
      const d = n.length()
      const min = sa.r + sb.r
      if (d >= min || d < 1e-7) continue
      n.divideScalar(d)
      p.copy(sb.w).addScaledVector(n, sb.r)
      // separate
      const over = min - d
      const wa = B.m / (A.m + B.m)
      A.pos.addScaledVector(n, over * wa)
      B.pos.addScaledVector(n, -over * (1 - wa))
      A.pointVel(p, va)
      B.pointVel(p, vb)
      const rel = va.sub(vb)
      const vn = rel.dot(n)
      if (vn >= 0) continue
      A.wake()
      B.wake()
      const k = A.kAt(p, n) + B.kAt(p, n)
      const j = (-(1 + e) * vn) / k
      const J = n.clone().multiplyScalar(j)
      A.applyImpulse(J, p)
      B.applyImpulse(J.negate(), p)
      const tang = rel.addScaledVector(n, -vn)
      const vt = tang.length()
      if (vt > 1e-5) {
        const t = tang.divideScalar(-vt)
        const jt = Math.min(vt / (A.kAt(p, t) + B.kAt(p, t)), mu * j)
        const Jt = t.multiplyScalar(jt)
        A.applyImpulse(Jt, p)
        B.applyImpulse(Jt.negate(), p)
      }
      hardest = Math.max(hardest, -vn)
    }
  }
  if (hardest > 0) {
    A.update()
    B.update()
  }
  return hardest
}
