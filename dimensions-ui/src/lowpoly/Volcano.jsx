import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Flat, Flow, Particles, Stage, TAU, cone, facet, ribbonGeo, rng, terrainGeo, terrainShape, useGeo, useTap } from './kit.jsx'

// A low-poly volcano: a faceted cone with a crater holding a glowing pool of
// lava, two lava streams creeping down the flanks in glowing channels, and
// a plume of smoke. Tap it and it erupts: the ground shudders, lava
// fountains from the crater and glowing bombs fly out on ballistic arcs,
// land on the slope where they hit it, and cool from orange to black.

const LOOKS = {
  classic: { bands: [[0, '#4a3f3a'], [0.35, '#3a322e'], [0.7, '#2c2624']], ground: '#5f8a42', tree: '#3f6f3a' },
  ash: { bands: [[0, '#8a857e'], [0.4, '#6e6a64'], [0.75, '#55514c']], ground: '#9a958d', tree: '#5a5a52' },
  jungle: { bands: [[0, '#3f7f3a'], [0.35, '#55704a'], [0.62, '#4a3f3a']], ground: '#4f9a42', tree: '#2f7a3a' },
  ice: { bands: [[0, '#5a6470'], [0.45, '#e8eef5'], [0.8, '#ffffff']], ground: '#e8eef5', tree: '#2f5f42' },
}
const RAD = 1.15
const HGT = 1.15
const BASE = 0.05
const shape = terrainShape('crater')
const hAt = (r) => BASE + HGT * shape(Math.min(1, r / RAD))
const G = 4.5 // scene gravity for the bombs
const BOMBS = 12

const streamPath = (a) => (u) => {
  const r = 0.24 + u * 0.95
  const w = a + Math.sin(u * 7) * 0.08
  return new THREE.Vector3(Math.cos(w) * r, hAt(r) + 0.025, Math.sin(w) * r)
}

