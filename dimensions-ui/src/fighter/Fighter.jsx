import { forwardRef, useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { RoundedBox, useCursor } from '@react-three/drei'
import * as THREE from 'three'
import { glowTexture } from '../airliner/textures.js'
import { AAM, BAY, BOOM, CAN, GEAR, LENGTH, MAIN_WELL, NOSE_WELL, WING, bladeGeometry, bodyCapGeometry, bodyGeometry, boomGeometry, canopyGeometry, doorGeometry, finGeometry, finPoint, missileGeometry, nacelleGeometry, nozzleGeometry, smooth, stabGeometry, tyreGeometry, wingGeometry, wingPoint } from './geometry.js'
import { bodyTexture, canopyTexture, finTexture, heatTexture, maskTexture, nacelleTexture, plumeTexture, stabTexture, wingTexture } from './textures.js'

// A twin-engine stealth fighter at real size (18.9 m long, 13.6 m across the
// diamond wing), built from its own dimensions rather than loaded from a
// file, on the airliner's mesh helpers and the helicopter's hulls. The frame
// has x running aft from the nose, y up from the ground and +z to port; this
// component centres the aircraft on the origin with the nose towards -x.
//
// What moves: the canopy lifts on its rear hinge; the weapon bay doors swing
// down to show the missiles on their rails; the gear folds forward into its
// wells behind closing doors while the leading-edge flaps and flaperons come
// up out of the landing setting; the engines light their afterburners; the
// lights flash.

const CENTRE = 9.4 // the station that sits over the origin
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
function Bar({ a, b, r = 0.02, material, seg = 12 }) {
  const [pos, quat, len] = useMemo(() => {
    const A = new THREE.Vector3(...a)
    const d = new THREE.Vector3(...b).sub(A)
    return [A.clone().addScaledVector(d, 0.5), new THREE.Quaternion().setFromUnitVectors(UP, d.clone().normalize()), d.length()]
  }, [a, b])
  return (
    <mesh position={pos} quaternion={quat} material={material} castShadow>
      <cylinderGeometry args={[r, r, len, seg]} />
    </mesh>
  )
}

// a hinged part: the geometry is expressed about its hinge, so it turns with rotation-z of the inner group (the ref)
const Hinged = forwardRef(function Hinged({ part, material }, ref) {
  return (
    <group position={part.position} quaternion={part.quaternion}>
      <group ref={ref}>
        <mesh geometry={part.geometry} material={material} castShadow receiveShadow />
      </group>
    </group>
  )
})

// a wheel on its axle: tyre, hub, brake
function Wheel({ R, W, tyre, mat }) {
  return (
    <group>
      <mesh geometry={tyre} material={mat.tyre} castShadow />
      <mesh rotation-x={Math.PI / 2} material={mat.hub}>
        <cylinderGeometry args={[R * 0.56, R * 0.56, W * 0.7, 32]} />
      </mesh>
      <mesh rotation-x={Math.PI / 2} material={mat.steel}>
        <cylinderGeometry args={[R * 0.44, R * 0.44, W * 0.74, 32]} />
      </mesh>
      {Array.from({ length: 8 }, (_, i) => (
        <mesh key={i} position={[Math.cos((i / 8) * Math.PI * 2) * R * 0.33, Math.sin((i / 8) * Math.PI * 2) * R * 0.33, W * 0.37]} rotation-x={Math.PI / 2} material={mat.dark}>
          <cylinderGeometry args={[R * 0.03, R * 0.03, 0.02, 8]} />
        </mesh>
      ))}
    </group>
  )
}

// an air-to-air missile on its rail, nose forward
function Missile({ position, geo, mat }) {
  return (
    <group position={position}>
      <mesh geometry={geo.body} material={mat.missile} castShadow />
      <mesh position-x={0.12} rotation-z={Math.PI / 2} material={mat.seeker}>
        <sphereGeometry args={[AAM.r * 0.62, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      {[0, 1, 2, 3].map((k) => (
        <group key={k} rotation-x={(k / 4) * Math.PI * 2 + Math.PI / 4}>
          <mesh geometry={geo.midFin} position-x={1.55} material={mat.missileFin} castShadow />
          <mesh geometry={geo.tailFin} position-x={AAM.len - 0.46} material={mat.missileFin} castShadow />
        </group>
      ))}
      {/* the band that marks the warhead section and the rail lugs */}
      <mesh position-x={1.2} rotation-z={Math.PI / 2} material={mat.missileFin}>
        <cylinderGeometry args={[AAM.r + 0.003, AAM.r + 0.003, 0.05, 24]} />
      </mesh>
      {[0.9, 2.1].map((x) => (
        <mesh key={x} position={[x, AAM.r + 0.03, 0]} material={mat.steel}>
          <boxGeometry args={[0.08, 0.06, 0.04]} />
        </mesh>
      ))}
    </group>
  )
}

// What shows through the glass: the tub, the seat, the panel under its glare
// shield with the head-up display on top, the side consoles with the stick
// and the throttles.
function Cockpit({ mat }) {
  return (
    <group>
      <mesh position={[5.35, 2.44, 0]} material={mat.trim}>
        <boxGeometry args={[3.2, 0.04, 1.7]} />
      </mesh>
      <mesh position={[6.9, 2.7, 0]} material={mat.trim}>
        <boxGeometry args={[0.05, 0.56, 1.1]} />
      </mesh>
      <mesh position={[4.0, 2.64, 0]} material={mat.trim}>
        <boxGeometry args={[0.05, 0.44, 0.9]} />
      </mesh>
      {/* instrument panel and glare shield */}
      <group position={[4.42, 2.82, 0]} rotation-z={0.3}>
        <RoundedBox args={[0.14, 0.46, 0.92]} radius={0.03} smoothness={3} material={mat.panel} />
        <mesh position={[0.072, 0.1, 0]} rotation-y={Math.PI / 2} material={mat.screen}>
          <planeGeometry args={[0.5, 0.22]} />
        </mesh>
        {[-0.3, 0.3].map((z) => (
          <mesh key={z} position={[0.072, -0.1, z]} rotation-y={Math.PI / 2} material={mat.screen}>
            <planeGeometry args={[0.24, 0.16]} />
          </mesh>
        ))}
      </group>
      <RoundedBox args={[0.6, 0.035, 1.0]} radius={0.012} smoothness={2} position={[4.3, 3.05, 0]} rotation-z={0.12} material={mat.panel} />
      {/* the head-up display: combiner glass on its stalk */}
      <mesh position={[4.52, 3.22, 0]} rotation-z={0.22} material={mat.hud}>
        <planeGeometry args={[0.22, 0.26]} />
      </mesh>
      <mesh position={[4.52, 3.07, 0]} material={mat.panel}>
        <boxGeometry args={[0.1, 0.06, 0.26]} />
      </mesh>
      {/* side consoles, the side-stick on the right, the throttles on the left */}
      {[1, -1].map((side) => (
        <group key={side}>
          <mesh position={[5.3, 2.64, side * 0.46]} material={mat.panel}>
            <boxGeometry args={[1.7, 0.3, 0.26]} />
          </mesh>
          <mesh position={[5.3, 2.795, side * 0.46]} material={mat.screen}>
            <boxGeometry args={[1.2, 0.004, 0.16]} />
          </mesh>
        </group>
      ))}
      <Bar a={[5.1, 2.8, -0.46]} b={[5.02, 2.98, -0.44]} r={0.02} material={mat.dark} />
      <mesh position={[5.0, 3.0, -0.44]} material={mat.dark}>
        <boxGeometry args={[0.1, 0.07, 0.05]} />
      </mesh>
      <Bar a={[4.95, 2.8, 0.46]} b={[4.85, 2.96, 0.46]} r={0.016} material={mat.dark} />
      <mesh position={[4.84, 2.98, 0.46]} material={mat.dark}>
        <boxGeometry args={[0.12, 0.05, 0.1]} />
      </mesh>
      {/* the ejection seat: pan, back, headrest, the rails behind it */}
      <RoundedBox args={[0.5, 0.1, 0.52]} radius={0.03} smoothness={3} position={[5.6, 2.56, 0]} material={mat.cushion} castShadow />
      <RoundedBox args={[0.12, 0.72, 0.52]} radius={0.03} smoothness={3} position={[5.94, 2.9, 0]} rotation-z={-0.28} material={mat.cushion} castShadow />
      <RoundedBox args={[0.14, 0.22, 0.3]} radius={0.03} smoothness={2} position={[6.08, 3.3, 0]} rotation-z={-0.28} material={mat.seat} castShadow />
      <mesh position={[6.08, 2.88, 0]} rotation-z={-0.28} material={mat.seat}>
        <boxGeometry args={[0.1, 0.9, 0.6]} />
      </mesh>
      {[-0.2, 0.2].map((z) => (
        <Bar key={z} a={[6.18, 2.5, z]} b={[6.4, 3.32, z]} r={0.02} material={mat.steel} />
      ))}
      <mesh position={[5.58, 2.64, 0]} material={mat.belt}>
        <boxGeometry args={[0.3, 0.02, 0.06]} />
      </mesh>
    </group>
  )
}

// paint, accent: the two greys. tailCode, serial: the lettering on the fins.
// canopy: open. bays: weapon bay doors open. gear: down. engines: afterburners
// lit. lights: navigation lights, strobes and beacons. Click the canopy, the
// belly, a wheel or a nozzle to work them.
export default function Fighter({ paint = '#8b9197', accent = '#5e656c', tailCode = 'RD', serial = 'AF 26-001', canopy: canopyProp = false, bays: baysProp = false, gear: gearProp = true, engines: enginesProp = false, lights = true, onChange }) {
  const [canopy, setCanopy] = useTwoWay(canopyProp, 'canopy', onChange)
  const [bays, setBays] = useTwoWay(baysProp, 'bays', onChange)
  const [gear, setGear] = useTwoWay(gearProp, 'gear', onChange)
  const [engines, setEngines] = useTwoWay(enginesProp, 'engines', onChange)
  const [point, setPoint] = useState(false)
  useCursor(point, 'pointer')

  // ---- geometry: built once ----
  const geo = useMemo(
    () => ({
      body: bodyGeometry(),
      cap: bodyCapGeometry(),
      nac: nacelleGeometry(),
      boom: boomGeometry(),
      canopy: canopyGeometry(),
      wing: wingGeometry(),
      finP: finGeometry(1),
      finS: finGeometry(-1),
      stab: stabGeometry(),
      noz: nozzleGeometry(),
      aam: missileGeometry(),
      mainTyre: tyreGeometry(GEAR.main.R, GEAR.main.W, GEAR.main.R * 0.55),
      noseTyre: tyreGeometry(GEAR.nose.R, GEAR.nose.W, GEAR.nose.R * 0.55),
      bayDoor: doorGeometry(BAY.s1 - BAY.s0, (BAY.z1 - BAY.z0) / 2),
      mainDoor: doorGeometry(MAIN_WELL.s1 - MAIN_WELL.s0, MAIN_WELL.z1 - MAIN_WELL.z0),
      noseDoor: doorGeometry(NOSE_WELL.s1 - NOSE_WELL.s0, NOSE_WELL.z),
      aerial: bladeGeometry(0.22, 0.16, 0.12, 0.012),
    }),
    [],
  )
  useEffect(
    () => () => {
      const drop = (o) => (o.isBufferGeometry ? o.dispose() : o && typeof o === 'object' && Object.values(o).forEach(drop))
      drop(geo)
    },
    [geo],
  )

  // ---- paint ----
  const colors = useMemo(() => ({ paint, accent }), [paint, accent])
  const skinTex = useMemo(() => bodyTexture(colors), [colors])
  const nacTex = useMemo(() => nacelleTexture(colors), [colors])
  const wingTex = useMemo(() => wingTexture(colors), [colors])
  const stabTex = useMemo(() => stabTexture(colors), [colors])
  const finTexP = useMemo(() => finTexture({ ...colors, tailCode, serial }, 1), [colors, tailCode, serial])
  const finTexS = useMemo(() => finTexture({ ...colors, tailCode, serial }, -1), [colors, tailCode, serial])
  const tex = useMemo(() => ({ mask: maskTexture(), canopy: canopyTexture(), heat: heatTexture(), plume: plumeTexture(), glow: glowTexture() }), [])
  useEffect(() => () => Object.values(skinTex).forEach((x) => x.dispose()), [skinTex])
  useEffect(() => () => Object.values(nacTex).forEach((x) => x.dispose()), [nacTex])
  useEffect(() => () => Object.values(wingTex).forEach((x) => x.dispose()), [wingTex])
  useEffect(() => () => Object.values(stabTex).forEach((x) => x.dispose()), [stabTex])
  useEffect(() => () => Object.values(finTexP).forEach((x) => x.dispose()), [finTexP])
  useEffect(() => () => Object.values(finTexS).forEach((x) => x.dispose()), [finTexS])
  useEffect(() => () => Object.values(tex).forEach((t) => t.dispose()), [tex])

  const mat = useMemo(() => {
    // a satin radar-absorbent coat with a little metal in it
    const coat = { roughness: 0.5, metalness: 0.36, clearcoat: 0.22, clearcoatRoughness: 0.4, envMapIntensity: 0.9, bumpScale: 0.006 }
    const layer = (n) => ({ polygonOffset: true, polygonOffsetFactor: -2 * n, polygonOffsetUnits: -2 * n })
    return {
      skin: new THREE.MeshPhysicalMaterial({ ...coat, alphaMap: tex.mask, alphaTest: 0.5 }),
      liner: new THREE.MeshStandardMaterial({ color: '#2d3034', roughness: 0.9, side: THREE.BackSide, alphaMap: tex.mask, alphaTest: 0.5 }),
      nac: new THREE.MeshPhysicalMaterial(coat),
      wing: new THREE.MeshPhysicalMaterial(coat),
      stab: new THREE.MeshPhysicalMaterial(coat),
      finP: new THREE.MeshPhysicalMaterial(coat),
      finS: new THREE.MeshPhysicalMaterial(coat),
      plain: new THREE.MeshPhysicalMaterial({ ...coat, color: paint }),
      dark: new THREE.MeshStandardMaterial({ color: '#15171a', roughness: 0.8, metalness: 0.2 }),
      duct: new THREE.MeshStandardMaterial({ color: '#1c1e22', roughness: 0.85, metalness: 0.25 }),
      // the canopy carries a gold coating: a warm mirror at a glance, clear glass looked through
      glass: new THREE.MeshPhysicalMaterial({ color: '#c9ab62', map: tex.canopy, roughness: 0.04, metalness: 0.12, transmission: 0.7, thickness: 0.02, ior: 1.5, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.5 }),
      petals: new THREE.MeshStandardMaterial({ map: tex.heat, metalness: 0.85, roughness: 0.42, flatShading: true }),
      hot: new THREE.MeshStandardMaterial({ color: '#3b3734', roughness: 0.7, metalness: 0.6, emissive: '#ff7a2a', emissiveIntensity: 0 }),
      bulk: new THREE.MeshStandardMaterial({ color: '#34373c', roughness: 0.6, metalness: 0.65 }),
      holder: new THREE.MeshStandardMaterial({ color: '#4f4a46', roughness: 0.55, metalness: 0.8, emissive: '#ff4a08', emissiveIntensity: 0 }),
      plume: new THREE.MeshBasicMaterial({ map: tex.plume, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }),
      well: new THREE.MeshStandardMaterial({ color: '#d5d6d2', roughness: 0.85, side: THREE.BackSide }),
      strut: new THREE.MeshPhysicalMaterial({ color: '#e3e4e0', roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.2 }),
      chrome: new THREE.MeshStandardMaterial({ color: '#e4e7ea', metalness: 1, roughness: 0.1 }),
      steel: new THREE.MeshStandardMaterial({ color: '#7c8087', metalness: 0.95, roughness: 0.36 }),
      tyre: new THREE.MeshStandardMaterial({ color: '#141516', roughness: 0.92 }),
      hub: new THREE.MeshStandardMaterial({ color: '#43464b', metalness: 0.7, roughness: 0.45 }),
      missile: new THREE.MeshStandardMaterial({ color: '#dcdcd6', roughness: 0.5, metalness: 0.2 }),
      missileFin: new THREE.MeshStandardMaterial({ color: '#8a8d90', roughness: 0.5, metalness: 0.5 }),
      seeker: new THREE.MeshPhysicalMaterial({ color: '#3a3f46', roughness: 0.1, clearcoat: 1 }),
      trim: new THREE.MeshStandardMaterial({ color: '#2a2c30', roughness: 0.9, side: THREE.DoubleSide }),
      panel: new THREE.MeshStandardMaterial({ color: '#131417', roughness: 0.6 }),
      screen: new THREE.MeshStandardMaterial({ color: '#0b1014', roughness: 0.25, emissive: '#2f8a6a', emissiveIntensity: 0.6 }),
      hud: new THREE.MeshPhysicalMaterial({ color: '#8fd0a8', roughness: 0.05, transmission: 0.85, thickness: 0.01, side: THREE.DoubleSide }),
      seat: new THREE.MeshStandardMaterial({ color: '#2b2e33', roughness: 0.7 }),
      cushion: new THREE.MeshStandardMaterial({ color: '#4d5a3f', roughness: 0.85 }),
      belt: new THREE.MeshStandardMaterial({ color: '#6d6a5a', roughness: 0.9 }),
      lamp: new THREE.MeshStandardMaterial({ color: '#f4f6f8', emissive: '#fff4d6', emissiveIntensity: 0, roughness: 0.2 }),
      lens: new THREE.MeshPhysicalMaterial({ color: '#d2241a', roughness: 0.15, transmission: 0.4, thickness: 0.05, emissive: '#ff1a0c', emissiveIntensity: 0.25 }),
      line: new THREE.MeshStandardMaterial({ color: '#2a2d31', roughness: 0.6, ...layer(1) }),
    }
  }, [tex]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => Object.values(mat).forEach((m) => m.dispose()), [mat])
  useEffect(() => {
    const put = (m, t) => {
      m.map = t.map
      m.bumpMap = t.bump
      m.needsUpdate = true
    }
    put(mat.skin, skinTex)
    put(mat.nac, nacTex)
    put(mat.wing, wingTex)
    put(mat.stab, stabTex)
    put(mat.finP, finTexP)
    put(mat.finS, finTexS)
    mat.plain.color.set(paint)
  }, [mat, skinTex, nacTex, wingTex, stabTex, finTexP, finTexS, paint])

  // ---- lights: where each lamp is, its colour, and how it behaves ----
  const lamps = useMemo(() => {
    const out = []
    for (const side of [1, -1]) {
      const tip = wingPoint(side * (WING.zTip - 0.08), 0.05)
      tip.z = Math.abs(tip.z) * side
      out.push({ p: [tip.x, tip.y, tip.z], color: side > 0 ? '#ff2a1c' : '#18e06a', size: 0.4, kind: 'nav' })
      const fin = finPoint(2.1, 0.45, side)
      out.push({ p: [fin.x, fin.y + 0.05, fin.z], color: '#ffffff', size: 0.5, kind: 'strobe' })
    }
    out.push({ p: [LENGTH + 0.05, 2.38, 0], color: '#ffffff', size: 0.34, kind: 'nav' })
    out.push({ p: [8.95, 3.4, 0], color: '#ff2414', size: 0.8, kind: 'beacon' })
    out.push({ p: [13.2, 1.16, 0], color: '#ff2414', size: 0.8, kind: 'beacon' })
    return out
  }, [])

  // ---- motion ----
  const canopyRef = useRef()
  const innerDoors = useRef([])
  const outerDoors = useRef([])
  const noseLeg = useRef()
  const mainLegs = useRef([])
  const noseDoors = useRef([])
  const mainDoors = useRef([])
  const leFlaps = useRef([])
  const flaperons = useRef([])
  const stabs = useRef([])
  const plumes = useRef([])
  const glowRefs = useRef([])
  const live = useRef({})
  live.current = { canopy, bays, gear, engines, lights }
  const st = useRef({ canopy: canopyProp ? 1 : 0, bays: baysProp ? 1 : 0, gear: gearProp ? 0 : 1, rpm: enginesProp ? 1 : 0, light: lights ? 1 : 0 })

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30)
    const w = live.current
    const s = st.current
    const t = state.clock.elapsedTime

    // the canopy lifts on its rear hinge
    s.canopy += THREE.MathUtils.clamp((w.canopy ? 1 : 0) - s.canopy, -dt / 2.2, dt / 2.2)
    if (canopyRef.current) canopyRef.current.rotation.z = -0.62 * smooth(s.canopy)

    // the bay doors swing down and out
    s.bays += THREE.MathUtils.clamp((w.bays ? 1 : 0) - s.bays, -dt / 1.6, dt / 1.6)
    const open = 1.5 * smooth(s.bays)
    for (const d of innerDoors.current) if (d) d.rotation.x = open
    for (const d of outerDoors.current) if (d) d.rotation.x = -open

    // gear: 0 down .. 1 up; the legs fold forward, then the doors close over them
    s.gear += THREE.MathUtils.clamp((w.gear ? 0 : 1) - s.gear, -dt / 4, dt / 4)
    const fold = smooth(Math.min(1, s.gear / 0.8)) * (-Math.PI / 2)
    const shut = smooth((s.gear - 0.72) / 0.28)
    if (noseLeg.current) {
      noseLeg.current.rotation.z = fold
      noseLeg.current.visible = s.gear < 0.995
    }
    for (const g of mainLegs.current)
      if (g) {
        g.rotation.z = fold
        g.visible = s.gear < 0.995
      }
    noseDoors.current.forEach((d, i) => d && (d.rotation.x = (i ? -1 : 1) * 1.35 * (1 - shut)))
    for (const d of mainDoors.current) if (d) d.rotation.x = -1.5 * (1 - shut)
    // the landing setting of the wing comes out as the gear comes up, and the stabilators trim
    const landing = 1 - smooth(s.gear)
    for (const f of leFlaps.current) if (f) f.rotation.z = 0.2 * landing
    for (const f of flaperons.current) if (f) f.rotation.z = -0.3 * landing
    for (const f of stabs.current) if (f) f.rotation.z = 0.09 * landing

    // the afterburners light with a flicker in the plume
    s.rpm += ((w.engines ? 1 : 0) - s.rpm) * (1 - Math.exp(-dt * 1.8))
    const burn = smooth(s.rpm)
    mat.plume.opacity = burn * (0.38 + 0.06 * Math.sin(t * 37) + 0.04 * Math.sin(t * 61 + 1))
    mat.hot.emissiveIntensity = burn * 0.55
    mat.holder.emissiveIntensity = burn * (2.2 + 0.5 * Math.sin(t * 29))
    for (const p of plumes.current)
      if (p) {
        p.visible = burn > 0.01
        p.scale.set(0.75 + 0.3 * burn + 0.03 * Math.sin(t * 23), 1, 1)
      }

    // lights: steady navigation lights, a double strobe, beating beacons
    s.light += ((w.lights ? 1 : 0) - s.light) * (1 - Math.exp(-dt * 9))
    const strobe = t % 1.3
    const level = { nav: 0.85, strobe: strobe < 0.05 || (strobe > 0.13 && strobe < 0.18) ? 1 : 0, beacon: Math.exp(-((t % 1.0) / 0.1)) }
    glowRefs.current.forEach((g, i) => g && (g.material.opacity = s.light * level[lamps[i].kind]))
    mat.lamp.emissiveIntensity = s.light * 2
    mat.lens.emissiveIntensity = 0.25 + s.light * level.beacon * 3
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

  const bayZ = (BAY.z0 + BAY.z1) / 2
  const bayW = (BAY.z1 - BAY.z0) / 2
  const bayS = (BAY.s0 + BAY.s1) / 2
  const wellS = (MAIN_WELL.s0 + MAIN_WELL.s1) / 2
  const noseS = (NOSE_WELL.s0 + NOSE_WELL.s1) / 2
  const noseY = 1.33 - (noseS - 4) * 0.06 // the keel slopes here

  return (
    <group position={[-CENTRE, 0, 0]}>
      {/* ================= fuselage, canopy, cockpit ================= */}
      <group {...hot(() => setBays(!bays))}>
        <mesh geometry={geo.body} material={mat.skin} castShadow receiveShadow />
        <mesh geometry={geo.body} material={mat.liner} />
        <mesh geometry={geo.cap} material={mat.bulk} />
      </group>
      <Cockpit mat={mat} />
      <group position={[CAN.pivot, 2.95, 0]} ref={canopyRef} {...hot(() => setCanopy(!canopy))}>
        <mesh geometry={geo.canopy} material={mat.glass} position={[-CAN.pivot, -2.95, 0]} castShadow />
        {/* the canopy's rear frame and the actuator under it */}
        <mesh position={[-0.12, 0.1, 0]} material={mat.dark}>
          <boxGeometry args={[0.1, 0.2, 0.44]} />
        </mesh>
      </group>
      <Bar a={[CAN.pivot - 0.6, 2.5, 0]} b={[CAN.pivot - 0.15, 3.0, 0]} r={0.02} material={mat.chrome} />
      {/* the bay and the wheel wells: boxes seen from inside */}
      <mesh position={[noseS, 1.33 + 0.28, 0]} material={mat.well}>
        <boxGeometry args={[NOSE_WELL.s1 - NOSE_WELL.s0, 0.6, NOSE_WELL.z * 2]} />
      </mesh>
      {/* aerials along the spine and under the nose, the pitot */}
      <mesh geometry={geo.aerial} position={[10.6, 3.35, 0]} material={mat.plain} castShadow />
      <mesh geometry={geo.aerial} position={[2.3, 1.56, 0]} scale={[1, -0.7, 1]} material={mat.plain} castShadow />
      <Bar a={[0.02, 2.3, 0]} b={[-0.55, 2.3, 0]} r={0.012} material={mat.steel} />
      {/* beacons on the spine and the belly */}
      {[[8.95, 3.37, 1], [13.2, 1.2, -1]].map(([x, y, d]) => (
        <mesh key={x} position={[x, y, 0]} scale={[1.5, d, 1]} material={mat.lens}>
          <sphereGeometry args={[0.05, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </mesh>
      ))}

      {/* ================= nose gear: folds forward into its well ================= */}
      <group position={[5.3, 1.3, 0]} ref={noseLeg} {...hot(() => setGear(!gear))}>
        <Bar a={[0, 0.05, 0]} b={[GEAR.nose.s - 5.3, GEAR.nose.R - 1.3 + 0.35, 0]} r={0.055} material={mat.strut} />
        <Bar a={[GEAR.nose.s - 5.3 + 0.01, GEAR.nose.R - 1.3 + 0.4, 0]} b={[GEAR.nose.s - 5.3 - 0.02, GEAR.nose.R - 1.3, 0]} r={0.036} material={mat.chrome} />
        <Bar a={[0.35, 0.05, 0]} b={[GEAR.nose.s - 5.3 + 0.08, GEAR.nose.R - 1.3 + 0.55, 0]} r={0.03} material={mat.strut} />
        <Bar a={[GEAR.nose.s - 5.3 - 0.1, GEAR.nose.R - 1.3 + 0.58, 0]} b={[GEAR.nose.s - 5.3 + 0.06, GEAR.nose.R - 1.3 + 0.3, 0]} r={0.022} material={mat.steel} />
        <mesh position={[GEAR.nose.s - 5.3 - 0.06, GEAR.nose.R - 1.3 + 0.62, 0]} rotation-z={0.3} material={mat.lamp}>
          <cylinderGeometry args={[0.06, 0.05, 0.05, 20]} />
        </mesh>
        <group position={[GEAR.nose.s - 5.3, GEAR.nose.R - 1.3, 0]}>
          <mesh rotation-x={Math.PI / 2} material={mat.steel}>
            <cylinderGeometry args={[0.03, 0.03, GEAR.nose.W * 2.4, 12]} />
          </mesh>
          <Wheel R={GEAR.nose.R} W={GEAR.nose.W} tyre={geo.noseTyre} mat={mat} />
        </group>
      </group>
      {/* its doors hang open either side */}
      {[1, -1].map((side, i) => (
        <group key={side} position={[noseS, noseY, side * NOSE_WELL.z]} rotation-z={0.06} ref={(g) => (noseDoors.current[i] = g)}>
          <mesh geometry={geo.noseDoor} position-z={-side * (NOSE_WELL.z / 2)} material={mat.plain} castShadow />
          <mesh position={[0, 0.018, -side * (NOSE_WELL.z / 2)]} material={mat.strut}>
            <boxGeometry args={[NOSE_WELL.s1 - NOSE_WELL.s0 - 0.06, 0.004, NOSE_WELL.z - 0.05]} />
          </mesh>
        </group>
      ))}

      {/* ================= the fins, each its own ================= */}
      <mesh geometry={geo.finP.fin} material={mat.finP} castShadow receiveShadow />
      <Hinged part={geo.finP.rudder} material={mat.finP} />
      <mesh geometry={geo.finS.fin} material={mat.finS} castShadow receiveShadow />
      <Hinged part={geo.finS.rudder} material={mat.finS} />

      {/* ================= everything paired: port, and starboard through a mirror ================= */}
      {[1, -1].map((side, si) => (
        <group key={side} scale={[1, 1, side]}>
          <mesh geometry={geo.nac.skin} material={mat.nac} castShadow receiveShadow />
          <mesh geometry={geo.nac.duct} material={mat.duct} />
          <mesh geometry={geo.boom} material={mat.plain} castShadow receiveShadow />

          {/* wing: box, leading-edge flap, flaperon, aileron */}
          <mesh geometry={geo.wing.box} material={mat.wing} castShadow receiveShadow />
          <Hinged part={geo.wing.leFlap} material={mat.wing} ref={(g) => (leFlaps.current[si] = g)} />
          <Hinged part={geo.wing.flaperon} material={mat.wing} ref={(g) => (flaperons.current[si] = g)} />
          <Hinged part={geo.wing.aileron} material={mat.wing} />
          <Hinged part={geo.stab} material={mat.stab} ref={(g) => (stabs.current[si] = g)} />
          {/* the navigation lamp in the tip */}
          <mesh position={wingPoint(WING.zTip - 0.08, 0.05).toArray()} scale={[2, 1, 1]} material={mat.lamp}>
            <sphereGeometry args={[0.025, 12, 10]} />
          </mesh>

          {/* the nozzle: petals, duct, flame holder, and the plume behind it */}
          <group {...hot(() => setEngines(!engines))}>
            <mesh geometry={geo.noz.petals} material={mat.petals} castShadow />
            <mesh geometry={geo.noz.liner} material={mat.hot} />
            <mesh geometry={geo.noz.holder} material={mat.holder} />
          </group>
          <mesh geometry={geo.noz.plume} material={mat.plume} ref={(m) => (plumes.current[si] = m)} visible={false} />

          {/* the weapon bay: its white box, the rails, three missiles, two doors */}
          <mesh position={[bayS, 1.2 + BAY.depth / 2, bayZ]} material={mat.well}>
            <boxGeometry args={[BAY.s1 - BAY.s0, BAY.depth, BAY.z1 - BAY.z0]} />
          </mesh>
          <group {...hot(() => setBays(!bays))}>
            {[0.3, 0.56, 0.82].map((z, k) => (
              <group key={z}>
                <mesh position={[bayS - 0.3, 1.2 + BAY.depth - 0.06, z]} material={mat.dark}>
                  <boxGeometry args={[3.3, 0.1, 0.09]} />
                </mesh>
                <Missile position={[BAY.s0 + 0.2 + k * 0.08, 1.2 + BAY.depth - 0.13 - AAM.r - 0.03, z]} geo={geo.aam} mat={mat} />
              </group>
            ))}
            <group position={[bayS, 1.2, BAY.z0]} ref={(g) => (innerDoors.current[si] = g)}>
              <mesh geometry={geo.bayDoor} position-z={bayW / 2} material={mat.plain} castShadow />
              <mesh position={[0, 0.018, bayW / 2]} material={mat.strut}>
                <boxGeometry args={[BAY.s1 - BAY.s0 - 0.08, 0.004, bayW - 0.06]} />
              </mesh>
            </group>
            <group position={[bayS, 1.2, BAY.z1]} ref={(g) => (outerDoors.current[si] = g)}>
              <mesh geometry={geo.bayDoor} position-z={-bayW / 2} material={mat.plain} castShadow />
              <mesh position={[0, 0.018, -bayW / 2]} material={mat.strut}>
                <boxGeometry args={[BAY.s1 - BAY.s0 - 0.08, 0.004, bayW - 0.06]} />
              </mesh>
            </group>
          </group>

          {/* main gear: the leg folds forward about its top */}
          <mesh position={[wellS, 1.2 + 0.3, GEAR.main.z]} material={mat.well}>
            <boxGeometry args={[MAIN_WELL.s1 - MAIN_WELL.s0, 0.64, MAIN_WELL.z1 - MAIN_WELL.z0]} />
          </mesh>
          <group position={[11.2, 1.28, GEAR.main.z]} ref={(g) => (mainLegs.current[si] = g)} {...hot(() => setGear(!gear))}>
            <Bar a={[0, 0.05, 0]} b={[GEAR.main.s - 11.2 + 0.08, GEAR.main.R - 1.28 + 0.4, 0]} r={0.085} material={mat.strut} />
            <Bar a={[GEAR.main.s - 11.2 + 0.09, GEAR.main.R - 1.28 + 0.42, 0]} b={[GEAR.main.s - 11.2, GEAR.main.R - 1.28, 0]} r={0.055} material={mat.chrome} />
            <mesh position={[GEAR.main.s - 11.2 + 0.08, GEAR.main.R - 1.28 + 0.42, 0]} material={mat.steel}>
              <cylinderGeometry args={[0.1, 0.1, 0.06, 20]} />
            </mesh>
            {/* side brace into the well wall, torque links, the brake line */}
            <Bar a={[-0.2, 0.0, -0.05]} b={[GEAR.main.s - 11.2 + 0.1, GEAR.main.R - 1.28 + 0.55, -0.02]} r={0.04} material={mat.strut} />
            <Bar a={[GEAR.main.s - 11.2 + 0.22, GEAR.main.R - 1.28 + 0.62, 0]} b={[GEAR.main.s - 11.2 + 0.3, GEAR.main.R - 1.28 + 0.3, 0]} r={0.028} material={mat.steel} />
            <Bar a={[GEAR.main.s - 11.2 + 0.3, GEAR.main.R - 1.28 + 0.3, 0]} b={[GEAR.main.s - 11.2 + 0.1, GEAR.main.R - 1.28 + 0.06, 0]} r={0.028} material={mat.steel} />
            <Bar a={[-0.05, 0, 0.09]} b={[GEAR.main.s - 11.2 - 0.03, GEAR.main.R - 1.28 + 0.05, 0.08]} r={0.012} material={mat.dark} />
            <group position={[GEAR.main.s - 11.2, GEAR.main.R - 1.28, 0]}>
              <mesh rotation-x={Math.PI / 2} material={mat.steel}>
                <cylinderGeometry args={[0.04, 0.04, GEAR.main.W * 1.6, 12]} />
              </mesh>
              <group position-z={-GEAR.main.W * 0.2}>
                <Wheel R={GEAR.main.R} W={GEAR.main.W} tyre={geo.mainTyre} mat={mat} />
              </group>
            </group>
          </group>
          <group position={[wellS, 1.2, MAIN_WELL.z1]} rotation-x={-0.17} ref={(g) => (mainDoors.current[si] = g)}>
            <mesh geometry={geo.mainDoor} position-z={-(MAIN_WELL.z1 - MAIN_WELL.z0) / 2} material={mat.plain} castShadow />
            <mesh position={[0, 0.018, -(MAIN_WELL.z1 - MAIN_WELL.z0) / 2]} material={mat.strut}>
              <boxGeometry args={[MAIN_WELL.s1 - MAIN_WELL.s0 - 0.06, 0.004, MAIN_WELL.z1 - MAIN_WELL.z0 - 0.05]} />
            </mesh>
          </group>
          {/* the stabilator boom's lamp */}
          <mesh position={[BOOM.s0 + BOOM.len - 0.05, 2.22, BOOM.z]} material={mat.lamp}>
            <sphereGeometry args={[0.03, 12, 10]} />
          </mesh>
          {/* the strobe on the fin */}
          <mesh position={finPoint(2.1, 0.45, 1).toArray()} material={mat.lamp}>
            <sphereGeometry args={[0.03, 12, 10]} />
          </mesh>
        </group>
      ))}

      {/* ================= lights ================= */}
      {lamps.map((l, i) => (
        <sprite key={i} position={l.p} scale={[l.size, l.size, 1]} ref={(g) => (glowRefs.current[i] = g)}>
          <spriteMaterial map={tex.glow} color={l.color} blending={THREE.AdditiveBlending} depthWrite={false} transparent opacity={0} />
        </sprite>
      ))}
    </group>
  )
}
