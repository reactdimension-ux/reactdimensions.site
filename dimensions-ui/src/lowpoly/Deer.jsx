import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Burst, Flat, Stage, TAU, blinkAt, blob, facet, lookAround, rng, useGeo, useKick, useTap } from './kit.jsx'

// A low-poly deer on a meadow patch: a slim faceted body on long thin legs
// (each jointed at the knee or hock and hinged at the shoulder or hip, so it
// can fold them for a bound), a long two-part neck, a narrow head with big
// ears, a dark nose and eyes, a short white-fringed tail and branching
// antlers built from tapered tines. It grazes on its own: lowers its head to
// the grass, chews, lifts it to look about, flicks its ears and tail and
// blinks. Tap it and it throws its head up, alert, then bounds away in two
// springy leaps (legs tucked in the air, reaching out to land, a puff of dust
// each time) to the edge of the patch, turns and trots back to its spot.

// Antlers for the right side (+x); the left is mirrored. Each tine is a
// tapered cylinder [from, to, radius]; plates are flat palms [pos, rot, size].
const ANTLERS = {
  red: {
    tines: [
      [[0, 0, 0], [0.05, 0.15, -0.05], 0.022],
      [[0.05, 0.15, -0.05], [0.1, 0.3, -0.08], 0.019],
      [[0.1, 0.3, -0.08], [0.13, 0.44, -0.06], 0.016],
      [[0.13, 0.44, -0.06], [0.12, 0.57, 0.0], 0.013],
      [[0.02, 0.05, -0.01], [0.06, 0.1, 0.14], 0.012],
      [[0.06, 0.17, -0.05], [0.11, 0.22, 0.08], 0.011],
      [[0.1, 0.3, -0.08], [0.18, 0.37, 0.02], 0.01],
      [[0.13, 0.44, -0.06], [0.22, 0.54, -0.1], 0.009],
      [[0.13, 0.46, -0.06], [0.07, 0.56, -0.11], 0.009],
    ],
    plates: [],
  },
  fallow: {
    tines: [
      [[0, 0, 0], [0.05, 0.13, -0.04], 0.02],
      [[0.05, 0.13, -0.04], [0.1, 0.24, -0.08], 0.017],
      [[0.02, 0.05, -0.01], [0.04, 0.08, 0.12], 0.011],
      [[0.07, 0.17, -0.05], [0.11, 0.2, 0.07], 0.01],
      [[0.16, 0.42, -0.17], [0.2, 0.5, -0.24], 0.008],
      [[0.17, 0.46, -0.1], [0.21, 0.55, -0.13], 0.008],
      [[0.16, 0.46, -0.03], [0.19, 0.55, -0.02], 0.008],
      [[0.15, 0.4, 0.02], [0.17, 0.47, 0.06], 0.007],
      [[0.12, 0.32, -0.19], [0.13, 0.35, -0.27], 0.008],
    ],
    plates: [[[0.135, 0.35, -0.1], [-0.25, 0, -0.32], [0.016, 0.13, 0.11]]],
  },
  reindeer: {
    tines: [
      [[0, 0, 0], [0.07, 0.18, -0.12], 0.024],
      [[0.07, 0.18, -0.12], [0.15, 0.38, -0.22], 0.021],
      [[0.15, 0.38, -0.22], [0.21, 0.58, -0.18], 0.018],
      [[0.21, 0.58, -0.18], [0.22, 0.74, -0.04], 0.015],
      [[0.22, 0.74, -0.04], [0.18, 0.83, 0.08], 0.012],
      [[0.02, 0.05, 0], [0.02, 0.1, 0.13], 0.012],
      [[0.07, 0.18, -0.12], [0.16, 0.27, 0.03], 0.012],
      [[0.16, 0.27, 0.03], [0.2, 0.33, 0.1], 0.009],
      [[0.15, 0.38, -0.22], [0.15, 0.43, -0.36], 0.01],
      [[0.21, 0.58, -0.18], [0.33, 0.66, -0.26], 0.01],
      [[0.22, 0.74, -0.04], [0.33, 0.8, -0.09], 0.009],
      [[0.22, 0.72, -0.06], [0.13, 0.86, -0.12], 0.009],
      [[0.18, 0.83, 0.08], [0.25, 0.91, 0.13], 0.008],
    ],
    plates: [
      [[0.015, 0.12, 0.16], [0.5, 0, 0], [0.012, 0.07, 0.05]],
    ],
  },
}

