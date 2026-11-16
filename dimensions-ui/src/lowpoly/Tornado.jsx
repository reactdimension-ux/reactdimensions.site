import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Flat, Stage, TAU, blob, facet, rng, terrainGeo, useGeo, useTap } from './kit.jsx'

// A low-poly tornado over a patch of open ground: a funnel of stacked,
// faceted rings, narrow where it touches down and wide where it meets a
// dark, lumpy cloud disc overhead, with a ring of dust whirling round its
// foot. Left alone, every ring spins, the funnel's foot wanders slowly
// about the patch and its axis bends and snakes after it. Tap it and it
// sucks up debris: boards and crates lift off the ground, spiral up the
// funnel and get flung out on wide arcs, landing round the patch.

const LOOKS = {
  grey: { funnel: ['#9a9ca3', '#b4b6bc', '#84868e'], cloud: ['#5e6068', '#6e7078', '#50525a'], dust: ['#a89a84', '#bcae96'], ground: '#9cb26a', debris: ['#a0764a', '#8a6038', '#c79a5e'] },
  dust: { funnel: ['#c4a77c', '#d6bd94', '#ad9068'], cloud: ['#8a7660', '#9a866e', '#7a6852'], dust: ['#c9a874', '#dcc08e'], ground: '#cdb27e', debris: ['#8a5e3a', '#6f4a2c', '#b98a52'] },
  storm: { funnel: ['#5f6f86', '#73839a', '#4f5e74'], cloud: ['#2f3746', '#3a4354', '#262d3a'], dust: ['#7f8a7a', '#949e8c'], ground: '#5f7f52', debris: ['#8a6a4a', '#6e5238', '#a8865e'] },
  violet: { funnel: ['#8f78c4', '#a790d6', '#7a64b0'], cloud: ['#4a3c6e', '#58497e', '#3d3160'], dust: ['#b4a0d0', '#c8b8e0'], ground: '#9a8fb8', debris: ['#7a5a46', '#5e4434', '#a07a5a'] },
}

const RINGS = 13
const BASE_Y = 0.12
const TOP_Y = 1.68
const R0 = 0.07 // funnel radius at the ground
const R1 = 0.72 // and at the top
const DEBRIS = 12
const UP = 1.5 // seconds a piece spends spiralling up
const GD = 4.5 // gravity on the flung debris

const radiusAt = (u) => R0 + (R1 - R0) * u ** 1.6
// the funnel's foot wanders the patch; the axis bends after it
function footAt(t) {
  return [0.42 * Math.sin(t * 0.23) + 0.12 * Math.sin(t * 0.61), 0.32 * Math.sin(t * 0.31 + 1) + 0.1 * Math.cos(t * 0.53)]
}
function axisAt(u, t, out) {
  const [fx, fz] = footAt(t)
  const k = (1 - u) ** 1.4
  out[0] = fx * k + 0.07 * Math.sin(t * 1.3 - u * 5) * u
  out[1] = BASE_Y + (TOP_Y - BASE_Y) * u
  out[2] = fz * k + 0.07 * Math.cos(t * 1.1 - u * 5) * u
  return out
}

