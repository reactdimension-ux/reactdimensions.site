import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { createDiceAudio } from './audio.js'

// Six-sided dice in a tray, with real rigid-body physics (no physics library).
//
// Each die is a 1-unit rounded cube. Its contact points are the 24 places
// where the flat faces meet the rounded edges, so a die lying on a face rests
// exactly on that face. Every small step, gravity pulls, then each contact
// point below the floor, behind a wall or inside another die gets an impulse
// that stops it going further in (with a little bounce) and a friction impulse
// that stops it sliding, which also makes it tip and roll. A cube's inertia is
// the same about every axis, which keeps the spin maths simple and exact.
// When everything is still, the face pointing up is read as the result.
//
// The pips follow the standard layout: opposite faces add up to 7.

const S = 0.5 // half the die's size
const R = 0.12 // corner rounding
const INNER = S - R
const INV_M = 1
const INV_I = 6 // a solid cube of side 1 and mass 1: I = 1/6 about any axis
const G = 30 // gravity, in die-sizes per second squared (slowed for clarity)
const MU = 0.45 // friction, die on die and die on tray
const STEPS = 10
const TRAY = { x: 4.2, z: 2.7, wall: 0.9 } // inner half-size of the tray

// 24 contact points: at each corner, one point on each of the three faces
const POINTS = []
for (const sx of [-1, 1])
  for (const sy of [-1, 1])
    for (const sz of [-1, 1])
      for (let a = 0; a < 3; a++) {
        const p = [sx * INNER, sy * INNER, sz * INNER]
        p[a] = [sx, sy, sz][a] * S
        POINTS.push(new THREE.Vector3(...p))
      }

// Faces: value, outward normal and two in-face axes for laying out the pips
const FACES = [
  { value: 1, n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1] },
  { value: 6, n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1] },
  { value: 2, n: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0] },
  { value: 5, n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0] },
  { value: 3, n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] },
  { value: 4, n: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0] },
].map((f) => ({ ...f, n: new THREE.Vector3(...f.n), u: new THREE.Vector3(...f.u), v: new THREE.Vector3(...f.v) }))

const O = 0.25
const LAYOUT = {
  1: [[0, 0]],
  2: [[-O, -O], [O, O]],
  3: [[-O, -O], [0, 0], [O, O]],
  4: [[-O, -O], [O, -O], [-O, O], [O, O]],
  5: [[-O, -O], [O, -O], [0, 0], [-O, O], [O, O]],
  6: [[-O, -O], [-O, 0], [-O, O], [O, -O], [O, 0], [O, O]],
}

// local matrices for all 21 pips: a flattened glossy dome set into the face
const PIP_MATRICES = (() => {
  const out = []
  const Y = new THREE.Vector3(0, 1, 0)
  for (const f of FACES) {
    const q = new THREE.Quaternion().setFromUnitVectors(Y, f.n)
    for (const [a, b] of LAYOUT[f.value]) {
      const pos = f.n.clone().multiplyScalar(S - 0.014).addScaledVector(f.u, a).addScaledVector(f.v, b)
      out.push(new THREE.Matrix4().compose(pos, q, new THREE.Vector3(1, 0.4, 1)))
    }
  }
  return out
})()

const UP = new THREE.Vector3(0, 1, 0)
// the face value pointing up for a die's orientation, and how flat it lies (1 = flat)
function upFace(q) {
  let best = null
  let dot = -2
  const n = new THREE.Vector3()
  for (const f of FACES) {
    const d = n.copy(f.n).applyQuaternion(q).y
    if (d > dot) {
      dot = d
      best = f.value
    }
  }
  return { value: best, flat: dot }
}

// an orientation that puts `value` on top, turned by yaw
export function restingOn(value, yaw) {
  const f = FACES.find((x) => x.value === value)
  const q = new THREE.Quaternion().setFromUnitVectors(f.n, UP)
  return new THREE.Quaternion().setFromAxisAngle(UP, yaw).multiply(q)
}

