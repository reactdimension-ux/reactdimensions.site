import { useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import Racket from './Racket.jsx'

function Studio() {
  return (
    <Environment resolution={256}>
      <color attach="background" args={['#d2d2d0']} />
      <Lightformer form="rect" intensity={2.6} color="#ffffff" position={[-5, 6, 6]} rotation-y={Math.PI / 5} scale={[6, 10, 1]} />
      <Lightformer form="rect" intensity={1.4} color="#ffffff" position={[6, 4, 4]} rotation-y={-Math.PI / 4} scale={[5, 8, 1]} />
      <Lightformer form="rect" intensity={1.6} color="#ffffff" position={[0, 10, 0]} rotation-x={Math.PI / 2} scale={[12, 8, 1]} />
      <Lightformer form="ring" intensity={1.2} color="#f4f6ff" position={[0, 2, -7]} scale={4} />
    </Environment>
  )
}

export default function RacketScene({ background = '#ecebe8', autoRotate = false, ...props }) {
  const [hitKey, setHitKey] = useState(0)
  const [twirlKey, setTwirlKey] = useState(0)
  const btn = { pointerEvents: 'auto', font: '600 12px/1 ui-monospace, Menlo, monospace', letterSpacing: '0.12em', textTransform: 'uppercase', padding: '11px 18px', borderRadius: 999, border: 'none', cursor: 'pointer', boxShadow: '0 6px 18px rgba(0,0,0,.18)' }
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none', background }}>
      <Canvas shadows dpr={[1, 2]} camera={{ position: [0.34, 0.1, 1.48], fov: 30, near: 0.01, far: 20 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}>
        <color attach="background" args={[background]} />
        <hemisphereLight args={['#ffffff', '#a8a8a4', 0.45]} />
        <directionalLight position={[-1.2, 2.5, 2]} intensity={1.8} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0001} shadow-normalBias={0.0006} shadow-camera-left={-0.6} shadow-camera-right={0.6} shadow-camera-top={0.6} shadow-camera-bottom={-0.6} />
        <directionalLight position={[1, 0.8, -2]} intensity={0.8} />
        <Studio />
        <Racket {...props} autoRotate={autoRotate} hitKey={hitKey} twirlKey={twirlKey} />
        <ContactShadows position={[0, -0.39, 0]} opacity={0.35} scale={1.2} blur={2.6} far={0.5} resolution={512} color="#3a3a3a" />
        <OrbitControls makeDefault enablePan={false} target={[0, 0.0, 0]} autoRotate={autoRotate} autoRotateSpeed={0.6} minDistance={0.08} maxDistance={2.6} />
      </Canvas>

      <div style={{ position: 'absolute', top: 14, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 10, pointerEvents: 'none' }}>
        <button onClick={() => setHitKey((k) => k + 1)} style={{ ...btn, background: '#1c1a16', color: '#f4f1ea' }}>
          Hit
        </button>
        <button onClick={() => setTwirlKey((k) => k + 1)} style={{ ...btn, background: 'rgba(255,255,255,.9)', color: '#1c1a16' }}>
          Twirl
        </button>
      </div>
      <InfoHint>
        Tap anywhere on the strings (or press Hit for the sweet spot) and the bed dents and trampolines where it is struck; lower tension pockets deeper and pings lower · Twirl spins it in the hand · zoom right in to see the weave, the grommets and the stencil sitting only on the string · drag to look around
      </InfoHint>
    </div>
  )
}

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
