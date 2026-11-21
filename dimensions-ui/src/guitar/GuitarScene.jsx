import { useEffect, useRef, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import Guitar, { GUITAR_EXTENT } from './Guitar.jsx'
import { CHORDS } from './strings.js'
import ControlDock from '../controls/ControlDock.jsx'

// a warm studio: big soft boxes, which give a gloss finish its long highlights
function Studio() {
  return (
    <Environment resolution={512}>
      <color attach="background" args={['#9c9894']} />
      <Lightformer form="rect" intensity={2.2} color="#fff8ef" position={[0, 9, 0]} rotation-x={Math.PI / 2} scale={[12, 6, 1]} />
      <Lightformer form="rect" intensity={2.6} color="#ffffff" position={[-6, 3, 4]} rotation-y={Math.PI / 3} scale={[3, 10, 1]} />
      <Lightformer form="rect" intensity={1.8} color="#fff4e6" position={[6, 3, 3]} rotation-y={-Math.PI / 3} scale={[3, 10, 1]} />
      <Lightformer form="rect" intensity={1.0} color="#ffffff" position={[0, 2, -7]} scale={[10, 4, 1]} />
    </Environment>
  )
}

const TARGET = new THREE.Vector3(0, GUITAR_EXTENT.center, GUITAR_EXTENT.depth)

function Rig() {
  const { camera, size } = useThree()
  useEffect(() => {
    const aspect = size.width / size.height
    const tan = Math.tan(THREE.MathUtils.degToRad(15))
    const dist = Math.max((GUITAR_EXTENT.height * 1.08) / 2 / tan, 60 / 2 / (tan * aspect))
    camera.position.copy(new THREE.Vector3(0.32, 0.1, 1).normalize().multiplyScalar(dist).add(TARGET))
    camera.lookAt(TARGET)
  }, [camera, size.width, size.height])
  return null
}

const mono = '600 11px/1 ui-monospace, Menlo, monospace'
const chip = (on) => ({
  pointerEvents: 'auto',
  font: mono,
  letterSpacing: '0.06em',
  padding: '8px 10px',
  borderRadius: 999,
  border: 'none',
  cursor: 'pointer',
  background: on ? '#1c1a16' : 'rgba(255,255,255,0.72)',
  color: on ? '#f4f1ea' : '#2a2925',
  boxShadow: on ? '0 4px 14px rgba(0,0,0,.18)' : 'inset 0 0 0 1px rgba(0,0,0,.08)',
})

function Tuner({ info }) {
  if (!info) return null
  const { sel, strings } = info
  const c = sel.cents
  const ok = Math.abs(c) < 4
  return (
    <div style={{ position: 'absolute', left: 12, bottom: 40, padding: '10px 12px', borderRadius: 12, background: 'rgba(250,248,244,0.82)', backdropFilter: 'blur(6px)', boxShadow: '0 6px 20px rgba(0,0,0,.10)', font: '500 11px/1.3 ui-monospace, Menlo, monospace', color: '#2a2925', pointerEvents: 'none', minWidth: 196 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ font: '700 26px/1 ui-monospace, Menlo, monospace', color: ok ? '#1f7a4a' : '#1c1a16' }}>
          {sel.name}
          <sub style={{ fontSize: 12 }}>{sel.octave}</sub>
        </span>
        <span>{sel.hz.toFixed(1)} Hz</span>
        <span style={{ marginLeft: 'auto', color: ok ? '#1f7a4a' : '#b4451f' }}>
          {c >= 0 ? '+' : ''}
          {c.toFixed(0)}¢
        </span>
      </div>
      <div style={{ position: 'relative', height: 6, margin: '8px 0 10px', borderRadius: 3, background: 'linear-gradient(90deg,#e8b7a5,#e9e4da 40%,#bfe1cc 50%,#e9e4da 60%,#e8b7a5)' }}>
        <div style={{ position: 'absolute', top: -3, width: 2, height: 12, borderRadius: 1, background: '#1c1a16', left: `calc(${50 + Math.max(-50, Math.min(50, c))}% - 1px)`, transition: 'left 80ms linear' }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 4, textAlign: 'center' }}>
        {strings.map((s, i) => {
          const good = Math.abs(s.cents) < 4
          return (
            <div key={i} style={{ padding: '4px 0', borderRadius: 6, background: i === sel.index ? 'rgba(28,26,22,0.08)' : 'transparent' }}>
              <div style={{ fontWeight: 700 }}>{s.name}</div>
              <div style={{ color: good ? '#1f7a4a' : '#b4451f', fontSize: 10 }}>
                {s.cents >= 0 ? '+' : ''}
                {s.cents.toFixed(0)}
              </div>
              <div style={{ color: '#7a766e', fontSize: 9 }}>{s.tensionKg.toFixed(1)}kg</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function GuitarScene({ background = '#e9e6e1', autoRotate = false, ...props }) {
  const guitar = useRef()
  const [info, setInfo] = useState(null)

  useEffect(() => {
    const onKey = (e) => {
      if (e.target !== document.body) return
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault()
        guitar.current?.strum(!e.shiftKey)
      } else if (/^Digit[1-6]$/.test(e.code)) {
        guitar.current?.pluck(6 - Number(e.code.slice(5)))
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
        camera={{ position: [60, 70, 220], fov: 30, near: 0.5, far: 3000 }}
        gl={{ antialias: true, toneMapping: THREE.NeutralToneMapping, toneMappingExposure: 1.0 }}
      >
        <color attach="background" args={[background]} />
        <directionalLight position={[-40, 160, 70]} intensity={0.9} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0003} shadow-normalBias={0.05} shadow-camera-left={-80} shadow-camera-right={80} shadow-camera-top={130} shadow-camera-bottom={-30} shadow-camera-far={400} />
        <Studio />
        <Guitar ref={guitar} {...props} onInfo={setInfo} />
        <mesh rotation-x={-Math.PI / 2} receiveShadow>
          <planeGeometry args={[600, 600]} />
          <shadowMaterial opacity={0.08} />
        </mesh>
        <ContactShadows position={[0, 0.05, 0]} opacity={0.42} scale={140} blur={2} far={40} resolution={1024} />
        <Rig />
        <OrbitControls makeDefault enablePan={false} target={TARGET} autoRotate={autoRotate} autoRotateSpeed={0.5} minDistance={22} maxDistance={520} maxPolarAngle={1.55} />
      </Canvas>

      <ControlDock corner="tl">
        {Object.keys(CHORDS).map((name) => (
          <button key={name} onClick={() => guitar.current?.setChord(name)} style={chip(info?.chord === name)}>
            {name}
          </button>
        ))}
        <button onClick={() => guitar.current?.strum(true)} style={{ ...chip(true), background: '#b4451f', marginLeft: 6 }}>
          Strum
        </button>
      </ControlDock>
      <div style={{ position: 'absolute', top: 52, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 6, pointerEvents: 'none' }}>
        <button onClick={() => guitar.current?.tune()} style={chip(false)}>
          Tune up
        </button>
        <button onClick={() => guitar.current?.detune()} style={chip(false)}>
          Detune
        </button>
      </div>

      <Tuner info={info} />

      <InfoHint>
        Drag across the strings to strum · click the fingerboard to fret · drag a tuner key up or down to tune (shift for fine) · knock the body
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
