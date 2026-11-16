import { Suspense, lazy } from 'react'

// A low-poly treehouse: a hut on a platform in a leafy tree, with a rope swing that sways and leaves that rustle. Tap it and the windows light up and a rope ladder drops.
// (Thin wrapper: the scene lives in lowpoly/Treehouse.jsx.)
const Scene = lazy(() => import('../lowpoly/Treehouse.jsx'))

export default function LowPolyTreehouseModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
