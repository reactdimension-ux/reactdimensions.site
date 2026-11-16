import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Burst, Flat, Particles, Stage, TAU, Tail, facet, rng, useGeo, useTap } from './kit.jsx'

// A low-poly jellyfish drifting in open water: a translucent faceted bell
// with a glowing rim, a cluster of small lights inside it, four frilly oral
// arms hanging from the middle and a fringe of long thin tentacles trailing
// from the rim. Bubbles rise past and specks of plankton drift about. Left
// alone, the bell pulses, squeezing in and springing back, and each squeeze
// pushes it up a little before it sinks slowly again, its tentacles swaying
// behind. Tap it and it lights up much brighter and pulses fast, rising
// quickly with a burst of sparkles, then calms and sinks back.

const LOOKS = {
  moon: { bell: '#9cc8ee', glow: '#5fbcff', rim: '#bff0ff', arm: ['#e6f2ff', '#cfe2fb', '#f4f9ff'], tent: ['#d8ecff', '#b8d8f8'], dots: '#e8fbff', spark: ['#ffffff', '#bfefff'] },
  pink: { bell: '#f08cc0', glow: '#ff4fa8', rim: '#ffd0ec', arm: ['#ff9acb', '#ffc2e0', '#ff7ab8'], tent: ['#ffc8e4', '#ff9ccb'], dots: '#fff0f8', spark: ['#ffffff', '#ffb8e0'] },
  violet: { bell: '#a888ee', glow: '#8a5cff', rim: '#e4d4ff', arm: ['#b48cff', '#d2bcff', '#9f78f0'], tent: ['#d4c2ff', '#ad90f4'], dots: '#f6f0ff', spark: ['#ffffff', '#d4b8ff'] },
  gold: { bell: '#f0c070', glow: '#ffa020', rim: '#fff0c4', arm: ['#ffc870', '#ffe0a0', '#f2a848'], tent: ['#ffe4ac', '#f8c878'], dots: '#fff8e0', spark: ['#ffffff', '#ffe08a'] },
}

const CY = 1.35 // the bell's resting height
// the bell's outline, from the crown down to the rim and back in under it
const BELL = [
  [0.001, 0.36],
  [0.17, 0.345],
  [0.31, 0.29],
  [0.42, 0.19],
  [0.49, 0.06],
  [0.52, -0.05],
  [0.49, -0.08],
  [0.4, -0.03],
  [0.24, 0.02],
  [0.001, 0.04],
]
const RIM = 0.5
const NTENT = 12