function makeBodies(count) {
  return Array.from({ length: count }, (_, i) => {
    const x = (i - (count - 1) / 2) * 1.6
    return {
      p: new THREE.Vector3(x, S, 0.2),
      q: restingOn((i % 6) + 1, (i - count / 2) * 0.12),
      v: new THREE.Vector3(),
      w: new THREE.Vector3(),
      still: 1,
      held: false,
      lastSound: 0,
    }
  })
}

const tmp = {
  r: new THREE.Vector3(),
  r2: new THREE.Vector3(),
  wp: new THREE.Vector3(),
  vp: new THREE.Vector3(),
  vt: new THREE.Vector3(),
  c: new THREE.Vector3(),
  n: new THREE.Vector3(),
  l: new THREE.Vector3(),
  qi: new THREE.Quaternion(),
  dq: new THREE.Quaternion(),
}

// impulse at world point (offset r from the centre) along unit n on one body
function applyImpulse(b, r, n, j) {
  b.v.addScaledVector(n, j * INV_M)
  tmp.c.crossVectors(r, n)
  b.w.addScaledVector(tmp.c, j * INV_I)
}

// one body against a fixed plane (n . x >= d); returns the hardest impact speed
function planeContacts(b, n, d) {
  let hardest = 0
  let push = 0
  for (const pt of POINTS) {
    const r = tmp.r.copy(pt).applyQuaternion(b.q)
    const dist = tmp.wp.copy(b.p).add(r).dot(n) - d
    if (dist >= 0) continue
    push = Math.max(push, -dist)
    const vp = tmp.vp.crossVectors(b.w, r).add(b.v)
    const vn = vp.dot(n)
    if (vn >= 0) continue
    hardest = Math.max(hardest, -vn)
    const e = vn < -2 ? 0.32 : 0
    const rn = tmp.c.crossVectors(r, n).lengthSq()
    const jn = (-(1 + e) * vn) / (INV_M + INV_I * rn)
    applyImpulse(b, r, n, jn)
    // friction: oppose sliding at the contact, up to MU times the push
    vp.crossVectors(b.w, r).add(b.v)
    const vt = tmp.vt.copy(vp).addScaledVector(n, -vp.dot(n))
    const s = vt.length()
    if (s > 1e-6) {
      vt.divideScalar(s)
      const rt = tmp.c.crossVectors(r, vt).lengthSq()
      const jt = Math.max(-MU * jn, -s / (INV_M + INV_I * rt))
      applyImpulse(b, r, vt, jt)
    }
  }
  if (push > 0) b.p.addScaledVector(n, push * 0.8)
  return hardest
}

// corners of a pushing into b (as a box), resolved on both; returns impact speed
function boxContacts(a, b) {
  let hardest = 0
  tmp.qi.copy(b.q).invert()
  for (const pt of POINTS) {
    const ra = tmp.r.copy(pt).applyQuaternion(a.q)
    const wp = tmp.wp.copy(a.p).add(ra)
    const l = tmp.l.copy(wp).sub(b.p).applyQuaternion(tmp.qi)
    const px = S - Math.abs(l.x)
    const py = S - Math.abs(l.y)
    const pz = S - Math.abs(l.z)
    if (px <= 0 || py <= 0 || pz <= 0) continue
    // push out through the nearest face of b
    const n = tmp.n.set(0, 0, 0)
    let depth
    if (px < py && px < pz) {
      n.x = Math.sign(l.x)
      depth = px
    } else if (py < pz) {
      n.y = Math.sign(l.y)
      depth = py
    } else {
      n.z = Math.sign(l.z)
      depth = pz
    }
    n.applyQuaternion(b.q)
    const rb = tmp.r2.copy(wp).sub(b.p)
    const rel = tmp.vp.crossVectors(a.w, ra).add(a.v)
    tmp.vt.crossVectors(b.w, rb).add(b.v)
    rel.sub(tmp.vt)
    const vn = rel.dot(n)
    if (vn < 0) {
      hardest = Math.max(hardest, -vn)
      const e = vn < -2 ? 0.3 : 0
      const k = 2 * INV_M + INV_I * (tmp.c.crossVectors(ra, n).lengthSq() + tmp.c.crossVectors(rb, n).lengthSq())
      const jn = (-(1 + e) * vn) / k
      if (!a.held) applyImpulse(a, ra, n, jn)
      if (!b.held) applyImpulse(b, rb, n, -jn)
      // friction between the two dice
      rel.copy(tmp.vp.crossVectors(a.w, ra).add(a.v)).sub(tmp.vt.crossVectors(b.w, rb).add(b.v))
      const vt = rel.addScaledVector(n, -rel.dot(n))
      const s = vt.length()
      if (s > 1e-6) {
        vt.divideScalar(s)
        const kt = 2 * INV_M + INV_I * (tmp.c.crossVectors(ra, vt).lengthSq() + tmp.c.crossVectors(rb, vt).lengthSq())
        const jt = Math.max(-MU * jn, -s / kt)
        if (!a.held) applyImpulse(a, ra, vt, jt)
        if (!b.held) applyImpulse(b, rb, vt, -jt)
      }
    }
    const share = a.held ? 0 : b.held ? 1 : 0.5
    a.p.addScaledVector(n, depth * 0.8 * share)
    b.p.addScaledVector(n, -depth * 0.8 * (1 - share))
  }
  return hardest
}

