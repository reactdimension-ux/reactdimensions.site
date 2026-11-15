import { Suspense, lazy } from 'react'

// A low-poly cut gem that turns and glows; tap it and it flashes, whirls and throws sparkles.
// (Thin wrapper: the scene lives in lowpoly/Gem.jsx.)
const Scene = lazy(() => import('../lowpoly/Gem.jsx'))

export default function LowPolyGemModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
