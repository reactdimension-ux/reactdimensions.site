import { Suspense, lazy } from 'react'

// A low-poly iceberg in a clear sea with a penguin on top; tap it and it rocks and splashes.
// (Thin wrapper: the scene lives in lowpoly/Iceberg.jsx.)
const Scene = lazy(() => import('../lowpoly/Iceberg.jsx'))

export default function LowPolyIcebergModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
