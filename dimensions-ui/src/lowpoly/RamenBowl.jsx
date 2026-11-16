import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Burst, Flat, Particles, Ripple, Stage, TAU, blob, facet, polarGrid, rng, ribbonGeo, useGeo, useTap } from './kit.jsx'

// A low-poly bowl of ramen on a small wooden tray: a lathed bowl with a
// painted band under the rim, a disc of broth that rolls and glints with
// little beads of oil drifting on it, a nest of wavy noodles, a halved soft
// egg, two slices of chashu, a sheet of nori standing at the back, a scatter
// of scallion rings and a topping for each style. A pair of lacquered
// chopsticks lies on a rest beside it with a ceramic spoon. Steam rises the
// whole time. Tap it and the chopsticks swing over, dip into the nest and
// lift a pull of noodles that stretch up out of the broth, hang there
// swaying, then drop back with a splash and a ripple before the chopsticks
// go back to their rest.

const LOOKS = {
  shoyu: { broth: '#b5662a', deep: '#8a4518', oil: '#e8a04a', bowl: '#f3eee4', inner: '#f6f2ea', band: '#2f5d9e', noodle: '#f2cf6e', topping: 'naruto' },
  miso: { broth: '#cf8f45', deep: '#a86a2a', oil: '#f2bc5c', bowl: '#2b2a2f', inner: '#b8352c', band: '#c8a04a', noodle: '#f4d06a', topping: 'corn' },
  tonkotsu: { broth: '#efe1c4', deep: '#d9c6a0', oil: '#fff6e2', bowl: '#22314a', inner: '#f3efe6', band: '#e9e3d4', noodle: '#f3e6be', topping: 'ginger' },
}

const TRAY = 0.07 // top of the tray
const BX = -0.3 // the bowl's centre on the tray
const BROTH = 0.5 // broth level, bowl local
const BR = 0.705 // broth radius
const NEST = [0.06, 0.1] // the noodle nest, bowl local x / z
const STRANDS = 7
// outer wall, bowl local
const OUTER = [
  [0.001, 0],
  [0.3, 0],
  [0.31, 0.06],
  [0.36, 0.075],
  [0.6, 0.22],
  [0.76, 0.5],
  [0.8, 0.62],
  [0.79, 0.645],
]
const INNER = [
  [0.79, 0.645],
  [0.765, 0.64],
  [0.725, 0.52],
  [0.58, 0.26],
  [0.32, 0.13],
  [0.001, 0.13],
]

const ss = (a, b, x) => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return k * k * (3 - 2 * k)
}

// the chopsticks' tips at rest, dipped into the nest, and lifted up
const REST = { p: new THREE.Vector3(0.72, TRAY + 0.05, 0.56), q: new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2 + 0.07, -0.3, 0, 'YXZ')) }
const DIP = { p: new THREE.Vector3(BX + NEST[0] + 0.02, TRAY + BROTH + 0.03, NEST[1]), q: new THREE.Quaternion().setFromEuler(new THREE.Euler(0.3, 0, -0.5, 'YXZ')) }
const LIFT = { p: new THREE.Vector3(BX + NEST[0] + 0.14, TRAY + BROTH + 0.82, NEST[1] + 0.06), q: new THREE.Quaternion().setFromEuler(new THREE.Euler(0.22, 0, -0.42, 'YXZ')) }
// the tap's timeline, in seconds
const T = { dip: 0.22, up: 0.8, drop: 1.85, splash: 2.05, home: 2.25, done: 2.95 }

const _v = new THREE.Vector3()

// a wavy loop of noodle round the nest
function noodleLoop(r, k, seed) {
  const rand = rng(seed)
  const pts = []
  const n = 22
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU
    const rr = r * (1 + 0.16 * Math.sin(a * 5 + k * 1.7) + (rand() - 0.5) * 0.12)
    pts.push(new THREE.Vector3(Math.cos(a) * rr, 0.035 + 0.03 * Math.sin(a * 7 + k * 2.3) + (0.12 - r * 0.3) * 0.5, Math.sin(a) * rr))
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 90, 0.022, 4, true)
}

