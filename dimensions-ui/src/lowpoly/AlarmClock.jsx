import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Flat, Ripple, Stage, TAU, facet, useGeo, useTap, wobble } from './kit.jsx'

// A low-poly twin-bell alarm clock: a short faceted drum with a cream face,
// twelve tick marks and three hands, two domed bells on top with a little
// hammer on a post between them, a carry handle arching over the back and
// two splayed feet. Left alone it ticks: the second hand steps round a
// notch at a time with a little bounce, and every ten seconds the minute
// hand clicks on a notch too. Tap it and it rings: the hammer rattles
// between the bells, the whole clock judders and hops in place, settling
// with a damped wobble, and ring lines and a floor ripple pulse out.

const LOOKS = {
  red: { body: '#d8362f', bell: '#e04a40', metal: '#cfd2d8', face: '#f7f0dc', hand: '#24222a', second: '#e2332b', ring: '#2b2838' },
  mint: { body: '#7fd6b9', bell: '#8fe0c4', metal: '#d6d9df', face: '#fbf7ea', hand: '#24323a', second: '#e2532b', ring: '#2b2838' },
  yellow: { body: '#f6c431', bell: '#f9cf4a', metal: '#d6d9df', face: '#fffaf0', hand: '#2a2520', second: '#e2332b', ring: '#2b2838' },
  black: { body: '#2a2a30', bell: '#34343c', metal: '#bfc3ca', face: '#f4efe2', hand: '#1b1a20', second: '#e2332b', ring: '#2b2838' },
}

const R = 0.52 // drum radius
const DEPTH = 0.34 // drum depth, front to back
const CY = 0.8 // drum centre height
const RING = 2 // seconds it rings for
const BELL_A = 0.55 // bells lean out from the top by this angle
const BELL_D = R + 0.08 // bell distance from the drum centre

// a hand: a tapered blade from the pivot out along +y
function handGeo(len, w) {
  const s = new THREE.Shape()
  s.moveTo(-w / 2, -len * 0.14)
  s.lineTo(w / 2, -len * 0.14)
  s.lineTo(w * 0.3, len)
  s.lineTo(-w * 0.3, len)
  s.closePath()
  return new THREE.ExtrudeGeometry(s, { depth: 0.012, bevelEnabled: false })
}

// a tick of a hand: steps on a beat, with a small overshoot as it lands
const tick = (x) => {
  const n = Math.floor(x)
  const f = x - n
  return n + (f < 0.12 ? 1 - Math.exp(-f * 40) * Math.cos(f * 60) : 1) - 1
}

