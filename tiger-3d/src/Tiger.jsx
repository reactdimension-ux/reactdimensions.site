import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import {
  HIP_Y,
  KNEE_Y,
  PALETTE,
  bodyGeometry,
  earGeometry,
  headGeometry,
  legLowerGeometry,
  legUpperGeometry,
  muzzleGeometry,
  tailSegmentGeometry,
  tuftGeometry,
} from './geometry.js'

const { lerp, damp } = THREE.MathUtils
const DEG = Math.PI / 180

const WALK_RADIUS = 2.2 // the tiger walks a circle of this radius
const STEP_RATE = 5.2 // leg cycle speed, radians per second
const SWING = 0.36 // how far the legs swing, radians
const LEG_LEN = 0.7
// Ground speed that matches the feet, so they do not slide.
const WALK_SPEED = (2 * LEG_LEN * Math.sin(SWING) * STEP_RATE) / (2 * Math.PI)

// Shared materials. `skin` reads the per-face colours baked into the geometry.
function useMaterials() {
  return useMemo(() => {
    const solid = (color) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.8 })
    return {
      skin: new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.8 }),
      orange: solid(PALETTE.orange),
      black: solid(PALETTE.black),
      cream: solid(PALETTE.cream),
      nose: solid(PALETTE.nose),
      iris: solid(PALETTE.iris),
      toeLine: solid(PALETTE.toeLine),
      white: solid('#ffffff'),
    }
  }, [])
}

// One leg: thigh pivoting at the hip, shin + paw pivoting at the knee.
// `stand` is the resting pose, `offset` the leg's place in the walk cycle.
function Leg({ anim, mats, position, hind, offset, stand }) {
  const upper = useRef()
  const lower = useRef()
  const upperGeo = useMemo(() => legUpperGeometry(hind), [hind])
  const lowerGeo = useMemo(() => legLowerGeometry(), [])
  // Hind legs keep a bent hock, so they zig-zag like a real cat's.
  const bend = hind ? 0.22 : 0

  useFrame(() => {
    const { phase, walk } = anim.current
    const p = phase + offset
    const swingUp = bend + SWING * Math.sin(p)
    const swingLow = -bend * 1.8 - 0.75 * Math.max(0, Math.cos(p)) // lift the paw on the way forward
    upper.current.rotation.z = lerp(stand[0], swingUp, walk)
    lower.current.rotation.z = lerp(stand[1], swingLow, walk)
  })

  return (
    <group ref={upper} position={position}>
      <mesh geometry={upperGeo} material={mats.skin} castShadow />
      <group ref={lower} position={[0, KNEE_Y, 0]}>
        <mesh geometry={lowerGeo} material={mats.skin} castShadow />
        {[-0.08, 0, 0.08].map((z) => (
          <mesh key={z} position={[0.15, -0.33, z]} material={mats.cream} castShadow>
            <boxGeometry args={[0.07, 0.06, 0.074]} />
          </mesh>
        ))}
        {[-0.04, 0.04].map((z) => (
          <mesh key={z} position={[0.152, -0.335, z]} material={mats.toeLine}>
            <boxGeometry args={[0.07, 0.05, 0.008]} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

// Tail pieces, base first: [length, base radius, tip radius, material, bend in degrees].
// Each piece hangs off the end of the one before, so a bend carries down the tail.
const TAIL = [
  [0.22, 0.07, 0.062, 'orange', 110],
  [0.08, 0.062, 0.06, 'black', -8],
  [0.2, 0.06, 0.055, 'orange', -22],
  [0.08, 0.055, 0.053, 'black', -20],
  [0.16, 0.053, 0.05, 'orange', -28],
  [0.17, 0.064, 0.045, 'black', -25],
]

function TailPiece({ index, joints, mats, geos }) {
  if (index >= TAIL.length) return null
  const [, , , colour, bend] = TAIL[index]
  const y = index === 0 ? 0 : TAIL[index - 1][0]
  return (
    <group ref={(el) => (joints.current[index] = el)} position={[0, y, 0]} rotation-z={bend * DEG}>
      <mesh geometry={geos[index]} material={mats[colour]} castShadow />
      <TailPiece index={index + 1} joints={joints} mats={mats} geos={geos} />
    </group>
  )
}

function Eye({ mats, z }) {
  // Flat discs stacked along x: white, iris, pupil, plus a small glint.
  return (
    <group position={[0.232, 0.05, z]}>
      <mesh rotation-z={Math.PI / 2} material={mats.white}>
        <cylinderGeometry args={[0.072, 0.072, 0.02, 8]} />
      </mesh>
      <mesh position-x={0.008} rotation-z={Math.PI / 2} material={mats.iris}>
        <cylinderGeometry args={[0.053, 0.053, 0.02, 8]} />
      </mesh>
      <mesh position-x={0.014} rotation-z={Math.PI / 2} material={mats.black}>
        <cylinderGeometry args={[0.03, 0.03, 0.02, 8]} />
      </mesh>
      <mesh position={[0.026, 0.02, -0.016]} material={mats.white}>
        <boxGeometry args={[0.004, 0.016, 0.016]} />
      </mesh>
    </group>
  )
}

function Head({ mats, headRef, eyesRef, earsRef }) {
  const headGeo = useMemo(() => headGeometry(), [])
  const muzzleGeo = useMemo(() => muzzleGeometry(), [])
  const earGeo = useMemo(() => earGeometry(), [])
  const tuftGeo = useMemo(() => tuftGeometry(), [])

  return (
    <group ref={headRef} position={[1.0, 1.03, 0]}>
      <mesh geometry={headGeo} material={mats.skin} castShadow />
      <mesh geometry={muzzleGeo} material={mats.skin} castShadow />

      {/* Nose, the line under it, and a frowning mouth */}
      <mesh position={[0.34, -0.045, 0]} material={mats.nose}>
        <boxGeometry args={[0.045, 0.04, 0.085]} />
      </mesh>
      <mesh position={[0.35, -0.088, 0]} material={mats.nose}>
        <boxGeometry args={[0.012, 0.05, 0.012]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0.35, -0.122, s * 0.03]} rotation-x={s * 0.35} material={mats.nose}>
          <boxGeometry args={[0.012, 0.012, 0.07]} />
        </mesh>
      ))}

      <group ref={eyesRef}>
        <Eye mats={mats} z={-0.13} />
        <Eye mats={mats} z={0.13} />
      </group>

      {/* Brows slant down toward the nose and cut into the eyes: the glare */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0.25, 0.13, s * 0.125]} rotation-x={-s * 0.38} material={mats.black}>
          <boxGeometry args={[0.05, 0.038, 0.18]} />
        </mesh>
      ))}

      {/* Ears: dark shell with a cream inner */}
      {[-1, 1].map((s, i) => (
        <group key={s} ref={(el) => (earsRef.current[i] = el)} position={[-0.08, 0.29, s * 0.2]} rotation-x={s * 0.35}>
          <mesh geometry={earGeo} material={mats.black} castShadow />
          <mesh geometry={earGeo} material={mats.cream} position={[0.02, -0.02, 0]} scale={0.68} />
        </group>
      ))}

      {/* Cheek tufts */}
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={tuftGeo} material={mats.cream} position={[0.04, -0.15, s * 0.28]} rotation-x={s * 2.2} castShadow />
      ))}
    </group>
  )
}

