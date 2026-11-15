import { useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { ContactShadows, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { CameraRig, FOV, InfoHint, Studio, V, fit, from } from '../airliner/stage.jsx'
import Can from './Can.jsx'
import { HEIGHT, R, RIVET } from './geometry.js'

const BG = '#dcdddc'

// The views of a product sheet, in the aircraft studio (its soft boxes are
// what the aluminium mirrors): six orthographic-ish, four three-quarters and
// five close-ups. The whole-can ones back off until it fits.
const MID = V(0, HEIGHT / 2, 0)
const whole = (dir) => (a) => from(MID.clone(), V(...dir), fit(R * 2.4, HEIGHT * 1.15, a))
const quarter = (sx, sz) => (a) => from(MID.clone(), V(sx * 0.7, 0.42, sz * 0.7), fit(R * 2.6, HEIGHT * 1.2, a))
const VIEWS = {
  front: whole([0, 0.02, 1]),
  back: whole([0, 0.02, -1]),
  left: whole([-1, 0.02, 0]),
  right: whole([1, 0.02, 0]),
  top: (a) => from(V(0, HEIGHT, 0), V(0, 1, 0.0001), fit(R * 2.4, R * 2.4, a)),
  bottom: (a) => from(V(0, 0, 0), V(0, -1, 0.0001), fit(R * 2.4, R * 2.4, a)),
  'front-left': quarter(-1, 1),
  'front-right': quarter(1, 1),
  'rear-left': quarter(-1, -1),
  'rear-right': quarter(1, -1),
  'pull-tab': () => from(V(0, HEIGHT - 0.005, RIVET.z + 0.002), V(0.25, 1, 0.55), 0.075),
  'opening-panel': () => from(V(0, HEIGHT - 0.006, 0.004), V(-0.1, 1, 0.12), 0.07),
  'top-rim': () => from(V(0.012, HEIGHT - 0.004, 0.02), V(0.55, 0.45, 0.7), 0.075),
  body: () => from(V(0, HEIGHT * 0.55, R), V(0.2, 0.1, 1), 0.08),
  base: () => from(V(0, 0.003, 0), V(0.3, -0.85, 0.45), 0.09),
}
export const VIEW_NAMES = Object.keys(VIEWS)

export default function CanScene({ view = 'front-left', autoRotate = false, ...props }) {
  const start = useMemo(() => VIEWS['front-left'](1.6).pos.toArray(), [])
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none' }}>
      <Canvas shadows="variance" dpr={[1, 2]} camera={{ position: start, fov: FOV, near: 0.002, far: 10 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.95 }}>
        <color attach="background" args={[BG]} />
        <hemisphereLight args={['#ffffff', '#b9bcbf', 0.3]} />
        <directionalLight position={[-0.25, 0.7, 0.4]} intensity={1.0} color="#fffaf2" castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.00005} shadow-normalBias={0.0004} shadow-radius={6} shadow-blurSamples={16}>
          <orthographicCamera attach="shadow-camera" args={[-0.12, 0.12, 0.12, -0.12, 0.2, 2]} />
        </directionalLight>
        <directionalLight position={[0.5, 0.3, -0.6]} intensity={0.4} color="#e8efff" />
        {/* a glancing light from below, so the base's dome and standing ring read when the can is turned over */}
        <directionalLight position={[0.3, -0.6, 0.5]} intensity={0.9} color="#ffffff" />
        <Studio />
        <Can {...props} />
        {/* the floor is only its shadows, so it runs seamlessly into the backdrop */}
        <mesh rotation-x={-Math.PI / 2} position-y={-0.0002} receiveShadow>
          <planeGeometry args={[4, 4]} />
          <shadowMaterial opacity={0.14} />
        </mesh>
        <ContactShadows position={[0, 0.0001, 0]} scale={0.3} resolution={1024} blur={2.2} far={0.08} opacity={0.6} color="#1b1e22" />
        <CameraRig view={view} views={VIEWS} fallback="front-left" />
        <OrbitControls makeDefault enablePan={false} autoRotate={autoRotate} autoRotateSpeed={0.6} minDistance={0.03} maxDistance={1.5} />
      </Canvas>
      <InfoHint>Click the pull tab to open or close the can · drag to orbit · scroll to zoom</InfoHint>
    </div>
  )
}
