import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useCursor } from '@react-three/drei'
import * as THREE from 'three'
import { CY, ENGINE, FLAP_COUNT, LENGTH, SLAT_COUNT, bellyGeometry, decalGeometry, doorGeometry, engineGeometry, finGeometry, flapGeometry, fuselageGeometry, sharkletTip, slatGeometry, smooth, stabGeometry, tyreGeometry, wingGeometry, wingPoint } from './geometry.js'
import { finTexture, fuselageTexture, glowTexture, spinnerTexture, statorTexture, wingTexture } from './textures.js'

// A single-aisle twin-jet airliner at real size (37.6 m long, 35.8 m span),
// built from its own dimensions rather than loaded from a file. The aircraft's
// frame has x running aft from the nose, y up from the ground and +z to port;
// this component centres it on the origin with the nose towards -x.
//
// What moves: the flaps travel aft and droop on hinge lines below the wing
// while the slats swing forward and down off the leading edge; the main gear
// folds inboard into the belly and the nose gear forward into its bay; the
// forward door moves out and slides forward on its arm; the fans turn.

const WING_GREY = '#c3c7cc'
const MAIN = { s: 17.71, y: 2.7, z: 3.795, R: 0.585, W: 0.42 } // main gear pivot, and its tyres
const NOSE = { s: 5.07, y: 1.9, R: 0.38, W: 0.22 }
const FLAP_MAX = THREE.MathUtils.degToRad(35)
const SLAT_MAX = THREE.MathUtils.degToRad(24)
const UP = new THREE.Vector3(0, 1, 0)

// A prop that can also be changed from inside the scene; `onChange` lets the
// owner stay in sync.
function useTwoWay(prop, key, onChange) {
  const [v, setV] = useState(prop)
  useEffect(() => setV(prop), [prop])
  return [
    v,
    (next) => {
      setV(next)
      onChange?.({ [key]: next })
    },
  ]
}

// a rod between two points
function Bar({ a, b, r = 0.04, material }) {
  const [pos, quat, len] = useMemo(() => {
    const A = new THREE.Vector3(...a)
    const d = new THREE.Vector3(...b).sub(A)
    return [A.clone().addScaledVector(d, 0.5), new THREE.Quaternion().setFromUnitVectors(UP, d.clone().normalize()), d.length()]
  }, [a, b])
  return (
    <mesh position={pos} quaternion={quat} material={material} castShadow>
      <cylinderGeometry args={[r, r, len, 14]} />
    </mesh>
  )
}

function Wheel({ z, R, W, tyre, mat }) {
  const side = Math.sign(z) || 1
  return (
    <group position={[0, 0, z]}>
      <mesh geometry={tyre} material={mat.tyre} castShadow />
      <mesh rotation-x={Math.PI / 2} material={mat.hub}>
        <cylinderGeometry args={[R * 0.57, R * 0.57, W * 0.7, 36]} />
      </mesh>
      <mesh rotation-x={Math.PI / 2} position-z={side * W * 0.36} material={mat.hub}>
        <cylinderGeometry args={[R * 0.5, R * 0.5, 0.012, 36]} />
      </mesh>
      <mesh rotation-x={Math.PI / 2} position-z={side * W * 0.37} material={mat.steel}>
        <cylinderGeometry args={[R * 0.16, R * 0.24, W * 0.16, 20]} />
      </mesh>
      {Array.from({ length: 10 }, (_, i) => {
        const a = (i / 10) * Math.PI * 2
        return (
          <mesh key={i} position={[Math.cos(a) * R * 0.38, Math.sin(a) * R * 0.38, side * W * 0.365]} rotation-x={Math.PI / 2} material={mat.steel}>
            <cylinderGeometry args={[R * 0.03, R * 0.03, 0.03, 8]} />
          </mesh>
        )
      })}
    </group>
  )
}

