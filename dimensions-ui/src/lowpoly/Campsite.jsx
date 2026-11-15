import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Flame, Flat, Particles, Stage, Sway, TAU, blob, cone, facet, useGeo, useTap } from './kit.jsx'

// A low-poly campsite: a ridge tent with an open door flap and guy ropes,
// a small fire in a ring of stones with embers rising, a log to sit on, a
// lantern on a stake and two pines behind. The fire flickers and the flap
// stirs in the breeze. Tap it to light the lantern, and again to put it out.

const TENTS = {
  orange: { fly: '#f07b2a', fly2: '#d9661a', inner: '#5a2e14' },
  green: { fly: '#4f9a52', fly2: '#3f8644', inner: '#1f3a22' },
  blue: { fly: '#3d7fe0', fly2: '#2f6ac4', inner: '#16264a' },
  red: { fly: '#d8383f', fly2: '#bf2f36', inner: '#4a1418' },
}
const TW = 0.95 // tent width
const TH = 0.7 // tent height
const TD = 1.0 // tent depth

function prism(w, h, d) {
  const s = new THREE.Shape()
  s.moveTo(-w / 2, 0)
  s.lineTo(w / 2, 0)
  s.lineTo(0, h)
  s.closePath()
  return new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false }).translate(0, 0, -d / 2)
}
function tri(w, h) {
  const s = new THREE.Shape()
  s.moveTo(0, 0)
  s.lineTo(w, 0)
  s.lineTo(0, h)
  s.closePath()
  return new THREE.ShapeGeometry(s)
}

