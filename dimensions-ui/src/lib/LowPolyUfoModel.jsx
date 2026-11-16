import { Suspense, lazy } from 'react'

// A low-poly flying saucer hovering over a patch of grass, rim lights chasing round. Tap it and a beam lifts a cow up and drops it gently back.
// (Thin wrapper: the scene lives in lowpoly/Ufo.jsx.)
const Scene = lazy(() => import('../lowpoly/Ufo.jsx'))

export default function LowPolyUfoModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
