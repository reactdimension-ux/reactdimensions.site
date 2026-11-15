import { Suspense, lazy } from 'react'

// A drilled tenpin bowling ball at real size, in a swirled pearl coverstock
// with metallic flake and real finger and thumb holes. Roll it and it skids,
// then hooks as the floor grips it; spin it on the spot. Drag to orbit.
// (Thin wrapper: the scene lives in bowlingball/BowlingBallScene.jsx.)
const Scene = lazy(() => import('../bowlingball/BowlingBallScene.jsx'))

export default function BowlingBallModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
