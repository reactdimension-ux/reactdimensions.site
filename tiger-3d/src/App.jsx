import { useEffect, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import Tiger from './Tiger.jsx'

function Button({ active, onClick, children }) {
  return (
    <button className={`pill${active ? ' on' : ''}`} onClick={onClick}>
      {children}
    </button>
  )
}

export default function App() {
  const [walking, setWalking] = useState(false)
  const [spin, setSpin] = useState(false)

  // Keyboard: W or Space toggles walking, R toggles auto-spin.
  useEffect(() => {
    const down = (e) => {
      if (e.repeat) return
      if (e.code === 'KeyW' || e.code === 'Space') {
        e.preventDefault()
        setWalking((v) => !v)
      }
      if (e.code === 'KeyR') setSpin((v) => !v)
    }
    window.addEventListener('keydown', down)
    return () => window.removeEventListener('keydown', down)
  }, [])

  return (
    <>
      {/* `flat` turns off filmic tone mapping so the orange stays vivid.
          The canvas is transparent: the studio backdrop is a CSS gradient. */}
      <Canvas shadows flat dpr={[1, 2]} camera={{ position: [3.3, 1.4, -3.5], fov: 32, near: 0.1, far: 100 }}>
        <hemisphereLight args={['#ffffff', '#e8d9c8', 1.9]} />
        <directionalLight
          position={[4, 7, -5]}
          intensity={2.1}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-bias={-0.0004}
          shadow-normalBias={0.02}
          shadow-radius={6}
          shadow-camera-left={-7}
          shadow-camera-right={7}
          shadow-camera-top={7}
          shadow-camera-bottom={-7}
          shadow-camera-far={30}
        />
        <directionalLight position={[-5, 3, 4]} intensity={0.5} color="#ffe9d2" />

        <Tiger walking={walking} />

        {/* Invisible floor that only shows the tiger's shadow */}
        <mesh rotation-x={-Math.PI / 2} receiveShadow>
          <planeGeometry args={[60, 60]} />
          <shadowMaterial opacity={0.22} />
        </mesh>

        <OrbitControls
          makeDefault
          target={[0.15, 0.72, 0]}
          enablePan={false}
          minDistance={2.5}
          maxDistance={12}
          maxPolarAngle={Math.PI / 2 - 0.04}
          autoRotate={spin}
          autoRotateSpeed={1.2}
        />
      </Canvas>

      <div className="ui">
        <Button active={walking} onClick={() => setWalking((v) => !v)}>Walk</Button>
        <Button active={spin} onClick={() => setSpin((v) => !v)}>Auto-spin</Button>
      </div>
      <div className="hint">Drag to look around · scroll to zoom · W to walk · R to spin</div>
    </>
  )
}
