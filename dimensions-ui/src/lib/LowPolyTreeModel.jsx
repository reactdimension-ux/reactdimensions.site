import { Suspense, lazy } from 'react'

// A low-poly pine that sways in the wind, each tier a beat behind the one below; tap it to shake it.
// (Thin wrapper: the scene lives in lowpoly/Tree.jsx.)
const Scene = lazy(() => import('../lowpoly/Tree.jsx'))

export default function LowPolyTreeModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
