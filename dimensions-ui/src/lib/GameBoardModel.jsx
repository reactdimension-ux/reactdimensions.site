import { Suspense, lazy } from 'react'

// A 10 x 10 race board numbered 1 to 100, printed and laminated in a
// mitred, lacquered hardwood frame, with pawns and a die you can play with.
// Jump between the views on a reference sheet (top, front, rear, four
// corners, start, finish, frame joint) or orbit freely.
// (Thin wrapper: the scene lives in gameboard/BoardScene.jsx.)
const Scene = lazy(() => import('../gameboard/BoardScene.jsx'))

export default function GameBoardModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
