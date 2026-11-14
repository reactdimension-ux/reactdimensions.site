import { useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { ContactShadows, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import Airliner from './Airliner.jsx'
import { CameraRig, FOV, InfoHint, Studio, V, fit, from } from './stage.jsx'

const BG = '#cdd0d2'

// The views of a reference sheet. Each gives a camera position and target for
// the canvas aspect: the whole-aircraft ones back off until it fits.
const VIEWS = {
  'three-quarter': (a) => from(V(0, 4.4, 0), V(-0.74, 0.2, 0.64), fit(41, 15, a)),
  front: (a) => from(V(0, 5.9, 0), V(-1, 0.02, 0), fit(38, 14, a)),
  rear: (a) => from(V(0, 5.9, 0), V(1, 0.03, 0), fit(38, 14, a)),
  side: (a) => from(V(0, 5.4, 0), V(0, 0.02, 1), fit(40, 13.5, a)),
  'side-right': (a) => from(V(0, 5.4, 0), V(0, 0.02, -1), fit(40, 13.5, a)),
  top: (a) => from(V(0, 4, 0), V(0.0001, 1, 0), fit(40, 38, a)),
  underside: (a) => from(V(0, 3, 0), V(0.0001, -1, 0), fit(40, 38, a)),
  'rear-quarter': (a) => from(V(0, 4.6, 0), V(0.72, 0.22, 0.66), fit(41, 15, a)),
  engine: () => from(V(-6.6, 1.9, 5.6), V(-0.8, 0.12, 0.45), 9.5),
  'flight-deck': () => from(V(-16.6, 4.3, 0.6), V(-0.72, 0.2, 0.67), 11),
  gear: () => from(V(-13.2, 1.2, 0), V(-1, 0.02, 0.05), 13),
  sharklet: () => from(V(2.6, 5.0, 17.3), V(-0.55, 0.12, 0.83), 11),
  tail: () => from(V(13.6, 8.2, 0), V(0.12, 0.02, 1), 21),
  door: () => from(V(-13.6, 4.1, 1.9), V(-0.12, 0.04, 1), 9),
}
export const VIEW_NAMES = Object.keys(VIEWS)

export default function AirlinerScene({ view = 'three-quarter', autoRotate = false, ...props }) {
  const start = useMemo(() => VIEWS['three-quarter'](1.6).pos.toArray(), [])
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none' }}>
      <Canvas shadows="variance" dpr={[1, 2]} camera={{ position: start, fov: FOV, near: 0.5, far: 600 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.92 }}>
        <color attach="background" args={[BG]} />
        <hemisphereLight args={['#ffffff', '#b9bcbf', 0.32]} />
        <directionalLight position={[-4, 60, 7]} intensity={0.95} color="#fffaf2" castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-radius={14} shadow-blurSamples={20}>
          <orthographicCamera attach="shadow-camera" args={[-26, 26, 26, -26, 5, 90]} />
        </directionalLight>
        <directionalLight position={[20, 12, -24]} intensity={0.35} color="#e8efff" />
        <Studio />
        <Airliner {...props} />
        {/* the floor is only its shadows, so it runs seamlessly into the backdrop */}
        <mesh rotation-x={-Math.PI / 2} position-y={-0.002} receiveShadow>
          <planeGeometry args={[400, 400]} />
          <shadowMaterial opacity={0.12} />
        </mesh>
        <ContactShadows position={[0, 0.002, 0]} scale={56} resolution={1024} blur={3} far={9} opacity={0.6} color="#1b1e22" />
        <CameraRig view={view} views={VIEWS} />
        <OrbitControls makeDefault enablePan={false} autoRotate={autoRotate} autoRotateSpeed={0.5} minDistance={5} maxDistance={150} maxPolarAngle={Math.PI - 0.05} />
      </Canvas>
      <InfoHint>Click the forward door to open it · click an engine to start it · click the landing gear to raise it · drag to orbit</InfoHint>
    </div>
  )
}
