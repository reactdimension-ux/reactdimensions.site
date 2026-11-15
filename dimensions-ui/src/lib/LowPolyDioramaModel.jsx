import { Suspense, lazy } from 'react'

// A floating low-poly diorama: a river, a waterfall, a crag, a campsite and a bear.
// (Thin wrapper: the scene lives in lowpoly/Diorama.jsx.)
const Scene = lazy(() => import('../lowpoly/Diorama.jsx'))

export default function LowPolyDioramaModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
