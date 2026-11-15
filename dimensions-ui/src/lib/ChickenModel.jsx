import { Suspense, lazy } from 'react'

// A clay-toy chicken character; see chicken/Chicken.jsx for what it does.
// (Thin wrapper: the scene lives in chicken/Chicken.jsx.)
const Scene = lazy(() => import('../chicken/Chicken.jsx'))

export default function ChickenModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
