import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useCursor } from '@react-three/drei'
import * as THREE from 'three'
import { Flat, Stage, TAU, blob, cone, facet, useGeo } from './kit.jsx'

// A low-poly fairground Ferris wheel with a working mechanism and real
// physics. Two A-frames carry an axle and a wide hub; two polygonal rims,
// held by tension spokes and tied by cross braces, carry twelve gondolas on
// pivot pins. Rubber tyre drives press up on the bottom of each rim and turn
// it, as on real wheels.
//
// The physics, in SI units for a 20 m wheel (shown at 0.12 units a metre):
// - The wheel is a rigid rotor: I dw/dt = motor + gravity + friction (+ brake).
//   Its inertia is the structure plus every gondola and rider at the rim.
// - Each gondola and its riders is a point mass at the rim, so an uneven
//   load makes a gravity torque  -sum(m g R cos(angle)).
// - The drive is speed-governed: a ramped speed reference, PI control with
//   load feed-forward and anti-windup, and a torque limit, so it soft-starts
//   without overshooting and holds speed under any load.
// - The brake is a friction brake: it stops the wheel at a set torque and
//   then holds it, unless the load torque is bigger than the brake.
// - Coasting, only the bearings resist, so a loaded wheel rocks like a
//   pendulum until its heavy side settles at the bottom.
// - Each gondola is a damped pendulum hung from a pivot that accelerates
//   with the rim, so it swings back when the wheel starts and forward when it
//   brakes, then settles.
// Tap a gondola to put a rider in (up to four, then it empties).

const N = 12 // gondolas
const R_SI = 10 // rim radius, m
const L_SI = 1.5 // pivot to gondola centre of mass, m
const G = 9.81
const I_STRUCT = 1.5e6 // rim, spokes and hub, kg m^2
const M_GONDOLA = 300 // empty gondola, kg
const M_RIDER = 75 // kg
const T_MOTOR = 60e3 // drive torque limit, N m
const T_BRAKE = 120e3 // brake torque, N m
const C_VISC = 4e3 // bearing viscous friction, N m s
const C_COUL = 1.5e3 // bearing dry friction, N m
const C_SWING = 0.12 // gondola pivot damping, 1/s
const KP = 2.5 // governor gains, per second (tuned offline: 2% overshoot)
const KI = 0.3
const RAMP = 0.02 // speed reference ramp, rad/s^2, as a drive's soft start
const STEP = 1 / 240

const SCALE = 0.12 // units per metre
const R = R_SI * SCALE // 1.2
const HUB_Y = R + 0.36
const RIM_Z = 0.2

const PALETTES = {
  carnival: ['#e3393f', '#f28c38', '#f6c93a', '#5cc25e', '#3d8de0', '#7a55c8'],
  pastel: ['#f5a3a8', '#f8c79a', '#f9e49c', '#b2e3a6', '#a7c8f2', '#c6b2ec'],
  classic: ['#d8383f', '#f4f1ea'],
  night: ['#2f6fd0', '#8350c8', '#2fa59a', '#e3393f'],
}
const FRAME = { carnival: '#f4f1ea', pastel: '#ffffff', classic: '#2f5d7a', night: '#2c2a3a' }
const PRESETS = { empty: () => 0, random: (i) => [2, 0, 4, 1, 0, 3, 0, 2, 1, 0, 4, 0][i], full: () => 4 }

// a box that spans from a to b
function strut(a, b, w) {
  const A = new THREE.Vector3(...a)
  const B = new THREE.Vector3(...b)
  const d = B.clone().sub(A)
  return {
    position: A.clone().add(B).multiplyScalar(0.5).toArray(),
    quaternion: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()),
    scale: [w, d.length(), w],
  }
}

