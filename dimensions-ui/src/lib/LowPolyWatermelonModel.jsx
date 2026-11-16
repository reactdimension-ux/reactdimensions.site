import { Suspense, lazy } from 'react'

// A low-poly watermelon slice gently rocking on a plate; tap it and a bite is taken out of it with a squash, then it fills back in.
// (Thin wrapper: the scene lives in lowpoly/Watermelon.jsx.)
const Scene = lazy(() => import('../lowpoly/Watermelon.jsx'))

export default function LowPolyWatermelonModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
