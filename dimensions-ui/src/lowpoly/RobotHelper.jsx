import { useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Burst, Flat, Stage, blinkAt, blob, facet, lookAround, useGeo, useTap } from './kit.jsx'

// The low-poly robot as an AI helper that shows what an agent is doing. It has three
// states: idle (looks around, antenna blinks slowly), thinking (nods its head, the chest
// lights race and the antenna blinks fast) and done (waves, happy eyes, sparks). Set
// `state` yourself, or turn on `cycle` and it walks through them. Tapping it still
// waves, whatever the state.

const LOOKS = {
  silver: { body: '#c4c9d2', trim: '#7d8594', dark: '#4a505c', screen: '#1d2230', glow: '#5ee6ff', tip: '#ff4a4a', base: '#8a909c' },
  orange: { body: '#f08a32', trim: '#4a4f5a', dark: '#3a3e48', screen: '#1d2230', glow: '#7dfcff', tip: '#ffd84a', base: '#5a5f6a' },
  mint: { body: '#7fd8b8', trim: '#3e6e73', dark: '#2f5559', screen: '#173033', glow: '#c8ff7a', tip: '#ff7aa8', base: '#4f8a86' },
  navy: { body: '#2f4a7a', trim: '#c9a24a', dark: '#1f2f4f', screen: '#0f1424', glow: '#ffd24a', tip: '#ff4a4a', base: '#3a4a66' },
}

const WAVE = 3.2 // seconds the wave lasts
const LEG = 0.34 // height of the hips above the base top
const BODY_Y = 0.06 + LEG // the body's foot
const BODY = [0.62, 0.56, 0.42]
const HEAD_Y = BODY_Y + BODY[1] + 0.07

const smooth = (a, b, x) => {
  const u = Math.max(0, Math.min(1, (x - a) / (b - a)))
  return u * u * (3 - 2 * u)
}

