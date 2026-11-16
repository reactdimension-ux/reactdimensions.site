import { Suspense, lazy } from 'react'

// A low-poly water tower on four legs with a ladder and a slow drip; tap it and the tank sloshes and a leak sprays.
// (Thin wrapper: the scene lives in lowpoly/WaterTower.jsx.)
const Scene = lazy(() => import('../lowpoly/WaterTower.jsx'))

export default function LowPolyWaterTowerModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
