import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import {
  ARCH_R,
  FRONT_AXLE,
  NOSE,
  REAR_AXLE,
  TAIL,
  WHEELBASE,
  WHEEL_R,
  WHEEL_Z,
  bodyGeometries,
  sideAt,
  topAt,
  tyreGeometry,
} from './geometry.js'
import { useDriveRig } from '../pickup/drive.js'
import { groundOcclusion } from '../pickup/textures.js'

// Drive tuning for the pickup's shared rig: lighter, quicker, more grip.
const DRIVE = {
  wheelbase: WHEELBASE,
  wheelR: WHEEL_R,
  maxSpeed: 34, // m/s (~120 km/h)
  maxReverse: 6,
  accel: 11,
  reverseAccel: 5,
  steerLock: 0.58,
  arena: 70,
  camHeight: 0.55,
  camDist: (aspect) => Math.max(9, 9.6 / aspect),
}

// Footprint for the cones (half length / half width).
export const RACE_CAR_FOOTPRINT = { halfL: 2.4, halfW: 1.02 }

// "#07"-style race number, white on transparent.
function numberTexture(text) {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 256
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = 'italic 900 160px "Arial Black", Impact, system-ui, sans-serif'
  ctx.fillText(`#${text}`, 256, 136)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

// Wheel: position -> steer (y) -> flip for the left side -> spin (z).
function Wheel({ position, flip, geo, mats, spin, steer }) {
  return (
    <group position={position}>
      <group ref={steer}>
        <group rotation={[0, flip ? Math.PI : 0, 0]}>
          <group ref={spin}>
            <mesh geometry={geo.tyre} material={mats.tyre} rotation={[Math.PI / 2, 0, 0]} castShadow />
            {/* Dished rim: a 10-sided barrel, five flat spokes and a centre nut */}
            <mesh material={mats.rim} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.02]}>
              <cylinderGeometry args={[0.225, 0.225, 0.2, 10, 1, true]} />
            </mesh>
            <mesh material={mats.rimDark} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.02]}>
              <cylinderGeometry args={[0.222, 0.222, 0.02, 10]} />
            </mesh>
            {[0, 1, 2, 3, 4].map((i) => (
              <mesh key={i} material={mats.rim} rotation={[0, 0, (i / 5) * Math.PI * 2]} position={[0, 0, 0.1]}>
                <boxGeometry args={[0.05, 0.42, 0.03]} />
              </mesh>
            ))}
            <mesh material={mats.nut} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.12]}>
              <cylinderGeometry args={[0.045, 0.055, 0.05, 6]} />
            </mesh>
            {/* Brake disc and calliper peeking through the spokes */}
            <mesh material={mats.disc} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.0]}>
              <cylinderGeometry args={[0.18, 0.18, 0.025, 12]} />
            </mesh>
          </group>
          <mesh material={mats.calliper} position={[-0.12, 0.1, 0.04]} rotation={[0, 0, 0.7]}>
            <boxGeometry args={[0.08, 0.16, 0.06]} />
          </mesh>
        </group>
      </group>
    </group>
  )
}

function Box({ from, to, material, ...rest }) {
  const size = [to[0] - from[0], to[1] - from[1], to[2] - from[2]]
  const pos = [(to[0] + from[0]) / 2, (to[1] + from[1]) / 2, (to[2] + from[2]) / 2]
  return (
    <mesh position={pos} material={material} castShadow {...rest}>
      <boxGeometry args={size} />
    </mesh>
  )
}

