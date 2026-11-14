import { Suspense, lazy } from 'react'

// Pinch and twist a small smart speaker. Two pointers pinching zoom the model,
// twisting them turns it about its vertical axis; the mouse wheel zooms and a
// one-pointer drag turns it. Since a desktop has no pinch there are also +, -,
// rotate-left and rotate-right buttons and a readout of zoom and angle. Damped,
// limited, double-tap or double-click resets.
// (Thin wrapper: the scene lives in ix/PinchTwist.jsx.)
const Scene = lazy(() => import('../ix/PinchTwist.jsx'))

export default function PinchTwist({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
