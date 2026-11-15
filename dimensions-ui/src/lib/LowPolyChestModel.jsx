import { Suspense, lazy } from 'react'

// A low-poly treasure chest whose lid springs open on gold light and a burst of coins.
// (Thin wrapper: the scene lives in lowpoly/Chest.jsx.)
const Scene = lazy(() => import('../lowpoly/Chest.jsx'))

export default function LowPolyChestModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
