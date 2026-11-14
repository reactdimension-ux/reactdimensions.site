import { useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Environment, Lightformer, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import Shuttlecock from './Shuttlecock.jsx'

function Studio() {
  return (
    <Environment resolution={256}>
      <color attach="background" args={['#cfcfcf']} />
      <Lightformer form="rect" intensity={2.4} color="#ffffff" position={[-6, 8, 6]} rotation-y={Math.PI / 4} scale={[8, 8, 1]} />
      <Lightformer form="rect" intensity={1.3} color="#ffffff" position={[6, 6, 5]} rotation-y={-Math.PI / 4} scale={[6, 6, 1]} />
      <Lightformer form="rect" intensity={1.8} color="#ffffff" position={[0, 12, 0]} rotation-x={Math.PI / 2} scale={[14, 8, 1]} />
      <Lightformer form="rect" intensity={1.4} color="#fff8ee" position={[0, 4, -8]} scale={[12, 6, 1]} />
    </Environment>
  )
}

// a synthetic court mat: fine pebbled grain in court green, with a painted line
function Floor({ floor }) {
  const maps = useMemo(() => {
    const S = 512
    const col = Object.assign(document.createElement('canvas'), { width: S, height: S })
    const bm = Object.assign(document.createElement('canvas'), { width: S, height: S })
    const g = col.getContext('2d')
    const b = bm.getContext('2d')
    const court = floor === 'court'
    g.fillStyle = court ? '#2c6650' : '#d2d1cd'
    g.fillRect(0, 0, S, S)
    b.fillStyle = '#808080'
    b.fillRect(0, 0, S, S)
    for (let i = 0; i < 26000; i++) {
      const x = Math.random() * S
      const y = Math.random() * S
      const r = 0.8 + Math.random() * 1.8
      g.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.04)'
      g.fillRect(x, y, 2, 2)
      b.fillStyle = `rgba(255,255,255,${0.15 + Math.random() * 0.3})`
      b.beginPath()
      b.arc(x, y, r, 0, Math.PI * 2)
      b.fill()
    }
    const out = [col, bm].map((c, i) => {
      const t = new THREE.CanvasTexture(c)
      t.wrapS = t.wrapT = THREE.RepeatWrapping
      t.repeat.set(40, 40)
      t.anisotropy = 8
      if (i === 0) t.colorSpace = THREE.SRGBColorSpace
      return t
    })
    return { map: out[0], bumpMap: out[1] }
  }, [floor])
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[8, 8]} />
        <meshStandardMaterial map={maps.map} bumpMap={maps.bumpMap} bumpScale={0.6} roughness={floor === 'court' ? 0.72 : 0.92} />
      </mesh>
      {floor === 'court' && (
        <mesh rotation-x={-Math.PI / 2} position={[0, 0.0002, -0.16]} receiveShadow>
          <planeGeometry args={[8, 0.04]} />
          <meshStandardMaterial color="#efefea" roughness={0.6} />
        </mesh>
      )}
    </group>
  )
}

export default function ShuttlecockScene({ background = '#d9d9d6', floor = 'court', autoRotate = false, ...props }) {
  const [serveKey, setServeKey] = useState(0)
  const [dropKey, setDropKey] = useState(0)
  const [standKey, setStandKey] = useState(0)
  const btn = { pointerEvents: 'auto', font: '600 12px/1 ui-monospace, Menlo, monospace', letterSpacing: '0.12em', textTransform: 'uppercase', padding: '11px 18px', borderRadius: 999, border: 'none', cursor: 'pointer', boxShadow: '0 6px 18px rgba(0,0,0,.18)' }
  const light = { ...btn, background: 'rgba(255,255,255,.9)', color: '#1c1a16' }
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none', background }}>
      <Canvas shadows dpr={[1, 2]} camera={{ position: [0.11, 0.1, 0.27], fov: 30, near: 0.005, far: 20 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}>
        <color attach="background" args={[background]} />
        <fog attach="fog" args={[background, 1.4, 5]} />
        <hemisphereLight args={['#ffffff', '#9a9a96', 0.5]} />
        <directionalLight position={[-0.9, 2.2, 1.3]} intensity={2.1} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0001} shadow-normalBias={0.0008} shadow-camera-left={-0.6} shadow-camera-right={0.6} shadow-camera-top={0.6} shadow-camera-bottom={-0.6} shadow-camera-near={0.5} shadow-camera-far={6} />
        {/* a back light, so the feathers glow through */}
        <directionalLight position={[0.7, 1.1, -1.4]} intensity={1.1} color="#fffaf2" />
        <Studio />
        <Floor floor={floor} />
        <Shuttlecock {...props} serveKey={serveKey} dropKey={dropKey} standKey={standKey} />
        <OrbitControls makeDefault enablePan={false} target={[0, 0.045, 0]} autoRotate={autoRotate} autoRotateSpeed={0.6} minDistance={0.1} maxDistance={2} maxPolarAngle={1.52} />
      </Canvas>

      <div style={{ position: 'absolute', top: 14, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 10, pointerEvents: 'none', flexWrap: 'wrap' }}>
        <button onClick={() => setServeKey((k) => k + 1)} style={{ ...btn, background: '#1c1a16', color: '#f4f1ea' }}>
          Serve
        </button>
        <button onClick={() => setDropKey((k) => k + 1)} style={light}>
          Drop
        </button>
        <button onClick={() => setStandKey((k) => k + 1)} style={light}>
          Stand
        </button>
      </div>
      <InfoHint>
        Serve (or tap the shuttle) to hit it up: it flips cork-first, spins up on its feathers and falls at its terminal speed, then lands and topples onto its side · Drop lets it go cork-up so it turns over on the way down · Stand puts it back on its cork · lower Slow Motion to watch the flip · drag to look around
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
