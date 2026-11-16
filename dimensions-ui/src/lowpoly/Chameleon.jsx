import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Flat, Stage, TAU, blob, cone, facet, rng, useGeo, useTap } from './kit.jsx'

// A low-poly chameleon gripping a branch that grows up out of a mossy patch.
// A tall, flattened faceted body with a spiny crest, a casqued head, a tail
// rolled into a spiral, four bent legs whose zygodactyl feet (two toe
// bundles each) clasp the branch, and two cone turret eyes, each on its own
// pivot. The legs are two-bone IK chains: the feet stay planted while the
// body rocks on the branch, and now and then it takes a slow, deliberate
// step forward (or back), one foot at a time. Each eye darts about on its
// own. Tap it and both eyes swing forward onto the fly buzzing ahead of it,
// the tongue shoots out along a straight line, snaps the fly back into its
// mouth, and its skin floods to another palette before easing back.

const clamp = (u) => Math.max(0, Math.min(1, u))
const ease = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u))
const easeOut = (u) => 1 - (1 - clamp(u)) ** 3
const bump = (s, a, b) => (s <= a || s >= b ? 0 : Math.sin((Math.PI * (s - a)) / (b - a)))
const hash = (n) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

// each look: a resting palette and the one it flushes to on a tap
const LOOKS = {
  jade: {
    casque: [0.08, 0.085, 0.042, 0.5],
    base: { main: '#4cae5a', stripe: '#a8dc5e', belly: '#e1efa2', accent: '#2d8a4c', spot: '#f1f7b4', eye: '#5cbc66' },
    shift: { main: '#2e9fba', stripe: '#7fe5d4', belly: '#d6f4ec', accent: '#1d6a9c', spot: '#ffffff', eye: '#3aaac4' },
  },
  panther: {
    casque: [0.075, 0.07, 0.04, 0.55],
    base: { main: '#2f80d4', stripe: '#e2483a', belly: '#bfe5ff', accent: '#1d55a6', spot: '#f4f8fc', eye: '#3c8edb' },
    shift: { main: '#ec5a2a', stripe: '#ffd23f', belly: '#ffe4a6', accent: '#b5301e', spot: '#fff5d8', eye: '#f06a32' },
  },
  veiled: {
    casque: [0.105, 0.2, 0.036, 0.32],
    base: { main: '#5aa93b', stripe: '#f2c53c', belly: '#cfe881', accent: '#3b8a2a', spot: '#84d8c6', eye: '#64b240' },
    shift: { main: '#2e4b3d', stripe: '#ff9a2c', belly: '#71915c', accent: '#1b3227', spot: '#5ccbec', eye: '#37594b' },
  },
  sunset: {
    casque: [0.08, 0.09, 0.042, 0.5],
    base: { main: '#ff7f3c', stripe: '#d8407c', belly: '#ffd46c', accent: '#df522b', spot: '#fff1ba', eye: '#ff8c46' },
    shift: { main: '#8a47b9', stripe: '#ff60a8', belly: '#f6b8e0', accent: '#5d2d8e', spot: '#ffe2f4', eye: '#9b54c6' },
  },
}

const BARK = ['#8a6142', '#6e4b31']
const LEAF = ['#6aab48', '#86c45a', '#559a40']
const MOSS = '#9cc46c'

// the branch, in the rig's space: up out of the ground, then out along +x
const BY = 0.78 // branch centre height where the chameleon sits
const BR = 0.055
const PATH = new THREE.CatmullRomCurve3([
  new THREE.Vector3(-0.98, -0.06, 0.16),
  new THREE.Vector3(-0.8, 0.34, 0.08),
  new THREE.Vector3(-0.56, 0.68, 0.02),
  new THREE.Vector3(-0.3, BY, 0),
  new THREE.Vector3(0.35, BY, 0),
  new THREE.Vector3(0.85, BY + 0.015, 0),
  new THREE.Vector3(1.16, BY + 0.06, -0.02),
])
const radAt = (u) => BR * (1 + 0.8 * clamp((0.32 - u) / 0.32)) * (1 - 0.5 * clamp((u - 0.72) / 0.28))
const TABLE = Array.from({ length: 241 }, (_, i) => {
  const p = PATH.getPointAt(i / 240)
  return [p.x, p.y, radAt(i / 240)]
})
// the branch's centre height and radius at x
function branchAt(x) {
  for (let i = 1; i < TABLE.length; i++)
    if (TABLE[i][0] >= x) {
      const a = TABLE[i - 1]
      const b = TABLE[i]
      const k = (x - a[0]) / Math.max(1e-6, b[0] - a[0])
      return [a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]
    }
  return [TABLE[240][1], TABLE[240][2]]
}

