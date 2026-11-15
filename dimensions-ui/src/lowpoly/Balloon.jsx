import { useCallback, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Flame, Flat, Readout, Stage, TAU, blob, facet, useGeo, useTap } from './kit.jsx'

// A low-poly hot air balloon over a patchwork of fields: a twelve-gore
// envelope on a lathed teardrop, a wicker basket hung on four cables and a
// burner between them. It flies on real buoyancy, in SI units:
// - lift = air density x envelope volume x g x (dT / (T_air + dT)), so the
//   balloon floats when the air inside is about 50 K warmer than outside;
// - the envelope cools towards the outside air, and the burner heats it;
// - it rises and sinks against air drag, with the air it carries along
//   adding to its inertia.
// An autopilot burns in short blasts to hold height, as a pilot does. Tap
// it for a long burn and it climbs, then cools and sinks back. The basket
// swings under the envelope as the wind pushes it about.

const STYLES = {
  rainbow: ['#e8434b', '#f28c38', '#f6c93a', '#5cc25e', '#3d8de0', '#7a55c8'],
  sunset: ['#f2814a', '#e3525c', '#f6b44a', '#b8346a'],
  classic: ['#d8383f', '#f6c93a'],
  mint: ['#5ac7a6', '#f4f1ea', '#3d8de0'],
}
const GORES = 12
const ENVELOPE = [
  [0.1, 0],
  [0.16, 0.08],
  [0.32, 0.32],
  [0.42, 0.58],
  [0.44, 0.8],
  [0.39, 1.0],
  [0.26, 1.15],
  [0.001, 1.22],
]
// physics, SI
const RHO = 1.2 // air, kg/m^3
const V = 2800 // envelope, m^3
const T_AIR = 288 // K
const MASS = 520 // envelope, basket, burner, fuel and pilot, kg
const G = 9.81
const M_EFF = MASS + 0.5 * RHO * V // plus the air it drags along
const DRAG = 0.5 * RHO * 0.5 * 220 // 1/2 rho Cd A
const HEAT = 4.5 // K/s while burning
const COOL = 0.02 // 1/s
const SCALE = 0.03 // scene units per metre
const LIFT0 = 0.12 // envelope mouth height above the ground when landed

