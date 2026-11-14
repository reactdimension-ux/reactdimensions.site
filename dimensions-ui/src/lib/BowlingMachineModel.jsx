import { Suspense, lazy } from 'react'

// A one-wheel cricket bowling machine on a tripod, fed by a spiral hopper.
// Balls roll down the spiral, drop through the gate onto the spinning wheel
// and fly down the pitch with real drag, Magnus swing and bounce. It fires
// the library's own tennis and cricket balls. Drag the background to orbit.
// (Thin wrapper: the scene lives in bowler/BowlingMachineScene.jsx.)
const Scene = lazy(() => import('../bowler/BowlingMachineScene.jsx'))

export default function BowlingMachineModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
