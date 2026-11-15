import { Suspense, lazy } from 'react'

// A low-poly star that spins and shimmers; tap it and it whirls and bursts into little stars.
// (Thin wrapper: the scene lives in lowpoly/Star.jsx.)
const Scene = lazy(() => import('../lowpoly/Star.jsx'))

export default function LowPolyStarModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