export function Jellyfish({ look = 'moon' }) {
  const L = LOOKS[look] || LOOKS.moon
  const { tap, handlers, clock } = useTap(0.7)
  const body = useRef()
  const bell = useRef()
  const inner = useRef()
  const rim = useRef()
  const lamp = useRef()
  const halo = useRef()
  const dots = useRef([])
  const st = useRef({ ph: 0, y: 0, v: 0 })
  const geo = useGeo(
    () => ({
      bell: facet(new THREE.LatheGeometry(BELL.map(([r, y]) => new THREE.Vector2(r, y)), 12), 0.012, 5).toNonIndexed(),
      inner: facet(new THREE.SphereGeometry(0.3, 10, 5, 0, TAU, 0, Math.PI / 2).scale(1, 0.75, 1), 0.01, 8),
      rim: new THREE.TorusGeometry(RIM, 0.022, 4, 24).rotateX(Math.PI / 2),
      dot: new THREE.IcosahedronGeometry(1, 0),
      halo: new THREE.IcosahedronGeometry(0.78, 2).scale(1, 0.75, 1),
      knob: new THREE.OctahedronGeometry(1, 0),
      star: new THREE.OctahedronGeometry(1, 0),
      hit: new THREE.CylinderGeometry(0.6, 0.45, 1.9, 8).translate(0, -0.6, 0),
    }),
    [],
  )
  // the little lights inside the bell
  const D = useMemo(() => {
    const r = rng(12)
    return Array.from({ length: 11 }, (_, i) => {
      const a = (i / 11) * TAU + r() * 0.4
      const d = 0.08 + r() * 0.24
      return { p: [Math.cos(a) * d, 0.05 + r() * 0.18 * (1 - d * 2), Math.sin(a) * d], s: 0.018 + r() * 0.016, ph: r() * TAU }
    })
  }, [])
  // the tentacles round the rim
  const T = useMemo(() => {
    const r = rng(4)
    return Array.from({ length: NTENT }, (_, i) => ({ a: (i / NTENT) * TAU, len: 1.0 + r() * 0.45, rate: 0.35 + r() * 0.2, ph: r() }))
  }, [])
  // plankton specks drifting round the jellyfish
  const P = useMemo(() => {
    const r = rng(31)
    return Array.from({ length: 26 }, () => ({ p: [(r() - 0.5) * 3.2, 0.1 + r() * 2.4, (r() - 0.5) * 3.2], s: 0.008 + r() * 0.012, ph: r() * TAU, sp: 0.2 + r() * 0.4 }))
  }, [])
  const specks = useRef([])

  useFrame((_, dt) => {
    const t = clock.elapsedTime
    const d = Math.min(dt, 0.05)
    const k = tap.value(t)
    const S = st.current
    // the pulse: quicker when excited
    const period = 1.9 - 1.35 * k
    S.ph = (S.ph + d / period) % 1
    const f = S.ph
    // squeeze over the first third of a beat, spring back over the rest
    const c = f < 0.3 ? Math.sin((f / 0.3) * (Math.PI / 2)) : Math.max(0, 1 - (f - 0.3) / 0.45) ** 2
    const thrust = f < 0.3 ? 1 : 0
    // each squeeze pushes it up; it sinks slowly and is drawn gently back
    S.v += (thrust * (0.85 + 1.6 * k) - 0.32 - S.y * 0.5) * d
    S.v *= Math.exp(-2.2 * d)
    S.y = Math.max(-0.35, Math.min(0.75, S.y + S.v * d))
    body.current.position.y = CY + S.y
    body.current.rotation.z = Math.sin(t * 0.4) * 0.06
    body.current.rotation.x = Math.sin(t * 0.33 + 1) * 0.05
    // the bell narrows and lengthens on a squeeze
    bell.current.scale.set(1 - 0.17 * c, 1 + 0.12 * c, 1 - 0.17 * c)
    inner.current.scale.set(1 - 0.2 * c, 1 + 0.15 * c, 1 - 0.2 * c)
    rim.current.scale.set(1 - 0.2 * c, 1, 1 - 0.2 * c)
    rim.current.position.y = -0.055 - 0.03 * c
    // the glow
    const g = 0.55 + 0.35 * c + 2.6 * k
    bell.current.material.emissiveIntensity = 0.45 + 0.25 * c + 1.6 * k
    inner.current.material.emissiveIntensity = g
    rim.current.material.emissiveIntensity = 1 + 0.6 * c + 2.5 * k
    lamp.current.intensity = 1.4 + 0.8 * c + 7 * k
    halo.current.visible = k > 0.01
    halo.current.children.forEach((h, i) => {
      h.material.opacity = 0.09 * k
      h.scale.setScalar((0.75 + i * 0.22) * (1 - 0.08 * c + 0.2 * k))
    })
    D.forEach((p, i) => {
      const m = dots.current[i]
      if (!m) return
      m.scale.setScalar(p.s * (0.8 + 0.3 * Math.sin(t * 3 + p.ph)) * (1 + k * 0.8))
      m.material.emissiveIntensity = 1 + 0.6 * Math.sin(t * 2.4 + p.ph) + 3 * k
    })
    P.forEach((p, i) => {
      const m = specks.current[i]
      if (!m) return
      m.position.set(p.p[0] + Math.sin(t * p.sp + p.ph) * 0.12, p.p[1] + Math.sin(t * p.sp * 0.7 + p.ph * 2) * 0.1, p.p[2] + Math.cos(t * p.sp * 0.8 + p.ph) * 0.12)
    })
  })

  return (
    <group {...handlers}>
      <group ref={body} position-y={CY}>
        {/* the bell: a translucent shell with an inner glowing dome */}
        <mesh ref={bell} geometry={geo.bell} renderOrder={3}>
          <meshStandardMaterial color={L.bell} emissive={L.glow} emissiveIntensity={0.3} flatShading roughness={0.35} transparent opacity={0.5} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
        <mesh ref={inner} geometry={geo.inner} position-y={0.02} renderOrder={2}>
          <meshStandardMaterial color={L.bell} emissive={L.glow} emissiveIntensity={0.6} flatShading roughness={0.5} transparent opacity={0.35} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
        <mesh ref={rim} geometry={geo.rim} position-y={-0.055}>
          <Flat color={L.rim} emissive={L.glow} emissiveIntensity={1} />
        </mesh>
        {D.map((p, i) => (
          <mesh key={i} ref={(el) => (dots.current[i] = el)} geometry={geo.dot} position={p.p} scale={p.s}>
            <Flat color={L.dots} emissive={L.dots} emissiveIntensity={1} />
          </mesh>
        ))}
        {/* a soft glow round the bell when it lights up: nested shells */}
        <group ref={halo} position-y={0.1} visible={false}>
          {[0, 1, 2].map((i) => (
            <mesh key={i} geometry={geo.halo} renderOrder={4}>
              <meshBasicMaterial color={L.glow} transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.BackSide} toneMapped={false} />
            </mesh>
          ))}
        </group>
        <pointLight ref={lamp} color={L.glow} distance={2.6} decay={1.6} position-y={0.05} />
        {/* four frilly oral arms from the middle */}
        {[0, 1, 2, 3].map((i) => (
          <group key={i} rotation-y={(i / 4) * TAU + 0.4}>
            <group position={[0.06, -0.02, 0]} rotation-x={-Math.PI / 2}>
              <Tail segs={7} length={0.85} r0={0.055} r1={0.018} sides={5} colors={L.arm} rate={0.32 + i * 0.03} amp={0.12} lag={0.55} axis="y" kick={tap} kickAmp={0.12} tip={<mesh geometry={geo.knob} position-z={-0.85 / 7} scale={0.022}><Flat color={L.rim} emissive={L.glow} emissiveIntensity={0.8} /></mesh>} />
            </group>
            {/* frills: a second, thinner, wavier arm twisted about the first */}
            <group position={[0.1, -0.03, 0.03]} rotation-x={-Math.PI / 2}>
              <Tail segs={6} length={0.65} r0={0.035} r1={0.01} sides={4} colors={[L.arm[1], L.arm[2]]} rate={0.5 + i * 0.04} amp={0.22} lag={0.9} axis="x" kick={tap} kickAmp={0.15} />
            </group>
          </group>
        ))}
        {/* long thin tentacles trailing from the rim */}
        {T.map((p, i) => (
          <group key={i} rotation-y={p.a}>
            <group position={[RIM * 0.92, -0.07, 0]} rotation-x={-Math.PI / 2}>
              <Tail segs={8} length={p.len} r0={0.011} r1={0.004} sides={3} colors={L.tent} rate={p.rate} amp={0.16} lag={0.6 + p.ph * 0.4} axis={i % 2 ? 'x' : 'y'} kick={tap} kickAmp={0.2} />
            </group>
          </group>
        ))}
        <Burst tap={tap} geometry={geo.star} count={16} colors={L.spark} speed={1.2} gravity={0} size={0.04} life={1.1} origin={[0, 0.15, 0]} spread={1.1} up={0.5} />
        <mesh geometry={geo.hit}>
          <meshBasicMaterial visible={false} />
        </mesh>
      </group>
      {/* bubbles rising and plankton drifting */}
      <Particles count={8} life={4} origin={[0.75, 0.1, 0.3]} spread={0.08} velocity={[0, 0.55, 0]} scatter={0.04} drift={0.08} size={[0.02, 0.035]} colors={['#ffffff', '#cfeaff']} opacity={[0.7, 0]} emissive={0.4} seed={3} />
      <Particles count={6} life={4.6} origin={[-0.8, 0.2, -0.4]} spread={0.06} velocity={[0, 0.5, 0]} scatter={0.04} drift={0.08} size={[0.016, 0.03]} colors={['#ffffff', '#cfeaff']} opacity={[0.6, 0]} emissive={0.4} seed={9} />
      {P.map((p, i) => (
        <mesh key={i} ref={(el) => (specks.current[i] = el)} geometry={geo.dot} position={p.p} scale={p.s}>
          <meshBasicMaterial color={L.dots} transparent opacity={0.7} toneMapped={false} />
        </mesh>
      ))}
    </group>
  )
}

export default function JellyfishScene({ background = '#16263a', autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[3.4, 1.9, 4.8]} target={[0, 1.05, 0]} hint="The bell pulses, each squeeze pushing it up before it sinks slowly, its tentacles trailing · tap it and it glows bright and pulses fast, rising quickly with a sparkle · Look swaps moon, pink, violet and gold · drag to orbit">
      <Jellyfish {...props} />
    </Stage>
  )
}
