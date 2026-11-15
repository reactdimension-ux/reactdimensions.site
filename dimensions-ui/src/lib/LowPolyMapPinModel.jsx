import { Suspense, lazy } from 'react'

// A low-poly map pin bouncing on the spot; tap it and it leaps, spins and lands with a splash.
// (Thin wrapper: the scene lives in lowpoly/MapPin.jsx.)
const Scene = lazy(() => import('../lowpoly/MapPin.jsx'))

export default function LowPolyMapPinModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
