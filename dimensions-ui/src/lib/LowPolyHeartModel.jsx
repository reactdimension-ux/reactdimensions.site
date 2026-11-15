import { Suspense, lazy } from 'react'

// A low-poly heart that beats lub-dub; tap it for one big beat, rings and a spray of little hearts.
// (Thin wrapper: the scene lives in lowpoly/Heart.jsx.)
const Scene = lazy(() => import('../lowpoly/Heart.jsx'))

export default function LowPolyHeartModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
