import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { RoundedBox, useCursor } from '@react-three/drei'
import * as THREE from 'three'
import { glowTexture } from '../airliner/textures.js'
import { plateTexture } from '../lorry/textures.js'
import { ARCH_R, AXLES, DOORS, DOOR_TOP, FLOOR, FLOOR_REAR, HALF, MIRROR_HEAD, ROOF, STEP_X, UNDER, WHEEL, archGeometry, faceGeometry, facePoint, leafGeometry, mirrorArmGeometry, rimGeometry, seatGeometry, shellGeometry, smooth, strapGeometry, tyreGeometry, wheelRimGeometry } from './geometry.js'
import { faceTexture, floorTexture, leafTexture, shellMasks, shellTexture } from './textures.js'

// A 12 m low-floor city bus at real size, built from its own dimensions on
// the airliner's mesh helpers and the helicopter's hull. The frame has x
// running aft from the front of the shell, y up from the ground and +z to
// the left; the three plug doors are on the right. This component centres
// the bus on the origin with the front towards -x.
//
// What moves: the doors swing out of their openings and slide back along the
// side; the lights come on, headlamps, tail lamps, the saloon lighting and
// the amber displays.

const CENTRE = 6.0 // the station that sits over the origin
const BOX_TOP = WHEEL.R + ARCH_R + 0.06 // the lid over each wheel arch, just clear of the opening
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

// a wheel on its hub: tyre, the steel dish with its hand holes, the nuts
function Wheel({ position, side, geo, mat, dish = true }) {
  return (
    <group position={position}>
      <mesh geometry={geo.tyre} material={mat.tyre} castShadow />
      <mesh rotation-x={Math.PI / 2} material={mat.steel}>
        <cylinderGeometry args={[WHEEL.R * 0.58, WHEEL.R * 0.58, WHEEL.W * 0.9, 40]} />
      </mesh>
      {dish && (
        <group scale={[1, 1, side]}>
          <mesh geometry={geo.rim} material={mat.rim} />
          <mesh position-z={WHEEL.W / 2 - 0.02} rotation-x={Math.PI / 2} material={mat.rim}>
            <cylinderGeometry args={[0.11, 0.12, 0.05, 24]} />
          </mesh>
          {Array.from({ length: 10 }, (_, i) => (
            <mesh key={i} position={[Math.cos((i / 10) * Math.PI * 2) * 0.17, Math.sin((i / 10) * Math.PI * 2) * 0.17, WHEEL.W / 2 - 0.02]} rotation-x={Math.PI / 2} material={mat.steel}>
              <cylinderGeometry args={[0.016, 0.016, 0.03, 8]} />
            </mesh>
          ))}
        </group>
      )}
    </group>
  )
}

// a passenger seat on its pedestal, facing forward
function Seat({ x, y, z, geo, mat, floor }) {
  return (
    <group position={[x, y, z]}>
      <mesh geometry={geo.seat} rotation-y={Math.PI} material={mat.seat} castShadow />
      <mesh position={[-0.22, -(y - floor) / 2, 0]} material={mat.grey}>
        <boxGeometry args={[0.08, y - floor, 0.3]} />
      </mesh>
      <mesh position={[-0.2, -0.02, 0]} material={mat.grey}>
        <boxGeometry args={[0.4, 0.03, 0.4]} />
      </mesh>
    </group>
  )
}

