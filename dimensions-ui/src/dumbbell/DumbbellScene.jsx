import { useEffect, useRef, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import Dumbbell from './Dumbbell.jsx'
import ControlDock from '../controls/ControlDock.jsx'

// soft studio, like a product shot: a big overhead box and two strip lights
function Studio() {
  return (
    <Environment resolution={256}>
      <color attach="background" args={['#a8a8a8']} />
      <Lightformer form="rect" intensity={2.2} color="#ffffff" position={[0, 9, 0]} rotation-x={Math.PI / 2} scale={[12, 8, 1]} />
      <Lightformer form="rect" intensity={1.8} color="#ffffff" position={[-6, 3, 4]} rotation-y={Math.PI / 3} scale={[3, 9, 1]} />
      <Lightformer form="rect" intensity={1.4} color="#ffffff" position={[6, 3, 3]} rotation-y={-Math.PI / 3} scale={[3, 9, 1]} />
      <Lightformer form="rect" intensity={0.8} color="#ffffff" position={[0, 2, -7]} scale={[10, 4, 1]} />
    </Environment>
  )
}

const TARGET = new THREE.Vector3(0, 0.07, 0)

function Rig() {
  const { camera, size } = useThree()
  useEffect(() => {
    const aspect = size.width / size.height
    const tan = Math.tan(THREE.MathUtils.degToRad(15))
    const span = 0.72
    const dist = Math.max(span / 2 / tan, span / 2 / (tan * aspect)) * 1.05
    camera.position.copy(new THREE.Vector3(0.42, 0.62, 1).normalize().multiplyScalar(dist).add(TARGET))
    camera.lookAt(TARGET)
  }, [camera, size.width, size.height])
  return null
}

const btn = {
  pointerEvents: 'auto',
  font: '600 12px/1 ui-monospace, Menlo, monospace',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  padding: '11px 16px',
  borderRadius: 999,
  border: 'none',
  background: '#1c1a16',
  color: '#f4f1ea',
  cursor: 'pointer',
  boxShadow: '0 6px 18px rgba(0,0,0,.18)',
}

export default function DumbbellScene({ background = '#e4e4e4', autoRotate = false, ...props }) {
  const pair = useRef()

  useEffect(() => {
    const onKey = (e) => {
      if ((e.code === 'Space' || e.code === 'Enter') && e.target === document.body) {
        e.preventDefault()
        pair.current?.drop()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none', background, userSelect: 'none', WebkitUserSelect: 'none' }}>
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [0.5, 0.7, 1.4], fov: 30, near: 0.01, far: 50 }}
        gl={{ antialias: true, toneMapping: THREE.NeutralToneMapping, toneMappingExposure: 1.0 }}
      >
        <color attach="background" args={[background]} />
        <directionalLight position={[-0.8, 3, 1.2]} intensity={0.8} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.00005} shadow-normalBias={0.0015} shadow-camera-left={-0.9} shadow-camera-right={0.9} shadow-camera-top={0.9} shadow-camera-bottom={-0.9} shadow-camera-near={0.5} shadow-camera-far={6} />
        <Studio />
        <Dumbbell ref={pair} {...props} />
        <mesh rotation-x={-Math.PI / 2} receiveShadow>
          <planeGeometry args={[20, 20]} />
          <shadowMaterial opacity={0.1} />
        </mesh>
        <ContactShadows position={[0, 0.0005, 0]} opacity={0.55} scale={3} blur={1.8} far={0.4} resolution={1024} />
        <Rig />
        <OrbitControls makeDefault enablePan={false} target={TARGET} autoRotate={autoRotate} autoRotateSpeed={0.5} minDistance={0.3} maxDistance={4} maxPolarAngle={1.5} />
      </Canvas>

      <ControlDock corner="tl">
        <button onClick={() => pair.current?.drop()} style={btn}>
          Drop
        </button>
        <button onClick={() => pair.current?.stand()} style={{ ...btn, background: 'rgba(255,255,255,0.78)', color: '#2a2925' }}>
          Stand up
        </button>
        <button onClick={() => pair.current?.lay()} style={{ ...btn, background: 'rgba(255,255,255,0.78)', color: '#2a2925' }}>
          Lay down
        </button>
      </ControlDock>
      <InfoHint>
        Drag a dumbbell to pick it up by that point, let go to drop or throw it · click one to roll it · drag the background to look
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
