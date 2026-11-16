import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { Burst, Flat, Ripple, Stage, TAU, Water, facet, rng, useGeo, useTap } from './kit.jsx'

// A low-poly hovercraft riding on a round of water: a boat-shaped hull with
// a pointed bow and a stripe round it, a fat black air skirt bulging out
// all the way round, a deck with a cabin (a sloped windscreen, a row of
// side windows, a roof with a mast and a beacon) and a lifebuoy on its
// side, and at the stern two ducted fans on pylons, each with a pair of
// rudders behind it. Left alone, it hovers: it bobs and rocks a little on
// its cushion of air, spray hisses out from under the skirt all round, the
// fans spin, the rudders twitch and the beacon blinks. Tap it and it spins
// on the spot, one full turn, banking into it with the fans roaring, the
// rudders hard over and a ring of spray thrown out across the water.

const LOOKS = {
  rescue: { hull: '#e8552f', deck: '#f1eee7', stripe: '#ffffff', cabin: '#f6f3ec', roof: '#e8552f', duct: '#f1eee7', blade: '#3a3b42', beacon: '#3f9dff', buoy: ['#ff6a2a', '#ffffff'] },
  military: { hull: '#6a7748', deck: '#56623b', stripe: '#c9b98a', cabin: '#77854f', roof: '#56623b', duct: '#5f6b42', blade: '#2c2f28', beacon: '#ff5a3a', buoy: ['#c9b98a', '#56623b'] },
  tourist: { hull: '#f6f3ec', deck: '#3f8fcf', stripe: '#f2c23a', cabin: '#ffffff', roof: '#3f8fcf', duct: '#3f8fcf', blade: '#f6f3ec', beacon: '#f2c23a', buoy: ['#ff6a2a', '#ffffff'] },
}

const SKIRT = '#26262c'
const GLASS = '#2b3f55'
const H = 0.14 // hover height of the craft's base above the water's surface
const WY = 0.06 // the water's surface
const HULL_Y = 0.1 // bottom of the hull, inside the skirt
const DECK = 0.25 // top of the hull
const FAN = { x: -0.56, z: 0.205, y: DECK + 0.2, r: 0.165 } // the ducted fans
const SPIN = 2.3 // seconds for one full turn
const SPRAY = 60

const clamp01 = (u) => Math.min(1, Math.max(0, u))
const easeInOut = (u) => {
  const k = clamp01(u)
  return k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2
}

// The hull outline in plan (x forward, y here becomes -z): a pointed,
// rounded bow and a squared stern with rounded corners.
function outline(k = 1) {
  const s = new THREE.Shape()
  const w = 0.34 * k
  s.moveTo(-0.62 * k, -w)
  s.lineTo(0.2 * k, -w)
  s.quadraticCurveTo(0.66 * k, -w * 0.92, 0.8 * k, 0)
  s.quadraticCurveTo(0.66 * k, w * 0.92, 0.2 * k, w)
  s.lineTo(-0.62 * k, w)
  s.quadraticCurveTo(-0.72 * k, w, -0.72 * k, w * 0.7)
  s.lineTo(-0.72 * k, -w * 0.7)
  s.quadraticCurveTo(-0.72 * k, -w, -0.62 * k, -w)
  return s
}
// an outline extruded upward (y) by h, standing on y = 0
const slab = (k, h, segs = 6) => new THREE.ExtrudeGeometry(outline(k), { depth: h, bevelEnabled: false, curveSegments: segs }).rotateX(-Math.PI / 2)

