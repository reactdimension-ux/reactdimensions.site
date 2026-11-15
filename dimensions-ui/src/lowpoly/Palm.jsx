import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Flat, Stage, Sway, TAU, blob, facet, rng, useGeo, useTap } from './kit.jsx'

// A low-poly palm on a sandy islet: a curving trunk of seven ringed
// segments, a crown of drooping two-part fronds and a bunch of coconuts. The
// trunk sways as a lag chain, each segment a beat behind the one below, and
// the fronds bob on their own. Tap it and a shake runs up the trunk and a
// coconut drops, bounces, rolls and grows back.

const LEAVES = {
  tropical: ['#3fae4f', '#2f8f42'],
  lime: ['#8fd14a', '#6bb53a'],
  olive: ['#7d9a4a', '#62803a'],
  autumn: ['#e39a3a', '#c9772a'],
}
const TRUNK = ['#9a6b45', '#84593a']
const SAND = '#f0d9a0'
const NUT = '#6b4a2e'
const SEGS = 7
const SEG_H = 0.2
const FRONDS = 7
const G = 9

export function Palm({ leaves = 'tropical', wind = 0.5 }) {
  const L = LEAVES[leaves] || LEAVES.tropical
  const { tap, handlers, clock } = useTap(1.5)
  const root = useRef()
  const nut0 = useRef()
  const drop = useRef()
  const st = useRef({ t0: -99, from: new THREE.Vector3(), out: new THREE.Vector3() })

  const geo = useGeo(
    () => ({
      segs: Array.from({ length: SEGS }, (_, i) => {
        const r = 0.13 - i * 0.009
        return facet(new THREE.CylinderGeometry(r * 0.86, r * 1.08, SEG_H, 6, 1).translate(0, SEG_H / 2, 0), 0.008, 20 + i)
      }),
      leaf: facet(new THREE.ConeGeometry(0.12, 0.62, 4, 1).rotateX(Math.PI / 2).translate(0, 0, 0.31), 0.012, 2).scale(1.7, 0.22, 1),
      tip: facet(new THREE.ConeGeometry(0.1, 0.5, 4, 1).rotateX(Math.PI / 2).translate(0, 0, 0.25), 0.01, 3).scale(1.6, 0.22, 1),
      nut: blob(0.075, 4),
      sand: facet(new THREE.SphereGeometry(1, 10, 4, 0, TAU, 0, Math.PI / 2), 0.05, 5, [1, 0.4, 1], (x, y) => y < 0.001),
      pebble: blob(0.06, 6, 0),
    }),
    [],
  )
  const pebbles = useMemo(() => {
    const r = rng(7)
    return Array.from({ length: 6 }, () => {
      const a = r() * TAU
      const d = 0.45 + r() * 0.35
      return [Math.cos(a) * d, Math.sin(a) * d, 0.6 + r() * 0.8]
    })
  }, [])

  useFrame(() => {
    const t = clock.elapsedTime
    const s = tap.since(t)
    const S = st.current
    // a new tap: note where the coconut hangs, in the palm's own frame
    if (s >= 0 && s < 0.2 && Math.abs(t - s - S.t0) > 1e-3) {
      S.t0 = t - s
      nut0.current.getWorldPosition(S.from)
      root.current.worldToLocal(S.from)
      S.out.set(S.from.x, 0, S.from.z).normalize()
    }
    const falling = s >= 0 && s < 2.6
    const d = drop.current
    d.visible = falling
    nut0.current.visible = !falling
    if (s >= 2.6 && s < 3.2) nut0.current.scale.setScalar(Math.max(0.001, (s - 2.6) / 0.6))
    else nut0.current.scale.setScalar(1)
    if (!falling) return
    const land = 0.18
    const tf = Math.sqrt((2 * Math.max(0.01, S.from.y - land)) / G)
    if (s < tf) {
      d.position.set(S.from.x, S.from.y - 0.5 * G * s * s, S.from.z)
    } else {
      const u = s - tf
      const roll = (1 - Math.exp(-2 * u)) * 0.35
      d.position.set(S.from.x + S.out.x * roll, land + Math.abs(Math.sin(u * 9)) * 0.22 * Math.exp(-4 * u), S.from.z + S.out.z * roll)
      d.rotation.z = -u * 6 * Math.exp(-u)
    }
  })

  const amp = 0.006 + wind * 0.03
  const crown = (
    <group position-y={SEG_H}>
      {Array.from({ length: FRONDS }, (_, k) => (
        <group key={k} rotation-y={(k / FRONDS) * TAU + 0.3}>
          <Sway axis="x" i={k} rate={0.45 + wind * 0.3} amp={0.04 + wind * 0.1} lag={1.3} kick={tap} kickAmp={0.25}>
            <group rotation-x={-0.35}>
              <mesh geometry={geo.leaf}>
                <Flat color={L[k % 2]} emissive={L[k % 2]} emissiveIntensity={0.3} />
              </mesh>
              <group position-z={0.58} rotation-x={0.85}>
                <mesh geometry={geo.tip}>
                  <Flat color={L[(k + 1) % 2]} emissive={L[(k + 1) % 2]} emissiveIntensity={0.3} />
                </mesh>
              </group>
            </group>
          </Sway>
        </group>
      ))}
      {[0, 1, 2].map((i) => {
        const a = (i / 3) * TAU + 0.6
        return (
          <mesh key={i} ref={i === 0 ? nut0 : undefined} geometry={geo.nut} position={[Math.cos(a) * 0.09, -0.04, Math.sin(a) * 0.09]}>
            <Flat color={NUT} />
          </mesh>
        )
      })}
    </group>
  )

  // the trunk: each segment sits on the top of the one below, bent a little
  // further, and sways a beat behind it
  const chain = (i) =>
    i === SEGS ? (
      crown
    ) : (
      <group position-y={i === 0 ? 0 : SEG_H} rotation-z={i === 0 ? 0.04 : 0.075}>
        <Sway i={i} rate={0.35 + wind * 0.2} amp={amp} lag={0.35} kick={tap} kickAmp={0.035}>
          <mesh geometry={geo.segs[i]}>
            <Flat color={TRUNK[i % 2]} />
          </mesh>
          {chain(i + 1)}
        </Sway>
      </group>
    )

  return (
    <group ref={root} {...handlers}>
      <mesh geometry={geo.sand} scale={[0.95, 0.24, 0.85]}>
        <Flat color={SAND} />
      </mesh>
      {pebbles.map(([x, z, s], i) => (
        <mesh key={i} geometry={geo.pebble} position={[x, 0.1, z]} scale={[s, s * 0.6, s]}>
          <Flat color={i % 2 ? '#c9b48a' : '#e3cfa0'} />
        </mesh>
      ))}
      <group position={[0.22, 0.18, 0]}>{chain(0)}</group>
      <mesh ref={drop} geometry={geo.nut} visible={false}>
        <Flat color={NUT} />
      </mesh>
    </group>
  )
}

export default function PalmScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[3.6, 2.4, 4.8]} target={[0, 0.95, 0]} hint="The trunk and fronds sway in the breeze on their own · tap it and a shake runs up the trunk and a coconut drops · Wind sets the sway · Leaves swaps tropical, lime, olive and autumn · drag to orbit">
      <Palm {...props} />
    </Stage>
  )
}
