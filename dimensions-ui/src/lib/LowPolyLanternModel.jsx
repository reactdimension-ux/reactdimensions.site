import { Suspense, lazy } from 'react'

// A low-poly lantern with a flickering flame, hanging from a post; tap it and it swings.
// (Thin wrapper: the scene lives in lowpoly/Lantern.jsx.)
const Scene = lazy(() => import('../lowpoly/Lantern.jsx'))

export default function LowPolyLanternModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
