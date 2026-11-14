import { useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { ContactShadows, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { CameraRig, FOV, InfoHint, Studio, V, fit, from } from '../airliner/stage.jsx'
import Helicopter from './Helicopter.jsx'

const BG = '#cdd0d2'

// The views of a reference sheet, in the airliner's studio. Each gives a
// camera position and target for the canvas aspect: the whole-aircraft ones
// back off until it fits.
const MID = 1.75
const VIEWS = {
  'three-quarter': (a) => from(V(0, MID, 0), V(-0.74, 0.2, 0.64), fit(14.6, 6, a)),
  'front-right': (a) => from(V(0, MID, 0), V(-0.74, 0.2, -0.64), fit(14.6, 6, a)),
  front: (a) => from(V(0, MID + 0.1, 0), V(-1, 0.03, 0), fit(11.6, 4.4, a)),
  rear: (a) => from(V(0, MID + 0.1, 0), V(1, 0.04, 0), fit(11.6, 4.4, a)),
  side: (a) => from(V(0, MID, 0), V(0, 0.03, 1), fit(14.4, 4.6, a)),
  'side-right': (a) => from(V(0, MID, 0), V(0, 0.03, -1), fit(14.4, 4.6, a)),
  top: (a) => from(V(0, 2, 0), V(0.0001, 1, 0), fit(14.4, 11.6, a)),
  underside: (a) => from(V(0, 1, 0), V(0.0001, -1, 0), fit(14.4, 11.6, a)),
  'rear-quarter': (a) => from(V(0, MID, 0), V(0.72, 0.22, 0.66), fit(14.6, 6, a)),
  'rear-right': (a) => from(V(0, MID, 0), V(0.72, 0.22, -0.66), fit(14.6, 6, a)),
  'rotor-head': () => from(V(-1.45, 3.05, 0), V(-0.5, 0.42, 0.76), 4.4),
  'tail-fan': () => from(V(5.5, 2.4, 0), V(0.3, 0.06, 1), 6.2),
  cockpit: () => from(V(-3.5, 1.45, 0.2), V(-0.76, 0.16, 0.63), 6),
  skids: () => from(V(-2.1, 0.55, 0.9), V(-0.5, 0.1, 0.86), 6),
  cowling: () => from(V(-0.9, 2.45, 0.3), V(0.5, 0.42, 0.76), 5.4),
}
export const VIEW_NAMES = Object.keys(VIEWS)

export default function HelicopterScene({ view = 'three-quarter', autoRotate = false, ...props }) {
  const start = useMemo(() => VIEWS['three-quarter'](1.6).pos.toArray(), [])
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none' }}>
      <Canvas shadows="variance" dpr={[1, 2]} camera={{ position: start, fov: FOV, near: 0.2, far: 400 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.92 }}>
        <color attach="background" args={[BG]} />
        <hemisphereLight args={['#ffffff', '#b9bcbf', 0.32]} />
        <directionalLight position={[-3, 30, 5]} intensity={0.95} color="#fffaf2" castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-radius={10} shadow-blurSamples={20}>
          <orthographicCamera attach="shadow-camera" args={[-9, 9, 9, -9, 5, 50]} />
        </directionalLight>
        <directionalLight position={[20, 12, -24]} intensity={0.35} color="#e8efff" />
        <Studio />
        <Helicopter {...props} />
        {/* the floor is only its shadows, so it runs seamlessly into the backdrop */}
        <mesh rotation-x={-Math.PI / 2} position-y={-0.002} receiveShadow>
          <planeGeometry args={[200, 200]} />
          <shadowMaterial opacity={0.12} />
        </mesh>
        <ContactShadows position={[0, 0.002, 0]} scale={18} resolution={1024} blur={2.4} far={4.5} opacity={0.6} color="#1b1e22" />
        <CameraRig view={view} views={VIEWS} />
        <OrbitControls makeDefault enablePan={false} autoRotate={autoRotate} autoRotateSpeed={0.5} minDistance={2} maxDistance={60} maxPolarAngle={Math.PI - 0.05} />
      </Canvas>
      <InfoHint>Click the rotor to start or stop the engines · click the fuselage to lift off or land · drag to orbit</InfoHint>
    </div>
  )
}
