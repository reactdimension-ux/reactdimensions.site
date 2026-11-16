import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Burst, Flat, Ripple, TAU, Stage, blob, cone, facet, swayAngle, terrainGeo, useGeo, useKick, useTap } from './kit.jsx'

// A ship's anchor hanging over a patch of sea floor: a ring at the top, a
// long shank crossed by a stock with knobbed ends, and two curved arms that
// sweep up from the crown to spade-shaped flukes. It hangs from a chain of
// interlocking links that rises up out of shot, over a sandy patch with a
// scallop, a conch, a starfish and a few pebbles. Left alone, it swings
// gently on its chain like a slow pendulum and turns a little. Tap it and
// it drops: it falls, thuds into the sand with a small bounce, throws up a
// puff of sand and a ring spreads across the floor, then it is winched back
// up to where it hung.

const LOOKS = {
  iron: { metal: '#4b4e57', chain: '#5d6069', ring: '#6a6d76', metalness: 0.45, roughness: 0.55 },
  brass: { metal: '#c9a04a', chain: '#b48d3c', ring: '#d8b45e', metalness: 0.65, roughness: 0.38 },
  navy: { metal: '#24365f', chain: '#3b404b', ring: '#e9e4d8', metalness: 0.15, roughness: 0.6 },
  rust: { metal: '#9c4f2c', chain: '#84462a', ring: '#b8653a', metalness: 0.1, roughness: 0.95 },
}

const PIVOT = 3.4 // where the chain hangs from, out of shot above
const HANG = 1.55 // height of the anchor's ring at rest
const SHANK = 1.0
const ARM_R = 0.38
const ARM_A = 1.22 // half the sweep of the arms, radians
const SAND = 0.07
const DROP = HANG - SHANK - SAND + 0.02 // fall far enough for the crown to bite
const LINK = 0.13
const LINKS = Math.ceil((PIVOT - HANG + DROP + 0.4) / LINK)
const T_FALL = 0.4
const T_REST = 1.5
const T_UP = 3.3

const ease = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u))

// how far below its resting height the anchor is, s seconds after a tap
function dropAt(s) {
  if (s < 0 || s > T_UP) return 0
  if (s < T_FALL) return DROP * (s / T_FALL) ** 2
  if (s < T_FALL + 0.3) return DROP - 0.05 * Math.sin((Math.PI * (s - T_FALL)) / 0.3)
  if (s < T_REST) return DROP
  return DROP * (1 - ease((s - T_REST) / (T_UP - T_REST)))
}

