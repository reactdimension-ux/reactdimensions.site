import { useEffect } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { Environment, Lightformer, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import Vinyl from './Vinyl.jsx'

const BG = '#e9e7e2'

function Studio() {
  return (
    <Environment resolution={256}>
      <color attach="background" args={['#9a9fa6']} />
      <Lightformer form="rect" intensity={2.6} color="#ffffff" position={[-5, 5, 6]} rotation-y={Math.PI / 5} scale={[9, 6, 1]} />
      <Lightformer form="rect" intensity={2} color="#fff0dc" position={[6, 2, 4]} rotation-y={-Math.PI / 3} scale={[6, 3, 1]} />
      <Lightformer form="rect" intensity={1.4} color="#eaf1ff" position={[0, 7, -2]} rotation-x={Math.PI / 2} scale={[10, 6, 1]} />
    </Environment>
  )
}

// Keeps the record (and its sleeve) centred and fully in view.
function Rig({ sleeve, pullOut }) {
  const { camera, size, controls } = useThree()
  useEffect(() => {
    const aspect = size.width / size.height
    const top = sleeve ? Math.max(2.9, pullOut * 3.2 - 0.1 + 2.9) : 2.9
    const bottom = sleeve ? -2.98 : -2.9
    const h = top - bottom
    const w = sleeve ? 6.0 : 5.8
    const tan = Math.tan(THREE.MathUtils.degToRad(15))
    const dist = Math.max(h / 2 / tan, w / 2 / (tan * aspect)) * 1.12
    const cy = (top + bottom) / 2
    camera.position.set(0, cy, dist)
    camera.lookAt(0, cy, 0)
    if (controls) {
      controls.target.set(0, cy, 0)
      controls.update()
    }
  }, [camera, size.width, size.height, controls, sleeve, pullOut])
  return null
}

export default function VinylScene({ sleeve = false, pullOut = 0.55, ...props }) {
  return (
    <div style={{ width: '100%', height: '100%', touchAction: 'none' }}>
      <Canvas
        shadows
        dpr={[1, 1.75]}
        camera={{ position: [0, 0, 14], fov: 30, near: 0.1, far: 80 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.9 }}
      >
        <color attach="background" args={[BG]} />
        <hemisphereLight args={['#ffffff', '#c9ccd2', 0.35]} />
        <directionalLight
          position={[-3.5, 4.5, 8]}
          intensity={1.1}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-bias={-0.0004}
          shadow-camera-left={-8}
          shadow-camera-right={8}
          shadow-camera-top={8}
          shadow-camera-bottom={-8}
        />
        <Studio />
        <Vinyl sleeve={sleeve} pullOut={pullOut} {...props} />
        {/* A soft wall behind, to catch the shadow */}
        <mesh position={[0, 0, -2.2]} receiveShadow>
          <planeGeometry args={[60, 60]} />
          <shadowMaterial transparent opacity={0.13} />
        </mesh>
        <OrbitControls makeDefault enablePan={false} minDistance={6} maxDistance={40} />
        <Rig sleeve={sleeve} pullOut={pullOut} />
      </Canvas>
    </div>
  )
}