export function RamenBowl({ look = 'shoyu' }) {
  const L = LOOKS[look] || LOOKS.shoyu
  const { tap, handlers, clock } = useTap(1)
  const sticks = useRef()
  const stickL = useRef()
  const stickR = useRef()
  const nest = useRef()
  const strandRefs = useRef([])
  const oil = useRef([])

  const geo = useGeo(
    () => ({
      tray: facet(new THREE.BoxGeometry(2.6, 0.05, 1.6).translate(0, 0.025, 0), 0.004, 1),
      rimX: new THREE.BoxGeometry(2.6, 0.045, 0.05),
      rimZ: new THREE.BoxGeometry(0.05, 0.045, 1.6),
      outer: facet(new THREE.LatheGeometry(OUTER.map(([r, y]) => new THREE.Vector2(r, y)), 16), 0.006, 2),
      inner: facet(new THREE.LatheGeometry(INNER.map(([r, y]) => new THREE.Vector2(r, y)), 16), 0.005, 3),
      band: new THREE.CylinderGeometry(0.79 * 1.012, 0.765 * 1.012, 0.07, 16, 1, true).translate(0, 0.555, 0),
      broth: polarGrid(BR, 4, 16, () => 0, 0.15, 4),
      bead: new THREE.CircleGeometry(1, 6).rotateX(-Math.PI / 2),
      loops: [0.12, 0.18, 0.24, 0.29, 0.21, 0.15].map((r, k) => noodleLoop(r, k, 10 + k)),
      strands: Array.from({ length: STRANDS }, () => new THREE.CylinderGeometry(0.021, 0.021, 1, 5, 16, true).translate(0, 0.5, 0)),
      eggWhite: facet(new THREE.SphereGeometry(0.13, 9, 5, 0, TAU, Math.PI / 2, Math.PI / 2).scale(1, 0.85, 1.3), 0.004, 5),
      eggCut: new THREE.CircleGeometry(0.13, 9).rotateX(-Math.PI / 2).scale(1, 1, 1.3),
      yolk: facet(new THREE.SphereGeometry(0.075, 8, 3, 0, TAU, 0, Math.PI / 2).scale(1, 0.4, 1.25), 0.003, 6),
      chashu: facet(new THREE.CylinderGeometry(0.18, 0.18, 0.045, 11, 1), 0.012, 7, [1, 0.2, 1]),
      chashuTop: new THREE.CylinderGeometry(0.15, 0.15, 0.048, 11, 1),
      fat: new THREE.RingGeometry(0.07, 0.095, 11, 1).rotateX(-Math.PI / 2),
      nori: facet(new THREE.BoxGeometry(0.38, 0.46, 0.012, 3, 3, 1), 0.01, 8, [1, 1, 0.3]),
      ring: new THREE.TorusGeometry(0.026, 0.011, 3, 7).rotateX(Math.PI / 2),
      naruto: facet(new THREE.CylinderGeometry(0.09, 0.09, 0.03, 12, 1), 0.006, 9, [1, 0, 1]),
      narutoSwirl: ribbonGeo((u) => new THREE.Vector3(Math.cos(u * 2.2 * TAU) * (0.01 + u * 0.065), 0, Math.sin(u * 2.2 * TAU) * (0.01 + u * 0.065)), 0.014, 40),
      kernel: blob(0.026, 11, 0),
      sliver: new THREE.BoxGeometry(0.07, 0.012, 0.02),
      stick: facet(new THREE.CylinderGeometry(0.018, 0.009, 1.15, 6, 1).translate(0, 0.575, 0), 0.0015, 12),
      sleeve: new THREE.CylinderGeometry(0.0195, 0.016, 0.38, 6, 1).translate(0, 0.96, 0),
      rest: facet(new THREE.CylinderGeometry(0.04, 0.04, 0.2, 6, 1).rotateZ(Math.PI / 2), 0.004, 13),
      spoonBowl: facet(new THREE.SphereGeometry(0.11, 8, 4, 0, TAU, Math.PI / 2, Math.PI / 2).scale(1, 0.45, 1.5), 0.004, 14),
      spoonHandle: facet(new THREE.BoxGeometry(0.06, 0.03, 0.32).translate(0, 0, -0.16), 0.003, 15),
      puff: new THREE.IcosahedronGeometry(1, 0),
      hit: new THREE.CylinderGeometry(1.1, 1.1, 1.0, 10).translate(0, 0.5, 0),
    }),
    [],
  )
  const brothBase = useMemo(() => Float32Array.from(geo.broth.attributes.position.array), [geo])
  const strandBase = useMemo(() => Float32Array.from(geo.strands[0].attributes.position.array), [geo])
  // each noodle in the pull: where it leaves the nest, and how it hangs
  const S = useMemo(() => {
    const r = rng(21)
    return Array.from({ length: STRANDS }, (_, i) => ({ b: [(r() - 0.5) * 0.26, (r() - 0.5) * 0.22], top: (i / (STRANDS - 1) - 0.5) * 0.035, bow: 0.04 + r() * 0.08, ph: r() * TAU, sag: 0.6 + r() * 0.4 }))
  }, [])
  const beads = useMemo(() => {
    const r = rng(5)
    return Array.from({ length: 9 }, () => ({ r: 0.2 + r() * 0.42, a: r() * TAU, s: 0.012 + r() * 0.025, w: (r() - 0.5) * 0.25 }))
  }, [])
  const flakes = useMemo(() => {
    const r = rng(9)
    return Array.from({ length: 16 }, (_, i) => {
      const a = r() * TAU
      const d = Math.sqrt(r()) * 0.34
      return { p: [NEST[0] + Math.cos(a) * d, BROTH + 0.085 + r() * 0.02, NEST[1] + Math.sin(a) * d], rot: [(r() - 0.5) * 0.9, r() * TAU, (r() - 0.5) * 0.9], light: i % 3 === 0 }
    })
  }, [])
  // the splash, timed on the drop
  const splashTap = useMemo(() => ({ since: (t) => tap.since(t) - T.splash }), [tap])
  const strong = () => {
    const s = tap.since(clock.elapsedTime)
    return s > T.dip && s < T.done ? 1 : 0
  }

  useFrame(() => {
    const t = clock.elapsedTime
    const s = tap.since(t)
    // the broth: slow rolling waves that keep the rim still, and drifting oil
    const bp = geo.broth.attributes.position
    for (let i = 0; i < bp.count; i++) {
      const x = brothBase[i * 3]
      const z = brothBase[i * 3 + 2]
      const fall = 1 - Math.min(1, Math.hypot(x, z) / BR) ** 3
      const splash = s > T.splash && s < T.splash + 1.6 ? 0.03 * Math.exp(-(s - T.splash) * 2.5) * Math.sin(Math.hypot(x - NEST[0], z - NEST[1]) * 22 - (s - T.splash) * 14) : 0
      bp.setY(i, fall * (0.008 * Math.sin(x * 9 + t * 1.7) + 0.007 * Math.cos(z * 7.5 - t * 1.3) + splash))
    }
    bp.needsUpdate = true
    geo.broth.computeVertexNormals()
    beads.forEach((b, i) => {
      const m = oil.current[i]
      if (!m) return
      const a = b.a + t * b.w
      m.position.set(Math.cos(a) * b.r, BROTH + 0.014, Math.sin(a) * b.r)
      m.scale.setScalar(b.s * (1 + 0.15 * Math.sin(t * 2 + i)))
    })

    // the chopsticks: rest -> dip -> lift -> hold -> drop -> home
    const g = sticks.current
    let open = 0
    if (s < 0 || s >= T.done) {
      g.position.copy(REST.p)
      g.quaternion.copy(REST.q)
    } else if (s < T.dip) {
      const k = ss(0, T.dip, s)
      g.position.lerpVectors(REST.p, DIP.p, k)
      g.position.y += Math.sin(k * Math.PI) * 0.35
      g.quaternion.slerpQuaternions(REST.q, DIP.q, Math.min(1, k * 1.4))
      open = Math.sin(k * Math.PI) * 0.6
    } else if (s < T.home) {
      const k = ss(T.dip, T.up, s)
      g.position.lerpVectors(DIP.p, LIFT.p, k)
      g.quaternion.slerpQuaternions(DIP.q, LIFT.q, k)
      // hanging there, the hand sways a little
      const h = ss(T.up - 0.2, T.up + 0.2, s)
      g.position.x += h * Math.sin((s - T.up) * 5) * 0.03
      g.position.y += h * Math.sin((s - T.up) * 7) * 0.015
      open = ss(T.drop - 0.1, T.drop + 0.05, s) * 0.7
    } else {
      const k = ss(T.home, T.done, s)
      g.position.lerpVectors(LIFT.p, REST.p, k)
      g.position.y += Math.sin(k * Math.PI) * 0.2
      g.quaternion.slerpQuaternions(LIFT.q, REST.q, k)
      open = 0.7 * (1 - k)
    }
    stickL.current.rotation.z = 0.014 + open * 0.06
    stickR.current.rotation.z = -0.014 - open * 0.06

    // the pull of noodles, hung between the nest and the chopstick tips
    const pulling = s > T.dip && s < T.splash + 0.1
    const lift = ss(T.dip, T.up, s)
    const fall = s > T.drop ? Math.min(1, ((s - T.drop) / (T.splash - T.drop)) ** 2) : 0
    nest.current.scale.y = 1 + (pulling ? 0.5 * lift * (1 - fall) : 0)
    nest.current.position.y = BROTH - 0.035 + (pulling ? 0.03 * lift * (1 - fall) : 0)
    const tip = g.position
    S.forEach((st, i) => {
      const m = strandRefs.current[i]
      if (!m) return
      m.visible = pulling
      if (!pulling) return
      const bx = BX + NEST[0] + st.b[0]
      const by = TRAY + BROTH + 0.03
      const bz = NEST[1] + st.b[1]
      // the top end: held at the tips, then dropping back into the broth
      const tx = tip.x + st.top
      const ty = tip.y + 0.015 - fall * (tip.y - by - 0.02)
      const tz = tip.z
      const len = ty - by
      const p = m.geometry.attributes.position
      for (let j = 0; j < p.count; j++) {
        const u = strandBase[j * 3 + 1]
        const bell = Math.sin(Math.PI * u)
        const wav = Math.sin(u * Math.PI * 3 + t * 3.2 + st.ph) * (0.012 + fall * 0.06) * bell
        _v.set(bx + (tx - bx) * u ** st.sag + bell * st.bow * (0.4 + lift) + wav, by + len * u - fall * bell * 0.05, bz + (tz - bz) * u ** st.sag + Math.cos(u * 5 + t * 2.4 + st.ph) * 0.012 * bell)
        p.setXYZ(j, _v.x + strandBase[j * 3], _v.y, _v.z + strandBase[j * 3 + 2])
      }
      p.needsUpdate = true
      m.geometry.computeVertexNormals()
    })
  })

  return (
    <group {...handlers}>
      {/* the tray */}
      <mesh geometry={geo.tray}>
        <Flat color="#7a5236" />
      </mesh>
      {[-1, 1].map((k) => (
        <mesh key={`x${k}`} geometry={geo.rimX} position={[0, 0.06, k * 0.775]}>
          <Flat color="#5e3d27" />
        </mesh>
      ))}
      {[-1, 1].map((k) => (
        <mesh key={`z${k}`} geometry={geo.rimZ} position={[k * 1.275, 0.06, 0]}>
          <Flat color="#5e3d27" />
        </mesh>
      ))}

      {/* the bowl */}
      <group position={[BX, TRAY, 0]}>
        <mesh geometry={geo.outer}>
          <Flat color={L.bowl} roughness={0.35} />
        </mesh>
        <mesh geometry={geo.inner}>
          <Flat color={L.inner} roughness={0.35} side={THREE.DoubleSide} />
        </mesh>
        <mesh geometry={geo.band}>
          <Flat color={L.band} roughness={0.4} />
        </mesh>
        {/* the broth */}
        <mesh geometry={geo.broth} position-y={BROTH}>
          <meshStandardMaterial color={L.broth} emissive={L.deep} emissiveIntensity={0.18} flatShading roughness={0.18} metalness={0.15} />
        </mesh>
        {beads.map((b, i) => (
          <mesh key={i} ref={(el) => (oil.current[i] = el)} geometry={geo.bead}>
            <meshStandardMaterial color={L.oil} emissive={L.oil} emissiveIntensity={0.35} roughness={0.15} transparent opacity={0.85} />
          </mesh>
        ))}

        {/* the noodle nest */}
        <group ref={nest} position={[NEST[0], BROTH - 0.035, NEST[1]]}>
          {geo.loops.map((g, i) => (
            <mesh key={i} geometry={g} rotation-y={i * 0.9}>
              <Flat color={L.noodle} roughness={0.55} />
            </mesh>
          ))}
        </group>

        {/* nori, standing at the back against the wall */}
        <mesh geometry={geo.nori} position={[-0.12, BROTH + 0.16, -0.56]} rotation={[-0.32, 0.15, 0.04]}>
          <Flat color="#22392b" roughness={0.7} />
        </mesh>
        {/* two slices of chashu, leant against the wall */}
        {[
          [-0.42, -0.2, 0.55, -0.4],
          [-0.5, 0.12, 0.45, 0.3],
        ].map(([x, z, tilt, yaw], i) => (
          <group key={i} position={[x, BROTH + 0.06, z]} rotation={[0, yaw, tilt]}>
            <mesh geometry={geo.chashu}>
              <Flat color="#8a4a28" />
            </mesh>
            <mesh geometry={geo.chashuTop}>
              <Flat color="#d9967a" />
            </mesh>
            <mesh geometry={geo.fat} position={[0.02, 0.025, -0.01]}>
              <Flat color="#f2d6c2" />
            </mesh>
          </group>
        ))}
        {/* the halved soft egg */}
        {[
          [0.36, -0.3, -0.4],
          [0.46, -0.05, 0.3],
        ].map(([x, z, yaw], i) => (
          <group key={i} position={[x, BROTH + 0.07, z]} rotation={[0.35, yaw, -0.25]}>
            <mesh geometry={geo.eggWhite}>
              <Flat color="#fbf7ee" roughness={0.45} />
            </mesh>
            <mesh geometry={geo.eggCut} position-y={0.001}>
              <Flat color="#fdfaf2" roughness={0.45} />
            </mesh>
            <mesh geometry={geo.yolk} position-y={0.002}>
              <Flat color="#f2961c" emissive="#e07a10" emissiveIntensity={0.2} roughness={0.3} />
            </mesh>
          </group>
        ))}
        {/* a topping for each style */}
        {L.topping === 'naruto' && (
          <group position={[-0.25, BROTH + 0.05, 0.42]} rotation={[0.2, 0.4, 0.1]}>
            <mesh geometry={geo.naruto}>
              <Flat color="#fbf7f2" />
            </mesh>
            <mesh geometry={geo.narutoSwirl} position-y={0.017}>
              <Flat color="#e8577f" side={THREE.DoubleSide} />
            </mesh>
          </group>
        )}
        {L.topping === 'corn' &&
          Array.from({ length: 16 }, (_, i) => (
            <mesh key={i} geometry={geo.kernel} position={[-0.24 + Math.cos(i * 2.4) * 0.03 * Math.sqrt(i), BROTH + 0.03 + (i % 3) * 0.012, 0.42 + Math.sin(i * 2.4) * 0.03 * Math.sqrt(i)]} rotation-y={i}>
              <Flat color={i % 4 ? '#f6c42a' : '#f9d65a'} roughness={0.45} />
            </mesh>
          ))}
        {L.topping === 'ginger' &&
          Array.from({ length: 9 }, (_, i) => (
            <mesh key={i} geometry={geo.sliver} position={[-0.25 + Math.cos(i * 2.1) * 0.05, BROTH + 0.03 + (i % 3) * 0.012, 0.42 + Math.sin(i * 2.1) * 0.05]} rotation={[0.2 * (i % 2), i * 0.8, 0.15]}>
              <Flat color="#d8323e" roughness={0.5} />
            </mesh>
          ))}
        {/* scallion rings over the nest */}
        {flakes.map((f, i) => (
          <mesh key={i} geometry={geo.ring} position={f.p} rotation={f.rot}>
            <Flat color={f.light ? '#c4e48a' : '#5fae35'} />
          </mesh>
        ))}

        <Particles geometry={geo.puff} count={16} life={2.8} origin={[0, BROTH + 0.12, 0]} spread={0.36} velocity={[0, 0.32, 0]} scatter={0.04} drift={0.2} size={[0.04, 0.17]} colors={['#ffffff', '#eceef2']} opacity={[0.55, 0]} seed={3} />
        <Particles geometry={geo.puff} count={12} life={1.7} origin={[-0.15, BROTH + 0.14, -0.15]} spread={0.4} velocity={[0, 0.65, 0]} scatter={0.1} drift={0.25} size={[0.05, 0.18]} colors={['#ffffff', '#f2f3f6']} opacity={[0.5, 0]} active={strong} seed={8} />
        <Burst tap={splashTap} count={16} colors={[L.broth, L.oil, '#ffffff']} speed={1.3} gravity={5.5} size={0.035} life={0.75} origin={[NEST[0], BROTH + 0.04, NEST[1]]} spread={0.7} up={1.2} seed={4} />
        <Ripple tap={splashTap} count={2} color={L.oil} radius={0.55} life={0.9} y={BROTH + 0.02} opacity={0.6} />
      </group>

      {/* the pull of noodles */}
      {S.map((st, i) => (
        <mesh key={i} ref={(el) => (strandRefs.current[i] = el)} geometry={geo.strands[i]} visible={false} frustumCulled={false}>
          <Flat color={L.noodle} roughness={0.55} />
        </mesh>
      ))}

      {/* the chopstick rest, the spoon and the chopsticks */}
      <mesh geometry={geo.rest} position={[0.79, TRAY + 0.04, 0.36]} rotation-y={-0.3}>
        <Flat color={L.band} roughness={0.4} />
      </mesh>
      <group position={[0.5, TRAY + 0.03, -0.4]} rotation-y={-1.1}>
        <mesh geometry={geo.spoonBowl} position-y={0.05}>
          <Flat color="#f6f2ea" roughness={0.35} side={THREE.DoubleSide} />
        </mesh>
        <mesh geometry={geo.spoonHandle} position={[0, 0.05, -0.13]} rotation-x={0.22}>
          <Flat color="#f6f2ea" roughness={0.35} />
        </mesh>
      </group>
      <group ref={sticks}>
        {[
          [stickL, -0.016],
          [stickR, 0.016],
        ].map(([ref, x], i) => (
          <group key={i} ref={ref} position-x={x}>
            <mesh geometry={geo.stick}>
              <Flat color="#d8b07a" />
            </mesh>
            <mesh geometry={geo.sleeve}>
              <Flat color="#b5302a" roughness={0.35} />
            </mesh>
          </group>
        ))}
      </group>

      {/* an invisible drum round the bowl, so every tap lands */}
      <mesh geometry={geo.hit} position-x={BX}>
        <meshBasicMaterial visible={false} />
      </mesh>
    </group>
  )
}

export default function RamenBowlScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[2.6, 3.0, 3.9]} target={[0, 0.62, 0]} hint="Steam rises off the bowl and the broth rolls and glints on its own · tap it and the chopsticks dip in and lift a pull of noodles that stretch out of the broth, then drop them back with a splash · Look swaps shoyu, miso and tonkotsu · drag to orbit">
      <RamenBowl {...props} />
    </Stage>
  )
}
