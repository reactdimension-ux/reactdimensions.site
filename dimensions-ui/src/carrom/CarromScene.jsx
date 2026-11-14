import { useEffect, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import Carrom, { CARROM, OUTER, POCKET } from './Carrom.jsx'
import { CameraRig, Dim, Effects, FOV, InfoHint, KeyLight, Studio, TAN as T, Table, ViewTabs } from '../gameboard/stage.jsx'

// The carrom board on the shared tabletop studio (from the board models).

const V = (x, y, z) => new THREE.Vector3(x, y, z)
const BG = '#c7c9c6'
const TOP = CARROM.lift + CARROM.top // the playing surface's height

const fit = (half, a) => (half * 1.12) / (T * Math.min(a, 1))
const elevation = (dir) => (a) => {
  const d = (OUTER * 1.08) / (T * a) + OUTER
  return { pos: dir.clone().multiplyScalar(d).setY(d * 0.05 + 0.04), target: V(0, 0.04, 0) }
}
const near = (a) => Math.max(1, 1 / a)
const VIEWS = {
  Top: (a) => ({ pos: V(0, fit(OUTER, a) + TOP, 0.0001), target: V(0, TOP, 0) }),
  '3/4': (a) => ({ pos: V(0.62, 0.62, 0.48).normalize().multiplyScalar(Math.max(1.6, fit(OUTER * 1.3, a))), target: V(0, 0.03, 0) }),
  Front: elevation(V(0, 0, 1)),
  Rear: elevation(V(0, 0, -1)),
  Left: elevation(V(-1, 0, 0)),
  Right: elevation(V(1, 0, 0)),
  Pocket: (a) => {
    const k = near(a)
    return { pos: V(POCKET + 0.12 * k, TOP + 0.13 * k, POCKET + 0.19 * k), target: V(POCKET - 0.02, TOP - 0.01, POCKET - 0.02) }
  },
  Centre: (a) => {
    const k = near(a)
    return { pos: V(0.06 * k, TOP + 0.22 * k, 0.2 * k), target: V(0, TOP, 0) }
  },
  Baseline: (a) => {
    const k = near(a)
    const x = -0.235 + 0.0159
    const z = 0.37 - 0.1015 - 0.0159
    return { pos: V(x + 0.06 * k, TOP + 0.13 * k, z + 0.14 * k), target: V(x + 0.01, TOP, z - 0.01) }
  },
  Frame: (a) => {
    const k = near(a)
    return { pos: V(-OUTER - 0.1 * k, TOP + 0.12 * k, OUTER + 0.14 * k), target: V(-OUTER + 0.05, TOP - 0.005, OUTER - 0.05) }
  },
}
const MAIN = ['Top', '3/4', 'Front', 'Rear', 'Left', 'Right']
const DETAIL = ['Pocket', 'Centre', 'Baseline', 'Frame']

function Dimensions() {
  const y = 0.001
  const cm = (m) => `${(m * 100).toFixed(1)} cm`
  return (
    <group>
      <Dim a={[-CARROM.play / 2, TOP + 0.03, OUTER + 0.05]} b={[CARROM.play / 2, TOP + 0.03, OUTER + 0.05]} tick={[0, 0, 0.015]} label={`playing surface ${cm(CARROM.play)}`} />
      <Dim a={[-OUTER - 0.05, y, -OUTER]} b={[-OUTER - 0.05, y, OUTER]} tick={[0.015, 0, 0]} label={cm(2 * OUTER)} />
      <Dim a={[OUTER + 0.03, 0, -OUTER]} b={[OUTER + 0.03, CARROM.lift + CARROM.frameH, -OUTER]} tick={[0.01, 0, 0]} label={cm(CARROM.lift + CARROM.frameH)} at={[OUTER + 0.08, CARROM.lift + CARROM.frameH + 0.02, -OUTER]} />
    </group>
  )
}

export default function CarromScene({ frameWood = '#6b3820', surface = '#e4c999', netColor = '#dcd6c9', dimensions = false, ambientOcclusion = true, autoRotate = false, view: initialView = '3/4' }) {
  const [view, setView] = useState(initialView)
  useEffect(() => setView(initialView), [initialView])
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none', background: BG }}>
      <Canvas frameloop={autoRotate ? 'always' : 'demand'} shadows dpr={[1, 1.75]} camera={{ position: [1, 1, 1], fov: FOV, near: 0.005, far: 40 }} gl={{ antialias: false, powerPreference: 'high-performance' }}>
        <color attach="background" args={[BG]} />
        <hemisphereLight args={['#ffffff', '#8a8780', 0.3]} />
        <KeyLight half={0.75} intensity={2.2} />
        <Studio />
        <Table scale={2.2} />
        <Carrom frameWood={frameWood} surface={surface} netColor={netColor} />
        {dimensions && <Dimensions />}
        <CameraRig view={view} views={VIEWS} fallback="3/4" />
        <OrbitControls makeDefault enablePan={false} autoRotate={autoRotate} autoRotateSpeed={0.5} minDistance={0.08} maxDistance={5} maxPolarAngle={1.55} />
        <Effects ao={ambientOcclusion} radius={0.03} />
      </Canvas>
      <ViewTabs main={MAIN} detail={DETAIL} view={view} setView={setView} />
      <InfoHint>
        A tournament carrom board, without the coins: a 74 cm lacquered birch surface with the standard markings (base lines and circles, foul arrows, centre rings), four 4.45 cm pockets with net bags the board stands on, in a deep rounded walnut frame · pick a view, or drag to orbit and scroll in to a pocket or the print
      </InfoHint>
    </div>
  )
}
