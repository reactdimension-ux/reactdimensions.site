import { Suspense, lazy } from 'react'

// A low-poly clock tower with its hands ticking round; tap it and the bell swings and rings.
// (Thin wrapper: the scene lives in lowpoly/ClockTower.jsx.)
const Scene = lazy(() => import('../lowpoly/ClockTower.jsx'))

export default function LowPolyClockTowerModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
