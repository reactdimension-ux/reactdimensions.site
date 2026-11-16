import { Suspense, lazy } from 'react'

// A low-poly rowboat with two oars, rocking on a little pond. Tap it and the oars pull a stroke and the boat glides.
// (Thin wrapper: the scene lives in lowpoly/Rowboat.jsx.)
const Scene = lazy(() => import('../lowpoly/Rowboat.jsx'))

export default function LowPolyRowboatModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
