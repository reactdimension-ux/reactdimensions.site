import { Suspense, lazy } from 'react'

// A low-poly forest valley with a river and mountains; see forest/Forest.jsx for what it does.
// (Thin wrapper: the scene lives in forest/ForestScene.jsx.)
const Scene = lazy(() => import('../forest/ForestScene.jsx'))

export default function ForestValleyModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
