import { Suspense, lazy } from 'react'

// A low-poly rubber duck bobbing on a pond; tap it for a squeeze and ripples.
// (Thin wrapper: the scene lives in lowpoly/Duck.jsx.)
const Scene = lazy(() => import('../lowpoly/Duck.jsx'))

export default function LowPolyRubberDuckModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
