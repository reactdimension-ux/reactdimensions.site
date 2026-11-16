import { Suspense, lazy } from 'react'

// A tabletop companion robot with a pan-and-tilt head and a live screen.
// The head follows the pointer, drag it to pose it, and tap the screen to
// change the face. (Thin wrapper: the scene lives in robot/RobotScene.jsx.)
const Scene = lazy(() => import('../robot/RobotScene.jsx'))

export default function CompanionRobotModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