export default function Tiger({ walking }) {
  const mats = useMaterials()
  const bodyGeo = useMemo(() => bodyGeometry(), [])
  const tailGeos = useMemo(() => TAIL.map(([len, r0, r1]) => tailSegmentGeometry(len, r0, r1)), [])

  const anim = useRef({ phase: 0, walk: 0 })
  const mover = useRef()
  const torso = useRef()
  const head = useRef()
  const eyes = useRef()
  const ears = useRef([])
  const tail = useRef([])

  useFrame((state, dt) => {
    const a = anim.current
    const t = state.clock.elapsedTime
    dt = Math.min(dt, 0.05)

    // Ease in and out of the walk, and move along the circle at foot speed.
    a.walk = damp(a.walk, walking ? 1 : 0, 4, dt)
    a.phase += dt * STEP_RATE * a.walk
    mover.current.rotation.y -= (dt * WALK_SPEED * a.walk) / WALK_RADIUS

    // Breathing when standing, a small bounce on each step when walking.
    const breathe = Math.sin(t * 1.6) * 0.006
    const step = Math.sin(a.phase * 2) * 0.012 - 0.015
    torso.current.position.y = lerp(breathe, step, a.walk)
    torso.current.rotation.x = Math.sin(a.phase) * 0.03 * a.walk

    // Head: turned toward the viewer and following the pointer when standing.
    const yaw = lerp(0.45 + state.pointer.x * 0.35, 0.12, a.walk)
    const pitch = lerp(-0.08 + state.pointer.y * 0.14, -0.04, a.walk)
    head.current.rotation.y = damp(head.current.rotation.y, yaw, 5, dt)
    head.current.rotation.z = damp(head.current.rotation.z, pitch, 5, dt)

    // Blink every few seconds.
    eyes.current.scale.y = t % 3.7 < 0.12 ? 0.12 : 1

    // Occasional ear flick, one ear after the other.
    ears.current.forEach((ear, i) => {
      if (ear) ear.rotation.z = Math.pow(Math.max(0, Math.sin(t * 0.9 + i * 1.3)), 24) * 0.3
    })

    // Tail sways side to side; the wave travels from base to tip.
    tail.current.forEach((joint, i) => {
      if (joint) joint.rotation.x = Math.sin(t * (1.4 + a.walk * 1.6) - i * 0.55) * (0.1 + a.walk * 0.05)
    })
  })

  // Legs: [x, z, hind, place in walk cycle, resting pose [thigh, shin]].
  // Negative z is the side nearest the starting camera.
  const legs = [
    [0.55, -0.15, false, Math.PI * 0.5, [0.2, -0.06]],
    [0.55, 0.15, false, Math.PI * 1.5, [-0.14, 0]],
    [-0.55, -0.16, true, 0, [0.08, -0.36]],
    [-0.55, 0.16, true, Math.PI, [0.36, -0.5]],
  ]

  return (
    // The mover's pivot is the centre of the walking circle.
    <group ref={mover} position={[0, 0, WALK_RADIUS]}>
      <group position={[0, 0, -WALK_RADIUS]}>
        <group ref={torso}>
          <mesh geometry={bodyGeo} material={mats.skin} castShadow />
          <Head mats={mats} headRef={head} eyesRef={eyes} earsRef={ears} />
          <group position={[-0.84, 0.84, 0]}>
            <TailPiece index={0} joints={tail} mats={mats} geos={tailGeos} />
          </group>
        </group>
        {legs.map(([x, z, hind, offset, stand], i) => (
          <Leg
            key={i}
            anim={anim}
            mats={mats}
            position={[x, hind ? HIP_Y - 0.015 : HIP_Y, z]}
            hind={hind}
            offset={offset}
            stand={stand}
          />
        ))}
      </group>
    </group>
  )
}
