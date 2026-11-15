import { Suspense, lazy } from 'react'

// A low-poly sprinting man on a procedural run cycle; tap him and he leaps, or freeze him in a hero lunge.
// (Thin wrapper: the scene lives in lowpoly/Runner.jsx.)
const Scene = lazy(() => import('../lowpoly/Runner.jsx'))

export default function LowPolyRunnerModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
