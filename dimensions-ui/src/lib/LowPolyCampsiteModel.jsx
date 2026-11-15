import { Suspense, lazy } from 'react'

// A low-poly campsite with a tent, a fire and a lantern; tap it to light the lantern.
// (Thin wrapper: the scene lives in lowpoly/Campsite.jsx.)
const Scene = lazy(() => import('../lowpoly/Campsite.jsx'))

export default function LowPolyCampsiteModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
