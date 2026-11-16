import { Suspense, lazy } from 'react'

// A low-poly snail with a spiral shell, gliding over a leaf with its eye stalks wobbling and a glistening trail behind. Tap it and it pulls into its shell, then peeks back out.
// (Thin wrapper: the scene lives in lowpoly/Snail.jsx.)
const Scene = lazy(() => import('../lowpoly/Snail.jsx'))

export default function LowPolySnailModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
