import { useEffect, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import Chessboard, { CHESS, GRID, OUTER } from './Chessboard.jsx'
import { CameraRig, Dim, Effects, FOV, InfoHint, KeyLight, Studio, TAN as T, Table, ViewTabs } from '../gameboard/stage.jsx'

// The chessboard on the shared tabletop studio (from the game board):
// camera views, soft boxes, table shadows, callouts and effects.

const V = (x, y, z) => new THREE.Vector3(x, y, z)
const BG = '#7a7b7e'

// the views on the reference sheet; white's side (rank 1) is the +z edge
const fit = (half, a) => (half * 1.15) / (T * Math.min(a, 1))
const corner = (sx, sz) => (a) => {
  const d = Math.max(1.05, fit(OUTER * 1.25, a))
  return { pos: V(sx * 0.55, 0.78, sz * 0.62).normalize().multiplyScalar(d), target: V(0, 0, 0.01) }
}
const elevation = (dir) => (a) => {
  const d = (OUTER * 1.1) / (T * a) + OUTER
  return { pos: dir.clone().multiplyScalar(d).setY(d * 0.07), target: V(0, 0.012, 0) }
}
const near = (a) => Math.max(1, 1 / a)
const VIEWS = {
  Top: (a) => ({ pos: V(0, fit(OUTER, a) + 0.03, 0.0001), target: V(0, 0, 0) }),
  Front: elevation(V(0, 0, 1)),
  Rear: elevation(V(0, 0, -1)),
  Side: elevation(V(1, 0, 0)),
  'Front-L': corner(-1, 1),
  'Front-R': corner(1, 1),
  'Rear-L': corner(-1, -1),
  'Rear-R': corner(1, -1),
  Corner: (a) => {
    const k = near(a)
    return { pos: V(OUTER + 0.07 * k, 0.085 * k, OUTER + 0.1 * k), target: V(OUTER - 0.04, 0.014, OUTER - 0.04) }
  },
  Grain: (a) => {
    const k = near(a)
    return { pos: V(0.05 * k, 0.1 * k, 0.085 * k), target: V(0.004, CHESS.top, 0.004) }
  },
  Joinery: (a) => {
    const k = near(a)
    return { pos: V(-OUTER + 0.11 * k, 0.1 * k, -OUTER + 0.13 * k), target: V(-OUTER + 0.035, 0.018, -OUTER + 0.035) }
  },
  Underside: (a) => {
    const k = near(a)
    return { pos: V(OUTER + 0.09 * k, 0.014, OUTER + 0.07 * k), target: V(OUTER - 0.05, 0.012, OUTER - 0.05) }
  },
}
const MAIN = ['Top', 'Front', 'Rear', 'Side', 'Front-L', 'Front-R', 'Rear-L', 'Rear-R']
const DETAIL = ['Corner', 'Grain', 'Joinery', 'Underside']

function Dimensions() {
  const y = 0.001
  const cm = (m) => `${(m * 100).toFixed(1)} cm`
  return (
    <group>
      <Dim a={[-GRID / 2, y, OUTER + 0.04]} b={[GRID / 2, y, OUTER + 0.04]} tick={[0, 0, 0.012]} label={`8 × 8 · ${cm(GRID)}`} />
      <Dim a={[-OUTER - 0.04, y, -OUTER]} b={[-OUTER - 0.04, y, OUTER]} tick={[0.012, 0, 0]} label={cm(2 * OUTER)} />
      <Dim a={[GRID / 2 - CHESS.cell, y, OUTER + 0.085]} b={[GRID / 2, y, OUTER + 0.085]} tick={[0, 0, 0.01]} label={`square ${(CHESS.cell * 1000).toFixed(0)} mm`} />
      <Dim a={[OUTER + 0.025, 0, -OUTER]} b={[OUTER + 0.025, CHESS.frameH, -OUTER]} tick={[0.008, 0, 0]} label={`${(CHESS.frameH * 1000).toFixed(0)} mm`} at={[OUTER + 0.06, CHESS.frameH + 0.012, -OUTER]} />
    </group>
  )
}

export default function ChessboardScene({ frameWood = '#a3622b', darkSquare = '#4b2a16', lightSquare = '#e9d8b6', border = '#4b2a16', stringing = true, dimensions = false, ambientOcclusion = true, autoRotate = false, view: initialView = 'Front-L' }) {
  const [view, setView] = useState(initialView)
  useEffect(() => setView(initialView), [initialView])
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none', background: BG }}>
      <Canvas frameloop={autoRotate ? 'always' : 'demand'} shadows dpr={[1, 1.75]} camera={{ position: [-0.6, 0.8, 0.7], fov: FOV, near: 0.004, far: 40 }} gl={{ antialias: false, powerPreference: 'high-performance' }}>
        <color attach="background" args={[BG]} />
        <hemisphereLight args={['#ffffff', '#55524c', 0.25]} />
        <KeyLight />
        <Studio />
        <Table />
        <Chessboard frameWood={frameWood} darkSquare={darkSquare} lightSquare={lightSquare} border={border} stringing={stringing} />
        {dimensions && <Dimensions />}
        <CameraRig view={view} views={VIEWS} fallback="Front-L" />
        <OrbitControls makeDefault enablePan={false} autoRotate={autoRotate} autoRotateSpeed={0.5} minDistance={0.05} maxDistance={4} maxPolarAngle={1.55} />
        <Effects ao={ambientOcclusion} />
      </Canvas>
      <ViewTabs main={MAIN} detail={DETAIL} view={view} setView={setView} />
      <InfoHint>
        An inlaid chessboard at tournament size: 55 mm squares of walnut and maple veneer, each with its own grain and running across its neighbours, a maple stringing line and walnut border, in a moulded, mitred frame under a high-gloss lacquer · pick a view, or drag to orbit and scroll right in to the grain and the joints
      </InfoHint>
    </div>
  )
}
