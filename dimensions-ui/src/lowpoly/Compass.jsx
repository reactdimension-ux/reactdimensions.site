import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Flat, Hinge, Ripple, Stage, TAU, facet, useGeo, useTap } from './kit.jsx'

// A low-poly pocket compass lying on its back, tipped up a little so the
// face reads: a round case with a raised rim and a winding crown, a lid
// hinged open at the back with a mirror inside it, a cream face with
// sixteen ticks and four cardinal points (the north one red, with an N),
// and a two-colour needle on a pivot under a glass dome. Left alone, the
// needle seeks: it swings on a damped spring and settles on north, and
// every few seconds it jitters a little and settles again. Tap it and the
// needle spins wildly, then the spring catches it and it swings back past
// north and settles there.

const LOOKS = {
  brass: { case: '#c9a24a', rim: '#a8822f', lid: '#c39a40', face: '#f6f0dc', mark: '#3a2f22', mirror: '#dfe8ef' },
  silver: { case: '#c4c8cf', rim: '#9da2ab', lid: '#bcc0c8', face: '#fbfaf6', mark: '#2a2a30', mirror: '#e6edf2' },
  navy: { case: '#2b3f6b', rim: '#c9a24a', lid: '#2f4676', face: '#f4efe0', mark: '#1f2a44', mirror: '#dfe8ef' },
  forest: { case: '#3d6b4a', rim: '#c9a24a', lid: '#42734f', face: '#f4efe0', mark: '#22382a', mirror: '#dfe8ef' },
}

const R = 0.62 // case radius
const H = 0.14 // case height
const TILT = 0.38 // tipped up toward the viewer
const SPIN = 1.1 // seconds the needle spins free after a tap

