import { useEffect, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import Bat from './Bat.jsx'
import ControlDock from '../controls/ControlDock.jsx'

const BG = '#e6e5e2'
const TARGET = [0.05, 0.42, 0]

// Soft studio light: long panels so the oiled face and the rolled edges of
// the willow pick up a gentle highlight, and the grip's texture reads.
function Studio() {
  return (
    <Environment resolution={256}>
      <color attach="background" args={['#c6c7c9']} />
      <Lightformer form="rect" intensity={2.3} color="#ffffff" position={[0, 9, 2]} rotation-x={Math.PI / 2} scale={[12, 8, 1]} />
      <Lightformer form="rect" intensity={2.6} color="#fff2df" position={[-6, 3, 5]} rotation-y={Math.PI / 4} scale={[3, 8, 1]} />
      <Lightformer form="rect" intensity={1.5} color="#eef3ff" position={[6, 3, 4]} rotation-y={-Math.PI / 3} scale={[3, 8, 1]} />
      <Lightformer form="rect" intensity={0.9} color="#ffffff" position={[0, 3, -9]} rotation-y={Math.PI} scale={[12, 5, 1]} />
    </Environment>
  )
}

// Frames the bat standing, with room round it to knock it over and swing it.
function Rig() {
  const { camera, size } = useThree()
  useEffect(() => {
    const aspect = size.width / size.height
    const tan = Math.tan(THREE.MathUtils.degToRad(16))
    const dist = Math.max(1.15 / 2 / tan, 1.5 / 2 / (tan * aspect)) * 1.1
    const el = 0.28
    const az = 0.42
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

export default function BatScene({ autoRotate = false, ...props }) {
  const [cmd, setCmd] = useState({ stand: 0, topple: 0, resetBall: 0 })
  const fire = (k) => setCmd((c) => ({ ...c, [k]: c[k] + 1 }))
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none' }}>
      <Canvas shadows dpr={[1, 1.75]} camera={{ position: [1, 0.8, 2.4], fov: 32, near: 0.02, far: 60 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}>
        <color attach="background" args={[BG]} />
        <hemisphereLight args={['#ffffff', '#d8d6d0', 0.35]} />
        <directionalLight position={[-2, 4.5, 3]} intensity={1.15} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0002} shadow-normalBias={0.01}>
          <orthographicCamera attach="shadow-camera" args={[-2.2, 2.2, 2.2, -2.2, 0.5, 12]} />
        </directionalLight>
        <Studio />
        <Bat {...props} {...cmd} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.0005, 0]} receiveShadow>
          <planeGeometry args={[40, 40]} />
          <shadowMaterial opacity={0.2} />
        </mesh>
        <ContactShadows position={[0, 0.0008, 0]} opacity={0.45} scale={4} blur={2} far={1} resolution={1024} color="#2a2620" />
        <Rig />
        <OrbitControls makeDefault enablePan={false} target={TARGET} autoRotate={autoRotate} autoRotateSpeed={0.6} minDistance={0.5} maxDistance={7} minPolarAngle={0.1} maxPolarAngle={1.53} />
      </Canvas>
      <ControlDock corner="bl">
        <button type="button" style={btn(true)} onClick={() => fire('topple')}>
          Knock over
        </button>
        <button type="button" style={btn(false)} onClick={() => fire('stand')}>
          Stand up
        </button>
        {props.ball !== false && (
          <button type="button" style={btn(false)} onClick={() => fire('resetBall')}>
            Reset ball
          </button>
        )}
      </ControlDock>
      <InfoHint>Drag the bat to pick it up and swing it, let go to drop or throw it · swing it through the ball · click it to knock it over, click again to stand it up</InfoHint>
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
