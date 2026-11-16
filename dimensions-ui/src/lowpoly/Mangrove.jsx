import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Burst, Flat, Ripple, Stage, TAU, Water, facet, followPath, rng, useGeo, useKick, useTap, waveAt } from './kit.jsx'

// A low-poly mangrove standing in a round of water on a tangle of arched
// prop roots: a short trunk, a lumpy blob canopy, a few aerial roots
// dropping straight into the water and a couple of seedlings poking up.
// Left alone, the water rolls and laps in rings round the root feet, a few
// fallen leaves drift on it and the canopy sways. Tap it and a fish leaps
// out between the roots near your tap, arcs over and dives back in with a
// splash at each end.

const LOOKS = {
  tropic: { water: '#3fb3c2', edge: '#2a8c9c', ring: '#e6fbff', leaf: ['#3f9a48', '#56b24f', '#2f8040', '#6cc05a'], bark: '#7a5a3e', root: '#8c6b4a', fish: '#ff9a3a', fin: '#ffcf6a', light: null, bg: null },
  dawn: { water: '#d79eac', edge: '#b07a8c', ring: '#fff0ea', leaf: ['#4f8a4a', '#62a056', '#3e7440', '#7cb062'], bark: '#6e4e3e', root: '#86624e', fish: '#cfd6e2', fin: '#f2b8a8', light: '#ffae84', bg: '#f1ddd6' },
  murky: { water: '#6c7a48', edge: '#4f5a34', ring: '#c9d2a6', leaf: ['#2f5a36', '#3e6c3e', '#284c30', '#4f7a42'], bark: '#5a4836', root: '#6a5440', fish: '#8a7a56', fin: '#b0a070', light: null, bg: '#d6d9c8', matte: true },
}
const DEFAULT_BG = '#eceaf1'

const POND_R = 1.45
const WATER_Y = 0.1
const HUB = 0.62 // where the prop roots meet the trunk
const JUMP = 0.95 // seconds a leap takes
const ROOTS = 8

const clamp01 = (x) => Math.max(0, Math.min(1, x))

// A tube along a curve that tapers from r0 to r1, faceted.
function taperTube(curve, r0, r1, segs = 10, sides = 5, seed = 1) {
  const g = new THREE.TubeGeometry(curve, segs, 1, sides, false)
  const p = g.attributes.position
  const c = new THREE.Vector3()
  const v = new THREE.Vector3()
  for (let i = 0; i <= segs; i++) {
    const u = i / segs
    curve.getPointAt(u, c)
    const r = r0 + (r1 - r0) * u
    for (let j = 0; j <= sides; j++) {
      const k = i * (sides + 1) + j
      v.fromBufferAttribute(p, k).sub(c).multiplyScalar(r).add(c)
      p.setXYZ(k, v.x, v.y, v.z)
    }
  }
  return facet(g, r1 * 0.3, seed)
}

