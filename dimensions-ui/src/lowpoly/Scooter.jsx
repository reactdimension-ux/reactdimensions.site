import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Burst, Flat, Particles, Stage, TAU, facet, rng, useGeo, useTap, wobble } from './kit.jsx'

// A low-poly retro step-through scooter parked on a round of cobbles by a
// street lamp: a bulbous rear cowl over the engine with a long seat on top,
// a flat floorboard, a curved leg shield, a domed front mudguard over the
// small front wheel, a steering column up to a headset with a round
// headlamp, a chrome handlebar with grips and two round mirrors on stalks,
// a silencer down the right side and a tail lamp. Left alone, the engine
// idles: the body shivers on its wheels and the silencer coughs little
// puffs. Tap it and it revs: a cloud from the exhaust, the front lifts in a
// wheelie as it rolls forward leaving a trail of smoke, the nose drops and
// bounces on the suspension, and after a pause it rolls gently back to its
// spot. The wheels turn with every bit of travel.

const LOOKS = {
  mint: { body: '#9fd8c2', dark: '#7dbfa8', seat: '#5b3b2c', trim: '#f4efe2', badge: '#e06a4f' },
  red: { body: '#d7453a', dark: '#b4352d', seat: '#2d2b30', trim: '#f4efe2', badge: '#f2c24a' },
  cream: { body: '#efe2c2', dark: '#d9c9a2', seat: '#7a4a2e', trim: '#8a5a3a', badge: '#3f8f86' },
}

const RY = 0.07 // top of the cobbles, where the wheels sit
const R = 0.14 // wheel radius
const AX = -0.4 // rear axle x
const FX = 0.5 // front axle x
const D = 0.55 // how far a wheelie rolls it forward
const CHROME = '#d4d8de'
const TYRE = '#26262b'
const PIPE = [-0.62, 0.13, -0.13] // the silencer's tip, in the body's frame

const clamp01 = (u) => Math.min(1, Math.max(0, u))
const smooth = (u) => {
  const k = clamp01(u)
  return k * k * (3 - 2 * k)
}

// A tube from a to b (in x/y), for the steering column and the fork.
function tube(r, a, b, sides = 6) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1])
  return new THREE.CylinderGeometry(r, r, len, sides).rotateZ(-Math.atan2(b[0] - a[0], b[1] - a[1])).translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0)
}

function Wheel({ geo, wheelRef, L, ...props }) {
  return (
    <group {...props}>
      <group ref={wheelRef}>
        <mesh geometry={geo.tyre}>
          <Flat color={TYRE} roughness={0.95} />
        </mesh>
        <mesh geometry={geo.rim}>
          <Flat color={L.trim} roughness={0.5} />
        </mesh>
        <mesh geometry={geo.cap}>
          <Flat color={CHROME} metalness={0.5} roughness={0.35} />
        </mesh>
        {[0, 1, 2, 3].map((k) => (
          <mesh key={k} geometry={geo.bolt} position={[Math.cos((k / 4) * TAU) * 0.06, Math.sin((k / 4) * TAU) * 0.06, 0]}>
            <Flat color="#6a6c72" />
          </mesh>
        ))}
      </group>
    </group>
  )
}

