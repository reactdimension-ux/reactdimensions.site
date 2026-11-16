import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Beam, Flat, Particles, Stage, TAU, blob, cone, facet, terrainGeo, useGeo, useTap } from './kit.jsx'

// A low-poly flying saucer hovering over a round patch of field where a
// spotted cow is grazing: a turned metal saucer with a rim of lights, a
// glowing belly, an antenna and a glass dome with a little green alien
// inside who looks about. Left alone, the saucer hovers and wobbles and
// its rim lights chase round. Tap it and a translucent tractor beam shines
// down: the cow floats up into it, slowly spinning, hangs there a moment,
// then drifts gently back down to the grass and the beam fades.

const LOOKS = {
  silver: { hull: '#c9ced8', band: '#8e95a3', belly: '#9ff7c4', lights: ['#7dffb0', '#ffffff'], dome: '#bfeaff', beam: '#bfffd6', metalness: 0.55 },
  green: { hull: '#6fcf6b', band: '#3e8f4a', belly: '#fff27a', lights: ['#fff27a', '#ffffff'], dome: '#d9ffe0', beam: '#e4ffa8', metalness: 0.2 },
  violet: { hull: '#8f6ae0', band: '#5a3fa8', belly: '#ff9ae2', lights: ['#ff7ad9', '#9ae8ff'], dome: '#e4d8ff', beam: '#e6c4ff', metalness: 0.25 },
  gold: { hull: '#e0b448', band: '#a77a24', belly: '#ffe9a0', lights: ['#ff6a4a', '#fff0a8'], dome: '#fff4d4', beam: '#fff2b0', metalness: 0.6 },
}

// the saucer's outline from the belly up to the deck, turned round y
const SAUCER = [
  [0.001, -0.13],
  [0.22, -0.13],
  [0.4, -0.1],
  [0.62, -0.035],
  [0.79, 0],
  [0.77, 0.035],
  [0.56, 0.08],
  [0.32, 0.11],
  [0.001, 0.11],
]
const HOVER = 1.5
const NLIGHT = 14
const ABDUCT = 4.4 // seconds from beam on to beam off
const LIFT = 0.62

const ease = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u))
const clamp01 = (u) => Math.max(0, Math.min(1, u))

// how high the cow is lifted, s seconds after a tap
function liftAt(s) {
  if (s < 0.2 || s > 3.7) return 0
  if (s < 1.9) return LIFT * ease((s - 0.2) / 1.7)
  if (s < 2.4) return LIFT + 0.03 * Math.sin((s - 1.9) * 6)
  const u = clamp01((s - 2.4) / 1.3)
  return LIFT * (1 - ease(u))
}

