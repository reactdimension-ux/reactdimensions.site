import { Canvas } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { InfoHint } from '../airliner/stage.jsx'
import Robot from './Robot.jsx'

// A soft grey studio: big softboxes either side and above, a pale table.
function Studio() {
  return (
    <Environment resolution={256}>
      <color attach="background" args={['#9a9a98']} />
      <Lightformer form="rect" intensity={2.2} color="#ffffff" position={[-8, 6, 6]} rotation-y={Math.PI / 3.2} scale={[6, 10, 1]} />
      <Lightformer form="rect" intensity={1.2} color="#eef2ff" position={[8, 5, 5]} rotation-y={-Math.PI / 3} scale={[6, 9, 1]} />
      <Lightformer form="rect" intensity={1.6} color="#ffffff" position={[0, 12, 0]} rotation-x={Math.PI / 2} scale={[14, 8, 1]} />
      <Lightformer form="rect" intensity={0.8} color="#ffffff" position={[0, 3, -9]} scale={[12, 6, 1]} />
    </Environment>
  )
}

export default function RobotScene({ autoRotate = false, background = '#dcdcda', ...props }) {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none', background }}>
      <Canvas shadows dpr={[1, 1.75]} camera={{ position: [3.4, 5.0, 14.5], fov: 30, near: 0.1, far: 100 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}>
        <color attach="background" args={[background]} />
        <hemisphereLight args={['#ffffff', '#b8b6b0', 0.35]} />
        <directionalLight position={[-5, 9, 6]} intensity={1.1} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0003} shadow-normalBias={0.02} shadow-camera-left={-5} shadow-camera-right={5} shadow-camera-top={8} shadow-camera-bottom={-3} />
        <Studio />
        <mesh rotation-x={-Math.PI / 2} receiveShadow>
          <planeGeometry args={[60, 60]} />
          <meshStandardMaterial color={background} roughness={0.9} />
        </mesh>
        <ContactShadows position-y={0.002} scale={8} blur={2.4} opacity={0.45} far={2} resolution={512} />
        <Robot {...props} />
        <OrbitControls makeDefault enablePan={false} target={[0, 3.15, 0]} autoRotate={autoRotate} autoRotateSpeed={0.6} minDistance={6} maxDistance={30} minPolarAngle={0.3} maxPolarAngle={1.55} />
      </Canvas>
      <InfoHint>Move the pointer and the head turns to follow it · drag the head to pose it on its neck · tap the screen to change the face · drag the background to orbit</InfoHint>
    </div>
  )
}
