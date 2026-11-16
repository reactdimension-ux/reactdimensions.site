import { Suspense, lazy } from 'react'

// A low-poly stack of pancakes with butter and syrup dripping down the side; tap it and the top pancake flips.
// (Thin wrapper: the scene lives in lowpoly/PancakeStack.jsx.)
const Scene = lazy(() => import('../lowpoly/PancakeStack.jsx'))

export default function LowPolyPancakeStackModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
