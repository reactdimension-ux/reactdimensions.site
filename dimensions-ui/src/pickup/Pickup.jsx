import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import {
  BELT,
  FRONT,
  FRONT_AXLE,
  HALF_W,
  REAR,
  REAR_AXLE,
  SILL,
  STATIONS,
  bumperGeometry,
  topline,
  WHEEL_R,
  cabinFaces,
  cabinGeometry,
  flareGeometry,
  insetPanel,
  lowerBodyGeometry,
  polysGeometry,
  tyreGeometry,
} from './geometry.js'
import { useDriveRig } from './drive.js'
import { brushedSteel, groundOcclusion, plasticBump, slats, treadBump, wheelCover } from './textures.js'

const WHEEL_Z = HALF_W - 0.12
const WHEELBASE = FRONT_AXLE - REAR_AXLE
// Drive tuning for the shared rig in drive.js.
const DRIVE = {
  wheelbase: WHEELBASE,
  wheelR: WHEEL_R,
  maxSpeed: 22, // m/s (~80 km/h)
  maxReverse: 6,
  accel: 7.5,
  reverseAccel: 4.5,
  steerLock: 0.62,
  arena: 70,
  camHeight: 0.75,
  camDist: (aspect) => Math.max(10.5, 11 / aspect),
}

// Wheel: position -> steer (y) -> flip for the left side -> spin (z).
function Wheel({ position, flip, geo, mats, spin, steer }) {
  return (
    <group position={position}>
      <group ref={steer}>
        <group rotation={[0, flip ? Math.PI : 0, 0]}>
          <group ref={spin}>
            <mesh geometry={geo.tyre} material={mats.tyre} castShadow />
            {/* Aero cover sits on the outboard face */}
            <mesh geometry={geo.cover} material={mats.cover} position={[0, 0, 0.14]} rotation={[Math.PI / 2, 0, 0]} />
            {/* Dark wheel centre behind the cover */}
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.31, 0.31, 0.26, 32, 1, true]} />
              <meshStandardMaterial color="#0d0e10" roughness={0.8} side={THREE.DoubleSide} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  )
}

function Box({ from, to, material }) {
  const size = [to[0] - from[0], to[1] - from[1], to[2] - from[2]]
  const pos = [(to[0] + from[0]) / 2, (to[1] + from[1]) / 2, (to[2] + from[2]) / 2]
  return (
    <mesh position={pos} material={material} castShadow>
      <boxGeometry args={size} />
    </mesh>
  )
}

