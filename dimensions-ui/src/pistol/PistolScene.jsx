import { useEffect, useRef, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei'
import { EffectComposer, N8AO, ToneMapping } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import * as THREE from 'three'
import Pistol, { pistolView } from './Pistol.jsx'

const V = pistolView
const FLOOR_Y = V.minY - 0.45
const CX = (V.minX + V.maxX) / 2
const CY = (V.minY + V.maxY) / 2

// A product-shot studio: a big soft key overhead, tall strip lights either
// side for long highlights down the slide, and a dim fill from behind so the
// black polymer keeps its shape against the backdrop.
function Studio() {
  return (
    <Environment resolution={512}>
      <color attach="background" args={['#a7a8ab']} />
      <Lightformer form="rect" intensity={2.6} color="#ffffff" position={[0, 14, 4]} rotation-x={Math.PI / 2} scale={[24, 10, 1]} />
      <Lightformer form="rect" intensity={4} color="#ffffff" position={[-14, 4, 8]} rotation-y={Math.PI / 3.2} scale={[3, 18, 1]} />
      <Lightformer form="rect" intensity={3.2} color="#fff4e8" position={[14, 3, 8]} rotation-y={-Math.PI / 3.2} scale={[3, 18, 1]} />
      <Lightformer form="rect" intensity={1.6} color="#e8eeff" position={[0, 4, -14]} scale={[22, 6, 1]} />
      <Lightformer form="ring" intensity={1.2} color="#ffffff" position={[6, 8, 12]} scale={4} />
    </Environment>
  )
}

// a three-quarter view from the right and a little above, like a catalogue shot
function Rig() {
  const { camera, size, controls } = useThree()
  useEffect(() => {
    const aspect = size.width / size.height
    const tan = Math.tan(THREE.MathUtils.degToRad(15))
    const w = V.maxX - V.minX + 3
    const h = V.maxY - FLOOR_Y + 2.5
    const d = Math.max(h / 2 / tan, w / 2 / (tan * aspect)) * 1.12
    const dir = new THREE.Vector3(0.42, 0.22, 1).normalize()
    camera.position.set(CX + dir.x * d, CY + dir.y * d, dir.z * d)
    camera.lookAt(CX, CY, 0)
    if (controls) controls.target.set(CX, CY, 0)
  }, [camera, size.width, size.height, controls])
  return null
}

const KEYS = new Set(['KeyR', 'KeyT', 'KeyM', 'Space'])

export default function PistolScene({ background = '#e6e6e4', autoRotate = false, ...props }) {
  const gun = useRef()
  const box = useRef()
  const [focused, setFocused] = useState(false)

  const onKeyDown = (e) => {
    if (!KEYS.has(e.code) || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return
    e.preventDefault()
    if (e.code === 'KeyR') gun.current?.rack()
    if (e.code === 'KeyT' || e.code === 'Space') gun.current?.fire()
    if (e.code === 'KeyM') gun.current?.toggleMag()
  }

  const pill = { pointerEvents: 'auto', font: '600 12px/1 ui-monospace, Menlo, monospace', letterSpacing: '0.12em', textTransform: 'uppercase', padding: '11px 16px', borderRadius: 999, border: 'none', background: '#1c1a16', color: '#f4f1ea', cursor: 'pointer' }

  return (
    <div
      ref={box}
      tabIndex={0}
      aria-label="Pistol, unloaded. Keys: R racks the slide, T or Space dry-fires, M drops or seats the magazine."
      onKeyDown={onKeyDown}
      onPointerDown={() => box.current?.focus({ preventScroll: true })}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none', background, userSelect: 'none', WebkitUserSelect: 'none', outline: 'none' }}
    >
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [10, 2, 40], fov: 30, near: 0.5, far: 300 }}
        gl={{ antialias: false, toneMapping: THREE.NoToneMapping }}
      >
        <color attach="background" args={[background]} />
        <hemisphereLight args={['#ffffff', '#9a9a98', 0.3]} />
        <directionalLight
          position={[-6, 22, 10]}
          intensity={1.1}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-bias={-0.0003}
          shadow-normalBias={0.02}
          shadow-camera-left={-14}
          shadow-camera-right={14}
          shadow-camera-top={14}
          shadow-camera-bottom={-14}
        />
        <Studio />
        <Pistol ref={gun} {...props} />
        <ContactShadows position={[0, FLOOR_Y, 0]} opacity={0.5} scale={36} blur={2.6} far={6} resolution={1024} color="#1d1e20" />
        <Rig />
        <OrbitControls makeDefault enablePan={false} target={[CX, CY, 0]} autoRotate={autoRotate} autoRotateSpeed={0.6} minDistance={8} maxDistance={110} />
        <EffectComposer disableNormalPass multisampling={4}>
          <N8AO aoRadius={0.9} distanceFalloff={0.6} intensity={2.2} quality="high" />
          <ToneMapping mode={ToneMappingMode.AGX} />
        </EffectComposer>
      </Canvas>

      <div style={{ position: 'absolute', top: 14, left: 12, right: 12, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8, pointerEvents: 'none' }}>
        <button type="button" style={pill} onClick={() => gun.current?.rack()}>Rack</button>
        <button type="button" style={pill} onClick={() => gun.current?.fire()}>Dry fire</button>
        <button type="button" style={pill} onClick={() => gun.current?.toggleMag()}>Magazine</button>
      </div>
      <InfoHint>
        Drag the slide back and let go · click the trigger to dry-fire; it stays back until you rack · click the magazine release or baseplate
        <br />
        {focused ? 'Keys: R rack · T or Space dry-fire · M magazine' : 'Click the pistol to use the keyboard too'}
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
