import { useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Environment, Lightformer, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import CricketBall from './CricketBall.jsx'

function Studio() {
  return (
    <Environment resolution={256}>
      <color attach="background" args={['#c9c9c9']} />
      {/* round lights only: the polished lacquer mirrors whatever shape the
          lights are, and square soft boxes showed up as hard rectangles on
          the ball. One small key for a single clean highlight, then large,
          dim fills that read as soft gradients rather than shapes. */}
      <Lightformer form="circle" intensity={3} color="#ffffff" position={[-5, 7, 6]} scale={2.2} target={[0, 0, 0]} />
      <Lightformer form="circle" intensity={0.5} color="#ffffff" position={[6, 4, 5]} scale={7} target={[0, 0, 0]} />
      <Lightformer form="circle" intensity={0.6} color="#ffffff" position={[0, 12, 0]} scale={14} target={[0, 0, 0]} />
    </Environment>
  )
}

// a dry, rolled pitch: pale clay with fine cracks and a few grass flecks
function Pitch() {
  const tex = useMemo(() => {
    const c = Object.assign(document.createElement('canvas'), { width: 1024, height: 1024 })
    const g = c.getContext('2d')
    g.fillStyle = '#bfa77c'
    g.fillRect(0, 0, 1024, 1024)
    for (let i = 0; i < 40000; i++) {
      g.fillStyle = Math.random() < 0.5 ? 'rgba(90,70,40,0.07)' : 'rgba(255,240,210,0.07)'
      g.fillRect(Math.random() * 1024, Math.random() * 1024, 2, 2)
    }
    for (let i = 0; i < 900; i++) {
      g.fillStyle = `rgba(${70 + Math.random() * 30},${100 + Math.random() * 40},50,0.35)`
      g.fillRect(Math.random() * 1024, Math.random() * 1024, 1.2, 3 + Math.random() * 4)
    }
    // cracks: random walks
    g.strokeStyle = 'rgba(70,52,30,0.45)'
    for (let k = 0; k < 26; k++) {
      let x = Math.random() * 1024
      let y = Math.random() * 1024
      let a = Math.random() * Math.PI * 2
      g.lineWidth = 0.8 + Math.random() * 1.2
      g.beginPath()
      g.moveTo(x, y)
      for (let s = 0; s < 30; s++) {
        a += (Math.random() - 0.5) * 0.9
        x += Math.cos(a) * 8
        y += Math.sin(a) * 8
        g.lineTo(x, y)
      }
      g.stroke()
    }
    const t = new THREE.CanvasTexture(c)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(3, 3)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 8
    return t
  }, [])
  return (
    <mesh rotation-x={-Math.PI / 2} receiveShadow>
      <planeGeometry args={[6, 6]} />
      <meshStandardMaterial map={tex} roughness={0.95} />
    </mesh>
  )
}

export default function CricketBallScene({ background = '#d9d6d2', autoRotate = false, ...props }) {
  const [tossKey, setTossKey] = useState(0)
  const [spinKey, setSpinKey] = useState(0)
  const btn = { pointerEvents: 'auto', font: '600 12px/1 ui-monospace, Menlo, monospace', letterSpacing: '0.12em', textTransform: 'uppercase', padding: '11px 18px', borderRadius: 999, border: 'none', cursor: 'pointer', boxShadow: '0 6px 18px rgba(0,0,0,.18)' }
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none', background }}>
      <Canvas shadows dpr={[1, 1.75]} camera={{ position: [0.05, 0.13, 0.34], fov: 30, near: 0.005, far: 20 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}>
        <color attach="background" args={[background]} />
        <fog attach="fog" args={[background, 1.2, 4]} />
        <hemisphereLight args={['#ffffff', '#8f8f8f', 0.45]} />
        <directionalLight position={[-1, 2.4, 1.4]} intensity={1.7} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0002} shadow-normalBias={0.003} shadow-camera-left={-1} shadow-camera-right={1} shadow-camera-top={1} shadow-camera-bottom={-1} shadow-camera-near={0.5} shadow-camera-far={6} shadow-radius={5} />
        <Studio />
        <Pitch />
        <CricketBall {...props} tossKey={tossKey} spinKey={spinKey} />
        <OrbitControls makeDefault enablePan={false} target={[0, 0.036, 0]} autoRotate={autoRotate} autoRotateSpeed={0.6} minDistance={0.12} maxDistance={1.5} maxPolarAngle={1.5} />
      </Canvas>

      <div style={{ position: 'absolute', top: 14, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 10, pointerEvents: 'none' }}>
        <button onClick={() => setTossKey((k) => k + 1)} style={{ ...btn, background: '#1c1a16', color: '#f4f1ea' }}>
          Toss
        </button>
        <button onClick={() => setSpinKey((k) => k + 1)} style={{ ...btn, background: 'rgba(255,255,255,.9)', color: '#1c1a16' }}>
          Spin
        </button>
      </div>
      <InfoHint>
        Toss (or tap the ball) to flick it up with backspin on an upright seam: it kicks back when it lands and settles into a roll · Spin twirls it on the spot until the seam drags it down · Wear scuffs one side and keeps the other shiny · drag to look around
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
