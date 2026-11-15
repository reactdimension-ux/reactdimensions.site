import { Suspense, lazy } from 'react'

// A low-poly potted flower whose petals open and close; tap it and the bloom spins and sheds petals.
// (Thin wrapper: the scene lives in lowpoly/Flower.jsx.)
const Scene = lazy(() => import('../lowpoly/Flower.jsx'))

export default function LowPolyFlowerModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
