import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Burst, Flat, Particles, Ripple, Stage, TAU, blob, cone, facet, followPath, rng, useGeo, useTap } from './kit.jsx'

// A low-poly steam train on a round of grass: a closed ring of track (gravel
// ballast, wooden sleepers and two steel rails) with a little station
// platform and a clump of pines inside the loop. The locomotive has a long
// boiler banded in brass, a dark smokebox with a round door and a headlamp,
// a tall chimney, a steam dome and whistle, a cab with windows under an
// overhanging roof, a cowcatcher, cylinders, small leading wheels and big
// spoked driving wheels joined by side rods. It pulls a coal tender and one
// carriage. Left alone, it chugs round the loop: the wheels turn, the rods
// rise and fall with them, and the chimney puffs smoke in time with the
// beat. Tap it and it whistles: a jet of white steam shoots from the
// whistle, steam bursts from the cylinders, the smoke puffs come thick and
// fast for a moment and a ring spreads under the engine.

const LOOKS = {
  red: { body: '#c8352b', dark: '#9c2820', wheel: '#c8352b', trim: '#e2b04a', roof: '#2c2c32', car: '#f1e6cf', carBand: '#c8352b' },
  green: { body: '#2f7a46', dark: '#245e36', wheel: '#2f7a46', trim: '#e2b04a', roof: '#2c2c32', car: '#efe6d0', carBand: '#2f7a46' },
  blue: { body: '#2f5fae', dark: '#244a88', wheel: '#2f5fae', trim: '#e8e4da', roof: '#2a2c36', car: '#eef0f4', carBand: '#2f5fae' },
  black: { body: '#2b2b31', dark: '#1e1e23', wheel: '#c8352b', trim: '#e2b04a', roof: '#1a1a1e', car: '#8a2a2a', carBand: '#2b2b31' },
}

const GY = 0.08 // top of the grass
const R = 1.3 // track radius (centre line)
const GAUGE = 0.08 // half the distance between the rails
const RAIL_Y = GY + 0.058 // top of the rails, where the wheels sit
const DR = 0.12 // driving wheel radius
const LR = 0.065 // leading / tender wheel radius
const CRANK = 0.07 // crank pin offset on the driving wheels
const DZ = [-0.22, 0.04] // driving axles (z)
const LZ = [0.22, 0.34] // leading axles
const CYL_Z = 0.27
const ROD = 0.2 // connecting rod length
const SPEED = 0.36 // radians a second round the loop
const IRON = '#2a2a30'
const STEEL = '#9aa0a8'
const PUFFS = 22

const track = (a) => new THREE.Vector3(Math.cos(a) * R, RAIL_Y, Math.sin(a) * R)

function wheelGeo(r, spokes, seed) {
  return {
    disc: facet(new THREE.CylinderGeometry(r * 0.82, r * 0.82, 0.026, 14, 1).rotateZ(Math.PI / 2), r * 0.02, seed),
    tyre: new THREE.TorusGeometry(r * 0.9, r * 0.11, 4, 16).rotateY(Math.PI / 2),
    spoke: new THREE.BoxGeometry(0.034, r * 1.6, r * 0.12),
    hub: new THREE.CylinderGeometry(r * 0.2, r * 0.2, 0.05, 6).rotateZ(Math.PI / 2),
    spokes,
  }
}

// A wheel turning about x: a rimmed disc with spokes and a hub.
function Wheel({ g, L, wheelRef, color, ...props }) {
  return (
    <group {...props}>
      <group ref={wheelRef}>
        <mesh geometry={g.disc}>
          <Flat color={color} />
        </mesh>
        <mesh geometry={g.tyre}>
          <Flat color={IRON} roughness={0.6} metalness={0.3} />
        </mesh>
        {Array.from({ length: g.spokes }, (_, k) => (
          <mesh key={k} geometry={g.spoke} rotation-x={(k / g.spokes) * Math.PI}>
            <Flat color={L.trim} roughness={0.5} />
          </mesh>
        ))}
        <mesh geometry={g.hub}>
          <Flat color={IRON} />
        </mesh>
      </group>
    </group>
  )
}

