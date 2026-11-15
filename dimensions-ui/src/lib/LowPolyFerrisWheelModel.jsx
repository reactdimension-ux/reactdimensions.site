import { Suspense, lazy } from 'react'

// A low-poly Ferris wheel with a real drive, brake and rotor physics; gondolas swing as pendulums. Tap a gondola to add riders.
// (Thin wrapper: the scene lives in lowpoly/FerrisWheel.jsx.)
const Scene = lazy(() => import('../lowpoly/FerrisWheel.jsx'))

export default function LowPolyFerrisWheelModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
