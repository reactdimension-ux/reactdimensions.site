import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Burst, Face, Flat, Stage, Sway, TAU, Trail, Wing, blob, cone, facet, followPath, useGeo, useTap } from './kit.jsx'

// A low-poly bee working a big flower: a fuzzy striped body with a stinger,
// antennae, tiny legs and two pairs of glassy wings buzzing in a blur. It
// hovers round the flower on a looping path, bobbing and banking into its
// turns, while the flower nods on its stem. Tap it and it pulls a loop, and
// a puff of pollen bursts from the flower.

const KINDS = {
  honey: { band: '#f2b632', dark: '#2c2420', wing: '#e8f4ff', fuzz: '#f6c94a' },
  bumble: { band: '#f6d24a', dark: '#1f1e24', wing: '#e8f4ff', fuzz: '#ffffff' },
  carpenter: { band: '#2c2a33', dark: '#1a1920', wing: '#9ab0e0', fuzz: '#3a3846' },
  orchid: { band: '#3fbf8a', dark: '#1f6f5a', wing: '#d8f6ec', fuzz: '#5ad6a6' },
}
const LOOP = 1.3
const LOOP_R = 0.18

export function Bee({ kind = 'honey' }) {
  const K = KINDS[kind] || KINDS.honey
  const { tap, handlers, clock } = useTap(1)
  const bee = useRef()

  const geo = useGeo(
    () => ({
      grass: facet(new THREE.CylinderGeometry(0.8, 0.85, 0.05, 12, 1).translate(0, 0.025, 0), 0.02, 1, [1, 0.3, 1]),
      stem: facet(new THREE.CylinderGeometry(0.025, 0.035, 0.6, 5, 2).translate(0, 0.3, 0), 0.006, 2),
      leaf: facet(new THREE.IcosahedronGeometry(0.1, 0), 0.006, 3).scale(0.6, 0.15, 1.5).translate(0, 0, 0.12),
      petal: facet(new THREE.IcosahedronGeometry(0.1, 0), 0.006, 4).scale(0.6, 0.18, 1.4).translate(0, 0, 0.14),
      heart: blob(0.08, 5),
      head: blob(0.04, 6),
      thorax: blob(0.05, 7),
      band: new THREE.CylinderGeometry(1, 1, 1, 8, 1).rotateX(Math.PI / 2),
      sting: cone(0.012, 0.04, 4, 8).rotateX(-Math.PI / 2),
      antenna: new THREE.CylinderGeometry(0.003, 0.003, 0.06, 3, 1).translate(0, 0.03, 0),
      knob: new THREE.IcosahedronGeometry(0.008, 0),
      leg: new THREE.BoxGeometry(0.006, 0.04, 0.006).translate(0, -0.02, 0),
      pollen: new THREE.IcosahedronGeometry(1, 0),
    }),
    [],
  )
  const path = (p) => new THREE.Vector3(Math.cos(p) * 0.5, 0.82 + Math.sin(p * 3) * 0.08, Math.sin(p) * 0.42)

  useFrame(() => {
    const t = clock.elapsedTime
    const o = bee.current
    followPath(o, path, t * 0.7, 1.2, 0.03)
    o.position.y += Math.sin(t * 9) * 0.008 // the hover jitter
    const s = tap.since(t)
    if (s >= 0 && s < LOOP) {
      const u = s / LOOP
      const th = u * u * (3 - 2 * u) * TAU
      o.translateY(LOOP_R * (1 - Math.cos(th)))
      o.translateZ(LOOP_R * Math.sin(th))
      o.rotateX(-th)
    }
  })

  const buzz = () => 0.35 + Math.sin(clock.elapsedTime * 70) * 0.65
  // abdomen bands, front to back: radius, colour
  const bands = [
    [0.055, K.band],
    [0.06, K.dark],
    [0.058, K.band],
    [0.05, K.dark],
    [0.038, kind === 'bumble' ? K.fuzz : K.band],
    [0.024, K.dark],
  ]

  return (
    <group {...handlers}>
      <mesh geometry={geo.grass}>
        <Flat color="#7fbf52" />
      </mesh>
      {/* the flower, nodding on its stem */}
      <Sway rate={0.3} amp={0.05} axis="z" position-y={0.05}>
        <mesh geometry={geo.stem}>
          <Flat color="#4f9a3a" />
        </mesh>
        {[0.25, 0.38].map((y, i) => (
          <mesh key={y} geometry={geo.leaf} position-y={y} rotation={[0.5, i ? 2.6 : 0.3, 0]}>
            <Flat color="#3f8a3a" />
          </mesh>
        ))}
        <group position-y={0.6} rotation-x={0.25}>
          <mesh geometry={geo.heart} scale={[1, 0.55, 1]}>
            <Flat color="#f2a63a" />
          </mesh>
          {Array.from({ length: 9 }, (_, i) => (
            <mesh key={i} geometry={geo.petal} rotation={[-0.2, (i / 9) * TAU, 0]}>
              <Flat color={i % 2 ? '#f27aa6' : '#f598bc'} />
            </mesh>
          ))}
        </group>
      </Sway>

      {/* the bee, facing +z along its path */}
      <group ref={bee}>
        <group scale={1.0}>
          <mesh geometry={geo.head} position-z={0.075}>
            <Flat color={K.dark} />
          </mesh>
          <Face position={[0, 0.012, 0.11]} spacing={0.04} size={0.009} color="#ffffff" mouth="none" />
          {[-1, 1].map((x) => (
            <group key={x} position={[x * 0.015, 0.03, 0.09]} rotation={[0.6, 0, -x * 0.4]}>
              <mesh geometry={geo.antenna}>
                <Flat color={K.dark} />
              </mesh>
              <mesh geometry={geo.knob} position-y={0.06}>
                <Flat color={K.dark} />
              </mesh>
            </group>
          ))}
          <mesh geometry={geo.thorax} position-z={0.02}>
            <Flat color={K.fuzz} />
          </mesh>
          {bands.map(([r, c], i) => (
            <mesh key={i} geometry={geo.band} position-z={-0.04 - i * 0.022} scale={[r, r * 0.95, 0.024]}>
              <Flat color={c} />
            </mesh>
          ))}
          <mesh geometry={geo.sting} position-z={-0.17}>
            <Flat color={K.dark} />
          </mesh>
          {[-1, 1].map((x) =>
            [0.03, 0.0, -0.03].map((z) => (
              <mesh key={`${x}${z}`} geometry={geo.leg} position={[x * 0.03, -0.03, z]} rotation-z={x * 0.4}>
                <Flat color={K.dark} />
              </mesh>
            )),
          )}
          {[-1, 1].map((x) => (
            <group key={x} position={[x * 0.03, 0.045, 0.01]}>
              <Wing side={x} span={0.13} chord={0.07} color={K.wing} angle={buzz} rotation-y={x * 0.35} />
              <Wing side={x} span={0.1} chord={0.05} color={K.wing} angle={buzz} position-z={-0.035} rotation-y={x * 0.6} />
            </group>
          ))}
        </group>
      </group>
      <Trail target={bee} count={14} every={0.05} color="#fff3b0" size={0.012} grow={0} opacity={0.6} />
      <Burst tap={tap} geometry={geo.pollen} count={16} colors={['#f6d24a', '#ffe58a']} speed={0.8} gravity={0.6} size={0.02} life={1.5} origin={[0, 0.68, 0.05]} up={1.2} />
    </group>
  )
}

export default function BeeScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[2.2, 1.6, 2.8]} target={[0, 0.65, 0]} hint="The bee hovers round the flower on a looping path, wings buzzing, banking into its turns · tap it and it pulls a loop and pollen bursts from the flower · Kind swaps honey, bumble, carpenter and orchid · drag to orbit">
      <Bee {...props} />
    </Stage>
  )
}
