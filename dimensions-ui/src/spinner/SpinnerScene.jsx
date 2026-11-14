import { useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import Spinner, { DIM } from './Spinner.jsx'
import { CameraRig, Dim, Effects, FOV, InfoHint, KeyLight, Studio, TAN as T, Table, ViewTabs, pill } from '../gameboard/stage.jsx'

// The spinner standing upright over a pale studio floor, as on a product
// sheet, in the shared tabletop studio (from the board models).

const V = (x, y, z) => new THREE.Vector3(x, y, z)
const BG = '#e8e9ea'
const Y = 0.075 // the hub's height
const C = V(0, Y, 0)
const near = (a) => Math.max(1, 1 / a)
const fit = (a) => (0.045 * 1.25) / (T * Math.min(a, 1))
const persp = (x, y, z) => (a) => ({ pos: V(x, y, z).normalize().multiplyScalar(fit(a) * 1.05).add(C), target: C })
const VIEWS = {
  Front: (a) => ({ pos: V(0, Y, fit(a)), target: C }),
  Back: (a) => ({ pos: V(0, Y, -fit(a)), target: C }),
  Top: (a) => ({ pos: V(0, Y + fit(a), 0.0001), target: C }),
  Left: (a) => ({ pos: V(-fit(a), Y, 0), target: C }),
  Right: (a) => ({ pos: V(fit(a), Y, 0), target: C }),
  A: persp(-0.55, 0.15, 0.82),
  B: persp(-0.3, 0.3, 0.9),
  C: persp(0.3, 0.3, 0.9),
  D: persp(0.55, 0.15, 0.82),
  Bearing: (a) => {
    const k = near(a)
    return { pos: V(0.012 * k, Y + 0.012 * k, 0.06 * k), target: C }
  },
  Weight: (a) => {
    const k = near(a)
    const p = V(Math.cos((210 * Math.PI) / 180) * DIM.lobeD, Y + Math.sin((210 * Math.PI) / 180) * DIM.lobeD, 0)
    return { pos: p.clone().add(V(-0.03 * k, -0.012 * k, 0.045 * k)), target: p }
  },
  Cap: (a) => {
    const k = near(a)
    return { pos: V(0.03 * k, Y + 0.018 * k, 0.04 * k), target: V(0, Y, DIM.bearingW / 2) }
  },
}
const MAIN = ['Front', 'Back', 'Top', 'Left', 'Right', 'A', 'B', 'C', 'D']
const DETAIL = ['Bearing', 'Weight', 'Cap']

function Dimensions() {
  const span = 0.0716 // the outline's width at the lobe tips
  const top = Y + DIM.lobeD + DIM.lobeR
  return (
    <group>
      <Dim a={[-span / 2, top + 0.008, 0]} b={[span / 2, top + 0.008, 0]} tick={[0, 0.002, 0]} label={'2.8″ · 71 mm'} />
      <Dim a={[0.05, Y - 0.006, -0.0048]} b={[0.05, Y - 0.006, 0.0048]} tick={[0.002, 0, 0]} label={'0.38″ · 9.7 mm'} at={[0.064, Y - 0.006, 0]} />
    </group>
  )
}

export default function SpinnerScene({ bodyColor = '#1f2c4b', capColor = '#d6d9dd', dimensions = false, ambientOcclusion = true, autoRotate = false, view: initialView = 'B' }) {
  const [view, setView] = useState(initialView)
  useEffect(() => setView(initialView), [initialView])
  const spinner = useRef()
  const [stats, setStats] = useState({ rpm: 0, time: 0, spinning: false })
  const [exploded, setExploded] = useState(false)
  // the bearing close-up takes the caps off to show the balls
  useEffect(() => setExploded(view === 'Bearing'), [view])
  const btn = { ...pill, height: 32, padding: '0 16px', border: 'none', cursor: 'pointer', background: '#1c1a16', color: '#f4f1ea', font: '600 11px/1 ui-monospace, Menlo, monospace', letterSpacing: '0.08em', textTransform: 'uppercase' }
  const light = { ...btn, background: 'rgba(255,255,255,0.9)', color: '#1c1a16' }
  const mm = Math.floor(stats.time / 60)
  const ss = Math.floor(stats.time % 60)
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none', background: BG }}>
      <Canvas frameloop={autoRotate ? 'always' : 'demand'} shadows dpr={[1, 2]} camera={{ position: [0, 0.09, 0.2], fov: FOV, near: 0.002, far: 10 }} gl={{ antialias: false, powerPreference: 'high-performance' }}>
        <color attach="background" args={[BG]} />
        <hemisphereLight args={['#ffffff', '#bdbdb8', 0.45]} />
        <KeyLight half={0.12} intensity={2.3} />
        <Studio />
        <Table scale={0.4} />
        <group position={C.toArray()}>
          <Spinner ref={spinner} bodyColor={bodyColor} capColor={capColor} exploded={exploded} onStats={setStats} />
        </group>
        {dimensions && <Dimensions />}
        <CameraRig view={view} views={VIEWS} fallback="B" />
        <OrbitControls makeDefault enablePan={false} autoRotate={autoRotate} autoRotateSpeed={0.6} minDistance={0.02} maxDistance={1.2} maxPolarAngle={1.5} target={C.toArray()} />
        <Effects ao={ambientOcclusion} radius={0.004} />
      </Canvas>
      <ViewTabs main={MAIN} detail={DETAIL} view={view} setView={setView} label={(v) => (v.length === 1 ? `View ${v}` : v)} />
      <div style={{ position: 'absolute', left: 12, bottom: 12, zIndex: 5, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', maxWidth: 'calc(100% - 64px)' }}>
        <button type="button" style={btn} onClick={() => spinner.current?.flick()}>
          Flick
        </button>
        <button type="button" style={light} onClick={() => spinner.current?.stop()}>
          Stop
        </button>
        <button type="button" style={light} onClick={() => setExploded((x) => !x)}>
          {exploded ? 'Caps on' : 'Caps off'}
        </button>
        <div style={{ ...pill, height: 32, padding: '0 12px', alignItems: 'center', gap: 10, font: '600 11px/1 ui-monospace, Menlo, monospace', color: '#2a2925', letterSpacing: '0.04em' }} aria-live="off">
          <span>{stats.rpm.toLocaleString()} rpm</span>
          <span style={{ opacity: 0.6 }}>
            {mm}:{String(ss).padStart(2, '0')}
          </span>
        </div>
      </div>
      <InfoHint>
        A three-arm spinner at real size (71 mm across, 9.7 mm thick): anodised aluminium with diamond-cut chamfers, three 608 bearings as weights, an open centre bearing whose eight balls orbit in their cage at half the body&apos;s speed, and turned finger caps held still on the inner race · drag the body round to spin it and let go to flick it, or press Flick · it runs down on the bearing&apos;s friction, a couple of minutes from a good flick · Caps off shows the bearing at work
      </InfoHint>
    </div>
  )
}
