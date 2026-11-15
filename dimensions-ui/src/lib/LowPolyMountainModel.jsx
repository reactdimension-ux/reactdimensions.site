import { Suspense, lazy } from 'react'

// A low-poly mountain banded from forest to snow with circling clouds; tap it for an avalanche.
// (Thin wrapper: the scene lives in lowpoly/Mountain.jsx.)
const Scene = lazy(() => import('../lowpoly/Mountain.jsx'))

export default function LowPolyMountainModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
