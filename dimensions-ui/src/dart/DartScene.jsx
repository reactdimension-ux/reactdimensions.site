import { useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Environment, Lightformer, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import Dart from './Dart.jsx'

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

export default function DartScene({ background = '#d9d6d2', autoRotate = false, ...props }) {
  const [throwKey, setThrowKey] = useState(0)
  const btn = { pointerEvents: 'auto', font: '600 12px/1 ui-monospace, Menlo, monospace', letterSpacing: '0.12em', textTransform: 'uppercase', padding: '11px 18px', borderRadius: 999, border: 'none', cursor: 'pointer', boxShadow: '0 6px 18px rgba(0,0,0,.18)' }
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none', background }}>
      <Canvas shadows dpr={[1, 1.75]} camera={{ position: [0.26, 0.07, 0.3], fov: 32, near: 0.005, far: 20 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}>
        <color attach="background" args={[background]} />
        <hemisphereLight args={['#ffffff', '#8f8f8f', 0.5]} />
        <directionalLight position={[1.2, 2, 2.2]} intensity={1.6} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0002} shadow-normalBias={0.004} shadow-camera-left={-0.5} shadow-camera-right={0.5} shadow-camera-top={0.5} shadow-camera-bottom={-0.5} shadow-camera-near={0.5} shadow-camera-far={6} shadow-radius={5} />
        <Studio />
        {/* the wall it hangs on */}
        <mesh position={[0, 0, -FACE_BACK]} receiveShadow>
          <planeGeometry args={[6, 4]} />
          <meshStandardMaterial color={background} roughness={0.95} />
        </mesh>
        <Dart {...props} throwKey={throwKey} />
        <OrbitControls makeDefault enablePan={false} target={[0.01, 0.01, 0.07]} autoRotate={autoRotate} autoRotateSpeed={0.6} minDistance={0.15} maxDistance={2} minAzimuthAngle={-1.3} maxAzimuthAngle={1.3} />
      </Canvas>

      <div style={{ position: 'absolute', top: 14, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 10, pointerEvents: 'none' }}>
        <button onClick={() => setThrowKey((k) => k + 1)} style={{ ...btn, background: '#1c1a16', color: '#f4f1ea' }}>
          Throw
        </button>
      </div>
      <InfoHint>
        Throw, or click the target where you want it to land · it flies in slow motion with the flights&apos; fish-tail wobble, goes in tail-up and shudders round the point · old holes close up · drag to look around
      </InfoHint>
    </div>
  )
}

const FACE_BACK = 0.045

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
