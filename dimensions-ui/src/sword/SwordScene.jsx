import { useEffect, useRef, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import Sword from './Sword.jsx'

const BG = '#e9e8e5'

// Polished steel is nothing but reflections, so the studio is built for it:
// long strip lights the blade's flats and bevels pick up as clean lines, a
// warm key for the bronze, and darker surroundings so the edges read.
function Studio() {
  return (
    <Environment resolution={512}>
      <color attach="background" args={['#9a9da2']} />
      <Lightformer form="rect" intensity={4} color="#ffffff" position={[-2.5, 1.5, 2]} rotation-y={Math.PI / 4} scale={[0.4, 6, 1]} />
      <Lightformer form="rect" intensity={3.2} color="#fff0dc" position={[2.5, 1, 2]} rotation-y={-Math.PI / 4} scale={[0.6, 5, 1]} />
      <Lightformer form="rect" intensity={2} color="#ffffff" position={[0, 4, 1]} rotation-x={Math.PI / 2} scale={[5, 1, 1]} />
      <Lightformer form="rect" intensity={1.2} color="#dfe8ff" position={[0, 0, -4]} rotation-y={Math.PI} scale={[6, 4, 1]} />
      <Lightformer form="ring" intensity={2.5} color="#ffffff" position={[1.5, 2.5, 3]} scale={0.6} />
    </Environment>
  )
}

function Rig() {
  const { camera, size } = useThree()
  useEffect(() => {
    const aspect = size.width / size.height
    const tan = Math.tan(THREE.MathUtils.degToRad(15))
    const dist = Math.max(1.22 / 2 / tan, 0.62 / 2 / (tan * aspect)) * 1.0
    camera.position.set(0.1, 0.05, dist)
    camera.lookAt(0, 0, 0)
  }, [camera, size.width, size.height])
  return null
}

export default function SwordScene({ autoRotate = false, ...props }) {
  const [speed, setSpeed] = useState(0)
  const last = useRef(0)
  const report = (v) => {
    const now = performance.now()
    if (now - last.current < 100) return
    last.current = now
    setSpeed(v)
  }
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none' }}>
      <Canvas shadows dpr={[1, 1.75]} camera={{ position: [0.1, 0.05, 2.2], fov: 30, near: 0.02, far: 30 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}>
        <color attach="background" args={[BG]} />
        <hemisphereLight args={['#ffffff', '#d6d3cc', 0.25]} />
        <directionalLight position={[-1.2, 2.5, 2]} intensity={1.2} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0002} shadow-normalBias={0.004}>
          <orthographicCamera attach="shadow-camera" args={[-1, 1, 1, -1, 0.1, 8]} />
        </directionalLight>
        <Studio />
        <Sword {...props} onReport={report} />
        <ContactShadows position={[0, -0.62, 0]} opacity={0.35} scale={2} blur={2.6} far={1.2} resolution={512} color="#1e1a14" />
        <Rig />
        <OrbitControls makeDefault enablePan={false} target={[0, 0, 0]} autoRotate={autoRotate} autoRotateSpeed={0.6} minDistance={0.4} maxDistance={5} />
      </Canvas>
      {speed > 1 && (
        <div style={{ position: 'absolute', left: 12, top: 12, zIndex: 5, padding: '8px 12px', borderRadius: 12, background: 'rgba(255,255,255,0.88)', boxShadow: '0 2px 8px rgba(0,0,0,.12)', font: '600 11px/1.5 ui-monospace, Menlo, monospace', color: '#2a2925' }}>
          tip <span style={{ fontSize: 16, fontWeight: 800 }}>{speed.toFixed(1)}</span> m/s
        </div>
      )}
      <InfoHint>Drag the sword to take hold of it and swing it: it has the weight and balance of a real one · tap the blade to make it ring · let go and it goes back on display</InfoHint>
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
