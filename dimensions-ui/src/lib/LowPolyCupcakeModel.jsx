import { Suspense, lazy } from 'react'

// A low-poly cupcake in a fluted case, a swirl of icing and a lit candle whose flame flickers. Tap it and a burst of sprinkles flies out.
// (Thin wrapper: the scene lives in lowpoly/Cupcake.jsx.)
const Scene = lazy(() => import('../lowpoly/Cupcake.jsx'))

export default function LowPolyCupcakeModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
