import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Flat, Particles, Stage, TAU, Water, blob, facet, rng, terrainGeo, useGeo, useTap } from './kit.jsx'

// A low-poly geyser: a stepped mound of faceted mineral rock, each terrace
// ledge holding a shallow pool of bright water, rising to a rimmed vent
// with a steaming pool at the top, boulders scattered round its foot.
// Left alone, steam curls up from the vent and the pool bubbles and rolls.
// Tap it and it erupts: a column of water shoots up out of the vent,
// spray arcs out and rains back down over the terraces, a cloud of steam
// billows up, and after a couple of seconds the column sinks back and the
// geyser subsides.

const LOOKS = {
  classic: { rock: ['#e9dfc8', '#dccfb2', '#cfc09f', '#e4d6ba'], lip: '#d98a3a', pool: '#3fb3d8', edge: '#2a86a8', ground: '#b9b08f', boulder: ['#9b958a', '#857f75'] },
  sulphur: { rock: ['#eadb7a', '#dccb5c', '#cdbb48', '#e4d36a'], lip: '#b8a032', pool: '#6ec9a8', edge: '#46a084', ground: '#c2b880', boulder: ['#a39a6e', '#8a8258'] },
  turquoise: { rock: ['#f2f2ee', '#e2e4e2', '#d2d6d4', '#eaecea'], lip: '#a9b8bb', pool: '#25cfc6', edge: '#17a39c', ground: '#c9cfcb', boulder: ['#a3a8a8', '#8b9090'] },
  ember: { rock: ['#7a4a38', '#6a3e30', '#5c3428', '#86523c'], lip: '#e0662a', pool: '#e8964a', edge: '#b8602a', ground: '#6e5a4e', boulder: ['#4a3a34', '#3c302b'] },
}

// the terraces: [top radius, bottom radius, height]
const TIERS = [
  [1.2, 1.3, 0.16],
  [0.9, 0.98, 0.16],
  [0.64, 0.7, 0.15],
  [0.4, 0.46, 0.14],
]
const TOP = TIERS.reduce((y, t) => y + t[2], 0) // the vent's rim height
const POOL_R = 0.26
const PIECES = 10 // stacked pieces of the water column
const HMAX = 1.35 // full height of the column
const BURST = 2.4 // seconds the column holds before it sinks

// how tall the column is s seconds after a tap
function columnHeight(s, t) {
  if (s < 0 || s > BURST + 1) return 0
  const rise = 1 - Math.exp(-s * 9)
  const fall = s < BURST ? 1 : Math.max(0, 1 - (s - BURST))
  return HMAX * rise * fall * fall * (1 + 0.06 * Math.sin(t * 23) + 0.04 * Math.sin(t * 37))
}

