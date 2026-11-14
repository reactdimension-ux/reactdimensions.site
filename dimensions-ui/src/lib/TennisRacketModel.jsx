import { Suspense, lazy } from 'react'

// A tennis racket at standard size: a deep box-beam frame with an open
// throat and bridge, grommets in a channel, a woven 16 x 19 string bed
// stencilled with the React Dimensions mark, a blue fade paint job and a
// white-gripped octagonal handle. Tap the strings and they dent and ping.
// (Thin wrapper: the scene lives in tennis/TennisRacketScene.jsx.)
const Scene = lazy(() => import('../tennis/TennisRacketScene.jsx'))

export default function TennisRacketModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
