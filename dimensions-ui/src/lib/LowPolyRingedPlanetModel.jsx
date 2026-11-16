import { Suspense, lazy } from 'react'

// A banded low-poly planet with a tilted ring of tumbling rocks. The ring rocks orbit on their own; tap it and a small moon swings round the planet.
// (Thin wrapper: the scene lives in lowpoly/Planet.jsx.)
const Scene = lazy(() => import('../lowpoly/Planet.jsx'))

export default function LowPolyRingedPlanetModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
