import { Suspense, lazy } from 'react'

// Low-poly rice paddies curving and stepping down a hillside, ripples drifting across each one; tap it and water spills down the steps one terrace at a time.
// (Thin wrapper: the scene lives in lowpoly/RiceTerraces.jsx.)
const Scene = lazy(() => import('../lowpoly/RiceTerraces.jsx'))

export default function LowPolyRiceTerracesModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
