import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Burst, Flat, Particles, Stage, TAU, blob, cone, facet, useGeo, useKick, useTap } from './kit.jsx'

// A low-poly farm tractor on a patch of dirt and grass: big ridged rear
// wheels under curved fenders, small front wheels, a long engine hood with a
// slatted grille and headlamps, a glass cab with a flat roof and a tall
// exhaust stack, with a round hay bale lying nearby. Left alone, the engine
// idles: the body shivers, the wheels turn slowly and the stack puffs little
// clouds. Tap it and it revs: a big black puff, the rear wheels spin up and
// the front lifts in a wheelie, holds for a moment, then thumps back down in
// a spray of dust.

const LOOKS = {
  red: { body: '#d23a2e', dark: '#a52b23', hub: '#f2efe6', roof: '#f2efe6', frame: '#3a3a40' },
  green: { body: '#3e8f3a', dark: '#2e6f2c', hub: '#f2c62e', roof: '#f2c62e', frame: '#2f3330' },
  blue: { body: '#2f62b0', dark: '#244c8c', hub: '#e8ecf2', roof: '#e8ecf2', frame: '#33363e' },
  orange: { body: '#ef7d22', dark: '#c6621a', hub: '#2c2c32', roof: '#2c2c32', frame: '#2c2c32' },
}

const GY = 0.06 // top of the ground patch
const RR = 0.36 // rear wheel radius
const RW = 0.2 // rear wheel width
const FR = 0.2 // front wheel radius
const FW = 0.13
const AX = -0.38 // rear axle x
const FX = 0.52 // front axle x
const RZ = 0.37 // rear wheel track (z)
const FZ = 0.27
const LIFT = 0.34 // wheelie angle (radians)
const TYRE = '#2a2a2f'

function wheelGeo(r, w, seed) {
  return {
    tyre: facet(new THREE.CylinderGeometry(r * 0.9, r * 0.9, w, 16, 1).rotateX(Math.PI / 2), r * 0.02, seed),
    lug: new THREE.BoxGeometry(r * 0.2, r * 0.22, w * 0.56),
    hub: new THREE.CylinderGeometry(r * 0.55, r * 0.55, w + 0.02, 10, 1).rotateX(Math.PI / 2),
    cap: new THREE.CylinderGeometry(r * 0.18, r * 0.18, w + 0.05, 6, 1).rotateX(Math.PI / 2),
  }
}

// A wheel turning about z: a tyre ringed with chevron lugs, a painted hub.
function Wheel({ g, r, w, lugs, L, wheelRef, ...props }) {
  return (
    <group {...props}>
      <group ref={wheelRef}>
        <mesh geometry={g.tyre}>
          <Flat color={TYRE} roughness={0.95} />
        </mesh>
        {Array.from({ length: lugs }, (_, k) =>
          [-1, 1].map((side) => (
            <group key={`${k}${side}`} rotation-z={(k / lugs) * TAU + (side > 0 ? Math.PI / lugs : 0)}>
              <mesh geometry={g.lug} position={[r * 0.92, 0, (side * w) / 4.2]} rotation-x={side * 0.5}>
                <Flat color={TYRE} roughness={0.95} />
              </mesh>
            </group>
          )),
        )}
        <mesh geometry={g.hub}>
          <Flat color={L.hub} roughness={0.6} />
        </mesh>
        <mesh geometry={g.cap}>
          <Flat color={L.frame} />
        </mesh>
      </group>
    </group>
  )
}

