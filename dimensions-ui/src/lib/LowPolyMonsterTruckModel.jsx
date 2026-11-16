import { Suspense, lazy } from 'react'

// A low-poly monster truck on huge tyres with bouncing suspension; tap it and it jumps a ramp and lands with a squash.
// (Thin wrapper: the scene lives in lowpoly/MonsterTruck.jsx.)
const Scene = lazy(() => import('../lowpoly/MonsterTruck.jsx'))

export default function LowPolyMonsterTruckModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
