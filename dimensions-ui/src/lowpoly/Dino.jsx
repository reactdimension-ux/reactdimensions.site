import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Burst, Face, Flat, Hinge, Stage, Tail, TAU, blob, cone, facet, lookAround, rng, useGeo, useTap } from './kit.jsx'

// A low-poly tyrannosaur among ferns: a deep chest leaning forward over two
// powerful legs, tiny arms, a row of back plates, a big head with a hinged
// jaw full of teeth, and a long tail that is a lag chain balancing it. It
// breathes, shifts its weight, looks about and its tail sways. Tap it and
// it roars: it dips its head, throws it back with its jaw wide, shakes it,
// and a blast of breath bursts out.

const KINDS = {
  green: { skin: '#5f9a4a', belly: '#d9e2a0', plate: '#e8743a', mouth: '#a83a3a' },
  purple: { skin: '#8350c8', belly: '#e2d0f6', plate: '#f6c93a', mouth: '#7a2a4a' },
  orange: { skin: '#e8743a', belly: '#f6dca0', plate: '#3a8a4a', mouth: '#8a2a2a' },
  blue: { skin: '#3d7fe0', belly: '#cfe6ff', plate: '#f27aa6', mouth: '#7a2a4a' },
}
const ROAR = 1.8

export function Dino({ kind = 'green' }) {
  const K = KINDS[kind] || KINDS.green
  const { tap, handlers, clock } = useTap(1)
  const body = useRef()
  const neck = useRef()
  const arms = useRef([])

  const geo = useGeo(
    () => ({
      ground: facet(new THREE.CylinderGeometry(1.4, 1.45, 0.05, 14, 1).translate(0, 0.025, 0), 0.02, 1, [1, 0.3, 1]),
      fern: facet(new THREE.IcosahedronGeometry(0.08, 0), 0.005, 2).scale(0.5, 0.15, 2).translate(0, 0, 0.15),
      rock: blob(0.1, 3),
      body: blob(0.3, 4),
      belly: blob(0.24, 5),
      thigh: facet(new THREE.IcosahedronGeometry(0.12, 1), 0.006, 6).scale(0.8, 1.2, 1),
      shin: facet(new THREE.CylinderGeometry(0.045, 0.06, 0.28, 6, 1).translate(0, -0.14, 0), 0.004, 7),
      foot: facet(new THREE.BoxGeometry(0.12, 0.05, 0.18), 0.004, 8),
      toe: cone(0.018, 0.05, 3, 9).rotateX(Math.PI / 2),
      arm: facet(new THREE.CylinderGeometry(0.018, 0.022, 0.12, 5, 1).translate(0, -0.06, 0), 0.003, 10),
      skull: blob(0.15, 11),
      snout: facet(new THREE.BoxGeometry(0.18, 0.11, 0.2), 0.008, 12),
      jaw: facet(new THREE.BoxGeometry(0.16, 0.05, 0.28).translate(0, -0.025, 0.14), 0.006, 13),
      tooth: cone(0.012, 0.035, 3, 14).rotateX(Math.PI),
      plate: cone(0.05, 0.11, 4, 15).scale(0.35, 1, 1),
      breath: new THREE.IcosahedronGeometry(1, 0),
    }),
    [],
  )
  const ferns = useMemo(() => {
    const r = rng(9)
    return Array.from({ length: 6 }, () => {
      const a = r() * TAU
      const d = 0.95 + r() * 0.35
      return [Math.cos(a) * d, Math.sin(a) * d]
    })
  }, [])
  const jawOpen = () => {
    const s = tap.since(clock.elapsedTime)
    return s >= 0.3 && s < ROAR ? 1 : Math.sin(clock.elapsedTime * 0.4) > 0.97 ? 0.3 : 0
  }

  useFrame(() => {
    const t = clock.elapsedTime
    const s = tap.since(t)
    const roaring = s >= 0 && s < ROAR
    // breathing and weight shift
    body.current.scale.set(1, 1 + Math.sin(t * 1.8) * 0.015, 1)
    body.current.rotation.z = Math.sin(t * 0.6) * 0.03
    // the head: look about, or dip, throw back and shake for the roar
    const L = lookAround(t, 0.5)
    let pitch = L.pitch
    let yaw = L.yaw * 0.6
    if (roaring) {
      const dip = s < 0.3 ? Math.sin((s / 0.3) * Math.PI * 0.5) * 0.25 : 0
      const back = s >= 0.3 ? Math.sin(Math.min(1, (s - 0.3) / 0.25) * Math.PI * 0.5) * (1 - Math.max(0, (s - 1.3) / 0.5)) : 0
      pitch = dip - back * 0.55
      yaw = back * Math.sin(s * 22) * 0.12
    }
    neck.current.rotation.x = pitch
    neck.current.rotation.y = yaw
    arms.current.forEach((a, i) => a && (a.rotation.x = -0.6 + Math.sin(t * 1.5 + i) * 0.15 - (roaring ? 0.5 : 0)))
  })

  return (
    <group {...handlers}>
      <mesh geometry={geo.ground}>
        <Flat color="#7fae52" />
      </mesh>
      {ferns.map(([x, z], i) => (
        <group key={i} position={[x, 0.05, z]} rotation-y={i}>
          {[0, 1, 2, 3, 4].map((k) => (
            <mesh key={k} geometry={geo.fern} rotation={[-0.6, (k / 5) * TAU, 0]}>
              <Flat color={k % 2 ? '#3f8a3a' : '#4f9a42'} />
            </mesh>
          ))}
        </group>
      ))}
      <mesh geometry={geo.rock} position={[0.75, 0.08, 0.55]} scale={[1.3, 0.8, 1]}>
        <Flat color="#a6a29b" />
      </mesh>

      {/* legs */}
      {[-1, 1].map((x) => (
        <group key={x} position={[x * 0.17, 0.62, -0.05]}>
          <mesh geometry={geo.thigh} position-y={-0.05}>
            <Flat color={K.skin} />
          </mesh>
          <group position={[0, -0.14, -0.02]} rotation-x={0.35}>
            <mesh geometry={geo.shin}>
              <Flat color={K.skin} />
            </mesh>
          </group>
          <mesh geometry={geo.foot} position={[0, -0.43, 0.06]}>
            <Flat color={K.skin} />
          </mesh>
          {[-1, 0, 1].map((k) => (
            <mesh key={k} geometry={geo.toe} position={[k * 0.04, -0.43, 0.16]}>
              <Flat color="#f2ead8" />
            </mesh>
          ))}
        </group>
      ))}

      <group ref={body} position-y={0.78} rotation-x={0.25}>
        <mesh geometry={geo.body} scale={[0.85, 0.95, 1.35]}>
          <Flat color={K.skin} />
        </mesh>
        <mesh geometry={geo.belly} position={[0, -0.08, 0.12]} scale={[0.8, 0.8, 1]}>
          <Flat color={K.belly} />
        </mesh>
        {[0.15, 0.02, -0.12, -0.26].map((z, i) => (
          <mesh key={z} geometry={geo.plate} position={[0, 0.27 - Math.abs(z) * 0.2, z]} scale={1 - i * 0.12}>
            <Flat color={K.plate} />
          </mesh>
        ))}
        {[-1, 1].map((x, i) => (
          <group key={x} ref={(el) => (arms.current[i] = el)} position={[x * 0.18, -0.05, 0.3]}>
            <mesh geometry={geo.arm}>
              <Flat color={K.skin} />
            </mesh>
          </group>
        ))}
        <Tail position={[0, 0.0, -0.35]} rotation-x={-0.45} segs={6} length={1.0} r0={0.18} r1={0.03} sides={7} colors={[K.skin]} rate={0.45} amp={0.18} lag={0.5} droop={0.05} kick={tap} kickAmp={0.12} />

        {/* neck and head */}
        <group ref={neck} position={[0, 0.18, 0.38]} rotation-x={-0.25}>
          <group position={[0, 0.06, 0.08]}>
            <mesh geometry={geo.skull} scale={[1, 0.9, 1.1]}>
              <Flat color={K.skin} />
            </mesh>
            <mesh geometry={geo.snout} position={[0, -0.01, 0.16]}>
              <Flat color={K.skin} />
            </mesh>
            {[-1, 1].map((x) =>
              [0.08, 0.14, 0.2].map((z) => (
                <mesh key={`${x}${z}`} geometry={geo.tooth} position={[x * 0.075, -0.07, z]}>
                  <Flat color="#ffffff" />
                </mesh>
              )),
            )}
            <Face position={[0, 0.08, 0.1]} spacing={0.19} size={0.02} mouth="none" />
            {/* the jaw on its hinge */}
            <Hinge open={jawOpen} angle={0.75} axis="x" stiffness={160} damping={12} position={[0, -0.06, 0.03]}>
              <mesh geometry={geo.jaw}>
                <Flat color={K.belly} />
              </mesh>
              <mesh position={[0, 0.002, 0.14]}>
                <boxGeometry args={[0.13, 0.01, 0.24]} />
                <Flat color={K.mouth} />
              </mesh>
            </Hinge>
          </group>
        </group>
      </group>
      <Burst tap={tap} geometry={geo.breath} count={14} colors={['#ffffff', '#eef2f8']} speed={1.6} gravity={-0.3} size={0.04} life={1.2} origin={[0, 1.15, 0.75]} spread={0.5} up={0.6} />
    </group>
  )
}

export default function DinoScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={false} camera={[2.8, 1.7, 3.4]} target={[0, 0.7, 0]} hint="It breathes, shifts its weight, looks about and sways its long tail on its own · tap it and it roars: head dips, throws back with the jaw wide and shakes · Kind swaps green, purple, orange and blue · drag to orbit">
      <Dino {...props} />
    </Stage>
  )
}