export function Campsite({ tent = 'orange' }) {
  const T = TENTS[tent] || TENTS.orange
  const { handlers, clock } = useTap()
  const lit = useRef({ on: false, t0: -99 })
  const core = useRef()
  const lamp = useRef()

  const geo = useGeo(
    () => ({
      ground: facet(new THREE.CylinderGeometry(1.45, 1.5, 0.06, 14, 1).translate(0, 0.03, 0), 0.03, 1, [1, 0.3, 1]),
      tent: prism(TW, TH, TD),
      door: tri(TW / 2 - 0.04, TH - 0.06),
      flap: tri(TW / 2 - 0.02, TH - 0.04),
      rope: new THREE.CylinderGeometry(0.005, 0.005, 1, 3, 1).translate(0, 0.5, 0),
      peg: cone(0.015, 0.06, 3, 2),
      stone: blob(0.06, 3),
      log: facet(new THREE.CylinderGeometry(0.04, 0.045, 0.34, 6, 1).rotateZ(Math.PI / 2), 0.005, 4),
      seat: facet(new THREE.CylinderGeometry(0.09, 0.1, 0.6, 7, 1).rotateZ(Math.PI / 2), 0.008, 5),
      stake: new THREE.CylinderGeometry(0.012, 0.012, 0.55, 4, 1).translate(0, 0.275, 0),
      lantern: new THREE.BoxGeometry(0.09, 0.12, 0.09),
      lcap: cone(0.075, 0.06, 4, 6).rotateY(Math.PI / 4),
      lcore: new THREE.OctahedronGeometry(0.035, 0),
      pine: cone(0.22, 0.55, 6, 7),
      pine2: cone(0.17, 0.42, 6, 8),
      trunk: new THREE.CylinderGeometry(0.03, 0.04, 0.15, 5, 1).translate(0, 0.075, 0),
    }),
    [],
  )

  const ropes = useMemo(() => {
    const up = new THREE.Vector3(0, 1, 0)
    const out = []
    for (const z of [-1, 1])
      for (const x of [-1, 1]) {
        const a = new THREE.Vector3(0, TH - 0.02, z * (TD / 2 - 0.01))
        const b = new THREE.Vector3(x * 0.32, 0.02, z * (TD / 2 + 0.42))
        const d = b.clone().sub(a)
        out.push({ a: a.toArray(), b: b.toArray(), len: d.length(), q: new THREE.Quaternion().setFromUnitVectors(up, d.normalize()) })
      }
    return out
  }, [])

  useFrame(() => {
    const t = clock.elapsedTime
    const L = lit.current
    const since = t - L.t0
    const level = L.on ? Math.min(1, since * 4) * (0.9 + 0.1 * Math.sin(t * 9)) : Math.max(0, 1 - since * 5)
    core.current.material.emissiveIntensity = 0.1 + level * 2.2
    lamp.current.intensity = level * 1.6
  })

  return (
    <group
      {...handlers}
      onClick={(e) => {
        handlers.onClick(e)
        lit.current.on = !lit.current.on
        lit.current.t0 = clock.elapsedTime
      }}
    >
      <mesh geometry={geo.ground}>
        <Flat color="#7fae52" />
      </mesh>

      {/* the tent, door facing the fire */}
      <group position={[-0.35, 0.06, -0.15]} rotation-y={0.5}>
        <mesh geometry={geo.tent}>
          <Flat color={T.fly} side={THREE.DoubleSide} />
        </mesh>
        <mesh geometry={geo.door} position={[0.02, 0, TD / 2 + 0.002]}>
          <Flat color={T.inner} />
        </mesh>
        <mesh geometry={geo.door} position={[-0.02, 0, TD / 2 + 0.002]} scale={[-1, 1, 1]}>
          <Flat color={T.inner} side={THREE.DoubleSide} />
        </mesh>
        {/* the open flap, pinned back and stirring */}
        <group position={[-0.01, 0, TD / 2 + 0.01]} scale={[-1, 1, 1]}>
          <Sway axis="y" rate={0.5} amp={0.12} i={0}>
            <group rotation-y={-0.9}>
              <mesh geometry={geo.flap}>
                <Flat color={T.fly2} side={THREE.DoubleSide} />
              </mesh>
            </group>
          </Sway>
        </group>
        {/* guy ropes from each ridge end down to two pegs */}
        {ropes.map(({ a, q, len, b }, i) => (
          <group key={i}>
            <mesh geometry={geo.rope} position={a} quaternion={q} scale={[1, len, 1]}>
              <Flat color="#e8e2d4" />
            </mesh>
            <mesh geometry={geo.peg} position={b} rotation-x={Math.PI}>
              <Flat color="#8d8a85" />
            </mesh>
          </group>
        ))}
      </group>

      {/* fire */}
      <group position={[0.45, 0.06, 0.3]}>
        {Array.from({ length: 8 }, (_, i) => (
          <mesh key={i} geometry={geo.stone} position={[Math.cos((i / 8) * TAU) * 0.2, 0.03, Math.sin((i / 8) * TAU) * 0.2]} scale={[1, 0.75, 1]}>
            <Flat color={i % 2 ? '#8d8a85' : '#a6a29b'} />
          </mesh>
        ))}
        {[0, 1, 2].map((i) => (
          <mesh key={i} geometry={geo.log} position-y={0.04} rotation-y={(i / 3) * Math.PI}>
            <Flat color="#5c3c2a" />
          </mesh>
        ))}
        <Flame size={0.5} position-y={0.03} />
        <Particles count={9} life={1.5} origin={[0, 0.2, 0]} spread={0.06} velocity={[0, 0.6, 0]} scatter={0.08} drift={0.15} size={[0.016, 0.004]} colors={['#ffb02e', '#ff6a1f']} opacity={[1, 0.2]} emissive={1.5} />
      </group>

      {/* a log to sit on */}
      <mesh geometry={geo.seat} position={[0.75, 0.15, -0.25]} rotation-y={0.9}>
        <Flat color="#6e4a34" />
      </mesh>

      {/* lantern on a stake */}
      <group position={[0.15, 0.06, 0.75]}>
        <mesh geometry={geo.stake}>
          <Flat color="#5c3c2a" />
        </mesh>
        <group position-y={0.6}>
          <mesh geometry={geo.lantern}>
            <meshStandardMaterial color="#fff3c8" transparent opacity={0.5} flatShading />
          </mesh>
          <mesh ref={core} geometry={geo.lcore}>
            <Flat color="#ffd06a" emissive="#ffc04a" emissiveIntensity={0.1} />
          </mesh>
          <mesh geometry={geo.lcap} position-y={0.06}>
            <Flat color="#2c2a33" />
          </mesh>
          <pointLight ref={lamp} color="#ffc65a" distance={2.2} decay={2} intensity={0} />
        </group>
      </group>

      {/* pines behind */}
      {[
        [-1.0, -0.65, 1.1],
        [-0.55, -1.05, 0.85],
        [0.75, -0.9, 0.95],
      ].map(([x, z, s], i) => (
        <group key={i} position={[x, 0.06, z]} scale={s}>
          <mesh geometry={geo.trunk}>
            <Flat color="#6e4a34" />
          </mesh>
          <mesh geometry={geo.pine} position-y={0.1}>
            <Flat color="#3f7f4a" />
          </mesh>
          <mesh geometry={geo.pine2} position-y={0.38}>
            <Flat color="#4f9a52" />
          </mesh>
        </group>
      ))}
    </group>
  )
}

export default function CampsiteScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[3, 2.4, 4.2]} target={[0, 0.35, 0]} hint="The fire flickers, embers rise and the tent flap stirs on their own · tap it to light the lantern, and again to put it out · Tent swaps orange, green, blue and red · drag to orbit">
      <Campsite {...props} />
    </Stage>
  )
}
