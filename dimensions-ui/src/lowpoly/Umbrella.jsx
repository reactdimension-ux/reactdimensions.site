import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Burst, Flat, Ripple, Spin, Stage, TAU, Water, facet, rng, useGeo, useTap, wobble } from './kit.jsx'

// A low-poly umbrella standing on its hooked handle in a rain puddle,
// leaning a little: a faceted canopy of eight panels with a scalloped edge,
// dark ribs ending in tips, stretchers up from a runner on the shaft, a
// ferrule on top and a curved J handle below. Left alone, rain falls on it:
// drops land on the canopy, slide down the panels to the rib tips and drip
// off into the puddle, where little rings spread. Tap it and it springs
// fully open (the canopy flattens and widens with a wobble) and spins fast,
// flinging its drops outward, then slows back to a lazy turn.

const LOOKS = {
  red: { panels: ['#d8332c', '#c92c26'], rib: '#3a3438', shaft: '#4a4448', handle: '#7a4a2a', tip: '#c9ccd2' },
  yellow: { panels: ['#f4c430', '#ecb928'], rib: '#3a3438', shaft: '#3a3438', handle: '#3a3438', tip: '#c9ccd2' },
  navy: { panels: ['#26355e', '#2c3c68'], rib: '#1c2236', shaft: '#2a2f40', handle: '#8a5a36', tip: '#d4c08a' },
  stripes: { panels: ['#f4f1ea', '#d8332c'], rib: '#3a3438', shaft: '#4a4448', handle: '#7a4a2a', tip: '#c9ccd2' },
}

const N = 8 // panels
const CR = 0.9 // canopy radius
const CH = 0.34 // canopy height, rim to apex
const RIM = 1.38 // rim height on the shaft
const HY = 0.15 // where the shaft meets the handle
const TILT = 0.13

const profileY = (u) => CH * (1 - u ** 1.4)
const smooth = (a, b, x) => {
  const u = Math.max(0, Math.min(1, (x - a) / (b - a)))
  return u * u * (3 - 2 * u)
}

