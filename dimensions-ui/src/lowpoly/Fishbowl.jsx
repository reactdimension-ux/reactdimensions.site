import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Burst, Face, Flat, Liquid, Particles, Stage, Sway, TAU, blob, cone, facet, followPath, rng, useGeo, useTap } from './kit.jsx'

// A low-poly fish in a round glass bowl: water that stays level, coloured
// pebbles, swaying weed and bubbles rising from a little stone. The fish
// swims a figure-of-eight round the bowl, banking into its turns, its body
// and tail swinging side to side as it swims. Tap it and it darts: a burst
// of speed with a flurry of tail beats and a stream of bubbles.

const FISH = {
  goldfish: { body: '#f28c38', belly: '#f6c27a', fin: '#f6a65a' },
  betta: { body: '#3d5fe0', belly: '#6f8af0', fin: '#e3393f' },
  clown: { body: '#f07b2a', belly: '#f6a65a', fin: '#2c2a33', stripes: true },
  neon: { body: '#2fa5d8', belly: '#e3393f', fin: '#8fd0ff' },
}
const R = 0.46 // bowl radius
const CY = 0.47 // bowl centre height
const BOWL = Array.from({ length: 11 }, (_, i) => {
  const a = -Math.PI / 2 + (i / 10) * Math.PI * 0.78
  return [Math.max(0.001, Math.cos(a) * R), CY + Math.sin(a) * R]
})
const WATER = BOWL.filter(([, y]) => y < CY + R * 0.62).map(([r, y]) => [r * 0.95, y + 0.01])
WATER.push([0.001, WATER[WATER.length - 1][1]])

