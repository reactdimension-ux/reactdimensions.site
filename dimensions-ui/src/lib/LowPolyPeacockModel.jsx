import { Suspense, lazy } from 'react'

// A low-poly peacock that pecks and bobs its head; tap it and its tail fans open with shimmering eye spots.
// (Thin wrapper: the scene lives in lowpoly/Peacock.jsx.)
const Scene = lazy(() => import('../lowpoly/Peacock.jsx'))

export default function LowPolyPeacockModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
