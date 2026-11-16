import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Burst, Flat, Ripple, Stage, Sway, Water, blinkAt, blob, facet, lookAround, swayAngle, useGeo, useTap } from './kit.jsx'

// A low-poly flamingo standing on one leg in a shallow round pool with a few
// reeds: a plump pink body, a long S-curved neck made of a chain of links, a
// small head with a thick bent beak, folded wings edged with black flight
// feathers, and two long thin legs that bend backward at the ankle, one of
// them tucked up under the body. It balances on the standing leg, swaying
// gently with small corrective wobbles, its neck bobbing and its head looking
// about, and it blinks. Tap it and it swaps legs: the tucked leg comes down,
// the other folds up, and while it shifts its weight it spreads and flaps its
// wings, showing the black flight feathers, with a ripple and a few drops.

const LOOKS = {
  pink: { body: '#f7a3b9', dark: '#ea6f90', leg: '#ee8aa2', beak: '#f8dbe0', eye: '#f6d04a', water: '#7cc6e8', edge: '#4f9dc4', glow: 0 },
  coral: { body: '#ff8f72', dark: '#f0604a', leg: '#ff917a', beak: '#ffdcc8', eye: '#f6d04a', water: '#6fc3d9', edge: '#3f97b0', glow: 0 },
  white: { body: '#f7f2f2', dark: '#f1c4cd', leg: '#f0a2b2', beak: '#f8e6e8', eye: '#f6d04a', water: '#86cbe8', edge: '#5aa2c6', glow: 0 },
  neon: { body: '#ff4fb8', dark: '#c21f8e', leg: '#ff69c9', beak: '#ffe0f4', eye: '#d9ff3a', water: '#3fd6e8', edge: '#1f98b8', glow: 0.35 },
}

const FEATHER = '#1d1a24' // the black flight feathers
const HIP_Y = 0.95
const UPPER = 0.42 // hip to ankle (the backward "knee")
const LOWER = 0.46 // ankle to foot
const LEG_Z = 0.075
const NECK = [-0.5, 0.25, 0.3, 0.3, 0.15, -0.2, -0.45, -0.5] // the S: each link's bend on the last
const LINK = 0.1
const clamp01 = (x) => Math.min(1, Math.max(0, x))

// A wing in its own frame: span along +X from the shoulder, leading edge
// along Y = 0, the feathers trailing to -Y. Coverts sit over the black
// flight feathers, so the black shows at the tip and trailing edge.
function wingShapes() {
  const flight = new THREE.Shape()
  flight.moveTo(0, 0.01)
  flight.lineTo(0.3, 0.02)
  flight.lineTo(0.6, -0.02)
  flight.lineTo(0.66, -0.07)
  flight.lineTo(0.52, -0.16)
  flight.lineTo(0.3, -0.22)
  flight.lineTo(0.08, -0.2)
  flight.lineTo(0, -0.14)
  flight.closePath()
  const covert = new THREE.Shape()
  covert.moveTo(-0.01, 0.02)
  covert.lineTo(0.3, 0.03)
  covert.lineTo(0.42, -0.02)
  covert.lineTo(0.36, -0.1)
  covert.lineTo(0.18, -0.15)
  covert.lineTo(0, -0.12)
  covert.closePath()
  const ex = (s, seed) => facet(new THREE.ExtrudeGeometry(s, { depth: 0.016, bevelEnabled: false }).translate(0, 0, -0.008), 0.004, seed)
  return { flight: ex(flight, 31), covert: ex(covert, 32) }
}

