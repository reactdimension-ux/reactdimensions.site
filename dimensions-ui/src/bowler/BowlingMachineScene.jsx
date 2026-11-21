import { useEffect, useMemo, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import BowlingMachine from './BowlingMachine.jsx'
import ControlDock from '../controls/ControlDock.jsx'

const BG = '#e4e6e2'
const TARGET = [0.3, 0.88, 0]

function Studio() {
  return (
    <Environment resolution={256}>
      <color attach="background" args={['#c4c8c6']} />
      <Lightformer form="rect" intensity={2.4} color="#ffffff" position={[0, 10, 2]} rotation-x={Math.PI / 2} scale={[16, 10, 1]} />
      <Lightformer form="rect" intensity={2.4} color="#fff1df" position={[-6, 3, 5]} rotation-y={Math.PI / 4} scale={[3, 8, 1]} />
      <Lightformer form="rect" intensity={1.4} color="#eef3ff" position={[7, 3, 4]} rotation-y={-Math.PI / 3} scale={[3, 8, 1]} />
      <Lightformer form="rect" intensity={0.9} color="#ffffff" position={[0, 3, -9]} rotation-y={Math.PI} scale={[14, 5, 1]} />
    </Environment>
  )
}

// Turf, a pitch strip with its creases, and a net at the far end.
function Ground() {
  const tex = useMemo(() => {
    const W = 256
    const H = 2048
    const c = Object.assign(document.createElement('canvas'), { width: W, height: H })
    const g = c.getContext('2d')
    g.fillStyle = '#cdbf98'
    g.fillRect(0, 0, W, H)
    for (let i = 0; i < 30000; i++) {
      g.fillStyle = Math.random() < 0.5 ? `rgba(110,95,60,${0.04 + Math.random() * 0.08})` : `rgba(245,238,215,${0.04 + Math.random() * 0.08})`
      g.fillRect(Math.random() * W, Math.random() * H, 1 + Math.random() * 2, 1 + Math.random() * 3)
    }
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 8
    return t
  }, [])
  const netTex = useMemo(() => {
    const c = Object.assign(document.createElement('canvas'), { width: 128, height: 128 })
    const g = c.getContext('2d')
    g.strokeStyle = '#1a1a1a'
    g.lineWidth = 3
    g.beginPath()
    g.moveTo(0, 0)
    g.lineTo(128, 128)
    g.moveTo(128, 0)
    g.lineTo(0, 128)
    g.stroke()
    const t = new THREE.CanvasTexture(c)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(60, 14)
    return t
  }, [])
  useEffect(() => () => (tex.dispose(), netTex.dispose()), [tex, netTex])
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[6, -0.001, 0]} receiveShadow>
        <planeGeometry args={[60, 30]} />
        <meshStandardMaterial color="#9fb07e" roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, -Math.PI / 2]} position={[6.8, 0.0005, 0]} receiveShadow>
        <planeGeometry args={[3.05, 20.12]} />
        <meshStandardMaterial map={tex} roughness={0.95} />
      </mesh>
      {/* creases at the batting end */}
      {[
        [12.5, 2.64, 0.05],
        [11.28, 3.05, 0.05],
      ].map(([x, w, d]) => (
        <mesh key={x} rotation-x={-Math.PI / 2} position={[x, 0.001, 0]}>
          <planeGeometry args={[d, w]} />
          <meshStandardMaterial color="#fbfaf6" roughness={0.9} />
        </mesh>
      ))}
      {/* stumps */}
      {[-0.0968, 0, 0.0968].map((z) => (
        <mesh key={z} position={[12.5, 0.3555, z]} castShadow>
          <cylinderGeometry args={[0.0175, 0.0175, 0.711, 16]} />
          <meshStandardMaterial color="#c99447" roughness={0.45} />
        </mesh>
      ))}
      {/* the net behind */}
      <mesh position={[14, 1.6, 0]} rotation-y={-Math.PI / 2}>
        <planeGeometry args={[5.2, 3.2]} />
        <meshStandardMaterial map={netTex} transparent alphaTest={0.3} color="#222" side={THREE.DoubleSide} />
      </mesh>
      {[-2.6, 2.6].map((z) => (
        <mesh key={z} position={[14, 1.6, z]}>
          <cylinderGeometry args={[0.03, 0.03, 3.2, 12]} />
          <meshStandardMaterial color="#2b2c2f" metalness={0.6} roughness={0.4} />
        </mesh>
      ))}
    </group>
  )
}

function Rig() {
  const { camera, size } = useThree()
  useEffect(() => {
    const aspect = size.width / size.height
    const tan = Math.tan(THREE.MathUtils.degToRad(17))
    const dist = Math.max(1.25 / 2 / tan, 1.5 / 2 / (tan * aspect)) * 1.1
    const el = 0.16
    const az = 0.32
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

export default function BowlingMachineScene({ autoRotate = false, ...props }) {
  const [cmd, setCmd] = useState({ feed: 0, collect: 0 })
  const [report, setReport] = useState(null)
  const fire = (k) => setCmd((c) => ({ ...c, [k]: c[k] + 1 }))
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none' }}>
      <Canvas shadows dpr={[1, 1.75]} camera={{ position: [-1, 1.2, 2.6], fov: 34, near: 0.02, far: 80 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}>
        <color attach="background" args={[BG]} />
        <fog attach="fog" args={[BG, 12, 30]} />
        <hemisphereLight args={['#ffffff', '#c9d0be', 0.4]} />
        <directionalLight position={[-3, 7, 4]} intensity={1.2} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0002} shadow-normalBias={0.01}>
          <orthographicCamera attach="shadow-camera" args={[-4, 16, 6, -6, 0.5, 30]} />
        </directionalLight>
        <Studio />
        <Ground />
        <BowlingMachine {...props} {...cmd} onReport={setReport} />
        <ContactShadows position={[0, 0.0015, 0]} opacity={0.4} scale={3} blur={2} far={1.2} resolution={512} frames={1} color="#2a2620" />
        <Rig />
        <OrbitControls makeDefault enablePan={false} target={TARGET} autoRotate={autoRotate} autoRotateSpeed={0.5} minDistance={0.6} maxDistance={18} minPolarAngle={0.15} maxPolarAngle={1.52} />
      </Canvas>
      <div style={{ position: 'absolute', left: 12, top: 12, zIndex: 5, padding: '8px 12px', borderRadius: 12, background: 'rgba(255,255,255,0.88)', boxShadow: '0 2px 8px rgba(0,0,0,.12)', font: '600 11px/1.6 ui-monospace, Menlo, monospace', color: '#2a2925', letterSpacing: '0.03em' }}>
        {report ? (
          <>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{report.kmh} km/h</div>
            <div>wheel {report.rpm} rpm · ball {report.fired}</div>
          </>
        ) : (
          <div>spinning up…</div>
        )}
      </div>
      <ControlDock corner="bl">
        <button type="button" style={btn(true)} onClick={() => fire('feed')}>
          Feed a ball
        </button>
        <button type="button" style={btn(false)} onClick={() => fire('collect')}>
          Collect balls
        </button>
      </ControlDock>
      <InfoHint>The spiral hopper feeds itself every few seconds (or click it, or Feed a ball) · click the switch on the motor to turn it off · tilt, aim and turn the head in the controls for length, line, swing and spin · balls are fetched back to the hopper</InfoHint>
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
