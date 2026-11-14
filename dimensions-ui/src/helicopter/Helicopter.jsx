import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { RoundedBox, useCursor } from '@react-three/drei'
import * as THREE from 'three'
import { smooth } from '../airliner/geometry.js'
import { glowTexture } from '../airliner/textures.js'
import { BLADE_ROOT, CROSS, FAN, MAST, ROTOR_R, SKID_Z, STAB, bladeGeometry, body, bodyGeometry, bulkheadGeometry, cowl, cowlGeometry, decalGeometry, fanGeometry, finGeometry, finPoint, shroudGeometry, skidGeometry, stabGeometry } from './geometry.js'
import { bladeTexture, bodyTexture, discTexture, maskTexture, tailTexture } from './textures.js'

// A twin-engine light helicopter at real size (11 m rotor, 11.5 m nose to
// fin), built from its own dimensions rather than loaded from a file, on the
// airliner's mesh helpers. The frame has x running aft from the nose, y up
// from the ground and +z to port; this component centres the aircraft on the
// origin with the nose towards -x.
//
// What moves: the engines spool the main rotor and the tail fan up until the
// blades are a blur, and the blades, which droop at rest, cone upward as they
// take the weight; in the hover the aircraft lifts off its skids and rides
// the air; the lights flash.

const CENTRE = 4.75 // the station that sits over the origin
const HOVER = 1.7 // skid height in the hover
const OMEGA = 40 // rotor speed at full power, radians a second
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

// a seat facing forward: cushion, back, headrest, on a pedestal down to the floor
function Seat({ position, width = 0.46, mat }) {
  return (
    <group position={position}>
      <RoundedBox args={[0.46, 0.1, width]} radius={0.035} smoothness={3} material={mat.seat} castShadow />
      <RoundedBox args={[0.1, 0.62, width]} radius={0.035} smoothness={3} position={[0.26, 0.33, 0]} rotation-z={-0.17} material={mat.seat} castShadow />
      <RoundedBox args={[0.08, 0.2, 0.26]} radius={0.03} smoothness={3} position={[0.33, 0.75, 0]} rotation-z={-0.17} material={mat.seat} />
      <mesh position={[0.04, -0.13, 0]} material={mat.panel}>
        <boxGeometry args={[0.3, 0.17, width * 0.6]} />
      </mesh>
    </group>
  )
}

// What shows through the glass: the floor and the headliner, the wall behind
// the cabin, the instrument panel under its glare shield, the sticks, and the
// seats (two crew, then two rows of three).
function Cabin({ geo, mat }) {
  return (
    <group>
      <mesh position={[2.8, 0.8, 0]} material={mat.trim} receiveShadow>
        <boxGeometry args={[3.4, 0.03, 1.36]} />
      </mesh>
      <mesh position={[1.1, 0.72, 0]} material={mat.trim}>
        <boxGeometry args={[0.03, 0.16, 1.0]} />
      </mesh>
      <mesh position={[3.175, 1.85, 0]} material={mat.trim}>
        <boxGeometry args={[3.15, 0.02, 1.36]} />
      </mesh>
      <mesh position={[1.48, 1.865, 0]} material={mat.trim}>
        <boxGeometry args={[0.26, 0.02, 1.1]} />
      </mesh>
      <mesh geometry={geo.bulkhead} material={mat.trim} />
      {/* instrument panel, its screens, the glare shield over it, the console between the seats */}
      <group position={[0.98, 1.22, 0]} rotation-z={0.22}>
        <RoundedBox args={[0.16, 0.36, 0.96]} radius={0.04} smoothness={3} material={mat.panel} />
        {[-0.3, 0, 0.3].map((z) => (
          <mesh key={z} position={[0.082, 0.02, z]} rotation-y={Math.PI / 2} material={mat.screen}>
            <planeGeometry args={[0.24, 0.2]} />
          </mesh>
        ))}
        <RoundedBox args={[0.34, 0.03, 1.06]} radius={0.012} smoothness={2} position={[0.06, 0.2, 0]} material={mat.panel} />
      </group>
      <mesh position={[1.36, 0.94, 0]} rotation-z={-0.22} material={mat.panel}>
        <boxGeometry args={[0.72, 0.24, 0.24]} />
      </mesh>
      {[0.4, -0.4].map((z) => (
        <group key={z}>
          <Bar a={[1.5, 0.8, z]} b={[1.42, 1.2, z]} r={0.012} material={mat.panel} />
          <Bar a={[1.42, 1.19, z]} b={[1.4, 1.3, z]} r={0.02} material={mat.panel} />
          <Seat position={[1.72, 1.02, z]} mat={mat} />
        </group>
      ))}
      {[3.05, 3.95].map((s) => [-0.48, 0, 0.48].map((z) => <Seat key={`${s}${z}`} position={[s, 1.02, z]} width={0.44} mat={mat} />))}
    </group>
  )
}

