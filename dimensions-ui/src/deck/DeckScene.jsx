import { useEffect, useRef, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import Deck, { deckView } from './Deck.jsx'

// soft overhead key and two side strips, so the laminate catches a gentle
// highlight as the cards turn
function Studio() {
  return (
    <Environment resolution={256}>
      <color attach="background" args={['#8d8f93']} />
      <Lightformer form="rect" intensity={2.4} color="#ffffff" position={[0, 12, 6]} rotation-x={Math.PI / 2.4} scale={[20, 8, 1]} />
      <Lightformer form="rect" intensity={2} color="#fff3e6" position={[-12, 3, 8]} rotation-y={Math.PI / 3} scale={[3, 14, 1]} />
      <Lightformer form="rect" intensity={1.6} color="#eef3ff" position={[12, 3, 8]} rotation-y={-Math.PI / 3} scale={[3, 14, 1]} />
      <Lightformer form="rect" intensity={0.8} color="#ffffff" position={[0, 2, -12]} scale={[18, 5, 1]} />
    </Environment>
  )
}

// fits the cards in view, looking at them nearly head on
function Rig({ layout }) {
  const { camera, size, controls } = useThree()
  useEffect(() => {
    const v = deckView(layout)
    const aspect = size.width / size.height
    const tan = Math.tan(THREE.MathUtils.degToRad(15))
    const d = Math.max(v.h / 2 / tan, v.w / 2 / (tan * aspect)) * 1.12
    camera.position.set(0, v.cy + d * 0.12, d)
    camera.lookAt(0, v.cy, 0)
    if (controls) controls.target.set(0, v.cy, 0)
  }, [camera, size.width, size.height, controls, layout])
  return null
}

export default function DeckScene({ background = '#26282b', autoRotate = false, layout = 'hand', ...props }) {
  const deck = useRef()
  const v = deckView(layout)
  const pill = { pointerEvents: 'auto', font: '600 12px/1 ui-monospace, Menlo, monospace', letterSpacing: '0.12em', textTransform: 'uppercase', padding: '11px 18px', borderRadius: 999, border: 'none', background: '#f4f1ea', color: '#1c1a16', cursor: 'pointer' }
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none', background }}>
      <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 2, 40], fov: 30, near: 0.5, far: 200 }} gl={{ antialias: true, toneMapping: THREE.NeutralToneMapping, toneMappingExposure: 1.0 }}>
        <color attach="background" args={[background]} />
        <hemisphereLight args={['#ffffff', '#555555', 0.35]} />
        <directionalLight position={[-4, 10, 12]} intensity={1.1} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-camera-left={-14} shadow-camera-right={14} shadow-camera-top={12} shadow-camera-bottom={-12} />
        <Studio />
        <Deck ref={deck} layout={layout} {...props} />
        <ContactShadows position={[0, v.cy - v.h / 2 - 0.6, 0]} opacity={0.45} scale={40} blur={2.6} far={10} color="#000000" />
        <Rig layout={layout} />
        <OrbitControls makeDefault enablePan={false} autoRotate={autoRotate} autoRotateSpeed={0.6} minDistance={6} maxDistance={80} />
      </Canvas>
      {layout !== 'single' && (
        <div style={{ position: 'absolute', top: 14, left: 0, right: 0, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
          <button type="button" style={pill} onClick={() => deck.current?.deal()}>
            Deal
          </button>
        </div>
      )}
      <InfoHint>{layout === 'single' ? 'Move the pointer to tilt the card · click it to flip it over' : 'Hover a card to lift it out of the hand · click it to flip it · Deal for a new hand'}</InfoHint>
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
