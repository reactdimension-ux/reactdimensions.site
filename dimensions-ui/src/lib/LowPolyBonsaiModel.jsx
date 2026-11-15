import { Suspense, lazy } from 'react'

// A low-poly bonsai with a swaying S-curved trunk and canopy pads; tap it and petals fall.
// (Thin wrapper: the scene lives in lowpoly/Bonsai.jsx.)
const Scene = lazy(() => import('../lowpoly/Bonsai.jsx'))

export default function LowPolyBonsaiModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
