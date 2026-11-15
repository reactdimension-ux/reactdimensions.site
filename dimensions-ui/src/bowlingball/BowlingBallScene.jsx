import { useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Environment, Lightformer, MeshReflectorMaterial, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import BowlingBall from './BowlingBall.jsx'

// A bowling centre's light: long strip lights overhead (they draw the long
// highlights across the polished ball), soft fill from the sides.
function Studio() {
  return (
    <Environment resolution={256}>
      <color attach="background" args={['#b9bbbe']} />
      {[-0.8, 0, 0.8].map((x) => (
        <Lightformer key={x} form="rect" intensity={2.6} color="#ffffff" position={[x, 5, 0]} rotation-x={Math.PI / 2} scale={[0.35, 12, 1]} />
      ))}
      <Lightformer form="circle" intensity={2.4} color="#ffffff" position={[-4, 4, 5]} scale={2.4} target={[0, 0, 0]} />
      <Lightformer form="rect" intensity={1.4} color="#fff2e0" position={[-5, 2, 3]} rotation-y={Math.PI / 3} scale={[3, 6, 1]} />
      <Lightformer form="rect" intensity={1.2} color="#eef3ff" position={[5, 2, 3]} rotation-y={-Math.PI / 3} scale={[3, 6, 1]} />
    </Environment>
  )
}

// Oiled maple boards, each a slightly different shade, with fine grain.
function Floor({ reflections }) {
  const tex = useMemo(() => {
    const W = 1024
    const H = 1024
    const c = Object.assign(document.createElement('canvas'), { width: W, height: H })
    const g = c.getContext('2d')
    let s = 13
    const r = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646
    const boards = 20
    const bw = W / boards
    for (let b = 0; b < boards; b++) {
      const l = 0.92 + r() * 0.1
      g.fillStyle = `rgb(${Math.round(222 * l)},${Math.round(184 * l)},${Math.round(128 * l)})`
      g.fillRect(b * bw, 0, bw, H)
      for (let k = 0; k < 7; k++) {
        g.strokeStyle = `rgba(150,100,50,${0.05 + r() * 0.1})`
        g.lineWidth = 0.5 + r()
        const x0 = b * bw + r() * bw
        g.beginPath()
        for (let y = 0; y <= H; y += 32) {
          const x = x0 + Math.sin(y / (120 + r() * 80) + k) * 1.5
          y ? g.lineTo(x, y) : g.moveTo(x, y)
        }
        g.stroke()
      }
      g.fillStyle = 'rgba(80,50,20,0.35)'
      g.fillRect(b * bw, 0, 1, H)
      g.fillStyle = 'rgba(80,50,20,0.25)'
      g.fillRect(b * bw, (r() * H) | 0, bw, 1)
    }
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(4, 4)
    t.anisotropy = 8
    return t
  }, [])
  return (
    <mesh rotation-x={-Math.PI / 2} receiveShadow>
      <planeGeometry args={[8, 8]} />
      {reflections ? (
        <MeshReflectorMaterial map={tex} blur={[200, 60]} resolution={512} mixBlur={0.9} mixStrength={0.8} mirror={0.55} roughness={0.25} depthScale={0.6} minDepthThreshold={0.4} maxDepthThreshold={1.2} color="#ffffff" metalness={0.05} />
      ) : (
        <meshStandardMaterial map={tex} roughness={0.3} />
      )}
    </mesh>
  )
}

export default function BowlingBallScene({ background = '#e2e0dc', reflections = true, autoRotate = false, ...props }) {
  const [rollKey, setRollKey] = useState(0)
  const [spinKey, setSpinKey] = useState(0)
  const btn = { pointerEvents: 'auto', font: '600 12px/1 ui-monospace, Menlo, monospace', letterSpacing: '0.12em', textTransform: 'uppercase', padding: '11px 18px', borderRadius: 999, border: 'none', cursor: 'pointer', boxShadow: '0 6px 18px rgba(0,0,0,.18)' }
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none', background }}>
      <Canvas shadows dpr={[1, 1.75]} camera={{ position: [0.12, 0.26, 0.78], fov: 30, near: 0.01, far: 30 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}>
        <color attach="background" args={[background]} />
        <fog attach="fog" args={[background, 2, 7]} />
        <hemisphereLight args={['#ffffff', '#d6cfc2', 0.3]} />
        <directionalLight position={[-1, 3, 1.6]} intensity={1.2} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0002} shadow-normalBias={0.005} shadow-camera-left={-2} shadow-camera-right={2} shadow-camera-top={2} shadow-camera-bottom={-2} shadow-camera-near={0.5} shadow-camera-far={8} shadow-radius={5} />
        <Studio />
        <Floor reflections={reflections} />
        <BowlingBall {...props} rollKey={rollKey} spinKey={spinKey} />
        <OrbitControls makeDefault enablePan={false} target={[0, 0.1085, 0]} autoRotate={autoRotate} autoRotateSpeed={0.6} minDistance={0.3} maxDistance={3} maxPolarAngle={1.5} />
      </Canvas>

      <div style={{ position: 'absolute', top: 14, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 10, pointerEvents: 'none' }}>
        <button type="button" onClick={() => setRollKey((k) => k + 1)} style={{ ...btn, background: '#1c1a16', color: '#f4f1ea' }}>
          Roll
        </button>
        <button type="button" onClick={() => setSpinKey((k) => k + 1)} style={{ ...btn, background: 'rgba(255,255,255,.9)', color: '#1c1a16' }}>
          Spin
        </button>
      </div>
      <InfoHint>Roll sends it off skidding with side roll, and it hooks as the floor grips it · Spin (or tap the ball) twirls it on the spot · drag to look around, scroll to look into the holes</InfoHint>
    </div>
  )
}

// The usage tips live behind a small "i" button in the corner: hover it (or
// tap it) to read them.
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
