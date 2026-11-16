import { Suspense, lazy } from 'react'

// A low-poly cable car gliding along its wire between two towers; tap it and the cabin swings as it stops.
// (Thin wrapper: the scene lives in lowpoly/CableCar.jsx.)
const Scene = lazy(() => import('../lowpoly/CableCar.jsx'))

export default function LowPolyCableCarModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
