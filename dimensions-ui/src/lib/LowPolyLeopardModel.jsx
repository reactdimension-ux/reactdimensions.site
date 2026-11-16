import { Suspense, lazy } from 'react'

// A lean low-poly leopard built the same way as the Low Poly Bear: a spotted golden coat, amber eyes, whiskers and a long curling tail. It breathes, sniffs and swings its tail; tap it and it crouches, pounces, lands and pads back. Also as a snow leopard, jaguar and black panther.
// (Thin wrapper: the scene lives in lowpoly/Leopard.jsx.)
const Scene = lazy(() => import('../lowpoly/Leopard.jsx'))

export default function LowPolyLeopardModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
