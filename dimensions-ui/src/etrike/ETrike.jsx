import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { RoundedBox, useCursor } from '@react-three/drei'
import * as THREE from 'three'
import { smooth } from '../airliner/geometry.js'
import { glowTexture } from '../airliner/textures.js'
import { WHEEL_R as SUV_R, WHEEL_W as SUV_W, barrelGeometry, spokeGeometry, tyreGeometry } from '../suv/geometry.js'
import { ARCH_R, B_PILLAR, CENTRE, FRONT_WHEEL, PORT, REAR_AXLE, SILL, TRACK, WHEEL_R, WINDOWS, bentTube, canopyFront, canopyGeometry, canopySide, dashGeometry, edgeGeometry, flareGeometry, mudguardGeometry, paneGeometry, sealGeometry, springGeometry, tubGeometry, tubNose, tubSide, tubTail, xA } from './geometry.js'
import { batteryLabel, canopyTexture, displayTexture, liveryMaterial, plateTexture, tubTexture } from './textures.js'

// An electric tuk-tuk (an auto rickshaw) at real size: 2.8 m long, 1.2 m
// wide, 1.7 m to the roof, of our own design. It is built from its own
// dimensions rather than loaded from a file (see geometry.js). This component
// centres it on the origin with the nose towards -x and the left side at +z.
//
// What moves: the wheels turn and the front one steers with the handlebar;
// the bench lifts on its hinge to show the battery modules under it; the
// charging flap opens, a plug goes in and the cluster counts the charge up;
// the lamps switch on.

const MAX_STEER = THREE.MathUtils.degToRad(32)
const RAKE = Math.atan2(0.29, 0.855) // the steering head leans back
const Z = new THREE.Vector3(0, 0, 1)
const UP = new THREE.Vector3(0, 1, 0)
// the SUV's wheel, scaled down to a 10 inch tuk-tuk wheel on a narrow tyre
const WS = WHEEL_R / SUV_R
const WZ = 0.125 / SUV_W

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
function Bar({ a, b, r = 0.02, material, seg = 12, box = false }) {
  const [pos, quat, len] = useMemo(() => {
    const A = new THREE.Vector3(...a)
    const d = new THREE.Vector3(...b).sub(A)
    return [A.clone().addScaledVector(d, 0.5), new THREE.Quaternion().setFromUnitVectors(UP, d.clone().normalize()), d.length()]
  }, [a, b])
  return (
    <mesh position={pos} quaternion={quat} material={material} castShadow>
      {box ? <boxGeometry args={[r * 2, len, r * 2]} /> : <cylinderGeometry args={[r, r, len, seg]} />}
    </mesh>
  )
}

// a part standing on the skin: its z axis along the surface normal
function OnSkin({ at, children, ...props }) {
  const q = useMemo(() => new THREE.Quaternion().setFromUnitVectors(Z, at.n), [at])
  return (
    <group position={at.p} quaternion={q} {...props}>
      {children}
    </group>
  )
}

// a pleated cushion: rolls of leather side by side across z
function Pleats({ size: [lx, ly, lz], n, mat, ...props }) {
  const w = lz / n
  return (
    <group {...props}>
      {Array.from({ length: n }, (_, i) => (
        <RoundedBox key={i} args={[lx, ly, w - 0.003]} radius={Math.min(lx, ly, w) * 0.45} smoothness={4} position-z={-lz / 2 + w * (i + 0.5)} material={mat} castShadow receiveShadow />
      ))}
    </group>
  )
}

function Wheel({ geo, mat, spin, flip = false }) {
  return (
    <group rotation-y={flip ? Math.PI : 0}>
      <group scale={[WS, WS, WZ]}>
        {/* the caliper does not turn with the wheel */}
        <mesh position={[-0.12, 0.1, -0.02]} rotation-z={0.9} material={mat.caliper}>
          <boxGeometry args={[0.07, 0.15, 0.1]} />
        </mesh>
        <group ref={spin}>
          <mesh geometry={geo.tyre} material={mat.tyre} castShadow receiveShadow />
          <mesh geometry={geo.barrel} material={mat.rimDark} />
          <mesh geometry={geo.spokes} material={[mat.rim, mat.rimDark]} castShadow />
          <mesh position-z={-0.02} rotation-x={Math.PI / 2} material={mat.disc}>
            <cylinderGeometry args={[0.185, 0.185, 0.024, 48]} />
          </mesh>
          <mesh position-z={0.085} rotation-x={Math.PI / 2} material={mat.chrome}>
            <cylinderGeometry args={[0.04, 0.046, 0.02, 32]} />
          </mesh>
          {Array.from({ length: 4 }, (_, k) => {
            const a = (k * Math.PI) / 2 + Math.PI / 4
            return (
              <mesh key={k} position={[Math.cos(a) * 0.07, Math.sin(a) * 0.07, 0.085]} rotation-x={Math.PI / 2} material={mat.chrome}>
                <cylinderGeometry args={[0.011, 0.011, 0.02, 6]} />
              </mesh>
            )
          })}
        </group>
      </group>
    </group>
  )
}

