import { useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Environment, Lightformer, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import Football from './Football.jsx'
import ControlDock from '../controls/ControlDock.jsx'

function Studio() {
  return (
    <Environment resolution={256}>
      <color attach="background" args={['#c9c9c9']} />
      <Lightformer form="rect" intensity={2.2} color="#ffffff" position={[-6, 8, 6]} rotation-y={Math.PI / 4} scale={[8, 8, 1]} />
      <Lightformer form="rect" intensity={1.2} color="#ffffff" position={[6, 6, 5]} rotation-y={-Math.PI / 4} scale={[6, 6, 1]} />
      <Lightformer form="rect" intensity={1.6} color="#ffffff" position={[0, 12, 0]} rotation-x={Math.PI / 2} scale={[14, 8, 1]} />
    </Environment>
  )
}

export default function FootballScene({ background = '#d6d6d6', floor = '#cfcfcf', follow = true, autoRotate = false, ...props }) {
  const [kickKey, setKickKey] = useState(0)
  const [resetKey, setResetKey] = useState(0)
  const [speed, setSpeed] = useState(null)
  const btn = { pointerEvents: 'auto', font: '600 12px/1 ui-monospace, Menlo, monospace', letterSpacing: '0.12em', textTransform: 'uppercase', padding: '11px 18px', borderRadius: 999, border: 'none', cursor: 'pointer', boxShadow: '0 6px 18px rgba(0,0,0,.18)' }
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none', background }}>
      <Canvas shadows dpr={[1, 1.75]} camera={{ position: [0, 0.42, 1.45], fov: 32, near: 0.02, far: 60 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}>
        <color attach="background" args={[background]} />
        <fog attach="fog" args={[background, 5, 14]} />
        <hemisphereLight args={['#ffffff', '#8f8f8f', 0.45]} />
        <directionalLight position={[-2.5, 6, 3]} intensity={1.6} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0002} shadow-normalBias={0.01} shadow-camera-left={-4} shadow-camera-right={4} shadow-camera-top={4} shadow-camera-bottom={-4} shadow-camera-near={0.5} shadow-camera-far={16} shadow-radius={6} />
        <Studio />
        {/* a seamless studio sweep: floor and back wall */}
        <mesh rotation-x={-Math.PI / 2} receiveShadow>
          <planeGeometry args={[40, 40]} />
          <meshStandardMaterial color={floor} roughness={0.92} />
        </mesh>
        <mesh position={[0, 3, -3.2]} receiveShadow>
          <planeGeometry args={[40, 6]} />
          <meshStandardMaterial color={floor} roughness={0.95} />
        </mesh>
        <Football {...props} follow={follow} kickKey={kickKey} resetKey={resetKey} onKick={setSpeed} />
        <OrbitControls makeDefault enablePan={false} target={[0, 0.12, 0]} autoRotate={autoRotate} autoRotateSpeed={0.6} minDistance={0.5} maxDistance={6} maxPolarAngle={1.5} />
      </Canvas>

      <ControlDock corner="tl">
        <button onClick={() => setKickKey((k) => k + 1)} style={{ ...btn, background: '#1c1a16', color: '#f4f1ea' }}>
          Kick
        </button>
        <button onClick={() => setResetKey((k) => k + 1)} style={{ ...btn, background: 'rgba(255,255,255,.9)', color: '#1c1a16' }}>
          Drop
        </button>
        <div aria-live="polite" style={{ font: '500 13px/1 ui-monospace, Menlo, monospace', color: '#2a2925', minWidth: 120 }}>
          {speed ? `${Math.round(speed * 3.6)} km/h` : ''}
        </div>
      </ControlDock>
      <InfoHint>
        Tap the ball to kick it: hit it off-centre to put spin on it and bend it in the air · drag it to pick it up and throw it · drag the floor to look around
      </InfoHint>
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
