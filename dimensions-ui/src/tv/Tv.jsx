import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import Screen from './Screen.jsx'
import Person from './Person.jsx'
import TvTable from './TvTable.jsx'

// Units are inches. A 16:9 screen of diagonal d is (0.8716 d) wide and (0.4903 d) tall.
export const wOf = (d) => d * 0.87157
export const hOf = (d) => d * 0.49027
const BASE = 55 // the panel is modelled at 55 inches and scaled
const W0 = wOf(BASE)
const H0 = hOf(BASE)
const DEPTH = 1.05
const BULGE_BACK = DEPTH / 2 + 0.55 + 0.7 // how far the electronics bulge reaches behind the panel's centre
const PLATE_T = 0.5 // wall bracket thickness
const WALL_Z = -10
const CONSOLE_Z = -2
export const CT = 20 // console top height
const WALL_CENTER_Y = 56 // eye height, for wall mounting
const FLOAT_CENTER_Y = 50 // where a floating TV hangs

// The camera rig reads this to frame the TV as it changes size.
export const tvView = { size: 55, cy: 40, w: wOf(55), h: hOf(55) }

export default function Tv({
  size = 55,
  mount = 'float',
  content = 'home',
  frameColor = '#15161a',
  standColor = '#2b2d33',
  wallpaper = '#3a7bff',
  bezel = 0.45,
  reference = false,
  measure = false,
  table = false,
  wallColor = '#e9e5dd',
  consoleColor = '#9a7550',
}) {
  const showFloor = table || reference || mount === 'feet' || mount === 'pedestal' || mount === 'wall'
  const BASE_Y = table ? CT : 0
  const clamped = Math.min(Math.max(size, 32), 100)

  const slabGeo = useMemo(() => new RoundedBoxGeometry(W0, H0, DEPTH, 4, 0.28), [])
  const bulgeGeo = useMemo(() => new RoundedBoxGeometry(W0 * 0.5, H0 * 0.52, 1.4, 4, 0.3), [])
  const footGeo = useMemo(() => new RoundedBoxGeometry(3.2, 1.0, 11, 3, 0.25), [])
  const baseGeo = useMemo(() => new RoundedBoxGeometry(19, 0.9, 11, 3, 0.3), [])
  useEffect(
    () => () => {
      slabGeo.dispose()
      bulgeGeo.dispose()
      footGeo.dispose()
      baseGeo.dispose()
    },
    [slabGeo, bulgeGeo, footGeo, baseGeo],
  )

  const frameMat = useMemo(() => new THREE.MeshPhysicalMaterial({ color: frameColor, metalness: 0.55, roughness: 0.36, clearcoat: 0.3, clearcoatRoughness: 0.3, envMapIntensity: 1 }), [])
  const standMat = useMemo(() => new THREE.MeshPhysicalMaterial({ color: standColor, metalness: 0.7, roughness: 0.35, envMapIntensity: 1.1 }), [])
  useEffect(
    () => () => {
      frameMat.dispose()
      standMat.dispose()
    },
    [frameMat, standMat],
  )
  const tF = useMemo(() => new THREE.Color(), [])
  const tS = useMemo(() => new THREE.Color(), [])

  // Screen size within the panel, from the bezel thickness (bottom edge is a little deeper)
  const sw = W0 - bezel * 2
  const sh = H0 - bezel * 2.6
  const screenOffsetY = (bezel * 0.6) / 2 - 0 // centre moves up as the chin is thicker

  const panel = useRef()
  const feet = useRef()
  const footL = useRef()
  const footR = useRef()
  const pedestal = useRef()
  const wallMount = useRef()
  const topDim = useRef()
  const topBar = useRef()
  const topTickL = useRef()
  const topTickR = useRef()
  const sideDim = useRef()
  const sideBar = useRef()
  const sideTickT = useRef()
  const sideTickB = useRef()
  const topText = useRef()
  const sideText = useRef()

  const st = useRef({ d: clamped, v: 0, y: 40, z: CONSOLE_Z, feet: 1, ped: 0, wall: 0 })
  const want = useRef({})
  want.current = { size: clamped, mount, measure, base: BASE_Y }

  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 30)
    const s = st.current
    const w = want.current

    // size eases on a lightly damped spring, so dragging the slider feels physical
    s.v += ((w.size - s.d) * 90 - s.v * 13) * dt
    s.d += s.v * dt
    const d = s.d
    const W = wOf(d)
    const H = hOf(d)
    const k = d / BASE

    const by = w.base
    // where the panel sits for the chosen mount
    let bottom
    let zT
    if (w.mount === 'wall') {
      bottom = Math.max(by + 8, WALL_CENTER_Y - H / 2)
      // the bulge hangs just clear of the bracket, which is flat on the wall
      zT = WALL_Z + PLATE_T + BULGE_BACK + 0.05
    } else if (w.mount === 'pedestal') {
      bottom = by + 5.1
      zT = CONSOLE_Z
    } else if (w.mount === 'feet') {
      bottom = by + 3.7
      zT = CONSOLE_Z
    } else {
      // suspended in the air: no stand at all, so it can be seen from every side
      bottom = Math.max(by + 8, FLOAT_CENTER_Y - H / 2)
      zT = CONSOLE_Z
    }
    const yT = bottom + H / 2
    const e = 1 - Math.exp(-dt * 9)
    s.y += (yT - s.y) * e
    s.z += (zT - s.z) * e
    panel.current.scale.set(k, k, 1)
    panel.current.position.set(0, s.y, s.z)

    // stands fade (scale) in and out as the mount changes
    s.feet += ((w.mount === 'feet' ? 1 : 0) - s.feet) * e
    s.ped += ((w.mount === 'pedestal' ? 1 : 0) - s.ped) * e
    s.wall += ((w.mount === 'wall' ? 1 : 0) - s.wall) * e
    feet.current.scale.setScalar(Math.max(s.feet, 0.0001))
    pedestal.current.scale.setScalar(Math.max(s.ped, 0.0001))
    wallMount.current.scale.setScalar(Math.max(s.wall, 0.0001))
    feet.current.position.set(0, by, CONSOLE_Z)
    footL.current.position.x = -W * 0.36
    footR.current.position.x = W * 0.36
    pedestal.current.position.set(0, by, CONSOLE_Z)
    wallMount.current.position.set(0, s.y, WALL_Z + PLATE_T / 2)

    // measuring lines
    const m = w.measure
    topDim.current.visible = m
    sideDim.current.visible = m
    topDim.current.position.set(0, s.y + H / 2 + 4.5, s.z + 0.8)
    topBar.current.scale.x = W
    topTickL.current.position.x = -W / 2
    topTickR.current.position.x = W / 2
    sideDim.current.position.set(W / 2 + 4.5, s.y, s.z + 0.8)
    sideBar.current.scale.y = H
    sideTickT.current.position.y = H / 2
    sideTickB.current.position.y = -H / 2
    if (topText.current) topText.current.textContent = `${W.toFixed(1)}″`
    if (sideText.current) sideText.current.textContent = `${H.toFixed(1)}″`

    tvView.size = d
    tvView.cy = s.y
    tvView.w = W
    tvView.h = H
  })

  // colours ease: nudged each frame towards the wanted values
  const wantC = useRef({})
  wantC.current = { frameColor, standColor }
  useFrame((_, delta) => {
    const e = 1 - Math.exp(-Math.min(delta, 1 / 30) * 6)
    frameMat.color.lerp(tF.set(wantC.current.frameColor), e)
    standMat.color.lerp(tS.set(wantC.current.standColor), e)
  })

  const wall = useMemo(() => new THREE.Color(wallColor), [wallColor])
  const floorColor = useMemo(() => `#${wall.clone().multiplyScalar(0.86).getHexString()}`, [wall])
  const accent = '#ff4d1a'
  const dimMat = <meshBasicMaterial color={accent} toneMapped={false} />
  const chip = {
    background: '#efece4',
    color: accent,
    font: '500 12px/1 ui-monospace, Menlo, monospace',
    letterSpacing: '0.06em',
    padding: '3px 8px',
    whiteSpace: 'nowrap',
    pointerEvents: 'none',
    userSelect: 'none',
    border: `1px solid ${accent}`,
    borderRadius: 3,
  }

  return (
    <group>
      {showFloor && (
        <mesh rotation-x={-Math.PI / 2} receiveShadow>
          <planeGeometry args={[520, 260]} />
          <meshStandardMaterial color={floorColor} roughness={0.9} />
        </mesh>
      )}
      {table && <TvTable color={consoleColor} z={CONSOLE_Z} />}
      {mount === 'wall' && (
        <>
          <mesh position={[0, 70, WALL_Z - 0.2]} receiveShadow>
            <planeGeometry args={[520, 160]} />
            <meshStandardMaterial color={wallColor} roughness={0.95} />
          </mesh>
          <mesh position={[0, 2.5, WALL_Z - 0.1]}>
            <boxGeometry args={[520, 5, 0.4]} />
            <meshStandardMaterial color="#f4f1ea" roughness={0.7} />
          </mesh>
        </>
      )}

      {/* the TV: panel, scaled to the chosen size */}
      <group ref={panel}>
        <mesh geometry={slabGeo} material={frameMat} castShadow />
        <mesh geometry={bulgeGeo} material={frameMat} position={[0, -H0 * 0.07, -DEPTH / 2 - 0.55]} castShadow />
        <group position={[0, screenOffsetY, DEPTH / 2 + 0.004]}>
          <Screen width={sw} height={sh} wallpaper={wallpaper} content={content} />
        </group>
        {/* glass over the whole front, for reflections */}
        <mesh position={[0, 0, DEPTH / 2 + 0.012]}>
          <planeGeometry args={[W0 - 0.1, H0 - 0.1]} />
          <meshPhysicalMaterial color="#ffffff" transparent opacity={0.04} roughness={0.05} clearcoat={1} clearcoatRoughness={0.08} envMapIntensity={0.6} depthWrite={false} />
        </mesh>
        {/* a small indicator light */}
        <mesh position={[0, -H0 / 2 + bezel * 0.8, DEPTH / 2 + 0.01]}>
          <circleGeometry args={[0.12, 12]} />
          <meshBasicMaterial color={content === 'off' ? '#ff4d1a' : '#2a2c30'} toneMapped={false} />
        </mesh>
      </group>

      {/* mounts */}
      <group ref={feet}>
        {[footL, footR].map((r, i) => (
          <group key={i} ref={r}>
            <mesh geometry={footGeo} material={standMat} position={[0, 0.5, 0]} castShadow />
            {/* the neck joins the foot to the panel */}
            <mesh material={standMat} position={[0, 2.4, 0]} castShadow>
              <boxGeometry args={[2.2, 2.9, 0.9]} />
            </mesh>
          </group>
        ))}
      </group>
      <group ref={pedestal}>
        <mesh geometry={baseGeo} material={standMat} position={[0, 0.45, 0]} castShadow />
        <mesh position={[0, 3.0, 0]} castShadow material={standMat}>
          <boxGeometry args={[3.4, 4.3, 1.4]} />
        </mesh>
      </group>
      {/* wall bracket: a plate on the wall and an arm out to the panel's back */}
      <group ref={wallMount}>
        <mesh material={standMat} castShadow>
          <boxGeometry args={[11, 7.5, PLATE_T]} />
        </mesh>
        <mesh material={standMat} position={[0, 0, PLATE_T / 2 + 0.3]} castShadow>
          <boxGeometry args={[7, 4.5, 0.6]} />
        </mesh>
      </group>

      {/* measuring lines: the screen's width and height */}
      <group ref={topDim}>
        <mesh ref={topBar}>
          <boxGeometry args={[1, 0.14, 0.14]} />
          {dimMat}
        </mesh>
        <mesh ref={topTickL}>
          <boxGeometry args={[0.14, 1.8, 0.14]} />
          {dimMat}
        </mesh>
        <mesh ref={topTickR}>
          <boxGeometry args={[0.14, 1.8, 0.14]} />
          {dimMat}
        </mesh>
        {measure && (
          <Html center position={[0, 2.6, 0]} zIndexRange={[5, 0]} style={chip}>
            <span ref={topText}>0″</span>
          </Html>
        )}
      </group>
      <group ref={sideDim}>
        <mesh ref={sideBar}>
          <boxGeometry args={[0.14, 1, 0.14]} />
          {dimMat}
        </mesh>
        <mesh ref={sideTickT}>
          <boxGeometry args={[1.8, 0.14, 0.14]} />
          {dimMat}
        </mesh>
        <mesh ref={sideTickB}>
          <boxGeometry args={[1.8, 0.14, 0.14]} />
          {dimMat}
        </mesh>
        {measure && (
          <Html center position={[5.2, 0, 0]} zIndexRange={[5, 0]} style={chip}>
            <span ref={sideText}>0″</span>
          </Html>
        )}
      </group>

      {reference && (
        <group position={[74, 0, 3]}>
          <Person />
          <Html center position={[0, 74, 0]} zIndexRange={[5, 0]} style={{ ...chip, color: '#5a6068', border: '1px solid #b8b3a8', background: '#efece4' }}>
            5′9″ person
          </Html>
        </group>
      )}
      <pointLight position={[0, 40, 40]} intensity={content === 'off' ? 0 : clamped * clamped * 0.18} distance={160} decay={2} color={wallpaper} />
    </group>
  )
}
