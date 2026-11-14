import { Suspense, lazy } from 'react'

// A realistic shakehand table tennis bat, branded RD: a 5-ply blade with
// sloping shoulders, inverted rubbers (red forehand, black backhand) on
// orange sponge with a pressed-in logo panel, and a lacquered flared handle
// with a laminated centre strip and badge. Click it to flip it over.
// (Thin wrapper: the scene lives in ttbat/TTBatScene.jsx.)
const Scene = lazy(() => import('../ttbat/TTBatScene.jsx'))

export default function TTBatModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
