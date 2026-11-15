import { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { ContactShadows, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { CameraRig, FOV, InfoHint, Studio, V, fit, from } from '../airliner/stage.jsx'
import Bus from './Bus.jsx'

const BG = '#cdd0d2'

// The views of a reference sheet, in the studio shared with the aircraft.
// Each gives a camera position and target for the canvas aspect: the
// whole-vehicle ones back off until it fits. The doors are on the right.
const MID = 1.7
const VIEWS = {
  'front-left': (a) => from(V(0, MID, 0), V(-0.72, 0.3, 0.64), fit(14, 5.2, a)),
  'front-right': (a) => from(V(0, MID, 0), V(-0.72, 0.3, -0.64), fit(14, 5.2, a)),
  'rear-left': (a) => from(V(0, MID, 0), V(0.72, 0.3, 0.64), fit(14, 5.2, a)),
  'rear-right': (a) => from(V(0, MID, 0), V(0.72, 0.3, -0.64), fit(14, 5.2, a)),
  front: (a) => from(V(-6.3, MID, 0), V(-1, 0.06, 0), fit(4.2, 4.2, a)),
  rear: (a) => from(V(6.3, MID, 0), V(1, 0.06, 0), fit(4.2, 4.2, a)),
  side: (a) => from(V(0, MID, 0), V(0, 0.03, 1), fit(13.2, 4, a)),
  'side-right': (a) => from(V(0, MID, 0), V(0, 0.03, -1), fit(13.2, 4, a)),
  roof: (a) => from(V(0, 2, 0), V(0.0001, 1, 0), fit(13.2, 3.6, a)),
  underside: (a) => from(V(0, 1, 0), V(0.0001, -1, 0), fit(13.2, 3.6, a)),
  'front-wheel': () => from(V(-3.25, 0.55, -1.2), V(-0.3, 0.12, -0.95), 2.8),
  'rear-wheel': () => from(V(2.75, 0.6, -1.2), V(0.3, 0.12, -0.95), 3.0),
  headlights: () => from(V(-6.1, 0.9, -0.55), V(-0.8, 0.18, -0.56), 3.0),
  'tail-lights': () => from(V(6.1, 1.2, -1.0), V(0.78, 0.15, -0.6), 3.0),
  doors: () => from(V(0.25, 1.5, -1.3), V(-0.05, 0.08, -1), 3.6),
  mirror: () => from(V(-6.3, 2.5, -1.4), V(-0.7, 0.2, -0.7), 2.4),
  windscreen: () => from(V(-6.1, 2.2, 0.3), V(-0.76, 0.22, 0.6), 3.6),
  'roof-grille': () => from(V(5.0, 2.7, 1.3), V(0.3, 0.3, 0.9), 2.8),
}
export const VIEW_NAMES = Object.keys(VIEWS)

// The floor is only its shadows; from underneath they would hang in the air,
// so they go when the camera is below the floor.
function Floor() {
  const ref = useRef()
  useFrame(({ camera }) => ref.current && (ref.current.visible = camera.position.y > 0.1))
  return (
    <group ref={ref}>
      <mesh rotation-x={-Math.PI / 2} position-y={-0.002} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <shadowMaterial opacity={0.14} />
      </mesh>
      <ContactShadows position={[0, 0.002, 0]} scale={18} resolution={1024} blur={2.2} far={2.5} opacity={0.65} color="#1b1e22" />
    </group>
  )
}

export default function BusScene({ view = 'front-left', autoRotate = false, ...props }) {
  const start = useMemo(() => VIEWS['front-left'](1.6).pos.toArray(), [])
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none' }}>
      <Canvas shadows="variance" dpr={[1, 2]} camera={{ position: start, fov: FOV, near: 0.2, far: 300 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.95 }}>
        <color attach="background" args={[BG]} />
        <hemisphereLight args={['#ffffff', '#b9bcbf', 0.35]} />
        <directionalLight position={[-6, 24, 10]} intensity={1.0} color="#fffaf2" castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-radius={8} shadow-blurSamples={16}>
          <orthographicCamera attach="shadow-camera" args={[-9, 9, 9, -9, 5, 50]} />
        </directionalLight>
        <directionalLight position={[16, 10, -20]} intensity={0.35} color="#e8efff" />
        <Studio />
        <Bus {...props} />
        <Floor />
        <CameraRig view={view} views={VIEWS} fallback="front-left" />
        <OrbitControls makeDefault enablePan={false} autoRotate={autoRotate} autoRotateSpeed={0.5} minDistance={1.5} maxDistance={60} maxPolarAngle={Math.PI - 0.05} />
      </Canvas>
      <InfoHint>Click the side or a door to open and close the doors · click the front for the lights · drag to orbit</InfoHint>
    </div>
  )
}
