import { Suspense, lazy } from 'react'

// A suit of playing cards, ace to king, dealt onto a felt table: the Color
// Cards card shape and stock with traditional pips, indices, an ornamented
// ace and double-headed court cards. Deal, flip, and pick suit and layout.
// (Thin wrapper: the scene lives in playingcards/PlayingCardsScene.jsx.)
const Scene = lazy(() => import('../playingcards/PlayingCardsScene.jsx'))

export default function PlayingCardsModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