export function Mangrove({ look = 'tropic' }) {
  const L = LOOKS[look] || LOOKS.tropic
  const { handlers, clock } = useTap(1.2)
  const splashA = useKick(2)
  const splashB = useKick(2)
  const root = useRef()
  const canopy = useRef()
  const fish = useRef()
  const tail = useRef()
  const atA = useRef()
  const atB = useRef()
  const drift = useRef([])
  const st = useRef({ t0: -99, a: null, b: null })
  const pond = useRef()
  // murky water is dull: no bright glare off its surface
  useEffect(() => {
    pond.current?.traverse((o) => {
      if (!o.material) return
      o.material.userData.r0 ??= o.material.roughness
      o.material.roughness = L.matte ? 0.85 : o.material.userData.r0
    })
  }, [L.matte])

  // the prop roots: angle round the trunk and how far out each lands
  const roots = useMemo(() => {
    const r = rng(17)
    return Array.from({ length: ROOTS }, (_, k) => {
      const a = (k / ROOTS) * TAU + (r() - 0.5) * 0.35
      const d = 0.62 + r() * 0.3
      const h = HUB - (k % 2) * 0.07 - r() * 0.04
      return { a, d, h, lift: 0.18 + r() * 0.12 }
    })
  }, [])

  const geo = useGeo(() => {

    const rootGeos = roots.map((R, k) => {
      const dir = new THREE.Vector3(Math.cos(R.a), 0, Math.sin(R.a))
      const curve = new THREE.CubicBezierCurve3(
        dir.clone().multiplyScalar(0.05).setY(R.h),
        dir.clone().multiplyScalar(R.d * 0.45).setY(R.h + R.lift),
        dir.clone().multiplyScalar(R.d * 0.95).setY(R.h * 0.55),
        dir.clone().multiplyScalar(R.d).setY(WATER_Y - 0.08),
      )
      return taperTube(curve, 0.045, 0.024, 10, 5, 30 + k)
    })
    // a trunk with a slight bend, and two branches into the canopy
    const trunk = taperTube(new THREE.CatmullRomCurve3([new THREE.Vector3(0, HUB - 0.08, 0), new THREE.Vector3(0.03, 0.95, 0.02), new THREE.Vector3(-0.02, 1.32, -0.02)]), 0.1, 0.065, 6, 6, 3)
    const branches = [
      [0.42, 1.38, 0.12],
      [-0.38, 1.4, -0.16],
      [0.04, 1.42, -0.4],
    ].map(([x, y, z], i) => taperTube(new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 1.12, 0), new THREE.Vector3(x * 0.4, 1.3, z * 0.4), new THREE.Vector3(x, y, z)), 0.045, 0.022, 5, 5, 40 + i))
    return {
      roots: rootGeos,
      trunk,
      branches,
      knot: facet(new THREE.IcosahedronGeometry(0.12, 0).scale(1, 0.75, 1), 0.015, 5),
      leaf: facet(new THREE.IcosahedronGeometry(1, 1), 0.13, 11),
      aerial: facet(new THREE.CylinderGeometry(0.008, 0.012, 1, 4, 3).translate(0, -0.5, 0), 0.006, 12),
      seedling: facet(new THREE.CylinderGeometry(0.012, 0.02, 0.28, 5, 1).translate(0, 0.14, 0), 0.004, 13),
      sprout: facet(new THREE.ConeGeometry(0.035, 0.08, 4, 1).translate(0, 0.04, 0), 0.006, 14),
      floater: new THREE.CircleGeometry(1, 5).scale(1, 0.5, 1).rotateX(-Math.PI / 2),
      body: facet(new THREE.IcosahedronGeometry(1, 0).scale(0.38, 0.6, 1), 0.04, 15),
      tail: new THREE.ConeGeometry(0.5, 0.6, 3, 1).rotateX(-Math.PI / 2).scale(0.25, 1, 1),
      fin: new THREE.ConeGeometry(0.3, 0.4, 3, 1).scale(0.2, 1, 1),
      eye: new THREE.IcosahedronGeometry(0.12, 0),
      drop: new THREE.IcosahedronGeometry(1, 0),
    }
  }, [])

  // canopy blobs: offset from the canopy centre, radius
  const blobs = useMemo(
    () => [
      [0, 0.16, 0, 0.42],
      [0.38, 0, 0.12, 0.32],
      [-0.36, 0.04, -0.14, 0.34],
      [0.06, 0.02, -0.4, 0.3],
      [-0.12, -0.02, 0.34, 0.3],
      [0.24, 0.24, -0.18, 0.26],
      [0.55, -0.06, -0.22, 0.26],
      [-0.5, -0.04, 0.2, 0.27],
      [-0.18, 0.22, -0.3, 0.27],
    ],
    [],
  )
  const aerials = [
    [0.36, 1.33, 0.1, 1.2],
    [-0.32, 1.35, -0.12, 1.22],
    [0.42, 1.36, -0.3, 1.24],
  ]
  const seedlings = [
    [1.05, 0.35, 0.3],
    [-0.95, -0.55, -0.2],
    [1.12, 0.45, 0.4],
  ]
  const floaters = useMemo(() => {
    const r = rng(41)
    return Array.from({ length: 4 }, (_, i) => ({ r: 1.0 + r() * 0.3, a: r() * TAU, w: (0.04 + r() * 0.05) * (i % 2 ? 1 : -1), c: L.leaf[i % 4] }))
  }, [L.leaf])

  const _v = useMemo(() => new THREE.Vector3(), [])
  const onClick = (e) => {
    handlers.onClick(e)
    const t = clock.elapsedTime
    const S = st.current
    if (t - S.t0 < JUMP + 0.3) return
    // the leap goes round the tree near the tap, between two root feet
    root.current.worldToLocal(_v.copy(e.point))
    let ang = Math.atan2(_v.z, _v.x)
    let best = 0
    let bd = Infinity
    roots.forEach((R, k) => {
      const mid = R.a + Math.PI / ROOTS
      const d = Math.abs(Math.atan2(Math.sin(mid - ang), Math.cos(mid - ang)))
      if (d < bd) (bd = d), (best = k)
    })
    ang = roots[best].a + Math.PI / ROOTS
    const dirn = S.dirn === 1 ? -1 : 1
    S.dirn = dirn
    const a0 = ang - 0.55 * dirn
    const a1 = ang + 0.55 * dirn
    S.a = new THREE.Vector3(Math.cos(a0) * 1.08, WATER_Y, Math.sin(a0) * 1.08)
    S.b = new THREE.Vector3(Math.cos(a1) * 0.55, WATER_Y, Math.sin(a1) * 0.55)
    S.t0 = t
    atA.current.position.copy(S.a)
    atB.current.position.copy(S.b)
    splashA.kick(t)
    splashB.kick(t + JUMP)
  }

  const leap = (u) => {
    const S = st.current
    return new THREE.Vector3().lerpVectors(S.a, S.b, u).setY(WATER_Y - 0.08 + 0.62 * 4 * u * (1 - u))
  }

  useFrame(() => {
    const t = clock.elapsedTime
    const S = st.current
    if (canopy.current) {
      canopy.current.rotation.z = Math.sin(t * 0.7) * 0.035
      canopy.current.rotation.x = Math.sin(t * 0.53 + 1) * 0.025
    }
    const f = fish.current
    if (f) {
      const u = (t - S.t0) / JUMP
      f.visible = u >= 0 && u <= 1 && !!S.a
      if (f.visible) followPath(f, (x) => leap(clamp01(x) * 1.0001), u, 0.6, 0.01)
      if (tail.current) tail.current.rotation.y = Math.sin(t * 28) * 0.5
    }
    floaters.forEach((F, i) => {
      const m = drift.current[i]
      if (!m) return
      const a = F.a + t * F.w
      const x = Math.cos(a) * F.r
      const z = Math.sin(a) * F.r
      m.position.set(x, WATER_Y + 0.01 + waveAt(x, z, t, 0.025), z)
      m.rotation.y = -a + t * 0.2
    })
  })

  return (
    <group ref={root} {...handlers} onClick={onClick}>
      {L.light && <directionalLight position={[-4, 1.2, 3]} intensity={1.2} color={L.light} />}
      <group ref={pond}>
        <Water radius={POND_R} rings={6} segs={24} color={L.water} edge={L.edge} amp={0.025} y={WATER_Y} />
      </group>
      {/* water lapping round the root feet */}
      {roots.map((R, k) =>
        k % 2 ? null : (
          <group key={k} position={[Math.cos(R.a) * R.d, 0, Math.sin(R.a) * R.d]}>
            <Ripple loop period={2.2 + k * 0.17} count={2} radius={0.28} color={L.ring} y={WATER_Y + 0.012} opacity={0.6} />
          </group>
        ),
      )}
      {/* the prop roots, the trunk and branches */}
      {geo.roots.map((g, k) => (
        <mesh key={k} geometry={g}>
          <Flat color={k % 2 ? L.root : L.bark} />
        </mesh>
      ))}
      <mesh geometry={geo.knot} position-y={HUB - 0.02}>
        <Flat color={L.bark} />
      </mesh>
      <mesh geometry={geo.trunk}>
        <Flat color={L.bark} />
      </mesh>
      <group ref={canopy} position-y={1.1}>
        <group position-y={-1.1}>
          {geo.branches.map((g, i) => (
            <mesh key={i} geometry={g}>
              <Flat color={L.bark} />
            </mesh>
          ))}
          {aerials.map(([x, y, z, len], i) => (
            <mesh key={i} geometry={geo.aerial} position={[x, y, z]} scale={[1, len, 1]}>
              <Flat color={L.root} />
            </mesh>
          ))}
          <group position={[0, 1.5, 0]}>
            {blobs.map(([x, y, z, r], i) => (
              <mesh key={i} geometry={geo.leaf} position={[x, y, z]} scale={[r * 1.12, r * 0.66, r * 1.12]} rotation-y={i * 1.3}>
                <Flat color={L.leaf[i % L.leaf.length]} />
              </mesh>
            ))}
          </group>
        </group>
      </group>
      {/* seedlings standing up from the water */}
      {seedlings.map(([x, z, lean], i) => (
        <group key={i} position={[x, WATER_Y - 0.05, z]} rotation-z={lean * 0.4} scale={i === 2 ? 0.7 : 1}>
          <mesh geometry={geo.seedling}>
            <Flat color="#6f8a3a" />
          </mesh>
          <mesh geometry={geo.sprout} position-y={0.27}>
            <Flat color={L.leaf[1]} />
          </mesh>
        </group>
      ))}
      {floaters.map((F, i) => (
        <mesh key={i} ref={(el) => (drift.current[i] = el)} geometry={geo.floater} scale={0.055}>
          <Flat color={F.c} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {/* the fish and its splashes */}
      <group ref={fish} visible={false} scale={0.14}>
        <mesh geometry={geo.body}>
          <Flat color={L.fish} />
        </mesh>
        <group ref={tail} position-z={-0.85}>
          <mesh geometry={geo.tail} position-z={-0.2}>
            <Flat color={L.fin} side={THREE.DoubleSide} />
          </mesh>
        </group>
        <mesh geometry={geo.fin} position={[0, 0.55, -0.1]} rotation-x={-0.5}>
          <Flat color={L.fin} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} geometry={geo.eye} position={[s * 0.26, 0.15, 0.6]}>
            <Flat color="#1b1a22" />
          </mesh>
        ))}
      </group>
      <group ref={atA}>
        <Ripple tap={splashA} count={3} radius={0.45} life={1.1} color={L.ring} y={WATER_Y + 0.014} opacity={0.75} />
        <Burst tap={splashA} geometry={geo.drop} count={12} colors={['#ffffff', L.ring, L.water]} speed={0.9} gravity={4} size={0.028} life={0.7} origin={[0, WATER_Y, 0]} spread={0.6} up={1.4} seed={3} />
      </group>
      <group ref={atB}>
        <Ripple tap={splashB} count={3} radius={0.45} life={1.1} color={L.ring} y={WATER_Y + 0.014} opacity={0.75} />
        <Burst tap={splashB} geometry={geo.drop} count={14} colors={['#ffffff', L.ring, L.water]} speed={1} gravity={4} size={0.03} life={0.75} origin={[0, WATER_Y, 0]} spread={0.6} up={1.6} seed={9} />
      </group>
    </group>
  )
}

export default function MangroveScene({ background, autoRotate, float, look = 'tropic', ...props }) {
  const L = LOOKS[look] || LOOKS.tropic
  const bg = L.bg && (!background || background.toLowerCase() === DEFAULT_BG) ? L.bg : background
  return (
    <Stage background={bg} autoRotate={autoRotate} float={float} camera={[3.2, 2.2, 4.2]} target={[0, 0.75, 0]} hint="Water laps in rings round the roots, leaves drift and the canopy sways · tap it and a fish leaps out between the roots near your tap and splashes back in · Look swaps tropic, dawn and murky · drag to orbit">
      <Mangrove look={look} {...props} />
    </Stage>
  )
}
