import { Suspense, lazy } from 'react'

// A low-poly racing circuit with cars lapping it; see circuit/Circuit.jsx for what it does.
// (Thin wrapper: the scene lives in circuit/CircuitScene.jsx.)
const Scene = lazy(() => import('../circuit/CircuitScene.jsx'))

export default function RacingCircuitModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
