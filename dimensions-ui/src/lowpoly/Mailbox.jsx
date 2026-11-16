import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Burst, Flat, Hinge, Stage, facet, swayAngle, useGeo, useTap, wobble } from './kit.jsx'

// A low-poly roadside mailbox on a wooden post: a box with an arched top,
// a door at the front hinged at its foot, and a flag on the side. Left
// alone, the flag twitches as if a breeze catches it. Tap it and the door
// drops open, a letter pops out, flips and floats down, the flag swings up
// to say there's mail, and after a moment the door snaps shut again.

const LOOKS = {
  classic: { box: '#b9bec6', door: '#a9aeb7', flag: '#e2332b', post: '#8a5a36', letter: '#fbf8f0', stamp: '#e2332b' },
  blue: { box: '#2e5fa8', door: '#28539a', flag: '#f2c230', post: '#6e4a30', letter: '#fbf8f0', stamp: '#2e5fa8' },
  black: { box: '#2a2b30', door: '#232428', flag: '#e2332b', post: '#5d4330', letter: '#fbf8f0', stamp: '#e2332b' },
  red: { box: '#c8352c', door: '#b42f27', flag: '#f4f1e8', post: '#8a5a36', letter: '#fbf8f0', stamp: '#2e5fa8' },
}

const W = 0.5 // box width (x)
const H = 0.36 // height of the straight sides
const D = 1.0 // depth, front to back (z)
const POST_H = 0.95
const OPEN = 1.8 // seconds the door stays open

// The box's end profile: straight sides and a round arch, in x/y.
function profile(w, h) {
  const s = new THREE.Shape()
  s.moveTo(-w / 2, 0)
  s.lineTo(w / 2, 0)
  s.lineTo(w / 2, h)
  s.absarc(0, h, w / 2, 0, Math.PI, false)
  s.lineTo(-w / 2, 0)
  return s
}

export function Mailbox({ look = 'classic' }) {
  const L = LOOKS[look] || LOOKS.classic
  const { tap, handlers, clock } = useTap(1.5)
  const flag = useRef()
  const letter = useRef()
  const geo = useGeo(() => {
    // the box: the profile drawn out from back to front
    const box = new THREE.ExtrudeGeometry(profile(W, H), { depth: D, bevelEnabled: false, curveSegments: 5 })
    box.translate(0, 0, -D / 2)
    // the door: the same profile, a thin plate
    const door = new THREE.ExtrudeGeometry(profile(W + 0.03, H + 0.015), { depth: 0.04, bevelEnabled: false, curveSegments: 5 })
    return {
      box: facet(box, 0.006, 2),
      door: facet(door, 0.004, 3),
      handle: new THREE.BoxGeometry(0.1, 0.035, 0.05),
      post: facet(new THREE.BoxGeometry(0.17, POST_H, 0.17), 0.01, 4),
      plank: facet(new THREE.BoxGeometry(0.34, 0.06, 0.8), 0.008, 5),
      flagPole: new THREE.BoxGeometry(0.035, 0.42, 0.025),
      flag: new THREE.BoxGeometry(0.03, 0.14, 0.2),
      letter: new THREE.BoxGeometry(0.3, 0.012, 0.2),
      stamp: new THREE.BoxGeometry(0.05, 0.014, 0.05),
      bit: new THREE.TetrahedronGeometry(1, 0),
    }
  }, [])
  const open = () => {
    const s = tap.since(clock.elapsedTime)
    return s >= 0 && s < OPEN
  }
  // the letter's flight: up and out of the door, flipping, then fluttering down
  const out = useMemo(() => new THREE.Vector3(0, POST_H + 0.25, D / 2 + 0.05), [])

  useFrame(() => {
    const t = clock.elapsedTime
    const s = tap.since(t)
    // the flag: twitches in the breeze; swings up when the mail arrives
    const up = s >= 0.15 && s < OPEN + 1.2 ? 1 : 0
    // down: lying back along the side; up: standing straight
    const target = up ? 0 : -Math.PI / 2 + 0.05
    const twitch = swayAngle(t, 0, { rate: 0.7, amp: 0.06 }) + (Math.sin(t * 2.9) > 0.97 ? 0.08 : 0)
    flag.current.rotation.x += (target + twitch + wobble(s - 0.15, 16, 4) * 0.15 * up - flag.current.rotation.x) * 0.18
    // the letter
    const m = letter.current
    m.visible = s >= 0.12 && s < 2.4
    if (m.visible) {
      const u = s - 0.12
      m.position.set(Math.sin(u * 3) * 0.12, out.y + u * 2.0 - u * u * 1.4, out.z + u * 0.9)
      m.rotation.set(-0.4 + u * 5.2, Math.sin(u * 4) * 0.4, Math.sin(u * 6) * 0.3)
      const fade = Math.min(1, (2.4 - s) / 0.4)
      m.scale.setScalar(Math.max(0.001, Math.min(1, u * 6) * fade))
    }
  })

  return (
    <group {...handlers}>
      {/* the post, and a plank on top that the box sits on */}
      <mesh geometry={geo.post} position-y={POST_H / 2}>
        <Flat color={L.post} />
      </mesh>
      <mesh geometry={geo.plank} position-y={POST_H + 0.03}>
        <Flat color={L.post} />
      </mesh>
      <group position-y={POST_H + 0.06}>
        <mesh geometry={geo.box}>
          <Flat color={L.box} roughness={0.5} metalness={0.25} />
        </mesh>
        {/* the door, hinged along its foot at the front */}
        <Hinge open={open} angle={1.5} axis="x" stiffness={120} damping={9} position={[0, 0, D / 2]}>
          <mesh geometry={geo.door} position-x={0}>
            <Flat color={L.door} roughness={0.5} metalness={0.25} />
          </mesh>
          <mesh geometry={geo.handle} position={[0, H + 0.12, 0.06]}>
            <Flat color="#2a2b30" />
          </mesh>
        </Hinge>
        {/* the flag on the right side, pivoting at its foot */}
        <group ref={flag} position={[W / 2 + 0.03, 0.1, -0.12]}>
          <mesh geometry={geo.flagPole} position-y={0.21}>
            <Flat color={L.flag} />
          </mesh>
          <mesh geometry={geo.flag} position={[0, 0.36, 0.1]}>
            <Flat color={L.flag} />
          </mesh>
        </group>
      </group>
      {/* the letter */}
      <group ref={letter} visible={false}>
        <mesh geometry={geo.letter}>
          <Flat color={L.letter} roughness={0.9} />
        </mesh>
        <mesh geometry={geo.stamp} position={[0.1, 0.002, -0.05]}>
          <Flat color={L.stamp} />
        </mesh>
      </group>
      <Burst tap={tap} geometry={geo.bit} count={8} colors={[L.flag, L.letter, '#ffd24a']} speed={1.4} gravity={2.5} size={0.04} life={0.9} origin={[0, POST_H + 0.3, D / 2 + 0.1]} spread={0.8} />
    </group>
  )
}

export default function MailboxScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[3.3, 2.3, 3.6]} target={[0, 0.9, 0]} hint="The flag twitches in the breeze on its own · tap the mailbox and the door drops open, a letter pops out and the flag goes up · Look swaps classic, blue, black and red · drag to orbit">
      <Mailbox {...props} />
    </Stage>
  )
}
