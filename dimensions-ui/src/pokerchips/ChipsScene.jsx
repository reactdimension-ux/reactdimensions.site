import { useEffect, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import Chips, { HEIGHTS, stackX } from './Chips.jsx'
import { CHIP, DENOMINATIONS } from './chip.js'
import { CameraRig, Effects, FOV, InfoHint, KeyLight, Studio, TAN as T, Table, ViewTabs, Label } from '../gameboard/stage.jsx'

// The chips on a pale studio surface, in the shared tabletop studio (from
// the board models).

const V = (x, y, z) => new THREE.Vector3(x, y, z)
const BG = '#e3e3e0'
const W = DENOMINATIONS.length * 0.056
const near = (a) => Math.max(1, 1 / a)
const VIEWS = {
  '3/4': (a) => {
    const d = Math.max(0.42, (W / 2) * 1.2 / (T * Math.min(a, 1.8)))
    return { pos: V(0.15, 0.6, 1).normalize().multiplyScalar(d).add(V(0, 0.02, 0.02)), target: V(0, 0.02, 0.02) }
  },
  Top: (a) => ({ pos: V(0, Math.max(0.12 * 1.2, (W / 2) * 1.12 / Math.min(a, 2)) / T, 0.03), target: V(0, 0, 0.025) }),
  Low: (a) => {
    const d = Math.max(0.35, (W / 2) * 1.1 / (T * Math.min(a, 1.8)))
    return { pos: V(0, d * 0.14, d), target: V(0, 0.025, 0) }
  },
  Chip: (a) => {
    const k = near(a)
    const x = stackX(3)
    return { pos: V(x + 0.03 * k, 0.07 * k, 0.05 + 0.075 * k), target: V(x, 0, 0.05) }
  },
  Edge: (a) => {
    const k = near(a)
    const x = stackX(3)
    return { pos: V(x + 0.05 * k, 0.03, 0.09 * k), target: V(x, 0.025, 0) }
  },
}

function Values() {
  return DENOMINATIONS.map((d, i) => (
    <Label key={d.value} position={[stackX(i), HEIGHTS[i] * CHIP.h + 0.012, 0]}>
      ${d.value.toLocaleString()}
    </Label>
  ))
}

export default function ChipsScene({ showValue = true, stacks = true, labels = true, ambientOcclusion = true, autoRotate = false, view: initialView = '3/4' }) {
  const [view, setView] = useState(initialView)
  useEffect(() => setView(initialView), [initialView])
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none', background: BG }}>
      <Canvas frameloop={autoRotate ? 'always' : 'demand'} shadows dpr={[1, 2]} camera={{ position: [0, 0.3, 0.5], fov: FOV, near: 0.002, far: 20 }} gl={{ antialias: false, powerPreference: 'high-performance' }}>
        <color attach="background" args={[BG]} />
        <hemisphereLight args={['#ffffff', '#bdbdb8', 0.45]} />
        <KeyLight half={0.3} intensity={2.2} />
        <Studio />
        <Table scale={0.8} />
        <Chips showValue={showValue} stacks={stacks} />
        {labels && stacks && <Values />}
        <CameraRig view={view} views={VIEWS} fallback="3/4" />
        <OrbitControls makeDefault enablePan={false} autoRotate={autoRotate} autoRotateSpeed={0.5} minDistance={0.03} maxDistance={2} maxPolarAngle={1.52} />
        <Effects ao={ambientOcclusion} radius={0.004} />
      </Canvas>
      <ViewTabs main={['3/4', 'Top', 'Low']} detail={['Chip', 'Edge']} view={view} setView={setView} />
      <InfoHint>
        Casino clay chips at real size (39 mm, 3.3 mm thick) in the common colour convention: $1 white, $5 red, $10 blue, $25 green, $100 black, $500 purple, $1,000 yellow. Casinos and jurisdictions vary, $10 and $1,000 most · eight edge spots run through each chip and line up with the side, with engraved squares, a dash ring and a recessed inlay · click a stack to flick its top chip · pick a view, or drag to orbit and scroll in
      </InfoHint>
    </div>
  )
}
