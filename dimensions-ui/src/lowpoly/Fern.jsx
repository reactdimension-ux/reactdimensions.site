import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Flat, Stage, TAU, blob, facet, rng, useGeo, useTap } from './kit.jsx'

// A low-poly fern on a mossy mound: a clump of arching fronds, each a
// tapering chain of stem links with a pair of leaflets on every link, and
// one young frond in the middle. Left alone, the young frond slowly unrolls
// from its fiddlehead spiral, base first, and later rolls back up, while the
// grown fronds sway. Tap it and every frond curls up into a spiral from the
// tip down, holds a beat, then opens again.

const LOOKS = {
  forest: { frond: ['#3f8a3c', '#4b9a43', '#357a36'], stem: '#4f7330', young: '#6fae4a', moss: ['#5d8a3a', '#6f9c45', '#4f7b32'], stone: ['#9c9a92', '#85837c'] },
  spring: { frond: ['#78c24c', '#8ed35a', '#66b042'], stem: '#6e9a36', young: '#a8dc6a', moss: ['#86b552', '#9ac760', '#76a447'], stone: ['#b2aea3', '#9a968c'] },
  autumn: { frond: ['#d2873a', '#e2a446', '#b86a2e'], stem: '#875a2c', young: '#c9a548', moss: ['#8a8a3e', '#9e9748', '#77783a'], stone: ['#a39b8e', '#8b8377'] },
}

const N = 9 // links in a frond
const LEN = (i) => 0.17 * (1 - (0.55 * i) / N)
const smooth = (x) => {
  const k = Math.min(1, Math.max(0, x))
  return k * k * (3 - 2 * k)
}

// The tap: curl in over half a second (the tip a beat ahead of the base),
// hold, then unroll.
function tapCurl(s, i) {
  const u = s - (N - i) * 0.035
  if (s < 0 || u < 0) return 0
  if (u < 0.55) return smooth(u / 0.55)
  if (u < 1.15) return 1
  return 1 - smooth((u - 1.15) / 1.7)
}
const TAP_LEN = 3.2

// The young frond's slow cycle: rolled, unrolling base first, open, rolling
// back up.
function idleCurl(t, i) {
  const p = t % 11
  const u = p < 1.2 ? 0 : p < 6.7 ? smooth((p - 1.2) / 5.5) : p < 9 ? 1 : 1 - smooth((p - 9) / 2)
  return 1 - smooth(u * 1.6 - (0.6 * i) / N)
}

function Frond({ f, geo, L, tapRef, clock }) {
  const links = useRef([])
  const pairs = useRef([])
  useFrame(() => {
    const t = clock.elapsedTime
    const s = tapRef.current.since(t)
    for (let i = 0; i < N; i++) {
      const g = links.current[i]
      if (!g) continue
      let c = tapCurl(s, i)
      if (f.young) c = Math.max(c, idleCurl(t, i))
      const k = i / (N - 1)
      const open = f.arch * (0.05 + 0.09 * k)
      const curled = 0.1 + 1.15 * k ** 1.3
      const sway = (1 - c) * (0.01 + 0.018 * k)
      g.rotation.x = open + (curled - open) * c + sway * Math.sin(t * f.rate * TAU - i * 0.5 + f.off)
      g.rotation.z = sway * 0.8 * Math.sin(t * f.rate * 0.8 * TAU - i * 0.4 + f.off * 1.7)
      const p = pairs.current[i]
      if (p) p.scale.setScalar(Math.max(0.001, 1 - 0.6 * c))
    }
  })
  const chain = (i) => {
    if (i === N) return null
    const l = LEN(i)
    const w = 1 - (0.75 * i) / N
    return (
      <group ref={(el) => (links.current[i] = el)} position-y={i === 0 ? 0 : LEN(i - 1)}>
        <mesh geometry={geo.stem} scale={[0.022 * w + 0.006, l * 1.04, 0.022 * w + 0.006]}>
          <Flat color={L.stem} />
        </mesh>
        {i > 0 && (
          <group ref={(el) => (pairs.current[i] = el)} position-y={l * 0.45}>
            {[1, -1].map((side) => (
              <group key={side} scale={[side, 1, 1]} rotation-z={side * 0.5}>
                <mesh geometry={geo.leaflet} scale={[0.24 * w + 0.05, 0.1 * w + 0.035, 0.012]}>
                  <Flat color={f.color} side={THREE.DoubleSide} />
                </mesh>
              </group>
            ))}
          </group>
        )}
        {i === N - 1 && (
          <mesh geometry={geo.tip} position-y={l} scale={[0.035, 0.08, 0.012]}>
            <Flat color={f.color} side={THREE.DoubleSide} />
          </mesh>
        )}
        {chain(i + 1)}
      </group>
    )
  }
  return (
    <group position={f.pos} rotation-y={f.yaw}>
      <group rotation-x={f.lean} scale={f.size}>
        {chain(0)}
      </group>
    </group>
  )
}

