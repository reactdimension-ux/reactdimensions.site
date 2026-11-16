import { Suspense, lazy } from 'react'

// A low-poly tornado: a funnel of stacked spinning rings that sways and wanders over the ground. Tap it and it picks up debris, whirls it round and flings it out.
// (Thin wrapper: the scene lives in lowpoly/Tornado.jsx.)
const Scene = lazy(() => import('../lowpoly/Tornado.jsx'))

export default function LowPolyTornadoModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
