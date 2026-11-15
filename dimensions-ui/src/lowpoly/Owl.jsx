import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Burst, Flat, Stage, Wing, blinkAt, blob, cone, facet, lookAround, useGeo, useTap } from './kit.jsx'

// A low-poly owl perched on a mossy branch: a plump body with a chevroned
// breast, folded wings, talons gripping the bark, a round head with ear
// tufts, a pale facial disc and huge eyes with slow, heavy blinks. Its head
// swivels on its own, glancing about and now and then turning right round
// over its shoulder, as owls can. Tap it and it puffs up, spreads its wings
// and hoots.

const KINDS = {
  barn: { body: '#d9a86a', breast: '#fbf3e4', disc: '#ffffff', eye: '#1b1a22', iris: '#1b1a22', tufts: false, mark: '#b8844a' },
  snowy: { body: '#f4f6fa', breast: '#ffffff', disc: '#ffffff', eye: '#f6c93a', iris: '#1b1a22', tufts: false, mark: '#3a3846' },
  horned: { body: '#8a6a4a', breast: '#d9c39a', disc: '#c99a6a', eye: '#f6a63a', iris: '#1b1a22', tufts: true, mark: '#4a3424' },
  spectacled: { body: '#4a3a30', breast: '#f2e2b8', disc: '#3a2c26', eye: '#f6c93a', iris: '#1b1a22', tufts: false, mark: '#ffffff' },
}

