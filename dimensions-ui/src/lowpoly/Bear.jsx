import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Burst, Flat, Ripple, Stage, TAU, blinkAt, facet, rng, useGeo, useKick, useTap } from './kit.jsx'

// A low-poly bear standing on a round patch of meadow: a faceted barrel of a
// body on four stubby legs, a round head with a pale muzzle, a black nose,
// little round ears and a tail. (The same bear that wanders the bank in the
// Low Poly Diorama, on its own.) It breathes, dips its head to sniff the
// grass, looks about, blinks and flicks its ears. Tap it and it rears up on
// its hind legs and roars, jaw open, then drops back down with a thud and a
// puff of dust.

const LOOKS = {
  brown: { fur: '#6b4630', legs: '#5a3a28', muzzle: '#b08a62', ground: '#5cb84e', ground2: '#4fa844', flowers: ['#f4c2d4', '#ffffff', '#ffd6e6'] },
  black: { fur: '#2c2624', legs: '#201b19', muzzle: '#a8865e', ground: '#5cb84e', ground2: '#4fa844', flowers: ['#ffd23f', '#ffffff', '#f4c2d4'] },
  grizzly: { fur: '#7d5a3a', legs: '#5e4028', muzzle: '#c9a072', hump: '#a07c56', ground: '#8fb24e', ground2: '#7ea043', flowers: ['#ffd23f', '#ff9a5c', '#ffffff'] },
  polar: { fur: '#efebe1', legs: '#ddd6c6', muzzle: '#e6dccb', ground: '#eef3f8', ground2: '#dfe7ef', flowers: ['#cfe6ff', '#ffffff', '#b8d8f0'] },
}

const S = 4.3 // the diorama bear is a tenth this size; this scales it up as a whole
const HIND = -0.11 // the hind legs' line: the bear rears up about here
const RISE = 0.95 // how far it rears (radians)

// rear-up, roar, drop: 0..1 of the rear, by seconds since the tap
function rearAt(s) {
  if (s < 0 || s > 1.75) return 0
  if (s < 0.45) return Math.sin((s / 0.45) * (Math.PI / 2))
  if (s < 1.4) return 1 + Math.sin((s - 0.45) * 9) * 0.03
  return 1 - ((s - 1.4) / 0.35) ** 2
}

