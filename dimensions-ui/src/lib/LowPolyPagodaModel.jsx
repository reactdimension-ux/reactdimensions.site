import { Suspense, lazy } from 'react'

// A low-poly pagoda of stacked tiers with upturned eaves, wind chimes swinging from the corners. Tap it and lights glow tier by tier up to the spire.
// (Thin wrapper: the scene lives in lowpoly/Pagoda.jsx.)
const Scene = lazy(() => import('../lowpoly/Pagoda.jsx'))

export default function LowPolyPagodaModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
