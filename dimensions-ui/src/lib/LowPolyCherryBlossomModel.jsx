import { Suspense, lazy } from 'react'

// A low-poly cherry tree with a twisted trunk and a cloud of pink blossom. Petals drift down on their own; tap it and a gust sends a swirl of petals off the branches.
// (Thin wrapper: the scene lives in lowpoly/CherryBlossom.jsx.)
const Scene = lazy(() => import('../lowpoly/CherryBlossom.jsx'))

export default function LowPolyCherryBlossomModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
