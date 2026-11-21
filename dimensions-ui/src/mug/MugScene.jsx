import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import Mug from './Mug.jsx'
import ControlDock from '../controls/ControlDock.jsx'

// soft studio: a big overhead box and broad side strips, for a satin glaze
function Studio() {
  return (
    <Environment resolution={256}>
      <color attach="background" args={['#b4b4b2']} />
      <Lightformer form="rect" intensity={2.2} color="#ffffff" position={[0, 9, 0]} rotation-x={Math.PI / 2} scale={[12, 8, 1]} />
      <Lightformer form="rect" intensity={1.6} color="#ffffff" position={[-6, 3, 4]} rotation-y={Math.PI / 3} scale={[4, 9, 1]} />
      <Lightformer form="rect" intensity={1.2} color="#fffaf2" position={[6, 3, 3]} rotation-y={-Math.PI / 3} scale={[4, 9, 1]} />
      <Lightformer form="rect" intensity={0.8} color="#ffffff" position={[0, 2, -7]} scale={[10, 4, 1]} />
    </Environment>
  )
}

const TARGET = new THREE.Vector3(0, 5, 0)

function homeDistance(size) {
  const aspect = size.width / size.height
  const tan = Math.tan(THREE.MathUtils.degToRad(15))
  const span = 26
  return Math.max(span / 2 / tan, span / 2 / (tan * aspect))
}
const HOME_DIR = new THREE.Vector3(0.45, 0.62, 1).normalize()
// looking down into the mug: high, a little off-axis so the far wall shows
const INSIDE_DIR = new THREE.Vector3(0.2, 1, 0.42).normalize()
const INSIDE_DIST = 21

function Rig() {
  const { camera, size } = useThree()
  useEffect(() => {
    camera.position.copy(HOME_DIR).multiplyScalar(homeDistance(size)).add(TARGET)
    camera.lookAt(TARGET)
  }, [camera, size.width, size.height])
  return null
}

// Moves the orbit camera between the table view and a view down into the mug.
// In the inside view the orbit centre sits on the drink and follows the mug as
// it slides, so you can orbit around and look in from any side.
function ViewRig({ mug, inside }) {
  const { camera, controls, size } = useThree()
  const anim = useRef(0)
  const goalT = useMemo(() => new THREE.Vector3(), [])
  const goalC = useMemo(() => new THREE.Vector3(), [])
  const delta = useMemo(() => new THREE.Vector3(), [])

  useEffect(() => {
    anim.current = 1
  }, [inside])
  useEffect(() => {
    if (!controls) return
    const stop = () => (anim.current = 0) // the user grabbed the view: stop steering
    controls.addEventListener('start', stop)
    return () => controls.removeEventListener('start', stop)
  }, [controls])

  useFrame((_, dt) => {
    if (!controls) return
    const p = mug.current?.position?.()
    if (inside && p) goalT.set(p.x, Math.max(2, p.level), p.z)
    else goalT.copy(TARGET)
    if (anim.current > 0) {
      anim.current = Math.max(0, anim.current - dt * 0.9)
      const k = 1 - Math.exp(-dt * 7)
      goalC.copy(inside ? INSIDE_DIR : HOME_DIR).multiplyScalar(inside ? INSIDE_DIST : homeDistance(size)).add(goalT)
      controls.target.lerp(goalT, k)
      camera.position.lerp(goalC, k)
    } else if (inside) {
      // follow the mug, keeping whatever angle the user orbited to
      delta.subVectors(goalT, controls.target).multiplyScalar(1 - Math.exp(-dt * 10))
      controls.target.add(delta)
      camera.position.add(delta)
    }
  })
  return null
}