// a tube along a curve whose radius follows radius(u), faceted
function tubeGeo(path, segs, R, radius, seed, sides = 7) {
  const g = new THREE.TubeGeometry(path, segs, R, sides, false)
  const p = g.attributes.position
  const c = new THREE.Vector3()
  for (let i = 0; i <= segs; i++) {
    path.getPointAt(i / segs, c)
    const k = radius(i / segs) / R
    for (let j = 0; j <= sides; j++) {
      const n = i * (sides + 1) + j
      p.setXYZ(n, c.x + (p.getX(n) - c.x) * k, c.y + (p.getY(n) - c.y) * k, c.z + (p.getZ(n) - c.z) * k)
    }
  }
  return facet(g, R * 0.1, seed)
}

const TWIG_FROM = PATH.getPointAt(0.8)
const TWIG = new THREE.CatmullRomCurve3([TWIG_FROM.clone(), TWIG_FROM.clone().add(new THREE.Vector3(0.06, 0.16, -0.12)), TWIG_FROM.clone().add(new THREE.Vector3(0.04, 0.36, -0.28))])

// body plan (body-local: x forward, y up, z to the right)
const BODY_Y = 1.03 // body centre height above the ground
const BODY = [0.3, 0.19, 0.115] // main ellipsoid half-sizes
const topAt = (x) => BODY[1] * Math.sqrt(Math.max(0, 1 - (x / BODY[0]) ** 2))
const sideAt = (x, y) => BODY[2] * Math.sqrt(Math.max(0, 1 - (x / BODY[0]) ** 2 - (y / BODY[1]) ** 2))

// legs in step order: hip (body-local, buried in the body), foot x on the branch
const LEGS = [
  { hip: [-0.15, -0.06, -0.065], foot: -0.2, side: -1, fore: false },
  { hip: [0.15, -0.06, -0.065], foot: 0.25, side: -1, fore: true },
  { hip: [-0.17, -0.06, 0.065], foot: -0.29, side: 1, fore: false },
  { hip: [0.13, -0.06, 0.065], foot: 0.17, side: 1, fore: true },
]
const UPPER = 0.13
const LOWER = 0.125

// tail links: lengths and radii, rolling tighter towards the tip
const NT = 15
const TL = Array.from({ length: NT }, (_, i) => 0.082 - 0.0026 * i)
const TR = Array.from({ length: NT + 1 }, (_, i) => 0.009 + 0.048 * (1 - i / NT) ** 1.1)
const TW = Array.from({ length: NT }, (_, i) => 0.1 + 2.1 * (i / (NT - 1)) ** 2)

const FLY = new THREE.Vector3(1.0, 1.05, 0.03)
const MOUTH = new THREE.Vector3(0.205, -0.04, 0)

// slow steps: every STEP_EVERY seconds it shuffles STEP forward, then back
const STEP_EVERY = 9
const STEP_START = 5
const STEP_DUR = 3.6
const STEP = 0.09
function stepAt(t) {
  const n = Math.floor(t / STEP_EVERY)
  const u = clamp((t - n * STEP_EVERY - STEP_START) / STEP_DUR)
  const p0 = n % 2 ? STEP : 0
  const p1 = n % 2 ? 0 : STEP
  return {
    body: p0 + (p1 - p0) * ease(u),
    feet: LEGS.map((_, i) => {
      const v = clamp((u - i * 0.22) / 0.34)
      return { x: p0 + (p1 - p0) * ease(v), lift: Math.sin(Math.PI * v) * 0.055 }
    }),
  }
}

