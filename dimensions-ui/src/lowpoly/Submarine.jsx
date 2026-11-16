import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Flat, Stage, Sway, TAU, blob, cone, facet, terrainGeo, useGeo, useTap } from './kit.jsx'

// A little low-poly submarine hanging in open water over a sandy patch of
// sea floor with rocks and weed: a turned capsule hull with painted bands,
// a conning tower with sail planes and a hatch, a periscope, glowing
// portholes down each side, cross-shaped stern fins and a five-bladed
// propeller. Left alone, it drifts gently up and down, the propeller turns
// and the periscope swings round to look about, with now and then a bubble
// from the stern. Tap it and it pitches nose-down and dives, propeller
// racing and a stream of bubbles rising behind it, then levels off and
// climbs back to where it was.

const LOOKS = {
  yellow: { hull: '#f6c531', tower: '#f2bb24', band: '#e2563b', fin: '#e2563b', prop: '#c9a04a', rim: '#7d848f' },
  grey: { hull: '#7f8792', tower: '#6c737e', band: '#3d434c', fin: '#3d434c', prop: '#b08d48', rim: '#4a5059' },
  red: { hull: '#d8443a', tower: '#c93a32', band: '#f2efe6', fin: '#f2efe6', prop: '#d9b24c', rim: '#e9e4d8' },
  teal: { hull: '#2fa59b', tower: '#27968c', band: '#f2c14e', fin: '#f2c14e', prop: '#e0b04a', rim: '#d8d2c2' },
}

// the hull's outline from stern (-y) to bow (+y), turned and laid along z
const HULL = [
  [0.001, -0.84],
  [0.06, -0.82],
  [0.12, -0.68],
  [0.2, -0.48],
  [0.26, -0.24],
  [0.28, 0],
  [0.28, 0.3],
  [0.265, 0.48],
  [0.22, 0.62],
  [0.13, 0.72],
  [0.001, 0.76],
]
const radiusAt = (z) => {
  for (let i = 1; i < HULL.length; i++)
    if (HULL[i][1] >= z) {
      const [r0, y0] = HULL[i - 1]
      const [r1, y1] = HULL[i]
      return r0 + ((r1 - r0) * (z - y0)) / (y1 - y0)
    }
  return 0
}
const REST_Y = 1.0
const DIVE = 3.4 // seconds for the dive and climb back
const DEPTH = 0.4
const NBUB = 26

