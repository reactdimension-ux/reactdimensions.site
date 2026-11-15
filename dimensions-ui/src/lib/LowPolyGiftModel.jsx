import { Suspense, lazy } from 'react'

// A low-poly gift box with a bouncing bow; tap it and the lid springs open with confetti and a star.
// (Thin wrapper: the scene lives in lowpoly/Gift.jsx.)
const Scene = lazy(() => import('../lowpoly/Gift.jsx'))

export default function LowPolyGiftModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
