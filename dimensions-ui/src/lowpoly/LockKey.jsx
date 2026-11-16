import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Burst, Flat, Stage, facet, useGeo, useTap } from './kit.jsx'

// A low-poly padlock with its key: a chunky chamfered lock body with a
// darker face plate, rivets and a keyhole, and a steel shackle (a half ring
// on two legs, one long, one short) standing in its top. The key, a ring
// bow, a collar, a round shaft and a toothed bit, hovers beside it. Left
// alone, the key bobs and slowly turns in the air. Tap it and the key flies
// round to face the lock, slides into the keyhole and turns a quarter turn:
// the shackle pops up on a spring and swivels open on its long leg, and a
// sparkle bursts off. A few seconds later the shackle swings back and
// snaps shut, the key turns back, slides out and floats back to its place.

const LOOKS = {
  brass: { body: '#c99a3a', plate: '#a87c28', shackle: '#d4d8de', key: '#d9b44a', hole: '#2a2118' },
  silver: { body: '#aeb5c0', plate: '#8e96a3', shackle: '#e0e3e8', key: '#c9ced6', hole: '#1f2228' },
  gold: { body: '#f0c43a', plate: '#d9a92a', shackle: '#f6dc7a', key: '#ffd84a', hole: '#2a2118' },
  red: { body: '#d6383a', plate: '#b02a2e', shackle: '#d4d8de', key: '#e8c04a', hole: '#2a1416' },
}

const W = 0.66 // lock body width
const H = 0.58 // lock body height
const D = 0.34 // lock body depth
const R = 0.19 // shackle: half the gap between its legs
const ARCH_Y = H + 0.22 // the shackle's arch centre, shut
const KY = 0.3 // keyhole height
const FRONT = D / 2 + 0.02 // the key's collar sits here when it's in

// the sequence after a tap (seconds)
const T_FLY = 0.8
const T_IN = 1.15
const T_TURN = 1.5
const T_SHUT = 4.4
const T_BACK = 4.9
const T_OUT = 5.25
const T_HOME = 5.6
const END = 6.5

const smooth = (a, b, x) => {
  const u = Math.max(0, Math.min(1, (x - a) / (b - a)))
  return u * u * (3 - 2 * u)
}

// a rounded rectangle, w by h, centred on x, foot on y = 0
function rounded(w, h, r) {
  const s = new THREE.Shape()
  s.moveTo(-w / 2 + r, 0)
  s.lineTo(w / 2 - r, 0)
  s.absarc(w / 2 - r, r, r, -Math.PI / 2, 0, false)
  s.lineTo(w / 2, h - r)
  s.absarc(w / 2 - r, h - r, r, 0, Math.PI / 2, false)
  s.lineTo(-w / 2 + r, h)
  s.absarc(-w / 2 + r, h - r, r, Math.PI / 2, Math.PI, false)
  s.lineTo(-w / 2, r)
  s.absarc(-w / 2 + r, r, r, Math.PI, Math.PI * 1.5, false)
  return s
}

const QX = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2)
const AY = new THREE.Vector3(0, 1, 0)
const AZ = new THREE.Vector3(0, 0, 1)

