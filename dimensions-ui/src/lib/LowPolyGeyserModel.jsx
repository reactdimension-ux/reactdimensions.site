import { Suspense, lazy } from 'react'

// A low-poly geyser: a hot pool in a ring of rock, steam curling up off the water. Tap it and it erupts in a tall column of water and spray.
// (Thin wrapper: the scene lives in lowpoly/Geyser.jsx.)
const Scene = lazy(() => import('../lowpoly/Geyser.jsx'))

export default function LowPolyGeyserModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
