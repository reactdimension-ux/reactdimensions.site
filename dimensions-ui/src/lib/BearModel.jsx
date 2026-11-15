import { Suspense, lazy } from 'react'

// A clay-toy bear character; see bear/Bear.jsx for what it does.
// (Thin wrapper: the scene lives in bear/Bear.jsx.)
const Scene = lazy(() => import('../bear/Bear.jsx'))

export default function BearModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