export function Scooter({ look = 'mint' }) {
  const L = LOOKS[look] || LOOKS.mint
  const { tap, handlers, clock } = useTap(1.4)
  const ride = useRef()
  const pivot = useRef()
  const body = useRef()
  const wheels = useRef([])
  const tip = useRef()
  const cobbles = useRef()
  const trailPuffs = useRef([])
  const trail = useRef({ next: 0, n: 0, p: Array.from({ length: 16 }, () => ({ born: -99, x: 0, y: 0, z: 0 })) })
  const v = useMemo(() => new THREE.Vector3(), [])
  const root = useRef()

  const geo = useGeo(() => {
    // the leg shield: a curved panel, the arc facing forward
    const shield = new THREE.CylinderGeometry(0.17, 0.205, 0.52, 12, 2, true, Math.PI / 2 - 1.15, 2.3)
    return {
      base: facet(new THREE.CylinderGeometry(1.4, 1.44, 0.04, 18, 1).translate(0, 0.02, 0), 0.02, 1, [1, 0.2, 1]),
      cobble: facet(new THREE.BoxGeometry(1, 1, 1, 1, 1, 1), 0.12, 2, [1, 0.6, 1]),
      tyre: facet(new THREE.CylinderGeometry(R, R, 0.075, 12, 1).rotateX(Math.PI / 2), 0.004, 3),
      rim: new THREE.CylinderGeometry(R * 0.66, R * 0.66, 0.085, 10, 1).rotateX(Math.PI / 2),
      cap: new THREE.CylinderGeometry(0.03, 0.03, 0.1, 6, 1).rotateX(Math.PI / 2),
      bolt: new THREE.BoxGeometry(0.018, 0.018, 0.092),
      cowl: facet(new THREE.SphereGeometry(1, 12, 8), 0.025, 4),
      cowlTrim: new THREE.TorusGeometry(1, 0.07, 3, 20).rotateX(Math.PI / 2),
      engine: facet(new THREE.BoxGeometry(0.26, 0.12, 0.13), 0.006, 5),
      silencer: facet(new THREE.CylinderGeometry(0.04, 0.045, 0.3, 8).rotateZ(Math.PI / 2), 0.003, 6),
      pipeTip: new THREE.CylinderGeometry(0.022, 0.022, 0.04, 6).rotateZ(Math.PI / 2),
      seat: facet(new THREE.CapsuleGeometry(0.075, 0.3, 3, 8).rotateZ(Math.PI / 2), 0.006, 7),
      floor: facet(new THREE.BoxGeometry(0.46, 0.05, 0.25), 0.004, 8),
      tunnel: facet(new THREE.BoxGeometry(0.4, 0.07, 0.17), 0.004, 9),
      strip: new THREE.BoxGeometry(0.3, 0.008, 0.018),
      shield: facet(shield, 0.004, 10),
      fender: facet(new THREE.SphereGeometry(1, 10, 5, 0, TAU, 0, Math.PI / 2), 0.02, 11),
      fork: tube(0.016, [FX, 0.14], [FX - 0.03, 0.3]),
      column: tube(0.026, [FX - 0.03, 0.33], [0.3, 0.86], 8),
      horn: facet(new THREE.BoxGeometry(0.06, 0.12, 0.09), 0.004, 12),
      grille: new THREE.BoxGeometry(0.012, 0.012, 0.07),
      headset: facet(new THREE.CapsuleGeometry(0.06, 0.12, 2, 8).rotateX(Math.PI / 2), 0.004, 13),
      lampBody: new THREE.CylinderGeometry(0.065, 0.058, 0.06, 12).rotateZ(-Math.PI / 2),
      lampRing: new THREE.TorusGeometry(0.06, 0.012, 4, 12).rotateY(Math.PI / 2),
      lens: new THREE.CylinderGeometry(0.052, 0.052, 0.01, 12).rotateZ(-Math.PI / 2),
      bar: new THREE.CylinderGeometry(0.014, 0.014, 0.52, 6).rotateX(Math.PI / 2),
      grip: new THREE.CylinderGeometry(0.022, 0.022, 0.08, 6).rotateX(Math.PI / 2),
      stalk: new THREE.CylinderGeometry(0.007, 0.007, 0.17, 4).translate(0, 0.085, 0),
      mirror: new THREE.CylinderGeometry(0.042, 0.042, 0.016, 10).rotateZ(Math.PI / 2),
      glass: new THREE.CylinderGeometry(0.034, 0.034, 0.004, 10).rotateZ(Math.PI / 2),
      tail: new THREE.BoxGeometry(0.03, 0.04, 0.07),
      badge: new THREE.CylinderGeometry(0.025, 0.025, 0.01, 8).rotateZ(Math.PI / 2),
      pole: facet(new THREE.CylinderGeometry(0.022, 0.03, 1.25, 6).translate(0, 0.625, 0), 0.002, 14),
      poleFoot: new THREE.CylinderGeometry(0.06, 0.07, 0.1, 6).translate(0, 0.05, 0),
      lantern: new THREE.CylinderGeometry(0.07, 0.045, 0.14, 6),
      lanternCap: new THREE.ConeGeometry(0.1, 0.07, 6).translate(0, 0.035, 0),
      bollard: facet(new THREE.CylinderGeometry(0.045, 0.05, 0.26, 7).translate(0, 0.13, 0), 0.003, 15),
      puff: facet(new THREE.IcosahedronGeometry(1, 0), 0.1, 16),
      hit: new THREE.BoxGeometry(2.4, 1.2, 0.8),
    }
  }, [])

  // cobbles laid in staggered rows, each a little different in size and tone
  const stones = useMemo(() => {
    const r = rng(21)
    const out = []
    const S = 0.155
    for (let j = -10; j <= 10; j++)
      for (let i = -10; i <= 10; i++) {
        const x = (i + (j % 2 ? 0.5 : 0)) * S + (r() - 0.5) * 0.02
        const z = j * S * 0.9 + (r() - 0.5) * 0.02
        if (Math.hypot(x, z) > 1.33) continue
        const c = ['#a9a49c', '#9a958e', '#b8b2a8', '#8e8a84', '#c2bcb0', '#a39a8c'][Math.floor(r() * 6)]
        out.push({ x, z, w: S * (0.78 + r() * 0.12), d: S * 0.9 * (0.76 + r() * 0.12), h: 0.03 + r() * 0.01, ry: (r() - 0.5) * 0.25, c })
      }
    return out
  }, [])
  useEffect(() => {
    const m = cobbles.current
    const o = new THREE.Object3D()
    const c = new THREE.Color()
    stones.forEach((s, i) => {
      o.position.set(s.x, 0.04 + s.h / 2 - 0.004, s.z)
      o.rotation.set(0, s.ry, 0)
      o.scale.set(s.w, s.h, s.d)
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
      m.setColorAt(i, c.set(s.c))
    })
    m.instanceMatrix.needsUpdate = true
    m.instanceColor.needsUpdate = true
  }, [stones])

  const revving = () => {
    const s = tap.since(clock.elapsedTime)
    return s >= 0 && s < 1.6 ? 1 : 0.55
  }

  useFrame(() => {
    const t = clock.elapsedTime
    const s = tap.since(t)
    // forward on the wheelie, a pause, then a gentle roll back
    const x = s < 2.4 ? D * smooth((s - 0.12) / 1.6) : D * (1 - smooth((s - 2.4) / 1.7))
    ride.current.position.x = x
    // the wheels roll with the travel (forward is clockwise seen from +z)
    wheels.current.forEach((w) => w && (w.rotation.z = -x / R))
    // the wheelie: up, hold, down, with a bounce on the suspension
    const up = smooth((s - 0.08) / 0.32) - smooth((s - 1.05) / 0.33)
    pivot.current.rotation.z = 0.3 * up + 0.05 * wobble(s - 1.38, 17, 5) - 0.02 * Math.sin(Math.PI * clamp01((s - 2.4) / 1.7))
    // the engine shiver, harder while it revs
    const rev = s >= 0 && s < 1.5 ? 2.2 : 1
    body.current.position.y = rev * (0.0035 * Math.sin(t * 57) + 0.0025 * Math.sin(t * 39 + 1))
    body.current.rotation.x = rev * 0.006 * Math.sin(t * 46)
    body.current.rotation.z = rev * 0.004 * Math.sin(t * 33 + 2)
    // a trail of smoke left on the cobbles while it rolls away
    const T = trail.current
    if (s >= 0.1 && s < 1.7 && t >= T.next && tip.current && root.current) {
      T.next = t + 0.06
      tip.current.getWorldPosition(v)
      root.current.worldToLocal(v)
      Object.assign(T.p[T.n++ % T.p.length], { born: t, x: v.x, y: v.y, z: v.z })
    }
    T.p.forEach((p, i) => {
      const m = trailPuffs.current[i]
      if (!m) return
      const age = t - p.born
      m.visible = age >= 0 && age < 1.2
      if (!m.visible) return
      m.position.set(p.x - age * 0.05, p.y + age * 0.18, p.z - age * 0.04)
      m.scale.setScalar(0.035 + age * 0.07)
      m.rotation.set(age * 2 + i, age, 0)
      m.material.opacity = 0.6 * (1 - age / 1.2) ** 1.4
    })
  })

  return (
    <group ref={root} {...handlers}>
      {/* the cobbled patch */}
      <mesh geometry={geo.base}>
        <Flat color="#6f6b66" />
      </mesh>
      <instancedMesh ref={cobbles} args={[geo.cobble, undefined, stones.length]}>
        <Flat color="#ffffff" />
      </instancedMesh>
      {/* a street lamp and a bollard at the kerb */}
      <group position={[-1.1, 0.07, -0.2]}>
        <mesh geometry={geo.poleFoot}>
          <Flat color="#2f3a36" />
        </mesh>
        <mesh geometry={geo.pole}>
          <Flat color="#2f3a36" />
        </mesh>
        <mesh geometry={geo.lantern} position-y={1.31}>
          <Flat color="#fff1c2" emissive="#ffd88a" emissiveIntensity={0.85} />
        </mesh>
        <mesh geometry={geo.lanternCap} position-y={1.38}>
          <Flat color="#2f3a36" />
        </mesh>
      </group>
      {[
        [0.55, -1.0],
        [1.05, -0.62],
      ].map(([x, z]) => (
        <mesh key={x} geometry={geo.bollard} position={[x, 0.07, z]}>
          <Flat color="#2f3a36" />
        </mesh>
      ))}

      <group ref={ride} position-y={RY}>
        {/* the frame pivots about the rear axle for the wheelie */}
        <group ref={pivot} position={[AX, R, 0]}>
          <group position={[-AX, -R, 0]}>
            <Wheel geo={geo} L={L} wheelRef={(el) => (wheels.current[0] = el)} position={[AX, R, 0]} />
            <Wheel geo={geo} L={L} wheelRef={(el) => (wheels.current[1] = el)} position={[FX, R, 0]} />
            <mesh geometry={geo.fork}>
              <Flat color={CHROME} metalness={0.5} roughness={0.35} />
            </mesh>

            {/* everything sprung shivers with the engine */}
            <group ref={body}>
              {/* rear cowl over the engine, with a trim line round its waist */}
              <mesh geometry={geo.cowl} position={[-0.3, 0.37, 0]} scale={[0.36, 0.2, 0.2]}>
                <Flat color={L.body} />
              </mesh>
              <mesh geometry={geo.cowlTrim} position={[-0.3, 0.33, 0]} scale={[0.355, 0.5, 0.197]}>
                <Flat color={L.trim} roughness={0.5} />
              </mesh>
              <mesh geometry={geo.badge} position={[-0.663, 0.36, 0]}>
                <Flat color={L.badge} />
              </mesh>
              <mesh geometry={geo.tail} position={[-0.64, 0.46, 0]}>
                <Flat color="#e0323a" emissive="#ff2a2a" emissiveIntensity={0.6} />
              </mesh>
              <mesh geometry={geo.engine} position={[-0.32, 0.16, 0.0]}>
                <Flat color="#3a3b42" />
              </mesh>
              {/* the silencer down the right side */}
              <mesh geometry={geo.silencer} position={[-0.45, 0.13, -0.13]}>
                <Flat color={CHROME} metalness={0.55} roughness={0.3} />
              </mesh>
              <mesh geometry={geo.pipeTip} position={[-0.6, 0.13, -0.13]}>
                <Flat color="#3a3b42" />
              </mesh>
              <group ref={tip} position={PIPE} />
              {/* the long seat */}
              <mesh geometry={geo.seat} position={[-0.27, 0.56, 0]} scale={[1, 0.62, 1.15]}>
                <Flat color={L.seat} roughness={0.7} />
              </mesh>
              {/* floorboard with rubber strips, and the tunnel under it */}
              <mesh geometry={geo.floor} position={[0.08, 0.2, 0]}>
                <Flat color={L.body} />
              </mesh>
              <mesh geometry={geo.tunnel} position={[0.06, 0.15, 0]}>
                <Flat color={L.dark} />
              </mesh>
              {[-0.08, -0.03, 0.02, 0.07].map((z) => (
                <mesh key={z} geometry={geo.strip} position={[0.08, 0.227, z]}>
                  <Flat color="#33343a" />
                </mesh>
              ))}
              {/* the curved leg shield, leaning back a touch */}
              <mesh geometry={geo.shield} position={[0.15, 0.46, 0]} rotation-z={0.14}>
                <Flat color={L.body} side={THREE.DoubleSide} />
              </mesh>
              {/* the horn cover with its little grille, on the shield's face */}
              <mesh geometry={geo.horn} position={[0.335, 0.6, 0]} rotation-z={0.14}>
                <Flat color={L.body} />
              </mesh>
              {[0.57, 0.6, 0.63].map((y) => (
                <mesh key={y} geometry={geo.grille} position={[0.368 - (y - 0.6) * 0.14, y, 0]}>
                  <Flat color={CHROME} metalness={0.5} roughness={0.35} />
                </mesh>
              ))}
              {/* the domed mudguard over the front wheel */}
              <mesh geometry={geo.fender} position={[FX, 0.24, 0]} scale={[0.2, 0.14, 0.075]}>
                <Flat color={L.body} side={THREE.DoubleSide} />
              </mesh>
              <mesh geometry={geo.column}>
                <Flat color={L.dark} />
              </mesh>
              {/* the headset with its round headlamp */}
              <group position={[0.3, 0.88, 0]}>
                <mesh geometry={geo.headset}>
                  <Flat color={L.body} />
                </mesh>
                <mesh geometry={geo.lampBody} position-x={0.07}>
                  <Flat color={L.body} />
                </mesh>
                <mesh geometry={geo.lampRing} position-x={0.1}>
                  <Flat color={CHROME} metalness={0.55} roughness={0.3} />
                </mesh>
                <mesh geometry={geo.lens} position-x={0.101}>
                  <Flat color="#fff6d0" emissive="#ffe49a" emissiveIntensity={1.1} roughness={0.2} />
                </mesh>
                {/* handlebar, grips and the mirrors on their stalks */}
                <mesh geometry={geo.bar} position={[-0.03, 0.03, 0]}>
                  <Flat color={CHROME} metalness={0.55} roughness={0.3} />
                </mesh>
                {[-1, 1].map((sz) => (
                  <group key={sz}>
                    <mesh geometry={geo.grip} position={[-0.03, 0.03, sz * 0.24]}>
                      <Flat color="#2b2b30" roughness={0.9} />
                    </mesh>
                    <group position={[-0.03, 0.03, sz * 0.17]} rotation-x={-sz * 0.32}>
                      <mesh geometry={geo.stalk}>
                        <Flat color={CHROME} metalness={0.55} roughness={0.3} />
                      </mesh>
                      <group position-y={0.18} rotation-y={sz * 0.25}>
                        <mesh geometry={geo.mirror}>
                          <Flat color={L.trim} roughness={0.5} />
                        </mesh>
                        <mesh geometry={geo.glass} position-x={-0.009}>
                          <Flat color="#cfe4ef" roughness={0.1} metalness={0.4} />
                        </mesh>
                      </group>
                    </group>
                  </group>
                ))}
              </group>
              {/* idle puffs from the silencer, thicker as it revs */}
              <Particles geometry={geo.puff} count={10} life={1.1} origin={PIPE} spread={0.01} velocity={[-0.32, 0.2, -0.03]} scatter={0.07} drift={0.05} size={[0.022, 0.075]} colors={['#ecebef', '#cfcfd6']} opacity={[0.55, 0]} active={revving} seed={5} />
              <Burst tap={tap} geometry={geo.puff} count={10} colors={['#dcdce2', '#b9b9c2', '#f2f2f4']} speed={0.55} gravity={-0.5} size={0.075} life={1.0} origin={PIPE} spread={0.6} up={0.6} seed={9} />
            </group>
          </group>
        </group>
      </group>

      {/* the smoke trail, left in the air behind it */}
      {trail.current.p.map((_, i) => (
        <mesh key={i} ref={(el) => (trailPuffs.current[i] = el)} geometry={geo.puff} visible={false}>
          <meshStandardMaterial color={i % 2 ? '#e4e4e8' : '#cfd0d6'} flatShading roughness={0.9} transparent depthWrite={false} />
        </mesh>
      ))}
      {/* an invisible box round the scooter and its run, so every tap lands */}
      <mesh geometry={geo.hit} position={[0.25, 0.6, 0]}>
        <meshBasicMaterial visible={false} />
      </mesh>
    </group>
  )
}

export default function ScooterScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[2.7, 1.6, 3.6]} target={[0.05, 0.45, 0]} hint="The engine idles on its own: the scooter shivers on its wheels and the silencer coughs little puffs · tap it and it pulls a wheelie, rolls forward in a trail of smoke, bounces down and rolls back to its spot · Look swaps mint, red and cream · drag to orbit">
      <Scooter {...props} />
    </Stage>
  )
}
