import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Flat, Stage, TAU, Tail, Trail, blob, cone, facet, useGeo, useTap } from './kit.jsx'

// A low-poly vintage biplane in flight among drifting clouds: a turned
// fuselage with an open cockpit and a goggled pilot whose scarf streams
// behind, two stacked wings braced by struts and crossed wires, a radial
// engine of cylinders in its cowl, a two-bladed propeller with a blur
// disc, a tail fin with a striped rudder, a tailplane, and wheels hanging
// on their struts. Left alone, the propeller spins, the clouds slide past
// and the plane banks gently from side to side and bobs on the air. Tap
// it and it does a barrel roll: a full turn about its own length while
// it arcs up and over, trailing a ribbon of white smoke from the tail.

const LOOKS = {
  red: { body: '#d63a33', wing: '#e2463d', accent: '#f2e6c9', strut: '#6b4a2f', cowl: '#3a3a42' },
  yellow: { body: '#f4c430', wing: '#f6cf45', accent: '#2a5bd7', strut: '#6b4a2f', cowl: '#3a3a42' },
  blue: { body: '#2f6fd0', wing: '#ece6d4', accent: '#e2463d', strut: '#5a4030', cowl: '#2c3140' },
  green: { body: '#4f8f4a', wing: '#c9b27a', accent: '#f2e6c9', strut: '#5a4030', cowl: '#33362c' },
}

// the fuselage outline from tail (-y) to nose (+y), turned and laid along z
const BODY = [
  [0.015, -0.78],
  [0.05, -0.62],
  [0.09, -0.36],
  [0.125, -0.08],
  [0.14, 0.16],
  [0.145, 0.36],
  [0.13, 0.4],
]
const ROLL = 1.9 // seconds for the barrel roll
const FLY_Y = 1.0
const ease = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * u * (u * (u * 6 - 15) + 10))

// a thin rod between two points
function rod(a, b) {
  const A = new THREE.Vector3(...a)
  const B = new THREE.Vector3(...b)
  const d = B.clone().sub(A)
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize())
  return { p: A.add(B).multiplyScalar(0.5).toArray(), q: q.toArray(), len: d.length() }
}

