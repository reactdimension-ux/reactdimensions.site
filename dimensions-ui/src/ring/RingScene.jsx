import { useEffect, useRef, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import Ring from './Ring.jsx'
import ControlDock from '../controls/ControlDock.jsx'

// soft studio: a grey room with tall strip lights, which is what gives
// polished metal its long, soft highlights
function Studio() {
  return (
    <Environment resolution={512}>
      <color attach="background" args={['#a3a3a6']} />
      <Lightformer form="rect" intensity={2.4} color="#ffffff" position={[0, 9, 0]} rotation-x={Math.PI / 2} scale={[12, 6, 1]} />
      <Lightformer form="rect" intensity={2.6} color="#ffffff" position={[-6, 3, 3]} rotation-y={Math.PI / 3} scale={[3, 10, 1]} />
      <Lightformer form="rect" intensity={2.2} color="#ffffff" position={[6, 3, 2]} rotation-y={-Math.PI / 3} scale={[3, 10, 1]} />
      <Lightformer form="rect" intensity={1.2} color="#ffffff" position={[0, 2, -7]} scale={[10, 4, 1]} />
      <Lightformer form="rect" intensity={0.6} color="#f2f2f2" position={[0, -3, 5]} rotation-x={-Math.PI / 4} scale={[10, 3, 1]} />
    </Environment>
  )
}

function Rig({ radius }) {
  const { camera, size } = useThree()
  useEffect(() => {
    const aspect = size.width / size.height
    const tan = Math.tan(THREE.MathUtils.degToRad(15))
    const span = radius * 2 * 1.9
    const dist = Math.max(span / 2 / tan, span / 2 / (tan * aspect))
    camera.position.copy(new THREE.Vector3(0.45, 0.42, 1).normalize().multiplyScalar(dist).add(new THREE.Vector3(0, radius * 0.9, 0)))
    camera.lookAt(0, radius * 0.9, 0)
  }, [camera, size.width, size.height, radius])
  return null
}

const LABEL = { upright: 'Spin', spin: 'Spinning…', fall: 'Spinning…', flat: 'Stand up', rise: 'Standing…' }

export default function RingScene({ background = '#e7e7e7', autoRotate = false, ...props }) {
  const ring = useRef()
  const [mode, setMode] = useState('upright')
  const radius = (props.innerDiameter ?? 17.3) / 20 + (props.thickness ?? 1.8) / 10

  useEffect(() => {
    const onKey = (e) => {
      if ((e.code === 'Space' || e.code === 'Enter') && e.target === document.body) {
        e.preventDefault()
        ring.current?.act()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const busy = mode === 'spin' || mode === 'fall' || mode === 'rise'

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none', background, userSelect: 'none', WebkitUserSelect: 'none' }}>
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [1.5, 1.6, 4], fov: 30, near: 0.05, far: 100 }}
        gl={{ antialias: true, toneMapping: THREE.NeutralToneMapping, toneMappingExposure: 1.0 }}
      >
        <color attach="background" args={[background]} />
        <directionalLight position={[-0.6, 8, 1.2]} intensity={0.6} castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0002} shadow-camera-left={-3} shadow-camera-right={3} shadow-camera-top={3} shadow-camera-bottom={-3} />
        <Studio />
        <Ring ref={ring} {...props} onMode={setMode} />
        <mesh rotation-x={-Math.PI / 2} receiveShadow>
          <planeGeometry args={[40, 40]} />
          <shadowMaterial opacity={0.07} />
        </mesh>
        <ContactShadows position={[0, 0.002, 0]} opacity={0.45} scale={6} blur={1.6} far={1.2} resolution={512} />
        <Rig radius={radius} />
        <OrbitControls makeDefault enablePan={false} target={[0, radius * 0.9, 0]} autoRotate={autoRotate} autoRotateSpeed={0.6} minDistance={radius * 1.6} maxDistance={radius * 14} maxPolarAngle={1.52} />
      </Canvas>

      <ControlDock corner="tl">
        <button
          onClick={() => ring.current?.act()}
          disabled={busy}
          style={{ pointerEvents: 'auto', font: '600 12px/1 ui-monospace, Menlo, monospace', letterSpacing: '0.12em', textTransform: 'uppercase', padding: '11px 18px', borderRadius: 999, border: 'none', background: '#1c1a16', color: '#f4f1ea', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.55 : 1, minWidth: 120 }}
        >
          {LABEL[mode]}
        </button>
      </ControlDock>
      <InfoHint>
        Click the ring to spin it · drag it to turn, flick it to spin · drag the background to look, scroll to zoom in close
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