// a part that swings about a hinge line: `register` receives its pivot group
function Hinged({ part, material, register }) {
  const back = useMemo(() => part.a.clone().negate(), [part])
  return (
    <group position={part.a} ref={register}>
      <mesh geometry={part.geometry} position={back} material={material} castShadow receiveShadow />
    </group>
  )
}

// the pylon that carries the engine under the wing, in the engine's frame
function pylonGeometry() {
  const P = (x, dy = 0, below = true) => {
    const p = wingPoint(ENGINE.z, x, below)
    return [p.x - ENGINE.s, p.y - ENGINE.y + dy]
  }
  const le = P(0, 0, false)
  const pts = [[0.72, 1.0], [2.0, 1.19], [le[0] - 0.12, le[1] - 0.09], [le[0] + 0.3, le[1] + 0.02], P(0.5, 0.12), P(0.6, 0.02), P(0.47, -0.3), [4.05, 0.5], [3.0, 0.7], [1.6, 0.85]]
  const shape = new THREE.Shape(pts.map((p) => new THREE.Vector2(p[0], p[1])))
  const g = new THREE.ExtrudeGeometry(shape, { depth: 0.3, bevelEnabled: true, bevelSize: 0.07, bevelThickness: 0.07, bevelSegments: 4, curveSegments: 4 })
  g.translate(0, 0, -0.15)
  return g
}

