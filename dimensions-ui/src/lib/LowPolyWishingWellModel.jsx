import { Suspense, lazy } from 'react'

// A low-poly wishing well: a ring of stones, a little roof and a bucket bobbing on its rope. Tap it and a coin drops in and splashes.
// (Thin wrapper: the scene lives in lowpoly/WishingWell.jsx.)
const Scene = lazy(() => import('../lowpoly/WishingWell.jsx'))

export default function LowPolyWishingWellModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
