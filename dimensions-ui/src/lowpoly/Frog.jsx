import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Face, Flat, Ripple, Stage, Water, blob, cone, facet, squash, useGeo, useTap, waveAt } from './kit.jsx'

// A low-poly frog on a lily pad in a pond: a squat faceted body with a pale
// belly, bulging eyes on top of its head, a wide mouth, folded hind legs
// with webbed feet and a throat sac. The pads ride the ripples, the throat
// pulses as it breathes and swells right out every few seconds as it
// croaks. Tap it and it leaps to the other pad: a crouch, a long arc with
// its legs kicked out straight, and a squashy landing that sends rings out.

const KINDS = {
  tree: { skin: '#5fbf4a', belly: '#f4f1d0', eye: '#e3393f', foot: '#f28c38', spot: null },
  dart: { skin: '#2f6fd0', belly: '#3d8de0', eye: '#1b1a22', foot: '#1f2a44', spot: '#14141a' },
  golden: { skin: '#f6c23a', belly: '#fbe28a', eye: '#1b1a22', foot: '#e8a02a', spot: null },
  bull: { skin: '#6e8a4a', belly: '#e8e2b8', eye: '#c9962a', foot: '#5a7a3a', spot: '#4f6a34' },
}
const PADS = [
  [-0.4, 0.05],
  [0.42, -0.1],
]
const SEA = 0.06
const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x))

