import { Suspense, lazy } from 'react'

// A small low-poly pond ringed with stones, lily pads afloat and one lotus bud. The pads bob and ripples spread across the water; tap it and the lotus opens.
// (Thin wrapper: the scene lives in lowpoly/LilyPond.jsx.)
const Scene = lazy(() => import('../lowpoly/LilyPond.jsx'))

export default function LowPolyLilyPondModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
