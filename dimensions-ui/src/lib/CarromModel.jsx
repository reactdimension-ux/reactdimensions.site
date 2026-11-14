import { Suspense, lazy } from 'react'

// A tournament carrom board, without the coins: a lacquered birch playing
// surface with the standard markings, net-bag pockets and a deep rounded
// walnut frame. Built on the board models' frame, textures and studio.
// (Thin wrapper: the scene lives in carrom/CarromScene.jsx.)
const Scene = lazy(() => import('../carrom/CarromScene.jsx'))

export default function CarromModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