// the saloon: floors, the boxes over the wheels, the seats, the poles and
// rails with their straps, the lighting, and the driver's cab up front
function Interior({ geo, mat }) {
  const seats = useMemo(() => {
    const out = []
    const arch = (x, ax) => Math.abs(x - 0.22 - ax) < ARCH_R + 0.1
    const pan = (x) => (arch(x, AXLES.front) || arch(x, AXLES.rear) ? BOX_TOP : (x > STEP_X ? FLOOR_REAR : FLOOR) + 0.45)
    const floorAt = (x) => (x > STEP_X ? FLOOR_REAR : FLOOR)
    for (const x of [2.45, 3.2, 3.95, 4.7, 5.45, 6.2, 6.95, 7.7, 8.45, 9.2, 10.0, 10.75]) for (const z of [0.95, 0.5]) out.push({ x, y: pan(x), z, floor: floorAt(x) })
    const blocked = (x) => DOORS.some((d) => x - 0.5 < d.x1 + 0.1 && x > d.x0 - 0.1)
    for (const x of [2.45, 3.2, 3.95, 4.7, 7.7, 8.45, 9.2]) if (!blocked(x)) for (const z of [-0.95, -0.5]) out.push({ x, y: pan(x), z, floor: floorAt(x) })
    for (const z of [-0.9, -0.45, 0, 0.45, 0.9]) out.push({ x: 11.6, y: FLOOR_REAR + 0.6, z, floor: FLOOR_REAR })
    return out
  }, [])
  const straps = useMemo(() => {
    const out = []
    for (const z of [0.42, -0.42]) for (let x = 2.2; x < 11.2; x += 0.55) out.push([x, z])
    return out
  }, [])
  return (
    <group>
      {/* floors and the step up to the rear */}
      <mesh position={[(0.4 + STEP_X) / 2, FLOOR, 0]} rotation-x={-Math.PI / 2} material={mat.floor} receiveShadow>
        <planeGeometry args={[STEP_X - 0.4, 2.0]} />
      </mesh>
      <mesh position={[(STEP_X + 11.7) / 2, FLOOR_REAR, 0]} rotation-x={-Math.PI / 2} material={mat.floor} receiveShadow>
        <planeGeometry args={[11.7 - STEP_X, 2.0]} />
      </mesh>
      <mesh position={[STEP_X, (FLOOR + FLOOR_REAR) / 2, 0]} material={mat.grey}>
        <boxGeometry args={[0.03, FLOOR_REAR - FLOOR, 2.3]} />
      </mesh>
      {/* the wheel boxes: a lid clear of the arch, and the wall down its inner side */}
      {[1, -1].map((side) =>
        [AXLES.front, AXLES.rear].map((ax) => (
          <group key={`${side}${ax}`}>
            <mesh position={[ax, BOX_TOP - 0.03, side * 0.93]} material={mat.grey}>
              <boxGeometry args={[ARCH_R * 2 + 0.3, 0.06, 0.66]} />
            </mesh>
            <mesh position={[ax, (FLOOR + BOX_TOP) / 2, side * 0.6]} material={mat.grey}>
              <boxGeometry args={[ARCH_R * 2 + 0.3, BOX_TOP - FLOOR, 0.03]} />
            </mesh>
            {[-1, 1].map((e) => (
              <mesh key={e} position={[ax + e * (ARCH_R + 0.15), (FLOOR + BOX_TOP) / 2, side * 0.93]} material={mat.grey}>
                <boxGeometry args={[0.03, BOX_TOP - FLOOR, 0.66]} />
              </mesh>
            ))}
          </group>
        )),
      )}
      {/* the engine tower at the back, and the bench over it */}
      <mesh position={[11.3, (FLOOR_REAR + 1.2) / 2, 0]} material={mat.grey}>
        <boxGeometry args={[0.8, 1.2 - FLOOR_REAR, 2.3]} />
      </mesh>
      {seats.map((s, i) => (
        <Seat key={i} {...s} geo={geo} mat={mat} />
      ))}
      {/* poles by the doors and along the aisle, the rails under the roof, the straps */}
      {DOORS.map((d) => [d.x0 - 0.1, d.x1 + 0.1].map((x) => <Bar key={x} a={[x, FLOOR, -0.98]} b={[x, 2.98, -0.98]} r={0.018} material={mat.pole} />))}
      {[4.3, 7.45, 9.35].map((x) => [0.32, -0.32].map((z) => <Bar key={`${x}${z}`} a={[x, x > STEP_X ? FLOOR_REAR : FLOOR, z]} b={[x, 2.98, z]} r={0.018} material={mat.pole} />))}
      {[0.42, -0.42].map((z) => (
        <group key={z}>
          <Bar a={[1.95, 2.02, z]} b={[11.3, 2.02, z]} r={0.018} material={mat.pole} />
          {[3.0, 5.0, 7.0, 9.0, 11.0].map((x) => (
            <Bar key={x} a={[x, 2.02, z]} b={[x, 2.98, z]} r={0.014} material={mat.pole} />
          ))}
        </group>
      ))}
      {straps.map(([x, z], i) => (
        <group key={i} position={[x, 2.0, z]}>
          <mesh position-y={-0.09} material={mat.strapBand}>
            <boxGeometry args={[0.03, 0.18, 0.006]} />
          </mesh>
          <mesh geometry={geo.strap} position-y={-0.23} material={mat.strap} />
        </group>
      ))}
      {/* the saloon lighting: two strips the length of the roof */}
      {[0.5, -0.5].map((z) => (
        <mesh key={z} position={[6.3, ROOF - 0.08, z]} material={mat.light}>
          <boxGeometry args={[10.6, 0.02, 0.1]} />
        </mesh>
      ))}
      {/* the driver's cab: dash, steering wheel, seat, the partition behind */}
      <RoundedBox args={[0.6, 0.42, 1.3]} radius={0.05} smoothness={3} position={[0.68, 1.12, 0.6]} material={mat.dark} />
      <mesh position={[0.9, 1.28, 0.72]} rotation-z={0.9} material={mat.dark}>
        <boxGeometry args={[0.18, 0.5, 0.2]} />
      </mesh>
      <mesh geometry={geo.steering} position={[1.08, 1.5, 0.72]} rotation-y={Math.PI / 2} rotation-x={-0.6} material={mat.dark} />
      <mesh position={[0.62, 1.42, 0.72]} rotation-z={0.3} material={mat.screen}>
        <boxGeometry args={[0.02, 0.16, 0.24]} />
      </mesh>
      <group position={[1.75, FLOOR + 0.58, 0.72]}>
        <mesh geometry={geo.seat} rotation-y={Math.PI} scale={[1.1, 1.25, 1.1]} material={mat.driverSeat} castShadow />
        <mesh position={[-0.22, -0.29, 0]} material={mat.grey}>
          <boxGeometry args={[0.1, 0.58, 0.3]} />
        </mesh>
      </group>
      <mesh position={[2.0, 1.5, 0.72]} material={mat.partition}>
        <boxGeometry args={[0.02, 2.1, 1.0]} />
      </mesh>
      <mesh position={[1.0, 1.0, -0.6]} material={mat.dark}>
        <boxGeometry args={[0.4, 0.55, 0.5]} />
      </mesh>
    </group>
  )
}

