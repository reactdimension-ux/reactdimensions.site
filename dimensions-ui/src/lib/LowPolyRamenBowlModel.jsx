import { Suspense, lazy } from 'react'

// A low-poly steaming bowl of ramen with egg, toppings and chopsticks; tap it and the chopsticks lift a pull of noodles.
// (Thin wrapper: the scene lives in lowpoly/RamenBowl.jsx.)
const Scene = lazy(() => import('../lowpoly/RamenBowl.jsx'))

export default function LowPolyRamenBowlModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