// Spray hissing out from under the skirt all round, thrown up and out and
// falling back. power() (read every frame) throws it further.
function SprayRing({ power, geo, color = '#ffffff' }) {
  const clock = useThree((s) => s.clock)
  const refs = useRef([])
  const P = useMemo(() => {
    const r = rng(7)
    return Array.from({ length: SPRAY }, (_, i) => ({ a: (i / SPRAY) * TAU + r() * 0.1, off: r(), vs: 0.7 + r() * 0.6, s: 0.6 + r() * 0.7 }))
  }, [])
  useFrame(() => {
    const t = clock.elapsedTime
    const pw = power()
    P.forEach((p, i) => {
      const m = refs.current[i]
      if (!m) return
      const life = 0.75
      const u = (t / life + p.off) % 1
      const age = u * life
      const ca = Math.cos(p.a)
      const sa = Math.sin(p.a)
      const out = (0.22 + 0.5 * pw) * p.vs * age
      const up = (0.42 + 0.5 * pw) * p.vs
      m.position.set(ca * (0.84 + out), WY + 0.02 + up * age - 1.9 * age * age, sa * (0.48 + out * 0.8))
      m.scale.setScalar(Math.max(0.001, 0.017 * p.s * (0.7 + pw * 0.45) * (1 + u * 1.2)))
      m.rotation.set(age * 6 + i, age * 4, 0)
      m.material.opacity = 0.8 * (1 - u) ** 1.2
    })
  })
  return (
    <group>
      {P.map((p, i) => (
        <mesh key={i} ref={(el) => (refs.current[i] = el)} geometry={geo}>
          <meshStandardMaterial color={i % 3 ? color : '#d8f0fb'} flatShading roughness={0.4} transparent depthWrite={false} />
        </mesh>
      ))}
    </group>
  )
}

