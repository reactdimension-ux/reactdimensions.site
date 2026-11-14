import { Suspense, lazy } from 'react'

// A regulation tennis ball: real fuzzy felt built from stacked fibre
// shells, the classic curved seam, the React Dimensions mark printed on a
// panel, and the football's ball physics retuned for a tennis ball (drag,
// topspin and slice, an ITF drop test, three court surfaces).
// (Thin wrapper: the scene lives in tennisball/TennisBallScene.jsx.)
const Scene = lazy(() => import('../tennisball/TennisBallScene.jsx'))

export default function TennisBallModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