export function LockKey({ look = 'brass' }) {
  const L = LOOKS[look] || LOOKS.brass
  const { tap, handlers, clock } = useTap(1)
  const key = useRef()
  const lift = useRef()
  const swivel = useRef()
  const spring = useRef({ y: 0, vy: 0, a: 0, va: 0 })
  const tmp = useMemo(() => ({ hp: new THREE.Vector3(), hq: new THREE.Quaternion(), q: new THREE.Quaternion(), roll: new THREE.Quaternion(), p: new THREE.Vector3(), A: new THREE.Vector3(0, KY, FRONT + 0.32), I: new THREE.Vector3(0, KY, FRONT) }), [])
  // the sparkle fires when the shackle pops, not at the tap
  const pop = useMemo(() => ({ since: (t) => tap.since(t) - T_TURN }), [tap])

  const geo = useGeo(() => {
    const body = new THREE.ExtrudeGeometry(rounded(W, H, 0.1), { depth: D - 0.06, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 1, curveSegments: 2 }).translate(0, 0, -(D - 0.06) / 2)
    const plate = new THREE.ExtrudeGeometry(rounded(W - 0.16, H - 0.16, 0.06), { depth: 0.02, bevelEnabled: false, curveSegments: 2 })
    return {
      body: facet(body, 0.008, 1),
      plate: facet(plate, 0.003, 2, [1, 1, 0]),
      hole: new THREE.CylinderGeometry(0.045, 0.045, 0.02, 7, 1).rotateX(Math.PI / 2),
      slot: new THREE.BoxGeometry(0.036, 0.1, 0.02),
      rivet: new THREE.IcosahedronGeometry(0.018, 0),
      arch: facet(new THREE.TorusGeometry(R, 0.05, 6, 10, Math.PI), 0.004, 3),
      legLong: new THREE.CylinderGeometry(0.05, 0.05, 0.42, 6, 1).translate(0, -0.21, 0),
      legShort: new THREE.CylinderGeometry(0.05, 0.05, 0.34, 6, 1).translate(0, -0.17, 0),
      // the key, collar at the origin, shaft running back along -z
      bow: facet(new THREE.TorusGeometry(0.09, 0.03, 5, 8).rotateY(Math.PI / 2), 0.004, 4),
      collar: new THREE.CylinderGeometry(0.045, 0.045, 0.035, 7, 1).rotateX(Math.PI / 2),
      shaft: new THREE.CylinderGeometry(0.022, 0.022, 0.27, 6, 1).rotateX(Math.PI / 2).translate(0, 0, -0.135),
      tooth: new THREE.BoxGeometry(0.026, 0.07, 0.035),
      spark: new THREE.OctahedronGeometry(1, 0),
      hit: new THREE.BoxGeometry(1.5, 1.25, 0.6).translate(0.12, 0.62, 0),
    }
  }, [])

  const onClick = (e) => {
    e.stopPropagation()
    const s = tap.since(clock.elapsedTime)
    if (s >= 0 && s < END) return // already unlocking
    handlers.onClick(e)
  }

  useFrame((_, dt) => {
    const t = clock.elapsedTime
    const s = tap.since(t)
    const d = Math.min(dt, 0.033)
    const { hp, hq, q, roll, p, A, I } = tmp
    // where the key hovers: beside the lock, bobbing, turning, bow up
    hp.set(0.62, 0.66 + Math.sin(t * 1.5) * 0.05, 0.04)
    hq.setFromAxisAngle(AY, t * 0.7).multiply(QX)
    const k = key.current
    if (s < 0 || s >= END) {
      k.position.copy(hp)
      k.quaternion.copy(hq)
    } else if (s < T_FLY || s >= T_HOME) {
      // flying to the keyhole, or home again; an arc up over the way
      const u = s < T_FLY ? smooth(0, T_FLY, s) : 1 - smooth(T_HOME, END, s)
      p.lerpVectors(hp, A, u)
      p.y += Math.sin(u * Math.PI) * 0.25
      k.position.copy(p)
      k.quaternion.slerpQuaternions(hq, q.identity(), u)
    } else {
      // sliding in, turning, holding, turning back, sliding out
      const inn = smooth(T_FLY, T_IN, s) * (1 - smooth(T_OUT, T_HOME, s))
      k.position.lerpVectors(A, I, inn)
      const turn = smooth(T_IN, T_TURN, s) * (1 - smooth(T_BACK, T_OUT, s))
      k.quaternion.copy(roll.setFromAxisAngle(AZ, -turn * Math.PI / 2))
    }
    // the shackle: pops up while the key is turned, swivels open on its
    // long leg, swings back and drops shut, each on a spring
    const open = s >= T_TURN && s < T_SHUT + 0.3
    const swing = s >= T_TURN + 0.25 && s < T_SHUT
    const S = spring.current
    S.vy += ((open ? 1 : 0) - S.y) * 320 * d - S.vy * 13 * d
    S.y += S.vy * d
    S.va += ((swing ? 1 : 0) - S.a) * 110 * d - S.va * 7 * d
    S.a += S.va * d
    lift.current.position.y = ARCH_Y + Math.max(-0.02, S.y) * 0.21
    swivel.current.rotation.y = Math.max(-0.05, S.a) * 1.35
  })

  const metal = { roughness: 0.42, metalness: 0.3 }
  return (
    <group {...handlers} onClick={onClick}>
      <mesh geometry={geo.hit}>
        <meshBasicMaterial visible={false} />
      </mesh>
      <group position-x={-0.2} scale={1.3}>
        {/* the body: face plate, rivets, keyhole */}
        <mesh geometry={geo.body}>
          <Flat color={L.body} {...metal} />
        </mesh>
        <mesh geometry={geo.plate} position={[0, 0.08, D / 2]}>
          <Flat color={L.plate} {...metal} />
        </mesh>
        {[-1, 1].map((x) =>
          [-1, 1].map((y) => (
            <mesh key={`${x}${y}`} geometry={geo.rivet} position={[x * (W / 2 - 0.13), H / 2 + y * (H / 2 - 0.13), D / 2 + 0.02]}>
              <Flat color={L.shackle} {...metal} />
            </mesh>
          )),
        )}
        <mesh geometry={geo.hole} position={[0, KY + 0.02, D / 2 + 0.016]}>
          <Flat color={L.hole} />
        </mesh>
        <mesh geometry={geo.slot} position={[0, KY - 0.04, D / 2 + 0.016]}>
          <Flat color={L.hole} />
        </mesh>
        {/* the shackle: lifts, then swivels about its long (left) leg */}
        <group ref={lift} position-y={ARCH_Y}>
          <group ref={swivel} position-x={-R}>
            <group position-x={R}>
              <mesh geometry={geo.arch}>
                <Flat color={L.shackle} {...metal} />
              </mesh>
              <mesh geometry={geo.legLong} position-x={-R}>
                <Flat color={L.shackle} {...metal} />
              </mesh>
              <mesh geometry={geo.legShort} position-x={R}>
                <Flat color={L.shackle} {...metal} />
              </mesh>
            </group>
          </group>
        </group>
        {/* the key */}
        <group ref={key}>
          <mesh geometry={geo.bow} position-z={0.12}>
            <Flat color={L.key} {...metal} />
          </mesh>
          <mesh geometry={geo.collar}>
            <Flat color={L.key} {...metal} />
          </mesh>
          <mesh geometry={geo.shaft}>
            <Flat color={L.key} {...metal} />
          </mesh>
          {[-0.17, -0.235].map((z, i) => (
            <mesh key={z} geometry={geo.tooth} position={[0, -0.045 - i * 0.008, z]} scale={[1, 1 + i * 0.25, 1]}>
              <Flat color={L.key} {...metal} />
            </mesh>
          ))}
        </group>
        <Burst tap={pop} geometry={geo.spark} count={16} colors={['#fff3b0', '#ffffff', L.key]} speed={1.3} gravity={1.6} size={0.03} life={1.1} origin={[0, ARCH_Y + 0.25, 0]} up={1.1} />
      </group>
    </group>
  )
}

export default function LockKeyScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[2.6, 1.9, 4.0]} target={[0, 0.7, 0]} hint="The key hovers beside the padlock, bobbing and slowly turning · tap it and the key slides into the keyhole and turns, the shackle pops up and swings open with a sparkle, then locks again and the key floats back · Look swaps brass, silver, gold and red · drag to orbit">
      <LockKey {...props} />
    </Stage>
  )
}