export function Balloon({ envelope = 'rainbow', target = 22, tele }) {
  const C = STYLES[envelope] || STYLES.rainbow
  const { tap, handlers, clock } = useTap(1)
  const craft = useRef()
  const basket = useRef()
  const sim = useRef({ y: 14, v: 0, dT: 51, burn: false, sx: 0, sz: 0, vx: 0, vz: 0, px: 0, pz: 0, pvx: 0, pvz: 0 })

  const geo = useGeo(
    () => ({
      gores: Array.from({ length: GORES }, (_, i) => new THREE.LatheGeometry(ENVELOPE.map(([r, y]) => new THREE.Vector2(r, y)), 2, (i / GORES) * TAU, TAU / GORES)),
      basket: facet(new THREE.BoxGeometry(0.17, 0.12, 0.17), 0.004, 1),
      rim: new THREE.BoxGeometry(0.19, 0.025, 0.19),
      cable: new THREE.CylinderGeometry(0.004, 0.004, 1, 3, 1).translate(0, 0.5, 0),
      burner: new THREE.CylinderGeometry(0.035, 0.03, 0.05, 6, 1),
      field: new THREE.BoxGeometry(0.62, 0.03, 0.62),
      tree: blob(0.09, 3),
      puff: blob(0.15, 4),
    }),
    [],
  )
  // cables from the envelope mouth down to the basket corners
  const cables = useMemo(() => {
    const up = new THREE.Vector3(0, 1, 0)
    return [
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1],
    ].map(([x, z]) => {
      const a = new THREE.Vector3(x * 0.075, -0.3, z * 0.075)
      const b = new THREE.Vector3(x * 0.11, 0, z * 0.11)
      const d = b.clone().sub(a)
      return { a: a.toArray(), q: new THREE.Quaternion().setFromUnitVectors(up, d.clone().normalize()), len: d.length() }
    })
  }, [])

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05)
    if (!(dt > 0)) return
    const t = clock.elapsedTime
    const S = sim.current
    // the pilot: blast when low or sinking, rest when high or climbing; a tap is a long burn
    const manual = tap.since(t) < 3
    if (manual) S.burn = true
    else if (S.y < target - 2 && S.v < 0.6) S.burn = true
    else if (S.y > target || S.v > 1.2) S.burn = false
    const n = 4
    const h = dt / n
    for (let k = 0; k < n; k++) {
      S.dT += ((S.burn ? HEAT : 0) - COOL * S.dT) * h
      const lift = RHO * V * G * (S.dT / (T_AIR + S.dT))
      const f = lift - MASS * G - DRAG * S.v * Math.abs(S.v)
      S.v += (f / M_EFF) * h
      S.y += S.v * h
      if (S.y <= 0) {
        S.y = 0
        S.v = Math.max(0, S.v)
      }
    }
    // drift on a light, shifting wind; the basket swings as a pendulum
    const x = Math.sin(t * 0.13) * 0.35 + Math.sin(t * 0.31) * 0.08
    const z = Math.sin(t * 0.09 + 1) * 0.25
    const vx = (x - S.px) / dt
    const vz = (z - S.pz) / dt
    const ax = (vx - S.pvx) / dt
    const az = (vz - S.pvz) / dt
    S.px = x
    S.pz = z
    S.pvx = vx
    S.pvz = vz
    const w2 = 9.81 / 0.3 // pendulum, 0.3 m-ish cables in scene terms
    S.vx += (-w2 * S.sx - 0.8 * S.vx - Math.max(-3, Math.min(3, ax)) * 3) * dt
    S.vz += (-w2 * S.sz - 0.8 * S.vz - Math.max(-3, Math.min(3, az)) * 3) * dt
    S.sx += S.vx * dt
    S.sz += S.vz * dt
    craft.current.position.set(x, LIFT0 + 0.3 + S.y * SCALE, z)
    craft.current.rotation.y = t * 0.05
    basket.current.rotation.set(S.sz, 0, -S.sx)
    // the envelope swells a touch with the heat
    craft.current.children[0].scale.setScalar(1 + (S.dT - 50) * 0.002)
    if (tele) Object.assign(tele.current, { alt: S.y, v: S.v, dT: S.dT, burn: S.burn })
  })

  const fields = [
    [-0.33, -0.33, '#7fbf52'],
    [0.33, -0.33, '#e3c86a'],
    [-0.33, 0.33, '#c9a24a'],
    [0.33, 0.33, '#6fb04f'],
  ]

  return (
    <group {...handlers}>
      {fields.map(([x, z, c], i) => (
        <mesh key={i} geometry={geo.field} position={[x, 0.015, z]}>
          <Flat color={c} />
        </mesh>
      ))}
      {[
        [0.7, 0.1],
        [-0.72, 0.2],
        [0.05, 0.72],
        [-0.1, -0.74],
      ].map(([x, z], i) => (
        <mesh key={i} geometry={geo.tree} position={[x, 0.09, z]} scale={[1, 1.2, 1]}>
          <Flat color="#3f7f4a" />
        </mesh>
      ))}
      {[
        [-0.9, 1.6, -0.4, 1],
        [0.95, 1.1, 0.3, 0.8],
      ].map(([x, y, z, s], i) => (
        <group key={i} position={[x, y, z]} scale={s}>
          <mesh geometry={geo.puff} scale={[1.6, 0.8, 1]}>
            <Flat color="#ffffff" />
          </mesh>
          <mesh geometry={geo.puff} position={[0.18, -0.03, 0.03]} scale={[0.9, 0.7, 0.8]}>
            <Flat color="#f2f4f8" />
          </mesh>
        </group>
      ))}

      <group ref={craft}>
        <group>
          {geo.gores.map((g, i) => (
            <mesh key={i} geometry={g}>
              <Flat color={C[i % C.length]} side={THREE.DoubleSide} />
            </mesh>
          ))}
        </group>
        <group ref={basket}>
          {cables.map((c, i) => (
            <mesh key={i} geometry={geo.cable} position={c.a} quaternion={c.q} scale={[1, c.len, 1]}>
              <Flat color="#4a3a30" />
            </mesh>
          ))}
          <mesh geometry={geo.burner} position-y={-0.17}>
            <Flat color="#8d95a3" metalness={0.5} roughness={0.4} />
          </mesh>
          <Flame position-y={-0.15} size={0.32} power={() => (sim.current.burn ? 1.2 : 0.12)} colors={['#3d7fff', '#ffb02e', '#fff3c0']} />
          <mesh geometry={geo.basket} position-y={-0.36}>
            <Flat color="#a8743f" />
          </mesh>
          <mesh geometry={geo.rim} position-y={-0.3}>
            <Flat color="#6e4a34" />
          </mesh>
        </group>
      </group>
    </group>
  )
}

export default function BalloonScene({ background, autoRotate, float, ...props }) {
  const tele = useRef({ alt: 0, v: 0, dT: 0, burn: false })
  const text = useCallback(() => {
    const T = tele.current
    return `${T.burn ? 'burner ON ' : 'burner off'} · height ${T.alt.toFixed(1)} m · ${T.v >= 0 ? '+' : ''}${T.v.toFixed(2)} m/s · air inside +${T.dT.toFixed(1)} K`
  }, [])
  return (
    <Stage background={background} autoRotate={autoRotate} float={false} camera={[3.8, 1.9, 5.4]} target={[0, 1.15, 0]} overlay={<Readout text={text} />} hint="It flies on real buoyancy: lift comes from how much warmer the air inside is, the envelope cools, and an autopilot burns in short blasts to hold height · tap it for a long burn: it climbs, then cools and sinks back · Target sets the height to hold · drag to orbit">
      <Balloon {...props} tele={tele} />
    </Stage>
  )
}
