import { useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import TTBat, { BAT_BOUNDS } from './TTBat.jsx'

// a bright product studio: a broad soft box overhead and two tall strips,
// so the rubber picks up long soft highlights
function Studio() {
  return (
    <Environment resolution={256}>
      <color attach="background" args={['#bdbdbb']} />
      <Lightformer form="rect" intensity={2.2} color="#ffffff" position={[0, 8, 4]} rotation-x={Math.PI / 2.6} scale={[10, 6, 1]} />
      <Lightformer form="rect" intensity={1.6} color="#ffffff" position={[-5, 2, 4]} rotation-y={Math.PI / 4} scale={[3, 9, 1]} />
      <Lightformer form="rect" intensity={1.2} color="#fff8ef" position={[5, 2, 3]} rotation-y={-Math.PI / 4} scale={[3, 9, 1]} />
      <Lightformer form="rect" intensity={0.7} color="#ffffff" position={[0, 1, -6]} scale={[10, 4, 1]} />
    </Environment>
  )
}

// centre the whole bat (head and handle) on the orbit target
const MID = (BAT_BOUNDS.top + BAT_BOUNDS.bottom) / 2

export default function TTBatScene({ background = '#ececea', autoRotate = false, ...props }) {
  const [flipKey, setFlipKey] = useState(0)
  const btn = { pointerEvents: 'auto', font: '600 12px/1 ui-monospace, Menlo, monospace', letterSpacing: '0.12em', textTransform: 'uppercase', padding: '11px 18px', borderRadius: 999, border: 'none', cursor: 'pointer', boxShadow: '0 6px 18px rgba(0,0,0,.18)' }
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none', background }}>
      <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 0.03, 0.66], fov: 30, near: 0.01, far: 20 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}>
        <color attach="background" args={[background]} />
        <hemisphereLight args={['#ffffff', '#9a9a9a', 0.5]} />
        <directionalLight position={[-1.5, 3, 2.5]} intensity={1.4} />
        <directionalLight position={[2, 1, -2]} intensity={0.5} />
        <Studio />
        <group position={[0, -MID, 0]}>
          <TTBat {...props} flipKey={flipKey} />
          <ContactShadows position={[0, BAT_BOUNDS.bottom - 0.03, 0]} scale={0.6} blur={2.6} far={0.35} opacity={0.38} resolution={512} color="#2a2826" />
        </group>
        <OrbitControls makeDefault enablePan={false} target={[0, 0, 0]} autoRotate={autoRotate} autoRotateSpeed={1.2} minDistance={0.3} maxDistance={1.6} />
      </Canvas>

      <div style={{ position: 'absolute', top: 14, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 10, pointerEvents: 'none' }}>
        <button onClick={() => setFlipKey((k) => k + 1)} style={{ ...btn, background: '#1c1a16', color: '#f4f1ea' }}>
          Flip
        </button>
      </div>
      <InfoHint>Click the bat or press Flip to turn it over to the backhand rubber · drag to look around it · scroll to zoom in on the rubber and the handle</InfoHint>
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
