import { Suspense, lazy } from 'react'

// A tiered low-poly fountain: stone basins one above another, water arcing from the top and falling from tier to tier. Tap it and the jets surge higher.
// (Thin wrapper: the scene lives in lowpoly/Fountain.jsx.)
const Scene = lazy(() => import('../lowpoly/Fountain.jsx'))

export default function LowPolyFountainModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