export function Volcano({ look = 'classic' }) {
  const L = LOOKS[look] || LOOKS.classic
  const { tap, handlers, clock } = useTap(1)
  const body = useRef()
  const pool = useRef()
  const glow = useRef()
  const bombs = useRef([])
  const paths = useMemo(() => [streamPath(0.9), streamPath(2.6)], [])

  const geo = useGeo(
    () => ({
      cone: terrainGeo({ radius: RAD, height: HGT, seed: 6, rings: 8, segs: 14, rough: 0.12, profile: 'crater', bands: L.bands }),
      ground: facet(new THREE.CylinderGeometry(1.6, 1.65, 0.05, 16, 1).translate(0, 0.025, 0), 0.02, 1, [1, 0.3, 1]),
      pool: new THREE.CircleGeometry(0.2, 9).rotateX(-Math.PI / 2),
      channels: paths.map((p) => ribbonGeo(p, 0.07, 24)),
      bomb: new THREE.DodecahedronGeometry(0.035, 0),
      tree: cone(0.07, 0.24, 5, 3),
      trunk: new THREE.CylinderGeometry(0.015, 0.02, 0.06, 4, 1).translate(0, 0.03, 0),
    }),
    [look],
  )
  const B = useMemo(() => {
    const r = rng(17)
    return Array.from({ length: BOMBS }, () => {
      const a = r() * TAU
      const vh = 0.45 + r() * 0.8
      return { dx: Math.cos(a) * vh, dz: Math.sin(a) * vh, vy: 2.4 + r() * 1.2, delay: r() * 0.5 }
    })
  }, [])
  const trees = useMemo(() => {
    const r = rng(3)
    return Array.from({ length: 10 }, () => {
      const a = r() * TAU
      const d = 1.2 + r() * 0.3
      return [Math.cos(a) * d, Math.sin(a) * d, 0.7 + r() * 0.6]
    })
  }, [])

  const erupting = () => (tap.since(clock.elapsedTime) < 1.8 ? 1 : 0)
  const ashing = () => (tap.since(clock.elapsedTime) < 3.5 ? 1 : 0.35)

  useFrame(() => {
    const t = clock.elapsedTime
    const s = tap.since(t)
    const k = tap.value(t)
    // the ground shudders as it goes off
    const quake = s >= 0 && s < 0.8 ? (1 - s / 0.8) * 0.012 : 0
    body.current.position.set(Math.sin(t * 60) * quake, 0, Math.cos(t * 53) * quake)
    pool.current.material.emissiveIntensity = 1 + 0.3 * Math.sin(t * 2.3) + k * 2
    glow.current.intensity = 1.5 + 0.3 * Math.sin(t * 3.1) + k * 6
    // bombs: a ballistic arc until they meet the slope, then they cool
    B.forEach((b, i) => {
      const m = bombs.current[i]
      if (!m) return
      const u = s - b.delay
      if (u < 0 || u > 4.5) {
        m.visible = false
        return
      }
      m.visible = true
      // time of landing: first time the arc meets the ground
      let land = b.land
      if (b.t0 !== t - s) {
        b.t0 = t - s
        land = 99
        for (let q = 0.05; q < 3; q += 0.01) {
          const y = BASE + HGT + b.vy * q - 0.5 * G * q * q
          if (q > 0.3 && y <= hAt(Math.hypot(b.dx, b.dz) * q)) {
            land = q
            break
          }
        }
        b.land = land
      }
      const q = Math.min(u, land)
      m.position.set(b.dx * q, BASE + HGT + b.vy * q - 0.5 * G * q * q, b.dz * q)
      m.rotation.set(q * 9, q * 7, 0)
      m.material.emissiveIntensity = u < land ? 2 : Math.max(0, 2 - (u - land) * 1.2)
    })
  })

  return (
    <group {...handlers}>
      <mesh geometry={geo.ground}>
        <Flat color={L.ground} />
      </mesh>
      {trees.map(([x, z, s], i) => (
        <group key={i} position={[x, 0.05, z]} scale={s}>
          <mesh geometry={geo.trunk}>
            <Flat color="#5c3c2a" />
          </mesh>
          <mesh geometry={geo.tree} position-y={0.04}>
            <Flat color={L.tree} />
          </mesh>
        </group>
      ))}

      <group ref={body}>
        <mesh geometry={geo.cone} position-y={BASE}>
          <Flat vertexColors color="#ffffff" />
        </mesh>
        <mesh ref={pool} geometry={geo.pool} position-y={BASE + HGT * 0.76}>
          <Flat color="#ff7a1f" emissive="#ff5a10" emissiveIntensity={1} />
        </mesh>
        {geo.channels.map((g, i) => (
          <mesh key={i} geometry={g}>
            <Flat color="#7a1e0a" emissive="#c2300a" emissiveIntensity={0.7} />
          </mesh>
        ))}
        {paths.map((p, i) => (
          <Flow key={i} path={p} count={16} speed={0.08} width={0.04} size={0.022} stretch={2} colors={['#ffb02e', '#ff6a1f']} emissive={2} seed={i + 3} />
        ))}
        <pointLight ref={glow} color="#ff7a2e" distance={3} decay={2} position-y={BASE + HGT + 0.15} />
      </group>

      {/* smoke, thicker during an eruption */}
      <Particles count={14} life={4} origin={[0, BASE + HGT + 0.05, 0]} spread={0.08} velocity={[0.06, 0.35, 0.02]} scatter={0.08} drift={0.25} size={[0.06, 0.2]} colors={['#6e6a64', '#8a857e', '#55514c']} opacity={[0.75, 0]} active={ashing} seed={2} />
      {/* the lava fountain */}
      <Particles count={24} life={0.9} origin={[0, BASE + HGT * 0.78, 0]} spread={0.06} velocity={[0, 2.2, 0]} scatter={0.35} gravity={4.5} drift={0} size={[0.035, 0.015]} colors={['#ffb02e', '#ff6a1f', '#ffd84a']} opacity={[1, 0.6]} emissive={2} active={erupting} seed={9} />
      {B.map((_, i) => (
        <mesh key={i} ref={(el) => (bombs.current[i] = el)} geometry={geo.bomb} visible={false}>
          <Flat color="#2c2624" emissive="#ff6a1f" emissiveIntensity={2} />
        </mesh>
      ))}
    </group>
  )
}

export default function VolcanoScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[3.4, 2.3, 4.8]} target={[0, 0.7, 0]} hint="Lava glows in the crater, creeps down two channels and smoke rises on its own · tap it to erupt: a lava fountain, and glowing bombs that land on the slope and cool · Look swaps classic, ash, jungle and ice · drag to orbit">
      <Volcano {...props} />
    </Stage>
  )
}