// the tap, in seconds since it: tongue out and back, then the colour wash
const tongueAt = (s) => (s < 0.2 ? 0 : s < 0.32 ? easeOut((s - 0.2) / 0.12) : s < 0.75 ? 1 : s < 1.0 ? 1 - ease((s - 0.75) / 0.25) : 0)
const shiftAt = (s) => (s < 0.12 ? 0 : s < 0.55 ? ease((s - 0.12) / 0.43) : s < 2.4 ? 1 : s < 4.2 ? 1 - ease((s - 2.4) / 1.8) : 0)
const BUSY = 3.6

const _Y = new THREE.Vector3(0, 1, 0)
const _d = new THREE.Vector3()
const _u = new THREE.Vector3()
const _w = new THREE.Vector3()
// stretch a unit-height cylinder (base at the origin, along +y) from a to b
function span(m, a, b) {
  _d.subVectors(b, a)
  const L = Math.max(1e-4, _d.length())
  m.position.copy(a)
  m.quaternion.setFromUnitVectors(_Y, _d.divideScalar(L))
  m.scale.set(1, L, 1)
}
// two-bone IK: the knee between hip H and foot F, bent towards hint
function knee(H, F, a, b, hint, out) {
  _u.subVectors(F, H)
  const d = Math.min(a + b - 1e-3, Math.max(Math.abs(a - b) + 1e-3, _u.length()))
  _u.normalize()
  const x = (a * a - b * b + d * d) / (2 * d)
  const h = Math.sqrt(Math.max(0, a * a - x * x))
  _w.copy(hint).addScaledVector(_u, -hint.dot(_u)).normalize()
  return out.copy(H).addScaledVector(_u, x).addScaledVector(_w, h)
}

