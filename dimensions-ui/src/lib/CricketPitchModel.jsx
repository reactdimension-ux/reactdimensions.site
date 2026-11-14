import { Suspense, lazy } from 'react'

// A full-size cricket pitch cut out of the ground: 20.12 m between the
// stumps, real grass blades, creases painted to the Laws, footmarks, ball
// marks and cracks that grow with wear. Jump between the views on a pitch
// drawing (3D, top, side, end, stumps, surface) or orbit freely.
// (Thin wrapper: the scene lives in pitch/PitchScene.jsx.)
const Scene = lazy(() => import('../pitch/PitchScene.jsx'))

export default function CricketPitchModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
