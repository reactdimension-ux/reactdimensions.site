import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Burst, Flat, Stage, TAU, facet, rng, useGeo, useTap } from './kit.jsx'

// A low-poly space station hanging over the curve of a planet: a stack of
// cylindrical core modules, a big habitation ring on four spokes with a row
// of lit windows, a truss across the top carrying two long wings of solar
// panels, a docking port on the crown and blinking navigation lights, all
// in a field of tiny stars. Left alone, the ring turns, the solar wings
// slowly tilt to follow the sun and the nav lights blink. Tap it and a
// little capsule flies in on a curving path, lines up over the port, eases
// down and docks with a puff, waits a few seconds, then undocks and flies
// off again.

const LOOKS = {
  white: { hull: '#e9ecf2', trim: '#9aa3b4', dark: '#4a5162', panel: '#2b4fae', cell: '#3b6ad8', glow: '#2f6bff', window: '#ffd98a', capsule: '#f4f4f4', heat: '#ff9a3c' },
  gold: { hull: '#e8c470', trim: '#b8862e', dark: '#5a4630', panel: '#3a3f9e', cell: '#4b58c8', glow: '#4060ff', window: '#fff0b8', capsule: '#f2e2b0', heat: '#ffb040' },
  grey: { hull: '#a8aeb8', trim: '#6e7684', dark: '#3a3f4a', panel: '#24418c', cell: '#2f5ab8', glow: '#2a5cf0', window: '#bfe6ff', capsule: '#d0d4dc', heat: '#7fd0ff' },
  orange: { hull: '#eef0f2', trim: '#f07a2c', dark: '#3e4450', panel: '#2a3f8e', cell: '#3656c0', glow: '#2f5cff', window: '#ffe0a0', capsule: '#f6a058', heat: '#ffcf6a' },
}

const CY = 1.0 // the ring plane
const RING = 0.78
const TOPY = 1.68 // the top of the docking port
const APPROACH = 2.25 // where the capsule lines up above the port
const NWIN = 24
// the capsule's timeline (seconds after a tap)
const T_IN = 2.4
const T_DOWN = 3.1
const T_UP = 6.4
const T_LIFT = 7.0
const T_END = 9.4

const ease = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u))
const bez = (a, b, c, d, u, out) => {
  const v = 1 - u
  return out.set(0, 0, 0).addScaledVector(a, v * v * v).addScaledVector(b, 3 * v * v * u).addScaledVector(c, 3 * v * u * u).addScaledVector(d, u * u * u)
}
const IN = [new THREE.Vector3(2.8, 2.9, 1.6), new THREE.Vector3(1.6, 3.0, -1.4), new THREE.Vector3(-0.6, 2.6, -0.4), new THREE.Vector3(0, APPROACH, 0)]
const OUT = [new THREE.Vector3(0, APPROACH, 0), new THREE.Vector3(-0.5, 2.5, 0.5), new THREE.Vector3(-1.4, 2.7, 1.8), new THREE.Vector3(-3.2, 3.3, 2.6)]
const DOWN = new THREE.Vector3(0, -1, 0)
const _p = new THREE.Vector3()
const _q = new THREE.Vector3()
const _d = new THREE.Vector3()
const _r = new THREE.Quaternion()
const ID = new THREE.Quaternion()

// The station's solar wing: a frame of dark struts with a grid of glassy
// cells, spreading out along +x.
function SolarWing({ L, geo, side }) {
  const cells = []
  for (let i = 0; i < 6; i++)
    for (let j = 0; j < 2; j++) cells.push([0.42 + i * 0.17, (j - 0.5) * 0.19])
  return (
    <group scale={[side, 1, 1]}>
      <mesh geometry={geo.frame} position={[0.92, 0, 0]}>
        <Flat color={L.panel} metalness={0.3} roughness={0.5} />
      </mesh>
      {cells.map(([x, z], i) => (
        <mesh key={i} geometry={geo.cell} position={[x, 0.008, z]}>
          <Flat color={L.cell} emissive={L.glow} emissiveIntensity={0.35} metalness={0.4} roughness={0.3} />
        </mesh>
      ))}
      {cells.map(([x, z], i) => (
        <mesh key={'b' + i} geometry={geo.cell} position={[x, -0.008, z]}>
          <Flat color={L.cell} emissive={L.glow} emissiveIntensity={0.2} metalness={0.4} roughness={0.3} />
        </mesh>
      ))}
    </group>
  )
}

