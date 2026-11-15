import { Suspense, lazy } from 'react'

// A clay-toy tiger character; see tiger/Tiger.jsx for what it does.
// (Thin wrapper: the scene lives in tiger/Tiger.jsx.)
const Scene = lazy(() => import('../tiger/Tiger.jsx'))

export default function TigerModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
