import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Beam, Flat, Stage, blob, cone, facet, useGeo, useTap } from './kit.jsx'

// A low-poly Victorian street lamp on a patch of cobbles: a stepped plinth,
// a six-sided post with collars, and a tapering glass lantern with a peaked
// cap and finial. The light pours down in a soft cone, flickers now and
// then, and two moths circle it. Tap it to switch it off, and again to
// switch it back on with a stutter.

const LIGHTS = {
  warm: '#ffc65a',
  cool: '#bfe3ff',
  sodium: '#ff9a3a',
  mint: '#9ff0c8',
}
const IRON = '#2a3a34'
const HEAD_Y = 1.72

export function StreetLamp({ light = 'warm' }) {
  const L = LIGHTS[light] || LIGHTS.warm
  const { handlers, clock } = useTap()
  const st = useRef({ on: true, t0: -99 })
  const glass = useRef()
  const bulb = useRef()
  const beam = useRef()
  const lamp = useRef()
  const moths = useRef([])

  const geo = useGeo(
    () => ({
      cobble: facet(new THREE.BoxGeometry(0.26, 0.05, 0.22), 0.01, 1),
      plinth: facet(new THREE.CylinderGeometry(0.15, 0.19, 0.2, 8, 1).translate(0, 0.1, 0), 0.006, 2),
      plinth2: new THREE.CylinderGeometry(0.1, 0.13, 0.12, 8, 1).translate(0, 0.06, 0),
      post: facet(new THREE.CylinderGeometry(0.04, 0.05, 1.35, 6, 3).translate(0, 0.675, 0), 0.004, 3),
      collar: new THREE.CylinderGeometry(0.075, 0.075, 0.05, 6, 1),
      cup: cone(0.11, 0.1, 4, 4).rotateY(Math.PI / 4).rotateX(Math.PI).translate(0, 0.1, 0),
      glass: new THREE.CylinderGeometry(0.15, 0.1, 0.28, 4, 1).rotateY(Math.PI / 4),
      bar: new THREE.BoxGeometry(0.018, 0.29, 0.018),
      cap: cone(0.2, 0.16, 4, 5).rotateY(Math.PI / 4),
      finial: blob(0.035, 6, 0),
      bulb: new THREE.OctahedronGeometry(0.05, 0),
      moth: new THREE.TetrahedronGeometry(0.025, 0),
    }),
    [],
  )
  const cobbles = []
  for (let x = -2; x <= 2; x++)
    for (let z = -2; z <= 2; z++) if (x * x + z * z <= 5) cobbles.push([x * 0.28 + (z % 2) * 0.12, z * 0.24, (x * 7 + z * 3) % 3])

  useFrame(() => {
    const t = clock.elapsedTime
    const S = st.current
    const since = t - S.t0
    let level
    if (S.on) {
      // a stutter as it comes on, then a rare idle flicker
      const start = since < 0.7 ? (Math.sin(since * 55) > 0 ? 1 : 0.1) : 1
      const flick = Math.sin(t * 1.7) + Math.sin(t * 2.9 + 1) > 1.85 ? (Math.sin(t * 70) > 0 ? 1 : 0.35) : 1
      level = start * flick
    } else {
      level = Math.max(0, 1 - since * 6)
    }
    bulb.current.material.emissiveIntensity = 0.1 + level * 2.2
    glass.current.material.emissiveIntensity = 0.05 + level * 0.7
    beam.current.material.opacity = level * 0.24
    lamp.current.intensity = level * 3
    moths.current.forEach((m, i) => {
      if (!m) return
      m.visible = S.on
      const a = t * (2.2 + i * 0.7) + i * 2
      m.position.set(Math.cos(a) * (0.28 + i * 0.06), HEAD_Y + 0.05 + Math.sin(t * 5 + i) * 0.08, Math.sin(a) * (0.28 + i * 0.06))
      m.rotation.set(Math.sin(t * 30 + i) * 0.6, -a, 0)
    })
  })

  return (
    <group
      {...handlers}
      onClick={(e) => {
        handlers.onClick(e)
        st.current.on = !st.current.on
        st.current.t0 = clock.elapsedTime
      }}
    >
      {cobbles.map(([x, z, c], i) => (
        <mesh key={i} geometry={geo.cobble} position={[x, 0.025, z]} rotation-y={(i % 3) * 0.08}>
          <Flat color={['#9a958d', '#8a857e', '#aaa59c'][c]} />
        </mesh>
      ))}
      <mesh geometry={geo.plinth} position-y={0.05}>
        <Flat color={IRON} />
      </mesh>
      <mesh geometry={geo.plinth2} position-y={0.25}>
        <Flat color={IRON} />
      </mesh>
      <mesh geometry={geo.post} position-y={0.3}>
        <Flat color={IRON} metalness={0.3} roughness={0.55} />
      </mesh>
      {[0.55, 1.2, 1.6].map((y) => (
        <mesh key={y} geometry={geo.collar} position-y={y}>
          <Flat color={IRON} />
        </mesh>
      ))}

      {/* the lantern head */}
      <group position-y={HEAD_Y}>
        <mesh geometry={geo.cup} position-y={-0.2}>
          <Flat color={IRON} />
        </mesh>
        <mesh ref={glass} geometry={geo.glass}>
          <meshStandardMaterial color="#fff8e0" emissive={L} transparent opacity={0.6} flatShading roughness={0.3} depthWrite={false} />
        </mesh>
        {[0, 1, 2, 3].map((i) => {
          const a = (i / 4) * Math.PI * 2 + Math.PI / 4
          return (
            <mesh key={i} geometry={geo.bar} position={[Math.cos(a) * 0.125, 0, Math.sin(a) * 0.125]}>
              <Flat color={IRON} />
            </mesh>
          )
        })}
        <mesh ref={bulb} geometry={geo.bulb}>
          <Flat color={L} emissive={L} />
        </mesh>
        <mesh geometry={geo.cap} position-y={0.14}>
          <Flat color={IRON} />
        </mesh>
        <mesh geometry={geo.finial} position-y={0.33}>
          <Flat color={IRON} />
        </mesh>
        <pointLight ref={lamp} color={L} distance={3.5} decay={2} position-y={-0.1} />
        <Beam ref={beam} rotation-x={Math.PI / 2} position-y={-0.12} length={1.6} radius={0.75} color={L} opacity={0.14} />
      </group>

      {[0, 1].map((i) => (
        <mesh key={i} ref={(el) => (moths.current[i] = el)} geometry={geo.moth}>
          <Flat color="#e9dfc8" />
        </mesh>
      ))}
    </group>
  )
}

export default function StreetLampScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[3.2, 2.4, 4.4]} target={[0, 0.95, 0]} hint="The light flickers now and then and moths circle it on their own · tap it to switch it off, and again to switch it on · Light swaps warm, cool, sodium and mint · drag to orbit">
      <StreetLamp {...props} />
    </Stage>
  )
}
