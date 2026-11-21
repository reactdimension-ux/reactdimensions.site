import { useEffect, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import BowlingPin from './BowlingPin.jsx'
import ControlDock from '../controls/ControlDock.jsx'

const BG = '#e2e0dc'

// A bowling centre's light: long strip lights overhead running down the lane
// (they are what draw those long highlights down a glossy pin), and soft
// fill from the sides.
function Studio() {
  return (
    <Environment resolution={256}>
      <color attach="background" args={['#b9bbbe']} />
      {[-0.8, 0, 0.8].map((x) => (
        <Lightformer key={x} form="rect" intensity={3} color="#ffffff" position={[x, 5, 0]} rotation-x={Math.PI / 2} scale={[0.35, 12, 1]} />
      ))}
      <Lightformer form="rect" intensity={2.2} color="#fff2e0" position={[-5, 2, 3]} rotation-y={Math.PI / 3} scale={[3, 6, 1]} />
      <Lightformer form="rect" intensity={1.6} color="#eef3ff" position={[5, 2, 3]} rotation-y={-Math.PI / 3} scale={[3, 6, 1]} />
      <Lightformer form="rect" intensity={0.7} color="#ffffff" position={[0, 2, -8]} rotation-y={Math.PI} scale={[10, 4, 1]} />
    </Environment>
  )
}

// One pin: close and low, so it stands tall. The rack: from up the lane.
function Rig({ rack }) {
  const { camera, size, controls } = useThree()
  useEffect(() => {
    const aspect = size.width / size.height
    const tan = Math.tan(THREE.MathUtils.degToRad(15))
    const target = rack ? new THREE.Vector3(0, 0.12, -0.42) : new THREE.Vector3(0, 0.19, 0)
    const [h, w, el, az] = rack ? [0.9, 1.6, 0.42, 0.28] : [0.5, 0.42, 0.14, 0.35]
    const dist = Math.max(h / 2 / tan, w / 2 / (tan * aspect)) * 1.1
    camera.position.set(target.x + Math.sin(az) * Math.cos(el) * dist, target.y + Math.sin(el) * dist, target.z + Math.cos(az) * Math.cos(el) * dist)
    camera.lookAt(target)
    if (controls) {
      controls.target.copy(target)
      controls.update()
    }
  }, [camera, size.width, size.height, rack, controls])
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

export default function BowlingPinScene({ autoRotate = false, ...props }) {
  const [cmd, setCmd] = useState({ bowl: 0, reset: 0 })
  const fire = (k) => setCmd((c) => ({ ...c, [k]: c[k] + 1 }))
  const rack = Number(props.pins) === 10
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none' }}>
      <Canvas shadows dpr={[1, 1.75]} camera={{ position: [0.4, 0.3, 1.4], fov: 30, near: 0.02, far: 60 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}>
        <color attach="background" args={[BG]} />
        <fog attach="fog" args={[BG, 4, 12]} />
        <hemisphereLight args={['#ffffff', '#d6cfc2', 0.3]} />
        <directionalLight position={[-1.5, 4, 2.5]} intensity={1.1} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0002} shadow-normalBias={0.01}>
          <orthographicCamera attach="shadow-camera" args={[-2, 2, 2, -2, 0.5, 10]} />
        </directionalLight>
        <Studio />
        <BowlingPin {...props} {...cmd} />
        <ContactShadows position={[0, 0.001, -0.3]} opacity={0.5} scale={2.2} blur={1.6} far={0.5} resolution={1024} color="#1e1a14" />
        <Rig rack={rack} />
        <OrbitControls makeDefault enablePan={false} autoRotate={autoRotate} autoRotateSpeed={0.6} minDistance={0.35} maxDistance={6} minPolarAngle={0.1} maxPolarAngle={1.52} />
      </Canvas>
      <ControlDock corner="bl">
        <button type="button" style={btn(true)} onClick={() => fire('bowl')}>
          Bowl
        </button>
        <button type="button" style={btn(false)} onClick={() => fire('reset')}>
          Set pins
        </button>
      </ControlDock>
      <InfoHint>Tap a pin to make it wobble, press longer to knock it over · drag a pin to pick it up and throw it · Bowl sends a ball down the lane · Set pins stands them back up</InfoHint>
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
