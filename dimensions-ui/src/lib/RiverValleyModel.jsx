import { Suspense, lazy } from 'react'

// A photoreal river valley under snowy peaks; see valley/Valley.jsx for what it does.
// (Thin wrapper: the scene lives in valley/ValleyScene.jsx.)
const Scene = lazy(() => import('../valley/ValleyScene.jsx'))

export default function RiverValleyModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
