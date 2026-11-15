import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Face, Flat, Stage, TAU, blob, cone, facet, useGeo, useTap, walk } from './kit.jsx'

// A low-poly tortoise on a patch of grass: a domed shell tiled with raised
// hexagonal scutes and a darker rim, a head on a long neck, four stubby legs
// and a pointed tail. It plods on the spot in a proper four-legged walk,
// each foot lifting and swinging in the order left hind, left fore, right
// hind, right fore, with its shell rocking and its head bobbing with the
// stride. Tap it and it pulls its head and legs into its shell; after a
// moment it peeks out, then gets going again.

const KINDS = {
  green: { shell: '#5f8a42', scute: '#7aa852', rim: '#4a6f34', skin: '#9ab86a', belly: '#d9c98a' },
  desert: { shell: '#a8844a', scute: '#c9a46a', rim: '#8a6a3a', skin: '#c9a87a', belly: '#e8d6b0' },
  sea: { shell: '#3f8a8a', scute: '#5aa8a0', rim: '#2f6f72', skin: '#8fc0b0', belly: '#e8e2c8' },
  star: { shell: '#2c2a26', scute: '#f2c23a', rim: '#3a3632', skin: '#b8a46a', belly: '#e8d6a0' },
}
const A = 0.34 // shell half-width
const B = 0.2 // shell height
const C = 0.4 // shell half-length
const LEGS = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
] // [side, front] in walk() order: left hind, left fore, right hind, right fore
const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x))