export function Bear({ look = 'brown' }) {
  const L = LOOKS[look] || LOOKS.brown
  const { tap, handlers, clock } = useTap(1.4)
  const thud = useKick(3)
  const landed = useRef(-99)
  const rear = useRef()
  const body = useRef()
  const head = useRef()
  const jaw = useRef()
  const ears = useRef([])
  const eyes = useRef([])
  const geo = useGeo(
    () => ({
      ball: facet(new THREE.IcosahedronGeometry(1, 1), 0.06, 3),
      leg: facet(new THREE.CylinderGeometry(0.03, 0.026, 0.15, 6).translate(0, 0.075, 0), 0.003, 4),
      ground: facet(new THREE.CylinderGeometry(1, 1.04, 0.14, 14, 1).translate(0, -0.07, 0), 0.02, 6, [1, 0.3, 1], (x, y) => y > -0.001),
      flower: new THREE.OctahedronGeometry(0.035, 0),
      tuft: new THREE.ConeGeometry(0.03, 0.09, 4).translate(0, 0.045, 0),
      dust: new THREE.IcosahedronGeometry(1, 0),
    }),
    [],
  )
  const flowers = useMemo(() => {
    const r = rng(9)
    return Array.from({ length: 16 }, (_, i) => {
      const a = r() * TAU
      const d = 0.55 + r() * 0.85
      return [Math.cos(a) * d, Math.sin(a) * d, i % 3 === 0 ? 'tuft' : 'flower', L.flowers[i % L.flowers.length], r() * 6]
    })
  }, [L])

  useFrame(() => {
    const t = clock.elapsedTime
    const s = tap.since(t)
    const k = rearAt(s)
    // the thud when the front paws come down
    if (s >= 1.75 && s < 2.2 && landed.current !== tap.since(0)) {
      landed.current = tap.since(0)
      thud.kick(t)
    }
    const th = thud.value(t)
    rear.current.rotation.x = -RISE * k
    // breathing, and a squash when it lands
    body.current.scale.set(1 + th * 0.06, 1 + 0.025 * Math.sin(t * 2.2) - th * 0.08, 1 + th * 0.03)
    // head: sniffs the ground now and then and looks about; thrown back to roar
    const dip = Math.max(0, Math.sin(t * 0.55)) ** 3
    head.current.rotation.x = (0.55 * dip) * (1 - k) - 0.55 * k
    head.current.rotation.y = 0.3 * Math.sin(t * 0.31) * (1 - k)
    jaw.current.rotation.x = k * (0.55 + 0.1 * Math.sin(t * 30))
    ears.current.forEach((e, i) => e && (e.rotation.z = (i ? 1 : -1) * (Math.sin(t * 5 + i * 2) > 0.96 ? 0.35 : 0)))
    eyes.current.forEach((e) => e && (e.scale.y = blinkAt(t, 3.8, 0.4)))
  })

  return (
    <group {...handlers}>
      {/* a round patch of meadow (or snow) with flowers and tufts */}
      <mesh geometry={geo.ground} scale={[1.55, 1, 1.55]}>
        <Flat color={L.ground} />
      </mesh>
      {flowers.map(([x, z, kind, c, ry], i) => (
        <mesh key={i} geometry={kind === 'tuft' ? geo.tuft : geo.flower} position={[x, kind === 'tuft' ? 0 : 0.04, z]} rotation-y={ry}>
          <Flat color={kind === 'tuft' ? L.ground2 : c} emissive={kind === 'tuft' ? '#000000' : c} emissiveIntensity={kind === 'tuft' ? 0 : 0.15} />
        </mesh>
      ))}
      <group scale={S}>
        {/* the whole bear pivots on its hind legs to rear up */}
        <group ref={rear} position-z={HIND}>
          <group position-z={-HIND}>
            <group ref={body}>
              <mesh geometry={geo.ball} position-y={0.17} scale={[0.13, 0.12, 0.2]}>
                <Flat color={L.fur} />
              </mesh>
              {L.hump && (
                <mesh geometry={geo.ball} position={[0, 0.25, 0.08]} scale={[0.09, 0.06, 0.09]}>
                  <Flat color={L.hump} />
                </mesh>
              )}
              {/* tail */}
              <mesh geometry={geo.ball} position={[0, 0.2, -0.2]} scale={0.03}>
                <Flat color={L.fur} />
              </mesh>
              {[
                [0.07, 0.11],
                [-0.07, 0.11],
                [0.07, -0.11],
                [-0.07, -0.11],
              ].map(([x, z], i) => (
                <group key={i} position={[x, 0, z]}>
                  <mesh geometry={geo.leg}>
                    <Flat color={L.legs} />
                  </mesh>
                  <mesh geometry={geo.ball} position={[0, 0.012, 0.012]} scale={[0.032, 0.016, 0.04]}>
                    <Flat color={L.legs} />
                  </mesh>
                </group>
              ))}
            </group>
            <group ref={head} position={[0, 0.22, 0.17]}>
              <mesh geometry={geo.ball} position={[0, 0, 0.05]} scale={[0.085, 0.08, 0.09]}>
                <Flat color={L.fur} />
              </mesh>
              <mesh geometry={geo.ball} position={[0, -0.02, 0.13]} scale={[0.04, 0.035, 0.045]}>
                <Flat color={L.muzzle} />
              </mesh>
              {/* the lower jaw, which drops open to roar */}
              <group ref={jaw} position={[0, -0.04, 0.1]}>
                <mesh geometry={geo.ball} position={[0, -0.006, 0.03]} scale={[0.032, 0.014, 0.038]}>
                  <Flat color={L.muzzle} />
                </mesh>
                <mesh geometry={geo.ball} position={[0, 0.004, 0.03]} scale={[0.024, 0.006, 0.03]}>
                  <Flat color="#7a2b30" />
                </mesh>
              </group>
              <mesh geometry={geo.ball} position={[0, -0.005, 0.17]} scale={0.014}>
                <Flat color="#1b1a22" />
              </mesh>
              {[-1, 1].map((sx, i) => (
                <group key={sx} ref={(el) => (ears.current[i] = el)} position={[sx * 0.055, 0.07, 0.03]}>
                  <mesh geometry={geo.ball} scale={0.028}>
                    <Flat color={L.fur} />
                  </mesh>
                  <mesh geometry={geo.ball} position={[0, 0, 0.012]} scale={[0.016, 0.016, 0.01]}>
                    <Flat color={L.muzzle} />
                  </mesh>
                </group>
              ))}
              {[-1, 1].map((sx, i) => (
                <group key={`e${sx}`} ref={(el) => (eyes.current[i] = el)} position={[sx * 0.035, 0.025, 0.12]}>
                  <mesh geometry={geo.ball} scale={0.011}>
                    <Flat color="#1b1a22" roughness={0.3} />
                  </mesh>
                </group>
              ))}
            </group>
          </group>
        </group>
      </group>
      {/* the roar, and the dust when it comes down */}
      <Burst tap={tap} geometry={geo.dust} count={10} colors={['#ffffff', '#f4efe6']} speed={1.4} gravity={-0.4} size={0.05} life={1.2} origin={[0, 1.62, -0.25]} spread={0.7} up={0.6} />
      <Burst tap={thud} geometry={geo.dust} count={14} colors={[L.ground2, '#c9b48a', '#e2d6bc']} speed={1.3} gravity={3} size={0.05} life={0.8} origin={[0, 0.05, 0.5]} spread={1.2} />
      <Ripple tap={thud} color="#ffffff" radius={1.6} count={2} y={0.012} />
    </group>
  )
}

export default function BearScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[4.4, 2.7, 5.4]} target={[0, 0.95, 0]} hint="The bear breathes, sniffs the grass, looks about and flicks its ears on its own · tap it and it rears up and roars, then drops down with a thud · Look swaps brown, black, grizzly and polar · drag to orbit">
      <Bear {...props} />
    </Stage>
  )
}
