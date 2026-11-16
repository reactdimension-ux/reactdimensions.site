import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Burst, Flat, Particles, Ripple, Stage, TAU, Trail, blob, cone, facet, squash, useGeo, useKick, useTap, wobble } from './kit.jsx'

// A low-poly monster truck in a little dirt arena: a small pickup body (cab,
// bed, hood, light bar, chrome bumper and twin exhaust stacks, flame decals
// down its sides) perched high on four huge treaded tyres, with coil-over
// shocks and solid axles in plain view underneath. A wooden kicker ramp with
// a striped lip sits ahead of it, a pile of old tyres and a few cones round
// the edge. Left alone, the engine revs every couple of seconds: the body
// squats and rocks on its springs and the stacks cough a puff. Tap it and
// it guns it: dust flies off the rear tyres, it climbs the ramp, launches,
// flies nose-high and lands with a big squash and a cloud of dust, brakes,
// waits a beat and reverses back over the ramp to its spot. The jump is a
// small simulation: the two axles press on the ground (ramp included) through
// stiff springs, so the truck pitches over the ramp and bounces on landing.

const LOOKS = {
  flame: { body: '#d62c25', dark: '#a8201b', flame: ['#ff9f1c', '#ffe066'], rim: '#f2c230', spring: '#ffd23a', glass: '#232a3a' },
  toxic: { body: '#86d12e', dark: '#62a01f', flame: ['#6a2fa8', '#2c1745'], rim: '#7a36c4', spring: '#b86bff', glass: '#1f2430' },
  sky: { body: '#3fa2e6', dark: '#2b7bbc', flame: ['#ffffff', '#cfeaff'], rim: '#f4f6fa', spring: '#ffffff', glass: '#1e2a40' },
}

const GY = 0.06 // top of the dirt
const WR = 0.27 // tyre radius
const TW = 0.22 // tyre width
const WB = 0.78 // wheelbase (axles at +-WB/2)
const TZ = 0.38 // wheel centres (z)
const FY = 0.36 // body frame above the axle line
const X0 = -0.72 // where it waits, nose to the ramp
// the ramp profile along x: up from RA to RB, a flat top to RC, down to RD
const RA = 0
const RB = 0.36
const RC = 0.46
const RD = 0.78
const RH = 0.2
const VMAX = 1.8
const POP = 1.8 // the suspension's kick off the lip
const G = 7
const REV = 1.9 // seconds between idle revs
const IRON = '#2a2a30'
const TYRE = '#26262b'
const CHROME = '#cfd3da'
const DIRT = '#a67b52'

const rampH = (x) => (x < RA || x > RD ? 0 : x < RB ? (RH * (x - RA)) / (RB - RA) : x < RC ? RH : (RH * (RD - x)) / (RD - RC))
// how high a tyre's lowest point sits when the tyre rests on the ground at
// axle x: the highest point of the ground under the whole tyre, not just
// under its centre, so a tyre rides up a slope instead of sinking into it
function wheelFloor(x) {
  let m = -1
  for (let k = -4; k <= 4; k++) {
    const dx = (k / 4) * WR * 0.92
    m = Math.max(m, rampH(x + dx) + Math.sqrt(WR * WR - dx * dx))
  }
  return m - WR
}

// A coil spring one unit tall, standing on y = 0.
function coilGeo(r, wire, turns) {
  const pts = []
  const n = turns * 10
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * turns * TAU
    pts.push(new THREE.Vector3(Math.cos(a) * r, 0.06 + (i / n) * 0.88, Math.sin(a) * r))
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n * 2, wire, 4, false)
}

// The flame decal down the side, in x/y (the body's side), licking back.
function flameGeo(scale) {
  const s = new THREE.Shape()
  const P = [
    [0.47, 0.02],
    [0.47, 0.14],
    [0.22, 0.15],
    [0.3, 0.115],
    [0.02, 0.13],
    [0.12, 0.09],
    [-0.16, 0.1],
    [-0.02, 0.06],
    [-0.28, 0.05],
    [0.06, 0.02],
  ]
  P.forEach(([x, y], i) => {
    const X = 0.47 - (0.47 - x) * scale
    const Y = 0.08 + (y - 0.08) * scale
    i ? s.lineTo(X, Y) : s.moveTo(X, Y)
  })
  s.closePath()
  return new THREE.ShapeGeometry(s)
}