// one canopy panel between the ribs at angle 0 and TAU / N, its rim edge
// scalloped (lifted and pulled in between the rib tips)
function panelGeometry(seed) {
  const rows = [0, 0.28, 0.55, 0.8, 1]
  const a1 = TAU / N
  const pt = (u, a) => [Math.cos(a) * CR * u, profileY(u), Math.sin(a) * CR * u]
  const mid = (u) => {
    const p = pt(u, a1 / 2)
    const k = Math.cos(a1 / 2) * (u < 1 ? 1.01 : 0.94)
    return [p[0] * k, p[1] + (u >= 1 ? 0.055 : 0), p[2] * k]
  }
  const pos = []
  for (let i = 0; i < rows.length - 1; i++) {
    const [u0, u1] = [rows[i], rows[i + 1]]
    const A = [pt(u0, 0), mid(u0), pt(u0, a1)]
    const B = [pt(u1, 0), mid(u1), pt(u1, a1)]
    for (let j = 0; j < 2; j++) {
      pos.push(...A[j], ...B[j], ...B[j + 1])
      if (i > 0) pos.push(...A[j], ...B[j + 1], ...A[j + 1])
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  // only the panel's middle seam is knocked about: the rib edges stay put so
  // neighbouring panels meet without a gap
  return facet(g, 0.012, seed, [0.3, 1, 0.3], (x, y, z) => Math.abs(z) < 1e-4 || Math.abs(Math.atan2(z, x) - TAU / N) < 1e-3 || Math.hypot(x, z) < 0.01)
}

export function Umbrella({ look = 'red' }) {
  const L = LOOKS[look] || LOOKS.red
  const { tap, handlers, clock } = useTap(0.9)
  const canopy = useRef()
  const drops = useRef([])

  const geo = useGeo(() => {
    const rib = new THREE.CatmullRomCurve3(Array.from({ length: 6 }, (_, i) => new THREE.Vector3(CR * (i / 5), profileY(i / 5) - 0.012, 0)))
    return {
      panels: Array.from({ length: N }, (_, i) => panelGeometry(10 + i)),
      rib: new THREE.TubeGeometry(rib, 8, 0.009, 3),
      ribTip: new THREE.IcosahedronGeometry(0.02, 0),
      stretcher: new THREE.CylinderGeometry(0.006, 0.006, 1, 3, 1).translate(0, 0.5, 0),
      runner: new THREE.CylinderGeometry(0.035, 0.035, 0.08, 6, 1),
      shaft: new THREE.CylinderGeometry(0.02, 0.02, RIM + CH - HY, 6, 1).translate(0, (RIM + CH - HY) / 2, 0),
      cap: new THREE.ConeGeometry(0.06, 0.05, 8, 1).translate(0, 0.025, 0),
      ferrule: new THREE.ConeGeometry(0.018, 0.16, 5, 1).translate(0, 0.08, 0),
      grip: facet(new THREE.CylinderGeometry(0.036, 0.034, 0.24, 7, 1).translate(0, 0.12, 0), 0.003, 3),
      hook: facet(new THREE.TorusGeometry(0.1, 0.034, 5, 8, Math.PI).rotateZ(Math.PI), 0.003, 4),
      end: new THREE.SphereGeometry(0.036, 6, 4),
      drop: new THREE.OctahedronGeometry(1, 0).scale(0.75, 1.3, 0.75),
      hit: new THREE.CylinderGeometry(0.85, 0.5, 1.9, 8).translate(0, 0.95, 0),
    }
  }, [])

  // the rain: each drop lands at its own spot on the canopy, runs down to
  // the nearest rib tip and drips off into the puddle
  const rain = useMemo(() => {
    const r = rng(7)
    return Array.from({ length: 22 }, (_, i) => {
      const a0 = r() * TAU
      const rib = Math.round(a0 / (TAU / N)) * (TAU / N)
      return { a0, rib, r0: CR * (0.12 + r() * 0.62), off: (i / 22) * 1.9 + r() * 0.3, period: 1.8 + r() * 0.3 }
    })
  }, [])

  useFrame(() => {
    const t = clock.elapsedTime
    const s = tap.since(t)
    const k = tap.value(t)
    // springing open: flatten and widen with a wobble
    const o = Math.min(1, k * 1.4)
    const w = wobble(s, 11, 3) * 0.12
    canopy.current.scale.set(1 + 0.14 * o + w * 0.4, Math.max(0.2, 1 - 0.42 * o - w), 1 + 0.14 * o + w * 0.4)
    // while it spins, the rain on the canopy is thrown off (see the burst)
    const wet = k < 0.12
    rain.forEach((d, i) => {
      const m = drops.current[i]
      if (!m) return
      const age = (t + d.off) % d.period
      const TF = 0.5
      const TS = 0.65
      const TD = 0.5
      if (age < TF) {
        // falling on to the canopy
        const q = age / TF
        const ys = RIM + profileY(d.r0 / CR) + 0.02
        m.visible = true
        m.position.set(Math.cos(d.a0) * d.r0, ys + (1 - q * q) * 1.1, Math.sin(d.a0) * d.r0)
        m.scale.set(0.018, 0.03, 0.018)
      } else if (age < TF + TS) {
        // running down the panel to the rib tip
        m.visible = wet
        const q = smooth(TF, TF + TS, age) ** 1.4
        const r = d.r0 + (CR - d.r0) * q
        const a = d.a0 + (d.rib - d.a0) * q
        m.position.set(Math.cos(a) * r, RIM + profileY(r / CR) + 0.02, Math.sin(a) * r)
        m.scale.set(0.022, 0.014, 0.022)
      } else if (age < TF + TS + TD) {
        // dripping off the tip
        const q = (age - TF - TS) / TD
        m.visible = wet
        m.position.set(Math.cos(d.rib) * CR, RIM - 0.02 - q * q * (RIM + 0.05), Math.sin(d.rib) * CR)
        m.scale.set(0.016, 0.032, 0.016)
      } else m.visible = false
    })
  })

  const ripples = [0, 2, 5, 7].map((i) => (i * TAU) / N)
  return (
    <group {...handlers}>
      <mesh geometry={geo.hit}>
        <meshBasicMaterial visible={false} />
      </mesh>
      <Water radius={1.2} color="#8cc6ea" edge="#5d9fc8" amp={0.008} speed={0.6} y={0.03} />
      {ripples.map((a, i) => (
        <group key={i} position={[Math.cos(a) * CR + 0.15, 0, Math.sin(a) * CR]}>
          <Ripple loop period={1.5 + i * 0.27} count={2} radius={0.28} color="#ffffff" y={0.035} opacity={0.5} />
        </group>
      ))}
      <group rotation={[0.05, 0, -TILT]}>
        <Spin tap={tap} rate={0.15} boost={14}>
          {/* the handle: a straight grip curling into a J */}
          <mesh geometry={geo.grip} position-y={HY}>
            <Flat color={L.handle} roughness={0.6} />
          </mesh>
          <mesh geometry={geo.hook} position={[0.1, HY, 0]}>
            <Flat color={L.handle} roughness={0.6} />
          </mesh>
          <mesh geometry={geo.end} position={[0.2, HY, 0]}>
            <Flat color={L.handle} roughness={0.6} />
          </mesh>
          <mesh geometry={geo.shaft} position-y={HY}>
            <Flat color={L.shaft} roughness={0.45} metalness={0.3} />
          </mesh>
          <mesh geometry={geo.runner} position-y={RIM - 0.24}>
            <Flat color={L.rib} />
          </mesh>
          {/* the canopy, ribs and stretchers */}
          <group ref={canopy} position-y={RIM}>
            {geo.panels.map((g, i) => (
              <mesh key={i} geometry={g} rotation-y={(-i * TAU) / N}>
                <Flat color={L.panels[i % 2]} side={THREE.DoubleSide} roughness={0.75} />
              </mesh>
            ))}
            {Array.from({ length: N }, (_, i) => (
              <group key={i} rotation-y={(-i * TAU) / N}>
                <mesh geometry={geo.rib}>
                  <Flat color={L.rib} />
                </mesh>
                <mesh geometry={geo.ribTip} position={[CR, -0.005, 0]}>
                  <Flat color={L.tip} roughness={0.4} metalness={0.3} />
                </mesh>
                {/* stretcher: from the runner up to the rib's middle */}
                <mesh geometry={geo.stretcher} position-y={-0.24} rotation-z={-Math.atan2(CR * 0.5, profileY(0.5) + 0.24 - 0.012)} scale-y={Math.hypot(CR * 0.5, profileY(0.5) + 0.24)}>
                  <Flat color={L.rib} />
                </mesh>
              </group>
            ))}
            <mesh geometry={geo.cap} position-y={CH - 0.01}>
              <Flat color={L.rib} />
            </mesh>
            <mesh geometry={geo.ferrule} position-y={CH + 0.03}>
              <Flat color={L.tip} roughness={0.4} metalness={0.3} />
            </mesh>
          </group>
        </Spin>
        {/* the rain (it doesn't spin with the umbrella) */}
        {rain.map((d, i) => (
          <mesh key={i} ref={(el) => (drops.current[i] = el)} geometry={geo.drop}>
            <meshStandardMaterial color="#9fd4f5" emissive="#9fd4f5" emissiveIntensity={0.25} roughness={0.2} flatShading transparent opacity={0.85} />
          </mesh>
        ))}
        <Burst tap={tap} geometry={geo.drop} count={24} colors={['#9fd4f5', '#cfeaff', '#ffffff']} speed={1.5} gravity={4} size={0.035} life={1.2} origin={[0, RIM + CH * 0.5, 0]} spread={1.9} up={0.45} />
      </group>
    </group>
  )
}

export default function UmbrellaScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[3.4, 2.4, 4.4]} target={[0, 0.85, 0]} hint="Rain falls on the canopy, runs down the panels and drips off the rib tips into the puddle · tap it and it springs fully open and spins, flinging the drops off, then slows · Look swaps red, yellow, navy and stripes · drag to orbit">
      <Umbrella {...props} />
    </Stage>
  )
}
