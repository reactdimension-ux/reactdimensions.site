import { Suspense, lazy } from 'react'

// A low-poly hovercraft riding on its air skirt with spray and spinning fans; tap it and it spins on the spot.
// (Thin wrapper: the scene lives in lowpoly/Hovercraft.jsx.)
const Scene = lazy(() => import('../lowpoly/Hovercraft.jsx'))

export default function LowPolyHovercraftModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
