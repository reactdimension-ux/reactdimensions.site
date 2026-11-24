import { Suspense, lazy } from 'react'

// A low-poly robot that shows an agent's state: it looks around when idle, nods while it thinks and waves when it is done.
// (Thin wrapper: the scene lives in lowpoly/RobotHelper.jsx.)
const Scene = lazy(() => import('../lowpoly/RobotHelper.jsx'))

export default function RobotHelperModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
