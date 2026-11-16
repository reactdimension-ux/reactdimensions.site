import { Suspense, lazy } from 'react'

// A low-poly black hole with a swirling accretion disk that bends the light; tap it and it pulls in a passing asteroid.
// (Thin wrapper: the scene lives in lowpoly/BlackHole.jsx.)
const Scene = lazy(() => import('../lowpoly/BlackHole.jsx'))

export default function LowPolyBlackHoleModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
