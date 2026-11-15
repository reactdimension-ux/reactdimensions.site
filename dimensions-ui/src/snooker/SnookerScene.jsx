import { useEffect, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { ContactShadows, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { CameraRig, Dim, Effects, FOV, InfoHint, Studio, TAN as T, ViewTabs } from '../gameboard/stage.jsx'
import { BALL_R, BAULK_X, D_R, LEG_X, LEG_Z, OX, OZ, PLAY, POCKETS, TABLE } from './layout.js'
import SnookerTable from './Table.jsx'

// The snooker table on the board models' studio, at full size on a floor:
// the views of the reference sheet and its two close-ups.

const V = (x, y, z) => new THREE.Vector3(x, y, z)
const BG = '#c6c7c5'
const H = TABLE.bed
const MID = V(0, 0.45, 0)
const TOP = H + TABLE.railTop

// far enough back to hold a box w wide and h tall (half sizes) in view
const fit = (w, h, a) => Math.max(w / (T * a), h / T) * 1.1
// side on, from a little above the cloth: w is half the width seen, reach how far the table comes towards the camera
const elevation = (dir, w, reach) => (a) => ({ pos: MID.clone().addScaledVector(dir, fit(w, 0.6, a) + reach).setY(1.15), target: MID.clone() })
const corner = (sx, sz) => (a) => ({ pos: MID.clone().addScaledVector(V(sx * 0.7, 0.55, sz * 0.75).normalize(), fit(2.1, 1.0, a) + 0.4), target: MID.clone() })
const near = (a) => Math.max(1, 1 / a)
const CP = POCKETS.find((p) => p.corner && p.sx > 0 && p.sz > 0)
const VIEWS = {
  Top: (a) => ({ pos: V(0, TOP + fit(OX + 0.1, OZ + 0.1, a), 0.001), target: V(0, TOP, 0) }),
  'Front-L': corner(-1, 1),
  'Front-R': corner(1, 1),
  Front: elevation(V(0, 0, 1), OX + 0.1, OZ),
  Rear: elevation(V(0, 0, -1), OX + 0.1, OZ),
  Left: elevation(V(-1, 0, 0), OZ + 0.1, OX),
  Right: elevation(V(1, 0, 0), OZ + 0.1, OX),
  Pocket: (a) => {
    const k = near(a)
    return { pos: V(CP.x - 0.16 * k, TOP + 0.26 * k, CP.z + 0.36 * k), target: V(CP.x - 0.04, TOP - 0.02, CP.z - 0.03) }
  },
  Leg: (a) => {
    const k = near(a)
    return { pos: V(LEG_X[0] - 0.55 * k, 0.5 * k, LEG_Z + 0.95 * k), target: V(LEG_X[0] + 0.1, 0.32, LEG_Z - 0.1) }
  },
}
const MAIN = ['Top', 'Front-L', 'Front-R', 'Front', 'Rear', 'Left', 'Right']
const DETAIL = ['Pocket', 'Leg']

function Dimensions() {
  const cm = (m) => `${Math.round(m * 100)} cm`
  const mm = (m) => `${Math.round(m * 1000)} mm`
  return (
    <group>
      <Dim a={[-OX, 0.002, OZ + 0.25]} b={[OX, 0.002, OZ + 0.25]} tick={[0, 0, 0.04]} label={cm(OX * 2)} />
      <Dim a={[OX + 0.25, 0.002, -OZ]} b={[OX + 0.25, 0.002, OZ]} tick={[0.04, 0, 0]} label={cm(OZ * 2)} />
      <Dim a={[-PLAY.len / 2, TOP + 0.12, -OZ - 0.05]} b={[PLAY.len / 2, TOP + 0.12, -OZ - 0.05]} tick={[0, 0.03, 0]} label={`playing area ${mm(PLAY.len)}`} />
      <Dim a={[OX + 0.1, 0, OZ + 0.1]} b={[OX + 0.1, TOP, OZ + 0.1]} tick={[0.03, 0, 0.03]} label={`rail ${cm(TOP)}`} />
      <Dim a={[-PLAY.len / 2, TOP + 0.06, 0.6]} b={[BAULK_X, TOP + 0.06, 0.6]} tick={[0, 0.02, 0]} label={`baulk ${mm(BAULK_X + PLAY.len / 2)}`} />
      <Dim a={[BAULK_X, TOP + 0.06, -0.1]} b={[BAULK_X - D_R, TOP + 0.06, -0.1]} tick={[0, 0.02, 0]} label={`D ${mm(D_R)}`} />
      <Dim a={[0.5, TOP + 0.02, 0.3]} b={[0.5 + BALL_R * 2, TOP + 0.02, 0.3]} tick={[0, 0.01, 0]} label={`ball ${mm(BALL_R * 2)}`} />
    </group>
  )
}

export default function SnookerScene({ feltColor = '#1a7a2e', woodColor = '#6e3419', leatherColor = '#b98a5a', metalColor = '#c9a557', lineColor = '#e9e6dc', balls = true, dimensions = false, ambientOcclusion = true, autoRotate = false, view: initialView = 'Front-L' }) {
  const [view, setView] = useState(initialView)
  useEffect(() => setView(initialView), [initialView])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none', background: BG }}>
      <Canvas frameloop={autoRotate ? 'always' : 'demand'} shadows dpr={[1, 1.75]} camera={{ position: [-3.5, 2.6, 4], fov: FOV, near: 0.03, far: 80 }} gl={{ antialias: false, powerPreference: 'high-performance' }}>
        <color attach="background" args={[BG]} />
        <hemisphereLight args={['#ffffff', '#8a8780', 0.3]} />
        <directionalLight position={[-1.5, 4.2, 2.4]} intensity={2.2} color="#fff6ea" castShadow shadow-mapSize={[4096, 4096]} shadow-bias={-0.0002} shadow-normalBias={0.004}>
          <orthographicCamera attach="shadow-camera" args={[-2.6, 2.6, 2.6, -2.6, 0.5, 10]} />
        </directionalLight>
        <directionalLight position={[2.4, 1.8, -3]} intensity={0.55} color="#eef2ff" />
        <Studio />
        <mesh rotation-x={-Math.PI / 2} position-y={-0.001} receiveShadow>
          <planeGeometry args={[60, 60]} />
          <shadowMaterial opacity={0.26} />
        </mesh>
        <ContactShadows position={[0, 0.002, 0]} scale={6} resolution={1024} blur={2.6} far={1} opacity={0.4} color="#101113" frames={1} />
        <SnookerTable feltColor={feltColor} woodColor={woodColor} leatherColor={leatherColor} metalColor={metalColor} lineColor={lineColor} balls={balls} />
        {dimensions && <Dimensions />}
        <CameraRig view={view} views={VIEWS} fallback="Front-L" />
        <OrbitControls makeDefault enablePan={false} autoRotate={autoRotate} autoRotateSpeed={0.5} minDistance={0.2} maxDistance={14} maxPolarAngle={1.54} />
        <Effects ao={ambientOcclusion} radius={0.08} />
      </Canvas>

      <ViewTabs main={MAIN} detail={DETAIL} view={view} setView={setView} />
      <InfoHint>
        A full-size 12 ft snooker table, built from the roulette and poker tables&apos; parts: the same baize, leather and figured mahogany. Cloth-covered cushions cut back into the pocket jaws, leather pocket plates over string nets on brass irons, a mitred rail and deep apron, and eight fluted legs · pick a view or a close-up, or drag to orbit and scroll in · turn on dimensions for the rule-book measurements
      </InfoHint>
    </div>
  )
}