export function Fishbowl({ fish = 'goldfish' }) {
  const F = FISH[fish] || FISH.goldfish
  const { tap, handlers, clock } = useTap(1)
  const swimmer = useRef()
  const st = useRef({ ph: 0 })

  const geo = useGeo(
    () => ({
      glass: new THREE.LatheGeometry(BOWL.map(([r, y]) => new THREE.Vector2(r, y)), 14),
      lip: new THREE.TorusGeometry(BOWL[BOWL.length - 1][0], 0.012, 4, 14).rotateX(Math.PI / 2),
      body: facet(new THREE.IcosahedronGeometry(0.06, 1), 0.004, 1).scale(0.7, 1, 1.6),
      tail: (() => {
        const s = new THREE.Shape()
        s.moveTo(0, 0)
        s.lineTo(0.06, -0.09)
        s.lineTo(0.02, -0.06)
        s.lineTo(0, -0.1)
        s.lineTo(-0.02, -0.06)
        s.lineTo(-0.06, -0.09)
        s.closePath()
        return new THREE.ShapeGeometry(s).rotateX(Math.PI / 2).rotateZ(Math.PI / 2) // a vertical fin trailing behind
      })(),
      fin: cone(0.03, 0.06, 3, 2).scale(0.3, 1, 1),
      side: facet(new THREE.IcosahedronGeometry(0.025, 0), 0.002, 3).scale(1.6, 0.3, 1),
      stripe: new THREE.TorusGeometry(0.052, 0.01, 3, 10).scale(0.85, 1.2, 1),
      pebble: blob(0.035, 4, 0),
      weed: cone(0.025, 0.12, 4, 5),
      stone: blob(0.06, 6),
      base: facet(new THREE.CylinderGeometry(0.22, 0.26, 0.04, 10, 1).translate(0, 0.02, 0), 0.004, 7),
      bubble: new THREE.IcosahedronGeometry(1, 0),
    }),
    [],
  )
  const pebbles = useMemo(() => {
    const r = rng(3)
    const cols = ['#f27aa6', '#7fc8f0', '#f6d24a', '#8be08a', '#ffffff']
    return Array.from({ length: 22 }, (_, i) => {
      const a = r() * TAU
      const d = Math.sqrt(r()) * 0.28
      return [Math.cos(a) * d, 0.04 + r() * 0.02, Math.sin(a) * d, cols[i % cols.length]]
    })
  }, [])
  // a figure of eight inside the bowl
  const path = (p) => new THREE.Vector3(Math.sin(p) * 0.22, CY - 0.02 + Math.sin(p * 2 + 1) * 0.06, Math.sin(p * 2) * 0.13)

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05)
    const t = clock.elapsedTime
    const dart = tap.value(t)
    st.current.ph += dt * (0.6 + dart * 2.5)
    followPath(swimmer.current, path, st.current.ph, 0.6, 0.03)
  })

  return (
    <group {...handlers}>
      <mesh geometry={geo.base}>
        <Flat color="#6e4a34" />
      </mesh>
      {pebbles.map(([x, y, z, c], i) => (
        <mesh key={i} geometry={geo.pebble} position={[x, y, z]} scale={[1, 0.6, 1]}>
          <Flat color={c} />
        </mesh>
      ))}
      <mesh geometry={geo.stone} position={[-0.12, 0.07, -0.08]} scale={[1.3, 0.9, 1]}>
        <Flat color="#8d8a85" />
      </mesh>
      {[
        [0.14, -0.12],
        [0.2, 0.05],
        [-0.2, 0.12],
      ].map(([x, z], k) => (
        <group key={k} position={[x, 0.05, z]}>
          {[0, 1, 2].reduceRight(
            (child, i) => (
              <group position-y={i === 0 ? 0 : 0.1}>
                <Sway i={i + k} rate={0.35} amp={0.18} lag={0.7} axis="z">
                  <mesh geometry={geo.weed}>
                    <Flat color={i % 2 ? '#3f9a4a' : '#4fae5a'} />
                  </mesh>
                  {child}
                </Sway>
              </group>
            ),
            null,
          )}
        </group>
      ))}

      {/* the fish */}
      <group ref={swimmer}>
        <Sway rate={1.6} amp={0.12} axis="y">
          <mesh geometry={geo.body}>
            <Flat color={F.body} />
          </mesh>
          <mesh geometry={geo.body} position={[0, -0.015, 0.01]} scale={[0.75, 0.6, 0.85]}>
            <Flat color={F.belly} />
          </mesh>
          {F.stripes &&
            [0.03, -0.05].map((z) => (
              <mesh key={z} geometry={geo.stripe} position-z={z}>
                <Flat color="#ffffff" />
              </mesh>
            ))}
          <mesh geometry={geo.fin} position={[0, 0.045, -0.01]} rotation-x={-0.5}>
            <Flat color={F.fin} />
          </mesh>
          {[-1, 1].map((x) => (
            <mesh key={x} geometry={geo.side} position={[x * 0.045, -0.015, 0.02]} rotation-z={x * 0.6}>
              <Flat color={F.fin} />
            </mesh>
          ))}
          <Face position={[0, 0.015, 0.075]} spacing={0.07} size={0.012} mouth="o" mouthWidth={0.02} mouthY={-0.025} />
          <group position-z={-0.085}>
            <Sway rate={2.2} amp={0.45} axis="y" i={1} lag={1}>
              <mesh geometry={geo.tail}>
                <Flat color={F.fin} side={THREE.DoubleSide} />
              </mesh>
            </Sway>
          </group>
        </Sway>
      </group>

      <Particles count={10} life={2} origin={[-0.12, 0.12, -0.08]} spread={0.02} velocity={[0, 0.17, 0]} scatter={0.02} drift={0.02} size={[0.008, 0.016]} colors={['#ffffff', '#dff3ff']} opacity={[0.9, 0.6]} />
      <Burst tap={tap} geometry={geo.bubble} count={12} colors={['#ffffff', '#dff3ff']} speed={0.35} gravity={-0.4} size={0.014} life={1.6} origin={[0, CY, 0]} spread={0.8} up={1} />

      <Liquid profile={WATER} fill={0.8} color="#7fd0f0" surface="#bfe9fb" opacity={0.3} slosh={0.6} />
      <mesh geometry={geo.glass} renderOrder={2}>
        <meshStandardMaterial color="#e6f6ff" flatShading roughness={0.05} metalness={0.1} transparent opacity={0.15} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh geometry={geo.lip} position-y={BOWL[BOWL.length - 1][1]}>
        <meshStandardMaterial color="#e6f6ff" transparent opacity={0.4} flatShading />
      </mesh>
    </group>
  )
}

export default function FishbowlScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[1.8, 1.3, 2.4]} target={[0, 0.45, 0]} hint="The fish swims a figure of eight round the bowl, banking into turns, body and tail swinging as it goes · tap it and it darts with a flurry of tail beats and bubbles · Fish swaps goldfish, betta, clown and neon · drag to orbit">
      <Fishbowl {...props} />
    </Stage>
  )
}
