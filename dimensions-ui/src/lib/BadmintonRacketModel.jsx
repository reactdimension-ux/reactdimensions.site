import { Suspense, lazy } from 'react'

// A badminton racket at regulation size: a box-section isometric frame
// with grommets and a string groove, a woven 22 x 24 string bed stencilled
// with the React Dimensions mark, a decalled graphite shaft and an
// overgripped octagonal handle. Tap the strings and they dent and ping.
// (Thin wrapper: the scene lives in racket/RacketScene.jsx.)
const Scene = lazy(() => import('../racket/RacketScene.jsx'))

export default function BadmintonRacketModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
