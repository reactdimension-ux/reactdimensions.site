import { Suspense, lazy } from 'react'

// A boxy low-poly robot with a screen face and an antenna whose light blinks while its head turns to look around. Tap it and it waves.
// (Thin wrapper: the scene lives in lowpoly/Robot.jsx.)
const Scene = lazy(() => import('../lowpoly/Robot.jsx'))

export default function LowPolyRobotModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
