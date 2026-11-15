import { Suspense, lazy } from 'react'

// A low-poly motion-graphics model; see lowpoly/Balloon.jsx for what it does.
// (Thin wrapper: the scene lives in lowpoly/Balloon.jsx.)
const Scene = lazy(() => import('../lowpoly/Balloon.jsx'))

export default function LowPolyBalloonModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