export function AlarmClock({ look = 'red' }) {
  const L = LOOKS[look] || LOOKS.red
  const { tap, handlers, clock } = useTap(1.2)
  const root = useRef()
  const hammer = useRef()
  const hour = useRef()
  const minute = useRef()
  const second = useRef()
  const lines = useRef([])
  const geo = useGeo(
    () => ({
      drum: facet(new THREE.CylinderGeometry(R, R, DEPTH, 14, 1).rotateX(Math.PI / 2), 0.012, 2),
      back: new THREE.CylinderGeometry(R * 0.82, R * 0.82, 0.04, 14).rotateX(Math.PI / 2),
      face: new THREE.CylinderGeometry(R - 0.07, R - 0.07, 0.02, 14).rotateX(Math.PI / 2),
      bezel: facet(new THREE.TorusGeometry(R - 0.04, 0.045, 4, 14), 0.006, 3),
      tickBig: new THREE.BoxGeometry(0.03, 0.08, 0.012),
      tickSmall: new THREE.BoxGeometry(0.018, 0.04, 0.012),
      hour: handGeo(0.22, 0.05),
      minute: handGeo(0.33, 0.04),
      second: handGeo(0.36, 0.014),
      cap: new THREE.CylinderGeometry(0.035, 0.035, 0.04, 8).rotateX(Math.PI / 2),
      bell: facet(new THREE.SphereGeometry(0.24, 9, 4, 0, TAU, 0, Math.PI / 2), 0.008, 4),
      bellKnob: new THREE.CylinderGeometry(0.03, 0.04, 0.06, 6),
      stem: new THREE.CylinderGeometry(0.025, 0.025, 0.14, 6),
      post: new THREE.CylinderGeometry(0.025, 0.035, 0.08, 6),
      arm: new THREE.CylinderGeometry(0.014, 0.014, 0.2, 5).translate(0, 0.1, 0),
      ball: new THREE.IcosahedronGeometry(0.05, 0),
      handle: facet(new THREE.TorusGeometry(0.34, 0.03, 4, 12, Math.PI), 0.004, 5),
      knob: new THREE.CylinderGeometry(0.05, 0.05, 0.06, 6).rotateX(Math.PI / 2),
      foot: facet(new THREE.CylinderGeometry(0.045, 0.06, 0.36, 6), 0.005, 6),
      toe: new THREE.IcosahedronGeometry(0.07, 0),
      line: new THREE.BoxGeometry(0.02, 0.11, 0.02),
    }),
    [],
  )

  useFrame(() => {
    const t = clock.elapsedTime
    // idle: tick tock, starting from ten past ten
    const sec = tick(t)
    second.current.rotation.z = -(sec / 60) * TAU
    const min = 10 + tick(t / 10)
    minute.current.rotation.z = -(min / 60) * TAU
    hour.current.rotation.z = -((10 + min / 60) / 12) * TAU

    // the ring: the hammer rattles, the clock judders and hops
    const s = tap.since(t)
    const ringing = s >= 0 && s < RING
    hammer.current.rotation.z = ringing ? 0.62 * Math.sin(s * 72) : 0
    const shake = wobble(s, 42, 1.3)
    const hop = s >= 0 ? Math.abs(Math.sin(s * 30)) * 0.035 * Math.exp(-1.3 * s) : 0
    root.current.rotation.z = shake * 0.07
    root.current.rotation.y = wobble(s, 31, 1.3) * 0.05
    root.current.position.set(wobble(s, 37, 1.3) * 0.02, hop, 0)

    // ring lines fly out from each bell while it rings
    lines.current.forEach((m, i) => {
      if (!m) return
      const u = (s * 3.2 + (i % 3) * 0.33) % 1
      m.visible = ringing
      if (!ringing) return
      const k = 1 - u
      m.position.y = 0.3 + u * 0.22
      m.scale.set(1, Math.max(0.01, k), 1)
    })
  })

  const bellPos = (s) => [s * Math.sin(BELL_A) * BELL_D, Math.cos(BELL_A) * BELL_D, 0]

  return (
    <group {...handlers}>
      <group ref={root}>
        {/* feet: two short splayed legs under the drum */}
        {[-1, 1].map((s) => (
          <group key={s} position={[s * 0.32, 0.2, 0]} rotation-z={s * 0.3}>
            <mesh geometry={geo.foot}>
              <Flat color={L.metal} roughness={0.4} metalness={0.4} />
            </mesh>
            <mesh geometry={geo.toe} position-y={-0.17}>
              <Flat color={L.body} />
            </mesh>
          </group>
        ))}
        <group position-y={CY}>
          {/* the drum, its back plate and winding knob */}
          <mesh geometry={geo.drum}>
            <Flat color={L.body} roughness={0.45} metalness={0.1} />
          </mesh>
          <mesh geometry={geo.back} position-z={-DEPTH / 2 - 0.02}>
            <Flat color={L.metal} roughness={0.4} metalness={0.4} />
          </mesh>
          <mesh geometry={geo.knob} position-z={-DEPTH / 2 - 0.07}>
            <Flat color={L.metal} roughness={0.4} metalness={0.4} />
          </mesh>
          {/* the face: bezel, cream dial, ticks, hands */}
          <mesh geometry={geo.bezel} position-z={DEPTH / 2}>
            <Flat color={L.metal} roughness={0.35} metalness={0.5} />
          </mesh>
          <mesh geometry={geo.face} position-z={DEPTH / 2}>
            <Flat color={L.face} roughness={0.7} />
          </mesh>
          {Array.from({ length: 12 }, (_, i) => {
            const a = (i / 12) * TAU
            const big = i % 3 === 0
            const r = big ? R - 0.15 : R - 0.13
            return <mesh key={i} geometry={big ? geo.tickBig : geo.tickSmall} position={[Math.sin(a) * r, Math.cos(a) * r, DEPTH / 2 + 0.014]} rotation-z={-a}>
              <Flat color={L.hand} />
            </mesh>
          })}
          <group position-z={DEPTH / 2 + 0.012}>
            <group ref={hour}>
              <mesh geometry={geo.hour}>
                <Flat color={L.hand} />
              </mesh>
            </group>
            <group ref={minute} position-z={0.014}>
              <mesh geometry={geo.minute}>
                <Flat color={L.hand} />
              </mesh>
            </group>
            <group ref={second} position-z={0.028}>
              <mesh geometry={geo.second}>
                <Flat color={L.second} />
              </mesh>
            </group>
            <mesh geometry={geo.cap} position-z={0.03}>
              <Flat color={L.second} />
            </mesh>
          </group>
          {/* two bells leaning out from the top, on short stems */}
          {[-1, 1].map((s) => (
            <group key={s} position={bellPos(s)} rotation-z={-s * BELL_A}>
              <mesh geometry={geo.stem} position-y={-0.05}>
                <Flat color={L.metal} roughness={0.4} metalness={0.4} />
              </mesh>
              <mesh geometry={geo.bell}>
                <Flat color={L.bell} roughness={0.35} metalness={0.25} side={THREE.DoubleSide} />
              </mesh>
              <mesh geometry={geo.bellKnob} position-y={0.25}>
                <Flat color={L.metal} roughness={0.4} metalness={0.4} />
              </mesh>
              {/* ring lines, shown while it rings */}
              {[-0.55, 0, 0.55].map((a, j) => (
                <group key={j} rotation-z={a}>
                  <mesh ref={(el) => (lines.current[(s + 1) * 1.5 + j] = el)} geometry={geo.line} visible={false}>
                    <meshBasicMaterial color={L.ring} />
                  </mesh>
                </group>
              ))}
            </group>
          ))}
          {/* the hammer on its post between the bells */}
          <mesh geometry={geo.post} position-y={R + 0.02}>
            <Flat color={L.metal} roughness={0.4} metalness={0.4} />
          </mesh>
          <group ref={hammer} position-y={R + 0.05}>
            <mesh geometry={geo.arm}>
              <Flat color={L.metal} roughness={0.4} metalness={0.4} />
            </mesh>
            <mesh geometry={geo.ball} position-y={0.21}>
              <Flat color={L.metal} roughness={0.35} metalness={0.5} />
            </mesh>
          </group>
          {/* the carry handle arching over the back */}
          <mesh geometry={geo.handle} position={[0, R - 0.04, -0.11]}>
            <Flat color={L.metal} roughness={0.4} metalness={0.4} />
          </mesh>
        </group>
      </group>
      <Ripple tap={tap} color={L.body} radius={1.6} count={3} />
    </group>
  )
}

export default function AlarmClockScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[2.6, 2, 4.2]} target={[0, 0.85, 0]} hint="The hands tick round on their own · tap the clock to set it ringing: the hammer rattles between the bells and the clock judders and hops · Look swaps red, mint, yellow and black · drag to orbit">
      <AlarmClock {...props} />
    </Stage>
  )
}