function Wheel({ geo, L, wheelRef, ...props }) {
  return (
    <group {...props}>
      <group ref={wheelRef}>
        <mesh geometry={geo.tyre}>
          <Flat color={TYRE} roughness={0.95} />
        </mesh>
        {Array.from({ length: 12 }, (_, k) =>
          [-1, 1].map((side) => (
            <group key={`${k}${side}`} rotation-z={(k / 12) * TAU + (side > 0 ? Math.PI / 12 : 0)}>
              <mesh geometry={geo.lug} position={[WR * 0.9, 0, (side * TW) / 4.4]} rotation-x={side * 0.38}>
                <Flat color={TYRE} roughness={0.95} />
              </mesh>
            </group>
          )),
        )}
        <mesh geometry={geo.rim}>
          <Flat color={L.rim} roughness={0.45} metalness={0.2} />
        </mesh>
        <mesh geometry={geo.dish}>
          <Flat color={IRON} />
        </mesh>
        {Array.from({ length: 6 }, (_, k) => (
          <mesh key={k} geometry={geo.bolt} position={[Math.cos((k / 6) * TAU) * WR * 0.27, Math.sin((k / 6) * TAU) * WR * 0.27, 0]}>
            <Flat color={CHROME} metalness={0.6} roughness={0.3} />
          </mesh>
        ))}
        <mesh geometry={geo.cap}>
          <Flat color={CHROME} metalness={0.6} roughness={0.3} />
        </mesh>
      </group>
    </group>
  )
}