export function SpaceStation({ look = 'white' }) {
  const L = LOOKS[look] || LOOKS.white
  const { tap, handlers, clock } = useTap(1.5)
  const ring = useRef()
  const wings = useRef([])
  const navs = useRef([])
  const cap = useRef()
  const flame = useRef()
  const geo = useGeo(
    () => ({
      core: facet(new THREE.CylinderGeometry(0.15, 0.15, 0.5, 8), 0.004, 2),
      coreB: facet(new THREE.CylinderGeometry(0.19, 0.19, 0.34, 8), 0.004, 3),
      band: new THREE.CylinderGeometry(0.2, 0.2, 0.05, 8),
      node: facet(new THREE.CylinderGeometry(0.12, 0.17, 0.14, 8), 0.004, 4),
      port: new THREE.CylinderGeometry(0.075, 0.09, 0.12, 8),
      collar: new THREE.TorusGeometry(0.085, 0.018, 4, 10).rotateX(Math.PI / 2),
      dish: new THREE.SphereGeometry(0.14, 8, 3, 0, TAU, 0, Math.PI / 2.6),
      ring: facet(new THREE.TorusGeometry(RING, 0.075, 6, 28).rotateX(Math.PI / 2), 0.006, 5),
      hub: new THREE.CylinderGeometry(0.24, 0.24, 0.1, 8),
      spoke: new THREE.CylinderGeometry(0.025, 0.025, RING - 0.22, 5).rotateZ(Math.PI / 2),
      window: new THREE.BoxGeometry(0.05, 0.035, 0.02),
      truss: new THREE.BoxGeometry(3.0, 0.05, 0.05),
      strut: new THREE.BoxGeometry(0.02, 0.09, 0.02),
      frame: new THREE.BoxGeometry(1.08, 0.012, 0.42),
      cell: new THREE.BoxGeometry(0.155, 0.01, 0.175),
      mast: new THREE.CylinderGeometry(0.008, 0.008, 0.28, 4),
      light: new THREE.IcosahedronGeometry(0.028, 0),
      radiator: new THREE.BoxGeometry(0.34, 0.01, 0.14),
      capBody: facet(new THREE.CylinderGeometry(0.07, 0.11, 0.16, 7).translate(0, 0.02, 0), 0.003, 6),
      capNose: new THREE.CylinderGeometry(0.05, 0.07, 0.06, 7).translate(0, -0.09, 0),
      capPanel: new THREE.BoxGeometry(0.26, 0.008, 0.07),
      capWin: new THREE.BoxGeometry(0.03, 0.03, 0.02),
      flame: new THREE.ConeGeometry(0.06, 0.16, 6).translate(0, 0.08, 0),
      puff: new THREE.IcosahedronGeometry(1, 0),
      planet: facet(new THREE.IcosahedronGeometry(8.6, 3), 0.05, 7),
      air: new THREE.IcosahedronGeometry(8.85, 3),
      hit: new THREE.CylinderGeometry(0.9, 0.9, 1.5, 10).translate(0, 1.05, 0),
    }),
    [],
  )
  // a field of tiny stars in a shell round the station
  const stars = useGeo(() => {
    const r = rng(19)
    const pos = []
    for (let i = 0; i < 420; i++) {
      const v = new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize().multiplyScalar(7 + r() * 9)
      if (v.y < -1) v.y = -v.y // keep them above the planet
      pos.push(v.x, v.y + 1, v.z)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    return g
  }, [])
  const wins = useMemo(() => Array.from({ length: NWIN }, (_, i) => (i / NWIN) * TAU), [])
  // fake kicks so the puffs fire when the capsule docks and undocks
  const dockKick = useMemo(() => ({ since: (t) => tap.since(t) - T_DOWN }), [tap])
  const undockKick = useMemo(() => ({ since: (t) => tap.since(t) - T_UP }), [tap])
  // a tap only launches a capsule if none is on its way
  const onClick = (e) => {
    e.stopPropagation()
    if (tap.since(clock.elapsedTime) > T_END) tap.kick(clock.elapsedTime)
  }

  useFrame(() => {
    const t = clock.elapsedTime
    ring.current.rotation.y = t * 0.35
    // the wings tilt slowly to follow the light
    const tilt = Math.sin(t * 0.18) * 0.55 + 0.2
    wings.current.forEach((w) => w && (w.rotation.x = tilt))
    // nav lights: quick double blinks, each on its own beat
    navs.current.forEach((m, i) => {
      if (!m) return
      const b = (t + i * 0.37) % 1.6
      const on = b < 0.12 || (b > 0.3 && b < 0.42)
      m.material.emissiveIntensity = on ? 3 : 0.15
      m.scale.setScalar(on ? 1.3 : 0.9)
    })
    // the capsule
    const s = tap.since(t)
    const c = cap.current
    c.visible = s >= 0 && s < T_END
    if (!c.visible) return
    let fl = 0
    if (s < T_IN) {
      // fly in along a curve, nose along the path, lining up at the end
      const u = s / T_IN
      const e = 1 - (1 - u) ** 2
      bez(...IN, e, c.position)
      bez(...IN, Math.min(1, e + 0.02), _q)
      _d.subVectors(_q, c.position)
      if (_d.lengthSq() > 1e-8) _r.setFromUnitVectors(DOWN, _d.normalize())
      c.quaternion.copy(_r).slerp(ID, ease((u - 0.55) / 0.45))
      c.scale.setScalar(Math.min(1, s * 3))
      fl = 1 - u * 0.7
    } else if (s < T_DOWN) {
      // ease straight down onto the port
      const u = ease((s - T_IN) / (T_DOWN - T_IN))
      c.position.set(0, APPROACH + (TOPY + 0.11 - APPROACH) * u, 0)
      c.quaternion.copy(ID)
      c.scale.setScalar(1)
      fl = 0.25 * (1 - u)
    } else if (s < T_UP) {
      // docked
      c.position.set(0, TOPY + 0.11, 0)
      c.quaternion.copy(ID)
    } else if (s < T_LIFT) {
      const u = ease((s - T_UP) / (T_LIFT - T_UP))
      c.position.set(0, TOPY + 0.11 + (APPROACH - TOPY - 0.11) * u, 0)
      c.quaternion.copy(ID)
      fl = 0.3
    } else {
      // fly away, turning onto the path and shrinking into the distance
      const u = (s - T_LIFT) / (T_END - T_LIFT)
      const e = u * u
      bez(...OUT, e, c.position)
      bez(...OUT, Math.min(1, e + 0.02), _q)
      _d.subVectors(_q, c.position)
      if (_d.lengthSq() > 1e-8) _r.setFromUnitVectors(DOWN, _d.normalize())
      c.quaternion.copy(ID).slerp(_r, ease(u / 0.35))
      c.scale.setScalar(Math.max(0.001, Math.min(1, (1 - u) * 4)))
      fl = 0.5 + u
    }
    // the thruster glows at the back (top) of the capsule
    flame.current.visible = fl > 0.02
    flame.current.scale.set(1, fl * (0.8 + 0.2 * Math.sin(t * 40)), 1)
  })

  return (
    <group {...handlers} onClick={onClick}>
      {/* the planet far below, with a thin glow of air */}
      <mesh geometry={geo.planet} position={[0, -9.4, -1]} rotation={[0.3, 0.5, 0]}>
        <Flat color="#2a5a8e" emissive="#14304e" emissiveIntensity={0.4} roughness={0.9} />
      </mesh>
      <mesh geometry={geo.air} position={[0, -9.4, -1]}>
        <meshBasicMaterial color="#5fb0ff" transparent opacity={0.14} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.BackSide} toneMapped={false} />
      </mesh>
      <points geometry={stars}>
        <pointsMaterial color="#ffffff" size={0.035} sizeAttenuation transparent opacity={0.85} depthWrite={false} toneMapped={false} />
      </points>

      {/* the core: lower module, ring hub, upper module, node and port */}
      <mesh geometry={geo.coreB} position-y={0.62}>
        <Flat color={L.hull} metalness={0.3} roughness={0.55} />
      </mesh>
      <mesh geometry={geo.dish} position-y={0.45} rotation-x={Math.PI}>
        <Flat color={L.trim} metalness={0.3} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={geo.core} position-y={1.2}>
        <Flat color={L.hull} metalness={0.3} roughness={0.55} />
      </mesh>
      {[0.8, 1.0, 1.38].map((y) => (
        <mesh key={y} geometry={geo.band} position-y={y}>
          <Flat color={L.trim} metalness={0.35} />
        </mesh>
      ))}
      <mesh geometry={geo.node} position-y={1.52}>
        <Flat color={L.hull} metalness={0.3} roughness={0.55} />
      </mesh>
      <mesh geometry={geo.port} position-y={TOPY - 0.06}>
        <Flat color={L.dark} metalness={0.4} />
      </mesh>
      <mesh geometry={geo.collar} position-y={TOPY}>
        <Flat color={L.trim} metalness={0.4} />
      </mesh>
      {/* radiators off the lower module */}
      {[-1, 1].map((sd) => (
        <mesh key={sd} geometry={geo.radiator} position={[0, 0.62, sd * 0.36]} rotation-y={Math.PI / 2}>
          <Flat color="#f2f4f8" metalness={0.1} />
        </mesh>
      ))}

      {/* the habitation ring on its spokes, turning */}
      <group ref={ring} position-y={CY}>
        <mesh geometry={geo.ring}>
          <Flat color={L.hull} metalness={0.3} roughness={0.5} />
        </mesh>
        <mesh geometry={geo.hub}>
          <Flat color={L.trim} metalness={0.35} />
        </mesh>
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} geometry={geo.spoke} rotation-y={(i / 4) * TAU} position={[Math.cos((i / 4) * TAU) * (RING / 2 + 0.11), 0, -Math.sin((i / 4) * TAU) * (RING / 2 + 0.11)]}>
            <Flat color={L.trim} metalness={0.4} />
          </mesh>
        ))}
        {wins.map((a, i) => (
          <mesh key={i} geometry={geo.window} position={[Math.cos(a) * (RING + 0.07), 0, -Math.sin(a) * (RING + 0.07)]} rotation-y={a + Math.PI / 2}>
            <Flat color={L.window} emissive={L.window} emissiveIntensity={1.4} />
          </mesh>
        ))}
      </group>

      {/* the truss and its solar wings */}
      <group position-y={1.3}>
        <mesh geometry={geo.truss}>
          <Flat color={L.trim} metalness={0.4} />
        </mesh>
        {Array.from({ length: 13 }, (_, i) => (
          <mesh key={i} geometry={geo.strut} position-x={(i - 6) * 0.23}>
            <Flat color={L.dark} metalness={0.4} />
          </mesh>
        ))}
        {[-1, 1].map((sd, i) => (
          <group key={sd} ref={(el) => (wings.current[i] = el)}>
            <SolarWing L={L} geo={geo} side={sd} />
          </group>
        ))}
        {/* nav lights at the truss ends, red to port and green to starboard */}
        {[
          [-1.5, '#ff3b3b'],
          [1.5, '#3bff7a'],
        ].map(([x, col], i) => (
          <mesh key={i} ref={(el) => (navs.current[i] = el)} geometry={geo.light} position-x={x}>
            <Flat color={col} emissive={col} emissiveIntensity={1} />
          </mesh>
        ))}
      </group>
      {/* a white beacon on a mast and another under the station */}
      <mesh geometry={geo.mast} position={[0.17, TOPY - 0.02, 0]}>
        <Flat color={L.dark} />
      </mesh>
      <mesh ref={(el) => (navs.current[2] = el)} geometry={geo.light} position={[0.17, TOPY + 0.13, 0]}>
        <Flat color="#ffffff" emissive="#ffffff" emissiveIntensity={1} />
      </mesh>
      <mesh ref={(el) => (navs.current[3] = el)} geometry={geo.light} position={[0, 0.38, 0]}>
        <Flat color="#ffd04a" emissive="#ffd04a" emissiveIntensity={1} />
      </mesh>

      {/* the visiting capsule: nose (docking end) down */}
      <group ref={cap} visible={false}>
        <mesh geometry={geo.capBody}>
          <Flat color={L.capsule} metalness={0.25} roughness={0.5} />
        </mesh>
        <mesh geometry={geo.capNose}>
          <Flat color={L.dark} metalness={0.4} />
        </mesh>
        <mesh geometry={geo.capPanel} position-y={0.04}>
          <Flat color={L.cell} emissive={L.glow} emissiveIntensity={0.4} />
        </mesh>
        <mesh geometry={geo.capWin} position={[0, 0.03, 0.095]}>
          <Flat color={L.window} emissive={L.window} emissiveIntensity={1.4} />
        </mesh>
        <mesh ref={flame} geometry={geo.flame} position-y={0.1}>
          <meshBasicMaterial color={L.heat} transparent opacity={0.85} toneMapped={false} />
        </mesh>
      </group>
      <Burst tap={dockKick} geometry={geo.puff} count={12} colors={['#ffffff', '#dfe6f2']} speed={0.7} gravity={0} size={0.04} life={0.9} origin={[0, TOPY + 0.02, 0]} spread={0.9} up={0.15} />
      <Burst tap={undockKick} geometry={geo.puff} count={10} colors={['#ffffff', '#dfe6f2']} speed={0.6} gravity={0} size={0.035} life={0.8} origin={[0, TOPY + 0.02, 0]} spread={0.9} up={0.15} seed={8} />
      <mesh geometry={geo.hit}>
        <meshBasicMaterial visible={false} />
      </mesh>
    </group>
  )
}

export default function SpaceStationScene({ background = '#141a2a', autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[3.6, 2.3, 4.8]} target={[0, 1.15, 0]} hint="The habitation ring turns, the solar wings tilt to follow the sun and the nav lights blink · tap it and a capsule flies in, docks at the port with a puff, waits, then undocks and flies away · Look swaps white, gold, grey and orange · drag to orbit">
      <SpaceStation {...props} />
    </Stage>
  )
}