export function Fern({ look = 'forest' }) {
  const L = LOOKS[look] || LOOKS.forest
  const { tap, handlers, clock } = useTap(1.5)
  const tapRef = useRef(tap)
  tapRef.current = tap
  // a tap while the fronds are already curling is ignored, so they never jump
  const onClick = (e) => {
    if (tap.since(clock.elapsedTime) < TAP_LEN) return e.stopPropagation()
    handlers.onClick(e)
  }

  const geo = useGeo(
    () => ({
      stem: new THREE.CylinderGeometry(0.7, 1, 1, 4, 1).translate(0, 0.5, 0),
      // a leaflet: a flat four-sided spike pointing along +x
      leaflet: facet(new THREE.ConeGeometry(0.5, 1, 4, 1).rotateZ(-Math.PI / 2).translate(0.5, 0, 0), 0.04, 3),
      tip: new THREE.ConeGeometry(1, 1, 4, 1).translate(0, 0.5, 0),
      mound: facet(new THREE.SphereGeometry(1, 12, 5, 0, TAU, 0, Math.PI / 2), 0.06, 5, [1, 0.6, 1], (x, y) => y < 0.001),
      bump: blob(0.12, 8),
      stone: blob(0.08, 9, 0),
    }),
    [],
  )

  const fronds = useMemo(() => {
    const r = rng(21)
    const list = Array.from({ length: 9 }, (_, k) => {
      const a = (k / 9) * TAU + (r() - 0.5) * 0.4
      const d = 0.08 + r() * 0.04
      return { pos: [Math.cos(a) * d, 0.33, Math.sin(a) * d], yaw: Math.PI / 2 - a, lean: 0.42 + r() * 0.3, arch: 0.85 + r() * 0.35, size: 1.05 + r() * 0.3, rate: 0.28 + r() * 0.12, off: k * 1.3, color: L.frond[k % L.frond.length] }
    })
    list.push({ pos: [0.02, 0.35, 0.03], yaw: 0.4, lean: 0.1, arch: 0.4, size: 1.15, rate: 0.3, off: 0.5, color: L.young, young: true })
    return list
  }, [look]) // eslint-disable-line react-hooks/exhaustive-deps

  const bits = useMemo(() => {
    const r = rng(5)
    return {
      bumps: Array.from({ length: 7 }, (_, k) => {
        const a = (k / 7) * TAU + r() * 0.5
        const d = 0.32 + r() * 0.2
        return [Math.cos(a) * d, 0.36 * Math.sqrt(Math.max(0, 1 - (d / 0.68) ** 2)) - 0.04, Math.sin(a) * d * 0.9, 0.7 + r() * 0.5]
      }),
      stones: Array.from({ length: 4 }, (_, k) => {
        const a = (k / 4) * TAU + 0.7 + r() * 0.6
        const d = 0.62 + r() * 0.12
        return [Math.cos(a) * d, 0.03, Math.sin(a) * d * 0.9, 0.7 + r() * 0.7]
      }),
    }
  }, [])

  return (
    <group {...handlers} onClick={onClick}>
      <mesh geometry={geo.mound} scale={[0.7, 0.36, 0.62]}>
        <Flat color={L.moss[0]} />
      </mesh>
      {bits.bumps.map(([x, y, z, s], i) => (
        <mesh key={i} geometry={geo.bump} position={[x, y, z]} scale={[s, s * 0.55, s]}>
          <Flat color={L.moss[1 + (i % 2)]} />
        </mesh>
      ))}
      {bits.stones.map(([x, y, z, s], i) => (
        <mesh key={i} geometry={geo.stone} position={[x, y, z]} scale={[s, s * 0.65, s]}>
          <Flat color={L.stone[i % 2]} />
        </mesh>
      ))}
      {fronds.map((f, k) => (
        <Frond key={k} f={f} geo={geo} L={L} tapRef={tapRef} clock={clock} />
      ))}
    </group>
  )
}

export default function FernScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[3.1, 2.1, 4.1]} target={[0, 0.72, 0]} hint="The fronds sway on their own while the young one in the middle slowly unrolls from its fiddlehead and later rolls back up · tap the fern and every frond curls into a spiral, then opens again · Look swaps forest, spring and autumn · drag to orbit">
      <Fern {...props} />
    </Stage>
  )
}
