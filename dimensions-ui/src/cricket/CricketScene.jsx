import { useEffect, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import Cricket from './Cricket.jsx'

const BG = '#e6e5e2'
const TARGET = [0, 0.36, -0.25]

// Soft studio light, like a product shot: long panels for the lacquer on the
// stumps and the oil on the willow to catch.
function Studio() {
  return (
    <Environment resolution={256}>
      <color attach="background" args={['#c6c7c9']} />
      <Lightformer form="rect" intensity={2.3} color="#ffffff" position={[0, 9, 2]} rotation-x={Math.PI / 2} scale={[12, 8, 1]} />
      <Lightformer form="rect" intensity={2.5} color="#fff2df" position={[-7, 3, 4]} rotation-y={Math.PI / 3} scale={[3, 8, 1]} />
      <Lightformer form="rect" intensity={1.5} color="#eef3ff" position={[7, 3, 4]} rotation-y={-Math.PI / 3} scale={[3, 8, 1]} />
      <Lightformer form="rect" intensity={0.9} color="#ffffff" position={[0, 3, -9]} rotation-y={Math.PI} scale={[12, 5, 1]} />
    </Environment>
  )
}

// Frames the wicket with the pitch running away behind it, on any screen.
function Rig() {
  const { camera, size } = useThree()
  useEffect(() => {
    const aspect = size.width / size.height
    const tan = Math.tan(THREE.MathUtils.degToRad(16))
    const dist = Math.max(1.1 / 2 / tan, 1.6 / 2 / (tan * aspect)) * 1.12
    const el = 0.32
    const az = 0.95
    camera.position.set(TARGET[0] + Math.sin(az) * Math.cos(el) * dist, TARGET[1] + Math.sin(el) * dist, TARGET[2] + Math.cos(az) * Math.cos(el) * dist)
    camera.lookAt(...TARGET)
  }, [camera, size.width, size.height])
  return null
}

const btn = (dark) => ({
  height: 32,
  padding: '0 14px',
  borderRadius: 16,
  border: 'none',
  cursor: 'pointer',
  background: dark ? '#1c1a16' : 'rgba(255,255,255,0.9)',
  color: dark ? '#f4f1ea' : '#2a2925',
  font: '600 11px/1 ui-monospace, Menlo, monospace',
  letterSpacing: '0.05em',
  boxShadow: '0 2px 8px rgba(0,0,0,.14), inset 0 0 0 1px rgba(0,0,0,.08)',
})

export default function CricketScene({ autoRotate = false, ...props }) {
  const [cmd, setCmd] = useState({ bowl: 0, reset: 0 })
  const fire = (k) => setCmd((c) => ({ ...c, [k]: c[k] + 1 }))
  useEffect(() => {
    // B to bowl, R to reset (when the page is not typing)
    const key = (e) => {
      if (e.target.closest?.('input, textarea, select, [contenteditable]')) return
      if (e.key === 'b' || e.key === 'B') fire('bowl')
      else if (e.key === 'r' || e.key === 'R') fire('reset')
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none' }}>
      <Canvas shadows dpr={[1, 1.75]} camera={{ position: [2, 1, 1.5], fov: 32, near: 0.02, far: 80 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}>
        <color attach="background" args={[BG]} />
        <fog attach="fog" args={[BG, 7, 16]} />
        <hemisphereLight args={['#ffffff', '#d8d6d0', 0.35]} />
        <directionalLight position={[-2.5, 5, 3]} intensity={1.15} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0002} shadow-normalBias={0.01}>
          <orthographicCamera attach="shadow-camera" args={[-2.5, 2.5, 2.5, -2.5, 0.5, 14]} />
        </directionalLight>
        <Studio />
        <Cricket {...props} {...cmd} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.0005, -3]} receiveShadow>
          <planeGeometry args={[60, 60]} />
          <shadowMaterial opacity={0.18} />
        </mesh>
        <ContactShadows position={[0, 0.0012, 0]} opacity={0.45} scale={4} blur={2} far={1} resolution={1024} color="#2a2620" />
        <Rig />
        <OrbitControls makeDefault enablePan={false} target={TARGET} autoRotate={autoRotate} autoRotateSpeed={0.6} minDistance={0.8} maxDistance={9} minPolarAngle={0.15} maxPolarAngle={1.52} />
      </Canvas>
      <div style={{ position: 'absolute', left: 12, bottom: 12, zIndex: 5, display: 'flex', gap: 8, flexWrap: 'wrap', maxWidth: 'calc(100% - 64px)' }}>
        <button type="button" style={btn(true)} onClick={() => fire('bowl')}>
          Bowl
        </button>
        <button type="button" style={btn(false)} onClick={() => fire('reset')}>
          Reset
        </button>
      </div>
      <InfoHint>Bowl (or click the stumps, or press B) · the ball takes the stumps and the bails fly · raise the pace to uproot one · drag a stump to pull it out of the ground and look at its spike · Reset (R) puts the wicket back</InfoHint>
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