export function Chameleon({ look = 'jade' }) {
  const L = LOOKS[look] || LOOKS.jade
  const { tap, handlers, clock } = useTap(1)
  const r = useRef({})
  const set = (k) => (o) => (r.current[k] = o)
  const legs = useRef([])
  const eyes = useRef([])
  const tail = useRef([])
  const wings = useRef([])
  const st = useRef({ t0: null, eyes: [{ y: 0.3, p: 0 }, { y: -0.2, p: 0.1 }], aim: new THREE.Vector3().copy(FLY), fly: new THREE.Vector3().copy(FLY) })
  const tmp = useMemo(() => ({ H: new THREE.Vector3(), F: new THREE.Vector3(), K: new THREE.Vector3(), M: new THREE.Vector3(), T: new THREE.Vector3(), hint: new THREE.Vector3() }), [])

  // shared skin materials, so the colour wash reaches every part at once
  const mats = useMemo(() => Object.fromEntries(Object.entries(L.base).map(([k, c]) => [k, new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.68, metalness: 0 })])), [L])
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats])
  const pal = useMemo(() => {
    const A = {}
    const B = {}
    for (const k of Object.keys(L.base)) {
      A[k] = new THREE.Color(L.base[k])
      B[k] = new THREE.Color(L.shift[k])
    }
    return { A, B }
  }, [L])

  const geo = useGeo(
    () => ({
      ball: blob(1, 3, 1),
      ball2: blob(1, 7, 1),
      lowball: blob(1, 11, 0),
      branch: tubeGeo(PATH, 40, BR, radAt, 21),
      twig: tubeGeo(TWIG, 10, 0.022, (u) => 0.022 * (1 - 0.6 * u), 22, 5),
      spike: cone(0.02, 0.042, 4, 5),
      upper: facet(new THREE.CylinderGeometry(0.022, 0.03, 1, 6).translate(0, 0.5, 0), 0.002, 8),
      lower: facet(new THREE.CylinderGeometry(0.017, 0.022, 1, 6).translate(0, 0.5, 0), 0.002, 9),
      tail: TL.map((l, i) => facet(new THREE.CylinderGeometry(TR[i + 1], TR[i], l * 1.12, 7).translate(0, l / 2, 0).rotateZ(Math.PI / 2), TR[i] * 0.05, 30 + i)),
      turret: facet(new THREE.CylinderGeometry(0.019, 0.047, 0.056, 8).rotateX(Math.PI / 2).translate(0, 0, 0.038), 0.002, 12),
      pupil: new THREE.IcosahedronGeometry(0.014, 0),
      tongue: new THREE.CylinderGeometry(0.011, 0.016, 1, 6).translate(0, 0.5, 0),
      leaf: facet(new THREE.OctahedronGeometry(1, 0).scale(1, 0.14, 0.55).translate(1, 0, 0), 0.04, 13),
      ground: facet(new THREE.CylinderGeometry(0.95, 1.0, 0.12, 16, 1).translate(0, -0.06, 0), 0.03, 14, [1, 0.4, 1], (x, y) => y > -0.001),
      mound: facet(new THREE.SphereGeometry(1, 9, 5, 0, TAU, 0, Math.PI / 2), 0.06, 15),
      rock: blob(1, 16, 0),
      wing: new THREE.IcosahedronGeometry(1, 0),
      hit: new THREE.BoxGeometry(1.05, 0.8, 0.5),
    }),
    [],
  )

  // leaves on the twig, at the branch tip and low on the stem
  const leaves = useMemo(() => {
    const rr = rng(5)
    const cluster = (p, n, s0) =>
      Array.from({ length: n }, (_, i) => ({ pos: [p.x + (rr() - 0.5) * 0.04, p.y + (rr() - 0.5) * 0.04, p.z + (rr() - 0.5) * 0.04], rot: [(rr() - 0.5) * 1.6, (i / n) * TAU + rr() * 0.8, -0.2 - rr() * 0.6], s: s0 * (0.8 + rr() * 0.4), c: LEAF[(i + n) % LEAF.length] }))
    return [...cluster(TWIG.getPointAt(1), 6, 0.11), ...cluster(TWIG.getPointAt(0.55), 3, 0.09), ...cluster(PATH.getPointAt(1), 5, 0.1), ...cluster(PATH.getPointAt(0.12), 3, 0.1)]
  }, [])

  // spines along the back and a pale fringe under the belly and chin
  const crest = useMemo(() => {
    const out = []
    for (let x = -0.25; x <= 0.25; x += 0.036) {
      const y = topAt(x)
      const th = Math.atan2(-x / BODY[0] ** 2, y / BODY[1] ** 2)
      out.push({ pos: [x, y - 0.012, 0], rot: th - 0.25, s: 0.75 + 0.45 * (1 - Math.abs(x - 0.08) / 0.33), top: true })
      if (x > -0.2 && x < 0.22) out.push({ pos: [x, -y + 0.016, 0], rot: Math.PI - th * 0.5, s: 0.45, top: false })
    }
    return out
  }, [])

  // dots scattered over the flanks
  const spots = useMemo(() => {
    const rr = rng(8)
    return Array.from({ length: 16 }, (_, i) => {
      const x = -0.22 + rr() * 0.42
      const y = -0.02 + rr() * 0.12
      const side = i % 2 ? 1 : -1
      return { pos: [x, y, side * (sideAt(x, y) - 0.004)], s: 0.011 + rr() * 0.008 }
    })
  }, [])

  useFrame((_, dt) => {
    const t = clock.elapsedTime
    const o = r.current
    const S = st.current
    if (!o.rig) return
    const step = Math.min(dt, 0.05)
    const s = tap.since(t)
    const busy = s >= 0 && s < BUSY
    if (busy && S.t0 !== t - s) {
      S.t0 = t - s
      S.aim.copy(S.fly)
    }
    const ext = busy ? tongueAt(s) : 0
    const kc = busy || s < 4.3 ? shiftAt(s) : 0
    const hunt = busy && s < 1.3 ? 1 : 0

    // body: rocks on the branch, breathes, recoils as the tongue fires
    const W = stepAt(t)
    const bx = W.body - 0.025 * bump(s, 0.18, 1.1)
    o.sway.position.set(bx + 0.016 * Math.sin(t * 0.9 + 1), BY, 0)
    o.sway.rotation.x = 0.06 * Math.sin(t * 0.5)
    o.body.position.y = BODY_Y - BY + 0.006 * Math.sin(t * 1.6)
    o.body.rotation.z = 0.035 * Math.sin(t * 0.5 + 0.7) + 0.04 * bump(s, 0.15, 1.1)
    o.body.scale.set(1, 1 + 0.02 * Math.sin(t * 1.6), 1 + 0.035 * Math.sin(t * 1.6))

    // head: small idle turns; level and still while it hunts
    const hk = 1 - Math.exp(-step * 6)
    o.head.rotation.y += ((hunt ? 0 : 0.1 * Math.sin(t * 0.31)) - o.head.rotation.y) * hk
    o.head.rotation.z += ((hunt ? -0.03 : 0.06 * Math.sin(t * 0.43 + 1)) - o.head.rotation.z) * hk
    const gulp = s > 1.05 && s < 1.9 ? 0.08 * Math.abs(Math.sin((s - 1.05) * 11)) : 0
    o.jaw.rotation.z = -0.42 * bump(s, 0.14, 1.04) - gulp

    // tail: the curl breathes, and rolls tighter as the colour floods
    const curl = 0.42 + 0.05 * Math.sin(t * 0.8) + 0.07 * kc
    tail.current.forEach((g, i) => {
      if (!g) return
      g.rotation.z = curl * TW[i]
      g.rotation.y = 0.035 * Math.sin(t * 0.9 - i * 0.45)
    })

    // eyes: each darts to its own new spot every second or so; on a tap both
    // swing forward, onto the fly
    S.eyes.forEach((E, i) => {
      const per = [1.25, 1.65][i]
      const n = Math.floor((t + i * 0.7) / per)
      let yaw = -0.75 + 1.85 * hash(n * 3 + i * 41)
      let pitch = -0.5 + 1.0 * hash(n * 3 + i * 41 + 17)
      if (hunt) {
        yaw = 1.22
        pitch = 0.05
      }
      const k = 1 - Math.exp(-step * (hunt ? 20 : 13))
      E.y += (yaw - E.y) * k
      E.p += (pitch - E.p) * k
      const e = eyes.current[i]
      if (e) e.rotation.set(-E.p + 0.02 * Math.sin(t * 7 + i), E.y, 0, 'YXZ')
    })

    // the colour wash
    for (const k in mats) mats[k].color.lerpColors(pal.A[k], pal.B[k], kc)

    // legs: two-bone chains from the hips (riding with the body) to feet
    // planted on the branch; each lifts and moves in turn during a step
    o.rig.updateMatrixWorld(true)
    LEGS.forEach((D, i) => {
      const g = legs.current[i]
      if (!g || !g.up || !g.lo || !g.knee || !g.foot) return
      const f = W.feet[i]
      const fx = D.foot + f.x
      const [cy, cr] = branchAt(fx)
      g.foot.position.set(fx, cy + f.lift, 0)
      g.foot.rotation.z = f.lift * (D.fore ? -3 : 3)
      tmp.F.set(fx, cy + cr + 0.014 + f.lift, D.side * 0.012)
      tmp.H.set(...D.hip)
      o.body.localToWorld(tmp.H)
      o.rig.worldToLocal(tmp.H)
      tmp.hint.set(D.fore ? -0.55 : 0.55, 0.35, D.side)
      knee(tmp.H, tmp.F, UPPER, LOWER, tmp.hint, tmp.K)
      span(g.up, tmp.H, tmp.K)
      span(g.lo, tmp.K, tmp.F)
      g.knee.position.copy(tmp.K)
    })

    // the fly: buzzes about ahead; held still once the tongue is coming,
    // stuck to the tongue tip, gone, then flies back in
    const hover = tmp.T.set(FLY.x + 0.05 * Math.sin(t * 1.9), FLY.y + 0.035 * Math.sin(t * 2.7 + 1), FLY.z + 0.05 * Math.cos(t * 1.4))
    tmp.M.copy(MOUTH)
    o.head.localToWorld(tmp.M)
    o.rig.worldToLocal(tmp.M)
    const tip = o.tip.position.copy(tmp.M).lerp(S.aim, ext)
    o.tongue.visible = o.tip.visible = ext > 0.01
    if (o.tongue.visible) span(o.tongue, tmp.M, tip)
    let flyOn = true
    if (busy && s < 0.32) S.fly.copy(S.aim)
    else if (busy && s < 1.0) S.fly.copy(tip)
    else if (busy && s < 2.4) flyOn = false
    else if (busy && s < 3.4) {
      const u = ease((s - 2.4) / 1.0)
      S.fly.set(hover.x + 0.8 * (1 - u), hover.y + 0.55 * (1 - u), hover.z + 0.6 * (1 - u))
    } else S.fly.copy(hover)
    o.fly.visible = flyOn
    o.fly.position.copy(S.fly)
    o.fly.rotation.y = Math.sin(t * 2.2) * 0.8
    const flap = busy && s >= 0.32 && s < 1.0 ? 0.2 : Math.sin(t * 70)
    wings.current.forEach((w, i) => w && (w.rotation.x = (i ? 1 : -1) * (0.35 + 0.45 * flap)))

    o.leaves.rotation.z = 0.025 * Math.sin(t * 0.7)
  })

  const c = L.casque
  return (
    <group
      {...handlers}
      onClick={(e) => {
        e.stopPropagation()
        const s = tap.since(clock.elapsedTime)
        if (!(s >= 0 && s < BUSY)) tap.kick(clock.elapsedTime)
      }}
    >
      {/* a mossy patch with a few stones */}
      <group position={[-0.15, 0, 0.05]}>
        <mesh geometry={geo.ground}>
          <Flat color={MOSS} />
        </mesh>
        <mesh geometry={geo.mound} position={[-0.55, 0, 0.0]} scale={[0.36, 0.12, 0.3]}>
          <Flat color="#86b25a" />
        </mesh>
        {[
          [0.55, 0.35, 0.09],
          [0.75, -0.2, 0.06],
          [-0.2, -0.55, 0.07],
          [0.25, 0.65, 0.05],
        ].map(([x, z, s], i) => (
          <mesh key={i} geometry={geo.rock} position={[x, s * 0.4, z]} scale={[s * 1.3, s, s]} rotation-y={i}>
            <Flat color={i % 2 ? '#b9b2a6' : '#a7a094'} />
          </mesh>
        ))}
      </group>

      <group rotation-y={0.5} ref={set('rig')}>
        {/* the branch, a twig and their leaves */}
        <mesh geometry={geo.branch}>
          <Flat color={BARK[0]} />
        </mesh>
        <mesh geometry={geo.ball} position={PATH.getPointAt(1).toArray()} scale={radAt(1) * 1.05}>
          <Flat color={BARK[0]} />
        </mesh>
        <mesh geometry={geo.twig}>
          <Flat color={BARK[1]} />
        </mesh>
        <group ref={set('leaves')} position={TWIG_FROM.toArray()}>
          <group position={TWIG_FROM.clone().negate().toArray()}>
            {leaves.slice(0, 9).map((l, i) => (
              <mesh key={i} geometry={geo.leaf} position={l.pos} rotation={l.rot} scale={l.s}>
                <Flat color={l.c} side={THREE.DoubleSide} />
              </mesh>
            ))}
          </group>
        </group>
        {leaves.slice(9).map((l, i) => (
          <mesh key={`x${i}`} geometry={geo.leaf} position={l.pos} rotation={l.rot} scale={l.s}>
            <Flat color={l.c} side={THREE.DoubleSide} />
          </mesh>
        ))}

        {/* an invisible box round the chameleon, so a tap on it always lands */}
        <mesh geometry={geo.hit} position={[0.08, 1.0, 0]}>
          <meshBasicMaterial visible={false} />
        </mesh>

        {/* the chameleon: sway (on the branch line) > body > head, tail */}
        <group ref={set('sway')}>
          <group ref={set('body')}>
            <mesh geometry={geo.ball} scale={BODY} material={mats.main} />
            <mesh geometry={geo.ball2} position={[-0.17, -0.01, 0]} scale={[0.14, 0.155, 0.1]} material={mats.main} />
            <mesh geometry={geo.ball2} position={[0.16, -0.01, 0]} scale={[0.14, 0.165, 0.105]} material={mats.main} />
            <mesh geometry={geo.ball} position={[0.0, -0.11, 0]} scale={[0.24, 0.075, 0.082]} material={mats.belly} />
            {/* shoulders and haunches over the leg tops */}
            {LEGS.map((D, i) => (
              <mesh key={`j${i}`} geometry={geo.ball2} position={[D.hip[0], -0.05, D.side * 0.07]} scale={[0.065, 0.075, 0.05]} material={mats.main} />
            ))}
            {/* bands down the flanks, and dots */}
            {[-0.17, -0.06, 0.05, 0.16].map((x) =>
              [-1, 1].map((sd) => (
                <mesh key={`b${x}${sd}`} geometry={geo.lowball} position={[x, 0.03, sd * (sideAt(x, 0.03) - 0.006)]} scale={[0.026, 0.13 * Math.sqrt(1 - (x / 0.3) ** 2), 0.016]} rotation-z={-0.18} material={mats.stripe} />
              )),
            )}
            {spots.map((p, i) => (
              <mesh key={`s${i}`} geometry={geo.lowball} position={p.pos} scale={[p.s, p.s, p.s * 0.6]} material={mats.spot} />
            ))}
            {crest.map((p, i) => (
              <mesh key={`c${i}`} geometry={geo.spike} position={p.pos} rotation-z={p.rot} scale={p.s} material={p.top ? mats.accent : mats.spot} />
            ))}

            {/* neck and head */}
            <mesh geometry={geo.ball2} position={[0.22, 0.01, 0]} scale={[0.1, 0.125, 0.09]} material={mats.main} />
            <group ref={set('head')} position={[0.29, 0.035, 0]}>
              <mesh geometry={geo.ball} position={[0.03, 0.01, 0]} scale={[0.12, 0.105, 0.085]} material={mats.main} />
              <mesh geometry={geo.ball2} position={[0.13, -0.015, 0]} scale={[0.085, 0.062, 0.06]} material={mats.main} />
              {/* the casque, swept back over the neck */}
              <group position={[-0.01, 0.035, 0]} rotation-z={c[3]}>
                <mesh geometry={geo.ball} position-y={c[1] * 0.55} scale={[c[0], c[1], c[2]]} material={mats.main} />
                <mesh geometry={geo.ball2} position={[-0.012, c[1] * 0.6, 0]} scale={[c[0] * 0.92, c[1] * 0.97, c[2] * 0.6]} material={mats.accent} />
              </group>
              {/* lips and a stripe from eye to jaw */}
              <mesh geometry={geo.ball} position={[0.08, -0.036, 0]} scale={[0.14, 0.012, 0.072]} material={mats.stripe} />
              {[-1, 1].map((sd) => (
                <mesh key={`k${sd}`} geometry={geo.lowball} position={[0.03, -0.01, sd * 0.075]} scale={[0.022, 0.04, 0.012]} rotation-z={0.3} material={mats.stripe} />
              ))}
              <group ref={set('jaw')} position={[-0.03, -0.035, 0]}>
                <mesh geometry={geo.ball} position={[0.1, -0.02, 0]} scale={[0.13, 0.038, 0.066]} material={mats.belly} />
                {[0.03, 0.07, 0.11, 0.15].map((x, i) => (
                  <mesh key={i} geometry={geo.spike} position={[x, -0.045, 0]} rotation-z={Math.PI - 0.2} scale={0.5 - i * 0.07} material={mats.spot} />
                ))}
              </group>
              {/* the turret eyes, each on its own pivot (+z looks out) */}
              {[-1, 1].map((sd, i) => (
                <group key={`e${sd}`} position={[0.06, 0.03, sd * 0.07]} scale={[1, 1, sd]}>
                  <group ref={(el) => (eyes.current[i] = el)}>
                    <mesh geometry={geo.ball2} scale={0.054} material={mats.eye} />
                    <mesh geometry={geo.turret} material={mats.eye} />
                    <mesh geometry={geo.turret} position-z={0.004} scale={[0.6, 0.6, 1.02]} material={mats.stripe} />
                    <mesh geometry={geo.pupil} position-z={0.07}>
                      <Flat color="#121016" roughness={0.2} />
                    </mesh>
                    <mesh geometry={geo.pupil} position={[0.004, 0.005, 0.08]} scale={0.3}>
                      <meshBasicMaterial color="#ffffff" />
                    </mesh>
                  </group>
                </group>
              ))}
            </group>

            {/* the tail, rolled into a spiral */}
            <group position={[-0.27, -0.03, 0]} rotation-z={0.3} rotation-y={0.18}>
              {(function link(i) {
                if (i === NT) return null
                return (
                  <group ref={(el) => (tail.current[i] = el)} position-x={i === 0 ? 0 : -TL[i - 1]}>
                    <mesh geometry={geo.tail[i]} material={i % 3 === 2 ? mats.stripe : mats.main} />
                    <mesh geometry={geo.lowball} scale={TR[i] * 1.02} material={i % 3 === 2 ? mats.stripe : mats.main} />
                    {link(i + 1)}
                  </group>
                )
              })(0)}
            </group>
          </group>
        </group>

        {/* legs and feet live in the rig's space; the frame loop places them */}
        {LEGS.map((D, i) => {
          const [, cr] = branchAt(D.foot)
          const R = cr + 0.012
          const put = (k) => (el) => (legs.current[i] = { ...legs.current[i], [k]: el })
          return (
            <group key={`g${i}`}>
              <mesh ref={put('up')} geometry={geo.upper} material={mats.main} />
              <mesh ref={put('lo')} geometry={geo.lower} material={mats.main} />
              <mesh ref={put('knee')} geometry={geo.lowball} scale={0.024} material={mats.main} />
              {/* a zygodactyl foot: a palm and two toe bundles, one down each side of the branch */}
              <group ref={put('foot')}>
                <mesh geometry={geo.lowball} position={[0, R + 0.004, D.side * 0.01]} scale={[0.03, 0.016, 0.026]} material={mats.main} />
                {[-1, 1].map((sd) =>
                  [0.5, 1.05, 1.55].map((ph, j) => (
                    <mesh key={`${sd}${j}`} geometry={geo.lowball} position={[0, R * Math.cos(ph), sd * R * Math.sin(ph)]} rotation-x={sd * ph} scale={[0.026 - j * 0.003, 0.014, 0.03]} material={j === 2 ? mats.accent : mats.main} />
                  )),
                )}
              </group>
            </group>
          )
        })}

        {/* the tongue and its sticky tip */}
        <mesh ref={set('tongue')} geometry={geo.tongue} visible={false}>
          <Flat color="#ff7b9a" roughness={0.4} />
        </mesh>
        <mesh ref={set('tip')} geometry={geo.ball} scale={0.03} visible={false}>
          <Flat color="#ff4f7d" roughness={0.3} />
        </mesh>

        {/* the fly */}
        <group ref={set('fly')} position={FLY.toArray()} scale={1.5}>
          <mesh geometry={geo.ball} scale={[0.024, 0.016, 0.016]}>
            <Flat color="#26252e" roughness={0.4} />
          </mesh>
          <mesh geometry={geo.ball} position-x={0.024} scale={0.012}>
            <Flat color="#7a2a2a" roughness={0.3} />
          </mesh>
          {[-1, 1].map((sd, i) => (
            <group key={sd} ref={(el) => (wings.current[i] = el)} position={[0, 0.01, 0]}>
              <mesh geometry={geo.wing} position={[-0.006, 0, sd * 0.024]} scale={[0.016, 0.002, 0.024]}>
                <meshStandardMaterial color="#e8f2ff" transparent opacity={0.6} roughness={0.2} flatShading depthWrite={false} />
              </mesh>
            </group>
          ))}
        </group>
      </group>
    </group>
  )
}

export default function ChameleonScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[2.35, 1.6, 3.35]} target={[0.12, 0.8, 0]} hint="The chameleon grips its branch and rocks gently, its turret eyes rolling about each on its own, its tail curl breathing; now and then it takes a slow step · tap it and both eyes lock on the fly, the tongue shoots out and snaps it up, and its skin flushes another colour before easing back · Look swaps jade, panther, veiled and sunset · drag to orbit">
      <Chameleon {...props} />
    </Stage>
  )
}
