import { Suspense, lazy } from 'react'

// A low-poly toadstool cluster whose caps breathe and glow; tap it and they puff out spores.
// (Thin wrapper: the scene lives in lowpoly/Mushrooms.jsx.)
const Scene = lazy(() => import('../lowpoly/Mushrooms.jsx'))

export default function LowPolyMushroomsModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