export function Compass({ look = 'brass' }) {
  const L = LOOKS[look] || LOOKS.brass
  const { tap, handlers, clock } = useTap(1.5)
  const needle = useRef()
  // the needle's spring: angle, angular speed, and the last jitter beat
  const st = useRef({ a: 2.3, w: 0, beat: 0 })
  const geo = useGeo(
    () => ({
      case: facet(new THREE.CylinderGeometry(R, R * 0.95, H, 16, 1).translate(0, H / 2, 0), 0.006, 2),
      rim: facet(new THREE.TorusGeometry(R - 0.015, 0.035, 4, 16).rotateX(Math.PI / 2), 0.004, 3),
      face: new THREE.CylinderGeometry(R - 0.05, R - 0.05, 0.012, 16),
      glass: new THREE.SphereGeometry(R - 0.04, 16, 3, 0, TAU, 0, 0.6).scale(1, 0.4, 1),
      lid: facet(new THREE.CylinderGeometry(R, R, 0.05, 16), 0.005, 4),
      lidRim: new THREE.TorusGeometry(R - 0.015, 0.03, 4, 16).rotateX(Math.PI / 2),
      mirror: new THREE.CylinderGeometry(R - 0.08, R - 0.08, 0.006, 16),
      knuckle: new THREE.CylinderGeometry(0.035, 0.035, 0.3, 6).rotateZ(Math.PI / 2),
      crown: new THREE.CylinderGeometry(0.05, 0.05, 0.1, 8).rotateZ(Math.PI / 2),
      bow: new THREE.TorusGeometry(0.1, 0.02, 4, 10),
      tickBig: new THREE.BoxGeometry(0.025, 0.01, 0.08),
      tickSmall: new THREE.BoxGeometry(0.015, 0.01, 0.045),
      // a cardinal point: a flat triangle pointing out along -z
      point: new THREE.ConeGeometry(0.06, 0.14, 3).rotateX(-Math.PI / 2).scale(1, 0.12, 1),
      bar: new THREE.BoxGeometry(0.018, 0.01, 0.1),
      // a needle half: a flat four-sided cone, base at the pivot, tip along -z
      half: new THREE.ConeGeometry(0.06, 0.42, 4).translate(0, 0.21, 0).rotateX(-Math.PI / 2).scale(1, 0.3, 1),
      pivot: new THREE.CylinderGeometry(0.035, 0.04, 0.05, 8),
      hub: new THREE.CylinderGeometry(0.05, 0.05, 0.03, 8),
    }),
    [],
  )
  const tapSpin = {
    ...handlers,
    onClick: (e) => {
      handlers.onClick(e)
      st.current.w += (Math.random() < 0.5 ? -1 : 1) * (22 + Math.random() * 8)
    },
  }

  useFrame((_, dt) => {
    const t = clock.elapsedTime
    const d = Math.min(dt, 0.033)
    const S = st.current
    const s = tap.since(t)
    // now and then the needle is nudged off north, and seeks back
    const b = Math.floor(t / 2.7)
    if (b !== S.beat) {
      S.beat = b
      S.w += Math.sin(b * 12.9898) * 2.2
    }
    // spinning free just after a tap; otherwise pulled to the nearest north
    const free = s >= 0 && s < SPIN
    const k = free ? 0 : 16
    const c = free ? 0.7 : 1.9
    const north = Math.round(S.a / TAU) * TAU + 0.03 * Math.sin(t * 2.1) * Math.sin(t * 0.7)
    S.w += (-k * (S.a - north) - c * S.w) * d
    S.a += S.w * d
    needle.current.rotation.y = S.a
  })

  const ticks = Array.from({ length: 16 }, (_, i) => i).filter((i) => i % 4 !== 0)
  return (
    <group {...tapSpin}>
      <group position-y={Math.sin(TILT) * R + 0.01} rotation-x={TILT}>
        {/* the case, its rim, and the crown and bow on the right */}
        <mesh geometry={geo.case}>
          <Flat color={L.case} roughness={0.38} metalness={0.45} />
        </mesh>
        <mesh geometry={geo.rim} position-y={H}>
          <Flat color={L.rim} roughness={0.35} metalness={0.5} />
        </mesh>
        <group position={[R + 0.04, H / 2, 0]}>
          <mesh geometry={geo.crown}>
            <Flat color={L.rim} roughness={0.35} metalness={0.5} />
          </mesh>
          <mesh geometry={geo.bow} position-x={0.13} rotation-x={Math.PI / 2}>
            <Flat color={L.rim} roughness={0.35} metalness={0.5} />
          </mesh>
        </group>
        {/* the face: ticks, cardinal points, the N */}
        <group position-y={H + 0.004}>
          <mesh geometry={geo.face}>
            <Flat color={L.face} roughness={0.75} />
          </mesh>
          {ticks.map((i) => {
            const a = (i / 16) * TAU
            const big = i % 2 === 0
            const r = R - (big ? 0.12 : 0.1)
            return (
              <mesh key={i} geometry={big ? geo.tickBig : geo.tickSmall} position={[Math.sin(a) * r, 0.01, -Math.cos(a) * r]} rotation-y={-a}>
                <Flat color={L.mark} />
              </mesh>
            )
          })}
          {[0, 1, 2, 3].map((i) => {
            const a = (i / 4) * TAU
            const r = R - 0.14
            return (
              <mesh key={i} geometry={geo.point} position={[Math.sin(a) * r, 0.012, -Math.cos(a) * r]} rotation-y={-a} scale={i === 0 ? 1.25 : 1}>
                <Flat color={i === 0 ? '#e2332b' : L.mark} />
              </mesh>
            )
          })}
          {/* an N, from three bars, just inside the north point */}
          <group position={[0, 0.012, -(R - 0.3)]}>
            <mesh geometry={geo.bar} position-x={-0.035}>
              <Flat color="#e2332b" />
            </mesh>
            <mesh geometry={geo.bar} position-x={0.035}>
              <Flat color="#e2332b" />
            </mesh>
            <mesh geometry={geo.bar} rotation-y={0.61} scale-z={1.2}>
              <Flat color="#e2332b" />
            </mesh>
          </group>
          {/* the needle on its pivot: red to the north, white to the south */}
          <mesh geometry={geo.pivot} position-y={0.03}>
            <Flat color={L.rim} roughness={0.35} metalness={0.5} />
          </mesh>
          <group ref={needle} position-y={0.06}>
            <mesh geometry={geo.half}>
              <Flat color="#e2332b" roughness={0.5} />
            </mesh>
            <mesh geometry={geo.half} rotation-y={Math.PI}>
              <Flat color="#9aa0a9" roughness={0.5} />
            </mesh>
            <mesh geometry={geo.hub} position-y={0.01}>
              <Flat color={L.rim} roughness={0.35} metalness={0.5} />
            </mesh>
          </group>
        </group>
        {/* the glass dome */}
        <mesh geometry={geo.glass} position-y={H - 0.02} renderOrder={2}>
          <meshStandardMaterial color="#dff1ff" transparent opacity={0.22} roughness={0.05} metalness={0.1} depthWrite={false} flatShading />
        </mesh>
        {/* the lid, hinged at the back and swung open, a mirror inside */}
        <mesh geometry={geo.knuckle} position={[0, H, -R]}>
          <Flat color={L.rim} roughness={0.35} metalness={0.5} />
        </mesh>
        <Hinge open angle={-1.95} axis="x" stiffness={60} damping={6} position={[0, H, -R]}>
          <group position={[0, 0.03, R]}>
            <mesh geometry={geo.lid}>
              <Flat color={L.lid} roughness={0.38} metalness={0.45} />
            </mesh>
            <mesh geometry={geo.lidRim} position-y={0.025}>
              <Flat color={L.rim} roughness={0.35} metalness={0.5} />
            </mesh>
            <mesh geometry={geo.mirror} position-y={-0.027}>
              <Flat color={L.mirror} emissive={L.mirror} emissiveIntensity={0.25} roughness={0.25} metalness={0.15} />
            </mesh>
          </group>
        </Hinge>
      </group>
      <Ripple tap={tap} color={L.rim} radius={1.5} count={2} />
    </group>
  )
}

export default function CompassScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[2.6, 2.7, 4.4]} target={[0, 0.55, 0]} hint="The needle swings and settles on north by itself, with the odd jitter · tap the compass to send the needle spinning before it swings back to north · Look swaps brass, silver, navy and forest · drag to orbit">
      <Compass {...props} />
    </Stage>
  )
}
