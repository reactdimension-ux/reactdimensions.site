import { useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import Hourglass, { HOURGLASS_HEIGHT } from './Hourglass.jsx'
import ControlDock from '../controls/ControlDock.jsx'

function Studio() {
  return (
    <Environment resolution={256}>
      <color attach="background" args={['#d8d8d6']} />
      <Lightformer form="rect" intensity={2.4} color="#ffffff" position={[-3, 4, 3]} rotation-y={Math.PI / 4} scale={[4, 6, 1]} />
      <Lightformer form="rect" intensity={1.4} color="#fff6ea" position={[3, 3, 2]} rotation-y={-Math.PI / 4} scale={[3, 5, 1]} />
      <Lightformer form="rect" intensity={1.2} color="#ffffff" position={[0, 6, 0]} rotation-x={Math.PI / 2} scale={[8, 4, 1]} />
      <Lightformer form="rect" intensity={0.8} color="#ffffff" position={[0, 1, -4]} scale={[8, 3, 1]} />
    </Environment>
  )
}

const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

export default function HourglassScene({ background = '#e4e3e0', autoRotate = false, ...props }) {
  const [flipKey, setFlipKey] = useState(0)
  const [left, setLeft] = useState(null)
  const btn = { pointerEvents: 'auto', font: '600 12px/1 ui-monospace, Menlo, monospace', letterSpacing: '0.12em', textTransform: 'uppercase', padding: '11px 18px', borderRadius: 999, border: 'none', cursor: 'pointer', boxShadow: '0 6px 18px rgba(0,0,0,.18)', background: '#1c1a16', color: '#f4f1ea' }
  const y = HOURGLASS_HEIGHT / 2
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none', background }}>
      <Canvas shadows dpr={[1, 1.75]} camera={{ position: [0.32, y + 0.05, 0.62], fov: 30, near: 0.01, far: 20 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}>
        <color attach="background" args={[background]} />
        <hemisphereLight args={['#ffffff', '#a59c90', 0.4]} />
        <directionalLight position={[-0.8, 1.6, 0.9]} intensity={1.4} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0002} shadow-camera-left={-0.4} shadow-camera-right={0.4} shadow-camera-top={0.4} shadow-camera-bottom={-0.4} />
        <Studio />
        <mesh rotation-x={-Math.PI / 2} receiveShadow>
          <planeGeometry args={[10, 10]} />
          <meshStandardMaterial color={background} roughness={0.95} />
        </mesh>
        <ContactShadows position={[0, 0.0005, 0]} opacity={0.35} scale={0.8} blur={2.4} far={0.3} />
        <Hourglass {...props} flipKey={flipKey} onTime={(t, run) => setLeft((p) => (p && Math.floor(p.t) === Math.floor(t) && p.run === run ? p : { t, run }))} />
        <OrbitControls makeDefault enablePan={false} target={[0, y, 0]} autoRotate={autoRotate} autoRotateSpeed={0.6} minDistance={0.25} maxDistance={1.6} maxPolarAngle={1.52} />
      </Canvas>
      <ControlDock corner="tl">
        <button onClick={() => setFlipKey((k) => k + 1)} style={btn}>
          Turn over
        </button>
        <div aria-live="off" style={{ font: '500 13px/1 ui-monospace, Menlo, monospace', color: '#2a2925', minWidth: 120 }}>
          {left ? (left.t > 0.05 ? `${fmt(left.t)} left` : 'Done') : ''}
        </div>
      </ControlDock>
      <InfoHint>Click the hourglass (or Turn over) to turn it · drag to look around · the sand runs at a constant rate, so the time is set by the duration control</InfoHint>
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
