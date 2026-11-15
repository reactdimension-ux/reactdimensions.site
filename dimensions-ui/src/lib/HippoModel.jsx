import { Suspense, lazy } from 'react'

// A clay-toy hippo character; see hippo/Hippo.jsx for what it does.
// (Thin wrapper: the scene lives in hippo/Hippo.jsx.)
const Scene = lazy(() => import('../hippo/Hippo.jsx'))

export default function HippoModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
