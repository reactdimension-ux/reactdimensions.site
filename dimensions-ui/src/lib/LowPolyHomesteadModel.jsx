import { Suspense, lazy } from 'react'

// A low-poly homestead diorama: a cottage on a floating L-shaped plot with a
// stream, a bridge, pines and clouds; tap it and the axe splits a log.
// (Thin wrapper: the scene lives in lowpoly/Homestead.jsx.)
const Scene = lazy(() => import('../lowpoly/Homestead.jsx'))

export default function LowPolyHomesteadModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