// bodyColor, accentColor, stripeColor: the paint (the accent fills the belly
// and tail, the stripe rides above it). registration, airline: lettering on
// the rear and forward fuselage. gear: down or up. flaps: 0 clean .. 1 full,
// with the slats. engines: fans turning. lights: navigation, strobe, beacon
// and landing lights. door: the forward port door open. Click the door, an
// engine or the landing gear to work them.
export default function Airliner({
  bodyColor = '#f2f3f4',
  accentColor = '#1d3f9d',
  stripeColor = '#b3b9c2',
  registration = 'RD-AIR',
  airline = '',
  gear: gearProp = true,
  flaps = 0,
  engines: enginesProp = false,
  lights = true,
  door: doorProp = false,
  onChange,
}) {
  const [gear, setGear] = useTwoWay(gearProp, 'gear', onChange)
  const [engines, setEngines] = useTwoWay(enginesProp, 'engines', onChange)
  const [door, setDoor] = useTwoWay(doorProp, 'door', onChange)
  const [hover, setHover] = useState(false)
  useCursor(hover, 'pointer')

  // ---- geometry: built once ----
  const geo = useMemo(() => {
    const flaps = Array.from({ length: FLAP_COUNT }, (_, i) => flapGeometry(i))
    const slats = Array.from({ length: SLAT_COUNT }, (_, i) => slatGeometry(i))
    return {
      fuselage: fuselageGeometry(),
      belly: bellyGeometry(),
      wing: wingGeometry(),
      fin: finGeometry(),
      stab: stabGeometry(),
      decal: decalGeometry(),
      door: doorGeometry(),
      engine: engineGeometry(),
      pylon: pylonGeometry(),
      mainTyre: tyreGeometry(MAIN.R, MAIN.W, MAIN.R * 0.56),
      noseTyre: tyreGeometry(NOSE.R, NOSE.W, NOSE.R * 0.56),
      flaps,
      slats,
      flapAxis: flaps.map((f) => f.b.clone().sub(f.a).normalize()),
      slatAxis: slats.map((f) => f.b.clone().sub(f.a).normalize()),
    }
  }, [])
  useEffect(
    () => () => {
      const drop = (o) => (o.isBufferGeometry ? o.dispose() : o && typeof o === 'object' && !o.isVector3 && Object.values(o).forEach(drop))
      drop(geo)
    },
    [geo],
  )

  // ---- paint ----
  const fuseTex = useMemo(() => fuselageTexture({ body: bodyColor, accent: accentColor, stripe: stripeColor, registration, airline }), [bodyColor, accentColor, stripeColor, registration, airline])
  const wingTex = useMemo(() => wingTexture({ wing: WING_GREY, accent: accentColor, stripe: stripeColor }), [accentColor, stripeColor])
  const finTex = useMemo(() => finTexture({ body: bodyColor, accent: accentColor, stripe: stripeColor }), [bodyColor, accentColor, stripeColor])
  const tex = useMemo(() => ({ spinner: spinnerTexture(), stator: statorTexture(), glow: glowTexture() }), [])
  useEffect(() => () => fuseTex.dispose(), [fuseTex])
  useEffect(() => () => wingTex.dispose(), [wingTex])
  useEffect(() => () => finTex.dispose(), [finTex])
  useEffect(() => () => Object.values(tex).forEach((t) => t.dispose()), [tex])

  const mat = useMemo(() => {
    const paint = { roughness: 0.36, metalness: 0, clearcoat: 0.5, clearcoatRoughness: 0.16, envMapIntensity: 0.85 }
    // Decals lie a few millimetres off the skin, and some lie on each other
    // (glass on its seal, the door's fittings on the door). Each layer gets
    // its own depth offset, so the order holds whatever the depth buffer.
    const layer = (n) => ({ polygonOffset: true, polygonOffsetFactor: -2 * n, polygonOffsetUnits: -2 * n })
    const glass = { color: '#0a0e13', roughness: 0.05, metalness: 0.55, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.5 }
    return {
      skin: new THREE.MeshPhysicalMaterial(paint),
      wing: new THREE.MeshPhysicalMaterial({ ...paint, roughness: 0.4 }),
      fin: new THREE.MeshPhysicalMaterial(paint),
      body: new THREE.MeshPhysicalMaterial(paint),
      grey: new THREE.MeshPhysicalMaterial({ ...paint, color: WING_GREY, roughness: 0.42 }),
      way: new THREE.MeshStandardMaterial({ color: '#15171a', roughness: 0.9, ...layer(1) }),
      seal: new THREE.MeshStandardMaterial({ color: '#191b1e', roughness: 0.7, ...layer(2) }),
      line: new THREE.MeshStandardMaterial({ color: '#4b5057', roughness: 0.6, ...layer(2) }),
      mark: new THREE.MeshStandardMaterial({ color: '#c4281f', roughness: 0.5, ...layer(2) }),
      glass: new THREE.MeshPhysicalMaterial({ ...glass, ...layer(3) }),
      panel: new THREE.MeshPhysicalMaterial({ ...paint, ...layer(3) }),
      // the fittings on the door panel
      doorSeal: new THREE.MeshStandardMaterial({ color: '#191b1e', roughness: 0.7, ...layer(4) }),
      doorLine: new THREE.MeshStandardMaterial({ color: '#4b5057', roughness: 0.6, ...layer(4) }),
      doorMark: new THREE.MeshStandardMaterial({ color: '#c4281f', roughness: 0.5, ...layer(4) }),
      doorGlass: new THREE.MeshPhysicalMaterial({ ...glass, ...layer(5) }),
      metal: new THREE.MeshStandardMaterial({ color: '#d6d9dd', metalness: 1, roughness: 0.2 }),
      liner: new THREE.MeshStandardMaterial({ color: '#8f9399', metalness: 0.5, roughness: 0.55 }),
      dark: new THREE.MeshStandardMaterial({ color: '#0b0c0e', roughness: 0.85, metalness: 0.2 }),
      core: new THREE.MeshStandardMaterial({ color: '#8d9197', metalness: 0.9, roughness: 0.42 }),
      hot: new THREE.MeshStandardMaterial({ color: '#6a5a4c', metalness: 0.9, roughness: 0.48 }),
      blade: new THREE.MeshStandardMaterial({ color: '#5d626a', metalness: 1, roughness: 0.32, side: THREE.DoubleSide }),
      spinner: new THREE.MeshStandardMaterial({ map: tex.spinner, metalness: 0.4, roughness: 0.4 }),
      stator: new THREE.MeshStandardMaterial({ map: tex.stator, metalness: 0.6, roughness: 0.6 }),
      tyre: new THREE.MeshStandardMaterial({ color: '#141516', roughness: 0.92 }),
      hub: new THREE.MeshStandardMaterial({ color: '#c9ccd1', metalness: 0.75, roughness: 0.38 }),
      strut: new THREE.MeshPhysicalMaterial({ color: '#d7d9dc', roughness: 0.4, clearcoat: 0.5, clearcoatRoughness: 0.2 }),
      steel: new THREE.MeshStandardMaterial({ color: '#73777d', metalness: 0.9, roughness: 0.4 }),
      chrome: new THREE.MeshStandardMaterial({ color: '#e4e7ea', metalness: 1, roughness: 0.08 }),
      lamp: new THREE.MeshStandardMaterial({ color: '#f4f6f8', emissive: '#fff4d6', emissiveIntensity: 0, roughness: 0.2 }),
    }
  }, [tex])
  useEffect(() => () => Object.values(mat).forEach((m) => m.dispose()), [mat])
  useEffect(() => {
    mat.skin.map = fuseTex
    mat.wing.map = wingTex
    mat.fin.map = finTex
    mat.body.color.set(bodyColor)
    mat.panel.color.set(bodyColor)
    ;[mat.skin, mat.wing, mat.fin].forEach((m) => (m.needsUpdate = true))
  }, [mat, fuseTex, wingTex, finTex, bodyColor])

  // ---- lights: where each lamp is, its colour, and how it behaves ----
  const lamps = useMemo(() => {
    const out = []
    for (const side of [1, -1]) {
      const tip = wingPoint(16.86, 0.01)
      out.push({ p: [tip.x - 0.06, tip.y, side * (tip.z + 0.04)], color: side > 0 ? '#ff2a1c' : '#18e06a', size: 0.9, kind: 'nav' })
      const top = sharkletTip()
      out.push({ p: [top.x + 0.3, top.y - 0.25, side * top.z], color: '#ffffff', size: 2.4, kind: 'strobe' })
      const land = wingPoint(2.5, 0.025, true)
      out.push({ p: [land.x - 0.05, land.y - 0.02, side * land.z], color: '#fff3d2', size: 0.7, kind: 'landing' })
      out.push({ p: [NOSE.s - 0.16, 1.22, side * 0.13], color: '#fff3d2', size: 0.5, kind: 'landing' })
    }
    out.push({ p: [LENGTH + 0.05, CY + 1.05, 0], color: '#ffffff', size: 0.5, kind: 'nav' })
    out.push({ p: [15.4, CY + 2.16, 0], color: '#ff2414', size: 1.7, kind: 'beacon' })
    out.push({ p: [17.4, 1.43, 0], color: '#ff2414', size: 1.7, kind: 'beacon' })
    return out
  }, [])

  // ---- motion ----
  const flapRefs = useRef({})
  const slatRefs = useRef({})
  const mainRefs = useRef({})
  const fanRefs = useRef({})
  const noseDoorRefs = useRef({})
  const glowRefs = useRef([])
  const noseRef = useRef()
  const doorRef = useRef()
  const live = useRef({})
  live.current = { gear, flaps, engines, lights, door }
  const st = useRef({ gear: gearProp ? 0 : 1, flaps, rpm: enginesProp ? 1 : 0, door: doorProp ? 1 : 0, doorV: 0, light: lights ? 1 : 0 })

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30)
    const w = live.current
    const s = st.current
    const t = state.clock.elapsedTime

    // flaps run at the pace of the real ones; the slats are out by half travel
    s.flaps += THREE.MathUtils.clamp(w.flaps - s.flaps, -dt / 4, dt / 4)
    const slat = smooth(s.flaps / 0.45) * SLAT_MAX
    for (const k in flapRefs.current) flapRefs.current[k]?.quaternion.setFromAxisAngle(geo.flapAxis[k.slice(1)], -s.flaps * FLAP_MAX)
    for (const k in slatRefs.current) slatRefs.current[k]?.quaternion.setFromAxisAngle(geo.slatAxis[k.slice(1)], slat)

    // gear: 0 down .. 1 up; the legs fold away and are hidden once stowed
    s.gear += THREE.MathUtils.clamp((w.gear ? 0 : 1) - s.gear, -dt / 4.5, dt / 4.5)
    const up = smooth(s.gear)
    for (const k in mainRefs.current) {
      const g = mainRefs.current[k]
      if (!g) continue
      g.rotation.x = up * THREE.MathUtils.degToRad(80)
      g.visible = s.gear < 0.99
    }
    if (noseRef.current) {
      noseRef.current.rotation.z = -up * THREE.MathUtils.degToRad(96)
      noseRef.current.visible = s.gear < 0.99
    }
    for (const k in noseDoorRefs.current) if (noseDoorRefs.current[k]) noseDoorRefs.current[k].rotation.x = smooth((s.gear - 0.55) / 0.45) * (Math.PI / 2)

    // fans spool up and run down slowly
    s.rpm += ((w.engines ? 1 : 0) - s.rpm) * (1 - Math.exp(-dt * 0.7))
    for (const k in fanRefs.current) if (fanRefs.current[k]) fanRefs.current[k].rotation.x += s.rpm * 11 * dt

    // the door comes out of its frame, then slides forward alongside the fuselage
    s.doorV += ((w.door ? 1 : 0) - s.door) * 14 * dt - s.doorV * 6 * dt
    s.door = THREE.MathUtils.clamp(s.door + s.doorV * dt, 0, 1)
    if (doorRef.current) {
      const out = smooth(s.door / 0.3)
      const slide = smooth((s.door - 0.2) / 0.8)
      doorRef.current.position.set(-slide * 0.93, out * 0.012, out * 0.17)
    }

    // lights: steady navigation and landing lights, a double strobe, a beating beacon
    s.light += ((w.lights ? 1 : 0) - s.light) * (1 - Math.exp(-dt * 9))
    const strobe = t % 1.4
    const level = { nav: 0.85, landing: 0.75, strobe: strobe < 0.05 || (strobe > 0.13 && strobe < 0.18) ? 1 : 0, beacon: Math.exp(-((t % 1.1) / 0.11)) }
    glowRefs.current.forEach((g, i) => g && (g.material.opacity = s.light * level[lamps[i].kind]))
    mat.lamp.emissiveIntensity = s.light * 2.2
  })

  const hot = (act) => ({
    onClick: (e) => {
      e.stopPropagation()
      act()
    },
    onPointerOver: (e) => {
      e.stopPropagation()
      setHover(true)
    },
    onPointerOut: () => setHover(false),
  })

  return (
    <group position={[-LENGTH / 2, 0, 0]}>
      {/* ================= fuselage ================= */}
      <mesh geometry={geo.fuselage} material={mat.skin} castShadow receiveShadow />
      <mesh geometry={geo.belly} material={mat.grey} castShadow receiveShadow />
      <mesh geometry={geo.fin} material={mat.fin} castShadow receiveShadow />
      {/* the exhaust of the auxiliary power unit in the tail cone */}
      <mesh position={[LENGTH + 0.002, CY + 1.05, 0]} rotation-y={Math.PI / 2} material={mat.dark}>
        <circleGeometry args={[0.165, 28]} />
      </mesh>
      <mesh position={[LENGTH - 0.02, CY + 1.05, 0]} rotation-z={Math.PI / 2} material={mat.steel}>
        <cylinderGeometry args={[0.172, 0.2, 0.06, 28, 1, true]} />
      </mesh>
      {/* aerials on the crown and the keel, and the two beacons */}
      {[[8.6, CY + 2.07, 1], [21.5, CY + 2.07, 1], [9.4, CY - 2.07, -1], [26.2, CY - 1.98, -1]].map(([x, y, d]) => (
        <mesh key={x} position={[x + 0.08, y + d * 0.14, 0]} rotation-z={d * -0.35} material={mat.body} castShadow>
          <boxGeometry args={[0.3, 0.34, 0.022]} />
        </mesh>
      ))}
      {[[15.4, CY + 2.07, 1], [17.4, 1.5, -1]].map(([x, y, d]) => (
        <mesh key={x} position={[x, y, 0]} scale={[1.6, d, 1]}>
          <sphereGeometry args={[0.07, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshPhysicalMaterial color="#d2241a" roughness={0.15} transmission={0.4} thickness={0.05} emissive="#ff1a0c" emissiveIntensity={0.25} />
        </mesh>
      ))}
      {/* pitot probes either side of the nose */}
      {[1, -1].map((side) => (
        <mesh key={side} position={[2.9, CY - 0.72, side * 1.76]} rotation-z={Math.PI / 2} material={mat.steel}>
          <cylinderGeometry args={[0.012, 0.016, 0.22, 8]} />
        </mesh>
      ))}

      {/* ================= the forward port door ================= */}
      <mesh geometry={geo.door.way} material={mat.way} />
      <mesh geometry={geo.door.outline} material={mat.line} />
      <group ref={doorRef} {...hot(() => setDoor(!door))}>
        <mesh geometry={geo.door.panel} material={mat.panel} castShadow />
        <mesh geometry={geo.door.glass} material={mat.doorGlass} />
        <mesh geometry={geo.door.seal} material={mat.doorSeal} />
        <mesh geometry={geo.door.handle} material={mat.doorLine} />
        <mesh geometry={geo.door.mark} material={mat.doorMark} />
      </group>
      {/* its starboard twin stays shut */}
      <group scale={[1, 1, -1]}>
        <mesh geometry={geo.door.outline} material={mat.line} />
        <mesh geometry={geo.door.glass} material={mat.glass} />
        <mesh geometry={geo.door.seal} material={mat.seal} />
        <mesh geometry={geo.door.handle} material={mat.line} />
        <mesh geometry={geo.door.mark} material={mat.mark} />
      </group>

      {/* ================= everything paired: port, and starboard through a mirror ================= */}
      {[1, -1].map((side) => (
        <group key={side} scale={[1, 1, side]}>
          {/* windows, door outlines and the flight-deck panes */}
          <mesh geometry={geo.decal.glass} material={mat.glass} />
          <mesh geometry={geo.decal.seals} material={mat.seal} />
          <mesh geometry={geo.decal.lines} material={mat.line} />
          <mesh geometry={geo.decal.marks} material={mat.mark} />
          <mesh geometry={geo.decal.deckSeal} material={mat.seal} />
          <mesh geometry={geo.decal.deck} material={mat.glass} />

          {/* wing, flaps and slats */}
          <mesh geometry={geo.wing} material={mat.wing} castShadow receiveShadow />
          {geo.flaps.map((f, i) => (
            <Hinged key={i} part={f} material={mat.wing} register={(g) => (flapRefs.current[`${side > 0 ? 'p' : 's'}${i}`] = g)} />
          ))}
          {geo.slats.map((f, i) => (
            <Hinged key={i} part={f} material={mat.wing} register={(g) => (slatRefs.current[`${side > 0 ? 'p' : 's'}${i}`] = g)} />
          ))}
          {/* flap track fairings under the wing */}
          {[6.4, 9.6, 12.6].map((z) => {
            const p = wingPoint(z, 0.78, true)
            const len = z < 7 ? 2.5 : 2.1
            return (
              <mesh key={z} position={[p.x + 0.1, p.y - 0.1, p.z]} scale={[len / 2, 0.19, 0.13]} rotation-z={-0.06} material={mat.grey} castShadow>
                <sphereGeometry args={[1, 28, 16]} />
              </mesh>
            )
          })}
          <mesh geometry={geo.stab} material={mat.grey} castShadow receiveShadow />

          {/* engine and pylon */}
          <group position={[ENGINE.s, ENGINE.y, ENGINE.z]} {...hot(() => setEngines(!engines))}>
            <mesh geometry={geo.engine.cowl} material={mat.body} castShadow receiveShadow />
            <mesh geometry={geo.engine.lip} material={mat.metal} castShadow />
            <mesh geometry={geo.engine.duct} material={mat.liner} />
            <mesh geometry={geo.engine.dark} material={mat.dark} />
            <mesh geometry={geo.engine.core} material={mat.core} castShadow />
            <mesh geometry={geo.engine.hot} material={mat.hot} />
            <mesh geometry={geo.engine.stator} material={mat.stator} />
            <group ref={(g) => (fanRefs.current[side] = g)}>
              <mesh geometry={geo.engine.blades} material={mat.blade} />
              <mesh geometry={geo.engine.spinner} material={mat.spinner} />
            </group>
            <mesh geometry={geo.pylon} material={mat.body} castShadow />
            {/* the strake on the inboard shoulder of the cowl */}
            <group rotation-x={0.95}>
              <mesh position={[1.45, 1.2, 0]} rotation-z={0.05} material={mat.body} castShadow>
                <boxGeometry args={[0.95, 0.2, 0.016]} />
              </mesh>
            </group>
          </group>

          {/* main gear: the leg folds inboard about its top */}
          <group position={[MAIN.s, MAIN.y, MAIN.z]} ref={(g) => (mainRefs.current[side] = g)} {...hot(() => setGear(!gear))}>
            <mesh position-y={-0.6} material={mat.strut} castShadow>
              <cylinderGeometry args={[0.125, 0.14, 1.4, 24]} />
            </mesh>
            <mesh position-y={-1.32} material={mat.steel}>
              <cylinderGeometry args={[0.15, 0.15, 0.08, 24]} />
            </mesh>
            <mesh position-y={-1.72} material={mat.chrome} castShadow>
              <cylinderGeometry args={[0.078, 0.078, 0.83, 20]} />
            </mesh>
            <mesh position-y={MAIN.R - MAIN.y} rotation-x={Math.PI / 2} material={mat.strut} castShadow>
              <cylinderGeometry args={[0.085, 0.085, 0.86, 20]} />
            </mesh>
            <mesh position-y={MAIN.R - MAIN.y} material={mat.strut}>
              <sphereGeometry args={[0.13, 20, 14]} />
            </mesh>
            {/* torque links behind the leg, the side stay up to the wing root, a brake line */}
            <Bar a={[0.13, -1.3, 0]} b={[0.42, -1.72, 0]} r={0.035} material={mat.strut} />
            <Bar a={[0.42, -1.72, 0]} b={[0.1, MAIN.R - MAIN.y + 0.06, 0]} r={0.035} material={mat.strut} />
            <Bar a={[0, -0.95, -0.1]} b={[0, -0.08, -1.45]} r={0.05} material={mat.strut} />
            <Bar a={[0, -0.5, -0.76]} b={[0.02, -0.02, -0.45]} r={0.03} material={mat.steel} />
            <Bar a={[-0.14, -0.2, 0.03]} b={[-0.12, -1.95, 0.05]} r={0.012} material={mat.dark} />
            {/* the door that rides on the leg and closes the bay under the wing */}
            <mesh position={[0, -0.86, 0.3]} rotation-x={-0.05} material={mat.grey} castShadow>
              <boxGeometry args={[0.86, 1.62, 0.028]} />
            </mesh>
            <Bar a={[0, -0.5, 0.12]} b={[0, -0.5, 0.29]} r={0.025} material={mat.strut} />
            <Bar a={[0, -1.1, 0.12]} b={[0, -1.1, 0.29]} r={0.025} material={mat.strut} />
            <group position-y={MAIN.R - MAIN.y}>
              <Wheel z={0.465} R={MAIN.R} W={MAIN.W} tyre={geo.mainTyre} mat={mat} />
              <Wheel z={-0.465} R={MAIN.R} W={MAIN.W} tyre={geo.mainTyre} mat={mat} />
            </group>
          </group>

          {/* nose gear doors: the aft pair hang open beside the leg */}
          <group position={[NOSE.s + 0.34, 1.75, 0.3]} ref={(g) => (noseDoorRefs.current[side] = g)}>
            <mesh position-y={-0.24} rotation-x={-0.1} material={mat.body} castShadow>
              <boxGeometry args={[0.92, 0.5, 0.02]} />
            </mesh>
          </group>
          {/* landing light under the wing root */}
          <mesh position={wingPoint(2.5, 0.03, true).add(new THREE.Vector3(-0.02, -0.03, 0))} rotation-z={Math.PI / 2} material={mat.lamp}>
            <cylinderGeometry args={[0.07, 0.07, 0.05, 20]} />
          </mesh>
        </group>
      ))}

      {/* ================= nose gear: folds forward into its bay ================= */}
      <group position={[NOSE.s, NOSE.y, 0]} ref={noseRef} {...hot(() => setGear(!gear))}>
        <mesh position-y={-0.42} material={mat.strut} castShadow>
          <cylinderGeometry args={[0.085, 0.095, 1.0, 20]} />
        </mesh>
        <mesh position-y={-0.93} material={mat.steel}>
          <cylinderGeometry args={[0.105, 0.105, 0.07, 20]} />
        </mesh>
        <mesh position-y={-1.22} material={mat.chrome} castShadow>
          <cylinderGeometry args={[0.052, 0.052, 0.6, 16]} />
        </mesh>
        <mesh position-y={NOSE.R - NOSE.y} rotation-x={Math.PI / 2} material={mat.strut}>
          <cylinderGeometry args={[0.055, 0.055, 0.5, 16]} />
        </mesh>
        <mesh position-y={NOSE.R - NOSE.y} material={mat.strut}>
          <sphereGeometry args={[0.085, 16, 12]} />
        </mesh>
        {/* torque links ahead of the leg, the drag strut forward into the bay */}
        <Bar a={[-0.09, -0.95, 0]} b={[-0.3, -1.2, 0]} r={0.022} material={mat.strut} />
        <Bar a={[-0.3, -1.2, 0]} b={[-0.07, NOSE.R - NOSE.y + 0.05, 0]} r={0.022} material={mat.strut} />
        <Bar a={[0, -0.55, 0]} b={[-0.78, -0.02, 0]} r={0.035} material={mat.strut} />
        {/* taxi and take-off lights on the leg */}
        {[1, -1].map((side) => (
          <mesh key={side} position={[-0.12, 1.22 - NOSE.y, side * 0.13]} rotation-z={Math.PI / 2} material={mat.lamp}>
            <cylinderGeometry args={[0.065, 0.05, 0.07, 18]} />
          </mesh>
        ))}
        <group position-y={NOSE.R - NOSE.y}>
          <Wheel z={0.25} R={NOSE.R} W={NOSE.W} tyre={geo.noseTyre} mat={mat} />
          <Wheel z={-0.25} R={NOSE.R} W={NOSE.W} tyre={geo.noseTyre} mat={mat} />
        </group>
      </group>

      {/* ================= lights ================= */}
      {lamps.map((l, i) => (
        <sprite key={i} position={l.p} scale={[l.size, l.size, 1]} ref={(g) => (glowRefs.current[i] = g)}>
          <spriteMaterial map={tex.glow} color={l.color} blending={THREE.AdditiveBlending} depthWrite={false} transparent opacity={0} />
        </sprite>
      ))}
    </group>
  )
}
