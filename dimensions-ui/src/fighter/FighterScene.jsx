import { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { ContactShadows, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { CameraRig, FOV, InfoHint, Studio, V, fit, from } from '../airliner/stage.jsx'
import Fighter from './Fighter.jsx'

const BG = '#cdd0d2'

// The views of a reference sheet, in the aircraft studio shared with the
// airliner and the helicopter. Each gives a camera position and target for
// the canvas aspect: the whole-aircraft ones back off until it fits.
const MID = 2.4
const VIEWS = {
  'front-left': (a) => from(V(0, MID, 0), V(-0.72, 0.26, 0.64), fit(23, 8.5, a)),
  'front-right': (a) => from(V(0, MID, 0), V(-0.72, 0.26, -0.64), fit(23, 8.5, a)),
  'rear-left': (a) => from(V(0, MID, 0), V(0.72, 0.26, 0.64), fit(23, 8.5, a)),
  'rear-right': (a) => from(V(0, MID, 0), V(0.72, 0.26, -0.64), fit(23, 8.5, a)),
  front: (a) => from(V(0, MID + 0.2, 0), V(-1, 0.05, 0), fit(15.6, 6.2, a)),
  rear: (a) => from(V(0, MID + 0.2, 0), V(1, 0.05, 0), fit(15.6, 6.2, a)),
  side: (a) => from(V(0, MID, 0), V(0, 0.03, 1), fit(21.5, 6.4, a)),
  'side-right': (a) => from(V(0, MID, 0), V(0, 0.03, -1), fit(21.5, 6.4, a)),
  top: (a) => from(V(0, 2, 0), V(0.0001, 1, 0), fit(21.5, 15.5, a)),
  underside: (a) => from(V(0, 1, 0), V(0.0001, -1, 0), fit(21.5, 15.5, a)),
  cockpit: () => from(V(-4.4, 3.15, 0.2), V(-0.62, 0.36, 0.7), 5.4),
  'landing-gear': () => from(V(1.1, 0.85, 1.3), V(-0.55, 0.12, 0.83), 6.2),
  'wing-surface': () => from(V(2.6, 2.3, 4.4), V(-0.35, 0.62, 0.7), 7.5),
  'air-intakes': () => from(V(-4.7, 2.0, 1.6), V(-0.82, 0.12, 0.56), 5.6),
  'tail-fins': () => from(V(5.2, 4.0, 0), V(0.72, 0.32, 0.62), 8),
  'exhaust-nozzles': () => from(V(9.4, 2.3, 0), V(0.9, 0.22, 0.38), 6),
}
export const VIEW_NAMES = Object.keys(VIEWS)

// The floor is only its shadows; from underneath (the underside view) they
// would hang in the air, so they go when the camera is below the floor.
function Floor() {
  const ref = useRef()
  useFrame(({ camera }) => ref.current && (ref.current.visible = camera.position.y > 0.1))
  return (
    <group ref={ref}>
      <mesh rotation-x={-Math.PI / 2} position-y={-0.002} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <shadowMaterial opacity={0.12} />
      </mesh>
      <ContactShadows position={[0, 0.002, 0]} scale={26} resolution={1024} blur={2.4} far={5} opacity={0.6} color="#1b1e22" />
    </group>
  )
}

export default function FighterScene({ view = 'front-left', autoRotate = false, ...props }) {
  const start = useMemo(() => VIEWS['front-left'](1.6).pos.toArray(), [])
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none' }}>
      <Canvas shadows="variance" dpr={[1, 2]} camera={{ position: start, fov: FOV, near: 0.2, far: 400 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.92 }}>
        <color attach="background" args={[BG]} />
        <hemisphereLight args={['#ffffff', '#b9bcbf', 0.32]} />
        <directionalLight position={[-6, 32, 8]} intensity={0.95} color="#fffaf2" castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-radius={10} shadow-blurSamples={20}>
          <orthographicCamera attach="shadow-camera" args={[-13, 13, 13, -13, 5, 60]} />
        </directionalLight>
        <directionalLight position={[20, 12, -24]} intensity={0.35} color="#e8efff" />
        <Studio />
        <Fighter {...props} />
        <Floor />
        <CameraRig view={view} views={VIEWS} fallback="front-left" />
        <OrbitControls makeDefault enablePan={false} autoRotate={autoRotate} autoRotateSpeed={0.5} minDistance={2} maxDistance={80} maxPolarAngle={Math.PI - 0.05} />
      </Canvas>
      <InfoHint>Click the canopy to open it · click the belly to open the weapon bays · click a wheel to raise or lower the gear · click a nozzle to light the afterburners · drag to orbit</InfoHint>
    </div>
  )
}
