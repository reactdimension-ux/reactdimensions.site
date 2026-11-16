import { Suspense, lazy } from 'react'

// A low-poly scooter idling with a little shake; tap it and it pulls a wheelie, then rolls on.
// (Thin wrapper: the scene lives in lowpoly/Scooter.jsx.)
const Scene = lazy(() => import('../lowpoly/Scooter.jsx'))

export default function LowPolyScooterModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