export function Tractor({ look = 'red' }) {
  const L = LOOKS[look] || LOOKS.red
  const { tap, handlers, clock } = useTap(1.5)
  const dust = useKick(2)
  const pivot = useRef()
  const shake = useRef()
  const rear = useRef([])
  const front = useRef([])
  const st = useRef({ x: 0, v: 0, roll: 0, landed: -99 })

  const geo = useGeo(
    () => ({
      rear: wheelGeo(RR, RW, 2),
      front: wheelGeo(FR, FW, 3),
      dirt: facet(new THREE.CylinderGeometry(1.3, 1.36, GY, 14, 1).translate(0, GY / 2, 0), 0.03, 1, [1, 0.3, 1]),
      grass: facet(new THREE.CylinderGeometry(1.48, 1.52, GY * 0.7, 16, 1).translate(0, (GY * 0.7) / 2, 0), 0.03, 2, [1, 0.3, 1]),
      tuft: cone(0.05, 0.12, 4, 5),
      frame: facet(new THREE.BoxGeometry(1.15, 0.16, 0.3), 0.006, 4),
      hood: facet(new THREE.BoxGeometry(0.72, 0.28, 0.34), 0.008, 5),
      hoodTop: facet(new THREE.BoxGeometry(0.7, 0.04, 0.3), 0.004, 6),
      grille: new THREE.BoxGeometry(0.03, 0.24, 0.28),
      slat: new THREE.BoxGeometry(0.035, 0.022, 0.26),
      lamp: new THREE.BoxGeometry(0.03, 0.05, 0.07),
      weight: facet(new THREE.BoxGeometry(0.12, 0.14, 0.32), 0.006, 7),
      seatBox: facet(new THREE.BoxGeometry(0.6, 0.24, 0.5), 0.008, 8),
      post: new THREE.BoxGeometry(0.04, 0.5, 0.04),
      roof: facet(new THREE.BoxGeometry(0.7, 0.05, 0.6), 0.006, 9),
      glass: new THREE.BoxGeometry(0.5, 0.48, 0.46),
      seat: new THREE.BoxGeometry(0.16, 0.18, 0.2),
      steer: new THREE.TorusGeometry(0.07, 0.012, 4, 10),
      column: new THREE.CylinderGeometry(0.012, 0.012, 0.18, 4),
      fender: new THREE.CylinderGeometry(RR + 0.05, RR + 0.05, RW + 0.05, 12, 1, true, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2),
      fenderTop: new THREE.CylinderGeometry(FR + 0.04, FR + 0.04, FW + 0.04, 8, 1, true, -Math.PI / 2, Math.PI * 0.75).rotateX(-Math.PI / 2),
      axle: new THREE.BoxGeometry(0.06, 0.06, FZ * 2),
      stack: new THREE.CylinderGeometry(0.026, 0.03, 0.5, 6),
      stackCap: new THREE.CylinderGeometry(0.04, 0.032, 0.05, 6),
      hitch: new THREE.BoxGeometry(0.2, 0.05, 0.08),
      bale: facet(new THREE.CylinderGeometry(0.2, 0.2, 0.3, 10, 2).rotateZ(Math.PI / 2), 0.012, 11),
      baleEnd: new THREE.CylinderGeometry(0.15, 0.15, 0.31, 10, 1).rotateZ(Math.PI / 2),
      puff: new THREE.IcosahedronGeometry(1, 0),
      clod: blob(1, 13, 0),
      hit: new THREE.BoxGeometry(1.7, 1.3, 1),
    }),
    [],
  )

  useFrame((_, dt) => {
    const d = Math.min(dt, 0.033)
    const t = clock.elapsedTime
    const s = tap.since(t)
    const S = st.current
    // the wheelie: a spring that pulls the front up while the engine roars,
    // then lets go; the front axle bounces once when it hits the ground
    const target = s >= 0.22 && s < 1.35 ? LIFT : 0
    S.v += ((target - S.x) * 70 - S.v * 7) * d
    S.x += S.v * d
    if (S.x < 0) {
      if (S.v < -0.6 && t - S.landed > 0.4) {
        S.landed = t
        dust.kick(t)
      }
      S.x = 0
      S.v = -S.v * 0.28
    }
    pivot.current.rotation.z = S.x
    // the engine: a fast shiver at idle, a hard shake while revving
    const rev = s >= 0 && s < 1.6 ? Math.exp(-1.6 * s) : 0
    shake.current.position.y = Math.sin(t * 46) * (0.003 + rev * 0.01)
    shake.current.rotation.x = Math.sin(t * 31) * (0.002 + rev * 0.01)
    // the wheels: a slow crawl, spinning up as it revs
    S.roll += d * (0.7 + rev * 14)
    rear.current.forEach((w) => w && (w.rotation.z = -S.roll))
    front.current.forEach((w) => w && (w.rotation.z = (-S.roll * RR) / FR))
  })

  const revving = () => {
    const s = tap.since(clock.elapsedTime)
    return s >= 0 && s < 0.9 ? 1 : 0
  }
  const stackTop = [0.5, 1.21, 0.1]

  return (
    <group {...handlers}>
      {/* the ground: a patch of dirt in a ring of grass, a few tufts */}
      <mesh geometry={geo.grass}>
        <Flat color="#7fb24f" />
      </mesh>
      <mesh geometry={geo.dirt}>
        <Flat color="#a47c55" />
      </mesh>
      {[
        [1.28, 0.4],
        [-1.2, 0.55],
        [0.9, -1.0],
        [-0.4, 1.3],
        [0.2, -1.32],
      ].map(([x, z], i) => (
        <mesh key={i} geometry={geo.tuft} position={[x, GY * 0.7, z]} rotation-y={i}>
          <Flat color={i % 2 ? '#5f9a3e' : '#6fae48'} />
        </mesh>
      ))}
      {/* a round hay bale lying in the dirt */}
      <group position={[-0.98, GY + 0.2, 0.62]} rotation-y={-0.5}>
        <mesh geometry={geo.bale}>
          <Flat color="#e2bb52" />
        </mesh>
        <mesh geometry={geo.baleEnd}>
          <Flat color="#c99f3a" />
        </mesh>
      </group>

      {/* the tractor tips about its rear axle for the wheelie */}
      <group ref={pivot} position={[AX, GY + RR, 0]}>
        <group position={[-AX, -(GY + RR), 0]}>
          {[-1, 1].map((sz, i) => (
            <Wheel key={sz} g={geo.rear} r={RR} w={RW} lugs={12} L={L} wheelRef={(el) => (rear.current[i] = el)} position={[AX, GY + RR, sz * RZ]} />
          ))}
          {[-1, 1].map((sz, i) => (
            <Wheel key={sz} g={geo.front} r={FR} w={FW} lugs={8} L={L} wheelRef={(el) => (front.current[i] = el)} position={[FX, GY + FR, sz * FZ]} />
          ))}
          <group ref={shake}>
            <mesh geometry={geo.axle} position={[FX, GY + FR, 0]}>
              <Flat color={L.frame} />
            </mesh>
            <mesh geometry={geo.frame} position={[0.125, 0.38, 0]}>
              <Flat color={L.frame} />
            </mesh>
            {/* the hood, its grille, lamps and a front weight */}
            <mesh geometry={geo.hood} position={[0.36, 0.58, 0]}>
              <Flat color={L.body} />
            </mesh>
            <mesh geometry={geo.hoodTop} position={[0.36, 0.73, 0]}>
              <Flat color={L.dark} />
            </mesh>
            <mesh geometry={geo.grille} position={[0.725, 0.57, 0]}>
              <Flat color="#2a2a30" />
            </mesh>
            {[0.48, 0.53, 0.58, 0.63].map((y) => (
              <mesh key={y} geometry={geo.slat} position={[0.735, y, 0]}>
                <Flat color="#c9ccd2" metalness={0.4} roughness={0.4} />
              </mesh>
            ))}
            {[-1, 1].map((sz) => (
              <mesh key={sz} geometry={geo.lamp} position={[0.73, 0.68, sz * 0.12]}>
                <Flat color="#fff4c4" emissive="#ffe08a" emissiveIntensity={0.9} />
              </mesh>
            ))}
            <mesh geometry={geo.weight} position={[0.74, 0.37, 0]}>
              <Flat color={L.frame} />
            </mesh>
            {[-1, 1].map((sz) => (
              <mesh key={sz} geometry={geo.fenderTop} position={[FX, GY + FR, sz * FZ]}>
                <Flat color={L.body} side={THREE.DoubleSide} />
              </mesh>
            ))}
            {/* the cab: a body under the seat, posts, glass and a roof */}
            <mesh geometry={geo.seatBox} position={[-0.32, 0.58, 0]}>
              <Flat color={L.body} />
            </mesh>
            {[-1, 1].map((sz) => (
              <mesh key={sz} geometry={geo.fender} position={[AX, GY + RR, sz * RZ]}>
                <Flat color={L.body} side={THREE.DoubleSide} />
              </mesh>
            ))}
            {[
              [-0.6, -1],
              [-0.6, 1],
              [-0.04, -1],
              [-0.04, 1],
            ].map(([x, sz], i) => (
              <mesh key={i} geometry={geo.post} position={[x, 0.95, sz * 0.24]}>
                <Flat color={L.frame} />
              </mesh>
            ))}
            <mesh geometry={geo.seat} position={[-0.42, 0.79, 0]}>
              <Flat color="#2a2a30" />
            </mesh>
            <mesh geometry={geo.column} position={[-0.16, 0.8, 0]} rotation-z={0.5}>
              <Flat color="#2a2a30" />
            </mesh>
            <mesh geometry={geo.steer} position={[-0.2, 0.89, 0]} rotation={[0, Math.PI / 2, 0]}>
              <Flat color="#2a2a30" />
            </mesh>
            <mesh geometry={geo.glass} position={[-0.32, 0.95, 0]}>
              <meshStandardMaterial color="#bfe3f0" transparent opacity={0.35} roughness={0.1} metalness={0.1} depthWrite={false} flatShading />
            </mesh>
            <mesh geometry={geo.roof} position={[-0.32, 1.225, 0]}>
              <Flat color={L.roof} />
            </mesh>
            {/* the exhaust stack up beside the hood */}
            <mesh geometry={geo.stack} position={[0.5, 0.95, 0.1]}>
              <Flat color="#3a3a40" metalness={0.4} roughness={0.5} />
            </mesh>
            <mesh geometry={geo.stackCap} position={[0.5, 1.2, 0.1]}>
              <Flat color="#2a2a30" />
            </mesh>
            <mesh geometry={geo.hitch} position={[-0.74, 0.33, 0]}>
              <Flat color={L.frame} />
            </mesh>
            {/* idle puffs, and a big black cloud when it revs */}
            <Particles geometry={geo.puff} count={8} life={1.4} origin={stackTop} spread={0.01} velocity={[-0.12, 0.42, 0]} scatter={0.06} drift={0.08} size={[0.025, 0.09]} colors={['#e2e2e6', '#cfcfd6']} opacity={[0.7, 0]} />
            <Particles geometry={geo.puff} count={14} life={0.9} origin={stackTop} spread={0.02} velocity={[-0.3, 0.9, 0]} scatter={0.2} drift={0.1} size={[0.05, 0.2]} colors={['#4a4a52', '#2e2e34', '#6a6a72']} opacity={[0.9, 0]} active={revving} seed={5} />
          </group>
        </group>
      </group>
      <Burst tap={tap} geometry={geo.puff} count={8} colors={['#3a3a42', '#55555e']} speed={0.9} gravity={-0.8} size={0.08} life={0.9} origin={stackTop} spread={0.5} up={1.4} seed={8} />
      {/* dust thrown up where the front wheels land */}
      <Burst tap={dust} geometry={geo.clod} count={16} colors={['#b8916a', '#9c7650', '#d2b48a']} speed={1.4} gravity={3.5} size={0.05} life={0.9} origin={[FX, GY + 0.05, 0]} spread={1.1} up={0.7} seed={4} />
      {/* an invisible box round the tractor, so a tap through the cab lands */}
      <mesh geometry={geo.hit} position={[0, 0.65, 0]}>
        <meshBasicMaterial visible={false} />
      </mesh>
    </group>
  )
}

export default function TractorScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[3.2, 2.2, 4.4]} target={[0, 0.6, 0]} hint="The engine idles on its own: the wheels creep round and the stack puffs · tap it and it revs, pops a wheelie and thumps down in a spray of dust · Look swaps red, green, blue and orange · drag to orbit">
      <Tractor {...props} />
    </Stage>
  )
}