const btn = (dark) => ({
  pointerEvents: 'auto',
  font: '600 12px/1 ui-monospace, Menlo, monospace',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  padding: '11px 16px',
  borderRadius: 999,
  border: 'none',
  cursor: 'pointer',
  background: dark ? '#1c1a16' : 'rgba(255,255,255,0.8)',
  color: dark ? '#f4f1ea' : '#2a2925',
  boxShadow: dark ? '0 6px 18px rgba(0,0,0,.18)' : 'inset 0 0 0 1px rgba(0,0,0,.06)',
})

export default function MugScene({ background = '#e6e6e4', autoRotate = false, ...props }) {
  const mug = useRef()
  const [info, setInfo] = useState(null)
  const [inside, setInside] = useState(false)

  useEffect(() => {
    const onKey = (e) => {
      if ((e.code === 'Space' || e.code === 'Enter') && e.target === document.body) {
        e.preventDefault()
        mug.current?.pour()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const pct = info ? Math.round((info.ml / info.capacity) * 100) : 0

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none', background, userSelect: 'none', WebkitUserSelect: 'none' }}>
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [20, 30, 45], fov: 30, near: 0.5, far: 1000 }}
        gl={{ antialias: true, toneMapping: THREE.NeutralToneMapping, toneMappingExposure: 1.0 }}
      >
        <color attach="background" args={[background]} />
        <directionalLight position={[-25, 80, 30]} intensity={0.75} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0002} shadow-normalBias={0.04} shadow-camera-left={-45} shadow-camera-right={45} shadow-camera-top={45} shadow-camera-bottom={-45} shadow-camera-far={200} />
        <Studio />
        <Mug ref={mug} {...props} background={background} onInfo={setInfo} />
        <mesh rotation-x={-Math.PI / 2} receiveShadow>
          <planeGeometry args={[400, 400]} />
          <shadowMaterial opacity={0.08} />
        </mesh>
        <ContactShadows position={[0, 0.01, 0]} opacity={0.45} scale={90} blur={2} far={12} resolution={1024} />
        <Rig />
        <ViewRig mug={mug} inside={inside} />
        <OrbitControls makeDefault enablePan={false} target={TARGET} autoRotate={autoRotate} autoRotateSpeed={0.5} minDistance={7} maxDistance={160} maxPolarAngle={1.5} mouseButtons={{ LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }} />
      </Canvas>

      <ControlDock corner="tl">
        <button onClick={() => (info?.pouring ? mug.current?.stopPour() : mug.current?.pour())} style={btn(true)}>
          {info?.pouring ? 'Stop' : 'Pour'}
        </button>
        <button onClick={() => mug.current?.sip()} style={btn(false)}>
          Sip
        </button>
        <button onClick={() => mug.current?.empty()} style={btn(false)}>
          Empty
        </button>
        <button onClick={() => setInside((v) => !v)} style={btn(false)}>
          {inside ? 'Table view' : 'Look inside'}
        </button>
      </ControlDock>

      {info && (
        <div style={{ position: 'absolute', left: 12, top: 14, padding: '9px 12px', borderRadius: 12, background: 'rgba(250,250,248,0.8)', backdropFilter: 'blur(6px)', font: '500 11px/1.5 ui-monospace, Menlo, monospace', color: '#2a2925', pointerEvents: 'none', minWidth: 112 }}>
          <div style={{ font: '700 20px/1.1 ui-monospace, Menlo, monospace', color: info.T > 60 && info.ml > 3 ? '#b4451f' : '#2a2925' }}>{info.ml > 3 ? `${info.T.toFixed(0)}°C` : '—'}</div>
          <div>
            {Math.round(info.ml)} ml · {pct}%
          </div>
          <div style={{ marginTop: 6, height: 4, borderRadius: 2, background: 'rgba(0,0,0,0.08)' }}>
            <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', borderRadius: 2, background: '#6a4a33' }} />
          </div>
        </div>
      )}

      <InfoHint>
        Drag the mug to slide it, too fast and it spills · drag the background (or right-drag anywhere) to orbit, scroll to zoom · move it while pouring and the stream misses
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
