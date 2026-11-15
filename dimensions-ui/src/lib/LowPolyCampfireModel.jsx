import { Suspense, lazy } from 'react'

// A low-poly campfire with a flickering flame, rising embers and smoke; tap it and it flares and throws sparks.
// (Thin wrapper: the scene lives in lowpoly/Campfire.jsx.)
const Scene = lazy(() => import('../lowpoly/Campfire.jsx'))

export default function LowPolyCampfireModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