const MEADOW = { ground: '#5cb84e', ground2: '#4fa844', tuft: '#3f9a3a', flowers: ['#f4c2d4', '#ffffff', '#ffd6e6', '#ffd23f'], dust: ['#c9b48a', '#e2d6bc', '#a99a74'] }
const SNOW = { ground: '#eef3f8', ground2: '#dfe7ef', tuft: '#b9b08a', flowers: ['#cfe6ff', '#ffffff', '#b8d8f0'], dust: ['#ffffff', '#e8f0f8', '#d6e2ee'] }

const LOOKS = {
  red: { coat: '#9c5a33', neck: '#7e4529', belly: '#d3b08a', rump: '#ead6b4', legs: '#7a4628', hoof: '#2b2320', nose: '#231c1c', earIn: '#e2c6a4', antler: '#d9c6a2', antlers: 'red', ...MEADOW },
  fallow: { coat: '#b0703a', neck: '#a5652f', belly: '#f2e6d0', rump: '#f6efe2', spots: '#f7efe0', legs: '#9a612e', hoof: '#2b2320', nose: '#231c1c', earIn: '#eed8bc', antler: '#cdb790', antlers: 'fallow', ...MEADOW },
  white: { coat: '#f2eee6', neck: '#ebe5da', belly: '#ffffff', rump: '#ffffff', legs: '#e6dfd2', hoof: '#6a5e54', nose: '#6a5054', earIn: '#f2cfc6', antler: '#efe4cc', antlers: 'red', ...MEADOW },
  reindeer: { coat: '#7d6a58', neck: '#8a7866', belly: '#e9e4da', rump: '#efebe4', ruff: '#f4f1ea', legs: '#4e4038', hoof: '#2a2420', nose: '#2a2422', earIn: '#d8cbb8', antler: '#cbb48e', antlers: 'reindeer', ...SNOW },
}

const ease = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u))
const clamp = (u) => Math.max(0, Math.min(1, u))
const mix = (A, B, k) => A.map((a, i) => a + (B[i] - a) * k)
function keys(u, K) {
  for (let i = 0; i < K.length - 1; i++) if (u <= K[i + 1][0]) return mix(K[i][1], K[i + 1][1], ease((u - K[i][0]) / (K[i + 1][0] - K[i][0])))
  return K[K.length - 1][1]
}

// leg poses: [fore upper, fore lower, hind upper, hind lower] (radians; +
// swings back). The fore knee folds back, the hind hock folds forward.
const STAND = [0, 0, 0.25, -0.45]
const CROUCH = [-0.35, 0.75, 0.55, -1.0]
const PUSH = [-0.5, 1.2, 0.8, -0.15]
const TUCK = [-0.4, 1.9, 0.95, -1.9]
const REACH = [-0.6, 0.1, 0.5, -0.35]
const LEAP = [[0, CROUCH], [0.15, PUSH], [0.4, TUCK], [0.65, TUCK], [1, REACH]]
const HOP = 0.3 // leap height
const DUR = 5.5
const GO = 1.0 // how far it bounds

const both = (P) => [[P[0], P[1]], [P[0], P[1]], [P[2], P[3]], [P[2], P[3]]]
const TROT_Q = [0, Math.PI, Math.PI, 0]