export function Frog({ kind = 'tree' }) {
  const K = KINDS[kind] || KINDS.tree
  const { tap, handlers, clock } = useTap(1)
  const frog = useRef()
  const squish = useRef()
  const legs = useRef([])
  const sac = useRef()
  const pads = useRef([])
  const st = useRef({ on: 0, from: 0, t0: -99 })

  const geo = useGeo(
    () => ({
      pad: new THREE.CylinderGeometry(0.26, 0.26, 0.012, 14, 1, false, 0.35, Math.PI * 2 - 0.7),
      body: blob(0.15, 1),
      belly: blob(0.12, 2),
      bump: blob(0.05, 3),
      mouth: new THREE.TorusGeometry(0.09, 0.008, 3, 10, Math.PI * 0.8).rotateZ(Math.PI * 1.1),
      sac: blob(0.06, 4),
      thigh: facet(new THREE.IcosahedronGeometry(0.06, 0), 0.004, 5).scale(0.8, 0.7, 1.6),
      shin: facet(new THREE.CylinderGeometry(0.025, 0.03, 0.14, 5, 1).rotateX(Math.PI / 2).translate(0, 0, -0.07), 0.003, 6),
      foot: cone(0.045, 0.09, 4, 7).rotateX(Math.PI / 2).scale(1, 0.25, 1),
      arm: facet(new THREE.CylinderGeometry(0.018, 0.022, 0.1, 5, 1).translate(0, -0.05, 0), 0.003, 8),
      spot: blob(0.025, 9, 0),
      lotus: cone(0.05, 0.1, 5, 10),
    }),
    [],
  )

  useFrame(() => {
    const t = clock.elapsedTime
    const S = st.current
    // pads ride the water
    pads.current.forEach((p, i) => p && (p.position.y = SEA + 0.008 + waveAt(PADS[i][0], PADS[i][1], t, 0.02)))
    const s = t - S.t0
    const [ax, az] = PADS[S.from]
    const [bx, bz] = PADS[S.on]
    let x = bx
    let z = bz
    let y = 0
    let k = Math.sin(t * 2.4) * 0.02
    let kickOut = 0
    if (s >= 0 && s < 0.15) k = 0.18 * ease(s / 0.15)
    else if (s >= 0.15 && s < 0.85) {
      const q = (s - 0.15) / 0.7
      x = ax + (bx - ax) * q
      z = az + (bz - az) * q
      y = 4 * q * (1 - q) * 0.42
      k = q < 0.4 ? -0.12 : -0.04
      kickOut = Math.sin(Math.min(1, q * 2.5) * Math.PI * 0.5) * (1 - ease((q - 0.6) / 0.4))
    } else if (s >= 0.85 && s < 1.25) k = 0.2 * Math.exp(-6 * (s - 0.85)) * Math.cos((s - 0.85) * 13)
    const padY = SEA + 0.015 + waveAt(x, z, t, 0.02)
    frog.current.position.set(x, padY + y, z)
    frog.current.rotation.y = Math.atan2(bx - ax, bz - az) + Math.sin(t * 0.4) * 0.15
    squash(squish.current, k)
    legs.current.forEach((l) => l && (l.rotation.x = kickOut * 1.6))
    // the throat: breathing, and a big swell every few seconds as it croaks
    const croak = t % 3.6 < 0.6 ? Math.sin(((t % 3.6) / 0.6) * Math.PI) : 0
    sac.current.scale.setScalar(1 + Math.sin(t * 6) * 0.1 + croak * 0.9)
  })

  return (
    <group
      {...handlers}
      onClick={(e) => {
        handlers.onClick(e)
        const S = st.current
        if (clock.elapsedTime - S.t0 < 1.25) return // still in the air
        S.from = S.on
        S.on = 1 - S.on
        S.t0 = clock.elapsedTime
      }}
    >
      <Water radius={1.2} color="#4a9a8a" edge="#2f7a6e" amp={0.02} y={SEA} />
      <Ripple loop period={2.5} count={2} color="#ffffff" radius={0.6} opacity={0.3} y={SEA + 0.03} />
      <Ripple tap={tap} count={3} color="#ffffff" radius={0.9} y={SEA + 0.03} />
      {PADS.map(([x, z], i) => (
        <group key={i} ref={(el) => (pads.current[i] = el)} position={[x, SEA, z]} rotation-y={i * 2.1}>
          <mesh geometry={geo.pad}>
            <Flat color={i ? '#4f9a3a' : '#5fae4a'} />
          </mesh>
          {i === 1 && (
            <group position={[0.12, 0.02, 0.1]}>
              {[0, 1, 2, 3, 4].map((k) => (
                <mesh key={k} geometry={geo.lotus} rotation={[0.5, (k / 5) * Math.PI * 2, 0]}>
                  <Flat color="#f6b4c8" />
                </mesh>
              ))}
            </group>
          )}
        </group>
      ))}

      <group ref={frog}>
        <group ref={squish}>
          {/* hind legs: thigh, shin and webbed foot, kicked straight in the leap */}
          {[-1, 1].map((x, i) => (
            <group key={x} ref={(el) => (legs.current[i] = el)} position={[x * 0.1, 0.05, -0.05]}>
              <mesh geometry={geo.thigh} position={[x * 0.03, 0, 0]} rotation-y={x * 0.4}>
                <Flat color={K.skin} />
              </mesh>
              <group position={[x * 0.06, -0.03, 0.06]} rotation-y={x * -0.2}>
                <mesh geometry={geo.shin}>
                  <Flat color={K.skin} />
                </mesh>
                <mesh geometry={geo.foot} position={[0, -0.01, -0.13]} rotation-y={Math.PI}>
                  <Flat color={K.foot} />
                </mesh>
              </group>
            </group>
          ))}
          {[-1, 1].map((x) => (
            <group key={x} position={[x * 0.08, 0.1, 0.09]} rotation-z={x * 0.25}>
              <mesh geometry={geo.arm}>
                <Flat color={K.skin} />
              </mesh>
              <mesh geometry={geo.foot} position={[0, -0.1, 0.02]} scale={0.6}>
                <Flat color={K.foot} />
              </mesh>
            </group>
          ))}
          <mesh geometry={geo.body} position-y={0.11} scale={[1.05, 0.72, 1.15]}>
            <Flat color={K.skin} />
          </mesh>
          <mesh geometry={geo.belly} position={[0, 0.08, 0.05]} scale={[0.9, 0.6, 1]}>
            <Flat color={K.belly} />
          </mesh>
          {K.spot &&
            [
              [0.06, 0.2, -0.02],
              [-0.07, 0.18, 0.04],
              [0.02, 0.19, -0.08],
            ].map((p, i) => (
              <mesh key={i} geometry={geo.spot} position={p} scale={[1, 0.4, 1]}>
                <Flat color={K.spot} />
              </mesh>
            ))}
          {[-1, 1].map((x) => (
            <mesh key={x} geometry={geo.bump} position={[x * 0.07, 0.2, 0.07]}>
              <Flat color={K.skin} />
            </mesh>
          ))}
          <Face position={[0, 0.215, 0.115]} spacing={0.14} size={0.022} color={K.eye} mouth="none" blinkEvery={4.4} />
          <mesh geometry={geo.mouth} position={[0, 0.12, 0.15]}>
            <Flat color="#2a2622" />
          </mesh>
          <mesh ref={sac} geometry={geo.sac} position={[0, 0.06, 0.13]} scale={[1, 0.8, 1]}>
            <Flat color={K.belly} />
          </mesh>
        </group>
      </group>
    </group>
  )
}

export default function FrogScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={false} camera={[1.7, 1.15, 2.1]} target={[0, 0.12, 0]} hint="It breathes with its throat and croaks every few seconds, the pads riding the ripples · tap it and it leaps to the other pad, legs kicked out straight · Kind swaps tree, dart, golden and bull · drag to orbit">
      <Frog {...props} />
    </Stage>
  )
}
