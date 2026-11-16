import { Suspense, lazy } from 'react'

// A low-poly observatory whose dome slowly turns; tap it and the slit opens, the telescope tilts up and the stars twinkle.
// (Thin wrapper: the scene lives in lowpoly/Observatory.jsx.)
const Scene = lazy(() => import('../lowpoly/Observatory.jsx'))

export default function LowPolyObservatoryModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
