import { Suspense, lazy } from 'react'

// A low-poly motion-graphics model; see lowpoly/Waterfall.jsx for what it does.
// (Thin wrapper: the scene lives in lowpoly/Waterfall.jsx.)
const Scene = lazy(() => import('../lowpoly/Waterfall.jsx'))

export default function LowPolyWaterfallModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