function Cow({ geo, cow }) {
  const spots = useMemo(() => {
    const o = new THREE.Object3D()
    return [
      [0.5, 0.6, 0.62],
      [-0.4, 0.4, 0.82],
      [0.1, 0.85, -0.5],
      [-0.6, 0.3, -0.74],
      [0.75, 0.1, -0.65],
      [-0.1, 0.95, 0.3],
    ].map(([a, b, c]) => {
      const n = new THREE.Vector3(a, b, c).normalize()
      const p = new THREE.Vector3(n.x * 0.2, n.y * 0.12, n.z * 0.12).multiplyScalar(0.97)
      const nn = new THREE.Vector3(n.x / 0.2, n.y / 0.12, n.z / 0.12).normalize()
      o.position.copy(p)
      o.lookAt(p.clone().add(nn))
      return { p: p.toArray(), r: [o.rotation.x, o.rotation.y, o.rotation.z] }
    })
  }, [])
  return (
    <group ref={cow}>
      <group position-y={0.25}>
        <mesh geometry={geo.cowBody} scale={[0.2, 0.12, 0.12]}>
          <Flat color="#f7f5f0" />
        </mesh>
        {spots.map((s, i) => (
          <mesh key={i} geometry={geo.spot} position={s.p} rotation={s.r} scale={[0.06 + (i % 3) * 0.01, 0.045, 0.02]}>
            <Flat color="#222026" />
          </mesh>
        ))}
        <mesh geometry={geo.udder} position={[-0.05, -0.11, 0]}>
          <Flat color="#f2a7b4" />
        </mesh>
        {/* tail */}
        <mesh geometry={geo.leg} position={[-0.21, -0.05, 0]} rotation-z={-0.25} scale={[0.4, 0.8, 0.4]}>
          <Flat color="#f7f5f0" />
        </mesh>
        <mesh geometry={geo.udder} position={[-0.235, -0.15, 0]} scale={[0.5, 0.8, 0.5]}>
          <Flat color="#222026" />
        </mesh>
        {/* head */}
        <group position={[0.22, 0.06, 0]} rotation-z={-0.25}>
          <mesh geometry={geo.head}>
            <Flat color="#f7f5f0" />
          </mesh>
          <mesh geometry={geo.spot} position={[0.0, 0.05, 0.03]} rotation-x={-0.6} scale={[0.04, 0.03, 0.015]}>
            <Flat color="#222026" />
          </mesh>
          <mesh geometry={geo.snout} position={[0.075, -0.03, 0]}>
            <Flat color="#f2a7b4" />
          </mesh>
          {[-1, 1].map((z) => (
            <group key={z}>
              <mesh geometry={geo.eye} position={[0.05, 0.02, z * 0.045]}>
                <Flat color="#1b1a22" />
              </mesh>
              <mesh geometry={geo.horn} position={[-0.01, 0.06, z * 0.035]} rotation-x={z * 0.4}>
                <Flat color="#f2e6c9" />
              </mesh>
              <mesh geometry={geo.ear} position={[-0.02, 0.03, z * 0.07]} rotation-x={z * 1.2}>
                <Flat color="#f2d6c9" />
              </mesh>
            </group>
          ))}
        </group>
      </group>
      {/* legs */}
      {[
        [0.12, 0.06],
        [0.12, -0.06],
        [-0.12, 0.06],
        [-0.12, -0.06],
      ].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh geometry={geo.leg}>
            <Flat color="#f7f5f0" />
          </mesh>
          <mesh geometry={geo.hoof}>
            <Flat color="#3a3236" />
          </mesh>
        </group>
      ))}
    </group>
  )
}