const WALLS = [
  [new THREE.Vector3(0, 1, 0), 0], // the tray floor
  [new THREE.Vector3(1, 0, 0), -TRAY.x],
  [new THREE.Vector3(-1, 0, 0), -TRAY.x],
  [new THREE.Vector3(0, 0, 1), -TRAY.z],
  [new THREE.Vector3(0, 0, -1), -TRAY.z],
]

function Die({ body, dieColor, pipColor, onGrab, index }) {
  const group = useRef()
  body.group = group
  return (
    <group ref={group} position={body.p} quaternion={body.q} onPointerDown={(e) => onGrab(e, index)}>
      <DieMesh dieColor={dieColor} pipColor={pipColor} />
    </group>
  )
}

// The die itself, 1 unit across, for other scenes to use too (scale it to
// size): the rounded cube and its 21 glossy pips.
export function DieMesh({ dieColor = '#f5f5f3', pipColor = '#0b0b0c' }) {
  const pips = useRef()
  const pipGeo = useMemo(() => new THREE.SphereGeometry(0.105, 24, 14), [])
  const pipMat = useMemo(() => new THREE.MeshPhysicalMaterial({ roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08 }), [])
  useEffect(() => () => (pipGeo.dispose(), pipMat.dispose()), [pipGeo, pipMat])
  useEffect(() => {
    pipMat.color.set(pipColor)
  }, [pipMat, pipColor])
  useEffect(() => {
    PIP_MATRICES.forEach((m, i) => pips.current.setMatrixAt(i, m))
    pips.current.instanceMatrix.needsUpdate = true
  }, [])
  return (
    <>
      <RoundedBox args={[1, 1, 1]} radius={R} smoothness={5} castShadow receiveShadow>
        <meshPhysicalMaterial color={dieColor} roughness={0.32} clearcoat={0.6} clearcoatRoughness={0.25} />
      </RoundedBox>
      <instancedMesh ref={pips} args={[pipGeo, pipMat, PIP_MATRICES.length]} />
    </>
  )
}

function Tray({ feltColor, rimColor }) {
  const W = TRAY.x
  const Z = TRAY.z
  const T = 0.32
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[2 * W, 2 * Z]} />
        <meshStandardMaterial color={feltColor} roughness={0.95} />
      </mesh>
      {/* the rim: four rails meeting at the corners */}
      {[
        [0, Z + T / 2, 2 * W + 2 * T, T],
        [0, -Z - T / 2, 2 * W + 2 * T, T],
        [W + T / 2, 0, T, 2 * Z],
        [-W - T / 2, 0, T, 2 * Z],
      ].map(([x, z, w, d], i) => (
        <RoundedBox key={i} args={[w, TRAY.wall, d]} radius={0.06} smoothness={3} position={[x, TRAY.wall / 2, z]} castShadow receiveShadow>
          <meshStandardMaterial color={rimColor} roughness={0.55} />
        </RoundedBox>
      ))}
    </group>
  )
}