export function SteamTrain({ look = 'red' }) {
  const L = LOOKS[look] || LOOKS.red
  const { tap, handlers, clock } = useTap(1.2)
  const root = useRef()
  const cars = useRef([])
  const wheels = useRef([])
  const small = useRef([])
  const rods = useRef([])
  const conRods = useRef([])
  const pistons = useRef([])
  const stack = useRef()
  const puffs = useRef([])
  const st = useRef({ a: 0, roll: 0, chuff: 0, next: 0, p: Array.from({ length: PUFFS }, () => ({ born: -99, x: 0, y: 0, z: 0, s: 1, dx: 0, dz: 0 })) })
  const v = useMemo(() => new THREE.Vector3(), [])

  const geo = useGeo(() => {
    const cow = new THREE.Shape()
    cow.moveTo(0, 0.015)
    cow.lineTo(0.13, 0.015)
    cow.lineTo(0, 0.17)
    cow.closePath()
    return {
      grass: facet(new THREE.CylinderGeometry(1.75, 1.8, GY, 20, 1).translate(0, GY / 2, 0), 0.03, 1, [1, 0.3, 1]),
      ballast: facet(new THREE.RingGeometry(R - 0.18, R + 0.18, 56, 2).rotateX(-Math.PI / 2), 0.008, 2, [0.3, 1, 0.3]),
      sleeper: new THREE.BoxGeometry(0.3, 0.025, 0.055),
      rail: new THREE.TorusGeometry(1, 0.013, 4, 72).rotateX(Math.PI / 2),
      drive: wheelGeo(DR, 4, 3),
      lead: wheelGeo(LR, 3, 4),
      frame: new THREE.BoxGeometry(0.12, 0.08, 0.78),
      board: facet(new THREE.BoxGeometry(0.34, 0.03, 0.74), 0.004, 5),
      boiler: facet(new THREE.CylinderGeometry(0.13, 0.13, 0.44, 12, 1).rotateX(Math.PI / 2), 0.004, 6),
      band: new THREE.TorusGeometry(0.133, 0.008, 3, 12),
      smokebox: new THREE.CylinderGeometry(0.138, 0.138, 0.09, 12, 1).rotateX(Math.PI / 2),
      door: new THREE.CylinderGeometry(0.1, 0.11, 0.02, 12, 1).rotateX(Math.PI / 2),
      chimney: new THREE.CylinderGeometry(0.042, 0.034, 0.15, 8).translate(0, 0.075, 0),
      chimCap: new THREE.CylinderGeometry(0.058, 0.044, 0.04, 8).translate(0, 0.02, 0),
      dome: new THREE.SphereGeometry(0.055, 8, 4, 0, TAU, 0, Math.PI / 2),
      domeBase: new THREE.CylinderGeometry(0.055, 0.06, 0.04, 8).translate(0, 0.02, 0),
      whistle: new THREE.CylinderGeometry(0.012, 0.015, 0.07, 6).translate(0, 0.035, 0),
      lampBox: new THREE.BoxGeometry(0.06, 0.06, 0.05),
      lens: new THREE.CylinderGeometry(0.022, 0.022, 0.012, 8).rotateX(Math.PI / 2),
      cab: facet(new THREE.BoxGeometry(0.32, 0.3, 0.3), 0.004, 7),
      roof: new THREE.BoxGeometry(0.38, 0.03, 0.38),
      sideWin: new THREE.BoxGeometry(0.008, 0.1, 0.12),
      frontWin: new THREE.BoxGeometry(0.07, 0.07, 0.008),
      cow: new THREE.ExtrudeGeometry(cow, { depth: 0.26, bevelEnabled: false }).translate(0, 0, -0.13).rotateY(-Math.PI / 2),
      beam: new THREE.BoxGeometry(0.32, 0.06, 0.03),
      buffer: new THREE.CylinderGeometry(0.018, 0.018, 0.04, 6).rotateX(Math.PI / 2),
      cyl: facet(new THREE.CylinderGeometry(0.048, 0.048, 0.15, 8).rotateX(Math.PI / 2), 0.002, 8),
      rod: new THREE.BoxGeometry(0.014, 0.022, DZ[1] - DZ[0] + 0.04),
      conRod: new THREE.BoxGeometry(0.014, 0.02, ROD),
      piston: new THREE.BoxGeometry(0.012, 0.012, 0.12),
      pin: new THREE.CylinderGeometry(0.014, 0.014, 0.03, 6).rotateZ(Math.PI / 2),
      tender: facet(new THREE.BoxGeometry(0.3, 0.2, 0.44), 0.004, 9),
      tenderLip: new THREE.BoxGeometry(0.32, 0.03, 0.46),
      coal: facet(new THREE.IcosahedronGeometry(1, 1), 0.12, 10),
      chassis: new THREE.BoxGeometry(0.26, 0.05, 0.46),
      car: facet(new THREE.BoxGeometry(0.3, 0.22, 0.56), 0.004, 11),
      carRoof: new THREE.BoxGeometry(0.36, 0.03, 0.62),
      carRidge: new THREE.BoxGeometry(0.2, 0.03, 0.6),
      carWin: new THREE.BoxGeometry(0.008, 0.08, 0.08),
      carBand: new THREE.BoxGeometry(0.31, 0.035, 0.565),
      coupler: new THREE.BoxGeometry(0.03, 0.03, 0.1),
      platform: facet(new THREE.BoxGeometry(0.2, 0.1, 0.8), 0.004, 13),
      edge: new THREE.BoxGeometry(0.025, 0.02, 0.8),
      post: new THREE.BoxGeometry(0.025, 0.24, 0.025),
      shelter: new THREE.BoxGeometry(0.22, 0.025, 0.4),
      bench: new THREE.BoxGeometry(0.06, 0.025, 0.22),
      lampPost: new THREE.CylinderGeometry(0.008, 0.01, 0.3, 4).translate(0, 0.15, 0),
      trunk: new THREE.CylinderGeometry(0.025, 0.035, 0.12, 5).translate(0, 0.06, 0),
      pineA: cone(0.17, 0.25, 7, 1),
      pineB: cone(0.12, 0.2, 7, 2),
      rock: blob(1, 5, 0),
      tuft: cone(0.04, 0.09, 4, 9),
      puff: facet(new THREE.IcosahedronGeometry(1, 0), 0.08, 14),
    }
  }, [])

  const sleepers = useMemo(() => Array.from({ length: 52 }, (_, i) => (i / 52) * TAU), [])
  const pines = useMemo(() => {
    const r = rng(6)
    return [
      [-0.2, -0.15, 1.15],
      [0.18, 0.05, 0.95],
      [-0.05, 0.3, 0.8],
      [0.35, -0.35, 0.7],
      [-0.45, 0.2, 0.65],
    ].map(([x, z, s]) => [x + (r() - 0.5) * 0.05, z, s])
  }, [])
  const tufts = useMemo(() => {
    const r = rng(9)
    return Array.from({ length: 14 }, (_, i) => {
      const a = (i / 14) * TAU + r() * 0.3
      const d = i % 2 ? 1.55 + r() * 0.12 : 0.55 + r() * 0.35
      return [Math.cos(a) * d, Math.sin(a) * d]
    })
  }, [])

  // the cars, as distances behind the locomotive along the track
  const LAG = [0, 0.72, 1.31]

  useFrame((_, dt) => {
    const d = Math.min(dt, 0.05)
    const t = clock.elapsedTime
    const k = tap.value(t)
    const S = st.current
    // a little faster for a moment after the whistle
    const w = SPEED * (1 + 0.35 * k)
    S.a += d * w
    S.roll += (d * w * R) / DR
    cars.current.forEach((c, i) => c && followPath(c, track, S.a - LAG[i] / R, 0))
    // the wheels roll; the small ones turn faster
    wheels.current.forEach((m) => m && (m.rotation.x = S.roll))
    small.current.forEach((m) => m && (m.rotation.x = (S.roll * DR) / LR))
    // the rods: the coupling rod rides the crank pins, the connecting rod
    // runs from the front pin to a crosshead sliding in line with the piston
    ;[-1, 1].forEach((side, i) => {
      const ph = S.roll + (side > 0 ? Math.PI / 2 : 0)
      const py = DR + CRANK * Math.cos(ph)
      const pz = CRANK * Math.sin(ph)
      const rod = rods.current[i]
      if (rod) rod.position.set(side * 0.118, py, (DZ[0] + DZ[1]) / 2 + pz)
      const dy = py - DR
      const cz = DZ[1] + pz + Math.sqrt(ROD * ROD - dy * dy)
      const con = conRods.current[i]
      if (con) {
        con.position.set(side * 0.132, (py + DR) / 2, (DZ[1] + pz + cz) / 2)
        con.rotation.x = Math.atan2(dy, cz - (DZ[1] + pz))
      }
      const pis = pistons.current[i]
      if (pis) pis.position.set(side * 0.132, DR, cz + 0.06)
    })
    // smoke: a puff on every beat (four to a turn of the drivers), thick and
    // fast for a moment after the whistle
    S.chuff += d * (w / SPEED) * (2.4 + 7 * k)
    if (S.chuff >= S.next && stack.current && root.current) {
      S.next = Math.floor(S.chuff) + 1
      stack.current.getWorldPosition(v)
      root.current.worldToLocal(v)
      const p = S.p[Math.floor(S.chuff) % PUFFS]
      const r = Math.sin(S.chuff * 12.9898) * 43758.5453
      const j = r - Math.floor(r)
      Object.assign(p, { born: t, x: v.x, y: v.y, z: v.z, s: 0.8 + j * 0.5 + k * 0.6, dx: (j - 0.5) * 0.1, dz: (0.5 - j) * 0.1 })
    }
    S.p.forEach((p, i) => {
      const m = puffs.current[i]
      if (!m) return
      const age = t - p.born
      const life = 1.7
      m.visible = age >= 0 && age < life
      if (!m.visible) return
      const u = age / life
      m.position.set(p.x + p.dx * age, p.y + 0.06 + 0.42 * age - 0.06 * age * age, p.z + p.dz * age)
      m.scale.setScalar(0.03 * p.s * (1 + age * 2))
      m.rotation.set(age * 1.3 + i, age, 0)
      m.material.opacity = 0.85 * (1 - u) ** 1.3
    })
  })

  const whistling = () => {
    const s = tap.since(clock.elapsedTime)
    return s >= 0 && s < 1.1 ? 1 : 0
  }

  // the locomotive, built facing +z with the rail tops at y = 0
  const BY = 0.27 // running board
  const BOILER_Y = BY + 0.145
  const loco = (
    <group>
      {/* driving and leading wheels */}
      {DZ.map((z, a) =>
        [-1, 1].map((side) => (
          <Wheel key={`${z}${side}`} g={geo.drive} L={L} color={L.wheel} wheelRef={(el) => (wheels.current[a * 2 + (side > 0 ? 1 : 0)] = el)} position={[side * GAUGE, DR, z]} />
        )),
      )}
      {LZ.map((z, a) =>
        [-1, 1].map((side) => (
          <Wheel key={`${z}${side}`} g={geo.lead} L={L} color={L.wheel} wheelRef={(el) => (small.current[a * 2 + (side > 0 ? 1 : 0)] = el)} position={[side * GAUGE, LR, z]} />
        )),
      )}
      {/* side rods, connecting rods and piston rods */}
      {[-1, 1].map((side, i) => (
        <group key={side}>
          <mesh ref={(el) => (rods.current[i] = el)} geometry={geo.rod}>
            <Flat color={STEEL} metalness={0.5} roughness={0.35} />
          </mesh>
          <mesh ref={(el) => (conRods.current[i] = el)} geometry={geo.conRod}>
            <Flat color={STEEL} metalness={0.5} roughness={0.35} />
          </mesh>
          <mesh ref={(el) => (pistons.current[i] = el)} geometry={geo.piston}>
            <Flat color={STEEL} metalness={0.5} roughness={0.35} />
          </mesh>
          <mesh geometry={geo.cyl} position={[side * 0.15, DR + 0.01, CYL_Z + 0.08]}>
            <Flat color={L.dark} />
          </mesh>
        </group>
      ))}
      {/* frame and running board */}
      <mesh geometry={geo.frame} position={[0, 0.17, 0.02]}>
        <Flat color={IRON} />
      </mesh>
      <mesh geometry={geo.board} position={[0, BY, 0.04]}>
        <Flat color={IRON} />
      </mesh>
      {/* boiler with brass bands, smokebox and its round door */}
      <mesh geometry={geo.boiler} position={[0, BOILER_Y, 0.1]}>
        <Flat color={L.body} />
      </mesh>
      {[-0.06, 0.1, 0.26].map((z) => (
        <mesh key={z} geometry={geo.band} position={[0, BOILER_Y, z]}>
          <Flat color={L.trim} roughness={0.45} metalness={0.3} />
        </mesh>
      ))}
      <mesh geometry={geo.smokebox} position={[0, BOILER_Y, 0.36]}>
        <Flat color={IRON} />
      </mesh>
      <mesh geometry={geo.door} position={[0, BOILER_Y, 0.41]}>
        <Flat color="#3a3a42" />
      </mesh>
      {/* chimney, steam dome, whistle and headlamp */}
      <group position={[0, BOILER_Y + 0.11, 0.35]}>
        <mesh geometry={geo.chimney}>
          <Flat color={IRON} />
        </mesh>
        <mesh geometry={geo.chimCap} position-y={0.14}>
          <Flat color={L.trim} roughness={0.45} metalness={0.3} />
        </mesh>
        <group ref={stack} position-y={0.19} />
      </group>
      <group position={[0, BOILER_Y + 0.11, 0.12]}>
        <mesh geometry={geo.domeBase}>
          <Flat color={L.body} />
        </mesh>
        <mesh geometry={geo.dome} position-y={0.04}>
          <Flat color={L.trim} roughness={0.45} metalness={0.3} />
        </mesh>
      </group>
      <mesh geometry={geo.whistle} position={[0, BOILER_Y + 0.12, -0.04]}>
        <Flat color={L.trim} roughness={0.45} metalness={0.3} />
      </mesh>
      <group position={[0, BOILER_Y + 0.17, 0.4]}>
        <mesh geometry={geo.lampBox}>
          <Flat color={IRON} />
        </mesh>
        <mesh geometry={geo.lens} position-z={0.028}>
          <Flat color="#fff4c4" emissive="#ffe08a" emissiveIntensity={1.2} />
        </mesh>
      </group>
      {/* buffer beam, buffers and cowcatcher */}
      <mesh geometry={geo.beam} position={[0, 0.2, 0.42]}>
        <Flat color={L.wheel === L.body ? L.dark : L.wheel} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={geo.buffer} position={[s * 0.11, 0.2, 0.45]}>
          <Flat color={STEEL} metalness={0.4} />
        </mesh>
      ))}
      <mesh geometry={geo.cow} position={[0, 0, 0.405]}>
        <Flat color={IRON} side={THREE.DoubleSide} />
      </mesh>
      {/* the cab: walls with windows, an overhanging roof */}
      <mesh geometry={geo.cab} position={[0, BY + 0.165, -0.24]}>
        <Flat color={L.body} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={geo.sideWin} position={[s * 0.162, BY + 0.22, -0.24]}>
          <Flat color="#cfe6f0" emissive="#9fc8dc" emissiveIntensity={0.15} roughness={0.2} />
        </mesh>
      ))}
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={geo.frontWin} position={[s * 0.1, BY + 0.25, -0.088]}>
          <Flat color="#cfe6f0" emissive="#9fc8dc" emissiveIntensity={0.15} roughness={0.2} />
        </mesh>
      ))}
      <mesh geometry={geo.roof} position={[0, BY + 0.33, -0.25]}>
        <Flat color={L.roof} />
      </mesh>
      {/* the whistle: a jet of steam, a burst from the cylinders, a ring */}
      <Particles geometry={geo.puff} count={16} life={0.7} origin={[0, BOILER_Y + 0.2, -0.04]} spread={0.01} velocity={[0, 1.1, -0.15]} scatter={0.12} drift={0.05} size={[0.03, 0.12]} colors={['#ffffff', '#f2f4f6']} opacity={[0.95, 0]} active={whistling} seed={4} />
      <Burst tap={tap} geometry={geo.puff} count={12} colors={['#ffffff', '#eef1f4']} speed={0.7} gravity={-1.2} size={0.12} life={1.3} origin={[0, BOILER_Y + 0.22, -0.04]} spread={0.5} up={1.6} seed={3} />
      {[-1, 1].map((s) => (
        <Burst key={s} tap={tap} geometry={geo.puff} count={10} colors={['#ffffff', '#e8ecf0']} speed={0.8} gravity={-0.6} size={0.09} life={1.1} origin={[s * 0.2, 0.08, CYL_Z + 0.1]} spread={0.7} up={0.5} seed={s > 0 ? 6 : 7} />
      ))}
      <Ripple tap={tap} count={2} color="#ffffff" radius={0.6} y={0.005} opacity={0.6} />
    </group>
  )

  const tender = (
    <group>
      {[-0.13, 0.13].map((z, a) =>
        [-1, 1].map((side) => (
          <Wheel key={`${z}${side}`} g={geo.lead} L={L} color={L.wheel} wheelRef={(el) => (small.current[4 + a * 2 + (side > 0 ? 1 : 0)] = el)} position={[side * GAUGE, LR, z]} />
        )),
      )}
      <mesh geometry={geo.chassis} position-y={0.12}>
        <Flat color={IRON} />
      </mesh>
      <mesh geometry={geo.tender} position-y={0.245}>
        <Flat color={L.body} />
      </mesh>
      <mesh geometry={geo.tenderLip} position-y={0.355}>
        <Flat color={L.trim} roughness={0.45} metalness={0.2} />
      </mesh>
      <mesh geometry={geo.coal} position={[0, 0.36, 0.02]} scale={[0.13, 0.06, 0.19]}>
        <Flat color="#25252a" roughness={0.6} />
      </mesh>
      <mesh geometry={geo.coupler} position={[0, 0.14, 0.27]}>
        <Flat color={IRON} />
      </mesh>
    </group>
  )

  const carriage = (
    <group>
      {[-0.19, 0.19].map((z, a) =>
        [-1, 1].map((side) => (
          <Wheel key={`${z}${side}`} g={geo.lead} L={L} color={IRON} wheelRef={(el) => (small.current[8 + a * 2 + (side > 0 ? 1 : 0)] = el)} position={[side * GAUGE, LR, z]} />
        )),
      )}
      <mesh geometry={geo.chassis} position-y={0.12} scale={[1, 1, 1.22]}>
        <Flat color={IRON} />
      </mesh>
      <mesh geometry={geo.car} position-y={0.26}>
        <Flat color={L.car} />
      </mesh>
      <mesh geometry={geo.carBand} position-y={0.18}>
        <Flat color={L.carBand} />
      </mesh>
      {[-1, 1].map((s) =>
        [-0.18, -0.06, 0.06, 0.18].map((z) => (
          <mesh key={`${s}${z}`} geometry={geo.carWin} position={[s * 0.152, 0.29, z]}>
            <Flat color="#cfe6f0" emissive="#9fc8dc" emissiveIntensity={0.15} roughness={0.2} />
          </mesh>
        )),
      )}
      <mesh geometry={geo.carRoof} position-y={0.385}>
        <Flat color={L.roof} />
      </mesh>
      <mesh geometry={geo.carRidge} position-y={0.41}>
        <Flat color={L.roof} />
      </mesh>
      <mesh geometry={geo.coupler} position={[0, 0.14, 0.3]}>
        <Flat color={IRON} />
      </mesh>
    </group>
  )

  // the station sits inside the loop on the far side
  const PA = -Math.PI / 2
  return (
    <group ref={root} {...handlers}>
      <mesh geometry={geo.grass}>
        <Flat color="#7cb84f" />
      </mesh>
      <mesh geometry={geo.ballast} position-y={GY + 0.004}>
        <Flat color="#a89f92" side={THREE.DoubleSide} />
      </mesh>
      {sleepers.map((a) => (
        <mesh key={a} geometry={geo.sleeper} position={[Math.cos(a) * R, GY + 0.02, Math.sin(a) * R]} rotation-y={-a}>
          <Flat color="#7a5436" />
        </mesh>
      ))}
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={geo.rail} position-y={RAIL_Y - 0.011} scale={[R + s * GAUGE, 1, R + s * GAUGE]}>
          <Flat color={STEEL} metalness={0.55} roughness={0.35} />
        </mesh>
      ))}
      {/* the station platform, a shelter, a bench and a lamp */}
      <group position={[Math.cos(PA) * (R - 0.28), GY, Math.sin(PA) * (R - 0.28)]} rotation-y={-PA}>
        <mesh geometry={geo.platform} position-y={0.05}>
          <Flat color="#cfc6b6" />
        </mesh>
        <mesh geometry={geo.edge} position={[0.09, 0.105, 0]}>
          <Flat color="#f2d34a" />
        </mesh>
        {[-0.15, 0.15].map((z) => (
          <mesh key={z} geometry={geo.post} position={[-0.06, 0.22, z]}>
            <Flat color={L.dark} />
          </mesh>
        ))}
        <mesh geometry={geo.shelter} position={[-0.02, 0.345, 0]} rotation-z={-0.18}>
          <Flat color={L.body} />
        </mesh>
        <mesh geometry={geo.bench} position={[-0.05, 0.16, 0]}>
          <Flat color="#8a5c36" />
        </mesh>
        <group position={[0, 0.1, 0.33]}>
          <mesh geometry={geo.lampPost}>
            <Flat color={IRON} />
          </mesh>
          <mesh geometry={geo.lampBox} position-y={0.3} scale={0.6}>
            <Flat color="#fff4c4" emissive="#ffe08a" emissiveIntensity={0.8} />
          </mesh>
        </group>
      </group>
      {pines.map(([x, z, s], i) => (
        <group key={i} position={[x, GY, z]} scale={s}>
          <mesh geometry={geo.trunk}>
            <Flat color="#6a4430" />
          </mesh>
          <mesh geometry={geo.pineA} position-y={0.08}>
            <Flat color={i % 2 ? '#3a8a4a' : '#2f7a42'} />
          </mesh>
          <mesh geometry={geo.pineB} position-y={0.24}>
            <Flat color={i % 2 ? '#46a058' : '#3c9050'} />
          </mesh>
        </group>
      ))}
      {[
        [0.55, 0.45, 0.07],
        [-0.6, -0.4, 0.06],
        [1.62, -0.5, 0.07],
        [-1.6, 0.4, 0.06],
      ].map(([x, z, s], i) => (
        <mesh key={i} geometry={geo.rock} position={[x, GY + s * 0.3, z]} scale={[s * 1.3, s, s]} rotation-y={i}>
          <Flat color={i % 2 ? '#b4b2ae' : '#a5a29c'} />
        </mesh>
      ))}
      {tufts.map(([x, z], i) => (
        <mesh key={i} geometry={geo.tuft} position={[x, GY, z]} rotation-y={i}>
          <Flat color={i % 2 ? '#5f9a3e' : '#6fae48'} />
        </mesh>
      ))}

      {/* the train */}
      {[loco, tender, carriage].map((car, i) => (
        <group key={i} ref={(el) => (cars.current[i] = el)}>
          {car}
        </group>
      ))}
      {/* the smoke puffs, left behind in the air as the train runs on */}
      {Array.from({ length: PUFFS }, (_, i) => (
        <mesh key={i} ref={(el) => (puffs.current[i] = el)} geometry={geo.puff} visible={false}>
          <meshStandardMaterial color={i % 3 ? '#e8e8ec' : '#cfcfd6'} flatShading roughness={0.9} transparent depthWrite={false} />
        </mesh>
      ))}
    </group>
  )
}

export default function SteamTrainScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[3.6, 3.0, 5.0]} target={[0, 0.3, 0]} hint="The train chugs round the loop on its own: the wheels turn, the side rods pump and the chimney puffs on the beat · tap it and it whistles: a jet of steam, a burst from the cylinders and a flurry of smoke · Look swaps red, green, blue and black · drag to orbit">
      <SteamTrain {...props} />
    </Stage>
  )
}
