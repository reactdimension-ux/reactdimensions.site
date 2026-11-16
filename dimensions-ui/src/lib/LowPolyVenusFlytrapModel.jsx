import { Suspense, lazy } from 'react'

// A low-poly Venus flytrap in a pot, its toothed jaws slowly opening and closing; tap it and a fly buzzes in and the jaws snap shut.
// (Thin wrapper: the scene lives in lowpoly/VenusFlytrap.jsx.)
const Scene = lazy(() => import('../lowpoly/VenusFlytrap.jsx'))

export default function LowPolyVenusFlytrapModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