export function Biplane({ look = 'red' }) {
  const L = LOOKS[look] || LOOKS.red
  const { tap, handlers, clock } = useTap(1)
  const plane = useRef()
  const prop = useRef()
  const tail = useRef()
  const air = useRef()
  const clouds = useRef([])

  const geo = useGeo(
    () => ({
      body: facet(new THREE.LatheGeometry(BODY.map(([r, y]) => new THREE.Vector2(r, y)), 8), 0.005, 2).rotateX(Math.PI / 2),
      cowl: new THREE.CylinderGeometry(0.165, 0.15, 0.13, 10, 1, true).rotateX(Math.PI / 2),
      face: new THREE.CircleGeometry(0.15, 10),
      cyl: facet(new THREE.CylinderGeometry(0.028, 0.028, 0.1, 6), 0.003, 3),
      spinner: cone(0.05, 0.1, 6, 4).rotateX(Math.PI / 2),
      blade: facet(new THREE.BoxGeometry(0.055, 0.32, 0.016).translate(0, 0.17, 0), 0.003, 5),
      disc: new THREE.CircleGeometry(0.36, 18),
      wingLo: facet(new THREE.BoxGeometry(1.66, 0.032, 0.3, 4, 1, 1), 0.006, 6, [1, 0.4, 1]),
      wingHi: facet(new THREE.BoxGeometry(1.84, 0.032, 0.31, 4, 1, 1), 0.006, 7, [1, 0.4, 1]),
      roundel: new THREE.CircleGeometry(0.1, 10).rotateX(-Math.PI / 2),
      rod: new THREE.CylinderGeometry(1, 1, 1, 4),
      tailplane: facet(new THREE.BoxGeometry(0.58, 0.022, 0.16), 0.004, 8),
      fin: (() => {
        const s = new THREE.Shape()
        s.moveTo(0.06, 0)
        s.lineTo(-0.1, 0)
        s.lineTo(-0.13, 0.2)
        s.lineTo(-0.05, 0.22)
        s.closePath()
        return new THREE.ExtrudeGeometry(s, { depth: 0.018, bevelEnabled: false }).translate(0, 0, -0.009).rotateY(-Math.PI / 2)
      })(),
      stripe: new THREE.BoxGeometry(0.022, 0.05, 0.05),
      wheel: facet(new THREE.CylinderGeometry(0.085, 0.085, 0.045, 10).rotateZ(Math.PI / 2), 0.003, 9),
      hub: new THREE.CylinderGeometry(0.03, 0.03, 0.05, 6).rotateZ(Math.PI / 2),
      rim: new THREE.TorusGeometry(0.115, 0.014, 4, 10).rotateX(Math.PI / 2),
      screen: new THREE.PlaneGeometry(0.13, 0.07),
      helmet: facet(new THREE.IcosahedronGeometry(0.06, 1), 0.004, 10),
      goggle: new THREE.TorusGeometry(0.016, 0.006, 4, 8),
      puff: blob(0.2, 11),
      hit: new THREE.BoxGeometry(1.9, 0.75, 1.5).translate(0, 0.05, -0.1),
    }),
    [],
  )

  // struts, bracing wires and undercarriage legs
  const rods = useMemo(() => {
    const out = []
    for (const x of [-1, 1]) {
      out.push({ ...rod([x * 0.62, -0.1, 0.03], [x * 0.64, 0.25, 0.08]), r: 0.014, c: 'strut' })
      out.push({ ...rod([x * 0.62, -0.1, 0.23], [x * 0.64, 0.25, 0.28]), r: 0.014, c: 'strut' })
      out.push({ ...rod([x * 0.1, 0.1, 0.06], [x * 0.14, 0.25, 0.1]), r: 0.012, c: 'strut' })
      out.push({ ...rod([x * 0.1, 0.1, 0.24], [x * 0.14, 0.25, 0.27]), r: 0.012, c: 'strut' })
      out.push({ ...rod([x * 0.62, -0.1, 0.13], [x * 0.14, 0.25, 0.18]), r: 0.004, c: 'wire' })
      out.push({ ...rod([x * 0.64, 0.25, 0.18], [x * 0.12, -0.1, 0.13]), r: 0.004, c: 'wire' })
      out.push({ ...rod([x * 0.06, -0.12, 0.34], [x * 0.17, -0.36, 0.28]), r: 0.013, c: 'cowl' })
      out.push({ ...rod([x * 0.06, -0.12, 0.12], [x * 0.17, -0.36, 0.28]), r: 0.013, c: 'cowl' })
    }
    out.push({ ...rod([-0.2, -0.36, 0.28], [0.2, -0.36, 0.28]), r: 0.012, c: 'cowl' })
    out.push({ ...rod([0, -0.04, -0.66], [0, -0.1, -0.74]), r: 0.01, c: 'cowl' })
    return out
  }, [])

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05)
    const t = clock.elapsedTime
    const s = tap.since(t)
    const rolling = s >= 0 && s < ROLL
    const u = rolling ? s / ROLL : 0
    const th = TAU * ease(u)
    const o = plane.current
    const bank = 0.2 * Math.sin(t * 0.45)
    o.position.set(0.12 * Math.sin(t * 0.45) + 0.18 * Math.sin(th), FLY_Y + 0.06 * Math.sin(t * 0.9) + 0.3 * Math.sin(Math.PI * u), 0)
    o.rotation.set(0.04 * Math.sin(t * 0.9 + 0.6) - 0.12 * Math.sin(Math.PI * u), -0.12 * Math.sin(t * 0.45), bank + th)
    prop.current.rotation.z += dt * 38
    // the air streams past: the smoke trail and the clouds slide back
    air.current.position.z -= dt * 1.8
    clouds.current.forEach((c, i) => {
      if (!c) return
      const k = ((t * 0.35 + i / 3) % 1)
      c.position.z = 1.8 - k * 4.4
      c.scale.setScalar(Math.max(0.001, Math.min(1, k * 6, (1 - k) * 6)) * [0.9, 0.7, 0.8][i])
    })
  })

  const mat = (c) => (c === 'wire' ? '#2a2a30' : L[c])

  return (
    <group {...handlers}>
      {/* clouds drifting past */}
      {[
        [-1.4, 0.5],
        [1.35, 1.7],
        [1.5, 0.45],
      ].map(([x, y], i) => (
        <group key={i} ref={(el) => (clouds.current[i] = el)} position={[x, y, 0]}>
          <mesh geometry={geo.puff} scale={[1.4, 0.8, 1]}>
            <Flat color="#ffffff" />
          </mesh>
          <mesh geometry={geo.puff} position={[0.2, -0.04, 0.05]} scale={[0.9, 0.65, 0.8]}>
            <Flat color="#f2f4f8" />
          </mesh>
          <mesh geometry={geo.puff} position={[-0.2, -0.05, -0.03]} scale={[0.8, 0.6, 0.8]}>
            <Flat color="#f2f4f8" />
          </mesh>
        </group>
      ))}

      {/* smoke from the tail during a roll, left behind in the moving air */}
      <group ref={air}>
        <Trail target={tail} count={34} every={0.03} color="#f6f6f6" size={0.06} grow={0.05} opacity={0.85} active={() => { const s = tap.since(clock.elapsedTime); return s >= 0 && s < ROLL + 0.2 }} />
      </group>

      <group ref={plane} position-y={FLY_Y}>
        {/* fuselage, cockpit and pilot */}
        <mesh geometry={geo.body}>
          <Flat color={L.body} />
        </mesh>
        <mesh geometry={geo.rim} position={[0, 0.11, -0.12]} scale={[0.8, 1, 1]}>
          <Flat color={L.strut} />
        </mesh>
        <mesh geometry={geo.screen} position={[0, 0.17, 0.0]} rotation-x={-0.35}>
          <meshStandardMaterial color="#cfeaff" transparent opacity={0.45} side={THREE.DoubleSide} roughness={0.1} />
        </mesh>
        <group position={[0, 0.17, -0.13]}>
          <mesh geometry={geo.helmet}>
            <Flat color="#6b4a2f" />
          </mesh>
          {[-1, 1].map((x) => (
            <mesh key={x} geometry={geo.goggle} position={[x * 0.022, 0.012, 0.055]}>
              <Flat color="#c9a04a" metalness={0.5} roughness={0.35} />
            </mesh>
          ))}
          <Tail position={[0.02, -0.05, -0.04]} segs={4} length={0.26} r0={0.018} r1={0.012} sides={4} colors={['#ffffff', '#f2f2f2']} rate={1.6} amp={0.3} lag={0.9} axis="y" droop={0.12} />
        </group>

        {/* engine and propeller */}
        <group position-z={0.42}>
          <mesh geometry={geo.cowl}>
            <Flat color={L.cowl} side={THREE.DoubleSide} metalness={0.3} roughness={0.5} />
          </mesh>
          <mesh geometry={geo.face} position-z={-0.02}>
            <Flat color="#2a2a30" />
          </mesh>
          {Array.from({ length: 7 }, (_, i) => {
            const a = (i / 7) * TAU
            return (
              <mesh key={i} geometry={geo.cyl} position={[Math.cos(a) * 0.1, Math.sin(a) * 0.1, 0.0]} rotation-z={a - Math.PI / 2}>
                <Flat color="#8d9099" metalness={0.5} roughness={0.4} />
              </mesh>
            )
          })}
          <group position-z={0.08}>
            <mesh geometry={geo.spinner}>
              <Flat color={L.accent} />
            </mesh>
            <group ref={prop}>
              {[0, Math.PI].map((r) => (
                <mesh key={r} geometry={geo.blade} rotation={[0, 0, r]}>
                  <Flat color="#7a5636" />
                </mesh>
              ))}
            </group>
            <mesh geometry={geo.disc} position-z={0.01}>
              <meshBasicMaterial color="#ffffff" transparent opacity={0.16} depthWrite={false} side={THREE.DoubleSide} />
            </mesh>
          </group>
        </group>

        {/* wings */}
        <mesh geometry={geo.wingLo} position={[0, -0.1, 0.13]}>
          <Flat color={L.wing} />
        </mesh>
        <mesh geometry={geo.wingHi} position={[0, 0.25, 0.18]}>
          <Flat color={L.wing} />
        </mesh>
        {[-0.62, 0.62].map((x) => (
          <group key={x} position={[x, 0.268, 0.18]}>
            <mesh geometry={geo.roundel}>
              <Flat color={L.accent} />
            </mesh>
            <mesh geometry={geo.roundel} position-y={0.002} scale={0.55}>
              <Flat color={L.body} />
            </mesh>
          </group>
        ))}
        {rods.map((r, i) => (
          <mesh key={i} geometry={geo.rod} position={r.p} quaternion={r.q} scale={[r.r, r.len, r.r]}>
            <Flat color={mat(r.c)} />
          </mesh>
        ))}

        {/* tail */}
        <mesh geometry={geo.tailplane} position={[0, 0.0, -0.68]}>
          <Flat color={L.wing} />
        </mesh>
        <group position={[0, 0.02, -0.64]}>
          <mesh geometry={geo.fin}>
            <Flat color={L.body} side={THREE.DoubleSide} />
          </mesh>
          {[0.04, 0.14].map((y) => (
            <mesh key={y} geometry={geo.stripe} position={[0, y, -0.1]}>
              <Flat color={L.accent} />
            </mesh>
          ))}
        </group>
        <group ref={tail} position={[0, 0.02, -0.8]} />

        {/* wheels */}
        {[-1, 1].map((x) => (
          <group key={x} position={[x * 0.2, -0.36, 0.28]}>
            <mesh geometry={geo.wheel}>
              <Flat color="#26252b" />
            </mesh>
            <mesh geometry={geo.hub} position-x={x * 0.005}>
              <Flat color={L.accent} />
            </mesh>
          </group>
        ))}

        {/* an invisible box round the plane, so a tap on it always lands */}
        <mesh geometry={geo.hit}>
          <meshBasicMaterial visible={false} />
        </mesh>
      </group>
    </group>
  )
}

export default function BiplaneScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[3.6, 2.0, 4.4]} target={[0, 0.95, 0]} hint="The propeller spins and the plane banks gently and bobs as clouds drift past, on its own · tap it and it does a barrel roll trailing white smoke · Look swaps red, yellow, blue and green · drag to orbit">
      <Biplane {...props} />
    </Stage>
  )
}
