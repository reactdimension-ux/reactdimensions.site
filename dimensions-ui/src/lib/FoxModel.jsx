import { Suspense, lazy } from 'react'

// A clay-toy fox character; see fox/Fox.jsx for what it does.
// (Thin wrapper: the scene lives in fox/Fox.jsx.)
const Scene = lazy(() => import('../fox/Fox.jsx'))

export default function FoxModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