export function Tornado({ look = 'grey' }) {
  const L = LOOKS[look] || LOOKS.grey
  const { tap, handlers, clock } = useTap(1.2)
  const rings = useRef([])
  const dust = useRef([])
  const debris = useRef([])
  const cloud = useRef()
  const spin = useRef(0)
  const ground = useGeo(() => terrainGeo({ radius: 1.6, height: 0.06, seed: 8, rings: 4, segs: 18, rough: 0.35, profile: 'dome', bands: [[0, L.ground]] }), [look])
  const geo = useGeo(
    () => ({
      // each ring a broken torus, so its spin shows
      ring: facet(new THREE.TorusGeometry(1, 0.16, 3, 10, TAU * 0.82).rotateX(Math.PI / 2), 0.05, 4),
      puff: blob(1, 6),
      bit: new THREE.TetrahedronGeometry(1, 0),
      plank: facet(new THREE.BoxGeometry(0.2, 0.025, 0.06), 0.004, 3),
      crate: facet(new THREE.BoxGeometry(0.08, 0.08, 0.08), 0.004, 5),
      tuft: facet(new THREE.ConeGeometry(0.05, 0.12, 4).translate(0, 0.06, 0), 0.01, 6),
      rock: blob(1, 9, 0),
      hit: new THREE.CylinderGeometry(0.75, 0.3, 1.8, 8).translate(0, 0.9, 0),
    }),
    [],
  )
  const puffs = useMemo(() => {
    const r = rng(5)
    return Array.from({ length: 14 }, (_, i) => {
      const a = (i / 14) * TAU + r() * 0.3
      const d = i < 3 ? r() * 0.3 : 0.45 + r() * 0.75
      const s = 0.28 + r() * 0.2
      return { p: [Math.cos(a) * d, (r() - 0.5) * 0.1, Math.sin(a) * d], s: [s * 1.3, s * 0.45, s * 1.2], c: L.cloud[i % 3] }
    })
  }, [look]) // eslint-disable-line react-hooks/exhaustive-deps
  const D = useMemo(() => {
    const r = rng(11)
    return Array.from({ length: 18 }, () => ({ a: r() * TAU, r: 0.16 + r() * 0.22, h: r() * 0.25, w: 3 + r() * 3, s: 0.03 + r() * 0.03 }))
  }, [])
  const B = useMemo(() => {
    const r = rng(17)
    return Array.from({ length: DEBRIS }, (_, i) => ({ a: r() * TAU, d: r() * 0.5, top: 0.55 + r() * 0.35, out: 1.2 + r() * 0.8, spin: [(r() - 0.5) * 16, (r() - 0.5) * 16], plank: i % 3 !== 0, c: L.debris[i % 3] }))
  }, [look]) // eslint-disable-line react-hooks/exhaustive-deps
  const tmp = useMemo(() => [0, 0, 0], [])

  useFrame((_, dt) => {
    const t = clock.elapsedTime
    const s = tap.since(t)
    const k = tap.value(t)
    spin.current += Math.min(dt, 0.05) * (5 + 6 * k)
    // the funnel: each ring centred on the bending axis, spinning
    rings.current.forEach((m, i) => {
      if (!m) return
      const u = i / (RINGS - 1)
      axisAt(u, t, tmp)
      m.position.set(tmp[0], tmp[1], tmp[2])
      const r = radiusAt(u) * (1 + 0.06 * Math.sin(t * 4 + i * 1.3))
      m.scale.set(r, 0.5 + u * 0.8, r)
      m.rotation.set(0, spin.current * (1.4 - u * 0.6) + i * 0.7, 0)
    })
    if (cloud.current) cloud.current.rotation.y = spin.current * 0.06
    // dust whirling round the foot
    const [fx, fz] = footAt(t)
    D.forEach((p, i) => {
      const m = dust.current[i]
      if (!m) return
      const a = p.a + t * p.w
      const h = (p.h + t * 0.25 + i * 0.13) % 0.35
      const rr = p.r * (1 + h * 1.5)
      m.position.set(fx + Math.cos(a) * rr, 0.06 + h, fz + Math.sin(a) * rr)
      m.scale.setScalar(p.s * (1 + k) * (1 - h * 1.8))
      m.rotation.set(a, a * 0.7, 0)
    })
    // debris: lifted from beside the foot, spiralled up, flung out, landed
    B.forEach((b, i) => {
      const m = debris.current[i]
      if (!m) return
      const q = s - b.d
      m.visible = q >= 0 && q < UP + 3.2
      if (!m.visible) return
      if (q < UP) {
        const u = (q / UP) * b.top
        axisAt(u, t, tmp)
        const a = b.a + q * 9
        const rr = radiusAt(u) * 1.15 + 0.06
        m.position.set(tmp[0] + Math.cos(a) * rr, tmp[1] + 0.02, tmp[2] + Math.sin(a) * rr)
        m.rotation.set(q * b.spin[0], q * b.spin[1], 0)
        m.scale.setScalar(Math.min(1, q * 6))
        b.rel = null
      } else {
        // freeze the release point and velocity (tangential plus outward)
        if (!b.rel) {
          const u = b.top
          axisAt(u, t, tmp)
          const a = b.a + UP * 9
          const rr = radiusAt(u) * 1.15 + 0.06
          b.rel = { p: [tmp[0] + Math.cos(a) * rr, tmp[1], tmp[2] + Math.sin(a) * rr], v: [Math.cos(a) * b.out - Math.sin(a) * b.out * 0.8, 0.9, Math.sin(a) * b.out + Math.cos(a) * b.out * 0.8] }
        }
        const f = q - UP
        const R = b.rel
        const land = (R.v[1] + Math.sqrt(R.v[1] * R.v[1] + 2 * GD * (R.p[1] - 0.05))) / GD
        const tt = Math.min(f, land)
        m.position.set(R.p[0] + R.v[0] * tt, R.p[1] + R.v[1] * tt - 0.5 * GD * tt * tt, R.p[2] + R.v[2] * tt)
        if (f < land) m.rotation.set(q * b.spin[0], q * b.spin[1], 0)
        else m.rotation.set(0, b.a, 0)
        m.scale.setScalar(f < land ? 1 : Math.max(0.001, 1 - (f - land) / 1.2))
      }
    })
  })

  return (
    <group {...handlers}>
      <mesh geometry={ground}>
        <Flat vertexColors color="#ffffff" roughness={0.95} />
      </mesh>
      {[
        [1.1, 0.5],
        [-1.0, 0.7],
        [-0.6, -1.1],
        [1.0, -0.8],
        [0.2, 1.3],
      ].map(([x, z], i) => (
        <group key={i} position={[x, 0.02, z]}>
          <mesh geometry={geo.tuft} rotation-z={0.2}>
            <Flat color="#6f8f44" />
          </mesh>
          <mesh geometry={geo.tuft} position={[0.05, 0, 0.03]} rotation-z={-0.25} scale={0.8}>
            <Flat color="#82a34e" />
          </mesh>
          <mesh geometry={geo.rock} position={[-0.08, 0.02, -0.04]} scale={[0.07, 0.05, 0.06]}>
            <Flat color="#9a958c" />
          </mesh>
        </group>
      ))}
      {/* the funnel */}
      {Array.from({ length: RINGS }, (_, i) => (
        <mesh key={i} ref={(el) => (rings.current[i] = el)} geometry={geo.ring}>
          <Flat color={L.funnel[i % 3]} transparent opacity={0.94} />
        </mesh>
      ))}
      {/* the cloud overhead */}
      <group ref={cloud} position-y={TOP_Y + 0.22}>
        {puffs.map((p, i) => (
          <mesh key={i} geometry={geo.puff} position={p.p} scale={p.s} rotation-y={i}>
            <Flat color={p.c} />
          </mesh>
        ))}
      </group>
      {/* dust at the foot */}
      {D.map((_, i) => (
        <mesh key={i} ref={(el) => (dust.current[i] = el)} geometry={geo.bit}>
          <Flat color={L.dust[i % 2]} />
        </mesh>
      ))}
      {/* debris picked up on a tap */}
      {B.map((b, i) => (
        <mesh key={i} ref={(el) => (debris.current[i] = el)} geometry={b.plank ? geo.plank : geo.crate} visible={false}>
          <Flat color={b.c} />
        </mesh>
      ))}
      {/* an invisible core round the funnel, so a tap between rings lands */}
      <mesh geometry={geo.hit}>
        <meshBasicMaterial visible={false} />
      </mesh>
    </group>
  )
}

export default function TornadoScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[3.6, 2.3, 4.9]} target={[0, 0.95, 0]} hint="The funnel spins and its foot wanders the patch, bending as it goes, on its own · tap it to pick up boards and crates that spiral up and get flung out · Look swaps grey, dust, storm and violet · drag to orbit">
      <Tornado {...props} />
    </Stage>
  )
}
