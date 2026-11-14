import { useEffect, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { ContactShadows, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { CameraRig, Dim, Effects, FOV, InfoHint, Studio, TAN as T, ViewTabs } from '../gameboard/stage.jsx'
import { CUPS, FOOTREST, LEG_X, R, TABLE, TRAY } from './layout.js'
import PokerTable from './Table.jsx'

// The poker table on the board models' studio, at full size on a floor (as
// the roulette table is): the views of the reference sheet and its close-ups.

const V = (x, y, z) => new THREE.Vector3(x, y, z)
const BG = '#c6c7c5'
const { H } = TABLE
const X = TABLE.len / 2
const MID = V(0, 0.42, 0)

// far enough back to hold a box w wide and h tall (half sizes) in view
const fit = (w, h, a) => Math.max(w / (T * a), h / T) * 1.1
// side on, from a little above the cloth: w is half the width seen, reach how far the table comes towards the camera
const elevation = (dir, w, reach) => (a) => ({ pos: MID.clone().addScaledVector(dir, fit(w, 0.58, a) + reach).setY(0.95), target: MID.clone() })
const corner = (sx, sz) => (a) => ({ pos: MID.clone().addScaledVector(V(sx * 0.62, 0.52, sz * 0.78).normalize(), fit(1.42, 0.85, a) + 0.3), target: MID.clone() })
const near = (a) => Math.max(1, 1 / a)
// the cup holder nearest the middle of the front
const CUP = CUPS.reduce((best, c) => (c.z - Math.abs(c.x) > best.z - Math.abs(best.x) ? c : best))
const VIEWS = {
  Top: (a) => ({ pos: V(0, H + fit(X + 0.08, R + 0.08, a), 0.001), target: V(0, H, 0) }),
  Front: elevation(V(0, 0, 1), X + 0.08, R),
  Rear: elevation(V(0, 0, -1), X + 0.08, R),
  Left: elevation(V(-1, 0, 0), R + 0.08, X),
  Right: elevation(V(1, 0, 0), R + 0.08, X),
  'Front-L': corner(-1, 1),
  'Front-R': corner(1, 1),
  Rail: (a) => {
    const k = near(a)
    return { pos: V(CUP.x + 0.2 * k, H + 0.3 * k, CUP.z + 0.3 * k), target: V(CUP.x - 0.02, H + 0.02, CUP.z - 0.03) }
  },
  Dealer: (a) => {
    const k = near(a)
    return { pos: V(TRAY.x - 0.34 * k, H + 0.42 * k, TRAY.z + 0.62 * k), target: V(TRAY.x - 0.03, H, TRAY.z) }
  },
  Base: (a) => {
    const k = near(a)
    return { pos: V(-LEG_X - 0.75 * k, 0.5 * k, 1.25 * k), target: V(-LEG_X - 0.02, 0.2, 0.2) }
  },
}
const MAIN = ['Top', 'Front-L', 'Front-R', 'Front', 'Rear', 'Left', 'Right']
const DETAIL = ['Rail', 'Dealer', 'Base']

function Dimensions() {
  const cm = (m) => `${Math.round(m * 100)} cm`
  return (
    <group>
      <Dim a={[-X, 0.002, R + 0.22]} b={[X, 0.002, R + 0.22]} tick={[0, 0, 0.04]} label={cm(TABLE.len)} />
      <Dim a={[X + 0.22, 0.002, -R]} b={[X + 0.22, 0.002, R]} tick={[0.04, 0, 0]} label={cm(TABLE.wid)} />
      <Dim a={[X + 0.1, 0, R + 0.1]} b={[X + 0.1, H + TABLE.padH, R + 0.1]} tick={[0.03, 0, 0.03]} label={`rail ${cm(H + TABLE.padH)}`} />
      <Dim a={[-X, H + 0.14, 0]} b={[-X + TABLE.railW, H + 0.14, 0]} tick={[0, 0.02, 0]} label={`rail ${cm(TABLE.railW)}`} />
      <Dim a={[-FOOTREST.l - FOOTREST.r, 0.002, -R - 0.22]} b={[FOOTREST.l + FOOTREST.r, 0.002, -R - 0.22]} tick={[0, 0, 0.04]} label={`foot rail ${cm(2 * (FOOTREST.l + FOOTREST.r))}`} />
    </group>
  )
}

export default function PokerScene({ feltColor = '#0c6a34', woodColor = '#74301c', leatherColor = '#17171a', metalColor = '#c9a557', lineColor = '#d8b24a', chips = false, dimensions = false, ambientOcclusion = true, autoRotate = false, view: initialView = 'Front-L' }) {
  const [view, setView] = useState(initialView)
  useEffect(() => setView(initialView), [initialView])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none', background: BG }}>
      <Canvas frameloop={autoRotate ? 'always' : 'demand'} shadows dpr={[1, 1.75]} camera={{ position: [-3, 2.4, 3.4], fov: FOV, near: 0.03, far: 80 }} gl={{ antialias: false, powerPreference: 'high-performance' }}>
        <color attach="background" args={[BG]} />
        <hemisphereLight args={['#ffffff', '#8a8780', 0.3]} />
        <directionalLight position={[-1.5, 3.4, 2.1]} intensity={2.2} color="#fff6ea" castShadow shadow-mapSize={[4096, 4096]} shadow-bias={-0.0002} shadow-normalBias={0.004}>
          <orthographicCamera attach="shadow-camera" args={[-2.1, 2.1, 2.1, -2.1, 0.5, 9]} />
        </directionalLight>
        {/* a soft fill from behind, so the far side is not left in the dark */}
        <directionalLight position={[2, 1.6, -2.6]} intensity={0.55} color="#eef2ff" />
        <Studio />
        <mesh rotation-x={-Math.PI / 2} position-y={-0.001} receiveShadow>
          <planeGeometry args={[60, 60]} />
          <shadowMaterial opacity={0.26} />
        </mesh>
        <ContactShadows position={[0, 0.002, 0]} scale={5} resolution={1024} blur={2.6} far={1} opacity={0.42} color="#101113" frames={1} />
        <PokerTable feltColor={feltColor} woodColor={woodColor} leatherColor={leatherColor} metalColor={metalColor} lineColor={lineColor} chips={chips} />
        {dimensions && <Dimensions />}
        <CameraRig view={view} views={VIEWS} fallback="Front-L" />
        <OrbitControls makeDefault enablePan={false} autoRotate={autoRotate} autoRotateSpeed={0.5} minDistance={0.25} maxDistance={12} maxPolarAngle={1.54} />
        <Effects ao={ambientOcclusion} radius={0.08} />
      </Canvas>

      <ViewTabs main={MAIN} detail={DETAIL} view={view} setView={setView} />
      <InfoHint>
        A full-size ten-seat poker table, built from the roulette table&apos;s parts: the same baize, pebbled leather and chips. A padded arm rail with a sewn seam and a steel cup holder per seat, a polished racetrack, the dealer&apos;s cut-out with a chip tray and drop slot, and octagonal pedestals inside a brass foot rail · pick a view or a close-up, or drag to orbit and scroll in · turn on chips to fill the dealer&apos;s tray
      </InfoHint>
    </div>
  )
}
