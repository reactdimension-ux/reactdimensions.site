import { Suspense, lazy } from 'react'

// A low-poly tiger built the same way as the Low Poly Bear: an orange body wrapped in black stripes, a white muzzle with whiskers and a striped tail. It breathes, sniffs and swings its tail; tap it and it crouches, pounces, lands with a thud and pads back.
// (Thin wrapper: the scene lives in lowpoly/BengalTiger.jsx.)
const Scene = lazy(() => import('../lowpoly/BengalTiger.jsx'))

export default function LowPolyBengalTigerModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
