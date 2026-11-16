import { Suspense, lazy } from 'react'

// A low-poly tall sea stack in the surf where waves break at its base and gulls circle overhead; tap it and the gulls scatter, then settle back on the ledges.
// (Thin wrapper: the scene lives in lowpoly/SeaStack.jsx.)
const Scene = lazy(() => import('../lowpoly/SeaStack.jsx'))

export default function LowPolySeaStackModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