export function Geyser({ look = 'classic' }) {
  const L = LOOKS[look] || LOOKS.classic
  const { tap, handlers, clock } = useTap(1)
  const pieces = useRef([])
  const pool = useRef()
  const ground = useGeo(() => terrainGeo({ radius: 1.75, height: 0.04, seed: 2, rings: 4, segs: 18, rough: 0.3, profile: 'dome', bands: [[0, L.ground]] }), [look])
  const geo = useGeo(
    () => ({
      tiers: TIERS.map(([a, b, h], i) => facet(new THREE.CylinderGeometry(a, b, h, 11, 1).translate(0, h / 2, 0), 0.03, 10 + i, [1, 0.25, 1])),
      ledges: TIERS.slice(0, -1).map(([a], i) => new THREE.RingGeometry(TIERS[i + 1][1] + 0.01, a - 0.06, 22, 1).rotateX(-Math.PI / 2)),
      lips: TIERS.map(([a], i) => facet(new THREE.TorusGeometry(a - 0.02, 0.028, 3, 22).rotateX(Math.PI / 2), 0.008, 20 + i)),
      rim: facet(new THREE.TorusGeometry(POOL_R + 0.04, 0.06, 4, 12).rotateX(Math.PI / 2), 0.012, 30),
      piece: facet(new THREE.IcosahedronGeometry(1, 0), 0.08, 31),
      boulder: blob(1, 5, 0),
      drop: new THREE.OctahedronGeometry(1, 0),
      hit: new THREE.CylinderGeometry(0.45, 0.45, 1.4, 8).translate(0, 0.7, 0),
    }),
    [],
  )
  const boulders = useMemo(() => {
    const r = rng(7)
    return Array.from({ length: 9 }, (_, i) => {
      const a = r() * TAU
      const d = 1.35 + r() * 0.3
      const s = 0.07 + r() * 0.08
      return { p: [Math.cos(a) * d, 0.03, Math.sin(a) * d], s: [s * 1.2, s * 0.8, s], c: L.boulder[i % 2] }
    })
  }, [look]) // eslint-disable-line react-hooks/exhaustive-deps
  const tierY = useMemo(() => TIERS.map((_, i) => TIERS.slice(0, i + 1).reduce((y, t) => y + t[2], 0)), [])

  const erupting = () => (tap.since(clock.elapsedTime) < BURST + 0.4 ? 1 : 0)
  const billowing = () => (tap.since(clock.elapsedTime) < BURST + 2 ? 1 : 0)

  useFrame(() => {
    const t = clock.elapsedTime
    const s = tap.since(t)
    const H = columnHeight(s, t)
    // the column: stacked water pieces, narrow at the vent, frothing wider up top
    pieces.current.forEach((m, i) => {
      if (!m) return
      m.visible = H > 0.03
      if (!m.visible) return
      const u = (i + 0.5) / PIECES
      const w = (0.1 + 0.07 * u + 0.02 * Math.sin(t * 17 + i * 2)) * Math.min(1, H / 0.4)
      m.position.set(Math.sin(t * 11 + i) * 0.012, TOP + H * u, Math.cos(t * 13 + i) * 0.012)
      m.scale.set(w, (H / PIECES) * 0.95, w)
      m.rotation.y = t * 4 + i * 0.9
    })
    // the pool heaves while it erupts
    if (pool.current) pool.current.position.y = TOP - 0.03 + (H > 0 ? 0.02 + Math.sin(t * 20) * 0.01 : 0)
  })

  return (
    <group {...handlers}>
      <mesh geometry={ground}>
        <Flat vertexColors color="#ffffff" roughness={0.95} />
      </mesh>
      {boulders.map((b, i) => (
        <mesh key={i} geometry={geo.boulder} position={b.p} scale={b.s} rotation-y={i}>
          <Flat color={b.c} />
        </mesh>
      ))}
      {/* the terraces, each with a coloured lip and a shallow pool on its ledge */}
      {geo.tiers.map((g, i) => (
        <group key={i} position-y={tierY[i] - TIERS[i][2]}>
          <mesh geometry={g}>
            <Flat color={L.rock[i % L.rock.length]} />
          </mesh>
          <mesh geometry={geo.lips[i]} position-y={TIERS[i][2]}>
            <Flat color={L.lip} />
          </mesh>
          {geo.ledges[i] && (
            <mesh geometry={geo.ledges[i]} position-y={TIERS[i][2] + 0.008}>
              <Flat color={L.pool} roughness={0.25} emissive={L.pool} emissiveIntensity={0.12} />
            </mesh>
          )}
        </group>
      ))}
      {/* the vent: a rim round a pool of rolling water */}
      <mesh geometry={geo.rim} position-y={TOP + 0.01}>
        <Flat color={L.rock[3]} />
      </mesh>
      <group ref={pool} position-y={TOP - 0.03}>
        <Water radius={POOL_R} rings={3} segs={12} color={L.pool} edge={L.edge} amp={0.012} speed={2.5} y={0.04} />
      </group>
      {/* steam curling up, and bubbles breaking on the pool */}
      <Particles count={14} life={3.6} origin={[0, TOP + 0.05, 0]} spread={0.12} velocity={[0.05, 0.38, 0.02]} scatter={0.06} drift={0.22} size={[0.06, 0.24]} colors={['#ffffff', '#eef2f4', '#dfe6ea']} opacity={[0.65, 0]} seed={2} />
      <Particles count={10} life={0.7} origin={[0, TOP + 0.02, 0]} spread={0.17} velocity={[0, 0.1, 0]} scatter={0.02} drift={0} size={[0.02, 0.035]} colors={['#ffffff', L.pool]} opacity={[0.95, 0]} seed={5} />
      {/* the eruption: the column, spray raining back and a billow of steam */}
      {Array.from({ length: PIECES }, (_, i) => (
        <mesh key={i} ref={(el) => (pieces.current[i] = el)} geometry={geo.piece} visible={false}>
          <meshStandardMaterial color={i % 2 ? '#ffffff' : L.pool} emissive={i % 2 ? '#ffffff' : L.pool} emissiveIntensity={0.25} flatShading roughness={0.3} transparent opacity={0.88} />
        </mesh>
      ))}
      <Particles count={36} life={1.25} origin={[0, TOP + 0.9, 0]} spread={0.1} velocity={[0, 1.7, 0]} scatter={0.85} gravity={4} drift={0} size={[0.035, 0.025]} colors={['#ffffff', '#e6f6fc', L.pool]} opacity={[1, 0.4]} geometry={geo.drop} active={erupting} seed={9} />
      <Particles count={14} life={2.6} origin={[0, TOP + 0.4, 0]} spread={0.2} velocity={[0, 0.7, 0]} scatter={0.25} drift={0.3} size={[0.12, 0.4]} colors={['#ffffff', '#f2f5f7']} opacity={[0.4, 0]} active={billowing} seed={12} />
      {/* an invisible core over the vent, so a tap at the middle lands */}
      <mesh geometry={geo.hit}>
        <meshBasicMaterial visible={false} />
      </mesh>
    </group>
  )
}

export default function GeyserScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[3.8, 2.7, 5.2]} target={[0, 0.95, 0]} hint="Steam curls up and the pool at the top bubbles on its own · tap it to erupt: a column of water shoots up, spray rains back down and it subsides · Look swaps classic, sulphur, turquoise and ember · drag to orbit">
      <Geyser {...props} />
    </Stage>
  )
}
