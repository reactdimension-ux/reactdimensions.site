import { Suspense, lazy } from 'react'

// A low-poly trophy cup that turns and gleams; tap it and it whirls and throws sparkles.
// (Thin wrapper: the scene lives in lowpoly/Trophy.jsx.)
const Scene = lazy(() => import('../lowpoly/Trophy.jsx'))

export default function LowPolyTrophyModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
