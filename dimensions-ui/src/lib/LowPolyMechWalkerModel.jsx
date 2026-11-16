import { Suspense, lazy } from 'react'

// A low-poly two-legged mech walker that shifts its weight and scans; tap it and it takes a few heavy, stomping steps.
// (Thin wrapper: the scene lives in lowpoly/MechWalker.jsx.)
const Scene = lazy(() => import('../lowpoly/MechWalker.jsx'))

export default function LowPolyMechWalkerModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
