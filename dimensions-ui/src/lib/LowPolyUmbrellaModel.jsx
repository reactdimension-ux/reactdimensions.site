import { Suspense, lazy } from 'react'

// A low-poly umbrella with a faceted canopy and a curved handle, rain running off its edge. Tap it and it opens wide and spins, flinging the drops off.
// (Thin wrapper: the scene lives in lowpoly/Umbrella.jsx.)
const Scene = lazy(() => import('../lowpoly/Umbrella.jsx'))

export default function LowPolyUmbrellaModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
