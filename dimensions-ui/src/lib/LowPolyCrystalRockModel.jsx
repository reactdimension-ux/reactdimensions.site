import { Suspense, lazy } from 'react'

// A low-poly boulder with a cluster of glowing crystals and a floating shard; tap it and the crystals flare.
// (Thin wrapper: the scene lives in lowpoly/CrystalRock.jsx.)
const Scene = lazy(() => import('../lowpoly/CrystalRock.jsx'))

export default function LowPolyCrystalRockModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
