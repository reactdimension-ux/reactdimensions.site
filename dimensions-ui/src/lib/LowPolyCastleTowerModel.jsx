import { Suspense, lazy } from 'react'

// A low-poly castle tower with a rippling flag; tap it and the cannon fires.
// (Thin wrapper: the scene lives in lowpoly/CastleTower.jsx.)
const Scene = lazy(() => import('../lowpoly/CastleTower.jsx'))

export default function LowPolyCastleTowerModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
