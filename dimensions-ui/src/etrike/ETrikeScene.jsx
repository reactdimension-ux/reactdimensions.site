import { useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { ContactShadows, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { CameraRig, FOV, InfoHint, Studio, V, fit, from } from '../airliner/stage.jsx'
import ETrike from './ETrike.jsx'

const BG = '#d6d8d9'

// The views of the reference sheet, in the airliner's studio: the six
// orthographic ones, the four three-quarters, and the close-ups (the cockpit
// from the driver's seat, the battery under the lifted bench, the charging
// flap, a headlamp, the front wheel and its brake, the passengers' bench).
// The whole-vehicle ones back off until it fits the canvas.
const MID = 0.85
const VIEWS = {
  'front-left': (a) => from(V(0, MID - 0.05, 0), V(-0.74, 0.22, 0.64), fit(3.3, 1.9, a)),
  'front-right': (a) => from(V(0, MID - 0.05, 0), V(-0.74, 0.22, -0.64), fit(3.3, 1.9, a)),
  front: (a) => from(V(0, MID, 0), V(-1, 0.04, 0), fit(1.9, 2.5, a)),
  rear: (a) => from(V(0, MID, 0), V(1, 0.04, 0), fit(1.9, 2.5, a)),
  side: (a) => from(V(0, MID, 0), V(0, 0.03, 1), fit(3.0, 1.85, a)),
  'side-right': (a) => from(V(0, MID, 0), V(0, 0.03, -1), fit(3.0, 1.85, a)),
  top: (a) => from(V(0, 0.8, 0), V(0.0001, 1, 0), fit(1.35, 3.0, a)),
  underside: (a) => from(V(0, 0.3, 0), V(0.0001, -1, 0), fit(1.35, 3.0, a)),
  'rear-left': (a) => from(V(0, MID - 0.05, 0), V(0.72, 0.22, 0.66), fit(3.3, 1.9, a)),
  'rear-right': (a) => from(V(0, MID - 0.05, 0), V(0.72, 0.22, -0.66), fit(3.3, 1.9, a)),
  cockpit: () => from(V(-0.86, 1.02, 0), V(0.86, 0.36, 0.1), 1.2),
  battery: () => from(V(0.25, 0.55, 0), V(-0.45, 0.8, 1), 2.0),
  'charging-port': () => from(V(1.19, 0.74, 0.6), V(0.3, 0.12, 1), 0.85),
  headlamp: () => from(V(-1.33, 0.82, 0.27), V(-1, 0.12, 0.55), 0.95),
  wheel: () => from(V(-1.13, 0.27, 0.05), V(-0.35, 0.15, 1), 1.15),
  seating: () => from(V(0.34, 0.85, 0), V(-0.6, 0.38, 1), 2.0),
}
export const VIEW_NAMES = Object.keys(VIEWS)

export default function ETrikeScene({ view = 'front-left', autoRotate = false, ...props }) {
  const start = useMemo(() => VIEWS['front-left'](1.6).pos.toArray(), [])
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none' }}>
      <Canvas shadows="variance" dpr={[1, 2]} camera={{ position: start, fov: FOV, near: 0.03, far: 120 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.95 }}>
        <color attach="background" args={[BG]} />
        <hemisphereLight args={['#ffffff', '#b9bcbf', 0.35]} />
        <directionalLight position={[-1.5, 9, 2.5]} intensity={1.0} color="#fffaf2" castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0003} shadow-radius={8} shadow-blurSamples={20}>
          <orthographicCamera attach="shadow-camera" args={[-2.4, 2.4, 2.4, -2.4, 2, 16]} />
        </directionalLight>
        <directionalLight position={[6, 4, -7]} intensity={0.35} color="#e8efff" />
        <Studio />
        <ETrike {...props} />
        {/* the floor is only its shadows, so it runs seamlessly into the backdrop */}
        <mesh rotation-x={-Math.PI / 2} position-y={-0.001} receiveShadow>
          <planeGeometry args={[60, 60]} />
          <shadowMaterial opacity={0.13} />
        </mesh>
        <ContactShadows position={[0, 0.001, 0]} scale={5} resolution={1024} blur={2} far={1.2} opacity={0.65} color="#1b1e22" />
        <CameraRig view={view} views={VIEWS} fallback="front-left" />
        <OrbitControls makeDefault enablePan={false} autoRotate={autoRotate} autoRotateSpeed={0.6} minDistance={0.4} maxDistance={14} maxPolarAngle={Math.PI - 0.05} />
      </Canvas>
      <InfoHint>Click the body for the lights · the handlebar to drive · the bench to lift it off the battery · the flap on the left rear to plug in and charge · drag to orbit</InfoHint>
    </div>
  )
}
