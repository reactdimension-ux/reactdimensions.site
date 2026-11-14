import { useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Environment, Lightformer, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import TennisBall from './TennisBall.jsx'

function Studio() {
  return (
    <Environment resolution={256}>
      <color attach="background" args={['#c9c9c9']} />
      <Lightformer form="rect" intensity={2.2} color="#ffffff" position={[-6, 8, 6]} rotation-y={Math.PI / 4} scale={[8, 8, 1]} />
      <Lightformer form="rect" intensity={1.2} color="#ffffff" position={[6, 6, 5]} rotation-y={-Math.PI / 4} scale={[6, 6, 1]} />
      <Lightformer form="rect" intensity={1.6} color="#ffffff" position={[0, 12, 0]} rotation-x={Math.PI / 2} scale={[14, 8, 1]} />
    </Environment>
  )
}

// court surfaces: acrylic hard court, crushed-brick clay, mown grass
const COURT = {
  hard: { base: '#1f4b7c', grain: 0.07, rough: 0.62 },
  clay: { base: '#b9603a', grain: 0.12, rough: 0.95 },
  grass: { base: '#4f8a38', grain: 0.1, rough: 0.9 },
}

function Court({ surface }) {
  const c = COURT[surface] || COURT.hard
  const maps = useMemo(() => {
    const S = 512
    const col = Object.assign(document.createElement('canvas'), { width: S, height: S })
    const bm = Object.assign(document.createElement('canvas'), { width: S, height: S })
    const g = col.getContext('2d')
    const b = bm.getContext('2d')
    g.fillStyle = c.base
    g.fillRect(0, 0, S, S)
    b.fillStyle = '#808080'
    b.fillRect(0, 0, S, S)
    if (surface === 'grass') {
      // mowing stripes, then blades
      g.fillStyle = 'rgba(255,255,255,0.05)'
      g.fillRect(0, 0, S / 2, S)
      for (let i = 0; i < 30000; i++) {
        const x = Math.random() * S
        const y = Math.random() * S
        g.strokeStyle = `rgba(${30 + Math.random() * 60},${90 + Math.random() * 70},${20 + Math.random() * 40},0.5)`
        g.lineWidth = 1
        g.beginPath()
        g.moveTo(x, y)
        g.lineTo(x + (Math.random() - 0.5) * 3, y - 3 - Math.random() * 4)
        g.stroke()
        b.fillStyle = `rgba(255,255,255,${Math.random() * 0.4})`
        b.fillRect(x, y, 1, 3)
      }
    } else {
      for (let i = 0; i < 40000; i++) {
        const x = Math.random() * S
        const y = Math.random() * S
        g.fillStyle = Math.random() < 0.5 ? `rgba(0,0,0,${c.grain})` : `rgba(255,255,255,${c.grain * 0.7})`
        g.fillRect(x, y, surface === 'clay' ? 2.5 : 1.5, surface === 'clay' ? 2.5 : 1.5)
        b.fillStyle = `rgba(255,255,255,${0.1 + Math.random() * 0.35})`
        b.beginPath()
        b.arc(x, y, surface === 'clay' ? 1.6 : 0.9, 0, Math.PI * 2)
        b.fill()
      }
    }
    const out = [col, bm].map((cv, i) => {
      const t = new THREE.CanvasTexture(cv)
      t.wrapS = t.wrapT = THREE.RepeatWrapping
      t.repeat.set(40, 40)
      t.anisotropy = 8
      if (i === 0) t.colorSpace = THREE.SRGBColorSpace
      return t
    })
    return { map: out[0], bumpMap: out[1] }
  }, [surface, c])
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[12, 12]} />
        <meshStandardMaterial map={maps.map} bumpMap={maps.bumpMap} bumpScale={0.6} roughness={c.rough} />
      </mesh>
      {/* a baseline, 5 cm wide */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.0003, -0.22]} receiveShadow>
        <planeGeometry args={[12, 0.05]} />
        <meshStandardMaterial color={surface === 'clay' ? '#f3ede4' : '#f4f4f0'} roughness={0.7} />
      </mesh>
    </group>
  )
}

export default function TennisBallScene({ background = '#d9d8d4', surface = 'hard', follow = true, autoRotate = false, ...props }) {
  const [hitKey, setHitKey] = useState(0)
  const [dropKey, setDropKey] = useState(0)
  const [report, setReport] = useState(null)
  const btn = { pointerEvents: 'auto', font: '600 12px/1 ui-monospace, Menlo, monospace', letterSpacing: '0.12em', textTransform: 'uppercase', padding: '11px 18px', borderRadius: 999, border: 'none', cursor: 'pointer', boxShadow: '0 6px 18px rgba(0,0,0,.18)' }
  const pass = report != null && report >= 1.35 && report <= 1.47
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none', background }}>
      <Canvas shadows dpr={[1, 2]} camera={{ position: [0.06, 0.085, 0.3], fov: 30, near: 0.005, far: 40 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}>
        <color attach="background" args={[background]} />
        <fog attach="fog" args={[background, 2, 9]} />
        <hemisphereLight args={['#ffffff', '#8f8f8f', 0.45]} />
        <directionalLight position={[-1.4, 3.2, 1.6]} intensity={1.8} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0002} shadow-normalBias={0.002} shadow-camera-left={-1.2} shadow-camera-right={1.2} shadow-camera-top={1.2} shadow-camera-bottom={-1.2} shadow-camera-near={0.5} shadow-camera-far={8} shadow-radius={4} />
        <Studio />
        <Court surface={surface} />
        <TennisBall {...props} surface={surface} follow={follow} hitKey={hitKey} dropKey={dropKey} onReport={setReport} />
        <OrbitControls makeDefault enablePan={false} target={[0, 0.032, 0]} autoRotate={autoRotate} autoRotateSpeed={0.6} minDistance={0.1} maxDistance={4} maxPolarAngle={1.5} />
      </Canvas>

      <div style={{ position: 'absolute', top: 14, left: 0, right: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, pointerEvents: 'none', flexWrap: 'wrap' }}>
        <button onClick={() => setHitKey((k) => k + 1)} style={{ ...btn, background: '#1c1a16', color: '#f4f1ea' }}>
          Hit
        </button>
        <button onClick={() => setDropKey((k) => k + 1)} style={{ ...btn, background: 'rgba(255,255,255,.9)', color: '#1c1a16' }}>
          Drop test
        </button>
      </div>
      {report != null && (
        <div aria-live="polite" style={{ position: 'absolute', top: 62, left: 0, right: 0, textAlign: 'center', font: '500 12px/1.4 ui-monospace, Menlo, monospace', color: '#2a2925', pointerEvents: 'none' }}>
          From 254 cm it bounced to {Math.round(report * 100)} cm · {surface === 'hard' ? `${pass ? 'passes' : 'outside'} the ITF 135–147 cm` : `on ${surface} (the ITF tests on a rigid floor: 135–147 cm)`}
        </div>
      )}
      <InfoHint>
        Hit plays a stroke away from the camera with the spin you pick: topspin dips and kicks forward off the bounce, slice floats and skids · tap the ball to strike it from that side, off-centre for spin · drag it to pick it up and throw it · Drop test lets it fall from 254 cm and measures the rebound, as the ITF does · surfaces play differently: clay grips and sits up, grass skids low
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
