import { Suspense, lazy } from 'react'

// A low-poly farm tractor with big rear wheels, a cab and an exhaust that puffs as the wheels turn. Tap it and it pops a wheelie.
// (Thin wrapper: the scene lives in lowpoly/Tractor.jsx.)
const Scene = lazy(() => import('../lowpoly/Tractor.jsx'))

export default function LowPolyTractorModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
