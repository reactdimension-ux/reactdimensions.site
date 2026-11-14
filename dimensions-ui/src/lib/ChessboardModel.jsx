import { Suspense, lazy } from 'react'

// An inlaid wooden chessboard: walnut and maple veneer squares with their
// own grain, a stringing line and border, in a moulded, mitred, lacquered
// frame. Jump between the views on a reference sheet (top, elevations,
// four corners, and close-ups of the corner, grain, joinery and underside)
// or orbit freely. Built on the game board's frame and studio.
// (Thin wrapper: the scene lives in chessboard/ChessboardScene.jsx.)
const Scene = lazy(() => import('../chessboard/ChessboardScene.jsx'))

export default function ChessboardModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
