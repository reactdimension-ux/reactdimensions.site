import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Face, Flat, Particles, Stage, Tail, Water, blob, cone, facet, useGeo, useTap } from './kit.jsx'

// A low-poly elephant at a waterhole: a heavy faceted body on four column
// legs, big flapping ears, curved tusks, a tufted tail and a trunk that is a
// lag chain of tapering links. It shifts its weight from side to side,
// fans its ears, swings its trunk and swishes its tail. Tap it and it
// raises its trunk high and sprays a fountain of water.

const KINDS = {
  savanna: { skin: '#8d8a85', inner: '#c9a8a0', tusk: '#f4ecd8', earScale: 1 },
  asian: { skin: '#6e6a68', inner: '#b8948c', tusk: '#f4ecd8', earScale: 0.65 },
  pink: { skin: '#f2b4c4', inner: '#f8d4de', tusk: '#ffffff', earScale: 1 },
  mammoth: { skin: '#7a4f30', inner: '#9a6a48', tusk: '#f2e2c0', earScale: 0.45, tuskLong: true },
}
const TRUNK = [0, 0.8, 0.7] // trunk root, set just inside the head so it grows out of it

export function Elephant({ kind = 'savanna' }) {
  const K = KINDS[kind] || KINDS.savanna
  const { tap, handlers, clock } = useTap(1)
  const body = useRef()
  const ears = useRef([])
  const trunk = useRef()
  const head = useRef()

  const geo = useGeo(
    () => ({
      ground: facet(new THREE.CylinderGeometry(1.5, 1.55, 0.05, 14, 1).translate(0, 0.025, 0), 0.02, 1, [1, 0.3, 1]),
      tuft: cone(0.03, 0.16, 3, 2),
      body: blob(0.42, 3),
      // legs start inside the body (at its centre height) so they always meet it
      leg: facet(new THREE.CylinderGeometry(0.1, 0.11, 0.73, 7, 1).translate(0, -0.365, 0), 0.006, 4),
      nail: blob(0.025, 5, 0),
      head: blob(0.26, 6),
      ear: (() => {
        const s = new THREE.Shape()
        for (let i = 0; i < 9; i++) {
          const a = (i / 9) * Math.PI * 2
          const x = 0.2 + Math.cos(a) * 0.2
          const y = -0.04 + Math.sin(a) * 0.24 * (a > Math.PI ? 1.15 : 1)
          i ? s.lineTo(x, y) : s.moveTo(x, y)
        }
        return facet(new THREE.ExtrudeGeometry(s, { depth: 0.025, bevelEnabled: false }), 0.006, 7)
      })(),
      tusk: cone(0.03, 0.26, 5, 8),
      tip: blob(0.045, 9, 0),
    }),
    [],
  )
  const spraying = () => {
    const s = tap.since(clock.elapsedTime)
    return s > 0.45 && s < 2.2 ? 1 : 0
  }

  useFrame(() => {
    const t = clock.elapsedTime
    const s = tap.since(t)
    // weight shift and a slow breath
    body.current.rotation.z = Math.sin(t * 0.7) * 0.025
    body.current.position.x = Math.sin(t * 0.7) * 0.015
    // ears fan forward and back
    ears.current.forEach((e, i) => e && (e.rotation.y = (i ? -1 : 1) * (0.35 + Math.sin(t * 1.4 + i * 0.4) * 0.3)))
    // trunk: hangs and swings, or rises for the spray and comes back down
    const raise = s >= 0 && s < 2.8 ? Math.sin(Math.min(1, s / 0.45) * Math.PI * 0.5) * (1 - Math.max(0, (s - 2.2) / 0.6)) : 0
    // -pi/2 hangs it straight down; turning further swings it forward and up
    trunk.current.rotation.x = -1.75 - raise * 2.15
    head.current.rotation.x = -raise * 0.2 + Math.sin(t * 0.5) * 0.03
    head.current.rotation.y = Math.sin(t * 0.33) * 0.12
  })

  return (
    <group {...handlers}>
      <mesh geometry={geo.ground}>
        <Flat color="#d9b878" />
      </mesh>
      {[
        [0.9, -0.5],
        [-0.95, 0.4],
        [-0.7, -0.8],
        [0.7, 0.9],
      ].map(([x, z], i) => (
        <group key={i} position={[x, 0.05, z]}>
          {[-0.3, 0, 0.3].map((a) => (
            <mesh key={a} geometry={geo.tuft} rotation-z={a}>
              <Flat color="#a8a04a" />
            </mesh>
          ))}
        </group>
      ))}
      <group position={[0.55, 0, 0.8]}>
        <Water radius={0.38} rings={3} segs={12} color="#5aa8c8" edge="#3f88a8" amp={0.01} y={0.075} />
      </group>

      <group ref={body}>
        {/* legs */}
        {[
          [-0.2, -0.28],
          [0.2, -0.28],
          [-0.2, 0.3],
          [0.2, 0.3],
        ].map(([x, z]) => (
          <group key={`${x}${z}`} position={[x, 0.78, z]}>
            <mesh geometry={geo.leg}>
              <Flat color={K.skin} />
            </mesh>
            {[-1, 0, 1].map((k) => (
              <mesh key={k} geometry={geo.nail} position={[k * 0.05, -0.71, 0.09]}>
                <Flat color="#f2ead8" />
              </mesh>
            ))}
          </group>
        ))}
        <mesh geometry={geo.body} position-y={0.78} scale={[0.9, 0.82, 1.3]}>
          <Flat color={K.skin} />
        </mesh>
        {/* tail */}
        <Tail position={[0, 0.85, -0.55]} rotation-x={-1.35} segs={3} length={0.3} r0={0.025} r1={0.012} sides={5} colors={[K.skin]} rate={0.9} amp={0.35} lag={0.6} tip={<mesh geometry={geo.tip} position-z={-0.02} scale={[0.6, 0.6, 1.4]}><Flat color="#3a3430" /></mesh>} />

        {/* head, ears, tusks and trunk */}
        <group ref={head} position={[0, 0.98, 0.55]}>
          <mesh geometry={geo.head} scale={[1, 0.95, 0.95]}>
            <Flat color={K.skin} />
          </mesh>
          {[-1, 1].map((x, i) => (
            <group key={x} ref={(el) => (ears.current[i] = el)} position={[x * 0.17, 0.02, -0.08]} scale={[x * K.earScale, K.earScale, K.earScale]}>
              <mesh geometry={geo.ear}>
                <Flat color={K.skin} side={THREE.DoubleSide} />
              </mesh>
              <mesh geometry={geo.ear} position={[0.03, 0, 0.02]} scale={0.8}>
                <Flat color={K.inner} side={THREE.DoubleSide} />
              </mesh>
            </group>
          ))}
          <Face position={[0, 0.06, 0.23]} spacing={0.26} size={0.022} mouth="none" />
          {[-1, 1].map((x) => (
            <mesh key={x} geometry={geo.tusk} position={[x * 0.09, -0.12, 0.12]} rotation={[K.tuskLong ? 1.9 : 2.2, 0, -x * (K.tuskLong ? 0.5 : 0.2)]} scale={K.tuskLong ? [1, 2, 1] : 1}>
              <Flat color={K.tusk} />
            </mesh>
          ))}
          <group ref={trunk} position={[TRUNK[0], TRUNK[1] - 0.98, TRUNK[2] - 0.55]} rotation-x={-1.75}>
            <Tail segs={6} length={0.62} r0={0.085} r1={0.035} sides={7} colors={[K.skin]} rate={0.5} amp={0.18} lag={0.5} curl={-0.5} kick={tap} kickAmp={0.15} />
          </group>
        </group>
      </group>
      <Particles count={30} life={1.2} origin={[0, 1.2, 1.18]} spread={0.03} velocity={[0, 1.2, 0.7]} scatter={0.25} gravity={3.2} drift={0.04} size={[0.025, 0.045]} colors={['#bfe6ff', '#ffffff', '#8fd0f0']} opacity={[0.95, 0.2]} active={spraying} />
    </group>
  )
}

export default function ElephantScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={false} camera={[3, 1.8, 3.8]} target={[0, 0.7, 0]} hint="It shifts its weight, fans its ears, swings its trunk and swishes its tail on its own · tap it and it raises its trunk and sprays a fountain of water · Kind swaps savanna, asian, pink and mammoth · drag to orbit">
      <Elephant {...props} />
    </Stage>
  )
}
