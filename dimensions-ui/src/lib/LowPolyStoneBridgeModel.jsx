import { Suspense, lazy } from 'react'

// A low-poly arched stone bridge over a flowing stream; tap it and a little boat drifts under the arch.
// (Thin wrapper: the scene lives in lowpoly/StoneBridge.jsx.)
const Scene = lazy(() => import('../lowpoly/StoneBridge.jsx'))

export default function LowPolyStoneBridgeModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
