import { Suspense, lazy } from 'react'

// A low-poly food truck with a striped awning that flaps in the breeze. Tap it and the serving hatch swings open and a sign pops up.
// (Thin wrapper: the scene lives in lowpoly/FoodTruck.jsx.)
const Scene = lazy(() => import('../lowpoly/FoodTruck.jsx'))

export default function LowPolyFoodTruckModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
