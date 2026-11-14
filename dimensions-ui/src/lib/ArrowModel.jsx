import { Suspense, lazy } from 'react'

// A carbon target arrow at real size: twill-weave shaft, steel field point,
// three vanes and a translucent nock. Spin it, or zoom in to the details.
// (Thin wrapper: the scene lives in arrow/ArrowScene.jsx.)
const Scene = lazy(() => import('../arrow/ArrowScene.jsx'))

export default function ArrowModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
