import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import Arrow, { ARROW } from './Arrow.jsx'
import { CameraRig, Effects, FOV, InfoHint, KeyLight, Studio, TAN as T, Table, ViewTabs, pill } from '../gameboard/stage.jsx'

// The arrow floating over a pale studio floor, in the shared tabletop studio
// (from the board models). It lies along x, nock to the left.

const V = (x, y, z) => new THREE.Vector3(x, y, z)
const BG = '#e2e2df'
const H = 0.11 // height it floats at
const X0 = -(ARROW.len + ARROW.point - ARROW.nock) / 2 // centres it

const near = (a) => Math.max(1, 1 / a)
const VIEWS = {
  Side: (a) => ({ pos: V(0, H + 0.03, (0.42 * 1.12) / (T * Math.min(a, 2.2)) + 0.02), target: V(0, H, 0) }),
  '3/4': (a) => {
    const d = Math.max(0.75, 0.46 / (T * Math.min(a, 1.9)))
    return { pos: V(-0.45, 0.62, 0.62).normalize().multiplyScalar(d).add(V(0, H, 0)), target: V(0, H, 0) }
  },
  Point: (a) => {
    const k = near(a)
    const tip = X0 + ARROW.len + ARROW.point
    return { pos: V(tip - 0.045 * k, H + 0.025 * k, 0.05 * k), target: V(tip - 0.022, H, 0) }
  },
  Fletching: (a) => {
    const k = near(a)
    const x = X0 + 0.04
    return { pos: V(x + 0.1 * k, H + 0.06 * k, 0.11 * k), target: V(x + 0.02, H, 0) }
  },
}

export default function ArrowScene({ vaneColor = '#f2641c', cockColor = '#f1f1ee', nockColor = '#ff7a1a', point = 'steel', ambientOcclusion = true, autoRotate = false, view: initialView = 'Side' }) {
  const [view, setView] = useState(initialView)
  useEffect(() => setView(initialView), [initialView])
  const arrow = useRef()
  const views = useMemo(() => VIEWS, [])
  const btn = { ...pill, height: 32, padding: '0 16px', border: 'none', cursor: 'pointer', background: '#1c1a16', color: '#f4f1ea', font: '600 11px/1 ui-monospace, Menlo, monospace', letterSpacing: '0.08em', textTransform: 'uppercase' }
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none', background: BG }}>
      <Canvas frameloop={autoRotate ? 'always' : 'demand'} shadows dpr={[1, 2]} camera={{ position: [0, 0.2, 1], fov: FOV, near: 0.005, far: 40 }} gl={{ antialias: false, powerPreference: 'high-performance' }}>
        <color attach="background" args={[BG]} />
        <hemisphereLight args={['#ffffff', '#bdbdb8', 0.4]} />
        <KeyLight half={0.55} intensity={2.2} />
        <Studio />
        <Table scale={1.8} />
        {/* laid along +x, nock to the left, floating */}
        <group position={[X0, H, 0]} rotation-z={-Math.PI / 2}>
          <Arrow ref={arrow} vaneColor={vaneColor} cockColor={cockColor} nockColor={nockColor} point={point} />
        </group>
        <CameraRig view={view} views={views} fallback="Side" />
        <OrbitControls makeDefault enablePan={false} autoRotate={autoRotate} autoRotateSpeed={0.5} minDistance={0.03} maxDistance={4} maxPolarAngle={1.5} />
        <Effects ao={ambientOcclusion} radius={0.008} />
      </Canvas>
      <ViewTabs main={['Side', '3/4']} detail={['Point', 'Fletching']} view={view} setView={setView} />
      <div style={{ position: 'absolute', left: 12, bottom: 12, zIndex: 5 }}>
        <button type="button" style={btn} onClick={() => arrow.current?.spin()}>
          Spin
        </button>
      </div>
      <InfoHint>
        A target arrow at real size: a 72 cm carbon shaft in a fine twill weave, a steel field point with ring grooves, three vanes set with a slight helical offset (the white one is the cock vane), and a translucent nock with its string slot · Spin turns it about its axis, the way the vanes do in flight · pick a view, or drag to orbit and scroll right in
      </InfoHint>
    </div>
  )
}
