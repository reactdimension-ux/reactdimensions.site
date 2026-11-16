import { Suspense, lazy } from 'react'

// A low-poly pocket compass: the needle seeks and settles on north. Tap it and the needle spins wildly, then swings back to point north.
// (Thin wrapper: the scene lives in lowpoly/Compass.jsx.)
const Scene = lazy(() => import('../lowpoly/Compass.jsx'))

export default function LowPolyCompassModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
