import * as THREE from 'three'
import { FRONT, HIND, SIDES, SPINE, SNOUT, TAIL } from './anatomy.js'

// Locomotion and pose. The lion is steered like a vehicle (forward / back,
// turn); a gait clock drives the legs in a lateral-sequence walk that blends
// into a trot when running. Each paw is planted in the world while it bears
// weight and swings to a predicted landing spot, so feet never slide. Legs are
// solved with two-bone IK; the shoulder blade, wrist and hock follow from the
// paw's place in its stride.

const V = (a) => new THREE.Vector3(...a)
const X = (v, s) => [v[0] * s, v[1], v[2]]
const clamp = THREE.MathUtils.clamp
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}
const damp = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt))
const DEG = Math.PI / 180

const AX = new THREE.Vector3(1, 0, 0)
const AY = new THREE.Vector3(0, 1, 0)
const AZ = new THREE.Vector3(0, 0, 1)

// Rotation taking the frame (z = dir, x = side) to world.
const _m = new THREE.Matrix4()
const _bx = new THREE.Vector3()
const _by = new THREE.Vector3()
const _bz = new THREE.Vector3()
function basis(dir, side, out) {
  _bz.copy(dir).normalize()
  _bx.copy(side).addScaledVector(_bz, -side.dot(_bz)).normalize()
  _by.crossVectors(_bz, _bx)
  _m.makeBasis(_bx, _by, _bz)
  return out.setFromRotationMatrix(_m)
}

// Knee/elbow position for a two-bone chain from a to c, bending toward pole.
function ik(a, c, l1, l2, pole, out) {
  const d = out.subVectors(c, a)
  const len = clamp(d.length(), Math.abs(l1 - l2) + 1e-3, l1 + l2 - 1e-4)
  d.normalize()
  const p = _bx.copy(pole).addScaledVector(d, -pole.dot(d)).normalize()
  const along = (l1 * l1 - l2 * l2 + len * len) / (2 * len)
  const h = Math.sqrt(Math.max(l1 * l1 - along * along, 0))
  return out.multiplyScalar(along).add(a).addScaledVector(p, h)
}

// Paw-segment direction: angle th from straight down, tipping toward +z.
const segDir = (th, out) => out.set(0, -Math.cos(th), Math.sin(th))

export class LionRig {
  constructor(bones, init = {}) {
    this.bones = bones // name -> THREE.Bone
    this.rest = {}
    for (const [name, b] of Object.entries(bones)) {
      const d = new THREE.Vector3().subVectors(b.userData.tip, b.userData.j)
      const q = basis(d, AX, new THREE.Quaternion()).invert()
      this.rest[name] = { j: b.userData.j.clone(), dir: d, inv: q, len: d.length() }
    }
    this.pos = init.pos ? init.pos.clone() : new THREE.Vector3()
    this.yaw = init.yaw ?? 0
    this.v = 0
    this.w = 0
    this.phase = 0
    this.A = 0 // how much the gait shows (0 standing, 1 moving)
    this.run = 0
    this.time = 0
    this.look = { yaw: 0, pitch: 0, ty: 0, tp: 0, next: 2 }
    this.tail = { lift: 0, flick: -1, next: 3 }
    this.blink = { t: -1, next: 2.5 }

    const legs = []
    for (const [s, n] of SIDES) {
      legs.push({ id: `F${n}`, front: true, s, n })
      legs.push({ id: `H${n}`, front: false, s, n })
    }
    for (const L of legs) {
      const src = L.front ? FRONT : HIND
      L.home = V(X(src.ball, L.s))
      L.toe = V(X(src.toe, L.s)).sub(L.home)
      L.foot = this.toWorld(L.home, new THREE.Vector3())
      L.lift = new THREE.Vector3()
      L.state = 'stance'
      L.s01 = 0
      L.cycle = -1
      L.u = 0.5
      L.swing = 0
    }
    this.legs = legs

    // Lengths and rest angles used by the leg solvers.
    const f = (k) => V(FRONT[k])
    const h = (k) => V(HIND[k])
    this.F = {
      hum: f('shoulder').distanceTo(f('elbow')),
      rad: f('elbow').distanceTo(f('wrist')),
      mc: f('wrist').distanceTo(f('ball')),
      th: Math.atan2(FRONT.ball[2] - FRONT.wrist[2], FRONT.wrist[1] - FRONT.ball[1]),
      scapAlpha: Math.atan2(FRONT.wrist[2] - FRONT.scap[2], FRONT.scap[1] - FRONT.wrist[1]),
    }
    this.H = {
      fem: h('hip').distanceTo(h('knee')),
      tib: h('knee').distanceTo(h('hock')),
      mt: h('hock').distanceTo(h('ball')),
      th: Math.atan2(HIND.ball[2] - HIND.hock[2], HIND.hock[1] - HIND.ball[1]),
    }
    this.tailDirs = []
    for (let i = 0; i < TAIL.length - 1; i++) this.tailDirs.push(V(TAIL[i + 1]).sub(V(TAIL[i])))

    // scratch
    this.t = Array.from({ length: 16 }, () => new THREE.Vector3())
    this.q = Array.from({ length: 6 }, () => new THREE.Quaternion())
    this.sp = {}
    for (const k of ['pel', 'lum', 'tho', 'che', 'nek', 'hed']) this.sp[k] = new THREE.Vector3()
    this.Qp = new THREE.Quaternion()
    this.Qc = new THREE.Quaternion()
    this.sideP = new THREE.Vector3()
    this.sideC = new THREE.Vector3()
    this.e = new THREE.Euler()
  }