// the tap, as a pose: where it is (along its heading), how high, which way
// it faces, its pitch and its legs
function act(s) {
  const r = { busy: s >= 0 && s < DUR, z: 0, y: 0, yaw: 0, pitch: 0, legs: null, mode: 'idle' }
  if (!r.busy) return r
  const leapY = (u) => HOP * 4 * u * (1 - u) - 0.06 * (1 - u)
  if (s < 0.45) {
    r.mode = 'alert'
    r.legs = both(STAND)
  } else if (s < 0.65) {
    const k = ease((s - 0.45) / 0.2)
    r.mode = 'alert'
    r.legs = both(mix(STAND, CROUCH, k))
    r.y = -0.06 * k
  } else if (s < 1.2) {
    const u = (s - 0.65) / 0.55
    r.mode = 'leap'
    r.z = 0.5 * GO * u
    r.y = leapY(u)
    r.pitch = -0.22 * Math.cos(Math.PI * u)
    r.legs = both(keys(u, LEAP))
  } else if (s < 1.35) {
    const u = (s - 1.2) / 0.15
    r.mode = 'leap'
    r.z = 0.5 * GO
    r.y = -0.06 * ease(u)
    r.pitch = 0.22 * (1 - ease(u))
    r.legs = both(mix(REACH, CROUCH, ease(u)))
  } else if (s < 1.9) {
    const u = (s - 1.35) / 0.55
    r.mode = 'leap'
    r.z = 0.5 * GO + 0.5 * GO * u
    r.y = leapY(u)
    r.pitch = -0.22 * Math.cos(Math.PI * u)
    r.legs = both(keys(u, LEAP))
  } else if (s < 2.2) {
    const u = (s - 1.9) / 0.3
    r.mode = 'leap'
    r.z = GO
    r.y = -0.06 * Math.sin(Math.PI * u)
    r.pitch = 0.22 * (1 - ease(u * 2))
    r.legs = both(keys(u, [[0, REACH], [0.4, CROUCH], [1, STAND]]))
  } else {
    // turn round, trot home, turn back
    r.mode = 'trot'
    const p = (s - 2.2) * TAU * 2.4
    const A = clamp((s - 2.2) / 0.2) * clamp((DUR - 0.15 - s) / 0.2) * (0.6 + 0.4 * clamp((s - 2.9) / 0.25) * clamp((4.6 - s) / 0.25))
    if (s < 2.9) {
      r.z = GO
      r.yaw = Math.PI * ease((s - 2.2) / 0.7)
    } else if (s < 4.6) {
      r.z = GO * (1 - (s - 2.9) / 1.7)
      r.yaw = Math.PI
    } else {
      r.z = 0
      r.yaw = Math.PI + Math.PI * ease((s - 4.6) / 0.7)
    }
    r.y = 0.025 * Math.abs(Math.cos(p)) * A
    r.legs = TROT_Q.map((q, i) => {
      const sw = Math.sin(p + q)
      const lift = Math.max(0, Math.cos(p + q))
      return i < 2 ? [-0.4 * sw * A, 1.0 * lift * A] : [0.25 - 0.32 * sw * A, -0.45 - 0.8 * lift * A]
    })
  }
  return r
}

// the grazing cycle, in seconds of idle time: head down, graze, head up, look about
const CYCLE = 13
function grazeAt(it) {
  const c = it % CYCLE
  if (c < 1.3) return ease(c / 1.3)
  if (c < 6) return 1
  if (c < 7.2) return 1 - ease((c - 6) / 1.2)
  return 0
}

const HOME = -0.585 // faces three-quarters to the camera
const UP = new THREE.Vector3(0, 1, 0)
const BODY_Y = 0.86
const FORE = { x: 0.08, y: 0.76, z: 0.26, up: 0.34, lo: 0.38 }
const HIND = { x: 0.085, y: 0.76, z: -0.27, up: 0.36, lo: 0.38 }

