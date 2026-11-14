import { Suspense, lazy } from 'react'

// A cricket ball at real size: stitched leather, a raised six-row seam, a
// shiny side and a scuffed side, and real bounce, grip and roll physics.
// Toss it with backspin or spin it on the spot.
// (Thin wrapper: the scene lives in cricketball/CricketBallScene.jsx.)
const Scene = lazy(() => import('../cricketball/CricketBallScene.jsx'))

export default function CricketBallModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
