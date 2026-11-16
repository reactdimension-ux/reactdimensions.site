import { Suspense, lazy } from 'react'

// Faceted low-poly hills under a night sky, with ribbons of aurora rippling across it and stars twinkling. Tap it and the ribbons flare bright and surge.
// (Thin wrapper: the scene lives in lowpoly/Aurora.jsx.)
const Scene = lazy(() => import('../lowpoly/Aurora.jsx'))

export default function LowPolyAuroraHillsModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