export function Owl({ kind = 'horned' }) {
  const K = KINDS[kind] || KINDS.horned
  const { tap, handlers, clock } = useTap(1.2)
  const body = useRef()
  const head = useRef()
  const lids = useRef([])
  const st = useRef({ yaw: 0 })

  const geo = useGeo(
    () => ({
      branch: facet(new THREE.CylinderGeometry(0.07, 0.09, 1.6, 7, 3).rotateZ(Math.PI / 2), 0.012, 1),
      twig: new THREE.CylinderGeometry(0.02, 0.035, 0.35, 5, 1).translate(0, 0.175, 0),
      leaf: facet(new THREE.IcosahedronGeometry(0.06, 0), 0.004, 2).scale(0.7, 0.2, 1.4),
      moss: blob(0.06, 3, 0),
      body: blob(0.28, 4),
      breast: blob(0.21, 5),
      chev: cone(0.025, 0.04, 3, 6).rotateX(Math.PI),
      head: blob(0.22, 7),
      disc: new THREE.CylinderGeometry(0.1, 0.11, 0.03, 9, 1).rotateX(Math.PI / 2),
      eye: new THREE.IcosahedronGeometry(0.06, 1),
      pupil: new THREE.IcosahedronGeometry(0.032, 0),
      lid: new THREE.SphereGeometry(0.064, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2),
      beak: cone(0.025, 0.07, 4, 8).rotateX(Math.PI * 0.8),
      tuft: cone(0.04, 0.14, 4, 9),
      talon: cone(0.012, 0.06, 3, 10).rotateX(Math.PI / 2),
      puff: new THREE.IcosahedronGeometry(1, 0),
    }),
    [],
  )

  useFrame((_, dt) => {
    const t = clock.elapsedTime
    const s = tap.since(t)
    const hoot = s >= 0 && s < 1.6
    // puff up on the hoot
    const puff = hoot ? Math.sin(Math.min(1, s / 0.3) * Math.PI * 0.5) * Math.exp(-Math.max(0, s - 0.6) * 3) : 0
    body.current.scale.setScalar(1 + puff * 0.14 + Math.sin(t * 1.6) * 0.012)
    // the head: glances, and every so often a long turn right over the shoulder
    const L = lookAround(t, 1)
    const turn = t % 11 < 2.2 ? Math.sin(((t % 11) / 2.2) * Math.PI) * 2.2 : 0
    const target = hoot ? 0 : L.yaw + turn
    st.current.yaw += (target - st.current.yaw) * (1 - Math.exp(-6 * Math.min(dt, 0.05)))
    head.current.rotation.y = st.current.yaw
    head.current.rotation.x = hoot ? -0.25 * puff + Math.sin(s * 9) * 0.05 * puff : L.pitch
    head.current.rotation.z = hoot ? 0 : Math.sin(t * 0.7) * 0.12
    // heavy blinks: the upper lids come down
    const b = blinkAt(t, 4.2) < 1 ? 1 : 0
    // the lid is a cap over the top of the eye: tipped forward over it to blink, half-down when resting
    lids.current.forEach((l) => l && (l.rotation.x = b ? 1.45 : hoot ? -0.5 : 0.25))
  })

  const spread = () => {
    const s = tap.since(clock.elapsedTime)
    return s >= 0 && s < 1.6 ? Math.sin(Math.min(1, s / 0.3) * Math.PI * 0.5) * Math.exp(-Math.max(0, s - 0.7) * 3) * 1.1 + Math.sin(s * 14) * 0.08 : 0
  }
  const fold = () => 1 - spread() / 1.1

  return (
    <group {...handlers}>
      {/* the branch */}
      <mesh geometry={geo.branch} position-y={0.55}>
        <Flat color="#6e4a34" />
      </mesh>
      {/* the trunk the branch grows from, and a round of ground */}
      <mesh position={[-0.82, 0.3, 0]}>
        <cylinderGeometry args={[0.1, 0.14, 0.62, 7, 1]} />
        <Flat color="#5c3c2a" />
      </mesh>
      <mesh position-y={0.02}>
        <cylinderGeometry args={[1.05, 1.1, 0.04, 12, 1]} />
        <Flat color="#7fae52" />
      </mesh>
      <mesh geometry={geo.twig} position={[0.55, 0.58, 0]} rotation-z={-0.7}>
        <Flat color="#5c3c2a" />
      </mesh>
      {[
        [0.75, 0.82, 0.05, 0.3],
        [0.68, 0.78, -0.08, -0.6],
        [-0.65, 0.6, 0.08, 1.2],
      ].map(([x, y, z, r], i) => (
        <mesh key={i} geometry={geo.leaf} position={[x, y, z]} rotation-y={r}>
          <Flat color={i % 2 ? '#4f8a42' : '#5f9a4a'} />
        </mesh>
      ))}
      {[-0.4, -0.25, 0.3].map((x) => (
        <mesh key={x} geometry={geo.moss} position={[x, 0.62, 0.02]} scale={[1.4, 0.5, 1]}>
          <Flat color="#7fae52" />
        </mesh>
      ))}

      <group ref={body} position-y={0.6}>
        {/* talons */}
        {[-1, 1].map((x) =>
          [-1, 0, 1].map((k) => (
            <mesh key={`${x}${k}`} geometry={geo.talon} position={[x * 0.08 + k * 0.025, 0.02, 0.08]} rotation-x={0.6}>
              <Flat color="#3a3846" />
            </mesh>
          )),
        )}
        <mesh geometry={geo.body} position-y={0.27} scale={[0.95, 1.2, 0.85]}>
          <Flat color={K.body} />
        </mesh>
        <mesh geometry={geo.breast} position={[0, 0.25, 0.1]} scale={[0.85, 1.15, 0.7]}>
          <Flat color={K.breast} />
        </mesh>
        {[0.15, 0.25, 0.35].map((y, r) =>
          [-1, 0, 1].map((k) => (
            <mesh key={`${r}${k}`} geometry={geo.chev} position={[k * 0.07 + (r % 2) * 0.035, y, 0.24 - Math.abs(k) * 0.02]}>
              <Flat color={K.mark} />
            </mesh>
          )),
        )}
        {[-1, 1].map((x) => (
          <Wing key={x} side={x} span={0.42} chord={0.22} color={K.body} tipColor={K.mark} position={[x * 0.2, 0.42, -0.02]} angle={() => -1.25 + spread()} fold={fold} />
        ))}

        <group ref={head} position-y={0.6}>
          <mesh geometry={geo.head} position-y={0.06} scale={[1.1, 0.95, 0.95]}>
            <Flat color={K.body} />
          </mesh>
          {[-1, 1].map((x, i) => (
            <group key={x} position={[x * 0.09, 0.07, 0.17]}>
              <mesh geometry={geo.disc}>
                <Flat color={K.disc} />
              </mesh>
              <mesh geometry={geo.eye} position-z={0.02}>
                <Flat color={K.eye} roughness={0.3} />
              </mesh>
              <mesh geometry={geo.pupil} position-z={0.06}>
                <Flat color={K.iris} roughness={0.25} />
              </mesh>
              <mesh ref={(el) => (lids.current[i] = el)} geometry={geo.lid} position-z={0.02} rotation-x={0.25}>
                <Flat color={K.body} />
              </mesh>
            </group>
          ))}
          <mesh geometry={geo.beak} position={[0, 0.02, 0.2]}>
            <Flat color="#e8b84a" />
          </mesh>
          {K.tufts &&
            [-1, 1].map((x) => (
              <mesh key={x} geometry={geo.tuft} position={[x * 0.14, 0.2, 0]} rotation-z={-x * 0.4}>
                <Flat color={K.mark} />
              </mesh>
            ))}
        </group>
      </group>
      <Burst tap={tap} geometry={geo.puff} count={8} colors={['#ffffff', '#eef2f8']} speed={0.9} gravity={-0.6} size={0.05} life={1.5} origin={[0, 1.3, 0.25]} spread={0.6} up={0.5} />
    </group>
  )
}

export default function OwlScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[2, 1.6, 3.2]} target={[0, 0.85, 0]} hint="It blinks slowly and swivels its head about, now and then turning right round over its shoulder · tap it and it puffs up, spreads its wings and hoots · Kind swaps barn, snowy, horned and spectacled · drag to orbit">
      <Owl {...props} />
    </Stage>
  )
}