export function Flamingo({ look = 'pink' }) {
  const L = LOOKS[look] || LOOKS.pink
  const { tap, handlers, clock } = useTap(1.2)
  const bird = useRef()
  const body = useRef()
  const links = useRef([])
  const headFix = useRef()
  const headYaw = useRef()
  const headPitch = useRef()
  const eyes = useRef([])
  const hips = useRef([])
  const ankles = useRef([])
  const feet = useRef([])
  const wings = useRef([])
  const st = useRef({ t0: -99, down: 0, u: [0, 1] })

  const geo = useGeo(() => {
    const w = wingShapes()
    return {
      rim: facet(new THREE.CylinderGeometry(1.12, 1.18, 0.035, 14, 1).translate(0, 0.0175, 0), 0.03, 1, [1, 0.2, 1]),
      body: facet(new THREE.IcosahedronGeometry(0.32, 1).scale(1.3, 0.78, 0.82), 0.02, 2),
      tail: facet(new THREE.ConeGeometry(0.11, 0.24, 5, 1).rotateZ(Math.PI / 2).translate(-0.1, 0, 0), 0.01, 3),
      links: NECK.map((_, i) => {
        const a = 0.052 - i * 0.0028
        const b = 0.052 - (i + 1) * 0.0028
        return facet(new THREE.CylinderGeometry(b, a, LINK * 1.12, 6, 1).translate(0, LINK / 2, 0), 0.003, 10 + i)
      }),
      joint: new THREE.IcosahedronGeometry(1, 0),
      head: facet(new THREE.IcosahedronGeometry(0.085, 1).scale(1.3, 1, 0.9), 0.006, 4),
      beak: facet(new THREE.CylinderGeometry(0.028, 0.042, 0.12, 6, 1).rotateZ(-Math.PI / 2).translate(0.06, 0, 0).scale(1, 1, 0.8), 0.003, 5),
      tip: facet(new THREE.ConeGeometry(0.03, 0.1, 6, 1).rotateZ(-Math.PI / 2).translate(0.05, 0, 0).scale(1, 1, 0.8), 0.003, 6),
      eye: new THREE.IcosahedronGeometry(0.018, 0),
      pupil: new THREE.IcosahedronGeometry(0.009, 0),
      upper: facet(new THREE.CylinderGeometry(0.02, 0.026, UPPER, 5, 1).translate(0, -UPPER / 2, 0), 0.002, 7),
      lower: facet(new THREE.CylinderGeometry(0.016, 0.02, LOWER, 5, 1).translate(0, -LOWER / 2, 0), 0.002, 8),
      foot: facet(new THREE.ConeGeometry(0.065, 0.13, 3, 1).rotateZ(-Math.PI / 2).scale(1, 0.2, 1).translate(0.055, 0, 0), 0.002, 9),
      flight: w.flight,
      covert: w.covert,
      reed: facet(new THREE.ConeGeometry(0.018, 1, 4, 3).translate(0, 0.5, 0), 0.004, 12),
      blade: facet(new THREE.ConeGeometry(0.03, 1, 3, 1).scale(1, 1, 0.25).translate(0, 0.5, 0), 0.003, 13),
      cattail: facet(new THREE.CylinderGeometry(0.03, 0.03, 0.14, 6, 1), 0.004, 14),
      stone: blob(0.07, 15, 0),
      drop: new THREE.IcosahedronGeometry(1, 0),
      hit: new THREE.CylinderGeometry(0.5, 0.5, 2.1, 8).translate(0, 1.05, 0),
    }
  }, [])

  const reeds = useMemo(
    () => [
      { p: [-0.62, -0.62], h: 1.25, cat: true, r: 0 },
      { p: [-0.48, -0.74], h: 0.95, cat: false, r: 0.6 },
      { p: [-0.75, -0.45], h: 1.05, cat: true, r: 1.2 },
      { p: [0.7, -0.55], h: 0.8, cat: false, r: 2 },
      { p: [0.8, -0.38], h: 1.0, cat: true, r: 2.6 },
    ],
    [],
  )

  useFrame((_, dt) => {
    const t = clock.elapsedTime
    const d = Math.min(dt, 0.05)
    const S = st.current
    const s = tap.since(t)
    // a new tap swaps which leg is down
    const t0 = t - s
    if (Math.abs(t0 - S.t0) > 1e-3) {
      S.t0 = t0
      if (t0 > -50) S.down = 1 - S.down
    }
    const swapping = s >= 0 && s < 1.6
    for (let i = 0; i < 2; i++) {
      const target = i === S.down ? 0 : swapping && s < 0.55 ? 0 : 1
      S.u[i] += (target - S.u[i]) * (1 - Math.exp(-7 * d))
    }
    // legs: the hip swings the thigh forward, the ankle folds the shank back up
    for (let i = 0; i < 2; i++) {
      const u = S.u[i]
      const lift = Math.sin(Math.PI * u) * 0.25 // knee comes up mid-swing
      if (hips.current[i]) hips.current[i].rotation.z = 1.05 * u + lift
      if (ankles.current[i]) ankles.current[i].rotation.z = -2.65 * u - lift * 1.2
      if (feet.current[i]) feet.current[i].rotation.z = -1.3 * u
    }
    // balance: lean over the standing leg, a slow sway and small corrections
    const w0 = 1 - S.u[0]
    const w1 = 1 - S.u[1]
    const zc = (LEG_Z * w0 - LEG_Z * w1) / Math.max(0.05, w0 + w1)
    const env = swapping ? Math.pow(Math.sin(Math.PI * clamp01((s - 0.08) / 1.4)), 0.7) : 0
    bird.current.rotation.x = zc * 0.9 + 0.022 * Math.sin(t * 0.7) + 0.009 * Math.sin(t * 3.3) * Math.max(0, Math.sin(t * 0.45))
    bird.current.rotation.z = 0.018 * Math.sin(t * 0.5 + 1) + 0.006 * Math.sin(t * 4.1) + env * 0.05
    body.current.position.y = Math.sin(t * 1.4) * 0.006 + env * 0.03
    // the neck: an S that bobs as a lag chain, straightening on the swap
    const bob = 0.05 * Math.sin(t * 0.8) + 0.03 * Math.sin(t * 1.9)
    let sum = 0
    NECK.forEach((b, i) => {
      const m = links.current[i]
      if (!m) return
      const a = b * (1 - env * 0.45) + swayAngle(t, i, { rate: 0.35, amp: 0.04, lag: 0.5 }) + (i < 3 ? -bob : bob * 0.8)
      m.rotation.z = a
      sum += a
    })
    // the head stays roughly level whatever the neck does, and looks about
    const look = lookAround(t, 2)
    headFix.current.rotation.z = -sum
    headYaw.current.rotation.y = swapping ? look.yaw * 0.3 : look.yaw
    headPitch.current.rotation.z = -0.15 + look.pitch + env * 0.2
    const blink = blinkAt(t, 3.8)
    eyes.current.forEach((e) => e && (e.scale.y = blink))
    // wings: folded along the flanks, spread and flapping during the swap
    const flap = env * (0.35 + 0.55 * Math.sin(s * 15))
    wings.current.forEach((g, i) => {
      if (!g) return
      const side = i ? -1 : 1
      g.yaw.rotation.y = Math.PI + side * (0.08 + env * 1.35)
      g.elev.rotation.z = -0.22 + flap + env * 0.25
      g.roll.rotation.x = -side * env * 1.25
    })
  })

  const glow = (c) => (L.glow ? { emissive: c, emissiveIntensity: L.glow } : {})

  return (
    <group {...handlers}>
      {/* the pool: a sandy rim, water, stones and reeds */}
      <mesh geometry={geo.rim}>
        <Flat color="#d9c79f" />
      </mesh>
      <Water radius={1.05} color={L.water} edge={L.edge} amp={0.012} y={0.075} />
      <Ripple tap={tap} color="#ffffff" radius={1} count={3} y={0.09} />
      {[0, 1.1, 2.3, 3.2, 4.4, 5.5].map((a, i) => (
        <mesh key={i} geometry={geo.stone} position={[Math.cos(a) * 1.1, 0.07, Math.sin(a) * 1.1]} scale={[1.2, 0.6, 1]} rotation-y={a}>
          <Flat color={i % 2 ? '#a9a39a' : '#bdb6aa'} />
        </mesh>
      ))}
      {reeds.map((r, i) => (
        <group key={i} position={[r.p[0], 0.06, r.p[1]]} rotation-y={r.r}>
          <Sway i={i} rate={0.3} amp={0.035} axis="z">
            <mesh geometry={geo.reed} scale={[1, r.h, 1]}>
              <Flat color="#5f9a4a" />
            </mesh>
            <mesh geometry={geo.blade} scale={[1, r.h * 0.7, 1]} rotation-z={0.25}>
              <Flat color="#73ad52" side={THREE.DoubleSide} />
            </mesh>
            {r.cat && (
              <mesh geometry={geo.cattail} position-y={r.h * 0.82}>
                <Flat color="#7a5236" />
              </mesh>
            )}
          </Sway>
        </group>
      ))}

      <group ref={bird}>
        {/* the legs: hip, backward-bending ankle, webbed foot */}
        {[1, -1].map((side, i) => (
          <group key={side} ref={(el) => (hips.current[i] = el)} position={[-0.02, HIP_Y, side * LEG_Z]}>
            <mesh geometry={geo.upper}>
              <Flat color={L.leg} {...glow(L.leg)} />
            </mesh>
            <group ref={(el) => (ankles.current[i] = el)} position-y={-UPPER}>
              <mesh geometry={geo.joint} scale={0.03}>
                <Flat color={L.dark} />
              </mesh>
              <mesh geometry={geo.lower}>
                <Flat color={L.leg} {...glow(L.leg)} />
              </mesh>
              <group ref={(el) => (feet.current[i] = el)} position-y={-LOWER}>
                <mesh geometry={geo.foot}>
                  <Flat color={L.dark} side={THREE.DoubleSide} />
                </mesh>
              </group>
            </group>
          </group>
        ))}

        <group ref={body}>
          <mesh geometry={geo.body} position-y={1.1} rotation-z={0.12}>
            <Flat color={L.body} {...glow(L.body)} />
          </mesh>
          <group position={[-0.36, 1.1, 0]} rotation-z={-0.25}>
            <mesh geometry={geo.tail}>
              <Flat color={L.dark} />
            </mesh>
          </group>

          {/* the wings, hinged at the shoulders */}
          {[1, -1].map((side, i) => {
            const set = (k) => (el) => {
              wings.current[i] = wings.current[i] || {}
              wings.current[i][k] = el
            }
            return (
              <group key={side} ref={set('yaw')} position={[0.2, 1.22, side * 0.2]}>
                <group ref={set('elev')}>
                  <group ref={set('roll')}>
                    <mesh geometry={geo.flight}>
                      <Flat color={FEATHER} side={THREE.DoubleSide} />
                    </mesh>
                    <mesh geometry={geo.covert} position-z={-side * 0.014}>
                      <Flat color={L.body} side={THREE.DoubleSide} {...glow(L.body)} />
                    </mesh>
                    <mesh geometry={geo.covert} position-z={side * 0.014} scale={[0.9, 0.9, 1]}>
                      <Flat color={L.dark} side={THREE.DoubleSide} />
                    </mesh>
                  </group>
                </group>
              </group>
            )
          })}

          {/* the neck: a chain of links rising from the chest */}
          <group position={[0.3, 1.18, 0]}>
            {(function chain(i) {
              if (i === NECK.length)
                return (
                  <group ref={headFix}>
                    <group ref={headYaw}>
                      <group ref={headPitch}>
                        <mesh geometry={geo.head} position={[0.02, 0.02, 0]}>
                          <Flat color={L.body} {...glow(L.body)} />
                        </mesh>
                        {[1, -1].map((z, k) => (
                          <group key={z} position={[0.04, 0.04, z * 0.068]}>
                            <mesh ref={(el) => (eyes.current[k] = el)} geometry={geo.eye}>
                              <Flat color={L.eye} roughness={0.3} />
                            </mesh>
                            <mesh geometry={geo.pupil} position-z={z * 0.012}>
                              <Flat color="#1b1a22" roughness={0.3} />
                            </mesh>
                          </group>
                        ))}
                        {/* the thick bent beak: pale base, black tip hooked down */}
                        <group position={[0.11, 0.0, 0]} rotation-z={-0.3}>
                          <mesh geometry={geo.beak}>
                            <Flat color={L.beak} />
                          </mesh>
                          <group position-x={0.115} rotation-z={-1.0}>
                            <mesh geometry={geo.tip}>
                              <Flat color={FEATHER} />
                            </mesh>
                          </group>
                        </group>
                      </group>
                    </group>
                  </group>
                )
              const r = 0.052 - i * 0.0028
              return (
                <group ref={(el) => (links.current[i] = el)} position-y={i === 0 ? 0 : LINK}>
                  <mesh geometry={geo.links[i]}>
                    <Flat color={L.body} {...glow(L.body)} />
                  </mesh>
                  <mesh geometry={geo.joint} scale={r} position-y={LINK}>
                    <Flat color={L.body} {...glow(L.body)} />
                  </mesh>
                  {chain(i + 1)}
                </group>
              )
            })(0)}
          </group>
        </group>
      </group>

      <Burst tap={tap} geometry={geo.drop} count={10} colors={['#ffffff', L.water, '#bfe6ff']} speed={1.4} gravity={4.5} size={0.035} life={0.8} origin={[0.05, 0.1, 0]} spread={1} />
      {/* an invisible hit area round the bird, so a click on its thin parts counts */}
      <mesh geometry={geo.hit}>
        <meshBasicMaterial visible={false} />
      </mesh>
    </group>
  )
}

export default function FlamingoScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[3.6, 1.9, 4.4]} target={[0, 1.0, 0]} hint="It balances on one leg in its pool, swaying a little, its neck bobbing as it looks about and blinks · tap it and it swaps legs, spreading and flapping its wings as it shifts its weight · Look swaps pink, coral, white and neon · drag to orbit">
      <Flamingo {...props} />
    </Stage>
  )
}
