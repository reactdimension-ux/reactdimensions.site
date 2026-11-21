import { useEffect, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import Shirt from './Shirt.jsx'
import ControlDock from '../controls/ControlDock.jsx'

const TARGET = [0, 0.68, 0]

function Studio() {
  return (
    <Environment resolution={256}>
      <color attach="background" args={['#cfcfcf']} />
      <Lightformer form="rect" intensity={1.2} color="#ffffff" position={[-6, 6, 8]} rotation-y={Math.PI / 5} scale={[8, 10, 1]} />
      <Lightformer form="rect" intensity={0.8} color="#ffffff" position={[7, 4, 6]} rotation-y={-Math.PI / 4} scale={[6, 8, 1]} />
      <Lightformer form="rect" intensity={0.7} color="#ffffff" position={[0, 6, -8]} rotation-y={Math.PI} scale={[10, 6, 1]} />
      <Lightformer form="rect" intensity={0.9} color="#ffffff" position={[0, 12, 0]} rotation-x={Math.PI / 2} scale={[12, 8, 1]} />
    </Environment>
  )
}

function Rig() {
  const { camera, size } = useThree()
  useEffect(() => {
    const aspect = size.width / size.height
    const tan = Math.tan(THREE.MathUtils.degToRad(15))
    const dist = Math.max(1.85 / 2 / tan, 1.9 / 2 / (tan * aspect)) * 1.08
    camera.position.set(Math.sin(0.35) * dist, TARGET[1] + dist * 0.12, Math.cos(0.35) * dist)
    camera.lookAt(...TARGET)
  }, [camera, size.width, size.height])
  return null
}

export default function ShirtScene({ autoRotate = false, background = '#d9d9d8', ...props }) {
  const [buttoned, setButtoned] = useState(props.buttoned ?? true)
  useEffect(() => setButtoned(props.buttoned ?? true), [props.buttoned])
  const setAll = (v) => {
    setButtoned(v)
    props.onChange?.({ buttoned: v })
  }
  const btn = {
    pointerEvents: 'auto',
    font: '600 11px/1 ui-monospace, Menlo, monospace',
    letterSpacing: '.1em',
    textTransform: 'uppercase',
    padding: '9px 14px',
    borderRadius: 999,
    border: 'none',
    cursor: 'pointer',
  }
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none', background }}>
      <Canvas shadows dpr={[1, 1.75]} camera={{ position: [1.5, 1, 4], fov: 30, near: 0.05, far: 50 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}>
        <color attach="background" args={[background]} />
        <hemisphereLight args={['#ffffff', '#b8b8b8', 0.3]} />
        <directionalLight position={[-3, 5, 4]} intensity={1.0} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-normalBias={0.02} shadow-camera-left={-2} shadow-camera-right={2} shadow-camera-top={2.5} shadow-camera-bottom={-1} />
        <Studio />
        <Shirt {...props} buttoned={buttoned} onChange={(o) => ('buttoned' in o ? setAll(o.buttoned) : props.onChange?.(o))} />
        <ContactShadows position={[0, -0.32, 0]} opacity={0.22} scale={4} blur={2.8} far={1.2} />
        <Rig />
        <OrbitControls makeDefault enablePan={false} target={TARGET} autoRotate={autoRotate} autoRotateSpeed={0.8} minDistance={1.6} maxDistance={8} minPolarAngle={0.3} maxPolarAngle={2.2} />
      </Canvas>
      <ControlDock corner="tl">
        <button style={{ ...btn, background: buttoned ? '#1c1a16' : '#ffffffcc', color: buttoned ? '#f4f1ea' : '#1c1a16' }} onClick={() => setAll(true)}>
          Button all
        </button>
        <button style={{ ...btn, background: !buttoned ? '#1c1a16' : '#ffffffcc', color: !buttoned ? '#f4f1ea' : '#1c1a16' }} onClick={() => setAll(false)}>
          Unbutton all
        </button>
      </ControlDock>
      <InfoHint>
        Click a button to do it up or undo it · drag the fabric to pull it · drag the background to turn
      </InfoHint>
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
