import { Suspense, lazy } from 'react'

// A low-poly sunflower whose head follows the cursor; tap it and the petals shake.
// (Thin wrapper: the scene lives in lowpoly/Sunflower.jsx.)
const Scene = lazy(() => import('../lowpoly/Sunflower.jsx'))

export default function LowPolySunflowerModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
