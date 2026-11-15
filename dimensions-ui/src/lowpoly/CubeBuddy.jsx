import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Burst, Flat, Stage, blob, facet, squash, useGeo, useTap } from './kit.jsx'

// A low-poly cube character with stubby arms and feet, big cartoon eyes that
// follow your cursor, rosy cheeks and a smile. It hops on its own using the
// classic principles of animation: it squashes down in anticipation, snaps
// into a stretch as it leaves the ground, stretches again as it falls, and
// lands in a squash that wobbles out. The squash keeps its volume and pivots
// at the feet, so the face never breaks. Tap it for a big jump with a spin.

const COLORS = { coral: '#f27a6a', mint: '#5ac7a6', lemon: '#f6d24a', grape: '#8d55d8' }
const S = 0.5 // cube size

// one hop: anticipation, air, landing; returns height and squash amount
function hop(s, height, air = 0.55) {
  const a = 0.25
  const land = 0.35
  if (s < 0) return { y: 0, k: 0, q: -1 }
  if (s < a) return { y: 0, k: 0.18 * Math.sin((s / a) * Math.PI * 0.5), q: -1 }
  if (s < a + air) {
    const q = (s - a) / air
    const k = q < 0.5 ? -0.14 * (1 - q * 2) : -0.09 * (q - 0.5) * 2
    return { y: 4 * q * (1 - q) * height, k, q }
  }
  if (s < a + air + land) {
    const q = (s - a - air) / land
    return { y: 0, k: 0.2 * Math.exp(-5 * q) * Math.cos(10 * q), q: 2 }
  }
  return null
}

export function CubeBuddy({ color = 'coral', bounce = 0.35 }) {
  const body = COLORS[color] || COLORS.coral
  const { tap, handlers, clock } = useTap(1)
  const jump = useRef()
  const squish = useRef()
  const arms = useRef([])
  const pupils = useRef([])
  const eyes = useRef([])
  const smile = useRef()
  const oh = useRef()

  const geo = useGeo(
    () => ({
      cube: facet(new THREE.BoxGeometry(S, S, S, 2, 2, 2), 0.012, 1),
      foot: facet(new THREE.BoxGeometry(0.13, 0.06, 0.17), 0.004, 2),
      arm: facet(new THREE.BoxGeometry(0.06, 0.16, 0.08).translate(0, -0.06, 0), 0.004, 3),
      eye: new THREE.BoxGeometry(0.1, 0.12, 0.02),
      pupil: new THREE.BoxGeometry(0.045, 0.06, 0.02),
      glint: new THREE.BoxGeometry(0.015, 0.015, 0.01),
      cheek: blob(0.035, 4, 0),
      smile: new THREE.TorusGeometry(0.05, 0.012, 3, 8, Math.PI).rotateZ(Math.PI),
      oh: new THREE.TorusGeometry(0.03, 0.012, 3, 8),
      spark: new THREE.OctahedronGeometry(1, 0),
    }),
    [],
  )

  useFrame(({ pointer }) => {
    const t = clock.elapsedTime
    const s = tap.since(t)
    // a big jump after a tap, the idle hop otherwise
    let H = hop(s, 0.95, 0.75)
    const big = !!H && s < 1.4
    if (!big) H = hop(t % 1.8, bounce) || { y: 0, k: 0.01 * Math.sin(t * 3), q: -1 }
    jump.current.position.y = H.y
    jump.current.rotation.y = big && H.q >= 0 && H.q <= 1 ? H.q * Math.PI * 2 : Math.sin(t * 0.6) * 0.2
    squash(squish.current, H.k)
    // arms fly up in the air and hang down on the ground
    const up = H.q >= 0 && H.q <= 1 ? 1 : 0
    arms.current.forEach((a, i) => a && (a.rotation.z = (i ? -1 : 1) * (0.2 + up * 1.6 + Math.sin(t * 2 + i) * 0.08)))
    // eyes follow the cursor and blink
    pupils.current.forEach((p) => p && p.position.set(pointer.x * 0.022, pointer.y * 0.025, 0.012))
    const blink = t % 3.3 < 0.12 ? 0.15 : 1
    eyes.current.forEach((e) => e && (e.scale.y = blink))
    smile.current.visible = !big
    oh.current.visible = big
  })

  return (
    <group {...handlers}>
      <group ref={jump}>
        {[-1, 1].map((x) => (
          <mesh key={x} geometry={geo.foot} position={[x * 0.12, 0.03, 0.03]}>
            <Flat color="#3a3846" />
          </mesh>
        ))}
        <group ref={squish} position-y={0.05}>
          <mesh geometry={geo.cube} position-y={S / 2}>
            <Flat color={body} />
          </mesh>
          {[-1, 1].map((x, i) => (
            <group key={x} ref={(el) => (arms.current[i] = el)} position={[x * (S / 2 + 0.03), S * 0.45, 0]}>
              <mesh geometry={geo.arm}>
                <Flat color={body} />
              </mesh>
            </group>
          ))}
          {/* face */}
          <group position={[0, S * 0.58, S / 2 + 0.01]}>
            {[-1, 1].map((x, i) => (
              <group key={x} ref={(el) => (eyes.current[i] = el)} position={[x * 0.1, 0, 0]}>
                <mesh geometry={geo.eye}>
                  <Flat color="#ffffff" roughness={0.4} />
                </mesh>
                <group ref={(el) => (pupils.current[i] = el)}>
                  <mesh geometry={geo.pupil}>
                    <Flat color="#1b1a22" roughness={0.3} />
                  </mesh>
                  <mesh geometry={geo.glint} position={[0.01, 0.015, 0.012]}>
                    <meshBasicMaterial color="#ffffff" />
                  </mesh>
                </group>
              </group>
            ))}
            {[-1, 1].map((x) => (
              <mesh key={x} geometry={geo.cheek} position={[x * 0.17, -0.09, 0]} scale={[1.2, 0.7, 0.4]}>
                <Flat color="#ff9aa8" />
              </mesh>
            ))}
            <mesh ref={smile} geometry={geo.smile} position={[0, -0.08, 0]}>
              <Flat color="#1b1a22" />
            </mesh>
            <mesh ref={oh} geometry={geo.oh} position={[0, -0.1, 0]} visible={false}>
              <Flat color="#1b1a22" />
            </mesh>
          </group>
        </group>
      </group>
      <Burst tap={tap} geometry={geo.spark} count={14} colors={['#f6c93a', '#ffffff', body]} speed={1.8} gravity={2.5} size={0.035} life={1.1} origin={[0, 0.2, 0]} up={0.8} spread={1.2} />
    </group>
  )
}

export default function CubeBuddyScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[2.2, 1.5, 3.2]} target={[0, 0.45, 0]} hint="It hops on its own: squash in anticipation, stretch on take-off and fall, a wobbling squash on landing; its eyes follow your cursor · tap it for a big spinning jump · Bounce sets the hop height · Color swaps coral, mint, lemon and grape · drag to orbit">
      <CubeBuddy {...props} />
    </Stage>
  )
}