export function Submarine({ look = 'yellow' }) {
  const L = LOOKS[look] || LOOKS.yellow
  const { tap, handlers, clock } = useTap(1)
  const sub = useRef()
  const prop = useRef()
  const scope = useRef()
  const nozzle = useRef()
  const bubbles = useRef()
  const bubRefs = useRef([])
  const st = useRef({ spin: 0, acc: 0, next: 0, list: Array.from({ length: NBUB }, () => ({ t0: -99, p: new THREE.Vector3(), ph: Math.random() * TAU, s: 1 })) })

  const geo = useGeo(
    () => ({
      hull: facet(new THREE.LatheGeometry(HULL.map(([r, y]) => new THREE.Vector2(r, y)), 12), 0.006, 2).rotateX(Math.PI / 2),
      band: new THREE.TorusGeometry(1, 0.045, 4, 12),
      tower: facet(new THREE.CylinderGeometry(0.075, 0.095, 0.24, 8, 1).scale(1, 1, 2.3), 0.004, 3),
      cap: new THREE.CylinderGeometry(0.06, 0.075, 0.03, 8).scale(1, 1, 2.3),
      hatch: new THREE.CylinderGeometry(0.035, 0.035, 0.03, 8),
      plane: facet(new THREE.BoxGeometry(0.36, 0.016, 0.09), 0.004, 4),
      tube: new THREE.CylinderGeometry(0.014, 0.014, 0.2, 6).translate(0, 0.1, 0),
      head: new THREE.BoxGeometry(0.04, 0.045, 0.08),
      lens: new THREE.CylinderGeometry(0.016, 0.016, 0.01, 6).rotateX(Math.PI / 2),
      mast: new THREE.CylinderGeometry(0.006, 0.006, 0.14, 4).translate(0, 0.07, 0),
      finV: facet(new THREE.BoxGeometry(0.016, 0.46, 0.15), 0.003, 5),
      finH: facet(new THREE.BoxGeometry(0.46, 0.016, 0.15), 0.003, 6),
      hub: cone(0.05, 0.1, 6, 7).rotateX(-Math.PI / 2),
      blade: facet(new THREE.BoxGeometry(0.06, 0.15, 0.012).translate(0, 0.09, 0), 0.003, 8),
      port: new THREE.CylinderGeometry(0.042, 0.042, 0.03, 8).rotateZ(Math.PI / 2),
      portRim: new THREE.TorusGeometry(0.046, 0.011, 4, 8).rotateY(Math.PI / 2),
      lamp: new THREE.CylinderGeometry(0.05, 0.05, 0.02, 8).rotateX(Math.PI / 2),
      bubble: new THREE.IcosahedronGeometry(1, 0),
      floor: terrainGeo({ radius: 1.2, height: 0.12, seed: 5, rings: 4, segs: 14, rough: 0.3, profile: 'dome', bands: [[0, '#e2c890'], [0.45, '#ebd5a2'], [0.8, '#f2e0b4']] }),
      rock: blob(1, 9, 1),
      weed: cone(0.03, 0.13, 4, 10),
      hit: new THREE.BoxGeometry(0.62, 0.8, 1.75).translate(0, 0.08, 0),
    }),
    [],
  )

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05)
    const t = clock.elapsedTime
    const s = tap.since(t)
    const diving = s >= 0 && s < DIVE
    const u = diving ? s / DIVE : 0
    // depth follows a smooth dip; pitch follows the rate of descent
    const depth = -DEPTH * Math.sin(Math.PI * u) ** 2
    const rate = (-DEPTH * Math.PI * Math.sin(2 * Math.PI * u)) / DIVE
    const o = sub.current
    o.position.y = REST_Y + 0.07 * Math.sin(t * 0.8) + depth
    o.position.z = (diving ? 0.25 * Math.sin(Math.PI * u) : 0)
    o.rotation.x = 0.04 * Math.sin(t * 0.8 + 1.4) - rate * 1.1
    o.rotation.y = 0.12 * Math.sin(t * 0.25)
    o.rotation.z = 0.025 * Math.sin(t * 0.6)

    const S = st.current
    S.spin += dt * (5 + (diving ? 14 * Math.sin(Math.PI * Math.min(1, u * 1.6)) : 0))
    prop.current.rotation.z = S.spin
    scope.current.rotation.y = 1.3 * Math.sin(t * 0.45) + 0.4 * Math.sin(t * 1.1)

    // bubbles from the stern: a trickle at rest, a stream on a dive
    S.acc += dt
    const every = diving && u < 0.75 ? 0.045 : 0.6
    while (S.acc > every) {
      S.acc -= every
      const b = S.list[S.next++ % NBUB]
      b.t0 = t
      b.s = 0.7 + Math.random() * 0.6
      nozzle.current.getWorldPosition(b.p)
      bubbles.current.worldToLocal(b.p)
      b.p.x += (Math.random() - 0.5) * 0.08
      b.p.y += (Math.random() - 0.5) * 0.08
    }
    S.list.forEach((b, i) => {
      const m = bubRefs.current[i]
      if (!m) return
      const age = t - b.t0
      m.visible = age >= 0 && age < 1.8
      if (!m.visible) return
      m.position.set(b.p.x + Math.sin(age * 5 + b.ph) * 0.03, b.p.y + age * 0.42 * b.s, b.p.z - age * 0.05 + Math.cos(age * 4 + b.ph) * 0.02)
      m.scale.setScalar((0.026 + age * 0.018) * b.s)
      m.material.opacity = 0.85 * (1 - age / 1.8)
    })
  })

  const ports = [0.36, 0.12, -0.12]

  return (
    <group {...handlers}>
      {/* the sea floor below */}
      <mesh geometry={geo.floor}>
        <Flat vertexColors color="#ffffff" />
      </mesh>
      {[
        [0.55, 0.05, -0.35, 0.14],
        [-0.6, 0.04, 0.2, 0.1],
        [0.25, 0.04, 0.6, 0.08],
      ].map(([x, y, z, s], i) => (
        <mesh key={i} geometry={geo.rock} position={[x, y, z]} scale={[s * 1.3, s * 0.8, s]} rotation-y={i * 1.7}>
          <Flat color={i % 2 ? '#8e8a82' : '#a39e94'} />
        </mesh>
      ))}
      {[
        [0.42, -0.5],
        [-0.48, 0.42],
        [-0.3, -0.55],
        [0.66, 0.15],
      ].map(([x, z], k) => (
        <group key={k} position={[x, 0.05, z]}>
          {[0, 1, 2, 3].reduceRight(
            (child, i) => (
              <group position-y={i === 0 ? 0 : 0.11}>
                <Sway i={i + k} rate={0.3} amp={0.16} lag={0.7} axis="z">
                  <mesh geometry={geo.weed}>
                    <Flat color={i % 2 ? '#3f9a4a' : '#55b05e'} />
                  </mesh>
                  {child}
                </Sway>
              </group>
            ),
            null,
          )}
        </group>
      ))}

      {/* the submarine */}
      <group ref={sub} position-y={REST_Y}>
        <mesh geometry={geo.hull}>
          <Flat color={L.hull} />
        </mesh>
        {[0.5, -0.4].map((z) => (
          <mesh key={z} geometry={geo.band} position-z={z} scale={[radiusAt(z) + 0.004, radiusAt(z) + 0.004, 1]}>
            <Flat color={L.band} />
          </mesh>
        ))}

        {/* conning tower, sail planes, hatch and periscope */}
        <group position={[0, 0.36, 0.1]}>
          <mesh geometry={geo.tower}>
            <Flat color={L.tower} />
          </mesh>
          <mesh geometry={geo.cap} position-y={0.13}>
            <Flat color={L.band} />
          </mesh>
          <mesh geometry={geo.hatch} position={[0, 0.155, -0.08]}>
            <Flat color={L.rim} />
          </mesh>
          <mesh geometry={geo.plane} position={[0, 0.04, 0.1]}>
            <Flat color={L.fin} />
          </mesh>
          <mesh geometry={geo.mast} position={[0, 0.14, -0.13]} rotation-x={-0.25}>
            <Flat color={L.rim} />
          </mesh>
          <group ref={scope} position={[0, 0.14, 0.07]}>
            <mesh geometry={geo.tube}>
              <Flat color={L.rim} />
            </mesh>
            <mesh geometry={geo.head} position={[0, 0.21, 0.02]}>
              <Flat color={L.rim} />
            </mesh>
            <mesh geometry={geo.lens} position={[0, 0.21, 0.062]}>
              <Flat color="#1d2a3a" roughness={0.2} />
            </mesh>
          </group>
        </group>

        {/* glowing portholes and a headlamp */}
        {[-1, 1].map((x) =>
          ports.map((z) => (
            <group key={`${x}${z}`} position={[x * (radiusAt(z) - 0.012), 0.03, z]}>
              <mesh geometry={geo.port}>
                <Flat color="#fff1b8" emissive="#ffc94a" emissiveIntensity={0.9} roughness={0.3} />
              </mesh>
              <mesh geometry={geo.portRim} position-x={x * 0.01}>
                <Flat color={L.rim} />
              </mesh>
            </group>
          )),
        )}
        <mesh geometry={geo.lamp} position={[0, 0.0, 0.755]}>
          <Flat color="#fff6d0" emissive="#ffe08a" emissiveIntensity={1} />
        </mesh>

        {/* stern fins and propeller */}
        <mesh geometry={geo.finV} position-z={-0.66}>
          <Flat color={L.fin} />
        </mesh>
        <mesh geometry={geo.finH} position-z={-0.66}>
          <Flat color={L.fin} />
        </mesh>
        <group ref={prop} position-z={-0.86}>
          <mesh geometry={geo.hub}>
            <Flat color={L.prop} metalness={0.5} roughness={0.4} />
          </mesh>
          {Array.from({ length: 5 }, (_, i) => (
            <group key={i} rotation-z={(i / 5) * TAU}>
              <mesh geometry={geo.blade} rotation-y={0.55}>
                <Flat color={L.prop} metalness={0.5} roughness={0.4} />
              </mesh>
            </group>
          ))}
        </group>
        <group ref={nozzle} position={[0, 0.05, -0.95]} />

        {/* an invisible box round the hull, so a tap on the sub always lands */}
        <mesh geometry={geo.hit}>
          <meshBasicMaterial visible={false} />
        </mesh>
      </group>

      {/* bubbles, left behind in the water */}
      <group ref={bubbles}>
        {st.current.list.map((_, i) => (
          <mesh key={i} ref={(el) => (bubRefs.current[i] = el)} geometry={geo.bubble} visible={false}>
            <meshStandardMaterial color="#ffffff" emissive="#dff3ff" emissiveIntensity={0.3} flatShading roughness={0.3} transparent depthWrite={false} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

export default function SubmarineScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[3.6, 2.0, 4.4]} target={[0, 0.8, 0]} hint="The sub drifts up and down, its propeller turning and periscope looking about, on its own · tap it and it pitches nose-down and dives in a stream of bubbles, then levels and climbs back · Look swaps yellow, grey, red and teal · drag to orbit">
      <Submarine {...props} />
    </Stage>
  )
}
