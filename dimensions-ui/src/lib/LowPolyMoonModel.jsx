import { Suspense, lazy } from 'react'

// A low-poly moon that turns through its phases; tap it and a meteor strikes.
// (Thin wrapper: the scene lives in lowpoly/Moon.jsx.)
const Scene = lazy(() => import('../lowpoly/Moon.jsx'))

export default function LowPolyMoonModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
