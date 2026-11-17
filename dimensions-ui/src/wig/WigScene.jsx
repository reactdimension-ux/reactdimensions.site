import { useEffect } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { InfoHint } from '../airliner/stage.jsx'
import Wig, { FLOOR } from './Wig.jsx'

const BG = '#e9e6e1'

// Soft studio light with a few long strips, so the hair's highlights read as bands.
function Studio() {
  return (
    <Environment resolution={256}>
      <color attach="background" args={['#8f8b86']} />
      <Lightformer form="rect" intensity={2.6} color="#ffffff" position={[0, 40, 14]} rotation-x={Math.PI / 2} scale={[60, 40, 1]} />
      <Lightformer form="rect" intensity={3.4} color="#fff1dc" position={[-40, 6, 16]} rotation-y={Math.PI / 2.3} scale={[12, 50, 1]} />
      <Lightformer form="rect" intensity={2.6} color="#e3eeff" position={[40, 6, 16]} rotation-y={-Math.PI / 2.3} scale={[12, 50, 1]} />
      <Lightformer form="rect" intensity={1.8} color="#ffffff" position={[0, 6, 46]} scale={[50, 30, 1]} />
      <Lightformer form="rect" intensity={2.2} color="#ffffff" position={[0, 8, -46]} rotation-y={Math.PI} scale={[50, 30, 1]} />
    </Environment>
  )
}

// Frames the head and as much of the hair as fits.
function Rig({ display, length }) {
  const { camera, size } = useThree()
  useEffect(() => {
    const aspect = size.width / size.height
    const tan = Math.tan(THREE.MathUtils.degToRad(15))
    const top = 14
    const bottom = display === 'bust' ? -30 : -Math.min(52, 12 + length * 0.9)
    const h = top - bottom
    const dist = Math.max((h * 1.2) / 2 / tan, 44 / 2 / (tan * aspect)) * 1.04
    const midY = (top + bottom) / 2
    const az = 0.5
    camera.position.set(Math.sin(az) * dist, midY + 4, Math.cos(az) * dist)
    camera.lookAt(0, midY, 0)
  }, [camera, size.width, size.height, display, length])
  return null
}

export default function WigScene({ autoRotate = false, ...props }) {
  const display = props.display || 'bust'
  const length = props.length ?? 45
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none' }}>
      <Canvas shadows dpr={[1, 1.75]} camera={{ position: [40, 0, 100], fov: 30, near: 1, far: 500 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1 }}>
        <color attach="background" args={[BG]} />
        <hemisphereLight args={['#ffffff', '#c9c4bd', 0.5]} />
        <directionalLight position={[-18, 34, 28]} intensity={1.1} />
        <Studio />
        <Wig {...props} />
        <ContactShadows position={[0, display === 'bust' ? FLOOR.bust : FLOOR.stand, 0]} opacity={0.4} scale={90} blur={2.8} far={30} resolution={512} color="#26211c" />
        <Rig display={display} length={length} />
        <OrbitControls makeDefault enablePan={false} autoRotate={autoRotate} autoRotateSpeed={1.2} minDistance={20} maxDistance={220} minPolarAngle={0.3} maxPolarAngle={2.1} />
      </Canvas>
      <InfoHint>Drag to orbit · scroll to zoom · the hair is real strands, grown from the scalp and draped over the head and shoulders · length, wave, curl, volume and the parting rebuild them</InfoHint>
    </div>
  )
}
