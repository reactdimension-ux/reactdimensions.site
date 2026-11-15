import { Suspense, lazy } from 'react'

// A low-poly tree stump with glowing growth rings; tap it and leaves pop off the top.
// (Thin wrapper: the scene lives in lowpoly/Stump.jsx.)
const Scene = lazy(() => import('../lowpoly/Stump.jsx'))

export default function LowPolyStumpModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
