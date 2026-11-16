import { Suspense, lazy } from 'react'

// A low-poly barn with a gable roof, a silo beside it and a weathervane that turns in the wind. Tap it and the barn doors swing open.
// (Thin wrapper: the scene lives in lowpoly/Barn.jsx.)
const Scene = lazy(() => import('../lowpoly/Barn.jsx'))

export default function LowPolyBarnModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
