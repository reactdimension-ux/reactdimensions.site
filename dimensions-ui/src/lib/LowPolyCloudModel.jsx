import { Suspense, lazy } from 'react'

// A low-poly cloud that drifts and breathes; tap it and it rains, snows, storms or sprinkles.
// (Thin wrapper: the scene lives in lowpoly/Cloud.jsx.)
const Scene = lazy(() => import('../lowpoly/Cloud.jsx'))

export default function LowPolyCloudModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
