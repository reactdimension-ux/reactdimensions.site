import { Suspense, lazy } from 'react'

// A low-poly maple in full autumn colour, its crown of orange and red blobs over a sturdy trunk and a scatter of fallen leaves. A leaf falls now and then; tap it and it shakes out a flurry of leaves.
// (Thin wrapper: the scene lives in lowpoly/Maple.jsx.)
const Scene = lazy(() => import('../lowpoly/Maple.jsx'))

export default function LowPolyAutumnMapleModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
