import { useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Environment, Lightformer, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import Dartboard, { BULL_Y, OCHE } from './Dartboard.jsx'
import ControlDock from '../controls/ControlDock.jsx'

function Studio() {
  return (
    <Environment resolution={256}>
      <color attach="background" args={['#bdbdbd']} />
      <Lightformer form="rect" intensity={2} color="#ffffff" position={[-2, 4, 3]} rotation-y={Math.PI / 5} scale={[4, 4, 1]} />
      <Lightformer form="rect" intensity={1.2} color="#ffffff" position={[2, 3, 3]} rotation-y={-Math.PI / 5} scale={[3, 3, 1]} />
    </Environment>
  )
}

export default function DartsScene({ wall = '#c9c9c7', autoRotate = false, ...props }) {
  const [collectKey, setCollectKey] = useState(0)
  // the spot's aim point has to be in the scene for three to use it
  const aim = useMemo(() => new THREE.Object3D(), [])
  const [scores, setScores] = useState([])
  const total = scores.reduce((a, s) => a + s.points, 0)
  const btn = { pointerEvents: 'auto', font: '600 12px/1 ui-monospace, Menlo, monospace', letterSpacing: '0.12em', textTransform: 'uppercase', padding: '11px 18px', borderRadius: 999, border: 'none', cursor: 'pointer', boxShadow: '0 6px 18px rgba(0,0,0,.18)', background: '#1c1a16', color: '#f4f1ea' }
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none', background: wall }}>
      <Canvas shadows dpr={[1, 1.75]} camera={{ position: [0.05, BULL_Y, OCHE], fov: 17, near: 0.02, far: 30 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}>
        <color attach="background" args={[wall]} />
        <hemisphereLight args={['#ffffff', '#8c8c8c', 0.5]} />
        {/* a lamp above and in front of the board, as in a pub: the wires and darts cast shadows down the face */}
        <spotLight position={[0.2, BULL_Y + 1.4, 1.2]} angle={0.55} penumbra={0.6} intensity={9} distance={6} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0001} target={aim} />
        <primitive object={aim} position={[0, BULL_Y, 0]} />
        <Studio />
        {/* the wall and floor */}
        <mesh position={[0, 2, -0.045]} receiveShadow>
          <planeGeometry args={[12, 6]} />
          <meshStandardMaterial color={wall} roughness={0.95} />
        </mesh>
        <mesh rotation-x={-Math.PI / 2} receiveShadow>
          <planeGeometry args={[12, 12]} />
          <meshStandardMaterial color="#8f8a82" roughness={0.9} />
        </mesh>
        <Dartboard {...props} collectKey={collectKey} onScore={setScores} />
        <OrbitControls makeDefault enablePan={false} target={[0, BULL_Y, 0]} autoRotate={autoRotate} autoRotateSpeed={0.5} minDistance={0.5} maxDistance={4} maxAzimuthAngle={1.2} minAzimuthAngle={-1.2} minPolarAngle={0.6} maxPolarAngle={2.2} />
      </Canvas>
      <ControlDock corner="tl">
        <button onClick={() => setCollectKey((k) => k + 1)} style={btn}>
          Collect darts
        </button>
        <div aria-live="polite" style={{ font: '600 13px/1 ui-monospace, Menlo, monospace', color: '#1c1a16', minWidth: 160, padding: '9px 12px', borderRadius: 10, background: 'rgba(255,255,255,.85)' }}>
          {scores.length ? `${scores.map((s) => s.label).join(' · ')}  =  ${total}` : 'Click the board to throw'}
        </div>
      </ControlDock>
      <InfoHint>Click where you want to aim to throw a dart from the oche · three darts, then Collect · your accuracy sets the scatter · darts can bounce out off the wire · drag to look around</InfoHint>
    </div>
  )
}

function InfoHint({ children }) {
  const [hover, setHover] = useState(false)
  const [pinned, setPinned] = useState(false)
  const open = hover || pinned
  return (
    <div
      onPointerEnter={(e) => e.pointerType === 'mouse' && setHover(true)}
      onPointerLeave={(e) => e.pointerType === 'mouse' && setHover(false)}
      style={{ position: 'absolute', right: 12, bottom: 12, zIndex: 5, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, maxWidth: 'calc(100% - 24px)' }}
    >
      {open && (
        <div role="tooltip" style={{ maxWidth: 340, padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,0.94)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', boxShadow: '0 8px 24px rgba(0,0,0,.14), inset 0 0 0 1px rgba(0,0,0,.06)', font: '500 11px/1.6 ui-monospace, Menlo, monospace', letterSpacing: '0.03em', color: '#2a2925', textAlign: 'left' }}>
          {children}
        </div>
      )}
      <button
        type="button"
        aria-label="How to use"
        aria-expanded={open}
        onClick={() => setPinned((p) => !p)}
        style={{ width: 30, height: 30, padding: 0, borderRadius: '50%', border: 'none', cursor: 'pointer', display: 'grid', placeItems: 'center', background: open ? '#1c1a16' : 'rgba(255,255,255,0.88)', color: open ? '#f4f1ea' : '#2a2925', font: 'italic 700 15px/1 Georgia, "Times New Roman", serif', boxShadow: '0 2px 8px rgba(0,0,0,.14), inset 0 0 0 1px rgba(0,0,0,.08)' }}
      >
        i
      </button>
    </div>
  )
}
