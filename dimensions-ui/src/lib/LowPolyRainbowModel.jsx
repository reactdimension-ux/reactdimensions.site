import { Suspense, lazy } from 'react'

// A low-poly rainbow on two clouds with a ripple running through its bands; tap it and they flare.
// (Thin wrapper: the scene lives in lowpoly/Rainbow.jsx.)
const Scene = lazy(() => import('../lowpoly/Rainbow.jsx'))

export default function LowPolyRainbowModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
