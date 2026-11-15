import { useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { ContactShadows, OrbitControls } from '@react-three/drei'
import { CameraRig, FOV, InfoHint, Studio, V, fit, from } from '../airliner/stage.jsx'
import { Effects } from '../gameboard/stage.jsx'
import StadiumSeat, { SPACING } from './StadiumSeat.jsx'

const BG = '#e3e3e1'

// The views of a product sheet: the six orthographic-ish ones, two
// three-quarters and four close-ups. The whole-seat views back off until the
// row fits; the close-ups look at the middle seat.
function views(seats) {
  const n = Math.max(1, Math.round(seats))
  const w = (n - 1) * SPACING + 0.52
  const x = (Math.floor((n - 1) / 2) - (n - 1) / 2) * SPACING
  const T = V(0, 0.44, -0.03)
  return {
    'three-quarter': (a) => from(T.clone(), V(0.62, 0.42, 0.92), fit(w * 0.95, 0.95, a)),
    front: (a) => from(T.clone(), V(0, 0.16, 1), fit(w, 0.95, a)),
    back: (a) => from(T.clone(), V(0, 0.16, -1), fit(w, 0.95, a)),
    side: (a) => from(V(0, 0.44, -0.03), V(-1, 0.06, 0), fit(0.62, 0.95, a)),
    'side-right': (a) => from(V(0, 0.44, -0.03), V(1, 0.06, 0), fit(0.62, 0.95, a)),
    top: (a) => from(V(0, 0.45, -0.03), V(0, 1, 0.16), fit(w * 1.15, 0.8, a)),
    underside: (a) => from(V(0, 0.42, -0.03), V(0, -1, 0.16), fit(w * 1.15, 0.8, a)),
    'rear-quarter': (a) => from(T.clone(), V(0.85, 0.28, -0.82), fit(w * 0.95, 0.95, a)),
    'seat-edge': () => from(V(x - 0.1, 0.42, 0.12), V(0.55, 0.42, 0.9), 0.62),
    backrest: () => from(V(x + 0.02, 0.66, -0.2), V(0.45, 0.22, 1), 0.7),
    ribs: () => from(V(x, 0.37, -0.02), V(0.12, -1, 0.42), 0.62),
    bracket: () => from(V(x + 0.12, 0.4, -0.24), V(0.5, 0.08, -0.86), 0.58),
  }
}
export const VIEW_NAMES = Object.keys(views(1))

export default function StadiumSeatScene({ view = 'three-quarter', autoRotate = false, seats = 1, ambientOcclusion = true, ...props }) {
  const table = useMemo(() => views(seats), [seats])
  const start = useMemo(() => table['three-quarter'](1.6).pos.toArray(), [table])
  const half = (Math.max(1, Math.round(seats)) - 1) * SPACING * 0.5 + 1
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none' }}>
      <Canvas shadows="variance" dpr={[1, 2]} camera={{ position: start, fov: FOV, near: 0.01, far: 40 }} gl={{ antialias: false, powerPreference: 'high-performance' }}>
        <color attach="background" args={[BG]} />
        <hemisphereLight args={['#ffffff', '#c4c6c8', 0.35]} />
        <directionalLight position={[-1.1, 3.2, 1.6]} intensity={1.05} color="#fffaf3" castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0002} shadow-normalBias={0.002} shadow-radius={8} shadow-blurSamples={16}>
          <orthographicCamera attach="shadow-camera" args={[-half, half, 1.2, -1.2, 0.5, 8]} />
        </directionalLight>
        <directionalLight position={[2, 1.2, -2.4]} intensity={0.45} color="#eef3ff" />
        <Studio />
        <StadiumSeat seats={seats} {...props} />
        {/* the floor is only its shadows, so it runs seamlessly into the backdrop */}
        <mesh rotation-x={-Math.PI / 2} position-y={-0.001} receiveShadow>
          <planeGeometry args={[30, 30]} />
          <shadowMaterial opacity={0.14} />
        </mesh>
        <ContactShadows position={[0, 0.0005, 0]} scale={half * 2 + 1} resolution={1024} blur={2} far={0.9} opacity={0.55} color="#1d1f24" />
        {/* a new row length re-frames the camera */}
        <CameraRig key={seats} view={view} views={table} />
        <Effects ao={ambientOcclusion} radius={0.035} />
        <OrbitControls makeDefault enablePan={false} autoRotate={autoRotate} autoRotateSpeed={0.6} minDistance={0.25} maxDistance={8} />
      </Canvas>
      <InfoHint>Click a seat to lift the shell off its brackets and back · drag to orbit · scroll to zoom</InfoHint>
    </div>
  )
}
