import { Suspense, lazy } from 'react'

// A low-poly hummingbird hovering on a blur of buzzing wings beside a flower. Tap it and it zips to the flower, sips, and darts back.
// (Thin wrapper: the scene lives in lowpoly/Hummingbird.jsx.)
const Scene = lazy(() => import('../lowpoly/Hummingbird.jsx'))

export default function LowPolyHummingbirdModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
