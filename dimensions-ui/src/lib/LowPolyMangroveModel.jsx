import { Suspense, lazy } from 'react'

// A low-poly mangrove on arched roots, water lapping around them; tap it and a fish jumps between the roots.
// (Thin wrapper: the scene lives in lowpoly/Mangrove.jsx.)
const Scene = lazy(() => import('../lowpoly/Mangrove.jsx'))

export default function LowPolyMangroveModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
