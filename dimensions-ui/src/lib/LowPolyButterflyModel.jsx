import { Suspense, lazy } from 'react'

// A low-poly butterfly resting on a flower, opening and closing its wings slowly. Tap it and it flies a figure-eight and lands again.
// (Thin wrapper: the scene lives in lowpoly/Butterfly.jsx.)
const Scene = lazy(() => import('../lowpoly/Butterfly.jsx'))

export default function LowPolyButterflyModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