  toWorld(local, out) {
    const c = Math.cos(this.yaw), s = Math.sin(this.yaw)
    return out.set(this.pos.x + local.x * c + local.z * s, local.y, this.pos.z - local.x * s + local.z * c)
  }
  toLocal(world, out) {
    const c = Math.cos(this.yaw), s = Math.sin(this.yaw)
    const dx = world.x - this.pos.x, dz = world.z - this.pos.z
    return out.set(dx * c - dz * s, world.y, dx * s + dz * c)
  }

  // Sets a bone from its joint position and the direction it points.
  aim(name, pos, dir, side) {
    const b = this.bones[name]
    b.position.copy(pos)
    basis(dir, side, b.quaternion).multiply(this.rest[name].inv)
  }

  update(dt, input, opt) {
    dt = Math.min(dt, 1 / 20)
    this.time += dt
    const { walkSpeed = 1.2, runSpeed = 3.4, bounds = 55 } = opt

    // --- Steering ---
    const fwd = clamp(input.forward, -1, 1)
    const run = input.run && fwd > 0
    const targetV = fwd > 0 ? (run ? runSpeed : walkSpeed) * fwd : fwd * walkSpeed * 0.45
    this.v = damp(this.v, targetV, Math.abs(targetV) > Math.abs(this.v) ? 1.8 : 2.6, dt)
    const r = smooth(walkSpeed * 1.15, runSpeed * 0.9, Math.abs(this.v))
    this.run = r
    const targetW = clamp(input.turn, -1, 1) * (1.25 - 0.45 * r)
    this.w = damp(this.w, targetW, 4, dt)
    this.yaw += this.w * dt
    this.pos.x += Math.sin(this.yaw) * this.v * dt
    this.pos.z += Math.cos(this.yaw) * this.v * dt
    const rad = Math.hypot(this.pos.x, this.pos.z)
    if (rad > bounds) {
      this.pos.x *= bounds / rad
      this.pos.z *= bounds / rad
    }

    const moving = Math.abs(this.v) > 0.04 || Math.abs(this.w) > 0.08
    this.A = damp(this.A, moving ? 1 : 0, moving ? 3 : 2, dt)
    const stride = 1.25 + 0.85 * r
    const duty = 0.64 - 0.22 * r
    const freq = moving ? Math.max(Math.abs(this.v) / stride, Math.abs(this.w) * 0.5, 0.6) : 0
    this.phase += freq * dt
    const offsets = { HL: 0, HR: 0.5, FL: 0.25 + 0.25 * r, FR: 0.75 + 0.25 * r }

    // --- Legs: plant, lift, swing, land ---
    const anySwing = () => this.legs.some((L) => L.state === 'swing')
    const tmp = this.t[0]
    const home = this.t[1]
    for (const L of this.legs) {
      const ph = this.phase + offsets[L.id]
      const p = ph - Math.floor(ph)
      const cyc = Math.floor(ph)
      if (L.state === 'stance') {
        L.u = moving ? clamp(p / duty, 0, 1) : damp(L.u, 0.5, 3, dt)
        if (moving && p >= duty && L.cycle !== cyc) {
          L.state = 'swing'
          L.cycle = cyc
          L.s01 = (p - duty) / (1 - duty)
          L.lift.copy(L.foot)
        }
      }
    }
    if (!moving && !anySwing()) {
      // Standing: tidy up one paw at a time if it was left out of place.
      let worst = null
      let err = 0.07
      for (const L of this.legs) {
        this.toWorld(L.home, home)
        const e = Math.hypot(home.x - L.foot.x, home.z - L.foot.z)
        if (e > err) {
          err = e
          worst = L
        }
      }
      if (worst) {
        worst.state = 'swing'
        worst.s01 = 0
        worst.lift.copy(worst.foot)
        worst.settle = true
      }
    }
    for (const L of this.legs) {
      if (L.state !== 'swing') {
        L.swing = 0
        continue
      }
      const rate = moving && !L.settle ? freq / (1 - duty) : 1 / 0.42
      L.s01 = Math.min(1, L.s01 + rate * dt)
      const left = (1 - L.s01) / rate
      const stanceT = moving ? duty / Math.max(freq, 0.01) : 0
      // where the paw should land: under the shoulder/hip, ahead by half the
      // distance the body will travel while it is down
      const yawAt = this.yaw + this.w * (left + stanceT * 0.5)
      const reach = clamp(this.v * stanceT * 0.5, -0.32, 0.42)
      tmp.copy(L.home)
      tmp.z += reach
      const c = Math.cos(yawAt), s = Math.sin(yawAt)
      const px = this.pos.x + Math.sin(this.yaw) * this.v * left
      const pz = this.pos.z + Math.cos(this.yaw) * this.v * left
      const tx = px + tmp.x * c + tmp.z * s
      const tz = pz - tmp.x * s + tmp.z * c
      const e = L.s01 * L.s01 * (3 - 2 * L.s01)
      const height = (L.front ? 0.11 : 0.09) * (0.8 + 0.6 * r) * (L.settle ? 0.6 : 1)
      L.swing = Math.sin(Math.PI * L.s01)
      L.foot.set(L.lift.x + (tx - L.lift.x) * e, L.home.y + height * Math.pow(Math.sin(Math.PI * Math.min(1, L.s01 * 1.08)), 1.2), L.lift.z + (tz - L.lift.z) * e)
      if (L.s01 >= 1) {
        L.state = 'stance'
        L.settle = false
        L.foot.y = L.home.y
        L.u = 0
      }
    }

    this.pose(dt, r, duty)
  }

