import { Suspense, lazy } from 'react'

// A three-spoke steering wheel in leather and walnut with the React
// Dimensions R on the airbag cover. Drag the rim to steer; it returns to
// centre on the tyres' self-aligning torque, harder the faster you go. Press
// the cover for the horn; the scroll wheels set volume and speed.
// Drag the background to orbit.
// (Thin wrapper: the scene lives in steering/SteeringScene.jsx.)
const Scene = lazy(() => import('../steering/SteeringScene.jsx'))

export default function SteeringWheelModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
