import { useEffect, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import SteeringWheel from './SteeringWheel.jsx'

const BG = '#e8e7e4'

// Soft studio light: broad panels so the leather's sheen and the walnut's
// satin finish read, and a crisp strip for the chrome R.
function Studio() {
  return (
    <Environment resolution={256}>
      <color attach="background" args={['#c3c5c8']} />
      <Lightformer form="rect" intensity={2.2} color="#ffffff" position={[0, 4, 3]} rotation-x={-Math.PI / 4} scale={[6, 3, 1]} />
      <Lightformer form="rect" intensity={2.4} color="#fff2e2" position={[-3.5, 1.5, 2.5]} rotation-y={Math.PI / 4} scale={[1.5, 4, 1]} />
      <Lightformer form="rect" intensity={1.6} color="#eef3ff" position={[3.5, 1.5, 2.5]} rotation-y={-Math.PI / 4} scale={[1.5, 4, 1]} />
      <Lightformer form="rect" intensity={3} color="#ffffff" position={[0, 0.8, 3]} scale={[4, 0.15, 1]} />
      <Lightformer form="rect" intensity={0.8} color="#ffffff" position={[0, 1, -4]} rotation-y={Math.PI} scale={[6, 3, 1]} />
    </Environment>
  )
}

// The driver's view: square on, a little above the hub.
function Rig() {
  const { camera, size } = useThree()
  useEffect(() => {
    const aspect = size.width / size.height
    const tan = Math.tan(THREE.MathUtils.degToRad(14))
    const dist = Math.max(0.46 / 2 / tan, 0.46 / 2 / (tan * aspect)) * 1.12
    camera.position.set(0, 0.1 + dist * 0.18, dist)
    camera.lookAt(0, 0, 0)
  }, [camera, size.width, size.height])
  return null
}

// a top-down car: the front wheels turn by the road-wheel angle
function CarDiagram({ road }) {
  const deg = (road * 180) / Math.PI
  return (
    <svg width="64" height="96" viewBox="0 0 64 96" aria-hidden="true">
      <rect x="14" y="8" width="36" height="80" rx="12" fill="#2a2925" opacity="0.12" stroke="#2a2925" strokeOpacity="0.5" />
      {[
        [11, 24, true],
        [53, 24, true],
        [11, 72, false],
        [53, 72, false],
      ].map(([x, y, front]) => (
        <rect key={`${x}${y}`} x={x - 4} y={y - 8} width="8" height="16" rx="2" fill="#2a2925" transform={front ? `rotate(${deg} ${x} ${y})` : undefined} />
      ))}
    </svg>
  )
}

export default function SteeringScene({ autoRotate = false, onChange, ...props }) {
  const [t, setT] = useState(null)
  const wheelDeg = t ? Math.round((t.angle * 180) / Math.PI) : 0
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none' }}>
      <Canvas shadows dpr={[1, 1.75]} camera={{ position: [0, 0.2, 1.1], fov: 28, near: 0.02, far: 20 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}>
        <color attach="background" args={[BG]} />
        <hemisphereLight args={['#ffffff', '#d8d6d0', 0.35]} />
        <directionalLight position={[-0.8, 1.6, 1.4]} intensity={1.1} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0002} shadow-normalBias={0.004}>
          <orthographicCamera attach="shadow-camera" args={[-0.5, 0.5, 0.5, -0.5, 0.1, 5]} />
        </directionalLight>
        <Studio />
        <SteeringWheel {...props} onChange={onChange} onTelemetry={setT} />
        <ContactShadows position={[0, -0.3, -0.05]} opacity={0.35} scale={1.2} blur={2.4} far={0.5} resolution={512} color="#1e1a14" />
        <Rig />
        <OrbitControls makeDefault enablePan={false} target={[0, 0, 0]} autoRotate={autoRotate} autoRotateSpeed={0.6} minDistance={0.35} maxDistance={3} />
      </Canvas>
      <div style={{ position: 'absolute', left: 12, top: 12, zIndex: 5, display: 'flex', gap: 12, alignItems: 'center', padding: '10px 14px', borderRadius: 14, background: 'rgba(255,255,255,0.88)', boxShadow: '0 2px 10px rgba(0,0,0,.12)', font: '600 11px/1.6 ui-monospace, Menlo, monospace', color: '#2a2925', letterSpacing: '0.03em' }}>
        <CarDiagram road={t?.road || 0} />
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
            {wheelDeg > 0 ? '+' : ''}
            {wheelDeg}°
          </div>
          <div>wheels {t ? ((t.road * 180) / Math.PI).toFixed(1) : '0.0'}°</div>
          <div>turn ⌀ {t && Number.isFinite(t.radius) ? `${(t.radius * 2).toFixed(1)} m` : 'straight'}</div>
          <div>
            {t?.speed ?? 0} km/h · vol {t?.muted ? 'muted' : (t?.volume ?? 0)}
          </div>
        </div>
      </div>
      <InfoHint>Drag the rim to steer (lock to lock is two and a half turns) · let go and it returns to centre, harder the faster you go · press the middle for the horn · roll the left scroll wheel for volume (press to mute), the right one for speed</InfoHint>
    </div>
  )
}

// The usage tips live behind a small "i" button in the corner instead of a
// line of text over the scene: hover it (or tap it) to read them.
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