export function Deer({ look = 'red' }) {
  const C = LOOKS[look] || LOOKS.red
  const design = ANTLERS[C.antlers] || ANTLERS.red
  const { tap, handlers, clock } = useTap(1.2)
  const land1 = useKick(3)
  const land2 = useKick(3)
  const r = useRef({})
  const set = (k) => (o) => (r.current[k] = o)
  const legs = useRef([])
  const ears = useRef([])
  const eyes = useRef([])
  const st = useRef({ it: 0, t0: null, landed: 0, n1: 0.55, n2: -0.15, hx: -0.25, yaw: 0, tail: 0.15, splay: 0.9 })
  const dust = useMemo(() => [
    [0, 0.05, 0],
    [0, 0.05, 0],
  ], [])

  const geo = useGeo(
    () => ({
      ball: blob(1, 3, 1),
      head: blob(1, 4, 1),
      upperF: facet(new THREE.CylinderGeometry(0.046, 0.03, FORE.up, 6).translate(0, -FORE.up / 2, 0), 0.003, 5),
      upperH: facet(new THREE.CylinderGeometry(0.05, 0.03, HIND.up, 6).translate(0, -HIND.up / 2, 0), 0.003, 6),
      lower: facet(new THREE.CylinderGeometry(0.024, 0.019, FORE.lo, 5).translate(0, -FORE.lo / 2, 0), 0.002, 7),
      hoof: facet(new THREE.CylinderGeometry(0.02, 0.028, 0.04, 6).translate(0, -0.02, 0), 0.002, 8),
      knee: new THREE.IcosahedronGeometry(1, 0),
      neck1: facet(new THREE.CylinderGeometry(0.068, 0.09, 0.32, 7).translate(0, 0.16, 0), 0.006, 9),
      neck2: facet(new THREE.CylinderGeometry(0.052, 0.068, 0.3, 7).translate(0, 0.15, 0), 0.005, 10),
      muzzle: facet(new THREE.CylinderGeometry(0.032, 0.055, 0.22, 7).translate(0, 0.11, 0).rotateX(Math.PI / 2), 0.004, 11),
      tine: new THREE.CylinderGeometry(0.65, 1, 1, 5).translate(0, 0.5, 0),
      ground: facet(new THREE.CylinderGeometry(1.6, 1.64, 0.14, 18, 1).translate(0, -0.07, 0), 0.02, 12, [1, 0.3, 1], (x, y) => y > -0.001),
      tuft: new THREE.ConeGeometry(0.025, 0.12, 4).translate(0, 0.06, 0),
      flower: new THREE.OctahedronGeometry(0.035, 0),
      dust: new THREE.IcosahedronGeometry(1, 0),
      hit: new THREE.CylinderGeometry(0.55, 0.55, 1.9, 8).translate(0, 0.95, 0),
    }),
    [],
  )

  // the antler tines placed once: position, turn and length
  const tines = useMemo(
    () =>
      design.tines.map(([a, b, rad]) => {
        const from = new THREE.Vector3(...a)
        const d = new THREE.Vector3(...b).sub(from)
        return { pos: a, quat: new THREE.Quaternion().setFromUnitVectors(UP, d.clone().normalize()), scale: [rad, d.length(), rad] }
      }),
    [design],
  )

  // fallow spots on the upper flanks
  const spots = useMemo(() => {
    if (!C.spots) return []
    const rr = rng(17)
    const R = [0.15, 0.17, 0.4]
    return Array.from({ length: 30 }, (_, i) => {
      const th = 0.45 + rr() * 0.75
      const side = i % 2 ? 1 : -1
      const z = (-0.8 + 1.5 * ((i * 0.618) % 1)) * 0.9
      const ph = Math.asin(Math.max(-1, Math.min(1, z)))
      const p = new THREE.Vector3(side * R[0] * Math.sin(th) * Math.cos(ph), R[1] * Math.cos(th), R[2] * Math.sin(ph))
      const n = new THREE.Vector3(p.x / R[0] ** 2, p.y / R[1] ** 2, p.z / R[2] ** 2).normalize()
      const sz = 0.016 + rr() * 0.008
      return { pos: [p.x, BODY_Y + p.y, p.z], quat: new THREE.Quaternion().setFromUnitVectors(UP, n), scale: [sz, sz * 0.35, sz * 1.2] }
    })
  }, [C])

  // grass tufts (a clump where it grazes) and flowers round the patch
  const decor = useMemo(() => {
    const rr = rng(9)
    const gx = Math.sin(HOME) * 0.72
    const gz = Math.cos(HOME) * 0.72
    const tufts = []
    for (let i = 0; i < 7; i++) tufts.push([gx + (rr() - 0.5) * 0.22, gz + (rr() - 0.5) * 0.22, 0.8 + rr() * 0.6, rr() * 6])
    for (let i = 0; i < 18; i++) {
      const a = rr() * TAU
      const d = 0.6 + rr() * 0.9
      tufts.push([Math.cos(a) * d, Math.sin(a) * d, 0.6 + rr() * 0.5, rr() * 6])
    }
    const flowers = Array.from({ length: 16 }, (_, i) => {
      const a = rr() * TAU
      const d = 0.55 + rr() * 0.95
      return [Math.cos(a) * d, Math.sin(a) * d, C.flowers[i % C.flowers.length]]
    })
    return { tufts, flowers }
  }, [C])

  useFrame((_, dt) => {
    const t = clock.elapsedTime
    const o = r.current
    const S = st.current
    const s = tap.since(t)
    const A = act(s)
    const step = Math.min(dt, 0.05)
    const t0 = t - s
    if (S.t0 !== t0) {
      S.t0 = t0
      S.landed = 0
    }
    if (!A.busy) S.it += step

    // a puff of dust under the forefeet on each landing
    const at = (z, d) => {
      const zz = z + 0.3
      d[0] = Math.sin(HOME) * zz
      d[2] = Math.cos(HOME) * zz
    }
    if (A.busy && S.landed === 0 && s >= 1.2) {
      S.landed = 1
      at(0.5 * GO, dust[0])
      land1.kick(t)
    }
    if (A.busy && S.landed === 1 && s >= 1.9) {
      S.landed = 2
      at(GO, dust[1])
      land2.kick(t)
    }

    o.act.position.set(0, A.y, A.z)
    o.act.rotation.y = A.yaw
    o.pitch.rotation.x = A.pitch

    // legs
    const L = A.legs || both(STAND)
    legs.current.forEach((g, i) => {
      if (!g || !g.up) return
      g.up.rotation.x = L[i][0]
      g.lo.rotation.x = L[i][1]
    })

    // neck and head: graze, look about; alert, run and trot poses on a tap
    const g = A.busy ? 0 : grazeAt(S.it)
    const la = lookAround(t, 0.6)
    let n1 = 0.55 + (2.0 - 0.55) * g
    let n2 = -0.15 + (0.9 + 0.15) * g
    let pitch = 0.4 + (1.45 - 0.4) * g + 0.06 * Math.sin(t * 3.1) * g + la.pitch * (1 - g)
    let yaw = la.yaw * (1 - g) * 0.8
    let tail = 0.15 + 0.9 * Math.max(0, Math.sin(t * 1.3)) ** 30 + 0.6 * Math.max(0, Math.sin(t * 0.55 + 2)) ** 40
    let splay = 0.95
    if (A.mode === 'alert') {
      n1 = 0.22
      n2 = -0.32
      pitch = -0.05
      yaw = 0
      tail = 1.5
      splay = 0.35
    } else if (A.mode === 'leap') {
      n1 = 0.45
      n2 = -0.2
      pitch = 0.1
      yaw = 0
      tail = 1.6
      splay = 0.5
    } else if (A.mode === 'trot') {
      n1 = 0.5
      n2 = -0.15
      pitch = 0.3
      yaw = 0
      tail = 0.7
      splay = 0.7
    }
    const k = 1 - Math.exp(-step * (A.mode === 'alert' ? 14 : 6))
    S.n1 += (n1 - S.n1) * k
    S.n2 += (n2 - S.n2) * k
    S.hx += (pitch - (n1 + n2) - S.hx) * k
    S.yaw += (yaw - S.yaw) * k
    S.tail += (tail - S.tail) * Math.min(1, k * 2)
    S.splay += (splay - S.splay) * k
    o.neck1.rotation.set(S.n1, S.yaw * 0.5, 0)
    o.neck2.rotation.set(S.n2, S.yaw * 0.3, 0)
    o.head.rotation.set(S.hx, S.yaw * 0.2, 0)
    // chewing: while grazing and for a while after
    const c = S.it % CYCLE
    const chew = !A.busy && (g > 0.5 || c < 10) ? 0.5 + 0.5 * Math.sin(t * 10) : 0
    o.jaw.position.y = -0.055 - 0.01 * chew
    o.jaw.rotation.x = 0.12 * chew
    o.tail.rotation.x = S.tail
    ears.current.forEach((e, i) => {
      if (!e) return
      const sx = i ? 1 : -1
      const f = Math.max(0, Math.sin(t * (0.9 + i * 0.23) + i * 2.3)) ** 40
      e.rotation.set(0.1, -sx * 0.4 * f, -sx * (S.splay + 0.45 * f))
    })
    eyes.current.forEach((e) => e && (e.scale.y = 0.018 * blinkAt(t, 3.9, 0.3)))
    // breathing
    o.torso.scale.set(1, 1 + 0.02 * Math.sin(t * 2), 1)
  })

  const legDefs = [
    [FORE, 1, true],
    [FORE, -1, true],
    [HIND, 1, false],
    [HIND, -1, false],
  ]

  return (
    <group
      {...handlers}
      onClick={(e) => {
        e.stopPropagation()
        if (!act(tap.since(clock.elapsedTime)).busy) tap.kick(clock.elapsedTime)
      }}
    >
      {/* a round patch of meadow (or snow) with tufts and flowers */}
      <mesh geometry={geo.ground}>
        <Flat color={C.ground} />
      </mesh>
      {decor.tufts.map(([x, z, k, ry], i) => (
        <group key={i} position={[x, 0, z]} rotation-y={ry} scale={k}>
          {[-1, 0, 1].map((j) => (
            <mesh key={j} geometry={geo.tuft} position-x={j * 0.025} rotation-z={j * 0.3} scale={[1, 1 - Math.abs(j) * 0.25, 1]}>
              <Flat color={j ? C.ground2 : C.tuft} />
            </mesh>
          ))}
        </group>
      ))}
      {decor.flowers.map(([x, z, c], i) => (
        <mesh key={`f${i}`} geometry={geo.flower} position={[x, 0.04, z]} rotation-y={i}>
          <Flat color={c} emissive={c} emissiveIntensity={0.15} />
        </mesh>
      ))}

      <group rotation-y={HOME}>
        {/* an invisible sleeve round the deer, so a tap on it always lands */}
        <mesh geometry={geo.hit}>
          <meshBasicMaterial visible={false} />
        </mesh>
        <group ref={set('act')}>
          <group ref={set('pitch')} position-y={BODY_Y}>
            <group position-y={-BODY_Y}>
              {/* body: barrel, chest, haunches, pale belly and rump */}
              <group ref={set('torso')} position-y={BODY_Y}>
                <mesh geometry={geo.ball} scale={[0.15, 0.17, 0.4]}>
                  <Flat color={C.coat} />
                </mesh>
              </group>
              <mesh geometry={geo.ball} position={[0, BODY_Y + 0.01, 0.25]} scale={[0.15, 0.19, 0.17]}>
                <Flat color={C.coat} />
              </mesh>
              <mesh geometry={geo.ball} position={[0, BODY_Y + 0.02, -0.26]} scale={[0.155, 0.18, 0.17]}>
                <Flat color={C.coat} />
              </mesh>
              <mesh geometry={geo.ball} position={[0, BODY_Y - 0.08, 0]} scale={[0.12, 0.11, 0.33]}>
                <Flat color={C.belly} />
              </mesh>
              <mesh geometry={geo.ball} position={[0, BODY_Y + 0.02, -0.36]} scale={[0.11, 0.13, 0.08]}>
                <Flat color={C.rump} />
              </mesh>
              {[-1, 1].map((sx) => (
                <group key={sx}>
                  <mesh geometry={geo.ball} position={[sx * 0.075, BODY_Y - 0.03, -0.27]} scale={[0.085, 0.15, 0.13]}>
                    <Flat color={C.coat} />
                  </mesh>
                  <mesh geometry={geo.ball} position={[sx * 0.07, BODY_Y - 0.04, 0.25]} scale={[0.075, 0.13, 0.1]}>
                    <Flat color={C.coat} />
                  </mesh>
                </group>
              ))}
              {spots.map((m, i) => (
                <mesh key={`s${i}`} geometry={geo.ball} position={m.pos} quaternion={m.quat} scale={m.scale}>
                  <Flat color={C.spots} />
                </mesh>
              ))}
              {/* the short tail: coat on top, a white fringe beneath */}
              <group ref={set('tail')} position={[0, BODY_Y + 0.09, -0.42]}>
                <mesh geometry={geo.ball} position={[0, -0.05, -0.012]} scale={[0.034, 0.07, 0.022]}>
                  <Flat color={C.coat} />
                </mesh>
                <mesh geometry={geo.ball} position={[0, -0.055, 0.0]} scale={[0.044, 0.068, 0.02]}>
                  <Flat color="#ffffff" />
                </mesh>
              </group>
              {/* legs: shoulder or hip, a knee or hock, a cannon and a hoof */}
              {legDefs.map(([D, sx, fore], i) => (
                <group key={i} ref={(el) => (legs.current[i] = el && { ...legs.current[i], up: el })} position={[sx * D.x, D.y, D.z]}>
                  <mesh geometry={fore ? geo.upperF : geo.upperH}>
                    <Flat color={C.coat} />
                  </mesh>
                  <group ref={(el) => (legs.current[i] = { ...legs.current[i], lo: el })} position-y={-D.up}>
                    <mesh geometry={geo.knee} scale={0.03}>
                      <Flat color={C.legs} />
                    </mesh>
                    <mesh geometry={geo.lower}>
                      <Flat color={C.legs} />
                    </mesh>
                    <mesh geometry={geo.hoof} position-y={-D.lo}>
                      <Flat color={C.hoof} roughness={0.5} />
                    </mesh>
                  </group>
                </group>
              ))}
              {/* the neck in two parts, then the head */}
              <group ref={set('neck1')} position={[0, BODY_Y + 0.06, 0.3]}>
                <mesh geometry={geo.ball} scale={0.09}>
                  <Flat color={C.neck} />
                </mesh>
                <mesh geometry={geo.neck1}>
                  <Flat color={C.neck} />
                </mesh>
                {C.ruff &&
                  [
                    [0, 0.06, 0.07, 0.1],
                    [0, 0.14, 0.06, 0.09],
                    [0.04, 0.03, 0.05, 0.075],
                    [-0.04, 0.03, 0.05, 0.075],
                    [0, 0.21, 0.04, 0.07],
                  ].map(([x, y, z, sz], i) => (
                    <mesh key={i} geometry={geo.ball} position={[x, y, z]} scale={[sz, sz * 1.15, sz * 0.9]}>
                      <Flat color={C.ruff} />
                    </mesh>
                  ))}
                <group ref={set('neck2')} position-y={0.32}>
                  <mesh geometry={geo.ball} scale={0.07}>
                    <Flat color={C.neck} />
                  </mesh>
                  <mesh geometry={geo.neck2}>
                    <Flat color={C.neck} />
                  </mesh>
                  <group ref={set('head')} position-y={0.3}>
                    <mesh geometry={geo.head} position={[0, 0.02, 0.03]} scale={[0.072, 0.08, 0.1]}>
                      <Flat color={C.coat} />
                    </mesh>
                    <mesh geometry={geo.muzzle} position={[0, -0.005, 0.07]} rotation-x={0.12}>
                      <Flat color={C.coat} />
                    </mesh>
                    <mesh geometry={geo.ball} position={[0, -0.035, 0.29]} scale={[0.03, 0.024, 0.022]}>
                      <Flat color={C.nose} roughness={0.35} />
                    </mesh>
                    <group ref={set('jaw')} position={[0, -0.055, 0.1]}>
                      <mesh geometry={geo.ball} position-z={0.07} scale={[0.03, 0.016, 0.09]}>
                        <Flat color={C.belly} />
                      </mesh>
                    </group>
                    {[-1, 1].map((sx, i) => (
                      <mesh key={`e${sx}`} ref={(el) => (eyes.current[i] = el)} geometry={geo.knee} position={[sx * 0.066, 0.04, 0.08]} scale={[0.016, 0.018, 0.016]}>
                        <Flat color="#141016" roughness={0.25} />
                      </mesh>
                    ))}
                    {[-1, 1].map((sx, i) => (
                      <group key={`r${sx}`} position={[sx * 0.055, 0.08, -0.01]}>
                        <group ref={(el) => (ears.current[i] = el)}>
                          <mesh geometry={geo.ball} position-y={0.085} scale={[0.046, 0.1, 0.015]}>
                            <Flat color={C.coat} />
                          </mesh>
                          <mesh geometry={geo.ball} position={[0, 0.085, 0.007]} scale={[0.032, 0.078, 0.01]}>
                            <Flat color={C.earIn} />
                          </mesh>
                        </group>
                      </group>
                    ))}
                    {/* antlers, mirrored left and right */}
                    {[-1, 1].map((sx) => (
                      <group key={`a${sx}`} position={[sx * 0.035, 0.09, -0.01]} scale={[sx, 1, 1]}>
                        {tines.map((m, i) => (
                          <mesh key={i} geometry={geo.tine} position={m.pos} quaternion={m.quat} scale={m.scale}>
                            <Flat color={C.antler} side={THREE.DoubleSide} />
                          </mesh>
                        ))}
                        {design.plates.map(([p, rot, sc], i) => (
                          <mesh key={`p${i}`} geometry={geo.ball} position={p} rotation={rot} scale={sc}>
                            <Flat color={C.antler} side={THREE.DoubleSide} />
                          </mesh>
                        ))}
                      </group>
                    ))}
                  </group>
                </group>
              </group>
            </group>
          </group>
        </group>
      </group>
      <Burst tap={land1} geometry={geo.dust} count={12} colors={C.dust} speed={1.1} gravity={3} size={0.045} life={0.8} origin={dust[0]} spread={1.1} up={0.6} seed={4} />
      <Burst tap={land2} geometry={geo.dust} count={12} colors={C.dust} speed={1.1} gravity={3} size={0.045} life={0.8} origin={dust[1]} spread={1.1} up={0.6} seed={8} />
    </group>
  )
}

export default function DeerScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[3.8, 2.4, 5.2]} target={[0, 0.95, 0]} hint="The deer grazes on its own, lowering its head to the grass, chewing, looking about and flicking its ears and tail · tap it and it startles, bounds away in two springy leaps, then turns and trots back · Look swaps red, fallow, white and reindeer · drag to orbit">
      <Deer {...props} />
    </Stage>
  )
}
