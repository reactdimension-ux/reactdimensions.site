import { Suspense, lazy } from 'react'

// A low-poly island bobbing on a rolling sea with a palm and a sailboat; tap it and it splashes.
// (Thin wrapper: the scene lives in lowpoly/Island.jsx.)
const Scene = lazy(() => import('../lowpoly/Island.jsx'))

export default function LowPolyIslandModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
