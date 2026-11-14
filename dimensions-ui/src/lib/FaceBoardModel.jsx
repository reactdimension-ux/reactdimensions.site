import { Suspense, lazy } from 'react'

// A face-guessing board: a moulded tray of hinged flip frames, empty until
// you fill them with your own photos (Add photos, or drop image files onto
// the board or onto one frame). Each frame tips forward on a real hinge and
// lands face down on the tray. Drag the background to orbit.
// (Thin wrapper: the scene lives in faceboard/FaceBoardScene.jsx.)
const Scene = lazy(() => import('../faceboard/FaceBoardScene.jsx'))

export default function FaceBoardModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