function Gondola({ i, geo, color, frame, riders, onTap, set }) {
  const [hover, setHover] = useState(false)
  useCursor(hover)
  const a = (i / N) * TAU
  return (
    <group position={[Math.cos(a) * R, Math.sin(a) * R, 0]}>
      <group
        ref={set}
        onClick={(e) => {
          e.stopPropagation()
          onTap(i)
        }}
        onPointerOver={(e) => (e.stopPropagation(), setHover(true))}
        onPointerOut={() => setHover(false)}
      >
        <mesh geometry={geo.pin}>
          <Flat color="#3a3846" metalness={0.4} roughness={0.5} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} geometry={geo.hanger} position={[0, -0.05, s * 0.06]}>
            <Flat color={frame} />
          </mesh>
        ))}
        <mesh geometry={geo.roof} position-y={-0.1}>
          <Flat color={color} />
        </mesh>
        <mesh geometry={geo.floor} position-y={-0.255}>
          <Flat color={color} />
        </mesh>
        <mesh geometry={geo.wall} position-y={-0.225}>
          <Flat color={color} />
        </mesh>
        {[
          [-1, -1],
          [-1, 1],
          [1, -1],
          [1, 1],
        ].map(([x, z]) => (
          <mesh key={`${x}${z}`} geometry={geo.post} position={[x * 0.07, -0.18, z * 0.065]}>
            <Flat color={frame} />
          </mesh>
        ))}
        {Array.from({ length: riders }, (_, k) => (
          <group key={k} position={[(k % 2 ? 1 : -1) * 0.035, -0.19, (k < 2 ? 1 : -1) * 0.03]}>
            <mesh geometry={geo.head}>
              <Flat color={['#f3c3a1', '#c98e66', '#e9b795', '#8a5a3a'][(i + k) % 4]} />
            </mesh>
            <mesh geometry={geo.torso} position-y={-0.035}>
              <Flat color={['#3d7fe0', '#e3393f', '#2fa59a', '#f2c23a'][(i * 3 + k) % 4]} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  )
}

export function FerrisWheel({ drive = 'run', speed = 2.5, load = 'random', timeScale = 1, palette = 'carnival', lights = true, tele }) {
  const P = PALETTES[palette] || PALETTES.carnival
  const frame = FRAME[palette] || FRAME.carnival
  const clock = useThree((s) => s.clock)
  const wheel = useRef()
  const gondolas = useRef([])
  const tyres = useRef([])
  const bulbs = useRef([])
  const [riders, setRiders] = useState(() => Array.from({ length: N }, (_, i) => (PRESETS[load] || PRESETS.random)(i)))
  const sim = useRef({ th: 0, w: 0, integ: 0, ref: 0, phi: new Float32Array(N), dphi: new Float32Array(N), riders })
  sim.current.riders = riders

  useEffect(() => setRiders(Array.from({ length: N }, (_, i) => (PRESETS[load] || PRESETS.random)(i))), [load])

  const onTap = (i) => {
    setRiders((r) => r.map((n, k) => (k === i ? (n + 1) % 5 : n)))
    sim.current.dphi[i] += 0.35 // the cabin rocks as someone steps in
  }

  const geo = useGeo(
    () => ({
      ground: facet(new THREE.CylinderGeometry(1.65, 1.7, 0.06, 14, 1).translate(0, 0.03, 0), 0.02, 1, [1, 0.3, 1]),
      leg: new THREE.BoxGeometry(1, 1, 1),
      foot: new THREE.BoxGeometry(0.14, 0.05, 0.14),
      axle: new THREE.CylinderGeometry(0.035, 0.035, 0.76, 8, 1).rotateX(Math.PI / 2),
      hub: new THREE.CylinderGeometry(0.1, 0.1, RIM_Z * 2 + 0.06, 10, 1).rotateX(Math.PI / 2),
      flange: new THREE.CylinderGeometry(0.15, 0.15, 0.02, 10, 1).rotateX(Math.PI / 2),
      rim: new THREE.TorusGeometry(R, 0.022, 4, N * 2),
      inner: new THREE.TorusGeometry(R * 0.82, 0.012, 4, N * 2),
      spoke: new THREE.BoxGeometry(0.012, R - 0.13, 0.012).translate(0, (R + 0.13) / 2, 0),
      brace: new THREE.BoxGeometry(0.018, 0.018, RIM_Z * 2),
      bulb: new THREE.OctahedronGeometry(0.018, 0),
      pin: new THREE.CylinderGeometry(0.012, 0.012, 0.16, 6, 1).rotateX(Math.PI / 2),
      hanger: new THREE.BoxGeometry(0.012, 0.1, 0.012),
      roof: cone(0.12, 0.07, 4, 3).rotateY(Math.PI / 4),
      floor: new THREE.BoxGeometry(0.16, 0.025, 0.15),
      wall: new THREE.BoxGeometry(0.162, 0.05, 0.152),
      post: new THREE.BoxGeometry(0.012, 0.15, 0.012),
      head: blob(0.018, 4, 0),
      torso: new THREE.BoxGeometry(0.03, 0.035, 0.022),
      tyre: new THREE.CylinderGeometry(0.05, 0.05, 0.035, 10, 1).rotateX(Math.PI / 2),
      motor: facet(new THREE.BoxGeometry(0.3, 0.17, 0.09), 0.004, 5),
      plat: facet(new THREE.BoxGeometry(0.6, 0.06, 0.5), 0.004, 6),
      step: new THREE.BoxGeometry(0.3, 0.03, 0.09),
      rail: new THREE.BoxGeometry(0.012, 0.12, 0.012),
    }),
    [],
  )

  // the two A-frames: each a pair of legs from the ground to the hub, a tie
  const legs = useMemo(() => {
    const out = []
    for (const z of [-0.36, 0.36]) {
      const top = [0, HUB_Y, z * 0.92]
      out.push(strut([-0.82, 0.06, z * 1.15], top, 0.05), strut([0.82, 0.06, z * 1.15], top, 0.05), strut([-0.42, 0.75, z * 1.06], [0.42, 0.75, z * 1.06], 0.03))
    }
    return out
  }, [])

  useFrame((_, dtRaw) => {
    const S = sim.current
    const w0 = (speed * TAU) / 60
    const dt = Math.min(dtRaw, 0.05) * timeScale
    if (!(dt > 0)) return // the first frame can have no time step
    const n = Math.max(1, Math.ceil(dt / STEP))
    const h = dt / n
    const mass = S.riders.map((r) => M_GONDOLA + r * M_RIDER)
    let I = I_STRUCT
    for (const m of mass) I += m * R_SI * R_SI
    let tm = 0
    let tg = 0
    for (let k = 0; k < n; k++) {
      tg = 0
      for (let i = 0; i < N; i++) tg -= mass[i] * G * R_SI * Math.cos(S.th + (i / N) * TAU)
      const fr = -C_VISC * S.w - C_COUL * Math.tanh(S.w / 0.002)
      if (drive === 'run') {
        S.ref += Math.max(-RAMP * h, Math.min(RAMP * h, w0 - S.ref))
        const e = S.ref - S.w
        const raw = I * (KP * e + KI * S.integ) - tg - fr
        tm = Math.max(-T_MOTOR, Math.min(T_MOTOR, raw))
        if (raw === tm) S.integ += e * h // no wind-up while the torque is limited
      } else {
        S.integ = 0
        S.ref = S.w // a restart ramps up from wherever the wheel is
        tm = 0
      }
      const net = tm + tg + fr
      const w1 = S.w
      if (drive === 'brake') {
        if (Math.abs(S.w) > 1e-5) {
          const wn = S.w + ((net - Math.sign(S.w) * T_BRAKE) / I) * h
          S.w = Math.sign(wn) !== Math.sign(S.w) ? 0 : wn
        } else if (Math.abs(net) > T_BRAKE) S.w += ((net - Math.sign(net) * T_BRAKE) / I) * h
        else S.w = 0
      } else S.w += (net / I) * h
      const al = (S.w - w1) / h
      S.th += S.w * h
      // each gondola: a damped pendulum on an accelerating pivot
      for (let i = 0; i < N; i++) {
        const a = S.th + (i / N) * TAU
        const c = Math.cos(a)
        const s = Math.sin(a)
        const ax = -S.w * S.w * R_SI * c - al * R_SI * s
        const ay = -S.w * S.w * R_SI * s + al * R_SI * c
        const p = S.phi[i]
        S.dphi[i] += (-((G + ay) * Math.sin(p) + ax * Math.cos(p)) / L_SI - C_SWING * S.dphi[i]) * h
        S.phi[i] += S.dphi[i] * h
      }
    }

    wheel.current.rotation.z = S.th
    gondolas.current.forEach((g, i) => g && (g.rotation.z = S.phi[i] - S.th))
    // the tyres roll on the rim: opposite way, faster by the ratio of radii
    tyres.current.forEach((t) => t && (t.rotation.z = -(S.th * R) / 0.05))
    const t = clock.elapsedTime
    bulbs.current.forEach((b, k) => {
      if (!b) return
      const chase = 0.5 + 0.5 * Math.sin(k * 0.8 - t * 5)
      b.material.emissiveIntensity = lights ? 0.3 + chase * 1.6 : 0
    })
    if (tele) {
      const T = tele.current
      T.rpm = (S.w * 60) / TAU
      T.motor = tm / 1000
      T.load = tg / 1000
      T.riders = S.riders.reduce((a, b) => a + b, 0)
      T.mode = drive === 'run' ? 'drive on' : drive === 'brake' ? 'brake on' : 'coasting'
      T.swing = (Math.max(...S.phi.map(Math.abs)) * 180) / Math.PI
    }
  })

  return (
    <group>
      <mesh geometry={geo.ground}>
        <Flat color="#b9b4ab" />
      </mesh>

      {/* A-frames, axle and the drive house with its tyres */}
      {legs.map((l, i) => (
        <mesh key={i} geometry={geo.leg} position={l.position} quaternion={l.quaternion} scale={l.scale}>
          <Flat color={frame} />
        </mesh>
      ))}
      {[-1, 1].map((x) =>
        [-1, 1].map((z) => (
          <mesh key={`${x}${z}`} geometry={geo.foot} position={[x * 0.82, 0.085, z * 0.414]}>
            <Flat color="#6e6b68" />
          </mesh>
        )),
      )}
      <mesh geometry={geo.axle} position-y={HUB_Y}>
        <Flat color="#3a3846" metalness={0.4} roughness={0.5} />
      </mesh>
      {/* a drive unit under each rim, clear of the gondolas between them */}
      {[-1, 1].map((z) => (
        <mesh key={z} geometry={geo.motor} position={[0, 0.145, z * RIM_Z]}>
          <Flat color="#4a5568" />
        </mesh>
      ))}
      {[-1, 1].map((z) =>
        [-1, 1].map((x) => (
          <mesh key={`${x}${z}`} ref={(el) => (tyres.current[(z + 1) + (x + 1) / 2] = el)} geometry={geo.tyre} position={[x * 0.075, HUB_Y - R - 0.072, z * RIM_Z]}>
            <Flat color="#22222a" roughness={0.9} />
          </mesh>
        )),
      )}

      {/* boarding platform with steps */}
      <group position={[0, 0.06, 0.62]}>
        <mesh geometry={geo.plat} position-y={0.03}>
          <Flat color="#c9643f" />
        </mesh>
        {[0, 1].map((k) => (
          <mesh key={k} geometry={geo.step} position={[0, 0.0 + k * 0.03 - 0.02, 0.29 + (1 - k) * 0.09]}>
            <Flat color="#b5532f" />
          </mesh>
        ))}
        {[-0.28, 0.28].map((x) => (
          <mesh key={x} geometry={geo.rail} position={[x, 0.12, 0]}>
            <Flat color={frame} />
          </mesh>
        ))}
      </group>

      {/* the turning wheel */}
      <group ref={wheel} position-y={HUB_Y}>
        <mesh geometry={geo.hub}>
          <Flat color="#3a3846" metalness={0.4} roughness={0.5} />
        </mesh>
        {[-1, 1].map((z) => (
          <group key={z} position-z={z * RIM_Z}>
            <mesh geometry={geo.flange}>
              <Flat color={frame} />
            </mesh>
            <mesh geometry={geo.rim}>
              <Flat color={frame} />
            </mesh>
            <mesh geometry={geo.inner}>
              <Flat color={frame} />
            </mesh>
            {Array.from({ length: N * 2 }, (_, k) => (
              <mesh key={k} geometry={geo.spoke} rotation-z={(k / (N * 2)) * TAU - Math.PI / 2}>
                <Flat color={frame} />
              </mesh>
            ))}
            {Array.from({ length: N * 2 }, (_, k) => {
              const a = ((k + 0.5) / (N * 2)) * TAU
              return (
                <mesh key={`b${k}`} ref={(el) => (bulbs.current[(z + 1) * N + k] = el)} geometry={geo.bulb} position={[Math.cos(a) * (R + 0.03), Math.sin(a) * (R + 0.03), z * 0.01]}>
                  <Flat color="#fff1b0" emissive="#ffc84a" emissiveIntensity={0} />
                </mesh>
              )
            })}
          </group>
        ))}
        {Array.from({ length: N * 2 }, (_, k) => {
          const a = (k / (N * 2)) * TAU
          return (
            <mesh key={k} geometry={geo.brace} position={[Math.cos(a) * R, Math.sin(a) * R, 0]}>
              <Flat color={frame} />
            </mesh>
          )
        })}
        {riders.map((r, i) => (
          <Gondola key={i} i={i} geo={geo} color={P[i % P.length]} frame={frame} riders={r} onTap={onTap} set={(el) => (gondolas.current[i] = el)} />
        ))}
      </group>
    </group>
  )
}

// A live readout of the drive and the load, laid over the canvas.
function Readout({ tele }) {
  const el = useRef()
  useEffect(() => {
    let raf
    const tick = () => {
      const T = tele.current
      if (el.current)
        el.current.textContent = `${T.mode} · ${T.rpm.toFixed(2)} rpm · motor ${T.motor.toFixed(1)} kN·m · load ${T.load.toFixed(1)} kN·m · ${T.riders} riders · swing ${T.swing.toFixed(1)}°`
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [tele])
  return <div ref={el} style={{ position: 'absolute', left: 12, top: 12, right: 56, zIndex: 4, padding: '7px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.86)', boxShadow: '0 2px 10px rgba(0,0,0,.1)', font: '500 11px/1.5 ui-monospace, Menlo, monospace', color: '#2a2925', width: 'fit-content', maxWidth: 'calc(100% - 68px)' }} />
}

export default function FerrisWheelScene({ background, autoRotate, float, ...props }) {
  const tele = useRef({ rpm: 0, motor: 0, load: 0, riders: 0, mode: '', swing: 0 })
  return (
    <Stage
      background={background}
      autoRotate={autoRotate}
      float={float}
      camera={[2.8, 1.7, 6.4]}
      target={[0, 1.15, 0]}
      overlay={<Readout tele={tele} />}
      hint="A 20 m wheel with real inertia: the drive soft-starts and holds speed under load, the brake stops and holds it, and coasting a loaded wheel rocks until its heavy side settles · gondolas swing on their pins when it speeds up or brakes · tap a gondola to add a rider (up to four, then it empties) · Time scale speeds up the physics · drag to orbit"
    >
      <FerrisWheel {...props} tele={tele} />
    </Stage>
  )
}
