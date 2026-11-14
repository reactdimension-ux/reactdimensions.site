import { Suspense, lazy } from 'react'

// Casino clay poker chips at real size, one stack per denomination in the
// common colour convention ($1 white to $1,000 yellow), with edge spots,
// engraved squares and a printed inlay. Click a stack to flick a chip.
// (Thin wrapper: the scene lives in pokerchips/ChipsScene.jsx.)
const Scene = lazy(() => import('../pokerchips/ChipsScene.jsx'))

export default function PokerChipsModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