export function Hovercraft({ look = 'rescue' }) {
  const L = LOOKS[look] || LOOKS.rescue
  const { tap, handlers, clock } = useTap(1.2)
  const yaw = useRef()
  const bob = useRef()
  const fans = useRef([])
  const rudders = useRef([])
  const beacon = useRef()
  const fanAngle = useRef(0)

  const geo = useGeo(() => {
    const cab = new THREE.Shape()
    cab.moveTo(-0.3, 0)
    cab.lineTo(0.34, 0)
    cab.lineTo(0.2, 0.24)
    cab.lineTo(-0.26, 0.24)
    cab.closePath()
    const skirtPath = new THREE.CatmullRomCurve3(
      outline(1.035)
        .getSpacedPoints(48)
        .slice(0, -1)
        .map((p) => new THREE.Vector3(p.x, 0, -p.y)),
      true,
    )
    return {
      skirt: facet(new THREE.TubeGeometry(skirtPath, 48, 0.1, 7, true), 0.008, 1),
      belly: new THREE.ShapeGeometry(outline(1.0), 6).rotateX(Math.PI / 2),
      hull: facet(slab(1, DECK - HULL_Y), 0.003, 2),
      stripe: slab(1.008, 0.035),
      deck: slab(0.95, 0.012),
      rail: slab(0.955, 0.02),
      cabin: facet(new THREE.ExtrudeGeometry(cab, { depth: 0.46, bevelEnabled: false }).translate(0, 0, -0.23), 0.003, 3),
      roof: facet(new THREE.BoxGeometry(0.52, 0.035, 0.5), 0.004, 4),
      windscreen: new THREE.BoxGeometry(0.012, 0.15, 0.38),
      sideWin: new THREE.BoxGeometry(0.1, 0.085, 0.008),
      door: new THREE.BoxGeometry(0.008, 0.16, 0.12),
      mast: new THREE.CylinderGeometry(0.008, 0.01, 0.14, 4).translate(0, 0.07, 0),
      beacon: new THREE.CylinderGeometry(0.028, 0.032, 0.045, 8),
      buoy: new THREE.TorusGeometry(0.055, 0.018, 5, 12),
      lamp: new THREE.BoxGeometry(0.02, 0.03, 0.05),
      duct: facet(new THREE.CylinderGeometry(FAN.r, FAN.r, 0.13, 14, 1, true).rotateZ(Math.PI / 2), 0.002, 5),
      lip: new THREE.TorusGeometry(FAN.r, 0.02, 4, 14).rotateY(Math.PI / 2),
      pylon: facet(new THREE.BoxGeometry(0.1, 0.06, 0.06), 0.003, 6),
      hub: new THREE.ConeGeometry(0.035, 0.07, 8).rotateZ(-Math.PI / 2),
      blade: new THREE.BoxGeometry(0.012, FAN.r * 0.9, 0.05).translate(0, FAN.r * 0.45, 0),
      guard: new THREE.BoxGeometry(0.006, FAN.r * 2, 0.012),
      rudder: facet(new THREE.BoxGeometry(0.11, 0.3, 0.014).translate(-0.055, 0, 0), 0.002, 7),
      drop: facet(new THREE.IcosahedronGeometry(1, 0), 0.1, 8),
      hit: new THREE.BoxGeometry(1.8, 0.9, 1.0),
    }
  }, [])

  const power = () => {
    const s = tap.since(clock.elapsedTime)
    return 1 + (s >= 0 && s < SPIN + 0.4 ? 1.3 * Math.sin(Math.PI * clamp01(s / (SPIN + 0.4))) : 0)
  }

  useFrame((_, dt) => {
    const t = clock.elapsedTime
    const s = tap.since(t)
    const spinning = s >= 0 && s < SPIN
    const u = spinning ? s / SPIN : 1
    // one full turn on the spot, banking into it
    yaw.current.rotation.y = TAU * easeInOut(u)
    const bank = Math.sin(Math.PI * u) * (spinning ? 1 : 0)
    // hovering: a slow bob and a gentle rock on the air cushion
    bob.current.position.y = WY + H + 0.022 * Math.sin(t * 1.7) + 0.006 * Math.sin(t * 7.3) + 0.04 * bank
    bob.current.rotation.z = 0.02 * Math.sin(t * 1.3)
    bob.current.rotation.x = 0.016 * Math.sin(t * 1.05 + 1) - 0.1 * bank
    // the fans: a steady whirr, a roar while it spins
    fanAngle.current += Math.min(dt, 0.05) * (14 + 26 * bank)
    fans.current.forEach((f, i) => f && (f.rotation.x = fanAngle.current * (i ? 1 : -1)))
    // rudders: little twitches, hard over for the turn
    const rud = 0.12 * Math.sin(t * 0.8) + 0.05 * Math.sin(t * 2.3) + 0.55 * bank
    rudders.current.forEach((r) => r && (r.rotation.y = rud))
    // the beacon blinks
    const on = (t * 1.4) % 1 < 0.22
    beacon.current.material.emissiveIntensity = on ? 2.2 : 0.25
  })

  return (
    <group {...handlers}>
      <Water radius={1.55} color="#5bbbe6" edge="#3a8fc2" amp={0.02} y={WY} />
      {/* a soft ring of disturbed water under the craft, always going */}
      <Ripple loop period={1.5} count={3} color="#ffffff" radius={1.05} y={WY + 0.03} opacity={0.35} />
      <Ripple tap={tap} count={3} color="#ffffff" radius={1.45} life={1.6} y={WY + 0.035} opacity={0.7} />

      <group ref={yaw}>
        <SprayRing power={power} geo={geo.drop} />
        <Burst tap={tap} geometry={geo.drop} count={26} colors={['#ffffff', '#d8f0fb', '#bfe6f7']} speed={1.6} gravity={4} size={0.05} life={1.1} origin={[0, WY + 0.08, 0]} spread={1.2} up={0.7} seed={4} />

        <group ref={bob}>
          {/* the black air skirt and the belly inside it */}
          <mesh geometry={geo.skirt} position-y={0.1}>
            <Flat color={SKIRT} roughness={0.75} />
          </mesh>
          <mesh geometry={geo.belly} position-y={0.04}>
            <Flat color="#1d1d22" side={THREE.DoubleSide} />
          </mesh>
          {/* the hull, its stripe, the deck and a rail round its edge */}
          <mesh geometry={geo.hull} position-y={HULL_Y}>
            <Flat color={L.hull} />
          </mesh>
          <mesh geometry={geo.stripe} position-y={HULL_Y + 0.07}>
            <Flat color={L.stripe} />
          </mesh>
          <mesh geometry={geo.deck} position-y={DECK}>
            <Flat color={L.deck} />
          </mesh>
          <mesh geometry={geo.rail} position-y={DECK} scale={[1, 1.5, 1]}>
            <Flat color={L.hull} />
          </mesh>
          {/* bow lamps */}
          {[-1, 1].map((sz) => (
            <mesh key={sz} geometry={geo.lamp} position={[0.66, DECK - 0.04, sz * 0.13]} rotation-y={sz * 0.5}>
              <Flat color="#fff6d0" emissive="#ffe49a" emissiveIntensity={1} />
            </mesh>
          ))}

          {/* the cabin: windscreen, side windows, a door, the roof, a mast */}
          <group position={[0.02, DECK + 0.012, 0]}>
            <mesh geometry={geo.cabin}>
              <Flat color={L.cabin} />
            </mesh>
            <mesh geometry={geo.windscreen} position={[0.275, 0.13, 0]} rotation-z={0.53}>
              <Flat color={GLASS} roughness={0.15} metalness={0.3} />
            </mesh>
            {[-1, 1].map((sz) =>
              [-0.17, -0.05, 0.07, 0.19].map((x) => (
                <mesh key={`${sz}${x}`} geometry={geo.sideWin} position={[x, 0.15, sz * 0.232]}>
                  <Flat color={GLASS} roughness={0.15} metalness={0.3} />
                </mesh>
              )),
            )}
            <mesh geometry={geo.door} position={[-0.302, 0.09, 0]} rotation-z={0.17}>
              <Flat color={GLASS} roughness={0.2} metalness={0.2} />
            </mesh>
            <mesh geometry={geo.roof} position={[-0.04, 0.255, 0]}>
              <Flat color={L.roof} />
            </mesh>
            <group position={[-0.14, 0.27, 0]}>
              <mesh geometry={geo.mast}>
                <Flat color="#3a3b42" />
              </mesh>
              <mesh ref={beacon} geometry={geo.beacon} position-y={0.16}>
                <Flat color={L.beacon} emissive={L.beacon} emissiveIntensity={0.3} />
              </mesh>
            </group>
            {/* a lifebuoy hung on the cabin's side */}
            {[-1, 1].map((sz) => (
              <group key={sz} position={[-0.12, 0.1, sz * 0.245]}>
                <mesh geometry={geo.buoy}>
                  <Flat color={L.buoy[0]} />
                </mesh>
                {[0, 1, 2, 3].map((k) => (
                  <mesh key={`b${k}`} geometry={geo.lamp} position={[Math.cos((k * Math.PI) / 2 + Math.PI / 4) * 0.055, Math.sin((k * Math.PI) / 2 + Math.PI / 4) * 0.055, 0]} rotation-z={(k * Math.PI) / 2 + Math.PI / 4} scale={[1.2, 1.1, 0.9]}>
                    <Flat color={L.buoy[1]} />
                  </mesh>
                ))}
              </group>
            ))}
          </group>

          {/* two ducted fans on pylons at the stern, rudders behind them */}
          {[-1, 1].map((sz, i) => (
            <group key={sz} position={[FAN.x, FAN.y, sz * FAN.z]}>
              <mesh geometry={geo.pylon} position-y={-FAN.r - 0.02}>
                <Flat color={L.duct} />
              </mesh>
              <mesh geometry={geo.duct}>
                <Flat color={L.duct} side={THREE.DoubleSide} />
              </mesh>
              {[-1, 1].map((sx) => (
                <mesh key={sx} geometry={geo.lip} position-x={sx * 0.065}>
                  <Flat color={L.duct} />
                </mesh>
              ))}
              {[0, 1].map((k) => (
                <mesh key={k} geometry={geo.guard} position-x={-0.07} rotation-x={(k * Math.PI) / 2}>
                  <Flat color="#3a3b42" />
                </mesh>
              ))}
              <group ref={(el) => (fans.current[i] = el)}>
                <mesh geometry={geo.hub} position-x={0.03}>
                  <Flat color="#c9ccd2" metalness={0.4} roughness={0.4} />
                </mesh>
                {[0, 1, 2, 3, 4].map((k) => (
                  <mesh key={k} geometry={geo.blade} rotation-x={(k / 5) * TAU}>
                    <Flat color={L.blade} />
                  </mesh>
                ))}
              </group>
              {[-0.07, 0.07].map((dz) => (
                <group key={dz} ref={(el) => (rudders.current[i * 2 + (dz > 0 ? 1 : 0)] = el)} position={[-0.09, 0, dz]}>
                  <mesh geometry={geo.rudder}>
                    <Flat color={L.hull} />
                  </mesh>
                </group>
              ))}
            </group>
          ))}
        </group>
      </group>

      {/* an invisible box round the craft, so every tap lands */}
      <mesh geometry={geo.hit} position={[0, 0.5, 0]}>
        <meshBasicMaterial visible={false} />
      </mesh>
    </group>
  )
}

export default function HovercraftScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[2.9, 1.95, 3.9]} target={[0, 0.36, 0]} hint="It hovers on its own: bobbing on its air cushion with spray hissing from under the skirt, the fans spinning and the beacon blinking · tap it and it spins on the spot, one full turn, throwing a ring of spray · Look swaps rescue, military and tourist · drag to orbit">
      <Hovercraft {...props} />
    </Stage>
  )
}
