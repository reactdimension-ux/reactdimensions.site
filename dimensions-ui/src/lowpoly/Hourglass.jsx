import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Flat, Liquid, Stage, TAU, facet, fillHeight, useGeo, useTap } from './kit.jsx'

// A low-poly hourglass in a turned wooden frame: two lathed glass bulbs
// joined at a narrow neck, with sand that runs from the upper bulb to the
// lower in a thin stream. The sand is a volume, not a picture: each bulb's
// share is turned into a level by the bulb's own shape, so the upper heap
// drops slowly at its wide shoulder and fast in its neck, and the sand
// always lies at whichever end of a bulb is down. It runs at a constant
// rate, as real sand does whatever the height above the neck. Tap it to
// flip it: it swings over on a spring and the sand starts back the other way.

const SANDS = {
  gold: { sand: '#e8b84a', top: '#f6d27a', wood: '#6e4a34' },
  ocean: { sand: '#4aa8e0', top: '#8fd0ff', wood: '#4a3a30' },
  rose: { sand: '#f28aa8', top: '#ffc2d4', wood: '#8a5a3a' },
  onyx: { sand: '#3a3846', top: '#6a6878', wood: '#c9a27a' },
}
// one bulb, neck at y = 0
const BULB = [
  [0, 0],
  [0.022, 0],
  [0.05, 0.03],
  [0.14, 0.11],
  [0.19, 0.21],
  [0.2, 0.28],
  [0.17, 0.36],
  [0.1, 0.41],
  [0, 0.43],
]
const SAND = BULB.map(([r, y]) => [r * 0.92, y])
const GLASS = BULB.map(([r, y]) => [r + 0.012, y])
const PLATE = 0.46
const MID = 0.52 // height of the neck above the floor

export function Hourglass({ sand = 'gold', duration = 18 }) {
  const C = SANDS[sand] || SANDS.gold
  const { tap, handlers } = useTap()
  const frame = useRef()
  const stream = useRef()
  const st = useRef({ fA: 0.92, angle: 0, vel: 0, target: 0 })

  const geo = useGeo(
    () => ({
      glass: new THREE.LatheGeometry(GLASS.map(([r, y]) => new THREE.Vector2(r, y)), 12),
      plate: facet(new THREE.CylinderGeometry(0.27, 0.28, 0.05, 8, 1), 0.004, 1),
      knob: new THREE.CylinderGeometry(0.2, 0.22, 0.03, 8, 1),
      post: new THREE.CylinderGeometry(0.016, 0.016, PLATE * 2, 6, 1),
      bead: new THREE.SphereGeometry(0.026, 6, 4),
      stream: new THREE.CylinderGeometry(0.006, 0.006, 1, 4, 1).translate(0, -0.5, 0),
    }),
    [],
  )

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05)
    if (!(dt > 0)) return
    const S = st.current
    // the flip: a spring towards the target angle
    S.vel += ((S.target - S.angle) * 90 - S.vel * 9) * dt
    S.angle += S.vel * dt
    frame.current.rotation.z = S.angle
    // sand runs at a constant rate while the glass is upright and still
    const aUp = Math.cos(S.angle) > 0
    const settled = Math.abs(S.target - S.angle) < 0.12
    const upper = aUp ? S.fA : 1 - S.fA
    const running = settled && upper > 0.001
    if (running) S.fA = aUp ? Math.max(0, S.fA - dt / duration) : Math.min(1, S.fA + dt / duration)
    // the stream reaches from the neck down to the sand in the lower bulb
    const lowerFill = aUp ? 1 - S.fA : S.fA
    const len = fillHeight(SAND, lowerFill, true)
    stream.current.visible = running
    stream.current.scale.set(1, Math.max(0.01, len), 1)
    stream.current.rotation.z = aUp ? 0 : Math.PI
  })

  return (
    <group
      {...handlers}
      onClick={(e) => {
        handlers.onClick(e)
        st.current.target += Math.PI
      }}
    >
      <group ref={frame} position-y={MID}>
        {/* bulb A above the neck, bulb B below it (the same bulb turned over) */}
        <Liquid profile={SAND} fill={() => st.current.fA} color={C.sand} surface={C.top} opacity={1} slosh={0} />
        <group rotation-x={Math.PI}>
          <Liquid profile={SAND} fill={() => 1 - st.current.fA} color={C.sand} surface={C.top} opacity={1} slosh={0} />
        </group>
        <mesh ref={stream} geometry={geo.stream}>
          <Flat color={C.sand} />
        </mesh>
        {[0, Math.PI].map((rx) => (
          <mesh key={rx} geometry={geo.glass} rotation-x={rx} renderOrder={2}>
            <meshStandardMaterial color="#dff3ff" flatShading roughness={0.1} metalness={0.1} transparent opacity={0.22} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
        ))}
        {/* the turned frame */}
        {[-1, 1].map((s) => (
          <group key={s} position-y={s * PLATE}>
            <mesh geometry={geo.plate}>
              <Flat color={C.wood} />
            </mesh>
            <mesh geometry={geo.knob} position-y={-s * 0.035}>
              <Flat color={C.wood} />
            </mesh>
          </group>
        ))}
        {[0, 1, 2].map((i) => {
          const a = (i / 3) * TAU + 0.5
          return (
            <group key={i} position={[Math.cos(a) * 0.235, 0, Math.sin(a) * 0.235]}>
              <mesh geometry={geo.post}>
                <Flat color={C.wood} />
              </mesh>
              {[-0.2, 0, 0.2].map((y) => (
                <mesh key={y} geometry={geo.bead} position-y={y}>
                  <Flat color={C.wood} />
                </mesh>
              ))}
            </group>
          )
        })}
      </group>
    </group>
  )
}

export default function HourglassScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[2.4, 1.6, 3.4]} target={[0, 0.5, 0]} hint="Sand runs through the neck at a steady rate; each bulb's level comes from its volume and shape, and the sand always lies at the low end · tap it to flip it over · Duration sets how long it runs · Sand swaps gold, ocean, rose and onyx · drag to orbit">
      <Hourglass {...props} />
    </Stage>
  )
}