export function RobotHelper({ look = 'silver', state = 'idle' }) {
  const L = LOOKS[look] || LOOKS.silver
  const { tap, handlers, clock } = useTap(1)
  const head = useRef()
  const eyes = useRef([])
  const happy = useRef([])
  const mouth = useRef()
  const smile = useRef()
  const tipMat = useRef()
  const lamp = useRef()
  const arms = useRef([])
  const elbows = useRef([])
  const claws = useRef([])
  const lights = useRef([])
  const needle = useRef()
  const doneAt = useRef(-99)
  const prev = useRef(state)

  const geo = useGeo(
    () => ({
      base: facet(new THREE.CylinderGeometry(0.62, 0.68, 0.06, 10, 1).translate(0, 0.03, 0), 0.01, 1, [1, 0.3, 1]),
      foot: facet(new THREE.BoxGeometry(0.2, 0.09, 0.28).translate(0, 0.045, 0.03), 0.008, 2),
      leg: facet(new THREE.BoxGeometry(0.13, LEG, 0.14).translate(0, LEG / 2, 0), 0.006, 3),
      hip: facet(new THREE.BoxGeometry(0.44, 0.08, 0.28), 0.006, 4),
      body: facet(new THREE.BoxGeometry(...BODY, 2, 2, 2).translate(0, BODY[1] / 2, 0), 0.012, 5),
      panel: new THREE.BoxGeometry(0.36, 0.22, 0.03),
      light: new THREE.BoxGeometry(0.05, 0.05, 0.02),
      dial: new THREE.CylinderGeometry(0.055, 0.055, 0.02, 8, 1).rotateX(Math.PI / 2),
      needle: new THREE.BoxGeometry(0.008, 0.045, 0.01).translate(0, 0.02, 0),
      neck: new THREE.CylinderGeometry(0.08, 0.1, 0.09, 8, 1),
      head: facet(new THREE.BoxGeometry(0.52, 0.38, 0.4, 2, 2, 2).translate(0, 0.19, 0), 0.01, 6),
      screen: new THREE.BoxGeometry(0.42, 0.26, 0.02),
      ear: facet(new THREE.CylinderGeometry(0.07, 0.07, 0.05, 6, 1).rotateZ(Math.PI / 2), 0.004, 7),
      eye: new THREE.BoxGeometry(0.075, 0.09, 0.012),
      arc: new THREE.TorusGeometry(0.035, 0.011, 3, 8, Math.PI),
      bar: new THREE.BoxGeometry(0.1, 0.018, 0.012),
      smile: new THREE.TorusGeometry(0.05, 0.011, 3, 8, Math.PI).rotateZ(Math.PI),
      rod: new THREE.CylinderGeometry(0.012, 0.016, 0.22, 5, 1).translate(0, 0.11, 0),
      tip: blob(0.045, 8),
      shoulder: blob(0.075, 9),
      upper: facet(new THREE.BoxGeometry(0.1, 0.22, 0.11).translate(0, -0.11, 0), 0.005, 10),
      elbow: blob(0.055, 11, 0),
      fore: facet(new THREE.BoxGeometry(0.09, 0.2, 0.1).translate(0, -0.1, 0), 0.005, 12),
      wrist: new THREE.CylinderGeometry(0.05, 0.05, 0.04, 6, 1),
      prong: facet(new THREE.BoxGeometry(0.03, 0.09, 0.05).translate(0, -0.045, 0), 0.003, 13),
      spark: new THREE.OctahedronGeometry(1, 0),
      hit: new THREE.BoxGeometry(1.1, 1.75, 0.7).translate(0, 0.875, 0),
    }),
    [],
  )

  useFrame(() => {
    const t = clock.elapsedTime
    // entering "done" starts a wave; tapping starts one too
    if (prev.current !== state) {
      if (state === 'done') doneAt.current = t
      prev.current = state
    }
    const thinking = state === 'thinking'
    const s = state === 'done' ? t - doneAt.current : tap.since(t)
    const waving = s >= 0 && s < WAVE
    // how far into the wave: up, wave, back down
    const up = waving ? smooth(0, 0.45, s) * (1 - smooth(WAVE - 0.6, WAVE, s)) : 0
    // the head looks about, but turns to face you while it waves
    const look = lookAround(t, 0.7)
    head.current.rotation.y = (thinking ? Math.sin(t * 0.8) * 0.15 : look.yaw) * (1 - up)
    head.current.rotation.x = (thinking ? 0.1 + Math.sin(t * 3.2) * 0.16 : look.pitch) * (1 - up) - 0.08 * up
    head.current.rotation.z = Math.sin(s * 5) * 0.06 * up
    // eyes: blink, or happy arcs while waving
    const b = blinkAt(t, 3.4)
    eyes.current.forEach((e) => {
      if (!e) return
      e.visible = up < 0.3
      e.scale.y = b
    })
    happy.current.forEach((e) => e && (e.visible = up >= 0.3))
    mouth.current.visible = up < 0.3
    smile.current.visible = up >= 0.3
    // the antenna light: on, off, on, off... a little brighter when happy
    const on = (thinking ? t % 0.45 < 0.25 : t % 1.3 < 0.75) ? 1 + up * 0.5 : 0.12 + up * 0.5
    tipMat.current.emissiveIntensity = 1.6 * on
    lamp.current.intensity = 0.6 * on
    // chest lights chase one another; the dial needle ticks
    lights.current.forEach((m, i) => m && (m.material.emissiveIntensity = Math.floor(t * (thinking ? 8 : 3) + i) % 3 === 0 ? 1.4 : 0.2))
    needle.current.rotation.z = Math.sin(t * (thinking ? 6 : 1.7)) * 0.9 + up * Math.sin(t * 18) * 0.3
    // arms: the right one waves, the left swings a touch
    arms.current.forEach((a, i) => {
      if (!a) return
      const side = i ? 1 : -1
      const idle = 0.08 + Math.sin(t * 1.4 + i * 2) * 0.04
      if (side === 1) {
        a.rotation.z = idle + up * 2.55
        a.rotation.x = -0.15 * up
        const w = Math.sin((s - 0.45) * 9) * 0.55 * smooth(0.35, 0.6, s)
        elbows.current[i].rotation.z = up * (0.25 + w)
      } else {
        a.rotation.z = -idle - up * 0.15
        a.rotation.x = thinking ? -0.7 + Math.sin(t * 3.2) * 0.05 : Math.sin(t * 1.1) * 0.05
        elbows.current[i].rotation.z = thinking ? -0.9 : -0.15
      }
    })
    // claws open and close a little
    const pinch = 0.25 + 0.15 * Math.sin(t * 2.3) + up * 0.25
    claws.current.forEach((c, i) => c && (c.rotation.x = (i % 2 ? -1 : 1) * pinch))
  })

  return (
    <group {...handlers}>
      <mesh geometry={geo.hit}>
        <meshBasicMaterial visible={false} />
      </mesh>
      <mesh geometry={geo.base}>
        <Flat color={L.base} roughness={0.6} metalness={0.15} />
      </mesh>
      {/* legs and feet */}
      {[-1, 1].map((x) => (
        <group key={x} position={[x * 0.15, 0.06, 0]}>
          <mesh geometry={geo.foot}>
            <Flat color={L.dark} />
          </mesh>
          <mesh geometry={geo.leg}>
            <Flat color={L.trim} roughness={0.55} metalness={0.2} />
          </mesh>
        </group>
      ))}
      <mesh geometry={geo.hip} position-y={BODY_Y}>
        <Flat color={L.dark} />
      </mesh>
      {/* body and chest panel */}
      <group position-y={BODY_Y}>
        <mesh geometry={geo.body}>
          <Flat color={L.body} roughness={0.55} metalness={0.2} />
        </mesh>
        <group position={[0, BODY[1] * 0.52, BODY[2] / 2 + 0.01]}>
          <mesh geometry={geo.panel}>
            <Flat color={L.screen} />
          </mesh>
          {['#ff5a5a', '#ffd24a', '#5ee67a'].map((c, i) => (
            <mesh key={c} ref={(el) => (lights.current[i] = el)} geometry={geo.light} position={[-0.12 + i * 0.07, 0.04, 0.02]}>
              <meshStandardMaterial color={c} emissive={c} emissiveIntensity={0.5} flatShading />
            </mesh>
          ))}
          <mesh geometry={geo.dial} position={[0.1, -0.02, 0.016]}>
            <Flat color="#f2efe6" />
          </mesh>
          <mesh ref={needle} geometry={geo.needle} position={[0.1, -0.035, 0.03]}>
            <Flat color="#e2332b" />
          </mesh>
          {[0, 1, 2].map((i) => (
            <mesh key={i} geometry={geo.bar} position={[-0.07, -0.05 - i * 0.03, 0.017]} scale={[1, 0.8, 1]}>
              <Flat color={L.trim} />
            </mesh>
          ))}
        </group>
        {/* arms: shoulder, upper arm, elbow, forearm, claw */}
        {[-1, 1].map((side, i) => (
          <group key={side} ref={(el) => (arms.current[i] = el)} position={[side * (BODY[0] / 2 + 0.06), BODY[1] - 0.08, 0]}>
            <mesh geometry={geo.shoulder}>
              <Flat color={L.trim} roughness={0.5} metalness={0.25} />
            </mesh>
            <mesh geometry={geo.upper}>
              <Flat color={L.body} roughness={0.55} metalness={0.2} />
            </mesh>
            <group ref={(el) => (elbows.current[i] = el)} position-y={-0.23}>
              <mesh geometry={geo.elbow}>
                <Flat color={L.trim} roughness={0.5} metalness={0.25} />
              </mesh>
              <mesh geometry={geo.fore}>
                <Flat color={L.body} roughness={0.55} metalness={0.2} />
              </mesh>
              <group position-y={-0.21}>
                <mesh geometry={geo.wrist}>
                  <Flat color={L.dark} />
                </mesh>
                {[-1, 1].map((z, k) => (
                  <group key={z} ref={(el) => (claws.current[i * 2 + k] = el)} position={[0, -0.01, z * 0.03]}>
                    <mesh geometry={geo.prong}>
                      <Flat color={L.trim} roughness={0.5} metalness={0.25} />
                    </mesh>
                  </group>
                ))}
              </group>
            </group>
          </group>
        ))}
      </group>
      {/* neck and head */}
      <mesh geometry={geo.neck} position-y={HEAD_Y - 0.04}>
        <Flat color={L.dark} />
      </mesh>
      <group ref={head} position-y={HEAD_Y}>
        <mesh geometry={geo.head}>
          <Flat color={L.body} roughness={0.55} metalness={0.2} />
        </mesh>
        {[-1, 1].map((x) => (
          <mesh key={x} geometry={geo.ear} position={[x * 0.275, 0.2, 0]}>
            <Flat color={L.trim} roughness={0.5} metalness={0.25} />
          </mesh>
        ))}
        <group position={[0, 0.19, 0.205]}>
          <mesh geometry={geo.screen}>
            <meshStandardMaterial color={L.screen} roughness={0.25} metalness={0.1} flatShading />
          </mesh>
          {[-1, 1].map((x, i) => (
            <group key={x} position={[x * 0.1, 0.03, 0.014]}>
              <mesh ref={(el) => (eyes.current[i] = el)} geometry={geo.eye}>
                <meshStandardMaterial color={L.glow} emissive={L.glow} emissiveIntensity={1.2} flatShading />
              </mesh>
              <mesh ref={(el) => (happy.current[i] = el)} geometry={geo.arc} position-y={-0.015} visible={false}>
                <meshStandardMaterial color={L.glow} emissive={L.glow} emissiveIntensity={1.2} flatShading />
              </mesh>
            </group>
          ))}
          <mesh ref={mouth} geometry={geo.bar} position={[0, -0.07, 0.014]}>
            <meshStandardMaterial color={L.glow} emissive={L.glow} emissiveIntensity={1.2} flatShading />
          </mesh>
          <mesh ref={smile} geometry={geo.smile} position={[0, -0.045, 0.014]} visible={false}>
            <meshStandardMaterial color={L.glow} emissive={L.glow} emissiveIntensity={1.2} flatShading />
          </mesh>
        </group>
        {/* antenna with its glowing ball */}
        <group position={[0.08, 0.38, 0]}>
          <mesh geometry={geo.rod}>
            <Flat color={L.dark} />
          </mesh>
          <mesh geometry={geo.tip} position-y={0.25}>
            <meshStandardMaterial ref={tipMat} color={L.tip} emissive={L.tip} emissiveIntensity={1.6} flatShading roughness={0.4} />
          </mesh>
          <pointLight ref={lamp} color={L.tip} position-y={0.25} distance={1.2} decay={2} intensity={0.6} />
        </group>
      </group>
      <Burst tap={tap} geometry={geo.spark} count={14} colors={[L.glow, L.tip, '#ffffff']} speed={1.5} gravity={2.2} size={0.035} life={1.1} origin={[0.25, HEAD_Y + 0.35, 0.1]} up={1} spread={1} />
    </group>
  )
}

const CYCLE = ['idle', 'thinking', 'done']

export default function RobotHelperScene({ background, autoRotate, float, state = 'idle', cycle = true, ...props }) {
  const [i, setI] = useState(0)
  useEffect(() => {
    if (!cycle) return
    const t = setInterval(() => setI((n) => (n + 1) % CYCLE.length), 4200)
    return () => clearInterval(t)
  }, [cycle])
  const s = cycle ? CYCLE[i] : state
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[2.9, 2.0, 4.0]} target={[0, 0.85, 0]} hint="State picks idle, thinking or done · Cycle walks through all three by itself · idle looks around, thinking nods while the chest lights race, done waves with happy eyes and sparks · tap it to wave · drag to orbit">
      <RobotHelper {...props} state={s} />
    </Stage>
  )
}
