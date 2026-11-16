import { Suspense, lazy } from 'react'

// A low-poly torii gate with paper lanterns swaying beneath its curved beams. Tap it and a swirl of petals blows through.
// (Thin wrapper: the scene lives in lowpoly/Torii.jsx.)
const Scene = lazy(() => import('../lowpoly/Torii.jsx'))

export default function LowPolyToriiGateModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