  pose(dt, r, duty) {
    const A = this.A
    const time = this.time
    const legs = Object.fromEntries(this.legs.map((L) => [L.id, L]))
    const sp = this.sp
    const t = this.t

    // --- Spine: bob with the girdles, roll toward the swinging legs, bend into turns ---
    const breath = Math.sin(time * 1.7) * 0.004 * (1 - A * 0.5)
    const hipBob = -0.012 * A * r + 0.011 * A * Math.cos(4 * Math.PI * (this.phase - duty * 0.5))
    const shBob = -0.018 * A * r + 0.011 * A * Math.cos(4 * Math.PI * (this.phase + 0.25 + 0.25 * r - duty * 0.5)) + breath
    const rollP = -0.06 * (legs.HL.swing - legs.HR.swing) * A
    const rollC = -0.045 * (legs.FL.swing - legs.FR.swing) * A
    this.bend = damp(this.bend ?? 0, clamp(this.w * 0.13, -0.16, 0.16), 4, dt)
    const sway = 0.012 * A * Math.sin(2 * Math.PI * this.phase)
    const bx = (z) => this.bend * (z + 0.1) * (z + 0.1) + sway * (z + 0.1)
    const zP = SPINE.pelvis[2], zC = SPINE.chest[2]
    const yOff = (z) => hipBob + (shBob - hipBob) * clamp((z - zP) / (zC - zP), 0, 1)
    const setSp = (k, j) => sp[k].set(j[0] + bx(j[2]), j[1] + yOff(j[2]), j[2])
    setSp('pel', SPINE.pelvis)
    setSp('lum', SPINE.lumbar)
    setSp('tho', SPINE.thorax)
    setSp('che', SPINE.chest)
    setSp('nek', SPINE.neck)
    this.sideP.set(Math.cos(rollP), Math.sin(rollP), 0)
    this.sideC.set(Math.cos(rollC), Math.sin(rollC), 0)
    const sideM = t[2].copy(this.sideP).lerp(this.sideC, 0.5).normalize()
    this.aim('pelvis', sp.pel, t[3].subVectors(sp.lum, sp.pel), this.sideP)
    this.aim('lumbar', sp.lum, t[3].subVectors(sp.tho, sp.lum), sideM)
    this.aim('thorax', sp.tho, t[3].subVectors(sp.che, sp.tho), sideM)
    this.aim('chest', sp.che, t[3].subVectors(sp.nek, sp.che), this.sideC)
    this.Qp.copy(this.bones.pelvis.quaternion)
    this.Qc.copy(this.bones.chest.quaternion)
    const b = 1 + breath * 2.5
    this.bones.thorax.scale.set(b, 1 + breath, 1)
    this.bones.chest.scale.set(1 + breath * 1.5, 1 + breath * 0.6, 1)

    // --- Neck and head: lowered on the move, looking into turns, glancing around at rest ---
    const lk = this.look
    lk.next -= dt
    if (lk.next <= 0) {
      lk.next = 2.5 + Math.random() * 4
      lk.ty = A > 0.5 ? (Math.random() - 0.5) * 0.3 : (Math.random() - 0.5) * 1.1
      lk.tp = (Math.random() - 0.6) * 0.25
    }
    lk.yaw = damp(lk.yaw, lk.ty * (1 - A * 0.6) + this.bend * 3.2, 2.2, dt)
    lk.pitch = damp(lk.pitch, lk.tp * (1 - A * 0.5) + 0.07 * A + 0.05 * r, 2, dt)
    const nod = 0.025 * A * Math.sin(4 * Math.PI * (this.phase + 0.1))
    const nq = this.q[0].setFromEuler(this.e.set(lk.pitch * 0.55 + nod * 0.5, lk.yaw * 0.55, 0, 'YXZ'))
    const neckDir = t[4].subVectors(V(SPINE.head), V(SPINE.neck)).applyQuaternion(nq)
    sp.hed.copy(sp.nek).add(neckDir)
    this.aim('neck', sp.nek, neckDir, this.sideC)
    const head = this.bones.head
    head.position.copy(sp.hed)
    head.quaternion.setFromEuler(this.e.set(lk.pitch + nod, lk.yaw, -this.bend * 0.6, 'YXZ'))

    // eyelids
    const bl = this.blink
    if (bl.t < 0) {
      bl.next -= dt
      if (bl.next <= 0) bl.t = 0
    } else {
      bl.t += dt
      if (bl.t > 0.22) {
        bl.t = -1
        bl.next = 2 + Math.random() * 5
      }
    }
    this.lid = bl.t < 0 ? 0 : Math.sin((Math.PI * bl.t) / 0.22)

    // --- Legs ---
    const local = t[5]
    const W = t[6]
    const P1 = t[7]
    const E = t[8]
    const S = t[9]
    const dir = t[10]
    const toe = t[11]
    for (const L of this.legs) {
      this.toLocal(L.foot, local)
      const n = L.n
      if (L.front) {
        // wrist angle: flat in stance, folding the paw back through the swing
        const F = this.F
        let th
        if (L.state === 'stance') th = F.th - 22 * DEG * smooth(0.55, 1, L.u) * A
        else {
          const s = L.s01
          th = F.th - 22 * DEG + 27 * DEG * s - (95 + 25 * r) * DEG * Math.pow(Math.sin(Math.PI * Math.min(1, s * 1.15)), 0.9)
        }
        W.copy(local).addScaledVector(segDir(th, dir), -F.mc)
        S.copy(V(X(FRONT.scap, L.s))).sub(V(SPINE.chest)).applyQuaternion(this.Qc).add(sp.che)
        const alpha = Math.atan2(W.z - S.z, S.y - W.y)
        const scapRot = 0.38 * (alpha - F.scapAlpha)
        // the shoulder blade rides up as the body passes over a planted leg
        if (L.state === 'stance') S.y += 0.024 * A * Math.sin(Math.PI * L.u)
        P1.copy(V(X(FRONT.shoulder, L.s))).sub(V(X(FRONT.scap, L.s))).applyAxisAngle(AX, -scapRot).applyQuaternion(this.Qc).add(S)
        const max = F.hum + F.rad - 0.002
        if (W.distanceTo(P1) > max) {
          const d = t[12].subVectors(W, P1).setLength(max)
          const shift = t[13].copy(P1).add(d).sub(W)
          W.add(shift)
          local.add(shift)
        }
        ik(P1, W, F.hum, F.rad, t[14].set(0, 0.15, -1), E)
        this.aim(`scap${n}`, S, dir.subVectors(P1, S), this.sideC)
        this.aim(`hum${n}`, P1, dir.subVectors(E, P1), this.sideC)
        this.aim(`rad${n}`, E, dir.subVectors(W, E), this.sideC)
        this.aim(`fmc${n}`, W, dir.subVectors(local, W), this.sideC)
        toe.copy(L.toe).applyAxisAngle(AX, -(th - F.th) * 1.1)
        this.aim(`fpaw${n}`, local, toe, this.sideC)
      } else {
        const H = this.H
        let th
        if (L.state === 'stance') th = H.th + 30 * DEG * smooth(0.5, 1, L.u) * A
        else {
          const s = L.s01
          const e = s * s * (3 - 2 * s)
          th = H.th + 30 * DEG + (-33 * DEG) * e - (40 + 15 * r) * DEG * Math.sin(Math.PI * s)
        }
        W.copy(local).addScaledVector(segDir(th, dir), -H.mt)
        S.copy(V(X(HIND.hip, L.s))).sub(V(SPINE.pelvis)).applyQuaternion(this.Qp).add(sp.pel)
        const max = H.fem + H.tib - 0.002
        if (W.distanceTo(S) > max) {
          const d = t[12].subVectors(W, S).setLength(max)
          const shift = t[13].copy(S).add(d).sub(W)
          W.add(shift)
          local.add(shift)
        }
        ik(S, W, H.fem, H.tib, t[14].set(0, -0.1, 1), E)
        this.aim(`fem${n}`, S, dir.subVectors(E, S), this.sideP)
        this.aim(`tib${n}`, E, dir.subVectors(W, E), this.sideP)
        this.aim(`mt${n}`, W, dir.subVectors(local, W), this.sideP)
        toe.copy(L.toe).applyAxisAngle(AX, -(th - H.th) * 0.6)
        this.aim(`hpaw${n}`, local, toe, this.sideP)
      }
    }

    // --- Tail: hangs in a J, swings with the stride, lags in turns, flicks now and then ---
    const tl = this.tail
    tl.lift = damp(tl.lift, 0.1 * A + 0.28 * r, 2, dt)
    let flick = 0
    if (tl.flick < 0) {
      tl.next -= dt
      if (tl.next <= 0) tl.flick = 0
    } else {
      tl.flick += dt
      if (tl.flick > 0.9) {
        tl.flick = -1
        tl.next = 3 + Math.random() * 5
      } else flick = Math.sin((Math.PI * tl.flick) / 0.9)
    }
    const base = t[12].copy(V(TAIL[0])).sub(V(SPINE.pelvis)).applyQuaternion(this.Qp).add(sp.pel)
    let ay = 0
    let ap = 0
    const tq = this.q[1]
    const n = this.tailDirs.length
    for (let i = 0; i < n; i++) {
      const f = i / (n - 1)
      ay += (0.05 + 0.07 * f) * Math.sin(time * (1.1 + 1.8 * A) - i * 0.6) * (0.6 + 0.6 * A) - this.w * 0.06 * f + flick * 0.35 * f * f * Math.sin(time * 9)
      ap += (i === 0 ? tl.lift : 0) + (i > 3 ? -0.05 * flick : 0) + (i < 3 ? 0.03 * r : 0)
      tq.setFromEuler(this.e.set(ap, ay, 0, 'YXZ'))
      dir.copy(this.tailDirs[i]).applyQuaternion(tq).applyQuaternion(this.Qp)
      this.aim(`tail${i}`, base, dir, this.sideP)
      base.add(dir)
    }
  }
}
