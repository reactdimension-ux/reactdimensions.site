import { Suspense, lazy } from 'react'

// A low-poly tower windmill with turning lattice sails; tap it and a gust whirls them.
// (Thin wrapper: the scene lives in lowpoly/Windmill.jsx.)
const Scene = lazy(() => import('../lowpoly/Windmill.jsx'))

export default function LowPolyWindmillModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
