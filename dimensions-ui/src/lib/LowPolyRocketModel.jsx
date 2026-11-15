import { Suspense, lazy } from 'react'

// A low-poly rocket idling on its pad; tap it and it launches with a smoke trail and lands again.
// (Thin wrapper: the scene lives in lowpoly/Rocket.jsx.)
const Scene = lazy(() => import('../lowpoly/Rocket.jsx'))

export default function LowPolyRocketModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