export function Ufo({ look = 'silver' }) {
  const L = LOOKS[look] || LOOKS.silver
  const { tap, handlers, clock } = useTap(1)
  const saucer = useRef()
  const lights = useRef([])
  const beam = useRef()
  const glow = useRef()
  const cow = useRef()
  const alien = useRef()
  const tip = useRef()
  const env = useRef(0)

  const geo = useGeo(
    () => ({
      saucer: facet(new THREE.LatheGeometry(SAUCER.map(([r, y]) => new THREE.Vector2(r, y)), 16), 0.006, 2),
      band: new THREE.TorusGeometry(0.785, 0.028, 4, 16).rotateX(Math.PI / 2),
      belly: new THREE.CylinderGeometry(0.18, 0.2, 0.03, 12),
      light: new THREE.IcosahedronGeometry(0.04, 0),
      dome: new THREE.SphereGeometry(0.3, 12, 5, 0, TAU, 0, Math.PI / 2),
      domeRim: new THREE.TorusGeometry(0.3, 0.02, 4, 14).rotateX(Math.PI / 2),
      antenna: new THREE.CylinderGeometry(0.008, 0.008, 0.14, 4).translate(0, 0.07, 0),
      ball: new THREE.IcosahedronGeometry(0.025, 0),
      alienBody: cone(0.07, 0.14, 6, 3),
      alienHead: facet(new THREE.IcosahedronGeometry(0.075, 1), 0.004, 4).scale(1, 1.1, 0.95),
      alienEye: new THREE.IcosahedronGeometry(1, 0),
      stalk: new THREE.CylinderGeometry(0.005, 0.005, 0.07, 4).translate(0, 0.035, 0),
      grass: terrainGeo({ radius: 1.1, height: 0.09, seed: 7, rings: 4, segs: 14, rough: 0.3, profile: 'dome', bands: [[0, '#5fa443'], [0.45, '#6fb54d'], [0.8, '#7fc257']] }),
      tuft: cone(0.03, 0.09, 4, 5),
      flower: blob(0.022, 6, 0),
      cowBody: facet(new THREE.IcosahedronGeometry(1, 1), 0.06, 7),
      spot: blob(1, 8, 0),
      udder: blob(0.04, 9, 0),
      leg: new THREE.CylinderGeometry(0.024, 0.02, 0.17, 5).translate(0, 0.085, 0),
      hoof: new THREE.CylinderGeometry(0.024, 0.026, 0.035, 5).translate(0, 0.017, 0),
      head: facet(new THREE.BoxGeometry(0.12, 0.1, 0.09), 0.008, 10),
      snout: facet(new THREE.BoxGeometry(0.05, 0.06, 0.085), 0.005, 11),
      eye: new THREE.IcosahedronGeometry(0.012, 0),
      horn: cone(0.012, 0.045, 4, 12),
      ear: facet(new THREE.BoxGeometry(0.02, 0.05, 0.03).translate(0, 0.025, 0), 0.003, 13),
      ground: new THREE.CircleGeometry(0.42, 16).rotateX(-Math.PI / 2),
      hit: new THREE.CylinderGeometry(0.6, 0.6, 1.7, 10).translate(0, 0.85, 0),
    }),
    [],
  )

  useFrame(() => {
    const t = clock.elapsedTime
    const s = tap.since(t)
    const on = s >= 0 && s < ABDUCT
    const e = on ? ease(Math.min(s / 0.3, (ABDUCT - s) / 0.7)) : 0
    env.current = e

    const o = saucer.current
    o.position.y = HOVER + 0.06 * Math.sin(t * 1.2)
    o.rotation.z = 0.07 * Math.sin(t * 0.9) * (1 - 0.6 * e)
    o.rotation.x = 0.05 * Math.sin(t * 0.7 + 1) * (1 - 0.6 * e)

    // chasing rim lights, faster while the beam is on
    const head = (t * (0.7 + e * 1.6)) % 1
    lights.current.forEach((m, i) => {
      if (!m) return
      const d = (i / NLIGHT - head + 2) % 1
      m.material.emissiveIntensity = 0.25 + 2.4 * Math.max(0, 1 - d * 4)
    })
    tip.current.material.emissiveIntensity = (t % 1.2) < 0.25 ? 2.2 : 0.3
    alien.current.rotation.y = 0.7 * Math.sin(t * 0.6) + 0.3 * Math.sin(t * 1.7) + (on ? Math.sin(s * 9) * 0.15 * e : 0)

    beam.current.visible = e > 0.01
    beam.current.material.opacity = 0.6 * e * (0.9 + 0.1 * Math.sin(t * 20))
    glow.current.visible = e > 0.01
    glow.current.material.opacity = 0.45 * e

    // the cow floats up spinning, then drifts back down
    const c = cow.current
    const lift = on ? liftAt(s) : 0
    const u = on ? clamp01((s - 0.2) / 3.5) : 0
    c.position.y = 0.06 + lift
    c.rotation.y = 0.4 + TAU * 2 * ease(u)
    c.rotation.z = (0.25 * lift) / LIFT * Math.sin(s * 2.2)
    c.rotation.x = (0.15 * lift) / LIFT * Math.sin(s * 1.7 + 1)
  })

  return (
    <group {...handlers}>
      {/* the field and the cow */}
      <mesh geometry={geo.grass}>
        <Flat vertexColors color="#ffffff" />
      </mesh>
      {[
        [0.62, 0.3],
        [-0.55, 0.45],
        [0.3, -0.65],
        [-0.7, -0.2],
        [0.75, -0.25],
        [-0.15, 0.78],
      ].map(([x, z], i) => (
        <group key={i} position={[x, 0.03, z]} rotation-y={i}>
          {[-0.03, 0, 0.03].map((dx, j) => (
            <mesh key={j} geometry={geo.tuft} position-x={dx} rotation-z={dx * 6} scale={[1, 0.8 + j * 0.25, 1]}>
              <Flat color={j % 2 ? '#4f9438' : '#5fa743'} />
            </mesh>
          ))}
          {i % 2 === 0 && (
            <mesh geometry={geo.flower} position={[0.05, 0.05, 0.03]}>
              <Flat color={i % 4 ? '#ffffff' : '#ffd84a'} />
            </mesh>
          )}
        </group>
      ))}
      <mesh ref={glow} geometry={geo.ground} position-y={0.095} visible={false}>
        <meshBasicMaterial color={L.beam} transparent opacity={0} depthWrite={false} />
      </mesh>
      <Cow geo={geo} cow={cow} />
      <Particles count={14} life={1.6} origin={[0, 0.1, 0]} spread={0.3} velocity={[0, 0.8, 0]} scatter={0.02} drift={0.04} size={[0.012, 0.022]} colors={[L.beam, '#ffffff']} opacity={[0.9, 0]} emissive={1} active={() => env.current} seed={3} />

      {/* the saucer */}
      <group ref={saucer} position-y={HOVER}>
        <mesh geometry={geo.saucer}>
          <Flat color={L.hull} metalness={L.metalness} roughness={0.4} />
        </mesh>
        <mesh geometry={geo.band}>
          <Flat color={L.band} metalness={L.metalness} roughness={0.45} />
        </mesh>
        <mesh geometry={geo.belly} position-y={-0.14}>
          <Flat color={L.belly} emissive={L.belly} emissiveIntensity={0.9} />
        </mesh>
        {Array.from({ length: NLIGHT }, (_, i) => {
          const a = (i / NLIGHT) * TAU
          const c = L.lights[i % L.lights.length]
          return (
            <mesh key={i} ref={(el) => (lights.current[i] = el)} geometry={geo.light} position={[Math.cos(a) * 0.79, 0.005, Math.sin(a) * 0.79]}>
              <Flat color={c} emissive={c} emissiveIntensity={0.5} roughness={0.3} />
            </mesh>
          )
        })}

        {/* the little pilot under the dome */}
        <group ref={alien} position-y={0.1}>
          <mesh geometry={geo.alienBody}>
            <Flat color="#6fd64f" />
          </mesh>
          <mesh geometry={geo.alienHead} position-y={0.18}>
            <Flat color="#7fe35c" />
          </mesh>
          {[-1, 1].map((x) => (
            <group key={x}>
              <mesh geometry={geo.alienEye} position={[x * 0.032, 0.185, 0.066]} rotation-z={x * -0.5} scale={[0.02, 0.03, 0.012]}>
                <Flat color="#121018" roughness={0.2} />
              </mesh>
              <mesh geometry={geo.stalk} position={[x * 0.03, 0.25, 0]} rotation-z={x * -0.35}>
                <Flat color="#6fd64f" />
              </mesh>
              <mesh geometry={geo.ball} position={[x * 0.054, 0.315, 0]} scale={0.6}>
                <Flat color="#c6ff7a" emissive="#c6ff7a" emissiveIntensity={0.5} />
              </mesh>
            </group>
          ))}
        </group>
        <mesh geometry={geo.domeRim} position-y={0.11}>
          <Flat color={L.band} metalness={L.metalness} roughness={0.45} />
        </mesh>
        <mesh geometry={geo.dome} position-y={0.11} renderOrder={2}>
          <meshStandardMaterial color={L.dome} flatShading roughness={0.08} metalness={0.1} transparent opacity={0.32} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
        <mesh geometry={geo.antenna} position-y={0.4}>
          <Flat color={L.band} />
        </mesh>
        <mesh ref={tip} geometry={geo.ball} position-y={0.55}>
          <Flat color={L.lights[0]} emissive={L.lights[0]} emissiveIntensity={0.3} />
        </mesh>

        {/* the tractor beam, pointing down */}
        <Beam ref={beam} rotation-x={Math.PI / 2} position-y={-0.14} length={1.45} radius={0.44} color={L.beam} opacity={0} visible={false} />
      </group>

      {/* an invisible column from the grass to the saucer, so a tap anywhere lands */}
      <mesh geometry={geo.hit}>
        <meshBasicMaterial visible={false} />
      </mesh>
    </group>
  )
}

export default function UfoScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[3.4, 2.1, 4.6]} target={[0, 0.85, 0]} hint="The saucer hovers and wobbles and its rim lights chase round on their own · tap it and a tractor beam lifts the cow up spinning, then sets it gently back down · Look swaps silver, green, violet and gold · drag to orbit">
      <Ufo {...props} />
    </Stage>
  )
}
