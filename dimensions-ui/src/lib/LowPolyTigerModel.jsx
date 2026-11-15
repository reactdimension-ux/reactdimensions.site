import { Suspense, lazy } from 'react'

// A low-poly tiger you drive with the keys or an on-screen pad. It walks on
// a real mechanism: a gait clock, feet planted on the ground, two-bone IK
// legs and a body that bobs, leans and turns; a skeleton view shows it all.
// (Thin wrapper: the scene lives in lowpoly/Tiger.jsx.)
const Scene = lazy(() => import('../lowpoly/Tiger.jsx'))

export default function LowPolyTigerModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