// lightsOn: headlights / tail bar. autoRotate: slow turntable when parked.
// drivable: W A S D / arrow-key driving (the Pickup's rig). color: the paint.
export default function RaceCar({
  lightsOn = true,
  autoRotate = true,
  bounce = 0,
  drivable = false,
  color = '#c8141e',
  number = '07',
  drive, // optional overrides of the drive tuning, e.g. a bigger arena or a surface
}) {
  const yawRef = useRef()
  const bodyRef = useRef()
  const wheelSpins = [useRef(), useRef(), useRef(), useRef()]
  const frontSteer = [useRef(), useRef()]

  const ao = useMemo(groundOcclusion, [])
  const numTex = useMemo(() => numberTexture(number), [number])
  useEffect(() => () => numTex.dispose(), [numTex])

  const mats = useMemo(() => {
    const flat = (o) => new THREE.MeshStandardMaterial({ flatShading: true, ...o })
    return {
      paint: flat({ color: '#c8141e', roughness: 0.42, metalness: 0.08, envMapIntensity: 0.9 }),
      glass: flat({ color: '#1b2029', roughness: 0.08, metalness: 0.7, envMapIntensity: 1.4 }),
      trim: flat({ color: '#1c1d21', roughness: 0.62, metalness: 0.1 }),
      under: flat({ color: '#121315', roughness: 0.9 }),
      well: flat({ color: '#0b0b0d', roughness: 0.95, side: THREE.DoubleSide }),
      tyre: flat({ color: '#18191b', roughness: 0.9, side: THREE.DoubleSide }),
      rim: flat({ color: '#26282d', roughness: 0.35, metalness: 0.6, side: THREE.DoubleSide }),
      rimDark: flat({ color: '#101113', roughness: 0.6 }),
      nut: flat({ color: '#9aa0a8', roughness: 0.3, metalness: 0.9 }),
      disc: flat({ color: '#5a5e64', roughness: 0.4, metalness: 0.8 }),
      calliper: flat({ color: '#e8e8e8', roughness: 0.4 }),
      chrome: flat({ color: '#c9ced4', roughness: 0.2, metalness: 1, side: THREE.DoubleSide }),
      mirror: flat({ color: '#9fb0c2', roughness: 0.05, metalness: 1 }),
      decal: new THREE.MeshStandardMaterial({ map: numTex, transparent: true, roughness: 0.45, polygonOffset: true, polygonOffsetFactor: -2 }),
      // toneMapped: false lets the lamps go brighter than white so bloom picks them up.
      lightWhite: new THREE.MeshBasicMaterial({ color: new THREE.Color(8, 8.4, 9.2), toneMapped: false }),
      lightRed: new THREE.MeshBasicMaterial({ color: new THREE.Color(24, 1.8, 0.8), toneMapped: false }),
    }
  }, [numTex])
  useEffect(() => {
    mats.paint.color.set(color)
  }, [mats, color])
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats])
  useEffect(() => () => ao.dispose(), [ao])

  const geo = useMemo(() => ({ ...bodyGeometries(), tyre: tyreGeometry() }), [])
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
    cfg: drive ? { ...DRIVE, ...drive } : DRIVE,
    drivable,
    autoRotate,
    bounce,
    lightsOn,
    yawRef,
    bodyRef,
    wheelSpins,
    frontSteer,
    onFrame: (_, __, { braking, light: L }) => {
      const red = braking ? 2.2 : 1
      mats.lightWhite.color.setRGB(0.3 + 7.7 * L, 0.3 + 8.1 * L, 0.32 + 8.9 * L)
      mats.lightRed.color.setRGB((0.25 + 23.75 * L) * red, (0.03 + 1.77 * L) * red, (0.02 + 0.78 * L) * red)
      headlight.current.intensity = 50 * L
      tailGlow.current.intensity = 5 * L * red
    },
  })

  // Placements read off the body so the parts sit on its faces.
  const door = sideAt(0.02, 0.64)
  const mirrorSide = sideAt(0.74, 0.84)
  const deckY = topAt(-2.06)
  const hoodY = topAt(1.58)

  return (
    <group ref={yawRef}>
      {/* Soft contact darkening under the car */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.003, 0]} renderOrder={-1}>
        <planeGeometry args={[6.0, 3.0]} />
        <meshBasicMaterial map={ao} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      {/* Wheels stay on the ground; the body above rides on the suspension. */}
      <Wheel position={[FRONT_AXLE, WHEEL_R, WHEEL_Z]} geo={geo} mats={mats} spin={wheelSpins[0]} steer={frontSteer[0]} />
      <Wheel position={[REAR_AXLE, WHEEL_R, WHEEL_Z]} geo={geo} mats={mats} spin={wheelSpins[1]} />
      <Wheel position={[FRONT_AXLE, WHEEL_R, -WHEEL_Z]} flip geo={geo} mats={mats} spin={wheelSpins[2]} steer={frontSteer[1]} />
      <Wheel position={[REAR_AXLE, WHEEL_R, -WHEEL_Z]} flip geo={geo} mats={mats} spin={wheelSpins[3]} />

      <group ref={bodyRef}>
        {/* Faceted shell, one mesh per finish */}
        <mesh geometry={geo.paint} material={mats.paint} castShadow receiveShadow />
        <mesh geometry={geo.glass} material={mats.glass} castShadow />
        <mesh geometry={geo.trim} material={mats.trim} castShadow />
        {geo.under && <mesh geometry={geo.under} material={mats.under} />}
        {geo.well && <mesh geometry={geo.well} material={mats.well} />}

        {/* Front splitter with canards */}
        <Box from={[1.9, 0.1, -0.84]} to={[NOSE + 0.04, 0.13, 0.84]} material={mats.trim} />
        {[1, -1].map((s) => (
          <mesh key={`can${s}`} position={[2.12, 0.3, s * 0.86]} rotation={[0, 0, 0.35]} material={mats.trim} castShadow>
            <boxGeometry args={[0.24, 0.02, 0.14]} />
          </mesh>
        ))}

        {/* Side skirts between the arches */}
        {[1, -1].map((s) => (
          <Box key={`sk${s}`} from={[REAR_AXLE + ARCH_R + 0.04, 0.1, s > 0 ? 0.9 : -1.0]} to={[FRONT_AXLE - ARCH_R - 0.04, 0.19, s > 0 ? 1.0 : -0.9]} material={mats.trim} />
        ))}

        {/* Side intakes ahead of the rear wheels */}
        {[1, -1].map((s) => {
          const at = sideAt(-0.66, 0.6)
          return (
            <mesh key={`in${s}`} position={[-0.66, 0.6, s * (at.z + 0.004)]} rotation={[s * at.tilt, s > 0 ? 0 : Math.PI, 0]} material={mats.trim}>
              <shapeGeometry args={[intakeShape(s < 0)]} />
            </mesh>
          )
        })}

        {/* Race numbers on both doors */}
        <mesh position={[0.02, 0.64, door.z + 0.006]} rotation={[door.tilt, 0, 0]} material={mats.decal}>
          <planeGeometry args={[0.92, 0.46]} />
        </mesh>
        <group rotation={[0, Math.PI, 0]}>
          <mesh position={[-0.02, 0.64, door.z + 0.006]} rotation={[door.tilt, 0, 0]} material={mats.decal}>
            <planeGeometry args={[0.92, 0.46]} />
          </mesh>
        </group>

        {/* Bonnet vents */}
        {[1, -1].map((s) => (
          <mesh key={`v${s}`} position={[1.58, hoodY + 0.022, s * 0.3]} rotation={[0, 0, -0.19]} material={mats.under}>
            <boxGeometry args={[0.34, 0.03, 0.24]} />
          </mesh>
        ))}

        {/* Side mirrors on short stalks */}
        {[1, -1].map((s) => (
          <group key={`m${s}`} position={[0.74, 0.97, s * (mirrorSide.z + 0.1)]}>
            <mesh material={mats.trim} castShadow>
              <boxGeometry args={[0.16, 0.1, 0.17]} />
            </mesh>
            <mesh position={[-0.082, 0, 0]} rotation={[0, -Math.PI / 2, 0]} material={mats.mirror}>
              <planeGeometry args={[0.13, 0.07]} />
            </mesh>
            <mesh position={[0.02, -0.07, -s * 0.07]} material={mats.trim}>
              <boxGeometry args={[0.06, 0.1, 0.04]} />
            </mesh>
          </group>
        ))}

        {/* Rear wing: two swan-neck posts, an angled plane and end plates */}
        {[1, -1].map((s) => (
          <mesh key={`p${s}`} position={[-2.08, deckY + 0.17, s * 0.42]} rotation={[0, 0, 0.18]} material={mats.trim} castShadow>
            <boxGeometry args={[0.13, 0.38, 0.03]} />
          </mesh>
        ))}
        <mesh position={[-2.14, deckY + 0.37, 0]} rotation={[0, 0, -0.12]} material={mats.trim} castShadow>
          <boxGeometry args={[0.36, 0.035, 1.98]} />
        </mesh>
        {[1, -1].map((s) => (
          <mesh key={`e${s}`} position={[-2.14, deckY + 0.33, s * 1.0]} material={mats.trim} castShadow>
            <boxGeometry args={[0.5, 0.24, 0.025]} />
          </mesh>
        ))}

        {/* Rear diffuser fins and twin exhausts */}
        {[-0.54, -0.27, 0, 0.27, 0.54].map((z) => (
          <Box key={`f${z}`} from={[TAIL - 0.04, 0.16, z - 0.012]} to={[TAIL + 0.4, 0.34, z + 0.012]} material={mats.trim} />
        ))}
        {[1, -1].map((s) => (
          <group key={`x${s}`} position={[TAIL - 0.03, 0.44, s * 0.36]} rotation={[0, 0, Math.PI / 2]}>
            <mesh material={mats.chrome}>
              <cylinderGeometry args={[0.055, 0.055, 0.12, 8, 1, true]} />
            </mesh>
            <mesh position={[0, 0.03, 0]} material={mats.under}>
              <cylinderGeometry args={[0.045, 0.045, 0.01, 8]} />
            </mesh>
          </group>
        ))}

        {/* Headlights: slim slanted blades on the nose, plus a beam that lights the floor */}
        {[1, -1].map((s) => (
          <mesh key={`h${s}`} position={[2.07, 0.655, s * 0.76]} rotation={[s * 0.08, s * 0.32, -0.44]} material={mats.lightWhite}>
            <boxGeometry args={[0.24, 0.025, 0.11]} />
          </mesh>
        ))}
        <spotLight ref={headlight} position={[NOSE + 0.05, 0.6, 0]} angle={0.75} penumbra={0.9} distance={14} decay={1.6} color="#e8f0ff" />
        <object3D ref={headTarget} position={[NOSE + 6, -0.6, 0]} />

        {/* Tail light bar with Y-shaped ends, and a red glow on the floor behind */}
        <Box from={[TAIL - 0.02, 0.765, -0.5]} to={[TAIL + 0.01, 0.785, 0.5]} material={mats.lightRed} />
        {[1, -1].map((s) => (
          <group key={`t${s}`}>
            <mesh position={[TAIL - 0.005, 0.745, s * 0.66]} rotation={[s * 0.28, 0, 0]} material={mats.lightRed}>
              <boxGeometry args={[0.03, 0.035, 0.32]} />
            </mesh>
            <mesh position={[TAIL - 0.005, 0.7, s * 0.66]} rotation={[-s * 0.28, 0, 0]} material={mats.lightRed}>
              <boxGeometry args={[0.03, 0.025, 0.3]} />
            </mesh>
          </group>
        ))}
        <spotLight ref={tailGlow} position={[TAIL - 0.08, 0.6, 0]} angle={0.9} penumbra={1} distance={5} decay={1.5} color="#ff2a10" />
        <object3D ref={tailTarget} position={[TAIL - 3, 0, 0]} />
      </group>
    </group>
  )
}

// `mirror` flips it for the left side, whose plane is turned round.
// \`mirror\` flips it for the left side, whose plane is turned round.
function intakeShape(mirror) {
  const m = mirror ? -1 : 1
  const s = new THREE.Shape()
  const pts = [[0.18, 0.1], [-0.16, 0.12], [-0.2, -0.16], [0.04, -0.14]]
  // Keep the winding counter-clockwise so the face points outwards.
  const ordered = mirror ? pts.slice().reverse() : pts
  ordered.forEach(([x, y], i) => (i ? s.lineTo(x * m, y) : s.moveTo(x * m, y)))
  s.closePath()
  return s
}
