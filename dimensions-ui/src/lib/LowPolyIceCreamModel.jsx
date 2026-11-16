import { Suspense, lazy } from 'react'

// A waffle cone with stacked low-poly scoops. A drip runs slowly down the side; tap it and the top scoop wobbles and nearly topples.
// (Thin wrapper: the scene lives in lowpoly/IceCream.jsx.)
const Scene = lazy(() => import('../lowpoly/IceCream.jsx'))

export default function LowPolyIceCreamModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
