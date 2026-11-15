import { Suspense, lazy } from 'react'

// A low-poly palm on a sandy islet whose trunk sways as a lag chain; tap it and a coconut drops.
// (Thin wrapper: the scene lives in lowpoly/Palm.jsx.)
const Scene = lazy(() => import('../lowpoly/Palm.jsx'))

export default function LowPolyPalmModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