export function MonsterTruck({ look = 'flame' }) {
  const L = LOOKS[look] || LOOKS.flame
  const { tap, handlers, clock } = useTap(1.5)
  const dust = useKick(2)
  const truck = useRef()
  const body = useRef()
  const wheels = useRef([])
  const shocks = useRef([])
  const landAt = useRef()
  const st = useRef({ x: X0, vx: 0, y: 0, vy: 0, p: 0, vp: 0, mode: 0, air: 0, popped: false, wait: 0, roll: 0, sus: 0, vs: 0, lastS: 1e9, landT: -99, impact: 0, acc: 0 })

  const geo = useGeo(() => {
    const ramp = new THREE.Shape()
    ramp.moveTo(RA, 0)
    ramp.lineTo(RB, RH)
    ramp.lineTo(RC, RH)
    ramp.lineTo(RD, 0)
    ramp.closePath()
    const cab = new THREE.Shape()
    cab.moveTo(-0.2, 0)
    cab.lineTo(0.16, 0)
    cab.lineTo(0.07, 0.2)
    cab.lineTo(-0.18, 0.2)
    cab.closePath()
    const win = new THREE.Shape()
    win.moveTo(-0.15, 0.03)
    win.lineTo(0.12, 0.03)
    win.lineTo(0.065, 0.165)
    win.lineTo(-0.14, 0.165)
    win.closePath()
    return {
      dirt: facet(new THREE.CylinderGeometry(1, 1.04, GY, 20, 1).translate(0, GY / 2, 0), 0.025, 1, [1, 0.3, 1]).scale(2.05, 1, 1.32),
      rut: new THREE.BoxGeometry(1, 0.006, 0.16),
      ramp: facet(new THREE.ExtrudeGeometry(ramp, { depth: 1.04, bevelEnabled: false }).translate(0, 0, -0.52), 0.004, 2),
      plank: new THREE.BoxGeometry(0.014, 0.008, 1.05),
      stripe: new THREE.BoxGeometry(RC - RB + 0.01, 0.012, 1.04 / 8),
      strut: new THREE.BoxGeometry(0.03, RH, 0.03),
      tyre: facet(new THREE.CylinderGeometry(WR * 0.86, WR * 0.86, TW, 16, 1).rotateX(Math.PI / 2), 0.004, 3),
      lug: new THREE.BoxGeometry(WR * 0.26, WR * 0.24, TW * 0.5),
      rim: new THREE.CylinderGeometry(WR * 0.46, WR * 0.46, TW + 0.012, 12, 1).rotateX(Math.PI / 2),
      dish: new THREE.CylinderGeometry(WR * 0.34, WR * 0.34, TW + 0.02, 12, 1).rotateX(Math.PI / 2),
      bolt: new THREE.BoxGeometry(0.022, 0.022, TW + 0.03),
      cap: new THREE.CylinderGeometry(0.035, 0.035, TW + 0.05, 6, 1).rotateX(Math.PI / 2),
      axle: new THREE.CylinderGeometry(0.035, 0.035, TZ * 2, 6).rotateX(Math.PI / 2),
      diff: blob(0.085, 4, 0),
      coil: coilGeo(0.034, 0.008, 6),
      shockBody: new THREE.CylinderGeometry(0.02, 0.02, 0.55, 6).translate(0, 0.3, 0),
      shockRod: new THREE.CylinderGeometry(0.01, 0.01, 1, 5).translate(0, 0.5, 0),
      rail: new THREE.BoxGeometry(1.0, 0.05, 0.05),
      tub: facet(new THREE.BoxGeometry(1.0, 0.17, 0.46), 0.006, 5),
      hood: facet(new THREE.BoxGeometry(0.3, 0.035, 0.36), 0.004, 6),
      cab: facet(new THREE.ExtrudeGeometry(cab, { depth: 0.42, bevelEnabled: false }).translate(0, 0, -0.21), 0.004, 7),
      win: new THREE.ShapeGeometry(win),
      screen: new THREE.BoxGeometry(0.008, 0.18, 0.36),
      bedWall: new THREE.BoxGeometry(0.3, 0.07, 0.025),
      gate: new THREE.BoxGeometry(0.025, 0.07, 0.46),
      flameA: flameGeo(1),
      flameB: flameGeo(0.62),
      grille: new THREE.BoxGeometry(0.02, 0.09, 0.26),
      lamp: new THREE.BoxGeometry(0.02, 0.045, 0.07),
      bumper: new THREE.BoxGeometry(0.06, 0.05, 0.5),
      bar: new THREE.BoxGeometry(0.06, 0.035, 0.36),
      barLamp: new THREE.BoxGeometry(0.02, 0.03, 0.06),
      stack: new THREE.CylinderGeometry(0.022, 0.026, 0.4, 7).translate(0, 0.2, 0),
      stackTip: new THREE.CylinderGeometry(0.032, 0.026, 0.05, 7).translate(0, 0.025, 0),
      oldTyre: new THREE.TorusGeometry(0.17, 0.07, 5, 10).rotateX(Math.PI / 2),
      cone: cone(0.07, 0.2, 6, 8),
      coneBase: new THREE.BoxGeometry(0.16, 0.02, 0.16),
      coneBand: new THREE.CylinderGeometry(0.046, 0.055, 0.035, 6),
      rock: blob(1, 9, 0),
      puff: facet(new THREE.IcosahedronGeometry(1, 0), 0.08, 11),
      clod: blob(1, 13, 0),
      hit: new THREE.BoxGeometry(1.4, 1.1, 1.0),
    }
  }, [])

  const planks = useMemo(() => Array.from({ length: 6 }, (_, i) => RA + ((i + 0.6) / 6.2) * (RB - RA)), [])
  const slope = Math.atan2(RH, RB - RA)
  // the shocks: two each side of every axle, [x, z]
  const SH = useMemo(() => [-1, 1].flatMap((ax) => [-1, 1].flatMap((sz) => [-1, 1].map((k) => [ax * (WB / 2) + k * 0.075, sz * 0.21]))), [])

  useFrame((_, dt) => {
    const d = Math.min(Math.max(dt, 1e-3), 1 / 30)
    const t = clock.elapsedTime
    const S = st.current
    // a tap starts a run, but only from the waiting spot
    const s = tap.since(t)
    if (s < S.lastS - 0.01 && s < 0.5 && S.mode === 0) {
      S.mode = 1
      S.popped = false
    }
    S.lastS = s
    // the throttle: gun it, brake after the landing, pause, reverse home
    const v0 = S.vx
    if (S.mode === 1) {
      S.vx = Math.min(VMAX, S.vx + 6 * d)
      if (S.x > RD + 0.3 && S.air === 0) S.mode = 2
    } else if (S.mode === 2) {
      S.vx = Math.max(0, S.vx - 7 * d)
      if (!S.vx) {
        S.mode = 3
        S.wait = 0
      }
    } else if (S.mode === 3) {
      S.wait += d
      if (S.wait > 0.6) S.mode = 4
    } else if (S.mode === 4) {
      S.vx = Math.max(-Math.min(1.0, 0.06 + (S.x - X0) * 1.6), S.vx - 2.5 * d)
      if (S.x - X0 < 0.003) {
        S.x = X0
        S.vx = 0
        S.mode = 0
      }
    }
    S.acc += ((S.vx - v0) / d - S.acc) * Math.min(1, d * 10)
    // the springs kick it off the lip as the front tyres leave the ramp
    if (S.mode === 1 && !S.popped && S.x + WB / 2 > RC) {
      S.popped = true
      S.vy = Math.max(S.vy, POP)
    }
    S.x += S.vx * d
    S.roll += (S.vx * d) / WR
    // the axles on the ground: two stiff, damped contacts, in small steps
    let touch = false
    const n = 6
    const I = 0.45 * (WB / 2) ** 2
    const wasAir = S.air > 0.12
    for (let i = 0; i < n; i++) {
      const e = d / n
      S.vy -= G * e
      for (const side of [1, -1]) {
        const a = (side * WB) / 2
        const c = Math.cos(S.p)
        const pen = wheelFloor(S.x + c * a) - (S.y + Math.sin(S.p) * a)
        if (pen > 0) {
          if (wasAir && !touch) S.impact = Math.max(S.impact, -S.vy)
          const F = Math.max(0, 1400 * pen - 40 * (S.vy + S.vp * a * c))
          S.vy += F * e * 0.5
          S.vp += (F * e * a * c * 0.5) / I
          touch = true
        }
      }
      // in the air the nose drops a touch, ready to land
      if (S.air > 0.05) S.vp += (-(S.p + 0.06) * 14 - S.vp * 4) * e
      S.vp *= 1 - 1.5 * e
      S.y += S.vy * e
      S.p += S.vp * e
    }
    if (touch && wasAir && S.impact > 0.6) {
      // a hard landing: squash, dust and a slammed suspension
      S.landT = t
      S.vs -= S.impact * 0.9
      landAt.current.position.x = S.x
      dust.kick(t)
    }
    if (touch) S.impact = 0
    S.air = touch ? 0 : S.air + d
    truck.current.position.set(S.x, GY + WR + S.y, 0)
    truck.current.rotation.z = S.p
    wheels.current.forEach((w) => w && (w.rotation.z = -S.roll))
    // the suspension: a sprung body over the axles; it droops in the air,
    // dips on each idle rev and slams down on landing
    const rv = S.mode === 0 ? Math.exp(-((t % REV) / REV) * 9) : 0
    if (S.mode === 0 && t % REV < d) S.vs -= 0.55
    const target = S.air > 0.05 ? 0.05 : 0
    S.vs += ((target - S.sus) * 260 - S.vs * 11) * d
    S.sus = Math.max(-0.13, Math.min(0.07, S.sus + S.vs * d))
    const lt = t - S.landT
    body.current.position.y = FY + S.sus
    body.current.rotation.x = rv * 0.05 * Math.sin(t * 30) + Math.sin(t * 47) * 0.003
    body.current.rotation.z = -S.acc * 0.012 - S.vp * 0.02
    squash(body.current, 0.22 * wobble(lt, 15, 4))
    shocks.current.forEach((m) => m && (m.scale.y = FY + S.sus - 0.03))
  })

  const revving = () => {
    const S = st.current
    return S.mode === 0 ? ((clock.elapsedTime % REV) < 0.35 ? 1 : 0) : S.mode === 1 ? 1 : 0
  }
  const grounded = () => st.current.mode === 1 && st.current.air === 0 && st.current.vx > 0.2
  const tailL = useRef()
  const tailR = useRef()

  return (
    <group {...handlers}>
      {/* the arena: an oval of dirt with worn tyre ruts */}
      <mesh geometry={geo.dirt} position-x={0.3}>
        <Flat color={DIRT} />
      </mesh>
      {[-1, 1].map((sz) => (
        <mesh key={sz} geometry={geo.rut} position={[0.3, GY + 0.003, sz * TZ]} scale-x={3.2}>
          <Flat color="#8c6441" />
        </mesh>
      ))}
      {/* the kicker ramp: planks up the face, a striped lip, struts behind */}
      <group position-y={GY}>
        <mesh geometry={geo.ramp}>
          <Flat color="#c48d55" />
        </mesh>
        {planks.map((x) => (
          <mesh key={x} geometry={geo.plank} position={[x, rampH(x) + 0.003, 0]} rotation-z={slope}>
            <Flat color="#8f6236" />
          </mesh>
        ))}
        {Array.from({ length: 8 }, (_, k) => (
          <mesh key={k} geometry={geo.stripe} position={[(RB + RC) / 2, RH + 0.006, -0.52 + (k + 0.5) * (1.04 / 8)]}>
            <Flat color={k % 2 ? '#26262b' : '#f2c230'} />
          </mesh>
        ))}
        {[-0.5, 0, 0.5].map((z) => (
          <mesh key={z} geometry={geo.strut} position={[(RC + RD) / 2 - 0.02, RH / 2, z]} rotation-z={-0.6}>
            <Flat color="#8f6236" />
          </mesh>
        ))}
      </group>
      {/* a pile of old tyres, cones and a few rocks round the edge */}
      <group position={[-0.35, GY, -1.02]}>
        {[0, 1, 2].map((k) => (
          <mesh key={k} geometry={geo.oldTyre} position={[k === 2 ? 0.06 : 0, 0.07 + k * 0.13, 0]} rotation-z={k === 2 ? 0.15 : 0}>
            <Flat color={TYRE} roughness={0.95} />
          </mesh>
        ))}
        <mesh geometry={geo.oldTyre} position={[0.38, 0.07, 0.08]}>
          <Flat color={TYRE} roughness={0.95} />
        </mesh>
      </group>
      {[
        [1.75, 0.62],
        [-1.15, 0.88],
        [1.55, -0.8],
      ].map(([x, z], i) => (
        <group key={i} position={[x, GY, z]}>
          <mesh geometry={geo.coneBase} position-y={0.01}>
            <Flat color="#e8611c" />
          </mesh>
          <mesh geometry={geo.cone} position-y={0.02}>
            <Flat color="#f2761f" />
          </mesh>
          <mesh geometry={geo.coneBand} position-y={0.1}>
            <Flat color="#f4f4f4" />
          </mesh>
        </group>
      ))}
      {[
        [0.95, 1.02, 0.07],
        [-1.45, -0.55, 0.06],
        [2.05, 0.05, 0.05],
        [0.55, -1.08, 0.05],
      ].map(([x, z, r], i) => (
        <mesh key={i} geometry={geo.rock} position={[x, GY + r * 0.4, z]} scale={[r * 1.3, r, r]} rotation-y={i}>
          <Flat color={i % 2 ? '#8e8a84' : '#a29d95'} />
        </mesh>
      ))}

      {/* the truck: the axle frame pitches over the ground, the body rides
          on its springs above */}
      <group ref={truck} position={[X0, GY + WR, 0]}>
        {[-1, 1].flatMap((ax) =>
          [-1, 1].map((sz) => <Wheel key={`${ax}${sz}`} geo={geo} L={L} wheelRef={(el) => (wheels.current[(ax + 1) + (sz + 1) / 2] = el)} position={[(ax * WB) / 2, 0, sz * TZ]} />),
        )}
        {[-1, 1].map((ax) => (
          <group key={ax} position-x={(ax * WB) / 2}>
            <mesh geometry={geo.axle}>
              <Flat color={IRON} />
            </mesh>
            <mesh geometry={geo.diff} scale={[1, 0.9, 1.1]}>
              <Flat color="#44444c" />
            </mesh>
          </group>
        ))}
        {SH.map(([x, z], i) => (
          <group key={i} ref={(el) => (shocks.current[i] = el)} position={[x, 0.03, z]} scale-y={FY - 0.03}>
            <mesh geometry={geo.coil}>
              <Flat color={L.spring} roughness={0.5} />
            </mesh>
            <mesh geometry={geo.shockRod}>
              <Flat color={CHROME} metalness={0.6} roughness={0.3} />
            </mesh>
            <mesh geometry={geo.shockBody}>
              <Flat color={IRON} />
            </mesh>
          </group>
        ))}
        {/* where the rear tyres meet the ground, for the dust trail */}
        <group ref={tailL} position={[-WB / 2 - 0.12, -WR + 0.05, TZ]} />
        <group ref={tailR} position={[-WB / 2 - 0.12, -WR + 0.05, -TZ]} />

        <group ref={body} position-y={FY}>
          {[-1, 1].map((sz) => (
            <mesh key={sz} geometry={geo.rail} position={[0, 0.025, sz * 0.2]}>
              <Flat color={IRON} />
            </mesh>
          ))}
          <mesh geometry={geo.tub} position={[0, 0.135, 0]}>
            <Flat color={L.body} />
          </mesh>
          <mesh geometry={geo.hood} position={[0.33, 0.236, 0]}>
            <Flat color={L.dark} />
          </mesh>
          {/* the flame decals, both sides */}
          {[1, -1].map((sz) => (
            <group key={sz} position={[0, 0.06, sz * 0.232]} scale-z={sz}>
              <mesh geometry={geo.flameA}>
                <Flat color={L.flame[0]} side={THREE.DoubleSide} />
              </mesh>
              <mesh geometry={geo.flameB} position-z={0.002}>
                <Flat color={L.flame[1]} side={THREE.DoubleSide} />
              </mesh>
            </group>
          ))}
          {/* the cab, its glass and the light bar */}
          <mesh geometry={geo.cab} position={[0.02, 0.22, 0]}>
            <Flat color={L.body} />
          </mesh>
          {[1, -1].map((sz) => (
            <mesh key={sz} geometry={geo.win} position={[0.02, 0.22, sz * 0.212]}>
              <Flat color={L.glass} roughness={0.2} side={THREE.DoubleSide} />
            </mesh>
          ))}
          <mesh geometry={geo.screen} position={[0.137, 0.32, 0]} rotation-z={Math.atan2(0.09, 0.2)}>
            <Flat color={L.glass} roughness={0.2} />
          </mesh>
          <mesh geometry={geo.bar} position={[-0.02, 0.437, 0]}>
            <Flat color={IRON} />
          </mesh>
          {[-0.12, -0.04, 0.04, 0.12].map((z) => (
            <mesh key={z} geometry={geo.barLamp} position={[0.012, 0.437, z]}>
              <Flat color="#fff4c4" emissive="#ffe08a" emissiveIntensity={1} />
            </mesh>
          ))}
          {/* the bed: low walls and a tailgate */}
          {[-1, 1].map((sz) => (
            <mesh key={sz} geometry={geo.bedWall} position={[-0.34, 0.255, sz * 0.218]}>
              <Flat color={L.body} />
            </mesh>
          ))}
          <mesh geometry={geo.gate} position={[-0.488, 0.255, 0]}>
            <Flat color={L.dark} />
          </mesh>
          {/* the nose: grille, headlamps and a chrome bumper */}
          <mesh geometry={geo.grille} position={[0.5, 0.15, 0]}>
            <Flat color={IRON} />
          </mesh>
          {[-1, 1].map((sz) => (
            <mesh key={sz} geometry={geo.lamp} position={[0.503, 0.165, sz * 0.165]}>
              <Flat color="#fff4c4" emissive="#ffe08a" emissiveIntensity={0.9} />
            </mesh>
          ))}
          <mesh geometry={geo.bumper} position={[0.52, 0.07, 0]}>
            <Flat color={CHROME} metalness={0.6} roughness={0.3} />
          </mesh>
          <mesh geometry={geo.bumper} position={[-0.51, 0.07, 0]}>
            <Flat color={CHROME} metalness={0.6} roughness={0.3} />
          </mesh>
          {/* twin exhaust stacks behind the cab, with their smoke */}
          {[-1, 1].map((sz) => (
            <group key={sz} position={[-0.25, 0.22, sz * 0.15]}>
              <mesh geometry={geo.stack}>
                <Flat color={CHROME} metalness={0.6} roughness={0.3} />
              </mesh>
              <mesh geometry={geo.stackTip} position-y={0.4}>
                <Flat color="#3a3a40" />
              </mesh>
            </group>
          ))}
          {[-1, 1].map((sz) => (
            <Particles key={sz} geometry={geo.puff} count={8} life={1.2} origin={[-0.25, 0.66, sz * 0.15]} spread={0.01} velocity={[-0.2, 0.4, 0]} scatter={0.06} drift={0.06} size={[0.02, 0.07]} colors={['#d8d8de', '#c4c4cc']} opacity={[0.6, 0]} seed={sz + 3} />
          ))}
          {[-1, 1].map((sz) => (
            <Particles key={sz} geometry={geo.puff} count={10} life={0.8} origin={[-0.25, 0.66, sz * 0.15]} spread={0.02} velocity={[-0.35, 0.8, 0]} scatter={0.15} drift={0.08} size={[0.035, 0.13]} colors={['#4a4a52', '#2e2e34', '#6a6a72']} opacity={[0.85, 0]} active={revving} seed={sz + 7} />
          ))}
          <Burst tap={tap} geometry={geo.puff} count={8} colors={['#3a3a42', '#55555e']} speed={0.8} gravity={-0.8} size={0.08} life={0.9} origin={[-0.25, 0.68, 0]} spread={0.5} up={1.4} seed={8} />
        </group>
        <mesh geometry={geo.hit} position={[0, 0.35, 0]}>
          <meshBasicMaterial visible={false} />
        </mesh>
      </group>

      {/* dust off the rear tyres as it guns it, and a cloud where it lands */}
      <Trail target={tailL} count={16} every={0.035} color="#c9a77f" size={0.07} grow={0.12} opacity={0.75} active={grounded} />
      <Trail target={tailR} count={16} every={0.035} color="#c9a77f" size={0.07} grow={0.12} opacity={0.75} active={grounded} />
      <group ref={landAt} position-x={1.1}>
        <Ripple tap={dust} count={2} color="#d9bf98" radius={1.4} y={GY + 0.01} opacity={0.7} />
        <Burst tap={dust} geometry={geo.clod} count={22} colors={['#b8916a', '#9c7650', '#d2b48a']} speed={1.6} gravity={3.5} size={0.055} life={1} origin={[0, GY + 0.05, 0]} spread={1.3} up={0.8} seed={4} />
        <Burst tap={dust} geometry={geo.puff} count={12} colors={['#d9c3a0', '#c8ae88']} speed={0.7} gravity={-0.3} size={0.12} life={1.3} origin={[0, GY + 0.08, 0]} spread={1.6} up={0.4} seed={6} />
      </group>
    </group>
  )
}

export default function MonsterTruckScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[2.9, 2.5, 5.8]} target={[0.3, 0.45, 0]} hint="The engine revs on its own: the body bounces on its springs and the stacks puff · tap it and it guns it at the ramp, jumps, lands with a squash and a cloud of dust, then reverses back · Look swaps flame, toxic and sky · drag to orbit">
      <MonsterTruck {...props} />
    </Stage>
  )
}
