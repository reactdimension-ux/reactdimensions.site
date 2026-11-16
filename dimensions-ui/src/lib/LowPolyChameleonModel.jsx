import { Suspense, lazy } from 'react'

// A low-poly chameleon on a branch, its eyes rolling on their own; tap it and its tongue shoots out while its colour shifts.
// (Thin wrapper: the scene lives in lowpoly/Chameleon.jsx.)
const Scene = lazy(() => import('../lowpoly/Chameleon.jsx'))

export default function LowPolyChameleonModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