// lightsOn: headlight / tail bars. autoRotate: slow turntable when parked.
// drivable: enables WASD / arrow-key driving. color / roughness: the steel finish.
export default function Pickup({
  lightsOn = true,
  autoRotate = true,
  bounce = 0,
  drivable = false,
  color = '#d4d7da',
  roughness = 0.36,
}) {
  const yawRef = useRef()
  const bodyRef = useRef()
  const wheelSpins = [useRef(), useRef(), useRef(), useRef()]
  const frontSteer = [useRef(), useRef()]

  const tex = useMemo(
    () => ({
      steel: brushedSteel(),
      tread: treadBump(),
      cover: wheelCover(),
      slats: slats(),
      plastic: plasticBump(),
      ao: groundOcclusion(),
    }),
    [],
  )

  const mats = useMemo(() => {
    const steel = new THREE.MeshPhysicalMaterial({
      color: '#d4d7da',
      metalness: 1,
      roughness: 0.36,
      roughnessMap: tex.steel,
      anisotropy: 0.55,
      clearcoat: 0.25,
      clearcoatRoughness: 0.25,
      envMapIntensity: 1.25,
      side: THREE.DoubleSide,
    })
    const glass = new THREE.MeshPhysicalMaterial({
      color: '#07090c',
      metalness: 0.1,
      roughness: 0.03,
      ior: 1.52,
      specularIntensity: 1,
      clearcoat: 1,
      clearcoatRoughness: 0.02,
      reflectivity: 1,
      envMapIntensity: 1.6,
      side: THREE.DoubleSide,
    })
    const tonneau = new THREE.MeshPhysicalMaterial({
      color: '#1d2228',
      metalness: 0.6,
      roughness: 0.35,
      bumpMap: tex.slats,
      bumpScale: 2,
      clearcoat: 0.6,
      envMapIntensity: 1.2,
      side: THREE.DoubleSide,
    })
    const plastic = new THREE.MeshStandardMaterial({
      color: '#16171a',
      roughness: 0.85,
      metalness: 0,
      bumpMap: tex.plastic,
      bumpScale: 0.6,
    })
    const tyre = new THREE.MeshStandardMaterial({
      color: '#141414',
      roughness: 0.92,
      bumpMap: tex.tread,
      bumpScale: 6,
    })
    const cover = new THREE.MeshPhysicalMaterial({
      map: tex.cover.color,
      bumpMap: tex.cover.bump,
      bumpScale: 3,
      metalness: 0.5,
      roughness: 0.45,
      clearcoat: 0.5,
    })
    const seam = new THREE.MeshStandardMaterial({ color: '#3a3e44', roughness: 0.5, metalness: 0.6 })
    const well = new THREE.MeshStandardMaterial({ color: '#0c0d0f', roughness: 0.95, side: THREE.DoubleSide })
    const mirror = new THREE.MeshPhysicalMaterial({ color: '#cfd6de', metalness: 1, roughness: 0.02 })
    // toneMapped: false lets the bars go brighter than white so bloom picks them up.
    const lightWhite = new THREE.MeshBasicMaterial({ color: new THREE.Color(8, 8.4, 9.2), toneMapped: false })
    const lightRed = new THREE.MeshBasicMaterial({ color: new THREE.Color(24, 1.8, 0.8), toneMapped: false })
    return { steel, glass, tonneau, plastic, tyre, cover, seam, well, mirror, lightWhite, lightRed }
  }, [tex])

  // Steel finish follows the props without rebuilding materials.
  useEffect(() => {
    mats.steel.color.set(color)
    mats.steel.roughness = roughness
  }, [mats, color, roughness])
  useEffect(
    () => () => {
      Object.values(mats).forEach((m) => m.dispose())
      for (const t of Object.values(tex)) {
        if (t?.isTexture) t.dispose()
        else if (t) Object.values(t).forEach((u) => u?.dispose?.())
      }
    },
    [mats, tex],
  )

  const geo = useMemo(() => {
    // Glass and roof panels, inset from the steel faces so a frame shows.
    const seg1 = cabinFaces(STATIONS[1], STATIONS[2])
    const seg2 = cabinFaces(STATIONS[2], STATIONS[3])
    const seg3 = cabinFaces(STATIONS[3], STATIONS[4])
    const glass = polysGeometry([
      insetPanel(seg1.top, 0.07), // windshield
      insetPanel(seg2.top, 0.06), // glass roof
      insetPanel(seg1.left, 0.06),
      insetPanel(seg1.right, 0.06),
      insetPanel(seg2.left, 0.06),
      insetPanel(seg2.right, 0.06),
    ])
    const tonneau = polysGeometry([insetPanel(seg3.top, 0.05)], (p) => [p.z, p.x * 0.6])
    const [lower, wells] = lowerBodyGeometry()
    return {
      lower,
      wells,
      bumperF: bumperGeometry(FRONT_AXLE + 0.7, FRONT + 0.05, SILL - 0.15, SILL + 0.13, HALF_W + 0.01),
      bumperR: bumperGeometry(-(REAR_AXLE - 0.66), -(REAR - 0.06), SILL - 0.15, SILL + 0.1, HALF_W + 0.01),
      cabin: cabinGeometry(),
      glass,
      tonneau,
      flareF: flareGeometry(FRONT_AXLE),
      flareR: flareGeometry(REAR_AXLE),
      tyre: tyreGeometry(),
      cover: new THREE.CylinderGeometry(0.33, 0.33, 0.03, 64),
    }
  }, [])
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo])

  const headlight = useRef()
  const headTarget = useRef()
  const tailGlow = useRef()
  const tailTarget = useRef()
  useEffect(() => {
    headlight.current.target = headTarget.current
    tailGlow.current.target = tailTarget.current
  }, [])

  useDriveRig({
    cfg: DRIVE,
    drivable,
    autoRotate,
    bounce,
    lightsOn,
    yawRef,
    bodyRef,
    wheelSpins,
    frontSteer,
    onFrame: (_, __, { braking, light: L }) => {
      // Lights follow the rig's warm-up fade. Brake lights flare when slowing.
      const red = braking ? 2.2 : 1
      mats.lightWhite.color.setRGB(0.3 + 7.7 * L, 0.3 + 8.1 * L, 0.32 + 8.9 * L)
      mats.lightRed.color.setRGB((0.25 + 23.75 * L) * red, (0.03 + 1.77 * L) * red, (0.02 + 0.78 * L) * red)
      headlight.current.intensity = 60 * L
      tailGlow.current.intensity = 6 * L * red
    },
  })

  const zOut = HALF_W + 0.002

  return (
    <group ref={yawRef}>
      {/* Soft contact darkening under the truck */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.003, 0]} renderOrder={-1}>
        <planeGeometry args={[7.4, 3.6]} />
        <meshBasicMaterial map={tex.ao} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      {/* Wheels stay on the ground; the body above rides on the suspension. */}
      <Wheel position={[FRONT_AXLE, WHEEL_R, WHEEL_Z]} geo={geo} mats={mats} spin={wheelSpins[0]} steer={frontSteer[0]} />
      <Wheel position={[REAR_AXLE, WHEEL_R, WHEEL_Z]} geo={geo} mats={mats} spin={wheelSpins[1]} />
      <Wheel position={[FRONT_AXLE, WHEEL_R, -WHEEL_Z]} flip geo={geo} mats={mats} spin={wheelSpins[2]} steer={frontSteer[1]} />
      <Wheel position={[REAR_AXLE, WHEEL_R, -WHEEL_Z]} flip geo={geo} mats={mats} spin={wheelSpins[3]} />

      <group ref={bodyRef}>
        <mesh geometry={geo.lower} material={mats.steel} castShadow receiveShadow />
        <mesh geometry={geo.wells} material={mats.well} />
        <mesh geometry={geo.bumperF} material={mats.plastic} castShadow />
        <mesh geometry={geo.bumperR} material={mats.plastic} scale={[-1, 1, 1]} castShadow />
        <mesh geometry={geo.cabin} material={mats.steel} castShadow receiveShadow />
        <mesh geometry={geo.glass} material={mats.glass} />
        <mesh geometry={geo.tonneau} material={mats.tonneau} />

        {/* Fender flares, both sides */}
        {[1, -1].map((side) => (
          <group key={side} scale={[1, 1, side]}>
            <mesh geometry={geo.flareF} material={mats.plastic} position={[0, 0, HALF_W - 0.04]} castShadow />
            <mesh geometry={geo.flareR} material={mats.plastic} position={[0, 0, HALF_W - 0.04]} castShadow />
          </group>
        ))}

        {/* Black sills and bumpers */}
        {[1, -1].map((side) => (
          <Box
            key={side}
            from={[REAR_AXLE + 0.7, SILL - 0.12, side * HALF_W - 0.03]}
            to={[FRONT_AXLE - 0.66, SILL + 0.1, side * HALF_W + 0.03]}
            material={mats.plastic}
          />
        ))}
        <Box from={[REAR_AXLE + 0.6, SILL - 0.16, -HALF_W + 0.1]} to={[FRONT_AXLE - 0.6, SILL, HALF_W - 0.1]} material={mats.plastic} />

        {/* Door seams */}
        {[1.12, -0.24, -1.34].map((x) =>
          [1, -1].map((side) => (
            <Box key={`${x}${side}`} from={[x - 0.004, SILL + 0.1, side * zOut - 0.002]} to={[x + 0.004, BELT - 0.01, side * zOut + 0.002]} material={mats.seam} />
          )),
        )}

        {/* Shoulder crease and tailgate seam */}
        {[1, -1].map((side) => (
          <Box key={`belt${side}`} from={[REAR + 0.02, BELT - 0.016, side * zOut - 0.002]} to={[FRONT - 0.62, BELT - 0.004, side * zOut + 0.003]} material={mats.seam} />
        ))}
        <Box from={[REAR - 0.004, SILL + 0.12, -HALF_W + 0.03]} to={[REAR + 0.002, SILL + 0.126, HALF_W - 0.03]} material={mats.seam} />

        {/* Single long windshield wiper resting at the base of the glass */}
        <mesh position={[1.18, topline(1.18) + 0.025, 0.05]} rotation={[0, 0.06, Math.atan(0.243)]} material={mats.plastic}>
          <boxGeometry args={[0.035, 0.018, 1.55]} />
        </mesh>

        {/* Side mirrors */}
        {[1, -1].map((side) => (
          <group key={`m${side}`} position={[1.15, 1.32, side * (HALF_W + 0.08)]}>
            <mesh material={mats.plastic} castShadow>
              <boxGeometry args={[0.22, 0.12, 0.16]} />
            </mesh>
            <mesh position={[-0.112, 0, 0]} rotation={[0, -Math.PI / 2, 0]} material={mats.mirror}>
              <planeGeometry args={[0.19, 0.09]} />
            </mesh>
            {/* stalk, reaching back into the sloped cabin side */}
            <mesh position={[0.06, -0.02, -side * 0.12]} material={mats.plastic}>
              <boxGeometry args={[0.06, 0.04, 0.18]} />
            </mesh>
          </group>
        ))}

        {/* Headlight beam that actually lights the floor, plus a red glow at the rear */}
        <spotLight
          ref={headlight}
          position={[FRONT + 0.05, 1.03, 0]}
          angle={0.75}
          penumbra={0.9}
          distance={14}
          decay={1.6}
          color="#e8f0ff"
        />
        <object3D ref={headTarget} position={[FRONT + 6, -0.6, 0]} />
        {/* Rear glow aimed at the floor behind, so it doesn't paint the tailgate */}
        <spotLight ref={tailGlow} position={[REAR - 0.08, 0.6, 0]} angle={0.9} penumbra={1} distance={5} decay={1.5} color="#ff2a10" />
        <object3D ref={tailTarget} position={[REAR - 3, 0, 0]} />

        {/* Full-width light bars */}
        <Box from={[FRONT - 0.01, 1.02, -HALF_W + 0.02]} to={[FRONT + 0.012, 1.045, HALF_W - 0.02]} material={mats.lightWhite} />
        <Box from={[REAR - 0.012, BELT - 0.05, -HALF_W + 0.04]} to={[REAR + 0.01, BELT - 0.015, HALF_W - 0.04]} material={mats.lightRed} />
      </group>
    </group>
  )
}
