import { Suspense, lazy } from 'react'

// A deck of colour cards in four suits you pick the colours of, each with
// 0-9, skip, reverse and +2, and a card back with your own wordmark. Deal a
// fanned hand and flip cards over, or show a single card that tilts towards
// the pointer. Drag the background to orbit.
// (Thin wrapper: the scene lives in deck/DeckScene.jsx.)
const Scene = lazy(() => import('../deck/DeckScene.jsx'))

export default function ColorCardsModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