export function Anchor({ look = 'iron' }) {
  const L = LOOKS[look] || LOOKS.iron
  const { tap, handlers, clock } = useTap(1)
  const impact = useKick(2)
  const fired = useRef(-99)
  const swing = useRef()
  const hang = useRef()
  const body = useRef()

  const geo = useGeo(
    () => ({
      ring: new THREE.TorusGeometry(0.09, 0.024, 5, 10),
      shank: facet(new THREE.CylinderGeometry(0.032, 0.042, SHANK - 0.06, 6, 3).translate(0, -(SHANK - 0.06) / 2 - 0.06, 0), 0.004, 2),
      collar: new THREE.CylinderGeometry(0.055, 0.055, 0.05, 6),
      stock: new THREE.CylinderGeometry(0.026, 0.026, 0.82, 6).rotateX(Math.PI / 2),
      knob: blob(0.045, 3, 0),
      arms: new THREE.TorusGeometry(ARM_R, 0.036, 5, 12, ARM_A * 2).rotateZ(-Math.PI / 2 - ARM_A),
      crown: blob(0.06, 4, 0),
      fluke: facet(cone(0.12, 0.24, 4, 5).scale(1, 1, 0.28), 0.004, 6),
      link: new THREE.TorusGeometry(0.048, 0.015, 4, 8).scale(1, 1.55, 1),
      sand: terrainGeo({ radius: 1.15, height: SAND, seed: 9, rings: 4, segs: 14, rough: 0.35, profile: 'dome', bands: [[0, '#e2c890'], [0.5, '#ebd5a2'], [0.85, '#f2e0b4']] }),
      shell: facet(new THREE.ConeGeometry(0.1, 0.035, 9, 1, false, 0, Math.PI), 0.004, 7),
      conch: cone(0.045, 0.15, 6, 8),
      arm: cone(0.028, 0.11, 4, 9).scale(1, 1, 0.45),
      pebble: blob(1, 10, 0),
      hit: new THREE.BoxGeometry(0.95, 1.2, 0.5).translate(0, -0.55, 0),
    }),
    [],
  )

  const fy = -SHANK + ARM_R // centre of the arms' arc
  const flukes = [1, -1].map((side) => {
    const x = side * ARM_R * Math.sin(ARM_A)
    const y = fy - ARM_R * Math.cos(ARM_A)
    const rz = side * (ARM_A - Math.PI / 2)
    return { x: x - side * Math.cos(ARM_A) * 0.07, y: y - Math.sin(ARM_A) * 0.07, rz }
  })

  const links = useMemo(() => Array.from({ length: LINKS }, (_, i) => ({ y: 0.11 + i * LINK, ry: i % 2 ? 0 : Math.PI / 2 })), [])

  useFrame(() => {
    const t = clock.elapsedTime
    const s = tap.since(t)
    const busy = s >= 0 && s < T_UP + 0.6
    // the idle swing eases out while it drops and back in after
    const calm = busy ? 1 - ease(Math.min(s / 0.25, (T_UP + 0.6 - s) / 0.6)) : 1
    swing.current.rotation.z = swayAngle(t, 0, { rate: 0.22, amp: 0.05 }) * calm
    swing.current.rotation.x = swayAngle(t + 1.3, 0, { rate: 0.17, amp: 0.025 }) * calm
    hang.current.position.y = -(PIVOT - HANG) - dropAt(s)
    // it tips a little as it settles in the sand, and twists slowly at rest
    const tip = busy ? 0.12 * ease((s - T_FALL) / 0.3) * (1 - ease((s - T_REST) / 0.6)) : 0
    body.current.rotation.z = tip
    body.current.rotation.y = 0.35 * Math.sin(t * 0.3) * calm
    if (s >= T_FALL && s < T_UP && fired.current !== t - s) {
      fired.current = t - s
      impact.kick(t - s + T_FALL)
    }
  })

  const metal = <Flat color={L.metal} metalness={L.metalness} roughness={L.roughness} />

  return (
    <group {...handlers}>
      {/* the sea floor */}
      <mesh geometry={geo.sand}>
        <Flat vertexColors color="#ffffff" />
      </mesh>
      <mesh geometry={geo.shell} position={[0.55, 0.05, 0.42]} rotation={[0, 0.6, 0]} scale={1.6}>
        <Flat color="#f4a6a0" />
      </mesh>
      <mesh geometry={geo.shell} position={[-0.48, 0.05, -0.5]} rotation={[0, 2.4, 0]} scale={1.2}>
        <Flat color="#f6e3c8" />
      </mesh>
      <mesh geometry={geo.conch} position={[-0.62, 0.06, 0.3]} rotation={[0.1, 0.5, Math.PI / 2 - 0.15]} scale={1.5}>
        <Flat color="#f2d0a4" />
      </mesh>
      <group position={[0.35, 0.07, -0.62]} rotation-y={0.4} scale={1.7}>
        {Array.from({ length: 5 }, (_, i) => (
          <group key={i} rotation-y={(i / 5) * TAU}>
            <mesh geometry={geo.arm} rotation-x={Math.PI / 2 - 0.05} position-z={0.01}>
              <Flat color="#f08a3c" />
            </mesh>
          </group>
        ))}
      </group>
      {[
        [0.8, 0.1, 0.05],
        [-0.75, -0.15, 0.04],
        [0.15, 0.82, 0.045],
        [-0.2, -0.8, 0.035],
        [0.72, -0.4, 0.03],
      ].map(([x, z, s], i) => (
        <mesh key={i} geometry={geo.pebble} position={[x, 0.02, z]} scale={[s * 1.3, s * 0.7, s]} rotation-y={i}>
          <Flat color={i % 2 ? '#a39d93' : '#8c877e'} />
        </mesh>
      ))}
      <Burst tap={impact} count={22} colors={['#e2c890', '#f2e0b4', '#cdb27a']} speed={1.1} gravity={2.6} size={0.07} life={1.2} origin={[0, 0.1, 0]} spread={0.8} up={1.3} seed={4} />
      <Ripple tap={impact} color="#fff6dc" count={2} radius={1.2} life={1.1} y={0.075} opacity={0.6} />

      {/* the chain and anchor, swinging from a pivot above */}
      <group ref={swing} position-y={PIVOT}>
        <group ref={hang}>
          {links.map((l, i) => (
            <mesh key={i} geometry={geo.link} position-y={l.y} rotation-y={l.ry}>
              <Flat color={L.chain} metalness={L.metalness} roughness={L.roughness} />
            </mesh>
          ))}
          <group ref={body}>
            <mesh geometry={geo.ring}>
              <Flat color={L.ring} metalness={L.metalness} roughness={L.roughness} />
            </mesh>
            <mesh geometry={geo.shank}>{metal}</mesh>
            <mesh geometry={geo.collar} position-y={-0.2}>
              {metal}
            </mesh>
            <mesh geometry={geo.stock} position-y={-0.2}>
              {metal}
            </mesh>
            {[-0.41, 0.41].map((z) => (
              <mesh key={z} geometry={geo.knob} position={[0, -0.2, z]}>
                {metal}
              </mesh>
            ))}
            <mesh geometry={geo.arms} position-y={fy}>
              {metal}
            </mesh>
            <mesh geometry={geo.crown} position-y={-SHANK + 0.01}>
              {metal}
            </mesh>
            {flukes.map((f, i) => (
              <mesh key={i} geometry={geo.fluke} position={[f.x, f.y, 0]} rotation-z={f.rz}>
                {metal}
              </mesh>
            ))}
            {/* an invisible box round the anchor, so a tap on it always lands */}
            <mesh geometry={geo.hit}>
              <meshBasicMaterial visible={false} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  )
}

export default function AnchorScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[3.4, 2.1, 4.6]} target={[0, 0.85, 0]} hint="The anchor swings gently on its chain on its own · tap it and it drops, thuds into the sand with a puff and a ripple, then winches back up · Look swaps iron, brass, navy and rust · drag to orbit">
      <Anchor {...props} />
    </Stage>
  )
}