// A hinged, sliding door leaf: the frame with its pane cut out, and the glass in the cut.
function Leaf({ geo, mat, x, w, flip }) {
  return (
    <group position={[x, FLOOR - 0.02, -HALF + 0.02]} scale={[flip ? -1 : 1, 1, 1]}>
      <mesh geometry={geo.leaf} material={mat.leaf} castShadow />
      <mesh geometry={geo.leaf} material={mat.leafGlass} />
      <Bar a={[-w * 0.3, 0.9, -0.03]} b={[-w * 0.3, 1.9, -0.03]} r={0.012} material={mat.pole} />
    </group>
  )
}

// paint, trim: the livery and its band. route: the lettering on the
// destination displays. plate: the number plates. doors: open. lights:
// headlamps, tail lamps and the saloon lighting. Click a door or the side to
// work the doors, the front for the lights.
export default function Bus({ paint = '#1e3a8a', trim = '#f2f3f4', route = '12  CENTRAL STATION', plate = 'RD 2026', doors: doorsProp = false, lights: lightsProp = true, onChange }) {
  const [doors, setDoors] = useTwoWay(doorsProp, 'doors', onChange)
  const [lights, setLights] = useTwoWay(lightsProp, 'lights', onChange)
  const [point, setPoint] = useState(false)
  useCursor(point, 'pointer')

  // ---- geometry: built once ----
  const geo = useMemo(
    () => ({
      shell: shellGeometry(),
      front: faceGeometry(true),
      rear: faceGeometry(false),
      arch: archGeometry(),
      tyre: tyreGeometry(WHEEL.R, WHEEL.W, WHEEL.R * 0.58),
      rim: rimGeometry(WHEEL.R * 0.56, WHEEL.W),
      leaf: leafGeometry(0.62, DOOR_TOP - FLOOR + 0.02),
      arm: mirrorArmGeometry(1),
      seat: seatGeometry(),
      strap: strapGeometry(),
      steering: wheelRimGeometry(),
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
  const colors = useMemo(() => ({ paint, trim, route }), [paint, trim, route])
  const shellTex = useMemo(() => shellTexture(colors), [colors])
  const frontTex = useMemo(() => faceTexture(true, colors), [colors])
  const rearTex = useMemo(() => faceTexture(false, colors), [colors])
  const leafTex = useMemo(() => leafTexture({ paint }), [paint])
  const plateTex = useMemo(() => plateTexture(plate), [plate])
  const tex = useMemo(() => ({ masks: shellMasks(), floor: floorTexture(), glow: glowTexture() }), [])
  useEffect(() => () => Object.values(shellTex).forEach((t) => t.dispose()), [shellTex])
  useEffect(() => () => Object.values(frontTex).forEach((t) => t.dispose()), [frontTex])
  useEffect(() => () => Object.values(rearTex).forEach((t) => t.dispose()), [rearTex])
  useEffect(() => () => Object.values(leafTex).forEach((t) => t.dispose()), [leafTex])
  useEffect(() => () => plateTex.dispose(), [plateTex])
  useEffect(
    () => () => {
      tex.masks.body.dispose()
      tex.masks.glass.dispose()
      tex.floor.dispose()
      tex.glow.dispose()
    },
    [tex],
  )

  const mat = useMemo(() => {
    const coat = { roughness: 0.32, metalness: 0.08, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1, bumpScale: 0.004 }
    const glass = { color: '#6d7d86', roughness: 0.03, metalness: 0.05, transmission: 0.78, thickness: 0.01, ior: 1.5, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.3 }
    return {
      skin: new THREE.MeshPhysicalMaterial({ ...coat, alphaMap: tex.masks.body, alphaTest: 0.5 }),
      liner: new THREE.MeshStandardMaterial({ color: '#d7dade', roughness: 0.9, side: THREE.BackSide, alphaMap: tex.masks.body, alphaTest: 0.5 }),
      glass: new THREE.MeshPhysicalMaterial({ ...glass, alphaMap: tex.masks.glass, alphaTest: 0.5 }),
      front: new THREE.MeshPhysicalMaterial({ ...coat, alphaMap: frontTex.body, alphaTest: 0.5 }),
      frontGlass: new THREE.MeshPhysicalMaterial({ ...glass, alphaMap: frontTex.glass, alphaTest: 0.5 }),
      rear: new THREE.MeshPhysicalMaterial({ ...coat, alphaMap: rearTex.body, alphaTest: 0.5 }),
      rearGlass: new THREE.MeshPhysicalMaterial({ ...glass, alphaMap: rearTex.glass, alphaTest: 0.5 }),
      faceLiner: new THREE.MeshStandardMaterial({ color: '#2a2d31', roughness: 0.9, side: THREE.BackSide }),
      leaf: new THREE.MeshPhysicalMaterial({ ...coat, alphaMap: leafTex.body, alphaTest: 0.5, side: THREE.DoubleSide }),
      leafGlass: new THREE.MeshPhysicalMaterial({ ...glass, alphaMap: leafTex.glass, alphaTest: 0.5, side: THREE.DoubleSide }),
      plain: new THREE.MeshPhysicalMaterial({ ...coat, color: paint }),
      white: new THREE.MeshPhysicalMaterial({ ...coat, color: '#e6e8ea' }),
      arch: new THREE.MeshStandardMaterial({ color: '#1a1b1e', roughness: 0.95, side: THREE.DoubleSide }),
      tyre: new THREE.MeshStandardMaterial({ color: '#141516', roughness: 0.92 }),
      rim: new THREE.MeshStandardMaterial({ color: '#c3c7cc', metalness: 0.85, roughness: 0.35 }),
      steel: new THREE.MeshStandardMaterial({ color: '#5d6168', metalness: 0.8, roughness: 0.45 }),
      chassis: new THREE.MeshStandardMaterial({ color: '#26292d', metalness: 0.5, roughness: 0.7 }),
      pan: new THREE.MeshStandardMaterial({ color: '#33363b', metalness: 0.3, roughness: 0.85 }),
      tank: new THREE.MeshStandardMaterial({ color: '#8d9298', metalness: 0.8, roughness: 0.4 }),
      dark: new THREE.MeshStandardMaterial({ color: '#17191c', roughness: 0.8 }),
      grey: new THREE.MeshStandardMaterial({ color: '#8f949a', roughness: 0.75 }),
      partition: new THREE.MeshPhysicalMaterial({ color: '#9aa4ac', roughness: 0.05, transmission: 0.8, thickness: 0.01, side: THREE.DoubleSide }),
      seat: new THREE.MeshStandardMaterial({ color: '#24449a', roughness: 0.6 }),
      driverSeat: new THREE.MeshStandardMaterial({ color: '#2b2e33', roughness: 0.8 }),
      pole: new THREE.MeshStandardMaterial({ color: '#e8c01f', roughness: 0.35, metalness: 0.2 }),
      strap: new THREE.MeshStandardMaterial({ color: '#f0c623', roughness: 0.6 }),
      strapBand: new THREE.MeshStandardMaterial({ color: '#2a2d31', roughness: 0.9 }),
      floor: new THREE.MeshStandardMaterial({ map: tex.floor, roughness: 0.9 }),
      light: new THREE.MeshStandardMaterial({ color: '#f4f1e8', emissive: '#fff4dc', emissiveIntensity: 0, roughness: 0.4 }),
      screen: new THREE.MeshStandardMaterial({ color: '#0b1014', emissive: '#2f6f8a', emissiveIntensity: 0.6 }),
      mirror: new THREE.MeshStandardMaterial({ color: '#e8ebee', metalness: 1, roughness: 0.04 }),
      head: new THREE.MeshStandardMaterial({ color: '#f4f6f8', emissive: '#fff6e0', emissiveIntensity: 0, roughness: 0.2 }),
      tail: new THREE.MeshStandardMaterial({ color: '#c8231a', emissive: '#ff2a14', emissiveIntensity: 0, roughness: 0.25 }),
      plate: new THREE.MeshStandardMaterial({ map: plateTex, roughness: 0.5 }),
    }
  }, [tex, frontTex, rearTex, leafTex, plateTex]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => Object.values(mat).forEach((m) => m.dispose()), [mat])
  useEffect(() => {
    const put = (m, t) => {
      m.map = t.map
      m.bumpMap = t.bump
      m.needsUpdate = true
    }
    put(mat.skin, shellTex)
    put(mat.front, frontTex)
    put(mat.rear, rearTex)
    put(mat.leaf, leafTex)
    mat.plain.color.set(paint)
  }, [mat, shellTex, frontTex, rearTex, leafTex, paint])

  // ---- lamps: headlamps, fog lamps and tail lamps on the faces, and their glows ----
  const lamps = useMemo(() => {
    const out = []
    for (const u of [0.125, 0.235, 0.765, 0.875]) out.push({ p: facePoint(true, u, 0.185), color: '#dfe9ff', size: 0.5, kind: 'head' })
    for (const u of [0.13, 0.87]) out.push({ p: facePoint(true, u, 0.06), color: '#fff2d0', size: 0.3, kind: 'head' })
    for (const u of [0.085, 0.915]) out.push({ p: facePoint(false, u, 0.49), color: '#ff2a1a', size: 0.4, kind: 'tail' })
    return out
  }, [])

  // ---- motion ----
  const leaves = useRef([])
  const glowRefs = useRef([])
  const live = useRef({})
  live.current = { doors, lights }
  const st = useRef({ doors: doorsProp ? 1 : 0, light: lightsProp ? 1 : 0 })
  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 30)
    const w = live.current
    const s = st.current
    // plug doors: out of the opening first, then along the side
    s.doors += THREE.MathUtils.clamp((w.doors ? 1 : 0) - s.doors, -dt / 2.4, dt / 2.4)
    const out = smooth(Math.min(1, s.doors / 0.3)) * 0.13
    const slide = smooth((s.doors - 0.3) / 0.7)
    for (const l of leaves.current) if (l) l.position.set(l.userData.x + l.userData.dir * slide * 0.66, 0, -out)
    s.light += ((w.lights ? 1 : 0) - s.light) * (1 - Math.exp(-dt * 8))
    glowRefs.current.forEach((g) => g && (g.material.opacity = s.light * 0.9))
    mat.head.emissiveIntensity = s.light * 2.5
    mat.tail.emissiveIntensity = s.light * 1.6
    mat.light.emissiveIntensity = s.light * 1.4
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

  return (
    <group position={[-CENTRE, 0, 0]}>
      {/* ================= shell, faces, glass ================= */}
      <group {...hot(() => setDoors(!doors))}>
        <mesh geometry={geo.shell} material={mat.skin} castShadow receiveShadow />
        <mesh geometry={geo.shell} material={mat.liner} />
        <mesh geometry={geo.shell} material={mat.glass} />
      </group>
      <group {...hot(() => setLights(!lights))}>
        <mesh geometry={geo.front} material={mat.front} castShadow />
        <mesh geometry={geo.front} material={mat.faceLiner} />
        <mesh geometry={geo.front} material={mat.frontGlass} />
      </group>
      <mesh geometry={geo.rear} material={mat.rear} castShadow />
      <mesh geometry={geo.rear} material={mat.faceLiner} />
      <mesh geometry={geo.rear} material={mat.rearGlass} />
      <Interior geo={geo} mat={mat} />

      {/* ================= doors: two leaves each ================= */}
      {DOORS.map((d, i) => {
        const w = (d.x1 - d.x0) / 2
        const xc = (d.x0 + d.x1) / 2
        return [-1, 1].map((dir) => (
          <group key={`${i}${dir}`} ref={(g) => (leaves.current[i * 2 + (dir + 1) / 2] = g) && (g.userData = { x: 0, dir })} {...hot(() => setDoors(!doors))}>
            <Leaf geo={geo} mat={mat} x={xc + (dir * w) / 2} w={w} flip={dir < 0} />
          </group>
        ))
      })}

      {/* ================= underneath: pan, rails, axles, engine, tanks ================= */}
      <mesh position={[(UNDER.x0 + UNDER.x1) / 2, UNDER.y + 0.04, 0]} material={mat.pan}>
        <boxGeometry args={[UNDER.x1 - UNDER.x0, 0.08, UNDER.z * 2 + 0.1]} />
      </mesh>
      {[0.72, -0.72].map((z) => (
        <mesh key={z} position={[(UNDER.x0 + UNDER.x1) / 2, UNDER.y - 0.06, z]} material={mat.chassis}>
          <boxGeometry args={[UNDER.x1 - UNDER.x0 - 0.4, 0.12, 0.1]} />
        </mesh>
      ))}
      {[1.4, 3.8, 5.2, 6.6, 7.6, 9.8, 10.9].map((x) => (
        <mesh key={x} position={[x, UNDER.y - 0.05, 0]} material={mat.chassis}>
          <boxGeometry args={[0.08, 0.1, 1.9]} />
        </mesh>
      ))}
      {/* front axle with its steering links, rear axle with the differential, the prop shaft to the engine */}
      <mesh position={[AXLES.front, WHEEL.R, 0]} rotation-x={Math.PI / 2} material={mat.chassis} castShadow>
        <cylinderGeometry args={[0.06, 0.06, 1.9, 16]} />
      </mesh>
      <Bar a={[AXLES.front + 0.25, WHEEL.R - 0.05, 0.85]} b={[AXLES.front + 0.25, WHEEL.R - 0.05, -0.85]} r={0.025} material={mat.steel} />
      <mesh position={[AXLES.rear, WHEEL.R, 0]} rotation-x={Math.PI / 2} material={mat.chassis} castShadow>
        <cylinderGeometry args={[0.08, 0.08, 1.9, 16]} />
      </mesh>
      <mesh position={[AXLES.rear, WHEEL.R, 0.15]} scale={[1, 1, 1.1]} material={mat.chassis} castShadow>
        <sphereGeometry args={[0.22, 20, 14]} />
      </mesh>
      <Bar a={[AXLES.rear + 0.2, WHEEL.R, 0.15]} b={[10.4, 0.7, 0.15]} r={0.05} material={mat.steel} />
      {[-1, 1].map((s) =>
        [AXLES.front, AXLES.rear].map((ax) => (
          <group key={`${s}${ax}`}>
            <mesh position={[ax, UNDER.y - 0.12, s * 0.6]} material={mat.dark}>
              <boxGeometry args={[0.3, 0.14, 0.3]} />
            </mesh>
            <mesh position={[ax + 0.35, UNDER.y - 0.16, s * 0.6]} material={mat.steel}>
              <cylinderGeometry args={[0.03, 0.03, 0.2, 10]} />
            </mesh>
          </group>
        )),
      )}
      <mesh position={[11.0, 0.78, 0]} material={mat.chassis} castShadow>
        <boxGeometry args={[1.1, 0.9, 1.2]} />
      </mesh>
      <mesh position={[11.0, 0.42, 0.75]} rotation-z={Math.PI / 2} material={mat.steel}>
        <cylinderGeometry args={[0.18, 0.18, 0.8, 20]} />
      </mesh>
      <mesh position={[4.6, 0.5, 0.55]} rotation-z={Math.PI / 2} material={mat.tank} castShadow>
        <cylinderGeometry args={[0.27, 0.27, 2.0, 24]} />
      </mesh>
      <mesh position={[6.9, 0.46, -0.55]} material={mat.dark}>
        <boxGeometry args={[1.0, 0.3, 0.7]} />
      </mesh>
      {[9.7, 10.1].map((x) => (
        <mesh key={x} position={[x, 0.44, -0.6]} rotation-x={Math.PI / 2} material={mat.tank}>
          <cylinderGeometry args={[0.12, 0.12, 0.7, 16]} />
        </mesh>
      ))}
      <Bar a={[11.3, 0.4, 0.8]} b={[11.8, 0.38, 1.0]} r={0.045} material={mat.steel} />

      {/* ================= everything paired: left, and right through a mirror ================= */}
      {[1, -1].map((side) => (
        <group key={side} scale={[1, 1, side]}>
          {[AXLES.front, AXLES.rear].map((ax) => (
            <mesh key={ax} geometry={geo.arch} position={[ax, 0, 0]} material={mat.arch} />
          ))}
          <Wheel position={[AXLES.front, WHEEL.R, WHEEL.zOuter]} side={1} geo={geo} mat={mat} />
          <Wheel position={[AXLES.rear, WHEEL.R, WHEEL.zOuter]} side={1} geo={geo} mat={mat} />
          <Wheel position={[AXLES.rear, WHEEL.R, WHEEL.zInner]} side={-1} geo={geo} mat={mat} dish={false} />
          {/* the mirror arm from the windscreen corner, and the head on it */}
          <mesh geometry={geo.arm} material={mat.dark} castShadow />
          <group position={MIRROR_HEAD(1).toArray()}>
            <RoundedBox args={[0.1, 0.46, 0.24]} radius={0.03} smoothness={3} material={mat.dark} castShadow />
            <mesh position-x={0.052} rotation-y={Math.PI / 2} material={mat.mirror}>
              <planeGeometry args={[0.2, 0.4]} />
            </mesh>
          </group>
          {/* wiper */}
          <Bar a={facePoint(true, 0.5 - 0.3, 0.33).add(new THREE.Vector3(-0.03, 0, 0)).toArray()} b={facePoint(true, 0.5 - 0.1, 0.72).add(new THREE.Vector3(-0.03, 0, 0)).toArray()} r={0.012} material={mat.dark} />
        </group>
      ))}

      {/* ================= roof: air conditioning, hatches, aerial ================= */}
      <RoundedBox args={[2.4, 0.3, 1.9]} radius={0.06} smoothness={3} position={[6.3, ROOF + 0.13, 0]} material={mat.white} castShadow />
      {[3.37, 9.37].map((x) => (
        <RoundedBox key={x} args={[0.7, 0.05, 0.7]} radius={0.02} smoothness={2} position={[x, ROOF + 0.02, 0]} material={mat.white} />
      ))}
      <mesh position={[1.4, ROOF + 0.06, 0.6]} material={mat.dark}>
        <boxGeometry args={[0.3, 0.1, 0.1]} />
      </mesh>

      {/* ================= lamps and plates ================= */}
      {lamps.map((l, i) => (
        <group key={i}>
          <mesh position={l.p.toArray()} rotation-y={l.kind === 'head' ? -Math.PI / 2 : Math.PI / 2} material={l.kind === 'head' ? mat.head : mat.tail}>
            <circleGeometry args={[l.size * 0.09, 20]} />
          </mesh>
          <sprite position={l.p.clone().add(new THREE.Vector3(l.kind === 'head' ? -0.06 : 0.06, 0, 0)).toArray()} scale={[l.size, l.size, 1]} ref={(g) => (glowRefs.current[i] = g)}>
            <spriteMaterial map={tex.glow} color={l.color} blending={THREE.AdditiveBlending} depthWrite={false} transparent opacity={0} />
          </sprite>
        </group>
      ))}
      <mesh position={facePoint(true, 0.5, 0.07).add(new THREE.Vector3(-0.01, 0, 0)).toArray()} rotation-y={-Math.PI / 2} material={mat.plate}>
        <planeGeometry args={[0.52, 0.12]} />
      </mesh>
      <mesh position={facePoint(false, 0.5, 0.07).add(new THREE.Vector3(0.01, 0, 0)).toArray()} rotation-y={Math.PI / 2} material={mat.plate}>
        <planeGeometry args={[0.52, 0.12]} />
      </mesh>
    </group>
  )
}