export function Turtle({ kind = 'green', pace = 1 }) {
  const K = KINDS[kind] || KINDS.green
  const { tap, handlers, clock } = useTap(1)
  const shell = useRef()
  const neck = useRef()
  const legs = useRef([])
  const tail = useRef()
  const st = useRef({ p: 0 })

  const geo = useGeo(
    () => ({
      grass: facet(new THREE.CylinderGeometry(0.85, 0.9, 0.05, 12, 1).translate(0, 0.025, 0), 0.02, 1, [1, 0.3, 1]),
      dome: facet(new THREE.SphereGeometry(1, 12, 5, 0, TAU, 0, Math.PI / 2), 0.03, 2).scale(A, B, C),
      rim: new THREE.CylinderGeometry(A * 1.04, A * 1.02, 0.05, 14, 1).scale(1, 1, C / A),
      plastron: new THREE.CylinderGeometry(A * 0.9, A * 0.9, 0.03, 12, 1).scale(1, 1, C / A),
      scute: new THREE.CylinderGeometry(0.075, 0.085, 0.025, 6, 1),
      neck: facet(new THREE.CylinderGeometry(0.05, 0.06, 0.18, 6, 1).rotateX(Math.PI / 2).translate(0, 0, 0.09), 0.004, 3),
      head: blob(0.085, 4),
      leg: facet(new THREE.CylinderGeometry(0.05, 0.065, 0.12, 6, 1).translate(0, -0.06, 0), 0.004, 5),
      foot: blob(0.055, 6, 0),
      tail: cone(0.03, 0.1, 4, 7).rotateX(-Math.PI / 2),
      rock: blob(0.08, 8),
    }),
    [],
  )
  // scutes sit on the dome, square to its surface
  const scutes = useMemo(() => {
    const out = []
    const place = (th, ph) => {
      const p = new THREE.Vector3(Math.sin(th) * Math.cos(ph) * A, Math.cos(th) * B, Math.sin(th) * Math.sin(ph) * C)
      const n = new THREE.Vector3(p.x / (A * A), p.y / (B * B), p.z / (C * C)).normalize()
      out.push({ p: p.toArray(), q: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n) })
    }
    place(0, 0)
    for (let k = 0; k < 6; k++) place(0.75, (k / 6) * TAU + Math.PI / 6)
    for (let k = 0; k < 10; k++) place(1.25, (k / 10) * TAU)
    return out
  }, [])

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05)
    const t = clock.elapsedTime
    const s = tap.since(t)
    // how far it is tucked in: in fast, a pause, head peeks out, then legs
    const inAmt = s >= 0 && s < 3.4 ? ease(s / 0.3) : 0
    const headOut = s >= 0 && s < 3.4 ? 1 - inAmt + ease((s - 2.1) / 0.6) : 1
    const legOut = s >= 0 && s < 3.4 ? 1 - inAmt + ease((s - 2.8) / 0.5) : 1
    const walking = Math.min(headOut, legOut)
    st.current.p += dt * 3 * pace * walking
    const W = walk(st.current.p, 4)
    shell.current.rotation.z = Math.sin(st.current.p) * 0.04 * walking
    shell.current.position.y = 0.15 + Math.abs(Math.sin(st.current.p * 2)) * 0.01 * walking - (1 - legOut) * 0.07
    // head on its neck: out and bobbing, or pulled in
    const h = Math.min(1, headOut)
    neck.current.position.z = C - 0.12 + h * 0.1
    neck.current.scale.setScalar(0.25 + 0.75 * h)
    neck.current.rotation.x = -0.15 + Math.sin(st.current.p * 2) * 0.05 * walking
    neck.current.rotation.y = Math.sin(t * 0.4) * 0.3 * h
    legs.current.forEach((l, i) => {
      if (!l) return
      const o = Math.min(1, legOut)
      l.scale.setScalar(0.2 + 0.8 * o)
      l.rotation.y = W[i].swing * 0.45 * walking * LEGS[i][0]
      l.position.y = -0.02 + W[i].lift * 0.035 * walking
    })
    tail.current.rotation.y = Math.sin(t * 2) * 0.3
  })

  return (
    <group {...handlers}>
      <mesh geometry={geo.grass}>
        <Flat color="#7fbf52" />
      </mesh>
      {[
        [0.6, 0.35],
        [-0.55, -0.4],
      ].map(([x, z], i) => (
        <mesh key={i} geometry={geo.rock} position={[x, 0.07, z]} scale={[1.2, 0.7, 1]}>
          <Flat color="#a6a29b" />
        </mesh>
      ))}

      <group ref={shell} position-y={0.15}>
        {/* legs under the rim */}
        {LEGS.map(([side, front], i) => (
          <group key={i} ref={(el) => (legs.current[i] = el)} position={[side * A * 0.72, -0.02, front * C * 0.62]}>
            <mesh geometry={geo.leg}>
              <Flat color={K.skin} />
            </mesh>
            <mesh geometry={geo.foot} position-y={-0.12} scale={[1.1, 0.5, 1.3]}>
              <Flat color={K.skin} />
            </mesh>
          </group>
        ))}
        <mesh ref={tail} geometry={geo.tail} position={[0, 0.0, -C * 0.95]}>
          <Flat color={K.skin} />
        </mesh>
        <mesh geometry={geo.plastron} position-y={-0.01}>
          <Flat color={K.belly} />
        </mesh>
        <mesh geometry={geo.rim} position-y={0.02}>
          <Flat color={K.rim} />
        </mesh>
        <mesh geometry={geo.dome} position-y={0.03}>
          <Flat color={K.shell} />
        </mesh>
        {scutes.map((sc, i) => (
          <mesh key={i} geometry={geo.scute} position={[sc.p[0], sc.p[1] + 0.03, sc.p[2]]} quaternion={sc.q}>
            <Flat color={i === 0 || i < 7 ? K.scute : K.rim} />
          </mesh>
        ))}

        {/* neck and head */}
        <group ref={neck} position={[0, 0.03, C - 0.02]}>
          <mesh geometry={geo.neck}>
            <Flat color={K.skin} />
          </mesh>
          <group position={[0, 0.03, 0.2]}>
            <mesh geometry={geo.head} scale={[0.9, 0.85, 1.15]}>
              <Flat color={K.skin} />
            </mesh>
            <Face position={[0, 0.03, 0.07]} spacing={0.1} size={0.014} mouth="smile" mouthWidth={0.04} mouthY={-0.045} />
          </group>
        </group>
      </group>
    </group>
  )
}

export default function TurtleScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[2.2, 1.4, 2.8]} target={[0, 0.2, 0]} hint="It plods on the spot in a real four-legged walk, feet lifting in turn, shell rocking and head bobbing · tap it and it pulls into its shell, peeks out and carries on · Pace sets the walking speed · Kind swaps green, desert, sea and star · drag to orbit">
      <Turtle {...props} />
    </Stage>
  )
}
