import { useMemo } from 'react'
import * as THREE from 'three'
import { Burst, Flame, Flat, Particles, Stage, TAU, blob, facet, rng, useGeo, useTap } from './kit.jsx'

// A low-poly campfire: a ring of faceted stones on a patch of earth, logs
// stacked in a teepee, and a flickering flame that lights the ground. Embers
// float up and smoke curls away above it. Tap it and it flares and throws a
// shower of sparks.

const FIRES = {
  fire: { flame: ['#ff5a1f', '#ffae2e', '#fff3b0'], ember: ['#ffb02e', '#ff6a1f'] },
  blue: { flame: ['#2f7bff', '#6fc3ff', '#e8f8ff'], ember: ['#6fc3ff', '#2f7bff'] },
  green: { flame: ['#2fbf4a', '#8af06a', '#efffe0'], ember: ['#8af06a', '#2fbf4a'] },
  purple: { flame: ['#9a3fff', '#d07aff', '#fbe8ff'], ember: ['#d07aff', '#9a3fff'] },
}
const STONES = 9
const LOGS = 5

export function Campfire({ fire = 'fire', smoke = true }) {
  const F = FIRES[fire] || FIRES.fire
  const { tap, handlers, clock } = useTap(1.4)
  const geo = useGeo(
    () => ({
      earth: facet(new THREE.CylinderGeometry(0.95, 1, 0.06, 12, 1).translate(0, 0.03, 0), 0.03, 1, [1, 0.2, 1]),
      ash: new THREE.CylinderGeometry(0.34, 0.36, 0.03, 9, 1),
      stone: blob(0.13, 2),
      log: facet(new THREE.CylinderGeometry(0.06, 0.07, 0.7, 6, 1), 0.008, 3),
      end: new THREE.CylinderGeometry(0.058, 0.058, 0.01, 6, 1),
      coal: new THREE.OctahedronGeometry(0.05, 0),
      spark: new THREE.TetrahedronGeometry(1, 0),
    }),
    [],
  )
  const stones = useMemo(() => {
    const r = rng(6)
    return Array.from({ length: STONES }, (_, i) => [(i / STONES) * TAU + r() * 0.2, 0.75 + r() * 0.5, r() * 3])
  }, [])

  const power = () => 1 + tap.value(clock.elapsedTime) * 0.9

  return (
    <group {...handlers}>
      <mesh geometry={geo.earth}>
        <Flat color="#7a5a40" />
      </mesh>
      <mesh geometry={geo.ash} position-y={0.07}>
        <Flat color="#3a302c" />
      </mesh>
      {stones.map(([a, s, rot], i) => (
        <mesh key={i} geometry={geo.stone} position={[Math.cos(a) * 0.48, 0.1, Math.sin(a) * 0.48]} rotation-y={rot} scale={[s, s * 0.75, s]}>
          <Flat color={i % 2 ? '#8d8a85' : '#a6a29b'} />
        </mesh>
      ))}

      {/* logs leaning in a teepee */}
      {Array.from({ length: LOGS }, (_, i) => {
        const a = (i / LOGS) * TAU
        return (
          <group key={i} rotation-y={-a}>
            <group position={[0.2, 0.2, 0]} rotation-z={0.95}>
              <mesh geometry={geo.log}>
                <Flat color={i % 2 ? '#6e4a34' : '#5c3c2a'} />
              </mesh>
              <mesh geometry={geo.end} position-y={-0.35}>
                <Flat color="#d9b48a" />
              </mesh>
            </group>
          </group>
        )
      })}
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} geometry={geo.coal} position={[Math.cos(i * 1.9) * 0.15, 0.1, Math.sin(i * 1.9) * 0.15]} rotation-y={i}>
          <Flat color={F.ember[1]} emissive={F.ember[1]} emissiveIntensity={1.2} />
        </mesh>
      ))}

      <Flame position-y={0.08} size={0.95} colors={F.flame} power={power} />
      <Particles count={14} life={1.6} origin={[0, 0.3, 0]} spread={0.12} velocity={[0, 0.75, 0]} scatter={0.1} drift={0.2} size={[0.025, 0.005]} colors={F.ember} opacity={[1, 0.2]} emissive={1.5} />
      {smoke && <Particles count={12} life={3.2} origin={[0, 0.85, 0]} spread={0.05} velocity={[0.08, 0.4, 0]} scatter={0.08} drift={0.25} size={[0.06, 0.22]} colors={['#9a9aa2', '#b8b8c0']} opacity={[0.45, 0]} seed={4} />}
      <Burst tap={tap} geometry={geo.spark} count={22} colors={F.ember} speed={2.6} gravity={3} size={0.03} life={1.3} origin={[0, 0.4, 0]} spread={0.7} up={1.8} />
    </group>
  )
}

export default function CampfireScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[2.8, 2, 3.8]} target={[0, 0.45, 0]} hint="The fire flickers, embers rise and smoke curls away on its own · tap it and it flares and throws sparks · Fire swaps fire, blue, green and purple · Smoke turns the smoke on and off · drag to orbit">
      <Campfire {...props} />
    </Stage>
  )
}
