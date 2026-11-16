import { Suspense, lazy } from 'react'

// A low-poly paddle steamer on the water with its wheel turning and smoke puffing; tap it and the horn sounds with a big smoke ring.
// (Thin wrapper: the scene lives in lowpoly/PaddleSteamer.jsx.)
const Scene = lazy(() => import('../lowpoly/PaddleSteamer.jsx'))

export default function LowPolyPaddleSteamerModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