// count: how many dice. dieColor, pipColor, feltColor, rimColor: the colours.
// sound: clacks and knocks. rollKey: change it to throw the dice (the scene's
// Roll button does). onResult(values) fires when the dice come to rest.
export default function Dice({ count = 2, dieColor = '#f5f5f3', pipColor = '#0b0b0c', feltColor = '#cfcfcf', rimColor = '#b9b9b9', sound = false, rollKey = 0, onResult, onRolling }) {
  const bodies = useMemo(() => makeBodies(count), [count])
  const { camera, controls, raycaster, pointer } = useThree()
  const state = useRef({ settled: true, quiet: 0, reported: true })
  const held = useRef(null) // { i, start, moved, target }
  const audio = useRef(null)
  const live = useRef({})
  live.current = { sound, onResult, onRolling }
  const [, force] = useState(0)
  useEffect(() => () => audio.current?.dispose(), [])

  const wake = () => {
    state.current.settled = false
    state.current.quiet = 0
    state.current.reported = false
    live.current.onRolling?.()
  }

  const roll = () => {
    bodies.forEach((b, i) => {
      b.p.set(-TRAY.x + 0.9 + (i % 3) * 0.3, 2.2 + i * 1.1, (Math.random() - 0.5) * 2.4)
      b.q.setFromEuler(new THREE.Euler(Math.random() * 6.28, Math.random() * 6.28, Math.random() * 6.28))
      b.v.set(4 + Math.random() * 2.5, 1 + Math.random() * 2, (Math.random() - 0.5) * 3)
      b.w.set((Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30)
      b.still = 0
    })
    wake()
  }
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    roll()
  }, [rollKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // pick a die up: it follows the pointer above the tray; let go to throw it
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), -2.2), [])
  const grab = (e, i) => {
    e.stopPropagation()
    held.current = { i, start: performance.now(), x: e.clientX, y: e.clientY, moved: false, target: bodies[i].p.clone() }
    bodies[i].held = true
    if (controls) controls.enabled = false
    document.body.style.cursor = 'grabbing'
    wake()
  }
  useEffect(() => {
    const move = (e) => {
      const h = held.current
      if (h && Math.hypot(e.clientX - h.x, e.clientY - h.y) > 6) h.moved = true
    }
    const up = () => {
      const h = held.current
      if (!h) return
      const b = bodies[h.i]
      b.held = false
      if (!h.moved) {
        // a click: flip it over where it lies
        b.v.set((Math.random() - 0.5) * 2, 7, (Math.random() - 0.5) * 2)
        b.w.set((Math.random() - 0.5) * 22, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 22)
      } else {
        // a throw: keep the speed it had, and give it a tumble
        b.w.add(new THREE.Vector3((Math.random() - 0.5) * 18, (Math.random() - 0.5) * 18, (Math.random() - 0.5) * 18))
      }
      held.current = null
      if (controls) controls.enabled = true
      document.body.style.cursor = ''
      wake()
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [bodies, controls])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 30)
    const st = state.current
    const h = held.current
    if (h) {
      raycaster.setFromCamera(pointer, camera)
      if (raycaster.ray.intersectPlane(plane, tmp.wp)) {
        h.target.set(
          THREE.MathUtils.clamp(tmp.wp.x, -TRAY.x + 0.7, TRAY.x - 0.7),
          2.2,
          THREE.MathUtils.clamp(tmp.wp.z, -TRAY.z + 0.7, TRAY.z - 0.7),
        )
      }
    }
    if (st.settled && !h) return

    const hstep = dt / STEPS
    let maxSpeed = 0
    for (let s = 0; s < STEPS; s++) {
      for (const b of bodies) {
        if (b.held) {
          // carried: a stiff spring to the pointer, spinning slowly down
          b.v.lerp(tmp.c.copy(h.target).sub(b.p).multiplyScalar(14), Math.min(1, hstep * 30))
          b.w.multiplyScalar(1 - hstep * 4)
        } else {
          b.v.y -= G * hstep
          b.v.multiplyScalar(1 - hstep * 0.05)
          b.w.multiplyScalar(1 - hstep * 0.2)
        }
        b.p.addScaledVector(b.v, hstep)
        // integrate the spin: dq = 0.5 * (0, w) * q
        tmp.dq.set(b.w.x, b.w.y, b.w.z, 0).multiply(b.q)
        b.q.x += 0.5 * hstep * tmp.dq.x
        b.q.y += 0.5 * hstep * tmp.dq.y
        b.q.z += 0.5 * hstep * tmp.dq.z
        b.q.w += 0.5 * hstep * tmp.dq.w
        b.q.normalize()
      }
      // contacts, a couple of passes so stacks settle
      for (let pass = 0; pass < 2; pass++) {
        for (let i = 0; i < bodies.length; i++) {
          const b = bodies[i]
          let hit = 0
          let floorHit = 0
          for (const [n, d] of WALLS) {
            const v = planeContacts(b, n, d)
            if (n.y === 1) floorHit = Math.max(floorHit, v)
            else hit = Math.max(hit, v)
          }
          let dieHit = 0
          for (let j = i + 1; j < bodies.length; j++) {
            const o = bodies[j]
            if (b.p.distanceToSquared(o.p) > 3.1) continue // farther than corner to corner
            dieHit = Math.max(dieHit, boxContacts(b, o), boxContacts(o, b))
            // keep the cores apart, for edge-on-edge hits the corner test misses
            const d = tmp.n.subVectors(b.p, o.p)
            const len = d.length()
            if (len < 0.98 && len > 1e-6) {
              d.divideScalar(len)
              const push = (0.98 - len) * 0.5
              if (!b.held) b.p.addScaledVector(d, push)
              if (!o.held) o.p.addScaledVector(d, -push)
            }
          }
          if (pass === 0 && live.current.sound) {
            const now = performance.now()
            const loud = Math.max(hit, floorHit, dieHit)
            if (loud > 1.2 && now - b.lastSound > 45) {
              b.lastSound = now
              audio.current ??= createDiceAudio()
              if (dieHit >= Math.max(hit, floorHit)) audio.current?.clack(loud / 8)
              else audio.current?.knock(loud / 10)
            }
          }
        }
      }
    }

    // rest: a die that has been nearly still for a moment is stopped dead,
    // so it doesn't creep; when all have stopped, read the faces
    let allStill = true
    for (const b of bodies) {
      const slow = b.v.lengthSq() < 0.02 && b.w.lengthSq() < 0.05 && !b.held
      b.still = slow ? b.still + dt : 0
      if (b.still > 0.25) {
        b.v.set(0, 0, 0)
        b.w.set(0, 0, 0)
      } else allStill = false
      maxSpeed = Math.max(maxSpeed, b.v.length())
      if (b.group?.current) {
        b.group.current.position.copy(b.p)
        b.group.current.quaternion.copy(b.q)
      }
    }
    if (allStill && !h) {
      // a die left cocked against another or a wall gets a nudge to fall flat
      const cocked = bodies.find((b) => upFace(b.q).flat < 0.97)
      if (cocked) {
        cocked.v.set((Math.random() - 0.5) * 2, 3, (Math.random() - 0.5) * 2)
        cocked.w.set((Math.random() - 0.5) * 8, 0, (Math.random() - 0.5) * 8)
        cocked.still = 0
        return
      }
      st.settled = true
      if (!st.reported) {
        st.reported = true
        live.current.onResult?.(bodies.map((b) => upFace(b.q).value))
      }
    }
  })

  // report the starting faces once
  useEffect(() => {
    onResult?.(bodies.map((b) => upFace(b.q).value))
    force((n) => n + 1)
  }, [bodies]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <group>
      <Tray feltColor={feltColor} rimColor={rimColor} />
      {bodies.map((b, i) => (
        <Die key={`${count}-${i}`} body={b} index={i} dieColor={dieColor} pipColor={pipColor} onGrab={grab} />
      ))}
    </group>
  )
}

export { TRAY }
