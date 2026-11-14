import { useEffect, useState, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import Target, { BOSS, FACE_CENTRE, FACE_NORMAL } from './Target.jsx'
import { CameraRig, Effects, FOV, InfoHint, KeyLight, Studio, TAN as T, Table, ViewTabs, pill } from '../gameboard/stage.jsx'

// The target on a pale studio floor, in the shared studio (from the board
// models); arrows are the library's Arrow model.

const V = (x, y, z) => new THREE.Vector3(x, y, z)
const BG = '#e4e4e1'
const MID = V(0, 0.85, -0.1)

const near = (a) => Math.max(1, 1 / a)
const fitH = (a) => Math.max((1.85 / 2) * 1.12, (1.0 / 2) * 1.12 / Math.min(a, 1)) / T
const VIEWS = {
  Front: (a) => ({ pos: V(0, 1.15, fitH(a)), target: MID }),
  '3/4': (a) => ({ pos: V(1.7, 1.5, 2.6).normalize().multiplyScalar(fitH(a) * 1.05).add(V(0, 0.35, 0)), target: MID }),
  Side: (a) => ({ pos: V(fitH(a) + 0.2, 1.05, -0.2), target: MID }),
  Face: (a) => {
    const k = near(a)
    return { pos: FACE_CENTRE.clone().addScaledVector(FACE_NORMAL, 1.75 * k), target: FACE_CENTRE }
  },
  Arrows: (a) => {
    const k = near(a)
    return { pos: FACE_CENTRE.clone().add(V(0.55 * k, 0.25 * k, 0.75 * k)), target: FACE_CENTRE.clone().add(V(0, 0, 0.25)) }
  },
  Stand: (a) => {
    const k = near(a)
    return { pos: V(0.75 * k, 0.75, 0.9 * k), target: V(0, 0.75, -0.15) }
  },
}

export default function TargetScene({ standColor = '#d8ae72', spread = 0.07, vaneColor = '#f2641c', cockColor = '#f1f1ee', nockColor = '#ff7a1a', point = 'steel', ambientOcclusion = true, autoRotate = false, view: initialView = '3/4' }) {
  const [view, setView] = useState(initialView)
  useEffect(() => setView(initialView), [initialView])
  const target = useRef()
  const [scores, setScores] = useState([])
  const total = scores.reduce((t, s) => t + s.value, 0)
  const btn = { ...pill, height: 32, padding: '0 16px', border: 'none', cursor: 'pointer', background: '#1c1a16', color: '#f4f1ea', font: '600 11px/1 ui-monospace, Menlo, monospace', letterSpacing: '0.08em', textTransform: 'uppercase' }
  const ringColor = (l) => (l === 'X' || l === '10' || l === '9' ? '#f6dc1d' : l === '8' || l === '7' ? '#e1262d' : l === '6' || l === '5' ? '#2fa8e0' : l === '4' || l === '3' ? '#1c1c1e' : '#f7f6f1')
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none', background: BG }}>
      <Canvas frameloop={autoRotate ? 'always' : 'demand'} shadows dpr={[1, 1.75]} camera={{ position: [2, 1.6, 3], fov: FOV, near: 0.01, far: 60 }} gl={{ antialias: false, powerPreference: 'high-performance' }}>
        <color attach="background" args={[BG]} />
        <hemisphereLight args={['#ffffff', '#bdbdb8', 0.45]} />
        <group scale={1}>
          <KeyLight half={1.4} intensity={2.3} />
        </group>
        <Studio />
        <Table scale={4} />
        <Target ref={target} standColor={standColor} spread={spread} vaneColor={vaneColor} cockColor={cockColor} nockColor={nockColor} point={point} onScores={setScores} />
        <CameraRig view={view} views={VIEWS} fallback="3/4" />
        <OrbitControls makeDefault enablePan={false} autoRotate={autoRotate} autoRotateSpeed={0.4} minDistance={0.15} maxDistance={9} maxPolarAngle={1.55} target={MID.toArray()} />
        <Effects ao={ambientOcclusion} radius={0.05} />
      </Canvas>
      <ViewTabs main={['Front', '3/4', 'Side']} detail={['Face', 'Arrows', 'Stand']} view={view} setView={setView} />
      <div style={{ position: 'absolute', left: 12, bottom: 12, zIndex: 5, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', maxWidth: 'calc(100% - 64px)' }}>
        <button type="button" style={btn} onClick={() => target.current?.shoot()}>
          Shoot
        </button>
        <button type="button" style={{ ...btn, background: 'rgba(255,255,255,0.9)', color: '#1c1a16' }} onClick={() => target.current?.collect()}>
          Collect
        </button>
        {scores.length > 0 && (
          <div style={{ ...pill, height: 32, padding: '0 10px', alignItems: 'center', gap: 4, font: '600 11px/1 ui-monospace, Menlo, monospace', color: '#2a2925' }} aria-live="polite">
            {scores.map((s, i) => (
              <span key={i} style={{ minWidth: 20, height: 20, borderRadius: 10, display: 'grid', placeItems: 'center', background: ringColor(s.label), color: s.label === '4' || s.label === '3' || s.label === '5' || s.label === '6' ? '#fff' : '#1c1a16', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.25)' }}>
                {s.label}
              </span>
            ))}
            <span style={{ marginLeft: 6 }}>= {total}</span>
          </div>
        )}
      </div>
      <InfoHint>
        A field archery target: an 80 cm ten-ring face on an {Math.round(BOSS.r * 200)} cm straw boss, leaning back on a wooden tripod · Shoot sends one of the library's carbon arrows into it: it sticks in the straw, quivers and scores by ring (X is the inner ten) · Collect pulls them all out · pick a view, or drag to orbit
      </InfoHint>
    </div>
  )
}