// paint, band, canopy: the body colour, the band along its top and round
// the windscreen, and the soft top. plate: the number plates. lights: lamps
// on. drive / speed: the wheels turn. steer: -1 left .. 1 right. charging:
// the flap open and the plug in. battery: the bench lifted off the battery.
// Click the body for the lights, the flap to charge, the bench to lift it,
// the handlebar to drive.
export default function ETrike({ paint = '#11727a', band = '#eef0ee', canopy = '#1b1d20', plate = 'RD 2026', lights: lightsProp = true, drive: driveProp = false, speed = 0.4, steer = 0, charging: chargingProp = false, battery: batteryProp = false, onChange }) {
  const [lights, setLights] = useTwoWay(lightsProp, 'lights', onChange)
  const [drive, setDrive] = useTwoWay(driveProp, 'drive', onChange)
  const [charging, setCharging] = useTwoWay(chargingProp, 'charging', onChange)
  const [battery, setBattery] = useTwoWay(batteryProp, 'battery', onChange)
  const [point, setPoint] = useState(false)
  useCursor(point, 'pointer')

  // ---- geometry: built once ----
  const geo = useMemo(
    () => ({
      tub: tubGeometry(),
      dash: dashGeometry(),
      canopy: canopyGeometry(),
      edge: edgeGeometry(),
      flare: flareGeometry(),
      mudguard: mudguardGeometry(),
      screen: paneGeometry(WINDOWS.screen),
      back: paneGeometry(WINDOWS.back),
      quarter: paneGeometry(WINDOWS.quarter),
      seals: { screen: sealGeometry(WINDOWS.screen), back: sealGeometry(WINDOWS.back), quarter: sealGeometry(WINDOWS.quarter) },
      tyre: tyreGeometry(),
      barrel: barrelGeometry(),
      spokes: spokeGeometry(),
      spring: springGeometry(0.032, 0.006, 0.26, 7),
      frontSpring: springGeometry(0.03, 0.005, 0.2, 6),
      bar: bentTube([[0.07, -0.02, -0.34], [0.03, 0.01, -0.26], [-0.01, 0.03, -0.12], [-0.01, 0.03, 0.12], [0.03, 0.01, 0.26], [0.07, -0.02, 0.34]], 0.0115, 80),
      rail: bentTube([[2.06, 0.98, -0.53], [2.12, 1.27, -0.5], [2.12, 1.29, 0], [2.12, 1.27, 0.5], [2.06, 0.98, 0.53]], 0.013, 80),
      hv: [
        bentTube([[1.38, 0.22, 0.13], [1.6, 0.22, 0.16], [1.95, 0.27, 0.16], [2.36, 0.36, 0.13]], 0.011, 60),
        bentTube([[1.38, 0.22, 0.09], [1.62, 0.21, 0.11], [1.95, 0.26, 0.11], [2.36, 0.36, 0.08]], 0.011, 60),
        bentTube([[2.36, 0.38, 0.06], [2.3, 0.36, -0.04], [2.2, 0.33, -0.1], [2.12, 0.33, -0.12]], 0.011, 40),
      ],
      seatHv: bentTube([[1.62, 0.5, -0.2], [1.62, 0.56, 0], [1.62, 0.5, 0.2]], 0.008, 30),
      cable: bentTube([[0.0, 0.0, 0.07], [0.0, -0.05, 0.14], [0.02, -0.3, 0.3], [0.1, -0.62, 0.42], [0.3, -0.73, 0.6], [0.8, -0.74, 0.9]], 0.011, 80),
      wiper: (() => {
        const pts = Array.from({ length: 8 }, (_, i) => canopyFront(0.06 - (0.36 * i) / 7, 1.06 + (0.38 * i) / 7, 0.014).toArray())
        return { arm: bentTube(pts, 0.005, 30), blade: bentTube(pts.slice(2), 0.0075, 30) }
      })(),
    }),
    [],
  )
  useEffect(
    () => () => {
      const drop = (o) => (o?.isBufferGeometry ? o.dispose() : o && typeof o === 'object' && Object.values(o).forEach(drop))
      drop(geo)
    },
    [geo],
  )

  // ---- textures and materials ----
  const tex = useMemo(() => ({ glow: glowTexture(), label: batteryLabel(), display: displayTexture() }), [])
  const plateTex = useMemo(() => plateTexture(plate || ' '), [plate])
  useEffect(() => () => Object.values(tex).forEach((t) => t.dispose()), [tex])
  useEffect(() => () => plateTex.dispose(), [plateTex])

  const mat = useMemo(() => {
    const tubTex = tubTexture()
    const canTex = canopyTexture()
    return {
      tub: liveryMaterial(tubTex, { rough: [0.28, 0.28, 0.8], coat: [1, 1, 0] }),
      tubLiner: new THREE.MeshStandardMaterial({ color: '#26292c', roughness: 0.85, side: THREE.BackSide, alphaMap: tubTex, alphaTest: 0.5 }),
      canopy: liveryMaterial(canTex, { rough: [0.9, 0.28, 0.85], coat: [0, 1, 0], sheen: [1, 0, 0.6] }),
      canLiner: new THREE.MeshStandardMaterial({ color: '#3b3d41', roughness: 0.95, side: THREE.BackSide, alphaMap: canTex, alphaTest: 0.5 }),
      paint: new THREE.MeshPhysicalMaterial({ roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.05 }),
      band: new THREE.MeshPhysicalMaterial({ roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.05 }),
      plastic: new THREE.MeshPhysicalMaterial({ color: '#141517', roughness: 0.62, clearcoat: 0.2, clearcoatRoughness: 0.5 }),
      gloss: new THREE.MeshPhysicalMaterial({ color: '#0a0b0c', roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.04 }),
      rubber: new THREE.MeshStandardMaterial({ color: '#0d0e0f', roughness: 0.92 }),
      mat: new THREE.MeshStandardMaterial({ color: '#131416', roughness: 0.97 }),
      leather: new THREE.MeshPhysicalMaterial({ color: '#1a1b1d', roughness: 0.5, sheen: 0.6, sheenRoughness: 0.5, sheenColor: new THREE.Color('#55595f'), clearcoat: 0.15, clearcoatRoughness: 0.4 }),
      chrome: new THREE.MeshStandardMaterial({ color: '#e6e8eb', metalness: 1, roughness: 0.1 }),
      steel: new THREE.MeshStandardMaterial({ color: '#1c1e21', metalness: 0.55, roughness: 0.5 }),
      alu: new THREE.MeshStandardMaterial({ color: '#a9aeb4', metalness: 1, roughness: 0.32 }),
      castAlu: new THREE.MeshStandardMaterial({ color: '#6d7278', metalness: 0.85, roughness: 0.55 }),
      tyre: new THREE.MeshStandardMaterial({ color: '#111213', roughness: 0.9 }),
      rim: new THREE.MeshPhysicalMaterial({ color: '#2a2d31', metalness: 0.6, roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.15 }),
      rimDark: new THREE.MeshStandardMaterial({ color: '#141518', metalness: 0.6, roughness: 0.45 }),
      disc: new THREE.MeshStandardMaterial({ color: '#8b8f95', metalness: 1, roughness: 0.32 }),
      caliper: new THREE.MeshStandardMaterial({ color: '#3b3f45', metalness: 0.6, roughness: 0.5 }),
      pack: new THREE.MeshStandardMaterial({ color: '#2b2f33', metalness: 0.5, roughness: 0.6 }),
      hv: new THREE.MeshPhysicalMaterial({ color: '#f0731c', roughness: 0.42, clearcoat: 0.4, clearcoatRoughness: 0.3 }),
      red: new THREE.MeshStandardMaterial({ color: '#c41d1d', roughness: 0.5 }),
      glass: new THREE.MeshPhysicalMaterial({ color: '#56636c', roughness: 0.03, transmission: 0.94, thickness: 0, ior: 1.5, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.25, side: THREE.DoubleSide }),
      vinyl: new THREE.MeshPhysicalMaterial({ color: '#6c747a', roughness: 0.1, transmission: 0.86, thickness: 0, ior: 1.45, envMapIntensity: 1.1, side: THREE.DoubleSide }),
      mirror: new THREE.MeshStandardMaterial({ color: '#aab4c0', metalness: 1, roughness: 0.03 }),
      lens: new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.05, transmission: 0.9, thickness: 0.02, ior: 1.5, clearcoat: 1 }),
      reflector: new THREE.MeshStandardMaterial({ color: '#cfd3d8', metalness: 1, roughness: 0.18 }),
      led: new THREE.MeshStandardMaterial({ color: '#f2f6ff', emissive: '#eaf2ff', emissiveIntensity: 0, roughness: 0.3, toneMapped: false }),
      drl: new THREE.MeshStandardMaterial({ color: '#f2f6ff', emissive: '#dfeaff', emissiveIntensity: 2.2, roughness: 0.3, toneMapped: false }),
      tail: new THREE.MeshPhysicalMaterial({ color: '#8f0d0d', roughness: 0.12, clearcoat: 1, emissive: '#ff1608', emissiveIntensity: 0.1 }),
      amber: new THREE.MeshPhysicalMaterial({ color: '#c46d0c', roughness: 0.12, clearcoat: 1, emissive: '#ff8a00', emissiveIntensity: 0 }),
      clear: new THREE.MeshPhysicalMaterial({ color: '#d9dde0', roughness: 0.12, clearcoat: 1 }),
      ring: new THREE.MeshStandardMaterial({ color: '#0d1a12', emissive: '#2bff7a', emissiveIntensity: 0, toneMapped: false }),
      screen: new THREE.MeshBasicMaterial({ map: tex.display, toneMapped: false }),
      label: new THREE.MeshStandardMaterial({ map: tex.label, roughness: 0.6 }),
    }
  }, [tex])
  useEffect(() => () => Object.values(mat).forEach((m) => m.dispose()), [mat])
  useEffect(() => {
    const t = mat.tub.userData.uniforms
    t.uA.value.set(paint)
    t.uB.value.set(band)
    t.uC.value.set('#17191b')
    const c = mat.canopy.userData.uniforms
    c.uA.value.set(canopy)
    c.uB.value.set(band)
    c.uC.value.set(canopy).lerp(new THREE.Color('#9a9da2'), 0.35)
    mat.paint.color.set(paint)
    mat.band.color.set(band)
  }, [mat, paint, band, canopy])

  // ---- where the parts on the skin go ----
  const at = useMemo(
    () => ({
      head: tubNose(0.265, 0.832),
      blink: tubNose(0.4, 0.832, -0.002),
      grille: tubNose(0, 0.665),
      tail: tubTail(0.47, 0.8),
      plate: tubTail(0, 0.5, 0.004),
      port: { p: tubSide(PORT.x - PORT.w / 2, PORT.y), n: new THREE.Vector3(0, 0.03, 1).normalize() },
      mirror: canopySide(xA(1.06) - 0.03, 1.06),
    }),
    [],
  )

  // ---- lights: where each lamp glows, and in what colour ----
  const lamps = useMemo(() => {
    const out = []
    for (const s of [1, -1]) {
      const h = at.head.p
      out.push({ p: [h.x - 0.03, h.y, s * h.z], color: '#fff6e4', size: 0.24, kind: 'head' })
      const t = at.tail.p
      out.push({ p: [t.x + 0.03, t.y + 0.02, s * t.z], color: '#ff2414', size: 0.18, kind: 'tail' })
    }
    return out
  }, [at])

  // ---- motion ----
  const spin = useRef([])
  const steerRef = useRef()
  const lid = useRef()
  const flap = useRef()
  const plug = useRef()
  const glowRefs = useRef([])
  const live = useRef({})
  live.current = { drive: drive && !charging, speed, steer, lights, charging, battery }
  const st = useRef({ v: 0, steer, light: lightsProp ? 1 : 0, lid: batteryProp ? 1 : 0, flap: chargingProp ? 1 : 0, soc: 78, clock: 0, shown: '' })

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30)
    const w = live.current
    const s = st.current
    const t = state.clock.elapsedTime
    s.v += ((w.drive ? 1.5 + w.speed * 12 : 0) - s.v) * (1 - Math.exp(-dt * 1.2))
    s.steer += THREE.MathUtils.clamp(w.steer - s.steer, -dt * 1.6, dt * 1.6)
    s.light += ((w.lights ? 1 : 0) - s.light) * (1 - Math.exp(-dt * 9))
    s.lid += ((w.battery ? 1 : 0) - s.lid) * (1 - Math.exp(-dt * 4))
    s.flap += ((w.charging ? 1 : 0) - s.flap) * (1 - Math.exp(-dt * 5))
    spin.current.forEach((g, i) => g && (g.rotation.z += ((i === 2 ? -1 : 1) * s.v * dt) / WHEEL_R))
    if (steerRef.current) steerRef.current.rotation.y = -s.steer * MAX_STEER
    if (lid.current) lid.current.rotation.z = -smooth(s.lid) * 1.15
    if (flap.current) flap.current.rotation.y = -smooth(s.flap) * 1.85
    if (plug.current) {
      const k = smooth((s.flap - 0.55) / 0.45)
      plug.current.visible = k > 0.01
      plug.current.position.z = (1 - k) * 0.25
    }

    // lamps: head and tail with the lights, the charge ring breathing while it charges
    glowRefs.current.forEach((g, i) => g && (g.material.opacity = s.light * (lamps[i].kind === 'head' ? 0.55 : 0.45)))
    mat.led.emissiveIntensity = s.light * 3.2
    mat.tail.emissiveIntensity = 0.1 + s.light * 1.6
    mat.ring.emissiveIntensity = w.charging ? 1.2 + Math.sin(t * 3) * 0.9 : 0
    mat.screen.color.setScalar(0.85 + 0.15 * s.light)

    // the cluster: speed, charge (up while charging, down slowly while driving)
    if (w.charging) s.soc = Math.min(100, s.soc + dt * 1.2)
    else if (s.v > 0.5) s.soc = Math.max(5, s.soc - dt * 0.05)
    s.clock += dt
    if (s.clock > 0.2) {
      s.clock = 0
      const v = { speed: s.v * 3.6, battery: s.soc, charging: w.charging, lights: w.lights, gear: w.drive ? 'D' : 'P' }
      const key = `${Math.round(v.speed)}|${Math.round(v.battery)}|${v.charging}|${v.lights}|${v.gear}`
      if (key !== s.shown) {
        s.shown = key
        tex.display.userData.draw(v)
      }
    }
  })

  const hot = (act) => ({
    onClick: (e) => {
      e.stopPropagation()
      if (e.delta > 4) return // that was a drag of the camera
      act()
    },
    onPointerOver: (e) => {
      e.stopPropagation()
      setPoint(true)
    },
    onPointerOut: () => setPoint(false),
  })
  const toggleCharge = () => {
    if (!charging && drive) setDrive(false)
    setCharging(!charging)
  }

  const hub = [REAR_AXLE, WHEEL_R]

  return (
    <group position-x={-CENTRE}>
      {/* ================= the two skins, and everything paired: left, and right through a mirror ================= */}
      {[1, -1].map((side) => (
        <group key={side} scale={[1, 1, side]}>
          <group {...hot(() => setLights(!lights))}>
            <mesh geometry={geo.tub} material={mat.tub} castShadow receiveShadow />
            <mesh geometry={geo.tub} material={mat.tubLiner} />
            <mesh geometry={geo.dash} material={mat.band} receiveShadow />
            <mesh geometry={geo.canopy} material={mat.canopy} castShadow receiveShadow />
            <mesh geometry={geo.canopy} material={mat.canLiner} />
          </group>
          <mesh geometry={geo.edge.tub} material={mat.rubber} />
          <mesh geometry={geo.edge.canopy} material={mat.rubber} />
          <mesh geometry={geo.edge.hem} material={mat.rubber} />
          <mesh geometry={geo.quarter} material={mat.vinyl} />
          <mesh geometry={geo.seals.quarter} material={mat.rubber} />

          {/* the rear wheel arch: its flare, and the dark well behind the wheel */}
          <mesh geometry={geo.flare} position={[hub[0], hub[1], tubSide(hub[0], 0.5).z - 0.004]} material={mat.plastic} castShadow />
          <group position={[hub[0], hub[1], 0.44]}>
            <mesh rotation-x={Math.PI / 2} material={mat.rubber}>
              <cylinderGeometry args={[ARCH_R + 0.012, ARCH_R + 0.012, 0.32, 40, 1, true, Math.PI / 2 - 0.3, Math.PI + 0.6]} />
            </mesh>
            <mesh position-z={-0.15} material={mat.rubber}>
              <circleGeometry args={[ARCH_R + 0.012, 40, -0.3, Math.PI + 0.6]} />
            </mesh>
          </group>

          {/* LED headlamp: a smoked housing, a chrome reflector, the projector and its light bar */}
          <OnSkin at={at.head}>
            <RoundedBox args={[0.175, 0.088, 0.04]} radius={0.016} smoothness={4} position-z={0.004} material={mat.gloss} castShadow />
            <RoundedBox args={[0.16, 0.074, 0.02]} radius={0.012} smoothness={4} position-z={0.016} material={mat.reflector} />
            <mesh position={[0.035, -0.006, 0.024]} material={mat.led}>
              <sphereGeometry args={[0.022, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
            </mesh>
            <mesh position={[0.035, -0.006, 0.026]} rotation-x={Math.PI / 2} material={mat.gloss}>
              <torusGeometry args={[0.026, 0.004, 8, 32]} />
            </mesh>
            <RoundedBox args={[0.12, 0.009, 0.006]} radius={0.003} smoothness={2} position={[-0.012, 0.026, 0.027]} material={mat.drl} />
            <RoundedBox args={[0.009, 0.045, 0.006]} radius={0.003} smoothness={2} position={[-0.068, 0.007, 0.027]} material={mat.drl} />
            <RoundedBox args={[0.172, 0.085, 0.012]} radius={0.012} smoothness={4} position-z={0.03} material={mat.lens} />
          </OnSkin>
          {/* the indicator round the corner from it */}
          <OnSkin at={at.blink}>
            <RoundedBox args={[0.06, 0.04, 0.02]} radius={0.008} smoothness={3} material={mat.amber} />
          </OnSkin>

          {/* the tail lamp: indicator over stop and tail over reverse, in one tall lens */}
          <OnSkin at={at.tail}>
            <RoundedBox args={[0.08, 0.2, 0.03]} radius={0.012} smoothness={4} position-z={0.004} material={mat.gloss} castShadow />
            <RoundedBox args={[0.068, 0.11, 0.012]} radius={0.008} smoothness={3} position={[0, 0.02, 0.018]} material={mat.tail} />
            <RoundedBox args={[0.068, 0.034, 0.012]} radius={0.008} smoothness={3} position={[0, 0.078, 0.018]} material={mat.amber} />
            <RoundedBox args={[0.068, 0.036, 0.012]} radius={0.008} smoothness={3} position={[0, -0.062, 0.018]} material={mat.clear} />
          </OnSkin>

          {/* door mirror on the windscreen pillar */}
          <group position={[at.mirror.x, at.mirror.y, at.mirror.z]}>
            <Bar a={[0, 0, -0.01]} b={[-0.02, 0.1, 0.1]} r={0.008} material={mat.plastic} />
            <Bar a={[-0.02, 0.1, 0.1]} b={[-0.03, 0.17, 0.13]} r={0.008} material={mat.plastic} />
            <mesh position={[-0.03, 0.22, 0.145]} rotation-y={0.25} scale={[0.022, 0.045, 0.065]} material={mat.gloss} castShadow>
              <sphereGeometry args={[1, 28, 18]} />
            </mesh>
            <mesh position={[-0.002, 0.22, 0.152]} rotation-y={Math.PI / 2 + 0.25} scale={[0.057, 0.037, 1]} material={mat.mirror}>
              <circleGeometry args={[1, 32]} />
            </mesh>
          </group>

          {/* the B pillar behind the driver, and the hand rail on it */}
          <Bar a={[B_PILLAR, SILL - 0.04, 0.566]} b={[B_PILLAR, 1.6, 0.566]} r={0.017} material={mat.plastic} box />
          <Bar a={[B_PILLAR + 0.06, 1.1, 0.52]} b={[B_PILLAR + 0.06, 1.45, 0.52]} r={0.011} material={mat.chrome} />
          <Bar a={[B_PILLAR + 0.02, 1.1, 0.548]} b={[B_PILLAR + 0.06, 1.1, 0.52]} r={0.009} material={mat.chrome} />
          <Bar a={[B_PILLAR + 0.02, 1.45, 0.548]} b={[B_PILLAR + 0.06, 1.45, 0.52]} r={0.009} material={mat.chrome} />

          {/* ---- underneath ---- */}
          <RoundedBox args={[2.05, 0.06, 0.05]} radius={0.01} smoothness={2} position={[1.6, 0.235, 0.32]} material={mat.steel} castShadow />
          {/* the trailing arm the rear axle hangs on, and the spring and damper over it */}
          <RoundedBox args={[0.56, 0.05, 0.045]} radius={0.01} smoothness={2} position={[1.86, 0.24, 0.39]} rotation-z={0.02} material={mat.steel} castShadow />
          <group position={[2.16, 0.27, 0.37]} rotation-z={-0.35}>
            <mesh geometry={geo.spring} material={mat.red} castShadow />
            <mesh position-y={0.13} material={mat.chrome}>
              <cylinderGeometry args={[0.014, 0.014, 0.3, 12]} />
            </mesh>
            <mesh position-y={0.06} material={mat.steel}>
              <cylinderGeometry args={[0.022, 0.022, 0.14, 16]} />
            </mesh>
          </group>
          <mesh position={[hub[0], hub[1], 0.33]} rotation-x={Math.PI / 2} material={mat.castAlu} castShadow>
            <cylinderGeometry args={[0.038, 0.045, 0.24, 20]} />
          </mesh>

          {/* the charging flap; only the left one opens, onto the socket */}
          <OnSkin at={at.port} {...(side > 0 ? hot(toggleCharge) : {})}>
            <group ref={side > 0 ? flap : undefined}>
              <RoundedBox args={[PORT.w - 0.006, PORT.h - 0.006, 0.006]} radius={0.003} smoothness={2} position={[PORT.w / 2, 0, 0.002]} material={mat.paint} castShadow />
            </group>
            <mesh position={[PORT.w / 2, 0, -0.022]} material={mat.rubber}>
              <boxGeometry args={[PORT.w + 0.01, PORT.h + 0.01, 0.04]} />
            </mesh>
            {side > 0 && (
              <group position={[PORT.w / 2, 0.004, 0]}>
                <mesh position-z={-0.008} rotation-x={Math.PI / 2} material={mat.plastic}>
                  <cylinderGeometry args={[0.034, 0.034, 0.012, 40]} />
                </mesh>
                {[[0, 0.016], [-0.014, 0.004], [0.014, 0.004], [-0.009, -0.013], [0.009, -0.013], [0, -0.002], [0, -0.02]].map(([x, y], i) => (
                  <mesh key={i} position={[x, y, -0.0015]} rotation-x={Math.PI / 2} material={mat.rubber}>
                    <cylinderGeometry args={[0.0045, 0.0045, 0.002, 12]} />
                  </mesh>
                ))}
                <mesh position-z={-0.002} material={mat.ring}>
                  <torusGeometry args={[0.04, 0.003, 8, 48]} />
                </mesh>
                {/* the plug and its cable, while charging */}
                <group ref={plug} visible={false}>
                  <mesh position-z={0.03} rotation-x={Math.PI / 2} material={mat.plastic}>
                    <cylinderGeometry args={[0.036, 0.036, 0.05, 32]} />
                  </mesh>
                  <RoundedBox args={[0.05, 0.13, 0.05]} radius={0.018} smoothness={4} position={[0, -0.04, 0.07]} rotation-x={-0.5} material={mat.gloss} castShadow />
                  <mesh geometry={geo.cable} position={[0, -0.04, 0.03]} material={mat.rubber} castShadow />
                </group>
              </group>
            )}
          </OnSkin>
        </group>
      ))}

      {/* ================= glass ================= */}
      <mesh geometry={geo.screen} material={mat.glass} />
      <mesh geometry={geo.seals.screen} material={mat.rubber} />
      <mesh geometry={geo.back} material={mat.vinyl} />
      <mesh geometry={geo.seals.back} material={mat.rubber} />
      <mesh geometry={geo.wiper.arm} material={mat.gloss} />
      <mesh geometry={geo.wiper.blade} material={mat.rubber} />

      {/* ================= the face: grille and badge ================= */}
      <OnSkin at={at.grille}>
        <RoundedBox args={[0.3, 0.12, 0.03]} radius={0.02} smoothness={4} material={mat.gloss} castShadow />
        {[-0.03, 0, 0.03].map((y) => (
          <RoundedBox key={y} args={[0.27, 0.012, 0.012]} radius={0.005} smoothness={2} position={[0, y, 0.016]} material={mat.plastic} />
        ))}
        <RoundedBox args={[0.07, 0.04, 0.012]} radius={0.01} smoothness={3} position={[0, 0.002, 0.024]} material={mat.chrome} />
        <mesh position={[0, 0.002, 0.031]} rotation-z={Math.PI} material={mat.gloss}>
          <circleGeometry args={[0.013, 3]} />
        </mesh>
      </OnSkin>

      {/* ================= the rear: bumper, plate ================= */}
      <RoundedBox args={[0.08, 0.09, 1.16]} radius={0.025} smoothness={4} position={[2.82, 0.37, 0]} material={mat.plastic} castShadow />
      {[0.5, -0.5].map((z) => (
        <mesh key={z} position={[2.862, 0.37, z]} rotation-y={Math.PI / 2} material={mat.tail}>
          <circleGeometry args={[0.02, 24]} />
        </mesh>
      ))}
      <mesh position={at.plate.p} rotation-y={Math.PI / 2}>
        <planeGeometry args={[0.3, 0.094]} />
        <meshStandardMaterial map={plateTex} roughness={0.4} />
      </mesh>
      <RoundedBox args={[0.03, 0.02, 0.1]} radius={0.008} smoothness={2} position={[at.plate.p.x + 0.012, 0.565, 0]} material={mat.gloss} />

      {/* ================= the cab ================= */}
      {/* the back of the dashboard, the floor mat */}
      <RoundedBox args={[0.05, 0.46, 1.06]} radius={0.02} smoothness={3} position={[0.6, 0.77, 0]} material={mat.plastic} />
      <RoundedBox args={[0.012, 0.12, 0.3]} radius={0.004} smoothness={2} position={[0.627, 0.88, 0.28]} material={mat.gloss} />
      <mesh position={[1.08, 0.286, 0]} material={mat.mat} receiveShadow>
        <boxGeometry args={[0.86, 0.012, 1.08]} />
      </mesh>
      {/* the driver's seat on its box */}
      <RoundedBox args={[0.28, 0.33, 0.44]} radius={0.02} smoothness={3} position={[0.97, 0.45, 0]} material={mat.plastic} castShadow />
      <Pleats size={[0.32, 0.09, 0.46]} n={4} mat={mat.leather} position={[0.96, 0.66, 0]} />
      <Pleats size={[0.075, 0.36, 0.44]} n={4} mat={mat.leather} position={[1.1, 0.9, 0]} rotation-z={-0.14} />
      {/* the bar across behind the driver */}
      <Bar a={[B_PILLAR, 1.13, -0.56]} b={[B_PILLAR, 1.13, 0.56]} r={0.016} material={mat.chrome} />
      <Bar a={[B_PILLAR, 0.72, -0.56]} b={[B_PILLAR, 0.72, 0.56]} r={0.014} material={mat.plastic} />

      {/* the passengers' bench: a hollow box with the battery in it, and the lid it sits on */}
      <group>
        <RoundedBox args={[0.025, 0.36, 1.1]} radius={0.01} smoothness={2} position={[1.515, 0.46, 0]} material={mat.plastic} castShadow />
        <RoundedBox args={[0.025, 0.36, 1.1]} radius={0.01} smoothness={2} position={[2.0, 0.46, 0]} material={mat.plastic} />
        {[0.54, -0.54].map((z) => (
          <RoundedBox key={z} args={[0.27, 0.36, 0.02]} radius={0.008} smoothness={2} position={[1.645, 0.46, z]} material={mat.plastic} />
        ))}
        <mesh position={[1.757, 0.3, 0]} material={mat.mat}>
          <boxGeometry args={[0.48, 0.01, 1.06]} />
        </mesh>
        {/* four modules, their terminals and the links between them */}
        {[-0.39, -0.13, 0.13, 0.39].map((z, i) => (
          <group key={z} position={[1.65, 0.43, z]}>
            <RoundedBox args={[0.22, 0.24, 0.24]} radius={0.012} smoothness={2} material={mat.pack} castShadow />
            <mesh position-y={0.1205} rotation={[-Math.PI / 2, 0, Math.PI / 2]} material={mat.label}>
              <planeGeometry args={[0.2, 0.1]} />
            </mesh>
            <mesh position={[-0.08, 0.135, -0.07]} material={i % 2 ? mat.rubber : mat.red}>
              <cylinderGeometry args={[0.016, 0.016, 0.03, 16]} />
            </mesh>
            <mesh position={[-0.08, 0.135, 0.07]} material={i % 2 ? mat.red : mat.rubber}>
              <cylinderGeometry args={[0.016, 0.016, 0.03, 16]} />
            </mesh>
          </group>
        ))}
        <mesh geometry={geo.seatHv} position={[-0.0, 0.07, 0]} material={mat.hv} />
        <mesh geometry={geo.seatHv} position={[-0.0, 0.07, 0.26]} scale={[1, 1, 0.6]} material={mat.hv} />
        <mesh geometry={geo.seatHv} position={[-0.0, 0.07, -0.26]} scale={[1, 1, 0.6]} material={mat.hv} />
        {/* hinged at the back, so it tips up against the backrest */}
        <group position={[2.02, 0.645, 0]} ref={lid} {...hot(() => setBattery(!battery))}>
          <RoundedBox args={[0.52, 0.025, 1.1]} radius={0.01} smoothness={2} position={[-0.26, 0, 0]} material={mat.plastic} castShadow />
          <Pleats size={[0.5, 0.1, 1.08]} n={7} mat={mat.leather} position={[-0.26, 0.06, 0]} />
        </group>
        {/* the backrest and the rail round it */}
        <Pleats size={[0.08, 0.46, 1.08]} n={7} mat={mat.leather} position={[2.08, 1.0, 0]} rotation-z={-0.2} />
        <mesh geometry={geo.rail} material={mat.chrome} castShadow />
        {/* the shelf behind it, over the motor */}
        <mesh position={[2.45, 0.93, 0]} material={mat.mat} receiveShadow>
          <boxGeometry args={[0.66, 0.02, 1.12]} />
        </mesh>
      </group>

      {/* ================= underneath: frame, battery pack, motor, wiring ================= */}
      {[0.7, 1.45, 2.55].map((x) => (
        <RoundedBox key={x} args={[0.05, 0.05, 0.62]} radius={0.01} smoothness={2} position={[x, 0.235, 0]} material={mat.steel} />
      ))}
      <group position={[1.07, 0.2, 0]}>
        <RoundedBox args={[0.66, 0.12, 0.54]} radius={0.02} smoothness={3} material={mat.pack} castShadow />
        {Array.from({ length: 7 }, (_, i) => (
          <mesh key={i} position={[-0.27 + i * 0.09, -0.064, 0]} material={mat.pack}>
            <boxGeometry args={[0.02, 0.012, 0.5]} />
          </mesh>
        ))}
        <mesh position={[0.18, -0.061, 0.16]} rotation-x={Math.PI / 2} material={mat.label}>
          <planeGeometry args={[0.2, 0.1]} />
        </mesh>
      </group>
      {/* the motor beside the differential, and the controller behind */}
      <group position={[hub[0], hub[1], 0]}>
        <mesh position-z={-0.13} rotation-x={Math.PI / 2} material={mat.alu} castShadow>
          <cylinderGeometry args={[0.1, 0.1, 0.2, 40]} />
        </mesh>
        {[-0.2, -0.16, -0.12, -0.08].map((z) => (
          <mesh key={z} position-z={z} material={mat.castAlu}>
            <torusGeometry args={[0.1, 0.007, 8, 40]} />
          </mesh>
        ))}
        <mesh position-z={-0.235} rotation-x={Math.PI / 2} material={mat.castAlu}>
          <cylinderGeometry args={[0.07, 0.09, 0.03, 32]} />
        </mesh>
        <mesh position-z={0.03} scale={[1, 1, 0.9]} material={mat.castAlu} castShadow>
          <sphereGeometry args={[0.11, 32, 20]} />
        </mesh>
      </group>
      <group position={[2.42, 0.37, 0.07]}>
        <RoundedBox args={[0.18, 0.06, 0.16]} radius={0.01} smoothness={2} material={mat.alu} castShadow />
        {Array.from({ length: 6 }, (_, i) => (
          <mesh key={i} position={[-0.075 + i * 0.03, -0.04, 0]} material={mat.castAlu}>
            <boxGeometry args={[0.008, 0.025, 0.15]} />
          </mesh>
        ))}
      </group>
      {geo.hv.map((g, i) => (
        <mesh key={i} geometry={g} material={mat.hv} castShadow />
      ))}

      {/* ================= the rear wheels ================= */}
      {[1, -1].map((s, i) => (
        <group key={s} position={[hub[0], hub[1], s * TRACK]}>
          <Wheel geo={geo} mat={mat} spin={(g) => (spin.current[i + 1] = g)} flip={s < 0} />
        </group>
      ))}

      {/* ================= the front: fork, wheel, mudguard and the handlebar, all turning together ================= */}
      <group position={[FRONT_WHEEL.x, FRONT_WHEEL.r, 0]} rotation-z={-RAKE}>
        <group ref={steerRef}>
          <group rotation-z={RAKE}>
            <Wheel geo={geo} mat={mat} spin={(g) => (spin.current[0] = g)} />
          </group>
          <mesh geometry={geo.mudguard} rotation-z={RAKE} castShadow>
            <meshPhysicalMaterial attach="material" color="#121315" roughness={0.45} clearcoat={0.6} side={THREE.DoubleSide} />
          </mesh>
          {[1, -1].map((s) => (
            <group key={s}>
              <Bar a={[0, -0.03, s * 0.088]} b={[0, 0.22, s * 0.088]} r={0.024} material={mat.castAlu} />
              <Bar a={[0, 0.22, s * 0.088]} b={[0, 0.62, s * 0.088]} r={0.018} material={mat.chrome} />
              <Bar a={[0.0, 0.2, s * 0.088]} b={[0.12, 0.25, s * 0.088]} r={0.008} material={mat.steel} />
            </group>
          ))}
          <mesh position={[-0.05, 0.32, 0]} geometry={geo.frontSpring} material={mat.red} />
          <mesh position-y={0.58} material={mat.steel}>
            <boxGeometry args={[0.06, 0.04, 0.22]} />
          </mesh>
          <mesh position-y={0.76} material={mat.steel}>
            <cylinderGeometry args={[0.022, 0.022, 0.32, 16]} />
          </mesh>
          {/* the handlebar, level, with the cluster on it */}
          <group position-y={0.9} rotation-z={RAKE} {...hot(() => setDrive(!drive))}>
            <mesh geometry={geo.bar} material={mat.chrome} castShadow />
            {[1, -1].map((s) => (
              <group key={s}>
                <mesh position={[0.07, -0.02, s * 0.29]} rotation-x={Math.PI / 2} material={mat.rubber} castShadow>
                  <cylinderGeometry args={[0.018, 0.018, 0.11, 20]} />
                </mesh>
                <RoundedBox args={[0.04, 0.03, 0.045]} radius={0.008} smoothness={2} position={[0.06, -0.012, s * 0.215]} material={mat.plastic} />
                <Bar a={[0.04, -0.005, s * 0.22]} b={[-0.02, -0.01, s * 0.33]} r={0.006} material={mat.castAlu} />
              </group>
            ))}
            <group position-y={0.08} rotation-z={0.3}>
              <RoundedBox args={[0.06, 0.13, 0.22]} radius={0.02} smoothness={4} material={mat.plastic} castShadow />
              <mesh position-x={0.0305} rotation-y={Math.PI / 2} material={mat.screen}>
                <planeGeometry args={[0.17, 0.106]} />
              </mesh>
            </group>
          </group>
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