// a thin swept blade standing off the skin: an aerial, or a wire cutter
function finShape(len, h, sweep, t) {
  const shape = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(len, 0), new THREE.Vector2(sweep + len * 0.32, h), new THREE.Vector2(sweep, h)])
  const g = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: true, bevelSize: t * 0.4, bevelThickness: t * 0.4, bevelSegments: 2 })
  g.translate(0, 0, -t / 2)
  return g
}

// bodyColor, stripeColor: the paint and the two stripes that sweep along it.
// registration: lettering on the tail boom. blades: three to five main rotor
// blades. engines: running, rotors turning. hover: lifted off into the hover
// (starts the engines if they are stopped). lights: navigation, strobe,
// beacon and landing lights. Click the rotor to start or stop the engines,
// the fuselage to lift off or land.
export default function Helicopter({ bodyColor = '#172463', stripeColor = '#f1f2f4', registration = 'RD-HELI', blades: bladeCount = 4, engines: enginesProp = false, hover: hoverProp = false, lights = true, onChange }) {
  const [engines, setEngines] = useTwoWay(enginesProp, 'engines', onChange)
  const [hover, setHover] = useTwoWay(hoverProp, 'hover', onChange)
  const [point, setPoint] = useState(false)
  useCursor(point, 'pointer')
  const N = Math.round(THREE.MathUtils.clamp(bladeCount, 3, 5))

  // ---- geometry: built once ----
  const geo = useMemo(
    () => ({
      body: bodyGeometry(),
      cowl: cowlGeometry(),
      decal: decalGeometry(),
      blade: bladeGeometry(),
      fan: fanGeometry(),
      shroud: shroudGeometry(),
      fin: finGeometry(),
      stab: stabGeometry(),
      skid: skidGeometry(),
      bulkhead: bulkheadGeometry(4.7),
      aerial: finShape(0.3, 0.26, 0.16, 0.014),
      cutter: finShape(0.36, 0.34, -0.2, 0.012),
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
  // the blade as built, so it can be bent from there
  const flat = useMemo(() => geo.blade.attributes.position.array.slice(), [geo])

  // ---- paint ----
  const skinTex = useMemo(() => bodyTexture({ body: bodyColor, stripe: stripeColor, registration }), [bodyColor, stripeColor, registration])
  const tailTex = useMemo(() => tailTexture({ body: bodyColor, stripe: stripeColor }), [bodyColor, stripeColor])
  const discTex = useMemo(() => discTexture({ blades: N }), [N])
  const tex = useMemo(() => ({ mask: maskTexture(), blade: bladeTexture(), fan: discTexture({ blades: 10, bands: false, hub: 0.3, color: '#0e0f11' }), glow: glowTexture() }), [])
  useEffect(() => () => skinTex.dispose(), [skinTex])
  useEffect(() => () => tailTex.dispose(), [tailTex])
  useEffect(() => () => discTex.dispose(), [discTex])
  useEffect(() => () => Object.values(tex).forEach((t) => t.dispose()), [tex])

  const mat = useMemo(() => {
    const paint = { roughness: 0.3, metalness: 0, clearcoat: 0.9, clearcoatRoughness: 0.08, envMapIntensity: 1 }
    // decals lie a few millimetres off the skin: each layer gets its own depth offset, so the order holds
    const layer = (n) => ({ polygonOffset: true, polygonOffsetFactor: -2 * n, polygonOffsetUnits: -2 * n })
    return {
      // the skin is cut away where the windows are; its inside face is the cabin lining
      skin: new THREE.MeshPhysicalMaterial({ ...paint, alphaMap: tex.mask, alphaTest: 0.5 }),
      liner: new THREE.MeshStandardMaterial({ color: '#34373c', roughness: 0.9, side: THREE.BackSide, alphaMap: tex.mask, alphaTest: 0.5 }),
      trim: new THREE.MeshStandardMaterial({ color: '#25272b', roughness: 0.9, side: THREE.DoubleSide }),
      seat: new THREE.MeshStandardMaterial({ color: '#8b8e94', roughness: 0.75 }),
      panel: new THREE.MeshStandardMaterial({ color: '#131417', roughness: 0.6 }),
      screen: new THREE.MeshStandardMaterial({ color: '#0b1014', roughness: 0.25, emissive: '#2c6f86', emissiveIntensity: 0.5 }),
      tail: new THREE.MeshPhysicalMaterial(paint),
      body: new THREE.MeshPhysicalMaterial(paint),
      seal: new THREE.MeshStandardMaterial({ color: '#0e0f11', roughness: 0.55, ...layer(1) }),
      line: new THREE.MeshStandardMaterial({ color: '#b9bdc3', metalness: 0.9, roughness: 0.3, ...layer(2) }),
      grille: new THREE.MeshStandardMaterial({ color: '#17191c', metalness: 0.7, roughness: 0.5, ...layer(2) }),
      glass: new THREE.MeshPhysicalMaterial({ color: '#46525c', roughness: 0.03, metalness: 0, transmission: 0.94, thickness: 0, ior: 1.5, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.25 }),
      blade: new THREE.MeshStandardMaterial({ map: tex.blade, roughness: 0.5, metalness: 0.25, transparent: true }),
      disc: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }),
      fanDisc: new THREE.MeshBasicMaterial({ map: tex.fan, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }),
      fan: new THREE.MeshStandardMaterial({ color: '#191b1e', roughness: 0.6, metalness: 0.1, transparent: true }),
      tube: new THREE.MeshPhysicalMaterial({ color: '#16181b', roughness: 0.42, clearcoat: 0.4, clearcoatRoughness: 0.3 }),
      steel: new THREE.MeshStandardMaterial({ color: '#7c8087', metalness: 0.95, roughness: 0.36 }),
      titanium: new THREE.MeshStandardMaterial({ color: '#54585f', metalness: 0.9, roughness: 0.42 }),
      chrome: new THREE.MeshStandardMaterial({ color: '#e4e7ea', metalness: 1, roughness: 0.1 }),
      rubber: new THREE.MeshStandardMaterial({ color: '#121314', roughness: 0.9 }),
      dark: new THREE.MeshStandardMaterial({ color: '#0a0b0d', roughness: 0.85, metalness: 0.2 }),
      hot: new THREE.MeshStandardMaterial({ color: '#5d5148', metalness: 0.9, roughness: 0.5, side: THREE.DoubleSide }),
      lamp: new THREE.MeshStandardMaterial({ color: '#f4f6f8', emissive: '#fff4d6', emissiveIntensity: 0, roughness: 0.2 }),
      lens: new THREE.MeshPhysicalMaterial({ color: '#d2241a', roughness: 0.15, transmission: 0.4, thickness: 0.05, emissive: '#ff1a0c', emissiveIntensity: 0.25 }),
    }
  }, [tex])
  useEffect(() => () => Object.values(mat).forEach((m) => m.dispose()), [mat])
  useEffect(() => {
    mat.skin.map = skinTex
    mat.tail.map = tailTex
    mat.disc.map = discTex
    mat.body.color.set(bodyColor)
    ;[mat.skin, mat.tail, mat.disc].forEach((m) => (m.needsUpdate = true))
  }, [mat, skinTex, tailTex, discTex, bodyColor])

  // ---- lights: where each lamp is, its colour, and how it behaves ----
  const lamps = useMemo(() => {
    const out = []
    for (const side of [1, -1]) {
      out.push({ p: [STAB.s + 0.36, STAB.y + 0.1, side * (STAB.span + 0.06)], color: side > 0 ? '#ff2a1c' : '#18e06a', size: 0.36, kind: 'nav' })
      out.push({ p: [STAB.s + 0.62, STAB.y + 0.56, side * STAB.span], color: '#ffffff', size: 0.6, kind: 'strobe' })
      out.push({ p: [0.72, 0.6, side * 0.2], color: '#fff3d2', size: 0.42, kind: 'landing' })
    }
    const tail = finPoint(3.3, 1)
    out.push({ p: [tail.x + 0.03, tail.y, 0], color: '#ffffff', size: 0.3, kind: 'nav' })
    const top = finPoint(3.62, 0.5)
    out.push({ p: [top.x, top.y + 0.07, 0], color: '#ff2414', size: 0.8, kind: 'beacon' })
    out.push({ p: [3.2, 0.53, 0], color: '#ff2414', size: 0.8, kind: 'beacon' })
    return out
  }, [])

  // ---- motion ----
  const craft = useRef()
  const rotor = useRef()
  const disc = useRef()
  const fan = useRef()
  const fanDisc = useRef()
  const bladeRefs = useRef([])
  const glowRefs = useRef([])
  const live = useRef({})
  live.current = { engines, hover, lights }
  const st = useRef({ rpm: enginesProp || hoverProp ? 1 : 0, alt: hoverProp ? HOVER : 0, vel: 0, light: lights ? 1 : 0, bend: null })

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30)
    const w = live.current
    const s = st.current
    const t = state.clock.elapsedTime

    // The rotor takes its time to spool up and longer to run down. It keeps
    // turning for as long as the aircraft is asked to hover, or is still in the air.
    const run = w.engines || w.hover || s.alt > 0.02
    s.rpm += ((run ? 1 : 0) - s.rpm) * (1 - Math.exp(-dt * (run ? 0.55 : 0.32)))
    if (rotor.current) rotor.current.rotation.y -= s.rpm * OMEGA * dt
    if (fan.current) fan.current.rotation.z -= s.rpm * OMEGA * 4.6 * dt

    // Too fast to follow, the blades give way to a disc that drifts slowly backwards.
    const blur = smooth((s.rpm - 0.3) / 0.4)
    mat.blade.opacity = 1 - blur
    mat.fan.opacity = 1 - smooth((s.rpm - 0.1) / 0.25)
    mat.disc.opacity = blur
    mat.fanDisc.opacity = smooth((s.rpm - 0.1) / 0.25)
    for (const b of bladeRefs.current) {
      if (!b) continue
      b.visible = blur < 0.995
      b.castShadow = blur < 0.5
    }
    if (disc.current) {
      disc.current.visible = blur > 0.005
      disc.current.rotation.z += dt * 1.7
    }
    if (fanDisc.current) fanDisc.current.rotation.z += dt * 2.3

    // lift off once the rotor is up to speed; settle back onto the skids when asked to land
    const want = w.hover && s.rpm > 0.93 ? HOVER : 0
    s.vel += ((want - s.alt) * 1.6 - s.vel * 2.4) * dt
    s.alt = Math.max(0, s.alt + s.vel * dt)
    if (s.alt === 0 && s.vel < 0) s.vel = 0
    const air = smooth(s.alt / 0.6)
    if (craft.current) {
      craft.current.position.set(Math.sin(t * 0.23) * 0.1 * air, s.alt + Math.sin(t * 0.9) * 0.045 * air, Math.sin(t * 0.31 + 1) * 0.08 * air)
      craft.current.rotation.set(Math.sin(t * 0.52) * 0.018 * air, Math.sin(t * 0.17) * 0.03 * air, (0.03 + Math.sin(t * 0.41 + 2) * 0.012) * air)
    }

    // the blades hang under their own weight at rest and cone up as they take the aircraft's
    const bend = THREE.MathUtils.lerp(-0.26, 0.1, smooth(s.rpm / 0.8)) + 0.12 * smooth(s.alt / 0.4) * s.rpm
    if (s.bend === null || Math.abs(bend - s.bend) > 5e-4) {
      s.bend = bend
      const pos = geo.blade.attributes.position
      for (let i = 0; i < pos.count; i++) {
        const k = (flat[i * 3 + 2] - BLADE_ROOT) / (ROTOR_R - BLADE_ROOT)
        pos.array[i * 3 + 1] = flat[i * 3 + 1] + bend * k * k
      }
      pos.needsUpdate = true
      if (disc.current) disc.current.position.y = MAST.y + 0.04 + Math.max(0, bend) * 0.5
    }

    // lights: steady navigation and landing lights, a double strobe, a beating beacon
    s.light += ((w.lights ? 1 : 0) - s.light) * (1 - Math.exp(-dt * 9))
    const strobe = t % 1.4
    const level = { nav: 0.85, landing: 0.8, strobe: strobe < 0.05 || (strobe > 0.13 && strobe < 0.18) ? 1 : 0, beacon: Math.exp(-((t % 1.1) / 0.11)) }
    glowRefs.current.forEach((g, i) => g && (g.material.opacity = s.light * level[lamps[i].kind]))
    mat.lamp.emissiveIntensity = s.light * 2.2
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
  // stopping the engines in the hover lands first; lifting off starts them
  const toggleEngines = () => {
    if (engines || hover) {
      if (hover) setHover(false)
      setEngines(false)
    } else setEngines(true)
  }
  const toggleHover = () => {
    if (!hover && !engines) setEngines(true)
    setHover(!hover)
  }

  const crown = (s) => cowl.section(s).cy + cowl.section(s).up
  const keel = (s) => body.section(s).cy - body.section(s).dn
  const hubY = MAST.y

  return (
    <group ref={craft}>
      <group position={[-CENTRE, 0, 0]}>
        {/* ================= fuselage, cowling, tail ================= */}
        <group {...hot(toggleHover)}>
          <mesh geometry={geo.body} material={mat.skin} castShadow receiveShadow />
          <mesh geometry={geo.body} material={mat.liner} />
          <mesh geometry={geo.shroud} material={mat.tail} castShadow receiveShadow />
          <mesh geometry={geo.fin} material={mat.tail} castShadow receiveShadow />
        </group>
        <mesh geometry={geo.cowl} material={mat.body} castShadow receiveShadow {...hot(toggleEngines)} />
        <Cabin geo={geo} mat={mat} />
        {/* the fairing round the foot of the mast */}
        <mesh position={[MAST.s, crown(MAST.s) + 0.06, 0]} scale={[1.5, 1, 1]} material={mat.body} castShadow>
          <cylinderGeometry args={[0.2, 0.34, 0.22, 40]} />
        </mesh>
        {/* wire cutters above the windscreen and under the nose */}
        <mesh geometry={geo.cutter} position={[1.52, crown(1.52) - 0.02, 0]} material={mat.steel} castShadow />
        <mesh geometry={geo.cutter} position={[1.0, keel(1.0) + 0.02, 0]} scale={[1, -0.8, 1]} material={mat.steel} castShadow />
        {/* aerials on the cowling, the keel and under the boom */}
        <mesh geometry={geo.aerial} position={[5.3, crown(5.3) - 0.03, 0]} material={mat.body} castShadow />
        <mesh geometry={geo.aerial} position={[2.5, keel(2.5) + 0.02, 0]} scale={[1, -0.7, 1]} material={mat.body} castShadow />
        <mesh geometry={geo.aerial} position={[7.4, keel(7.4) + 0.02, 0]} scale={[1, -0.8, 1]} material={mat.body} castShadow />
        {/* the bumper that keeps the fan off the ground */}
        <Bar a={[10.2, 1.34, 0]} b={[10.52, 1.14, 0]} r={0.022} material={mat.steel} />
        {/* beacons on the fin and the belly */}
        {[[finPoint(3.62, 0.5).x, 3.63, 1], [3.2, keel(3.2), -1]].map(([x, y, d]) => (
          <mesh key={x} position={[x, y, 0]} scale={[1.5, d, 1]} material={mat.lens}>
            <sphereGeometry args={[0.05, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
          </mesh>
        ))}

        {/* ================= everything paired: port, and starboard through a mirror ================= */}
        {[1, -1].map((side) => (
          <group key={side} scale={[1, 1, side]}>
            <mesh geometry={geo.decal.glass} material={mat.glass} />
            <mesh geometry={geo.decal.seals} material={mat.seal} />
            <mesh geometry={geo.decal.lines} material={mat.line} />
            <mesh geometry={geo.decal.grille} material={mat.grille} />
            <mesh geometry={geo.stab} material={mat.body} castShadow receiveShadow />

            {/* skid, cross tubes, step */}
            <mesh geometry={geo.skid.skid} material={mat.tube} castShadow receiveShadow />
            <mesh geometry={geo.skid.cross} material={mat.tube} castShadow />
            <mesh geometry={geo.skid.step} material={mat.tube} castShadow />
            {[[0.42, 0.4], [4.72, 0.045]].map(([x, y]) => (
              <mesh key={x} position={[x, y, SKID_Z]} material={mat.tube}>
                <sphereGeometry args={[0.045, 16, 12]} />
              </mesh>
            ))}
            {/* the saddles that clamp the skid to the cross tubes, and its wear shoes */}
            {CROSS.map((s) => (
              <group key={s}>
                <mesh position={[s, 0.05, SKID_Z]} rotation-z={Math.PI / 2} material={mat.steel}>
                  <cylinderGeometry args={[0.056, 0.056, 0.13, 20]} />
                </mesh>
                <mesh position={[s + 0.45, 0.006, SKID_Z]} material={mat.steel}>
                  <boxGeometry args={[0.3, 0.012, 0.05]} />
                </mesh>
              </group>
            ))}

            {/* engine exhaust */}
            <group position={[5.62, 2.47, 0.36]} rotation={[0.5, -0.5, -1.1]}>
              <mesh material={mat.hot} castShadow>
                <cylinderGeometry args={[0.11, 0.095, 0.4, 28, 1, true]} />
              </mesh>
              <mesh position-y={0.2} rotation-x={Math.PI / 2} material={mat.steel}>
                <torusGeometry args={[0.11, 0.008, 8, 28]} />
              </mesh>
              <mesh position-y={-0.12} rotation-x={-Math.PI / 2} material={mat.dark}>
                <circleGeometry args={[0.1, 24]} />
              </mesh>
            </group>

            {/* pitot probe under the nose, landing lamp beside it */}
            <Bar a={[0.62, 0.72, 0.36]} b={[0.6, 0.62, 0.38]} r={0.01} material={mat.steel} />
            <Bar a={[0.6, 0.62, 0.38]} b={[0.4, 0.62, 0.38]} r={0.009} material={mat.steel} />
            <mesh position={[0.74, 0.625, 0.2]} rotation-z={0.5} material={mat.lamp}>
              <cylinderGeometry args={[0.05, 0.04, 0.05, 20]} />
            </mesh>
            {/* navigation lamp on the end plate */}
            <mesh position={[STAB.s + 0.36, STAB.y + 0.1, STAB.span + 0.025]} scale={[2, 1, 0.8]} material={mat.lamp}>
              <sphereGeometry args={[0.022, 12, 10]} />
            </mesh>
          </group>
        ))}

        {/* ================= tail fan ================= */}
        <group position={[FAN.s, FAN.y, 0]}>
          {/* the gearbox in the middle of the duct, on its two struts and the fairing over the drive shaft */}
          <mesh rotation-x={Math.PI / 2} material={mat.titanium}>
            <cylinderGeometry args={[0.105, 0.13, 0.22, 28]} />
          </mesh>
          {[1.05, -1.05].map((a) => (
            <Bar key={a} a={[Math.cos(a) * 0.1, Math.sin(a) * 0.1, -0.07]} b={[Math.cos(a) * (FAN.r + 0.03), Math.sin(a) * (FAN.r + 0.03), -0.07]} r={0.026} material={mat.titanium} />
          ))}
          <Bar a={[-0.1, 0, -0.07]} b={[-FAN.r - 0.03, 0.02, -0.07]} r={0.035} material={mat.body} />
          <group ref={fan} position-z={0.07} {...hot(toggleEngines)}>
            <mesh geometry={geo.fan} material={mat.fan} />
            <mesh rotation-x={Math.PI / 2} material={mat.titanium}>
              <cylinderGeometry args={[0.15, 0.15, 0.09, 32]} />
            </mesh>
            <mesh position-z={0.045} rotation-x={Math.PI / 2} scale={[1, 0.35, 1]} material={mat.body}>
              <sphereGeometry args={[0.15, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2]} />
            </mesh>
          </group>
          <mesh ref={fanDisc} position-z={0.07} material={mat.fanDisc} >
            <circleGeometry args={[FAN.r - 0.01, 64]} />
          </mesh>
        </group>

        {/* ================= main rotor ================= */}
        <group position={[MAST.s, 0, 0]} {...hot(toggleEngines)}>
          {/* what stands still: the mast, the fixed half of the swashplate, the control rods up to it */}
          <mesh position-y={(crown(MAST.s) + hubY) / 2} material={mat.steel} castShadow>
            <cylinderGeometry args={[0.065, 0.075, hubY - crown(MAST.s), 24]} />
          </mesh>
          <mesh position-y={hubY - 0.3} material={mat.titanium} castShadow>
            <cylinderGeometry args={[0.2, 0.2, 0.035, 36]} />
          </mesh>
          {[0.4, 2.5, 4.6].map((a) => (
            <Bar key={a} a={[Math.cos(a) * 0.19, crown(MAST.s) + 0.1, Math.sin(a) * 0.19]} b={[Math.cos(a) * 0.18, hubY - 0.31, Math.sin(a) * 0.18]} r={0.014} material={mat.chrome} />
          ))}
          <mesh position-y={hubY - 0.2} material={mat.rubber}>
            <cylinderGeometry args={[0.085, 0.11, 0.2, 20]} />
          </mesh>

          {/* what turns */}
          <group ref={rotor} position-y={hubY} rotation-y={Math.PI / N}>
            <mesh position-y={-0.26} material={mat.steel} castShadow>
              <cylinderGeometry args={[0.22, 0.22, 0.035, 36]} />
            </mesh>
            <mesh position-y={-0.02} material={mat.titanium} castShadow>
              <cylinderGeometry args={[0.2, 0.17, 0.15, 36]} />
            </mesh>
            {/* the cap over the head */}
            <mesh position-y={0.055} scale={[1, 0.42, 1]} material={mat.body} castShadow>
              <sphereGeometry args={[0.24, 36, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
            </mesh>
            {Array.from({ length: N }, (_, i) => (
              <group key={`${N}-${i}`} rotation-y={(i / N) * Math.PI * 2}>
                {/* the flexible arm out to the blade, its cuff and the two bolts through it */}
                <mesh position={[0, -0.02, 0.36]} rotation-x={Math.PI / 2} scale={[1.9, 1, 0.5]} material={mat.titanium} castShadow>
                  <cylinderGeometry args={[0.05, 0.06, 0.46, 20]} />
                </mesh>
                <mesh position={[0.0, -0.015, 0.66]} material={mat.titanium} castShadow>
                  <boxGeometry args={[0.2, 0.062, 0.22]} />
                </mesh>
                {[-0.05, 0.05].map((x) => (
                  <mesh key={x} position={[x, -0.015, 0.66]} material={mat.chrome}>
                    <cylinderGeometry args={[0.018, 0.018, 0.09, 12]} />
                  </mesh>
                ))}
                {/* the pitch horn on the leading side and the link down to the swashplate */}
                <Bar a={[-0.06, -0.03, 0.5]} b={[-0.2, -0.05, 0.42]} r={0.016} material={mat.titanium} />
                <Bar a={[-0.2, -0.05, 0.42]} b={[-0.19, -0.25, 0.1]} r={0.011} material={mat.chrome} />
                {/* the damper between the arm and the hub */}
                <Bar a={[0.09, -0.03, 0.56]} b={[0.16, -0.03, 0.2]} r={0.022} material={mat.rubber} />
                <mesh ref={(m) => (bladeRefs.current[i] = m)} geometry={geo.blade} material={mat.blade} castShadow />
              </group>
            ))}
          </group>
          <mesh ref={disc} position-y={hubY} rotation-x={-Math.PI / 2} material={mat.disc} visible={false}>
            <circleGeometry args={[ROTOR_R, 96]} />
          </mesh>
        </group>

        {/* ================= lights ================= */}
        {lamps.map((l, i) => (
          <sprite key={i} position={l.p} scale={[l.size, l.size, 1]} ref={(g) => (glowRefs.current[i] = g)}>
            <spriteMaterial map={tex.glow} color={l.color} blending={THREE.AdditiveBlending} depthWrite={false} transparent opacity={0} />
          </sprite>
        ))}
      </group>
    </group>
  )
}
